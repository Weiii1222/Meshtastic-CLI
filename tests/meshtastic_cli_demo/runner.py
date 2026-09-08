import argparse
import contextlib
import json
import re
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CASES = Path(__file__).with_name("cases_l2_demo.json")
LOCAL_MESHTASTIC = PROJECT_ROOT / ".venv" / "Scripts" / "meshtastic.exe"
SENSITIVE_KEYS = ("private_key", "privateKey", "preshared_key", "psk", "wifi_psk", "password", "admin_key", "secret", "complete_url")

DISPLAY_NAMES = {
    "lora.region": "Region",
    "lora.modem_preset": "Modem Preset",
    "lora.use_preset": "Use Preset",
    "lora.override_frequency": "Frequency Override",
    "lora.channel_num": "Channel Number",
    "device.role": "Device Role",
    "device.serial_enabled": "Serial",
    "device.double_tap_as_button_press": "Double Tap",
    "device.disable_triple_click": "Triple Click",
    "device.led_heartbeat_disabled": "LED Heartbeat",
    "lora.tx_enabled": "TX",
    "position.gps_enabled": "GPS",
    "network.wifi_enabled": "WiFi",
    "network.wifi_ssid": "WiFi SSID",
    "network.wifi_psk": "WiFi Key",
    "mqtt.enabled": "MQTT",
    "bluetooth.enabled": "Bluetooth",
    "display.units": "Units",
    "display.compass_north_top": "Compass North Top",
    "display.wake_on_tap_or_motion": "Screen Wake",
    "display.enable_message_bubbles": "Message Bubbles",
    "display.use_12h_clock": "12H Clock",
    "display.use_long_node_name": "Long Node Name",
    "display.screen_on_secs": "Screen On Seconds",
    "display.auto_screen_carousel_secs": "Screen Carousel Seconds",
    "device_ui.alert_enabled": "Alert",
    "device_ui.banner_enabled": "Banner",
    "canned_message.enabled": "Canned Message",
    "device_ui.language": "Language",
    "position.fixed_position": "Fixed Position",
    "position.position_broadcast_secs": "Position Broadcast Seconds",
    "position.gps_update_interval": "GPS Update Interval",
    "position.gps_attempt_time": "GPS Attempt Time",
    "telemetry.device_update_interval": "Device Telemetry Interval",
    "telemetry.environment_update_interval": "Environment Telemetry Interval",
    "neighbor_info.enabled": "Neighbor Info",
    "range_test.enabled": "Range Test",
    "store_forward.enabled": "Store and Forward",
}

ENUM_VALUES = {
    "lora.region": {
        "0": "UNSET",
        "1": "US",
        "2": "EU_433",
        "3": "EU_868",
        "4": "CN",
        "5": "JP",
        "6": "ANZ",
        "7": "KR",
        "8": "TW",
        "9": "RU",
        "10": "IN",
        "11": "NZ_865",
        "12": "TH",
        "13": "LORA_24",
        "14": "UA_433",
        "15": "UA_868",
    },
    "lora.modem_preset": {
        "0": "LONG_FAST",
        "1": "LONG_SLOW",
        "2": "VERY_LONG_SLOW",
        "3": "MEDIUM_SLOW",
        "4": "MEDIUM_FAST",
        "5": "SHORT_SLOW",
        "6": "SHORT_FAST",
        "7": "LONG_MODERATE",
        "8": "SHORT_TURBO",
    },
    "device.role": {
        "0": "CLIENT",
        "1": "CLIENT_MUTE",
        "2": "ROUTER",
        "3": "ROUTER_CLIENT",
        "4": "REPEATER",
        "5": "TRACKER",
        "6": "SENSOR",
        "7": "TAK",
        "8": "CLIENT_HIDDEN",
        "9": "LOST_AND_FOUND",
    },
    "device_ui.language": {
        "0": "ENGLISH",
        "1": "FRENCH",
        "2": "GERMAN",
        "3": "ITALIAN",
        "4": "PORTUGUESE",
        "5": "SPANISH",
        "6": "SWEDISH",
        "7": "FINNISH",
        "8": "POLISH",
        "9": "TURKISH",
        "10": "SERBIAN",
        "11": "RUSSIAN",
        "12": "DUTCH",
        "13": "GREEK",
        "14": "NORWEGIAN",
        "15": "SLOVENIAN",
        "16": "UKRAINIAN",
        "17": "BULGARIAN",
        "18": "CZECH",
        "19": "DANISH",
        "30": "SIMPLIFIED_CHINESE",
        "31": "TRADITIONAL_CHINESE",
    },
}

INVERSE_BOOL_FIELDS = {"device.disable_triple_click", "device.led_heartbeat_disabled"}


def default_meshtastic_command():
    return str(LOCAL_MESHTASTIC) if LOCAL_MESHTASTIC.exists() else "meshtastic"


def build_connection_args(args):
    selected = [value for value in (args.port, args.host, args.ble) if value]
    if len(selected) > 1:
        raise SystemExit("Only one primary connection mode is allowed: --port, --host, or --ble.")
    if args.port:
        return ["--port", args.port]
    if args.host:
        return ["--host", args.host]
    if args.ble:
        return ["--ble", args.ble]
    return []


def build_peer_connection_args(args):
    selected = [value for value in (args.peer_port, args.peer_host, args.peer_ble) if value]
    if len(selected) > 1:
        raise SystemExit("Only one peer connection mode is allowed: --peer-port, --peer-host, or --peer-ble.")
    if args.peer_port:
        return ["--port", args.peer_port]
    if args.peer_host:
        return ["--host", args.peer_host]
    if args.peer_ble:
        return ["--ble", args.peer_ble]
    return []


def command_text(command):
    return " ".join(command or [])


def write_progress(progress_path, event):
    if not progress_path:
        return
    path = Path(progress_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    event = {"time": datetime.now().isoformat(timespec="seconds"), **event}
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")


def extract_node_id(output):
    output = output or ""
    match = re.search(r'"myNodeNum"\s*:\s*(\d+)', output)
    if match:
        return f"!{int(match.group(1)):08x}"
    match = re.search(r"myNodeNum\s*[:=]\s*(\d+)", output)
    if match:
        return f"!{int(match.group(1)):08x}"
    match = re.search(r"!(?P<node>[0-9a-fA-F]{8})", output)
    if match:
        return "!" + match.group("node").lower()
    return None


def node_id_from_my_info(output):
    output = output or ""
    match = re.search(r'"myNodeNum"\s*:\s*(\d+)', output)
    if match:
        return f"!{int(match.group(1)):08x}"
    match = re.search(r"myNodeNum\s*[:=]\s*(\d+)", output)
    if match:
        return f"!{int(match.group(1)):08x}"
    return None


def normalize_node_id(value):
    clean = str(value or "").strip().lower()
    if not clean:
        return ""
    clean = clean if clean.startswith("!") else f"!{clean}"
    return clean if re.fullmatch(r"![0-9a-f]{8}", clean) else ""


def parse_node_public_keys(output):
    nodes = json_block_after("Nodes in mesh:", output)
    if not isinstance(nodes, dict) or not nodes:
        return []
    entries = []
    for node_id, node in nodes.items():
        if not isinstance(node, dict):
            continue
        user = node.get("user") if isinstance(node.get("user"), dict) else {}
        public_key = user.get("publicKey") or user.get("public_key") or node.get("publicKey") or node.get("public_key")
        normalized_id = normalize_node_id(user.get("id") or node_id)
        if not public_key or not normalized_id:
            continue
        entries.append({
            "node_id": normalized_id,
            "short_name": str(user.get("shortName") or normalized_id.lstrip("!")[-4:]).strip(),
            "long_name": str(user.get("longName") or "").strip(),
            "hardware": str(user.get("hwModel") or "").strip(),
            "public_key": str(public_key).strip(),
        })
    entries.sort(key=lambda item: item.get("short_name", ""))
    return entries


def public_key_for_node(output, node_id):
    normalized = normalize_node_id(node_id)
    if not normalized:
        return ""
    for item in parse_node_public_keys(output):
        if item.get("node_id") == normalized:
            return item.get("public_key") or ""
    return ""


def extract_value(patterns, output):
    for pattern in patterns:
        match = re.search(pattern, output or "", flags=re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(1).strip()
    return ""



def parse_info_summary(output):
    output = output or ""
    summary = {}
    node_id = node_id_from_my_info(output)
    if node_id:
        summary["node_id"] = node_id
        summary["node_label"] = node_id.lstrip("!")[-4:].lower()
    owner_match = re.search(r"^Owner:\s*(?P<long>.*?)\s*\((?P<short>[^)]+)\)", output, flags=re.IGNORECASE | re.MULTILINE)
    if owner_match:
        summary["long_name"] = owner_match.group("long").strip()
        summary["short_name"] = owner_match.group("short").strip()
    if node_id:
        local_public_key = public_key_for_node(output, node_id)
        if local_public_key:
            summary["public_key"] = local_public_key
    if not summary.get("public_key"):
        public_key = extract_value([
            r"Public\s+Key\s*[:=]\s*([^\r\n,]+)",
        ], output)
        if public_key:
            summary["public_key"] = public_key.strip().strip('"')
    field_patterns = {
        "firmware": [r'"firmwareVersion"\s*:\s*"([^"]+)"', r"firmwareVersion\s*[:=]\s*([^\r\n,]+)"],
        "hardware": [r'"hwModel"\s*:\s*"([^"]+)"', r"hwModel\s*[:=]\s*([^\r\n,]+)"],
        "role": [r'"role"\s*:\s*"([^"]+)"', r"role\s*[:=]\s*([^\r\n,]+)"],
        "pio_env": [r'"pioEnv"\s*:\s*"([^"]+)"', r"pioEnv\s*[:=]\s*([^\r\n,]+)"],
        "reboot_count": [r'"rebootCount"\s*:\s*(\d+)', r"rebootCount\s*[:=]\s*(\d+)"],
        "nodedb_count": [r'"nodedbCount"\s*:\s*(\d+)', r"nodedbCount\s*[:=]\s*(\d+)"],
    }
    for key, patterns in field_patterns.items():
        value = extract_value(patterns, output)
        if value:
            summary[key] = display_value("device.role", value) if key == "role" else value
    return summary

def parse_get_value(field, output):
    output = output or ""
    escaped = re.escape(field or "")
    if field:
        patterns = [
            rf"{escaped}\s*[:=]\s*([^\r\n]+)",
            rf"{escaped}\s+([^\r\n]+)",
            rf"{re.escape(meshtastic_leaf_alias(field))}\s*[:=]\s*([^\r\n]+)",
            rf"{re.escape(field.split('.')[-1])}\s*[:=]\s*([^\r\n]+)",
        ]
        value = extract_value(patterns, output)
        if value:
            return value.strip().strip('"')
    ignored = ("connected to radio", "writing", "setting", "preferences", "channel")
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    for line in reversed(lines):
        if not any(marker in line.lower() for marker in ignored):
            return line[:200]
    return ""


def meshtastic_leaf_alias(field):
    leaf = str(field or "").split(".")[-1]
    parts = leaf.split("_")
    if not parts:
        return leaf
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:])


def json_block_after(label, output):
    start = (output or "").find(label)
    if start < 0:
        return {}
    brace_start = output.find("{", start)
    if brace_start < 0:
        return {}
    depth = 0
    in_string = False
    escape = False
    for index in range(brace_start, len(output)):
        char = output[index]
        if escape:
            escape = False
            continue
        if char == "\\" and in_string:
            escape = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(output[brace_start:index + 1])
                except json.JSONDecodeError:
                    return {}
    return {}


def redacted_object(value):
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            normalized_key = re.sub(r"[^a-z0-9]", "", str(key).lower())
            if any(re.sub(r"[^a-z0-9]", "", sensitive.lower()) in normalized_key for sensitive in SENSITIVE_KEYS):
                result[key] = "<redacted>"
            else:
                result[key] = redacted_object(item)
        return result
    if isinstance(value, list):
        return [redacted_object(item) for item in value]
    return value


def preset_channel_name(value):
    text = str(value or "").strip()
    if not text:
        return ""
    return "".join(part.capitalize() for part in text.split("_"))


def parse_channel_summaries(output, preferences=None):
    channels = []
    for line in (output or "").splitlines():
        match = re.search(r"Index\s+(\d+):\s+([A-Z]+).*?(\{.*\})", line)
        if not match:
            continue
        index = int(match.group(1))
        role = match.group(2)
        raw = match.group(3)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {}
        name = str(data.get("name") or "").strip()
        channels.append({
            "index": index,
            "role": role,
            "name": name,
            "psk": "secret" if "psk=secret" in line else "default" if "psk=default" in line else "unknown",
        })
    return channels


def parse_device_snapshot(output):
    preferences = json_block_after("Preferences:", output)
    module_preferences = json_block_after("Module preferences:", output)
    return {
        "summary": parse_info_summary(output),
        "preferences": redacted_object(preferences),
        "module_preferences": redacted_object(module_preferences),
        "channels": parse_channel_summaries(output, preferences),
        "node_public_keys": parse_node_public_keys(output),
    }


def display_field(field):
    return DISPLAY_NAMES.get(field or "", field or "")


def display_value(field, value):
    raw = str(value or "").strip()
    mapped = ENUM_VALUES.get(field or "", {}).get(raw, raw)
    if (field or "") in INVERSE_BOOL_FIELDS:
        if mapped.lower() == "true":
            return "OFF"
        if mapped.lower() == "false":
            return "ON"
    if mapped.lower() == "true":
        return "ON"
    if mapped.lower() == "false":
        return "OFF"
    return mapped


def compare_config_values(field, left, right):
    if field == "lora.override_frequency":
        try:
            return float(left or 0) == float(right or 0)
        except (TypeError, ValueError):
            pass
    return normalize_compare_value(field, left) == normalize_compare_value(field, right)


def enum_number_for_value(field, value):
    target = str(value or "").strip().upper()
    for number, label in ENUM_VALUES.get(field or "", {}).items():
        if str(label).upper() == target:
            return number
    return ""


def expected_read_patterns(field, value):
    patterns = [re.escape(value or ""), re.escape(field or "")]
    enum_number = enum_number_for_value(field, value)
    if enum_number:
        patterns.append(rf"\b{re.escape(enum_number)}\b")
    return [pattern for pattern in patterns if pattern]


def context_value_key(target, field):
    return f"current:{target}:{field}"


def normalize_compare_value(field, value):
    display = display_value(field, value)
    return str(display if display != "" else value).strip().upper()


def values_equivalent(field, current, desired):
    if current in (None, ""):
        return False
    desired_text = str(desired or "").strip()
    options = {
        normalize_compare_value(field, current),
        str(current or "").strip().upper(),
    }
    enum_number = enum_number_for_value(field, desired_text)
    if enum_number:
        options.add(enum_number.upper())
    return normalize_compare_value(field, desired_text) in options or desired_text.upper() in options


def parse_channel_name(output, index=0):
    preferences = json_block_after("Preferences:", output)
    for channel in parse_channel_summaries(output, preferences):
        if channel.get("index") == int(index):
            return channel.get("name") or ("Primary Channel" if int(index) == 0 else f"Channel {index}")
    return ""


def parse_channel_summary(output, index=0):
    preferences = json_block_after("Preferences:", output)
    for channel in parse_channel_summaries(output, preferences):
        if channel.get("index") == int(index):
            return channel
    if int(index) == 0:
        return {"index": 0, "role": "PRIMARY", "name": "Primary Channel", "psk": "unknown"}
    return {}



def redact_sensitive(text):
    redacted = text or ""
    for key in SENSITIVE_KEYS:
        redacted = re.sub(rf"({re.escape(key)}\s*[:=]\s*)(['\"]?)[^\s,'\"\r\n]+(\2)", rf"\1\2<redacted>\3", redacted, flags=re.IGNORECASE)
        redacted = re.sub(rf"({re.escape(key)}['\"]?\s*:\s*['\"])[^'\"]+(['\"])", rf"\1<redacted>\2", redacted, flags=re.IGNORECASE)
    return redacted

def short_node_label(node_id):
    compact = (node_id or "").lstrip("!")
    return compact[-4:].lower() if len(compact) >= 4 else ""


def change_group_key(target, subject):
    return f"change:{target}:{subject}"



def replace_device_names(value, primary_label, peer_label):
    primary = primary_label or "\u6d4b\u8bd5\u8bbe\u59071"
    peer = peer_label or "\u6d4b\u8bd5\u8bbe\u59072"
    bad_primary = "\u5a34\u5b2d\u762f\u7481\u60e7\ue62c1"
    bad_peer = "\u5a34\u5b2d\u762f\u7481\u60e7\ue62c2"
    if isinstance(value, str):
        return (
            value
            .replace("\u6d4b\u8bd5\u8bbe\u59071", primary)
            .replace("\u6d4b\u8bd5\u8bbe\u59072", peer)
            .replace(bad_primary, primary)
            .replace(bad_peer, peer)
        )
    if isinstance(value, list):
        return [replace_device_names(item, primary, peer) for item in value]
    if isinstance(value, dict):
        return {key: replace_device_names(item, primary, peer) for key, item in value.items()}
    return value

def run_command(command, timeout):
    started = time.monotonic()
    completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, check=False)
    return {
        "exit_code": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "duration_sec": round(time.monotonic() - started, 2),
    }


def is_transient_port_error(raw):
    combined = f"{raw.get('stdout') or ''}\n{raw.get('stderr') or ''}".lower()
    markers = (
        "connection timed out",
        "could not open port",
        "serial device couldn't be opened",
        "access is denied",
        "permissionerror",
        "filenotfounderror",
        "cannot configure port",
        "\u7cfb\u7edf\u627e\u4e0d\u5230\u6307\u5b9a\u7684\u6587\u4ef6",
        "\u62d2\u7edd\u8bbf\u95ee",
    )
    return raw.get("exit_code") != 0 and any(marker in combined for marker in markers)


def is_connection_unavailable(raw):
    combined = f"{raw.get('stdout') or ''}\n{raw.get('stderr') or ''}".lower()
    markers = (
        "connection timed out",
        "could not open port",
        "serial device couldn't be opened",
        "access is denied",
        "permissionerror",
        "filenotfounderror",
        "cannot configure port",
    )
    return raw.get("exit_code") != 0 and any(marker in combined for marker in markers)


def mark_target_unavailable(step_result, context):
    target = step_result.get("target")
    if target in ("primary", "peer") and is_connection_unavailable(step_result):
        context[f"{target}:unavailable"] = True
        step_result["reason"] = "connection_unavailable"


def run_command_with_retries(command, timeout, attempts=3, delay_sec=5):
    last = None
    for attempt in range(1, max(1, attempts) + 1):
        last = run_command(command, timeout)
        last["attempt"] = attempt
        if not is_transient_port_error(last) or attempt >= attempts:
            return last
        time.sleep(max(0, delay_sec))
    return last or {}


def terminate_process_tree(process):
    if not process or process.poll() is not None:
        return
    if sys.platform.startswith("win"):
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(process.pid)], capture_output=True, text=True, check=False)
    else:
        process.terminate()


def run_listen_send_step(args, sender_connection_args, receiver_connection_args, send_command, message, channel, timeout, receive_wait, send_wait_to_disconnect=0):
    listen_command = build_command(args.meshtastic, receiver_connection_args, ["--ch-index", str(channel), "--listen"], None, 0)
    send_full_command = build_command(args.meshtastic, sender_connection_args, send_command, None, send_wait_to_disconnect)
    started = time.monotonic()
    listener = None
    send_result = {"exit_code": 1, "stdout": "", "stderr": "listener did not start"}
    listener_stdout = ""
    listener_stderr = ""
    try:
        listener = subprocess.Popen(
            listen_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        time.sleep(1)
        send_result = run_command(send_full_command, timeout)
        time.sleep(max(0, receive_wait))
    finally:
        if listener:
            terminate_process_tree(listener)
            try:
                listener_stdout, listener_stderr = listener.communicate(timeout=3)
            except subprocess.TimeoutExpired:
                terminate_process_tree(listener)
                listener_stdout, listener_stderr = listener.communicate()
    combined = "\n".join([
        send_result.get("stdout") or "",
        send_result.get("stderr") or "",
        listener_stdout or "",
        listener_stderr or "",
    ])
    received = bool(message and message in combined)
    forbidden = bool(re.search(r"NAK|MAX_RETRANSMIT|error reason|No route|timeout", combined, flags=re.IGNORECASE))
    return {
        "exit_code": 0 if send_result.get("exit_code") == 0 and received and not forbidden else 1,
        "stdout": send_result.get("stdout") or "",
        "stderr": send_result.get("stderr") or "",
        "duration_sec": round(time.monotonic() - started, 2),
        "listen_command": listen_command,
        "listen_stdout": listener_stdout,
        "listen_stderr": listener_stderr,
        "receive_wait": receive_wait,
        "channel_index": channel,
        "received_message": received,
    }


def serial_port_from_connection_args(connection_args):
    if not connection_args or "--port" not in connection_args:
        return ""
    try:
        value = connection_args[connection_args.index("--port") + 1]
    except (ValueError, IndexError):
        return ""
    return str(value or "").strip()


def wait_for_received_text(records, lock, target, message, channel, timeout):
    deadline = time.monotonic() + max(0, float(timeout or 0))
    while time.monotonic() < deadline:
        with lock:
            if any(
                item.get("target") == target
                and item.get("text") == message
                and int(item.get("channel") or 0) == int(channel or 0)
                for item in records
            ):
                return True
        time.sleep(0.2)
    with lock:
        return any(
            item.get("target") == target
            and item.get("text") == message
            and int(item.get("channel") or 0) == int(channel or 0)
            for item in records
        )


def run_api_dual_send_step(args, primary_connection_args, peer_connection_args, primary_message, peer_message, message_mode, channel, primary_node_id="", peer_node_id=""):
    primary_port = serial_port_from_connection_args(primary_connection_args)
    peer_port = serial_port_from_connection_args(peer_connection_args)
    started = time.monotonic()
    if not primary_port or not peer_port:
        return {
            "exit_code": 2,
            "stdout": "",
            "stderr": "persistent_api_serial_only",
            "duration_sec": round(time.monotonic() - started, 2),
            "api_transport": "unsupported",
            "reason": "persistent_api_serial_only",
        }

    records = []
    lock = threading.Lock()
    primary_iface = None
    peer_iface = None
    handler = None
    try:
        from pubsub import pub  # type: ignore[import-untyped]
        from meshtastic.serial_interface import SerialInterface  # type: ignore[import-untyped]

        primary_iface = SerialInterface(primary_port, noNodes=True, timeout=max(3, int(args.timeout or 60)))
        peer_iface = SerialInterface(peer_port, noNodes=True, timeout=max(3, int(args.timeout or 60)))

        def handler(packet, interface):
            decoded = packet.get("decoded") or {}
            text = decoded.get("text") or ""
            if not text:
                return
            target = "primary" if interface is primary_iface else "peer" if interface is peer_iface else "unknown"
            with lock:
                records.append({
                    "target": target,
                    "text": text,
                    "channel": packet.get("channel", 0),
                    "from": packet.get("fromId") or packet.get("from"),
                    "to": packet.get("toId") or packet.get("to"),
                })

        pub.subscribe(handler, "meshtastic.receive.text")
        time.sleep(0.8)

        channel_index = int(channel or 0)
        if message_mode == "device":
            if not normalize_node_id(peer_node_id) or not normalize_node_id(primary_node_id):
                return {
                    "exit_code": 1,
                    "stdout": "",
                    "stderr": "missing_node_id_for_device_message",
                    "duration_sec": round(time.monotonic() - started, 2),
                    "api_transport": "serial_persistent",
                    "reason": "missing_dest",
                }
            primary_iface.sendText(primary_message, destinationId=normalize_node_id(peer_node_id), wantAck=False, channelIndex=channel_index)
        else:
            primary_iface.sendText(primary_message, wantAck=False, channelIndex=channel_index)
        peer_received = wait_for_received_text(records, lock, "peer", primary_message, channel_index, args.receive_wait)

        time.sleep(0.5)
        if message_mode == "device":
            peer_iface.sendText(peer_message, destinationId=normalize_node_id(primary_node_id), wantAck=False, channelIndex=channel_index)
        else:
            peer_iface.sendText(peer_message, wantAck=False, channelIndex=channel_index)
        primary_received = wait_for_received_text(records, lock, "primary", peer_message, channel_index, args.receive_wait)

        with lock:
            received_messages = list(records)
        stdout = "\n".join([
            "Persistent Python API serial send",
            f"{primary_port} -> {peer_port}: {primary_message} received={peer_received}",
            f"{peer_port} -> {primary_port}: {peer_message} received={primary_received}",
        ])
        return {
            "exit_code": 0 if peer_received and primary_received else 1,
            "stdout": stdout + "\n",
            "stderr": "",
            "duration_sec": round(time.monotonic() - started, 2),
            "api_transport": "serial_persistent",
            "received_message": peer_received and primary_received,
            "received_messages": received_messages,
            "sent_messages": [
                {"from": "primary", "to": "peer" if message_mode == "device" else f"channel:{channel_index}", "message": primary_message, "received": peer_received},
                {"from": "peer", "to": "primary" if message_mode == "device" else f"channel:{channel_index}", "message": peer_message, "received": primary_received},
            ],
            "channel_index": channel_index,
            "reason": "api_dual_received" if peer_received and primary_received else "api_dual_missing_receive",
        }
    except Exception as exc:  # pylint: disable=broad-except
        return {
            "exit_code": 2,
            "stdout": "",
            "stderr": f"persistent_api_error: {type(exc).__name__}: {exc}",
            "duration_sec": round(time.monotonic() - started, 2),
            "api_transport": "serial_persistent",
            "reason": "persistent_api_error",
        }
    finally:
        if handler:
            with contextlib.suppress(Exception):
                pub.unsubscribe(handler, "meshtastic.receive.text")  # type: ignore[name-defined]
        for interface in (peer_iface, primary_iface):
            if interface:
                with contextlib.suppress(Exception):
                    interface.close()


def step_sleep_seconds(step, args):
    value = step.get("sleep_sec")
    if value == "reboot_wait":
        return max(0, int(args.reboot_wait or 0))
    return max(0, int(value or 0))


def wait_before_device_command(command, args):
    if not command or not getattr(args, "step_gap", 0):
        return
    if any(flag in command for flag in ("--port", "--host", "--ble")):
        time.sleep(max(0, float(args.step_gap)))


def evaluate_expectations(result, required_patterns, optional_any_patterns=None, fail_patterns=None):
    output = (result.get("stdout") or "") + "\n" + (result.get("stderr") or "")
    if re.search(r"do not have attribute|no such field|unknown field|invalid value", output, flags=re.IGNORECASE):
        return False, "unsupported_config_field"
    for pattern in fail_patterns or []:
        if re.search(pattern, output, flags=re.IGNORECASE | re.MULTILINE):
            return False, "forbidden_output:" + pattern
    if result.get("exit_code") != 0:
        return False, "exit_code_nonzero"
    missing = [pattern for pattern in required_patterns if not re.search(pattern, output, flags=re.IGNORECASE | re.MULTILINE)]
    if missing:
        return False, "regex_not_matched:" + ",".join(missing)
    if optional_any_patterns:
        for pattern in optional_any_patterns:
            if re.search(pattern, output, flags=re.IGNORECASE | re.MULTILINE):
                return True, "matched_any"
        return False, "regex_not_matched:any"
    return True, "criteria_met"


def node_seen_in_output(node_id, output):
    if not node_id:
        return True
    lowered = (output or "").lower()
    compact = node_id.lower().lstrip("!")
    return node_id.lower() in lowered or compact in lowered


def parse_contact_url(output):
    match = re.search(r"(https://meshtastic\.org/(?:v|e)/#\S+)", output or "", flags=re.IGNORECASE)
    return match.group(1).strip() if match else ""


def resolve_context_tokens(tokens, context):
    mapping = {
        "$primary_node_id": context.get("primary_node_id") or "$primary_node_id",
        "$peer_node_id": context.get("peer_node_id") or "$peer_node_id",
        "$primary_contact_url": context.get("primary_contact_url") or "$primary_contact_url",
        "$peer_contact_url": context.get("peer_contact_url") or "$peer_contact_url",
    }
    return [mapping.get(token, token) for token in tokens]


def should_skip(case, step, args, primary_connection_args, peer_connection_args, context):
    target = step.get("target", "primary")
    active_connection = peer_connection_args if target == "peer" else primary_connection_args
    if step.get("requires_connection") and not active_connection:
        return "missing_connection"
    if step.get("requires_peer") and not peer_connection_args:
        return "missing_peer"
    if step.get("dest_from") and not (args.dest or context.get(step.get("dest_from"))) and args.execute:
        return "missing_dest"
    if args.execute:
        for key in step.get("requires_context") or []:
            if not context.get(key):
                return "missing_context:" + key
    if case.get("requires_dest") and not args.dest and not step.get("dest_from"):
        return "missing_dest"
    if step.get("mutating") and not args.allow_mutating:
        return "mutating_guard"
    if step.get("requires_config") and (not args.config_field or args.config_value == ""):
        return "missing_config"
    if step.get("requires_message") == "primary" and not args.message_primary:
        return "missing_message"
    if step.get("requires_message") == "peer" and not args.message_peer:
        return "missing_message"
    return None


def build_command(base_cmd, connection_args, step_command, dest, wait_to_disconnect=0):
    command = [base_cmd]
    if any(token in step_command for token in ("--version", "-h", "--help")):
        command.extend(step_command)
        return command
    command.extend(connection_args)
    if dest:
        command.extend(["--dest", dest])
    command.extend(step_command)
    if wait_to_disconnect and step_command and "--wait-to-disconnect" not in step_command:
        command.extend(["--wait-to-disconnect", str(wait_to_disconnect)])
    return command


def selected_cases(data, case_filter):
    selected = set(case_filter or [])
    for case in data.get("cases", []):
        if selected and case.get("id") not in selected:
            continue
        yield case



def target_names(config_target):
    mapping = {
        "primary": [("primary", "\u6d4b\u8bd5\u8bbe\u59071")],
        "peer": [("peer", "\u6d4b\u8bd5\u8bbe\u59072")],
        "both": [("primary", "\u6d4b\u8bd5\u8bbe\u59071"), ("peer", "\u6d4b\u8bd5\u8bbe\u59072")],
    }
    return mapping.get(config_target, mapping["primary"])

def load_config_payload(args):
    if not args.config_json:
        return {}
    try:
        value = json.loads(args.config_json)
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError:
        payload = {}
        raw = args.config_json.strip().strip("{}")
        for part in raw.split(","):
            if ":" not in part:
                continue
            key, value = part.split(":", 1)
            payload[key.strip().strip("\"'")] = value.strip().strip("\"'")
        return payload



def custom_config_case(args):
    steps = []
    payload = load_config_payload(args)
    for target, label in target_names(args.config_target):
        if args.config_kind == "user_name":
            steps.extend(owner_steps(target, label, payload.get("longName", ""), payload.get("shortName", "")))
        elif args.config_kind == "channel":
            if not valid_channel_psk(payload.get("psk", "")):
                raise SystemExit("Channel PSK only supports default, none, 0x..., or base64:...")
            steps.extend(channel_set_steps(target, label, payload.get("index", 0), payload.get("name", ""), payload.get("psk", "")))
        elif args.config_kind == "wifi":
            pairs = []
            if "enabled" in payload and payload.get("enabled") != "":
                pairs.append(("network.wifi_enabled", payload.get("enabled")))
            if payload.get("ssid"):
                pairs.append(("network.wifi_ssid", payload.get("ssid")))
            if payload.get("key"):
                pairs.append(("network.wifi_psk", payload.get("key")))
            if pairs:
                steps.extend(config_set_many_steps(target, label, pairs))
        elif args.config_kind == "region":
            region = str(payload.get("region") or args.config_value or "").strip()
            override_frequency = str(payload.get("overrideFrequency", "0")).strip() or "0"
            steps.extend(config_set_many_steps(target, label, [("lora.region", region), ("lora.override_frequency", override_frequency)]))
        elif args.config_kind == "modem_preset" and args.config_field == "lora.modem_preset":
            steps.extend(config_set_many_steps(target, label, [(args.config_field, args.config_value), ("lora.use_preset", "true")]))
        else:
            steps.extend(config_set_get_steps(target, label, args.config_field, args.config_value))
    return {
        "id": "L2-CUSTOM-CONFIG",
        "module": "\u914d\u7f6e\u5199\u5165",
        "source_l2_case": "\u7528\u6237\u914d\u7f6e\u5199\u5165\u4e0e\u8bfb\u56de",
        "objective": "\u6309\u7528\u6237\u9009\u62e9\u7684\u914d\u7f6e\u9879\u4e0b\u53d1\u5230\u6307\u5b9a\u8bbe\u5907\uff0c\u5e76\u8bfb\u56de\u786e\u8ba4\u662f\u5426\u751f\u6548\u3002",
        "test_data": f"config={args.config_kind or args.config_field or '-'}, target={args.config_target}",
        "pass_meaning": "PASS \u8868\u793a\u914d\u7f6e\u5df2\u5199\u5165\u5e76\u8bfb\u56de\u4e00\u81f4\uff1b\u5982\u679c\u5f53\u524d\u503c\u5df2\u4e00\u81f4\uff0c\u4f1a\u8df3\u8fc7\u91cd\u590d\u5199\u5165\u3002",
        "failure_help": "\u5931\u8d25\u65f6\u5148\u770b\u5b57\u6bb5\u662f\u5426\u88ab\u5f53\u524d CLI/\u56fa\u4ef6\u652f\u6301\uff0c\u7136\u540e\u68c0\u67e5\u8bbe\u5907\u662f\u5426\u8fd8\u5728\u91cd\u542f\u6216\u4e32\u53e3\u88ab\u5360\u7528\u3002",
        "risk": "mutating",
        "steps": steps,
    }


def owner_steps(target, label, long_name, short_name):
    steps = []
    if long_name:
        steps.append({
            "name": f"\u5199\u5165{label} Long Name",
            "target": target,
            "command": ["--set-owner", long_name],
            "requires_connection": True,
            "requires_peer": target == "peer",
            "mutating": True,
            "pass_criteria": f"{label} Long Name \u5df2\u5199\u5165: {long_name}",
            "expect_stdout_regex_any": ["Connected|Owner|Writing|Set|Saved|Reboot", re.escape(long_name)],
            "action_summary": f"\u5199\u5165{label} Long Name={long_name}",
        })
    if short_name:
        steps.append({
            "name": f"\u5199\u5165{label} Short Name",
            "target": target,
            "command": ["--set-owner-short", short_name],
            "requires_connection": True,
            "requires_peer": target == "peer",
            "mutating": True,
            "pass_criteria": f"{label} Short Name \u5df2\u5199\u5165: {short_name}",
            "expect_stdout_regex_any": ["Connected|Owner|Writing|Set|Saved|Reboot", re.escape(short_name)],
            "action_summary": f"\u5199\u5165{label} Short Name={short_name}",
        })
    steps.append({
        "name": f"\u8bfb\u56de{label} User name",
        "target": target,
        "command": ["--no-nodes", "--info"],
        "requires_connection": True,
        "requires_peer": target == "peer",
        "requires_previous_pass": bool(long_name or short_name),
        "mutating": False,
        "pass_criteria": f"{label} \u53ef\u8bfb\u56de Long Name / Short Name",
        "expect_stdout_regex_any": [re.escape(long_name) if long_name else "longName|Owner", re.escape(short_name) if short_name else "shortName|Owner"],
        "action_summary": f"\u8bfb\u56de{label} User name",
    })
    return steps


def communication_config_case(args):
    pairs = []
    if args.experiment_region:
        pairs.append(("lora.region", args.experiment_region))
    if args.experiment_modem:
        pairs.append(("lora.modem_preset", args.experiment_modem))
        pairs.append(("lora.use_preset", "true"))
    if args.override_frequency:
        pairs.append(("lora.override_frequency", args.override_frequency))
    steps = []
    if pairs:
        steps.extend(config_set_many_steps("primary", "\u6d4b\u8bd5\u8bbe\u59071", pairs))
        steps.extend(config_set_many_steps("peer", "\u6d4b\u8bd5\u8bbe\u59072", pairs))
    return {
        "id": "L2-COMM-CONFIG",
        "module": "\u901a\u4fe1\u914d\u7f6e\u4e0b\u53d1",
        "source_l2_case": "Modem Preset / Region / Frequency Override",
        "objective": "\u5c06\u4e24\u53f0\u8bbe\u5907\u7684\u901a\u4fe1\u5173\u952e\u914d\u7f6e\u8bbe\u4e3a\u4e00\u81f4\uff0c\u4e3a\u901a\u4fe1\u9a8c\u8bc1\u505a\u51c6\u5907\u3002",
        "test_data": f"lora.region={args.experiment_region or '-'}, lora.modem_preset={args.experiment_modem or '-'}, lora.override_frequency={args.override_frequency or '-'}",
        "pass_meaning": "PASS \u8868\u793a\u9700\u8981\u4fee\u6539\u7684\u914d\u7f6e\u5df2\u5199\u5165\u5e76\u8bfb\u56de\u4e00\u81f4\u3002",
        "failure_help": "\u5931\u8d25\u65f6\u5148\u770b\u4e32\u53e3\u662f\u5426\u88ab\u5360\u7528\u6216\u8bbe\u5907\u662f\u5426\u4ecd\u5728\u91cd\u542f\uff0c\u518d\u68c0\u67e5\u5b57\u6bb5\u662f\u5426\u88ab\u5f53\u524d CLI/\u56fa\u4ef6\u652f\u6301\u3002",
        "risk": "mutating",
        "steps": steps,
    }


def communication_check_case(args):
    fields = ["lora.region", "lora.modem_preset", "lora.use_preset", "lora.override_frequency"]
    steps = []
    for target, label in (("primary", "\u6d4b\u8bd5\u8bbe\u59071"), ("peer", "\u6d4b\u8bd5\u8bbe\u59072")):
        command = []
        for field in fields:
            command.extend(["--get", field])
        steps.append({
            "name": f"\u8bfb\u53d6{label}\u901a\u4fe1\u914d\u7f6e",
            "target": target,
            "command": command,
            "requires_connection": True,
            "requires_peer": target == "peer",
            "mutating": False,
            "readback_fields": fields,
            "pass_criteria": f"{label} \u53ef\u8bfb\u53d6 Region / Modem Preset / Use Preset / Frequency Override",
            "expect_stdout_regex_any": [re.escape(field) for field in fields],
            "action_summary": f"\u8bfb\u53d6{label}\u5f53\u524d\u901a\u4fe1\u914d\u7f6e",
        })
    steps.append({
        "name": "\u786e\u8ba4\u4e24\u53f0\u8bbe\u5907\u901a\u4fe1\u914d\u7f6e\u4e00\u81f4",
        "target": "both",
        "compare_config_fields": fields,
        "requires_previous_pass": True,
        "pass_criteria": "\u4e24\u53f0\u8bbe\u5907 Region / Modem Preset / Frequency Override \u4e00\u81f4\uff1bUse Preset \u4f5c\u4e3a\u8f85\u52a9\u5224\u65ad\u3002",
        "action_summary": "\u5bf9\u6bd4\u4e24\u53f0\u8bbe\u5907\u901a\u4fe1\u914d\u7f6e\u662f\u5426\u4e00\u81f4",
    })
    return {
        "id": "L2-COMM-CHECK",
        "module": "\u901a\u4fe1\u914d\u7f6e\u68c0\u67e5",
        "source_l2_case": "\u901a\u4fe1\u524d\u7f6e\u914d\u7f6e\u68c0\u67e5",
        "objective": "\u5728\u4e0d\u4e0b\u53d1\u914d\u7f6e\u65f6\uff0c\u5148\u68c0\u67e5\u4e24\u53f0\u8bbe\u5907\u7684\u901a\u4fe1\u5173\u952e\u914d\u7f6e\u662f\u5426\u4e00\u81f4\u3002",
        "test_data": "Region / Modem Preset / Frequency Override",
        "pass_meaning": "PASS \u8868\u793a\u4e24\u53f0\u8bbe\u5907\u7684\u901a\u4fe1\u5173\u952e\u914d\u7f6e\u4e00\u81f4\u3002",
        "failure_help": "\u5931\u8d25\u8868\u793a\u8bbe\u5907\u914d\u7f6e\u4e0d\u4e00\u81f4\u6216\u4e32\u53e3\u8bfb\u53d6\u5931\u8d25\uff1b\u8bf7\u5148\u786e\u8ba4 Region\u3001Frequency Override\u3001Modem Preset\u3001Channel/PSK\u3002",
        "risk": "read",
        "steps": steps,
    }


def contact_exchange_case(args):
    steps = [
        {
            "name": "\u8bfb\u53d6\u6d4b\u8bd5\u8bbe\u59071\u8eab\u4efd\u548c\u516c\u94a5",
            "target": "primary",
            "command": ["--no-nodes", "--info"],
            "requires_connection": True,
            "capture_node_id_as": "primary_node_id",
            "pass_criteria": "\u6d4b\u8bd5\u8bbe\u59071\u53ef\u8bfb\u53d6\u8282\u70b9 ID \u548c\u516c\u94a5\uff0c\u4e0d\u8bfb\u53d6\u79c1\u94a5\u3002",
            "expect_stdout_regex": ["Connected to radio"],
            "expect_stdout_regex_any": ["myNodeNum|NodeInfo|Owner"],
            "action_summary": "\u8bfb\u53d6\u6d4b\u8bd5\u8bbe\u59071\u8eab\u4efd\u548c\u516c\u94a5",
        },
        {
            "name": "\u8bfb\u53d6\u6d4b\u8bd5\u8bbe\u59072\u8eab\u4efd\u548c\u516c\u94a5",
            "target": "peer",
            "command": ["--no-nodes", "--info"],
            "requires_connection": True,
            "requires_peer": True,
            "requires_previous_pass": True,
            "capture_node_id_as": "peer_node_id",
            "pass_criteria": "\u6d4b\u8bd5\u8bbe\u59072\u53ef\u8bfb\u53d6\u8282\u70b9 ID \u548c\u516c\u94a5\uff0c\u4e0d\u8bfb\u53d6\u79c1\u94a5\u3002",
            "expect_stdout_regex": ["Connected to radio"],
            "expect_stdout_regex_any": ["myNodeNum|NodeInfo|Owner"],
            "action_summary": "\u8bfb\u53d6\u6d4b\u8bd5\u8bbe\u59072\u8eab\u4efd\u548c\u516c\u94a5",
        },
        {
            "name": "\u751f\u6210\u6d4b\u8bd5\u8bbe\u59071\u8054\u7cfb\u4eba URL",
            "target": "primary",
            "command": ["--contact-qr", "$primary_node_id", "--contact-verified"],
            "requires_connection": True,
            "requires_context": ["primary_node_id"],
            "requires_previous_pass": True,
            "capture_contact_url_as": "primary_contact_url",
            "pass_criteria": "CLI \u53ef\u751f\u6210\u6d4b\u8bd5\u8bbe\u59071\u7684\u8054\u7cfb\u4eba URL\u3002",
            "expect_stdout_regex_any": ["https://meshtastic.org/(v|e)/#"],
            "action_summary": "\u751f\u6210\u6d4b\u8bd5\u8bbe\u59071\u8054\u7cfb\u4eba URL",
        },
        {
            "name": "\u751f\u6210\u6d4b\u8bd5\u8bbe\u59072\u8054\u7cfb\u4eba URL",
            "target": "peer",
            "command": ["--contact-qr", "$peer_node_id", "--contact-verified"],
            "requires_connection": True,
            "requires_peer": True,
            "requires_context": ["peer_node_id"],
            "requires_previous_pass": True,
            "capture_contact_url_as": "peer_contact_url",
            "pass_criteria": "CLI \u53ef\u751f\u6210\u6d4b\u8bd5\u8bbe\u59072\u7684\u8054\u7cfb\u4eba URL\u3002",
            "expect_stdout_regex_any": ["https://meshtastic.org/(v|e)/#"],
            "action_summary": "\u751f\u6210\u6d4b\u8bd5\u8bbe\u59072\u8054\u7cfb\u4eba URL",
        },
        {
            "name": "\u6d4b\u8bd5\u8bbe\u59071\u5bfc\u5165\u6d4b\u8bd5\u8bbe\u59072\u8054\u7cfb\u4eba",
            "target": "primary",
            "command": ["--add-contact", "$peer_contact_url"],
            "requires_connection": True,
            "requires_peer": True,
            "requires_context": ["primary_node_id", "peer_contact_url"],
            "requires_previous_pass": True,
            "mutating": True,
            "pass_criteria": "\u6d4b\u8bd5\u8bbe\u59071\u5df2\u5bfc\u5165\u6d4b\u8bd5\u8bbe\u59072\u8054\u7cfb\u4eba URL\u3002",
            "expect_stdout_regex_any": ["Connected|Added|contact|NodeDB|Saved|Writing|Set"],
            "action_summary": "\u5c06\u6d4b\u8bd5\u8bbe\u59072\u8054\u7cfb\u4eba URL \u5bfc\u5165\u6d4b\u8bd5\u8bbe\u59071",
        },
        {
            "name": "\u6d4b\u8bd5\u8bbe\u59072\u5bfc\u5165\u6d4b\u8bd5\u8bbe\u59071\u8054\u7cfb\u4eba",
            "target": "peer",
            "command": ["--add-contact", "$primary_contact_url"],
            "requires_connection": True,
            "requires_peer": True,
            "requires_context": ["peer_node_id", "primary_contact_url"],
            "requires_previous_pass": True,
            "mutating": True,
            "pass_criteria": "\u6d4b\u8bd5\u8bbe\u59072\u5df2\u5bfc\u5165\u6d4b\u8bd5\u8bbe\u59071\u8054\u7cfb\u4eba URL\u3002",
            "expect_stdout_regex_any": ["Connected|Added|contact|NodeDB|Saved|Writing|Set"],
            "action_summary": "\u5c06\u6d4b\u8bd5\u8bbe\u59071\u8054\u7cfb\u4eba URL \u5bfc\u5165\u6d4b\u8bd5\u8bbe\u59072",
        },
        {
            "name": "\u786e\u8ba4\u6d4b\u8bd5\u8bbe\u59071 NodeDB \u5305\u542b\u6d4b\u8bd5\u8bbe\u59072",
            "target": "primary",
            "command": ["--nodes"],
            "requires_connection": True,
            "requires_peer": True,
            "requires_previous_pass": True,
            "expect_node_from": "peer_node_id",
            "pass_criteria": "\u6d4b\u8bd5\u8bbe\u59071 NodeDB \u4e2d\u80fd\u770b\u5230\u6d4b\u8bd5\u8bbe\u59072\u8282\u70b9 ID\u3002NodeDB \u53ef\u89c1\u4e0d\u7b49\u4e8e\u6d88\u606f ACK\u3002",
            "expect_stdout_regex": ["Connected to radio"],
            "expect_stdout_regex_any": ["Nodes|User|AKA|ID|last heard|LastHeard|num"],
            "action_summary": "\u8bfb\u53d6\u6d4b\u8bd5\u8bbe\u59071 NodeDB \u5e76\u786e\u8ba4\u6d4b\u8bd5\u8bbe\u59072\u53ef\u89c1",
        },
        {
            "name": "\u786e\u8ba4\u6d4b\u8bd5\u8bbe\u59072 NodeDB \u5305\u542b\u6d4b\u8bd5\u8bbe\u59071",
            "target": "peer",
            "command": ["--nodes"],
            "requires_connection": True,
            "requires_peer": True,
            "requires_previous_pass": True,
            "expect_node_from": "primary_node_id",
            "pass_criteria": "\u6d4b\u8bd5\u8bbe\u59072 NodeDB \u4e2d\u80fd\u770b\u5230\u6d4b\u8bd5\u8bbe\u59071\u8282\u70b9 ID\u3002NodeDB \u53ef\u89c1\u4e0d\u7b49\u4e8e\u6d88\u606f ACK\u3002",
            "expect_stdout_regex": ["Connected to radio"],
            "expect_stdout_regex_any": ["Nodes|User|AKA|ID|last heard|LastHeard|num"],
            "action_summary": "\u8bfb\u53d6\u6d4b\u8bd5\u8bbe\u59072 NodeDB \u5e76\u786e\u8ba4\u6d4b\u8bd5\u8bbe\u59071\u53ef\u89c1",
        },
    ]
    return {
        "id": "MESHTASTIC-CONTACT-EXCHANGE",
        "module": "\u8054\u7cfb\u4eba\u4e92\u8ba4",
        "source_l2_case": "\u964c\u751f\u8bbe\u5907\u516c\u94a5\u4ea4\u6362",
        "objective": "\u901a\u8fc7 Meshtastic \u8054\u7cfb\u4eba URL \u5728\u4e24\u53f0\u8bbe\u5907\u95f4\u5bfc\u5165\u5bf9\u65b9\u516c\u94a5\uff0c\u4e3a\u70b9\u5bf9\u70b9\u6d88\u606f\u505a\u51c6\u5907\u3002",
        "test_data": "contact-qr / add-contact / NodeDB",
        "pass_meaning": "PASS \u8868\u793a\u4e24\u53f0\u8bbe\u5907\u90fd\u5df2\u5bfc\u5165\u5bf9\u65b9\u8054\u7cfb\u4eba URL\uff0c\u4e14 NodeDB \u4e2d\u80fd\u770b\u5230\u5bf9\u65b9\u8282\u70b9\u3002\u8fd9\u4e0d\u7b49\u4e8e\u6d88\u606f\u5df2 ACK\uff0c\u901a\u4fe1\u4ecd\u9700\u5355\u72ec\u9a8c\u8bc1\u3002",
        "failure_help": "\u5931\u8d25\u65f6\u5148\u68c0\u67e5 CLI \u662f\u5426\u652f\u6301 --contact-qr / --add-contact\uff0c\u518d\u68c0\u67e5\u4e32\u53e3\u662f\u5426\u5360\u7528\u6216\u8bbe\u5907\u4ecd\u5728\u91cd\u542f\u3002",
        "risk": "mutating",
        "steps": steps,
    }

def config_set_get_steps(target, label, field, value):
    name = display_field(field)
    group = change_group_key(target, field or "field")
    display_target_value = display_value(field, value)
    return [
        {
            "name": f"\u8bfb\u53d6\u5f53\u524d{label}{name}",
            "target": target,
            "command": ["--get", field or ""],
            "requires_connection": True,
            "requires_peer": target == "peer",
            "requires_config": True,
            "mutating": False,
            "pass_criteria": f"{label} \u53ef\u8bfb\u53d6\u5f53\u524d {name}",
            "expect_stdout_regex_any": [re.escape(field or ""), r"\S+"],
            "action_summary": f"\u8bfb\u53d6{label}\u5f53\u524d\u914d\u7f6e {name}",
        },
        {
            "name": f"\u5199\u5165{label}{name}",
            "target": target,
            "command": ["--set", field or "", value or ""],
            "requires_connection": True,
            "requires_peer": target == "peer",
            "requires_config": True,
            "requires_previous_pass": True,
            "mutating": True,
            "conditional_set_pairs": [(field or "", value or "")],
            "change_group": group,
            "pass_criteria": f"{label} {name} \u5df2\u5199\u5165: {display_target_value}",
            "expect_stdout_regex": ["Connected|Writing|Setting|Saved|Set|Reboot"],
            "action_summary": f"\u5199\u5165{label}\u914d\u7f6e {name}={display_target_value}",
        },
        {
            "name": f"\u7b49\u5f85{label}{name}\u751f\u6548",
            "target": target,
            "sleep_sec": "reboot_wait",
            "requires_previous_pass": True,
            "change_group": group,
            "pass_criteria": "\u5df2\u7b49\u5f85\u8bbe\u5907\u91cd\u542f\u548c\u914d\u7f6e\u751f\u6548\u3002",
            "action_summary": f"\u7b49\u5f85{label}{name}\u914d\u7f6e\u751f\u6548",
        },
        {
            "name": f"\u8bfb\u56de{label}{name}",
            "target": target,
            "command": ["--get", field or ""],
            "requires_connection": True,
            "requires_peer": target == "peer",
            "requires_config": True,
            "requires_previous_pass": True,
            "mutating": False,
            "change_group": group,
            "readback_field": field or "",
            "readback_value": value or "",
            "pass_criteria": f"{label} \u8bfb\u56de {name} \u4e0e\u5199\u5165\u503c\u4e00\u81f4: {display_target_value}",
            "expect_stdout_regex_any": expected_read_patterns(field, value),
            "action_summary": f"\u8bfb\u56de{label}\u914d\u7f6e {name}",
        },
    ]


def config_set_many_steps(target, label, pairs):
    group = change_group_key(target, "|".join(field for field, _ in pairs))
    set_command = []
    get_command = []
    for field, value in pairs:
        set_command.extend(["--set", field, value])
        get_command.extend(["--get", field])
    names = ", ".join(f"{display_field(field)}={display_value(field, value)}" for field, value in pairs)
    sensitive = any(any(key.lower() in field.lower() for key in SENSITIVE_KEYS) for field, _ in pairs)
    fields = [field for field, _ in pairs]
    readback_values = {field: value for field, value in pairs}
    steps = [{
        "name": f"\u8bfb\u53d6\u5f53\u524d{label}\u914d\u7f6e",
        "target": target,
        "command": get_command,
        "requires_connection": True,
        "requires_peer": target == "peer",
        "mutating": False,
        "pass_criteria": f"{label} \u53ef\u8bfb\u53d6\u5f53\u524d\u914d\u7f6e: {', '.join(display_field(field) for field in fields)}",
        "expect_stdout_regex_any": [re.escape(field) for field in fields],
        "readback_fields": fields,
        "action_summary": f"Read current config for {label}: {', '.join(display_field(field) for field in fields)}",
    }]
    steps.append({
        "name": f"\u5199\u5165{label}\u914d\u7f6e",
        "target": target,
        "command": set_command,
        "requires_connection": True,
        "requires_peer": target == "peer",
        "requires_previous_pass": True,
        "mutating": True,
        "sensitive_output": sensitive,
        "conditional_set_pairs": pairs,
        "change_group": group,
        "pass_criteria": f"{label} \u5df2\u63a5\u53d7\u914d\u7f6e\u5199\u5165: {names}",
        "expect_stdout_regex": ["Connected|Writing|Setting|Saved|Set|Reboot"],
        "action_summary": f"\u5199\u5165{label}\u914d\u7f6e {names}",
    })
    steps.append({
        "name": f"\u7b49\u5f85{label}\u914d\u7f6e\u751f\u6548",
        "target": target,
        "sleep_sec": "reboot_wait",
        "requires_previous_pass": True,
        "change_group": group,
        "pass_criteria": "\u5df2\u7b49\u5f85\u8bbe\u5907\u91cd\u542f\u548c\u914d\u7f6e\u751f\u6548\u3002",
        "action_summary": f"\u7b49\u5f85{label}\u914d\u7f6e\u751f\u6548",
    })
    patterns = []
    for field, value in pairs:
        patterns.extend(expected_read_patterns(field, value))
    steps.append({
        "name": f"\u8bfb\u56de{label}\u914d\u7f6e",
        "target": target,
        "command": get_command,
        "requires_connection": True,
        "requires_peer": target == "peer",
        "requires_previous_pass": True,
        "mutating": False,
        "change_group": group,
        "readback_fields": fields,
        "readback_values": readback_values,
        "pass_criteria": f"{label} \u8bfb\u56de\u914d\u7f6e\u4e0e\u5199\u5165\u503c\u4e00\u81f4: {names}",
        "expect_stdout_regex_any": patterns,
        "action_summary": f"Read back {label} config: {names}",
    })
    return steps


def channel_set_steps(target, label, index, name, psk):
    group = change_group_key(target, f"channel:{index}")
    set_command = ["--ch-index", str(index)]
    names = []
    if name:
        set_command.extend(["--ch-set", "name", name])
        names.append(f"name={name}")
    if psk:
        set_command.extend(["--ch-set", "psk", psk])
        names.append("psk=<redacted>")
    set_command.append("--info")
    steps = [
        {
            "name": f"\u8bfb\u53d6\u5f53\u524d{label}\u9891\u9053 {index}",
            "target": target,
            "command": ["--ch-index", str(index), "--info"],
            "requires_connection": True,
            "requires_peer": target == "peer",
            "mutating": False,
            "sensitive_output": True,
            "capture_channel_index": int(index),
            "pass_criteria": f"{label} \u53ef\u8bfb\u53d6\u9891\u9053 {index} \u5f53\u524d\u914d\u7f6e",
            "expect_stdout_regex_any": ["Channel|channels|name|url|Complete|Connected"],
            "action_summary": f"\u8bfb\u53d6{label}\u9891\u9053 {index} \u5f53\u524d\u914d\u7f6e",
        },
        {
            "name": f"\u5199\u5165{label}\u9891\u9053 {index}",
            "target": target,
            "command": set_command,
            "requires_connection": True,
            "requires_peer": target == "peer",
            "mutating": True,
            "sensitive_output": bool(psk),
            "requires_previous_pass": True,
            "conditional_channel": {"index": int(index), "name": name, "psk": bool(psk)},
            "change_group": group,
            "pass_criteria": f"{label} \u5df2\u63a5\u53d7\u9891\u9053 {index} \u5199\u5165: {', '.join(names)}",
            "expect_stdout_regex": ["Connected|Writing|Setting|Saved|Set|Channel|channels"],
            "expect_stdout_regex_any": [re.escape(name) if name else "Channel|channels", "psk|PSK|url|URL|Complete|Writing"],
            "action_summary": f"Write {label} channel {index} config: {', '.join(names)}",
        },
        {
            "name": f"\u7b49\u5f85{label}\u9891\u9053 {index} \u751f\u6548",
            "target": target,
            "sleep_sec": "reboot_wait",
            "requires_previous_pass": True,
            "change_group": group,
            "pass_criteria": "\u5df2\u7b49\u5f85\u8bbe\u5907\u91cd\u542f\u548c\u9891\u9053\u914d\u7f6e\u751f\u6548\u3002",
            "action_summary": f"\u7b49\u5f85{label}\u9891\u9053 {index} \u914d\u7f6e\u751f\u6548",
        },
        {
            "name": f"\u8bfb\u56de{label}\u9891\u9053 {index}",
            "target": target,
            "command": ["--ch-index", str(index), "--info"],
            "requires_connection": True,
            "requires_peer": target == "peer",
            "requires_previous_pass": True,
            "mutating": False,
            "sensitive_output": True,
            "capture_channel_index": int(index),
            "change_group": group,
            "readback_channel": {"index": int(index), "name": name, "psk": bool(psk)},
            "pass_criteria": f"{label} \u8bfb\u56de\u9891\u9053 {index} \u4e0e\u5199\u5165\u503c\u4e00\u81f4",
            "expect_stdout_regex_any": [re.escape(name) if name else "Channel|channels|name|url|Complete|Connected"],
            "action_summary": f"\u8bfb\u56de{label}\u9891\u9053 {index} \u914d\u7f6e",
        },
    ]
    return steps

def valid_channel_psk(value):
    text = str(value or "").strip()
    if not text:
        return True
    return bool(re.fullmatch(r"(?i)(default|none|0x[0-9a-f]+|base64:.+)", text))



def communication_experiment_case(args):
    primary_message = args.message_primary or ""
    peer_message = args.message_peer or ""
    message_mode = args.message_mode
    message_channel = str(max(0, min(args.message_channel, 7)))
    primary_send_command = ["--sendtext", primary_message, "--ack"]
    peer_send_command = ["--sendtext", peer_message, "--ack"]
    primary_dest = "peer_node_id"
    peer_dest = "primary_node_id"
    send_expect = ["Acknowledgment|Acknowledgement|ACK|Ack"]
    send_fail = ["NAK|MAX_RETRANSMIT|error reason|No route|timeout"]
    send_criteria = "\u53d1\u9001\u547d\u4ee4\u8fd4\u56de\u6210\u529f\u4e14 CLI \u6536\u5230\u660e\u786e ACK\uff1b\u53ea\u770b\u5230 Sending/Connected \u4e0d\u7b97\u901a\u8fc7\u3002"
    if message_mode == "channel":
        primary_send_command = ["--ch-index", message_channel, "--sendtext", primary_message]
        peer_send_command = ["--ch-index", message_channel, "--sendtext", peer_message]
        primary_dest = None
        peer_dest = None
        send_expect = []
        send_fail = ["NAK|MAX_RETRANSMIT|error reason"]
        send_criteria = f"\u53d1\u9001\u5230\u9891\u9053 {message_channel} \u540e\uff0c\u5bf9\u7aef\u76d1\u542c\u8f93\u51fa\u5fc5\u987b\u770b\u5230\u540c\u4e00\u6761\u6d88\u606f\u3002"
    identity_steps = [
        {
            "name": "\u8bfb\u53d6\u6d4b\u8bd5\u8bbe\u59071\u8282\u70b9 ID \u548c\u516c\u94a5",
            "target": "primary",
            "command": ["--no-nodes", "--info"],
            "requires_connection": True,
            "capture_node_id_as": "primary_node_id",
            "pass_criteria": "\u6d4b\u8bd5\u8bbe\u59071\u53ef\u8bfb\u53d6\u8282\u70b9 ID \u548c\u516c\u94a5\uff0c\u4e0d\u8bfb\u53d6\u79c1\u94a5\u3002",
            "expect_stdout_regex": ["Connected to radio"],
            "expect_stdout_regex_any": ["myNodeNum|NodeInfo|Owner"],
            "action_summary": "\u8bfb\u53d6\u6d4b\u8bd5\u8bbe\u59071\u8282\u70b9 ID \u548c\u516c\u94a5",
        },
        {
            "name": "\u8bfb\u53d6\u6d4b\u8bd5\u8bbe\u59072\u8282\u70b9 ID \u548c\u516c\u94a5",
            "target": "peer",
            "command": ["--no-nodes", "--info"],
            "requires_connection": True,
            "requires_peer": True,
            "capture_node_id_as": "peer_node_id",
            "pass_criteria": "\u6d4b\u8bd5\u8bbe\u59072\u53ef\u8bfb\u53d6\u8282\u70b9 ID \u548c\u516c\u94a5\uff0c\u4e0d\u8bfb\u53d6\u79c1\u94a5\u3002",
            "expect_stdout_regex": ["Connected to radio"],
            "expect_stdout_regex_any": ["myNodeNum|NodeInfo|Owner"],
            "action_summary": "\u8bfb\u53d6\u6d4b\u8bd5\u8bbe\u59072\u8282\u70b9 ID \u548c\u516c\u94a5",
        },
        {
            "name": "\u786e\u8ba4\u6d4b\u8bd5\u8bbe\u59071 NodeDB \u5305\u542b\u6d4b\u8bd5\u8bbe\u59072",
            "target": "primary",
            "command": ["--nodes"],
            "requires_connection": True,
            "requires_peer": True,
            "expect_node_from": "peer_node_id",
            "pass_criteria": "\u6d4b\u8bd5\u8bbe\u59071 NodeDB \u4e2d\u80fd\u770b\u5230\u6d4b\u8bd5\u8bbe\u59072\u8282\u70b9 ID\u3002NodeDB \u53ef\u89c1\u4e0d\u7b49\u4e8e\u6d88\u606f ACK\u3002",
            "expect_stdout_regex": ["Connected to radio"],
            "expect_stdout_regex_any": ["Nodes|User|AKA|ID|last heard|LastHeard|num"],
            "action_summary": "\u8bfb\u53d6\u6d4b\u8bd5\u8bbe\u59071 NodeDB",
        },
        {
            "name": "\u786e\u8ba4\u6d4b\u8bd5\u8bbe\u59072 NodeDB \u5305\u542b\u6d4b\u8bd5\u8bbe\u59071",
            "target": "peer",
            "command": ["--nodes"],
            "requires_connection": True,
            "requires_peer": True,
            "expect_node_from": "primary_node_id",
            "pass_criteria": "\u6d4b\u8bd5\u8bbe\u59072 NodeDB \u4e2d\u80fd\u770b\u5230\u6d4b\u8bd5\u8bbe\u59071\u8282\u70b9 ID\u3002NodeDB \u53ef\u89c1\u4e0d\u7b49\u4e8e\u6d88\u606f ACK\u3002",
            "expect_stdout_regex": ["Connected to radio"],
            "expect_stdout_regex_any": ["Nodes|User|AKA|ID|last heard|LastHeard|num"],
            "action_summary": "\u8bfb\u53d6\u6d4b\u8bd5\u8bbe\u59072 NodeDB",
        },
    ]
    cli_send_steps = [
        {
            "name": f"\u6d4b\u8bd5\u8bbe\u59071\u53d1\u5230\u9891\u9053 {message_channel}" if message_mode == "channel" else "\u6d4b\u8bd5\u8bbe\u59071\u53d1\u7ed9\u6d4b\u8bd5\u8bbe\u59072",
            "target": "primary",
            "command": primary_send_command,
            "listen_send": message_mode == "channel",
            "listen_target": "peer",
            "requires_connection": True,
            "requires_peer": True,
            "dest_from": primary_dest,
            "mutating": True,
            "requires_message": "primary",
            "pass_criteria": f"\u6d4b\u8bd5\u8bbe\u59071 {send_criteria}",
            "expect_stdout_regex_any": send_expect,
            "fail_on_regex": send_fail,
            "action_summary": f"\u6d4b\u8bd5\u8bbe\u59071\u53d1\u9001\u6d88\u606f\uff0cmode={message_mode}\uff0cchannel={message_channel}",
            "direction": "\u6d4b\u8bd5\u8bbe\u59071 -> \u6d4b\u8bd5\u8bbe\u59072" if message_mode == "device" else f"\u6d4b\u8bd5\u8bbe\u59071 -> \u9891\u9053 {message_channel}",
            "message": primary_message,
            "wait_to_disconnect": 0,
        },
        {
            "name": f"\u6d4b\u8bd5\u8bbe\u59072\u53d1\u5230\u9891\u9053 {message_channel}" if message_mode == "channel" else "\u6d4b\u8bd5\u8bbe\u59072\u53d1\u7ed9\u6d4b\u8bd5\u8bbe\u59071",
            "target": "peer",
            "command": peer_send_command,
            "listen_send": message_mode == "channel",
            "listen_target": "primary",
            "requires_connection": True,
            "requires_peer": True,
            "dest_from": peer_dest,
            "mutating": True,
            "requires_message": "peer",
            "pass_criteria": f"\u6d4b\u8bd5\u8bbe\u59072 {send_criteria}",
            "expect_stdout_regex_any": send_expect,
            "fail_on_regex": send_fail,
            "action_summary": f"\u6d4b\u8bd5\u8bbe\u59072\u53d1\u9001\u6d88\u606f\uff0cmode={message_mode}\uff0cchannel={message_channel}",
            "direction": "\u6d4b\u8bd5\u8bbe\u59072 -> \u6d4b\u8bd5\u8bbe\u59071" if message_mode == "device" else f"\u6d4b\u8bd5\u8bbe\u59072 -> \u9891\u9053 {message_channel}",
            "message": peer_message,
            "wait_to_disconnect": 0,
        },
    ]
    persistent_serial_step = {
        "name": f"\u9891\u9053 {message_channel} \u53cc\u5411\u53d1\u9001" if message_mode == "channel" else "\u70b9\u5bf9\u70b9\u53cc\u5411\u53d1\u9001",
        "target": "both",
        "command": ["python-api", "dual-send", "--message-mode", message_mode, "--message-channel", message_channel],
        "api_dual_send": True,
        "requires_connection": True,
        "requires_peer": True,
        "requires_context": [] if message_mode == "channel" else ["primary_node_id", "peer_node_id"],
        "mutating": True,
        "requires_message": "primary",
        "pass_criteria": "\u4e24\u53f0\u8bbe\u5907\u90fd\u5fc5\u987b\u6536\u5230\u5bf9\u65b9\u6d88\u606f\uff1b\u53ea\u6709\u53d1\u9001\u547d\u4ee4\u6210\u529f\u4e0d\u7b97\u901a\u8fc7\u3002",
        "action_summary": "\u7528 Python API \u540c\u65f6\u4fdd\u6301\u4e24\u4e2a\u4e32\u53e3\u8fde\u63a5\uff0c\u5b8c\u6210\u53cc\u5411\u53d1\u9001\u548c\u63a5\u6536\u5224\u5b9a\u3002",
        "direction": f"device1 <-> device2; mode={message_mode}; channel={message_channel}",
        "message": primary_message,
        "primary_message": primary_message,
        "peer_message": peer_message,
        "message_mode": message_mode,
        "channel_index": int(message_channel),
        "wait_to_disconnect": 0,
    }
    primary_node_id = normalize_node_id(args.primary_node_id)
    peer_node_id = normalize_node_id(args.peer_node_id)
    known_device_ids = bool(primary_node_id and peer_node_id and primary_node_id != peer_node_id)
    use_persistent_serial = bool(args.port and args.peer_port)
    if use_persistent_serial:
        steps = [persistent_serial_step] if (known_device_ids or message_mode == "channel") else identity_steps + [persistent_serial_step]
    else:
        steps = cli_send_steps if (known_device_ids or message_mode == "channel") else identity_steps + cli_send_steps
    return {
        "id": "L2-COMM-EXPERIMENT",
        "module": "\u901a\u4fe1\u9a8c\u8bc1",
        "source_l2_case": "\u9891\u9053\u901a\u4fe1 / \u70b9\u5bf9\u70b9\u53cc\u5411\u6d88\u606f",
        "objective": "\u5728\u4e24\u53f0\u8bbe\u5907\u901a\u4fe1\u914d\u7f6e\u4e00\u81f4\u7684\u524d\u63d0\u4e0b\uff0c\u9a8c\u8bc1\u9891\u9053\u53d1\u9001\u6216\u70b9\u5bf9\u70b9\u53cc\u5411\u6d88\u606f\u662f\u5426\u771f\u6b63\u88ab\u5bf9\u7aef\u6536\u5230\u3002",
        "test_data": f"message_mode={message_mode}; channel={message_channel}; primary_message={primary_message or 'empty'}; peer_message={peer_message or 'empty'}",
        "pass_meaning": "PASS \u8868\u793a\u4e24\u53f0\u8bbe\u5907\u90fd\u6536\u5230\u4e86\u5bf9\u65b9\u6d88\u606f\uff1b\u4ec5\u547d\u4ee4\u8fd4\u56de 0 \u6216\u8bbe\u5907\u4e0a\u770b\u5230\u53d1\u9001\u52a8\u4f5c\u4e0d\u7b97\u901a\u8fc7\u3002",
        "failure_help": "\u5931\u8d25\u65f6\u4f18\u5148\u68c0\u67e5\u9891\u9053/PSK\u3001Region\u3001Frequency Override\u3001Modem Preset \u662f\u5426\u4e00\u81f4\uff1b\u70b9\u5bf9\u70b9\u6a21\u5f0f\u8fd8\u8981\u786e\u8ba4\u4e24\u53f0\u8bbe\u5907\u5df2\u4ea4\u6362\u8054\u7cfb\u4eba\u516c\u94a5\u3002",
        "risk": "mutating",
        "steps": steps,
    }

def run_case(case, args, connection_args, peer_connection_args, context, progress_path=None, total_steps=0, step_index=0):
    case_result = {
        "id": case.get("id"),
        "module": case.get("module"),
        "source_l2_case": case.get("source_l2_case"),
        "objective": case.get("objective"),
        "test_data": case.get("test_data"),
        "pass_meaning": case.get("pass_meaning"),
        "failure_help": case.get("failure_help"),
        "risk": case.get("risk"),
        "steps": [],
    }
    previous_failed_or_skipped = False
    previous_issue_step = ""
    for step in case.get("steps", []):
        step_index += 1
        step_target = step.get("target", "primary")
        skip_reason = should_skip(case, step, args, connection_args, peer_connection_args, context)
        if not skip_reason and args.execute and step.get("requires_connection") and step_target in ("primary", "peer") and context.get(f"{step_target}:unavailable"):
            skip_reason = f"target_unavailable:{step_target}"
        blocked_by = ""
        if not skip_reason and step.get("requires_previous_pass") and previous_failed_or_skipped:
            skip_reason = "dependency_not_run"
            blocked_by = previous_issue_step
        step_connection_args = peer_connection_args if step.get("target") == "peer" else connection_args
        step_dest = args.dest or context.get(step.get("dest_from"))
        if not step_dest and step.get("dest_from") and not args.execute:
            step_dest = f"!{step.get('dest_from')}"
        is_sleep_step = "sleep_sec" in step
        is_compare_step = bool(step.get("compare_config_fields"))
        is_listen_send_step = bool(step.get("listen_send"))
        is_api_dual_send_step = bool(step.get("api_dual_send"))
        step_command = resolve_context_tokens(list(step.get("command", [])), context)
        if args.execute and step.get("conditional_set_pairs"):
            changed_pairs = []
            for field, desired in step.get("conditional_set_pairs") or []:
                current = context.get(context_value_key(step.get("target", "primary"), field))
                if not values_equivalent(field, current, desired):
                    changed_pairs.append((field, desired))
            step["changed_pairs"] = changed_pairs
            step_command = []
            for field, desired in changed_pairs:
                step_command.extend(["--set", field, desired])
        wait_to_disconnect = int(step.get("wait_to_disconnect", args.wait_to_disconnect if step.get("mutating") else 0) or 0)
        command = step_command if is_api_dual_send_step else [] if (is_sleep_step or is_compare_step) else build_command(args.meshtastic, step_connection_args, step_command, step_dest if (case.get("requires_dest") or step.get("dest_from")) else None, wait_to_disconnect)
        step_result = {
            "name": step.get("name"),
            "target": step.get("target", "primary"),
            "command": command,
            "status": "DRY_RUN",
            "mutating": bool(step.get("mutating")),
            "sensitive_output": bool(step.get("sensitive_output")),
            "pass_criteria": step.get("pass_criteria"),
            "action_summary": step.get("action_summary"),
            "direction": step.get("direction"),
            "message": step.get("message"),
            "primary_message": step.get("primary_message"),
            "peer_message": step.get("peer_message"),
            "listen_target": step.get("listen_target"),
            "api_dual_send": is_api_dual_send_step,
            "index": step_index,
            "total": total_steps,
        }
        write_progress(progress_path, {"event": "step_start", "index": step_index, "total": total_steps, "case_id": case.get("id"), "step": step_result["name"], "target": step_result["target"], "command": command_text(command)})
        if skip_reason:
            step_result["status"] = "SKIPPED"
            step_result["reason"] = skip_reason
            if blocked_by:
                step_result["blocked_by"] = blocked_by
            previous_failed_or_skipped = True
            previous_issue_step = previous_issue_step or step_result["name"]
        elif is_sleep_step:
            if args.execute:
                group = step.get("change_group")
                if group and context.get(f"{group}:changed") is False:
                    step_result["status"] = "PASS"
                    step_result["reason"] = "no_write_needed"
                    step_result["duration_sec"] = 0
                    step_result["pass_criteria"] = "Current config already matches the target value; no wait is needed."
                    step_result["action_summary"] = "Skip wait because no write was needed."
                else:
                    wait_sec = step_sleep_seconds(step, args)
                    time.sleep(wait_sec)
                    step_result["status"] = "PASS"
                    step_result["reason"] = "wait_done"
                    step_result["duration_sec"] = wait_sec
            previous_failed_or_skipped = False
            previous_issue_step = ""
        elif is_compare_step:
            if args.execute:
                mismatches = []
                for field in step.get("compare_config_fields") or []:
                    primary_value = context.get(context_value_key("primary", field))
                    peer_value = context.get(context_value_key("peer", field))
                    if not compare_config_values(field, primary_value, peer_value):
                        mismatches.append(f"{display_field(field)}: {display_value(field, primary_value) or '-'} != {display_value(field, peer_value) or '-'}")
                if mismatches:
                    step_result["status"] = "FAIL"
                    step_result["reason"] = "config_mismatch"
                    step_result["mismatch_summary"] = mismatches
                else:
                    step_result["status"] = "PASS"
                    step_result["reason"] = "config_consistent"
                    step_result["pass_criteria"] = "The two devices have consistent communication config."
            previous_failed_or_skipped = step_result["status"] != "PASS"
            previous_issue_step = "" if step_result["status"] == "PASS" else step_result["name"]
        elif args.execute and is_api_dual_send_step:
            raw = run_api_dual_send_step(
                args,
                connection_args,
                peer_connection_args,
                step.get("primary_message") or step.get("message") or "",
                step.get("peer_message") or step.get("message") or "",
                step.get("message_mode") or args.message_mode,
                step.get("channel_index") or args.message_channel,
                context.get("primary_node_id"),
                context.get("peer_node_id"),
            )
            passed = raw.get("exit_code") == 0 and raw.get("received_message")
            step_result.update(raw)
            step_result["status"] = "PASS" if passed else "FAIL"
            step_result["reason"] = raw.get("reason") or ("api_dual_received" if passed else "api_dual_missing_receive")
            mark_target_unavailable(step_result, context)
            previous_failed_or_skipped = not passed
            previous_issue_step = "" if passed else step_result["name"]
        elif args.execute and is_listen_send_step:
            try:
                receiver_connection_args = peer_connection_args if step.get("listen_target") == "peer" else connection_args
                wait_before_device_command(command, args)
                raw = run_listen_send_step(
                    args,
                    step_connection_args,
                    receiver_connection_args,
                    step_command,
                    step.get("message") or "",
                    step.get("channel_index") or args.message_channel,
                    args.timeout,
                    args.receive_wait,
                    int(step.get("wait_to_disconnect", 0) or 0),
                )
                passed, reason = evaluate_expectations(raw, step.get("expect_stdout_regex", []), step.get("expect_stdout_regex_any", []), step.get("fail_on_regex", []))
                if not raw.get("received_message"):
                    passed, reason = False, "no_received_message"
                step_result.update(raw)
                step_result["status"] = "PASS" if passed else "FAIL"
                step_result["reason"] = reason
                mark_target_unavailable(step_result, context)
                previous_failed_or_skipped = step_result["status"] != "PASS"
                previous_issue_step = "" if step_result["status"] == "PASS" else step_result["name"]
            except FileNotFoundError:
                step_result["status"] = "FAIL"
                step_result["reason"] = "meshtastic_cli_not_found"
                previous_failed_or_skipped = True
                previous_issue_step = step_result["name"]
        elif args.execute and step.get("conditional_set_pairs") and not step.get("changed_pairs"):
            group = step.get("change_group")
            if group:
                context[f"{group}:changed"] = False
            step_result["status"] = "PASS"
            step_result["reason"] = "unchanged"
            step_result["pass_criteria"] = "Current value already matches the target; write was skipped."
            step_result["action_summary"] = "Skip config write because current value is unchanged."
            previous_failed_or_skipped = False
            previous_issue_step = ""
        elif args.execute and step.get("readback_fields") and context.get(f"{step.get('change_group')}:changed") is False:
            read_values = []
            for field in step.get("readback_fields") or []:
                value = context.get(context_value_key(step_result["target"], field))
                fallback = (step.get("readback_values") or {}).get(field, "")
                read_values.append({
                    "field": field,
                    "value": value or fallback or "",
                    "display_field": display_field(field),
                    "display_value": display_value(field, value or fallback or ""),
                })
            step_result["status"] = "PASS"
            step_result["reason"] = "unchanged_read_confirmed"
            step_result["pass_criteria"] = "Config value was already unchanged; readback uses the previously captured value."
            step_result["read_values"] = read_values
            if len(read_values) == 1:
                step_result["read_value"] = read_values[0]
            step_result["action_summary"] = "Use cached current config because no write was needed."
            previous_failed_or_skipped = False
            previous_issue_step = ""
        elif args.execute and step.get("readback_field") and context.get(f"{step.get('change_group')}:changed") is False:
            field = step.get("readback_field") or ""
            value = context.get(context_value_key(step_result["target"], field))
            step_result["status"] = "PASS"
            step_result["reason"] = "unchanged_read_confirmed"
            step_result["pass_criteria"] = "Config value was already unchanged; readback uses the previously captured value."
            step_result["read_value"] = {
                "field": field,
                "value": value or step.get("readback_value") or "",
                "display_field": display_field(field),
                "display_value": display_value(field, value or step.get("readback_value") or ""),
            }
            step_result["action_summary"] = "Use cached current config because no write was needed."
            previous_failed_or_skipped = False
            previous_issue_step = ""
        elif args.execute and step.get("readback_channel") and context.get(f"{step.get('change_group')}:changed") is False:
            channel = step.get("readback_channel") or {}
            current = context.get(f"current:{step.get('target', 'primary')}:channel:{channel.get('index')}:summary") or {}
            step_result["status"] = "PASS"
            step_result["reason"] = "unchanged_read_confirmed"
            step_result["pass_criteria"] = "Channel config was already unchanged; readback uses the previously captured channel summary."
            if current:
                step_result["channel_summary"] = current
            step_result["action_summary"] = "Use cached current channel config because no write was needed."
            previous_failed_or_skipped = False
            previous_issue_step = ""
        elif args.execute and step.get("conditional_channel") and not step.get("conditional_channel", {}).get("psk"):
            channel = step.get("conditional_channel") or {}
            group = step.get("change_group")
            current_summary = context.get(f"current:{step.get('target', 'primary')}:channel:{channel.get('index')}:summary") or {}
            current_name = context.get(f"current:{step.get('target', 'primary')}:channel:{channel.get('index')}:name")
            desired_name = str(channel.get("name") or "").strip()
            if desired_name and current_name and current_name.strip().upper() == desired_name.upper():
                if group:
                    context[f"{group}:changed"] = False
                step_result["status"] = "PASS"
                step_result["reason"] = "unchanged"
                step_result["pass_criteria"] = "Channel name already matches the target; write was skipped."
                step_result["action_summary"] = "Skip channel write because current value is unchanged."
                previous_failed_or_skipped = False
                previous_issue_step = ""
            else:
                try:
                    if desired_name and int(channel.get("index") or 0) > 0 and current_summary.get("role") in ("DISABLED", "", None):
                        step_command = ["--ch-add", desired_name]
                        command = build_command(args.meshtastic, step_connection_args, step_command, None, args.wait_to_disconnect)
                        step_result["command"] = command
                        step_result["action_summary"] = f"Add channel {desired_name} before applying channel config."
                    wait_before_device_command(command, args)
                    raw = run_command(command, args.timeout)
                    passed, reason = evaluate_expectations(raw, step.get("expect_stdout_regex", []), step.get("expect_stdout_regex_any", []), step.get("fail_on_regex", []))
                    combined = (raw.get("stdout") or "") + "\n" + (raw.get("stderr") or "")
                    if step.get("sensitive_output"):
                        raw["stdout"] = redact_sensitive(raw.get("stdout"))
                        raw["stderr"] = redact_sensitive(raw.get("stderr"))
                    step_result.update(raw)
                    step_result["status"] = "PASS" if passed else "FAIL"
                    step_result["reason"] = reason
                    mark_target_unavailable(step_result, context)
                    channel_name = parse_channel_name(combined, int(channel.get("index") or 0))
                    if channel_name:
                        step_result["channel_summary"] = {"index": int(channel.get("index") or 0), "name": channel_name}
                        context[f"current:{step.get('target', 'primary')}:channel:{channel.get('index')}:name"] = channel_name
                    if group and passed:
                        context[f"{group}:changed"] = True
                    previous_failed_or_skipped = not passed
                    previous_issue_step = "" if passed else step_result["name"]
                except subprocess.TimeoutExpired:
                    step_result["status"] = "FAIL"
                    step_result["reason"] = "timeout"
                    step_result["duration_sec"] = args.timeout
                    if step_result["target"] in ("primary", "peer"):
                        context[f"{step_result['target']}:unavailable"] = True
                    previous_failed_or_skipped = True
                    previous_issue_step = step_result["name"]
                except FileNotFoundError:
                    step_result["status"] = "FAIL"
                    step_result["reason"] = "meshtastic_cli_not_found"
                    previous_failed_or_skipped = True
                    previous_issue_step = step_result["name"]
        elif args.execute:
            try:
                retry_safe = not step_result["mutating"] and "--sendtext" not in command
                wait_before_device_command(command, args)
                raw = run_command_with_retries(command, args.timeout) if retry_safe else run_command(command, args.timeout)
                passed, reason = evaluate_expectations(raw, step.get("expect_stdout_regex", []), step.get("expect_stdout_regex_any", []), step.get("fail_on_regex", []))
                combined = (raw.get("stdout") or "") + "\n" + (raw.get("stderr") or "")
                expected_node = context.get(step.get("expect_node_from"))
                if passed and expected_node and not node_seen_in_output(expected_node, combined):
                    passed, reason = False, f"node_not_found:{expected_node}"
                node_public_keys = parse_node_public_keys(combined)
                if node_public_keys:
                    step_result["node_public_keys"] = node_public_keys
                    expected_public_key = public_key_for_node(combined, expected_node) if expected_node else ""
                    if expected_public_key:
                        step_result["expected_node_public_key"] = expected_public_key
                if step.get("sensitive_output"):
                    raw["stdout"] = redact_sensitive(raw.get("stdout"))
                    raw["stderr"] = redact_sensitive(raw.get("stderr"))
                step_result.update(raw)
                step_result["status"] = "PASS" if passed else "FAIL"
                step_result["reason"] = reason
                mark_target_unavailable(step_result, context)
                if step.get("conditional_set_pairs") and step.get("change_group") and passed:
                    context[f"{step.get('change_group')}:changed"] = True
                # Only local --info can update device identity. NodeDB rows and relay
                # nodes in the same output are ignored to keep COM mapping stable.
                info_summary = {}
                if "--info" in command and "--ch-index" not in command:
                    info_summary = parse_info_summary(combined)
                    if info_summary:
                        step_result["info_summary"] = info_summary
                        if step_result["target"] in ("primary", "peer") and info_summary.get("short_name"):
                            context[f"{step_result['target']}_short_name"] = info_summary["short_name"]
                        step_result["device_snapshot"] = parse_device_snapshot(combined)
                if passed and "--get" in command:
                    read_values = []
                    for index, token in enumerate(command[:-1]):
                        if token != "--get":
                            continue
                        field = command[index + 1]
                        value = parse_get_value(field, combined)
                        if value:
                            read_values.append({
                                "field": field,
                                "value": value,
                                "display_field": display_field(field),
                                "display_value": display_value(field, value),
                            })
                            context[context_value_key(step_result["target"], field)] = value
                    if read_values:
                        step_result["read_values"] = read_values
                        if len(read_values) == 1:
                            step_result["read_value"] = read_values[0]
                if passed and step.get("capture_contact_url_as"):
                    contact_url = parse_contact_url(combined)
                    if contact_url:
                        context[step.get("capture_contact_url_as")] = contact_url
                        step_result["contact_url"] = contact_url
                    else:
                        step_result["status"] = "FAIL"
                        step_result["reason"] = "contact_url_not_found"
                if passed and "--ch-index" in command and "--info" in command:
                    try:
                        channel_index = int(command[command.index("--ch-index") + 1])
                    except (ValueError, IndexError):
                        channel_index = int(step.get("capture_channel_index") or 0)
                    channel_summary = parse_channel_summary(combined, channel_index)
                    channel_name = channel_summary.get("name") or parse_channel_name(combined, channel_index)
                    if channel_name:
                        channel_summary = {"index": channel_index, **channel_summary, "name": channel_name}
                        step_result["channel_summary"] = channel_summary
                        context[f"current:{step_result['target']}:channel:{channel_index}:name"] = channel_name
                        context[f"current:{step_result['target']}:channel:{channel_index}:summary"] = channel_summary
                if passed and step.get("capture_node_id_as"):
                    node_id = info_summary.get("node_id") or node_id_from_my_info(combined)
                    if node_id:
                        context[step.get("capture_node_id_as")] = node_id
                        step_result["captured_node_id"] = node_id
                previous_failed_or_skipped = not passed
                previous_issue_step = "" if passed else step_result["name"]
            except subprocess.TimeoutExpired:
                step_result["status"] = "FAIL"
                step_result["reason"] = "timeout"
                step_result["duration_sec"] = args.timeout
                if step_result["target"] in ("primary", "peer"):
                    context[f"{step_result['target']}:unavailable"] = True
                previous_failed_or_skipped = True
                previous_issue_step = step_result["name"]
            except FileNotFoundError:
                step_result["status"] = "FAIL"
                step_result["reason"] = "meshtastic_cli_not_found"
                previous_failed_or_skipped = True
                previous_issue_step = step_result["name"]
        case_result["steps"].append(step_result)
        write_progress(progress_path, {"event": "step_end", "index": step_index, "total": total_steps, "case_id": case.get("id"), "step": step_result["name"], "target": step_result["target"], "status": step_result["status"], "reason": step_result.get("reason"), "blocked_by": step_result.get("blocked_by"), "read_value": step_result.get("read_value"), "captured_node_id": step_result.get("captured_node_id")})
    return case_result, step_index


def main():
    parser = argparse.ArgumentParser(description="Wio Tracker L2 Meshtastic CLI automation demo")
    parser.add_argument("--cases", default=str(DEFAULT_CASES), help="JSON testcase file")
    parser.add_argument("--meshtastic", default=default_meshtastic_command(), help="meshtastic CLI executable")
    parser.add_argument("--port", help="test device 1 serial port, for example COM31")
    parser.add_argument("--host", help="test device 1 TCP host, for example meshtastic.local")
    parser.add_argument("--ble", help="test device 1 BLE address or name")
    parser.add_argument("--peer-port", help="test device 2 serial port, for example COM32")
    parser.add_argument("--peer-host", help="test device 2 TCP host")
    parser.add_argument("--peer-ble", help="test device 2 BLE address or name")
    parser.add_argument("--dest", help="destination node ID, for example !28979058")
    parser.add_argument("--case", dest="case_filter", action="append", help="case ID to run; can be repeated")
    parser.add_argument("--timeout", type=int, default=60, help="per-command timeout in seconds")
    parser.add_argument("--execute", action="store_true", help="execute real device commands instead of dry-run")
    parser.add_argument("--allow-mutating", action="store_true", help="allow config writes and message sends")
    parser.add_argument("--custom-only", action="store_true", help="only run the custom config write case")
    parser.add_argument("--config-kind", default="field", help="config kind: field/user_name/channel/wifi/region/modem_preset")
    parser.add_argument("--config-json", default="", help="dashboard config JSON")
    parser.add_argument("--config-field", default="", help="config field, for example device.role")
    parser.add_argument("--config-value", default="", help="config value, for example CLIENT")
    parser.add_argument("--config-target", choices=("primary", "peer", "both"), default="primary", help="config target")
    parser.add_argument("--experiment-only", action="store_true", help="only run the communication experiment")
    parser.add_argument("--communication-config-only", action="store_true", help="only apply communication config")
    parser.add_argument("--communication-check-only", action="store_true", help="only check communication config consistency")
    parser.add_argument("--contact-exchange-only", action="store_true", help="only run contact exchange flow")
    parser.add_argument("--experiment-apply-config", action="store_true", help="compatibility flag; communication test no longer writes config automatically")
    parser.add_argument("--experiment-region", default="", help="communication test target lora.region")
    parser.add_argument("--experiment-modem", default="", help="communication test target lora.modem_preset")
    parser.add_argument("--override-frequency", default="", help="lora.override_frequency for the experiment, for example 868 or 868.125; empty means unchanged")
    parser.add_argument("--clear-override-frequency", action="store_true", help="clear lora.override_frequency")
    parser.add_argument("--channel-index", type=int, default=0, help="channel index for config write; 0 is primary")
    parser.add_argument("--channel-name", default="", help="channel name for config write")
    parser.add_argument("--channel-psk", default="", help="channel PSK: none/default/0x.../base64:...")
    parser.add_argument("--message-primary", default="", help="message from test device 1 to test device 2")
    parser.add_argument("--message-peer", default="", help="message from test device 2 to test device 1")
    parser.add_argument("--message-mode", choices=("device", "channel"), default="device", help="communication send mode")
    parser.add_argument("--message-channel", type=int, default=0, help="channel index used for channel send")
    parser.add_argument("--primary-node-id", default="", help="known test device 1 node ID; avoids repeated identity read")
    parser.add_argument("--peer-node-id", default="", help="known test device 2 node ID; avoids repeated identity read")
    parser.add_argument("--reboot-wait", type=int, default=10, help="wait seconds after config write for reboot/apply")
    parser.add_argument("--receive-wait", type=int, default=10, help="wait seconds for channel/message receive")
    parser.add_argument("--step-gap", type=float, default=5, help="protective gap between real device commands in seconds")
    parser.add_argument("--wait-to-disconnect", type=int, default=10, help="seconds for CLI to wait for disconnect after write/send")
    parser.add_argument("--progress-out", help="JSONL progress output file")
    parser.add_argument("--out", help="JSON report output path; default is project logs")
    args = parser.parse_args()

    data = json.loads(Path(args.cases).read_text(encoding="utf-8"))
    connection_args = build_connection_args(args)
    peer_connection_args = build_peer_connection_args(args)
    if args.communication_config_only:
        cases = [communication_config_case(args)]
    elif args.communication_check_only:
        cases = [communication_check_case(args)]
    elif args.experiment_only:
        cases = [communication_experiment_case(args)]
    elif args.contact_exchange_only:
        cases = [contact_exchange_case(args)]
    elif args.custom_only:
        cases = [custom_config_case(args)]
    else:
        cases = list(selected_cases(data, args.case_filter))
    total_steps = sum(len(case.get("steps", [])) for case in cases)
    results = {
        "suite": data.get("suite"),
        "started_at": datetime.now().isoformat(timespec="seconds"),
        "execute": args.execute,
        "connection": connection_args,
        "peer_connection": peer_connection_args,
        "allow_mutating": args.allow_mutating,
        "total_steps": total_steps,
        "cases": [],
    }
    write_progress(args.progress_out, {"event": "run_start", "total": total_steps, "execute": args.execute})
    context = {
        "primary_node_id": normalize_node_id(args.primary_node_id),
        "peer_node_id": normalize_node_id(args.peer_node_id),
    }
    step_index = 0
    for case in cases:
        case_result, step_index = run_case(case, args, connection_args, peer_connection_args, context, args.progress_out, total_steps, step_index)
        results["cases"].append(case_result)

    primary_label = context.get("primary_short_name") or short_node_label(context.get("primary_node_id"))
    peer_label = context.get("peer_short_name") or short_node_label(context.get("peer_node_id"))
    if primary_label or peer_label:
        results = replace_device_names(results, primary_label, peer_label)

    out_path = Path(args.out) if args.out else PROJECT_ROOT / "logs" / f"meshtastic_cli_demo_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    results["finished_at"] = datetime.now().isoformat(timespec="seconds")
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    statuses = [step.get("status") for case in results["cases"] for step in case.get("steps", [])]
    has_fail = any(status == "FAIL" for status in statuses)
    overall_status = "FAIL" if has_fail else "SKIPPED" if any(status == "SKIPPED" for status in statuses) else "DRY_RUN" if any(status == "DRY_RUN" for status in statuses) else "PASS"
    write_progress(args.progress_out, {"event": "run_end", "total": total_steps, "status": overall_status, "report": str(out_path)})
    print(json.dumps({"report": str(out_path), "caseCount": len(results["cases"]), "status": overall_status}, ensure_ascii=False))
    return 1 if has_fail else 0


if __name__ == "__main__":
    sys.exit(main())
