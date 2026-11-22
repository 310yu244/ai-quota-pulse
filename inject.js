(() => {
  const originalFetch = window.fetch;
  const emit = state => { if (state) window.postMessage({channel: 'ai-quota-pulse', state}, location.origin); };
  const relevant = url => {
    try { const u = new URL(url, location.href); return u.origin === location.origin && /^\/api\/organizations(?:\/|$)/.test(u.pathname); } catch { return false; }
  };
  async function inspect(response) {
    try {
      const headers = Object.fromEntries(response.headers.entries());
      emit(QuotaParser.parse(null, headers, response.status));
      if ((headers['content-type'] || '').includes('text/event-stream')) {
        const reader = response.body.getReader(), decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const {value, done} = await reader.read();
          buffer += decoder.decode(value, {stream: !done});
          const lines = buffer.split(/\r?\n/); buffer = lines.pop();
          if (done && buffer) lines.push(buffer);
          for (const line of lines) if (line.startsWith('data:')) {
            try { emit(QuotaParser.parse(JSON.parse(line.slice(5)), {}, response.status)); } catch {}
          }
          if (buffer.length > 1024 * 1024) { await reader.cancel(); break; }
          if (done) break;
        }
      } else emit(QuotaParser.parse(await response.json(), headers, response.status));
    } catch {}
  }
  window.fetch = function (...args) {
    const promise = Reflect.apply(originalFetch, this, args);
    try {
      if (relevant(args[0] instanceof Request ? args[0].url : args[0])) promise.then(response => { try { void inspect(response.clone()); } catch {} }, () => {});
    } catch {}
    return promise;
  };
  const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
  const urls = new WeakMap();
  XMLHttpRequest.prototype.open = function (...args) { urls.set(this, args[1]); return Reflect.apply(open, this, args); };
  XMLHttpRequest.prototype.send = function (...args) {
    if (relevant(urls.get(this))) this.addEventListener('load', () => {
      try {
        const headers = Object.fromEntries(this.getAllResponseHeaders().trim().split(/[\r\n]+/).filter(Boolean).map(line => { const i = line.indexOf(':'); return [line.slice(0, i).toLowerCase(), line.slice(i + 1).trim()]; }));
        emit(QuotaParser.parse(null, headers, this.status));
        if ((headers['content-type'] || '').includes('text/event-stream')) {
          for (const line of this.responseText.split(/\r?\n/)) if (line.startsWith('data:')) {
            try { emit(QuotaParser.parse(JSON.parse(line.slice(5)), {}, this.status)); } catch {}
          }
        } else {
          const body = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);
          emit(QuotaParser.parse(body, headers, this.status));
        }
      } catch {}
    }, {once: true});
    return Reflect.apply(send, this, args);
  };
  let refreshing = false;
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const response = await originalFetch('/api/organizations', {credentials: 'same-origin'});
      if (!response.ok) throw new Error('Sign in to Claude to refresh.');
      const orgs = await response.json();
      const cookie = document.cookie.split('; ').find(v => v.startsWith('lastActiveOrg='));
      const preferred = cookie ? decodeURIComponent(cookie.slice(14)) : null;
      const org = Array.isArray(orgs) && (orgs.find(o => o.uuid === preferred) || orgs[0]);
      if (!org?.uuid) throw new Error('No Claude organization found.');
      const usage = await originalFetch('/api/organizations/' + encodeURIComponent(org.uuid) + '/usage', {credentials: 'same-origin'});
      await inspect(usage.clone());
      if (!usage.ok) throw new Error('Claude usage is currently unavailable.');
      window.postMessage({channel: 'ai-quota-pulse-result', ok: true}, location.origin);
    } catch { window.postMessage({channel: 'ai-quota-pulse-result', ok: false}, location.origin); }
    finally { refreshing = false; }
  }
  window.addEventListener('message', event => {
    if (event.source === window && event.origin === location.origin && event.data?.channel === 'ai-quota-pulse-refresh') void refresh();
  });
})();
