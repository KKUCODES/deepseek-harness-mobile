# 手机通知接入状态

新版后台子任务通知点击时误清父会话提醒的问题，候选修复已通过独立 Android 原生回归及发布/实际源码手机链路；原APK、原源码及完整构建资源已精确恢复归档。详见[子任务通知点击隔离](./latest-child-model.md#后台子任务通知与点击隔离2026-10-07)；不影响下文各专项已核验事实，也不表示全部通知标准已通过。

## 新版待办通知与受阻显示（2026-10-06）

- 状态：固定 npm 发布入口的提问/审批通知，以及发布和实际源码入口的受阻通知、点击与同一会话历史重入通过；新版受阻提示被折叠并误报成功的问题已在独立 App 修复。
- 维护角色：项目协作 Agent；最近核验：2026-10-06。
- 来源：[提问驱动](../../scripts/verify-latest-live-question-notice-android.mjs)、[审批驱动](../../scripts/verify-latest-live-approval-notice-android.mjs)、[受阻驱动](../../scripts/verify-latest-live-blocked-notice-android.mjs)、[手机构建适配](../../scripts/latest-turn-process-sources.mjs)。固定目标 `0.2.1-alpha.1 / 5badb150`、候选 `0.1.76-latest.0`，日常旧 DSH 和普通 App 保持。

发布 Host76784、原 App14934 的提问仅一次 `call_00_ET_8QKSL8JTSsXiFMEu8Gdx4655`。后台收到原标题及“有问题等待你回答”，点击实际通知后手机选择绿色；电脑原结果为 `answers=[{id:"notice_check",selected:["绿色"]}]`，真实回复 `DSHM_NOTICE_ANSWER_绿色`。审批仅一次 `call_00_ET_9JVXwZvetnUhdt7hdiRW9573`，实际通知正文为“有操作等待你批准”；点击后查看原文件/拟写内容并拒绝，原工具结果明确 `user rejected escalating`、真实回复 `DSHM_NOTICE_WRITE_REJECTED`。原 UUID 文件未写入、随后移除，workspace-write 恢复。两项各 start/inspect/audit 退出0、无页面错误；历史不重复调用、通知已清除、输入为空。原源码对应证据见下方既有章节。

证据：[发布提问送达](../../../plugin/artifacts/latest-runtime-check/latest-live-question-notice-android-start.json)、[手机回答](../../../plugin/artifacts/latest-runtime-check/latest-live-question-notice-android-inspect.json)、[历史核对](../../../plugin/artifacts/latest-runtime-check/latest-live-question-notice-android-audit.json)，[发布审批送达](../../../plugin/artifacts/latest-runtime-check/latest-live-approval-notice-android-start.json)、[拒绝与恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-approval-notice-android-inspect.json)、[历史核对](../../../plugin/artifacts/latest-runtime-check/latest-live-approval-notice-android-audit.json)。

受阻专项只在独立原 home 加载[有界 pre-step 诊断插件](../../../backend/tests/support/latest-blocked-diagnostic/index.mjs)。插件严格匹配控制文件中的原会话及随机输入，等待手机回到后台后返回原 `reject`；原 DSH 自己保存 `turn/end blocked`，没有注入事件、替换模型/通知帧或新增模型请求。发布 Host29000 在 seq397 收到一条“电脑任务受阻，请打开查看”，实际通知点击正确进入原聊天，但说明节点被 `hidden="until-found"` 隐藏，同时原过程控制器误显示“已完成，用时1秒”。[首次实际失败](../../../plugin/artifacts/latest-runtime-check/latest-live-blocked-notice-android-inspect.json)和[隐藏原因](../../../plugin/artifacts/latest-runtime-check/latest-live-blocked-notice-android-inspect-state-layout.json)保留为失败证据。

手机最新构建仅适配两个原渲染函数：blocked 轮次保持展开，已有共享 turn-blocked 节点说明原因，成功用时/读屏通知不再呈现。原正常完成折叠、停止/失败和运行中展示保持，主聊天、旁栏及插件默认渲染使用同一路径；固定上游源文件不修改，锚点变化时构建明确拒绝。新版原 ChatNodeSeat/TurnProcessNodeView 的[修复前回放](../../artifacts/latest-turn-process-before.json)失败、[修复后回放](../../artifacts/latest-turn-process-after.json)通过；这是展示回放，不代替真实 Android 链路。旧版主/旁栏、中英文及草稿[回归](../../artifacts/blocked-chat-web.json)通过，模型/视图108项及后端恢复5项通过，新版普通启动/五轮输入生命周期回归与 Android assembleDebug/lintDebug 通过。首轮 Gradle 缺 ANDROID_HOME，补齐本进程现有 SDK 路径后构建成功，未修改全局环境。

修复 APK 以 `install -r` 更新同一独立 UID，保留数据/绑定，165 Web 资源及实际安装包逐字节核对，SHA256 `a45e911e4f66ef4ab21309b06ce69bb69f85d14d68a7fd9b2ca05148205ea6b3`，见[产物核对](../../artifacts/latest-live-draft-receipt-apk-blocked.json)。App14934→18339 后只重读原 seq397，未重发标记、未再次点击已消费通知；[恢复检查](../../../plugin/artifacts/latest-runtime-check/latest-live-blocked-notice-android-recover-inspect.json)及[历史重入](../../../plugin/artifacts/latest-runtime-check/latest-live-blocked-notice-android-audit.json)均通过，错误成功文案消失。

随后同一 home 的实际源码 `pnpm dsh web` / Host37540 / 30文件载荷在同 App18339 下执行独立严格匹配标记，原 seq402 blocked 结算、后台通知、实际点击、受阻说明及历史重入全部通过：[送达](../../../plugin/artifacts/latest-runtime-check/latest-live-source-blocked-notice-android-start.json)、[点击](../../../plugin/artifacts/latest-runtime-check/latest-live-source-blocked-notice-android-inspect.json)、[审计](../../../plugin/artifacts/latest-runtime-check/latest-live-source-blocked-notice-android-audit.json)。两种入口的受阻轮次均无用户/模型/工具/step-start事件，未伪造具体拒绝原因。

两个诊断 Host 已按原控制器停止；最终正常发布 Host29812 恢复原网关/配对，诊断标志 false，控制文件、报告控制文件和诊断 overlay 均移除。原 seq397/402 与两条可见说明保留、workspace-write/空输入/无通知/管理false保持，当前 asOfSeq403。首次清理审计仅因截图名称未满足 helper 前缀失败，[失败报告](../../../plugin/artifacts/latest-runtime-check/latest-live-blocked-cleanup.json)保留；[严格恢复审计](../../../plugin/artifacts/latest-runtime-check/latest-live-blocked-cleanup-recovered.json)复核原失败、已移除 overlay 及全部同一记录后通过，未重发操作。四类通知的本机指定路径现有证据，自动审核、其他失败原因/断线/设备后台策略和所有其他有效标准仍待验；SOURCE 租约继续保留，最终完整恢复/交付未完成。

## 发布入口的进程结束与草稿恢复（2026-10-06）

- 状态：固定 npm DSH `0.2.1-alpha.1`、候选插件 `0.1.76-latest.0` 和独立 MuMu App 实际通过两条进程结束/重开流程，包含发送成功回执未处理与正常发送；原消息只一次，草稿与核对编号清除，通知不补发。
- 维护角色：项目协作 Agent；最近核验：2026-10-06。
- 来源：[原验证器](../../scripts/verify-latest-live-notice-process-android.mjs)、[原发送恢复实现与边界](./draft-migration-current.md#发送确认丢失后的恢复2026-10-06)。仅增加发布入口的实际包/命令校验与独立证据前缀，不修改生产通知、消息或认证代码。

发布 Host76784 使用 `node dsh/lib/bin.js web`，沿用同一 home、网关、主会话、原配对和管理 false。最终已安装 APK 保持 SHA256 `64ad31f054844b1057173e969a9c3b4cb549c670fc29624da3f67c9cd56c7b39`。没有清除 App 数据、替换 Key 或自动重发模型请求。

先只延迟原 `Session.prompt` 的真实成功回执交给输入层：原编号 `4beb6489-a899-4271-a802-72de4c638919` 在发送前落盘，电脑原 user/message seq330 仅一条。App8314 在回复seq334结算前实际结束，期间及结算后8秒无通知。冷启动新 PID12872 后，原普通首页首先核对原生通知连接 listening、5秒无补发，然后进入 Remote；原 asOfSeq336、指纹、workspace-write 保持，输入、持久草稿和发送核对记录均为空。返回列表后重进历史再次通过。

证据：[回执未处理时结束](../../../plugin/artifacts/latest-runtime-check/latest-live-notice-process-force-draft-receipt-android-start.json)、[重新打开](../../../plugin/artifacts/latest-runtime-check/latest-live-notice-process-force-draft-receipt-android-reopen.json)及[历史/持久数据核对](../../../plugin/artifacts/latest-runtime-check/latest-live-notice-process-force-draft-receipt-android-audit.json)，三个阶段退出0、页面错误0。

随后在未延迟回执的正常发送流程，App12872 在回复seq343结算前结束，期间及结算后8秒无通知。冷启动新 PID14934 从原普通首页自动恢复通知连接，再进入同一 Remote；原 asOfSeq345/单次用户消息/配对/权限保持，输入、持久草稿和核对记录为空，重连后5秒无旧通知，返回列表重开历史再次通过。

证据：[正常发送后结束](../../../plugin/artifacts/latest-runtime-check/latest-live-notice-process-force-final-natural-android-start.json)、[重新打开](../../../plugin/artifacts/latest-runtime-check/latest-live-notice-process-force-final-natural-android-reopen.json)及[历史/持久数据核对](../../../plugin/artifacts/latest-runtime-check/latest-live-notice-process-force-final-natural-android-audit.json)，三个阶段退出0、页面错误0。每条流程仅一次真实请求，无工具调用、无重复消息；最终 App 在原主聊天前台，管理 false。

这与下面固定源码两条流程的结论一致，仍限定本机 MuMu 与有界观察，不证明全部 OEM、省电/存储异常或无限后台。发布提问/审批及受阻等通知类别、其他原完整验收标准继续；源码30文件租约还在用于后续专项，尚未最终恢复。

## 固定源码的进程结束与草稿恢复（2026-10-06）

- 状态：固定 `0.2.1-alpha.1 / 5badb150` 的实际源码入口和独立 MuMu App 通过进程结束期间不推送、重新打开重连、不补发旧通知及已发送草稿清理。发布入口和其他设备的后台策略尚未由此证明。
- 维护角色：项目协作 Agent；最近核验：2026-10-06。
- 来源：[实际验证器](../../scripts/verify-latest-live-notice-process-android.mjs)、[草稿恢复规则](./draft-migration-current.md#发送确认丢失后的恢复2026-10-06)、[最终安装包核对](../../artifacts/latest-live-draft-receipt-apk-final.json)。

原始 `am kill` 未结束进程20549，[该轮失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notice-process-android-start.json)及[通知清理](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notice-process-android-recover-live.json)保持失败状态，不能记为进程结束通过。随后 `force-stop` 在电脑回复结算前结束该进程，期间和结算后8秒无通知；但[重开失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notice-process-force-android-reopen.json)发现已发送的98字测试消息重新出现，[原症状](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notice-process-force-draft-regression.json)独立保留。电脑原用户消息seq300、`source.rpcId=ad29ee5c-2ecb-4220-9dd9-88806076c620`证明消息已收到；手机此前没有持久保存该核对编号。

修复后先做受控回执时序：仅延迟原 `Session.prompt` 的真实成功结果交给输入shell，不替换电脑响应、不重发请求、不修改生产通知或认证。原编号 `fb1b150f-59c2-4837-9fe9-cae4045f1682` 在发出请求前严格落盘；电脑收到一次原消息seq309。App4409在回复seq312结算前结束，普通首页冷启动5519后先确认原生通知连接 listening，再打开Remote。原配对、权限与历史asOfSeq314保持，草稿和核对编号清理，输入为空、无iframe、无通知；返回列表后重新打开原聊天仍一致。[进程结束](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notice-process-force-draft-receipt-android-start.json)、[冷启动](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notice-process-force-draft-receipt-android-reopen.json)、[重入](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notice-process-force-draft-receipt-android-audit.json)、[持久数据审计](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notice-process-force-draft-receipt-android-local-audit.json)均退出0。

补齐发送前存储失败时附件可重试的边界后，最终APK再次覆盖安装，仅保留同一测试UID的数据。在未延迟回执的正常路径再执行一次真实消息：App7251在电脑回复seq321之前结束，期间和结算后8秒无通知；冷启动8314自动重连，原用户消息只有一条、原asOfSeq323/配对/workspace-write保持，手机草稿和发送核对编号为空，重连后5秒无历史补发。[正常发送后的结束](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notice-process-force-final-natural-android-start.json)、[重新打开](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notice-process-force-final-natural-android-reopen.json)及[历史重入](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notice-process-force-final-natural-android-audit.json)分别保存；范围是本机MuMu和有界观察，不外推无限后台、省电或所有OEM。

最终安装包SHA256为 `64ad31f054844b1057173e969a9c3b4cb549c670fc29624da3f67c9cd56c7b39`，165个Web资源逐字节与候选构建一致，设备已安装包哈希一致；旧日常App未替换。119项草稿/模型/独立视图回归、新旧Web构建、Android assembleDebug/lintDebug通过；17项原编辑器输入契约和主/旁栏输入隔离回放通过，页面错误为零。后者是隔离契约回放，不能替代上述实际模型与Android证据。源码Host71332、30文件租约与原聊天授权继续用于其他完整验收，管理权限保持false。

之前遗留草稿只按已记录测试标记与电脑原用户请求核对后清理，没有推广为按文字删除用户草稿。[清理驱动前两轮失败](../../../plugin/artifacts/latest-runtime-check/latest-live-sent-legacy-draft-cleanup.json)、[再次失败](../../../plugin/artifacts/latest-runtime-check/latest-live-sent-legacy-draft-cleanup-retry.json)保留；[最终重新读取输入、数据库和原历史](../../../plugin/artifacts/latest-runtime-check/latest-live-sent-legacy-draft-cleanup-confirm.json)退出0、确认已为空且没有重发。输入专项最初漏开主聊天、APK核对最初未接受Android安装路径中的`~`，均修正验证器后重新通过；不作为产品缺陷或首次通过。

## 固定源码的后台审批通知（2026-10-06）

- 状态：固定源码 `pnpm dsh web` 的实际 Android 后台审批送达、通知点击、拒绝与历史重入通过；发布入口的审批通知尚未复验。
- 维护角色：项目协作 Agent；最近核验：2026-10-06。
- 来源：[实际验证器](../../scripts/verify-latest-live-approval-notice-android.mjs)、[同一通知送达观察](../../../plugin/artifacts/latest-runtime-check/latest-live-source-approval-notice-android-observe.json)、[点击与拒绝](../../../plugin/artifacts/latest-runtime-check/latest-live-source-approval-notice-android-inspect.json)、[历史核对](../../../plugin/artifacts/latest-runtime-check/latest-live-source-approval-notice-android-audit.json)。这三个阶段退出 0、页面错误为零。

沿用 Host71332、30 个固定源码载荷、原主会话与管理 false 的配对，App 20549 保持。核对“需要批准”已开启，不修改通知设置；只对工作区中新建的 UUID 测试文件临时选择“仅可查看”。单次真实模型请求只读取这一文件，然后以 `workspace-write` 请求一次写入批准。原写入调用 `call_00_ET_iVs99TH89MjKb51a2edM3048` 待决定时，后台只产生一条原标题及“有操作等待你批准”的系统通知，文件仍为原字节。

点击实际通知恢复同一聊天，在原工具详情中核对文件名与拟写文本，再拒绝这一审批。电脑原工具结果为错误并明确 `user rejected escalating`，手机显示真实模型回复 `DSHM_NOTICE_WRITE_REJECTED`，原文件没有变化；没有再调用工具。恢复原 `workspace-write` 后核对并移除本次测试文件，通知清除、输入为空、没有 iframe、App 进程不变。返回列表后重开历史，原拒绝和回复保持，序号不变，没有重复审批或调用。

首轮[严格文本核对失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-approval-notice-android-start.json)保留：模型在拟写标记后增加一个换行，尚未点击或拒绝。验证器改为只接受原标记或原标记加一个末尾换行，并记录原完整拟写内容；没有批准写入。首次继续观察还因助手误操作后台暂停的普通页面超时，[入口失败记录](../../../plugin/artifacts/latest-runtime-check/latest-live-source-approval-notice-observe-entry-failed.json)保留。改为直接读取后台 Remote 页，再观察并点击同一已送达通知；没有重发模型请求。这些验证器失败不算首次通过，也没有修改生产通知逻辑。

仅源码审批通知及本次拒绝路径通过；发布审批通知、受阻提醒、进程结束不补发和更多断线时序仍需新版专项。源码租约继续使用，最终统一恢复。

## 固定源码的后台提问通知（2026-10-06）

- 状态：固定 `0.2.1-alpha.1` 的实际源码 `pnpm dsh web` 通过后台提问送达、系统通知点击、手机回答与历史重入；发布入口的提问尚未复验。
- 维护角色：项目协作 Agent；最近核验：2026-10-06。
- 来源：[实际 Android 验证器](../../scripts/verify-latest-live-question-notice-android.mjs)、[送达](../../../plugin/artifacts/latest-runtime-check/latest-live-source-question-notice-android-start.json)、[点击与回答](../../../plugin/artifacts/latest-runtime-check/latest-live-source-question-notice-android-inspect.json)、[历史核对](../../../plugin/artifacts/latest-runtime-check/latest-live-source-question-notice-android-audit.json)。三个阶段均退出 0，页面错误为零。

源码 Host71332、固定 commit `5badb15009ae1756c3afe0ae0cef1faafc290ccc` 和 30 个实际载荷逐阶段核对。沿用原测试主会话与配对，设备管理 false；只核对原“需要回答”已开启，不修改通知设置。只发送一次真实模型消息，唯一原调用为 `call_00_ET_6KF5qWNHFjmZcMUM96Kr6854`，问题正文 `DSHM_QUESTION_NOTICE_681036d8b3fb`。App 切后台后进程 20549 保持，通知栏显示原会话标题及“有问题等待你回答”，原工具仍待回答。

点击真实系统通知恢复同一会话及原问题卡片，再选择“绿色”并提交；电脑原 `tool/result` 收到 `answers:[{id:"notice_check",selected:["绿色"]}]`，非错误，真实回复为 `DSHM_NOTICE_ANSWER_绿色`。通知清除、会话结算、输入为空、没有 iframe，App 进程未改变。返回 Remote 列表后重开同一会话，原结果和回复仍在，原序号保持，没有再次提问或通知；没有其他工具调用，也没有文件或权限变更。

这项只证明固定源码的后台提问路径；源码审批另见上节，发布提问与审批、受阻提醒、进程结束不补发和更多断线时序仍需新版对应验收。源码租约与原测试授权继续保留，最后统一收尾。

## 固定新版的后台完成通知（2026-10-06）

- 状态：固定`0.2.1-alpha.1`的隔离发布和实际源码`pnpm dsh web`，均通过真实模型完成通知及原生通知点击。当前仅完成类型，不代替下面旧版四类型的新版重验。
- 维护角色：项目协作Agent；最近核验：2026-10-06。
- 来源：[实际Android验证器](../../scripts/verify-latest-live-notification-android.mjs)、[新版范围](./latest-compatibility.md)。

使用原测试主聊天、同一配对与管理false，核对原“任务完成”已开启但不修改任何通知设置。每种入口只发送一次不调用工具的真实模型测试消息，然后将App切后台；原进程20549始终存活。只产生一条系统通知，标题为原会话标题、有限正文包含本次唯一标记；电脑原记录已有相应回复且没有工具调用。点击实际系统通知后打开同一聊天和回复、输入为空，通知移除，App进程不变；页面错误为零。验证只点击通知导航，不代答或批准。

发布Host24584使用标记`DSHM_LATEST_NOTICE_85376fa3b4a6`，[送达](../../../plugin/artifacts/latest-runtime-check/latest-live-notification-android-start.json)和[点击](../../../plugin/artifacts/latest-runtime-check/latest-live-notification-android-inspect.json)通过。首次观察程序打印通过后仍持有空闲调试句柄；仅中断本验证进程，终端退出1，[收尾异常](../../../plugin/artifacts/latest-runtime-check/latest-live-notification-start-cleanup.json)保留，App与模型请求未中断/重发。加入200ms收尾退出后，同一已送达通知的点击验证正常退出0。

源码Host69680（控制器13940、TTY80297）逐阶段核对固定commit`5badb15009ae1756c3afe0ae0cef1faafc290ccc`与30个实际载荷，使用独立seed和标记`DSHM_LATEST_NOTICE_df6dc9ce1f34`，[送达](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notification-android-start.json)和[点击](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notification-android-inspect.json)均正常退出0。第一次点击检查的启动助手误操作后台暂停的普通聊天WebView，30秒超时，[原失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-notification-inspect-first-failed.json)保留。修正为点击阶段直接由原生通知恢复Activity，只重观测同一通知，不重发请求。当前设备管理false、原配对与App数据保留；源码租约尚未收尾。

先前[准备记录](../../../plugin/artifacts/latest-runtime-check/latest-live-notification-before.json)的自动审批拦截与旧APK启动问题属于当时未发送阶段；本轮在已经前台打开的原会话执行现有验证器，实际送达/点击结果以上述新报告为准。源码提问与审批另见上节；发布提问与审批、新版受阻提醒，进程结束不补发及更广断线时序仍需对应实际验收，不由单一完成提醒推断。

## 首版通知验收结论（2026-10-03）

- 状态：A04 按已确认的本地验收范围通过；不代表整个 Remote 已交付。
- 维护角色：项目协作 Agent；最近核验：2026-10-03。
- 需求来源：[通知设计九条规则](../design/问卷结论与追问.md#通知设计用户授权-agent-权衡待实现)、[A04 范围](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md)。本次重新读取实际报告字段、驱动断言和生产分流/账本代码，没有重跑下表所有历史场景。

此前“剩余工作”混合了已经通过的场景和环境限制，容易让通知验收无限延长。以下按用户已确认的行为收口；各专项保留版本、失败记录和清理依据。

| 已确认行为 | 核验依据及结论 |
| --- | --- |
| 正在阅读同一聊天时更新内容，不重复提醒 | [实际四种可见/遮挡场景](../../artifacts/occluded-notification-click-android.json)及[驱动断言](../../scripts/verify-occluded-notifications-android.mjs)覆盖当前聊天、设置弹层、插件弹窗和面板。当前聊天 sameSession=true、系统通知为零；[生产分流](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNotifications.kt)在此条件下于创建横幅前移除提醒。旧 notifications-same-chat-android.json 因 contenteditable 检查失败，未作为通过证据。 |
| 前台其他任务用轻提示，点击回到对应聊天 | [普通页面真实横幅点击](../../artifacts/notifications-banner-android.json)打开测试聊天；上述遮挡场景点击真实横幅后恢复正文、待回答卡片仍需用户处理，未直接代答。 |
| 后台且进程/连接存活时收到四类提醒 | [五分钟后台的新审批和提问](../../artifacts/notice-background-dwell-run-android.json)、[实际完成通知与点击](../../artifacts/notice-preview-inspect-android.json)、[真实受阻分类开启/关闭/恢复](../../artifacts/notice-blocked-category-android.json)分别证明对应路径；失败原因专项仍见下文。 |
| 进程结束不唤醒，重新打开重连且不补发历史 | [实际进程终止报告](../../artifacts/killed-notification-live.json)先确认旧 PID 消失再释放 Host 结算，新 PID 重开后读到原回复、无历史补发。观察有界，不作系统永不回收或无限后台保证。 |
| 普通完成、输出片段、短暂断线不形成通知洪流 | [原生连接](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeConnection.kt)只把远程已协商通知帧交给[生产账本](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeLedger.kt)，不接普通模型流或聊天输出分片；[实际生成取消记录](../../artifacts/notifications-actions-acceptance-20260925.json)无完成/失败误报，断线重连记录未补发历史。 |
| 通知显示标题与少量摘要，服从锁屏隐藏 | [真实完成通知](#会话标题与正文摘录2026-10-03)、[待办原标题](#待审批与提问通知标题修复2026-10-03)已验。原生[真实 NotificationManager 检查](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteNotificationRestoreChecks.kt)及[PASS](../../artifacts/notice-preview-native.log)确认 PRIVATE 和不含会话标题/正文的公开版本；当前解析器限制标题120、摘要240字符。未冒充所有厂商锁屏的视觉检查。 |
| 点击只导航，重读当前状态；离线或撤权不冒充可操作 | [离线页](../../artifacts/notifications-recovery-offline.json)无聊天/答复控件，[重试](../../artifacts/notifications-recovery-reconnect.json)进入正确目标且问题仍待答；[撤权旧通知点击](../../artifacts/notice-revoked-inspect-android.json)拒绝访问和重连并清除提醒。当前通知 Intent 只携带绑定/会话身份，不携带批准或执行动作。 |
| 去重；电脑处理待办后清除手机旧提醒 | [原生账本断言](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteNoticeChecks.kt)和上述原生 PASS 覆盖重复帧、重连基线及通知时间不变；[实际电脑答复记录](../../artifacts/notifications-actions-acceptance-20260925.json)清除待办；断线期间电脑处理后，[恢复报告](../../artifacts/notifications-recovery-baseline-restored.json)为 listening/空通知。电脑/手机两端同步在范围内，不要求新增多手机产品能力。 |
| 通知授权不阻止使用，支持分类与系统开关 | [API36.1 两次拒绝及系统设置恢复](../../artifacts/notification-permission-android.json)、[真实授权与投递](../../artifacts/standard-notification-live.json)通过；[审批分类](../../artifacts/notice-approval-category-run-android.json)、上述失败分类、[完成分类关闭](../../artifacts/notice-category-disabled-android.json)及[恢复](../../artifacts/notice-category-restored-android.json)、[系统渠道关闭](../../artifacts/notice-channel-disabled-android.json)及[恢复](../../artifacts/notice-channel-restored-android.json)均已核对原字段。提问分类和其他分类不受影响见实际操作汇总。 |

2026-10-03 本次产物检查通过：117个手机Web文件、插件0.1.75、73个后端文件一致。不同日期的专项只证明其实际范围；没有用报告文件存在替代结果检查。更长后台、强制Doze、厂商锁屏展示及任意多手机并发属于未验证环境边界，不是本次新增交付门槛。后续若出现可复现缺陷，再重开对应项；A05读屏、R14反馈和其余交付核对仍按[总验收表](./completion-audit.md)推进。

## Android通知排队上限与恢复（2026-10-03）

状态：真实认证/模型事件结合受控回放的Android专项通过；维护角色：项目协作Agent；最近核验：2026-10-03。来源：[生产连接](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeConnection.kt)、[原生检查](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteNoticeEpochLiveChecks.kt)的overflow分支、[手机驱动](../../scripts/verify-notice-epoch-live-android.mjs)的`--queue-overflow`与[原生输出](../../artifacts/notice-queue-instrumentation.log)。

正式App创建专用DSH-TEST会话，通过真实DeepSeek保存SEED与OLD回复。原生检查在真实认证并订阅的通知Socket收到该会话outcome后，在同一主线程回合把同一帧交给生产监听器257次：前256次排队没有cancel，第257次调用实际Socket.cancel。此为受控重放/调度，不是电脑实际执行257轮，也没有伪造认证或Host结算。

没有主动调用pause/restart替代恢复：原连接实际收到失败回调，代次推进并自动重新认证、回到listening；前一真实事件去重为一条通知。向旧监听器交付同一真实帧及迟到失败/撤销关闭回调后，新Socket身份与listening保持。再由手机发送FRESH真实消息，后台出现唯一新通知，原生结果PASS、code=-1。报告：[创建](../../artifacts/notice-queue-live-create-android.json)、[OLD](../../artifacts/notice-queue-live-old-android.json)、[FRESH](../../artifacts/notice-queue-live-fresh-android.json)。

首次最终断言误要求旧通知与新通知同时存在，但打开聊天发送FRESH会消费旧通知；[失败输出](../../artifacts/notice-queue-before.log)及[首轮清理](../../artifacts/notice-queue-before-cleanup.json)保留。现按新通知身份断言唯一投递，新的专用会话整轮通过。最终清理又因隐藏推理中的标记导致模糊定位多匹配，[失败报告](../../artifacts/notice-queue-cleanup-selector-before.json)保留；改精确正文标记后读取原两条回复并归档，没有重发消息。

[最终清理](../../artifacts/notice-queue-live-cleanup-android.json)确认原16条回复、空草稿和空通知恢复。日常绑定active、management=false，无管理授权或电脑设置修改。仅构建/安装androidTest检查包，未覆盖生产App、未重启DSH或网关；[构建日志](../../artifacts/notice-queue-test-build.log)和产物一致性通过。该专项证明实际监听器的队列阈值、自动恢复和旧连接隔离，不外推所有系统调度、257条不同真实任务或全部多设备并发。

## 五分钟后台后新待办通知（2026-10-03）

状态：正式MuMu实际停留、后台投递及恢复清理通过；维护角色：项目协作Agent；最近核验：2026-10-03。来源：[驱动](../../scripts/verify-notice-cancel-android.mjs)的`--background-dwell --preview`、[Android报告](../../artifacts/notice-background-dwell-run-android.json)、[原Host结果](../../artifacts/notice-background-dwell-host.json)。本轮未改生产App、插件或网关。

从正常公开App入口进入专用会话、保留测试草稿，再退到系统桌面。没有先发请求再等待：实际经过300119毫秒，每约30秒检查一次同一PID、App不在前台及无旧通知，共11次观察；然后原ApprovalService/UserQuestions依次发出新请求。两条实际系统通知均显示正确会话标题及对应待办文案，原生投递日志为foreground=null、started=0。电脑显式取消后，原结果分别为cancelled和ASK_ABORTED，通知与卡片移除，草稿和同一进程保持；清除观测耗时276/299毫秒仅是本轮记录，不是性能承诺。

[恢复报告](../../artifacts/notice-background-dwell-restore-android.json)确认测试草稿清空、返回原会话；原CLI卸载夹具后，[Host清理](../../artifacts/notice-background-dwell-cleanup-host.json)与[实际列表复查](../../artifacts/notice-background-dwell-cleaned-android.json)确认测试工作区登记/聊天移除、原16回复及空草稿保留、无通知。日常授权active、management=false，未授予管理权限、不调用模型或执行工具、不重启服务。

卸载后第一次立即检查读到cleaned=false，[失败记录](../../artifacts/notice-background-dwell-cleanup-before.json)保留。随后同一实例完成异步dispose，未重启或重复卸载；驱动补有界等待同一sessionId的清理结果，再检查真实列表。该失败属于检查早于运行时清理完成，不是假定CLI退出便代表清理通过。

边界：MuMu Android12、屏幕开启、ADB/WebView调试连接存在，未强制Doze或模拟系统内存回收。该结果证明此环境5分钟后台后仍能处理新审批/提问，不承诺锁屏省电、任意时长后台或全部多设备并发；进程结束不推送的约定保持。

## 聊天受阻结果显示（2026-10-03）

状态：已实现，正式MuMu实时显示与历史重入通过；维护角色：项目协作Agent；最近核验：2026-10-03。

原DSH在pre-step拒绝时可能尚未保存用户消息，只有真实turn/end blocked结算。现在通过原Conversation事件扩展注册[受阻节点](../../src/remote-turn-blocked.mjs)，由[共享消息组件](../../src/ui/RemoteMessage.jsx)显示“本轮任务受阻，未继续执行。”，保留顺序、历史与英文翻译，不补造用户消息或具体拒绝原因。相比在页面单独扫描事件，沿用原节点机制可同时服务主聊天、旁栏和插件默认渲染；上游参考、Host与中转协议没有改动。

[模型层99项回归](../../artifacts/blocked-chat-model-tests.log)包含历史受阻、实时增量、主/旁栏共用节点、重入及正常完成/取消不误报。[页面回放](../../artifacts/blocked-chat-web.json)通过主聊天/旁栏的受阻提示、中英文切换和独立草稿保持；该页面证据是协议回放，不冒充真实电脑插件。

Web构建、Android assembleDebug/lintDebug通过，新APK覆盖安装后，[真实Android报告](../../artifacts/blocked-chat-android.json)验证原Agent结算经现行0.1.75插件/网关进入自有聊天：通知开启、关闭、恢复三阶段分别显示1、2、3条受阻结果，关闭通知仍保留聊天结果；退回列表再进入仍显示3条，草稿保持。正式MuMu此次未单独重跑旁栏或英文，其证据见上述页面回放。原四类通知设置恢复，测试会话归档，返回原16回复、空草稿和空通知；临时拒绝插件已通过原CLI卸载，控制文件移除，日常设备active、management=false。

覆盖安装后冷启动的三次准备失败分别保留：[进程未就绪](../../artifacts/blocked-chat-startup-before.json)、[WebView未就绪](../../artifacts/blocked-chat-webview-before.json)、[停留Remote列表](../../artifacts/blocked-chat-home-before.json)。驱动补有界等待与选择原测试会话，失败均发生在发送前，没有修改产品迎合准备假设。产物与设备安装哈希一致，见[交付记录](./local-delivery.md)。这项修复关闭受阻显示缺口，不替代反馈或其余完整验收。

## 执行失败分类的真实受阻事件（2026-10-03）

状态：正式MuMu分类关闭/恢复已验证；当时发现的聊天显示缺口已由上方修复记录接续。维护角色：项目协作Agent；最近核验：2026-10-03。来源：[实际驱动](../../scripts/verify-blocked-category-android.mjs)、[Android完整报告](../../artifacts/notice-blocked-category-android.json)、[受控拒绝插件](../../tests/fixtures/blocked-notice-plugin/index.js)。

通过手机在DSH-TEST新建专用会话，仅发送夹具严格匹配的随机标记。原agent/pre-step拒绝，再由原Agent生成blocked结算，经现行0.1.75插件/网关传到手机；没有注入turn/end或替换通知帧，无需更换Key或模型提供方。原生设置中只切换“执行失败或受阻”：开启及恢复后均收到带会话标题和“电脑任务受阻，请打开查看”的后台通知；关闭阶段，原Host已拒绝、生成结束，2秒观察内无通知/原生display日志/重连。App进程、正确会话及未发送草稿保持，其他三个分类保持原值。

finally从同一原生入口恢复四类设置，归档测试聊天，回到原16回复、空草稿和空通知。临时插件经原CLI卸载，控制文件移除，日常设备active、management=false。生产代码、APK、Key和电脑配置未改，服务未重启。该结果补齐失败分类中真实blocked链路的抑制/恢复；不声称所有HTTP失败或输出上限都重跑了三阶段。

首轮[失败报告](../../artifacts/notice-blocked-category-before.json)和[Host记录](../../artifacts/notice-blocked-category-before-host.json)保留：误要求被pre-step拒绝的标记出现在历史。源码[agent.ts](../../../deepseek-harness/packages/core/agent-loop/src/agent.ts)确认拒绝发生在user/message写入前，因此修正为实际结算、聊天身份及草稿断言，没有修改产品来迎合检查。

**当时发现的显示缺口**：此报告的terminalView只有会话标题、模式和草稿，没有blocked结果。原ui-chat仅为[error](../../../deepseek-harness/packages/client/ui-chat/src/client/conversation-nodes/turn-error.ts)和[max-tokens](../../../deepseek-harness/packages/client/ui-chat/src/client/conversation-nodes/turn-max-tokens.ts)建立终止提示。后续通过原Conversation扩展与共享渲染补齐，当前证据见[聊天受阻结果显示](#聊天受阻结果显示2026-10-03)，旧报告保留用于说明缺陷。

## 需要批准分类关闭与恢复（2026-10-03）

状态：正式MuMu后台三阶段验证通过；维护角色：项目协作Agent；最近核验：2026-10-03。来源：[驱动的approval-category分支](../../scripts/verify-notice-cancel-android.mjs)、[实际Android报告](../../artifacts/notice-approval-category-run-android.json)、[原Host审计](../../artifacts/notice-approval-category-host.json)。生产App、插件0.1.75及网关未改，没有重启DSH或授予管理权限。

通过真实“Remote选项→Remote提醒”原生窗口，仅修改“需要批准”开关；每次读取原生UI确认四类开关，其他三类保持开启。电脑原ApprovalService在独立测试会话发起三条请求：开启时收到一条带原标题的后台系统通知；关闭时原审批卡片仍出现，2秒有界观察内无系统通知、无原生display日志，也未观察到通知连接重连；恢复后下一条请求正常产生一条带原标题的系统通知。前后正向投递与同一进程保持用于核对链路，不把2秒观察宣称为无限期保证。

每条请求均由原信号显式取消，原审计为cancelled，卡片和已有通知移除，测试草稿保持。夹具只调用原审批服务，无模型或工具执行。finally通过同一真实设置入口确认原开关恢复；[聊天恢复](../../artifacts/notice-approval-category-restore-android.json)、[Host清理](../../artifacts/notice-approval-category-cleanup-host.json)与[手机列表清理](../../artifacts/notice-approval-category-cleaned-android.json)确认专用聊天归档、工作区登记移除、原16回复/空草稿/空通知保留，临时插件已卸载。日常设备active、management=false。

本项补齐“需要批准”分类开关的实际事件抑制与恢复，不替代执行失败分类、长期后台或多设备通知检查。脚本只扩展验收流程及独立报告前缀，既有取消/标题验收路径保留。

## 待审批与提问通知标题修复（2026-10-03）

状态：插件0.1.75已安装，真实Android联动及清理通过；维护角色：项目协作Agent；最近核验：2026-10-03。

实际联动发现0.1.74处理待办摘要时直接读取未注入的sessions服务，Cordis插件作用域抛出`cannot get property "sessions" without inject`，使通知流中断。改为通过公开Context.get读取可选服务，标题缺失时仍回退应用名。新增真实插件作用域回归，保留[修复前失败](../../../plugin/artifacts/notice-preview-scope-before.log)；[插件198项测试](../../../plugin/artifacts/notice-preview-scope-tests.log)、类型检查、构建和打包通过。源码与测试见[通知服务](../../../plugin/src/task-notifications.ts)、[回归用例](../../../plugin/tests/task-notifications.test.ts)。

0.1.75安装并重启DSH后，[正式MuMu验收](../../artifacts/notice-pending-preview-run-android.json)通过：原ApprovalService/UserQuestions在专用会话产生真实待办，后台系统通知均显示“DSHM 审批超时验收”及对应待处理提示；电脑显式取消后，通知与原聊天卡片消失，草稿与后台进程保持。请求由受控夹具发起，没有模型或工具执行；不冒充模型审批全链路的新验收。

[恢复](../../artifacts/notice-pending-preview-restore-android.json)、[Host清理](../../artifacts/notice-pending-preview-cleanup-host.json)及[实际手机清理检查](../../artifacts/notice-pending-preview-cleaned-android.json)确认夹具卸载后专用会话归档、工作区登记移除，原16回复、空草稿、空通知恢复。日常设备active、management=false。App和网关未修改，DSH以原参数重启加载插件。

[首次实际失败](../../artifacts/notice-pending-preview-first-before.json)、[重启前仍失败](../../artifacts/notice-pending-preview-before-host-restart.json)和[后台恢复驱动失败](../../artifacts/notice-pending-preview-background-restore-before.json)保留；驱动改走公开App启动入口进入Remote，没有将未导出的Activity开放。当前产物一致性见[报告](../../artifacts/delivery-artifacts-current.json)。本项替代下方0.1.74记录中的“审批/提问标题未重跑Android”边界，其他具体剩余项保持。

## 会话标题与正文摘录（2026-10-03）

状态：已实现、真实MuMu完成通知与点击已验证；维护角色：项目协作Agent。依据：[问卷22及确认结论](../design/问卷结论与追问.md)。原实现只显示应用名和固定状态，与用户选择的“标题和少量正文”不一致。

插件0.1.74从原SessionTitleService读取标题，从本轮新发布的assistant/message提取纯文本。标题最多120个UTF-16字符，正文最多240个；过滤控制字符及围栏代码，不取推理、工具参数、工具输出或原异常正文。新轮次清空旧摘录；无本轮正文时仅显示标题和本地化状态。审批/提问只提供标题和固定待办提示，不读取完整审批载荷。未知标题回退应用名。

比较过收到通知后再读取会话：会多一次往返，且可能读到后续轮次。因此采用事件携带有界摘录；仅协商taskNotificationPreview=1后请求previewVersion=1，旧客户端仍收原字段，新手机连接旧插件也回退原格式。ready/resolved不变，不补发历史。来源：[电脑事件](../../../plugin/src/task-notifications.ts)、[原生订阅](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeConnection.kt)、[原生账本](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeLedger.kt)。

前台轻提示/后台通知共用摘录，系统通知仍为PRIVATE，公开锁屏版本只含应用名与通用提醒。恢复现存通知保留摘录、不重投；切语言只翻译状态。跳转只用绑定和sessionId，不解释摘要中的链接或富文本。实现：[RemoteNotifications](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNotifications.kt)。

插件197项及类型检查、网关真实HTTP/WS/SQL权限专项2项、Android构建/lint通过。[原生隔离包结果](../../artifacts/notice-preview-native.log)覆盖严格字段、超限拒绝、未协商拒绝新字段、去重/恢复及锁屏隐藏。[真实准备](../../artifacts/notice-preview-prepare-android.json)通过手机在DSH-TEST新建专用会话并调用DeepSeek。MuMu通知栏可见“DSHM 通知摘要 1791026004534”及DSHM_PREVIEW_1791026004534开头的实际回复。实际点击通知后，[检查](../../artifacts/notice-preview-inspect-android.json)确认打开对应DSHM自有聊天、实际回复及无页面错误。

[清理](../../artifacts/notice-preview-cleanup-android.json)已归档测试聊天，原16回复、空草稿、空通知恢复。日常设备active、management=false；Key和电脑设置未改。重启原DSH/网关加载新版，未改变反馈遥测目的地。此次审批/提问标题仅有Host/原生自动验证，未重跑实际Android联动；原A04其余缺口保留。

## 活跃连接实际撤权与迟到事件（2026-10-03）

状态：独立Android测试包、真实电脑授权及真实模型事件已验证；维护角色：项目协作Agent。来源：[原生专项revoke分支](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteNoticeEpochLiveChecks.kt)、[独立绑定驱动](../../scripts/verify-notice-epoch-revoke-binding.mjs)、[真实撤销](../../artifacts/notice-epoch-revoke-binding-revoke.json)、[原生结果](../../artifacts/notice-epoch-revoke-instrumentation.log)。

独立包dev.dshmobile.validation.pairingtest通过一次性链接建立“DSHM 在途撤权验证 041”测试绑定，仅授予聊天权限。专用DSH-TEST会话先保存真实SEED回复，再通过手机发送真实OLD消息并退后台。生产通知连接已真实认证，检查器只暂缓该会话已经到达WebSocket监听器的一条outcome，其他消息和关闭回调原样处理；不改票据、不伪造事件、不主动调用authorizationLost或pause。收到READY_FOR_DESKTOP_REVOCATION后，通过电脑正常管理API撤销唯一匹配ID、名称和指纹的测试设备，权威状态为revoked，日常绑定保持active、management=false。

手机生产连接随实际撤权进入unauthorized、Socket清空、连接代次推进、无系统提醒；随后把暂缓的真实事件交回旧监听器，仍保持unauthorized且没有通知。调用生产restart后再次被真实鉴权拒绝，未建立新Socket；Instrumentation返回PASS、code=-1。此项补齐活跃连接实际撤权后迟到事件的隔离，不外推未被系统调度到的任意事件顺序或多设备审批冲突。

[页面与绑定清理](../../artifacts/notice-epoch-revoke-binding-cleanup.json)确认手机显示授权失效、正式重新连接入口被拒绝、无聊天入口；测试绑定已从独立包移除，该包force-stop且无通知。[会话清理](../../artifacts/notice-epoch-revoke-cleanup-android.json)由日常手机读取测试SEED/OLD两条真实回复后归档，原16条回复、空草稿及空通知恢复。日常绑定未授予管理权限、未撤销，Key和电脑配置未改，未重启电脑服务。

[独立测试包构建](../../artifacts/notice-epoch-revoke-build.log)与[正常构建恢复](../../artifacts/notice-epoch-revoke-normal-build.log)通过；日常App没有覆盖安装，恢复后的APK与构建前保存副本同为SHA256 b193daf36bd38a1921dfa8131b84ae5959eaef25edd10a9f0625fe1990f2ab0b。117个Web文件、插件0.1.73、73个后端文件产物一致。手机脚本语法通过，本轮无生产代码变更。

## 真实WebSocket事件跨原生连接换代（2026-10-03）

状态：正式MuMu App的生产通知连接与真实电脑事件已验证；维护角色：项目协作Agent。来源：[原生联网专项](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteNoticeEpochLiveChecks.kt)、[手机操作驱动](../../scripts/verify-notice-epoch-live-android.mjs)、[Instrumentation结果](../../artifacts/notice-epoch-live-instrumentation.log)、[测试包构建](../../artifacts/notice-epoch-test-build.log)。只安装更新androidTest包，没有覆盖日常App；生产代码、Key、电脑设置与网关/DSH进程未改。

专项通过正式入口启动Application，等待已有绑定完成真实认证和taskFollow订阅。只旁听专用Session的一条真实outcome：将原WebSocket监听器的onMessage安排在主线程回合内，先让它按生产路径排队，再调用生产pause失效连接。待排队回调执行后，状态保持paused且没有该会话系统通知。随后通过生产restart重新认证、取得新Socket，把原帧原样交给旧监听器，并补入旧Socket的迟到failure/closed回调；新连接仍listening、Socket身份不变、无旧提醒。没有伪造票据、ready或outcome；两个迟到关闭/失败回调是显式受控输入，不冒充网关实际撤权。

[旧事件发送](../../artifacts/notice-epoch-live-old-android.json)与[新事件发送](../../artifacts/notice-epoch-live-fresh-android.json)均由手机正式聊天入口发给真实DeepSeek模型，不调用工具。旧回调检查通过后，第二条真实回复正常投递且系统中只有一条该会话提醒；Instrumentation返回PASS、code=-1。测试最终恢复原监听器及通知接收状态；[清理](../../artifacts/notice-epoch-live-cleanup-android.json)重新打开专用聊天读到OLD/FRESH两条真实回复后归档，原16条回复、空草稿和空通知恢复，日常设备active、management=false。产物校验117个Web文件、插件0.1.73和73个后端文件仍一致。

失败与边界：[Application尚未初始化](../../artifacts/notice-epoch-instrumentation-initial-before.log)、[空会话不在最近列表](../../artifacts/notice-epoch-empty-chat-before.json)、[重建空会话ID不同](../../artifacts/notice-epoch-empty-id-before.json)及[未产生事件的超时](../../artifacts/notice-epoch-no-outcome-before.log)保留；这些轮次没有发送被测模型请求。最终先用一条真实SEED回复建立持久测试会话，再启动专项。不把空会话重建当作旧会话恢复。实际代码只修正验收入口及等待顺序，未宣称修复产品问题。

该项证明真实通知帧排队后遇到本机显式断开、旧Socket回调迟到于新连接的隔离，以及后续真实投递；不能替代当前连接遭网关实际撤权时的在途竞争、多设备冲突或任意系统调度。已通过的连接换代不再笼统列为未验。

## 嵌套孙会话的真实通知跳转（2026-10-03）

状态：正式MuMu、真实电脑模型与系统通知已验证；维护角色：项目协作Agent。来源：[驱动](../../scripts/verify-notice-nested-android.mjs)、[三层会话与实际通知](../../artifacts/notice-nested-prepare-android.json)、[孙会话回复检查](../../artifacts/notice-nested-inspect-android.json)、[逐层返回](../../artifacts/notice-nested-verify-return-android.json)。

通过正式手机插件设置页，将电脑Subagent最大递归深度从默认继承的1临时调整为2，[保存及重新读取](../../artifacts/notice-nested-depth-on-android.json)确认。专用DSH-TEST聊天使用真实DeepSeek-V41-Flash创建中层子代理，再由中层创建孙会话；不读写项目文件、不执行命令。App退后台后，三个不同Session均产生实际完成提醒；父任务可因子任务结算再次唤醒，因此实际提醒数量不固定为三条。

通过MuMu实际通知栏逐条点击，先确认根会话和中层，最终剩余通知打开“DSHM 最深层 1791022800756”，读取到真实回复标记。点击“返回父会话”进入中层，再次返回进入原根会话，未发送草稿保持；通知全部消费，同一App进程17746、页面错误为空。没有注入通知目标或替换电脑会话数据。本项补齐实际孙会话目标的证据，不外推孙会话冷启动、WebSocket在途撤权或多设备冲突。

原检查报告保留一次失败：返回中层后，标题插件尚未挂载，短暂显示首条消息摘要，立即比对“DSHM 中层测试”失败；此时孙会话回复已经通过检查。后续独立返回报告确认稳定的中层标题、再次返回根会话与草稿保持。驱动现等待标题稳定；不是生产修复，也未重复发送模型请求。[授权变更后未重连](../../artifacts/notice-nested-grant-reconnect-before.json)及[内测声明遮挡](../../artifacts/notice-nested-onboarding-before.json)两次准备失败也保留，均发生在修改深度前。

[设置恢复](../../artifacts/notice-nested-depth-off-android.json)确认深度恢复1且overridden=false，并发容量8及继承状态未变；[清理](../../artifacts/notice-nested-cleanup-android.json)归档专用根会话、清空测试草稿；[收回管理权限后的重连检查](../../artifacts/notice-nested-restored-android.json)确认原“DSHM Remote 联调提示”16条回复、空草稿及空通知。管理权限已收回，聊天授权保持；未改Key、生产代码、APK或重启电脑服务。

## 通知读取回执迟到于重新连接（2026-10-03）

状态：正式MuMu App与真实电脑会话通过；维护角色：项目协作Agent。来源：[驱动](../../scripts/verify-notice-late-reconnect-android.mjs)、[真实完成提醒](../../artifacts/notice-late-reconnect-prepare-android.json)、[断开重连与迟到回执](../../artifacts/notice-late-reconnect-navigate-android.json)、[清理](../../artifacts/notice-late-reconnect-cleanup-android.json)。

专用DSH-TEST聊天使用真实DeepSeek模型产生回复与系统通知。实际通知栏点击后，检查器只暂缓一次原生`notifications.take`回执，身份、目标与后续请求原样传递；手机正式连接入口断开再连接，重新打开原聊天后才交回旧回执。暂缓3614ms，早于生产桥30秒超时；因此不是等待超时替代连接隔离。旧目标没有切走当前会话，没有发送旧通知ack，原未发送草稿保持，系统提醒已随显式断开清除，同一App进程与页面无错误。拦截器最终移除，专用聊天归档，原16条回复、空草稿、无通知恢复，日常授权保持active、management=false。

本项覆盖真实原生读取回执跨显式断开/重连的页面导航竞争，不伪造通知、不替换认证或DSH数据，不证明通知WebSocket在途帧撤销、连接换代或所有多设备并发。生产代码、APK、电脑配置与服务进程未改。

准备失败保留：[模型弹窗尚未结束时发送被禁用](../../artifacts/notice-late-reconnect-model-sheet-before.json)、[准备草稿未保持](../../artifacts/notice-late-reconnect-draft-before.json)。驱动增加模型窗口关闭、正确会话历史载入与草稿保持断言后继续同一测试聊天，没有重复发送首轮失败请求。额外[草稿入口检查](../../scripts/verify-draft-entry-timing-android.mjs)在正式App中分别以fill和逐键输入各两次，导航重入后均保持并清理，见[四次结果](../../artifacts/draft-entry-timing-android.json)。没有再次复现草稿丢失，不能据此确定首次失败的产品根因；旧节点在输入前已替换，节点探针events为空，不用它证明输入事件可信性或全部时序已覆盖。

## Android销毁后台页面后的恢复（2026-10-03）

状态：MuMu正式App、真实模型会话与系统通知通过；维护角色：项目协作Agent。来源：[实际驱动](../../scripts/verify-activity-destroy-android.mjs)、[页面销毁与后台通知](../../artifacts/activity-destroy-prepare-android.json)、[实际点击后检查](../../artifacts/activity-destroy-inspect-android.json)。

通过系统开发者选项临时启用“不保留活动”。专用DSH-TEST会话发送仅要求回复标记的消息并留下未发送草稿，退后台后系统事件明确记录RemoteActivity的`always-finish`和`performDestroy`，WebView确实关闭；App进程PID17746保持。随后真实电脑回复产生一条系统通知。实际通知栏点击后，重新建立页面及连接，打开正确会话、读取最新模型回复、恢复草稿，提醒被消费，页面错误为空。未注入导航目标或通知，也未调用电脑工具。

[初次失败](../../artifacts/activity-destroy-setting-only-before.json)显示只写Settings数据库并未销毁页面，不能算通过；其设置已还原，回复和草稿继续用于同一专用测试会话。第二次通过系统开关才实际生效。驱动现要求系统开关预先启用及记录原值，结束后必须通过系统开关关闭，不能只删除设置键当作系统恢复。

[系统恢复记录](../../artifacts/activity-destroy-system-restored.json)确认先在系统界面关闭到0，再还原原先不存在的设置键；[清理报告](../../artifacts/activity-destroy-cleanup-android.json)确认专用会话归档、原“DSHM Remote 联调提示”16条回复与空草稿恢复、通知为空。最终MuMu可见页面亦核对为原聊天；日常授权active、management=false，无管理权限变更。没有更换APK、修改生产代码或重启电脑服务。

这证明系统销毁Activity而App进程存活时的通知与会话恢复，不等于内存不足自然回收、长时间后台或任意厂商系统存活保证。后续剩余项按下方清单，已验证的Activity销毁路径不再笼统列为未验。

## 子会话通知冷启动修复（2026-10-03）

状态：生产修复已装，MuMu真实冷启动直接子会话通过；维护角色：项目协作Agent。来源：[共用会话入口](../../src/remote-session-view.mjs)、[原目录自动回归](../../tests/remote-model.test.mjs)、[实际Android驱动](../../scripts/verify-notice-child-android.mjs)、[独立进程检查](../../scripts/verify-notice-child-process.mjs)。

旧App的实际进程30220退出后，系统通知仍保留；点击后新进程16412显示`session/agent-busy`且缺少子会话入口。见[旧进程检查](../../artifacts/notice-child-cold-process-android.json)和[真实故障](../../artifacts/notice-child-cold-navigation-before.json)。原因是冷启动的会话列表含`origin=subagent`和`parentId`，但原客户端的地址解析只查询已加载目录；把裸ID当普通会话retain会使用错误路径。测试先进入父聊天、再退出整个App进程，不能把旧进程曾打开父目录当作新进程具有缓存。

修复在原共享选择入口完成：摘要明确为subagent时，先调用现有`refreshSubagents(parentId)`取得原电脑目录，由原`subagentAddress`确认mode与直接父子归属，才保留会话引用。目录缺失、服务不可用或读取失败不退回普通Agent入口；读取期间新导航/视图释放使旧结果失效。普通聊天、显式子地址和已缓存地址沿用原行为。相比给通知载荷新增父地址字段，此方案复用已有权威目录，并覆盖其他按ID进入的共享视图；没有新增权限或凭空猜测子会话类型。

[修改前自动失败](../../artifacts/notice-child-cold-regression-before.log)与[98项通过](../../artifacts/notice-child-cold-regression.log)覆盖原客户端目录与生成协议、主/独立会话视图、直接子会话/孙会话按ID打开、目录缺失/失败保留旧引用与草稿、迟到结果竞争。[Web构建](../../artifacts/notice-child-cold-web-build.log)、[APK构建和lint](../../artifacts/notice-child-cold-android-build.log)通过，新APK覆盖安装、117个Web文件一致，设备上APK哈希与[交付报告](../../artifacts/delivery-artifacts-current.json)一致。

新版真实验证使用独立测试聊天及真实DeepSeek子任务：[通知准备](../../artifacts/notice-child-cold-fixed-prepare-android.json)保留了“期待2条但实际3条”的断言失败——子任务通知父任务会触发额外结算，不是通知丢失。驱动已改按两个不同会话核对，并排除Android自己的`ranker_group`汇总通知。父通知实际打开后，其余唯一子通知被保留。[独立进程检查](../../artifacts/notice-child-cold-fixed-process-android.json)确认16866已退出且该通知仍在；随后MuMu实际通知栏点击，新进程17746正确打开子会话。[最终观察](../../artifacts/notice-child-cold-fixed-inspect-android.json)退出0，原回复标记、子会话入口、返回父会话后草稿保持，alerts/errors均空，通知消费完毕。

测试失败也保留：[检查器连接时am kill未退出](../../artifacts/notice-child-cold-fixed-debugger-attached-before.json)、[重装后停留Remote首页](../../artifacts/notice-child-cold-fixed-home-entry-before.json)、[重复回复标记的严格选择器](../../artifacts/notice-child-cold-fixed-marker-selector-before.json)。不能把`am kill`命令返回0或`device.close()`返回当作进程已结束；检查器完全退出后再执行独立PID核对。没有使用force-stop删除通知，也没有直接注入通知目标。

[旧失败场景恢复](../../artifacts/notice-child-cold-recover-android.json)、[旧场景清理](../../artifacts/notice-child-cold-cleanup-android.json)与[新版最终清理](../../artifacts/notice-child-cold-fixed-cleanup-android.json)均通过。两次专用根会话已归档，日常“DSHM Remote 联调提示”16回复和空草稿恢复，系统通知为空，日常设备active、management=false。未更改电脑Key、插件、服务进程或管理权限。实际孙会话通知、在途换代和并发仍未由本次证明。

## 后台子会话完成通知点击（2026-10-03）

状态：MuMu同一存活进程内、父会话已打开的直接子会话点击通过；维护角色：项目协作Agent。来源：[实际Android驱动](../../scripts/verify-notice-child-android.mjs)、[生产通知导航](../../src/RemoteApp.jsx)、[原地址解析入口](../../src/remote-session-view.mjs)。没有修改生产代码或重装APK。

专用新聊天通过真实DeepSeek模型调用原subagent，产生独立可继续子会话及其实际回复；手机此前没有进入子会话页面。[准备报告](../../artifacts/notice-child-prepare-android.json)记录父会话和子会话的不同通知key、父草稿保持。MuMu实际通知栏先点击父通知，再点击剩余子通知。后者进入`DSHM 通知子会话 1791019556621`，回复`DSHM_NOTICE_CHILD_1791019556621`可见，页面具有“返回父会话”；点击返回后父草稿仍为原测试标记，见[目标检查](../../artifacts/notice-child-inspect-android.json)与[返回独立复核](../../artifacts/notice-child-verify-return-android.json)。目标检查因标题包含“1 个子代理”的旧断言退出1，不能写成脚本整轮退出0；此前内容等待和返回操作已经执行，后续独立复核退出0。

首次消息因继承已移除的故障注入提供方`dshm-notice-error-7e176a66`未成功发送，见[首次报告](../../artifacts/notice-child-unavailable-model-before.json)；在专用聊天模型选择器切回现有DeepSeek-V41-Flash后才出现真实通知，不把首次失败归因于通知服务。另保留[子标题选择器失败](../../artifacts/notice-child-heading-selector-before.json)和[恢复历史尚未加载的失败](../../artifacts/notice-child-history-loading-before.json)；驱动已改用标题首行、等待原回复条数就绪。没有重写这些失败产物。

[最终清理](../../artifacts/notice-child-cleanup-android.json)确认回到原聊天、16条回复与空草稿保持、系统通知为空。专用根会话已通过正式归档入口归档，其文件记录保留；未安装临时插件、未新增工作区或授予管理权限，日常设备active、management=false。本项只证明已有父目录的直接子会话；冷启动尚未加载父目录、孙会话目标及在途换代不由本次证明。

## 点击已消失会话的通知（2026-10-03）

状态：正式MuMu失效目标提示与原聊天保护通过；维护角色：项目协作Agent。来源：[通知导航](../../src/RemoteApp.jsx)、[会话选择](../../src/remote-session-view.mjs)、[实际驱动](../../scripts/verify-notice-missing-android.mjs)、[临时原Session夹具](../../tests/fixtures/notice-overflow-plugin/index.js)。

在专用“DSHM Remote联调提示”原空草稿中填入固定测试文本，未发送。App退后台后，由独立原Session结算产生真实系统通知，见[准备报告](../../artifacts/notice-missing-prepare-android.json)。随后CLI卸载夹具并重启DSH，临时内存Session不再存在；保留手机进程和系统通知，没有删除用户会话。

通过MuMu通知栏点击实际通知。[观察报告](../../artifacts/notice-missing-inspect-android.json)确认显示“暂时无法打开提醒对应的聊天，请检查电脑连接后重试。”，仍停留原聊天，16条模型回复和未发送测试草稿保持，系统通知已消费，errors为空。代码在目标retain失败前保留旧引用，与实际结果一致；不把通用错误文案说成已区分“已删除”和网络故障，也不外推撤销设备或所有复杂子会话地址。

[清理报告](../../artifacts/notice-missing-cleanup-android.json)确认测试草稿清空、原回复数不变、临时包已从profile清单移除；仅删除CLI留下且指向已知夹具的junction，源代码保留。DSH按原参数恢复PID23568、网关70308保持运行（仅本次状态），设备active、management=false。生产代码和APK未改，无模型请求、Key或反馈目的地变更。错误提示保留在原聊天作为本次预期结果，不把“已显示错误”描述为无错误提示的成功导航。

## Android系统渠道禁用与恢复（2026-10-03）

状态：MuMu Android12正式App通过；维护角色：项目协作Agent。使用[分类驱动](../../scripts/verify-notice-category-android.mjs)的`--system-channel`分支，经App“Remote提醒→系统通知设置”进入Android页面，关闭/恢复“任务完成”渠道。App自己的分类保持开启，系统总开关和其他渠道保持原状。

同一独立原Session三次受控completed结算经Host、网关、原生通知连接到达Android。每次都核对原生日志`foreground=null started=0`，证明App处于后台且事件已到达；不以“没有系统通知”推断事件已接收。系统设置从精确包名`dev.dshmobile.validation`读取，避免与独立验收UID混淆。

| 阶段 | 系统权威状态与结果 |
| --- | --- |
| [开启](../../artifacts/notice-channel-before-android.json) | 渠道importance=3，产生1条对应Session通知 |
| [关闭](../../artifacts/notice-channel-disabled-android.json) | importance=0，旧通知被系统移除；新事件已到达，2秒观察无对应通知 |
| [恢复](../../artifacts/notice-channel-restored-android.json) | importance恢复3，后续新事件产生1条通知 |

三阶段保持同一App进程、原聊天/草稿及连接，errors为空。结果覆盖系统渠道对实际后台通知的抑制与恢复，不外推所有Android版本、锁屏策略、任意延迟或多设备并发；事件由原Session夹具产生，不冒充模型执行。

测试后清除本轮通知并恢复渠道开启，返回原聊天。[清理报告](../../artifacts/notice-channel-cleanup-android.json)核对渠道importance=3、无残留App通知、临时插件已卸载、聊天在线及空草稿。CLI卸载后的junction仅在确认精确指向夹具后移除，源文件保留；DSH原参数恢复PID30516、网关70308未变（日后不能复用这些PID）。日常身份active、management=false，未修改生产代码或重装APK，未更换Key或反馈目的地。

## 任务完成分类关闭与恢复（2026-10-03）

状态：MuMu正式App前台分类开关通过；维护角色：项目协作Agent。来源：[原生分类入口](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNotifications.kt)、[验收驱动](../../scripts/verify-notice-category-android.mjs)、[独立原Session夹具](../../tests/fixtures/notice-overflow-plugin/index.js)。未修改生产代码/APK，未请求模型或改写用户会话。

通过电脑CLI临时安装原队列验收夹具并重启DSH，本次仅使用fresh动作，向独立原Session连续三次分别append一轮completed结算，经现有Host/网关/Android链路投递。原生“Remote提醒”页通过模拟器界面操作，其他三个分类始终开启。

| 阶段 | 实际结果 |
| --- | --- |
| [原开关开启](../../artifacts/notice-category-before-android.json) | 第1轮显示1次完成提醒 |
| [关闭任务完成](../../artifacts/notice-category-disabled-android.json) | 原生UI读回该项false，第2轮结算后的2秒观察无display；无重连迹象 |
| [恢复开启](../../artifacts/notice-category-restored-android.json) | 原生UI读回全部分类true，同一Session第3轮显示1次；同进程、原页面和空草稿保持 |

所有报告errors为空。两侧正向事件与连接状态证明同一真实链路可投递；关闭阶段只声称2秒内无显示，不以有限观察保证任意延迟，也不把受控Session结算说成模型真实执行。本项是App前台轻提醒的“任务完成”分类，不等同Android系统通知渠道关闭、后台投递或其他三类开关的全部场景。

原CLI卸载后再次核对并仅删除指向本夹具的遗留junction，夹具源码保留；按原参数恢复DSH为PID51364、网关70308保持运行（仅本次状态）。[清理报告](../../artifacts/notice-category-cleanup-android.json)确认profile列表已无临时包、原聊天在线、草稿为空；恢复阶段报告保留开关原状证据。控制文件删除，日常身份active、management=false。反馈收集器及其待用户手动准备状态未改变。

## Host队列溢出后的实际重连（2026-10-03）

状态：新版MuMu正式App通过真实Host队列溢出、自动重新订阅和后续提醒投递；维护角色：项目协作Agent。来源：[生产队列](../../../plugin/src/task-notifications.ts)、[原生连接](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeConnection.kt)、[临时测试插件](../../tests/fixtures/notice-overflow-plugin/index.js)、[Android驱动](../../scripts/verify-notice-overflow-android.mjs)、[实际报告](../../artifacts/notice-overflow-android.json)。

临时插件创建独立的原Session，同一同步循环append 257组turn/start与turn/end，引发生产256条通知队列真实超限。不伪造网关错误帧，不替换手机连接、认证或账本；这些结算由夹具产生，不代表模型执行257次。原生连接仅增加DEBUG固定`stream_overflow`日志，须收到真实`remote_notifications_overflow`才输出，不记录帧、身份或通知内容。重连算法没有修改。

07:46:38Z实际MuMu观察到stream_overflow→retrying→listening，同一App进程自动恢复；突发旧结算没有补发。随后向同一测试Session追加第258轮，正式RemoteActivity收到一次完成提醒；errors为空，原联调聊天标题和草稿保留。本项覆盖Host队列超限经真实网关到原生连接的自动重试；不等同Android主线程自身积压256帧、任意突发负载或所有通知异常。

Web资源未改。[APK构建及lint](../../artifacts/notice-overflow-build.log)通过，新APK已覆盖安装。测试插件经原CLI[安装](../../artifacts/notice-overflow-install.log)后重启DSH，再[卸载](../../artifacts/notice-overflow-uninstall.log)并按原参数恢复。pnpm卸载后留下未登记junction，首次只读列表核验因此失败；核对链接精确指向本项目fixture后仅删除junction，源fixture保留，未递归删除目录。最终[清理报告](../../artifacts/notice-overflow-cleanup-android.json)确认profile列表不再包含fixture、原聊天在线、空草稿、errors为空，控制文件移除。日常身份active且management=false，未改Key或用户会话、未授予管理权限、未调用模型。DSH恢复PID31144，网关70308，仅为本轮状态。

## 后台独立通知连接恢复（2026-10-03）

状态：实际MuMu后台连接恢复及返回前台在线复验通过；维护角色：项目协作Agent。来源：[独立连接驱动](../../scripts/verify-notice-transport-recovery-android.mjs)、[实际报告](../../artifacts/notice-transport-recovery-android.json)、[返回前台报告](../../artifacts/notice-transport-recovery-return.json)。

用户重新允许操控后，确认桌面已解锁、DSH与网关在运行，原Android身份active且management=false。模拟器的ADB reverse映射已丢失，恢复`tcp:8787`映射并点击App“重新连接”后，自有Remote页面在线、alerts为空；不需要重新配对。此前等待不能仅归因于page事件竞态，本次已确认本地联调网络前提缺失。

App进入后台后，核验网关进程身份再停止并按原参数恢复。正式原生通知连接实际经过listening→retrying→listening，PID3332不变，恢复时App仍在后台。未发送模型消息、修改Key或授予管理权限；网关恢复为PID68968、DSH为PID73752，仅为本次运行记录。该结果覆盖真实网关中断后的自动恢复，不等同Host队列溢出后的整链路重试或全部通知异常。

首次重新打开RemoteActivity的命令曾被自动审批以`blocked by policy`拒绝，未通过其他工具重试。随后用户手动打开 App→Remote 并回复“已打开”；只读复查确认在线且 alerts 为空，返回前台这一步已完成。后台驱动退出0，服务运行；Host队列溢出后的Android重试现由[独立专项](#host队列溢出后的实际重连2026-10-03)验证，不由本次网关重启推断。

## 2026-10-03验收环境恢复与中断

DSH及网关已按原参数恢复监听3080/8787，既有Android身份仍active、management=false。正式App已冷启动，但进入Remote的验收驱动尚未生成新报告便被中止；用户按Esc停止电脑操控后，已结束该驱动，不把服务恢复当作手机验收通过。

后续仅只读连接调试端口，确认精确PID的WebView可发现、两种自有页面可连接。源码检查发现[通知驱动](../../scripts/verify-notifications-android.mjs)点击Remote后可能遗漏已发生的page事件，现先重查现有页面并为后续事件设置60秒上限。语法检查通过；未重跑界面步骤，不能认定该竞态是此前等待的唯一根因。恢复界面验证仍需用户允许继续操控；不通过ADB输入绕过用户中止。

状态：验收工具已修改、实际入口待复验；维护角色：项目协作Agent；核验日期：2026-10-03。生产App代码及设备授权未修改。

## 进程结束后不接收新提醒（2026-10-02）

状态：实际 force-stop 路径通过；维护角色：项目协作 Agent。来源：[驱动](../../scripts/verify-error-notification-live.mjs) `--limit --killed`、[实际报告](../../artifacts/killed-notification-live.json)。

电脑已向本机端点发出请求后，手机退后台并 force-stop；轮询确认原 PID9695 消失，端点才释放 length 结算。两秒观察期内无 App 进程、无该 App 系统通知。用户式启动普通聊天并进入 Remote 后，新 PID16663 连接电脑，读取到部分回复，系统未补发该历史提醒。测试 Key/提供方移除、会话归档、原草稿保留、管理权限收回通过。该测试不证明无限后台观察或系统自然低内存回收；后者此前的既有通知恢复证据独立保留。

最初 `am kill` 未结束进程，[失败报告](../../artifacts/killed-notification-live-kill-failed.json)保留，不能当成进程结束。首轮清理时 App 仍在桌面，已改用实际启动普通入口回前台，停止遗留生成并[清理测试资源](../../artifacts/killed-notification-live-cleaned.json)后再执行 force-stop 验证。产品逻辑和 APK 未改。

## 受阻的实际通知链路（2026-10-02）

状态：原 DSH pre-step 拒绝→原结算→网关→MuMu 系统通知通过。维护角色：项目协作 Agent。来源：[原结算分支](../../../deepseek-harness/packages/core/agent-loop/src/agent.ts)、[临时测试插件](../../tests/fixtures/blocked-notice-plugin/index.js)、[独立匹配检查](../../scripts/check-blocked-notice-fixture.mjs)、[手机驱动](../../scripts/verify-error-notification-live.mjs) `--blocked`、[实际报告](../../artifacts/blocked-notification-live.json)、[Host记录归档](../../artifacts/blocked-notice-before-category-host.json)。

临时插件只拦截与控制文件唯一标记完全匹配的消息，通过原 `agent/pre-step` 返回 reject，不注入 turn/end。正式手机新建专用会话、发送该标记，待 App 退后台后释放拒绝；系统显示“电脑任务受阻，请打开查看”，点击进入正确测试聊天，原生成结束。端点请求数为零、页面 errors 为空。缺少控制或其他消息放行已有[检查结果](../../artifacts/blocked-notice-fixture-check.log)。

测试 Key 与提供方移除、测试聊天归档、原聊天草稿保持、管理权限收回通过。控制文件已移除，原 CLI [卸载临时插件](../../artifacts/blocked-notice-uninstall.log)，DSH 按原启动参数恢复（本轮 PID76804，后续须重新核验）。这是受控插件拒绝触发的真实结算，不外推所有业务策略或任意第三方插件；三种结束原因的指定链路现均有实际证据，其余 A04 异常另行核对。

## HTTP失败的实际通知链路（2026-10-02）

同一[驱动](../../scripts/verify-error-notification-live.mjs)的 `--limit` 分支另已通过[实际报告](../../artifacts/limit-notification-live.json)：本机端点通过真实流式 HTTP 返回部分文字和 `finish_reason: length`，原 pi-ai 映射及 DSH 结算后，后台系统通知准确显示“电脑任务达到输出上限”；点击回到对应专用聊天，部分回复 `DSHM_LIMIT_PARTIAL_OUTPUT` 仍可读。没有直接注入 `turn/end`。测试 Key/提供方移除、会话归档、原草稿保持、管理收权均完成。模型响应由受控端点产生，不冒充真实外部模型消耗全部 token；本证据验证上限标记经生产链路的处理。blocked 的 Host 结算仍待专项。

状态：本机端点真实 HTTP 错误→DSH→网关→MuMu 通知通过。维护角色：项目协作 Agent。来源：[驱动](../../scripts/verify-error-notification-live.mjs)、[实际报告](../../artifacts/error-notification-live.json)。报告时间为2026-10-01T20:01:59Z（本地2026-10-02）。

正式手机入口创建专用提供方，通过原生密码窗口配置本次生成、无外部用途的测试 Key。在专用新聊天选择该模型并发送一次，DSH 实际 POST `/v1/chat/completions` 到本机端点，认证匹配；端点暂缓响应至 App 退到后台，再返回 HTTP 400。Android 系统通知显示“电脑任务执行失败”，点击实际通知后回到对应测试会话，生成已结束。未伪造结算事件或替换手机/网关/DSH响应。

原生移除测试 Key、移除提供方、归档测试会话及原聊天草稿保持均通过，页面 errors 为空；临时管理权限已收回。生产代码和日常 APK 未改。此项证明受控上游 HTTP 错误的真实结算和通知投递，不等同外部服务故障、blocked/max-tokens 结算或全部 A04 完成。

## 失败原因的系统投递检查（2026-10-02）

早期端到端尝试经正式手机入口创建无认证专用提供方与测试会话，消息确已发送，但 DSH 在 HTTP 前返回 `No API key for provider`，本机端点请求数为零，见[保留的失败报告](../../artifacts/error-notification-live-no-key.json)。该轮提供方移除、会话归档、原草稿保留、管理权限收回。后续使用原生独立测试 Key 的结果见上节；不以无 Key 失败冒充 HTTP 400 结算。先前重连/引导/选择器/切换未完成导致的驱动失败记录分别保留，产品代码未改。

状态：独立 Android 测试包通过；维护角色：项目协作 Agent。来源：[原生检查](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteNotificationRestoreChecks.kt)、[构建日志](../../artifacts/notice-outcome-build.log)、[实际运行结果](../../artifacts/notice-outcome-native.log)。

受控 error、blocked、max-tokens 结算帧经过生产 RemoteNoticeLedger 和 RemoteNotifications，到 MuMu 真实 NotificationManager。核对三条通知均使用失败分类但摘要各异、具有点击入口和私密可见性/公开版本；同一事件重复到达不再次投递，重新创建通知对象保留原系统通知时间。关闭 error 分类后清除三条旧通知，并抑制后续错误事件。

测试仅使用 pairingtest 独立 UID 的虚构会话和绑定摘要，不读取日常凭据、不调用模型。测试通知和偏好在 finally 清理，测试进程停止；日常设备管理权限仍为 false。该证据补足原生投递与恢复层，不代表真实 Host 失败结算、传输中断或实际点击导航已经覆盖。完整 A04 继续按具体缺口验收。

## 标准Android发送时区与通知投递（2026-10-02）

- 状态：发送兼容问题已修复，标准API36.1真实发送、通知及点击通过；维护角色：项目协作Agent。来源：[发送边界](../../src/remote-transport.mjs)、[实际驱动](../../scripts/verify-standard-notification-live.mjs)、[时区失败记录](../../artifacts/standard-notification-live-timezone-failure.json)。
- 首次记录的`sent:true`只代表点击发送，不是电脑接受。补充另一台已绑定手机的同会话检查后，发现发送端保留草稿并提示`clientTimeZone must be UTC or a valid IANA Area/Location name`。Android系统为GMT，但实际WebView的Intl返回`+00:00`；首轮只处理GMT仍失败，[证据保留](../../artifacts/standard-notification-live-offset-failure.json)。
- 主聊天和子会话共用RemoteTransport提交边界现将GMT、+00:00、-00:00规范为UTC，图片分片也经过同一边界。不修改原请求、其他地区时区、非零偏移或其他接口，不放宽Host校验；上游参考未改。
- [真实复测](../../artifacts/standard-notification-live-shade-failure.json)已证明另一台手机收到测试消息、发送端草稿清空且无错误，并产生系统通知；当时通知栏未展开，不能证明通知类别或点击跳转。后续驱动等待真实系统控件并在开始/清理时收起通知栏，避免遮挡系统权限窗口。所有已配对测试设备均已撤销并确认界面移除。
- [109项专项](../../artifacts/timezone-regression.log)、[419项完整回归](../../artifacts/timezone-full-regression.log)及[APK构建/lint](../../artifacts/timezone-android-build.log)通过。单元检查覆盖两个提交入口的时区、原请求保留和图片分片；不替代真实子会话图片验收。首次失败不归因为通知通道故障，完整A04仍未完成。
- [最终实际报告](../../artifacts/standard-notification-live.json)：16:26:35Z开始，WebView时区仍为+00:00，真实系统弹窗允许通知，临时设备只授聊天权限。通过另一台已绑定手机看到同会话测试消息确认Host接收，标准App退到桌面后收到“电脑任务已完成”，[通知栏截图](../../artifacts/standard-notification-live.png)已核对；点击进入专用会话并显示真实模型回复，草稿为空、errors为空。随后撤销临时设备，电脑状态revoked且手机聊天界面移除，测试App已停止。未调整系统时区或替换模型、没有修改日常设备权限；不将该专项扩大为全部通知类别/真机/进程回收场景通过。
- 新版覆盖安装日常MuMu后，[普通聊天→Remote正常入口](../../artifacts/timezone-mumu-open.json)16:28:45Z实际连接成功、无alerts。复核本轮所有通知测试设备均已撤销，日常设备仍active且management=false；独立标准模拟器已关闭。

## Android 13以上通知权限恢复（2026-10-01）

- 状态：API36.1标准模拟器的正式普通聊天设置入口已验证；维护角色：项目协作Agent。来源：[共享原生实现](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNotifications.kt)、[实际操作脚本](../../scripts/verify-notification-permission-android.mjs)。
- [修复前](../../artifacts/notification-permission-before.json)：实际连续拒绝两次后，系统不再弹窗，App仍requestPermissions，第三次点击不能进入设置。现记录是否曾请求，并结合系统shouldShowRequestPermissionRationale判断：仍可请求时弹窗，否则进入本App系统通知设置。普通与Remote桥均调用该共享入口，不改变通知类别或后台连接规则。
- [修复后](../../artifacts/notification-permission-android.json)：独立pairingtest包从正式设置页连续拒绝两次，再点击进入系统通知设置，实际开启开关后系统POST_NOTIFICATIONS为granted=true；返回App重开面板显示“系统通知设置”，errors为空。结束测试包关闭并撤销测试通知权限。只清理独立测试包数据，未使用或变更日常绑定。
- [初次环境失败](../../artifacts/notification-permission-system-ui-failure.json)由系统“System UI isn't responding”窗口遮挡，选择Wait后恢复；不算App失败或通过。[构建和lint记录](../../artifacts/notification-permission-final-build.log)。
- 日常APK构建/lint通过并覆盖安装。MuMu Android12正式[普通设置入口](../../artifacts/notifications-ordinary-settings-android.json)、[Remote正常连接](../../artifacts/notifications-open-android.json)与[Remote设置入口](../../artifacts/notifications-settings-android.json)通过打开检查；系统原生窗口另核对“系统通知设置”按钮可见。旧驱动输出报告后调试连接不退出，报告落盘后主动结束驱动，不冒充自行退出0。
- 范围：本次标准模拟器未绑定电脑，证明权限拒绝与恢复入口，不证明该环境真实Remote通知投递；MuMu上述检查也不等于重新测试全部通知投递。完整A04未完成。

已修复冷启动清空其他待处理通知的问题：只恢复系统中仍存在的本机通知记录，不重新发送。MuMu两条通知跨进程依次点击、正确会话、取消回电脑及草稿保留通过，见[多条通知冷启动恢复](#多条通知冷启动恢复2026-09-27)。另已补[冷启动后连续点击](#冷启动后连续点击两条通知2026-09-27)；更短间隔/受控迟到响应竞争、Android13权限及其余A04异常仍待验。

两个不同聊天的连续横幅及后台系统通知点击均已补 MuMu 真实验收：暂缓第一条原生回执后点击另一会话提醒，只确认最后点击并进入对应聊天；两题取消回电脑、双方草稿和返回通过。测试沿用实际通知与认证，仅控制第一条回执到达时机。见[前台连续通知证据](./remote-current.md#连续通知导航不丢失2026-09-27)与下方后台专项；多条通知跨进程竞争仍未验证，单条已有系统通知的进程回收恢复已有独立证据。

单条跨会话后台系统通知已通过 MuMu 实测：手机在聊天 A 留下非空草稿并退到桌面，电脑在既有聊天 B 发起原提问，点击系统通知进入 B；取消回执、两边草稿、返回 A 及通知清除通过，原草稿和服务已恢复。此项不覆盖连续不同目标或进程重建，详见[跨会话后台验证](./remote-current.md#跨会话后台系统通知2026-09-27)。

连续点击时保留最新目标：前一次打开期间到来的点击会在旧操作结束后继续读取，旧结果与错误不覆盖新意图；如果随后手动切换聊天，则保留手动导航。页面回归覆盖暂缓读取、暂缓选择、旧请求失败及用户导航；MuMu 已用电脑原提问服务产生同会话两条真实横幅，受控暂缓第一次原生回执后只确认第二个点击，原生确认成功。不同会话、后台系统通知及跨进程连续点击仍未验收，详见[连续通知边界](./remote-current.md#连续通知导航不丢失2026-09-27)。

点击提醒现在会在成功打开目标后退出主聊天窗口和收起插件旁栏，即使目标就是当前会话。2026-09-27 MuMu 已通过会话权限窗口、原插件 Modal 和非聊天旁栏三种真实横幅点击；原问题可取消且电脑收到结果，草稿保持。读取失败或被用户后续导航取代时不消费通知。来源、失败复现与范围见[通知点击验收](./remote-current.md#通知点击退出聊天遮挡2026-09-27)。该结果补足下段三类遮挡“点击未验证”的历史记录，不代表完整 A04。

旁栏阅读状态与遮挡横幅已在2026-09-26通过MuMu专项：电脑原userQuestions.ask实际发起四个请求，当前聊天可见时抑制横幅；手机设置sheet、原插件Modal和非聊天旁栏遮挡时显示原生提问横幅。关闭遮挡恢复阅读回执，取消问题返回电脑ASK_CANCELLED，草稿保留、无系统通知，临时插件已卸载并重启DSH清理。未覆盖这三种遮挡下的通知点击、Android13权限或真机，不代表完整A04通过；详见[源码与当前证据](./remote-current.md#手机终端边界与遮挡通知2026-09-26)。

- 状态：A04 实施中；插件0.1.35、Gateway只读补丁及应用级提醒APK已安装，MuMu冷启动普通聊天自动连接和主要真实提醒链路通过；完整权限与异常仍待补齐。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-09-25。
- 范围来源：[用户确认的通知规则](../design/问卷结论与追问.md)、[功能基线](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md)、Linear KKC-20。

## 现行原生实现与验收

### 冷启动后连续点击两条通知（2026-09-27）

- 状态：当前日常APK通过真实MuMu操作；维护角色：项目协作Agent；核验2026-09-27。来源：[实际脚本的--rapid模式](../../scripts/verify-notification-multiple-restart-android.mjs)、[最终报告](../../artifacts/notification-multiple-rapid-android.json)。无生产代码/APK变更。
- 07:11:51Z开始：原电脑userQuestions在两个专用会话产生真实系统通知，Android `am kill`核对进程13971消失而通知仍在。先点击一条，不等待其WebView/会话就绪，再展开系统栏点击另一条；新进程14625，实际点击间隔6569ms，最终进入后点击的会话。通过实际消失的notification key确认目标，不假设相同文案的排列顺序，也未伪造Intent或认证。
- 后点击会话取消原问题得到ASK_CANCELLED；随后手动进入第一条对应会话并取消，双方草稿保留，最终无通知、页面errors为空。脚本未控制网络/回执延迟，不能证明第二次点击时第一次请求仍在途；因此不将此结果当作毫秒级竞争或全部冷启动异常已完成。既有受控迟到回执测试仍是另一份独立证据。
- 两次准备失败保留：[系统栏旧行仍在](../../artifacts/notification-multiple-rapid-system-animation.json)、[冷启动收起通知栏](../../artifacts/notification-multiple-rapid-shade-collapse.json)。前者通知key已少一条但可见树仍两行，后者key仍一条但系统栏被Activity启动收起；脚本现在限时重新观察，必要时重新展开，再点击唯一剩余目标，未强制点击/猜坐标。两轮未完成问题均由原90秒超时清理，确认ASK_ABORTED且无残留通知后才重试。
- 临时0.0.6插件已原CLI卸载，依赖与控制文件不存在；07:12:46Z[日常入口收尾](../../artifacts/notification-multiple-rapid-cleanup.json)确认测试界面已移除、通知为空、errors为空。电脑DSH24744、网关3128恢复。无模型请求、Key、设备权限或通知设置修改。双端/撤销依赖的电脑浏览器控制本轮仍返回nodeRepl.fetch失败，不影响本项独立验证；完整Remote仍进行中。

### 冷启动恢复通知的语言切换（2026-09-27）

- 状态：沿用当前日常APK，真实MuMu验收通过；维护角色：项目协作Agent；核验2026-09-27。来源：[实际双通知脚本](../../scripts/verify-notification-multiple-restart-android.mjs)、[恢复后语言检查](../../scripts/verify-restored-notice-language.mjs)、[最终结果](../../artifacts/notification-multiple-language-android.json)。本轮未修改生产代码。
- 14:08香港时间起运行：两个专用会话由原userQuestions服务产生真实通知，App进程6963被回收后，点击第一条通知启动7554，另一条仍在。经普通聊天的设置页切换英文、再恢复中文，系统通知原位更新，notification key和PendingIntentRecord保持。实际通知栏[英文](../../artifacts/notification-restored-language-en.png)与[中文](../../artifacts/notification-restored-language-zh.png)截图已核对。
- 两条系统通知依次点击均进入对应原会话，手机取消均回传电脑ASK_CANCELLED；两处原草稿保留、errors为空，最终无残留通知。没有模型请求、Key、设备授权或通知分类开关修改。语言恢复为原简体中文。
- 测试准备修正：提醒订阅独立于聊天连接，等待其listening后才发事件，避免把重连基线当成补推失败。冷启动只有Remote页面，普通聊天页面要等启动后才出现；沿用现有调试上下文并等待页面就绪，设置操作限定15秒。此前重复附加调试连接的无结果进程经身份核对后终止，[页面创建时序失败](../../artifacts/notification-multiple-language-page-race.json)保留，均不算产品验收通过。
- 临时电脑插件按原CLI卸载，DSH66784恢复、网关3128保持。[14:09收尾结果](../../artifacts/notification-multiple-cleanup-android.json)确认正常Remote入口可用、测试局部界面已移除、无残留通知/errors；控制文件清除。冷启动快速竞争点击和其他A04/A05缺口仍未完成，进程退出后不产生新推送的边界不变。

### 多条通知冷启动恢复（2026-09-27）

- 状态：新版日常APK已安装并通过真实MuMu入口；维护角色：项目协作Agent；核验2026-09-27。来源：[原生通知记录](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNotifications.kt)、[独立提醒连接](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeConnection.kt)、[实际双通知脚本](../../scripts/verify-notification-multiple-restart-android.mjs)、[原生边界检查](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteNotificationRestoreChecks.kt)。
- [修改前实测](../../artifacts/notification-multiple-restart-before.json)：两个原userQuestions请求在后台产生真实系统通知；am kill确认进程消失且两条通知仍在。点击第一条可冷启动进入正确会话，但构造RemoteNotifications时无条件cancel所有通知，另一条随之消失。不是电脑已处理待办，也不是接收新推送的要求。
- 新通知附带严格校验的本机记录，只含绑定摘要、会话、类别和稳定文案原因。初始化读取本App仍在系统显示的通知，最多32条，不调用notify、不恢复已经划掉的通知，不保存聊天正文或Key。缺少新版元数据的旧通知保持清理行为；绑定变化、未绑定、暂停和授权失败会清理记录，重连初始待办集合移除已完成提问/审批。通知点击仍走既有绑定核验与只读导航。
- [13:35香港时间真实结果](../../artifacts/notification-multiple-restart-android.json)：PID28535→29365，两个专用会话通知均保留；按系统UI实际可见通知点击，通过消失的notification key核对对应会话，不假设列表顺序。两次均进入正确会话，分别取消后电脑返回ASK_CANCELLED，两个原草稿保持、最后回到原测试会话，通知为空、errors为空。没有伪造Intent、Host数据或鉴权，也没有模型调用。
- [原生独立UID结果](../../artifacts/notice-restore-native.log)通过原通知账本与实际NotificationManager：恢复两条且时间不变、不补发已划掉通知、当前绑定过滤、待办基线/解决事件清理、用户关闭类别、无效元数据拒绝及终态全清理。首次故障夹具通过recoverBuilder覆盖extras未得到预期系统数据，改为独立构造无效通知并先确认实际extras后通过；生产修复未因此放宽校验。
- 实际脚本修正点击后立即查PID、只按WebView存在判断前台入口两处测试假设；失败记录保留，未当成产品崩溃。准备阶段从普通主页真实进入Remote；冷启动恢复段仅通过系统通知启动，不用手工导航替代。两条通知是在回收前已存在、依次点击；冷启动途中快速竞争点击仍待验，进程结束后产生新推送不是产品承诺。
- [最终APK/lint](../../artifacts/notice-restore-final-build.log)与[隔离测试构建](../../artifacts/notice-restore-isolated-final-build.log)通过。临时电脑插件按原CLI卸载并重启释放，DSH38180、网关3128；[13:39真实收尾](../../artifacts/notification-multiple-cleanup-android.json)证明测试入口移除、原聊天可用、无残留通知/errors。控制文件已删除，隔离APK已停止，日常绑定/Key/配置/权限未改。

### 不同会话后台连续点击（2026-09-27）

- 状态：MuMu Android12实际系统通知路径通过；维护角色：项目协作Agent；核验2026-09-27。来源：[脚本](../../scripts/verify-notification-queue-android.mjs)的`--cross --background`分支、[11:51报告](../../artifacts/notification-queue-background-android.json)、[第一条通知](../../artifacts/notification-queue-background-0.png)及[第二条通知](../../artifacts/notification-queue-background-1.png)。沿用0.1.65配套APK，本轮没有修改生产代码。
- 两个既有专用测试会话分别为session-d4ec40ee-a27c-41fc-a860-b3974434e637与session-5a0a051f-192f-4270-99ea-7472bdec9f26。每次先退回Android桌面，再由临时电脑插件通过原userQuestions.ask发起提问。脚本等待真实系统通知出现，通过系统UI树中唯一的“有问题等待你回答”文字及边界点击，没有构造Intent或直接调用导航函数。
- 仅暂缓第一条真实notifications.take回执，在它返回前点击第二个会话的系统通知；释放后，原生返回两个不同点击ID和正确会话ID。手机最终进入第二个会话，只确认最后一次点击且原生确认成功；会话权限遮挡窗口关闭。两题均从手机取消，电脑分别返回ASK_CANCELLED，最后回到第一个会话，两边原草稿保持。所有系统通知清除，页面errors和阅读回执failures均为空。
- 临时插件经原CLI卸载、控制文件已删除、探针恢复；DSH恢复32248，网关3128保持。[正常Remote入口](../../artifacts/notice-queue-background-cleanup-entry.json)会话/面板/插件/草稿复验通过，errors/resources为空；[临时入口已消失](../../artifacts/notice-queue-background-fixture-removed.json)。没有模型请求、Key、绑定、设备授权或用户通知开关变化。
- 本项证明运行中App的两次后台系统通知点击竞争，不等同两条同时堆叠通知的选择、多条通知跨进程竞争、任意弱网或Android13通知权限验收；完整A04仍在进行。单条进程回收的已验范围见下一节。

### 后台进程回收后点击已有通知（2026-09-27）

- 状态：MuMu Android 12实际入口通过；维护角色：项目协作Agent；核验2026-09-27。来源：[真实入口脚本](../../scripts/verify-cross-background-notification-android.mjs)的`--process-restart`分支、[11:23报告](../../artifacts/cross-background-notification-restart-android.json)及[系统通知截图](../../artifacts/cross-background-notification-restart-system.png)。沿用0.1.65配套日常APK，无生产代码修改或模型调用。
- 来源聊天保留非空草稿，目标为另一个既有专用测试会话；电脑临时插件调用原userQuestions服务，后台收到真实系统通知。执行`am kill`后轮询确认App PID消失，通知key仍在；使用系统界面上实际观察到的通知文字点击，App PID由8281变为8703，重新连接后自动打开正确目标。没有直接启动目标Activity、伪造Intent或替换认证/Host响应。
- 手机取消整组问题后电脑返回ASK_CANCELLED，目标原草稿保持；返回来源聊天时新增草稿仍完整，最终恢复原草稿。通知已清除、errors为空。`am kill`用于模拟后台进程回收；`force-stop`会同时撤掉通知，不能混为这条路径。此项不证明进程退出后产生新推送，也不覆盖后台连续点击、多通知竞争、Android13授权或物理手机。
- 准备时重启DSH后旧页面入口检查曾出现连接取消与插件面板超时，保存[首次失败](../../artifacts/notice-process-entry-before-reload.json)；冷启动后[入口检查](../../artifacts/notice-process-entry.json)通过，再执行本次通知专项。没有将冷启动恢复当成热重连缺陷已修复。
- 临时插件经原CLI卸载，控制文件不存在；DSH恢复55464、网关3128保持。冷启动后[日常Remote收尾](../../artifacts/notice-process-cleanup-entry.json)会话/原插件/草稿通过，errors/resources为空；[临时入口消失](../../artifacts/notice-process-fixture-removed.json)已核对。没有改变Key、绑定、权限或用户通知开关。仅扩充验收脚本，语法检查通过，不重复构建产品。

### 原生提醒语言（2026-09-25 05:18 UTC）

[PhoneAppearance](../../android/app/src/main/java/dev/dshmobile/validation/PhoneAppearance.kt)提供局部 Android Resources，上游系统语言不变、不重建 Activity。[RemoteNotifications](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNotifications.kt)保存固定摘要的资源 ID；设置标题、分类与操作按钮、前台横幅、系统摘要和锁屏通用摘要按当前手机语言解析。[RemoteNoticeConnection](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeConnection.kt)仅将显示标签改为资源，原协议状态未变。中英文随 APK 交付，Bundle 关闭按语言拆分，确保离线切换可用。

语言变化时更新原通知分类名称/说明、已打开设置窗口以及仍在 NotificationManager 中的本应用通知。通知通过 recoverBuilder 保留原 PendingIntent/时间和其他字段，使用原 tag/id 与 onlyAlertOnce；不遍历事件账本重发。四类用户开关与系统通知分类配置不重置。窗口关闭释放语言/连接监听，前台横幅更新不延长原六秒显示时间。

| 实际 MuMu Android12 入口 | 结果 |
| --- | --- |
| Remote 打开原生提醒窗口，再到普通设置切中文/英文并返回 | 同一个原生窗口即时切换，四类勾选保持原值；没有重新连接或修改开关 |
| 专用聊天纯文本生成后退到 Android 桌面 | 收到真实英文完成通知，截图确认 `Computer task completed` |
| 普通聊天设置切回中文 | 同一通知 key 与系统 PendingIntentRecord 保持，摘要变为“电脑任务已完成”；不是重新配对或另发一条通知 |
| 普通聊天的 Remote 提醒入口 | 中文窗口、已连接状态与原四类开关一致 |
| 回到原 Remote 聊天，再次切语言 | 读到本轮标记并清除通知，再切语言不补发；原聊天草稿及中文恢复，最终回普通首页 |

来源：[实际语言入口脚本](../../scripts/verify-phone-language-android.mjs)、[原生提醒检查](../../scripts/verify-native-notice-language-android.mjs)、[最终报告](../../artifacts/phone-language-native-notices-android.json)，`artifacts/notice-language-*` 截图已核对。测试只向「DSHM Remote 联调提示」发送不调用工具的纯文本消息；两次中途脚本检查失败各留下一个已完成测试轮次，最终轮标记 `DSHM_NATIVE_NOTICE_LANGUAGE_1790313511968`。无 Key、地址、权限或开关变化。

正常 APK/测试 APK 构建、Android lint、扩充的[原生外观检查](../../android/app/src/androidTest/java/dev/dshmobile/validation/PhoneAppearanceChecks.kt)和原通知账本检查通过。初次 lint 缺少 debug 输入法诊断页英文资源，已补齐；脚本先后修正菜单未关闭、通知 tag JSON 字符白名单、误比 PendingIntent Java 包装对象的问题，失败报告保留。最终按系统 PendingIntentRecord 核对点击目标。此前 246 项 JS 测试属前一页面实现批次，本批未修改 JS 产品逻辑、不把旧结果计作新跑。

本次未实测英文前台横幅、锁屏显示、通知点击冷启动语言、用户划掉通知后的切换，以及 Android13+授权窗口；不替代完整 A04/A05 或其他原生窗口本地化。保留时间属于代码行为，本脚本未单独核对系统时间字段。

原生 [DshmApplication](../../android/app/src/main/java/dev/dshmobile/validation/DshmApplication.kt)观察本进程Activity生命周期；[RemoteNotifications](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNotifications.kt)显示前台轻提醒或后台系统通知，提供四类持久开关和Android通知授权入口。消息只含固定摘要，不包含命令、模型正文、文件或Key，锁屏使用通用提示；最多保留32条提醒，退出进程不持久化待投递事件。当前聊天可见时抑制提醒，打开其他弹层视为不在当前聊天正文。

[RemoteNoticeConnection](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeConnection.kt)由Application持有，冷启动即使用既有绑定建立独立只读连接，只执行原票据认证、能力协商与固定 `remote.taskFollow`。不加载Remote页面、不新增认证协议、不发送模型或审批请求。[RemoteApi](../../android/app/src/main/java/dev/dshmobile/validation/RemoteApi.kt)与聊天桥共用原DPoP构造。网关原本允许同设备最多4个连接，提醒与聊天各占一个；每连接的流和请求限制仍适用。失败按1至30秒退避，认证失效/撤销/权限变化停止本轮自动重试并清除提醒；手动恢复重新认证。

[原生账本](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeLedger.kt)校验原帧，首帧仅恢复集合，最多256项待办/4096个近期身份；每代最多排队256帧、单帧256KiB，旧连接响应拒绝。主动断开持久暂停，重新进入Remote或设置中点击“重新连接”恢复。页面卸载仅 `socket.release`，不会暂停应用连接；移除绑定停止并清理通知。原JS投递器及其5项旧测试已移除，页面只读订阅仍用于待办列表，不再投递系统通知，避免重复提醒。

[原生桥](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNotificationBridge.kt)只接阅读位置、设置/重试、状态与点击确认，不允许网页生成提醒。点击采用显式App内Intent和只读会话地址；绑定不同拒绝打开，成功读取后才确认消费，迟到确认不能消费新点击。[RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx)提供待处理/同步失败/重试入口，普通聊天设置与Remote菜单均能打开原生分类设置，并显示独立提醒连接状态。

### 通知点击离线与重同步验收（2026-09-25 03:24–03:29 UTC）

正常MuMu包、既有聊天授权，在同一专用会话完成两项实际路径。DSH62904/网关66472均未重启；仅临时移除并恢复本测试ADB `tcp:8787 → tcp:8787` 映射，最终已恢复。移除映射会阻止新连接，但不据此假定已经建立的socket必然断开。

1. **有通知但首次打开Remote无法连接：**后台收到真实问题通知时只有普通聊天WebView。移除映射后点击系统通知，进入DSHM自己的连接页，显示“连接未完成，请重试。”和可用的“重新连接”，没有聊天发送/问题提交入口。恢复映射后手动重试，通知目标仍保留，自动进入「DSHM Remote 联调提示」，原问题仍未回答。手机显式回答后电脑显示已回答并回复 `DSHM_NOTICE_OFFLINE_RECOVERED_20260925`；没有重复通知。这里是用户点击重试恢复，不宣称首次连接失败会自动重试。
2. **提醒连接断开期间电脑处理待办：**后台收到另一个真实问题通知后，从普通聊天设置打开提醒窗口；移除映射，再点击该窗口“重新连接”，明确关闭旧提醒socket并触发失败重试，窗口和原生状态分别为“正在连接”/retrying。手机回到后台后，电脑回答问题并完成该轮；断线手机仍保留同一个问题通知，没有完成通知。恢复映射后，原生连接自动listening，初始集合清除旧问题通知，无历史完成补发。

来源：[专用实际入口脚本](../../scripts/verify-notification-recovery-android.mjs)，`artifacts/notifications-recovery-offline.json/png`、`notifications-recovery-reconnect.json/png`、`notifications-recovery-answer.json`分别记录失败页、目标恢复和手机回答；`notifications-recovery-baseline-offline.json`、`notifications-recovery-baseline-restored.json`记录原生状态与通知集合；`notifications-baseline-offline.xml`为真实设置窗口。脚本需 `DSHM_RUN_LIVE=1`、`DSHM_ANDROID_SERIAL`；baseline-offline另用 `DSHM_NOTICE_EVENT_ID` 指定本次收到的真实事件UUID，不能复用旧待办。截图已核对，电脑两个最终标记均从内置浏览器确认。脚本语法及文档链接检查通过，本批没有产品代码修改或APK重建。

这两项不替代设备撤销、网络切换时的在途响应、点击已不存在会话或复杂子会话验收。Key、服务地址、设备权限及四类通知开关均未改；测试问题均已处理，手机最后回到普通聊天。

### 原生提问、审批及取消实际验收（2026-09-25 03:06–03:21 UTC）

正常MuMu Android12包、原聊天授权、同一专用「DSHM Remote 联调提示」会话下完成。测试开始时仅启动普通聊天，再退到Android桌面，提醒来自应用级连接：

| 场景 | 实际结果 |
| --- | --- |
| 电脑调用原提问工具 | 手机出现“有问题等待你回答”；点击进入对应DSHM聊天，问题仍待回答，没有自动代答 |
| 手机选择并提交回答 | 电脑确认已回答并生成约定标记；手机正显示同会话，没有重复完成通知 |
| 电脑发出单次工具审批 | 手机出现审批通知；点击进入原会话，手机“允许一次”的答复同步到电脑 |
| 上述审批后的写入 | **未成功**。目标位于实际会话工作区外，workspace-write仍拒绝；随后要求完全访问的请求已在电脑拒绝，未创建文件。这一用例只通过提醒、跳转和答复同步 |
| 关闭“需要回答”分类后再次真实提问 | 电脑等待回答期间手机无通知；电脑回答后仍收到一条任务完成通知，证明其他分类不受影响 |
| 恢复全部四类开关后，电脑处理新问题 | 原待回答通知移除，只留下该轮完成通知；这是回答后的清除，不能当作取消测试 |
| 另起纯文本生成，在输出过程中点击电脑“停止生成” | 电脑显示“已停止”，后台手机无完成或失败通知；停止前后手机均只有普通聊天WebView |

来源：[实际操作脚本](../../scripts/verify-notification-actions-android.mjs)、[设置入口脚本](../../scripts/verify-notifications-android.mjs)。证据汇总为 `artifacts/notifications-actions-acceptance-20260925.json`；系统通知截图为 `notifications-native-question-system.png`、`notifications-native-approval-system.png`，恢复开关证据为 `notifications-category-restored.xml`。分阶段JSON会被后续同阶段覆盖，汇总保留时间和结果。脚本语法检查通过，本批未修改产品代码或重新构建APK；此前243项测试和构建结果仍是前一实现批次的结果。

初次通知点击使用通知栏尚在动画中的截图坐标，没有打开目标；刷新截图后重新定位点击通过，不能据此认定App加载故障。测试脚本另补充Remote页面出现等待及真实选项标签匹配。审批脚本最初以出现标记文本误判写入完成，现改为只记录答复提交，并纠正原报告为writeSucceeded=false；真实写入结果以电脑终态和文件不存在为准。四类开关最终均恢复开启，原Key、服务地址与设备权限未改。

### 冷启动增量实际验收（2026-09-25 02:55–03:01 UTC）

正常MuMu Android12包保留原Key、绑定、历史及聊天授权，DSH和网关PID未变：

| 入口/条件 | 结果 |
| --- | --- |
| force-stop后从普通聊天启动 | 仅一个普通聊天WebView，无Remote页面；只读连接达到listening，无历史提醒 |
| 此状态下电脑真实完成专用测试任务 | 普通聊天出现完成横幅；点击后才建立Remote页面并打开同一联调聊天 |
| 再次冷启动普通聊天后退到桌面 | 电脑真实完成后出现1条系统通知；截图核对，点击进入原会话并读到对应标记 |
| Remote菜单主动断开，再force-stop并重开普通聊天 | 提醒保持paused，没有自动重连；通过普通聊天抽屉进入Remote后恢复 |
| 移除本测试ADB反向8787后冷启动，随后恢复该端口 | 普通聊天可用且无Remote页面，提醒先retrying再自动listening，无历史补发 |
| 结束App进程后电脑继续真实任务 | 电脑回复已完成，App仍无PID、无通知；重新打开普通聊天恢复连接且不补发 |
| 普通聊天设置 → Remote提醒 | 四类开关保留，标题显示独立连接状态；“重新连接”后重新握手 |

来源：[冷启动验收脚本](../../scripts/verify-notification-cold-android.mjs)、[真实提醒脚本](../../scripts/verify-notifications-android.mjs)。`artifacts/notifications-cold-*.json/png`记录各阶段，`notifications-banner-android.json/png`为02:55冷启动横幅，`notifications-cold-system.png`为后台系统通知，`notifications-inspect-android.json`的02:57记录跳转和对应模型标记。原03:00进程检查与重开记录分别在stopped-check/cold文件；分阶段文件会覆盖，汇总以 `artifacts/notifications-cold-acceptance-20260925.json` 为准。

首轮冷启动脚本在am start返回后立即读取PID，因进程尚未建立而失败；加入有界等待后通过，非App崩溃。生产原生账本Instrumentation通过，覆盖首帧、去重、处理后清除、重连、严格字段/数值/身份、容量及取消/修复结束拒绝。243项手机JS测试（移除旧投递5项、新增页面释放1项）、实际RemoteApp五场景恢复回放、Web/APK构建及Android lint通过。完整Android13+和异常矩阵仍未完成。

2026-09-25 02:23–02:35 UTC，正常MuMu Android12包、原聊天授权、本机网关下实际通过：

| 入口/条件 | 结果 |
| --- | --- |
| 手机退到桌面，电脑专用测试会话真实模型完成 | Android出现“电脑任务已完成”，点击进入DSHM自有的「DSHM Remote 联调提示」，通知清除 |
| 普通聊天在前台，电脑同一测试会话提问 | 显示原生横幅；点击打开对应聊天，电脑问题仍待回答，没有自动代答 |
| 手机正在该聊天，电脑回答后模型完成 | 原生判定同会话，未重复弹横幅或系统通知 |
| 电脑回答待办 | 手机待处理列表自动清除 |
| Remote菜单/普通聊天设置 | 两个实际入口均打开四类原生开关；任务完成开关关闭后重启仍保留，测试后恢复开启 |
| force-stop已连接App，再在电脑完成新一轮 | App PID保持不存在，系统没有新通知或自动唤醒；随后重开普通聊天并进入Remote可重连，不补发历史提醒 |

来源：[实际验证脚本](../../scripts/verify-notifications-android.mjs)，`artifacts/notifications-banner-android.json`与对应PNG（02:30:20 UTC）记录提问横幅和正确跳转；`notifications-pending-android.json`记录待办及清除，`notifications-settings-android.png`、`notifications-ordinary-settings-android.png`记录两个原生入口；最终`notifications-notifications-android.json`记录重开后无补发。部分分阶段文件会覆盖，完整步骤与结论以本节及`artifacts/notifications-acceptance-20260925.json`为准。测试消息均在已授权的专用联调聊天，Key/模型服务地址/设备权限未改。

前台横幅初次自动检查超时：MuMu的Playwright原生wait/close挂起，且非聚焦PopupWindow不在活动窗口树内；已终止该测试进程。通过仅记录kind/前台Activity/是否同会话的debug日志定位截图时机，截图确认横幅可见，再按核验坐标点击验证实际跳转。日志不含会话ID、内容或凭据；没有把自动检查失败说成第一次就通过。

本轮新增投递器5项回归与既有订阅5项均通过；手机完整247项测试、Web/APK构建、Android lint通过。测试覆盖延迟租约、重连清理、顺序清除、失败停止、容量和最小摘要，不等同于所有实际通知异常已验收。

电脑已应用五文件补丁，并在停止DSH时完成真实apply→restore→apply，每次5文件核验通过，已有其他补丁保留。当前DSH源码入口`pnpm dsh web --no-open` PID62904（3080），网关PID66472（8787）；启动输出保存`artifacts/dsh-notifications.stdout.log`，含登录信息，不输出全文。当前手机与电脑配套通知代码已安装，上游参考检出只读。

## 已撤销绑定的旧通知点击（2026-10-03）

状态：MuMu Android 12 独立验收包实际通过；维护角色：项目协作Agent。来源：[实际驱动](../../scripts/verify-notice-revoked-android.mjs)、[准备](../../artifacts/notice-revoked-prepare-android.json)、[点击后检查](../../artifacts/notice-revoked-inspect-android.json)、[绑定清理](../../artifacts/notice-revoked-cleanup-android.json)与[日常恢复](../../artifacts/notice-revoked-restored-android.json)。

使用与日常App相同当前源码、不同UID的 `dev.dshmobile.validation.pairingtest`，新建并批准仅聊天授权的「DSHM 通知撤销验收 040」。原Host独立内存Session受控结算通过真实网关产生系统提醒；App退后台后 `am kill` 实际结束进程，确认通知仍在，再在电脑撤销该临时绑定。没有构造Intent、注入Android通知或修改日常绑定。

从MuMu通知栏实际点击旧提醒，创建新进程，页面显示「连接授权已失效」，无聊天页/消息输入；旧系统通知清除，点击重新连接仍被拒绝。随后正式页面移除已撤销的测试绑定并停止独立App。该结果只证明进程已退出时撤销后点击，不外推在途帧、活跃连接撤销或多设备并发。

日常App也收到同一受控Session的一条提醒，已在系统通知栏清除；最终两个包的测试通知均为空。夹具通过原CLI卸载、残留junction在核对目标后移除，DSH以原参数恢复PID61488；日常聊天16条回复与空草稿保持，日常授权active、management=false。独立包构建临时改变Gradle输出，最终从日常已安装APK读回并核对原SHA-256 `b192b9c8c6077a8b6721e05ac65cf5a63e4e519e1c33064696a6e119a47e5455` 后恢复交付APK；[产物报告](../../artifacts/delivery-artifacts-current.json)117个Web文件一致。没有生产逻辑变更或日常App覆盖安装，不代表可重现构建。

准备脚本先后发现独立包Activity需要完整原类名、初始绑定页加载等待、已存在Remote页面不能再点击被遮挡普通页；[入口失败](../../artifacts/notice-revoked-prepare-entry-before.json)、[加载失败](../../artifacts/notice-revoked-prepare-loading-before.json)、[已有页失败](../../artifacts/notice-revoked-prepare-existing-page-before.json)保留。恢复脚本的[空编辑器换行断言](../../artifacts/notice-revoked-restored-empty-line-before.json)与[被遮挡普通页点击](../../artifacts/notice-revoked-restored-hidden-page-before.json)亦已修正后重跑通过；这些是驱动问题，不能记为产品修复。未发送模型消息、未授予管理权限。

## 电脑取消待审批与待回答（2026-10-03）

状态：MuMu正式App、原DSH服务、本地网关实际通过；维护角色：项目协作Agent。来源：[驱动](../../scripts/verify-notice-cancel-android.mjs)、[夹具及边界](../../tests/fixtures/live-approval-timeout-plugin/README.md)、[最终同轮结果](../../artifacts/notice-cancel-run-android.json)、[Host原结果与审批审计](../../artifacts/notice-cancel-host.json)。

在独立测试工作区/Agent内发起原审批及提问，手机退后台后核对实际系统通知和 `foreground=null started=0` 投递日志，再显式中止对应请求的AbortSignal。审批返回cancelled且持久审计一致，提问返回原服务定义的ASK_ABORTED；两次旧系统通知清除、原审批/提问组件移除、未发送草稿保持，App后台PID不变。取消后的检查耗时本次分别286ms与299ms，仅为该环境单轮观测，不是性能承诺。未调用模型、执行工具或人工注入通知。

[前台恢复](../../artifacts/notice-cancel-restore-android.json)确认无旧操作入口、测试草稿清空、日常聊天恢复；[原服务清理](../../artifacts/notice-cancel-cleanup-host.json)cleaned=true，正常CLI卸载实际触发dispose，归档专用会话并移除工作区登记。[实际列表核对](../../artifacts/notice-cancel-cleaned-android.json)确认测试工作区/会话消失、原16条回复与空草稿保持、通知为空；日常授权active、management=false。DSH PID74744继续按原参数运行，无残留包目录；未改生产代码或日常APK。

首轮重启中断夹具留下未清理登记，旧guard拒绝再加载，见[失败报告](../../artifacts/notice-cancel-inactive-fixture-before.json)。夹具0.0.2补充严格匹配旧会话/路径/唯一归属后的登记恢复，已实际清理[该旧实例](../../artifacts/approval-recovered-session-f77619dc-85f6-467f-9811-e11444d14f5f.json)，没有删目录或修改日常工作区。其余失败记录分别保留：[后台截图超时](../../artifacts/notice-cancel-background-screenshot-before.json)、[旧提问选择器](../../artifacts/notice-cancel-question-selector-before.json)、[重试草稿前置断言](../../artifacts/notice-cancel-retry-draft-before.json)、[误把信号取消期待为用户放弃](../../artifacts/notice-cancel-question-outcome-before.json)。中断请求分别经手机拒绝/放弃清理；最终完整两项重跑独立通过，不将这些驱动修正当作产品故障修复。

本项只证明原请求服务到通知/手机卡片的主动取消；模型内部工具停止及原30秒期限有各自专项，不外推断线在途取消、多设备冲突或任意第三方请求。

### 剩余工作

现行结论见[首版通知验收结论](#首版通知验收结论2026-10-03)：A04已按明确规则逐项核对通过。以下保留专项来源和未覆盖环境，不再把笼统“更长后台/全部并发”当作待完成的独立功能；历史“完整A04仍未完成”由现行结论替代。

2026-10-02另补[插件适配器溢出恢复](../../../plugin/tests/task-notifications.test.ts)：连续同步发布257条实际Session结算，生产TaskNotifications队列超限后由RemoteAdapter发出唯一`remote_notifications_overflow`错误；请求释放后，同一连接/请求ID重新订阅取得同一generation的新基线，只接收此后事件。插件目录`node node_modules/vitest/vitest.mjs run tests/task-notifications.test.ts`四项通过。原有慢消费者测试已验证队列，此次补上适配器错误与请求释放链路；不替代Android收到错误后的自动连接重试。

2026-10-02补充网关重订阅边界：[真实HTTP/WS/SQL测试](../../../backend/tests/remote-permissions.test.ts)在同一设备连接复用请求ID，验证取消后重新订阅、收到Host错误后重新订阅、每次分配新Host路由及旧流迟到事件被丢弃。`node node_modules/vitest/vitest.mjs run tests/remote-permissions.test.ts`两项通过。本测试主动发送错误帧，不制造真实队列溢出，也不运行Android自动重试；这两项仍未由本测试证明。首次扩展因测试局部变量重名编译失败，改名后执行通过，生产代码未改。

- 冷启动自动恢复及[系统销毁后台Activity后的真实恢复](#android销毁后台页面后的恢复2026-10-03)已通过上述MuMu验收；后者使用“不保留活动”，不等同内存不足自然回收。[5分钟后台后新审批/提问](#五分钟后台后新待办通知2026-10-03)已有正式App证据；更长时段、锁屏省电及多端并发/连接容量未由该场景证明，不能保证Android永不回收进程，也不据此新增无限后台承诺。
- Android13+授权/拒绝和系统设置恢复已通过[权限专项](#android-13以上通知权限恢复2026-10-01)，授权后的真实完成通知与点击已通过[投递专项](#标准android发送时区与通知投递2026-10-02)。Android12“需要回答”分类抑制/恢复、“需要批准”的[后台关闭与恢复](#需要批准分类关闭与恢复2026-10-03)、“任务完成”的[App前台开关](#任务完成分类关闭与恢复2026-10-03)和[系统渠道后台禁用/恢复](#android系统渠道禁用与恢复2026-10-03)已有正式App证据。“执行失败或受阻”也已通过[真实Host blocked链路的三阶段开关验收](#执行失败分类的真实受阻事件2026-10-03)，不再笼统列作分类开关未验；各结束原因的投递及原生共用error分类检查见对应专项。[聊天受阻结果](#聊天受阻结果显示2026-10-03)已补齐并实际验证，不再列为功能缺口。
- HTTP失败、受阻、输出上限的指定真实结算链路已有独立报告；[点击已消失会话通知](#点击已消失会话的通知2026-10-03)、[进程退出后撤销绑定再点击旧通知](#已撤销绑定的旧通知点击2026-10-03)、[电脑主动取消待审批/提问](#电脑取消待审批与待回答2026-10-03)、[已加载父目录的直接子会话通知点击](#后台子会话完成通知点击2026-10-03)、[直接子会话冷启动](#子会话通知冷启动修复2026-10-03)及[实际孙会话目标与逐层返回](#嵌套孙会话的真实通知跳转2026-10-03)亦已通过。[原生读取回执跨显式断开重连](#通知读取回执迟到于重新连接2026-10-03)已验证旧导航丢弃；[真实WebSocket事件排队后断开及新连接隔离](#真实websocket事件跨原生连接换代2026-10-03)、[活跃连接实际撤权后迟到事件](#活跃连接实际撤权与迟到事件2026-10-03)也已通过。多设备冲突继续按具体场景核对。首次通知点击离线后手动重试、提醒断线期间已处理待办的重同步清除、审批提醒/答复同步及普通生成取消不误报已通过，不能扩展为这些剩余场景已验收。
- Host通知队列实际超限后的网关传递、Android自动重连和后续单次投递已由[专项](#host队列溢出后的实际重连2026-10-03)通过；网关同连接/同请求ID重订阅仍以独立网络测试为证，不将Android新连接重试混为同连接复用。[Android自身帧队列上限](#android通知排队上限与恢复2026-10-03)另有真实帧受控回放、自动认证恢复与后续真实通知证据，不能外推任意调度或不同任务洪峰。通知冷启动语言切换已有下文专项，不能继续笼统列作未验。
- 进程结束后不接收新通知已有[force-stop专项](#进程结束后不接收新提醒2026-10-02)，其两秒观察与重开恢复不替代自然系统回收或长时间后台场景。

本清单于2026-10-02按实际报告字段及[生产账本检查](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteNoticeChecks.kt)核对更新；维护角色：项目协作Agent。以下历史段落保留当时边界，当前剩余项以本清单为准。

不引入常驻前台服务、云端离线推送、开机广播或进程唤醒。以下为前置源码依据与历史验证，旧安装状态以本节现行记录为准。

## 已核验的边界

1. 原 `api-session/status(sessionId, false)` 同时覆盖完成和取消，不能据此发成功通知。原 `session/event` 的 `turn/end` 记录有 `seq/time/turn/reason`，需保留结束原因。
2. `completed`、`error`、`blocked`、`max-tokens` 是不同结算；`aborted` 为取消，`interrupted` 是历史崩溃日志的补记，均不作为新完成事件。未知插件扩展原因不猜成成功。
3. 原 Session 构造/载入历史不发布 `session/event`；append 后先进入会话日志再同步通知观察者，但不保证此时已刷盘。通知不能替代日志持久化确认。
4. 原 Gateway 的待审批/提问具有稳定 `eventId`；重连会把仍待处理的请求重送。手机 `PendingApproval/PendingQuestion.key` 只是展示计数，不能用于跨重连去重。原流没有初始集合完成标记，已通过[独立只读观察补丁](../../../plugin/compatibility/pending-notifications/README.md)同步取得集合并订阅增量；不用延时猜测恢复结束，也不增加审批参与者。
5. `RemoteActivity.returnToOrdinary()` 复用普通聊天页面，不再主动销毁 Remote。两种模式持有独立 WebView/凭据桥。Android在页面停止后不一定同步修改WebView的 `document.visibilityState`，现行通知分流使用原生生命周期。

来源：[原结束类型](../../../deepseek-harness/packages/core/session/src/types.ts)、[原 Session 发布](../../../deepseek-harness/packages/core/session/src/index.ts)、[Gateway 事件重送](../../../deepseek-harness/packages/api/gateway/src/index.ts)、[手机交互呈现](../../src/remote-core.mjs)、[RemoteActivity](../../android/app/src/main/java/dev/dshmobile/validation/RemoteActivity.kt)。上游参考检出保持只读。

## 已实现的数据通道

共享协议新增固定 `remote.taskFollow`，无历史游标、会话过滤或客户端指定权限字段。沿用已批准设备的聊天授权及真实路由上下文，计入网关每设备 8 条流的既有限制。`remote.negotiate.taskNotifications` 仅在实际注册服务时为 true。

首帧为 `{ type: 'ready', generation, pendingAvailable, pending }`；完成事件为 `{ type: 'outcome', sessionId, seq, time, turn, reason }`。手机用会话标识和原记录序号去重；Host代次只表示服务生命周期。服务只发布订阅期间的新结算，不读取或重放旧日志，不转发错误文字、模型内容、命令或路径，不修改审批和执行流程。

`pendingAvailable` 表示实际Gateway只读观察器存在；协商另有 `taskPendingNotifications`。存在时 `pending` 为同步初始集合，每项 `{eventId,sessionId,kind:'approval'|'question'}`，后续 `{type:'pending',item}` / `{type:'resolved',eventId}`。初始集合仅恢复状态与清除旧提醒，不通知；无补丁时明确false/空集合，只提供完成流。

每订阅最多缓存 256 项，服务最多 64 个订阅；溢出报 `remote_notifications_overflow` 并释放队列，容量满报 `remote_notifications_busy`。客户端取消、连接断开或服务释放清理等待者。后续手机遇到溢出应明确刷新当前任务状态并重新订阅，不补发历史通知，不声称事件完整。

实现：[Host 服务](../../../plugin/src/task-notifications.ts)、[生产插件注册](../../../plugin/src/index.ts)、[RemoteAdapter](../../../plugin/src/remote-adapter.ts)、[协议](../../../backend/packages/protocol/src/index.ts)。

现行安装状态见本文首节。旧电脑未协商通知能力时，手机不会启动不支持的通知流。下述前置检查发生在0.1.34阶段，当时尚未安装电脑通知增量。

## 验证与剩余工作

本轮检查：插件类型检查、构建及101项测试通过；后端类型检查、构建及50项测试通过，独立PostgreSQL用例1项按配置跳过。文档检查通过。测试未访问或变更正在运行的用户会话，未安装新插件/APK；上述结果不等于实际Android通知验收。

前置数据层增量：Gateway两文件补丁严格类型检查、正反向patch校验及4项原运行时检查通过；插件类型/构建及4项结束事件定向回归通过，后端生产插件入口/路由5项定向回归通过。当时手机242项测试、Web构建、APK构建和Android lint通过，72文档1584链接检查通过。生产 [RemoteModel](../../src/remote-model.mjs)在完成协商后创建只读订阅，[RemoteApp](../../src/RemoteApp.jsx)以电脑地址/设备绑定区分去重状态，Android桥仅新增固定方法白名单；同绑定核心重建保留内存记录。原生提醒为后续增量，现已实现并在本文首节记录实际验收。

手机 [RemoteNoticeLedger及订阅器](../../src/remote-task-notifications.mjs)严格校验帧，初始集合不发新提醒，处理后清除，迟到的已完成待办不能复活；结束事件以会话/seq去重，审批用原UUID。保留最多4096个近期身份及256项待办，不写磁盘、不跨进程回放。断线拒绝旧代次，重连重新取得原当前集合；协议/容量异常只标记通知同步失败，不重试写请求。5项[专用测试](../../tests/remote-task-notifications.test.mjs)覆盖上述行为，使用传输替身，不代表手机实际收到了系统通知。

- [Host 测试](../../../plugin/tests/task-notifications.test.ts)：使用真实 SessionStore/Session.append，覆盖历史排除、取消/修复排除、明确原因、敏感错误不转发、慢消费者溢出、容量释放、服务终止、Host 身份与 Adapter 取消。
- [生产插件联调测试](../../../backend/tests/plugin-integration.test.ts)：真实 Cordis 插件入口、SessionStore、网关、DPoP、PGlite 和 WebSocket，在三种注册来源下收到真实 append 的错误结算，排除已有完成与取消并清理订阅。模型消息入口及凭据存储仍是既有测试边界，不代表真实模型请求或已安装 App 验收。
- [网关路由测试](../../../backend/tests/remote-permissions.test.ts)：基本聊天权限、身份绑定、流取消和拒绝附加字段。此测试的桌面端为测试 socket，不能单独算 Host 业务验收。

交付增量：Gateway正式编译产物、类型声明与[五文件事务安装器](../../../plugin/compatibility/pending-notifications/install.mjs)已实现。严格类型检查、5项安装副本测试和正式编译文件的4项原Gateway行为检查通过；本机安装只读预检返回5文件、0已应用。安装器覆盖版本/原文件/产物核验、LF与CRLF精确恢复、重复及部分安装、未知改动/链接拒绝，保留已有后台与前台补丁。实际安装恢复、写入中断故障注入仍未验证，不把副本结果等同于生产安装成功。详细命令见[补丁交付说明](../../../plugin/compatibility/pending-notifications/README.md)。

### 双模式页面复用的实际验收

[ModeNavigation](../../android/app/src/main/java/dev/dshmobile/validation/ModeNavigation.kt)在同一应用任务中使用 `REORDER_TO_FRONT` 和 `SINGLE_TOP`。Remote返回、普通聊天原生打开及配对交接共用它，配对入口保留独立任务与一次性内存handoff，不清除普通聊天。与抽出常驻服务相比，此方式复用现有两套容器和隔离边界，修改范围小；停止的Activity仍可能被系统回收，未承诺后台永不掉线。

已在正常MuMu包覆盖安装、原绑定下完成：侧边栏连续3次切换、普通聊天设置的电脑连接入口、手机插件页电脑标签、系统返回。两页 `performance.timeOrigin` 不变且各只有一个，草稿保留，Remote返回显示连接正常，两个原生桥仅存在于各自来源；专用远程草稿测试标记已清空，最后回到「DSHM Remote 联调提示」。无模型消息、Key/服务地址/设备权限改动。配对入口任务重用、系统销毁Activity、后台长期驻留与系统通知尚未实测。

验证脚本：[verify-mode-lifecycle-android.mjs](../../scripts/verify-mode-lifecycle-android.mjs)；产物 `artifacts/mode-lifecycle-verify-android.json` 与 `artifacts/mode-lifecycle-entries-android.json`，分别为2026-09-25 02:00:59和02:03:10 UTC。脚本使用Android `topResumedActivity` 核对实际前台，不能用网页visibility猜测。最初脚本因visibility假设及插件页按钮命名失败，已按实测修正；未将这些失败描述为产品通过。Web构建、APK构建、Android lint与5项通知订阅回归通过。

验证时旧电脑/网关进程已退出，按原配置恢复：DSH源码入口 `pnpm dsh web --no-open` PID20288（3080），网关PID66472（8787），ADB反向8787已恢复；未安装新插件或Gateway补丁。启动日志含本机登录链接，不能整体输出到聊天。

双模式复用之后的原生提醒、分类设置、点击重读与电脑配套安装现已落地，验收及剩余工作以本文首节为准；完整A04仍未完成。

不引入常驻前台服务、云端离线推送、开机广播或进程唤醒。没有新建会话、普通聊天完成、输出分片或短暂断网提醒。系统通知仅用简短摘要，完整内容保留在 App。
