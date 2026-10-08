# Mesh 测试控制台 · Wio Tracker L2 Meshtastic CLI Test Console

> 把 Mesh 固件（Meshtastic / MeshCore）里大量重复、等待时间长的 CLI 手工检查，变成「勾选用例 → 一键运行 → 拿到带证据的 JSON 报告」的本地控制台。
>
> A local, dependency-light web console that turns repetitive Meshtastic CLI checks into one-click, evidence-backed test runs.

![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4)
![Python](https://img.shields.io/badge/python-3.10%2B-3776AB)
![Frontend](https://img.shields.io/badge/frontend-vanilla%20JS%20%2B%20CSS-F7DF1E)
![Transport](https://img.shields.io/badge/transport-serial%20%7C%20BLE-14764F)
![Status](https://img.shields.io/badge/status-active%20development-A36818)

---

## 目录

- [背景与目标](#背景与目标)
- [功能特性](#功能特性)
- [架构](#架构)
- [快速开始](#快速开始)
- [使用指南](#使用指南)
- [配置](#配置)
- [用例语料](#用例语料)
- [覆盖范围](#覆盖范围)
- [设计约定](#设计约定)
- [注意事项](#注意事项)
- [故障排查](#故障排查)
- [开发与验证](#开发与验证)
- [路线图](#路线图)
- [许可](#许可)

---

## 背景与目标

Wio Tracker L2（ESP32-S3 + SX1262）的固件验证要先落到 Meshtastic CLI：读配置、改角色、等重启、读回、再抓空口包确认行为。手工做一轮回归有四个固定痛点：

| 痛点 | 具体表现 |
| --- | --- |
| 重复劳动多 | 同一批命令每个版本重敲一遍，角色/连接方式不同还要各敲一遍 |
| 等待时间长 | 改配置后要等设备重启，位置/中继类用例要等广播周期，人是干等 |
| 证据不可追溯 | 靠截图和手抄，事后无法回答「当时读回值到底是多少」 |
| 上手成本高 | 参数多（`--ch-index`、`--set`、`--get`、BLE 目标名），新人容易敲错 |

**目标**：把可自动化的 CLI 用例做成可视化控制台 —— 用例以数据描述、执行过程留证、失败原因写成人话，跑一轮回归只需要一次点击。

**非目标**：不做固件编译/烧录，不替代硬件（射频、天线、功耗、结构）测试；本工具只覆盖 CLI 可观测、可校验的部分。

---

## 功能特性

| 能力 | 说明 |
| --- | --- |
| 用例即数据 | 用例写在 JSON 语料里（9 条 / 79 步），新增用例不改代码 |
| 双连接方式 | 串口（自动扫描 + USB 详情区分设备）与 BLE（单设备即可跑设备自身配置验证） |
| 多设备协同 | 测试设备 1（被测）／测试设备 2（对端）／测试设备 3（观察者，可选，串口） |
| 执行保护 | 默认 dry-run；真实执行、写配置/发消息需要分别二次勾选 |
| 读回校验 | 写配置前先读当前值，一致就跳过写入；写后等待再读回对比 |
| 证据留存 | 每步中文判据 + 失败原因，报告 JSON 落盘，页面可直接打开/下载 |
| 空口证据 | 监听窗口抓直收副本 / 中继副本 / `POSITION_APP` 等，作为证据记录 |
| 兼容 MeshCore | 侧边栏可切换 Meshtastic / MeshCore 测试系统，状态互相隔离 |
| 零外部依赖 | 后端只用 Python 标准库，前端为原生 HTML/CSS/JS，无构建步骤 |

---

## 架构

```text
浏览器（本地静态页 index.html / app.js / styles.css）
        │  fetch JSON API
        ▼
server.py（http.server，本机 127.0.0.1:8765）
        │  子进程
        ▼
tests/meshtastic_cli_demo/runner.py   用例执行引擎（读语料、跑步骤、判期望、出报告）
        │
        ▼
safe_meshtastic_cli.py                对 meshtastic CLI 的包装：避免 DTR 复位把设备打回 boot
        │
        ▼
.venv\Scripts\meshtastic.exe          Meshtastic 官方 CLI（串口 / --ble）
```

```text
Project_01_WioTrackerL2
├── start_dashboard.ps1              一键启动（先释放 8765 端口再拉起服务）
├── README.md                        本文件
├── DESIGN.md / PRODUCT.md / SNAPSHOT.md
├── docs/                            需求、覆盖矩阵、缺陷记录、原型文档
├── logs/                            JSON 报告与日志（默认落盘目录，已 gitignore）
├── project-background/              项目背景资料
└── tests/
    ├── meshtastic_cli_demo/
    │   ├── runner.py                用例执行引擎
    │   ├── safe_meshtastic_cli.py   CLI 包装（DTR 不复位）
    │   ├── cases_l2_demo.json       用例语料（9 条 / 79 步）
    │   └── build_coverage_matrix.py 覆盖矩阵生成
    ├── meshtastic_cli_dashboard/
    │   ├── server.py                本地 HTTP API + 静态文件服务
    │   ├── index.html / app.js / styles.css
    │   └── README.md                控制台自身的说明
    └── meshcore_demo/               MeshCore 模式执行器（可选）
```

---

## 快速开始

**运行环境**：Windows 10/11、Python 3.10+、已装 USB 串口驱动；测试设备建议 2 台（跑转发类角色用例需要 3 台，观察者可选）。

```powershell
git clone https://github.com/Weiii1222/Meshtastic-CLI.git
cd Meshtastic-CLI

# 1) 建虚拟环境并安装官方 CLI
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install meshtastic

# 2) 一条命令启动控制台（会先关闭占用 8765 端口的旧服务）
.\start_dashboard.ps1
```

打开 <http://127.0.0.1:8765> 即可。页面是静态文件，**改动前端后按 Ctrl+F5 强刷**；改过 `server.py` 需要重启服务。

---

## 使用指南

1. **选测试系统**：侧边栏切换 Meshtastic / MeshCore（切换会清空上一模式的扫描结果、报告与设备状态）。
2. **接设备**：串口模式点「扫描串口」，按 USB 详情把具体设备对应到 `COMx`；蓝牙模式扫描 BLE 设备名/地址。同一个串口不能同时分配给两台设备。
3. **跑前置检查**：确认 CLI 可用、设备身份（节点 ID）、公私钥字段、通信关键配置、NodeDB 互识关系。读到的节点 ID 会用于后续设备名展示。
4. **跑测试项**：按模块勾选用例（单条 ▶ / 整模块 / 全选），点「运行选中」。
5. **改配置**：在「配置写入」里选目标设备、配置项、值，点「下发并检查」（先读后写，写后等待再读回校验）。
6. **通信验证**：按需勾选 Region / Modem Preset / Frequency Override 一起下发，或不勾选直接跑双向消息；支持发到频道或发给指定节点。
7. **看结果**：进度区显示当前步骤；结果卡片显示读回值、双向 ACK、NodeDB 检查；失败步骤会带上中文原因与处理建议。
8. **留证据**：在「报告记录」里打开或下载 JSON 报告（含每步命令、stdout/stderr、判据、监听副本统计）。

---

## 配置

### 启动与环境变量

| 项 | 默认值 | 说明 |
| --- | --- | --- |
| 服务端口 | `8765` | `start_dashboard.ps1` 启动前会释放该端口 |
| 报告目录 | `<repo>\logs` | 用 `MESHTASTIC_DASHBOARD_LOG_DIR` 指向共享目录可多人汇总 |
| CLI 路径 | `<repo>\.venv\Scripts\meshtastic.exe` | 由执行引擎自动解析虚拟环境 |
| 健康检查 | `GET /api/health` | 返回实际 `logsDir`、服务状态 |

```powershell
# 把报告写到共享目录（团队汇总用）
$env:MESHTASTIC_DASHBOARD_LOG_DIR = "D:\WioTrackerL2_TestReports"
.\start_dashboard.ps1
```

### 页面可写配置项

用户名称、区域、调制预设、频道（索引 / 名称 / PSK）、设备角色、时区、WiFi、GPS 开关、蓝牙开关、设备语言、频率覆盖。
`Language` 在部分 CLI 版本未暴露可写字段，页面保留为人工项提示；枚举值读回时会转成人可读文本（如 `lora.region=1` → `US`、`device.role=0` → `CLIENT`）。

### 运行参数

| 参数 | 作用 |
| --- | --- |
| 真实执行 | 关闭时只做 dry-run，打印将要执行的命令 |
| 允许改配置 / 发消息 | 写操作的二次开关，未勾选时写类步骤会被拦截 |
| 写入后等待时长（秒） | 写配置后等待设备重启/重新枚举的时间 |
| 收信等待秒数 | 通信验证的收信窗口 |
| 观察者（测试设备 3） | 展开后接入，角色类用例优先用它做长时间监听 |

---

## 用例语料

语料：`tests/meshtastic_cli_demo/cases_l2_demo.json`。用例是数据，不是代码：

```json
{
  "id": "L2-ROLE-TRACKER",
  "module": "设备角色验证",
  "required_devices": 2,
  "device_note": "最少 2 台：测试设备1（被测角色设备）（深睡时串口会掉线）+ 测试设备2（当监听端）。",
  "steps": [
    {
      "name": "写角色 TRACKER",
      "target": "primary",
      "command": ["--set", "device.role", "TRACKER"],
      "mutating": true,
      "requires_connection": true,
      "readback_fields": ["device.role"],
      "pass_criteria": "写命令返回成功，随后读回 device.role 应为 TRACKER(5)。"
    }
  ]
}
```

步骤常用字段：

| 字段 | 含义 |
| --- | --- |
| `target` | `primary`（测试设备 1）/ `peer`（测试设备 2）/ `observer`（测试设备 3） |
| `requires_connection` / `requires_peer` / `requires_observer` | 依赖裁剪：不满足时该步骤自动跳过并在报告里标记 |
| `mutating` | 写操作，未开「允许改配置」时会被拦截 |
| `readback_fields` / `readback_value(s)` | 写后读回校验的具体字段与期望值 |
| `expect_stdout_regex` / `_any` / `fail_on_regex` | 输出期望（全部命中 / 任一命中 / 命中即失败） |
| `listen_send` + `listen_expect_relayed` / `listen_expect_portnum` | 发一条消息并监听空口副本，判定是否被中继、端口号是否符合预期 |
| `listen_evidence_only` | 只记录证据、不作为 PASS/FAIL 判据（例如深睡角色的位置包） |
| `sleep_sec` / `timeout` / `retries` / `retry_delay_sec` | 等待、超时与重试（重试只作用于命令失败，不掩盖判据不符） |
| `conditional_set_pairs` / `change_group` | 条件写：只在需要变化时才下发，避免无意义写操作 |

新增一条用例：复制一个 `steps` 结构 → 填命令与判据 → 放到对应模块。**不需要改任何 Python/JS 代码。**

---

## 覆盖范围

当前语料：**9 条用例 / 79 个步骤 / 4 个模块 / 2 种连接方式**。

| 用例 | 模块 | 连接 | 设备数 | 步骤 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `L2-CLI-001` | 测试前检查 | 串口 | 1 | 1 | CLI 可用性与版本 |
| `L2-CLI-002` | 测试前检查 | 串口 | 2 | 8 | 设备身份、公私钥、通信配置、NodeDB 互识 |
| `L2-CLI-004` | 可选取证 | 串口 | 1 | 1 | 配置快照取证 |
| `L2-CLI-005` | 可选取证 | 串口 | 1 | 1 | 节点信息取证 |
| `L2-ROLE-CLIENT` | 设备角色验证 | 串口 | 3 | 11 | 写角色 + 双向消息 + 中继副本监听 |
| `L2-ROLE-CLIENT-MUTE` | 设备角色验证 | 串口 | 3 | 11 | 同上，验证「不转发」行为 |
| `L2-ROLE-TRACKER` | 设备角色验证 | 串口 | 2 | 11 | 固定位置 + 角色写回 + 深睡行为取证 |
| `L2-ROLE-LOST-FOUND` | 设备角色验证 | 串口 | 2 | 9 | 定位广播周期断言（330 s 窗口） |
| `L2-BLE-TZ-CHECK` | BLE 设备验证 | BLE | 1 | 26 | 7 个 `US/*` 时区别名逐个写入 + 重启读回 + 回滚 |

---

## 设计约定

- **默认安全**：不勾「真实执行」只做 dry-run；写操作还要再勾「允许改配置 / 发消息」。
- **不制造假 PASS**：命令成功 ≠ 用例通过。读回值不符、监听窗口里没看到预期副本，都会判 FAIL 并写明原因；证据型步骤（如深睡角色的位置包）只记录流量，不参与判定。
- **先读后写**：写配置前先读当前值，一致则跳过写入，减少对设备的扰动。
- **失败要能定位**：失败原因写成人话（例：端口打不开会提示「TRACKER 类角色发完位置后会按 `position_broadcast_secs` 深睡，睡眠期间 USB-CDC 断电、串口会消失，等设备唤醒后重跑」）。
- **CLI 包装**：`safe_meshtastic_cli.py` 关闭 DTR 复位，避免每次开串口都把设备打回 boot 导致用例随机失败。

---

## 注意事项

1. **TRACKER 会深睡、串口会掉线**：固件在 TRACKER 角色下发完位置后会按 `position.position_broadcast_secs`（默认 3600 s）进入深睡，期间 USB-CDC 与射频一起断电。
   → 用例不写小这个值（那等于改变被测行为），位置包只作证据；要观测周期上报需要等一个完整唤醒周期，或先按键唤醒设备。
2. **`telemetry.device_update_interval = 2147483647` 是哨兵值**：等于固件里的 `MAX_INTERVAL`（`INT32_MAX`，约 68 年），语义是「不做周期性上报」，单位虽然是秒但不能按真实间隔理解。
3. **BLE 单设备无法验证设备时钟精度**：蓝牙用例只断言时区定义（`device.tzdef`）写入与重启读回；时间精度需要第二台设备发消息、再看收包时间戳（`rx_time`）。
4. **区域/预设一致 ≠ 频道密钥一致**：监听类用例观测不到包时，先核对两台设备的频道 PSK，再怀疑距离与天线。
5. **写配置后的等待要覆盖重启**：默认等待 10 s，设备重启慢时请调大，否则读回会读到旧值或直接失败。
6. **报告含原始输出**：JSON 报告里保留 CLI 的 stdout/stderr 与公私钥相关字段，外发前请自行脱敏。

---

## 故障排查

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 页面提示「后端服务没有响应」 | 服务没起或端口被占 | 在项目目录执行 `.\start_dashboard.ps1`，再强刷页面 |
| 串口列表里少了一台设备 | 设备深睡 / 线松 / 掉电 | 唤醒或重新上电；确认端口号是否变化（设备重新枚举后可能是新 `COMx`） |
| 写配置成功但读回是旧值 | 等待时间不足，设备还在重启 | 调大「写入后等待时长（秒）」后重跑 |
| BLE 连接中途失败 | 设备重启后 BLE 掉线 | 重连同一台设备再跑；报告里失败步骤的原始错误可确认原因 |
| 监听窗口内看不到包 | 频道 PSK / 距离 / 天线 / 角色不该转发 | 先核对 PSK 与区域预设，再看是否属于用例预期的「不转发」行为 |
| 中文显示成乱码 | Windows 控制台编码 | 服务端已固定 UTF-8；如仍异常，检查终端与页面是否都按 UTF-8 显示 |

---

## 开发与验证

```powershell
# 语法自检
.\.venv\Scripts\python.exe -m py_compile tests\meshtastic_cli_demo\runner.py tests\meshtastic_cli_dashboard\server.py
node --check tests\meshtastic_cli_dashboard\app.js

# 干跑一条用例（不碰设备：不勾真实执行时只打印命令）
.\.venv\Scripts\python.exe tests\meshtastic_cli_demo\runner.py `
  --cases tests\meshtastic_cli_demo\cases_l2_demo.json `
  --port COM7 --peer-port COM8 --case L2-ROLE-TRACKER
```

约定：

- 前端是静态文件，改动后强刷即可；`server.py` 改动需要重启服务。
- 提交信息用「动词 + 对象」的短句（如 `Add BLE timezone case and device-count tips`），一次提交只做一件事。
- 用例语料的改动要能回答一个问题：**这条判据为什么足以证明行为正确？** 不足以证明的就降级为证据记录。

---

## 路线图

- [ ] 补齐真机回归：BLE 时区用例、角色用例（TRACKER / LOST_AND_FOUND）在真机上完整跑通
- [ ] 把语料跑成 CI 化回归（每周定时 + 版本发布前触发）
- [ ] 多产品复用：把设备名、端口、语料抽成产品配置，换产品只换配置
- [ ] 报告汇总：把共享目录里的 JSON 报告汇总成趋势（通过率、失败原因分布）

---

## 许可

本仓库为公司内部测试工具，目前未声明开源许可（默认保留所有权利）。如需对外开源，请补充一份 `LICENSE`。

CLI 依赖 [meshtastic](https://github.com/meshtastic/python) 官方 Python 包，固件行为结论参考 [meshtastic/firmware](https://github.com/meshtastic/firmware) 与 [meshtastic/protobufs](https://github.com/meshtastic/protobufs)。