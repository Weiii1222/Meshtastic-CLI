import json
import os
import re
import subprocess
import sys
import threading
import uuid
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse


DASHBOARD_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = DASHBOARD_DIR.parents[1]
DEMO_DIR = PROJECT_ROOT / "tests" / "meshtastic_cli_demo"
CASES_PATH = DEMO_DIR / "cases_l2_demo.json"
RUNNER_PATH = DEMO_DIR / "runner.py"
AUTOMATION_COVERAGE_PATH = PROJECT_ROOT / "project-background" / "requirements" / "automation_coverage_matrix.json"
LOGS_DIR = Path(os.environ.get("MESHTASTIC_DASHBOARD_LOG_DIR") or PROJECT_ROOT / "logs").resolve()
LOCAL_MESHTASTIC = PROJECT_ROOT / ".venv" / "Scripts" / "meshtastic.exe"
RUNS = {}
RUN_PROCESSES = {}
RUNS_LOCK = threading.Lock()
SERIAL_LOGS = {}
SERIAL_LOG_LOCK = threading.Lock()


def load_cases():
    data = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    modules = {}
    for case in data.get("cases", []):
        module = case.get("module") or "未分组"
        modules.setdefault(module, []).append(case)
    return {
        "suite": data.get("suite"),
        "version": data.get("version"),
        "modules": modules,
        "cases": data.get("cases", []),
    }


def load_coverage():
    if not AUTOMATION_COVERAGE_PATH.exists():
        return {"available": False, "summary": {}, "byFunction": {}, "sample": []}
    matrix = json.loads(AUTOMATION_COVERAGE_PATH.read_text(encoding="utf-8"))
    summary = {"auto": 0, "assisted": 0, "manual": 0}
    by_function = {}
    for item in matrix:
        coverage = item.get("coverage") or "manual"
        summary[coverage] = summary.get(coverage, 0) + 1
        function = item.get("function") or "未分组"
        by_function.setdefault(function, {"auto": 0, "assisted": 0, "manual": 0, "total": 0})
        by_function[function][coverage] = by_function[function].get(coverage, 0) + 1
        by_function[function]["total"] += 1
    sample = [item for item in matrix if item.get("coverage") == "auto"][:8]
    return {
        "available": True,
        "total": len(matrix),
        "summary": summary,
        "byFunction": by_function,
        "sample": sample,
        "markdown": str(PROJECT_ROOT / "docs" / "Wio_Tracker_L2_Meshtastic_CLI_自动化覆盖矩阵.md"),
    }


def list_reports(limit=12):
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    reports = sorted(
        LOGS_DIR.glob("meshtastic_cli_*report_*.json"),
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )
    return [
        {
            "name": report.name,
            "path": str(report),
            "viewUrl": f"/api/report?name={quote(report.name)}",
            "downloadUrl": f"/api/report?name={quote(report.name)}&download=1",
            "mtime": datetime.fromtimestamp(report.stat().st_mtime).isoformat(timespec="seconds"),
            "size": report.stat().st_size,
        }
        for report in reports[:limit]
    ]


def normalize_usb_serial(value):
    if not value:
        return ""
    clean = value.strip().strip("{}").replace("-", "").replace(":", "").upper()
    if re.fullmatch(r"[0-9A-F]{12}", clean):
        return ":".join(clean[index:index + 2] for index in range(0, 12, 2))
    return value.strip()


def extract_usb_serial(text):
    text = text or ""
    match = re.search(r"\bSER=([0-9A-Fa-f:.-]+)", text)
    if match:
        return normalize_usb_serial(match.group(1))
    match = re.search(r"\bSER=([^\s]+)", text)
    if match:
        return match.group(1).strip()
    return ""


def extract_usb_instance(text):
    # Windows PNP instance IDs such as 6&1BE3522E&0&0000 are not stable enough
    # for tester-facing device identity. Keep them in hwid only.
    return ""


def friendly_port_name(name, manufacturer):
    name = (name or "").strip()
    manufacturer = (manufacturer or "").strip()
    for marker in ("(COM", "COM"):
        if marker in name and name.upper().startswith("USB"):
            return "USB 串行设备"
    return name or manufacturer or "串口设备"


def enrich_port(port, name="", manufacturer="", hwid="", text=""):
    text = " ".join(str(value or "") for value in (text, port, name, manufacturer, hwid))
    usb_serial = extract_usb_serial(text)
    device_id = usb_serial or extract_usb_instance(text)
    return {
        "port": str(port).upper(),
        "name": friendly_port_name(name, manufacturer),
        "manufacturer": manufacturer or "",
        "hwid": hwid or "",
        "usbSerial": usb_serial,
        "deviceId": device_id,
        "likelyDevice": is_likely_meshtastic_port(text),
    }


def detect_serial_ports():
    ports = []
    try:
        from serial.tools import list_ports

        for item in list_ports.comports():
            text = " ".join(str(value or "") for value in (item.device, item.description, item.manufacturer, getattr(item, "serial_number", ""), item.hwid))
            ports.append(enrich_port(item.device, item.description, item.manufacturer, item.hwid, text))
    except Exception:
        ports = []

    if ports:
        wmi_ports = detect_serial_ports_with_wmi()
        if wmi_ports:
            by_port = {item["port"]: item for item in ports}
            for wmi_port in wmi_ports:
                existing = by_port.get(wmi_port["port"])
                if existing and not existing.get("deviceId"):
                    existing["deviceId"] = wmi_port.get("deviceId") or ""
                    existing["hwid"] = wmi_port.get("hwid") or existing.get("hwid") or ""
                elif not existing:
                    by_port[wmi_port["port"]] = wmi_port
            ports = list(by_port.values())
        return sorted(unique_ports(ports), key=lambda item: natural_com_key(item["port"]))

    ports = detect_serial_ports_with_wmi()
    if ports:
        return sorted(unique_ports(ports), key=lambda item: natural_com_key(item["port"]))

    return detect_serial_ports_with_dotnet()


def detect_serial_ports_with_wmi():
    script = (
        "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); "
        "$OutputEncoding = [Console]::OutputEncoding; "
        "$serial = Get-CimInstance Win32_SerialPort | "
        "Select-Object DeviceID,Name,Description,Manufacturer,PNPDeviceID; "
        "$pnp = Get-CimInstance Win32_PnPEntity | "
        "Where-Object { $_.Name -match '\\(COM[0-9]+\\)' } | "
        "Select-Object @{Name='DeviceID';Expression={ if ($_.Name -match '\\((COM[0-9]+)\\)') { $Matches[1] } else { '' } }},Name,Description,Manufacturer,PNPDeviceID; "
        "@($serial) + @($pnp) | Where-Object { $_.DeviceID } | ConvertTo-Json -Depth 3"
    )
    try:
        completed = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=8,
            check=False,
        )
        if completed.returncode != 0 or not completed.stdout.strip():
            return []
        raw = json.loads(completed.stdout)
        rows = raw if isinstance(raw, list) else [raw]
        ports = []
        for row in rows:
            port = str(row.get("DeviceID") or "").upper()
            name = str(row.get("Name") or "")
            if not re.fullmatch(r"COM\d+", port, flags=re.IGNORECASE):
                match = re.search(r"\((COM\d+)\)", name, flags=re.IGNORECASE)
                port = match.group(1).upper() if match else ""
            if not port:
                continue
            text = " ".join(str(row.get(key) or "") for key in ("DeviceID", "Name", "Description", "Manufacturer", "PNPDeviceID"))
            ports.append(enrich_port(port, name, row.get("Manufacturer"), row.get("PNPDeviceID"), text))
        return sorted(unique_ports(ports), key=lambda item: natural_com_key(item["port"]))
    except Exception:
        return []


def detect_serial_ports_with_dotnet():
    script = (
        "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); "
        "$OutputEncoding = [Console]::OutputEncoding; "
        "[System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object | ConvertTo-Json"
    )
    try:
        completed = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
            check=False,
        )
        if completed.returncode != 0 or not completed.stdout.strip():
            return []
        raw = json.loads(completed.stdout)
        names = raw if isinstance(raw, list) else [raw]
        return [
            enrich_port(str(name).upper(), str(name).upper(), "", "", str(name))
            for name in names
            if re.fullmatch(r"COM\d+", str(name), flags=re.IGNORECASE)
        ]
    except Exception:
        return []


def unique_ports(ports):
    output = {}
    for item in ports:
        output[item["port"].upper()] = item
    return list(output.values())


def natural_com_key(port):
    match = re.search(r"COM(\d+)", port, flags=re.IGNORECASE)
    return int(match.group(1)) if match else 9999


def is_likely_meshtastic_port(text):
    lowered = text.lower()
    markers = ("usb", "uart", "serial", "串行", "cp210", "ch340", "silicon labs", "wch", "esp32", "jtag", "vid_303a", "pid_1001", "meshtastic")
    return any(marker in lowered for marker in markers)


def sanitize_run_request(payload):
    cases = load_cases()["cases"]
    all_case_ids = {case["id"] for case in cases}
    module_map = {}
    for case in cases:
        module_map.setdefault(case.get("module") or "未分组", []).append(case["id"])

    target_type = payload.get("targetType", "suite")
    if target_type == "case":
        selected = [payload.get("caseId")]
    elif target_type == "module":
        selected = module_map.get(payload.get("module"), [])
    elif target_type == "modules":
        selected = []
        for module in payload.get("modules") or []:
            selected.extend(module_map.get(module, []))
    elif target_type == "customConfig":
        selected = ["L2-CUSTOM-CONFIG"]
    elif target_type == "communicationConfig":
        selected = ["L2-COMM-CONFIG"]
    elif target_type == "communicationCheck":
        selected = ["L2-COMM-CHECK"]
    elif target_type == "communicationExperiment":
        selected = ["L2-COMM-EXPERIMENT"]
    elif target_type == "contactExchange":
        selected = ["MESHTASTIC-CONTACT-EXCHANGE"]
    else:
        selected = [case["id"] for case in cases]
    dynamic_case_ids = {"L2-CUSTOM-CONFIG", "L2-COMM-CONFIG", "L2-COMM-CHECK", "L2-COMM-EXPERIMENT", "MESHTASTIC-CONTACT-EXCHANGE"}
    selected = [case_id for case_id in selected if case_id in all_case_ids or case_id in dynamic_case_ids]

    connection_type = payload.get("connectionType", "none")
    primary_port = str(payload.get("primaryPort") or "").strip()
    connection_value = str(payload.get("connectionValue") or "").strip()
    host_value = str(payload.get("hostValue") or "").strip()
    ble_value = str(payload.get("bleValue") or "").strip()
    peer_port = str(payload.get("peerPort") or "").strip()
    peer_host = str(payload.get("peerHostValue") or "").strip()
    peer_ble = str(payload.get("peerBleValue") or "").strip()

    args = [sys.executable, "-B", str(RUNNER_PATH)]
    if LOCAL_MESHTASTIC.exists():
        args.extend(["--meshtastic", str(LOCAL_MESHTASTIC)])
    if payload.get("execute"):
        args.append("--execute")
    if payload.get("allowMutating"):
        args.append("--allow-mutating")
    timeout = int(payload.get("timeout") or 60)
    timeout = max(5, min(timeout, 300))
    args.extend(["--timeout", str(timeout)])
    step_gap = float(payload.get("stepGap") or 5)
    step_gap = max(0, min(step_gap, 30))
    args.extend(["--step-gap", str(step_gap)])

    if connection_type == "port" and primary_port:
        args.extend(["--port", primary_port])
    elif connection_type == "port" and connection_value:
        args.extend(["--port", connection_value])
    elif connection_type == "host" and host_value:
        args.extend(["--host", host_value])
    elif connection_type == "host" and connection_value:
        args.extend(["--host", connection_value])
    elif connection_type == "ble" and ble_value:
        args.extend(["--ble", ble_value])
    elif connection_type == "ble" and connection_value:
        args.extend(["--ble", connection_value])
    if peer_port:
        args.extend(["--peer-port", peer_port])
    elif connection_type == "host" and peer_host:
        args.extend(["--peer-host", peer_host])
    elif connection_type == "ble" and peer_ble:
        args.extend(["--peer-ble", peer_ble])

    dest = str(payload.get("dest") or "").strip()
    if dest:
        args.extend(["--dest", dest])

    if target_type == "customConfig":
        config_kind = str(payload.get("configKind") or "field").strip()
        config_json = payload.get("configJson") or {}
        if not isinstance(config_json, dict):
            config_json = {}
        if config_kind == "channel" and str(config_json.get("psk") or "").strip().lower() == "random":
            raise ValueError("双设备一致性配置不要使用 psk=random；请使用 default、none 或同一个 0x... PSK。")
        channel_psk = str(config_json.get("psk") or "").strip()
        if config_kind == "channel" and channel_psk and not re.fullmatch(r"(?i)(default|none|0x[0-9a-f]+|base64:.+)", channel_psk):
            raise ValueError("Channel PSK 只支持 default、none、0x... 或 base64:...；不要输入 123 这类短数字。")
        config_field = str(payload.get("configField") or "").strip()
        config_value = str(payload.get("configValue") or "").strip()
        config_target = str(payload.get("configTarget") or "primary").strip()
        config_wait_raw = payload.get("configWait")
        config_wait = int(config_wait_raw if config_wait_raw not in (None, "") else 10)
        config_wait = max(0, min(config_wait, 120))
        args.extend([
            "--custom-only",
            "--config-kind", config_kind,
            "--config-json", json.dumps(config_json, ensure_ascii=False),
            "--config-field", config_field,
            "--config-value", config_value,
            "--config-target", config_target,
            "--reboot-wait", str(config_wait),
        ])
    elif target_type == "communicationConfig":
        args.append("--communication-config-only")
        experiment_region = str(payload.get("experimentRegion") or "").strip()
        experiment_modem = str(payload.get("experimentModem") or "").strip()
        override_frequency = str(payload.get("overrideFrequency") or "").strip()
        reboot_wait_raw = payload.get("rebootWait")
        reboot_wait = int(reboot_wait_raw if reboot_wait_raw not in (None, "") else 10)
        reboot_wait = max(0, min(reboot_wait, 120))
        receive_wait_raw = payload.get("receiveWait")
        receive_wait = int(receive_wait_raw if receive_wait_raw not in (None, "") else 10)
        receive_wait = max(3, min(receive_wait, 120))
        if experiment_region:
            args.extend(["--experiment-region", experiment_region])
        if experiment_modem:
            args.extend(["--experiment-modem", experiment_modem])
        if override_frequency:
            args.extend(["--override-frequency", override_frequency])
        args.extend(["--reboot-wait", str(reboot_wait)])
    elif target_type == "communicationCheck":
        args.append("--communication-check-only")
    elif target_type == "communicationExperiment":
        args.append("--experiment-only")
        experiment_region = str(payload.get("experimentRegion") or "").strip()
        experiment_modem = str(payload.get("experimentModem") or "").strip()
        message_primary = str(payload.get("messagePrimary") or "").strip()
        message_peer = str(payload.get("messagePeer") or "").strip()
        message_mode = str(payload.get("messageMode") or "device").strip()
        primary_node_id = str(payload.get("primaryNodeId") or "").strip()
        peer_node_id = str(payload.get("peerNodeId") or "").strip()
        try:
            message_channel = int(payload.get("messageChannel") or 0)
        except (TypeError, ValueError):
            message_channel = 0
        reboot_wait_raw = payload.get("rebootWait")
        reboot_wait = int(reboot_wait_raw if reboot_wait_raw not in (None, "") else 10)
        reboot_wait = max(0, min(reboot_wait, 120))
        receive_wait_raw = payload.get("receiveWait")
        receive_wait = int(receive_wait_raw if receive_wait_raw not in (None, "") else 10)
        receive_wait = max(3, min(receive_wait, 120))
        if experiment_region:
            args.extend(["--experiment-region", experiment_region])
        if experiment_modem:
            args.extend(["--experiment-modem", experiment_modem])
        if message_primary:
            args.extend(["--message-primary", message_primary])
        if message_peer:
            args.extend(["--message-peer", message_peer])
        if message_mode in ("device", "channel"):
            args.extend(["--message-mode", message_mode])
        if primary_node_id:
            args.extend(["--primary-node-id", primary_node_id])
        if peer_node_id:
            args.extend(["--peer-node-id", peer_node_id])
        args.extend(["--message-channel", str(max(0, min(message_channel, 7)))])
        args.extend(["--reboot-wait", str(reboot_wait)])
        args.extend(["--receive-wait", str(receive_wait)])
    elif target_type == "contactExchange":
        args.append("--contact-exchange-only")
    else:
        for case_id in selected:
            args.extend(["--case", case_id])

    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    run_id = uuid.uuid4().hex[:12]
    report = LOGS_DIR / f"meshtastic_cli_dashboard_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{run_id}.json"
    progress = LOGS_DIR / f"meshtastic_cli_progress_{run_id}.jsonl"
    args.extend(["--out", str(report)])
    args.extend(["--progress-out", str(progress)])
    normalized = {
        "connectionType": connection_type,
        "primaryPort": primary_port or connection_value,
        "hostValue": host_value,
        "bleValue": ble_value,
        "peerPort": peer_port,
        "peerHostValue": peer_host,
        "peerBleValue": peer_ble,
        "configTarget": payload.get("configTarget"),
        "configKind": payload.get("configKind"),
        "configField": payload.get("configField"),
        "targetType": target_type,
        "experimentRegion": payload.get("experimentRegion"),
        "experimentModem": payload.get("experimentModem"),
        "overrideFrequency": payload.get("overrideFrequency"),
        "messageMode": payload.get("messageMode"),
        "messageChannel": payload.get("messageChannel"),
        "receiveWait": payload.get("receiveWait"),
        "primaryNodeId": payload.get("primaryNodeId"),
        "peerNodeId": payload.get("peerNodeId"),
    }
    estimated_steps = len(selected) * 6
    if target_type == "customConfig":
        estimated_steps = 8 if str(payload.get("configTarget") or "primary").strip() == "both" else 4
    elif target_type == "communicationConfig":
        estimated_steps = 8
    elif target_type == "communicationCheck":
        estimated_steps = 3
    elif target_type == "communicationExperiment":
        has_serial_pair = connection_type == "port" and bool(primary_port and peer_port)
        has_distinct_ids = bool(payload.get("primaryNodeId") and payload.get("peerNodeId") and payload.get("primaryNodeId") != payload.get("peerNodeId"))
        message_mode = str(payload.get("messageMode") or "device").strip()
        estimated_steps = 1 if has_serial_pair and (message_mode == "channel" or has_distinct_ids) else 9
    elif target_type == "contactExchange":
        estimated_steps = 8
    normalized["estimatedSteps"] = estimated_steps
    job_timeout = timeout * max(1, estimated_steps) + 180
    return args, report, progress, selected, job_timeout, normalized


def read_progress(progress_path):
    path = Path(progress_path)
    if not path.exists():
        return []
    events = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            events.append({"event": "parse_error", "raw": line})
    return events


def summarize_progress(events, fallback_total=0):
    step_events = [event for event in events if event.get("event") == "step_end"]
    last = events[-1] if events else {}
    total = max([int(event.get("total") or 0) for event in events] or [int(fallback_total or 0)])
    done = len(step_events)
    return {
        "done": done,
        "total": total,
        "percent": round(done / total * 100) if total else 0,
        "current": last,
        "events": events[-80:],
    }


def run_job(job_id, command, report, progress, job_timeout, selected, normalized):
    with RUNS_LOCK:
        RUNS[job_id].update({"status": "running", "startedAt": datetime.now().isoformat(timespec="seconds")})
    child_env = os.environ.copy()
    child_env["PYTHONIOENCODING"] = "utf-8"
    try:
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=child_env,
        )
        with RUNS_LOCK:
            RUN_PROCESSES[job_id] = process
            if RUNS.get(job_id, {}).get("status") == "canceled":
                terminate_process_tree(process)
        stdout, stderr = process.communicate(timeout=job_timeout)
        with RUNS_LOCK:
            if RUNS.get(job_id, {}).get("status") == "canceled":
                RUN_PROCESSES.pop(job_id, None)
                return
        result = json.loads(report.read_text(encoding="utf-8")) if report.exists() else {}
        status = "done" if process.returncode == 0 else "failed"
        with RUNS_LOCK:
            RUN_PROCESSES.pop(job_id, None)
            RUNS[job_id].update({
                "status": status,
                "exitCode": process.returncode,
                "stdout": stdout[-4000:],
                "stderr": stderr[-4000:],
                "report": str(report),
                "reportName": report.name,
                "normalized": normalized,
                "result": result,
                "finishedAt": datetime.now().isoformat(timespec="seconds"),
            })
    except subprocess.TimeoutExpired:
        with RUNS_LOCK:
            process = RUN_PROCESSES.pop(job_id, None)
        if process:
            terminate_process_tree(process)
        with RUNS_LOCK:
            RUNS[job_id].update({"status": "timeout", "error": "timeout", "finishedAt": datetime.now().isoformat(timespec="seconds")})
    except Exception as exc:
        with RUNS_LOCK:
            RUN_PROCESSES.pop(job_id, None)
            RUNS[job_id].update({"status": "error", "error": str(exc), "finishedAt": datetime.now().isoformat(timespec="seconds")})


def terminate_process_tree(process):
    if not process or process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(process.pid)], capture_output=True, text=True, check=False)
    else:
        process.terminate()


def serial_log_tail(path, max_chars=4000):
    if not path or not Path(path).exists():
        return ""
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    return text[-max_chars:]


def serial_log_worker(log_id, port, baud, output_path, stop_event):
    try:
        try:
            import serial
        except Exception as exc:
            raise RuntimeError(f"缺少 pyserial，无法打开旁路日志串口：{exc}") from exc
        with output_path.open("a", encoding="utf-8", errors="replace") as handle:
            handle.write(f"[{datetime.now().isoformat(timespec='seconds')}] start port={port} baud={baud}\n")
            with serial.Serial(port, baudrate=baud, timeout=1) as serial_port:
                while not stop_event.is_set():
                    data = serial_port.readline()
                    if not data:
                        continue
                    text = data.decode("utf-8", errors="replace").rstrip("\r\n")
                    handle.write(f"[{datetime.now().isoformat(timespec='seconds')}] {text}\n")
                    handle.flush()
            handle.write(f"[{datetime.now().isoformat(timespec='seconds')}] stop\n")
        status = "stopped"
        error = ""
    except Exception as exc:
        status = "error"
        error = str(exc)
    with SERIAL_LOG_LOCK:
        if log_id in SERIAL_LOGS:
            SERIAL_LOGS[log_id].update({"status": status, "error": error, "finishedAt": datetime.now().isoformat(timespec="seconds")})


def start_serial_log(payload):
    port = str(payload.get("port") or "").strip().upper()
    if not re.fullmatch(r"COM\d+", port, flags=re.IGNORECASE):
        raise ValueError("请选择一个有效的旁路日志串口。")
    baud = int(payload.get("baud") or 115200)
    baud = max(1200, min(baud, 2000000))
    log_id = uuid.uuid4().hex
    output_path = LOGS_DIR / f"serial_sidecar_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{port}_{log_id[:8]}.log"
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    stop_event = threading.Event()
    thread = threading.Thread(target=serial_log_worker, args=(log_id, port, baud, output_path, stop_event), daemon=True)
    with SERIAL_LOG_LOCK:
        SERIAL_LOGS[log_id] = {
            "id": log_id,
            "status": "running",
            "port": port,
            "baud": baud,
            "path": str(output_path),
            "createdAt": datetime.now().isoformat(timespec="seconds"),
            "error": "",
            "stopEvent": stop_event,
        }
    thread.start()
    return serial_log_status(log_id)


def serial_log_status(log_id):
    with SERIAL_LOG_LOCK:
        item = dict(SERIAL_LOGS.get(log_id) or {})
    if not item:
        return {}
    item.pop("stopEvent", None)
    item["tail"] = serial_log_tail(item.get("path"))
    return item


def stop_serial_log(log_id):
    with SERIAL_LOG_LOCK:
        item = SERIAL_LOGS.get(log_id)
        if item and item.get("stopEvent"):
            item["stopEvent"].set()
            item["status"] = "stopping"
    return serial_log_status(log_id)


def report_path_from_query(query):
    name = Path((query.get("name") or [""])[0]).name
    if not name:
        return None
    path = (LOGS_DIR / name).resolve()
    logs_root = LOGS_DIR.resolve()
    try:
        path.relative_to(logs_root)
    except ValueError:
        return None
    if not path.exists() or path.suffix.lower() != ".json":
        return None
    return path


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DASHBOARD_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def write_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def write_bytes(self, status, body, content_type, headers=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        if path == "/api/cases":
            self.write_json(200, load_cases())
            return
        if path == "/api/coverage":
            self.write_json(200, load_coverage())
            return
        if path == "/api/reports":
            self.write_json(200, {"reports": list_reports()})
            return
        if path == "/api/report":
            report_path = report_path_from_query(query)
            if not report_path:
                self.write_json(404, {"error": "report_not_found"})
                return
            body = report_path.read_bytes()
            headers = {}
            if (query.get("download") or [""])[0]:
                headers["Content-Disposition"] = f'attachment; filename="{report_path.name}"'
            self.write_bytes(200, body, "application/json; charset=utf-8", headers)
            return
        if path == "/api/run-status":
            job_id = (query.get("id") or [""])[0]
            with RUNS_LOCK:
                job = dict(RUNS.get(job_id) or {})
            if not job:
                self.write_json(404, {"error": "job_not_found"})
                return
            progress = summarize_progress(read_progress(job.get("progress") or ""), job.get("estimatedSteps") or (job.get("normalized") or {}).get("estimatedSteps"))
            job["progressSummary"] = progress
            job["reports"] = list_reports()
            self.write_json(200, job)
            return
        if path == "/api/serial-log-status":
            log_id = (query.get("id") or [""])[0]
            item = serial_log_status(log_id)
            if not item:
                self.write_json(404, {"error": "serial_log_not_found"})
                return
            self.write_json(200, item)
            return
        if path == "/api/ports":
            self.write_json(200, {"ports": detect_serial_ports()})
            return
        if path == "/api/health":
            self.write_json(200, {"ok": True, "projectRoot": str(PROJECT_ROOT), "logsDir": str(LOGS_DIR), "meshtasticCli": str(LOCAL_MESHTASTIC) if LOCAL_MESHTASTIC.exists() else "meshtastic"})
            return
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/serial-log/start":
            length = int(self.headers.get("Content-Length") or "0")
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                self.write_json(202, start_serial_log(payload))
            except Exception as exc:
                self.write_json(500, {"error": str(exc)})
            return
        if path == "/api/serial-log/stop":
            length = int(self.headers.get("Content-Length") or "0")
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            item = stop_serial_log(str(payload.get("id") or ""))
            if not item:
                self.write_json(404, {"error": "serial_log_not_found"})
                return
            self.write_json(200, item)
            return
        if path == "/api/cancel":
            length = int(self.headers.get("Content-Length") or "0")
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            job_id = str(payload.get("id") or "").strip()
            with RUNS_LOCK:
                job = RUNS.get(job_id)
                process = RUN_PROCESSES.get(job_id)
            if not job:
                self.write_json(404, {"error": "job_not_found"})
                return
            if process:
                terminate_process_tree(process)
            with RUNS_LOCK:
                RUN_PROCESSES.pop(job_id, None)
                RUNS[job_id].update({
                    "status": "canceled",
                    "error": "user_canceled",
                    "finishedAt": datetime.now().isoformat(timespec="seconds"),
                    "reports": list_reports(),
                })
                updated = dict(RUNS[job_id])
            self.write_json(200, updated)
            return
        if path != "/api/run":
            self.write_json(404, {"error": "not_found"})
            return
        length = int(self.headers.get("Content-Length") or "0")
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            command, report, progress, selected, timeout, normalized = sanitize_run_request(payload)
            job_id = uuid.uuid4().hex
            with RUNS_LOCK:
                RUNS[job_id] = {
                    "id": job_id,
                    "status": "queued",
                    "command": command,
                    "report": str(report),
                    "reportName": report.name,
                    "progress": str(progress),
                    "normalized": normalized,
                    "estimatedSteps": normalized.get("estimatedSteps", 0),
                    "progressSummary": {
                        "done": 0,
                        "total": normalized.get("estimatedSteps", 0),
                        "percent": 0,
                        "current": {"event": "queued", "step": "任务已提交，等待 runner 启动"},
                        "events": [],
                    },
                    "result": {},
                    "createdAt": datetime.now().isoformat(timespec="seconds"),
                }
            thread = threading.Thread(target=run_job, args=(job_id, command, report, progress, timeout, selected, normalized), daemon=True)
            thread.start()
            self.write_json(202, RUNS[job_id])
        except Exception as exc:
            self.write_json(500, {"error": str(exc)})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = ThreadingHTTPServer(("127.0.0.1", port), DashboardHandler)
    print(f"Meshtastic CLI test console: http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
