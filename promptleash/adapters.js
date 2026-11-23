(() => {
  const definitions = {
    chatgpt: {
      composer: ['#prompt-textarea[contenteditable="true"]', '[contenteditable="true"][data-lexical-editor="true"]', 'textarea#mobile-composer-prompt', 'textarea#prompt-textarea'],
      send: ['[data-testid="send-button"]', 'button[aria-label="Send prompt"]', 'button[aria-label="发送提示"]', 'button[aria-label="Send message"]', 'button[aria-label="发送消息"]'],
      messages: ['[data-message-author-role]', '[data-message-role]'],
      role: el => el.dataset.messageAuthorRole || el.dataset.messageRole,
      text: el => (el.querySelector('.markdown, .whitespace-pre-wrap, [data-user-message-bubble], [data-assistant-message-content]') || el).innerText,
      newChat: 'https://chatgpt.com/'
    },
    claude: {
      composer: ['div.ProseMirror[contenteditable="true"]', '[contenteditable="true"][role="textbox"]'],
      send: ['button[aria-label="Send message"]', 'button[aria-label="发送消息"]', 'button[aria-label="Send Message"]', 'button[aria-label="发送信息"]', 'button[data-testid="send-button"]'],
      messages: ['[data-testid="user-message"]', '[data-testid="assistant-message"]', '.font-claude-response'],
      role: el => el.matches('[data-testid="user-message"]') ? 'user' : 'assistant',
      text: el => (el.querySelector('.standard-markdown') || el).innerText,
      newChat: 'https://claude.ai/new'
    }
  };
  const site = location.hostname === 'claude.ai' ? 'claude' : 'chatgpt';
  const config = definitions[site];
  const visible = el => el && el.getClientRects().length > 0;
  const find = selectors => selectors.flatMap(s => [...document.querySelectorAll(s)]).find(visible);
  globalThis.PromptLeashAdapter = {
    site,
    newChat: config.newChat,
    composer: () => find(config.composer),
    read: () => {const el = find(config.composer); return el ? ('value' in el ? el.value : el.innerText) : '';},
    sendButton: () => find(config.send),
    messages: () => [...document.querySelectorAll(config.messages.join(', '))].filter(visible).map(el => ({role:config.role(el), text:config.text(el)})),
    insert(text, replace = false) {
      const el = this.composer();
      if (!el) throw new Error('未找到输入框，请先打开可发送消息的对话。');
      el.focus();
      if (el instanceof HTMLTextAreaElement) {
        el.setSelectionRange(replace ? 0 : el.value.length, el.value.length);
        if (!document.execCommand('insertText', false, text)) throw new Error('写入失败，请手动粘贴。');
        return el;
      }
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      if (!replace) range.collapse(false);
      selection.removeAllRanges(); selection.addRange(range);
      if (!document.execCommand('insertText', false, text)) throw new Error('写入失败，请手动粘贴。');
      return el;
    }
  };
})();
