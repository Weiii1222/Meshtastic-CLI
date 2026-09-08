# Meshtastic CLI 测试控制台

这是本项目的可视化入口，封装 `tests\meshtastic_cli_demo\runner.py`，用于扫描串口、选择两台 Meshtastic 测试设备、运行自动化流程、查看进度、打开或下载报告。

## 启动

```powershell
# 运行环境：Windows / PowerShell
# 执行前置操作：在 E:\Brower-Download\seeed\Project_01_WioTrackerL2 执行

.\start_dashboard.ps1
```

访问：

```text
http://127.0.0.1:8765
```

## 页面规则

- 页面不会自动扫描串口；点击“扫描串口”后才刷新当前 `COM` 列表。
- 串口下拉框只显示 `COMx`；设备对应关系看扫描卡片里的 USB 序列号、USB 实例或 USB 位置。
- 测试设备 1 和测试设备 2 不能选择同一个 `COM`。
- “真实执行”未开启时只 dry-run，不连接设备。
- “允许写配置 / 发消息”未开启时，写配置和发消息步骤会跳过。
- 运行结果累计保留，执行新流程不会清掉旧结果；需要清空时点“清空结果”。
- “测试前检查”默认选中；“可选取证”默认不选中，避免完整配置导出影响核心流程。

## 流程设计

测试前检查：
- 本机 CLI 检查。
- 双设备检查：读取两台设备身份、Region、Modem Preset、Frequency Override、Device Role 和频道快照，并检查 NodeDB 是否能看到对端。
- NodeDB 可见只说明节点列表里出现过对端，不等价于点对点联系人已确认，也不等价于后续消息会收到 ACK。

互识辅助：
- 点击“建立点对点联系人”会用 `--contact-qr --contact-verified` 导出两台设备联系人 URL，再用 `--add-contact` 互相导入。
- 该动作会写入 NodeDB，需要打开“允许写配置 / 发消息”；导入后仍要运行通信验证，以 ACK 或对端实际收到消息作为最终依据。

测试项：配置写入：
- 用户选择设备面向的配置项和值，例如 User name、Region、Modem Preset、Frequency Override、Channel、Device Role、WiFi、GPS、MQTT、Bluetooth；Language 当前 CLI 未暴露可写字段，页面保留为人工项提示。
- 点击“下发并检查”后执行写入，等待设备恢复后再读回检查；不再有“保存本轮配置”步骤。
- 真实执行时会先读取当前值，当前值已经一致就跳过写入，减少不必要的设备重启。
- Channel 只放在配置写入里，底层使用 `--ch-index` 和 `--ch-set`；通信配置区不再写 Channel，避免把频道名误写成 Modem Preset。
- 常见枚举读回会转成人可读名称，例如 `role = 0` 显示 `CLIENT`，`region = 1` 显示 `US`。

测试项：通信：
- 勾选本轮要控制的 Region、Modem Preset 或 Frequency Override；这些配置会下发到两台设备。
- 点击“运行通信”后，页面会自动判断：勾选了配置就先下发，等待设备恢复后读回检查，配置通过后继续通信；没有勾选配置就直接通信。
- 如果本页已经通过“测试前检查”读到两台设备节点 ID，通信阶段会直接发送，不重复读取身份和 NodeDB。
- 选择“发给对端设备”或“发到频道”，填写一条消息；页面会让两台设备互相发送同一条消息。
- 只有发送方式选择“发到频道”时，发送频道下拉才参与本轮通信。
- 通信一致性测试不要使用 `psk=random`，否则两台设备会生成不同 PSK。

可选取证：
- `L2-CLI-004` 用于确认当前固件支持哪些配置字段。
- `L2-CLI-005` 用于导出完整配置快照，输出较大，超时时可把单步超时调到 120 秒后单独运行。

## 报告

报告目录固定为：

```text
E:\Brower-Download\seeed\Project_01_WioTrackerL2\logs
```

每次运行会生成：

- `meshtastic_cli_dashboard_report_*.json`：完整测试报告。
- `meshtastic_cli_progress_*.jsonl`：运行过程事件，用于页面进度显示和失败定位。

页面“报告记录”提供“打开”和“下载”。“打开”会把 JSON 内容显示到页面左下角命令/报告内容区。

可以用环境变量覆盖报告目录：

```powershell
# 运行环境：Windows / PowerShell
# 执行前置操作：把路径换成团队可访问的目录

$env:MESHTASTIC_DASHBOARD_LOG_DIR = "D:\WioTrackerL2_TestReports"
.\start_dashboard.ps1
```
