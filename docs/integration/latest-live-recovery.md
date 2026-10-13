# 新版持久联调的恢复与实际命令输出

- 状态：隔离发布Host的同环境重启和Android实际命令输出通过；固定源码五会话/880原事件的完整历史与身份重启保持已通过，仅追加官方恢复标记。原“序号不变”检查的失败保留，核验区别见下文。后台通知及完整新版交付仍待验。
- 维护角色：DSH Mobile项目协作Agent；核验日期：2026-10-06。
- 固定目标：DSH `0.2.1-alpha.1`，候选插件`0.1.76-latest.0`；日常旧版不升级。
- 来源：[恢复入口](../../../backend/scripts/start-latest-live.mjs)、[恢复边界](../../../backend/scripts/latest-live-resume.mjs)、[原电脑状态核对](../../../backend/scripts/audit-latest-live-resume.mjs)、[Android命令验证](../../scripts/verify-latest-live-encoding-android.mjs)。

## 保留同一环境恢复

默认`node scripts/start-latest-live.mjs`创建新的空测试home、网关和工作区，不用于恢复已配置Key的测试环境。原控制器stdin发送`{"action":"stop"}`，确认进程结束及原cleanup记录后，才在backend运行`node scripts/start-latest-live.mjs --resume`。

恢复入口只接受本项目`live-homes/<UUID>`的真实路径、固定工作区及数据库目录、原loopback网关端口和固定新版；旧控制器或Host仍活着、cleanup归属错误、路径/版本/网关身份改变均拒绝。恢复沿用原数据库、电脑凭据和手机授权，不重新注册、不创建工作区或聊天，不读取或复制Key；新的登录入口仍只写本机私有文件。四项[边界测试](../../../backend/tests/latest-live-resume.test.mjs)通过，真实活环境的提前恢复亦被拒绝。

真实Host从42112重启为73768，网关16901及原home保持。原登录与原`session/list`逐项核对电脑ID、设备指纹/状态/管理权限、全部四个会话ID/标题/序号/统计/模型/权限/模式均一致，且没有运行中的任务。当前聊天授权active、管理false，旧手机绑定仍为revoked，见[恢复前](../../../plugin/artifacts/latest-runtime-check/latest-live-resume-before.json)和[恢复后](../../../plugin/artifacts/latest-runtime-check/latest-live-resume-after.json)。这些报告的四会话范围是重启前快照，后续命令专项新建的第五个会话不纳入该快照。

旧控制器已完成Host、网关和数据库清理并写出cleanup，但其准备阶段的tsx/esbuild服务仍持有进程句柄；在确认原Host退出、网关无监听和cleanup后，从其原PTY结束控制器，不能把其退出码1当作正常停止通过。修正后的控制器22926在后续任务目录联调前完整清理并以退出码0结束；恢复后的Host71060沿用同一环境，五个会话及授权身份逐项一致。见[后续恢复与后台任务验收](latest-background-jobs.md)。后续固定源码Host71520仍用于联调，最终环境清理尚未执行。

## 手机实际命令输出

通过原手机页面在已有`test-project`新建独立“DSHM 新版命令编码验收”，设置为仅可查看。实际DeepSeek模型只调用一次原`pwsh`工具，输出中文/emoji标准流和错误流，等待20秒，再输出结束标记；不读写文件、联网或提权。原命令参数、唯一callId和同一原结果按原`session/page`核对，不注入工具或输出事件。

首次实际命令输出正确，但验证器误用“命令详情”按钮且没有展开默认折叠的过程，30秒定位超时，保留[start失败](../../../plugin/artifacts/latest-runtime-check/latest-live-encoding-android-start.json)。修正为原过程折叠按钮及“工具详情”入口后，只观察同一次已完成调用；[手机与原结果](../../../plugin/artifacts/latest-runtime-check/latest-live-encoding-android-observe.json)通过，此次`liveBeforeSettlement=false`，不算实时输出证据。

同会话第二条显式实时验收使用独立尝试记录，原调用`call_00_oMY6HjkwfAaFasWymFWH1051`执行时手机已显示首段中文和emoji；原会话仍running，证明没有只等待最终工具结果。首次过早观察尚未结算，被断言拒绝并保留[记录](../../../plugin/artifacts/latest-runtime-check/latest-live-encoding-live-android-observe-early.json)；加入有界只读观察等待后，不重发命令，真实[运行中](../../../plugin/artifacts/latest-runtime-check/latest-live-encoding-live-android-live-start.json)、[结算](../../../plugin/artifacts/latest-runtime-check/latest-live-encoding-live-android-observe.json)和[退出聊天后重入](../../../plugin/artifacts/latest-runtime-check/latest-live-encoding-live-android-replay.json)均通过。标准流、错误流和执行结果含完整中文/emoji，无替换字符或ConstrainedLanguage初始化错误；原只读权限保持，两条调用均无额外工具或重试。

截图：[运行中](../../../plugin/artifacts/latest-runtime-check/latest-live-encoding-live-running.png)、[结算](../../../plugin/artifacts/latest-runtime-check/latest-live-encoding-live-observe.png)、[历史重入](../../../plugin/artifacts/latest-runtime-check/latest-live-encoding-live-replay.png)。手机仅加载DSHM自有Remote页面，无iframe；证据来自`.latesttest`原App和真实发布Host，不代表十二项源码Android或源码推理已经通过。PowerShell7/5.1、独占936控制台及原写入/类型约束由[编码四组合](../../../plugin/compatibility/latest-upstream/pwsh-encoding.md)单独覆盖，本次手机验收不扩展为任意系统代码页。

## 固定源码实际运行与手机卡片（2026-10-06）

固定源码commit为`5badb15009ae1756c3afe0ae0cef1faafc290ccc`，使用隔离检出的真实`pnpm dsh web`和原持久home，当前已通过租约安装30项源码文件修改并完整构建。须以TTY运行`node scripts/start-latest-live.mjs --source --resume --diagnose-output`；非TTY的stdin结束会触发控制器正常清理，并不代表Host保持运行。60108为这种中间清理实例，71520为后续实际源码Host。原259→260序号增加已从原历史确认是官方恢复的空`session/end-seed`，不能把严格序号审计的失败改称通过。

源码历史原工具卡片曾报`useDisclosure is not a function`。手机自定义聊天节点缺少新版原`CHAT_NODE_INJECT`的`disclosure`注入，`turnData`仍使用旧上下文结构；停止卡片也未转交该hook。现由[新版展示适配](../../src/remote-chat-presentation-latest.jsx)沿用原`bindDisclosure/useTurnDataValue`，旧版分支保持原接口；[停止卡片](../../src/remote-tool-cancellation.jsx)传递同一hook。[真实Android历史回归](../../scripts/verify-latest-live-history-android.mjs)在encoding、ptc、primary三会话通过原卡片展开、零控制台错误、无电脑iframe。该验证只读取既有真实历史，不重新执行旧工具；相关JSON和截图位于`plugin/artifacts/latest-runtime-check/latest-live-source-history-{encoding,ptc,primary}.*`。

验证器另曾点击后台保留的Remote WebView而超时。DOM可见不代表Android前台可操作，[实际入口](../../tests/support/latest-live-context.mjs)现核对`topResumedActivity`，通过普通聊天的Remote按钮恢复原Activity；首次等待及后台点击失败报告保留。

`source-context`独立尝试只执行一次指定pwsh（`call_00_ET_0fycHrEZLzPOPq8Chts09117`），原双流中文/emoji、结束标记及最终回复正确，无替换字符，权限保持read-only；运行中手机未读到首段，不能记为实时通过。随后同一原输出身份的只读请求返回available/completed、82字节，见[原结果审计](../../../plugin/artifacts/latest-runtime-check/latest-live-source-context-output-original-audit.json)与[只读请求](../../../plugin/artifacts/latest-runtime-check/latest-live-source-context-raw-read.json)。先前`source-diagnostic-retry`实际有两条调用，单列失败，不计单次命令通过；测试插件最初缺少包版本导致的`REQUEST_EXTENSION`也保留。

基于原调用先发布、执行器稍后注册的时序，[前台读者](../../src/remote-live-command-output.mjs)新增首次实时读取的有限等待：仅对尚未结算的同一调用、零游标、无已确认outputId、精确`remote_command_missing`最多重试40次/约10秒。其他错误、历史、已结算或旧身份不自动重试；仍核对服务/连接/调用代次。新增回归先失败，修复后命令/后台输出/原工具解析20项通过。

修复APK通过`assembleDebug/lintDebug`，165个Web资源与候选构建逐字节一致（原Sync排除bundle-analysis.json），SHA256为`b13830e40226f03ec0ab3e4126cbbb7365b59e73c77b8435e36b77388ecce14e`。[安装产物证明](../../../plugin/artifacts/latest-runtime-check/latest-source-registration-apk.json)与实际`install -r`成功；没有清除数据、复制Key或扩大管理权限。MuMu实例0实际前台已核对，普通聊天与Remote均有实际截图。

新`source-registration`尝试没有重放旧seed。原调用`call_00_ET_Hd6j2flSz2tajiZ0aQSH4997`仅执行一次165字符指定只读命令，原seq307/308精确对应调用与结果，双流中文/emoji、结束标记及最终回复正确。实际手机在原会话仍running时已显示首段，随后读取两类输出与执行结果，并退出聊天后重入同一原调用，三阶段均通过：[运行中](../../../plugin/artifacts/latest-runtime-check/latest-live-source-registration-encoding-android-live-start.json)、[结算](../../../plugin/artifacts/latest-runtime-check/latest-live-source-registration-encoding-android-observe.json)、[历史](../../../plugin/artifacts/latest-runtime-check/latest-live-source-registration-encoding-android-replay.json)、[原调用审计](../../../plugin/artifacts/latest-runtime-check/latest-live-source-registration-output-original-audit.json)。源码30文件及固定commit逐次核验；只读权限保持，无其他工具或重试。这只证明前台命令专项，不代替源码后台任务、停止、审批、提问、通知及完整新版交付。

仅诊断插件读取测试执行身份和字节读者能力，不读取Key或替代执行器。`observers=[]`不能证明生产监听器缺失；其内部函数字符串匹配只是诊断线索，后续同一原接口已读取成功。源码租约当前仍ready，结束时必须先清理实际Host，再恢复30原文件、启动入口和原355资源摘要，不把历史其他专项的恢复算成本轮恢复。

## 固定源码的完整历史恢复核对（2026-10-06）

固定原`packages/core/session/src/index.ts:616-617`在恢复的seed末尾不是`session/end-seed`时追加普通空标记；原`properties.spec.ts`另要求原事件前缀和派生消息完全一致、已有末尾标记不重复增长。因此此前“序号完全不变”的[严格失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-writable-resume-after-failed.json)不是历史丢失或重复执行证据，保留其原失败状态，不改写为通过。

新增[完整核对器](../../../backend/scripts/audit-latest-live-durable-resume.mjs)按原`session/page`契约分页读取全部事件，检查0起点、连续序号、完整覆盖和稳定游标，保存逐事件规范化SHA256，不记录Key。重启后逐条核对原前缀及所有message-producing事件，完整projection值、home/工作区/网关、电脑/设备身份必须完全一致。只允许0或1个新增事件；新增时必须是末尾`session/end-seed`且data严格为空、旧末尾不是同类标记；任何原事件改变、其他新事件或序号倒退均失败。

Host68820/控制器35580从原PTY正常停止，进程消失和cleanup归属核对后，同home/16901恢复为Host44756/控制器55768（PTY45801）。手机原Remote打开既有PTC聊天，workspace-write/running=false确认。[恢复前快照](../../../plugin/artifacts/latest-runtime-check/latest-live-source-durable-resume-before.json)、[实际手机](../../../plugin/artifacts/latest-runtime-check/latest-live-source-durable-resume-android.json)和[完整通过报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-durable-resume-after-report.json)证明五会话共880个原事件逐条不变，PTC追加一个普通恢复标记，其他会话不增；所有消息/projection/授权保持，设备管理false。该恢复不新建会话、不重新配对、不发送模型请求；不代替后台任务输出跨Host持久性或最终源码租约恢复。
