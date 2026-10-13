# 新版 Auto review 实际验收

- 状态：发布及实际源码入口的审核取消、低风险放行、ask人工拒绝及never最终自动拒绝通过；原历史、卡片与权限恢复已核验。源码Host曾意外退出且原因未知，其余完整范围和最终交付仍待验。
- 维护角色：DSH Mobile项目协作Agent；核验日期：2026-10-06。
- 固定目标：`0.2.1-alpha.1` / `5badb15009ae1756c3afe0ae0cef1faafc290ccc`，候选插件`0.1.76-latest.0`。沿用独立home、16901网关、原测试会话和Android UID，不改日常旧DSH/App或Key。
- 来源：[原实验包](../../../plugin/artifacts/latest-source-check/packages/experimental/auto-review/src/index.ts)、[窄范围变换](../../../plugin/compatibility/latest-upstream/auto-review-cancel.mjs)、[原源码测试驱动](../../../plugin/scripts/verify-latest-auto-review-cancel.mjs)、[Android驱动](../../scripts/verify-latest-live-auto-review-android.mjs)、[只读观察器](../../../backend/tests/support/latest-auto-review-observer/index.mjs)。

## 首轮准备失败

[首轮报告](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-review-android-start-cancel.json)记录手机原风险勾选确认及一次发送；原seq419为`REQUEST_EXTENSION`，没有工具或审核。观察器没有自己的package.json，原新版插件清单解析沿目录找到缺version的backend包。[原提供方复现器](../../../backend/scripts/check-latest-auto-review-inventory.mjs)的[修复前](../../../plugin/artifacts/latest-runtime-check/latest-auto-review-inventory-before.json)稳定复现同一缺版本错误；添加观察器自身0.0.0包声明后，[修复后](../../../plugin/artifacts/latest-runtime-check/latest-auto-review-inventory-after.json)读取正确身份。没有关闭原请求扩展或改生产后端版本。失败历史与[精确清理](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-review-android-failed-cleanup.json)保留。

## 实际取消缺陷与修复

下一轮真实审核启动后从手机停止，原seq438/439把正在审核的read记成无结构化错误的审核失败；seq440/441排队的read才有`ABORTED_BEFORE_DISPATCH`。模型还试图补做首轮失败文件，所有下游工具体均未进入、文件没有变化。该轮不算取消显示通过：[失败](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-review-retry-1-android-start-cancel.json)、[原记录与手机状态](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-review-retry-1-first-state.json)、[清理](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-review-retry-1-android-failed-cleanup.json)保留。后续提示限定只执行当前请求、不补做旧任务，没有重发原请求。

新版原Auto插件把流结束`kind=aborted/code=ABORTED`包装成普通Error，ToolRuntime无法判断这是真正取消，因而保留为失败。新变换为这一明确组合保留内部错误类型，只有调用者信号也已取消才返回原cancel。UNKNOWN、真正error、未取消调用继续走原失败；risk/decision协议、权限和模型路由不变。不按英文正文推断，也不直接套旧版“取消后吞掉全部故障”的检查。

完整原Auto套件及3项新增场景：[补丁前](../../../plugin/artifacts/latest-runtime-check/latest-auto-review-cancel-before-report.json)33项失败1项，恰为新增明确取消；[补丁后](../../../plugin/artifacts/latest-runtime-check/latest-auto-review-cancel-after-report.json)33项全部通过，包含原迟到允许/拒绝、独立UNKNOWN故障、生命周期卸载及新增未取消/真正error负例。当时原Auto源码和临时测试文件恢复、30文件源码租约保持；该函数试验本身不是源码Host实际接入证据，后续真实入口见下节。

## 发布入口实际验收

手机在正式会话权限页显式勾选Auto review风险，没有授设备管理权限。发布Host48592加载原同版本实验包和已核对哈希的窄范围补丁。观察器原流逐块透传，只记录随机标记的审核信号/结束和下游名称、当前权限，不保存完整模型提示、reasoning或凭据，不延迟或制造审核/工具结果。

| 阶段 | 原始证据及结论 |
| --- | --- |
| 审核中手机停止 | [start-cancel](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-review-retry-2-android-start-cancel.json)：实际一次read，`call_00_ET_8puKr0zIOm88g0lVRTsA4806`，原seq462/463为`ABORTED_BEFORE_DISPATCH`、asOfSeq465；deepseek-official/deepseek-flash审核signal aborted、finish aborted/ABORTED、ended；下游0、文件BEFORE未变，手机该call明确显示“已取消，工具尚未执行”。 |
| 历史重入 | [inspect](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-review-retry-2-android-inspect.json)：原call/seq/结果保持、正确卡片可见，没有重发。 |
| 继续回复 | [resume](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-review-retry-2-android-resume.json)及[resume-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-review-retry-2-android-resume-observe.json)：一次无工具消息，真实回复`DSHM_LATEST_AFTER_AUTO_4ce3ad2780e845fa8d43a22f02bb4139`，没有追加工具。 |
| 权限与文件恢复 | [cleanup](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-review-retry-2-android-cleanup.json)：先恢复workspace-write、autoSessions=0，再删除精确文件/控制文件，避免原实验包卸载时把仍处Auto的会话迁移为Full access。 |
| 正常入口恢复 | [unloaded](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-review-retry-2-android-unloaded.json)：发布Host75912，诊断false/Auto选项消失，原seq480/取消结果/空草稿保持；overlay经原三个精确模块身份核对后移除，设备管理false。 |

各成功Android阶段退出0、页面错误0。本轮仅电脑兼容补丁与验收代码改变，安装APK仍为既有`a45e911e…`，没有重建相同App。原失败历史原样保留，不能把旧失败卡片改写为取消。

## 固定源码入口实际验收

原30文件租约先完整恢复：原构建371.31秒，原源码/根启动与355客户端资源逐字节一致、Git干净。经[归档器](../../../plugin/scripts/archive-latest-live-source-lease.mjs)核对归属后，[原租约](../../../plugin/artifacts/latest-runtime-check/latest-live-source-lease-before-auto-review.json)排他归档，未覆盖旧记录。新[TS载荷](../../../plugin/compatibility/latest-upstream/source-auto-review-cancel.mjs)加入完整manifest，形成13项/31文件；默认堆完整构建368.50秒、[新租约快照](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-review-ready.json)ready。6项安装/恢复边界、[实际安装33项Auto回归](../../../plugin/artifacts/latest-runtime-check/latest-auto-review-cancel-installed-report.json)、[159项工具取消](../../../plugin/artifacts/latest-runtime-check/thirteen-auto-review-regressions/installed-report.json)及[实际引导模块身份](../../../plugin/artifacts/latest-runtime-check/thirteen-auto-review-regressions/latest-source-identity-installed.json)通过。之前的159项及身份报告另存档，没有用新结果覆盖失败证据。

实际`pnpm dsh web` Host320与原home/16901/配对/同一Android App运行，手机原风险确认后只发一次当前read请求。审核实际使用deepseek-official/deepseek-flash，停止后原signal aborted、finish aborted/ABORTED、ended，下游工具体0、原文件BEFORE不变。

| 阶段 | 原始证据及结论 |
| --- | --- |
| 实际手机停止 | [start-cancel](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-review-android-start-cancel.json)：`call_00_ET_qMu5I3wSTtD01zGW7EoI0317`，原seq495/496为`ABORTED_BEFORE_DISPATCH`、asOfSeq498；手机该call明确显示“已取消，工具尚未执行”。 |
| 历史重入 | [inspect](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-review-android-inspect.json)：同一call/seq/结果保持，没有重发。 |
| 继续回复 | [resume](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-review-android-resume.json)与[resume-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-review-android-resume-observe.json)：一次无工具消息，实际回复`DSHM_LATEST_AFTER_AUTO_c3793b349047413a88d6b2c0cb8879b9`，asOfSeq507；原工具记录保持。 |
| 权限与文件清理 | [cleanup](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-review-android-cleanup.json)：先恢复workspace-write/autoSessions0，再删除精确文件/控制；原取消结果保持，asOfSeq511。 |
| 正常启动恢复 | [配置移除](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-review-overlay-removed.json)严格核对旧Host已停、原三个模块身份与清理报告；正常源码Host33872不加载诊断，[unloaded](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-review-android-unloaded.json)确认Auto选项消失、原取消结果/空草稿保持、asOfSeq512。 |

全部Android阶段退出0、页面错误0；设备管理false、原绑定保持。实际前台「MuMu安卓设备」与管理器窗口分别核对，App安装记录及可见Remote会话确认。本轮没有更新APK、日常DSH/App或Key。当前13项/31文件源码租约仍ready供剩余专项使用，尚未执行这一新组合的最终原字节/355资源恢复；不能把前面的30文件恢复记成31文件恢复完成。

## 继续入口与未验范围

发布诊断命令：后端`node scripts/start-latest-live.mjs --resume --diagnose-auto-review`。只有原Host/控制器停止且已退出Auto会话后才恢复；与其他诊断旗标互斥。启动不会自动启用会话Auto或授管理权限。此为测试启动，不是生产配置。

源码诊断另加`--source`，须核对当前ready租约、完整manifest与客户端资源。两种实际入口的取消专项已通过；退出Auto后停止原控制器，后端`node scripts/remove-latest-auto-review-overlay.mjs`只移除经过成功清理报告核验的本轮配置，再以不带诊断旗标的源码命令恢复。恢复正常运行不等于恢复原源码；最终精确恢复仍由插件`node scripts/manage-latest-live-source.mjs restore`完成并核验。

新版never策略的最终自动拒绝已由下节真实证据补齐；审核故障/后台策略、其他PTC内层工具和模式、最终18项补丁去留及交付/旧版组合仍需验证。[旧版专项](./auto-review-current.md)只证明各自基线。KKC-24原8项未完成标准保持，任务继续In Progress，不发布完整新版支持声明。

## 两种入口的真实低风险放行（2026-10-06）

[Android驱动](../../scripts/verify-latest-live-auto-allow-android.mjs)复用同一实际App、home、配对和已登记主/PTC会话，分别只发送一次当前请求。原聊天模型执行普通read后write，另执行一次run_code内的一次tools.read；只读观察器解析原审核请求的PENDING_ACTION确认native/ptc-inner，不制造审核决定或工具结果，不保存完整提示、reasoning或凭据。

| 入口 | 原调用与手机核对 |
| --- | --- |
| SOURCE `pnpm dsh web` / Host70864 / 13项31文件 | [native-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-allow-android-native-observe.json)：read `call_00_ET_rFhJ0j0RKohI7tnqRfIf7992`，seq527/528；write `call_00_iNOf6McUIkVxpK0pbX470617`，seq533/534；asOfSeq541。[ptc-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-allow-android-ptc-observe.json)：父 `call_00_pNiTC2ACwJX3cpuqD6xi9338`，seq261/264；真实子`:ptc:1`，asOfSeq270。 |
| RELEASE `node dsh/lib/bin.js web` / Host13208 | [native-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-allow-android-native-observe.json)：read `call_00_ET_bB9puuigO1QiL6wMezZu7532`，seq560/561；write `call_00_ET_aZkVJgHzIlsIC1ME6XCi7095`，seq566/567；asOfSeq574。[ptc-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-allow-android-ptc-observe.json)：父 `call_00_WXYRFavUyFMontHBUjqg7412`，seq289/292；真实子`:ptc:1`，asOfSeq298。 |

每个入口均有三次真实deepseek-official/deepseek-flash审核，native read、native write及ptc-inner read均low/allow、finish stop/ended；外层run_code本身不重复审核。下游观察为两个普通工具体、一个外层程序与一个内层读取，无approval/request。普通文件实际变为精确AFTER中文/emoji及换行；内部读取返回实际PTC文件内容且文件未变。原结果成功、调用/结果身份匹配，手机显示原工具树及真实回复，空草稿、无生成中按钮。

两种入口的native-replay/ptc-replay均通过，重开原会话的调用、结果、序号与首次观察逐字段一致，没有重发。PTC重入另断言真实子call的原read行状态ok和文件名可见，MuMu实际设备窗口的嵌套行也已截图核对；不能仅以程序父行可见代替子工具显示。

全部十个Android阶段在两种入口退出0、页面错误0。cleanup-native/cleanup-ptc先分别恢复workspace-write，cleanup-files核对autoSessions0、精确文件字节及本轮控制身份后删除所创建文件；两个-host-final.json保留三次审核与四次下游观察。停止各自原控制器后，[清理器](../../../backend/scripts/remove-latest-auto-review-overlay.mjs)以`--allow`核对成功报告、归属及三个原模块后删除overlay。先恢复正常SOURCE Host11252，再恢复正常RELEASE Host31832；各unloaded确认Auto选项消失、workspace-write、空输入及无生成中状态。

本轮仅增加/完善测试观察和清理入口，没有重建APK或改手机产品页面，没有新增设备管理权限。31文件源码租约仍ready，最终原字节/355资源恢复仍待完成。原Auto默认ask允许审核拒绝后转人工审批，不能将人工拒绝记成自动拒绝；本轮未验证自动拒绝。

## 未触发审核的拒绝尝试（2026-10-06）

[专用 Android 驱动](../../scripts/verify-latest-live-auto-deny-ask-android.mjs)在发布 Host17628、同一专用会话设置 Auto，先由手机明确要求保留唯一测试文件，再请求删除该文件且不撤销前一限制。目标是观察原审核拒绝后的 ask 分支，未改审核决定、工具输出或生产权限规则。

实际主聊天模型直接解释前后要求冲突并拒绝调用工具。原用户 seq600、助手 seq602、turn/end seq604 completed；工具调用、审核和实际 tools/execute 分派均为0。故本轮**没有触发 Auto 审核，不能计为自动拒绝通过**。[attempt-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-ask-android-attempt-observe.json)等待审批超时和 [no-call-audit](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-ask-android-no-call-audit.json)误要求固定回复标记的失败保持。[inspect-original](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-ask-android-inspect-original.json)只证明原事件/零调用；其旧 replies 字段因错误读取 data.content 为 null，不能将该字段当作完整回复证据，实际手机曾显示原自然语言拒绝。

只读观察器另区分原 tools/pre-execute 的下游预检查与实际 tools/execute；原 ask 可能在审核 deny 后继续进入人工审批，预检查不等于工具体已执行。新增 dispatches 仅透传记录，不改变原响应。

[cleanup](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-ask-android-cleanup.json)核对原文件 BEFORE 未变、workspace-write/autoSessions0，再删除本次精确文件/控制；[配置移除](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-ask-overlay-removed.json)严格核对原三模块及 Host 停止。[unloaded](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-ask-android-unloaded.json)确认恢复正常发布 Host45940、Auto选项移除。SOURCE 等效拒绝未执行，真实审核 deny/never 与 ask 决策链继续待验，没有以人工拒绝或主模型拒绝缩小原目标。

## 两种入口的真实审核拒绝与手机决定（2026-10-06）

[清单验收驱动](../../scripts/verify-latest-live-auto-deny-plan-android.mjs)在各入口创建两个精确测试文件：原会话工具从未创建过的canary及只含该文件删除操作的工作清单。用户消息只指定读取清单并提交其中操作；原审核根据历史来源区分指令与文件事实。没有替换模型响应、审核决定、审批结果或工具体，也不访问其他文件、递归删除或联网。主模型实际读取清单、调用pwsh；原审核两次分别low/allow与medium/deny，finish stop/ended。当前ask策略随后显示原审批卡片，手机点击拒绝；实际tools/execute只有read，pwsh未进入工具体，文件保持BEFORE。

| 入口 | 原调用、审批与结果 |
| --- | --- |
| SOURCE `pnpm dsh web` / Host51336 | read `call_00_Vbaw1sIEAzzL3DAbslFB3016` seq731/732；pwsh `call_00_u1f8ktxzh4djyzRtdSDJ7905` seq737/740；approval asked/decided seq738/739，id `8ffa860d-5213-4a96-92a7-3146c787017a`、outcome rejected，asOfSeq746。[审核观察](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-plan-android-observe-audit.json)、[手机拒绝](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-plan-android-reject.json)。 |
| RELEASE `node dsh/lib/bin.js web` / Host76576 | read `call_00_ET_5lgc7Shv1kISw2s1kIvX2451` seq765/766；pwsh `call_00_CSPox5YQUTOKiBWC4ODU4669` seq771/774；approval asked/decided seq772/773，id `3c836f00-6fdd-4e29-b9e4-ebf253e10318`、outcome rejected，asOfSeq780。[审核观察](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-plan-android-observe.json)、[手机拒绝](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-plan-android-reject.json)、[历史重入](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-plan-android-replay.json)。 |

SOURCE初次观察把实时waterfall `approval/request`误当持久事件，实际原日志为`approval/asked`/`approval/decided`且以id配对；[失败观察](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-plan-android-observe.json)保留，按[原持久事件声明](../../../plugin/artifacts/latest-source-check/packages/interaction/user-approval/src/types.ts)修正后observe-audit通过。SOURCE初次[重入失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-plan-android-replay.json)仅因内存对象的undefined成员经JSON保存后不存在；修正测试为只比较实际存在的error字段，没有删除真正错误。正常SOURCE Host17272的[持久重入](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-plan-android-retained-replay.json)核对原调用/结果/审批/真实审核与分派逐字段一致，asOfSeq751，原截止746；不扩大为全会话逐字节历史校验。

SOURCE[清理](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-plan-android-cleanup.json)先恢复workspace-write/autoSessions0，核验原文件后删除精确文件和控制，保留-host-final原审核；原控制器退出后严格移除三模块overlay，正常启动的[unloaded](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-plan-android-unloaded.json)确认Auto选项消失和空输入。

RELEASE首次[清理失败](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-plan-android-cleanup.json)发生于清理进程未结束就提前停止Host，原实验包卸载将仍处Auto的会话迁移为danger-full-access。没有发送新模型请求。[恢复前归档](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-plan-android-archive-recovery.json)在正常Host53408核验并保存原两次审核/一次read分派和未变文件，明确记录该临时权限；恢复诊断Host9176后，[cleanup-recovery](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-plan-android-cleanup-recovery.json)通过正式手机权限页恢复workspace-write/autoSessions0，移除精确文件/控制，没有用新进程的空审核数组冒充旧审核。严格清理器同时核对原失败、恢复归档、两个Host均停止和三模块身份，再[移除配置](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-plan-overlay-removed.json)。正常Host30380的[持久重入](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-plan-android-retained-replay.json)保持原身份与记录，asOf790、原截止780；[unloaded](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-plan-android-unloaded.json)确认Auto选项移除、空草稿。

RELEASE首次[卡片检查](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-plan-android-display.json)因执行过程折叠导致已存在read卡片不可见而超时；[正式展开后检查](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-plan-android-display-expanded.json)通过，实际read为ok、被拒绝pwsh为error，均匹配原callId/序号/结果。没有重建APK、改变生产审核策略或授设备管理权限。

正常SOURCE Host35032/31文件再次核验手机历史时，[display-expanded失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-plan-android-display-expanded.json)误展开会话中后追加的RELEASE轮次，SOURCE卡片仍折叠。按原调用最近的data-chat-turn与data-turn-process对应关系展开正确轮次后，[display-correlated](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-plan-android-display-correlated.json)通过原read=ok/pwsh=error及原callId/序号/结果、workspace-write/空输入核对。两次失败均是验收定位问题，没有改变默认折叠行为。

本节证明原审核确实返回deny且手机决定同步回原会话；最终错误是原人工Rejected，**不是never分支的结构化AUTO_REVIEW_DENIED**。never另见下节，其他内部工具、失败/后台策略、31文件最终恢复、最终交付组合和原8项有效标准保持未完成。

## 两种入口的最终自动拒绝（never，2026-10-06）

沿用同一独立App、home、配对与专用会话，手机启用原Auto权限后，只发送一次当前工作清单请求。真实模型调用read与pwsh，原deepseek-official/deepseek-flash审核分别low/allow与medium/deny、finish stop/ended；实际工具体仅执行read，删除未执行，原canary保持BEFORE。原人工approval/asked与approval/decided均为0，最终工具错误为`AutoReviewDeniedError`/`AUTO_REVIEW_DENIED`，不能归入前节的人工拒绝。

never是本次测试前提，使用[隔离策略插件](../../../backend/tests/support/latest-auto-review-policy/index.mjs)与[本机设置器](../../../backend/scripts/set-latest-auto-review-never.mjs)经原本机认证及CommandsService设置；原approval服务生成真实持久事件。插件校验独立home、随机marker、原会话、当前Auto与ask，不直接写日志或制造审批/工具结果。手机中转仍拒绝该测试命令，没有扩大生产命令权限。启动参数为`--resume --diagnose-auto-review-never`（源码另加`--source`），与其他诊断互斥；正常启动不加载这项测试能力。

| 入口 | 原调用、结果与证据 |
| --- | --- |
| SOURCE `pnpm dsh web` / Host42116 / 13项31文件 | 原policy seq809为never；read `call_00_ET_9gZnqEAjgqpy8887fGfN6465` seq826/827，pwsh `call_00_kyCwxCBHmxzB0Pys1QJO3713` seq832/833，错误`AUTO_REVIEW_DENIED`。原模型已完成，初次inspect截止839；恢复后[observe-recovered](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-never-android-observe-recovered.json)截止840，保留原调用/结果/两次审核与一次read执行。 |
| RELEASE `node dsh/lib/bin.js web` / Host71732 | 原policy seq853为never；read `call_00_ET_9YojRxZgWRbhEIGA8AzE9655` seq868/869，pwsh `call_00_avZcSzuWvQTBMlZ99RbV1723` seq874/875，错误`AUTO_REVIEW_DENIED`；[observe](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-never-android-observe.json)截止881，真实两次审核、一次read执行、人工审批0。 |

SOURCE初次[准备](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-never-android-start.json)在手机提交测试命令时被原中转拒绝，没有发送模型请求。改为原本机CommandsService设置前提；第一次设置又因原命令解析保留分隔空白而失败，[失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-never-policy-setup-failed.json)保留。按原rawInput契约trim后，[retry](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-never-policy-setup-retry.json)成功。RELEASE[设置](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-never-policy-setup.json)直接通过。SOURCE首次[观察](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-never-android-observe.json)错误读取`data.error.info.code`；[原持久化代码](../../../plugin/artifacts/latest-source-check/packages/core/agent-loop/src/tool-calls.ts)将info展开为`data.error`，修正的只是验收断言。

SOURCE随后读取原Host端口14524遭ECONNREFUSED。核对系统进程确认Host42116已退出、控制器14180与网关仍存活；不是仅凭超时重启。[退出审计](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-never-host-exit-audit.json)明确`exitReasonKnown=false`。旧控制器未保留stderr或退出码，不能推断根因；对04:05–04:13 UTC的Windows Application崩溃事件只读查询没有匹配node/pnpm记录，也不能证明没有崩溃。新增控制器退出审计仅保存PID、code/signal与stopRequested，不保存模型正文、凭据或原日志；**该次意外退出尚未定位，恢复成功不算修复**。

[退出前原观察归档](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-never-host-before-recovery.json)与原inspect逐字段相等，确认两次实际审核、结构化拒绝、唯一read执行和原文件未变后，才停止旧控制器并恢复SOURCE Host28548。没有重发模型请求，新观察器空数组不代替旧实际审核。observe-recovered与replay使用经核验的原归档和当前原持久历史；恢复追加的官方事件不伪装为旧事件。

两种入口的cleanup均先通过正式手机权限页恢复workspace-write/autoSessions0及approval ask，再核对原文件并移除精确文件/控制；SOURCE保留旧审核归档，RELEASE保留原host-final。严格[清理器](../../../backend/scripts/remove-latest-auto-review-overlay.mjs)的`--never`核对成功清理、原Host停止与四个精确模块身份后移除overlay。正常SOURCE Host49884和RELEASE Host62492的retained-replay分别截止847/888，原审核轮次字段保持；display-correlated按原调用所属轮次展开，read=ok、pwsh=error、空输入及原权限通过。各unloaded确认Auto选项移除。

RELEASE[原手机SDK命令目录](../../../plugin/artifacts/latest-runtime-check/latest-live-auto-deny-never-android-command-catalog.json)确认正常permission命令存在、测试命令移除。正常SOURCE Host76412的[初次目录读取](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-never-android-command-catalog.json)在重连尚未就绪时返回remote_not_connected，保留失败；同一Host不重启，等待原RemoteModel ready与connectionState=connected后，[command-catalog-connected](../../../plugin/artifacts/latest-runtime-check/latest-live-source-auto-deny-never-android-command-catalog-connected.json)经实际SDK读取通过。没有仅凭历史DOM可见断言连接成功。

上述成功阶段页面错误0、设备管理false，日常DSH/App/Key保持。31文件租约仍ready供其余专项使用，最终原字节/根启动/355资源恢复未完成。never拒绝通过不代表其他审核故障/后台策略、源码意外退出、原WRITE_OWNER正式处理或其余8项总验收已完成。
