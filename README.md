# Meshtastic 固件测试执行台

> 面向 Meshtastic 固件设备的本地测试执行台。它将设备连接、配置读写、通信验证、串口日志和结构化报告集中到一个浏览器界面，帮助团队更高效地执行可重复的回归与问题复现。

[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4)](#快速开始)
[![Python](https://img.shields.io/badge/python-3.10%2B-3776AB)](#快速开始)
[![Transport](https://img.shields.io/badge/transport-Serial%20%7C%20BLE-14764F)](#核心能力)
[![Firmware](https://img.shields.io/badge/firmware-Meshtastic-14764F)](#项目定位)
[![MeshCore](https://img.shields.io/badge/MeshCore-规划中-A36818)](#项目定位)

## 项目定位

本项目是 **Meshtastic 固件测试执行台**，不是固件编译、烧录或射频专项测试工具。它重点处理连接设备后可重复、可观察、可留证的验证动作：

- 将高频配置操作收敛为“读取、必要时写入、等待、读回”的受控流程。
- 通过串口支持多设备准备、联系人互识和通信验证。
- 通过单设备 BLE 模拟用户连接设备后的读取、修改配置、收发与会话保持场景。
- 将步骤、命令、读回值、输出与失败原因写入本地 JSON 报告，便于复核与问题定位。

**MeshCore** 目前仅保留规划入口，不作为已支持功能。

## 核心能力

| 能力 | 说明 | 适用场景 |
| --- | --- | --- |
| 串口设备连接 | 扫描 COM 口、读取设备信息和当前配置 | 多设备准备、固件回归、问题复现 |
| 受控配置写入 | 先读当前值，仅在不一致时写入，等待后读回校验 | Region、Modem Preset、频道、角色等配置验证 |
| 联系人互识 | 让两台串口设备建立联系人信息 | 通信验证前置准备，替代重复的手工扫码操作 |
| 通信验证 | 执行配置一致性检查、频道或点对点消息验证 | 可重复的串口通信回归 |
| 单设备 BLE | 连接、读取配置、下发配置、持续收发和长连接检查 | 模拟用户通过 App/BLE 使用设备的链路 |
| 实时串口日志 | 选择串口和波特率后持续监听原始输出并落盘 | 重启、异常、无线收发和偶现问题取证 |
| 结构化报告 | 页面查看或下载 JSON 报告 | 版本对比、缺陷沟通、复现与追溯 |

## 快速开始

完整的环境准备、首次验证和常见问题见 [运行指南](docs/运行指南.md)。以下是最短启动路径。

运行环境：Windows 10/11、PowerShell、Python 3.10+、Git；使用串口时还需要设备 USB 驱动。

执行前置操作：关闭占用设备的手机 App、串口终端或其他 Meshtastic 工具。

```powershell
# 克隆并进入项目
git clone https://github.com/Weiii1222/Meshtastic-test-platform.git
cd Meshtastic-test-platform

# 创建隔离环境，安装官方 Meshtastic Python CLI
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install meshtastic

# 启动本地控制台，然后打开 http://127.0.0.1:8765
.\start_dashboard.ps1
```

预期：页面顶部显示“服务正常”。首次真实设备操作前，先扫描串口或连接一台 BLE 设备，再执行配置读取或测试前检查。

## 使用路径

```text
连接设备 → 读取当前状态 → 选择配置/通信操作 → 执行与读回 → 查看报告和日志 → 人工复核异常
```

1. **串口路径**：扫描设备，选择主设备/对端；需要时先建立联系人，再进行配置或通信验证。
2. **BLE 路径**：连接一台设备，读取或下发配置；使用持续收发与长连接检查观察会话稳定性。
3. **日志路径**：选择日志串口与波特率，开始监听；将关键时间点与报告中的失败步骤关联分析。
4. **报告路径**：在报告页打开或下载 JSON，查看每个步骤的命令、输出、读回值和判定原因。

详细页面操作请阅读 [使用说明](docs/使用说明.md)。

## 测试项与团队用例库

公开仓库**不包含**任何设备专属测试用例、客户数据或个人项目材料。平台本身仍可执行配置写入、通信验证、联系人互识、日志和 BLE 操作。

如团队需要在控制台加载自己的 JSON 测试项，可在启动前设置本地用例文件路径：

```powershell
# 用例文件保留在团队自己的受控目录，不会被写入本仓库
$env:MESHTASTIC_CASES_PATH = 'D:\TeamTestAssets\meshtastic-cases.json'
.\start_dashboard.ps1
```

未配置 `MESHTASTIC_CASES_PATH` 时，界面会明确提示未加载设备专属测试项，不会将空用例误判为通过。

## 架构

```text
浏览器
  │  本地 HTTP API
  ▼
src/dashboard/
  ├── server.py        本地服务、任务管理、报告和串口日志 API
  └── index.html/js/css 可视化控制台
  │  子进程调用
  ▼
src/executor/
  ├── runner.py        受控执行、步骤判定、报告生成
  └── safe_meshtastic_cli.py
        │
        ▼
官方 meshtastic Python CLI/API / Web Bluetooth GATT
```

平台不自行实现 Meshtastic Mesh 协议。串口交互使用官方 `meshtastic` Python CLI/API；浏览器 BLE 使用 Web Bluetooth 与 Meshtastic GATT 数据通道。

## 文档

| 文档 | 内容 |
| --- | --- |
| [运行指南](docs/运行指南.md) | 环境要求、安装、启动、首次验证和常见问题 |
| [使用说明](docs/使用说明.md) | 串口、BLE、日志、报告与本地用例库的操作方法 |

## 仓库结构

```text
.
├── assets/showcase/       对外展示截图
├── docs/                  运行指南与使用说明
├── src/
│   ├── dashboard/         本地 Web 控制台
│   └── executor/          Meshtastic 执行器与 CLI 包装
├── start_dashboard.ps1    Windows 一键启动脚本
└── README.md
```

## 边界与注意事项

- BLE 当前以**单设备**为边界；受本机蓝牙模块和浏览器 GATT 能力影响，不支持同时运行两台同类设备。
- BLE 长连接检查验证本机浏览器与单台设备的会话保持，不替代手机 App 端到端体验或双设备 BLE 通信验证。
- 平台不替代射频、天线、功耗、结构等硬件专项测试。
- 配置写入和发送消息会改变设备状态；执行前应确认测试设备、区域法规和团队操作规范。
- 平台仍处于迭代优化阶段，可能存在尚未发现的使用问题与 bug。涉及首次体验、复杂现场环境或异常结论时，应保留报告/日志并进行人工复核。

## 本地验证

运行环境：Windows / PowerShell；在项目根目录执行，已创建 `.venv`。

```powershell
# 语法检查
.\.venv\Scripts\python.exe -m py_compile src\executor\runner.py src\executor\safe_meshtastic_cli.py src\dashboard\server.py

# 前端语法检查（需要 Node.js）
node --check src\dashboard\app.js

# 不接设备的配置流程 dry-run，不会对设备写入
.\.venv\Scripts\python.exe src\executor\runner.py --custom-only --config-field device.role --config-value CLIENT
```

预期：语法检查无输出；dry-run 生成本地报告，但不代表真实设备通过。

## License

本仓库当前未声明开源许可；如需对外复用或发布，请在使用前联系仓库维护者确认权限。
