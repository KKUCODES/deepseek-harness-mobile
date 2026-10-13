# 新版后台任务目录与手机独立输出

- 状态：固定发布和源码 Host 的真实 Android 任务目录、运行中两类输出、模型消费后的完整重读、历史重入及显式断开/重连通过；手机停止后台任务、保留输出且不影响另一任务也已在两种入口通过。约421KB大输出、四段历史及结算重入已在两种入口通过；源码首轮额外模型调用的失败保留，更多网络异常仍待专项。
- 维护角色：DSH Mobile 项目协作 Agent；核验日期：2026-10-06。
- 目标：DSH `0.2.1-alpha.1`、候选插件 `0.1.76-latest.0`；日常旧版支持声明不变。
- 来源：[手机任务装配](../../src/remote-plugins.jsx)、[共享模型](../../src/remote-model.mjs)、[视图生命周期](../../src/remote-session-view.mjs)、[两版任务读取](../../src/remote-jobs.mjs)、[协议边界](../../../backend/packages/protocol/src/remote-policy.ts)、[实际 Android 验证器](../../scripts/verify-latest-live-background-android.mjs)。

## 契约迁移与实现

新版实际手机快照已经没有 `list.jobsBySession`，原四个消费者直接索引该字段会抛错。官方任务目录独立为 `job.list({sessionId}, signal)`，每帧 `{type:'rows', jobs}` 替换完整可见集合；原 `ClientJobs` 服务共享观察引用、管理连接恢复与异步释放。依据固定源码 [Host 入口](../../../plugin/artifacts/latest-source-check/packages/api/job-controller/src/index.ts)、[协议类型](../../../plugin/artifacts/latest-source-check/packages/api/job-controller/src/types.ts)、[客户端服务](../../../plugin/artifacts/latest-source-check/packages/api/job-controller/src/client/service.ts)。不从聊天文本推断任务，也不补一个永远为空的旧字段冒充兼容。

手机从当前电脑模块图导入原任务客户端，在聊天装配前安装一次；该插件由手机组合，后续插件树不重复安装。主聊天和旁栏都在接受选择时保留任务目录，换页/销毁释放；原服务对相同会话引用计数。原 Session store 不修改，共享手机快照新增原 `jobs`；任务列表、停止身份校验、聊天输出记录与独立输出统一读取新版 rows 或旧版 control 镜像。任务客户端模块更新纳入核心重建判断。

网关只新增已审阅的只读 `job/list` 流：新版公布，旧版拒绝；仅允许 `args.request.sessionId`，限制长度和控制字符，拒绝额外路径、jobId、信号或任意参数。Host 继续校验会话可见性。`job/follow`、`job/kill` 未新增开放；独立有界字节读取和带 Host 代次/开始时间的停止仍沿用项目现有受限接口。

## 真实发布入口验收

原 supervisor `22926` 正常停止并以退出码 0 结束，证明前轮新增的成功清理后退出已实际生效。更新协议/候选后恢复同一 home、数据库、网关 16901 和原绑定；Host `73768` → `71060`。电脑身份、两设备状态及全部五会话 ID/标题/序号/统计/权限/模型/模式逐项一致，管理权限 false，没有 Key 读取或复制。依据 [恢复前](../../../plugin/artifacts/latest-runtime-check/latest-live-job-roster-resume-before.json)、[恢复后](../../../plugin/artifacts/latest-runtime-check/latest-live-job-roster-resume-after.json)。当前控制器继续运行，最终停止仍在整体验收清理阶段执行。

新版 Web 构建、Android `assembleDebug`/`lintDebug` 通过；仅覆盖安装 `.latesttest`，没有 `pm clear`。APK 内 165 个 Web 文件与候选 dist 逐字节一致，SHA-256 `da699547bc8ca9500ab348f97a18721eb3413508710b489f07bd1e3525f856f6`，见 [产物核对](../../../plugin/artifacts/latest-runtime-check/latest-live-job-roster-apk.json)。当前真实手机服务存在，任务插件状态 mobile、原旧字段不存在，见 [手机状态](../../../plugin/artifacts/latest-runtime-check/latest-live-job-roster-phone-state.json)。

沿用专用只读会话 `session-4b9b57e5-e52f-4ed5-950f-bf00b6a957c3`，不新建工作区或聊天。真实模型只启动一次 `pwsh` 后台命令，打印中文/emoji 标准流与错误流，等待 60 秒，再打印结束标记；没有文件操作、联网或提权。任务 `pwsh-1`、原调用 `call_00_ET_TmrqBrp5DN8mptApOeet3469` 保持同一身份。

- [运行中](../../../plugin/artifacts/latest-runtime-check/latest-live-background-android-start.json)：原任务 running 时，手机已显示两类输出，非等待最终结果。
- [结算](../../../plugin/artifacts/latest-runtime-check/latest-live-background-android-observe.json)：目录显示 completed，手机两类完整输出无替换字符，原只读权限保持。
- [模型消费后的历史重读](../../../plugin/artifacts/latest-runtime-check/latest-live-background-android-replay.json)：模型首次 `job_output` 尚无文字；任务完成后原通知引发第二次 `job_output`，原调用 `call_00_isBQJaMrWS26wu5ICyxd9069` 返回两类完整内容及原退出码 0。手机退出聊天再进入后完整内容仍可读取，规范化 CRLF 后与同一原消费结果逐项匹配。
- [显式断开/重连](../../../plugin/artifacts/latest-runtime-check/latest-live-background-android-reconnect.json)：实际连接菜单断开与重新连接，指纹保持，重新装配原任务服务；同一会话再次读取同一已完成任务及完整两类输出。此证据不代替正在运行时弱网中断或跨 Host 重启游标恢复。

首次历史重入验证漏关输出后返回的任务列表弹层，被正常遮挡拦住；保留 [失败记录](../../../plugin/artifacts/latest-runtime-check/latest-live-background-android-replay-first-failed.json)。修正验证器先关列表后，仅重读同一次任务，没有重发命令或修改生产导航。

## 回归与边界

任务/独立输出/视图/原记录 23 项、模型与旁栏/原记录 102 项、协议及文件边界 14 项、恢复边界 4 项通过；这些集合有重叠，不累加为独立总数。固定新版真实 Host/网关配对、任务流首帧、取消后继续请求及撤权拒绝另在 47.19 秒测试通过。原旧版任务消费路径保留，新版引用生命周期覆盖主/旁栏；实际新版旁栏任务、更大或其他通道/生产者输出与更多重连时序尚未实测。

## 手机停止任务与其他任务隔离

使用[实际 Android 停止验证器](../../scripts/verify-latest-live-job-stop-android.mjs)，从普通聊天原抽屉进入 Remote，再从原列表打开同一编码专用会话。原电脑仍是 Host71060，设备管理权限 false，不新建工作区、会话或配对，不读取 Key。只增加验证器，没有修改生产停止、输出或审批逻辑，也未重新构建或替换 App。

实际模型只执行两次指定的只读后台 `pwsh`：第一个每两秒打印一条文字，最多120秒，第二个最多80秒；均不访问文件、网络或提权。通过原记录核对两条完整参数、后台标记与结果，原 callId 分别为 `call_00_SJET64nWqjeky9AszZKO6313` 和 `call_01_IDOCGszTEYeBmodzudUd6076`。目标为 `pwsh-2`，另一任务为 `pwsh-3`；开始时间、所属会话及标签严格匹配，不能只凭可复用的任务编号停止。

- [原页面打开](../../../plugin/artifacts/latest-runtime-check/latest-live-job-stop-android-open.json)：由已安装测试 App 的原抽屉和列表进入，未使用电脑整站页面。
- [取消确认后继续、确认后停止](../../../plugin/artifacts/latest-runtime-check/latest-live-job-stop-android-start.json)：原手机先“停止任务→继续运行”，目标仍 running 且实际 PID57632 活着；再次选择并确认后目录为 killed，实际进程退出。另一任务仍 running、PID35804 活着，不把请求回执当作进程结束。
- [完整观察](../../../plugin/artifacts/latest-runtime-check/latest-live-job-stop-android-observe.json)：已停止任务保留中文/emoji、PID及两条 tick，没有运行到结束标记；错误输出保留且无替换字符。“从头查看”仍能重读相同内容。另一任务产生完整40条 tick及结束标记，completed 且 PID 已退出。原只读权限保持，原记录没有第三次 pwsh 或模型重试。
- [离开聊天后重入](../../../plugin/artifacts/latest-runtime-check/latest-live-job-stop-android-replay.json)：原导航离开再进入，同一已取消任务的两类输出仍保留，另一任务完整结果可读，原 callId 和命令没有变化。

截图：[停止与另一任务运行](../../../plugin/artifacts/latest-runtime-check/latest-live-job-stop-stopped.png)、[结算输出](../../../plugin/artifacts/latest-runtime-check/latest-live-job-stop-observe.png)、[历史重入](../../../plugin/artifacts/latest-runtime-check/latest-live-job-stop-replay.png)。一次性[尝试记录](../../../plugin/artifacts/latest-runtime-check/latest-live-job-stop-seed.json)在发送前排他创建，观察失败不重发消息，停止结果未确认时不重复停止。运行后的旧/新任务身份、输出及游标专项18项全部通过；与前述回归集合重叠，不累加。

此项仅证明发布入口真实 Android 的单任务停止与另一任务隔离，不代替源码实际推理/停止、停止期间断网或 Host 重启的未知结果边界，也不覆盖 PTC 内部工具或自动审核取消。两个测试进程已退出，持久 Host 和原绑定仍供后续验收使用。

## 大输出、分段读取与真实缺口

[实际 Android 验证器](../../scripts/verify-latest-live-large-output-android.mjs)沿用同一只读会话、Host71060及聊天授权，不修改生产输出逻辑、不替换 App。命令打印60行，每行700组中文/emoji、200ms间隔；标准输出规范化CRLF后为420598字节/168598个UTF-16单元，另有预期错误输出。只执行字符串、打印与限时等待，不执行文件写入、网络或提权。

官方[环形输出](../../../plugin/artifacts/latest-source-check/packages/jobs/jobs-local/src/ring.ts)在淘汰后保留UTF-8安全边界；[任务注册表](../../../plugin/artifacts/latest-source-check/packages/jobs/jobs-local/src/index.ts)默认运行保留262144字节，模型消费后的终态保留16384字节。[原任务目录](../../../plugin/artifacts/latest-source-check/packages/api/job-controller/src/rows.ts)只随生命周期提交刷新，明确忽略output追加事件；不能把目录中的output统计当成实时字节游标。项目仍使用有界独立读取接口，不暴露spill路径给手机，也不伪称能恢复官方已经丢弃的历史。

第一任务`pwsh-4`的[运行中窗口](../../../plugin/artifacts/latest-runtime-check/latest-live-large-output-android-start.json)、[结算](../../../plugin/artifacts/latest-runtime-check/latest-live-large-output-android-observe.json)和[历史重入](../../../plugin/artifacts/latest-runtime-check/latest-live-large-output-android-replay.json)通过：手机持续读取没有缺口或替换字符，显示窗口达到上限后保留最近内容，与原生成后缀一致；结算后新开错误通道明确提示早期输出已丢失。模型消费后的历史只剩最后两行及结束标记，此次是单页，不能作为多页手动翻页证据。

为覆盖真正多页，第二个独立任务在生成后额外等待25秒。首次验证误用目录earliest统计，被断言拒绝，保留[原失败](../../../plugin/artifacts/latest-runtime-check/latest-live-large-output-live-history-android-history-live-first-failed.json)；修正观察依据后，分离执行的验证已错过运行窗口，保留[已结算失败](../../../plugin/artifacts/latest-runtime-check/latest-live-large-output-live-history-android-history-live-settled-failed.json)。显示层缺口说明不是命令原文，旧结算校验的这一误判亦保留[失败记录](../../../plugin/artifacts/latest-runtime-check/latest-live-large-output-live-history-android-observe-first-failed.json)。不重发这条任务来冒充原次通过。

第三个独立尝试把准备和翻页放在同一进程：[运行窗口与四段手动读取](../../../plugin/artifacts/latest-runtime-check/latest-live-large-output-live-history-retry-android-start-history.json)通过。任务`pwsh-6`、原调用`call_00_ET_QkOUAiBATjAdiZRVx9zf9045`仍running时，从LINE024到LINE060的259333个规范化UTF-8字节分四段拼接，与原生成的连续后缀完全相同，无替换字符。绝对游标依次226856、292392、357928、420690，最后等于当时的总量；原按钮“读取下一段”驱动，不注入输出或调用读取器方法。原页面始终显示电脑早期内容已淘汰的提示。

[结算](../../../plugin/artifacts/latest-runtime-check/latest-live-large-output-live-history-retry-android-observe.json)和[再次进入历史](../../../plugin/artifacts/latest-runtime-check/latest-live-large-output-live-history-retry-android-replay.json)也通过：实际终态completed，归属/开始时间保持，结束标记可读；模型消费后按官方策略只剩LINE059/060，明确提示缺口而非完整历史。截图：[运行中](../../../plugin/artifacts/latest-runtime-check/latest-live-large-output-live-history-retry-running.png)、[历史](../../../plugin/artifacts/latest-runtime-check/latest-live-large-output-live-history-retry-history.png)。

结算后的严格审计初次将自动通知的新轮次与原请求混合，保留[观察失败](../../../plugin/artifacts/latest-runtime-check/latest-live-large-output-live-history-retry-android-observe-first-failed.json)及[历史失败](../../../plugin/artifacts/latest-runtime-check/latest-live-large-output-live-history-retry-android-replay-first-failed.json)。原记录证明请求turn12只有一次指定pwsh；随后`source.kind=tool-jobs/form=notice`开启turn13，模型先glob列出已有输出临时目录的两条`-job_output.txt`路径，再job_output读取同一任务。验证器现分别审计轮次：仅接受来源确为当前任务完成通知、目录已在此前原工具结果出现、`*.txt`且返回路径均属于该目录的元数据查询；未知来源、其他工具/路径或其他任务读取继续拒绝。没有读文件内容、额外命令或新任务；该查询单列在报告，不声称整段记录中不存在其他工具。

三个尝试均有独立排他seed与原一次性发送，第二次观察失败不自动补发；原只读权限、设备管理false、日常旧DSH保持。17项独立游标/UTF-8/ANSI/窗口回归通过，与既有集合重叠。此项不替代源码实际推理、大输出在途断网/停止、其他生产者或任意数据规模，也不表示可以下载官方已丢弃的完整历史。

完整新版兼容继续按 [KKC-24](https://linear.app/kkcodes/issue/KKC-24) 和 [总验收边界](./latest-compatibility.md) 推进。上述大输出证据限于发布入口，不代表源码大输出、系统通知或所有维护补丁已经完成；最终授权撤销与拥有服务清理由整体验收收尾。

## 固定源码的后台任务与停止（2026-10-06）

沿用持久home、同一编码测试会话、原聊天绑定和管理false，实际Host71520由固定源码commit `5badb15009ae1756c3afe0ae0cef1faafc290ccc`运行真实`pnpm dsh web`。每个阶段先验证原30文件源码载荷，测试脚本通过可选`source`参数使用独立排他seed/报告，不覆盖发布证据；生产任务、输出和停止实现未在本次修改。

任务`pwsh-3`/原调用`call_00_ET_XLABYs6BB2iCEwRO9WMb5501`仅执行一次指定后台命令。原任务仍running时，手机显示中文/emoji标准流与错误流；完成后两类完整内容、原权限和原调用一致。首次模型读取尚为空；完成通知后的原`job_output`读取到完整双流，手机历史与其规范化CRLF后的内容逐项匹配。实际连接菜单断开再重连后，设备指纹保持，原新版任务服务重新建立，同一会话/任务仍可完整读取。四阶段：[运行中](../../../plugin/artifacts/latest-runtime-check/latest-live-source-background-android-start.json)、[结算](../../../plugin/artifacts/latest-runtime-check/latest-live-source-background-android-observe.json)、[消费后历史](../../../plugin/artifacts/latest-runtime-check/latest-live-source-background-android-replay.json)、[显式重连](../../../plugin/artifacts/latest-runtime-check/latest-live-source-background-android-reconnect.json)。

两个后台任务的停止专项由[原手机验证器](../../scripts/verify-latest-live-job-stop-android.mjs)执行。原两次指定pwsh分别为`call_00_ET_1nmITzrnJFzEd2BYegmh9838`、`call_00_ObI4ONwBRqtrdjkdMZD25326`，任务`pwsh-4`/PID53352与`pwsh-5`/PID37676。手机第一次取消停止确认后，目标任务仍running且进程活着；第二次确认后原状态killed、进程确已退出，另一任务仍运行。已停止任务的双流和两条tick保留，无结束标记；另一任务完整40条tick和结束标记、completed/进程退出均核对。原记录只有指定两条命令，允许原完成通知的同任务`job_output`，没有第三条pwsh或重试。

证据：[停止](../../../plugin/artifacts/latest-runtime-check/latest-live-source-job-stop-android-start.json)、[两个进程终态及完整结果](../../../plugin/artifacts/latest-runtime-check/latest-live-source-job-stop-android-observe.json)、[同一历史重入](../../../plugin/artifacts/latest-runtime-check/latest-live-source-job-stop-android-replay.json)，对应截图亦位于该目录。进程53352/37676随后经系统再次确认不存在。测试会话保持read-only，未授管理权限或重新配对。本项不替代源码大输出、停止在途断网/Host重启的未知结果、PTC内部工具或自动审核取消，也不宣布完整新版兼容通过。

## 固定源码的大输出首轮：实时与翻页通过，完整专项失败（2026-10-06）

[源码大输出验证器](../../scripts/verify-latest-live-large-output-android.mjs)新增可选`source`参数，先验证30文件载荷和真实pnpm入口，使用独立排他seed。Host71520/同一编码会话/管理false保持。原请求turn24仅有指定后台pwsh，callId为`call_00_ET_IWyrgEZ9GDzsu9c2Vse62705`，任务pwsh-6，标记`DSHM_LARGE_c2f10335e5d2`；生成规范化标准流420598字节。手机实时有界窗口无替换字符、无实时缺口，原按钮驱动四段历史，259333规范化UTF-8字节拼接成原生成的连续后缀；游标226856/292392/357928/420690，运行时原缺口提示可见。见[运行与四段读取](../../../plugin/artifacts/latest-runtime-check/latest-live-source-large-output-live-history-android-start-history.json)。此阶段通过只说明当时原请求及页面事实。

随后原完成通知开启turn25，模型先glob搜索全局临时目录的`dsh-subprocess-*-stdout.log`，再grep当前标记（原结果为SearchError/SEARCH_FAILED），又发起一次枚举临时日志的pwsh。这超出本次仅指定命令和同任务job_output的审计边界；不扩大允许列表、不将失败改记为通过。手机结算窗口已有结束标记和缺口，但[结算原审计失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-large-output-live-history-android-observe-first-failed.json)，因此完整源码大输出仍未通过，也未将本次历史重入计为通过。

发现额外生成后，实际手机“停止生成”，原会话由running变为false、read-only保持。见[停止额外生成](../../../plugin/artifacts/latest-runtime-check/latest-live-source-large-output-live-history-stop-unexpected.json)。[最终原结果审计](../../../plugin/artifacts/latest-runtime-check/latest-live-source-large-output-live-history-final-audit.json)证明原四个调用均有结果：glob成功、grep失败、额外pwsh也已完成，不声称其进程被停止按钮中止；停止后的会话不再生成。没有重新发送原消息或命令。

首轮观察脚本另发生Windows `UV_HANDLE_CLOSING`退出异常，失败状态保留。验证器在CDP关闭后等待200ms再退出；[既有结果重新观察](../../../plugin/artifacts/latest-runtime-check/latest-live-source-large-output-live-history-android-observe.json)严格检出两次pwsh，以1退出、未再出现原生退出断言，不作为功能通过。停止与最终只读审计脚本均以0结束。此轮不修改生产输出、工具权限、模型或通知协议，后续需独立核对完成通知的模型行为及剩余大输出边界。

## 固定源码的大输出独立复验通过（2026-10-06）

第二个独立尝试明确规定完成通知只允许读取当前任务的`job_output`，使用新排他seed，不重放首轮消息。原Host71520/30源码载荷保持，原调用`call_00_FqpROtMfGsAO7IOL86Gz0066`、turn26、任务pwsh-8、标记`DSHM_LARGE_657f5d807486`。规范化标准输出420598字节；运行中有界窗口无缺口/替换字符，四段历史259333字节逐字匹配生成的连续后缀，游标226856/292392/357928/420690。见[运行与原按钮翻页](../../../plugin/artifacts/latest-runtime-check/latest-live-source-large-output-live-history-retry-android-start-history.json)。

[结算](../../../plugin/artifacts/latest-runtime-check/latest-live-source-large-output-live-history-retry-android-observe.json)与[退出后历史重入](../../../plugin/artifacts/latest-runtime-check/latest-live-source-large-output-live-history-retry-android-replay.json)均以0结束且passed=true。验证器额外等待原会话闲置和真实输出读取结果：唯一后续工具`call_00_pbyP6oTz11UgHcNlCA6I3762`只读取该任务并返回结束标记，没有glob/grep、第二条pwsh或重试。模型消费后原环形历史仅保留末尾LINE059/060和结束标记，手机显示真实缺口，不冒充完整历史。标准与错误通道均无替换字符，原read-only/管理false保持。

此结果证明当前规模、当前生产者和上述运行/结算/重入路径；首轮失败仍成立，没有修改生产模型、工具或任务协议。大输出在途断网/停止、其他生产者与任意规模仍需独立验证。后续可写PTC验收及拥有Host重启见[实际范围](./latest-compatibility.md#固定源码的可写ptc与权限恢复2026-10-06)。
