// GPT / ChatGPT-subscription (Codex backend) observer — MAIN world, chatgpt.com only.
// Mirrors inject.js (Claude) but for the ChatGPT backend:
//   - GET /backend-api/wham/usage -> JSON body parsed via QuotaParser.parseGPT.
//   - /backend-api/codex/responses -> response HEADERS ONLY via QuotaParser.parseGPT.
//     The response body is never read or cloned: the SSE stream is left completely
//     alone so a normal ChatGPT/Codex turn is never disturbed and no extra quota
//     is spent. Only same-origin requests are observed; nothing leaves the device.
(() => {
  const originalFetch = window.fetch;
  const emit = state => { if (state) window.postMessage({channel: 'ai-quota-pulse', state}, location.origin); };
  const isUsage = url => {
    try { const u = new URL(url, location.href); return u.origin === location.origin && /^\/backend-api\/wham\/usage\/?$/.test(u.pathname); } catch { return false; }
  };
  const isResponses = url => {
    try { const u = new URL(url, location.href); return u.origin === location.origin && /^\/backend-api\/codex\/responses(?:\/|$)/.test(u.pathname); } catch { return false; }
  };
  const headersOf = response => {
    try { return Object.fromEntries(response.headers.entries()); } catch { return {}; }
  };
  async function inspectUsage(response) {
    try {
      const headers = headersOf(response);
      emit(QuotaParser.parseGPT(null, headers, response.status));
      emit(QuotaParser.parseGPT(await response.json(), headers, response.status));
    } catch {}
  }
  function inspectResponsesHeaders(response) {
    try { emit(QuotaParser.parseGPT(null, headersOf(response), response.status)); } catch {}
  }
  window.fetch = function (...args) {
    const promise = Reflect.apply(originalFetch, this, args);
    try {
      const url = args[0] instanceof Request ? args[0].url : args[0];
      if (isUsage(url)) promise.then(response => { try { void inspectUsage(response.clone()); } catch {} }, () => {});
      else if (isResponses(url)) promise.then(response => { try { inspectResponsesHeaders(response); } catch {} }, () => {});
    } catch {}
    return promise;
  };
  const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
  const urls = new WeakMap();
  XMLHttpRequest.prototype.open = function (...args) { urls.set(this, args[1]); return Reflect.apply(open, this, args); };
  XMLHttpRequest.prototype.send = function (...args) {
    const url = urls.get(this);
    if (isUsage(url) || isResponses(url)) this.addEventListener('load', () => {
      try {
        const headers = Object.fromEntries(this.getAllResponseHeaders().trim().split(/[\r\n]+/).filter(Boolean).map(line => { const i = line.indexOf(':'); return [line.slice(0, i).toLowerCase(), line.slice(i + 1).trim()]; }));
        emit(QuotaParser.parseGPT(null, headers, this.status));
        if (isUsage(url) && !(headers['content-type'] || '').includes('text/event-stream')) {
          const body = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);
          emit(QuotaParser.parseGPT(body, headers, this.status));
        }
        // /backend-api/codex/responses via XHR: headers only, body never read.
      } catch {}
    }, {once: true});
    return Reflect.apply(send, this, args);
  };
  let refreshing = false;
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      // Same-origin session request only. In the browser this rides the existing
      // ChatGPT login (cookies); no token is read, stored, or fabricated here.
      // The endpoint is unofficial and may 401/403 (e.g. on free accounts) —
      // that is reported as a failed refresh, never guessed.
      const response = await originalFetch('/backend-api/wham/usage', {credentials: 'same-origin'});
      await inspectUsage(response.clone());
      if (!response.ok) throw new Error('ChatGPT usage is currently unavailable.');
      window.postMessage({channel: 'ai-quota-pulse-result', ok: true}, location.origin);
    } catch { window.postMessage({channel: 'ai-quota-pulse-result', ok: false}, location.origin); }
    finally { refreshing = false; }
  }
  window.addEventListener('message', event => {
    if (event.source === window && event.origin === location.origin && event.data?.channel === 'ai-quota-pulse-refresh-gpt') void refresh();
  });
})();
