# Project_01_WioTrackerL2 记忆快照

> 更新时间：2026-09-07 17:05 +08:00  
> 项目路径：`E:\Brower-Download\seeed\Project_01_WioTrackerL2`  
> 状态：本项目已包含本地 Meshtastic CLI 自动化 dashboard 代码；代码、资料、日志均在本项目目录内。

## 0. 最新自动化状态（2026-09-07）

- 本地 dashboard 服务：`http://127.0.0.1:8765/`，入口文件 `tests\meshtastic_cli_dashboard\server.py`，当前报告默认保存在 `logs\meshtastic_cli_dashboard_report_*.json`。
- 通信发送不再附带配置写入用的 `--wait-to-disconnect 10`；点对点通信仍按 CLI ACK 判定，频道通信必须由接收端监听到同一条消息才 PASS。
- `Modem Preset` 写入会同时写入 `lora.use_preset=true`，避免只改 `lora.modem_preset` 但设备仍按旧/自定义无线参数运行。
- `Region` 写入表单已合并 Frequency Override：页面展示当前缓存值，默认 `0`，只有可见输入会被写入；不再暗中清空或改写 `lora.override_frequency`。
- 配置写入和通信前配置校验改为批量 `--get` 读取/读回，先比较当前值，值一致时跳过 `--set`、重启等待和重复读回。
- 通信流程和“测试前检查”不再读取 `security.public_key` / `security.private_key`；NodeDB 只作为节点可见性证据，不能证明点对点 ACK 或联系人密钥已确认。
- 新增“建立点对点联系人”辅助入口：使用 `--contact-qr --contact-verified` 生成两端联系人 URL，再用 `--add-contact` 互相导入；该动作会写入 NodeDB，必须显式打开写入/发消息许可。
- 联系人建立流程已改为强前置依赖：两台设备身份都读取成功后才导出/导入联系人；任一设备 `--info` 连接超时，后续联系人写入和 NodeDB 确认直接跳过，避免半边写入。
- 2026-09-07 14:58 的失败报告显示测试设备1 `COM8 --info` 返回 `Connection timed out`，而 XB/COM11 可读取身份、导出联系人和读取节点列表；该轮根因是 COM8 设备连接超时或未就绪，不是 XB 侧联系人导出失败。
- 控制台标题改为通用 `Meshtastic CLI 测试控制台`，适配 Wio Tracker L2、X1/XB 和其他 Meshtastic 设备混测。
- “设备当前配置”文案改为“上次读取配置”；它只在测试前检查、`--info` 或配置读回成功后刷新，不是实时配置流。
- 频道 0 名称不再由 Modem Preset 或历史缓存推断；未读到明确频道名称时显示为“主频道”。
- Channel PSK 只允许 `default`、`none`、`0x...` 或 `base64:...`，避免 `123` 这类短数字被 CLI 解析成 int 后写入 bytes 字段失败。

## 1. 使用规则

- 后续恢复本项目时，先读取本文件，再读取 `docs` 下的原始资料核对最新状态。
- 任何修改了需求、测试用例、缺陷结论、日志证据或截图证据的工作完成后，都要同步更新本快照。
- 本快照只记录可复用结论和索引，不替代原始文件；具体测试步骤、凭证、截图、结果仍以源文件为准。
- 对截图、OCR、日志推断保持证据边界：能直接看到/读到的内容和推断结论必须分开写。
- 用户历史偏好：先理解产品和功能点，再生成或修改测试用例；区分“写实际测试结果”和“编辑测试用例文件”。

## 2. 当前源资料

```text
E:\Brower-Download\seeed\Project_01_WioTrackerL2
├── SNAPSHOT.md
└── docs
    ├── Wio Tracker L2 测试点.xmind
    ├── Wio_Tracker_L2_产品需求规范.md
    ├── Wio_Tracker_L2_测试用例.xlsx
    └── Wio_Tracker_L2_缺陷报告.md
```

- `Wio_Tracker_L2_产品需求规范.md`：v1.0，2026-08-21，基于测试用例覆盖功能点反向整理。
- `Wio_Tracker_L2_测试用例.xlsx`：1 个工作表，171 条用例，10 列字段：功能、用例名称、前置条件、测试方法及试验条件、判断标准及依据、用例等级、测试结果、测试图片、结论、备注。
- `Wio Tracker L2 测试点.xmind`：1 个思维导图，约 215 个主题节点、104 个叶子测试点、6 张内嵌资源图片。
- `Wio_Tracker_L2_缺陷报告.md`：固件 2.7.25，DVT 阶段，9 个缺陷。
- 飞书需求书：`https://seeedstudio.feishu.cn/wiki/Zb6VwzSPriFG3mkJRUUcvHYbn0d`；2026-08-31 直连时跳转到 Feishu 登录页，本轮未能读取正文。后续如有登录态或导出文件，应补充核对。

## 3. 产品理解

Wio Tracker L2 是便携式 LoRa Mesh 自组网通信终端，基于 ESP32-S3 + SX1262 LoRa，运行 Meshtastic MUI 固件。核心场景是无蜂窝网络环境下的文字通信、位置共享、Mesh 组网、节点管理和离线/在线地图查看。

关键硬件能力：

- 主控/通信：ESP32-S3、SX1262 LoRa、WiFi、BLE。
- 人机交互：3.2 英寸 IPS 触摸屏、MUI 图形界面、BaseUI 文本界面、Programming Mode。
- 定位与扩展：GPS、SD 卡离线地图、Grove 混合接口。
- 按键：PWR 物理开关；WAKE 休眠/唤醒；RST 复位；U/B 短按唤醒/休眠/返回/确认，双击广播位置，Reset+U/B 进入升级模式。
- 外部接口：Type-C 用于充电、串口通信、固件烧录。

## 4. 业务/测试主线

主要验证对象不是单一代码模块，而是固件在设备端、LoRa Mesh、手机 APP、网页端和外设组合下的端到端行为。

核心测试链路：

- 固件烧录：Web Flasher、Flash Download Tool、全片擦除后重烧。
- MUI 主界面：消息入口、节点数、时间/Uptime、Radio、信号、消息提醒、GPS、WiFi、MQTT、SD、内存占用、设备识别码。
- 节点列表：节点展示、节点详情、地图跳转、私聊、Filter、Highlight。
- 频道与消息：公频/私频通信、PSK 隔离、频道提醒关闭、消息收发、未读标记、删除会话。
- 地图：SD 离线地图、WiFi 在线地图、平移/缩放/方向键/指向标、地图样式与显示调节。
- 设置：Username、Device Role、Modem Preset、Region、Channel、WiFi、显示、安全、重置、备份恢复、重启/关机。
- Tools：Mesh Detector、Signal Scanner、Trace Route、Statistics、Packet Log。
- 模式切换：MUI、BaseUI、Programming Mode；BaseUI 与 MUI 配置同步。
- 无线通信：EU_868、US_915 等 Region 切换；不同频段隔离；与 X1、Wio Tracker L1、T-deck、RAK、T-LoRa Pager、Cardputer Mesh Kit 等设备兼容通信。
- 配套端：Android/iOS APP 蓝牙/TCP 连接、通信、断连重连；网页端 HTTP/蓝牙/串口连接与通信。
- 硬件：按键、指示灯、Type-C、扬声器、SD 卡、GPS、蓝牙、WiFi、Grove 接口。

## 5. 测试用例覆盖快照

`Wio_Tracker_L2_测试用例.xlsx` 当前统计：

| 功能 | 用例数 |
|---|---:|
| 设置 | 38 |
| 主界面 | 31 |
| LoRa通信 | 21 |
| 节点列表 | 20 |
| 手机APP | 12 |
| 按键 | 9 |
| 模式切换 | 6 |
| 频道 | 5 |
| Tools | 5 |
| 网页端 | 5 |
| 烧录 | 3 |
| 消息 | 3 |
| 地图 | 3 |
| 指示灯 | 2 |
| Type-C | 2 |
| SD卡 | 2 |
| 扬声器 | 1 |
| GPS | 1 |
| 蓝牙 | 1 |
| WiFi | 1 |

用例等级统计：

| 等级 | 数量 |
|---|---:|
| 高 | 54 |
| 中 | 92 |
| 低 | 25 |

当前结论字段基本未填，只有 1 条 `测试结果` 写有待确认；这说明该 Excel 更接近测试设计/计划，不是完整执行结果表。

## 6. 已知缺陷快照

`Wio_Tracker_L2_缺陷报告.md` 当前记录 9 个缺陷：

| ID | 缺陷 | 优先级 | 严重程度 |
|---|---|---|---|
| Bug 1 | WAKE 键偶发无法唤醒设备 | P0 | 重要 |
| Bug 2 | U/B 键唤醒后背光亮度为 0 导致黑屏 | P0 | 重要 |
| Bug 3 | 消息提醒 Banner 和 Sound 不同步 | P1 | 一般 |
| Bug 4 | Channel 频道筛选仅显示本机，不显示同频道其他节点 | P0 | 重要 |
| Bug 5 | 地图页面滑动卡顿，缩放操作易导致白屏 | P0 | 重要 |
| Bug 6 | 修改设备名称后聊天框显示名称未同步更新 | P1 | 一般 |
| Bug 7 | 设置屏幕锁后默认密码 000000 无法解锁设备 | P0 | 严重 |
| Bug 8 | Language 语言切换列表缺少 Japanese 日文选项 | P2 | 一般 |
| Bug 9 | 使用 Signal Scanner 后节点列表被异常筛选且无法恢复 | P1 | 一般 |

缺陷处理注意：

- WAKE/U-B/锁屏类缺陷属于设备可用性风险，优先核对复现条件、固件版本、休眠时长、电源状态。
- 地图白屏/卡顿属于 MUI 性能或资源压力问题，验证时应同时记录地图来源、SD/WiFi 状态、内存占用、操作序列。
- 节点筛选、Signal Scanner、Channel Filter 涉及 NodeDB/筛选状态污染，需保留操作前后节点列表证据。
- OCR 或截图识别得到的缺陷描述只能作为草稿，最终以截图原文和用户确认文本为准。

## 7. 已验证/历史经验

- Meshtastic 角色行为历史结论：
  - Client 会转发其他节点流量，可关注 `txRelay > 0`。
  - Client Mute 保留大部分 Client 行为，但不转发，可关注 `txRelay = 0`。
  - Tracker 上报位置后会关闭 GPS/LCD/LoRa 并进入定时深睡。
- 常用日志关键字：`Routing sniffing`、`enqueue for send`、`txRelay`、`Enter deep sleep for 3600 seconds`、`GPS power state move from HARDSLEEP to OFF`、`L2 VCC_LCD domain cut`。
- Windows 下读取 XMind 可把 `.xmind` 当 zip，解析 `content.json`。
- Windows 下读取 Excel 可用 bundled Python + `openpyxl`；若需要保留格式或编辑工作簿，再使用 spreadsheet artifact 工作流。

## 8. 待确认项

- 飞书需求书正文尚未读取，需要登录态、导出文件或用户提供副本后补充。
- Web Flasher 备注为“还未上线”，需以后续官方状态为准。
- 主界面 `msh/频段` 的具体含义/预期在源资料中有“不知道啥意思/待确认”痕迹，不能擅自定性。
- SD 卡兼容性规格仍待产品定义：容量、品牌、文件系统、地图数据格式。
- Grove 扩展接口在测试点中标注预留/不测，后续若需求变化再扩展。
- 当前没有代码文件；如果后续加入固件源码、测试脚本或自动化框架，需要重建“代码结构/运行方式/验证命令”章节。

## 9. 后续更新触发

完成以下任一动作后，更新本文件：

- 新增、删除、重命名 `docs` 下资料。
- 修改 `Wio_Tracker_L2_测试用例.xlsx` 的模块、用例、等级、结果、备注。
- 修改 `Wio_Tracker_L2_产品需求规范.md` 的业务需求或验收标准。
- 修改 `Wio_Tracker_L2_缺陷报告.md` 的缺陷列表、优先级、严重程度、复现步骤或状态。
- 补充飞书需求书、日志、截图、测试视频、固件版本信息。
- 引入代码、脚本、自动化测试或构建流程。

更新时至少同步：

- `更新时间`
- `当前源资料`
- `测试用例覆盖快照`
- `已知缺陷快照`
- `待确认项`

## 10. 2026-08-31 Meshtastic CLI 自动化 Demo

新增自动化评估与 demo：

```text
E:\Brower-Download\seeed\Project_01_WioTrackerL2
├── docs
│   └── Meshtastic_CLI_自动化测试可行性评估.md
├── logs
│   ├── meshtastic_cli_demo_report_20260831_191742.json
│   ├── meshtastic_cli_demo_report_20260831_191747.json
│   └── meshtastic_cli_demo_report_20260831_191830.json
└── tests
    └── meshtastic_cli_demo
        ├── README.md
        ├── cases_l2_demo.json
        └── runner.py
```

结论：

- Meshtastic 固件设备可以做部分自动化测试，主要覆盖 CLI 环境、设备连接、设备信息、节点列表、配置读取/导出、配置写入、频道/消息/Trace Route、串口日志等。
- 触屏 UI、按键、黑屏/背光、地图卡顿、扬声器、SD 卡热插拔、GPS 户外精度等仍需要人工观察或外部硬件辅助。
- Demo 执行器默认 dry-run；真实执行必须加 `--execute`；修改配置或发消息还必须加 `--allow-mutating`。

验证：

- `python -m py_compile tests\meshtastic_cli_demo\runner.py` 通过。
- `python tests\meshtastic_cli_demo\runner.py` 通过，生成 dry-run 报告。
- `python tests\meshtastic_cli_demo\runner.py --port COM5` 通过，确认命令计划会拼接串口参数，并保护 mutating 步骤。

## 11. 2026-08-31 可视化测试控制台

新增本地可视化系统：

```text
E:\Brower-Download\seeed\Project_01_WioTrackerL2
├── PRODUCT.md
├── DESIGN.md
├── .impeccable
│   └── design.json
└── tests
    └── meshtastic_cli_dashboard
        ├── README.md
        ├── app.js
        ├── index.html
        ├── server.py
        └── styles.css
```

系统能力：

- 启动本地服务后访问 `http://127.0.0.1:8765`。
- 页面按模块展示 demo 用例：环境检查、连接冒烟、节点与配置、配置写入、通信验证。
- 可以一键运行全部、运行单个模块、运行单条用例。
- 支持连接参数：不连接、串口、TCP、BLE。
- 支持 `GET /api/ports` 扫描 Windows 串口；页面加载时自动扫描一次，“扫描串口”按钮可手动刷新。若检测到串口且主连接值为空，会自动填入一个候选 `COMx`。
- 支持目标节点、超时时间、真实执行开关、允许改配置/发消息开关。
- 支持同时接入两台设备的前置识别：Windows 会分配两个 COM 口。当前系统执行时只控制主设备；第二台可通过目标节点 ID 参与消息/ACK 类测试。`辅助设备串口` 字段已预留，后续可扩展双设备 runner 同时控制两台设备。
- 后端调用 `tests\meshtastic_cli_demo\runner.py`，报告写入 `logs\meshtastic_cli_dashboard_report_*.json`。

## 12. 2026-09-04 控制台通信与命名规则

- 设备显示名只来自 `--info` 解析到的 Short Name；读取不到时才回退到节点 ID 后四位，不显示 `#`，也不再把 COM 口拼到设备名后面。
- 修复双设备名称都变成同一个短名的问题：发送命令 stdout 中的目标节点 ID 不再被当作本机身份捕获；只有本机 `--info` 才允许更新设备名/节点 ID。
- 如果缓存的两台节点 ID 相同，通信运行时不再复用缓存，会重新读取两台设备身份，避免把双向发送都发给同一个节点。
- 真实设备命令之间默认增加 3 秒保护间隔；配置写入后的恢复等待默认 10 秒，用于降低设备刚重启/串口刚恢复就被再次打开导致的误判。
- 写入 Region 时，Frequency Override 在同一表单内显式展示和填写；`0` 表示跟随 Region 默认频点，工具不再执行隐藏清零。
- 通信测试未选择新配置时，先最小化校验两台设备当前 `lora.region`、`lora.modem_preset`、`lora.override_frequency` 是否一致，再发送消息。
- 通信默认走频道发送，频道 0 默认显示为 `LongFast`，频道 1 默认显示为 `seeed`；点对点发送模式保留，但必须依赖公钥关系和 ACK。
- 点对点通信判定收紧：只看到 `Sending`、`Connected` 或 CLI 退出码 0 不算通过；出现 `NAK`、`MAX_RETRANSMIT`、`PKI_SEND_FAIL_PUBLIC_KEY`、`No route` 等信息直接 FAIL。
- 执行结果区域只显示最终用例 PASS/FAIL/SKIPPED/DRY_RUN 结果；读写、等待、比较等子步骤进入可点击结果卡的详细证据。统计卡可点击筛选对应状态的用例。

运行命令：

```powershell
python .\tests\meshtastic_cli_dashboard\server.py 8765
```

验证：

- `server.py` 和 `runner.py` 语法解析通过。
- `cases_l2_demo.json` 和 `.impeccable\design.json` JSON 解析通过。
- `GET /api/cases` 返回 5 个模块、6 条 demo 用例。
- `POST /api/run` 运行“环境检查”模块成功，生成 `meshtastic_cli_dashboard_report_20260831_205749.json`。
- `POST /api/run` 运行“节点与配置”模块 dry-run 成功，生成 `meshtastic_cli_dashboard_report_20260831_210025.json`。
- Impeccable 设计检测返回空数组，但处于降级模式：HTML/CSS 解析依赖缺失，结果不能等同完整视觉审查。
- Python Playwright 因 `greenlet` DLL 加载失败，未完成自动截图验证；页面已通过 Codex 右侧浏览器打开人工可视检查。

## 12. 2026-09-01 COM7 实机连接验证

现象：

- 用户确认设备接入后，串口工具可识别为 `COM7`。
- 原 `/api/ports` 返回 0 的原因：项目本地/运行时缺少 `pyserial` 时会走 PowerShell fallback，但 fallback 的 COM 口正则转义过度，未正确匹配 `USB 串行设备 (COM7)`。

修复：

- `tests\meshtastic_cli_dashboard\server.py` 的串口扫描改为三层策略：`pyserial`、WMI/CIM、`.NET SerialPort.GetPortNames()`。
- 修复 PowerShell JSON 输出编码，避免中文设备名触发解码问题。
- 在项目 `.venv` 安装 Meshtastic CLI，并让 `runner.py` 和 dashboard 默认使用：

```text
E:\Brower-Download\seeed\Project_01_WioTrackerL2\.venv\Scripts\meshtastic.exe
```

当前服务：

```text
http://127.0.0.1:8765
pid=4376
```

验证：

- `.venv\Scripts\meshtastic.exe --version` 返回 `2.7.11`。
- `/api/health` 返回 `meshtasticCli` 为项目 `.venv` 下的 `meshtastic.exe`。
- `/api/ports` 已返回 `COM7`，名称 `USB 串行设备 (COM7)`，VID/PID `303A:1001`，`likelyDevice=true`。
- dashboard 真实执行 `L2-CLI-001` 通过。
- dashboard 真实执行 `L2-CLI-002` 通过，命令为 `.venv\Scripts\meshtastic.exe --port COM7 --info`。
- `--info` 输出包含 `Connected to radio`、`pioEnv=seeed_wio_tracker_L2`、`hwModel=SEEED_WIO_TRACKER_L2`、`role=CLIENT`、`firmwareVersion=2.7.27.2fea29b`、`nodedbCount=35`。

注意：

- 如果串口工具正在打开 `COM7`，真实 CLI 执行可能因端口占用失败；运行 dashboard 实机测试前应关闭串口工具。

## 13. 2026-09-01 双串口选择与结果解释修订

用户反馈：

- 页面表现像把串口定死为 `COM7`，切换连接方式后仍显示 `COM7`。
- 两台设备同时接入时，主设备和辅助设备都应来自扫描结果，不应手动输入。
- 同一个串口被选为主设备后，不应再允许选为辅助设备。
- 测试模块含义、所需测试数据、PASS/FAIL 判定原因、报告记录作用不够清楚。

修复：

- `tests\meshtastic_cli_dashboard\index.html` 改为按连接方式显示不同输入区域：
  - 串口模式：`主设备串口`、`辅助设备串口` 均为扫描下拉框。
  - TCP 模式：只显示 `TCP 地址`。
  - BLE 模式：只显示 `BLE 名称或地址`。
- `tests\meshtastic_cli_dashboard\app.js` 增加串口角色选择逻辑：
  - `/api/ports` 扫描到的所有串口都会进入两个下拉框。
  - 主设备选择 `COM7` 后，辅助设备下拉框禁用 `COM7`；反向同理。
  - 两台及以上设备接入时不再自动强行填入第一个串口，避免误把 `COM7` 当成固定值。
- `tests\meshtastic_cli_demo\cases_l2_demo.json` 升级到 `0.2`：
  - 每条用例补充 `test_data`、`pass_meaning`、`failure_help`。
  - 将原“节点与配置”拆成 `节点列表` 和 `配置快照`，避免一个长命令超时掩盖另一个命令已通过。
  - `--export-config` 标记为 `sensitive_output=true`，页面默认提示完整配置在报告 JSON 中，避免把频道/配置细节直接铺开。
- `tests\meshtastic_cli_demo\runner.py` 增加：
  - 子步骤耗时记录。
  - 用例元信息写入报告。
  - `requires_previous_pass` 依赖控制。配置写入未授权时，后置 `--info` 校验现在显示 `dependency_not_run`，不再误报成写入验证失败。
- `tests\meshtastic_cli_dashboard\server.py` 增加：
  - `primaryPort`、`peerPort` 标准化入参。
  - runner 子进程 `PYTHONIOENCODING=utf-8`，减少 Windows stdout 中文乱码。

本轮实测结论：

- `/api/ports` 当前识别到两台设备：
  - `COM7`，`USB 串行设备 (COM7)`，`VID:PID=303A:1001`。
  - `COM8`，`USB 串行设备 (COM8)`，`VID:PID=303A:1001`。
- `POST /api/run` dry-run 验证 `primaryPort=COM7`、`peerPort=COM8` 时，实际 runner 命令只使用 `--port COM7`，辅助串口仅记录角色，不会重复占用。
- 配置写入保护验证通过：未打开“允许改配置/发消息”时，`set_owner=SKIPPED/mutating_guard`，`verify_owner=SKIPPED/dependency_not_run`。
- 当前页面地址仍为 `http://127.0.0.1:8765`，当前监听 PID 为 `26996`。

对旧报告的解释：

- `20260901_120944` 连接冒烟 PASS：`--info` 返回 0，且输出包含 `Connected to radio`、`Owner`、`My info` 等字段。该 PASS 只证明连接和设备信息读取成功，不证明没有重启，也不覆盖其他功能。
- `20260901_121345` 节点与配置 FAIL：其中 `--nodes` 已 PASS，`--export-config` 因 timeout 失败。旧页面按模块汇总后显示 FAIL，容易误解为整个模块都失败。
- `20260901_121522` 配置写入 FAIL：当时未打开写入许可，`set_owner` 被 `mutating_guard` 跳过；旧 runner 仍继续执行 `verify_owner`，因读不到新名称导致 `regex_not_matched`。此逻辑已修正。

## 14. 2026-09-01 仓库初始化、Excel 用例映射与 UI 重构

用户反馈：

- 不应要求提供 GitHub 账号密码。
- 串口模式进入后不应在未点击扫描时直接显示 `COM7` / `COM8`。
- UI 交互、布局、列表密度和字体层级混乱。
- 单次运行新模块后旧模块结果消失，不利于多模块连续验证。
- `Nodes|User|AKA|ID...` 这类正则原因不够像业务判定，且命令证据出现乱码。
- 配置写入不应只覆盖用户名，测试表中还有 Channel、Modem Preset、Device Role、WiFi、MQTT、GPS、Region 等配置项。
- 两台设备的目的应服务于通信验证。

处理：

- 已在 `E:\Brower-Download\seeed\Project_01_WioTrackerL2` 初始化本地 Git 仓库：
  - 分支：`main`。
  - 新增 `.gitignore`，排除 `.venv/`、`logs/*.json`、`tmp/`、`__pycache__/` 等运行产物。
  - 当前未做初始提交，因为本机 Git `user.name` / `user.email` 未配置；不要让用户提供 GitHub 明文密码，远端仓库后续应使用 GitHub 登录态、`gh auth login` 或 token。
- 已复制用户新提供的 Excel：
  - 源文件：`C:\Users\EDY\Downloads\Wio Tracker L2 测试用例.xlsx`。
  - 项目内背景资料：`project-background\requirements\Wio Tracker L2 测试用例.xlsx`。
  - 该文件约 30MB，Excel 单元格中只有标题，主体是 148 张内嵌截图/证据图片。
- 已从旧结构化 Excel `docs\Wio_Tracker_L2_测试用例.xlsx` 抽取 171 条结构化用例到：
  - `project-background\requirements\structured_testcases_from_legacy_xlsx.json`。
  - 模块计数：设置 38、主界面 31、LoRa通信 21、节点列表 20、手机APP 12、按键 9、模式切换 6、Tools 5、网页端 5、频道 5、地图 3、消息 3、烧录 3、SD卡 2、Type-C 2、GPS 1、WiFi 1、扬声器 1、蓝牙 1。
- `tests\meshtastic_cli_demo\cases_l2_demo.json` 升级到 `0.3`：
  - 11 条 demo 用例、9 个模块：环境检查、连接冒烟、双机连接、节点列表、配置读取、配置字段清单、配置快照、配置写入、通信验证。
  - 配置读取覆盖 `device.role`、`lora.region`、`lora.modem_preset`、`lora.tx_enabled`、`position.gps_enabled`、`network.wifi_enabled`、`mqtt.enabled`、`bluetooth.enabled`。
  - 配置写入新增 `device.role=CLIENT`、`lora.modem_preset=LONG_FAST` 示例，仍受 `允许改配置/发消息` 保护。
  - 通信验证改为双机流程：先从辅助设备 `--info` 提取 `myNodeNum` 并换算为 `!xxxxxxxx`，再由主设备执行 `--sendtext ... --ack`。
- `tests\meshtastic_cli_demo\runner.py`：
  - 支持 `--peer-port`。
  - 支持 step `target=primary|peer`。
  - 支持从辅助设备输出捕获节点 ID，并作为后续发送目标。
  - 正则判定从“任意命中”改为：`expect_stdout_regex` 全部必须命中；`expect_stdout_regex_any` 才是任意命中。
- `tests\meshtastic_cli_dashboard\server.py`：
  - 支持 `targetType=modules`，一次运行多个勾选模块。
  - 支持把 `peerPort` 传给 runner。
- `tests\meshtastic_cli_dashboard\app.js`：
  - 取消页面加载时自动扫描串口，串口列表只在点击“扫描串口”后出现。
  - 结果改为累计显示，只有点击“清空结果”才清除。
  - 新增“运行选中模块”。
  - PASS 原因优先显示 `pass_criteria`，不再把原始正则当成主要解释。
- `tests\meshtastic_cli_dashboard\styles.css`：
  - 重构为设备连接、测试计划、累计结果三列工作台。
  - 模块从大卡片改为紧凑可勾选行，降低文字堆叠。
  - 命令证据和报告记录保留下方独立区域。
- `PRODUCT.md` / `DESIGN.md` 已同步当前能力和交互。

当前验证：

- 服务地址：`http://127.0.0.1:8765`。
- 当前服务启动 PID：`29576`。
- `/api/cases` 返回版本 `0.3`，模块包括：环境检查、连接冒烟、双机连接、节点列表、配置读取、配置字段清单、配置快照、配置写入、通信验证。
- dry-run 验证 `targetType=modules` 可一次运行多个模块；示例请求覆盖连接冒烟、双机连接、配置读取、通信验证。
- dry-run 验证 `primaryPort=COM7`、`peerPort=COM8` 会传入主/辅角色；通信验证用例已具备从辅助设备提取目标节点 ID 的执行链路。
- Python 语法检查、前端 JS `node --check`、用例 JSON 解析均通过。
- Impeccable detect 返回 `[]`，但处于降级模式：HTML/CSS parser 依赖缺失，结果是欠检测，不等同完整视觉审查。
- Playwright 截图仍失败：`ImportError('DLL load failed while importing _greenlet: 找不到指定的模块。')`。

注意：

- 本轮未真实执行会改配置或发消息的命令。
- 当前 `/api/ports` 某次实时扫描只返回 `COM8`；如果 `COM7` 未出现，优先确认设备是否重启中、是否断开、或是否被串口工具占用。

## 15. 2026-09-01 覆盖矩阵与仓库补齐

用户补充：

- 新 Excel 中的图片只是测试截图，不需要分析图片内容。
- 两个 sheet 是同一份用例，只参考第一份即可。
- 这些是实际执行用例，是在旧 AI 生成用例基础上优化后的版本；自动化测试项可据此判断。

处理：

- 不再继续分析 `project-background\requirements\Wio Tracker L2 测试用例.xlsx` 内嵌图片。
- 保留该 Excel 在项目背景资料目录，但 `.gitignore` 已忽略 `project-background/requirements/*.xlsx`，避免 30MB 截图型文件进入代码仓库。
- 新增覆盖矩阵生成脚本：
  - `tests\meshtastic_cli_demo\build_coverage_matrix.py`
  - 输入：`project-background\requirements\structured_testcases_from_legacy_xlsx.json`
  - 输出：`project-background\requirements\automation_coverage_matrix.json`
  - 输出：`docs\Wio_Tracker_L2_Meshtastic_CLI_自动化覆盖矩阵.md`
- 覆盖矩阵当前统计：
  - 总用例：171。
  - `auto`：45 条，CLI 可直接执行并形成主要判定证据。
  - `assisted`：68 条，CLI 可准备、读取或记录证据，但最终仍需人工/外部观察。
  - `manual`：58 条，当前缺少稳定 CLI 信号。
- 修复覆盖分类规则：
  - 英文短词如 `BLE` 改为词边界匹配，避免误命中 `Enable` 这类字符串。
  - GPS 行不再被误打 `bluetooth_config` 标签。
- `tests\meshtastic_cli_dashboard\server.py` 新增：
  - `GET /api/coverage`，供页面读取覆盖矩阵统计。
- `tests\meshtastic_cli_dashboard\index.html` / `app.js` / `styles.css` 新增：
  - 左侧 `自动化覆盖` 概览，展示可自动化、可辅助、人工数量。
- 双机通信 dry-run 细节修复：
  - 真实执行时：先从辅助设备 `--info` 提取 `myNodeNum`，再作为主设备 `--sendtext --ack` 目标。
  - dry-run 时：无法真实提取节点 ID，命令中使用占位 `!peer_node_id` 展示执行意图。
- 新增仓库辅助文件：
  - `README.md`：项目能力、启动方式、关键路径、GitHub 凭据说明。
  - `start_dashboard.ps1`：一键启动本地 dashboard。

当前验证：

- `start_dashboard.ps1` PowerShell 解析通过。
- `runner.py`、`server.py`、`build_coverage_matrix.py` Python 语法检查通过。
- `app.js` Node 语法检查通过。
- `/api/coverage` 返回 `total=171`、`auto=45`、`assisted=68`、`manual=58`。
- `/api/cases` 返回 `version=0.3`、`caseCount=11`。
- 通信验证 dry-run：
  - 辅助设备命令：`meshtastic.exe --port COM8 --info`。
  - 主设备命令：`meshtastic.exe --port COM7 --dest !peer_node_id --sendtext L2_AUTO_TEST_DEMO --ack`。
- Git 仓库状态：
  - 已初始化 `.git`，分支为 `main`。
  - 代码和文档未提交。
  - `.venv/`、`logs/`、`tmp/`、`project-background/requirements/*.xlsx` 已忽略。
- 当前服务地址：`http://127.0.0.1:8765`。
- 当前监听 PID：`27832`。该进程命令行显示 Codex bundled Python；项目健康接口仍指向 `.venv\Scripts\meshtastic.exe` 作为 Meshtastic CLI。

未做：

- 未创建 GitHub 远端仓库。
- 未要求、也不应要求用户提供 GitHub 账号密码。
- 未真实执行改配置或发消息命令。

## 16. 2026-09-01 串口映射、双向通信与用户配置写入修订

用户最新反馈：
- 主界面不需要展示“自动化覆盖”统计块，避免干扰实际执行。
- 串口下拉只显示 COM 号；设备标识要能辅助判断哪个物理设备对应哪个 COM。
- 双机连接的目的应服务于通信验证：两台设备需要互相发送消息，而不是只主到辅单向发送。
- 测试结果标题和通过原因必须使用中文业务口径，不能把正则表达式当成主要解释。
- 模块列表需要全选、全取消；结果需要累计保留。
- 配置写入应由用户输入字段和值，并支持主设备、辅助设备、两台设备三种目标。

本轮处理：
- `tests\meshtastic_cli_dashboard\index.html` 移除主界面的“自动化覆盖”统计块；新增“配置写入”区域；新增模块“全选”和“全取消”按钮。
- `tests\meshtastic_cli_dashboard\app.js` 让串口下拉只显示 `COMx`；扫描卡片显示 `COMx + 设备ID`；主/辅串口互斥；结果累计保留；通过原因改成中文业务解释；双向通信步骤显示方向和消息内容。
- `tests\meshtastic_cli_dashboard\server.py` 的 `/api/ports` 增加 `deviceId`、`usbSerial` 字段；支持 `targetType=customConfig`。
- `tests\meshtastic_cli_demo\runner.py` 支持 `--custom-only`、`--config-field`、`--config-value`、`--config-target primary|peer|both`；支持解析 `--info` 摘要；对 private key、PSK、password、admin key 等敏感字段脱敏。
- `tests\meshtastic_cli_demo\cases_l2_demo.json` 升级为 `0.4`，固定 demo 用例调整为 9 条中文模块；通信验证改为读取两端节点 ID 后执行主到辅、辅到主两条消息。
- `DESIGN.md` 与 `.impeccable\design.json` 同步为当前灰白测试台视觉和交互规则。

当前设备扫描结果：
- `/api/ports` 当前显示 Windows 分配为 `COM31 -> USB位置 1-5`、`COM32 -> USB位置 1-3`。
- CH340K 串口没有提供真实 USB 序列号时，只能显示 USB 位置/实例来区分当前连接；Meshtastic 节点 ID 需要运行“主设备识别”或“双设备身份读取”从固件读取。

验证：
- Python 语法检查通过：`.\.venv\Scripts\python.exe -m py_compile tests\meshtastic_cli_demo\runner.py tests\meshtastic_cli_dashboard\server.py tests\meshtastic_cli_demo\build_coverage_matrix.py`
- 前端 JS 语法检查通过：`node --check tests\meshtastic_cli_dashboard\app.js`
- JSON 解析通过：`.impeccable\design.json`、`tests\meshtastic_cli_demo\cases_l2_demo.json`
- `/api/cases` 返回 `version=0.4`、`caseCount=9`。
- 双向通信 dry-run 展开为 `COM31 --info`、`COM32 --info`、`COM31 --dest !peer_node_id --sendtext L2主到辅自动化验证 --ack`、`COM32 --dest !primary_node_id --sendtext L2辅到主自动化验证 --ack`。
- 用户配置写入 dry-run `device.role=CLIENT`、目标 `both` 展开为主/辅两端各自 `--set` 和 `--get`。
- 多模块 dry-run 验证通过：一次请求可运行 `主设备识别` 和 `双设备身份读取` 两个模块。
- Impeccable detect 返回 `[]`，但检测处于降级模式；HTML/CSS parser 依赖缺失，结果不能等同完整视觉审查。

当前服务：
```text
http://127.0.0.1:8765
pid=25908
```

注意：
- 未真实执行会改配置或发消息的命令；本轮实机相关验证只做接口和 dry-run 链路。
- 设备连接串口号会随 Windows 重新枚举变化，后续以页面“扫描串口”的实时结果为准。
## 17. 2026-09-01 配置后通信验证、进度与报告交互修订

用户最新反馈：
- 配置字段和值必须可修改；枚举和开关类配置需要下拉选择，自定义字段和值需要输入。
- 点对点通信前提是两台设备联系人/公钥关系已经建立，且 Modem Preset、频率/区域、信道等通信条件一致；频道通信不依赖点对点联系人关系。
- 自动化应按控制变量法设计：可选择配置，先配置两台设备，再验证是否能通信。
- 运行模块时需要可视化进度，不能让长命令或设备重启等待看起来像卡死。
- 模块选择只保留左上角一个全选复选框，不保留两个大按钮。
- 报告记录需要能看到具体内容，并明确保存目录和下载方式。
- 读取配置结果要直接展示读回值；节点列表只应作为 NodeDB 可见性证据，不应作为孤立业务通过项，也不能直接证明 ACK。
- 通信消息需要按设备语言设置；通信验证应主到辅、辅到主双向发送。

本轮处理：
- `tests\meshtastic_cli_demo\runner.py` 重构为进度事件型执行器：
  - 新增 `--progress-out` 输出 JSONL 进度事件。
  - 新增 `--experiment-only`、`--experiment-apply-config`、`--experiment-region`、`--experiment-modem`、`--message-primary`、`--message-peer`、`--reboot-wait`。
  - 新增“配置后通信验证”动态用例：读取两台设备节点 ID，可选写入两台设备相同 `lora.region` / `lora.modem_preset`，等待重启后检查双向 NodeDB 可见性，再执行主到辅、辅到主两条 `--sendtext --ack`。
  - `--get` 结果会解析并记录读回值，供页面直接展示。
  - NodeDB 检查现在只用于判断对端节点是否已知，失败原因会标记为 `node_not_found:<node>`。
- `tests\meshtastic_cli_dashboard\server.py` 改为后台任务执行：
  - `POST /api/run` 立即返回 job id。
  - `GET /api/run-status?id=...` 返回任务状态、进度摘要和最新报告。
  - `GET /api/report?name=...` 打开 JSON 报告，`download=1` 时下载报告。
  - 报告文件和进度文件写入 `E:\Brower-Download\seeed\Project_01_WioTrackerL2\logs`。
- `tests\meshtastic_cli_dashboard\index.html` / `app.js` / `styles.css` 完成 UI 修订：
  - 配置字段可切换，常用字段提供枚举/开关下拉，自定义字段和值可输入。
  - 新增“配置后通信验证”区域，可一键选择配置并执行通信验证。
  - 新增运行进度条和步骤进度列表。
  - 模块工具栏改为单个全选复选框。
  - 结果卡片展示读回值、通信方向和消息内容。
  - 报告记录提供“打开”和“下载”。
- `tests\meshtastic_cli_demo\cases_l2_demo.json` 升级到 `0.5`：
  - 模块收敛为 CLI 检查、双设备前置、通信配置读取、配置字段清单、配置快照、双向消息 ACK。
  - 删除孤立的节点列表模块；节点读取改为通信前置判断。
- `README.md`、`tests\meshtastic_cli_dashboard\README.md`、`tests\meshtastic_cli_demo\README.md` 已同步当前启动方式、推荐流程、报告目录和 CLI 参数。
- `DESIGN.md` 已同步进度、报告、读回值、控制变量通信验证和 NodeDB 语义规则。
- `start_dashboard.ps1` 改为先停止占用 `8765` 的旧服务，再启动当前代码，避免浏览器仍访问旧服务。

验证状态：
- 按用户要求，本轮未执行本地验证命令、未重启服务、未连接设备、未运行 dry-run 或真实测试。
- 用户后续验证前需要重新运行：
```powershell
cd E:\Brower-Download\seeed\Project_01_WioTrackerL2
.\start_dashboard.ps1
```
## 18. 2026-09-02 报告/进度修复与双设备通信流程重构

用户反馈：
- 报告记录点击“打开”会重新打开控制台页面，下载也不可用。
- 执行完模块后页面没有执行结果，运行结束后也看不到进度。
- 页面文字提示过多，布局仍然啰嗦。
- “主设备 / 辅助设备”命名容易带偏，改为“测试设备1 / 测试设备2”。
- 通信验证不应自动写配置并导致两台设备反复重启；应先配置完成，再进入通信。
- 发送消息不应由系统按语言生成，消息内容应留空，由用户填写。
- 测试前检查应合并：本机 CLI 检查 + 双设备身份、当前关键配置读取、NodeDB 可见性；不再读取公私钥。
- 用户配置写入应作为测试项：用户设置字段和值，保存后下发设备，再读回检查。

本轮处理：
- `tests\meshtastic_cli_dashboard\index.html` 重构为三段工作流：
  - 左侧只保留连接方式、测试设备1/2串口、高级参数、真实执行和允许写配置/发消息。
  - 中间为“测试流程”，静态流程只保留“测试前检查”和“辅助工具”。
  - 中间新增“测试项：配置写入”和“测试项：通信”，替代原来分散在左侧和底部的配置/通信控件。
- `tests\meshtastic_cli_dashboard\app.js` 修复：
  - 报告“打开”改为在页面命令/报告内容区直接显示 JSON。
  - 报告“下载”改为前端生成 JSON Blob 下载，不依赖浏览器直接打开接口。
  - 后台任务结束后不会再被 `setRunning(false)` 覆盖成“待运行”，结果卡片会保留。
  - 若 runner 未生成报告结果，会生成一条可见的执行异常结果，避免页面空白。
  - dry-run 或 mutating guard 跳过时，不会把通信配置标记为已完成。
  - 消息内容必须用户填写；系统不再根据语言生成消息。
- `tests\meshtastic_cli_dashboard\server.py` 新增 `targetType=communicationConfig`：
  - 调用 runner 的 `--communication-config-only`。
  - 后台任务总超时按任务步骤规模估算，不再按“选中用例数量”粗略估算，减少长流程被父进程提前杀掉导致无结果。
  - 修复 `rebootWait=0` 被错误恢复为默认 8 秒的问题。
- `tests\meshtastic_cli_demo\runner.py` 修复：
  - 新增 `--communication-config-only`，只下发并读回通信配置。
  - `--experiment-only` 只做通信验证，不再自动写配置。
  - 通信配置下发把同一台设备的 `lora.region` 和 `lora.modem_preset` 合并为一条链式 `--set` 命令，减少重复重启。
  - 通信验证读取测试设备1/2节点 ID，检查双向 NodeDB 可见性，再发送用户填写的双向消息。
  - PSK、密码等敏感字段继续脱敏，不在页面暴露原文。
- `tests\meshtastic_cli_demo\cases_l2_demo.json` 升级为 `0.6`：
  - 静态用例收敛为“测试前检查”和“辅助工具”。
  - 删除静态“测试项”消息用例，避免普通模块列表无法带入页面消息而发空消息。
- `README.md`、dashboard README、runner README、`PRODUCT.md`、`DESIGN.md` 已同步测试设备1/2、两阶段通信、报告打开/下载和配置保存后下发的说明。

验证：
- Python 语法检查通过：
```powershell
.\.venv\Scripts\python.exe -m py_compile tests\meshtastic_cli_demo\runner.py tests\meshtastic_cli_dashboard\server.py
```
- 前端 JS 语法检查通过：
```powershell
node --check tests\meshtastic_cli_dashboard\app.js
```
- 用例 JSON 解析通过。
- Impeccable 静态 UI 检测返回 `[]`，但检测处于降级模式，HTML/CSS parser 依赖缺失，结果不能等同完整视觉审查。
- 无设备 dry-run 通过：
  - `--communication-config-only --experiment-region CN --experiment-modem LONG_FAST`
  - `--experiment-only --message-primary "hello-1" --message-peer "hello-2"`
- 本地服务已重启，当前地址 `http://127.0.0.1:8765`，监听进程 PID 为 `22888`。
- 本轮未执行真实串口连接、未写设备、未发送真实消息。

注意：
- 需要用户重新运行 `.\start_dashboard.ps1` 才能让浏览器访问新服务代码。
- 官方 Meshtastic CLI 支持链式 `--set`，通信配置下发已按该方式减少重复重启。

## 19. 2026-09-02 频率覆盖、频道测试与通信 UI 再收敛

用户反馈：
- `L2-CLI-005 导出测试设备1配置` 失败原因不清晰；该步骤实际是完整配置取证，不应影响核心通信测试。
- 通信消息只需要一个输入框，两台设备互相发送同一条用户填写消息。
- “已确认两台设备通信配置一致”勾选没有明确价值，容易绕过必要前置。
- 运行检查时已经能读取设备 ID，后续结果和证据应优先用节点 ID 后四位识别设备。
- Region 之外还需要支持 App 里的频率覆盖能力，例如把实际频率覆盖到 `868` MHz。
- 通信测试项需要加入频道变量；频道名称和 PSK 是双机通信能否互通的关键条件。
- “辅助工具”用途不清晰，默认执行会增加噪声和超时风险。

本轮处理：
- `tests\meshtastic_cli_demo\runner.py`：
  - 新增 `--override-frequency`，写入 `lora.override_frequency` 并读回。
  - 新增 `--channel-index`、`--channel-name`、`--channel-psk`，底层生成 `--ch-index` / `--ch-set` 频道配置命令。
  - 通信配置动态用例扩展为 Region、Modem Preset、频率覆盖、频道名称和频道 PSK。
  - 修复 `--reboot-wait 0` 时等待步骤被误生成空 meshtastic 命令的问题。
  - 报告写入前会在已读取节点 ID 的情况下，把“测试设备1/2”替换为节点 ID 后四位标签。
- `tests\meshtastic_cli_dashboard\server.py`：
  - API 接收频率覆盖和频道配置字段，并传给 runner。
  - 禁止 paired 通信配置使用 `psk=random`，避免两台设备生成不同 PSK。
- `tests\meshtastic_cli_dashboard\index.html` / `app.js` / `styles.css`：
  - 去掉“已确认两台设备通信配置一致”勾选。
  - 通信消息改为单输入框，页面把同一条消息传给两个发送方向。
  - 通信配置表单新增频率覆盖 MHz、频道索引、频道名称、频道 PSK。
  - 配置字段列表新增 `lora.override_frequency` 和 `lora.channel_num`。
  - 运行结果、进度、命令摘要和配置目标下拉在读取到节点 ID 后使用 `#后四位` 标签。
  - “运行全部检查”改为“运行测试前检查”，只运行静态前置检查。
  - 静态“辅助工具”改名为“可选取证”，默认不选中；完整配置导出超时时建议单独提高超时运行。
- `README.md`、runner README、dashboard README、`PRODUCT.md`、`DESIGN.md` 已同步新流程。
- 新增记忆更新：`C:\Users\EDY\.codex\memories\extensions\ad_hoc\notes\2026-09-02-wio-tracker-l2-latest-dashboard-rules.md`。

验证：
- Python 语法检查通过：
```powershell
.\.venv\Scripts\python.exe -m py_compile tests\meshtastic_cli_demo\runner.py tests\meshtastic_cli_dashboard\server.py
```
- 前端 JS 语法检查通过：
```powershell
C:\Users\EDY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check tests\meshtastic_cli_dashboard\app.js
```
- 用例 JSON 解析通过，`/api/cases` 返回 `version=0.7`、`caseCount=4`、模块为 `测试前检查,可选取证`。
- 无设备 dry-run 通过：
  - `--communication-config-only --experiment-region EU_868 --experiment-modem LONG_FAST --override-frequency 868 --channel-index 0 --channel-name LongFast --channel-psk default --reboot-wait 0`
  - `--experiment-only --message-primary "hello" --message-peer "hello"`
- API 级 dry-run 通过，生成 11 个通信配置步骤，并包含 `--override-frequency`、`--ch-index`、`--ch-set`。
- API 级 `psk=random` 拒绝验证通过。

当前服务：
```text
http://127.0.0.1:8765
pid=29532
```

注意：
- 本轮未连接真实串口、未写设备、未发送真实消息。

## 22. 2026-09-03 通信单按钮、设备命名和失败重试收敛

用户反馈：
- 串口详情里的 USB 设备 ID 与结果里的节点 ID 后四位不是同一个编号，目标下拉混在一起容易误判设备归属。
- 通信不应强制先单独下发配置；没有选择新配置时应该可以直接通信。
- 通信按钮应内部判断：选择了新 Region / Modem Preset / Frequency Override 就先下发两台设备并检查，未选择就直接通信。
- 前置步骤失败后跳过需要说明具体被哪一步阻塞，并支持重试。
- 配置项仍过多，TX、Serial、Screen Wake、Message Bubbles、12H Clock、Custom Field 等不适合作为当前主测试台常用项展示。
- Language 只保留当前需要的 English、日本语、简体中文。

本轮处理：
- `tests\meshtastic_cli_dashboard\app.js`：
  - 写入目标下拉改为 `测试设备1 · COMx` / `测试设备2 · COMx`，不再把 Meshtastic 节点 ID 后四位塞进目标选择名，避免与 USB 设备 ID 混淆。
  - 结果证据仍会在 `--info` 成功后用节点 ID 后四位辅助识别设备。
  - 通信验证改成单一“运行通信”入口；勾选通信配置时先执行 `communicationConfig`，全部 PASS 后自动执行 `communicationExperiment`；未勾选配置时直接执行通信验证。
  - 配置项收窄为 User name、Region、Modem Preset、Frequency Override、Channel、Device Role、WiFi、GPS、MQTT、Bluetooth、Language。
  - Language 下拉收窄为 English、日本语、简体中文；但本地 meshtastic Python protobuf 暂未暴露 Japanese 枚举，真实写入时仍以 CLI 返回为准。
  - 结果卡片新增“重试本轮”，失败后可用同一请求参数重新跑。
  - `could not open port` / `系统找不到指定的文件` 会提示重新扫描串口后重试。
  - 切换串口后清空旧节点标签和频道缓存，避免跨设备显示上一次频道名。
  - 报告下载改为前端 Blob 下载；失败时直接显示本机 `logs` 目录。
- `tests\meshtastic_cli_demo\runner.py`：
  - 前置依赖跳过时记录 `blocked_by`，让前端能显示具体阻塞步骤。
- `index.html`：
  - 删除“下发通信配置并检查”单独按钮，只保留“运行通信”。
- `README.md`、dashboard README、`PRODUCT.md`、`DESIGN.md` 已同步通信单按钮和配置项收窄规则。

说明：
- `COMx` 是 Windows 当前分配的串口号；`USB 设备 ID` 来自 Windows/USB 枚举；`#ABCD` 是 Meshtastic 节点 ID 后四位，三者不能直接等同。
- 配置写入触发设备重启/串口断连恢复属于常见现象，但自动化应先读取当前值并跳过一致项，避免重复重启。
- 报告默认保存在本机项目 `logs` 目录；多人共用测试台时可用 `MESHTASTIC_DASHBOARD_LOG_DIR` 指到共享目录。

验证：
- 本轮只做静态和 dry-run 验证，不连接真实串口、不写设备、不发送真实消息。

## 23. 2026-09-03 写后等待、Language 人工项和通信前置复用

用户反馈：
- Language 配置为简体中文失败。
- 读设备和写设备都会引起重启/断连，写后立刻读可能在配置尚未生效时判失败。
- 频道 0 显示 `seeed` 存疑，初始频道需要保留。
- 设备名不应变成 NodeDB 里的其他节点，例如 `EBD2`；应使用当前接入设备 ID 后四位/short name。
- 通信测试运行前已经完成前置检查时，不应重复读 ID 和 NodeDB。

本轮处理：
- `tests\meshtastic_cli_demo\runner.py`：
  - `--info` 节点识别优先使用本机 `myNodeNum` 换算节点 ID，并优先从 `Owner:` 行解析本机 long/short name，避免从 NodeDB 里抓到其他节点。
  - 配置写入流程改为 `读取当前值 -> 写入 -> 等待配置生效 -> 读回`，等待秒数来自 `--reboot-wait`。
  - Channel 写入也加入写后等待和再次读回。
  - 非写入读取命令遇到临时串口不可用时会重试，缓解设备重启/重新枚举窗口。
  - CLI 输出 `do not have attribute`、`unknown field`、`invalid value` 时直接判为 `unsupported_config_field`，不再因为看到 `Connected` 误判 PASS。
  - 通信验证支持 `--primary-node-id` 和 `--peer-node-id`；两者存在时只执行两条双向发送步骤，不重复前置检查。
- `tests\meshtastic_cli_dashboard\app.js` / `index.html` / `styles.css`：
  - 写入目标在未读到 ID 前显示 `测试设备1 · COMx`；前置检查读到 ID 后显示 `#ABCD · COMx`，结果步骤直接显示 `#ABCD`。
  - 默认频道恢复为 `频道 0 · Primary`，切换串口会重置旧频道缓存。
  - 配置写入新增“写后等待秒数”，默认 20 秒。
  - 通信配置等待默认 20 秒。
  - 通信请求会带上前置检查缓存的两台设备节点 ID。
  - Language 改为当前 CLI 不支持的人工项提示，不再发送 `device_ui.language` 写入命令。
- `README.md`、dashboard README、`PRODUCT.md`、`DESIGN.md` 已同步。

验证：
- Python 语法检查通过。
- 前端 JS 语法检查通过。
- dry-run：已知节点 ID 的通信验证只生成 2 条双向发送步骤。
- dry-run：配置写入生成 4 步：读当前值、写入、等待、读回。

注意：
- 本轮未连接真实串口、未写设备、未发送真实消息。
- 当前日志证据显示本机 CLI 字段列表没有 `device_ui.language`；Language 相关用例暂不能通过 Meshtastic CLI 自动写入，只能作为人工验证项或后续等 CLI/固件暴露字段后再接入。
- 官方 Meshtastic CLI 文档显示 CLI 支持 `--set` 配置字段，LoRa 配置中包含 `override_frequency`；本地 CLI help 也确认频道配置支持 `--ch-index` 和 `--ch-set`。

## 20. 2026-09-03 配置写入与通信验证再拆分

用户反馈：
- 写入目标只显示 `#EBD2` 会让人不知道是哪台设备；目标选择需要同时看到测试设备编号、节点 ID 后四位和 COM 口。
- `role = 0`、`region = 1` 这类读回值必须显示为设备上的具体含义，例如 `CLIENT`、`US`。
- Modem Preset 和 Channel 混在通信配置里容易误操作，出现把频道 0 名称改成 `LONGSlow` 的情况。
- “保存本轮配置”没有实际价值，配置写入应由用户选择字段和值后直接下发并读回。
- 配置项应按设备实际显示字段组织，包括 User name、Region、Modem Preset、Channel、Device Role、WiFi、开关项和 Language。
- 通信验证需要支持发给对端设备或发到指定频道，发送消息由用户填写，不自动生成。

本轮处理：
- `tests\meshtastic_cli_dashboard\app.js`：
  - 配置写入改为设备面向的配置项列表；Channel、WiFi、User name 使用专属输入区。
  - 移除“保存本轮配置”状态，点击“下发并检查”直接按当前表单执行。
  - 写入目标下拉改为显示 `测试设备1 #AB12 · COM7` 这类映射；结果和进度在有节点 ID 后仍优先显示 `#AB12`。
  - 报告记录显示完整本地路径；“打开”把 JSON 放到页面命令/报告区，“下载”直接请求 `/api/report?...&download=1`。
  - 通信验证新增发送方式：发给对端设备或发到频道；频道下拉会使用本页写入过的频道名。
- `tests\meshtastic_cli_demo\runner.py`：
  - 新增枚举显示映射，读回 `lora.region=1` 显示 `US`，`device.role=0` 显示 `CLIENT`，`lora.modem_preset=1` 显示 `LONG_SLOW`。
  - 读回校验同时接受枚举名称和对应数字，避免 CLI 返回数字时误判失败。
  - Channel 写入只通过 `--ch-index` / `--ch-set` 执行，不再属于通信配置下发。
  - 通信配置下发只负责 Region、Modem Preset、Frequency Override。
  - 通信验证支持 `--message-mode device` 和 `--message-mode channel`。
- `tests\meshtastic_cli_demo\cases_l2_demo.json` 升级为 `0.8`：
  - 测试前检查新增 Frequency Override 和频道 0 快照读取；频道快照按敏感输出处理。
- `README.md`、runner README、dashboard README、`PRODUCT.md`、`DESIGN.md` 已同步这版配置/通信边界。

验证：
- Python 语法检查通过：
```powershell
.\.venv\Scripts\python.exe -m py_compile tests\meshtastic_cli_demo\runner.py tests\meshtastic_cli_dashboard\server.py
```
- 前端 JS 语法检查通过：
```powershell
C:\Users\EDY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check tests\meshtastic_cli_dashboard\app.js
```
- 用例 JSON 解析通过，版本为 `0.8`，用例数为 `4`。
- 枚举映射验证通过：`lora.region 1 -> US`、`device.role 0 -> CLIENT`、`lora.modem_preset 1 -> LONG_SLOW`。
- 无设备 dry-run 通过：
  - Modem Preset 写入生成 `--set lora.modem_preset LONG_SLOW`，未生成频道命令。
  - Channel 写入生成 `--ch-index 0 --ch-set name LongFast --ch-set psk default --info`。
  - WiFi 写入生成 `network.wifi_enabled`、`network.wifi_ssid`、`network.wifi_psk` 链式写入。
  - 频道发送生成 `--ch-index 2 --sendtext hello`。
- API dry-run 通过，`/api/cases` 返回 `version=0.8`，Channel 配置和频道发送参数能通过 dashboard server 传给 runner。
- 报告接口验证通过：`/api/report?name=...` 打开返回 200，`/api/report?name=...&download=1` 返回 200 且带 `Content-Disposition: attachment`。
- Impeccable 静态检测返回 `[]`，但本机缺少 HTML/CSS parser 依赖，检测处于降级模式。

当前服务：
```text
http://127.0.0.1:8765
pid=33228
```

注意：
- 本轮未连接真实串口、未写设备、未发送真实消息。
- 本地 Meshtastic protobuf 中可见 `device_ui.language`，但没有 Japanese 枚举；Language 下拉暂不加入 Japanese。

## 21. 2026-09-03 减少重启、配置项收窄和报告目录规则

用户反馈：
- 运行写配置时设备频繁重启，担心不安全，也希望知道是否属于官方设计。
- 写入目标仍会出现两个设备同一个节点后四位标签，不够清楚。
- 配置项太多，需要保留用户提到的和常用项。
- WiFi 里的“不改”和通信配置里多个“不改”表达不清楚。
- 初始频道有名称，后续配置后也要在发送频道里显示名称。
- 只有发送方式选“发到频道”时才应选择发送频道。
- 用户会把两台设备互相遗忘，后续要测试陌生设备场景。
- 运行进度停在“等待任务启动”不清楚。
- 报告记录是否保存在本机、多人使用时如何存放需要明确。

本轮处理：
- `tests\meshtastic_cli_demo\runner.py`：
  - 普通配置写入改为先 `--get` 当前值，再按需 `--set`，最后再 `--get` 读回。
  - 同一台设备多字段写入会先读取每个字段；如果已一致，跳过写入步骤，减少不必要的设备重启。
  - 写配置和发消息命令默认追加 `--wait-to-disconnect 10`，可通过 `--wait-to-disconnect` 调整。
  - Channel 写入先读取当前频道信息；能解析到频道名称时写入报告 `channel_summary`，前端用于刷新频道下拉名称。
- `tests\meshtastic_cli_dashboard\app.js` / `index.html` / `styles.css`：
  - 配置项收窄为 User name、Region、Modem Preset、Frequency Override、Channel、Device Role、WiFi、TX、GPS、MQTT、Bluetooth、Serial、显示项、Language、Custom Field。
  - WiFi 开关选项改为“不修改开关 / ON / OFF”，避免理解成 WiFi 不配置。
  - 通信配置改为勾选要下发的 Region、Modem Preset、Frequency Override，取消多个“不改”选项。
  - 发送频道下拉仅在发送方式为“发到频道”时可用。
  - 目标显示遇到重复节点后四位时保留测试设备编号和 COM 口，避免只看到两个相同 `#ABCD`。
  - 进度列表按步骤索引合并 start/end 事件，不再同时显示同一步 PASS 和 RUNNING。
- `tests\meshtastic_cli_dashboard\server.py`：
  - 报告目录默认仍为项目 `logs`，支持通过 `MESHTASTIC_DASHBOARD_LOG_DIR` 指定团队共享或专用目录。
  - `/api/health` 返回实际 `logsDir`。
- `README.md`、runner README、dashboard README、`PRODUCT.md`、`DESIGN.md` 已同步。

结论：
- Meshtastic 官方 CLI 文档说明 `--wait-to-disconnect` 可在执行后等待断开，部分设备在串口断开时会重启，等待时间可能提升可靠性。
- 配置写入本身会写持久化配置，LoRa/Channel/Role 等字段出现重启或链路恢复窗口是合理现象；但自动化应避免重复写相同值。
- 两台陌生设备互相遗忘后，`发给对端设备` 模式预期会在联系人/NodeDB 可见性或 ACK 阶段失败；`发到频道` 模式仍要求频道/PSK/Region/Modem/Frequency 一致，接收端是否显示还需要设备屏幕确认。

验证：
- Python 语法检查通过。
- 前端 JS 语法检查通过。
- dry-run 验证通过：
  - Region 写入流程为先读当前值、再写入、再读回；写入命令包含 `--wait-to-disconnect 10`。
  - Channel 发送命令包含 `--ch-index 2 --sendtext hello --wait-to-disconnect 10`。

注意：
- 本轮未连接真实串口、未写设备、未发送真实消息。

## 24. 2026-09-03 当前最新执行规则汇总

- 设备命名：未读到节点 ID 前显示 `测试设备1 · COMx` / `测试设备2 · COMx`；前置检查读到 ID 后显示 `#ABCD · COMx`，结果和进度中直接使用 `#ABCD`。
- 节点识别：runner 优先使用 `--info` 输出里的本机 `myNodeNum` 和 `Owner:` 行，不从 NodeDB 其他节点里抓设备名。
- 配置写入：流程固定为读取当前值、写入、等待配置生效、读回；默认等待 20 秒，解决设备重启/USB 重新枚举导致的读回过早问题。
- Language：当前本机 CLI 日志显示不支持 `device_ui.language`，页面保留人工项提示，不再执行写入。
- Channel：默认显示 `频道 0 · Primary`；只有明确读到或写入对应 `--ch-index N` 后才更新频道名称。
- 通信：一个“运行通信”按钮；勾选通信配置时先下发两台设备并检查，未勾选时直接通信。
- 通信前置复用：如果本页已经通过前置检查拿到两台设备节点 ID，通信阶段只执行双向发送，不重复读 ID 和 NodeDB。
- 结果失败：串口打不开会提示重新扫描/重选；前置依赖跳过会显示具体阻塞步骤；结果卡片支持重试本轮。

## 25. 2026-09-04 设备命名、频道显示和接收验证修订

- 设备命名再次收紧：只允许本机 `--info` 的 `Owner:` / `My info.myNodeNum` 更新设备名；NodeDB 里的 `!7531ebd2` 等转发节点、目标节点或历史节点不能重命名当前串口设备。
- 页面设备名不显示 `#E504-COMx` 这类拼接格式；读取成功后优先显示真实 Short Name，读取不到才显示节点 ID 后四位且不带 `#`。
- 频道列表不是硬编码业务结论：初始显示 `频道 0 · LongFast`、`频道 1 · seeed`；只有明确读取/写入对应 `--ch-index N` 后才更新对应频道名，不再从 NodeDB 的任意 `name` 字段推断频道名。
- 频道通信判定收紧：`--sendtext` 返回 0 或 implicit ACK 不再直接 PASS；频道模式会打开对端 `--listen`，发送后在监听输出中看到用户消息才 PASS。
- 新增命令间隔秒数，默认 5 秒；收信等待秒数默认 10 秒；保留停止运行按钮，后台会终止 runner 子进程。
- “设备当前配置”区域显示前置检查读到的关键配置和 `--info` 脱敏快照，结果统计卡只展示最终用例结果，具体读写/监听证据在结果卡详情里。
- 最近一次 `L2-CLI-002` 失败日志显示 `COM7` 多次返回 `PermissionError(13, '连到系统上的设备没有发挥作用。')`，判断为串口未就绪/被占用/USB 重新枚举窗口，不是业务配置不一致本身。

## 26. 2026-09-04 配置跳过、进度启动和频道添加修订

- `communicationExperiment` 服务端分支补齐 `receiveWait` 初始化，避免任务提交后因为后端异常停在“等待 runner 进度”。
- 服务端创建任务时返回估算步骤数，前端提交后立刻显示进度总数，不再先显示 `0 / 0`。
- 配置写入现在按“写前读取 -> 比较目标值 -> 只写变化项”执行；如果当前值已经等于目标值，本轮不执行写入、不等待重启、不重复读回。
- 二级频道未启用且只配置频道名称时，改用 Meshtastic CLI 的 `--ch-add <name>` 添加频道，避免旧命令 `--ch-index N --ch-set name <name>` 在本机 CLI 上报 `expected bytes, int found`。
- 结果统计卡支持点击筛选并滚动到对应结果列表；具体用例卡仍可点击展开详细步骤证据。

## 27. 2026-09-04 TCP/BLE 双设备、通信配置同步和旁路串口日志

- 本地 Meshtastic CLI help 确认支持 `--port`、`--host`、`--ble`、`--sendtext`、`--listen`、`--ch-index`。页面继续保留串口、TCP、BLE 三种连接方式。
- runner 新增 `--peer-host` 和 `--peer-ble`，dashboard 新增测试设备2 TCP/BLE 输入框；串口、TCP、BLE 均可表达双设备连接。
- 前置检查或配置读回成功后，页面会把缓存的 Region、Modem Preset、Frequency Override 同步到通信区域；如果本轮选择的通信配置已经和两台设备缓存一致，再运行通信时跳过重复下发，直接进入发送。
- 频道 0 仍按 Primary Channel 规则显示；如果主频道没有自定义名称，则跟随当前缓存的 Modem Preset 显示，例如 `LONG_FAST` -> `LongFast`。
- 新增“串口日志旁路”面板：选择一个非测试串口作为日志串口，后台读取原始串口输出并写入 `logs\serial_sidecar_*.log`，用于定位重启、异常输出和串口枚举问题；该日志不参与 PASS/FAIL。
- 8765 服务已重启到当前代码版本；`/api/run` dry-run 验证通过，初始进度返回估算总数，不再停在旧后端的 `receive_wait` 异常。

## 28. 2026-09-07 持久串口通信与最终用例结果收敛

- `tests\meshtastic_cli_demo\runner.py`：
  - 新增串口双机持久通信执行器：两端均为串口时，通信验证优先使用 Meshtastic Python API 打开两台设备一次，订阅 `meshtastic.receive.text`，完成 A->B 和 B->A 双向发送，并以对端实际接收到用户消息作为 PASS 条件。
  - 串口双机通信报告收敛为一个最终步骤，例如 `频道 0 双向发送` 或 `点对点双向发送`；底层发送、接收、监听明细写入该步骤证据，不再拆成多张用例卡。
  - TCP/BLE 或串口 API 不适用时，仍保留原 CLI 发送路径作为兼容方案。
  - Modem Preset 写入仍保持 `lora.modem_preset + lora.use_preset=true` 的组合写入；不再把频道名当作 Modem Preset 成功依据。
- `tests\meshtastic_cli_dashboard\app.js`：
  - 结果详情新增 `serial_persistent` / `python-api dual-send` 证据展示，能看到双向消息各自是否被接收。
  - 设备命名继续收紧：遇到历史或重复短名时优先退回本机节点 ID 后四位，避免两个已接入设备都显示成同一个旧 NodeDB 名称。
  - 通信失败文案改为说明“至少一台设备未在监听输出中看到对端消息”，不再把发送端返回成功误写成业务通过。
- `tests\meshtastic_cli_dashboard\server.py`：
  - 串口双机且已具备节点 ID 或频道发送时，`communicationExperiment` 估算步骤数为 1，页面提交后直接显示 `1 / 1`。

结论：
- 发送消息本身不应被理解为“配置写入式重启”；但 Windows 串口短连接打开/关闭仍可能触发设备 USB/串口重连。持久串口通信只能减少一轮用例内的重复开关次数，不能完全保证设备不因最终关闭串口而刷新连接状态。
- 如果真实设备在持久通信路径下仍在消息收到后重启，下一步优先尝试 TCP/BLE 连接，或把通信执行器升级为 dashboard 常驻连接池，让串口跨多轮用例保持打开。

验证：
- Python 语法检查通过：`.\.venv\Scripts\python.exe -m py_compile .\tests\meshtastic_cli_demo\runner.py .\tests\meshtastic_cli_dashboard\server.py`
- 前端 JS 语法检查通过：`node --check .\tests\meshtastic_cli_dashboard\app.js`
- runner dry-run 通过：串口双机频道通信和点对点通信均生成 1 个最终步骤。
- runner dry-run 通过：Modem Preset 写入计划同时包含 `lora.modem_preset` 和 `lora.use_preset=true`。
- dashboard API dry-run 通过：`/api/run` 返回 `estimatedSteps=1`，`/api/run-status` 生成 `total_steps=1` 的报告。
- 本轮未连接真实串口、未写设备、未发送真实消息。

## 29. 2026-09-07 Serial Scan vs Protocol Handshake Fix

- Latest failing run `logs/meshtastic_cli_dashboard_report_20260907_151121_cbc43b02dbae.json` showed COM8 was enumerated by Windows, but `meshtastic --port COM8 --info` returned `Connection timed out`; COM11/XB succeeded in the same run. The evidence points to COM8 device handshake failure or device reboot/busy state, not a general dashboard runner failure.
- Serial scan now remains treated as port enumeration only. A device is considered connected only after Meshtastic CLI/API completes a real command such as `--info`.
- `runner.py` now marks `primary` or `peer` unavailable for the current run when a target returns port/protocol-level errors such as `Connection timed out`, `could not open port`, `PermissionError`, or `Cannot configure port`.
- After a target is marked unavailable, later steps for the same target are skipped with `target_unavailable:<target>` so the runner does not repeatedly open the same dead/busy COM port. The other target can still continue when independent.
- Standalone identity reads now use `--no-nodes --info`, keeping device identity separate from NodeDB and avoiding slow NodeDB transfer or accidental device-name pollution from historical/relay nodes.
- UI reason text now explains the distinction between detected COM port and completed Meshtastic handshake.
- Verification on this change did not touch real serial devices: Python compile passed, JSON parse passed, dashboard JS syntax passed, dry-run command plan includes `--no-nodes --info`, and a monkeypatched runner simulation confirmed primary timeout -> primary follow-up skipped while peer still runs.

## 30. 2026-09-08 Encoding Repair and Public Key Precheck

- No Git commit or local backup existed for the previous dashboard source state, so the encoding damage could not be safely restored by rollback.
- The visible mojibake was caused by round-tripping UTF-8 Chinese source through PowerShell text rewrite, not by Meshtastic serial output.
- Repaired dashboard and runner user-visible strings; current `app.js`, `runner.py`, and `cases_l2_demo.json` contain no private-use mojibake markers or `????` placeholder runs.
- `L2-CLI-002` identity precheck now expects public key evidence from `--no-nodes --info`; private keys remain redacted and are not required.
- Device snapshot rendering now includes a public key row when the CLI output exposes `publicKey`, `public_key`, or `Public Key`.



## 31. 2026-09-08 Git Baseline and Mojibake Follow-up

- Fixed dashboard mojibake caused by PowerShell rewriting UTF-8 Chinese source. Future source rewrites should use UTF-8 explicitly or ASCII-only `\uXXXX` escapes for UI strings.
- Dashboard UI now removes visible `?` separators and uses `\u00b7` middot separators in module rows, result rows, report rows, device channel rows, and message-channel options.
- Result metrics and run states are displayed in Chinese while keeping internal status codes (`PASS`, `FAIL`, `SKIPPED`, `DRY_RUN`) for filtering.
- Serial scan cards no longer expose noisy Windows PNP instance IDs such as `68&FB3129&0&0000`; COM number remains the primary visible identifier and raw `hwid` stays available in API data for debugging.
- `L2-CLI-002` no longer requires `publicKey` from `--no-nodes --info`. Identity steps read node ID/name only; NodeDB visibility steps now use `--info` with sensitive output hidden so public keys can be extracted from `Nodes in mesh` when the CLI provides them.
- `runner.py` now extracts structured `node_public_keys` from `Nodes in mesh` JSON and can display entries such as node `242a` when present. Private keys remain out of scope and are not read or displayed.
- Verification was static/dry-run only per user instruction: JS syntax, Python compile, JSON parse, dry-run precheck generation, and historical `242a` public-key parser check passed. No real serial command, write, or send was executed in this update.

## 32. 2026-09-08 GitHub Push and Device Display Tightening

- Git remote was changed to `https://github.com/Weiii1222/Meshtastic-CLI.git`; local history was merged with the GitHub initialization commit and pushed successfully to `main`.
- Serial scan cards now show `COMx` plus a plain serial-device label or real USB serial number only. Windows PNP instance fragments such as `6&1BE3522E&0&0000` stay out of the operator UI.
- Device configuration panel now displays only the connected device's own public key from the local `--info` / `myNodeNum` match. NodeDB public-key lists are no longer rendered in the device snapshot or step evidence.
- `parse_info_summary()` now prefers the public key for the local node ID before considering generic `Public Key` text, preventing another NodeDB entry from being shown as the current device's key.
- Non-mutating read commands now treat Meshtastic `Connection timed out` as a transient serial/protocol failure and retry with the existing bounded retry path. Mutating writes and send-message commands still avoid automatic retry to prevent duplicate side effects.
- Latest user-observed `读取测试设备1身份` failure matched CLI protocol timeout evidence: Windows enumerated the COM port, but Meshtastic CLI did not complete the device handshake before timeout. This is distinct from "serial port not found" or "port occupied".

Verification:
- Static checks only: dashboard JS syntax passed, Python compile passed, JSON cases parse passed, `git diff --check` passed.
- Historical log parsing confirmed local public-key selection on node `!76ade504` / short name `e504`.
- No real serial command, write, or message send was executed in this update.
