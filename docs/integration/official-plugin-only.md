# 官方 DSH 纯插件的 Android 验收

当前固定官方`0.2.1-alpha.2`＋独立插件`0.1.80-latest.0`＋现有APK的本地兼容验收完成；主要入口、真实归档安装、原始证据与限制从[当前支持清单](../../../plugin/compatibility/latest-upstream/official-support.md)进入。下方历史报告保留当时版本和范围，不推定所有组合均通过。

- 状态：核心链路/官方重启复验、审批/提问/计划及普通write等待时断线/相反答复竞争、队列/停止/导航、完成通知与App进程恢复、命令/后台输出、文件/Office、普通局部插件和部分管理真实通过；其他扩展继续按[功能矩阵](../../../plugin/compatibility/latest-upstream/official-feature-matrix.md)检查。
- 维护角色：DSHM 手机端维护者；核验日期：2026-10-09。
- 边界：[当前决定](../../../docs/project-knowledge/knowledge/decisions/2026-10-09-official-dsh-plugin-only.md)、[插件接口与原文件审查](../../../plugin/compatibility/latest-upstream/official-plugin-only.md)。旧补丁结果不计本轮通过。

本页下方历史报告固定验证官方 `0.2.1-alpha.1`。2026-10-09 官方预发布 `0.2.1-alpha.2` 的正常插件加载与真实Android核心链路已通过，具体版本、手机渲染修复、原始失败及新报告见[新版复验入口](../../../plugin/compatibility/latest-upstream/official-alpha2.md)。不把本页alpha.1的扩展结论沿用为alpha.2通过；原环境、报告及审计基线保留。

新版独立SDK与只读源码配套；精确版本限制仍保留，只允许已审阅alpha.1/alpha.2。主题新字段与聊天节点新Hook已在DSHM组合补齐，479项手机回归、自有Web/Android构建与lint通过；真实手机核心报告为 `7e20012a-4519-464c-bb8b-ec9f6a9ba395`，零页面及隔离渲染异常、实际允许/拒绝文件结果和清理完成。Session迁移、Job等扩展继续单独检查，不修改或构建DSH。

## 已通过的核心范围

当前候选的同APK核心与“外部任务 → 查看任务结果”整轮已通过。真实官方ACP最终正文、无效的本地子会话/旁栏入口拒绝、允许/拒绝write审批、重连/新建/撤销均有实际手机和官方记录互证；没有重新构建或安装产品。此前余额不足失败保留，当前成功恢复核对为85个专项/1171阶段，各APK原有范围不批量扩大。证据与环境恢复见[充值后复验](../../../plugin/compatibility/latest-upstream/official-alpha2.md#充值后的同apk核心与外部任务整轮复验2026-10-10)。 文件与聊天的双引用入口、实际读取和结构化草稿重连已验。

官方 `@deepseek-ai/dsh@0.2.1-alpha.1` 经正常 `pnpm dsh web` 启动，DSHM `0.1.76-latest.0` 插件由官方安装器加载。生产网关/Store/DPoP/票据/WebSocket真实使用；数据库是隔离的 PGlite，端口16956只用于本机验收。没有公网部署性能验收，也未测试官方 Electron 安装包。

[核心报告](../../../backend/artifacts/official-plugin-only/official-android-6f959259-9902-4a13-9ac8-a427a7a21db8.json)与[Android报告](../../artifacts/official-plugin-only/6f959259-9902-4a13-9ac8-a427a7a21db8/android.json)记录：

| 手机实际入口 | 核对结果 |
| --- | --- |
| 原生配对、等待批准、进入 Remote | 未批准票据403、配对不能重领；批准后 DSHM 自有页面读取真实工作区/历史，零 iframe。 |
| 聊天输入框选模与发送 | 手机选择 DeepSeek-V4-Pro，同一官方会话投影同步；唯一用户消息及模型 source/完成事件匹配，真实回复在手机显示。 |
| 进行中会话的写入审批和工具详情 | 显示即将修改的正文；审批前核对调用路径和文件未变。允许一次后真实 write 成功，官方 callId/result一致；拒绝另一调用后文件保持、不重试。 |
| 断线/恢复 | 停用/启用插件中转后，原聊天与未提交草稿保持，旧消息不补发。 |
| 已有工作区新建聊天 | 手机创建新会话，官方 session/list 的 cwd 为同一隔离工作区。 |
| 撤销设备后重新连接 | 原生连接拒绝，测试设备撤销，网关关闭、独立 UID 停止。 |

## 手机构建与环境保护

旧核心报告复用 `.latestfinaltest` 已有 APK，没有覆盖原 `.latesttest`。本轮产品菜单变更只构建 DSHM Web/Android；新 `.officialtest` 使用[Gradle隔离项](../../android/app/build.gradle.kts)、独立 `artifacts/official-mobile-dist`/`official-android-build`，不修改日常产物。新 SDK 依赖从 npm 正常安装到独立 `official-mobile-runtime`，只安装14个手机依赖，不构建 DSH/SDK，也不借用历史改造运行时的客户端二进制。借用源码的手机显示适配仍属于 DSHM 页面构建，不写回上游源码。

[构建入口](../../scripts/build-web.mjs)：`node scripts/build-web.mjs --latest-candidate --official-candidate`。Android 构建参数：`:app:assembleDebug :app:lintDebug -PlatestCompatibilityTest=true -PofficialPluginOnlyTest=true`。[安装检查](../../scripts/install-official-android.mjs)核对固定新 UID、实际 APK 摘要和原凭据 App 的安装路径/摘要/PID前后一致；不得用它覆盖原 App。

上述菜单门控候选 APK 12,580,553字节，SHA-256 `29f96c85accea96625a874ba1e9579d961ba6df92b19bf74b349d7c2d932cff6`；构建和 lint 用时1分47秒。后续保存窗口修复候选见[下节](#系统保存窗口取消断线与显式重试)。原生构建的既有 Insets 弃用警告和参考 package.json 重复键警告保留，没有改 DSH 来消除警告。

[新候选完整报告](../../../backend/artifacts/official-plugin-only/official-android-3e40a4c6-4b6e-4b54-916e-8cd0c0f17f8b.json)与[实际新 UID 页面](../../artifacts/official-plugin-only/3e40a4c6-4b6e-4b54-916e-8cd0c0f17f8b/android.json)40.791秒通过全部十阶段：菜单隐藏核对＋此前九阶段核心验证。两次审批的官方结果、文件和权限恢复通过，零页面异常；cleanupCompleted 为 true，原 App PID23468/安装路径/摘要保持。新包名首次未加入 WebView 工具白名单导致失败，记录保留；只显式添加该固定 UID，五项精确 PID/包名守卫通过，没有放宽为任意 App。

官方重启记录为[独立重启回执](../../../plugin/artifacts/official-dsh-plugin-only/official-restart.json)：核实16955监听确由拥有的官方测试路径/CLI提供后，终止旧Host3696；旧外部启动进程退出1，明确属于受控终止，不能写成正常退出0。随后复用同一 home/依赖/插件正常 `pnpm dsh web` 启动，登录303、插件200且原配置保持；新手机完整复验使用这一重启后的官方环境，没有重新安装或构建 DSH。

## 提问与普通输出的扩展验证

[提问/命令报告](../../../backend/artifacts/official-plugin-only/official-android-b01b7816-c618-4308-a8f0-57e1c6aa3416.json)28.429秒通过：模型实际调用 `ask_user_question`，手机选中绿色并提交，官方工具结果的答案一致、活动提问清空；模型回复匹配。只读 pwsh 的 `Write-Output/Write-Error` 结果在手机命令详情的输出正文显示，两种标记与官方 `ToolResultMessage`核对；不将包含同样标记的“完整命令”文字冒充输出。

[后台报告](../../../backend/artifacts/official-plugin-only/official-android-86ffb478-eba7-4627-8e4e-7efbc2ce11eb.json)67.057秒通过：[真实 Android](../../artifacts/official-plugin-only/86ffb478-eba7-4627-8e4e-7efbc2ce11eb/android.json)读取45秒只读后台任务，运行中标准/错误输出分别显示、通道不混入；任务完成后关闭重开窗口，从官方 `JobRegistry.readAt`重新取得完整输出。手机 reader 的原始缓冲与另一个真实中转客户端逐字相同，页面显示另外核对；不把页面规范化换行/ANSI样式等同原始字节。官方 `job/kill`收尾回执和已观察 completed状态分别记录，不以停止请求回执冒充进程已结束。

两项专项各有十阶段、零页面异常、撤销授权/关闭网关/停止独立UID/移除映射及原App身份保持；`cleanupCompleted=true`。均复用同一官方Host/依赖和同一新APK，不构建/修改DSH、插件或手机。实现见[提问/命令驱动](../../tests/support/official-question-command.mjs)与[后台驱动](../../tests/support/official-background-output.mjs)。

失败证据保留：[最初命令](../../../backend/artifacts/official-plugin-only/official-android-b0ab3d92-b9f8-4aed-a958-519d48fa4f42.json)因只读 PowerShell ConstrainedLanguage禁止 `.NET [Console]` 调用，stderr标记未产生；官方本地化错误文字另存在编码乱码，本轮未修本体。改用内置 `Write-Error`后只验证ASCII输出，不宣称中文/emoji编码已修复。[后台首轮](../../../backend/artifacts/official-plugin-only/official-android-f1b0bcf8-283e-4013-86f8-a3c5f8b2563b.json)已读到真实双流，但测试把 Windows CRLF与页面换行直接比较误判；修正为原始接收缓冲比较后完整通过，两轮清理均完成。

## 默认提问等待时App结束与恢复

[真实整轮报告](../../../backend/artifacts/official-plugin-only/official-android-827da658-3fbd-4ac2-be5c-be600586d3c7.json)54.162秒通过，[独立Android](../../artifacts/official-plugin-only/827da658-3fbd-4ac2-be5c-be600586d3c7/android.json)十阶段、零页面异常；`questionProcessVerified/passed/cleanupCompleted=true`。复用正常官方 `pnpm dsh web` Host56216、原生产网关实现及已有测试APK `28d47c94…`，没有产品构建、安装或本体修改。

本节使用官方默认 `legacy` 阻塞式 `ask_user_question`。已核对实际官方安装包的[事件类型](../../../plugin/artifacts/official-dsh-plugin-only/node_modules/@deepseek-ai/dsh-user-questions/lib/types/types.d.ts)、[工具实现](../../../plugin/artifacts/official-dsh-plugin-only/node_modules/@deepseek-ai/dsh-tool-ask-user/lib/index.js)与[客户端答复实现](../../../plugin/artifacts/official-dsh-plugin-only/node_modules/@deepseek-ai/dsh-client-ui-user-questions/lib/client.js)：该模式通过 `user-questions/request` waterfall答复，不含`wait.callId`，不进入timed活动投影。测试以原唯一工具调用、问题id/正文/选项及eventId关联，不能把空投影误当问题已完成，也不能借用write的字符串审批答案。

| 真实情况 | 核对结果 |
| --- | --- |
| 手机留下草稿，电脑公开入口发起提问；结束手机App，问题仍待回答 | PID31800实际结束；正常Launcher/抽屉Remote以PID32170恢复同一会话。原eventId/callId保持，新事件clientId不同；43条完整原记录逐项一致、零答复结果。手机选绿色并提交，只有一条工具结果seq43，模型真实回复，最终50条记录保持原前缀与草稿。 |
| 另一真实批准连接在手机结束后回答 | PID32170结束，另一连接经生产中转提交蓝色；在手机进程不存在时，官方唯一结果seq58、模型真实回复及completed结算已落盘。正常Launcher以PID32519恢复65条历史和原草稿，旧提问卡片不存在；没有补发原消息或答案。 |
| 结算后再次提交相反的旧答案 | 两种情况均收到官方成功幂等空操作回执，完整官方记录没有变化；不把这种回执描述为执行新答案或拒绝。 |

[问题专项证据](../../artifacts/official-plugin-only/827da658-3fbd-4ac2-be5c-be600586d3c7/question-process.json)保留实际问题、前缀摘要、PID、事件归属和唯一结果；[恢复后待回答截图](../../artifacts/official-plugin-only/827da658-3fbd-4ac2-be5c-be600586d3c7/question-process-pending-restored.png)与[已经结算截图](../../artifacts/official-plugin-only/827da658-3fbd-4ac2-be5c-be600586d3c7/question-process-settled-settled.png)均已实际查看。手机未发送草稿始终保留，原始手机Key/配对/历史不读写。

[首次环境守卫失败](../../../backend/artifacts/official-plugin-only/official-android-4ff65092-b3b8-4cbc-b580-8155b7b745fc.json)7.247秒：真实电脑回复已完成，但进入手机前发现原App已无进程，因此在操作测试App前停止；清理完成。随后只从正常Launcher打开原App，建立PID31568基线，实际成功轮前后PID/安装路径/SHA完全相同。不能声称从上一轮PID5147到本轮始终未重启；旧失败保留。完成后原App已从普通抽屉恢复自身Remote，测试UID停止、16956/16957及测试映射关闭，原16901/8000/8001映射与两个原服务保持，见[最终恢复核对](../../artifacts/official-plugin-only/question-process-final-restoration.json)。290官方包/6263文件摘要保持。

[手机驱动](../../tests/support/official-question-process.mjs)与[后端事实核对](../../../backend/tests/official-host.test.ts)使用互斥开关 `DSHM_OFFICIAL_QUESTION_PROCESS_CHECK=1`，同时启用Android/真实模型/App检查。本节仅覆盖默认阻塞提问、独立UID force-stop及正常Launcher恢复；计划审批的独立证据见下节，有限超时与补答见[独立专项](#带超时提问的app恢复与补答)；提问中的Host结束另见[独立专项](#默认提问与计划中的电脑退出与恢复)，[默认提问答复发送断线](#默认提问与计划答复发送断线及确认丢失)另有实际证据；其他类型答复发送在途异常及其他系统回收策略仍待验。另一答复端是实际已批准协议连接，不冒充电脑页面点击或第二台实体手机。

## 计划审批等待时App结束与恢复

[真实整轮](../../../backend/artifacts/official-plugin-only/official-android-4a92861a-c797-4e96-9073-de6147bce7cd.json)113.050秒通过；[Android报告](../../artifacts/official-plugin-only/4a92861a-c797-4e96-9073-de6147bce7cd/android.json)十二阶段、零页面异常，`planProcessVerified/passed/cleanupCompleted/testPlanModeRestored=true`，零清理失败。复用官方 `0.2.1-alpha.1` 正常 `pnpm dsh web`、生产鉴权/中转与已有 `.officialtest` APK；只新增验收代码，没有修改或构建DSH、SDK、插件、App或生产网关。

官方[计划工具](../../../plugin/artifacts/latest-source-check/packages/plan/plan-mode/src/index.ts)通过 `user-questions/request` 发出 `plan-review` 问题：`intent.kind=plan-review`、原工具callId、原计划detail及 `Approve/Keep planning` 选项。手机“同意执行”回传原Approve答案；“要求修改”按官方[计划面板](../../../plugin/artifacts/latest-source-check/packages/client/ui-user-questions/src/client/PlanReviewPanel.tsx)的dismiss路径回传 `UserQuestionError/ASK_CANCELLED`，电脑保持计划模式并等待用户沟通。不能把要求修改伪造为批准或Keep planning。

| 实际情况 | 官方记录与手机核对 |
| --- | --- |
| 等待批准时结束App，正常打开后手机批准 | PID4480结束、PID5120从普通Launcher/抽屉恢复；原计划正文实际显示，原eventId/callId不变、clientId更新，51条原记录完整保持且无结果。点击“同意执行”后唯一结果seq51，真实回复/完成后共61条记录，计划模式关闭。 |
| 等待决定时结束App，正常打开后手机要求修改 | PID5120结束、PID5642正常恢复；同一计划与77条原记录保持。点击“要求修改”后唯一原工具错误结果seq77，模型真实回复，最终84条记录；电脑仍处于计划模式，收尾由手机正常关闭模式。 |
| App结束期间另一真实连接批准 | PID5642结束，原事件由另一已批准连接通过生产中转答复；App进程仍不存在时唯一结果seq101、模型真实完成已落盘。PID6429正常恢复111条历史与草稿，旧计划审批卡片不再出现，模式已关闭。 |
| App结束期间另一真实连接要求修改 | PID6429结束，同一公开协议回传ASK_CANCELLED；App未运行时唯一结果seq127及模型完成已落盘。PID6920恢复134条历史，旧审批卡片清除，草稿保持；计划模式仍开启，手机收尾关闭。 |

[逐项记录](../../artifacts/official-plugin-only/4a92861a-c797-4e96-9073-de6147bce7cd/plan-process.json)保留实际PID、请求归属、完整前缀SHA及唯一消息/工具调用/工具结果。四种情况结算后再发送相反旧决定，官方返回成功幂等空操作，完整历史逐项不变；这不是同时点击竞争验收。待决定两种情况关闭测试读者后才结束App，恢复后以新读者确认原eventId，避免由测试连接维持待审批假象。另一决定端是实际独立clientId的协议连接，不冒充电脑页面或第二台实体手机。

[恢复计划正文](../../artifacts/official-plugin-only/4a92861a-c797-4e96-9073-de6147bce7cd/plan-process-pending-approve-restored-document.png)和[另一端要求修改后的手机结果](../../artifacts/official-plugin-only/4a92861a-c797-4e96-9073-de6147bce7cd/plan-process-settled-modify-settled.png)已实际查看。手机未发送草稿保持，四轮都只审阅计划并回复标记，不执行计划文件修改；整轮另包含真实手机选模/发送、重连、已有工作区新建和撤销拒绝。

本轮开始16955与原日常16901服务均无监听，MuMu已有实例运行；只恢复同一官方隔离home的正常CLI，没有以旧回执PID当作存活证明。原App从普通Launcher启动，成功轮前后PID4249/安装路径/APK摘要一致；没有读取Key、替换绑定或清理原数据。完成后原App普通首页实际回到前台，自己的UID停止、下载暂存为空、保存记录不存在、测试授权撤销，16956/16957及测试映射关闭，官方16955保留。原日常16901仍为开始时的停止状态，未启动历史改造Host；详见[收尾记录](../../artifacts/official-plugin-only/plan-process-final-restoration.json)。290官方包/6263文件摘要仍与首次基线一致。

[手机驱动](../../tests/support/official-plan-process.mjs)和[后端核对](../../../backend/tests/official-host.test.ts)使用互斥开关 `DSHM_OFFICIAL_PLAN_PROCESS_CHECK=1`，同时需Android、真实模型与独立App检查。474项手机Node回归、后端TypeScript及两份驱动语法检查通过。本节仅证明计划等待期间独立UID force-stop、正常Launcher恢复及另一连接结算后的同步；计划中的Host结束另见[独立专项](#默认提问与计划中的电脑退出与恢复)；[同时相反决定竞争](#默认提问计划与超时补答的同时竞争)已有独立证据；[计划批准发送断线](#默认提问与计划答复发送断线及确认丢失)另有实际证据；要求修改发送在途、实际文件执行与其他系统回收策略仍待验。有限超时提问的独立通过范围见[下节](#带超时提问的app恢复与补答)。

## 带超时提问的App恢复与补答

状态：正常官方0.2.1-alpha.1、生产网关与已有真实Android通过；维护角色DSHM协作Agent，核验2026-10-09。[整轮报告](../../../backend/artifacts/official-plugin-only/official-android-36cc0fd6-ee9e-4212-a1e4-c0b32c9b6a67.json)测试70.12秒，[手机报告](../../artifacts/official-plugin-only/36cc0fd6-ee9e-4212-a1e4-c0b32c9b6a67/android.json)十阶段、零页面异常，timedQuestionVerified/passed/cleanupCompleted均为true。真实回复、选模、重连、已有工作区新建与撤销同轮通过。

官方[工具说明](../../../plugin/artifacts/latest-source-check/packages/interaction/tool-ask-user/README.zh.md)要求在模式子插件配置中声明mode: timed，默认模式仍为legacy。验收通过正常pluginManager/installBundle临时添加独立声明式模式，仅新测试会话使用；标准模式完整文档和原四项模式/默认值保持。结束后正常removeBundle移除测试包/模式，再次核对原文档/目录完全相同。不改写官方源码、安装文件或原配置，不使用启动注入。

| 实际情况 | 原记录与手机核对 |
| --- | --- |
| 120秒等待期间结束App，重开后回答 | PID15727结束、PID16251从普通Launcher/抽屉恢复；原callId/eventId、更新clientId，43条原记录完整保持且无结果。手机选绿色提交，唯一答案工具结果seq43，最终50条记录、零迟到补答。 |
| App结束期间12秒等待到期，重开后补答 | PID16251结束，PID仍不存在时唯一pending结果seq58与模型完成落盘；58条原前缀保持，65条记录中问题为continued且零补答。PID16866恢复，[显示“已继续工作，仍可回答”](../../artifacts/official-plugin-only/36cc0fd6-ee9e-4212-a1e4-c0b32c9b6a67/timed-question-expired-restored.png)。手机选蓝色提交，唯一user-question-reply消息seq69引用原callId、完整原问题/答案，真实模型回复；最终74条记录，原pending结果仍只有一条，活动问题清除。 |

[逐项证据](../../artifacts/official-plugin-only/36cc0fd6-ee9e-4212-a1e4-c0b32c9b6a67/timed-question.json)核对实际schema含timeout、模型参数、完整记录前缀SHA及调用/结果/补答唯一。[补答后画面](../../artifacts/official-plugin-only/36cc0fd6-ee9e-4212-a1e4-c0b32c9b6a67/timed-question-expired-answered.png)已查看，原草稿保持。pending不含answers，官方说明明确不代表授权；未执行依赖答案的文件或命令。观察读者读取原waterfall后立即关闭，不调用attachWait，不替手机维持计时。

首次实际测试发现DSHM白名单拒绝官方计时流，工具返回remote_operation_denied，无问题卡片；[失败报告](../../../backend/artifacts/official-plugin-only/official-android-be5f98af-ca4e-4085-b2a8-625e65d9eec7.json)保留且清理成功。依据安装包的[生成契约](../../../plugin/artifacts/official-dsh-plugin-only/node_modules/@deepseek-ai/dsh-user-questions/lib/typert.host.js)，[共享策略](../../../backend/packages/protocol/src/remote-policy.ts)仅为新版放行userQuestions/attachWait流与userQuestions/answer调用，严格限制agentId/callId/结构化answer；原Host继续核对live root与原问题。旧Host不协商新接口，ask/askTimed不开放，未知字段、重复答案id、字符串审批答案及损坏批次拒绝；网关与插件共用策略。

仅构建变化的DSHM协议/独立插件候选candidate-package-check-OfficialTimed01/package，版本0.1.76-latest.0；经官方安装器安装并正常重启，已有App `28d47c94…`复用，未构建或安装App/DSH/SDK。[第二轮失败](../../../backend/artifacts/official-plugin-only/official-android-489b9751-d21f-4572-8eee-bd17071d2f65.json)发生在手机步骤前：官方缓存同名link包，换目录需重启，清理也报该错误，不计正常收尾通过。[独立恢复](../../../backend/artifacts/official-plugin-only/timed-fixture-failure-restoration.json)核对正常重启后旧测试包/模式消失、标准模式保持；测试改用每轮唯一包名后，实际安装/移除均正常通过。

[后端检查](../../../backend/tests/support/official-timed-question.ts)、[手机驱动](../../tests/support/official-timed-question.mjs)使用互斥DSHM_OFFICIAL_TIMED_QUESTION_CHECK=1，并启用Android/真实模型/独立App检查。权限回归修复前失败、修复后通过；真实HTTP/票据/SQL/WS核对路由、计时流取消及非法参数拒绝。后端103项通过/11项opt-in跳过，插件220项通过；插件首轮并发运行一项5秒超时，单项9项和限制并发后的完整220项通过，未放宽超时或改业务实现。

[收尾脚本](../../scripts/check-official-timed-restoration.mjs)与[实际记录](../../artifacts/official-plugin-only/timed-question-final-restoration.json)核对原App PID4249、安装路径/摘要保持，普通首页回到前台；自己的UID停止、暂存为空、保存记录不存在，测试映射/授权清理。原Key/绑定/历史不读写；16955正常官方Host保留，原日常16901仍为开始时停止状态，16956/16957无监听。290官方包/6263文件摘要保持。

仅覆盖有限超时、独立UID force-stop、正常Launcher恢复与手机补答。带超时提问中的Host退出另见[下节](#带超时提问中的电脑退出与恢复)实际专项；[其他连接补答竞争](#默认提问计划与超时补答的同时竞争)已有独立证据；无限等待、前台暂停/慢慢回答、答复在途及其他系统回收策略仍待验，不推导全部生命周期通过。

## 带超时提问中的电脑退出与恢复

状态：官方0.2.1-alpha.1正常pnpm、生产中转和真实Android通过；维护角色DSHM协作Agent，核验2026-10-09。[完整报告](../../../backend/artifacts/official-plugin-only/official-android-c4c2b383-61a0-4308-9be0-5d486a905935.json)测试61.498秒、命令总计63.15秒；[手机报告](../../artifacts/official-plugin-only/c4c2b383-61a0-4308-9be0-5d486a905935/android.json)十阶段、零页面异常，timedHostVerified/passed/cleanupCompleted均为true。仅新增测试和异常收尾检查，没有构建/安装DSH、SDK、插件或App。

本专项使用上一节的正常声明式timed模式，模型真实调用一次timeout=120的ask_user_question。结束已核对的隔离官方CLI进程树，再从同一home以正常pnpm dsh web启动；手机进程PID20477保持运行并自行重连，原Key/绑定/历史不读写。官方进程树被主动结束，不把这个退出记录描述为自然退出0。

| 实际情况 | 原记录与手机核对 |
| --- | --- |
| 等待回答时电脑退出、恢复后手机补答 | 启动器49208结束、38272正常启动；43条原记录前缀完整保持，官方追加唯一TOOL_OUTCOME_UNKNOWN结果seq43和interrupted结束seq45。47条记录中的原问题为continued；手机显示“已中断”及“已继续工作，仍可回答”，工具详情显示原未知结果诊断。手机选择绿色提交，原工具结果保持一条，唯一user-question-reply消息seq51引用原callId/问题/答案，模型真实回复DSHM_TIMED_HOST_绿色，最终57条记录。没有重执行旧工具，也没有把补答改写为旧工具成功。 |
| 补答完成后再次结束电脑、手机恢复 | 启动器38272结束、44704正常启动；手机仍为原PID、同一会话/草稿/模型，待回答面板不再显示。原57条记录前缀逐项保持，仅追加session/end-seed至58条；用户/模型消息、工具调用/结果及turn/end全部不变，补答仍唯一。 |

[逐项证据](../../artifacts/official-plugin-only/c4c2b383-61a0-4308-9be0-5d486a905935/timed-host.json)保留真实工具、事件归属、两次进程退出/正常启动、历史摘要及唯一结算。[恢复后的问题](../../artifacts/official-plugin-only/c4c2b383-61a0-4308-9be0-5d486a905935/timed-host-waiting-restored.png)、[原未知结果详情](../../artifacts/official-plugin-only/c4c2b383-61a0-4308-9be0-5d486a905935/timed-host-waiting-detail.png)和[完成后重启画面](../../artifacts/official-plugin-only/c4c2b383-61a0-4308-9be0-5d486a905935/timed-host-settled-restored.png)均已实际查看。原未发送草稿和DeepSeek-V4-Pro模型保持；问题面板接管输入区时没有模型工具栏，答完后再核对模型，不能把暂时不显示误判为模型丢失。

依据实际安装包的[投影/补答实现](../../../plugin/artifacts/official-dsh-plugin-only/node_modules/@deepseek-ai/dsh-user-questions/lib/index.js)：timed调用遇到官方恢复追加的TOOL_OUTCOME_UNKNOWN结果后仍为continued；补答经官方userQuestions/answer进入新用户消息并结算原问题。普通legacy问题不进入该投影，本节不证明legacy或计划审批重启可补答。[后端核对](../../../backend/tests/support/official-timed-host.ts)验证原问题/完整日志和补答唯一，[真实手机驱动](../../tests/support/official-timed-host.mjs)由DSHM_OFFICIAL_TIMED_HOST_CHECK=1独立启用，仍要求真实模型、独立App与已登记启动PID；[进程守卫](../../../backend/tests/support/official-host-lifecycle.ts)不通过观察超时重复启动。

两次测试驱动失败保留：[首轮](../../../backend/artifacts/official-plugin-only/official-android-a48cd8c4-c104-4652-bb3a-df69814d6380.json)错误地假设离线仍显示问题按钮，手机清理尝试在Host关闭期间撤销导致fetch失败；后端正常重启、撤销授权和移除临时模式均完成，但手机finally未完整执行，随后独立结束测试UID并移除映射，不冒充首轮Android收尾通过。[第二轮](../../../backend/artifacts/official-plugin-only/official-android-154ed4d4-958c-4935-a1fd-e7c4de30d81f.json)误等问题面板接管期间的模型按钮；实际“已中断”与原问题已显示，手机及后端清理完成。测试改为离线没有可提交问题、问题答完再核对模型，并确保授权清理失败也继续结束独立UID/移除映射/保存原身份检查；未改产品行为或本体。

[最终收尾脚本](../../scripts/check-official-timed-host-restoration.mjs)与[实际恢复记录](../../artifacts/official-plugin-only/timed-host-final-restoration.json)核对原App PID4249、安装路径/APK摘要保持，正常Launcher回到前台；自己的UID停止、下载暂存为空、保存记录不存在、测试映射/授权清理。临时模式已卸载，标准模式完整文档与原四项模式/默认值保持。16955正常官方Host启动器44704/监听24056保持运行，16956/16957无监听，16901仍为本轮开始时停止状态；290官方包/6263文件摘要保持，TypeScript与手机驱动语法检查通过。

范围仅含有限超时问题、已登记CLI进程树的实际退出/正常重开，以及同一运行中的手机补答/结算后恢复。默认提问/计划中的Host结束见下节独立证据；[补答同时竞争](#默认提问计划与超时补答的同时竞争)已有独立证据；其他计时策略、发送在途断线及其他系统退出方式仍待验，不推导全部生命周期通过。

## 默认提问与计划中的电脑退出与恢复

状态：真实官方0.2.1-alpha.1正常pnpm入口、生产中转与独立Android通过；维护角色DSHM协作Agent，核验2026-10-09。[默认提问完整报告](../../../backend/artifacts/official-plugin-only/official-android-57e339b5-f0fb-4501-aa20-d136ca7d2f4e.json)测试71.065秒，[计划完整报告](../../../backend/artifacts/official-plugin-only/official-android-9764d3e6-7071-494e-99d4-7abbc245be4b.json)115.600秒；[提问Android](../../artifacts/official-plugin-only/57e339b5-f0fb-4501-aa20-d136ca7d2f4e/android.json)十阶段、[计划Android](../../artifacts/official-plugin-only/9764d3e6-7071-494e-99d4-7abbc245be4b/android.json)十二阶段均零页面异常，passed/interactionHostVerified/cleanupCompleted为true，零清理失败。只新增测试和恢复检查，复用现有插件/APK，没有修改、构建或安装DSH、SDK、插件或App。

官方默认legacy提问和计划审阅依赖当前Host的waterfall；进程退出后不能恢复旧答复事件。正常重启时，官方追加TOOL_OUTCOME_UNKNOWN及interrupted结束记录，手机撤下失效卡片；默认问题不进入timed补答投影，计划模式本身仍保留。它们与上一节timed原问题可补答的语义不同。依据：[官方提问投影](../../../plugin/artifacts/official-dsh-plugin-only/node_modules/@deepseek-ai/dsh-user-questions/lib/index.js)、[计划工具与模式持久化](../../../plugin/artifacts/latest-source-check/packages/plan/plan-mode/src/index.ts)。

| 手机实际情况 | 官方记录与恢复结果 |
| --- | --- |
| 默认提问等待时结束电脑，再显式新提问 | 手机PID21939保持，启动器44704结束后39752正常启动。43条原记录前缀完整保持，唯一未知结果seq43、interrupted结束seq45，恢复47条；旧问题卡片消失，原问题没有continued/补答。旧事件答案被remote_event_owner_denied拒绝，完整记录不变。显式新请求产生新callId，手机选择绿色，唯一成功结果seq56和真实DSHM_LEGACY_HOST_绿色回复；原未知结果未改写。结算后39752结束、50008正常启动，63条前缀保持，仅追加session/end-seed至64条，无消息、工具或结果重放。 |
| 计划等待时结束电脑，再显式提交并批准 | 手机PID23388保持；50008结束、48492启动。51条前缀完整保持，未知结果seq51、interrupted结束seq53，恢复55条；原审批失效、计划模式仍active。旧批准被拒绝且记录不变。显式新计划正文在手机局部面板实际显示，手机同意执行后唯一成功结果seq64、真实DSHM_PLAN_HOST_APPROVE回复，计划模式关闭。48492结束、24400启动后74条记录保持，无追加业务事件或重放。 |
| 计划等待时结束电脑，再显式提交并要求修改 | 同一手机PID23388；24400结束、44064启动。91条前缀保持，未知结果seq91、interrupted结束seq93，恢复95条；旧批准被拒绝，新计划使用不同callId。手机要求修改产生唯一官方dismiss结果seq104及真实DSHM_PLAN_HOST_MODIFY回复，计划模式保持active。44064结束、47268启动后111条前缀保持，仅追加session/end-seed至112条；模式仍active，审批卡片不存在，没有重新提交计划。最后通过公开计划开关及收尾命令恢复关闭状态。 |

[提问逐项证据](../../artifacts/official-plugin-only/57e339b5-f0fb-4501-aa20-d136ca7d2f4e/legacy-host.json)与[计划逐项证据](../../artifacts/official-plugin-only/9764d3e6-7071-494e-99d4-7abbc245be4b/plan-host.json)保存原完整日志前缀摘要、实际callId/eventId、六次受控退出/正常启动、旧答复拒绝及新结果唯一。两个模式中，恢复期间原聊天、未发送草稿和DeepSeek-V4-Pro保持，手机自行重连且零iframe；中断工具详情显示原未知结果诊断。实际查看[提问未知结果](../../artifacts/official-plugin-only/57e339b5-f0fb-4501-aa20-d136ca7d2f4e/legacy-host-answer-unknown-detail.png)、[新提问结算后恢复](../../artifacts/official-plugin-only/57e339b5-f0fb-4501-aa20-d136ca7d2f4e/legacy-host-answer-settled-restored.png)、[计划未知结果](../../artifacts/official-plugin-only/9764d3e6-7071-494e-99d4-7abbc245be4b/plan-host-approve-unknown-detail.png)和[要求修改后再次重启](../../artifacts/official-plugin-only/9764d3e6-7071-494e-99d4-7abbc245be4b/plan-host-modify-settled-restored.png)。

[后端核对](../../../backend/tests/support/official-interaction-host.ts)与[手机驱动](../../tests/support/official-interaction-host.mjs)使用互斥DSHM_OFFICIAL_INTERACTION_HOST_CHECK=legacy或plan，同时要求真实Android/模型/独立App及登记的CLI启动PID；不得与其他专项开关混用。旧答复端是独立已批准生产协议连接，使用自身原clientId/eventId；手机对新事件的回答/批准/要求修改走真实页面。新任务由公开session/prompt显式发起，没有伪造模型事件、补写历史或恢复旧事件。

[恢复脚本](../../scripts/check-official-interaction-host-restoration.mjs)和[最终记录](../../artifacts/official-plugin-only/interaction-host-final-restoration.json)分别核对两轮授权撤销、网关关闭、测试UID停止、暂存为空、保存记录不存在、测试端口映射移除，计划模式恢复关闭。原App PID4249、安装路径与APK摘要保持，正常Launcher普通首页回到前台，Key/绑定/历史不读写。16955保留正常官方启动器47268/监听46612，16956/16957无监听，16901仍为开始时停止状态；官方290包/6263文件摘要核对不变。

本节仅覆盖默认legacy提问、计划批准/要求修改，已登记隔离CLI进程树结束及同一手机恢复。没有执行批准计划中的实际文件任务，不计其他工具/审批的Host结束、答复发送在途、同时竞争、其他系统结束方式或全部生命周期通过。

## 默认提问、计划与超时补答的同时竞争

状态：正常官方0.2.1-alpha.1、生产网关与真实Android通过；维护角色DSHM协作Agent，核验2026-10-09。本专项复用同一正常`pnpm dsh web`启动器47268/监听46612和已有`.officialtest` APK，没有修改、构建或安装DSH、SDK、插件、App或生产网关。三轮整体验证各十阶段、零页面异常，`interactionRaceVerified/passed/cleanupCompleted=true`，零清理失败；每轮包含两次相反答案竞争，合计六次。

| 实际竞争 | 唯一结果与手机核对 |
| --- | --- |
| 默认legacy问题：蓝色/绿色，同时发送；第二次反转顺序 | [完整报告](../../../backend/artifacts/official-plugin-only/official-android-853616f1-ca75-43fe-a62d-8e2c676d0d8a.json)34.803秒。两次均为同一实际eventId、两个不同clientId；第二条发送发生在第一条回执之前。蓝色、绿色分别胜出，唯一原工具结果seq43/58，真实模型回复seq47/62，最终50/65条记录保持竞争前43/58条完整前缀。两个发送回执均成功，但落败答复为空操作；落败读者各收到一次原事件cancel，不代表两个答案都被执行。手机PID25643保持、原卡片撤下、草稿/模型保持。 |
| 计划：批准与要求修改同时发送；第二次反转顺序 | [完整报告](../../../backend/artifacts/official-plugin-only/official-android-e93f8d5e-9fa2-40ae-a0b2-49cf646b8e26.json)36.527秒。原计划正文通过手机实际局部面板核对。批准、要求修改分别胜出，唯一结果seq51/77、真实回复seq58/81，最终61/84条记录保持51/77条完整前缀。批准后计划关闭，要求修改后仍开启；手机正常开关与收尾命令恢复关闭。两次各一个落败读者cancel，手机PID26439保持、旧审批卡片撤下。 |
| 12秒超时后原问题补答：蓝色/绿色同时发送；第二次反转顺序 | [完整报告](../../../backend/artifacts/official-plugin-only/official-android-ec1cbee7-545b-41c6-9055-0a5d14a0d187.json)69.238秒。手机先显示原问题和“已继续工作，仍可回答”。两条真实连接均不登记前台等待；蓝色、绿色分别胜出，原pending工具结果seq43/67始终逐项不变，只追加一条原问题用户补答seq54/78，真实模型回复seq56/80，最终59/83条记录保持补答前50/74条完整前缀。胜出返回true，另一连接实际返回gateway/internal、message为a reply is already queued for this question；没有第二条用户补答或第二轮继续执行。手机PID27329保持、原卡片撤下，草稿/模型保持。 |

每次完成后，两条连接再同时提交相反旧答案：legacy/plan均成功幂等空操作，continued补答均返回false，完整官方记录逐项不变。未向历史补写模型事件、原工具结果或答案；模型回复的source与completed结束、会话不再running分别核对。计时专项通过正常安装器临时新增独立模式，只用于新测试会话；结束后正常移除，标准模式全文与原模式目录/默认值完全恢复。

竞争端是同一已批准协议设备的两条独立生产连接，各自使用真实票据/鉴权和clientId；Android实际显示待决定及最终结果，但没有冒充两台实体手机或电脑页面同时点击。默认问题与计划使用原waterfall结果，补答使用官方`userQuestions/answer`。这里只证明两条连接的请求时间重叠及官方单次结算，不推断任意网络重排序或更高并发。

实际查看[默认问题结算](../../artifacts/official-plugin-only/853616f1-ca75-43fe-a62d-8e2c676d0d8a/legacy-race-1-settled.png)、[计划要求修改结算](../../artifacts/official-plugin-only/e93f8d5e-9fa2-40ae-a0b2-49cf646b8e26/plan-race-1-settled.png)和[超时补答结算](../../artifacts/official-plugin-only/ec1cbee7-545b-41c6-9055-0a5d14a0d187/continued-race-1-settled.png)，原卡片消失、胜出模型回复与未发送草稿显示一致，零iframe。

实现与逐项证据：[普通竞争事实核对](../../../backend/tests/support/official-interaction-race.ts)、[普通手机驱动](../../tests/support/official-interaction-race.mjs)、[补答事实核对](../../../backend/tests/support/official-timed-race.ts)、[补答手机驱动](../../tests/support/official-timed-race.mjs)。互斥开关`DSHM_OFFICIAL_INTERACTION_RACE_CHECK=legacy|plan|continued`，同时需Android/真实模型/独立App检查；不能与其他专项混用。后端TypeScript与新驱动语法检查通过。

[收尾记录](../../artifacts/official-plugin-only/interaction-race-final-restoration.json)核对三轮授权撤销、网关关闭、测试UID停止、暂存为空、保存记录不存在、测试映射移除、计划模式恢复及计时模式移除；[原App前台](../../artifacts/official-plugin-only/interaction-race-original-foreground.png)已实际查看，原PID4249/安装路径/SHA保持，未读取Key、绑定或历史。官方290包/6263文件仍与首次基线摘要一致。[默认提问与计划批准发送断线](#默认提问与计划答复发送断线及确认丢失)另有独立证据；continued补答、计时答案、要求修改及其他类型答复发送在途、其他审批类型、其他计时策略和实际计划文件执行仍待验，不能将本节扩大为全部生命周期通过。

## 默认提问与计划答复发送断线及确认丢失

状态：正常官方0.2.1-alpha.1、生产网关与真实Android通过；维护角色DSHM协作Agent，核验2026-10-09。复用启动器47268/监听46612、生产鉴权/中转和已有`.officialtest` APK；只新增验收代码，没有修改或构建DSH、SDK、插件、App或生产网关。[默认提问报告](../../../backend/artifacts/official-plugin-only/official-android-f8e52888-7a7b-4a58-ae87-667b7217ca98.json)36.694秒，[计划报告](../../../backend/artifacts/official-plugin-only/official-android-4a1e0c63-ae6c-4a22-b9e6-f769d81ac42a.json)43.592秒；各十阶段、零页面异常，`interactionSendingVerified/passed/cleanupCompleted/externalProxyClosed=true`，零清理失败。

| 真正手机提交与断线位置 | 官方结算和手机恢复 |
| --- | --- |
| 默认问题选绿色，尚未转发到网关时切断 | 手机PID28642不变，实际原eventId/callId和结构化绿色答案被测试转发口捕获但未转发。离线和重连后43条官方记录逐项相同、无结果且仍running；旧答案不重发。手机恢复原问题后明确选择蓝色提交，唯一原结果seq43、真实蓝色回复seq47，最终50条记录保持原完整前缀。两次手机请求分别为未转发绿色与已转发蓝色，clientId随重连更新。 |
| 默认问题绿色已转发，真实成功回执到达转发口但未交给手机时切断 | 同一手机PID28642；回执原请求id一致、实际value.ok=true，回执和后续帧不送手机。手机仍离线时，官方唯一绿色结果seq58、真实回复seq62、completed和闲置状态已落盘。重连仅恢复65条历史/原草稿/模型并撤下旧卡片，没有第二次手机答复。 |
| 计划批准未转发时切断，恢复后手机要求修改 | 手机PID29489保持；51条原记录离线/重连后逐项相同，原计划仍等待决定、模式active。原Approve不重发；手机明确点击要求修改，原事件以官方ASK_CANCELLED结算，唯一结果seq51、真实MODIFY回复seq55，最终58条记录保持前缀，模式仍active，收尾正常关闭。 |
| 计划批准已被处理，真实成功回执未交给手机时切断 | 同一手机PID29489；手机离线期间唯一批准结果seq75、真实APPROVE回复seq82、completed与计划模式关闭已落盘。重连恢复85条历史/原草稿/模型、撤下旧审批卡片，只有原一次Approve请求，没有再次提交计划或批准。 |

四种情况均从DSHM实际问题/计划按钮提交，捕获的clientId与两个测试观察读者不同。默认legacy原waterfall不带callId，转发口以原eventId、agentId、精确问题id/正文和已核对的官方原工具记录关联；计划另核对原intent.callId及完整计划正文。切断前严格核对实际答案，不用write审批的字符串答案替代提问答案。计划原文也在手机局部面板实际查看。

外部[测试转发口](../../../backend/tests/support/official-approval-transport.ts)只转发原HTTP/WebSocket帧，在指定两处终止真实连接；不替换生产函数、不修改DSH模块，也不生成鉴权、答案或回执。转发前切断证明请求未送达；回执丢失由真实生产result确认，另外再核对官方唯一工具结果、真实模型source、completed及会话闲置，不能只凭成功回执推断任务完成。重连期间由原生载体自动尝试，恢复前旧决定不可交互；未送达的决定必须用户重新明确提交。

每种结算后再由两条真实协议连接发送相反旧决定，官方成功幂等空操作、完整记录逐项不变。该检查是完成后手动旧答案验证，不冒充发送中竞争。实际查看[默认问题离线](../../artifacts/official-plugin-only/f8e52888-7a7b-4a58-ae87-667b7217ca98/legacy-sending-before-forward-offline.png)、[默认问题回执丢失后结果](../../artifacts/official-plugin-only/f8e52888-7a7b-4a58-ae87-667b7217ca98/legacy-sending-after-receipt-settled.png)、[计划恢复后要求修改](../../artifacts/official-plugin-only/4a1e0c63-ae6c-4a22-b9e6-f769d81ac42a/plan-sending-before-forward-settled.png)与[计划回执丢失后批准结果](../../artifacts/official-plugin-only/4a1e0c63-ae6c-4a22-b9e6-f769d81ac42a/plan-sending-after-receipt-settled.png)。

[手机驱动](../../tests/support/official-interaction-sending.mjs)复用[事实核对](../../../backend/tests/support/official-interaction-race.ts)的原调用/完整前缀/唯一结果检查；互斥`DSHM_OFFICIAL_INTERACTION_SENDING_CHECK=legacy|plan`，同时需Android/真实模型/独立App检查。共享转发口调整后，[原普通write发送专项回归](../../../backend/artifacts/official-plugin-only/official-android-bd3ba3f0-f9ae-42bc-8eda-305ad255a767.json)51.647秒通过：批准未转发后手机显式拒绝，结果seq62/原文件保持；实际批准确认丢失后唯一写入结果seq91及原件正文匹配，重连无重放。十阶段、零页面异常，自己的原件恢复后清理。

[三轮收尾](../../artifacts/official-plugin-only/interaction-sending-final-restoration.json)核对原App PID4249/安装路径/SHA保持、正常Launcher前台恢复；测试UID停止、下载暂存为空、保存记录不存在、测试授权及16956/16957映射移除。两个新专项和write回归的外部转发口/网关全部关闭，计划模式恢复关闭。16955保持同一官方启动器47268/监听46612，16901保持原停止状态；官方290包/6263文件摘要不变。后端TypeScript和相关驱动语法检查通过，没有读取原Key、替换绑定或清理原历史。

本节只含默认legacy提问和原计划Approve发送，不代表continued补答发送在途、计时等待答案、要求修改发送在途、其他审批类型、任意断点或实际计划文件执行全部通过。

## 工作区文件、预览与手机交付

[文件专项](../../../backend/artifacts/official-plugin-only/official-android-66be0498-ba05-4237-9fd4-ebfce0ecb9d4.json)49.940秒、十三阶段通过；[实际手机报告](../../artifacts/official-plugin-only/66be0498-ba05-4237-9fd4-ebfce0ecb9d4/files-transfers.json)记录独立工作区按需展开、空目录和嵌套文本读取。5002行中文/emoji文本首屏5000行、加载更多后全文一致；另一批准中转客户端沿官方 `workspaceFiles/readBytes`分三块读取168961字节，摘要与原件一致。此 Unicode 文本证据不等于 PowerShell输出编码已修复。

原生系统保存窗口实际选中下载目录后，文件大小和SHA-256与电脑原件一致；随后真实系统分享面板打开并取消，没有选择接收者，不宣称接收端交付。Markdown标题/正文、160×100 SVG实际解码、HTML文件按钮交互和PDF实际画布均通过。HTML为单个文件的隔离预览、origin为null、无原生桥；不是嵌入电脑站点。聊天草稿保持，后续断线/新建/撤销也通过。

仅补充[手机驱动](../../tests/support/official-files-transfers.mjs)与后端opt-in测试，没有构建或修改DSH/SDK/插件/App。测试原件内容核对后删除、手机独立下载副本摘要复核后删除、测试授权撤销、网关关闭，cleanupCompleted=true，原凭据App安装路径/PID23468/摘要保持。Office见下方独立专项；附件/上传、文件变化与在途取消仍待纯官方专项，不把工作区文件通过扩大为全部文件能力。

文件专项另设 `DSHM_OFFICIAL_FILE_CHECK=1`，插件安装专项另设 `DSHM_OFFICIAL_PLUGIN_CHECK=1`；与提问/后台专项互斥，均需下方真实模型和独立App开关。各自报告不能冒充审批整轮。

## 普通插件安装、局部界面与权限收回

[完整专项](../../../backend/artifacts/official-plugin-only/official-android-e74d4b81-7644-4114-a141-dd2b5c0ed0a5.json)55.411秒、十三阶段通过；[手机报告](../../artifacts/official-plugin-only/e74d4b81-7644-4114-a141-dd2b5c0ed0a5/plugin-install.json)核对未授权时管理操作不可用，临时授权后经真实手机包管理入口安装普通测试插件。官方实际返回“已安装／立即启用”，本轮无需重启；测试不预设 HMR 状态，也不修改官方安装器。

[普通样例](../../tests/fixtures/live-panel-plugin/package.json)通过 ClientModules 加载到 DSHM 自有页面，零 iframe。720px 原面板等比例显示为388px，视窗420px；计数、插件原弹窗与菜单可以交互，切换面板及返回聊天后计数仍为1。只验此样例，不代表任意作者插件或旧动态运行器都支持。

手机从详情入口卸载后等待官方目录结算6.492秒，再确认包已移除；权限变更结束旧连接，沿真实“重新连接”入口重新鉴权。管理权限收回、聊天授权保持及原草稿恢复通过；后续断线、新建与撤销也通过。测试插件移除、设备撤销、网关关闭、独立UID停止和映射移除，cleanupCompleted=true；原App安装路径/PID23468/摘要保持。

五轮测试驱动失败保留：权限变更后误等原页面自动提权、错误预设重启提示、重开面板遗漏导航、误找列表卸载按钮，以及卸载目录尚未结算就检查。最后一轮[失败报告](../../../backend/artifacts/official-plugin-only/official-android-422e68f0-e988-4bd4-90a3-0c0aea322bb8.json)明确 cleanupCompleted=false，不能改写成通过；[后续只读核对](../../../backend/artifacts/official-plugin-only/plugin-state-c106f4ae-03d3-48a9-80be-3dd4c90afbdb.json)确认包目录、profile选择及依赖最终全部为空。仅修正验收等待和真实操作路径，没有修改DSH/SDK/产品安装器或重新构建APK。升级、安装在途取消/重启未知结果、任意插件设置仍待分别验证。

Office 专项使用 `DSHM_OFFICIAL_OFFICE_CHECK=1`；与文件、安装、提问、后台专项互斥，不能将普通预览结果扩大为转换取消/缓存生命周期通过。

## 官方 Office 六格式转换与重开

[专项报告](../../../backend/artifacts/official-plugin-only/official-android-caa60258-93d6-4eef-bb53-9140c2de27eb.json)50.628秒、十四阶段通过；[实际手机报告](../../artifacts/official-plugin-only/caa60258-93d6-4eef-bb53-9140c2de27eb/office-preview.json)记录 `.doc/.docx/.xls/.xlsx/.ppt/.pptx`六份真实文件从原文件树触发官方转换、显示实际 PDF 画布与“Office preview 中文文档”正文，关闭后重新打开正文逐字一致。另一批准中转读者读取原件，大小/SHA-256全部一致；606720字节旧PPT实际分十块读取。

只复用已有真实Office原件的只读副本、正常官方转换接口和同一APK；未构建DSH/SDK/插件/App，也不注入旧转换/缓存观察器。[新驱动](../../tests/support/official-office-preview.mjs)明确 `cacheReuseVerified=false`：重开内容相同不证明引擎只转换一次。附件、原件系统交付及转换中断网/取消/撤权/服务停用、共享缓存仍待纯官方专项。自己的六份副本摘要/内容核对后删除，草稿及后续重连/新建/撤销通过，cleanupCompleted=true；原App安装路径/PID23468/摘要保持。

## 已有工作区的注册管理

[专项报告](../../../backend/artifacts/official-plugin-only/official-android-21b14a45-bff4-41d2-a80e-0ca54f8fdc57.json)24.748秒、十二阶段通过；[实际手机报告](../../artifacts/official-plugin-only/21b14a45-bff4-41d2-a80e-0ca54f8fdc57/workspace-management.json)核对管理授权前没有操作按钮，授权重连后改名、移动到另一个专用工作区前、移动到最后与移除注册全部经官方投影确认。未勾确认时移除按钮禁用；只处理电脑预先登记的本轮工作区，手机不创建目录或注册。

移除后真实 `keep.txt` 内容不变，专用会话的原始事件逐项一致，手机返回会话仍能显示此前真实模型回复。其他所有工作区的身份、标题、路径及相对顺序未变；原聊天草稿保留，收回管理权限后聊天授权保持，后续重连/新建/撤销也通过。测试注册清理、文件内容核对后删除、设备撤销、网关关闭，cleanupCompleted=true，原App安装路径/PID23468/摘要保持。

[驱动](../../tests/support/official-workspace-management.mjs)复用同一官方Host和APK，仅新增测试。[首轮失败](../../../backend/artifacts/official-plugin-only/official-android-f683e407-ebee-4b82-bbd3-1101f6d51ba7.json)是测试按部分工作区名称匹配到两个按钮，清理成功；改为完整名称后复验通过，没有修改产品。专项开关 `DSHM_OFFICIAL_WORKSPACE_CHECK=1`与其他扩展专项互斥；并发改动、在途断线结果未知不计本轮通过。

## 电脑设置读取、保存与默认继承恢复

[专项报告](../../../backend/artifacts/official-plugin-only/official-android-a6eae56c-2e1b-4180-b23e-de54ab8e862b.json)25.916秒、十一阶段通过；[实际手机报告](../../artifacts/official-plugin-only/a6eae56c-2e1b-4180-b23e-de54ab8e862b/computer-settings.json)核对管理授权前没有设置输入，授权重连后显示五项公开设置。手机将等待输出超时从300000毫秒改为301000毫秒，经独立官方 `settings/describe`脱敏投影确认值与覆盖状态；随后沿原“恢复默认”保存，值回到300000且 overridden=false，其他四项未变。再次读取及测试收尾的独立核对也一致。

原草稿与聊天授权在收回管理后保持，后续重连/新建/撤销通过。cleanupCompleted/testSettingsRestored=true，原App安装路径/PID23468/摘要保持；没有操作Key、地址或提供方，没有构建产品。[新驱动](../../tests/support/official-computer-settings.mjs)和后端只保留这五项公开标量；失败收尾只有当前仍等于本轮临时值时才恢复该字段，不覆盖未知并发变化。其他四项写入、密码窗口、提供方/地址及设置在途异常仍待验。

[首轮失败](../../../backend/artifacts/official-plugin-only/official-android-1e50b310-04f8-45b2-96f9-a325b18f3ec8.json)是等待短暂“已保存到电脑”提示超时；实际值已写入，官方更新事件引发自动重读并清空提示，测试收尾恢复了原值和继承，cleanupCompleted=true。复验改为等待手机实际投影/表单结算，再独立核对电脑持久值；未修改产品提示或将请求回执当作保存成功。专项开关 `DSHM_OFFICIAL_SETTINGS_CHECK=1`与其他扩展专项互斥。

## 手机队列、立即引导、停止与待发送恢复

[专项报告](../../../backend/artifacts/official-plugin-only/official-android-b9487d5d-1467-4bb5-a10f-d50f49ccc07a.json)74.959秒、十一阶段通过；[手机逐项报告](../../artifacts/official-plugin-only/b9487d5d-1467-4bb5-a10f-d50f49ccc07a/queue-control.json)经实际输入框排队、编辑、取消和立即引导，另读官方投影核对同一消息身份及 next-turn/next-step 归属。45秒只读前台命令自然完成后，引导消息进入当前轮次，编辑后的消息进入下一轮并产生真实回复；原文未被消费，取消的消息没有 user/message。生成期间所有模型选择按钮禁用。

另一条60秒只读前台命令由手机“停止生成”中止，官方日志记录同一 callId 的错误工具结果与 turn/end `{kind:'aborted',reason:{kind:'user'}}`，session/list 确认为不运行；不是把 accepted 回执当作停止完成。待发送项未被消费，停用/启用中转后同一身份、正文与草稿保持，手机仍可取消。后续普通重连/新建/撤销通过，零页面异常、cleanupCompleted=true，原App PID23468/安装路径/摘要保持；复用同一Host与APK，不修改或构建DSH/SDK/App。

[驱动](../../tests/support/official-queue-control.mjs)使用真实模型调用内置 pwsh 建立有界操作窗口，只执行 Write-Output/Start-Sleep，不读写文件、联网或提权。专项开关 `DSHM_OFFICIAL_QUEUE_CHECK=1`需真实模型与独立App开关，并与其他扩展专项互斥；收尾移除本轮会话剩余待发送项。多客户端同时操作、写入在途断线、PTC/嵌套工具停止不计本专项通过。

## 手机搜索、重命名、分支和归档

[完整专项](../../../backend/artifacts/official-plugin-only/official-android-20c89d7a-dec1-4643-a76b-c9ae2bede770.json)21.832秒、十阶段通过；[手机报告](../../artifacts/official-plugin-only/20c89d7a-dec1-4643-a76b-c9ae2bede770/session-navigation.json)从真实菜单改名，标题/消息内容搜索显示同一会话，内容片段与另读官方 session/search 完全匹配。创建分支后官方父身份与cwd正确，继承的用户/模型/工具事件逐项相同；原聊天内容未变，分支输入草稿与原聊天分别保留。手机归档后最近列表消失，在已归档列表可读取原回复；取消归档后官方归档集合更新，恢复最近列表。最终原名/原草稿恢复，专用分支在收尾归档。

官方当前默认 `openAt: never`，关闭全文内容搜索；手机正确显示“电脑尚未开启聊天内容搜索，当前仅搜索标题”。内容搜索的通过依赖电脑开启此官方功能。测试只在独立home的正常 `cordis.patch.yml` 临时加入 session-query-sqlite 配置 `path: ':memory:'`、`openAt: first-search`，正常CLI重启后执行；不修改官方源码/包，不安装额外组件。完成后移除该覆盖，配置文件SHA-256精确回到 `f9111be46f7d53168aedb6d1b2a377e0a81d6e3b8f722c54a0bb1ce45f237e6b`，正常启动恢复默认关闭。详见[恢复核对](../../../plugin/artifacts/official-dsh-plugin-only/search-profile-restored.json)。因此不能承诺未开启搜索的电脑提供内容搜索。

[首轮失败](../../../backend/artifacts/official-plugin-only/official-android-1b62dbe9-3e00-4007-8381-a84ba6336b7b.json)误把官方 title 线上的字符串投影当作元数据对象；[第二轮](../../../backend/artifacts/official-plugin-only/official-android-758622f6-f764-4deb-9015-d1b08179a7f1.json)及[第三轮](../../../backend/artifacts/official-plugin-only/official-android-361704e7-e153-4887-81c7-47eff2ebd97d.json)在内容搜索关闭时误等结果，均保留失败且清理成功。首次配置试写生成的 cordis.yml 被官方启动重新生成，未开启搜索；覆盖文件首次遗漏必需path，官方校验明确拒绝并导致依赖服务不可用，诊断保留在恢复报告。依正常覆盖语义补齐后完整复验通过；只修改测试驱动和隔离配置，未改产品或重建DSH/SDK/App。

[导航驱动](../../tests/support/official-session-navigation.mjs)使用 `DSHM_OFFICIAL_NAVIGATION_CHECK=1`（真实模型/独立App开关及专项互斥要求同上）。零页面异常、cleanupCompleted/testForksArchived=true，原App PID23468/安装路径/摘要保持。仅验普通已完成会话的最新边界分支；指定轮次分支、长历史、子会话与导航在途竞争仍待纯官方专项。

本轮最终校验：后端显式TypeScript检查与三个相关Android驱动语法检查退出0，165篇Markdown/9853本地链接通过；290官方包/6263文件SHA精确保持。恢复后正常官方16955/插件200运行，测试16956网关与反向映射关闭；原凭据App PID23468保持。没有重建DSH、SDK、插件或App。

## 审批等待时断线、其他连接答复与相反决定竞争

[完整专项](../../../backend/artifacts/official-plugin-only/official-android-460a0ed7-44c2-43f3-b35c-1839fa4fb471.json)41.886秒、十一阶段通过；[手机逐项报告](../../artifacts/official-plugin-only/460a0ed7-44c2-43f3-b35c-1839fa4fb471/approval-recovery.json)记录三次真实模型 write 审批，始终保留仅可查看权限。等待时停用中转，手机不保留可提交的旧按钮、文件仍为原文；恢复后只有一张待审批卡片，官方事件 eventId/callId 不变，连接 clientId 换代。手机允许一次后实际文件写入，官方仅有一个对应工具结果。手机渲染 key 属于本地呈现身份，不要求跨断线保持。

另一实际中转连接拒绝审批后，手机卡片同步撤下、真实模型确认拒绝、文件保持。两条独立中转连接同时提交允许/拒绝时，官方同一事件只结算一次，手机同步显示唯一结果；本轮允许赢得竞争。竞争读者使用同一已批准协议设备、分别持有真实连接与官方 clientId，手机为另一个已批准设备；不把协议并发说成两台手机同时点击。随后提交相反旧答复返回官方幂等成功空操作，原始会话记录与文件不变，不能误记为服务器拒绝。

[驱动](../../tests/support/official-approval-recovery.mjs)只经原手机按钮处理恢复后的审批；协议读者使用公开 `$events`/`$events/result`，设备/连接归属由原插件检查，不冒用手机 clientId。后端独立核对原工具目标、单次权限升级、唯一结果与真实模型 source，成功文件先恢复，测试收尾再精确删除自己的三份文件并恢复权限、撤销测试授权。零页面异常、cleanupCompleted=true，原App PID23468/路径/摘要保持；复用同一Host/APK，没有改造或构建DSH、SDK、插件或App。专项开关 `DSHM_OFFICIAL_APPROVAL_RECOVERY_CHECK=1` 与其他扩展互斥。

[首轮失败](../../../backend/artifacts/official-plugin-only/official-android-f6085b56-c1ad-4f3e-b7c1-f96065c3ab7e.json)201.756秒是测试把整块模型回复的操作文字也纳入正则完整匹配，实际审批恢复和写入已经完成；失败及手机现场保留，清理成功。修正消息定位后整轮通过，未修改产品。App进程结束、Host结束、答复发送在途断线，以及其他审批类型的并发不计本轮通过。

## 审批等待时App结束与原会话恢复

状态：正常官方 `0.2.1-alpha.1`、生产中转和真实Android自有页面通过；维护角色DSHM协作Agent，核验2026-10-09。[完整专项](../../../backend/artifacts/official-plugin-only/official-android-4ad55a60-90a4-48a3-918a-b47c3fd6cc4a.json)65.882秒、十手机阶段通过；[逐项记录](../../artifacts/official-plugin-only/4ad55a60-90a4-48a3-918a-b47c3fd6cc4a/approval-process.json)核对两次真正的模型write审批、原会话日志和磁盘结果。仅新增[手机驱动](../../tests/support/official-approval-process.mjs)及[后端编排](../../../backend/tests/official-host.test.ts)，复用已安装APK/同一Host，没有修改或构建DSH、SDK、插件、App或网关。

手机先从可见编辑器留下未发送草稿，电脑通过官方 `session/prompt` 正常向同一会话发送任务，手机同步显示请求与审批。会话始终仅可查看；测试只申请自己的文件单次write权限。实际 `am force-stop` 只结束独立 `.officialtest`，核对PID消失，再通过正常Launcher打开普通首页、抽屉进入DSHM Remote、自动恢复原绑定并打开原会话，零iframe。两次旧/新PID分别18579→18943、18943→19334，不用页面刷新冒充进程结束。

| 电脑审批状态 | 手机重新打开后的实际结果 | 官方记录与磁盘核对 |
| --- | --- | --- |
| 仍在等待 | [同一条审批恢复](../../artifacts/official-plugin-only/4ad55a60-90a4-48a3-918a-b47c3fd6cc4a/approval-process-pending-restored.png)，只有一个待审批卡片，callId不变；独立协议观察器重连后原eventId不变、新clientId不同。原草稿恢复，文件仍是原文，未自动批准或重发。随后手机点“允许一次”。 | App结束和重开前后55条原事件完整摘要一致；消息序号43只出现一次。实际升级write结果仅一条、序号56，文件变为指定值；真实模型回复后官方completed结算，完整历史64条且原55条前缀保持。 |
| App关闭期间被另一连接拒绝 | 同一已批准协议设备的另一真实连接经公开 `$events/result` 拒绝，模型在手机PID为空时完成；重开显示[原拒绝结果](../../artifacts/official-plugin-only/4ad55a60-90a4-48a3-918a-b47c3fd6cc4a/approval-process-settled-settled.png)，旧审批卡片不存在，原草稿恢复。 | 等待时79条原事件，拒绝后87条，原79条完整前缀保持；消息序号68只有一条，升级write拒绝结果序号80仅一条，模型回复序号84在App关闭期间产生，文件始终保持原文。 |

两次均独立核对 `deepseek-official/deepseek-v4-pro` 的实际回复与官方 `turn/end.reason.kind=completed`，不能把审批接管输入导致“停止生成”按钮隐藏当作模型完成。向已结算事件再次提交相反决定为官方幂等成功空操作，完整原记录和文件保持，不误记为拒绝。两份自己的文件先恢复原内容，再经正式收尾核对/删除，临时会话权限恢复；后续常规重连/已有工作区新建/撤销拒绝通过。`approvalProcessVerified/passed/cleanupCompleted=true`，零页面异常/清理失败，原App PID5147、安装路径/APK摘要前后相同，原Key/绑定/数据不读写。

三份失败保留并清理成功：[首轮](../../../backend/artifacts/official-plugin-only/official-android-b7f56912-946e-401d-8bd0-9c21db0d1068.json)45.599秒试图在审批接管后填写隐藏编辑器，尚未结束App；[第二轮](../../../backend/artifacts/official-plugin-only/official-android-e02cf339-6988-4bdb-81d9-5769a04b2dfa.json)36.123秒已恢复原审批并实际写入，但测试抢在官方完成记录前检查，未计整轮通过；[第三轮](../../../backend/artifacts/official-plugin-only/official-android-8b7c519f-d64a-4cab-a366-2ce560f76f08.json)14.652秒与手机发送回执时的短暂输入锁定竞争，尚未结束App。最终驱动采用电脑正常发起/手机先留草稿的双端流程，并等待官方持久化completed，不强制编辑隐藏/锁定节点、不修改生产输入或伪造完成回执。

互斥开关 `DSHM_OFFICIAL_APPROVAL_PROCESS_CHECK=1` 与 `DSHM_OFFICIAL_APPROVAL_RECOVERY_CHECK=1`，同时需Android/真实模型/App检查。本节仅覆盖普通write审批等待时独立UID force-stop、原绑定/会话/草稿及两类真实审批结果恢复；Host结束、答复发送在途中断、提问/计划/其他审批类型与全部系统回收策略仍待验。不提供官方缺失的汇总待审批通知，不把此场景等同已验证推送。

本轮最终校验：后端显式TypeScript、两个相关Android驱动语法和两仓Git diff检查退出0；165篇Markdown/10009本地链接通过，290官方包/6263文件SHA全部保持。16955同Host46632与原16901服务30912/映射保持，16956无监听/映射，独立UID已停止，私有下载为空且保存记录目录不存在。原App正常Launcher返回原RemoteActivity前台，Status ok/HOT、PID5147与安装文件摘要保持，未读取或写入原Key/绑定数据；[收尾记录](../../artifacts/official-plugin-only/approval-process-final-restoration.json)保留实际命令结果。

## 普通write审批中的电脑端结束与恢复

状态：正常官方 `0.2.1-alpha.1`、生产中转与真实Android自有页面通过；维护角色DSHM协作Agent，核验2026-10-09。[完整专项](../../../backend/artifacts/official-plugin-only/official-android-0aee6be7-b1b3-4eb9-963c-1fd30e8305b4.json)72.120秒，[手机逐项记录](../../artifacts/official-plugin-only/0aee6be7-b1b3-4eb9-963c-1fd30e8305b4/host-restart.json)核对真实模型write、官方持久事件和实际文件。仅结束登记为测试用途的pnpm进程树，恢复仍运行正常 `pnpm dsh web`；同一官方安装和profile复用，不修改、注入或构建DSH/SDK。

手机留下未发送草稿，电脑通过公开 `session/prompt` 在同一会话发起任务；会话仅可查看，手机显示真实单次write审批。两次受控退出均验证16955监听关闭、旧启动进程消失，再用正常pnpm入口启动新进程。手机PID23480全程不变，自行断线/重连，不强制刷新App或页面；同一聊天、草稿、实际模型名称恢复，零iframe。

| 电脑退出时机 | 手机与官方恢复结果 | 文件、消息与历史核对 |
| --- | --- | --- |
| 普通write审批等待 | 离线时旧审批按钮禁用；重连后旧卡片撤下，[显示“已中断”及原执行过程](../../artifacts/official-plugin-only/0aee6be7-b1b3-4eb9-963c-1fd30e8305b4/host-restart-waiting-restored.png)。官方产生唯一 `TOOL_OUTCOME_UNKNOWN` 结果seq55，`turn/end` seq57为interrupted；原clientId/eventId的迟到批准实际返回 `remote_event_owner_denied`。 | 原55条记录完整前缀摘要保持，恢复59条；消息seq43仅一条，未知工具结果仅一条，文件仍为原内容。旧批准未触发写入，不将未知结果误判为完成。 |
| 显式新请求获批并完成后 | 已核对文件后明确发送新任务，新callId/eventId；手机点“允许一次”，真实模型回复 `DSHM_HOST_RETRY_DONE`、官方completed结算。再次结束并恢复电脑后，[原完成回复](../../artifacts/official-plugin-only/0aee6be7-b1b3-4eb9-963c-1fd30e8305b4/host-restart-settled-restored.png)及草稿保持，零旧审批。 | 新用户消息seq63仅一条，实际write结果seq76仅一条，助手seq80；原75条前缀保持至84条。再次重启后85条，原84条逐项相同，仅追加官方session/end-seed；消息、调用、结果与已写入文件保持，不自动重放。 |

已结算新事件再次提交相反决定为官方幂等成功空操作，完整记录与文件保持。自己的文件先恢复，再由正式收尾检查删除；权限恢复工作区内修改，测试授权撤销，网关关闭。`hostRestartVerified/passed/cleanupCompleted=true`，零页面异常/清理失败，原App PID5147、安装路径/APK摘要前后相同，原Key/绑定/历史不读写。

[首轮协议专项](../../../backend/artifacts/official-plugin-only/official-android-16bf8fda-f382-40ce-b22f-af551b3e59bc.json)81.420秒验证了两次实际Host退出及记录保持，但截图发现手机把interrupted误显示为已完成，因此不能作为修复后视觉通过。[RemoteTurnProcess](../../src/ui/RemoteTurnProcess.jsx)现在显示本地化“已中断”，不显示成功用时，并保持执行过程展开；只在DSHM手机构建中引用自有组件，原上游文件、电脑安装及SDK保持只读。[主聊天/旁栏八状态展示回归](../../artifacts/latest-turn-process-host-restart-main-aside.json)通过；属于浏览器回放，不替代本节真实Android证据。

修复只构建DSHM：Web候选构建、独立Android `assembleDebug/lintDebug`通过（1分37秒）；新版APK13346043字节，安装摘要与原App保护见[安装记录](../../artifacts/official-android-build/official-app-before-approval-sending.json)。473项手机Node测试、后端显式TypeScript和相关驱动语法通过。[新版真实核心回归](../../../backend/artifacts/official-plugin-only/official-android-4b021848-6cdd-4163-b372-3bf26031a28e.json)40.771秒继续验证真实聊天、原工作区新建、模型、write允许/拒绝、重连及撤权。没有重建插件、网关或官方DSH/SDK。

两份严格复验失败保留并清理成功：[工具节点定位失败](../../../backend/artifacts/official-plugin-only/official-android-3fc9c79c-f54b-49d2-876d-afcfb34a0dc6.json)73.394秒实际已显示中断与未知结果，驱动却查找不属于原工具视图的备用details；[重读模型的短暂状态](../../../backend/artifacts/official-plugin-only/official-android-a28cfed1-2ac0-44ae-bbd5-3eef970c6e32.json)45.019秒抢在模型名称恢复前断言。修正真实节点定位并等待原模型加载后整轮通过，同一个APK复用，失败不覆盖。首次Gradle命令因PowerShell参数未引用而失败，修正调用后构建通过，不涉及产品逻辑或DSH构建。

聊天内原工具长错误说明会随插件外层等比例缩放，完整内容应从留在缩放框外的“工具详情”打开，不改造插件内部布局。[详情入口整轮复验](../../../backend/artifacts/official-plugin-only/official-android-46890886-14a5-41cc-bd9a-ff8eb0449680.json)71.486秒及[逐项记录](../../artifacts/official-plugin-only/46890886-14a5-41cc-bd9a-ff8eb0449680/host-restart.json)再次通过等待/结算后Host退出、原历史及草稿保持、旧审批拒绝和显式新审批单次执行；实际点击自己的原节点详情按钮，[展开完整未知结果](../../artifacts/official-plugin-only/46890886-14a5-41cc-bd9a-ff8eb0449680/host-restart-waiting-detail.png)，正常14px文本，截图已核对。[首轮详情定位失败](../../../backend/artifacts/official-plugin-only/official-android-b4a3d855-315c-4460-8abd-a7a494551c07.json)70.650秒误把详情入口当作缩放框内子节点，记录与清理保留；按真实ChatNodeSeat外层入口修正测试后通过，没有再次修改产品或构建APK。

环境[收尾记录](../../artifacts/official-plugin-only/host-restart-final-restoration.json)核对正常官方16955新Host56216/启动PID52892仍运行；原16901服务30912与映射保持，测试16956无监听/映射、独立UID已停止、私有下载为空且保存记录目录不存在。原App正常Launcher返回同一RemoteActivity前台，Status ok/HOT、PID5147和安装文件摘要保持；不读取或写入原Key/绑定/历史。

互斥开关 `DSHM_OFFICIAL_HOST_RESTART_CHECK=1` 与其他审批恢复专项；同时开启Android、真实模型与App检查，明确提供经观察的测试启动PID和正常pnpm CLI路径。[外部生命周期](../../../backend/tests/support/official-host-lifecycle.ts)防止结束日常Host，并在失败收尾恢复停止中的测试Host。本节仅覆盖普通write等待与结算后电脑进程树结束；普通write答复在途/确认丢失见下节，其他工具/提问/计划及其他系统回收策略仍待验。结果未知不能自动重试，尤其不能推断任意副作用未发生；本次自己的磁盘结果由独立读取核对。

## 普通write审批答复断线与确认丢失

状态：正常官方 `0.2.1-alpha.1`、生产中转和真实Android自有Remote通过；维护角色DSHM协作Agent，核验2026-10-09。[完整专项](../../../backend/artifacts/official-plugin-only/official-android-c93d2a9a-f999-411f-bcf6-a04b9725e9e6.json)52.288秒、十手机阶段，[逐项手机记录](../../artifacts/official-plugin-only/c93d2a9a-f999-411f-bcf6-a04b9725e9e6/approval-sending.json)核对真正的手机批准帧、官方结果、文件及完整原历史前缀。手机PID29703全程不变，自动重连后保持原会话、未发送草稿和DeepSeek-V4-Pro；零iframe、零页面异常。

采用[外部HTTP/WebSocket测试转发口](../../../backend/tests/support/official-approval-transport.ts)：公共地址仍16956，真实生产网关只在本专项监听16957。正常转发鉴权、票据和原始帧，不修改网关或DSH方法，不伪造审批或回执；仅按真实事件归属匹配自己的eventId/callId/clientId，并在明确的两个传输位置中断手机连接。它比在网关收到请求后再结束进程更能明确区分“未送达”和“确认丢失”，避免时间竞争。确认丢失场景等待实际生产 `result {ok:true}`，扣留该原始帧并切断连接；电脑是否执行仍由正式记录和磁盘核对，不用接收回执替代实际写入。

| 中断位置 | 实际手机恢复与答复 | 官方记录和文件 |
| --- | --- | --- |
| 手机“允许一次”尚未转发 | 真实批准帧未转发，无电脑回执；离线后旧操作撤下/禁用。恢复同一eventId/callId、新clientId的原审批，再由手机显式拒绝；旧批准不会自动重发。 | 离线和刚重连时原55条事件逐项相同、原消息seq43仅一条、零升级write结果、文件未改变；明确拒绝后唯一结果seq56、63条记录，真实模型完成拒绝答复，文件保持。 |
| 电脑已接收，手机未收到真实确认 | 只转发一次批准，实际 `ok:true` 确认被扣留。电脑在手机离线期间完成真实写入；手机自动重连显示原完成回复，零旧审批、无再次批准或执行。[实际页面](../../artifacts/official-plugin-only/c93d2a9a-f999-411f-bcf6-a04b9725e9e6/approval-sending-after-receipt-restored.png)已查看。 | 原78条事件前缀保持，消息seq67仅一条、升级write结果seq79仅一条，结算87条。写入内容独立核对；恢复后事件/结果和文件不重放。 |

两项再由另一真实观察连接提交相反旧答案，官方幂等成功且完整记录保持；不冒充双手机同时点击。自己的两个文件先恢复再经收尾检查删除，权限恢复工作区内修改，测试设备撤销；`approvalSendingVerified/passed/cleanupCompleted=true`，零清理失败，外部转发口和生产网关均关闭。此证据只覆盖普通write批准未转发与确认丢失，不扩展到全部审批类型、任意副作用或所有传输阶段。

首两轮实际失败保留：[首轮](../../../backend/artifacts/official-plugin-only/official-android-57fb3081-bf13-4206-acc3-b3ca57161deb.json)87.528秒与[带只读诊断复现](../../../backend/artifacts/official-plugin-only/official-android-b739e6a5-7802-4b7e-9add-9971f790a6dd.json)92.334秒，均清理成功。原批准没转发、文件未变，但真实票据200和新载体ready后，App仍反复重连。排除转发口未恢复及旧连接占用；原因是[RemoteTransport](../../src/remote-transport.mjs)在新载体尚未确认能力时，把订阅本地前置错误 `remote_not_connected` 当作新的Host断线，递增世代并使正在进行的协商失效。仅修正DSHM：载体在线且能力尚未确认时不由该本地错误中止协商；真正的远端断线仍取消旧操作，不自动重发写入。[两个实际调用入口的回归](../../tests/remote-transport.test.mjs)修复前因 `remote_generation_changed` 失败、修复后通过，全部474项规定Node测试通过。一次未限定范围的 `node --test` 错误扫描了浏览器产物，不作为正确项目套件结果；随后按项目 `tests/*.test.mjs` 范围完整通过。

只重建变化的DSHM Web与独立 `.officialtest` App，`assembleDebug/lintDebug`1分45秒通过；当前APK13346074字节、SHA `28d47c94f2e35d0f625dafc2e46796ccf541ed5f174504261db9dd495a219fa8`，实际[安装回执](../../artifacts/official-android-build/official-app.json)核对原App身份保持。上轮APK与回执归档为[旧APK](../../artifacts/official-android-build/app-before-approval-sending-70f4ddee.apk)和[旧回执](../../artifacts/official-android-build/official-app-before-approval-sending.json)。同一新APK的[正常核心整轮](../../../backend/artifacts/official-plugin-only/official-android-78776e52-a35e-4bc1-b5b6-f2eddca5cdd2.json)39.055秒、十手机阶段通过真实回复/选模、write批准/拒绝、草稿重连、已有工作区新建与撤销拒绝；零页面异常、清理成功。本轮没有修改或构建DSH/SDK/插件/网关，复用原官方Host56216与正常启动入口。

[手机驱动](../../tests/support/official-approval-sending.mjs)只订阅现有载体的closed/ready状态，诊断监听在finally释放，不记录凭据或替换产品方法。互斥开关 `DSHM_OFFICIAL_APPROVAL_SENDING_CHECK=1` 配合Android/真实模型/App检查；两个精确中断及清理在独立报告中记录，常规专项仍直接运行生产网关16956。其他审批类型、Host同时退出和其他在途操作继续单独验收。

[最终恢复检查](../../artifacts/official-plugin-only/approval-sending-final-restoration.json)核对原App PID5147、安装路径和APK摘要保持，正常Launcher返回原RemoteActivity，Status ok；自己的UID停止、私有下载为空、保存记录不存在。16956和16957均拒绝连接且测试映射移除；原16901服务30912/映射和官方16955 Host56216保持。原Key、绑定和历史不读取/复制；四轮通过或失败的cleanupCompleted分别核对，失败不覆盖。

## 手机计划正文、批准与要求修改

[完整专项](../../../backend/artifacts/official-plugin-only/official-android-3e12b1e5-e3dc-4a2a-bbb4-177fd1862851.json)32.896秒、十阶段通过；[手机逐项报告](../../artifacts/official-plugin-only/3e12b1e5-e3dc-4a2a-bbb4-177fd1862851/plan-review.json)经实际菜单开启官方计划模式，真实模型单次调用 `exit_plan_mode`。原计划插件自动打开正文面板；手机实际显示标题/正文，点击返回聊天后操作原审阅卡片。点击“同意执行”后，同一工具成功、活动问题清空、下一步官方 plan/mode退出，真实模型回复确认。另一轮点击“要求修改”后，官方按取消审阅返回工具错误、模型停止等待新要求，计划模式保持开启；手机随后关闭计划模式，官方投影 `{active:false,pending:false}`。

[驱动](../../tests/support/official-plan-review.mjs)核对官方工具参数与手机正文，不生成工具事件、不把“要求修改”伪造为批准或 Keep planning 选项。两轮都只规划并回复标记，没有执行计划里的文件修改。零页面异常、cleanupCompleted/testPlanModeRestored=true，原App PID23468/路径/摘要保持；复用同一Host/APK，未修改产品或构建DSH/SDK/插件/App。专项开关 `DSHM_OFFICIAL_PLAN_CHECK=1` 与其他扩展互斥。计划审阅中的断线、跨端决定竞争及带实际执行的复杂计划仍需独立验收。

三次测试失败均保留并清理成功：[第一轮](../../../backend/artifacts/official-plugin-only/official-android-ba894c61-7507-4390-a285-48084e7eb54f.json)提示没有明确参数边界，模型把外围指令也写入计划；改为完整JSON参数后内容核对通过。[第二轮](../../../backend/artifacts/official-plugin-only/official-android-61ecd359-9242-45df-99ce-e17ca0395204.json)忽略原插件自动打开的正文面板，点击被面板遮挡；改走正常查看/返回流程，不强制点击。[第三轮](../../../backend/artifacts/official-plugin-only/official-android-14931f2f-1401-4e3b-bb1e-fe842f3fe027.json)测试把 pending 证据对象当作布尔状态，实际已经批准并退出；证据字段与状态检查分离后整轮通过。均为测试修正，没有修改DSH或手机产品。

本轮最终校验：后端显式TypeScript与三个相关Android驱动语法检查退出0，165篇Markdown/9866本地链接通过，官方包审计290包/6263文件SHA全部保持。测试网关与16956反向映射关闭，官方16955保留运行，原App身份保持。

## 完成通知、系统点击与App进程结束后的恢复

[完整专项](../../../backend/artifacts/official-plugin-only/official-android-2b429871-9949-4ffd-b6a2-90cc34e71cae.json)Vitest 120.696秒、十三手机阶段通过；[手机逐项报告](../../artifacts/official-plugin-only/2b429871-9949-4ffd-b6a2-90cc34e71cae/task-notifications.json)交叉核对官方真实回复、唯一用户消息/工具结果/完成事件与Android通知。当前可见会话的完成不重复提醒；切到后台、进程仍运行时只收到一条通知，真实会话标题与模型回复摘要正确，点击系统通知进入原会话、消费通知，零iframe。保留[实际系统通知截图](../../artifacts/official-plugin-only/2b429871-9949-4ffd-b6a2-90cc34e71cae/notice-background-system.png)。

第三次真实任务的只读命令运行期间，用 `am force-stop` 结束独立 `.officialtest` App，结束前后均证明电脑任务仍在运行。电脑自然完成后，手机进程保持不存在、无通知，并继续观察5秒。经正常Launcher重新打开后，PID1068→3025；普通聊天首页只有自己的WebView，尚未进入Remote时原生通知连接已恢复，观察5秒没有历史补发。随后从抽屉进入Remote原会话，真实结果可见、输入为空；官方同一消息/结果/序号保持，未重发模型请求。中转停用/恢复后无重复提醒，再运行新任务仍收到一条新通知并正确跳转。

[驱动](../../tests/support/official-task-notifications.mjs)只操作拥有的独立UID，通知编号按原[原生ledger](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeLedger.kt)与官方完成事件对应。15秒只读 `pwsh` 窗口用于证明进程在结算前已经结束；没有构造事件、修改通知投影、延迟回执或替换生产函数。零页面异常、cleanupCompleted=true，测试授权撤销、会话权限恢复、网关与16956映射关闭；原凭据App PID23468/路径/APK摘要保持。专项开关 `DSHM_OFFICIAL_NOTICE_CHECK=1` 与其他扩展互斥，复用同一官方Host/APK，没有构建DSH、SDK、插件或App。

两次失败保留且清理成功：[第一轮](../../../backend/artifacts/official-plugin-only/official-android-735b9bc7-de79-4a3b-9d11-736dbb54be27.json)79.129秒，官方可写沙箱的 `SetNamedSecurityInfoW/grantWrite` 返回Win32 5，命令没有实际运行；手机正常切成只读权限后命令通过，不修DSH或Windows目录ACL。[第二轮](../../../backend/artifacts/official-plugin-only/official-android-0ceb294c-94f6-49c4-96ad-66e038c6bfa6.json)45.075秒，实际通知已送达，测试误把原生JSON数组编号写成冒号拼接；按原实现修正匹配后整轮通过。

本轮只覆盖真实任务完成通知。其他会话的前台横幅、失败/受阻类别、多个通知同时存在及其他设备策略仍待验；`am force-stop` 不等于所有系统回收策略。纯官方 `taskPendingNotifications=false`，不提供汇总待审批/提问通知；聊天内审批/提问能力不受影响。Host进程结束和发送在途异常另验。

## 文件下载中断与最新完整原件重试

[完整专项](../../../backend/artifacts/official-plugin-only/official-android-5075ae19-2434-4f22-9e11-bf373e1731ea.json)Vitest 72.830秒、十二手机阶段通过；[逐项报告](../../artifacts/official-plugin-only/5075ae19-2434-4f22-9e11-bf373e1731ea/file-recovery.json)使用自己的16 MiB工作区文本原件、实际下载按钮和App私有暂存。主动取消与中转停用均在196608字节暂存已经写入后执行；暂存删除、无系统保存窗口/目标文件，断线显示失败，恢复连接后观察2秒不自动重试旧下载。

第三次下载在262144字节暂存写入后，电脑给自己的原件追加58字节；手机显示文件变化错误、清理旧暂存，不交付混合版本。经原下载按钮手动重试，完整暂存才进入Android系统保存窗口，保存的16777274字节与电脑最新原件SHA-256 `42a98352f4948c363f34b2b38518cb2f04e467137f9bfd1ed0aab872010f5b71`一致；[实际保存成功截图](../../artifacts/official-plugin-only/5075ae19-2434-4f22-9e11-bf373e1731ea/file-recovery-saved.png)保留。返回聊天草稿不变，随后重连、新建已有工作区聊天、撤销拒绝同轮通过；零页面异常、cleanupCompleted=true。手机目标及电脑原件在摘要核对后删除，私有暂存为空、设备撤销、独立UID停止、16956网关/映射关闭，原App PID23468/路径/摘要保持。

[驱动](../../tests/support/official-file-recovery.mjs)不替换文件服务、不延迟回执或伪造中断；修改只作用于本轮生成的原件，通过尺寸变化验证下载版本一致性，不声称解决官方同大小/mtime文件监听缺口。开关 `DSHM_OFFICIAL_FILE_RECOVERY_CHECK=1` 与其他专项互斥，复用原Host/APK，没有构建DSH、SDK、插件或App。系统保存窗口后续验收见[下节](#系统保存窗口取消断线与显式重试)；附件、目标写入过程中断、撤权、进程结束、分享实际接收者仍需纯官方专项。

[首轮失败](../../../backend/artifacts/official-plugin-only/official-android-cf170f7c-9275-43b5-841d-ec88e60e88bd.json)在测试框架逐项比较16 MiB Buffer时耗尽4 GiB Node堆，未运行正常finally，不计通过或正常清理。改用Buffer.equals后整轮通过；[单独恢复报告](../../../backend/artifacts/official-plugin-only/file-check-recovery-cf170f7c-9275-43b5-841d-ec88e60e88bd.json)与[恢复脚本](../../../backend/scripts/recover-official-file-check.mjs)核对明确本轮会话/工作区/设备创建时间、文件摘要和独立UID，清理成功，原失败记录保持。

本轮最终校验：后端显式TypeScript与三个相关JS语法检查退出0，165篇Markdown/9895本地链接通过，两仓Git diff检查退出0（仅既有CRLF提示）；官方290包/6263文件SHA保持，16955同Host46632继续运行，16956无监听/无映射，原App PID23468保持。

## 系统保存窗口取消断线与显式重试

[真实专项](../../../backend/artifacts/official-plugin-only/official-android-1308b202-23aa-41d6-8edc-5e43477b2618.json)Vitest 71.610秒、十一手机阶段通过；[逐项报告](../../artifacts/official-plugin-only/1308b202-23aa-41d6-8edc-5e43477b2618/save-window.json)证明262149字节原件已完整写入App私有暂存，实际Android位置选择窗口已打开，再分别执行系统返回与电脑连接停用。系统返回显示取消且清理完整暂存；停用后原系统窗口关闭、暂存清理、无目标文件，手机显示下载失败。[断线后实际画面](../../artifacts/official-plugin-only/1308b202-23aa-41d6-8edc-5e43477b2618/save-window-disconnect-closed.png)保留。

恢复原连接后观察2秒无自动下载或旧窗口复活；经原按钮显式重试，在真实系统窗口选下载目录并保存。手机目标262149字节、SHA-256 `1b221de5e0421dfc175f628cc39fdbc2e898952e90800a9b88a88472576c4f11`与电脑原件一致；[保存成功画面](../../artifacts/official-plugin-only/1308b202-23aa-41d6-8edc-5e43477b2618/save-window-saved.png)保留。窗口与暂存释放、聊天草稿保持，测试目标经摘要核对后删除。[驱动](../../tests/support/official-save-window.mjs)只操作自己的UID/原件/目标，不更换保存provider、不延迟原生回执、不伪造URI或响应。互斥开关为 `DSHM_OFFICIAL_FILE_SAVE_CHECK=1`。

[修复前失败](../../../backend/artifacts/official-plugin-only/official-android-42fa5a95-d54e-4fbb-aa65-936bca7f6c6d.json)52.741秒：系统返回已经通过，但断线20秒后仍显示“请选择保存位置…”。原失败报告保留，正常finally清理完成。原因是[生产中转](../../../backend/packages/gateway/src/hub.ts)在电脑退出时保留手机socket，只给原请求返回 `host_disconnected_outcome_unknown`；[手机通信边界](../../src/remote-transport.mjs)原本仅对socket closed/ready更换传输生命周期，完整下载后的本地保存等待因此没有取消。

两种可行处理是中转在电脑退出时关闭手机socket，或手机识别已有的电脑断线错误并结束本地传输。选择后者，保持中转协议与只读订阅恢复流程，修改范围限于DSHM。RPC/订阅发现明确断线时取消当前生命周期，同一连接只处理一次；重连前旧请求的迟到错误按代次忽略，不能取消恢复后的保存。能力快照保留供已有聊天显示，写入不自动重放。[回归](../../tests/remote-transport.test.mjs)在修复前分别复现未取消及迟到错误取消新生命周期，修复后订阅/RPC两个入口、再次断线、原生abort及旧错误隔离均通过；手机全部473项Node测试通过，包含下载/附件/转换缓存/上传。

只重建发生变化的DSHM Web与独立 `.officialtest` App，APK 13346017字节、SHA-256 `1dfae5f65f50ed2abd74fb637387e0065e9f06bc03be39f4a8a9a01c1fdfd123`；assembleDebug/lintDebug 1分35秒成功。首次Gradle调用缺SDK地址失败，指定本机已有 `ANDROID_HOME` 后通过，未改变官方DSH或SDK。旧APK及回执保存为[旧包](../../artifacts/official-android-build/app-before-save-window-29f96c85.apk)和[旧回执](../../artifacts/official-android-build/official-app-before-save-window.json)，当前[安装回执](../../artifacts/official-android-build/official-app.json)核对安装后的实际摘要及原App身份。

新APK另行完成[核心回归](../../../backend/artifacts/official-plugin-only/official-android-2f2adff1-9ed0-419e-b323-84a7aa1364a2.json)42.627秒、十手机阶段：真实回复、模型同步、write批准/拒绝、草稿/聊天重连、已有工作区新建及撤销拒绝通过，`coreInferenceVerified=true`。两轮零页面异常、cleanupCompleted=true/零清理失败，原App PID23468/路径/摘要保持，自己的原件/手机目标/暂存和测试授权均清理。

最终核对165篇Markdown/9920本地链接、两仓Git diff检查通过；290官方包/6263文件SHA保持。16955仍为原Host46632，16956无监听/映射，独立UID停止且私有下载暂存为空；原App PID23468/路径/摘要保持。

本节覆盖系统位置选择等待阶段，尚未覆盖目标文件正在写入时的断线/撤权/进程结束、附件入口、其他保存provider及分享实际接收者。没有修改/重建DSH、SDK、插件或网关，不以本节宣称R16全部通过。

## 手机上传与历史附件预览下载

[完整专项](../../../backend/artifacts/official-plugin-only/official-android-93c1cb23-fd04-45d8-974d-7456facfd3de.json)Vitest 99.045秒、十六手机阶段通过；[附件逐项报告](../../artifacts/official-plugin-only/93c1cb23-fd04-45d8-974d-7456facfd3de/attachments.json)覆盖真实Android系统文件选择、生产上传、同一官方消息的三个附件引用、历史预览及原件系统保存。文本178990字节/5002行、PDF990字节、DOCX911字节，输入和导出副本都逐一核对完整字节与SHA-256。

手机通过原「添加附件 → 选择文件」连续选择自己的三份Download原件，全部上传后只发送一次消息。真实模型 `deepseek-official/deepseek-v4-pro` 读取文本第一行的独有标记；标记没有写入提示词，源文件位于后端测试目录、在DSH工作区之外。官方原用户事件seq39保留三个真实 `sha256:` 附件引用，真实模型回复seq47及轮次完成经独立官方接口核对，没有构造消息或上传回执。

另一个已批准中转读者经实际 `remote.attachment` 分别读取原件，核对会话、附件身份、元数据、偏移、base64、3/1/1个数据块、完整字节及正常结束；每份附件在另一个真实空会话中均被明确拒绝 `remote_attachment_not_referenced`。这证明附件读取受所属会话引用约束，不能仅凭附件ID跨会话下载。

历史附件按钮打开DSHM自己的 `dsh-resource://dshm-attachment/…` 文档面板。[文本截图](../../artifacts/official-plugin-only/93c1cb23-fd04-45d8-974d-7456facfd3de/attachment-txt.png)核对首批5000行、加载至5002行后全部中文/emoji与原文一致；[PDF截图](../../artifacts/official-plugin-only/93c1cb23-fd04-45d8-974d-7456facfd3de/attachment-pdf.png)核对真实画布和可选正文；[DOCX截图](../../artifacts/official-plugin-only/93c1cb23-fd04-45d8-974d-7456facfd3de/attachment-docx.png)使用正常官方Office转换，显示真实PDF画布与“Office preview 中文文档”。逐份从原下载按钮进入实际Android位置选择窗口，保存为不同的export文件名，完整原件大小/摘要与输入一致；DOCX下载的是DOCX原件。三次关闭预览后聊天草稿保持，私有下载暂存为空。

[新驱动](../../tests/support/official-attachments.mjs)严格限制独立 `.officialtest` UID及自己命名/摘要核对的六份手机副本，不替换生产函数、保存provider、模型接口或官方DSH。后端[opt-in入口](../../../backend/tests/official-host.test.ts)增加与其他专项互斥的 `DSHM_OFFICIAL_ATTACHMENT_CHECK=1`，须同时开启Android、真实模型与App检查。产品代码没有改变，复用上一节的同一APK及官方Host，没有构建DSH、SDK、插件、App或网关。后端TypeScript、新驱动语法及实际Android整轮通过。

[首轮失败](../../../backend/artifacts/official-plugin-only/official-android-520fa450-5818-4324-859f-b79af6c41340.json)6.576秒在Android设备枚举处返回 `_android.devices: FAIL`，未进入上传或手机测试，清理成功，失败记录保留。随后正常设备枚举恢复；原App进程不在，模拟器系统运行时长仅424.73秒，证明系统在此前验证后已重启，重启原因未确定。[单独恢复报告](../../artifacts/official-plugin-only/emulator-restart-520fa450.json)先核对原APK路径/摘要不变，再通过正常Launcher打开原App，PID23468→5147；没有重装、清数据、读取或复制凭据。最终核对发现系统重启也清空原16901反向映射，对应本机服务PID30912仍在；恢复原映射并核对准确端口，没有改变App配置。附件专项前后及收尾原App PID5147/路径/摘要保持；此身份核对不替代全部历史及Key内容的逐字节证明。

零页面异常、`attachmentsVerified/passed/cleanupCompleted=true`、零清理失败。摘要核对后删除三份手机输入、三份手机导出及三份后端源文件，测试设备撤销、独立UID停止、16956网关与映射关闭；官方测试会话历史与其引用的附件存储保留为证据。官方290包/6263文件SHA仍与首次基线一致。文本/PDF/DOCX附件已验；图片消息、其他Office附件、HTML附件、引用/转换在途生命周期、目标写入过程中断/撤权/进程结束和分享接收端不计本轮通过。

最终检查165篇Markdown/9940本地链接、两仓Git diff与相关驱动语法检查通过；正常官方16955仍由同一Host46632监听，16956无监听/映射，独立UID停止且下载暂存为空，原16901服务/映射及App保持。

## 系统目标写入时App结束与恢复

[完整专项](../../../backend/artifacts/official-plugin-only/official-android-501328bc-9f38-4081-a8a4-c7ada5bbdb35.json)Vitest 134.687秒、十二手机阶段通过；[逐项报告](../../artifacts/official-plugin-only/501328bc-9f38-4081-a8a4-c7ada5bbdb35/destination-write-death.json)使用64 MiB/67108864字节自己的工作区原件，经生产Remote读取、原生完整暂存与真正的Android系统保存窗口，目标为系统“下载”目录。没有使用调试DocumentsProvider、构造URI、替换下载函数或延迟回执。

外部ADB观察器首次看到目标1638400字节，通过自己UID的OS `SIGSTOP` 固定写入现场，再读到6815744字节，严格少于完整原件。目标摘要与电脑原件相同长度的前缀一致，完整私有暂存摘要与原件一致，生产保存待确认记录确实存在。[实际写入画面](../../artifacts/official-plugin-only/501328bc-9f38-4081-a8a4-c7ada5bbdb35/destination-writing.png)保留。随后对独立 `.officialtest` 执行 `am force-stop`，证明原PID8544消失、实际外部半成品保持；这与“选择位置时退出”是两个不同阶段。

经正常Launcher打开为新PID9688后，[普通首页提示](../../artifacts/official-plugin-only/501328bc-9f38-4081-a8a4-c7ada5bbdb35/destination-death-ordinary-warning.png)说明上次保存结果未确认、目标位置可能有不完整文件，不自动续传或删除已保存文件。系统返回关闭提示不算确认；进入Remote时[同一提示](../../artifacts/official-plugin-only/501328bc-9f38-4081-a8a4-c7ada5bbdb35/destination-death-remote-warning.png)仍出现。原绑定自动重连、同一会话35条官方记录的完整序列化摘要保持，原草稿恢复，私有下载暂存清空；外部目标半成品仍是同一字节前缀，不能把保留的目标说成已经清理。

再次正常结束/打开仍显示未确认提示；点击“知道了”后生产待确认记录清空，再次打开不再提示。回到原会话后观察2秒，没有自动下载、保存窗口或目标重写。经原下载按钮显式重新读取，在真正的系统窗口另存为retry文件，[保存成功画面](../../artifacts/official-plugin-only/501328bc-9f38-4081-a8a4-c7ada5bbdb35/destination-death-explicit-retry-saved.png)保留。完整67108864字节及SHA-256 `b33d88d723174ef86c2fb85d22ebb72d87fee9d4aa4c41ee13a4f401e638af82`与电脑原件一致，原半成品不被覆盖，官方历史摘要/聊天草稿保持，私有暂存和待确认记录为空。

[驱动](../../tests/support/official-destination-write-death.mjs)只观察本轮命名的真实目标、冻结/结束自己的UID；异常时先恢复自己进程的调度，再按长度/前缀摘要核对后清理自己的目标。[后端编排](../../../backend/tests/official-host.test.ts)独立核对电脑原件及官方历史，互斥开关为 `DSHM_OFFICIAL_FILE_WRITE_DEATH_CHECK=1`，同时需Android、真实模型及App检查。正常整轮包含实际模型回复/选模、重连、新建已有工作区会话和撤销拒绝；零页面异常，`fileWriteDeathVerified/passed/cleanupCompleted=true`，零清理失败。两份手机目标和电脑原件在验证后精确清理，独立UID停止、测试授权撤销、16956网关/映射关闭。原App PID5147/安装路径/APK摘要前后相同，原Key/绑定/数据不读写。

本轮仅补充测试，复用同一官方Host及APK，不修改产品或构建DSH、SDK、插件、App、网关。目标写入时取消/断线/撤权后续已按[下节](#系统目标写入时取消断线与撤权)独立验收；其他保存provider、保存成功回执竞争、自然系统回收与设备重启仍待验。不能把本次受控 `SIGSTOP` 后 `force-stop` 扩大成全部进程回收行为。此前调试provider的原生测试和修改版DSH报告不作为本节证据。

最终检查165篇Markdown/9959本地链接、两仓Git diff与相关JS语法检查通过，后端TypeScript退出0；官方290包/6263文件SHA不变。16955同Host46632、原16901服务PID30912及映射保持，16956无监听/映射；独立UID私有下载及保存记录为空，原App PID5147保持。

## 系统目标写入时取消断线与撤权

状态：正常官方 `0.2.1-alpha.1`、同一生产中转和已安装Android App的实际入口通过；核验2026-10-09，维护角色为DSHM协作Agent。只新增[手机验收驱动](../../tests/support/official-destination-write-interruption.mjs)与[后端编排](../../../backend/tests/official-host.test.ts)，复用现有Host和APK，没有修改或构建DSH、SDK、插件、App或网关。

[取消/断线/重试整轮](../../../backend/artifacts/official-plugin-only/official-android-926ab524-21ba-4b1d-be22-1e737ea334af.json)159.762秒、十一手机阶段通过；[撤权整轮](../../../backend/artifacts/official-plugin-only/official-android-e8130c12-cce6-4554-9d14-c90d53a76a92.json)69.131秒、九阶段通过。两轮均先验证真实模型回复、手机选模及官方历史同步，再从实际文件面板下载自己的64 MiB原件，经原生完整暂存和真正的系统保存窗口写入正常“下载”目录。没有调试provider、构造URI、替换生产函数、直接调用abort或延迟回执。

外部ADB观察器仅在自己的目标文件大于0且小于67108864字节时，以自己UID的OS `SIGSTOP` 固定写入现场；完整私有暂存与电脑原件SHA一致，真实外部半成品与电脑相同长度前缀SHA一致，生产保存待确认记录存在。恢复调度后仍由原按钮、生产连接与原生取消逻辑处理，不把保存先完成的竞争误计为取消成功。

| 实际入口 | 已写入的目标字节 | 实际结果 |
| --- | --- | --- |
| 原“取消下载”按钮 | 5767168 | [已取消下载](../../artifacts/official-plugin-only/926ab524-21ba-4b1d-be22-1e737ea334af/destination-write-cancel.png)；目标半成品、私有暂存及待确认记录均清理，App同一PID12046保持。 |
| 生产插件关闭Host连接 | 8912896 | 独立生产读者先确认 `host_offline`，恢复App后显示下载未完成；同样清理三类文件，重连后不自动重新保存。 |
| 桌面插件撤销本轮设备 | 6225920 | [连接授权已失效](../../artifacts/official-plugin-only/e8130c12-cce6-4554-9d14-c90d53a76a92/destination-write-revoke.png)，聊天/文件面板退出，三类文件清理；同一PID15203保持，随后重新连接被拒绝，不自动重试。 |

[取消/断线逐项记录](../../artifacts/official-plugin-only/926ab524-21ba-4b1d-be22-1e737ea334af/destination-write-interruption.json)还核对同一会话35条官方原记录的完整序列化摘要和原件保持。断线恢复观察2秒无下载、目标重写或系统窗口；原按钮显式重试后的[实际保存](../../artifacts/official-plugin-only/926ab524-21ba-4b1d-be22-1e737ea334af/destination-write-retry-saved.png)为完整67108864字节，SHA-256 `103fa50227492d912753ae928f64765ad7d09ebc3ba48211720722a86ba97840`与电脑原件一致，原草稿保持，私有暂存/待确认记录为空。[撤权记录](../../artifacts/official-plugin-only/e8130c12-cce6-4554-9d14-c90d53a76a92/destination-write-revocation.json)独立核对原会话历史和原件保持，不借用后续常规撤销冒充写入中撤权。

互斥专项开关为 `DSHM_OFFICIAL_FILE_WRITE_INTERRUPTION_CHECK=1` 与 `DSHM_OFFICIAL_FILE_WRITE_REVOCATION_CHECK=1`，同时需Android、真实模型和App检查。两轮 `passed/cleanupCompleted=true`，对应专项Verified为true，零页面异常/清理失败；实际模型、重连、已有工作区新建与撤销拒绝均通过。自己的手机目标/电脑原件按长度与摘要核对后清理，测试设备撤销、独立UID停止、中转16956与映射关闭。原App PID5147、安装路径与APK摘要前后相同，原Key/绑定/数据不读写。

本节只证明默认系统Downloads的真实写入中取消、Host断线、设备撤权与完整原件手动重试。其他保存provider、目标写入失败且删除被拒绝、保存成功回执竞争、自然系统回收/设备重启、其他附件格式和分享接收端仍待独立验收，不能因此标记R16整体完成。进程结束时保留外部半成品的行为仍按上节说明，与本节进程存活时的实际删除不同。

最终文档校验165篇Markdown/9984本地链接、两仓Git diff及相关JS语法通过，后端TypeScript退出0；官方290包/6263文件SHA不变。16955原Host46632、原16901服务30912及映射保持，16956无监听/映射，独立UID私有下载与保存记录为空；原App经正常Launcher回到前台、PID5147保持。[收尾记录](../../artifacts/official-plugin-only/destination-write-interruption-final-restoration.json)保留首次仅指定package的Launcher Intent无法解析，以及由系统解析实际Launcher组件后Status ok/HOT、原RemoteActivity前台的结果；shell退出0不被当作启动成功。

## 入口删减与未验证范围

[RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx)主聊天/旁栏共用菜单仅在相应协商能力为 true 时显示「在电脑应用中打开」「待处理」。能力缺失时的文案不再要求兼容补丁。预设归档复制/删除、动态运行器及精确前台输出的原能力门控保留，聊天内普通审批不受汇总待办能力影响。

以上通过不代表全部管理、插件作者的任意局部界面、后台停止/大输出/断线恢复、其他通知类型、文件格式及所有操作的竞争/在途异常通过。普通 write 等待时中转断线与相反答复竞争的实际范围以上节为准。继续按纯官方矩阵逐项验收；不能实现的扩展取消，核心缺口须保留并提出上游接口需求。历史 SDK11 的未完成资源恢复仍登记在当前决定，不以重打包 DSH 作为手机功能前置条件。

测试入口位于[后端](../../../backend/tests/official-host.test.ts)，仅显式设置 `DSHM_OFFICIAL_ANDROID_CHECK=1` 才运行；真实模型另设 `DSHM_OFFICIAL_INFERENCE_CHECK=1`，新手机包另设 `DSHM_OFFICIAL_APP_CHECK=1`。提问/完成命令专项加 `DSHM_OFFICIAL_EXTENSION_CHECK=1`，后台专项加 `DSHM_OFFICIAL_JOB_CHECK=1`；两个专项开关互斥、单独记录，不能冒充审批整轮。`DSHM_ANDROID_SERIAL` 固定当前MuMu `127.0.0.1:16384`，ADB路径通过 `DSHM_ADB_PATH` 指定。需正常官方 Host、已在其独立配置页保存的模型凭据和对应测试APK；不读取或复制原用户 Key。

## 完整文件分享的实际接收

2026-10-10，未修改官方alpha.2、独立插件0.1.80和既有Android验收App，在实际系统分享面板选择独立接收器，完整读取168961字节TXT；文件名与摘要匹配电脑原件，写入和无关URI访问被拒绝。本轮13个Android阶段通过，接收器与本轮下载/分享副本已清理，原App/Key/绑定/历史及官方源码保持。此前各节的“没有选择接收者”仍是对应历史专项的边界，现已由本轮补充；其他格式、接收应用及分享在途异常未因此通过。详细实现、首轮定位失败、完整结果和71轮恢复核对见[alpha.2分享验收](../../../plugin/compatibility/latest-upstream/official-alpha2.md#完整文件分享的实际接收2026-10-10)。

## 交付文件卡片与电脑原生打开

2026-10-10在纯官方0.2.1-alpha.2、独立插件0.1.80及真实Android下复验。修复文档服务异步加载导致交付卡片未注册的问题，并补齐新版卡片及变更预览的公开接口；只修改和构建DSHM，保留原App。

[完整交付专项](../../../backend/artifacts/official-plugin-only/official-android-5937343e-6f01-4888-aea0-24fefe4e4a7f.json)16阶段通过：真实present记录与回复、手机卡片、实际侧栏预览、记事本完整文档及Explorer原文件选中、取消与原件保持均核验；工作区打开的取消/变化/缺失防护也通过。[同APK核心](../../../backend/artifacts/official-plugin-only/official-android-f015fd19-b826-462f-a213-bb05e61eb2be.json)十阶段通过真实聊天、模型切换、允许/拒绝审批、新建及重连。

[新版证据和失败边界](../../../plugin/compatibility/latest-upstream/official-alpha2.md#交付卡片与电脑原生打开2026-10-10)及[74轮恢复核对](../../artifacts/official-plugin-only/turn64-restoration-audit.json)分别记录；旧选择器/诊断失败保留，不计成功。当前测试APK及摘要见[构建记录](../../artifacts/official-alpha2-android-build/deliverables-build.json)，没有覆盖原用户App。其他文件关联程序、Electron或其他生命周期仍按具体范围另验。

## 审批前计划修改与完成后的差异

正常官方alpha.2、独立插件0.1.80和既有APK下，手机从真实待审批write进入自己的侧栏，查看拟写入内容及未修改的完整原件，返回同一审批；允许后从完成卡片打开原整轮差异，单/双栏、换行、当前文件、关闭重开与草稿保留通过。另一请求拒绝后原文件保持、无工具重试。最终[11阶段真实报告](../../../backend/artifacts/official-plugin-only/official-android-3860c413-7aef-44cf-817e-cda4fbcbf7c4.json)及[官方记录/截图与失败边界](../../../plugin/compatibility/latest-upstream/official-alpha2.md#计划修改与实际整轮差异2026-10-10)有独立依据；本轮仅修改验收代码，不打包任何产品。

write计划预览遵循官方规则，只显示拟写入内容；原文件内容在“最新完整文件”独立核对。实际完成差异来自官方workspace/changes及公开summary/diff，不能用计划预览代替。最终两个自有文件已按原字节删除，授权/临时服务清理；[76轮恢复审计](../../artifacts/official-plugin-only/turn65-restoration-audit.json)确认原App正常前台、Key公开状态、绑定/历史和官方文件保持。多文件、二进制、大记录、过期及其他读取生命周期另验。

## 长聊天记录的加载与恢复

普通会话52轮真实模型回复形成三页历史；手机从最新窗口实际点击“加载更早的消息”，补齐503条官方原事件，52轮用户消息与回复各显示一次。加载时原消息位置最大偏移不到0.5px，草稿保持。后续真实write允许/拒绝后，正常断线重连再次补齐559条完整原事件，包含实际工具结果；同一聊天和未发送草稿保持。

[12阶段真实报告](../../../backend/artifacts/official-plugin-only/official-android-c0956c21-99f1-4838-b726-6bdd9a02c439.json)150.737秒通过，零页面/隔离渲染错误；[官方分页核对与证据边界](../../../plugin/compatibility/latest-upstream/official-alpha2.md#长聊天分页与重连2026-10-10)有逐条事件和实体消息位置依据。本轮只增加验收代码，App/插件/网关与官方Host均复用；两个专用文件已清理，[原App及官方文件恢复](../../artifacts/official-plugin-only/turn66-restoration-audit.json)通过。加载在途切换/撤权、进程结束与超大或嵌套记录另验。

## 加载历史时切换聊天与断线

两条真实历史分页请求各已从官方Host返回225条事件、但尚未送达手机时，实际从原导航切换聊天或关闭远程连接。切换后旧回执仍送达，另一聊天完整原事件、草稿保持，手机已发送真实cancel，无迟到错误；断线后原聊天/草稿恢复，没有自动重发旧分页，用户显式加载后补齐三页561条完整原事件。源专用聊天保持只读，原52轮真实回复各显示一次。

[13阶段真实报告](../../../backend/artifacts/official-plugin-only/official-android-a663b3c6-7d7c-4965-a564-eae6cc12eabd.json)61.414秒通过，实际write允许/拒绝与其他核心回归保持；[透明传输、原回执及失败边界](../../../plugin/compatibility/latest-upstream/official-alpha2.md#历史分页回执在途切换与断线2026-10-10)逐项记录。本轮只增加验收代码，未改官方DSH或重新打包产品；[恢复审计](../../artifacts/official-plugin-only/turn67-restoration-audit.json)确认原App/Key公开状态/绑定/历史、前台和官方文件保持。撤权、进程结束、其他类型及超大窗口仍按实际范围另验。

## PTC程序与内层命令

状态：已核验限定场景；维护：DSHM兼容验收；最近核验：2026-10-10。手机在已有工作区新建聊天，选择PTC及仅可查看权限，发送程序后能显示根工具、内层pwsh和真实输出/返回；在内层等待时通过空输入的停止键结束执行，官方根与内层各结算一次，终态aborted/user，没有自动补做。原父聊天草稿、历史前缀与全局配置保持。实际入口由[手机验收](../../tests/support/official-ptc.mjs)和[原记录核对](../../../backend/tests/support/official-ptc.ts)验证，11阶段真实事务退出0，全部产品复用。

详细报告、测试脚本失败记录及原PowerShell受限模式/乱码警告见[新版PTC专项](../../../plugin/compatibility/latest-upstream/official-alpha2.md#ptc程序结果与手机停止2026-10-10)。不将单层pwsh结果推断为任意插件/嵌套层级/PTC生命周期已兼容。

## 可继续子会话停止与再次续聊

官方alpha.2、独立插件0.1.80-latest.0和既有Android包的实际子会话停止入口已验：父模型真实创建可继续子会话，手机打开后发送只读pwsh等待命令，空输入时点击“停止生成”；原子日志唯一工具错误结果和aborted/user结算，无结束输出/完成回复/重试。手机随后继续同一子会话得到真实回复，父子草稿和原历史前缀保持，没有电脑Web iframe。50.097秒、12阶段、退出0，清理完成；只增加测试代码，产品未重新构建或安装。

委派权限实际为read-only沙箱+never审批，官方显示custom；按实际sandbox/mode、approval/policy的delegation记录核对。首轮错误预设名称断言失败保留、不计通过。两个截图均查看：再次续聊截图实际显示已停止工具和新回复，第一张视窗主要显示此前内容。完整报告、真实入口、失败边界及恢复证据见[子会话停止专项](../../../plugin/compatibility/latest-upstream/official-alpha2.md#可继续子会话的手机停止与再次续聊2026-10-10)。一次性/多层及其他生命周期仍待验，不把错误模式地址拒绝当成一次性任务的通过证据。

## 选择技能并发送

状态：已核验限定场景；维护：DSHM兼容验收；最近核验：2026-10-10。手机“添加附件→选择技能”的真实搜索/无匹配、说明预览、手动调用标注、命令同名禁用和不可手动技能排除已验证。选择将/name加入原草稿，重复选择不重复加入，不提前发消息；用户发送后，官方skill-invocation原记录及真实模型回复证明正文由电脑加载，而非由手机代填答案。原历史前缀/全局配置保持，三份测试技能移除。标准模式、普通项目技能范围及其他未验边界见[技能专项](../../../plugin/compatibility/latest-upstream/official-alpha2.md#手机技能目录说明与实际调用2026-10-10)。

实现证据：[手机实际入口](../../tests/support/official-skills.mjs)、[公开记录核对](../../../backend/tests/support/official-skills.ts)。本轮30.010秒、10阶段、退出0，产品/App与官方环境全复用；首轮项目根标记缺失的测试环境失败保留，不计通过。

## 电脑插件的自适应设置

在“Remote选项→电脑插件”中可为每个界面插件开关自适应，用户选择优先于作者声明。作者可调用`ctx.dshmLayout.configure({autoFit:false})`关闭默认缩放，未声明时默认开启；“恢复插件默认”删除手机覆盖。只缩放最外层，不改插件内部样式；关闭时由插件作者负责手机布局，内容可在外层横向滚动。

官方alpha.2、插件0.1.80及当前c5da7627 APK的[14阶段实际运行](../../../backend/artifacts/official-plugin-only/official-android-4ef746ce-cab4-4fe2-be74-3dbbd9a54784.json)81.875秒通过：正常安装自有五文件插件后，作者默认关闭、用户开关/恢复默认、断线重连、真实页面重载及卸载后的声明释放均验证；720px内部原尺寸保持，开启时仅外层缩为388px。原插件按钮、弹窗、菜单、状态及聊天草稿保持，零iframe，未重建产品。

[详细依据与首轮测试定位失败](../../../plugin/compatibility/latest-upstream/official-alpha2.md#插件作者自适应声明与用户选择2026-10-10)区分真实页面重载和进程结束；本轮不宣称任意插件或其他生命周期均通过。[79轮恢复审计](../../artifacts/official-plugin-only/turn68-restoration-audit.json)确认原App前台/PID/安装身份、Key公开状态/绑定/历史和官方文件保持，临时插件与权限已清理。
