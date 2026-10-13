# 新版可继续子会话的真实模型验收

- 状态：固定发布和实际源码入口的可继续子会话创建/续聊/重启恢复、unknown读取、身份资料故障、服务卸载在途、停止后独立输出与后台通知点击隔离均有实际手机证据。一次性只读、原发现/控制工具、两层导航/停止及显式恢复父任务后的第二层手机续聊通过；直接父任务已释放时仍按原 DSH 禁止发送。原APK/历史保持，原37文件/启动字节、完整构建与355资源精确恢复归档。其他控制边界、完整取消专项及最终新版交付继续验收。
- 维护角色：DSH Mobile 项目协作 Agent；最近核验：2026-10-07。
- 固定目标：DSH `0.2.1-alpha.1` / `5badb15009ae1756c3afe0ae0cef1faafc290ccc`，插件候选 `0.1.76-latest.0`。日常旧 DSH/App 保持。
- 来源：[实际 Android 驱动](../../scripts/verify-latest-live-child-model-android.mjs)、[实际命令停止驱动](../../scripts/verify-latest-live-child-stop-android.mjs)、[受限只读入口](../../tests/support/latest-live-context.mjs)、[手机子会话发送](../../src/remote-model.mjs)、[原 SDK 请求类型](../../../plugin/artifacts/latest-source-check/packages/subagent/subagent/src/control-types.ts)、[原历史接口](../../../plugin/artifacts/latest-source-check/packages/api/session-controller/src/history.ts)。

## 恢复父任务后的第二层手机续聊（2026-10-07）

- 状态：发布与实际源码 `pnpm dsh web` 均通过复用原父子身份、显式恢复直接父任务、手机直接续聊第二层任务、真实回复/唯一消息、停止进程、处理队列后释放、历史重入与原App恢复。原37文件/启动字节、完整恢复构建与355资源精确核验并归档。
- 维护角色：项目协作 Agent；最近核验：2026-10-07。
- 来源：[实际Android驱动](../../scripts/verify-latest-live-nested-resume-android.mjs)、[受限只读诊断](../../scripts/inspect-latest-live-nested-resume.mjs)、[原冷恢复](../../../plugin/artifacts/latest-source-check/packages/subagent/subagent/src/continuation.ts)、[原取消与释放](../../../plugin/artifacts/latest-source-check/packages/subagent/subagent/src/continuation-activation.ts)、[原待处理消息](../../../plugin/artifacts/latest-source-check/packages/subagent/subagent/src/inbox.ts)。

复用上一轮两棵原树，没有新建子任务或提高深度限制。本轮在正常配置 `subagentDepthDiagnostic=false` 下，由手机向根会话发送一条明确的恢复请求；原模型仅调用一次原 `send_message` 恢复直接子任务。中间层仅执行一次打印中文/emoji及自身PID、等待180秒的原 `pwsh`，无文件/网络/环境修改。实际输出与PID存活、原 `session/list.agentAvailable=true` 和手机 `parentAvailable=true` 核对后，手机沿两层菜单直接发送一条无工具续聊。原第二层会话新增唯一用户rpc、真实模型回复与completed；允许原系统要求的 `send_message` 回报直接父任务，不能以送达回执代替实际回复。

| 入口 | 原 Host / 原第二层会话 / 实际等待进程 | 实际证据 |
| --- | --- | --- |
| 发布 | 33084 / d45bf5f9-3ec0-48d9-8a26-1f3c9ddaa7c3 / 23548 | [父任务输出与存活](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-resume-android-hold-observe.json)、[手机唯一提交/父草稿保留](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-resume-android-send.json)、[原实际回复41事件](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-resume-android-reply.json)、[显式收尾与释放](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-resume-android-settled-recovery.json)、[重入](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-resume-android-replay.json)、[清理](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-resume-android-cleanup.json) |
| 实际 pnpm dsh web | 24860 / 21c21c83-ef4f-472f-b9a8-2a2871fb37b8 / 12068 | [父任务输出与存活](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-resume-android-hold-observe.json)、[手机唯一提交/父草稿保留](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-resume-android-send.json)、[原实际回复41事件](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-resume-android-reply.json)、[显式收尾与释放](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-resume-android-settled.json)、[重入](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-resume-android-replay.json)、[清理](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-resume-android-cleanup.json) |

### 停止与释放不同，原失败保持

发布[首次释放验证失败](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-resume-android-settled.json)保留。实际命令已经退出，唯一原工具结果ABORTED、原轮aborted/user；但手机停止使用原取消 `keepInbox:true`，第二层的relay和settled回报仍是两条next-step待处理消息。原释放条件要求Inbox无待办且无ownedChildren，因此停止不等于释放；不将它描述为生产取消失败。[发布原待办核对](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-resume-android-stop-observe.json)与[源码原待办核对](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-resume-android-stop-observe.json)均核对两条来自同一原第二层会话的消息、进程退出/原结果及父Agent仍可用。

随后分别由手机向中间层发送一条明确“处理已有回报并收尾、不补做或重试命令”的新请求；这不是重发未知请求或在后台自动激活父模型。唯一原用户rpc、completed和真实收尾回复、空Inbox、原父Agent释放均严格核对。中间层总记录各158条、第二层各41条；原完整前缀保持，仅新增实际测试记录。重入同一第二层显示原回复，因父已释放再次禁用发送；不得从“停止成功”推断“父已释放”。本轮没有改变生产控制协议、认证、APK或配对。

[源码切换前](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-nested-resume-source-before.json)26会话/3576事件、[源码首次读取](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-nested-resume-source-after-review-audited.json)26/3577；[恢复前](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-nested-resume-source-before-restore.json)26/3664、[正常发布恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-nested-resume-source-after-restore-audited.json)26/3665。全部原前缀/投影和设备身份保持，每次切换只新增一个官方空恢复标记。

正常发布Host17620的[原App恢复核对](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-resume-android-restored.json)通过：父1783条完整事件，两棵原树、原read-only/never和workspace-write权限、空草稿与聊天授权management=false保持；两个等待PID均退出。原APK摘要 `58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b`、App PID32632及配对保持，无iframe或页面错误。

候选完整构建378.945秒、原完整恢复构建382.227秒均退出0、无超时。[排他归档](../../../plugin/artifacts/latest-runtime-check/latest-live-source-lease-nested-resume-final.json)核对37原文件/根启动字节、355资源SHA-256 `517da690aabff313743f2be09dd93e06b218bacf579bebb87ca330d50702f107`、Git干净和无活动租约。7项恢复启动门槛、9项目录/视图回归、4个脚本语法及两仓库diff检查通过。MuMu实际设备窗口最终前台显示原父聊天，输入为空。此次正向第二层续聊证明“显式恢复父任务后可继续原会话”，不提供父已释放时的自动级联唤醒；原七条总标准、其他控制边界、SDK/Electron及完整新版交付继续。

## 两层子任务导航与祖先停止（2026-10-07）

- 状态：发布与实际源码入口的真实两层创建、运行输出、原发现工具、逐层导航、独立草稿及祖先停止通过。直接父任务已释放时，第二层手机续聊被原 DSH 拒绝；不能记作续聊通过。正常服务/原 App/全部历史、原源码与完整355资源恢复核对及归档通过。
- 维护角色：项目协作 Agent；最近核验：2026-10-07。
- 来源：[实际手机驱动](../../scripts/verify-latest-live-nested-child-android.mjs)、[首次发送诊断](../../scripts/inspect-latest-live-nested-send.mjs)、[受限原目录读取](../../tests/support/latest-live-context.mjs)、[官方深度配置](../../../plugin/artifacts/latest-source-check/packages/subagent/subagent/src/index.ts)、[原父可用性判断](../../../plugin/artifacts/latest-source-check/packages/api/session-controller/src/client/sessions/manager.ts)。

原 DSH 默认 maxDepth=1。本轮仅在已有隔离 home，通过[诊断启动器](../../../backend/scripts/start-latest-live.mjs)及官方 `subagent` 配置将上限临时设为2；未修改正常 overlay、用户配置、权限、认证或生产协议。父模型经手机只发送一次原 send_message，让原只读子任务创建一个 continuable 孙任务。孙任务实际 pwsh 仅打印中文/emoji和自身 PID，等待180秒，无文件/网络/提权操作。看到原输出和真实 PID存活后，由祖先模型调用一次原 interrupt_agent；原 PID退出、唯一 ABORTED 和 aborted/parent、手机停止卡片逐项核对。

| 入口 | 原 Host / 孙任务 | 实际证据 |
| --- | --- | --- |
| 发布 | 59816 / d45bf5f9-3ec0-48d9-8a26-1f3c9ddaa7c3；命令11220 | [输出/PID](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-child-android-running.json)、[原列表](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-child-android-list-observe.json)、[逐层导航/草稿](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-child-android-views.json)、[实际停止](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-child-android-stopped.json) |
| 实际 pnpm dsh web | 40824 / 21c21c83-ef4f-472f-b9a8-2a2871fb37b8；命令42592 | [输出/PID](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-child-android-running.json)、[原列表重读](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-child-android-list-observe-recovery.json)、[逐层导航/草稿](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-child-android-views.json)、[实际停止](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-child-android-stopped.json) |

原 list_agents 的 children均为12个直接continuable子项，不包含孙任务；descendants发布为13项、源码为14项，逐项核对 parent/depth/label。源码多出的一项是此前已停止但完整保留的发布孙任务，状态inactive；当前源码孙任务为depth2/running。首次源码[列表失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-child-android-list-observe.json)因验证器未计入已保留发布孙任务；失败保留，随后只读同一原请求结果，核对该孙任务完整历史与实际进程已退出，不重新调用模型或忽略额外项。

### 直接父任务释放后的续聊限制

发布[手机续聊点击失败](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-child-android-resume.json)保留：按钮处于disabled，原请求没有发送。[只读诊断](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-child-send-inspection.json)确认输入仍为原草稿、孙任务仍为21条完整事件、尝试后没有新事件。[受限重入](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-child-android-unavailable-recovery.json)与[源码同一边界](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-child-android-unavailable.json)进一步核对原 SessionSnapshot.subagent.parentAvailable=false、原 session/list直接父项agentAvailable=false，手机显示「父会话暂不可用，恢复后可以继续聊天。」；没有伪造父可用、自动唤醒父模型或重发未知消息。

原 [subagents.prompt](../../../plugin/artifacts/latest-source-check/packages/subagent/subagent/src/index.ts)要求直接父 Agent仍在 registry中，否则返回subagent/parent-unavailable。查看原历史或持有客户端会话引用不能代替父 Agent激活。此处是原 DSH能力边界；该轮拒绝不能代替正向续聊。后续[显式恢复父任务后的两种入口实际续聊](#恢复父任务后的第二层手机续聊2026-10-07)已补验，原拒绝及发送失败不被覆盖。首次[边界验证器失败](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-child-android-unavailable.json)误从手机导航行读取agentAvailable；改为读取原session/list真实父行，原失败与同一Host受限重读证据分别保留。

仅清除本轮孙任务尚未发送的测试草稿，原父workspace-write、空草稿、历史及聊天授权management=false保持：[发布清理](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-child-android-cleanup-unavailable.json)、[源码清理](../../../plugin/artifacts/latest-runtime-check/latest-live-source-nested-child-android-cleanup-unavailable.json)。[专用配置移除器](../../../backend/scripts/remove-latest-subagent-depth-overlay.mjs)在两种cleanup通过且原Host/命令PID均退出后，核对精确文件字节并移除测试overlay；[移除证据](../../../plugin/artifacts/latest-runtime-check/latest-live-nested-child-overlay-removed.json)通过。

[源码切换前](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-nested-source-before.json)25会话/3345事件、[源码首次读取](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-nested-source-after-review-audited.json)25/3346；[恢复前](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-nested-source-before-restore.json)26/3487、[正常发布恢复后](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-nested-source-after-restore-audited.json)26/3488。全部原前缀/投影/设备身份保持，切换/恢复各只增一个官方空end-seed。正常发布Host33084的[原App恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-release-nested-child-android-restored-unavailable.json)通过：父1714条完整记录，两棵原树历史保持，两个命令PID已退出，原APK SHA-256及App PID32632不变。

候选完整构建378.168秒、原恢复完整构建385.415秒均退出0且无超时。[排他归档](../../../plugin/artifacts/latest-runtime-check/latest-live-source-lease-child-nested-final.json)逐项核对37原源码/根启动字节、完整355资源SHA-256 `517da690aabff313743f2be09dd93e06b218bacf579bebb87ca330d50702f107`，Git干净、无活动租约。首次归档命令额外传tsx import因插件目录无该包，在执行正文前失败；改用此Node24环境的原普通node入口成功，不安装新依赖或绕过归档断言。7项恢复启动边界、9项目录/视图回归、8个相关脚本语法及两仓库diff检查通过；实际MuMu设备窗口最终前台显示原父会话，输入为空。

该轮只扩展实际验收驱动、只读原目录链核验和精确测试配置恢复，没有修改生产控制工具、鉴权或APK。该轮缺少的正向第二层续聊已由后续显式恢复父任务专项补验；其他子控制边界、原七条总标准及最终新版交付继续。

## 父模型发送消息与停止子任务（2026-10-07）

- 状态：发布及实际源码入口的原发送、实际取消、停止后续聊、历史重入、全环境恢复审计及原源码/完整资源恢复归档均通过，不代表完整新版兼容完成。
- 维护角色：项目协作 Agent；最近核验：2026-10-07。
- 来源：[实际手机驱动](../../scripts/verify-latest-live-child-control-android.mjs)、[原控制工具](../../../plugin/artifacts/latest-source-check/packages/subagent/tool-subagent-control/src/index.ts)、[原激活/取消实现](../../../plugin/artifacts/latest-source-check/packages/subagent/subagent/src/continuation-activation.ts)、[原pwsh参数](../../../plugin/artifacts/latest-source-check/packages/shell/tool-pwsh/src/index.ts)。

本轮复用此前已停止/清理的原只读continuable子项，没有新建子任务或修改授权。手机向原父模型提交请求，父模型真实调用`send_message`；原回执只表示送达，验证继续核对唯一原relay用户事件、原发送方/内容及子模型的实际新回复。随后子模型只运行一条打印中文/emoji和自身PID、等待120秒的无文件/网络命令。看到真实独立输出并确认PID存活后，手机请求父模型调用`interrupt_agent`，继续检查实际进程退出、唯一原pwsh结果ABORTED、原轮aborted/parent及手机停止卡片；不以“已请求停止”回执当作停止成功。

发布Host73860、原App PID32632下，原子会话`d8796a33-bdd7-47b1-93ed-c9c4db66815e`的委派read-only/never保持。实际命令PID77572退出，原工具callId`call_00_ET_EtpFHA7KHit3U8qsOZEC7853`仅调用一次。再次经父模型发送无工具消息后，原子模型正常回复；重新进入同时显示停止卡片及新回复，全部原父子事件摘要/序号保持。父workspace-write和空草稿恢复，原APK/配对未更新。

实际源码`pnpm dsh web`的13组/37文件候选完整构建380.926秒退出0、无超时；Host15912沿同一home/App/绑定复验原子会话`65cab52d-4ffe-428d-86f7-5d6aa52b83b3`。同一流程十阶段均退出0，实际命令PID41872存活后被原父模型取消，callId`call_00_ET_r5s4W9g4qSV4g45P7oVT4420`仅一次、原结果ABORTED及aborted/parent。新消息/实际回复和停止记录均保留，各原子会话最终82条完整事件。没有新增APK、配对或管理权限。

| 发布入口核对 | 原证据 |
| --- | --- |
| 原发送回执、唯一relay及真实子回复 | [send-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-control-android-send-observe.json) |
| 原正在运行的命令输出、PID存活 | [running-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-control-android-running-observe.json) |
| 父模型停止请求、真实进程退出及原aborted/parent | [interrupt-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-control-android-interrupt-observe.json) |
| 停止后同一子会话实际新回复 | [resume-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-control-android-resume-observe.json) |
| 原停止卡片/新回复、原全部历史及空草稿/权限 | [replay](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-control-android-replay.json)、[cleanup](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-control-android-cleanup.json) |

首轮[running-start失败](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-control-android-running-start.json)保留：验证器把完整参数对象误限定为三字段，实际模型按原工具契约补充了必填`description`。修正验证器为严格核对command/timeoutMs/run_in_background，只额外允许并要求非空description；随后沿同一原请求/同一命令继续观察，没有重发或重新执行命令。失败不能算通过，也不是生产工具错误。当前主候选不含另一归档的停止后独立输出保留修复，因此本轮只验证停止前真实输出、停止结果和历史；停止后输出重读由下文独立专项证明，不混用候选证据。

| 实际源码入口核对 | 原证据 |
| --- | --- |
| 原发送回执、唯一relay及真实子回复 | [send-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-control-android-send-observe.json) |
| 原独立输出、实际命令PID存活 | [running-start](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-control-android-running-start.json) |
| 父模型停止请求、实际退出及原aborted/parent | [interrupt-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-control-android-interrupt-observe.json) |
| 停止后同一子会话真实回复、重入/原历史及清理 | [resume-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-control-android-resume-observe.json)、[replay](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-control-android-replay.json)、[cleanup](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-control-android-cleanup.json) |

[切换前](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-control-source-before.json)与[源码首次读取](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-control-source-after-review-audited.json)均24会话/3057事件；[恢复前](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-control-source-before-restore.json)24会话/3202事件。首次恢复审计在两次只读投影间遇到原asOfSeq1553→1554，[严格失败报告](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-control-source-after-restore-audited.json)保持。受限settled阶段必须先核对同home/同Host原失败，再重新读取完整原历史；没有重启或重发。[稳定后全审计](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-control-source-after-restore-audited-settled.json)通过，24会话/3203事件，只增一个官方空end-seed；全部原前缀/投影/Host及设备身份保持、management=false。

正常发布Host17884恢复独立主候选；[实际App恢复核对](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-control-android-restored.json)退出0，父1555条完整事件及两子各82条原事件摘要保持，两个命令PID已退出、workspace-write/空草稿/无通知，原App PID32632及原APK SHA-256`58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b`保持。多层发现、其他子控制边界与完整新版交付仍按原标准继续。

原恢复完整构建377.901秒退出0、无超时；[排他归档](../../../plugin/artifacts/latest-runtime-check/latest-live-source-lease-child-control-final.json)严格核对37原源码/根启动字节、原完整355客户端资源逐项相同、Git干净且无活动租约。日常旧版、Key和原App保持。本轮仅新增实际验收驱动与源码归属范围、只读审计稳定后重读入口，没有修改生产协议、鉴权或控制工具。五项目录/工作流回归、四个相关脚本语法与两仓库差异检查、153份Markdown/9162条本地链接通过；真实MuMu设备窗口最终前台显示原DSHM父会话，输入为空。

## 一次性子任务与原列表工具（2026-10-07）

- 状态：固定发布及实际源码入口的六阶段手机专项、全历史恢复核对和原源码/完整资源精确恢复归档通过，不代表完整新版兼容完成。
- 维护角色：项目协作 Agent；最近核验：2026-10-07。
- 来源：[真实手机驱动](../../scripts/verify-latest-live-one-shot-android.mjs)、[只读规则](../../src/remote-subagents.mjs)、[主/旁栏共享页面](../../src/ui/RemoteWorkspace.jsx)、[原前台委派](../../../plugin/artifacts/latest-source-check/packages/subagent/tool-subagent/src/index.ts)、[原列表工具](../../../plugin/artifacts/latest-source-check/packages/subagent/tool-subagent-control/src/list-agents.ts)。

同一专用父会话经手机只提交一次真实模型请求，参数`run_in_background:false`。原subagent工具进入前台等待路径，子模型实际回复中文/emoji标记，父工具结果含原子回复；原父目录和子descriptor均为one-shot，子轮正常完成、没有工具调用。没有构造子历史、修改原事件或使用模型替身。

| 实际入口 | Host | 实际子会话 | 创建/原历史 | 手机主页面与旁栏 | 原列表返回 | 清理 |
| --- | --- | --- | --- | --- | --- | --- |
| npm发布`node dsh/lib/bin.js web` | 11480 | `7c63904a-17bc-4607-b795-a8e7bbbc8ea2`，seq0–19 | [单次提交](../../../plugin/artifacts/latest-runtime-check/latest-live-release-one-shot-android-start.json)、[父结果与完整子历史](../../../plugin/artifacts/latest-runtime-check/latest-live-release-one-shot-android-observe.json) | [两处只读、父草稿保持与原历史一致](../../../plugin/artifacts/latest-runtime-check/latest-live-release-one-shot-android-views.json) | [两种范围](../../../plugin/artifacts/latest-runtime-check/latest-live-release-one-shot-android-list-observe.json) | [空草稿/原权限](../../../plugin/artifacts/latest-runtime-check/latest-live-release-one-shot-android-cleanup.json) |
| 固定源码`pnpm dsh web` | 8332 | `442e05f5-fd49-4cb2-919a-d2bfbea239a3`，seq0–19 | [单次提交](../../../plugin/artifacts/latest-runtime-check/latest-live-source-one-shot-android-start.json)、[父结果与完整子历史](../../../plugin/artifacts/latest-runtime-check/latest-live-source-one-shot-android-observe.json) | [两处只读、父草稿保持与原历史一致](../../../plugin/artifacts/latest-runtime-check/latest-live-source-one-shot-android-views.json) | [两种范围](../../../plugin/artifacts/latest-runtime-check/latest-live-source-one-shot-android-list-observe.json) | [空草稿/原权限](../../../plugin/artifacts/latest-runtime-check/latest-live-source-one-shot-android-cleanup.json) |

主页面与原插件旁栏均显示一次性子任务的实际回复和“这是一次性子任务，可以查看执行记录。”，不挂载消息输入框、发送按钮或附件入口。返回原父会话后，本轮独立草稿仍在；关闭旁栏后再核对全部原父/子事件摘要一致。每种入口各六阶段始终为原App PID32632、iframe数量0、页面错误0；没有更新APK、配对、管理权限或生产插件/网关代码。

手机随后在原父会话提交另一个独立模型请求，实际依次执行`list_agents({scope:'children'})`和`list_agents({scope:'descendants'})`。按原tool/call的callId对应tool/result、核对非错误及原rpcId；两种返回均列出原12个continuable子项、状态inactive，并排除one-shot。children行不携带父级/深度，descendants行携带同一原父ID及depth1。结果与原父目录逐项比较，不以模型总结代替原工具返回。

**覆盖边界：**本轮实际目录只有直接子项，故descendants只证明直接子项的父级/depth1和一次性对象排除，不证明多层嵌套、诊断项、running状态、send_message或interrupt_agent已全验。前台一次性任务结果正常完成，也不能替代取消或后台一次性job的独立验收。

固定13组/37文件候选完整构建380.371秒退出0；原恢复完整构建373.068秒退出0，均无超时。[排他归档](../../../plugin/artifacts/latest-runtime-check/latest-live-source-lease-child-one-shot-final.json)核对37原文件/根启动字节、Git干净、完整355原资源逐项精确一致且无活动租约；原资源SHA-256为`517da690aabff313743f2be09dd93e06b218bacf579bebb87ca330d50702f107`。

[切换前](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-one-shot-source-before.json)与[源码首次读取](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-one-shot-source-after-review-audited.json)均为23会话/2849事件；[恢复前](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-one-shot-source-before-restore.json)为24会话/2909事件，[恢复后全历史审计](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-one-shot-source-after-restore-audited.json)为24会话/2910事件，只增加一个官方空end-seed。原所有事件前缀、投影、Host/设备身份一致，原聊天授权保持、管理false。

正常发布Host73860恢复，[实际App恢复核对](../../../plugin/artifacts/latest-runtime-check/latest-live-release-one-shot-android-restored.json)退出0：原APK SHA-256`58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b`未变化，App PID32632保持；父1360条完整事件及两次子任务各20条事件的原摘要/序号一致，workspace-write/空草稿/无通知，真实MuMu设备窗口前台显示DSHM父会话。五项原目录/工作流状态回归、三个脚本语法与差异检查通过；153份Markdown/9131条本地链接校验通过。

## 后台子任务通知与点击隔离（2026-10-07）

- 状态：修复前真实发布链路未通过通知隔离；窄范围候选修复后的原生回归、发布及实际源码手机链路均通过。原 APK、原37文件/完整构建/355资源均已精确恢复并归档，完整新版兼容仍待验。
- 维护角色：项目协作 Agent；最近核验：2026-10-07。
- 来源：[实际模型通知驱动](../../scripts/verify-latest-live-child-notice-android.mjs)、[原生回归驱动](../../scripts/verify-latest-native-notice-click.mjs)、[通知实现](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNotifications.kt)、[原生回归](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteNotificationRestoreChecks.kt)。

正常发布 Host3960、同一父会话与原 App PID12296 下，手机只发一次真实父模型请求，创建后台子任务 `f53d0da4-6a5e-4577-b601-847dd121007b`；子模型回复独立标记及约250字正文。App 退到后台后，系统确有父、子两个会话的通知，父页面独立草稿保持。通知标题由原会话生成，不能要求与子任务描述相同。[实际送达核对](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-notice-attempt-3-android-observe-notice.json)通过。

点击实际子通知后，手机选中了原子会话且显示原回复，但父通知也消失。[严格点击检查](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-notice-attempt-3-android-inspect.json)保留失败；[独立目标核对](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-notice-attempt-3-target-observed.json)明确 `passed:false`、目标正确且父通知误清。[失败后的定向清理](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-notice-attempt-3-android-failure-click-cleanup.json)只证明原返回父历史、完整子历史、workspace-write 与原草稿恢复；`notificationIsolationPassed:false`，不能视为功能通过。最终仅清除本轮独立草稿，不重发模型请求。

首轮及 attempt-2 的编辑器尚不可输入、首轮清理将上下文消息误计为人类提交、attempt-3 将通知标题误当子任务描述等验证器失败报告均保留。修正为等待原 `contenteditable=true`、只按原 `source.kind=user` 审计人类提交、读取实际系统标题，并沿同一已有请求继续检查。未放宽父通知必须保持的断言，三次实际子任务记录保留在专用测试历史中。

实际原因是通知唤醒后台 RemoteActivity 时，原 `resumed()` 先消费旧父页面的可见会话提醒，异步导航随后才选中子会话。候选仅在存在原通知点击目标时跳过这一旧页面消费；原页面导航确认实际选择后，继续沿现有 `current()` 与目标确认流程清理相应会话，不修改通知 payload、认证或事件来源。

独立 `.latestnoticetest` UID 直接调用生产生命周期与真实系统通知服务：先发布父、子两条通知，再接受子目标并恢复 Activity；修复前父键缺失，修复后两键保持。随后选择子会话只消费子通知，暂停/恢复仍保留父通知，返回父会话再消费父通知；没有待处理点击目标的普通恢复仍清理当前会话通知。测试只使用隔离通知绑定，不读取 Key、不连接模型，不能代替实际 Remote 全链路。

| 原生阶段 | 证据与结果 |
| --- | --- |
| [修复前回归](../../artifacts/latest-native-notice-click-red-recovered.json) | `redReproduced:true`、`passed:false`，实际系统只剩子通知键；原生测试源摘要 `d6998eea896c3744a09b40246769c8ebb2cdc04b323be47a17d088ac7b449f2b`。首次 pm 查询未安装包的返回码处理失败另保留于 red 报告。 |
| [修复后回归](../../artifacts/latest-native-notice-click-green.json) | `passed:true`，同一测试源/测试 APK 摘要保持；生产通知源变化，真实系统通知账本、恢复与点击隔离通过。Android 构建23秒退出0，未改全局 SDK 配置。 |
| [临时包清理](../../artifacts/latest-native-notice-click-cleanup.json) | 仅移除本轮测试 UID 与 instrumentation 包；原主 App PID12296、安装包摘要 `58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b` 保持。 |

原生回归结束时，主真实模型 App 尚未安装本次候选修复；Key、配对、聊天授权与日常旧版未替换。用户反映前台 MuMu 没有 App 后，重新核对两条 ADB 连接均可见同一安装包与 RemoteActivity，并将实际「MuMu安卓设备」窗口激活，原 DSHM 测试聊天可见。随后临时更新同一专用新版 App 的候选复验与精确恢复见下文；不能据此关闭完整新版总标准。

### 修复候选的实际发布入口复验

同一真实模型 App 以 `install -r` 临时更新原 UID，原 APK 先保存并核对摘要。安装前发现当前 Web 产物与原包有三个 chunk 名称及四个入口内容不同，update 报告保留失败，未安装。改用原 APK 的165项 Web 资源独立构建，逐文件名称和 SHA-256 完全一致后才安装候选；候选 SHA-256 `5f55e3af6d33fef71e5540d28710f11e46cdce8f79ae3641d22fc290ddf84c88`，新 PID24509。原页面、Key、配对和数据没有导出或清除。

首次资源提取因实际 `running-whale@2x` 文件名被验证器拒绝而未完成，失败报告保留；按原包实际名称允许 `@` 后，只补齐缺失文件、核验已有字节，不覆盖未知文件。部分资源构建虽退出0，也未安装；补齐全部资源后17秒完整 Android 构建及安装前摘要门槛通过。详见[原 APK 基线](../../artifacts/latest-child-notice-main-apk-baseline.json)、[资源严格恢复](../../artifacts/latest-child-notice-main-apk-assets-recovered.json)、[候选实际安装](../../artifacts/latest-child-notice-main-apk-update-recovered.json)与[包恢复驱动](../../scripts/prepare-latest-live-notice-apk.mjs)。

| 发布入口实际阶段 | 结果 |
| --- | --- |
| [后台送达](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-notice-fixed-android-start.json) | Host3960，同一次真实模型请求创建子 `32c99a81-a9c3-45b7-820b-9acda8a9886a`；父、子两个系统通知会话，原父草稿保持。 |
| [实际系统通知点击](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-notice-fixed-android-inspect.json) | 选中原子会话、显示原真实回复，仅消费子通知，父通知仍在；返回父会话才消费父通知，原父草稿保持。 |
| [历史重入](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-notice-fixed-android-audit.json)、[定向清理](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-notice-fixed-android-cleanup.json) | 父返回历史与完整子历史摘要/序号不变，无重发；仅清理本轮独立草稿，权限保持。四阶段同一 App 进程，页面错误0。 |

该实际发布链路已通过通知点击隔离，原失败报告保持。源码入口沿新 `child-notice` 排他租约作同范围实际复验，没有新增生产协议或扩大设备权限。

### 实际源码入口与恢复核对

固定13组/37文件源码兼容组合完整构建380.104秒通过，同一候选 App/PID24509、home 和绑定沿实际 `pnpm dsh web` 入口验证。

| 源码入口实际阶段 | 结果 |
| --- | --- |
| [后台送达](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-notice-fixed-android-start.json) | Host76896，真实子会话 `7cc8c4e1-b3b0-4185-b864-ccedaaeace26`；两个系统通知会话、原父草稿保持。 |
| [实际点击](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-notice-fixed-android-inspect.json) | 原子会话/真实回复正确，父提醒保留，返回父会话才消费父提醒；原草稿保持。 |
| [历史重入](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-notice-fixed-android-audit.json)、[定向清理](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-notice-fixed-android-cleanup.json) | 原父返回历史、完整子历史与原序号保持，无重发；只清理本轮独立草稿，权限保持，页面错误0。 |

[切换前全历史](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-notice-source-before.json)21会话/2725事件与[源码载入后](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-notice-source-after-review-audited.json)2726事件核验通过，只追加官方父空end-seed。[恢复前全历史](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-notice-source-before-restore.json)22会话/2788事件与[正常发布恢复后](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-notice-source-after-restore-audited.json)2789事件逐项核对通过，只追加一个同类空恢复标记；全部原事件前缀、投影及设备身份保持，management=false。正常发布Host11480恢复，不加载临时review候选。

[原 APK 恢复](../../artifacts/latest-child-notice-main-apk-restore.json)核验原SHA-256及165资源相同，安装用 `-r` 保留数据，新PID32632。[实际手机恢复核对](../../../plugin/artifacts/latest-runtime-check/latest-live-child-notice-main-restored.json)读取原父1279条完整记录，按固定throughSeq分页至seq0，不将滑动分页窗口缺失当历史丢失；原发布/源码两子各seq0–25摘要保持，原父草稿为空、workspace-write保持、无通知。

恢复核对的功能报告已落盘通过，但只读观察器未自行退出；核验精确命令行及报告后仅停止拥有的node18392，[独立清理记录](../../../plugin/artifacts/latest-runtime-check/latest-live-child-notice-observer-cleanup.json)明确 `normalObserverExit:false`。这不是正常退出证据，也没有结束 App 或 Host；不重发任何消息。

原源码字节恢复后的完整构建382.763秒退出0，[排他归档](../../../plugin/artifacts/latest-runtime-check/latest-live-source-lease-child-notice-final.json)核验原37文件/根启动配置及355资源逐项相同，资源摘要 `517da690aabff313743f2be09dd93e06b218bacf579bebb87ca330d50702f107`，Git干净且无活动租约。正常发布主候选保持，日常旧版/App Key未改。7项通知状态回归、Android候选构建与相关脚本语法通过；本轮局部通过不能代替全部通知类型、完整新旧交付组合或KKC-24七条总标准。

## 停止后输出保留修复与发布入口复验（2026-10-07）

下文“发布入口的实际子任务停止与未通过项”保留修复前的失败事实。本轮对[输出注册表](../../../plugin/src/command-output.ts)作窄范围修正：已结束且具有真实输出的调用，在子 Agent/Session 释放后可有界保留；每次返回字节前后，必须经新版原 `SessionQuery.observeSession` 核对完整原 header 与根工具事件。只规范原冷读默认的 `delegationDepth=0`，其余身份保持严格一致。旧版没有原观察能力时仍释放即失效。

保留范围仍为当前插件运行期间、结束后30分钟、最多128项；插件/身份服务卸载、代次变化、调用替换、过期及错地址均拒绝。未保留的运行中调用不复活；不重建 Agent、延长执行或修改原 `ABORTED` 结果。Host 重启后的独立输出不承诺跨进程保留，原会话历史仍保留。没有新增公网接口或读取 Key。

[原工具回归](../../../plugin/tests/latest-command-output.test.mjs)13项通过：真实 PowerShell 取消、原 JSONL 冷历史/SessionQuery读取、同编号替换、身份服务卸载/重新注册、运行中释放和过期拒绝；旧版完整插件套件41文件/218项、插件类型检查及恢复门槛7项通过。结构化 LLM 事件只用于独立格式夹具，不能据此声称模型推理；以下手机专项使用实际父子模型。

独立62文件[候选报告](../../../plugin/artifacts/latest-runtime-check/candidate-package-check-1xqe3A/report.json)通过归档、解包、严格Host/Client类型及原精确版本检查；SHA-256 `16835594509559deb424e7d747ee7c64dfdabcf2d4f82bb7323a30f30daba0aa`。仅用测试控制器的显式候选选项临时加载归档解包入口，不覆盖主六文件候选或日常manifest/APK。

| 实际发布入口阶段 | 核对结果 |
| --- | --- |
| [手机启动并立即停止](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-stop-readonly-retained-android-start.json) | Host70036；实际子会话 `d8796a33-bdd7-47b1-93ed-c9c4db66815e`，正文PID73256。看到中文/emoji及实际进程存活后点击停止。 |
| [停止输出重读](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-stop-readonly-retained-android-observe-output.json)、[历史重入重读](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-stop-readonly-retained-android-replay-output.json) | 进程退出，原唯一工具结果ABORTED、原轮aborted/user；“从头查看”读到停止前相同输出和PID，无END标记、无重试，原事件摘要逐条不变。 |
| [再次真实回复](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-stop-readonly-retained-android-resume-observe.json)、[权限/页面清理](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-stop-readonly-retained-android-cleanup.json) | 一次用户消息seq27/rpcId核验，真实回复、没有新增工具调用；原父权限恢复workspace-write，返回父聊天并保留空草稿。 |

候选切换前[15父子会话/2325事件](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-readonly-history-address-before.json)与[切换后核对](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-readonly-history-address-after-review-audited.json)通过；原控制器stdin丢失后仅终止核验过的专用测试树，[退出记录](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-readonly-history-address-forced-stop.json)明确不是正常清理。修复前审计对已清理工作区仍要求目录存在、将原冷子会话错误当根地址及要求恢复序号完全不增的失败报告均保留。原接口实际还列出子会话，审计必须使用原父目录地址；原DSH恢复仅允许追加一个空 `session/end-seed`，原事件前缀、全部投影与设备身份仍逐项不变。

复验后控制器正常停止，[恢复前16会话/2404事件](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-readonly-history-address-before-restore.json)与[恢复后核对](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-readonly-history-address-after-restore-audited.json)通过，只增加原父的空恢复标记。恢复Host70580沿原主候选启动，临时review入口不再加载；[原App核对](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-main-restored.json)确认原PID12296、原APK摘要、原父聊天、空草稿及权限保持，设备管理false。日常旧版、原Key与主安装文件未改。

### 实际源码入口与原构建恢复

同一归档候选随后沿完整13组/37文件兼容组合、实际 `pnpm dsh web` 入口复验；候选完整构建393.076秒成功。原主App、home、配对与父聊天保持，没有新增Key、APK安装或管理授权。

| 实际源码入口阶段 | 核对结果 |
| --- | --- |
| [手机启动并立即停止](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-stop-readonly-retained-android-start.json) | Host13760；原子会话 `65cab52d-4ffe-428d-86f7-5d6aa52b83b3`，正文PID42636。看见中文/emoji及实际进程存活后停止。 |
| [停止输出重读](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-stop-readonly-retained-android-observe-output.json)、[历史重入重读](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-stop-readonly-retained-android-replay-output.json) | 原唯一工具ABORTED、原轮aborted/user、进程退出；重新进入仍读到相同停止前输出，原事件摘要保持，没有END标记或命令重试。 |
| [单次新消息](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-stop-readonly-retained-android-resume.json)、[再次真实回复](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-stop-readonly-retained-android-resume-observe.json)、[权限/页面清理](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-stop-readonly-retained-android-cleanup.json) | 用户seq27/rpcId `e6752831-9f93-430e-b380-aea537f932af`；真实回复且没有新增工具调用，原停止记录保持，父workspace-write及空草稿恢复。 |

切换前[16会话/2405事件](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-source-retained-before.json)与[源码切换后核对](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-source-retained-after-review-audited.json)通过。源码控制器正常退出，随后[恢复前17会话/2483事件](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-source-retained-before-restore.json)与[恢复后核对](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-source-retained-after-restore-audited.json)通过：原完整事件前缀、全部投影和设备身份保持，仅追加原父空end-seed。正常发布Host3960恢复主候选，不加载临时review入口。

[源码租约归档](../../../plugin/artifacts/latest-runtime-check/latest-live-source-lease-child-retention-final.json)核验原37文件/启动字节、383.362秒完整原构建和355资源逐项精确恢复；原资源摘要 `517da690aabff313743f2be09dd93e06b218bacf579bebb87ca330d50702f107`，Git干净且无活动租约。[本轮原App核对](../../../plugin/artifacts/latest-runtime-check/latest-live-child-retention-source-retained-main-restored.json)确认PID12296、原APK摘要、原父聊天、workspace-write/空草稿及management=false。实际Windows「MuMu安卓设备」窗口再次置前，原DSHM聊天页面可见。日常旧版、原Key及主安装文件保持。

两种入口局部报告的 `fullAcceptancePassed:true` 只指此次停止/输出专项，不能代表KKC-24七条总标准或完整新版支持通过。其他子任务工具/通知、文件余项、SDK/Electron及最终交付仍待验。

## 范围与真实调用

沿用专用 home、16901 网关、同一父测试会话和独立 Android UID。手机通过 DSHM 自有聊天页发送一次请求，真实父模型调用标准 `subagent`，原 provider 创建 continuable 子 Agent、descriptor 和父目录；子模型回复并通过原 `send_message` 返回父会话。未注入会话事件、替代模型响应或写入目录投影。

手机从自己的子会话菜单进入原目录项，检查实际选中 ID、原 continuable 模式和可用输入框。随后直接向子会话发送一次无工具消息；原 `subagents/prompt` 保留请求编号和父子地址，原子历史只出现一次对应用户消息。电脑与手机使用同一记录。只读核对只允许本轮父目录已登记的子项，不开放任意路径或会话写入。

| 入口 | 创建及首次手机续聊的原身份 |
| --- | --- |
| RELEASE，Host45940 | 子 `8d2f3485-d720-47b5-b232-810ca1c36197`，标签后缀 `610ab550`；父调用 `call_00_ET_B5q6PqAlTtArYXx4GB960797`，call/catalog seq620/621。子初始 asOfSeq25，手机用户消息 seq31、rpcId `902126c4-fb80-484a-8c34-4e13330f46b9`，模型回复 seq34、asOfSeq36。[创建核对](../../../plugin/artifacts/latest-runtime-check/latest-live-child-model-android-observe-navigation.json)、[续聊](../../../plugin/artifacts/latest-runtime-check/latest-live-child-model-android-continue-observe.json)、[重入](../../../plugin/artifacts/latest-runtime-check/latest-live-child-model-android-replay.json)。 |
| SOURCE，Host37396，实际 `pnpm dsh web`，13项/31文件 | 子 `85092faf-d224-4b21-b83a-d5ab2856ff5c`，标签后缀 `65a0b67e`；父调用 `call_00_ET_ULtlGSjwBPx07sabO7m15672`，call/catalog seq663/664。子初始 asOfSeq25，手机用户消息 seq31、rpcId `87c20903-2ce0-455f-8900-32bc4ddd47d2`，模型回复 seq34、asOfSeq36。[创建核对](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-model-android-observe.json)、[续聊](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-model-android-continue-observe.json)、[重入](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-model-android-replay.json)。 |

各首次回复含独立随机 INITIAL 标记，续聊含同一子任务 CONTINUED 标记。重入逐字段比较原调用、用户 source/rpcId、回复、序号和结果，确认没有重发。测试只允许子模型的 `send_message`，没有文件、命令、联网或额外子任务；后续两次手机续聊均无工具。与此前无模型凭据的目录夹具验收区分，本轮不以夹具回复替代真实推理。

## Host 重启后历史与续聊

两种入口均在 App 保持子页时停止本轮拥有的控制器及 Host，核对正常退出，再以相同 home、端口、绑定及执行模式恢复。重启前完整子历史均为 seq0–36，共37条；保存每条完整原事件的 SHA-256，不落盘完整提示、reasoning 或凭据。重新读取逐项比较37条摘要和原序号，asOfSeq36不变、无新增记录。两种入口均观察到子页输入可用，原手机历史和真实回复仍显示。

原 `session/page` 和 `session/projections` 明确不激活 Agent，不能要求这种冷读取新增 `session/end-seed`。子 Agent 真正恢复执行时产生的原生命周期事件，与只读历史核对分开处理。

| 入口及实际重启 | 冷历史与再次手机续聊 |
| --- | --- |
| SOURCE：Host37396 → 30212 | [完整基线](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-model-android-cold-baseline.json)、[冷恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-model-android-cold-recovery.json)。手机一次新消息，原用户 seq43、rpcId `ac9256c5-612c-4712-b4cd-41a4f0a31679`，真实回复 seq46、asOfSeq48，含同一任务 COLD_CONTINUED 标记。[实际回复](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-model-android-cold-continue-observe.json)、[重入身份一致](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-model-android-cold-replay.json)、[清理](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-model-android-cold-cleanup.json)。 |
| RELEASE：Host25688 → 67004 | [完整基线](../../../plugin/artifacts/latest-runtime-check/latest-live-child-model-android-cold-baseline.json)、[冷恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-child-model-android-cold-observe.json)。手机一次新消息，原用户 seq43、rpcId `4c93d304-431b-4ecc-8419-6e669127dc9f`，真实回复 seq47、asOfSeq49，含同一任务 COLD_CONTINUED 标记。[实际回复](../../../plugin/artifacts/latest-runtime-check/latest-live-child-model-android-cold-continue-observe.json)、[重入身份一致](../../../plugin/artifacts/latest-runtime-check/latest-live-child-model-android-cold-replay.json)、[清理](../../../plugin/artifacts/latest-runtime-check/latest-live-child-model-android-cold-cleanup.json)。 |

再次发送前走原返回父会话及子目录入口，确认原身份、continuable 和输入可用；不自动重发此前消息。重入核对与首次冷续聊结果逐字段一致。两种入口最终回到专用父会话，workspace-write、空输入、无生成中状态，保留真实测试历史；没有临时设备管理授权、文件或新增产品补丁。当前 App 沿用已有 APK，无需为这些测试重装。

## 失败记录及测试修正

- 发布首次 [observe](../../../plugin/artifacts/latest-runtime-check/latest-live-child-model-android-observe.json)错误地要求固定父回复标记。子任务在父首次结算前完成，父模型合法地总结子结果；下一次 [observe-recover](../../../plugin/artifacts/latest-runtime-check/latest-live-child-model-android-observe-recover.json)又误把祖先父标题的 strong 当作子标题。修正为原调用/目录和实际选中 ID 后，用同一已创建子会话核对通过，没有重新创建或重发。
- 源码 [冷入口失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-model-cold-observe-entry-failed.json)来自同一标题定位；随后 [cold-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-model-android-cold-observe.json)错误地要求只读冷历史新增恢复记录。原37条哈希已一致，但该断言失败；根据原非激活接口修正，单独 cold-recovery 报告保留后续成功，没有覆盖失败报告。
- 发布 [冷基线入口失败](../../../plugin/artifacts/latest-runtime-check/latest-live-child-model-android-cold-baseline-entry-failed.json)发生在 Host 重连载入过程中。RemoteActivity 仍在实际前台，工作区暂未显示；测试器误去点击暂停的普通聊天页。修正为已确认 Remote 前台时等待其工作区，之后再取基线。未改变产品重连或界面行为。

上述是测试驱动的定位/契约问题，不能描述为产品缺陷修复，也不能删去失败记录。真实 App 页面错误数组均为空。13项/31文件源码租约仍 ready，最终原字节/355资源恢复尚未完成；KKC-24原未完成标准继续保留。

## unknown 地址的手机实际读取

原 SessionAddress 允许子地址的 mode 为 unknown；Host 必须仍核对原子 descriptor 和父身份。驱动从本轮原父目录核对实际子项，使用前台 App 已组装的原 SDK `remote.session.page`，经过真实 Android 原生连接、中转与 Host 读取完整历史。没有改目录模式或伪造未知子记录。将同一真实 continuable 子地址误报为 one-shot 时，原 Host 返回 `subagent/unauthorized`。两次只读请求后，原投影和完整历史逐字段不变。

- RELEASE Host67004：[实际未知地址读取](../../../plugin/artifacts/latest-runtime-check/latest-live-child-model-android-unknown-read-envelope.json)，原子 asOfSeq49，共50条，和电脑原非激活读取完全一致。
- SOURCE Host16396：[实际未知地址读取](../../../plugin/artifacts/latest-runtime-check/latest-live-source-child-model-android-unknown-read.json)，原子 asOfSeq48，共49条，和电脑原非激活读取完全一致；实际安装31文件身份核验通过。

发布第一次 [unknown-read](../../../plugin/artifacts/latest-runtime-check/latest-live-child-model-android-unknown-read.json)把原 SDK 的 `{ok,value}` 返回值误当作 page 对象，hasMore 断言失败；按原 SessionEventStream.readPage 的解包契约修正，在单独 unknown-read-envelope 报告通过。原失败不覆盖，也没有放宽 hasMore、原历史一致或错误类型拒绝的断言。

本节证明 unknown 地址的实际 Host 读取及类型校验，不代表损坏/缺失 descriptor、永久无法确认模式的目录、全部子任务工具/取消/通知、卸载在途或更广网络已经通过。当前正常源码 Host16396、不加载 Auto 诊断，原测试 App 保持前台，设备管理false。

## 子会话身份资料故障（2026-10-07）

固定 npm 发布入口通过独立 MuMu App 的六个实际页面分支：缺失、损坏及不支持版本的 descriptor，各自从主聊天和旁栏打开。目录持续保留原 `unknown` 模式，原身份投影为 null。手机显示“无法确认这个子会话的记录，请在电脑上检查。”，不再持续显示正在确认或空聊天欢迎页；不能发送或停止，返回父会话正常。原 SDK 直接提交读取被 Host 拒绝为 `subagent/catalog-diagnostic`，强行提交续聊也被原 Host 拒绝，全部原父子事件和投影逐字段保持。

故障数据由[隔离夹具](../../../backend/tests/support/latest-child-descriptor-fixture.mjs)经原 Sessions 服务创建：先用原 spawn provider 建立健康兄弟记录，故障项参考上游原 archive-admission 测试写入独立 Session，并在父目录登记 unknown。没有模型 Key；健康子项得到缺凭据结果，三种故障项是刻意构造的数据损坏，不能称为真实模型生成故障。健康兄弟历史仍可读取，不放宽原 Host 校验，不替换认证、传输或模型响应。

[真实 Android 驱动](../../../backend/tests/latest-child-descriptor-android.test.ts)沿生产网关/Store、原生配对与资源桥、原 SDK 及固定候选归档执行。[完整报告](../../../backend/.test-data/latest-child-descriptor-9hT1ew/report.json)24.224秒通过：安装 APK 与构建一致、165个实际页面资源匹配、撤销前零页面/控制台错误、撤销后原生重连拒绝、独立 Host/端口/测试 UID 清理完成。临时 App 为 `dev.dshmobile.validation.latestofficetest`，APK SHA-256 `1ba2c07a56878248b1a40c0605862b05bc033c32349377cc22f614d994e297c2`。

原 SDK 把未标记的流错误包装为 `gateway/internal`，message 仍为原错误码；手机仅将确切的目录诊断转换为用户文案，原 store 的错误保持。首次[驱动断言失败](../../../backend/.test-data/latest-child-descriptor-Vwlu4D/report.json)、[主聊天旧显示通过](../../../backend/.test-data/latest-child-descriptor-0BiErS/report.json)及[文案包装遗漏失败](../../../backend/.test-data/latest-child-descriptor-TMa8xM/report.json)均保留。111项相关单元回归、Web/Android构建与后端类型检查通过，不以这些替代上述原生六分支实测。

[主 App 恢复核对](../../../backend/.test-data/latest-child-descriptor-9hT1ew/main-restored.json)确认原 PID12296、APK摘要、实际 Remote 前台、16901连接和聊天授权保持，管理权限false；通过实际 Windows MuMu 设备窗口重新切至前台。修正只安装于独立故障测试 UID，主真实模型 App 与日常旧版未替换。该发布轮当时未准备源码租约，源码入口由下段追加；子任务工具、取消、通知和卸载在途等完整标准继续，KKC-24仍未完成。

同一六分支驱动随后在实际源码 `pnpm dsh web` 入口52.610秒通过：[源码完整报告](../../../backend/.test-data/latest-child-descriptor-EVFq2R/report.json)。13组/37文件完整候选构建386.831秒成功，测试前后实际已安装源码及355候选客户端资源摘要保持；相同原生 APK/165资源、原父子记录、Host拒绝、健康兄弟、撤销重连拒绝与临时Host/端口/UID清理均通过，撤销前零页面和控制台错误。[源码轮主 App 核对](../../../backend/.test-data/latest-child-descriptor-EVFq2R/main-restored.json)另确认原会话ID、空草稿、open状态与非生成中，原PID/摘要/16901连接及聊天授权management=false保持。只读核对进程的Playwright遗留句柄在记录落盘后明确停止（拥有的node61884），不修改主App。

源码租约 `child-descriptor` 已[精确恢复并归档](../../../plugin/artifacts/latest-runtime-check/latest-live-source-lease-child-descriptor-final.json)：原37文件/启动字节、原完整构建373.178秒、355原资源摘要 `517da690aabff313743f2be09dd93e06b218bacf579bebb87ca330d50702f107` 逐项保持，Git干净且无活动租约。[最新只读补丁审计](../../../plugin/artifacts/latest-runtime-check/patch-inventory-CSdLnq/report.json)确认18旧目标、13组/37文件映射保持，`fullAcceptancePassed:false`。未新增子会话生产源码补丁，七条完整标准保持未完成。

## 服务卸载在途与重新读取（2026-10-07）

固定 npm 发布入口56.195秒、实际源码 `pnpm dsh web` 入口74.567秒，均通过独立 MuMu App 的四个分支：主聊天/旁栏各自覆盖原历史读取及续聊提交在途时停用原 SubagentRuntime。通过原插件管理器按依赖顺序停用 provider 和 runtime，原 Cordis Host 服务确实卸载；恢复时同样通过原管理器。[夹具](../../../backend/tests/support/latest-child-unload-fixture.mjs)只延迟原 follow/prompt 调用，释放后仍执行原方法，不制造成功响应、历史或模型结果。隔离 home 没有模型 Key，不证明推理、工具取消或已有执行任务自动停止。

实际发现并修复两项缺口：Client 的 `remote.subagents` namespace 在 Host 服务卸载后仍存在，不能作为发送资格；旁栏缓存的读取失败 Session 需要显式重新读取。插件新增只读 Host 生命周期流 `remote.subagentStateFollow`，手机按连接代次订阅并禁用不可用子会话的发送/停止，旧订阅迟到不能恢复新连接资格。共享主聊天和旁栏提供“重试读取”，沿原 `ClientSessions.retain` / `Session.open` 重读，不改原 store 或创建替代记录。服务恢复不会自动重发草稿。

四个分支均结束等待/发送状态、禁用发送、保留拒绝的草稿；恢复后通过原导航或重试按钮重读同一原子历史。完整原父子事件、header、继承数据及投影逐字段不变，父草稿为空，零 iframe。撤销前页面/控制台错误为空，撤销后原生重连拒绝，拥有的 Host/端口/测试 UID 清理通过。

- [发布报告](../../../backend/.test-data/latest-child-unload-99RNvd/report.json)、[源码报告](../../../backend/.test-data/latest-child-unload-qUWbU2/report.json)、[实际 Android 驱动](../../../backend/tests/latest-child-unload-android.test.ts)。
- 新[独立候选归档](../../../plugin/artifacts/latest-runtime-check/candidate-package-check-M1dGpM/report.json)：62文件，SHA-256 `57bb0f617a92a8d69ef130901f475de134af0987237d12999d950f26e4a80476`，保留原运行候选。
- 独立故障 App `dev.dshmobile.validation.latestofficetest` 的 APK SHA-256 `531cb8d732e6617337cfb07de9e002d6d4eec2b03be2ea153847152d1dfd8962`，165个实际资源与构建一致；108项手机相关回归、47项插件 Host/适配测试、3项生产中转权限/流容量测试和类型/Web/Android构建通过。
- [主 App 核对](../../../backend/.test-data/latest-child-unload-qUWbU2/main-restored.json)：原 PID12296、APK摘要、会话ID、空草稿、open/非生成中、16901连接、聊天授权与 management=false保持，实际 MuMu 设备窗口前台显示主会话。报告写入后停止拥有的观察器node64400；此前直接退出观察器触发Windows libuv清理断言，不是App失败。

原 Client namespace 方案在实际手机被证伪，失败记录保持。[旁栏恢复失败](../../../backend/.test-data/latest-child-unload-Q4Tbia/report.json)据此补充共享重试入口。[父基线时序失败](../../../backend/.test-data/latest-child-unload-bPfPfz/report.json)发生在四个页面分支已通过后：采集早于原 `subagent-settled` 通知与父轮结算。夹具改为等待这些真实事件再保存基线，保留完整逐字段比较，没有忽略新增事件或放宽断言。

完整13组/37文件源码候选构建390.286秒通过；本轮 `child-unload` 原恢复构建389.697秒成功，37原文件/启动字节与355原资源精确保持、Git干净且无活动租约，已[排他归档](../../../plugin/artifacts/latest-runtime-check/latest-live-source-lease-child-unload-final.json)。原资源摘要 `517da690aabff313743f2be09dd93e06b218bacf579bebb87ca330d50702f107`。未新增子会话上游生产补丁。七条完整标准仍未完成，日常旧 DSH/App 和主真实模型 App 未替换。

## 发布入口的实际子任务停止与未通过项（2026-10-07）

固定发布 Host14292、主实际模型 App PID12296及原父会话保持。通过手机自有页面，由真实父模型创建只读 continuable 子会话 `1e37b7ce-6963-4cc2-bfda-989a1c367ff4`；真实子模型仅执行一次有界 pwsh，打印中文、emoji与实际 PID，再等待90秒。手机在命令详情读取到实际输出并核对 PID65900存活后立即点击“停止生成”，没有读写项目文件、联网、审批提权或补发命令。

- [开始与手机停止](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-stop-readonly-scoped-android-start.json)：真实过程输出、原调用身份、实际进程及手机停止已核对。
- [停止事实](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-stop-readonly-scoped-android-observe-status.json)与[历史重入](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-stop-readonly-scoped-android-replay-status.json)：实际 PID退出，原唯一 pwsh结果为 `ABORTED`，原轮结束原因是 `aborted/user`；重入逐条原事件摘要不变，没有重试。报告明确 `partialOutputRetained:false`、`fullAcceptancePassed:false`，只证明停止事实，不能计为完整输出保留通过。
- [再次真实回复](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-stop-readonly-scoped-android-resume-observe.json)：手机只发送一次新无工具消息，原 user seq27及rpcId核验，模型实际回复，原停止事件摘要不变，没有新工具调用。
- [清理](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-stop-readonly-scoped-android-cleanup.json)：父权限由临时只读恢复工作区内修改，主页面返回原父会话、空草稿，实际进程仍已退出；保留专用测试历史和聊天授权，管理权限false。实际 MuMu设备窗口已切至前台显示 DSHM，不是模拟器管理器。

**未通过项：停止前独立输出重读。** [实际输出报告](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-stop-readonly-scoped-android-observe-output.json)失败；手机命令详情的“从头查看”显示“电脑已不再提供这条命令的实时输出，可查看执行结果。”。原 `tool/result` 只有 `Error: tool call aborted`，不能从模型总结或工具结果伪造已读输出。[插件注册表](../../../plugin/src/command-output.ts)在 Agent/session disposed 时删除输出，且读取要求同一存活 Agent；[原子任务结算](../../../plugin/artifacts/latest-source-check/packages/subagent/subagent/src/continuation-activation.ts)会释放实际 handle。需为已结算子会话设计有界输出保留和原持久身份核验，再以独立候选完成实际手机及源码入口复验；本轮没有修改生产输出注册表、安装新候选或更新主 APK。

原[首次 observe 失败](../../../plugin/artifacts/latest-runtime-check/latest-live-release-child-stop-readonly-scoped-android-observe.json)错误地期待 ABORTED 工具结果包含 stdout，已保留。前两轮也保留：首次原工作区写沙箱在正文执行前被 Windows `SetNamedSecurityInfoW` Win32 5拒绝，不能把沙箱 wrapper PID当作命令正文运行证据；第二轮只读命令自然完成，因为验证器等待仅在结算后出现的“用时”按钮并错误定位详情按钮。后续按原聊天 node/call ID定位所属节点、处理真实折叠状态，在实际输出/进程核验后同一阶段停止。验证器修正与原“工具详情”弹窗清理仅影响验收入口，不放宽生产身份或历史相等断言。源码实际停止及其他子任务工具/通知仍待验，KKC-24保持未完成。
