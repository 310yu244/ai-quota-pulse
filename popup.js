const PROVIDERS = {
  claude: {
    key: 'quota_claude', site: 'https://claude.ai/', tabUrl: 'https://claude.ai/*',
    accent: '#aa92ff', openLabel: 'Open Claude ↗', remainingLabel: 'Claude remaining',
    emptyText: 'Open claude.ai and sign in. Your quota will appear here automatically when Claude shares usage data.',
    resetUnknown: 'Reset time not shared by Claude',
    checking: 'Checking Claude…', openFirst: 'Open claude.ai first, then refresh.',
  },
  gpt: {
    key: 'quota_gpt', site: 'https://chatgpt.com/', tabUrl: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
    accent: '#34d399', openLabel: 'Open ChatGPT ↗', remainingLabel: 'GPT remaining',
    emptyText: 'Open chatgpt.com and sign in. Quota appears when ChatGPT shares usage data via the Codex backend (wham/usage). Plain ChatGPT chat has no percent endpoint — if nothing is shared, this stays unknown, never guessed.',
    resetUnknown: 'Reset time not shared by ChatGPT',
    checking: 'Checking ChatGPT…', openFirst: 'Open chatgpt.com first, then refresh.',
  },
};
let active = 'claude';
let states = {claude: null, gpt: null};
const $ = id => document.getElementById(id);
const cfg = () => PROVIDERS[active];
const state = () => states[active];
function tick() {
  const s = state();
  if (!s) return;
  const seconds = s.resetsAt ? Math.max(0, Math.ceil((s.resetsAt - Date.now()) / 1000)) : null;
  $('countdown').textContent = seconds === null ? cfg().resetUnknown : seconds === 0 ? 'Reset reached · refresh to verify' : `Resets in ${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}m ${String(seconds % 60).padStart(2, '0')}s`;
  $('updated').textContent = 'Updated ' + new Date(s.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}
async function render() {
  const stored = await chrome.storage.local.get(['quota_claude', 'quota_gpt', 'activeTab']);
  states = {claude: stored.quota_claude || null, gpt: stored.quota_gpt || null};
  if (stored.activeTab === 'gpt' || stored.activeTab === 'claude') active = stored.activeTab;
  $('tab-claude').classList.toggle('active', active === 'claude');
  $('tab-gpt').classList.toggle('active', active === 'gpt');
  $('gpt-note').hidden = active !== 'gpt';
  const s = state();
  $('empty').hidden = !!s; $('data').hidden = !s;
  $('empty-text').textContent = cfg().emptyText;
  $('open').textContent = cfg().openLabel;
  $('provider-label').textContent = cfg().remainingLabel;
  if (!s) return;
  const pct = s.remainingPct;
  $('percent').textContent = typeof pct === 'number' ? Math.round(pct) + '%' : '—';
  $('arc').style.strokeDashoffset = 540.354 * (1 - (pct || 0) / 100);
  $('arc').style.stroke = s.status === 'exceeded' ? '#f27186' : cfg().accent;
  $('status').textContent = s.status;
  $('source').textContent = (s.source || '').replaceAll('_', ' ') + (s.planType ? ' · ' + s.planType : '');
  $('windows').replaceChildren();
  for (const [key, value] of Object.entries(s.windows || {})) {
    const row = document.createElement('div'); row.className = 'window';
    const label = document.createElement('div'); label.className = 'window-label';
    const name = document.createElement('span'); name.textContent = ({five_hour: '5-hour window', seven_day: '7-day window', seven_day_opus: 'Opus · 7-day window'})[key] || key.replaceAll('_', ' ');
    const amount = document.createElement('span'); amount.textContent = Math.round(value.remainingPct) + '% remaining';
    const bar = document.createElement('div'); bar.className = 'bar';
    const fill = document.createElement('i'); fill.style.width = value.remainingPct + '%';
    if (active === 'gpt') fill.style.background = 'linear-gradient(90deg,#0f766e,#34d399)';
    bar.append(fill); label.append(name, amount); row.append(label, bar); $('windows').append(row);
  }
  tick();
}
async function setActive(provider) {
  active = provider;
  await chrome.storage.local.set({activeTab: provider});
  await render();
}
$('tab-claude').onclick = () => void setActive('claude');
$('tab-gpt').onclick = () => void setActive('gpt');
$('open').onclick = () => chrome.tabs.create({url: cfg().site});
$('clear').onclick = async () => { await chrome.storage.local.remove(cfg().key); $('notice').textContent = 'Local ' + (active === 'gpt' ? 'GPT' : 'Claude') + ' quota data cleared.'; await render(); };
$('refresh').onclick = async () => {
  $('refresh').disabled = true; $('notice').textContent = cfg().checking;
  try {
    const tabs = await chrome.tabs.query({url: cfg().tabUrl});
    if (!tabs.length) { $('notice').textContent = cfg().openFirst; return; }
    const result = await chrome.tabs.sendMessage(tabs[0].id, {type: 'refresh', provider: active});
    $('notice').textContent = result?.ok ? 'Usage refreshed. All data stays on this device.' : 'Could not refresh. Check your sign-in and try again.';
  } catch { $('notice').textContent = 'Reload your tab, then try again.'; }
  finally { $('refresh').disabled = false; }
};
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.quota_claude || changes.quota_gpt || changes.activeTab)) void render(); });
setInterval(tick, 1000);
void render();
