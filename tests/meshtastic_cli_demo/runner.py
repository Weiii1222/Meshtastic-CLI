import argparse
import base64
import contextlib
import copy
import json
import os
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
LOCAL_PYTHON = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe"
SAFE_MESHTASTIC_CLI = Path(__file__).with_name("safe_meshtastic_cli.py")
SENSITIVE_KEYS = ("private_key", "privateKey", "preshared_key", "psk", "wifi_psk", "password", "admin_key", "fixed_pin", "fixedPin", "secret", "complete_url")

DISPLAY_NAMES = {
    "lora.region": "Region",
    "lora.modem_preset": "Modem Preset",
    "lora.use_preset": "Use Preset",
    "lora.override_frequency": "Frequency Override",
    "lora.channel_num": "Channel Number",
    "device.role": "Device Role",
    "device.tzdef": "\u65f6\u533a",
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
    # Prefer the wrapper now that build_command pins .py commands to the
    # project virtualenv. It suppresses DTR/RTS toggles that can reset ESP32
    # USB-CDC boards when opening a serial port.
    if SAFE_MESHTASTIC_CLI.exists():
        return str(SAFE_MESHTASTIC_CLI)
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


def build_observer_connection_args(args):
    """测试设备3（观察者）：只支持串口，因为它要长时间 --listen 抓包。"""
    if getattr(args, "observer_port", ""):
        return ["--port", args.observer_port]
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


def normalize_packet_node_id(value):
    """Normalize packet node fields from Meshtastic events to !xxxxxxxx."""
    if value is None:
        return ""
    if isinstance(value, int):
        return f"!{value:08x}"
    text = str(value).strip().lower()
    if not text:
        return ""
    if text.isdigit():
        return f"!{int(text):08x}"
    return normalize_node_id(text)


def interface_node_id(interface):
    """Read this interface's node id without running another CLI command."""
    my_info = getattr(interface, "myInfo", None)
    for attr in ("my_node_num", "myNodeNum", "node_num", "nodeNum"):
        value = getattr(my_info, attr, None)
        node_id = normalize_packet_node_id(value)
        if node_id:
            return node_id
    return ""


def wait_for_interface_node_id(interface, timeout=8):
    """Wait until Meshtastic Python API has populated this interface's node id."""
    deadline = time.monotonic() + max(0, float(timeout or 0))
    while time.monotonic() < deadline:
        node_id = interface_node_id(interface)
        if node_id:
            return node_id
        time.sleep(0.2)
    return interface_node_id(interface)


def packet_id_value(packet):
    """Return a Meshtastic packet id from protobuf-like or dict packets."""
    if packet is None:
        return ""
    if isinstance(packet, dict):
        return str(packet.get("id", "") or "")
    return str(getattr(packet, "id", "") or "")


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


def decode_public_key(value):
    """Decode Meshtastic base64 public keys from CLI/NodeDB output."""
    text = str(value or "").strip()
    if not text:
        return None
    if text.startswith("base64:"):
        text = text.split(":", 1)[1]
    try:
        return base64.b64decode(text, validate=True)
    except Exception:
        return None


def interface_public_key_for_node(interface, node_id):
    """Read a peer public key from the Python API NodeDB cache."""
    normalized = normalize_node_id(node_id)
    if not normalized:
        return ""
    candidates = []
    nodes = getattr(interface, "nodes", None) or {}
    if isinstance(nodes, dict):
        candidates.extend([
            nodes.get(normalized),
            nodes.get(normalized.lstrip("!")),
            nodes.get(normalized.upper()),
        ])
    node_num = int(normalized[-8:], 16)
    nodes_by_num = getattr(interface, "nodesByNum", None) or {}
    if isinstance(nodes_by_num, dict):
        candidates.extend([nodes_by_num.get(node_num), nodes_by_num.get(str(node_num))])
    for node in candidates:
        if not isinstance(node, dict):
            continue
        user = node.get("user") if isinstance(node.get("user"), dict) else {}
        public_key = user.get("publicKey") or user.get("public_key") or node.get("publicKey") or node.get("public_key")
        if public_key:
            return str(public_key).strip()
    return ""


def known_public_key_for_node(interface, node_id, fallback_public_key=""):
    """Prefer a caller-provided key, then fall back to the interface NodeDB."""
    fallback = str(fallback_public_key or "").strip()
    return fallback or interface_public_key_for_node(interface, node_id)


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


def redact_report_value(value):
    """Recursively redact report text only after execution has completed.

    The runner still needs original values in memory for command evaluation, but
    raw CLI/API output must never be persisted with credentials or keys.
    """
    if isinstance(value, str):
        return redact_sensitive(value)
    if isinstance(value, list):
        return [redact_report_value(item) for item in value]
    if isinstance(value, dict):
        return {key: redact_report_value(item) for key, item in value.items()}
    return value

def short_node_label(node_id):
    compact = (node_id or "").lstrip("!")
    return compact[-4:].lower() if len(compact) >= 4 else ""


def context_target_label(target, context):
    if target == "primary":
        return context.get("primary_short_name") or short_node_label(context.get("primary_node_id")) or "测试设备1"
    if target == "peer":
        return context.get("peer_short_name") or short_node_label(context.get("peer_node_id")) or "测试设备2"
    if target == "observer":
        return context.get("observer_short_name") or short_node_label(context.get("observer_node_id")) or "测试设备3"
    if target == "listener":
        # 监听端是"观察者优先、没有观察者就退回设备2"，实际用了哪一台在记录 listen_diagnostics 时解析。
        return "监听端"
    if target == "both":
        return "两台设备"
    if target == "all":
        return "三台设备"
    return target or "-"


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

def _kill_process_tree(process):
    """Kill the command and its children.

    Windows 上 .venv\\Scripts\\meshtastic.exe 是启动器，会再拉起一个 python 子进程；
    只 kill 启动器会留下孤儿 python 继续占着 COM 口，下一步就会报 could not open port。
    """
    if os.name == "nt":
        with contextlib.suppress(Exception):
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(process.pid)],
                capture_output=True,
                check=False,
            )
    with contextlib.suppress(Exception):
        process.kill()


def _drain_stream(stream, sink):
    """Read a child pipe line by line so a timeout still keeps the partial output."""
    try:
        for line in stream:
            sink.append(line)
    except Exception:
        pass
    finally:
        with contextlib.suppress(Exception):
            stream.close()


def run_command(command, timeout, extra_env=None):
    """Run one CLI command, keeping whatever the CLI printed before a timeout.

    subprocess.run() throws away all captured output when it kills a timed-out
    child, which made every slow write op look like a bare handshake failure.
    Streaming into buffers keeps the evidence ("Connected to radio", "Waiting
    N seconds before disconnecting", ...) even when we have to kill the process.
    """
    started = time.monotonic()
    env = None
    if extra_env:
        env = os.environ.copy()
        env.update({str(key): str(value) for key, value in extra_env.items()})
    stdout_parts = []
    stderr_parts = []
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )
    readers = [
        threading.Thread(target=_drain_stream, args=(process.stdout, stdout_parts), daemon=True),
        threading.Thread(target=_drain_stream, args=(process.stderr, stderr_parts), daemon=True),
    ]
    for reader in readers:
        reader.start()
    timed_out = False
    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        _kill_process_tree(process)
        with contextlib.suppress(Exception):
            process.wait(timeout=10)
    for reader in readers:
        reader.join(timeout=5)
    stdout = "".join(stdout_parts)
    stderr = "".join(stderr_parts)
    duration_sec = round(time.monotonic() - started, 2)
    if timed_out:
        stderr = f"{stderr}\ncommand_timeout_after_{timeout}s".strip()
        return {
            "exit_code": 124,
            "stdout": stdout,
            "stderr": stderr,
            "duration_sec": duration_sec,
            "partial_output": True,
        }
    return {
        "exit_code": process.returncode,
        "stdout": stdout,
        "stderr": stderr,
        "duration_sec": duration_sec,
    }


def official_cli_fallback_command(command):
    """Build an official CLI fallback when the no-reset wrapper cannot handshake."""
    if not LOCAL_MESHTASTIC.exists():
        return []
    parts = [str(part) for part in command]
    safe_path = str(SAFE_MESHTASTIC_CLI).lower()
    for index, part in enumerate(parts):
        if part.lower() == safe_path:
            return [str(LOCAL_MESHTASTIC)] + parts[index + 1:]
    return []


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
        "timed out waiting for connection completion",
        "timed out waiting for packet",
        "no response",
        "reader is dead",
        "protocol",
        "handshake",
        "failed to connect",
        "command_timeout_after_",
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
        "timed out waiting for connection completion",
        "timed out waiting for packet",
        "no response",
        "reader is dead",
        "protocol",
        "handshake",
        "failed to connect",
        "command_timeout_after_",
    )
    return raw.get("exit_code") != 0 and any(marker in combined for marker in markers)


PORT_OPEN_FAILURE_MARKERS = (
    "could not open port",
    "serial device couldn't be opened",
    "access is denied",
    "permissionerror",
    "filenotfounderror",
    "cannot configure port",
    "\u7cfb\u7edf\u627e\u4e0d\u5230\u6307\u5b9a\u7684\u6587\u4ef6",
    "\u62d2\u7edd\u8bbf\u95ee",
)


def is_port_open_failure(raw):
    """True only when the port itself could not be opened (device gone / busy)."""
    combined = f"{raw.get('stdout') or ''}\n{raw.get('stderr') or ''}".lower()
    return raw.get("exit_code") != 0 and any(marker in combined for marker in PORT_OPEN_FAILURE_MARKERS)


def mark_target_unavailable(step_result, context):
    target = step_result.get("target")
    if target not in ("primary", "peer"):
        return
    if step_result.get("mutating") and not is_port_open_failure(step_result):
        # 写操作超时/输出不符不代表端口不可用：必须让随后的校验步骤继续跑，
        # 否则「联系人是否真的写进去」永远无法判断（本轮 3354 导入联系人就是这样被跳过的）。
        return
    if is_connection_unavailable(step_result):
        context[f"{target}:unavailable"] = True
        step_result["reason"] = "connection_unavailable"
        if is_port_open_failure(step_result):
            # 端口直接打不开（系统里可能已经没有这个口）——这跟"设备在但不回话"是两种情况，
            # 最常见的原因是 TRACKER 类角色深睡时 USB-CDC 会断电、端口从系统里消失。
            step_result["failure_note"] = (
                "串口打不开：串口可能已经从系统里消失。常见原因：USB 线松了/设备断电，"
                "或者设备正在深度睡眠——TRACKER 类角色发完位置后会按 position_broadcast_secs 深睡"
                "（固件默认 3600 秒），睡眠期间 USB-CDC 与射频一起断电，端口会消失。"
                "请等设备醒来（按按键唤醒/重新上电）后重跑，或先确认端口号是否变了。"
            )


# 本次运行中已确认「只有 DTR 有效时才会回数据」的串口。
# 例：Wio Tracker L1 Pro 1W 的 USB-CDC 在 DTR 拉低时完全不回数据，no-reset 包装器会一直等到
# 命令超时（实测包装器 34s 报 Connection timed out，断言 DTR 后 4-9s 握手成功）。
# 记录后，后续步骤直接用同一个包装器 + DTR 断言重跑，既省时间也避免官方 CLI 的开合复位序列。
DTR_ASSERT_PORTS: set[str] = set()
DTR_ASSERT_ENV = {"MESHTASTIC_SERIAL_DTR": "1"}


def command_ports(command):
    ports = set()
    parts = [str(part) for part in command]
    for index, part in enumerate(parts):
        if part in ("--port", "--peer-port") and index + 1 < len(parts):
            ports.add(parts[index + 1].strip().upper())
    return ports


def command_uses_safe_wrapper(command):
    safe_path = str(SAFE_MESHTASTIC_CLI).lower()
    return any(str(part).lower() == safe_path for part in command)


def is_handshake_timeout(raw):
    """整条命令超时 / 串口握手始终没完成：属于确定性失败，重试同一条命令没有意义。"""
    if int(raw.get("exit_code") or 0) == 124:
        return True
    combined = f"{raw.get('stdout') or ''}\n{raw.get('stderr') or ''}".lower()
    return any(
        marker in combined
        for marker in ("command_timeout_after_", "timed out waiting for connection completion", "connection timed out")
    )


def official_cli_result(command, timeout, reason=""):
    """最后手段：改用官方 meshtastic CLI 跑同一条命令（会自行开合 DTR/RTS，可能触发设备复位）。"""
    fallback = official_cli_fallback_command(command)
    if not fallback:
        return None
    result = run_command(fallback, timeout)
    result["fallback_transport"] = "official_meshtastic_cli"
    result["fallback_from"] = "safe_no_reset_cli"
    if reason:
        result["fallback_reason"] = reason
    return result


def dtr_state_path():
    return PROJECT_ROOT / "logs" / "serial_dtr_ports.json"


def load_dtr_ports():
    """跨进程记住「必须断言 DTR 才能握手」的串口。

    每个用例都是一次全新的 runner 进程，内存里的 DTR_ASSERT_PORTS 会丢，
    于是每轮第一个步骤都要白等一次必然失败的尝试（实测 COM59 白等约 20s）。
    """
    try:
        data = json.loads(dtr_state_path().read_text(encoding="utf-8"))
    except Exception:
        return set()
    ports = data.get("ports") if isinstance(data, dict) else data
    if not isinstance(ports, list):
        return set()
    return {str(port).strip().upper() for port in ports if str(port).strip()}


def save_dtr_ports():
    with contextlib.suppress(Exception):
        path = dtr_state_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(
                {"ports": sorted(DTR_ASSERT_PORTS), "updated_at": datetime.now().isoformat(timespec="seconds")},
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )


def remember_dtr_ports(ports):
    new_ports = {str(port).strip().upper() for port in ports if str(port).strip()}
    if not new_ports - DTR_ASSERT_PORTS:
        return
    DTR_ASSERT_PORTS.update(new_ports)
    save_dtr_ports()


DTR_HANDSHAKE_MARKERS = (
    # 只认「连接阶段就没握上手」这几句：此时 CLI 还没执行任何写命令，重发不会造成重复写入。
    "connection timed out",
    "timed out waiting for connection completion",
    "failed to connect",
)


def is_dtr_retryable_failure(raw):
    """只有 CLI 自己报的握手失败才算「可以安全重发」。

    我们主动杀掉的命令（exit 124）不算：那时命令可能已经写进去一半，重复写有风险。
    端口打不开（could not open port）也不算：那种情况断言 DTR 救不了。
    """
    if int(raw.get("exit_code") or 0) == 124:
        return False
    combined = f"{raw.get('stdout') or ''}\n{raw.get('stderr') or ''}".lower()
    if any(marker in combined for marker in PORT_OPEN_FAILURE_MARKERS):
        return False
    return any(marker in combined for marker in DTR_HANDSHAKE_MARKERS)


def run_with_transport(command, timeout, allow_dtr_retry=True):
    """按「该串口是否 DTR 依赖」的记忆选择传输方式。

    写操作（配置下发/联系人导入）此前直接调 run_command，绕过了 DTR 记忆，
    在必须断言 DTR 的 L1 Pro / Mesh Tower 上必然以 Connection timed out 收场
    （2026-09-29 18:13 那轮的 --add-contact 就是这样失败的）。
    现在写操作也走这里：已记忆的串口直接带 DTR 断言跑一次；
    未记忆的串口先按原样跑，只有确认是 CLI 自报的握手失败（命令没真正下发）才带 DTR 重试一次。
    """
    use_wrapper = command_uses_safe_wrapper(command)
    ports = command_ports(command)
    if use_wrapper and (ports & DTR_ASSERT_PORTS):
        raw = run_command(command, timeout, extra_env=DTR_ASSERT_ENV)
        raw["transport_variant"] = "safe_no_reset_cli_dtr_asserted"
        return raw
    raw = run_command(command, timeout)
    if allow_dtr_retry and use_wrapper and is_dtr_retryable_failure(raw):
        remember_dtr_ports(ports)
        retry = run_command(command, timeout, extra_env=DTR_ASSERT_ENV)
        retry["transport_variant"] = "safe_no_reset_cli_dtr_asserted"
        retry["transport_retry"] = "dtr_asserted_after_handshake_failure"
        retry["transport_retry_reason"] = (raw.get("stderr") or raw.get("stdout") or "").strip()[-200:]
        return retry
    return raw


def run_command_with_retries(command, timeout, attempts=2, delay_sec=5, allow_fallback=True):
    use_wrapper = command_uses_safe_wrapper(command)
    ports = command_ports(command)
    # 已知该串口需要 DTR 有效：直接带 MESHTASTIC_SERIAL_DTR=1 跑包装器，省掉一次必然超时的尝试。
    dtr_env = DTR_ASSERT_ENV if (use_wrapper and (ports & DTR_ASSERT_PORTS)) else None
    last = None
    for attempt in range(1, max(1, attempts) + 1):
        last = run_command(command, timeout, extra_env=dtr_env)
        last["attempt"] = attempt
        if dtr_env:
            last["transport_variant"] = "safe_no_reset_cli_dtr_asserted"
        if not is_transient_port_error(last):
            return last
        if is_handshake_timeout(last):
            # 包装器握手整体超时：判定该串口为 DTR 依赖型，立刻用断言 DTR 的同一包装器重试一次。
            if use_wrapper and not dtr_env:
                DTR_ASSERT_PORTS.update(ports)
                save_dtr_ports()
                retry = run_command(command, timeout, extra_env=DTR_ASSERT_ENV)
                retry["attempt"] = attempt + 1
                retry["transport_variant"] = "safe_no_reset_cli_dtr_asserted"
                if not is_transient_port_error(retry):
                    return retry
                last = retry
            break
        if attempt < attempts:
            time.sleep(max(0, delay_sec))
    if allow_fallback and last and is_transient_port_error(last):
        time.sleep(max(0, delay_sec))
        fallback_result = official_cli_result(command, timeout, reason="handshake_timeout" if use_wrapper else "")
        if fallback_result is not None:
            fallback_result["attempt"] = int(last.get("attempt") or attempts) + 1
            return fallback_result
    return last or {}


def terminate_process_tree(process):
    if not process or process.poll() is not None:
        return
    if sys.platform.startswith("win"):
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(process.pid)], capture_output=True, text=True, check=False)
    else:
        process.terminate()


def command_env_for_ports(command):
    """包装器命令 + 已知 DTR 依赖串口 → 需要注入的环境变量（否则为 None）。"""
    if command_uses_safe_wrapper(command) and (command_ports(command) & DTR_ASSERT_PORTS):
        return dict(DTR_ASSERT_ENV)
    return None


def merged_env(extra_env):
    env = os.environ.copy()
    # CLI 的 stdout 走管道时是块缓冲，监听进程被 kill 时缓冲里的 `Received:` 行会丢掉，
    # 导致"收到了却判定没收到"的假失败。强制不缓冲，让每一行立刻可见。
    env["PYTHONUNBUFFERED"] = "1"
    if extra_env:
        env.update({str(key): str(value) for key, value in extra_env.items()})
    return env


def run_listen_send_step(args, sender_connection_args, receiver_connection_args, send_command, message, channel, timeout, receive_wait, send_wait_to_disconnect=0, dest=""):
    listen_step_command = ["--listen"] if dest else ["--ch-index", str(channel), "--listen"]
    listen_command = build_command(args.meshtastic, receiver_connection_args, listen_step_command, None, 0)
    # 空 send_command = 只监听（用于观察位置包这类设备自发流量，不需要我们主动发消息）。
    listen_only = not send_command
    send_full_command = [] if listen_only else build_command(args.meshtastic, sender_connection_args, send_command, dest, send_wait_to_disconnect)
    send_timeout = max(int(timeout or 30), int(receive_wait or 0) + int(send_wait_to_disconnect or 0) + 45)
    started = time.monotonic()
    listener = None
    send_result = {"exit_code": 0 if listen_only else 1, "stdout": "", "stderr": "" if listen_only else "listener did not start"}
    listener_stdout = ""
    listener_stderr = ""
    listen_ready_wait = max(4.0, min(8.0, float(getattr(args, "step_gap", 0) or 0) or 4.0))
    try:
        listener = subprocess.Popen(
            listen_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            # 接收端同样要走 DTR 断言模式，否则监听进程永远握不上手、静默收不到消息。
            env=merged_env(command_env_for_ports(listen_command)),
        )
        time.sleep(listen_ready_wait)
        if not listen_only:
            # 发送端是 --sendtext：只用已记忆的 DTR 模式，不自动重发（避免重复消息）。
            send_result = run_with_transport(send_full_command, send_timeout, allow_dtr_retry=False)
        time.sleep(max(0, receive_wait))
    finally:
        if listener:
            terminate_process_tree(listener)
            try:
                listener_stdout, listener_stderr = listener.communicate(timeout=3)
            except subprocess.TimeoutExpired:
                terminate_process_tree(listener)
                listener_stdout, listener_stderr = listener.communicate()
    send_combined = "\n".join([send_result.get("stdout") or "", send_result.get("stderr") or ""])
    listener_combined = "\n".join([listener_stdout or "", listener_stderr or ""])
    combined = "\n".join([send_combined, listener_combined])
    # Only receiver-side listen output proves delivery. Sender stdout contains
    # the message text by design ("Sending text message ...") and must not pass.
    # The CLI --listen path also emits debug/NodeDB logs, so never use a plain
    # substring check: short texts such as "us" can appear inside "user".
    received = listener_has_exact_text(listener_combined, message)
    forbidden = bool(re.search(r"NAK|MAX_RETRANSMIT|error reason|No route|timeout", combined, flags=re.IGNORECASE))
    # 监听端到底有没有握上手：库在收到 my_info/metadata 时会打出来（stdout 或 --debug 的 stderr）。
    listen_connected = bool(
        re.search(r"Connected to radio|Received myinfo|my_info \{|metadata \{|Completed getting", listener_combined)
    )
    relay_records = parse_listen_relay_records(listener_combined, message)
    return {
        "exit_code": 0 if send_result.get("exit_code") == 0 and received and not forbidden else 1,
        "stdout": send_result.get("stdout") or "",
        "stderr": send_result.get("stderr") or "",
        "duration_sec": round(time.monotonic() - started, 2),
        "listen_command": listen_command,
        "listen_stdout": listener_stdout,
        "listen_stderr": listener_stderr,
        "listen_connected": listen_connected,
        "receive_wait": receive_wait,
        "send_timeout": send_timeout,
        "listen_ready_wait": listen_ready_wait,
        "channel_index": channel,
        "received_message": received,
        "listen_only": listen_only,
        "relay_records": relay_records,
        "portnum_records": parse_listen_portnum_records(listener_combined),
        "relayed_message_received": any(record.get("relayed") for record in relay_records),
        "send_command": send_full_command,
    }


def parse_listen_portnum_records(output):
    """记录观察者收到的包类型（portnum），用于位置/遥测等设备自发流量的证据。"""
    records = []
    for line in str(output or "").splitlines():
        if "Received:" not in line and "received:" not in line and "portnum:" not in line:
            continue
        match = re.search(r"['\"]portnum['\"]\s*:\s*['\"]?([A-Z_]{3,})['\"]?", line) or re.search(
            r"portnum:\s*([A-Z_]{3,})", line
        )
        portnum = match.group(1) if match else ""
        if not portnum:
            for known in ("POSITION_APP", "TELEMETRY_APP", "NODEINFO_APP", "TEXT_MESSAGE_APP", "TRACEROUTE_APP", "ROUTING_APP"):
                if known in line:
                    portnum = known
                    break
        if portnum:
            records.append({"portnum": portnum, "line": line.strip()[:400]})
    return records


def parse_listen_protobuf_packets(output, message=""):
    """解析 CLI `--debug` 的 protobuf 文本格式包（`Received from radio: packet { ... }`）。

    真实串口运行里，库默认的 `Received: {json}` 走 stdout（块缓冲，kill 时可能丢），
    而 `--debug` 会把每个包以 protobuf 文本格式打到 stderr，字段是 snake_case
    （hop_limit / hop_start / rx_time / relay_node / portnum / payload）。两种格式都要认，
    否则真机上"确实中继了"也会被判成没中继（假失败）。
    """
    text = str(output or "")
    records = []
    for chunk in text.split("packet {")[1:]:
        block = chunk.split("\n}")[0]
        if message and not listener_has_exact_text(block, message):
            continue

        def grab(name):
            match = re.search(rf"(?m)^\s*{name}:\s*(\d+)\s*$", block)
            return int(match.group(1)) if match else None

        hop_limit = grab("hop_limit")
        hop_start = grab("hop_start")
        portnum_match = re.search(r"(?m)^\s*portnum:\s*([A-Z_]{3,})\s*$", block)
        payload_match = re.search(r'(?m)^\s*payload:\s*"([^"]*)"\s*$', block)
        records.append({
            "id": grab("id"),
            "from": grab("from"),
            "relay_node": grab("relay_node"),
            "hop_limit": hop_limit,
            "hop_start": hop_start,
            "rx_time": grab("rx_time"),
            "relayed": bool(hop_limit is not None and hop_start is not None and hop_start > hop_limit),
            "portnum": portnum_match.group(1) if portnum_match else "",
            "payload": payload_match.group(1) if payload_match else "",
            "format": "protobuf_text",
            "line": block.strip().replace("\n", " ")[:400],
        })
    return records


def parse_listen_relay_records(output, message=""):
    """从 CLI --listen 输出里抽取 hop 信息，用于判断这条消息是否被中继过。

    Meshtastic 每转发一次 hop_limit 减 1（hop_start > hop_limit 即说明被中继），
    因此即使观察者在同一房间能直连发送方，也能用 hop 差区分"直收"和"被转发"。
    同时支持库默认的 JSON 行（`Received: {...}`）和 --debug 的 protobuf 文本格式。
    """
    records = []
    for line in str(output or "").splitlines():
        if "Received:" not in line or "packet {" in line:
            continue
        if message and not listener_has_exact_text(line, message):
            continue

        def grab(name):
            match = re.search(rf"['\"]{name}['\"]\s*:\s*(\d+)", line)
            return int(match.group(1)) if match else None

        hop_limit = grab("hopLimit")
        hop_start = grab("hopStart")
        records.append({
            "id": grab("id"),
            "from": grab("from"),
            "relay_node": grab("relayNode"),
            "hop_limit": hop_limit,
            "hop_start": hop_start,
            # rxTime = 设备收到该包时用自身时钟打的 UTC 秒（校准设备时间用）。
            "rx_time": grab("rxTime"),
            "relayed": bool(hop_limit is not None and hop_start is not None and hop_start > hop_limit),
            "format": "json",
            "line": line.strip()[:400],
        })
    records.extend(parse_listen_protobuf_packets(output, message))
    return records


def listener_has_exact_text(output, message):
    """Return true only when listen output contains a decoded text payload."""
    text = str(message or "")
    if not text:
        return False
    escaped = re.escape(text)
    patterns = [
        rf'(?im)^\s*message:\s*["\']?{escaped}["\']?\s*$',
        rf'(?im)^\s*text:\s*["\']{escaped}["\']\s*$',
        rf'(?im)["\']text["\']\s*:\s*["\']{escaped}["\']',
        rf'(?im)decoded[^\r\n]*text[^\r\n]*["\']{escaped}["\']',
        # --debug 的 protobuf 文本格式：decoded { portnum: TEXT_MESSAGE_APP payload: "标记" }
        rf'(?im)^\s*payload:\s*["\']{escaped}["\']\s*$',
    ]
    return any(re.search(pattern, output or "") for pattern in patterns)


def serial_port_from_connection_args(connection_args):
    if not connection_args or "--port" not in connection_args:
        return ""
    try:
        value = connection_args[connection_args.index("--port") + 1]
    except (ValueError, IndexError):
        return ""
    return str(value or "").strip()


def reset_ack_state(interface):
    """Reset Meshtastic Python API ACK flags before one directed send."""
    acknowledgment = getattr(interface, "_acknowledgment", None)
    if acknowledgment:
        with contextlib.suppress(Exception):
            acknowledgment.reset()


def wait_for_ack_state(interface, timeout):
    """Return the first ACK state observed for a directed message."""
    acknowledgment = getattr(interface, "_acknowledgment", None)
    if not acknowledgment:
        return "unavailable"
    deadline = time.monotonic() + max(0, float(timeout or 0))
    while time.monotonic() < deadline:
        if getattr(acknowledgment, "receivedNak", False):
            reset_ack_state(interface)
            return "nak"
        if getattr(acknowledgment, "receivedAck", False):
            reset_ack_state(interface)
            return "ack"
        if getattr(acknowledgment, "receivedImplAck", False):
            reset_ack_state(interface)
            return "implicit_ack"
        time.sleep(0.2)
    reset_ack_state(interface)
    return "timeout"


def wait_for_received_text(records, lock, target, message, channel, timeout, expected_sender="", expected_recipient="", expected_packet_id=""):
    expected_sender = normalize_node_id(expected_sender)
    expected_recipient = normalize_node_id(expected_recipient)
    expected_packet_id = str(expected_packet_id or "")

    def matched(item):
        if item.get("target") != target:
            return False
        if item.get("text") != message:
            return False
        if int(item.get("channel") or 0) != int(channel or 0):
            return False
        if expected_sender and item.get("from") != expected_sender:
            return False
        if expected_recipient and item.get("to") != expected_recipient:
            return False
        if expected_packet_id and str(item.get("id") or "") != expected_packet_id:
            return False
        return True

    deadline = time.monotonic() + max(0, float(timeout or 0))
    while time.monotonic() < deadline:
        with lock:
            if any(matched(item) for item in records):
                return True
        time.sleep(0.2)
    with lock:
        return any(matched(item) for item in records)


def run_api_dual_send_step(args, primary_connection_args, peer_connection_args, primary_message, peer_message, message_mode, channel, primary_node_id="", peer_node_id="", primary_public_key="", peer_public_key=""):
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
        from safe_meshtastic_cli import install_serial_no_reset_patch

        install_serial_no_reset_patch()
        # 进程内 Python API 也会走同一个 no-reset 补丁；串口已知 DTR 依赖时必须让它断言 DTR，
        # 否则 API 侧会静默连不上（与 CLI 侧 write 步骤同源的问题）。
        if {str(primary_port).upper(), str(peer_port).upper()} & DTR_ASSERT_PORTS:
            os.environ.setdefault("MESHTASTIC_SERIAL_DTR", "1")
        from meshtastic.serial_interface import SerialInterface  # type: ignore[import-untyped]
        from meshtastic.protobuf import portnums_pb2  # type: ignore[import-untyped]

        primary_iface = SerialInterface(primary_port, noNodes=True, timeout=max(3, int(args.timeout or 60)))
        peer_iface = SerialInterface(peer_port, noNodes=True, timeout=max(3, int(args.timeout or 60)))
        receive_timeout = max(3, float(args.receive_wait or 0))
        ready_timeout = min(10, max(4, receive_timeout))
        primary_node_id = normalize_node_id(primary_node_id) or wait_for_interface_node_id(primary_iface, ready_timeout)
        peer_node_id = normalize_node_id(peer_node_id) or wait_for_interface_node_id(peer_iface, ready_timeout)
        primary_public_key = known_public_key_for_node(peer_iface, primary_node_id, primary_public_key)
        peer_public_key = known_public_key_for_node(primary_iface, peer_node_id, peer_public_key)
        primary_public_key_bytes = decode_public_key(primary_public_key)
        peer_public_key_bytes = decode_public_key(peer_public_key)

        def handler(packet, interface):
            decoded = packet.get("decoded") or {}
            text = decoded.get("text") or ""
            if not text:
                return
            target = "primary" if interface is primary_iface else "peer" if interface is peer_iface else "unknown"
            with lock:
                records.append({
                    "id": packet_id_value(packet),
                    "target": target,
                    "text": text,
                    "channel": packet.get("channel", 0),
                    "from": normalize_packet_node_id(packet.get("fromId") or packet.get("from")),
                    "to": normalize_packet_node_id(packet.get("toId") or packet.get("to")),
                })

        pub.subscribe(handler, "meshtastic.receive.text")
        subscription_ready_wait = min(3.0, max(1.2, float(getattr(args, "step_gap", 0) or 0) / 2 if getattr(args, "step_gap", 0) else 1.5))
        time.sleep(subscription_ready_wait)

        channel_index = int(channel or 0)
        primary_ack = "not_required"
        peer_ack = "not_required"
        primary_packet_id = ""
        peer_packet_id = ""

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
            # Public keys are still collected for evidence, but sendText() lets the firmware
            # decide the correct visible text-message path from the destination node.
            reset_ack_state(primary_iface)
            # Use the official high-level text path for private messages. The
            # lower-level sendData(pkiEncrypted=True) path can create API-visible
            # receive events without reliably creating a user-visible chat entry
            # on some firmware/UI combinations.
            primary_packet = primary_iface.sendText(
                primary_message,
                destinationId=normalize_node_id(peer_node_id),
                wantAck=True,
                channelIndex=channel_index,
                onResponse=primary_iface.getNode(normalize_node_id(peer_node_id), False).onAckNak,
            )
            primary_packet_id = packet_id_value(primary_packet)
            primary_ack = wait_for_ack_state(primary_iface, receive_timeout)
        else:
            primary_packet = primary_iface.sendText(primary_message, wantAck=False, channelIndex=channel_index)
            primary_packet_id = packet_id_value(primary_packet)
        peer_received = wait_for_received_text(
            records,
            lock,
            "peer",
            primary_message,
            channel_index,
            args.receive_wait,
            primary_node_id,
            peer_node_id if message_mode == "device" else "",
            "",
        )

        time.sleep(0.5)
        if message_mode == "device":
            reset_ack_state(peer_iface)
            # Keep the peer direction on the same sendText path so both sides use
            # firmware-normal text-message handling and not a hand-built payload.
            peer_packet = peer_iface.sendText(
                peer_message,
                destinationId=normalize_node_id(primary_node_id),
                wantAck=True,
                channelIndex=channel_index,
                onResponse=peer_iface.getNode(normalize_node_id(primary_node_id), False).onAckNak,
            )
            peer_packet_id = packet_id_value(peer_packet)
            peer_ack = wait_for_ack_state(peer_iface, receive_timeout)
        else:
            peer_packet = peer_iface.sendText(peer_message, wantAck=False, channelIndex=channel_index)
            peer_packet_id = packet_id_value(peer_packet)
        primary_received = wait_for_received_text(
            records,
            lock,
            "primary",
            peer_message,
            channel_index,
            args.receive_wait,
            peer_node_id,
            primary_node_id if message_mode == "device" else "",
            "",
        )

        with lock:
            received_messages = list(records)
        # Keep both serial API sessions open long enough for the firmware UI and
        # phone-facing queue to settle. Closing immediately after ACK can make a
        # successful API receive look like "device did not show the message" on
        # slower USB-CDC or freshly awakened devices.
        display_dwell_sec = min(20.0, max(3.0, float(getattr(args, "wait_to_disconnect", 10) or 10)))
        time.sleep(display_dwell_sec)
        direct_ack_ok = message_mode != "device" or (primary_ack == "ack" and peer_ack == "ack")
        received_ok = peer_received and primary_received
        stdout = "\n".join([
            "Persistent Python API serial send",
            f"send_path={'sendText direct' if message_mode == 'device' else 'sendText channel'}",
            f"{primary_port}({primary_node_id or 'unknown'}) -> {peer_port}({peer_node_id or 'unknown'}): {primary_message} packet={primary_packet_id or '-'} received={peer_received} ack={primary_ack}",
            f"{peer_port}({peer_node_id or 'unknown'}) -> {primary_port}({primary_node_id or 'unknown'}): {peer_message} packet={peer_packet_id or '-'} received={primary_received} ack={peer_ack}",
        ])
        return {
            "exit_code": 0 if received_ok and direct_ack_ok else 1,
            "stdout": stdout + "\n",
            "stderr": "",
            "duration_sec": round(time.monotonic() - started, 2),
            "api_transport": "serial_persistent",
            "received_message": received_ok,
            "received_messages": received_messages,
            "sent_messages": [
                {"from": "primary", "to": "peer" if message_mode == "device" else f"channel:{channel_index}", "message": primary_message, "received": peer_received, "ack": primary_ack, "packet_id": primary_packet_id},
                {"from": "peer", "to": "primary" if message_mode == "device" else f"channel:{channel_index}", "message": peer_message, "received": primary_received, "ack": peer_ack, "packet_id": peer_packet_id},
            ],
            "channel_index": channel_index,
            "message_mode": message_mode,
            "primary_ack": primary_ack,
            "peer_ack": peer_ack,
            "primary_public_key_present": bool(primary_public_key_bytes),
            "peer_public_key_present": bool(peer_public_key_bytes),
            "ready_timeout": ready_timeout,
            "subscription_ready_wait": subscription_ready_wait,
            "display_dwell_sec": display_dwell_sec,
            "reason": "api_dual_received" if received_ok and direct_ack_ok else "api_dual_missing_ack" if message_mode == "device" and not direct_ack_ok else "api_dual_missing_receive",
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


RECORDED_TOKEN = re.compile(r"\{recorded:([a-z_]+):([A-Za-z0-9_.]+)\}")


def resolve_context_tokens(tokens, context):
    mapping = {
        "$primary_node_id": context.get("primary_node_id") or "$primary_node_id",
        "$peer_node_id": context.get("peer_node_id") or "$peer_node_id",
        "$primary_contact_url": context.get("primary_contact_url") or "$primary_contact_url",
        "$peer_contact_url": context.get("peer_contact_url") or "$peer_contact_url",
    }
    resolved = [mapping.get(token, token) for token in tokens]
    # {recorded:<target>:<field>} = 用前面 --get 步骤读到的原值做回滚（例如把时区/角色改回去）。
    return [
        RECORDED_TOKEN.sub(
            lambda match: str(context.get(context_value_key(match.group(1), match.group(2))) or ""),
            token,
        )
        for token in resolved
    ]


def missing_recorded_tokens(tokens, context):
    """列出当前无法解析的 {recorded:...} 占位符（原值为空/没读到 → 不能拿空值去写设备）。"""
    missing = []
    for token in tokens:
        for match in RECORDED_TOKEN.finditer(str(token)):
            if not context.get(context_value_key(match.group(1), match.group(2))):
                missing.append(match.group(0))
    return missing


def should_skip(case, step, args, primary_connection_args, peer_connection_args, context, observer_connection_args=None):
    target = step.get("target", "primary")
    if target == "peer":
        active_connection = peer_connection_args
    elif target == "observer":
        active_connection = observer_connection_args
    else:
        active_connection = primary_connection_args
    if step.get("requires_connection") and not active_connection:
        return "missing_connection"
    if step.get("requires_peer") and not peer_connection_args:
        return "missing_peer"
    if step.get("requires_observer") and not observer_connection_args:
        return "missing_observer"
    # requires_listener：观察者没接时可以用测试设备2 当监听端（位置包这类只读观测不需要额外第三台）。
    if step.get("requires_listener") and not (observer_connection_args or peer_connection_args):
        return "missing_listener"
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
    python_exe = str(LOCAL_PYTHON) if LOCAL_PYTHON.exists() else sys.executable
    command = [python_exe, "-B", base_cmd] if str(base_cmd).lower().endswith(".py") else [base_cmd]
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


def active_steps_for_case(case, peer_connection_args, observer_connection_args=None):
    """Build the executable step list for the current hardware count."""
    has_peer = bool(peer_connection_args)
    has_observer = bool(observer_connection_args)
    steps = []
    for step in case.get("steps", []):
        if step.get("requires_peer") and not has_peer:
            continue
        if step.get("requires_observer") and not has_observer:
            continue
        if step.get("requires_listener") and not (has_peer or has_observer):
            continue
        steps.append(step)
    return steps


def adapt_case_for_connections(case, peer_connection_args, observer_connection_args=None):
    """Keep single-device runs from reporting hidden peer/observer steps."""
    adapted = copy.deepcopy(case)
    adapted["steps"] = active_steps_for_case(adapted, peer_connection_args, observer_connection_args)
    # 没有接入测试设备3 时，角色行为观测步骤会被整条剔除；必须在报告里说明 PASS 的覆盖范围，
    # 否则 pass_meaning 仍然写着"观察者收到位置包/中继副本"，读报告的人会误判验证范围。
    had_observer_steps = any(step.get("requires_observer") or step.get("requires_listener") for step in case.get("steps") or [])
    if had_observer_steps and not observer_connection_args:
        if any(step.get("requires_listener") for step in case.get("steps") or []) and peer_connection_args:
            adapted["test_data"] = f"{adapted.get('test_data') or ''} 本次未接入测试设备3，行为观测改用测试设备2 当监听端。"
        else:
            adapted["test_data"] = f"{adapted.get('test_data') or ''} 本次未接入测试设备3（观察者），角色行为观测步骤未执行。"
            adapted["pass_meaning"] = (
                f"{adapted.get('pass_meaning') or ''} 注意：本次未接入测试设备3（观察者），"
                "带 requires_observer 的行为观测步骤已被跳过，PASS 只代表角色写入与读回通过，不代表角色行为已观测。"
            )
    if not peer_connection_args and adapted.get("id") == "MT-PRECHECK-PAIR":
        adapted["source_l2_case"] = "单设备身份 / 通信关键配置 / 频道快照"
        adapted["objective"] = "连接一台设备时，只读取该设备的身份、通信关键配置和频道 0 快照；不执行测试设备2或双设备 NodeDB 检查。"
        adapted["test_data"] = "需要测试设备1连接；只连接一台设备时不要求测试设备2。"
        adapted["pass_meaning"] = "PASS 表示当前设备可被 CLI 控制，并已读取节点 ID、设备名、通信关键配置和频道快照；不代表双设备通信或点对点 ACK 已通过。"
    return adapted


def adapt_cases_for_connections(cases, peer_connection_args, observer_connection_args=None):
    return [adapt_case_for_connections(case, peer_connection_args, observer_connection_args) for case in cases]


def expand_region_public_regression_case(case):
    """Expand declarative US/EU public-channel regressions into a controlled repair flow.

    Only Region is repaired because the case definition only declares a Region target.
    Modem preset, frequency override and channel/PSK remain observable preconditions:
    changing them here would hide an incompatibility instead of testing it.
    """
    region = str(case.get("region_regression_target") or "").strip()
    if not region:
        return case

    adapted = copy.deepcopy(case)
    fields = ["lora.region", "lora.modem_preset", "lora.override_frequency"]
    read_command = []
    for field in fields:
        read_command.extend(["--get", field])
    steps = []

    # Capture both devices before mutation so the report preserves the original state.
    for target, label in (("primary", "测试设备 1"), ("peer", "测试设备 2")):
        steps.append({
            "name": f"读取{label}通信配置",
            "target": target,
            "command": read_command,
            "requires_connection": True,
            "requires_peer": target == "peer",
            "requires_previous_pass": bool(steps),
            "mutating": False,
            "readback_fields": fields,
            "expect_stdout_regex_any": [r"(?i)lora\\.region", r"(?i)lora\\.modem_preset", r"(?i)lora\\.override_frequency"],
            "pass_criteria": f"读取{label}的 Region、Modem Preset 和 Frequency Override 原始值。",
            "action_summary": f"读取{label}通信配置，作为回归前置证据",
        })

    for target, label in (("primary", "测试设备 1"), ("peer", "测试设备 2")):
        group = change_group_key(target, f"serial-region-public-{region}")
        steps.extend([
            {
                "name": f"必要时将{label} Region 修正为 {region}",
                "target": target,
                "command": ["--set", "lora.region", region],
                "requires_connection": True,
                "requires_peer": target == "peer",
                "requires_previous_pass": True,
                "mutating": True,
                "conditional_set_pairs": [("lora.region", region)],
                "change_group": group,
                "retries": 2,
                "retry_delay_sec": 8,
                "expect_stdout_regex_any": [r"(?i)connected|writing|setting|saved|set|reboot"],
                "pass_criteria": f"仅当当前 Region 非 {region} 时下发 lora.region={region}；不修改 Modem Preset 或 Frequency Override。",
                "action_summary": f"必要时修正{label} Region 为 {region}",
            },
            {
                "name": f"等待{label} Region 生效",
                "target": target,
                "sleep_sec": "reboot_wait",
                "requires_previous_pass": True,
                "change_group": group,
                "pass_criteria": "如发生 Region 写入，已等待设备重启和配置生效；未写入时跳过等待。",
                "action_summary": f"等待{label} Region 配置生效",
            },
            {
                "name": f"读回{label}通信配置并确认 Region={region}",
                "target": target,
                "command": read_command,
                "requires_connection": True,
                "requires_peer": target == "peer",
                "requires_previous_pass": True,
                "mutating": False,
                "change_group": group,
                "readback_fields": fields,
                "readback_values": {"lora.region": region},
                "expected_read_values": {"lora.region": region},
                "retries": 4,
                "retry_delay_sec": 8,
                "expect_stdout_regex_any": [r"(?i)lora\\.region"],
                "pass_criteria": f"读回 lora.region={region}；同时刷新 Modem Preset 和 Frequency Override。",
                "action_summary": f"读回{label}通信配置并确认 Region={region}",
            },
        ])

    steps.extend([
        {
            "name": "确认两台设备的通信参数一致",
            "target": "both",
            "compare_config_fields": fields,
            "requires_peer": True,
            "requires_previous_pass": True,
            "pass_criteria": "两台设备 Region、Modem Preset 和 Frequency Override 均一致；不以自动修改掩盖非 Region 配置差异。",
            "action_summary": "比较两台设备最终通信配置",
        },
        {
            "name": "频道 0 双向发送并核对接收",
            "target": "both",
            "api_dual_send": True,
            "message_mode": "channel",
            "channel_index": 0,
            "primary_message": case.get("primary_message") or f"REG-{region}-PUBLIC-A2B",
            "peer_message": case.get("peer_message") or f"REG-{region}-PUBLIC-B2A",
            "requires_connection": True,
            "requires_peer": True,
            "requires_previous_pass": True,
            "mutating": True,
            "pass_criteria": "双方均在当前串口 API 会话收到对方的精确频道 0 文本。",
            "action_summary": f"{region} 公共频道双向通信",
        },
    ])
    adapted["steps"] = steps
    return adapted


def expand_regression_cases(cases):
    return [expand_region_public_regression_case(case) for case in cases]



def target_names(config_target):
    mapping = {
        "primary": [("primary", "\u6d4b\u8bd5\u8bbe\u59071")],
        "peer": [("peer", "\u6d4b\u8bd5\u8bbe\u59072")],
        "observer": [("observer", "\u6d4b\u8bd5\u8bbe\u59073")],
        "both": [("primary", "\u6d4b\u8bd5\u8bbe\u59071"), ("peer", "\u6d4b\u8bd5\u8bbe\u59072")],
        "all": [("primary", "\u6d4b\u8bd5\u8bbe\u59071"), ("peer", "\u6d4b\u8bd5\u8bbe\u59072"), ("observer", "\u6d4b\u8bd5\u8bbe\u59073")],
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
                steps.extend(config_set_many_steps(target, label, pairs, readback_extra_fields=["bluetooth.enabled"]))
        elif args.config_kind == "region":
            region = str(payload.get("region") or args.config_value or "").strip()
            override_frequency = str(payload.get("overrideFrequency", "0")).strip() or "0"
            steps.extend(config_set_many_steps(target, label, [("lora.region", region), ("lora.override_frequency", override_frequency)]))
        elif args.config_kind == "modem_preset" and args.config_field == "lora.modem_preset":
            steps.extend(config_set_many_steps(target, label, [(args.config_field, args.config_value), ("lora.use_preset", "true")]))
        else:
            steps.extend(config_set_get_steps(target, label, args.config_field, args.config_value))
    return {
        "id": "MT-CUSTOM-CONFIG",
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
        "id": "MT-COMM-CONFIG",
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
        "requires_peer": True,
        "requires_previous_pass": True,
        "pass_criteria": "\u4e24\u53f0\u8bbe\u5907 Region / Modem Preset / Frequency Override \u4e00\u81f4\uff1bUse Preset \u4f5c\u4e3a\u8f85\u52a9\u5224\u65ad\u3002",
        "action_summary": "\u5bf9\u6bd4\u4e24\u53f0\u8bbe\u5907\u901a\u4fe1\u914d\u7f6e\u662f\u5426\u4e00\u81f4",
    })
    return {
        "id": "MT-COMM-CHECK",
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
            # 联系人写入走 admin 通道，不依赖本地 NodeDB；去掉完整 NodeDB 下载后
            # COM59 的连接开销从 10-22s 降到 ~5s，再叠加 CLI 强制的 --wait-to-disconnect 10s。
            "command": ["--no-nodes", "--add-contact", "$peer_contact_url"],
            "timeout": 90,
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
            "command": ["--no-nodes", "--add-contact", "$primary_contact_url"],
            "timeout": 90,
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
            # 完整 NodeDB 读取在 L1 Pro/Mesh Tower 上要 10-22s，30s 预算太紧。
            "timeout": 60,
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
            # 完整 NodeDB 读取在 L1 Pro/Mesh Tower 上要 10-22s，30s 预算太紧。
            "timeout": 60,
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
            "retries": 2,
            "retry_delay_sec": 8,
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
            "retries": 4,
            "retry_delay_sec": 8,
            "pass_criteria": f"{label} \u8bfb\u56de {name} \u4e0e\u5199\u5165\u503c\u4e00\u81f4: {display_target_value}",
            "expect_stdout_regex_any": expected_read_patterns(field, value),
            "action_summary": f"\u8bfb\u56de{label}\u914d\u7f6e {name}",
        },
    ]


def config_set_many_steps(target, label, pairs, readback_extra_fields=None):
    group = change_group_key(target, "|".join(field for field, _ in pairs))
    set_command = []
    get_command = []
    for field, value in pairs:
        set_command.extend(["--set", field, value])
        get_command.extend(["--get", field])
    names = ", ".join(f"{display_field(field)}={display_value(field, value)}" for field, value in pairs)
    sensitive = any(any(key.lower() in field.lower() for key in SENSITIVE_KEYS) for field, _ in pairs)
    fields = [field for field, _ in pairs]
    readback_fields = list(fields)
    for field in readback_extra_fields or []:
        if field and field not in readback_fields:
            readback_fields.append(field)
            get_command.extend(["--get", field])
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
        "readback_fields": readback_fields,
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
        "retries": 2,
        "retry_delay_sec": 8,
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
        "readback_fields": readback_fields,
        "readback_values": readback_values,
        "retries": 4,
        "retry_delay_sec": 8,
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
    send_wait_to_disconnect = int(getattr(args, "wait_to_disconnect", 10) or 10)
    primary_send_command = ["--sendtext", primary_message, "--ack"]
    peer_send_command = ["--sendtext", peer_message, "--ack"]
    primary_dest = "peer_node_id"
    peer_dest = "primary_node_id"
    send_expect = []
    send_fail = ["NAK|MAX_RETRANSMIT|error reason|No route|timeout|Timed out waiting"]
    send_criteria = "\u53d1\u9001\u540e\uff0c\u5bf9\u7aef\u76d1\u542c\u8f93\u51fa\u5fc5\u987b\u770b\u5230\u540c\u4e00\u6761\u6d88\u606f\uff1b\u53ea\u770b\u5230 Sending/Connected/ACK \u4e0d\u7b97\u901a\u8fc7\u3002"
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
            # 完整 NodeDB 读取在 L1 Pro/Mesh Tower 上要 10-22s，30s 预算太紧。
            "timeout": 60,
            "requires_connection": True,
            "requires_peer": True,
            "expect_node_from": "peer_node_id",
            "optional_visibility": True,
            "pass_criteria": "\u6d4b\u8bd5\u8bbe\u59071 NodeDB \u4e2d\u80fd\u770b\u5230\u6d4b\u8bd5\u8bbe\u59072\u8282\u70b9 ID\u3002NodeDB \u53ef\u89c1\u4e0d\u7b49\u4e8e\u6d88\u606f ACK\u3002",
            "expect_stdout_regex": ["Connected to radio"],
            "expect_stdout_regex_any": ["Nodes|User|AKA|ID|last heard|LastHeard|num"],
            "action_summary": "\u8bfb\u53d6\u6d4b\u8bd5\u8bbe\u59071 NodeDB",
        },
        {
            "name": "\u786e\u8ba4\u6d4b\u8bd5\u8bbe\u59072 NodeDB \u5305\u542b\u6d4b\u8bd5\u8bbe\u59071",
            "target": "peer",
            "command": ["--nodes"],
            # 完整 NodeDB 读取在 L1 Pro/Mesh Tower 上要 10-22s，30s 预算太紧。
            "timeout": 60,
            "requires_connection": True,
            "requires_peer": True,
            "expect_node_from": "primary_node_id",
            "optional_visibility": True,
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
            "listen_send": True,
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
            "wait_to_disconnect": send_wait_to_disconnect,
        },
        {
            "name": f"\u6d4b\u8bd5\u8bbe\u59072\u53d1\u5230\u9891\u9053 {message_channel}" if message_mode == "channel" else "\u6d4b\u8bd5\u8bbe\u59072\u53d1\u7ed9\u6d4b\u8bd5\u8bbe\u59071",
            "target": "peer",
            "command": peer_send_command,
            "listen_send": True,
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
            "wait_to_disconnect": send_wait_to_disconnect,
        },
    ]
    direct_cli_steps = [
        {
            "name": "\u6d4b\u8bd5\u8bbe\u59071\u53d1\u7ed9\u6d4b\u8bd5\u8bbe\u59072",
            "target": "primary",
            "command": primary_send_command,
            "requires_connection": True,
            "requires_peer": True,
            "dest_from": primary_dest,
            "mutating": True,
            "requires_message": "primary",
            "pass_criteria": "\u53d1\u9001\u7aef\u547d\u4ee4\u5fc5\u987b\u83b7\u5f97\u5bf9\u7aef ACK\uff1b\u4e0d\u540c\u65f6\u5360\u7528\u63a5\u6536\u7aef\u4e32\u53e3\uff0c\u4ee5\u51cf\u5c11\u811a\u672c\u76d1\u542c\u4f1a\u8bdd\u5bf9\u8bbe\u5907 UI \u6d88\u606f\u663e\u793a\u7684\u5e72\u6270\u3002",
            "expect_stdout_regex_any": ["Received an ACK|ACK|Sending text message"],
            "fail_on_regex": send_fail,
            "action_summary": "\u6d4b\u8bd5\u8bbe\u59071\u5355\u6b21\u53d1\u9001\u70b9\u5bf9\u70b9\u6d88\u606f\uff0c\u53d1\u9001\u540e\u7acb\u5373\u91ca\u653e\u4e32\u53e3",
            "direction": "\u6d4b\u8bd5\u8bbe\u59071 -> \u6d4b\u8bd5\u8bbe\u59072",
            "message": primary_message,
            "wait_to_disconnect": send_wait_to_disconnect,
        },
        {
            "name": "\u6d4b\u8bd5\u8bbe\u59072\u53d1\u7ed9\u6d4b\u8bd5\u8bbe\u59071",
            "target": "peer",
            "command": peer_send_command,
            "requires_connection": True,
            "requires_peer": True,
            "dest_from": peer_dest,
            "mutating": True,
            "requires_message": "peer",
            "pass_criteria": "\u53d1\u9001\u7aef\u547d\u4ee4\u5fc5\u987b\u83b7\u5f97\u5bf9\u7aef ACK\uff1b\u4e0d\u540c\u65f6\u5360\u7528\u63a5\u6536\u7aef\u4e32\u53e3\uff0c\u4ee5\u51cf\u5c11\u811a\u672c\u76d1\u542c\u4f1a\u8bdd\u5bf9\u8bbe\u5907 UI \u6d88\u606f\u663e\u793a\u7684\u5e72\u6270\u3002",
            "expect_stdout_regex_any": ["Received an ACK|ACK|Sending text message"],
            "fail_on_regex": send_fail,
            "action_summary": "\u6d4b\u8bd5\u8bbe\u59072\u5355\u6b21\u53d1\u9001\u70b9\u5bf9\u70b9\u6d88\u606f\uff0c\u53d1\u9001\u540e\u7acb\u5373\u91ca\u653e\u4e32\u53e3",
            "direction": "\u6d4b\u8bd5\u8bbe\u59072 -> \u6d4b\u8bd5\u8bbe\u59071",
            "message": peer_message,
            "wait_to_disconnect": send_wait_to_disconnect,
        },
    ]
    channel_cli_steps = [
        {
            "name": f"\u6d4b\u8bd5\u8bbe\u59071\u53d1\u5230\u9891\u9053 {message_channel}",
            "target": "primary",
            "command": primary_send_command,
            "requires_connection": True,
            "mutating": True,
            "requires_message": "primary",
            # Keep the peer serial port free during channel sends. Holding a
            # receiver-side CLI listen session open can consume radio events in
            # the Python client path and mask the device UI/chat behavior that
            # this test is meant to validate.
            "pass_criteria": f"\u6d4b\u8bd5\u8bbe\u59071\u5c06\u6d88\u606f\u4e0b\u53d1\u5230\u9891\u9053 {message_channel}\uff1b\u4e0d\u5360\u7528\u63a5\u6536\u7aef\u4e32\u53e3\uff0c\u8bbe\u5907\u5c4f\u5e55/\u804a\u5929\u6846\u53ef\u89c1\u6027\u7531\u5b9e\u673a\u89c2\u5bdf\u786e\u8ba4\u3002",
            "expect_stdout_regex_any": ["Sending text message|Received an implicit ACK|Connected|Sent|Done|Complete"],
            "fail_on_regex": send_fail,
            "action_summary": f"\u6d4b\u8bd5\u8bbe\u59071\u53d1\u9001\u6d88\u606f\u5230\u9891\u9053 {message_channel}\uff0c\u63a5\u6536\u7aef\u4e32\u53e3\u4fdd\u6301\u91ca\u653e",
            "direction": f"\u6d4b\u8bd5\u8bbe\u59071 -> \u9891\u9053 {message_channel}",
            "message": primary_message,
            "message_mode": "channel",
            "wait_to_disconnect": send_wait_to_disconnect,
        },
        {
            "name": f"\u6d4b\u8bd5\u8bbe\u59072\u53d1\u5230\u9891\u9053 {message_channel}",
            "target": "peer",
            "command": peer_send_command,
            "requires_connection": True,
            "requires_peer": True,
            "mutating": True,
            "requires_message": "peer",
            "pass_criteria": f"\u6d4b\u8bd5\u8bbe\u59072\u5c06\u6d88\u606f\u4e0b\u53d1\u5230\u9891\u9053 {message_channel}\uff1b\u4e0d\u5360\u7528\u63a5\u6536\u7aef\u4e32\u53e3\uff0c\u8bbe\u5907\u5c4f\u5e55/\u804a\u5929\u6846\u53ef\u89c1\u6027\u7531\u5b9e\u673a\u89c2\u5bdf\u786e\u8ba4\u3002",
            "expect_stdout_regex_any": ["Sending text message|Received an implicit ACK|Connected|Sent|Done|Complete"],
            "fail_on_regex": send_fail,
            "action_summary": f"\u6d4b\u8bd5\u8bbe\u59072\u53d1\u9001\u6d88\u606f\u5230\u9891\u9053 {message_channel}\uff0c\u63a5\u6536\u7aef\u4e32\u53e3\u4fdd\u6301\u91ca\u653e",
            "direction": f"\u6d4b\u8bd5\u8bbe\u59072 -> \u9891\u9053 {message_channel}",
            "message": peer_message,
            "message_mode": "channel",
            "wait_to_disconnect": send_wait_to_disconnect,
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
        "pass_criteria": "\u4e24\u4e2a\u4e32\u53e3 Python API \u4f1a\u8bdd\u90fd\u5fc5\u987b\u6536\u5230 meshtastic.receive.text \u4e8b\u4ef6\uff0c\u4e14 decoded.text \u4e0e\u7528\u6237\u8f93\u5165\u6d88\u606f\u5b8c\u5168\u4e00\u81f4\uff1b\u53ea\u6709\u53d1\u9001\u547d\u4ee4\u6210\u529f\u6216 ACK \u4e0d\u7b97\u901a\u8fc7\u3002\u8bbe\u5907\u5c4f\u5e55/\u804a\u5929\u6846\u53ef\u89c1\u6027\u9700\u8981\u8bbe\u5907\u4e32\u53e3\u65e5\u5fd7\u7684 Received text msg / DeviceUI newMessage \u4f5c\u4e8c\u7ea7\u8bc1\u636e\u3002",
        "action_summary": "\u7528 Python API \u540c\u65f6\u4fdd\u6301\u4e24\u4e2a\u4e32\u53e3\u8fde\u63a5\uff0c\u6309 decoded.text \u5b8c\u5168\u5339\u914d\u5b8c\u6210\u53cc\u5411\u53d1\u9001\u548c\u63a5\u6536\u5224\u5b9a\u3002",
        "direction": f"device1 <-> device2; mode={message_mode}; channel={message_channel}",
        "message": primary_message,
        "primary_message": primary_message,
        "peer_message": peer_message,
        "message_mode": message_mode,
        "channel_index": int(message_channel),
        "wait_to_disconnect": 0,
    }
    single_channel_step = {
        "name": f"\u6d4b\u8bd5\u8bbe\u59071\u53d1\u5230\u9891\u9053 {message_channel}",
        "target": "primary",
        "command": ["--ch-index", message_channel, "--sendtext", primary_message],
        "requires_connection": True,
        "mutating": True,
        "requires_message": "primary",
        "pass_criteria": f"\u5355\u8bbe\u5907\u573a\u666f\u53ea\u9a8c\u8bc1\u6d88\u606f\u5df2\u901a\u8fc7\u6d4b\u8bd5\u8bbe\u59071\u4e0b\u53d1\u5230\u9891\u9053 {message_channel}\uff1b\u6ca1\u6709\u7b2c\u4e8c\u53f0\u76d1\u542c\u8bbe\u5907\u65f6\u4e0d\u5224\u5b9a\u7a7a\u53e3\u63a5\u6536\u3002",
        "expect_stdout_regex_any": ["Sending text message|Connected|Sent|Done|Complete"],
        "fail_on_regex": ["NAK|MAX_RETRANSMIT|error reason|No route|timeout|Timed out waiting"],
        "action_summary": f"\u6d4b\u8bd5\u8bbe\u59071\u53d1\u9001\u6d88\u606f\u5230\u9891\u9053 {message_channel}\uff0c\u5355\u8bbe\u5907\u4e0d\u505a\u63a5\u6536\u7aef\u5224\u5b9a",
        "direction": f"\u6d4b\u8bd5\u8bbe\u59071 -> \u9891\u9053 {message_channel}",
        "message": primary_message,
        "wait_to_disconnect": send_wait_to_disconnect,
    }
    primary_node_id = normalize_node_id(args.primary_node_id)
    peer_node_id = normalize_node_id(args.peer_node_id)
    known_device_ids = bool(primary_node_id and peer_node_id and primary_node_id != peer_node_id)
    has_peer_connection = bool(args.peer_port or args.peer_host or args.peer_ble)
    if message_mode == "channel" and not has_peer_connection:
        steps = [single_channel_step]
    elif message_mode == "device":
        # For user-visible direct messages, do not keep a receiver-side serial
        # listener open. Recent evidence showed ACK/text events in the Python API
        # while the device UI did not show the chat message. Sequential CLI sends
        # are closer to the official CLI path and release each port after send.
        steps = direct_cli_steps if known_device_ids else identity_steps + direct_cli_steps
    else:
        # Channel communication is a device-visible workflow: keep the peer
        # serial port free instead of using a receiver-side CLI listener.
        steps = channel_cli_steps
    return {
        "id": "MT-COMM-EXPERIMENT",
        "module": "\u901a\u4fe1\u9a8c\u8bc1",
        "source_l2_case": "\u9891\u9053\u901a\u4fe1" if message_mode == "channel" else "\u70b9\u5bf9\u70b9\u53cc\u5411\u901a\u4fe1",
        "objective": "\u5728\u4e24\u53f0\u8bbe\u5907\u901a\u4fe1\u914d\u7f6e\u4e00\u81f4\u7684\u524d\u63d0\u4e0b\uff0c\u9a8c\u8bc1\u9891\u9053\u53d1\u9001\u6216\u70b9\u5bf9\u70b9\u53cc\u5411\u6d88\u606f\u662f\u5426\u771f\u6b63\u88ab\u5bf9\u7aef\u6536\u5230\u3002",
        "test_data": f"message_mode={message_mode}; channel={message_channel}; primary_message={primary_message or 'empty'}; peer_message={peer_message or 'empty'}",
        "pass_meaning": "\u901a\u4fe1\u7528\u4f8b\u5df2\u6309\u5f53\u524d\u53d1\u9001\u65b9\u5f0f\u5b8c\u6210\u3002\u9891\u9053\u6a21\u5f0f\u4e0d\u5360\u7528\u63a5\u6536\u7aef\u4e32\u53e3\uff0c\u53ea\u786e\u8ba4\u53d1\u9001\u547d\u4ee4\u5df2\u4e0b\u53d1\u5230\u5bf9\u5e94\u9891\u9053\uff0c\u8bbe\u5907\u5c4f\u5e55/\u804a\u5929\u6846\u662f\u5b9e\u673a\u89c2\u5bdf\u70b9\u3002\u70b9\u5bf9\u70b9\u6a21\u5f0f\u8981\u6c42\u5bf9\u7aef ACK\uff0c\u5e76\u91ca\u653e\u63a5\u6536\u7aef\u4e32\u53e3\u4ee5\u4fdd\u7559\u8bbe\u5907 UI \u6d88\u606f\u663e\u793a\u3002",
        "failure_help": "\u5931\u8d25\u65f6\u4f18\u5148\u68c0\u67e5\u9891\u9053/PSK\u3001Region\u3001Frequency Override\u3001Modem Preset \u662f\u5426\u4e00\u81f4\uff1b\u70b9\u5bf9\u70b9\u6a21\u5f0f\u8fd8\u8981\u786e\u8ba4\u4e24\u53f0\u8bbe\u5907\u5df2\u4ea4\u6362\u8054\u7cfb\u4eba\u516c\u94a5\u3002",
        "risk": "mutating",
        "steps": steps,
    }

def run_case(case, args, connection_args, peer_connection_args, context, progress_path=None, total_steps=0, step_index=0, observer_connection_args=None):
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
        skip_reason = should_skip(case, step, args, connection_args, peer_connection_args, context, observer_connection_args)
        if not skip_reason and args.execute and step.get("requires_connection") and step_target in ("primary", "peer", "observer") and context.get(f"{step_target}:unavailable"):
            skip_reason = f"target_unavailable:{step_target}"
        blocked_by = ""
        if not skip_reason and step.get("requires_previous_pass") and previous_failed_or_skipped:
            skip_reason = "dependency_not_run"
        if skip_reason == "dependency_not_run" and not args.execute:
            # 干跑不会产生 PASS，依赖链在预览里没有意义；否则前置比对步骤会把后面整串步骤都标成 SKIPPED。
            skip_reason = None
        if not skip_reason:
            missing_recorded = missing_recorded_tokens(list(step.get("command", [])), context)
            if missing_recorded:
                # 原始值是空的（例如设备从来没设过时区）→ 不能拿空串去写设备，直接跳过并说明原因。
                skip_reason = "recorded_value_empty"
                step["recorded_missing"] = missing_recorded
            blocked_by = previous_issue_step
        if step.get("target") == "peer":
            step_connection_args = peer_connection_args
        elif step.get("target") == "observer":
            step_connection_args = observer_connection_args
        else:
            step_connection_args = connection_args
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
        elif not args.execute and step.get("conditional_set_pairs") and not step.get("command"):
            # 干跑预览：把「仅当值不同才写」的条件写展开成命令，避免预览里出现一条空命令。
            step_command = []
            for field, desired in step.get("conditional_set_pairs") or []:
                step_command.extend(["--set", field, desired])
        wait_to_disconnect = int(step.get("wait_to_disconnect", args.wait_to_disconnect if step.get("mutating") else 0) or 0)
        # 写操作（联系人导入/配置下发）要多付「完整连接 + --wait-to-disconnect 睡眠」的开销，
        # 允许单个步骤覆盖 --timeout，避免只读步骤的 30s 预算把写步骤掐死在半路。
        step_timeout = int(step.get("timeout") or args.timeout)
        command = step_command if is_api_dual_send_step else [] if (is_sleep_step or is_compare_step) else build_command(args.meshtastic, step_connection_args, step_command, step_dest if (case.get("requires_dest") or step.get("dest_from")) else None, wait_to_disconnect)
        step_result = {
            "name": step.get("name"),
            "target": step.get("target", "primary"),
            "target_label": context_target_label(step.get("target", "primary"), context),
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
            "listen_target_label": context_target_label(step.get("listen_target"), context) if step.get("listen_target") else "",
            "api_dual_send": is_api_dual_send_step,
            "index": step_index,
            "total": total_steps,
        }
        write_progress(progress_path, {"event": "step_start", "index": step_index, "total": total_steps, "case_id": case.get("id"), "step": step_result["name"], "target": step_result["target"], "command": command_text(command)})
        if skip_reason:
            step_result["status"] = "SKIPPED"
            step_result["reason"] = skip_reason
            if step.get("recorded_missing"):
                step_result["notes"] = (
                    f"原值为空（{', '.join(step['recorded_missing'])}），没有可回滚的值，已跳过写入。"
                )
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
                unreadable = []
                for field in step.get("compare_config_fields") or []:
                    primary_value = context.get(context_value_key("primary", field))
                    peer_value = context.get(context_value_key("peer", field))
                    # 两边都读不到时不能当成"一致"，否则前置一致性检查会假 PASS。
                    if primary_value in (None, "") or peer_value in (None, ""):
                        unreadable.append(display_field(field))
                        continue
                    if not compare_config_values(field, primary_value, peer_value):
                        mismatches.append(f"{display_field(field)}: {display_value(field, primary_value) or '-'} != {display_value(field, peer_value) or '-'}")
                if unreadable:
                    step_result["status"] = "FAIL"
                    step_result["reason"] = "config_unreadable"
                    step_result["mismatch_summary"] = [f"{field}: 未能读到有效值" for field in unreadable]
                elif mismatches:
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
                context.get("primary_public_key"),
                context.get("peer_public_key"),
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
                listen_target = step.get("listen_target") or "peer"
                resolved_listen_target = listen_target
                if listen_target == "observer":
                    receiver_connection_args = observer_connection_args
                elif listen_target == "listener":
                    # 观察者没接就退回测试设备2 当监听端（位置包这类只读观测不需要第三台）。
                    receiver_connection_args = observer_connection_args or peer_connection_args
                    resolved_listen_target = "observer" if observer_connection_args else "peer"
                elif listen_target == "peer":
                    receiver_connection_args = peer_connection_args
                else:
                    receiver_connection_args = connection_args
                wait_before_device_command(command, args)
                raw = run_listen_send_step(
                    args,
                    step_connection_args,
                    receiver_connection_args,
                    step_command,
                    step.get("message") or "",
                    step.get("channel_index") or args.message_channel,
                    step_timeout,
                    int(step.get("receive_wait") or args.receive_wait),
                    int(step.get("wait_to_disconnect", 0) or 0),
                    step_dest if (case.get("requires_dest") or step.get("dest_from")) else "",
                )
                relayed = bool(raw.get("relayed_message_received"))
                portnums = {record.get("portnum") for record in raw.get("portnum_records") or []}
                expected_portnum = str(step.get("listen_expect_portnum") or "").upper()
                device_time_check = step.get("listen_expect_device_time")
                copies = raw.get("relay_records") or []
                direct_copies = [record for record in copies if not record.get("relayed")]
                relayed_copies = [record for record in copies if record.get("relayed")]
                window_sec = int(step.get("receive_wait") or args.receive_wait)
                raw["listen_diagnostics"] = {
                    "listener_target": resolved_listen_target,
                    "listener_label": context_target_label(resolved_listen_target, context),
                    "listener_connected": bool(raw.get("listen_connected")),
                    "window_sec": window_sec,
                    "copies_seen": len(copies),
                    "direct_copies": len(direct_copies),
                    "relayed_copies": len(relayed_copies),
                    "portnums": sorted(value for value in portnums if value),
                    "hop_pairs": [f"{record.get('hop_start')}->{record.get('hop_limit')}" for record in copies][:8],
                }
                failure_note = ""
                if step.get("expect_no_receive"):
                    # 负向断言：监听窗口内不该收到这条消息（例如 CLIENT_MUTE 不转发）。
                    if raw.get("received_message"):
                        passed, reason = False, "unexpected_receive"
                        failure_note = (
                            "监听端收到了这条消息。若是「必须不转发」的角色（CLIENT_MUTE），"
                            "先看 relay_records：出现了 hop 递减副本说明有节点在转发（可能是观察者/第三方节点，不是被测设备）。"
                        )
                    else:
                        passed, reason = True, "no_receive_confirmed"
                elif device_time_check:
                    # 用设备自己给收到的包打的 rxTime（设备时钟，UTC 秒）判断"设备时间和实际时间是否一致"。
                    tolerance = int(step.get("listen_time_tolerance_sec") or 180)
                    now = time.time()
                    stamps = [record.get("rx_time") for record in raw.get("relay_records") or [] if record.get("rx_time")]
                    raw["device_time"] = {
                        "host_epoch": int(now),
                        "tolerance_sec": tolerance,
                        "device_epoch": stamps[-1] if stamps else None,
                        "samples": stamps[-5:],
                    }
                    if not stamps:
                        passed, reason = False, "device_time_not_observed"
                        failure_note = (
                            "监听端（被测设备）在窗口内没收到任何带时间戳的包，读不到设备时钟。"
                            "先确认两台设备频道/PSK 与 LoRa 参数一致、距离足够；rx_time 需要设备收到包才会被打上。"
                        )
                    elif abs(int(stamps[-1]) - now) <= tolerance:
                        passed, reason = True, "device_time_matches_host"
                    else:
                        passed, reason = False, f"device_time_skew:{int(stamps[-1] - now)}s"
                        failure_note = (
                            f"设备时钟与主机相差 {int(stamps[-1] - now)} 秒（超过容差 {tolerance} 秒）："
                            "说明设备没有接受 --set-time 或时钟没有保持。报告里的 device_time 保留了主机时间与设备时间。"
                        )
                elif step.get("listen_expect_relayed") and not relayed:
                    if not copies:
                        passed, reason = False, "no_copy_observed"
                        failure_note = (
                            "观察窗口内连这条消息的直收副本都没有看到 —— 这通常不是角色问题，"
                            "而是接收链路问题：先核对发送方与监听端的频道/PSK、区域/预设、距离与天线，"
                            "以及发送方 --sendtext 是否真的发出（看本步骤 stdout）。"
                            f"监听端连接状态：{'已握手' if raw.get('listen_connected') else '未确认握手'}。"
                        )
                    else:
                        passed, reason = False, "relayed_copy_not_observed"
                        failure_note = (
                            f"收到了 {len(direct_copies)} 个直收副本，但没有任何 hop 递减副本"
                            f"（hop 记录：{', '.join(raw['listen_diagnostics']['hop_pairs']) or '-'}）。"
                            "说明这条消息没有被中继：检查被测设备角色是否已生效（上一步读回）、"
                            "hop_limit 是否 > 0、以及被测设备是否因为「已经听到发送方直发」而取消了重播。"
                        )
                elif step.get("listen_expect_not_relayed") and relayed:
                    passed, reason = False, "relayed_copy_observed"
                    failure_note = (
                        "出现了 hop 递减副本（本不该有）。先按 relay_records 的 relay_node/from 判断是谁中继的："
                        "可能是监听端自己、或环境里的第三方 Meshtastic 节点，再怀疑被测设备。"
                    )
                elif expected_portnum and expected_portnum not in portnums:
                    passed, reason = False, "expected_portnum_not_observed"
                    failure_note = (
                        f"窗口内没有收到 {expected_portnum}。已收到的包类型：{', '.join(sorted(value for value in portnums if value)) or '无'}。"
                        "位置类包需要被测设备有位置来源（--setlat/--setlon 或 GPS）且两台设备同频道、PSK 一致。"
                    )
                elif step.get("listen_evidence_only"):
                    # 只记录观察窗口里的流量证据，不判定通过/失败（长周期行为的观测窗口）。
                    # 但「发送命令本身」的期望必须先算：例如「写角色 TRACKER」这一步同时开监听窗口，
                    # 写入失败时不能因为"窗口里没包不算失败"就一起放过（那会造成假 PASS）。
                    command_ok, command_reason = evaluate_expectations(
                        raw,
                        step.get("expect_stdout_regex", []),
                        step.get("expect_stdout_regex_any", []),
                        step.get("fail_on_regex", []),
                    )
                    if command_ok:
                        passed, reason = True, "listen_evidence_recorded"
                    else:
                        passed, reason = False, command_reason
                        failure_note = failure_note or "发送命令本身没有达到期望返回（窗口内是否收到包都不作数）。"
                else:
                    passed, reason = evaluate_expectations(raw, step.get("expect_stdout_regex", []), step.get("expect_stdout_regex_any", []), step.get("fail_on_regex", []))
                    if not raw.get("received_message"):
                        passed, reason = False, "no_received_message"
                step_result.update(raw)
                if raw.get("listen_only"):
                    # 纯监听步骤没有发送命令，报告里不要把 CLI 基础命令显示成"执行了命令"。
                    step_result["command"] = []
                step_result["status"] = "PASS" if passed else "FAIL"
                step_result["reason"] = reason
                if failure_note and not passed:
                    # 失败原因写清楚"下一步该查什么"，报告里直接能看到（UI 用 failure_note 展示）。
                    step_result["failure_note"] = failure_note
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
                    raw = run_with_transport(command, step_timeout)
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
                    step_result["duration_sec"] = step_timeout
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
                retry_safe = (not step_result["mutating"] or bool(step.get("conditional_set_pairs"))) and "--sendtext" not in command
                wait_before_device_command(command, args)
                retry_attempts = int(step.get("retries", 2) or 2)
                retry_delay = float(step.get("retry_delay_sec", args.step_gap or 5) or 5)
                raw = run_command_with_retries(command, step_timeout, attempts=retry_attempts, delay_sec=retry_delay, allow_fallback=not step_result["mutating"]) if retry_safe else run_with_transport(command, step_timeout, allow_dtr_retry="--sendtext" not in command)
                passed, reason = evaluate_expectations(raw, step.get("expect_stdout_regex", []), step.get("expect_stdout_regex_any", []), step.get("fail_on_regex", []))
                combined = (raw.get("stdout") or "") + "\n" + (raw.get("stderr") or "")
                expected_node = context.get(step.get("expect_node_from"))
                if passed and expected_node and not node_seen_in_output(expected_node, combined):
                    if step.get("optional_visibility"):
                        reason = f"node_visibility_not_confirmed:{expected_node}"
                        step_result["visibility_note"] = f"NodeDB did not list peer node {expected_node}; recorded as visibility evidence only."
                    else:
                        passed, reason = False, f"node_not_found:{expected_node}"
                node_public_keys = parse_node_public_keys(combined)
                if node_public_keys:
                    step_result["node_public_keys"] = node_public_keys
                    expected_public_key = public_key_for_node(combined, expected_node) if expected_node else ""
                    if expected_public_key:
                        step_result["expected_node_public_key"] = expected_public_key
                    primary_pk = public_key_for_node(combined, context.get("primary_node_id") or args.primary_node_id)
                    peer_pk = public_key_for_node(combined, context.get("peer_node_id") or args.peer_node_id)
                    if primary_pk:
                        context["primary_public_key"] = primary_pk
                    if peer_pk:
                        context["peer_public_key"] = peer_pk
                if step.get("sensitive_output"):
                    raw["stdout"] = redact_sensitive(raw.get("stdout"))
                    raw["stderr"] = redact_sensitive(raw.get("stderr"))
                step_result.update(raw)
                step_result["status"] = "PASS" if passed else "FAIL"
                step_result["reason"] = reason
                mark_target_unavailable(step_result, context)
                if step_result["status"] == "FAIL" and step_result["mutating"] and raw.get("exit_code") == 124:
                    # 写操作被超时强杀 ≠ 握手失败：命令很可能已经发到设备上，
                    # 因此单独给一个原因，并说明结果要看后续校验步骤。
                    step_result["reason"] = "mutating_command_timeout"
                    step_result["failure_note"] = (
                        f"\u5199\u64cd\u4f5c\u547d\u4ee4\u672a\u5728 {step_timeout}s \u5185\u8fd4\u56de\uff1b"
                        "\u547d\u4ee4\u53ef\u80fd\u5df2\u4e0b\u53d1\u5230\u8bbe\u5907\uff0c\u8bf7\u770b\u968f\u540e\u7684 NodeDB/\u914d\u7f6e\u6821\u9a8c\u6b65\u9aa4\u3002"
                    )
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
                        record_name = str(step.get("record_readback_as") or "").strip()
                        if record_name:
                            for item in read_values:
                                context[f"recorded:{record_name}:{step_result['target']}:{item['field']}"] = item["value"]
                        expected_values = step.get("expected_read_values") or {}
                        mismatches = []
                        for field, desired in expected_values.items():
                            actual = context.get(context_value_key(step_result["target"], field))
                            if not values_equivalent(field, actual, desired):
                                mismatches.append(
                                    f"{display_field(field)}: expected {display_value(field, desired)}, got {display_value(field, actual)}"
                                )
                        if mismatches:
                            step_result["status"] = "FAIL"
                            step_result["reason"] = "readback_value_mismatch"
                            step_result["mismatch_summary"] = mismatches
                        recorded_name = str(step.get("must_equal_recorded") or "").strip()
                        if step_result["status"] == "PASS" and recorded_name:
                            mismatches = []
                            for item in read_values:
                                expected = context.get(f"recorded:{recorded_name}:{step_result['target']}:{item['field']}")
                                if expected in (None, "") or not values_equivalent(item["field"], item["value"], expected):
                                    mismatches.append(
                                        f"{display_field(item['field'])}: before reboot {display_value(item['field'], expected)}, got {display_value(item['field'], item['value'])}"
                                    )
                            if mismatches:
                                step_result["status"] = "FAIL"
                                step_result["reason"] = "reboot_persistence_mismatch"
                                step_result["mismatch_summary"] = mismatches
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
                step_result["duration_sec"] = step_timeout
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
    # 载入历史记录：某串口一旦确认「必须断言 DTR」，后续每轮都不再白等一次必然失败的尝试。
    DTR_ASSERT_PORTS.update(load_dtr_ports())
    parser = argparse.ArgumentParser(description="Meshtastic firmware regression test executor")
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
    parser.add_argument("--timeout", type=int, default=30, help="per-command timeout in seconds")
    parser.add_argument("--execute", action="store_true", help="execute real device commands instead of dry-run")
    parser.add_argument("--allow-mutating", action="store_true", help="allow config writes and message sends")
    parser.add_argument("--custom-only", action="store_true", help="only run the custom config write case")
    parser.add_argument("--config-kind", default="field", help="config kind: field/user_name/channel/wifi/region/modem_preset")
    parser.add_argument("--config-json", default="", help="dashboard config JSON")
    parser.add_argument("--config-field", default="", help="config field, for example device.role")
    parser.add_argument("--config-value", default="", help="config value, for example CLIENT")
    parser.add_argument("--config-target", choices=("primary", "peer", "observer", "both", "all"), default="primary", help="config target")
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
    parser.add_argument("--primary-public-key", default="", help="known test device 1 public key for PKI private messages")
    parser.add_argument("--peer-public-key", default="", help="known test device 2 public key for PKI private messages")
    parser.add_argument("--primary-label", default="", help="known display label for test device 1")
    parser.add_argument("--peer-label", default="", help="known display label for test device 2")
    parser.add_argument("--observer-port", default="", help="serial port of test device 3 (observer/listener); serial only")
    parser.add_argument("--observer-label", default="", help="known display label for test device 3")
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
    observer_connection_args = build_observer_connection_args(args)
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
    cases = expand_regression_cases(cases)
    cases = adapt_cases_for_connections(cases, peer_connection_args, observer_connection_args)
    total_steps = sum(len(case.get("steps", [])) for case in cases)
    results = {
        "suite": data.get("suite"),
        "started_at": datetime.now().isoformat(timespec="seconds"),
        "execute": args.execute,
        "connection": connection_args,
        "peer_connection": peer_connection_args,
        "observer_connection": observer_connection_args,
        "allow_mutating": args.allow_mutating,
        "total_steps": total_steps,
        "cases": [],
    }
    write_progress(args.progress_out, {"event": "run_start", "total": total_steps, "execute": args.execute})
    context = {
        "primary_node_id": normalize_node_id(args.primary_node_id),
        "peer_node_id": normalize_node_id(args.peer_node_id),
        "primary_public_key": args.primary_public_key.strip(),
        "peer_public_key": args.peer_public_key.strip(),
        "primary_short_name": args.primary_label.strip(),
        "peer_short_name": args.peer_label.strip(),
        "observer_short_name": args.observer_label.strip(),
    }
    step_index = 0
    for case in cases:
        case_result, step_index = run_case(case, args, connection_args, peer_connection_args, context, args.progress_out, total_steps, step_index, observer_connection_args)
        results["cases"].append(case_result)

    primary_label = context.get("primary_short_name") or short_node_label(context.get("primary_node_id"))
    peer_label = context.get("peer_short_name") or short_node_label(context.get("peer_node_id"))
    if primary_label or peer_label:
        results = replace_device_names(results, primary_label, peer_label)

    out_path = Path(args.out) if args.out else PROJECT_ROOT / "logs" / f"meshtastic_cli_demo_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    results["finished_at"] = datetime.now().isoformat(timespec="seconds")
    results = redact_report_value(results)
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    statuses = [step.get("status") for case in results["cases"] for step in case.get("steps", [])]
    has_fail = any(status == "FAIL" for status in statuses)
    overall_status = "FAIL" if has_fail else "SKIPPED" if any(status == "SKIPPED" for status in statuses) else "DRY_RUN" if any(status == "DRY_RUN" for status in statuses) else "PASS"
    write_progress(args.progress_out, {"event": "run_end", "total": total_steps, "status": overall_status, "report": str(out_path)})
    print(json.dumps({"report": str(out_path), "caseCount": len(results["cases"]), "status": overall_status}, ensure_ascii=False))
    return 1 if has_fail else 0


if __name__ == "__main__":
    sys.exit(main())
