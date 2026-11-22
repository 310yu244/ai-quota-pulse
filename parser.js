(function (root) {
  const number = v => typeof v === 'number' && Number.isFinite(v);
  const time = v => {
    if (number(v)) return v > 1e12 ? v : v * 1000;
    if (typeof v !== 'string' || !v.trim()) return null;
    if (/^\d+(\.\d+)?$/.test(v)) return time(Number(v));
    const n = Date.parse(v);
    return Number.isFinite(n) ? n : null;
  };
  const clampPct = v => Math.max(0, Math.min(100, v));
  function parse(body, headers = {}, status = 200, now = Date.now()) {
    const result = {provider: 'claude', remainingPct: null, status: 'unknown', resetsAt: null, windows: {}, source: 'usage', updatedAt: now};
    if (!body || typeof body !== 'object') body = {};
    for (const [key, value] of Object.entries(body)) {
      if (!/^(five_hour|seven_day(?:_[a-z0-9_]+)?)$/.test(key) || !value || !number(value.utilization)) continue;
      result.windows[key] = {remainingPct: Math.max(0, Math.min(100, 100 - value.utilization)), resetsAt: time(value.resets_at)};
    }
    const primary = result.windows.five_hour || Object.values(result.windows)[0];
    if (primary) Object.assign(result, primary, {status: primary.remainingPct === 0 ? 'exceeded' : primary.remainingPct < 20 ? 'approaching' : 'available'});
    const limit = body.message_limit || body.error || body;
    if (['within_limit', 'approaching_limit', 'exceeded_limit'].includes(limit.type)) {
      result.source = 'message_limit';
      result.status = {within_limit: 'available', approaching_limit: 'approaching', exceeded_limit: 'exceeded'}[limit.type];
      result.resetsAt = time(limit.resetsAt);
      if (number(limit.remaining)) result.remaining = Math.max(0, limit.remaining);
      if (limit.type === 'exceeded_limit') result.remainingPct = 0;
      if (limit.windows && typeof limit.windows === 'object') result.windows = parse(limit.windows, {}, 200, now)?.windows || {};
    }
    const h = Object.fromEntries(Object.entries(headers).map(([k,v]) => [k.toLowerCase(), v]));
    for (const key of Object.keys(h)) {
      if (!/^anthropic-ratelimit-.*-remaining$/.test(key)) continue;
      const prefix = key.slice(0, -10), remaining = Number(h[key]), total = Number(h[prefix + '-limit']);
      if (Number.isFinite(remaining) && total > 0) {
        result.remainingPct = Math.max(0, Math.min(100, remaining / total * 100));
        result.resetsAt = time(h[prefix + '-reset']);
        result.status = remaining <= 0 ? 'exceeded' : result.remainingPct < 20 ? 'approaching' : 'available';
        result.source = 'headers';
        break;
      }
    }
    if (status === 429) {
      result.status = 'exceeded'; result.remainingPct = 0; result.source = 'rate_limit';
      result.resetsAt ||= time(limit.resetsAt) || time(body.resetsAt);
      if (!result.resetsAt && h['retry-after']) {
        const delay = Number(h['retry-after']);
        result.resetsAt = Number.isFinite(delay) ? now + delay * 1000 : time(h['retry-after']);
      }
    }
    return result.status === 'unknown' ? null : result;
  }
  // GPT / ChatGPT-subscription (Codex backend) quota.
  // Authoritative first-party surface: GET https://chatgpt.com/backend-api/wham/usage
  // (used by the official openai/codex CLI). Response shape (unofficial, may change):
  // { plan_type, rate_limit: { allowed, limit_reached,
  //   primary_window: { used_percent, limit_window_seconds: 18000, reset_at (unix s), reset_after_seconds },
  //   secondary_window: { used_percent, limit_window_seconds: 604800, reset_at, reset_after_seconds } },
  //   credits, additional_rate_limits }.
  // Second channel: x-codex-* response headers on /backend-api/codex/responses.
  // Plain ChatGPT web chat has NO percent endpoint, so this parser never invents
  // a message cap (e.g. "80 per 3h") as a percentage; unknown stays unknown (null).
  function parseGPT(body, headers = {}, status = 200, now = Date.now()) {
    const result = {provider: 'gpt', remainingPct: null, status: 'unknown', resetsAt: null, windows: {}, source: 'wham_usage', updatedAt: now};
    if (!body || typeof body !== 'object') body = {};
    if (typeof body.plan_type === 'string' && body.plan_type) result.planType = body.plan_type;
    const h = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [String(k).toLowerCase(), v]));
    if (typeof h['x-codex-plan-type'] === 'string' && h['x-codex-plan-type']) result.planType = h['x-codex-plan-type'];
    // reset_at is an absolute timestamp (unix seconds, ms, or ISO string);
    // reset_after_seconds is a duration from now. Never mix the two up.
    const windowReset = w => {
      if (!w || typeof w !== 'object') return null;
      const at = time(w.reset_at);
      if (at) return at;
      if (number(w.reset_after_seconds)) return now + w.reset_after_seconds * 1000;
      return null;
    };
    const addWindow = (key, w) => {
      if (!w || typeof w !== 'object' || !number(w.used_percent)) return;
      result.windows[key] = {remainingPct: clampPct(100 - w.used_percent), resetsAt: windowReset(w)};
    };
    const rl = (body.rate_limit && typeof body.rate_limit === 'object') ? body.rate_limit : {};
    addWindow('five_hour', rl.primary_window);
    addWindow('seven_day', rl.secondary_window);
    // x-codex-* headers (only used when the wham body did not already supply a window).
    const headerWindow = (prefix, fallbackKey) => {
      const used = Number(h[prefix + '-used-percent']);
      if (!Number.isFinite(used)) return;
      const minutes = Number(h[prefix + '-window-minutes']);
      const key = minutes === 10080 ? 'seven_day' : minutes === 300 ? 'five_hour' : fallbackKey;
      if (result.windows[key]) return;
      let resetsAt = time(h[prefix + '-reset-at']);
      if (!resetsAt && number(Number(h[prefix + '-reset-after-seconds']))) resetsAt = now + Number(h[prefix + '-reset-after-seconds']) * 1000;
      result.windows[key] = {remainingPct: clampPct(100 - used), resetsAt};
      result.source = 'codex_headers';
    };
    headerWindow('x-codex-primary', 'five_hour');
    headerWindow('x-codex-secondary', 'seven_day');
    // Status is driven by the tightest (lowest-remaining) window, since either
    // the 5-hour or the 7-day window can be the binding limit.
    const pcts = Object.values(result.windows).map(w => w.remainingPct).filter(v => Number.isFinite(v));
    if (pcts.length) {
      const worst = Math.min(...pcts);
      const primary = result.windows.five_hour || Object.values(result.windows)[0];
      result.remainingPct = primary.remainingPct;
      result.resetsAt = primary.resetsAt;
      result.status = worst === 0 ? 'exceeded' : worst <= 20 ? 'approaching' : 'available';
    }
    const reachedType = rl.rate_limit_reached_type;
    if (rl.limit_reached === true || (typeof reachedType === 'string' && reachedType && reachedType !== 'none')) {
      result.status = 'exceeded';
      result.remainingPct = 0;
      if (result.windows.five_hour) result.windows.five_hour.remainingPct = 0;
    }
    if (status === 429) {
      result.status = 'exceeded'; result.remainingPct = 0; result.source = 'rate_limit';
      if (!result.resetsAt && h['retry-after']) {
        const delay = Number(h['retry-after']);
        result.resetsAt = Number.isFinite(delay) ? now + delay * 1000 : time(h['retry-after']);
      }
      if (!result.resetsAt) {
        const resetAt = time(h['x-codex-primary-reset-at']) || time(h['x-codex-secondary-reset-at']);
        if (resetAt) result.resetsAt = resetAt;
      }
    }
    return result.status === 'unknown' ? null : result;
  }
  root.QuotaParser = {parse, parseGPT, time};
  if (typeof module !== 'undefined') module.exports = root.QuotaParser;
})(globalThis);
