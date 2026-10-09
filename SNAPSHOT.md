## 2026-10-09 补充：Meshtastic 回归配置读回与 SIP 发布材料

- 平台定位保持为 **Meshtastic 固件测试执行台**；Wio Tracker L2 仅是当前试点测试设备，MeshCore 保持“规划中”，不作为已支持能力展示。
- 修复配置页显示覆盖：真实报告证明 `8e5c` 已从 `lora.override_frequency: 915.0` 写回 `906.875`，但页面此前先采集 `--get` 再用较早的 `--info` 快照覆盖，因而错误显示为 `0`。现改为先应用快照、再以同轮显式 `--get` 读回覆盖对应字段。
- US 与 EU_868 公共频道回归增加声明式 Region 修正流：先读取两台设备的 Region/Modem Preset/Frequency Override；仅在 Region 不符时写入目标 Region，等待并读回；随后比较三项最终配置，再执行频道 0 双向通信。该流不自动修改 Modem Preset、Frequency Override 或频道 PSK，避免以写配置掩盖通信前置条件不一致。
- Dashboard 顶部恢复为仅保留 Meshtastic / MeshCore（规划中）切换；移除“真实执行”和“允许改配置/发消息”可见控件，Dashboard 请求固定为真实执行并允许写操作。直接运行 `runner.py` 仍默认 dry-run，需显式 `--execute --allow-mutating` 才会碰设备。
- 新增 `docs/SIP_提效案例_Meshtastic固件测试执行台.md`：以详细解决方案为主体，覆盖三个界面、技术实现、适用边界、扩展方向、量化口径和对应配图占位；访问限制与仓库链接置于末尾。新增 `docs/Meshtastic固件测试执行台_本地运行指南.md`，README 已链接该指南，便于代码推送后由其他同事在 Windows 本地部署与 dry-run 验证。
- SIP 案例的第三个界面已按实际页面修正为串口日志实时监听（选择串口/波特率、开始或停止监听、页面实时显示与本地日志落盘），不再将其描述为 BLE 稳定性界面。部署说明、访问限制和“平台仍处于迭代优化阶段，可能存在未发现使用问题与 bug”的风险提示已合并至解决方案第六点“其他”；案例正文不展开部署命令，仅给出目标 GitHub 仓库地址。
- README 已由 392 行的说明集合收敛为平台定位、能力范围、最短启动路径、文档入口、项目结构、测试项、边界与验证；完整部署、操作方法和常见问题统一维护在 `docs/Meshtastic固件测试执行台_本地运行指南.md`，避免首页与专用文档重复。
- 已验证：`py_compile runner.py server.py`、Node `--check app.js`、Frequency Override 解析样例（`915.0`）和两个区域回归展开检查均通过；两条区域回归干跑共 20 步通过结构检查。尚未在真实硬件上复测页面显示与 Region 自动修正。

## 2026-09-24 补充：BLE 单设备持续收发交互与前端任务状态修复
- 当前优先级继续聚焦 Meshtastic BLE 单设备链路；MeshCore 仍先搁置，串口通信路径不做无关改动。
- 本轮修复：BLE 持续收发卡片新增频道选择、目标节点选择和发送内容输入，持续发送可按频道或 NodeDB 中的指定节点发送；日志支持 INFO/TX/RX/ERR 分类记录、清空和自动滚动到底部。
- 本轮修复：BLE 前端任务若没有后端 job id 且卡在 running 状态，10 秒后再次点击运行类操作会自动清理僵死状态，避免页面一直显示“等待 runner 返回进度”导致按钮不可用。
- 本轮修复：BLE 通信配置下发不再提前锁死全局 running 状态，避免配置阶段与后续通信阶段互相阻塞。
- 本轮修复：串口/BLE 切换后会恢复测试项模块列表，避免从 BLE 切回串口时左侧测试项卡片空白。
- UI 调整：BLE 持续收发卡片状态改为小型状态点 + 文本，清空按钮放在标题右侧；日志区域改为浅灰背景并扩大可视区域。
- 已验证：`node --check tests\meshtastic_cli_dashboard\app.js` 通过；`git diff --check` 仅提示现有 CRLF 换行警告，无空白错误。

## 2026-09-23 补充：Web BLE 收敛为单设备稳定模式
- 用户复测确认：P0 止血后 Windows 系统显示单台设备已连接，但 Web 页面仍提示 GATT 写入失败/重连重试，且两台设备无法同时稳定静态连接。
- 当前决策：Web BLE 暂停双设备并行连接，先收敛为单设备稳定模式；BLE 只支持测试设备 1，测试设备 2 BLE 面板禁用并提示“当前 BLE 先只支持单设备”。串口/TCP 双设备能力不受影响。
- 本轮修复：新增 `WEB_BLE_SINGLE_DEVICE_ONLY=true` 与 `WEB_BLE_ROLES=['primary']`，Web BLE 前置检查、配置下发、频道通信只枚举测试设备 1；扫描/连接测试设备 2 BLE 会直接提示不支持，不再打开 Chrome 选择器。
- 本轮修复：切换到 BLE 模式或连接测试设备 1 前，会释放测试设备 2 的 BLE 缓存连接，避免之前失败的第二路 GATT 状态残留影响单设备链路。
- 当前支持范围：Web BLE 单设备身份读取、配置读写/读回、频道发送按单设备路径继续推进；BLE 点对点双向通信暂不支持，仍建议使用串口路径验证。
- 已验证：`C:\Users\EDY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check tests\meshtastic_cli_dashboard\app.js` 通过；`GET http://127.0.0.1:8765/api/health` 正常。
## 2026-09-23 补充：Web BLE 双设备静态连接 P0 止血
- 用户复测反馈：两台 BLE 设备已无法同时保持静态连接；用户提供的 P0 方向明确指出 `gatt.connect()` / `disconnect()` 未进入全局队列、`drainBleFromRadio()` 单次读取过长、连接后缺少轻量预热、双设备链路缺少空闲保活。
- 本轮最小修复：新增 `enqueueBleGlobalOperation()`，将 `device.gatt.connect()` 纳入全局 GATT 队列；断开操作改为通过对应 transport 的 `GATT.disconnect` 队列执行，避免连接/断开与读取/写入并发。
- 本轮最小修复：`drainBleFromRadio()` 默认从最多 64 包降为最多 4 包，并增加约 200ms 时间片上限；通知触发的后台 drain 同样限制为 4 包，减少单台设备长期占用全局 GATT 队列。
- 本轮最小修复：连接建立并 `startNotifications()` 后执行一次轻量 drain 预热；UI 点击“连接 BLE”成功后异步触发 2 秒轻量身份读取，失败不影响静态连接状态。
- 本轮最小修复：新增 `keepOtherBleRolesWarm()`，在身份读取和配置读写前对另一台已连接设备做 1 包轻量 drain，降低 Windows/Chrome 判定另一条 BLE 会话空闲后断开的概率。
- 已验证：`C:\Users\EDY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check tests\meshtastic_cli_dashboard\app.js` 通过。真实双 BLE 静态连接和前置检查需用户刷新页面后复测。
## 2026-09-23 补充：Web BLE 前置检查按有效 GATT 连接隔离执行
- 用户复测报告 `meshtastic_cli_webble_report_20260923_083748_33f7067843cd.json` 显示：同一轮前置检查里测试设备 1 在执行时已不是有效 GATT 连接，报 `测试设备 1 未完成浏览器 GATT 连接`；测试设备 2 可读取身份、节点 ID、公钥、Region、Modem Preset、Bluetooth PIN 和频道摘要。
- 根因判断：前端此前用 `browserBleTransports.has(role)` 判断设备可执行，该条件只能说明浏览器曾保存过 BLE transport，不代表当前 `device.gatt.connected` 仍为真，也不代表 ToRadio/FromRadio/FromNum 特征句柄仍可用。
- 本轮修复：新增 `hasConnectedBleRole()` / `connectedBleRoles()`，配置写入、通信入口、前置检查均只对当前 GATT connected 且特征句柄可用的设备执行；历史缓存或已断开的角色不再参与执行。
- 本轮修复：Web BLE 前置检查改为逐台隔离执行。未保持有效连接的设备记录为 `SKIPPED` 并提示先单独点击“连接 BLE”，不会把另一台已连接设备的身份读取一起判失败；若没有任何有效连接，则明确返回 `web_ble_no_connected_device`。
- 执行策略：Web BLE 配置下发支持选择“两台设备”，但实际按当前有效连接设备顺序执行，不做并发 GATT；点对点通信仍要求两台设备都保持有效 GATT 连接；频道发送支持单设备执行。
- 已验证：`C:\Users\EDY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check tests\meshtastic_cli_dashboard\app.js` 通过。真实双 BLE 前置检查仍需用户刷新页面后复测。
## 2026-09-23 补充：Web BLE 前置检查轻量化与 GATT 写入失败重连
- 用户复测报告 `meshtastic_cli_webble_report_20260923_082948_bfc58bd106ad.json` 显示：测试设备 1 Web BLE 前置检查完整读取成功，包含配置、8 个频道和 12 个 NodeDB 节点；测试设备 2 随后在第一步 `ToRadio.writeValue` 报 `NotSupportedError: GATT operation failed for unknown reason.` 并掉线。
- 根因判断：双设备前置检查不应执行完整配置同步。完整 `requestBleConfig()` 会占用 BLE GATT 队列太久，Windows/Chrome 对第二台设备的 GATT 会话容易在等待期间进入不稳定状态。
- 本轮修复：新增轻量 `requestBleIdentity()`，前置检查只读取 `my_info/node_info/owner` 所需身份信息，限制每次 `FromRadio` drain 的批量大小；完整配置、NodeDB、8 个频道读取仍保留给配置读写或单项功能，不再作为双设备前置检查默认动作。
- 本轮修复：`ToRadio.writeValue` 遇到 GATT/Network/NotSupported/unknown reason 类瞬态错误时，会对当前角色执行一次强制 GATT 重连并重试写入；主动重连期间屏蔽 `gattserverdisconnected` 对 UI 状态的清空，避免重连被误显示为永久掉线。
- 已验证：`node --check tests\meshtastic_cli_dashboard\app.js` 通过；`GET http://127.0.0.1:8765/api/health` 返回正常。真实双 BLE 前置检查仍需用户刷新页面后复测。
## 2026-09-23 补充：Web BLE 双设备前置检查断连与配置项空下拉修复
- 当前优先级：MeshCore 暂停，Meshtastic 串口路径不要再动；用户已确认串口连接、点对点私信、公频/频道通信正常。
- 当前 BLE 现状：单设备 Web BLE 前置检查和单设备频道发送可用；双设备静态 GATT 连接可以同时保持，但运行前置检查时曾出现一台设备自动断开。
- 本轮 BLE 修复：`FromRadio` 读取从“单次 readValue 排队”升级为“整轮 drain 原子排队”，后台通知触发的 drain 与前台前置检查 drain 共用全局 GATT 队列，避免两台设备的 FromRadio 读取循环交叉抢数据或触发 Windows/Chrome BLE 栈断连。
- 本轮配置下拉修复：`index.html` 为 Meshtastic 配置项加入默认 `<option>` 列表；`app.js` 仍按当前模式动态重建并同步自定义下拉，双保险避免 Meshtastic 配置项空白。
- 已验证：`node --check tests\meshtastic_cli_dashboard\app.js` 通过；`GET http://127.0.0.1:8765/api/health` 返回正常。硬件双 BLE 前置检查需要用户刷新页面后实测验证。
## 2026-09-22 补充：Meshtastic Web BLE 双设备运行稳定性与配置项下拉修复
- 用户复测确认：Web BLE 单设备前置检查和单设备频道发送已可用；双设备可同时保持静态 GATT 连接，但一运行前置检查会有一台设备自动断开；Meshtastic 配置项下拉仍出现空列表。
- 本轮不改串口通信路径；串口连接、点对点私信、公频/频道通信已由用户实机验证正常。
- Web BLE 掉线根因判断更新：不仅同一设备需要 GATT 操作串行化，Windows/Chrome BLE 栈在双设备同时连接时也可能对跨设备 GATT 操作并发敏感。因此前端将 BLE GATT 队列升级为全局串行队列，所有已连接 BLE 设备的 `getPrimaryService`、`getCharacteristic`、`startNotifications`、`ToRadio.writeValue`、`FromRadio.readValue` 统一排队执行，降低运行前置检查时另一台设备掉线概率。
- 配置项下拉修复：`configKind` 改为 DOM option 重建并在每次初始化后强制 `enhanceSelect()/syncCustomSelect()`，避免 Meshtastic/MeshCore 切换或刷新后自定义下拉渲染层与原生 `<select>` 状态不同步导致空列表。
- 已验证：`node --check tests\meshtastic_cli_dashboard\app.js` 通过；`GET http://127.0.0.1:8765/api/health` 返回正常。未做真实双 BLE 硬件复测，需用户刷新页面后验证双设备前置检查是否仍掉线。
# Project_01_WioTrackerL2 记忆快照

## 2026-09-22 补充：Meshtastic Web BLE GATT 串行化与双设备独立连接

- 当前继续暂停 MeshCore，优先完成 Meshtastic Web BLE；串口连接、点对点私信、公频/频道通信已由用户实机验证正常，本轮不修改串口通信路径。
- 本轮报告 `meshtastic_cli_webble_report_20260922_203002_3ed1b9707f18.json` 的失败根因是 `NetworkError: GATT operation already in progress.`，属于同一 BLE GATT 连接上 `readValue/writeValue/startNotifications` 并发执行导致，不应误判为设备占用或 PIN 问题。
- 前端为每个 BLE transport 增加独立 GATT 操作队列：`getPrimaryService`、`getCharacteristic`、`startNotifications`、`ToRadio.writeValue`、`FromRadio.readValue` 全部串行排队；`FromNum` 通知只触发合并后的后台 drain，避免和前置检查主动读取抢同一条 GATT 链路。
- BLE 连接改为按测试设备角色隔离：测试设备 1 / 测试设备 2 各自保存独立 `BluetoothDevice`、GATT server、ToRadio、FromRadio、FromNum、接收缓存和队列；扫描或连接第二台设备不再清空第一台已读身份快照。
- “连接 BLE”按钮在当前角色未选择设备时会直接触发 Chrome Web Bluetooth 设备选择器，选中后立即连接；仍保留“扫描 BLE”作为提前发现/选择入口。
- 已验证：`node --check tests\meshtastic_cli_dashboard\app.js` 通过；`python -m py_compile tests\meshtastic_cli_dashboard\server.py` 通过。未连接真实 BLE 设备复测，需用户刷新页面后先验证单设备前置检查，再尝试第二台独立连接。

## 2026-09-22 补充：Meshtastic Web BLE 信息展示与报告收敛

- 当前继续暂停 MeshCore，优先处理 Meshtastic Web BLE；用户已确认串口连接、点对点私信、公频通信均正常，本轮不改串口通信路径。
- 检查最新 Web BLE 报告确认：`8e5c` 可通过浏览器 GATT 读取身份、Long/Short Name、公钥、Region、Bluetooth 状态与部分 NodeDB；`e504` 连接失败发生在 Windows/Chrome GATT 连接阶段，页面无法直接提交 PIN，PIN/配对仍由系统弹窗处理。
- 前端 BLE 快照补齐 Bluetooth Mode、Bluetooth PIN、GPS、MQTT、Channel Num 等字段映射；前置检查输出将 protobuf 省略默认值按 `LONG_FAST` 和 `0` 展示，避免把默认值省略误判为未读取。
- 删除重复的 `syntheticWebBleResult()` 定义，保留统一的 Web BLE 结果生成器，报告标题继续区分“频道通信”和“点对点双向通信”。
- 本轮验证：`node --check tests\meshtastic_cli_dashboard\app.js` 通过；未连接真实 BLE 设备做 GATT 复测，需用户刷新页面后复测单设备身份读取、配置读回、单设备频道发送与 e504 连接。

## 2026-09-22 补充：Meshtastic Web BLE 读取完整性与消息解析修复

- 本阶段继续暂停 MeshCore，优先收敛 Meshtastic Web BLE；串口私信/公频路径已由用户实机验证正常，本轮不改串口发送逻辑。
- 本轮排查确认本地 `meshtastic` Python 包中的 `AdminMessage`、`Config.LoRaConfig`、`ToRadio`、`FromRadio`、`MeshPacket`、`Data` 字段号与前端 JS 编码大体一致；Web BLE 前置检查信息有限的主要风险不在字段号整体错位，而在 FromRadio 响应异步到达后读取循环过早结束。
- Web BLE 配置读取改为 Admin 请求后执行短时间 `drainBleForWindow()` 排空窗口，不再在拿到任意 LoRa 配置或任意频道后立刻退出，降低只显示 Region/Bluetooth、缺少 Modem Preset/Channel/模块配置的概率。
- BLE 文本消息解析加上端口过滤：只有 `Data.portnum === TEXT_MESSAGE_APP` 且 payload 可打印时，才进入 `transport.received` 和通信接收判定；Admin、Telemetry、NodeInfo 等二进制 payload 不再被误解码成聊天文本，避免“报告收到但设备 UI 没消息”的误判。
- Web BLE 快照展示补齐：`snapshotRows()` 同时兼容 `modules` 与旧 `module_preferences`，并从 BLE snapshot 的 owner / myNodeNum / publicKey 中补显示 Short Name、节点 ID、公钥；默认值省略的 `lora.modem_preset=LONG_FAST` 与 `lora.override_frequency=0` 会按 Meshtastic protobuf 默认值展示。
- 若 FromRadio 没返回 channel 0，前端会基于当前 Modem Preset 合成主频道展示项；这是 UI 兜底，不代表设备真实写入了新频道。
- e504 BLE 连接失败从报告看发生在 Windows/Chrome GATT 连接阶段，而不是 Meshtastic protobuf 读取阶段；Web Bluetooth 页面不能直接提交 PIN，PIN/配对由 Windows 和 Chrome 处理。8e5c 能读取身份说明当前页面的 protobuf 通道对至少一台设备可用，e504 需继续按 Windows 配对缓存、设备蓝牙栈、固件 BLE 状态排查。
- 本轮验证：`node --check tests\meshtastic_cli_dashboard\app.js` 通过；`GET http://127.0.0.1:8765/api/health` 返回正常。未连接真实 BLE 设备做硬件 GATT 复测，需用户复测单设备身份读取、频道发送、配置读回。

## 2026-09-22 补充：Meshtastic Web BLE 标准握手与 NodeDB 证据扩展

- 当前继续暂停 MeshCore 相关实现，优先收敛 Meshtastic Web Bluetooth 路径；不要在本阶段把 MeshCore 字段、配置项或执行结果混入 Meshtastic 页面状态。
- Web BLE 配置读取从随机 `want_config_id` 改为标准两阶段同步：先清空旧 FromRadio 缓存，再发送 `want_config_id=69420` 读取本机配置，随后发送 heartbeat 保持会话，再发送 `want_config_id=69421` 读取 NodeDB，最后补发 `ADMIN_APP get_owner`；读取过程中继续从 `FromRadio` 合并 `my_info`、`node_info`、config、moduleConfig、channel 和 text event。
- Web BLE 前置检查扩展为“身份 + 当前配置 + 频道 + NodeDB 可见性/公钥证据”：两台 BLE 设备均连接时，会记录双向 NodeDB 是否出现对端节点及对端公钥；NodeDB 未出现对端只作为可见性备注，不单独判定前置检查失败。
- Web BLE 配置写入继续走 `ADMIN_APP` protobuf：写入前先读当前值，当前值一致则跳过重复写入；写入后等待设备生效并再次读回校验。该路径已接入 Region、Modem Preset、Device Role、WiFi、GPS、Bluetooth、MQTT、Channel、User name 等已有前端配置项。
- Web BLE 单设备优先路径保留：单设备已连接时可运行身份读取和频道发送；点对点私信仍要求两台设备都完成浏览器 GATT 连接并已读取 node id / public key。单设备频道发送只能证明本机接受 ToRadio 写入，空口接收仍需第二台设备或串口日志二次验证。
- 本轮验证：`C:\Users\EDY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check tests\meshtastic_cli_dashboard\app.js` 通过。未连接真实 BLE 设备做硬件读写验证，需用户在设备侧复测身份读取、配置读回和频道发送。

## 2026-09-21 补充：频道通信可见性路径与禁用态一致性

- 对比 `meshtastic_cli_dashboard_report_20260921_210840_1f98495bfb36.json` 与 `meshtastic_cli_dashboard_report_20260921_211044_3b91c14efb69.json`：点对点模式已经走单端顺序 CLI `--dest ... --sendtext ... --ack`，两台设备可见；频道模式仍在发送前打开对端 `--listen`，导致接收端串口被自动化监听占用，设备屏幕/聊天框不可见。
- 修复频道通信执行路径：双设备频道模式改为两台设备依次执行 `--ch-index N --sendtext ... --wait-to-disconnect 10`，不再启动接收端 `--listen`。频道模式的自动化结果只确认发送命令已下发到频道，设备屏幕/聊天框可见性作为实机观察点；串口日志取证应另用日志页，不与通信动作并发占用同一设备串口。
- UI 禁用态修复：Region、Modem Preset 的自定义下拉不再叠加自身透明度，未勾选时与 Frequency Override MHz 保持一致的置灰程度。

> 更新时间：2026-10-08 14:20 +08:00  
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

## 33. 2026-09-11 Serial Regression Fix and Web BLE Data Channel

- 后续每次功能优化或缺陷修复，都要同步更新本快照；更新方式以追加或局部修正为主，不再整体重排快照结构。
- 串口读取重启回归原因：上一轮为了修复 bundled Python 缺少 `meshtastic` 依赖，默认回退到 `.venv\Scripts\meshtastic.exe`，但这绕开了此前用于压低 DTR/RTS 的 `safe_meshtastic_cli.py`，导致部分 USB-CDC 设备打开串口时再次复位。
- 当前修复：`runner.py` 的 `.py` CLI 命令固定使用项目 `.venv\Scripts\python.exe` 执行；dashboard 也用项目 `.venv\Scripts\python.exe` 启动 runner，并默认把 `--meshtastic` 指向 `safe_meshtastic_cli.py`。这样既恢复防复位包装，又不会再用 Codex bundled Python 跑缺依赖脚本。
- 串口点对点通信失败的确定原因之一：dashboard 之前用 bundled Python 启动 runner，`run_api_dual_send_step()` 内部导入 `pubsub` 失败，报告中表现为 `persistent_api_error: ModuleNotFoundError: No module named 'pubsub'`，实际并没有进入有效发送流程。已通过改用项目 `.venv` Python 修复。
- 串口点对点接收判定调整：不再强制用 packet id 匹配接收包，packet id 只保留为证据字段；接收判定以目标端、文本、频道、from/to 为主，避免 Mesh 转发或设备事件中的 packet id 差异造成误判。
- Web Bluetooth 数据通道第一版已加入前端：连接后获取 Meshtastic BLE Service，下挂 `ToRadio`、`FromRadio`、`FromNum` 三个 characteristic；发送时在浏览器端编码最小 `ToRadio -> MeshPacket -> Data(TEXT_MESSAGE_APP)` protobuf 并写入 `ToRadio`；接收时由 `FromNum` 通知触发读取 `FromRadio`，解析文本消息作为通信证据。
- 当前 Web BLE 限制：只覆盖文本消息发送/接收验证，不覆盖配置写入、完整 NodeDB 同步、联系人交换、ACK 处理和完整 Meshtastic 客户端状态机。若通信配置被选择，仍需先走现有后端配置流程。
- Web Bluetooth 不等于只能连一台设备：标准 API 可以在同一页面保存多个 `BluetoothDevice` 对象并分别建立 GATT 连接，但每台设备通常需要用户在浏览器 chooser 中单独选择一次。当前页面支持把已连接 BLE 设备分别绑定为测试设备1/测试设备2，并在两台都已连接时优先走浏览器 BLE protobuf 通信验证。
- PIN 配对事实：Web Bluetooth 页面不能直接弹出自定义 PIN 输入框并提交给系统；如果设备需要配对，PIN 输入由 Windows / Chrome 的系统配对流程处理。若没有弹 PIN 但 GATT 已连接，通常表示系统已缓存配对、设备当前不要求 pairing，或只在加密写入时才触发系统配对。
- 官方实现依据：Meshtastic Python BLEInterface 与官方 JS/Web BLE transport 都使用相同 BLE service UUID `6ba1b218-15a8-461f-9fa8-5dcae273eafd`，核心 characteristic 为 `ToRadio=f75c76d2-129e-4dad-a1dd-7866124401e7`、`FromRadio=2c55e69e-4993-11ed-b878-0242ac120002`、`FromNum=ed9da18c-a800-4f66-a670-aa7547e34453`。
- 本轮已验证：`node --check tests\meshtastic_cli_dashboard\app.js` 通过；`py_compile` 通过；`L2-CLI-001 --execute` 通过，报告显示命令通过 `.venv\Scripts\python.exe -B safe_meshtastic_cli.py --version` 执行。

## 34. 2026-09-14 连接路由收敛、BLE 单设备适配与串口通信证据修订

- 本轮继续保持快照增量追加，不再整体重构或重排历史内容。
- 后端 `tests/meshtastic_cli_dashboard/server.py` 现在会按当前 `connectionType` 清理残留连接字段：串口模式只接受 `primaryPort/peerPort`，TCP 模式只接受 `host/peerHost`，BLE 模式只接受 `ble/peerBle`。这样可以避免页面切换连接方式后出现 `--ble xxx --peer-port COMx` 的混合执行路由。
- 前端 `runPayload()` 同步收敛连接载荷：非当前连接方式的端口、Host、BLE 字段不再提交；当浏览器已经建立 Web Bluetooth GATT 会话时，不再把同一台设备名称交给后端 CLI `--ble` 重新扫描。
- Web Bluetooth 路径新增单设备/双设备自适应前置检查：只连接测试设备 1 时，只通过浏览器 GATT 的 `ToRadio want_config_id` / `FromRadio my_info` 读取测试设备 1；只有两台设备都建立 GATT 会话时，才执行双设备通信验证。
- Web Bluetooth 通信入口现在优先走浏览器侧 protobuf 数据通道；只连接一台 BLE 设备时返回 `SKIPPED`，明确说明双向通信需要两台 GATT 已连接设备，不再回落到后端 `--ble` 造成全部失败。
- Web Bluetooth 配置写入仍未实现；如果用户在 BLE 路径勾选 Region / Modem Preset / Frequency Override 配置下发，会返回 `SKIPPED` 并提示当前 BLE 只覆盖身份读取和文本通信，配置写入仍需串口/TCP 路径。
- BLE 状态显示从单个 `connectedBleDeviceId` 改为按 `primary/peer` 两个角色显示，避免连接第二台 BLE 后覆盖第一台的连接状态；断开 BLE 会断开当前页面持有的所有 GATT transport。
- 串口点对点通信继续使用官方 CLI 发送 + 对端 `--listen` 接收端证据路径。真实 PASS 条件是监听端输出包含用户发送文本；设备提示音、发送端返回 0、`Sending`、`Connected` 或 ACK 类输出均不能单独判定为消息送达。
- 当前已验证：`node --check tests/meshtastic_cli_dashboard/app.js` 通过；`py_compile` 检查 `runner.py`、`server.py`、`safe_meshtastic_cli.py` 通过；`cases_l2_demo.json` 可解析；串口通信 dry-run 生成的命令仍走 `.venv\Scripts\python.exe -B safe_meshtastic_cli.py --port ... --dest ... --sendtext ... --ack`，未回退到旧 `python-api dual-send` 默认路径。
- 本轮未连接真实硬件执行写入、读取或发送；真实 BLE GATT 身份读取和串口消息接收端证据需由用户在设备侧复测。

## 2026-09-14 更新：串口读回/通信与界面细节修复

- Region 下拉增加 RU、IN。
- 串口扫描卡片显示 COM + MAC-like 设备标识；未识别前显示 USB VID/PID 短标识，避免 Windows 实例路径乱码。
- 日志串口选择不再整体锁定；测试执行中已占用的 COM 仅在下拉选项中灰置不可选，其他空闲 COM 仍可用于查看日志。
- 配置写入结果支持非写入失败步骤单独重试；用于“写入成功、读回失败”时只重跑读回命令。
- 双串口通信改回持久 Python API 路径：同时打开两路串口并以对端收到文本事件作为通过条件；CLI send/listen 保留为非双串口 fallback。
- 握手/串口瞬态错误识别范围扩大，包含 protocol、handshake、no response、reader is dead 等，降低偶发协议握手失败直接终止的概率。
- 设备当前配置单设备视图收紧键值列间距；扫描串口/断开串口按钮统一尺寸；自定义下拉 disabled 状态与普通控件保持一致。
- 本轮已完成 JS/Python 静态检查；未连接实物设备验证，需用户在 COM37/COM38 场景回归。

### 2026-09-14 补充：串口扫描标识兜底

- 修复串口扫描数据合并时丢失 usbId 的问题；pyserial/WMI 任一分支返回 VID/PID 时均补全 `USB xxxx:yyyy` 短标识。
- 前端串口卡片优先显示已识别设备短名/节点后四位，未完成前置识别时显示 USB VID/PID 短标识，避免显示冗长 Windows 实例路径。

### 2026-09-14 补充：日志选择、单步重试和串口握手恢复

- 日志页支持只连接一个测试串口时查看其他空闲串口日志；已被测试设备使用的端口只在日志端口下拉中灰置为“运行中使用”，不再显示“锁定”类文案。
- 串口扫描卡片改为“COMx + MAC-like 设备标识”展示：节点短 ID 显示为 `E5:18` 这类短标识，USB VID/PID 显示为 `303A:1001` 这类短标识，不再展示 `COMx + 设备ID` 文案。
- 执行结果统计卡增加语义颜色：通过为绿色、失败为红色、跳过为灰色；hover 状态保留对应语义颜色，不再统一变色。
- 单步超时默认值从 60s 调整为 30s；单步重试接口默认也使用 30s，并对 `TimeoutExpired` 转成结构化失败结果，参与瞬态串口错误重试。
- 单步重试时前端会立即显示“正在重试：步骤名”和当前操作说明，避免用户只看到静态失败卡片。
- `safe_meshtastic_cli.py` 串口 no-reset 包装器增强：显式关闭 `dsrdtr/rtscts/xonxoff`，打开后清理输入/输出缓冲，关闭前保持 DTR/RTS inactive，降低读取/发送时设备复位或启动日志干扰 Meshtastic 协议握手的概率。
- 握手失败文案调整为“COM 口可打开但 Meshtastic 协议未响应”，不再默认暗示串口被占用；仍失败时优先排查设备刚重启、USB CDC 状态卡住或固件协议暂未响应。

### 2026-09-14 补充：NodeDB 备注化、通信回退与串口标识修正

- 串口扫描卡片里的 `303A:1001` 已明确按 `USB VID:PID` 展示；它是 Windows 枚举出的 USB 厂商/产品 ID，不是 Meshtastic 节点 ID，也不能区分两台同型号设备。已识别到真实设备后，仍优先展示本机 Short Name / 节点后四位。
- 日志串口下拉中的已占用测试串口继续置灰不可选，但不再追加“运行中使用”等提示文案；未占用串口仍可用于查看串口日志。
- `L2-CLI-002` 中 “NodeDB 是否包含另一台测试设备” 改为可见性备注：节点列表缺少对端不再判定前置检查失败，只在步骤证据中记录 `node_visibility_not_confirmed`，因为 NodeDB 可见性不是联系人成功或点对点 ACK 的证明。
- 非写入读命令的串口握手增加恢复路径：优先使用 `safe_meshtastic_cli.py` 抑制 DTR/RTS，若仍出现握手/协议类瞬态失败，再自动尝试一次官方 `.venv\Scripts\meshtastic.exe` 路径，并在证据里标注 `safe_no_reset_cli -> official_meshtastic_cli`。
- 串口通信默认路径从持久 Python API 切回 CLI `sendtext + 对端 --listen` 证据路径，并恢复发送命令 `--wait-to-disconnect=10`。通过条件仍是监听端输出包含用户填写的消息；设备提示音、发送端返回 0、`Sending`、`Connected` 或 ACK 字样都不能单独判定消息送达。
- 通信监听端就绪等待从最低 2 秒提高到最低 4 秒、默认跟随 `step_gap=5s`，减少监听进程刚打开串口、设备尚未完成握手时就开始发送导致的漏收。
- 执行结果统计卡片的 active state 保留语义色：PASS 为绿、FAIL 为红、SKIP 为灰，避免点击失败卡片后视觉上变成通过色。
- 本轮待硬件回归重点：COM 切换后读身份是否仍出现握手失败；点对点通信是否能在接收端 `--listen` 中看到用户消息，并且设备 UI 是否同步显示。

### 2026-09-14 补充：点对点路由、WiFi/Bluetooth 读回与结果滚动修复
- 修复串口点对点通信实际发送路径：`run_listen_send_step()` 现在把 `dest` 传入真实发送命令，点对点模式生成 `--dest !peerNode --sendtext ... --ack`，不再退化成频道广播；频道模式仍使用 `--ch-index N --sendtext ...`。
- 点对点监听端不再强制追加 `--ch-index`，只执行 `--listen`，避免对私聊消息做频道过滤；频道发送仍按指定频道监听。
- 通信用例进度估算从旧的单步 Python API 逻辑调整为当前 CLI send/listen 双向两步，已知双设备 ID 时显示 2 步。
- 配置写入的瞬态握手失败处理收敛：配置写入类命令允许有限重试，但不回退到官方 `meshtastic.exe`，避免绕开 no-reset 包装器；非写入读命令仍允许 safe wrapper 失败后 fallback。
- 配置读回阶段增加更稳的重试窗口，覆盖配置写入后设备重启、USB CDC 尚未完全恢复导致的读回失败。
- WiFi 配置读回同时读取 `bluetooth.enabled`，页面当前配置可同步显示 WiFi/Bluetooth 互斥状态；前端配置缓存新增 `network.wifi_enabled`、`network.wifi_ssid`、`network.wifi_psk`、`bluetooth.enabled` 标签。
- WiFi Key 输入框新增显隐切换按钮，便于人工校验密码输入；结果统计卡片点击筛选不再触发主内容滚动，避免左侧功能卡片跟随跳动。
- 本轮验证：`py_compile` 通过；bundled Node `--check app.js` 通过；`git diff --check` 通过；JSON 解析通过；通信 dry-run 确认两条点对点命令均包含 `--dest`；WiFi dry-run 确认读回命令包含 WiFi 与 `bluetooth.enabled`。
- 本轮未连接真实硬件执行，不声明真实设备收发已验证；需用户在 COM37/COM38 或当前实际 COM 场景复测。
### 2026-09-15 补充：通信结果标签固化与接收端判定修正

- 串口扫描卡片去掉“设备标识 / USB VID:PID”小字；`303A:1001` 这类值仅表示 Windows USB VID/PID，不是 Meshtastic 节点 ID，不能区分两台同型号设备。
- 前端运行载荷新增 `primaryLabel` / `peerLabel`，后端传入 runner 的 `--primary-label` / `--peer-label`；报告里的 `target_label` / `listen_target_label` 在运行时固化，避免历史结果被当前页面设备状态污染。
- 已确认 `e518` 的节点 ID `!7ac9eab2` 后四位是 `eab2`；显示名仍优先使用设备 `Short Name=e518`，node ID 后四位只作为回退标识。
- 串口点对点通信判定修正：`run_listen_send_step()` 只用接收端 `--listen` 输出匹配用户消息；发送端 stdout 中的 `Sending text message ...`、ACK 或命令文本不再能让用例 PASS。
- 点对点发送步骤增加独立 `send_timeout`：在全局单步默认 30s 不变的前提下，发送命令按 `receive_wait + wait_to_disconnect + 45s` 放宽，避免 `--ack` 与 `--wait-to-disconnect 10` 被外层 30s 提前杀掉。
- 本轮验证：`py_compile` 通过；`node --check app.js` 通过；`git diff --check` 无空白错误；通信 dry-run 生成 `8944发给e518` / `e518发给8944`，两条命令均包含正确 `--dest`。

### 2026-09-15 补充：点对点双向通信误判根因与修复

- 本次失败报告显示消息内容为 `us`；旧逻辑使用 `message in listener_combined`，导致监听端 NodeDB/debug 日志里的 `user`、`isUnmessagable` 等字段包含 `us` 子串时被误判为已收到消息。
- 已新增 `listener_has_exact_text()`：CLI listen 兜底路径只接受 `message: ...`、`text: "..."`、`decoded.text` 等明确文本消息字段，不再做普通子串匹配。用本次失败报告回放验证：两个步骤旧值 `received_message=True`，新精确匹配均为 `False`。
- 双串口实机通信默认切回持久 Python API 双连接路径：`python-api dual-send` 同时打开两台串口，订阅 `meshtastic.receive.text`，按 `decoded.text == 用户消息`、from/to、channel 精确判定。这样避免 CLI `--listen` debug 日志误判，也减少反复开关串口带来的设备重启/握手失败。
- 官方 Python API `sendText()` 文档字符串说明文本消息会显示在带屏幕设备上；因此当前优先验证 API 接收到的 `decoded.text`，而不是发送端 ACK 或 CLI 调试日志。
- 本轮验证：`py_compile` 通过；`node --check app.js` 通过；`git diff --check` 仅有既有 CRLF 提示；通信 dry-run 确认双串口场景只生成 `点对点双向发送`，命令为 `python-api dual-send --message-mode device --message-channel 0`。

### 2026-09-15 补充：BLE 双设备隔离、GATT 重连与通信证据分层

- Web Bluetooth 连接改为按测试设备 1 / 测试设备 2 两个角色隔离：每个角色都有独立的扫描、选择、连接、断开、状态和设备列表。扫描第二台 BLE 设备不会清空第一台已经选择或连接的设备。
- 浏览器侧 BLE 执行新增 GATT 重连保护：执行身份读取、配置读取或通信前会检查 `device.gatt.connected`，若浏览器对象仍存在但 GATT 已断开，会重新执行 `device.gatt.connect()` 并重新获取 Meshtastic service / characteristic，避免 `GATT Server is disconnected. Cannot perform GATT operations` 直接失败。
- Web Bluetooth 单设备场景现在只执行单设备身份读取；只有两台设备都建立浏览器 GATT 会话时才执行双设备通信。串口、后端 BLE、浏览器 Web BLE 的执行结果和报告均增加通道标识，避免把串口 CLI 结果误认为 BLE 结果。
- Web BLE 浏览器侧结果会通过 `/api/client-report` 保存到 `logs/meshtastic_cli_webble_report_*.json`，报告字段包含 `transport=web_bluetooth`、`connection_type=ble`、`generated_by=dashboard_browser`，用于区分后端 runner 报告。
- 串口通信通过判定继续以“接收端确实收到指定文本”为核心证据；但 Python API 路径的 PASS 现在只代表 `meshtastic.receive.text` 事件收到了指定文本，不再表述为设备屏幕或聊天框一定显示。若要证明设备 UI 可见，需要设备日志中出现 `Received text msg` / `DeviceUI newMessage` 等固件 UI 侧证据。
- 手动设备日志已确认真实成功收发时会出现 `PACKET FROM PHONE/RADIO`、`Received text msg ... msg=...`、`DeviceUI newMessage` 等关键标记；后续通信问题定位应优先用这些标记区分“API 收到”“App 收到”和“设备 UI 收到”三层证据。
- 串口 Python API 双机通信在收到 ACK/接收事件后会保持连接一段时间再断开，默认按 `wait_to_disconnect` 至少 3 秒、最多 20 秒，给设备 UI / 手机端事件队列留出落盘和显示窗口。
- 本轮静态验证：`py_compile` 通过；bundled Node `--check app.js` 通过；`git diff --check` 无空白错误，仅有 Windows CRLF 提示。未连接真实硬件执行 BLE/串口收发，真实设备侧结果仍需用户复测。

### 2026-09-15 补充：私聊 PKI 发送、单设备频道发送与 BLE 配置边界

- 串口点对点私聊根因继续收敛：手动成功日志显示设备 UI 可见的私聊包为 `TEXT_MESSAGE_APP + PKI`，而旧自动化串口 Python API 只调用 `sendText()`，未显式携带对端 `public_key` 和 `pki_encrypted`。这会出现设备响、无线/ACK 层有反应，但设备聊天框或 App 会话不可见的现象。
- `runner.py` 的双串口持久 Python API 私聊路径已改为 `sendData(..., portNum=TEXT_MESSAGE_APP, pkiEncrypted=True, publicKey=对端公钥)`；如果缺少任一方向的对端公钥，会直接失败为 `missing_peer_public_key`，不再下发普通非 PKI 私聊包。
- 前端运行载荷新增 `primaryPublicKey` / `peerPublicKey`，来自前置检查缓存的设备本机公钥；后端 `server.py` 透传为 `--primary-public-key` / `--peer-public-key`，避免通信阶段轻量连接拿不到 NodeDB 公钥。
- Web Bluetooth 私聊 protobuf 也补充 `MeshPacket.public_key` 与 `MeshPacket.pki_encrypted` 字段；频道广播仍不需要公钥。
- 频道发送前置条件修正：发到频道只需要一台已连接设备即可执行；发给对端设备才需要两台设备和对端公钥。单设备频道发送的 PASS 只代表 `ToRadio`/CLI 下发被当前设备接受，不代表空口接收验证。
- Web BLE 配置写入仍未实现 Admin protobuf 写入/读回；在浏览器 GATT 已连接时点击配置写入会返回 `SKIPPED`，不再显示等待配置生效后误判为 PASS。真实配置写入仍走串口/TCP 后端路径。
- 当前 Web BLE 前置检查只能读取身份类数据：node ID、Short Name、Long Name、公钥；完整 LoRa/WiFi/Bluetooth 配置读取仍未实现，需要后续补 Admin/Config protobuf 状态机。
- 本轮验证：`py_compile` 检查 `runner.py`、`server.py`、`safe_meshtastic_cli.py` 通过；bundled Node `--check app.js` 通过；`git diff --check` 无空白错误，仅有 CRLF 提示；dry-run 确认单设备频道发送生成单步 `--ch-index 0 --sendtext ...`，双设备点对点生成 `python-api dual-send`。
- 本轮未连接真实硬件执行收发；下一轮实测重点是设备 UI 是否出现 `Received text msg` / `DeviceUI newMessage` 对应的聊天记录，而不是只看 ACK 或提示音。

### 2026-09-16 补充：结果简化、频道可见路径与 MeshCore 模式隔离

- 执行结果面向普通使用者的标题与原因已简化：结果卡片默认不再直接展示 `L2-...` 编号和长篇 `PASS 表示...` 技术说明；技术命令、stdout/stderr、ACK、监听证据保留在“技术详情”折叠区。
- Meshtastic 频道模式继续强制走 CLI `sendtext + listen` 用户可见路径；持久 Python API 只保留给点对点私聊 PKI 路径。原因是 Python API 可能收到文本事件但不一定让设备屏幕/聊天框生成用户可见记录。
- 顶部模式切换从“实机只读 / 实机可写”改为 `Meshtastic / MeshCore`；两种模式默认均为实机可写，运行载荷新增 `systemMode`。
- 后端 `/api/run` 按 `systemMode` 选择 runner：Meshtastic 使用 `tests/meshtastic_cli_demo/runner.py`，MeshCore 使用新增 `tests/meshcore_demo/runner.py`；报告文件名前缀分离为 `meshtastic_cli_dashboard_report_*` 与 `meshcore_dashboard_report_*`。
- MeshCore runner 已加入最小可用协议适配层：支持串口 / BLE / TCP 入口、设备身份读取、频道发送、基础点对点联系人发送；配置写入暂返回明确 `SKIPPED`，避免误用 Meshtastic 配置命令造成假通过。
- MeshCore 参考官方 Companion Protocol：BLE 走 Nordic UART 风格 GATT 服务，不复用 Meshtastic ToRadio/FromRadio protobuf；后续完整 BLE 配置读写需要继续按 MeshCore command/packet 做逐项映射。
- 本轮验证：`py_compile` 检查 Meshtastic runner、dashboard server、MeshCore runner 通过；bundled Node `--check app.js` 通过；MeshCore channel dry-run 可生成独立报告；Meshtastic 单设备频道 dry-run 仍为 SKIPPED/DRY 路径，不触碰硬件。
- 本轮未连接真实硬件执行 MeshCore 或 Meshtastic 收发；设备 UI 是否显示消息仍需用户在实际 COM/BLE 环境复测。

### 2026-09-16 补充：双模式视觉、下拉控件和串口扫描回归修复

- 控制台名称从单一 `Meshtastic 控制台` 改为中性的 `Mesh 测试台`，副标题随 `Meshtastic / MeshCore` 模式切换，避免双系统入口仍显示单系统名称。
- 顶部 `Meshtastic / MeshCore` 分段切换控件统一选中态：当前模式使用绿色背景白字，未选模式保持同尺寸中性按钮，不再出现一白一灰的视觉不一致。
- 自定义下拉控件加强原生 `select` 隐藏规则，并在串口扫描、日志串口扫描后强制刷新 custom select，避免回退到浏览器蓝色原生下拉菜单。
- 串口扫描增加 Windows `HKLM:\HARDWARE\DEVICEMAP\SERIALCOMM` 注册表兜底枚举；当前 Codex 进程实测 `pyserial/WMI/registry` 均返回空，说明本轮环境没有暴露 COM 映射，用户实机复测仍以页面刷新后扫描结果为准。
- 本轮验证：bundled Node `--check tests/meshtastic_cli_dashboard/app.js` 通过；`.venv` Python `py_compile tests/meshtastic_cli_dashboard/server.py` 通过；`server.detect_serial_ports()` 当前返回 `[]`。

### 2026-09-16 补充：模式状态隔离、Meshtastic 配置恢复与通信发送路径修正

- Meshtastic / MeshCore 模式切换现在会清空上一模式的执行结果、筛选状态、设备快照、节点 ID、频道缓存和运行进度，避免两个固件系统之间的测试数据残留串扰；物理连接选择不主动断开，避免不必要地打断用户已选串口或 BLE。
- Meshtastic 模式配置项恢复为专属列表：User name、Region、Modem Preset、Channel、Device Role、WiFi、GPS、Bluetooth、Language；MeshCore 模式只保留当前明确需要的 Radio Preset 和 Custom Frequency，避免照搬 Meshtastic 配置字段。
- 自定义下拉框隐藏原生 `select` 的方式改为 `display:none !important`，防止浏览器原生蓝色下拉菜单回退显示；页面标题更新为 `Mesh固件控制台`，隐藏拥挤副标题。
- 通信用例标题按实际发送方式显示：频道模式显示 `频道通信`，点对点模式显示 `点对点双向通信`；结果卡片中的 `技术详情` 已简化为 `详情`。
- 串口点对点通信发送路径从手工 `sendData(..., pkiEncrypted=True, publicKey=...)` 改回官方高层 `sendText(destinationId=..., wantAck=True)`。依据是本地 `meshtastic` Python API 注释明确 `sendText()` 会让带屏设备显示文本，而旧底层路径已出现 API 收到 ACK/文本事件但设备 UI/聊天框不可见的现象。
- 点对点发送仍保留对端接收事件和 ACK 证据，但不再把“缺少对端公钥”作为自动化层面的发送前硬阻断；公钥仍作为前置检查和报告证据记录。
- 本轮已验证：`C:\Users\EDY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check tests\meshtastic_cli_dashboard\app.js` 通过；`.venv\Scripts\python.exe -m py_compile tests\meshtastic_cli_demo\runner.py tests\meshtastic_cli_dashboard\server.py` 通过；本地服务 `http://127.0.0.1:8765/api/health` 返回 `ok=true`。
- 本轮未连接真实硬件执行发送；设备端聊天框是否可见需要用户刷新页面后用当前 COM/BLE 环境复测。若仍不可见，下一步应抓设备串口日志中 `Received text msg` / `DeviceUI newMessage` 相关证据，区分“无线收到”“App 收到”和“设备 UI 显示”三层路径。
## 2026-09-16 补充：Meshtastic 配置项恢复、模式切换状态清空与点对点发送路径回退

- 修复 Meshtastic 模式下 `configKind` 自定义下拉为空的问题：重建配置项 option 后立即同步自定义下拉按钮文本，配置项恢复为 User name、Region、Modem Preset、Channel、Device Role、WiFi、GPS、Bluetooth、Language。
- Meshtastic / MeshCore 模式切换时清空上一模式的执行结果、进度、串口扫描列表、BLE 扫描列表、报告列表、设备快照、节点 ID、频道缓存和待下发配置，并加入短暂刷新态，避免用户误以为仍在复用上一模式数据。
- 通信配置区的 Region、Modem Preset、Frequency Override MHz 改为未勾选时置灰不可编辑，勾选后才允许选择或填写。
- 通信结果标题按真实 `message_mode` 优先判断：`device` 显示“点对点双向通信”，`channel` 显示“频道通信”，避免 `channel=0` 误判点对点结果。
- 针对设备端看不到点对点消息的问题，点对点串口通信路径从 `serial_persistent` 双串口持久会话回退为顺序 CLI 单次发送：每次只占用发送端串口并等待 ACK，发送后释放串口，减少接收端监听会话对设备 UI 消息展示的干扰。该改动需要用户用实机复测确认设备聊天框是否可见。
- 已验证：`node --check tests/meshtastic_cli_dashboard/app.js` 通过；`python -m py_compile tests/meshtastic_cli_demo/runner.py tests/meshtastic_cli_dashboard/server.py` 通过；`/api/health` 返回 `ok=true`。
# 2026-09-22 Meshtastic Web BLE 修复快照

- 当前阶段 MeshCore 模式暂停推进，避免继续引入模式切换串扰；优先把 Meshtastic 的 Web Bluetooth 路径做完整。
- Web BLE 的核心链路按 `GATT -> ToRadio / FromRadio -> Meshtastic protobuf` 实现，不再把 BLE 当作串口参数透传。
- 已确认并修复 BLE protobuf 编码关键点：`MeshPacket.to`、`MeshPacket.id` 属于 `fixed32` wire type 5，不能按 varint 编码；解析端也需要支持 wire type 5。
- Web BLE 前置检查应读取并刷新本设备身份、Short Name、Long Name、公钥、LoRa 配置、WiFi/Bluetooth/GPS/MQTT 状态、频道列表和 NodeDB 节点列表。
- Web BLE 配置读写应走 `ADMIN_APP` protobuf：写入前先读当前值，值一致则跳过写入；写入后等待设备生效，再读回同字段校验。
- Web BLE 通信优先级：先完成单设备身份读取和频道发送，再扩展双设备点对点私信、双设备独立连接和互不干扰运行流程。

### 2026-09-22 补充：Meshtastic Web BLE 单设备优先路径修正

- 当前继续暂停 MeshCore 推进，只处理 Meshtastic Web BLE 路径，避免双模式功能串扰。
- 修复 Web BLE 通信消息来源：所有 BLE/串口通信 payload 统一读取页面 `messageText`，不再读取历史遗留的 `messagePrimary/messagePeer` 字段，避免报告内容与用户输入不一致。
- Web BLE 频道通信按设备数量自适应：单台 BLE 连接时只执行“单设备发送到频道”，报告标题为“频道通信”，目标为当前设备和频道；双台 BLE 连接时才执行双设备频道发送与接收确认；点对点模式仍要求两台设备。
- Web BLE 结果报告新增模式化字段：`module`、`stepName`、`targetLabel`、`passCriteria` 会按“频道通信 / 点对点双向通信 / 单设备频道发送”分别生成，不再把频道发送误写成点对点双向通信，也不再把单设备场景写成“两台设备”。
- 修复自定义下拉动态 option 变更后的同步问题：每次 `syncCustomSelect()` 都重建自定义菜单并关闭旧打开态，降低 Meshtastic 配置项下拉在模式切换或重建后显示为空的概率。
- 通信消息输入新增常用消息快捷按钮：`hi`、`bye`、`ping`、`test`、`ok`，点击只填充 `messageText`，不自动发送。
- Region / Modem Preset 未勾选时的灰度改为只依赖外层 `muted-field`，与 Frequency Override MHz 的置灰程度保持一致。
- 本轮验证：`C:\Users\EDY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check tests\meshtastic_cli_dashboard\app.js` 通过。未连接真实 BLE 设备执行硬件收发，单设备频道发送与 BLE 配置读写仍需用户实机复测。



## 2026-09-23 补充：Web BLE 单设备入口与持续收发验证
- 用户决策更新：Web BLE 不再追求双设备并行连接，先保证单设备链路稳定；另一台设备由人工观察/操作，用持续收发间接验证双向通信链路。
- 本轮 UI 收敛：BLE 连接区域从“测试设备 1 / 测试设备 2”改为单一“测试设备 BLE”入口；BLE 模式下隐藏第二 BLE 卡片，不再显示置灰的第二设备入口。
- 本轮功能修复：浏览器 GATT 连接成功后先清空本角色旧身份缓存，再尝试读取完整配置并刷新“设备当前配置”；完整配置读取失败时降级为轻量身份读取，避免连接成功但页面仍只显示少量信息。
- 新增“BLE 持续收发”工具：平台连接一台 BLE 设备后，可按固定间隔循环发送当前消息到选定频道；支持手动停止、异常自动重试、记录发送总数/接收总数/异常数、发送/接收时间戳、消息内容和可用信号指标。
- 持续收发边界：该工具记录浏览器通过 Meshtastic `ToRadio`/`FromRadio` 实际观察到的数据；另一台设备屏幕/聊天框是否正确显示仍需人工同步观察，不能仅凭平台计数替代设备端可见性结论。
- 已验证：`C:\Users\EDY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check tests\meshtastic_cli_dashboard\app.js` 通过。真实 BLE 单设备连接、配置读取和持续收发需用户刷新页面后复测。

## 2026-09-23 补充：Web BLE 单设备 UI 去冗余与完整配置前置检查

- BLE 单设备模式进一步收敛：页面不再保留“测试设备 2 BLE”卡片和对应置灰提示；BLE 入口只展示一台测试设备，另一台设备作为人工观察端。
- “BLE 持续收发”从通信验证表单中移入测试项区域，定位为长时间链路验证（soak test）：循环发送、持续接收、异常重试、统计发送/接收/异常，并记录时间戳、消息内容和可用信号指标。
- Web BLE 前置检查从轻量身份读取改为优先完整配置读取：读取身份、公钥、LoRa、WiFi、Bluetooth、GPS、MQTT、频道和 NodeDB；完整配置失败时才降级为身份读取，并把 `configComplete=no` 写入证据，不再把半截配置当完整通过。
- Web BLE Admin 读取请求继续走本机 node id 的 `ADMIN_APP` 响应路径，频道读取保持 1-based `get_channel_request`，用于提升频道列表和当前配置展示完整性。
- 单设备频道发送后增加短 FromRadio 读取窗口，并在报告中写入 `localFromRadioEvents` 与接收事件列表；但单 BLE 场景仍不能替代另一台设备屏幕/聊天框确认。
- 本轮验证：`C:\Users\EDY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check tests\meshtastic_cli_dashboard\app.js` 通过；`C:\Users\EDY\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m py_compile tests\meshtastic_cli_dashboard\server.py` 通过。真实 BLE 配置完整读取和频道空口可见性需用户刷新页面后复测。

## 2026-09-23 补充：Web BLE 单设备收发入口与下拉控件收敛

- 连接方式进一步收敛：Meshtastic 测试执行页只保留 `串口` 与 `蓝牙连接`，移除 `TCP` 和 `不连接设备`；页面可见文案也不再提示 TCP，BLE 模式下仍按单设备稳定链路推进。
- BLE 测试项卡片改为 `BLE 持续收发`：提供 `持续接收` 与 `持续发送` 两个独立入口，停止按钮统一结束当前持续任务；持续发送会按间隔循环发送并持续轮询接收，持续接收只保留接收轮询。
- BLE 配置下发修复：`runPayload()` 与通信配置计划在 BLE 单设备模式下强制目标为 `primary`，避免旧的 `both/peer` 目标导致“下发配置”点击后无响应或等待无效设备。
- Meshtastic 配置项与通信验证选项从共享列表重建；Region 当前包含 `US/EU_868/CN/JP/ANZ/KR/TW/RU/IN`，动态重建后会立即同步自定义下拉。
- 下拉组件统一：页面初始化先执行 `refreshCustomSelects()`，动态 `option` 重建统一走 `fillSelectOptions()`；原生 `<select>` 仅作为隐藏值载体，避免 Windows/Chrome 原生蓝白下拉菜单回退显示。
- 已验证：`node --check tests\meshtastic_cli_dashboard\app.js`、`python -m py_compile tests\meshtastic_cli_dashboard\server.py`、`git diff --check` 均通过；`GET /api/health` 返回正常。`impeccable detect` 仅报告既有设计系统 advisory/warning，本轮未扩大处理。

## 2026-09-24 补充：Web BLE 运行态释放、配置下发与指定节点发送

- BLE 模式下通信执行入口改为只要连接方式为 `蓝牙连接` 就走浏览器 Web Bluetooth 路径；无有效 GATT 连接、执行异常或配置前置失败都会生成前端结果并释放运行态，不再卡在“任务已提交，等待 runner 返回进度”。
- BLE 配置下发入口改为按连接方式强制走 `ADMIN_APP` Web BLE 写入；编码、写入或读回异常会进入失败结果并释放按钮，避免点击后无响应。
- BLE 单设备点对点新增“指定节点”下拉：目标来自当前已连接设备 NodeDB，显示节点名和 node id 后四位；缺少目标或缺少对端公钥时明确失败，不再伪装成发送成功。
- BLE 频道发送仍支持单设备：只能证明当前设备接受 ToRadio 写入；另一台设备屏幕/App 是否可见仍需人工观察或对端日志验证。
- BLE 持续收发卡片取消内层重复卡片层级：`持续接收` 与 `持续发送` 使用同级绿色主按钮，统计改为三块指标，日志区使用浅灰背景并扩大可读区域。
- “设备当前配置”展示区域继续压缩最大高度，减少单设备配置文本造成的页面失衡；通信验证主操作按钮统一为绿色主色。
- 本轮未改动串口通信后端路径。已验证：`node --check tests\meshtastic_cli_dashboard\app.js`、`python -m py_compile tests\meshtastic_cli_dashboard\server.py`、`git diff --check` 均通过。真实 BLE 指定节点发送与配置写入仍需用户刷新页面后实机复测。
## 2026-09-24 补充：BLE 持续收发卡片布局和按钮反馈修复
- 用户反馈：BLE 持续收发卡片出现两个“BLE 持续收发”标题；“空闲”和“清空”占用顶部空间；统计结果位置靠下；频道/目标节点的发送模式不清楚；“前置检查 / 建立联系人 / 运行通信 / 持续发送”等按钮点击后看起来没有反应。
- 本轮修复：`tests\meshtastic_cli_dashboard\index.html` 去掉 BLE 持续收发卡片内部重复标题、`清空` 按钮和 `空闲` 状态，把“已发送 / 已接收 / 异常”统计移到卡片顶部，并新增 `发送目标：频道/节点` 与说明文本，明确目标节点为空时是发给频道。
- 本轮修复：`tests\meshtastic_cli_dashboard\styles.css` 压缩 BLE 卡片内部纵向间距，日志区高度从过高改为紧凑区间；BLE 单设备模式下释放右侧 sticky 结果栏，让执行结果落到测试卡片下方，避免配置/通信卡片被覆盖。
- 本轮修复：`tests\meshtastic_cli_dashboard\app.js` 对 BLE 模式下的阻塞点击给即时反馈：未连接 BLE、Web BLE 单设备模式不支持建立联系人、无连接时不能运行通信、已有任务运行时不能重复启动，都会写入命令区和 BLE 日志，不再无声返回。
- 已验证：`node --check tests\meshtastic_cli_dashboard\app.js` 通过；`python -m py_compile tests\meshtastic_cli_dashboard\server.py` 通过；`GET /api/health` 正常；Chrome CDP 点击验证显示标题计数为 1、BLE 卡片无“清空/空闲”、面板重叠全为 false，四个关键按钮均有明确反馈。最终截图保存到 `tmp\ble_dashboard_final.png`。

## 2026-09-24 补充：BLE 单设备布局、配置读取重试与手动重读
- 范围约束：本轮只处理 `Project_01_WioTrackerL2`，不读取或修改 SenseCAP MeshPager X2 等其他项目，避免需求和实现串扰。
- BLE 单设备模式下移除主操作区的“通信验证”卡片展示，通信能力由“BLE 持续收发”覆盖；主操作区保留“BLE 持续收发”和“配置写入”两张卡片，执行结果恢复到右侧 sticky 结果栏，用于查看前置检查、配置写入和运行结果。
- BLE 连接流程新增“重新读取”按钮：GATT 已连接但完整配置读取失败时，不需要断开重连，可直接重新拉取设备信息。
- BLE 配置读取改为自动重试：完整配置读取失败会自动重试，再失败时降级读取基础身份并给出用户可理解的失败原因，避免直接暴露 `GATT operation failed for unknown reason`。
- BLE 连接提示改为“正在尝试连接 BLE；如系统弹出 PIN，请先完成配对，页面会继续等待”，连接后增加短暂稳定等待，给 Windows PIN 配对和 GATT 会话建立留出时间。
- 修复 BLE 前置检查 / 配置写入按钮的无响应问题：如果上一轮 Web BLE 前端任务状态卡住，会先尝试释放 stale running 状态；仍有任务运行时会给出明确提示，而不是静默返回。
## 2026-09-24 补充：BLE 连接阶段去业务读写与首屏布局修复
- 本轮目标：修复 BLE 连接阶段提示过早、前置检查/下发配置点击反馈不明显、首屏布局需要切换连接方式后才恢复的问题。
- 本轮修复：BLE 点击连接后只建立浏览器 GATT 连接和通知订阅，不再立即执行配置读取、FromRadio drain 或 ToRadio 业务写入；设备信息读取改由“运行前置检查”或“重新读取”明确触发，避免 Windows/浏览器 PIN 配对尚未完成时提前报 GATT 写入/读取失败。
- 本轮修复：BLE 运行前置检查、BLE 下发配置点击后会立即在执行结果区显示“正在准备...”状态；若前置条件不满足，会给出当前条件不足的可见反馈，避免用户感觉按钮无响应。
- 本轮修复：首屏默认隐藏 BLE 持续收发面板，避免刚进入串口模式页面时通信卡片布局被 BLE 子面板撑乱；BLE/PIN 提示文案压缩为单句，减少提示堆叠。
- 已验证：`node --check tests\meshtastic_cli_dashboard\app.js` 通过；`python -m py_compile tests\meshtastic_cli_dashboard\server.py` 通过；`git diff --check` 仅提示 Git 的 CRLF 换行转换警告，无空白错误。

## 2026-09-29 补充：BLE runner 中断修复、停止运行按钮与运行中禁用、L1 Pro 串口慢与报告刷新根因

本轮四项工作按「功能修复 → UI 交互 → 问题排查 → 报告刷新」顺序推进，范围仍限定在 `Project_01_WioTrackerL2`。

### 1. 功能修复：BLE 模式下所有 runner 类操作直接中断
- 根因：Web BLE 单设备布局执行 `ensureSingleBleLayout()` 时会 `peerCard.remove()`，把测试设备 2 的 BLE 卡片连同 `#peerBleValue` 一起从 DOM 移除；`runPayload()` 仍按 `$('peerBleValue').value` 取值，抛 `TypeError: Cannot read properties of null (reading 'value')`，被 Promise 吞掉后表现为「点下发配置/前置检查无反应」——命令区停在「正在准备 BLE 配置下发...」、`state.runs` 不增长、结果列表为空。
- 修复：`tests\meshtastic_cli_dashboard\app.js` 的 `runPayload()` 对 `#bleValue` / `#peerBleValue` 改用可选链并回退空串（`$('peerBleValue')?.value.trim() || ''`）。BLE 模式下前置检查、下发配置、通信三条路径都经过 `runPayload()`，一处修复同时恢复。
- 验证：BLE 模式 + 单设备布局下 `runPayload('customConfig','')` 不再抛出（`threw:null`、`connectionType:'ble'`、payload 41 个字段），`#peerBleValue` 确认不在 DOM 中。

### 2. 功能修复：页面首屏死掉（`init()` 从未执行）
- 根因：`app.js` 末尾残留 `setRunMode('read')` 调用，而 `setRunMode` 在整个文件中不存在（全文件仅此一处引用），顶层 `ReferenceError` 让紧随其后的 `init()` 永不执行。表现是用例数 `0 条用例`、模块栅格空、报告列表空、健康区停在「检查服务 / 待检查」，而后端 `/api/cases`、`/api/reports` 其实正常。
- 修复：删除该陈旧调用。
- 验证（Chrome 实测）：`caseCount=4 条用例`、`healthDot=dot ok`、`healthText=服务正常`、`navCliStatus=已就绪`、`state.cases.length=4`、报告列表 12 条，且页面加载期间 `pageerror`/console error 均为 0。模块栅格显示「暂无独立测试项」属于设计行为——`renderModules()` 会跳过 `测试前检查` 与 `可选取证` 两个模块，当前 4 条用例恰好全属于这两个模块。

### 3. 功能修复：User name 写后读回恒判 FAIL
- 根因：`encodeBleAdminWrite()` 的写回期望字段用 protobuf 命名 `owner.long_name` / `owner.short_name`，而 `bleReadbackValue()` 从设备快照 `owner` 取键，快照存的是 camelCase `{shortName,longName}`，取值为 `''`，导致写入成功后仍报 `web_ble_config_readback_mismatch`，并且「值已一致则跳过写入」永不生效。
- 修复：`bleReadbackValue()` 同时接受 `longName/shortName` 与 `long_name/short_name`。
- 验证（真实 protobuf 夹具）：`ownerLong='Wio Tracker L2 Lab'`、`ownerShort='L2A'`、long/short 两项读回比对均由 false 变为 true；11 个 FromRadio 包全部解析，`configCompleteId=69420`、`nodeId=!0a0b0c0d`，region/频道/role/GPS 读回比对全部命中且错误值能被判为不匹配。

### 4. UI 交互：停止运行按钮与运行中禁用其他操作按钮
- `tests\meshtastic_cli_dashboard\styles.css`：`--red` 之外新增 `--red-dark: #8c2b28`；`.secondary.stop` 由「浅红底 + 红字」改为**红色填充 + 白字**，新增 `:not(:disabled):hover` 加深态与阴影、`:focus-visible` 红色描边。禁用态不再回退为浅红底（沿用全局 `button:disabled` 的半透明），否则未运行的首屏看起来和旧的次要按钮一模一样，用户会误判「页面刷新后没变化」——这是本轮返工点。
- `tests\meshtastic_cli_dashboard\app.js` 的 `setRunning()`：运行中只保留「逃生」按钮可点（`stopRun`、`stopBleContinuous`、`disconnectSerial`、`disconnectBlePrimary`、`disconnectBlePeer`），其余操作按钮（运行用例/下发配置/运行通信/建立联系人/扫描/重新读取/清空/刷新报告等）在运行期间一律 `disabled`。此前 `runSuite`、`runConfigWrite`、`runExperiment`、`startBleSend` 等被放在 `alwaysEnabled` 里，运行中仍可点击。
- 验证（Chrome computed style）：空闲（禁用）`rgb(180,61,58)` 红底 + 白字 + `opacity:0.5`；运行中（可点）`rgb(180,61,58)` 红底 + 白字 + `opacity:1`；hover `rgb(140,43,40)` 加深 + 阴影加强；移开回落。运行中 `runSuite/runConfigWrite/runContactExchange/runExperiment/refreshReports/scanLogPorts/scanBlePrimary/refreshBlePrimary/clearResults` 全部 `disabled=true`，`stopRun/stopBleContinuous/disconnectSerial` 保持可点。截图：`tmp\check_stop_enabled.png`、`tmp\check_stop_hover.png`、`tmp\check_stop_running_toolbar.png`、`tmp\check_stop_idle_toolbar.png`、`tmp\check_after_fix_top.png`。

### 5. 问题排查：两台 L1 Pro 串口前置检查「非常慢且跑到一半超时失败」
- 现象取证：用户本轮失败任务（`...report_20260929_164401_647a16fc73fd.json`）**根本没有报告文件**，只有 `logs\meshtastic_cli_progress_647a16fc73fd.jsonl`；进度显示 9 步里每步耗时 **78–87s**，第 7 步 `读取测试设备2频道0` 开始后进程被杀。同一现象在 16:33 的另一轮（`..._f38bb6894e43.jsonl`）完全复现。
- 对照基线：同机 L2 走 BLE 的 9 步报告（`..._163033_95e96a069360.json`）每步仅 **3.7–8.1s**，整轮 80s。
- 根因定位（三步彻底坐实）：
  1. 直接计时对比（`tmp\probe_serial_paths.py`，COM59/COM62 均为 `pioEnv=seeed_wio_tracker_L1_Pro_1W`）：**官方 CLI `--no-nodes --info` 5.42s 成功；`safe_meshtastic_cli.py` 包装器 34.2s 后报 `Connection timed out`**，两轮均复现。
  2. 逐层隔离（`tmp\probe_dtr_hypothesis.py`，只改 DTR 电平与是否清空缓冲区）：`DTR=1` 握手成功（9.3s / 4.05s），`DTR=0` 报 `Connection timed out`（33.97s）——**根因是包装器把 DTR/RTS 拉低**，L1 Pro 1W 的 USB-CDC 只在 DTR 有效时才回数据（清空缓冲区无关）。
  3. runner 侧放大倍数：`run_command_with_retries(timeout=30, attempts=2, delay=5, fallback=官方 CLI)` 在每步要白等 `30 + 5 + 30 + 5 ≈ 70s` 的必然失败尝试后才回退成功，于是每步 ≈80s；9 步 ≈720s 超过服务端任务预算 `timeout × steps + 180 = 450s` → 第 7 步被强杀 → **runner 来不及写报告**。
- 修复（`tests\meshtastic_cli_demo\runner.py` + `tests\meshtastic_cli_demo\safe_meshtastic_cli.py`）：
  - 包装器新增 `MESHTASTIC_SERIAL_DTR=1` 模式：同样是自家受控开端口径，只把 DTR/RTS 置为断言，不执行官方 CLI 的复位开合序列。
  - runner 新增「端口级 DTR 依赖记忆」`DTR_ASSERT_PORTS`：某串口出现握手整体超时（退出码 124 / `command_timeout_after_` / `Connection timed out`）时，立刻用同一包装器 + DTR 断言重试一次，成功即记入记忆；后续同端口步骤直接带 `MESHTASTIC_SERIAL_DTR=1` 跑，只执行一条命令。
  - 握手整体超时不再重复第二次同一条包装器命令（确定性失败，重复只多花一个 timeout）；官方 CLI 仍保留为最后手段。
- 实测收益（真机 COM59 + COM62 只读前置检查 11 步，`logs\meshtastic_cli_dashboard_report_20260929_171425_ca578897fea7.json`）：整轮 **202s 跑完 11 步并正常落报告**，步骤耗时从「每步 ~80s」变为「每端口首次 55s / 44s，其余 4–27s」，总步骤耗时 87.3s（旧逻辑同规模约 880s，约 4.3 倍提速），且不再触发超时强杀。
- 仍未解决并需要实机复测的边界：这一步用的是「回退官方 CLI」路径，而官方 CLI 会开合 DTR/RTS，**L1 Pro 因此掉出 USB 总线**——COM59 在步骤 10 报 `could not open port 'COM59': FileNotFoundError`，随后 COM62 也消失，两分钟后 COM59 又以空 `usbSerial` 反复闪现。用户最初「COM56 变成 COM62」很可能也是同一复位重枚举现象。第 11 步 `导出3354配置` 因 `target_unavailable:primary` 被 SKIPPED，整轮状态 FAIL，属设备掉线而非用例断言失败。
- 待复测：本轮新增的 DTR 断言包装器路径只在无硬件条件下完成了逻辑验证（`tmp\test_dtr_retry_logic.py`，8/8 通过：首次超时后自动切 DTR 变体、同端口后续直接走 DTR、其他端口不受影响、非包装器命令不注入环境、握手超时不重复二次尝试）。**需要用户重新插拔/上电两台 L1 Pro 后重跑一次前置检查**，确认走自研包装器 + DTR 后不再掉线、每步稳定在 5–10s。本轮结束时设备已处于坏的 USB 状态：COM59 只剩空 `usbSerial` 且 `--info` 立刻报 `The serial device couldn't be opened / FileNotFoundError`，`MESHTASTIC_SERIAL_DTR=1` 变体也无法验证，必须物理插拔或重新上电才能恢复。

### 6. 报告界面刷新不出最新报告：两处根因与修复
- 根因 A（前端）：第 2 条 `init()` 未执行导致报告列表在页面加载时根本没被填充，`刷新报告` 按钮虽已绑定但用户看到的首屏一直是空列表/旧列表。修复后新增：切到报告页 `activatePage('reports')` 会主动调用 `refreshReportList()` 拉取最新列表，`刷新报告` 按钮与该函数统一为同一入口（带失败提示）。
- 根因 B（后端）：任务被超时强杀时 `taskkill /F /T` 不会给 runner 任何落盘机会，报告 JSON 永远不存在，刷新自然也刷不出来。修复：`tests\meshtastic_cli_dashboard\server.py` 新增 `write_timeout_report()`，在 `run_job` 捕获 `TimeoutExpired` 后按进度文件补写一份 `status=timeout / reason=job_timeout` 的报告（含中断步骤、进度计数、端口、命令行、进度事件），并写回 `RUNS[job_id]` 的 `report/reportName/result/progressSummary`，让报告页能直接打开这次运行。
- 同时把任务预算从 `timeout × steps + 180` 调整为 `timeout × steps × 2 + 300`，为「包装器重试 + 官方回退」链路留出余量，避免慢设备上整轮任务被杀在半路。
- 验证：`tmp\test_timeout_report.py` 10/10 通过（文件落盘、status/reason、进度计数、中断步骤名与 FAIL 标记、任务预算、端口、进度事件全部保留）；Chrome 实测切页后与点击 `刷新报告` 后列表均为 12 条且首行为最新报告，真机运行结束后新报告 `..._20260929_171425_ca578897fea7.json` 立即出现在列表首位。

### 7. 本轮改动文件与验证入口
- 改动：`tests\meshtastic_cli_dashboard\app.js`、`tests\meshtastic_cli_dashboard\styles.css`、`tests\meshtastic_cli_dashboard\server.py`、`tests\meshtastic_cli_demo\runner.py`、`tests\meshtastic_cli_demo\safe_meshtastic_cli.py`、`SNAPSHOT.md`。
- 验证：`node --check tests\meshtastic_cli_dashboard\app.js` 通过；`.venv\Scripts\python.exe -m py_compile tests\meshtastic_cli_dashboard\server.py tests\meshtastic_cli_demo\runner.py tests\meshtastic_cli_demo\safe_meshtastic_cli.py` 通过；服务重启后 `/api/health` 返回 `ok=true`、`/api/reports` 12 条；Chrome 侧 `tmp\verify_fixes.js`、`tmp\verify_stopbutton.js` 全项通过；无硬件逻辑测试 `tmp\test_dtr_retry_logic.py`、`tmp\test_timeout_report.py` 全项通过。
- 仍未覆盖的边界：浏览器 Web Bluetooth 的 `requestDevice` 必须人工在系统选择器里选设备，Playwright/CDP 无法代选，真机 GATT 配置读写闭环仍需用户在真实 Chrome 里复测；本轮真机运行全部为串口只读步骤，未下发任何配置或消息。

### 8. 联系人互认第 5 步失败：`--add-contact` 被 30s 超时掐死（含超时证据丢失修复）

- 现象（`logs\meshtastic_cli_dashboard_report_20260929_173724_68e913a4fdef.json`）：步骤 1–4（`--no-nodes --info`、`--contact-qr`）4.1–5.7s 全通过；步骤 5 `--add-contact <url> --wait-to-disconnect 10` 卡满 **30.01s** 报 `command_timeout_after_30s`；步骤 6/8 因前置失败跳过、步骤 7 因 `primary:unavailable` 跳过，整轮 FAIL。前端把它渲染成「设备没有在超时时间内完成协议握手」，与事实不符。
- 根因（读 CLI 源码 + 历史同型命令耗时对照）：
  1. 只读步骤都带 `--no-nodes`（跳过完整 NodeDB 下载）所以 4–6s 连上；`--add-contact` 步骤没有 `--no-nodes`，要走完整连接。同一台 COM59 的历史耗时：`--no-nodes --info` 5.67s / 4.58s，而完整连接 `--info` 10.74s、`--ch-index 0 --info` 22.28s、另一轮 `--no-nodes --info` 14.16s。
  2. `meshtastic\__main__.py` 中 `--add-contact` 是「先 `resetNodeDb()` 再 `addContactURL()`」两次 admin 写入；`--wait-to-disconnect 10` 是 CLI 明确 `time.sleep(10)` 之后才断开。合计：完整连接 10–22s + 两次写入 + 强制睡眠 10s ≈ **20–34s**，正好压在全局 `--timeout 30` 上。
  3. 写操作走 `retry_safe=False` 分支 → `run_command(command, args.timeout)`，既无重试也无官方 CLI 回退，一次超时即判 FAIL；`mark_target_unavailable()` 又把 `command_timeout_after_` 当成「端口不可用」，于是后续 NodeDB 校验步骤被整体跳过——「联系人到底写进去没有」无从判断。
  4. `subprocess.run()` 超时被杀时丢弃全部已捕获输出，报告里 stdout 为空，只能用通用握手文案解释，把排查方向带偏。
- 修复（`tests\meshtastic_cli_demo\runner.py` + `tests\meshtastic_cli_dashboard\app.js`）：
  1. **步骤级超时**：新增 `step_timeout = int(step.get("timeout") or args.timeout)`，运行循环内所有 `run_command` / `run_command_with_retries` 改用它；两个 `--add-contact` 步骤标 `timeout: 90`，四个 `--nodes` 校验步骤标 `timeout: 60`。
  2. **`--add-contact` 加 `--no-nodes`**：联系人写入走 admin 通道、不依赖本地 NodeDB，省掉 10–22s 的完整下载。
  3. **超时也保留证据**：`run_command()` 改为 `Popen` + 双线程逐行读取，超时后返回 `partial_output: True` 与已收到的 stdout/stderr（下一次卡住能直接看到 CLI 停在哪一行）。
  4. **超时按进程树杀**：新增 `_kill_process_tree()`（Windows 走 `taskkill /F /T`）——`meshtastic.exe` 是启动器会再拉起 python 子进程，只杀启动器会留下孤儿进程继续占着 COM 口，正是「could not open port / 端口消失」的来源之一。
  5. **写操作超时不再标记目标不可用**：`mark_target_unavailable()` 只认真正的端口打开失败（新增 `is_port_open_failure()`），超时归为 `mutating_command_timeout` 并附 `failure_note`，前端不再显示「握手失败」。
- 验证：`py_compile` 通过；`node --check app.js` 通过；新增 `tmp\test_contact_import_fix.py` **30/30** 通过（步骤形状、真实子进程超时保留部分输出与 `partial_output` 标记、正常命令无该标记、stderr 独立采集、目标不可用三种判定、源码中不再残留 `run_command(command, args.timeout)`）；回归 `tmp\test_dtr_retry_logic.py` 8/8、`tmp\test_timeout_report.py` 10/10 通过。
- 待实机复测：本轮修复后设备始终不在线（17:37 那轮结束后 COM59/COM62 全部从系统消失，`serial.tools.list_ports` 返回空），需重新插拔两台设备后重跑「建立联系人」验证：预期每步 ~15–20s、导入步骤不再超时、NodeDB 校验步骤能实际执行。
- 顺带发现的测试设计注意点：CLI 的 `--add-contact` 在写入前会先发 `nodedb_reset`，即**导入联系人会清空设备 NodeDB**，之后只保证刚导入的那个联系人在库里，其余节点要等重新收包。这是 CLI 行为而非平台缺陷，但值得在报告里提示。

### 9. 联系人互认仍失败的真正原因：写操作绕过了 DTR 感知传输

- 18:13 那轮（`logs\meshtastic_cli_dashboard_report_20260929_181319_660087a43c48.json`，用户另存了一份到 Downloads）证明上一轮修复生效，并且第一次拿到 CLI 的真实错误：
  - 步骤 1/2（`--no-nodes --info`）25.09s / 10.25s 通过，`transport_variant=safe_no_reset_cli_dtr_asserted`；步骤 3/4（`--contact-qr`）4.12s / 4.14s 通过，同样是 DTR 断言变体。
  - 步骤 5（`--add-contact`）33.7s、**没有 `transport_variant`**，CLI 自己输出 `Connection timed out. / Device is rebooting`，reason=`exit_code_nonzero`；步骤 6/8 `dependency_not_run` 跳过、步骤 7 `dependency_not_run` 跳过（上一轮「写操作超时不标目标不可用」的修复已生效，不再误报 `target_unavailable`）。
- 根因：只读步骤走 `run_command_with_retries()`（带 DTR 记忆：某串口握手整体超时后改用 `MESHTASTIC_SERIAL_DTR=1` 的同一包装器并记住该串口），而**写操作走 `retry_safe=False` 分支直接调 `run_command()`，完全不查 DTR 记忆** → 在这两台必须断言 DTR 的设备上，写步骤注定握手失败。同一个串口，读能过、写必挂。
- 上一轮的改动（步骤级 90s + `--no-nodes`）方向正确但不足以解决问题：它把「被平台 30s 掐死」变成「CLI 自己 33.7s 后明确报连接超时」，并靠部分输出保留把真实错误显示出来，否则这一层根因仍会被「命令超时」掩盖。
- 修复（`tests\meshtastic_cli_demo\runner.py`）：
  1. 新增 `run_with_transport(command, timeout, allow_dtr_retry=True)`：已记忆串口 → 直接带 DTR 断言跑一次；未记忆串口 → 先按原样跑，只有 CLI 自报连接阶段失败（`Connection timed out.` / `timed out waiting for connection completion` / `failed to connect`）才带 DTR 重试一次并记住该串口。写操作分支与频道写入分支全部改走它。
  2. `--sendtext` 类发送命令传 `allow_dtr_retry=False`：只在已记忆时用 DTR，绝不自动重发，避免重复消息。
  3. `--listen` 接收进程显式带上 `env=merged_env(command_env_for_ports(listen_command))`，否则接收端同样握不上手、静默收不到消息。
  4. 进程内 Python API 路径：主/对端串口已记忆时先 `os.environ.setdefault("MESHTASTIC_SERIAL_DTR", "1")` 再建 `SerialInterface`（同一个 no-reset 补丁）。
  5. DTR 记忆落盘 `logs\serial_dtr_ports.json`：每个用例都是一次全新 runner 进程，内存记忆会丢，导致每轮第一步都要白等一次必然失败的尝试（18:13 步骤 1 就白等了约 20s）。`main()` 启动时载入，新增端口即写回；该文件已按 18:13 的证据预置 COM59/COM62。
  6. 测试不再污染真实状态文件：`tmp\test_dtr_retry_logic.py` 把 `dtr_state_path` 指向临时目录（此前它把假端口 COM56 写进了真实文件）。
- 验证：`py_compile` 通过；新增 `tmp\test_mutating_transport.py` **32/32** 通过（未记忆串口自动 DTR 重试并落盘、已记忆串口只跑一次、`--sendtext` 不重发且不注入、exit 124 不重发、端口打不开不重试、官方 CLI 命令不受影响、状态文件装载/合并/排序、`merged_env` 叠加、源码接线检查）；回归 `test_dtr_retry_logic.py` 8/8、`test_contact_import_fix.py` 30/30、`test_timeout_report.py` 10/10 全通过。
- 待实机复测：设备当前仍全部离线（`serial.tools.list_ports` 为空）。重新插拔后重跑「建立联系人」，预期每步 5–20s（不再有 20–30s 白等）、两个导入步骤都以 `transport_variant=safe_no_reset_cli_dtr_asserted` 通过、NodeDB 校验步骤真正执行。
- 补充：18:30 那轮串口「配置写入」（`logs\meshtastic_cli_dashboard_report_20260929_183021_0b31ba9dbd57.json`）在两台设备上 8/8 全 PASS，读取 3.7–4.1s、写入 13.5–14.9s，全部 `transport_variant=safe_no_reset_cli_dtr_asserted` 且无重试——预置的 DTR 记忆生效，第一轮不再白等 20s。

### 10. BLE 配置下发失败与 GATT 中途断开：自动重连 + 浏览器侧结果全部中文化

- 现象（用户报告）：`logs\meshtastic_cli_webble_report_20260929_182350_097b0482e61f.json` 唯一一步 `测试设备1 BLE config write/readback` 为 FAIL，`reason=web_ble_config_error`、`stderr=Error: 测试设备 未完成浏览器 GATT 连接。`；任务卡片标题显示英文 `Config write · 18:23:12`。
- 根因一（真实故障）：`gattserverdisconnected` 回调会 `browserBleTransports.delete(role)` 并清空 `state.connectedBleDeviceIds[role]`，而 `ensureBleTransportConnected()` 在 transport 缺失时直接抛「未完成浏览器 GATT 连接。」→ **设备在配置写入过程中断开（Meshtastic 应用 lora/device 等配置会重启 BLE）时，平台既不自动重连，又把「可恢复的断线」误报成「从未连接」**，读回永远拿不到，配置是否生效也无法确认。
- 根因二（文案）：浏览器侧 BLE 结果用英文模块名 `Config write`（`moduleDisplayNames` 无映射、`publicCaseTitle` 直接回落到 module），`web_ble_*` 失败原因也没有中文标签，界面直接显示原始 reason 码。
- 修复（`tests\meshtastic_cli_dashboard\app.js`）：
  1. 记住设备句柄：新增 `browserBleLastDeviceIds`（role → device.id），`connectMeshtasticBleTransport` 成功时写入；断线回调保留该记录，并提示「任务会自动尝试重连」。
  2. `ensureBleTransportConnected(role, options)` 重写：transport 缺失时用记住的 device 重新 `gatt.connect()`，默认 8 次 × 2.5s（约 20s，覆盖设备重启窗口），成功提示「GATT 已重新连接」；彻底没有设备时提示「请先在设备列表里选择该设备并点击『连接 BLE』」；重连失败则说明「设备可能正在重启 BLE，请等它回到主界面后重新连接并点击『重新读取』」。
  3. 普通读写/前置检查/消息收发改用 `BLE_QUICK_RECONNECT_OPTIONS`（3 次 × 1.4s）快速失败，只有「配置写入后的读回」使用 20s 窗口，避免离线设备让界面白等。
  4. `executeBleConfigPlan` 把「写入后读回」拆开处理：重连或读回失败不再笼统报错，而是 `web_ble_config_readback_pending_after_reboot` + `failure_note`，明确「配置命令已发送但未核对」；读回成功但值不一致仍是 `web_ble_config_readback_mismatch`。
  5. 中文化：`moduleDisplayNames` 补 `Config write` / `BLE config write` / `BLE communication config` / `Web BLE precheck` 映射；`publicCaseTitle` 回落时走 `displayModuleName`；BLE 配置用例补 `source_l2_case='BLE 配置下发与读回校验'`（卡片标题）；suite/objective/stepName/抛错文案全部中文；`reasonLabels` 补 9 个 `web_ble_*` 标签，`friendlyReason` 增加两个专门分支（不再显示原始 reason 码）。
  6. 附带修复：BLE 步骤补 `index/total`（详情不再显示「步骤 - / -」）；报告 `started_at` 记录真实开始时间（此前等于结束时间）。
- 验证（`tmp\verify_ble_gatt_reconnect.js`，playwright-cli + 页面内注入假 GATT 设备，0 pageerror）：
  - 断线自动重连：`gattConnected=true`、ToRadio/FromRadio/FromNum 三个特征重建、状态提示「GATT 已重新连接」。
  - 端到端「写入 → 设备重启断线 → 自动重连 → 读回」：写入 1 次，读回 915，`PASS / web_ble_config_readback_match`。
  - 端到端「写入 → 断线 → 一直连不回来」：9 次连接尝试后 `FAIL / web_ble_config_readback_pending_after_reboot`，名称「BLE 配置已下发，读回待确认」，`readback=未取到（设备重启 BLE，重连未成功）`。
  - 无设备句柄：提示改为「请先在设备列表里选择该设备并点击『连接 BLE』」。
  - 任务卡片：标题「BLE 配置下发与读回校验」、副标题「配置写入 · 18:30:12」、原因全中文；无英文泄漏、详情里也没有原始 reason 码；步骤编号 1/1。
  - 回归：4 条用例、服务正常、停止按钮仍为红色填充、重新加载后 12 份报告正常渲染。
- 实机只读验证（`tmp\hw_probe_dtr_transport.py`，`--no-nodes --info`）：COM59 5.70s、COM62 5.66s，均为 `transport_variant=safe_no_reset_cli_dtr_asserted` 且无重试（DTR 记忆命中）——上一轮为写操作改用的传输选择在真机上一次直连成功。
- 待实机复测：浏览器 GATT 配置下发（需要人在 Chrome 设备选择框里点选设备）。建议写一个 lora/region 字段，观察「断开 → 自动重连 → 读回」是否走通。

## 2026-09-30 补充：BLE 配置「读回不一致」根因修复（整段合并写入）与真实 BLE 写入未生效的取证

日期同步：本快照头部「更新时间」由 `2026-09-07 17:05` 更新为 `2026-09-30`（10:08 → 11:02 → 12:29 → 14:06 → 15:06 → 16:12 → 15:56 → 16:28 → 17:25，§24 之后又追加了前端修复、BLE 设备名修复、配置表单中文化与 PSK 语义修复、PSK 密钥长度选择器与提示串台修复）；本节记录的是 09-30 当天的工作（09-29 各节保持原日期不动）。

### 11. 现象与用户报告

- 用户报告：BLE 模式下「写入后设备重启 GATT 能恢复重连，但读回配置好像没写入成功」。
- 对应报告 `logs\meshtastic_cli_webble_report_20260930_090613_eb5d83163248.json`：唯一一步 `测试设备1 BLE config write/readback` 为 FAIL，`reason=web_ble_config_readback_mismatch`，`expected=lora.region=US, lora.override_frequency=915`，`readback=lora.region=US, lora.override_frequency=-`。
- 同一报告里的设备快照 `device_snapshot.preferences.lora`：`{usePreset:true, region:US, hopLimit:3, txEnabled:true, modemPreset:LONG_FAST, overrideFrequency:0}`——即 `region` 写进去了，`override_frequency` 始终是 0。
- 读回串里 `-` 是**显示层缺陷**：`bleReadbackValue(value) || '-'` 把合法的 `0` 渲染成了 `-`，所以「读回是 0」和「字段没读到」在界面上无法区分，直接干扰了第一次判断（本节 §14 修掉）。

### 12. 根因一：浏览器侧 `set_config` 只发被改字段，与官方 CLI 语义不一致

- 官方 CLI `--set` 的语义（`.venv\Lib\site-packages\meshtastic\__main__.py:700-732`）：先 `node.requestConfig(...)` 把整段配置补齐，再 `setPref` 改单个字段，最后 `node.writeConfig(field)` —— **下发的是整段配置**。
- 浏览器原实现（`encodeBleAdminWrite`）只构造 `LoRaConfig{region, override_frequency}` 两个字段就当成 `set_config` 发出去；固件把 `set_config` 当**整段替换**处理，其余字段因此回到默认值。
- 真机串口取证（`tmp\hw_probe_merged_packet.py`，COM59，发的就是浏览器当时生成的那串字节）：
  - 部分字段包（40B）→ 设备读回 `use_preset=False, bandwidth=0, override_frequency=915.0`：**射频参数被清空**（危险写）。
  - 整段合并包（60B）→ 读回 `use_preset=True, bandwidth=250, spread_factor=11, coding_rate=5, tx_power=30, override_frequency=915.0`：原有字段全部保留。
  - 取证后用 `--set lora.override_frequency 0` 把设备恢复到原始状态。
- 顺带否证一个错误假设：`use_preset=true` 并不阻止 `override_frequency` 生效（真机 `--set lora.override_frequency 915` 读回 `915.0`）。所以修复方向是「写完整配置」，**不能**把判据放宽成「只要写入命令成功即算通过」。

### 13. 修复（`tests\meshtastic_cli_dashboard\app.js`）

1. `parseConfig` / `parseModuleConfig` 为每个子配置保留设备原始字节 `__raw`（`withRawBytes`）。
2. 新增 `protoFieldBytes`（wire 0/2/5 原样保留）、`mergeProtoMessage(original, replacements)`：按字段号丢弃被替换字段、其余字段原样重编码后追加新字段——整段合并是**无损**的。
3. 新增 `bleRawSubConfigBytes(role, section, key)` / `mergeBleSubConfig(role, section, key, replacements)`：从 `browserBleTransports.get(role)` 最后一次读取结果里取原始字节。
4. `encodeBleAdminWrite(plan, role)` 全量改为整段合并：`communication_lora`（region=7、use_preset+modem_preset=1/2、override_frequency=14）、`region`（7、14）、`modem_preset`（1、2）、`device_role`（Config.device）、`wifi`（Config.network）、`gps`（Config.position）、`bluetooth`（Config.bluetooth）、`mqtt`（ModuleConfig.mqtt）、`channel`（保留原 ChannelSettings 其余字段）；`user_name` 仍走 `set_owner`（NewOwner 本身是整段语义，无需合并）。返回 `{bytes, merged, expected}`。
5. `communicationConfigPlanFromControls()` 不再预生成部分字节；`expected` 改由编码器内部生成（此前依赖 `commExpected` 为空数组时会退化成「写入成功即通过」）。
6. `executeBleConfigPlan` 把写入放到「写入前读回」之后构造，拿到的就是最新 `__raw`；stdout 增加 `config_source=设备当前配置整段合并 | 仅目标字段（未取到完整配置） | 计划内置字节`；读回不一致时 `failure_note` 区分「整段合并写入后仍不一致」和「没取到完整配置、只写了目标字段，请先点『重新读取』」。

### 14. 附带修复：读回值 `0` 被显示成 `-`

- 新增 `bleReadbackDisplay(role, field)`：`0`/`false` 保留原值、布尔转 `ON/OFF`、真正缺失才显示 `-`；替换掉 `bleReadbackValue(...) || '-'` 的旧写法。这样 `lora.override_frequency=0` 会明确显示 `0`，与「未读到」区分。

### 15. 验证

- 字节级（`tmp\check_ble_merge_bytes.py`，用真实 `meshtastic.protobuf` 解浏览器生成的字节）：浏览器 `region` 包 == 「设备原始 LoRaConfig + override_frequency=915.0」，`与参考完全一致: True`，10 个设备字段全部保留；`presetMerged` 同样保留全部字段。
- 浏览器端（`tmp\verify_ble_merge.js`，playwright-cli，0 pageerror）：
  - `parseConfig.__raw` 往返一致；合并包字段号 `[1,3,4,5,8,9,10,13,106] + [7,14]`；`bleReadbackDisplay(0)='0'`。
  - 端到端修复路径 → PASS，`readback=lora.region=US, lora.override_frequency=915`，`config_source=设备当前配置整段合并`。
  - 用修复前的部分字节路径故意复现 → FAIL `web_ble_config_readback_mismatch`、`readback=lora.override_frequency=0`，并提示只写了部分字段（与 09:04 报告现象一致）。
  - 回归：4 条用例、卡片标题/原因全中文、停止按钮仍为红色填充、重新加载后报告正常渲染、0 pageerror。
- 真机串口：见 §12（部分包破坏配置、整段包保留配置）。

### 16. 真实 BLE 通道取证：写入「成功」但设备未生效（当时未定位，结论见 §17）

- 复现脚本 `tmp\hw_probe_ble_packet_apply.py`（bleak，设备 `Meshtastic_1c62`，全程只走 BLE：BLE 读原始配置 → 写部分包 → 重连读回 → 写整段合并包 → 重连读回 → 恢复）：两种包的 `write_gatt_char(TO_RADIO, ..., response=True)` **都没有抛异常**，但设备重启窗口之后读回**完全没变**（`use_preset=true, region=US, override_frequency=0`）。即：客户端认为写入成功，设备侧没有应用。
- 链路参数探测 `tmp\hw_probe_ble_mtu.py`：该链路协商 **MTU=23**（ToRadio 只有 `write` 属性、FromRadio 只有 `read`、FromNum 是 notify），而固件请求的是 517（`src\nimble\NimbleBluetooth.cpp:34 kPreferredBleMtu = 517`）。任何管理包（≥30 字节）都超过单次 ATT 写入容量，必然走长写（Prepare Write + Execute Write）。
- 固件侧已核对：`PhoneAPI::handleToRadio` 对 `meshtastic_ToRadio_packet_tag` 没有「握手进行中」的丢弃分支；`MESHTASTIC_PHONEAPI_ACCESS_CONTROL` 的锁定门是 nRF52 专属（本机 ESP32-S3 未编译）；`want_config_id` 的 `handleStartConfig()` 即使已连接也会重启打包状态机（`PhoneAPI.cpp:304`）。所以「设备没生效」不能用手册里的锁定/授权语义解释。
- 结论（截至本节，**已被 §17 推翻并给出真根因**）：当时以为「(a) 部分字段写入会破坏配置、(b) 真实 BLE 通道上管理包写入没有被设备应用」是两层问题；后续用 bleak 补测证明 BLE 写入通路本身完全正常，真正的原因是 §17 的管理包收件地址。
- 诚实边界：整段合并修复已在**真机串口**与**字节级**验证；浏览器/蓝牙链路的端到端通过尚未拿到。

### 17. 根因确认：管理包发给了广播地址，设备只处理「发给本机」的管理包

- 先排除「写不通」这个方向：`tmp\hw_probe_ble_write_accept.py`（先排空连接自动下发，再用不同长度的 `ToRadio{want_config_id}` 探针）→ 长度 **5/20/30/56 字节全部被设备处理**（每个都收到 `config_complete_id == 本次 nonce`）。即 MTU=23 下的长写（Prepare/Execute）没问题，控制类写入完全正常。
- 真根因（真机 A/B，`tmp\hw_probe_ble_admin_addressing.py`，只改 `to` 一个变量，值取互不相同的非零值避免 protobuf 默认值省略干扰）：
  - `to = !361e1c62`（设备自己的 node num）+ 整段合并配置 → **生效**（916 在 27.9s 后读回、919 在 26.5s 后读回、写 0 恢复也在 26.8s 后读回）。
  - `to = 0xffffffff`（广播）+ 同样的整段合并配置 → **不生效**（917、918 都读回旧值，110s 内不变）。
  - 交换顺序重跑（先广播 918、再定向 919、再定向 0）结论一致：广播必失败、定向必成功。
- 代码侧对得上：`createAdminSetConfigToRadio` / `createAdminSetModuleConfigToRadio` / `createAdminSetChannelToRadio` / `createAdminSetOwnerToRadio` 都**没有**传 `destNodeId`，而 `nodeIdToNum('')` 会回落到 `BROADCAST_NUM`（`app.js:1673`）→ 浏览器所有配置写入都是广播地址；同一文件里管理**读**（`requestBleConfig`，`app.js:2773`）传了 `transport.myInfo.node_id`，所以「读得到、写不进去」。
- 参考实现对照：官方 CLI `--set` 走 `mesh_interface.py:982-1009`，`meshPacket.to = nodeNum`（目标是本机 node num），从不用广播。
- 固件机制（`src\mesh\MeshService.cpp:289-347` + `src\mesh\Router.cpp:421-468`）：手机写入的包由 `MeshService::handleToRadio` 交给 `Router::sendLocal`，只有 `isToUs(p)`（`p->to == nodeDB->getNodeNum()`）才走 `deliverLocal()` 交给 AdminModule；广播地址的本地投递路径在真机上不会让配置生效（A/B 已证实）。广播地址在这条链路上属于「推断」而非逐行确证，但客户端的正确写法只有一种：定向到本机 node num。
- 因此 09:30 09:04 报告的失败解释为：**配置写入发去了广播地址 → 设备不处理 → 读回当然还是旧值**（`override_frequency=0`，被 `|| '-'` 显示成 `-`）。部分字段包（§12）是一个真实但独立的缺陷，会破坏配置，本轮一并修掉。

### 18. 本轮修复（`tests\meshtastic_cli_dashboard\app.js`）

1. 新增 `bleAdminDestination(role)`：取 `browserBleTransports.get(role)?.myInfo?.node_id`（回落 `state.deviceNodeIds[role]`、单设备连接），所有管理写包都带上它。
2. `createAdminSetConfigToRadio` / `createAdminSetModuleConfigToRadio` / `createAdminSetChannelToRadio` / `createAdminSetOwnerToRadio` 增加 `destNodeId` 参数；`encodeBleAdminWrite` 的 9 个写入分支（region / communication_lora / modem_preset / device_role / wifi / gps / bluetooth / mqtt / channel / user_name）全部改为定向发送。
3. 拿不到设备身份时**明确抛错**（中文说明「固件只处理发给本机的管理包」），不再静默退回广播。
4. 读回稳健性：`requestBleConfig` 每轮用新的随机 nonce（`randomBleConfigNonce()`）——此前固定 nonce 时，设备队列里上一轮的 `config_complete_id` 会立刻满足「等待配置完成」，读回可能停在旧值上；`executeBleConfigPlan` 的写入后读回改为最多 3 次重试（真机配置写入后设备约 27s 才回到可读状态，一次失败不再直接判死）。
5. 证据可读性：报告 stdout 增加 `dest=` 与 `readback_attempts=`；三类 `failure_note` 文案同步更新（提到「没有定向到本机 node num 的写入会被设备忽略」）。

### 19. 修复验证

- 浏览器端（`tmp\verify_ble_admin_dest.js`，playwright-cli，0 pageerror）：
  - 编码层：region / communication_lora / modem_preset / device_role / mqtt / user_name 六种写包的 `to` 全部为 `907943010`（`!361e1c62`），不再是广播；没有身份时抛错且 `to` 为 `null`（不回落广播）；随机 nonce 三次取值互不相同。
  - 端到端（设备侧模型 = 只处理发给本机的管理包 + 整段替换）：修复后 PASS，`readback=lora.region=US, lora.override_frequency=915`、`dest=!361e1c62`、`config_source=设备当前配置整段合并`；把写入换回「预生成字节 + 广播地址」→ FAIL `web_ble_config_readback_mismatch`、`readback=lora.override_frequency=0`，**完整复刻用户 09:04 的报告现象**。
  - 回归：4 条用例、卡片名「配置写入」、原因全中文、停止按钮仍为红色填充（`rgb(180, 61, 58)`）。
- 原有合并用例（`tmp\verify_ble_merge.js`）在新身份要求下重跑仍全绿：`regionMerged=true`、字段号 `[1,3,4,5,8,9,10,13,106,7,14]`、设备字段全保留、读回 915、PASS；部分字段路径仍复现 FAIL。
- 真机侧：A/B 结束后设备 `Meshtastic_1c62` 已恢复到原始状态 `use_preset=true, bandwidth=250, spread_factor=11, region=US, override_frequency=0`（我探针写进去的 915/916/919 都已清掉）。

### 20. 下一步（阻塞点：设备串口全部离线）

- 当前 `serial.tools.list_ports` 为空（COM59/COM62 都不在了），`Meshtastic_3354` 已停止广播；本轮全部真机取证都在 `Meshtastic_1c62` 上通过 BLE 完成。
- 需要人做的一次端到端复测：硬刷新 `http://127.0.0.1:8765/` → 连接 BLE → 运行「配置写入」用例，预期卡片 PASS、`dest=` 显示本机 node id、读回值与目标一致；设备写入后会重启，约 27s 后才读回得到新值（界面已按 3 次重试等待）。
- 串口恢复后另需复测：DTR 记忆、联系人导入、串口配置写入（这些路径本轮未改动）；如需设备自证，可先用 `--set security.debug_log_api_enabled true` 打开 BLE 日志通道（`log_to_ble` 只在 `config.security.debug_log_api_enabled` 为真时输出，见 `src\RedirectablePrint.cpp:232`），再订阅 LOGRADIO（`5a3d6e49-06e6-4423-9944-e9de8cdf9547`）看设备自己的 admin 处理日志。

## 2026-09-30 补充：三条前端问题修复（进度面板终态、断开按钮红色填充、私聊不能被写成频道）

### 21. 现象

1. 任务已经跑完并且 PASS，进度面板却仍停在 `1 / 1` +「任务已提交，等待第一条进度」/「正在执行 Web BLE 操作」。
2. 「断开串口」「断开 BLE」是浅灰次要按钮，与「停止运行」的红色填充风格不一致。
3. BLE 持续接收里，别的设备节点**私聊**发给测试设备的文本被记成频道消息：`[10:47:36] RX 频道 0: Bye`。

### 22. 根因

1. **进度面板没有终态收尾。** `renderProgress` 只按当前事件渲染；`finishRun` / 取消 / 异常分支只调 `setRunning(false)`，**不重绘**面板，于是面板停在最后一条"进行中"事件上。而收尾渲染里 `current` 往往只有 `event`（如 `web_ble_end`）没有 `step`，`state.running` 又还没落到 false，就落到两个进行中兜底文案上（`app.js` 原 3298-3317）。设备互发/通信类流程的收尾事件 `{event:'web_ble_end', status:'PASS'}` 带 `events: []`，所以列表也只剩兜底文案——正是用户截图里的 `1 / 1` + 两行进行中文案。
2. **按钮配色不在同一个类里。** 只有 `.secondary.stop` 是红色填充 + 悬停加深（`styles.css` 850-866），三个断开按钮用的是 `.secondary.quiet`（浅灰底 + 灰字）。
3. **RX 分类只看 channel。** `pollBleContinuousReceive` 之前无条件写 `频道 ${item.channel}`（原 2943 行）。Meshtastic 私聊包 `to` = 目标 node num（`channel` 仍是 0），广播包 `to = 0xffffffff`；只看 channel 必然把私聊写成「频道 0」。

### 23. 修复

- `app.js`
  - `renderProgress` 增加终态语义：`summary.finished` / `current.event === 'run_end'` 时标题固定为 `任务结束: <状态>`，兜底文案不再出现"等待第一条进度 / 正在执行"；终态下悬空的 `RUNNING` 步骤改为 `已停止`（取消）或 `跳过`，不留"运行中"。
  - 新增 `renderRunFinished(status)` 作为统一收尾入口；`setRunning(false)` 会在最后一次进度快照上自动补一次终态渲染；`finishRun`（含取消、异常、后台不可见分支）用真实结论覆盖一次。`recoverStaleClientRun` 调整为"先放开运行态再重置面板"。
  - 新增 `lastProgressSummary` 保存最近一次进度快照（终态渲染的数据来源）。
  - 新增 `bleReceivedTextLabel(transport, item)` / `bleTransportNodeNum` / `bleNodeDisplayName`：`to` 是广播（或缺失）→ `频道 N`；`to == 本机 node num` → `私聊 来自 <短名> (!nodeid)`；`to` 是别的节点 → `私聊（转发，发往 !xxxx）来自 ...`；私聊包 `pki_encrypted` 且正文为空时补一句「PKI 加密的私聊，浏览器侧无法解密」，不再显示成空消息。
- `styles.css`：破坏性按钮样式从 `.secondary.stop` 扩到 `.secondary.stop, .secondary.danger`（含 `:hover` / `:focus-visible`）。
- `index.html`：三个断开按钮加 `danger` 类（`断开串口`、两个 `断开 BLE`）。

### 24. 验证（`tmp\verify_ui_fixes.js`，playwright-cli，0 pageerror）

- 进度面板：设备互发流程收尾后 → `任务结束: 通过` + `任务结束: 通过，本次没有步骤明细`；配置下发流程收尾后 → `任务结束: 通过` 且保留步骤明细行；取消 → `任务结束: 已停止` 且悬空步骤显示 `已停止`；空闲 → `未运行 / 运行后显示步骤`。进行中（真在跑）仍显示"正在执行 Web BLE 操作"，这是用户截图里复现出来的原现象，属于运行期正常文案。
- 按钮：`#disconnectSerial`、`#disconnectBlePrimary`（以及源码里的 `#disconnectBlePeer`）与 `#stopRun`/`#stopBleContinuous` 完全一致 —— 底 `rgb(180, 61, 58)`、字 `rgb(255, 255, 255)`、边框同色；悬停后 `rgb(140, 43, 40)`（`--red-dark`），与停止按钮同色。CSS 规则确认为 `.secondary.stop:not(:disabled):hover, .secondary.danger:not(:disabled):hover`。
- RX 分类：`to=本机` → `[11:01:01] RX 私聊 来自 AB12 (!12345678): Bye`；`to=0xffffffff` → `RX 频道 0: hello all`；`to=其他节点` → `私聊（转发，发往 !0a0b0c0d）…`；无 `to` → 频道；PKI 加密空正文 → 明确的无法解密提示。
- 顺带确认一个既有事实：单设备 BLE 布局（`WEB_BLE_SINGLE_DEVICE_ONLY`）下 `ensureSingleBleLayout()` 会把「测试设备 2」整张卡片 `remove()`（`app.js:3779-3780`），所以运行时只有**一个**「断开 BLE」按钮可见，另一个只存在于源码中（本轮同样给它加了红色样式，不影响布局）。

### 25. 修复：连接后「测试设备 BLE」名字变成 `9jiwGdHLNHGTcpL0ALghrQ==` 这类乱码

- 现象：扫描列表里的设备名正常，点「连接 BLE」之后输入框与状态行变成 `已连接：9jiwGdHLNHGTcpL0ALghrQ==`。
- 根因：`connectBleInBrowser` 用 `const selectedName = selected.name || selected.id` 取名（`app.js` 3126 行附近）。Web Bluetooth 的 `BluetoothDevice.name` **只在设备处于广播/可发现状态时可用**，离开广播后可能变回 `null`；此时回退到的 `BluetoothDevice.id` 并不是 MAC，而是浏览器随机生成的 128 位 base64 串（`9jiwGdHLNHGTcpL0ALghrQ==` 解出来正好 16 字节）。同一处名字还会被 `assignBleTarget` 写进输入框，并出现在状态行、断线提示、"重新读取"完成提示、`targetConnectionValue` 里。
- 是否本轮改动引入：**不是**。该行属于本轮新做的 Web BLE 功能（`git diff HEAD` 显示整个 BLE 通道是新增代码，`+` 号行），本轮此前只改了管理包收件地址、整段合并、读回重试与进度面板/按钮/RX 分类，没有碰取名逻辑。但它是真实缺陷，已修。
- 修复：新增 `browserBleDeviceNames`（device.id → 扫描时记住的名字）与统一入口 `bleDeviceDisplayName(device, role, fallback)`，优先级 `当前 device.name → 扫描时记住的名字 → 设备列表里的名字 → fallback`，**任何情况下都不再用 `device.id` 当显示名**；`scanBleDevices` 在拿到设备时调用 `rememberBleDeviceName`。替换了 5 处显示点：扫描写输入框、连接后状态行、断线提示、`重新读取`完成提示、`targetConnectionValue`（其 fallback 改为输入框里的名字或角色名，而不是设备 id）。
- 验证（`tmp\verify_ble_name.js`，0 pageerror）：模拟 `device.name` 在扫描后被 Chrome 置空 → 输入框与状态行仍为 `Meshtastic_1c62`（旧代码此处会写 `9jiw…==`）；`targetConnectionValue('primary')` 返回 `Meshtastic_1c62`；未知设备回落 `Meshtastic BLE` 而不是 id；设备实时有名字时以实时名字为准（`Renamed_Device` 胜出）。

### 26. BLE 通道还能覆盖哪些自动化测试（评估与优先级）

现状：BLE 侧只有「持续收发」和「配置写入」，且配置写入只覆盖 region / modem_preset / device_role / wifi / gps / bluetooth / mqtt / channel / owner 的部分字段。

P0（设备与协议都现成，收益最高）
1. **配置矩阵**：`Config` 六段（device/position/network/lora/bluetooth/security）+ `ModuleConfig` 各段逐段做「读→改→写→重启→读回」，输出一张字段级通过表；报告已支持多步骤，只差把 `executeBleConfigPlan` 的 kind 表补全。
2. **边界与非法值（当前完全没有负向用例）**：`hop_limit` 0/7/8、`tx_power` 越界、`region` 非法枚举、`override_frequency` 0/负/超范围、`channel_num` 越界 → 断言固件拒绝或钳制且不崩、不写坏其它字段。
3. **ACK / 重传**：`want_ack=true` 后必须等到 `ROUTING_APP` 应答并核对 `request_id`；统计丢包率与重试次数（现在发完就结束，没有 ACK 维度的判定）。
4. **频道与 PSK**：`set_channel`/`get_channel` 全 index、改名、PSK 长度 0/1/16/32/64 与非法长度、index 0 主频道约束、写完能否用新 PSK 收发。
5. **Admin 鉴权**：无 `session_passkey` 的 `set_config` 必须被拒（`ADMIN_BAD_SESSION_KEY`）；设置后旧 key 失效/新 key 生效；`is_managed` 下的本地 admin 拒绝路径。
6. **ToRadio 去重回归**：同字节 ToRadio 连发两次，固件会丢第二次（`Drop duplicate ToRadio packet`）→ 断言"重发必须换 packet id"，防止我们自己的重试逻辑踩这个坑（本轮排查时实测过这条固件行为）。
7. **设备侧日志自证**：`security.debug_log_api_enabled=true` + 订阅 LOGRADIO，把设备自己的 admin/丢弃日志落进报告（目前报告只有浏览器侧证据）。

P1（需要更多设备/时间，但能覆盖真实风险）
8. **持久化与重启**：写配置→重启→再断电重启后读回仍在（区分"内存生效"与"落盘"）；`reboot_seconds` 时序、`factory_reset_device`/`nodedb_reset`（危险项放显式开关）。
9. **双通道一致性**：同一配置用 BLE 与官方 CLI（串口）分别读回并做字节级比对，同时验证我们的编码器与固件。
10. **长连接稳定性**：连续读写 30~60 分钟/上千包，统计 GATT 断线次数与自动重连成功率（重连逻辑已在，缺长时间观测）。
11. **性能基线**：写入→生效延迟（实测约 27s）、完整配置读取耗时、协商 MTU（实测 23）、长写分块稳定性 → 设阈值做回归对比。
12. **FromRadio 规模与丢包**：NodeDB 大量节点（>100）时 dump 完整性与耗时；连续读取丢包计数（现在只统计失败次数）。
13. **文本边界**：空串/1 字节/常见上限/UTF-8 多字节与 emoji/超长包拒绝；私聊与广播、转发私聊、"无法解密的 PKI 私聊"的分类断言（§23 刚修的分类逻辑）。
14. **GATT 属性与配对模式**：FIXED_PIN（ToRadio 需鉴权、FromRadio 只读不可 notify）与 NO_PIN 的属性差异、PIN 错误路径（`hw_probe_ble_mtu.py` 已能读属性，做成用例即可）。

P2（需要多台设备或专用环境）
15. **多跳与中继**：hop_start/hop_limit 递减、中继路径可达性。
16. **重启期竞态**：设备正在重启时发起写入/读取，客户端必须给出明确结论而不是假 PASS。
17. **CI 化建议**：把 `tmp\hw_probe_*.py`（bleak）整理成无浏览器的设备侧 pytest 套件跑回归；浏览器只保留 UI 级端到端（首次连接仍需人点一次设备选择框）。

### 27. 修复：配置表单中文化 + 频道 PSK 语义与校验（含读回断言补齐）

- 用户反馈：`Channel Index`、`Channel Name` 要显示中文；PSK 填 `123` 报错 `ERR 频道 PSK 仅支持 default、none、0x... 或 base64:...`，需要解释四种写法的含义。
- 表单中文化：`频道索引` / `频道名称` / `频道 PSK`（另有 `用户名称` / `区域` / `调制预设` / `设备角色` / `WiFi` / `GPS 开关` / `蓝牙开关` / `设备语言`、`区域（Region）` / `频率覆盖（MHz）` / `长名称（Long Name）` / `短名称（Short Name）` / `WiFi 名称（SSID）` / `WiFi 密码`、MeshCore 的 `射频预设` / `自定义频率（MHz）`），`index.html` 里的静态 option 文本与实验面板复选框同步改成中文；`fieldLabels` 显示名也改中文。新增 `.field-hint` 样式（`styles.css`）承载 PSK 说明行，随 `.config-grid .wide` 占满整行。
- PSK 语义（与固件/官方 CLI 一致）：`default` = 设备默认密钥（1 字节 `0x01`）；`none` = 清空 PSK（该频道不加密）；`0x..` = 十六进制密钥字节（长度必须偶数）；`base64:..` = base64 密钥字节（`base64:AQ==` 等于 `default`）；**留空 = 不修改**该频道 PSK。标准长度为 0 / 1 / 16（AES128）/ 32（AES256），其它长度放行但在 `notes=` 里标注风险。`123` 被拒是因为 PSK 是原始密钥字节而不是密码，短数字无法判断含义。
- `parseChannelPsk` 取代 `encodeChannelPsk`（保留同名兼容包装）：非法写法（`123`、`0x1` 奇数长度、`0xZZ`、`base64:@@@@`、`random`）一律抛出中文错误并给出四种正确写法。**旧实现非法输入返回 `null`，调用方 `|| new Uint8Array()` 会静默写成空 PSK（等于偷偷关掉该频道加密）——这是本轮顺带修掉的隐患。**
- 证据补齐：频道写入步骤的 stdout 增加 `notes=频道索引=…; 频道名称=…; PSK=…`（含非标准长度警告）。
- 读回断言补齐：新增 `channel.N.psk` 读回（`state.channelPsks` 存十六进制、`applyBleInfoToState` 采集）。此前"只改 PSK"时 `expected` 为空 → 步骤自动 PASS（写了不生效也判通过）；现在会真的比对，不一致判 `web_ble_config_readback_mismatch` FAIL；读回里压根没有该字段时改用专用说明"写入包已发出，但重新读取的结果里没有这些字段……本次无法确认是否生效"。
- 新增 `bleReadbackKnown`：只有真的从设备读到过该字段，才允许走「当前配置已与目标一致，未重复写入」（`web_ble_config_already_applied`）的跳过路径；否则"没读到"会被当成"值就是空"，PSK 填 `none` 会被误判成无需写入。
- 验证（`tmp\verify_channel_psk.js`，0 pageerror）：表单标签 `["频道索引","频道名称","频道 PSK"]` + 说明行占满整行；11 组 PSK 输入矩阵（合法 6 组字节正确、非法 5 组给出中文原因）；写入包解码确认 —— 留空时 PSK 保留设备原值 `01` 只改名称、`none` 时 psk 字段长度 0、`base64:AQ==` 写 `01`；端到端三条路径 —— 写后读回为空 → PASS（`readback=channel.0.psk=-`）、写后设备仍回报旧密钥 `01` → FAIL、从未读到过 PSK → 不再跳过写入。
- 回归：`tmp\verify_ble_admin_dest.js`、`tmp\verify_ble_merge.js`、`tmp\verify_ui_fixes.js`、`tmp\verify_ble_name.js` 四个套件全部重跑通过。
- 待办：真机 PSK 读回只读探测脚本已就绪（`tmp\hw_probe_ble_channel_read.py`），但当时 `Meshtastic_1c62` 不在广播（15s 扫描无该设备），未取到真机样本；设备上线后跑一次确认配置 dump 是否回报 `ChannelSettings.psk`、空 PSK 是缺省还是空字节串。

### 28. 四条前端问题：预设标签、PSK 密钥长度选择器、任务提示串到「持续收发」卡片并卡住

- 需求：1) `调制预设` 改成 `预设`；2) 评估配置矩阵是否显著拉长运行时间；3) PSK 改成"密钥长度选项 + 随机生成 + 可手动编辑"，去掉小字提示；4) 运行非持续收发卡片时，持续收发卡片也显示任务过程，且任务通过后一直卡在「正在准备 BLE 前置检查...」。

1. 标签：`调制预设` → `预设`（配置项下拉 label、`fieldLabels['lora.modem_preset']`、`index.html` 静态 option、通信实验面板勾选标签 `Modem Preset` → `预设`、缓存配置行显示名、以及"不支持的预设"报错文案）。
2. 耗时评估（实测口径）：脚本 `tmp\count_config_fields.py` 数出 `Config` 10 段 107 字段 + `ModuleConfig` 16 段 117 字段 = **26 段 / 224 字段**；当前页面只覆盖约 38 个字段（`runner.py` 的 `DISPLAY_NAMES`）。每次字段级写入 = 读回(~5s) + 写入 + 等待 + 设备重启 BLE(实测 ~27s) + 读回重试 ≈ **30-45s**。因此：全量字段级 ≈ **2 小时**；按"每段一次合并写入、一次读回核对整段"分组 ≈ **17 分钟**（失败才对那段做字段级二分）；冒烟档（lora/device/bluetooth/network/channel/owner）≈ **4 分钟**。结论：**耗时由"写入次数（即设备重启次数）"决定，而不是字段数**，所以主要优化手段是分组写入，而不是砍字段。
3. PSK 选择器（与 App 端逻辑对齐）：新增 `CHANNEL_PSK_MODES` 与 `#configChannelPskMode`（`不改动（保持当前密钥）` / `空（不加密）` / `默认（AQ==）` / `1 byte` / `128 bit` / `256 bit`），密钥输入框 `#configChannelPsk` 保留可手动编辑，右侧新增骰子图标按钮 `#randomChannelPsk`（`.psk-random`，CSS mask 画图标）。选长度时自动生成对应长度的随机密钥（`crypto.getRandomValues` + base64），点骰子重新生成；`default` 回填展示 `AQ==`；粘贴 `0x...` 或 `base64:...` 会规范成裸 base64。新增长度校验（`channelPskFormValue`）：密钥字节数必须与所选长度一致，否则内联红字报错（`.field-error` + `.invalid` 边框）并阻止运行 —— 校验失败不抛异常中断，而是挂到 `plan.pskError` 由 `validateBeforeRun` 拦下并提示。原小字提示条（`.field-hint`）按要求删除（样式保留备用）。
4. 任务提示串台 / 卡死根因：`showBleActionFeedback()` 在 BLE 模式下会把消息 **push 进持续收发日志** 并 **覆盖持续收发卡片头部说明**；任务结束后没有任何复位，于是「正在准备 BLE 前置检查...」永久留在卡片上。修复：任务级提示改为写命令证据区 + 新增的 `#runNotice`（执行结果面板内，`.run-notice`，任务结束由 `renderRunFinished` 清空，`setRunning(true)` 也会清）；持续收发自己的提示走新的 `showBleContinuousFeedback()`（三处启动错误改用它）才进持续收发日志与卡片头部；`renderRunFinished` 额外调用 `updateBleContinuousRoute()` 把卡片头部复位。
- 验证（`tmp\verify_psk_selector.js`，0 pageerror）：标签 `预设`（下拉/字段/缓存行）；选择器 6 档状态与写入值（`keep`→空、`none`→`none`、`default`→`default`+显示 `AQ==`、`1b/16b/32b`→1/16/32 字节随机密钥且可编辑）；长度不一致 → 内联报错 + `plan.pskError` 阻止运行；粘贴 `0xab…`(16B) → 规范化成 base64 且长度匹配；骰子按钮每次生成不同密钥；`128 bit` 写入计划 `expected=channel.0.psk=6f63…`（32 位十六进制 = 16 字节）。
- 验证（第 4 条）：任务提示出现时 `#runNotice` 可见，而持续收发卡片的头部说明与日志**完全不变**（`records=0`）；`renderRunFinished('PASS')` 后 `#runNotice` 清空、卡片头部复位；持续收发自己的错误提示仍正常进日志。
- 回归：`verify_channel_psk.js`、`verify_psk_selector.js`、`verify_ble_admin_dest.js`、`verify_ble_merge.js`、`verify_ui_fixes.js`、`verify_ble_name.js` 六个套件全部通过、0 pageerror。

### 29. 界面精简 + 时区配置（device.tzdef）+ 设备角色验证方案

- 需求：1) 去掉一批小字提示；2) 配置项是否支持时区；3) 设备角色（client / client mute / tracker / lost and found）能否自动化验证、串口还是蓝牙更合适。
1. 界面精简（按要求逐条删除，`tmp\verify_ui_trim_tz.js` 断言 7 条文案全部不再出现）：「先连接设备，再检查配置，最后执行配置写入或通信验证。」「选择连接方式并分配测试设备；串口和蓝牙连接只显示对应连接项。」「查看本机保存的测试报告，打开详情或下载 JSON。」「报告默认保存在项目 logs 目录。」「扫描串口并查看指定串口日志。」以及持续收发卡片头部的「当前会发给频道；目标节点为空时不会走点对点私信。」；同时移除 `#caseCount`（"N 条用例"）与 `#bleContinuousHint` 两个元素，`updateBleContinuousRoute()` 退化为只维护「发送目标」一行，持续收发的提示统一只进日志区。
2. 时区：**支持**。`Config.DeviceConfig` 字段 11 = `tzdef`（string，POSIX TZ，例如中国 `CST-8`；带夏令时用 `PST8PDT,M3.2.0,M11.1.0` 形式）。本轮把它接进控制台：新增配置项「时区」（`type: 'field_text'`）、`fieldLabels['device.tzdef']`、`parseDeviceConfig` 解析字段 11、`state.deviceConfigs['device.tzdef']`、BLE 写入分支（`set_config` → Config.device → DeviceConfig 11，`expected=[['device.tzdef', 值]]`，备注 `时区=…`）、串口侧 `runner.py` 的 `DISPLAY_NAMES` 增加 `device.tzdef`（串口走通用 `--set device.tzdef=<值>` + 读回）。验证：选项存在、payload `{tzdef:'CST-8'}`、报文第 11 字段字节 = `CST-8`、读回匹配 `true`。
3. 角色验证（结论见 §30 详表）：`AdminModule.cpp:915` 在收到 `set_config(device.role)` 后立刻调用 `NodeDB::installRoleDefaults()`（`NodeDB.cpp:1668`），会给角色**连带改写**其它配置并在重启后生效 —— 这就是"切了角色不知道怎么验证"的关键：要验证「角色值 + 连带配置 + 行为」三样，而不只是 role 字段。当前控制台角色下拉为全部 13 个角色（`DEVICE_ROLE_VALUES`），本轮未收敛到 4 个；`device_role` 写入已具备 `device.role` 读回断言。

### 30. 设备角色自动化验证设计（client / client mute / tracker / lost and found）

固件依据（本地源码 checkout `tmp\meshtastic-firmware-src`）：
- `NodeDB::installRoleDefaults` 只有 ROUTER / ROUTER_LATE / SENSOR / LOST_AND_FOUND / TAK / TRACKER / TAK_TRACKER / CLIENT_HIDDEN 分支；**CLIENT 与 CLIENT_MUTE 没有分支**（不改其它配置）。
- LOST_AND_FOUND：`position_broadcast_smart_enabled=false`、`position_broadcast_secs=300`（每 5 分钟）；位置包另受 traffic mgmt 下限 15 分钟（`Default.h:53`、`TrafficManagementModule.cpp:1379`）。
- TRACKER：`owner.is_unmessagable=true`（不可私聊）、`telemetry.device_update_interval` 设为默认广播间隔；位置/遥测优先发送（`Default.cpp:48`）；跳过开机旋律（`main.cpp:1179`）、不做省电转换（`PowerFSM.cpp:442`）。
- CLIENT_MUTE：不转发 —— `FloodingRouter.cpp:156` `role != CLIENT_MUTE && …`、`NextHopRouter.cpp:301` 日志 `No rebroadcast: Role = CLIENT_MUTE or Rebroadcast Mode = NONE`。
可自动化断言（分档）：
- T1（单设备，串口或蓝牙都行，最便宜、优先做）：写角色 → 重启 → 读回 `device.role`；再读回角色连带配置（LOST_AND_FOUND 断言 `position.position_broadcast_secs=300` 且 smart=false；TRACKER 断言 `user.is_unmessagable=true`）；再用第二台设备的 NodeDB 交叉核对 `user.role`。
- T2（两台，默认频道监听）：LOST_AND_FOUND 的周期位置上报节奏（≥15 分钟一个包，第一次在 5 分钟后）。
- T3（三台 + 可控射频）：CLIENT vs CLIENT_MUTE 的转发差异（A→B(待测)→C，A 与 C 互不可闻）。
- T4（两台 + 固定位置）：TRACKER 位置/遥测优先级与频率。
方案选择：**主力串口**（一条 `--set device.role` 即可、COM 口可同时连多台、角色行为日志在串口 console 最全且 BLE 需先开 `security.debug_log_api_enabled` 才能拿 LOGRADIO、不依赖人工点选设备框可 CI）；**蓝牙做补充**（手机 App 视角、单设备即可完成的 LOST_AND_FOUND 周期位置消息）。
- 附带发现：CLIENT/CLIENT_MUTE 无 `installRoleDefaults` 分支 ⇒ 从 LOST_AND_FOUND 切回 CLIENT **不会**把 `position_broadcast_secs` 从 300 还原（角色切换不幂等），这本身就是一条值得固化的回归用例。
- 待办：设备在线后按 T1 落地（把 4 个角色 × 读回 + 连带配置断言做成一条用例，串口为主、BLE 补一条）。

### 31. 频道显示修复 + 时区下拉 + 三设备能力/角色用例设计

1. **频道显示修复**（用户报「频道 0 · - · PRIMARY · PSK -」，而执行结果详情里 `channels=0:LongFast, 1:Seeed, 2:seeed` 是对的）：根因是 `renderDeviceSnapshots()` 读的是 `channel.name` / `channel.psk`，而频道对象来自 `parseChannel()`，名称与密钥在 `channel.settings.name`（`ChannelSettings` 字段 3）与 `channel.settings.psk`（字段 2，base64）里 —— 详情行用的是 `channel.settings?.name` 所以正确。修复为：`频道 {index}：{name} · {role} · PSK {psk}`，名称缺失回退 `-`；PSK 用 `channelPskHexFromSettings()` 输出实际十六进制（>8 字节显示前 16 位 + 字节数），空密钥显示「空（不加密）」、未读取/禁用频道显示 `-`。验证输出：`频道 0：LongFast · PRIMARY · PSK 01` / `频道 3：- · DISABLED · PSK -` / `频道 5：NoKey · SECONDARY · PSK 空（不加密）`。
2. **时区下拉**：新增 `TZ_ZONES`（33 个常用时区，POSIX 字符串取自 `posix_tz_db/zones.csv`，覆盖中国（上海/香港/台北）、日韩、东南亚、印度、中东、欧洲、美国本土五档 + 阿拉斯加/夏威夷、加拿大、墨西哥、巴西、澳洲、新西兰、非洲），选项文案为 `中文名 · IANA 名（POSIX TZ）`，另加「自定义（手动填写 POSIX TZ）」。读回时自动匹配常用时区并预选，匹配不到则落到自定义并回填原值；自定义为空或含非法字符（空格等）会内联报错并阻止运行。验证：35 个选项含香港/纽约、预选 `HKT-8`、未知值回退自定义、空值/非法值被拦、合法值写入计划 `device.tzdef=EST5EDT,M3.2.0,M11.1.0`。
3. **三设备能力（代码事实）**：`runner.py` 目前只有两个目标 —— `--port`（测试设备1）与 `--peer-port|--peer-host|--peer-ble`（测试设备2），`target_names()` 只映射 `primary` / `peer` / `both`，并显式限制"只能有一种 peer 连接方式"。结论：**三台同时运行暂不支持**，第三台（监听/嗅探）需要新增 `--observer-port` 之类的第三目标并扩展 `target_names()` 与 `requires_peer` 一类的门控。物理上串口可以同时插三台（COM 口各自独立），但现有 runner 是「每个步骤各自打开/关闭端口」，所以"同时"只在需要**常驻监听**时才成为问题 —— 那种场景要把第三台做成常驻监听进程（可复用 DTR 安全的 pyserial 传输，或仪表盘「串口日志」）。
4. **角色验证用例设计**（串口为主，`L2-ROLE-001 设备角色矩阵验证`）：每个角色 5 步 —— 读当前 `device.role` → 写入角色 → 等设备重启 → 读回 `device.role` → 读该角色连带配置。断言：CLIENT = `device.role=CLIENT`（无连带改写）；CLIENT_MUTE = role 读回（无连带改写，可选日志断言 `No rebroadcast: Role = CLIENT_MUTE`）；TRACKER = role 读回 + `user.is_unmessagable=true`（CLI 写入 `--set-is-unmessagable`）+ `telemetry.device_update_interval`；LOST_AND_FOUND = role 读回 + `position.position_broadcast_secs=300` + `position.position_broadcast_smart_enabled=false`。另加一条回归断言：LOST_AND_FOUND → CLIENT 后 `position_broadcast_secs` 仍为 300（角色切换不幂等，固件里 CLIENT/CLIENT_MUTE 无 `installRoleDefaults` 分支）。CLI 字段写法已离线确认：`--set/--get <section>.<field>` 走 protobuf `DESCRIPTOR.fields_by_name` 通用解析，`device.tzdef`、`position.position_broadcast_secs`、`telemetry.device_update_interval` 均可直接读写。
- 回归：新增/更新的 `verify_channels_tz_select.js`、`verify_ui_trim_tz.js`、`verify_psk_selector.js`、`verify_channel_psk.js`、`verify_ble_admin_dest.js`、`verify_ble_merge.js`、`verify_ui_fixes.js`、`verify_ble_name.js` 八个套件全部通过、0 pageerror。

### 32. 落地用例 L2-ROLE-001 设备角色矩阵验证（串口，22 步）

- 用户选择只做 T1（串口 + 连带配置断言），已加入用例语料 `tests/meshtastic_cli_demo/cases_l2_demo.json`（现在共 5 条用例，模块「配置写入」），生成脚本 `tmp/gen_role_case.py`（可重复执行、幂等替换该用例），语料备份 `tmp/cases_l2_demo.json.bak`。
- 步骤形状沿用 runner 既有约定 `config_set_get_steps()`：读当前值 → 写入 → `sleep_sec: reboot_wait` 等重启 → 严格读回；写入步骤带 `timeout: 90`（角色写入会触发 `installRoleDefaults` + 保存 + 重启，默认 30s 预算不够）、`retries: 2` / `retry_delay_sec: 8`，读回步骤带 `retries: 4` / `retry_delay_sec: 8`。
- 顺序与断言：CLIENT（role 读回）→ CLIENT_MUTE（role 读回）→ TRACKER（role 读回 + 遥测间隔证据读取，不断言数值）→ LOST_AND_FOUND（role 读回 + `position_broadcast_secs=300` + `position_broadcast_smart_enabled=false`）→ 切回 CLIENT 后再次断言 `position_broadcast_secs=300`（角色切换不幂等回归）。
- 严格断言用 `expect_stdout_regex`（ALL 语义）钉住值，形如 `(?i)\brole\s*[:=]\s*(tracker|5)\b`、`(?i)position_?broadcast_?secs\s*[:=]\s*300`（兼容蛇形/驼峰两种打印），CLIENT 用 `(?im)^\s*role\s*[:=]\s*client\s*$` 避免被 `CLIENT_MUTE`/`CLIENT_BASE` 误匹配；`readback_field`/`readback_value` 同时填上用于报告记录（注意 runner 的读回值本身不参与判定，判定只看 `expect_stdout_regex*`）。
- 验证（离线）：语料 JSON 合法、`/api/cases` 已返回 5 条含 `L2-ROLE-001`；`runner.py --case L2-ROLE-001 --port COM59 --allow-mutating` 干跑输出 22 步完整计划（命令、顺序、`--wait-to-disconnect 10` 均正确），未执行任何真机写入。`--allow-mutating` 由 `server.py:551` 在真实执行时传入，所以页面点「真实执行」会跑全 22 步。
- 待真机校准（诚实标注）：`--get` 的实际输出格式（`<section>.<field>: <value>`）来自 CLI 源码推断，真机第一次跑需要确认严格正则是否命中；若某步出现「值不符但输出里有该值」的假失败，按真实输出微调正则即可，绝不放宽成 `expect_stdout_regex_any` 那种只匹配字段名的弱判定。
- 仍未做：第三台串口目标（`--observer-port`）与 T2/T3（LOST_AND_FOUND 周期位置节奏、CLIENT vs CLIENT_MUTE 转发差异）。

### 33. 角色用例拆成四条行为验证 + 接入测试设备3（观察者）+ 时区 US/* 旧名

- 用例语料改成 8 条：原 4 条不变，删掉「只验证写入」的 `L2-ROLE-001`，换成模块「设备角色验证」的四条 —— `L2-ROLE-CLIENT`（9 步）、`L2-ROLE-CLIENT-MUTE`（9 步）、`L2-ROLE-TRACKER`（10 步）、`L2-ROLE-LOST-FOUND`（8 步）；生成脚本 `tmp/gen_role_cases.py`（幂等，可重复执行）。
- 角色行为怎么验证：
  - CLIENT / CLIENT_MUTE：用 `--sendtext` 让测试设备2 广播带标记的消息，测试设备3（观察者）用 CLI `--listen` 抓包。**转发证据用 hop 计数**：Meshtastic 每中继一次 `hop_limit` 减 1，观察者收到 `hop_start > hop_limit` 的副本即证明消息被中继过 —— 这样即使三台设备在同一房间能互相直收也不影响判定。CLIENT 用例断言「必须出现中继副本」，CLIENT_MUTE 用例断言「必须没有中继副本」（直收副本不算失败）。
  - 观察者在转发类用例里先被写成 `CLIENT_MUTE`，避免观察者自己转发污染"谁中继的"判定；报告里同时保留 `relay_records`（id/from/relayNode/hopLimit/hopStart 原始行）供人工复核。
  - TRACKER：角色读回 + 遥测间隔证据读取 + 位置行为（`--setlat/--setlon` 主动上报一次，观察者必须收到 `POSITION_APP`）+ 150 秒观测窗口里是否出现第二个位置包（只记录证据）。
  - LOST_AND_FOUND：角色读回 + `position_broadcast_secs=300` + `position_broadcast_smart_enabled=false`（硬断言）+ 位置包可观测 + 330 秒观测窗口证据。
- runner 新增能力（`tests/meshtastic_cli_demo/runner.py`）：`--observer-port` / `--observer-label` 第三个目标；`requires_observer` 门控 + `target: observer` 的读写步骤；监听步骤支持 `listen_target: observer`、`listen_expect_relayed` / `listen_expect_not_relayed`（hop 递减判定）、`listen_expect_portnum`（POSITION_APP 等）、`expect_no_receive`（负向断言）、`listen_evidence_only`（只记证据）以及空命令的纯监听步骤；没接观察者时把 `requires_observer` 步骤整条剔除，并在 `pass_meaning`/`test_data` 里追加"本次未接入测试设备3，角色行为未观测"的说明，避免读报告的人误判覆盖范围。
- 仪表盘：`server.py` 透传 `--observer-port`（仅串口模式）并在任务记录里写 `observerPort`/`observer_connection`；`index.html` 串口区块新增「测试设备 3（观察者，可选）」下拉；`app.js` 的 `targetPort`/`runPayload`/`payloadDeviceLabel`/`syncPortSelectors`/断开串口/端口占用互斥都覆盖了 observer，`fillSelect` 改成可变参数以支持三路互斥。
- 验证（离线）：四条用例 `--allow-mutating` 干跑全部 DRY_RUN（36 步）；不带 `--observer-port` 时观察者步骤被剔除且 `pass_meaning` 追加未观测说明；`/api/run` 端到端确认 `--observer-port COM58` 已进命令、报告里 `observer_connection=--port COM58`。浏览器侧 `tmp/verify_role_ui.js`：`#observerPort` 在串口区块内、串口模式可见/BLE 模式隐藏、三串口互斥（COM77/COM78 在设备3 下拉里被禁用）、`runPayload` 带出 `observerPort=COM79`、时区 7 个 `US/*` 旧名选项齐全且与规范时区共用同一 POSIX 值、0 pageerror；四个回归套件（`verify_ui_fixes` / `verify_psk_selector` / `verify_ui_trim_tz` / `verify_channels_tz_select`）仍全绿。
- 时区：`US/Hawaii`、`US/Alaska`、`US/Pacific`、`US/Arizona`、`US/Mountain`、`US/Central`、`US/Eastern` 是 IANA backward 旧名，`nayarsystems/posix_tz_db` 的 `zones.csv` 只收规范名（已抓取缓存 `tmp/zones.csv`，无任何 `US/*` 条目），所以之前下拉里只有规范名。现在按旧名单独列了 7 个选项，值就是对应规范时区的 POSIX TZ（US/Hawaii=`HST10`、US/Alaska=`AKST9AKDT,M3.2.0,M11.1.0`、US/Pacific=`PST8PDT,M3.2.0,M11.1.0`、US/Arizona=`MST7`、US/Mountain=`MST7MDT,M3.2.0,M11.1.0`、US/Central=`CST6CDT,M3.2.0,M11.1.0`、US/Eastern=`EST5EDT,M3.2.0,M11.1.0`）。
- 因为 `server.py` 有改动，仪表盘后端已重启（同一个 8765 端口，`/api/health` 正常），静态文件仍是刷新即生效。
- 真机待校准（诚实标注，未执行任何真机写入）：`--listen` 输出里 `hopLimit/hopStart/relayNode` 的键名来自 meshtastic Python 库 `MessageToDict(meshPacket)`（camelCase），真机第一次跑要确认 hop 判定与 `POSITION_APP` 观测窗口是否符合预期；TRACKER 的 `owner.is_unmessagable` 串口 CLI 读不回来（`--info` 不打印），需要 BLE/App 侧读 User proto，属已知覆盖缺口。

### 34. 设备3 折叠接入 + 角色用例设备分工澄清 + LoRa 前置一致性 + 新增时区验证用例

- 界面精简（`index.html` / `styles.css` / `app.js`）：测试设备1、2 固定在第一行左右分布；**测试设备3 默认收起**，在「测试设备 2」右侧加圆形「+」按钮，点开后按钮旋转成「×」并在第二行整行展开（栅格靠 `.wide` 保持统一）。标签只保留「测试设备 3」，右侧「?」小图标 hover/键盘聚焦时悬浮显示说明（「角色行为验证时用它长时间监听空口抓包（中继副本、POSITION_APP 等）。只支持串口。」）。收起状态下 `observerPort` 不参与运行参数（等价于"没接观察者"）。「断开串口」在未选择任何串口时置灰不可点（`updateDisconnectButton()` 随三个串口选择变化刷新，游标 not-allowed）。
- **设备分工澄清（写进用例元数据与步骤名）**：测试设备1 = primary = **被测角色设备**（每条角色用例只改它的角色）；测试设备2 = peer = 发送方 / 监听端；测试设备3 = observer = 观察者。之前「哪台是被测设备」不清晰的问题通过 `source_l2_case`（…（被测设备 = 测试设备1））、步骤名（「读取测试设备1（被测角色设备）当前角色」）和 `test_data` 三处写死。
- **三台 vs 两台**：只有**转发类**（`L2-ROLE-CLIENT` / `L2-ROLE-CLIENT-MUTE`）必须三台 —— 发送和监听要同时占用两路不同串口，同一路串口没法一边 `--sendtext` 一边 `--listen`。**位置类**（`L2-ROLE-TRACKER` / `L2-ROLE-LOST-FOUND`）只需要两台：位置包是只读观测，新语义 `requires_listener` + `listen_target: "listener"` 会在没接观察者时自动退回用测试设备2 当监听端（步骤不被剔除，只在 `test_data` 里注明"行为观测改用测试设备2 当监听端"）；转发类仍用 `requires_observer`，没接观察者时相关步骤整条剔除并在 `pass_meaning` 追加"角色行为未观测"说明。
- **LoRa 配置一致性前置检查**（回应用户"发消息首先得保证 LoRa 配置一致"）：四条角色用例开头新增 6 个读取步骤（primary/peer 各读 `lora.region`、`lora.modem_preset`、`lora.hop_limit`）+ 1 个比对步骤，参数不一致直接 FAIL（`config_mismatch`），避免"收不到包"被误判成"不转发"。读取步骤的正则要求字段后必须跟非空值；比对步骤同时修了一个假 PASS 隐患：**任一侧读不到有效值时不再当作"一致"**，改判 FAIL（`config_unreadable`）。
- **新增用例 `L2-TZ-US-CHECK`（模块「时区验证」，39 步，约 15-20 分钟）**：依次把被测设备配成 `US/Hawaii`、`US/Alaska`、`US/Pacific`、`US/Arizona`、`US/Mountain`、`US/Central`、`US/Eastern`（值取对应规范时区的 POSIX TZ），每个时区：写入 `device.tzdef` → 等重启 → 严格读回该 POSIX 值 → `--set-time`（无参数 = 主机当前时间）校准设备时钟 → 让测试设备2 发一条带标记消息、被测设备收到后用自身时钟打的 `rxTime` 与主机时间比对（误差 ≤ 180 秒）；跑完用第 1 步记录的原始时区**自动回滚**。判定依据：`device.tzdef` 只影响设备端本地时间的显示/格式化、不影响 UTC 时钟，串口 CLI 也读不到设备的本地时间渲染结果，所以本用例校验的是"时区写入读回 + 切换时区（含重启）后设备时钟仍与实际时间一致"，而不是"设备屏幕显示的时间字面等于主机时间"（后者需要 BLE/App 或看屏幕）——这一点写在 `pass_meaning` 里。
- runner 其他改动：新增 `{recorded:<target>:<field>}` 占位符（用前面 `--get` 读到的原值做回滚）；原值为空时**不拿空串去写设备**，步骤标 SKIPPED + `recorded_value_empty` 并写明原因；干跑（无 `--execute`）时不再因依赖链把后续步骤标成 `dependency_not_run`（干跑不产生 PASS，依赖链在预览里没有意义，否则前置比对步骤会让后面整串步骤显示 SKIPPED）。
- 离线验证：9 条用例干跑 —— 三台配置下 `L2-ROLE-CLIENT` 16/16、`-CLIENT-MUTE` 16/16、`-TRACKER` 15/15、`-LOST-FOUND` 13/13、`L2-TZ-US-CHECK` 38 DRY_RUN + 1 SKIPPED（`recorded_value_empty`，干跑没读到原值，正是预期的保护）；两台配置下转发类用例降到 11 步（观察者步骤被剔除且追加"未观测"说明）、位置类用例仍是 15/13 步（自动退回设备2 当监听端）。浏览器验证 `tmp/verify_observer_toggle.js`（收起默认、`+` 展开、`?` 悬浮说明、收起不参与参数、断开串口置灰/恢复）+ `tmp/verify_tz_case_ui.js`（9 条用例、4 个模块含「时区验证」、39 步）+ 六个回归套件（`verify_ui_fixes` / `verify_psk_selector` / `verify_ui_trim_tz` / `verify_channels_tz_select` / `verify_role_ui` / `verify_role_case_cards`）全部 0 pageerror。

### 35. 用例标签精简 + 三级运行按钮层级 + 角色用例瘦身与失败原因定位 + 时区验证迁到 BLE 模块

- **用例标签精简（`app.js` / `cases_l2_demo.json`）**：测试项子项标题不再显示 `L2-…` 前缀，只显示「角色标识 + 核心释义」（例如 `CLIENT（通用终端）`、`CLIENT_MUTE（不转发终端）`、`TRACKER（定位优先）`、`LOST_AND_FOUND（丢失找回）`）。用例 ID 与来源（`L2-ROLE-CLIENT · 被测设备 = 测试设备1；角色 = CLIENT（通用终端）`）移到该行的 `title`（hover 可见），不再每行重复。新增 `display_name` 字段承载这个短标题；报告里的配置字段优先显示中文名（`lora.region` → 「LoRa 区域」、`lora.modem_preset` → 「LoRa 调制预设」、`lora.hop_limit` → 「LoRa 跳数上限」，另补 `position.position_broadcast_secs` → 「位置广播间隔」、`telemetry.device_update_interval` → 「遥测上报间隔」等；新增 `fieldDisplayName()`，读取值与「读取值」详情都走它）。
- **三级操作按钮，权重逐级降低**：全局「运行选中」保持**绿色填充**（`#runSelected`，白字、40px 高）；分组「运行」改为**描边按钮**（白底 + 1.5px 黑边 + 黑字，hover 反色，`.module-head .module-run`）；子项「运行」改为**纯图标播放键**（`.module-row .case-icon-run`，透明底 + 细边框，hover 变绿，`title`/`aria-label` 都是「运行单条」）。注意 `styles.css` 里旧的 `.module-row button` 基础规则（黑底填充）特异性是 (0,1,1)，所以新规则必须写成 `.module-row .case-icon-run`，否则子项按钮又会被刷成黑色实心（本轮第一次改就被这条规则盖掉，已修正）。
- **复选框统一**：全选（`.module-select-all input`）与分组复选框（`.module-check input`）统一 16px×16px、`accent-color: var(--green)`、5px 圆角，BLE 测试项卡片里的勾选框（`.case-check input`）同尺寸同色。圆形「+」（`#toggleObserver`）由灰底改为**绿色填充 + 白字**，展开仍旋转 45° 变「×」。
- **16 条角色步骤瘦身到 10-12 条（`tmp/gen_role_cases.py` 重写）**：四条角色用例新步数 —— CLIENT 16→11、CLIENT_MUTE 16→11、TRACKER 15→12、LOST_AND_FOUND 13→10。瘦身手段：`--get` 支持重复出现（`nargs=1, action="append"`），所以「读角色 + 读 3 个 LoRa 参数」合并成 1 步、两台设备的 6 个读取合并成 2 步、比对仍是 1 步；观察者准备改为「读 → 条件写（`conditional_set_pairs` + `change_group`，已一致就报 `unchanged`）→ 等待（同组，没写就自动跳过，不白等一轮重启）→ 读回」4 步；步骤名全部改成"动作 + 判据"的中文句子（例如「读回测试设备1（被测角色设备）角色必须等于 CLIENT」「核对两台设备的 LoRa 区域、LoRa 调制预设、LoRa 跳数上限 一致」）。干跑预览里条件写步骤**展开成真实 `--set` 命令**（原来预览里是空命令）。
- **修掉一个真机假 FAIL**：`logs/meshtastic_cli_dashboard_report_20260930_174124_f60f19012a70.json` 第 11 步判 FAIL（`regex_not_matched`），原因是角色读回正则写成 `^\s*role\s*[:=]\s*client$`（要求出现字面 `client`），而**真机 `--get device.role` 打印的是枚举数值** `device.role: 0`。现在正则统一为 `(?i)\brole\s*[:=]\s*(0|client)\b`（CLIENT 0 / CLIENT_MUTE 1 / TRACKER 5 / LOST_AND_FOUND 9），`tmp/verify_role_regex.py` 用真机输出样本验证：四个角色的正确值全部通过。**这里的修法是"让判据认设备的真实输出"，不是放宽判据**——数值是固件的权威表示，名字只是别名。
- **监听/中继判定补上真机格式，并给出可定位的失败原因（`runner.py`）**：真机里库默认的 `Received: {json}` 走 stdout，监听进程被 kill 时块缓冲会丢行；`--debug` 的 stderr 才是完整的 protobuf 文本格式（snake_case：`hop_limit` / `hop_start` / `rx_time` / `relay_node` / `portnum` / `payload: "标记"`）。本轮：① `merged_env()` 强制 `PYTHONUNBUFFERED=1`；② 新增 `parse_listen_protobuf_packets()` 解析 `packet { … }` 文本块，`parse_listen_relay_records()` 同时返回 JSON 与文本两种来源的记录（`format` 字段区分），`listener_has_exact_text()` 增加 `payload: "标记"` 匹配；③ 新增 `listen_diagnostics`（监听端标签、`listener_connected`、窗口秒数、`copies_seen` / `direct_copies` / `relayed_copies` / `portnums` / `hop_pairs`）；④ 失败原因细分并给出"下一步查什么"的 `failure_note`：连直收副本都没有 → `no_copy_observed`（提示先查频道/PSK、距离、天线、发送是否真的发出），有直收但没有 hop 递减 → `relayed_copy_not_observed`（查角色是否生效、hop_limit 是否 > 0、是否因「已听到发送方直发」取消重播），不该中继却中继 → `relayed_copy_observed`（先按 relay_node/from 判断是谁中继的，可能是环境里的第三方节点）。UI 侧 `friendlyReason()` 现在**优先显示 `failure_note`**，`reasonLabels` 补齐 `no_copy_observed` / `relayed_copy_not_observed` / `expected_portnum_not_observed` / `config_unreadable` / `recorded_value_empty` / `missing_listener` 等中文文案。
- **时区验证从串口测试项迁到 BLE 模块**：串口「测试项」里删掉 `L2-TZ-US-CHECK`，新增 **`L2-BLE-TZ-CHECK`（模块「BLE 设备验证」，`connection: "ble"`，26 步）**——单台设备走 BLE 逐个写入 7 个 `US/*` 别名对应的规范 POSIX TZ、等重启、严格读回，最后用第 1 步记录的原值回滚。诚实边界写在 `pass_meaning` 里：**本用例只证明时区配置可写可读可持久**；`--set-time` 只作为"命令被接受"的证据步骤，单台设备没有收到包的时间戳（`rx_time`）可读回、CLI 也没有时钟读回字段，因此不声称"设备时间准确"（要做时钟校验仍需第二台设备发一条消息）。UI：BLE 专用用例通过 `connection === 'ble'` 从串口模块卡片过滤掉（模块为空时整块不渲染），渲染到新增的「BLE 测试项」卡片（`#bleTestCard`，逐条勾选 + 「运行选中」，新增 `cases` 目标类型 → 后端 `targetType == "cases"` 取 `caseIds`）。
- **BLE 布局改成并排 + 测试项卡片**：`ensureSingleBleLayout()` 在 BLE 模式下把「设备当前配置」卡片移进 `.test-grid` 并加 `ble-layout`：第 1 行「BLE 持续收发」整宽，第 2 行 **设备当前配置 | 配置写入 各占一半（实测各 528px，左右平衡）**，第 3 行是「BLE 测试项」卡片（原来配置写入之后的位置）。切回串口会把卡片移回原位、撤掉 `ble-layout`（实测 `backToSerial` 与初始串口布局的坐标完全一致）。注意必须写成 `body.ble-single-device-layout .test-grid.ble-layout …`：旧的 `body.ble-single-device-layout .test-grid`（含 1320px 媒体查询的 `minmax(0,1fr) minmax(300px,0.75fr)`）特异性更高，会把两列压成 603/453 的不平衡宽度。
- 离线验证：干跑 —— 三台串口配置下 CLIENT 11/11、CLIENT_MUTE 11/11、TRACKER 12/12、LOST_FOUND 10/10；两台配置下转发类降到 6 步（观察者步骤剔除 + "未观测"说明）、位置类仍是 12/10（自动退回设备2 当监听端）；`--ble Meshtastic_1c62` 下 `L2-BLE-TZ-CHECK` 25 DRY_RUN + 1 SKIPPED（`recorded_value_empty`，干跑未读原值，回滚被正确拦下）。浏览器验证：`tmp/verify_ui_item1.js`（子项标签无前缀、子项按钮透明纯图标 + 「运行单条」、分组按钮白底黑边、全局按钮绿底白字、两个复选框均 16×16 绿 accent、`+` 按钮绿底白字、0 pageerror）、`tmp/verify_ble_layout.js`（BLE 两列各 528px、BLE 测试项卡片只在 BLE 模式显示且含「时区验证（7 个 US/* 别名）」、切回串口布局复原、0 pageerror）、`tmp/verify_failure_reason_ui.js`（新失败原因中文文案 + `failure_note` 优先 + 字段中文名，0 pageerror）。后端因 `server.py`（新增 `cases` 目标类型）改动已重启，`/api/run` 实测生成 `--ble Meshtastic_1c62 --case L2-BLE-TZ-CHECK`。
- 真机待办（未执行任何真机写入）：① 角色用例的数值正则需要用真机再跑一遍确认（本轮只用报告里的输出样本离线验证）；② `--listen` 的 protobuf 文本解析已能识别合成样本，真机上要确认观察者窗口里确实能抓到 `packet { … }`；③ TRACKER 的 `owner.is_unmessagable` 串口 CLI 读不回来（需 BLE/App 读 User proto），仍是已知覆盖缺口；④ BLE 时区用例需要真机 BLE 连接（`Meshtastic_1c62`）才能验证 7 次写入 + 7 次重启后 BLE 是否稳定重连。

### 36. TRACKER 失败定位与用例重设计 + 用例 hover 台数提示 + 切换连接方式刷新快照 + BLE 布局折叠与压缩

- **用户报告的 TRACKER 失败已定位（报告 `C:\Users\EDY\Downloads\meshtastic_cli_dashboard_report_20261008_104420_295a28bbb684.json`，12 步 10 PASS / 2 FAIL）**：真机连接是 `primary=COM7`、`peer=COM8`（`observer_connection` 为空，所以 `listen_target: "listener"` 自动退回设备2 当监听端，`listen_connected=true`）。两处失败都不是设备坏：
  - 第 10 步「读回位置广播间隔 = 60 秒」FAIL：第 8 步 CLI 明确打印 `Set position.position_broadcast_secs to 60 / Writing modified preferences to device`，重启后读回却是 **3600**。3600 正是固件默认值：`src/mesh/Default.h` 里 `default_broadcast_interval_secs = IF_ROUTER(ONE_DAY/2, 60*60)` = 3600 秒。结论：**写入没落盘，设备按固件默认 1 小时运行**（深睡设备在写入后很快进入睡眠，配置可能没来得及提交；也可能是变体默认值覆盖）。因此这条断言本身就是错的设计，已删除。
  - 第 11 步「监听端必须收到位置包」FAIL（`expected_portnum_not_observed`，45 秒窗口内 `copies_seen=0`）：固件源码 `src/modules/PositionModule.cpp` 写明 TRACKER / TAK_TRACKER 的行为 —— `sendOurPosition()` 发一次位置后 `sleepOnNextExecution = true`，`runOnce()` 里 5 秒后执行 `doDeepSleep(position_broadcast_secs)`，日志文案就是「Sending position and sleeping for %us interval in a moment」；`doDeepSleep` 期间 USB-CDC 与射频一起断电，**串口会从系统里消失**（本轮实测：报告跑完后 `serial.tools.list_ports` 只剩 COM8，COM7 已不在系统里，与用户描述完全一致）。另外 `sendOurPosition()` 有前置条件 `if (!config.position.fixed_position && !nodeDB->hasLocalPositionSinceBoot()) return;`，`PositionModule()` 构造时对 sleepy tracker 还会 `clearLocalPosition()`（避免开播旧位置），所以**没有 fixed_position 的 TRACKER 根本不会发包**。45 秒窗口对「深睡 3600 秒、醒一次发一次」的角色本来就不可能稳定观测到。
  - `telemetry.device_update_interval = 2147483647` 的疑问：**单位是秒，但这是哨兵值不是真实间隔**。`Default.h` 定义 `#define MAX_INTERVAL INT32_MAX // FIXME: INT32_MAX to avoid overflow issues with Apple clients but should be UINT32_MAX`，即 2^31-1 = 2147483647 ≈ 68 年，语义是「不做周期性上报」。同文件里 `default_telemetry_broadcast_interval_secs = IF_ROUTER(ONE_DAY/2, 60*60)` = 3600，而 `NodeDB::installRoleDefaults(TRACKER)` 写的是 `moduleConfig.telemetry.device_update_interval = default_telemetry_broadcast_interval_secs`；设备上读到 INT32_MAX 说明该设备的模块间隔走了 `MAX_INTERVAL` 分支（`initModuleConfigIntervals()` / `CLIENT_HIDDEN` 都是这个值），报告里保留原值并写明含义，不做数值断言。
- **TRACKER 用例重做（`tmp/gen_role_cases.py`，15→11 步）**：① 先 `--setlat/--setlon` 设置固定位置（让 TRACKER 满足发包前置条件，原来放在位置探测步骤里，等于"要不要发包"与"能不能发"混在一步）；② 「写角色 TRACKER」与「监听窗口 120 秒」合并成一步，专门抓「重启后首次位置上报 → 5 秒后深睡」这个窗口，标 `listen_evidence_only`；③ 删掉"写 60 秒再读回 60"的错误断言，改成「读回位置广播间隔（= 深睡周期）记录原值 + 校验是 > 0 的有效值」，并在 pass_criteria 里说明固件默认 3600 秒、用例刻意不改小它（改小等于改变被测角色的睡眠行为）；④ 新增「读回 fixed_position 必须为 true」硬断言；⑤ 遥测间隔步骤改成记录 + 说明 `2147483647 = MAX_INTERVAL`；⑥ 尾部 120 秒观察窗口保留为证据，pass_criteria/failure_help 写清「睡眠期间收不到位置包属预期，要观测周期上报要等一个完整唤醒周期（默认 1 小时），或先唤醒设备」。**诚实边界**：位置包不再作为 TRACKER 的 PASS/FAIL 判据（不观测就不再是失败判据），报告保留原始流量。LOST_AND_FOUND 顺势修正：它不深睡、位置周期 300 秒，45 秒断言必然误判，改成 **330 秒窗口的真实断言**（覆盖一个完整周期），并删掉重复的 330 秒证据窗口（10→9 步）。
- **修掉一个假 PASS 隐患（`runner.py`）**：监听步骤的判定顺序里 `listen_evidence_only` 排在 `evaluate_expectations` 之前，导致「写角色 + 证据窗口」这种组合步骤里**写入失败也会因为"窗口无包不算失败"而判 PASS**。现在证据型步骤先算发送命令自身的期望（`expect_stdout_regex*`/`fail_on_regex`/非零退出码），命令失败即 FAIL（`failure_note`：发送命令本身没有达到期望返回），只有命令成功时才走"窗口内无包也算 PASS"。端到端验证：`tmp/tmp_evidence_gate_case.json` 用不存在的 COM99/COM98 跑 `--execute`，步骤正确判 FAIL（`connection_unavailable`）而不是 PASS。
- **串口消失的失败原因写成可操作提示（`runner.py`）**：端口打不开（`could not open port` / `FileNotFoundError` 等）时 `failure_note` 现在直接说明「串口可能已经从系统里消失：USB 线松了/设备断电，或者设备正在深度睡眠 —— TRACKER 类角色发完位置后按 position_broadcast_secs 深睡（固件默认 3600 秒），睡眠期间 USB-CDC 与射频一起断电。等设备醒来（按键唤醒/重新上电）后重跑，或确认端口号是否变了」。另外 `listener_label` 不再显示字面 `listener`，而是解析后的「监听端（测试设备2）」/「监听端（测试设备3）」。
- **用例 hover 提示补上"需要几台测试设备"（`app.js` + 语料）**：新增 `required_devices` / `device_note` 两个字段（`tmp/annotate_case_devices.py` 按步骤标志推导 1/2/3 台并幂等写入 9 条用例，角色用例由生成器写更具体的说明），新增 `caseDeviceTip()` / `buildCaseTip()`：子项 `title` = `用例ID · 来源 · 设备要求`，例如 `L2-ROLE-CLIENT · 被测设备 = 测试设备1；角色 = CLIENT（通用终端） · 必须 3 台：测试设备1（被测角色设备）+ 测试设备2（发送方）+ 测试设备3（观察者），点「+」接入。`；TRACKER 的提示额外写明「深睡时串口会掉线」。实测 9 条用例 hover 提示全部带台数，无遗漏。
- **切换连接方式必须刷新「设备当前配置」（`app.js`）**：新增 `resetDeviceReadouts(hint)`（清 `deviceConfigs`/`deviceSnapshots`/`deviceNodeIds`/`connectedBleDeviceIds`/`channelPsks`/`channelPskKnown`，复用 `resetDeviceIdentity()` 并给快照区写提示），`connectionType` 的 change 处理器改为「先清空再切换界面」：切到蓝牙显示「已切换到蓝牙连接：连上 BLE 设备后运行前置检查，读取这台设备的配置。」，切回串口显示对应提示。浏览器实测：切换后 `#deviceSnapshotList` 为空态 + 提示文案 + 0 张残留卡片，0 pageerror。
- **BLE 布局压缩 + 折叠箭头（`index.html` / `styles.css` / `app.js`）**：① 折叠按钮 `#toggleModulesCollapse`（圆形描边 + 折线箭头，展开时朝下、折叠时旋转 -90°，`aria-expanded` 同步，状态记在 `localStorage['dsh.testModulesCollapsed']`，刷新后保持）。它放在 `.panel-title` 里而不是 `.module-actions`（BLE 模式下 `.module-actions` 会被隐藏），实测两种模式都可见。② 折叠要真的变矮：`.test-grid > .panel` 原本有 `height: 100%` + `grid-auto-rows: 1fr`，所以第一版折叠后面板仍是 605px（像没折叠）；现在 `.panel.modules.collapsed` 覆盖 `height/min-height: auto` + `align-self: start`，并在 BLE 布局里让 `grid-auto-rows: auto`（原来 1fr 把 4 张卡片互相拉高到 575px）。实测：串口模式折叠 605→94px；BLE 模式折叠 575→94px、**整页 2433→1951px**。③ 空白占位压缩：BLE 布局下面板最小高度从 `clamp(520px,44vh,640px)` 降到 `clamp(300px,28vh,360px)`（BLE 测试项卡片 200px），持续收发日志区 `min-height 190→96px / max-height 300→124px`，**BLE 模式整页 3022→2433px（-589px）**，页面变短、少滚动。④ 过长小字说明改悬浮工具提示：`设备当前配置` 标题旁的「运行测试前检查或配置读回后刷新，不是实时流。」与新「BLE 测试项」的说明都收进 `.help-icon` + `.help-tip`（hover/键盘聚焦显示），并加优先级修正（`.snapshot-head .help-icon` / `.help-icon .help-tip`）避免被 `.snapshot-head span` 的小字规则改字体色；日志占位文案精简为「启动后显示收发记录」。⑤ 顺带保留的两列宽度不变（实测 528px / 528px）。
- **验证**：`node --check app.js`、`python -m py_compile runner.py` 通过；干跑 `--port COM8 --peer-port COM9 --case L2-ROLE-TRACKER` = 11 步（写操作步骤在无 `--allow-mutating` 下正确显示 `mutating_guard`）；`/api/cases` 返回 9 条用例且全部带 `required_devices`/`device_note`（无需重启后端，语料与静态文件都是按请求读取）；浏览器回归 `tmp/verify_items_1_3_4.js` / `tmp/measure_ble_layout.js` / `tmp/verify_collapse_both_modes.js` / `tmp/shots_ble_layout.js` 全部 0 pageerror。
- **真机待办（本轮未做任何真机写入，COM7 已随深睡从系统里消失）**：① 新版 TRACKER 用例要在真机上跑一遍，确认「重启后首次位置上报」窗口能抓到 POSITION_APP（受固件 `transmitHistory` 节流影响，可能抓不到 —— 抓不到也是预期内的证据记录）；② 用户设备的 `power.is_power_saving` 与 `position_broadcast_secs` 当前值可以在设备醒来后用 `--get position.position_broadcast_secs`、`--get power.is_power_saving` 直接读回确认（本轮因 COM7 消失未能读取，判断依据是固件源码 + 报告证据）；③ 两台设备「LoRa 区域/预设一致」不代表频道 PSK 一致，位置包观测不到时仍要先核对频道密钥（已在 failure_help 写明）。

### 37. 第二轮界面优化：? 提示改 hover、折叠箭头挪到 BLE 测试项、配置写入间距规整、通信验证置灰与分组

- **`?` 悬浮提示改成 hover 触发（`app.js` / `styles.css`）**：原来只有悬停那个 17px 的小圆圈才出提示，鼠标停在旁边的文字上什么都没有，实际使用中很容易以为「没有提示」。现在 ① 悬停整行标签（`.snapshot-head > div`、`.field > span`、`.panel-title > div`、`.module-actions`，用 `:has(> .help-icon)` 精确限定，浏览器不支持 `:has()` 时该规则被忽略、不影响其它样式）也出提示；② 点击可「固定」提示（慢慢读/截图用），再点一次、点别处或按 Esc 收起；③ 键盘用户仍走 `:focus-visible`（不再用 `:focus`，避免鼠标点一下之后提示一直挂着），Esc 时顺带 `blur()`，否则焦点还在提示就收不掉。实测：hover 图标/整行 = `block`，移开 = `none`，点击 = 固定，Esc = `none`，点别处 = `none`。
- **折叠箭头从「测试项」挪到「BLE 测试项」（`index.html` / `app.js` / `styles.css`）**：串口「测试项」卡片取消折叠（用例列表就是它的主体内容，折叠没收益），箭头改挂在 `#bleTestCard` 上（BLE 模式下这块经常空着）。JS 由 `setModulesCollapsed`/`initModulesCollapse`（`dsh.testModulesCollapsed`）改为 `setBleCasesCollapsed`/`initBleCasesCollapse`（`dsh.bleCasesCollapsed`），旧 key 不再被读取；CSS 从 `.panel.modules > .panel-title .icon-chevron` 泛化到 `.panel > .panel-title .icon-chevron`，`.panel.collapsed` 统一收内容与高度，BLE 布局下再覆盖 `min-height`。实测：串口无折叠按钮（`modulesChevron:false`、旧按钮 id 已移除），BLE 卡片 200→94px、整页 2463→2357px，刷新后状态保持。
- **BLE 测试项用例要能看出覆盖哪些具体时区**：语料 `L2-BLE-TZ-CHECK` 新增 `zones`（7 项，含规范时区名与 POSIX 串，`tmp/gen_tz_ble_case.py` 生成），用例行下面渲染成一排小标签 `US/Hawaii · US/Alaska · US/Pacific · US/Arizona · US/Mountain · US/Central · US/Eastern`（每个标签的 title 是「别名 → POSIX」对应关系），hover 提示也追加「覆盖 7 个时区：…」。只写「7 个 US/* 别名」看不出具体是哪几个，现在直接可读。
- **配置写入卡片（`index.html` / `styles.css`）**：`写后等待秒数` → **`写入后等待时长（秒）`**；`.config-card` / `.communication-card` 加 `row-gap: 12px`，`.card-actions` 包一层（`margin-top: auto` + `padding-top: 6px`），按钮与上方字段之间保证有 18px 间距 —— 之前 `.config-card > .action` 只有 `margin-top: auto`，字段把栅格撑满时 auto 退化为 0，按钮就贴在输入框下沿。实测 9 种配置项（串口）+ 动态字段（频道 PSK、用户名称、WiFi、区域）批量量过：标签→控件间距**全部 6px**、字段高度**全部 67px**、栅格→按钮 **12px + 6px padding**，`gaps:[6]`、`heights:[67]` 无例外。
- **串口通信验证卡片（`index.html` / `styles.css` / `app.js`）**：① **置灰只作用于控件**：以前 `.muted-field { opacity: 0.58 }` 加在整行上，复选框跟着一起被拉灰（看起来像复选框本身也禁用了）；现在改成 `.field input:not([type=checkbox]):disabled` + `.muted-field …:not(:disabled)` + `select:disabled + .custom-select .custom-select-button`（自定义下拉的真实结构是 `select + .custom-select` 兄弟节点，不是包裹），标签行与复选框保持正常灰度。② **灰度统一**：新增 `--disabled-opacity: 0.5`，把按钮 `0.5` / `.psk-random` `0.45` / 次要按钮 `0.55` / 下拉项 `0.55` 全部换成同一个变量，实测禁用态只有 `0.5` 一个值（`distinctDisabledOpacity:["1","0.5"]`，1 是启用态与复选框），禁用底色也统一为 `--surface-2`；未勾选时区域/预设下拉、频率覆盖输入框都是 `disabled:true` + `not-allowed`，勾选后立刻回到可编辑（`disabled:false`、`cursor:pointer/text`）。③ 新增 **「发送设置」分组标题**（横线 + 小标题，整行），把发送方式、发送频道/指定节点、消息内容与快捷短语归到一组，「配置后等待秒数 / 收信等待秒数」留在上方「通信参数」语境里。④ 消息内容占位符简化为 **「请输入消息内容」**。⑤ **快捷短语与输入框重合**：`.message-presets` 以前是 `.config-grid` 的兄弟节点且 `margin-top: -4px`，与输入框有 4px 垂直重叠；现在移进栅格做 `.wide` 子项、`margin-top: 0`，走栅格 gap，实测重叠 **0px**、间距 **12px**。
- **顺带修掉一页「空白占位」的根因（`styles.css`）**：`.test-grid` 原本 `grid-auto-rows: 1fr`，每一行都等于最高那行 —— 于是「通信验证」变高会把同页其它行一起拉高（卡片里留出上百像素空白，页面也变长）。改成按内容定高（同一行内仍靠 `align-items: stretch` 等高）。实测串口页 **2688 → 2530px**，测试项/配置写入卡片 **678 → 520px**，配置写入栅格 **512 → 354px**。
- **验证**：`node --check app.js` 通过；本轮 16 个浏览器套件（`verify_ui_item1` / `verify_ble_layout` / `verify_channel_psk` / `verify_channels_tz_select` / `verify_psk_selector` / `verify_ui_fixes` / `verify_after_css` / `verify_ui_trim_tz` / `verify_observer_toggle` / `verify_failure_reason_ui` / `verify_role_ui` / `verify_role_case_cards` / `verify_run_and_error_hint` / `verify_stopbutton` + 新增 `verify_items_round2` / `verify_disabled_grays`）全部 0 pageerror；截图 `tmp/r2_*.png`（通信验证未勾选/勾选、配置写入串口/BLE、BLE 测试项含时区标签、折叠后、hover 提示）。本轮只改静态文件（`index.html` / `styles.css` / `app.js`）与语料，`server.py` 未动，**硬刷新即可，不需要重启后端**。

### 38. 去掉「?」提示图标 + 命名评估落地 + SIP 提效案例 + README 重写并推送

- **去掉所有「?」提示图标（`index.html` / `app.js` / `styles.css`）**：删掉三处 `?` 圆圈（测试设备 3 说明、设备当前配置说明、BLE 测试项说明）以及配套的 `.help-icon` / `.help-tip` 样式、整行 hover 规则与 `initHelpTips()`（点击固定/Esc 收起）。替代方案：设备当前配置标题旁改为一行短说明 `.snapshot-note`「运行前置检查或配置写入后刷新；切换串口 / 蓝牙会自动清空。」（不是原来的长段落，避免又变成小字噪声）；其余两处直接去掉（信息已在页面对应用例的 hover 提示里）。实测：`helpIcon=0`、`helpTip=0`、孤立 `?` 文本 `strayQuestionMarks=[]`、hover 不再弹出任何浮层，0 pageerror；同步更新了 6 个会引用 `?` 图标的回归脚本（`verify_observer_toggle` / `verify_items_1_3_4` / `verify_items_round2b~2d` / `shots_ble_layout`），新增 `tmp/verify_no_help_icons.js` 与 `tmp/verify_title_and_icons.js`。
- **命名评估与落地**：原来两处名称不一致 —— 浏览器标题「Mesh 固件测试控制台」、侧边栏「Mesh固件控制台」（少「测试」、少空格），且「Mesh 固件」既窄又不准（控制台支持 Meshtastic 与 MeshCore 两套系统，侧边栏本来就带模式切换）。统一为 **「Mesh 测试控制台」**（侧边栏）+ **「Mesh 测试控制台 · Wio Tracker L2」**（浏览器标题）：系统无关、用途明确、带上对象。README 标题同步改为「Mesh 测试控制台 · Wio Tracker L2 Meshtastic CLI Test Console」。
- **SIP 提效案例落到 `docs/Mesh测试控制台_提效案例_SIP.md`**：按平台字段写全「标题 / 提议背景 / 频率描述 / 亮点 / 解决方案」，数据全部取自仓库事实（9 条用例 / 79 步 / 4 模块 / 2 种连接方式，19 步写操作、7 个监听窗口，BLE 时区用例 26 步 = 7 写 + 7 重启读回），并在文末附「数据口径与来源」注明哪些是实测、哪些是按步骤估算（≥1 小时基线的换算方式），发布前可自行替换。
- **README 重写（高星开源项目风格）**：背景与目标（含痛点表）、功能特性表、架构图与目录树、快速开始、使用指南八步、配置（启动/环境变量/可写配置项/运行参数）、用例语料格式与字段表、覆盖范围表（9 条用例逐条列出模块/连接/设备数/步骤）、设计约定（默认安全、不制造假 PASS、先读后写、失败可定位、CLI DTR 包装）、注意事项六条（TRACKER 深睡与串口消失、`2147483647` = MAX_INTERVAL、BLE 单设备无法验证时钟、PSK 前置条件、写后等待、报告脱敏）、故障排查表、开发与验证、路线图、许可说明。删掉了原来写死的本机绝对路径。
- **仓库同步**：`.gitignore` 补 `.playwright-cli/`；把之前未入库的 `tests/meshtastic_cli_demo/safe_meshtastic_cli.py`、`tests/meshcore_demo/runner.py`、控制台原型需求文档一并入库。三个提交：`e7723f8`（控制台/MeshCore/DTR 包装与语料）、`d9394d1`（README + SIP 案例）、`1fe2511`（设计与工作记录），已 `git push origin main`，远端 main = `1fe2511`，raw README 已可访问。

### 39. 页面标题去产品名 + 设备卡片固定并排 + 文档平台化与「基于官方生态」+ AI 应用案例提案

- **页面标题去产品名**：浏览器标题与侧边栏品牌统一为「Mesh 固件测试控制台」（去掉 Wio Tracker L2），实测 `document.title` 与 `#appTitle` 一致、0 pageerror。
- **「设备当前配置」两卡固定左右并排**：`.snapshot-list` 由 `repeat(auto-fit, minmax(360px,760px))` 改为 `repeat(2, minmax(0,1fr))`，`.snapshot-card` 补 `min-width: 0`，单卡时 `grid-column: 1/-1` 横跨整行。实测 1440/1280/1150/1024 及默认宽度下两卡同 y、x 递增（并排），无横向溢出；单设备时卡宽 = 整行宽度。`tmp/verify_snapshot_pair.js` 常驻回归。
- **README 平台化重写**：H1 改为「Meshtastic 固件自动化测试平台」，去掉单一产品指向（设备写成「支持 Meshtastic 固件的设备，示例 Wio Tracker L2」）；MeshCore 从「已支持」降级为「界面入口已预留、能力暂未支持、纳入规划」（含路线图与架构树标注）；**纠正背景**——此前是纯人工设备操作模式，CLI 是平台能力而非原流程；串口与 BLE 各自独立成节、等比篇幅（串口：批量配置、一键建立联系人、日志查看、空口监听、测试项可补充；BLE：扫描连接与配对、配置读写与重启读回、单设备 BLE 测试项、持续收发与实时日志、适用边界）。
- **新增「基于官方生态开发（重要）」章节**（README + 两份提案）：官方 meshtastic Python CLI 2.7.11（官方 meshtastic/python）为唯一设备交互入口（串口 / `--ble`）；字段与枚举对照官方 protobufs；固件行为结论对照官方 firmware；pyserial 3.5 / Bleak 3.0.2 为官方 CLI 依赖；唯一本地包装 `safe_meshtastic_cli.py` 仅调整串口 DTR/RTS 与可选 BLE 配对，不改协议、不改 site-packages。
- **新增 `docs/AI应用案例提案_Mesh固件测试控制台.md`**：面向 HR 审核，含 300 字摘要、案例一句话、提案背景、技术基础（官方生态表）、AI 与人分工表、可量化成果、AI 应用边界与规范、可复制性与推广建议、后续计划。
- **SIP 提效案例同步**：标题与背景改为「人工设备操作 → 自动化测试项」，补「基于官方生态开发」亮点与架构说明，成效表按「人工操作 / 平台执行」对照，附数据口径补官方依赖版本。
- **仓库命名**：评估结论为需要改名（原名 `Meshtastic-CLI` 易被误认为官方 CLI）。已选定 **`meshtastic-test-platform`**，README 内三处引用（仓库名、clone 地址、`cd` 目录）已按新名写好；GitHub 侧需在仓库 Settings → Repository name 改名（旧地址会自动重定向），本地 remote 待改名完成后切换。
## 2026-10-09 补充：Meshtastic 回归执行台定位与首批通信回归
- 平台定位修正为「Meshtastic 固件测试执行台（回归验证试点）」。Wio Tracker L2 仅是当前试点测试设备，执行用例 ID 统一改为 `MT-*`，不再把 L2 写入底层用例标识。
- MeshCore 保持后续规划：前端入口禁用，服务端收到 `systemMode=meshcore` 会明确拒绝，不再被展示为已支持执行能力。
- BLE 明确只支持一台同类 Meshtastic 设备；新增 `MT-BLE-LONG-CONNECTION` 前端长连接检查（30–180 秒、约每 5 秒轻量身份读取）。只有 GATT 持续连接且 node ID 不变时才 PASS；它不覆盖手机 App 配对或双机 BLE 通信。
- 新增 6 条「串口通信回归」：US 公共频道、EU_868 公共频道、跨 Region 隔离、私有频道、PSK 隔离、点对点最终 ACK 与软重启角色持久化。Region/PSK 由测试人员按前置条件配置，本轮回归不擅自改写；负向隔离在监听窗口内收到精确文本即 FAIL。
- 执行安全修复：页面默认不勾选「真实执行」和「允许改配置/发消息」；报告输出统一脱敏 private key、PSK、密码和 BLE PIN，避免原始 CLI/BLE 输出落盘泄露。
- 已验证：`node --check tests\meshtastic_cli_dashboard\app.js`、`python -m py_compile tests\meshtastic_cli_demo\runner.py tests\meshtastic_cli_dashboard\server.py`、15 条/101 步 JSON 语料解析、2 条新增回归 dry-run、MeshCore 拒绝和脱敏单元检查均通过。未连接真实串口或 BLE 设备，未做实机 PASS 声明。
