# Meshtastic CLI 自动化测试可行性评估

> 更新时间：2026-08-31  
> 评估对象：Wio Tracker L2 / Meshtastic 固件设备  
> 官方资料：
> - https://meshtastic.org/docs/software/python/cli/
> - https://meshtastic.org/docs/software/python/cli/installation/
> - https://meshtastic.org/docs/software/python/cli/usage/

## 1. 结论

Meshtastic 固件设备可以做一部分自动化测试，尤其适合“配置读取/写入、节点发现、频道配置、消息发送、日志抓取、回归冒烟”这类重复性测试。

但它不能完整替代人工测试。触屏 UI、按键手感、屏幕黑屏/背光、地图卡顿、扬声器响铃、SD 卡热插拔、GPS 户外精度等项目仍需要人工观察或外部硬件辅助。

建议把 L2 测试分成三层：

| 层级 | 自动化价值 | 示例 |
|---|---|---|
| CLI 可直接自动化 | 高 | `--info`、`--nodes`、`--get`、`--export-config`、`--sendtext`、`--traceroute`、`--seriallog` |
| CLI + 人工/硬件辅助 | 中 | 按键休眠唤醒、地图卡顿、铃声、屏幕亮度、SD 卡插拔、GPS 精度 |
| 不适合直接 CLI 自动化 | 低 | 触摸体验、视觉显示质量、外观/结构类检查 |

## 2. 官方能力摘录

Meshtastic Python CLI 是通过 `pip3 install --upgrade "meshtastic[cli]"` 安装的命令行工具。官方说明它可以显示 mesh 网络包 JSON，也能查看设备串口调试信息。

连接方式支持：

- 串口：`--port COM4 --info`
- TCP：`--host meshtastic.local --info`
- BLE：`--ble "device_name_or_address" --info`

常用自动化命令：

| 能力 | 命令 | 可测内容 |
|---|---|---|
| CLI 环境检查 | `meshtastic --version` | CLI 是否安装 |
| 设备信息 | `meshtastic --port COM4 --info` | 固件、Owner、频道、区域、设备基础信息 |
| 节点列表 | `meshtastic --nodes` | 周边节点发现、在线/总节点数 |
| 配置读取 | `meshtastic --get lora.region` | Region、WiFi、GPS、设备角色等配置 |
| 配置导出 | `meshtastic --export-config` | 测试前后配置快照 |
| 配置写入 | `meshtastic --set network.wifi_enabled 1` | 设置项保存与重启后持久化 |
| 频道设置 | `meshtastic --ch-index 1 --ch-set name mychan --info` | 频道名、PSK、频道索引 |
| 文本发送 | `meshtastic --sendtext "Hello Mesh"` | 公频/私频收发消息 |
| 指定目标发送 | `meshtastic --dest '!28979058' --sendtext "Hello" --ack` | 私信、ACK、指定节点通信 |
| 路由追踪 | `meshtastic --traceroute '!ba4bf9d0'` | Trace Route |
| 串口日志 | `meshtastic --noproto` / `--seriallog log.txt` | 低层日志、深睡、转发、异常复现证据 |
| BLE 扫描 | `meshtastic --ble-scan` | 蓝牙发现 |

## 3. L2 测试用例可自动化映射

| L2 功能 | 可自动化程度 | 建议做法 |
|---|---|---|
| Type-C 串口通信 | 高 | `--port COMx --info` 作为连接冒烟 |
| 节点列表显示 | 高 | `--nodes` 抓取节点表，统计节点数 |
| Region / Modem Preset | 高 | `--get` 读配置，`--set` 或 `--ch-*` 写配置后重新读取 |
| Username | 高 | `--set-owner`、`--set-owner-short` 写入，再 `--info` 校验 |
| Channel 配置 | 高 | `--ch-add`、`--ch-set`、`--qr`、`--qr-all`，注意会改变频道 |
| 公频/私频通信 | 中高 | 两台设备，一台发送 `--sendtext`，另一台监听或查日志 |
| Trace Route | 中高 | `--traceroute` 指定目标节点 |
| Packet Log / 串口日志 | 中高 | `--seriallog` 或 `--noproto` 抓取关键字 |
| Client / Client Mute / Tracker | 中 | CLI 改角色 + 日志关键字验证，仍需确认电源/屏幕状态 |
| WiFi 连接 | 中 | CLI 写 SSID/PSK/enable 后读取 IP 或通过 TCP 连接校验 |
| BLE 连接 | 中 | `--ble-scan` + `--ble <name/address> --info`，首次配对需要 PIN |
| GPS 定位 | 中 | 可读配置/日志，但 10m 精度仍需外部位置基准 |
| WAKE/U-B/RST/PWR 按键 | 低 | CLI 只能辅助抓日志，无法按键；需人工或机械按键治具 |
| 屏幕亮度/黑屏/地图白屏 | 低 | CLI 可抓日志，视觉结果需人工、相机或屏幕采集 |
| 扬声器铃声 | 低 | 需人工听感或音频采集设备 |
| SD 卡热插拔 | 低 | CLI 可看日志，插拔动作需人工或治具 |

## 4. Demo 范围

本项目 demo 放在：

```text
E:\Brower-Download\seeed\Project_01_WioTrackerL2\tests\meshtastic_cli_demo
├── README.md
├── cases_l2_demo.json
└── runner.py
```

Demo 先覆盖 6 类 L2 用例：

- CLI 安装/版本检查。
- Type-C 串口连接与设备信息读取。
- 节点列表读取。
- 配置导出。
- Username 修改验证。
- 公频/指定节点消息发送。

默认 dry-run，不连接设备、不改配置。真实执行必须显式加 `--execute`；会改设备配置或发消息的步骤还必须加 `--allow-mutating`。

## 5. 提效判断

适合优先自动化的场景：

- 每轮固件都要跑的冒烟：CLI 安装、设备连接、`--info`、`--nodes`、配置导出。
- 高频配置回归：Region、Modem Preset、Username、Channel、WiFi、MQTT。
- 通信链路回归：两台设备固定端口，跑广播/私信/ACK/Trace Route。
- 缺陷复现辅助：抓取 WAKE、U/B、Tracker 深睡、Client Mute 转发差异的日志。

预计收益：

- 单设备 CLI 冒烟可从人工 5-10 分钟降到 1 分钟以内。
- 多固件版本对比时，配置导出和日志抓取可直接形成可追溯证据。
- 对 UI/硬件感知类问题，CLI 主要节省“环境确认、日志留证、配置复原”的时间，不能替代最终人工判定。

## 6. 风险

- `--set`、`--ch-set`、`--seturl`、`--factory-reset`、`--reset-nodedb` 会改变设备状态，必须加保护。
- 频道 URL/PSK 属于敏感配置，报告中不要公开完整密钥。
- BLE 首次连接需要 PIN，自动化不稳定，适合做人工辅助或预配对后回归。
- 真实 LoRa 通信受距离、天线、Region、Modem Preset、频道、NodeDB 状态影响，失败要区分环境问题和固件问题。
