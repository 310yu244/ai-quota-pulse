(function (root) {
  const decision = /决定|确定|就用|采用|选定|定了|改成|we['’]ll use|let['’]s go with|decided/i;
  const prohibition = /不要|别|禁止|不能|不准|避免|千万别|don['’]t|never|avoid|must not/i;
  const confirmation = /^(?:已确定|最终决定|我们已决定|we decided\b)/i;
  const replyFormat = /^(?:请\s*)?(?:先\s*)?(?:只(?:需|要)?\s*(?:回复|回答|输出)|回复\s*[“"「『'‘]|用.{0,12}(?:句话|字|条|段)(?:回答|回复|总结|确认)|(?:please\s+)?(?:reply|respond|answer|output)\s+only\b)|^(?:请\s*(?:先\s*)?|先\s*)(?:确认|核对|复述|总结)/i;
  const split = (text, ignoreBackticks = false) => {
    const parts = [];
    let start = 0, ticks = 0;
    for (let i = 0; i < text.length; i++) {
      if (!ignoreBackticks && text[i] === '`') {
        let end = i + 1;
        while (text[end] === '`') end++;
        const count = end - i;
        if (!ticks) ticks = count;
        else if (ticks === count) ticks = 0;
        i = end - 1;
        continue;
      }
      if (!ticks && (text[i] === '\n' || /[。！？]/.test(text[i]) ||
          (/[.!?]/.test(text[i]) && (i + 1 === text.length || /\s/.test(text[i + 1]))))) {
        parts.push(text.slice(start, i + 1));
        start = i + 1;
      }
    }
    if (ticks) return split(text, true);
    parts.push(text.slice(start));
    return parts.map(s => s.trim()).filter(Boolean);
  };
  function extract(messages) {
    const safe = Array.isArray(messages) ? messages.filter(m => m && typeof m.text === 'string' && ['user', 'assistant'].includes(m.role)) : [];
    const users = safe.filter(m => m.role === 'user');
    const sentences = safe.flatMap(m => {
      const parts = split(m.text);
      if (m.role === 'user') return parts;
      if (m.text.length > 500 || parts.length > 8) return [];
      return parts.filter(s => confirmation.test(s) && !/[？?]/.test(s));
    });
    const pick = pattern => [...new Set(sentences.filter(s => {
      const unquoted = s.replace(/『[^』]*』|「[^」]*」|“[^”]*”|"[^"]*"/g, '');
      return !replyFormat.test(s) && pattern.test(unquoted) &&
        (pattern !== decision || !/你\s*(?:来\s*定|决定)/.test(unquoted));
    }))].slice(-8).map(s => s.slice(0, 300));
    const goals = [...new Set(users.slice(0, 2).flatMap(m => split(m.text))
      .map(s => s.replace(/^(?:目标\s*[:：]|goal\s*:)\s*/i, '').trim())
      .filter(s => s && !decision.test(s) && !prohibition.test(s) && !replyFormat.test(s)))].join('\n').slice(0, 400);
    return `【交接卡】\n\n目标\n${goals || '（暂无用户消息或未识别到目标，请补充目标）'}\n\n已定决策\n${pick(decision).join('\n') || '（未识别到，请手动补充）'}\n\n禁止事项\n${pick(prohibition).join('\n') || '（未识别到，请手动补充）'}\n\n请沿用以上上下文继续；不确定的地方先问我。`;
  }
  function rule(limit) {
    const n = Math.min(5000, Math.max(50, Number.parseInt(limit, 10) || 300));
    return `【回答要求】先给结论，再给必要理由；不超过 ${n} 字；不寒暄、不复述问题、不列无关选项。`;
  }
  function appendRule(text, limit) { return text.includes('【回答要求】') ? text : `${text.trimEnd()}\n\n${rule(limit)}`; }
  const api = {extract, rule, appendRule};
  if (typeof module !== 'undefined') module.exports = api;
  else root.PromptLeashExtract = api;
})(globalThis);
