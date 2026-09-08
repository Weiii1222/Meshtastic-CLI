const state = {
  modules: {},
  cases: [],
  ports: [],
  runs: [],
  running: false,
  pollTimer: null,
  currentJobId: '',
  activeTargetType: '',
  deviceLabels: { primary: '\u6d4b\u8bd5\u8bbe\u59071', peer: '\u6d4b\u8bd5\u8bbe\u59072', both: '\u4e24\u53f0\u8bbe\u5907' },
  deviceNodeIds: { primary: '', peer: '' },
  deviceConfigs: { primary: {}, peer: {} },
  deviceSnapshots: { primary: null, peer: null },
  channels: { 0: '\u4e3b\u9891\u9053', 1: '\u9891\u9053 1' },
  channelSources: { 0: 'default', 1: 'default' },
  pendingConfigPlan: null,
  resultFilter: '',
  serialLogId: '',
  serialLogTimer: null,
};

const regions = ['US', 'EU_868', 'CN', 'JP', 'ANZ', 'KR', 'TW', 'RU', 'IN'];
const modemPresets = ['LONG_FAST', 'LONG_SLOW', 'LONG_MODERATE', 'MEDIUM_FAST', 'MEDIUM_SLOW', 'SHORT_FAST', 'SHORT_SLOW', 'SHORT_TURBO'];
const roles = ['CLIENT', 'CLIENT_MUTE', 'TRACKER', 'ROUTER', 'ROUTER_CLIENT', 'REPEATER', 'SENSOR'];
const boolOptions = [
  { label: 'ON', value: 'true' },
  { label: 'OFF', value: 'false' },
];
const inverseBoolOptions = [
  { label: 'ON', value: 'false' },
  { label: 'OFF', value: 'true' },
];

const configDefinitions = [
  { kind: 'user_name', label: 'User name', type: 'user_name' },
  { kind: 'region', label: 'Region', type: 'region', field: 'lora.region', values: regions },
  { kind: 'modem_preset', label: 'Modem Preset', type: 'field_select', field: 'lora.modem_preset', values: modemPresets },
  { kind: 'channel', label: 'Channel', type: 'channel' },
  { kind: 'device_role', label: 'Device Role', type: 'field_select', field: 'device.role', values: roles },
  { kind: 'wifi', label: 'WiFi', type: 'wifi' },
  { kind: 'gps', label: 'GPS', type: 'field_bool', field: 'position.gps_enabled' },
  { kind: 'mqtt', label: 'MQTT', type: 'field_bool', field: 'mqtt.enabled' },
  { kind: 'bluetooth', label: 'Bluetooth', type: 'field_bool', field: 'bluetooth.enabled' },
  { kind: 'language', label: 'Language', type: 'unsupported', field: 'device_ui.language', values: [
    { label: 'English', value: 'ENGLISH' },
    { label: '\u65e5\u672c\u8bed', value: 'JAPANESE' },
    { label: '\u7b80\u4f53\u4e2d\u6587', value: 'SIMPLIFIED_CHINESE' },
  ] },
];

const fieldLabels = {
  'lora.region': 'Region',
  'lora.modem_preset': 'Modem Preset',
  'lora.use_preset': 'Use Preset',
  'lora.override_frequency': 'Frequency Override',
  'device.role': 'Device Role',
};

const fallbackTargetLabels = { primary: '\u6d4b\u8bd5\u8bbe\u59071', peer: '\u6d4b\u8bd5\u8bbe\u59072', both: '\u4e24\u53f0\u8bbe\u5907' };
const terminalStatuses = new Set(['done', 'failed', 'timeout', 'error', 'canceled']);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const reasonLabels = {
  'target_unavailable:primary': '\u6d4b\u8bd5\u8bbe\u59071\u672c\u8f6e\u5df2\u8d85\u65f6\u6216\u4e32\u53e3\u4e0d\u53ef\u7528\uff0c\u5df2\u8df3\u8fc7\u540e\u7eed\u91cd\u590d\u5f00\u53e3\u6b65\u9aa4\u3002',
  'target_unavailable:peer': '\u6d4b\u8bd5\u8bbe\u59072\u672c\u8f6e\u5df2\u8d85\u65f6\u6216\u4e32\u53e3\u4e0d\u53ef\u7528\uff0c\u5df2\u8df3\u8fc7\u540e\u7eed\u91cd\u590d\u5f00\u53e3\u6b65\u9aa4\u3002',
  connection_unavailable: '\u5df2\u626b\u63cf\u5230 COM \u53e3\uff0c\u4f46 CLI \u6ca1\u6709\u5b8c\u6210 Meshtastic \u534f\u8bae\u63e1\u624b\u3002',
  missing_connection: '\u7f3a\u5c11\u8fde\u63a5\u53c2\u6570\u3002',
  missing_peer: '\u7f3a\u5c11\u6d4b\u8bd5\u8bbe\u59072\u8fde\u63a5\u3002',
  missing_dest: '\u7f3a\u5c11\u76ee\u6807\u8282\u70b9 ID\u3002',
  missing_config: '\u7f3a\u5c11\u914d\u7f6e\u5b57\u6bb5\u6216\u914d\u7f6e\u503c\u3002',
  missing_message: '\u7f3a\u5c11\u53d1\u9001\u6d88\u606f\u3002',
  mutating_guard: '\u5199\u5165/\u53d1\u9001\u4fdd\u62a4\u672a\u5f00\u542f\uff0c\u672a\u6267\u884c\u4f1a\u6539\u53d8\u8bbe\u5907\u72b6\u6001\u7684\u6b65\u9aa4\u3002',
  dependency_not_run: '\u524d\u7f6e\u6b65\u9aa4\u672a\u901a\u8fc7\uff0c\u5f53\u524d\u6b65\u9aa4\u5df2\u8df3\u8fc7\u3002',
  contact_url_not_found: 'CLI \u8f93\u51fa\u4e2d\u6ca1\u6709\u627e\u5230\u8054\u7cfb\u4eba URL\u3002',
  exit_code_nonzero: 'CLI \u8fd4\u56de\u5931\u8d25\uff0c\u8bf7\u67e5\u770b stdout/stderr \u8bc1\u636e\u3002',
  timeout: '\u547d\u4ee4\u8d85\u65f6\uff1a\u8bbe\u5907\u53ef\u80fd\u6b63\u5728\u91cd\u542f\u3001\u4e32\u53e3\u88ab\u5360\u7528\uff0c\u6216\u8d85\u65f6\u65f6\u95f4\u592a\u77ed\u3002',
  meshtastic_cli_not_found: '\u672a\u627e\u5230 meshtastic CLI \u53ef\u6267\u884c\u6587\u4ef6\u3002',
  wait_done: '\u7b49\u5f85\u5b8c\u6210\u3002',
  unchanged: '\u5f53\u524d\u503c\u5df2\u4e0e\u76ee\u6807\u4e00\u81f4\uff0c\u672a\u91cd\u65b0\u5199\u5165\u3002',
};

const statusLabels = {
  PASS: '\u901a\u8fc7',
  FAIL: '\u5931\u8d25',
  SKIPPED: '\u8df3\u8fc7',
  DRY_RUN: '\u9884\u6f14',
  RUNNING: '\u8fd0\u884c\u4e2d',
  done: '\u5b8c\u6210',
  failed: '\u5931\u8d25',
  timeout: '\u8d85\u65f6',
  error: '\u5f02\u5e38',
  canceled: '\u5df2\u505c\u6b62',
};

const moduleDisplayNames = {
  Precheck: '\u6d4b\u8bd5\u524d\u68c0\u67e5',
  'Optional reads': '\u53ef\u9009\u53d6\u8bc1',
};

const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
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

function shortNodeLabel(nodeId) {
  const clean = String(nodeId || '').replace(/^!/, '').trim();
  return clean.length >= 4 ? clean.slice(-4).toLowerCase() : '';
}

function targetPort(target) {
  if (target === 'primary') return $('primaryPort')?.value || '';
  if (target === 'peer') return $('peerPort')?.value || '';
  return '';
}

function targetConnectionValue(target) {
  const type = $('connectionType')?.value || 'none';
  if (type === 'port') return targetPort(target);
  if (type === 'host') return target === 'primary' ? $('hostValue')?.value.trim() || '' : $('peerHostValue')?.value.trim() || '';
  if (type === 'ble') return target === 'primary' ? $('bleValue')?.value.trim() || '' : $('peerBleValue')?.value.trim() || '';
  return '';
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
      state.deviceConfigs[target]['lora.region'] = configValue(preferences, 'lora.region');
      state.deviceConfigs[target]['lora.modem_preset'] = configValue(preferences, 'lora.modemPreset');
      state.deviceConfigs[target]['lora.use_preset'] = configValue(preferences, 'lora.usePreset');
      state.deviceConfigs[target]['lora.override_frequency'] = configValue(preferences, 'lora.overrideFrequency');
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
  const modules = snapshot.module_preferences || {};
  const summary = snapshot.summary || {};
  const nodeKeyRows = nodePublicKeyLines(snapshot.node_public_keys);
  return [
    ['Short Name', summary.short_name],
    ['\u8282\u70b9 ID', summary.node_id],
    ['\u516c\u94a5', summary.public_key],
    ['\u56fa\u4ef6', summary.firmware],
    ['\u786c\u4ef6', summary.hardware],
    ['Device Role', configValue(preferences, 'device.role') || summary.role],
    ['Region', configValue(preferences, 'lora.region')],
    ['Modem Preset', configValue(preferences, 'lora.modemPreset')],
    ['Use Preset', configValue(preferences, 'lora.usePreset')],
    ['Frequency Override', configValue(preferences, 'lora.overrideFrequency')],
    ['Channel Num', configValue(preferences, 'lora.channelNum')],
    ['WiFi', configValue(preferences, 'network.wifiEnabled')],
    ['WiFi SSID', configValue(preferences, 'network.wifiSsid')],
    ['Bluetooth', configValue(preferences, 'bluetooth.enabled')],
    ['GPS', configValue(preferences, 'position.gpsEnabled')],
    ['MQTT', configValue(modules, 'mqtt.enabled')],
    ['NodeDB \u516c\u94a5', nodeKeyRows.join('\n')],
  ].filter(([, value]) => value !== '' && value !== undefined && value !== null);
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
    return;
  }
  list.classList.remove('empty');
  for (const [target, label] of entries) {
    const snapshot = state.deviceSnapshots[target];
    const cachedRows = Object.entries(state.deviceConfigs[target] || {}).map(([field, value]) => [fieldLabels[field] || field, value]);
    const rowMap = new Map([...snapshotRows(snapshot), ...cachedRows]);
    const rows = [...rowMap.entries()].map(([name, value]) => `<span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong>`).join('');
    const channels = (snapshot?.channels || []).map((channel) => `<li>\u9891\u9053 ${escapeHtml(channel.index)} \u00b7 ${escapeHtml(channel.name || '-')} \u00b7 ${escapeHtml(channel.role || '-')} \u00b7 PSK ${escapeHtml(channel.psk || '-')}</li>`).join('');
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
}

function updateTargetOptionLabels() {
  const select = $('configTarget');
  if (!select) return;
  for (const option of select.options) {
    option.textContent = displayTargetOption(option.value);
  }
}


function updateChannelOptions() {
  const select = $('messageChannel');
  if (!select) return;
  const selected = select.value || '0';
  select.innerHTML = '';
  for (let index = 0; index < 8; index += 1) {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = state.channels[index] ? `\u9891\u9053 ${index} \u00b7 ${state.channels[index]}` : `\u9891\u9053 ${index}`;
    select.appendChild(option);
  }
  select.value = selected;
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

function currentConfigDefinition() {
  return configDefinitions.find((item) => item.kind === $('configKind').value) || configDefinitions[0];
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
    base.payload = {
      index: Number($('configChannelIndex')?.value || 0),
      name: $('configChannelName')?.value.trim() || '',
      psk: $('configChannelPsk')?.value.trim() || '',
    };
    base.value = [base.payload.name && `Name=${base.payload.name}`, base.payload.psk && 'PSK=set'].filter(Boolean).join(', ');
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
  } else if (definition.type === 'region') {
    const region = $('regionValue')?.value || '';
    const overrideFrequency = $('regionOverrideFrequency')?.value.trim() || '0';
    base.field = 'lora.region';
    base.payload = { region, overrideFrequency };
    base.value = `Region=${region}锛汧requency Override=${overrideFrequency}`;
  } else {
    base.value = $('configValue')?.value.trim() || '';
  }
  return base;
}

function runPayload(targetType, value) {
  const connectionType = $('connectionType').value;
  const primaryPort = $('primaryPort').value.trim();
  const hostValue = $('hostValue').value.trim();
  const bleValue = $('bleValue').value.trim();
  const connectionValue = connectionType === 'port' ? primaryPort : connectionType === 'host' ? hostValue : connectionType === 'ble' ? bleValue : '';
  const configPlan = currentConfigPlan();
  const primaryNodeId = state.deviceNodeIds.primary || '';
  const peerNodeId = state.deviceNodeIds.peer || '';
  const hasDistinctNodeIds = primaryNodeId && peerNodeId && primaryNodeId !== peerNodeId;
  return {
    targetType,
    module: targetType === 'module' ? value : undefined,
    modules: targetType === 'modules' ? selectedModules() : undefined,
    caseId: targetType === 'case' ? value : undefined,
    connectionType,
    connectionValue,
    primaryPort,
    peerPort: $('peerPort').value.trim(),
    hostValue,
    bleValue,
    peerHostValue: $('peerHostValue').value.trim(),
    peerBleValue: $('peerBleValue').value.trim(),
    dest: $('dest').value.trim(),
    timeout: Number($('timeout').value || 60),
    stepGap: Number($('stepGap')?.value || 5),
    execute: $('execute').checked,
    allowMutating: $('allowMutating').checked,
    configTarget: configPlan.target,
    configKind: configPlan.kind,
    configJson: configPlan.payload,
    configField: configPlan.field,
    configValue: configPlan.value,
    configWait: Number($('configWait')?.value || 10),
    experimentRegion: $('useExperimentRegion').checked ? $('experimentRegion').value : '',
    experimentModem: $('useExperimentModem').checked ? $('experimentModem').value : '',
    overrideFrequency: $('useOverrideFrequency').checked ? $('overrideFrequency').value.trim() : '',
    messagePrimary: $('messageText').value.trim(),
    messagePeer: $('messageText').value.trim(),
    messageMode: $('messageMode').value,
    messageChannel: Number($('messageChannel').value || 0),
    receiveWait: Number($('receiveWait')?.value || 10),
    primaryNodeId: hasDistinctNodeIds ? primaryNodeId : '',
    peerNodeId: hasDistinctNodeIds ? peerNodeId : '',
    rebootWait: Number($('rebootWait').value || 10),
  };
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
  if (step.status === 'DRY_RUN') return '\u9884\u6f14\uff1a\u53ea\u751f\u6210\u547d\u4ee4\u8ba1\u5212\uff0c\u6ca1\u6709\u64cd\u4f5c\u8bbe\u5907\u3002';
  if (step.status === 'SKIPPED' && step.reason === 'dependency_not_run' && step.blocked_by) {
    return `\u524d\u7f6e\u6b65\u9aa4\u201c${displayText(step.blocked_by)}\u201d\u672a\u901a\u8fc7\uff0c\u5f53\u524d\u6b65\u9aa4\u5df2\u8df3\u8fc7\u3002`;
  }
  if (step.status === 'SKIPPED') return reasonLabels[step.reason] || step.reason || '\u6b65\u9aa4\u5df2\u8df3\u8fc7\u3002';
  if (step.status === 'PASS') {
    if (step.api_dual_send && step.sent_messages?.length) return '\u901a\u8fc7\uff1a\u4e24\u53f0\u8bbe\u5907\u90fd\u5df2\u53d1\u9001\u6d88\u606f\uff0c\u4e14\u53cc\u65b9\u76d1\u542c\u65e5\u5fd7\u90fd\u770b\u5230\u5bf9\u7aef\u6d88\u606f\u3002';
    if (step.node_public_keys?.length) return `\u901a\u8fc7\uff1a\u5df2\u8bfb\u53d6 ${step.node_public_keys.length} \u4e2a\u8282\u70b9\u516c\u94a5\u3002`;
    if (step.read_values?.length) return `\u901a\u8fc7\uff1a\u5df2\u8bfb\u53d6 ${step.read_values.map((item) => `${item.display_field || item.field} = ${item.display_value || item.value}`).join('\uff0c')}`;
    if (step.read_value) return `\u901a\u8fc7\uff1a\u5df2\u8bfb\u53d6 ${step.read_value.display_field || step.read_value.field} = ${step.read_value.display_value || step.read_value.value}`;
    if (step.direction && step.message && step.received_message) return `\u901a\u8fc7\uff1a${displayText(step.direction)} \u5df2\u53d1\u9001\u201c${step.message}\u201d\uff0c\u63a5\u6536\u7aef\u76d1\u542c\u5230\u8be5\u6d88\u606f\u3002`;
    if (step.direction && step.message) return `\u901a\u8fc7\uff1a${displayText(step.direction)} \u5df2\u53d1\u9001\u201c${step.message}\u201d\uff0c\u5e76\u6536\u5230 ACK\u3002`;
    return step.pass_criteria ? `\u901a\u8fc7\uff1a${displayText(step.pass_criteria)}` : '\u901a\u8fc7\uff1aCLI \u8fd4\u56de\u6210\u529f\u3002';
  }
  const combinedOutput = `${step.stdout || ''}\n${step.stderr || ''}`;
  if (/could not open port|serial device couldn't be opened|PermissionError|Cannot configure port|Connection timed out/i.test(combinedOutput)) {
    return '\u672a\u901a\u8fc7\uff1aCOM \u53e3\u5b58\u5728\uff0c\u4f46 CLI \u6ca1\u5b8c\u6210 Meshtastic \u534f\u8bae\u63e1\u624b\u3002\u8bf7\u7b49\u8bbe\u5907\u5b8c\u5168\u5f00\u673a\uff0c\u5173\u95ed\u5360\u7528\u4e32\u53e3\u7684\u5de5\u5177\uff0c\u91cd\u65b0\u626b\u63cf\u540e\u518d\u8bd5\u3002';
  }
  if (step.reason?.startsWith('node_not_found:')) return `\u672a\u901a\u8fc7\uff1aNodeDB \u4e2d\u6ca1\u6709\u770b\u5230\u5bf9\u7aef\u8282\u70b9 ${step.reason.replace('node_not_found:', '')}\u3002NodeDB \u53ef\u89c1\u6027\u4e0d\u7b49\u4e8e\u70b9\u5bf9\u70b9 ACK\u3002`;
  if (step.reason?.startsWith('missing_context:')) return `\u672a\u901a\u8fc7\uff1a\u7f3a\u5c11\u524d\u7f6e\u6570\u636e ${step.reason.replace('missing_context:', '')}\uff0c\u8bf7\u91cd\u65b0\u8fd0\u884c\u6d4b\u8bd5\u524d\u68c0\u67e5\u3002`;
  if (step.reason === 'unsupported_config_field') return '\u672a\u901a\u8fc7\uff1a\u5f53\u524d CLI/\u56fa\u4ef6\u6ca1\u6709\u66b4\u9732\u8fd9\u4e2a\u914d\u7f6e\u5b57\u6bb5\u3002';
  if (step.reason === 'config_mismatch') return `\u672a\u901a\u8fc7\uff1a\u901a\u4fe1\u5173\u952e\u914d\u7f6e\u4e0d\u4e00\u81f4\uff1a${(step.mismatch_summary || []).join('\uff0c')}`;
  if (step.reason === 'api_dual_missing_receive') return '\u672a\u901a\u8fc7\uff1a\u53cc\u5411\u53d1\u9001\u5df2\u6267\u884c\uff0c\u4f46\u81f3\u5c11\u4e00\u53f0\u8bbe\u5907\u76d1\u542c\u8f93\u51fa\u91cc\u6ca1\u6709\u770b\u5230\u5bf9\u7aef\u6d88\u606f\u3002';
  if (step.reason === 'persistent_api_error') return '\u672a\u901a\u8fc7\uff1aPython API \u6301\u7eed\u4e32\u53e3\u901a\u4fe1\u5931\u8d25\uff0c\u8bf7\u5c55\u5f00\u8be6\u7ec6\u8bc1\u636e\u3002';
  if (step.reason === 'persistent_api_serial_only') return '\u672a\u901a\u8fc7\uff1a\u6301\u7eed\u8fde\u63a5\u901a\u4fe1\u5f53\u524d\u53ea\u652f\u6301\u4e24\u53f0\u4e32\u53e3\u8bbe\u5907\u3002';
  if (step.reason === 'no_received_message') return '\u672a\u901a\u8fc7\uff1a\u53d1\u9001\u547d\u4ee4\u5df2\u6267\u884c\uff0c\u4f46\u63a5\u6536\u7aef\u76d1\u542c\u8f93\u51fa\u6ca1\u6709\u5305\u542b\u8be5\u6d88\u606f\u3002';
  if (step.reason?.startsWith('forbidden_output')) return '\u672a\u901a\u8fc7\uff1aCLI \u8fd4\u56de NAK / MAX_RETRANSMIT / error reason\uff0c\u8bf4\u660e\u6d88\u606f\u672a\u88ab\u5bf9\u7aef ACK\u3002';
  if (step.reason?.startsWith('regex_not_matched')) return '\u672a\u901a\u8fc7\uff1aCLI \u6709\u8f93\u51fa\uff0c\u4f46\u6ca1\u6709\u627e\u5230\u672c\u7528\u4f8b\u8981\u6c42\u7684\u8bc1\u636e\u3002';
  return reasonLabels[step.reason] || step.reason || '\u672a\u901a\u8fc7\uff1a\u8bf7\u5c55\u5f00\u547d\u4ee4\u8bc1\u636e\u3002';
}



function caseReason(item) {
  const status = caseStatus(item);
  if (status === 'PASS') return item.pass_meaning ? displayText(item.pass_meaning) : '\u901a\u8fc7\uff1a\u672c\u7528\u4f8b\u7684\u81ea\u52a8\u5316\u68c0\u67e5\u5168\u90e8\u901a\u8fc7\u3002';
  const issue = firstIssueStep(item);
  return issue ? friendlyReason(issue) : '\u672a\u901a\u8fc7\uff1arunner \u6ca1\u6709\u751f\u6210\u6709\u6548\u6b65\u9aa4\u7ed3\u679c\u3002';
}

function summaryLines(summary) {
  if (!summary || !Object.keys(summary).length) return [];
  const labels = {
    node_id: '\u8282\u70b9 ID', public_key: '\u516c\u94a5', long_name: 'Long Name', short_name: 'Short Name', firmware: '\u56fa\u4ef6', hardware: '\u786c\u4ef6',
    role: 'Device Role', pio_env: 'PIO \u73af\u5883', reboot_count: '\u91cd\u542f\u8ba1\u6570', nodedb_count: 'NodeDB \u6570\u91cf',
  };
  return Object.entries(summary).map(([key, value]) => `${labels[key] || key}: ${value}`);
}

function evidenceText(step, reportPath) {
  const chunks = [];
  if (step.command?.length) chunks.push(`\u547d\u4ee4\uff1a ${commandText(step.command)}`);
  if (step.listen_command?.length) chunks.push(`\u63a5\u6536\u7aef\u547d\u4ee4\uff1a ${commandText(step.listen_command)}`);
  if (step.api_transport) chunks.push(`\u901a\u4fe1\u6267\u884c\u5668\uff1a ${step.api_transport}`);
  chunks.push(`\u76ee\u6807\uff1a ${displayTarget(step.target)}`);
  if (step.listen_target) chunks.push(`\u63a5\u6536\u7aef\uff1a ${displayTarget(step.listen_target)}`);
  if (step.action_summary) chunks.push(`\u52a8\u4f5c\uff1a ${displayText(step.action_summary)}`);
  if (step.direction) chunks.push(`\u65b9\u5411\uff1a ${displayText(step.direction)}`);
  if (step.message) chunks.push(`\u6d88\u606f\uff1a ${step.message}`);
  if (step.sent_messages?.length) {
    chunks.push(`\u53cc\u5411\u53d1\u9001\uff1a\n${step.sent_messages.map((item) => `${endpointLabel(item.from)} -> ${endpointLabel(item.to)}: ${item.message}; \u63a5\u6536=${item.received ? '\u662f' : '\u5426'}`).join('\n')}`);
  }
  if (step.received_messages?.length) {
    chunks.push(`\u5df2\u76d1\u542c\u6d88\u606f\uff1a\n${step.received_messages.map((item) => `${endpointLabel(item.target)} \u6536\u5230\uff1a ${item.text}; \u9891\u9053=${item.channel}`).join('\n')}`);
  }
  if (step.receive_wait != null) chunks.push(`\u63a5\u6536\u7b49\u5f85\uff1a ${step.receive_wait}s`);
  if (step.captured_node_id) chunks.push(`\u8282\u70b9 ID\uff1a ${step.captured_node_id}`);
  if (step.node_public_keys?.length) chunks.push(`NodeDB \u516c\u94a5\uff1a\n${step.node_public_keys.map((item) => `${item.short_name || shortNodeLabel(item.node_id) || item.node_id}: ${item.public_key}`).join('\n')}`);
  if (step.contact_url) chunks.push(`\u8054\u7cfb\u4eba URL\uff1a ${step.contact_url}`);
  if (step.read_values?.length) chunks.push(`\u8bfb\u53d6\u503c\uff1a\n${step.read_values.map((item) => `${item.display_field || item.field} = ${item.display_value || item.value}`).join('\n')}`);
  if (!step.read_values?.length && step.read_value) chunks.push(`\u8bfb\u53d6\u503c\uff1a ${step.read_value.display_field || step.read_value.field} = ${step.read_value.display_value || step.read_value.value}`);
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
      source_l2_case: 'runner \u672a\u751f\u6210\u62a5\u544a',
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
    row.innerHTML = `
      <header>
        <div>
          <strong>${escapeHtml(item.id)} \u00b7 ${escapeHtml(displayText(item.source_l2_case || item.module || '\u672a\u547d\u540d\u7528\u4f8b'))}</strong>
          <span>${escapeHtml(displayModuleName(item.module))} \u00b7 ${escapeHtml(run.label)}</span>
        </div>
        <div class="result-status">
          <span class="status ${escapeHtml(status)}">${escapeHtml(displayStatus(status))}</span>
          ${retryButton}
        </div>
      </header>
      <p class="result-reason">${escapeHtml(caseReason(item))}</p>
      <details>
        <summary>\u8be6\u7ec6\u6b65\u9aa4\u8bc1\u636e</summary>
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
  } catch (error) {
    list.classList.add('empty');
    list.textContent = error.message;
  }
}

function fillSelect(select, placeholder, selectedValue, blockedValue) {
  select.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = placeholder;
  select.appendChild(empty);
  for (const port of state.ports) {
    const option = document.createElement('option');
    option.value = port.port;
    option.textContent = port.port;
    option.disabled = Boolean(blockedValue && port.port === blockedValue);
    select.appendChild(option);
  }
  if (selectedValue && selectedValue !== blockedValue && state.ports.some((port) => port.port === selectedValue)) select.value = selectedValue;
}

function fillLogPortSelect() {
  const select = $('logPort');
  if (!select) return;
  const selected = select.value;
  const blocked = new Set([$('primaryPort')?.value, $('peerPort')?.value].filter(Boolean));
  select.innerHTML = '<option value="">\u9009\u62e9\u65c1\u8def\u65e5\u5fd7\u4e32\u53e3</option>';
  for (const port of state.ports) {
    const option = document.createElement('option');
    option.value = port.port;
    option.textContent = port.port;
    option.disabled = blocked.has(port.port);
    select.appendChild(option);
  }
  if (selected && !blocked.has(selected) && state.ports.some((port) => port.port === selected)) select.value = selected;
}

function syncPortSelectors() {
  const primary = $('primaryPort').value;
  const peer = $('peerPort').value;
  fillSelect($('primaryPort'), '\u9009\u62e9\u6d4b\u8bd5\u8bbe\u59071', primary, peer);
  fillSelect($('peerPort'), '\u9009\u62e9\u6d4b\u8bd5\u8bbe\u59072', peer, primary);
  fillLogPortSelect();
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
    const deviceId = item.deviceId || item.usbSerial || '\u65e0 USB ID';
    button.innerHTML = `<strong>${escapeHtml(item.port)}</strong><span>${escapeHtml(deviceId)}</span><small>${escapeHtml(item.name || item.manufacturer || '\u4e32\u53e3\u8bbe\u5907')}</small>`;
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
    $('commandBox').textContent = JSON.stringify(data, null, 2);
    $('commandBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    $('commandBox').textContent = `\u62a5\u544a\u6253\u5f00\u5931\u8d25: ${error.message}`;
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
    $('commandBox').textContent = `\u62a5\u544a\u5df2\u4e0b\u8f7d: ${name}`;
  } catch (error) {
    $('commandBox').textContent = `\u62a5\u544a\u4e0b\u8f7d\u5931\u8d25: ${error.message}\n\u672c\u5730\u76ee\u5f55: E:\\Brower-Download\\seeed\\Project_01_WioTrackerL2\\logs`;
  }
}

function renderSerialLog(data) {
  if (!data) return;
  $('serialLogState').textContent = data.status === 'running' ? `\u76d1\u542c\u4e2d ${data.port}` : data.status || '\u672a\u542f\u52a8';
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
    $('serialLogTail').textContent = '\u5148\u9009\u62e9\u65c1\u8def\u65e5\u5fd7\u4e32\u53e3';
    return;
  }
  if ([targetPort('primary'), targetPort('peer')].includes(port)) {
    $('serialLogTail').textContent = '\u65c1\u8def\u65e5\u5fd7\u4e32\u53e3\u4e0d\u80fd\u548c\u6d4b\u8bd5\u8bbe\u5907\u4e32\u53e3\u76f8\u540c\uff0c\u5426\u5219\u4f1a\u5360\u7528\u8bbe\u5907';
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
  document.querySelectorAll('button').forEach((button) => {
    if (button.id === 'stopRun') button.disabled = !value;
    else if (button.id === 'stopSerialLog') button.disabled = !state.serialLogId;
    else if (button.id === 'startSerialLog') button.disabled = Boolean(state.serialLogId);
    else button.disabled = value;
  });
  if (value) {
    $('runState').textContent = '\u5df2\u505c\u6b62';
    $('runState').className = 'badge running';
  } else {
    state.currentJobId = '';
  }
}


function renderProgress(summary = {}) {
  const done = summary.done || 0;
  const total = summary.total || 0;
  $('progressNumber').textContent = `${done} / ${total}`;
  $('progressBar').style.width = `${summary.percent || 0}%`;
  const current = summary.current || {};
  $('progressTitle').textContent = current.step
    ? `\u5f53\u524d: ${displayText(current.step)}`
    : current.event === 'run_end'
      ? `\u4efb\u52a1\u7ed3\u675f: ${displayStatus(current.status)}`
      : state.running ? '\u4efb\u52a1\u5df2\u63d0\u4ea4\uff0c\u7b49\u5f85\u7b2c\u4e00\u6761\u8fdb\u5ea6' : '\u672a\u8fd0\u884c';
  const list = $('progressList');
  list.innerHTML = '';
  const rowsByIndex = new Map();
  for (const event of (summary.events || [])) {
    if (event.event === 'step_start') rowsByIndex.set(event.index, { ...event, status: 'RUNNING' });
    if (event.event === 'step_end') rowsByIndex.set(event.index, event);
  }
  const rows = [...rowsByIndex.values()].slice(-12).reverse();
  if (!rows.length) {
    list.classList.add('empty');
    list.textContent = state.running ? '\u4efb\u52a1\u5df2\u63d0\u4ea4\uff0c\u7b49\u5f85 runner \u8fd4\u56de\u8fdb\u5ea6' : '\u8fd0\u884c\u540e\u663e\u793a\u6b65\u9aa4';
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


function commandSummary(data) {
  const lines = [
    `\u4efb\u52a1 ID: ${data.id || '-'}`,
    `\u6267\u884c\u547d\u4ee4: ${commandText(data.command)}`,
    data.normalized ? `\u8fde\u63a5: \u8bbe\u59071=${data.normalized.primaryPort || data.normalized.hostValue || data.normalized.bleValue || '-'}\uff0c\u8bbe\u59072=${data.normalized.peerPort || data.normalized.peerHostValue || data.normalized.peerBleValue || '-'}` : '',
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
  if (targetType === 'customConfig') {
    const plan = currentConfigPlan();
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
    if (!primaryValue || !peerValue) {
      $('commandBox').textContent = '\u8be5\u64cd\u4f5c\u9700\u8981\u4e24\u53f0\u8bbe\u5907\u8fde\u63a5\uff1a\u8bf7\u9009\u62e9\u4e24\u4e2a COM \u53e3\uff0c\u6216\u586b\u5199\u4e24\u53f0\u8bbe\u5907\u7684 TCP/BLE \u53c2\u6570\u3002';
      return false;
    }
    if (type === 'port' && primaryValue === peerValue) {
      $('commandBox').textContent = '\u4e24\u53f0\u8bbe\u5907\u4e0d\u80fd\u4f7f\u7528\u540c\u4e00\u4e2a\u4e32\u53e3\u3002';
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
  captureDeviceConfigs(result);
  captureDeviceSnapshots(result);
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
  $('commandBox').textContent = 'Task created, waiting for runner progress.';
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
      return data;
    }
    if (visible) return finishRun(data, label, payload);
    let result = data.result || {};
    if (!result.cases?.length) result = syntheticRunResult(data);
    captureDeviceLabels(result);
    captureDeviceConfigs(result);
    captureDeviceSnapshots(result);
    captureChannelLabels(result);
    renderReports(data.reports);
    $('commandBox').textContent = commandSummary(data);
    setRunning(false);
    return data;
  } catch (error) {
    $('runState').textContent = '寮傚父';
    $('runState').className = 'badge error';
    $('commandBox').textContent = error.message;
    setRunning(false);
    return null;
  }
}

async function runTarget(targetType, value, visible = true) {
  if (!validateBeforeRun(targetType, value)) return null;
  const payload = runPayload(targetType, value);
  const label = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return runExistingPayload(payload, label, visible);
}

async function cancelRun() {
  if (!state.currentJobId) return;
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

async function runCommunication() {
  if (!validateBeforeRun('communicationExperiment')) return;
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
  await runTarget('communicationExperiment');
}


function renderModules() {
  const grid = $('moduleGrid');
  grid.innerHTML = '';
  for (const [moduleName, cases] of Object.entries(state.modules)) {
    const item = document.createElement('article');
    item.className = 'module-row';
    const checked = moduleName === '\u53ef\u9009\u53d6\u8bc1' ? '' : 'checked';
    const caseList = cases.map((caseItem) => `<div class="case-row"><span>${escapeHtml(caseItem.id)} \u00b7 ${escapeHtml(caseItem.source_l2_case)}</span><button class="case-run" data-case="${escapeHtml(caseItem.id)}" title="\u8fd0\u884c ${escapeHtml(caseItem.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button></div>`).join('');
    item.innerHTML = `
      <div class="module-head">
        <label class="module-check">
          <input type="checkbox" data-module-check value="${escapeHtml(moduleName)}" ${checked}>
          <span><strong>${escapeHtml(displayModuleName(moduleName))}</strong><em>${cases.length} \u6761</em></span>
        </label>
        <button data-module="${escapeHtml(moduleName)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>\u8fd0\u884c</button>
      </div>
      <div class="case-list">${caseList}</div>
    `;
    grid.appendChild(item);
  }
  grid.querySelectorAll('[data-module]').forEach((button) => button.addEventListener('click', () => runTarget('module', button.dataset.module)));
  grid.querySelectorAll('[data-case]').forEach((button) => button.addEventListener('click', () => runTarget('case', button.dataset.case)));
  grid.querySelectorAll('[data-module-check]').forEach((check) => check.addEventListener('change', syncToggleAllState));
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
  const type = $('connectionType').value;
  $('serialFields').classList.toggle('hidden', type !== 'port');
  $('hostFields').classList.toggle('hidden', type !== 'host');
  $('bleFields').classList.toggle('hidden', type !== 'ble');
}

function initConfigControls() {
  $('configKind').innerHTML = configDefinitions.map((item) => `<option value="${escapeHtml(item.kind)}">${escapeHtml(item.label)}</option>`).join('');
  renderConfigDynamicFields();
}


function renderConfigDynamicFields() {
  const definition = currentConfigDefinition();
  const wrap = $('configDynamicFields');
  if (definition.type === 'user_name') {
    wrap.innerHTML = `
      <label class="field"><span>Long Name</span><input id="ownerLongName" maxlength="40" placeholder="\u8bbe\u5907\u957f\u540d"></label>
      <label class="field"><span>Short Name</span><input id="ownerShortName" maxlength="4" placeholder="4 \u4e2a\u5b57\u7b26\u4ee5\u5185"></label>
    `;
  } else if (definition.type === 'channel') {
    wrap.innerHTML = `
      <label class="field compact"><span>Channel Index</span><input id="configChannelIndex" type="number" min="0" max="7" value="0"></label>
      <label class="field"><span>Channel Name</span><input id="configChannelName" placeholder="\u4f8b\u5982 LongFast"></label>
      <label class="field wide"><span>Channel PSK</span><input id="configChannelPsk" placeholder="default / none / 0x..."></label>
    `;
  } else if (definition.type === 'wifi') {
    wrap.innerHTML = `
      <label class="field"><span>WiFi</span><select id="wifiEnabled"><option value="">\u4e0d\u4fee\u6539\u5f00\u5173</option>${optionHtml(boolOptions)}</select></label>
      <label class="field"><span>SSID</span><input id="wifiSsid" placeholder="WiFi \u540d\u79f0"></label>
      <label class="field wide"><span>Key</span><input id="wifiKey" type="password" placeholder="WiFi \u5bc6\u7801"></label>
    `;
  } else if (definition.type === 'region') {
    const target = defaultConfigTargetForForm();
    const currentRegion = cachedConfigValue(target, 'lora.region', regions[0]);
    const currentOverride = cachedConfigValue(target, 'lora.override_frequency', '0') || '0';
    wrap.innerHTML = `
      <label class="field"><span>Region</span><select id="regionValue">${optionHtml(regions)}</select></label>
      <label class="field"><span>Frequency Override MHz</span><input id="regionOverrideFrequency" inputmode="decimal" placeholder="0 \u8868\u793a\u4e0d\u8986\u76d6" value="${escapeHtml(currentOverride)}"></label>
    `;
    const regionSelect = $('regionValue');
    if (regions.includes(currentRegion)) regionSelect.value = currentRegion;
  } else if (definition.type === 'field_select') {
    wrap.innerHTML = `<label class="field wide"><span>${escapeHtml(definition.label)}</span><select id="configValue">${optionHtml(definition.values)}</select></label>`;
  } else if (definition.type === 'field_bool') {
    wrap.innerHTML = `<label class="field wide"><span>${escapeHtml(definition.label)}</span><select id="configValue">${optionHtml(definition.values || boolOptions)}</select></label>`;
  } else if (definition.type === 'unsupported') {
    wrap.innerHTML = `<p class="form-note wide">\u5f53\u524d CLI \u672a\u66b4\u9732 Language \u914d\u7f6e\u5199\u5165\uff0c\u8be5\u9879\u6682\u4f5c\u4eba\u5de5\u9a8c\u8bc1\u3002</p>`;
  } else {
    wrap.innerHTML = `<label class="field wide"><span>${escapeHtml(definition.label)}</span><input id="configValue" placeholder="${escapeHtml(definition.placeholder || 'Enter config value')}"></label>`;
  }
}

function updateCommConfigControls() {
  $('experimentRegion').disabled = !$('useExperimentRegion').checked;
  $('experimentModem').disabled = !$('useExperimentModem').checked;
  $('overrideFrequency').disabled = !$('useOverrideFrequency').checked;
}

function resetDeviceIdentity() {
  state.deviceLabels = { ...fallbackTargetLabels };
  state.deviceNodeIds = { primary: '', peer: '' };
  state.deviceConfigs = { primary: {}, peer: {} };
  state.deviceSnapshots = { primary: null, peer: null };
  state.channels = { 0: '\u4e3b\u9891\u9053', 1: '\u9891\u9053 1' };
  state.channelSources = { 0: 'default', 1: 'default' };
  updateTargetOptionLabels();
  renderDeviceSnapshots();
  updateChannelOptions();
  fillLogPortSelect();
}

function updateMessageModeControls() {
  const isChannel = $('messageMode').value === 'channel';
  $('messageChannel').disabled = !isChannel;
  $('messageChannelField').classList.toggle('muted-field', !isChannel);
}

async function init() {
  try {
    initConfigControls();
    const health = await api('/api/health');
    $('healthDot').className = 'dot ok';
    $('healthText').textContent = health.ok ? '\u670d\u52a1\u6b63\u5e38' : '\u670d\u52a1\u5f02\u5e38';
    const cases = await api('/api/cases');
    state.modules = cases.modules;
    state.cases = cases.cases;
    $('caseCount').textContent = `${state.cases.length} \u6761\u7528\u4f8b`;
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
  } catch (error) {
    $('healthDot').className = 'dot fail';
    $('healthText').textContent = '\u670d\u52a1\u5f02\u5e38';
    $('commandBox').textContent = error.message;
  }
}

$('runSuite').addEventListener('click', () => runTarget('module', '\u6d4b\u8bd5\u524d\u68c0\u67e5'));
$('runSelected').addEventListener('click', () => runTarget('modules'));
$('runConfigWrite').addEventListener('click', () => runTarget('customConfig'));
$('runContactExchange').addEventListener('click', () => runTarget('contactExchange'));
$('runExperiment').addEventListener('click', runCommunication);
$('stopRun').addEventListener('click', cancelRun);
$('toggleAllModules').addEventListener('change', (event) => setAllModules(event.target.checked));
$('configKind').addEventListener('change', renderConfigDynamicFields);
$('configTarget').addEventListener('change', () => {
  updateTargetOptionLabels();
  renderConfigDynamicFields();
});
$('useExperimentRegion').addEventListener('change', updateCommConfigControls);
$('useExperimentModem').addEventListener('change', updateCommConfigControls);
$('useOverrideFrequency').addEventListener('change', updateCommConfigControls);
$('messageMode').addEventListener('change', updateMessageModeControls);
document.querySelectorAll('[data-result-filter]').forEach((item) => {
  item.addEventListener('click', () => {
    state.resultFilter = state.resultFilter === item.dataset.resultFilter ? '' : item.dataset.resultFilter;
    renderResults();
    $('resultList').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  item.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    item.click();
  });
});
$('clearResults').addEventListener('click', () => {
  state.runs = [];
  state.resultFilter = '';
  summarize();
  renderResults();
  renderProgress({ done: 0, total: 0, percent: 0, events: [] });
  $('runState').textContent = 'Ready';
  $('runState').className = 'badge idle';
});
$('scanPorts').addEventListener('click', scanPorts);
$('connectionType').addEventListener('change', showConnectionFields);
$('primaryPort').addEventListener('change', () => { syncPortSelectors(); resetDeviceIdentity(); });
$('peerPort').addEventListener('change', () => { syncPortSelectors(); resetDeviceIdentity(); });
$('hostValue').addEventListener('change', resetDeviceIdentity);
$('peerHostValue').addEventListener('change', resetDeviceIdentity);
$('bleValue').addEventListener('change', resetDeviceIdentity);
$('peerBleValue').addEventListener('change', resetDeviceIdentity);
$('startSerialLog').addEventListener('click', startSerialLog);
$('stopSerialLog').addEventListener('click', stopSerialLog);
init();
