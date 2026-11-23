const {test} = require('node:test');
const assert = require('node:assert/strict');
const {extract, appendRule, rule} = require('../extract.js');
test('中英文目标、决策与禁令去重提取', () => {
  const card = extract([{role:'user',text:'做一个离线记账本。决定采用 CSV。不要联网。'}, {role:'assistant',text:'We decided to use local storage. 已确定不要上传数据。'}, {role:'user',text:'不要联网。'}]);
  assert.match(card,/目标\n做一个离线记账本/); assert.match(card,/已定决策\n决定采用 CSV。/); assert.match(card,/We decided to use local storage/); assert.match(card,/禁止事项\n不要联网。\n已确定不要上传数据/);
});
test('空输入和畸形消息安全降级', () => {
  for (const input of [null, [], [{role:'system',text:'决定采用错误数据'},null,{role:'user',text:42}]]) {
    assert.match(extract(input),/暂无用户消息/); assert.match(extract(input),/未识别到/); assert.doesNotMatch(extract(input),/错误数据/);
  }
});
test('提取有长度上限', () => {assert.ok(extract([{role:'user',text:'a'.repeat(100000)}]).length < 1000);});
test('Claude 真实三轮对话排除确认请求，保留目标、决策和禁止事项', () => {
  const card = extract([
    {role:'user',text:'目标：做一个本地待办事项命令行工具。\n请先用一句话确认目标，暂时不要写代码。'},
    {role:'assistant',text:'确认目标：做一个在本地运行、通过命令行增删改查待办事项的小工具，数据保存在本机文件里，不依赖网络或账号。'},
    {role:'user',text:'已确定：用 Python。\n已确定：数据保存为本地 JSON 文件。\n请用一句话确认这两项决定，暂时不要写代码。'},
    {role:'assistant',text:'确认：这个待办事项命令行工具用 Python 实现，数据以本地 JSON 文件的形式保存。'},
    {role:'user',text:'不要用第三方库。\n不要联网或调用任何外部 API。\n请用一句话确认这两项限制，暂时不要写代码。'},
    {role:'assistant',text:'确认：这个工具只使用 Python 标准库，不引入任何第三方库，也不联网、不调用任何外部 API。'}
  ]);
  assert.match(card,/目标\n做一个本地待办事项命令行工具。\n\n/);
  assert.match(card,/已定决策\n已确定：用 Python。\n已确定：数据保存为本地 JSON 文件。\n\n/);
  assert.match(card,/禁止事项\n不要用第三方库。\n不要联网或调用任何外部 API。\n\n/);
  assert.doesNotMatch(card,/暂时不要写代码|请用一句话|请先用一句话/);
});
test('仅有流程请求时约束为空，直接约束与助手明确确认不被过滤', () => {
  for (const text of ['请用一句话确认这两项决定，暂时不要写代码。','请先用一句话确认目标，暂时不要写代码。','请先确认这两项决定，暂时不要写代码。']) {
    const card = extract([{role:'user',text}]);
    assert.match(card,/已定决策\n（未识别到/);
    assert.match(card,/禁止事项\n（未识别到/);
  }
  const card = extract([{role:'user',text:'请不要联网。'}, {role:'assistant',text:'已确定：用 Python。'}]);
  assert.match(card,/已定决策\n已确定：用 Python。/);
  assert.match(card,/禁止事项\n请不要联网。/);
});
const goalOf = card => card.split('目标\n')[1].split('\n\n已定决策')[0];
test('Claude SQLite 确认保留完整路径，兼容有无反引号', () => {
  for (const path of ['`~/.ledger/ledger.db`', '~/.ledger/ledger.db']) {
    const text = `已确定：数据存放在本地 SQLite 数据库文件中，路径为用户主目录下的 ${path}，通过 Python 标准库自带的 sqlite3 模块读写，不需要任何第三方库。`;
    const card = extract([{role:'assistant',text}]);
    assert.equal(card.split('已定决策\n')[1].split('\n\n禁止事项')[0], text);
  }
});
test('英文句末断句，保留版本、域名、URL、小数与文件名中的点', () => {
  const card = extract([{role:'assistant',text:'We decided to use v1.2.3 at example.com. Next sentence.'}]);
  assert.equal(card.split('已定决策\n')[1].split('\n\n禁止事项')[0], 'We decided to use v1.2.3 at example.com.');
  assert.equal(goalOf(extract([{role:'user',text:'Read https://example.com/a.db at 1.25! Done? Yes.'}])), 'Read https://example.com/a.db at 1.25!\nDone?\nYes.');
  assert.equal(goalOf(extract([{role:'user',text:'a!b?c.d。下一句！再一句？最后\n结束'}])), 'a!b?c.d。\n下一句！\n再一句？\n最后\n结束');
});
test('反引号内的中英文标点及换行不断句', () => {
  for (const ticks of ['`', '``']) {
    const code = `${ticks}a. b! c? 中文。！？\nnext${ticks}`;
    assert.equal(goalOf(extract([{role:'user',text:`Read ${code}. Next.`}])), `Read ${code}.\nNext.`);
  }
});
test('未配对反引号回退为忽略反引号重新分句', () => {
  for (const ticks of ['`', '``']) {
    const card = extract([{role:'user',text:`Read \`a. b\`. Then ${ticks}unfinished。决定采用 SQLite。不要用第三方库。`}]);
    assert.equal(goalOf(card), `Read \`a.\nb\`.\nThen ${ticks}unfinished。`);
    assert.equal(card.split('已定决策\n')[1].split('\n\n禁止事项')[0], '决定采用 SQLite。');
    assert.equal(card.split('禁止事项\n')[1].split('\n\n请沿用')[0], '不要用第三方库。');
  }
});
test('决策与禁止关键词忽略引号内内容，保留原句输出', () => {
  for (const [open, close] of [['『','』'], ['「','」'], ['“','”'], ['"','"']]) {
    const card = extract([{role:'user',text:`数据存哪里你来定，定好后用${open}已确定：……${close}开头告诉我。示例为${open}不要联网${close}。`}]);
    assert.match(card,/已定决策\n（未识别到/);
    assert.match(card,/禁止事项\n（未识别到/);
    const decisionText = `已确定：使用${open}SQLite${close}。`;
    const prohibitionText = `不要用${open}第三方库${close}。`;
    const kept = extract([{role:'user',text:decisionText + prohibitionText}]);
    assert.equal(kept.split('已定决策\n')[1].split('\n\n禁止事项')[0], decisionText);
    assert.equal(kept.split('禁止事项\n')[1].split('\n\n请沿用')[0], prohibitionText);
  }
});
test('委托 AI 决定不作决策，助手明确确认和直接禁令照常提取', () => {
  for (const text of ['数据存哪里你来定，定好后用『已确定：……』开头告诉我。', '数据存哪里你决定。', '你来定采用哪种数据库。']) {
    const confirmation = '已确定：数据存放在本地 SQLite 数据库文件中，路径为用户主目录下的 ~/.ledger/ledger.db，通过 Python 标准库自带的 sqlite3 模块读写，不需要任何第三方库。';
    const card = extract([{role:'user',text}, {role:'assistant',text:confirmation}, {role:'user',text:'不要用第三方库。'}]);
    assert.equal(card.split('已定决策\n')[1].split('\n\n禁止事项')[0], confirmation);
    assert.equal(card.split('禁止事项\n')[1].split('\n\n请沿用')[0], '不要用第三方库。');
  }
});
test('咖啡店对话只提取用户决策禁令，不收录助手问句和文案', () => {
  const card = extract([
    {role:'user',text:'目标：为独立咖啡店写一篇面向上班族的小红书文案，介绍午休放松体验。请只回复两个需要确认的问题：文案风格和标题方向。'},
    {role:'assistant',text:'文案风格：你希望采用哪种风格?\n标题方向：你希望突出什么？'},
    {role:'user',text:'决定采用温暖日常口吻。选定标题为《给午休留一杯咖啡的时间》。不要编造价格。禁止夸大功效。请只回复一版 180 字左右的文案。'},
    {role:'assistant',text:'给午休留一杯咖啡的时间\n忙碌了一上午，午休也给自己一点放松的时间吧。\n不用赶时间，暂时放下工作，享受片刻宁静。\n工作再忙，也别忘了好好照顾自己。'}
  ]);
  assert.equal(card.split('已定决策\n')[1].split('\n\n禁止事项')[0], '决定采用温暖日常口吻。\n选定标题为《给午休留一杯咖啡的时间》。');
  assert.equal(card.split('禁止事项\n')[1].split('\n\n请沿用')[0], '不要编造价格。\n禁止夸大功效。');
  assert.equal(goalOf(card),'为独立咖啡店写一篇面向上班族的小红书文案，介绍午休放松体验。');
});
test('助手仅接受简短明确确认，排除问句、普通建议和长篇文案', () => {
  for (const text of ['已确定采用 CSV？','We decided to use CSV?','采用 CSV。不要联网。',"We'll use CSV. Never upload data.",'示例：最终决定采用 CSV。','最终决定采用 CSV。'+'文案'.repeat(300),'最终决定采用 CSV。'+'文案。'.repeat(9)]) {
    const card = extract([{role:'assistant',text}]);
    assert.match(card,/已定决策\n（未识别到/);
    assert.match(card,/禁止事项\n（未识别到/);
  }
  const card = extract([{role:'assistant',text:'最终决定采用 CSV。已确定禁止云同步。We decided to avoid tracking.'}]);
  assert.match(card,/最终决定采用 CSV。/);
  assert.match(card,/禁止事项\n已确定禁止云同步。\nWe decided to avoid tracking./);
});
test('目标剔除决策、禁令、回复元指令，去标签并去重', () => {
  const card = extract([
    {role:'user',text:'目标：离线记账。决定采用 CSV。不要联网。请只回复“收到”。'},
    {role:'assistant',text:'收到。'},
    {role:'user',text:'离线记账。确定只做新增。禁止云同步。回复“收到”。'}
  ]);
  assert.equal(goalOf(card),'离线记账。');
  assert.match(card,/已定决策\n决定采用 CSV。\n确定只做新增。/);
  assert.match(card,/禁止事项\n不要联网。\n禁止云同步。/);
});
test('英文和多句目标，纯格式指令不作为目标', () => {
  const card = extract([{role:'user',text:'Goal: Build an offline budget app. Track monthly expenses. We decided to use CSV. Never upload data. Please reply only "OK".'}, {role:'user',text:'Build an offline budget app. Reply only with JSON.'}]);
  assert.equal(goalOf(card),'Build an offline budget app.\nTrack monthly expenses.');
  for (const text of ['请只回复“收到”。','回复“收到”。','只需回答好的。','请用一句话确认。','Reply only OK.','决定采用 CSV。不要联网。']) {
    assert.match(goalOf(extract([{role:'user',text}])),/未识别到目标/);
  }
});
test('目标保留有意义的回复任务，总长最多 400 字', () => {
  assert.equal(goalOf(extract([{role:'user',text:'帮我回复客户的退款邮件。'}])),'帮我回复客户的退款邮件。');
  assert.equal(goalOf(extract([{role:'user',text:'目标：'+'长'.repeat(1000)}])).length,400);
});
test('规则追加一次；默认、非法与越界上限', () => {
  assert.match(appendRule('你好',300),/你好\n\n【回答要求】/);
  assert.equal(appendRule(appendRule('你好',300),300),appendRule('你好',300));
  assert.match(rule('bad'),/300 字/); assert.match(rule(-1),/50 字/); assert.match(rule(999999),/5000 字/);
});
