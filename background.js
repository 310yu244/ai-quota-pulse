let queue = Promise.resolve();
const KEY = provider => provider === 'gpt' ? 'quota_gpt' : 'quota_claude';
const SOURCES = {
  claude: ['usage', 'headers', 'message_limit', 'rate_limit'],
  gpt: ['wham_usage', 'codex_headers', 'rate_limit'],
};
const WINDOW_RE = /^(five_hour|seven_day(?:_[a-z0-9_]+)?)$/;

// One-off migration from v1: the single `quota` key was always Claude data.
async function migrate() {
  const stored = await chrome.storage.local.get(['quota', 'quota_claude']);
  if (stored.quota && !stored.quota_claude && stored.quota.provider !== 'gpt') {
    await chrome.storage.local.set({quota_claude: {...stored.quota, provider: 'claude'}});
    await chrome.storage.local.remove('quota');
  } else if (stored.quota) {
    await chrome.storage.local.remove('quota');
  }
}
function pruneQuota(quota) {
  if (!quota) return {quota, changed: false};
  let changed = false;
  for (const [key, value] of Object.entries(quota.windows || {})) if (value.resetsAt && value.resetsAt <= Date.now()) { delete quota.windows[key]; changed = true; }
  if (quota.resetsAt && quota.resetsAt <= Date.now()) {
    const primary = quota.windows.five_hour || Object.values(quota.windows)[0];
    quota = primary ? {...quota, ...primary, status: primary.remainingPct === 0 ? 'exceeded' : 'available'} : null;
    changed = true;
  }
  return {quota, changed};
}
async function badge() {
  const stored = await chrome.storage.local.get(['quota_claude', 'quota_gpt']);
  const quotas = [];
  for (const key of ['quota_claude', 'quota_gpt']) {
    let q = stored[key];
    if (!q) continue;
    const pruned = pruneQuota(q);
    if (pruned.changed) { q = pruned.quota; await chrome.storage.local.set({[key]: q}); }
    if (q) quotas.push(q);
  }
  // Badge shows the tightest remaining percent across providers that have data.
  const pcts = quotas.map(q => q.remainingPct).filter(v => typeof v === 'number');
  const lowest = pcts.length ? Math.min(...pcts) : null;
  const anyExceeded = quotas.some(q => q.status === 'exceeded');
  const text = anyExceeded ? '!' : typeof lowest === 'number' ? Math.round(lowest) + '%' : '–';
  const color = text === '–' ? '#64748b' : text === '!' || lowest < 20 ? '#ef4444' : lowest <= 50 ? '#eab308' : '#22c55e';
  await chrome.action.setBadgeText({text}); await chrome.action.setBadgeBackgroundColor({color});
  await chrome.alarms.clear('quota-reset');
  const times = quotas.flatMap(q => [q.resetsAt, ...Object.values(q.windows || {}).map(w => w.resetsAt)]).filter(t => t > Date.now());
  if (times.length) await chrome.alarms.create('quota-reset', {when: Math.min(...times)});
}
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== 'quota' || !sender.tab || !sender.url) return;
  const s = message.state;
  if (!s || !['claude', 'gpt'].includes(s.provider) || !['available', 'approaching', 'exceeded'].includes(s.status)) return;
  // Origin must match the claimed provider: claude.ai -> claude, chatgpt.com / chat.openai.com -> gpt.
  const isClaudeOrigin = sender.url.startsWith('https://claude.ai/');
  const isGPTOrigin = sender.url.startsWith('https://chatgpt.com/') || sender.url.startsWith('https://chat.openai.com/');
  if (s.provider === 'claude' && !isClaudeOrigin) return;
  if (s.provider === 'gpt' && !isGPTOrigin) return;
  const key = KEY(s.provider);
  queue = queue.then(async () => {
    const stored = await chrome.storage.local.get(key);
    const previous = stored[key];
    const windows = {};
    for (const [k, value] of Object.entries(s.windows || {})) if (WINDOW_RE.test(k) && Number.isFinite(value?.remainingPct)) windows[k] = {remainingPct: Math.max(0, Math.min(100, value.remainingPct)), resetsAt: Number.isFinite(value.resetsAt) ? value.resetsAt : null};
    const remainingPct = Number.isFinite(s.remainingPct) ? Math.max(0, Math.min(100, s.remainingPct)) : previous?.remainingPct ?? null;
    const next = {provider: s.provider, remainingPct, status: s.status, resetsAt: Number.isFinite(s.resetsAt) ? s.resetsAt : null, windows: {...previous?.windows, ...windows}, source: SOURCES[s.provider].includes(s.source) ? s.source : SOURCES[s.provider][0], updatedAt: Date.now()};
    if (typeof s.planType === 'string' && s.planType) next.planType = s.planType;
    await chrome.storage.local.set({[key]: next});
    await badge();
  }).catch(() => {});
});
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.quota_claude || changes.quota_gpt)) void badge(); });
chrome.alarms.onAlarm.addListener(() => void badge());
chrome.runtime.onInstalled.addListener(() => { void migrate().then(() => badge()); });
chrome.runtime.onStartup.addListener(() => { void migrate().then(() => badge()); });
void migrate().then(() => badge());
