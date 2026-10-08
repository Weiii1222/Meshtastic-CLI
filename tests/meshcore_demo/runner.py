import argparse
import asyncio
import json
import sys
import time
from datetime import datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOCAL_MESHCORE_SRC = PROJECT_ROOT / "tmp" / "meshcore_py" / "src"
if LOCAL_MESHCORE_SRC.exists():
    sys.path.insert(0, str(LOCAL_MESHCORE_SRC))


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


def safe_json(value):
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, dict):
        return {str(key): safe_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [safe_json(item) for item in value]
    if hasattr(value, "name"):
        return value.name
    return str(value)


def write_progress(path, event):
    if not path:
        return
    progress = Path(path)
    progress.parent.mkdir(parents=True, exist_ok=True)
    payload = {"time": now_iso(), **event}
    with progress.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def event_is_error(event):
    return getattr(getattr(event, "type", None), "name", "") == "ERROR"


def event_name(event):
    return getattr(getattr(event, "type", None), "name", str(getattr(event, "type", "")))


def event_payload(event):
    return safe_json(getattr(event, "payload", {}))


async def connect_meshcore(args, role):
    from meshcore import MeshCore

    is_peer = role == "peer"
    port = args.peer_port if is_peer else args.port
    ble = args.peer_ble if is_peer else args.ble
    host = args.peer_host if is_peer else args.host
    pin = args.peer_ble_pin if is_peer else args.ble_pin

    if port:
        return await MeshCore.create_serial(port, 115200, debug=False)
    if ble:
        return await MeshCore.create_ble(ble, pin=pin or None)
    if host:
        if ":" in host:
            host_name, raw_port = host.rsplit(":", 1)
            return await MeshCore.create_tcp(host_name, int(raw_port))
        return await MeshCore.create_tcp(host, 4000)
    raise ValueError("missing_connection")


def self_summary(mc):
    info = getattr(mc, "self_info", None) or {}
    if not isinstance(info, dict):
        info = safe_json(info)
    if not isinstance(info, dict):
        return {"raw": info}
    return {
        "name": info.get("name") or info.get("adv_name") or info.get("long_name") or "",
        "public_key": info.get("public_key") or info.get("pubkey") or "",
        "freq": info.get("freq") or info.get("frequency") or "",
        "bw": info.get("bw") or "",
        "sf": info.get("sf") or "",
        "cr": info.get("cr") or "",
        "raw": safe_json(info),
    }


async def identity_step(args, role, index, total):
    name = "读取测试设备1身份" if role == "primary" else "读取测试设备2身份"
    started = time.time()
    step = {"index": index, "total": total, "name": name, "target": role, "status": "FAIL"}
    write_progress(args.progress_out, {"event": "step_start", "index": index, "total": total, "step": name})
    mc = None
    try:
        if not args.execute:
            step.update(status="DRY_RUN", reason="dry_run", stdout="MeshCore identity dry run.")
            return step
        mc = await asyncio.wait_for(connect_meshcore(args, role), timeout=args.timeout)
        step.update(
            status="PASS",
            reason="connected",
            transport="MeshCore / Serial-BLE-TCP",
            info_summary=self_summary(mc),
            stdout=json.dumps(self_summary(mc), ensure_ascii=False, indent=2),
        )
    except Exception as exc:
        step.update(status="FAIL", reason="meshcore_identity_error", stderr=str(exc))
    finally:
        if mc:
            await mc.disconnect()
        step["duration_sec"] = round(time.time() - started, 2)
        write_progress(args.progress_out, {"event": "step_end", "index": index, "total": total, "step": name, "status": step["status"]})
    return step


async def send_channel(args):
    message = args.message_primary or "hi"
    started = time.time()
    name = f"发送频道 {args.message_channel} 消息"
    step = {"index": 1, "total": 1, "name": name, "target": "primary", "status": "FAIL"}
    write_progress(args.progress_out, {"event": "step_start", "index": 1, "total": 1, "step": name})
    primary = None
    peer = None
    try:
        if not args.execute:
            step.update(status="DRY_RUN", reason="dry_run", stdout="MeshCore channel send dry run.")
            return step
        from meshcore import EventType
        primary = await asyncio.wait_for(connect_meshcore(args, "primary"), timeout=args.timeout)
        has_peer = bool(args.peer_port or args.peer_ble or args.peer_host)
        if has_peer:
            peer = await asyncio.wait_for(connect_meshcore(args, "peer"), timeout=args.timeout)
        result = await primary.commands.send_chan_msg(int(args.message_channel or 0), message)
        if event_is_error(result):
            step.update(status="FAIL", reason="meshcore_channel_send_error", stderr=json.dumps(event_payload(result), ensure_ascii=False))
            return step
        received = False
        recv_payload = {}
        if peer:
            event = await peer.wait_for_event(EventType.CHANNEL_MSG_RECV, timeout=max(1, args.receive_wait))
            received = bool(event and not event_is_error(event))
            recv_payload = event_payload(event) if event else {}
        step.update(
            status="PASS" if (received or not peer) else "FAIL",
            reason="channel_sent" if (received or not peer) else "channel_not_received",
            transport="MeshCore / Companion Protocol",
            action_summary=f"发送到频道 {args.message_channel}",
            message=message,
            stdout=json.dumps({"send": event_payload(result), "received": received, "receive": recv_payload}, ensure_ascii=False, indent=2),
        )
    except Exception as exc:
        step.update(status="FAIL", reason="meshcore_channel_exception", stderr=str(exc))
    finally:
        if primary:
            await primary.disconnect()
        if peer:
            await peer.disconnect()
        step["duration_sec"] = round(time.time() - started, 2)
        write_progress(args.progress_out, {"event": "step_end", "index": 1, "total": 1, "step": name, "status": step["status"]})
    return step


async def send_device(args):
    message = args.message_primary or "hi"
    started = time.time()
    name = "发送给对端设备"
    step = {"index": 1, "total": 1, "name": name, "target": "primary", "status": "FAIL"}
    write_progress(args.progress_out, {"event": "step_start", "index": 1, "total": 1, "step": name})
    mc = None
    try:
        if not args.execute:
            step.update(status="DRY_RUN", reason="dry_run", stdout="MeshCore device send dry run.")
            return step
        from meshcore import EventType
        mc = await asyncio.wait_for(connect_meshcore(args, "primary"), timeout=args.timeout)
        await mc.ensure_contacts()
        contacts = list(getattr(mc, "contacts", {}).values())
        contact = None
        if args.dest:
            contact = mc.get_contact_by_name(args.dest)
            if not contact:
                for item in contacts:
                    if args.dest.lower() in json.dumps(safe_json(item), ensure_ascii=False).lower():
                        contact = item
                        break
        elif contacts:
            contact = contacts[0]
        if not contact:
            step.update(
                status="FAIL",
                reason="meshcore_contact_not_found",
                stderr="未找到 MeshCore 联系人；点对点发送需要先在 MeshCore 联系人列表中存在对端。",
            )
            return step
        result = await mc.commands.send_msg(contact, message)
        if event_is_error(result):
            step.update(status="FAIL", reason="meshcore_device_send_error", stderr=json.dumps(event_payload(result), ensure_ascii=False))
            return step
        expected_ack = (event_payload(result).get("expected_ack") or "")
        ack_event = None
        if expected_ack:
            ack_event = await mc.wait_for_event(EventType.ACK, attribute_filters={"code": expected_ack}, timeout=max(1, args.receive_wait))
        step.update(
            status="PASS" if ack_event else "FAIL",
            reason="device_ack" if ack_event else "device_ack_timeout",
            transport="MeshCore / Companion Protocol",
            action_summary="发送给对端联系人",
            message=message,
            stdout=json.dumps({"send": event_payload(result), "ack": event_payload(ack_event) if ack_event else None}, ensure_ascii=False, indent=2),
        )
    except Exception as exc:
        step.update(status="FAIL", reason="meshcore_device_exception", stderr=str(exc))
    finally:
        if mc:
            await mc.disconnect()
        step["duration_sec"] = round(time.time() - started, 2)
        write_progress(args.progress_out, {"event": "step_end", "index": 1, "total": 1, "step": name, "status": step["status"]})
    return step


async def run(args):
    if args.experiment_only:
        step = await (send_channel(args) if args.message_mode == "channel" else send_device(args))
        title = "频道通信" if args.message_mode == "channel" else "点对点通信"
        cases = [{
            "id": "MC-COMM-EXPERIMENT",
            "module": "MeshCore 通信验证",
            "source_l2_case": title,
            "pass_meaning": "MeshCore 通信步骤完成。",
            "steps": [step],
        }]
    elif args.custom_only:
        cases = [{
            "id": "MC-CUSTOM-CONFIG",
            "module": "MeshCore 配置写入",
            "source_l2_case": "配置写入",
            "steps": [{
                "index": 1,
                "total": 1,
                "name": "MeshCore 配置写入",
                "status": "SKIPPED",
                "reason": "meshcore_config_mapping_pending",
                "stdout": "MeshCore 配置读写入口已隔离；具体配置项映射需要按 MeshCore companion protocol 逐项接入。",
            }],
        }]
    else:
        steps = []
        total = 1 + (1 if (args.peer_port or args.peer_ble or args.peer_host) else 0)
        steps.append(await identity_step(args, "primary", 1, total))
        if total == 2:
            steps.append(await identity_step(args, "peer", 2, total))
        cases = [{
            "id": "MC-CLI-002",
            "module": "MeshCore 测试前检查",
            "source_l2_case": "设备身份读取",
            "pass_meaning": "MeshCore 连接检查通过。",
            "steps": steps,
        }]
    return {
        "suite": "MeshCore 自动化测试控制台",
        "firmware_system": "MeshCore",
        "started_at": now_iso(),
        "ended_at": now_iso(),
        "connection_type": "ble" if args.ble else "port" if args.port else "tcp" if args.host else "none",
        "cases": cases,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="MeshCore dashboard runner")
    parser.add_argument("--port", default="")
    parser.add_argument("--peer-port", default="")
    parser.add_argument("--ble", default="")
    parser.add_argument("--peer-ble", default="")
    parser.add_argument("--ble-pin", default="")
    parser.add_argument("--peer-ble-pin", default="")
    parser.add_argument("--host", default="")
    parser.add_argument("--peer-host", default="")
    parser.add_argument("--dest", default="")
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--receive-wait", type=int, default=10)
    parser.add_argument("--message-mode", choices=["device", "channel"], default="device")
    parser.add_argument("--message-channel", type=int, default=0)
    parser.add_argument("--message-primary", default="")
    parser.add_argument("--message-peer", default="")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--allow-mutating", action="store_true")
    parser.add_argument("--experiment-only", action="store_true")
    parser.add_argument("--custom-only", action="store_true")
    parser.add_argument("--communication-config-only", action="store_true")
    parser.add_argument("--communication-check-only", action="store_true")
    parser.add_argument("--contact-exchange-only", action="store_true")
    parser.add_argument("--out", default="")
    parser.add_argument("--progress-out", default="")
    parser.add_argument("--case", action="append", default=[])
    parser.add_argument("--step-gap", default="0")
    # Compatibility arguments forwarded by the shared dashboard server.
    parser.add_argument("--config-kind", default="")
    parser.add_argument("--config-json", default="")
    parser.add_argument("--config-field", default="")
    parser.add_argument("--config-value", default="")
    parser.add_argument("--config-target", default="")
    parser.add_argument("--reboot-wait", default="")
    parser.add_argument("--experiment-region", default="")
    parser.add_argument("--experiment-modem", default="")
    parser.add_argument("--override-frequency", default="")
    parser.add_argument("--primary-node-id", default="")
    parser.add_argument("--peer-node-id", default="")
    parser.add_argument("--primary-label", default="")
    parser.add_argument("--peer-label", default="")
    return parser.parse_args()


def main():
    args = parse_args()
    try:
        result = asyncio.run(run(args))
    except ImportError as exc:
        result = {
            "suite": "MeshCore 自动化测试控制台",
            "firmware_system": "MeshCore",
            "started_at": now_iso(),
            "ended_at": now_iso(),
            "cases": [{
                "id": "MC-ENV-001",
                "module": "MeshCore 环境检查",
                "source_l2_case": "Python meshcore 库",
                "steps": [{"index": 1, "total": 1, "name": "导入 meshcore", "status": "FAIL", "reason": "meshcore_library_missing", "stderr": str(exc)}],
            }],
        }
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    failed = any(step.get("status") == "FAIL" for case in result.get("cases", []) for step in case.get("steps", []))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
