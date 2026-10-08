---
name: Meshtastic CLI Test Console
description: Dense lab-console interface for Meshtastic CLI firmware validation.
colors:
  paper: "#eef1f3"
  surface: "#ffffff"
  surface-2: "#f7f9fb"
  ink: "#15191f"
  muted: "#59636e"
  line: "#d4dbe3"
  pass-green: "#15724f"
  fail-red: "#b23b36"
  guard-amber: "#9b6418"
  dry-blue: "#255f99"
  selection-green: "#cfe8dc"
  command-foreground: "#f4f7f9"
  blue-border: "#b9cde2"
  green-border: "#b8decb"
  red-border: "#e4bab5"
  focus-ring: "rgba(21, 114, 79, 0.25)"
  toggle-off: "#d9e0e6"
  toggle-shadow: "rgba(0, 0, 0, 0.16)"
typography:
  display:
    fontFamily: "Segoe UI, Microsoft YaHei, Arial, sans-serif"
    fontSize: "clamp(1.45rem, 2.2vw, 2.2rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0"
  body:
    fontFamily: "Segoe UI, Microsoft YaHei, Arial, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.45
    letterSpacing: "0"
  panel-title:
    fontSize: "1.08rem"
    fontWeight: 700
  section-title:
    fontSize: "0.96rem"
    fontWeight: 700
  module-title:
    fontSize: "0.98rem"
    fontWeight: 800
  field-label:
    fontSize: "0.84rem"
    fontWeight: 800
  module-body:
    fontSize: "0.8rem"
  row-meta:
    fontSize: "0.78rem"
  case-row:
    fontSize: "0.78rem"
  metric:
    fontSize: "1.45rem"
    fontWeight: 700
  metric-label:
    fontSize: "0.7rem"
    fontWeight: 900
  result-code:
    fontFamily: "Cascadia Mono, Consolas, monospace"
    fontSize: "0.74rem"
  command-code:
    fontFamily: "Cascadia Mono, Consolas, monospace"
    fontSize: "0.8rem"
rounded:
  sm: "6px"
  md: "8px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "18px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "0 13px"
    height: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
---

# Design System: Meshtastic CLI Test Console

## Overview

**Creative North Star: "Firmware Bench Console"**

The interface is a compact operating surface for repeated hardware validation. It uses a clean gray-white lab bench palette, strong ink controls, and semantic status colors so firmware testers can scan device mapping, run intent, and verdict evidence quickly.

**Key Characteristics:**
- Dense but organized panels for frequent use.
- Manual serial scanning before port assignment, so stale COM values do not look fixed.
- Port options show only the COM number; scanned cards show COM number plus a concise USB serial number or plain device label. TCP uses explicit host inputs. BLE scan uses browser-native Web Bluetooth device selection, then an explicit Connect BLE action validates GATT/service availability before the backend runner reconnects by BLE name/address.
- Module rows support a single select-all checkbox, multi-module runs, and individual case runs.
- Results accumulate until cleared, preserving earlier module output for comparison.
- Configuration writes are user-entered and explicitly gated before they can change a device.
- Configuration writes use a narrowed device-facing list: User name, Region, Modem Preset, Channel, Device Role, WiFi, GPS, MQTT, and Bluetooth; Language is presented as a manual item when the current CLI does not expose a writable language field. Frequency Override is edited inside the Region form, shows the cached value or `0`, and is written only from that visible input. Common enum readbacks are shown as names, not numeric codes.
- Real writes batch-read current values first; unchanged fields show an "already consistent" result and do not call `--set`, then skip reboot waiting and duplicate readback.
- Channel configuration belongs to configuration write and uses `--ch-index` / `--ch-set`; adding a new secondary channel by name uses `--ch-add` when the selected index is currently unused. The communication configuration action only aligns Region, Modem Preset, and Frequency Override.
- Communication validation uses one tester-controlled action: optional region, modem preset, and frequency override are applied to both devices only when selected and only when cached readback does not already match, then bidirectional messaging runs with one tester-entered message sent by both devices. Selecting Region never performs a hidden Frequency Override clear. If no communication config is selected, the dashboard first checks current Region, Modem Preset, and Frequency Override consistency before sending. Communication no longer reads public/private keys; if precheck has already captured two distinct node IDs, peer-device communication reuses those IDs and skips repeated identity reads. Serial-pair communication prefers a Python API persistent sender that opens both ports once and records one final dual-send result; TCP/BLE keep the CLI-compatible path.
- Contact exchange is an explicit mutating helper: it generates each device's contact URL with `--contact-qr --contact-verified`, imports it into the opposite device with `--add-contact`, then checks NodeDB visibility. Passing this helper means the contact appears in NodeDB, not that a later message is ACKed.
- Device references start as test device 1 and test device 2. After `--info` succeeds, selectors and result evidence prefer the local Owner Short Name; fallback is the local `myNodeNum` node-ID suffix without `#`. NodeDB rows, relay nodes, and destination IDs must never rename a connected device. COM port remains visible only in port mapping/evidence and is never appended to the device name.
- Channel labels come only from explicit channel reads/writes for that index. The default primary channel is shown as `LongFast`; a secondary `seeed` channel is shown at index 1 until the device reports or writes another name. Do not use arbitrary NodeDB `name` fields as channel labels.
- The device configuration panel is a last-read snapshot. It refreshes after precheck, `--info`, or configuration readback; it is not a live real-time device settings stream.
- A fixed narrow left navigation rail keeps the three pages visible without hover expansion. Serial scanning belongs in device connection, reports belong on the Report page, and the serial sidecar log belongs on the Log page.
- A separate serial sidecar log can listen to a non-test COM port and write raw text logs for diagnosis. It is outside testcase verdict logic and cannot select the same COM as either test device.
- Results show one verdict card per testcase. Read/write/wait substeps stay inside the expandable evidence block, and the PASS/FAIL/SKIP/DRY metric cards filter the visible testcase cards.
- Running jobs expose step progress and a stop button so long CLI calls, listen windows, and reboot waits do not look frozen.

## Colors

The palette pairs neutral lab surfaces with restrained operational status colors.

### Primary
- **Bench Ink:** Primary text, command surface, and suite-run button.
- **Pass Green:** Successful service state, PASS status, and low-risk action buttons.

### Secondary
- **Guard Amber:** Mutating-action safety gate and skipped steps caused by protection.
- **Dry Blue:** Dry-run status and non-device execution.
- **Fail Red:** Failed commands and service errors.

### Neutral
- **Paper Gray:** Page background.
- **Surface White:** Panels and form controls.
- **Rule Line:** Borders and separators.
- **Muted Graphite:** Secondary labels and report metadata.

**The Status-Is-Semantic Rule.** Use green, red, amber, and blue only for execution meaning; do not reuse them as decoration.

## Typography

**Display Font:** Segoe UI with Microsoft YaHei fallback.  
**Body Font:** Segoe UI with Microsoft YaHei fallback.  
**Mono Font:** Cascadia Mono or Consolas for commands and report evidence.

### Hierarchy
- **Display** (700, `clamp(1.45rem, 2.2vw, 2.2rem)`, 1.1): Product screen heading only.
- **Title** (700-800, `0.98rem-1.08rem`): Panel and module titles.
- **Body** (400-800, `0.78rem-1rem`, 1.45): Form labels, result text, report metadata, and dense module copy.
- **Code** (400, `0.74rem-0.8rem`): Meshtastic commands and process output.

## Layout

The primary viewport uses a fixed narrow navigation rail plus a bounded operating canvas. Device connection and the current configuration snapshot lead the page, followed by a responsive multi-column grid for test modules, configuration write, and communication validation. Cumulative results and command evidence sit below the main work area. Reports and logs are separate pages. On mobile the navigation becomes a compact top rail and every panel stacks into one column.

## Components

### Buttons
- **Primary:** Ink background with white text, 44px minimum height.
- **Module Run:** Green action button for one-case, one-module, selected-module, and full-suite runs.
- **Quiet Secondary:** White/gray utility button for clearing results and low-risk tools.
- **Select All:** Use one checkbox in the module toolbar; avoid separate all-select and all-clear buttons.
- **Run Mode:** The top bar exposes only read-only real-device mode and writable real-device mode. Communication and configuration writes require writable mode.
- **Focus:** 3px translucent green focus ring with 2px offset.

### Port Chips
- **Style:** Clickable compact rows with COM number first and USB device ID second.
- **Device Mapping:** Prefer USB serial number. If the chip has no serial number, show a plain serial-device label rather than noisy Windows instance fragments.
- **Role Assignment:** Test device 1 and test device 2 selects share the same scanned port list; a selected port is disabled in the opposite selector.

### Result Rows
- **Verdict:** Status is shown at step level, not only module level.
- **Reason:** PASS/FAIL copy explains the business meaning before raw command details.
- **Readback:** Configuration reads show the parsed field value directly in the result card, mapping known enum numbers such as `role=0` to `CLIENT` and `region=1` to `US`.
- **Evidence:** Raw stdout is shortened in the page and full redacted output is saved in JSON reports.

### Progress
- **Placement:** Show active progress in the results column, above accumulated result cards.
- **Meaning:** Progress rows show the running step, completed step, skipped step, and final run verdict.
- **Reboot Waits:** Explicit wait steps are visible so device reboot windows are not mistaken for a hung run.
- **Write Readback:** Mutating configuration writes insert a visible wait before readback so the device can reboot, reconnect, and apply the field before verification.
- **No-Change Runs:** When read-before-write proves the target value is already present, the progress copy says no write occurred and does not show a fake reboot wait.
- **Receive Verification:** Serial-pair communication opens both ports through the Python API, subscribes to received text packets, sends in both directions, and passes only when both receivers contain the user-entered message. CLI listener evidence remains the fallback for non-serial paths.

### Reports
- **Location:** Persist JSON reports and progress JSONL under `E:\Brower-Download\seeed\Project_01_WioTrackerL2\logs` by default; teams may redirect with `MESHTASTIC_DASHBOARD_LOG_DIR`.
- **Placement:** Report history lives on the Report page, with report details rendered in a dedicated evidence panel.
- **Actions:** Report rows open JSON inside the command/report panel or download a local JSON file.

### Advanced Evidence
- **Purpose:** Field-list and full-config export tools support field confirmation and failure replay; they are not core business tests.
- **Default State:** Advanced evidence modules are not selected by default because full config export can be slow and may time out during reboot windows.

## Do's and Don'ts

### Do:
- **Do** keep device-changing actions visibly gated.
- **Do** show direction and message content for communication tests.
- **Do** let communication run directly when no communication config field is selected.
- **Do** keep skipped steps visible; skipped is useful evidence.
- **Do** explain NodeDB as node-list visibility evidence, not proof of point-to-point ACK or a confirmed recipient.

### Don't:
- **Don't** show broad automation coverage statistics in the main run surface.
- **Don't** present regex strings as the main pass reason.
- **Don't** treat node-list reading as an isolated business pass outside a communication scenario.
- **Don't** read or expose private keys, PSK, passwords, or admin keys in page evidence.
- **Don't** allow `psk=random` in paired Channel configuration because it can generate different keys on the two devices.
