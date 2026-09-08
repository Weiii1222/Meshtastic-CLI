# Wio Tracker L2 Meshtastic CLI Test Console

本项目把 Wio Tracker L2 的一部分 Meshtastic 固件测试用例做成可视化自动化控制台，用于减少重复 CLI 操作、保留测试证据，并验证哪些手工用例适合自动化提效。

## 当前能力

- 手动扫描 Windows 串口，页面下拉框只显示 `COMx`；扫描详情卡片显示 USB 序列号、USB 实例或 USB 物理位置，用来把具体设备对应到串口。
- 测试设备 1 和测试设备 2 都从扫描结果中选择，同一个 `COM` 不能同时分配给两台设备。
- 流程支持单用例、单模块、勾选多模块和全量运行；结果会累计保留，直到手动清空。
- 左上角使用一个全选复选框控制模块选择，不再保留独立“全选 / 全取消”按钮。
- 默认 dry-run；真实连接设备需要勾选“真实执行”。
- 写配置和发消息需要额外勾选“允许改配置 / 发消息”。
- 支持用户自选配置项和值：配置项按设备实际显示名称组织，保留 User name、Region、Modem Preset、Frequency Override、Channel、Device Role、WiFi、GPS、MQTT、Bluetooth；Language 当前 CLI 未暴露可写字段，页面保留为人工项提示。
- Channel 配置归入“配置写入”，底层使用 `--ch-index` 和 `--ch-set`，避免把频道名称误当成 Modem Preset。
- 通信测试合并成一个运行按钮：勾选 Region、Modem Preset 或 Frequency Override 时，先下发两台设备一致配置，等待设备恢复后读回检查，通过后自动运行双向消息；不勾配置时直接运行双向消息验证。
- 通信验证支持发给对端设备或发到指定频道；发到频道时通过页面选择频道索引。
- 真实写配置会先读取当前值，已一致时跳过写入；实际写入后默认等待 20 秒再读回，避免设备重启/重新枚举尚未完成就判失败；写配置/发消息命令默认追加 `--wait-to-disconnect 10`。
- 配置读回会把常见枚举数字转成人可读值，例如 `lora.region = 1` 显示为 `US`，`device.role = 0` 显示为 `CLIENT`。
- 运行中会显示步骤进度、当前步骤和最新执行状态。
- 每次运行保存 JSON 报告到 `E:\Brower-Download\seeed\Project_01_WioTrackerL2\logs`，页面报告区可打开详情或下载日志。
- 可选取证只用于字段确认和完整配置快照，不默认参与测试前检查。

## 启动

```powershell
# 运行环境：Windows / PowerShell
# 执行前置操作：在项目目录执行；项目 .venv 已安装 meshtastic CLI

cd E:\Brower-Download\seeed\Project_01_WioTrackerL2
.\start_dashboard.ps1

# 执行后访问：
# http://127.0.0.1:8765
```

`start_dashboard.ps1` 会先关闭当前占用 `8765` 端口的旧服务，再启动新的控制台服务。

## 推荐测试流程

1. 点击“扫描串口”，根据 USB 详情确认哪一个 `COM` 是测试设备 1、哪一个是测试设备 2。
2. 选择测试设备 1 和测试设备 2，确认两个下拉框没有选择同一个 `COM`。
3. 勾选“真实执行”；需要写配置或发送消息时再勾选“允许改配置 / 发消息”。
4. 先运行“测试前检查”，确认本机 CLI、两台设备身份、公私钥字段、通信关键配置和 NodeDB 互识关系；读取到节点 ID 后，后续设备名称会优先用 ID 后四位标识。
5. 需要改配置时，在“测试项：配置写入”里选择配置项和值，点击“下发并检查”。
6. 需要设置频道时，在“测试项：配置写入”里选择 Channel，再填写 Channel Index、Channel Name 或 Channel PSK。
7. 需要做通信时，在“测试项：通信”里按需勾选本轮要下发的 Region、Modem Preset 或 Frequency Override；如果不需要改配置就不要勾选，选择发送方式、填写一条消息后点击“运行通信”。页面已有前置检查节点 ID 时，通信阶段会直接发送，不重复读公私钥和 NodeDB。
8. 查看进度区和结果卡片：
   - NodeDB 检查用于判断两台设备是否已经互相认识。
   - 双向 ACK 用于判断两台设备互相发送是否都可达。
   - 读取配置类结果会直接显示读回值。
9. 需要复盘时，在“报告记录”中点击“打开”在页面左下角查看 JSON，或点击“下载”保存。

## 报告目录

默认报告保存在本机项目目录：

```text
E:\Brower-Download\seeed\Project_01_WioTrackerL2\logs
```

其他人使用这个测试台时，默认会保存到他们自己电脑的项目 `logs` 目录。如果需要统一存放到共享目录，启动前设置：

```powershell
# 运行环境：Windows / PowerShell
# 执行前置操作：把路径换成团队可访问的目录

$env:MESHTASTIC_DASHBOARD_LOG_DIR = "D:\WioTrackerL2_TestReports"
.\start_dashboard.ps1
```

接口 `/api/health` 会返回当前实际 `logsDir`。

## 关键路径

```text
E:\Brower-Download\seeed\Project_01_WioTrackerL2
├── README.md
├── SNAPSHOT.md
├── start_dashboard.ps1
├── logs\
├── docs\
├── project-background\requirements\
├── tests\meshtastic_cli_demo\
│   ├── runner.py
│   └── cases_l2_demo.json
└── tests\meshtastic_cli_dashboard\
    ├── server.py
    ├── index.html
    ├── app.js
    ├── styles.css
    └── README.md
```

## GitHub

不需要把 GitHub 账号密码发给 Codex。后续如果要推送远端仓库，优先使用你本机已有的 GitHub 登录状态、`gh auth login` 或 token 授权。
