"""Run the Meshtastic CLI with a safer Windows serial open path.

The stock Meshtastic Python serial interface opens pySerial directly. On some
Windows USB-CDC boards that can assert DTR/RTS and trigger an ESP32 reset even
for read-only commands. This wrapper keeps the official CLI parser/behavior but
patches SerialInterface.connect in-process so DTR/RTS stay under our control.

Default mode holds DTR/RTS inactive (no reset). Some boards (for example the
Wio Tracker L1 Pro 1W) only send data over USB-CDC while DTR is asserted; for
those ports the runner retries with `MESHTASTIC_SERIAL_DTR=1`, which asserts the
lines without performing the reset toggle sequence that the stock CLI uses.
"""

from __future__ import annotations

import contextlib
import os
import sys
import time


def dtr_asserted_mode() -> bool:
    """是否需要断言 DTR/RTS。

    部分开发板（如 Wio Tracker L1 Pro 1W）的 USB-CDC 只有在 DTR 有效时才回数据；
    把 DTR 一直拉低会让 CLI 等到超时报 Connection timed out。
    只有 runner 在该串口上确认过 no-reset 握手失败后，才会用 MESHTASTIC_SERIAL_DTR=1 重试。
    """
    return str(os.environ.get("MESHTASTIC_SERIAL_DTR") or "").strip().lower() in {"1", "true", "yes", "on"}


def install_serial_no_reset_patch() -> None:
    """Patch Meshtastic serial open behavior without modifying site-packages."""
    try:
        import serial  # type: ignore[import-untyped]
        import meshtastic.serial_interface as serial_interface
    except Exception:
        return

    if getattr(serial_interface.SerialInterface.connect, "_seeed_no_reset_patch", False):
        return
    original_close = serial_interface.SerialInterface.close

    def connect_no_reset(self) -> None:
        logger = serial_interface.logger
        assert_lines = dtr_asserted_mode()
        logger.debug("Connecting to %s with DTR/RTS %s", self.devPath, "asserted" if assert_lines else "held inactive")
        dev_path = self.devPath
        if dev_path is None:
            raise RuntimeError("Serial device path is not set")

        if sys.platform != "win32":
            with open(dev_path, encoding="utf8") as handle:
                self._set_hupcl_with_termios(handle)
            time.sleep(0.1)

        stream = serial.Serial()
        stream.port = dev_path
        stream.baudrate = 115200
        stream.exclusive = True
        stream.timeout = 0.5
        stream.write_timeout = 0
        stream.dsrdtr = False
        stream.rtscts = False
        stream.xonxoff = False

        # Set the requested line state before open where pySerial permits it, then
        # repeat after open because Windows drivers may reassert defaults during CreateFile.
        with contextlib.suppress(Exception):
            stream.dtr = assert_lines
        with contextlib.suppress(Exception):
            stream.rts = assert_lines
        stream.open()
        with contextlib.suppress(Exception):
            stream.dtr = assert_lines
        with contextlib.suppress(Exception):
            stream.rts = assert_lines

        self.stream = stream
        # Clear stale bytes left by a prior reset/boot banner before Meshtastic
        # starts the protobuf handshake. This prevents random serial log bytes
        # from being interpreted as a failed protocol negotiation.
        with contextlib.suppress(Exception):
            self.stream.reset_input_buffer()  # type: ignore[attr-defined]
        with contextlib.suppress(Exception):
            self.stream.reset_output_buffer()  # type: ignore[attr-defined]
        self.stream.flush()  # type: ignore[attr-defined]
        time.sleep(0.1)
        serial_interface.StreamInterface.connect(self)

    connect_no_reset._seeed_no_reset_patch = True  # type: ignore[attr-defined]
    serial_interface.SerialInterface.connect = connect_no_reset

    def close_no_reset(self) -> None:
        stream = getattr(self, "stream", None)
        if stream:
            with contextlib.suppress(Exception):
                stream.dtr = False
            with contextlib.suppress(Exception):
                stream.rts = False
            with contextlib.suppress(Exception):
                stream.reset_output_buffer()
            with contextlib.suppress(Exception):
                stream.flush()
        original_close(self)

    close_no_reset._seeed_no_reset_patch = True  # type: ignore[attr-defined]
    serial_interface.SerialInterface.close = close_no_reset


def install_ble_pair_patch() -> None:
    """Ask Bleak/Windows to pair before BLE connect when the dashboard requests it."""
    enabled = str(os.environ.get("MESHTASTIC_BLE_PAIR") or "").strip().lower()
    if enabled not in {"1", "true", "yes", "on"}:
        return
    try:
        import meshtastic.ble_interface as ble_interface
    except Exception:
        return

    if getattr(ble_interface.BLEInterface.connect, "_seeed_pair_patch", False):
        return

    def connect_with_pair(self, address=None):
        device = self.find_device(address)
        timeout = max(30, int(os.environ.get("MESHTASTIC_BLE_TIMEOUT") or "60"))
        client = ble_interface.BLEClient(
            device.address,
            pair=True,
            timeout=timeout,
            disconnected_callback=lambda _: self.close(),
        )
        client.connect(timeout=timeout)
        client.discover()
        return client

    connect_with_pair._seeed_pair_patch = True  # type: ignore[attr-defined]
    ble_interface.BLEInterface.connect = connect_with_pair


def main() -> int:
    install_serial_no_reset_patch()
    install_ble_pair_patch()
    from meshtastic.__main__ import main as meshtastic_main

    result = meshtastic_main()
    return int(result or 0)


if __name__ == "__main__":
    raise SystemExit(main())
