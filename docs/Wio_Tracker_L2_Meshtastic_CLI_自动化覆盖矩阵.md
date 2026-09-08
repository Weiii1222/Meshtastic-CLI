# Wio Tracker L2 Meshtastic CLI 自动化覆盖矩阵

本文按结构化测试用例判断 Meshtastic CLI 可覆盖范围。Excel 中的截图仅作为测试证据，不参与自动化分类。

## 汇总

| 类型 | 数量 | 含义 |
|---|---:|---|
| auto | 45 | CLI 可以直接执行并形成主要判定证据 |
| assisted | 68 | CLI 可以准备、读取或记录证据，但最终仍需人工/外部观察 |
| manual | 58 | 当前缺少稳定 CLI 信号，仍以人工测试为主 |

## 按功能模块统计

| 功能 | auto | assisted | manual |
|---|---:|---:|---:|
| GPS | 1 | 0 | 0 |
| LoRa通信 | 21 | 0 | 0 |
| SD卡 | 0 | 1 | 1 |
| Tools | 0 | 4 | 1 |
| Type-C | 1 | 1 | 0 |
| WiFi | 1 | 0 | 0 |
| 主界面 | 0 | 17 | 14 |
| 地图 | 0 | 1 | 2 |
| 手机APP | 0 | 10 | 2 |
| 扬声器 | 0 | 0 | 1 |
| 指示灯 | 0 | 0 | 2 |
| 按键 | 0 | 1 | 8 |
| 模式切换 | 2 | 2 | 2 |
| 消息 | 0 | 1 | 2 |
| 烧录 | 0 | 0 | 3 |
| 网页端 | 2 | 2 | 1 |
| 节点列表 | 0 | 20 | 0 |
| 蓝牙 | 0 | 1 | 0 |
| 设置 | 16 | 3 | 19 |
| 频道 | 1 | 4 | 0 |

## 优先自动化方向

1. 连接与设备信息：串口/TCP/BLE 连接、`--info`、固件和硬件型号读取。
2. 配置读取：Role、Region、Modem Preset、TX、GPS、WiFi、MQTT、Bluetooth、Channel。
3. 安全写入：Owner、Device Role、Modem Preset、Channel/Region 等，必须保留写入开关和回滚/读回校验。
4. 双机通信：读取辅助设备节点 ID，由主设备发送消息并等待 ACK。
5. 日志辅助：Packet Log、Tracker/Client/Client Mute 行为通过 `--seriallog` 或日志文件辅助判断。

## 仍需人工或外部设备的范围

- 屏幕点击、长按、页面跳转、横幅通知、声音、按钮手感、SD 卡、地图路线、手机 App 视觉确认。
- GPS 坐标精度可以由 CLI 读取位置，但“与手机 GPS 偏差不超过 10 米”需要外部参考坐标。
- 烧录流程可以半自动记录工具输出，但进入 boot 模式、Flash Download Tool 操作和屏幕确认仍需人工。

## 明细

| 行号 | 功能 | 用例名称 | 覆盖 | 标签 | 原因 |
|---:|---|---|---|---|---|
| 2 | 烧录 | Web Flasher 网页烧录 | manual | flashing_ui, screen_interaction | Requires physical UI tap/long press and screen observation. Requires browser flashing flow. |
| 3 | 烧录 | Flash Download Tool 烧录 | manual | flashing_ui, screen_interaction | Requires physical UI tap/long press and screen observation. Requires Windows flashing tool and boot-mode operation. |
| 4 | 烧录 | Flash Download Tool 全片擦除并重新烧录 | manual | flashing_ui, screen_interaction | Requires physical UI tap/long press and screen observation. Requires Windows flashing tool and boot-mode operation. |
| 5 | 主界面 | New Message-无新消息时点击跳转 | manual | screen_interaction, visual_check | Requires physical UI tap/long press and screen observation. Requires screen, sound, map, or app observation. |
| 6 | 主界面 | New Message-有新消息时点击跳转 | manual | screen_interaction, visual_check | Requires physical UI tap/long press and screen observation. Requires screen, sound, map, or app observation. |
| 7 | 主界面 | 在线节点数-点击跳转及一致性 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Meshtastic CLI can read NodeDB with --nodes; UI count still needs manual screen confirmation. Requires physical UI tap/long press and screen observation. Requires screen, sound, map, or app observation. |
| 8 | 主界面 | 日期和时间-点击切换Uptime | manual | screen_interaction, visual_check | Requires physical UI tap/long press and screen observation. Requires screen, sound, map, or app observation. |
| 9 | 主界面 | 无线电-显示LoRa频段 | assisted | region, visual_check | Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Requires screen, sound, map, or app observation. |
| 10 | 主界面 | 无线电-长按切换TX开关 | manual | screen_interaction, visual_check | Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 11 | 主界面 | 信号强度显示 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 12 | 主界面 | 消息提醒-Banner & Sound模式 | manual | audio_check, screen_interaction, visual_check | Requires physical UI tap/long press and screen observation. Requires screen, sound, map, or app observation. |
| 13 | 主界面 | 消息提醒-Sound only模式 | manual | audio_check, visual_check | Requires screen, sound, map, or app observation. Requires audio observation. |
| 14 | 主界面 | 消息提醒-Banner only模式 | manual | audio_check, screen_interaction, visual_check | Requires physical UI tap/long press and screen observation. Requires screen, sound, map, or app observation. |
| 15 | 主界面 | GPS-显示经纬度-公司 | assisted | gps_position, visual_check | Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference. Requires screen, sound, map, or app observation. |
| 16 | 主界面 | GPS-显示经纬度-公司外地点1 | assisted | gps_position, visual_check | Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference. Requires screen, sound, map, or app observation. |
| 17 | 主界面 | GPS-显示经纬度-公司外地点2 | assisted | gps_position, visual_check | Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference. Requires screen, sound, map, or app observation. |
| 18 | 主界面 | GPS-显示经纬度-公司外地点3 | assisted | gps_position, visual_check | Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference. Requires screen, sound, map, or app observation. |
| 19 | 主界面 | GPS-显示经纬度-家里 | assisted | gps_position, visual_check | Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference. Requires screen, sound, map, or app observation. |
| 20 | 主界面 | GPS-长按切换开关 | assisted | gps_position, screen_interaction, visual_check | Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 21 | 主界面 | WiFi-显示连接状态和IP | assisted | visual_check, wifi_config | Meshtastic CLI supports network.wifi_enabled, network.wifi_ssid, and network.wifi_psk. Requires screen, sound, map, or app observation. |
| 22 | 主界面 | WiFi-长按配置SSID和密码 | assisted | screen_interaction, wifi_config | Meshtastic CLI supports network.wifi_enabled, network.wifi_ssid, and network.wifi_psk. Requires physical UI long press and screen observation. |
| 23 | 主界面 | msh/频段-长按 | assisted | region, screen_interaction, visual_check | Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 24 | 主界面 | SD卡状态显示 | manual | sd_card, visual_check | Requires screen, sound, map, or app observation. Requires physical SD card insertion/removal. |
| 25 | 主界面 | 设备识别码显示 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 26 | 主界面 | 无线电-单击进入Radio Settings | manual | visual_check | Requires screen, sound, map, or app observation. |
| 27 | 主界面 | 信号强度-单击查看详情 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 28 | 主界面 | 消息提醒-长按关闭所有通知 | manual | screen_interaction, visual_check | Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 29 | 主界面 | GPS-单击查看详细位置 | assisted | gps_position, visual_check | Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference. Requires screen, sound, map, or app observation. |
| 30 | 主界面 | WiFi-单击查看IP | assisted | visual_check, wifi_config | Meshtastic CLI supports network.wifi_enabled, network.wifi_ssid, and network.wifi_psk. Requires screen, sound, map, or app observation. |
| 31 | 主界面 | WiFi-长按切换WiFi开关 | assisted | screen_interaction, visual_check, wifi_config | Meshtastic CLI supports network.wifi_enabled, network.wifi_ssid, and network.wifi_psk. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 32 | 主界面 | msh/频段-单击查看MQTT配置 | assisted | mqtt_config, region, visual_check | Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports mqtt.enabled and MQTT config fields. Requires screen, sound, map, or app observation. |
| 33 | 主界面 | msh/频段-长按切换MQTT开关 | assisted | mqtt_config, region, screen_interaction, visual_check | Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports mqtt.enabled and MQTT config fields. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 34 | 主界面 | 占用率-单击切换显示/隐藏 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 35 | 主界面 | 长按主界面Home图标-Resync | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 36 | 节点列表 | 节点列表显示 | assisted | node_db, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires screen, sound, map, or app observation. |
| 37 | 节点列表 | 查看节点信息 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI tap/long press and screen observation. Requires screen, sound, map, or app observation. |
| 38 | 节点列表 | 查看节点位置-跳转地图 | assisted | map_check, node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI tap/long press and screen observation. Requires screen, sound, map, or app observation. |
| 39 | 节点列表 | 长按节点进入私聊并通信 | assisted | mesh_message, node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Meshtastic CLI can read NodeDB with --nodes; UI count still needs manual screen confirmation. Meshtastic CLI supports --sendtext and --ack. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 40 | 节点列表 | Filter-进入筛选页面 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 41 | 节点列表 | Filter-Unknown筛选 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 42 | 节点列表 | Filter-Offline筛选 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Meshtastic CLI can read NodeDB with --nodes; UI count still needs manual screen confirmation. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 43 | 节点列表 | Filter-Public Key筛选 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 44 | 节点列表 | Filter-Channel筛选 | assisted | channel, node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Meshtastic CLI supports channel get/set commands. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 45 | 节点列表 | Filter-Hops away筛选 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 46 | 节点列表 | Filter-Position筛选 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 47 | 节点列表 | Filter-Name筛选 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 48 | 节点列表 | Filter-全部条件开启 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 49 | 节点列表 | Highlight-进入高亮页面 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 50 | 节点列表 | Highlight-Active Chat高亮 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 51 | 节点列表 | Highlight-Position高亮 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 52 | 节点列表 | Highlight-Telemetry高亮 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 53 | 节点列表 | Highlight-IAQ高亮 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 54 | 节点列表 | Highlight-Name高亮 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 55 | 节点列表 | Highlight-全部条件开启 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 56 | 频道 | 频道列表显示 | assisted | channel, visual_check | Meshtastic CLI supports channel get/set commands. Requires screen, sound, map, or app observation. |
| 57 | 频道 | 公频通信 | assisted | channel, mesh_message, modem_preset, region, visual_check | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports --get/--set lora.region. Meshtastic CLI supports channel get/set commands. Requires screen, sound, map, or app observation. |
| 58 | 频道 | 配置私频 | auto | channel | Meshtastic CLI supports channel get/set commands. |
| 59 | 频道 | 私频通信 | assisted | channel, mesh_message, modem_preset, region, visual_check | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports --get/--set lora.region. Meshtastic CLI supports channel get/set commands. Requires screen, sound, map, or app observation. |
| 60 | 频道 | 关闭频道信息提醒 | assisted | channel, screen_interaction, visual_check | Meshtastic CLI supports channel get/set commands. Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 61 | 消息 | 发送和接收消息 | assisted | mesh_message, visual_check | Meshtastic CLI supports --sendtext and --ack. Requires screen, sound, map, or app observation. |
| 62 | 消息 | 未读消息-消息框红色标记 | manual | screen_interaction, visual_check | Requires physical UI tap/long press and screen observation. Requires screen, sound, map, or app observation. |
| 63 | 消息 | 删除信息框 | manual | screen_interaction | Requires physical UI long press and screen observation. |
| 64 | 地图 | 离线地图查看 | assisted | gps_position, map_check, sd_card, visual_check | Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference. Requires screen, sound, map, or app observation. Requires physical SD card insertion/removal. |
| 65 | 地图 | 界面元素交互 | manual | map_check, screen_interaction | Requires physical UI tap/long press and screen observation. Requires map/UI visual verification. |
| 66 | 地图 | 长按菜单栏地图icon-地图配置 | manual | map_check, screen_interaction, visual_check | Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 67 | 设置 | Username-修改Short Name和Long Name | auto | owner_config | Meshtastic CLI supports --set-owner and --set-owner-short. Meshtastic CLI supports --set-owner-short. Meshtastic CLI supports --set-owner. |
| 68 | 设置 | Channel-频道配置 | auto | channel | Meshtastic CLI supports channel get/set commands. |
| 69 | 设置 | Modem Preset-LONG FAST | auto | channel, mesh_message, modem_preset | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports channel get/set commands. Meshtastic CLI supports --sendtext and --ack. |
| 70 | 设置 | Modem Preset-LONG MODERATE | auto | channel, mesh_message, modem_preset | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports channel get/set commands. Meshtastic CLI supports --sendtext and --ack. |
| 71 | 设置 | Modem Preset-LONG SLOW | auto | channel, mesh_message, modem_preset | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports channel get/set commands. Meshtastic CLI supports --sendtext and --ack. |
| 72 | 设置 | Modem Preset-MEDIUM FAST | auto | channel, mesh_message, modem_preset | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports channel get/set commands. Meshtastic CLI supports --sendtext and --ack. |
| 73 | 设置 | Modem Preset-MEDIUM SLOW | auto | channel, mesh_message, modem_preset | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports channel get/set commands. Meshtastic CLI supports --sendtext and --ack. |
| 74 | 设置 | Modem Preset-SHORT FAST | auto | channel, mesh_message, modem_preset | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports channel get/set commands. Meshtastic CLI supports --sendtext and --ack. |
| 75 | 设置 | Modem Preset-SHORT SLOW | auto | channel, mesh_message, modem_preset | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports channel get/set commands. Meshtastic CLI supports --sendtext and --ack. |
| 76 | 设置 | Device Role-Client | assisted | device_role, node_db, phone_app | Meshtastic CLI can read NodeDB with --nodes. Meshtastic CLI supports --get/--set device.role. Requires Android/iOS app operation. |
| 77 | 设置 | Device Role-Client Mute | auto | device_role | Meshtastic CLI supports --get/--set device.role. |
| 78 | 设置 | Device Role-Tracker | auto | device_role, gps_position | Meshtastic CLI supports --get/--set device.role. Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference. |
| 79 | 设置 | Device Role-Lost & Found | auto | device_role, node_db | Meshtastic CLI can read NodeDB with --nodes. Meshtastic CLI supports --get/--set device.role. |
| 80 | 设置 | WiFi-配置连接 | auto | wifi_config | Meshtastic CLI supports network.wifi_enabled, network.wifi_ssid, and network.wifi_psk. |
| 81 | 设置 | Screen Timeout-900s | manual |  | No stable Meshtastic CLI signal is available for this testcase yet. |
| 82 | 设置 | Screen Timeout-30s | manual |  | No stable Meshtastic CLI signal is available for this testcase yet. |
| 83 | 设置 | Lock-屏幕锁开关 | manual |  | No stable Meshtastic CLI signal is available for this testcase yet. |
| 84 | 设置 | Lock-设置锁开关 | manual |  | No stable Meshtastic CLI signal is available for this testcase yet. |
| 85 | 设置 | Lock-设置PIN码 | manual |  | No stable Meshtastic CLI signal is available for this testcase yet. |
| 86 | 设置 | Screen Brightness-亮度调节 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 87 | 设置 | Theme-黑白主题切换 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 88 | 设置 | Screen Calibration-屏幕校准 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 89 | 设置 | Message Alert-通知开关 | manual |  | No stable Meshtastic CLI signal is available for this testcase yet. |
| 90 | 设置 | Message Alert-提醒音-Default | manual | audio_check | Requires audio observation. |
| 91 | 设置 | Message Alert-提醒音-Note | manual | audio_check | Requires audio observation. |
| 92 | 设置 | Message Alert-提醒音-Beat | manual | audio_check | Requires audio observation. |
| 93 | 设置 | Message Alert-提醒音-Bulp | manual | audio_check | Requires audio observation. |
| 94 | 设置 | Message Alert-提醒音-TockTock | manual | audio_check | Requires audio observation. |
| 95 | 设置 | Language-英文切换 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 96 | 设置 | Language-日文切换 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 97 | 设置 | Language-德文切换 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 98 | 设置 | Configuration Reset-NodeDB Reset | auto | node_db, reset | Meshtastic CLI can read NodeDB with --nodes. Meshtastic CLI supports reset actions, but they are destructive and should stay gated. |
| 99 | 设置 | Configuration Reset-Factory Reset | auto | reset | Meshtastic CLI supports reset actions, but they are destructive and should stay gated. |
| 100 | 设置 | Configuration Reset-Clear Chat History | auto | reset | Meshtastic CLI supports reset actions, but they are destructive and should stay gated. |
| 101 | 设置 | Backup & Restore | assisted | config_snapshot, phone_app, screen_interaction | Meshtastic CLI can export/import configuration for assisted comparison. Requires physical UI tap/long press and screen observation. Requires Android/iOS app operation. |
| 102 | 设置 | Backup & Restore | assisted | config_snapshot, phone_app, screen_interaction | Meshtastic CLI can export/import configuration for assisted comparison. Requires physical UI tap/long press and screen observation. Requires Android/iOS app operation. |
| 103 | 设置 | Reboot | manual | screen_interaction | Requires physical UI tap/long press and screen observation. |
| 104 | 设置 | Shutdown | manual | screen_interaction | Requires physical UI tap/long press and screen observation. |
| 105 | Tools | Mesh Detector-探测活跃节点 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI tap/long press and screen observation. Requires screen, sound, map, or app observation. |
| 106 | Tools | Signal Scanner-信号扫描 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI tap/long press and screen observation. Requires screen, sound, map, or app observation. |
| 107 | Tools | Trace Route-路由追踪 | assisted | node_db, screen_interaction, visual_check | Meshtastic CLI can read NodeDB with --nodes. Requires physical UI tap/long press and screen observation. Requires screen, sound, map, or app observation. |
| 108 | Tools | Statistics-统计数据 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 109 | Tools | Packet Log-报文日志 | assisted | serial_log, visual_check | Meshtastic CLI supports --seriallog and --listen for log capture. Requires screen, sound, map, or app observation. |
| 110 | 模式切换 | 进入 Programming Mode | assisted | bluetooth_config, phone_app, screen_interaction, visual_check | Meshtastic CLI supports bluetooth.enabled and BLE scanning. Requires physical UI tap/long press and screen observation. Requires screen, sound, map, or app observation. |
| 111 | 模式切换 | 切换到 BaseUI | assisted | bluetooth_config, screen_interaction | Meshtastic CLI supports bluetooth.enabled and BLE scanning. Requires physical UI tap/long press and screen observation. Requires physical UI long press and screen observation. |
| 112 | 模式切换 | BaseUI信息收发-EU_868 | auto | region | Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. |
| 113 | 模式切换 | BaseUI信息收发-915MHz | auto | region | Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. |
| 114 | 模式切换 | BaseUI-稳定性验证 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 115 | 模式切换 | BaseUI-切换回MUI | manual | visual_check | Requires screen, sound, map, or app observation. |
| 116 | 按键 | PWR-开机 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 117 | 按键 | PWR-关机 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 118 | 按键 | WAKE-休眠 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 119 | 按键 | WAKE-唤醒 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 120 | 按键 | RST-复位 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 121 | 按键 | U/B-短按唤醒/休眠 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 122 | 按键 | U/B-短按返回/确认 | manual | screen_interaction, visual_check | Requires physical UI long press and screen observation. Requires screen, sound, map, or app observation. |
| 123 | 按键 | U/B-双击发送位置 | assisted | gps_position, screen_interaction, visual_check | Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference. Requires physical button interaction. Requires screen, sound, map, or app observation. |
| 124 | 按键 | Reset+U/B-进入升级模式 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 125 | 指示灯 | 心跳灯-开机状态 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 126 | 指示灯 | 指示灯-状态显示 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 127 | Type-C | Type-C充电 | assisted | serial_connection, visual_check | Meshtastic CLI can connect over serial and read device info. Requires screen, sound, map, or app observation. |
| 128 | Type-C | Type-C串口通信 | auto | serial_connection | Meshtastic CLI can connect over serial and read device info. |
| 129 | 扬声器 | 收到消息铃声 | manual | audio_check | Requires audio observation. |
| 130 | SD卡 | SD卡识别 | manual | sd_card | Requires physical SD card insertion/removal. |
| 131 | SD卡 | SD卡-离线地图 | assisted | gps_position, map_check, sd_card, visual_check | Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference. Requires screen, sound, map, or app observation. Requires physical SD card insertion/removal. |
| 132 | GPS | GPS定位 | auto | gps_position | Meshtastic CLI supports position fields and request-position; location accuracy still needs external reference. |
| 133 | 蓝牙 | 蓝牙连接手机APP | assisted | bluetooth_config, phone_app | Meshtastic CLI supports bluetooth.enabled and BLE scanning. Requires Android/iOS app operation. |
| 134 | WiFi | WiFi连接 | auto | wifi_config | Meshtastic CLI supports network.wifi_enabled, network.wifi_ssid, and network.wifi_psk. |
| 135 | LoRa通信 | L2 + X1 兼容性-EU_868 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports channel get/set commands. |
| 136 | LoRa通信 | L2 + X1 兼容性-US_915 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports channel get/set commands. |
| 137 | LoRa通信 | L2 + Wio Tracker L1 兼容性-EU_868 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports channel get/set commands. |
| 138 | LoRa通信 | L2 + Wio Tracker L1 兼容性-US_915 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports channel get/set commands. |
| 139 | LoRa通信 | L2 + T-deck 兼容性-EU_868 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports channel get/set commands. |
| 140 | LoRa通信 | L2 + T-deck 兼容性-US_915 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports channel get/set commands. |
| 141 | LoRa通信 | L2 + RAK 兼容性-EU_868 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports channel get/set commands. |
| 142 | LoRa通信 | L2 + RAK 兼容性-US_915 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports channel get/set commands. |
| 143 | LoRa通信 | L2 + T-LoRa Pager 兼容性-EU_868 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports channel get/set commands. |
| 144 | LoRa通信 | L2 + T-LoRa Pager 兼容性-US_915 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports channel get/set commands. |
| 145 | LoRa通信 | L2 + Cardputer Mesh Kit 兼容性-EU_868 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports channel get/set commands. |
| 146 | LoRa通信 | L2 + Cardputer Mesh Kit 兼容性-US_915 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports channel get/set commands. |
| 147 | LoRa通信 | Region切换-US频段通信 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports --get/--set lora.region. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. |
| 148 | LoRa通信 | Region切换-EU_868频段通信 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports --get/--set lora.region. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. |
| 149 | LoRa通信 | Region切换-JP频段通信 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports --get/--set lora.region. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. |
| 150 | LoRa通信 | Region切换-ANZ频段通信 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports --get/--set lora.region. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. |
| 151 | LoRa通信 | Region切换-KR频段通信 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports --get/--set lora.region. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. |
| 152 | LoRa通信 | Region切换-TW频段通信 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports --get/--set lora.region. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. |
| 153 | LoRa通信 | Region切换-RU频段通信 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports --get/--set lora.region. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. |
| 154 | LoRa通信 | Region切换-IN频段通信 | auto | channel, mesh_message, modem_preset, region | Meshtastic CLI supports LoRa preset commands and lora.modem_preset. Meshtastic CLI supports --get/--set lora.region. Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. |
| 155 | LoRa通信 | 频段切换-不同频段无法通信 | auto | mesh_message, region | Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Two Meshtastic CLI sessions can send text and wait for ACK. |
| 156 | 手机APP | 安卓-蓝牙连接 | assisted | bluetooth_config, phone_app | Meshtastic CLI supports bluetooth.enabled and BLE scanning. Requires Android/iOS app operation. Requires Android app operation. |
| 157 | 手机APP | 安卓-TCP连接 | assisted | phone_app, screen_interaction, wifi_config | Meshtastic CLI supports network.wifi_enabled, network.wifi_ssid, and network.wifi_psk. Requires physical UI tap/long press and screen observation. Requires Android/iOS app operation. |
| 158 | 手机APP | 安卓-APP通信-EU_868 | assisted | bluetooth_config, mesh_message, phone_app, region, visual_check | Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports bluetooth.enabled and BLE scanning. Meshtastic CLI supports --sendtext and --ack. Requires screen, sound, map, or app observation. Requires Android/iOS app operation. |
| 159 | 手机APP | 安卓-APP通信-915MHz | assisted | bluetooth_config, mesh_message, phone_app, region, visual_check | Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports bluetooth.enabled and BLE scanning. Meshtastic CLI supports --sendtext and --ack. Requires screen, sound, map, or app observation. Requires Android/iOS app operation. |
| 160 | 手机APP | 安卓-断连自动重连 | assisted | bluetooth_config, phone_app, visual_check | Meshtastic CLI supports bluetooth.enabled and BLE scanning. Requires screen, sound, map, or app observation. Requires Android/iOS app operation. |
| 161 | 手机APP | 安卓-关机后开机自动重连 | manual | phone_app, visual_check | Requires screen, sound, map, or app observation. Requires Android/iOS app operation. |
| 162 | 手机APP | iOS-蓝牙连接 | assisted | bluetooth_config, phone_app | Meshtastic CLI supports bluetooth.enabled and BLE scanning. Requires Android/iOS app operation. Requires iOS app operation. |
| 163 | 手机APP | iOS-TCP连接 | assisted | phone_app, screen_interaction, wifi_config | Meshtastic CLI supports network.wifi_enabled, network.wifi_ssid, and network.wifi_psk. Requires physical UI tap/long press and screen observation. Requires Android/iOS app operation. |
| 164 | 手机APP | iOS-APP通信-EU_868 | assisted | bluetooth_config, mesh_message, phone_app, region, visual_check | Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports bluetooth.enabled and BLE scanning. Meshtastic CLI supports --sendtext and --ack. Requires screen, sound, map, or app observation. Requires Android/iOS app operation. |
| 165 | 手机APP | iOS-APP通信-915MHz | assisted | bluetooth_config, mesh_message, phone_app, region, visual_check | Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports bluetooth.enabled and BLE scanning. Meshtastic CLI supports --sendtext and --ack. Requires screen, sound, map, or app observation. Requires Android/iOS app operation. |
| 166 | 手机APP | iOS-断连自动重连 | assisted | bluetooth_config, phone_app, visual_check | Meshtastic CLI supports bluetooth.enabled and BLE scanning. Requires screen, sound, map, or app observation. Requires Android/iOS app operation. |
| 167 | 手机APP | iOS-关机后开机自动重连 | manual | phone_app, visual_check | Requires screen, sound, map, or app observation. Requires Android/iOS app operation. |
| 168 | 网页端 | HTTP连接设备 | manual | visual_check | Requires screen, sound, map, or app observation. |
| 169 | 网页端 | 蓝牙连接设备 | auto | bluetooth_config | Meshtastic CLI supports bluetooth.enabled and BLE scanning. |
| 170 | 网页端 | 串口连接设备 | auto | serial_connection | Meshtastic CLI can connect over serial and read device info. |
| 171 | 网页端 | 网页端通信-EU_868 | assisted | mesh_message, region, visual_check | Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports --sendtext and --ack. Requires screen, sound, map, or app observation. |
| 172 | 网页端 | 网页端通信-915MHz | assisted | mesh_message, region, visual_check | Meshtastic CLI supports reading lora.region; screen display still needs manual confirmation. Meshtastic CLI supports --sendtext and --ack. Requires screen, sound, map, or app observation. |
