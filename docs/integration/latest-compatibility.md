# 新版 DSH 隔离兼容验证

> 当前按[2026-10-09 纯插件决定](../../../docs/project-knowledge/knowledge/decisions/2026-10-09-official-dsh-plugin-only.md)重新验收未修改的官方 DSH。此前本体补丁/改造载体结果属于历史；不能实现的扩展功能取消，核心接口不足列出缺口及上游需求，SDK/Electron改造版打包不再是必过条件。初始化的预设归档补丁硬依赖已移除，52项相关回归与类型/独立候选构建通过；真实官方加载及纯插件 Android 全链路尚待验证。

当前[Windows文件版本监听修正](../../../plugin/compatibility/latest-upstream/file-version-watch.md)已在发布与实际源码Host/网关/Android通过，同大小/mtime内容变化仍能刷新原PDF正文/画布。同一14组38文件的独立源码ZIP也已通过安装/完整运行/恢复与解包核对；原App23468/Host29132、绑定及全部26会话3799事件保持。新[SDK11载体与资源冻结](../../../plugin/compatibility/latest-upstream/sdk-native.md#第十一轮与载体资源冻结2026-10-09)已因资源同步时Q盘空间不足退出1，SDK/Electron实际复验及本轮完整原构建/355资源恢复仍未完成，38原文件/启动和压缩属性已恢复；不以旧37文件载体结果替代本次新组合。

当前[官方Electron与Android完整管理组合](../../../plugin/compatibility/latest-upstream/electron-runtime.md#完整-Android-管理组合2026-10-09)已通过，覆盖实际桌面Host、配对/历史/模型/动态插件/预设/提供方/目录/文件/撤销及原profile重启恢复。37原源码/启动、完整恢复构建与355资源精确恢复，原App16722/Host29132、绑定及全部26会话3799事件保持；首轮测试`!!js`解析失败及原App重开差异保留。下方早期专项按当时范围阅读，完整新版七条总标准和交付仍未全部完成，实际Windows窗口另行核对。

[Windows SDK 当前边界](../../../plugin/compatibility/latest-upstream/sdk-native.md)：第九轮官方完整打包/原资源校验、同一MuMu唯一消息/真实新回复，以及原只读会话的实际pwsh实时中文/emoji输出、结果和历史重读通过。完整SDK包管理运行器的正常/遗留写入/调用者断开亦通过；主动断开时测试工具等待close的失败由独立普通Node对照定位，原失败仍保留。原发布Host27408和App3250/Key/配对恢复，26会话全部原历史前缀/投影保持，手机加载后的唯一空恢复标记已复核；源码37原文件/启动字节、384.677秒原完整恢复构建和355资源精确核验/归档通过。Electron、最终交付及原七条总标准未全部完成。

[六格式原件保存与跨UID只读分享](../../../plugin/compatibility/latest-upstream/file-transfers.md#六格式原件保存与分享补验2026-10-07)已在当前62文件归档的发布及实际源码两种入口、各两组完整通过：docx/doc/xlsx及xls/pptx/ppt各两类来源，共24份实际原件的系统保存、另一UID只读接收及最终电脑原件大小/摘要一致，副本清理且电脑原件保持。原App恢复MuMu前台Remote聊天、PID/Key/绑定保持；临时分享接收器卸载、八个Host退出。37原源码/启动、381.66秒原完整恢复构建与355资源精确核验，18目标/13组只读审计通过。原8份分享缓存/一小时生命周期保持，两次旧candidate失败单独保留；不代表其他保存提供方、任意格式或完整新版支持。

[Office原生转换运行中取消](../../../plugin/compatibility/latest-upstream/office-engine.md)已在发布与实际源码入口通过：最后一个手机读者关闭时，原转换进程停止、队列/预算/临时目录释放，重新打开由新进程生成实际PDF；37原源码/启动/根脚本及355客户端资源精确恢复。另在[共享转换专项](../../../plugin/compatibility/latest-upstream/office-engine.md#共享转换时关闭一个读取者)通过发布与实际源码入口：手机取消自己的读者后另一真实批准连接继续，同一进程只转换一次，手机重开显示原PDF正文；共享范围的原37源码/启动/根脚本、完整恢复构建及355资源也精确核验。原App/Key/绑定保持，更多并发、转换中断网/撤销/服务卸载及全部七条总标准仍未完成。

[显式恢复父任务后的第二层手机续聊](./latest-child-model.md#恢复父任务后的第二层手机续聊2026-10-07)已在发布及实际源码pnpm入口通过：复用原两棵树、手机唯一消息/真实回复、父草稿保留、实际停止、处理保留回报后释放及原历史重入。父已释放时原限制保持，不自动唤醒。26会话全部原历史/投影/身份、原APK/Key/配对保持；原37文件/启动字节、完整恢复构建和355资源已精确核验归档，证据见专项。此范围不代替原七条标准或完整新版支持。

[子会话服务在途卸载与恢复](./latest-child-model.md#服务卸载在途与重新读取2026-10-07)已在固定发布及实际源码 pnpm 入口通过独立 MuMu App 主聊天/旁栏、读取/提交四分支。Host生命周期只读流及共享重试入口修复实际缺口，原事件/投影保持，撤销和清理通过；37原文件/启动值及原完整构建/355资源精确恢复归档，主App/旧版未替换，完整新版兼容继续。

[子会话身份资料故障](./latest-child-model.md#子会话身份资料故障2026-10-07)已通过固定发布与实际源码pnpm入口的真实 MuMu 主聊天和旁栏六分支：明确失败提示、未知模式禁止操作、原 Host 强制读取/续聊拒绝、健康兄弟可读及全部原历史不变。共享手机显示已修正并安装独立故障测试 UID，原主 App/PID/摘要/绑定保持并切回前台。13组/37文件候选与原恢复完整构建通过，原字节/启动值/355资源精确恢复归档；其他子任务组合及完整七条标准仍待验。

[手机实际启动电脑编辑器](../../../plugin/compatibility/latest-upstream/desktop-apps.md#手机实际启动电脑编辑器2026-10-07)已在发布与实际源码pnpm入口通过Cursor/VS Code的原生确认、指定工作区实际窗口、正常关闭与撤销拒绝。VS Code受限模式/信任提示保持，IntelliJ原项目信任提示未批准、工作区打开尚未通过；三应用原失败和两项子范围报告均保留。原主App/Key/绑定不更换，源码完整构建/精确恢复见专项，完整新版兼容仍未完成。

[手机确认期间停用电脑应用服务](../../../plugin/compatibility/latest-upstream/desktop-apps.md#手机确认期间停用服务2026-10-07)已在发布和实际源码pnpm入口通过独立Android：原服务确实释放后，准备/确认迟到结果失效，手机清除等待/确认并显示原原因；重新启用后可重新读取/确认，启动调用始终为零。设备撤销拒绝、测试UID/端口/Host清理通过，主App实际原会话、空草稿、进程与APK摘要保持；不修改生产组件或APK，其他应用实际启动与完整新版兼容继续。

[Factory单个实例异常与恢复](../../../plugin/compatibility/latest-upstream/cordis-two-clients.md#factory-单个实例异常与恢复2026-10-07)在发布与实际源码pnpm入口通过：原React实例报错后兄弟实例仍能调用Host，两端原诊断同步及显式恢复通过；两端重连/停止/移除和撤销清理保持。主App/Key/绑定未替换，37原文件/启动值、原完整构建及355资源精确恢复归档。双客户端原标准已有[逐项证据](../../../plugin/compatibility/latest-upstream/cordis-two-clients.md#双客户端条目核对2026-10-07)，其余七条总标准和完整新版交付仍未完成。

[局部Slot渲染异常与跨端恢复](../../../plugin/compatibility/latest-upstream/cordis-two-clients.md#渲染阶段异常与跨端恢复2026-10-07)在发布与实际源码pnpm入口通过同一MuMu的两个独立Android客户端。真实React组件抛错后，Host保留运行，两端显示原原因并可显式恢复版本2/实际Host调用；原缺少跨端清单通知已修正。完整候选/原恢复构建、37原文件/启动值和355资源恢复归档通过，主App/Key/绑定保持。其他Slot、Factory及完整新版交付不由本轮外推。

[插件自身异常与恢复](../../../plugin/compatibility/latest-upstream/cordis-two-clients.md#插件自身异常与恢复2026-10-07)在发布与实际源码pnpm入口通过同一MuMu的两个独立Android客户端：Host/Client实际加载失败、Host handler报错、原错误显示、旧定义保留及两端显式恢复/原调用核验。修正旧版本错误遮住当前失败原因，手机APK未更换；主App/绑定/进程保持，当前37原文件/启动值、原完整构建及355资源已精确恢复归档。真实推理、两台实体手机、渲染阶段异常及完整新版交付不在该通过范围。

[双客户端动态插件](../../../plugin/compatibility/latest-upstream/cordis-two-clients.md#两个独立-android-客户端2026-10-07)已在发布和实际源码pnpm入口通过同一MuMu的两个独立Android客户端：不同UID/凭据、并发审批、各自真实重连、旧代码迟到、版本保留、停止/重跑/移除和撤销均核验。使用相同实际DSHM页面及原生桥，不占用主App/Key；主App原会话和空输入框已恢复，36原文件/启动值、原完整构建及355资源已精确恢复归档。该范围不代表两台实体手机、真实推理或完整新版交付。

[新版发布及实际源码Auto review取消](./latest-auto-review.md)已从真实失败复现到窄范围修复：13项/31文件完整构建、33项实际安装Auto与159项取消回归、引导身份及两种入口手机取消/原历史/继续回复/权限恢复通过。正常源码入口与原绑定保持；新组合最终精确恢复、新版放行/拒绝和完整范围继续，当前不得发布完整新版支持声明。

[待办通知与受阻显示](./notifications-current.md#新版待办通知与受阻显示2026-10-06)已补齐发布提问/审批，以及发布和源码受阻实际送达、点击与原历史重入。新版手机受阻节点被折叠且误报成功的问题已修复并安装独立 APK，主/旁栏回放及实际主聊天通过；诊断启动配置已移除，管理false保持。自动审核、其他失败原因与完整新版支持仍待验。

[进程结束与草稿恢复](./notifications-current.md#发布入口的进程结束与草稿恢复2026-10-06)已在 npm 发布入口复验通过：真实回执未交付输入层与正常发送两条路径，电脑结算前实际结束 App，重开原普通首页自动连接后进入 Remote，原配对/权限/单次用户消息保持，草稿与核对编号清除，历史不补发通知。与此前固定源码结果一致；有界本机观察，不外推 OEM 或其他通知类型。

[程序内实际文件写入](./latest-ptc-files.md)已确认安全标签写入权限的单变量影响：原缺权限目录仍失败；固定源码与 npm 发布入口均在符合原沙箱前提的新工作区通过手机实际已有文件修改/回读、只读拒绝与同一原结果/历史同步，原 partial 提示保持。新工作区沙箱授权、四文件及注册已清理，原归档历史保持；原失败目录未修复，不关闭完整范围。

固定源码实际前台命令已通过：[真实Android卡片与独立输出](./latest-live-recovery.md#固定源码实际运行与手机卡片2026-10-06)。原`pnpm dsh web`下单次只读命令的运行中中文/emoji、双流结算和历史重入通过；三类既有会话的原卡片展开亦通过。[源码后台任务与停止](./latest-background-jobs.md#固定源码的后台任务与停止2026-10-06)、[大输出独立复验](./latest-background-jobs.md#固定源码的大输出独立复验通过2026-10-06)及下文源码审批/提问/只读与可写PTC外层停止也已通过。两种入口[内部真实pwsh停止](../../../plugin/compatibility/latest-upstream/tool-cancellation.md)及[后台完成通知/点击](./notifications-current.md#固定新版的后台完成通知2026-10-06)追加通过；固定源码[五会话完整历史恢复](./latest-live-recovery.md#固定源码的完整历史恢复核对2026-10-06)逐条核对880个原事件，仅增加官方恢复标记。程序内写入、其他内部工具、自动审核取消、其他通知类型及其余有效标准继续验收。原源码租约尚在使用，不能视为本轮源码/资源恢复完成。

新版后台任务：[原任务目录与实际手机输出](./latest-background-jobs.md)已迁移。发布及固定源码入口真实 Android 运行中标准/错误输出、完成结果、模型消费后的完整历史重读及显式断开/重连通过；手机取消停止确认后继续、确认后真实进程退出、输出及历史保留和另一任务继续完成也已在两种入口通过。约421KB中文/emoji输出的有界实时窗口、四段手动历史读取、结算重入及真实缺口提示也已在两种入口通过，源码首轮额外模型调用的失败保留。更大或其他生产者输出及更广连接异常仍待专项，完整新版支持未发布。

新版手机[完整文件保存与系统分享](../../../plugin/compatibility/latest-upstream/file-transfers.md)在发布182.94秒、源码外层208.41秒通过：工作区Word与历史附件原件实际保存、跨UID只读分享、下载中真实socket中断后的临时文件清理及约3MiB完整重试均已核验。十一项完整构建、原回归、28原文件/355资源精确恢复和清理通过；系统保存窗口断线、下载中进程结束和受控保存位置实际目标写入中结束另已在发布与源码入口通过，原绑定/会话恢复、部分目标保留、提示跨重启与完整重试均核验。分享副本准备中进程结束另在发布149.60秒、源码外层167.72秒通过：真实部分副本、启动清理、完整快照保持和手动只读重试均核验；原源码/资源恢复通过。六种Office格式的正常原件保存/分享另已在当前归档发布与源码通过，见上方；其他格式、保存提供方及接收App异常仍待验。

Windows文件读取权限：[原协议专项](../../../plugin/compatibility/latest-upstream/office-lifetime.md#实际-windows-文件读取权限在途收回)在发布100.14秒、源码外层117.89秒通过，原构建/字节/355资源精确恢复已核验。另在[实际Android失败页与重试专项](../../../plugin/compatibility/latest-upstream/office-lifetime.md#实际-android-文件读取权限在途收回与重试)通过发布133.99秒、源码外层159.71秒：完整PDF被原末尾权限检查拒绝、无旧画布，恢复原DACL/字节后点击原重试显示实际PDF正文；Host容量释放与缓存重新授权核验。源码完整恢复288.95秒、原28源码/355资源摘要/Git干净及清理核验通过；附件引用变化、其他ACL/操作系统及引擎运行中取消仍待验，不记为全部权限范围通过。

### Android Office主聊天在途切换（2026-10-05）

发布150.85秒、实际源码pnpm外层167.04秒通过：原主聊天列表在真实PDF传输中跨工作区切换，旧载入取消一次、pending移除、Host名额释放。标签ID和occurrence保持；另一工作区实际PDF正文正确，返回原标签重新读取并显示原大文件正文，原菜单关闭后标签记录消失。八项标记通过，原文件/版本/服务代次保持；只新增真实测试与只读观察，不修改生产页面、权限或缓存。

十一项/28文件完整构建286.34秒、原回归及身份通过，恢复原构建307.74秒、原字节/355资源摘要/Git干净及六个测试Host退出核验。Office UID/授权/端口清理；模型App原PID16457、绑定/数据/16901和两条空会话零轮次保留，已恢复原聊天。原300/360秒时限保持；不包含全量管理/动态插件或设备收权专项，不代表旁栏/并发切换、文件权限/附件引用在途变化或转换引擎运行中取消。报告、截图、原标签生命周期及复验开关见[完整依据](../../../plugin/compatibility/latest-upstream/office-lifetime.md#实际-android-主聊天在途切换与标签恢复)。

新版子会话：[原Session投影与共享导航](../../../plugin/compatibility/latest-upstream/subagent-catalog.md)已适配，修复旧目录接口的真实404；原store及插件读取方式保持，unknown模式确认前只读。发布186.56秒、源码pnpm243.16秒的本轮Remote/独立Android/原Host重启链路通过，含旁栏历史、应用确认/取消及实际资源管理器启动；28源码/355原资源精确恢复及清理通过。

- 状态：新版基础 Remote 已通过真实浏览器和 Android，完整兼容仍在迁移，尚未发布新版交付包。
- 维护角色：DSH Mobile 项目协作 Agent；最近核验：2026-10-06。
- 固定目标：DSH `0.2.1-alpha.1` / `5badb15009ae1756c3afe0ae0cef1faafc290ccc`，官方仍标为 Pre-release。
- 任务：[KKC-24](https://linear.app/kkcodes/issue/KKC-24)；电脑端事实从[主报告](../../../plugin/compatibility/latest-upstream/README.md)进入。

## 隔离与构建

### Android Office普通会话切换与归属（2026-10-05）

发布CLI专项143.45秒、实际源码`pnpm dsh web`外层161.35秒通过真实网关、独立Android与原Host重启。原列表切换三个真实会话：同工作区的不同会话按各自身份重新授权；另一工作区的同名文件具有不同正文，实际可见PDF文字层和截图确认内容来自相应工作区。返回原会话复用自身缓存，同时重新核验文件权限；把原附件资源地址带到错误会话，原Host明确拒绝，手机没有显示旧PDF，返回原会话可以再次读取。

范围为`office-session-lifetime`，每次切换前先关闭预览；不代替预览在途切换、文件权限/附件引用在途变化或转换引擎运行中取消，也不是全量管理/动态插件回归。三条原工作区转换流、五次权限读取、五次可见正文及八项归属标记核对通过；原件完整字节、文件版本与服务代次保持。六格式/历史附件、缓存/关闭/断线/显式重连、撤销和Host重启回归保持，撤销前零错误，最后预期401单列。仅修改真实测试准备与原调用观察，不修改生产鉴权、缓存或页面。

十一项/28文件完整构建289.22秒、原41/159/188/5/72项回归、身份和八应用服务通过；恢复原完整构建306.76秒，原字节/355资源摘要/Git干净核验。四个拥有Host、固定Office UID/授权/反向端口清理，模型验收App原PID16457/数据/绑定/16901保持；恢复原空会话并核对原标题/输入框/无iframe，未发送推理。具体报告、复验开关与首轮地址验证的限定范围见[会话归属依据](../../../plugin/compatibility/latest-upstream/office-lifetime.md#实际-android-会话切换与同名文件归属)。

### Android Office传输中收回设备权限（2026-10-05）

发布133.62秒、实际源码`pnpm dsh web`156.72秒（外层relay159.61秒）通过原网关、独立Android和原Host重启组合。实际收回管理权限时收到`closed/permissions_changed`，旧预览/请求退出；点击原“重新连接”后只保留聊天权限，同一文件重新授权并读取新PDF。直接撤销设备时收到`closed/device_revoked`，原授权失效页出现，重连被拒绝，旧PDF不显示且没有新的转换流。两种操作均释放真实Host读者名额，源文件保持。

本轮只延迟原PDF四块信用确认，保留原鉴权、转换器、缓存及原UI。范围为`office-authorization-lifetime`，不重复全量管理和动态插件页面，不代表转换引擎运行中的取消或文件自身权限/附件引用变化。六格式文件/附件、服务缓存、预览关闭、单socket中断和显式重连回归同时通过；撤销前无页面/控制台错误，只有最后预期401。原300秒测试/360秒外层上限保持。十一项/28文件完整源码构建291.06秒、原回归及身份通过，恢复原构建288.79秒；原源码/根脚本/引导字节、355资源摘要和Git干净核验。四个拥有Host、授权及固定Office测试App/端口清理；模型验收原PID16457、绑定/数据/16901端口保留，原导航恢复同一空会话、标题/输入框/无iframe核对通过。详细证据和复验配置见[设备权限边界](../../../plugin/compatibility/latest-upstream/office-lifetime.md#实际-android-传输中收回设备权限)。

### Android Office传输中断后的自动连接恢复（2026-10-05）

发布CLI专项122.44秒通过真实网关、固定独立Android及原Host重启。只切断实际发送指定Office原请求的设备socket：旧四块传输以原`connection_closed_outcome_unknown`结束、pending移除，Host读取名额释放；连接自动恢复且原会话保留。原预览点击“重试”后读取新PDF，不能把连接自动恢复记为PDF自动重试。另一份同源版本/服务代次的旧缓存重新核验授权并读取，转换流4→5、授权6→7、代次查询14→17；显式重连回归另为5→6、7→8、17→18。

实际源码`pnpm dsh web`同范围143.89秒通过，外层relay146.68秒，六项恢复标记、原重试按钮与计数一致。十一项/28文件完整构建286.45秒，原回归及身份通过，恢复原构建291.69秒；原源码/根脚本/引导字节与355资源摘要相同，Git干净、拥有Host退出。原模型验收App/16901端口与聊天授权保持，原导航恢复同一空聊天、标题/输入框/无iframe和原Host两空会话/零轮次核对通过。

本轮`office-network-recovery`只覆盖配对/历史/选模、文件与Office/附件、缓存/关闭/断线/显式重连、撤销及Host重启，未重复此前全量电脑管理和动态插件页面步骤。原300秒时限不变，无生产权限或缓存变更；首轮缓存命中使在途准备超时的失败证据保留。一次socket中断不代表全部弱网时序、转换引擎取消或真实推理；完整支持继续待验。来源、复验命令和具体报告见[断线边界](../../../plugin/compatibility/latest-upstream/office-lifetime.md#实际-android-传输中断与自动重连)。

### Office服务变化时的传输（2026-10-05）

发布CLI/真实网关/原Host重启93.01秒通过原转换服务卸载和重新启用的PDF传输核验：服务不存在时保留原`gateway/definition-unavailable`拒绝，服务已重建时因generation不同拒绝旧结果，新读取成功。真实PDF为1,256,492字节，四块信用窗口确实暂停；六格式和既有传输异常回归保持。实际源码pnpm同范围也通过，外层relay118.01秒/内层清理结算115.32秒；十一项/28文件完整构建、原回归和原字节/355资源精确恢复、Git干净及拥有Host退出通过。本轮不含Web或Android页面，不能据此宣布手机缓存失效通过。详细证据、最初HTTP 404断言错误及尚未验证的转换引擎运行中/手机缓存范围见[服务变化边界](../../../plugin/compatibility/latest-upstream/office-lifetime.md)。

### 真实模型回复与文件审批（2026-10-06）

状态：本节发布CLI、候选插件与独立Android自有页面的真实模型回复、电脑同步、文件读取、写入批准/拒绝、真实提问回答，以及只读和工作区可写PTC停止/历史恢复/继续聊天通过。实际源码的后续结果见下节；完整模型/工具/通知范围仍在验收。初次可写PTC失败已定位为测试目录缺少原Windows沙箱必需的WRITE_OWNER，按官方流程临时修复后原操作通过，测试权限规则已恢复。

用户已在原测试DSH模型窗口配置Key，页面显示“API密钥已配置”；仅核对配置状态，没有读取或复制Key。手机恢复专用“DSHM 新版手机真实模型验收”会话后，用原共享输入框发送只回复标记的消息，真实`deepseek-official/deepseek-flash`返回`DSHM_LATEST_MODEL_cecc3c7033834155`。原Host的`session/projections`、`session/page`及`session/list`独立核对同一会话的一次用户请求和实际模型回复、工作区、结束状态及模型选择；原电脑页面显示同一内容、一轮一步和实际用量。见[模型报告](../../../plugin/artifacts/latest-runtime-check/latest-live-model-android.json)、[手机回复](../../../plugin/artifacts/latest-runtime-check/latest-live-model-android.png)与[验证器](../../scripts/verify-latest-live-model-android.mjs)。

随后只在本轮UUID隔离工作区创建专用测试文件，手机原“会话权限”切换为仅可查看，再请求模型用write工具修改该文件。电脑实际read成功、普通write被只读沙箱拒绝、再申请单次workspace-write审批；手机与原电脑页面显示同一待审批请求。通过手机原工具详情核对文件名称和目标字符串/差异，审批前磁盘仍为`DSHM_BEFORE`，只点击一次“允许一次”，真实write完成并返回`DSHM_LATEST_WRITE_DONE`。磁盘全文与指定字符串一致，原电脑显示文件改动和两轮五步，手机再次核对仅可查看后恢复原“工作区内修改”；设备管理权限始终false。见[工具报告](../../../plugin/artifacts/latest-runtime-check/latest-live-tool-android.json)、[修改差异](../../../plugin/artifacts/latest-runtime-check/latest-live-tool-diff.png)、[原审批](../../../plugin/artifacts/latest-runtime-check/latest-live-tool-pending.png)、[完成](../../../plugin/artifacts/latest-runtime-check/latest-live-tool-complete.png)与[验证器](../../scripts/verify-latest-live-tool-android.mjs)。这是真实模型与工具，不是受控事件或伪造回复。

测试器先后修正三处旧假设：新版会话列表使用`items`；Lexical输入框用`innerText`读取；新版工具正文通过“工具详情”展示，审批面板位于共享页面而非`remote-workspace`子树。首次工具定位超时未批准或写入，保留[失败记录](../../../plugin/artifacts/latest-runtime-check/latest-live-tool-first-selector-failure.json)，修正后只观察并批准原请求，没有重发模型消息。回复测试发送前排他创建attempt文件，默认重跑只观察；`--send-unsubmitted`仅用于原Host确认专用会话仍blank且无用户消息、输入为空的未提交恢复。工具`observe`不发送消息，已尝试审批但结果未知时拒绝重复批准。没有修改生产页面、协议、认证或工具规则。

真实模型测试已经开始，不能再调用只适用于blank会话的准备器`--restore`。测试环境继续保留供后台通知、其他工具/模式及源码实际推理验收；最终撤销本轮测试设备并关闭拥有的服务。源码Office在途/旁栏组合另已通过完整构建、精确恢复及清理，见[独立范围](../../../plugin/compatibility/latest-upstream/office-lifetime.md#旁栏会话与在途文件预览并存)，不把本节发布环境推理算作源码推理通过。

#### 拒绝、提问与PTC停止的实际结果

手机在同一专用主聊天再次请求修改另一个UUID测试文件，原普通write先被只读沙箱拒绝，再发起单次写权限申请；核对原工具参数后点击“拒绝”。原持久结果为`user rejected escalating`，模型按拒绝结果结束，没有新write重试，磁盘仍为原`DSHM_BEFORE`；随后恢复工作区内修改。见[拒绝报告](../../../plugin/artifacts/latest-runtime-check/latest-live-tool-reject-android.json)及[原审批](../../../plugin/artifacts/latest-runtime-check/latest-live-tool-reject-pending.png)。

模型实际调用`ask_user_question`，手机选择“绿色”并点击“提交”；原工具结果准确记录`{"answers":[{"id":"color_check","selected":["绿色"]}]}`，模型随后回复包含该答案的校验行。见[原问题与回答报告](../../../plugin/artifacts/latest-runtime-check/latest-live-question-android-observe.json)、[手机选择](../../../plugin/artifacts/latest-runtime-check/latest-live-question-selected.png)及[验证器](../../scripts/verify-latest-live-question-android.mjs)。该工具为原阻塞式提问，不能用仅包含定时提问的`userQuestions.settled`投影代替原工具结果。主聊天现有四轮十一执行步，原权限保持。

PTC模式在第一条消息后固定，因此通过手机原已有工作区入口另建“DSHM 新版 PTC 取消验收”，从新版原首页模式菜单选择PTC。第一轮程序未启动：原`run_code`结果为`CODE_RUN_FAILED`，Windows`SetNamedSecurityInfoW`在`grantWrite(test-project)`处返回Win32 5；见[原失败与投影](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-first-result.json)。仅改该测试会话为只读后发送一次新的探针，程序输出随机启动标记并等待90秒。手机实际停止后，原结果为`AbortError/ABORTED`，保留`Captured output`启动标记，不含程序结束标记且没有重试；手机工具详情显示“已停止”和实际输出。重新进入原会话后相同结果保持，再发无工具消息实际收到回复。最后恢复工作区内修改并返回主测试聊天。

证据：[停止与原结果](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-android-observe.json)、[停止详情](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-stopped.png)、[重入历史](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-android-replay.json)、[继续回复](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-android-resume-observe.json)、[权限与聊天恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-android-return.json)及[验证器](../../scripts/verify-latest-live-ptc-android.mjs)。原运行器注明`enforcement: partial`，本项只证明取消和输出保留，不声明完整Windows沙箱隔离。初次可写模式失败的后续定位、原操作与恢复结果如下。

#### 可写PTC与Windows目录权限

原[沙箱说明](../../../plugin/artifacts/latest-source-check/packages/sandbox/sandbox-windows-acl/README.md)明确要求工作目录由调用者拥有且具备WRITE_OWNER；只有Modify权限时，原运行器拒绝启动，不能静默绕过隔离。测试目录的原DACL只有继承的Authenticated Users Modify，所有者隐式WRITE_DAC不等于WRITE_OWNER。官方诊断脚本从原Medium令牌确认`writeDac=true/writeOwner=false`，只在本轮UUID home的`test-project`添加当前用户FullControl，未修改任何祖先目录、所有者、deny或文件内容。重新读取确认两项权限均为true，见[完整诊断](../../../plugin/artifacts/latest-runtime-check/latest-live-acl-recovery/acl-report-d1cd941e84784c40aac20738e902f5c8.jsonl)及[原DACL备份](../../../plugin/artifacts/latest-runtime-check/latest-live-acl-recovery/acl-backup-10d5bdf9a9af4622af6220a11435a951.json)。

随后手机以原工作区可写权限、同一PTC会话提交一次新的console等待程序，从原“停止生成”停止。真实原结果为`AbortError/ABORTED`，保留随机启动标记，无结束标记、无重试；手机原工具详情及重入历史显示已停止，再发一条无工具消息实际回复成功。见[可写停止](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-writable-android-observe.json)、[手机详情](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-writable-stopped.png)、[历史](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-writable-android-replay.json)、[继续回复](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-writable-android-resume-observe.json)及[返回](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-writable-android-return.json)。PTC会话目前五轮；主测试聊天仍四轮十一执行步，设备管理false。不是给会话“完全权限”，没有改工具、鉴权或运行器实现；`enforcement: partial`限制保持。

原[沙箱grant清理](../../../plugin/scripts/cleanup-latest-live-workspace-grant.mjs)撤销该工作区能力并清除Low标签，官方独立恢复脚本随后恢复原DACL规则和保护状态；原所有者保持，原沙箱附带deny随DACL恢复移除。见[grant清理](../../../plugin/artifacts/latest-runtime-check/latest-live-workspace-grant-cleanup.json)及[权限规则对比](../../../plugin/artifacts/latest-runtime-check/latest-live-acl-restored.json)。Windows恢复后新增自动继承控制标记AI，不能称完整SDDL字节相同；访问规则与继承保护一致。原批准/拒绝文件字节及提问结果另重新通过原历史审计。持久Host的工作区grant缓存已失效；后续可写沙箱验证须重启拥有的Host并重新满足目录前提，不能继续依赖旧缓存。原模型Key和日常DSH未处理。

[独立原结果审计](../../scripts/audit-latest-live-interactions.mjs)从真实`session/page`核对批准/拒绝/提问三次原callId与结果、对应测试文件磁盘字节及恢复后的权限，见[审计报告](../../../plugin/artifacts/latest-runtime-check/latest-live-original-interactions-audit.json)。只读取本轮UUID工作区和测试会话，不读取Key或注入事件。PTC准备入口及只读名称的首轮选择器超时只影响测试器，未重复提交消息；恢复仅接受同名、同工作区、未运行的原空白会话。准备、发送、停止和后续消息使用独立阶段与attempt记录，结果未知时拒绝自动重发。

### 固定源码的审批、提问与只读PTC（2026-10-06）

本节使用固定commit `5badb15009ae1756c3afe0ae0cef1faafc290ccc`的真实`pnpm dsh web`、Host71520及原独立Android。每个阶段核验30文件源码载荷和原home/会话，使用独立`source`尝试记录，不覆盖发布证据。设备管理权限始终false；本次只扩展实际验证器，没有新增生产补丁，也未改日常DSH或读取Key。

手机在原主测试会话以read-only提交指定测试文件的写入请求，查看原差异后分别批准和拒绝。批准的原提升调用`call_00_ET_inC4Hi2K8TePd1F3RZ3H9319`返回成功，磁盘内容确实改变；拒绝调用`call_00_ET_oQVYa3HhlyHfOqP3QHJC9804`返回用户拒绝，文件未变、没有工具重试。每次从原session/page核对所有新增read/write调用只指向本次UUID文件、提升请求仅一次、原结果与手机决定一致；随后恢复测试文件原字节，并由手机恢复workspace-write，再以原投影核验。证据：[批准](../../../plugin/artifacts/latest-runtime-check/latest-live-source-tool-android.json)、[拒绝](../../../plugin/artifacts/latest-runtime-check/latest-live-source-tool-reject-android.json)，两份报告的`originalDecisionVerified/permissionRestored/testFileRestored`均为true。

提问由原`ask_user_question`调用`call_00_ET_YnPEeKR3pogGMzDBxdD48015`产生。手机选择绿色并提交一次，原结果为`answers:[{id:"color_check",selected:["绿色"]}]`，当前原轮次的真实回复一致，新增工具只有本次提问。见[提问观察](../../../plugin/artifacts/latest-runtime-check/latest-live-source-question-android-observe.json)。首次观察因旧/新两条同文回复触发严格选择器失败，另存[原失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-question-android-observe-first-strict-failure.json)；修正验证器定位并增加当前原轮次审计后，只重新观察既有问题，没有重新发送或回答。

只读PTC从原手机权限菜单切换后发送一次严格指定console等待程序。原`run_code`调用`call_00_CewqvJsJC0APQC0TaUlx2455`的code与180000ms超时均精确匹配；原工具启动至少五秒后，手机使用“停止生成”。原结果为`AbortError/ABORTED`，保留`DSHM_PTC_READY_40dca8f3835a`启动输出及原`enforcement: partial`说明，没有结束标记或重试。历史重入保持相同结果，随后同一会话的真实无工具回复成功。见[停止观察](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-android-observe.json)、[历史](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-android-replay.json)、[继续回复](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-android-resume-observe.json)。[返回报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-android-return.json)证明原workspace-write已恢复，并回到主测试聊天。

此处PTC只证明外层只读程序停止，不代替源码可写沙箱、程序内部工具取消、自动审核或通知。源码后台任务与单任务停止另见[实际专项](./latest-background-jobs.md#固定源码的后台任务与停止2026-10-06)。源码租约仍供后续验收使用，最终撤销测试绑定和恢复源码/资源尚未完成；不能据此发布完整新版支持声明。

### 固定源码的可写PTC与权限恢复（2026-10-06）

使用同一原PTC会话、真实pnpm Host71520及独立Android，保持workspace-write，不给设备管理权限。官方诊断脚本确认本轮测试目录writeDac=true/writeOwner=false，仅在该UUID home的`test-project`添加当前用户FullControl；原Medium令牌、所有者、祖先目录和文件内容保持。单次报告的原verification确认两项权限均true，见[原诊断](../../../plugin/artifacts/latest-runtime-check/latest-live-source-acl-recovery/acl-report-c14ac2a8b86f42eba90b7df744ca8ca0.jsonl)。验证器先核验这一独立报告，拒绝复用发布或含糊的修复证据。

原`run_code`调用`call_00_B5wjd54Su7PjhmkJqAYP7048`/turn8的code和180000ms超时严格一致，手机停止后原结果`AbortError/ABORTED`保留`DSHM_PTC_READY_422b6a133409`及`File sandbox: workspace-write; enforcement: partial.`，没有结束标记或重试。原工具详情、历史重入及随后同一会话真实无工具回复通过。证据：[停止](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-writable-android-observe.json)、[历史](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-writable-android-replay.json)、[继续回复](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-writable-android-resume-observe.json)、[返回主聊天](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-writable-android-return.json)。这证明可写权限下外层等待程序的启动/停止，不代替实际程序内文件写入、内部工具取消或自动审核。

使用固定源码完整构建的原AclWriteGrant撤销本次工作区能力并清除Low标签，随后原诊断产生的独立恢复脚本恢复DACL。见[原能力清理](../../../plugin/artifacts/latest-runtime-check/latest-live-source-workspace-grant-cleanup.json)及[权限恢复核对](../../../plugin/artifacts/latest-runtime-check/latest-live-source-acl-restored.json)：所有者、规则、继承保护及DACL字节均与本轮before相同；此处字节相同只针对本轮已有AI标记的基线，不覆盖发布轮首次恢复的差异。

为清除已撤销授权的运行时缓存，拥有的控制会话50966正常stop并以0退出，原Host71520/控制器进程27216经系统确认不存在、原home的cleanup记录匹配。以TTY重新运行`node scripts/start-latest-live.mjs --source --resume --diagnose-output`，拥有的控制会话37790/控制器进程35580、原Host68820恢复同一home和16901网关；实际手机重新进入同一主测试会话，权限workspace-write、未运行，Key未读取。

[严格恢复审计](../../../plugin/artifacts/latest-runtime-check/latest-live-source-writable-resume-after-failed.json)仍未通过：配对、五会话、统计、模型、模式和权限等其他字段完全一致，但主会话207→208增加一个原`session/end-seed`空事件。新诊断保存此差异并仍以1退出，没有忽略序号或改为passed。源码租约仍ready，原355资源最终恢复尚未执行；剩余完整范围及此恢复差异继续验收。

### 持续真实模型联调环境（2026-10-05）

2026-10-06后台通知前置检查：持久模型UID进程已结束，原结束原因未知；正常Launcher启动暴露该UID仍保留修复前APK的locale/theme错误。只更新独立测试包后普通聊天及抽屉Remote恢复，165资源/构建/lint核对通过。后续用户反馈无App，当前MuMu包管理器证实主包安装记录也已丢失，原因未明；重新安装同一APK后原页面确认未绑定。已按原配对流程恢复新的仅聊天授权、撤销旧丢失绑定，原模型/PTC会话仍在列表，未发送消息。原16901反向端口已恢复。通知测试消息尚未发送；此前打开原会话并开始验证的组合命令被自动审批拒绝，仍等待用户手动打开专用会话。详细范围与证据见[冷启动与重新配对恢复](./latest-ordinary-boot.md#代码与证据)，通知投递/点击仍未验证，不修改上节真实模型/PTC通过结论。

[后端监督脚本](../../../backend/scripts/start-latest-live.mjs)准备持久的独立新版Host、PGlite网关和测试工作区，通过本机stdin调用原管理与会话接口，没有新增公网管理路由。它不复制日常环境、App或Key；登录入口与一次性配对链接仅保存在本机忽略目录。Key由用户在原DSH配置窗口本人填写，监督脚本不读取凭据。

[独立Android准备器](../../scripts/prepare-latest-live-android.mjs)已完成原生配对、电脑批准后的连接及已有工作区新建聊天，显示DSHM自己的共享输入框和聊天页、没有整站iframe。实际手机又将本轮空聊天命名为“DSHM 新版手机真实模型验收”，原Host会话清单核对唯一标题、工作区、blank状态及实际sessionId一致；对应准备阶段记录为`latest-live-android-session.json`。准备状态与截图位于`plugin/artifacts/latest-runtime-check/latest-live-android.json`、`latest-live-android-page.png`，其`inferenceVerified=false`只描述未推理的准备阶段。2026-10-06已核对原Key配置状态并通过上节真实回复与文件写入审批，主会话已有四轮十一执行步，专用PTC会话另有失败、两种权限下停止及后续回复共五轮真实执行，不能继续视作空聊天；结果由独立模型/工具报告维护。测试设备仍只获聊天权限，最终必须撤销并停止本轮拥有的服务及反向端口。

准备器首轮误认为空白会话出现在“最近”，随后又误把新建按钮当作插件导航的空会话复用入口，均为测试脚本假设错误。实际`RemoteModel.create`调用原会话创建；`RemoteWorkspaceNavigation.startSession`才按工作区、归属和未归档条件复用空会话。修正准备器后实际页面验证通过，原Host清单同时存在桌面准备的空会话与手机新建的空会话，没有发送消息来伪造历史。桌面`session/list`请求须沿用原`args._request`参数，不能发空args。

在`backend/`运行`node scripts/start-latest-live.mjs`并保持终端运行；输出只含公开测试位置/状态。本机忽略目录中的`private-entry.json`用于在原DSH页面登录，勿输出或分享其中URL。stdin支持`status`、`pair`、固定名称/指纹核对后的`approve`和`revoke`、固定白名单`rpc`、`stop`。Android准备器须显式指定已核验的adb路径和`emulator-5554`，默认只清理独立测试UID并领取本轮配对，`--connect`批准后进入，`--open`从已连接列表新建，`--name`通过原手机重命名入口设置专用标题，`--verify-open`只核对当前准备聊天的标题和输入框，`--inspect`只读当前页面。其他阶段不要再次运行默认命令，以免丢弃本轮测试绑定；真实聊天测试开始后，不再用准备器报告替代推理验收结果。

`stop`只关闭监督脚本拥有的电脑Host、网关和数据库；测试方还须先撤销本轮设备，并结束独立Android UID、移除本轮adb反向端口。保留用户自行填写的测试Key，不自动读取、复制或移除；日常App和旧版DSH保持原位。

### 新版电脑应用选择与图标（2026-10-05）

发布入口补充实际确认在途撤权：真实原生桥提交一次打开请求，原方法调用前等待；撤销设备后signal已取消，原方法完成，Windows确认测试路径未打开。手机退出聊天显示授权失效，无成功提示、确认、忙碌状态或自动重发；正常主聊天/旁栏启动一并回归。协议/独立Android/原Host重启组合206.01秒通过，临时授权、测试UID/端口/Host清理。见[手机报告](../../artifacts/latest-mobile-runtime/latest-desktop-inflight-npm-android.json)、[实际失效页](../../artifacts/latest-mobile-runtime/latest-desktop-revocation-npm-revoked.png)与[协议、首轮测试假设错误和范围](../../../plugin/compatibility/latest-upstream/desktop-apps.md#应用查询在途异常)。这是原生入口和失效页实测，不是伪造返回，其他应用及所有在途组合不能由此推定通过。

源码同范围最终250.26秒通过，完整十一项/28文件构建、原回归、实际pnpm与独立Android/Host重启，以及原28源码/启动载荷/根脚本、355资源原摘要和Git干净恢复均通过。手机实际一次确认撤权、失效页和Windows无测试路径窗口与发布入口一致；见[源码手机报告](../../artifacts/latest-mobile-runtime/latest-source-eleven-desktop-inflight-android.json)、[失效截图](../../artifacts/latest-mobile-runtime/latest-desktop-revocation-source-revoked.png)及[完整证据和未覆盖项](../../../plugin/compatibility/latest-upstream/desktop-apps.md#应用查询在途异常)。两种入口均只有撤销后的预期401，无真实Key/模型；本轮未启用Office/传输，不扩大其他专项结论。

发布入口实际Windows启动已通过：独立Android先取消、再确认资源管理器打开；原生桥观察一次启动，真实OS窗口路径与本轮专用工作区一致。只关闭测试新窗口并核对句柄消失，保留原有用户窗口。手机/原Host重启组合184.44秒通过，临时授权、独立UID/端口和两个测试Host已清理；无页面错误，撤销后只有预期401。见[手机实际启动](../../artifacts/latest-mobile-runtime/latest-desktop-open-npm-android.json)、[组合](../../../plugin/artifacts/latest-runtime-check/latest-desktop-open-npm-android.json)、[清理](../../../plugin/artifacts/latest-runtime-check/latest-desktop-open-npm-cleanup.json)与[结果截图](../../artifacts/latest-mobile-runtime/latest-desktop-apps-npm-opened.png)。这不证明其他电脑应用、旁栏或在途异常；下方173.59秒及flags为空的源码报告保持原范围。

五个发布运行/声明文件和两个固定源码文件的迁移见[电脑端证据](../../../plugin/compatibility/latest-upstream/desktop-apps.md)。原Windows Host真实探测的目录及explorer PNG经真实网关与原已认证网页一致；独立MuMu App从DSHM自己的菜单读取应用列表、成功解码图标、选择文件资源管理器并核对当前会话工作区。取消回到列表，真实原生桥观察到零次启动调用，没有改写响应。

发布CLI/网关/Android及原Host重启组合173.59秒通过，撤销前页面和控制台错误为零，撤销后只有预期http_401；设备撤销、管理收回、独立UID/反向端口和拥有的Host清理。见[手机报告](../../artifacts/latest-mobile-runtime/latest-desktop-apps-npm-android.json)、[列表](../../artifacts/latest-mobile-runtime/latest-desktop-apps-npm-list.png)、[确认](../../artifacts/latest-mobile-runtime/latest-desktop-apps-npm-confirm.png)及[组合报告](../../../plugin/artifacts/latest-runtime-check/latest-desktop-apps-npm-android.json)。十一项/28文件源码候选的完整构建、实际pnpm/网关/重启协议及28原源码/355资源精确恢复另已通过，Git干净；这次flags为空，不是十一项源码Android验收，见[源码组合](../../../plugin/artifacts/latest-runtime-check/latest-source-eleven-desktop-combined.json)。该轮没有实际启动，后续结果如下；无真实Key，缺凭据结果不算模型执行。

十一项源码的Android/Office/传输/实际目录启动全组合现已通过：默认堆完整构建307.24秒，41函数、159取消、188客户端、五项pnpm进程、72operations、实际模块身份及八项应用服务通过；真实`pnpm dsh web`/网关/独立Android与原Host重启257.82秒通过。手机选择/取消、确认一次启动并由Windows核对专用路径、关闭测试窗口；六种Office文件/历史附件、缓存重新核验/源改变/打开时自动刷新及其他既有手机流程通过。原28源码/启动载荷/根脚本逐字节恢复，原完整构建298.05秒、355资源摘要一致且Git干净。授权、两个测试Host、UID和反向端口清理；撤销前无错误，撤销后仅预期401。见[手机](../../artifacts/latest-mobile-runtime/latest-source-eleven-desktop-open-android.json)、[打开截图](../../artifacts/latest-mobile-runtime/latest-desktop-apps-source-opened.png)、[源码整体](../../../plugin/artifacts/latest-runtime-check/latest-source-eleven-desktop-open-combined.json)、[Host](../../../plugin/artifacts/latest-runtime-check/latest-source-eleven-desktop-open-relay.json)及[清理](../../../plugin/artifacts/latest-runtime-check/latest-source-eleven-desktop-open-cleanup.json)。旁栏、在途异常、其他应用和真实模型执行仍待验；这轮不是完整新版兼容结论。

### 手机实际安装、升级与重启生效（2026-10-05）

[独立手机管理专项](../../../backend/tests/latest-plugin-upgrade.test.ts)在发布CLI与实际安装/完整构建后的原`pnpm dsh web`分别通过40.55秒和68.68秒，均使用测试UID的DSHM自有页面及原电脑管理局部组件。首次安装可立即启用；同名升级没有“立即启用”，显示下次启动加载；原Host重启前真实回执仍是v0.0.1，重启后为新PID的v0.0.2，手机详情自动重读新版并显示一个运行中组件。随后从手机卸载，核对原profile依赖及bundle选择删除，管理收回、测试设备撤销、UID与端口清理。

无组件或控制台错误，不加载电脑整站。报告：[发布入口](../../artifacts/latest-mobile-runtime/latest-plugin-upgrade-npm-passed.json)、[源码入口](../../artifacts/latest-mobile-runtime/latest-plugin-upgrade-source-passed.json)、[原Host](../../../plugin/artifacts/latest-runtime-check/latest-source-plugin-upgrade.json)。测试包由项目自行打包且无安装脚本/第三方依赖，回执由真实包在原Host加载时写入。原安装器拒绝不兼容内部组件后，实际pnpm修复并恢复旧包及配置，发布和源码产物另各有专项通过，见[管理边界和原失败](../../../plugin/compatibility/latest-upstream/package-management.md)。普通Key、历史、绑定与日常App未改；专用测试消息的凭据缺失不算推理。下载中取消、脚本副作用、进程崩溃和完整新版能力继续验收。

### 十项源码组合与插件管理补丁（2026-10-05）

手机管理另增加下载中取消的独立场景：真实pnpm向受控本地HTTP请求归档，手机点击取消后电脑确认、两个真实进程和连接结束，配置原字节恢复、测试包未选中，随后安装/升级/重启/卸载仍通过。发布入口75.57秒、源码入口85.80秒，详见[取消范围及原失败](../../../plugin/compatibility/latest-upstream/package-management.md#手机下载中取消2026-10-05)；源码外层十项完整构建、原回归和26文件/355资源恢复组合也通过，具体报告区分本专项与Office/Web范围。首轮后续卸载的Windows锁文件EPERM仍保留为间歇性未定位问题。

电脑新增查询进程树取消与升级重启提示后，十项/二十六文件的完整构建、41项源码函数、实际安装159项取消/188项客户端/五项pnpm进程及原operations72项、模块身份通过。实际原`pnpm dsh web`→网关→独立Android/Office/传输及原Host重启239.72秒通过；26原源码、根脚本和引导精确恢复，原完整构建304.53秒、355资源摘要与Git干净通过。见[固定十项Android记录](../../artifacts/latest-mobile-runtime/latest-source-ten-android.json)、[阶段](../../artifacts/latest-mobile-runtime/latest-source-ten-android-progress.json)及[电脑组合](../../../plugin/artifacts/latest-runtime-check/latest-source-ten-remote.json)。Android无页面错误，仅撤销后预期401；拥有的Host、测试UID、反向端口与临时授权清理。

发布包十项的真实CLI/网关/自有Web375×667/Office传输及Host重启146.55秒另通过，页面与控制台零错误，见[固定Web记录](../../artifacts/latest-mobile-runtime/latest-package-management-page.json)及[发布包链路](../../../plugin/artifacts/latest-runtime-check/latest-package-management-page-relay.json)。本轮未运行十项源码Web，不混写两个入口；普通App没有升级。插件管理两项的原失败和单项证据见[电脑边界](../../../plugin/compatibility/latest-upstream/package-management.md)，真实手机安装升级、执行新版及卸载的后续证据见上方独立专项；取消下载及真实模型/提醒仍待验，不能用组件测试代替。

### 八项源码组合与PTC取消（2026-10-05）

电脑新增两处固定新版PTC取消修复后，八项/二十三文件的默认堆完整构建、实际安装引导/159项取消、模块身份、原`pnpm dsh web`→网关→独立Android/Office/原Host重启组合通过。完整联调244.20秒，保留原300秒时限；23原文件/根脚本/引导载荷精确恢复，原完整构建298.53秒，355客户端原摘要一致且源码Git干净。见[固定整体报告](../../../plugin/artifacts/latest-runtime-check/latest-source-eight-remote.json)、[Android实际入口](../../artifacts/latest-mobile-runtime/latest-source-eight-android.json)、[阶段](../../artifacts/latest-mobile-runtime/latest-source-eight-android-progress.json)及[拥有进程清理](../../../plugin/artifacts/latest-runtime-check/latest-source-eight-cleanup.json)。

此次仍使用独立测试UID的DSHM自有页面。配对/历史/模型同步、原动态审批后的局部UI/Host调用、模式/模型管理、六格式工作区及历史附件、缓存/版本/自动刷新与资源释放、撤销拒绝均通过。撤销前零错误，撤销后仅预期401；测试Host、独立UID、反向端口和临时授权清理核验。本轮不包含Web专项；此前七项载荷的Web结果保留自己的范围，不能代称八项Web全组合通过。

电脑PTC原源码与发布包另通过真实Node进程的停止/超时/程序异常，核对原只读沙箱、停止前输出和进程退出；累计41项原源码函数另通过并恢复23原文件。详见[取消分类与Auto保留边界](../../../plugin/compatibility/latest-upstream/tool-cancellation.md)。这不证明手机实际点击停止、模型推理或通知；本轮没有真实Key，完整新版交付仍进行中，普通App与日常DSH未升级。

普通构建保持旧版 SDK；[新版构建器](../../scripts/latest-mobile-build.mjs)只在 `--latest-candidate` 时使用固定版本的独立 runtime 和源码子集。1702 个源码/元数据文件经 Git blob 校验取得，见[下载器](../../scripts/fetch-latest-mobile-sources.mjs)及[结果](../../artifacts/latest-mobile-source/source-report.json)。这不是完整上游检出，源码启动入口仍未验证。

新版构建拒绝混入旧 DSH 源文件及旧 SDK。原设置卡片、聊天呈现策略、面板控制器和 Office face 根据实际新契约接入；手机保留自己的页面、共享聊天布局及固定授权范围，不启用电脑整站。版本判断分别编译到 Web 和 Android 原生通知层，不能只放宽一个入口。

Android 使用独立 `dev.dshmobile.validation.latesttest` UID，构建资产来自 `artifacts/latest-mobile-dist`，APK 位于 `artifacts/latest-android-build/outputs/apk/debug/app-debug.apk`。见[Gradle 配置](../../android/app/build.gradle.kts)。只清理该测试 UID，不清理用户原 App，不复制其 Key、历史或绑定。

## 已验证及限制

| 入口 | 实际结果 | 限制 |
| --- | --- | --- |
| Edge 375×667 | 真实 Host 与网关经 DSHM 自有页面读取列表和持久消息、切换模型并核对电脑投影；四张原设置卡读取，Shell 保存/恢复继承；电脑改变实际 profile 设置后手机表单失效、重新读取和恢复通过。无页面或组件边界错误。 | 浏览器桥只替代 Android 载体，不能由此推出原生功能通过。 |
| Android 12 模拟器 | 独立 APK 通过真实原生 DPoP 配对、批准后连接、资源与 WebSocket 传输、原历史呈现、模型双端同步、原设置卡读取；原工作区文本预览、修改同步、删除/恢复及关闭释放订阅通过；Office六格式转换/PDF预览、临时管理收回、设备撤销及重连拒绝通过。 | 无真实模型回复、工具审批、前后台输出或完整Office异常结论；没有目标真机性能结论。 |
| 设置并发 | 新版原 Shell/Agent 卡片保存期间禁用控件，避免新草稿被旧保存结算清空；固定字段投影返回真实 `documentId`，匹配原实例变更事件，其他实例不使表单失效。 | 未开放任意配置读写；仍需核对完整提供方、预设和管理模块。 |
| 电脑输出与模块观察 | 新版原工具的前台字节旁路、Gateway只读待办观察及bootstrap选择名单已在隔离runtime迁移；原生PowerShell与只读沙箱、真实新版Loader/Gateway专项通过。浏览器与Android基础加载也使用这些候选补丁。 | 不代表手机真实执行卡、模型审批提醒或实际插件升级的局部状态通过；详见电脑[逐项矩阵](../../../plugin/compatibility/latest-upstream/patch-matrix.md)。 |
| 动态插件连接与运行 | 新版Host候选保留原VM、生成协议及并发审批；独立目录/寿命/清单迁移的20项专项通过，叠加输出/通知/bootstrap共32项通过。真实Web及Android面板已打开时定义、版本更新与移除推送通过；原待审批批准、局部界面加载、真实Host echo调用和移除清理通过。 | 原Host run由隔离夹具触发，无模型生成；客户端异步时序专项使用受控端点，不代表完整双客户端并发、重连或源码安装/恢复已通过。 |
| 会话模式选择、默认及管理 | Web及独立Android从手机已有工作区入口创建空白会话，切换健康预设并核对双端投影；历史会话选择禁用。原卡片保存默认、新会话继承及失效重读通过。自有页面复制用户模式、取消/确认删除，电脑原目录与保存配置一致；只读保存位置显示通过。代码工作视图偏好双端写入/推送、模式隐藏及恢复默认通过。 | 模式创作与实际模式工具执行仍待验。删除供旧会话保留归档声明，不物理销毁组成。 |
| 旧版回归 | 手机 431 项测试、普通Web构建和原插件插槽浏览器回归通过；设置新增身份测试通过，插件设置/并发 10 项、手机 scope 5 项通过。 | 后续变更仍需最终旧版构建和适当回归。 |

实际脚本：[浏览器](../../tests/support/latest-remote-page.mjs)、[Android](../../tests/support/latest-remote-android.mjs)、[跨端 Host](../../../backend/tests/latest-host.test.ts)。结果分别见 [Web](../../artifacts/latest-mobile-runtime/latest-remote-page.json)、[Android](../../artifacts/latest-mobile-runtime/latest-remote-android.json)和[Host](../../../plugin/artifacts/latest-runtime-check/latest-relay-test.json)。产物及证据不随 Git 分发。

隔离 Host 没有可用于模型执行的真实 Key；认证专项仅使用独立虚构 Key。消息进入原 Agent 与持久记录，原服务返回 `MISSING_CREDENTIAL`；该结果只证明提交链路，不算模型执行或工具审批通过。

动态专项使用[隔离Host夹具](../../../backend/tests/support/latest-cordis-host-fixture.mjs)，只接受本次独立home中的专用会话操作。审批来自原`dynamicCordisRunner.run`，批准与执行经过真实生成RPC/VM及客户端运行器；不以面板手动运行冒充审批（原手动按钮本身已经授权）。夹具不进入正式包、不操作用户文件。最新原Cordis组件在清单为空时隐藏入口，测试先登记真实条目后再验证；不能根据空列表推断模块未激活。

实际面板曾暴露新版侧栏契约变化：`TabHookContext`新增`active/shortcuts`，Guide新增`useShortcuts`。手机[面板组合](../../src/remote-plugin-panels.jsx)现使用实际手机快捷键服务目录并传递真实可见状态；旧版没有该服务时为空目录。修复后真实两个入口无渲染异常，旧版431项测试、普通Web构建和插件插槽浏览器回归通过。Android撤销后的预期401单独记录，撤销前插件错误列表为空。

## Agent 预设契约与当前迁移边界

新版[原目录控制器](../../artifacts/latest-mobile-source/packages/client/ui-agent-preset/src/client/settings-store.ts)使用`agent-preset-registry`，目录不再返回`modeSelectionEnabled`；默认设置改写`selectedDefault`。手机[模式目录](../../src/remote-agent-presets.mjs)依据所编译的固定上游namespace区分两版：新版允许空会话选择，旧版仍要求电脑明确开启旧开关。新版原配置事件使用可自定义的profile实例ID，手机对配置变化重新读取只读目录，避免继续使用过期模式。选择回执不乐观覆盖当前模式，仍等待原会话投影。迟到读取、损坏预设过滤与销毁由[2项新版原目录专项](../../tests/latest/agent-presets.test.mjs)覆盖，普通旧版431项测试及Web构建通过；新版专项独立运行，不让普通构建依赖候选源码产物。

最新跨端测试还核对历史会话禁用、手机创建空白会话和模式双端同步；不从「最近」列表打开空白会话（产品本就不列出空白项）。共用[实际窗口步骤](../../tests/support/latest-agent-preset-page.mjs)，通过正常手机按钮和原RPC提交，不直接改手机模型。设置保存的电脑核验改用原桌面`settings/describe`，避免测试与浏览器共用设备身份时，核验脚本分配的新Remote快照使手机旧快照失效；生产快照保护不放宽。

新版原预设卡片的默认动作由[局部适配器](../../src/remote-preset-defaults.mjs)接入原列表、帮助和声明预览，不启用电脑整页或通用settings代理。[固定协议](../../../backend/packages/protocol/src/remote-settings.ts)仅增加`agent-preset-registry.selectedDefault`，沿用管理权限、一次性快照、修订与真实实例身份检查。[ProfileSettings](../../../plugin/src/profile-settings.ts)按实际模块的唯一实例写入；普通旧版包即使收到该namespace仍拒绝，仅固定新版候选协商`presetDefaultSettings`。旧`settings/update`策略不放宽。卡片未获有效读回或电脑配置变化后禁止默认动作，主动重读后恢复；历史会话不重新组成。3项[默认设置专项](../../tests/latest/preset-defaults.test.mjs)覆盖管理拒绝、实例变更、历史保护、切页及销毁，合并原目录专项5项通过。真实Web及独立Android组合测试通过默认保存、新会话原投影继承、电脑恢复继承和手机重读；测试设备收回授权/撤销，隔离进程已结束。旧手机431项、普通Web构建及插槽回归、旧插件202项全量回归及新增旧包拒绝入口专项通过，后端设置/管理11项通过。

新版[原注册表](../../../plugin/artifacts/latest-runtime-check/node_modules/@deepseek-ai/dsh-agent-preset-registry/lib/index.js)仅公开list/read/select，不再提供旧copy/deletePreset接口，resolve也不返回旧trust/path。预设成为[普通插件声明](../../../plugin/artifacts/latest-runtime-check/node_modules/@deepseek-ai/dsh-agent-preset/lib/index.js)。原[ConfigEditor](../../../plugin/artifacts/latest-runtime-check/node_modules/@deepseek-ai/dsh-config-editor/lib/index.js)只提供已有条目编辑，不能把其edit当成新增/移除接口。复制/删除及Coding Tools偏好现由下方受限操作迁移；创作入口仍待迁移，不能开放任意配置写入。

配置位置已由[新版只读适配](../../../plugin/src/profile-preset-directory.ts)接通：只接受原ConfigEditor可寻址、活动、唯一的`@deepseek-ai/dsh-agent-preset`声明，以字面config.id匹配原目录身份。返回原`documentPath`及其目录，表示此profile的**修改保存位置**，不是内置bundle原声明的源文件，也不是旧版每个预设独立的目录。读取前后检查原服务、条目、config/fiber身份及路径；不匹配、重复或替换时拒绝。不写文件、不打开电脑文件管理器，沿用网关/Host管理校验。普通旧版行为不变，只有固定新版候选协商`presetProfileDirectory`。

手机在自己的「电脑设置 → Agent模式」原卡片下增加[配置位置入口](../../src/remote-plugin-slots.jsx)，选择预设后主动读取。长Windows路径换行；关闭页面、换预设、换连接及卸载取消读取并清空旧位置，见[寿命控制](../../src/remote-preset-directory.mjs)。真实新版Host→网关验证未授权拒绝、不存在的声明拒绝、保存路径准确及配置字节未改变；Edge375×667与独立MuMu APK从真实按钮显示同一路径，换预设立即清空，两个入口无组件异常，授权已撤销。4项[Host边界测试](../../../plugin/tests/profile-preset-directory.test.ts)与3项[手机寿命测试](../../tests/latest/preset-directory.test.mjs)通过，内存夹具不代替上述真实链路。

配置位置阶段旧版插件207项、旧手机431项、普通Web构建与插件插槽浏览器回归通过；新旧插件及后端类型检查通过。新版预设目录/默认/位置8项专项通过。后续复制/删除阶段的现行结果以下方记录为准；完整新版兼容未完成。

### 复制、删除与重启恢复（2026-10-05）

[Host管理适配](../../../plugin/src/profile-preset-management.ts)由原ConfigEditor定位唯一根声明，借助原HMR串行、原文件锁/原子写入、原profile解析/组合与Loader调和保存；不是调用不存在的原edit增删，也没有维护插件自有的第二份预设文件。三个[固定协议](../../../backend/packages/protocol/src/remote-presets.ts)仅接受ID、名称、快照与确认，不接收插件配置、模块、YAML或路径。快照绑定设备连接/5分钟/一次消费/上限128；保存前核验原服务、条目完整raw参数、config/fiber、固定路径和全层配置/文件字节。管理权限由网关及Host再次核验，旧包拒绝该候选能力。

只允许删除用户profile直接插入的根预设，bundle及嵌套Include/CLI声明保持。当前默认用户模式删除时恢复原default；home/CLI覆盖阻止恢复则拒绝。删除不是丢弃配置：新版原注册表只在内存保留revision，电脑重启后丢失定义会阻止旧聊天恢复。因此[固定候选归档补丁](../../../plugin/compatibility/latest-upstream/preset-archive.mjs)在两个真实npm编译模块保留archived声明，原list隐藏它，原select/retain的选择lease拒绝归档身份；原resolve/mount/旧会话恢复保持。同ID仍占用，避免新定义冒用历史身份。静态类型公开字段不作为任意配置通道。补丁匹配固定原字节哈希、允许已登记的自身早期版本到当前版本，不覆盖未知修改，仅在项目内runtime应用；源码安装/恢复器仍待交付。

[手机控制器](../../src/remote-preset-management.mjs)和[自有局部页面](../../src/remote-plugin-slots.jsx)提供复制字段、删除确认/取消与主动重读；原列表、帮助和声明预览保留。关闭/换连接/卸载清空旧快照，迟到结果不发布；未知写入清掉快照，不自动重发。原生[方法白名单](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)同步接入三个固定操作，不扩大通用代理。

实际验收：真实发布CLI→网关→Edge375×667及独立MuMu APK的复制、取消删除、确认删除与电脑文件/原目录一致通过；保留已有会话投影。真实Host另验证原组成YAML一致、同ID拒绝、外部文件变更拒绝且保留修改、快照一次消费及同设备新连接不能用旧快照；原Loader故障夹具使新复制组成激活失败，原文件字节（包括原不存在状态）和目录准确回滚。最后结束Host，不加载DSHM插件/夹具重新启动原profile：归档模式不在目录，原声明读取保持，旧会话恢复并接收消息、原模式投影不变。没有Key，仍不声称模型推理通过。最终三端及重启组合49.46秒通过，两个Host进程结束，所有测试设备撤销，Android撤销前错误为空、预期401仍单列。

新增3项手机寿命/提交测试，合并新版预设专项11项通过；2项实际候选retain/select异步时序测试通过（内部状态为受控夹具，不代替真实鉴权/会话）。后端固定协议/权限/设置9项通过，旧插件208项、旧手机431项全量回归通过，新旧插件及后端类型检查、普通Web构建和插槽浏览器回归通过。

新版专项命令：`node --test tests/latest/agent-presets.test.mjs tests/latest/preset-defaults.test.mjs tests/latest/preset-directory.test.mjs tests/latest/preset-management.test.mjs`。真实跨端命令沿用上方Host测试，并设置Web/Android开关和显式模拟器身份；APK仍使用独立测试UID。归档时序命令见[测试](../../../plugin/tests/latest-preset-archive.test.mjs)。真实报告新增`presetOriginalLoaderFailureRolledBack`、`presetCopiedDeletedAndRetained`、`presetSnapshotsConnectionBound`、`presetArchivedSessionResumedAfterRestartWithoutPlugin`和两个页面的`presetCopyCancelDelete`。

### 代码工作视图偏好（2026-10-05）

新版[原偏好](../../artifacts/latest-mobile-source/packages/client/ui-settings/src/developer-tools-settings.ts)属于`ui-settings.enabled`，原[ConfigForms](../../artifacts/latest-mobile-source/packages/client/ui-settings/src/client/config-form.ts)供开关和模式卡共用。普通远程client的memory设置无法同步电脑，因此[候选组合](../../src/remote-config-forms-latest.mjs)保留该原服务，仅将这一个scope替换为[固定远程偏好](../../src/remote-coding-tools.mjs)，其他未开放namespace保留原内存行为；仅固定新版替代原ui-settings apply，旧构建使用空适配入口。原组件与DSHM自有模式选择共用同一偏好，不加载电脑整站。

基本聊天授权只读一个布尔值及真实文档ID；修改仍经管理授权、原SettingsForms、唯一profile实例、修订和一次性快照。严格字段及旧包拒绝分别由[协议测试](../../../backend/tests/coding-tools.test.ts)和[旧Host测试](../../../plugin/tests/remote-adapter.test.ts)覆盖。电脑事件、重连及关闭让旧读取失效，未知写入不自动重放。关闭前如原默认为PTC/Minimal则先纠正为健康Standard，与原页面两次独立写入一致，不承诺跨namespace事务。模式过滤使用新版原`requiresCodingTools`，不误隐藏同ID有自定义名称的用户模式；历史会话模式标签保留，已有会话不重新组成。

真实官方发布CLI→网关→Edge375×667与独立MuMu APK通过手机关闭、电脑用户层写入、原默认纠正、PTC/Minimal隐藏、恢复继承及重新出现；电脑原设置改变后手机自动重读并更新模式卡。最终三端加原Host重启组合61.91秒通过；两个Host和临时网关结束、授权撤销、测试App及adb reverse清理。撤销前无组件错误，Android撤销后的预期401仍单列；隔离环境无Key，不算模型推理。报告两端新增`codingToolsSavedInheritedAndPushed`。

3项[偏好专项](../../tests/latest/coding-tools.test.mjs)覆盖聊天只读、同名用户模式、默认纠正/恢复继承、代次/销毁迟到结果及未知写入；这是受控载体，不代替上述真实链路。合并新版预设专项14项通过，后端协议/权限/设置9项通过，旧插件209项（2个worker）及旧手机431项全量通过。普通Web构建和原插槽浏览器回归通过；新旧插件及后端类型检查通过。专项命令在上一节基础上增加`tests/latest/coding-tools.test.mjs`。此能力不需要增加第七个电脑补丁；模式创作及完整新版管理仍未完成。

### 创造模式入口与插件管理页（2026-10-05）

新版原 Agent 预设的两个创造入口均沿用原 `startCreatorDraft`、共享 staging 与 seat apply：设置页「让 Agent 帮我创建预设模式」及插件菜单「让 Agent 创建插件」先导航到空白聊天，再选择原 `cordis` 模式，不改历史会话，不自动提交创作提示词。手机仍使用自己的聊天页面。

真实管理页加载暴露两项契约差异：[新版原插件管理页](../../artifacts/latest-mobile-source/packages/client/ui-plugin-manager/src/client/index.ts)接管 `plugins.item` 的声明，并订阅 `ctx.layout.panelInfo`。手机[固定设置注册](../../src/remote-plugin-settings.jsx)改用新版私有配置插槽，在私有插槽与原管理页插槽注册同一组组件；[新版配置分页](../../src/remote-settings-components-latest.jsx)读取私有插槽，旧版仍沿用原槽位。没有允许重复声明，也没有开放通用配置写入。[全局面板适配](../../src/remote-global-panels.jsx)向原 LayoutController 传入与 root hook 共用的真实 observable，面板状态来自手机同一 store。

插件菜单复用当前空白聊天时 ID 保持，原来只按 ID 关闭设置窗口会留下管理页遮挡。因此[会话视图](../../src/remote-session-view.mjs)在接受导航时发布 `selectionRevision`，[实际聊天入口](../../src/ui/RemoteWorkspace.jsx)据此关闭覆盖页；普通投影刷新和拒绝导航不改变该标识，旁栏视图维持独立身份。[新增测试](../../tests/remote-session-view.test.mjs)覆盖这些区别，真实页面测试覆盖同 ID 返回聊天，未用业务注入代替导航。

最终真实官方发布 CLI→网关→Edge375×667与独立 MuMu APK，加原 Host 重启组合 **73.27 秒通过**。两端均从历史会话进入创造模式、从空会话再次进入、从原插件菜单进入；原桌面列表核验历史保持、会话数不增加、空会话同 ID/同工作区及 `cordis` 投影。原管理页的四张固定设置卡实际打开且可读；自有设置入口的保存/恢复继承回归同时通过，见[共享页面验收](../../tests/support/latest-agent-preset-page.mjs)及[真实 Host 核验](../../../backend/tests/latest-host.test.ts)。Web/Android 报告 `presetCreatorHistoryProtectedAndBlankReused` 与 Host `presetCreatorDraftLanded` 为 true；Web 无组件异常，Android 只有撤销后的预期401。测试授权撤销，两个 Host/临时网关结束，独立测试 App 与 adb reverse 清理。

旧手机全量 **432 项通过**（新增1项），普通 Web 构建和插槽浏览器回归通过，后者涵盖原全局面板导航、叠层焦点、草稿与输出页恢复。此项没有新增电脑补丁。隔离环境未配置 Key，**模型实际创建预设或插件、完整新版插件安装/取消/恢复仍未验证**；入口通过不表示这些能力完成。提供方基础管理的后续实测见下一节。

### 提供方基础管理（2026-10-05）

沿用已有[固定提供方通道](../../../plugin/src/provider-creation.ts)、[原表单桥接](../../../plugin/src/profile-settings.ts)与手机自有表单，本轮未修改生产实现。新版真实官方 CLI→网关直接验证无认证自定义提供方创建、名称/超时修改、过期快照拒绝、模型名称修改及移除；原 `settings/describe` 核对配置持久值，模型修改保留原容量及原服务生成的其他字段。未开放通用设置或凭据 RPC。

[共享页面步骤](../../tests/support/latest-provider-page.mjs)再从 Edge375×667及独立 MuMu App 的「电脑设置 → 模型 → 其他模型提供方」逐项操作：新增、改名、修改模型名称、取消移除及确认移除。每步由[真实 Host 测试](../../../backend/tests/latest-host.test.ts)核对原设置与模型目录；取消保持配置，移除后恢复操作前完整提供方清单，两个不整除的容量值 `128001/4097` 保存准确。不使用手机业务模型注入，不发送模型请求；测试服务地址为隔离的 `127.0.0.1:1`，没有网络模型服务或 Key。

最终三端及原 Host 重启组合 **95.87 秒通过**。Host 报告 `providerManagementCreatedEditedAndRemoved`、两端报告 `providerCreateRenameModelsCancelRemove` 为 true；Web无页面/控制台错误，Android仅有撤销后预期401，测试授权、两个Host、临时网关、独立测试App及adb reverse均清理。后端类型检查通过。

首轮移除超时来自联调脚本添加了原严格协议不接受的 `confirmed` 字段，中转正确拒绝；正式手机请求无此字段。夹具现使用原 `clientFrameSchema` 在发送前校验，避免将测试报文错误误判为电脑写入故障。页面选择器按实际原生表单的可访问名称匹配。上述修正不放宽生产协议或权限。

本节只覆盖**无认证自定义提供方基础管理**。账户登录、凭据写入/移除、已有认证的发现/探测、官方及内置目录覆盖、更多协议/兼容字段和真实模型请求仍需分别验收；不能据此宣称完整模型设置兼容。

### 草稿模型发现与认证边界（2026-10-05）

新版原发现器仍默认跟随跳转，指定内置路由时也仍优先返回内置目录。因此[第七项候选补丁](../../../plugin/compatibility/latest-upstream/model-discovery.mjs)复用固定发布包的原请求/解析/认证，只增加受限分支 `redirect:error/catalog:false`。原电脑发现接口保持官方行为；专用注册使用实际 `settingsNs + ':dshm-endpoint-v2'`，由[提供方桥接](../../../plugin/src/profile-providers.ts)将固定手机操作映射到唯一原实例。不存在、歧义或未安装受限注册时拒绝，不回退原接口。编译候选只修改固定新版隔离npm字节；该项另已完成两个固定源码文件的安装/恢复、全量类型及原源码HTTP验证，见[源码模型发现](#新版源码模型发现2026-10-05)，七项源码交付组合仍待完成。

另一可行方案是在DSHM独立编写HTTP发现器，但会重复维护原协议解析、认证来源和错误分类。本次选择复用原实现，以减少两套行为分叉；代价是继续维护固定补丁，并必须完成源码交付的安装/恢复验收。

[2项专项](../../../plugin/tests/latest-model-discovery.test.mjs)使用实际新版 Context、LlmRuntime、pi-ai 及本地凭据服务，真实 HTTP 验证无认证、保存认证与临时覆盖；检查原 headers 保留、内置目录捷径隔离、OpenAI/Anthropic跨源跳转的目标零请求、原电脑行为保持、无效 Key 发出前拒绝、实际在途取消、去重/名称/容量解析及卸载清理。实例映射的单项边界使用受控目录对象，不以此替代真实 Host 认证证明。

[真实 Host/网关测试](../../../backend/tests/latest-host.test.ts)另通过生产固定通道准备/执行三种认证、一次性快照重复拒绝、跳转拒绝，以及为专用测试提供方建立 Key 引用、写入虚构值、HTTP 核验正确携带并移除。读取回执不含 Key 内容，没有接触用户凭据；无认证与临时模式不写提供方配置。Host 报告 `modelProbeNoneTemporaryStoredAndRedirectRejected` 为 true，模型执行仍未验证。

[共享手机步骤](../../tests/support/latest-provider-page.mjs)在 Edge375×667与独立 MuMu App 的新增提供方表单，通过正常按钮取消确认（HTTP零请求）、实际获取目录、选中候选加入草稿和拒绝跳转。每步核对电脑完整提供方配置不变，候选显示原解析结果；之后原基础管理保存/移除回归继续通过。Android使用真实原生连接与资源载体。下面103.71秒的初轮结果只覆盖普通确认入口；原生临时 Key 窗口随后单独补验，范围见下一段。

最终三端及原 Host 重启组合 **103.71 秒通过**。两端 `modelProbeCancelReadAdoptAndRedirectRejected` 为 true；Web无组件/控制台错误，Android仅撤销后预期401。测试授权、两个Host、网关、HTTP目录端点、独立测试App及adb reverse均清理。旧插件相关发现/探测/Remote入口55项回归通过，新旧插件及后端类型检查通过；无需重新构建页面或APK，既有正式表单按能力协商启用新版入口。

[原生窗口步骤](../../tests/support/latest-native-model-probe.mjs)随后在独立测试 UID 的实际 Android 密码窗口验证取消、空 Key 拒绝与虚构有效 Key 提交。取消和空 Key 均没有新增 HTTP 请求；有效 Key 由原生桥及电脑受限发现器携带，目录结果回到手机原表单，Key 没有出现在页面正文。真实 Host 核对请求认证来源、完整提供方配置及本测试独立 `DSH_HOME/.credentials.yaml` 的字节不变；没有读取日常凭据，也没有保存临时 Key。原生错误气泡是否出现在无障碍树受系统焦点影响，测试核验窗口和输入框保持可编辑及端点零请求，不将气泡文案算作已验收。

补验最终真实 Host→网关→Web375×667及独立MuMu App，加原Host重启组合 **124.87秒通过**。Android报告 `nativeTemporaryProbeCancelInvalidExecuteAndNotPersisted` 为true，正常提供方管理与发现回归继续通过。所有测试授权、两个Host、网关、目录HTTP端点、测试App及adb reverse已清理；原生XML临时文件删除。后端类型检查、两个脚本语法检查通过。本轮仅扩充验收脚本，没有修改生产插件/App，也未重新构建APK。

此结论只证明受控 HTTP 目录和认证传输。已有自定义提供方的后续实测见下一节；第三方真实账户登录、其他目录/协议、模型实际聊天/工具执行及其他管理仍按原范围继续验收。

### 已有提供方目录、草稿地址与原生 Key（2026-10-05）

本轮沿用生产实现，没有修改插件/App或新增补丁。新版[原实例映射](../../../plugin/src/profile-providers.ts)接通[既有目录读取](../../../plugin/src/provider-model-discovery.ts)：请求只接受电脑已保存路由，不接受手机传入地址或 Key；地址和协议来自原设置，认证由原发现器解析。此入口保留原电脑目录行为；手机尚未保存的地址和协议则走上一节受限探测入口，两个入口不混用配置。

[真实 Host/网关测试](../../../backend/tests/latest-host.test.ts)验证新建的隔离自定义路由在无认证及保存认证下均获得实际HTTP目录。Web375×667及独立MuMu App从「编辑模型清单」实际获取候选、加入第二行、保存并核对原电脑模型目录；加入草稿前后完整提供方配置保持，保存后名称和不整除容量准确。随后输入未保存的另一地址，普通发现仍访问电脑保存路径，草稿探测访问新路径；两者均不保存地址，完整电脑配置保持。

Android再从该测试路由的「启用 API Key」建立独立引用，经[原生密码窗口](../../android/app/src/main/java/dev/dshmobile/validation/RemoteComputerKey.kt)写入虚构值。原目录请求和沿用电脑认证的草稿请求实际携带正确值，分别访问保存路径与草稿路径。两次明确操作移除后，页面及原Host回执均显示未配置，隔离凭据文件不再包含该测试值；再次目录读取被拒绝且端点零新增请求。Key未进入页面正文，候选模型及电脑完整配置保持；最后移除测试提供方，完整提供方清单恢复。步骤见[共享页面验收](../../tests/support/latest-provider-page.mjs)和[原生操作](../../tests/support/latest-native-model-probe.mjs)。

模型保存会更新电脑配置版本，上方设置表单的旧快照被原Host拒绝，不写 Key 引用；测试确认完整配置不变，再主动重读设置后启用。首轮脚本遗漏此重读，另一次原生按钮查找忽略Android将英文转成大写的显示行为；均属脚本修正，不放宽生产版本校验或凭据边界。

最终三端加原Host重启组合 **147.14秒通过**。Host报告 `existingProviderDiscoveryNoneAndStored`、两端 `existingDiscoverySavedAndDraftTargetsSeparated`、Android `nativeProviderKeySavedUsedAndRemoved` 为true；Web无页面/控制台错误，Android只有撤销后预期401。测试授权、两个Host、网关、HTTP目录端点、独立App、adb reverse和原生XML临时文件均清理。后端类型检查、四个页面验收脚本语法及diff检查通过。仅扩充测试，没有重新构建页面/APK；组合测试的超时预算增加到240秒，不作为性能结论。

当前范围为**受控本机HTTP、自定义路由及独立虚构Key**。官方/内置基础目录和恢复的后续实测见下一节；更多协议/兼容字段、真实第三方账户/TLS、模型聊天和工具执行仍需分别验收，不能以此次认证请求证明这些能力。

### 官方与内置模型清单、覆盖和恢复（2026-10-05）

沿用[固定模型管理通道](../../../plugin/src/provider-models.ts)及新版原设置服务。真实Host/网关先修改官方首个模型的名称，核对完整有效配置仅名称变化、所有未公开字段保留；重复使用写入快照被拒绝，恢复默认后完整配置和用户继承状态准确还原。随后[共享实际页面步骤](../../tests/support/latest-model-catalog-page.mjs)在Web375×667及独立MuMu App的「电脑设置 → 模型」修改同一名称，关闭设置后从手机聊天模型选择器看到新名称，重新打开仍保持，再恢复原默认值及无用户覆盖状态。每个保存阶段均由[原电脑接口](../../../backend/tests/latest-host.test.ts)核对完整有效配置与目录名称，凭据文件字节保持。

内置目录测试只新建原页面确认未配置的 `openai` 路由，不填写Key、不调用远程模型。原发现器提供目录；单项覆盖采用只填ID，名称和容量保持继承，不把目录默认值写成用户覆盖。两个真实页面分别添加两项覆盖、设置第二项 `128001/4097` 容量、移除第一项后核对第二项保持，恢复覆盖后用户层还原。再从原发现结果采用完整模型清单并保存，此时单项覆盖编辑被原配置阻止；恢复默认清单后原目录和覆盖入口恢复。最后移除测试路由，完整原提供方配置及用户层准确还原，目录不再含测试路由。每步确认隔离凭据字节不变、本机目录HTTP端点零新增请求。会话模型目录只公开ID和名称；容量由原配置核验，未将选择器目录当成完整模型元数据。

真实保存还暴露[共享编辑器](../../src/ui/RemoteProviderModelEditor.jsx)的提示问题：保存引发电脑推送，随后自动重读在开始时清掉成功回执。当前只让**主动操作**清除旧提示，自动重读保留本次回执；自动读取失败仍可显示错误，版本校验和写入语义保持。该共享组件覆盖官方、完整清单和单项覆盖三个入口。修复前实际官方页面等待成功提示超时，修复后相同步骤和内置各保存步骤在Web/Android通过；测试没有只验证底层服务。

最终官方发布CLI→真实网关→Web及独立Android，加原Host重启组合 **184.42秒通过**。Host `officialModelsHiddenFieldsPreservedAndDefaultsRestored`、两端 `officialAndBuiltinCatalogSavedAndRestored` 为true。普通Web及候选Web重建、独立测试APK构建安装通过，旧手机432项及原插件插槽浏览器回归通过；后端类型、脚本语法和文档/diff检查通过。Web无页面/控制台错误，Android只有撤销后的预期401。测试授权、两个Host、网关、目录HTTP端点、独立App、adb reverse与临时XML均清理，日常旧DSH及用户App未升级。

本节证明基本名称/容量编辑、两种目录语义和恢复；没有改变真实Key/地址，也没有发送模型推理。官方输入与高级字段的后续实测见下一节；第三方账户、实际模型/工具执行及18项补丁源码交付仍按完整范围继续验收。

### 模型输入、思考、模板与协议切换（2026-10-05）

本轮仅扩充实际验收脚本，沿用现有生产实现与独立测试APK。新版官方CLI、真实网关、Web375×667及独立MuMu App分别从自有设置入口完成以下操作；[原电脑设置接口](../../../backend/tests/latest-host.test.ts)逐步核对完整有效配置、用户覆盖及隔离凭据，目录HTTP端点不增加请求，没有模型推理。

- [官方/内置入口](../../tests/support/latest-model-catalog-page.mjs)：官方首模型输入改为文字，重新打开仍显示相同值，随后恢复完整默认配置及用户继承状态；内置第二模型覆盖文字与图片、明确关闭思考并关闭严格模式，移除第一项后第二项保持，再恢复整个覆盖。
- [自定义提供方实际表单](../../tests/support/latest-model-advanced-page.mjs)：设置文字与图片、`off: null / high: 'high'` 自定义思考档位；设置保存请求关闭、`max_tokens`、`chat-template`、负整数调度优先级，以及两类模板中的文字、数字、布尔、null和三种思考变量。保存后主动重读确认字段，再将思考明确关闭，最后恢复输入/思考/兼容设置的继承。
- 同一表单设置提供方默认严格模式；`openai-completions → openai-responses` 先取消确认并核对电脑不变，再确认保存、重读协议并改回原值，最后移除提供方默认兼容覆盖。每次等待实际手机保存回执，再核对电脑配置；最终移除整个隔离路由。

新版原schema会为未声明的输入和两类模板补出 `[] / {}`。原 `declaredInput` 与 `configuredCompatEntries` 明确将这些空值视为继承、无参数；验收只对这几个等价空值归一化用户层比较，其他字段仍完整比较，有效配置逐项精确核对，没有将任意空对象或无效思考档位视为继承。首轮断言把这些自动补值误算为变更，后续修正。另修正模型行重读后折叠区域重建需要重新展开、协议写入仍进行时提前读取电脑的脚本时序；未修改生产代码或放宽版本、权限与凭据保护。

最终三端与原Host重启组合 **220.63秒通过**。两端 `modelCapabilitiesTemplatesAndProtocolSwitchRestored`、`officialInputAndBuiltinCapabilitiesRestored` 均为true；原发现、原生临时/保存Key、目录覆盖、管理与撤销回归继续通过。Web无页面/控制台错误，Android只有撤销后的预期401。测试授权、两个Host、网关、目录HTTP端点、独立App、adb reverse与临时XML清理；日常DSH、用户App、Key和历史保持原位。后端类型、脚本语法、文档及diff检查通过。

本次证明上述具体字段的保存、重读、继承和两种协议选择，不证明模板已被真实推理请求采用、任意字段组合或第三方服务兼容。Anthropic与第三方账户、真实模型/工具审批、完整18项补丁源码安装/恢复及其他Remote范围仍待验证。

## 文件监听、字节读取与原文档预览（2026-10-05）

新版原 `workspaceFiles.changes` 改为监听指定路径，先发 `ready`，随后发 `change` 和嵌套的 `change.absolutePath/version/absent`；`readBytes` 把范围移入 `options.range`，原 HTTP 使用 multipart 附件，生成客户端返回 `Uint8Array`。这些结构来自固定新版发布包及同源代码，不沿用旧全工作区流或猜测二进制结构。

[网关策略](../../../backend/packages/protocol/src/remote-policy.ts)接受两版的明确有界契约，[Host适配](../../../plugin/src/workspace-file-contract.ts)再按固定版本选择：旧版拒绝目标流和新版options，新版拒绝旧全局流；自有下载器的原range只在新版转换为options。两端拒绝混用、额外字段、无界字节读取和超限窗口；路径权限仍由原Host检查。原HTTP文件读取只解包固定data字段的唯一二进制附件、最多64KiB，公网帧保持base64，[新版手机载体](../../src/remote-transport.mjs)仅对原options调用恢复Uint8Array，自有读取及旧版保持base64。Office发布完成前的一字节身份检查同步使用此版本适配；转换与预览的后续证据见下方专项。

实际打开文件暴露新版[原TextPreview](../../artifacts/latest-mobile-source/packages/client/ui-sidebar-documentpreview/src/client/TextPreview.tsx)及face新增共享Resources和三种操作插槽。手机[文档组合](../../src/remote-document-previews.jsx)等原资源服务就绪后按依赖顺序注册整组父子插槽，将同一Resources传给原face，保留原ResourceGroup、状态机及原预览器。初次捕获undefined服务、父声明晚于子注册及缺少新操作插槽的真实失败均已修复；没有缩放或改写插件内部布局，也没有安装旧文件元数据补丁。

[真实Host/网关专项](../../../backend/tests/latest-host.test.ts)验证原目标监听就绪、中文/emoji字节读取、文件变化后的版本/字节数、删除/恢复、取消及工作区外路径拒绝。[实际页面步骤](../../tests/support/latest-file-page.mjs)从手机自有聊天的插件面板打开原工作区文件树，核对预览正文和完整原元数据；原文件修改后自动刷新，删除显示原not-found，恢复重新显示，关闭预览后最后一个资源holder释放。快照检查只读取原UI已持有的资源，不增加测试订阅。原RemoteFailure的code为getter，测试跨进程序列化时显式读取；曾因此出现断言失败，不是生产失败。

真实Web375×667文件专项与原Host重启组合 **39.82秒通过**。最终真实官方CLI→网关→Web及独立MuMu APK，加原Host重启组合 **225.96秒通过**：两端`fileRefresh.released`与Host`nativeFileWatchBytesDeleteRestore`均为true；原模型高级字段、提供方、预设及动态插件步骤同时通过。证据：[Web](../../artifacts/latest-mobile-runtime/latest-file-combined-page.json)、[Android](../../artifacts/latest-mobile-runtime/latest-file-combined-android.json)、[Host](../../../plugin/artifacts/latest-runtime-check/latest-file-combined-relay.json)。Web无组件/控制台错误，Android撤销前无错误、撤销后预期401单列；设备授权、两个Host、网关、目录端点、独立App和adb reverse均清理。

候选与普通Web重新构建，独立APK离线构建并安装；旧手机 **433项**、普通插槽浏览器回归通过，新旧插件与后端类型检查通过。插件全量213项通过，最后追加畸形二进制附件数组保护后49项文件适配/Office/旧Host相关回归通过；重新构建最终候选后真实Web文件专项及原Host重启再次 **39.09秒通过**，清理完成。网关文件契约及真实WS权限13项通过。此轮文件结果不证明完整Office、相同版本去重、实际断线及更多格式；Office后续原服务核验见下一节。日常旧版DSH、用户Key/历史/绑定和App保持原位。

### Office原二进制转换（2026-10-05）

新版原`RenderedDocumentBytes`继承工作区字节契约，`officeToPdf/render`也经同一固定data路径传输二进制附件。[Office中继](../../../plugin/src/office-preview.ts)现按固定新版解包此端点，保留原PDF上限32MiB、64KiB信用分片、转换优先级、最后源文件权限/版本和引擎代次检查；普通文件读取仍限制64KiB，不开放通用render RPC。[50项相关回归](../../../plugin/tests/office-preview.test.ts)通过，其中新专项用受控HTTP载体覆盖超过文件窗的PDF、完整字节、最终核验和超32MiB拒绝；插件全量 **214项**、新旧插件及后端类型检查通过。

[真实新版CLI/网关专项](../../../backend/tests/latest-host.test.ts)用原测试样例生成专用Word文档，由实际LibreOffice服务转换并通过真实Remote Office流取得 **21,189字节PDF**；核对原源文件路径/版本、分片及完整长度、PDF签名、转换后源文件字节保持，最后检查经实际options读取及原引擎generation通过。组合原Host重启和Web文本文件回归 **44.48秒通过**，进程/授权清理。证据：[协议报告](../../../plugin/artifacts/latest-runtime-check/latest-office-protocol.json)。原转换返回缺少`Liberation Sans`字体，不能据此声称字体/版式完全一致；没有模型请求。首轮脚本将metadata帧的type送入严格数据schema而失败，随后只剥离帧类型、数据schema不放宽，并将信用帧经原clientFrameSchema校验。

共享[文件页面步骤](../../tests/support/latest-file-page.mjs)从原文件树打开同一Word文档，原Office/PDF预览产生实际canvas，关闭回到原聊天。真实CLI/网关、Web375×667及原Host重启组合 **42.37秒通过**，Web无组件/控制台错误；报告[fileRefresh.office=true](../../artifacts/latest-mobile-runtime/latest-office-page.json)，测试授权和进程清理。独立Android原入口加全部既有页面步骤及原Host重启组合 **165.81秒通过**，其[fileRefresh.office=true](../../artifacts/latest-mobile-runtime/latest-office-android.json)；撤销前无页面/控制台错误，撤销后预期401单列，测试授权、两个Host、网关、App和adb reverse清理。首轮在Office前因取消流的异步清理返回`remote_cordis_connection_expired`而未通过；断言现要求拒绝且原因属于两种原合法失效路径，并再次调用确认清理后必为`remote_cordis_connection_required`，生产连接检查未放宽。此处不以PDF传输或单格式成功替代完整六格式、附件缓存或转换中权限变化验收。

六种真实格式已在同一固定新版CLI、网关及原转换器通过：`doc/docx/xls/xlsx/ppt/pptx`均核对源文件身份、信用分片、完整PDF签名/长度及转换后原件字节。独立Android加全部既有页面步骤和原Host重启组合 **173.85秒通过**；随后自有Web375×667文件专项及原Host重启组合 **63.06秒通过**。两个页面从原工作区文件树逐一打开文档，实际PDF canvas出现，名称一致，关闭当前预览后确认canvas移除，再打开下一个。两端`fileRefresh.officeFormats`包含全部六种格式；Web无页面/控制台错误，Android撤销前无错误、撤销后预期401单列。各轮授权、Host、网关及Android临时载体清理。证据：[Android](../../artifacts/latest-mobile-runtime/latest-office-six-android.json)、[Android Host](../../../plugin/artifacts/latest-runtime-check/latest-office-six-relay.json)、[Web](../../artifacts/latest-mobile-runtime/latest-office-six-page.json)、[Web Host](../../../plugin/artifacts/latest-runtime-check/latest-office-six-page-relay.json)。

样例PDF字节数分别为docx 21,189、doc 21,230、xlsx 19,036、xls 21,924、pptx 21,437、ppt 21,448；docx/pptx报告缺少`Liberation Sans`，其余样例无缺失字体报告。此结果证明当前样例的六格式转换和实际页面显示，不代表任意复杂文档的版式/字体一致、历史附件、缓存复用、转换中权限/身份变化或断线恢复已通过。生产代码没有在六格式阶段增加补丁；仅扩展真实验收。复验时Office开关为`DSHM_LATEST_OFFICE_CHECK=1`；Web需另设`DSHM_LATEST_PAGE_CHECK=1`及`DSHM_LATEST_FILE_ONLY=1`，Android用原显式设备开关。只读取带本轮Host目录和六格式数组的报告，不能将旧产物当作新验收。

### Office历史附件与同版本缓存（2026-10-05）

[真实附件验收](../../../backend/tests/support/latest-office-attachments.ts)通过固定`remote.upload`信用流送入原二进制上传路由，读取原回执，再用原`session/prompt`将六种文件持久写入聊天。上传后尚未引用时全部拒绝转换；已有另一个会话、错误名称及错误附件ID均拒绝。拒绝路径允许原`converting`状态，禁止元数据或内容块；首轮测试把状态误判为最终结果而失败，随后按原协议读取终态，生产实现没有放宽。每个附件转换前后通过原`remote.attachment`流读取并核对完整原件字节。工作区同时放置不同内容的同名文件，历史转换仍使用原附件。真实CLI/网关、六格式工作区与附件、原Host重启组合 **54.33秒通过**；证据：[协议](../../../plugin/artifacts/latest-runtime-check/latest-office-attachments-protocol.json)。隔离环境仍无模型Key，消息持久接纳不代表模型推理通过。

自有Web375×667与独立MuMu实际从聊天的六个「查看附件」按钮逐一进入原预览。资源地址必须属于`dshm-attachment`且包含原附件ID；PDF canvas出现，名称一致，关闭后canvas移除并返回原聊天。Web及原Host重启组合 **65.29秒通过**，Android含全部既有页面步骤及重启 **183.12秒通过**，两端`officeAttachmentFormats`含全部六格式。证据：[Web](../../artifacts/latest-mobile-runtime/latest-office-attachments-page.json)、[Android](../../artifacts/latest-mobile-runtime/latest-office-attachments-android.json)、[Web Host](../../../plugin/artifacts/latest-runtime-check/latest-office-attachments-page-relay.json)、[Android Host](../../../plugin/artifacts/latest-runtime-check/latest-office-attachments-android-relay.json)。

[页面观察器](../../tests/support/latest-office-observation.mjs)只记录原载体的调用端点和测试文件名，转发原参数、回调与返回值，结束时恢复原方法；不替换授权、网络、转换器或资源状态。实际关闭再打开同一Word版本，两端转换流调用数均为1→1，`workspaceFiles/readBytes`授权核验及`officeToPdf/generation`查询均为1→2，确认原缓存复用但不复用授权判断。Web与原Host重启组合 **64.49秒通过**，独立Android及全部既有步骤和重启 **183.69秒通过**。证据：[Web缓存](../../artifacts/latest-mobile-runtime/latest-office-cache-page.json)、[Android缓存](../../artifacts/latest-mobile-runtime/latest-office-cache-android.json)、[Web Host](../../../plugin/artifacts/latest-runtime-check/latest-office-cache-page-relay.json)、[Android Host](../../../plugin/artifacts/latest-runtime-check/latest-office-cache-android-relay.json)。

各轮Web无页面/控制台错误；Android撤销前无错误、撤销后预期401单列；测试授权、两个Host、网关、独立App和adb reverse清理。沿用上一节最终候选/APK与原转换器，本轮仅扩展真实验收和后端类型检查，没有新增生产补丁。上述结果不证明源版本/转换器替换/会话变化后的缓存失效、转换中收权、在途取消、实际断线恢复、原件下载/分享或复杂字体版式已完成；这些仍是有效待验项。

### Office源文件版本改变后的缓存（2026-10-05）

[实际页面步骤](../../tests/support/latest-file-page.mjs)保持原Word缓存，先关闭预览并写入另一份有效docx，再打开原文件树中的同一文件；恢复原始字节后再次打开。每次由[原Host](../../../backend/tests/latest-host.test.ts)核对写入字节及完整stat，由原UI已有Resources核对版本，再由[只读观察器](../../tests/support/latest-office-observation.mjs)核对实际转换流元数据。观察器原样转发所有调用和回调，不替换授权、资源或转换器。

Web375×667与原Host重启组合 **68.14秒通过**；独立MuMu Android含全部既有页面步骤及原Host重启 **186.96秒通过**。两端首次读取/同版本缓存/修改/恢复对应转换流计数为 **1/1/2/3**，授权及代次查询 **1/2/3/4**，三条转换元数据的源版本分别精确匹配原Host的初始、修改及恢复版本；恢复后源字节与最初一致，版本仍为新的文件版本。六格式工作区和历史附件回归保持。证据：[Web](../../artifacts/latest-mobile-runtime/latest-office-version-page.json)、[Android](../../artifacts/latest-mobile-runtime/latest-office-version-android.json)、[Web Host](../../../plugin/artifacts/latest-runtime-check/latest-office-version-page-relay.json)、[Android Host](../../../plugin/artifacts/latest-runtime-check/latest-office-version-android-relay.json)。

进一步保持修改后的Word预览打开，再由电脑恢复原字节。原目标监听更新同一Resources元数据，原TextPreview默认自动刷新；测试核对旧canvas实际脱离DOM、新PDF canvas出现、变化提示消失，且转换流元数据对应恢复后的新版本，没有关闭再打开或直接调用刷新方法。Web375×667与原Host重启 **66.27秒通过**，独立MuMu含全部既有页面步骤及原Host重启 **189.11秒通过**；两端`openPreviewAutomaticallyRefreshed=true`。证据：[Web实时更新](../../artifacts/latest-mobile-runtime/latest-office-live-page.json)、[Android实时更新](../../artifacts/latest-mobile-runtime/latest-office-live-android.json)、[Web Host](../../../plugin/artifacts/latest-runtime-check/latest-office-live-page-relay.json)、[Android Host](../../../plugin/artifacts/latest-runtime-check/latest-office-live-android-relay.json)。

Web无页面/控制台错误；Android无页面错误，唯一控制台401来自最后的授权撤销检查。临时授权、两个Host、网关、独立App及adb reverse清理。此轮没有生产实现或APK变更，仅扩展真实验收，后端类型检查通过。本节证明关闭再打开及保持打开两种路径的源版本刷新；转换器/会话/连接变化、在途权限变化和取消、下载分享仍须分别核验。

### Office传输中的取消与源文件失效（2026-10-05）

[真实传输专项](../../../backend/tests/support/latest-office-transmission.ts)使用[分页Word样例](../../scripts/office-fixture.mjs)和新版原LibreOffice，实际生成 **1,256,492字节PDF**，大于四个64KiB信用窗口。两个并行读取各收到四个块后停止确认；经原Host往返屏障仍无第五个块或成功终态，第三个读取被原并发限制拒绝。取消两个读取后，网关返回其原`end`取消回执；此时字节未完整，不将回执算成PDF读取成功。随后实际再开启两个读取，确认两个名额释放，并完成一个完整PDF。

另一读取在等待确认时写入不同有效docx，原Host的源版本改变；放行后传完原PDF字节，但最后校验返回`remote_file_changed`，没有成功结束。删除源文件时，最后校验返回原`workspace-file/not-found`失败，同样没有成功结束；恢复原Word后完整读取可完成，原件字节一致。真实官方CLI、网关、六格式文件与附件、原Host重启组合 **61.21秒通过**，证据：[原Host报告](../../../plugin/artifacts/latest-runtime-check/latest-office-transmission-protocol.json)。首轮脚本把网关原取消回执误判为迟到结果，核对[原网关](../../../backend/packages/gateway/src/hub.ts)后修正断言；生产实现及权限检查不变。

扩展为全部Web及Android组合时曾达到300秒测试上限：Web报告已通过，Android没有完整报告，未将组合算作通过。加入只记录阶段名/耗时的检查点并结束并行源码依赖安装后，相同参数和300秒上限重新运行 **271.76秒通过**，没有延长总超时或放宽单步断言。原协议步骤约56.76秒结束，Web约130.58秒结束，Android约266.51秒结束，原Host重启及清理约271.74秒结束；首轮仅能确定组合未按时完成，不能据此认定产品故障，后续重型安装/构建与设备验收分开运行。

本轮真实CLI/网关→完整Web375×667→独立Android和原Host重启，包括传输异常、六格式文件/附件、缓存与打开时自动刷新、模型/预设/动态插件管理，报告均通过。Web无页面/控制台错误，Android无页面错误，唯一控制台401来自最后设备撤销；临时设备授权、两个Host、网关、App及adb反向端口清理。证据：[Web组合](../../artifacts/latest-mobile-runtime/latest-office-transmission-combined-page.json)、[Android组合](../../artifacts/latest-mobile-runtime/latest-office-transmission-combined-android.json)、[Host组合及阶段](../../../plugin/artifacts/latest-runtime-check/latest-office-transmission-combined-relay.json)。后端类型检查通过；生产实现、权限策略、兼容补丁及APK均未变更。本节证明真实协议中的背压、读取名额回收和慢速传输末尾源身份拒绝；尚不证明转换引擎运行中的取消、Android用户关闭预览的在途取消、设备/文件权限收回或下载分享。

### 固定新版完整源码准备（2026-10-05）

从官方标签下载完整只读源码到插件的`artifacts/latest-source-check`；[核对脚本](../../../plugin/scripts/check-latest-source.mjs)确认标签、固定提交、版本`0.2.1-alpha.1`、`pnpm@11.7.0`、14,208个Git登记文件及干净工作区，避免以手机的1,702文件子集冒充完整检出。`pnpm install --frozen-lockfile --ignore-scripts`在342个工作区完成，安装1,393个依赖包；随后只对已核对的esbuild/koffi/node-pty执行rebuild，实际运行了esbuild安装脚本。日常F盘DSH和用户配置保持原位。

官方`pnpm run build`完整通过：Host/Client TypeScript、Host/Client打包、Web产物和原完整构建记录均完成。`node scripts/check-latest-source.mjs --built`调用**原**`readClientBuildRecord`重新计算355个客户端产物的摘要并核对，同时确认CLI编译入口和源码Git干净状态；不是只检查记录文件存在。证据：[检出及构建核对](../../../plugin/artifacts/latest-runtime-check/source-checkout.json)、[完整构建输出](../../../plugin/artifacts/latest-runtime-check/latest-source-build.log)。该核对器本身不执行启动，启动证据另见下段。

[源码启动探针](../../../plugin/scripts/verify-latest-source-startup.mjs)实际通过安装内pnpm调用根`dsh`脚本，分别启动原始Web profile和加载候选插件的Web profile。每次使用独立空DSH_HOME，不继承模型Key；正常登录、原HTML首页及原`session/list`空列表均通过，候选另确认`/api/dsh-mobile`返回未配置状态且没有被禁用。结束时关闭本次pnpm及CLI子进程树，源码仓库不加引导器、不改原始文件。证据：[两种源码启动](../../../plugin/artifacts/latest-runtime-check/latest-source-startup.json)。

首轮候选探针把`--patch`放在Web应用参数之后，原CLI将其交给Web应用并拒绝；核对原`apps/cli/src/args.ts`后将launcher参数放在首个Web应用参数之前，两种启动通过。原失败保留在[参数失败报告](../../../plugin/artifacts/latest-runtime-check/latest-source-startup-argv-failure.json)，没有修改官方CLI来绕过参数规则。后续另加实验引导的第三种启动，也通过上述实际入口；身份及交付结论另见下段，不由基本启动推断。

[新版身份探针](../../../plugin/compatibility/latest-upstream/source-identity-probe.mjs)使用新版原profile解析服务、Cordis、SystemPrompt和ToolRuntime，创建独立profile中的外部ESM/CJS模块、自己的固定版本依赖及候选编译插件，实际走原工具调度。原ESM/子路径/外部ESM身份一致且工具调用成功，但CJS和原Worker bootstrap中的类/Symbol不一致；实验补充同安装源码解析后全部一致。固定版本依赖不被重写。首次探针使用旧已删除的`tools/invariant`子路径而被原exports拒绝，核对后改用公开`tools/presentation`，生产包和导出不变。证据：[完整对照](../../../plugin/artifacts/latest-runtime-check/latest-source-identity.json)、[子路径原失败](../../../plugin/artifacts/latest-runtime-check/latest-source-identity-subpath-failure.json)。

[启动安装器](../../../plugin/compatibility/source-start/install.mjs)扩展为精确两版六个输入哈希：旧版保留source-start-v1，新版为source-start-v2，不沿用旧输入或开放semver范围。新旧LF/CRLF、幂等、逐字节恢复、六个新版输入逐一变更拒绝、相邻版本及原未知脚本/载荷/目录链接拒绝共七项通过。[实际交付验证](../../../plugin/scripts/verify-latest-source-delivery.mjs)在完整**隔离检出**暂时安装两个引导载荷与根dsh命令，用实际载荷再验外部CJS/Worker/工具调度，并正常执行原pnpm候选启动；没有使用测试NODE_OPTIONS替代交付脚本。结束后恢复原package.json字节、移除两个载荷、核对Git干净，全部通过。证据：[安装启动与恢复](../../../plugin/artifacts/latest-runtime-check/latest-source-delivery.json)。日常F盘DSH没有修改；本项只证明源码启动身份引导，不证明七项新版运行补丁源码迁移或源码完整Remote已经完成。

### 新版源码运行补丁的前两项（2026-10-05）

[固定源码定义](../../../plugin/compatibility/latest-upstream/source-changes.mjs)与[安装器](../../../plugin/compatibility/latest-upstream/source-runtime.mjs)迁移待办观察、预设归档两项，共四文件。使用新版原类型补齐通知摘要/观察生命周期及归档配置，保留只读观察、审批参与者、历史恢复与新选择异步核验。首次类型检查发现候选编译归档错误缺少新版必填`available`列表，源码和编译候选同时补齐，编译记录为v3，七项运行补丁数量不变。

实际应用后原Host/Client完整TypeScript约90.36秒通过，恢复后约89.05秒通过。该轮源码单位入口因Windows`--import`不是file URL失败，未记完整组合通过；修正入口后，原源码根缺少直接依赖导致Node向上误选旧插件包，改为明确的四个原源码入口。只修测试器，没有改生产解析边界。其后只重跑原函数：源码Gateway两项、归档诊断与队列两项均通过，安装及恢复幂等、全部原字节/Git干净通过；报告明确为单位/安装范围，不冒充完整类型组合。详情和原失败见[源码运行记录](../../../plugin/compatibility/latest-upstream/source-runtime.md)。新旧安装器及编译原函数17项通过；原355个客户端构建摘要重新核对通过。源码完整Remote及其余五项源码补丁仍待验。

修正归档错误详情后的官方发布CLI→真实网关→自有Web375×667和原Host重启 **100.92秒通过**，独立Android含全部既有页面步骤及原Host重启 **155.65秒通过**。直接Remote拒绝断言核对`agent-preset/not-found`、原请求模式ID及可用模式列表；两端模型/预设/动态插件、文本预览和历史恢复保持。Web无页面/控制台错误；Android唯一控制台401来自最后授权撤销，临时设备/两个Host/网关/App/adb reverse清理。证据：[Web](../../artifacts/latest-mobile-runtime/latest-source-presets-v3-page.json)、[Web Host](../../../plugin/artifacts/latest-runtime-check/latest-source-presets-v3-page-relay.json)、[Android](../../artifacts/latest-mobile-runtime/latest-source-presets-v3-android.json)、[Android Host](../../../plugin/artifacts/latest-runtime-check/latest-source-presets-v3-android-relay.json)。两条链路仍是编译候选，不能据此称源码完整Remote通过。

### 新版源码模型发现（2026-10-05）

模型发现新增两个固定原源码变换，使已迁移范围达到三项/六个文件。专用手机注册沿用实际实例、原认证与取消，跳过内置目录捷径并拒绝跳转；原电脑查询不变。实际安装后Host/Client全量类型91.83秒、六项原源码函数1.93秒、恢复后全量类型92.59秒通过，全部原字节、Git干净及原355客户端构建摘要核验通过。模型测试使用受控真实HTTP和虚构凭据，覆盖无认证/保存/临时认证、两种协议跨源跳转拒绝、实际在途取消及卸载，不代表第三方模型推理。证据：[三项完整组合](../../../plugin/artifacts/latest-source-patches/source-verification-three-patches.json)、[源码函数输出](../../../plugin/artifacts/latest-source-patches/source-unit-three-patches.log)。其余四项及完整源码Remote仍待验。

### 新版源码客户端增量（2026-10-05）

原ClientEntries的名单激活已迁移到一个固定源码文件，当前累计四项/七文件。直接运行原源码模块系统及Loader验证不变实例保持、改变实例替换、移除/同版本重装、完整依赖图保留、非法名单和销毁边界；原电脑sync全量行为不变。四项组合的原Host/Client类型171.04秒、八项源码函数1.72秒、恢复后类型170.02秒通过，未放宽180秒单阶段上限。全部原字节/Git干净、原355客户端摘要再核验通过；六项安装器边界及四项编译模型/增量回归另通过。证据：[四项组合](../../../plugin/artifacts/latest-source-patches/source-verification-four-patches.json)、[源码函数输出](../../../plugin/artifacts/latest-source-patches/source-unit-four-patches.log)。本轮没有修改编译候选生产逻辑或重建App；前台输出、动态作用域、客户端寿命三项及完整实际pnpm Remote仍待验。

### 新版源码客户端生命周期（2026-10-05）

生命周期四个原文件与已核验固定变换输入、四份派生后源码均逐字节一致；继续复用严格变换，不放宽旧哈希。另补齐原统一转发清单和无参数目录变化事件声明，共六个新增源码文件，当前累计五项/十三文件。七项生命周期测试直接执行原源码注册表和目录函数，覆盖销毁/旧微任务/排队同步、重连同ID、目录读取合并及迟到结果/错误、原事件顺序；与前四项共十五项源码测试通过。六项安装器边界及七项编译生命周期另通过。

首轮两端合并的类型检查触及180秒限制，恢复检查亦未完成，没有记通过；旧验证器因此未保存新的失败组合，已保留[终端失败证据](../../../plugin/artifacts/latest-source-patches/source-five-combined-limit-failure.json)并修正失败报告清理。改为依次运行原Host、Client完整配置，每配置180秒：修改后89.35/109.70秒、十五项原源码1.78秒、恢复后88.77/110.32秒通过，类型覆盖与功能断言不减。十三文件原字节/Git干净、原355客户端摘要核验通过，见[五项完整组合](../../../plugin/artifacts/latest-source-patches/source-verification-five-patches.json)、[源码函数输出](../../../plugin/artifacts/latest-source-patches/source-unit-five-patches.log)。编译候选生产代码和App未重建；Host实际目录通知仍由剩余动态作用域补丁提供，前台输出及完整实际pnpm Remote也待验。

### 新版源码动态作用域（2026-10-05）

[固定TS变换](../../../plugin/compatibility/latest-upstream/source-cordis-scopes.mjs)新增原Runner及inspect注册表两个文件，累计六项/十五文件。手机连接持有的独立句柄不覆盖电脑目录，合并前校验同名契约、冻结JSON；断线和销毁拒绝迟到写入或启动。原十二个Remote装饰器/签名、生成codec、Agent参数查找、查询验证和结算保留；电脑任务脱离手机作用域后可继续。重复批准、过时拒绝/失败回执按原状态拒绝，成功定义/增加版本/移除后发出无参数目录通知。

实际安装后的完整Host/Client类型92.13/108.77秒、二十五源码测试2.43秒、恢复后类型90.57/111.04秒通过。十五文件安装恢复幂等、原字节和Git干净、原355客户端摘要核验通过。十项新增测试直接使用原TS服务、真实Connection/Gateway和同检出生成的typert，包含两个手机目录、真实Host VM与handler、解码期间断线、审批竞争及原失败回收；Agent归属和异步时序为受控夹具，不含模型推理。六项安装边界及十三项编译作用域测试另通过。证据：[六项完整组合](../../../plugin/artifacts/latest-source-patches/source-verification-six-patches.json)、[源码函数输出](../../../plugin/artifacts/latest-source-patches/source-unit-six-patches.log)、[测试入口](../../../plugin/tests/latest-cordis-scopes.test.mjs)。App未重建、日常DSH/Key/历史/绑定未改；前台输出补丁和实际pnpm完整Remote仍待验。

### 新版源码前台输出与七项组合（2026-10-05）

[七文件TS变换](../../../plugin/compatibility/latest-upstream/source-foreground.mjs)迁移有界非消费字节读者和原工具输出旁路，累计七项/二十二文件。stderr原故障控制消费、原进程结算/清理及只读权限保持；旧provider缺少字节方法时不按字符串偏移回退。原工具包薄转导出已导入的scopeTarget，不新增第三方依赖或修改原scope语义。

完整组合通过：修改后Host106.99/Client113.45秒，三十三项原源码测试14.56秒，恢复后Host105.92/Client111.07秒。二十二文件安装恢复幂等、原字节/Git干净和原355客户端摘要核验通过。八项新增测试实际走原Collector、工具与执行器，真实PowerShell双通道、停止前输出保留、原Windows只读沙箱UTF-8及写入拒绝通过；Bash时序和provider故障仍为受控夹具，不含模型推理。源码33项单位复验及编译输出/安装边界14项另通过。证据：[七项完整组合](../../../plugin/artifacts/latest-source-patches/source-verification-seven-patches.json)、[源码输出](../../../plugin/artifacts/latest-source-patches/source-unit-seven-patches.log)、[源码测试](../../../plugin/tests/latest-command-output.test.mjs)。

[实际源码Remote入口](../../../plugin/scripts/verify-latest-source-remote.mjs)已编写：安装完整源码及引导、原完整构建、pnpm启动真实网关验收、停止隔离进程树、逐字节恢复并重建原客户端；实际结果继续核验，不能以33项函数通过替代。编译生产补丁和App未变更，日常DSH/Key/历史/绑定保持原位。

## 待完成

最新完整源码构建在正常默认堆通过，实际安装引导下33函数与模块身份通过；实际pnpm Remote首轮在预设故障回滚处失败，最终原字节和355客户端产物均精确恢复。已确认插件相邻npm加载器误用，候选改为当前profile与原Loader的ESM入口；最小Host场景、47项相关回归与新增app-boot身份断言通过。修复后完整构建292.27秒、33函数、安装身份、实际pnpm协议（含Office/传输）及自有Web均通过，但Android触及组合300秒上限，整轮未通过。原文件/根脚本和355客户端产物恢复，原重建289.41秒通过。已修复超时后的测试资源清理，两项实际时限回归通过；新增Android阶段记录，按同断言和上限单独重跑Android。证据与失败归档统一进入[源码记录](../../../plugin/compatibility/latest-upstream/source-runtime.md)，不把类型或模块身份通过当作整个新版兼容完成。

单独Android/Office/传输的源码组合现已通过：默认堆完整构建297.43秒、33项源码函数14.73秒、安装模块身份4.99秒、实际pnpm/网关/独立Android及原Host重启248.92秒，保持300秒上限。全部既有模式/模型/插件/文件步骤通过，Android156.57秒完成撤销，六格式工作区及历史附件、缓存/源版本变化/实时刷新和释放均核验；撤销前无错误，撤销后只有预期401。源码二十二文件/根脚本逐字节恢复，原完整构建293.68秒、355客户端原摘要和Git干净通过。测试Host、UID、反向端口和临时授权已清理，旧插件214项及新版类型回归通过。见[Android报告](../../artifacts/latest-mobile-runtime/latest-source-seven-android.json)和[固定七项整体报告](../../../plugin/artifacts/latest-runtime-check/latest-source-seven-remote.json)。Web由上一轮同载荷证据覆盖，其整体超时保留，不能合称一次Web+Android组合成功；实际模型执行和其他剩余验收仍待完成。

18 项电脑补丁按[逐项矩阵](../../../plugin/compatibility/latest-upstream/patch-matrix.md)迁移与实测，不能照搬旧哈希或根据包版本直接宣称移除。仍需真实模型与工具审批/提问、前后台输出、旁栏/并发预览在途切换会话、转换引擎运行中取消、其他文件权限/操作系统及附件引用在途变化与下载分享及更多文件格式/更广网络恢复/去重、动态插件更广双客户端并发与重连、完整管理，最后验证新版交付安装/恢复并回归旧版。实际Windows ReadData权限收回后的手机失败/重试、原DACL/字节恢复与容量释放已在发布及源码入口通过。Office手机服务变化、预览关闭、连接恢复、设备收权、主聊天在途切换及实际Windows ReadData权限收回后的Android失败/重试、原DACL与字节恢复、实际PDF正文和容量释放已在发布与源码入口通过。普通会话切换的缓存/实际正文/附件归属，在发布和实际源码入口均通过，见各专项；不代替其他有效标准。现有旧版交付维持原支持范围。

### Android Office服务变化后的缓存（2026-10-05）

发布CLI→真实网关→独立MuMu App及原Host重启组合260.33秒通过。原服务卸载后再次打开旧缓存，手机显示原定义失效错误且没有PDF画布；重新启用后点击原“重试”，实际读取新generation的转换流，源文件完整元数据保持。随后再次打开同一新代次缓存仍核验授权和服务代次。实际转换流计数3/3/4/4、授权4/4/5/6、代次查询4/5/6/7；[Android报告](../../artifacts/latest-mobile-runtime/latest-office-cache-npm-android.json)三项serviceLifetime标记全部为true。

本专项使用固定`latestofficetest`独立UID和构建目录，保留等待真实Key的`latesttest`数据/绑定/进程与16901反向端口。原页面、原缓存与转换器没有替换；[完整规则、失败记录及复验命令](../../../plugin/compatibility/latest-upstream/office-lifetime.md#实际-android-缓存与重试)包含真实Host/清理依据。

实际源码`pnpm dsh web`同范围也通过，外层relay268.03秒、清理阶段265.14秒；[源码Android](../../artifacts/latest-mobile-runtime/latest-office-cache-source-android.json)三项serviceLifetime标记及计数与发布一致，六格式工作区/历史附件及撤销清理保持。原十一项/28文件完整构建441.91秒、原回归/模块身份与原完整构建恢复291.44秒通过；28源码/根脚本/启动载荷字节、355原资源摘要、Git干净和拥有Host退出核验。完整[源码组合与清理依据](../../../plugin/compatibility/latest-upstream/office-lifetime.md#实际-android-缓存与重试)单独归档。本轮没有Web或大PDF信用窗口专项；转换引擎运行中取消、预览关闭的在途取消及会话/连接变化仍待验。

测试后从原Launcher恢复保留的模型验收App至原聊天页，`--verify-open`核对原标题、输入框与无iframe通过；原聊天/绑定保持，没有新建会话、重置App或再次配对，真实推理仍待验证。

### Android Office预览关闭与显式重连（2026-10-05）

发布CLI实际Android/网关/原Host重启组合245.53秒通过。原PDF传输被四块信用窗口暂停时，从手机原菜单关闭预览，原请求取消一次并移除；另一个真实读取可使用释放的Host名额。同一文件重新打开建立新流并显示原PDF画布，源文件保持。通过原“断开连接／重新连接”按钮，源文件/转换代次不变时仍丢弃手机旧缓存，重新授权并读取；转换流4→5、授权6→7、代次查询14→15。六格式、历史附件、服务变化及旧功能回归保持。

使用固定`latestofficetest`，测试授权、Host和本次端口清理，等待Key的模型验收App数据/进程与16901端口保持。仅延迟真实信用确认，不替换授权、字节或缓存；源码运行前保持原300秒/外层360秒上限，两种实际运行均在原时限内完成。原转换已经完成，不能把这个结果当作转换引擎运行中取消；显式重连不替代非主动断线自动恢复或会话切换。[详细规则、复验命令与报告](../../../plugin/compatibility/latest-upstream/office-lifetime.md#实际-android-关闭预览与显式重连)保存实际代码来源。

源码`pnpm dsh web`同范围293.01秒通过（外层relay295.62秒），四项取消/容量/重新打开及重连标记和计数与发布一致。十一项/28文件原完整构建319.74秒、原函数/取消/客户端/实际pnpm/operations及模块身份通过；恢复原完整构建319.86秒、原文件/根脚本/引导字节、355资源摘要及Git干净核验，拥有Host退出。模型验收App返回列表后，原准备器`--verify-open`先超时；新增严格`--restore`仅通过原导航打开已记录的空会话，随后核对原标题/输入框/无iframe和截图通过。原记录仍两条空会话、零轮次，未清数据或发送消息；故障原因未确认，不把测试恢复助手当作产品自动恢复已修复，原观察与代码见上述详细报告。
