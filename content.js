(() => {
  const isGPT = () => /(^|\.)chatgpt\.com$/.test(location.hostname) || /(^|\.)chat.openai\.com$/.test(location.hostname);
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.channel === 'ai-quota-pulse') chrome.runtime.sendMessage({type: 'quota', state: event.data.state}).catch(() => {});
  });
  const refresh = () => window.postMessage({channel: isGPT() ? 'ai-quota-pulse-refresh-gpt' : 'ai-quota-pulse-refresh'}, location.origin);
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type !== 'refresh') return;
    // A refresh request for the other provider is ignored on this page.
    if (message.provider === 'gpt' && !isGPT()) return;
    if (message.provider === 'claude' && isGPT()) return;
    const timeout = setTimeout(() => { window.removeEventListener('message', listener); respond({ok: false}); }, 12000);
    function listener(event) {
      if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'ai-quota-pulse-result') return;
      clearTimeout(timeout); window.removeEventListener('message', listener); respond({ok: event.data.ok === true});
    }
    window.addEventListener('message', listener); refresh(); return true;
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, {once: true});
  else refresh();
})();
