# Meshtastic CLI 自动化 Demo

## 目标

把 Meshtastic 设备的部分手工测试用例映射为 CLI 命令，用来验证可自动化覆盖面和实际提效点。默认只生成 dry-run 计划，不连接设备、不修改设备。

## 常用命令

基础 dry-run：

```powershell
# 运行环境：Windows / PowerShell
# 执行前置操作：在 E:\Brower-Download\seeed\Project_01_WioTrackerL2 执行；不需要连接设备

.\.venv\Scripts\python.exe .\tests\meshtastic_cli_demo\runner.py
```

真实执行测试前检查：

```powershell
# 运行环境：Windows / PowerShell
# 执行前置操作：关闭串口工具；确认测试设备1和测试设备2 COM 号

.\.venv\Scripts\python.exe .\tests\meshtastic_cli_demo\runner.py --execute --port COM7 --peer-port COM8 --case MT-PRECHECK-CLI --case MT-PRECHECK-PAIR
```

下发通信配置并读回检查：

```powershell
# 运行环境：Windows / PowerShell
# 执行前置操作：确认允许写配置；两台设备连接稳定

.\.venv\Scripts\python.exe .\tests\meshtastic_cli_demo\runner.py --execute --allow-mutating --port COM7 --peer-port COM8 --communication-config-only --experiment-region EU_868 --experiment-modem LONG_FAST --override-frequency 868
```

真实写入配置时，runner 会先读取当前值；如果当前值已经等于目标值，就跳过写入命令，减少不必要的设备重启。

写入频道配置 dry-run：

```powershell
# 运行环境：Windows / PowerShell
# 执行前置操作：字段由页面传入；双设备一致性测试不要使用 psk=random

.\.venv\Scripts\python.exe .\tests\meshtastic_cli_demo\runner.py --port COM7 --peer-port COM8 --custom-only --config-target both --config-kind channel --config-json '{"index":0,"name":"LongFast","psk":"default"}' --allow-mutating
```

真实执行双向通信：

```powershell
# 运行环境：Windows / PowerShell
# 执行前置操作：两台设备 region、channel/PSK、modem preset、frequency override 一致；点对点模式需要联系人/公钥关系已建立

.\.venv\Scripts\python.exe .\tests\meshtastic_cli_demo\runner.py --execute --allow-mutating --port COM7 --peer-port COM8 --experiment-only --message-primary "用户填写的消息" --message-peer "用户填写的消息" --message-mode device
```

建立点对点联系人：

```powershell
# 运行环境：Windows / PowerShell
# 执行前置操作：确认两台设备连接稳定；该命令会写入 NodeDB

.\.venv\Scripts\python.exe .\tests\meshtastic_cli_demo\runner.py --execute --allow-mutating --port COM7 --peer-port COM8 --contact-exchange-only
```

真实执行频道发送：

```powershell
# 运行环境：Windows / PowerShell
# 执行前置操作：两台设备同一频道配置一致，并且接收端可显示消息

.\.venv\Scripts\python.exe .\tests\meshtastic_cli_demo\runner.py --execute --allow-mutating --port COM7 --peer-port COM8 --experiment-only --message-primary "用户填写的消息" --message-peer "用户填写的消息" --message-mode channel --message-channel 0
```

用户自选配置写入 dry-run：

```powershell
# 运行环境：Windows / PowerShell
# 执行前置操作：字段名可先通过 MT-EVIDENCE-CONFIG 配置字段清单确认

.\.venv\Scripts\python.exe .\tests\meshtastic_cli_demo\runner.py --port COM7 --peer-port COM8 --custom-only --config-target both --config-field device.role --config-value CLIENT --allow-mutating
```

## 设计约束

- `--execute` 未传入时只 dry-run。
- `--allow-mutating` 未传入时，所有会改设备或发消息的步骤都会跳过。
- `--communication-config-only` 只负责下发两台设备的 Region、Modem Preset 和频率覆盖并检查；同一台设备的多个普通 `--set` 会合并成一条命令，减少重复重启。
- 写配置命令默认追加 `--wait-to-disconnect 10`，可用 `--wait-to-disconnect` 调整；Python API 持久串口通信不会追加该参数。
- `--experiment-only` 只负责通信验证，不再自动写配置。
- 页面只保留一个消息输入框；CLI 仍保留 `--message-primary` 和 `--message-peer`，页面会把同一条用户消息传给两个方向。
- `--override-frequency` 对应 Meshtastic 的 `lora.override_frequency`，用于替代 App 里的频率覆盖输入。
- Channel 属于用户配置写入，底层使用 `--ch-index` 和 `--ch-set`；不要再放到通信配置下发里。
- `--message-mode device` 会按对端节点 ID 发送并等待 ACK；`--message-mode channel` 会通过 `--ch-index` 发到指定频道。
- 双设备通信一致性测试不要使用 `--channel-psk random`，它会让两台设备各自生成不同 PSK。
- `--port`、`--host`、`--ble` 同一轮只允许一种测试设备 1 连接方式。
- `--peer-port` 用于测试设备 2 身份读取、配置读取、NodeDB 可见性检查、联系人互导和双向通信。
- `MT-EVIDENCE-CONFIG` 和 `MT-EVIDENCE-NODEDB` 属于可选取证，不是默认业务测试项；完整配置导出超时时可把 `--timeout` 调到 120。
- private key、PSK、password、admin key 等敏感字段会在报告中脱敏。
- 报告默认写入 `E:\Brower-Download\seeed\Project_01_WioTrackerL2\logs`。
