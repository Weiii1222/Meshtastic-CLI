# Meshtastic 固件测试执行台：本地运行指南

## 适用范围

本指南用于在其他 Windows 电脑启动 Meshtastic 固件测试执行台。平台支持串口回归与单设备 BLE 验证；MeshCore 当前仍为规划能力，不应作为已支持功能使用。

## 前置条件

- Windows 10/11。
- Python 3.10 或更高版本，安装时勾选加入 PATH。
- Git。
- 真实串口测试需要目标设备 USB 驱动、可识别的 COM 口和未被占用的设备。
- BLE 测试使用支持 Web Bluetooth 的浏览器；当前一次只连接一台同类 Meshtastic 设备。

## 安装与启动

运行环境：Windows / PowerShell。

执行前置操作：关闭占用设备的手机 App、串口终端和其他 Meshtastic 工具；确认有仓库访问权限。

```powershell
# 克隆项目
git clone https://github.com/Weiii1222/Meshtastic-test-platform.git
cd Meshtastic-test-platform

# 创建隔离环境并安装 Meshtastic 官方 Python CLI
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install meshtastic

# 启动本地测试台
.\start_dashboard.ps1
```

执行：在浏览器打开 `http://127.0.0.1:8765`。

预期：页面顶部显示“服务正常”。首次使用先扫描串口或连接单台 BLE 设备，然后运行“测试前检查”。

## 首次验证

运行环境：Windows / PowerShell；在项目根目录执行。

```powershell
# 后端与执行器语法检查
.\.venv\Scripts\python.exe -m py_compile tests\meshtastic_cli_demo\runner.py tests\meshtastic_cli_dashboard\server.py

# 不接设备的 dry-run；不传 --execute 不会操作设备
.\.venv\Scripts\python.exe tests\meshtastic_cli_demo\runner.py --port COM7 --peer-port COM8 --case MT-PRECHECK-CLI
```

预期：语法检查无输出；执行器报告状态为 `DRY_RUN` 或 `SKIPPED`，只生成计划或报告，不表示真实设备通过。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 页面无法打开 | 确认 PowerShell 窗口未关闭；重新执行 `./start_dashboard.ps1`。 |
| 找不到 `.venv\Scripts\python.exe` | 在项目根目录重新执行 `python -m venv .venv`。 |
| 串口不可用 | 关闭其他串口工具和手机 App；重新扫描，确认设备重启后 COM 口没有变化。 |
| BLE 连接失败 | 只保留一台同类设备的 BLE 连接；断开其他手机/电脑的连接后重新扫描。 |
| 写入后读到旧配置 | 增大页面中的写入后等待时长，再执行读回。 |
