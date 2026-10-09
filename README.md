# Meshtastic 固件测试执行台

> 面向 Meshtastic 固件设备的本地测试执行台，用于把可重复、可客观判定的配置检查、通信回归和证据留存沉淀为可执行测试项。

[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4)](#本地启动)
[![Python](https://img.shields.io/badge/python-3.10%2B-3776AB)](#本地启动)
[![Transport](https://img.shields.io/badge/transport-Serial%20%7C%20BLE-14764F)](#能力范围)
[![Status](https://img.shields.io/badge/MeshCore-规划中-A36818)](#能力范围)

## 平台定位

- **Meshtastic**：当前已开放的测试执行能力。
- **MeshCore**：仅为后续规划入口，当前不作为已支持功能。
- **Wio Tracker L2**：当前试点设备，不是平台的设备边界。
- **使用方式**：初次体验、手机 App 交互和复杂异常由人工验证；稳定、重复的回归项由平台执行并自动留证。

## 能力范围

| 场景 | 支持内容 | 说明 |
| --- | --- | --- |
| 串口回归 | 多设备配置、联系人互识、角色与通信回归、原始日志监听 | 适合受控的多设备回归和问题复现 |
| BLE 验证 | 单设备连接、配置读写与读回、持续收发、长连接检查 | 模拟用户连接设备后的链路；本机一次仅支持一台同类设备 |
| 测试项与报告 | 按模块或单条运行、步骤级判定、JSON 报告 | 报告保留命令、读回值、输出、判据和失败原因 |
| 效果对比 | 9 个测试环节的手工方式与平台方式对照 | 见 [SIP 提效案例](docs/SIP_提效案例_Meshtastic固件测试执行台.md) 第 6.1 节 |

关键原则：配置操作采用“**先读、必要时写、等待、读回**”；通信结果需有接收、ACK 或设备可见证据，不能仅以命令返回成功判定通过。

## 技术基础

- **官方 Meshtastic Python CLI**（`meshtastic` 2.7.11，官方仓库 `meshtastic/python`）：串口回归的全部操作与 BLE 测试项的批量执行都通过它完成（BLE 走 CLI 的 `--ble` 通道）。
- **官方 protobuf 定义**（官方仓库 `meshtastic/protobufs`）：配置字段与角色 / 区域 / 时区枚举的语义基准；页面内 BLE 直连（连接、配置读写、持续收发、长连接检查）按这套定义构造报文，经浏览器 Web Bluetooth 与设备通信，不引入私有协议。
- **官方固件源码**（官方仓库 `meshtastic/firmware`）：固件行为结论的依据，例如角色默认配置、深睡逻辑与周期上报间隔。
- 平台不修改官方包：唯一的一层本地包装只调整串口打开时的 DTR/RTS 与可选的 BLE 配对参数，避免读命令触发设备复位。

## 本地启动

完整环境准备、设备前置条件、首次验证和常见问题见 [本地运行指南](docs/Meshtastic固件测试执行台_本地运行指南.md)。以下仅保留最短启动路径。

运行环境：Windows 10/11、PowerShell、Python 3.10+、Git；真实串口测试还需要设备 USB 驱动。

执行前置操作：关闭占用设备的手机 App、串口终端或其他 Meshtastic 工具。

```powershell
# 克隆项目并安装官方 Meshtastic Python CLI
git clone https://github.com/Weiii1222/Meshtastic-test-platform.git
cd Meshtastic-test-platform
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install meshtastic

# 启动后访问 http://127.0.0.1:8765
.\start_dashboard.ps1
```

预期：页面顶部显示“服务正常”。真实设备测试前，先扫描串口或连接单台 BLE 设备，再运行“测试前检查”。

## 文档入口

| 文档 | 用途 |
| --- | --- |
| [本地运行指南](docs/Meshtastic固件测试执行台_本地运行指南.md) | 完整部署、首次验证与常见问题 |
| [控制台使用说明](tests/meshtastic_cli_dashboard/README.md) | 页面流程、报告与共享日志配置 |
| [自动化执行器说明](tests/meshtastic_cli_demo/README.md) | 命令行执行、dry-run 与测试项结构 |
| [自动化覆盖矩阵](docs/Wio_Tracker_L2_Meshtastic_CLI_自动化覆盖矩阵.md) | 当前测试项与人工测试边界 |
| [SIP 提效案例](docs/SIP_提效案例_Meshtastic固件测试执行台.md) | 平台定位、提效方案与素材建议 |

## 项目结构

```text
.
├── start_dashboard.ps1                 本地服务启动脚本
├── docs/                               使用指南、覆盖矩阵、SIP 案例与需求资料
├── logs/                               本地运行报告和日志（默认不提交）
└── tests/
    ├── meshtastic_cli_dashboard/       浏览器控制台：页面、API 与报告展示
    ├── meshtastic_cli_demo/            测试项执行器、JSON 用例与 CLI 包装
    └── meshcore_demo/                  MeshCore 预留目录，暂未支持执行
```

## 测试项

测试项定义位于 [`tests/meshtastic_cli_demo/cases_l2_demo.json`](tests/meshtastic_cli_demo/cases_l2_demo.json)。当前覆盖测试前检查、可选取证、设备角色、串口通信回归和 BLE 单设备验证。新增可重复测试点时，优先补充 JSON 测试项和判据，而不是修改页面逻辑。

命令行默认 **dry-run**，只有显式传入 `--execute --allow-mutating` 才会写设备配置或发送消息；Dashboard 则按受控流程执行设备操作。

## 边界与状态

- 不替代射频、天线、功耗、结构等硬件专项测试。
- BLE 长连接检查验证单设备与本机浏览器的会话保持，不等同于双设备 BLE 通信或手机 App 端到端体验。
- 平台仍处于迭代优化阶段，可能存在尚未发现的使用问题与 bug。异常结论应保留报告与日志，并由测试人员人工复核。

## 验证

运行环境：Windows / PowerShell；在项目根目录执行，已创建 `.venv`。

```powershell
# 语法检查：无输出即通过
.\.venv\Scripts\python.exe -m py_compile tests\meshtastic_cli_demo\runner.py tests\meshtastic_cli_dashboard\server.py

# 不操作设备的 dry-run
.\.venv\Scripts\python.exe tests\meshtastic_cli_demo\runner.py --port COM7 --peer-port COM8 --case MT-PRECHECK-CLI
```

预期：dry-run 仅生成计划或报告，不代表真实硬件通过。

## 仓库

[Weiii1222/Meshtastic-test-platform](https://github.com/Weiii1222/Meshtastic-test-platform)
