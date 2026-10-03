# 历史快照说明

本文件保存2026-10-03整理前的验收表。包含当时判断及之后被替代的待办，不作为现行任务清单；请从[当前验收表](./completion-audit.md)继续工作。原记录与证据保留如下。

# Remote 收尾验收表

- 状态：未完成；用于选择下一项工作，不是交付通过证明。
- 维护角色：项目协作 Agent；核验日期：2026-09-27。
- 需求来源：[已确认架构与完整编号](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md)、[正式接入要求](./README.md)。详细历史证据保留在[当前矩阵](./remote-current.md#完成矩阵)，本表不替代或缩减原范围。
- 本轮方法：核对生产入口、兼容目录、实际 JSON 报告的检查字段和失败信息。没有重新运行历史 Android 用例；旧证据只支持其实际版本和断言，不直接证明新 APK 的所有功能。

## 明确的功能缺口与下一步

R14/A03 [设置草稿断线保留](./model-settings-compatibility.md#临时断线保留设置草稿2026-10-03)已修复并通过新版 MuMu 实际网关停止/恢复；数值和地址确认草稿保留、离线不可操作、重读电脑原值及收权通过。插件自有草稿与离线焦点另有页面回归，不外推整个Host重建或任意插件生命周期。

R14 [草稿模型探测收权](./model-settings-compatibility.md#草稿探测收权与设置入口提示2026-10-03)已通过新版 MuMu 实际请求取消、重新连接拒绝及恢复重试；未授权设置窗口空白已修复，管理权限收回。原模型页面现由手机标准插槽组合承接，执行桌面整页 apply 不再是当前目标；下方历史“等待通用credentials”不是新增开发任务。

A04 实际网关中断后的后台独立通知连接已自动恢复；用户手动返回 Remote 后在线、无 alert，见[当前连接证据](./notifications-current.md#后台独立通知连接恢复2026-10-03)。先前返回前台命令受阻已不再是当前阻塞，Host 队列溢出的 Android 整链路仍待验。

A05 MuMu 正式 Remote 的真实 nihao→“你好”候选提交及非零软键盘避让已通过，见[当前输入证据](./appearance-current.md#中文候选输入与键盘避让2026-10-03)。临时输入法已卸载、原搜狗恢复、空草稿及原授权保留。该输入法以 beforeinput 提交候选，没有网页 composition 事件；不将其当作内联组词已通过。另已通过[TalkBack 模型入口焦点与双击](./appearance-current.md#talkback-实际手势与清理2026-10-03)，实际朗读内容及完整流程仍未验收。

A04 [进程结束后不接收新提醒](./notifications-current.md#进程结束后不接收新提醒2026-10-02)补验：实际 force-stop 并确认 PID 消失后才释放电脑响应；两秒观察无唤醒/新通知，正式重新打开后读取结果且不补发历史通知。首轮 am kill 未生效及清理失败保留，不冒充自然系统回收；测试资源和管理权限已清理。

A04 三种结束原因的指定链路均已有实际证据：HTTP400失败、HTTP流length上限、原pre-step拒绝受阻。最后一项见[原结算和系统通知](./notifications-current.md#受阻的实际通知链路2026-10-02)，不再沿用下方较早的 blocked 待验说明。临时插件卸载、配置/Key清理、管理收回；不将受控输入的链路验收扩大成所有通知异常已完成。

A04 输出上限已通过真实 HTTP 流→原适配器/DSH→网关→系统通知→点击正确会话，并保留部分回复，见[通知专项与报告](./notifications-current.md#http失败的实际通知链路2026-10-02)。受控端点返回 length，不是外部模型真实耗尽预算；不再把该生产链路列为未验，blocked 仍待验。

A04 已补[上游 HTTP 400→DSH真实失败结算→系统通知→点击测试会话](./notifications-current.md#http失败的实际通知链路2026-10-02)。原生配置的独立测试 Key 确实用于本机请求；Key/提供方清理、会话归档、原草稿保持及管理收权通过。该错误类型不再列为未验，但 blocked/max-tokens 的真实 Host 结算仍不能用原生受控帧测试代替。

A04 三种失败原因的生产解析器→真实 Android 系统通知已补验，包含摘要区分、去重、恢复时间与分类关闭抑制，见[原生投递专项](./notifications-current.md#失败原因的系统投递检查2026-10-02)。使用独立 UID 和受控事件，不替代真实 Host 结算的端到端证据；日常绑定/权限未改，测试通知已清理。

### 当前 APK 的服务重启恢复（2026-10-02）

本次实际运行[正式 Android 驱动](../../scripts/verify-remote-carrier-recovery-android.mjs)，依次停止并按原参数重启网关和 DSH。两条链路均先出现离线状态，随后无需点击重连自动恢复原插件面板；回到专用聊天后标题与原草稿保持，页面错误和失败资源均为空，见[当前报告](../../artifacts/remote-current-service-recovery-connected.json)。未发送聊天或修改电脑设置，设备仍 active、management=false。服务已恢复：网关 PID28132、DSH PID48684（仅为本轮记录，后续操作须重新核验）。

首轮 App 原本停在主动断开页面，驱动等待聊天标题超时，未执行服务停止；[失败记录](../../artifacts/remote-current-service-recovery.json)保留。通过正式“重新连接”入口进入专用聊天后重跑成功。该结果证明当前安装版本的两种服务重启恢复，不等同初次配对、永久撤销或全部并发异常通过。

2026-10-02模型入口归属已固定为手机组合：原slots不允许重复注册，等待桌面apply active后交接会有冲突。现策略保留原模块但不执行apply，手机固定持有标准模型页；策略/导航/引导/插槽及新版MuMu探测生命周期通过，见[决策与证据](./model-settings-compatibility.md#模型组合注册审查2026-10-02)。下方动态apply交接计划已被替代，不作为额外完成门槛；继续按实际对外功能核对兼容，不把mobile状态当完整Remote通过。

2026-10-02标准模型页注册缺口已修复：settings.section/models与order10可枚举，导航统一插槽呈现。页面注册/引导/扩展回归、构建和新版MuMu实际模型操作清理通过，见[组合修复证据](./model-settings-compatibility.md#模型组合注册审查2026-10-02)。下一步检查原apply状态交接与完整组合，不再把下方历史“无注册条目”当现状。

2026-10-02整体组合审查发现明确注册缺口：手机模型页目前由RemoteSettings硬编码呈现，没有原 `settings.section/models` 条目，插件枚举与标准插槽呈现未满足。两条引导、provider-card/footer已有对应实现。见[源码对照与下一步验收](./model-settings-compatibility.md#模型组合注册审查2026-10-02)。下一步补标准注册与统一呈现，不通过修改policy状态假装整包兼容。

2026-10-02草稿模型探测已由0.1.73实际部署，新增无认证/临时Key、已有提供方stored认证、原生桥拒绝、302拒绝与重试、关闭设置取消真实在途请求及重新进入均通过MuMu，见[当前实现与限定证据](./model-settings-compatibility.md#草稿模型发现的认证与跳转基线2026-10-02)。测试Key/提供方已清理、管理授权收回。下文“草稿探测缺失”是历史状态，不能继续作为未实现项；剩余为原models整体组合契约核对与尚未实际覆盖的连接/权限变化边界，不将关闭页面等同网络断线。

2026-10-02原模型页源码对照已将“整包兼容”具体化：[创建前结构化模型行、未保存地址/协议/Key的模型发现、候选搜索及批量选择](./model-settings-compatibility.md#原模型页与手机组合的具体差异2026-10-02)。结构化创建现已在0.1.72与新版MuMu通过真实创建/电脑读回，测试路由与权限清理，见[专项](./model-settings-compatibility.md#创建前结构化模型行2026-10-020172)。候选搜索/批量选择也已通过两个正式Android入口，见[候选专项](./model-settings-compatibility.md#模型候选搜索与批量选择2026-10-02)。剩余草稿探测继续；不得以已保存路由发现代替草稿入口。原发现器会自动带入已保存路由headers/凭据，不能直接转发任意草稿地址。

2026-10-02源码对照发现新增提供方草稿未覆盖原卡片独立生命周期，已复现并修复。完整页面回归、构建/lint和新版MuMu连续创建、切换保留、取消、移除及原聊天保留通过；临时路由与管理授权已清理，见[实际范围](./provider-directory-current.md#新增与已有提供方之间保留草稿2026-10-02)。完整models整包兼容保持未完成。

2026-10-02核对扫码返回的系统栏疑点：实际普通/Remote冷启动、取消返回和成功识别返回的焦点窗口均使用正确浅色页面标志，取消返回截图可读且草稿/页面保持。见[证据与限定范围](./appearance-current.md#相机返回后的系统栏核验2026-10-02)。未复现持续错误，未修改产品代码；不再将先前单帧疑点作为确认的产品缺陷。localhost带宽讨论仍为建议暂缓，尚未收到范围确认；原models整包兼容仍需完成。

2026-10-02 17:22:53Z相机实际识别已通过：标准API36.1独立包经原系统授权及virtualscene帧扫码，返回规范链接且不自动领取。此前失败是相机尚未到海报房间及二维码被裁剪，官方场景宏和测试海报留白修正后通过，见[实际证据](./camera-permission-current.md#虚拟相机实际识别通过2026-10-02)。测试权限撤销、模拟器关闭、正常APK产物恢复；不等同物理摄像头测试。下文先前未验说明由此替代。

2026-10-02尝试补验相机识别：标准API36.1独立包实际授权、原相机扫码界面可用，但虚拟场景未呈现二维码，45秒识别超时。未修改产品识别逻辑或伪造结果；包强停/相机权限撤销、模拟器关闭、正常APK产物恢复，见[证据和下次前提](./camera-permission-current.md#虚拟相机场景尝试2026-10-02识别未通过)。R01识别仍待验，不能据命令OK标通过。

2026-10-02补齐其他提供方表单的重读失败保护：先复现表单消失，再修正为保留草稿并阻止失效快照提交。专项、完整页面和构建/lint通过；新APK实际MuMu双提供方切换及本地校验保留通过，测试提供方移除、管理收回。实际Host读故障未注入，详见[范围](./provider-directory-current.md#提供方表单重读失败保留草稿2026-10-02)。原models整包兼容仍未完成。

2026-10-02修复提供方卡片扩展因电脑推送而丢草稿：回归先复现，现保留同连接插件实例并在核验期间隐藏旧owner。专项、完整页面和构建通过，新APK真实MuMu官方卡片验证Host受控失效通知后实例及输入保持；测试插件卸载、管理权限收回。读取失败/重试为页面证据，其他卡片入口本次未逐个Android实测，见[完整边界](./model-settings-compatibility.md#提供方卡片刷新保留插件草稿2026-10-02)。原models整包仍未完成。

2026-10-02首次引导原生保存已通过实际Android和Host凭据状态核对：保存后引导结束、草稿保持，原配置恢复、独立测试凭据删除、插件卸载、管理权限收回。使用无效测试值且未调用模型，只证明存储链路，不证明外部API鉴权。见[具体证据](./model-settings-compatibility.md#首次引导保存凭据的android验证2026-10-02)。原models整包契约仍未完成。

2026-10-02补齐Android独立插件指定models目标：真实安装测试插件→手机引导openSection('models')→DSHM自有模型表单→返回草稿保持通过，无页面错误；测试插件卸载、入口移除验证通过，管理权限收回，未改电脑配置/Key。见[实际证据](./model-settings-compatibility.md#android插件跳转模型设置2026-10-02)。

2026-10-02补齐基础设置重读失败的草稿保护：页面回归先复现，保存失败后再读取失败现仍显示原草稿并禁止失效快照提交。专项、完整页面和设置服务检查通过，新APK正式MuMu正常入口/无效输入/修正/原值读取通过，管理权限收回；Android真实Host读失败未注入，见[明确验证边界](./scalar-settings-sync-current.md#保存失败后的草稿可见性2026-10-02)。

2026-10-02电脑基础设置保存失败会隐藏草稿的问题已修复：本地校验失败允许修正，失效快照保留表单并要求重读。专项与完整页面回归通过，正式MuMu本地无效输入、修正可提交及原值读取通过，管理权限已收回；真实Host冲突未在本轮注入，见[范围和证据](./scalar-settings-sync-current.md#保存失败后的草稿可见性2026-10-02)。原models整包仍未完成。

2026-10-02标准API36.1真实发送发现WebView零偏移时区被Host拒绝，现于主/子会话共用边界规范为UTC；419项检查、构建/lint通过。实际系统授权→消息由另一手机确认→后台完成通知→点击正确回复→撤销并移除界面全部通过，见[证据和失败保留](./notifications-current.md#标准android发送时区与通知投递2026-10-02)。不代表完整A04或原Remote范围完成，localhost仍待定。

2026-10-02当前全套客户端检查417项通过。修正前416项中的一条设置边界断言仍把已限定开放的Agent预设`settings/update`当作完全禁止；现改为同时核验管理清单、两字段范围与通用模型/凭据拒绝，生产权限未改。见[实际失败、修正及覆盖范围](./model-settings-compatibility.md#当前设置边界的全套回归2026-10-02)。这不代替Android实测，也不关闭原models整包兼容缺口。

A05系统栏浅色图标不可读已修复：[共享原生主题同步](./appearance-current.md#系统栏图标与手机主题2026-10-01)在标准Android普通/Remote两入口深浅色四项实际通过，最初System UI遮挡证据保留，无遮挡重验通过。新版MuMu已安装并完成真实Remote目录读取，管理权限false；不将该专项扩大为中文IME、读屏或完整A05已完成。

R14模型提供方切换丢草稿已修复：新增回归先复现，随后专项及完整页面回归通过。15:21新版MuMu通过正式入口创建两个无Key专用路由，各自未提交名称在切换后保持，关闭目录释放；测试路由实际移除、原聊天草稿保持、管理权限收回。见[范围与证据](./provider-directory-current.md#切换提供方保留编辑草稿2026-10-01)，不扩大为跨进程持久化或原设置整包完成。

15:23实际保存另通过[独立专项](../../artifacts/provider-switch-save-android.json)：保存B不重置隐藏A草稿，关闭重读确认只有B写入电脑；两测试路由移除、原聊天保持、管理权限收回。未修改生产代码或再次安装APK，不把只编辑验证当作实际保存证据。

A06草稿事务失败缓存已修复：原实现提前发布未提交值，回归先失败后通过；101项草稿/Remote模型检查通过。14:50新版Android受控中止真实存储事务后提示失败、保留已提交数据，重试及迁移/新值优先/键盘删除/归档通过，见[证据与故障注入边界](./draft-migration-current.md#保存失败时的缓存修复2026-10-01)。自动fill清空两次失败保留，不以最终键盘路径通过掩盖差异。

R03于2026-10-01复核报告字段并补齐具体证据引用。[当前Android驱动](../../scripts/verify-current-search-android.mjs)14:42只读通过标题搜索、工作区范围、归档筛选和原聊天编辑器草稿保持。首轮误以为正文搜索开启而等待摘要超时，保留[发现报告](../../artifacts/current-search-disabled-discovery.json)；当前UI明确提示仅搜索标题，未改电脑配置，不能将标题验证当作正文通过。产品代码/APK未改。localhost是否移后续版本已询问用户，未答复前仍待定。

A06旧localStorage纯文字草稿→当前IndexedDB已通过正式Android入口：中文/多行/表情恢复、旧值清理、新记录不被迟到旧值覆盖、测试草稿删除/聊天归档及原草稿保留，见[具体版本格式与边界](./draft-migration-current.md)。驱动直接准备已确认旧格式，未安装旧APK；不能将此专项扩大为全部历史升级组合。初始空会话导航和编辑器表示断言失败均保留记录，修正驱动后14:31完整通过，生产代码未改。

R08内部工具原样抛出取消reason已修复并实际验证：14:19正式手机内外stopped、嵌套层级、重入历史和真实续聊通过；14:20真实文件缺失仍内外error、重入和续聊通过。电脑增量固定基线补丁已安装，127项回归及两套各3项安装检查通过。正式手机新投影原本传递error，上一轮将旧投影遗漏视为本入口问题的判断已纠正，APK未改。临时插件卸载、测试聊天归档、原草稿保留、管理权限false，见[当前证据](./ptc-runtime-current.md#内部工具停止修复后实际验证2026-10-01)。下方首轮失败保留为历史，不能据本专项声称全部Remote完成。

R08内部工具停止已在14:09真实Android复现未通过：电脑工具收到取消，但内部持久结果缺少取消标记，手机外层stopped、内层error；原内部工具投影另有遗漏error字段。外层取消和部分输出、后续真实续聊通过，专用会话归档/插件卸载/原草稿保留。需修复原registry取消reason分类及手机投影后重验，不能将本次当作停止专项完成，见[具体证据与修复边界](./ptc-runtime-current.md#内部工具停止真实失败已复现2026-10-01)。localhost网页转发仍为待定，带宽成本讨论不等同用户已取消范围。

R08真实自动审核拒绝已于14:01 UTC完成受控请求验收：原审核模型medium/deny、工具体未执行、测试文件未变；正式Android显示专用中文拒绝并成功续聊，测试聊天归档、插件/文件清理、设备无管理权限。首轮夹具漏结构化error导致通用英文提示的证据保留，修正后重新审核。见[具体边界](./auto-review-current.md)：请求由夹具提供，审核真实，不冒充聊天模型主动调用。PTC内部工具取消竞争等剩余项继续。

R08自定义模式子任务继承已于13:51 UTC通过真实模型与Android：原one-shot driver创建子任务、继承专用工具、真实调用生成随机值并返回手机；header/composition及只读沙箱/禁止提权事件核对一致。首次夹具权限名称误判保留，修正后显式重试通过。测试聊天归档、临时启动补丁移除，见[具体范围](./custom-agent-runtime-current.md)。此项不再作为未验缺口；真实自动审核拒绝、PTC内部工具取消竞争等原明确项仍保留。

R14关闭模式选择后新建已于13:42 UTC通过正式Android核验：原DSH此时回到部署默认standard，而非保存的minimal；手机与Host一致，模式选择和创造入口禁用，已有聊天投影/草稿保持。首次错误预期的报告保留，两次测试空会话均归档，设置与权限恢复。见[生效默认规则和证据](./model-settings-compatibility.md)。本项已验证，不能继续作为缺口；完整Remote仍按下表逐项核验。

R14创造模式入口及设置页归档恢复已于13:36–13:38 UTC在正式Android验证：本次新建的测试空会话经原插件入口切换cordis，设置窗口关闭、手机显示创造模式；归档后在原设置页搜索并恢复成功。会话已重新归档、草稿保持、观察插件卸载，管理权限收回。关闭模式选择后新建等边界及完整矩阵仍保留，见[依据](./model-settings-compatibility.md)。下方Creator/归档待验描述为历史状态。

R14默认预设与允许切换模式的固定两字段写入已在0.1.71接入。13:25 UTC补验正式Android新建会话，电脑原投影与手机均采用临时默认minimal；该测试空会话已归档，原设置继承与聊天草稿恢复，观察插件卸载，13:26管理权限收回并验证拒绝。Creator导航和设置页归档操作仍待验，见[当前证据](./model-settings-compatibility.md)。

R14预设查看/复制/路径展示/删除已在0.1.70真实Android通过，复制后的自动目录错误已修复；副本删除、权限收回及拒绝检查通过，见[当前证据](./model-settings-compatibility.md)。仍需接入默认预设与模式开关，核验创作导航、归档操作。下方0.1.69目录错误为历史状态。

R14预设管理0.1.69已部署，实际查看/复制/删除和清理通过，原生dialog阻挡插件portal已修复并经Android复验。**复制整体仍未通过**：原插件自动打开新副本目录时被settings/openAgentPresetDirectory拒绝，实际截图有业务错误，旧报告pageerror为空不能证明无错误。下一步处理目录承接并执行新增可见alert断言；默认预设、模式开关及归档范围保留。

R14真实预设管理发现缺口：列表显示但查看被remote_operation_denied拒绝。read/copy/deletePreset已按管理权限接入代码、网关与Host测试通过，尚未部署或完成Android复制/删除。默认预设/模式开关/目录操作仍待处理，见[当前源码与验证边界](./model-settings-compatibility.md)。本次未创建副本，临时权限已收回。

R14首次模型引导的缺Key路径已于12:52 UTC经真实Host配置与Android验证：提示、原生窗口取消、稍后、重新进入、恢复配置后自动完成及草稿保持。配置引用和继承状态恢复、测试插件卸载、临时权限收回。详见[模型引导证据](./model-settings-compatibility.md)。下方早期“缺少Key真实环境未验证”已被本结果替代；未输入或保存新Key，不扩大为新Key保存已验。预设/归档等完整设置能力继续验收。

R14内置welcome-notice已实际验证。deepseek-official现已接入[只读就绪投影与原生Key入口](./model-settings-compatibility.md)，插件0.1.68、网关和APK已更新；12:45 UTC真实Android通过已有可用提供方自动跳过，草稿保持。缺少Key的真实电脑环境尚未验证，相关取消/稍后/事件更新只通过隔离页面测试；管理权限已收回，原models整体未完成。下方早期“仍待接入”记录由本段当前状态替代。

R13/R14通用设置引导已接入：[settings.onboarding协调与真实Android证据](./model-settings-compatibility.md)。12:23–12:24 UTC独立电脑插件经实际通道通过排序、自动跳过、root作用域、跳转自有设置、完成和卸载，原草稿保留、管理收权。原模型包的welcome-notice随后已接入，deepseek-official仍是具体缺口；通用机制通过不代表完整原模型引导通过。

R14外观入口已修复：[原General主题按钮无效的根因与修复](./model-settings-compatibility.md)。现打开手机权威外观设置，12:15 UTC新版MuMu通过冷启动导航、实际Remote入口、主题/字号同步、重复打开和页面/草稿保留；原偏好恢复、管理权限收回。原预设/归档页操作和onboarding仍未完成。

R13/R14增量：[手机设置页导航](./model-settings-compatibility.md)已安装新版APK，独立真实插件通过root作用域/切换保留/缩放/关闭/卸载与收权；页面测试另覆盖失效回调。原General外观已修复，预设/归档页面内部具体功能待验；原模型onboarding仍待接入。

R13/R14于2026-10-02重新核对[原设置导航与引导契约](./model-settings-compatibility.md)：手机组合及两步引导已经实现，导航/模型引导页面回归重跑通过；Android独立插件导航（包括models目标）、已配置跳过、缺Key取消/稍后/恢复和独立凭据保存已有证据。有效Key外部鉴权及原models整包契约仍未完成。原ProviderEditor的unknown分支本身仅提示不可编辑，不把无限schema编辑误列为原插件现有能力；完整插件目标不变。

R14增量：[模型清单同步](./model-settings-compatibility.md)已在新版MuMu官方清单、提供方清单、内置覆盖三个实际入口通过自动刷新/草稿保护/手动核对；配置、测试插件与权限已恢复。原模型整包仍未完成。

R14增量：[电脑基础设置实时同步](./scalar-settings-sync-current.md)通过页面回归及新版MuMu正式入口。电脑修改自动更新，手机草稿保留并阻止旧值保存，原设置继承和权限已恢复；不能替代原模型设置整页兼容。

R13/R14核验：[原模型设置完整调用面](./model-settings-compatibility.md)已明确为八项接口及原页密码输入差异，已修复部分接口误启动。正常手机清单与草稿通过；原整页仍未接入，不因该修复关闭兼容缺口。

R08增量：[PTC停止分类修复](./ptc-runtime-current.md#ptc停止分类修复2026-10-01)已安装并实际验证纯等待程序取消、部分输出保留、手机中文停止与续聊；补丁后真实文件缺失失败仍保留内外error，历史重入及续聊通过，原失败报告保留。内部工具取消竞争和其他明确范围仍待核验，不以单程序通过替代整个R08。

| 顺序 | 缺口 | 当前事实与下一步 |
| --- | --- | --- |
| 已修复，历史清理待核查 | R04 新建后的快速连续操作 | [实际离线复现与修复](./new-chat-connection-current.md)：连接未恢复时按钮仍可点，原模型拒绝创建，页面保留旧聊天。三个新建入口现随连接禁用，处理中不能打开菜单；新版MuMu断线、恢复后新建并立即改名目标正确，测试空聊天已归档。首次定时测试是否留下额外空会话仍缺请求证据。 |
| 已补齐 | A06 正式问题诊断入口 | [新正式入口](./diagnostics-current.md)在普通设置与 Remote 电脑连接菜单提供查看、刷新、复制，按白名单排除身份/地址/聊天/Key。新版 MuMu 三入口实际通过；原生版本和当前连接状态真实，复制不自动发送。旧 remote-diagnostics 仍仅为技术验证页。 |
| 2 | R13/R14 设置与插件边界 | 原四类插件配置、footer、provider-card及设置分页已有手机入口和专项证据。[模型设置当前组合](./model-settings-compatibility.md)已经注册标准models插槽、两步引导、结构化编辑和草稿探测，避免执行桌面整页apply；不开放通用credentials/settings绕过边界。剩余具体生命周期和反馈验收按对应文档处理，任意第三方依赖不能由固定表单推断兼容。 |
| 待定 | R12 电脑 localhost 网站预览 | 尚未实现。用户质疑带宽与必要性；建议暂缓，但没有确认移出首版。保持待定，不能用文件 HTML 预览替代，也不自动开始公网部署。 |

## 逐项核对

“已有证据”表示列出的具体行为已有依据，不代表整个编号完成。完成判断还须覆盖原功能定义及下列明确未验项；历史记录中“所有异常”“任意第三方”这类笼统表述不自动增加无限测试组合，但原有具体承诺不能删除。

| 编号 | 已有实现与可复查证据 | 仍需处理或明确验证边界 |
| --- | --- | --- |
| R01 | [真实批准后自有页面](../../artifacts/remote-pair-valid-connected-android.json)、[撤销与重连拒绝](../../artifacts/remote-pair-valid-revoked-android.json)；[二维码图片识别](../../artifacts/remote-pair-scan-android.json)；[标准Android系统相机拒绝](../../artifacts/camera-denial-standard-android.json)；[虚拟相机实际识别](../../artifacts/camera-room-android.json) | API36.1原系统授权及摄像头帧识别已通过，返回链接后未自动领取；拒绝保留输入与替代入口也已有证据。见[验证边界](./camera-permission-current.md)。不冒充物理摄像头或任意光照验收。 |
| R02 | 单电脑连接、解绑、重连及[真实网关/DSH恢复](../../artifacts/remote-readiness-recovery-final.json) | 后续通信修改须复验这两个真实恢复入口；不新增多电脑功能。 |
| R03 | [正文搜索与工作区范围](../../artifacts/remote-search-android.json)、[迟到搜索结果](../../artifacts/search-order-android.json)、[设置页恢复归档](../../artifacts/settings-unarchive-android.json)、[父子孙导航](../../artifacts/remote-nested-recovery-20260925-navigate.json)、[嵌套断线恢复](../../artifacts/remote-nested-recovery-20260925-watch.json)；[当前APK标题搜索降级](../../artifacts/current-search-android.json) | 当前电脑未开启正文搜索，14:42仅标题提示、工作区、归档筛选与草稿保持通过。历史正文/嵌套报告仅证明其实际环境，不冒充本轮重跑。 |
| R04 | [按轮分支](../../artifacts/remote-mobile-turn-fork-android.json)，新建/改名/整段分支见矩阵 | 已有工作区限制持续保留；真实新建未知结果不得自动重发。 |
| R05 | 自有共享渲染、历史分页、实时记录、复制与导出已接入；[原插件生产页面回归](../../artifacts/remote-plugin-slots-web.json)和[分页证据](./remote-current.md#插件外层测量与历史分页2026-09-27) | 回归是隔离协议，不替代实际手机实时记录。分页旧数据可保留为基线，性能按用户要求合理区间，不擅自加严格真机门槛。 |
| R06 | 停止、队列编辑/取消/转引导与实际新轮次已有[验收记录](./remote-current.md#完成矩阵) | 必须区分“发送前停止无回复节点”和“输出中停止”；旧失败不能因后续重跑而抹去。 |
| R07 | [双端实际决定](../../artifacts/approval-two-clients.json)、[模型工具批准/拒绝](./remote-current.md#模型实际工具审批与拒绝2026-09-27)，提问/计划自然超时已有证据 | 原服务受控请求与真实模型调用分别记录；保持单次结算与未知写入不重发。 |
| R08 | [实际模型同步](../../artifacts/remote-mobile-models-android.json)、[技能入口](../../artifacts/remote-mobile-skills-android.json)、自定义模式/权限选择已有记录；[受控自定义工具及one-shot子任务继承实际执行](./custom-agent-runtime-current.md)、[PTC只读成功/文件缺失失败、内部工具停止、重入及续聊](./ptc-runtime-current.md)通过；[自动审核实际放行、取消、受控请求真实拒绝与续聊](./auto-review-current.md)通过，电脑补丁修正停止误报拒绝；[手机中文取消提示](./auto-review-current.md#手机取消提示与共享入口2026-09-28)实际历史读取通过；[不缩放的工具详情入口](./ptc-runtime-current.md#工具详情可读性2026-10-01)已在新版MuMu读取真实长错误通过 | 内部工具同一取消reason链路已实际验证，不外推任意并发/审批组合。原插件摘要仍按既定规则缩放，完整阅读使用独立详情。不将受控单工具验证外推全部第三方模式，按电脑真实能力验收，不增造模式。 |
| R09 | [目标生命周期](../../artifacts/remote-goals-lifecycle.json)、[定时单周期恢复](../../artifacts/schedule-recovery-watch-android.json)、[跨两个遗漏周期](./schedule-missed-current.md)，后台输出、子 Agent、工作流见矩阵 | 同名 remote-mobile-goals-android.json 目前只含空目标状态，不能单独当生命周期证明；应引用独立 lifecycle 报告。定时最新一次补发/原周期基准已实测，其余具体并发/失败场景继续按当前矩阵核验。 |
| R10 | 上传、工作区按需浏览、引用与[完整文件下载](../../artifacts/remote-mobile-download-android.json)；冷启动及[跨工作区结构化引用实际读取](./workspace-reference-current.md)通过；[菜单引用](./reference-menu-current.md)修复卡片丢失并通过MuMu真实文件/聊天读取 | 不同步整机目录，不自动扩大允许路径；原文件/聊天引用已有实证，不外推任意第三方引用或所有存储耗尽场景。 |
| R11 | 支持的文本/图片/PDF/HTML/Office 格式已有专项；[真实模型改动预览](../../artifacts/model-review-android.json) | 格式及失败范围以具体专项为准。沙箱 HTML 文件不是整站代理，内存压力测试不等于支持无限大文件。 |
| R12 | 原命令只读输出、重连续读、ANSI、复制/全屏、中文修复已有实际证据 | localhost 网站预览待定；手机交互终端已明确排除。 |
| R13 | [实际动态插件目录/生命周期](../../artifacts/cordis-inventory-live-android.json)、[全局页面与叠层](../../artifacts/global-panel-live-android.json)、[包管理记录](./plugin-management-current.md) | 当前59项状态是加载/组合状态，不是全包验收。未知第三方插件按契约与具体版本核验；未适配设置能力见上。 |
| R14 | [独立提供方 Key 保存/使用/移除](../../artifacts/provider-key-http-run-android.json)、[电脑Key变化自动同步](./key-state-current.md)、[提供方目录同步与手机管理回归](./provider-directory-current.md)、[协议保存与真实请求](../../artifacts/provider-protocol-run-android.json)、固定设置和日志导出已接入 | 反馈真实提交/撤回尚未验证；此前目的地变更动作遭自动审批拒绝，不绕过限制向默认外部遥测发送测试。官方/共享 Key 的实际替换及任意凭据管理不能由独立测试路由外推。 |
| R15 | [移除工作区注册后文件/聊天保留](../../artifacts/remote-workspace-preserved-android.json)，改名和排序有独立报告 | 不把移除注册描述为删除目录；创建工作区继续排除。 |
| R16 | 电脑打开确认、手机下载与系统分享、写入中取消/强停恢复已有[实际专项](./remote-current.md#完成矩阵) | 受控 DocumentsProvider 不等于全部系统文件提供方；Excel未知结果保持原提示，不假称所有办公应用启动通过。 |
| A01 | [双模式架构和生产入口](./ordinary-current.md)；覆盖安装保留 Key/历史/绑定及撤销隔离已有专项 | 新增原生诊断等接口必须沿原 origin/载体检查，不能泄露另一模式数据。 |
| A02 | [实际插件兼容清单](../../artifacts/plugin-compatibility-inventory-android.json)、动态失败回退/清理和错误归属已有记录 | 版本字段来自安装包元数据，不能冒充 WebView 字节哈希；等待管理权限与实际缺少能力应区别提示。 |
| A03 | 断线/首次失败/恢复/写入结果未知已有[当前矩阵](./remote-current.md#完成矩阵) | 只读可重新读取，写入仍需核对权威结果；不以自动重试掩盖未知副作用。 |
| A04 | [已有系统通知跨进程](../../artifacts/notification-multiple-restart-android.json)、[通知生命周期](./notifications-current.md)；[API36.1拒绝与系统设置恢复](../../artifacts/notification-permission-android.json)、[实际授权后投递与点击](../../artifacts/standard-notification-live.json) | 永久拒绝后的设置恢复、标准API36.1真实完成通知与点击正确回复已通过；时区导致发送失败已修复。完整通知类别/异常矩阵仍需核对，不扩大专项结论。进程结束后不收新推送。 |
| A05 | [系统主题、字号、语言、叠层与原生窗口](./appearance-current.md)已有专项；[API36.1键盘避让](./appearance-current.md#android-15以上键盘避让修复2026-10-01)及[MuMu真实中文候选](./appearance-current.md#中文候选输入与键盘避让2026-10-03) | 普通聊天、Remote配对页和已绑定聊天的键盘避让、收起恢复通过。Trime 真实软键盘 nihao→“你好”、可信 beforeinput 与输入区域避让通过，测试草稿清空、临时输入法卸载、原搜狗和原授权恢复。旧 Gboard 无候选失败保留；当前输入法没有网页 composition 事件，内联组词未由此证明，TalkBack 仍待验。 |
| A06 | 版本拒绝/恢复、备份迁移、覆盖安装和缓存入口已实现；[当前实际清理与重启](../../artifacts/remote-cache-android.json)保留普通统计/Key配置、Remote草稿/历史及原绑定；[正式诊断](./diagnostics-current.md)已实现并实际通过 | 旧[清理组](../../artifacts/remote-cache-after.json)原已存在，首次审计只查同名控制报告而漏引；当前已复测并将[控制组](../../artifacts/remote-cache-control-android.json)分开保存。升级迁移仍须匹配具体旧数据版本，不能仅凭APK安装成功。 |

## 继续工作的规则

1. A06 正式诊断入口已经补齐；后续字段扩展仍需白名单与来源核验，不收集完整日志、聊天或凭据来“方便排查”。下一项按设置能力缺口及现有证据边界继续核对。
2. 具体缺口完成后更新其原任务与本表，并保留失败/恢复证据；已经完成的功能不因文档存在历史“待验”而重新从零实现。
3. 功能缺口、运行环境限制、用户待定项分别处理。局域网/公网部署、真机、iPhone、多电脑不因本次审计成为新增交付门槛。
4. 原完整目标继续进行中。本表不授权删除功能，也没有把所有行标记为通过；完成前仍需按实际最终构建核对明确要求和交付材料。

