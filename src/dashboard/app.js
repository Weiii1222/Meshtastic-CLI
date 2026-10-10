const state = {
  modules: {},
  cases: [],
  caseCatalogNotice: '',
  ports: [],
  bleDevices: [],
  runs: [],
  running: false,
  clientRunStartedAt: 0,
  pollTimer: null,
  currentJobId: '',
  activeTargetType: '',
  connectedBleDeviceIds: { primary: '', peer: '' },
  deviceLabels: { primary: '\u6d4b\u8bd5\u8bbe\u59071', peer: '\u6d4b\u8bd5\u8bbe\u59072', both: '\u4e24\u53f0\u8bbe\u5907' },
  deviceNodeIds: { primary: '', peer: '' },
  deviceConfigs: { primary: {}, peer: {} },
  deviceSnapshots: { primary: null, peer: null },
  channels: { 0: '\u4e3b\u9891\u9053', 1: '\u9891\u9053 1' },
  channelSources: { 0: 'default', 1: 'default' },
  // 频道索引 -> 设备读回的 PSK（十六进制）。用于把「改 PSK」变成可读回比对的断言，
  // 而不是像以前那样在没有期望值时自动判 PASS。
  channelPsks: {},
  // 频道索引 -> 是否真的从设备读到过该频道的 settings（含 psk 字段的状态）。
  // 没有这条记录时，"没读到"不能被当成"值就是空"。
  channelPskKnown: {},
  pendingConfigPlan: null,
  resultFilter: '',
  serialLogId: '',
  serialLogTimer: null,
  // 最近一次进度面板数据：任务结束后要用它把面板改成终态，
  // 否则运行结束后仍显示「任务已提交，等待第一条进度 / 正在执行 Web BLE 操作」。
  lastProgressSummary: null,
  bleDevicesByRole: { primary: [], peer: [] },
  selectedBleDeviceIds: { primary: '', peer: '' },
  connectedBleDeviceId: '',
  systemMode: 'meshtastic',
  bleContinuous: {
    running: false,
    mode: '',
    timer: null,
    receiveTimer: null,
    sending: false,
    sent: 0,
    received: 0,
    failed: 0,
    startedAt: '',
    lastReceivedIndex: 0,
    records: [],
  },
  bleStabilityAbort: false,
};

const MESHTASTIC_BLE_SERVICE_UUID = '6ba1b218-15a8-461f-9fa8-5dcae273eafd';
const MESHTASTIC_TORADIO_UUID = 'f75c76d2-129e-4dad-a1dd-7866124401e7';
const MESHTASTIC_FROMRADIO_UUID = '2c55e69e-4993-11ed-b878-0242ac120002';
const MESHTASTIC_FROMNUM_UUID = 'ed9da18c-a800-4f66-a670-aa7547e34453';
const TEXT_MESSAGE_APP = 1;
const ADMIN_APP = 6;
const BROADCAST_NUM = 0xffffffff;
const DEFAULT_BLE_HOP_LIMIT = 3;
const MESH_PACKET_PRIORITY_RELIABLE = 70;
const BLE_CONFIG_NONCE = 69420;
const BLE_NODEDB_NONCE = 69421;

function randomBleConfigNonce() {
  return (Math.floor(Math.random() * 0x7ffffff0) + 1) >>> 0;
}
let bleHeartbeatNonce = 2;
const ADMIN_CONFIG_TYPES = {
  device: 0,
  position: 1,
  network: 3,
  lora: 5,
  bluetooth: 6,
};
const ADMIN_MODULE_CONFIG_TYPES = { mqtt: 0 };
const REGION_VALUES = {
  UNSET: 0, US: 1, EU_433: 2, EU_868: 3, CN: 4, JP: 5, ANZ: 6, KR: 7, TW: 8, RU: 9, IN: 10,
  NZ_865: 11, TH: 12, LORA_24: 13, UA_433: 14, UA_868: 15, MY_433: 16, MY_919: 17, SG_923: 18,
  PH_433: 19, PH_868: 20, PH_915: 21, ANZ_433: 22, KZ_433: 23, KZ_863: 24, NP_865: 25,
  BR_902: 26, ITU1_2M: 27, ITU2_2M: 28, EU_866: 29, EU_874: 30, EU_917: 31, EU_N_868: 32,
  ITU3_2M: 33,
};
const REGION_NAMES = Object.fromEntries(Object.entries(REGION_VALUES).map(([key, value]) => [value, key]));
const MODEM_VALUES = {
  LONG_FAST: 0, LONG_SLOW: 1, VERY_LONG_SLOW: 2, MEDIUM_SLOW: 3, MEDIUM_FAST: 4, SHORT_SLOW: 5,
  SHORT_FAST: 6, LONG_MODERATE: 7, SHORT_TURBO: 8, LONG_TURBO: 9, LITE_FAST: 10, LITE_SLOW: 11,
  NARROW_FAST: 12, NARROW_SLOW: 13,
};
const MODEM_NAMES = Object.fromEntries(Object.entries(MODEM_VALUES).map(([key, value]) => [value, key]));
// 常用时区：IANA 名称 -> POSIX TZ 字符串。取值来自 posix_tz_db 的 zones.csv
// （https://github.com/nayarsystems/posix_tz_db），保证与固件/系统 tzset 解析一致。
const TZ_ZONES = [
  { id: 'UTC', cn: '协调世界时', tz: 'UTC0' },
  // 亚洲
  { id: 'Asia/Shanghai', cn: '中国 上海', tz: 'CST-8' },
  { id: 'Asia/Hong_Kong', cn: '中国 香港', tz: 'HKT-8' },
  { id: 'Asia/Taipei', cn: '中国 台北', tz: 'CST-8' },
  { id: 'Asia/Tokyo', cn: '日本 东京', tz: 'JST-9' },
  { id: 'Asia/Seoul', cn: '韩国 首尔', tz: 'KST-9' },
  { id: 'Asia/Singapore', cn: '新加坡', tz: '<+08>-8' },
  { id: 'Asia/Bangkok', cn: '泰国 曼谷', tz: '<+07>-7' },
  { id: 'Asia/Jakarta', cn: '印尼 雅加达', tz: 'WIB-7' },
  { id: 'Asia/Kolkata', cn: '印度 加尔各答', tz: 'IST-5:30' },
  { id: 'Asia/Dubai', cn: '阿联酋 迪拜', tz: '<+04>-4' },
  // 欧洲
  { id: 'Europe/London', cn: '英国 伦敦', tz: 'GMT0BST,M3.5.0/1,M10.5.0' },
  { id: 'Europe/Paris', cn: '法国 巴黎', tz: 'CET-1CEST,M3.5.0,M10.5.0/3' },
  { id: 'Europe/Berlin', cn: '德国 柏林', tz: 'CET-1CEST,M3.5.0,M10.5.0/3' },
  { id: 'Europe/Madrid', cn: '西班牙 马德里', tz: 'CET-1CEST,M3.5.0,M10.5.0/3' },
  { id: 'Europe/Moscow', cn: '俄罗斯 莫斯科', tz: 'MSK-3' },
  { id: 'Europe/Istanbul', cn: '土耳其 伊斯坦布尔', tz: '<+03>-3' },
  // 北美（美国本土按常用顺序）；aka = IANA backward 旧名（US/*，与规范时区等价、共用同一 POSIX TZ）
  { id: 'America/New_York', cn: '美国 东部（纽约）', tz: 'EST5EDT,M3.2.0,M11.1.0', aka: 'US/Eastern' },
  { id: 'America/Chicago', cn: '美国 中部（芝加哥）', tz: 'CST6CDT,M3.2.0,M11.1.0', aka: 'US/Central' },
  { id: 'America/Denver', cn: '美国 山地（丹佛）', tz: 'MST7MDT,M3.2.0,M11.1.0', aka: 'US/Mountain' },
  { id: 'America/Phoenix', cn: '美国 亚利桑那（菲尼克斯，无夏令时）', tz: 'MST7', aka: 'US/Arizona' },
  { id: 'America/Los_Angeles', cn: '美国 太平洋（洛杉矶）', tz: 'PST8PDT,M3.2.0,M11.1.0', aka: 'US/Pacific' },
  { id: 'America/Anchorage', cn: '美国 阿拉斯加（安克雷奇）', tz: 'AKST9AKDT,M3.2.0,M11.1.0', aka: 'US/Alaska' },
  { id: 'Pacific/Honolulu', cn: '美国 夏威夷（檀香山）', tz: 'HST10', aka: 'US/Hawaii' },
  { id: 'America/Toronto', cn: '加拿大 多伦多', tz: 'EST5EDT,M3.2.0,M11.1.0' },
  { id: 'America/Vancouver', cn: '加拿大 温哥华', tz: 'PST8PDT,M3.2.0,M11.1.0' },
  { id: 'America/Mexico_City', cn: '墨西哥城', tz: 'CST6' },
  { id: 'America/Sao_Paulo', cn: '巴西 圣保罗', tz: '<-03>3' },
  { id: 'America/Bogota', cn: '哥伦比亚 波哥大', tz: '<-05>5' },
  // 大洋洲 / 非洲
  { id: 'Australia/Sydney', cn: '澳大利亚 悉尼', tz: 'AEST-10AEDT,M10.1.0,M4.1.0/3' },
  { id: 'Australia/Perth', cn: '澳大利亚 珀斯', tz: 'AWST-8' },
  { id: 'Pacific/Auckland', cn: '新西兰 奥克兰', tz: 'NZST-12NZDT,M9.5.0,M4.1.0/3' },
  { id: 'Africa/Cairo', cn: '埃及 开罗', tz: 'EET-2EEST,M4.5.5/0,M10.5.4/24' },
  { id: 'Africa/Johannesburg', cn: '南非 约翰内斯堡', tz: 'SAST-2' },
];

const TZ_CUSTOM_VALUE = '__custom__';

function tzZoneOptionHtml() {
  const zones = TZ_ZONES.map((zone) => `<option value="${escapeHtml(zone.tz)}">${escapeHtml(`${zone.cn} · ${zone.id}（${zone.tz}）`)}</option>`);
  // US/* 是 IANA backward 旧名，与规范时区完全等价（同一 POSIX TZ），单独列出来方便按旧名查找。
  const aliases = TZ_ZONES.filter((zone) => zone.aka)
    .map((zone) => `<option value="${escapeHtml(zone.tz)}">${escapeHtml(`${zone.cn} · ${zone.aka} 旧名（${zone.tz}）`)}</option>`);
  return zones.concat(aliases).join('')
    + `<option value="${TZ_CUSTOM_VALUE}">自定义（手动填写 POSIX TZ）</option>`;
}

function tzZoneValue() {
  const select = $('configValue');
  if (!select) return '';
  if (select.value !== TZ_CUSTOM_VALUE) return select.value;
  return ($('configTzCustom')?.value || '').trim();
}

// 已读回的时区能匹配到常用时区就选中它，否则落到"自定义"并回填原值。
function syncTzCustomField() {
  const select = $('configValue');
  const input = $('configTzCustom');
  if (!select || !input) return;
  const custom = select.value === TZ_CUSTOM_VALUE;
  input.classList.toggle('hidden', !custom);
  input.required = custom;
}

function applyKnownTimezoneToField(role) {
  const select = $('configValue');
  const input = $('configTzCustom');
  if (!select || !input || select.value === TZ_CUSTOM_VALUE && !input.value) return;
  const known = state.deviceConfigs[role]?.['device.tzdef'] || '';
  if (!known) return;
  const zone = TZ_ZONES.find((item) => item.tz === known);
  if (zone) select.value = zone.tz;
  else {
    select.value = TZ_CUSTOM_VALUE;
    input.value = known;
  }
  syncTzCustomField();
}

function validateTzField() {
  const box = $('configTzError');
  if (!box) return true;
  const select = $('configValue');
  let message = '';
  if (select?.value === TZ_CUSTOM_VALUE) {
    const value = ($('configTzCustom')?.value || '').trim();
    if (!value) message = '请填写 POSIX TZ 字符串，例如中国 CST-8、美国东部 EST5EDT,M3.2.0,M11.1.0。';
    else if (!/^[A-Za-z0-9_+\-:,./<>]+$/.test(value)) message = 'POSIX TZ 只能包含字母、数字与 + - : , . / < > 这些字符（不能有空格）。';
  }
  box.textContent = message;
  box.classList.toggle('hidden', !message);
  $('configTzCustom')?.classList.toggle('invalid', Boolean(message));
  return !message;
}

const DEVICE_ROLE_VALUES = {
  CLIENT: 0, CLIENT_MUTE: 1, ROUTER: 2, ROUTER_CLIENT: 3, REPEATER: 4, TRACKER: 5, SENSOR: 6,
  TAK: 7, CLIENT_HIDDEN: 8, LOST_AND_FOUND: 9, TAK_TRACKER: 10, ROUTER_LATE: 11, CLIENT_BASE: 12,
};
const DEVICE_ROLE_NAMES = Object.fromEntries(Object.entries(DEVICE_ROLE_VALUES).map(([key, value]) => [value, key]));
const browserBleDevices = new Map();
const browserBleTransports = new Map();
// role -> device.id：GATT 断开后浏览器仍然保留 device 句柄，记住它就能直接 device.gatt.connect()
// 自动重连，不必让用户重新走一次设备选择弹窗（配置写入后设备重启 BLE 的场景必须有这条路径）。
const browserBleLastDeviceIds = new Map();
const browserBleReconnectingRoles = new Set();
// device.id -> 人类可读的设备名。Chrome 的 BluetoothDevice.name 在离开广播后可能变成 null，
// 而 device.id 是浏览器随机生成的 128 位 base64（例如 9jiwGdHLNHGTcpL0ALghrQ==）；
// 一旦回退到 id 显示，界面上就会出现用户看到的"乱码"。名字在扫描时就记下来按 id 复用。
const browserBleDeviceNames = new Map();
let browserBleGattQueue = Promise.resolve();
const WEB_BLE_SINGLE_DEVICE_ONLY = true;
const WEB_BLE_ROLES = ['primary'];
const BLE_CONNECT_SETTLE_MS = 900;
const BLE_CONFIG_READ_TIMEOUT_SEC = 24;
const BLE_CONFIG_READ_RETRIES = 2;
const BLE_RETRY_DELAY_MS = 1400;
// Meshtastic 写入配置后设备会重启，BLE 广播要过几秒才回来；这里给出约 20s 的重连窗口。
const BLE_RECONNECT_ATTEMPTS = 8;
const BLE_RECONNECT_DELAY_MS = 2500;
// 普通读写/前置检查不该为“设备已彻底离线”等满 20s：用这个更短的窗口快速失败。
const BLE_QUICK_RECONNECT_OPTIONS = { attempts: 3, delayMs: 1400 };
const regions = ['US', 'EU_868', 'CN', 'JP', 'ANZ', 'KR', 'TW', 'RU', 'IN'];
const modemPresets = ['LONG_FAST', 'LONG_SLOW', 'MEDIUM_FAST', 'MEDIUM_SLOW', 'SHORT_FAST', 'SHORT_SLOW'];
const roles = ['CLIENT', 'TRACKER', 'ROUTER', 'REPEATER'];
const boolOptions = [
  { label: 'ON', value: 'true' },
  { label: 'OFF', value: 'false' },
];
const inverseBoolOptions = [
  { label: 'ON', value: 'false' },
  { label: 'OFF', value: 'true' },
];

const meshtasticConfigDefinitions = [
  { kind: 'user_name', label: '用户名称', type: 'user_name' },
  { kind: 'region', label: '区域', type: 'region', field: 'lora.region', values: regions },
  { kind: 'modem_preset', label: '预设', type: 'field_select', field: 'lora.modem_preset', values: modemPresets },
  { kind: 'channel', label: '频道', type: 'channel' },
  { kind: 'device_role', label: '设备角色', type: 'field_select', field: 'device.role', values: roles },
  // DeviceConfig 11 = tzdef：POSIX TZ 字符串（中国 = CST-8），影响设备屏幕与日志的本地时间。
  { kind: 'tzdef', label: '时区', type: 'tz_select', field: 'device.tzdef' },
  { kind: 'wifi', label: 'WiFi', type: 'wifi' },
  { kind: 'gps', label: 'GPS 开关', type: 'field_bool', field: 'position.gps_enabled' },
  { kind: 'bluetooth', label: '蓝牙开关', type: 'field_bool', field: 'bluetooth.enabled' },
  { kind: 'language', label: '设备语言', type: 'unsupported', field: 'device_ui.language', values: [
    { label: 'English', value: 'ENGLISH' },
    { label: '\u65e5\u672c\u8bed', value: 'JAPANESE' },
    { label: '\u7b80\u4f53\u4e2d\u6587', value: 'SIMPLIFIED_CHINESE' },
  ] },
];

function enqueueBleGattOperation(transport, label, task) {
  if (!transport) return Promise.reject(new Error('BLE transport is not ready.'));
  const previousLocal = transport.gattQueue || Promise.resolve();
  const previousGlobal = browserBleGattQueue || Promise.resolve();
  const next = Promise.allSettled([previousLocal, previousGlobal])
    .then(async () => task());
  transport.gattQueue = next.catch(() => {});
  browserBleGattQueue = next.catch(() => {});
  return next.catch((error) => {
    const wrapped = new Error(`${label}: ${error?.message || String(error)}`);
    wrapped.name = error?.name || 'BleGattError';
    throw wrapped;
  });
}

function enqueueBleGlobalOperation(label, task) {
  const previousGlobal = browserBleGattQueue || Promise.resolve();
  const next = previousGlobal.then(async () => task());
  browserBleGattQueue = next.catch(() => {});
  return next.catch((error) => {
    const wrapped = new Error(`${label}: ${error?.message || String(error)}`);
    wrapped.name = error?.name || 'BleGattError';
    throw wrapped;
  });
}

function scheduleBleDrain(transport) {
  if (!transport || transport.autoDrainScheduled) return;
  transport.autoDrainScheduled = true;
  setTimeout(async () => {
    try {
      // Keep background notification drains in the same global queue as foreground
      // precheck/config reads. Chrome on Windows is prone to disconnect one of two
      // GATT sessions when multiple FromRadio read loops overlap.
      await drainBleFromRadio(transport, { maxPackets: 4, maxMs: 200 });
    } catch {
      // Notification-driven drains are best-effort; foreground operations report concrete errors.
    } finally {
      transport.autoDrainScheduled = false;
    }
  }, 0);
}

const meshcoreConfigDefinitions = [
  { kind: 'radio_preset', label: '射频预设', type: 'meshcore_radio_preset', field: 'meshcore.radio_preset' },
  { kind: 'custom_frequency', label: '自定义频率', type: 'meshcore_frequency', field: 'meshcore.frequency' },
];

function activeConfigDefinitions() {
  return state.systemMode === 'meshcore' ? meshcoreConfigDefinitions : meshtasticConfigDefinitions;
}

const fieldLabels = {
  'lora.region': 'LoRa 区域',
  'lora.modem_preset': 'LoRa 调制预设',
  'lora.use_preset': 'LoRa 使用预设',
  'lora.override_frequency': 'LoRa 频率覆盖',
  'lora.channel_num': 'LoRa 主频道序号',
  'lora.hop_limit': 'LoRa 跳数上限',
  'lora.tx_power': 'LoRa 发射功率',
  'lora.tx_enabled': 'LoRa 发射开关',
  'device.role': '设备角色',
  'device.tzdef': '时区',
  'device.rebroadcast_mode': '重播模式',
  'network.wifi_enabled': 'WiFi 开关',
  'network.wifi_ssid': 'WiFi 名称',
  'network.wifi_psk': 'WiFi 密码',
  'bluetooth.enabled': '蓝牙开关',
  'bluetooth.mode': '蓝牙模式',
  'bluetooth.fixed_pin': '蓝牙 PIN',
  'position.position_broadcast_secs': '位置广播间隔',
  'position.position_broadcast_smart_enabled': '智能位置广播',
  'position.gps_enabled': 'GPS 开关',
  'position.fixed_position': '固定位置',
  'position.gps_mode': 'GPS 模式',
  'telemetry.device_update_interval': '遥测上报间隔',
  'mqtt.enabled': 'MQTT 开关',
};

// 报告里优先显示中文配置名（fieldLabels），没有映射再退回 runner 给的英文名。
function fieldDisplayName(item) {
  const field = item?.field || '';
  return fieldLabels[field] || item?.display_field || field;
}

const fallbackTargetLabels = { primary: '\u6d4b\u8bd5\u8bbe\u59071', peer: '\u6d4b\u8bd5\u8bbe\u59072', observer: '\u6d4b\u8bd5\u8bbe\u59073', both: '\u4e24\u53f0\u8bbe\u5907', all: '\u4e09\u53f0\u8bbe\u5907' };
const terminalStatuses = new Set(['done', 'failed', 'timeout', 'error', 'canceled']);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const reasonLabels = {
  'target_unavailable:primary': '\u6d4b\u8bd5\u8bbe\u59071\u672c\u8f6e\u5df2\u8d85\u65f6\u6216\u4e32\u53e3\u4e0d\u53ef\u7528\uff0c\u5df2\u8df3\u8fc7\u540e\u7eed\u91cd\u590d\u5f00\u53e3\u6b65\u9aa4\u3002',
  'target_unavailable:peer': '\u6d4b\u8bd5\u8bbe\u59072\u672c\u8f6e\u5df2\u8d85\u65f6\u6216\u4e32\u53e3\u4e0d\u53ef\u7528\uff0c\u5df2\u8df3\u8fc7\u540e\u7eed\u91cd\u590d\u5f00\u53e3\u6b65\u9aa4\u3002',
  connection_unavailable: 'COM \u53e3\u53ef\u6253\u5f00\uff0c\u4f46\u8bbe\u5907\u6ca1\u6709\u5728\u8d85\u65f6\u65f6\u95f4\u5185\u5b8c\u6210 Meshtastic \u534f\u8bae\u63e1\u624b\uff1b\u7cfb\u7edf\u5df2\u6309\u77ac\u6001\u4e32\u53e3\u9519\u8bef\u91cd\u8bd5\u3002',
  missing_connection: '\u7f3a\u5c11\u8fde\u63a5\u53c2\u6570\u3002',
  missing_peer: '\u7f3a\u5c11\u6d4b\u8bd5\u8bbe\u59072\u8fde\u63a5\u3002',
  missing_listener: '\u7f3a\u5c11\u76d1\u542c\u7aef\uff08\u6d4b\u8bd5\u8bbe\u59072 \u6216\u8bbe\u59073\uff09\u8fde\u63a5\u3002',
  recorded_value_empty: '\u524d\u9762\u6ca1\u8bfb\u5230\u53ef\u56de\u6eda\u7684\u539f\u503c\uff0c\u5df2\u8df3\u8fc7\u56de\u6eda\u5199\u5165\u3002',
  config_unreadable: '\u914d\u7f6e\u503c\u6ca1\u8bfb\u5230\uff08\u4e0d\u80fd\u5f53\u4f5c\u4e00\u81f4\uff09\uff0c\u5148\u786e\u8ba4\u4e24\u53f0\u8bbe\u5907\u90fd\u80fd\u8bfb\u5230\u8be5\u5b57\u6bb5\u3002',
  no_copy_observed: '\u76d1\u542c\u7a97\u53e3\u5185\u8fde\u76f4\u6536\u526f\u672c\u90fd\u6ca1\u770b\u5230\uff1a\u5148\u67e5\u9891\u9053/PSK\u3001\u8ddd\u79bb\u4e0e\u5929\u7ebf\u3002',
  relayed_copy_not_observed: '\u6536\u5230\u4e86\u76f4\u6536\u526f\u672c\u4f46\u6ca1\u6709 hop \u9012\u51cf\u526f\u672c\uff1a\u8fd9\u6761\u6d88\u606f\u6ca1\u88ab\u4e2d\u7ee7\u3002',
  relayed_copy_observed: '\u51fa\u73b0\u4e86\u4e0d\u8be5\u6709\u7684 hop \u9012\u51cf\u526f\u672c\uff08\u6709\u8282\u70b9\u5728\u4e2d\u7ee7\uff09\u3002',
  expected_portnum_not_observed: '\u7a97\u53e3\u5185\u6ca1\u6536\u5230\u671f\u671b\u7684\u5305\u7c7b\u578b\uff08\u4f8b\u5982 POSITION_APP\uff09\u3002',
  device_time_not_observed: '\u8bfb\u4e0d\u5230\u8bbe\u5907\u65f6\u95f4\u6233\uff1a\u8bbe\u5907\u6ca1\u6536\u5230\u5305\uff0c\u65e0\u6cd5\u6821\u9a8c\u65f6\u949f\u3002',
  unexpected_receive: '\u672c\u4e0d\u5e94\u6536\u5230\u8fd9\u6761\u6d88\u606f\uff0c\u5374\u6536\u5230\u4e86\u3002',
  missing_dest: '\u7f3a\u5c11\u76ee\u6807\u8282\u70b9 ID\u3002',
  missing_config: '\u7f3a\u5c11\u914d\u7f6e\u5b57\u6bb5\u6216\u914d\u7f6e\u503c\u3002',
  missing_message: '\u7f3a\u5c11\u53d1\u9001\u6d88\u606f\u3002',
  mutating_guard: '\u5199\u5165/\u53d1\u9001\u4fdd\u62a4\u672a\u5f00\u542f\uff0c\u672a\u6267\u884c\u4f1a\u6539\u53d8\u8bbe\u5907\u72b6\u6001\u7684\u6b65\u9aa4\u3002',
  dependency_not_run: '\u524d\u7f6e\u6b65\u9aa4\u672a\u901a\u8fc7\uff0c\u5f53\u524d\u6b65\u9aa4\u5df2\u8df3\u8fc7\u3002',
  contact_url_not_found: 'CLI \u8f93\u51fa\u4e2d\u6ca1\u6709\u627e\u5230\u8054\u7cfb\u4eba URL\u3002',
  exit_code_nonzero: 'CLI \u8fd4\u56de\u5931\u8d25\uff0c\u8bf7\u67e5\u770b stdout/stderr \u8bc1\u636e\u3002',
  timeout: '\u547d\u4ee4\u8d85\u65f6\uff1a\u8bbe\u5907\u53ef\u80fd\u521a\u91cd\u542f\u3001USB CDC \u72b6\u6001\u672a\u6062\u590d\uff0c\u6216\u56fa\u4ef6\u534f\u8bae\u6682\u672a\u54cd\u5e94\u3002',
  mutating_command_timeout: '\u5199\u64cd\u4f5c\u547d\u4ee4\u672a\u5728\u8d85\u65f6\u65f6\u95f4\u5185\u8fd4\u56de\uff1a\u547d\u4ee4\u53ef\u80fd\u5df2\u4e0b\u53d1\u5230\u8bbe\u5907\uff0c\u8bf7\u4ee5\u968f\u540e\u7684 NodeDB/\u914d\u7f6e\u6821\u9a8c\u6b65\u9aa4\u4e3a\u51c6\u3002',
  meshtastic_cli_not_found: '\u672a\u627e\u5230 meshtastic CLI \u53ef\u6267\u884c\u6587\u4ef6\u3002',
  wait_done: '\u7b49\u5f85\u5b8c\u6210\u3002',
  unchanged: '\u5f53\u524d\u503c\u5df2\u4e0e\u76ee\u6807\u4e00\u81f4\uff0c\u672a\u91cd\u65b0\u5199\u5165\u3002',
  web_ble_config_error: '\u6d4f\u89c8\u5668 GATT \u914d\u7f6e\u4e0b\u53d1\u5931\u8d25\uff0c\u8bf7\u5c55\u5f00\u8be6\u60c5\u67e5\u770b\u5177\u4f53\u9519\u8bef\u3002',
  web_ble_config_write_error: '\u6d4f\u89c8\u5668 GATT \u914d\u7f6e\u4e0b\u53d1\u6d41\u7a0b\u5f02\u5e38\u4e2d\u65ad\u3002',
  web_ble_config_readback_pending_after_reboot: '\u914d\u7f6e\u5df2\u5199\u5165\uff0c\u4f46\u8bbe\u5907\u5728\u5e94\u7528\u914d\u7f6e\u65f6\u91cd\u542f BLE\uff0c\u8bfb\u56de\u672a\u5b8c\u6210\u3002',
  web_ble_config_readback_mismatch: '\u914d\u7f6e\u5199\u5165\u540e\u8bfb\u56de\u503c\u4e0e\u76ee\u6807\u503c\u4e0d\u4e00\u81f4\u3002',
  web_ble_config_already_applied: '\u5f53\u524d\u914d\u7f6e\u5df2\u4e0e\u76ee\u6807\u4e00\u81f4\uff0c\u672a\u91cd\u590d\u5199\u5165\u3002',
  web_ble_no_target: '\u6ca1\u6709\u5df2\u8fde\u63a5\u7684 BLE \u76ee\u6807\u8bbe\u5907\u3002',
  web_ble_no_connected_device: '\u5f53\u524d\u6ca1\u6709\u5df2\u8fde\u63a5\u7684 BLE \u8bbe\u5907\u3002',
  web_ble_role_not_connected_skipped: '\u8be5\u8bbe\u5907\u6ca1\u6709\u4fdd\u6301 GATT \u8fde\u63a5\uff0c\u5df2\u8df3\u8fc7\u3002',
  web_ble_gatt_disconnected: 'BLE GATT \u8fde\u63a5\u5df2\u65ad\u5f00\u3002',
};

const statusLabels = {
  PASS: '\u901a\u8fc7',
  FAIL: '\u5931\u8d25',
  SKIPPED: '\u8df3\u8fc7',
  DRY_RUN: '\u672a\u6267\u884c',
  RUNNING: '\u8fd0\u884c\u4e2d',
  done: '\u5b8c\u6210',
  failed: '\u5931\u8d25',
  timeout: '\u8d85\u65f6',
  error: '\u5f02\u5e38',
  canceled: '\u5df2\u505c\u6b62',
};

const moduleDisplayNames = {
  Precheck: '\u6d4b\u8bd5\u524d\u68c0\u67e5',
  // 浏览器侧 BLE 结果过去用的是英文模块名，会在任务卡片上直接显示 "Config write"。
  'Config write': '\u914d\u7f6e\u5199\u5165',
  'Config write (Web Bluetooth)': 'BLE \u914d\u7f6e\u4e0b\u53d1',
  'BLE config write': 'BLE \u914d\u7f6e\u4e0b\u53d1',
  'BLE communication config': 'BLE \u901a\u4fe1\u914d\u7f6e',
  'Web BLE precheck': 'BLE \u8bbe\u5907\u68c0\u67e5',
};

const $ = (id) => document.getElementById(id);

function setEvidenceText(text) {
  if ($('commandBox')) $('commandBox').textContent = text;
  if ($('reportDetailBox')) $('reportDetailBox').textContent = text;
}

function setBleStatus(text, tone = 'info') {
  const box = $('bleStatus');
  if (box) {
    box.textContent = text;
    box.dataset.tone = tone;
  }
  if (!box) {
    setBleRoleStatus('primary', text, tone);
    setBleRoleStatus('peer', text, tone);
  }
}

function bleRoleLabel(role) {
  if (WEB_BLE_SINGLE_DEVICE_ONLY) return '\u6d4b\u8bd5\u8bbe\u5907';
  return role === 'peer' ? '\u6d4b\u8bd5\u8bbe\u5907 2' : '\u6d4b\u8bd5\u8bbe\u5907 1';
}

function bleInputForRole(role) {
  return role === 'peer' ? $('peerBleValue') : $('bleValue');
}

function setBleRoleStatus(role, text, tone = 'info') {
  const id = role === 'peer' ? 'bleStatusPeer' : 'bleStatusPrimary';
  const box = $(id);
  if (!box) return;
  if (box.textContent === text && box.dataset.tone === tone) return;
  box.textContent = text;
  box.dataset.tone = tone;
}

function friendlyBleError(error) {
  const raw = `${error?.name || 'Error'}: ${error?.message || String(error)}`;
  const lower = raw.toLowerCase();
  if (/operation already in progress/.test(lower)) {
    return '蓝牙正忙，请稍等后重试。';
  }
  if (/failed to connect|failed to establish|device not found|not in range|no longer/.test(lower)) {
    return '无法建立 GATT 连接：设备可能正在重启或已不在广播范围内。';
  }
  if (/unknown reason|operation failed|networkerror|gatt/.test(lower)) {
    return '蓝牙读写未完成，请确认设备仍在蓝牙模式后重试。';
  }
  if (/disconnected|not connected/.test(lower)) {
    return '蓝牙已断开，请重新连接。';
  }
  if (/notfound|cancel/.test(lower)) {
    return '已取消设备选择，未连接。';
  }
  return raw;
}

function bleListForRole(role) {
  return $(role === 'peer' ? 'bleListPeer' : 'bleListPrimary');
}

function activatePage(page) {
  document.querySelectorAll('[data-page]').forEach((item) => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  document.querySelectorAll('[data-page-link]').forEach((item) => {
    item.classList.toggle('active', item.dataset.pageLink === page);
  });
  // 切到报告页时主动拉一次最新报告，避免只依赖页面加载时的旧列表。
  if (page === 'reports') refreshReportList();
}

async function refreshReportList() {
  try {
    const reports = await api('/api/reports');
    renderReports(reports.reports);
  } catch (error) {
    const box = $('commandBox');
    if (box) box.textContent = `报告列表刷新失败：${error.message}`;
  }
}

function legacySetSystemModeUnused(mode) {
  const nextMode = mode === 'meshcore' ? 'meshcore' : 'meshtastic';
  state.systemMode = nextMode;
  if ($('execute')) $('execute').checked = true;
  if ($('allowMutating')) $('allowMutating').checked = true;
  $('modeMeshtastic')?.classList.toggle('active', nextMode === 'meshtastic');
  $('modeMeshCore')?.classList.toggle('active', nextMode === 'meshcore');
  const subtitle = $('appSubtitle');
  if (subtitle) subtitle.textContent = nextMode === 'meshcore' ? 'MeshCore QA 模式' : 'Meshtastic QA 模式';
  const title = $('pageModeLabel');
  if (title) title.textContent = nextMode === 'meshcore' ? 'MeshCore' : 'Meshtastic';
}

function resetModeScopedState() {
  state.runs = [];
  state.ports = [];
  state.bleDevices = [];
  state.bleDevicesByRole = { primary: [], peer: [] };
  state.selectedBleDeviceIds = { primary: '', peer: '' };
  state.resultFilter = '';
  state.pendingConfigPlan = null;
  state.activeTargetType = '';
  state.serialLogId = '';
  resetDeviceIdentity();
  renderPorts();
  syncPortSelectors();
  fillLogPortSelect();
  renderReports([]);
  renderBleDevices('primary');
  renderBleDevices('peer');
  renderResults();
  summarize();
  renderProgress({ done: 0, total: 0, percent: 0, events: [] });
  setEvidenceText('已切换测试系统，上一模式的串口扫描、报告记录、执行结果和设备状态已清空。');
  const runState = $('runState');
  if (runState) {
    runState.textContent = '待运行';
    runState.dataset.status = 'idle';
  }
}

function setSystemMode(mode) {
  if (mode === 'meshcore') {
    $('commandBox').textContent = 'MeshCore 测试能力正在规划中；当前执行台仅开放 Meshtastic 固件测试。';
    return;
  }
  const nextMode = 'meshtastic';
  const changed = state.systemMode !== nextMode;
  document.body.classList.add('mode-resetting');
  state.systemMode = nextMode;
  $('modeMeshtastic')?.classList.toggle('active', nextMode === 'meshtastic');
  $('modeMeshCore')?.classList.toggle('active', nextMode === 'meshcore');
  const subtitle = $('appSubtitle');
  if (subtitle) {
    subtitle.textContent = '';
    subtitle.hidden = true;
  }
  const title = $('pageModeLabel');
  if (title) title.textContent = nextMode === 'meshcore' ? 'MeshCore' : 'Meshtastic';
  if (changed) resetModeScopedState();
  initConfigControls();
  updateCommConfigControls();
  updateMessageModeControls();
  refreshCustomSelects();
  window.setTimeout(() => document.body.classList.remove('mode-resetting'), 260);
}

function initNavState() {
  // Fixed sidebar: keep page geometry stable and avoid hover-driven reflow.
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  } catch (error) {
    // fetch 只有在"请求根本没到服务器"时才抛异常（后端进程已退出、端口被别的东西占用等）。
    // 直接显示 "Failed to fetch" 没法让人定位，这里给一句能照做的中文提示。
    const hint = '\u540e\u7aef\u670d\u52a1\u6ca1\u6709\u54cd\u5e94\uff1a\u8bf7\u786e\u8ba4 dashboard \u670d\u52a1\u5728\u8fd0\u884c'
      + '\uff08\u5728\u9879\u76ee\u76ee\u5f55\u6267\u884c .\\start_dashboard.ps1\uff09\uff0c\u518d\u5237\u65b0\u9875\u9762\u91cd\u8bd5\u3002';
    const wrapped = new Error(hint);
    wrapped.cause = error;
    wrapped.networkError = true;
    throw wrapped;
  }
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function closeCustomSelects(except) {
  document.querySelectorAll('.custom-select.open').forEach((wrap) => {
    if (wrap !== except) wrap.classList.remove('open');
  });
}

function syncCustomSelect(select) {
  if (!select || !select.dataset.customized) return;
  const wrapper = select.nextElementSibling;
  if (!wrapper?.classList?.contains('custom-select')) return;
  const button = wrapper.querySelector('.custom-select-button');
  const menu = wrapper.querySelector('.custom-select-menu');
  if (select.options.length && select.selectedIndex < 0) select.selectedIndex = 0;
  const selected = select.selectedOptions[0] || select.options[0];
  button.textContent = selected?.textContent || '';
  button.disabled = select.disabled;
  wrapper.classList.toggle('disabled', select.disabled);
  wrapper.classList.remove('open');
  menu.innerHTML = '';
  [...select.options].forEach((option) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'custom-select-option';
    item.textContent = option.textContent;
    item.disabled = option.disabled;
    item.dataset.value = option.value;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(option.value === select.value));
    item.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (option.disabled) return;
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      closeCustomSelects();
    });
    menu.appendChild(item);
  });
}

function enhanceSelect(select) {
  if (!select || select.dataset.customized) {
    syncCustomSelect(select);
    return;
  }
  select.dataset.customized = 'true';
  select.classList.add('native-select-hidden');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'custom-select-button';
  button.setAttribute('aria-haspopup', 'listbox');
  const menu = document.createElement('div');
  menu.className = 'custom-select-menu';
  menu.setAttribute('role', 'listbox');
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (select.disabled) return;
    const shouldOpen = !wrapper.classList.contains('open');
    closeCustomSelects(wrapper);
    wrapper.classList.toggle('open', shouldOpen);
  });
  wrapper.append(button, menu);
  select.insertAdjacentElement('afterend', wrapper);
  select.addEventListener('change', () => syncCustomSelect(select));
  syncCustomSelect(select);
}

function refreshCustomSelects(root = document) {
  root.querySelectorAll('select').forEach(enhanceSelect);
}

function shortNodeLabel(nodeId) {
  const clean = String(nodeId || '').replace(/^!/, '').trim();
  return clean.length >= 4 ? clean.slice(-4).toLowerCase() : '';
}

function targetPort(target) {
  if (target === 'primary') return $('primaryPort')?.value || '';
  if (target === 'peer') return $('peerPort')?.value || '';
  if (target === 'observer') return $('observerPort')?.value || '';
  return '';
}

function assignedPortDeviceId(port) {
  const cleanPort = String(port || '').trim().toUpperCase();
  if (!cleanPort) return '';
  for (const target of ['primary', 'peer', 'observer']) {
    if (targetPort(target).trim().toUpperCase() !== cleanPort) continue;
    const snapshot = state.deviceSnapshots[target];
    const nodeId = snapshot?.summary?.node_id || state.deviceNodeIds[target] || '';
    if (nodeId) return shortNodeLabel(nodeId) || String(nodeId).replace(/^!/, '');
    const label = state.deviceLabels[target] || '';
    if (label && label !== fallbackTargetLabels[target]) return label;
  }
  return '';
}

function targetConnectionValue(target) {
  const type = $('connectionType')?.value || 'none';
  if (type === 'port') return targetPort(target);
  if (type === 'host') return target === 'primary' ? $('hostValue')?.value.trim() || '' : $('peerHostValue')?.value.trim() || '';
  if (type === 'ble') {
    if (hasConnectedBleRole(target)) {
      const transport = browserBleTransports.get(target);
      return bleDeviceDisplayName(transport?.device, target, bleInputForRole(target)?.value.trim() || bleRoleLabel(target));
    }
    return target === 'primary' ? $('bleValue')?.value.trim() || '' : $('peerBleValue')?.value.trim() || '';
  }
  return '';
}

function hasPeerConnection() {
  return Boolean(targetConnectionValue('peer'));
}

function baseTargetLabel(target) {
  return state.deviceLabels[target] || fallbackTargetLabels[target] || target || '-';
}

function displayTarget(target) {
  return baseTargetLabel(target);
}

function displayTargetOption(target) {
  if (target === 'both') return '\u4e24\u53f0\u8bbe\u5907';
  return baseTargetLabel(target);
}

function displayText(value) {
  return String(value ?? '')
    .replaceAll('\u6d4b\u8bd5\u8bbe\u59071', displayTarget('primary'))
    .replaceAll('\u6d4b\u8bd5\u8bbe\u59072', displayTarget('peer'));
}

function stableStepTargetLabel(step, targetKey = 'target', labelKey = 'target_label') {
  const label = step?.[labelKey];
  if (label) return String(label);
  const target = step?.[targetKey];
  if (target === 'primary') return '\u6d4b\u8bd5\u8bbe\u59071';
  if (target === 'peer') return '\u6d4b\u8bd5\u8bbe\u59072';
  if (target === 'both') return '\u4e24\u53f0\u8bbe\u5907';
  return target || '-';
}

function payloadDeviceLabel(target) {
  const label = state.deviceLabels[target] || '';
  return label && label !== fallbackTargetLabels[target] ? label : '';
}

function cachedConfigValue(target, field, fallback = '') {
  const config = state.deviceConfigs[target] || {};
  return config[field] ?? fallback;
}

function defaultConfigTargetForForm() {
  const target = $('configTarget')?.value || 'primary';
  return target === 'peer' ? 'peer' : 'primary';
}

function endpointLabel(value) {
  const text = String(value ?? '');
  if (text === 'primary') return displayTarget('primary');
  if (text === 'peer') return displayTarget('peer');
  if (text.startsWith('channel:')) return `\u9891\u9053 ${text.split(':')[1] || ''}`.trim();
  return displayText(text);
}


function displayStatus(status) {
  return statusLabels[status] || status || '-';
}

function displayModuleName(moduleName) {
  return moduleDisplayNames[moduleName] || moduleName || '';
}

function nodePublicKeyLines(entries) {
  const items = Array.isArray(entries) ? entries : [];
  return items
    .filter((item) => item?.public_key)
    .slice(0, 12)
    .map((item) => `${item.short_name || shortNodeLabel(item.node_id) || item.node_id}: ${item.public_key}`);
}

function captureDeviceLabels(result) {
  for (const item of result.cases || []) {
    for (const step of item.steps || []) {
      const isLocalInfo = Array.isArray(step.command) && step.command.includes('--info') && !step.command.includes('--ch-index');
      if (!step.captured_node_id && !isLocalInfo) continue;
      const nodeId = step.captured_node_id || step.info_summary?.node_id || '';
      let label = step.info_summary?.short_name || step.info_summary?.node_label || shortNodeLabel(nodeId);
      if (label && nodeId && /^Meshtastic\s+/i.test(label)) label = shortNodeLabel(nodeId);
      const otherTarget = step.target === 'primary' ? 'peer' : step.target === 'peer' ? 'primary' : '';
      if (nodeId && otherTarget && state.deviceNodeIds[otherTarget] === nodeId) continue;
      if (label && otherTarget && label === state.deviceLabels[otherTarget] && nodeId && state.deviceNodeIds[otherTarget] && state.deviceNodeIds[otherTarget] !== nodeId) {
        label = shortNodeLabel(nodeId);
      }
      if (label && (step.target === 'primary' || step.target === 'peer')) {
        state.deviceLabels[step.target] = label;
        state.deviceNodeIds[step.target] = nodeId;
      }
    }
  }
  updateTargetOptionLabels();
}

function captureDeviceConfigs(result) {
  for (const item of result.cases || []) {
    for (const step of item.steps || []) {
      const target = step.target;
      if (!(target === 'primary' || target === 'peer')) continue;
      const readValues = step.read_values?.length ? step.read_values : (step.read_value ? [step.read_value] : []);
      for (const readValue of readValues) {
        state.deviceConfigs[target][readValue.field] = readValue.display_value || readValue.value || '';
      }
    }
  }
  syncCommunicationControlsFromCache();
  renderDeviceSnapshots();
}

function configValue(snapshot, path) {
  let value = snapshot || {};
  for (const key of path.split('.')) {
    if (value == null || typeof value !== 'object') return '';
    value = value[key];
  }
  if (value === true) return 'ON';
  if (value === false) return 'OFF';
  return value ?? '';
}

function captureDeviceSnapshots(result) {
  for (const item of result.cases || []) {
    for (const step of item.steps || []) {
      const target = step.target;
      const snapshot = step.device_snapshot;
      if (!snapshot || !(target === 'primary' || target === 'peer')) continue;
      state.deviceSnapshots[target] = snapshot;
      const preferences = snapshot.preferences || {};
      // --info 快照先刷新完整的设备当前状态；同一轮显式 --get 读回会在其后覆盖对应字段。
      state.deviceConfigs[target]['lora.region'] = configValue(preferences, 'lora.region');
      state.deviceConfigs[target]['lora.modem_preset'] = configValue(preferences, 'lora.modemPreset');
      state.deviceConfigs[target]['lora.use_preset'] = configValue(preferences, 'lora.usePreset');
      state.deviceConfigs[target]['lora.override_frequency'] = configValue(preferences, 'lora.overrideFrequency');
      state.deviceConfigs[target]['network.wifi_enabled'] = configValue(preferences, 'network.wifiEnabled');
      state.deviceConfigs[target]['network.wifi_ssid'] = configValue(preferences, 'network.wifiSsid');
      state.deviceConfigs[target]['bluetooth.enabled'] = configValue(preferences, 'bluetooth.enabled');
      state.deviceConfigs[target]['device.tzdef'] = configValue(preferences, 'device.tzdef');
      for (const channel of snapshot.channels || []) {
        const index = Number(channel.index || 0);
        if (channel.name) {
          state.channels[index] = channel.name;
          state.channelSources[index] = channel.role === 'PRIMARY' && isPresetChannelName(channel.name) ? 'default' : 'device';
        }
      }
    }
  }
  syncCommunicationControlsFromCache();
  renderDeviceSnapshots();
  updateChannelOptions();
}

function boolDisplay(value) {
  return value === undefined || value === null ? '' : value ? 'ON' : 'OFF';
}

function applyBleInfoToState(role, info) {
  if (!info?.ok || !(role === 'primary' || role === 'peer')) return;
  const labelValue = info.shortName || shortNodeLabel(info.nodeId);
  state.deviceNodeIds[role] = info.nodeId;
  state.deviceLabels[role] = labelValue;
  const configs = info.configs || {};
  const modules = info.moduleConfigs || {};
  state.deviceConfigs[role]['lora.region'] = configs.lora?.region || '';
  state.deviceConfigs[role]['lora.modem_preset'] = configs.lora?.modemPreset || '';
  state.deviceConfigs[role]['lora.use_preset'] = boolDisplay(configs.lora?.usePreset);
  state.deviceConfigs[role]['lora.override_frequency'] = configs.lora?.overrideFrequency ?? '';
  state.deviceConfigs[role]['lora.channel_num'] = configs.lora?.channelNum ?? '';
  state.deviceConfigs[role]['device.role'] = configs.device?.role || '';
  state.deviceConfigs[role]['device.tzdef'] = configs.device?.tzdef || '';
  state.deviceConfigs[role]['network.wifi_enabled'] = boolDisplay(configs.network?.wifiEnabled);
  state.deviceConfigs[role]['network.wifi_ssid'] = configs.network?.wifiSsid || '';
  state.deviceConfigs[role]['bluetooth.enabled'] = boolDisplay(configs.bluetooth?.enabled);
  state.deviceConfigs[role]['bluetooth.mode'] = configs.bluetooth?.mode ?? '';
  state.deviceConfigs[role]['bluetooth.fixed_pin'] = configs.bluetooth?.fixedPin ?? '';
  state.deviceConfigs[role]['position.gps_enabled'] = boolDisplay(configs.position?.gpsEnabled);
  state.deviceConfigs[role]['mqtt.enabled'] = boolDisplay(modules.mqtt?.enabled);
  for (const channel of info.channels || []) {
    const index = Number(channel.index || 0);
    const name = channel.settings?.name || (index === 0 ? '主频道' : `频道 ${index}`);
    state.channels[index] = name;
    state.channelPsks[index] = channelPskHexFromSettings(channel.settings);
    state.channelPskKnown[index] = true;
    state.channelSources[index] = channel.role === 'PRIMARY' ? 'device' : 'device';
  }
  state.deviceSnapshots[role] = {
    owner: { shortName: info.shortName || labelValue, longName: info.longName || labelValue },
    myNodeNum: info.nodeId,
    publicKey: info.publicKey || '',
    preferences: {
      lora: configs.lora || {},
      device: configs.device || {},
      network: configs.network || {},
      bluetooth: configs.bluetooth || {},
      position: configs.position || {},
    },
    modules,
    channels: info.channels || [],
    nodes: info.nodes || [],
  };
  updateTargetOptionLabels();
  syncCommunicationControlsFromCache();
  renderDeviceSnapshots();
  updateChannelOptions();
  updateBleNodeOptions();
}

function captureChannelLabels(result) {
  for (const item of result.cases || []) {
    for (const step of item.steps || []) {
      const summary = step.channel_summary;
      if (summary && summary.name !== undefined) {
        if (Number(summary.index || 0) === 0 && summary.name === 'seeed' && state.channels[1] === 'seeed') continue;
        const index = Number(summary.index || 0);
        state.channels[index] = summary.name || (index === 0 ? '\u4e3b\u9891\u9053' : `\u9891\u9053 ${index}`);
        state.channelSources[index] = summary.role === 'PRIMARY' && isPresetChannelName(summary.name) ? 'default' : 'device';
      }
    }
  }
  updateChannelOptions();
}

function presetToChannelName(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.toLowerCase().split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join('');
}

function isPresetChannelName(value) {
  const normalized = String(value || '').replace(/[_\s-]/g, '').toLowerCase();
  return modemPresets.map(presetToChannelName).map((item) => item.toLowerCase()).includes(normalized);
}


function snapshotRows(snapshot) {
  if (!snapshot) return [];
  const preferences = snapshot.preferences || {};
  const modules = snapshot.module_preferences || snapshot.modules || {};
  const summary = snapshot.summary || {};
  return [
    ['Short Name', summary.short_name || snapshot.owner?.shortName],
    ['\u8282\u70b9 ID', summary.node_id || snapshot.myNodeNum],
    ['\u516c\u94a5', summary.public_key || snapshot.publicKey],
    ['\u56fa\u4ef6', summary.firmware],
    ['\u786c\u4ef6', summary.hardware],
    ['Device Role', configValue(preferences, 'device.role') || summary.role],
    ['Region', configValue(preferences, 'lora.region')],
    ['预设', configValue(preferences, 'lora.modemPreset')],
    ['使用预设', configValue(preferences, 'lora.usePreset')],
    ['Frequency Override', configValue(preferences, 'lora.overrideFrequency')],
    ['Channel Num', configValue(preferences, 'lora.channelNum')],
    ['WiFi', configValue(preferences, 'network.wifiEnabled')],
    ['WiFi SSID', configValue(preferences, 'network.wifiSsid')],
    ['Bluetooth', configValue(preferences, 'bluetooth.enabled')],
    ['Bluetooth Mode', configValue(preferences, 'bluetooth.mode')],
    ['Bluetooth PIN', configValue(preferences, 'bluetooth.fixedPin')],
    ['GPS', configValue(preferences, 'position.gpsEnabled')],
    ['MQTT', configValue(modules, 'mqtt.enabled')],
  ].filter(([, value]) => value !== '' && value !== undefined && value !== null);
}


// 用例 hover 提示：说明这条用例需要连接几台测试设备、分别干什么。
// required_devices / device_note 由团队本地用例库维护；语料缺字段时不编造台数。
function caseDeviceTip(item) {
  const count = Number(item && item.required_devices) || 0;
  const note = String((item && item.device_note) || '').trim();
  if (count && note) return /台/.test(note) ? note : `需 ${count} 台测试设备：${note}`;
  if (count) return `需 ${count} 台测试设备`;
  return note;
}

function buildCaseTip(item) {
  const zones = Array.isArray(item.zones)
    ? item.zones.map((zone) => (typeof zone === 'string' ? zone : zone.name)).filter(Boolean)
    : [];
  const zoneText = zones.length ? `覆盖 ${zones.length} 个时区：${zones.join('、')}` : '';
  return [item.id, item.source_case, caseDeviceTip(item), zoneText].filter(Boolean).join(' · ');
}

// 切换串口 / 蓝牙后必须清掉上一台设备的配置快照：否则切到蓝牙还会显示串口连接时读到的设备配置。
function resetDeviceReadouts(hint) {
  state.channelPsks = {};
  state.channelPskKnown = {};
  state.connectedBleDeviceIds = { primary: '', peer: '' };
  resetDeviceIdentity();
  const list = $('deviceSnapshotList');
  if (list && hint) {
    list.classList.add('empty');
    list.textContent = hint;
  }
}

function renderDeviceSnapshots() {
  const list = $('deviceSnapshotList');
  if (!list) return;
  const entries = [['primary', displayTarget('primary')], ['peer', displayTarget('peer')]]
    .filter(([target]) => state.deviceSnapshots[target] || Object.keys(state.deviceConfigs[target] || {}).length);
  list.innerHTML = '';
  if (!entries.length) {
    list.classList.add('empty');
    list.textContent = '\u6682\u65e0\u8bbe\u5907\u914d\u7f6e';
    renderLogDeviceSummary();
    return;
  }
  list.classList.remove('empty');
  for (const [target, label] of entries) {
    const snapshot = state.deviceSnapshots[target];
    const cachedRows = Object.entries(state.deviceConfigs[target] || {}).map(([field, value]) => [fieldLabels[field] || field, value]);
    const rowMap = new Map([...snapshotRows(snapshot), ...cachedRows]);
    const rows = [...rowMap.entries()].map(([name, value]) => `<span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong>`).join('');
    const channels = (snapshot?.channels || []).map((channel) => {
      // 频道对象来自 parseChannel()：名称在 channel.settings.name 里（不是 channel.name）。
      // 之前读错属性导致所有频道名都显示 "-"，而执行结果详情里的 channels=0:LongFast… 是对的。
      const index = channel.index ?? '-';
      const name = channel.settings?.name || channel.name || '-';
      const role = channel.role || '-';
      const pskHex = channelPskHexFromSettings(channel.settings) || channel.psk || '';
      let psk = '-';
      if (pskHex) psk = pskHex.length > 16 ? `${pskHex.slice(0, 16)}… (${pskHex.length / 2} 字节)` : pskHex;
      else if (channel.settings && channel.role !== 'DISABLED') psk = '\u7a7a\uff08\u4e0d\u52a0\u5bc6\uff09';
      return `<li>\u9891\u9053 ${escapeHtml(index)}\uff1a${escapeHtml(name)} \u00b7 ${escapeHtml(role)} \u00b7 PSK ${escapeHtml(psk)}</li>`;
    }).join('');
    const article = document.createElement('article');
    article.className = 'snapshot-card';
    article.innerHTML = `
      <header><strong>${escapeHtml(label)}</strong><span>${escapeHtml(targetConnectionValue(target) || '')}</span></header>
      <div class="snapshot-grid">${rows}</div>
      ${channels ? `<ul class="channel-list">${channels}</ul>` : ''}
      <details class="${snapshot ? '' : 'hidden'}">
        <summary>\u5b8c\u6574\u8131\u654f\u914d\u7f6e JSON</summary>
        <code>${escapeHtml(JSON.stringify(snapshot || {}, null, 2))}</code>
      </details>
    `;
    list.appendChild(article);
  }
  renderLogDeviceSummary();
}

function renderLogDeviceSummary() {
  const box = $('logDeviceSummary');
  if (!box) return;
  const entries = ['primary', 'peer']
    .map((target) => {
      const label = displayTarget(target);
      const value = targetConnectionValue(target);
      return value ? `${label} ${value}` : '';
    })
    .filter(Boolean);
  box.textContent = entries.join(' / ');
}

function updateTargetOptionLabels() {
  const select = $('configTarget');
  if (!select) return;
  const singleBleTarget = WEB_BLE_SINGLE_DEVICE_ONLY && $('connectionType')?.value === 'ble';
  if (singleBleTarget && select.value !== 'primary') select.value = 'primary';
  for (const option of select.options) {
    option.textContent = displayTargetOption(option.value);
    option.disabled = singleBleTarget && option.value !== 'primary';
  }
  syncCustomSelect(select);
}


function updateChannelOptions() {
  const selects = [$('messageChannel'), $('bleContinuousChannel')].filter(Boolean);
  for (const select of selects) {
    const selected = select.value || '0';
    select.innerHTML = '';
    for (let index = 0; index < 8; index += 1) {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = state.channels[index] ? `频道 ${index} · ${state.channels[index]}` : `频道 ${index}`;
      select.appendChild(option);
    }
    select.value = selected;
    syncCustomSelect(select);
  }
}

function selectedModules() {
  return [...document.querySelectorAll('[data-module-check]:checked')].map((item) => item.value);
}

function optionHtml(values) {
  return values.map((item) => {
    const value = typeof item === 'string' ? item : item.value;
    const label = typeof item === 'string' ? item : item.label;
    return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
  }).join('');
}

function fillSelectOptions(select, values, preferred = '') {
  if (!select) return;
  const current = preferred || select.value;
  select.innerHTML = optionHtml(values);
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  } else if (select.options.length) {
    select.selectedIndex = 0;
  }
  enhanceSelect(select);
  syncCustomSelect(select);
}

function currentConfigDefinition() {
  const definitions = activeConfigDefinitions();
  const select = $('configKind');
  if (select && definitions.length && !select.options.length) {
    fillSelectOptions(select, definitions.map((item) => ({ value: item.kind, label: item.label })), definitions[0].kind);
  }
  if (select && definitions.length && ![...select.options].some((option) => option.value === select.value)) {
    select.value = definitions[0].kind;
    syncCustomSelect(select);
  }
  return definitions.find((item) => item.kind === select?.value) || definitions[0];
}

function currentConfigPlan() {
  const definition = currentConfigDefinition();
  const base = { kind: definition.kind, target: $('configTarget').value, field: definition.field || '', value: '', payload: {} };
  if (definition.type === 'user_name') {
    base.field = 'user.name';
    base.payload = {
      longName: $('ownerLongName')?.value.trim() || '',
      shortName: $('ownerShortName')?.value.trim() || '',
    };
    base.value = [base.payload.longName && `Long Name=${base.payload.longName}`, base.payload.shortName && `Short Name=${base.payload.shortName}`].filter(Boolean).join(', ');
  } else if (definition.type === 'channel') {
    base.field = 'channel';
    const pskMode = $('configChannelPskMode')?.value || 'keep';
    const pskDefinition = CHANNEL_PSK_MODES[pskMode] || CHANNEL_PSK_MODES.keep;
    let psk = '';
    try {
      psk = channelPskFormValue().psk;
    } catch (error) {
      // 不在收集阶段抛错：把原因挂到计划上，由 validateBeforeRun 显示（含输入框内联报错）。
      base.pskError = error.message;
    }
    base.payload = {
      index: Number($('configChannelIndex')?.value || 0),
      name: $('configChannelName')?.value.trim() || '',
      psk,
      pskMode,
    };
    base.value = [
      base.payload.name && `Name=${base.payload.name}`,
      pskMode !== 'keep' && `PSK=${pskDefinition.label}`,
    ].filter(Boolean).join(', ');
  } else if (definition.type === 'wifi') {
    base.field = 'wifi';
    base.payload = {
      enabled: $('wifiEnabled')?.value || '',
      ssid: $('wifiSsid')?.value.trim() || '',
      key: $('wifiKey')?.value || '',
    };
    base.value = [base.payload.enabled && `WiFi=${base.payload.enabled === 'true' ? 'ON' : 'OFF'}`, base.payload.ssid && `SSID=${base.payload.ssid}`, base.payload.key && 'Key=set'].filter(Boolean).join(', ');
  } else if (definition.type === 'custom') {
    base.field = $('customConfigField')?.value.trim() || '';
    base.value = $('customConfigValue')?.value.trim() || '';
  } else if (definition.type === 'tz_select') {
    base.value = tzZoneValue();
    base.payload = { tzdef: base.value };
  } else if (definition.type === 'field_text') {
    base.value = $('configValue')?.value.trim() || '';
    base.payload = { [definition.field.split('.').pop()]: base.value };
  } else if (definition.type === 'region') {
    const region = $('regionValue')?.value || '';
    const overrideFrequency = $('regionOverrideFrequency')?.value.trim() || '0';
    base.field = 'lora.region';
    base.payload = { region, overrideFrequency };
    base.value = `Region=${region}; Frequency Override=${overrideFrequency}`;
  } else {
    base.value = $('configValue')?.value.trim() || '';
  }
  return base;
}

function runPayload(targetType, value) {
  const connectionType = $('connectionType').value;
  const primaryPort = connectionType === 'port' ? $('primaryPort').value.trim() : '';
  const peerPort = connectionType === 'port' ? $('peerPort').value.trim() : '';
  // 测试设备3（观察者）只支持串口：用于角色行为验证时长时间 --listen 抓包；默认收起时不参与运行参数。
  const observerPort = connectionType === 'port' && observerExpanded() ? ($('observerPort')?.value.trim() || '') : '';
  const hostValue = connectionType === 'host' ? $('hostValue').value.trim() : '';
  const peerHostValue = connectionType === 'host' ? $('peerHostValue').value.trim() : '';
  // BLE 单设备布局会把测试设备 2 的 BLE 卡片（含 #peerBleValue）从 DOM 中移除，
  // 这里必须容忍元素缺失，否则 BLE 模式下所有 runner 操作都会抛 TypeError 并静默中断。
  const bleValue = connectionType === 'ble' && !hasConnectedBleRole('primary') ? $('bleValue')?.value.trim() || '' : '';
  const peerBleValue = connectionType === 'ble' && !hasConnectedBleRole('peer') ? $('peerBleValue')?.value.trim() || '' : '';
  const connectionValue = connectionType === 'port' ? primaryPort : connectionType === 'host' ? hostValue : connectionType === 'ble' ? bleValue : '';
  const configPlan = currentConfigPlan();
  if (WEB_BLE_SINGLE_DEVICE_ONLY && connectionType === 'ble') configPlan.target = 'primary';
  const primaryNodeId = state.deviceNodeIds.primary || '';
  const peerNodeId = state.deviceNodeIds.peer || '';
  const primaryPublicKey = state.deviceSnapshots.primary?.publicKey || state.deviceSnapshots.primary?.summary?.public_key || '';
  const peerPublicKey = state.deviceSnapshots.peer?.publicKey || state.deviceSnapshots.peer?.summary?.public_key || '';
  const hasDistinctNodeIds = primaryNodeId && peerNodeId && primaryNodeId !== peerNodeId;
  const messageText = currentMessageText();
  return {
    targetType,
    systemMode: state.systemMode || 'meshtastic',
    module: targetType === 'module' ? value : undefined,
    modules: targetType === 'modules' ? selectedModules() : undefined,
    caseId: targetType === 'case' ? value : undefined,
    caseIds: targetType === 'cases' ? value : undefined,
    connectionType,
    connectionValue,
    primaryPort,
    peerPort,
    observerPort,
    hostValue,
    bleValue,
    peerHostValue,
    peerBleValue,
    blePair: Boolean($('blePair')?.checked),
    dest: $('dest').value.trim(),
    timeout: Number($('timeout').value || 30),
    stepGap: Number($('stepGap')?.value || 5),
    execute: true,
    allowMutating: true,
    configTarget: configPlan.target,
    configKind: configPlan.kind,
    configJson: configPlan.payload,
    configField: configPlan.field,
    configValue: configPlan.value,
    configWait: Number($('configWait')?.value || 10),
    experimentRegion: $('useExperimentRegion').checked ? $('experimentRegion').value : '',
    experimentModem: $('useExperimentModem').checked ? $('experimentModem').value : '',
    overrideFrequency: $('useOverrideFrequency').checked ? $('overrideFrequency').value.trim() : '',
    messagePrimary: messageText,
    messagePeer: messageText,
    messageMode: $('messageMode').value,
    messageChannel: Number($('messageChannel').value || 0),
    messageNode: $('messageNode')?.value || '',
    receiveWait: Number($('receiveWait')?.value || 10),
    primaryNodeId: hasDistinctNodeIds ? primaryNodeId : '',
    peerNodeId: hasDistinctNodeIds ? peerNodeId : '',
    primaryPublicKey: hasDistinctNodeIds ? primaryPublicKey : '',
    peerPublicKey: hasDistinctNodeIds ? peerPublicKey : '',
    primaryLabel: payloadDeviceLabel('primary'),
    peerLabel: payloadDeviceLabel('peer'),
    observerLabel: payloadDeviceLabel('observer'),
    rebootWait: Number($('rebootWait').value || 10),
  };
}

function currentMessageText() {
  return ($('messageText')?.value || '').trim();
}

function caseStatus(item) {
  const steps = item.steps || [];
  if (!steps.length) return 'FAIL';
  if (steps.some((step) => step.status === 'FAIL')) return 'FAIL';
  if (steps.some((step) => step.status === 'SKIPPED')) return 'SKIPPED';
  if (steps.some((step) => step.status === 'DRY_RUN')) return 'DRY_RUN';
  return 'PASS';
}

function firstIssueStep(item) {
  return (item.steps || []).find((step) => ['FAIL', 'SKIPPED', 'DRY_RUN'].includes(step.status)) || null;
}

function flattenCases() {
  return state.runs.flatMap((run) => (run.result?.cases || []).map((item) => ({ run, item, status: caseStatus(item) })));
}

function summarize() {
  const counts = { PASS: 0, FAIL: 0, SKIPPED: 0, DRY_RUN: 0 };
  for (const { status } of flattenCases()) counts[status] = (counts[status] || 0) + 1;
  $('passCount').textContent = counts.PASS || 0;
  $('failCount').textContent = counts.FAIL || 0;
  $('skipCount').textContent = counts.SKIPPED || 0;
  $('dryCount').textContent = counts.DRY_RUN || 0;
}

function commandText(command) {
  return (command || []).map((part) => /\s/.test(part) ? `"${part}"` : part).join(' ');
}

function friendlyReason(step) {
  if (step.status === 'DRY_RUN') return '\u672a\u6267\u884c\uff1a\u53ea\u751f\u6210\u547d\u4ee4\u8ba1\u5212\uff0c\u6ca1\u6709\u64cd\u4f5c\u8bbe\u5907\u3002';
  if (step.status === 'SKIPPED' && step.reason === 'dependency_not_run' && step.blocked_by) {
    return `\u524d\u7f6e\u6b65\u9aa4\u201c${displayText(step.blocked_by)}\u201d\u672a\u901a\u8fc7\uff0c\u5f53\u524d\u6b65\u9aa4\u5df2\u8df3\u8fc7\u3002`;
  }
  if (step.status === 'SKIPPED') return reasonLabels[step.reason] || step.reason || '\u6b65\u9aa4\u5df2\u8df3\u8fc7\u3002';
  if (step.status === 'PASS') {
    if (step.reason?.startsWith('node_visibility_not_confirmed:')) {
      return `通过：设备身份和命令读取正常；NodeDB 未列出对端 ${step.reason.replace('node_visibility_not_confirmed:', '')}，仅作为可见性备注，不判定前置检查失败。`;
    }
    if (step.api_dual_send && step.sent_messages?.length) {
      if (step.message_mode === 'device') return '\u901a\u8fc7\uff1a\u53cc\u5411\u70b9\u5bf9\u70b9\u53d1\u9001\u5747\u6536\u5230\u5bf9\u7aef\u771f\u5b9e ACK\uff0c\u4e14\u5bf9\u7aef\u63a5\u53e3\u6536\u5230\u540c\u4e00\u6761\u6587\u672c\u4e8b\u4ef6\u3002';
      return '\u901a\u8fc7\uff1a\u4e24\u53f0\u8bbe\u5907\u90fd\u5df2\u5728\u9009\u5b9a\u9891\u9053\u63a5\u6536\u5230\u5bf9\u7aef\u540c\u4e00\u6761\u6587\u672c\u4e8b\u4ef6\u3002';
    }
    if (step.info_summary?.public_key) return '\u901a\u8fc7\uff1a\u5df2\u8bfb\u53d6\u672c\u8bbe\u5907\u516c\u94a5\u3002';
    if (step.node_public_keys?.length) return '\u901a\u8fc7\uff1a\u5df2\u8bfb\u53d6 NodeDB \u53ef\u89c1\u6027\u8bc1\u636e\u3002';
    if (step.read_values?.length) return `\u901a\u8fc7\uff1a\u5df2\u8bfb\u53d6 ${step.read_values.map((item) => `${fieldDisplayName(item)} = ${item.display_value || item.value}`).join('\uff0c')}`;
    if (step.read_value) return `\u901a\u8fc7\uff1a\u5df2\u8bfb\u53d6 ${fieldDisplayName(step.read_value)} = ${step.read_value.display_value || step.read_value.value}`;
    if (step.direction && step.message && step.received_message) return `\u901a\u8fc7\uff1a${displayText(step.direction)} \u5df2\u53d1\u9001\u201c${step.message}\u201d\uff0c\u63a5\u6536\u7aef\u76d1\u542c\u5230\u8be5\u6d88\u606f\u3002`;
    if (step.direction && step.message) return `\u901a\u8fc7\uff1a${displayText(step.direction)} \u5df2\u53d1\u9001\u201c${step.message}\u201d\uff0c\u672c\u6b65\u9aa4\u5df2\u901a\u8fc7\u5bf9\u5e94\u8bc1\u636e\u6821\u9a8c\u3002`;
    return step.pass_criteria ? `\u901a\u8fc7\uff1a${displayText(step.pass_criteria)}` : '\u901a\u8fc7\uff1aCLI \u8fd4\u56de\u6210\u529f\u3002';
  }
  const combinedOutput = `${step.stdout || ''}\n${step.stderr || ''}`;
  // runner 给出的具体失败原因（含「下一步该查什么」）优先展示，便于定位问题。
  const runnerNote = String(step.failure_note || '').trim();
  if (runnerNote) return `\u672a\u901a\u8fc7\uff1a${runnerNote}`;
  if (/could not open port|serial device couldn't be opened|PermissionError|Cannot configure port|Connection timed out/i.test(combinedOutput)) {
    return '\u672a\u901a\u8fc7\uff1aCOM \u53e3\u53ef\u6253\u5f00\uff0c\u4f46\u8bbe\u5907\u6ca1\u6709\u5728\u8d85\u65f6\u65f6\u95f4\u5185\u5b8c\u6210 Meshtastic \u534f\u8bae\u63e1\u624b\u3002\u8bf7\u7b49\u8bbe\u5907\u8fdb\u5165\u4e3b\u754c\u9762\u540e\u91cd\u65b0\u626b\u63cf\u518d\u8fd0\u884c\u3002';
  }
  if (step.reason === 'connection_unavailable') return '\u672a\u901a\u8fc7\uff1aCOM \u53e3\u53ef\u6253\u5f00\uff0c\u4f46\u8bbe\u5907\u6ca1\u6709\u5728\u8d85\u65f6\u65f6\u95f4\u5185\u5b8c\u6210 Meshtastic \u534f\u8bae\u63e1\u624b\u3002\u7cfb\u7edf\u5df2\u81ea\u52a8\u91cd\u8bd5\uff1b\u4ecd\u5931\u8d25\u65f6\u901a\u5e38\u662f\u8bbe\u5907\u521a\u91cd\u542f\u3001USB CDC \u72b6\u6001\u5361\u4f4f\u6216\u56fa\u4ef6\u534f\u8bae\u6682\u672a\u54cd\u5e94\u3002';
  if (step.reason === 'mutating_command_timeout') return `\u672a\u901a\u8fc7\uff1a${step.failure_note || '\u5199\u64cd\u4f5c\u547d\u4ee4\u672a\u5728\u8d85\u65f6\u65f6\u95f4\u5185\u8fd4\u56de\uff08\u4e0d\u662f\u63e1\u624b\u5931\u8d25\uff09\u3002'}`;
  if (step.reason?.startsWith('node_not_found:')) return `\u672a\u901a\u8fc7\uff1aNodeDB \u4e2d\u6ca1\u6709\u770b\u5230\u5bf9\u7aef\u8282\u70b9 ${step.reason.replace('node_not_found:', '')}\u3002NodeDB \u53ef\u89c1\u6027\u4e0d\u7b49\u4e8e\u70b9\u5bf9\u70b9 ACK\u3002`;
  if (step.reason?.startsWith('missing_context:')) return `\u672a\u901a\u8fc7\uff1a\u7f3a\u5c11\u524d\u7f6e\u6570\u636e ${step.reason.replace('missing_context:', '')}\uff0c\u8bf7\u91cd\u65b0\u8fd0\u884c\u6d4b\u8bd5\u524d\u68c0\u67e5\u3002`;
  if (step.reason === 'unsupported_config_field') return '\u672a\u901a\u8fc7\uff1a\u5f53\u524d CLI/\u56fa\u4ef6\u6ca1\u6709\u66b4\u9732\u8fd9\u4e2a\u914d\u7f6e\u5b57\u6bb5\u3002';
  if (step.reason === 'config_mismatch') return `\u672a\u901a\u8fc7\uff1a\u901a\u4fe1\u5173\u952e\u914d\u7f6e\u4e0d\u4e00\u81f4\uff1a${(step.mismatch_summary || []).join('\uff0c')}`;
  if (step.reason === 'api_dual_missing_ack') return '\u672a\u901a\u8fc7\uff1a\u70b9\u5bf9\u70b9\u53d1\u9001\u672a\u6536\u5230\u5bf9\u7aef\u771f\u5b9e ACK\uff1b\u8bbe\u5907\u8702\u9e23\u6216\u9690\u5f0f ACK \u4e0d\u80fd\u8bc1\u660e\u6d88\u606f\u5df2\u9001\u8fbe\u3002';
  if (step.reason === 'api_dual_missing_receive') return '\u672a\u901a\u8fc7\uff1a\u53cc\u5411\u53d1\u9001\u5df2\u6267\u884c\uff0c\u4f46\u81f3\u5c11\u4e00\u53f0\u8bbe\u5907\u76d1\u542c\u8f93\u51fa\u91cc\u6ca1\u6709\u770b\u5230\u5bf9\u7aef\u6d88\u606f\u3002';
  if (step.reason === 'persistent_api_error') return '\u672a\u901a\u8fc7\uff1aPython API \u6301\u7eed\u4e32\u53e3\u901a\u4fe1\u5931\u8d25\uff0c\u8bf7\u5c55\u5f00\u8be6\u7ec6\u8bc1\u636e\u3002';
  if (step.reason === 'persistent_api_serial_only') return '\u672a\u901a\u8fc7\uff1a\u6301\u7eed\u8fde\u63a5\u901a\u4fe1\u5f53\u524d\u53ea\u652f\u6301\u4e24\u53f0\u4e32\u53e3\u8bbe\u5907\u3002';
  if (step.reason === 'no_received_message') return '\u672a\u901a\u8fc7\uff1a\u53d1\u9001\u547d\u4ee4\u5df2\u6267\u884c\uff0c\u4f46\u63a5\u6536\u7aef\u76d1\u542c\u8f93\u51fa\u6ca1\u6709\u5305\u542b\u8be5\u6d88\u606f\u3002';
  if (step.reason?.startsWith('forbidden_output')) return '\u672a\u901a\u8fc7\uff1aCLI \u8fd4\u56de NAK / MAX_RETRANSMIT / error reason\uff0c\u8bf4\u660e\u6d88\u606f\u672a\u88ab\u5bf9\u7aef ACK\u3002';
  if (step.reason?.startsWith('regex_not_matched')) return '\u672a\u901a\u8fc7\uff1aCLI \u6709\u8f93\u51fa\uff0c\u4f46\u6ca1\u6709\u627e\u5230\u672c\u7528\u4f8b\u8981\u6c42\u7684\u8bc1\u636e\u3002';
  if (step.reason === 'web_ble_config_readback_pending_after_reboot') {
    return `\u672a\u901a\u8fc7\uff1a${step.failure_note || '\u914d\u7f6e\u5199\u5165\u547d\u4ee4\u5df2\u53d1\u9001\uff0c\u4f46\u8bbe\u5907\u5728\u5e94\u7528\u914d\u7f6e\u65f6\u91cd\u542f BLE\uff0c\u8bfb\u56de\u672a\u5b8c\u6210\uff0c\u8bf7\u91cd\u65b0\u8fde\u63a5\u540e\u6838\u5bf9\u3002'}`;
  }
  if (step.reason === 'web_ble_config_error' || step.reason === 'web_ble_config_write_error') {
    const detail = String(step.failure_note || step.stderr || '').replace(/^Error:\s*/i, '').trim();
    return `\u672a\u901a\u8fc7\uff1a${detail || '\u6d4f\u89c8\u5668 GATT \u914d\u7f6e\u4e0b\u53d1\u672a\u5b8c\u6210\u3002'}`;
  }
  return reasonLabels[step.reason] || step.reason || '\u672a\u901a\u8fc7\uff1a\u8bf7\u5c55\u5f00\u547d\u4ee4\u8bc1\u636e\u3002';
}



function caseReason(item) {
  const status = caseStatus(item);
  if (status === 'PASS') return userPassReason(item);
  const issue = firstIssueStep(item);
  return issue ? friendlyReason(issue) : '\u672a\u901a\u8fc7\uff1arunner \u6ca1\u6709\u751f\u6210\u6709\u6548\u6b65\u9aa4\u7ed3\u679c\u3002';
}

function communicationCaseTitle(item) {
  const testData = String(item.test_data || '');
  const steps = item.steps || [];
  const stepMode = steps.find((step) => step.message_mode)?.message_mode || '';
  const sourceTitle = String(item.source_case || item.objective || '');
  const evidence = `${testData} ${stepMode} ${sourceTitle} ${steps.map((step) => step.name || '').join(' ')}`;
  if (/message_mode=device|\bdevice\b|点对点|对端设备|发给/.test(evidence)) return '点对点双向通信';
  if (/message_mode=channel|\bchannel\b|频道|发到频道/.test(evidence)) return '频道通信';
  return displayText(item.source_case || '通信验证');
}

function publicCaseTitle(item) {
  if (item.id === 'MT-COMM-EXPERIMENT') return communicationCaseTitle(item);
  // module 可能是英文（浏览器侧 BLE 结果曾用 "Config write"），这里统一走中文映射再兜底。
  const source = item.source_case || displayModuleName(item.module) || '\u672a\u547d\u540d\u7528\u4f8b';
  return displayText(source)
    .replace(/^MT-[A-Z0-9-]+\s*[·:：-]\s*/i, '')
    .trim();
}

function userPassReason(item) {
  const moduleName = displayText(item.module || '');
  const caseTitle = publicCaseTitle(item);
  const steps = item.steps || [];
  const hasSingleChannel = steps.some((step) => /single|channel/i.test(String(step.message_mode || step.name || step.action_summary || '')) && !step.listen_target);
  if (moduleName.includes('\u901a\u4fe1') || caseTitle.includes('\u901a\u4fe1') || caseTitle.includes('\u6d88\u606f')) {
    if (hasSingleChannel) return '\u9891\u9053\u6d88\u606f\u5df2\u4e0b\u53d1\u3002';
    return '\u6d88\u606f\u5df2\u6309\u9009\u5b9a\u65b9\u5f0f\u53d1\u9001\uff0c\u5e76\u83b7\u5f97\u63a5\u6536\u7aef\u8bc1\u636e\u3002';
  }
  if (moduleName.includes('\u914d\u7f6e') || caseTitle.includes('\u914d\u7f6e')) return '\u914d\u7f6e\u5df2\u5199\u5165\uff0c\u8bfb\u56de\u7ed3\u679c\u4e00\u81f4\u3002';
  if (moduleName.includes('\u68c0\u67e5') || caseTitle.includes('\u68c0\u67e5')) return '\u8bbe\u5907\u68c0\u67e5\u901a\u8fc7\u3002';
  return '\u5df2\u901a\u8fc7\u3002';
}

function summaryLines(summary) {
  if (!summary || !Object.keys(summary).length) return [];
  const labels = {
    node_id: '\u8282\u70b9 ID', public_key: '\u516c\u94a5', long_name: 'Long Name', short_name: 'Short Name', firmware: '\u56fa\u4ef6', hardware: '\u786c\u4ef6',
    role: 'Device Role', pio_env: 'PIO \u73af\u5883', reboot_count: '\u91cd\u542f\u8ba1\u6570', nodedb_count: 'NodeDB \u6570\u91cf',
  };
  return Object.entries(summary).map(([key, value]) => `${labels[key] || key}: ${value}`);
}

function inferStepTransport(step) {
  if (step.transport) return displayText(step.transport);
  const apiTransport = String(step.api_transport || '');
  if (apiTransport.includes('serial')) return `串口 / Python API (${apiTransport})`;
  const command = (step.command || []).join(' ');
  if (command.includes('--port')) return '串口 / CLI';
  if (command.includes('web-bluetooth')) return 'Web Bluetooth / GATT';
  return '';
}

function evidenceText(step, reportPath) {
  const chunks = [];
  const inferredTransport = inferStepTransport(step);
  if (inferredTransport) chunks.push(`执行通道：${inferredTransport}`);
  if (step.command?.length) chunks.push(`\u547d\u4ee4\uff1a ${commandText(step.command)}`);
  if (step.listen_command?.length) chunks.push(`\u63a5\u6536\u7aef\u547d\u4ee4\uff1a ${commandText(step.listen_command)}`);
  if (step.api_transport) chunks.push(`\u901a\u4fe1\u6267\u884c\u5668\uff1a ${step.api_transport}`);
  if (step.fallback_transport) chunks.push(`串口恢复路径：${displayText(step.fallback_from || '-')} -> ${displayText(step.fallback_transport)}`);
  if (step.visibility_note) chunks.push(`NodeDB 备注：${displayText(step.visibility_note)}`);
  if (step.ready_timeout != null) chunks.push(`\u63a5\u53e3\u5c31\u7eea\u7b49\u5f85\uff1a\u6700\u591a ${step.ready_timeout}s`);
  if (step.subscription_ready_wait != null) chunks.push(`\u63a5\u6536\u8ba2\u9605\u5c31\u7eea\u7b49\u5f85\uff1a ${step.subscription_ready_wait}s`);
  if (step.listen_ready_wait != null) chunks.push(`\u76d1\u542c\u7aef\u5c31\u7eea\u7b49\u5f85\uff1a ${step.listen_ready_wait}s`);
  if (step.display_dwell_sec != null) chunks.push(`\u53d1\u9001\u540e\u9a7b\u7559\u7b49\u5f85\uff1a ${step.display_dwell_sec}s`);
  if (step.primary_ack || step.peer_ack) chunks.push(`\u70b9\u5bf9\u70b9 ACK\uff1a\u8bbe\u5907 1=${step.primary_ack || '-'}\uff1b\u8bbe\u5907 2=${step.peer_ack || '-'}`);
  chunks.push(`\u76ee\u6807\uff1a ${stableStepTargetLabel(step, 'target', 'target_label')}`);
  if (step.listen_target) chunks.push(`\u63a5\u6536\u7aef\uff1a ${stableStepTargetLabel(step, 'listen_target', 'listen_target_label')}`);
  if (step.action_summary) chunks.push(`\u52a8\u4f5c\uff1a ${displayText(step.action_summary)}`);
  if (step.direction) chunks.push(`\u65b9\u5411\uff1a ${displayText(step.direction)}`);
  if (step.message) chunks.push(`\u6d88\u606f\uff1a ${step.message}`);
  if (step.sent_messages?.length) {
    chunks.push(`\u53cc\u5411\u53d1\u9001\uff1a\n${step.sent_messages.map((item) => `${endpointLabel(item.from)} -> ${endpointLabel(item.to)}: ${item.message}; packet=${item.packet_id || '-'}; ACK=${item.ack || '-'}; \u63a5\u6536=${item.received ? '\u662f' : '\u5426'}`).join('\n')}`);
  }
  if (step.received_messages?.length) {
    chunks.push(`\u5df2\u76d1\u542c\u6d88\u606f\uff1a\n${step.received_messages.map((item) => `${endpointLabel(item.target)} \u6536\u5230\uff1a ${item.text}; packet=${item.id || '-'}; from=${item.from || '-'}; to=${item.to || '-'}; \u9891\u9053=${item.channel}`).join('\n')}`);
  }
  if (step.receive_wait != null) chunks.push(`\u63a5\u6536\u7b49\u5f85\uff1a ${step.receive_wait}s`);
  if (step.captured_node_id) chunks.push(`\u8282\u70b9 ID\uff1a ${step.captured_node_id}`);
  if (step.contact_url) chunks.push(`\u8054\u7cfb\u4eba URL\uff1a ${step.contact_url}`);
  if (step.read_values?.length) chunks.push(`\u8bfb\u53d6\u503c\uff1a\n${step.read_values.map((item) => `${fieldDisplayName(item)} = ${item.display_value || item.value}`).join('\n')}`);
  if (!step.read_values?.length && step.read_value) chunks.push(`\u8bfb\u53d6\u503c\uff1a ${fieldDisplayName(step.read_value)} = ${step.read_value.display_value || step.read_value.value}`);
  if (step.mismatch_summary?.length) chunks.push(`\u4e0d\u4e00\u81f4\u9879\uff1a\n${step.mismatch_summary.join('\n')}`);
  const parsed = summaryLines(step.info_summary);
  if (parsed.length) chunks.push(`\u89e3\u6790\u6458\u8981\uff1a\n${parsed.join('\n')}`);
  if (step.duration_sec != null) chunks.push(`\u8017\u65f6\uff1a ${step.duration_sec}s`);
  if (step.sensitive_output) chunks.push('\u654f\u611f\u8f93\u51fa\u5df2\u9690\u85cf\u3002');
  const stdout = (step.stdout || '').trim();
  const stderr = (step.stderr || '').trim();
  const listenStdout = (step.listen_stdout || '').trim();
  const listenStderr = (step.listen_stderr || '').trim();
  if (stdout && !step.sensitive_output) chunks.push(`stdout:\n${stdout.slice(0, 1200)}${stdout.length > 1200 ? '\n...\u5b8c\u6574\u8f93\u51fa\u89c1 JSON \u62a5\u544a' : ''}`);
  if (stderr) chunks.push(`stderr:\n${stderr.slice(0, 800)}${stderr.length > 800 ? '\n...\u5b8c\u6574\u8f93\u51fa\u89c1 JSON \u62a5\u544a' : ''}`);
  if (listenStdout) chunks.push(`\u63a5\u6536\u7aef stdout:\n${listenStdout.slice(0, 1200)}${listenStdout.length > 1200 ? '\n...\u5b8c\u6574\u8f93\u51fa\u89c1 JSON \u62a5\u544a' : ''}`);
  if (listenStderr) chunks.push(`\u63a5\u6536\u7aef stderr:\n${listenStderr.slice(0, 800)}${listenStderr.length > 800 ? '\n...\u5b8c\u6574\u8f93\u51fa\u89c1 JSON \u62a5\u544a' : ''}`);
  if (reportPath) chunks.push(`\u62a5\u544a\uff1a ${reportPath}`);
  return chunks.join('\n\n');
}

function caseEvidence(item, reportPath) {
  const lines = [];
  for (const step of item.steps || []) {
    lines.push(`\u6b65\u9aa4 ${step.index || '-'} / ${step.total || '-'}\uff1a${displayText(step.name || '-')}\n\u72b6\u6001\uff1a${displayStatus(step.status)}\n\u539f\u56e0\uff1a${friendlyReason(step)}\n\n${evidenceText(step, '')}`);
  }
  if (reportPath) lines.push(`\u62a5\u544a\uff1a ${reportPath}`);
  return lines.join('\n\n---\n\n');
}

function syntheticRunResult(data) {
  return {
    cases: [{
      id: data.id || 'RUN',
      module: '\u8fd0\u884c\u5f02\u5e38',
      source_case: 'runner \u672a\u751f\u6210\u62a5\u544a',
      objective: '\u540e\u53f0\u4efb\u52a1\u5df2\u7ed3\u675f\uff0c\u4f46\u6ca1\u6709\u8fd4\u56de\u53ef\u5c55\u793a\u7684\u7528\u4f8b\u7ed3\u679c\u3002',
      steps: [{
        name: data.status || '\u672a\u77e5\u72b6\u6001',
        target: 'both',
        status: 'FAIL',
        reason: data.error || data.stderr || 'no_report_result',
        stderr: data.stderr || '',
        command: data.command || [],
      }],
    }],
  };
}

function renderResults() {
  syncResultFilterButtons();
  const list = $('resultList');
  list.classList.remove('empty');
  list.innerHTML = '';
  const cases = flattenCases().filter(({ status }) => !state.resultFilter || status === state.resultFilter);
  if (!cases.length) {
    list.classList.add('empty');
    list.textContent = state.resultFilter ? `\u6682\u65e0${displayStatus(state.resultFilter)}\u7ed3\u679c` : '\u6682\u65e0\u6267\u884c\u7ed3\u679c';
    return;
  }
  for (const { run, item, status } of cases.slice().reverse()) {
    const row = document.createElement('article');
    row.className = 'result-item';
    row.dataset.resultCard = 'true';
    const retryButton = run.payload ? `<button class="mini-action" type="button" data-retry-run="${escapeHtml(run.id)}">\u91cd\u8bd5\u672c\u8f6e</button>` : '';
    const failedStep = (item.steps || []).find((step) => step.status === 'FAIL' && step.command?.length && !step.mutating);
    const retryStepButton = failedStep ? `<button class="mini-action" type="button" data-retry-step="${escapeHtml(run.id)}" data-case-id="${escapeHtml(item.id)}" data-step-index="${escapeHtml(failedStep.index)}">\u91cd\u8bd5\u5931\u8d25\u6b65\u9aa4</button>` : '';
    row.innerHTML = `
      <header>
        <div>
          <strong>${escapeHtml(publicCaseTitle(item))}</strong>
          <span>${escapeHtml(displayModuleName(item.module))} \u00b7 ${escapeHtml(run.label)}</span>
        </div>
        <div class="result-status">
          <span class="status ${escapeHtml(status)}">${escapeHtml(displayStatus(status))}</span>
          ${retryStepButton}
          ${retryButton}
        </div>
      </header>
      <p class="result-reason">${escapeHtml(caseReason(item))}</p>
      <details>
        <summary>详情</summary>
        <code>${escapeHtml(caseEvidence(item, run.report))}</code>
      </details>
    `;
    row.addEventListener('click', (event) => {
      if (event.target.closest('button, summary, a')) return;
      const details = row.querySelector('details');
      if (details) details.open = !details.open;
    });
    list.appendChild(row);
  }
  list.querySelectorAll('[data-retry-run]').forEach((button) => {
    button.addEventListener('click', () => {
      const run = state.runs.find((item) => item.id === button.dataset.retryRun);
      if (run?.payload) runExistingPayload(run.payload, `\u91cd\u8bd5 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
    });
  });
  list.querySelectorAll('[data-retry-step]').forEach((button) => {
    button.addEventListener('click', () => retryFailedStep(button.dataset.retryStep, button.dataset.caseId, Number(button.dataset.stepIndex || 0)));
  });
}

async function retryFailedStep(runId, caseId, stepIndex) {
  const run = state.runs.find((item) => item.id === runId);
  const item = (run?.result?.cases || []).find((candidate) => candidate.id === caseId);
  const step = (item?.steps || []).find((candidate) => Number(candidate.index || 0) === Number(stepIndex || 0));
  if (!run || !item || !step) {
    setEvidenceText('未找到可重试的失败步骤。');
    return;
  }
  if (step.mutating) {
    setEvidenceText('写入/发送类步骤不支持直接单步重试，请重新运行对应用例。');
    return;
  }
  try {
    setRunning(true);
    const stepName = displayText(step.name || '-');
    $('runState').textContent = '\u5355\u6b65\u91cd\u8bd5';
    $('runState').className = 'badge running';
    renderProgress({
      done: 0,
      total: 1,
      percent: 0,
      current: { step: `\u6b63\u5728\u91cd\u8bd5\uff1a${stepName}` },
      events: [{ index: 1, total: 1, step: stepName, status: 'RUNNING' }],
    });
    setEvidenceText(`\u6b63\u5728\u91cd\u8bd5\u5931\u8d25\u6b65\u9aa4\uff1a${stepName}\n\u5f53\u524d\u64cd\u4f5c\uff1a\u91cd\u65b0\u6253\u5f00\u4e32\u53e3\u5e76\u6267\u884c\u8bfb\u53d6\u547d\u4ee4`);
    const data = await api('/api/run-step', {
      method: 'POST',
      body: JSON.stringify({ runId, caseId, caseTitle: item.source_case || item.module || caseId, step, timeout: Number($('timeout')?.value || 30) }),
    });
    const retryRun = {
      id: data.id || `step-${Date.now()}`,
      status: data.status || 'done',
      label: `单步重试 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`,
      result: data.result || syntheticRunResult({ status: 'retry_failed', error: 'no_retry_result' }),
      report: data.report || run.report || '',
      payload: null,
    };
    state.runs.push(retryRun);
    summarize();
    renderResults();
    const retryCase = (retryRun.result?.cases || [])[0] || {};
    const retryStep = (retryCase.steps || [])[0] || {};
    renderProgress({
      done: 1,
      total: 1,
      percent: 100,
      current: { status: retryStep.status || retryRun.status },
      events: [{ index: 1, total: 1, step: retryStep.name || stepName, status: retryStep.status || retryRun.status }],
    });
    setEvidenceText(caseEvidence(retryCase, retryRun.report));
  } catch (error) {
    setEvidenceText(`失败步骤重试失败: ${error.message}`);
  } finally {
    setRunning(false);
  }
}

function syncResultFilterButtons() {
  document.querySelectorAll('[data-result-filter]').forEach((item) => {
    item.classList.toggle('active', item.dataset.resultFilter === state.resultFilter);
  });
}


async function scanPorts() {
  const list = $('portList');
  list.classList.remove('empty');
  list.textContent = '\u626b\u63cf\u4e32\u53e3\u4e2d...';
  try {
    const data = await api('/api/ports');
    state.ports = data.ports || [];
    renderPorts();
    refreshCustomSelects();
  } catch (error) {
    list.classList.add('empty');
    list.textContent = error.message;
  }
}

function fillSelect(select, placeholder, selectedValue, ...blockedValues) {
  const blocked = new Set(blockedValues.filter(Boolean));
  select.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = placeholder;
  select.appendChild(empty);
  for (const port of state.ports) {
    const option = document.createElement('option');
    option.value = port.port;
    option.textContent = port.port;
    option.disabled = blocked.has(port.port);
    select.appendChild(option);
  }
  if (selectedValue && !blocked.has(selectedValue) && state.ports.some((port) => port.port === selectedValue)) select.value = selectedValue;
  syncCustomSelect(select);
}

function fillLogPortSelect() {
  const select = $('logPort');
  if (!select) return;
  const selected = select.value;
  const blocked = new Set([$('primaryPort')?.value, $('peerPort')?.value, $('observerPort')?.value].filter(Boolean));
  select.innerHTML = '<option value="">\u9009\u62e9\u65e5\u5fd7\u4e32\u53e3</option>';
  for (const port of state.ports) {
    const option = document.createElement('option');
    option.value = port.port;
    option.textContent = port.port;
    option.disabled = blocked.has(port.port);
    select.appendChild(option);
  }
  if (selected && !blocked.has(selected) && state.ports.some((port) => port.port === selected)) select.value = selected;
  select.disabled = Boolean(state.serialLogId);
  if ($('logBaud')) $('logBaud').disabled = Boolean(state.serialLogId);
  syncCustomSelect(select);
}

function syncPortSelectors() {
  const primary = $('primaryPort').value;
  const peer = $('peerPort').value;
  const observer = $('observerPort')?.value || '';
  fillSelect($('primaryPort'), '\u9009\u62e9\u6d4b\u8bd5\u8bbe\u59071', primary, peer, observer);
  fillSelect($('peerPort'), '\u9009\u62e9\u6d4b\u8bd5\u8bbe\u59072', peer, primary, observer);
  if ($('observerPort')) fillSelect($('observerPort'), '\u9009\u62e9\u6d4b\u8bd5\u8bbe\u59073', observer, primary, peer);
  fillLogPortSelect();
  updateDisconnectButton();
}

// 默认收起测试设备3；收起时它的选择值不参与运行参数（等价于"没接观察者"）。
function observerExpanded() {
  const field = $('observerField');
  return Boolean(field) && !field.classList.contains('hidden');
}

function setObserverExpanded(expanded) {
  const field = $('observerField');
  const toggle = $('toggleObserver');
  if (!field) return;
  field.classList.toggle('hidden', !expanded);
  if (toggle) toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  if (!expanded && $('observerPort')) $('observerPort').value = '';
  syncPortSelectors();
  resetDeviceIdentity();
}

// 未选择任何串口时「断开串口」置灰不可点击。
function updateDisconnectButton() {
  const button = $('disconnectSerial');
  if (!button) return;
  const anySelected = ['primaryPort', 'peerPort', 'observerPort']
    .some((id) => ($(id)?.value || '').trim());
  button.disabled = !anySelected;
}

function cleanPortDeviceText(item) {
  const assigned = assignedPortDeviceId(item.port);
  if (assigned) return formatDeviceIdentifier(assigned);
  if (item.usbSerial) return formatDeviceIdentifier(item.usbSerial);
  if (item.deviceId) return formatDeviceIdentifier(item.deviceId);
  if (item.usbId) return String(item.usbId || '').trim().replace(/^USB\s+/i, '').toUpperCase();
  const candidates = [item.usbSerial, item.name, item.manufacturer]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  for (const value of candidates) {
    if (/[\\&]/.test(value) || /USB实例|VID_|PID_|MI_|USB\\|0000/i.test(value) || value.length > 34) continue;
    return value.replace(/\s*\(COM\d+\)\s*/i, '').trim();
  }
  return item.likelyDevice ? 'Meshtastic 串口' : 'USB 串行设备';
}

function formatDeviceIdentifier(value) {
  const text = String(value || '').trim().replace(/^USB\s+/i, '');
  if (!text) return '';
  if (text.includes(':')) return text.toUpperCase();
  const hex = text.replace(/^!/, '').replace(/[^0-9a-f]/gi, '');
  if (hex.length >= 4 && hex.length <= 16 && hex.length % 2 === 0) {
    return hex.toUpperCase().match(/.{1,2}/g).join(':');
  }
  return text;
}

function renderPorts() {
  const list = $('portList');
  list.innerHTML = '';
  if (!state.ports.length) {
    list.classList.add('empty');
    list.textContent = '\u672a\u626b\u63cf\u5230\u4e32\u53e3';
    syncPortSelectors();
    return;
  }
  list.classList.remove('empty');
  for (const item of state.ports) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = item.likelyDevice ? 'port-chip likely' : 'port-chip';
    const deviceText = cleanPortDeviceText(item);
    button.innerHTML = `<strong>${escapeHtml(item.port)}</strong><span>${escapeHtml(deviceText)}</span>`;
    button.addEventListener('click', () => {
      $('connectionType').value = 'port';
      showConnectionFields();
      if (!$('primaryPort').value) $('primaryPort').value = item.port;
      else if (!$('peerPort').value && $('primaryPort').value !== item.port) $('peerPort').value = item.port;
      syncPortSelectors();
      resetDeviceIdentity();
    });
    list.appendChild(button);
  }
  syncPortSelectors();
}

// 设备显示名统一入口：只用「真实名字」，绝不用 device.id 顶替。
// 名字来源优先级：当前 device.name → 扫描时记住的名字 → 设备列表里的名字 → 'Meshtastic BLE'。
function rememberBleDeviceName(device) {
  const id = device?.id || '';
  const name = typeof device?.name === 'string' ? device.name.trim() : '';
  if (id && name) browserBleDeviceNames.set(id, name);
  return name;
}

function bleDeviceDisplayName(device, role = '', fallback = 'Meshtastic BLE') {
  const live = typeof device?.name === 'string' ? device.name.trim() : '';
  if (live) return live;
  const id = device?.id || (role ? state.connectedBleDeviceIds[role] : '') || browserBleLastDeviceIds.get(role) || '';
  if (!id) return fallback;
  const remembered = browserBleDeviceNames.get(id);
  if (remembered) return remembered;
  const listItem = [...(state.bleDevicesByRole.primary || []), ...(state.bleDevicesByRole.peer || [])]
    .find((item) => item.id === id && item.name);
  return listItem?.name || fallback;
}

async function scanBleDevices(role = 'primary') {
  const list = bleListForRole(role);
  if (!list) return;
  if (WEB_BLE_SINGLE_DEVICE_ONLY && role !== 'primary') {
    list.classList.add('empty');
    list.textContent = '当前 BLE 先只支持单设备连接，请使用测试设备 1 BLE。';
    setBleRoleStatus(role, '当前 BLE 先只支持单设备连接。', 'warn');
    return;
  }
  if (!navigator.bluetooth?.requestDevice) {
    list.classList.add('empty');
    list.textContent = '当前浏览器不支持 Web Bluetooth。请使用 Chrome / Edge，并通过 http://127.0.0.1 或 HTTPS 打开页面。';
    setBleRoleStatus(role, '浏览器不支持 Web Bluetooth。', 'error');
    return;
  }
  list.classList.add('empty');
  list.textContent = '请选择 BLE 设备。';
  setBleRoleStatus(role, '请选择 BLE 设备。', 'info');
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [MESHTASTIC_BLE_SERVICE_UUID] }],
      optionalServices: [MESHTASTIC_BLE_SERVICE_UUID],
    });
    browserBleDevices.set(device.id, device);
    rememberBleDeviceName(device);
    device.addEventListener('gattserverdisconnected', () => {
      for (const [role, id] of Object.entries(state.connectedBleDeviceIds)) {
        if (id === device.id) {
          browserBleLastDeviceIds.set(role, device.id);
          if (browserBleReconnectingRoles.has(role)) continue;
          state.connectedBleDeviceIds[role] = '';
          browserBleTransports.delete(role);
          setBleRoleStatus(
            role,
            state.running
              ? `BLE 已断开：${bleDeviceDisplayName(device, role)}（任务会自动尝试重连）`
              : `BLE 已断开：${bleDeviceDisplayName(device, role)}`,
            'warn',
          );
        }
      }
      renderBleDevices('primary');
      renderBleDevices('peer');
    });
    const displayName = bleDeviceDisplayName(device, role);
    const item = {
      id: device.id,
      name: displayName,
      address: device.id,
      value: displayName,
      transport: 'web-bluetooth',
    };
    state.bleDevices = [item, ...state.bleDevices.filter((existing) => existing.id !== device.id)];
    state.bleDevicesByRole[role] = [item, ...(state.bleDevicesByRole[role] || []).filter((existing) => existing.id !== device.id)];
    state.selectedBleDeviceIds[role] = device.id;
    const input = bleInputForRole(role);
    if (input) input.value = displayName;
    $('connectionType').value = 'ble';
    showConnectionFields();
    renderBleDevices(role);
    setBleRoleStatus(role, `已选择：${displayName}，请点击“连接 BLE”。`, 'success');
  } catch (error) {
    if (error?.name === 'NotFoundError') {
      list.classList.add('empty');
      list.textContent = '已取消选择或未发现 Meshtastic BLE 设备。';
      setBleRoleStatus(role, '未选择 BLE 设备。', 'warn');
      return;
    }
    list.classList.add('empty');
    list.textContent = `BLE 扫描失败: ${friendlyBleError(error)}`;
    setBleRoleStatus(role, `扫描失败：${friendlyBleError(error)}`, 'error');
  }
}

function assignBleTarget(value, role = 'primary') {
  if (!value) return;
  $('connectionType').value = 'ble';
  showConnectionFields();
  const input = bleInputForRole(role);
  if (input) input.value = value;
}

function renderBleDevices(role = 'primary') {
  const list = bleListForRole(role);
  if (!list) return;
  list.innerHTML = '';
  const items = state.bleDevicesByRole[role] || [];
  if (!items.length) {
    list.classList.add('empty');
    list.textContent = `点击“扫描 BLE”后选择${bleRoleLabel(role)}。`;
    return;
  }
  list.classList.remove('empty');
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = item.id === state.selectedBleDeviceIds[role] ? 'ble-chip selected' : 'ble-chip';
    const value = item.value || item.name || '';
    const connected = state.connectedBleDeviceIds[role] === item.id && hasConnectedBleRole(role);
    const connectedLabel = connected ? `${bleRoleLabel(role)} GATT 已连接` : '已由浏览器识别';
    button.innerHTML = `<strong>${escapeHtml(item.name || 'Meshtastic BLE')}</strong><span>${connected ? connectedLabel : '已由浏览器识别'}</span>`;
    button.addEventListener('click', () => {
      state.selectedBleDeviceIds[role] = item.id || '';
      assignBleTarget(value, role);
      renderBleDevices(role);
      setBleRoleStatus(role, `${bleRoleLabel(role)} 已选择：${value}`, 'success');
    });
    list.appendChild(button);
  }
}

function encodeVarint(value) {
  let num = Number(value >>> 0);
  const bytes = [];
  while (num > 127) {
    bytes.push((num & 0x7f) | 0x80);
    num = Math.floor(num / 128);
  }
  bytes.push(num);
  return bytes;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, item) => sum + item.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const item of parts) {
    out.set(item, offset);
    offset += item.length;
  }
  return out;
}

function protoVarint(field, value) {
  return Uint8Array.from([...encodeVarint((field << 3) | 0), ...encodeVarint(value)]);
}

function protoBytes(field, value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return Uint8Array.from([...encodeVarint((field << 3) | 2), ...encodeVarint(bytes.length), ...bytes]);
}

function protoFixed32(field, value) {
  const bytes = new Uint8Array(5);
  bytes[0] = (field << 3) | 5;
  new DataView(bytes.buffer).setUint32(1, Number(value >>> 0), true);
  return bytes;
}

function protoFloat32(field, value) {
  const bytes = new Uint8Array(5);
  bytes[0] = (field << 3) | 5;
  new DataView(bytes.buffer).setFloat32(1, Number(value || 0), true);
  return bytes;
}

function protoString(field, value) {
  return protoBytes(field, new TextEncoder().encode(String(value ?? '')));
}

// 解析子配置时把原始字节挂在解析结果上：写入必须“整段合并写回”，不能只发被改的字段。
function withRawBytes(parsed, bytes) {
  if (parsed && bytes instanceof Uint8Array) parsed.__raw = bytes;
  return parsed;
}

// 把 readProtoFields() 读出来的一条字段原样编码回去（保留线类型，做到无损）。
function protoFieldBytes(item) {
  if (item.wire === 2) return protoBytes(item.field, item.value);
  if (item.wire === 5) return protoFixed32(item.field, item.value);
  return protoVarint(item.field, item.value);
}

/**
 * 用 replacements（同号字段）覆盖 original 里的字段，其余字段原样保留。
 * Meshtastic 的 set_config / set_module_config 是“整段替换”：只发几个字段会把
 * 同一子配置的其它字段重置成 protobuf 默认值（use_preset/bandwidth/spread_factor…），
 * 固件校验不通过时整条写入被丢弃——这就是“写下去读回还是旧值”的原因。
 * CLI 的做法是先把设备当前配置整段读出来、改一个字段、再整段写回，这里保持一致。
 */
function mergeProtoMessage(original, replacements) {
  const replaced = new Set((replacements || []).map((item) => item.field));
  const parts = [];
  for (const item of readProtoFields(original || new Uint8Array())) {
    if (replaced.has(item.field)) continue;
    parts.push(protoFieldBytes(item));
  }
  for (const item of replacements || []) {
    if (item.wire === 2) parts.push(protoBytes(item.field, item.value));
    else if (item.wire === 5) parts.push(protoFixed32(item.field, item.value));
    else parts.push(protoVarint(item.field, item.value || 0));
  }
  return concatBytes(parts);
}

function bleRawSubConfigBytes(role, section, key) {
  const transport = browserBleTransports.get(role);
  const source = section === 'moduleConfig' ? transport?.moduleConfigs : transport?.configs;
  const raw = source?.[key]?.__raw;
  return raw instanceof Uint8Array && raw.length ? raw : null;
}

// 写入某个子配置段时，先拿设备最近一次上报的整段字节做底，再只替换目标字段。
function mergeBleSubConfig(role, section, key, replacements) {
  const original = bleRawSubConfigBytes(role, section, key);
  return { bytes: mergeProtoMessage(original, replacements), merged: Boolean(original) };
}

function nodeIdToNum(nodeId) {
  const clean = String(nodeId || '').trim();
  if (!clean || clean === '^all') return BROADCAST_NUM;
  const hex = clean.replace(/^!/, '').replace(/^0x/i, '').slice(-8);
  const parsed = Number.parseInt(hex, 16);
  return Number.isFinite(parsed) ? parsed >>> 0 : BROADCAST_NUM;
}

function createDataToRadio({ portNum, payload, channel = 0, destNodeId = '', wantAck = false, wantResponse = false, pkiEncrypted = false, publicKeyBase64 = '' }) {
  const data = concatBytes([
    protoVarint(1, portNum),
    protoBytes(2, payload),
    wantResponse ? protoVarint(3, 1) : new Uint8Array(),
  ]);
  const packetId = Math.floor(Math.random() * 0xffffffff) >>> 0;
  const publicKey = publicKeyBase64 ? base64ToBytes(publicKeyBase64) : null;
  const meshPacket = concatBytes([
    protoFixed32(2, nodeIdToNum(destNodeId)),
    protoVarint(3, Number(channel || 0)),
    protoBytes(4, data),
    protoFixed32(6, packetId),
    protoVarint(9, DEFAULT_BLE_HOP_LIMIT),
    wantAck ? protoVarint(10, 1) : new Uint8Array(),
    protoVarint(11, MESH_PACKET_PRIORITY_RELIABLE),
    publicKey ? protoBytes(16, publicKey) : new Uint8Array(),
    pkiEncrypted ? protoVarint(17, 1) : new Uint8Array(),
  ]);
  return { bytes: protoBytes(1, meshPacket), packetId };
}

function createTextToRadio(message, channel, destNodeId = '', publicKeyBase64 = '') {
  return createDataToRadio({
    portNum: TEXT_MESSAGE_APP,
    payload: new TextEncoder().encode(message),
    channel,
    destNodeId,
    wantAck: Boolean(destNodeId),
    pkiEncrypted: Boolean(destNodeId && publicKeyBase64),
    publicKeyBase64,
  });
}

function createWantConfigToRadio() {
  const configId = Math.floor(Date.now() % 0x7fffffff) >>> 0;
  return { bytes: protoVarint(3, configId), configId };
}

function createWantConfigToRadioWithNonce(configId) {
  return { bytes: protoVarint(3, configId >>> 0), configId: configId >>> 0 };
}

function createHeartbeatToRadio() {
  const nonce = bleHeartbeatNonce++;
  if (bleHeartbeatNonce === 1) bleHeartbeatNonce = 2;
  return { bytes: protoBytes(7, protoVarint(1, nonce >>> 0)), nonce };
}

function createAdminToRadio(adminPayload, { destNodeId = '', channel = 0, wantResponse = true, pkiEncrypted = false } = {}) {
  return createDataToRadio({
    portNum: ADMIN_APP,
    payload: adminPayload,
    channel,
    destNodeId,
    wantAck: true,
    wantResponse,
    pkiEncrypted,
  });
}

function createAdminGetConfigToRadio(configType, destNodeId = '') {
  return createAdminToRadio(protoVarint(5, configType), {
    destNodeId,
    wantResponse: true,
    pkiEncrypted: Boolean(destNodeId),
  });
}

function createAdminGetModuleConfigToRadio(configType, destNodeId = '') {
  return createAdminToRadio(protoVarint(7, configType), {
    destNodeId,
    wantResponse: true,
    pkiEncrypted: Boolean(destNodeId),
  });
}

function createAdminGetChannelToRadio(index, destNodeId = '') {
  // Meshtastic AdminMessage.get_channel_request is 1-based; Channel.index is 0-based.
  return createAdminToRadio(protoVarint(1, Number(index || 0) + 1), {
    destNodeId,
    wantResponse: true,
    pkiEncrypted: Boolean(destNodeId),
  });
}

function createAdminGetOwnerToRadio(destNodeId = '') {
  return createAdminToRadio(protoVarint(3, 1), {
    destNodeId,
    wantResponse: true,
    pkiEncrypted: Boolean(destNodeId),
  });
}

function createAdminSetConfigToRadio(configPayload, destNodeId = '') {
  return createAdminToRadio(protoBytes(34, configPayload), { destNodeId, wantResponse: true });
}

function createAdminSetModuleConfigToRadio(configPayload, destNodeId = '') {
  return createAdminToRadio(protoBytes(35, configPayload), { destNodeId, wantResponse: true });
}

function createAdminSetChannelToRadio(channelPayload, destNodeId = '') {
  return createAdminToRadio(protoBytes(33, channelPayload), { destNodeId, wantResponse: true });
}

function createAdminSetOwnerToRadio(userPayload, destNodeId = '') {
  return createAdminToRadio(protoBytes(32, userPayload), { destNodeId, wantResponse: true });
}

function readVarint(bytes, cursor) {
  let shift = 0;
  let value = 0;
  while (cursor.index < bytes.length) {
    const b = bytes[cursor.index++];
    value += (b & 0x7f) * (2 ** shift);
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return value >>> 0;
}

function readProtoFields(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const cursor = { index: 0 };
  const fields = [];
  while (cursor.index < bytes.length) {
    const key = readVarint(bytes, cursor);
    const field = key >> 3;
    const wire = key & 7;
    if (wire === 0) {
      fields.push({ field, wire, value: readVarint(bytes, cursor) });
    } else if (wire === 2) {
      const length = readVarint(bytes, cursor);
      const value = bytes.slice(cursor.index, cursor.index + length);
      cursor.index += length;
      fields.push({ field, wire, value });
    } else if (wire === 5) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + cursor.index, 4);
      fields.push({ field, wire, value: view.getUint32(0, true), floatValue: view.getFloat32(0, true) });
      cursor.index += 4;
    } else {
      break;
    }
  }
  return fields;
}

function parseMeshData(bytes) {
  const data = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) data.portnum = item.value;
    if (item.field === 2) data.payload = item.value;
    if (item.field === 3) data.want_response = Boolean(item.value);
    if (item.field === 6) data.request_id = item.value;
  }
  if (data.portnum === TEXT_MESSAGE_APP && data.payload) data.text = decodeTextMessagePayload(data.payload);
  if (data.portnum === ADMIN_APP && data.payload) data.admin = parseAdminMessage(data.payload);
  return data;
}

function bytesToHexString(bytes) {
  return [...(bytes || [])].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// 设备读回的频道 PSK：解析层存的是 base64（空 = 该频道没有密钥），统一转成十六进制便于与写入值比对。
function channelPskHexFromSettings(settings) {
  if (!settings?.psk) return '';
  const bytes = base64ToBytes(settings.psk);
  return bytes ? bytesToHexString(bytes) : '';
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes || []) binary += String.fromCharCode(byte);
  return binary ? btoa(binary) : '';
}

function base64ToBytes(value) {
  const clean = String(value || '').trim().replace(/^base64:/, '');
  if (!clean) return null;
  try {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

function nodeNumToId(num) {
  const hex = Number(num >>> 0).toString(16).padStart(8, '0');
  return `!${hex}`;
}

function decodeProtoString(value) {
  try { return new TextDecoder().decode(value); } catch { return ''; }
}

function decodeTextMessagePayload(value) {
  const text = decodeProtoString(value || new Uint8Array());
  if (!text) return '';
  const visible = [...text].filter((char) => {
    const code = char.charCodeAt(0);
    return char === '\n' || char === '\r' || char === '\t' || code >= 32;
  }).length;
  return visible / Math.max(1, text.length) >= 0.9 ? text : '';
}

function parseUser(bytes) {
  const user = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) user.id = decodeProtoString(item.value);
    if (item.field === 2) user.long_name = decodeProtoString(item.value);
    if (item.field === 3) user.short_name = decodeProtoString(item.value);
    if (item.field === 8) user.public_key = bytesToBase64(item.value);
  }
  return user;
}

function parseMyNodeInfo(bytes) {
  const info = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) {
      info.num = item.value;
      info.node_id = nodeNumToId(item.value);
    }
    if (item.field === 12) info.device_id = decodeProtoString(item.value);
  }
  return info;
}

function parseNodeInfo(bytes) {
  const node = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) {
      node.num = item.value;
      node.node_id = nodeNumToId(item.value);
    }
    if (item.field === 2) node.user = parseUser(item.value);
  }
  return node;
}

function parseLoRaConfig(bytes) {
  const config = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) config.usePreset = Boolean(item.value);
    if (item.field === 2) config.modemPreset = MODEM_NAMES[item.value] || String(item.value);
    if (item.field === 7) config.region = REGION_NAMES[item.value] || String(item.value);
    if (item.field === 8) config.hopLimit = item.value;
    if (item.field === 9) config.txEnabled = Boolean(item.value);
    if (item.field === 11) config.channelNum = item.value;
    if (item.field === 14) config.overrideFrequency = Number(item.floatValue || 0);
  }
  if (config.modemPreset === undefined) config.modemPreset = MODEM_NAMES[0] || 'LONG_FAST';
  if (config.overrideFrequency === undefined) config.overrideFrequency = 0;
  return config;
}

function parseDeviceConfig(bytes) {
  const config = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) config.role = DEVICE_ROLE_NAMES[item.value] || String(item.value);
    // DeviceConfig 11 = tzdef（POSIX TZ 字符串，例如中国 CST-8）
    if (item.field === 11) config.tzdef = decodeProtoString(item.value);
  }
  if (config.role === undefined) config.role = DEVICE_ROLE_NAMES[0] || 'CLIENT';
  return config;
}

function parseNetworkConfig(bytes) {
  const config = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) config.wifiEnabled = Boolean(item.value);
    if (item.field === 3) config.wifiSsid = decodeProtoString(item.value);
    if (item.field === 4) config.wifiPsk = decodeProtoString(item.value);
  }
  return config;
}

function parseBluetoothConfig(bytes) {
  const config = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) config.enabled = Boolean(item.value);
    if (item.field === 2) config.mode = item.value;
    if (item.field === 3) config.fixedPin = item.value;
  }
  return config;
}

function parsePositionConfig(bytes) {
  const config = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 4) config.gpsEnabled = Boolean(item.value);
  }
  return config;
}

function parseConfig(bytes) {
  const config = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) config.device = withRawBytes(parseDeviceConfig(item.value), item.value);
    if (item.field === 2) config.position = withRawBytes(parsePositionConfig(item.value), item.value);
    if (item.field === 4) config.network = withRawBytes(parseNetworkConfig(item.value), item.value);
    if (item.field === 6) config.lora = withRawBytes(parseLoRaConfig(item.value), item.value);
    if (item.field === 7) config.bluetooth = withRawBytes(parseBluetoothConfig(item.value), item.value);
  }
  return config;
}

function parseMqttConfig(bytes) {
  const config = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) config.enabled = Boolean(item.value);
  }
  return config;
}

function parseModuleConfig(bytes) {
  const config = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) config.mqtt = withRawBytes(parseMqttConfig(item.value), item.value);
  }
  return config;
}

function parseChannelSettings(bytes) {
  const settings = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) settings.channelNum = item.value;
    if (item.field === 2) settings.psk = bytesToBase64(item.value);
    if (item.field === 3) settings.name = decodeProtoString(item.value);
    if (item.field === 4) settings.id = item.value;
  }
  return settings;
}

function parseChannel(bytes) {
  const channel = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) channel.index = item.value;
    if (item.field === 2) channel.settings = parseChannelSettings(item.value);
    if (item.field === 3) channel.role = item.value === 1 ? 'PRIMARY' : item.value === 2 ? 'SECONDARY' : 'DISABLED';
  }
  return channel;
}

function parseAdminMessage(bytes) {
  const admin = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 2) admin.channel = parseChannel(item.value);
    if (item.field === 4) admin.owner = parseUser(item.value);
    if (item.field === 6) admin.config = parseConfig(item.value);
    if (item.field === 8) admin.moduleConfig = parseModuleConfig(item.value);
  }
  return admin;
}

function parseMeshPacket(bytes) {
  const packet = { decoded: {} };
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) packet.from = item.value;
    if (item.field === 2) packet.to = item.value;
    if (item.field === 3) packet.channel = item.value;
    if (item.field === 4) packet.decoded = parseMeshData(item.value);
    if (item.field === 6) packet.id = item.value;
    if (item.field === 10) packet.want_ack = Boolean(item.value);
    if (item.field === 17) packet.pki_encrypted = Boolean(item.value);
  }
  return packet;
}

function parseFromRadio(bytes) {
  const fromRadio = {};
  for (const item of readProtoFields(bytes)) {
    if (item.field === 1) fromRadio.id = item.value;
    if (item.field === 2) fromRadio.packet = parseMeshPacket(item.value);
    if (item.field === 3) fromRadio.my_info = parseMyNodeInfo(item.value);
    if (item.field === 4) fromRadio.node_info = parseNodeInfo(item.value);
    if (item.field === 5) fromRadio.config = parseConfig(item.value);
    if (item.field === 7) fromRadio.config_complete_id = item.value;
    if (item.field === 9) fromRadio.moduleConfig = parseModuleConfig(item.value);
    if (item.field === 10) fromRadio.channel = parseChannel(item.value);
  }
  return fromRadio;
}

function mergeBleConfig(transport, config) {
  transport.configs = transport.configs || {};
  for (const [key, value] of Object.entries(config || {})) {
    transport.configs[key] = { ...(transport.configs[key] || {}), ...(value || {}) };
  }
}

function mergeBleModuleConfig(transport, config) {
  transport.moduleConfigs = transport.moduleConfigs || {};
  for (const [key, value] of Object.entries(config || {})) {
    transport.moduleConfigs[key] = { ...(transport.moduleConfigs[key] || {}), ...(value || {}) };
  }
}

function boolFromConfigValue(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'true' || text === 'on' || text === '1' || text === 'yes';
}

function bleConfigPlanFromPayload(payload) {
  return {
    kind: payload.configKind,
    target: payload.configTarget,
    field: payload.configField,
    value: payload.configValue,
    payload: payload.configJson || {},
    wait: Number(payload.configWait || payload.rebootWait || 10),
  };
}

// Meshtastic 的 PSK 是「原始密钥字节」，不是密码短语：设备之间逐字节比对，
// 没有哈希/派生步骤。官方 App/CLI 只认四种写法，这里与 server.py 的校验规则保持一致
// （否则串口与 BLE 两条通道对同一个输入会给出不同结论）。
const CHANNEL_PSK_HELP = 'PSK 只支持四种写法：default（设备默认密钥，1 字节 0x01）、none（清空 PSK，该频道不加密）、0x..（十六进制密钥字节，长度必须是偶数）、base64:..（base64 密钥字节，例如 base64:AQ== 等于 default）。留空表示「不修改这个频道的 PSK」。';
// 标准长度：0（none）/1（default）/16（AES128）/32（AES256）。
const CHANNEL_PSK_STANDARD_LENGTHS = [0, 1, 16, 32];

function parseChannelPsk(value) {
  const text = String(value ?? '').trim();
  if (!text) return { empty: true, bytes: null, note: '未填写（不改动该频道 PSK）', warning: '' };
  if (/^default$/i.test(text)) return { empty: false, bytes: Uint8Array.from([1]), note: 'default = 1 字节 0x01', warning: '' };
  if (/^none$/i.test(text)) return { empty: false, bytes: new Uint8Array(), note: 'none = 清空 PSK（该频道不加密）', warning: '' };
  let bytes = null;
  let note = '';
  if (/^0x/i.test(text)) {
    const hex = text.slice(2);
    if (!/^[0-9a-fA-F]+$/.test(hex)) throw new Error(`PSK 十六进制内容不合法（只允许 0-9 a-f）：${text}。${CHANNEL_PSK_HELP}`);
    if (hex.length % 2 !== 0) throw new Error(`PSK 十六进制长度必须是偶数（每个字节两位）：${text}。${CHANNEL_PSK_HELP}`);
    bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    note = `0x 十六进制 = ${bytes.length} 字节`;
  } else if (/^base64:/i.test(text)) {
    bytes = base64ToBytes(text);
    if (!bytes) throw new Error(`PSK base64 内容不合法：${text}。${CHANNEL_PSK_HELP}`);
    note = `base64 = ${bytes.length} 字节`;
  } else {
    throw new Error(`无法识别的 PSK：「${text}」。${CHANNEL_PSK_HELP}`);
  }
  const warning = CHANNEL_PSK_STANDARD_LENGTHS.includes(bytes.length)
    ? ''
    : `注意：${bytes.length} 字节不是 Meshtastic 标准 PSK 长度（0/1/16/32），设备可能拒绝该频道配置。`;
  return { empty: false, bytes, note, warning };
}

// 兼容旧调用：只取字节，遇到非法输入直接抛错（旧实现返回 null 会让调用方写出"空 PSK = 关闭加密"）。
function encodeChannelPsk(value) {
  const parsed = parseChannelPsk(value);
  return parsed.empty ? null : parsed.bytes;
}

// 频道密钥长度选项：与 App 端一致（空 / 默认 AQ== / 1 byte / 128 bit / 256 bit），
// 另加"不改动"以免只改频道名时把设备现有密钥清掉。
const CHANNEL_PSK_MODES = {
  keep: { label: '不改动（保持当前密钥）', bytes: null, editable: false, psk: '' },
  none: { label: '空（不加密）', bytes: 0, editable: false, psk: 'none' },
  default: { label: '默认（AQ==）', bytes: 1, editable: false, psk: 'default', preview: 'AQ==' },
  '1b': { label: '1 byte', bytes: 1, editable: true },
  '16b': { label: '128 bit', bytes: 16, editable: true },
  '32b': { label: '256 bit', bytes: 32, editable: true },
};

function randomChannelPskBase64(byteLength) {
  const bytes = new Uint8Array(Math.max(1, Number(byteLength) || 1));
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

// 把用户粘贴的密钥统一成裸 base64 显示（接受 base64: 前缀与 0x 十六进制）。
function normalizeChannelPskField() {
  const input = $('configChannelPsk');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  if (/^0x[0-9a-fA-F]+$/i.test(raw)) {
    const hex = raw.slice(2);
    if (hex.length % 2 === 0) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
      input.value = bytesToBase64(bytes);
    }
    return;
  }
  if (/^base64:/i.test(raw)) input.value = raw.replace(/^base64:/i, '');
}

// 表单 -> 写入用的 PSK 写法；校验失败抛中文错误（长度必须与所选长度一致）。
function channelPskFormValue() {
  const mode = $('configChannelPskMode')?.value || 'keep';
  const definition = CHANNEL_PSK_MODES[mode] || CHANNEL_PSK_MODES.keep;
  if (!definition.editable) return { mode, definition, psk: definition.psk || '' };
  const raw = ($('configChannelPsk')?.value || '').trim();
  if (!raw) throw new Error(`密钥长度选择了「${definition.label}」，但密钥内容为空：请点右侧随机生成按钮，或直接粘贴 base64 / 0x 密钥。`);
  let bytes = null;
  if (/^0x[0-9a-fA-F]+$/i.test(raw)) {
    const hex = raw.slice(2);
    if (hex.length % 2 !== 0) throw new Error('十六进制密钥长度必须是偶数（每个字节两位）。');
    bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  } else {
    bytes = base64ToBytes(raw);
    if (!bytes) throw new Error('密钥不是合法的 base64（也支持粘贴 0x... 十六进制密钥）。');
  }
  if (bytes.length !== definition.bytes) {
    throw new Error(`密钥长度与所选长度不一致：当前 ${bytes.length} 字节（${bytes.length * 8} bit），选择的是「${definition.label}」= ${definition.bytes} 字节。请点随机生成按钮重新生成，或改成正确长度。`);
  }
  return { mode, definition, psk: `base64:${bytesToBase64(bytes)}`, bytes };
}

function validateChannelPskForm() {
  const box = $('configChannelPskError');
  if (!box) return true;
  let message = '';
  try {
    channelPskFormValue();
  } catch (error) {
    message = error.message;
  }
  box.textContent = message;
  box.classList.toggle('hidden', !message);
  $('configChannelPsk')?.classList.toggle('invalid', Boolean(message));
  return !message;
}

// 切换长度选项：非可编辑选项禁用并回填展示值；可编辑选项自动生成一个该长度的随机密钥。
function syncChannelPskForm() {
  const select = $('configChannelPskMode');
  const input = $('configChannelPsk');
  if (!select || !input) return;
  const mode = select.value;
  const definition = CHANNEL_PSK_MODES[mode] || CHANNEL_PSK_MODES.keep;
  input.disabled = !definition.editable;
  if ($('randomChannelPsk')) $('randomChannelPsk').disabled = !definition.editable;
  if (definition.preview) input.value = definition.preview;
  else if (!definition.editable) input.value = '';
  else if (!input.value.trim() || input.dataset.pskMode !== mode) input.value = randomChannelPskBase64(definition.bytes);
  input.dataset.pskMode = mode;
  validateChannelPskForm();
}

// 管理包必须发给设备自己的 node num：MeshService::handleToRadio 会把手机写入的包交给
// Router::sendLocal，只有 isToUs(p)（to == 本机 node num）才会 deliverLocal 交给 AdminModule，
// 广播地址（0xffffffff）的管理包不会被本机处理。真机 A/B 已证实：同一条整段合并配置，
// to=本机时生效，to=广播时设备重启但配置不变。
function bleAdminDestination(role = 'primary') {
  const transport = browserBleTransports.get(role) || connectedSingleBleTransport();
  return transport?.myInfo?.node_id || state.deviceNodeIds?.[role] || '';
}

function encodeBleAdminWrite(plan, role = 'primary') {
  const kind = plan.kind;
  const body = plan.payload || {};
  const destNodeId = bleAdminDestination(role);
  if (!destNodeId) {
    throw new Error('没有读到本机 node num：Meshtastic 固件只处理发给本机的管理包（广播地址的管理包会被设备忽略），请先点“重新读取”拿到设备身份再下发配置。');
  }
  if (kind === 'user_name') {
    const user = concatBytes([
      body.longName ? protoString(2, body.longName) : new Uint8Array(),
      body.shortName ? protoString(3, body.shortName) : new Uint8Array(),
    ]);
    return { bytes: createAdminSetOwnerToRadio(user, destNodeId).bytes, expected: [
      body.longName ? ['owner.long_name', body.longName] : null,
      body.shortName ? ['owner.short_name', body.shortName] : null,
    ].filter(Boolean) };
  }
  if (kind === 'communication_lora') {
    const replacements = [];
    const expected = [];
    if (body.region !== undefined) {
      replacements.push({ field: 7, wire: 0, value: REGION_VALUES[body.region] });
      expected.push(['lora.region', body.region]);
    }
    if (body.modemPreset !== undefined) {
      replacements.push({ field: 1, wire: 0, value: 1 }, { field: 2, wire: 0, value: MODEM_VALUES[body.modemPreset] });
      expected.push(['lora.use_preset', 'ON'], ['lora.modem_preset', body.modemPreset]);
    }
    if (body.overrideFrequency !== undefined) {
      const value = Number(body.overrideFrequency || 0);
      replacements.push({ field: 14, wire: 5, value: floatBits(value) });
      expected.push(['lora.override_frequency', String(value)]);
    }
    const lora = mergeBleSubConfig(role, 'config', 'lora', replacements);
    return {
      bytes: createAdminSetConfigToRadio(protoBytes(6, lora.bytes), destNodeId).bytes,
      merged: lora.merged,
      expected: expected.length ? expected : (plan.expected || []),
    };
  }
  if (kind === 'region') {
    const regionValue = REGION_VALUES[body.region];
    if (regionValue === undefined) throw new Error(`不支持的区域：${body.region}`);
    const lora = mergeBleSubConfig(role, 'config', 'lora', [
      { field: 7, wire: 0, value: regionValue },
      { field: 14, wire: 5, value: floatBits(Number(body.overrideFrequency || 0)) },
    ]);
    return { bytes: createAdminSetConfigToRadio(protoBytes(6, lora.bytes), destNodeId).bytes, merged: lora.merged, expected: [
      ['lora.region', body.region],
      ['lora.override_frequency', String(Number(body.overrideFrequency || 0))],
    ] };
  }
  if (kind === 'modem_preset') {
    const modemValue = MODEM_VALUES[plan.value];
    if (modemValue === undefined) throw new Error(`不支持的预设：${plan.value}`);
    const lora = mergeBleSubConfig(role, 'config', 'lora', [
      { field: 1, wire: 0, value: 1 },
      { field: 2, wire: 0, value: modemValue },
    ]);
    return { bytes: createAdminSetConfigToRadio(protoBytes(6, lora.bytes), destNodeId).bytes, merged: lora.merged, expected: [
      ['lora.use_preset', 'ON'],
      ['lora.modem_preset', plan.value],
    ] };
  }
  if (kind === 'device_role') {
    const roleValue = DEVICE_ROLE_VALUES[plan.value];
    if (roleValue === undefined) throw new Error(`不支持的角色：${plan.value}`);
    const device = mergeBleSubConfig(role, 'config', 'device', [{ field: 1, wire: 0, value: roleValue }]);
    return { bytes: createAdminSetConfigToRadio(protoBytes(1, device.bytes), destNodeId).bytes, merged: device.merged, expected: [['device.role', plan.value]] };
  }
  if (kind === 'tzdef') {
    // DeviceConfig 11 = tzdef（POSIX TZ 字符串）。空字符串表示清除（设备回到 UTC）。
    const tz = String(body.tzdef ?? plan.value ?? '').trim();
    const device = mergeBleSubConfig(role, 'config', 'device', [{ field: 11, wire: 2, value: new TextEncoder().encode(tz) }]);
    return {
      bytes: createAdminSetConfigToRadio(protoBytes(1, device.bytes), destNodeId).bytes,
      merged: device.merged,
      expected: [['device.tzdef', tz]],
      notes: [`时区=${tz || '(空 → UTC)'}`],
    };
  }
  if (kind === 'wifi') {
    const replacements = [];
    const expected = [];
    if (body.enabled !== '') {
      const enabled = boolFromConfigValue(body.enabled);
      replacements.push({ field: 1, wire: 0, value: enabled ? 1 : 0 });
      expected.push(['network.wifi_enabled', enabled ? 'ON' : 'OFF']);
    }
    if (body.ssid) {
      replacements.push({ field: 3, wire: 2, value: new TextEncoder().encode(body.ssid) });
      expected.push(['network.wifi_ssid', body.ssid]);
    }
    if (body.key) replacements.push({ field: 4, wire: 2, value: new TextEncoder().encode(body.key) });
    const network = mergeBleSubConfig(role, 'config', 'network', replacements);
    return { bytes: createAdminSetConfigToRadio(protoBytes(4, network.bytes), destNodeId).bytes, merged: network.merged, expected };
  }
  if (kind === 'gps') {
    const enabled = boolFromConfigValue(plan.value);
    const position = mergeBleSubConfig(role, 'config', 'position', [{ field: 4, wire: 0, value: enabled ? 1 : 0 }]);
    return { bytes: createAdminSetConfigToRadio(protoBytes(2, position.bytes), destNodeId).bytes, merged: position.merged, expected: [['position.gps_enabled', enabled ? 'ON' : 'OFF']] };
  }
  if (kind === 'bluetooth') {
    const enabled = boolFromConfigValue(plan.value);
    const bluetooth = mergeBleSubConfig(role, 'config', 'bluetooth', [{ field: 1, wire: 0, value: enabled ? 1 : 0 }]);
    return { bytes: createAdminSetConfigToRadio(protoBytes(7, bluetooth.bytes), destNodeId).bytes, merged: bluetooth.merged, expected: [['bluetooth.enabled', enabled ? 'ON' : 'OFF']] };
  }
  if (kind === 'mqtt') {
    const enabled = boolFromConfigValue(plan.value);
    const mqtt = mergeBleSubConfig(role, 'moduleConfig', 'mqtt', [{ field: 1, wire: 0, value: enabled ? 1 : 0 }]);
    return { bytes: createAdminSetModuleConfigToRadio(protoBytes(1, mqtt.bytes), destNodeId).bytes, merged: mqtt.merged, expected: [['mqtt.enabled', enabled ? 'ON' : 'OFF']] };
  }
  if (kind === 'channel') {
    const index = Number(body.index || 0);
    // 频道同样是整段替换：保留设备该频道的其它 settings（psk/id/channelNum…），只改目标字段。
    const current = browserBleTransports.get(role)?.channels?.get?.(index);
    const settingsReplacements = [];
    const notes = [];
    if (body.name) {
      settingsReplacements.push({ field: 3, wire: 2, value: new TextEncoder().encode(body.name) });
      notes.push(`频道名称=${body.name}`);
    }
    // 留空 = 不改动该频道 PSK；填 none 才是显式清空（不加密）。非法写法必须报错，
    // 不能像旧实现那样静默写成空 PSK（那等于偷偷关掉这个频道的加密）。
    const psk = parseChannelPsk(body.psk);
    const expected = [];
    if (body.name) expected.push([`channel.${index}.name`, body.name]);
    if (!psk.empty) {
      settingsReplacements.push({ field: 2, wire: 2, value: psk.bytes });
      notes.push(`PSK=${psk.note}`);
      if (psk.warning) notes.push(psk.warning);
      // 读回时按十六进制比对；none 的期望值就是"没有密钥"（空串）。
      expected.push([`channel.${index}.psk`, bytesToHexString(psk.bytes)]);
    }
    const settings = mergeProtoMessage(current?.settings?.__raw || null, settingsReplacements);
    const channelReplacements = [
      { field: 1, wire: 0, value: index },
      { field: 2, wire: 2, value: settings },
      { field: 3, wire: 0, value: index === 0 ? 1 : 2 },
    ];
    const channel = mergeProtoMessage(current?.__raw || null, channelReplacements);
    return {
      bytes: createAdminSetChannelToRadio(channel, destNodeId).bytes,
      merged: Boolean(current?.settings?.__raw),
      expected,
      notes: [`频道索引=${index}`, ...notes],
    };
  }
  throw new Error(`当前配置类型还没有实现浏览器 BLE 写入：${kind}`);
}

// 把 JS 浮点数的 32 位表示取出来，便于用 protoFixed32 原样写回。
function floatBits(value) {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setFloat32(0, Number(value || 0), true);
  return new DataView(buffer).getUint32(0, true);
}

function bleRolesForConfigTarget(target) {
  if (WEB_BLE_SINGLE_DEVICE_ONLY && $('connectionType')?.value === 'ble') {
    return hasConnectedBleRole('primary') ? ['primary'] : [];
  }
  if (target === 'both') return connectedBleRoles();
  return hasConnectedBleRole(target) ? [target] : [];
}

function hasConnectedBleRole(role) {
  const transport = browserBleTransports.get(role);
  return Boolean(transport?.device?.gatt?.connected && transport.toRadio && transport.fromRadio && transport.fromNum);
}

function connectedBleRoles() {
  return WEB_BLE_ROLES.filter((role) => hasConnectedBleRole(role));
}

function selectedBleRoles() {
  if (WEB_BLE_SINGLE_DEVICE_ONLY) {
    return (browserBleTransports.has('primary') || state.connectedBleDeviceIds?.primary || state.selectedBleDeviceIds?.primary)
      ? ['primary']
      : [];
  }
  return WEB_BLE_ROLES.filter((role) =>
    browserBleTransports.has(role)
    || Boolean(state.connectedBleDeviceIds?.[role])
    || Boolean(state.selectedBleDeviceIds?.[role])
  );
}

async function keepOtherBleRolesWarm(activeRole) {
  for (const role of connectedBleRoles()) {
    if (role === activeRole) continue;
    const transport = browserBleTransports.get(role);
    await drainBleFromRadio(transport, { apply: true, maxPackets: 1, maxMs: 120 }).catch(() => {});
  }
}

function bleReadbackValue(role, field) {
  if (field.startsWith('owner.')) {
    const owner = state.deviceSnapshots[role]?.owner || {};
    const key = field.split('.')[1];
    // 写入计划用的是 protobuf 字段名（long_name/short_name），而设备快照存的是
    // camelCase（longName/shortName）。两种命名都接受，否则 User name 写成功后读回会恒判 FAIL。
    const camelKey = key === 'long_name' ? 'longName' : key === 'short_name' ? 'shortName' : key;
    return owner[camelKey] ?? owner[key] ?? '';
  }
  if (field.startsWith('channel.')) {
    const [, index] = field.split('.');
    if (field.endsWith('.psk')) return state.channelPsks[Number(index)] || '';
    return state.channels[Number(index)] || '';
  }
  return state.deviceConfigs[role]?.[field] ?? '';
}

// 读回展示：0 / false 都是有效值，不能用 `|| '-'` 吞掉（此前 override_frequency=0 会显示成 "-"）。
function bleReadbackDisplay(role, field) {
  const value = bleReadbackValue(role, field);
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'ON' : 'OFF';
  return String(value);
}

// 读回「已知」判定：只有真的从设备读到过该字段，才允许用「已与目标一致」跳过写入。
// 否则"没读到"会被当成"值就是空"——例如 PSK 填 none 时会被误判成无需写入。
function bleReadbackKnown(role, field) {
  if (field.startsWith('channel.')) {
    const [, index] = field.split('.');
    return field.endsWith('.psk')
      ? Boolean(state.channelPskKnown[Number(index)])
      : Boolean(state.channels[Number(index)]);
  }
  if (field.startsWith('owner.')) return Boolean(state.deviceSnapshots[role]?.owner);
  const value = state.deviceConfigs[role]?.[field];
  return value !== undefined && value !== null && value !== '';
}

function bleExpectedMatch(role, expected) {
  for (const [field, desired] of expected || []) {
    const current = bleReadbackValue(role, field);
    if (field === 'lora.override_frequency') {
      if (Number(current || 0) !== Number(desired || 0)) return false;
    } else if (normalizeConfigValue(current) !== normalizeConfigValue(desired)) {
      return false;
    }
  }
  return true;
}

function bleNodeDbEvidence(sourceRole, targetRole) {
  const sourceTransport = browserBleTransports.get(sourceRole);
  const targetId = state.deviceNodeIds[targetRole] || '';
  const visibleNode = targetId && sourceTransport?.nodes ? sourceTransport.nodes.get(targetId) : null;
  const publicKey = visibleNode?.user?.public_key || '';
  return {
    sourceRole,
    targetRole,
    targetId,
    visible: Boolean(visibleNode),
    publicKey,
    shortName: visibleNode?.user?.short_name || '',
    longName: visibleNode?.user?.long_name || '',
  };
}

function bleNodeOptions(role = 'primary') {
  const transport = browserBleTransports.get(role) || connectedSingleBleTransport();
  const ownId = transport?.myInfo?.node_id || state.deviceNodeIds[role] || '';
  return [...(transport?.nodes?.values() || [])]
    .filter((node) => node?.node_id && node.node_id !== ownId)
    .map((node) => ({
      value: node.node_id,
      label: node.user?.short_name || node.user?.long_name || shortNodeLabel(node.node_id) || node.node_id,
      publicKey: node.user?.public_key || '',
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function selectedBleNodeTarget() {
  const nodeId = $('messageNode')?.value || '';
  if (!nodeId) return null;
  for (const role of connectedBleRoles()) {
    const node = browserBleTransports.get(role)?.nodes?.get(nodeId);
    if (node) {
      return {
        role,
        nodeId,
        label: node.user?.short_name || node.user?.long_name || shortNodeLabel(nodeId) || nodeId,
        publicKey: node.user?.public_key || '',
      };
    }
  }
  return { role: 'primary', nodeId, label: shortNodeLabel(nodeId) || nodeId, publicKey: '' };
}

function updateBleNodeOptions() {
  const selects = [$('messageNode'), $('bleContinuousNode')].filter(Boolean);
  if (!selects.length) return;
  const options = bleNodeOptions('primary');
  if (!options.length) {
    for (const select of selects) {
      fillSelectOptions(select, [{ value: '', label: select.id === 'bleContinuousNode' ? '发送到频道' : '未读取到其他节点' }], '');
      select.disabled = select.id === 'messageNode';
      syncCustomSelect(select);
    }
    return;
  }
  for (const select of selects) {
    const selected = select.value;
    const values = select.id === 'bleContinuousNode'
      ? [{ value: '', label: '发送到频道' }, ...options.map((item) => ({ value: item.value, label: `${item.label} · ${shortNodeLabel(item.value)}` }))]
      : options.map((item) => ({ value: item.value, label: `${item.label} · ${shortNodeLabel(item.value)}` }));
    fillSelectOptions(select, values, selected || (select.id === 'bleContinuousNode' ? '' : options[0].value));
    select.disabled = false;
    syncCustomSelect(select);
  }
}

function communicationConfigPlanFromControls() {
  const payload = {};
  const expected = [];
  if ($('useExperimentRegion').checked) {
    const region = $('experimentRegion').value;
    if (REGION_VALUES[region] !== undefined) {
      payload.region = region;
      expected.push(['lora.region', region]);
    }
  }
  if ($('useExperimentModem').checked) {
    const modem = $('experimentModem').value;
    if (MODEM_VALUES[modem] !== undefined) {
      payload.modemPreset = modem;
      expected.push(['lora.use_preset', 'ON'], ['lora.modem_preset', modem]);
    }
  }
  if ($('useOverrideFrequency').checked) {
    const value = Number($('overrideFrequency').value.trim() || 0);
    payload.overrideFrequency = value;
    expected.push(['lora.override_frequency', String(value)]);
  }
  // 这里不再预生成字节：写入时要拿设备当前 LoRaConfig 整段合并，避免把
  // use_preset/bandwidth/spread_factor 等字段重置成默认值导致固件丢弃整条写入。
  return {
    target: WEB_BLE_SINGLE_DEVICE_ONLY && $('connectionType')?.value === 'ble' ? 'primary' : 'both',
    kind: 'communication_lora',
    wait: Number($('rebootWait')?.value || 10),
    payload,
    expected,
  };
}

function resetBleSnapshotBuffers(transport) {
  if (!transport) return;
  transport.nodes = new Map();
  transport.channels = new Map();
  transport.configs = {};
  transport.moduleConfigs = {};
  transport.owner = null;
  transport.myInfo = null;
  transport.configCompleteId = null;
}

function applyBleFromRadio(transport, parsed) {
  if (!transport || !parsed) return;
  if (parsed.my_info?.node_id) transport.myInfo = parsed.my_info;
  if (parsed.node_info?.node_id) transport.nodes.set(parsed.node_info.node_id, parsed.node_info);
  if (parsed.config_complete_id !== undefined) transport.configCompleteId = parsed.config_complete_id;
  if (parsed.config) mergeBleConfig(transport, parsed.config);
  if (parsed.moduleConfig) mergeBleModuleConfig(transport, parsed.moduleConfig);
  if (parsed.channel?.index !== undefined) transport.channels.set(Number(parsed.channel.index), parsed.channel);
  if (parsed.packet?.decoded?.admin) {
    const admin = parsed.packet.decoded.admin;
    if (admin.owner?.id || admin.owner?.short_name) transport.owner = admin.owner;
    if (admin.config) mergeBleConfig(transport, admin.config);
    if (admin.moduleConfig) mergeBleModuleConfig(transport, admin.moduleConfig);
    if (admin.channel?.index !== undefined) transport.channels.set(Number(admin.channel.index), admin.channel);
  }
  if (parsed.packet?.decoded?.text) {
    transport.received.push({ time: Date.now(), ...parsed.packet, text: parsed.packet.decoded.text });
  }
}

async function readBleFromRadioPacketRaw(transport) {
  if (!transport?.fromRadio) return null;
  const value = await transport.fromRadio.readValue();
  const bytes = new Uint8Array(value.buffer.slice(value.byteOffset || 0, (value.byteOffset || 0) + value.byteLength));
  if (!bytes.length) return null;
  return parseFromRadio(bytes);
}

async function readBleFromRadioPacket(transport) {
  return enqueueBleGattOperation(
    transport,
    'FromRadio.readValue',
    () => readBleFromRadioPacketRaw(transport),
  );
}

async function drainBleFromRadio(transport, options = {}) {
  if (!transport?.fromRadio) return [];
  return enqueueBleGattOperation(transport, 'FromRadio.drain', async () => {
    const packets = [];
    const shouldApply = options.apply !== false;
    const maxPackets = Number(options.maxPackets || 4);
    const deadline = Date.now() + Number(options.maxMs || 200);
    for (let index = 0; index < maxPackets; index += 1) {
      if (Date.now() >= deadline) break;
      const parsed = await readBleFromRadioPacketRaw(transport);
      if (!parsed) break;
      packets.push(parsed);
      if (shouldApply) applyBleFromRadio(transport, parsed);
    }
    return packets;
  });
}

async function waitBleConfigComplete(transport, configId, timeoutSec = 8) {
  const deadline = Date.now() + Math.max(2, Number(timeoutSec || 8)) * 1000;
  while (Date.now() < deadline) {
    const packets = await drainBleFromRadio(transport);
    if (packets.some((packet) => Number(packet.config_complete_id) === Number(configId))) return true;
    if (transport.configCompleteId !== undefined && Number(transport.configCompleteId) === Number(configId)) return true;
    await delay(150);
  }
  return false;
}

async function drainBleForWindow(transport, timeoutSec = 4) {
  const deadline = Date.now() + Math.max(0.1, Number(timeoutSec || 4)) * 1000;
  let quietLoops = 0;
  while (Date.now() < deadline) {
    const packets = await drainBleFromRadio(transport).catch(() => []);
    quietLoops = packets.length ? 0 : quietLoops + 1;
    if (quietLoops >= 4) break;
    await delay(150);
  }
}

function buildBleInfoFromTransport(transport, configId = 0, nodeDbConfigId = 0) {
  const ownNode = transport.myInfo?.node_id ? transport.nodes.get(transport.myInfo.node_id) : null;
  const channels = [...transport.channels.values()].sort((a, b) => Number(a.index || 0) - Number(b.index || 0));
  if (!channels.some((channel) => Number(channel.index || 0) === 0)) {
    channels.unshift({
      index: 0,
      role: 'PRIMARY',
      settings: {
        name: presetToChannelName(transport.configs?.lora?.modemPreset || 'LONG_FAST') || '\u4e3b\u9891\u9053',
      },
    });
  }
  return {
    ok: Boolean(transport.myInfo?.node_id),
    nodeId: transport.myInfo?.node_id || '',
    shortName: transport.owner?.short_name || ownNode?.user?.short_name || '',
    longName: transport.owner?.long_name || ownNode?.user?.long_name || '',
    publicKey: transport.owner?.public_key || ownNode?.user?.public_key || '',
    configs: transport.configs || {},
    moduleConfigs: transport.moduleConfigs || {},
    channels,
    nodes: [...transport.nodes.values()],
    configId,
    nodeDbConfigId,
  };
}

function isBleGattTransientError(error) {
  const text = `${error?.name || ''} ${error?.message || ''}`.toLowerCase();
  return /gatt|networkerror|notsupportederror|unknown reason|disconnected|operation failed/.test(text);
}

async function connectMeshtasticBleTransport(device, role, forceReconnect = false) {
  const old = browserBleTransports.get(role);
  if (!forceReconnect && old?.device?.id === device.id && old.device.gatt?.connected && old.toRadio && old.fromRadio && old.fromNum) {
    return old;
  }
  if (forceReconnect) browserBleReconnectingRoles.add(role);
  try {
  if (old?.device?.gatt?.connected && (old.device.id !== device.id || forceReconnect)) {
    await enqueueBleGattOperation(old, 'GATT.disconnect', async () => {
      old.device.gatt.disconnect();
    });
    await delay(250);
  }
  const server = await enqueueBleGlobalOperation('GATT.connect', () => device.gatt.connect());
  await delay(BLE_CONNECT_SETTLE_MS);
  const transport = {
    role,
    device,
    server,
    toRadio: null,
    fromRadio: null,
    fromNum: null,
    received: [],
    nodes: new Map(),
    channels: new Map(),
    configs: {},
    moduleConfigs: {},
    owner: null,
    myInfo: null,
    configCompleteId: null,
    gattQueue: Promise.resolve(),
    autoDrainScheduled: false,
  };
  const service = await enqueueBleGattOperation(
    transport,
    'getPrimaryService',
    () => server.getPrimaryService(MESHTASTIC_BLE_SERVICE_UUID),
  );
  transport.toRadio = await enqueueBleGattOperation(
    transport,
    'ToRadio.getCharacteristic',
    () => service.getCharacteristic(MESHTASTIC_TORADIO_UUID),
  );
  transport.fromRadio = await enqueueBleGattOperation(
    transport,
    'FromRadio.getCharacteristic',
    () => service.getCharacteristic(MESHTASTIC_FROMRADIO_UUID),
  );
  transport.fromNum = await enqueueBleGattOperation(
    transport,
    'FromNum.getCharacteristic',
    () => service.getCharacteristic(MESHTASTIC_FROMNUM_UUID),
  );
  await enqueueBleGattOperation(
    transport,
    'FromNum.startNotifications',
    () => transport.fromNum.startNotifications(),
  );
  transport.fromNum.addEventListener('characteristicvaluechanged', () => {
    scheduleBleDrain(transport);
  });
  browserBleTransports.set(role, transport);
  browserBleLastDeviceIds.set(role, device.id);
  // 连接阶段只建立 GATT 和通知订阅，不主动读写业务数据。
  // 设备信息读取交给“运行前置检查”或“重新读取”触发，避免系统 PIN 配对尚未完成时提前 GATT 读写。
  return transport;
  } finally {
    if (forceReconnect) browserBleReconnectingRoles.delete(role);
  }
}

async function readBleInfoWithRetry(role, options = {}) {
  let transport = browserBleTransports.get(role);
  // 这里刻意不因 transport 缺失就抛错：GATT 断开时交给 ensureBleTransportConnected
  // 用记住的 device 自动重连，避免把“可自动恢复”当成“未连接”。
  let lastError = null;
  const attempts = Number(options.attempts || BLE_CONFIG_READ_RETRIES);
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      transport = await ensureBleTransportConnected(role, BLE_QUICK_RECONNECT_OPTIONS);
      if (attempt > 0) {
        setBleRoleStatus(role, `${bleRoleLabel(role)} 正在重新读取设备信息（第 ${attempt + 1} 次）...`, 'info');
      }
      const info = await requestBleConfig(transport, BLE_CONFIG_READ_TIMEOUT_SEC);
      applyBleInfoToState(role, info);
      return { info, complete: true, error: null };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        setBleRoleStatus(role, `${bleRoleLabel(role)} 配置读取未完成，正在自动重试...`, 'warn');
        await delay(BLE_RETRY_DELAY_MS);
      }
    }
  }
  const fallback = await requestBleIdentity(transport, 8).catch(() => null);
  if (fallback?.ok) {
    applyBleInfoToState(role, fallback);
    return { info: fallback, complete: false, error: lastError };
  }
  throw lastError || new Error('BLE 配置读取失败。');
}

async function refreshBleDeviceInfo(role = 'primary') {
  if (!hasConnectedBleRole(role)) {
    setBleRoleStatus(role, `${bleRoleLabel(role)} 尚未连接，无法重新读取。`, 'warn');
    return null;
  }
  setBleRoleStatus(role, `${bleRoleLabel(role)} 正在重新读取设备信息...`, 'info');
  try {
    const { complete, error } = await readBleInfoWithRetry(role, { attempts: BLE_CONFIG_READ_RETRIES });
    const name = bleDeviceDisplayName(browserBleTransports.get(role)?.device, role);
    setBleRoleStatus(
      role,
      complete
        ? `${bleRoleLabel(role)} 已重新读取完整配置${name ? `：${name}` : ''}`
        : `${bleRoleLabel(role)} 已读取基础身份；完整配置暂未返回，可稍后再次点击“重新读取”。${error ? ` 原因：${friendlyBleError(error)}` : ''}`,
      complete ? 'success' : 'warn',
    );
    renderBleDevices(role);
    return true;
  } catch (error) {
    setBleRoleStatus(role, `${bleRoleLabel(role)} 读取设备信息失败：${friendlyBleError(error)}`, 'warn');
    renderBleDevices(role);
    return false;
  }
}

async function ensureBleTransportConnected(role, options = {}) {
  const transport = browserBleTransports.get(role);
  if (transport?.device?.gatt?.connected) return transport;
  // 断线后 transport 会被删除，但浏览器仍持有 device 句柄；用它自动重连，
  // 覆盖“写入配置 → 设备重启 BLE → 读回”这条真实链路。
  const device = transport?.device
    || browserBleDevices.get(browserBleLastDeviceIds.get(role) || '')
    || null;
  if (!device) {
    throw new Error(`${bleRoleLabel(role)} 尚未完成浏览器 GATT 连接：请先在设备列表里选择该设备并点击“连接 BLE”。`);
  }
  const attempts = Math.max(1, Number(options.attempts || BLE_RECONNECT_ATTEMPTS));
  const waitMs = Math.max(300, Number(options.delayMs || BLE_RECONNECT_DELAY_MS));
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    setBleRoleStatus(
      role,
      attempt === 1
        ? `${bleRoleLabel(role)} GATT 已断开，正在重连...`
        : `${bleRoleLabel(role)} 正在等待设备重新广播并重连（第 ${attempt}/${attempts} 次）...`,
      'warn',
    );
    try {
      const reconnected = await connectMeshtasticBleTransport(device, role, true);
      setBleRoleStatus(role, `${bleRoleLabel(role)} GATT 已重新连接（配置写入后设备重启的链路已恢复）`, 'success');
      return reconnected;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(waitMs);
    }
  }
  throw new Error(
    `${bleRoleLabel(role)} GATT 连接已断开，重连 ${attempts} 次仍未成功`
    + `（写入配置后设备会重启 BLE，通常需要等它重新广播）。`
    + `请等待设备回到主界面后重新连接并点击“重新读取”。`
    + (lastError ? ` 原因：${friendlyBleError(lastError)}` : ''),
  );
}

async function writeBleText(transport, message, channel, destNodeId = '', publicKeyBase64 = '') {
  if (!transport?.device?.gatt?.connected && transport?.role) {
    transport = await ensureBleTransportConnected(transport.role, BLE_QUICK_RECONNECT_OPTIONS);
  }
  const encoded = createTextToRadio(message, channel, destNodeId, publicKeyBase64);
  await writeBleToRadioBytes(transport, encoded.bytes, { drainAfterWrite: false });
  await delay(250);
  await drainBleForWindow(transport, 1.5).catch(() => {});
  return encoded.packetId;
}

async function writeBleToRadioBytes(transport, bytes, options = {}) {
  if (!transport?.device?.gatt?.connected && transport?.role) {
    transport = await ensureBleTransportConnected(transport.role, BLE_QUICK_RECONNECT_OPTIONS);
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await enqueueBleGattOperation(transport, 'ToRadio.writeValue', () => {
        if (transport.toRadio.writeValueWithResponse) {
          return transport.toRadio.writeValueWithResponse(bytes);
        }
        return transport.toRadio.writeValue(bytes);
      });
      break;
    } catch (error) {
      if (attempt > 0 || !transport?.role || !isBleGattTransientError(error)) throw error;
      setBleRoleStatus(transport.role, `${bleRoleLabel(transport.role)} GATT 写入失败，正在重连重试...`, 'warn');
      transport = await connectMeshtasticBleTransport(transport.device, transport.role, true);
    }
  }
  if (options.drainAfterWrite !== false) {
    await drainBleFromRadio(transport).catch(() => {});
  }
}

async function requestBleIdentity(transport, timeoutSec = 4) {
  if (!transport?.device?.gatt?.connected && transport?.role) {
    transport = await ensureBleTransportConnected(transport.role, BLE_QUICK_RECONNECT_OPTIONS);
  }
  await keepOtherBleRolesWarm(transport.role);
  await drainBleFromRadio(transport, { apply: true, maxPackets: 4, maxMs: 200 }).catch(() => {});
  resetBleSnapshotBuffers(transport);

  const configRequest = createWantConfigToRadio();
  await writeBleToRadioBytes(transport, configRequest.bytes, { drainAfterWrite: false });

  const deadline = Date.now() + Math.max(2, Number(timeoutSec || 4)) * 1000;
  while (Date.now() < deadline) {
    await drainBleFromRadio(transport, { maxPackets: 4, maxMs: 200 }).catch(() => []);
    await keepOtherBleRolesWarm(transport.role);
    const ownNode = transport.myInfo?.node_id ? transport.nodes.get(transport.myInfo.node_id) : null;
    if (transport.myInfo?.node_id && (transport.owner?.short_name || ownNode?.user?.short_name || ownNode?.user?.public_key)) {
      break;
    }
    if (transport.myInfo?.node_id && Date.now() > deadline - 800) break;
    await delay(120);
  }

  // Owner is optional for precheck. Try once, but do not turn a valid my_info read
  // into a disconnect-prone full configuration sync.
  if (!transport.owner?.short_name) {
    await writeBleToRadioBytes(transport, createAdminGetOwnerToRadio().bytes, { drainAfterWrite: false }).catch(() => {});
    await delay(120);
    await drainBleFromRadio(transport, { maxPackets: 4, maxMs: 200 }).catch(() => []);
  }
  return buildBleInfoFromTransport(transport, configRequest.configId, 0);
}

async function requestBleConfig(transport, timeoutSec = 8) {
  if (!transport?.device?.gatt?.connected && transport?.role) {
    transport = await ensureBleTransportConnected(transport.role, BLE_QUICK_RECONNECT_OPTIONS);
  }
  await drainBleFromRadio(transport, { apply: false }).catch(() => {});
  resetBleSnapshotBuffers(transport);

  // 每次读取都用新的 nonce：固定 nonce 时，设备队列里上一轮的 config_complete_id 会立刻满足
  // 「等待配置完成」，读回就可能停在旧值上（写入后读回显示旧配置的典型成因）。
  const configRequest = createWantConfigToRadioWithNonce(randomBleConfigNonce());
  await writeBleToRadioBytes(transport, configRequest.bytes);
  await waitBleConfigComplete(transport, configRequest.configId, timeoutSec);

  await delay(100);
  await writeBleToRadioBytes(transport, createHeartbeatToRadio().bytes).catch(() => {});
  await delay(100);

  const nodeDbRequest = createWantConfigToRadioWithNonce(randomBleConfigNonce());
  await writeBleToRadioBytes(transport, nodeDbRequest.bytes);
  await waitBleConfigComplete(transport, nodeDbRequest.configId, timeoutSec);

  const adminDestNodeId = transport.myInfo?.node_id || '';
  await writeBleToRadioBytes(transport, createAdminGetOwnerToRadio(adminDestNodeId).bytes).catch(() => {});
  await delay(120);

  const adminRequests = [
    createAdminGetConfigToRadio(ADMIN_CONFIG_TYPES.lora, adminDestNodeId),
    createAdminGetConfigToRadio(ADMIN_CONFIG_TYPES.device, adminDestNodeId),
    createAdminGetConfigToRadio(ADMIN_CONFIG_TYPES.network, adminDestNodeId),
    createAdminGetConfigToRadio(ADMIN_CONFIG_TYPES.bluetooth, adminDestNodeId),
    createAdminGetConfigToRadio(ADMIN_CONFIG_TYPES.position, adminDestNodeId),
    createAdminGetModuleConfigToRadio(ADMIN_MODULE_CONFIG_TYPES.mqtt, adminDestNodeId),
    ...Array.from({ length: 8 }, (_, index) => createAdminGetChannelToRadio(index, adminDestNodeId)),
  ];
  for (const adminRequest of adminRequests) {
    await writeBleToRadioBytes(transport, adminRequest.bytes, { drainAfterWrite: false });
    await drainBleForWindow(transport, 0.6);
    await delay(80);
  }
  await drainBleForWindow(transport, Math.max(4, Math.min(10, timeoutSec)));
  return buildBleInfoFromTransport(transport, configRequest.configId, nodeDbRequest.configId);
}

async function waitBleReceived(transport, message, channel, timeoutSec) {
  const deadline = Date.now() + Math.max(1, Number(timeoutSec || 10)) * 1000;
  while (Date.now() < deadline) {
    await drainBleFromRadio(transport).catch(() => {});
    if (transport.received.some((item) => item.text === message && Number(item.channel || 0) === Number(channel || 0))) {
      return true;
    }
    await delay(250);
  }
  return transport.received.some((item) => item.text === message && Number(item.channel || 0) === Number(channel || 0));
}

function connectedSingleBleTransport() {
  const role = connectedBleRoles()[0] || 'primary';
  return browserBleTransports.get(role) || null;
}

function bleSignalText(item) {
  const snr = item?.rxSnr ?? item?.rx_snr ?? item?.rx_snr_db ?? item?.rx_snr_dbm;
  const rssi = item?.rxRssi ?? item?.rx_rssi ?? item?.rx_rssi_dbm;
  const parts = [];
  if (snr !== undefined && snr !== null && snr !== '') parts.push(`SNR=${snr}`);
  if (rssi !== undefined && rssi !== null && rssi !== '') parts.push(`RSSI=${rssi}`);
  return parts.join(' ');
}

function renderBleContinuous() {
  const info = state.bleContinuous;
  ensureSingleBleLayout();
  $('bleContinuousPanel')?.classList.toggle('hidden', $('connectionType')?.value !== 'ble');
  updateBleContinuousRoute();
  if ($('bleContinuousSent')) $('bleContinuousSent').textContent = String(info.sent || 0);
  if ($('bleContinuousReceived')) $('bleContinuousReceived').textContent = String(info.received || 0);
  if ($('bleContinuousFailed')) $('bleContinuousFailed').textContent = String(info.failed || 0);
  if ($('startBleSend')) $('startBleSend').disabled = info.running;
  if ($('startBleReceive')) $('startBleReceive').disabled = info.running;
  if ($('runBleStability')) $('runBleStability').disabled = info.running || state.running;
  if ($('stopBleContinuous')) $('stopBleContinuous').disabled = !info.running;
  const log = $('bleContinuousLog');
  if (!log) return;
  if (!info.records.length) {
    log.classList.add('empty');
    log.textContent = '启动后记录发送 / 接收时间戳、消息内容和信号指标。';
    return;
  }
  log.classList.remove('empty');
  log.innerHTML = '';
  for (const item of info.records.slice(-160)) {
    const row = document.createElement('div');
    row.className = `ble-log-line ${item.type || 'info'}`;
    row.textContent = item.line;
    log.appendChild(row);
  }
  log.scrollTop = log.scrollHeight;
}

// 只维护"发送目标"这一行（界面精简：卡片头部的小字说明已去掉，提示统一走日志区）。
function updateBleContinuousRoute() {
  const channelSelect = $('bleContinuousChannel');
  const nodeSelect = $('bleContinuousNode');
  const nodeValue = nodeSelect?.value || '';
  const nodeLabel = nodeValue
    ? nodeSelect.options[nodeSelect.selectedIndex]?.textContent || shortNodeLabel(nodeValue) || nodeValue
    : '';
  const channelLabel = channelSelect?.options[channelSelect.selectedIndex]?.textContent || `频道 ${channelSelect?.value || 0}`;
  const route = nodeValue ? `发送目标：节点 ${nodeLabel}` : `发送目标：${channelLabel}`;
  if ($('bleContinuousRoute')) $('bleContinuousRoute').textContent = route;
}

// 任务级提示（前置检查准备中、前置条件不足、已有任务在运行…）：只写命令证据区 +
// 「执行结果」面板里的 runNotice。**绝不能进「持续收发」卡片** —— 以前任何任务反馈
// 都会 push 进持续收发日志并覆盖卡片头部说明，任务结束后那句「正在准备 BLE 前置检查...」
// 就永久留在卡片上（用户报告的现象）。
function showBleActionFeedback(message, type = 'info') {
  if (!message) return;
  if ($('commandBox')) $('commandBox').textContent = message;
  setRunNotice(message, type === 'err' ? 'error' : type);
}

function setRunNotice(message, tone = 'info') {
  const box = $('runNotice');
  if (!box) return;
  if (!message) {
    box.textContent = '';
    box.classList.add('hidden');
    box.removeAttribute('data-tone');
    return;
  }
  box.textContent = message;
  box.dataset.tone = tone;
  box.classList.remove('hidden');
}

// 「持续收发」自己的提示：进持续收发日志（界面精简后卡片头部不再放提示文字）。
function showBleContinuousFeedback(message, type = 'info') {
  if (!message) return;
  if ($('commandBox')) $('commandBox').textContent = message;
  if ($('connectionType')?.value === 'ble') pushBleContinuousRecord(type, message);
}

function pushBleContinuousRecord(type, text, extra = '') {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const tag = type === 'rx' ? 'RX' : type === 'tx' ? 'TX' : type === 'err' ? 'ERR' : 'INFO';
  const line = `[${time}] ${tag} ${text}${extra ? ` ${extra}` : ''}`;
  state.bleContinuous.records.push({ time, type, line });
  if (state.bleContinuous.records.length > 500) state.bleContinuous.records.splice(0, state.bleContinuous.records.length - 500);
  renderBleContinuous();
}

function clearBleContinuousLog() {
  const info = state.bleContinuous;
  info.sent = 0;
  info.received = 0;
  info.failed = 0;
  info.records = [];
  renderBleContinuous();
}

function selectedBleContinuousNodeTarget() {
  const nodeId = $('bleContinuousNode')?.value || '';
  if (!nodeId) return null;
  for (const role of connectedBleRoles()) {
    const node = browserBleTransports.get(role)?.nodes?.get(nodeId);
    if (node) {
      return {
        role,
        nodeId,
        label: node.user?.short_name || node.user?.long_name || shortNodeLabel(nodeId) || nodeId,
        publicKey: node.user?.public_key || '',
      };
    }
  }
  return { role: 'primary', nodeId, label: shortNodeLabel(nodeId) || nodeId, publicKey: '' };
}

// BLE 收到的文本包：私聊（收件地址是某个具体节点）不能被写成「频道 N」。
// Meshtastic 的私聊包 to = 目标 node num（channel 仍为 0），广播包 to = 0xffffffff。
function bleTransportNodeNum(transport) {
  const direct = Number(transport?.myInfo?.my_node_num || 0);
  if (direct) return direct >>> 0;
  const nodeId = transport?.myInfo?.node_id || state.deviceNodeIds?.[transport?.role] || '';
  return nodeId ? nodeIdToNum(nodeId) >>> 0 : 0;
}

function bleNodeDisplayName(transport, num) {
  const id = nodeNumToId(Number(num || 0));
  const node = transport?.nodes?.get?.(id);
  const label = node?.user?.short_name || node?.user?.long_name || shortNodeLabel(id);
  return label && label !== id ? `${label} (${id})` : id;
}

function bleReceivedTextLabel(transport, item) {
  const channel = item.channel ?? item.channelIndex ?? 0;
  const to = Number(item.to);
  const from = Number(item.from);
  if (!Number.isFinite(to) || to === BROADCAST_NUM || to === 0) {
    return { label: `频道 ${channel}`, kind: 'channel' };
  }
  const myNum = bleTransportNodeNum(transport);
  const sender = Number.isFinite(from) ? bleNodeDisplayName(transport, from) : '未知节点';
  if (myNum && to === myNum) return { label: `私聊 来自 ${sender}`, kind: 'direct' };
  return { label: `私聊（转发，发往 ${nodeNumToId(to)}）来自 ${sender}`, kind: 'direct' };
}

async function pollBleContinuousReceive() {
  const info = state.bleContinuous;
  if (!info.running) return;
  const transport = connectedSingleBleTransport();
  if (!transport) return;
  try {
    await drainBleFromRadio(transport, { maxPackets: 4, maxMs: 200 });
    const list = transport.received || [];
    const start = Math.max(0, info.lastReceivedIndex || 0);
    for (const item of list.slice(start)) {
      info.received += 1;
      const signal = bleSignalText(item);
      const route = bleReceivedTextLabel(transport, item);
      const text = item.text || '';
      const undecryptable = route.kind === 'direct' && !text && item.pki_encrypted
        ? '（PKI 加密的私聊，浏览器侧无法解密）'
        : '';
      pushBleContinuousRecord('rx', `${route.label}: ${text}${undecryptable}`, signal);
    }
    info.lastReceivedIndex = list.length;
    renderBleContinuous();
  } catch (error) {
    info.failed += 1;
    pushBleContinuousRecord('err', `接收读取失败：${error.message}`);
  }
}

async function sendBleContinuousOnce() {
  const info = state.bleContinuous;
  if (!info.running || info.sending) return;
  const transport = connectedSingleBleTransport();
  if (!transport) {
    info.failed += 1;
    pushBleContinuousRecord('err', '未连接 BLE 测试设备');
    return;
  }
  info.sending = true;
  const message = ($('bleContinuousMessage')?.value || currentMessageText() || 'hi').trim();
  const channel = Number($('bleContinuousChannel')?.value || $('messageChannel')?.value || 0);
  const nodeTarget = selectedBleContinuousNodeTarget();
  const retries = Math.max(0, Number($('bleContinuousRetries')?.value || 0));
  try {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        if (nodeTarget && !base64ToBytes(nodeTarget.publicKey)) {
          throw new Error(`${nodeTarget.label} 缺少可用公钥，请先运行前置检查读取 NodeDB。`);
        }
        const packetId = await writeBleText(transport, message, channel, nodeTarget?.nodeId || '', nodeTarget?.publicKey || '');
        info.sent += 1;
        const targetText = nodeTarget ? `节点 ${nodeTarget.label}` : `频道 ${channel}`;
        pushBleContinuousRecord('tx', `${targetText}: ${message}`, `packet=${packetId}`);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < retries) await delay(500);
      }
    }
    info.failed += 1;
    pushBleContinuousRecord('err', `发送失败：${lastError?.message || 'unknown error'}`);
  } finally {
    info.sending = false;
    renderBleContinuous();
  }
}

function stopBleContinuous(options = {}) {
  const info = state.bleContinuous;
  if (info.timer) clearInterval(info.timer);
  if (info.receiveTimer) clearInterval(info.receiveTimer);
  info.timer = null;
  info.receiveTimer = null;
  info.running = false;
  info.mode = '';
  info.sending = false;
  if (!options.silent) pushBleContinuousRecord('info', '已停止持续收发');
  renderBleContinuous();
}

async function runBleLongConnectionStability() {
  recoverStaleClientRun('已清理上一次未结束的 BLE 前端任务状态。');
  if (state.running) {
    showBleContinuousFeedback('当前已有任务在运行，请先停止或等待结束。', 'err');
    return;
  }
  if ($('connectionType')?.value !== 'ble') {
    showBleContinuousFeedback('长连接检查只适用于单设备 BLE 连接。', 'err');
    return;
  }
  const transport = connectedSingleBleTransport();
  if (!transport?.device?.gatt?.connected) {
    showBleContinuousFeedback('请先连接一台 BLE 测试设备。', 'err');
    return;
  }
  const seconds = Math.max(30, Math.min(180, Number($('bleStabilitySeconds')?.value || 60)));
  const started = performance.now();
  const deadline = Date.now() + seconds * 1000;
  const samples = [];
  const initialNodeId = String(transport.myInfo?.node_id || state.deviceNodeIds.primary || '').trim();
  state.bleStabilityAbort = false;
  state.activeTargetType = 'bleStability';
  setRunning(true);
  renderBleContinuous();
  renderProgress({ done: 0, total: Math.ceil(seconds / 5), percent: 0, events: [] });
  try {
    while (Date.now() < deadline) {
      if (state.bleStabilityAbort) {
        return finishWebBleResult(syntheticWebBleResult('SKIPPED', {
          caseId: 'MT-BLE-LONG-CONNECTION',
          module: 'BLE 长连接稳定性',
          objective: '单台设备持续保持 Web Bluetooth GATT 会话，并周期性读取身份。',
          stepName: 'BLE 长连接检查被用户停止',
          reason: 'user_canceled',
          stdout: `已完成 ${samples.length} 次身份读取后由用户停止。\n`,
          duration: Math.round((performance.now() - started) / 10) / 100,
          command: ['web-bluetooth', 'want_config_id', 'identity-poll'],
          passCriteria: '只有完整达到设定时长且每次身份读取成功才判定 PASS。',
        }), 'BLE 长连接检查已停止', runPayload('bleStability'));
      }
      const info = await requestBleIdentity(transport, 4);
      const nodeId = String(info?.node_id || transport.myInfo?.node_id || '').trim();
      const connected = Boolean(transport.device?.gatt?.connected);
      const sample = { at: new Date().toLocaleTimeString('zh-CN', { hour12: false }), nodeId, ok: Boolean(info?.ok && nodeId && connected) };
      samples.push(sample);
      const expectedNodeId = initialNodeId || nodeId;
      if (!sample.ok || (expectedNodeId && nodeId !== expectedNodeId)) {
        return finishWebBleResult(syntheticWebBleResult('FAIL', {
          caseId: 'MT-BLE-LONG-CONNECTION',
          module: 'BLE 长连接稳定性',
          objective: '单台设备持续保持 Web Bluetooth GATT 会话，并周期性读取身份。',
          stepName: `第 ${samples.length} 次身份读取`,
          reason: sample.ok ? 'ble_identity_changed' : 'ble_identity_read_failed',
          stdout: samples.map((item, index) => `${index + 1}. ${item.at} node=${item.nodeId || '-'} ok=${item.ok}`).join('\n') + '\n',
          stderr: sample.ok ? `连接的节点从 ${expectedNodeId} 变为 ${nodeId}。` : 'GATT 连接或身份读取未成功。',
          duration: Math.round((performance.now() - started) / 10) / 100,
          command: ['web-bluetooth', 'want_config_id', 'identity-poll'],
          passCriteria: '每次身份读取成功、GATT 始终连接且节点 ID 不变。',
        }), 'BLE 长连接检查失败', runPayload('bleStability'));
      }
      pushBleContinuousRecord('info', `长连接检查 ${samples.length}: ${nodeId}`);
      const done = Math.min(seconds, Math.round((performance.now() - started) / 1000));
      renderProgress({ done: samples.length, total: Math.ceil(seconds / 5), percent: Math.round(done / seconds * 100), current: { event: 'web_ble_identity', step: `第 ${samples.length} 次身份读取` }, events: [] });
      await delay(Math.min(5000, Math.max(0, deadline - Date.now())));
    }
    return finishWebBleResult(syntheticWebBleResult('PASS', {
      caseId: 'MT-BLE-LONG-CONNECTION',
      module: 'BLE 长连接稳定性',
      objective: '单台设备持续保持 Web Bluetooth GATT 会话，并周期性读取身份。',
      stepName: `完成 ${seconds} 秒长连接检查`,
      reason: 'ble_long_connection_stable',
      stdout: samples.map((item, index) => `${index + 1}. ${item.at} node=${item.nodeId} ok=${item.ok}`).join('\n') + '\n',
      duration: Math.round((performance.now() - started) / 10) / 100,
      command: ['web-bluetooth', 'want_config_id', 'identity-poll'],
      passCriteria: '完整达到设定时长；每次身份读取成功、GATT 始终连接且节点 ID 不变。',
    }), 'BLE 长连接检查通过', runPayload('bleStability'));
  } catch (error) {
    return finishWebBleResult(syntheticWebBleResult('FAIL', {
      caseId: 'MT-BLE-LONG-CONNECTION',
      module: 'BLE 长连接稳定性',
      objective: '单台设备持续保持 Web Bluetooth GATT 会话，并周期性读取身份。',
      stepName: `第 ${samples.length + 1} 次身份读取`,
      reason: 'ble_long_connection_error',
      stdout: samples.map((item, index) => `${index + 1}. ${item.at} node=${item.nodeId || '-'} ok=${item.ok}`).join('\n') + '\n',
      stderr: `${error.name || 'Error'}: ${error.message || String(error)}`,
      duration: Math.round((performance.now() - started) / 10) / 100,
      command: ['web-bluetooth', 'want_config_id', 'identity-poll'],
      passCriteria: '完整达到设定时长；每次身份读取成功、GATT 始终连接且节点 ID 不变。',
    }), 'BLE 长连接检查失败', runPayload('bleStability'));
  } finally {
    state.bleStabilityAbort = false;
    if (state.running) setRunning(false);
    renderBleContinuous();
  }
}

async function startBleContinuous(mode = 'send') {
  recoverStaleClientRun('已清理上一次未结束的 BLE 前端任务状态。');
  if (state.running) {
    showBleContinuousFeedback('当前已有前端 BLE 任务或后台任务在运行，请先停止运行后再启动持续收发。', 'err');
    return;
  }
  if ($('connectionType')?.value !== 'ble') {
    showBleContinuousFeedback('请先切换到 BLE 连接并连接测试设备。', 'err');
    return;
  }
  const transport = connectedSingleBleTransport();
  if (!transport?.device?.gatt?.connected) {
    showBleContinuousFeedback('请先连接 BLE 测试设备。', 'err');
    return;
  }
  const info = state.bleContinuous;
  if (info.running) return;
  info.running = true;
  info.mode = mode === 'receive' ? 'receive' : 'send';
  info.sent = 0;
  info.received = 0;
  info.failed = 0;
  info.startedAt = new Date().toISOString();
  info.records = [];
  info.lastReceivedIndex = transport.received?.length || 0;
  const intervalMs = Math.max(1, Number($('bleContinuousInterval')?.value || 5)) * 1000;
  const channel = Number($('bleContinuousChannel')?.value || $('messageChannel')?.value || 0);
  const nodeTarget = selectedBleContinuousNodeTarget();
  const targetText = nodeTarget ? `目标节点 ${nodeTarget.label}` : `频道 ${channel}`;
  pushBleContinuousRecord('info', info.mode === 'receive'
    ? '持续接收已启动'
    : `持续发送已启动，${targetText}，发送间隔 ${intervalMs / 1000}s`);
  renderBleContinuous();
  await pollBleContinuousReceive();
  if (info.mode === 'send') {
    await sendBleContinuousOnce();
    info.timer = setInterval(sendBleContinuousOnce, intervalMs);
  }
  info.receiveTimer = setInterval(pollBleContinuousReceive, 1000);
}

function showBlePairDialog(show) {
  $('blePairDialog')?.classList.toggle('hidden', !show);
}

async function connectBleInBrowser(role = 'primary') {
  if (WEB_BLE_SINGLE_DEVICE_ONLY && role !== 'primary') {
    setBleRoleStatus(role, '当前 BLE 先只支持单设备连接，请使用测试设备 1 BLE。', 'warn');
    return;
  }
  if (!navigator.bluetooth?.requestDevice) {
    setBleRoleStatus(role, '当前浏览器不支持 Web Bluetooth。', 'error');
    return;
  }
  if (WEB_BLE_SINGLE_DEVICE_ONLY) {
    await disconnectBle('peer');
  }
  let selectedId = state.selectedBleDeviceIds[role] || '';
  let selected = selectedId ? browserBleDevices.get(selectedId) : null;
  if (!selected) {
    await scanBleDevices(role);
    selectedId = state.selectedBleDeviceIds[role] || '';
    selected = selectedId ? browserBleDevices.get(selectedId) : null;
  }
  if (!selected) {
    setBleRoleStatus(role, `请先为${bleRoleLabel(role)}扫描并选择 BLE 设备。`, 'warn');
    return;
  }
  showBlePairDialog(true);
  setBleRoleStatus(role, '正在连接，请在系统窗口完成设备选择或 PIN 配对。', 'info');
  try {
    const selectedName = bleDeviceDisplayName(selected, role);
    assignBleTarget(selectedName, role);
    resetDeviceIdentity(role);
    await connectMeshtasticBleTransport(selected, role);
    state.connectedBleDeviceIds[role] = selected.id;
    setBleRoleStatus(role, `已连接：${selectedName}。可运行前置检查或点击“重新读取”。`, 'success');
    renderBleDevices(role);
  } catch (error) {
    setBleRoleStatus(role, `连接未完成：${friendlyBleError(error)}`, 'error');
  } finally {
    showBlePairDialog(false);
  }
}

async function disconnectBle(role = '') {
  if (state.running) cancelRun();
  if (state.bleContinuous.running) stopBleContinuous();
  const entries = role ? [[role, browserBleTransports.get(role)]] : [...browserBleTransports.entries()];
  for (const [entryRole, transport] of entries) {
    if (transport?.device?.gatt?.connected) {
      await enqueueBleGattOperation(transport, 'GATT.disconnect', async () => {
        transport.device.gatt.disconnect();
      }).catch(() => {});
    }
    browserBleTransports.delete(entryRole);
    state.connectedBleDeviceIds[entryRole] = '';
    state.selectedBleDeviceIds[entryRole] = '';
    const input = bleInputForRole(entryRole);
    if (input) input.value = '';
    renderBleDevices(entryRole);
    setBleRoleStatus(entryRole, `${bleRoleLabel(entryRole)} BLE 已断开`, 'warn');
  }
  if (!role) {
    state.connectedBleDeviceIds = { primary: '', peer: '' };
    state.selectedBleDeviceIds = { primary: '', peer: '' };
    browserBleTransports.clear();
  }
  resetDeviceIdentity(role || '');
}

function disconnectSerial() {
  if (state.running) cancelRun();
  if ($('primaryPort')) $('primaryPort').value = '';
  if ($('peerPort')) $('peerPort').value = '';
  if ($('observerPort')) $('observerPort').value = '';
  syncPortSelectors();
  resetDeviceIdentity();
  setEvidenceText('串口选择已断开；如后台任务正在运行，已发送停止请求。');
}


function renderReports(reports) {
  const list = $('reportList');
  list.classList.remove('empty');
  list.innerHTML = '';
  if (!reports?.length) {
    list.classList.add('empty');
    list.textContent = '\u6682\u65e0\u62a5\u544a';
    return;
  }
  for (const report of reports) {
    const item = document.createElement('div');
    item.className = 'report-item';
    item.innerHTML = `
      <strong>${escapeHtml(report.name)}</strong>
      <span>${escapeHtml(report.mtime)} \u00b7 ${Math.round(report.size / 1024 * 10) / 10} KB</span>
      <small>${escapeHtml(report.path || '')}</small>
      <div class="report-actions">
        <button type="button" data-report-open="${escapeHtml(report.name)}">\u6253\u5f00</button>
        <button type="button" data-report-download="${escapeHtml(report.name)}">\u4e0b\u8f7d</button>
      </div>
    `;
    list.appendChild(item);
  }
  list.querySelectorAll('[data-report-open]').forEach((button) => button.addEventListener('click', () => openReport(button.dataset.reportOpen)));
  list.querySelectorAll('[data-report-download]').forEach((button) => button.addEventListener('click', () => downloadReport(button.dataset.reportDownload)));
}

async function openReport(name) {
  try {
    const data = await api(`/api/report?name=${encodeURIComponent(name)}`);
    activatePage('reports');
    setEvidenceText(JSON.stringify(data, null, 2));
    $('reportDetailBox')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    setEvidenceText(`\u62a5\u544a\u6253\u5f00\u5931\u8d25: ${error.message}`);
  }
}

async function downloadReport(name) {
  try {
    const response = await fetch(`/api/report?name=${encodeURIComponent(name)}&download=1`);
    if (!response.ok) throw new Error(response.statusText);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setEvidenceText(`\u62a5\u544a\u5df2\u4e0b\u8f7d: ${name}`);
  } catch (error) {
    setEvidenceText(`\u62a5\u544a\u4e0b\u8f7d\u5931\u8d25: ${error.message}\n\u8bf7\u68c0\u67e5\u6d4f\u89c8\u5668\u4e0b\u8f7d\u6743\u9650\uff0c\u6216\u5728\u62a5\u544a\u9875\u91cd\u65b0\u4e0b\u8f7d\u3002`);
  }
}

function renderSerialLog(data) {
  if (!data) return;
  const statusText = data.status === 'running' ? `监听中 ${data.port}` : data.status === 'stopped' ? '已停止' : data.status === 'error' ? '异常' : data.status || '未启动';
  $('serialLogState').textContent = statusText;
  $('startSerialLog').disabled = Boolean(state.serialLogId && data.status === 'running');
  $('stopSerialLog').disabled = !(state.serialLogId && data.status === 'running');
  const lines = [
    data.path ? `\u6587\u4ef6: ${data.path}` : '',
    data.error ? `\u9519\u8bef: ${data.error}` : '',
    data.tail || '',
  ].filter(Boolean);
  $('serialLogTail').textContent = lines.join('\n\n') || '\u6682\u65e0\u65e5\u5fd7';
}

async function pollSerialLog() {
  if (!state.serialLogId) return;
  try {
    const data = await api(`/api/serial-log-status?id=${encodeURIComponent(state.serialLogId)}`);
    renderSerialLog(data);
    if (data.status !== 'running') {
      clearInterval(state.serialLogTimer);
      state.serialLogTimer = null;
      state.serialLogId = '';
    }
  } catch (error) {
    $('serialLogState').textContent = '\u65e5\u5fd7\u8f6e\u8be2\u5931\u8d25';
    $('serialLogTail').textContent = error.message;
  }
}

async function startSerialLog() {
  const port = $('logPort').value;
  if (!port) {
    $('serialLogTail').textContent = '\u5148\u9009\u62e9\u65e5\u5fd7\u4e32\u53e3';
    return;
  }
  if ([targetPort('primary'), targetPort('peer')].includes(port)) {
    $('serialLogTail').textContent = '\u65e5\u5fd7\u4e32\u53e3\u4e0d\u80fd\u548c\u6d4b\u8bd5\u8bbe\u5907\u4e32\u53e3\u76f8\u540c\uff0c\u5426\u5219\u4f1a\u5360\u7528\u8bbe\u5907';
    return;
  }
  try {
    const data = await api('/api/serial-log/start', {
      method: 'POST',
      body: JSON.stringify({ port, baud: Number($('logBaud').value || 115200) }),
    });
    state.serialLogId = data.id || '';
    renderSerialLog(data);
    if (state.serialLogTimer) clearInterval(state.serialLogTimer);
    state.serialLogTimer = setInterval(pollSerialLog, 1500);
  } catch (error) {
    $('serialLogState').textContent = '\u542f\u52a8\u5931\u8d25';
    $('serialLogTail').textContent = error.message;
  }
}

async function stopSerialLog() {
  if (!state.serialLogId) return;
  try {
    const data = await api('/api/serial-log/stop', { method: 'POST', body: JSON.stringify({ id: state.serialLogId }) });
    renderSerialLog(data);
  } catch (error) {
    $('serialLogTail').textContent = `\u505c\u6b62\u5931\u8d25: ${error.message}`;
  }
}

function setRunning(value) {
  state.running = value;
  state.clientRunStartedAt = value && !state.currentJobId ? Date.now() : 0;
  // 运行中只保留「逃生」按钮可点：停止运行、停止 BLE 持续收发、断开连接。
  // 其余操作按钮（运行/下发/通信/实验/扫描/刷新等）运行期间一律禁用，避免并发操作串扰状态。
  const alwaysEnabled = new Set([
    'stopRun',
    'stopBleContinuous',
    'disconnectSerial',
    'disconnectBlePrimary',
    'disconnectBlePeer',
  ]);
  document.querySelectorAll('button').forEach((button) => {
    if (button.id === 'stopRun') button.disabled = !value;
    else if (button.id === 'stopSerialLog') button.disabled = !state.serialLogId;
    else if (button.id === 'startSerialLog') button.disabled = Boolean(state.serialLogId);
    else if (alwaysEnabled.has(button.id)) button.disabled = false;
    else button.disabled = value;
  });
  if (value) {
    $('runState').textContent = '\u8fd0\u884c\u4e2d';
    $('runState').className = 'badge running';
    setRunNotice('');
  } else {
    state.currentJobId = '';
    state.clientRunStartedAt = 0;
    // 运行结束把进度面板切到终态：否则面板会停在最后一条进行中事件上
    // （表现为任务已 PASS 却仍显示"正在执行 Web BLE 操作 / 等待第一条进度"）。
    if (state.lastProgressSummary && !state.lastProgressSummary.finished) {
      renderRunFinished(state.lastProgressSummary.current?.status || 'done');
    }
  }
}

function recoverStaleClientRun(reason = '') {
  const isBleMode = $('connectionType')?.value === 'ble';
  const ageMs = state.clientRunStartedAt ? Date.now() - state.clientRunStartedAt : 0;
  if (!state.running || state.currentJobId || !isBleMode || ageMs < 10000) return false;
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
  $('runState').textContent = '待运行';
  $('runState').className = 'badge idle';
  setRunning(false);
  // 先放开运行态再重置面板：否则终态渲染会把"已清理"覆盖成任务结束。
  renderProgress({ done: 0, total: 0, percent: 0, events: [] });
  if (reason) $('commandBox').textContent = reason;
  return true;
}

function renderProgress(summary = {}) {
  if (summary && typeof summary === 'object') state.lastProgressSummary = summary;
  const done = summary.done || 0;
  const total = summary.total || 0;
  $('progressNumber').textContent = `${done} / ${total}`;
  $('progressBar').style.width = `${summary.percent || 0}%`;
  const current = summary.current || {};
  // 终态判定：任务结束后绝不能再显示「等待第一条进度 / 正在执行」这类进行中文案。
  const finished = Boolean(summary.finished) || current.event === 'run_end';
  const endLabel = current.status ? `\u4efb\u52a1\u7ed3\u675f: ${displayStatus(current.status)}` : '\u4efb\u52a1\u7ed3\u675f';
  $('progressTitle').textContent = finished
    ? endLabel
    : current.step
      ? `\u5f53\u524d: ${displayText(current.step)}`
      : state.running
        ? '\u4efb\u52a1\u5df2\u63d0\u4ea4\uff0c\u7b49\u5f85\u7b2c\u4e00\u6761\u8fdb\u5ea6'
        : '\u672a\u8fd0\u884c';
  const list = $('progressList');
  list.innerHTML = '';
  const rowsByIndex = new Map();
  for (const event of (summary.events || [])) {
    if (event.event === 'step_start') rowsByIndex.set(event.index, { ...event, status: 'RUNNING' });
    if (event.event === 'step_end') rowsByIndex.set(event.index, event);
  }
  if (finished) {
    // 被停止/中断的步骤不会再有 step_end：把悬空的 RUNNING 行改成终态，避免面板里留着"运行中"。
    const danglingStatus = current.status === 'canceled' ? 'canceled' : 'SKIPPED';
    for (const [index, row] of rowsByIndex) {
      if (row.status === 'RUNNING') rowsByIndex.set(index, { ...row, status: danglingStatus });
    }
  }
  const rows = [...rowsByIndex.values()].slice(-12).reverse();
  if (!rows.length) {
    list.classList.add('empty');
    list.textContent = finished
      ? `${endLabel}\uff0c\u672c\u6b21\u6ca1\u6709\u6b65\u9aa4\u660e\u7ec6`
      : state.running && String(current.event || '').startsWith('web_ble')
        ? current.step ? displayText(current.step) : '\u6b63\u5728\u6267\u884c Web BLE \u64cd\u4f5c'
        : state.running ? '\u4efb\u52a1\u5df2\u63d0\u4ea4\uff0c\u7b49\u5f85 runner \u8fd4\u56de\u8fdb\u5ea6' : '\u8fd0\u884c\u540e\u663e\u793a\u6b65\u9aa4';
    return;
  }
  list.classList.remove('empty');
  for (const event of rows) {
    const row = document.createElement('div');
    row.className = 'progress-row';
    row.innerHTML = `<span>${escapeHtml(event.index || '-')} / ${escapeHtml(event.total || '-')}</span><strong>${escapeHtml(displayText(event.step || event.event))}</strong><em>${escapeHtml(displayStatus(event.status))}</em>`;
    list.appendChild(row);
  }
}

// 任务收尾统一入口：把进度面板切到终态（标题 + 明细 + 悬空步骤）。
function renderRunFinished(status) {
  const last = state.lastProgressSummary || {};
  // 任务结束：清掉任务级提示，并把「持续收发」卡片头部恢复成正常的发送目标说明，
  // 保证任何任务提示都不会滞留在那张卡片上。
  setRunNotice('');
  updateBleContinuousRoute();
  renderProgress({
    done: last.done || 0,
    total: last.total || 0,
    percent: last.percent === undefined ? 100 : last.percent,
    finished: true,
    current: { event: 'run_end', status: status || last.current?.status || 'done' },
    events: last.events || [],
  });
}


function commandSummary(data) {
  const lines = [
    `\u4efb\u52a1 ID: ${data.id || '-'}`,
    `\u6267\u884c\u547d\u4ee4: ${commandText(data.command)}`,
    data.reportName ? `\u62a5\u544a: ${data.reportName}` : '',
  ].filter(Boolean);
  if (data.stderr) lines.push('', 'stderr:', data.stderr.slice(0, 1200));
  if (data.error) lines.push('', 'error:', data.error);
  return lines.join('\n');
}

function validateBeforeRun(targetType) {
  if (targetType === 'modules' && !selectedModules().length) {
    $('commandBox').textContent = '\u8bf7\u5148\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u6a21\u5757\u3002';
    return false;
  }
  const runsCommunication = targetType === 'communicationExperiment';
  const runsContactExchange = targetType === 'contactExchange';
  const isBleMode = $('connectionType')?.value === 'ble';
  if (isBleMode && targetType === 'module' && !hasBrowserBleTransport()) {
    $('commandBox').textContent = '请先连接 BLE 测试设备，再运行前置检查。';
    return false;
  }
  if (isBleMode && runsContactExchange && WEB_BLE_SINGLE_DEVICE_ONLY) {
    $('commandBox').textContent = 'Web BLE 单设备模式暂不支持“建立联系人”；请先运行前置检查读取 NodeDB，再用“运行通信”发给指定节点，或切回串口路径建立联系人。';
    return false;
  }
  if (targetType === 'customConfig') {
    const plan = currentConfigPlan();
    if (plan.pskError) {
      $('commandBox').textContent = plan.pskError;
      validateChannelPskForm();
      return false;
    }
    if (plan.kind === 'tzdef' && !validateTzField()) {
      $('commandBox').textContent = $('configTzError')?.textContent || '时区（tzdef）格式不合法。';
      return false;
    }
    if (WEB_BLE_SINGLE_DEVICE_ONLY && $('connectionType')?.value === 'ble') {
      if ($('configTarget')) $('configTarget').value = 'primary';
      plan.target = 'primary';
      syncCustomSelect($('configTarget'));
    }
    if (plan.target === 'both' && !hasPeerConnection()) {
      $('commandBox').textContent = '\u5f53\u524d\u53ea\u8fde\u63a5\u4e86\u4e00\u53f0\u8bbe\u5907\uff0c\u4e0d\u80fd\u9009\u62e9\u201c\u4e24\u53f0\u8bbe\u5907\u201d\u4f5c\u4e3a\u5199\u5165\u76ee\u6807\u3002';
      return false;
    }
    if (plan.kind === 'language') {
      $('commandBox').textContent = '\u5f53\u524d Meshtastic CLI \u672a\u66b4\u9732 Language \u5199\u5165\u5b57\u6bb5\uff0c\u6682\u6309\u4eba\u5de5\u9a8c\u8bc1\u5904\u7406\u3002';
      return false;
    }
    if (plan.kind === 'channel' && !plan.payload.name && !plan.payload.psk) {
      $('commandBox').textContent = '\u9891\u9053\u914d\u7f6e\u81f3\u5c11\u9700\u8981\u586b\u5199\u9891\u9053\u540d\u79f0\u6216\u9891\u9053 PSK\u3002';
      return false;
    }
    if (!plan.field || !plan.value) {
      $('commandBox').textContent = '\u8bf7\u5148\u586b\u5199\u8be5\u914d\u7f6e\u9879\u5fc5\u586b\u503c\u3002';
      return false;
    }
    if (plan.kind === 'region' && !/^\d+(\.\d+)?$/.test(String(plan.payload.overrideFrequency || ''))) {
      $('commandBox').textContent = 'Frequency Override \u9700\u8981\u586b\u5199 MHz \u6570\u503c\uff1b\u586b 0 \u8868\u793a\u8ddf\u968f Region \u9ed8\u8ba4\u9891\u7387\u3002';
      return false;
    }
    if (plan.kind === 'frequency_override' && !/^\d+(\.\d+)?$/.test(plan.value)) {
      $('commandBox').textContent = 'Frequency Override \u9700\u8981\u586b\u5199 MHz \u6570\u503c\uff0c\u4f8b\u5982 868 \u6216 868.125\u3002';
      return false;
    }
    if (plan.kind === 'channel' && String(plan.payload.psk || '').trim().toLowerCase() === 'random') {
      $('commandBox').textContent = '\u53cc\u8bbe\u5907\u9891\u9053\u914d\u7f6e\u4e0d\u8981\u4f7f\u7528 psk=random\uff1b\u8bf7\u4f7f\u7528 default\u3001none \u6216\u4e24\u53f0\u8bbe\u5907\u76f8\u540c\u7684 0x... PSK\u3002';
      return false;
    }
    const channelPsk = String(plan.payload.psk || '').trim();
    if (plan.kind === 'channel' && channelPsk && !/^(default|none|0x[0-9a-fA-F]+|base64:.+)$/i.test(channelPsk)) {
      $('commandBox').textContent = '\u9891\u9053 PSK \u4ec5\u652f\u6301 default\u3001none\u30010x... \u6216 base64:...\u3002';
      return false;
    }
  }
  const overrideFrequency = $('overrideFrequency').value.trim();
  if (runsCommunication || runsContactExchange) {
    const type = $('connectionType').value;
    const primaryValue = targetConnectionValue('primary');
    const peerValue = targetConnectionValue('peer');
    const isChannelSend = runsCommunication && $('messageMode')?.value === 'channel';
    if (type === 'ble' && !isChannelSend && WEB_BLE_SINGLE_DEVICE_ONLY) {
      if (!hasBrowserBleTransport()) {
        $('commandBox').textContent = '请先连接一台 BLE 测试设备。';
        return false;
      }
      if (!$('messageNode')?.value) {
        $('commandBox').textContent = '请先运行前置检查读取 NodeDB，然后在“指定节点”中选择要发送的节点。';
        return false;
      }
    } else if (isChannelSend) {
      if (!primaryValue && !peerValue && !hasBrowserBleTransport()) {
        $('commandBox').textContent = '发送到频道至少需要连接一台设备；发给对端设备才需要两台设备。';
        return false;
      }
    } else if (!primaryValue || !peerValue) {
      $('commandBox').textContent = '\u8be5\u64cd\u4f5c\u9700\u8981\u4e24\u53f0\u8bbe\u5907\u8fde\u63a5\uff1a\u8bf7\u9009\u62e9\u4e24\u4e2a COM \u53e3\uff0c\u6216\u5b8c\u6210\u4e24\u53f0\u8bbe\u5907\u7684\u84dd\u7259\u8fde\u63a5\u3002';
      return false;
    }
    if (type === 'port' && primaryValue === peerValue) {
      $('commandBox').textContent = '\u4e24\u53f0\u8bbe\u5907\u4e0d\u80fd\u4f7f\u7528\u540c\u4e00\u4e2a\u4e32\u53e3\u3002';
      return false;
    }
    if ((type === 'host' || type === 'ble') && primaryValue === peerValue) {
      $('commandBox').textContent = '\u4e24\u53f0\u8bbe\u5907\u4e0d\u80fd\u4f7f\u7528\u540c\u4e00\u4e2a\u8fde\u63a5\u5730\u5740\u3002';
      return false;
    }
  }
  if (runsContactExchange && !$('allowMutating').checked) {
    $('commandBox').textContent = '\u5efa\u7acb\u8054\u7cfb\u4eba\u4f1a\u5199\u5165 NodeDB\uff0c\u8bf7\u5148\u5f00\u542f\u5199\u5165/\u53d1\u9001\u6743\u9650\u3002';
    return false;
  }
  if (targetType === 'communicationConfig' && $('useOverrideFrequency').checked && overrideFrequency && !/^\d+(\.\d+)?$/.test(overrideFrequency)) {
    $('commandBox').textContent = 'Frequency Override \u9700\u8981\u586b\u5199 MHz \u6570\u503c\uff0c\u4f8b\u5982 868 \u6216 868.125\u3002';
    return false;
  }
  if (targetType === 'communicationConfig' && $('useOverrideFrequency').checked && !overrideFrequency) {
    $('commandBox').textContent = '\u5df2\u9009\u62e9 Frequency Override\uff0c\u8bf7\u586b\u5199 MHz \u6570\u503c\u3002';
    return false;
  }
  if (targetType === 'communicationConfig' &&
      !$('useExperimentRegion').checked &&
      !$('useExperimentModem').checked &&
      !$('useOverrideFrequency').checked) {
    $('commandBox').textContent = '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u9700\u8981\u4e0b\u53d1\u7684\u901a\u4fe1\u914d\u7f6e\u9879\u3002';
    return false;
  }
  if (runsCommunication) {
    if (!$('allowMutating').checked) {
      $('commandBox').textContent = '通信验证会真实发送消息，请先切换到“实机可写”模式后再运行。';
      return false;
    }
    if (!$('messageText').value.trim()) {
      $('commandBox').textContent = '\u8bf7\u586b\u5199\u53cc\u5411\u53d1\u9001\u6d88\u606f\uff0c\u7cfb\u7edf\u4e0d\u4f1a\u81ea\u52a8\u751f\u6210\u6d88\u606f\u5185\u5bb9\u3002';
      return false;
    }
  }
  return true;
}

function hasSelectedCommunicationConfig() {
  return $('useExperimentRegion').checked || $('useExperimentModem').checked || $('useOverrideFrequency').checked;
}

function normalizeConfigValue(value) {
  return String(value ?? '').trim().toUpperCase();
}

function valuesMatchCurrent(field, target, desired) {
  const current = state.deviceConfigs[target]?.[field];
  if (current === undefined || current === '') return false;
  if (field === 'lora.override_frequency') {
    const left = Number(current || 0);
    const right = Number(desired || 0);
    return Number.isFinite(left) && Number.isFinite(right) && left === right;
  }
  return normalizeConfigValue(current) === normalizeConfigValue(desired);
}

function selectedCommunicationConfigAlreadyApplied() {
  const selected = [];
  if ($('useExperimentRegion').checked) selected.push(['lora.region', $('experimentRegion').value]);
  if ($('useExperimentModem').checked) {
    selected.push(['lora.modem_preset', $('experimentModem').value]);
    selected.push(['lora.use_preset', 'ON']);
  }
  if ($('useOverrideFrequency').checked) selected.push(['lora.override_frequency', $('overrideFrequency').value.trim()]);
  if (!selected.length) return false;
  return selected.every(([field, desired]) => valuesMatchCurrent(field, 'primary', desired) && valuesMatchCurrent(field, 'peer', desired));
}

function syncCommunicationControlsFromCache() {
  const region = state.deviceConfigs.primary['lora.region'];
  const peerRegion = state.deviceConfigs.peer['lora.region'];
  if (region && region === peerRegion && [...$('experimentRegion').options].some((option) => option.value === region)) $('experimentRegion').value = region;
  const modem = state.deviceConfigs.primary['lora.modem_preset'];
  const peerModem = state.deviceConfigs.peer['lora.modem_preset'];
  if (modem && modem === peerModem && [...$('experimentModem').options].some((option) => option.value === modem)) $('experimentModem').value = modem;
  const frequency = state.deviceConfigs.primary['lora.override_frequency'];
  const peerFrequency = state.deviceConfigs.peer['lora.override_frequency'];
  if (frequency !== undefined && String(frequency) === String(peerFrequency) && Number(frequency || 0) > 0) $('overrideFrequency').value = frequency;
}

function cachedCommunicationConfigConsistent() {
  const fields = ['lora.region', 'lora.modem_preset', 'lora.override_frequency'];
  for (const field of fields) {
    const primary = state.deviceConfigs.primary[field];
    const peer = state.deviceConfigs.peer[field];
    if (primary === undefined || peer === undefined) return false;
    if (normalizeConfigValue(primary) !== normalizeConfigValue(peer)) return false;
  }
  return true;
}

function runSucceeded(data) {
  const result = data.result || {};
  const steps = (result.cases || []).flatMap((item) => item.steps || []);
  return data.status === 'done' && steps.length > 0 && steps.every((step) => step.status === 'PASS');
}

function finishRun(data, label, payload) {
  let result = data.result || {};
  if (!result.cases?.length) result = syntheticRunResult(data);
  captureDeviceLabels(result);
  captureDeviceSnapshots(result);
  // 配置读回来自同一轮的 --get，优先级高于可能较早的 --info 快照。
  captureDeviceConfigs(result);
  captureChannelLabels(result);
  const hasFail = (result.cases || []).some((item) => (item.steps || []).some((step) => step.status === 'FAIL'));
  const hasSkipped = (result.cases || []).some((item) => (item.steps || []).some((step) => step.status === 'SKIPPED' || step.status === 'DRY_RUN'));
  state.runs.push({ id: data.id || `${Date.now()}`, label, result, report: data.report, payload });
  if (state.activeTargetType === 'customConfig' && !hasFail && !hasSkipped && state.pendingConfigPlan?.kind === 'channel') {
    const channel = state.pendingConfigPlan.payload || {};
    if (channel.name) {
      state.channels[Number(channel.index || 0)] = channel.name;
      updateChannelOptions();
    }
  }
  $('runState').textContent = hasFail || data.status !== 'done' ? '\u5931\u8d25' : hasSkipped ? '\u8df3\u8fc7' : '\u5b8c\u6210';
  $('runState').className = hasFail || data.status !== 'done' ? 'badge error' : hasSkipped ? 'badge warn' : 'badge done';
  summarize();
  renderResults();
  renderReports(data.reports);
  $('commandBox').textContent = commandSummary(data);
  setRunning(false);
  renderRunFinished(hasFail || data.status !== 'done' ? 'error' : hasSkipped ? 'SKIPPED' : 'PASS');
  return data;
}

async function pollJob(jobId, label) {
  const data = await api(`/api/run-status?id=${encodeURIComponent(jobId)}`);
  renderProgress(data.progressSummary);
  $('commandBox').textContent = commandSummary(data);
  if (!terminalStatuses.has(data.status)) return false;
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
  finishRun(data, label);
  return true;
}

async function runExistingPayload(payload, label, visible = true) {
  if (state.running) return null;
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = null;
  state.activeTargetType = payload.targetType || '';
  state.pendingConfigPlan = payload.targetType === 'customConfig' ? {
    kind: payload.configKind,
    target: payload.configTarget,
    field: payload.configField,
    value: payload.configValue,
    payload: payload.configJson || {},
  } : null;
  setRunning(true);
  renderProgress({ done: 0, total: 0, percent: 0, events: [] });
  $('commandBox').textContent = '\u4efb\u52a1\u5df2\u521b\u5efa\uff0c\u7b49\u5f85 runner \u8fd4\u56de\u8fdb\u5ea6\u3002';
  try {
    let data = await api('/api/run', { method: 'POST', body: JSON.stringify(payload) });
    state.currentJobId = data.id || '';
    renderProgress(data.progressSummary || { done: 0, total: data.estimatedSteps || 0, percent: 0, events: [] });
    $('commandBox').textContent = commandSummary(data);
    while (!terminalStatuses.has(data.status)) {
      await delay(800);
      data = await api(`/api/run-status?id=${encodeURIComponent(data.id)}`);
      renderProgress(data.progressSummary);
      $('commandBox').textContent = commandSummary(data);
    }
    data._payload = payload;
    if (data.status === 'canceled') {
      $('runState').textContent = '\u5df2\u505c\u6b62';
      $('runState').className = 'badge warn';
      setRunning(false);
      renderRunFinished('canceled');
      return data;
    }
    if (visible) return finishRun(data, label, payload);
    let result = data.result || {};
    if (!result.cases?.length) result = syntheticRunResult(data);
    captureDeviceLabels(result);
    captureDeviceSnapshots(result);
    captureDeviceConfigs(result);
    captureChannelLabels(result);
    renderReports(data.reports);
    $('commandBox').textContent = commandSummary(data);
    setRunning(false);
    return data;
  } catch (error) {
    $('runState').textContent = '\u5f02\u5e38';
    $('runState').className = 'badge error';
    $('commandBox').textContent = error.message;
    setRunning(false);
    renderRunFinished('error');
    return null;
  }
}

async function runTarget(targetType, value, visible = true) {
  recoverStaleClientRun('已清理上一次未结束的 BLE 前端任务状态，请重新运行。');
  if (state.running) {
    showBleActionFeedback('当前已有任务在运行，请先点“停止运行”或等待任务结束。', 'err');
    return null;
  }
  const isBleMode = state.systemMode === 'meshtastic' && $('connectionType')?.value === 'ble';
  if (isBleMode && (targetType === 'module' || targetType === 'modules' || targetType === 'case' || targetType === 'customConfig')) {
    const actionText = targetType === 'customConfig' ? '正在准备 BLE 配置下发...' : '正在准备 BLE 前置检查...';
    showBleActionFeedback(actionText, 'info');
    renderProgress({
      done: 0,
      total: 1,
      percent: 0,
      current: { event: 'web_ble_prepare', step: actionText },
      events: [],
    });
  }
  if (!validateBeforeRun(targetType, value)) {
    showBleActionFeedback($('commandBox')?.textContent || '当前条件不足，未开始运行。', 'err');
    return null;
  }
  const payload = runPayload(targetType, value);
  const label = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  if (targetType === 'customConfig' && state.systemMode === 'meshtastic' && $('connectionType')?.value === 'ble') {
    return runWebBleConfigWrite(payload, label);
  }
  if (state.systemMode === 'meshtastic' && shouldUseBrowserBlePrecheck(targetType)) {
    return runWebBlePrecheck(payload, label);
  }
  return runExistingPayload(payload, label, visible);
}

async function cancelRun() {
  if (!state.currentJobId) {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    state.bleStabilityAbort = true;
    stopBleContinuous({ silent: true });
    $('runState').textContent = '已停止';
    $('runState').className = 'badge warn';
    $('commandBox').textContent = '已停止当前前端 BLE 任务。';
    renderProgress({ done: 0, total: 0, percent: 0, current: { event: 'run_end', status: 'canceled' }, events: [] });
    setRunning(false);
    return;
  }
  const jobId = state.currentJobId;
  try {
    const data = await api('/api/cancel', { method: 'POST', body: JSON.stringify({ id: jobId }) });
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    $('runState').textContent = '\u5df2\u505c\u6b62';
    $('runState').className = 'badge warn';
    $('commandBox').textContent = commandSummary(data);
    renderProgress({ done: 0, total: 0, percent: 0, current: { event: 'run_end', status: 'canceled' }, events: [] });
    setRunning(false);
  } catch (error) {
    $('commandBox').textContent = `\u505c\u6b62\u5931\u8d25: ${error.message}`;
  }
}

function canRunWebBleCommunication() {
  return state.systemMode === 'meshtastic' && $('connectionType')?.value === 'ble' && hasConnectedBleRole('primary') && hasConnectedBleRole('peer');
}

function canRunWebBleChannelSend() {
  return state.systemMode === 'meshtastic' && $('connectionType')?.value === 'ble' && connectedBleRoles().length > 0 && $('messageMode')?.value === 'channel';
}

function hasBrowserBleTransport() {
  return $('connectionType')?.value === 'ble' && connectedBleRoles().length > 0;
}

function shouldUseBrowserBlePrecheck(targetType) {
  return hasBrowserBleTransport() && ['module', 'modules', 'case'].includes(targetType);
}

function bleInfoHasConfigDetails(info) {
  const configs = info?.configs || {};
  const lora = configs.lora || {};
  const hasLora = Boolean(lora.region || lora.modemPreset || lora.overrideFrequency !== undefined || lora.channelNum !== undefined);
  const hasDevice = Boolean(configs.device?.role);
  const hasNetwork = configs.network?.wifiEnabled !== undefined || Boolean(configs.network?.wifiSsid);
  const hasBluetooth = configs.bluetooth?.enabled !== undefined || configs.bluetooth?.fixedPin !== undefined;
  return Boolean(hasLora || hasDevice || hasNetwork || hasBluetooth || (info?.channels || []).some((channel) => channel.settings?.name));
}

function ensureSingleBleLayout() {
  if (!WEB_BLE_SINGLE_DEVICE_ONLY) return;
  const peerCard = document.querySelector('[data-ble-role="peer"]');
  if (peerCard) peerCard.remove();
  const isBleMode = $('connectionType')?.value === 'ble';
  document.body.classList.toggle('ble-single-device-layout', isBleMode);

  // BLE 布局：设备当前配置卡片与「配置写入」横向并排，原来「配置写入」的位置放 BLE 测试项卡片。
  const testGrid = document.querySelector('.test-grid');
  const snapshotBox = document.querySelector('.snapshot-box');
  const bleTestCard = $('bleTestCard');
  if (testGrid && snapshotBox) {
    if (isBleMode) {
      if (snapshotBox.parentElement !== testGrid) {
        bleLayoutHome.parent = snapshotBox.parentElement;
        bleLayoutHome.next = snapshotBox.nextElementSibling;
        testGrid.insertBefore(snapshotBox, testGrid.firstElementChild);
      }
      testGrid.classList.add('ble-layout');
    } else {
      if (snapshotBox.parentElement === testGrid && bleLayoutHome.parent) {
        bleLayoutHome.parent.insertBefore(snapshotBox, bleLayoutHome.next || null);
        bleLayoutHome.parent = null;
        bleLayoutHome.next = null;
      }
      testGrid.classList.remove('ble-layout');
    }
  }
  if (bleTestCard) bleTestCard.classList.toggle('hidden', !isBleMode);
  if (isBleMode) renderBleTestItems();

  const modulesPanel = document.querySelector('.panel.modules');
  const communicationPanel = document.querySelector('.communication-card');
  modulesPanel?.classList.toggle('ble-continuous-mode', isBleMode);
  communicationPanel?.classList.toggle('hidden', isBleMode);
  const title = modulesPanel?.querySelector('.panel-title h2');
  if (title) {
    title.dataset.defaultText ||= title.textContent;
    title.textContent = isBleMode ? 'BLE 持续收发' : title.dataset.defaultText;
  }
  const panel = $('bleContinuousPanel');
  const grid = $('moduleGrid');
  if (panel && grid && panel.previousElementSibling !== grid) {
    grid.insertAdjacentElement('afterend', panel);
  }
  if (panel) panel.classList.toggle('hidden', !isBleMode);
}

// BLE 专用用例（connection=ble）不放进串口模块卡片，单独渲染到 BLE 测试项卡片里。
const bleLayoutHome = { parent: null, next: null };

function bleCases() {
  const out = [];
  for (const cases of Object.values(state.modules || {})) {
    for (const item of cases) {
      if ((item.connection || 'serial') === 'ble') out.push(item);
    }
  }
  return out;
}

function selectedBleCaseIds() {
  return [...document.querySelectorAll('[data-ble-case-check]')].filter((item) => item.checked).map((item) => item.value);
}

function syncBleSelectAll() {
  const checks = [...document.querySelectorAll('[data-ble-case-check]')];
  const toggle = $('toggleAllBleCases');
  if (!toggle) return;
  toggle.checked = checks.length > 0 && checks.every((item) => item.checked);
  toggle.indeterminate = checks.some((item) => item.checked) && !checks.every((item) => item.checked);
}

function renderBleTestItems() {
  const list = $('bleCaseList');
  if (!list) return;
  const items = bleCases();
  if (!items.length) {
    list.classList.add('empty');
    list.textContent = '当前没有 BLE 专用测试项';
    return;
  }
  list.classList.remove('empty');
  list.innerHTML = items.map((item) => {
    const label = item.display_name || item.source_case || item.id;
    const tip = buildCaseTip(item);
    // 用例覆盖哪些具体项要能直接看到：时区用例就是 7 个具体时区（US/Hawaii …），
    // 不能只写「7 个 US/* 别名」而不列出是哪 7 个。
    const zones = Array.isArray(item.zones) ? item.zones : [];
    const zoneLine = zones.length
      ? `<div class="case-zones">${zones.map((zone) => {
        const name = typeof zone === 'string' ? zone : (zone.name || '');
        const posix = typeof zone === 'string' ? '' : (zone.posix || '');
        return `<span title="${escapeHtml(posix ? `${name} → POSIX ${posix}` : name)}">${escapeHtml(name)}</span>`;
      }).join('')}</div>`
      : '';
    return `<div class="case-row ble-case-row" title="${escapeHtml(tip)}">`
      + `<label class="case-check"><input type="checkbox" data-ble-case-check value="${escapeHtml(item.id)}" checked><span>${escapeHtml(label)}</span></label>`
      + `<button class="case-icon-run" data-ble-case="${escapeHtml(item.id)}" title="运行单条" aria-label="运行单条"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>`
      + zoneLine
      + '</div>';
  }).join('');
  list.querySelectorAll('[data-ble-case]').forEach((button) => {
    button.addEventListener('click', () => runTarget('case', button.dataset.bleCase));
  });
  list.querySelectorAll('[data-ble-case-check]').forEach((check) => {
    check.addEventListener('change', syncBleSelectAll);
  });
  syncBleSelectAll();
}

function restoreModuleGridAfterBleMode() {
  const grid = $('moduleGrid');
  if (!grid || $('connectionType')?.value === 'ble') return;
  if (grid.children.length || !Object.keys(state.modules || {}).length) return;
  renderModules();
}

function syntheticWebBleResult(stepStatus, evidence) {
  const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const caseId = evidence.caseId || 'MT-COMM-EXPERIMENT';
  const moduleName = evidence.module || '通信验证';
  const objective = evidence.objective || '使用浏览器 Web Bluetooth GATT 数据通道发送 Meshtastic ToRadio protobuf 文本消息。';
  const target = evidence.target || 'both';
  const transport = evidence.transport || 'Web Bluetooth / GATT / ToRadio';
  const command = evidence.command || ['web-bluetooth', 'ToRadio.writeValue', 'TEXT_MESSAGE_APP'];
  const actionSummary = evidence.actionSummary || '浏览器直接写入 Meshtastic ToRadio characteristic，并从 FromRadio 读取接收证据。';
  const passCriteria = evidence.passCriteria || '消息按所选方式写入 BLE 数据通道，并获得对应接收或写入确认。';
  return {
    id: `webble-${Date.now()}`,
    status: 'done',
    reports: [],
    result: {
      suite: 'Meshtastic Web Bluetooth 通信验证',
      transport: 'web_bluetooth',
      cases: [{
        id: caseId,
        module: moduleName,
        objective,
        transport: 'web_bluetooth',
        steps: [{
          name: evidence.stepName || moduleName,
          target,
          target_label: evidence.targetLabel || target,
          status: stepStatus,
          transport,
          command,
          action_summary: actionSummary,
          pass_criteria: passCriteria,
          reason: evidence.reason,
          stdout: evidence.stdout,
          stderr: evidence.stderr || '',
          duration_sec: evidence.duration,
          sent_messages: evidence.sentMessages,
          received_messages: evidence.receivedMessages,
        }],
        started_at: now,
        finished_at: now,
      }],
    },
  };
}

async function persistClientReport(data, payload) {
  try {
    const saved = await api('/api/client-report', {
      method: 'POST',
      body: JSON.stringify({
        result: data.result,
        transport: 'web_bluetooth',
        connectionType: payload?.connectionType || 'ble',
      }),
    });
    data.report = saved.report || data.report || '';
    data.reportName = saved.reportName || data.reportName || '';
    data.reports = saved.reports || data.reports || [];
  } catch (error) {
    data.reportSaveError = error.message;
  }
  return data;
}

async function finishWebBleResult(data, label, payload) {
  await persistClientReport(data, payload);
  return finishRun(data, label, payload);
}

async function runWebBlePrecheck(payload, label) {
  if (state.running) {
    recoverStaleClientRun('已清理上一轮未结束的 BLE 前端任务状态，请重新执行前置检查。');
    if (state.running) {
      showBleActionFeedback('当前已有任务在运行，请先停止或等待结束后再运行前置检查。', 'err');
      return null;
    }
  }
  const candidateRoles = selectedBleRoles();
  const roles = connectedBleRoles();
  const skippedRoles = candidateRoles.filter((role) => !hasConnectedBleRole(role));
  state.activeTargetType = payload.targetType || '';
  state.pendingConfigPlan = null;
  setRunning(true);
  renderProgress({ done: 0, total: Math.max(roles.length + skippedRoles.length, 1), percent: 0, events: [] });
  $('commandBox').textContent = '浏览器 BLE GATT 已连接，正在通过 ToRadio/FromRadio 读取已连接设备身份。';
  const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const steps = [];
  for (const role of skippedRoles) {
    const displayIndex = role === 'primary' ? '1' : '2';
    steps.push({
      name: `跳过测试设备${displayIndex} BLE 身份读取`,
      target: role,
      status: 'SKIPPED',
      transport: 'Web Bluetooth / GATT / ToRadio',
      command: ['web-bluetooth', 'skip-disconnected-role'],
      action_summary: '该测试设备没有保持有效 GATT 连接，前置检查不使用历史连接记录强制执行。',
      pass_criteria: '只有当前 GATT connected 且 ToRadio/FromRadio 特征已准备好的设备才会执行 BLE 身份读取。',
      reason: 'web_ble_role_not_connected_skipped',
      stdout: `${bleRoleLabel(role)} 未连接，已跳过；请先单独点击该设备的“连接 BLE”。\n`,
      stderr: '',
    });
  }
  if (!roles.length) {
    if (!steps.length) {
      steps.push({
        name: '未发现已连接 BLE 设备',
        target: 'ble',
        status: 'FAIL',
        transport: 'Web Bluetooth / GATT / ToRadio',
        command: ['web-bluetooth', 'no-connected-device'],
        action_summary: '浏览器当前没有可执行的 Meshtastic BLE GATT 会话。',
        pass_criteria: '至少一台测试设备需要完成浏览器 GATT 连接。',
        reason: 'web_ble_no_connected_device',
        stdout: '',
        stderr: '浏览器当前没有已连接的 Meshtastic BLE 设备。',
      });
    }
    const result = {
      id: `webble-precheck-${Date.now()}`,
      status: 'done',
      reports: [],
      result: {
        suite: 'Meshtastic Web Bluetooth 设备检查',
        transport: 'web_bluetooth',
        cases: [{
          id: 'MT-PRECHECK-PAIR',
          module: '测试前检查',
          objective: '按浏览器当前有效 BLE GATT 连接逐台读取设备身份。',
          transport: 'web_bluetooth',
          steps,
          started_at: now,
          finished_at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        }],
      },
    };
    renderProgress({
      done: steps.length,
      total: steps.length || 1,
      percent: 100,
      current: { event: 'web_ble_end', status: 'FAIL' },
      events: steps.map((step, index) => ({ index: index + 1, total: steps.length, message: step.name, status: step.status })),
    });
    await persistClientReport(result, payload);
    return finishRun(result, label, payload);
  }
  for (let index = 0; index < roles.length; index += 1) {
    const role = roles[index];
    const displayIndex = role === 'primary' ? '1' : '2';
    const progressDone = skippedRoles.length + index;
    const progressTotal = skippedRoles.length + roles.length;
    renderProgress({
      done: progressDone,
      total: progressTotal,
      percent: Math.round(progressDone / Math.max(progressTotal, 1) * 100),
      current: { event: 'web_ble_identity', step: `读取测试设备${displayIndex} BLE 身份` },
      events: steps.map((step, eventIndex) => ({ index: eventIndex + 1, total: progressTotal, message: step.name, status: step.status })),
    });
    try {
      let info;
      let readMode = 'full_config';
      let readError = '';
      try {
        const result = await readBleInfoWithRetry(role, { attempts: BLE_CONFIG_READ_RETRIES });
        info = result.info;
        if (!result.complete) {
          readMode = 'identity_fallback';
          readError = result.error ? `${result.error.name || 'Error'}: ${result.error.message}` : '';
        }
      } catch (error) {
        readMode = 'identity_fallback';
        readError = `${error.name || 'Error'}: ${error.message}`;
        const transport = browserBleTransports.get(role);
        info = await requestBleIdentity(transport, 8);
      }
      const hasConfigDetails = bleInfoHasConfigDetails(info);
      const status = info.ok && hasConfigDetails ? 'PASS' : 'FAIL';
      applyBleInfoToState(role, info);
      const lora = info.configs?.lora || {};
      const network = info.configs?.network || {};
      const bluetooth = info.configs?.bluetooth || {};
      const modemPresetDisplay = lora.modemPreset || 'LONG_FAST';
      const overrideFrequencyDisplay = lora.overrideFrequency ?? 0;
      steps.push({
        name: `读取测试设备${displayIndex} BLE 身份`,
        target: role,
        status,
        transport: 'Web Bluetooth / GATT / ToRadio',
        command: ['web-bluetooth', 'want_config_id', 'FromRadio.my_info'],
        action_summary: '浏览器使用已授权的 GATT 会话写入 ToRadio want_config_id，并从 FromRadio 读取 my_info/node_info。',
        pass_criteria: '必须读取到本设备 my_node_num；如 FromRadio 同步到本机 node_info，则附带显示本设备公钥。',
        reason: status === 'PASS'
          ? 'web_ble_full_config_read'
          : info.ok ? 'web_ble_config_incomplete' : 'web_ble_identity_missing',
        stdout: [
          `role=${role}`,
          `readMode=${readMode}`,
          `configComplete=${hasConfigDetails ? 'yes' : 'no'}`,
          `node=${info.nodeId || '-'}`,
          `shortName=${info.shortName || '-'}`,
          `longName=${info.longName || '-'}`,
          `publicKey=${info.publicKey || '-'}`,
          `region=${lora.region || '-'}`,
          `modemPreset=${modemPresetDisplay}`,
          `overrideFrequency=${overrideFrequencyDisplay}`,
          `wifi=${network.wifiEnabled === undefined ? '-' : network.wifiEnabled ? 'ON' : 'OFF'}`,
          `bluetooth=${bluetooth.enabled === undefined ? '-' : bluetooth.enabled ? 'ON' : 'OFF'}`,
          `bluetoothPin=${bluetooth.fixedPin ?? '-'}`,
          `channels=${(info.channels || []).map((channel) => `${channel.index}:${channel.settings?.name || '-'}`).join(', ') || '-'}`,
          `nodes=${(info.nodes || []).length}`,
        ].join('\n') + '\n',
        stderr: readError,
        captured_node_id: info.nodeId || '',
        device_snapshot: state.deviceSnapshots[role],
        info_summary: {
          node_id: info.nodeId || '',
          short_name: info.shortName || '',
          long_name: info.longName || '',
          public_key: info.publicKey || '',
          lora,
          network,
          bluetooth,
        },
      });
    } catch (error) {
      steps.push({
        name: `读取测试设备${displayIndex} BLE 身份`,
        target: role,
        status: 'FAIL',
        transport: 'Web Bluetooth / GATT / ToRadio',
        command: ['web-bluetooth', 'want_config_id', 'FromRadio.my_info'],
        action_summary: '浏览器 GATT 已连接，但读取 Meshtastic protobuf 配置流失败。',
        pass_criteria: '必须能写入 ToRadio 并从 FromRadio 读到 my_info。',
        reason: 'web_ble_identity_error',
        stdout: '',
        stderr: `${error.name || 'Error'}: ${error.message}`,
      });
    }
  }
  if (roles.includes('primary') && roles.includes('peer') && state.deviceNodeIds.primary && state.deviceNodeIds.peer) {
    for (const [sourceRole, targetRole] of [['primary', 'peer'], ['peer', 'primary']]) {
      const evidence = bleNodeDbEvidence(sourceRole, targetRole);
      steps.push({
        name: `${displayTarget(sourceRole)} NodeDB / 公钥关系`,
        target: sourceRole,
        status: 'PASS',
        transport: 'Web Bluetooth / GATT / FromRadio',
        command: ['web-bluetooth', 'want_config_id', 'FromRadio.node_info'],
        action_summary: '从 Web BLE 配置同步流读取 NodeDB 节点信息，并检查是否出现对端节点及其公钥。',
        pass_criteria: '本步骤只记录 NodeDB 可见性与公钥证据；对端未出现在 NodeDB 中不单独判定前置检查失败。',
        reason: evidence.visible ? 'web_ble_nodedb_peer_visible' : 'web_ble_nodedb_peer_not_visible_note',
        stdout: [
          `source=${displayTarget(sourceRole)}`,
          `target=${displayTarget(targetRole)}`,
          `targetNode=${evidence.targetId || '-'}`,
          `visible=${evidence.visible ? 'yes' : 'no'}`,
          `targetShortName=${evidence.shortName || '-'}`,
          `publicKey=${evidence.publicKey || '-'}`,
          evidence.visible ? 'NodeDB 已出现对端节点。' : 'NodeDB 未出现对端节点，仅记录为可见性备注。',
        ].join('\n') + '\n',
        node_visibility: evidence,
      });
    }
  }
  const passCount = steps.filter((step) => step.status === 'PASS').length;
  const failCount = steps.filter((step) => step.status === 'FAIL').length;
  const pass = passCount > 0 && failCount === 0;
  const result = {
    id: `webble-precheck-${Date.now()}`,
    status: 'done',
    reports: [],
    result: {
      suite: 'Meshtastic Web Bluetooth 设备检查',
      transport: 'web_bluetooth',
      cases: [{
        id: 'MT-PRECHECK-PAIR',
        module: '测试前检查',
        objective: '按浏览器当前已连接的 BLE GATT 设备数量读取设备身份；只连接一台时只检查一台。',
        transport: 'web_bluetooth',
        steps,
        started_at: now,
        finished_at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      }],
    },
  };
  renderProgress({
    done: steps.length,
    total: steps.length || 1,
    percent: 100,
    current: { event: 'web_ble_end', status: pass ? 'PASS' : 'FAIL' },
    events: steps.map((step, index) => ({ index: index + 1, total: steps.length, message: step.name, status: step.status })),
  });
  await persistClientReport(result, payload);
  return finishRun(result, label, payload);
}

async function executeBleConfigPlan(plan, roles, progressLabel = 'BLE 配置下发') {
  const steps = [];
  const staticWrite = plan.bytes ? plan : null;
  for (let index = 0; index < roles.length; index += 1) {
    const role = roles[index];
    const targetLabel = displayTarget(role);
    const stepIndex = index + 1;
    const stepTotal = roles.length;
    renderProgress({
      done: index,
      total: roles.length,
      percent: Math.round(index / Math.max(roles.length, 1) * 100),
      current: { event: 'web_ble_config', step: `${progressLabel}: ${targetLabel}` },
      events: steps.map((step, eventIndex) => ({ event: 'step_end', index: eventIndex + 1, total: roles.length, step: step.name, status: step.status })),
    });
    try {
      await keepOtherBleRolesWarm(role);
      let transport = await ensureBleTransportConnected(role);
      const before = await requestBleConfig(transport, 8);
      applyBleInfoToState(role, before);
      // 必须在读到设备当前配置之后才生成写入包：写入要拿设备上报的整段子配置做底，
      // 只替换目标字段再整段写回（与 meshtastic CLI 的 --set 行为一致）。
      const adminWrite = staticWrite || encodeBleAdminWrite(plan, role);
      const configSource = staticWrite ? '计划内置字节' : adminWrite.merged ? '设备当前配置整段合并' : '仅目标字段（未取到完整配置）';
      if (adminWrite.expected?.length
        && adminWrite.expected.every(([field]) => bleReadbackKnown(role, field))
        && bleExpectedMatch(role, adminWrite.expected)) {
        steps.push({
          name: `${targetLabel} BLE 配置已与目标一致`,
          target: role,
          index: stepIndex,
          total: stepTotal,
          status: 'PASS',
          transport: 'Web Bluetooth / GATT / ADMIN_APP',
          command: ['web-bluetooth', 'readback-only'],
          reason: 'web_ble_config_already_applied',
          action_summary: '读取当前配置后发现目标字段已经与计划一致，因此不重复写入设备。',
          pass_criteria: '目标字段当前值与本轮计划值一致。',
          stdout: adminWrite.expected.map(([field, desired]) => `${field}=${desired}`).join('\n') + '\n',
        });
        continue;
      }
      await writeBleToRadioBytes(transport, adminWrite.bytes);
      const waitSec = Math.max(1, Number(plan.wait || 10));
      await delay(waitSec * 1000);
      // 写入 lora/device 等配置后设备会重启 BLE：这里等它重新广播并自动重连，
      // 只有重连/读回真的失败才判失败，并且明确区分“配置已下发但未核对”。
      let after = null;
      let readbackError = null;
      let readbackAttempts = 0;
      // 真机上配置写入会触发设备重启，实测约 27s 后 BLE 才回来读回新值：读回失败要重试，
      // 不能只试一次就把「还没重启完」判成「没生效」。
      for (let attempt = 0; attempt < 3 && !after; attempt += 1) {
        readbackAttempts += 1;
        try {
          transport = await ensureBleTransportConnected(role);
          after = await requestBleConfig(transport, Math.max(8, waitSec));
        } catch (error) {
          readbackError = error;
        }
        if (!after && attempt < 2) await delay(6000);
      }
      if (!after) {
        steps.push({
          name: `${targetLabel} BLE 配置已下发，读回待确认`,
          target: role,
          index: stepIndex,
          total: stepTotal,
          status: 'FAIL',
          transport: 'Web Bluetooth / GATT / ADMIN_APP',
          command: ['web-bluetooth', 'ToRadio.writeValue', 'ADMIN_APP'],
          reason: 'web_ble_config_readback_pending_after_reboot',
          failure_note: '配置写入命令已发送；Meshtastic 应用配置时会重启 BLE，本次没能重连读回，所以无法确认。请等设备回到主界面后重新连接并点击“重新读取”，再运行一次完成核对。',
          stdout: [
            `target=${targetLabel}`,
            `dest=${bleAdminDestination(role) || '-'}`,
            `wait=${waitSec}s`,
            `config_source=${configSource}`,
            `expected=${(adminWrite.expected || []).map(([field, desired]) => `${field}=${desired}`).join(', ') || '-'}`,
            ...(adminWrite.notes?.length ? [`notes=${adminWrite.notes.join('; ')}`] : []),
            'readback=未取到（设备重启 BLE，重连未成功）',
            `readback_attempts=${readbackAttempts}`,
          ].join('\n') + '\n',
          stderr: `${readbackError?.name || 'Error'}: ${readbackError?.message || '读回未完成'}`,
        });
        continue;
      }
      applyBleInfoToState(role, after);
      const pass = !adminWrite.expected?.length || bleExpectedMatch(role, adminWrite.expected);
      // 读回里根本没有这些字段时，要明确说"写入已发出但没能核对"，不能笼统说"设备未接受该字段"。
      const missingReadback = (adminWrite.expected || []).filter(([field]) => !bleReadbackKnown(role, field)).map(([field]) => field);
      steps.push({
        name: `${targetLabel} BLE 配置下发与读回校验`,
        target: role,
        index: stepIndex,
        total: stepTotal,
        status: pass ? 'PASS' : 'FAIL',
        transport: 'Web Bluetooth / GATT / ADMIN_APP',
        command: ['web-bluetooth', 'ToRadio.writeValue', 'ADMIN_APP'],
        reason: pass ? 'web_ble_config_readback_match' : 'web_ble_config_readback_mismatch',
        action_summary: '通过 Web Bluetooth 向 Meshtastic ToRadio characteristic 写入 ADMIN_APP 配置包，并重新读取同一字段核对。',
        pass_criteria: '配置写入后读回的字段值与本轮下发的目标值一致。',
        failure_note: pass
          ? ''
          : !adminWrite.merged
            ? '写入包不是按设备当前配置整段合并生成的：固件把 set_config 当整段替换，字段不完整或没有定向到本机 node num 的写入都会被设备忽略。请先点“重新读取”拿到完整配置与设备身份再下发。'
            : missingReadback.length
              ? `写入包已发出，但重新读取的结果里没有这些字段：${missingReadback.join(', ')}，所以本次无法确认是否生效。请等设备回到主界面后重新连接，点“重新读取”拿到完整配置，再重跑本项。`
              : '配置已按设备当前配置整段合并、并定向发往本机 node num 写入，但读回值仍与目标值不一致：设备可能还没完成重启，或该固件未接受该字段。',
        stdout: [
          `target=${targetLabel}`,
          `dest=${bleAdminDestination(role) || '-'}`,
          `wait=${waitSec}s`,
          `config_source=${configSource}`,
          `expected=${(adminWrite.expected || []).map(([field, desired]) => `${field}=${desired}`).join(', ') || '-'}`,
          ...(adminWrite.notes?.length ? [`notes=${adminWrite.notes.join('; ')}`] : []),
          `readback=${(adminWrite.expected || []).map(([field]) => `${field}=${bleReadbackDisplay(role, field)}`).join(', ') || '-'}`,
          `readback_attempts=${readbackAttempts}`,
        ].join('\n') + '\n',
        device_snapshot: state.deviceSnapshots[role],
      });
    } catch (error) {
      steps.push({
        name: `${targetLabel} BLE 配置下发与读回校验`,
        target: role,
        index: stepIndex,
        total: stepTotal,
        status: 'FAIL',
        transport: 'Web Bluetooth / GATT / ADMIN_APP',
        command: ['web-bluetooth', 'ToRadio.writeValue', 'ADMIN_APP'],
        reason: 'web_ble_config_error',
        failure_note: '配置下发流程没有走完，本步骤不能作为写入成功的证据。',
        stdout: '',
        stderr: `${error.name || 'Error'}: ${error.message}`,
      });
    }
  }
  renderProgress({
    done: steps.length,
    total: roles.length || 1,
    percent: 100,
    current: { event: 'web_ble_config_end', status: steps.every((step) => step.status === 'PASS') ? 'PASS' : 'FAIL' },
    events: steps.map((step, index) => ({ event: 'step_end', index: index + 1, total: steps.length, step: step.name, status: step.status })),
  });
  return steps;
}

async function runWebBleConfigWrite(payload, label) {
  if (state.running) {
    recoverStaleClientRun('已清理上一轮未结束的 BLE 前端任务状态，请重新下发配置。');
    if (state.running) {
      showBleActionFeedback('当前已有任务在运行，请先停止或等待结束后再下发配置。', 'err');
      return null;
    }
  }
  const plan = bleConfigPlanFromPayload(payload);
  const roles = bleRolesForConfigTarget(plan.target);
  state.activeTargetType = payload.targetType || 'customConfig';
  state.pendingConfigPlan = plan;
  setRunning(true);
  if (!roles.length) {
    const empty = syntheticWebBleResult('FAIL', {
      caseId: 'MT-CUSTOM-CONFIG',
      module: '\u914d\u7f6e\u5199\u5165',
      objective: '\u901a\u8fc7 Web Bluetooth ADMIN_APP \u5199\u5165 Meshtastic \u914d\u7f6e\u3002',
      stepName: '\u6ca1\u6709\u5df2\u8fde\u63a5\u7684 BLE \u76ee\u6807\u8bbe\u5907',
      reason: 'web_ble_no_target',
      stdout: '',
      duration: 0,
      sentMessages: [],
      receivedMessages: [],
    });
    return finishWebBleResult(empty, label, payload);
  }
  const started = performance.now();
  const startedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  let steps = [];
  try {
    steps = await executeBleConfigPlan(plan, roles, 'BLE 配置下发');
  } catch (error) {
    const duration = Math.round((performance.now() - started) / 10) / 100;
    return finishWebBleResult(syntheticWebBleResult('FAIL', {
      caseId: 'MT-CUSTOM-CONFIG',
      module: '配置写入',
      objective: '通过 Web Bluetooth ADMIN_APP 写入 Meshtastic 配置。',
      stepName: 'BLE 配置下发',
      target: roles.join(',') || 'ble',
      reason: 'web_ble_config_write_error',
      stdout: '',
      stderr: `${error.name || 'Error'}: ${error.message}`,
      duration,
      sentMessages: [],
      receivedMessages: [],
    }), 'Web BLE 配置下发失败', payload);
  }
  const pass = steps.length > 0 && steps.every((step) => step.status === 'PASS');
  const data = {
    id: `webble-config-${Date.now()}`,
    status: 'done',
    reports: [],
    result: {
      suite: 'Meshtastic Web Bluetooth 配置写入',
      transport: 'web_bluetooth',
      cases: [{
        id: 'MT-CUSTOM-CONFIG',
        module: '\u914d\u7f6e\u5199\u5165',
        source_case: 'BLE \u914d\u7f6e\u4e0b\u53d1\u4e0e\u8bfb\u56de\u6821\u9a8c',
        objective: '\u901a\u8fc7 Web Bluetooth ADMIN_APP \u5199\u5165 Meshtastic \u914d\u7f6e\u5e76\u6838\u5bf9\u8bfb\u56de\u503c\u3002',
        transport: 'web_bluetooth',
        steps,
        duration_sec: Math.round((performance.now() - started) / 10) / 100,
        started_at: startedAt,
        finished_at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      }],
    },
  };
  if (!pass) data.status = 'done';
  return finishWebBleResult(data, label, payload);
}

async function applyBleCommunicationConfigIfNeeded() {
  if (!hasSelectedCommunicationConfig()) return true;
  const roles = connectedBleRoles();
  if (!roles.length) return false;
  const plan = communicationConfigPlanFromControls();
  const steps = await executeBleConfigPlan(plan, roles, 'BLE 通信配置');
  return steps.length > 0 && steps.every((step) => step.status === 'PASS');
}

async function runWebBleCommunication() {
  let primary = browserBleTransports.get('primary');
  let peer = browserBleTransports.get('peer');
  const message = currentMessageText() || 'hi';
  const peerMessage = message;
  const channel = Number($('messageChannel')?.value || 0);
  const mode = $('messageMode')?.value || 'channel';
  const modeTitle = mode === 'device' ? '点对点双向通信' : '频道通信';
  const receiveWait = Number($('receiveWait')?.value || 10);
  const connectedRoles = connectedBleRoles();
  if (!connectedRoles.length) {
    return finishWebBleResult(syntheticWebBleResult('FAIL', {
      caseId: 'MT-COMM-EXPERIMENT',
      module: modeTitle,
      objective: '使用浏览器 Web Bluetooth 数据通道发送 Meshtastic 文本消息。',
      stepName: '检查 BLE 连接',
      reason: 'web_ble_no_connected_device',
      stdout: '请先连接 BLE 测试设备。\n',
      duration: 0,
      sentMessages: [],
      receivedMessages: [],
    }), 'Web BLE 通信失败', runPayload('communicationExperiment'));
  }
  if (mode === 'device' && connectedRoles.length === 1) {
    const role = connectedRoles[0];
    const selectedNode = selectedBleNodeTarget();
    if (!selectedNode?.nodeId) {
      return finishWebBleResult(syntheticWebBleResult('FAIL', {
        caseId: 'MT-COMM-DEVICE',
        module: '点对点发送',
        objective: '使用单台已连接 BLE 设备向 NodeDB 指定节点发送文本消息。',
        stepName: '选择目标节点',
        target: role,
        reason: 'web_ble_missing_node_target',
        stdout: '请先运行前置检查读取 NodeDB，然后在“指定节点”下拉框选择目标节点。\n',
        duration: 0,
        sentMessages: [],
        receivedMessages: [],
      }), 'Web BLE 点对点发送失败', runPayload('communicationExperiment'));
    }
    if (!base64ToBytes(selectedNode.publicKey)) {
      return finishWebBleResult(syntheticWebBleResult('FAIL', {
        caseId: 'MT-COMM-DEVICE',
        module: '点对点发送',
        objective: '使用单台已连接 BLE 设备向 NodeDB 指定节点发送文本消息。',
        stepName: `检查 ${selectedNode.label} 公钥`,
        target: role,
        targetLabel: `${displayTarget(role)} -> ${selectedNode.label}`,
        reason: 'web_ble_missing_peer_public_key',
        stdout: `NodeDB 中存在 ${selectedNode.label}，但没有读取到可用于私信加密的公钥，未发送。\n`,
        duration: 0,
        sentMessages: [],
        receivedMessages: [],
      }), 'Web BLE 点对点发送失败', runPayload('communicationExperiment'));
    }
    setRunning(true);
    renderProgress({ done: 0, total: 1, percent: 0, current: { event: 'web_ble_device_send', step: `发送给 ${selectedNode.label}` }, events: [] });
    const started = performance.now();
    try {
      const transport = await ensureBleTransportConnected(role, BLE_QUICK_RECONNECT_OPTIONS);
      const packetId = await writeBleText(transport, message, channel, selectedNode.nodeId, selectedNode.publicKey);
      await drainBleForWindow(transport, Math.max(2, Math.min(10, receiveWait))).catch(() => {});
      const duration = Math.round((performance.now() - started) / 10) / 100;
      renderProgress({ done: 1, total: 1, percent: 100, current: { event: 'web_ble_end', status: 'PASS' }, events: [] });
      return finishWebBleResult(syntheticWebBleResult('PASS', {
        caseId: 'MT-COMM-DEVICE',
        module: '点对点发送',
        objective: '使用单台已连接 BLE 设备向 NodeDB 指定节点发送文本消息。',
        stepName: `${displayTarget(role)} 发给 ${selectedNode.label}`,
        target: role,
        targetLabel: `${displayTarget(role)} -> ${selectedNode.label}`,
        actionSummary: '浏览器通过 Web Bluetooth 写入本设备 ToRadio characteristic，目标节点来自本设备 NodeDB。',
        passCriteria: '本用例确认本设备已接受 ToRadio 写入；对端屏幕或 App 收到消息需要由人工观察或对端日志二次验证。',
        reason: 'web_ble_device_write_accepted',
        stdout: [
          'Web Bluetooth single-device direct send.',
          `role=${role}`,
          `dest=${selectedNode.nodeId}`,
          `message=${message}`,
          `packet=${packetId}`,
          '单设备点对点发送只能证明 ToRadio 写入已被当前设备接受；对端可见性需要人工观察或对端日志验证。',
        ].join('\n') + '\n',
        duration,
        sentMessages: [{ from: role, to: selectedNode.nodeId, message, packet_id: packetId, received: null }],
        receivedMessages: [],
      }), 'Web BLE 点对点发送已下发', runPayload('communicationExperiment'));
    } catch (error) {
      const duration = Math.round((performance.now() - started) / 10) / 100;
      renderProgress({ done: 1, total: 1, percent: 100, current: { event: 'web_ble_error', status: 'FAIL' }, events: [] });
      return finishWebBleResult(syntheticWebBleResult('FAIL', {
        caseId: 'MT-COMM-DEVICE',
        module: '点对点发送',
        objective: '使用单台已连接 BLE 设备向 NodeDB 指定节点发送文本消息。',
        stepName: `${displayTarget(role)} 发给 ${selectedNode.label}`,
        target: role,
        targetLabel: `${displayTarget(role)} -> ${selectedNode.label}`,
        actionSummary: '浏览器通过 Web Bluetooth 写入本设备 ToRadio characteristic，目标节点来自本设备 NodeDB。',
        passCriteria: '本用例确认本设备已接受 ToRadio 写入；对端屏幕或 App 收到消息需要由人工观察或对端日志二次验证。',
        reason: 'web_ble_device_write_error',
        stdout: '',
        stderr: `${error.name || 'Error'}: ${error.message}`,
        duration,
        sentMessages: [],
        receivedMessages: [],
      }), 'Web BLE 点对点发送失败', runPayload('communicationExperiment'));
    }
  }
  if (mode === 'channel' && connectedRoles.length === 1) {
    const role = connectedRoles[0];
    setRunning(true);
    renderProgress({ done: 0, total: 1, percent: 0, current: { event: 'web_ble_channel_send' }, events: [] });
    const started = performance.now();
    try {
      const transport = await ensureBleTransportConnected(role, BLE_QUICK_RECONNECT_OPTIONS);
      const packetId = await writeBleText(transport, role === 'peer' ? peerMessage : message, channel, '');
      const sentAt = Date.now();
      await drainBleForWindow(transport, Math.max(2, Math.min(10, receiveWait))).catch(() => {});
      const localEvents = (transport.received || [])
        .filter((item) => Math.abs(Number(item.time || 0) - sentAt) < Math.max(2, receiveWait) * 1000)
        .map((item) => ({ target: role, text: item.text, channel: item.channel, from: item.from, to: item.to, id: item.id }));
      const duration = Math.round((performance.now() - started) / 10) / 100;
      renderProgress({ done: 1, total: 1, percent: 100, current: { event: 'web_ble_end', status: 'PASS' }, events: [] });
      return finishWebBleResult(syntheticWebBleResult('PASS', {
        caseId: 'MT-COMM-CHANNEL',
        module: '频道通信',
        objective: '使用单台已连接 BLE 设备向指定 Meshtastic 频道发送文本消息。',
        stepName: `${displayTarget(role)} 发送到频道 ${channel}`,
        target: role,
        targetLabel: `${displayTarget(role)} / 频道 ${channel}`,
        actionSummary: '浏览器通过 Web Bluetooth 写入本设备 ToRadio characteristic，触发设备向频道发送文本消息。',
        passCriteria: '单设备频道发送只确认本设备已接受 ToRadio 写入；空口接收需要另一台设备或串口日志二次验证。',
        reason: 'web_ble_channel_write_accepted',
        stdout: [
          'Web Bluetooth single-device channel send.',
          `role=${role}`,
          `channel=${channel}`,
          `message=${role === 'peer' ? peerMessage : message}`,
          `packet=${packetId}`,
          `localFromRadioEvents=${localEvents.length}`,
          '单设备频道发送只能证明 ToRadio 写入已被当前设备接受；没有第二台监听设备时不验证空口接收。',
        ].join('\n') + '\n',
        duration,
        sentMessages: [{ from: role, to: `channel:${channel}`, message: role === 'peer' ? peerMessage : message, packet_id: packetId, received: null }],
        receivedMessages: localEvents,
      }), 'Web BLE 频道发送已下发', runPayload('communicationExperiment'));
    } catch (error) {
      const duration = Math.round((performance.now() - started) / 10) / 100;
      renderProgress({ done: 1, total: 1, percent: 100, current: { event: 'web_ble_error', status: 'FAIL' }, events: [] });
      return finishWebBleResult(syntheticWebBleResult('FAIL', {
        caseId: 'MT-COMM-CHANNEL',
        module: '频道通信',
        objective: '使用单台已连接 BLE 设备向指定 Meshtastic 频道发送文本消息。',
        stepName: `${displayTarget(role)} 发送到频道 ${channel}`,
        target: role,
        targetLabel: `${displayTarget(role)} / 频道 ${channel}`,
        actionSummary: '浏览器通过 Web Bluetooth 写入本设备 ToRadio characteristic，触发设备向频道发送文本消息。',
        passCriteria: '单设备频道发送只确认本设备已接受 ToRadio 写入；空口接收需要另一台设备或串口日志二次验证。',
        reason: 'web_ble_channel_write_error',
        stdout: '',
        stderr: `${error.name || 'Error'}: ${error.message}`,
        duration,
        sentMessages: [],
        receivedMessages: [],
      }), 'Web BLE 频道发送失败', runPayload('communicationExperiment'));
    }
  }
  const primaryDest = mode === 'device' ? state.deviceNodeIds.peer : '';
  const peerDest = mode === 'device' ? state.deviceNodeIds.primary : '';
  const primaryDestKey = mode === 'device' ? (state.deviceSnapshots.peer?.publicKey || state.deviceSnapshots.peer?.summary?.public_key || '') : '';
  const peerDestKey = mode === 'device' ? (state.deviceSnapshots.primary?.publicKey || state.deviceSnapshots.primary?.summary?.public_key || '') : '';
  if (mode === 'device' && (!primaryDest || !peerDest)) {
    const failData = syntheticWebBleResult('FAIL', {
      reason: 'missing_dest',
      stdout: '点对点 BLE 发送需要先通过前置检查读取两台设备 node id。\n',
      duration: 0,
      sentMessages: [],
      receivedMessages: [],
    });
    return finishWebBleResult(failData, 'Web BLE 通信失败', runPayload('communicationExperiment'));
  }
  if (mode === 'device' && (!base64ToBytes(primaryDestKey) || !base64ToBytes(peerDestKey))) {
    const failData = syntheticWebBleResult('FAIL', {
      reason: 'missing_peer_public_key',
      stdout: [
        'Web Bluetooth private message requires peer public keys.',
        `primary_to_peer_key=${base64ToBytes(primaryDestKey) ? 'present' : 'missing'}`,
        `peer_to_primary_key=${base64ToBytes(peerDestKey) ? 'present' : 'missing'}`,
        '请先运行前置检查读取两台设备身份和本设备公钥；缺少公钥时不会发送普通非 PKI 私聊包。',
      ].join('\n') + '\n',
      duration: 0,
      sentMessages: [],
      receivedMessages: [],
    });
    return finishWebBleResult(failData, 'Web BLE 通信失败', runPayload('communicationExperiment'));
  }

  setRunning(true);
  renderProgress({ done: 0, total: 1, percent: 0, current: { event: 'web_ble_start' }, events: [] });
  const started = performance.now();
  try {
    primary = await ensureBleTransportConnected('primary', BLE_QUICK_RECONNECT_OPTIONS);
    peer = await ensureBleTransportConnected('peer', BLE_QUICK_RECONNECT_OPTIONS);
    const primaryPacket = await writeBleText(primary, message, channel, primaryDest, primaryDestKey);
    const peerReceived = await waitBleReceived(peer, message, channel, receiveWait);
    await delay(500);
    const peerPacket = await writeBleText(peer, peerMessage, channel, peerDest, peerDestKey);
    const primaryReceived = await waitBleReceived(primary, peerMessage, channel, receiveWait);
    const pass = peerReceived && primaryReceived;
    const duration = Math.round((performance.now() - started) / 10) / 100;
    const primaryTarget = mode === 'device' ? displayTarget('peer') : `频道 ${channel}`;
    const peerTarget = mode === 'device' ? displayTarget('primary') : `频道 ${channel}`;
    const stdout = [
      'Web Bluetooth Meshtastic protobuf send',
      `测试设备1 -> 测试设备2: ${message}; packet=${primaryPacket}; received=${peerReceived}`,
      `测试设备2 -> 测试设备1: ${peerMessage}; packet=${peerPacket}; received=${primaryReceived}`,
    ].join('\n') + '\n';
    const webBleStdout = [
      'Web Bluetooth Meshtastic protobuf send',
      `${displayTarget('primary')} -> ${primaryTarget}: ${message}; packet=${primaryPacket}; received=${peerReceived}`,
      `${displayTarget('peer')} -> ${peerTarget}: ${peerMessage}; packet=${peerPacket}; received=${primaryReceived}`,
    ].join('\n') + '\n';
    const evidence = {
      caseId: mode === 'device' ? 'MT-COMM-DEVICE' : 'MT-COMM-CHANNEL',
      module: modeTitle,
      objective: mode === 'device'
        ? '使用两台已连接 BLE 设备互发 Meshtastic 点对点私信。'
        : '使用两台已连接 BLE 设备向同一 Meshtastic 频道发送并监听文本消息。',
      stepName: mode === 'device' ? '点对点双向发送' : '双设备频道发送',
      target: 'both',
      targetLabel: mode === 'device' ? `${displayTarget('primary')} ↔ ${displayTarget('peer')}` : `频道 ${channel}`,
      actionSummary: mode === 'device'
        ? '浏览器分别向两台设备写入点对点 ToRadio 文本包，并从对端 FromRadio 读取文本事件。'
        : '浏览器分别向两台设备写入频道 ToRadio 文本包，并从另一台设备 FromRadio 读取文本事件。',
      passCriteria: mode === 'device'
        ? '两台 BLE 设备均收到对端真实文本事件；仅 ACK 不算收到。'
        : '两台 BLE 设备均在 FromRadio 中读取到对端发送到同一频道的相同文本。',
      reason: pass ? 'web_ble_dual_received' : 'web_ble_missing_receive',
      stdout: webBleStdout,
      duration,
      sentMessages: [
        { from: 'primary', to: mode === 'device' ? 'peer' : `channel:${channel}`, message, packet_id: primaryPacket, received: peerReceived },
        { from: 'peer', to: mode === 'device' ? 'primary' : `channel:${channel}`, message: peerMessage, packet_id: peerPacket, received: primaryReceived },
      ],
      receivedMessages: [
        ...primary.received.map((item) => ({ target: 'primary', text: item.text, channel: item.channel, from: item.from, to: item.to, id: item.id })),
        ...peer.received.map((item) => ({ target: 'peer', text: item.text, channel: item.channel, from: item.from, to: item.to, id: item.id })),
      ],
    };
    renderProgress({ done: 1, total: 1, percent: 100, current: { event: 'web_ble_end', status: pass ? 'PASS' : 'FAIL' }, events: [] });
    return finishWebBleResult(syntheticWebBleResult(pass ? 'PASS' : 'FAIL', evidence), pass ? 'Web BLE 通信通过' : 'Web BLE 通信失败', runPayload('communicationExperiment'));
  } catch (error) {
    const duration = Math.round((performance.now() - started) / 10) / 100;
    renderProgress({ done: 1, total: 1, percent: 100, current: { event: 'web_ble_error', status: 'FAIL' }, events: [] });
    return finishWebBleResult(syntheticWebBleResult('FAIL', {
      reason: 'web_ble_error',
      stdout: '',
      stderr: `${error.name || 'Error'}: ${error.message}`,
      duration,
      sentMessages: [],
      receivedMessages: [],
    }), 'Web BLE 通信失败', runPayload('communicationExperiment'));
  }
}

function runWebBleCommunicationNeedsPeer() {
  return finishWebBleResult(syntheticWebBleResult('SKIPPED', {
    reason: 'web_ble_need_two_devices',
    stdout: [
      'Web Bluetooth communication skipped.',
      `connectedRoles=${[...browserBleTransports.keys()].join(',') || '-'}`,
      '双向通信需要测试设备1和测试设备2都完成浏览器 GATT 连接；只连接一台时不会执行设备2相关步骤。',
    ].join('\n') + '\n',
    duration: 0,
    sentMessages: [],
    receivedMessages: [],
  }), 'Web BLE 通信跳过', runPayload('communicationExperiment'));
}

function runWebBleConfigUnsupported(targetType = 'communicationExperiment') {
  const caseId = targetType === 'customConfig' ? 'MT-CUSTOM-CONFIG' : 'MT-COMM-EXPERIMENT';
  const moduleName = targetType === 'customConfig' ? '配置写入' : '通信验证';
  const objective = targetType === 'customConfig'
    ? '浏览器 Web Bluetooth 当前只实现身份读取和文本发送，尚未实现配置 Admin protobuf 写入与读回。'
    : '浏览器 Web Bluetooth 当前只实现身份读取和文本发送，通信配置仍需串口后端写入。';
  return finishWebBleResult(syntheticWebBleResult('SKIPPED', {
    caseId,
    module: moduleName,
    objective,
    stepName: targetType === 'customConfig' ? 'Web BLE 配置写入未实现' : 'Web BLE 通信配置下发未实现',
    reason: 'web_ble_config_not_implemented',
    stdout: '当前浏览器 BLE 路径只覆盖身份读取和文本通信；Region/Modem/Frequency 配置写入仍需串口后端路径。\n',
    duration: 0,
    sentMessages: [],
    receivedMessages: [],
  }), 'Web BLE 配置跳过', { ...runPayload(targetType), targetType });
}

async function runCommunication() {
  recoverStaleClientRun('已清理上一次未结束的 BLE 前端任务状态，请重新运行通信。');
  if (state.running) {
    showBleActionFeedback('当前已有任务在运行，请先点“停止运行”或等待任务结束。', 'err');
    return;
  }
  if (!validateBeforeRun('communicationExperiment')) {
    showBleActionFeedback($('commandBox')?.textContent || '当前条件不足，未开始通信。', 'err');
    return;
  }
  if (state.systemMode === 'meshtastic' && $('connectionType')?.value === 'ble') {
    const payload = runPayload('communicationExperiment');
    try {
      if (!hasBrowserBleTransport()) {
        await finishWebBleResult(syntheticWebBleResult('FAIL', {
          caseId: 'MT-COMM-EXPERIMENT',
          module: '通信验证',
          objective: '使用浏览器 Web Bluetooth 数据通道发送 Meshtastic 文本消息。',
          stepName: '检查 BLE 连接',
          reason: 'web_ble_no_connected_device',
          stdout: '请先连接 BLE 测试设备。\n',
          duration: 0,
          sentMessages: [],
          receivedMessages: [],
        }), 'Web BLE 通信失败', payload);
        return;
      }
      if (hasSelectedCommunicationConfig()) {
        const configOk = await applyBleCommunicationConfigIfNeeded();
        if (!configOk) {
          const failData = syntheticWebBleResult('FAIL', {
            caseId: 'MT-COMM-CONFIG',
            module: '通信配置',
            objective: '发送消息前通过 Web Bluetooth 下发所选通信配置。',
            stepName: 'BLE 通信配置下发',
            reason: 'web_ble_communication_config_failed',
            stdout: '所选通信配置未成功下发，未开始发送消息。\n',
            duration: 0,
            sentMessages: [],
            receivedMessages: [],
          });
          await finishWebBleResult(failData, 'Web BLE 通信配置失败', payload);
          return;
        }
      }
      await runWebBleCommunication();
      return;
    } catch (error) {
      await finishWebBleResult(syntheticWebBleResult('FAIL', {
        caseId: 'MT-COMM-EXPERIMENT',
        module: '通信验证',
        objective: '使用浏览器 Web Bluetooth 数据通道发送 Meshtastic 文本消息。',
        stepName: 'Web BLE 通信执行',
        reason: 'web_ble_error',
        stdout: '',
        stderr: `${error.name || 'Error'}: ${error.message}`,
        duration: 0,
        sentMessages: [],
        receivedMessages: [],
      }), 'Web BLE 通信失败', payload);
      return;
    }
  }
  if (hasSelectedCommunicationConfig()) {
    if (!selectedCommunicationConfigAlreadyApplied()) {
      if (!validateBeforeRun('communicationConfig')) return;
      const configResult = await runTarget('communicationConfig', undefined, false);
      if (!runSucceeded(configResult || {})) {
        if (configResult) finishRun(configResult, '\u901a\u4fe1\u914d\u7f6e\u5931\u8d25', configResult._payload);
        return;
      }
    }
  } else if (!cachedCommunicationConfigConsistent()) {
    const checkResult = await runTarget('communicationCheck', undefined, false);
    if (!runSucceeded(checkResult || {})) {
      if (checkResult) finishRun(checkResult, '\u6d4b\u8bd5\u524d\u68c0\u67e5\u5931\u8d25', checkResult._payload);
      return;
    }
  }
  if (state.systemMode === 'meshtastic' && canRunWebBleCommunication()) {
    await runWebBleCommunication();
    return;
  }
  await runTarget('communicationExperiment');
}


function renderModules() {
  const grid = $('moduleGrid');
  grid.innerHTML = '';
  if (!Object.keys(state.modules || {}).length) {
    const empty = document.createElement('div');
    empty.className = 'module-row';
    empty.textContent = state.caseCatalogNotice || '当前未加载测试项。可使用配置写入、通信验证和联系人互识功能，或配置团队本地用例库。';
    grid.appendChild(empty);
    return;
  }
  for (const [moduleName, cases] of Object.entries(state.modules)) {
    if (moduleName === 'Precheck' || moduleName === '\u6d4b\u8bd5\u524d\u68c0\u67e5') continue;
    if (moduleName === '\u53ef\u9009\u53d6\u8bc1' || moduleName === 'Optional reads') continue;
    // BLE 专用用例（connection=ble）不放进串口测试项，改由 BLE 区块的测试项卡片承载。
    const visibleCases = cases.filter((caseItem) => (caseItem.connection || 'serial') !== 'ble');
    if (!visibleCases.length) continue;
    const item = document.createElement('article');
    item.className = 'module-row';
    const checked = 'checked';
    const note = '';
    const caseList = visibleCases.map((caseItem) => {
      // 子项只显示「角色标识 + 核心释义」，用例 ID 与来源放进 hover 提示，避免每行都是重复前缀。
      const label = caseItem.display_name || caseItem.source_case || caseItem.id;
      const tip = buildCaseTip(caseItem);
      return `<div class="case-row" title="${escapeHtml(tip)}"><span>${escapeHtml(label)}</span><button class="case-icon-run" data-case="${escapeHtml(caseItem.id)}" title="\u8fd0\u884c\u5355\u6761" aria-label="\u8fd0\u884c\u5355\u6761"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button></div>`;
    }).join('');
    item.innerHTML = `
      <div class="module-head">
        <label class="module-check">
          <input type="checkbox" data-module-check value="${escapeHtml(moduleName)}" ${checked}>
          <span><strong>${escapeHtml(displayModuleName(moduleName))}</strong><em>${visibleCases.length} \u6761</em></span>
        </label>
        <button class="module-run" data-module="${escapeHtml(moduleName)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>\u8fd0\u884c</button>
      </div>
      ${note}
      <div class="case-list">${caseList}</div>
    `;
    grid.appendChild(item);
  }
  if (!grid.children.length) {
    grid.classList.add('empty');
    grid.textContent = '\u6682\u65e0\u72ec\u7acb\u6d4b\u8bd5\u9879';
  } else {
    grid.classList.remove('empty');
  }
  grid.querySelectorAll('[data-module]').forEach((button) => button.addEventListener('click', () => runTarget('module', button.dataset.module)));
  grid.querySelectorAll('[data-case]').forEach((button) => button.addEventListener('click', () => runTarget('case', button.dataset.case)));
  grid.querySelectorAll('[data-module-check]').forEach((check) => check.addEventListener('change', syncToggleAllState));
  ensureSingleBleLayout();
  syncToggleAllState();
}

function setAllModules(checked) {
  document.querySelectorAll('[data-module-check]').forEach((item) => { item.checked = checked; });
  syncToggleAllState();
}

function syncToggleAllState() {
  const checks = [...document.querySelectorAll('[data-module-check]')];
  const checked = checks.filter((item) => item.checked).length;
  $('toggleAllModules').checked = checks.length > 0 && checked === checks.length;
  $('toggleAllModules').indeterminate = checked > 0 && checked < checks.length;
}

function showConnectionFields() {
  const connectionSelect = $('connectionType');
  if (connectionSelect && !['port', 'ble'].includes(connectionSelect.value)) connectionSelect.value = 'port';
  const type = connectionSelect?.value || 'port';
  $('serialFields').classList.toggle('hidden', type !== 'port');
  $('hostFields').classList.toggle('hidden', type !== 'host');
  $('bleFields').classList.toggle('hidden', type !== 'ble');
  document.querySelectorAll('.serial-only').forEach((item) => item.classList.toggle('hidden', type !== 'port'));
  $('portList')?.classList.toggle('hidden', type !== 'port');
  $('connectionGrid')?.classList.toggle('ble-mode', type === 'ble');
  $('connectionGrid')?.classList.toggle('host-mode', type === 'host');
  ensureSingleBleLayout();
  restoreModuleGridAfterBleMode();
  applyBleSingleDeviceMode(type === 'ble');
  updateTargetOptionLabels();
  initConfigControls();
  updateMessageModeControls();
  renderBleContinuous();
  renderLogDeviceSummary();
  refreshCustomSelects();
  syncCustomSelect(connectionSelect);
}

function applyBleSingleDeviceMode(isBleMode = false) {
  if (!WEB_BLE_SINGLE_DEVICE_ONLY) return;
  const peerCard = document.querySelector('[data-ble-role="peer"]');
  const disablePeer = Boolean(isBleMode);
  if (peerCard) {
    peerCard.hidden = disablePeer;
    peerCard.classList.remove('disabled-card');
  }
  ['peerBleValue', 'scanBlePeer', 'connectBlePeer', 'disconnectBlePeer'].forEach((id) => {
    const element = $(id);
    if (element) element.disabled = disablePeer;
  });
  if (disablePeer) {
    if (browserBleTransports.has('peer') || state.connectedBleDeviceIds.peer || state.selectedBleDeviceIds.peer) {
      disconnectBle('peer');
    }
    setBleRoleStatus('peer', '当前 BLE 先只支持单设备；请使用测试设备 1 BLE。', 'warn');
    const list = $('bleListPeer');
    if (list) {
      list.classList.add('empty');
      list.textContent = 'BLE 单设备模式下不连接测试设备 2。';
    }
  }
}

async function scanLogPorts() {
  const logBox = $('serialLogTail');
  if (logBox) logBox.textContent = '\u626b\u63cf\u4e32\u53e3\u4e2d...';
  try {
    const data = await api('/api/ports');
    state.ports = data.ports || [];
    renderPorts();
    fillLogPortSelect();
    refreshCustomSelects();
    const count = state.ports.length;
    if (logBox) {
      logBox.textContent = count
        ? `\u5df2\u626b\u63cf\u5230 ${count} \u4e2a\u4e32\u53e3\uff0c\u8bf7\u9009\u62e9\u65e5\u5fd7\u4e32\u53e3\u540e\u5f00\u59cb\u76d1\u542c\u3002`
        : '\u672a\u626b\u63cf\u5230\u4e32\u53e3\u3002';
    }
  } catch (error) {
    if (logBox) logBox.textContent = error.message;
  }
}

function initConfigControls() {
  const definitions = activeConfigDefinitions();
  const select = $('configKind');
  if (!select) return;
  const previous = select.value;
  fillSelectOptions(select, definitions.map((item) => ({ value: item.kind, label: item.label })), previous);
  select.value = definitions.some((item) => item.kind === previous) ? previous : (definitions[0]?.kind || '');
  if (!select.value && select.options.length) select.selectedIndex = 0;
  enhanceSelect(select);
  syncCustomSelect(select);
  renderConfigDynamicFields();
}


function renderConfigDynamicFields() {
  const definition = currentConfigDefinition();
  const wrap = $('configDynamicFields');
  if (definition.type === 'user_name') {
    wrap.innerHTML = `
      <label class="field"><span>长名称（Long Name）</span><input id="ownerLongName" maxlength="40" placeholder="\u8bbe\u5907\u957f\u540d"></label>
      <label class="field"><span>短名称（Short Name）</span><input id="ownerShortName" maxlength="4" placeholder="4 \u4e2a\u5b57\u7b26\u4ee5\u5185"></label>
    `;
  } else if (definition.type === 'channel') {
    wrap.innerHTML = `
      <label class="field compact"><span>频道索引</span><input id="configChannelIndex" type="number" min="0" max="7" value="0" placeholder="0-7"></label>
      <label class="field"><span>频道名称</span><input id="configChannelName" placeholder="例如 LongFast"></label>
      <label class="field compact"><span>密钥长度</span><select id="configChannelPskMode">
        <option value="keep">不改动（保持当前密钥）</option>
        <option value="none">空（不加密）</option>
        <option value="default">默认（AQ==）</option>
        <option value="1b">1 byte</option>
        <option value="16b">128 bit</option>
        <option value="32b">256 bit</option>
      </select></label>
      <label class="field"><span>密钥内容（base64，可手动修改）</span><div class="secret-input"><input id="configChannelPsk" placeholder="选择长度后自动生成，也可粘贴 base64 / 0x 密钥"><button id="randomChannelPsk" class="psk-random" type="button" aria-label="随机生成密钥" title="随机生成该长度的密钥"></button></div></label>
      <p id="configChannelPskError" class="field-error wide hidden"></p>
    `;
  } else if (definition.type === 'wifi') {
    wrap.innerHTML = `
      <label class="field"><span>WiFi 开关</span><select id="wifiEnabled"><option value="">\u4e0d\u4fee\u6539\u5f00\u5173</option>${optionHtml(boolOptions)}</select></label>
      <label class="field"><span>WiFi 名称（SSID）</span><input id="wifiSsid" placeholder="WiFi \u540d\u79f0"></label>
      <label class="field wide"><span>WiFi 密码</span><div class="secret-input"><input id="wifiKey" type="password" placeholder="WiFi \u5bc6\u7801"><button id="toggleWifiKey" class="secret-toggle" type="button" aria-label="\u663e\u793a WiFi \u5bc6\u7801" title="\u663e\u793a/\u9690\u85cf WiFi \u5bc6\u7801"></button></div></label>
    `;
  } else if (definition.type === 'region') {
    const target = defaultConfigTargetForForm();
    const currentRegion = cachedConfigValue(target, 'lora.region', regions[0]);
    const currentOverride = cachedConfigValue(target, 'lora.override_frequency', '0') || '0';
    wrap.innerHTML = `
      <label class="field"><span>区域（Region）</span><select id="regionValue">${optionHtml(regions)}</select></label>
      <label class="field"><span>频率覆盖（MHz）</span><input id="regionOverrideFrequency" inputmode="decimal" placeholder="0 \u8868\u793a\u4e0d\u8986\u76d6" value="${escapeHtml(currentOverride)}"></label>
    `;
    const regionSelect = $('regionValue');
    if (regions.includes(currentRegion)) regionSelect.value = currentRegion;
  } else if (definition.type === 'field_select') {
    wrap.innerHTML = `<label class="field wide"><span>${escapeHtml(definition.label)}</span><select id="configValue">${optionHtml(definition.values)}</select></label>`;
  } else if (definition.type === 'field_bool') {
    wrap.innerHTML = `<label class="field wide"><span>${escapeHtml(definition.label)}</span><select id="configValue">${optionHtml(definition.values || boolOptions)}</select></label>`;
  } else if (definition.type === 'meshcore_radio_preset') {
    wrap.innerHTML = `<label class="field wide"><span>射频预设</span><select id="configValue">${optionHtml(['Long Fast', 'Long Slow', 'Medium Fast', 'Medium Slow', 'Short Fast', 'Short Slow', 'Custom'])}</select></label>`;
  } else if (definition.type === 'meshcore_frequency') {
    wrap.innerHTML = `<label class="field wide"><span>自定义频率（MHz）</span><input id="configValue" inputmode="decimal" placeholder="例如 868.125"></label>`;
  } else if (definition.type === 'tz_select') {
    wrap.innerHTML = `
      <label class="field wide"><span>时区</span><select id="configValue">${tzZoneOptionHtml()}</select></label>
      <label class="field wide hidden" id="configTzCustomField"><span>自定义 POSIX TZ</span><input id="configTzCustom" placeholder="例如中国 CST-8；美国东部 EST5EDT,M3.2.0,M11.1.0"></label>
      <p id="configTzError" class="field-error wide hidden"></p>
    `;
  } else if (definition.type === 'unsupported') {
    wrap.innerHTML = `<p class="form-note wide">\u5f53\u524d CLI \u672a\u66b4\u9732 Language \u914d\u7f6e\u5199\u5165\uff0c\u8be5\u9879\u6682\u4f5c\u4eba\u5de5\u9a8c\u8bc1\u3002</p>`;
  } else {
    wrap.innerHTML = `<label class="field wide"><span>${escapeHtml(definition.label)}</span><input id="configValue" placeholder="${escapeHtml(definition.placeholder || '\u8f93\u5165\u914d\u7f6e\u503c')}"></label>`;
  }
  refreshCustomSelects(wrap);
  const tzSelect = $('configValue');
  if (definition.type === 'tz_select' && tzSelect) {
    tzSelect.addEventListener('change', () => {
      syncTzCustomField();
      $('configTzCustomField')?.classList.toggle('hidden', tzSelect.value !== TZ_CUSTOM_VALUE);
      validateTzField();
    });
    $('configTzCustom')?.addEventListener('input', validateTzField);
    syncTzCustomField();
    applyKnownTimezoneToField($('configTarget')?.value || 'primary');
    $('configTzCustomField')?.classList.toggle('hidden', tzSelect.value !== TZ_CUSTOM_VALUE);
    validateTzField();
  }
  const pskModeSelect = $('configChannelPskMode');
  if (pskModeSelect) {
    const pskInput = $('configChannelPsk');
    pskModeSelect.addEventListener('change', syncChannelPskForm);
    pskInput?.addEventListener('input', validateChannelPskForm);
    pskInput?.addEventListener('change', () => {
      normalizeChannelPskField();
      validateChannelPskForm();
    });
    $('randomChannelPsk')?.addEventListener('click', () => {
      const definition = CHANNEL_PSK_MODES[pskModeSelect.value];
      if (!definition?.editable || !pskInput) return;
      pskInput.value = randomChannelPskBase64(definition.bytes);
      pskInput.dataset.pskMode = pskModeSelect.value;
      validateChannelPskForm();
    });
    syncChannelPskForm();
  }
  const keyToggle = $('toggleWifiKey');
  const keyInput = $('wifiKey');
  if (keyToggle && keyInput) {
    keyToggle.addEventListener('click', () => {
      const visible = keyInput.type === 'text';
      keyInput.type = visible ? 'password' : 'text';
      keyToggle.setAttribute('aria-label', visible ? '\u663e\u793a WiFi \u5bc6\u7801' : '\u9690\u85cf WiFi \u5bc6\u7801');
      keyToggle.classList.toggle('active', !visible);
    });
  }
}

function updateCommConfigControls() {
  fillSelectOptions($('experimentRegion'), regions, $('experimentRegion')?.value || regions[0]);
  fillSelectOptions($('experimentModem'), modemPresets, $('experimentModem')?.value || modemPresets[0]);
  const regionEnabled = $('useExperimentRegion').checked;
  const modemEnabled = $('useExperimentModem').checked;
  const frequencyEnabled = $('useOverrideFrequency').checked;
  $('experimentRegion').disabled = !regionEnabled;
  $('experimentModem').disabled = !modemEnabled;
  $('overrideFrequency').disabled = !frequencyEnabled;
  $('experimentRegion').closest('.field')?.classList.toggle('muted-field', !regionEnabled);
  $('experimentModem').closest('.field')?.classList.toggle('muted-field', !modemEnabled);
  $('overrideFrequency').closest('.field')?.classList.toggle('muted-field', !frequencyEnabled);
  syncCustomSelect($('experimentRegion'));
  syncCustomSelect($('experimentModem'));
}

function resetDeviceIdentity(role = '') {
  if (role === 'primary' || role === 'peer') {
    state.deviceLabels[role] = fallbackTargetLabels[role];
    state.deviceNodeIds[role] = '';
    state.deviceConfigs[role] = {};
    state.deviceSnapshots[role] = null;
  } else {
    state.deviceLabels = { ...fallbackTargetLabels };
    state.deviceNodeIds = { primary: '', peer: '' };
    state.deviceConfigs = { primary: {}, peer: {} };
    state.deviceSnapshots = { primary: null, peer: null };
    state.channels = { 0: '\u4e3b\u9891\u9053', 1: '\u9891\u9053 1' };
    state.channelSources = { 0: 'default', 1: 'default' };
  }
  updateTargetOptionLabels();
  renderDeviceSnapshots();
  updateChannelOptions();
  fillLogPortSelect();
  renderLogDeviceSummary();
}

function updateMessageModeControls() {
  const isChannel = $('messageMode').value === 'channel';
  const isBle = $('connectionType')?.value === 'ble';
  const isDevice = $('messageMode').value === 'device';
  $('messageChannel').disabled = !isChannel;
  $('messageChannelField').classList.toggle('muted-field', !isChannel);
  $('messageNodeField')?.classList.toggle('hidden', !(isBle && isDevice));
  updateBleNodeOptions();
  syncCustomSelect($('messageChannel'));
  syncCustomSelect($('messageNode'));
}

async function init() {
  try {
    initNavState();
    initConfigControls();
    const health = await api('/api/health');
    $('healthDot').className = 'dot ok';
    $('healthText').textContent = health.ok ? '\u670d\u52a1\u6b63\u5e38' : '\u670d\u52a1\u5f02\u5e38';
    if ($('navCliStatus')) $('navCliStatus').textContent = health.meshtasticCli ? '\u5df2\u5c31\u7eea' : '\u9700\u68c0\u67e5';
    const cases = await api('/api/cases');
    state.modules = cases.modules;
    state.cases = cases.cases;
    state.caseCatalogNotice = cases.notice || '';
    if ($('caseCount')) $('caseCount').textContent = `${state.cases.length} 条用例`;
    renderModules();
    const reports = await api('/api/reports');
    renderReports(reports.reports);
    showConnectionFields();
    syncPortSelectors();
    updateTargetOptionLabels();
    renderDeviceSnapshots();
    updateChannelOptions();
    updateCommConfigControls();
    updateMessageModeControls();
    renderBleContinuous();
    refreshCustomSelects();
  } catch (error) {
    $('healthDot').className = 'dot fail';
    $('healthText').textContent = '\u670d\u52a1\u5f02\u5e38';
    if ($('navCliStatus')) $('navCliStatus').textContent = '\u5f02\u5e38';
    $('commandBox').textContent = error.message;
  }
}

function bind(id, event, handler) {
  const element = $(id);
  if (element) element.addEventListener(event, handler);
}

document.querySelectorAll('[data-page-link]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    activatePage(link.dataset.pageLink);
  });
});
document.addEventListener('click', () => closeCustomSelects());

bind('modeMeshtastic', 'click', () => setSystemMode('meshtastic'));
bind('modeMeshCore', 'click', () => setSystemMode('meshcore'));
bind('runSuite', 'click', () => runTarget('module', '\u6d4b\u8bd5\u524d\u68c0\u67e5'));
bind('runSelected', 'click', () => runTarget('modules'));
  bind('runSelectedBle', 'click', () => runTarget('cases', selectedBleCaseIds()));
  bind('toggleAllBleCases', 'change', (event) => {
    document.querySelectorAll('[data-ble-case-check]').forEach((item) => { item.checked = event.target.checked; });
    syncBleSelectAll();
  });
bind('runConfigWrite', 'click', () => runTarget('customConfig'));
bind('runContactExchange', 'click', () => runTarget('contactExchange'));
bind('runExperiment', 'click', runCommunication);
bind('startBleReceive', 'click', () => startBleContinuous('receive'));
bind('startBleSend', 'click', () => startBleContinuous('send'));
bind('runBleStability', 'click', runBleLongConnectionStability);
bind('stopBleContinuous', 'click', stopBleContinuous);
bind('clearBleContinuousLog', 'click', clearBleContinuousLog);
bind('stopRun', 'click', cancelRun);
bind('execute', 'change', () => {
  if (!$('execute').checked) $('allowMutating').checked = false;
});
bind('allowMutating', 'change', () => {
  if ($('allowMutating').checked) $('execute').checked = true;
});
bind('toggleAllModules', 'change', (event) => setAllModules(event.target.checked));
bind('configKind', 'change', renderConfigDynamicFields);
bind('configTarget', 'change', () => {
  updateTargetOptionLabels();
  renderConfigDynamicFields();
});
bind('useExperimentRegion', 'change', updateCommConfigControls);
bind('useExperimentModem', 'change', updateCommConfigControls);
bind('useOverrideFrequency', 'change', updateCommConfigControls);
bind('messageMode', 'change', updateMessageModeControls);
bind('bleContinuousChannel', 'change', () => updateBleContinuousRoute());
bind('bleContinuousNode', 'change', () => updateBleContinuousRoute());
document.querySelectorAll('[data-message-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = $('messageText');
    if (!input) return;
    input.value = button.dataset.messagePreset || '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
});
document.querySelectorAll('[data-result-filter]').forEach((item) => {
  item.addEventListener('click', () => {
    state.resultFilter = state.resultFilter === item.dataset.resultFilter ? '' : item.dataset.resultFilter;
    renderResults();
  });
  item.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    item.click();
  });
});
bind('clearResults', 'click', () => {
  state.runs = [];
  state.resultFilter = '';
  summarize();
  renderResults();
  renderProgress({ done: 0, total: 0, percent: 0, events: [] });
  $('runState').textContent = '\u5f85\u8fd0\u884c';
  $('runState').className = 'badge idle';
});
bind('scanPorts', 'click', scanPorts);
bind('scanBlePrimary', 'click', () => scanBleDevices('primary'));
bind('scanBlePeer', 'click', () => scanBleDevices('peer'));
bind('connectBlePrimary', 'click', () => connectBleInBrowser('primary'));
bind('connectBlePeer', 'click', () => connectBleInBrowser('peer'));
bind('disconnectSerial', 'click', disconnectSerial);
bind('refreshBlePrimary', 'click', () => refreshBleDeviceInfo('primary'));
bind('disconnectBlePrimary', 'click', () => disconnectBle('primary'));
bind('disconnectBlePeer', 'click', () => disconnectBle('peer'));
bind('closeBlePairDialog', 'click', () => showBlePairDialog(false));
bind('refreshReports', 'click', refreshReportList);
bind('connectionType', 'change', () => {
  // 换连接方式 = 换了一台（或另一种通道上的）设备：快照必须清掉，不能继续显示上一台设备的配置。
  const type = $('connectionType')?.value || 'port';
  resetDeviceReadouts(type === 'ble'
    ? '已切换到蓝牙连接：连上 BLE 设备后运行前置检查，读取这台设备的配置。'
    : '已切换到串口连接：选好串口后运行前置检查，读取这台设备的配置。');
  showConnectionFields();
});
bind('primaryPort', 'change', () => { syncPortSelectors(); resetDeviceIdentity(); });
bind('peerPort', 'change', () => { syncPortSelectors(); resetDeviceIdentity(); });
  bind('observerPort', 'change', () => { syncPortSelectors(); resetDeviceIdentity(); });
  bind('toggleObserver', 'click', (event) => {
    event.preventDefault();
    setObserverExpanded(!observerExpanded());
  });
bind('hostValue', 'change', resetDeviceIdentity);
bind('peerHostValue', 'change', resetDeviceIdentity);
bind('bleValue', 'change', resetDeviceIdentity);
bind('peerBleValue', 'change', resetDeviceIdentity);
bind('startSerialLog', 'click', startSerialLog);
bind('stopSerialLog', 'click', stopSerialLog);
bind('scanLogPorts', 'click', scanLogPorts);

// 折叠 / 展开：串口「测试项」卡片保持常展开（用例列表就是这块的主体内容，折叠它没有收益）；
// 折叠箭头放在「BLE 测试项」卡片上（BLE 模式下这块经常空着/占位，折叠后页面更短）。
// 选择记在 localStorage 里，刷新页面后保持上次状态。
const BLE_CASES_COLLAPSED_KEY = 'dsh.bleCasesCollapsed';

function setBleCasesCollapsed(collapsed, persist = true) {
  const card = $('bleTestCard');
  const button = $('toggleBleCasesCollapse');
  if (!card) return;
  card.classList.toggle('collapsed', !!collapsed);
  if (button) {
    button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    button.setAttribute('aria-label', collapsed ? '\u5c55\u5f00 BLE \u6d4b\u8bd5\u9879\u5217\u8868' : '\u6298\u53e0 BLE \u6d4b\u8bd5\u9879\u5217\u8868');
  }
  if (persist) {
    try {
      window.localStorage.setItem(BLE_CASES_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch (error) {
      /* 隐私模式下 localStorage 不可用：忽略，只影响记忆状态。 */
    }
  }
}

function initBleCasesCollapse() {
  let stored = '';
  try {
    stored = window.localStorage.getItem(BLE_CASES_COLLAPSED_KEY) || '';
  } catch (error) {
    stored = '';
  }
  setBleCasesCollapsed(stored === '1', false);
  bind('toggleBleCasesCollapse', 'click', () => {
    setBleCasesCollapsed(!$('bleTestCard')?.classList.contains('collapsed'));
  });
}

initBleCasesCollapse();
refreshCustomSelects();
init();
