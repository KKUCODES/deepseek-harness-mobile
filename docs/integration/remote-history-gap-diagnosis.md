# 历史断层用例与插件分页接口诊断

后续实现及验收见[插件历史读取失败兼容](./remote-history-api-current.md)。下文保留修复前的诊断和当时状态。

- 状态：诊断完成，修复尚未实施；本轮不改产品或已有测试脚本。
- 维护：手机端维护者；核验日期：2026-10-26。
- 任务：[KKC-106](https://linear.app/kkcodes/issue/KKC-106)；关联[主题验收KKC-105](https://linear.app/kkcodes/issue/KKC-105)。

## 结论

本次全量脚本退出有两个层次：测试没有正确处理负面场景的Promise拒绝；DSHM公开给插件的`loadOlder()`也确实与官方失败行为不同。不能只归为脚本错误，但它不是已证明的正常长聊天白屏或有效分页被拒绝。

普通手机历史按钮/触顶自动加载经过既有错误处理，断层时保留原记录、草稿和重试入口。当前两版SDK的正常长聊天连续24批回放均通过。未取得反馈用户的真实会话，本轮没有验证全部真机或任意第三方插件，不能据此保证所有长聊天均无缺陷。

## 失败链路

1. 既有[测试夹具](../../tests/fixtures/remote-plugin-slots.jsx)启用`historyTesting`，初始仅持有序号10，仍有更早历史。
2. [全量脚本](../../scripts/verify-remote-plugin-slots.mjs)503–506附近直接调用真实`conversation.loadOlder()`，然后注入仅有序号5的旧页，缺少6～9。这是主动构造的断层，并非用户服务器真实返回。
3. [载体校验](../../src/remote-core.mjs)调用[相邻页校验](../../src/remote-history-page.mjs)：旧页最后序号加1必须等于`beforeSeq=10`，5不满足，正确拒绝；该错误包装为`RemoteError`返回。
4. [有界窗口](https://github.com/KKUCODES/deepseek-harness-mobile/blob/v0.1.0-preview.14/src/remote-history-window.mjs)保存友好错误并在finally清除加载状态，保持原窗口和`hasMore`，同时重新抛出失败。
5. 窗口对Session代理的`loadOlder`直接返回内部`older`，因此真实Conversation服务也会收到拒绝。脚本没有在发起Promise时立即挂失败处理，也没有期望拒绝的断言；Node默认未处理拒绝策略在脚本之后等待之前即可终止进程。

即使调整监听时机，后面的裸`await pluginHistory`仍会让原脚本进入失败路径，不能把它当成预期错误的成功断言。复现原命令确实以退出码1终止；这也解释了为什么没有生成完整的成功报告。

相关窗口、载体、分页校验和会话装饰文件与当前HEAD `be6bf87`无差异；HEAD中的旧全量脚本也已有同一负面注入/裸await。不是本次主题或图标修复新引入的分页逻辑。

## 真实兼容性差异

官方[rc.2 Session](../../artifacts/rc21/source/packages/api/session-controller/src/client/sessions/session.ts)与[alpha.2 Session](../../artifacts/official-alpha2-source/packages/api/session-controller/src/client/sessions/session.ts)的`loadOlder()`均在内部捕获分页失败并清除加载标记；[Conversation服务](../../artifacts/rc21/source/packages/client/ui-conversation/src/client/service.ts)只是转发此方法。官方聊天实现也存在不等待返回Promise的调用方式。

DSHM用严格历史窗口方法直接代替这个公共方法，导致同一个失败从“内部处理”变成“向插件抛出”。用相同载体和断层页比较原Session与手机代理，原方法完成、手机代理拒绝。它们的差异不是类型签名不一致，而是运行时失败行为不同。

模拟插件忽略Promise时，三个测试基线均触发浏览器`unhandledrejection`。当前测试中页面、草稿和记录仍保留，手机按钮仍可重试；未复现白屏。具体第三方插件若有自己的全局错误处理，影响范围尚未验证，不能保证只有控制台提示。

## 独立验证

所有诊断在忽略的`artifacts/tests/history-gap-diagnosis/`中完成，复用既有生成页面或既有构建配置，仅隔离浏览器载体和合成协议。没有编辑既有产品/测试源文件，没有连接真实服务器、操控MuMu、调用模型或读取凭据。

| 验证 | 结果 |
| --- | --- |
| 原全量命令 | 相同断层错误、退出码1复现；默认旧测试基线，不把它冒充当前APK |
| 默认基线/官方rc.2/官方alpha.2独立探测 | 三者行为一致，排除仅旧基线触发 |
| 插件API立即接失败 | 拒绝断层；窗口仍为`[10]`，加载结束、可重试、绑定与草稿不变，无未处理拒绝 |
| 实际手机历史按钮 | 友好错误出现；窗口/草稿保留，无未处理拒绝 |
| 只改变合成页末条5→9 | 边界连续后可重试成功，窗口`[9,10]`、错误清除；用于隔离相邻校验，不冒充完整真实会话 |
| 插件不接返回Promise | 出现一次未处理拒绝，但页面仍在且手机重试可恢复 |
| 原SDK Session比较 | 同一断层页时原方法内部处理后完成，手机代理向外拒绝 |
| rc.2正常长聊天 | 连续24批自动加载，120条查阅事件/5个组，DOM约1042～1058，锚点偏差0px；同步/审批/插件/草稿/重连及恢复检查通过 |
| alpha.2正常长聊天 | 同上，连续24批和旁栏4次自动加载通过，无页面错误 |
| 有界窗口/自动加载单测 | 窗口10项、自动加载4项，共14项通过 |

产物：`original.log`、`default/diagnosis.json`、`rc2/diagnosis.json`、`alpha2/diagnosis.json`、`continuous-rc2.log`、`continuous-alpha2.log`、`targeted-node.log`。一次性诊断入口`probe.mjs`在该忽略目录内，浏览器与HTTP服务结束均已关闭；生成构建仅在产物中使用现有配置。

## 待修复建议（本轮未实施）

| 方案 | 成本与后果 |
| --- | --- |
| 只给测试接住拒绝 | 成本低，可检查坏页状态，但插件与官方错误行为差异仍在，不足以完整解决 |
| 公共接口保持官方失败行为，内部严格分页继续报错 | 建议方案。手机自身入口继续显示错误/重试，插件不会多收到官方不存在的未处理拒绝；测试同时验证两条契约 |

后续应保留连续性校验、窗口预算和错误状态，不能通过跳过6～9、关闭校验、清除历史或把所有异常静默吞掉使测试变绿。应覆盖插件公共API、手机按钮/触顶、坏页后有效页恢复、草稿/绑定/审批及两SDK；测试在创建Promise时就接好预期失败，避免Node提前终止。`loadThrough`等其他代理方法的失败契约应在修复时一起核对，本轮没有宣称已验证它们。
