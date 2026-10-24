# 手机端模块地图

软件更新共用[面板](../../../src/ui/AppUpdates.jsx)和[选择规则](../../../src/update-presentation.mjs)，普通/Remote保存屏障通过受限更新桥交给独立进程重启；[当前实现、旧桥兼容及本地验收范围](../../integration/unified-updates-current.md)。

页面资源更新由Application共享的[WebUpdates](../../../android/app/src/main/java/dev/dshmobile/validation/WebUpdates.kt)协调固定来源下载，[签名清单/安全解压](../../../android/app/src/main/java/dev/dshmobile/validation/WebResourceManifest.kt)与[进程固定世代/回退存储](../../../android/app/src/main/java/dev/dshmobile/validation/WebResourceStore.kt)分工；两个Activity继续使用原HTTPS来源和更新桥，StartupScreen提供健康确认及原生恢复。只操作独立资源目录，未迁移数据。[打包签名工具](../../../scripts/web-update-package.mjs)和[资源工作流](../../../.github/workflows/web-resources.yml)独立于APK签名。维护：手机端维护者，核验2026-10-24；[状态、验收与未发布边界](../../integration/web-resource-updates-current.md)。

[更新服务](../../../android/app/src/main/java/dev/dshmobile/validation/AppUpdates.kt)由Application共享，两个自有Activity挂载[受限更新桥](../../../android/app/src/main/java/dev/dshmobile/validation/AppUpdateBridge.kt)，不复用聊天/Remote网络凭据。[前端状态](../../../src/app-updates.mjs)与[共用更新窗口](../../../src/ui/AppUpdates.jsx)接入普通设置、Remote连接菜单和启动提示；安装前复验由[校验器](../../../android/app/src/main/java/dev/dshmobile/validation/AppUpdateVerifier.kt)负责，发行清单沿原CI携带配套插件版本。维护：手机端维护者，核验2026-10-24；[流程、原生安装证据与未发布边界](../../integration/app-updates-current.md)。

普通聊天通过[供应商目录](../../../src/ordinary-providers.mjs)、[共享模型选择](../../../src/ui/OrdinaryModels.jsx)与[供应商设置](../../../src/ui/OrdinaryProviders.jsx)管理服务和模型；[原生配置](../../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryProviders.kt)保存目标与独立凭据引用，[原生请求桥](../../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryBridge.kt)按目录快照发送。沿用原 DeepSeek 别名与 IndexedDB v2；聊天备份升为 v2 并接受旧 v1。维护角色手机端维护者，核验2026-10-15；[规则与实际入口证据](../../integration/ordinary-providers-current.md)。

[Remote回复尾部](../../../src/ui/RemoteMessage.jsx)复用官方分支图标，[会话扩展](../../../src/remote-plugin-slots.jsx)将反馈与分支合在同一操作行；仅官方反馈的操作框使用[内容宽度](../../../src/ui/MobilePluginFrame.jsx)，不改变其他插件的外层缩放。维护角色手机端维护者，核验2026-10-15；[显示规则与真实入口证据](../../integration/remote-reply-actions-current.md)。

Remote活动提示通过[会话插槽](../../../src/remote-plugin-slots.jsx)在[共享聊天正文](../../../src/ui/RemoteWorkspace.jsx)末尾挂载原DSH独立组件，不依赖首段消息节点；[时间来源](../../../src/remote-running-status.mjs)只取原开放轮次，连接和会话状态共同控制显示。维护角色手机端维护者，核验2026-10-15；[等待反馈及真实验证边界](../../integration/remote-running-status-current.md)。

完整内置面板的手机尺寸由[面板契约](../../../src/remote-panel-layout.mjs)和[共用内置面板边界](../../../src/ui/NativePanelFrame.jsx)维护：官方注册域避免重复缩放，侧栏/全局页分配完整高度，设置使用自然高度，辅助文字最低13px，跳过第三方框。图片/PDF仅调整控件，不改媒体缩放。维护角色手机端维护者，核验2026-10-15；[全量矩阵及验证边界](../../integration/builtin-panel-layout-current.md)。

[面板布局规则](../../../src/remote-panel-layout.mjs)集中声明文档、差异和文件目录的完整视口契约；共享[面板外壳](../../../src/remote-plugin-panels.jsx)使用该契约，阅读位置沿用原组件。下发目录按官方注册域识别，第三方同槽仍经通用缩放。维护角色手机端维护者，核验2026-10-15；[目录遗漏与验证边界](../../integration/file-preview-layout-current.md#2026-10-15补齐文件列表与统一面板尺寸)。

[Remote 文档适配](../../../src/remote-document-previews.jsx)按组件身份声明自有外壳和内置预览器，由[插槽注册](../../../src/remote-plugin-slots.jsx)跳过桌面等比缩放，保留文件正文的局部滚动和第三方渲染器自适应。维护角色手机端维护者，核验 2026-10-15；[排版和真实验证边界](../../integration/file-preview-layout-current.md)。

官方工具的手机排版由 [Remote 工具域适配](../../../src/remote-tool-typography.jsx)与共享 Remote 样式提供；只调整官方注册域的外层与行结构，第三方工具视图仍经过原自适应框。[字号、间距与验证边界](../../integration/tool-record-layout-current.md)。

[共享动效](../../../src/ui/motion.jsx)负责手机页面切换、窗口保留退出与外层尺寸变换；[Surface](../../../src/ui/Surface.jsx)保留原生模态契约，[PanelSurface](../../../src/remote-plugin-panels.jsx)保留插件 portal、标签状态与返回处理。读取和恢复登记通过 `useSurfacePresent` 在逻辑关闭时即释放，不等待视觉退出。alpha.2 的执行过程使用[原节点适配](../../../src/remote-chat-presentation-alpha2.jsx)与每个手机聊天视口自己的时钟。维护角色手机端维护者，核验 2026-10-14；当前证据和边界见[动效记录](../../integration/motion-current.md)。

地址保存的进程恢复由[RemoteModel](../../../src/remote-model.mjs)持有[RemoteEndpointJournal](../../../src/remote-endpoint-journal.mjs)，沿[原草稿数据库](../../../src/remote-drafts.mjs)按绑定严格持久化待核对目标/编号；不保存地址、Key或可重发请求。[地址服务](../../../src/remote-endpoint.mjs)在发请求前提交记录，明确结算或新连接实际读取后按编号清理，[共享Remote页面](../../../src/ui/RemoteWorkspace.jsx)显示重开后待核对提示。表单卸载和App进程恢复共用服务，不由具体设置卡持有唯一提示。维护角色手机端维护者，核验2026-10-10；来源：[六种实际App结束与同APK核心回归](../../../../plugin/compatibility/latest-upstream/official-alpha2.md#服务地址保存时app结束与恢复2026-10-10)。

官方alpha.2组合：[SDK选择器](../../../scripts/latest-mobile-build.mjs)只解析独立根内真实路径与精确版本；[新节点接入](../../../src/remote-chat-presentation-alpha2.jsx)使用官方bottomSource与同步搜索隐藏，不安装第二个桌面滚动协调器。[外观默认值](../../../src/phone-appearance.mjs)及[本地ConfigForm](../../../src/local-settings.mjs)补齐新主题字段，保持手机原存储权威。启动探针与真实Android证据见[新版复验](../../../../plugin/compatibility/latest-upstream/official-alpha2.md)；只读官方源码不写回，派生产物只用于DSHM。

[提问与计划发送驱动](../../../tests/support/official-interaction-sending.mjs)由实际手机按钮提交原结构化答案，复用外部测试转发口在转发前或真实回执送达前切断连接；不改生产函数或生成回执。默认legacy没有callId，以原eventId、精确问题身份及官方记录关联；计划核对原intent.callId/detail。原生自动重连后，未送达要求用户明确重答，已结算只恢复唯一结果。草稿/历史/模型/PID保持；共享转发口的原write发送回归另验。来源：[真实四种情况与三轮收尾](../../integration/official-plugin-only.md#默认提问与计划答复发送断线及确认丢失)；维护角色手机端维护者，核验2026-10-09。

[普通竞争驱动](../../../tests/support/official-interaction-race.mjs)与[超时补答竞争驱动](../../../tests/support/official-timed-race.mjs)复用已有App显示实际问题/计划与胜出结果。两个实际鉴权连接同时提交相反答复，默认问题/计划原结果唯一；continued补答保持原pending结果，只追加一条原问题用户消息。手机撤下旧卡片、历史/草稿/模型保持；不是双实体手机同时点击，也不代表在途异常已验。来源：[六次真实竞争与最终环境恢复](../../integration/official-plugin-only.md#默认提问计划与超时补答的同时竞争)；维护角色手机端维护者，核验2026-10-09。

[默认提问与计划的电脑恢复驱动](../../../tests/support/official-interaction-host.mjs)复用已有App，在同一手机运行期间结束拥有的正常官方CLI。旧waterfall随Host结束失效，不将legacy/plan误作timed补答；手机撤下旧卡片，官方未知结果与原完整日志保持。显式新请求才生成新callId，手机回答/批准/要求修改单次结算，模式关闭或保持分别核对；结算后再重启不重放。来源：[真实两轮与最终环境恢复](../../integration/official-plugin-only.md#默认提问与计划中的电脑退出与恢复)；维护角色手机端维护者，核验2026-10-09。

[带超时提问的电脑恢复驱动](../../../tests/support/official-timed-host.mjs)在同一真实手机运行期间结束已登记的官方CLI进程树，再正常启动同一home。沿原问题面板补答，后端核对官方追加的未知结果、原问题continued、唯一用户补答与原日志前缀；结算后再重启没有重放。问题面板接管输入区时，模型检查延后到答完；测试收尾的授权失败不阻止独立UID/映射清理。来源：[实际入口和失败边界](../../integration/official-plugin-only.md#带超时提问中的电脑退出与恢复)；维护角色手机端维护者，核验2026-10-09。

[带超时提问驱动](../../../tests/support/official-timed-question.mjs)复用已有App与原问题组件，通过正常Launcher恢复等待问题或超时后的continued问题。电脑用公开插件管理器临时声明独立timed模式，原标准模式/默认目录保持；共享策略只在新版开放计时流与结构化补答，原Host负责live root与问题归属。完整原记录、唯一工具结果及迟到用户消息分别核对，观察读者不代持计时。来源：[实际证据和失败边界](../../integration/official-plugin-only.md#带超时提问的app恢复与补答)；维护角色手机端维护者，核验2026-10-09。

[默认提问进程恢复驱动](../../../tests/support/official-question-process.mjs)复用真实App与官方默认legacy问题协议；电脑公开session/prompt发起任务，独立UID结束后正常Launcher/抽屉恢复。后端按唯一callId和问题id/正文/选项核对原waterfall、完整记录前缀、答案结果唯一与真实completed，不把legacy空活动投影当作结算，也不向提问发送write审批字符串。原草稿保持，另一真实连接答复后不恢复旧卡片；timed和Host恢复分别见上方独立专项。维护角色：手机端维护者；核验2026-10-09；来源：[真实范围与环境守卫失败](../../integration/official-plugin-only.md#默认提问等待时app结束与恢复)。

[计划进程恢复驱动](../../../tests/support/official-plan-process.mjs)复用原计划插件及真实Android，关闭独立UID后从正常Launcher进入自身Remote；四种情况分别验证恢复后手机批准/要求修改及另一连接在App停止期间的批准/要求修改。后端按原intent/callId/eventId/plan detail关联，核对完整原记录、唯一结果及模式投影；要求修改使用官方ASK_CANCELLED，旧相反答复只产生幂等空操作。仅新增测试代码，不修改本体或生产实现，不将顺序旧答复检查计作同时竞争。来源：[真实计划恢复与环境保护](../../integration/official-plugin-only.md#计划审批等待时app结束与恢复)；维护角色与核验日期同上。

[审批传输验收驱动](../../../tests/support/official-approval-sending.mjs)与[外部测试转发口](../../../../backend/tests/support/official-approval-transport.ts)分别在真正手机批准未转发和真正生产回执未送达的位置切断连接；独立核对官方记录与文件，不替换生产方法或伪造鉴权。载体重新ready但尚未协商能力时，[RemoteTransport](../../../src/remote-transport.mjs)不能因订阅的本地前置失败递增世代；真正远端断线仍取消旧操作，只有只读订阅恢复，审批不自动重放。维护角色：手机端维护者；核验2026-10-09；来源：[真实Android、两次失败和两个调用入口回归](../../integration/official-plugin-only.md#普通write审批答复断线与确认丢失)。

[RemoteTurnProcess](../../../src/ui/RemoteTurnProcess.jsx)是DSHM自有结算标题，复用原样式和折叠控制契约；`interrupted`显示“已中断”，不显示成功用时，执行过程保持展开。固定上游仅只读，手机构建由[局部渲染适配](../../../scripts/latest-turn-process-sources.mjs)引入；不修改电脑DSH或已安装SDK。[主聊天/旁栏展示回归](../../../scripts/check-latest-turn-process-web.mjs)核对受阻、中断、停止、失败及完成状态，浏览器回放不替代真实模型/Android验收。维护角色：手机端维护者；核验2026-10-09。

[官方Host重启驱动](../../../tests/support/official-host-restart.mjs)在真实write审批等待与结算后，仅结束明确登记的测试pnpm进程树；[后端生命周期](../../../../backend/tests/support/official-host-lifecycle.ts)通过正常pnpm入口恢复同一官方安装与profile，不注入启动。手机进程不重启，核对自行重连、原会话/草稿/模型、失效审批及未知工具结果；后端独立检查完整原事件前缀、唯一结果及自己的文件。显式新任务必须生成新审批，已完成写入在再次重启后不重放。来源：[真实专项与失败边界](../../integration/official-plugin-only.md#普通write审批中的电脑端结束与恢复)；维护角色与核验日期同上。

[审批进程恢复驱动](../../../tests/support/official-approval-process.mjs)让手机正常留下草稿，电脑经公开session/prompt发起真实write任务；仅结束自己的测试UID，从普通Launcher/抽屉恢复DSHM自有Remote。后端持有原会话事件前缀，核对同一审批仍待处理或已由另一真实连接拒绝、消息/升级write结果唯一、草稿保持和原文件；等官方completed结算，不以审批期间隐藏停止按钮代替完成。维护角色：手机端维护者；核验2026-10-09；[真实范围、三次驱动失败与剩余Host/其他审批生命周期](../../integration/official-plugin-only.md#审批等待时app结束与原会话恢复)。

[目标写入中断验收](../../../tests/support/official-destination-write-interruption.mjs)在正常系统Downloads已写入真实前缀后冻结自己的UID，再由原按钮取消、生产Host断线或桌面撤销设备触发原生清理；后端独立核对目标/原件摘要和官方历史，保存成功先到不算取消通过。两个互斥专项覆盖取消/断线/手动完整重试及真实写入中撤权，不替换生产函数或使用调试provider。维护角色：手机端维护者；核验2026-10-09；[实际范围与剩余提供方/竞争](../../integration/official-plugin-only.md#系统目标写入时取消断线与撤权)。

[目标写入进程验收](../../../tests/support/official-destination-write-death.mjs)使用正常系统“下载”目录，在真实目标字节大于0且小于完整原件时，外部OS观察器冻结并结束自己的独立UID，核对生产保存记录、普通/Remote恢复提示、确认语义、同一官方历史/草稿及手动完整原件重试。没有使用调试provider或替换生产函数；启动保留外部半成品，只清理私有暂存并提示用户，测试收尾才按前缀摘要删除自己的目标。维护角色：手机端维护者；核验2026-10-09；[实际范围及其他回收策略](../../integration/official-plugin-only.md#系统目标写入时app结束与恢复)。

[附件驱动](../../../tests/support/official-attachments.mjs)从实际Android系统文件选择经生产上传到官方单条消息的三个文件引用，再验证DSHM自有历史附件面板与原件系统保存。[后端编排](../../../../backend/tests/official-host.test.ts)独立核对真实模型读取、公开附件流的字节/身份及错误会话拒绝；源文件位于后端测试目录、不是DSH工作区中的同名副本。驱动只清理自己摘要未变的手机副本；官方历史/附件存储保留作证。维护角色：手机端维护者；核验2026-10-09；[真实范围、首次枚举失败与模拟器重启恢复](../../integration/official-plugin-only.md#手机上传与历史附件预览下载)。

[RemoteTransport](../../../src/remote-transport.mjs)在RPC/订阅的明确Host断线错误处取消本地传输，即使手机socket仍在线；同代只取消一次，旧请求迟到错误不能取消恢复后的生命周期，不自动重放写入。[系统窗口驱动](../../../tests/support/official-save-window.mjs)在完整私有原件和实际位置选择窗口同时存在时验证系统取消/断线关闭/清理及显式重试。维护角色：手机端维护者；核验2026-10-09；来源：[两入口回归](../../../tests/remote-transport.test.mjs)、[实际Android及核心回归](../../integration/official-plugin-only.md#系统保存窗口取消断线与显式重试)。

[纯官方文件中断驱动](../../../tests/support/official-file-recovery.mjs)在真实私有暂存已写入后，使用原按钮取消、中转停用及自己原件尺寸变化，核对清理/失败/无自动重试；手动重试经系统保存完整最新字节与摘要，草稿保持。后端大Buffer使用直接equals，避免测试框架逐项比较耗尽内存；异常退出的[受控恢复](../../../../backend/scripts/recover-official-file-check.mjs)单独保存报告，不改写失败。维护角色：手机端维护者；核验2026-10-09；[证据与未验证范围](../../integration/official-plugin-only.md#文件下载中断与最新完整原件重试)。

纯官方文件与安装验收由[后端 opt-in](../../../../backend/tests/official-host.test.ts)编排；[文件驱动](../../../tests/support/official-files-transfers.mjs)使用真实文件树/文档标签/原生保存，[插件安装驱动](../../../tests/support/official-plugin-install.mjs)核对管理授权、真实安装结果和官方重启提示。测试只操作独立UID与自己的文件/插件；失败保留，不修改DSH本体。维护角色：手机端维护者；核验2026-10-09；结果见[当前证据](../../integration/official-plugin-only.md)。

[Office驱动](../../../tests/support/official-office-preview.mjs)只读既有真实原件、触发正常官方转换并核对手机PDF画布/正文及关闭重开；不复用历史修改版缓存观察器，不把重开相同推导为缓存或取消生命周期通过。来源与核验日期同上。

[工作区管理驱动](../../../tests/support/official-workspace-management.mjs)经原手机管理入口处理电脑预先登记的测试注册；后端独立读取公开follow基线、磁盘和原事件，核对改名/排序/移除注册、其他工作区保持和授权收回。来源与核验日期同上。

[电脑设置驱动](../../../tests/support/official-computer-settings.mjs)经原五字段表单临时调整超时并恢复数值/继承；后端以官方脱敏describe独立核对公开标量，失败收尾只恢复仍与本轮临时值匹配的单项。来源与核验日期同上；不读取/修改Key、地址或全量配置。

[队列驱动](../../../tests/support/official-queue-control.mjs)通过真实只读前台工具的有界窗口，操作手机排队/编辑/取消/引导与停止；后端独立核对 inbox 身份、真实用户/模型消息、aborted/user 结束及闲置状态。停止保留待发送项并重连后继续取消，原App隔离保持。来源与核验日期同上；竞争/在途写入断线另验。

[导航驱动](../../../tests/support/official-session-navigation.mjs)经手机菜单改名/分支/归档恢复，核对父身份、继承消息、原会话与各自草稿；内容搜索另读官方片段，并明确依赖电脑开启。纯官方默认关闭时的提示、正常profile临时开启与精确恢复见当前证据，不改本体。来源与核验日期同上。

[审批恢复驱动](../../../tests/support/official-approval-recovery.mjs)经实际手机按钮、生产中转与官方事件验证等待时断线恢复；后端的独立连接同时提交相反决定并核对唯一官方结果、重复答复空操作及手机卡片撤下。读者只使用各自 clientId，不冒用手机归属；自己的文件/授权清理和原App保护分别核验。来源与核验日期同上。

[计划审阅驱动](../../../tests/support/official-plan-review.mjs)使用手机计划模式开关与原计划正文面板/审阅卡片，核对实际 `exit_plan_mode` 调用、批准后的模式退出和要求修改后的模式保持，收尾恢复关闭。正文面板须正常返回聊天后操作卡片，不强制穿透点击。来源与核验日期同上。

[完成通知驱动](../../../tests/support/official-task-notifications.mjs)只等待官方真实会话结算，经原生系统通知核对事件身份/摘要和实际点击。仅结束独立测试UID，Launcher重开后先核对普通首页已恢复通知连接且无历史补发，再从原抽屉回Remote读取同一结果；中转重连后新的完成继续送达。后端独立核对唯一用户消息、模型source/工具结果/完成事件，不构造通知或替换生产函数。来源与核验日期同上；其他通知类别与Host结束另验。

当前纯官方候选由[build-web](../../../scripts/build-web.mjs)的 `--official-candidate` 和[latestMobileBuild](../../../scripts/latest-mobile-build.mjs)使用独立正常 npm 手机 SDK 依赖，输出到 `official-mobile-dist`；[Gradle隔离项](../../../android/app/build.gradle.kts)生成 `.officialtest`，不覆盖原应用。[RemoteWorkspace](../../../src/ui/RemoteWorkspace.jsx)共用主聊天/旁栏菜单按协商能力显示桌面应用选择和汇总待处理，聊天内审批仍走原公开事件通道。维护角色：手机端维护者；核验2026-10-09；[实际入口与范围](../../integration/official-plugin-only.md)。

[remote-plugin-journal](../../../src/remote-plugin-journal.mjs)仅过滤未确认操作展示摘要，按一小时/64条及白名单限制；[RemoteDraftStore](../../../src/remote-drafts.mjs)沿原绑定命名空间严格落盘。[RemotePluginOperations](../../../src/remote-plugin-operations.mjs)先保存再提交，重开只向电脑核对，不形成重放队列；[RemoteModel](../../../src/remote-model.mjs)释放时等结算后关闭存储。维护角色：项目协作Agent；核验2026-10-06；[当前实际范围](../../integration/latest-install-recovery.md#手机与电脑都结束后的安装摘要)。

[remote-tool-cancellation](../../../src/remote-tool-cancellation.jsx)包装原 ui-tool 工具树的局部 toolview，仅按明确取消结果使用原 ToolRow 展示本地化提示；[remote-tool-row](../../../src/remote-tool-row.mjs)与备用消息详情共用取消分类及固定诊断过滤，原始记录不变。维护角色：项目协作Agent；核验2026-09-28；[主聊天、旁栏与实际Android边界](../../integration/auto-review-current.md#手机取消提示与共享入口2026-09-28)。

[RemoteProviderSettings](../../../src/ui/RemoteProviderSettings.jsx)在目录打开且已授权时订阅原设置/适配器事件，经已有受限只读服务串行更新目录，丢弃失效响应；保留仍存在的选中表单，移除路由才清除选择。维护角色：项目协作Agent；核验2026-09-28；[实际入口与边界](../../integration/provider-directory-current.md)。

[RemoteComputerKey](../../../src/ui/RemoteComputerKey.jsx)按原设置/凭据/适配器事件使状态失效，经既有[受限服务](../../../src/remote-key.mjs)串行核对，取消旧连接操作并丢弃迟到读取；原生写入不因事件重放。维护角色：项目协作Agent；核验2026-09-28；[实际范围与证据](../../integration/key-state-current.md)。

[remote-plugin-settings](../../../src/remote-plugin-settings.jsx)组合原 PluginsSettingsSection 和 settings.plugins.tab 子插槽，稳定快照按插槽版本/语言更新；[RemotePluginSettings](../../../src/ui/RemotePlugins.jsx)控制在线与管理授权，局部页面仍通过原渲染器/缩放层。维护角色：项目协作Agent；核验2026-09-28；[边界与证据](../../integration/plugin-settings-tabs-current.md)。

[remote-references](../../../src/remote-references.mjs)校验当前候选后调用已挂载的[RemoteInputSession](../../../src/remote-input-session.mjs)追加引用，使用原编辑器坐标和卡片操作，禁止用纯文字覆盖既有结构。主聊天与旁栏共用；维护角色：项目协作Agent；核验2026-09-28；[入口与验证边界](../../integration/reference-menu-current.md)。

[remote-workspace-references](../../../src/remote-workspace-references.mjs)在原子交接前固定原文件引用来源，[RemoteInputSession](../../../src/remote-input-session.mjs)以原Lexical计算投影；[moveWorkspaceDraft](../../../src/remote-workspace-drafts.mjs)统一保存文字和JSON，提交前不改源编辑器。维护角色：项目协作Agent；核验2026-09-28；[实际范围](../../integration/workspace-reference-current.md)。

[RemoteProviderCard](../../../src/ui/RemoteProviderCard.jsx)统一官方、已有和新增提供方入口的公开 owner 投影；原 keyed/root 插槽沿用 MobilePluginFrame。协议与 Host 只读状态见[卡片边界](../../integration/provider-card-current.md)。维护角色：项目协作 Agent；核验2026-09-27。

[RemoteModelSettingsExtensions](../../../src/remote-plugin-slots.jsx)承接原 `settings.models.footer` list/root 空 owner，[RemoteComputerSettings](../../../src/ui/RemoteComputerSettings.jsx)在有管理权限且已连接时挂载；SessionProvider 明确无会话，MobilePluginFrame 管理缩放与卸载，不提供额外凭据/设置权限。维护角色：项目协作 Agent；核验2026-09-27；[实际证据与剩余边界](../../integration/remote-current.md#模型设置底部扩展2026-09-27)。

[SupportDiagnostics](../../../src/ui/SupportDiagnostics.jsx)由普通设置和 Remote 连接页共用，[support-diagnostics](../../../src/support-diagnostics.mjs)逐字段投影报告；原生 AppInfo 只返回公开运行版本，两个桥保留各自来源与正式 URL 边界。Remote 状态只读当前模型，不新增电脑请求或日志收集。维护角色：项目协作 Agent；核验2026-09-27；[实际入口及限制](../../integration/diagnostics-current.md)。

[remote-surface-inert](../../../src/remote-surface-inert.mjs)按自有窗口实际层级集中管理主聊天与下层窗口的 inert，保留原属性并在最后释放时恢复；关闭下层不移动顶层焦点。插件管理、全局页面、旁栏都使用同一生命周期，原插件 portal 不被整页禁用。维护角色：项目协作 Agent；核验 2026-09-27；[回归及 MuMu 证据](../../integration/appearance-current.md#插件窗口叠层交互2026-09-27)。

[remote-global-panels](../../../src/remote-global-panels.jsx)复用原 LayoutController，提供 layout 服务、panelInfo 和 main/sidebar.panellist 注册；DSHM 自有 PanelSurface 呈现页面。主聊天导航与原取消信号衔接，旁栏独立；[inert 所有权](../../../src/remote-surface-inert.mjs)按窗口引用计数恢复背景交互。根模型持有唯一全局页面/浮层，嵌入会话只委托服务。维护角色：项目协作 Agent；核验 2026-09-27；[源码与实际验证](../../integration/remote-current.md#插件全局页面导航2026-09-27)。

[MobileSlotRoot](../../../src/remote-plugin-slots.jsx)声明并只渲染一次原` shell.overlay `根作用域插槽，以空SessionProvider隔离当前聊天；[MobilePluginFrame](../../../src/ui/MobilePluginFrame.jsx)保留等比例缩放，允许浮层内容溢出局部高度。[remote-product.css](../../../src/ui/remote-product.css)使空白层不拦截指针，仅插件内容可交互。维护角色：项目协作Agent；核验2026-09-27；[原契约、实现及MuMu证据](../../integration/remote-current.md#插件全局浮层2026-09-27)。

[RemoteDesktopAppAction](../../../src/ui/RemoteDesktopAppAction.jsx)复用原 ui-open-in-app 局部按钮、目录字典及选择状态，主聊天和旁栏各自绑定当前模型，调用固定 desktopApps 协议与共用确认页。构建时[源适配](../../../scripts/remote-desktop-app-sources.mjs)仅开启原 Menu 的 portal，避开手机缩放/滚动裁剪，参考仓库不改动。原插件完整网页路由不加载，图标暂用通用占位。维护角色：项目协作Agent；核验2026-09-27；[实际验证与边界](../../integration/remote-current.md#原打开应用按钮与旁栏2026-09-27)。

[主聊天工厂](../../../src/remote-plugin-slots.jsx)从原Conversation快照仅选择`conversationPhase`标量，避免每次正文变化重新遍历整个工厂树；会话状态继续订阅模型界面通知，消息/局部插件保持原数据订阅。维护角色：项目协作Agent；核验2026-09-26，来源：[原阶段定义](../../../../deepseek-harness/packages/client/ui-conversation/src/client/contract/snapshot.ts)及[剖析、回归与MuMu证据](../../integration/remote-current.md#主聊天工厂阶段订阅2026-09-26)。

[remote-plugin-policy](../../../src/remote-plugin-policy.mjs)在实际模块图启动前排除原交互终端ui-sidebar-terminal的完整apply，保留模块依赖与聊天命令结果组件；不只是隐藏标题恢复按钮。符合用户“手机不输入命令”的既定范围，管理授权或接口协商不会启用该界面。维护角色：项目协作Agent；核验2026-09-26，来源：[原入口核验与MuMu只读结果验收](../../integration/remote-current.md#手机终端边界与遮挡通知2026-09-26)。

[remote-interaction-plugins](../../../src/remote-interaction-plugins.jsx)安装原审批/提问apply，[RemoteApp](../../../src/RemoteApp.jsx)等待初始化后才放行Gateway事件。原uiSession决定待处理请求与优先级，conversation.composer接管保留的默认编辑器；原ui-plan继续由电脑模块图加载。remote-core仅在无界面协议客户端保留载体消费者，正式App继续原事件链。维护角色：项目协作Agent；核验2026-09-26，来源：[页面回归和MuMu真实提问/计划](../../integration/remote-current.md#原审批与提问插件2026-09-26)。真实工具审批及完整异常仍待验收。

[RemoteConversationHero](../../../src/ui/RemoteConversationHero.jsx)和[RemoteEmptyConversation](../../../src/ui/RemoteEmptyConversation.jsx)复用品牌与[工作区选择器](../../../src/ui/RemoteWorkspaceChoice.jsx)，选择器调用原工厂子插槽及现有草稿转移服务。工厂上下文持有picker开关、当前工作区标题与requiresWorkspace，输入组件沿同一状态锁定缺少归属的空聊天，原工厂hero控制欢迎区而不重建编辑器。失败收起选择器后由宿主展示，品牌仅限制外层可用宽度。维护角色：项目协作 Agent；核验2026-09-26，来源：[空聊天页面及MuMu验证](../../integration/remote-current.md#空聊天品牌与工作区插件2026-09-26)。更新下方完整hero待接入的历史边界，不代表所有第三方工作区组件已验证。

[conversation.content](../../../src/remote-sidebar-chat.jsx)统一拥有原工厂七个子插槽；[RemoteConversationSlots](../../../src/remote-plugin-slots.jsx)将工厂渲染能力传给输入链、输入框、停靠区与模式选择。主聊天以常驻RemoteWorkspace持有状态，将正文与输入区域组合在工厂内；面板和弹窗在外层，避免继承工厂递归上下文。相较root重复声明，局部Views可沿原渲染器直接调用同一子插槽。维护角色：项目协作 Agent；核验2026-09-26，来源：[局部调用及MuMu真实输入验收](../../integration/remote-current.md#会话工厂统一输入扩展2026-09-26)。此段更新下方child未统一的历史边界，完整空聊天hero仍待接入。

[remoteFactoryCaller](../../../src/remote-factory-callers.jsx)在注册组件、工厂与局部组件的调用面保留原 renderFactorySlot，仅对 conversation.content 在 FactoryOutlet 前增加[独立导航宿主](../../../src/remote-sidebar-chat.jsx)。同一model/组件通过弱缓存保持包装身份；已有主/旁栏范围复用，未绑定会话保持原空入口。取消工厂内部独立导航回退，避免标准Hook与注入绑定分叉。维护角色：项目协作 Agent；核验 2026-09-26，来源：[直接实例页面及MuMu验收](../../integration/remote-current.md#插件直接创建聊天视图2026-09-26)。此段更新下方独立实例待处理的历史边界，完整child归属仍待统一。

[remoteSidebarHost](../../../src/remote-sidebar-chat.jsx)替换原 SidebarChatTab 的手机组合，继续消费原资源与标签，在工厂外持有 RemoteConversationModel 并提供当前 SessionProvider；工厂注入与局部控件随导航重绑定。注册适配仅识别原组件身份，不替换其他插件内部。factory 的 composerBlock Hook 接同一注册表，无会话为空。维护角色：项目协作 Agent；核验 2026-09-26，来源：[回归及真实子/父会话验收](../../integration/remote-current.md#旁栏工厂作用域与输入禁用2026-09-26)。第三方直接工厂实例的内部导航回退仍待处理，不能泛化为全部调用者已完成。

[主聊天](../../../src/ui/RemoteWorkspace.jsx)将常驻正文传给[工厂组合](../../../src/remote-sidebar-chat.jsx)，[RemoteMainFactory](../../../src/remote-plugin-slots.jsx)以现有 mainView 引用调用 conversation.content，不额外创建会话。主/旁栏均经 conversation.session 呈现，输入和窗口仍由外层持有。阅读回执依据实际正文可见性。维护角色：项目协作 Agent；核验 2026-09-26，来源：[主入口回归与 MuMu 验收](../../integration/remote-current.md#主聊天接入同一内容工厂2026-09-26)。完整 child 所有权、composerBlock 和旁栏注入重绑定仍待接入。

[RemoteWorkspaceChoice](../../../src/ui/RemoteWorkspaceChoice.jsx)与 factory `selectWorkspace` 经[同一导航服务](../../../src/remote-workspace-navigation.mjs)调用[草稿交接](../../../src/remote-workspace-drafts.mjs)。[RemoteDraftStore](../../../src/remote-drafts.mjs)使用严格 IndexedDB batch 原子移动四条记录，提交后才更新内存；新附件身份剥离 receipt，再沿目标会话上传。`draftTransfers` 在主/旁视图、编辑器、插件公开输入及发送之间共享。维护角色：项目协作 Agent；核验 2026-09-26。来源：[测试、实际 MuMu 与边界](../../integration/remote-current.md#工作区草稿与附件交接2026-09-26)。本段替代下方交接未实现的历史状态；主页面统一 factory、引用实际读取及完整异常仍未完成。

[模式局部组件包装](../../../src/remote-plugin-slots.jsx)把错误呈现绑定到组件、导航请求和连接代次，卸载后的回调不启动读取；锁仍由原模式服务的 finally 释放。维护角色：项目协作 Agent；核验 2026-09-26。来源：[异常回放与 Android 正常入口](../../integration/remote-current.md#模式请求的页面与连接隔离2026-09-26)。工作区切换的附件交接尚未实现，不能把旧会话的上传 receipt 直接交给新会话使用。

[RemoteSessionView](../../../src/remote-session-view.mjs)接收引用 source，根[RemoteModel](../../../src/remote-model.mjs)使用 mainView，旁栏/独立视图保留 controllerOperation；原引用释放更新目录 retainedBy。[原模式局部组件包装](../../../src/remote-plugin-slots.jsx)复用原 staged 预选与主空会话 apply，通过[共享模式服务](../../../src/remote-agent-presets.mjs)锁住读取/应用在途阶段，[编辑器](../../../src/ui/RemoteComposer.jsx)同锁暂停输入与提交。维护角色：项目协作 Agent；核验 2026-09-26，来源：[MuMu 实际模式应用与恢复](../../integration/remote-current.md#原插件模式预选与主聊天身份2026-09-26)。完整 factory 和设置页写入竞态未全部覆盖。

[RemoteEmptyConversation](../../../src/ui/RemoteEmptyConversation.jsx)处理 factory 未绑定 session 的欢迎页、品牌/工作区插槽与禁用输入，选择沿[原导航适配](../../../src/remote-workspace-navigation.mjs)进入主聊天。无会话 composer.bar 通过[现有插槽所有者](../../../src/remote-plugin-slots.jsx)和显式 empty 作用域渲染，避免重复声明与外层聊天身份泄漏。相对于重新实现创建链，复用现有工作区导航的空会话匹配与请求顺序约束。维护角色：项目协作 Agent；核验 2026-09-26，来源：[MuMu 实际入口及边界](../../integration/remote-current.md#插件无会话入口与工作区选择2026-09-26)。完整模式预选、hero 与 factory 注入仍在推进。

[RemoteWorkspace](../../../src/ui/RemoteWorkspace.jsx)通过 renderConversation 提供标题/正文，仍常驻持有输入、附件、队列和窗口。[工厂组合](../../../src/remote-sidebar-chat.jsx)把正文交给局部 Views，conversation.session 读取同一正文上下文；替换不重建编辑器，回到正文按回调 ref 恢复阅读位置。[阅读观察器](../../../src/remote-reading-context.mjs)只将实际聊天正文作为旁栏阅读标记。维护角色：项目协作 Agent；核验 2026-09-26，来源：[分离契约与 MuMu 验收](../../integration/remote-current.md#插件内容与常驻输入框分离2026-09-26)。此段替代下方已选会话独立 composer 待办，完整 hero/其他 factory 仍在推进。

[会话工厂组合](../../../src/remote-sidebar-chat.jsx)以每个实例独立的 RemoteConversationModel 持有导航和当前引用，默认 Views 渲染 DSHM 聊天，局部 widthControls 获得原容器/阶段/语言。整个宿主替换时读取旧 reader 或快照；异步正文挂载通知[阅读观察器](../../../src/remote-reading-context.mjs)。整块 sidebar.chat.conversation 的[插件外层](../../../src/ui/MobilePluginFrame.jsx)继承可用窗口高度，并反算缩放前高度，其他插槽保持自然高度。维护角色：项目协作 Agent；核验 2026-09-26，来源：[回归与真实 MuMu 验收](../../integration/remote-current.md#插件会话视图与局部控件2026-09-26)。完整 factory 的独立 composer/hero 等仍未完成。

[RemoteComposer](../../../src/ui/RemoteComposer.jsx)常驻输入状态机，将界面通过[插槽宿主](../../../src/remote-plugin-slots.jsx)的原 composer.bar 交给插件，dock 使用同一 session/input 快照；原 chain 仍在外层。手机旁栏外层显式允许横向收缩，避免宽插件反向撑大缩放测量容器；内置目标条沿用手机入口以免重复。维护角色：项目协作 Agent；核验 2026-09-26，见[实际验收与回归](../../integration/remote-current.md#插件输入框与停靠区2026-09-26)。

[RemoteWorkspaceNavigation](../../../src/remote-workspace-navigation.mjs)由根模型注入原 `uiWorkspace` 服务，直接使用真实 sessions/workspaces 和主视图导航；同工作区并发连接合并，迟到结果不覆盖后来的导航。从旁栏调用也进入主聊天，目录选择/创建明确拒绝。插槽根 Hook 提供原 `useWorkspaces`，原 ui-subagent apply 继续由手机组合承接，避免重复注册。维护角色：项目协作 Agent；核验 2026-09-26，见[实际插件验证和范围](../../integration/remote-current.md#插件工作区会话导航2026-09-26)。此段替代下方历史说明中 uiWorkspace 待接入状态；完整 conversation.content 工厂仍未完成。

[RemoteSessionView](../../../src/remote-session-view.mjs)持有视图独立的导航请求序号；新建、分支和归档通过beginNavigation预留本次意图，完成后仅在请求仍最新、原连接代次和视图仍有效时自动导航。[根模型](../../../src/remote-model.mjs)与[旁栏模型](../../../src/remote-conversation-model.mjs)共用该规则；新选择即使还在目录查询也能使旧结果失去导航资格，电脑已完成的写入仍保留。维护角色：项目协作Agent；核验2026-09-26，见[回归与真实入口](../../integration/remote-current.md#异步操作与导航顺序2026-09-26)。

[输入区域组合](../../../src/remote-plugin-slots.jsx)声明原`conversation.composer`链式会话插槽，由主/旁栏共用的[RemoteWorkspace](../../../src/ui/RemoteWorkspace.jsx)渲染。owner来自当前模型的session及原uiSession.sessionStatus，使用原优先级选择和overlay保留默认编辑器；断线只显示fallback，交互和卸载沿原pending域生命周期。相比另写手机插件选择器，直接复用原契约；完整conversation.content工厂与uiWorkspace仍待接入。维护角色：项目协作Agent；核验2026-09-26，见[真实插件验收](../../integration/remote-current.md#插件输入区域接管2026-09-26)。

[阅读状态观察器](../../../src/remote-reading-context.mjs)由根RemoteWorkspace唯一上报原生notifications.context，选择跟随conversationFocus；实际native dialog、原插件Modal和非聊天面板遮挡时上报null。只监听窗口边界增删/显示属性，文本流不逐token读布局，状态相同不重复上报，卸载清空。PanelSurface的Android返回以cancel事件关闭native dialog，合成Escape仅用于原插件菜单/Modal。维护角色：项目协作Agent；核验2026-09-26，见[实际桥回执与边界](../../integration/remote-current.md#旁栏弹窗与阅读状态2026-09-26)。

[子会话标题组合](../../../src/remote-subagent-lineage.jsx)直接渲染原SubagentHeaderLineage，导航校验当前视图引用和目录地址，旁栏复用原资源入口；每个菜单独立retain目录并在卸载释放。手机点击沿原ArrowDown入口打开，外层过滤触摸生成的兼容mouseover/out以免触发120ms关闭，不改原组件内部。作为低优先级lineage默认内容，第三方可覆盖且卸载后恢复；未伪造完整uiWorkspace。维护角色：项目协作Agent；核验2026-09-26，见[触屏实测](../../integration/remote-current.md#原子会话下拉与触屏2026-09-26)。

[RemotePanelMemory](../../../src/remote-panel-memory.mjs)保存当前运行环境的原标签布局和按父会话/标签隔离的只读视图快照，由[App恢复](../../../src/RemoteApp.jsx)交给新模型；旁栏重新取得原资源/SessionReference后挂载输出。临时卸载在布局清理阶段捕获快照，沿原TabOccurrence.signal在关闭标签时清除离屏状态，不长期挂载所有视图。主/旁页面各自捕获归档、工作区、搜索筛选，不恢复写操作或凭据。维护角色：项目协作Agent；核验2026-09-26，见[核心恢复](../../integration/remote-current.md#旁栏核心重建恢复2026-09-26)与[切换恢复](../../integration/remote-current.md#主聊天切换后的旁栏恢复2026-09-26)。

[输入交接](../../../src/remote-input-bindings.mjs)与[草稿存储](../../../src/remote-drafts.mjs)沿原Lexical节点JSON保留引用身份；同一条IndexedDB记录原子保存text/editor，旧纯文字兼容。RemoteModel的draftEditors与文字同时更新，纯文字写入废弃旧结构；App恢复携带同一结构。输入监听原编辑器内容更新而非仅文字mirror，覆盖同显示文字的引用身份替换；光标移动不落盘。恢复检查原文字投影，发送仍由原提供方解析，在途保持提交前草稿，不自动重发。维护角色：项目协作Agent；核验2026-09-26，见[当前证据](../../integration/remote-current.md#输入引用持久化2026-09-26)，替代历史跨binding/App引用待办。

[旁栏组合](../../../src/remote-sidebar-chat.jsx)保留原子会话资源/标签和ConversationSlotPanel，使用[RemoteConversationModel](../../../src/remote-conversation-model.mjs)将独立选择与局部目录接入同一RemoteWorkspace。连接、草稿、附件与写锁由根模型持有，命令与工作流导航按视图定位；当前全屏面板控制唯一可交互输入，关闭后恢复主聊天。原完整factory契约、输入引用交接和核心重建恢复仍待完成。维护角色：项目协作Agent；核验2026-09-26，见[真实入口与边界](../../integration/remote-current.md#子会话旁栏实际接入2026-09-26)。

[独立视图操作](../../../src/remote-model.mjs)接收明确的RemoteSessionView，发送/停止/队列/审批复用共享连接、原会话接口和会话级锁；草稿与附件只在根模型存储。原[输入组件](../../../src/ui/RemoteComposer.jsx)和[输入绑定](../../../src/remote-input-bindings.mjs)分别传递视图及SessionBinding，文件命令/附件移除按实际sessionId定位。视图关闭立即取消原shell；不承诺同一binding同时有两个可编辑实例。维护角色：项目协作Agent；核验2026-09-26，见[操作基础](../../integration/remote-current.md#独立视图输入与操作2026-09-26)与上段最新旁栏证据。

[RemoteSessionView](../../../src/remote-session-view.mjs)持有独立选择、原SessionReference与投影订阅，不建立连接或另一套插件树。[RemoteSessions](../../../src/remote-sessions.mjs)继承原ClientSessions，仅合并插件布尔目录状态与手机多视图计数；查询/去抖/投影和原会话生命周期保持。主/旁栏共用此服务，关闭菜单不会停止仍在查看的目录，全部退出后释放。维护角色：项目协作Agent；核验2026-09-26，见[目录共同持有](../../integration/remote-current.md#子会话目录共同持有2026-09-26)与[底层依据](../../integration/remote-current.md#独立会话视图底层2026-09-26)。

[标题插件组合](../../../src/remote-plugin-slots.jsx)在[RemoteWorkspace](../../../src/ui/RemoteWorkspace.jsx)自己的标题下按原顺序渲染leading/actions/utilities/corner会话插槽，保留single/list类型，复用SessionProvider和MobilePluginFrame；只排除已由手机承担的原模式/日志按钮与交互终端恢复入口。lineage使用原owner契约渲染当前及子会话祖先标题，[层级导航](../../../src/remote-lineage.mjs)从原SessionSummary父关系派生并经当前RemoteModel.select返回，校验引用和祖先资格、裁剪既有导航轨迹；不注入残缺uiWorkspace使原内置插件假激活。维护角色：项目协作Agent；核验2026-09-26，见[实际入口和边界](../../integration/remote-current.md#会话层级与祖先导航2026-09-26)。

[RemoteModel](../../../src/remote-model.mjs)与[RemoteConversationModel](../../../src/remote-conversation-model.mjs)分离同步操作订阅`subscribe`与批量页面订阅`subscribeView`，共用[RemoteViewNotifications](../../../src/remote-view-notifications.mjs)。原快照/会话/插件数据逐条更新，普通界面通知到下一任务合并；切会话、就绪、连接及分页状态边界即时通知。React直接模型消费者统一使用界面订阅，断线、通知、设置注册沿同步订阅；模型释放清理待发任务。旁栏正文隔离原工厂父级逐事件渲染，保留自身订阅和局部Views替换。维护角色：项目协作Agent；核验2026-09-26，见[性能、生命周期与MuMu依据](../../integration/remote-current.md#主聊天与旁栏刷新一致性2026-09-26)。

[会话构建派生](../../../scripts/remote-conversation-sources.mjs)在手机产物目录保留原register/chat-snapshot-builder/turn-navigation，唯一算法增量为按原只读ChatNode引用弱缓存导航短摘要；原节点替换即失效，不缓存会话ID/节点key，不改原摘要规则、历史窗口或插件内部。正式RemoteModel与所有统一构建别名使用同一路径，原函数锚点变化拒绝构建。维护角色：项目协作Agent；核验2026-09-26，见[原算法差分、真实模型和MuMu证据](../../integration/remote-current.md#历史导航摘要性能2026-09-26)。

[文件读取](../../../src/remote-files.mjs)、[附件读取](../../../src/remote-attachments.mjs)与[共享传输](../../../src/remote-download.mjs)捕获调用方、模型和原连接的共同取消信号，覆盖块间等待、最终核验与原生保存/分享准备。断线后不得跨连接继续读取或确认，重新发起才使用新连接；原生仍独立按代次清理暂存。维护角色：项目协作Agent；核验2026-09-26，见[两类真实入口与回归证据](../../integration/remote-current.md#文件传输断线隔离2026-09-26)。

[Office读取组合](../../../src/remote-office-cache.mjs)直接使用上游OfficePreviewCache，复用前以原readBytes/stat检查文件读取权限与版本，以officeToPdf/generation检查转换器代次；缓存8项/64MiB、在途2项、读者8个。断线、连接代次变化与Context释放清理缓存。附件缺少相同stat契约，保留原引用流和电脑队列缓存；不伪造文件路径。维护角色：项目协作Agent；核验2026-09-26，见[当前证据](../../integration/remote-current.md#office缓存与调度2026-09-26)。

[附件文档来源](../../../src/remote-attachment-documents.mjs)按[独立规范地址](../../../src/remote-document-address.mjs)区分会话/类型/ID/显示名，原资源服务仅提供引用描述，内容经真实remote.attachment完整核验。文档组合提供dshmDocuments统一读取服务；[手机构建派生](../../../scripts/remote-document-sources.mjs)只扩展原TextPreview/face及图片、代码、Office组件的来源解析，上游参考只读。同一原注册表、标签、状态机和插件插槽承担工作区与附件预览。维护角色：项目协作Agent；最近核验2026-09-26，见[接口](../../plugin-validation/document-resources-api.md)和[实际验证](../../integration/remote-current.md#历史附件原文档预览2026-09-26)。

[RemoteDocumentActions](../../../src/ui/RemoteDocumentActions.jsx)统一原文档面板与[旧预览/历史附件](../../../src/ui/RemoteFilePreview.jsx)的完整下载和分享。按会话、路径、附件ID重挂载操作状态；原文档面板关闭时仅卸载操作控件，保留原预览状态并取消未完成传输。工作区沿model.files，附件沿RemoteAttachmentFiles，不能以显示名回退工作区路径。维护角色：项目协作Agent；最近核验2026-09-26，来源为代码及[浏览器/MuMu证据](../../integration/remote-current.md#文件下载与分享统一2026-09-26)。

[交付组合](../../../src/remote-deliverables.jsx)复用原DeliverablesTail/PresentRow与既有轮投影，订阅迟到交付数据；与ReviewTab共享摘要和电脑状态，保留手机预览与确认。记录能力不足保持旧入口，完整协商后由[能力策略](../../../src/remote-plugin-policy.mjs)标为手机组合，隐藏重复的remote-changes节点。维护角色：项目协作Agent；最近核验2026-09-26；[真实验证与剩余边界](../../integration/remote-current.md#原交付文件卡片2026-09-26)。

[RemoteWorkspace](../../../src/ui/RemoteWorkspace.jsx)将同一帧的尾部滚动合并，依赖更新/卸载取消旧任务，执行前核对容器和阅读状态。[历史定位](../../../src/remote-history-position.mjs)以原ChatNodeSeat实体行为锚点，跳过无坐标的插槽外壳和折叠内容，保留前插及用户滚动语义。维护角色：项目协作Agent；最近核验2026-09-26，来源为代码与[浏览器/MuMu证据](../../integration/remote-current.md#长会话滚动与插件历史定位2026-09-26)。

[插件组合](../../../src/remote-plugin-slots.jsx)提供原 ConversationController / ComposerBlockRegistry 和同一 UiConversation snapshot；[输入绑定](../../../src/remote-input-bindings.mjs)将公开 resolver 指向当前手机输入实例，保留会话提示并核对作用域生命周期。[RemoteComposer](../../../src/ui/RemoteComposer.jsx)订阅本会话阻止原因；手机编辑器与附件提交继续由 RemoteModel 持有，不使用原包的内部附件登记。状态、源码与MuMu依据见[会话服务](../../integration/remote-current.md#插件会话服务2026-09-26)，最近核验2026-09-26，维护角色为项目协作Agent。

[RemoteInputBindings](../../../src/remote-input-bindings.mjs)按真实 SessionBinding 提供稳定的标准 input 状态与 inputActions，编辑器挂载/卸载替换底层 shell 并保留订阅；旧引用/连接拒绝操作，附件沿手机登记。原文件 action 接同一手机选择器。最近核验2026-09-26，维护角色为项目协作Agent，依据与真实插件验收见[标准输入接口](../../integration/remote-current.md#标准输入插件接口2026-09-26)。

[RemoteComposer](../../../src/ui/RemoteComposer.jsx)把原 Lexical 编辑器装入共享 [MobileComposer](../../../src/ui/MobileComposer.jsx)；[RemoteInputSession](../../../src/remote-input-session.mjs)绑定原 SessionInputShell、候选事件、引用 codec 和手机草稿。提交快照通过 RemoteModel 原有发送/附件路径，确认前保留持久化草稿，换会话/断线卸载取消旧编辑器。仅输入 overlay 的外层允许浮动，其他插件仍使用原缩放容器。最近核验2026-09-26，维护角色为项目协作Agent，源码、实际证据与未完成边界见[输入接入](../../integration/remote-current.md#remote-原输入编辑器2026-09-26)。

[引用候选适配](../../../src/remote-references.mjs)调用原电脑文件/聊天候选服务，文件格式借用原语法，聊天mention由Host提供；[选择页](../../../src/ui/RemoteReferences.jsx)从Remote输入框附件菜单打开并向共享草稿追加，取消/换会话/断线淘汰旧结果。状态与来源见[引用验收](../../integration/remote-current.md#文件与聊天引用选择2026-09-26)，最近核验2026-09-26，维护角色为项目协作Agent；不代表原输入候选弹层与结构化编辑器已全部接通。

[RemotePluginPanels](../../../src/remote-plugin-panels.jsx)提供原侧栏 controller/标签域与局部插槽，在支持 workspaceFiles/read 时组合[原文档预览器](../../../src/remote-document-previews.jsx)，普通文件、工具差异与插件 openResource 共用真实文件标签；旧电脑能力回退 RemoteFilePreview。完整字节由[版本校验读取器](../../../src/remote-document-read.mjs)提供；历史附件仍沿独立路径。整轮改动由[ReviewTab组合](../../../src/remote-review-preview.jsx)和[分片状态存储](../../../src/remote-review-store.mjs)接入原标签、文件选择及对比偏好，按连接隔离摘要/差异，保留电脑打开确认。工具差异的当前/历史视图按导航保存，普通文件导航重置为当前视图；从工具详情进入时关闭原模态层。导航按当前模型/会话缓存，插件内容使用统一外层缩放，原桌面侧栏 apply 由手机组合替代。维护角色：项目协作Agent；最近核验2026-09-26；[实现与MuMu边界](../../integration/remote-current.md#原整轮改动预览2026-09-26)。

[Remote核心](../../../src/remote-core.mjs)在原Gateway接收成功的`session/page`结果前调用[历史页边界检查](../../../src/remote-history-page.mjs)，复用原记录首尾序号访问器，只检查向前分页是否衔接及空页是否有进展；不替代原wire事件/页内连续性校验。错误不进入原journal的空起点降级路径，两个历史入口通过[共享读取反馈](../../../src/remote-history.mjs)提示重试，保留现有窗口。依据：[原模型回归](../../../tests/remote-model.test.mjs)及[验收记录](../../integration/remote-current.md#历史断层保留重试2026-09-25)。

[RemoteMessage](../../../src/ui/RemoteMessage.jsx)按原不可变投影节点复用已完成记录的渲染结果；[RemoteWorkspace](../../../src/ui/RemoteWorkspace.jsx)按会话稳定文件、命令、分支和Markdown回调，切换会话时更新目标。[局部插件宿主](../../../src/remote-plugin-slots.jsx)只在作用域依赖变化时更新上下文，保留插件自身的会话、语言及状态订阅。依据：[实际组件回归](../../../scripts/verify-remote-rendering.mjs)与[持续输出MuMu验收](../../integration/remote-current.md#实时输出期间的历史渲染2026-09-25)。

[模块生命周期](../../../src/remote-plugins.jsx)在电脑具备[client-entries兼容补丁](../../../../plugin/compatibility/client-entries/README.md)时增量同步原Loader，保留未变化实例；完整图负责依赖解析与诊断，apply名单保持手机能力筛选。旧电脑重建插件子树，核心/模块bootstrap变化仍重建连接。

电脑插件安装/查询取消复用原manager与execa，[进程树补丁](../../../../plugin/compatibility/plugin-install-cancel/README.md)保证Windows pnpm后代进程一起结束；手机不实现第二套包管理器，断线与安装取消保持不同语义。

[RemotePlugins](../../../src/ui/RemotePlugins.jsx)提供DSHM自有电脑插件全屏容器，通过[局部插槽宿主](../../../src/remote-plugin-slots.jsx)只渲染原main/plugins组件，保留原控制器和配置子插槽；网关与Host仅对管理设备开放pluginInventory/list。原弹窗body portal与Android返回在手机容器适配，原聊天DOM保留；[接入依据与边界](../../integration/plugin-management-current.md)。

[RemoteDesktopOpen](../../../src/ui/RemoteDesktopOpen.jsx)与[remote-desktop](../../../src/remote-desktop.mjs)共用电脑确认流程：交付/整轮改动传原记录坐标；正文、工具和插件文件在0.1.33能力协商后先取得原文件服务核验的一次性快照，再确认打开。0.1.34历史附件使用独立引用/确认通道，不能按显示名降级为路径；同名不同ID切换时重新挂载文件窗口并取消旧确认。0.1.46独立协商desktopReveal，只有原交付记录可确认后在电脑文件夹中显示；改动记录/普通路径/附件不能使用reveal。[历史附件MuMu验证](../../../scripts/verify-attachment-desktop-android.mjs)覆盖文本、PNG、取消及原件不变。卸载/连接释放取消等待，未知结果不重发。维护角色：项目协作Agent；最近核验2026-09-26，见[文件夹定位实测](../../integration/remote-current.md#交付文件在电脑文件夹中显示2026-09-26)、[正文/工具验收](../../../scripts/verify-workspace-desktop-android.mjs)及原[交付验收](../../../scripts/verify-desktop-open-android.mjs)。

- 状态：普通聊天正式入口 L01–L08 已接入并本地验收；完整 Remote 与 Android 综合体验未完成。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-09-24。
- 来源：以下实际文件与[运行记录](../../plugin-validation/results.md)。

| 模块 | 当前职责 |
| --- | --- |
| [RemoteResources](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteResources.kt) | 页面及Worker资源共用认证socket，四路并发；排队请求、在途流和控制帧均绑定资源连接代次，断开后不得借用新连接。原生竞争回归及MuMu真实加载/重连证据见[资源隔离](../../integration/remote-current.md#原生排队资源的连接隔离2026-09-25) |
| [RemoteComputerKey](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteComputerKey.kt) | 生产原生密码窗口使用手机局部语言资源，原密码控件/光标、移除确认、提交锁和结果过滤保持；不会经网页返回输入值。2026-09-25[隔离生产窗口与MuMu真实取消入口](../../integration/appearance-current.md)通过，真实 set/unset 英文链路仍待专项 |
| [RemoteNotifications](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteNotifications.kt)、[PhoneAppearance](../../../android/app/src/main/java/dev/dshmobile/validation/PhoneAppearance.kt) | 原生提醒使用局部中英文资源，不改系统语言；已打开窗口及仍显示的通知即时更新，保留分类开关/原通知身份与点击目标。2026-09-25[MuMu真实完成通知及两个入口](../../integration/notifications-current.md)通过；其余原生窗口、横幅/锁屏/冷启动语言待专项验收 |
| [RemoteAgentPresets](../../../src/ui/RemoteAgentPresets.jsx)、[RemotePermissions](../../../src/ui/RemotePermissions.jsx)、[RemoteSkills](../../../src/ui/RemoteSkills.jsx)、[RemoteSubagents](../../../src/ui/RemoteSubagents.jsx) | 模式/权限使用原上游语言字典，原自定义名称/说明保留；技能搜索、权限勾选跨语言保持，目录版本变化仍撤下旧确认，inactive子会话不等同完成。2026-09-25按[组件与实际入口](../../integration/appearance-current.md)核验；原操作值/权限条件保持，英文写入与非空子会话实测仍待完成 |
| [RemoteComputerSettings](../../../src/ui/RemoteComputerSettings.jsx)、[RemotePlugins](../../../src/ui/RemotePlugins.jsx) | 设置/Key状态/地址确认与插件列表固定文案使用共享手机语言；语言变化不重新触发读取或修改设置草稿，原始值/URL/插件标识保持。自适应仍是手机本地用户覆盖优先，原设置权限/版本/未知结果规则保持。2026-09-25依据[组件与MuMu实际入口](../../integration/appearance-current.md)；已授权表单读取/草稿取消、原生密码窗口即时翻译后取消通过，英文真实提交仍待专项 |
| [RemoteInteraction](../../../src/ui/RemoteInteraction.jsx)、[RemoteMessage](../../../src/ui/RemoteMessage.jsx)、[RemoteQueue](../../../src/ui/RemoteQueue.jsx)、[RemotePlanMode](../../../src/ui/RemotePlanMode.jsx) | 固定卡片文案由共享翻译上下文呈现，原问题/选项/计划/参数输出不翻译。切语言保留React状态，审批结果及计划选项仍按原协议提交；未知结果保持锁定。2026-09-25依据[组件与真实提问核验](../../integration/appearance-current.md) |
| [phone-appearance](../../../src/phone-appearance.mjs)、[PhoneAppearance](../../../android/app/src/main/java/dev/dshmobile/validation/PhoneAppearance.kt) | 普通聊天外观和语言串行镜像到原生四个固定字段；Remote只读并复用ThemePresenter、共享LocaleProvider与原LocaleRuntime。旧三个字段写入保留语言。监听随页面释放，旧读取丢弃；不共享凭据或修改电脑配置。2026-09-25以[真实入口及测试](../../integration/appearance-current.md)核验；主题通知冷启动通过，语言冷入口另待验收 |
| [RemoteNoticeConnection](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeConnection.kt)、[RemoteNoticeLedger](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeLedger.kt) | Application拥有固定协商/只读提醒流，与聊天页面使用独立连接、共用原DPoP请求构造；有界帧队列及代次拒绝、初始集合不通知、进程内去重。主动断开持久暂停，网络中断有界退避，进程结束不唤醒。2026-09-25依据[原生检查](../../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteNoticeChecks.kt)和[实际MuMu入口](../../integration/notifications-current.md)核验 |
| [RemoteApp](../../../src/RemoteApp.jsx)、[captureRemoteResume](../../../src/remote-resume.mjs) | 核心更新释放旧模型前将只读视图/草稿交给跨尝试的恢复状态；成功呈现后清除，明确断开/权限失效不恢复、不重放写操作。2026-09-25以[实际组件生命周期回放](../../../scripts/verify-remote-app-recovery.mjs)及[MuMu重建途中断网](../../../scripts/verify-core-rebuild-android.mjs)核验 |
| [remote-output-ansi.mjs](../../../src/remote-output-ansi.mjs)、[RemoteOutputContent](../../../src/ui/RemoteLiveJobOutput.jsx) | 前台命令/后台任务共用有界ANSI显示上下文，历史页和128K裁剪保留SGR颜色与装饰；跨块控制序列暂存最多256字符、OSC不缓存正文。原始复制内容和字节游标独立，继续复用上游parseAnsiLines；不提供终端写入或完整终端仿真。窗口交接使用paused状态和手动续读，错误只由实际校验/读取失败产生，分段模式暂停时不提供下一段入口。2026-09-26依据[测试](../../../tests/remote-output-ansi.test.mjs)和[真实验收](../../integration/remote-current.md#输出交接的暂停状态2026-09-26)核验 |
| [remote-drafts.mjs](../../../src/remote-drafts.mjs)、[remote-draft-database.mjs](../../../src/remote-draft-database.mjs)、[remote-attachment-drafts.mjs](../../../src/remote-attachment-drafts.mjs) | Remote 独立 IndexedDB 保存文字与附件 Blob 原件，原生 binding.info 的 origin/deviceId/fingerprint 与会话共同隔离；严格事务提交、旧文本迁移及移除绑定清理。RemoteModel 首次呈现前恢复，文件重新获取电脑回执，图片保留字节；提交前持久标记未知，在途重试保存不能清除此标记。保存失败提示/重试，不持久化附件票据或自动重放消息 |
| [remote-workflow-slots.jsx](../../../src/remote-workflow-slots.jsx)、[remote-workflows.mjs](../../../src/remote-workflows.mjs) | 复用原工作流 definition/字典/卡片，仅将原桌面导航改接 DSHM 子会话。点击核对当前父会话、可见记录与运行成员，返回保留草稿；外层自适应仍由用户控制。真实状态与重开历史见[当前验收](../../integration/remote-current.md) |
| [remote-endpoint.mjs](../../../src/remote-endpoint.mjs)、[RemoteComputerEndpoint.jsx](../../../src/ui/RemoteComputerEndpoint.jsx) | 电脑模型服务站点投影、完整新地址输入、目的地确认和恢复默认；管理权限/原版本/连接快照约束，未知结果不重试。Host [ComputerEndpoint](../../../../plugin/src/computer-endpoint.ts)复用原DeepSeek解析器及SettingsProvider，不回传旧地址中的路径/认证/查询 |
| [remote-key.mjs](../../../src/remote-key.mjs)、[RemoteComputerKey.jsx](../../../src/ui/RemoteComputerKey.jsx)、[RemoteComputerKey.kt](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteComputerKey.kt) | 自有电脑Key状态与原生密码窗口，页面只传快照；原生直发受限写入并隔离响应，未知结果不重试。Host使用原凭据服务，默认引用固定，详见[设置边界](../../../../docs/project-knowledge/knowledge/domains/remote-access/settings-boundary.md) |
| [remote-session-export.mjs](../../../src/remote-session-export.mjs)、[RemoteSessionExport.jsx](../../../src/ui/RemoteSessionExport.jsx) | 原日志 ZIP 的有界消费与自有导出窗口；复用原生下载暂存/保存，取消或断线不交付部分文件。连接未就绪时禁止导出并优先解释连接状态，本代协商后才判断缺能力，保留导出选项；[状态依据](../../integration/remote-current.md#日志导出的连接状态2026-09-26)。Host固定路由见 [session-export.ts](../../../../plugin/src/session-export.ts)；[MuMu脚本](../../../scripts/verify-session-export-android.mjs)验证真实菜单和系统保存 |
| [remote-workspaces.mjs](../../../src/remote-workspaces.mjs)、[RemoteWorkspaces.jsx](../../../src/ui/RemoteWorkspaces.jsx) | 自有工作区管理窗口，复用原 ClientWorkspaceModel 改名/排序/移除注册；能力与设备管理授权双重检查、显式移除确认、旧目标与重复写入保护，未知结果不自动重发。基础路径、内容保留及权限收回见 [真实 Android 验证](../../../scripts/verify-remote-workspaces-android.mjs) |
| [PairingEntryActivity.kt](../../../android/app/src/main/java/dev/dshmobile/validation/PairingEntryActivity.kt)、[RemotePairLink.kt](../../../android/app/src/main/java/dev/dshmobile/validation/RemotePairLink.kt)、[RemotePairHandoff.kt](../../../android/app/src/main/java/dev/dshmobile/validation/RemotePairHandoff.kt) | 系统 ACTION_SEND 与 dshm 链接的窄入口，独立入口任务栈、严格原生解析与单次内存交接；已有绑定不替换、确认前不联网。RemoteApp 从同源 binding.link 领取待填链接，WebView 不导航外部 URI；冷启动返回创建普通聊天入口。主包与独立配对验收包使用不同 UID/存储 |
| [remote-subagents.mjs](../../../src/remote-subagents.mjs)、[RemoteSubagents.jsx](../../../src/ui/RemoteSubagents.jsx) | 子会话目录和只读/可继续边界；RemoteModel 沿用 ClientSessions 的父子地址、目录事件和会话投影，返回链及重建保留地址，发送保留回显 requestId。真实验收见 [基础脚本](../../../scripts/verify-remote-subagents-android.mjs)、[重启恢复](../../../scripts/verify-remote-child-recovery-android.mjs)、[图片接纳与拒绝](../../../scripts/verify-remote-child-images-android.mjs) |
| [remote-plan-mode.mjs](../../../src/remote-plan-mode.mjs)、[RemotePlanMode.jsx](../../../src/ui/RemotePlanMode.jsx) | 计划模式自有窗口，复用原 plan 投影与 commands 接口；目录核对原定义，固定进入/退出参数、会话隔离、未知结果不重试。真实双端验证见 [Android 脚本](../../../scripts/verify-remote-plan-mode-android.mjs) |
| [ordinary-rendering.jsx](../../../src/ordinary-rendering.jsx) | 普通聊天与 Remote 共用原 MarkdownText；按语言缓存 labels，保留上游流式增量解析和已完成历史缓存。[缓存回归](../../../scripts/verify-markdown-cache.mjs)只对独立测试包插入解析计数，不修改上游或 APK |
| [RemoteSchedules.jsx](../../../src/ui/RemoteSchedules.jsx) | 从 RemoteModel 当前会话 schedule face 读取原提醒列表，按时间排序，区分未提供、空列表、待触发/已到时和断线快照。创建/删除沿用原聊天工具；不根据时钟伪造已执行或另建手机调度。日期/重复频率按手机语言格式化，原时间戳和提醒内容保持；语言只影响显示。入口实测脚本为 [verify-remote-schedules.mjs](../../../scripts/verify-remote-schedules.mjs)，语言边界见[记录](../../integration/appearance-current.md) |
| [RemoteJobs.jsx](../../../src/ui/RemoteJobs.jsx)、[remote-job-actions.mjs](../../../src/remote-job-actions.mjs) | 读取同一 ClientSessions 的 jobsBySession 镜像，按当前会话显示后台任务与结束详情；窗口内计时、断线标记最近状态。固定 jobStop 核对会话与任务身份，确认后提交，不乐观写入结束状态，未知结果不自动重发。[Android 验证](../../../scripts/verify-remote-jobs.mjs)核对真实进程完成和确认停止 |
| [RemoteJobOutput.jsx](../../../src/ui/RemoteJobOutput.jsx)、[remote-job-output.mjs](../../../src/remote-job-output.mjs) | 只读同一会话的原工具投影，按任务 id/开始时间与调用时间关联 job_output，保留每次读取、嵌套调用及截断提示；不调用共享消费式 jobs.read。支持全屏、分段复制、长内容展开、历史分页，任务替换或切换会话时不显示旧记录。不是尚未写入会话的完整实时输出通道 |
| [remote-goals.mjs](../../../src/remote-goals.mjs)、[RemoteGoal.jsx](../../../src/ui/RemoteGoal.jsx) | 原 Goal 生成接口、持久投影和 activation 事件；手机目标摘要与生命周期窗口，版本检查、会话/连接代次隔离、未知结果不重放。[Android 验证](../../../scripts/verify-remote-goals.mjs)只操作 DSH-TEST 专用目标 |
| [remote-agent-presets.mjs](../../../src/remote-agent-presets.mjs)、[RemoteAgentPresets.jsx](../../../src/ui/RemoteAgentPresets.jsx) | 原 readRoster/presetOptions 与生成 select；健康模式目录、电脑开关、第一轮前选择及当前投影。与发送互斥，未知结果不重发；[Android 验证](../../../scripts/verify-remote-agent-presets.mjs)只在 DSH-TEST 专用空白会话选择极简模式 |
| [remote-permissions.mjs](../../../src/remote-permissions.mjs)、[RemotePermissions.jsx](../../../src/ui/RemotePermissions.jsx) | 原 PermissionCatalogDirectory 与生成 commands.execute 接口，权限当前值来自同一会话投影；保留业务拒绝与危险预设确认，目录失效/断线/未知结果不重放。[Android 验证](../../../scripts/verify-remote-permissions.mjs)只在专用 DSH-TEST 会话收紧权限 |
| [remote-skills.mjs](../../../src/remote-skills.mjs)、[RemoteSkills.jsx](../../../src/ui/RemoteSkills.jsx) | 原 skills/list + commands/list 按当前会话读取目录，复用原命令冲突解析与搜索排序；手机选择只插入原技能文本，电脑执行 pre-step。会话/世代/预设变更清理旧结果；[Android 验证](../../../scripts/verify-remote-skills.mjs)覆盖真实目录、正文预览与调用同步 |
| [remote-changes.mjs](../../../src/remote-changes.mjs)、[RemoteDiff.jsx](../../../src/ui/RemoteDiff.jsx) | 原逐轮公告进入手机聊天投影，固定分片流读取 summary/diff；复用原行号计算与工具 DiffBlock，窗口区分历史差异和当前完整文件，取消与记录失效不回填旧内容 |
| [remote-images.mjs](../../../src/remote-images.mjs)、[RemoteImages.jsx](../../../src/ui/RemoteImages.jsx) | 原附件流按会话/可视区域共享读取，最多 2 张同时读取、64 MiB 引用字节额度；复用原 ImageBody，离屏/收起/会话销毁释放。待发送图片只接受本机 File 或本模型持有的 URL；[实际检查](../../../scripts/verify-inline-images.mjs)覆盖 MuMu 历史/工具 PNG、全屏与返回 |
| [RemoteHtmlPreview.jsx](../../../src/ui/RemoteHtmlPreview.jsx) 的附件分支 | 与电脑 HTML 文件共用独立沙箱；附件仅按原始内容打包，不解析显示名为工作区路径。缺失引用依赖明确报错；实际入口见 [HTML 附件脚本](../../../scripts/verify-html-attachment.mjs) |
| [remote-image-input.mjs](../../../src/remote-image-input.mjs)、[remote-upload.mjs](../../../src/remote-upload.mjs) | 图片保留系统 File，发送时构造原图片内容；remote.prompt 仅分片转发原 session/prompt 或 subagents/prompt 信封，不把图片变成文件 receipt；原 Host 负责模型能力与附件接纳，未知结果不重放 |
| [remote-files.mjs](../../../src/remote-files.mjs)、[RemoteFilePreview.jsx](../../../src/ui/RemoteFilePreview.jsx) | Host 原 stat/readBytes 有界读取，首尾及每块版本检查；工具与 Markdown 链接进入 DSHM 文本/图片/PDF/HTML/Office 预览，刷新/取消/错误清理及全屏。文件/差异/命令窗口使用共享手机语言，图片/PDF选用上游语言包；仅显示文案变化，不重建读取器、资源或HTML子页面，原始数据保留。2026-09-25实际入口证据见[外观记录](../../integration/appearance-current.md) |
| [remote-office.mjs](../../../src/remote-office.mjs) | 电脑文件使用 `remote.office`，聊天附件使用 `remote.attachmentOffice`；等待最终源权限/版本或附件身份确认才交给共用 PDF 渲染器。32 MiB 上限、180 秒总时限；[Office 入口](../../../scripts/verify-remote-mobile-android.mjs) 的 `--office` 与[附件验证](../../../scripts/verify-office-attachment.mjs) 分别覆盖两种来源 |
| [remote-attachments.mjs](../../../src/remote-attachments.mjs) | 读取原会话文件/图片附件，统一接入文件窗口及下载器；校验身份/偏移/长度与最终完成，界面显示名不参与路径授权；[实测脚本](../../../scripts/verify-remote-mobile-android.mjs) 的 `--attachment` / `--attachment-image` 分别覆盖文本历史与工具图片 |
| [RemoteHtmlPreview.jsx](../../../src/ui/RemoteHtmlPreview.jsx)、[remote-html.mjs](../../../src/remote-html.mjs)、[RemoteHtmlResources.kt](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteHtmlResources.kt) | 复用原 HTML 直接脚本/样式打包，依赖由主页面按原会话权限读取；原生分块暂存至独立来源，沙箱禁网络/桥/父页面访问；关闭与连接代次失效撤销文档 |
| [RemotePdfPreview.jsx](../../../src/ui/RemotePdfPreview.jsx)、[pdf-assets.mjs](../../../scripts/pdf-assets.mjs) | 仅提供上游 PDF 局部组件需要的页码状态与取消生命周期；同版本 legacy 引擎、Worker 和字体按需打包，Worker 独立补齐旧 WebView 方法；预览上限 32 MiB |
| [remote-download.mjs](../../../src/remote-download.mjs)、[RemoteDownloads.kt](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteDownloads.kt)、[RemoteDownloadStore.kt](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteDownloadStore.kt) | 最新文件逐块确认，私有磁盘暂存和系统保存窗口；单个 256 MiB 上限，连接代次与旧 ID 隔离。取消/断线关闭系统窗口，保留待办至回调以清理迟到文档并避免新旧保存串位，不自动恢复下载；[验证边界](../../integration/remote-current.md#系统保存窗口断线取消2026-09-26) |
| [RemoteShareFiles.kt](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteShareFiles.kt)、[RemoteFileProvider.kt](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteFileProvider.kt) | 复用完整下载后生成独立快照，只经系统面板交付临时只读 URI；8 个/512 MiB 缓存上限、1 小时新读取有效期，按期或下次初始化清理；不宣称接收 App 已完成发送 |
| [mobile-main.jsx](../../../src/mobile-main.jsx)、[OrdinaryApp.jsx](../../../src/OrdinaryApp.jsx)、[ui](../../../src/ui/) | Android 默认普通聊天入口、已确认的共享视觉组件、抽屉与搜索、设置/附件/分支交互；正式页面不使用设计预览数据 |
| [ordinary-session.mjs](../../../src/ordinary-session.mjs)、[ordinary-models.mjs](../../../src/ordinary-models.mjs)、[ordinary-options.mjs](../../../src/ordinary-options.mjs) | 可订阅会话状态、请求归属与串行持久化、模型能力及每轮参数快照 |
| [ordinary-backup.mjs](../../../src/ordinary-backup.mjs)、[ordinary-attachments.mjs](../../../src/ordinary-attachments.mjs)、[OrdinaryFiles.kt](../../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryFiles.kt) | 备份白名单与整体事务、真实模型附件块、系统单文件选择与导出授权 |
| [plugin-host.jsx](../../../src/plugin-host.jsx)、[phone-plugins.mjs](../../../src/phone-plugins.mjs)、[ordinary-rendering.jsx](../../../src/ordinary-rendering.jsx) | 真实 Cordis 宿主、三个随包兼容插件的生命周期与配置、原 Markdown 插槽；失败回滚与设置保留 |
| [ordinary-clipboard.mjs](../../../src/ordinary-clipboard.mjs)、[ui/locale.jsx](../../../src/ui/locale.jsx) | 原代码/回复复制的手机写入适配，共用桥分发器；本地语言在正式页面传播，不翻译用户内容 |
| [普通聊天设计预览](../../design/ordinary-preview/README.md)、[Remote 预览](../../design/ordinary-preview/remote-preview.md) | 独立 React 页面，直接引用上游主题/视觉组件；内存示例覆盖普通聊天、抽屉、配对、任务列表、已有工作区新建和连接状态，以及[远程详情](../../design/ordinary-preview/remote-chat-preview.md)的历史、审批提问、队列、文件与只读命令；共用 PreviewComposer；[插件管理预览](../../design/ordinary-preview/plugins-preview.md)按手机/电脑隔离示例数据，覆盖生命周期与权限异常；[设置预览](../../design/ordinary-preview/settings-preview.md)与内存聊天和 Remote 状态联动，提供 loopback 示例备份下载；不连接验证 App 的数据或服务 |
| [build-web.mjs](../../../scripts/build-web.mjs) | 复制已发布的原始插件 bundle，记录版本、大小和 SHA256；构建验证页面与平台共享依赖 |
| [main.jsx](../../../src/main.jsx) | 启动真实 Cordis/Modules/Slots，声明测试插槽；主题 DOM presenter 随 theme 服务启停，根页独立保留重新加载入口；实际卸载与重载主题/样例 |
| [local-settings.mjs](../../../src/local-settings.mjs) | localStorage 持久化的主题/语言 provider；有 schema、revision、串行原子提交和订阅，不提供电脑 Session |
| [input-runtime.mjs](../../../src/input-runtime.mjs)、[input-validation.jsx](../../../src/input-validation.jsx) | 原 InputTriggerController/MenuView + 本地纯文本草稿适配；真实 Cordis 插入事件、revision CAS、组合输入与提示词源释放，不等同于完整输入插件 |
| [ordinary-input.mjs](../../../src/ordinary-input.mjs)、[ordinary-composer.jsx](../../../src/ordinary-composer.jsx) | 加载原输入插件入口/服务/菜单插槽，仅在隔离服务范围提供实际普通聊天身份；插入进入真实草稿和发送链 |
| [ordinary-stream.mjs](../../../src/ordinary-stream.mjs) | 公开 Chat Completions 流解析、固定单次请求归属、停止/断流/结束原因；不包含请求地址、Key、持久化或 Remote |
| [stream-validation.jsx](../../../src/stream-validation.jsx)、[stream-fixtures.mjs](../../../src/stream-fixtures.mjs) | 明确标记为离线测试的完整/中断/停止回放；调用同一个流解析模块，不冒充真实模型 |
| [verify-web.mjs](../../../scripts/verify-web.mjs) | Edge 实际页面回归，检查刷新持久化、配置表单和 20 次生命周期 |
| [check-theme.mjs](../../../scripts/check-theme.mjs) | Web/MuMu 共用的主题 20 次循环，检查原样式/设置项和 DOM 清理、持久设置恢复、输入与流状态保留 |
| [Android Activity](../../../android/app/src/main/java/dev/dshmobile/validation/ValidationActivity.kt) | 本地 HTTPS assets 承载同一个 dist；安装受限普通聊天桥，完整 Remote 尚未接入 |
| [OrdinaryBridge.kt](../../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryBridge.kt)、[OrdinaryCredentials.kt](../../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryCredentials.kt) | 主框架/origin 限制、原生密码配置、Keystore 加密、固定 DeepSeek 网络请求；不返回 Key |
| [RemoteActivity.kt](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteActivity.kt)、[RemoteBridge.kt](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)、[RemoteIdentity.kt](../../../android/app/src/main/java/dev/dshmobile/validation/RemoteIdentity.kt) | 独立 origin/WebView、原生 P-256 签名、独立加密 token、已有 HTTP/WS 协议与生命周期 |
| [RemotePairScanner.kt](../../../android/app/src/main/java/dev/dshmobile/validation/RemotePairScanner.kt)、[RemotePairQr.kt](../../../android/app/src/main/java/dev/dshmobile/validation/RemotePairQr.kt) | 未绑定主页面的相机/系统图片选择入口；本地受限解码，复用配对解析器，只回填链接不领取；页面与请求代次失效后丢弃结果 |
| [remote-client.mjs](../../../src/remote-client.mjs)、[remote-transport.mjs](../../../src/remote-transport.mjs)、[remote-main.jsx](../../../src/remote-main.jsx) | 独立原生桥、协商与原 RPC/流/上传通道，身份不交给页面 |
| [remote-model.mjs](../../../src/remote-model.mjs)、[RemoteApp.jsx](../../../src/RemoteApp.jsx)、[RemoteWorkspace.jsx](../../../src/ui/RemoteWorkspace.jsx)、[remote-history-position.mjs](../../../src/remote-history-position.mjs)、[remote-history.mjs](../../../src/remote-history.mjs) | 仅组装上游 ClientSessions、UiConversation、工作区和事件数据；手机自有页面订阅投影，不启动整个电脑客户端。草稿/附件归属会话，原结果确认后更新操作状态。分页按存活消息定位，旧会话/连接结果不调整新页面；聊天和任务历史共用只读分页交付检查，识别原方法消化的读取失败，不以实时追加代替分页成功。列表正文搜索复用原 session.search，取消迟到结果，展示纯文本摘要、索引未启用/失败及结果上限；不在手机另建电脑历史索引 |
| [remote-core.mjs](../../../src/remote-core.mjs) | 原 Connection/Gateway/Registry 独占事件与真实世代，原 Agent owned scope 与 PendingApproval/Question 负责归属和一次性答复；取消或失败不重发旧答案 |
| [remote-resume.mjs](../../../src/remote-resume.mjs)、[重启验收](../../../scripts/verify-remote-host-restart.mjs) | Host 重启导致核心模块版本变化时由 RemoteApp 串行重建环境，重新核对同一会话；只转移草稿及未发送图片，不复用上传凭据、在途操作或审批。原 Gateway 根据中继明确断线标记恢复订阅，插件图随真实连接世代重订阅 |
| [Remote 模型选择](../../../src/remote-model.mjs)、[手机验证](../../../scripts/verify-remote-models.mjs) | 复用原 ModelCatalogDirectory，电脑事件/连接世代更新目录；同一会话投影决定当前值，失败可重试但不自动重放模型写入，进行中禁止切换 |
| [共用输入框指针回归](../../../scripts/verify-composer-focus.mjs) | 真实 MobileComposer 在有滚动的布局里验证鼠标/触摸第一次点击、草稿及 Esc；失焦收起等待点击完成，不在按下和松开之间移动外部目标 |
| [ChatMessage.jsx](../../../src/ui/ChatMessage.jsx)、[MobileComposer.jsx](../../../src/ui/MobileComposer.jsx)、[RemoteMessage.jsx](../../../src/ui/RemoteMessage.jsx) | 普通聊天/Remote 共用消息布局和输入框；Remote 将原投影内容交给共享组件，并显示工具、上下文与附件 |
| [remote-plugin-slots.jsx](../../../src/remote-plugin-slots.jsx)、[菜单动作](../../../src/remote-command-actions.jsx)、[评价同步](../../../src/remote-feedback-sync.mjs)、[插槽回归](../../../scripts/verify-remote-plugin-slots.mjs)、[反馈实测](../../../scripts/verify-feedback-android.mjs) | 自有根页面声明轮尾/回复操作、唯一会话级输入覆盖层及扩展节点插槽；原命令服务派生连接菜单到原反馈action，目录读取不回退命令执行。原反馈controller按绑定事件及[冷通知](../../../src/remote-feedback-notifications.mjs)共享重读，保留串行写入/CAS且不轮询；独立通知握手/重连刷新，离开取消；UiSession与聊天共用模型。进入读取和两入口取消已实测，真实反馈写入同步未验。禁止插件替换root，未覆盖全部节点owner能力 |
| [remote-plugins.jsx](../../../src/remote-plugins.jsx)、[组合策略](../../../src/remote-plugin-policy.mjs) | bootstrap 先加载电脑生成接口，再由 Loader 启动局部插件；完整模块表保留，手机已承担或缺少获准接口的 apply 不重复执行。普通图更新重建子树，核心 revision 变化要求重新连接 |
| [remote-plugin-settings.jsx](../../../src/remote-plugin-settings.jsx)、[局部 scope](../../../src/remote-plugin-settings.mjs)、[搜索配置](../../../src/remote-web-search-settings.jsx) | 原 BashCard/AgentLoopCard/SubagentCard 及原控制器绑定 Host 固定字段投影；搜索次数复用CardForm/ValueField，Key与地址复用独立边界。Subagent两部分保留独立版本、模型字段原子保存，目录走原session.modelCatalog。DSHM外层恢复默认确认同时移除两个模型字段覆盖，保留运行限制；草稿/写入时禁用，版本或连接变化使确认失效。沿用管理授权/快照，不提供通用settings/credentials；电脑变更禁写旧表单，未知结果不重发。2026-09-26核验，见[配置记录](../../integration/plugin-management-current.md) |
| [mobile-plugin-layout.mjs](../../../src/mobile-plugin-layout.mjs)、[MobilePluginFrame.jsx](../../../src/ui/MobilePluginFrame.jsx) | 插件最外层比例缩放、ResizeObserver 占位与同插件嵌套去重；作者声明随 fiber 释放，用户覆盖独立来源持久化并优先 |
| [RemoteInteraction.jsx](../../../src/ui/RemoteInteraction.jsx)、[RemoteQueue.jsx](../../../src/ui/RemoteQueue.jsx) | 原事件归属的审批/提问/计划和电脑权威队列；计划识别复用 planReviewOf，提出修改使用 PendingQuestion.cancel，取消事件撤下旧交互，不自动重放答案或写操作 |
| [remote-commands.mjs](../../../src/remote-commands.mjs)、[RemoteCommand.jsx](../../../src/ui/RemoteCommand.jsx)、[remote-tool-row.mjs](../../../src/remote-tool-row.mjs) | 原工具状态/退出码解析与只读命令窗口，按会话节点坐标更新，原 TerminalBlock 展示输出；共享状态适配识别 Host 的两个 ABORTED 取消码与投影 interrupted，不从错误文字推断。工作流通用记录只表示调用结束，执行结果以原工作流卡片为准。不连接具有输入所有权的交互终端，不推断后台/持久 shell 的退出状态 |
| [remote-forks.mjs](../../../src/remote-forks.mjs)、[按轮验证](../../../scripts/verify-turn-fork.mjs) | 原轮尾条件选取消息序号，手机文件改动按钮不改变分支边界；模型层防止并行提交和迟到切换，真实验收检查历史前缀/独立续聊/原草稿及测试归档 |
| [ordinary-chat.jsx](../../../src/ordinary-chat.jsx)、[ordinary-history.mjs](../../../src/ordinary-history.mjs)、[ordinary-native.mjs](../../../src/ordinary-native.mjs) | 普通聊天验证 UI、IndexedDB 历史和 RPC pull 流适配；MuMu 真实回复、上下文、停止与历史恢复已通过 |
| [verify-live-ordinary.mjs](../../../scripts/verify-live-ordinary.mjs) | 显式 opt-in 的真实 API 三轮测试，覆盖流式插件启停、停止、进程重启历史一致；不读取 Key，不加入默认回归 |
| [measure-page.mjs](../../../scripts/measure-page.mjs)、[measure-android-page.mjs](../../../scripts/measure-android-page.mjs) | Lighthouse 标准导航指标与实际 MuMu 页面观察分开报告；每组3次，不能称真机或正式产品结果 |
| [NativeInputProbeActivity](../../../android/app/src/debug/java/dev/dshmobile/validation/NativeInputProbeActivity.kt)、[diagnose-ime.mjs](../../../scripts/diagnose-ime.mjs) | debug 专用原生 EditText 对照；比较系统键盘窗口几何，不修改输入法、不保存输入，release manifest 不含此入口 |

[remote-settings.mjs](../../../src/remote-settings.mjs)与[RemoteComputerSettings.jsx](../../../src/ui/RemoteComputerSettings.jsx)提供电脑五个非敏感设置的自有表单，固定协议读写由Host原SettingsProvider执行。设备管理授权、快照/版本、连接代次与未知写入隔离独立于手机普通聊天配置；不开放通用settings/credentials。真实入口见[验证脚本](../../../scripts/verify-computer-settings-android.mjs)。

[RemoteConnectionNotice](../../../src/ui/RemoteConnectionNotice.jsx)统一管理页面与日志导出的连接提示：本代能力协商完成前不把缺失能力解释为无权限或旧版本。设置保留已加载表单与地址确认，离线禁用操作；工作区管理保留本地改名状态。实际保存仍受服务原连接代次和版本检查约束，不自动重读或重发。来源与验收边界见[管理页面断线恢复](../../integration/remote-current.md#管理页面断线恢复2026-09-26)。

设计预览的连接状态由 Remote 统一提供给设置与电脑插件页；普通聊天模型/思考按会话保存，草稿与阅读位置跨页保留。返回优先关闭顶层弹窗，断线/撤销不重放写操作。具体核对见[全流程交互核对](../../design/ordinary-preview/flow-audit.md)。

DSH 参考检出保持只读。npm 发布的 `0.1.6-alpha.2` bundle 和本地基线源码分别记录来源，不能只凭版本号推定二者每行一致。上游 fixture 是官方测试样例，不冒充市场插件。

根 Web 环境没有 Host `sessions`、workspace 或 Agent 服务。仅在原输入插件的隔离范围提供当前普通聊天身份及对应 SessionProvider，未宣称完整 DSH Session 兼容。安全与存储边界见[普通原生接入](../../plugin-validation/ordinary-native.md)及[Remote 隔离](../../plugin-validation/remote-native.md)。
