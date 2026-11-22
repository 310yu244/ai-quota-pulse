# AI Quota Pulse

A fully client-side Chrome Manifest V3 extension for Claude.ai and ChatGPT (chatgpt.com). No API keys, credentials to configure, analytics, remote scripts, or third-party requests. Only normal authenticated same-origin requests are made when a supported page loads or you click Refresh. No background polling.

## Install (load unpacked)
1. Unzip the download to a permanent folder (or use this directory directly).
2. Open **chrome://extensions** in Chrome.
3. Enable **Developer mode** at the top right.
4. Click **Load unpacked** and choose the `ai-quota-pulse` folder containing `manifest.json`.
5. Pin **AI Quota Pulse** using Chrome's Extensions puzzle-piece menu.
6. Open or reload **https://claude.ai/** and sign in normally on Claude, and/or open **https://chatgpt.com/** and sign in normally on ChatGPT. The extension never asks for credentials.
7. Click the toolbar icon, pick the **Claude** or **GPT** tab, and view quota, window bars and the live reset countdown. Use **Refresh usage** to fetch the current usage for the tab's provider from an existing tab.

## How it works
### Claude tab
- A MAIN-world script passively observes same-origin organization API fetch/XHR responses. Fetch response clones leave the original JSON and SSE stream intact. Unknown response shapes are ignored.
- Usage utilization becomes remaining percent. Message-limit events and 429s update status/reset time; an absolute message count is never misrepresented as a percentage. Header percentages require a matching numeric limit. Missing percentages or reset times display as unknown.
- State is stored under `quota_claude` in `chrome.storage.local`, never synced. (v1 stored it under `quota`; v1.1 migrates that key to `quota_claude` on first run.) Page-provided values are treated as untrusted and bounded before storage. A page can spoof its own telemetry; this is a convenience display, not an authoritative billing source.
- The lastActiveOrg cookie is read only through the page's existing document access; otherwise the first organization is used.

### GPT tab
- Plain ChatGPT web chat has **no** Claude-style usage endpoint that exposes a remaining percent, so this extension does **not** invent one and does **not** turn a published message cap (for example "80 messages per 3 hours") into a percentage. If ChatGPT shares no quota data, the GPT tab stays unknown — never guessed.
- What the GPT tab does read is the ChatGPT-subscription / Codex backend surface used by the official openai/codex CLI: `GET https://chatgpt.com/backend-api/wham/usage`. Its (unofficial) response carries `plan_type` and `rate_limit.primary_window` / `secondary_window` with `used_percent`, `limit_window_seconds` (18000 = 5 hours, 604800 = 7 days), `reset_at` (unix seconds) and `reset_after_seconds`. Remaining percent is `100 - used_percent`; status follows the tightest window (0% = exceeded, ≤20% = approaching, otherwise available).
- A second channel reads only the `x-codex-*` response headers on `https://chatgpt.com/backend-api/codex/responses` (`x-codex-primary-used-percent`, `x-codex-primary-window-minutes`, `x-codex-primary-reset-at` / `-reset-after-seconds`, and the same trio for secondary, plus plan/credits headers). The response **body is never read or cloned** for that endpoint, so a normal ChatGPT/Codex turn and its SSE stream are never disturbed and no extra quota is spent.
- GPT state is stored under `quota_gpt` in `chrome.storage.local`, never synced, bounded the same way as Claude state.
- The toolbar badge shows the lowest remaining percent across the providers that have data, `!` if any provider is exceeded, and `–` if neither has data. Alarms discard expired windows instead of assuming a full replenishment. Chrome may delay alarms while asleep.
- **Clear data** removes the active tab's local quota state only. A later response or page load can populate it again. Uninstalling also removes extension storage.
- Only `storage`, `alarms` and `https://claude.ai/*`, `https://chatgpt.com/*`, `https://chat.openai.com/*` access are requested. No cookies permission, tab-history permission, API key, content capture, or external resources.

## Limitations
- Claude's and ChatGPT's private endpoints and response formats can change. Some plans do not expose all windows, remaining percentages, or reset times; absent information is not guessed. A reset expiry clears stale observations and requires another response/refresh. Requests may fail when signed out or offline. XHR is inspected at completion; fetch SSE events update while streaming.
- The GPT `wham/usage` endpoint is **unofficial and undocumented** and may change, or return 401/403 — notably it may not work on free accounts, which have no Codex quota to report. A failed refresh is shown as a failed refresh, not as a made-up number. The GPT tab therefore reflects the ChatGPT-subscription / Codex quota, not a general "how many ChatGPT messages do I have left" meter for plain chat.
- This extension does not bypass or increase Claude or ChatGPT limits and is not affiliated with Anthropic or OpenAI.

## Files
`parser.js` normalizes responses (Claude `parse`, GPT `parseGPT`); `inject.js` observes Claude page traffic and refreshes Claude usage; `inject-gpt.js` observes ChatGPT page traffic (wham/usage JSON, codex/responses headers only) and refreshes GPT usage; `content.js` bridges page events and routes refreshes by provider; `background.js` validates/stores per-provider state and maintains badges/alarms; `popup.*` renders the Claude/GPT tabs. Icons are bundled PNGs. All code and assets run locally.
