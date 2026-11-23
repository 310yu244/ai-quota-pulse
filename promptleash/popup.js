const defaults = {concise:false, limit:300, fillOnly:false, showPanel:true};
async function load() {
  const {settings = {}} = await chrome.storage.local.get('settings');
  for (const [key, value] of Object.entries({...defaults, ...settings})) {
    const el = document.getElementById(key);
    if (el) el[el.type === 'checkbox' ? 'checked' : 'value'] = value;
  }
}
load().catch(() => document.getElementById('status').textContent = '读取失败，请重新打开设置');
document.addEventListener('change', async () => {
  const settings = {};
  for (const key of Object.keys(defaults)) {
    const el = document.getElementById(key);
    settings[key] = el.type === 'checkbox' ? el.checked : Math.min(5000, Math.max(50, parseInt(el.value, 10) || 300));
  }
  document.getElementById('limit').value = settings.limit;
  try { await chrome.storage.local.set({settings}); document.getElementById('status').textContent = '已保存 · 当前打开的页面立即生效'; }
  catch { document.getElementById('status').textContent = '保存失败，请重试'; }
});
