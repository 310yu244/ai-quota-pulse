(() => {
  if (document.getElementById('promptleash')) return;
  const adapter = globalThis.PromptLeashAdapter;
  const {extract, appendRule} = globalThis.PromptLeashExtract;
  let settings = {concise:false, limit:300, fillOnly:false, showPanel:true};
  let busy = false;
  let replaying = false;
  const host = document.createElement('div'); host.id = 'promptleash';
  host.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:2147483647;color-scheme:light';
  const shadow = host.attachShadow({mode:'open'});
  shadow.innerHTML = `<style>
    :host{font:13px/1.5 "Noto Sans SC",system-ui,sans-serif;color:#173d39}*{box-sizing:border-box}button,textarea,input{font:inherit}button{cursor:pointer;border:1px solid #c5d5c9;border-radius:9px;padding:8px 11px;background:#fff;color:#173d39}button:hover{background:#e2ede3}button:focus-visible,textarea:focus-visible{outline:2px solid #20816c;outline-offset:2px}.pill{background:#173d39;color:#fff;border:0;border-radius:24px;padding:12px 18px;box-shadow:0 5px 24px #0002}.panel{width:344px;max-width:calc(100vw - 24px);max-height:calc(100vh - 32px);overflow:auto;background:#f4f7ef;border:1px solid #c8d6c7;border-radius:18px;box-shadow:0 12px 48px #132e3833}header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #d7e0d2;cursor:move;touch-action:none}strong{font-size:18px}small{display:block;font-size:11px;color:#71816e}header button{padding:2px 9px;background:transparent}section{margin:0 18px;padding:13px 0;border-bottom:1px solid #d7e0d2}h2{font-size:13px;margin:0 0 8px;display:flex;justify-content:space-between;align-items:center}h2 span{color:#70806c;font-size:10px;font-weight:normal}textarea{width:100%;height:192px;resize:vertical;border:1px solid #c5d5c9;border-radius:9px;padding:10px;background:#fff;color:#334b40;font-size:12px;line-height:1.6}p{font-size:11px;color:#71816e;margin:6px 0}.row{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.primary{background:#207360;color:#fff;border-color:#207360}.primary:hover{background:#165744}.presets button{font-size:12px;padding:7px 9px}label{display:flex;align-items:center;justify-content:space-between}input{accent-color:#207360;width:18px;height:18px}footer{padding:10px 18px;font-size:11px;color:#627960;min-height:38px}[hidden]{display:none!important}
  </style><button class="pill">AI 训狗器 (PromptLeash) · 打开</button><article class="panel" hidden><header><div><strong>AI 训狗器 (PromptLeash)</strong><small>把上下文带走，把回答拉回来。</small></div><button id="collapse" title="收起">−</button></header><section><h2>01 / 交接卡 <button id="extract">提取当前对话</button></h2><textarea aria-label="交接卡预览" placeholder="点击提取，生成可编辑的交接卡。"></textarea><div class="row"><button id="copy">复制</button><button id="carry" class="primary">带去新对话 ↗</button></div><p>只填入，不自动发送；请先检查再继续。</p></section><section><h2>02 / 一键纠偏 <span>让它重新对齐</span></h2><div class="row presets"></div></section><section><label><b>03 / 防废话模式</b><input id="concise" type="checkbox" role="switch"></label><p id="rulehint"></p></section><footer role="status">仅在本机处理 · 拖动标题可移动</footer></article>`;
  document.documentElement.append(host);
  new MutationObserver(() => {
    if (!host.isConnected && document.documentElement) document.documentElement.append(host);
  }).observe(document, {childList:true, subtree:true});
  const $ = s => shadow.querySelector(s);
  const notice = text => $('footer').textContent = text;
  const apply = () => {host.style.display = settings.showPanel ? '' : 'none'; $('#concise').checked = settings.concise; $('#rulehint').textContent = `先给结论 · ${settings.limit} 字以内 · 无寒暄`;};
  const guard = fn => async () => {try {await fn();} catch (e) {notice(e.message || '操作失败，请重试');}};
  $('.pill').onclick = () => {$('.panel').hidden = false; $('.pill').hidden = true; if (host.style.left) {const r = host.getBoundingClientRect(); move(r.left,r.top);}};
  $('#collapse').onclick = () => {$('.panel').hidden = true; $('.pill').hidden = false;};
  $('#extract').onclick = () => {$('textarea').value = extract(adapter.messages()); notice('已提取当前可见消息，请核对并编辑');};
  $('#copy').onclick = guard(async () => {
    if (!$('textarea').value.trim()) throw new Error('请先提取或填写交接卡');
    await navigator.clipboard.writeText($('textarea').value); notice('已复制');
  });
  $('#carry').onclick = guard(async () => {
    const text = $('textarea').value.trim(); if (!text) throw new Error('请先提取或填写交接卡');
    await chrome.storage.local.set({['pending_' + adapter.site]:{text:text.slice(0,20000), createdAt:Date.now()}});
    location.assign(adapter.newChat);
  });
  $('#concise').onchange = guard(async () => {
    settings.concise = $('#concise').checked;
    await chrome.storage.local.set({settings}); apply();
  });
  async function sendText(text) {
    if (busy) return;
    const composer = adapter.composer();
    if (!composer) throw new Error('未找到输入框，请先打开对话');
    if (adapter.read().trim()) throw new Error('输入框已有草稿，请先发送或清空，避免覆盖');
    adapter.insert(text);
    if (settings.fillOnly) {notice('已填入，请检查后自行发送'); return;}
    await dispatchSend();
  }
  async function dispatchSend() {
    busy = true;
    try {
      const composer = adapter.composer();
      if (!composer || !adapter.read().trim()) return;
      if (settings.concise) adapter.insert(appendRule(adapter.read(), settings.limit), true);
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const button = adapter.sendButton();
        if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
          replaying = true;
          try {button.click();} finally {replaying = false;}
          notice('已点击发送，请以对话中的消息为准'); return;
        }
      }
      notice('发送按钮暂不可用，内容已保留，请稍后手动发送');
    } finally {busy = false;}
  }
  const presets = {
    '偏题重来':'你刚才偏离了我的问题。请回到我最近一次提出的具体目标，忽略无关延伸，重新作答。若目标有歧义，先只问一个关键澄清问题。',
    '太长精简':'请把上一条回答压缩为不超过 150 字：保留结论、关键依据和必要操作，删除铺垫、重复和无关例子。不要解释你如何精简。',
    '直接给结果':'请直接给出我要求的最终结果或可用成品，不要开场白、过程预告或重复问题。仅在确有必要时补充一个关键限制。',
    '别瞎编':'请核查上一条回答，明确区分已知事实、推测和未知。删除没有依据的断言；不知道就说不知道，不要编造来源、数据或引用。',
    '按我的要求重做':'请重新阅读我之前提出的约束，逐项对齐后重做。保留我已确定的决策，严格遵守禁止事项；缺少必要信息时先问，不要自行改变要求。'
  };
  for (const [label, text] of Object.entries(presets)) {const button = document.createElement('button'); button.textContent = label; button.onclick = guard(() => sendText(text)); $('.presets').append(button);}
  document.addEventListener('keydown', event => {
    if (!settings.concise || event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.keyCode === 229) return;
    const composer = adapter.composer();
    if (!composer || !composer.contains(event.target) || !adapter.read().trim()) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!busy) dispatchSend().catch(e => notice(e.message));
  }, true);
  document.addEventListener('click', event => {
    if (replaying || !settings.concise) return;
    const button = adapter.sendButton();
    if (!button || !event.composedPath().includes(button) || !adapter.read().trim()) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!busy) dispatchSend().catch(e => notice(e.message));
  }, true);
  const clamp = (x,y) => ({x:Math.max(12,Math.min(x,innerWidth - host.getBoundingClientRect().width - 12)), y:Math.max(12,Math.min(y,innerHeight - host.getBoundingClientRect().height - 12))});
  const move = (x,y) => {const p = clamp(x,y); host.style.left = p.x+'px'; host.style.top = p.y+'px'; host.style.right = 'auto'; host.style.bottom = 'auto';};
  $('header').onpointerdown = e => {
    if (e.target.closest('button')) return;
    const rect = host.getBoundingClientRect(), dx = e.clientX-rect.left, dy = e.clientY-rect.top;
    const header = $('header'); header.setPointerCapture(e.pointerId);
    header.onpointermove = ev => move(ev.clientX-dx,ev.clientY-dy);
    header.onpointerup = () => {header.onpointermove = null; const r = host.getBoundingClientRect(); chrome.storage.local.set({position:{x:r.left,y:r.top}}).catch(() => {});};
  };
  window.addEventListener('resize', () => {const r = host.getBoundingClientRect(); move(r.left,r.top);});
  chrome.storage.onChanged.addListener((changes, area) => {if (area === 'local' && changes.settings) {settings = {...settings,...changes.settings.newValue}; apply();}});
  async function init() {
    const key = 'pending_' + adapter.site;
    const data = await chrome.storage.local.get(['settings','position',key]);
    settings = {...settings,...data.settings}; apply();
    if (data.position) move(data.position.x,data.position.y);
    const pending = data[key];
    if (!pending) return;
    if (typeof pending.text !== 'string' || !Number.isFinite(pending.createdAt) || Date.now()-pending.createdAt > 300000 || pending.createdAt > Date.now()) {await chrome.storage.local.remove(key);return;}
    if (location.pathname !== '/' && location.pathname !== '/new') return;
    // A same-origin Web Lock serializes consumption across tabs.
    await navigator.locks.request('promptleash-pending-'+adapter.site, async () => {
      const current = (await chrome.storage.local.get(key))[key];
      if (!current || current.createdAt !== pending.createdAt) return;
      for (let i = 0; i < 120; i++) {
        if (Date.now()-pending.createdAt > 300000) {await chrome.storage.local.remove(key); return;}
        const composer = adapter.composer();
        if (composer) {
          if (adapter.read().trim()) {notice('已有草稿，未覆盖；交接卡将在五分钟后过期'); return;}
          adapter.insert(pending.text); await chrome.storage.local.remove(key);
          $('.panel').hidden = false; $('.pill').hidden = true; $('textarea').value = pending.text;
          notice('交接卡已填入，尚未发送。请检查后发送。'); return;
        }
        await new Promise(r => setTimeout(r,500));
      }
      notice('输入框尚未就绪，交接卡已暂存；五分钟内刷新重试');
    });
  }
  init().catch(e => notice('初始化失败：'+e.message));
})();
