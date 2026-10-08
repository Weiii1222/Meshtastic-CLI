# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Python standard-library HTTP server plus static HTML/CSS/JavaScript, chosen to keep the test-station setup lightweight on Windows and avoid frontend build dependencies.

## Users

Primary users are Seeed firmware testers validating Wio Tracker L2, X1/XB, and other Meshtastic firmware devices on Windows test machines. Their job is to select a device connection, run one module or one testcase, and read pass/fail/skip evidence without hand-typing repeated Meshtastic CLI commands.

## Product Purpose

The product turns part of the Meshtastic device manual testcase set into a visual CLI automation runner. Success means repetitive CLI-compatible checks become one-click runs with saved JSON evidence, while hardware/UI observations remain clearly marked as manual or assisted.

## Positioning

The useful mechanism is controlled execution around a real hardware CLI: read-only real-device checks are available by default, and steps that write settings or send messages require the explicit writable mode.

## Operating Context

The system runs inside `E:\Brower-Download\seeed\Project_01_WioTrackerL2`, reads demo cases from `tests\meshtastic_cli_demo\cases_l2_demo.json`, invokes `tests\meshtastic_cli_demo\runner.py`, and writes reports under `logs`.

## Capabilities and Constraints

Supported connection modes are serial port, TCP host, and BLE target. Serial scanning stays in the device connection panel; scanned devices are assigned as test device 1 and test device 2 with duplicate COM selections disabled. BLE scanning now uses the browser-native Web Bluetooth API (`navigator.bluetooth.requestDevice`) instead of parsing backend CLI scan output. After the tester selects a device in the browser chooser, the UI shows an explicit Connect BLE action that performs a GATT connection and Meshtastic service check; Windows/Chrome owns any PIN pairing prompt, because Web Bluetooth JavaScript cannot read or submit PIN values directly. The backend runner still receives a BLE name/address string and reconnects through Meshtastic CLI/Bleak when a testcase runs; a full browser-side Meshtastic protobuf transport is a separate larger feature. TCP and BLE expose separate inputs for both test devices and are passed to the runner as primary and peer connections. Read-only checks can run with `--execute`; mutating checks require `--allow-mutating`, and the UI exposes two modes: read-only real device and writable real device. Communication is blocked in read-only mode because it sends real messages. Configuration writes use a narrowed device-facing list: User name, Region, Modem Preset, Channel, Device Role, WiFi, GPS, MQTT, and Bluetooth; Language is kept as a manual item because the current CLI field list does not expose a writable language field. Frequency Override is part of the Region form, shows the cached device value or `0`, and is written only from the visible input. The runner batch-reads current values before real writes and skips already-matching fields to reduce unnecessary reboot cycles; when no field changed, it also skips reboot waiting and duplicate readback. After a real write it waits for device reboot/re-enumeration, and inserts a default 5-second gap between real device commands. Channel belongs to configuration write and uses `--ch-index` / `--ch-set`; adding a new secondary channel by name uses `--ch-add` because direct `--ch-set name` on an unused secondary channel can fail in the installed CLI. Channel labels are only updated from explicit channel reads/writes, not NodeDB node names. Two-device communication uses one run action: if the tester selected region, modem preset, or optional frequency override, the dashboard first checks whether those selected values already match the cached readback for both devices; if yes it skips configuration, otherwise it aligns those fields on both devices and checks readback. Selecting Region no longer performs hidden Frequency Override clearing. If no config field is selected, it first checks or reuses already-captured Region, Modem Preset, and Frequency Override consistency before sending. Communication defaults to selected-channel sending because the Primary Channel behaves like a public/common channel when Region and frequency match. When both devices use serial, communication prefers a Meshtastic Python API persistent two-port sender: it opens both serial interfaces once, sends both directions, and passes only when the opposite interface receives the user-entered message. TCP/BLE and unsupported API paths keep the CLI send/listen fallback. Peer-device sending remains available and requires a valid contact/public-key relationship. NodeDB visibility is treated only as discovery evidence, not as proof of point-to-point ACK. A separate contact-exchange action can generate verified contact URLs and import each device into the other with `--contact-qr` and `--add-contact`; this is mutating and must be run explicitly. The dashboard no longer reads public/private keys as testcase evidence. When `--info` discovers device names, selectors and execution evidence identify devices by the local Owner Short Name, falling back to the local `myNodeNum` suffix without `#`; NodeDB rows, relay nodes, and destination IDs must never rename a connected device. Reports default to the project `logs` folder, live on the Report page, and can be redirected with `MESHTASTIC_DASHBOARD_LOG_DIR`. The dashboard also includes an optional serial sidecar log reader for a separate non-test serial port, writing raw text to `logs\serial_sidecar_*.log`. Advanced evidence tools are for field confirmation and failure replay, not daily communication validation. Serial read-only commands should not intentionally reboot a device, but Windows serial open/close can still trigger USB-CDC/DTR reset behavior on some boards; BLE is kept as a transport path to compare against USB serial reset side effects. The visual runner does not press buttons, inspect the screen, listen to the speaker, insert SD cards, or judge GPS accuracy without external evidence.

## Evidence on Hand

Source materials are `SNAPSHOT.md`, `docs\Wio_Tracker_L2_测试用例.xlsx`, `project-background\requirements\Wio Tracker L2 测试用例.xlsx`, `project-background\requirements\structured_testcases_from_legacy_xlsx.json`, `docs\Meshtastic_CLI_自动化测试可行性评估.md`, and the existing Meshtastic CLI demo files.

## Product Principles

- Keep device-changing actions visibly gated.
- Preserve raw command and report evidence for every run.
- Group tests by tester workflow, not by implementation detail.
- Make skipped/manual boundaries explicit instead of treating them as failures.
