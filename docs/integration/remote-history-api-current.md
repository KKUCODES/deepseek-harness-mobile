# 插件历史读取的失败兼容

- 状态：实现与下列验收完成，纳入preview.14/code22；公开包结果见[发行核验](../releases.md#已核验范围)。
- 维护：手机端维护者；核验日期：2026-10-26；任务：[KKC-107](https://linear.app/kkcodes/issue/KKC-107)。
- 原因：[断层用例与公开接口诊断](./remote-history-gap-diagnosis.md)。只修改手机端，不改DSH本体、不合入旧插件适配分支。

## 接口边界

[RemoteHistoryWindow](../../src/remote-history-window.mjs)将两类方法分开：

| 调用入口 | 失败行为 |
| --- | --- |
| 插件公开`Session.loadOlder()`及转发它的`conversation.loadOlder()` | 分页失败仍完成Promise，保持官方行为；不是将坏页合并或认定读取成功 |
| 插件公开`Session.loadThrough()` | 官方同样内部处理读取失败，本次一并保持该行为 |
| 手机内部`history.older()`、`history.through()`及`page()` | 继续严格拒绝坏页；发布友好错误、清除加载标记、保留原窗口及重试能力 |
| 手机历史按钮/触顶、后台输出、阅读位置恢复 | 沿用内部严格入口及原来的捕获/提示逻辑，不根据公开Promise完成与否猜测分页成功 |

实现仅在Session代理边界增加两个稳定的公开适配方法，复用现有严格分页器。没有修改连续性校验、窗口预算、读取cut、授权或数据持久化；没有清空记录、跳过缺失序号或改写DSH服务。没有把严格方法本身改成不报错，因为这会让手机入口失去失败信号。

官方依据为只读[rc.2 Session](../../artifacts/rc21/source/packages/api/session-controller/src/client/sessions/session.ts)、[alpha.2 Session](../../artifacts/official-alpha2-source/packages/api/session-controller/src/client/sessions/session.ts)的`loadOlder/loadThrough`捕获行为，以及[Conversation转发](../../artifacts/rc21/source/packages/client/ui-conversation/src/client/service.ts)。对原始错误不新增正文/凭据日志，用户仍从已有history状态看到友好提示。

## 回归入口

- [窗口单测](../../tests/remote-history-window.test.mjs)：先复现公开loadOlder/loadThrough两项失败，再验证载体拒绝、抛错、断层均不向插件抛出；原窗口、控制投影、待发送回执、错误状态和重试保留。独立断言内部严格读取仍抛断层错误。
- [接口回归](../../scripts/check-remote-history-contract.mjs)：实际RemoteModel/Workspace和Conversation/Session服务，使用既有合成电脑协议；插件按钮通过真实React事件调用公开服务并忽略Promise，验证无新增未处理异常；同时覆盖手机按钮、严格入口、公开loadThrough和有效页重试。
- [既有全量脚本](../../scripts/verify-remote-plugin-slots.mjs)：断层负面用例在创建Promise时立即接失败处理，并明确断言公开调用完成和原错误提示/重试入口，而非裸await造成Node提前退出。
- 专项命令`node scripts/verify-remote-plugin-slots.mjs --history-contracts`使用官方rc.2；追加`--official-alpha2`使用官方alpha.2。默认无参数全量脚本仍是旧测试基线，不能冒充两个新SDK的完整验收。

这两版指当前已支持的`0.2.1-rc.2`与`0.2.1-alpha.2`，不是任意未来版本。独立手机版首页API没有新增电脑Session权限。

## 验证记录

| 范围 | 结果 |
| --- | --- |
| 修复前 | 新增的公开loadOlder/loadThrough单测均因`remote failed`拒绝而失败 |
| Node全量 | 596项通过 |
| rc.2接口专项 | 六类调用通过：插件await时载体失败/断层、真实插件按钮忽略Promise、内部严格拒绝、手机按钮、公开loadThrough；各次错误后有效页重试成功，无页面异常 |
| alpha.2接口专项 | 同上，六类调用通过 |
| 正式手机网页构建 | 官方rc.2 CI构建通过，保留原翻译重复键警告 |
| 既有全量插槽脚本 | 旧测试基线全量通过，零页面异常；包含原断层/空页/后台输出重试与草稿验证。此前另一个过时配对页标题断言改为明确的待批准状态标记，没有修改产品页面 |
| 两SDK连续24批长聊天 | rc.2/alpha.2各24批通过：自动加载、单批在途、锚点偏差0px、120条查阅事件/5组、约1042～1058个DOM元素；实时/较新记录、失败重试、审批/草稿/插件状态、重连和渲染恢复保持，旁栏4次自动加载通过 |

专项记录位于本地忽略目录`artifacts/tests/history-interface/`及`artifacts/history-contract-*.json`。页面测试复用实际产品组件与官方SDK，数据为合成协议，不冒充真实用户会话、真实电脑连接或Android验证。本轮未重新打包安装MuMu；其现装code21不包含本轮新修复。
