import json
from collections import Counter, defaultdict
from pathlib import Path
import re


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE_PATH = PROJECT_ROOT / "project-background" / "requirements" / "structured_testcases_from_legacy_xlsx.json"
OUTPUT_JSON = PROJECT_ROOT / "project-background" / "requirements" / "automation_coverage_matrix.json"
OUTPUT_MD = PROJECT_ROOT / "docs" / "Wio_Tracker_L2_Meshtastic_CLI_自动化覆盖矩阵.md"


AUTO_RULES = [
    ("Type-C", "serial_connection", "Meshtastic CLI can connect over serial and read device info."),
    ("节点", "node_db", "Meshtastic CLI can read NodeDB with --nodes."),
    ("在线节点", "node_db", "Meshtastic CLI can read NodeDB with --nodes; UI count still needs manual screen confirmation."),
    ("Username", "owner_config", "Meshtastic CLI supports --set-owner and --set-owner-short."),
    ("Short Name", "owner_config", "Meshtastic CLI supports --set-owner-short."),
    ("Long Name", "owner_config", "Meshtastic CLI supports --set-owner."),
    ("Device Role", "device_role", "Meshtastic CLI supports --get/--set device.role."),
    ("Modem Preset", "modem_preset", "Meshtastic CLI supports LoRa preset commands and lora.modem_preset."),
    ("Region", "region", "Meshtastic CLI supports --get/--set lora.region."),
    ("频段", "region", "Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation."),
    ("Channel", "channel", "Meshtastic CLI supports channel get/set commands."),
    ("频道", "channel", "Meshtastic CLI supports channel get/set commands."),
    ("WiFi", "wifi_config", "Meshtastic CLI supports network.wifi_enabled, network.wifi_ssid, and network.wifi_psk."),
    ("MQTT", "mqtt_config", "Meshtastic CLI supports mqtt.enabled and MQTT config fields."),
    ("蓝牙", "bluetooth_config", "Meshtastic CLI supports bluetooth.enabled and BLE scanning."),
    ("BLE", "bluetooth_config", "Meshtastic CLI supports bluetooth.enabled and BLE scanning."),
    ("GPS", "gps_position", "Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference."),
    ("定位", "gps_position", "Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference."),
    ("LoRa通信", "mesh_message", "Two Meshtastic CLI sessions can send text and wait for ACK."),
    ("收发消息", "mesh_message", "Meshtastic CLI supports --sendtext and --ack."),
    ("发消息", "mesh_message", "Meshtastic CLI supports --sendtext and --ack."),
    ("ACK", "mesh_message", "Meshtastic CLI supports --ack."),
    ("Packet Log", "serial_log", "Meshtastic CLI supports --seriallog and --listen for log capture."),
    ("Backup & Restore", "config_snapshot", "Meshtastic CLI can export/import configuration for assisted comparison."),
    ("Configuration Reset", "reset", "Meshtastic CLI supports reset actions, but they are destructive and should stay gated."),
]

MANUAL_RULES = [
    ("点击", "screen_interaction", "Requires physical UI tap/long press and screen observation."),
    ("长按", "screen_interaction", "Requires physical UI long press and screen observation."),
    ("双击", "screen_interaction", "Requires physical button interaction."),
    ("观察", "visual_check", "Requires screen, sound, map, or app observation."),
    ("铃声", "audio_check", "Requires audio observation."),
    ("Sound", "audio_check", "Requires audio observation."),
    ("扬声器", "audio_check", "Requires audio observation."),
    ("SD卡", "sd_card", "Requires physical SD card insertion/removal."),
    ("地图", "map_check", "Requires map/UI visual verification."),
    ("手机APP", "phone_app", "Requires Android/iOS app operation."),
    ("iOS", "phone_app", "Requires iOS app operation."),
    ("安卓", "phone_app", "Requires Android app operation."),
    ("网页烧录", "flashing_ui", "Requires browser flashing flow."),
    ("Flash Download Tool", "flashing_ui", "Requires Windows flashing tool and boot-mode operation."),
]


def contains(text, token):
    if token.isascii() and token.isalnum():
        return re.search(rf"(?<![A-Za-z0-9]){re.escape(token)}(?![A-Za-z0-9])", text, flags=re.IGNORECASE) is not None
    return token.lower() in text.lower()


def classify(item):
    text = " ".join(str(item.get(field) or "") for field in ("function", "name", "precondition", "steps", "expected", "note"))
    auto_hits = [rule for rule in AUTO_RULES if contains(text, rule[0])]
    manual_hits = [rule for rule in MANUAL_RULES if contains(text, rule[0])]

    if auto_hits and not manual_hits:
        coverage = "auto"
    elif auto_hits and manual_hits:
        coverage = "assisted"
    else:
        coverage = "manual"

    if item.get("function") in {"LoRa通信", "Type-C"}:
        coverage = "auto" if not manual_hits else "assisted"
    if item.get("function") in {"主界面", "按键", "地图", "SD卡", "扬声器"} and auto_hits:
        coverage = "assisted"
    elif item.get("function") in {"主界面", "按键", "地图", "SD卡", "扬声器"}:
        coverage = "manual"

    tags = sorted({hit[1] for hit in auto_hits + manual_hits})
    reasons = []
    for _, _, reason in auto_hits[:3]:
        reasons.append(reason)
    for _, _, reason in manual_hits[:2]:
        reasons.append(reason)
    if not reasons:
        reasons.append("No stable Meshtastic CLI signal is available for this testcase yet.")

    return {
        "coverage": coverage,
        "tags": tags,
        "reason": " ".join(dict.fromkeys(reasons)),
    }


def build_matrix():
    items = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    output = []
    for item in items:
        result = classify(item)
        output.append({**item, **result})
    return output


def write_markdown(matrix):
    by_coverage = Counter(item["coverage"] for item in matrix)
    by_function = defaultdict(Counter)
    for item in matrix:
        by_function[item["function"]][item["coverage"]] += 1

    lines = [
        "# Wio Tracker L2 Meshtastic CLI 自动化覆盖矩阵",
        "",
        "本文按结构化测试用例判断 Meshtastic CLI 可覆盖范围。Excel 中的截图仅作为测试证据，不参与自动化分类。",
        "",
        "## 汇总",
        "",
        "| 类型 | 数量 | 含义 |",
        "|---|---:|---|",
        f"| auto | {by_coverage['auto']} | CLI 可以直接执行并形成主要判定证据 |",
        f"| assisted | {by_coverage['assisted']} | CLI 可以准备、读取或记录证据，但最终仍需人工/外部观察 |",
        f"| manual | {by_coverage['manual']} | 当前缺少稳定 CLI 信号，仍以人工测试为主 |",
        "",
        "## 按功能模块统计",
        "",
        "| 功能 | auto | assisted | manual |",
        "|---|---:|---:|---:|",
    ]
    for function, counts in sorted(by_function.items()):
        lines.append(f"| {function} | {counts['auto']} | {counts['assisted']} | {counts['manual']} |")

    lines.extend([
        "",
        "## 优先自动化方向",
        "",
        "1. 连接与设备信息：串口/TCP/BLE 连接、`--info`、固件和硬件型号读取。",
        "2. 配置读取：Role、Region、Modem Preset、TX、GPS、WiFi、MQTT、Bluetooth、Channel。",
        "3. 安全写入：Owner、Device Role、Modem Preset、Channel/Region 等，必须保留写入开关和回滚/读回校验。",
        "4. 双机通信：读取辅助设备节点 ID，由主设备发送消息并等待 ACK。",
        "5. 日志辅助：Packet Log、Tracker/Client/Client Mute 行为通过 `--seriallog` 或日志文件辅助判断。",
        "",
        "## 仍需人工或外部设备的范围",
        "",
        "- 屏幕点击、长按、页面跳转、横幅通知、声音、按钮手感、SD 卡、地图路线、手机 App 视觉确认。",
        "- GPS 坐标精度可以由 CLI 读取位置，但“与手机 GPS 偏差不超过 10 米”需要外部参考坐标。",
        "- 烧录流程可以半自动记录工具输出，但进入 boot 模式、Flash Download Tool 操作和屏幕确认仍需人工。",
        "",
        "## 明细",
        "",
        "| 行号 | 功能 | 用例名称 | 覆盖 | 标签 | 原因 |",
        "|---:|---|---|---|---|---|",
    ])
    for item in matrix:
        tags = ", ".join(item["tags"])
        reason = item["reason"].replace("|", "/")
        lines.append(f"| {item['row']} | {item['function']} | {item['name']} | {item['coverage']} | {tags} | {reason} |")

    OUTPUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    matrix = build_matrix()
    OUTPUT_JSON.write_text(json.dumps(matrix, ensure_ascii=False, indent=2), encoding="utf-8")
    write_markdown(matrix)
    counts = Counter(item["coverage"] for item in matrix)
    print(json.dumps({"total": len(matrix), **counts}, ensure_ascii=False, indent=2))
    print(f"json={OUTPUT_JSON}")
    print(f"markdown={OUTPUT_MD}")


if __name__ == "__main__":
    main()
