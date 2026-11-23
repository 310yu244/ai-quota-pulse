# AI 训狗器 (PromptLeash) 1.0.2 验证记录

## 支持与实测状态

**ChatGPT 与 Claude.ai 均已通过真实站点测试。Claude v1.0.1 已在已登录免费账户通过下列五项实测；v1.0.2 已在真实 claude.ai 复测通过：回复读取完整（包括带路径的句子）、请求句和「你来定」类句子不误收、弹窗无滚动条、扩展无报错。** Edge 未单独运行；ChatGPT 登录态 ProseMirror 未实测。v1.0.1 与 v1.0.2 的实站截图分别标注，不与隔离 fixture 混用。

早期 Claude 登录曾受阻，后续已在独立 Chrome 的已登录会话完成实测；早期阻塞不再代表当前验证状态。Claude 实测未观察到、也未绕过 Cloudflare / hCaptcha。

## Claude.ai 真实站点测试（v1.0.1）

依据用户提供的 `REPORT.md` 与真实截图整理；该报告来自 CDP 29300 的独立 Chrome，使用已登录免费账户，只加载 PromptLeash。13 个已解压扩展文件与 v1.0.1 交付 ZIP 逐字节一致，测试过程中未修改扩展实现。

三轮真实对话建立了本地待办事项命令行工具目标，确定使用 Python、数据保存为本地 JSON 文件，禁止第三方库及外网/API 调用。

| 实站项目 | 结果与证据 |
| --- | --- |
| 交接卡 | 通过：提取包含目标、两项决策、两项禁止事项；旧版同时误收了确认请求句，这是 v1.0.2 修复项。旧版 `01-extraction.png` 仅作问题证据，不作为修复后截图展示。 |
| 带去新对话 | 通过：同一标签页导航至 `/new`，输入框包含完整交接卡；未产生用户消息或生成请求，草稿保持未发送超过 65 秒。见 `screenshots/claude-new-chat-handoff.png`。 |
| 纠偏 | 通过：手动发送交接卡后，点击「直接给结果」实际发送预设，Claude 回复工具代码。见 `screenshots/claude-correction-reply.png`。 |
| 防废话 | 通过：Enter 与点击发送均恰好附加一次 `【回答要求】`；回复分别以「能。Python 标准库自带 json 模块」和「不需要。todo.py 只用了 Python 标准库」开头。原生弹窗切换开关并验证持久化。Enter 证据见 `screenshots/claude-concise-rule-reply.png`。 |
| 无扩展报错 | 通过：Chrome 扩展页 `manifestErrors: []`、`runtimeErrors: []`，监控的页面运行时异常为空。控制台四条 404 来自 Claude 自身 `/api/claude_code/organizations/[redacted-id]/user_settings`，非扩展错误。依据原报告的 `05-extension-errors.png` 与 `evidence.json` 记录。 |

## Claude.ai 真实站点复测（v1.0.2）

依据用户反馈「真实 claude.ai 复测全部通过」及提供的两张真实截图整理；本轮收尾仅复制证据、更新文档和打包，没有重新操作真实站点。该复测与下文单元测试、隔离 fixture 是不同来源的验证。

| 复测项目 | 结果与证据 |
| --- | --- |
| Claude 回复读取 | 通过：使用 `[data-testid="assistant-message"]`，优先读取 `.standard-markdown` 正文，保留整节点及旧选择器兜底。提取图显示助手「已确定：数据存放在本地 SQLite 数据库文件中……」确认完整进入交接卡，包括 `~/.ledger/ledger.db` 路径及后续 sqlite3、无需第三方库的说明。见 `screenshots/claude-handoff-extracted.png`。 |
| 误收请求句和委托决策句 | 通过：提取图保留目标「做一个本地记账命令行工具」及「不要用第三方库。」；「请先用一句话确认目标，暂时不要写代码」和「数据存哪里你来定，定好后用『已确定：……』开头告诉我」均未进入交接卡。助手实际确认照常收录。 |
| 弹窗无滚动条 | 通过：真实工具栏弹窗完整显示设置和页脚，无纵向滚动条。见 `screenshots/claude-popup.png`。隔离渲染另测得 375×600 内容高约 587.77px，360×600 e2e 断言无纵向溢出且页脚可见。 |
| 扩展无报错 | 通过：依据用户真实站点复测反馈；本轮提供的两张截图分别展示交接卡与弹窗，不把它们当作扩展错误页证据。 |

分句规则已修复：中文 `。！？` 和换行正常分句；英文 `. ! ?` 仅在后接空白或到结尾时分句，保留路径、文件名、版本号、URL 与小数中的点。配对反引号内不分句；未配对时忽略反引号重新分句。判断决策/禁止关键词前去掉『』、「」、“” 和双引号内的内容，输出仍保留原句；「你来定」「你决定」类委托句不作为决策。这些边界由单元测试覆盖，不声称每个边界都另有实站截图。

`screenshots/claude-handoff-extracted.png` 与 `screenshots/claude-popup.png` 为 v1.0.2 复测截图；新对话、纠偏、防废话三张仍为 v1.0.1 实站证据。

## ChatGPT 真实站点环境（v1.0.1）

Ubuntu、Chrome for Testing 156、Playwright 1.58.2。用独立用户目录和 `--load-extension` 加载 `/home/ubuntu/repos/promptleash`，通过 CDP 9224 驱动，不修改日常浏览器资料。已安装 Noto Sans SC。六张截图均已为 AI 训狗器 (PromptLeash) 1.0.1 在真实 ChatGPT 页面重新拍摄，非夹具、非合成画面；页面图为 1280×900，工具栏弹窗为整个 Chrome 窗口。本次仅更名，不包含已取消的新功能。

此次未登录 ChatGPT 使用新版 DOM：`textarea#mobile-composer-prompt`、`button[aria-label="Send message"]`、`[data-message-role=user/assistant]`。保留旧 ProseMirror 和测试 ID 选择器作为兼容回退。

## 真实多轮对话：咖啡店小红书文案

第一条用户消息：

> 目标：为独立咖啡店写一篇面向上班族的小红书文案，介绍午休放松体验。请只回复两个需要确认的问题：文案风格和标题方向。

模型真实回复了文案风格和标题方向的问题及选项。

第二条用户消息：

> 决定采用温暖日常口吻。选定标题为《给午休留一杯咖啡的时间》。不要编造价格。禁止夸大功效。请只回复一版 180 字左右的文案。

模型真实生成文案。点击「提取当前对话」后，**目标自动得到且未人工修改**：

> 为独立咖啡店写一篇面向上班族的小红书文案，介绍午休放松体验。

目标不再重复决策、禁令、回复格式指令或「目标：」标签。

### 交接卡原始提取验证

决策和禁令来自用户消息。助手仅在短消息中提供以「已确定 / 最终决定 / 我们已决定 / we decided」开头且不含问号的明确确认时计入；超过 500 字或 8 句的助手消息整条排除，避免生成文案污染约束。

- `chatgpt-handoff-extracted.png` 已在加载本次修复的真实 ChatGPT 页面重新拍摄，重新发送上述两条用户消息并取得助手回复，点击「提取当前对话」后直接截图：**目标、两条决策、两条禁令全部是原始自动结果，未人工编辑 textarea**。没有修改网站消息或伪造模型回复。
- 仅增大预览框显示高度以完整展示卡片，没有改变其文字。已删除旧的 raw 截图。
- 新对话直接带入本次原始自动提取卡片，未人工清理预览框。

点击「带去新对话」，新页面输入框出现卡片，用户消息数量为 0，未自动发送。截图中的面板完整显示原始卡片，站点输入框显示已带入的草稿。之后仅在站点输入框追加「补充已知信息：店里有木桌和窗边座位，主打手冲咖啡。请据此直接写一版完整文案。」并手动发送，模型生成文案后点击「太长精简」。真实用户气泡出现完整预设，真实答复保留标题、午休场景与手冲咖啡，正文精简。为避免遮住消息，利用面板自带拖动功能把胶囊移到左侧后截图。

开启防废话后，普通 Enter 发送：

```text
这篇文案的第一句怎么改得更自然？先给推荐句，再说一个理由。

【回答要求】先给结论，再给必要理由；不超过 300 字；不寒暄、不复述问题、不列无关选项。
```

用户气泡含完整规则。模型真实回答：

> 推荐改为：「午休时间不长，也想给自己留一点放松的时间。」
>
> 理由：更贴近上班族的日常感受，语气自然、不刻意煽情，也能顺势引出窗边座位和手冲咖啡的体验。

另拍面板全貌，03 / 防废话模式及开启开关完整可见，不裁掉底部。通过 `chrome.action.openPopup()` 打开实际工具栏弹窗，捕获 Chrome 窗口。未触碰任何人机验证挑战。

## 自动检查（v1.0.2，单元与隔离 fixture）

- `npm test`：17 个 node:test 用例通过，包含 Claude 真实三轮对话、SQLite 路径（有/无反引号）、版本号/域名/URL/小数/文件名分句、引号内关键词过滤、委托决策句、未配对反引号回退，以及原有目标清洗、明确确认、问号/长文排除、去重、长度限制和非法输入处理。
- `npm run test:e2e`：两站隔离夹具通过，覆盖提取、Enter/点击规则、Shift+Enter、预设发送/只填入、草稿保护、缺失输入框、交接只消费一次/过期/不自动发送、面板显隐及 DOM 重挂载；新增 Claude 真实 DOM 结构 fixture（隐藏标题、状态行、正文容器）、回复正文过滤、新旧选择器/整节点回退、重复节点及弹窗 600px 高度检查。**这些是本地隔离测试，不是 v1.0.2 实站复测。**
- 上述自动测试结果来自最后一轮代码修复检查；本轮仅更新文档和复制截图，未改运行代码，未重复运行这些测试。
- 本轮文档更新后重新运行 `npm run build`，输出为 `dist/promptleash-v1.0.2.zip`，包含扩展运行文件、本地图标、MIT 许可与 README，不包含浏览器资料、截图、测试、依赖或凭据。提交后从 `HEAD` 使用 `git archive` 生成完整已提交源码包 `dist/promptleash-source-v1.0.2.zip`，源码包本身不纳入提交。

## 截图

| 路径 | 内容 |
| --- | --- |
| `screenshots/chatgpt-handoff-extracted.png` | 本次真实文案对话的原始自动提取，textarea 无人工编辑 |
| `screenshots/chatgpt-new-chat-handoff.png` | 新对话完整交接卡，未发送 |
| `screenshots/chatgpt-correction-reply.png` | 「太长精简」实际发送及文案回复 |
| `screenshots/chatgpt-concise-rule-reply.png` | 实际发送的完整规则与短回复 |
| `screenshots/chatgpt-panel-concise-on.png` | 面板全部三部分，防废话开关已开启 |
| `screenshots/popup-toolbar.png` | 实际工具栏设置弹窗 |
| `screenshots/claude-new-chat-handoff.png` | v1.0.1 Claude 实站：完整交接卡带入 `/new`，未自动发送 |
| `screenshots/claude-correction-reply.png` | v1.0.1 Claude 实站：「直接给结果」发送及代码回复 |
| `screenshots/claude-concise-rule-reply.png` | v1.0.1 Claude 实站：Enter 发送规则及真实回复 |
| `screenshots/claude-handoff-extracted.png` | v1.0.2 Claude 实站复测：原始交接卡，完整 SQLite 路径，排除请求与委托决策句 |
| `screenshots/claude-popup.png` | v1.0.2 Claude 实站复测：真实工具栏弹窗，无滚动条 |

以上 ChatGPT 截图仍为 v1.0.1 实站证据。
