# Remote 自动审核实际执行

固定新版发布及实际源码入口的[审核取消、历史、续聊和权限恢复](./latest-auto-review.md)已通过，原明确取消误记失败的问题已作窄范围修复；新版拒绝/放行、新源码组合最终恢复及完整范围仍待验。下列旧版记录不替代新版证据。

- 状态：实际低风险放行、审核中取消、受控待审请求的真实模型拒绝及手机拒绝提示/续聊已验证。具体证据与限制如下。
- 维护角色：项目协作 Agent；核验日期：2026-09-28（香港时间）。
- 来源：原[自动审核说明](../../../deepseek-harness/packages/experimental/auto-review/README.zh.md)、原[审核实现](../../../deepseek-harness/packages/experimental/auto-review/src/index.ts)、手机[选择器](../../src/ui/RemotePermissions.jsx)及[原目录适配](../../src/remote-permissions.mjs)。

## 实际边界

### 真实审核拒绝与手机续聊（2026-10-01）

[专用夹具](../../tests/fixtures/live-auto-deny/index.js)创建自己的唯一测试文件和DSH-TEST会话，再向原Tools/AutoReview提交受控删除请求；会话历史明确禁止删除。请求事件由夹具创建并在聊天中明确标注，**不是聊天模型自主发起的工具调用**；审核由当前真实模型执行，观察器原样透传，不伪造决定。工具体只允许删除此夹具创建的精确文件，不能接受其他路径，不访问业务文件。

14:01 UTC[Host报告](../../artifacts/auto-deny-host.json)确认真实审核risk=medium、decision=deny、AUTO_REVIEW_DENIED、bodyCalls=0、filePreserved=true；[Android脚本](../../scripts/verify-auto-deny-android.mjs)从正式列表进入、展开原工具卡片，中文显示Auto review已拒绝，没有停止按钮残留，再发送无工具消息并获得实际回复，归档后返回原聊天。见[报告](../../artifacts/auto-deny-android.json)及已核对的[截图](../../artifacts/auto-deny-android.png)。本次补齐真实审核模型拒绝结果到手机展示和续聊，不外推所有风险类型或自动审核策略正确性。

首轮真实拒绝已经发生，但夹具漏将result.error.info保存到tool/result事件，界面退化为英文普通错误；[首轮Host](../../artifacts/auto-deny-first-host.json)、[首轮手机报告](../../artifacts/auto-deny-first-android.json)与[截图](../../artifacts/auto-deny-first-android.png)保留，不能当作专用拒绝提示通过。按原[appendToolResult](../../../deepseek-harness/packages/core/agent-loop/src/tool-calls.ts)修正夹具后重新创建测试会话、再次审核通过，未修改生产代码或APK。

两次会话均已归档并恢复read-only，测试文件均在卸载清理时删除；最终Host cleaned=true。首次卸载遭Windows锁文件rename EPERM，保留[日志](../../artifacts/auto-deny-remove.log)，正常CLI重试成功，未强删锁或改用户配置。临时AutoReview随夹具卸载，日常设备active/management=false；正常DSH进程72272继续运行。

### 手机取消提示与共享入口（2026-09-28）

手机现在依据持久工具结果的明确错误码区分两种状态：`ABORTED_BEFORE_DISPATCH` 显示“已取消，工具尚未执行”，`ABORTED`/`interrupted` 显示“工具调用已停止”。执行中停止不承诺撤销已有副作用。仅过滤原运行时两条固定取消诊断，其他部分输出与附件记录保留；不根据正文猜测取消，不重写原历史。

[共享适配器](../../src/remote-tool-cancellation.jsx)仅包装原 ui-tool 的 tool-call 树，在明确取消时使用原 ToolRow；其他工具视图、真正的失败和 Auto 拒绝继续交给原插件。主聊天、旁栏及嵌套调用共用；没有原插件时，[备用消息渲染](../../src/ui/RemoteMessage.jsx)使用同一[状态与内容规则](../../src/remote-tool-row.mjs)。

| 入口 | 本次证据与范围 |
| --- | --- |
| 主聊天原插件及备用详情 | [生产页面用例](../../scripts/check-tool-cancellation.mjs)覆盖执行前/执行中、英文切换、嵌套调用、部分输出保留、真正拒绝与相同英文正文的普通错误不误分类。[首次完整页面回归](../../artifacts/tool-cancellation-full-web.log)及[包含旁栏新增用例的完整回归](../../artifacts/tool-cancellation-with-sidebar-full-web.log)通过，控制台错误为空。 |
| 旁栏原插件及备用详情 | [新增专项](../../artifacts/tool-cancellation-sidebar-web.log)通过，子会话显示两种取消，主聊天选择仍为 one。属于隔离协议回放，不是实际手机旁栏工具执行。首轮[失败记录](../../artifacts/tool-cancellation-sidebar-cursor-failure.log)保留：测试夹具误用主聊天游标，引发缺页请求；改为独立空子会话游标后通过，未改生产分页逻辑。 |
| Android 实际历史 | [首次18:14 UTC报告](../../artifacts/tool-cancellation-first-android.json)及[18:22 UTC当前复验](../../artifacts/tool-cancellation-current-android.json)通过，读取此前真实审核取消的已归档会话：停止行及展开详情均显示中文，无 Auto 拒绝或原英文取消错误。[截图](../../artifacts/tool-cancellation-current-android.png)记录展开内容；返回原联调聊天、清除归档筛选且草稿一致。未新发模型请求或授予管理权限。 |
| 构建与底层回归 | [9项工具回归](../../artifacts/tool-cancellation-unit.log)、[Web构建](../../artifacts/tool-cancellation-web-build.log)、[Android构建及lint](../../artifacts/tool-cancellation-android-build.log)通过，新APK已覆盖安装MuMu。后续旁栏增量只改测试夹具与用例，无需重建相同产品代码。 |

[Android驱动](../../scripts/verify-tool-cancellation-android.mjs)首轮以聊天详情作为启动前提，但安装后处于Remote首页；[原失败](../../artifacts/tool-cancellation-home-first-failure.json)保留，补齐从首页进入指定联调会话后通过。此专项不替代真实审核拒绝、PTC或子会话执行验收。下文“无新APK”“中文待修正”仅描述此前电脑补丁阶段，已由本节手机更新接续。

### 审核途中取消与错误分类（2026-09-28）

17:52 UTC手机在真实DeepSeek审核流启动后停止；[原版报告](../../artifacts/auto-review-cancel-before/auto-review-cancel-cancel-android.json)记录signal aborted、finish aborted、ended且下游调用0，文件未变，下一条消息实际回复DSHM_AFTER_CANCEL_OK。但[原版截图](../../artifacts/auto-review-cancel-before/auto-review-cancel-android.png)显示“Auto review 已拒绝”，不能当成真实模型拒绝验收。

核对原源码及测试后新增[电脑兼容补丁](../../../plugin/compatibility/auto-review-cancel/README.md)：审核及下游guard返回均检查调用者取消，取消走原cancel，未取消的拒绝/故障保持拒绝。安装两文件并恢复正常源码启动PID44312；无Key、网关或APK变化。

17:58 UTC第二个专用聊天经正式入口选择Auto，真实审核开始后停止，[报告](../../artifacts/auto-review-cancel-cancel-android.json)确认abort结束、无下游执行。[补丁后截图](../../artifacts/auto-review-cancel-android.png)已查看，不再显示模型拒绝，而是原工具英文`Error: tool call aborted before dispatch`；中文提示仍待修正。[随后续聊](../../artifacts/auto-review-cancel-resume-observe-android.json)成功，无工具调用或文件变化。

两次均先恢复read-only并核对autoSessions=0，再归档测试聊天、删除精确测试文件、返回原联调及空草稿。第二次[清理](../../artifacts/auto-review-cancel-cleanup-android.json)、[卸载收尾](../../artifacts/auto-review-cancel-unloaded-android.json)通过，日常设备active/management=false。卸载首轮立即计数1的[误报](../../artifacts/auto-review-cancel-unloaded-immediate-failure.json)保留，驱动改为等待原异步目录移除后通过。

取消[观察器](../../tests/fixtures/live-auto-review-cancel/index.js)透传原流，仅记录信号/结束与下游名称，不延迟或伪造模型响应。25项审核回归与3项安装恢复通过。本项不证明真实模型拒绝、PTC、子会话或其他并发；无App变化未重建APK。

### 此前低风险放行

Auto review 是原 DSH 默认关闭的实验能力，不是手机另写的审批器。原插件添加当前会话预设，每次受支持工具调用先由当前模型审查，允许后按原 Full access 执行规则继续；这不取消文件读取前置检查等其他工具约束。手机保留原说明与显式勾选确认，选择通过原命令更新同一电脑会话。

此次先核对实际源码启动的配置没有auto-review项，再用原CLI临时安装实际电脑目录下的原包。手机新建DSH-TEST专用聊天，先选择只读，再从正式会话权限入口选择Auto；未勾选前确认按钮禁用。手机只发送一次限定测试文件写入消息，未更换Key或模型。

只读[观察插件](../../tests/fixtures/live-auto-review-observer/index.js)透传原llm/stream和tools/pre-execute，不修改请求、模型响应或权限决定；仅按本次随机测试标记记录模型标识、risk/decision/finish、工具名称和权限状态，不保存完整提示词、reasoning或凭据。真实provider为deepseek-official，模型为deepseek-v4-pro。

## 验收矩阵

| 阶段 | 证据与结果 |
| --- | --- |
| 手机确认与一次发送 | [17:42 UTC开始报告](../../artifacts/auto-review-live-start-android.json)确认风险勾选门槛、发送一次；[专用测试记录](../../artifacts/auto-review-live-seed.json)保存精确测试文件/标题和attempted标记，观察阶段不重发。 |
| 运行中观察 | [第一次观察](../../artifacts/auto-review-live-first-observation.json)显示一次low/allow审核，仍运行、文件尚未改；实际手机工具错误为“file has not been read”。模型随后读取同一文件再写入，没有将尚未完成当作成功或重复发送任务。 |
| 实际完成 | [17:44报告](../../artifacts/auto-review-live-observe-android.json)显示write/read/write三次调用均处于auto，每次真实审核均low/allow且正常finish；文件内容与预期完全一致、没有人工待审批、生成结束。[手机截图](../../artifacts/auto-review-live-android.png)可见完成回复和文件改动卡片。 |
| 恢复与精确清理 | [cleanup报告](../../artifacts/auto-review-live-cleanup-android.json)确认手机改回只读，Host当前值read-only且autoSessions=0；仅归档本次命名测试会话，删除本次精确路径文件，返回原联调会话且草稿一致。 |
| 卸载与原页面 | 在所有会话退出Auto后，原CLI移除实验包和观察插件。此顺序避免原包卸载时把仍处Auto的会话迁移到Full access。[17:45报告](../../artifacts/auto-review-live-unloaded-android.json)确认手机Auto选项消失、原联调仍只读、草稿保留。日常设备active、management=false，本轮未授管理权限。 |

[Android驱动](../../scripts/verify-auto-review-live-android.mjs)分prepare/start/observe/cleanup/unloaded；prepare使用独占创建，已有报告不应直接覆盖后重新发送。观察最长45秒后返回当前结果，running=true只表示仍在运行，不是通过。原功能代码和APK未变，本轮仅新增验收夹具/驱动及证据，未为无产品改动重跑构建。

低风险放行记录只证明指定文件调用，审核中取消见上方独立专项。真实模型拒绝理由、PTC内层、跨端并发、子会话和其他风险判定不能外推；条件能力与完整Remote仍按[收尾验收表](./completion-audit.md)推进。
