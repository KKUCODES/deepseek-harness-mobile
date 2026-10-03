# Remote 完整接入：当前实现与验收

首版范围已于2026-10-03确认：不提供手机访问电脑localhost网站，后续由[KKC-21](https://linear.app/kkcodes/issue/KKC-21)评估；文件预览、HTML文件预览和只读命令输出保留。详见[当前范围](./completion-audit.md)。历史记录中的网站转发待定状态以此决定为准。

## PTC停止分类修复（2026-10-01）

[电脑补丁及实际手机验证](./ptc-runtime-current.md#ptc停止分类修复2026-10-01)通过：纯等待程序取消显示已停止，保留已有输出，续聊正常。原125项回归及3项安装恢复通过，已安装至正常DSH，无新APK；测试聊天归档、原草稿/授权保留。下方误报记录是修复前证据，内部工具取消竞争和完整Remote其他范围继续。

## PTC停止误报失败（2026-10-01）

[真实停止专项](./ptc-runtime-current.md#ptc-停止分类缺陷2026-10-01)确认电脑中止纯等待程序并保留部分输出，续聊正常；但原Host把abort统一记为CODE_RUN_FAILED，手机显示失败，尚未修复。测试聊天已归档、原草稿与授权保留，下一步处理电脑结构化分类，不能按文本猜测。未修改生产代码或APK。

## 工具完整详情入口（2026-10-01）

[不缩放的详情入口与实际验证](./ptc-runtime-current.md#工具详情可读性2026-10-01)已补齐：主聊天与旁栏共用，保留原插件缩放和过程折叠；详情默认展开当前工具，长参数换行，内部工具按需展开。新版 APK 已在 MuMu 重读真实 PTC 失败并返回原聊天，草稿/授权保持。下方长错误偏小描述仍适用于原插件摘要，完整阅读现有独立入口；不代表完整 Remote 已完成。

## PTC 内部失败与续聊（2026-10-01）

[真实文件缺失专项](./ptc-runtime-current.md#文件缺失失败与续聊2026-10-01)：手机PTC只读调用不存在文件，原Host返回内部read与外层run_code失败，手机保留层级与not found原因；实际重入不重发，随后新消息正常回复。会话归档、原草稿/授权保留，未写文件或改产品/APK。截图中的长路径错误缩放后偏小仍是显示问题；停止、其他失败和原明确剩余验收继续。

## PTC 实际执行与重入（2026-10-01）

[实际专项](./ptc-runtime-current.md)：恢复本机服务和新版MuMu实例后，手机正式PTC模式通过真实模型run_code内调用read读取专用文件，最终回复匹配未放入提示词的随机原文。重入后外层/内层成功状态及包含关系保留；会话归档、文件删除、原草稿保留，管理权限未增加。无产品/APK修改；PTC停止、失败与其余明确验收仍未完成。

## 自定义模式实际工具执行（2026-09-28）

[实际链路与恢复证据](./custom-agent-runtime-current.md)：手机在专用新聊天选择自定义模式，真实模型调用电脑专用校验工具，最终完整回复匹配电脑新生成的随机值，原工具行成功且开始后模式锁定。首轮测试插件输出契约错误已修正并保留失败；修正后一次显式重试通过。测试聊天归档、原草稿/只读权限保留，正常无补丁DSH启动已恢复，临时模式入口消失，管理权限未增加。无产品/APK变化，PTC等其余范围继续。

## 手机工具取消提示（2026-09-28）

[共享入口与实际历史验收](./auto-review-current.md#手机取消提示与共享入口2026-09-28)：新版APK区分执行前取消与执行中停止，保留部分输出和真正错误；主聊天、嵌套、旁栏及备用详情页面回归通过。MuMu读取此前真实审核取消记录，中文停止行/展开详情通过，返回原聊天和草稿。此更新解决下节电脑补丁阶段遗留的英文技术文案；真实审核拒绝、PTC和其他Remote缺口仍保留。

## 自动审核取消状态（2026-09-28）

[原版复现与修复](./auto-review-current.md#审核途中取消与错误分类2026-09-28)：真实审核流被手机停止后，工具未执行但原电脑错误地记为模型拒绝。固定基线补丁已安装，25项审核及3项安装恢复通过；MuMu再次真实取消和后续续聊通过。原组件现显示英文取消技术错误，中文文案仍待改进。两轮测试聊天归档、文件删除、只读权限恢复，Auto与观察插件均卸载。无新APK，完整Remote继续。

## 自动审核实际执行（2026-09-28）

[真实Auto专项](./auto-review-current.md)：临时启用原实验包，手机新专用聊天确认后选择Auto，真实DeepSeek V4 Pro三次low/allow审核、write/read/write及文件结果同步通过；初次写入仍受原“先读后写”规则约束。测试后手机改回只读，Host无Auto会话，再卸载两临时插件，选项消失、原聊天与草稿保留。没有产品代码/APK修改；拒绝、取消、PTC及跨端并发仍待验。

## 提供方目录自动同步（2026-09-28）

[修复与实际双入口验证](./provider-directory-current.md)：电脑新增/改名/移除提供方会更新手机目录，保持仍存在的选中表单和未保存草稿。新版MuMu电脑事件和手机自己新增/模型发现保存/移除回归通过；测试配置清理、管理收权，原models整包兼容仍未完成。

## 电脑 Key 状态自动同步（2026-09-28）

[原事件接入与真实验证](./key-state-current.md)：共享Key组件在电脑配置/凭据变化后自动只读核对，失效响应不覆盖新状态，写入不会自动重放。新版MuMu独立提供方的电脑设置/移除同步通过，测试配置和凭据清理、管理权限收回；官方/共享Key未实际替换，完整Remote继续。

## 插件设置分页（2026-09-28）

[原分页接入](./plugin-settings-tabs-current.md)补齐 settings.plugins.tab：自有“电脑插件 → 插件设置”组合原组件，授权后显示内置清单/插件页签。新版MuMu实际页签切换保留、缩放、卸载与收权拒绝通过；原settings-plugins改为mobile，不开放通用credentials，原models及其他缺口继续。

## 引用菜单（2026-09-28）

[菜单修复与实际读取](./reference-menu-current.md)：原“＋”入口重写纯文本造成卡片丢失，现复用原编辑器追加。新版MuMu聊天卡片1→2/重入通过，菜单文件携带已有聊天引用跨工作区后，实际模型读取源文件及聊天标记，未读目标同名文件；测试资源已清理，完整Remote仍进行中。

## 跨工作区结构化引用（2026-09-28）

[真实同名文件验证](./workspace-reference-current.md)发现并修复仅保留JSON却读取目标目录文件的问题。交接前固定原文件来源，新版MuMu实际模型读取源文件及聊天标记通过；目标同名文件未被读取，测试资源清理完成。下文2026-09-26/27的“跨工作区实际读取待验”为历史状态，以本项为准。

## 模型设置底部扩展（2026-09-27）

- 状态：已实现并安装，真实 MuMu 入口通过。维护角色：项目协作 Agent；核验日期：2026-09-27。原契约为[模型页扩展定义](../../../deepseek-harness/packages/client/ui-settings-models/src/client/slot-contract.ts)的 `settings.models.footer`，list/root、空 owner；原[模型页](../../../deepseek-harness/packages/client/ui-settings-models/src/client/ModelsSection.tsx)将它放在提供方行和新增控件之后。
- 差距核对：手机已有终端、Agent、Subagent、网页搜索固定配置和模型提供方表单，不能因原包 waiting 就判定这些操作不存在。真正缺少的是原模型页扩展位置。直接激活整包会引入通用 credentials/settings 依赖；本次由[手机根插槽](../../src/remote-plugin-slots.jsx)保留原 footer 契约，[电脑设置](../../src/ui/RemoteComputerSettings.jsx)在自有表单末尾呈现。扩展无需新的读写协议、不携带当前会话或设置值，权限与业务服务不变；沿用 MobilePluginFrame 的用户/作者缩放规则。
- [生产入口浏览器专项](../../scripts/check-model-footer.mjs)在修改前超时，修复后验证单实例/root作用域、点击、600px缩至335px、收权移除/恢复及卸载；已加入[完整原插件页面回归](../../artifacts/model-footer-regression.log)，errors为空。Web构建、APK assembleDebug/lintDebug通过。
- [独立电脑测试插件](../../tests/fixtures/live-model-footer-plugin/client.js)通过原 CLI 安装和真实网关模块通道加载。[15:18 UTC MuMu](../../artifacts/model-footer-live-android.json)从聊天菜单打开正式电脑设置，计数0→1、600px缩至372px、无sessionId、Android返回和原草稿保留通过；[截图](../../artifacts/model-footer-live-android.png)已查看。[卸载后](../../artifacts/model-footer-removed-android.json)设置表单可见而扩展不存在。
- 管理授权按用户既有授权临时启用，测试后已收回；权限变更使原连接断开，首轮收尾脚本误等聊天页超时，保留[失败记录](../../artifacts/model-footer-cleanup-before-reconnect.json)。修正驱动使用页面真实“重新连接”后，[15:20 UTC收尾](../../artifacts/model-footer-cleanup-android.json)确认管理拒绝、聊天授权/草稿和返回保留。未发送模型消息、修改Key或电脑设置，没有重启DSH/网关。
- 范围：仅补原 footer 扩展；`settings.models.provider-card` 仍缺真实提供方目录/Key状态投影，不能用猜测元数据渲染。原 models/plugins 整包的通用凭据依赖仍未兼容。完整 R13/R14/Remote 继续，网页转发仍待用户确认。

## 插件全局页面导航（2026-09-27）

- 状态：新版 APK 已安装，MuMu Android 12 经真实电脑模块通道验收通过。维护角色：项目协作 Agent；核验日期：2026-09-27。原契约来源：[LayoutController](../../../deepseek-harness/packages/client/ui-layout/src/client/service.ts)与[插槽定义](../../../deepseek-harness/packages/client/ui-layout/src/client/index.ts)。实现：[全局页面](../../src/remote-global-panels.jsx)、[根渲染](../../src/remote-plugin-slots.jsx)、[导航生命周期](../../src/remote-session-view.mjs)、[背景交互所有权](../../src/remote-surface-inert.mjs)。
- 采用原 controller 与 DSHM 自有页面组合，相比加载原 AppFrame，保留原插件导航/取消契约且不引入桌面根布局。支持 layout、panelInfo、main keyed 页面与 sidebar.panellist 目录。原 openRightbar/closeRightbar 是呈现报告，不伪造成打开实际旁栏的指令。手机通过「Remote 选项 → 电脑插件 → 插件页面」进入；原侧栏 apply 被手机组合替代，不恢复用户已去除的新聊天按钮。
- 当前主聊天与插件导航共用取消顺序，较早异步结果不能覆盖后续页面选择；旁栏会话仍独立。多个窗口重叠时采用 inert 引用计数，最后关闭才恢复背景；全局页面的返回优先于下层旁栏。主聊天和旁栏均渲染工厂时，只在根模型挂载一次全局页面及浮层，修复此前嵌入会话重复挂载和缺少服务委托的问题。
- [定向脚本](../../scripts/check-global-panels.mjs)覆盖根作用域、原取消信号、无效目标、主聊天导航取消、叠层 Escape/inert、草稿与卸载；[完整插件页面报告](../../artifacts/remote-plugin-slots-web.json)通过且 errors 为空，包括主/旁栏全局界面数量断言。405 项 Node 测试此前通过；最终 Web 构建、Android assembleDebug/lintDebug 通过。这些浏览器回归是隔离协议数据，不替代真实手机证据。
- [独立电脑插件](../../tests/fixtures/live-global-panel-plugin/client.js)通过原 CLI 安装，14:39 UTC [Android 脚本](../../scripts/verify-global-panel-android.mjs)验证实际模块加载、root 无会话作用域、当前页面 ID、计数交互、Android 返回和插件返回；[报告](../../artifacts/global-panel-live-android.json)与[截图](../../artifacts/global-panel-live-android.png)已核对。原 CLI 卸载后，[清理报告](../../artifacts/global-panel-cleanup-android.json)确认页面关闭、空草稿保持、背景 inert 恢复、errors 为空。不发送模型消息，不修改 Key 或授予管理权限；收尾日常设备 active、management=false。
- 14:40 UTC 实际插件目录为 59 项：29 active、24 mobile、6 waiting。状态与功能证据分开记录；本次不宣称任意第三方全局页面、所有布局依赖或完整 Remote 已通过。电脑本地网站转发仍暂缓、范围待用户确认，没有静默取消。

## 插件全局浮层（2026-09-27）

- 状态：新版APK已安装，MuMu Android12真实电脑模块加载与卸载验收通过。维护角色：项目协作Agent；核验日期：2026-09-27。原契约来源：[Layout插槽声明](../../../deepseek-harness/packages/client/ui-layout/src/client/index.ts)、[原AppFrame呈现](../../../deepseek-harness/packages/client/ui-layout/src/client/AppFrame.tsx)；实现：[手机根插槽](../../src/remote-plugin-slots.jsx)、[外层尺寸适配](../../src/ui/MobilePluginFrame.jsx)、[手机样式](../../src/ui/remote-product.css)。
- 原Remote没有声明或呈现` shell.overlay `，普通聊天已有；使用该原插槽的插件会等待且不显示。新增浏览器回归在修改前等不到插件按钮，修改后通过。现在只在DSHM根容器呈现一次、明确无会话作用域，保持原注册/卸载和组件错误归属；不启动桌面root/layout或新增交互终端。
- [定向回归](../../scripts/check-shell-overlays.mjs)与[报告](../../artifacts/shell-overlays-web.json)覆盖延迟注册、单实例、普通/fixed按钮点击、600→375px缩放、输入区域不被遮挡、聊天/列表切换后状态保留及卸载清理。[完整插件页面回归](../../artifacts/remote-plugin-slots-web.json)也通过，无页面错误。Web构建、Android assembleDebug/lintDebug通过；首次构建缺少ANDROID_HOME，指定已有SDK后成功，没有变更SDK或项目依赖。
- [独立测试插件](../../tests/fixtures/live-shell-overlay-plugin/client.js)由原DSH CLI安装，经实际网关模块通道加载。14:21 UTC [手机报告](../../artifacts/shell-overlay-live-android.json)记录：浮层无sessionId、点击计数从0变1、600px缩到420px，页面无横向溢出；回到最近聊天再打开同一专用会话，仍只有一个浮层且计数保留，原空草稿未变。[实际截图](../../artifacts/shell-overlay-live-android.png)已核对，没有模型调用、Key或权限修改。
- 原CLI卸载后，[14:22 UTC清理报告](../../artifacts/shell-overlay-cleanup-android.json)确认实际浮层消失、原草稿保持。日常设备active/management=false，电脑与网关保持运行。测试入口为[Android驱动](../../scripts/verify-shell-overlay-android.mjs)，本轮不等同所有第三方弹窗/fixed布局、旁栏并发、断线/撤销组合或桌面layout服务兼容；完整R13仍按原范围推进。

## 中文命令乱码的电脑端根因（2026-09-27）

- 状态：补丁已安装，正式电脑与Android入口中文输出通过。维护角色：项目协作 Agent；核验日期：2026-09-27。来源：[电脑/手机原调用对照](../../artifacts/command-encoding-ui.json)、[双端读取驱动](../../scripts/diagnose-command-encoding-ui.mjs)、[实际沙箱实验及安装恢复](../../../plugin/compatibility/pwsh-output-encoding/README.md)、[新请求手机报告](../../artifacts/command-encoding-live-observe.json)和[电脑报告](../../artifacts/command-encoding-live-desktop.json)。
- 原电脑与手机同一调用的文字完全相同，各含172个替换字符。真实原执行器在隐藏控制台继承936，字节按GB18030能恢复中文；直接启动继承65001时中文正确。原UTF-8初始化调用在只读ConstrainedLanguage下被拒绝，属于电脑启动/执行链路，不能在手机错误解码后补救。
- 补丁在创建PowerShell子进程前设置UTF-8，受限语言跳过不可用初始化。两个包12个源码严格类型检查、PowerShell7/5.1真实只读沙箱及FullLanguage普通执行器通过；写入/类型限制保留，唯一测试文件已删除。固定基线12文件安装器支持原件恢复，五项测试覆盖重复安装/恢复、途中失败回滚、未知输入、链接目录和只读参考拒绝。
- 14:03 UTC短暂停止并安装本机DSH后恢复服务；[实际手机驱动](../../scripts/verify-command-encoding-live.mjs)在原专用聊天只发一次请求，模型只调用一次pwsh。14:09 UTC同一callId在手机原卡片、独立标准/错误输出、最终结果和电脑原记录均正确显示中文，标准输出emoji正确；无替换字符或InvalidOperation。[错误输出截图](../../artifacts/command-encoding-live-stderr.png)及[电脑截图](../../artifacts/command-encoding-live-desktop.png)已查看。Write-Error导致退出码1是预期样例，不是工具成功退出。
- 原空草稿与仅可查看权限保持，日常设备active/management=false；未修改用户Key、日常APK或上游参考。DSH50920/网关77100监听正常。其他共享/无控制台、重命名PowerShell和并发组合未由此证明；旧历史损坏文字不会自动恢复，网页转发继续范围待确认。

## 主聊天命令输出在途撤销（2026-09-27）

- 状态：现有日常代码构建的独立 Android 包，在 MuMu 经真实电脑 DSH 与网关通过主聊天前台命令输出撤销。维护角色：项目协作 Agent；核验日期：2026-09-27。来源：[分阶段驱动](../../scripts/verify-foreground-revocation-android.mjs)、[配对准备](../../artifacts/foreground-output-revocation-prepare.json)、[实际发送](../../artifacts/foreground-output-revocation-send.json)、[输出与撤销](../../artifacts/foreground-output-revocation-revoke.json)、[在途画面](../../artifacts/foreground-output-revocation-held.png)、[拒绝重连画面](../../artifacts/foreground-output-revocation-revoked.png)、[清理](../../artifacts/foreground-output-revocation-cleanup.json)。
- 只批准新建的独立验收设备039，日常设备在测试代理运行期间停止，原聊天授权保持 active、管理权限 false。原专用聊天只发送一次 pwsh；Console 类型调用被当前只读 PowerShell 语言模式拒绝，真实工具返回退出码1与 InvalidOperation。没有提升权限、重发命令或修改项目文件；本项不算固定样例命令成功执行。
- 从原工具卡片「查看」打开 DSHM 命令窗口，独立 stderr 读取真实错误文本，再切标准输出并暂缓真实响应。13:35:32 UTC报告记录 heldOutputResults=1、heldBytes=233。电脑撤销该设备后，主工作区与命令窗口都移除，两条测试连接关闭，暂缓字节全部丢弃；显式重新连接被旧授权失效提示拒绝。页面错误为空，截图已核对。
- 此前脚本把双层标题当成单一标题、在折叠卡片里查找隐藏命令，分别保留[准备定位失败](../../artifacts/foreground-output-revocation-prepare-locator-failure.json)和[观察定位失败](../../artifacts/foreground-output-revocation-inspect-locator-failure.json)。改为工作区标题与原卡片展开后核对唯一标记，只观察原请求，不重发。最初清除旧绑定的驱动发现独立包已经未绑定，未执行删除，不记为清理通过。
- 测试授权已撤销，独立包失效绑定已移除。本项补足主聊天输出响应在途撤销；暂缓的是空 stdout 的真实结果帧，不冒充大数据分片、运行中任务停止或跨新连接旧帧注入。原输出中的中文沙箱错误有乱码，尚未定位其产生层，不能把本次记作中文编码通过。其他原范围仍按矩阵推进；localhost网站转发保持范围待确认。
- 测试代理已停止，ADB8787已恢复直连原网关。[日常入口恢复报告](../../artifacts/foreground-output-revocation-restored.json)确认原专用聊天、空草稿和已结束请求保留，授权仍 active/management=false。恢复时 Android 任务栈残留系统文件选择器，取消该窗口后从 Launcher 正常冷启动；未清数据或改 Key。

## 电脑提供方 Key 的原生保存与实际请求（2026-09-27）

- 状态：现有 APK 在 MuMu Android 12 通过独立自定义提供方的原生 Key 保存、电脑真实 HTTP 模型发现及移除。维护角色：项目协作 Agent；核验日期：2026-09-27。来源：[驱动](../../scripts/verify-model-http-discovery-android.mjs)的 `--key` 模式、[最终报告](../../artifacts/provider-key-http-run-android.json)、[清理状态](../../artifacts/provider-key-http-live-seed.json)、[收权后的实际拒绝](../../artifacts/provider-key-http-blocked-android.json)、[原生密码窗口](../../android/app/src/main/java/dev/dshmobile/validation/RemoteComputerKey.kt)、[原凭据写入边界](../../../plugin/src/computer-key.ts)。
- 仅临时授予已获用户授权的日常设备管理权限，在手机新增唯一测试路由，地址为临时本机 HTTP 服务。使用原设置入口建立独立 Key 引用；密码窗口标题核对路由、输入框为 password 后，填入本进程生成的无外部用途测试值。真实请求沿 App 原生桥、网关、电脑原 credentials provider 与模型发现服务完成，没有替换生产认证或直接写配置。测试服务只返回固定模型目录，用于核对电脑真实请求，不冒充第三方服务或模型推理。
- 13:19 UTC报告：保存后界面显示「已配置」，电脑发出一次 GET /v1/models，Bearer 值与内存测试值一致；报告只记录匹配布尔值，不输出/持久化凭据。原生移除经过二次确认，界面变为「尚未配置」，再次发现显示失败且没有新 HTTP 请求，没有复用旧 Key。网页正文未含这枚测试值；这不是对所有 JS 存储/日志的泄露审计。
- 最终路由和测试服务均已清理，keyConfigured=false；临时管理权限已收回，13:19:54 UTC手机设置入口重新拒绝、原聊天与草稿保留，errors/resources=[]。未触碰现有 DeepSeek Key、其他提供方或普通聊天凭据，没有收费模型请求、产品源码/APK修改。
- 最初 Playwright 原生 fill 超时，尚未保存/请求，随后进程停在验证驱动收尾；核对进程身份后停止本测试驱动。[失败报告](../../artifacts/provider-key-http-input-failure.json)和[首轮清理](../../artifacts/provider-key-http-first-cleanup.json)保留。清理驱动还曾未识别原生按钮的 KEY 大写，保留[定位失败](../../artifacts/provider-key-http-cleanup-locator-failure.json)；改为核对当前未配置状态、按已观察的原生密码框位置输入字母数字测试值及大小写无关按钮定位，重新运行后通过。上述驱动故障不计为产品失败或通过。
- 本项补足自定义提供方 Key 实际保存/使用/移除，不能外推官方/共享搜索 Key 更换、第三方 TLS/认证、推理请求、任意凭据或 OAuth。完整 R14 继续。

## 模型写入后的真实整轮差异（2026-09-27）

- 状态：现有 APK 在 MuMu Android 12 通过实际模型 write 轮次的原 ReviewTab。维护角色：项目协作 Agent；核验日期：2026-09-27。来源：[只读驱动](../../scripts/verify-model-review-android.mjs)、[13:10 UTC 报告](../../artifacts/model-review-android.json)、[左右对比画面](../../artifacts/model-review-android.png)，原实际写入依据见[审批与拒绝](#模型实际工具审批与拒绝2026-09-27)。
- 从专用聊天中包含本轮唯一测试文件名的「在侧边栏查看本轮改动」进入，原 ReviewTab state=ready，所选路径与已核实的模型 write 文件一致。单栏显示正确 BEFORE/AFTER 标记，左右对比左右内容分别一致；没有创建受控 turn、补造快照、恢复已删除文件或重新发送模型请求。
- 测试文件此前已在审批收尾中删除，预览前后均核对磁盘 ENOENT，而该轮快照仍可读取。此证据证明历史改动与当前文件分离，不外推快照永不清理；超过原 Host 快照保留期仍遵循缺失提示。
- 报告 errors/resources=[]、draftPreserved=true，已查看实际截图并返回日常专用聊天。产品源码/APK、文件内容、配置和授权未改。本项补足此前受控 Git 快照验收不能证明的实际模型写入路径；多文件/二进制/超上限仍沿用各自既有专项证据。

## 模型实际工具审批与拒绝（2026-09-27）

- 状态：现有 APK、真实网关和电脑 DSH 在 MuMu Android 12 完成模型发起 write 的单次批准与拒绝；维护角色：项目协作 Agent；核验日期：2026-09-27。来源：[驱动](../../scripts/verify-original-approval-android.mjs)、批准的[发送](../../artifacts/original-tool-approval-live-20260927-start.json)/[最终观察](../../artifacts/original-tool-approval-live-20260927-observe.json)/[审批画面](../../artifacts/original-tool-approval-live-20260927-pending.png)/[清理](../../artifacts/original-tool-approval-live-20260927-cleanup.json)，拒绝的[发送](../../artifacts/original-tool-rejection-live-20260927-start.json)/[观察](../../artifacts/original-tool-rejection-live-20260927-observe.json)/[结果画面](../../artifacts/original-tool-rejection-live-20260927-result.png)/[清理](../../artifacts/original-tool-rejection-live-20260927-cleanup.json)。
- 两轮均使用已有专用聊天及 DSH-TEST 下独立单文件，原权限是「仅可查看」。模型首次 write 被真实只读沙箱拒绝，随后发起 workspace-write 单次提升请求；原审批卡片经 Remote 显示。驱动只处理匹配本轮文件的 write、每轮最多一项审批，不提升长期权限、不执行命令。
- 批准轮13:04:58 UTC最终核对：原「允许一次」后文件内容变为 AFTER 标记，生成结束、卡片移除，点击原文件按钮进入手机插件面板，预览与磁盘一致。首次观察已完成审批和写入，但脚本以 basename 定位实际上显示完整路径的按钮而超时；保留[旧定位失败](../../artifacts/original-tool-approval-live-20260927-preview-locator-failure.json)，修正后只观察同一请求，没有再次发送或批准。
- 拒绝轮13:06:15 UTC核对：原「拒绝」后 write 显示 user rejected escalation，模型停止且说明未修改/未重试；磁盘仍为原 BEFORE 内容。其前置首次只读沙箱拒绝是原权限流程，不是手机报错。两轮均无页面错误，原草稿为空、会话权限仍为「仅可查看」。13:05:17/13:06:30 UTC分别核对后删除本轮单文件，聊天历史保留。
- 与此前受控 ApprovalService 超时/双端竞争不同，本项确实由模型发起原工具并执行（或拒绝执行）。旧余额失败已由本轮实际请求成功解除，不外推后续余额；没有修改产品源码/APK、Key、模型配置或设备权限。其余撤销/网络交错边界和完整 Remote 继续验收。

## 持久化聊天引用的真实模型读取（2026-09-27）

- 状态：现有 APK 在 MuMu Android 12 经真实 Remote 通道通过聊天引用冷启动、序列化和模型读取。维护角色：项目协作 Agent；核验日期：2026-09-27。来源：[共用分阶段驱动](../../scripts/verify-persisted-reference-send.mjs)的 `--chat` 模式、[准备](../../artifacts/persisted-chat-reference-send-prepare.json)、[恢复与发送](../../artifacts/persisted-chat-reference-send-send.json)、[观察](../../artifacts/persisted-chat-reference-send-observe.json)、[画面](../../artifacts/persisted-chat-reference-send-result.png)、[收尾](../../artifacts/persisted-chat-reference-send-cleanup.json)。
- 复用此前已归档的「DSHM 引用来源 1790355068719」，其原用户消息包含随机 CHAT 标记；此前来源请求因余额失败，不影响用户消息作为真实历史资料。本轮未取消归档、编辑来源或新建来源请求。输入原候选选择该聊天后，强制结束 App、从普通首页重开 Remote，卡片与文字草稿恢复。
- 在专用目标聊天仅发送一次，提示词不含完整标记，真实模型返回来源中的完整随机标记。13:00:47 UTC 的报告 chatReadVerified=true、emptyDraft=true，页面/资源错误为空；实际画面同时显示原「引用的上下文」与模型结果。13:00:59 UTC 收尾确认原空草稿保持，来源记录未改，不调用文件或命令工具、不改 Key/授权/模型设置。
- 首次恢复检查在核心重挂载编辑器时读到暂时空值，尚未发送；保留[等待失败](../../artifacts/persisted-chat-reference-send-restore-wait-failure.json)。驱动改为等待完整草稿一致后再断言卡片，而非只等首次卡片可见；接续同一请求准备，不重发模型消息。产品源码/APK 未改。
- 结合下一节，文件和聊天引用在 App 重开后实际发送已通过；跨工作区草稿交接后的模型读取及其余 R10–11 异常仍待验，不外推全部引用组合。

## 持久化文件引用的真实模型读取（2026-09-27）

- 状态：现有 APK 经 MuMu Android 12、真实网关和电脑 DSH，完成文件候选选择、App 强制结束、冷启动恢复及单次实际发送。维护角色：项目协作 Agent；核验日期：2026-09-27。来源：[分阶段驱动](../../scripts/verify-persisted-reference-send.mjs)、[准备](../../artifacts/persisted-reference-send-resume-prepare.json)、[恢复与发送](../../artifacts/persisted-reference-send-send.json)、[模型结果](../../artifacts/persisted-reference-send-observe.json)、[实际画面](../../artifacts/persisted-reference-send-result.png)、[清理](../../artifacts/persisted-reference-send-cleanup.json)。
- 使用已有专用「DSHM Remote 联调提示」会话，在 DSH-TEST 创建独立文本文件。通过原输入候选生成 reference 卡片；强制结束 App 后，从普通首页进入 Remote，原草稿文字和卡片数量一致。仅发送一次，提示词不包含文件中的随机标记；真实模型调用 read，最终返回完整标记，源文件内容不变。12:56:23 UTC 的观察报告 fileReadVerified=true、emptyDraft=true，页面/资源错误为空；截图已核对。
- 旧余额错误不再作为本项阻塞：本轮实际 DeepSeek 请求成功，但不外推后续余额可用性。尚未证明聊天引用、跨工作区交接引用的模型读取或全部异常。
- 首次脚本误将附件菜单的文本引用当成结构化卡片，等待超时；之后两次驱动分别未等待 App PID、未等待卡片恢复而在发送前失败。保留[首次准备失败](../../artifacts/persisted-reference-send-prepare.json)、[启动等待失败](../../artifacts/persisted-reference-send-startup-failure.json)、[恢复等待失败](../../artifacts/persisted-reference-send-restore-wait-failure.json)，不算产品缺陷或通过。修正驱动后接续同一文件/草稿；发送前落盘 attempted 标记，后续只观察，不因超时重复发送。
- 12:56:36 UTC 已核对完整内容后删除本轮唯一测试文件，专用聊天保留、草稿恢复为空。未修改 Key、设备授权、模型设置、产品源码或 APK；完整 Remote 仍进行中。

## 原审批双端同步与相反决定（2026-09-27）

- 状态：现有 APK/网关/DSH 通过 MuMu Android 12 与桌面 Edge 原页面的实际双端检查；无产品代码改动。维护角色：项目协作 Agent；核验日期：2026-09-27。来源：[驱动](../../scripts/verify-approval-two-clients.mjs)、[最终报告](../../artifacts/approval-two-clients.json)、[原服务持久审计](../../artifacts/approval-two-clients-host.json)、[实际桌面画面](../../artifacts/approval-two-race-desktop.png)、[清理报告](../../artifacts/approval-two-clients-cleanup.json)。
- 内置浏览器连接不可用，驱动通过既有 DSH 正常启动链接在独立无头 Edge 上登录，打开专用工作区/会话；MuMu 从实际 Remote 列表打开同一会话。登录凭据仅在内存，不写报告。沿用原 ApprovalService 样例，受控 turn 中请求审批；不调用模型、不执行工具、不改普通聊天 Key 或设备授权。
- 三组实际检查：手机拒绝后电脑卡片移除；电脑拒绝后手机卡片移除；两端同一已呈现请求作相反决定后，原 Host 只持久化一次决定。每组核对 asked/decided 的 ID 与数量、两端原卡片 DOM 已移除。并发轮结果为 rejected；两端原按钮处理器都执行时卡片仍连接且按钮可用，页面/资源无错误，日常聊天与草稿恢复。
- 第一轮普通 locator.click 的自动等待让一个点击发生在卡片已被另一端处理后，不能证明双提交；保留[未通过的驱动报告](../../artifacts/approval-two-clients-first-attempt.json)及[对应 Host 记录](../../artifacts/approval-two-clients-first-host.json)。最终驱动先分别校准两端时钟，再在未来时刻触发已定位按钮的原 click 处理器，估计触发差 1ms，时钟估计不确定性分别 2.5/1.5ms。没有拦截/伪造 wire、暂停业务结算或修改响应；这不代表所有网络延迟排序均已覆盖。
- 中间一次驱动在安装尚未 ready 时由前置断言退出，没有发起请求；确认同一安装已 ready 后才运行，不重新安装来掩盖等待。最终样例已由原 CLI 卸载，原服务归档测试会话、移除工作区登记，手机实际列表与日常草稿复查通过；设备 active、management=false。剩余 R07 为其他拒绝/撤销与网络交错边界，不能继续将原审批双端同步列为完全无证据。

## 原工具审批请求期限与下一请求（2026-09-27）

- 状态：现有 APK 通过 MuMu Android 12、实际网关及电脑原 ApprovalService 的期限清理与下一请求拒绝。本轮未改产品代码或 APK。维护角色：项目协作 Agent；核验日期：2026-09-27。依据：[专用样例及边界](../../tests/fixtures/live-approval-timeout-plugin/README.md)、[Android 驱动](../../scripts/verify-approval-timeout-android.mjs)、[实际报告](../../artifacts/approval-timeout-android.json)、[原 Host 审计归档](../../artifacts/approval-timeout-first-host.json)、[清理核对](../../artifacts/approval-timeout-cleanup.json)。
- 原服务要求审批位于打开的 turn 内；样例使用独立工作区/Agent、原消息构造器及受控 turn 事件满足该契约，调用真实 `approval.request`，没有模型请求、工具执行或伪造审批响应。30 秒是样例传入 signal 的期限，不是产品默认工具超时配置。
- 手机实际打开专用会话、显示原审批卡片；30,003ms 后 Host outcome=cancelled，approval/asked 与 approval/decided 的 ID 配对，旧卡片从 DOM 移除、输入恢复且草稿保持。下一请求使用新 pending key，手机点击「拒绝」，276ms 后 Host outcome=rejected 且持久审计匹配，没有沿用旧结算。
- 两次页面/资源错误为空，实际截图已检查。测试插件已由原 CLI 卸载；原服务归档专用会话并移除工作区登记，手机刷新列表再次确认两者不见，返回日常聊天且原草稿保留。设备仍 active、management=false，电脑服务未重启、用户配置未改。
- 本项补足原审批服务经真实 Remote 通道的超时清理与后续请求隔离；不等同模型实际发起工具或双设备同时提交。多端实际网络竞争、拒绝/撤销的其余边界仍按 R07 验收。

## 改动预览边界与刷新期间的列表状态（2026-09-27）

- 状态：新版 APK 已安装，MuMu 实际入口通过。维护角色：项目协作 Agent；核验2026-09-27。来源：[列表组件](../../src/ui/RemoteWorkspace.jsx)、[页面回归](../../scripts/verify-remote-plugin-slots.mjs)、[页面报告](../../artifacts/remote-plugin-slots-web.json)、[真实驱动](../../scripts/verify-live-review-android.mjs)、[Host报告](../../artifacts/review-live-host.json)、[Android报告](../../artifacts/review-live-android.json)、[清理报告](../../artifacts/review-live-cleanup.json)。
- 在真实刷新会话后立即关闭菜单并点击列表，旧版两次点击被内部 busy 守卫静默忽略。现在列表项直接使用同一 busy 状态禁用；覆盖最近、工作区、搜索及归档共用行，无第二套实现。选择允许刷新时导航会增加并发状态范围，因此沿用现有操作锁，并将实际可操作状态如实呈现。
- 页面回归暂缓真实组件调用的 session/list 响应，验证关闭菜单后列表全部 disabled，响应完成后恢复。完整插件页面回归 errors=[]；Web、APK构建与 Android lint 通过。最终安装版经普通首页→抽屉→Remote，刷新后点击同一会话正常，不再静默丢失导航。
- 样例0.0.4生成4字节含NUL的 binary.dat 和3,200,000字节 large.txt，由原Host分别返回 binary/oversized（默认对比上限2 MiB）。手机显示[二进制提示](../../artifacts/review-boundary-binary-android.png)和[文件过大提示](../../artifacts/review-boundary-large-android.png)，清除前一个文本diff；切回普通文本、左右对比、换行、电脑打开取消及最新文件/历史快照区分全部通过。图片已核对，草稿保持，页面/资源错误为空。
- 首次失败是测试驱动未关闭刷新菜单；随后关闭菜单仍两次导航无效，确认是上述 busy 状态问题，未用强制点击绕过。样例仍为受控事件及真实 Git 快照，不调用模型。测试插件卸载、工作区登记移除、测试会话归档；日常聊天/草稿保留，管理权限 false、聊天授权 active，无Key或模型配置变化。DSH66128、网关77100正常，当前登录日志为 review-boundary-dsh.stdout.log（不展示）。
- 已补齐二进制/超上限拒绝显示路径，不外推为任意大型文本diff性能或所有格式完成。此前正向两文件报告另存 review-positive-{host,android,cleanup}.json；完整Remote保持推进，网页转发暂缓且范围待确认。

## 原整轮快照的 Android 正向验收（2026-09-27）

- 状态：现有日常 APK 在 MuMu 通过真实 Host 快照、网关、原 ReviewTab 的正常读取。维护角色：项目协作 Agent；最近核验2026-09-27。来源：[专用样例说明](../../tests/fixtures/live-review-plugin/README.md)、[实际驱动](../../scripts/verify-live-review-android.mjs)、[Host 报告](../../artifacts/review-live-host.json)、[Android 报告](../../artifacts/review-live-android.json)、[清理核对](../../artifacts/review-live-cleanup.json)。
- 独立 Git 工作区的两个文本文件由测试样例写入，原 workspaceChanges 记录真实前后快照。会话事件由原消息构造器受控生成，没有调用模型或 DSH shell；只证明文件快照至实际手机预览的链路，不冒充模型实际修改文件的完整循环。
- 手机从真实会话卡片打开原 ReviewTab，统一/左右对比、换行、两个文件切换、电脑打开确认取消通过；修改后的最新文件含 LATEST，历史快照仍为 AFTER，切回标签保持对比设置。已查看[双文件画面](../../artifacts/review-live-multi-android.png)及[历史快照画面](../../artifacts/review-live-snapshot-android.png)。草稿保持，页面/资源错误为空。
- 两次初期列表失败不能记为产品通过：热卸载/重装同名测试包仍执行旧模块，重启 DSH 后诊断才生效；受控事件没有 Agent running 状态帧，而原客户端以该帧清除空会话标志。显式页面刷新后读取电脑 blank=false 投影，正常显示。最终驱动包含该准备步骤，失败报告保留；没有为测试伪造模型运行状态或修改生产列表规则。
- 临时插件已卸载，测试会话已归档、工作区登记移除，原聊天与草稿保留。日常设备管理权限保持 false，聊天授权 active；未改 Key、模型选择或用户文件。现场 DSH74864、网关77100；当前正常登录日志为 review-live-dsh.stdout.log（含凭据，不展示）。脚本语法检查通过，本轮未改产品、未重建 APK。
- 该项补齐此前只有浏览器正常路径的 Android 缺口；二进制/超大差异、完整异常和完整 Remote 仍待验。localhost 整站转发暂缓、最终范围待确认。

## 自定义服务协议切换（2026-09-27）

- 状态：插件0.1.66、新网关及APK已安装，MuMu真实管理入口通过保存、取消、电脑重读及HTTP请求协议切换。维护角色：项目协作Agent；核验2026-09-27。来源：[Host](../../../plugin/src/provider-settings.ts)、[手机设置页](../../src/ui/RemoteProviderSettings.jsx)、[实际脚本--protocol分支](../../scripts/verify-model-http-discovery-android.mjs)、[最终运行报告](../../artifacts/provider-protocol-run-android.json)、[收权报告](../../artifacts/provider-protocol-blocked-android.json)、[实际画面](../../artifacts/provider-protocol-saved-android.png)。
- 与原DSH ProviderEditor一致，只为原运行时声明的自定义路由显示服务协议，枚举取电脑实际schema；内置提供方和旧Host不显示入口。比较直接开放通用设置与扩展既有固定表单，采用后者，保留管理授权、快照、配置版本和原服务校验；不向手机开放任意配置路径、headers或凭据。
- 手机先显示原/新协议并要求确认，取消不写入，重读放弃草稿；语言切换保留草稿。Host保存前复查运行时身份、路由声明和schema选项。已有不兼容参数不会被自动删除：原业务校验拒绝时配置完整保留，手机仍按未确认保存提示重读。
- 临时无Key路由经真实DSH请求受控本机HTTP服务，先验证503脱敏、等待中关闭取消、重试发现/采用/保存；切换为anthropic-messages并重读后，请求实际变为`GET /v1/models?limit=1000`且带Anthropic版本头，模型行和128K容量保留。切回openai-completions后恢复`GET /v1/models`且不带该头；两种路径均无认证头。没有调用聊天模型，不代表真实第三方认证/TLS或全部协议已验证。
- Host/创建13项、网关协议及真实HTTP/WS/SQL权限7项、手机控制器6项、生产设置组件18组检查通过；两端类型检查、构建、APK/lint通过。第一轮启动时App进程未就绪报告保留；超长WebView截图拼接不可靠，修正为可见视口截图后复验通过。临时路由/HTTP服务已清理，管理权限收回，日常聊天授权及草稿保留，最终页面/资源错误为空。现场DSH60776、网关77100，登录日志改为provider-protocol-dsh.stdout.log（含凭据，不展示）。
- 完整Remote仍未完成。此项补足已有自定义路由协议编辑，不外推为所有设置、模型调用或插件兼容已完成；localhost整站转发继续暂缓、最终范围待确认。

## 模型覆盖保留与过期写入的手机验收（2026-09-27）

- 状态：现有APK经真实网关/DSH通过已有用户覆盖保留、单项删除和过期版本拒绝；未发现需要修改的生产问题。维护角色：项目协作Agent；核验2026-09-27。来源：[实际脚本的--merge分支](../../scripts/verify-model-discovery-android.mjs)、[11:16UTC报告](../../artifacts/model-overrides-merge-run-android.json)、[收权报告](../../artifacts/model-overrides-merge-blocked-android.json)、[原服务基础层/隐藏字段专项](../../../plugin/tests/provider-model-overrides.test.ts)。
- 仅在临时内置openai路由操作：保存第一项后加入第二项并设置128001容量，重读后第一项保留、容量未被K/M格式化舍入。删除第一项后第二项ID、名称和容量完整保留；恢复默认清除所有用户覆盖，候选目录重新完整，随后清单采用/保存/恢复与覆盖互斥也通过。
- 两个实际设置表单先读取同一电脑版本：保留未保存的模型名称草稿，另一标量表单先把请求超时保存为45001，再提交旧模型草稿。真实Host拒绝并提示重新读取；重读模型仍是此前两个覆盖，标量重读保持新值，旧草稿没有覆盖它们。是同一手机两个入口造成的真实版本竞争，不冒充两台设备同时提交。
- 临时路由及其超时改动已一并从手机移除；管理权限已收回，实际手机重连后设置拒绝、聊天草稿保留，页面错误/HTTP资源失败为空。没有模型调用、Key/原用户提供方/地址/绑定修改；无产品代码或APK变化。
- 此项覆盖用户层可见行的保留/删除，不代表电脑基础层与未知隐藏字段已在手机实测；后两者仍只有原SettingsProvider专项证据。两设备竞争、其他完整字段与原Remote矩阵继续，网页转发暂缓、最终范围待确认。

## 自定义模型发现的真实HTTP链路（2026-09-27）

- 状态：日常APK通过真实网关/DSH请求本机受控无认证模型列表服务；失败、取消、重试、去重与保存重读通过。维护角色：项目协作Agent；核验2026-09-27。来源：[Android脚本及端点](../../scripts/verify-model-http-discovery-android.mjs)、[实际报告](../../artifacts/model-http-discovery-run-android.json)、[收权报告](../../artifacts/model-http-discovery-blocked-android.json)、[原HTTP发现解析器](../../../deepseek-harness/packages/llm/llm-pi-ai/src/discovery.ts)。
- 手机新增专用openai-completions路由，指向电脑127.0.0.1随机端口的/v1，保留一个initial-model，无Key。端点明确按原解析器接受的data数组和容量字段提供测试目录；未替换App、网关、Host、鉴权或解析器，不能把此测试服务当作真实第三方模型提供方。
- 服务先返回503，手机显示脱敏错误且原模型行保留；下次请求保持等待，通过手机关闭设置后端点连接实际终止。重新进入并明确重试，手机只提供尚未存在的dshm-http-model，采用名称、128K上下文与8K输出容量；保存并从电脑重读保持，原模型行保留，再发现显示没有可添加的新模型。
- 11:12UTC最终报告四次请求均为GET /v1/models，不含Authorization或x-api-key；等待请求实际取消，最终两次成功。模型错误属于管理通道返回，不是手机HTTP资源加载失败，页面错误/资源失败均为空。没有调用聊天模型或填入Key；仅验证openai-completions的受控本机HTTP路径，不涵盖真实第三方认证、TLS、其他协议、分页/超大列表或所有弱网。
- 专用路由已手机移除，服务器关闭所有连接后退出；临时管理权限收回后，手机重新连接仍能查看聊天、电脑设置拒绝访问、草稿保留。原用户提供方/Key/地址和绑定未改；本轮只有验收工具及文档变化，产品代码/APK保持。完整R14–15及Remote继续，网页转发暂缓、最终范围待确认。

## 内置模型发现与覆盖的真实手机验收（2026-09-27）

- 状态：现有日常APK经真实网关和DSH，通过内置目录发现、两个编辑入口、保存重读及恢复默认。完整Remote未完成。维护角色：项目协作Agent；核验2026-09-27。来源：[实际Android驱动](../../scripts/verify-model-discovery-android.mjs)、[最终报告](../../artifacts/model-discovery-run-android.json)、[收权报告](../../artifacts/model-discovery-blocked-android.json)、[原发现服务](../../../deepseek-harness/packages/llm/llm-pi-ai/src/discovery.ts)。
- 原新增页面确认openai尚未配置，手机创建带唯一验收名称的临时内置路由，不填写Key或发送模型请求。原目录返回39个候选；单个覆盖入口选择第一项gpt-4后只带入ID，名称/容量仍继承。重新读取会丢弃未保存草稿；再次加入并修改名称，保存后重读保持，剩余38个候选仍可选。恢复覆盖后用户覆盖为空、恢复按钮禁用、39个候选重新可选。
- 模型清单入口使用同一发现能力，带入候选名称和两类容量，保存重读一致。此时另一个单模型覆盖入口显示自定义清单限制且不能添加覆盖；恢复默认清单后，用户清单为空、恢复按钮禁用、单个覆盖重新可用。此处验证设置和候选目录，不等同无Key路由实际可用于聊天。
- [首轮只覆盖单模型路径](../../artifacts/model-discovery-overrides-only-android.json)和最终双入口报告均通过；最终11:06UTC报告包含两个不同采用分支。每轮临时路由均从手机移除；最终收权后手机设置拒绝访问、聊天与草稿保留，页面错误/HTTP资源失败为空。原用户提供方、Key、地址和绑定未改，未更换APK或产品代码。
- 只验证电脑内置目录（源码明确不发网络请求），自定义服务真实模型列表发现、原已有覆盖的合并、其他字段、并发写入和真实Key请求仍待验。网页转发保持暂缓、最终范围待确认；本项不替代完整R14–15验收。

## 官方模型清单的真实手机保存（2026-09-27）

- 状态：现有APK经真实网关/DSH通过名称保存、目录同步及恢复；完整Remote仍未完成。维护角色：项目协作Agent；核验2026-09-27。来源：[实际Android驱动](../../scripts/verify-official-models-android.mjs)、[保存报告](../../artifacts/official-models-run-android.json)、[收权报告](../../artifacts/official-models-blocked-android.json)。
- 实际入口为专用会话→Remote选项→电脑设置→编辑DeepSeek模型清单。原清单两行、无用户覆盖；仅临时修改第一行显示名称，保存后重新读取电脑，并在聊天模型选择器看到新名称。随后通过恢复默认移除本轮用户覆盖，逐项比较全部可见字段/继承状态，模型选择器恢复原名称且不再出现测试名称，草稿保持。
- 恢复前严格核对当前清单只包含本轮名称变化；如有其他修改则停止，避免覆盖并发设置。失败写入不自动重发，保存前留下不含凭据的恢复记录，可显式运行restore。实际测试走了默认继承恢复路径，原已有用户覆盖的恢复分支尚未实测。
- 最终报告时间11:00UTC，两次完整验证均通过；最后一轮包含并发变更保护。临时管理权限已经收回，手机重连后电脑设置拒绝访问、无设置输入，聊天与草稿保留。页面错误与HTTP资源失败均为空；没有模型请求、Key或地址修改，没有新绑定，也没有产品代码/安装包变更。
- 本项证明电脑配置保存/重读与手机聊天目录同步，未独立观察电脑浏览器选择器。不外推容量、输入类型、增删/空清单、双端同时编辑、模型发现/内置覆盖或真实Key调用；这些按R14–15继续。网页转发仍暂缓、最终范围待确认。

## 首次装配断线与取消恢复（2026-09-27）

- 状态：新版APK已安装；真实首次协商断线自动恢复、加载中主动取消已通过MuMu。完整Remote保持进行中。维护角色：项目协作Agent；核验2026-09-27。来源：[RemoteApp](../../src/RemoteApp.jsx)、[页面时序验收](../../scripts/verify-remote-app-recovery.mjs)、[Android验收](../../scripts/verify-remote-initial-recovery-android.mjs)、[真实字节代理](../../../backend/scripts/verify-device-output-proxy.mjs)。
- 根因：自动恢复错误地要求已有resume快照，第一次进入尚无聊天快照时不会重试；ready无条件清除stopped，又会覆盖主动断开/权限失效的终态。现从明确连接动作开始恢复意图，断线不依赖快照，主动断开/撤销后忽略迟到ready；旧装配失败不覆盖取消或撤销提示。权限仍由原binding.status及网关校验，没有伪造认证、自动重放消息或审批。
- [四项原页面失败](../../artifacts/remote-initial-recovery-before.json)与[取消提示失败](../../artifacts/remote-initial-cancel-before.json)已保留；[最终19项](../../artifacts/remote-initial-recovery-final.json)通过，包括首次断线/Host离线、取消/撤销后迟到ready、错误提示、既有重建/版本不兼容和通知导航。该脚本运行实际RemoteApp、隔离生命周期依赖，只证明界面时序，不冒充认证/真实网络。
- [旧APK真实失败](../../artifacts/remote-initial-android-before-drop.json)：原认证ready已放行，实际电脑返回的两条协商结果共5460字节被暂缓；页面尚在首次加载时断开连接，45秒没有自动进入Remote。[最终新版](../../artifacts/remote-initial-android-final.json)同样条件下自动进入，未点击重新连接；原在途请求以connection_closed_outcome_unknown终止并单列预期诊断，其他errors/resources为空。代理只延迟/丢弃原字节，不替换响应或记录凭据。
- [加载中取消实测](../../artifacts/remote-initial-android-cancel-final.json)：协商在途时通过真实连接菜单断开，恢复转发后保持断开，两秒观察期内无重连、无错误提示，errors/resources为空；迟到ready/撤销的交错另由页面时序回放覆盖。不是所有弱网、首次binding.status读取失败或撤销时刻都已实测。
- 两次驱动准备失败保留：[启动等待](../../artifacts/remote-initial-android-before.json)、[状态过早采样](../../artifacts/remote-initial-android-baseline.json)。驱动现使用既有启动flags、等待明确PID，并等待主页面加载状态，避免把通知连接先到的协商当成页面已就绪。浏览器构建、Android assembleDebug/lintDebug及3项代理字节回归通过。
- 收尾代理正常退出、ADB恢复8787直连。取消测试后的[首次收尾等待](../../artifacts/remote-initial-final-cleanup-entry.json)如实超时：用户主动断开应保持；执行一次明确重新连接后，[日常入口/原面板/两模块active/草稿](../../artifacts/remote-initial-restored-entry.json)通过且无错误。DSH32280/网关15224正常，日常设备active/management=false；无模型、Key、设备权限或电脑配置变更。
- 下一步回到电脑设置与模型管理剩余验收；更广连接异常仍按矩阵记录，不以本专项替代完整交付。网页转发暂缓、最终范围待确认。

## 网络载体与插件连接状态同步（2026-09-27）

- 状态：已修复并安装新版APK，MuMu中转服务及DSH分别重启的恢复专项通过；完整Remote/R13未关闭。维护角色：项目协作Agent；核验2026-09-27。来源：[连接组装](../../src/remote-core.mjs)、[原清单与真实连接回归](../../tests/remote-model.test.mjs)、[Android恢复驱动](../../scripts/verify-remote-carrier-recovery-android.mjs)。
- 原生closed/ready立即使RemoteTransport的协商能力失效，但原Connection此前等待事件流异步失败才撤回世代。旧inventory读取在此间隙失败，会被原清单当成当前失败发布。保留[旧世代失败](../../artifacts/remote-readiness-before.log)及[原清单同样错误的回放](../../artifacts/remote-readiness-inventory-before.log)；后者使用原inventory源码和受控读取结果，不冒充真实网络复现。
- 在手机连接组装处订阅真实载体变化，同步调用原Connection.reconnect，统一撤回旧世代、让插件自己的reset丢弃旧读取；作用域释放取消订阅。相比只在ui-cordis过滤错误，这个方案使连接状态一致，也保留真正的当前读取失败。没有统一排队/重试RPC，没有重放消息、审批或命令；不改电脑补丁、协议或鉴权。
- [101项模型/传输回归](../../artifacts/remote-readiness-regression.log)通过；增强回放去掉修复后出现原错误，恢复后[三个恢复专项](../../artifacts/remote-readiness-inventory-after.log)通过。覆盖closed同步撤代、无closed的新ready、旧清单失败失效、Host单独重启、草稿保留、不重放写入与订阅释放。浏览器构建及Android assembleDebug/lintDebug通过。首次Gradle缺SDK路径失败，随后进程内指定现有ANDROID_HOME成功，未修改全局配置。
- [新版日常入口](../../artifacts/remote-readiness-installed-entry.json)通过。首次恢复驱动误等空清单按钮（原CordisPanel在没有定义时返回null）；第二次在DSH面板恢复期间抢点背后的菜单超时，分别保留[准备失败](../../artifacts/remote-carrier-recovery-android.json)和[恢复时序失败](../../artifacts/remote-readiness-recovery.json)。驱动修正为验证实际面板并等待原布局恢复，不强制点击、不注入页面状态。
- [最终真实恢复报告](../../artifacts/remote-readiness-recovery-final.json)：分别结束/重启核验过身份的网关和DSH进程，手机观测离线后自动回到同一专用会话，原面板保持可用，草稿保留，errors/resources均为空。过程无模型请求、测试包安装或设备授权变更。此轮是无动态定义时的恢复专项，不能替代此前有动态包的审批/多端测试，也不保证所有首次进入与握手交错均已覆盖。
- 收尾DSH32280/网关15224运行，日常设备active/management=false；本机管理辅助脚本指向此次DSH启动日志，日志凭据不输出。其他R01–R16/A03–A06缺口继续；网页转发按带宽成本讨论暂缓，最终范围待确认。

## 动态清单同步安装与双端验收（2026-09-27）

- 状态：[清单同步补丁](../../../plugin/compatibility/cordis-inventory-sync/README.md)已安装，真实双端完整专项通过；完整R13/Remote未关闭。维护角色：项目协作Agent；核验2026-09-27。以下候选及早期失败章节为历史证据，以本节状态为准。
- 23文件预检、21文件改变；原生成器产生新增通知并仅合入该事件，旧完整反射/RPC codec保持。两个版本标识补齐显式类型以满足生成器。严格Host/Client构建、19项专项、91项原运行器、3项安装/恢复/反射检查、9项新反射RemoteAdapter回归、18项实际安装入口及3项代理字节测试通过。上游参考只读，无新APK或认证改动。
- [18:07整轮报告](../../artifacts/cordis-inventory-live-android.json)和[两端详情](../../artifacts/cordis-inventory-live-details.json)：两个独立App/UID/凭据通过真实网关/Host执行v2批准中旧拒绝、v3批准中重复批准，原结算拒绝到达测试端，Host保持同一client-pending请求/实例，放行另一端后running，v3实际回声成功。停止后移除，操作端及另一端旧行均消失，Host清单为空，两端草稿保持，errors/resources为空。
- 驱动用代理中实际放行给固定测试端的accepted=false计数，替代可能重新展开的弹层关闭观测；响应原字节不修改。[首轮准备失败](../../artifacts/cordis-inventory-daily-open-attempt.json)因日常App还在运行，未进入双端流程；现先停止日常App识别独立测试连接，再由驱动正常打开日常App。
- 最终临时设备已撤销，手机界面清理，重连401拒绝并移除本机绑定；测试包原CLI卸载，代理正常退出，ADB恢复8787直连。维护审计清理6条测试回执、newTurns=0、原消息保留；无模型或Key变更。
- 收尾DSH11408/网关3128运行，日常设备active/management=false。[18:08日常入口](../../artifacts/cordis-inventory-final-cleanup-entry.json)通过两模块active、原面板及草稿保留，无页面/资源错误。但[重启窗口首次进入](../../artifacts/cordis-inventory-restart-window-entry.json)捕获inventory读取remote_not_connected；稍后重入成功不代表该窗口已修复。下一步核验连接就绪和页面提前读取顺序；其他R01–R16/A03–A06缺口继续，网页转发暂缓、范围待确认。

## 动态清单同步候选修复（2026-09-27）

- 状态：候选代码已实现并通过构建及回归，**尚未安装，实际手机移除残留尚未证明修复**。维护角色：项目协作Agent；最近核验2026-09-27。依据：[候选说明与源码](../../../plugin/compatibility/cordis-inventory-sync/README.md)。
- 当前安装入口重新复现读取期间丢刷新、明确移除后旧读取重现行，两项失败；Host用例证实新定义/版本和删除缺少变更事件，四项失败。候选合并后续刷新、使移除之前的读取失效，并在注册表改变后通过原Remote事件白名单通知客户端；不增加轮询或伪造激活标识。
- 候选完整Host/Client严格类型检查、原浏览器构建、[19项专项](../../../plugin/artifacts/cordis-inventory-candidate-unit.log)、[91项原运行器](../../../plugin/artifacts/cordis-inventory-original-tests.log)及[9项接口](../../../plugin/artifacts/cordis-inventory-remote-tests.log)通过。原事件组装双订阅通过，不扩大为真实Gateway网络或手机验证。
- 另一轮实际双端失败证据保留为[整轮](../../artifacts/cordis-inventory-before-android.json)与[详情](../../artifacts/cordis-inventory-before-details.json)：v2竞争通过，v3在等待另一端审批弹层消失时超时；Host仍client-pending，手机又展示awaiting-approval，errors/resources为空。需核验原清单重读重新显示待审批与驱动观测条件，不将此超时认作新Host审批回归，也不宣称该轮移除流程执行过。
- 下一步：补齐兼容产物安装/恢复与生成元数据，再验证真实两端新增/版本/移除，以及本页旧读取和并发审批。R13和完整Remote继续，网页转发暂缓、范围待确认。
- 收尾：失效测试绑定已从独立App移除，测试包由原CLI卸载，代理正常退出，ADB恢复8787直连。DSH39048/网关3128正常；[17:54日常入口复验](../../artifacts/cordis-inventory-candidate-cleanup-entry.json)通过原面板、两模块active、草稿保留，errors/resources为空；日常设备active、management=false。当前安装仍是此前审批补丁，尚不含本节候选。88文档4490本地链接核验通过。

## 动态审批激活过程的并发修复（2026-09-27）

- 状态：电脑[增量补丁](../../../plugin/compatibility/cordis-approval-race/README.md)已安装，审批竞争子流程有真实Android证据；**完整双端脚本仍失败，未验收完成**。维护角色：项目协作Agent；核验2026-09-27。来源：[实际双端驱动](../../scripts/check-cordis-two-clients.mjs)、[Host源码变换](../../../plugin/compatibility/cordis-approval-race/changes.mjs)、[原Host回归](../../../plugin/compatibility/cordis-approval-race/core.test.mjs)。
- 原安装入口先复现：第一端启动后，第二端旧拒绝及启动被拒后上报的host-half-failed仍被原Host接受，消费第一端请求。[真实手机修复前](../../artifacts/cordis-approval-overlap-before-android.json)在client-pending期间点击另一端拒绝，Host变成rejected，当前包仍旧版、活动Host已是新版。首版候选保护结算后，又在[手机重复批准](../../artifacts/cordis-approval-overlap-first-patch-details.json)发现原runHostHalf的条件将requiresApproval=true的阶段检查跳过；对应[新增失败回归](../../../plugin/artifacts/cordis-approval-overlap-first-patch.log)保留。
- 最终补丁修正启动条件，并在消费审批前检查原尝试身份及阶段：人工审批只有awaiting-approval允许开始；启动后旧拒绝不生效，Host失败回执仅在实际failed状态结算。正常首次拒绝、真实Host/Client失败及原自动授权机制保持。四文件预检、三文件实际改变（源码与两个JS入口），原声明/生成接口不变；基于已安装inspect补丁，可独立恢复，不修改参考检出或APK。
- [9项新增及安装测试](../../../plugin/artifacts/cordis-approval-overlap-final-unit.log)、[91项原运行器测试](../../../plugin/artifacts/cordis-approval-overlap-original-tests-final.log)、[9项原生成RPC/RemoteAdapter测试](../../../plugin/artifacts/cordis-approval-overlap-remote-tests.log)、严格类型检查和3项字节代理回归通过。原测试缺Timer解析的首轮失败保留，随后从真实安装解析原Timer，未替换业务服务。实际最终安装入口另通过[7项回归](../../../plugin/artifacts/cordis-approval-overlap-installed-final.log)。
- [17:32完整脚本](../../artifacts/cordis-approval-overlap-android.json)与[细节](../../artifacts/cordis-approval-overlap-details.json)：真实两App均先显示待审批，暂停下行让日常端批准后的Host停留client-pending；独立端通过原按钮拒绝/重复批准，然后只恢复独立端下行，Host同一请求与运行保持client-pending。恢复另一端下行后，两次均正常running；最终v3回声调用成功。原鉴权/数据字节未替换，没有模型请求。
- 未解决项：停止后从日常端移除，电脑inventory为空，但脚本等待手机旧行消失超时，行仍idle。前一轮和加入任务聚焦后的轮次均出现；不能继续归因于后台暂停。当前报告还不能区分失败在操作端还是另一端；下一次驱动已分开阶段并捕获两端测试行。源码提示两个待核实方向：原inventory在已有读取时丢弃刷新触发；原undefine在插件已停止时不发dynamic-retract事件。尚未把推断写成根因，也未通过刷新页面掩盖问题。之前双端移除验收较窄，不能覆盖本次竞争后的状态。
- 所有尝试均finally撤销仅测试设备并释放维护门闩；最终清理6条测试回执、newTurns=0、原待办保留，errors/resources为空。最终[手机移除失效绑定](../../artifacts/cordis-approval-overlap-pair-forget-revoked-android.json)、停止独立包、恢复ADB8787直连、正常退出代理、[原CLI卸载临时包](../../artifacts/cordis-approval-overlap-uninstall.log)已完成。日常授权仍active/management=false。
- DSH40668/网关3128恢复；[17:36日常入口](../../artifacts/cordis-approval-overlap-cleanup-entry.json)通过原面板、两模块active、草稿保持及无错误检查。管理脚本默认日志为本次cleanup来源；后续重启仍需重新核验。R13与完整Remote保持进行中，网页转发暂缓、范围待确认。

## 双端动态审批的迟到操作（2026-09-27）

- 状态：同一MuMu的两个独立App/UID/凭据，经真实网关与DSH，验证状态延迟下的相反审批。维护角色：项目协作Agent；核验2026-09-27。来源：[双端驱动](../../scripts/check-cordis-two-clients.mjs)、[配对与收尾](../../scripts/verify-cordis-revocation-android.mjs)、[选择性暂缓代理](../../../backend/scripts/verify-device-output-proxy.mjs)。本轮修正测试操作顺序，没有更改生产逻辑或APK。
- [17:12实际报告](../../artifacts/cordis-approval-race-android.json)与[双端详情](../../artifacts/cordis-approval-race-details.json)：两端均显示同一待审批请求；用已观察到的固定Host回声锁定独立测试App主连接，仅暂缓该连接下行，另一端正常通信。日常端批准v2后，测试端仍看见旧按钮并点击拒绝，原Host返回不接受；恢复下行后两端收敛，pkg-2/run-2继续运行。随后日常端拒绝v3，测试端旧按钮点击批准，原Host拒绝过期请求，v3没有执行，v2回声成功且调用计数1。
- 两个方向分别暂缓10592/10630字节真实状态，脚本等待原Host的拒绝结果后才恢复转发，没有伪造RPC、修改响应或放宽鉴权。测试只覆盖一端已处理完成、另一端尚未收到状态的竞争；激活尚在进行时的同时批准/拒绝、其他工具审批及任意第三方副作用仍待验，不能外推为所有并发已解决。
- 前三次失败分别涉及冷启动进程等待、收起后等待状态和选择器。关键[第三次失败证据](../../artifacts/cordis-approval-race-closed-panel-attempt.json)显示Host已running，但驱动等待的select先disabled后detached。核对原[审批按钮逻辑](../../../deepseek-harness/packages/extensions/ui-cordis/src/client/CordisPanel.tsx)：动作完成会setOpen(false)，并非永久忙碌；现等待真实清单收起，再点击徽标重新打开并选择版本。成功轮自动完成所有系统任务切换，未强制点击或注入页面状态。
- 成功轮errors/resources为空，两端既有草稿保持；撤销测试设备后手机界面清理，显式重连401拒绝仅单列预期诊断。原维护审计清理6条测试回执、newTurns=0、原待办保留，无模型请求或Key变更。测试设备[失效绑定已移除](../../artifacts/cordis-approval-race-pair-forget-revoked-android.json)，独立包停止，ADB8787直连恢复，代理进程正常退出；电脑固定测试包[原CLI卸载](../../artifacts/cordis-approval-race-uninstall.log)。
- DSH60380/网关3128运行；[17:13日常入口复验](../../artifacts/cordis-approval-race-cleanup-entry.json)通过普通聊天进入Remote、原插件面板、两模块active及草稿保持，errors/resources为空，日常设备active/management=false。管理脚本默认来源更新至本次cleanup启动日志；后续重启须重新核验。
- 完整Remote保持进行中；R13仅补齐上述迟到竞争，其他缺口以完成矩阵为准。网页转发继续暂缓、范围待确认。

## 动态插件响应在途时撤销（2026-09-27）

- 状态：MuMu独立设备经真实Host调用和网关，在响应尚未到手机时撤销通过；沿用当前APK/生产代码。维护角色：项目协作Agent。来源：[在途验收模式](../../scripts/verify-cordis-revocation-android.mjs)、[真实字节暂缓代理](../../../backend/scripts/verify-device-output-proxy.mjs)、[WebSocket控制帧透传](../../../backend/scripts/held-websocket-frames.mjs)。本轮只扩展测试工具，不改变鉴权、协议、模型或动态插件实现。
- [16:51实际报告](../../artifacts/cordis-inflight-android.json)：独立测试App正常配对批准并打开专用会话，动态插件首次Host回声计数1。代理暂停设备下行后再次点击，原Gateway及dynamicCordisRunner.invoke返回的双层ok/value中确有固定回声、calls=2、failures=0；仅统计形状/数量，不输出用户响应或请求身份。捕获1条166字节完整响应，手机按钮计数仍为1，证明真实结果已生成但尚未呈现。
- 经原DSH认证接口撤销该测试设备，真实WebSocket关闭控制帧立即到手机，测试App会话与通知两条连接关闭。暂缓数据从166变为0、droppedBytes=166，页面和动态按钮卸载；恢复代理转发后显式重连仍401拒绝，旧界面没有重新出现。仅预期的`[Remote] http_401`单独记录，其余errors/resources为空。[实际拒绝截图](../../artifacts/cordis-inflight-rejected-android.png)已查看。电脑同一pkg-1/run-1仍运行，单设备撤销不误停共享Host。
- 这是“结果已经执行完成、响应还在链路中”的实测；不据此宣称撤销能回滚已经发生的Host副作用，或覆盖任意第三方插件。日常App测试期间force-stop，代理只服务独立测试App，日常凭据和授权未改；ADB临时映射只改变传输路径，原8787鉴权地址和真实网关保持。
- 结束后恢复ADB `tcp:8787 → tcp:8787`，测试代理正常退出；测试设备已撤销，手机[移除失效绑定](../../artifacts/cordis-inflight-pair-forget-revoked-android.json)后停止独立包。原维护任务定向清理1条测试回执，newTurns=0、原待办保留，无模型请求。电脑测试包已[原CLI卸载](../../artifacts/cordis-inflight-uninstall.log)，DSH40224/网关3128正常。
- [16:53日常App](../../artifacts/cordis-inflight-cleanup-entry.json)从普通聊天进入Remote、原插件面板和两模块active通过，草稿保持、errors/resources为空；日常设备active、management=false。管理辅助脚本默认日志更新为`artifacts/cordis-inflight-cleanup-dsh.stdout.log`，后续重启需核验新的实际来源。
- 3项代理控制帧/原字节/继续转发回归及脚本语法通过。本项补齐响应传输中的撤销隔离，多端同时审批/竞争、其他插件服务与安装形态和完整Remote矩阵仍继续。网页转发继续暂缓、范围待确认。

## 动态插件的双独立客户端同步（2026-09-27）

- 状态：同一MuMu上两个独立安装包、UID、设备凭据和WebView，经真实网关/DSH验证目录及运行状态同步；不冒充两台物理手机。维护角色：项目协作Agent。来源：[双端公开页面驱动](../../scripts/check-cordis-two-clients.mjs)、[配对与收尾驱动](../../scripts/verify-cordis-revocation-android.mjs)、原[状态推导](../../../deepseek-harness/packages/extensions/ui-cordis/src/client/status.ts)。沿用当前生产APK和电脑实现，没有产品代码变更。
- [16:43实际报告](../../artifacts/cordis-two-clients-android.json)与[两端详情](../../artifacts/cordis-two-clients-details.json)：独立测试App运行`pkg-1/run-1`并完成一次Host调用；日常App打开同一专用会话，目录显示Client待激活，尚未加载局部按钮。点击原运行按钮后仍为同一个Host实例，回声累计计数变成2。说明Host状态共享、每端局部界面独立激活，并非应当静默运行另一端客户端代码。
- 从日常App停止后，两端目录均idle、局部按钮均移除，原inventory无activeRun；从独立App重新运行得到run-2，日常目录同步显示Client待激活，新Host计数从1开始；随后从日常App移除，两端目录和局部按钮消失，原inventory为空。两端既有草稿值比较一致、errors/resources为空。没有补造非空草稿或覆盖不同草稿的并发竞争测试。
- [首轮后台点击失败](../../artifacts/cordis-two-clients-background-attempt.json)保留：共享实例和调用已通过，但Android暂停后台WebView导致Playwright等待元素稳定超时。脚本现在读取当前系统任务并用`am task focus`切换到真实App，再操作/观察页面，不强制点击、不注入状态或重载页面。通过轮截图时曾手动执行同一系统任务切换，截图前自动focus也已补入；[实际待激活截图](../../artifacts/cordis-two-clients-second-pending.png)已查看。该轮结果包含一次手动任务切换，不宣称完全无人干预执行。
- 成功轮沿原维护任务清理5条本轮回执，newTurns=0、原待办保留；失败轮同样清理2条，无模型请求。两次临时设备均撤销，最终[手机移除失效绑定](../../artifacts/cordis-two-clients-pair-forget-revoked-android.json)通过，独立包已停止。原CLI[卸载测试包](../../artifacts/cordis-two-clients-uninstall.log)，正常源码DSH恢复10196、网关3128保持；[16:45日常入口](../../artifacts/cordis-two-clients-cleanup-entry.json)验证原面板、两模块active、草稿和无错误。日常设备active、management=false，无Key或模型配置变更。
- 本机管理默认启动日志已更新至`artifacts/cordis-two-clients-cleanup-dsh.stdout.log`，新进程需先核验日志来源。入口脚本支持`DSHM_CORDIS_ARTIFACT`指定独立报告名，避免收尾覆盖旧专项报告。此前`cordis-lifetime-live-android.json`已被日常收尾覆盖，不能再作为07:00动态重启整轮报告使用；当时[审批/重启详情](../../artifacts/cordis-approval-details.json)、截图和独立收尾报告仍在，历史文字不是丢失原始报告的替代证据。
- R13仍有动态调用在途撤销、多端同时审批/竞争、其他第三方服务和安装形态等缺口。网页转发继续暂缓、范围待确认，完整Remote保持实施中。

## 运行中的动态插件设备撤销（2026-09-27）

- 状态：现有APK经MuMu、真实网关和DSH通过运行中设备撤销；本轮仅新增验收脚本，没有生产代码或APK变更。维护角色：项目协作Agent。来源：[独立设备验证](../../scripts/verify-cordis-revocation-android.mjs)、[实际配对入口](../../scripts/verify-remote-pair-valid-android.mjs)、[原本机管理接口](../../../plugin/src/management.ts)、[手机授权失效处理](../../src/RemoteApp.jsx)。
- 独立包`dev.dshmobile.validation.pairingtest`通过正常App链接领取新配对，未批准时无会话访问；核对新增设备名称、指纹和ID后，经原DSH已认证接口批准，不授予管理权限。手机打开既有专用联调会话，在原插件面板运行测试包，局部按钮真实调用Host回声，计数为1。
- [16:33最终报告](../../artifacts/cordis-revocation-android.json)：撤销该测试设备后，聊天页面与动态插件按钮卸载；显式重新连接被401拒绝，界面不能恢复。电脑原inventory仍保留同一个`pkg-1/run-1`活动实例，单台设备撤销没有误停共享Host插件；日常DSHM Android仍active、management=false。这里证明界面清理和访问拒绝，不扩大为插件调用在途回包、所有后台资源回收或双设备目录同步已完成。
- 首轮所有业务断言通过，但脚本错误地要求显式拒绝重连后也没有诊断日志，见[保留的首轮报告](../../artifacts/cordis-revocation-auth-log-attempt.json)。核对RemoteApp.report后，将唯一预期的`[Remote] http_401`单独记录；撤销前及其他控制台/页面错误仍要求为空，最终errors/resources为空。未屏蔽一般401或其他运行错误。[撤销后实际画面](../../artifacts/cordis-revocation-rejected-android.png)已查看。
- 两轮均沿原维护任务门闩避免回执唤醒模型，定向清理1条测试回执，newTurns=0、原待办保留。测试绑定均已撤销，最终通过手机移除失效绑定并停止独立包；[清理报告](../../artifacts/cordis-revocation-pair-forget-revoked-android.json)通过。临时电脑包0.0.8经[原CLI卸载](../../artifacts/cordis-revocation-uninstall.log)，普通源码服务恢复为DSH35448，网关3128保持。
- [16:34日常App收尾](../../artifacts/cordis-revocation-cleanup-entry.json)：普通聊天抽屉进入Remote、原插件面板和两个动态模块active通过，草稿保持、errors/resources为空。未改Key、模型地址或日常设备权限。本机管理辅助脚本默认启动日志更新为`artifacts/cordis-revocation-cleanup-dsh.stdout.log`；后续服务重启必须核验新日志，可通过`DSHM_DESKTOP_LOG`明确指定，不复用旧进程凭据。
- 当前R13仍保留动态调用在途撤销、双设备目录同步、更广第三方兼容等缺口。网页转发继续暂缓、范围待确认；用户提出中转带宽成本疑问，尚未把建议延期当作确认取消。

## 专用提供方的真实手机管理（2026-09-27）

- 状态：现有0.1.65配套App/插件/网关完成专用自定义提供方的Android新增、部分设置写入、重入读取与移除；完整模型设置验收仍在推进。维护角色：项目协作Agent；核验2026-09-27。来源：[真实手机脚本](../../scripts/verify-provider-management-android.mjs)、[16:19最终报告](../../artifacts/provider-management-run-android.json)、[实际截图](../../artifacts/provider-management-live-android.png)。本轮只更新验收工具与文档，未修改生产代码或重建APK。
- 不再把浏览器控制故障当作所有管理验收的阻塞：核对原[登录交换](../../../deepseek-harness/packages/client/connection/src/browser-auth.ts)和[桌面管理接口](../../../plugin/src/management.ts)后，通过固定127.0.0.1:3080与当前进程启动链接正常换取Cookie。凭据只留内存，不打印/保存；只请求原/api/dsh-mobile，不直接改数据库、授权记录或配置文件。辅助脚本为[本机管理连接](../../scripts/local-desktop-management.mjs)和[固定已授权设备核对](../../scripts/verify-desktop-management-access.mjs)，启动日志路径绑定本轮DSH27724，服务重启后需先核验新来源，不能盲用旧日志。沿用用户已授权的临时管理→验收后收回；这不冒充桌面设置页UI自动化。
- 手机通过真实设置页新建`dshm-management-check-1d3d9f23`，地址使用`.invalid`专用域名，不调用模型。请求超时45678ms、模型名、128K上下文、文字与图片输入、关闭思考能力保存后重读一致；提供方supportsStore=false与模型supportsStore=true各自保存并保持独立，随后恢复两层继承并核对空覆盖。地址先核对后取消仍为初始站点，再确认改为另一个专用站点，退出选择并重入后再次核对以上字段。
- 对本轮无Key路由，先取消启用确认、再确认建立独立引用，原生密码窗口核对该提供方标题后取消，状态保持“尚未配置”。没有输入、读取、保存或移除真实Key。最后通过手机移除仅本轮路由并核对目录不再包含它；[最终seed](../../artifacts/provider-management-live-seed.json)cleaned=true。
- [权限收回](../../artifacts/provider-live-withdraw.log)确认同一DSHM Android管理=false、聊天授权active；[16:20手机重连后拒绝管理](../../artifacts/provider-management-denied-final.json)management=false、ok=false是预期拒绝结果，不算测试失败。原聊天草稿保持，errors/resources为空。DSH27724与网关3128未重启，日常绑定保留。
- 失败证据保留：[权限变化后的正常断开](../../artifacts/provider-management-permission-reconnect-attempt.json)、[原生select的option并不单独可见](../../artifacts/provider-management-option-attempt.json)、[模型重读后详情折叠](../../artifacts/provider-management-folded-attempt.json)。脚本改为点击正常“重新连接”、等待目录option挂载，以及通过summary展开后核对字段，未改变生产权限/表单/断言值。前两条测试路由分别通过原手机移除流程清理，见[第一次清理](../../artifacts/provider-management-cleanup-first.log)、[第二次清理](../../artifacts/provider-management-cleanup-second.log)；每次尝试均在finally收回权限。
- 只覆盖一个自定义openai-completions路由及明确列出的字段，不能扩大为官方DeepSeek模型清单、内置modelOverrides、模型发现、全部26项兼容参数、实际Key填写/请求、OAuth或两端同时编辑已完成。动态运行器设备撤销与双端目录等仍待专项，但本机权限接口已可用于后续授权，不再笼统记为必须等待浏览器工具。网页转发暂缓、范围待确认。

## 分享副本复制时进程结束（2026-09-27）

- 状态：未完成分享副本的跨进程清理已修复，独立UID实际强停与重开通过；日常APK已安装，真实远端两种文件来源回归通过。维护角色：项目协作Agent；核验2026-09-27。来源：[分享快照实现](../../android/app/src/main/java/dev/dshmobile/validation/RemoteShareFiles.kt)、[原生中断夹具](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteShareDeathChecks.kt)、[实际进程驱动](../../scripts/verify-share-death-android.mjs)。
- [修改前](../../artifacts/share-death-before.json)：调用生产prepare复制512 KiB，在现有有效性回调的第二次检查暂停，此时磁盘确有65536字节。外部force-stop确认PID20447消失，从普通Launcher打开并通过抽屉进入Remote的新PID20495仍保留这份半成品。另一份完整快照保持原摘要。测试控制复制时序，不替换复制实现或伪造进程退出；未选择外部接收App。
- 现在先复制到FileProvider目录之外的`cache/preparing-remote-shares/<进程随机标识>-<操作UUID>`，校验完整字节及连接有效性、同步文件后，以同文件系统目录改名发布到原分享目录。初始化只清理旧进程的合法暂存子目录，同进程其他窗口正在复制的文件保留；完整快照沿用一小时的有效期与只读授权，不因App重开删除。旧版已混入分享目录的无标记文件无法可靠区分完整/半成品，仍沿原过期规则清理，不冒险删除。
- 选择分目录再发布，而非重开清空所有分享缓存：接收App可能晚于发送方恢复才读取完整副本，不能为清理半成品破坏已交付内容。仅给原目录增加时间判断同样无法区分刚写入的半成品，故没有采用。
- [16:08实际复验](../../artifacts/share-death-after.json)：PID20955→21004，部分字节与真实退出确认后，正常Remote入口清理65536字节半成品，完整524288字节快照SHA256保持`04c5772fa509d2ee0cd9aa04806ce8a3e59b5420a7b3b313f2804aa6c029b629`。FileProvider拒绝为暂存文件生成URI。最初候选使用分享目录名加后缀，实际FileProvider仍接受生成URI，改为不同前缀并保留[候选失败](../../artifacts/share-death-staging-prefix-attempt.json)；这不证明外部App曾取得权限或读到半成品。首次驱动直接启动非exported RemoteActivity被系统拒绝，改用真实Launcher/抽屉，保留[入口失败](../../artifacts/share-death-entry-attempt.json)。
- [原生专项](../../artifacts/share-death-native-checks.log)通过完整字节、同进程第二实例不删除在途文件、取消、只读Intent/Provider范围、容量和过期清理；[独立包构建与lint](../../artifacts/share-death-isolated-final-build.log)、[日常包构建与lint](../../artifacts/share-death-main-build.log)通过。未修改Web代码，没有重复构建Web产物。
- [16:09日常入口](../../artifacts/share-death-entry.json)从普通聊天进入Remote、原面板和两个动态模块active通过；[真实文件回归](../../artifacts/share-death-real-transfers.json)通过85字节历史附件、19字节工作区文件完整系统保存及摘要一致，两次系统分享打开后取消，没有选接收人。测试副本清理、原草稿保持、errors为空，暂存目录无文件；[实际分享截图](../../artifacts/file-transfers-attachment-android.png)已查看。电脑DSH27724/网关3128未重启，无模型、Key或设备权限变更。
- 本项不等同目标文件写入恢复、外部接收App读取中自身被结束、低内存回收或设备断电；大文件弱网、其他来源和完整R16异常保持待验。动态运行器设备撤销仍因电脑UI不可操作未验，本轮未进行权限修改；网页转发暂缓、范围待确认。

## 历史动态插件卡片的Android读取（2026-09-27）

- 状态：现有日常APK通过MuMu实际DSH持久记录、网关和手机自有聊天入口的历史卡片专项；不是重新执行已移除的旧工具。维护角色：项目协作Agent；核验2026-09-27。来源：[上游已提交快照](../../../deepseek-harness/snapshots/web/cordis-tool-round/session.v3.jsonl)、[定向导入夹具](../../tests/fixtures/live-cordis-history/index.js)、[Android驱动](../../scripts/verify-cordis-history-android.mjs)。
- 临时插件通过原parseSessionLog和sessionPersistence导入52条事件，登记到已有DSH-TEST工作区。只替换标识、时间和测试标题，工具调用/结果与原快照逐项相同并记录摘要；上游省略的system/tools占位保留为历史内容，不作为运行配置。原工具目录确认旧工具不存在、动态包snap-1未登记。见[Host导入报告](../../artifacts/cordis-history-host.json)。这是真实持久层与传输路径上的历史样例，不能称为本轮模型实际执行工具。
- [15:55香港时间实际报告](../../artifacts/cordis-history-android.json)通过：原define/run/stop卡片状态与结果、Client/Host源码切换、视口内边界、返回列表后重新读取、未挂载历史业务代码。源码卡片宽372.12px、视口420px；[截图](../../artifacts/cordis-history-android.png)已查看，源码区按现有默认外层缩放显示，未改原卡片内部。快照不含undefine；该卡片及运行中业务控件仍分别由先前浏览器回放/真实动态包专项提供证据，不扩大本项范围。
- 夹具初版将上游省略文本占位误判为未替换字段，未创建记录；修正后首次只写入记录而未登记工作区，已补原attachSession。冷列表无标题投影时显示工作区名；通过公开列表打开并核对完整测试标题后继续，没有绕过手机接口写状态。[冷标题失败](../../artifacts/cordis-history-cold-title-attempt.json)保留，不能据此宣称普通会话标题丢失。另[源码选择器失败](../../artifacts/cordis-history-source-selector-attempt.json)源于两个高亮片段同时匹配，改为核对整个tabpanel，没有放宽源码内容断言。
- 仅测试会话session-bf3971c3-cfb0-41b0-b8af-ce145a595c64已从手机归档，返回原联调聊天、空草稿保持，errors/resources为空。临时0.0.3插件已通过原CLI卸载，DSH27724与网关3128监听正常；[15:57日常入口收尾](../../artifacts/cordis-history-cleanup-entry.json)通过原面板、两个动态模块active与草稿保持，错误为空。没有模型请求、Key/设备权限修改或新APK。
- 本项补齐历史源码/结果卡片Android读取与重入，动态运行器实际撤销、双设备目录及完整R01–R16/A03–A06仍未完成。网页转发继续暂缓、范围待确认。

## 目标文件写入时进程结束（2026-09-27）

- 状态：保存结果恢复提示已实现，独立UID的真实Android进程结束验证通过；日常APK已安装，实际远端附件/工作区文件保存与分享回归通过。维护角色：项目协作Agent；核验2026-09-27。来源：[保存控制器](../../android/app/src/main/java/dev/dshmobile/validation/RemoteDownloads.kt)、[恢复记录与提示](../../android/app/src/main/java/dev/dshmobile/validation/RemoteSaveRecovery.kt)、[应用生命周期](../../android/app/src/main/java/dev/dshmobile/validation/DshmApplication.kt)。
- [修改前复现](../../artifacts/save-death-before.json)：实际控制器通过ContentResolver向受控DocumentsProvider保存512 KiB，首个4096字节到达目标后强制停止独立测试App，PID15399消失；普通Launcher启动新PID15484，半成品保留但没有提示。提供方只控制阻塞时序和私有测试目标，不冒充系统下载目录、云盘或真实网络失败。首次驱动误把pidof的正常“未找到”退出码当异常，[失败记录](../../artifacts/save-death-before-pid-probe.json)保留。
- 现在先将随机操作标记同步写入App的noBackup目录，再开始目标写入；正常结果结算后移除标记。只保存标记，不保存文件名、URI、字节或目标访问权限。新进程发现旧标记，在普通首页和Remote入口提示“上次文件保存结果未确认”；返回关闭不视为确认，只有“知道了”确认旧标记，不能清除本进程的新保存记录。不自动续传、重写或删除用户目标文件。
- 选择提示而非恢复后自动删除：进程可能在完整写入后、清除标记前退出，残留标记只能证明结果未确认，不能证明目标损坏。当前已捕获的正常写入失败仍沿用既有尽力删除行为；本项只改变跨进程未知结果处理。
- [修改后实际报告](../../artifacts/save-death-after.json)15:26香港时间通过PID15783→15855、首块4096/524288字节、普通首页提示、返回后进入真实Remote入口仍提示、未确认再次重启保留、确认后重启消失，目标字节数始终不变。[实际截图](../../artifacts/save-death-after.png)已查看。来源：[外部驱动](../../scripts/verify-save-death-android.mjs)、[进程结束夹具](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteSaveDeathChecks.kt)、[调试提供方](../../android/app/src/debug/java/dev/dshmobile/validation/RemoteSaveProbe.kt)。
- [原生写入回归](../../artifacts/save-death-native-writes.log)覆盖完整字节、取消/断线/关闭、提供方写入失败/删除拒绝、单次回执、标记清理，以及旧标记确认不清理新操作；[系统窗口生命周期回归](../../artifacts/save-death-native-picker.log)通过。[独立APK与lint](../../artifacts/save-death-isolated-build.log)、[测试包补充构建](../../artifacts/save-death-test-build.log)和[日常APK与lint](../../artifacts/save-death-main-build.log)通过。首次构建缺ANDROID_HOME，改为进程内显式指定SDK/JDK，未修改全局环境。
- 日常APK的[完整回归](../../artifacts/save-death-real-transfers.json)15:32香港时间通过：真实历史附件85字节、归档工作区文件19字节经系统保存后SHA256与源文件相同；两次系统分享只打开后取消，没有选择接收方。原聊天草稿保持、errors为空、本轮副本清理。最初ADB连接5037超时，留下分享窗口；后续脚本先被旧插件面板遮挡，再因原生分享窗口尚未关闭而等不到保存回调。[失败证据](../../artifacts/save-death-transfer-result-timeout.json)与[关闭窗口后实际保存完成](../../artifacts/save-death-state.json)保留，不当作生产保存故障或完整通过。驱动现在通过公开“返回聊天”按钮收起已有面板。
- 中断轮次的两个副本按精确名称、创建时段和源SHA256核对清理，见[第一份记录](../../artifacts/save-death-copy-cleanup-first.json)及[最终记录](../../artifacts/save-death-copy-cleanup.json)；第二份在分享窗口关闭后才完成写入，首次时间上界过早而拒绝删除，核对后以最终回归开始时刻为上界重验通过。最终日常App暂存与保存标记均为空，没有删除既有下载。
- 不据此声称全部R16完成：受控提供方的实际进程结束不等于任意云盘故障、后台低内存回收、系统断电或分享快照复制中断；其他来源/大文件弱网仍待验。日常App绑定、Key及管理权限未改，DSH/网关未重启，无模型请求。R12网页转发仍是范围待定，不移出原目标。

## 插件外层测量与历史分页（2026-09-27）

- 状态：修复已构建、安装并在MuMu真实入口验证；完整性能仍待优化。维护角色：项目协作Agent；核验2026-09-27。来源：[外层组件](../../src/ui/MobilePluginFrame.jsx)、[测量调度](../../src/plugin-frame-measurement.mjs)、[时序测试](../../tests/plugin-frame-measurement.test.mjs)、[集中挂载验证](../../scripts/verify-plugin-frame-scale.mjs)。
- 实际分页CPU采样定位到插件尺寸测量与React提交交错。200个独立插件的原组件复现产生[201次布局](../../artifacts/plugin-frame-before.json)；改为同窗口先读全部尺寸再批量提交后，[最终结果](../../artifacts/plugin-frame-final.json)为2次。外层等比例缩放、用户开关及点击坐标均保留，不改插件内部CSS，也不跳过插件渲染。
- 首个候选将首次测量也延到动画帧，导致真实历史第二页锚点偏移约8.93px，[失败证据](../../artifacts/history-longtask-after-20260927-android.json)保留。最终首次测量在React提交结束后的微任务批量完成，早于历史定位动画帧；后续ResizeObserver仍按帧合并，卸载取消未执行的测量。
- 最终APK于12:07香港时间通过[普通聊天→Remote→原面板入口](../../artifacts/plugin-frame-final-entry.json)，两个动态模块active，errors/resources为空。[真实四页](../../artifacts/history-longtask-final-20260927-android.json)到89条回复与会话起点，逐条原窗口保留，阅读偏差最大0.47px、草稿保持。相同无采样流程最长任务从[基线318ms](../../artifacts/history-longtask-baseline-20260927-android.json)到315ms，不能据此宣称整体性能显著改善；[另一次尺寸变化验证](../../artifacts/history-longtask-final-resize-20260927-android.json)内容/视口变化跟随及历史阅读通过，最长343ms，不与无尺寸变化流程混算。已查看最终分页截图。
- [403项Node测试](../../artifacts/plugin-frame-final-unit.log)、[完整原插件页面回归](../../artifacts/plugin-frame-final-slots.log)、[Web构建](../../artifacts/plugin-frame-final-build.log)、[APK构建与lint](../../artifacts/plugin-frame-final-android-build.log)通过。测试中的方法白名单枚举同步支持协议已有嵌套union，保留叶子方法校验与去重后精确集合比较；没有扩大生产权限。
- 本轮不调用模型、不更改Key/绑定/权限、不重启电脑服务。此项只证明重复布局减少且实际阅读位置正确；不是全部Remote、第三方插件或性能验收完成。电脑网页转发暂缓、范围待定。

## 自定义Agent模式实际选择（2026-09-27）

- 状态：MuMu正式Remote入口通过自定义模式目录、选择、电脑原投影核对和恢复。维护角色：项目协作Agent；核验2026-09-27。来源：[原预设规则](../../../deepseek-harness/packages/preset/agent-presets/README.zh.md)、[准备脚本](../../scripts/prepare-custom-agent.mjs)、[只读Host观察器](../../tests/fixtures/live-custom-agent-audit.mjs)、[Android脚本](../../scripts/verify-custom-agent-android.mjs)、[11:46实际报告](../../artifacts/custom-agent-android.json)与[截图](../../artifacts/custom-agent-android.png)。
- 临时启动补丁保留原预设配置、已有roots、随附和用户目录及默认值，只追加项目内测试目录。自定义模式使用实际安装版本的minimal组装文件，仅增加自己的名称与说明；没有改用户profile文件、默认模式或参考检出。完整合成配置只在内存解析，不打印或保存。
- 手机在已有DSH-TEST工作区新建专用空会话、改名，从自己的“Agent模式”窗口选择“DSHM 自定义模式验证”。原Host提交事件与sessionProjections.agentPreset均为dshm-custom-agent-verification；手机勾选、名称和说明一致。手机再选回标准模式，同一会话的原投影恢复standard。没有发送消息、执行工具或调用模型；不把本项扩大为自定义工具运行验证。
- 专用会话session-fcda14b4-70fc-409c-9713-431e329a0bd5已从手机归档，并返回原联调聊天，草稿保持、errors为空。随后恢复无overlay的DSH46520，网关3128保持；[日常入口复验](../../artifacts/custom-agent-cleanup-entry.json)和[模式目录收尾](../../artifacts/custom-agent-cleanup.json)通过，临时模式消失，观察器卸载。沿用0.1.65 APK，仅新增验收脚本，未改生产实现或管理授权。
- 首次测试启动把--patch放在应用参数--no-open之后，原CLI拒绝该选项，进程退出；按原args.ts确认启动器参数必须在前，修正后正常启动。保留[失败入口记录](../../artifacts/custom-agent-entry.json)与[重连期间取消日志记录](../../artifacts/custom-agent-ready-entry.json)，两者不算通过；最终独立专项及正常启动收尾通过。自动审核、跨端并发、损坏组装和完整R08异常仍待验收。

## 自定义权限预设实际选择（2026-09-27）

- 状态：MuMu正式Remote入口通过自定义名称读取、选择、Host原服务核对及恢复；自动审核仍未实际验收。维护角色：项目协作Agent；核验2026-09-27。来源：[准备脚本](../../scripts/prepare-custom-permission.mjs)、[只读Host观察器](../../tests/fixtures/live-permission-audit.mjs)、[手机脚本](../../scripts/verify-custom-permission-android.mjs)、[11:36报告](../../artifacts/custom-permission-android.json)、[截图](../../artifacts/custom-permission-android.png)。
- 原权限服务只从部署配置读取自定义表，没有任意registerPreset接口；原Include覆盖整个config，不能只传一项presets而丢弃现有配置。准备脚本在内存解析原CLI合成配置，仅保存已核验的permission字段；保留read-only/workspace-write/danger-full-access及默认值，附加dshm-verification-read-only（read-only + ask）。完整配置和CLI输出不落盘、不打印，读取/解析错误也不回显；未修改用户profile文件，临时overlay只用于本轮启动。
- 专用「DSHM Remote 联调提示」原权限为read-only。手机会话权限窗口实际显示“DSHM 自定义只读验证”和说明，选择后原permissionPresets.current/resolve分别读到该ID、read-only与ask，页面勾选及当前名称一致。随后从手机选回“仅可查看”，原Host确认恢复read-only + ask；草稿保持，errors为空。没有模型或工具调用，没有授予管理权限、完全访问或自动审核。
- 测试后恢复无overlay的正常DSH14732，网关3128保持；控制文件删除，[日常入口](../../artifacts/custom-permission-cleanup-entry.json)会话/插件/草稿通过，[目录收尾](../../artifacts/custom-permission-cleanup.json)确认自定义项消失且原仅可查看保留。临时只读观察器随进程退出释放；测试保留正常的权限选择记录，没有修改或伪造会话日志。沿用0.1.65配套APK，本轮仅增加验证脚本，不重复构建产品。
- 本项补足自定义权限预设这一实际路径，不等同自定义Agent预设、自动审核、跨端并发、不同权限组合或目录热更新已验收。

## 重启期间菜单关闭的实际排查（2026-09-27）

- 状态：两次真实DSH重启后自动恢复通过，本轮无生产修复。维护角色：项目协作Agent；核验2026-09-27。来源：[实际观察脚本](../../scripts/verify-menu-reconnect-android.mjs)、[第一轮](../../artifacts/menu-reconnect-first-android.json)、[第二轮](../../artifacts/menu-reconnect-android.json)、[运行时释放](../../src/remote-runtime.jsx)、[菜单局部状态](../../src/ui/RemoteWorkspace.jsx)。
- 起因是通知验收准备阶段[旧入口失败](../../artifacts/notice-process-entry-before-reload.json)：DSH重启后插件面板按钮从DOM移除，脚本仍等待同一菜单动作并超时，同时出现Cordis inventory/syncInspectManifest取消日志。仅此不能证明面板永久不可用，更不能据此要求用户重开App。
- 新脚本先打开真实菜单，外部核对进程身份后重启DSH，只旁观主页面DOM身份、离线提示、标题、编辑器和菜单。两次都观测到旧页面离线→页面重建→原会话恢复，原菜单关闭。恢复后通过正常Remote选项重新进入面板成功；草稿保持，performance.timeOrigin不变，证明没有刷新WebView或重开App。第一轮离线到恢复约14.1秒，第二轮约14.8秒，不作为所有网络条件下的时延保证。
- 排查假设依次为菜单重建导致旧选择器等待、会话引用永久未就绪、旧插件实例无法恢复。后两者在本场景的预测是重连后仍不能打开面板；两次实际操作均成功，支持第一种解释。原startRemoteRuntime会释放客户端树，RemoteWorkspace的sheet初始化为null，与DOM证据一致；没有增加固定等待来掩盖产品状态。
- 两轮pageerror为空，但consoleErrors均保留三条原Cordis断线取消/无活动Connection日志；没有屏蔽或改写日志，也不声称断线完全无错误输出。新脚本删除自身DOM观察引用并返回聊天；未改Key、配置、设备权限或调用模型。当前DSH70328、网关3128；测试没有安装额外插件，脚本语法检查通过。首次失败发生在安装插件后的重启，本轮两次验证未改变插件图，因此不能据此覆盖所有图更新竞争。

## 官方DeepSeek模型清单（2026-09-27）

- 状态：插件0.1.65、新网关及日常APK已安装；官方模型清单代码接入，实际授权保存待验。维护角色：项目协作Agent；核验2026-09-27。来源：[原DeepSeekModelsEditor](../../../deepseek-harness/packages/client/ui-settings-models/src/client/DeepSeekModelsEditor.tsx)、[原Config](../../../deepseek-harness/packages/llm/llm-deepseek/src/config.ts)、[Host](../../../plugin/src/provider-models.ts)、[手机共用编辑器](../../src/ui/RemoteProviderModelEditor.jsx)。
- 对照原版模型设置发现官方llm-deepseek清单没有接入，此前只有llm-pi-ai提供方清单。现从Remote选项→电脑设置打开“编辑 DeepSeek 模型清单”，支持ID、名称、上下文/输出容量、输入类型、增删及恢复默认。清空清单会变为无可选模型，与恢复默认不同。官方适配器没有pi-ai思考值映射/兼容表单，不显示或接受这些字段；原描述、图片限制等未编辑字段保留在电脑。
- 相比另写一套编辑器/快照状态，本实现复用ProviderModels及手机共用表单，由Host构造时固定namespace；官方操作独立命名且无provider/path字段，不能混入pi-ai同名deepseek路由。快照归属、原配置身份/revision、5分钟失效、一次消费和未知写入保护保持，网关和Host分别要求management。恢复默认沿原设置服务移除用户层models，不更改Key、地址或其他设置。
- [原Config/Host专项](../../../plugin/artifacts/deepseek-models-host-final.log)39项、[真实HTTP/WS/SQL及协议](../../../backend/artifacts/deepseek-models-gateway.log)7项、[手机控制器](../../artifacts/deepseek-models-client.log)4项通过。另[完整生产设置页面回放](../../artifacts/deepseek-models-ui-final.log)通过官方入口、容量/输入类型、恢复/空目录语义，以及既有其他提供方功能。375px[组件截图](../../artifacts/tests/provider-settings/official-models.png)已检查；该隔离页面未承载完整App主题，不代表真实管理写入。
- 初次Host测试把base配置写在错误的register选项位置，修正为原服务base选项后通过；初次页面测试把官方写入也统计为提供方标量写入，改为按固定操作计数后通过。测试中的false字面量类型已修正，最终插件/后端类型检查、三端构建及[Android lint](../../artifacts/deepseek-models-android-build.log)通过。失败日志保留，不以构建成功掩盖前序类型错误。
- 通过原CLI安装0.1.65并恢复DSH16280、网关3128；日常APK applicationId确认dev.dshmobile.validation后覆盖安装。11:10[实际入口](../../artifacts/deepseek-models-entry.json)会话/插件/草稿通过；[权限探测](../../artifacts/deepseek-models-permission.json)management=false、ok=false，仅证明未授权拒绝，不能算清单保存通过。没有模型调用、用户模型配置/Key/设备权限修改。实际官方模型保存/双端目录同步、OAuth及其他完整Remote缺口保持；localhost转发暂缓、范围待定。
- 11:17[后续实际探测](../../artifacts/remote-followup-management-probe.json)仍为management=false、ok=false，草稿保持、错误为空，没有执行写入。内置浏览器工具连接仍失败；Windows窗口清单只有Codex内置页面所在的ChatGPT窗口，没有独立DSH窗口，因此未执行桌面权限操作。已核对并同步三端README与完成矩阵，保留实际授权保存缺口。

## 工作区动态图实际播放（2026-09-27）

- 状态：现有日常APK在MuMu通过GIF与动态WebP实际播放，未修改产品代码。维护角色：项目协作Agent；核验2026-09-27。来源：[真实入口脚本的--animated分支](../../scripts/verify-image-formats-android.mjs)、[三帧夹具与截图像素读取](../../scripts/animated-image-fixture.py)、[13:22香港时间报告](../../artifacts/image-animated-android.json)。
- Pillow生成120×80、红/绿/蓝各300ms循环的独立GIF（609字节）和WebP（194字节），写入专用DSH-TEST子目录。经手机Remote → 插件面板 → 工作区文件树点击实际文件，Host读取及原文档图片组件保持生产路径，没有替换响应或调用模型。
- 两种格式均通过实际WebView图片截图取得三个不同颜色帧，中心RGB分别为230/25/25、25/230/25、25/25/230；不是只核对img节点、编码帧数或canvas首帧。自然尺寸均120×80，已查看[实际WebP预览截图](../../artifacts/image-animated-animated.webp-android.png)。关闭本轮标签并返回聊天，草稿保持、errors/resources为空；逐字节核对后只移除本轮独立测试文件与目录。
- 脚本语法检查通过。仅扩展验证，无APK重建、电脑设置/Key/绑定/权限变更。该证据覆盖工作区文件中的小型循环动态图，不涵盖历史附件来源、超大帧/内存压力、动画关闭后的底层解码资源释放或所有图片异常；R10–11保留这些缺口。

## 工作区图片格式真实预览（2026-09-27）

- 状态：现有0.1.64 App在MuMu真实文件树通过七种文件后缀、约4.7MB宽图/长图及损坏后重新读取；完整R10–11仍未完成。维护角色：项目协作Agent；最近核验2026-09-27。来源：[实际入口脚本](../../scripts/verify-image-formats-android.mjs)、[10:53香港时间格式报告](../../artifacts/image-formats-android.json)、[10:56尺寸与恢复报告](../../artifacts/image-boundaries-android.json)、原ImageBody及其文件类型注册。
- 在专用DSH-TEST工作区创建独立目录，通过手机Remote → 插件面板 → 文件树读取电脑文件。PNG、JPEG、JPG、WebP、BMP、ICO均解码为120×80，并检查红绿蓝三个位置的实际像素、长宽比例和视口内布局；静态GIF检查1×1尺寸及可见状态。测试图片是确定性夹具，但读取、转发、手机解码及原文档组件均为真实产品链路，没有替换Host响应。
- broken.png包含故意损坏字节，原预览显示“无法显示这张图片”，没有破图占位。已查看[WebP截图](../../artifacts/image-formats-sample.webp-android.png)及[损坏提示截图](../../artifacts/image-formats-broken.png-android.png)。关闭本轮文件标签、返回聊天后草稿保持，errors/resources为空；逐文件核对内容后清理独立目录。脚本语法检查通过；本轮无产品修改或APK重建。
- `--boundaries`专项通过2048×1024（4,726,175字节）和512×4096（4,733,548字节）PNG实际读取。宽图显示396.27×198.13，长图388.27×3106.13，分别保持2:1与1:8；原文档滚动区scrollWidth等于clientWidth，长图实际滚到底且误差小于1px。不是只用img存在判定成功，还检查自然尺寸、像素及实际视口边界。
- 同一标签中的损坏图片先显示错误，再仅替换本轮夹具文件并点击原“重新读取文件”。真实Host新字节恢复180×120蓝绿红测试图，错误清除、像素与新文件一致。已查看[宽图截图](../../artifacts/image-boundaries-wide.png-android.png)及[恢复截图](../../artifacts/image-boundaries-broken.png-android.png)。草稿保留，页面/资源错误为空，全部本轮文件核对后精确清理；未调用模型、改Key或设备权限，没有产品改动，不重复构建APK。
- 首次格式脚本误用全页标题选择器，匹配到两个标题，在创建文件前失败；[记录](../../artifacts/image-formats-initial-entry.json)保留。已限定remote-workspace后完成真实入口，不把首次失败记作产品问题。当前覆盖静态解码及上述尺寸/字节量，不涵盖动画GIF/WebP、多尺寸ICO、更大内存压力/弱网及所有附件来源。
- 10:51真实管理probe仍返回management=false，桌面浏览器工具再次连接失败，未执行管理写入或更改设备权限。原ReviewTab正向验收仍缺电脑可用快照，未为此伪造聊天记录或发送模型消息。localhost网站转发继续暂缓、范围待定。

## 相机权限复查与模拟器限制（2026-09-27）

- 状态：拒绝权限仍未验收；本轮修正旧测试判断并取得实际系统状态。维护角色：项目协作Agent；核验2026-09-27。来源：[新实机脚本](../../scripts/verify-camera-denial-android.mjs)、[旧扫码脚本](../../scripts/verify-remote-pair-scan-android.mjs)、[最终报告](../../artifacts/camera-denial-android.json)。
- MuMu API32的pm不支持set-permission-flags，实际返回Unknown command，旧脚本没有检查此输出。因此旧记录不能证明user-fixed标记生效。现移除该假设，检查revoke输出及granted=false基线；新脚本必须观测真实权限窗口/权限状态和App错误提示，不能将相机打开后取消当成拒绝通过。
- 在Android系统设置的独立pairingtest包中实际选择“不允许”，系统显示granted=false、USER_SET。点击生产扫码入口后无拒绝窗口，权限实际变为granted=true；10:40、10:41两轮均明确失败，最终报告ok未通过、restored=true，独立测试包已停止并恢复granted=false。首次未到扫码入口的超时另存[camera-denial-revoked-entry](../../artifacts/camera-denial-revoked-entry.json)；仅通过公开UI移除了该独立包已失效的旧绑定，日常App绑定未改。
- 使用当前Web/原生代码构建了[独立APK](../../artifacts/camera-denial-pairingtest.apk)，[构建](../../artifacts/camera-denial-build.log)通过，两个脚本语法检查通过。本轮没有修改产品代码，日常App沿用0.1.64；当前android默认输出路径已被独立包构建覆盖，日常安装前必须不带isolatedPairingTest重新构建并核验applicationId，不能直接误装该输出。
- 本机标准Android API36.1镜像可用，已在项目artifacts/camera-avd建立独立配置，未修改原Medium Phone AVD。无窗口启动30784被磁盘检查拒绝后终止，未出现emulator-5556；Q盘可用约2.05GB。启动日志为artifacts/camera-avd/emulator.stdout.log；该尝试不能计作标准Android测试。未下载新镜像或移动用户文件。
- [10:41日常MuMu回归](../../artifacts/camera-denial-daily-entry.json)实际Remote会话/插件面板、草稿保留通过，errors/resources为空；DSH63540及网关52908保持。另10:34[管理探测](../../artifacts/provider-management-probe-android.json)仍为management=false，尚未执行专用提供方写入。

## 提供方真实管理验收准备（2026-09-27）

- 12:46香港时间再次由当前APK实际probe核对，management=false、ok=false、草稿保持、errors/resources为空，见[最新只读报告](../../artifacts/provider-management-probe-android.json)。桌面浏览器控制仍返回nodeRepl.fetch连接失败；已请求用户执行此前授权的手动开启，并明确工具未恢复时需用户收回。尚未进行真实管理保存，不重建绑定或读取认证信息绕过授权。
- 验收脚本已补充专用提供方与单模型supportsStore分别保存/重读及恢复继承；模型写入后重读提供方快照再提交，避免旧revision。能力折叠选择器排除兼容设置，修复新增第二个details后出现的多匹配；原生窗口XML在finally删除。脚本语法与[生产设置组件隔离回归](../../artifacts/provider-management-preflight-ui.log)通过，但扩充后的run/cleanup尚未实际执行，不能算真实兼容参数验收。本轮无生产代码修改、未重建APK。
- 状态：脚本已准备，正向写入未执行。维护角色：项目协作Agent；核验2026-09-27。来源：[真实App脚本](../../scripts/verify-provider-management-android.mjs)、[最新只读探测](../../artifacts/provider-management-probe-android.json)。该报告路径每次probe覆盖，较早时间只保留本节文字记录。现有DSHM Android仍未获管理权限，报告management=false、ok=false，错误与资源失败为空，草稿保持；不得把探测退出码0解释为管理验收通过。
- 脚本提供probe/run/cleanup三个阶段。run仅创建自身唯一dshm-management-check路由，使用保留.invalid测试地址、不请求模型；计划覆盖新增、基本字段/模型能力/地址保存、重入读取、无引用Key启用、原生密码窗口取消及最终移除。实际Key写入不在此脚本范围，不能以原生窗口取消替代保存验收。
- seed只记录专用路由和创建/清理状态，不保存Key、鉴权信息或凭据引用。未知创建不重发；失败后保留未清理标记，必须用显式cleanup核对实际路由。没有seed或路由不匹配时不能删除，旧未清理测试阻止另开一轮。
- 已请求用户在电脑插件页执行此前允许的临时管理授权。这是浏览器控制工具连接失败导致的必要手动操作，不是重新征求授权；开启后继续run，结束须收回管理权限、保留原聊天授权。尚未得到开启反馈，未改设备权限、用户提供方或Key。
- 当前仅通过node语法检查及真实只读probe；run/cleanup尚未实测，不能记为新功能已验收。插件0.1.64、DSH63540与网关52908保持，本轮未构建/安装产品。

## 既有提供方启用API Key（2026-09-27）

- 状态：插件0.1.64、网关及APK已安装，实际Android授权启用及Key保存待验。维护角色：项目协作Agent；核验2026-09-27。来源：[原ProviderEditor](../../../deepseek-harness/packages/client/ui-settings-models/src/client/ProviderEditor.tsx)、[Host](../../../plugin/src/provider-settings.ts)、[手机页面](../../src/ui/RemoteProviderSettings.jsx)、[协议](../../../backend/packages/protocol/src/remote-provider-settings.ts)。
- 修复已有提供方没有apiKeyEnv时，手机只能显示Key状态不可用的缺口。原DSH会在填写Key时按路由派生引用，并不提供任意电脑凭据选择器；手机增加“启用 API Key”确认，为该路由建立独立随机引用，再显示既有原生密码窗口入口。已存在任何有效或不支持的引用时均不覆盖；用户层、基础层和其他提供方保持。
- 确认提示启用后改用单独Key，保存Key前可能无法聊天；取消启用零写入，启用后取消原生窗口保留已建立的配置。不把启用槽位描述为Key已保存。上方有未保存的基本设置时禁止启用，避免刷新吞掉草稿。语言切换保留确认，切换提供方或重新读取会清理旧确认。
- 复用设置读取快照、原SettingsProvider版本校验及管理权限，新增固定providerKeySetup操作，不接受手机指定的引用、值、headers或任意配置路径。启用和普通设置共用未知结果保护，重读/切换表单不能绕过。协议与原生固定方法名单配套更新。
- [原Host/真实适配器](../../../plugin/artifacts/provider-key-setup-host.log)39项、[HTTP/WS/SQL与协议](../../../backend/artifacts/provider-key-setup-gateway.log)4项、[手机控制器](../../artifacts/provider-key-setup-client.log)8项通过；[生产页面回放](../../artifacts/provider-key-setup-components.json)覆盖取消、脏设置、语言、确认及原生窗口委托。[截图](../../artifacts/tests/provider-settings/key-setup-confirm.png)已查看，但隔离响应/简化样式不等于实际手机授权保存。插件/网关类型检查及构建、Web与[Android构建/lint](../../artifacts/provider-key-setup-android-build.log)通过。
- 当前实际DSH63540、网关52908；真实手机入口与授权缺口见本轮[会话面板报告](../../artifacts/provider-key-setup-entry.json)和[无管理授权拒绝](../../artifacts/provider-key-setup-denied.json)。未更换用户Key、提供方配置或设备权限，没有模型请求；桌面管理验证仍受浏览器控制工具不可用影响。此项不代表任意凭据引用管理或OAuth已实现。

## 新增模型提供方（2026-09-27）

- 状态：插件0.1.63、网关和新版APK已安装；真实Android授权新增仍待验证。维护角色：项目协作Agent；核验2026-09-27。来源：[Host](../../../plugin/src/provider-creation.ts)、[协议](../../../backend/packages/protocol/src/remote-provider-creation.ts)、[手机控制器](../../src/remote-settings.mjs)、[创建页面](../../src/ui/RemoteProviderCreation.jsx)。
- 入口为“电脑设置 → 其他模型提供方 → 新增模型提供方”，支持启用电脑声明的内置提供方，或新增自定义路由、协议、地址和模型ID。协议来自原设置schema；已有路由及注册目录禁止覆盖。核对服务目的地后才保存，修改草稿会清除旧确认，取消不写入。原SettingsProvider继续执行版本和业务校验，管理权限由网关及Host分别检查。
- 创建和填写Key是两步：选择使用Key时由电脑生成独立随机凭据引用，随后使用既有原生密码窗口；手机不能指定凭据引用，也不接收旧Key。不同于原页面按路由派生引用，这里避免新路由隐式复用电脑同名旧凭据。不使用Key时保留原提供方默认认证语义。取消后续Key窗口不会撤销已保存的提供方。
- [原Host/适配器](../../../plugin/artifacts/provider-creation-adapter.log)35项、[真实HTTP/WS/SQL权限及协议](../../../backend/artifacts/provider-creation-gateway.log)3项、[手机控制器](../../artifacts/provider-creation-client.log)6项通过。[组件回放](../../artifacts/provider-creation-components.json)验证两种创建、目的地确认、取消零写、语言切换、原生Key委托与目录刷新；375px表单不溢出，[截图](../../artifacts/tests/provider-settings/creation-confirm.png)已查看。回放采用隔离响应与简化页面样式，不等于完整App视觉或真实写入验收。
- 测试修正两处夹具：目录服务需要保持实例身份，否则真实换代保护会拒绝确认；Office取消替身需要处理注册监听前已经中止的信号。未为测试放宽产品检查。Web、插件构建/类型检查及[Android构建/lint](../../artifacts/provider-creation-android-build.log)通过。
- 实际原CLI安装后DSH37004监听3080、网关23344监听8787；MuMu于10:11香港时间通过[真实会话/原插件面板](../../artifacts/provider-creation-entry.json)及[无管理权限拒绝](../../artifacts/provider-creation-denied.json)，errors/resources为空且草稿保留。没有修改用户提供方、Key、权限或发送模型请求。桌面浏览器工具仍返回连接失败，实际授权新增、电脑目录同步及后续Key保存未验；凭据引用管理、OAuth和完整R14继续实施。

## 移除已有模型提供方（2026-09-27）

- 状态：插件0.1.62、新网关和APK已安装；原Host与手机组件通过，真实Android授权移除尚未验证。维护角色：项目协作Agent；核验2026-09-27。来源：[Host](../../../plugin/src/provider-removal.ts)、[协议](../../../backend/packages/protocol/src/remote-provider-removal.ts)、[手机控制器](../../src/remote-settings.mjs)、[确认页](../../src/ui/RemoteProviderRemoval.jsx)。
- 入口为“电脑设置 → 其他模型提供方 → 选择提供方 → 移除提供方”。先读取电脑当前名称、基础层归属及一次性快照，明确确认后沿原SettingsProvider删除单个用户路由；不能删除基础配置中的路由。确认绑定设备连接、路由、原设置服务、配置对象、revision和五分钟有效期，网关及Host同时要求management。旧确认、重复提交、配置变化与撤销不能继续写入；未知结果不自动重发。
- 与原ModelsSection删除流程比较：原页面会先删除按路由派生且可写的Key，再移除配置。Remote此入口只移除配置，不删除独立凭据，确认页明确告知Key保留，避免影响共用引用；现有原生Key入口仍单独负责凭据移除。它不开放任意settings路径、凭据名称或通用credentials接口。已有聊天记录保留，提供方新建/凭据引用/OAuth仍未接入。
- [Host专项](../../../plugin/tests/provider-removal.test.ts)使用原SettingsProvider；[适配器报告](../../../plugin/artifacts/provider-removal-adapter.log)34项通过，含真实RemoteAdapter读/删、管理与连接隔离、重复拒绝。另[原设置回归](../../../plugin/artifacts/provider-removal-unit.log)9项通过。[HTTP/WebSocket/SQL管理权限与协议](../../../backend/artifacts/provider-removal-gateway.log)3项通过；[手机控制器](../../artifacts/provider-removal-client.log)7项通过。隔离配置不等于真实电脑删除。
- [生产设置入口回放](../../artifacts/provider-settings-components.json)通过取消零写、切换清理确认、基础配置保护、语言切换、移除后列表刷新及375px布局；[脚本](../../scripts/verify-provider-settings.mjs)使用显式隔离响应，已补上此前遗漏的编译组件CSS加载。[确认截图](../../artifacts/tests/provider-settings/removal-confirm.png)已查看。三端构建、类型检查及[Android lint](../../artifacts/provider-removal-android-build.log)通过。
- 实际通过原CLI安装0.1.62，恢复DSH25944（3080）及网关69760（8787），APK覆盖安装保留数据。[09:49:04香港时间实际入口](../../artifacts/provider-removal-entry.json)读取原专用会话/插件面板、保留草稿通过；[09:49:26未授权入口](../../artifacts/provider-removal-denied.json)正确拒绝电脑设置，errors/resources为空。未删除用户提供方/Key、未发模型请求、未改设备授权。桌面浏览器控制仍不可用，真实授权删除/电脑模型目录同步留待验收；不能将上述入口回归替代该正向场景。

## HTML文件预览失败与重试（2026-09-27）

- 状态：新版APK已安装，真实工作区网页文件的依赖恢复通过。维护角色：项目协作Agent；核验日期2026-09-27。来源：[原文档注册](../../src/remote-document-previews.jsx)、[共用HTML预览](../../src/ui/RemoteHtmlPreview.jsx)、[旧版回退入口](../../src/ui/RemoteFilePreview.jsx)。
- HtmlDocument 的读取Promise拒绝原本被空回调吞掉，界面永久保留加载状态。现使用既有fileError生成用户提示，失败显示重试；已返回的固定提示在显示时翻译。主动取消/旧revision响应继续忽略。依赖打包失败也提供重试，由父入口重新读取文件；原标签调用content.reload，旧入口沿原revision更新，未添加自动请求循环。文件读取、版本核验、HTML打包与沙箱边界保持。
- [修复前回放](../../artifacts/html-read-before.log)通过生产注册和原文件标签注入明确隔离的读取拒绝，复现加载不结束。[最终回放](../../artifacts/html-read-final-web-2.log)覆盖错误可见、显式重试、上一读取中止后迟到异常不覆盖新结果，以及旧版文件入口依赖失败重试；响应夹具不是实际电脑断线证据。[测试入口](../../scripts/check-attachment-documents.mjs)继续覆盖同名附件隔离、三种原文档读取模式和卸载回退。
- [09:23:04香港时间MuMu报告](../../artifacts/html-retry-android.json)经普通聊天→Remote专用会话→原插件文件树打开新建专用HTML文件。缺失ready.js时无iframe，补回后点击错误页“重试”得到实际脚本文字；沙箱origin为null，两种原生桥均undefined。草稿保持，errors/resources为空；[恢复截图](../../artifacts/html-retry-success-android.png)已检查。临时文件内容核对后精确清理，未改用户文件、Key、电脑配置或设备权限，无模型请求。脚本[verify-html-retry-android](../../scripts/verify-html-retry-android.mjs)保留实际操作路径。
- [HTML/字节读取专项5项](../../artifacts/html-read-unit.log)、[完整原插件页面回归](../../artifacts/html-read-panels.log)、[Web构建](../../artifacts/html-read-build.log)、[APK构建与lint](../../artifacts/html-read-android-build.log)通过。拒绝/迟到异常和旧版入口是组件回放，真实手机覆盖当前工作区依赖恢复，不能泛化为全部断线或附件异常已验收。
- 本轮处理已有文件预览，不增加localhost站点代理。R12继续暂缓、范围待定；管理保存受浏览器控制故障影响，其余完整Remote仍未完成。

## Office失败提示即时切换语言（2026-09-27）

新版APK已安装。真实历史损坏附件先复现英文显示内部错误码，修复后同页中英文提示切换通过；正常docx原PDF预览、画布及草稿保持。9项Office测试、原插件页面回归、Web/APK构建和lint通过，详见[实现、实际证据与边界](./appearance-current.md#office预览失败提示2026-09-27)。没有电脑配置或权限变更，无模型请求。真实管理保存仍受浏览器控制故障影响，完整Remote继续；网页转发暂缓、范围待定。

## 已有提供方模型发现（2026-09-27）

- 状态：插件0.1.61、新网关与最终APK已安装；实际手机管理授权后的模型发现尚未验收。维护角色：项目协作Agent，核验2026-09-27。来源：[协议](../../../backend/packages/protocol/src/remote-model-discovery.ts)、[Host](../../../plugin/src/provider-model-discovery.ts)、[手机控制器](../../src/remote-settings.mjs)、[共享编辑器](../../src/ui/RemoteProviderModelEditor.jsx)及[权限边界](../../../docs/project-knowledge/knowledge/domains/remote-access/settings-boundary.md#已有提供方模型发现2026-09-27)。
- 已有提供方模型清单/覆盖编辑器增加“获取可用模型”，选择加入草稿，点击保存才修改电脑设置。原LlmRuntime负责发现：内置提供方取本机目录，自定义提供方使用电脑保存的地址、协议、认证和headers。相比开放原任意URL/Key请求，本次只开放固定管理操作和路由；不读取用户Key，不向手机返回认证信息，不实现新的模型服务代理。
- 候选读取不使未保存编辑快照失效；同ID不重复加入，清单带入公开容量/输入类型，覆盖只加入ID并继承目录默认值。退出/断线/撤权/配置和服务变化拒绝迟到结果；错误脱敏、20秒请求限制、原版本校验与未知写入保护保持。旧Host不显示入口。
- [原服务测试](../../../plugin/tests/provider-model-discovery.test.ts)采用真实LlmRuntime、只读上游pi-ai代码、本机HTTP和显式测试凭据；验证列表认证/headers、内置目录不联网且不解析凭据、配置不变。初次断言漏掉原服务默认name=id，已修正预期，[失败记录](../../../plugin/artifacts/model-discovery-host-tests.log)保留。Host实际路由和独立管理拒绝、网关HTTP/WS权限及严格请求字段通过。插件153、后端72（另1项PostgreSQL跳过）、手机390项、类型检查、完整插件页面回归、Web/APK构建及lint通过。
- [生产设置页隔离回放](../../artifacts/model-discovery-ui-final.log)通过候选选择、只加入草稿、同ID排除、清单与覆盖继承和显式保存。截图发现勾选框被全宽input样式挤压名称，已固定18px并补几何断言，最终[候选截图](../../artifacts/tests/provider-settings/model-discovery.png)已检查。该组件夹具不含完整App主题，不代表真实电脑保存。
- [最终MuMu入口](../../artifacts/model-discovery-entry-final.json)从普通聊天进入真实Remote专用会话、原面板和清单通过，两个动态模块active、草稿保持、errors/resources为空；[原管理入口拒绝](../../artifacts/model-discovery-denied.json)通过。DSH38236、网关45812恢复，没有模型生成请求、Key/用户模型配置/绑定/权限修改。内置浏览器仍nodeRepl.fetch失败，未临时授予管理权限，实际Android发现和保存仍待验收。
- 提供方创建/移除、认证引用管理、真实管理写入及其余完整Remote继续；网页转发暂缓、范围待定。

## 历史轮次导航增量更新（2026-09-27）

- 状态：手机派生实现已构建并安装，新版MuMu真实分页通过；完整性能仍未完成。维护角色：项目协作Agent，核验2026-09-27。来源：[构建适配](../../scripts/remote-conversation-sources.mjs)、[原投影对照测试](../../tests/remote-navigation-incremental.test.mjs)、[实际分页脚本](../../scripts/verify-remote-pagination-android.mjs)。上游参考检出保持只读，电脑插件仍0.1.60，不涉及网关或认证变更。
- CPU采样发现结构更新会重复推导所有历史轮次导航。相较裁剪挂载历史，本次保留完整消息和原插件，只复用未变轮次的导航：同时核对变更节点所属的旧/新轮次与成员数组身份；整页replace完整重算，内容更新、位置/类型/可见性变化、跨轮次移动及时间线增删不跳过。缓存随当前导航替换，不跨会话共享。
- 正式ChatSnapshotBuilder测试先复现“新增第201轮却重算201轮”，见[失败记录](../../artifacts/history-projection-20260927-red.log)；修改后仅1轮，仅改变时间线顺序时无需重新推导。逐步与只读上游原实现比较导航、顺序、位置索引、节点和legacy输出，覆盖问题/回复更新、隐藏/恢复、插件节点类型、跨轮次移动、整页替换及120步组合变化，见[专项通过](../../artifacts/history-projection-20260927-final-unit.log)。388项Node、完整插件页面回归、Web/APK构建与Android lint通过。
- 桌面Edge 375×667千轮5000事件：[本轮基线](../../artifacts/history-projection-20260927-before.json)6.48秒/最长203ms，两个无采样候选分别[5.81秒/188ms](../../artifacts/history-projection-20260927-after.json)、[6.21秒/186ms](../../artifacts/history-projection-20260927-after2.json)。主页面/工厂/滚动均50次，输入不重画旧回复，历史位置保持。[旁栏200轮](../../artifacts/history-projection-20260927-sidebar.json)约650ms、20次刷新，完整消息、草稿和尺寸跟随通过。不是MuMu千轮或整体性能达标结论；[候选CPU采样](../../artifacts/history-projection-20260927-after.cpuprofile)与Node测试并行运行，其8.02秒计时不能用于与无采样基线比较。
- 08:37香港时间[新版实际入口](../../artifacts/history-projection-20260927-entry.json)从普通聊天进入Remote专用会话、原面板和插件清单，两个动态模块active，草稿保持，errors/resources为空。08:39[真实分页](../../artifacts/history-projection-20260927-pagination-final-android.json)四页到89条回复，旧回复窗口逐条保留，最大阅读偏差0.47px，尺寸扰动及草稿检查通过；[截图](../../artifacts/history-projection-20260927-pagination-final-android.png)已检查。现场最大长任务332ms，仍需优化，不能称全部性能通过。
- 首次分页脚本只等待两帧便测到离底27.93px，随后只读观察已回到尾部-0.33px，见[失败记录](../../artifacts/history-projection-20260927-pagination-early-failure.json)。原插件异步挂载和ResizeObserver/rAF不保证两帧内结束；脚本改为保留最早采样、最多1秒等待同一4px条件，无滚动注入、无放宽距离。生产滚动代码未修改。
- 本轮没有模型请求、电脑服务重启、Key/配置/绑定/权限修改。完整Remote目标保持，实际管理写入、其余插件/通知/语言与性能缺口继续；网页转发暂缓、范围待定。

## 内置模型逐项覆盖（2026-09-27）

- 状态：插件0.1.60、新网关和APK已安装；管理保存的真实Android验收仍待补齐。维护角色：项目协作Agent，核验2026-09-27。来源：[原目录解析](../../../deepseek-harness/packages/llm/llm-pi-ai/src/catalog.ts)、[协议](../../../backend/packages/protocol/src/remote-provider-models.ts)、[Host](../../../plugin/src/provider-models.ts)、[共享编辑器](../../src/ui/RemoteProviderModelEditor.jsx)与[原服务测试](../../../plugin/tests/provider-model-overrides.test.ts)。
- 已有提供方增加“编辑内置模型覆盖”。只调整指定内置模型，保留目录其他模型；自定义模型清单与覆盖不能并用，手机明确提示，原pi-ai仍负责最终校验模型ID和协议选项。复用同一模型字段/能力/兼容编辑器及固定模型通道，以scope=overrides隔离；相较另建整套编辑器，避免两套模型字段维护。需Host公布providerModelOverrides，旧版本不能被误当作覆盖响应。
- 只编辑用户层modelOverrides，不把基础层物化成用户设置。清单/覆盖分别保存快照、校验响应scope；写入先unset旧用户字典再set新字典，在同一次版本校验/持久化内完成，防止删除行或字段后残留。移除覆盖恢复电脑基础配置，单个模型ID只作为字典键，不写入值；未知字段保留，原型键及控制字符拒绝。管理权限、连接/路由/配置身份和未知结果锁定保持。
- 原SettingsProvider、pi-ai内置真实目录与解析测试证明两模型修改后完整目录数量不变、用户覆盖移除恢复基础名称、Key/未来字段保留；未知模型/自定义清单冲突不部分持久化，跨设备/清单scope拒绝。首轮测试误把原models数组当Map，修正测试读取后通过，失败日志保留，没有为测试改生产返回。Host真实路由正向/管理拒绝、网关HTTP/WS权限通过。插件151项、后端71项（另1项独立PostgreSQL跳过）、手机386项、类型检查、完整插件页面回归、Web/APK/lint通过。
- [生产设置页隔离回放](../../artifacts/model-overrides-components.log)通过清单冲突禁用、覆盖独立提交、容量/兼容编辑、语言草稿保持、移除和恢复默认；原清单未被覆盖请求修改，375px无溢出。[截图](../../artifacts/tests/provider-settings/catalog-overrides.png)仅是组件夹具。真实模型目录的解析证据来自原服务测试，隔离UI应答不冒充真实电脑保存。
- 新版[MuMu实际入口](../../artifacts/model-overrides-live-entry.json)由普通聊天进入真实Remote专用会话、原面板/清单通过，两个动态模块active、草稿保持、errors/resources为空；[管理拒绝](../../artifacts/model-overrides-denied.json)通过。DSH34160、网关73552已恢复，没有新模型请求或Key、用户模型配置、绑定、权限修改。真实手机管理写入、模型发现、提供方创建/移除与认证引用等继续，完整Remote未完成；网页转发仍暂缓、范围待定。


## 提供方默认兼容设置（2026-09-27）

- 状态：提供方共用兼容配置已接入，插件0.1.59、新网关及APK已安装。维护角色：项目协作Agent；核验日期2026-09-27。来源：[原Config说明](../../../deepseek-harness/packages/llm/llm-pi-ai/src/config.ts)、[协议](../../../backend/packages/protocol/src/remote-provider-settings.ts)、[Host](../../../plugin/src/provider-settings.ts)、[手机设置入口](../../src/ui/RemoteProviderSettings.jsx)和[共享表单](../../src/ui/RemoteModelCompat.jsx)。
- 相比新增独立设置RPC，本次扩展原固定提供方通道，复用管理权限、快照、草稿/未确认写入保护；UI直接使用模型兼容组件。共26项，提供方为共同默认、单个模型逐字段优先。读取分开有效值与用户覆盖；省略compat不改，显式对象逐字段set/unset用户层，{}恢复基础继承。未知未来字段、Key、其他提供方和模型覆盖不动。协议/模板严格校验与原pi-ai适用性检查均保留。
- [原设置测试](../../../plugin/tests/provider-settings.test.ts)通过false保存、模板变量、恢复基础true、模型false覆盖保留、原协议拒绝不持久化及未来字段保留。[Host真实路由](../../../plugin/tests/remote-adapter.test.ts)通过管理写入/拒绝；[网关HTTP/WS权限](../../../backend/tests/remote-permissions.test.ts)覆盖新增请求形态。插件149项、后端70项（另1项独立PostgreSQL跳过）、手机384项通过；类型检查、完整原插件页面回归、Web/APK构建和Android lint通过。追加Host正向测试后专项30项复验通过。
- [生产设置组件回放](../../artifacts/route-compat-components.log)使用明确隔离响应，覆盖非法JSON不发送且保留草稿、false与模板变量、语言切换、空标量修改、恢复按钮不提前提交，以及旧有模型编辑、路由切换/迟到响应/断线/撤权。375px无横向溢出。[截图](../../artifacts/tests/provider-settings/provider-compat.png)仅是组件夹具，不冒充正式App视觉或真实电脑保存。
- [实际MuMu入口](../../artifacts/route-compat-live-entry.json)通过新版App从普通聊天进入真实Remote专用会话、原插件面板及清单，草稿保持且errors/resources为空；管理拒绝结果见[报告](../../artifacts/route-compat-denied.json)。DSH37996、网关49208已恢复，未发送模型请求或修改Key、用户模型配置、绑定和权限。内置浏览器仍nodeRepl.fetch失败，真实Android管理保存仍待验；modelOverrides、提供方创建/移除/认证引用及完整R14/Remote继续。网页转发保持暂缓和范围待定。


## 模型协议兼容配置（2026-09-27）

- 状态：插件0.1.58、新网关与APK已安装加载；真实Android管理保存待验。维护角色：项目协作Agent，核验2026-09-27。来源：[原配置及校验](../../../deepseek-harness/packages/llm/llm-pi-ai/src/config.ts)、[原协议适用范围](../../../deepseek-harness/packages/llm/llm-pi-ai/src/catalog.ts)、[固定兼容协议](../../../backend/packages/protocol/src/remote-model-compat.ts)、[Host合并](../../../plugin/src/provider-models.ts)、[手机表单](../../src/ui/RemoteModelCompat.jsx)。
- 显式模型清单中的行可展开协议兼容配置：19个布尔开关、4项枚举、整数优先级及2项模板字典，共26项。开关/下拉/数值使用普通控件；模板按服务文档填写JSON对象，只支持字符串、有限数、布尔、null及三个thinking变量对象。手机保留模板草稿，语法错误不发到电脑。原pi-ai拒绝模型当前协议不支持的字段，不以保存成功代替模型请求实测。
- 相比开放任意配置JSON，本次固定键和类型投影；未知字段、嵌套任意对象、未知变量及原型相关键拒绝。模板最多100项，键最多256字符、字符串值最多4096字符。原始特殊键在z.record前检查，避免被静默丢弃。管理权限、原版本和设备/路由快照沿用；不开放headers、Key或通用设置路径。
- row.compat缺省保留原值，显式对象替换已公开的兼容字段，{}恢复其继承，未知未来字段仍在Host保留。读取允许原空值诊断供修复，提交拒绝空开关。原schemastery在恢复继承后物化空模板字典；测试核对实际用户层没有compat覆盖，不把有效默认值误认为用户保存。compatEditable仅由新版Host公布。
- 插件148项、后端70项通过（另1项独立PostgreSQL跳过）、手机383项及类型检查、Web/APK/lint、完整原插件页面回归通过。协议声明类型完善后协议专项与插件类型检查复验通过。原SettingsProvider测试覆盖保存/未编辑保留/恢复、协议不适用拒绝和其他配置不变；[测试](../../../plugin/tests/provider-models.test.ts)。[生产表单隔离回放](../../artifacts/provider-settings-components.json)覆盖false值、枚举、负数、模板变量、无效JSON不发送、语言切换草稿与恢复继承，375px无溢出；截图已查看，隔离样式不是最终App视觉或真实电脑写入证据。
- 电脑浏览器控制仍报nodeRepl.fetch失败，实际Android管理保存未验。路由级兼容设置、modelOverrides、模型发现、提供方创建/移除及认证引用等仍待完成；完整R14/Remote不变。电脑网页转发暂缓、范围待定。
- 07:52:09香港时间[MuMu实际入口](../../artifacts/model-compat-live-entry.json)由普通聊天进入真实Remote专用会话、插件面板和电脑插件清单，两个原动态模块active、草稿保持、errors/resources为空；07:52:16[管理拒绝](../../artifacts/model-compat-denied.json)通过。DSH44664/网关52640运行并建立中继连接，用户Key、模型配置、绑定和权限未改变，没有模型请求。此处只证明现有真实入口与拒绝边界，不是兼容配置实际保存验收。

## 会话未就绪时打开插件面板（2026-09-27）

- 状态：已修复可重复复现的未就绪入口，Web/APK构建、Android lint和383项Node测试通过。维护角色：项目协作Agent；核验2026-09-27。来源：[会话选择](../../src/remote-session-view.mjs)、[插件会话作用域](../../src/remote-plugin-slots.jsx)、[真实入口](../../src/ui/RemoteWorkspace.jsx)、[回归检查](../../scripts/check-plugin-panels.mjs)、[隔离回执夹具](../../tests/fixtures/remote-plugin-slots.jsx)。
- select先发布selected，再等待原reference.ready后发布session；RemotePluginScope按session提供reference并挂载面板。菜单旧实现仅检查selected，因此在此时间窗会调用尚未bind的原控制器。复现仅暂缓原引用ready，不替换原绑定/会话/控制器；真实菜单点击产生与此前MuMu相同的`sidebarRight: no session surface is mounted`，见[修复前日志](../../artifacts/panel-ready-before.log)。此前首次MuMu日志没有完整挂载时序，不能据此排除其他相同报错来源。
- 菜单的插件面板和当前会话的待审批请求入口现在等待session就绪，既有无会话导航仍先选择再打开。采用与实际会话作用域相同的就绪依据，避免额外定时器/独立状态不同步；没有吞错误、强制等待或改变原控制器。原待审批导航effect已有同样session检查，保留。
- [修复后完整页面回归](../../artifacts/panel-ready-after-final.log)通过未就绪禁用两入口、释放回执后立即打开，以及导航/文件/子会话/弹窗/关闭信号/草稿保持，errors为空。首次修复后回归暴露测试尚未安装资源服务的问题，已将原enablePanels放到测试前；未改生产资源服务或放宽错误断言。此回归使用隔离协议，不当作电脑或Android实际会话证据。
- 新版APK已安装；07:38:41、07:38:47、07:38:54香港时间MuMu连续三次force-stop/重开后，从普通抽屉进入真实Remote专用会话、插件面板和电脑插件清单均通过，两个原动态模块active、草稿保持、errors/resources为空：[第一轮](../../artifacts/panel-ready-cold-1.json)、[第二轮](../../artifacts/panel-ready-cold-2.json)、[第三轮](../../artifacts/panel-ready-cold-3.json)。电脑服务、模型配置、Key、绑定与权限均未修改，无模型请求。本次只修复已证实的未就绪路径，完整Remote及实际管理保存等缺口继续。

## 模型输入与思考能力（2026-09-27）

- 状态：插件0.1.57、新网关和APK已安装加载；真实Android管理保存待验。维护角色：项目协作Agent，核验日期2026-09-27。来源：[原pi-ai模型解析](../../../deepseek-harness/packages/llm/llm-pi-ai/src/catalog.ts)、[原配置](../../../deepseek-harness/packages/llm/llm-pi-ai/src/config.ts)、[协议](../../../backend/packages/protocol/src/remote-provider-models.ts)、[Host](../../../plugin/src/provider-models.ts)、[能力编辑器](../../src/ui/RemoteModelCapabilities.jsx)。
- 模型清单行可展开输入与思考能力。输入支持继承、文字、图片及两者；思考支持继承、关闭、自定义七档位及服务实际接受的参数值。不猜测模型可用能力；关闭档位留空对应off:null，其他档位必须填写非空值且至少有一个思考档位，最终仍由电脑原pi-ai校验。
- 相比传递任意模型JSON，本次在固定行协议内增加advanced对象，只公开input/reasoningEfforts。缺省advanced保留原行两项，显式{}恢复两项继承，false与缺省严格区分；其余compat与未来字段继续留在电脑。advancedEditable只在新版Host返回，旧Host响应不显示这些控件。读取可保留已有空/null思考配置用于修复，保存拒绝；不开放headers、Key或任意兼容参数。
- 原SettingsProvider+pi-ai测试覆盖实际保存、自定义档位、false关闭、恢复继承、未声明advanced的写入保留和隐藏字段保持。插件147项、后端69项通过（另1项独立PostgreSQL跳过）、手机383项、类型检查、Web/APK构建及Android lint通过。生产设置入口隔离回放验证语言切换草稿、输入选择、档位值、off:null、false、恢复继承和空自定义在发送前拒绝，375px无溢出；截图已检查，隔离样式不作为最终App视觉证据。[页面报告](../../artifacts/provider-settings-components.json)、[页面脚本](../../scripts/verify-provider-settings.mjs)、[原服务测试](../../../plugin/tests/provider-models.test.ts)。
- 模型兼容参数、modelOverrides、提供方创建/移除、认证引用及实际Android管理保存仍未完成。此处不缩减R14或完整Remote；电脑网页转发暂缓、范围待定。
- 实际运行：DSH66472/网关27320已建立中继，新APK安装成功。07:27第一次入口出现`sidebarRight: no session surface is mounted`，原[失败报告](../../artifacts/provider-model-advanced-entry-failure.json)保留；无修改重试与07:29冷启动通过，随后07:31三次连续force-stop/重开均通过（[第一轮](../../artifacts/provider-model-advanced-cold-1.json)、[第二轮](../../artifacts/provider-model-advanced-cold-2.json)、[第三轮](../../artifacts/provider-model-advanced-cold-3.json)），原插件active、草稿保持、errors/resources为空；[管理拒绝](../../artifacts/provider-model-advanced-denied.json)通过。未修改Key、模型配置、绑定或权限，无模型请求。
- 上述偶发面板未挂载故障未修复：按diagnose流程保留现场，同路径/冷启动未再复现；原完整插件插槽回归通过，不能据此排除重建时序问题。待区分插件界面重建空窗、旧控制器引用和入口早于会话就绪三种假设，下一步应在真实mount/bind和点击边界采集非敏感时序，不用吞异常或固定延时掩盖。此次没有改动面板生产代码；实际入口不能标记为无遗留问题。

## 模型清单编辑（2026-09-27）

- 状态：插件0.1.56、新网关和APK已安装并加载；实际Android管理保存尚未验证。维护角色：项目协作Agent。核验日期2026-09-27。来源：[Host模型适配](../../../plugin/src/provider-models.ts)、[严格协议](../../../backend/packages/protocol/src/remote-provider-models.ts)、[手机编辑器](../../src/ui/RemoteProviderModelEditor.jsx)、[原设置服务测试](../../../plugin/tests/provider-models.test.ts)。
- 在已有其他模型提供方中支持新增/移除模型、编辑ID、名称、上下文与输出容量，以及移除用户层覆盖恢复继承。容量沿原编辑器解析K/M；保存整份显式清单，恢复默认须明确保存。未展示的input、compat及其他字段保留在电脑，按本次快照中的不透明行标识合并，不传入手机或由手机重建。输入类型、思考和兼容选项的编辑仍待接入。
- 网关与Host分别要求管理权限；快照绑定设备连接、路由、设置服务、配置身份和revision，五分钟有效且只用一次。仅修改所选路由models数组，原pi-ai Config/assertServiceable继续校验；已有空/重复ID允许读取修复，保存必须非空且唯一。失败不自动重试，无法确认写入时重读；不提供跨表单事务或任意配置路径。
- 插件全量146项通过，最终读取契约调整及Host正向接入后相关33项复验通过；后端68项通过（另1项独立PostgreSQL跳过），最终协议专项复验通过；手机383项通过，类型检查、Web/APK构建与Android lint通过。生产设置页面使用隔离业务响应验证增删、容量、默认继承及语言切换保留草稿，375px无横向溢出，原聊天组件回归通过。见[页面报告](../../artifacts/provider-settings-components.json)、[页面脚本](../../scripts/verify-provider-settings.mjs)；此证据不等于真实手机写入。
- 07:16:49香港时间[MuMu实际入口](../../artifacts/provider-model-edit-live-entry.json)由普通聊天进入Remote专用会话和原插件面板，两项动态模块active、草稿保持、errors/resources为空；07:17:36[管理拒绝](../../artifacts/provider-model-edit-denied.json)通过。DSH59728监听3080、网关74164监听8787，中继连接已建立。原用户Key、配置、绑定及权限未改，无模型请求。
- 内置浏览器再次返回nodeRepl.fetch失败，尚未通过真实管理页进行保存/恢复，不能标记R14完成。提供方创建/移除、完整模型字段、认证引用/OAuth及其余Remote仍待实现或验收。电脑网页转发暂缓、范围待定，未按取消或完成处理。

## 其他提供方Key原生入口（2026-09-27）

- 状态：插件0.1.55、配套网关和APK已安装；真实Android管理保存未验。维护角色：项目协作Agent，核验2026-09-27。来源：[电脑凭据适配](../../../plugin/src/computer-key.ts)、[手机控制器](../../src/remote-key.mjs)、[原生密码窗口](../../android/app/src/main/java/dev/dshmobile/validation/RemoteComputerKey.kt)、[原pi-ai认证解析](../../../deepseek-harness/packages/llm/llm-pi-ai/src/index.ts)。
- 选择已有其他提供方后，可读取其明确配置的Key引用状态，通过共用原生窗口更换/移除。目标只含路由，引用由电脑读取；原pi-ai未配置apiKeyEnv时使用自身认证发现，此入口拒绝写入而不猜DeepSeek或其他默认Key。保留注册名/DSH_MOBILE_命名空间保护、同设备/连接/路由快照、过期与引用变化检查；不读旧值，不支持任意凭据或OAuth创建。
- 原生窗口显示提供方路由；严格对象目标及响应匹配避免与DeepSeek/搜索入口混淆。通用WebView socket仍禁止keyWrite，输入值只经原生窗口和已绑定中继。原生未知结果锁、两次确认移除、取消不提交、语言更新与FLAG_SECURE保留。敏感写入没有原服务之外的跨客户端原子CAS。
- 插件143项、后端67项（另1项独立PostgreSQL未运行）、手机383项通过，类型检查、原插件页面回归、Web/APK构建与Android lint通过。新增真实LocalCredentialProvider和RemoteAdapter路径检查保存/移除/跨路由拒绝/默认凭据保留/引用变化，网关真实HTTP与WS权限覆盖新目标。旧搜索入口错误码回归曾失败，已修复生产判断并通过全量，不放宽原断言。
- [生产设置页面回放](../../artifacts/provider-settings-components.json)验证提供方Key状态、只交接snapshot/target、取消后重读和页面无密码框；业务响应隔离，不冒充手机保存。[MuMu原生专项](../../artifacts/provider-key-native-android.json)在06:54:37香港时间使用测试UUID通过公开原生桥打开空窗口，五种非法目标拒绝、路由标题/密码输入类型及取消通过；没有输入、提交或授予权限。此专项刻意没有取得真实管理快照，不能当作真实设置入口或保存验收。脚本[来源](../../scripts/verify-provider-key-native-android.mjs)，临时消息监听与XML已清理。
- 06:54:15[实际普通聊天→Remote入口](../../artifacts/provider-key-live-entry.json)通过，原动态模块active、草稿保持、errors/resources为空；随后[管理拒绝](../../artifacts/provider-key-denied.json)通过。DSH55968/网关62704运行且已建立中继连接。原用户Key、配置、绑定与权限未变，无模型请求。
- 实际提供方Key保存/移除、模型配置编辑、提供方新增/移除及其余Remote仍待完成；电脑浏览器控制连接问题尚未解决，不增加授权绕过。网页转发暂缓、范围待定。

## 提供方设置中的共享模型目录（2026-09-27）

- 状态：已实现并安装新版APK，原目录服务组件回放通过；真实Android管理页仍未验证。维护角色：项目协作Agent。核验日期2026-09-27。来源：[提供方页面](../../src/ui/RemoteProviderSettings.jsx)、[目录区域](../../src/ui/RemoteProviderModels.jsx)、[原目录生命周期](../../../deepseek-harness/packages/client/ui-model-selection/src/client/catalog.ts)、[原模型目录类型](../../../deepseek-harness/packages/api/session-controller/src/types.ts)。
- 选择已有提供方后显示同一电脑模型目录中的名称与ID。复用RemoteModel持有的ModelCatalogDirectory，与聊天选择器共享缓存、连接代次及电脑配置变更刷新；没有新增目录协议或另行推断pi-ai配置。读取中隐藏旧模型，区分失败、路由不可用和空目录；失败诊断不原样显示。此处仅查看目录，新增/移除/编辑模型配置仍待接入。
- [生产设置入口回放](../../scripts/verify-provider-settings.mjs)使用原ModelCatalogDirectory和实际设置controller、隔离业务响应，覆盖跨提供方过滤、缓存只读一次、迟到响应丢弃、读取失败/不可用/空目录、英语、长ID换行及375px无横向溢出。原地址确认和管理撤权检查继续通过。见[报告](../../artifacts/provider-settings-components.json)和[日志](../../artifacts/provider-model-directory-components.log)。截图已查看，隔离样式不是最终App视觉验收。
- 382项Node测试、原插件聊天页面回归、Web/APK构建和Android lint通过。06:43:01香港时间[MuMu实际入口](../../artifacts/provider-model-directory-live-entry.json)从普通聊天进入真实Remote专用会话和原插件面板，两个原动态模块active、草稿保持、errors/resources为空；06:43:19[管理拒绝](../../artifacts/provider-model-directory-denied.json)通过。没有设置、Key、模型调用、绑定或权限修改；DSH20384/网关56628保持。
- 浏览器控制实测仍报nodeRepl.fetch失败，不能进行真实管理目录/地址保存验收。R14与完整Remote保持未完成，提供方新增/移除、Key、模型配置和其余矩阵继续；网页转发因带宽顾虑暂缓，未记为取消或已完成。

## 其他提供方服务地址（2026-09-27）

- 状态：插件0.1.54、网关和APK已安装；原服务/Host路由及手机页面回放通过，实际Android管理保存未验。维护角色：项目协作Agent，核验2026-09-27。来源：[Host适配](../../../plugin/src/provider-endpoint.ts)、[协议](../../../backend/packages/protocol/src/remote-endpoint.ts)、[共用地址界面](../../src/ui/RemoteComputerEndpoint.jsx)、[提供方入口](../../src/ui/RemoteProviderSettings.jsx)。
- 「Remote选项→电脑设置→其他模型提供方」选择已有提供方后，可读取地址来源并核对新地址或恢复默认。复用普通电脑模型/搜索的地址确认组件；各实例使用独立输入label/id，切换提供方关闭旧表单。controller按提供方缓存，连接代次和未知写入限制保持。未单独配置地址时明确由模型目录决定，不假定默认站点；普通聊天手机Key/地址不受影响。
- 网关及Host独立要求管理权限，既有endpoint操作增加对象target，不开放任意设置路径。原mutate只改对应路由baseURL，旧路径和其他敏感配置不返回。快照、原版本、路由、服务及配置身份检查保留；原pi-ai Config/assertServiceable负责业务校验。标量表单与地址独立提交，旧版本需要重读，不提供跨表单事务。
- 插件28文件141项、手机382项、后端24文件66项通过，另1项独立PostgreSQL未运行；三端类型/构建（手机JS无单独类型检查）、Web/APK及Android lint通过。原设置服务、真实RemoteAdapter成功写入/跨路由拒绝、HTTP/WS权限路径均覆盖。typecheck曾发现新测试缺少undefined检查，已修正并通过。
- [生产页面回放报告](../../artifacts/provider-settings-components.json)新增地址核对前不写入、HTTP set、语言切换保留确认、取消不写、unset目录默认及旧提供方迟到响应检查；管理撤销移除表单、375px无横向溢出。截图已查看，但隔离页面不包含完整App主题，不能当成最终App视觉或真实电脑写入验收。旧DeepSeek/搜索地址及原插件完整页面套件通过。
- 06:31:51香港时间，[实际日常入口](../../artifacts/provider-endpoint-live-entry.json)由普通聊天进入真实Remote专用会话和原插件面板，两个动态模块active、草稿保持、errors/resources为空；06:31:58[管理拒绝](../../artifacts/provider-endpoint-denied.json)通过。DSH20384监听3080并已连接网关56628的8787；已有Key、配置、绑定和权限未修改，没有模型请求。
- 浏览器控制再次返回nodeRepl.fetch失败，未临时授予管理权限，因此实际提供方地址保存/恢复不能标记通过。提供方新增/移除、Key、模型列表及完整R14/Remote继续；网页转发暂不实施、范围待定。

## 布局变化后的尾部跟随（2026-09-27）

- 状态：生产修复已构建安装，主聊天/旁栏组件与MuMu实际入口通过。维护角色：项目协作Agent。来源：[共享聊天页](../../src/ui/RemoteWorkspace.jsx)、[尺寸回归](../../scripts/check-remote-resize-follow.mjs)、[实际分页验收](../../scripts/verify-remote-pagination-android.mjs)。
- 原跟随仅响应会话事件；异步插件内容或输入区改变尺寸后不会补齐。MuMu重入会话实测持续离底27.67px；真实组件异步增高复现离底144px，见[修复前回归](../../artifacts/history-resize-before.log)。现在观察聊天内容与容器尺寸，和会话更新共用一帧；已经翻阅历史时不拉回尾部，卸载释放观察器与帧。上游参考与插件内部布局未改。
- 主聊天及正式子会话旁栏入口均验证内容增高、可视区缩小、历史阅读保持；原插件完整页面回归及381项Node测试通过，Web/APK构建、Android lint通过。千轮5000事件仍50次页面/工厂刷新和50次滚动，加载6.53秒、最长任务203ms、输入两帧p95约44.4ms；这不是整体性能提速或完整性能验收，见[压力报告](../../artifacts/history-resize-scale.json)。
- 06:15:56香港时间，新版MuMu从实际Remote专用会话重入，离底误差0.34px以内；四页到89条回复，原窗口逐条保留，阅读节点偏差最大0.47px，草稿保持、errors为空。另通过同一实际页面的临时DOM尺寸扰动检查，并清除扰动；不冒充真实第三方插件自行改变高度。见[实际报告](../../artifacts/history-resize-final-android.json)、[分页截图](../../artifacts/history-resize-final-android.png)。此前06:13实际普通聊天→Remote→原插件面板的[日常入口](../../artifacts/history-resize-entry.json)通过，资源/脚本错误为空。
- 验收脚本原有两处不成立的假设已修正：读到开头时不一定新增article；原过程折叠成hidden="until-found"后，需核验仍显示的同一旧节点，而不能量隐藏节点。末页两项锚点折叠，下一仍显示节点保持位置。保留[原超时](../../artifacts/history-current-android.log)、[隐藏锚点误报](../../artifacts/history-resize-hidden-anchor-failure.json)与每页前截图；没有放宽4px阈值或删除旧正文比较。
- 此前排序优化实验未采用：当时记录基线6.38秒，两候选分别[6.59秒](../../artifacts/history-order-after.json)/[6.08秒](../../artifacts/history-order-after2.json)，最长任务仍192–200ms，不足以证明稳定收益。实验源仅归档在artifacts，已撤下生产适配和实验测试，既有导航摘要缓存保留。证据更正：原history-current-before.json及同名前缀CPU文件被08:25–08:26重测覆盖，旧6.38秒仅剩文字记录，现有文件不能证明旧对照；新数据已另存history-projection-20260927-before，见上方导航优化记录。
- 未修改电脑服务、Key、绑定或管理权限，没有模型调用。完整R01–R16/A03–A06、剩余性能热点与真实管理设置写入继续；电脑网页转发暂不实施、范围待定，不把延期建议记成用户确认取消。

## 其他模型提供方的已有配置（2026-09-27）

- 状态：插件0.1.53、新网关与APK已安装；协议、原设置服务和手机页面回放通过，真实Android提供方保存尚未验证。维护角色：项目协作Agent。依据：[协议](../../../backend/packages/protocol/src/remote-provider-settings.ts)、[Host适配](../../../plugin/src/provider-settings.ts)、[手机控制器](../../src/remote-settings.mjs)、[实际设置入口](../../src/ui/RemoteComputerSettings.jsx)。
- 「Remote选项 → 电脑设置 → 其他模型提供方」读取已配置的llm-pi-ai路由，提供名称、默认上下文/输出容量、请求/输出超时、缓存和传输方式七项编辑。容量仅用于模型未声明时的回退，不冒充单次请求上限。选择/刷新/断线撤下旧表单，切换语言保留草稿，未知写入不自动重试；主聊天与旁栏共用控制器。
- 网关与Host分别检查管理权限；Host仅投影七字段，不能返回schema、用户配置树、URL、headers或凭据。保存使用原SettingsProvider.mutate及必填版本，每次快照绑定设备、连接、路由和服务；恢复默认只unset对应字段。配置服务重载、跨路由/连接、过期与重复提交均拒绝。Android桥已接新增三项协议。
- [原设置服务测试](../../../plugin/tests/provider-settings.test.ts)覆盖读写/恢复、未知字段保留、路由与快照拒绝、错误脱敏，以及只读上游真实pi-ai Config/assertServiceable。pi-ai 0.85.1仅作为测试依赖，不进入手机或插件生产包。插件136项、手机381项、网关65项通过（另1项独立PostgreSQL测试未运行）；类型检查、构建及Android lint通过。
- [实际页面回放](../../scripts/verify-provider-settings.mjs)经完整电脑设置组件进入，核对单字段提交、语言切换、迟到响应、断线重读、撤权隐藏与375px无横向溢出，见[报告](../../artifacts/provider-settings-components.json)。该回放采用隔离业务响应，不等于真实电脑写入；原插件完整回放与原设置语言回归也通过。
- 05:52香港时间MuMu的[日常入口](../../artifacts/provider-live-entry.json)和[管理拒绝](../../artifacts/provider-denied-android.json)通过，errors/resources为空，草稿保留。DSH30080、网关55568运行，用户Key、绑定、配置与授权未更改，无模型请求。曾使用错误MainActivity名称的启动命令失败；随后既有脚本用真实ValidationActivity正常启动，不是产品故障。
- 浏览器控制仍报nodeRepl.fetch失败，因此未从电脑授予管理权限或进行真实Android设置写入。提供方新增/移除、Key/地址、模型列表及其他完整配置继续接入；不能称作完整R14完成。网页转发暂不实施、范围待定，完整R01–R16/A03–A06目标保留。

## 电脑已有自定义Key引用（2026-09-27）

- 状态：插件0.1.52与新版APK已安装；原服务/Host路由写入通过，真实Android自定义Key写入仍待专用配置验证。维护角色：项目协作Agent。来源：[仅写适配](../../../plugin/src/computer-key.ts)、[凭据更新监听](../../../plugin/src/index.ts)、[完整边界与证据](../../../docs/project-knowledge/knowledge/domains/remote-access/settings-boundary.md#已配置的自定义key引用2026-09-27)。
- 支持电脑现有DeepSeek／搜索apiKeyEnv，引用名称和值不返回手机；仍仅原生窗口写入。拒绝注册名、DSH_MOBILE_前缀与非引用语法，独立dsh-mobile/host信任记录不可达。快照绑定引用，任何凭据引用更新都保守失效；其他provider及选择/创建引用未接入，不称作完整电脑模型配置已完成。
- 新增原LocalCredentialProvider与真实RemoteAdapter回归，先3项失败后修复；插件全量130项、类型检查/构建、手机4项Key模型、完整插件页面回放、Web/APK/lint通过。使用独立临时凭据文件和无价值测试Key，未读取或更换用户Key。
- 05:29 MuMu日常入口与无管理权限拒绝通过，见[入口报告](../../artifacts/custom-key-final-entry.json)、[权限报告](../../artifacts/custom-key-blocked-android.json)。DSH38536与网关18752保持，Key/绑定/权限未改变。首轮host_offline失败及旧版对照记录保留，重装同一新版、确认中继连接后通过，不将首次失败直接归因新版代码。
- 浏览器控制连接仍不可用，动态运行器实际撤销与双端验证未执行；其他独立功能继续推进。完整Remote保持进行中，网页转发暂不实施、范围待定。

## 电脑重启后的动态插件恢复（2026-09-27）

- 状态：现有生产APK的真实DSH进程重启链路通过；本轮仅扩展验收夹具和脚本，没有生产代码变更。维护角色：项目协作Agent。来源：[电脑固定测试包](../../tests/fixtures/live-cordis-plugin/index.js)、[Android验收](../../scripts/check-cordis-approvals-android.mjs)、[原登记与运行语义](../../../deepseek-harness/packages/extensions/cordis-host-runner/src/index.ts)。
- 05:12:41香港时间开始的MuMu验收，通过普通抽屉进入真实Remote与专用聊天，完成原审批/版本更新后，实际结束DSH34480并启动13968，网关18752保持。手机先进入离线，再恢复原聊天；旧pkg-3局部界面被移除，新进程由固定夹具重新登记的同名dshm-1/pkg-1保持待激活，没有自动运行。手动点击原面板运行后，真实Host回声成功且调用计数为1，随后停止和移除通过。见[实际报告](../../artifacts/cordis-desktop-restart-android.json)、[待激活截图](../../artifacts/cordis-desktop-restarted-idle.png)、[重新运行截图](../../artifacts/cordis-desktop-restarted-running.png)。待激活截图已检查布局。
- 原草稿值保持；本轮未专门写入非空草稿，也未逐条比对全部历史，因此不扩大此项结论。重启前释放原维护门闩并仅清除4条本轮测试回执；新进程运行后清除3条，两段newTurns均0、原待办均保留。无模型调用、Key、绑定或设备权限修改。新包来自夹具启动时重新登记，不能将它描述为DSH自动持久化恢复动态包。
- 最初两次验证脚本误把刚define的包视作current或next，分别留下[首次断言失败](../../artifacts/cordis-desktop-restart-assertion-before.json)和[第二次断言失败](../../artifacts/cordis-desktop-restart-assertion2-before.json)。核对原源码：define只填packages，run才填next，成功后才填current；据此修正断言后完整重跑通过，未修改产品绕过故障。
- 结束DSH导致原inventory/syncInspectManifest产生3条明确的连接中断诊断，完整保留在报告expectedDisconnectErrors；只在真实重启恢复成功后分类这几种方法/错误，其他errors/resources为空。没有把全部console错误忽略。
- 临时0.0.8插件已经原CLI卸载，DSH恢复38860，网关18752保持。App保留数据冷启动后，原聊天、插件面板及两个原动态模块active、草稿保持、errors/resources为空，见[日常入口收尾](../../artifacts/cordis-desktop-restart-cleanup.json)。三个改动脚本语法检查通过；本轮未重新构建APK，旧378项测试和构建结果仍是前轮证据。
- 剩余：双端动态目录、实际撤销下的动态运行器清理、真实历史卡片Android专项及完整R01–R16/A03–A06。此项证明进程重启与固定动态实例收敛，不代表任意第三方外部副作用可恢复。网页转发暂不实施、范围待定；用户带宽顾虑已明确，延期首版仍为建议，不将其记成已确认删除。

## 动态插件渲染错误归属（2026-09-27）

- 状态：生产修复已构建安装，MuMu真实原运行器链路通过。维护角色：项目协作Agent；最近核验2026-09-27。来源：[组件身份映射](../../src/remote-component-identity.mjs)、[插槽宿主](../../src/remote-plugin-slots.jsx)、[工厂调用包装](../../src/remote-factory-callers.jsx)。
- 修复前实际测试触发局部React渲染异常，原边界移除了出错组件，但手机原面板无错误、电脑latestRun仍running；见[实际失败](../../artifacts/cordis-render-before-android.json)。原动态运行器按组件对象WeakMap归属错误，手机注册的Framed/FactoryCaller改变了对象身份；[原注册/错误边界最小回归](../../tests/fixtures/remote-render-failure.jsx)直接证明original=false，见[修复前回归](../../artifacts/render-identity-before.log)。不是协议丢失或仅清单刷新问题。
- 手机私有WeakMap记录包装到原组件，普通/工厂/调用者局部包装共用；原ledger仍按实际条目处理退位和卸载，仅onEntryError观察者收到保留其余元数据的原组件归属。没有按插件名称猜归属，没有改插件内部或上游源码，也没有跳过原错误边界。相比复制修改动态运行器，身份映射同时适用于已有包装路径，后续新包装必须登记来源。
- 最小回归通过普通插槽退位与工厂实例不退位两条路径，原组件身份正确；[回归结果](../../artifacts/render-identity-after.log)含4条准确预期错误。378项Node测试、完整页面回归、Web/APK构建及Android lint通过，见[Node](../../artifacts/render-identity-tests.log)、[页面](../../artifacts/render-identity-full-web.log)、[APK](../../artifacts/render-identity-android-build.log)。
- 05:01:28香港时间新版MuMu触发固定DSHM_EXPECTED_CLIENT_RENDER_FAILURE，原面板显示client-render失败，电脑同一run-4记录诊断；主聊天编辑器仍可编辑且草稿保持。停止后重启同一pkg-3得到run-5，Host回声恢复，随后移除通过。见[实际报告](../../artifacts/cordis-render-after-android.json)和[错误面板截图](../../artifacts/cordis-render-failure-android.png)，截图已查看。两条故意触发的React/插槽日志精确单列，其他errors/resources为空，不屏蔽其他异常。
- 原维护接口阻止模型唤醒；本轮9条测试回执清理、原待办保持、newTurns=0，无Key/绑定/权限修改。临时0.0.7包已原CLI卸载，DSH恢复30796、网关18752保持；[日常冷启动收尾](../../artifacts/cordis-render-cleanup.log)确认聊天、草稿和两个原模块正常。实际设备撤销、双端动态目录、电脑重启及其他插件异常仍待验收，完整Remote未完成；网页转发仍暂不实施、范围待定。

## 动态插件电脑调用失败（2026-09-27）

- 状态：MuMu经过真实Host调用链验证固定处理器异常及后续恢复；维护角色：项目协作Agent；最近核验2026-09-27。沿用当前APK/生产实现，只扩展[专用测试包](../../tests/fixtures/live-cordis-plugin/index.js)、[局部测试按钮](../../tests/fixtures/live-cordis-plugin/client-source.js)及[实际验收脚本](../../scripts/check-cordis-approvals-android.mjs)，通过DSHM_CORDIS_HOST_FAILURE=1启用。
- 源码[原invoke](../../../deepseek-harness/packages/extensions/cordis-host-runner/src/index.ts)规定处理器异常返回handler-error并报告给Agent，但插件继续运行；与包加载失败、设备撤销不同。04:46:03香港时间手机点击固定fail方法，真实Host抛出DSHM_EXPECTED_HOST_HANDLER_FAILURE，手机原运行器返回失败说明。再次点击echo成功，电脑成功调用计数2、失败计数1，同一pkg-3/run-4仍running；没有自动重试失败调用。见[实际报告](../../artifacts/cordis-host-failure-android.json)与[截图](../../artifacts/cordis-host-failure-android.png)，截图已查看。错误呈现由测试插件自己的局部按钮负责，不宣称所有第三方插件都能自行恢复。
- 同轮回归拒绝/单次批准/后续版本授权、停止/移除及草稿保持，errors/resources为空。原维护门闩阻止失败回执启动模型；清除本轮7条测试回执、原待办保持、newTurns=0。未修改Key、绑定或权限，截图里的早期待办未清除。
- 临时0.0.6包已经原CLI卸载并恢复DSH72280，网关18752保持；[冷启动收尾](../../artifacts/cordis-host-failure-cleanup.json)通过日常Remote专用聊天、原面板及两个动态模块active，草稿保留、errors/resources为空。脚本语法检查通过，本轮未重建产品或重复宣称前轮完整页面测试。
- 双端目录、实际撤销、运行期未捕获异常及电脑重启动态包边界继续；浏览器连接本轮再次返回不可用，不能据此声称双端通过。完整Remote仍未完成，电脑网页转发仍暂不实施、范围待定。

## 历史动态插件工具卡片（2026-09-27）

- 状态：以下为原组件浏览器历史回放证据；后续[Android持久记录读取与重入](#历史动态插件卡片的android读取2026-09-27)已补验，范围以该节为准。维护角色：项目协作Agent；最近核验：2026-09-27。来源：[回放数据](../../tests/fixtures/remote-cordis-cards.jsx)、[卡片检查](../../scripts/check-cordis-cards.mjs)、[页面验证入口](../../scripts/verify-remote-plugin-slots.mjs)。本节当时未修改生产代码、重建APK或改变电脑服务。
- 当前基线上游已经移除 cordis_define/run/stop/undefine 模型工具，保留历史记录渲染；不能把重新执行旧工具当成当前动态插件验收条件。依据[上游历史卡片测试](../../../deepseek-harness/apps/web/tests/cordis-tool-round.e2e.ts)及[Creator插件管理测试](../../../deepseek-harness/apps/cli/tests/profiles/web/tests/creator-plugin-manager.expected.e2e.ts)。动态包当前运行服务仍存在，此前真实审批、版本更新和Host调用证据继续有效。
- 回放使用原ui-tool、ui-cordis注册和原会话投影，只隔离清单、运行状态与历史事件。Client/Host源码切换、待审批不挂业务控件、最新运行卡片独占业务控件、失败/已移除状态、停止/移除历史与卸载恢复通过。375×667视口源码卡片宽335.20px、页面横向溢出0；[运行截图](../../artifacts/cordis-cards-running-web.png)与[历史结果截图](../../artifacts/cordis-cards-web.png)已查看。此几何检查不是任意插件外观或真机布局验收。
- `node scripts/verify-remote-plugin-slots.mjs --cordis-cards`及完整页面套件通过，errors为空，见[专项结果](../../artifacts/cordis-cards-layout-web.log)、[完整结果](../../artifacts/cordis-cards-full-web.log)。追加的切换后返回检查曾误以为仅内存注入的事件会由夹具重新读回；夹具会重新提供固定初始历史，故删除该不成立的断言。本节不宣称会话切换后历史恢复已专项验证。
- 04:41:59香港时间沿用当前APK，从普通聊天抽屉进入真实Remote专用聊天、原插件面板和电脑插件列表；两个原动态模块active、草稿保持、errors/resources为空，见[真实入口报告](../../artifacts/cordis-cards-android-entry.json)。无模型请求、Key、绑定、权限或服务变化；此检查不替代真实历史卡片验收。
- 下一步保留双端动态目录、Host失败/运行期异常、实际撤销、电脑重启动态包边界及完整R01–R16/A03–A06。内置浏览器连接不可用时，双端验收保持待验证。电脑网页转发暂不实施、范围待定，不将带宽讨论中的延期建议当作用户确认取消。

## 动态插件失败回退与真实重连（2026-09-27）

- 状态：MuMu专用动态包的客户端加载失败、手动回退及真实网关中断恢复通过。维护角色：项目协作Agent；最近核验：2026-09-27。沿用现有APK和生产实现，本轮仅扩展[验收脚本](../../scripts/check-cordis-approvals-android.mjs)与[测试包](../../tests/fixtures/live-cordis-plugin/index.js)，不是新的产品构建。
- 原DSH更新会卸载旧运行；新包失败保留current/next标识并提供“回退”，不承诺自动无缝回滚。04:20及04:25香港时间MuMu真实请求固定第四版抛出明确测试异常，原清单显示运行失败、current=pkg-3、next=pkg-4、无activeRun。点击原“回退”后pkg-3可调用Host；随后正常第五版更新成功。见[独立失败恢复报告](../../artifacts/cordis-update-failure-android.json)、[失败截图](../../artifacts/cordis-update-failure-android.png)。
- 04:25轮实际停止/恢复网关，手机显示离线且保留局部插件界面，离线点击返回remote_not_connected；恢复后pkg-5/run-7身份保持，手动点击Host回声成功，电脑计数严格1→2，离线点击未排队重放。见[真实重连报告](../../artifacts/cordis-reconnect-android.json)、[恢复截图](../../artifacts/cordis-reconnect-recovered-android.png)。报告保留且精确核对一条故意失败诊断，其他errors/resources为空。审批、版本授权、停止/移除和草稿也回归通过。
- 初始脚本把预期console诊断算额外错误，随后又错误要求短暂断线卸载UI；源码明确保留现有插件，已按真实契约改验离线拒绝与调用计数。另一次断线断言未匹配实际remote_not_connected，修正后整轮重跑。保留[原诊断误判](../../artifacts/cordis-failure-expected-diagnostic.json)和[卸载假设失败](../../artifacts/cordis-reconnect-before.json)，不把这些测试假设当作生产bug或绕过错误检查。
- 原维护接口阻止回执唤醒模型，本轮清除9条新增测试消息，原待办保留，newTurns=0；无Key、绑定或权限修改。固定插件0.0.5已通过原CLI卸载，DSH恢复7940、网关18752；日常入口收尾见[清理报告](../../artifacts/cordis-reconnect-cleanup.log)。脚本语法检查通过，前轮378测试/构建属于前轮证据，未冒充本轮重跑。
- 待验：双端目录、动态工具卡片、Host失败/运行期异常、实际撤销、电脑重启后的动态包边界与完整Remote。短暂网关重连不等于设备撤销或电脑重启。网页转发仍暂不实施、范围待定。

## 动态插件审批与版本授权（2026-09-27）

- 状态：手机提醒、原审批和版本授权已在MuMu真实接入验证；完整R13仍进行中。维护角色：项目协作Agent。来源：[状态投影](../../src/remote-cordis-approvals.mjs)、[自有页面](../../src/ui/RemoteWorkspace.jsx)、[原面板宿主](../../src/remote-plugin-panels.jsx)。
- 原运行器的待审批状态投影到聊天/Remote首页的“查看请求”，批准和拒绝仍由原CordisPanel执行。页脚仅在面板可见且未打开文件时挂载，避免隐藏窗口提前打开视口弹窗后被导航点击关闭；原运行器保留审批状态，重新挂载继续呈现。首页跨会话导航与服务卸载清理通过原组件浏览器回归，尚未单独做首页跨会话MuMu专项。
- 04:13香港时间[MuMu报告](../../artifacts/cordis-approval-android.json)通过拒绝不运行、仅批准一次后新版本重新请求、批准后续版本后第三版自动运行、三个实际Host回声、停止与移除。实际待审批弹窗x16、宽396.27，未越界；[提醒截图](../../artifacts/cordis-approval-notice-android.png)和[原审批截图](../../artifacts/cordis-approval-pending-android.png)已查看。草稿保留，errors/resources为空。
- [固定测试插件](../../tests/fixtures/live-cordis-plugin/index.js)0.0.3通过原sessionController恢复专用会话、原dynamicCordisRunner发起请求，没有模拟Agent或替换模型。审批回执原本会唤醒模型，因此实测用原runMaintenance暂缓，结束仅清除本轮6条测试回执、保留原有待办；newTurns=0。首次测试因冷历史没有live Agent失败；改为原控制器恢复后，重启过早还遇到旧连接/旧runId，待服务就绪、App冷启动后完整通过。这些准备失败不计作产品审批失败。
- 378项Node测试通过；Web/APK构建及Android lint通过，新APK已安装。证据：[Node](../../artifacts/cordis-approval-tests.log)、[原插件页面回归](../../artifacts/cordis-approval-web-final.log)、[APK构建](../../artifacts/cordis-approval-android-build.log)、[实际脚本](../../scripts/check-cordis-approvals-android.mjs)。临时插件已经原CLI卸载，DSH恢复23896，网关25976保持；[冷启动收尾](../../artifacts/cordis-approval-cleanup.log)通过原聊天、插件面板、草稿及两个原动态模块active，无错误。Key、绑定和权限未改变。
- 下一步：动态工具卡片、双端目录、断线/撤销与运行失败/回退；任意第三方fixed弹层与完整R01–R16/A03–A06仍待验收。R12网页转发暂不实施、范围待定，不将延期建议当成用户已确认取消。

## 动态插件手机入口与真实运行（2026-09-27）

- 状态：原清单入口及手动运行基本链路已实际接入；完整动态插件仍在验收。维护角色：项目协作Agent。最近核验：2026-09-27。来源：[插槽宿主](../../src/remote-plugin-slots.jsx)、[面板外壳](../../src/remote-plugin-panels.jsx)、[注册转接](../../src/remote-module-registration.mjs)、[原运行器](../../../deepseek-harness/packages/extensions/cordis-client-runner/src/client/runtime.ts)。
- 「Remote 选项 → 插件面板」底部呈现原 `sidebar.footer.action`，复用原CordisPanel与原操作，未嵌入电脑整页。原组件在清单为空时返回空，不提供独立创建代码入口。根插槽由根渲染器传入旁栏，保持原所有权检查。
- 原弹窗按视口定位，旧外层的`scale(1)`也会改变定位参考；页脚现在只按正常布局宽度测量，不把fixed弹窗溢出计入触发器宽度，缩放比例为1时不设transform。其他插槽保留原溢出测量与用户优先缩放规则。375×667浏览器原组件曾越出视口，修复后宽351、x16，无越界；宽插件与其他旁栏回归通过。任意需要实际缩小的插件内部fixed弹层仍需专项。
- MuMu首次手动运行复现 `cannot resolve dyn/dshm-1`：[失败记录](../../artifacts/cordis-entry-live.log)。旧Remote facade仅接收带代次script，原动态运行器从内存同步登记被丢弃；[原模块系统回归](../../artifacts/cordis-registration-before.log)同样失败。现在当前模块表的`invalidate(dyn/…)`只开放同一同步调用、同名、一次性登记，微任务后失效；旧script、未登记的内存工厂、旧模块表和断开后的facade不能向新代写入。[4项隔离测试](../../tests/remote-module-registration.test.mjs)与[原模块系统修复回归](../../artifacts/cordis-registration-after.log)通过。此机制保留原运行器的同步顺序，若上游改变顺序需重新核验。
- 03:49与03:50香港时间，两次真实MuMu从普通抽屉进入Remote，后者含DSH重启与App强制退出后冷启动。固定[电脑测试包](../../tests/fixtures/live-cordis-plugin/index.js)经原服务登记到既有专用会话，手机原清单运行、局部按钮`host.call`得到`DSHM_CORDIS_ECHO`、停止后按钮卸载、移除后清单项消失，原草稿保留，errors/resources为空。见[实际报告](../../artifacts/cordis-entry-lifecycle-android.json)、[运行截图](../../artifacts/cordis-live-running-android.png)、[Host调用截图](../../artifacts/cordis-live-echo-android.png)和[脚本](../../scripts/verify-cordis-android.mjs)。不是模型生成插件，也没有模型请求、Key/绑定/设备授权变更；原手动操作仅向专用会话注入下次运行可见的状态说明，不唤醒模型。
- 378项手机测试、完整页面回归、Web/APK构建及lint通过，日志为[测试](../../artifacts/cordis-entry-tests.log)、[页面](../../artifacts/cordis-entry-web-final.log)、[构建](../../artifacts/cordis-entry-android-build.log)。首次布局回归遇到根插槽所有权和夹具语言/旁栏恢复状态问题，均修正后完整重跑；未省略真实入口验证。
- 专用动态包已通过手机移除，临时登记插件经原CLI卸载并恢复DSH；当前DSH19340、网关25976。完整Remote保持进行中。下一步验收原审批与工具卡片、面板隐藏时新审批提醒/弹窗定位、版本切换、双端目录及断线/撤销，不将手动运行通过泛化为完整R13。R12网页公网转发仍暂不实施、范围待定。

## 动态插件通道实际安装（2026-09-27）

- 状态：以下为03:26安装阶段记录，后续手机入口与运行验收见上节。电脑兼容包、12个原调用及手机完整能力门槛已安装。维护角色：项目协作Agent。来源：[固定基线兼容包及协议测试](../../../plugin/compatibility/cordis-inspect/README.md)、[实际手机脚本](../../scripts/verify-cordis-android.mjs)。
- 配套插件0.1.51，兼容包7/7应用到本机源码和编译入口，网关重启，新APK保留数据安装。实际发现Cordis代理对象变化被误判为连接过期，按原服务身份修复；原Gateway回归先6项失败、修复后9项通过，断线/服务换代保护保留。当前DSH40000、网关25976。
- 03:26香港时间MuMu从普通聊天抽屉进入真实Remote；原 `cordis-client-runner` 与 `ui-cordis` 均为active，目录上报不再报错，原工作区文件旁栏开关、测试会话与草稿保留，errors/resources为空。[实际报告](../../artifacts/cordis-panels-android.json)、[模块状态截图](../../artifacts/cordis-plugin-status-android.png)和[旁栏截图](../../artifacts/cordis-panels-android.png)。没有模型请求、Key/绑定/权限修改。
- 125项插件默认测试、65项后端测试（PostgreSQL1项按配置跳过）、374项手机测试通过；核心9项、兼容接口9项、安装7项分别通过，APK构建/lint通过。它们不替代真实动态包的审批、运行、调用、停止和移除验收。
- 下一步：原动态清单组件注册在 `sidebar.footer.action`，手机尚未声明/呈现此槽；现有「插件面板」属于右旁栏，不能视为Cordis清单已提供。接原局部组件后，再用明确来源的专用测试包验证双端、断线和生命周期，不调用余额不足的模型。

## 旁栏应用确认的真实断线（2026-09-27）

- 阅读位置补验：原截图没有前置锚点，不能据此认定跳动。现沿用同一APK，从同一实际子会话分别定位末尾回复及中段较早消息，再停止真实网关、四次持续离线采样并恢复。`scrollTop`分别始终为938.667/469.333 CSS px，内容高1358不变，消息key/正文不变且始终与视口相交；离线提示使视口起点346→348、高度419→417，消息同移2px，相对视口偏移不变，重连全部恢复。两轮末尾确认仍须重新选择、会话身份/草稿保留，opens=0、errors为空。没有复现此前怀疑的阅读跳动，不修改产品滚动代码。
- 来源：[末尾报告](../../artifacts/desktop-apps-disconnect-aside-reading.json)、[中段报告](../../artifacts/desktop-apps-disconnect-aside-middle.json)，脚本`--aside --reading`和`--aside --middle`；[末尾离线截图](../../artifacts/desktop-apps-disconnect-aside-reading-offline.png)与[中段离线截图](../../artifacts/desktop-apps-disconnect-aside-middle-offline.png)已查看。首次使用错误消息CSS选择器导致前置检查失败，修正为实际article语义；随后严格小于2px的末尾距离断言误判视口变化，调整为4px边界并同时核验相对消息锚点，完整重跑通过。保留[选择器失败](../../artifacts/desktop-apps-reading-selector-failure.json)和[2px观察](../../artifacts/desktop-apps-reading-two-pixel-observation.json)，不是生产bug修复。
- 最终DSH50364保持、网关恢复23040，手机回原联调聊天。此专项覆盖当前子会话末尾/中段阅读及准备确认时的真实中继断线；不扩展为任意插件高度突变、手机旋转或所有弱网场景通过。此次仅更新验证脚本及证据，未重新构建APK或改Key/权限、发送模型请求。

- 状态：沿用0.1.49及当前APK，MuMu真实网关中断/恢复专项通过；维护角色：项目协作Agent；核验2026-09-27。来源：[验收脚本](../../scripts/verify-desktop-apps-disconnect-android.mjs)的`--aside`入口、[实际报告](../../artifacts/desktop-apps-disconnect-aside.json)。
- 从原联调聊天进入既有归档父聊天的子会话旁栏，用原应用按钮选择VS Code并准备确认。停止身份/端口已核验的网关21480后，旁栏旧确认及应用按钮卸载；恢复为20712后不自动确认或打开，重新选择取得不同快照且两次请求使用同一子会话身份。取消后返回父聊天、再回原联调聊天，原有草稿保持，opens=0、errors为空。此轮草稿没有另外写入非空标记，不能作为新的非空恢复专项。
- [断线截图](../../artifacts/desktop-apps-disconnect-aside-offline.png)与[恢复截图](../../artifacts/desktop-apps-disconnect-aside-recovered.png)已查看。DSH50364保持，最终3080/8787均监听；无模型请求、应用启动、Key/设备权限或生产代码变化。脚本语法检查通过，不重复宣称上一轮构建为本轮构建。
- 此前待核实观察已由上方末尾/中段锚点专项补验；原截图本身仍不能作为阅读位置证据，以新增报告的测量范围为准。
- 本项补齐“准备完成但尚未确认”的旁栏断线；实际撤权、启动在途未知结果及完整Remote仍继续。网页转发仍暂不实施、范围待定。

## 电脑应用图标接入（2026-09-27）

- 状态：插件0.1.49、配套网关/APK及四文件图标补丁已安装，MuMu真实Windows图标通过；维护角色：项目协作Agent；核验2026-09-27。来源：[图标扩展与详细证据](../../../plugin/compatibility/desktop-app-icons/README.md)。
- 新扩展复用原应用目录和iconOf缓存，固定应用ID、256 KiB返回上限、取消/卸载拒绝交付，原网页鉴权和路径解析保持。四文件包叠加desktop-apps-v1，restore保留原应用打开能力；五项核心/四项副本安装及原九项服务回归、严格编译通过。
- 固定`remote.desktopAppIcon`及`desktopAppIcons`能力协商已接通，原生白名单同步；手机顺序读取并核验ID、PNG/SVG、base64和256 KiB上限，只使用img，不内联SVG。旧电脑或读取失败回退通用图形；关闭/切换/断线取消，原打开/准备行为保持。源码见[协议](../../../docs/protocol.md#指定电脑应用打开工作区)、[请求](../../src/remote-desktop-apps.mjs)、[共享图标](../../src/ui/RemoteDesktopAppIcons.jsx)。
- 18:16:50 UTC真实MuMu从普通聊天抽屉进入Remote专用会话，自有列表、原主聊天按钮/菜单、归档子会话旁栏菜单均解码四种32×32 PNG：explorer 1571字节、cursor 1252、vscode 1090、intellij 1027。不是静态品牌占位图。主/旁栏VS Code选择取消、各自会话身份及草稿保持，最后回原聊天，无open/模型请求或Key/权限修改，页面与资源错误为空。见[实际脚本](../../scripts/verify-desktop-apps-android.mjs)、[报告与图标SHA256](../../artifacts/desktop-app-icons-android.json)、[列表](../../artifacts/desktop-app-icons-list-android.png)、[主菜单](../../artifacts/desktop-app-icons-header-menu-android.png)、[旁栏菜单](../../artifacts/desktop-app-icons-aside-menu-android.png)，截图已查看。背景余额不足/读取失败为历史聊天，不是本轮新请求。
- 六项手机请求测试、33项插件适配测试、六项后端固定协议/真实HTTP-WebSocket路由测试，类型检查、Web/APK构建及Android lint通过；正式组件CSS下的[页面回放](../../artifacts/desktop-apps-web.json)也通过图标解码，回放响应为明确夹具。日志见[手机测试](../../artifacts/desktop-app-icons-tests.log)、[插件测试](../../../plugin/artifacts/desktop-app-icons-tests.log)、[后端测试](../../../backend/artifacts/desktop-app-icons-tests.log)、[Android构建](../../artifacts/desktop-app-icons-gradle.log)。实际DSH50364/网关21480监听正常，图标安装plan为4/4。最初报告压缩器误使用result而非value字段，已修正并将实际报告转为字节数/哈希，不改变生产响应或运行结论。
- 后续保留：其他应用实际启动、实际撤权、启动在途未知结果、旁栏真实断线及完整R01–R16/A03–A06。图标能力不等于完整R16完成。电脑网页转发暂不实施，首版延期尚未得到用户确认。

## 打开应用确认期间的真实断线（2026-09-27）

- 状态：MuMu两个主聊天入口实际网关中断/恢复通过；维护角色：项目协作Agent；核验2026-09-27。沿用当前APK，没有修改生产协议或页面代码。
- [实际脚本](../../scripts/verify-desktop-apps-disconnect-android.mjs)分别从Remote选项和原插件按钮选择VS Code，等待电脑准备完成后，由执行者核验PID、程序和监听端口并停止真实网关。自有窗口移除确认并显示连接中，原插件入口连同确认窗口收起；重连不自动打开应用，两种入口重新选择后取得与此前不同的确认快照。取消并关闭后原草稿保持，两个报告opens=0、errors为空。见[自有菜单](../../artifacts/desktop-apps-disconnect-menu.json)与[原插件按钮](../../artifacts/desktop-apps-disconnect-header.json)。
- 断线/恢复截图已查看：[自有菜单断线](../../artifacts/desktop-apps-disconnect-menu-offline.png)、[自有菜单恢复](../../artifacts/desktop-apps-disconnect-menu-recovered.png)、[原按钮断线](../../artifacts/desktop-apps-disconnect-header-offline.png)、[原按钮恢复](../../artifacts/desktop-apps-disconnect-header-recovered.png)。首次观察脚本只接受“已断开”而漏掉自动“正在连接”，导致超时；实际旧按钮已移除，修正观察条件后重跑通过，[失败记录](../../artifacts/desktop-apps-disconnect-observer-failure.json)保留。
- DSH18868持续运行，最终网关恢复为77392并确认8787监听，手机恢复原联调聊天。没有新模型请求、电脑应用启动、Key/模型设置或设备权限变化。临时原生桥旁听只记录三项固定操作的确认快照/打开数量，结束恢复原函数；没有修改响应或伪造网络状态。
- 本项证明“准备完成但尚未确认”时的主聊天断线恢复；不替代实际设备撤销、启动请求已经发出时的未知结果、旁栏真实断线和其他应用启动。完整R16与Remote仍未完成，应用图标继续待接入。

## 原打开应用按钮与旁栏（2026-09-27）

- 状态：新版APK已安装，主聊天与旁栏原入口通过MuMu实际选择/取消；维护角色：项目协作Agent；核验2026-09-27。完整R16仍未完成。
- [原按钮适配](../../src/ui/RemoteDesktopAppAction.jsx)保留原 ui-open-in-app 菜单和应用选择，只把动作交给[共用确认页](../../src/ui/RemoteDesktopApps.jsx)。按当前模型/会话读取原电脑目录，旁栏使用自己的会话；电脑插件可用且能力协商成功才显示，卸载/断开清理。应用图标暂用通用图形，真实图标传输仍待实现。
- 真实MuMu首次发现菜单被外层裁剪，点击落到聊天内容，[失败报告](../../artifacts/desktop-apps-header-clipped-android.json)保留。[构建适配](../../scripts/remote-desktop-app-sources.mjs)只启用原Menu的portal接口，不取消整个插件外层缩放/裁剪，也不修改只读参考。相比扩大父容器，浮层不破坏长插件和横向溢出的既有边界。
- 新版APK于17:48:44 UTC从普通聊天抽屉进入Remote原联调聊天，原菜单选择VS Code进入自有确认页后取消；再打开已归档专用父聊天的原子会话旁栏，同样选择/取消。实际固定协议记录证明旁栏使用不同sessionId，两侧草稿保持，最终返回原联调聊天，页面/资源错误为空。本轮无open操作、无模型请求、无Key/设备权限修改，不能当作VS Code实际启动验收。见[验收脚本](../../scripts/verify-desktop-apps-android.mjs)、[实际报告](../../artifacts/desktop-apps-aside-android.json)、[主聊天截图](../../artifacts/desktop-apps-header-confirm-android.png)、[旁栏截图](../../artifacts/desktop-apps-aside-confirm-android.png)，截图已查看。
- 带正式基础布局和组件CSS的[页面回放](../../artifacts/desktop-apps-web.json)通过原菜单、旁栏会话隔离、卸载隐藏，以及取消/未知结果/断线迟到边界；协议响应为明确回放。13项请求/插件策略测试、Web/APK构建和Android lint通过，日志见[单测](../../artifacts/desktop-apps-header-unit.log)、[构建](../../artifacts/desktop-apps-header-gradle.log)。
- [日常入口收尾](../../artifacts/desktop-apps-header-cleanup.json)通过原聊天、插件指南无交互终端、历史命令详情与草稿保留。检查脚本先前只等文章数量增长，最后一页合并已有节点并移除翻页入口时误超时；已接受历史入口消失，[原失败记录](../../artifacts/desktop-apps-cleanup-pagination-failure.json)保留。历史退出7和乱码保持原记录，没有执行新命令。83份文档本地链接校验通过。
- 后续保留：原应用图标、其他应用真实启动、确认期间真实断线/撤权、完整Remote验收。电脑localhost网页转发暂不实施；首版延期仍是建议，尚未确认取消原范围。

## 指定电脑应用手机接入（2026-09-27）

- 状态：插件0.1.48、配套网关和APK已安装；维护角色：项目协作Agent；核验日期：2026-09-27。本节替代下方服务前置阶段的“未接入”状态，完整R16仍未完成。
- 「Remote选项→在电脑应用中打开」使用DSHM自有页面；电脑按原可见会话查询cwd、原fs目录及Host映射解析目标。只传会话/应用选择器、五分钟一次性确认，绑定设备连接与服务；不接受手机任意路径/命令，不提供手机交互终端。来源：[电脑适配](../../../plugin/src/desktop-apps.ts)、[协议](../../../docs/protocol.md#指定电脑应用打开工作区)、[手机请求](../../src/remote-desktop-apps.mjs)、[页面](../../src/ui/RemoteDesktopApps.jsx)、[Android原生入口](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)。
- 17:30:25 UTC实际MuMu从日常普通聊天抽屉进入Remote、专用测试会话，再由正式菜单读取 explorer/cursor/vscode/intellij，核对电脑与DSH-TEST工作区，先取消再确认资源管理器打开。固定操作真实返回成功，Windows Shell核对新窗口路径与目标一致，之后仅关闭本次新窗口。没有模型请求或Key/模型/设备权限变化；草稿保留、页面与资源错误为空。见[实际报告](../../artifacts/desktop-apps-first-open-android.json)、[窗口证据](../../artifacts/desktop-apps-window-proof.json)、[列表截图](../../artifacts/desktop-apps-list-android.png)、[确认截图](../../artifacts/desktop-apps-confirm-android.png)，截图已实际查看。
- 首次脚本缺少App启动等待，已修正；随后真实入口发现Android操作白名单漏接，补齐三操作、重建安装后才通过。失败证据保留为[启动时序](../../artifacts/desktop-apps-startup-race.json)及[原生白名单缺口](../../artifacts/desktop-apps-native-policy-failure.json)。浏览器回放不能替代原生链路，此缺口由实际MuMu发现。
- 手机四项请求测试通过；实际RemoteWorkspace菜单回放覆盖取消零启动、确认一次、未知结果不重试、断线迟到丢弃、重连重读与旧电脑提示，见[单测](../../artifacts/desktop-apps-phone-tests.log)、[页面回放](../../artifacts/desktop-apps-web.json)。其数据为明确隔离替身，不是实际撤权验收。插件31项、后端6项及两端类型检查、Web/APK构建、Android lint通过；[原聊天/只读命令收尾](../../artifacts/desktop-apps-cleanup.json)无错误。
- 后续：其他应用实际启动、确认期间真实断线/撤权及完整R01–R16/A03–A06继续。原ui-open-in-app局部入口进展见上节。电脑网页转发暂不实施、范围待定，不能将此本地应用打开算作网页远程预览。资源管理器在电脑显示，手机仍只显示DSHM页面。

## 指定电脑应用打开工作区：服务前置（2026-09-27）

- 安装进展：七文件源码/编译包已安装到实际DSH，真实源码入口的只读服务验证识别四个可用应用，重复读取及取消拒绝通过。六项安装器测试覆盖副本还原、重复操作、失败回滚与未知/链接拒绝；真实F盘还原和真实应用启动未执行。临时插件已卸载、DSH恢复，原手机聊天/草稿/只读命令收尾无错误。详见[安装与证据](../../../plugin/compatibility/desktop-apps/README.md#安装与实际服务验证2026-09-27)。下方“尚未安装”为前一批状态，协议与手机入口仍未接入，R16不算完成。

- 状态：兼容补丁代码已准备，尚未安装；维护角色：项目协作 Agent；核验日期：2026-09-27。源码依据与下一步见[服务补丁](../../../plugin/compatibility/desktop-apps/README.md)。原 ui-open-in-app 直接访问网页登录路由，仍不能在手机启用，R16保持未完成。
- 两处源码副本让原网页和电脑内部服务共用应用探测/启动，并在取消或卸载后阻止备用启动；九项隔离测试、严格源码及插件类型检查通过。平台探测、鉴权判断和进程启动为测试替身，不是实际手机或电脑应用验收。生产DSH、网关、APK及上游参考未修改。
- 后续须先完成可回滚安装与已有会话工作区归属核验，再接固定协议、手机自有选择/确认页及真实窗口验收；不以开放任意HTTP或客户端任意路径代替。本项与暂不实施的电脑网页转发分开。

## 跨会话后台系统通知（2026-09-27）

- 状态：MuMu Android 12 实际入口通过；维护角色：项目协作 Agent；核验日期：2026-09-27。来源：[验收脚本](../../scripts/verify-cross-background-notification-android.mjs)、[最终报告](../../artifacts/cross-background-notification-android.json)、[系统通知截图](../../artifacts/cross-background-notification-system.png)。沿用现有 APK，没有改生产实现。
- 在既有「DSHM Remote 联调提示」保留非空测试草稿，手机退到桌面；另一个既有「DSHM 电脑端对照测试询问」由电脑原 userQuestions 服务发起提问。点击系统通知的实际可见文字后进入正确目标会话，取消问题回电脑 ASK_CANCELLED；目标原草稿保持，返回来源会话后测试草稿完整，最后恢复原文本，系统通知已清除，页面 errors 为空。没有模型请求、Key 或授权变化。
- 测试插件 0.0.6 仅扩展到第二个专用会话，通知和问答走原生产通道。初次脚本误匹配通知文案，第二次标题查询命中隐藏区域，截图实际已到目标会话；修正选择器后完整重跑通过。失败轮问题由取消或原服务超时释放，不将工具失败算作产品缺陷。没有伪造通知或打开受保护 Activity 的替代入口。
- 临时插件已卸载并重启 DSH，控制文件删除；等待重连后[日常入口收尾](../../artifacts/cross-background-cleanup.json)确认插件入口消失、原聊天/草稿与只读命令历史正常，errors/resources 为空。首次收尾过早读到卸载前页面，重连后的结果为最终依据。
- 此项证明单条后台系统通知跨会话导航与非空文字草稿保留；11:23另补齐[后台进程回收后点击已有通知](./notifications-current.md#后台进程回收后点击已有通知2026-09-27)的真实新进程恢复、双边草稿与取消同步。不同会话后台连续点击竞争、Android 13 权限及完整 A04 仍待验证。网页转发仍暂不实施、范围待定。

## 连续通知导航不丢失（2026-09-27）

- 后台不同会话补验：2026-09-27 11:51香港时间，实际系统通知的两次点击在第一条回执受控暂缓时仍只确认最后目标；两题取消、双方草稿与通知清除通过，详见[后台专项及边界](./notifications-current.md#不同会话后台连续点击2026-09-27)。此项补足下方历史记录中后台连续点击的缺口，不等同多条通知跨进程竞争或Android13权限通过。

- 不同会话补验：[MuMu 16:51:08 UTC 报告](../../artifacts/notification-queue-cross-android.json)通过两个既有专用聊天的连续真实提问横幅。第一条目标读取回执暂缓期间点击第二条，原生依次给出两个不同会话 ID，页面最终进入第二个聊天且只确认第二个点击，确认回执成功。两题均取消回电脑 ASK_CANCELLED，返回来源聊天，双方原草稿保持、errors 为空。入口为同一[脚本](../../scripts/verify-notification-queue-android.mjs)的 `--cross`，仍原样转发真实生产请求和回执；[第二条横幅](../../artifacts/notification-queue-cross-1.png)已核对。此项补足下方“不同会话未验证”的历史缺口，不代表进程重建、后台连续点击或任意真实弱网。
- 此轮仅扩展验收脚本，沿用 APK；临时插件经原 CLI 卸载并恢复 DSH，控制文件与桥探针清理，日常入口收尾见[清理报告](../../artifacts/notification-queue-cross-cleanup.json)。未改变 Key、绑定、权限或发送模型请求。

- 实际入口补验：[2026-09-26 16:34:39 UTC MuMu 报告](../../artifacts/notification-queue-live-android.json)已通过同一专用会话的两条真实提问横幅。第一条 `notifications.take` 的真实原生回执暂缓，点击第二条后释放；页面取得两个不同点击 ID，只确认第二个，原生确认回执成功，窗口退出并恢复聊天阅读。两个原问题分别收到 ASK_CANCELLED，原空草稿保持、errors 为空。使用现有已安装 APK，没有修改生产逻辑、Key、绑定、权限或发送模型请求。
- [实际脚本](../../scripts/verify-notification-queue-android.mjs)只旁听原生读写并暂缓第一次回执，释放原始内容；没有伪造通知目标、认证或电脑响应。独立[电脑夹具](../../tests/fixtures/live-interactions-plugin/index.js)通过原 userQuestions 服务发起最多四个并行测试请求，结果使用各自控制 ID。[第二条横幅截图](../../artifacts/notification-queue-live-1.png)已核对，物理点击坐标仅在已验证 MuMu 尺寸一致时使用。
- 初跑重启后旧标题尚存，但电脑运行时未恢复，原服务返回未找到 live Agent；改为从列表重新进入并等待列表在线状态后执行。第二次脚本误在聊天页等待仅列表存在的连接灯，已移到正确入口。准备阶段失败不计功能失败；[首个成功报告](../../artifacts/notification-queue-live-passed.json)仅记录确认发送，最终重跑还核对了真实原生确认回执。控制文件与探针已清理，临时插件经原 CLI 卸载并恢复 DSH，日常入口收尾见本节后续记录。
- [卸载与恢复后的收尾](../../artifacts/notification-queue-live-cleanup.json)确认临时插件入口消失、原测试聊天/草稿及只读历史命令正常，errors/resources 为空。3080/8787 监听、控制文件不存在。此轮只扩展验证脚本与夹具，沿用前轮 APK，未将前轮构建结果作为新构建。
- 实测范围为同一 Activity、同一会话两个不同点击 ID，并对原生回执进行受控暂缓；不同会话目标、后台系统通知点击、跨 Activity/进程及任意真实弱网仍未由本项证明。下方“实际连续通知待实测”的早期结论由此专项部分更新，不能泛化为完整 A04。

- 状态：修复通知打开期间忽略新点击的问题。维护角色：项目协作 Agent；核验日期：2026-09-27。来源：[实际页面导航](../../src/RemoteApp.jsx)、[原生目标保存与消费](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNotifications.kt)、[页面恢复脚本](../../scripts/verify-remote-app-recovery.mjs)。只调整页面调度，保持原生绑定核验、点击 ID 及确认协议。
- 原实现遇到 opening 直接返回；原生仍保存后点击的目标，但旧请求完成后没有再次读取。[修复前回归](../../artifacts/notification-queue-before.log)在原生目标读取被暂缓、会话选择被暂缓、旧选择最后失败三种时序均未打开最新目标。
- 现在以点击代次忽略旧请求结果和错误，合并期间新增的点击，在当前操作结束后重新读取原生最新目标；不是失败自动重试。点击时记录当前会话导航序号，如果用户随后主动选择其他聊天，不再执行排队的旧意图。目标读取期间的手动导航同样受保护，只有实际打开且仍有效的目标被确认消费。
- [15项页面回归](../../artifacts/notification-queue-after.log)通过：三种连续点击仅确认最后目标、旧错误不覆盖成功页面，直接或排队后的手动导航保留新页面和未消费通知；非空草稿及原连接恢复用例保持。夹具的确认语义已按原生按 ID 消费实现，避免测试中旧确认错误地清除新目标。专项使用真实 RemoteApp 配隔离生命周期依赖，不是伪造生产认证，也不冒充真实系统通知连续点击。
- [Web 构建](../../artifacts/notification-queue-build.log)、[APK/lint](../../artifacts/notification-queue-android-build.log)通过，最终 APK 已安装；[MuMu 实际入口](../../artifacts/notification-queue-cleanup.json)验证普通抽屉进入 Remote、既有测试聊天/插件面板/只读命令历史及原草稿保持，errors/resources 为空。真实连续通知的跨 Activity/进程与完整 A04/Remote 仍待实测；单条真实横幅三类遮挡证据见下一节。此轮不改电脑服务、插件、Key、授权或网页转发范围。

## 通知点击退出聊天遮挡（2026-09-27）

- 状态：修复点击指向当前会话的通知后，设置窗口仍挡住聊天的问题。维护角色：项目协作 Agent；核验日期：2026-09-27。来源：[通知导航](../../src/RemoteApp.jsx)、[共享聊天窗口](../../src/ui/RemoteWorkspace.jsx)、[实际横幅脚本](../../scripts/verify-occluded-notifications-android.mjs)的 `--click` 分支。
- 原实现只按选中会话 ID 关闭窗口；同一会话的通知导航完成后 ID 未变，已消费的提醒仍停留在遮挡页。现在成功读取且导航请求仍有效后发布展示标识，主聊天关闭自身窗口并收起插件旁栏；保留旁栏标签、聊天与草稿。导航被新的会话选择取代、读取失败或断线时，不发布展示标识，也不消费通知。
- [真实修复前](../../artifacts/notification-click-failure-before.json)中可见聊天的提醒正确抑制，但设置窗口上点击横幅后阅读回执一直为空。[修复后 MuMu](../../artifacts/notification-click-after.json)于 2026-09-26 16:18:27 UTC（本地 09-27）通过可见聊天抑制，以及会话权限 sheet、原插件 Modal、非聊天旁栏三种真实横幅点击；窗口退出、恢复目标聊天阅读、原空草稿保留。四个问题均来自电脑原 `userQuestions.ask`，手机取消后电脑返回 ASK_CANCELLED，无系统通知和页面错误，没有模型请求或权限/Key修改。
- 验证用临时插件只在既有专用聊天创建原提问，未替换通知或认证响应。MuMu 的非聚焦 PopupWindow 不进入无障碍树，初次按描述查找超时；查看实际 786×1624 截图后，脚本在尺寸一致时点击横幅中心。最初重试又在关闭遮挡前查找编辑器，已调整顺序；这两次测试工具失败不计产品验收。有效产品失败和最终成功报告分别保留。
- [10 项连接页面回归](../../artifacts/notification-click-page.log)含通知成功、读取失败、被后续导航取代及非空草稿保留；这是实际 RemoteApp 配隔离模型生命周期，不冒充真实网络竞争。[完整原插件页面回归](../../artifacts/notification-click-browser.log)、[Web 构建](../../artifacts/notification-click-build.log)、[APK/lint](../../artifacts/notification-click-android-build.log)通过。最终 APK、临时插件卸载及服务恢复后的日常入口收尾见本节后续记录。
- [原 CLI 卸载临时插件](../../artifacts/notification-click-plugin-remove.log)后已恢复 DSH，并安装最终 APK；[日常入口收尾](../../artifacts/notification-click-cleanup.json)确认测试插件入口移除、原聊天/草稿及只读命令正常，errors/resources 为空。3080/8787 正常监听，原绑定/聊天权限保持。控制文件已清理；初次失败留下的问题由原服务超时释放，最终四个请求均已收到取消回执。
- 边界：本次实际设备验证同一会话三类遮挡和空草稿；非空草稿/导航竞争为隔离回归。任意第三方弹窗取消约定、连续不同通知竞争、Android 13 通知权限及完整 A04/Remote 仍不能据此视为完成。网页转发继续暂不实施、范围待定。

## 版本不兼容提示与重试（2026-09-27）

- 状态：区分通信版本和 DSH 版本不兼容，提供对应处理提示；已有绑定保留。维护角色：项目协作 Agent；核验日期：2026-09-27。来源：[能力协商](../../src/remote-transport.mjs)、[连接页](../../src/RemoteApp.jsx)、[翻译](../../src/ui/translations.mjs)。不改变兼容版本要求、认证或电脑能力。
- 原协商统一抛出 unsupported_remote_version，但页面缺少该错误映射，只显示“连接未完成，请重试”。现在通信版本不符提示更新 App、电脑插件及中转服务；DSH 版本不符提示使用配套版本，避免一味升级到未支持版本。通过协商前不发布能力或调用后续 RPC。
- [修复前协商回归](../../artifacts/version-feedback-before.log)及[页面回归](../../artifacts/version-feedback-page-before.log)已复现差异；[9 项协商检查](../../artifacts/version-feedback-transport.log)和[7 项页面恢复检查](../../artifacts/version-feedback-page.log)通过。两类错误均保留绑定、提供重新连接；页面重建失败后的手动重试恢复选中会话、草稿及引用结构、输出位置、旁栏和列表筛选，旧实例释放。页面专项使用真实 RemoteApp 配隔离生命周期依赖，协议检查使用真实客户端配测试应答，不冒充真实服务的负向验收。
- [Web 构建](../../artifacts/version-feedback-build.log)、[APK 与 lint](../../artifacts/version-feedback-android-build.log)通过，新版已安装。[MuMu 实际入口](../../artifacts/version-feedback-cleanup.json)于 2026-09-26 16:08:52 UTC（本地 09-27）通过普通抽屉进入 Remote、读取既有测试聊天、插件面板及只读历史命令，原草稿保留，errors/resources 为空；命令中的 exit 7 是已有历史。没有发送模型消息、更改 Key、绑定或电脑授权。
- 边界：实际 Android 验证当前兼容版本的正常入口；未替换真实 DSH/网关制造版本不兼容，也未据此证明完整升级迁移。其余 Remote 范围继续，模型审批/引用解析仍受余额限制。网页转发暂不实施，首版暂缓仍为建议，未视为用户已确认移出范围。

## 引用恢复与结构不一致保护（2026-09-26）

- 状态：共享编辑器挂载修复后，文件/聊天引用通过新版 Android 重启与主旁栏交接；另修复结构可解析但文字不一致时静默降级的问题。维护角色：项目协作 Agent；核验日期：2026-09-26。来源：[恢复逻辑](../../src/remote-input-session.mjs)、[原编辑器契约回归](../../tests/fixtures/remote-input-checks.mjs)、[实际引用脚本](../../scripts/verify-input-handoff-android.mjs)。
- `restoreDraft` 原先对“结构投影与保存文字不一致”直接返回，随后可把引用当作普通文字发送。现在进入已有恢复失败分支，保留原结构和提示、拒绝提交；用户明确重新编辑后解除保护。其他入口已经更新了文字的旧快照仍由前置版本内容检查忽略，不覆盖较新草稿。
- [修改前回归](../../artifacts/reference-mismatch-before.log)复现未标记失败；[完整页面回归](../../artifacts/reference-mismatch-browser.log)通过新增不一致结构拒绝发送/保留原件/明确编辑恢复，以及原引用序列化、卸载、交接、提交中取消与原有页面用例。此异常分支用真实编辑器配隔离发送回调，不是损坏用户手机数据或真实模型发送验收。
- [Web 构建](../../artifacts/reference-mismatch-build.log)、[APK/lint](../../artifacts/reference-mismatch-android-build.log)通过，新版已安装。[15:58:48 UTC MuMu](../../artifacts/cold-reference-android.json)经真实 @ 提供方选择本次测试文件与既有测试聊天，分别通过主聊天→旁栏同会话→主聊天，以及两次 force-stop/重开；来源和标签均保持。已查看[聊天引用截图](../../artifacts/cold-reference-chat-android.png)。没有发送消息、改电脑授权、核心 bundle 或 Key。
- 原空草稿和原聊天已恢复，专用会话仍归档；本次文件和空目录已删除。[15:59:07 收尾](../../artifacts/cold-reference-cleanup.json)原聊天/草稿/只读命令正常，errors/resources 为空。初跑真实功能已通过但清理误把空段落换行当作内容，修正判断后完整重跑；初跑残留文件核对路径和固定内容后单独删除。
- [冷启动文字回归](../../artifacts/reference-mismatch-cold-draft.log)仍通过。曾仅检查内存及尚未出现的保存提示就重载，导致“主动清空”检查过早；现在在重载前独立读取 IndexedDB 确认目标记录已提交，避免将未完成的写入当作持久化成功。早期失败记录保留。上一产品版 367 项 Node 证据不冒充本轮重跑，本轮新增契约用例在完整浏览器回归执行。
- 范围：此次 Android 验证正常引用恢复；结构不一致保护仅原编辑器回归，实际模型解析引用仍受余额限制。其他附件类型、完整升级迁移与异常、R01–R16/A03–A06继续，网页转发仍在评估必要性且不实施。

## 冷启动草稿被空编辑器覆盖（2026-09-26）

- 2026-09-27 当前 APK 复测：[15:10 UTC 实际清理组](../../artifacts/remote-cache-android.json)从普通设置执行“确认清理”，随后 force-stop/重开；17 条普通聊天、15 轮消息、9 条普通草稿及 Key“已配置”保持，Remote 同页文字草稿与既有回复保持，重开后原绑定连接且草稿恢复，errors 为空。测试标记已从编辑器和 IndexedDB 清除，回普通首页；无模型请求或电脑配置变更。这里只证明文字草稿和既有内容保留，不代替全部数据逐字节核对或版本迁移。
- 审计纠正：此前并非没有清理组证据，下面的 remote-cache-after.json 已记录实际清理通过；收尾表只读取后来被控制组覆盖的同名报告而漏引。脚本现将控制组独立输出到 remote-cache-control-android.json，并在恢复后等待持久化清理，避免再次覆盖或过早判断。生产代码及 APK 未变。

- 状态：修复 Remote 打开已有聊天时空编辑器覆盖手机持久草稿的问题。维护角色：项目协作 Agent；核验日期：2026-09-26。来源：[输入绑定挂载](../../src/remote-input-bindings.mjs)、[草稿读写](../../src/remote-drafts.mjs)、[选择恢复顺序](../../src/remote-session-view.mjs)、[实际清缓存与重启脚本](../../scripts/verify-remote-cache-android.mjs)。
- 实际发现：从普通设置清缓存，17 条聊天、15 轮消息、9 条本地草稿未变，已打开 Remote 页面和测试草稿保留；结束 App 后重开，草稿却消失。[存储探针](../../artifacts/remote-cache-storage-failure.json)确认清理前后均有测试记录，重开后没有；[不清缓存对照](../../artifacts/remote-cache-control.json)同样失败，排除了缓存动作。探针只返回固定测试文字是否存在，不输出草稿数据库内容、Key 或绑定凭据。
- 根因：原插件在选择完成前可以通过 input.for 预创建空 shell；旧 mount 分支直接赋 reference 并复用它。随后 setRootElement 触发内容提交，空内容先写回模型与存储，晚于挂载的 sync 已无原草稿可用。当前每次实际挂载调用已有 replace，从已恢复的手机状态创建编辑器，并沿原交接保留引用结构、提示及共享 target。没有改原插件内部或延迟用户输入。
- [浏览器修复前](../../artifacts/remote-cold-draft-before.log)使用生产 RemoteModel、原编辑器、真实 IndexedDB 和隔离电脑协议复现空写入；[修复后](../../artifacts/remote-cold-draft-after.log)通过预存文字、编辑后重载、主动清空后重载。暂时的写入调用栈探针已移除；回归位于[真实页面夹具](../../tests/fixtures/remote-plugin-slots.jsx)和[页面脚本的 --cold-draft 分支](../../scripts/verify-remote-plugin-slots.mjs)。
- 新版 APK 已安装。[15:51:59 UTC MuMu](../../artifacts/remote-cache-after.json)经实际设置清缓存，再 force-stop 和重开，测试记录在清理前、清理后、重开后均存在；同一页面草稿/原回复保留，冷启动沿原绑定连接，Key 仅核对“已配置”、本地统计相同。[15:52:42 不清缓存对照](../../artifacts/remote-cache-control-after.json)也通过；测试草稿已恢复原空值且存储中测试标记已移除。[重启截图](../../artifacts/remote-cache-after-restart-android.png)已查看。未发送模型消息或修改电脑数据、Key、绑定、权限。
- [367 项 Node](../../artifacts/remote-cold-draft-tests.log)、[完整页面回归](../../artifacts/remote-cold-draft-browser.log)、[Web 构建](../../artifacts/remote-cold-draft-build.log)、[APK/lint](../../artifacts/remote-cold-draft-android-build.log)通过；[15:52:50 收尾](../../artifacts/remote-cache-cleanup.json)确认原聊天、草稿、指南和只读历史命令正常，errors/resources 为空。DSH 3080、网关 8787 保持运行。脚本首次匹配折叠记录而超时，已改为实际可见记录，保留失败报告。
- 范围：证明当前设置清理不会删除上述数据，并修复当前原编辑器挂载的冷启动文字草稿覆盖。该操作仍是 WebView 临时缓存清理，不销毁活动插件或用户数据，也不宣称清空所有第三方自管缓存。当前新版 Android 未重跑全部引用附件、主/旁栏并发、所有升级版本迁移，完整 A06/Remote 继续；真实模型审批/引用受余额限制，网页转发必要性待定。

## 插件依赖诊断（2026-09-26）

- 状态：手机电脑插件列表增加缺少依赖及加载失败的处理建议，具体依赖可展开查看；已有版本/接口限制原因优先保留。维护角色：项目协作 Agent；核验日期：2026-09-26。来源：[共享列表](../../src/ui/RemotePlugins.jsx)、[真实加载状态](../../src/remote-plugin-policy.mjs)、[验证夹具](../../tests/fixtures/missing-dependency-plugin/README.md)。不修改原插件内部、加载判定或授权策略。
- [Web 构建](../../artifacts/plugin-dependencies-web-build.log)、[完整页面回归](../../artifacts/plugin-dependencies-browser.log)、[APK 与 lint](../../artifacts/plugin-dependencies-android-build.log)通过，新版已安装。实际 DSH 安装独立缺依赖包后，[MuMu 15:27:49 UTC 报告](../../artifacts/plugin-dependencies-android.json)确认 waiting、缺少的服务名称、展开详情、无横向溢出及草稿保留；[截图](../../artifacts/plugin-dependencies-android.png)已查看。未以测试数据替代生产加载器状态。
- 临时包经原 CLI 卸载并恢复 DSH；[15:32:37 卸载复验](../../artifacts/plugin-dependencies-removed-android.json)确认列表已移除，草稿保留、errors 为空。[日常 App 回归](../../artifacts/plugin-dependencies-cleanup.json)确认原聊天、指南和只读历史命令正常，errors/resources 为空；历史 exit 7 是原记录。DSH 3080 与网关 8787 监听，Key、原绑定与聊天权限保留。
- 本项证明缺少依赖诊断的实际入口；加载异常文案已接入，未单独制造真实第三方启动崩溃。不能据此宣称全部插件兼容或 A06 已完成。完整 R01–R16/A03–A06 继续；网页转发因用户提出带宽与必要性问题暂不实施，延期建议尚未获确认，保留范围待定。模型工具审批与引用读取仍受余额限制。

## 系统保存窗口中的进程结束与重试（2026-09-27）

- 状态：现有日常APK在MuMu实际附件入口通过，未修改产品代码。维护角色：项目协作Agent；核验2026-09-27。来源：[实际入口脚本](../../scripts/verify-save-picker-restart-android.mjs)、[最终Launcher入口报告](../../artifacts/save-picker-restart-android.json)、[私有暂存初始化](../../android/app/src/main/java/dev/dshmobile/validation/RemoteDownloadStore.kt)。
- 13:19香港时间，从专用会话打开真实85字节附件，点击下载并看到Android系统保存窗口；核对私有暂存SHA256与原附件相同后强制停止App，确认旧PID消失且暂存仍存在，没有执行正常关闭清理。未选择目的地，此时没有创建用户文件。
- 通过MAIN/LAUNCHER Intent和NEW_TASK/RESET_TASK_IF_NEEDED启动真实主页，再从抽屉进入Remote；PID25683→26436。原连接恢复、原草稿保持，下载存储初始化清除旧暂存，没有自动打开保存窗口或生成下载文件。重新打开同一附件，显式点击下载后实际系统保存成功，摘要仍一致；仅清理本轮新增且摘要核对过的副本，原文件保留、errors为空。
- [首次脚本](../../artifacts/save-picker-restart-initial-android.json)裸am start停在旧系统PickActivity，未启动App主进程，因此检查失败；不将该结果误报为App崩溃。修正后[前台启动对照](../../artifacts/save-picker-restart-foreground-android.json)通过，最终又使用上述Launcher入口验证通过。脚本现检查实际启动Activity，不把am start退出码视为App已恢复。
- 本项覆盖目的地尚未选择时的进程强制结束与实际重试；不涵盖目标文件正在写入、进程结束后删除外部半成品、后台低内存回收或其他文件提供方。R16其余缺口继续，电脑网页转发保持暂缓、范围待定。原绑定、Key、电脑配置和授权未改，未调用模型。

## 保存失败后半成品清理被拒绝（2026-09-27）

- 状态：已修复明确提示，原生受控提供方与两类文件预览回归通过；不等同所有云盘/真实提供方故障或进程回收验收。维护角色：项目协作Agent；核验2026-09-27。来源：[原生保存](../../android/app/src/main/java/dev/dshmobile/validation/RemoteDownloads.kt)、[共享传输与提示](../../src/remote-download.mjs)、[原生专项](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteSaveWriteChecks.kt)、[调试提供方](../../android/app/src/debug/java/dev/dshmobile/validation/RemoteSaveProbe.kt)。
- 原保存失败分支忽略deleteDocument的异常/false结果，用户无法得知半成品可能仍存在。独立UID的受控DocumentsProvider在512KiB管道写入首块后关闭管道并拒绝删除，原生回调没有保存成功，但缺少清理失败标记，[修改前检查](../../artifacts/save-provider-red-native.log)明确失败于delete-failure:cleanup。现在保留失败并返回download_cleanup_failed，手机提示“保存未完成，目标位置可能留有不完整文件，请检查后重新下载。”，同时提供英文翻译；不自动重试保存或反复删除。
- 共享传输保留原生明确的清理失败，不被迟到取消或连接变化改写成普通取消。[8项JS检查](../../artifacts/save-provider-js.log)通过，覆盖活动/取消/断线三条结果路径及单次保存。已关闭预览的生命周期仍禁止写入旧页面，本批不承诺关闭后或进程退出后能显示该提示。
- [Android原生结果](../../artifacts/save-provider-native.log)通过完整字节、写入中断线/主动取消/关闭、写入失败且删除成功、写入失败且删除被拒绝；最后一项明确核对半成品仍存在、删除只尝试一次、仅一次失败回执、暂存清理及后续连接可重新开始。仅用独立私有文件，不访问真实用户文件；清理阶段直接移除测试自身副本。此测试使用真实控制器/ContentResolver/管道，提供方故障受控，不冒充系统保存UI实际拒绝删除。
- [生产预览回放](../../artifacts/save-provider-ui-final.log)在原文档面板与历史附件回退预览均显示明确警告且无“已保存”；沿共享传输，原关闭取消/分享/完整字节回归保持。首版检查在卸载会话后打开原旁栏失败，调整验证顺序后通过，未改变产品挂载规则。[Web构建](../../artifacts/save-provider-web-build.log)、[独立APK](../../artifacts/save-provider-isolated-build.log)、[日常APK与lint](../../artifacts/save-provider-main-build.log)通过，正常包已覆盖安装，独立测试包已停止。
- 新版日常APK的[MuMu真实保存与分享回归](../../artifacts/save-provider-real-transfers.log)于2026-09-27 13:08香港时间通过：历史附件85字节、工作区文件19字节均经实际系统窗口保存，SHA256与电脑原件一致；两处实际分享面板打开后取消，未选择接收方。只删除核对过的本轮保存副本，原件与草稿保留，errors为空。真实正常路径和受控提供方故障证据分别成立，不将后者写成系统文件提供方实际拒绝删除。

## Android目标文件写入中取消（2026-09-26）

- 状态：原生保存控制器写入过程中断线、主动取消和关闭页面的确定性Android专项通过；本轮没有修改生产保存逻辑，只扩展调试提供方与原生检查。维护角色：项目协作Agent；核验2026-09-26。来源：[生产控制器](../../android/app/src/main/java/dev/dshmobile/validation/RemoteDownloads.kt)、[写入专项](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteSaveWriteChecks.kt)、[调试文档提供方](../../android/app/src/debug/java/dev/dshmobile/validation/RemoteSaveProbe.kt)。
- 独立验收包沿真实file.begin/chunk/finish/save和ContentResolver写入512KiB固定二进制内容。调试DocumentsProvider返回真实管道，读取首块并写到已登记的私有测试文件后暂缓消费；确认目标已部分写入、保存尚未回执，再改变连接代次并cancel、主动file.abort或close。释放管道后，三种取消均删除目标半成品和下载暂存；断线/主动取消仅一次download_expired回执，关闭后没有回执。正常对照逐字节完整且不删除目标；非关闭路径随后可建立新连接并完成新的空文件。
- [MuMu原生报告](../../artifacts/save-write-native.log)为PASS，[旧保存窗口回归](../../artifacts/save-write-picker-regression.log)也PASS，覆盖迟到文档删除、picker忙隔离与单次答复。两个检查均用独立UID和非秘密固定数据，没有真实网关故障、模型调用、Key读取或用户文件访问。它补足原生写入时序证据，不代替系统保存UI/真实远端链路；该入口的既有真实验收见下方“系统保存窗口断线取消”。
- [独立APK及测试包构建](../../artifacts/save-write-isolated-build.log)通过，测试目录已清理，独立包停止；[默认APK构建和lint](../../artifacts/save-write-main-build.log)恢复日常applicationId。[日常App回归](../../artifacts/save-write-cleanup.json)验证实际原聊天、空草稿、插件指南与只读历史命令，errors/resources为空，Key/原绑定/权限和两端服务保持。README现有保存取消说明仍准确，无新增用户操作。
- 边界：正在进行的一次系统write不保证被中途打断，保证返回失败后不交付成功并尽力删除半成品；删除失败的第三方提供方、任意云盘/弱网、进程被杀及保存完成后UI回执竞态仍不能据此宣称通过。完整R01–R16/A03–A06保持进行中，网页转发仍待定，模型工具审批/引用受余额限制。

## Worker资源在途撤销（2026-09-26）

- 状态：真实MuMu独立App通过插件Worker资源请求在途时的设备撤销；本轮只补验证工具/记录，沿用现有APK与正式协议。维护角色：项目协作Agent；核验2026-09-26。来源：[Android实际入口](../../scripts/verify-worker-revocation-android.mjs)、[本机响应暂缓代理](../../../backend/scripts/verify-device-output-proxy.mjs)、[原生资源隔离](../../android/app/src/main/java/dev/dshmobile/validation/RemoteResources.kt)。
- 独立设备“DSHM Worker 在途验收 033”核对两端指纹后只批准聊天权限，真实打开既有联调聊天，启动电脑安装的[独立Worker插件](../../tests/fixtures/worker-lifecycle-plugin/README.md)。点击“读取插件资源”后，本机代理观察到真实资源chunk并暂缓原始响应；[15:14:09 UTC报告](../../artifacts/worker-revocation-android.json)记录1个资源分片、4163字节暂缓数据、2条设备连接，线程仍运行且读取结果尚为空，见[撤销前截图](../../artifacts/worker-revocation-held-android.png)。
- 电脑公开设备页撤销033后，两条连接关闭，4163字节全部丢弃，工作区移除且Worker退出；恢复代理转发后旧授权[重连拒绝](../../artifacts/worker-revocation-denied-android.png)，没有重新创建线程，errors为空。截图已核对。本机代理不伪造权限、资源内容或撤销事件；此项证明资源尚未交付时真实撤销的生命周期，不声称强行注入旧帧到新连接，也不代替任意第三方插件清理行为。
- [3项帧转发检查](../../artifacts/worker-revocation-proxy-tests.log)与脚本语法检查通过。033已撤销，日常App原绑定/聊天权限及Key保持；[原CLI卸载](../../artifacts/worker-revocation-plugin-remove.log)临时插件后重启DSH，代理停止、ADB8787恢复直连。[清理后实际App回归](../../artifacts/worker-revocation-cleanup.json)通过原聊天、空草稿、插件指南及只读历史命令，errors/resources为空。历史exit7为旧记录。3080/8787恢复，9878/18794不再监听。
- 剩余：大资源多分片/弱网、工作区文件及系统保存写入竞态、主聊天前台输出撤销、第三方/性能和完整R01–R16/A03–A06继续；模型工具审批/引用受余额限制。网页转发当前不实施、首版必要性待定。本节更新下方Worker资源在途“未验证”的历史状态。

## 文件写入中撤销与插件线程释放（2026-09-26）

- 状态：独立MuMu测试App通过真实设备撤销，覆盖下载暂存清理、已运行插件Worker退出及旧授权重连拒绝；本轮只新增验证脚本，没有修改产品代码或重建APK。维护角色：项目协作Agent；核验2026-09-26。来源：[实际入口脚本](../../scripts/verify-file-revocation-android.mjs)、[独立配对工具](../../scripts/verify-remote-pair-valid-android.mjs)、[Worker夹具](../../tests/fixtures/worker-lifecycle-plugin/README.md)。
- 独立设备“DSHM 资源撤销验收 032”核对手机/电脑指纹后仅批准聊天权限，经自有页面打开既有联调聊天。[15:06:25 UTC报告](../../artifacts/file-revocation-android.json)：真实Worker启动并读取自身插件资源成功，status=200、2723字节、noBridge=true；原文档入口下载既有85字节测试附件。只暂缓真实原生file.chunk写入回执，确认私有.part文件已存在、Worker仍在运行，再从电脑公开设备页撤销032。
- [撤销前截图](../../artifacts/file-revocation-held-android.png)显示下载未交付。撤销后原连接closed到达，file.abort执行，暂存移除，工作区/文档窗口及Worker退出；未调用file.finish/save/share，分享缓存保持原样。释放迟到回执仍未交付文件；重新连接[拒绝旧授权](../../artifacts/file-revocation-denied-android.png)，errors为空。截图已检查。
- 032已撤销，日常App绑定、Key及原聊天权限保留。临时Worker插件经[原CLI卸载](../../artifacts/file-revocation-plugin-remove.log)，DSH重启释放加载状态；[日常App回归](../../artifacts/file-revocation-cleanup.json)通过原聊天/空草稿、插件指南与只读历史命令，errors/resources为空，两端服务恢复。历史命令exit7为既有内容，不是新执行失败。
- 边界：本项验证已写入私有暂存、原生回执未交付时的撤销，以及正常声明cleanup的插件线程释放；不等于网络文件分片/Worker资源fetch在途撤销，不证明宿主能清理任意插件遗漏的资源。工作区文件、原生保存写入竞态、大文件弱网、主聊天前台输出及完整R01–R16/A03–A06继续；模型工具审批/引用受余额限制。网页转发当前不实施，首版必要性待定。

## 旁栏输出在途撤销（2026-09-26）

- 状态：独立MuMu测试App通过真实旁栏后台输出在途撤销；本轮只完善验证工具，没有修改产品代码、Key或日常App绑定。维护角色：项目协作Agent；核验2026-09-26。来源：[Android真实入口](../../scripts/verify-sidebar-output-android.mjs)、[撤销专项](../../scripts/verify-sidebar-output-revocation.mjs)、[本机转发代理](../../../backend/scripts/verify-device-output-proxy.mjs)、[原Host输出分支](../../../plugin/src/remote-adapter.ts)。
- 独立设备“DSHM 输出撤销验收 031”在手机与电脑核对相同公钥指纹后，仅临时批准聊天权限；测试期间日常App暂时退出，未增加管理授权。[14:53:42 UTC MuMu报告](../../artifacts/sidebar-revocation-android.json)沿原shell/jobs在专用归档会话产生固定stdout/stderr，手机经DSHM自有旁栏打开输出。切换错误流后，代理确认暂缓1条真实available响应（496字节）；手机仍显示[正在读取且无输出内容](../../artifacts/sidebar-revocation-held-android.png)。电脑公开设备页撤销031后，原网关关闭两条设备连接，暂缓字节全部丢弃；手机退出工作区和输出窗口，重连[拒绝旧授权](../../artifacts/sidebar-revocation-denied-android.png)。errors/resources为空，测试任务killed/reported，核心bundle内容与时间戳不变。
- 验证工具的两个问题已纠正：remote.jobOutput直接返回value，不能按core.call的ok/value信封计数；旧代理512KiB上限小于正式协议2MiB，导致较大历史被测试工具断开。真实诊断记录为Test frame limit exceeded，代理改为协议上限加10字节帧头，最终同一实际路径通过。保留[响应检测失败](../../artifacts/sidebar-revocation-detector-failure.json)、[重启导航等待失败](../../artifacts/sidebar-revocation-navigation-failure.json)、[帧限制失败](../../artifacts/sidebar-revocation-frame-limit-failure.json)，均不计通过；首次配对后历史读取失败与该代理错误一致，未单独证明所有偶发连接故障同源。临时诊断日志已从代码移除。
- [3项帧转发测试](../../artifacts/sidebar-revocation-proxy-tests.log)通过；默认APK已[重新构建](../../artifacts/sidebar-revocation-main-build.log)恢复为日常applicationId，避免独立测试包占据默认交付路径。电脑页确认031已撤销、原DSHM Android仍为聊天与任务权限；代理已停止，ADB8787恢复直连。[CLI卸载](../../artifacts/sidebar-revocation-plugin-remove.log)临时Host插件后重启DSH释放轮询；控制文件清理。[14:55:07日常App回归](../../artifacts/sidebar-revocation-cleanup.json)通过实际聊天、插件指南、只读历史命令及原空草稿，errors/resources为空。历史命令原为exit7，不是本轮新执行失败。DSH3080、网关8787恢复监听，9878/18794不再监听。
- 边界：本项证明旁栏后台stderr响应在途时，真实撤销会退出页面并拒绝重连；暂缓数据由测试代理按真实close丢弃，不声称强行把旧帧注入新连接验证过。主聊天前台输出、资源下载/Worker在途撤销、任务回收及其他完整R01–R16/A03–A06仍待专项。网页转发当前不实施，首版必要性保留待定；模型工具审批/引用仍受余额限制。本节取代下方该独立设备“待批准/待测试”的当前描述，保留历史证据。

## 旁栏双输出与真实网关中断（2026-09-26）

- 状态：真实MuMu旁栏已验证stdout三页大输出、stderr历史/实时查看，以及网关进程中断后的保留与手动续读；同时修复错误状态的字节计数旁仍显示“实时读取”。维护角色：项目协作Agent；核验2026-09-26。来源：[共享输出显示](../../src/ui/RemoteLiveJobOutput.jsx)、[Android入口](../../scripts/verify-sidebar-output-android.mjs)、[双流专项](../../scripts/verify-sidebar-output-streams.mjs)、[临时Host夹具0.0.7](../../tests/fixtures/live-output-plugin/README.md)。不增加手机命令输入或新协议。
- [最终14:33:28 UTC MuMu](../../artifacts/sidebar-streams-android.json)：专用归档会话的旁栏沿原shell/jobs打印固定内容，stdout三段拼接140,037字符、SHA256为865240f8d579fd6ccac7ba5ad7605dd0c780c564b9927f993aa3684518659190；包括完整首尾标记及140,000字符正文。换到stderr历史和实时查看均有真实Write-Error输出，不混入stdout。核验本机网关进程后实际停止并按原env重新启动，断线确认时62条错误输出保留，恢复后手动连续续读至137条，无重复/缺号；错误输出选择、实时模式及全屏状态保持，原主/旁栏空草稿和原聊天恢复，errors/resources为空。
- [断线截图](../../artifacts/sidebar-streams-offline-android.png)已检查：“读取已暂停”与断线提示一致，已读内容仍可查看；[恢复截图](../../artifacts/sidebar-streams-restored-android.png)保留全屏及错误流。此前[第一次完整验证](../../artifacts/sidebar-streams-before-android.json)已通过98→170条连续恢复，但截图暴露状态文字矛盾，因此修改共享显示后重新构建/安装并完整复验。最初[进入会话失败](../../artifacts/sidebar-streams-navigation-race.json)发生在打印任务启动之前，测试补充等待目标标题后再打开菜单，未修改业务导航绕过。
- [367项Node](../../artifacts/sidebar-streams-tests.log)、[完整页面回归](../../artifacts/sidebar-streams-browser.log)、[Web构建](../../artifacts/sidebar-streams-build.log)和[APK/lint](../../artifacts/sidebar-streams-android-build.log)通过。最终任务killed/reported，控制文件清除；[CLI卸载](../../artifacts/sidebar-streams-final-plugin-remove.log)临时包并重启DSH释放Host轮询，包注册不存在。[清理后实际App](../../artifacts/sidebar-streams-final-cleanup.json)通过，原聊天/草稿与历史只读命令入口正常，errors/resources为空，两端服务恢复。历史命令原为exit7，不是本次新失败。没有模型请求、Key/权限修改、用户文件写入或核心bundle内容/时间戳变化。
- 范围：本轮证明读取期间网关实际不可用后的恢复，不证明某个特定分片正在传输的精确竞态；设备撤销/任务回收、全部网络和插件异常仍待验收。stderr本轮小于单页，不泛化为其大输出分页。完整R01–R16/A03–A06保持未完成；模型工具审批/引用仍受余额限制，网页中转的必要性及范围保持待定、不实施。

## 输出交接的暂停状态（2026-09-26）

- 状态：窗口交接恢复现在使用paused状态，显示“读取已暂停”和手动续读提示，不再无条件报连接变化。维护角色：项目协作Agent；核验2026-09-26。来源：[共享reader](../../src/remote-live-job-output.mjs)、[共享显示](../../src/ui/RemoteLiveJobOutput.jsx)、[前台调用](../../src/ui/RemoteCommandOutput.jsx)。真实断线/连接变化/任务失效仍由原valid校验拒绝；没有自动续发、重置游标或改变权限。
- 相比仅改错误文字，独立暂停状态避免正常页面恢复仍触发alert；主聊天与旁栏、前台与后台、实时与分段模式共用显示。暂停时只显示“重新读取”，分段模式不同时提供“读取下一段”。中英文文案已更新。
- [367项Node](../../artifacts/output-resume-all-tests.log)、[完整页面回归](../../artifacts/output-resume-browser.log)、[Web构建](../../artifacts/output-resume-build.log)与[APK/lint](../../artifacts/output-resume-android-build.log)通过。新增同连接切页后暂停、随后断线拒绝读取的回归，原UTF-8半字符/输出身份/旧Host拒绝保持。完整页面覆盖前台stderr历史恢复与后台窗口恢复；初跑仍断言旧alert而失败，已更新为暂停status、无alert及分页入口互斥，最终完整重跑通过。
- 新版APK已安装。[14:22:15 UTC MuMu](../../artifacts/output-resume-android.json)经真实原生提问通知切换聊天再返回旁栏，显示[暂停状态](../../artifacts/output-resume-paused-android.png)，零alert，已读5行保留；手动续读至[连续10行](../../artifacts/output-resume-restored-android.png)，没有重复/跳号，全屏与原草稿保持。截图已查看。测试任务killed/reported，提问取消；无模型请求、Key或设备权限修改。
- 临时夹具首次CLI卸载遇到Windows锁文件EPERM，停止已核验的DSH进程后[重试卸载成功](../../artifacts/output-resume-plugin-remove-retry.log)，恢复DSH3080及原网关8787；控制文件和包注册已清理。[14:24:02清理后App验证](../../artifacts/output-resume-cleanup.json)通过，原聊天/空草稿、只读历史命令与插件指南正常，errors/resources为空。历史命令本身原为exit7，不是新执行失败。
- 本轮真实验证范围为旁栏stdout及通知切换；前台stderr历史暂停通过浏览器，不能冒充新版Android实测。更多输出异常、第三方/性能及完整R01–R16/A03–A06仍继续；模型工具审批与引用读取仍受余额限制。网页中转的带宽与首版必要性仍待用户决定，不实施、不视为已取消。本节取代下节“切页仍误报连接变化”的当前限制，保留其历史证据。

## 通知切换后的旁栏真实输出恢复（2026-09-26）

- 状态：现有正式APK通过真实原生通知切换主会话后，返回原旁栏恢复实时输出窗口与手动续读；本轮仅补充验收脚本/临时夹具，没有修改产品代码或重建APK。维护角色：项目协作Agent；核验2026-09-26。来源：[Android专项的--switch模式](../../scripts/verify-sidebar-output-android.mjs)、[临时Host夹具0.0.6](../../tests/fixtures/live-output-plugin/README.md)、[旁栏恢复模型](../../src/remote-sidebar-chat.jsx)。
- [14:11:58 UTC完整MuMu报告](../../artifacts/sidebar-output-switch-android.json)：既有已归档父会话的旁栏通过原shell/jobs产生真实stdout；原userQuestions在另一既有联调会话发起提问，手机收到并点击[原生通知](../../artifacts/sidebar-output-switch-notice-android.png)。主聊天真实切换，原提问插件取消整组问题并由电脑返回ASK_CANCELLED。经列表返回原会话，旁栏和全屏窗口自动恢复；点击“重新读取”从第5行连续到第11行，前缀保留、无重复/跳号，[恢复截图](../../artifacts/sidebar-output-switch-restored-android.png)已查看。主/旁栏原空草稿保留，最终回到原联调聊天，errors/resources为空。
- 未使用测试函数直接切换手机模型，也没有回放输出或伪造原生通知；原生非聚焦PopupWindow不进入MuMu UI树，脚本根据实际分辨率/密度及原窗口位置，通过设备shell触摸点击，并用真实聊天和问题返回确认结果。第一次使用Playwright AndroidInput因缺失独立驱动卡住；核对活跃进程与驱动等待实现后主动停止该脚本，先经Host停止任务/取消问题，保留[失败记录](../../artifacts/sidebar-output-switch-driver-stall.json)。后续脚本另修正了[重连时旧旁栏迟到恢复](../../artifacts/sidebar-output-switch-startup-race.json)及[原面板已自动恢复却重复打开](../../artifacts/sidebar-output-switch-auto-panel.json)两处测试假设，最终完整重跑通过，未改产品绕过。
- 任务确认killed/reported=true，提问已取消，不触发新模型轮次；[CLI卸载](../../artifacts/sidebar-output-switch-remove.log)临时插件并重启DSH释放轮询，控制文件不存在。[14:12:59清理后App回归](../../artifacts/sidebar-output-switch-cleanup.json)通过：原聊天/空草稿、插件指南与历史只读命令结果正常，errors/resources为空。DSH3080/网关8787已监听；没有Key/管理授权修改、用户文件写入或核心bundle变更。
- 限制：本项证明真实通知点击、旁栏主会话切换和stdout手动续读，不涵盖旁栏stderr/历史分页、读取中真实断网/撤销、全部通知类型或Android13通知权限。恢复后的通用提示仍使用“连接已变化”，即使本次只是切换会话；后续应区分提示原因，当前不得把该文案当作发生断线的证据。完整Remote、第三方/异常/性能继续；模型工具审批与引用读取仍受余额不足影响，R12网页中转待决定且不实施。

## 主聊天工厂阶段订阅（2026-09-26）

- 状态：主聊天工厂只订阅原`conversationPhase`返回的阶段，正文继续沿原会话投影、消息节点和插件订阅更新；原始事件不节流、不裁剪历史。维护角色：项目协作Agent；核验2026-09-26。来源：[MainFactoryOccurrence](../../src/remote-plugin-slots.jsx)、[原阶段算法](../../../deepseek-harness/packages/client/ui-conversation/src/client/contract/snapshot.ts)、[压力验收](../../scripts/check-remote-history-scale.mjs)。
- 对比三种可能：工厂逐事件刷新、上下文传播、旧消息投影重复计算。先以[CPU剖析](../../artifacts/history-hotspot-before.cpuprofile)确认React beginWork采样自身耗时约18.37秒，布局/样式合计约0.63秒；[未改产品的计数回归](../../artifacts/history-factory-before.log)复现5000事件对应5050次工厂渲染，而外层页面仅50次。修改订阅的快照选择，比继续延迟原协议或重写原投影范围更小，同时保留首轮、空状态和插件能力。[修复后剖析](../../artifacts/history-factory-after.cpuprofile)该React热点约0.59秒。
- 同条件、不启用Profiler的Edge 375×667千轮回放：[修复前](../../artifacts/history-factory-before.json)加载23.69秒、5050次工厂渲染、最长任务877ms；[修复后](../../artifacts/history-factory-after.json)6.22秒、50次工厂渲染、最长173ms，33次长任务。页面刷新/滚动保持50次，正文完整，输入和新回复不重画旧消息，阅读位置保留；输入两帧p95约43.4ms。带Profiler的8.28秒结果另存[采样测量](../../artifacts/history-hotspot-after.json)，不混为同条件对照。首次插桩误匹配同名fixture导致构建断言失败，已将匹配限制到src后复现真实性能失败，再修改产品。
- [366项Node](../../artifacts/history-factory-tests.log)、[完整页面回归](../../artifacts/history-factory-browser.log)、[Web构建](../../artifacts/history-factory-build.log)、[APK/lint](../../artifacts/history-factory-android-build.log)通过。页面覆盖原工厂主/旁栏/直接调用、局部Views变化、插件卸载、已绑定空聊天到首轮时同一编辑器及草稿保留；没有通过屏蔽插件达到性能结果。
- 新版APK已安装。[13:58:51 UTC MuMu](../../artifacts/history-factory-after-android.json)从普通聊天进入真实Remote，同一专用历史连续三次分页至86条回复，完整旧窗口与草稿保留，阅读锚点偏差最大0.47px，errors为空；[设备截图](../../artifacts/history-factory-after-android.png)已查看。三页约341/400/490ms、最长任务284ms；[更新前](../../artifacts/history-factory-before-android.json)约300/366/443ms、最长320ms，仅各一次测量，不宣称真实分页整体变快。此项不发送模型请求、不改Key/权限/归档，不需要临时插件或重启电脑服务。
- 限制：桌面回放主要证实密集输出时的工厂刷新改善，不代表所有Android性能或完整Remote达标；仍有原投影/资源/第三方/异常验收。真实模型工具审批与引用读取仍受余额不足影响。R12网页转发仍待决定、不实施。本节更新先前千轮876ms长任务作为当前性能状态的描述，保留旧测量为历史证据。

## 主聊天与旁栏刷新一致性（2026-09-26）

- 状态：主聊天、标准旁栏与插件会话工厂共用[界面通知调度](../../src/remote-view-notifications.mjs)，模型快照和操作订阅仍同步。会话切换、就绪、连接与分页边界立即通知，取消订阅/销毁后不交付旧批次。[旁栏组合](../../src/remote-sidebar-chat.jsx)保留插件局部Views与自身订阅，仅隔离原工厂逐事件更新带来的重复正文渲染。维护角色：项目协作Agent；核验2026-09-26。来源：[根模型](../../src/remote-model.mjs)、[呈现模型](../../src/remote-conversation-model.mjs)、[实际会话流回归](../../tests/remote-model.test.mjs)。
- 相比在旁栏复制根模型调度，共用实现避免分页/断线/卸载语义分叉；没有节流协议或原插件数据。先复现原模型100事件对应100次界面通知，再通过真实页面入口执行200轮、1000条合成事件：[修复前](../../artifacts/sidebar-batching-before.json)渲染2000次、加载2326ms；只合并模型通知仍1020次，进一步隔离工厂父级渲染后[修复后](../../artifacts/sidebar-batching-after.json)20次、674ms。200条回复完整，输入不重画历史，草稿及主会话选择保留。这是桌面Edge 375×667协议回放，不是Android实测吞吐或模型速度。
- [366项Node](../../artifacts/sidebar-batching-tests.log)、[完整插件页面回归](../../artifacts/sidebar-batching-browser.log)、[Web构建](../../artifacts/sidebar-batching-build.log)、[APK/lint](../../artifacts/sidebar-batching-android-build.log)通过。新增[旁栏压力入口](../../scripts/check-sidebar-rendering.mjs)，修正原性能脚本过期的函数签名插桩及测试中不存在的DOM类/快照字段，回归失败后再修改产品。原工厂局部Views、主/旁栏输入扩展和卸载路径由完整页面回归覆盖。
- 新APK已安装；[13:48:04 UTC MuMu实测](../../artifacts/sidebar-batching-android.json)从普通聊天进入真实Remote，读取既有已归档三层会话，验证旁栏正文、只读孙会话、父级导航、主聊天切换返回、草稿交接与恢复、12次开关释放。原聊天/草稿恢复、仍保持归档，errors/resources为空。[恢复截图](../../artifacts/sidebar-batching-restored-android.png)已查看。没有发送模型请求、安装测试插件、修改Key或管理权限。验收脚本按当前页面修正同名前缀选择和关闭最后标签后面板已消失的处理。
- [当前主聊天千轮压力结果](../../artifacts/sidebar-batching-main-scale.json)：5000事件仍仅50次页面刷新/滚动，输入与新增回复不重画历史、阅读位置保留；加载24.03秒，48个长任务、最长876ms，输入到两帧p95约40.7ms。该结果不能宣布完整性能通过，也不能直接与旧版不同功能集测量作因果比较；原投影/工厂更多热点仍待测量。
- 剩余：完整性能、第三方与异常矩阵继续；旁栏真实输出的其他切换/断网场景仍未由本次历史回归证明。模型工具审批及引用读取仍受余额不足影响。R12网页转发待决定，本轮不实现、不将建议暂缓当作已删项。完整Remote目标保持进行中。

## 旁栏真实任务输出续读（2026-09-26）

- 状态：MuMu正式App的旁栏输出在两次真实核心更新后保留已读内容、全屏状态，并经“重新读取”从原字节游标接续；本轮不修改产品代码或重新构建APK。维护角色：项目协作Agent；核验2026-09-26。来源：[实际专项](../../scripts/verify-sidebar-output-android.mjs)、[原有读取器](../../src/remote-live-job-output.mjs)、[旁栏恢复模型](../../src/remote-sidebar-chat.jsx)。
- [13:31:45 UTC报告](../../artifacts/sidebar-output-android.json)：从既有已归档专用会话打开子会话旁栏，导航到父会话，在旁栏后台任务入口打开真实输出。电脑[临时插件0.0.5](../../tests/fixtures/live-output-plugin/README.md)经原shell、jobs和processJob固定打印行，实际走电脑采集、网关字节读取与手机显示，没有回放业务响应。两次更新后已读行连续由5→12→18，前缀保留、无重复或跳号；[全屏截图](../../artifacts/sidebar-output-restored-android.png)已查看。主/旁栏原空草稿保留，最终返回原联调聊天，errors/resources为空。
- 核心更新只临时改变安装副本remotes bundle时间戳，字节SHA256始终一致，原时间戳最终恢复；上游参考不修改。当前约定是保留只读快照、由用户点击“重新读取”，不是自动继续请求。初版脚本错误期待自动续读，保留[失败证据](../../artifacts/sidebar-output-before-contract-correction.json)，核对现行读取器及原测试后修正，不更改产品约定。
- 测试夹具初版遗漏shell注入，被原框架拒绝且未启动任务；修正后定点观测确认实际进程随后产生输出，未修改沙箱。脚本修复已有旁栏导航、重建时旧窗口自行消失及收尾面板自动关闭的处理，[收尾失败记录](../../artifacts/sidebar-output-before-cleanup-correction.json)保留。测试回执曾因结算/停止并发写入损坏，已串行写回并完整重跑通过；定点观测代码已移除。
- 原jobs.wait及停止结算确认任务killed且reported=true，不触发新的模型轮次。控制文件已移除，原CLI[卸载插件](../../artifacts/sidebar-output-remove.log)后核对3080进程身份并重启，释放Host轮询和任务记录。[13:32:52卸载后App回归](../../artifacts/sidebar-output-cleanup-android.json)确认原聊天/草稿、只读命令结果和插件指南正常。没有模型调用、Key/管理权限变更或用户文件写入。
- 限制：本专项为既有旁栏父会话的真实后台stdout、核心更新和手动续读，不等于模型实时生成、切换主聊天再返回时输出恢复、stderr/分页/真实断网的旁栏全矩阵。主页面测试不能自动推及全部旁栏入口。真实模型工具审批与引用读取受余额不足影响；完整R01–R16/A03–A06、第三方、异常和性能继续。R12网页中转待决定，不实施，延后首版仍为建议。本段更新下方“旁栏真实输出尚未验收”的历史描述。

## 手机终端边界与遮挡通知（2026-09-26）

- 状态：手机不启动原交互终端界面；真实遮挡提问通知专项通过。维护角色：项目协作Agent；核验2026-09-26。依据：[用户确认只查看命令结果](../design/问卷结论与追问.md)、[入口策略](../../src/remote-plugin-policy.mjs)、[原终端apply](../../../deepseek-harness/packages/client/ui-sidebar-terminal/src/client/index.ts)。
- 原先只略过标题里的终端恢复按钮，遗漏旁栏“新建终端”。本次在实际activationManifest中排除原ui-sidebar-terminal完整apply，创建、恢复、交互输入和关闭进程处理均不启动；模块依赖表保留，其他插件及聊天命令结果组件保持。相比CSS隐藏按钮，这一方案覆盖原插件所有注册入口，不增加电脑接口或授权；其状态明确提示手机不提供交互终端。
- [363项Node](../../artifacts/terminal-policy-tests.log)、[完整页面回归](../../artifacts/terminal-policy-browser.log)、[Web](../../artifacts/terminal-policy-build.log)、[APK/lint](../../artifacts/terminal-policy-android-build.log)通过。[实际MuMu入口](../../artifacts/terminal-policy-android.json)验证新版APK的工作区文件入口保留、无新建终端、原电脑pwsh卡片仍能打开只读命令详情并切换执行结果、原空草稿保持，errors/resources为空。[面板截图](../../artifacts/terminal-policy-guide-android.png)与[命令结果截图](../../artifacts/terminal-policy-command-android.png)已查看。该历史命令本身为旧失败样例，不代表本轮执行新命令或实时输出通过。脚本初次未等待App进程启动，已补等待后重跑。
- [真实通知专项](../../artifacts/occluded-notifications-android.json)通过电脑临时插件0.0.4调用原userQuestions.ask发起四个请求：当前聊天可见时不显示横幅；DSHM设置sheet、原插件Modal、非聊天旁栏遮挡时均显示原生提问横幅。关闭遮挡后原生阅读回执恢复，取消问题返回电脑ASK_CANCELLED；四项没有系统通知，原空草稿保持，errors为空。[执行脚本](../../scripts/verify-occluded-notifications-android.mjs)及四张截图（[可见](../../artifacts/occluded-notification-visible.png)、[设置](../../artifacts/occluded-notification-sheet.png)、[插件弹窗](../../artifacts/occluded-notification-plugin-modal.png)、[旁栏](../../artifacts/occluded-notification-panel.png)）为依据。未验证通知点击、Android13权限或真机，不泛化为完整A04通过。
- 通知测试插件已通过原CLI卸载，核对3080进程身份后重启DSH释放Host轮询；一次性控制文件已清理，问题均取消，新APK实际确认测试界面不再存在。当前3080/8787监听正常；没有改Key或设备权限。安装/卸载依据：[卸载日志](../../artifacts/occluded-notifications-remove.log)与上述MuMu报告。
- 真实模型工具审批另有[单次发送](../../artifacts/original-tool-approval-start.json)与[实际返回](../../artifacts/original-tool-approval-observe.json)：DeepSeek返回Insufficient Balance，未进入工具执行或审批。专用测试文件保持原内容后[清理成功](../../artifacts/original-tool-approval-cleanup.json)。[验证脚本](../../scripts/verify-original-approval-android.mjs)保留，未重复发起模型请求。原审批完整工具链与引用模型读取仍待余额恢复；不能用真实提问或浏览器审批回放代替。
- 剩余：旁栏真实输出续读、完整第三方/异常/资源/性能与R01–R16/A03–A06继续，偶发401根因未确认。R12网页中转仍待决定，暂缓首版是建议而非已确认删项；不实施转发，不以此缩小完整Remote目标。以上更新下方遮挡通知待验和终端仅标题排除的历史状态。

## 原审批与提问插件（2026-09-26）

- 状态：正式App安装原ui-approval及ui-user-questions的完整apply，在原Gateway事件通道放行前等待初始化；原插件通过conversation.composer接管输入区，不再由RemoteWorkspace绘制独立待处理卡片。维护角色：项目协作Agent；核验2026-09-26。来源：[安装入口](../../src/remote-interaction-plugins.jsx)、[App启动顺序](../../src/RemoteApp.jsx)、[输入插槽](../../src/remote-plugin-slots.jsx)、[原消费者](../../../deepseek-harness/packages/client/ui-user-questions/src/client/index.ts)。
- 相比继续复制卡片逻辑，复用原请求载体、优先级、答案草稿、取消/委派和可扩展子插槽，减少生命周期分叉；DSHM自己的页面、编辑器及聊天草稿保持。无界面协议客户端仍使用remote-core中的原载体回退，正式App通过标志让该消费者继续原事件链，避免重复回答。电脑图中的同名apply仍排除，防止重复安装。
- [页面专项](../../scripts/check-original-interactions.mjs)与[完整页面回归](../../artifacts/original-interactions-browser.log)通过：审批详情插槽、允许/拒绝、原优先级（计划高于提问高于审批）、会话隔离、多选加补充答案、收起展开和切换后答案恢复、取消及其他客户端取消、原ui-plan完整文档和计划决定、聊天草稿恢复。页面实际验证了提问覆盖审批，计划最高优先级另有原ui-session源码测试依据，未在本专项同时排队三类请求。初次专项误判优先级，核对原实现后修正；未修改上游。[362项Node](../../artifacts/original-interactions-tests.log)、[Web构建](../../artifacts/original-interactions-build.log)、[APK/lint](../../artifacts/original-interactions-android-build.log)通过。
- [12:55:58 UTC MuMu实测](../../artifacts/original-interactions-live-android.json)：新版APK在专用既有聊天接收电脑[临时插件0.0.3](../../tests/fixtures/live-interactions-plugin/index.js)调用原userQuestions.ask发起的真实请求；多选与补充文字返回电脑，计划“同意执行”返回原选项，“要求修改”返回ASK_CANCELLED。原ui-plan自动打开全文；相同编辑器及原空草稿恢复，420px页面无横向溢出，errors/resources为空。[提问截图](../../artifacts/original-interactions-question-android.png)和[计划截图](../../artifacts/original-interactions-plan-approve-android.png)已查看。测试没有模型调用、文件工具执行、Key或权限变更。
- 测试工具初版尝试经Remote自定义命令发起，被现有命令允许名单拒绝，未放宽策略。改由电脑插件读取本项目artifacts中的一次性本地控制文件后调用真实服务，答案写回本地结果供验证；该测试入口不进入APK/生产插件。新Host插件需重启DSH后加载，已核对3080进程身份再重启；测试后移除控制文件、卸载插件并再次重启释放其服务端轮询，网关保持运行。[12:57:17清理](../../artifacts/original-interactions-cleanup-android.json)确认测试界面、两个计划预览已移除，原聊天与空草稿恢复，服务3080/8787正常监听。测试脚本早期的进程启动等待、同名聊天选择和标题字段问题已修正。
- 剩余：本批原审批允许/拒绝/取消只完成浏览器协议回放，尚需真实电脑工具审批；提问/计划实测未调用模型工具，不能替代工具执行链验收。旁栏真实输出续读、遮挡通知、完整异常/资源/第三方/性能与R01–R16/A03–A06继续。引用实际模型读取受余额限制，偶发401根因未确认。R12网页转发待定、不实施，暂缓建议尚未获用户确认移出范围。总体保持进行中。

## 空聊天品牌与工作区插件（2026-09-26）

- 状态：已绑定空聊天按原 conversation.content 的 hero 阶段呈现品牌、工作区和模式选择；无会话与已绑定空聊天复用相同品牌及工作区组件。维护角色：项目协作 Agent；核验2026-09-26。来源：[空聊天组合](../../src/ui/RemoteConversationHero.jsx)、[工作区选择器](../../src/ui/RemoteWorkspaceChoice.jsx)、[无会话入口](../../src/ui/RemoteEmptyConversation.jsx)、[工厂上下文](../../src/remote-plugin-slots.jsx)、[原工厂规则](../../../deepseek-harness/packages/client/ui-conversation/src/client/skeleton/ConversationContent.tsx)。本段更新下方绑定空聊天hero未接入的历史描述。
- 相比继续维护两套按钮与选项，工作区统一走 conversation.hero.workspace，传入 open/anchorRef/selectedId/onPick/onClose，操作仍委托原有 selectWorkspace 与草稿原子转移。失败时关闭插件或默认选择器，在宿主显示错误并允许重新选择。只使用已登记工作区，不提供电脑目录创建。品牌仍按外层适配，宿主为34px品牌区域预留宽度，避免插件包装占满整行并挤窄标题，不改插件内部。
- 原工厂会话阶段决定显示；正文、默认编辑器和草稿保持。工作区列表已就绪但空聊天没有归属时，输入和发送停用，显示“先选择工作区，再开始聊天”；插件输入框收到 workspacePickerOpen/onRequestWorkspace。重新登记工作区后恢复输入。非空聊天不受该前置条件影响。
- [完整页面回归](../../artifacts/bound-hero-browser.log)通过[新增专项](../../scripts/check-bound-hero.mjs)：品牌/工作区插槽实际调用、取消保留草稿、切换工作区转移草稿、删除归属后锁定/新ID重新登记后解锁、插件卸载回退，以及首轮消息到来时同一编辑器和草稿保留。沿用无会话失败重试、原模式预选和输入工厂回归；[362项Node](../../artifacts/bound-hero-tests.log)、[Web](../../artifacts/bound-hero-build.log)、[APK/lint](../../artifacts/bound-hero-android-build.log)通过。专项初次误复用了已删除工作区ID；原 ClientWorkspaceModel 会拒绝这种迟到数据，已按Host规则使用新ID，并清理前一测试留在内存的草稿。
- [12:32:01 UTC MuMu](../../artifacts/bound-hero-live-android.json)新版APK加载[独立电脑插件0.0.7](../../tests/fixtures/live-factory-plugin/client.js)，无会话入口经插件选择器进入DSH-TEST既有空聊天；品牌和当前工作区选择器、取消后草稿保留、测试文字清理通过。输入框位于843px视口内，文档宽420px无横向溢出，[实际截图](../../artifacts/bound-hero-opened-android.png)已查看。未创建会话、发送模型请求、修改Key/权限/模式或归档状态；测试控件不是正式页面设计。
- [12:32:23卸载清理](../../artifacts/bound-hero-cleanup-android.json)确认测试插件移除，原聊天与原空草稿恢复，errors/resources为空。此前原生脚本的空文本fill没有完成清理，已用编辑器全选/退格及结果等待清除；旁栏恢复展开/开始标签导致清理目标不匹配，脚本改为先返回主聊天并明确选择测试子会话标签，再关闭。保留[初次](../../artifacts/bound-hero-live-first-attempt.json)与[清理失败记录](../../artifacts/bound-hero-live-fourth-attempt.json)，最终完整重跑通过。
- 剩余：原审批/提问apply、旁栏真实输出续读、遮挡通知、完整异常/资源/第三方/性能及R01–R16/A03–A06继续。本批只证明独立插件与既有原模式入口，不能泛化为所有第三方工作区组件。工作区删除/重新登记与首轮过渡为浏览器验证，未在真实电脑删除用户工作区。引用实际模型读取受余额限制，偶发401根因未确认。R12网页转发待定、不实施，暂缓建议尚未确认移出范围。

## 会话工厂统一输入扩展（2026-09-26）

- 状态：conversation.content 统一声明原有七个子插槽，composer 链、composer.bar、input.dock 与 hero.agentPreset 已从 root 迁入；主聊天、标准旁栏和插件直接创建的聊天使用同一所有者。维护角色：项目协作 Agent；核验 2026-09-26。来源：[原工厂声明](../../../deepseek-harness/packages/client/ui-conversation/src/client/apply.ts)、[手机工厂](../../src/remote-sidebar-chat.jsx)、[输入扩展入口](../../src/remote-plugin-slots.jsx)、[主聊天组合](../../src/ui/RemoteWorkspace.jsx)。本段更新下方 child 所有权尚未统一的历史描述。
- 相比在 root 重复声明同名插槽，此次由工厂统一提供 renderSlot/renderSlotChain/SessionProvider，使作者指定的局部 Views 也能调用输入扩展。主聊天的正文、队列、附件和输入区域在同一工厂中组合，状态仍由 RemoteWorkspace 持有；插件面板与弹窗保留在工厂外，避免门户继承主工厂后触发原渲染器递归限制。只替换 Views 时编辑器与草稿保持。
- [完整页面回归](../../artifacts/factory-children-browser.log)通过主/旁栏/独立入口、原输入链接管/替换、无会话/模式选择及卸载恢复；[局部 Views 专项](../../scripts/check-remote-factory.mjs)真实调用工厂的 composer 链、bar、dock 与模式插槽，确认当前会话和草稿一致。保留原渲染器权限检查，没有复制或放宽调用规则。[362项Node](../../artifacts/factory-children-tests.log)、[Web](../../artifacts/factory-children-build.log)、[APK/lint](../../artifacts/factory-children-android-build.log)通过。
- [12:09:41 UTC MuMu实际验证](../../artifacts/factory-children-live-android.json)：新版APK从电脑加载独立输入插件，主聊天与既有归档子会话旁栏分别写入测试草稿、核对 dock 同步并恢复原内容。输入扩展均位于当前工厂内，600px原内容缩至420px且页面无横向溢出。[旁栏截图](../../artifacts/factory-children-sidebar-android.png)已查看；不代表正式插件视觉设计。
- [卸载清理复验](../../artifacts/factory-children-cleanup-android.json)确认两个插件入口移除、默认编辑器和原空草稿恢复；errors/resources为空。首次清理脚本把 Lexical 空段落的占位换行误判为草稿，已核验实际DOM并只归一化单个占位段落后重跑，保留[初次记录](../../artifacts/factory-children-cleanup-first-attempt.json)。没有发送模型请求、修改Key/权限或归档状态。
- 剩余：绑定空会话完整hero、原审批/提问apply、旁栏真实输出续读、通知、完整异常/资源/第三方/性能及R01–R16/A03–A06继续。引用实际模型读取受余额限制，偶发401根因未确认。R12网页转发仍待定、不实施；暂缓为建议，尚未确认从范围移除。独立测试插件通过不代表全部第三方兼容。

## 插件直接创建聊天视图（2026-09-26）

- 状态：注册组件直接调用 conversation.content 时，也在工厂外建立手机导航范围；不再通过 StandaloneConversationOccurrence 在工厂内部持有另一套导航。维护角色：项目协作 Agent；核验 2026-09-26。来源：[统一调用适配](../../src/remote-factory-callers.jsx)、[注册入口](../../src/remote-plugin-slots.jsx)、[导航宿主](../../src/remote-sidebar-chat.jsx)。本段更新下方“直接实例化工厂后的作用域仍待处理”的历史描述。
- 适配覆盖注册组件、工厂组件及调用者指定/默认局部组件中的 renderFactorySlot，仍委托原渲染器处理调用者、插槽和递归边界。只为 conversation.content 加导航宿主；其他工厂保持原路径。已有主/旁栏范围直接复用，未绑定会话保持空入口；当前原 SessionProvider 放在 FactoryOutlet 之前，注入与局部 Hook 随导航共同重建。相较复制工厂渲染器或逐个识别第三方组件，不修改上游源码，也不复制授权和插槽解析逻辑。
- [独立入口页面专项](../../scripts/check-direct-factory.mjs)使用自定义标签直接创建工厂，绕过标准子会话标签。验证子→父导航、同时存在的两会话输入禁用、旧回调拒绝/新回调进入工作区检查、非空草稿保持与卸载后子会话引用计数恢复原值。[完整页面回归](../../artifacts/direct-factory-browser.log)errors为空；[362项Node](../../artifacts/direct-factory-tests.log)、[Web](../../artifacts/direct-factory-build.log)、[APK/lint](../../artifacts/direct-factory-android-build.log)通过。
- [11:57:29 UTC MuMu](../../artifacts/direct-factory-live-android.json)新版APK加载[电脑独立测试包0.0.6](../../tests/fixtures/live-factory-plugin/client.js)，从既有归档专用父会话打开自定义标签，插件自身保留子会话引用并直接调用工厂；子/父输入禁用隔离、局部Views替换保持编辑器节点、40px阅读位置恢复通过。[实际截图](../../artifacts/direct-factory-live-android.png)已查看。测试插件自行指定局部宽高与验证控件，不代表正式界面视觉设计。原生原草稿为空；非空草稿与引用计数释放由浏览器专项证明。
- [原CLI卸载](../../artifacts/direct-factory-plugin-remove.log)后的[清理复验](../../artifacts/direct-factory-cleanup-android.json)确认独立宿主消失，关闭标签并恢复原聊天和原空草稿，errors/resources为空。没有模型请求、Key/权限或归档修改。
- 剩余：完整 factory child 所有权仍分散在 root，composer/bar/dock/heroPreset 需统一归属；绑定空会话完整hero、原审批/提问apply、旁栏真实输出、通知、完整异常/资源/第三方/性能及R01–R16/A03–A06继续。不能把独立测试插件通过泛化为全部第三方插件兼容。引用模型读取受余额限制，偶发401根因未确认，R12网页转发待定、不实施且尚未确认移出范围。

## 旁栏工厂作用域与输入禁用（2026-09-26）

- 状态：标准子会话旁栏的导航模型已移到工厂外；原资源仍负责入口引用与标签，手机适配当前 SessionProvider 后再渲染原 conversation slot/factory。维护角色：项目协作 Agent；核验 2026-09-26。来源：[旁栏宿主与工厂](../../src/remote-sidebar-chat.jsx)、[原注册适配](../../src/remote-plugin-slots.jsx)、[原 SidebarChatTab](../../../deepseek-harness/packages/client/ui-subagent/src/client/sidebar-chat/index.tsx)。
- 原来只有工厂内部 Views 的标准会话 Hook 随导航更新，注入的 selectWorkspace 仍指向入口子会话。现在导航发生在工厂外，注入和局部控件共同绑定当前会话；旧回调仍检查当前视图并拒绝跨会话使用。相比逐个包装插件回调，该方案沿原渲染器统一重建会话作用域，同时保留主聊天、旁栏记忆、草稿与真实资源生命周期。
- factory 新增原 `useComposerBlock` 注入，使用同一 ComposerBlockRegistry，会话未绑定时返回稳定空状态。标准旁栏子→父导航后，当前 Hook 与编辑器读取同一个父会话禁用原因，不继承旧子会话状态。
- [完整页面回归](../../artifacts/factory-scope-browser.log)通过当前原因订阅、旧子会话与父会话同时设置禁用、编辑器锁定/恢复、旧 selectWorkspace 拒绝、新回调到达实际工作区检查，以及主/旁栏、草稿、插件卸载、无会话、模式、恢复等既有路径。[362项 Node](../../artifacts/factory-scope-tests.log)、[Web](../../artifacts/factory-scope-build.log)、[APK/lint](../../artifacts/factory-scope-android-build.log)通过。首次回归发现无会话入口误用了外层旁栏 view，已优先处理显式 undefined 会话并完整重跑通过。
- [11:47:16 UTC MuMu](../../artifacts/factory-scope-live-android.json)新版 APK 加载[真实电脑测试包0.0.5](../../tests/fixtures/live-factory-plugin/client.js)，在既有归档专用子/父会话中验证子会话暂停、返回父会话为空、父会话暂停/解除、Hook与contenteditable一致。正文局部替换仍保留编辑器节点及40px阅读位置。[截图](../../artifacts/factory-scope-custom-only-android.png)已查看。[11:47:39卸载复验](../../artifacts/factory-scope-cleanup-android.json)保持父会话直到卸载完成，再关闭标签并恢复原聊天/原空草稿；errors/resources为空。没有模型请求、Key/设备权限或归档修改。旧工作区回调拒绝由浏览器回归证明，不冒充原生实测。
- 范围边界：修正的是标准子会话资源入口与主聊天，未证明任意第三方脱离此宿主直接实例化工厂后的独立导航；StandaloneConversationOccurrence 回退仍在工厂内部持有视图，其导航后的注入重绑定待处理。完整 child 所有权、绑定空会话完整 hero、原审批/提问 apply、旁栏真实输出、通知、异常/资源/第三方/性能及 R01–R16/A03–A06 继续。R12网页转发待定、不实施，尚未确认移出范围。

## 主聊天接入同一内容工厂（2026-09-26）

- 状态：主聊天正文已通过原 `conversation.content` 工厂与 `conversation.session` 插槽呈现，和旁栏共用手机自己的内容组件。维护角色：项目协作 Agent；核验 2026-09-26。来源：[主入口](../../src/ui/RemoteWorkspace.jsx)、[工厂](../../src/remote-sidebar-chat.jsx)、[作用域桥](../../src/remote-plugin-slots.jsx)。本段更新下方历史“主页面未统一”的状态；完整工厂的所有 child、composerBlock 与旁栏作用域重绑定仍未完成。
- 相比为主聊天另建一套插件扩展，沿用同一工厂减少行为差异；主聊天使用现有 mainView 引用，不新建 RemoteConversationModel。输入、附件、队列和窗口仍由常驻 RemoteWorkspace 持有，插件内容替换不会重建编辑器。主工厂的 hero/settling/active 使用原 conversationPhase 和会话加载/父会话可用状态，运行中不误标为加载阶段。
- [阅读观察器](../../src/remote-reading-context.mjs)在主正文被替换时暂停阅读回执，恢复正文再恢复；旁栏和模态遮挡规则保留。插件内容不能靠外层仍存在就把聊天自动判成已读。
- [完整页面回归](../../artifacts/main-factory-browser.log)新增[主入口专项](../../scripts/check-main-factory.mjs)：真实渲染器中的插件注册/卸载、mainView 引用计数 1、当前会话身份、编辑器节点与非空草稿保持、40px 阅读位置恢复、375×667 无溢出，以及阅读回执暂停/恢复。已有旁栏、原插件、模式、工作区交接等回归通过；[362 项 Node](../../artifacts/main-factory-tests.log)、[Web 构建](../../artifacts/main-factory-build.log)、[APK/lint](../../artifacts/main-factory-android-build.log)通过。
- [11:39:04 UTC MuMu](../../artifacts/main-factory-live-android.json)使用新版 APK，从真实电脑加载[独立测试插件](../../tests/fixtures/live-main-factory-plugin/client.js)，在既有专用联调聊天中替换正文，验证会话身份、主引用计数、编辑器节点和原草稿保持、输入框在视窗内，恢复正文后保持 40px 阅读位置。[实际截图](../../artifacts/main-factory-live-android.png)已查看；[原 CLI 卸载](../../artifacts/main-factory-plugin-remove.log)后的[清理复验](../../artifacts/main-factory-cleanup-android.json)确认测试入口移除、原聊天及草稿恢复，errors/resources 为空。没有模型请求、Key/配置或权限变更；实际原草稿为空，非空草稿保持及阅读回执变化在浏览器专项验证。
- 剩余：完整 factory child 所有权、composerBlock、旁栏导航后的注入作用域重绑定、绑定空会话完整 hero；原审批/提问 apply、旁栏真实输出、通知、完整异常/资源/第三方/性能及 R01–R16/A03–A06 继续。引用模型实际读取受余额限制，偶发401根因未确认。R12网页转发待定、不实施，暂缓建议不等于用户确认移出范围。

## 工作区草稿与附件交接（2026-09-26）

- 状态：主空聊天已提供“切换工作区”，无会话工厂及受控 `selectWorkspace` 注入使用同一导航服务。维护角色：项目协作 Agent；核验 2026-09-26。来源：[入口](../../src/ui/RemoteWorkspaceChoice.jsx)、[导航](../../src/remote-workspace-navigation.mjs)、[交接](../../src/remote-workspace-drafts.mjs)、[原接口](../../../deepseek-harness/packages/client/ui-conversation/src/client/apply.ts)。仅选电脑已有工作区；主页面仍未统一为完整 factory，不能把本批称为完整 factory 已完成。
- 原 DSH 的 rebindDraftFiles 会重新上传文件。手机先在[严格本地事务](../../src/remote-draft-database.mjs)中移动文字、原编辑器引用结构和附件原件，并删除源记录；成功后才更新页面。附件使用新草稿 ID，剥离旧 receipt/file，再通过[真实上传链](../../src/remote-model.mjs)为目标 sessionId 获取新凭据。相比逐条保存后清源，四条记录的同一事务避免中断时只清源却未存目标；不复制旧 Host 凭据。
- 目标已有草稿时拒绝覆盖，双方内容保留；源/目标已经开始聊天、保存错误/未完成、上传中、发送未知或并发提交时拒绝交接。两边输入与发送共用转移锁，插件公开输入操作和附件入口同样检查。提交前导航/连接/草稿版本/会话状态变化会使事务回滚；提交后用户另行导航则不抢回页面，原件已保留在目标，重传失败可在目标重试，不自动发送。
- [11项专项测试](../../tests/remote-workspace-drafts.test.mjs)包含真实 IndexedDB 事务重开、原件字节/引用结构、会话内 receipt 剥离、目标冲突、源/目标运行、上传/未知/保存状态、事务期导航过期回滚、并发修改、存储失败和交接后的上传失败。已纳入[完整 Node 结果](../../artifacts/workspace-drafts-tests.log)。[完整页面回归](../../artifacts/workspace-drafts-browser.log)通过实际选择器、RemoteModel 与上传适配回放，核对源清空、目标草稿和不同上传凭据；没有将回放当成真实电脑验证。第一次测试错误使用第二次 baseline，被原工作区流拒绝；已改成真实 upsert/remove/order 增量后通过。
- [11:23:52 UTC MuMu 实测](../../artifacts/workspace-drafts-live-android.json)使用新 APK 与[独立电脑测试插件](../../tests/fixtures/live-workspace-drafts-plugin/index.js)，在电脑登记两个专用工作区，各创建一个空聊天。从手机真实附件选择入口上传 38 字节文件，切换后观察两次真实上传都成功，sessionId 分别对应源/目标且 receipt 不同；目标原文字/文件卡片存在，返回源为空，再回目标仍保留。已查看[截图](../../artifacts/workspace-drafts-live-android.png)。仅在内存比较上传凭据，不把凭据写入报告；未发送模型、改 Key 或扩大设备权限。
- 测试后清空本次目标测试草稿和附件、归档两条新会话、恢复原聊天；补充存储失败文案后已安装最终 APK，[11:27:34 卸载复验](../../artifacts/workspace-drafts-cleanup-android.json)确认插件与两条临时工作区注册均移除，原目录和归档测试记录保留。errors/resources=[]。早期脚本因冷启动、模式仍在读取、未经过附件选择入口及空编辑器换行节点误判而失败，其新建测试会话也已归档；最终完整重跑通过。Android 本批只证明文字/普通文件正常交接，引用 JSON 保留仅有本地测试，模型实际读取跨工作区引用与真实断线/存储耗尽仍待验收。
- [Web](../../artifacts/workspace-drafts-build.log)、[APK/lint](../../artifacts/workspace-drafts-android-build.log)通过。后续仍需完整 factory child、composerBlock 注入与主页面统一；factory 旧作用域回调与当前聊天不一致时明确拒绝。原审批/提问 apply、旁栏输出、通知、完整资源/异常/第三方/性能及 R01–R16/A03–A06 保留；R12 网页转发待定、不实施。

## 模式请求的页面与连接隔离（2026-09-26）

- 状态：修复原模式局部组件卸载或切换聊天后，迟到读取失败覆盖当前页面错误的问题。维护角色：项目协作 Agent；核验 2026-09-26。来源：[模式组件包装](../../src/remote-plugin-slots.jsx)、[实际注册路径回归](../../scripts/check-preset-lifetime.mjs)。原插件内部和上游参考源码保持不变。
- [失败复现](../../artifacts/preset-lifetime-red.log)通过实际注册的 hero 包装，延迟读取后切到另一会话，旧错误覆盖新会话错误。包装现在同时检查组件存活、导航请求及连接代次；卸载后的回调不启动读取，正常当前失败仍报告，共享操作锁沿原 finally 释放。相比吞掉全部错误，保留当前页面的可诊断失败。回放的专用局部组件只用于控制 Promise 时序，不代替原插件本身或真实通信。
- [完整页面回归](../../artifacts/preset-lifetime-browser.log)验证当前失败、换会话、卸载、释放后回调、真实连接控制器重连及锁清理；原模式 apply 正常路径及其他既有页面同时通过。初次重连检查误拒绝新请求，测试已改为按发起顺序释放旧请求后完整重跑通过。[351项 Node](../../artifacts/preset-lifetime-tests.log)、[Web](../../artifacts/preset-lifetime-build.log)及[APK/lint](../../artifacts/preset-lifetime-android-build.log)通过。
- [11:06:17 UTC MuMu](../../artifacts/preset-lifetime-live-android.json)是新版 APK 的正常链路回归：原电脑插件与独立测试包 0.0.4，先预选 minimal，再复用 DSH-TEST 空会话，收到实际 minimal 投影后恢复 standard；created=[]，没有模型、Key、默认模式或授权变更。已查看[截图](../../artifacts/preset-lifetime-hero-android.png)。[11:06:38卸载复验](../../artifacts/preset-lifetime-cleanup-android.json)确认原聊天/草稿恢复、测试插件移除、errors/resources=[]。Android 没有注入迟到异常，该异常证据来自上述浏览器实际包装路径，不能声称真实网络故障已全部验收。第一次原 CLI 安装遭 Windows 锁文件 EPERM，终止后重试成功。
- 下步仍为完整 factory/主页面统一。源码核对发现：原 [selectWorkspace 注入](../../../deepseek-harness/packages/client/ui-conversation/src/client/apply.ts)会迁移草稿并 rebindDraftFiles，手机 [prepareAttachment](../../src/remote-model.mjs)使用目标 sessionId 上传并保存 Host 会话内 receipt。不能直接复制旧 receipt 冒充目标会话授权；本批没有新增迁移实现。完整审批/提问 apply、旁栏输出、通知、异常/资源/性能及 R01–R16/A03–A06 保留；R12 网页转发待定、不实施。

## 原插件模式预选与主聊天身份（2026-09-26）

- 状态：原 `conversation.hero.agentPreset` 在无会话与主聊天空会话中已接入，预选真实应用到电脑会话。维护角色：项目协作 Agent；核验 2026-09-26。来源：[原预选控制器](../../../deepseek-harness/packages/client/ui-agent-preset/src/client/seat-store.ts)、[原应用条件](../../../deepseek-harness/packages/client/ui-agent-preset/src/client/index.ts)、[手机引用](../../src/remote-session-view.mjs)、[主聊天](../../src/remote-model.mjs)及[插槽](../../src/remote-plugin-slots.jsx)。此段替代下方 staged 模式预选尚未接入的历史描述；不代表完整会话工厂或模式设置页已验收。
- 原插件以 `retainedBy.mainView` 判定预选接收者。手机根视图现在使用真实 mainView 引用，旁栏和临时视图继续使用 controllerOperation，切换/释放沿原引用生命周期；没有用全局伪造标记或直接改插件内部。相比另外维护一套手机预选状态，复用原模块的无会话 staged 选择、目录、默认值与会话投影，空会话接收后消费预选。主聊天空白阶段用原局部选择器，历史/旁栏仍保留既有手机模式入口，不重复叠放两种标签。
- 原 hero 的 load 可能应用预选。[模式服务](../../src/remote-agent-presets.mjs)将这段读取/应用及 select 的在途工作纳入共享发送锁，重叠读取计数归零才释放；其他模式入口和 RemoteModel 发送继续检查同一锁。[输入框](../../src/ui/RemoteComposer.jsx)在此期间禁用编辑、发送和键盘提交，完成后恢复原编辑器。该包装只针对原模式组件，其他作者的局部界面和外层自适应规则保持。设置页内部发起的所有写入与在途断线/撤销仍需进一步专项，不以这次正常流程证明全部竞态。
- [完整页面回归](../../artifacts/agent-preset-stage-browser.log)加载原 ui-agent-preset apply 的 hero 路径：选工作区前零写入；主/旁栏引用身份区分；选择工作区后只应用目标空会话；延迟真实回放请求的响应期间共享锁存在、contenteditable=false、发送禁用，完成后恢复。设置页未打开，其设置写入服务没有被模拟。既有完整页面路径通过。[351 项 Node](../../artifacts/agent-preset-stage-tests.log)包含主引用释放与独立视图隔离，[Web](../../artifacts/agent-preset-stage-build.log)、[APK/lint](../../artifacts/agent-preset-stage-android-build.log)通过。早期检查把原插件英文标签和 ARIA textbox 的 isEditable 推断当作实际内容可编辑，已改为真实标签与 contenteditable 状态检查后通过。
- [10:53:21 UTC MuMu](../../artifacts/agent-preset-stage-live-android.json)在新版 APK、电脑实际原插件及独立测试包 0.0.4 中，先读取 DSH-TEST 既有空会话的原模式 standard；无会话选择 minimal，选工作区后确认电脑推回 minimal 与主引用计数 1。随后通过同一已授权原 RPC 恢复 standard，并等待原投影回到 standard；created=[]，没有模型请求、Key、默认模式、权限或归档变化。[截图](../../artifacts/agent-preset-stage-hero-android.png)已查看；[卸载清理](../../artifacts/agent-preset-stage-cleanup-android.json)确认测试包移除与原聊天/草稿恢复，errors/resources=[]。实际脚本：[--preset 模式](../../scripts/verify-conversation-empty-android.mjs)。
- 剩余：已绑定空会话的完整 hero/工作区切换、完整 child 集合、selectWorkspace/composerBlock 注入和主页面统一 factory；原审批/提问 apply、旁栏真实输出续读、遮挡时真实任务提醒、完整撤销/资源/第三方/性能与 R01–R16/A03–A06。模型实际引用读取受余额限制，偶发 401 根因未确认；R12 网页转发待定、不实施，延后尚未确认移出范围。

## 插件无会话入口与工作区选择（2026-09-26）

- 状态：无 session 的 `conversation.content` 已显示 DSHM 自有欢迎页、品牌插槽、已有工作区选择和禁用输入。维护角色：项目协作 Agent；核验 2026-09-26。来源：[无会话页面](../../src/ui/RemoteEmptyConversation.jsx)、[工厂组合](../../src/remote-sidebar-chat.jsx)、[工作区导航](../../src/remote-workspace-navigation.mjs)。此段替代下方“无会话页面完全未接入”的历史状态，不代表完整 hero/factory 已完成。
- 选工作区前不存在发送目标，默认编辑器与发送按钮禁用。品牌与工作区分别使用原 `conversation.hero.brand.mark/workspace` 契约；无会话 composer.bar 复用现有唯一插槽所有者，通过 `SessionProvider` 的显式 undefined 与 empty 分支清除继承的会话，避免重复声明或误把原聊天传给插件。相比另写手机创建协议，选择沿原 `openWorkspace`：复用匹配的未归档空聊天，否则走已有真实创建接口，然后打开 DSHM 主聊天。手机不新增电脑工作区或目录选择入口。
- 页面包含工作区读取中、空列表、打开中、错误及再次选择重试；开关和忙碌状态阻止重复点击。[完整页面回归](../../artifacts/conversation-empty-browser.log)通过实际 factory 调用路径的无会话、品牌、输入禁用、空工作区、打开失败重试和已有空会话复用，并覆盖既有主/旁栏、输入扩展、文件和资源路径。[350 项 Node](../../artifacts/conversation-empty-tests.log)、[Web 构建](../../artifacts/conversation-empty-build.log)、[APK/lint](../../artifacts/conversation-empty-android-build.log)通过。回放测试只证明相应协议与界面，不代替真实电脑验证。
- [10:39:15 UTC MuMu 实测](../../artifacts/conversation-empty-live-android.json)加载独立电脑插件 0.0.3：无会话品牌显示、编辑器/发送禁用，选择实际 DSH-TEST 后复用既有空聊天 `session-2f9a8e7e-6295-4034-aa2e-61c09dc3b929`，进入手机自有主聊天并恢复可编辑，created=[]。已查看[欢迎页](../../artifacts/conversation-empty-hero-android.png)与[打开后](../../artifacts/conversation-empty-opened-android.png)截图。[10:39:35 CLI 卸载后](../../artifacts/conversation-empty-cleanup-android.json)确认扩展移除、原聊天与 `DSHM_LANGUAGE_DRAFT_20260925` 保留；errors/resources=[]，未调用模型或修改 Key、权限与归档。实际步骤由[Android 脚本](../../scripts/verify-conversation-empty-android.mjs)记录；早期脚本因冷启动、隐藏状态节点和保留的面板/归档筛选误判，修正等待和清理后完整重跑通过，没有绕过页面点击。
- 仍未完成：staged Agent 模式预选需要绑定原 mainView 生命周期，不能只画选择器而不应用；已绑定空会话的完整 hero、完整 child 集合、selectWorkspace/composerBlock 注入及主页面统一 factory 继续推进。原审批/提问 apply、旁栏真实输出续读、遮挡时真实任务提醒、完整撤销/资源/第三方/性能及 R01–R16/A03–A06 保留。模型实际引用读取受余额限制，偶发 401 根因未确认；R12 网页转发待定、不实施，延后仍未被确认移出范围。

## 插件内容与常驻输入框分离（2026-09-26）

- 状态：已选会话的工厂 Views 与输入框生命周期分离，新版 APK 通过 MuMu 真实电脑插件验证。维护角色：项目协作 Agent；核验 2026-09-26。来源：[常驻聊天容器](../../src/ui/RemoteWorkspace.jsx)、[工厂组合](../../src/remote-sidebar-chat.jsx)、[原组合契约](../../../deepseek-harness/packages/client/ui-conversation/src/client/skeleton/ConversationContent.tsx)。此段替代下节“Views 之外独立 composer 未完成”的状态，完整 factory 仍未完成。
- 原先默认 conversation.session 包含整页，插件 Views 不调用该插槽时输入框也随之消失。[RED](../../artifacts/conversation-composer-split-red.log)沿实际旁栏工厂路径复现。现在 RemoteWorkspace 常驻，conversation.session 只呈现同一容器提供的标题与正文；输入框、附件、队列、目标、操作窗口和发送状态仍归原容器，不复制第二套逻辑。局部 Views 可只展示插件自己的内容，同一编辑器 DOM 和草稿保留，插件卸载仍沿既有会话恢复规则。
- 默认正文增加显式阅读标记。[阅读观察器](../../src/remote-reading-context.mjs)依据实际聊天正文而不是外层容器判定旁栏正在阅读；正文被替换时暂停，恢复后继续，避免只有插件内容也被算作已读。正文卸载前保留滚动位置，重新挂载后按原位置或跟随底部状态恢复；[滚动 RED](../../artifacts/conversation-composer-split-scroll-red.log)证实原先 40px 会变成 0px。
- [完整页面回归](../../artifacts/conversation-composer-split-browser.log)通过：插件独立内容、同一编辑器 DOM、草稿、正文恢复、40px 阅读位置、阅读回执暂停/恢复；既有主聊天、旁栏、引用、发送、只读、审批及文件窗口回归仍通过。[350 项 Node](../../artifacts/conversation-composer-split-tests.log)、[Web](../../artifacts/conversation-composer-split-build.log)、[APK/lint](../../artifacts/conversation-composer-split-android-build.log)通过。协议回放不等于本轮实际模型发送。
- [10:14:24 UTC MuMu](../../artifacts/conversation-composer-split-live-android.json)加载[独立电脑插件 0.0.2](../../tests/fixtures/live-factory-plugin/client.js)，验证真实父会话里替换为纯插件内容后编辑器仍是同一节点、草稿保持、输入框在屏幕内，恢复正文保持 40px 阅读位置。[纯插件内容截图](../../artifacts/conversation-composer-split-custom-only-android.png)已查看。[原 CLI 卸载后复验](../../artifacts/conversation-composer-split-cleanup-android.json)确认宿主移除后仍在父会话，再关闭面板恢复原联调聊天与 `DSHM_LANGUAGE_DRAFT_20260925`；errors/resources 为空，无模型请求、Key/权限或归档变化。[实际脚本](../../scripts/verify-conversation-factory-android.mjs)使用 --resident-composer 模式，保留前批证据路径。
- 未完成：无会话 hero/品牌/工作区/预设组合、完整 child 集合、selectWorkspace/composerBlock 注入及完整第三方 factory；主页面尚未统一使用完整 factory。原审批/提问 apply、旁栏真实输出续读、遮挡时真实任务提醒、完整撤销/资源/第三方/性能及 R01–R16/A03–A06 继续推进。模型实际引用读取受余额限制，偶发 401 根因未确认；R12 网页转发待定、不实施。本段不是完整 Remote 交付声明。

## 插件会话视图与局部控件（2026-09-26）

- 状态：`conversation.content` 的默认聊天、调用方局部 `views/widthControls`、当前会话绑定和替换恢复已接入；新版 APK 通过 MuMu 独立电脑插件实测。维护角色：项目协作 Agent；核验 2026-09-26。来源：[手机工厂组合](../../src/remote-sidebar-chat.jsx)、[原契约](../../../deepseek-harness/packages/client/ui-conversation/src/client/contract/slots.ts)、[阅读观察器](../../src/remote-reading-context.mjs)。不是完整 factory 交付。
- 默认 Views 显示 DSHM 自有 RemoteWorkspace，局部控件接收真实 container/phase/locale。每个工厂实例拥有独立会话模型，局部 Views 替换不重建导航；SessionProvider 使用当前引用，返回父会话后插件 Hook 不再停留在初始子会话。整个宿主替换时优先读取仍存活的旧 reader，再取已保存快照，避免 React 先构造新树、后清理旧树造成位置丢失。比仅给默认视图补内容，这样同时覆盖插件切换与卸载路径。
- 首次读取失败显示错误与“重新读取聊天”，不留下空白；成功后才向严格 session 插槽提供已绑定引用。异步聊天主体出现/移除时更新正在阅读的会话，避免面板先挂载、内容后到导致阅读回执停在 null。观察范围仍是窗口和聊天主体边界，不对每个 token 读布局。
- 视图替换回归先暴露返回父会话后卸载重回子会话，证据见[导航失败](../../artifacts/conversation-factory-navigation-red.log)；模型生命周期调整后又暴露异步挂载的[阅读回执失败](../../artifacts/conversation-factory-reading-red.log)。修复后[完整 375×667 页面回归](../../artifacts/conversation-factory-browser.log)覆盖默认内容、局部控件、插件状态保留、会话 Hook、错误重试、替换/卸载、长内容与阅读状态；[350 项 Node](../../artifacts/conversation-factory-tests.log)、[Web 构建](../../artifacts/conversation-factory-build.log)、[APK/lint](../../artifacts/conversation-factory-android-build.log)通过。
- 真实截图复核发现浏览器回放没有复现的高度问题：[MuMu 失败测量](../../artifacts/conversation-factory-height-failure.json)中输入框底边 922px、可用屏幕 843px，插件外层高 818px、旁栏只剩 723px。按 diagnose 流程测量祖先，确认缩放层采用内容自然高度，打断整个会话的高度约束。仅为整块会话插槽向[外层自适应组件](../../src/ui/MobilePluginFrame.jsx)传递 fill 模式，继承窗口高度并按比例反算缩放前高度；插件内部不变，其余内容插槽维持自然高度。此前 `conversation-factory-height-red.log` 是未复现该问题的浏览器记录，不能作 RED 证据。
- [10:03:36 UTC MuMu](../../artifacts/conversation-factory-live-android.json)从真实电脑加载[独立插件](../../tests/fixtures/live-factory-plugin/client.js)，验证默认内容、局部控件、子→父会话、切换自定义 Views 后当前身份和草稿保留；输入框底边 828px/可用 843px，页面宽度/scrollWidth/clientWidth 均 420px。[实际截图](../../artifacts/conversation-factory-live-android.png)已查看，输入框处于屏幕内。采用[实际脚本](../../scripts/verify-conversation-factory-android.mjs)，没有模型请求或 Key/权限变更。
- 原 CLI 已卸载测试包，[10:04:11 UTC 清理复验](../../artifacts/conversation-factory-cleanup-android.json)确认控件和自定义 Views 移除、旁栏仍停在父会话，关闭后恢复原聊天及 `DSHM_LANGUAGE_DRAFT_20260925`。两次 errors/resources 为空，专用会话归档状态未修改。
- 尚未完成：factory 的完整 child 插槽、独立于 Views 的 composer、无会话 hero/品牌/工作区/预设组合，以及原 selectWorkspace/composerBlock 注入；当前默认 conversation.session 仍组合整页，不能称任意第三方 factory 已兼容。原审批/提问 apply、旁栏真实输出续读、遮挡时真实任务提醒、完整撤销/资源/第三方/性能及 R01–R16/A03–A06 继续推进；模型真实引用读取仍受余额限制，偶发 401 根因未确认。R12 网页转发暂不实施，延后仍是建议而非已确认移出范围。

## 插件输入框与停靠区（2026-09-26）

- 状态：主聊天与旁栏已接原 `conversation.composer.bar` 和 `conversation.input.dock`，新版 APK 通过实际 MuMu 独立电脑插件加载、读写草稿、缩放和卸载恢复。维护角色：项目协作 Agent；核验 2026-09-26。来源：[插槽宿主](../../src/remote-plugin-slots.jsx)、[输入组件](../../src/ui/RemoteComposer.jsx)、[原 owner 契约](../../../deepseek-harness/packages/client/ui-conversation/src/client/contract/slots.ts)。此段替代以下历史记录中 composer.bar 尚未接入的状态；无会话 hero/完整 factory 仍未完成。
- 单一 RemoteComposer 保持原 SessionInputShell、附件、提交锁与草稿绑定，只将呈现交给原 single 插槽；卸载恢复默认编辑器。bar 接收 variant、blocked、disabled、placeholder 与原标准 useInput/inputActions；dock 按原 list/session 契约接收当前 session/input 快照。原 chain 接管仍在外层，离线恢复禁用的手机输入框；一次性子任务不因此出现可编辑输入。原内置目标条精确略过，继续使用手机已有目标摘要/操作窗口，其他同槽条目不受影响。
- 选择保持输入状态机常驻而不是随插件呈现重新创建，以防替换时丢失引用或产生第二条发送路径。浏览器回归验证草稿读写、引用节点保留、锁定、切会话隔离、卸载恢复、旁栏插件发送的真实模型调用路径，以及目标条去重不误伤同插件其他条目。回放仅在传输层使用显式 fixture，不冒充实际模型调用。
- 实测暴露旁栏原横向 flex 中手机容器 `min-width:auto` 被 600px 插件撑开，外层缩放错误地以 600px 为可用宽度。采用 diagnose 流程，先在[真实失败](../../artifacts/composer-bar-sidebar-width-failure.json)与[浏览器 RED](../../artifacts/composer-bar-width-red.log)复现，祖先测量证实旁栏 375px、手机容器 600px；仅给[手机外层](../../src/ui/remote-product.css)设置 width:100%/min-width:0，不修改插件内部或上游样式。[完整页面回归](../../artifacts/composer-bar-browser.log)通过，包含这条真实旁栏调用路径的宽度断言。
- [350 项 Node](../../artifacts/composer-bar-tests.log)、[Web 构建](../../artifacts/composer-bar-build.log)、[APK/lint](../../artifacts/composer-bar-android-build.log)通过。[09:41:29 UTC MuMu](../../artifacts/composer-bar-live-android.json)从真实电脑模块加载[独立测试包](../../tests/fixtures/live-composer-bar-plugin/client.js)，在主/旁两个会话修改并恢复原草稿，dock 与 bar 身份/快照一致，600px 内容缩到 420px，scrollWidth/clientWidth 均 420。[旁栏截图](../../artifacts/composer-bar-sidebar-android.png)已查看。[实际脚本](../../scripts/verify-composer-bar-android.mjs)未提供或点击模型发送入口。
- 原 CLI 已卸载测试包，[卸载复验](../../artifacts/composer-bar-cleanup-android.json)确认两类节点移除、默认编辑器与原草稿恢复，errors/resources 为空。原测试聊天归档状态保持，无 Key/设备权限变化。首次冷启动脚本错误假定已经在聊天页，后来补列表入口与归档筛选判断；该失败不视为产品缺陷。没有以真实余额不足作为本轮非模型验证的阻塞。
- 仍需：完整 conversation.content 工厂及 hero，原审批/提问 apply 兼容、旁栏真实输出续读、遮挡时真实任务提醒、完整撤销/资源失效/第三方/性能及其余 R01–R16/A03–A06；模型实际引用读取仍受余额限制，偶发 401 根因未确认。R12 网页转发保持待定、不实施，不能将本批称为完整 Remote 交付。

## 插件工作区会话导航（2026-09-26）

- 状态：原 `uiWorkspace` 的会话导航已接真实 Remote 控制器，并通过新版 APK 的 MuMu 插件验收；电脑目录选择/创建按已确认手机范围明确拒绝。维护角色：项目协作 Agent；核验 2026-09-26。来源：[导航服务](../../src/remote-workspace-navigation.mjs)、[模型装配](../../src/remote-model.mjs)、[原导航契约](../../../deepseek-harness/packages/client/ui-workspace/src/client/navigation.ts)、[插槽根 Hook](../../src/remote-plugin-slots.jsx)。本段替代下方历史记录中 uiWorkspace 尚未提供的状态，不代表完整插件工厂已兼容。
- 支持打开会话、连接/打开已有工作区、开始聊天、分支、归档及恢复归档。连接工作区仅返回真实会话 ID，优先复用同目录且未归档的空会话，否则创建；并发连接同工作区共用当前请求。开始聊天继承当前或最近工作区。异步导航沿已有请求序号、连接代次和生命周期检查，迟到结果不抢回新选择；电脑已完成的操作不撤销、不自动重发。
- 原接口约定导航主聊天，因此从插件旁栏调用也打开 DSHM 主聊天并收起旁栏；手机子会话菜单仍保留各视图独立导航。原 ui-subagent 的桌面 apply 不重复启用，继续使用已接入的手机组合。根 `useWorkspaces` Hook 提供真实工作区快照；`pickDirectory/listDirectory/createDirectory` 返回 `remote_directory_navigation_disabled`，不调用目录接口或伪造成功。相比启用依赖桌面 layout/目录选择器的原整套 apply，此实现复用同一会话模型并保留手机边界。
- [350 项 Node 测试](../../artifacts/workspace-navigation-tests.log)、[完整 375×667 页面回归](../../artifacts/workspace-navigation-browser.log)、[Web 构建](../../artifacts/workspace-navigation-build.log)、[APK/lint](../../artifacts/workspace-navigation-android-build.log)通过。覆盖实际模型的创建/复用、并发、回调导航竞争、失败、归档与主旁栏关系；页面回归验证原插件服务注入、工作区 Hook、导航和草稿。协议回放不代替实际电脑验收。
- [09:27:41 UTC MuMu 实测](../../artifacts/workspace-navigation-live-android.json)使用[独立电脑插件](../../tests/fixtures/live-navigation-plugin/client.js)与[实际脚本](../../scripts/verify-workspace-navigation-android.mjs)：在 DSH-TEST 复用真实空会话、打开/开始聊天、分支、归档清空主视图、恢复归档、旁栏调用打开主聊天、目录限制均通过。此次连接复用了已有空会话，不能称为实际新建验收；新建路径由上述模型测试及前批实际菜单新建证据覆盖。两次运行产生的两个分支已确认归档，原测试父聊天、联调聊天和草稿保持；[恢复截图](../../artifacts/workspace-navigation-restored-android.png)已查看。
- 原 CLI 已卸载临时测试包，[卸载复验](../../artifacts/workspace-navigation-cleanup-android.json)确认插件节点移除、原草稿保持；两份通过报告的 errors/resources 为空。DSH 56568、网关 31084 保持运行，无模型请求、Key/设备权限更改。首次[同名前缀选择器失败](../../artifacts/workspace-navigation-selector-failure.json)未创建会话；随后[清理菜单失败](../../artifacts/workspace-navigation-menu-failure.json)因脚本停在指南标签，改为先选择专用子会话标签后完整重跑，不涉及生产修改。
- 仍需完整 `conversation.content` 工厂、hero/composer.bar、原审批/提问 apply 兼容，以及旁栏真实输出续读、遮挡时真实任务提醒、完整撤销/资源失效/第三方/性能与其余 R01–R16/A03–A06。模型实际读取引用受余额限制；偶发 401 根因未确认。R12 网页转发暂不实施，延期仍是建议而非用户确认取消。完整 Remote 保持进行中。

## 异步操作与导航顺序（2026-09-26）

- 状态：新版APK通过MuMu主聊天/旁栏的新建和分支迟到响应验证。维护角色：项目协作Agent；核验2026-09-26。来源：[视图导航](../../src/remote-session-view.mjs)、[根模型](../../src/remote-model.mjs)、[旁栏模型](../../src/remote-conversation-model.mjs)、[原DSH导航契约](../../../deepseek-harness/packages/client/ui-workspace/src/client/navigation.ts)。
- 核对uiWorkspace时发现：手机create仅判断视图未关闭就select，fork只比较已完成的selection，均无法保护尚在查询目录的后续选择。现由各RemoteSessionView在写入开始时分配导航请求序号，后续select或写入导航立即替代旧意图；响应后同时核验原连接代次/在线状态/生命周期。create返回实际ID，结果仍进入原会话投影，不把放弃导航当作撤销电脑写入。archive同样不会清除较新待定选择。相比只增加selection比较，能覆盖导航尚未完成的窗口，主/旁栏互不取消。
- [五项修复前失败](../../artifacts/navigation-race-red.log)复现主/旁栏create/fork抢占待定导航及create抢占已完成导航；[345项Node](../../artifacts/navigation-race-tests.log)通过，补验先后创建、跨视图隔离、离线拒绝、关闭旁栏及归档响应竞争。[完整375×667页面回归](../../artifacts/navigation-race-browser.log)、[Web构建](../../artifacts/navigation-race-build.log)、[APK/lint](../../artifacts/navigation-race-android-build.log)通过。
- [09:11:59 UTC实际MuMu](../../artifacts/navigation-race-android.json)通过[原生回执时序脚本](../../scripts/verify-navigation-race-android.mjs)：主聊天和旁栏分别从自己的菜单新建/分支，共四个真实操作；暂扣真实成功响应，关闭窗口后通过原子会话菜单打开专用子会话，再交付原响应，仍停留在子会话，返回保留父级草稿。只延迟对应原生事件，不替换响应、凭据或调用模型。新建使用已有DSH-TEST工作区，分支使用专用嵌套测试父聊天。
- 四个测试结果会话已通过原workspace/archiveSession响应确认归档；原联调聊天和草稿恢复，错误/资源失败数组为空。[恢复历史截图](../../artifacts/navigation-race-restored-android.png)已查看。DSH56568/网关31084保持运行，未修改Key、设备权限或原测试父聊天的归档状态。首次脚本没有等待App进程启动，后已补等待；首次实测把子会话标题错误限定为strong而超时，已改实际标题容器后完整重跑，[该次新增会话亦已归档](../../artifacts/navigation-race-first-selector-failure.json)。归档竞争只做协议回放，本轮不宣称真实网络下全部异常已验收。
- 原uiWorkspace还包括电脑目录选择/创建及桌面layout；直接启用会触发ui-subagent/agent-preset等额外组合。当前仅补共享导航的真实语义，未发布残缺uiWorkspace或将所有依赖插件标为兼容；完整factory/uiWorkspace、旁栏真实输出续读、通知/撤销/第三方/性能及其余R01–R16/A03–A06仍继续。R12网页转发待定，不动工。

## 插件输入区域接管（2026-09-26）

- 状态：新版APK通过独立电脑插件在真实MuMu的主聊天、旁栏接管与卸载恢复。维护角色：项目协作Agent；核验2026-09-26。来源：[插槽宿主](../../src/remote-plugin-slots.jsx)、[页面入口](../../src/ui/RemoteWorkspace.jsx)、[原链式渲染器](../../../deepseek-harness/packages/client/ui-renderer/src/client/scoped-slots.tsx)。
- 直接复用原`conversation.composer`链式选择、会话作用域及pending域，owner包含当前sessionId/session/pendingInteraction；overlay隐藏默认输入而不卸载，保留编辑器与草稿，断线只渲染fallback。主聊天与旁栏共用接入，插件外层缩放不改内部。相较另写手机选择器，沿用原优先级与卸载委托行为；没有伪造uiWorkspace。原完整conversation.content工厂、hero/composer.bar以及原审批/提问apply仍未完整接入，现有手机审批/提问继续有效。
- [337项Node](../../artifacts/composer-chain-tests.log)、[完整375×667页面回归](../../artifacts/composer-chain-browser.log)、[Web构建](../../artifacts/composer-chain-build.log)、[APK/lint](../../artifacts/composer-chain-android-build.log)通过。[主页面专项](../../scripts/check-remote-composer-chain.mjs)验证原优先级、DOM节点保持、草稿、切换隔离与卸载委托；[旁栏专项](../../scripts/check-sidebar-chat.mjs)验证同一输入区扩展。协议夹具不代替真实电脑验收。
- [08:59:11 UTC MuMu](../../artifacts/composer-chain-live-android.json)通过[实际脚本](../../scripts/verify-composer-chain-android.mjs)：[独立电脑插件](../../tests/fixtures/live-composer-plugin/client.js)经原CLI安装、原模块通道加载，主聊天与真实子会话分别接管，当前会话身份正确；默认编辑器同一DOM保留，原草稿未改，600px局部界面缩到420px且页面无横向溢出。返回原聊天仍保留该插件本地交互。[旁栏截图](../../artifacts/composer-chain-sidebar-android.png)已查看。
- [08:59:50 UTC卸载复验](../../artifacts/composer-chain-cleanup-android.json)通过：原CLI卸载测试包后两处插件节点消失，默认输入与原草稿恢复。两份报告errors/resources为空，无模型请求、Key/权限/绑定修改。此插件只注册自己的本地待处理交互，不制造远端审批；不能据此宣称所有第三方或原审批链式界面已验收。
- 初次验证遇到DSH/网关已停止与ADB反向端口映射丢失，核实后按原持久化配置恢复，当前DSH56568/网关31084监听3080/8787。首次节点保持断言失败，脚本未先等待插件入口；增加就绪等待后节点保持验证通过，未据此认定所有启动竞争均已解决。随后精确宽度断言因420.0000305px浮点误差失败，连续5帧确认实际scrollWidth/clientWidth均420，仅改测试为0.01px容差并保留严格无横向溢出断言，未改生产缩放。首次失败见[记录](../../artifacts/composer-chain-first-loaded-failure.json)。[文档本地链接校验](../../artifacts/composer-chain-docs.log)通过，Linear项目与KKC-17当前描述已同步，保持进行中。
- 仍需原完整factory/uiWorkspace、真实旁栏命令输出续读、遮挡期间真实任务提醒、完整撤销/资源失效/第三方/性能及其余R01–R16/A03–A06。模型实际读取引用仍受余额限制；偶发401根因未确认。R12网页转发暂不动工，延期仍是建议而非确认取消。完整Remote未完成。

## 输入引用持久化（2026-09-26）

- 状态：新版APK通过真实MuMu文件/聊天引用、主旁栏交接、核心更新与App强制退出恢复。维护角色：项目协作Agent。核验2026-09-26。来源：[草稿存储](../../src/remote-drafts.mjs)、[输入会话](../../src/remote-input-session.mjs)、[根模型](../../src/remote-model.mjs)、[App恢复](../../src/RemoteApp.jsx)、[原引用节点](../../../deepseek-harness/packages/client/ui-conversation/src/client/input/editor/chip-node.tsx)。本段替代以下历史记录中的跨binding/App结构化引用未实现状态。
- 使用原Lexical JSON保存source/ref与显示属性，不持久化插件实例、会话对象、已解析文件内容或提交请求。相比文字/结构分两条记录，选择单记录版本化封装，一次严格事务完成；兼容旧纯文字。按origin/deviceId/fingerprint及会话隔离，发送成功清空，普通文字覆写清除旧结构，重试保存同时保留结构。提交未确认前保持原草稿，恢复不自动发送。
- 原shell文字mirror不报告同显示文字的引用身份替换，现监听编辑器内容更新，纯光标移动不写入；保留原换行节点。重建时检查原编辑器文字投影，不能覆盖较新的其他入口文字。解析失败提示并禁止直接按降级文字发送；提供方消失或解析失败继续沿原提交状态机拒绝。模型实际读取引用的验收仍受电脑余额不足影响，本批没有模型请求。
- [337项Node](../../artifacts/structured-drafts-tests.log)、[完整375×667原插件页面回归](../../artifacts/structured-drafts-browser.log)、[实际RemoteApp装配恢复回归](../../artifacts/structured-drafts-app.log)、[Web构建](../../artifacts/structured-drafts-build.log)、[APK/lint](../../artifacts/structured-drafts-android-build.log)通过。Node覆盖IndexedDB重开/隔离/旧版迁移/删除；原shell回归覆盖引用身份、失败/在途/提供方卸载/不重发；App依赖回放覆盖失败、重复失败、断线、取消、权限变化时结构的保留或清理，不冒充真实认证验收。首次页面回归发现旧结构可能覆盖更新文字，已加入原投影核对；换行断言从旧段落重建改为保留原换行。
- [08:32:19 UTC MuMu冷启动](../../artifacts/structured-drafts-android.json)与[08:33:29 UTC核心更新加冷启动](../../artifacts/structured-drafts-rebuild-android.json)通过。使用[真实脚本 --restart --rebuild](../../scripts/verify-input-handoff-android.mjs)、专用归档聊天、真实文件/聊天候选；每类引用验证主→旁→主、原核心模块更新后的新连接、force-stop后重开。原聊天/草稿/归档和原核心bundle字节/时间戳恢复，临时文件删除，errors/resources为空。[恢复截图](../../artifacts/structured-drafts-chat-android.png)已查看。DSH23668、网关37148保持运行，未更改Key、设备权限或电脑配置。
- 仍需：遮挡期间真实任务提醒、原完整factory/uiWorkspace、真实旁栏命令输出续读、完整撤销/资源失效/第三方/性能与其余R01–R16/A03–A06。R12网页转发暂不动工，移出首版仍是建议而非确认取消。不能将本批视为整个Remote完成。
- 最终包补充损坏结构的跨页保护：保留原JSON与禁止降级发送状态，用户明确重新编辑后才解除。原shell损坏节点回归通过；最终APK覆盖安装后[08:36:51 UTC完整MuMu复验](../../artifacts/structured-drafts-final-android.json)再次通过两类引用、两次核心更新与两次App退出恢复，清理及原状态恢复全部成功。文档校验见[结果](../../artifacts/structured-drafts-docs.log)。

## 旁栏弹窗与阅读状态（2026-09-26）

- 状态：代码、实际页面回归及新版APK真实原生桥回执通过；弹窗遮挡期间的新任务通知展示尚未实测。维护角色：项目协作Agent。来源：[阅读观察器](../../src/remote-reading-context.mjs)、[根页面](../../src/ui/RemoteWorkspace.jsx)、[旁栏窗口](../../src/remote-plugin-panels.jsx)、[原生context接口](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNotificationBridge.kt)、[提醒消费](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNotifications.kt)。
- 旧根页面根据focused子会话选择阅读身份，但仅检查自己的sheet/file/command/jobOutput；旁栏窗口和原插件portal遮挡后仍上报子会话，可能被原生同会话抑制规则吞掉提醒。新增观察器检查实际native dialog、原插件aria-modal窗口和非聊天面板，遮挡上报null，关闭恢复正确视图的sessionId。相比向每个插件逐个添加通知回调，保持插件内部不变并覆盖原Modal；不增加通知协议/权限或制造任务事件。只由根页上报，观察窗口边界变化而非正文流，卸载清空。
- 关联返回问题：PanelSurface只识别原role=dialog，遗漏native dialog，Escape会收起整个旁栏。现识别两者；Android合成Escape不会执行浏览器默认cancel，返回改为向最上层native dialog派发可取消cancel事件，沿Surface原onClose执行。菜单仍优先，原Modal保留原Escape关闭契约。
- [阅读状态RED](../../artifacts/reading-context-red.log)复现旁栏模式窗口未上报null；[Android返回RED](../../artifacts/reading-context-back-red.log)复现合成Escape无法取消native dialog。[完整页面回归](../../artifacts/reading-context-browser.log)覆盖主/旁栏身份、手机窗口、原插件Modal输入与返回、非聊天指南面板、关闭恢复，另保留已有菜单/Modal/面板嵌套回归。使用明确协议fixture，不等同真实电脑插件通知验收。[335项Node](../../artifacts/reading-context-tests.log)、[Web构建](../../artifacts/reading-context-build.log)、[APK/lint](../../artifacts/reading-context-android-build.log)通过。
- 新APK已安装。[08:18:38 UTC MuMu](../../artifacts/reading-context-android.json)通过[实际脚本 --dropdown --reading --switch](../../scripts/verify-sidebar-chat-android.mjs)：原生桥133次请求全部成功回执，主/旁栏身份不同，打开模式窗口null、Android返回仅关闭窗口并恢复同一子会话。包含三层原菜单、只读孙会话、主聊天切换恢复和12次标签开关，原聊天/草稿/归档恢复；errors/resources与原生失败数组为空，[恢复截图](../../artifacts/reading-context-reading-restored-android.png)已查看。DSH23668/网关37148保持，无模型请求、Key/权限/电脑配置变化。
- [桥旁听器](../../scripts/remote-reading-probe.mjs)仅记录notifications.context及对应成功/失败回执，原调用与响应全部转交，finally恢复原方法，不伪造响应。首次刚安装后[未捕获回执](../../artifacts/reading-context-native-first-failure.json)的原因未完全确定；旁听安装移至真实工作区挂载后，再冷启动完整复验通过，不能据此宣称所有启动竞争已修复。
- 仍需：真实任务到达时的旁栏遮挡提醒、原完整factory/uiWorkspace、真实旁栏命令输出续读、跨binding/App退出引用、完整撤销/资源/第三方/性能及其余R01–R16/A03–A06。R12网页转发保持待定，不动工。
- [实际App装配恢复回归](../../artifacts/reading-context-app.log)补验失败、重复失败、断线、取消及权限变化五场景通过；采用明确依赖回放，不冒充真实认证。文档本地链接校验通过。

## 原子会话下拉与触屏（2026-09-26）

- 状态：新版APK已在MuMu验证真实主聊天、旁栏触摸入口；完整Remote仍未完成。维护角色：项目协作Agent。来源：[手机组合](../../src/remote-subagent-lineage.jsx)、[旁栏注册](../../src/remote-sidebar-chat.jsx)、[原组件](../../../deepseek-harness/packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx)、[原菜单回归](../../scripts/check-remote-lineage.mjs)。
- 直接复用原树形菜单、层级展开、状态、语言和目录订阅。仅在外层把操作绑定到当前RemoteConversationModel/根模型，验证会话引用及父子地址；打开旁栏保留主聊天。各菜单独立持有目录，共享既有RemoteSessions计数。priority100为默认lineage，第三方可覆盖，卸载回到原菜单。相比补一个不完整uiWorkspace来激活整套原apply，本次组合不声明未提供的目录选择、工作区创建等接口；完整factory/uiWorkspace仍待接入。
- 真实触屏发现：WebView触摸打开后生成兼容mouseout，原菜单120ms悬停关闭计时器在第二次触摸前隐藏菜单，可能点到后面控件。见[事件证据](../../artifacts/subagent-dropdown-events-android.json)及[浏览器RED](../../artifacts/subagent-dropdown-touch-red.log)。外层按指针类型过滤触摸兼容mouseover/out，点击沿原ArrowDown入口打开；鼠标移动/点击可恢复鼠标方式，不改插件内部。标题外层并排显示名称与计数，避免长标题出现竖向滚动条。
- [335项Node](../../artifacts/subagent-dropdown-tests.log)、[完整375×667页面回归](../../artifacts/subagent-dropdown-browser.log)、[Web构建](../../artifacts/subagent-dropdown-build.log)、[APK/lint](../../artifacts/subagent-dropdown-android-build.log)通过。回归覆盖触摸兼容事件后菜单持续打开、主/旁栏独立切换、嵌套树、只读子任务、草稿及第三方lineage覆盖/卸载；使用明确协议fixture，不冒充真实电脑验收。
- 新APK已覆盖安装。[MuMu实际报告](../../artifacts/subagent-dropdown-android.json)使用[脚本 --dropdown --switch --rebuild](../../scripts/verify-sidebar-chat-android.mjs)及已有归档三层会话，真实WebView触摸打开菜单、展开孙会话、旁栏打开与父级返回、两次真实核心HMR恢复、主聊天往返、12次标签开关通过。原聊天/草稿/归档状态及核心bundle字节/时间戳恢复，errors/resources为空；没有新模型请求、Key或授权修改。DSH23668、网关37148保持运行。[菜单截图](../../artifacts/subagent-dropdown-menu-android.png)及[旁栏截图](../../artifacts/sidebar-chat-child-android.png)用于实际布局核验。
- 首次Android脚本的locator.tap因附加context未声明hasTouch被工具拒绝，见[驱动失败](../../artifacts/subagent-dropdown-touch-driver-failure.json)；改用WebView真实触摸事件后暴露上述产品问题，并已修复复验。调试监听已从脚本清理。此前浏览器脚本的旧纯文字断言和未初始化资源服务已修正，不能据此扩大产品修复结论。
- 剩余：完整factory/uiWorkspace、旁栏弹窗通知、真实旁栏命令输出续读、跨binding/App退出结构化引用、撤销/资源失效及完整第三方/性能，R01–R16/A03–A06继续。R12网页转发保持待定，不实施；延后首版仍只是建议。

## 子会话目录共同持有（2026-09-26）

- 状态：手机多视图与插件原布尔目录接口已合并生命周期，新APK已安装并通过真实旁栏回归；原ui-subagent下拉界面与完整uiWorkspace仍未接入。维护角色：项目协作Agent；核验2026-09-26。来源：[RemoteSessions](../../src/remote-sessions.mjs)、[模型装配](../../src/remote-model.mjs)、[视图持有](../../src/remote-session-view.mjs)、[原目录管理器](../../../deepseek-harness/packages/api/session-controller/src/client/sessions/manager.ts)。
- 原setSubagentCatalogOpen(false)直接删除目录观察，之前手机WeakMap只能协调手机视图，无法防止原插件菜单关闭停止整个目录更新。现在继承原ClientSessions，仅协调布尔菜单状态与多视图计数；查询、事件、投影、去抖和原会话生命周期全部沿用。重复true仍按原接口触发刷新但不累加，最后一个视图退出也不会关闭仍打开的菜单；全部关闭及模型释放清理。没有实现另一套目录查询或伪造uiWorkspace。
- [RED](../../artifacts/catalog-ownership-red.log)用真实RemoteModel/ClientSessions/SessionManager及显式协议fixture复现菜单关闭后成员事件无法刷新；[335项Node](../../artifacts/catalog-ownership-tests.log)通过，覆盖反向退出顺序、重复true、最后关闭后不再查询。[完整页面回归](../../artifacts/catalog-ownership-browser.log)、[Web构建](../../artifacts/catalog-ownership-build.log)和[APK/lint](../../artifacts/catalog-ownership-android-build.log)通过。成员变化由测试Host回放，不代表本轮创建了真实子任务。
- [07:42:38 UTC MuMu](../../artifacts/catalog-ownership-android.json)在已有归档三层会话通过主/旁栏切换、父级导航、两次实际核心更新、只读孙会话、文字草稿与筛选恢复及12次关闭重开。最终原聊天和草稿恢复，核心bundle字节与时间戳恢复，errors/resources为空；DSH23668与网关37148运行，无模型请求、Key/权限修改。使用[实际脚本 --switch --rebuild](../../scripts/verify-sidebar-chat-android.mjs)，报告使用独立前缀保留旧证据。
- 已核对现存子会话测试记录没有命令执行，无法据此完成真实旁栏输出续读；该项保持待验，不以普通回复代替命令输出。原完整factory/uiWorkspace和下拉组件、旁栏弹窗通知、跨binding结构化引用、完整撤销/第三方/性能及R01–R16/A03–A06继续；R12网页转发待定且不动工。

## 主聊天切换后的旁栏恢复（2026-09-26）

- 状态：导航和文字草稿已通过真实MuMu切换恢复；只读输出快照通过实际组件回放，真实续读仍待验收。维护角色：项目协作Agent；核验2026-09-26。来源：[内存](../../src/remote-panel-memory.mjs)、[标签宿主](../../src/remote-plugin-panels.jsx)、[旁栏视图](../../src/remote-sidebar-chat.jsx)、[原标签生命周期](../../../deepseek-harness/packages/client/ui-sidebar-right/src/client/tab-domain.ts)。
- 问题：标签布局保留，但切走主聊天会卸载旁栏，旧observe清理直接丢弃读取器，返回后从原始子会话地址重新打开。现在把原TabOccurrence.signal传入旁栏；视图临时卸载保存只读快照，原标签关闭时删除活动/离屏快照，运行环境销毁清除监听与状态。迟到cleanup不能覆盖新观察者。捕获在布局清理阶段，早于后代输出读取器释放；不保留会话引用、审批或写请求。相比持续挂载全部旁栏，保留快照不增加长期会话订阅。
- [单元RED](../../artifacts/sidebar-switch-red.log)复现临时卸载丢失；[334项Node](../../artifacts/sidebar-switch-tests.log)通过，新增卸载/离屏关闭/运行环境销毁/重开身份测试。[完整页面回归](../../artifacts/sidebar-switch-browser.log)通过真实RemoteWorkspace在one→two→one切换后恢复已导航的父会话及只读输出文字/字节游标，再次重建保持、关闭不恢复。[实际App装配回归](../../artifacts/sidebar-switch-app.log)通过；这些使用明确协议/依赖回放，不是远程真实输出验收。
- [旧APK真实失败](../../artifacts/sidebar-switch-red-android.json)在切换主聊天后回到子会话而非父会话；已清理本脚本精确测试草稿并恢复原聊天。[构建](../../artifacts/sidebar-switch-build.log)、[APK/lint](../../artifacts/sidebar-switch-android-build.log)通过并覆盖安装。[07:34:01 UTC MuMu](../../artifacts/sidebar-switch-android.json)在专用归档三层会话导航到父级，切至另一个主聊天，再返回原旁栏仍停在父级，文字草稿保持；关闭后12次重开从子会话开始，最终回原聊天且草稿/归档状态恢复，errors/resources为空。[恢复截图](../../artifacts/sidebar-switch-restored-android.png)已查看。[脚本 --switch](../../scripts/verify-sidebar-chat-android.mjs)未发送模型请求、修改Key/权限或安装电脑插件。
- 同一新版APK另通过[07:35:40 UTC核心更新复验](../../artifacts/sidebar-switch-core-android.json)：两次真实HMR后孙会话只读、父级导航、文字草稿、归档筛选和12次开关保持；bundle字节及原时间戳恢复，errors/resources为空。DSH23668和网关37148持续运行。原sidebar-recovery-android.json由脚本同步更新为本次最新复验，上一节历史时间不作为该文件当前时间。
- 剩余：真实旁栏输出续读、核心更新撤销/资源失效、跨binding/App退出结构化引用、原完整factory/uiWorkspace、目录菜单持有、旁栏弹窗通知及完整第三方/性能仍未完成。R01–R16/A03–A06继续，R12网页转发待定且不动工。

## 网关认证错误分类（2026-09-26）

- 状态：已修复有效证明的防重放数据库写入失败被误报为401；新网关已在本机运行，手机沿用现有APK与绑定完成真实回归。维护角色：项目协作Agent。来源：[认证实现](../../../backend/packages/gateway/src/auth.ts)、[路由回归](../../../backend/tests/auth-storage-failure.test.ts)与[错误边界](../../../docs/protocol.md#dpop-证明)。
- 采用分离签名校验和防重放存储错误的最小修改，不放宽签名时间、重放或授权检查。数据库失败仍拒绝请求，返回既有500/internal_error且不泄露数据库异常；恢复后新证明可以成功，已消费证明仍401。相比手机把所有401都当成可重试错误，此修复在服务端保留真实认证失败语义，无须改手机协议。
- 使用有效ES256证明、真实Store/Gateway及PGlite，只在防重放SQL入口注入异常。[修复前](../../../backend/artifacts/auth-storage-red.log)实际返回401；[修复后四项回归](../../../backend/artifacts/auth-storage-tests.log)覆盖状态查询、票据申请、恢复、重放、复制凭据、撤销、配对竞争及真实socket路由。类型检查与构建通过，见[类型日志](../../../backend/artifacts/auth-storage-typecheck.log)和[构建日志](../../../backend/artifacts/auth-storage-build.log)。这不是生产数据库故障演练。
- 网关37148已替换18964，DSH23668保持，health通过。[07:27:50 UTC MuMu](../../artifacts/auth-storage-verified-android.json)沿既有绑定打开真实归档会话，文件/聊天引用在主聊天与旁栏往返保持，原聊天与草稿恢复，临时测试文件清理，errors/resources为空。无模型请求、Key或权限修改。采用[既有实际入口脚本](../../scripts/verify-input-handoff-android.mjs)，本轮未修改APK。
- 首次脚本在网关重启的电脑通道恢复窗口尝试打开聊天，页面提示暂时离线并等待输入框超时，见[失败报告](../../artifacts/auth-storage-android.json)。连接恢复后手动打开同一会话成功，再完整复验通过；不抹去该失败，不将本次回归称为所有重连竞争已解决。
- 上一批间歇性401仍未确定根因：约5秒失败与连接池5秒等待上限相符，但缺少当时数据库异常证据，只能证明存在上述错误分类缺陷。真实旁栏输出续读、旁栏卸载后的阅读恢复、完整撤销/第三方/性能及R01–R16/A03–A06继续；R12网页转发待定、不动工。

## 旁栏核心重建恢复（2026-09-26）

- 状态：当前旁栏标签及视图选择、普通文字草稿、列表筛选已通过真实核心更新恢复；旁栏只读输出恢复已通过实际组件回放，真实输出续读仍待验收。维护角色：项目协作Agent；核验2026-09-26。来源：[旁栏内存](../../src/remote-panel-memory.mjs)、[恢复捕获](../../src/remote-resume.mjs)、[App装配](../../src/RemoteApp.jsx)、[旁栏组合](../../src/remote-sidebar-chat.jsx)和[共享页面](../../src/ui/RemoteWorkspace.jsx)。
- 保留原标签布局数据，并按父会话/标签身份保存当前选择、祖先路径、命令/任务只读checkpoint；新运行环境经原资源/会话服务重新取得引用，之后才挂载恢复的输出窗口。相比重新打开初始子会话地址，可保留已导航到父级的当前位置；相比复用旧资源实例，不携带旧会话/审批句柄、请求或资源凭据。工作区、归档和搜索筛选同样恢复；写操作、确认窗口不恢复，读取下一段仍由用户主动发起。只在本次应用内存和同一绑定内交接，App退出及跨binding结构化引用恢复仍未实现。
- [332项Node](../../artifacts/sidebar-recovery-tests.log)、[完整页面回归](../../artifacts/sidebar-recovery-browser.log)与[实际RemoteApp装配回归](../../artifacts/sidebar-recovery-app.log)通过。新增[内存测试](../../tests/remote-panel-memory.test.mjs)覆盖标签身份、关闭窗口、迟到cleanup与重复恢复；原页面专项覆盖旁栏输出文字/字节游标、全屏、stderr/history、再次重建及关闭不恢复。App专项覆盖失败/再次失败/断网重试保留，主动断开/权限变化清除；均为明确的协议或依赖回放，不代表真实授权变更。首轮浏览器误用子会话列表名代替原标签名，保留[记录](../../artifacts/sidebar-recovery-selector-first.log)。
- [Web构建](../../artifacts/sidebar-recovery-build.log)、[APK/lint](../../artifacts/sidebar-recovery-android-build.log)通过并覆盖安装。[07:16:35 UTC MuMu](../../artifacts/sidebar-recovery-android.json)用[脚本 --rebuild](../../scripts/verify-sidebar-chat-android.mjs)在专用归档三层会话实际触发两次核心HMR：孙会话仍只读、两标签和主选择保持，子草稿保留，旁栏导航到父级后重建不回跳，最终归档筛选和原聊天/草稿恢复，12次开关通过，errors/resources为空。[父级恢复截图](../../artifacts/sidebar-recovery-parent-android.png)已查看。仅调整实际核心bundle时间戳，最终SHA256相同、时间戳恢复，无模型请求、Key或权限修改；DSH23668/网关18964未重启。
- 失败记录：首轮恢复成功后脚本将空段落换行与空字符串比较失败，见[空草稿记录](../../artifacts/sidebar-recovery-empty-first-android.json)；后续发现核心重建重置归档筛选，已补齐实际筛选恢复，见[筛选记录](../../artifacts/sidebar-recovery-filter-first-android.json)。安装后一次GET /v1/device返回401，而同批ticket为200；[连接失败记录](../../artifacts/sidebar-recovery-auth-first-android.json)保留，使用既有绑定点击重新连接后恢复。原因未确认，不能宣布间歇性401已修复。
- 剩余：真实旁栏输出续读、主会话切换卸载旁栏后的阅读状态保留、核心更新中撤销/资源失效完整矩阵、跨binding结构化草稿、原完整factory/uiWorkspace、目录菜单持有和旁栏弹窗通知仍待完成。完整Remote继续推进；R12网页转发待定、不动工。

## 输入引用交接（2026-09-26）

- 状态：同一会话绑定内，主聊天/旁栏编辑器重建保留结构化引用；新版APK已在MuMu验证。维护角色：项目协作Agent；核验日期2026-09-26。来源：[输入绑定](../../src/remote-input-bindings.mjs)、[输入会话](../../src/remote-input-session.mjs)与[原引用节点](../../../deepseek-harness/packages/client/ui-conversation/src/client/input/editor/chip-node.tsx)。
- 仅保存原编辑器JSON并在同一binding内交接，保留source/ref及展示属性；不缓存已解析文件内容或插件对象。相比只恢复clipboard文字，保留真实引用身份；相比另建引用存储，不增加第二套序列化协议。发送仍由原提供方解析，提供方消失时拒绝降级发送。仅当权威草稿文字仍匹配才恢复，其他入口的新草稿不被覆盖。在途交接取消旧提交并保留提交前结构，不自动重发。跨App退出、binding释放或核心重建的结构化草稿持久化仍未实现。
- [329项Node](../../artifacts/input-handoff-tests.log)、[完整375×667页面回归](../../artifacts/input-handoff-browser.log)通过。[原shell专项](../../tests/fixtures/remote-input-checks.mjs)共12项，覆盖引用重新解析、提供方消失、迟到序列化及新草稿保护；[实际页面专项](../../scripts/check-sidebar-chat.mjs)覆盖只读子会话返回及同父会话主/旁输入交接。传输为明确协议回放，不冒充真实模型请求。首次实现遇到Lexical空root不可恢复，已跳过空状态，见[失败](../../artifacts/input-handoff-empty-first.log)。
- [Web构建](../../artifacts/input-handoff-build.log)、[APK/lint](../../artifacts/input-handoff-android-build.log)通过并覆盖安装。旧APK在07:01:18 UTC实际复现引用变文本，见[RED](../../artifacts/input-handoff-red-android.json)；旧脚本空段落换行导致草稿恢复比较false，修正为仅空草稿按空白等价比较。新版[07:02:23 UTC MuMu](../../artifacts/input-handoff-android.json)通过真实文件/聊天候选插入、主→旁父会话→主引用保持；errors/resources为空。使用[真实脚本](../../scripts/verify-input-handoff-android.mjs)，[聊天引用截图](../../artifacts/input-handoff-chat-android.png)已查看；专用测试文件删除，父草稿与原会话草稿恢复、归档保持，无模型请求/权限/Key修改。DSH23668及网关18964未重启。
- 本节完成上次旁栏待办中的同binding引用交接；原完整factory/uiWorkspace、核心重建恢复、目录菜单持有、旁栏弹窗通知及完整第三方/撤销/性能继续推进，Remote整体未完成。R12网页转发仍待定，不动工。

## 子会话旁栏实际接入（2026-09-26）

- 状态：DSHM自有旁栏聊天已接入并在MuMu读取真实三层会话；完整原ui-subagent及第三方兼容仍未完成。维护角色：项目协作Agent；核验日期2026-09-26。来源：[旁栏组合](../../src/remote-sidebar-chat.jsx)、[会话呈现模型](../../src/remote-conversation-model.mjs)、[共享聊天页面](../../src/ui/RemoteWorkspace.jsx)和[原旁栏资源](../../../deepseek-harness/packages/client/ui-subagent/src/client/sidebar-chat/index.tsx)。本节更新下方两批基础拆分的待办状态。
- 原资源地址、标签、SessionReference及ConversationSlotPanel保留，移动conversation.content组合复用整个RemoteWorkspace；不加载电脑整页。相比另建完整RemoteModel，独立选择/目录和局部操作状态只持有必要的服务，连接、草稿、附件、写入锁与原SessionBinding仍共用。命令动作、子会话及工作流成员导航、模型/改名/分支/归档按实际视图路由。手机全屏面板只挂载当前可交互的编辑器，返回主栏恢复同一会话草稿；不是两处同时编辑的承诺。
- 原旁栏组合由注入作用域注册，曾被通用插件框当作桌面内容缩至约55%。现以受控组件身份只豁免承载DSHM聊天的两个组合，其他局部插件继续遵守作者/用户缩放规则；实际旁栏宽420.27px、高723.20px，与面板高度一致，不再整体缩小。会话打开尚未结束时返回按钮明确禁用，修复可点却被忙碌状态忽略的问题。
- 原8条长期订阅在真实父/子/孙会话与评价订阅并存时返回too_many_streams，见[真实失败](../../artifacts/sidebar-chat-stream-limit-red-android.json)。网关调整为20条长期订阅、8路传输，每连接32和全局4096总上限保持；满额时仍可承载4个短请求。相比另开连接绕过限制，本方案维持同一设备连接边界。见[容量协议](../../../docs/protocol.md#并发容量)、[真实HTTP/WebSocket回归](../../../backend/tests/remote-stream-capacity.test.ts)与[结果](../../../backend/artifacts/sidebar-capacity-tests.log)。类型检查和后端构建通过，原网关38228已核对身份后替换为18964，DSH23668保持。
- [329项Node测试](../../artifacts/sidebar-chat-tests.log)与[完整375×667页面回归](../../artifacts/sidebar-chat-browser.log)通过；浏览器专项使用明确的协议回放，覆盖原资源/标签、子会话发送的父子地址、只读限制、同一会话输入交接、返回忙碌状态和不缩放的几何边界。回放发送不等于本批真实模型请求。测试源见[页面专项](../../scripts/check-sidebar-chat.mjs)与[模型测试](../../tests/remote-model.test.mjs)。
- [Web构建](../../artifacts/sidebar-chat-build.log)、[APK及lint](../../artifacts/sidebar-chat-android-build.log)通过，新APK已覆盖安装。[06:47:18 UTC MuMu](../../artifacts/sidebar-chat-android.json)在已有归档测试记录验证子/孙历史、一次性只读、主选择不变、子草稿保留、旁栏返回父会话后主输入继续编辑、关闭标签及12次重复打开/关闭无超限，最后保留归档并返回原联调聊天；errors/resources为空。使用[真实脚本](../../scripts/verify-sidebar-chat-android.mjs)，[子会话截图](../../artifacts/sidebar-chat-child-android.png)已查看。没有模型请求、Key/权限修改或测试插件安装；仅清理精确测试草稿。首次脚本未等待App进程及错误使用会话标题代替原标签label的失败分别保留在[启动记录](../../artifacts/sidebar-chat-startup-first-android.json)与[标签记录](../../artifacts/sidebar-chat-label-first-android.json)，真实返回问题保留[修复前证据](../../artifacts/sidebar-chat-return-red-android.json)。
- 剩余：原conversation.content完整composer/hero契约与uiWorkspace/子会话下拉尚未接齐，当前仅完成手机旁栏所需的原资源与局部组合。原boolean目录菜单与多视图持有整合、旁栏内只读输出在核心重建后的恢复、结构化引用在输入交接时完整保留、旁栏弹窗期间的通知可见性及更完整操作/撤销/性能仍待验收。不可把本批称为完整插件兼容或全部Remote完成。R01–R16/A03–A06继续推进，R12网页转发维持待定且不动工。

## 独立视图输入与操作（2026-09-26）

- 状态：独立视图已可沿同一RemoteModel执行发送、停止、队列与审批，原输入组件支持显式视图；完整旁栏界面仍未接入。维护角色：项目协作Agent；核验日期2026-09-26。来源：[共享模型](../../src/remote-model.mjs)、[视图](../../src/remote-session-view.mjs)、[输入绑定](../../src/remote-input-bindings.mjs)、[原输入提交接入](../../src/remote-input-session.mjs)与[手机输入组件](../../src/ui/RemoteComposer.jsx)。
- 相比复制完整RemoteModel/输入服务，本次将目标视图作为原操作的显式参数；连接、草稿、附件、发送锁、审批锁仍由共享模型唯一持有。独立视图恢复草稿不会切换主聊天的技能/计划作用域；发送保留原子会话地址和requestId。主会话切换不影响其他视图已发起的操作，当前视图切换或关闭后的迟到提交拒绝；在途取消继续保留未知结果的附件和草稿，不重发。
- 队列使用目标视图的原投影，聊天审批另外检查原PendingInteraction的sessionId；应用级事件处理保留独立入口。输入框、附件粘贴、标准插件附件移除和原/file命令不再隐式使用主聊天ID。关闭视图立即释放原shell并取消引用序列化，不等待React卸载；不会清理该会话的持久化草稿。
- [327项Node测试](../../artifacts/session-actions-tests.log)通过，新增6项[原Controller路径回放](../../tests/remote-model.test.mjs)覆盖子会话真实地址路由、只读拒绝、共享发送锁、视图切换/关闭、未知结果、队列和审批归属。[375×667完整浏览器回归](../../artifacts/session-actions-browser.log)通过，其中[输入专项](../../tests/fixtures/remote-input-checks.mjs)使用实际页面模型与原SessionInputShell验证不同会话输入并存、附件归属及立即释放。传输为明确标注的协议回放，不代表手机旁栏已实测。首轮模型测试误读args.request层级，首轮浏览器专项放在主聊天打开前，均已修正测试并保留[模型失败记录](../../artifacts/session-actions-model-first.log)与[浏览器失败记录](../../artifacts/session-actions-browser-first.log)。
- [Web构建](../../artifacts/session-actions-build.log)、[APK与lint](../../artifacts/session-actions-android-build.log)通过，新版已覆盖安装。[06:14:08 UTC MuMu真实主入口](../../artifacts/session-actions-cleanup-android.json)验证三层已归档会话、祖先导航、只读孙会话、草稿及归档保留并返回原聊天，errors/resources为空，[截图](../../artifacts/session-actions-fallback-android.png)已查看。无模型请求、Key/权限/配置变更，DSH23668与网关38228保持运行。
- 下一步仍需共享消息/会话surface、原旁栏Conversation factory、原目录导航和视图内设置/命令动作的完整归属。当前每个SessionBinding仍只有一个活动输入实例；同一会话在主栏和旁栏同时编辑会替换旧实例，尚不能声称支持。多视图同父目录与原boolean菜单持有的整合仍待处理。两层README的可用功能不变；完整R01–R16/A03–A06继续实施，R12网页预览仅讨论过暂缓建议，用户未确认移出范围。

## 独立会话视图底层（2026-09-26）

- 状态：会话选择与投影的独立作用域已抽出，主聊天已迁移并安装新版APK；旁栏聊天界面、子视图输入/操作与原ui-subagent完整组合仍未完成。维护角色：项目协作Agent；核验日期2026-09-26。来源：[独立视图](../../src/remote-session-view.mjs)、[主模型接入](../../src/remote-model.mjs)、[原旁栏会话资源](../../../deepseek-harness/packages/client/ui-subagent/src/client/sidebar-chat/index.tsx)及[原导航依赖](../../../deepseek-harness/packages/client/ui-workspace/src/client/navigation.ts)。
- 原旁栏保留独立子会话reference，不能用主聊天单一selected替代，否则打开旁栏会改变主会话、输入归属和返回语义。相比建立另一个完整RemoteModel/连接，本次提取选择生命周期，复用已认证的ClientSessions及UiConversation；不复制原协议、不扩大授权、不伪造uiWorkspace。代价是后续仍需拆分输入与操作归属后才能组合完整旁栏。
- 视图独立持有选择序号、异步读取代次、引用、会话/聊天/模型/队列等原投影订阅和返回轨迹；旧就绪结果不覆盖新选择，引用读取失败保留原视图，离线不允许新导航。主模型继续负责草稿恢复、目标与输入服务。新增`createSessionView()`是内部读取/选择基础，不作为完整插件SDK或可写旁栏对外宣称。
- 关闭视图仅释放自己的引用和观察；父模型销毁取消全部视图。相同会话复用原binding和原follow，事件连接仍只有一个。共享父目录在这些视图之间计数持有，避免一个视图关闭导致另一个视图失去目录更新；原目录菜单仍使用自身原boolean接口，后续接入多视图菜单时需一起纳入持有规则，未声称任意第三方菜单的并发已经验证。
- [321项测试](../../artifacts/session-view-tests.log)通过；其中[真实Controller路径](../../tests/remote-model.test.mjs)验证独立选择、相同binding/follow复用、单事件连接、父草稿、原子会话地址和一次性只读、独立释放及父销毁；[时序单元测试](../../tests/remote-session-view.test.mjs)控制迟到就绪、失败/离线导航与订阅回收。新增视图的多窗口并存目前是自动回放证据，不是手机旁栏实测。
- [完整375×667页面回归](../../artifacts/session-view-browser.log)、[Web构建](../../artifacts/session-view-build.log)、[APK与lint](../../artifacts/session-view-android-build.log)通过。新版覆盖安装后，[05:58:12 UTC MuMu实际主入口](../../artifacts/session-view-cleanup-android.json)通过原三层已归档会话导航、只读孙会话、各层草稿及归档状态保留，最后返回原联调会话；errors/resources为空，[截图](../../artifacts/session-view-fallback-android.png)已查看。脚本[复用层级验收](../../scripts/verify-lineage-android.mjs)，以`DSHM_LINEAGE_PREFIX=session-view`独立保存本批证据，未覆盖此前插件验收。
- 本批未安装电脑测试插件、发送模型请求或更改Key/模型/权限，DSH23668与网关38228保持。两层README的产品行为仍准确，内部拆分不增加用户功能流水账。下一步将共享输入/消息及操作归属接入子视图，完成原旁栏Conversation factory与目录导航；完整R01–R16/A03–A06保持进行中，R12网页转发仍待用户决定。

## 会话层级与祖先导航（2026-09-26）

- 状态：原lineage插槽owner与手机祖先导航已接入，新版APK已安装并通过MuMu真实三层记录验证；完整第三方、原子会话下拉的其他依赖和Remote矩阵仍进行中。维护角色：项目协作Agent；核验日期2026-09-26。来源：[上游slot契约](../../../deepseek-harness/packages/client/ui-conversation/src/client/contract/slots.ts)、[原祖先派生与渲染](../../../deepseek-harness/packages/client/ui-conversation/src/client/skeleton/ConversationSession.tsx)、[手机组合](../../src/remote-plugin-slots.jsx)、[导航校验](../../src/remote-lineage.mjs)、[作者接口](../plugin-validation/mobile-layout-api.md)。
- 相比加载原桌面ConversationSessionHeader及完整uiWorkspace，当前采用原局部lineage契约接入DSHM已有会话模型；保留手机列表、父子地址和原生页面，代价是原ui-subagent下拉的工作区/嵌入聊天依赖仍需完整接入。没有伪造uiWorkspace使内置插件通过启动，也不把本批独立插件验收当作任意第三方兼容。上游参考保持只读。
- 链路只跟随原SessionSummary的parentId，缺项/环路即停止；当前会话不提供openTitle，祖先回调重新校验当前引用与父关系，沿已有持久化子会话地址返回并裁剪轨迹。RemoteModel继续检查在线状态和原子会话能力，选择失败保留原会话；草稿和只读限制没有独立副本。
- [317项手机测试](../../artifacts/lineage-tests.log)、[375×667实际页面回归](../../artifacts/lineage-browser.log)、[Web构建](../../artifacts/lineage-build.log)、[APK及lint](../../artifacts/lineage-android-build.log)通过。专项覆盖owner身份、三层导航、两层草稿、一次性只读、卸载回退与旧回调拒绝；[专项脚本](../../scripts/check-remote-lineage.mjs)使用标明的协议回放。完整回归首次在草稿重试后立即计数，撞到异步存储和批量页面刷新；已改等待按钮实际移除，没有降低保存结果要求，[首次失败](../../artifacts/lineage-browser-first-failure.log)保留。
- [05:44:21 UTC真实MuMu](../../artifacts/lineage-live-android.json)：通过[实际脚本](../../scripts/verify-lineage-android.mjs)打开已归档的`DSHM 嵌套恢复验证 1790340176811`，读取原父/子/孙记录。独立[测试插件](../../tests/fixtures/live-lineage-plugin/package.json)从电脑模块加载，孙会话无输入框，祖先owner的目标与当前session不同，点击子级再根级均保留原草稿；480px当前标题内容等比例缩到280px，页面宽420px无横向溢出。祖先栏自身允许局部横向滚动，[截图](../../artifacts/lineage-nested-android.png)已查看。
- 测试包由原DSH CLI[安装](../../artifacts/lineage-install.log)及[卸载](../../artifacts/lineage-uninstall.log)，没有新增管理授权。[05:45:08清理复验](../../artifacts/lineage-cleanup-android.json)确认插件移除、默认孙标题与祖先导航继续工作，各层草稿和归档状态保留，最后回到原`DSHM Remote 联调提示`，[回退截图](../../artifacts/lineage-fallback-android.png)已查看。两次errors/resources均空。首个验收脚本未将标题选择器限定到实际工作区，误匹配隐藏连接页；已修正选择器，[失败记录](../../artifacts/lineage-selector-failure-android.json)保留，非产品错误。
- 无新模型请求、Key/模型/权限配置更改，DSH23668和网关38228无需重启；现有DSHM Android仍仅保留聊天授权。完整R01–R16/A03–A06不缩减，R12网页中转的成本与必要性仍待用户决定。后续继续原ui-subagent完整服务依赖及嵌入会话局部界面，不以本批插槽注册替代其验收。

## 标题前置与角落插件（2026-09-26）

- 状态：原leading/corner局部插槽已接入并通过真实MuMu独立插件验证，新APK已安装；完整标题lineage、第三方及Remote矩阵仍进行中。维护角色：项目协作Agent；核验日期2026-09-26。来源：[原slot声明](../../../deepseek-harness/packages/client/ui-conversation/src/client/contract/slots.ts)、[手机组合](../../src/remote-plugin-slots.jsx)、[作者接口](../plugin-validation/mobile-layout-api.md)。
- 两个新插槽沿用原single/session契约，无额外owner参数，标准会话服务和作者/用户自适应优先级保持；与actions/utilities按原顺序放在手机标题下的局部区域。相比加载整个原ConversationSessionHeader，此方案不带入桌面导航、祖先/子会话切换和View切换；代价是lineage等契约需要单独完整接入。本批明确未提供lineage，也未伪造uiWorkspace服务让原导航插件启动。上游参考保持只读。
- [完整页面回归](../../artifacts/header-edges-browser.log)覆盖四区域顺序、延后注册、真实会话状态更新、切会话身份、交互、缩放、卸载零空白，同时原输入/文件/管理/子会话等检查通过。[Web构建](../../artifacts/header-edges-build.log)、[APK及lint](../../artifacts/header-edges-android-build.log)通过。
- [05:27:31 UTC真实MuMu](../../artifacts/header-edges-live-android.json)：独立[测试包0.0.2](../../tests/fixtures/live-header-plugin/package.json)由原DSH CLI安装，四区均来自真实模块资源，计数点击、相同sessionId、720→420px外层缩放及无横向溢出、手机模式唯一、返回重入及聊天草稿保留通过，errors/resources为空。[截图](../../artifacts/header-edges-live-android.png)已查看。未发模型请求，未改Key、模型、手机授权或既有插件配置；DSH23668/网关38228保持运行。
- 本轮内置浏览器连接不可用，采用源码核验过的原 `dsh plugin --profile web add <包> --ignore-scripts`，原操作负责包安装和bundle协调，真实手机已热加载，无需重启。卸载第一次传入pnpm remove不支持的ignore-scripts选项被拒绝，随后原CLI正常remove成功，见[安装](../../artifacts/header-edges-install.log)、[首次拒绝](../../artifacts/header-edges-uninstall.log)、[最终卸载](../../artifacts/header-edges-uninstall-final.log)。[05:28:17清理复验](../../artifacts/header-edges-cleanup-android.json)确认四测试区域全部卸载、区域零高度且草稿保持；不是仅以命令退出码断言页面清理。

## 管理页面断线恢复（2026-09-26）

- 状态：电脑设置、工作区与电脑插件管理的连接提示已修复，新版APK已安装并完成三个真实入口的断线恢复。维护角色：项目协作Agent；核验日期2026-09-26。来源：[共享连接提示](../../src/ui/RemoteConnectionNotice.jsx)、[设置](../../src/ui/RemoteComputerSettings.jsx)、[工作区](../../src/ui/RemoteWorkspaces.jsx)、[插件管理](../../src/ui/RemotePlugins.jsx)。
- 能力列表在重连时清空，不能据此推断无权限或需要更新；三处先检查当前连接，本代协商完成后才判断能力与授权。设置保留已加载表单及Key状态/地址确认的组件，离线禁用操作；工作区保留本地改名状态。相比缓存旧授权继续操作，此方案只保留编辑状态，服务层仍检查当前授权、连接代次、原快照及版本；跨代次的旧设置不能直接保存，需重新读取，且不自动重发未知写入。不是所有第三方插件表单都承诺断线保留。
- [完整原组件页面回归](../../artifacts/management-status-full-web.log)通过，覆盖三个真实页面入口的隔离连接回放、离线能力清空、重连与明确撤权、设置/地址确认/改名草稿保留及无写入。[语言回归](../../artifacts/management-status-language.log)、[15项设置/Key/地址/工作区服务测试](../../artifacts/management-service-tests.log)、[Web构建](../../artifacts/management-status-build.log)、[APK及lint](../../artifacts/management-status-android-build.log)通过。语言脚本原依赖映射已不覆盖新增原组件，复用正式构建映射修复测试入口；没有修改上游源码。
- [05:13 UTC电脑设置](../../artifacts/management-settings-android.json)：MuMu正式菜单进入，临时编辑超时和无价值地址草稿，仅核对后未提交；结束实际网关后操作禁用、无错误升级/授权提示，重连原数字及地址确认保留，取消确认仍保留地址文字。[05:14 UTC工作区](../../artifacts/management-workspaces-android.json)：DSH-TEST改名草稿跨断线保留，未点击保存。[05:18 UTC插件管理](../../artifacts/management-plugins-android.json)：实际管理列表离线显示连接中，网关恢复后重新出现添加插件按钮，未安装/配置插件。三项均errors为空且聊天草稿保持，关闭测试窗口。
- [实际脚本](../../scripts/verify-management-status-android.mjs)由操作方在ready/offline阶段结束并恢复已核对的网关进程；不是修改页面连接变量。[设置离线截图](../../artifacts/management-settings-offline-android.png)、[工作区恢复截图](../../artifacts/management-workspaces-recovered-android.png)、[插件离线截图](../../artifacts/management-plugins-offline-android.png)已查看。没有模型请求或Key、地址、工作区配置写入；临时管理授权在验收后收回，保留聊天授权。
- [插件首次失败](../../artifacts/management-plugins-first-attempt.json)期间新网关进程启动失败退出、8787无监听；重新启动后[一次重入等待超时](../../artifacts/management-plugins-reentry-failure.json)，随后未修改产品或重装App再次进入成功，再完整断线/重连通过。根因未确认，不把环境恢复或最终成功说成启动/加载故障已修复。当前DSH23668保持，网关38228监听；完整异常与第三方兼容仍继续。R12网页转发仍待用户确定，不因本批缩减完整Remote目标。

## 日志导出的连接状态（2026-09-26）

- 状态：导出窗口已按真实连接状态优先展示反馈，新版APK已安装。维护角色：项目协作Agent；核验日期2026-09-26。来源：[导出窗口](../../src/ui/RemoteSessionExport.jsx)、[连接代次与协商](../../src/remote-model.mjs)。此前保存取消截图中离线时误提示更新插件的问题由本节跟进。
- RemoteTransport在断线/重连时清空能力；RemoteModel在本代协商完成前维持connecting，因此未知能力不等于旧版本。窗口订阅同一模型，离线显示断开提示、connecting显示连接中；只有connected且已确认不支持时要求更新。按钮和点击处理同时检查连接/能力，断线不自动导出，重连保留包含子会话选项。未缓存旧授权或把旧能力视为仍可执行。
- [专项目标页面回放](../../artifacts/session-export-status-web.json)验证connected支持、离线能力清空、connecting、离线残留旧能力、connected明确不支持、恢复，以及选项保留；[完整原组件回放](../../artifacts/session-export-status-full-web.log)同时通过输入、插件、文件、历史及原有Remote页面检查，errors为空。[Web构建](../../artifacts/session-export-status-build.log)、[APK与lint](../../artifacts/session-export-status-android-build.log)通过。
- [04:58:32 UTC真实MuMu报告](../../artifacts/session-export-status-android.json)：正式菜单打开日志导出，勾选包含子会话后真实结束网关，显示连接中/断开提示、按钮禁用且没有更新插件文案；恢复网关后按钮可用、选项与聊天草稿保留。实际file.begin调用0次，没有自动导出或模型请求，未改Key/权限；退出窗口并恢复原勾选。[离线截图](../../artifacts/session-export-status-offline-android.png)与[恢复截图](../../artifacts/session-export-status-recovered-android.png)已查看。当前DSH23668、网关9776运行。旧版本明确不支持仅由组件回放覆盖，未降级电脑插件。
- [首次脚本失败](../../artifacts/session-export-status-first-attempt.json)在恢复等待时错误使用显式role属性选择器，而Surface实际是隐式dialog；修正为页面真实按钮的enabled定位后完整重跑。首次离线正确不代替完整成功证据。本次没有重跑日志ZIP字节保存，上一节三个真实保存入口的内容核验继续保留；新增脚本见[实际状态验证](../../scripts/verify-session-export-status-android.mjs)。
- 本次只修改日志导出窗口。其他管理/权限组件也存在先检查能力或授权的分支，需要结合实际断线逐项检查；没有据此宣称所有设置窗口离线提示已修复。既有完整Remote矩阵和R12待定范围保持。

## 系统保存窗口断线取消（2026-09-26）

- 状态：已修复取消下载后系统保存窗口遗留空文件的问题；新版APK已安装，完整Remote继续实施。维护角色：项目协作Agent，核验日期2026-09-26。来源：[原生保存控制器](../../android/app/src/main/java/dev/dshmobile/validation/RemoteDownloads.kt)、[实际入口脚本](../../scripts/verify-save-picker-disconnect-android.mjs)。
- [修复前MuMu报告](../../artifacts/save-picker-before-android.json)：历史附件完整暂存后打开系统保存窗口，结束真实网关；原生暂存已删除，但窗口仍可确认，生成0字节文件。原实现取消时清空Save，随后系统返回的新文档URI被丢弃。测试副本已清理，原附件和草稿保留。
- 取消时现在主动结束对应系统窗口，保留待办至系统回调，并只回复一次。回调前仍保留pickerOutstanding，防止旧结果误配新保存；迟到的成功结果只清理本次系统返回的文档。Activity已关闭时使用独立清理线程，避免向已停止worker提交任务。相比只隐藏窗口，保留待办也能处理系统已创建文档、回调尚未交付的竞态。删除沿用DocumentsContract且为尽力清理，不承诺所有云文档Provider均能成功删除；系统创建与返回URI契约见[Android文档](https://developer.android.com/training/data-storage/shared/documents-files)。
- [原生隔离测试](../../artifacts/save-picker-native.log)通过断线、file.abort、close三种取消，重复取消只回复一次、旧结果未返回时拒绝新保存，以及迟到URI交给实际ContentResolver清理。窗口调度和无文件DocumentsProvider为独立debug夹具；这项测试不冒充实际系统选择器。源码：[RemoteSaveChecks](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteSaveChecks.kt)、[debug夹具](../../android/app/src/debug/java/dev/dshmobile/validation/RemoteSaveProbe.kt)。
- [04:42:42 UTC真实附件验收](../../artifacts/save-picker-after-android.json)：真实网关中断后系统窗口自动关闭、无空文件且私有暂存清空；恢复后手动重新下载，实际保存副本SHA256与85字节原件一致。草稿保留、页面错误为空，副本已清理；[取消后截图](../../artifacts/save-picker-after-android.png)已查看。没有模型请求、Key/模型/权限变更。
- 共用入口矩阵：历史附件见上项；[04:46:07工作区交付文件](../../artifacts/save-picker-after-workspace-android.json)同样通过关闭系统窗口、无空文件、重连后19字节副本SHA256与原件一致；[04:48:15会话日志导出](../../artifacts/save-picker-after-export-android.json)通过相同中断/恢复流程，ZIP含1份可解析原日志、2份图片、32份文件，共7,233,300字节附件全部通过内容寻址SHA256核验。三条实际路径页面错误均为空，清理本次唯一命名下载副本、返回原联调聊天并保留草稿。工作区/日志[截图一](../../artifacts/save-picker-after-workspace-android.png)、[截图二](../../artifacts/save-picker-after-export-android.png)已查看；日志在离线时暂显“请更新电脑远程插件和网关”能力提示，重连恢复正常，该提示准确性仍需后续调整。
- 初期脚本遇到MuMu组合键清空名称不支持、系统窗口前台时网页事件延迟，以及错误地只等待“下载未完成”而实际为“已取消下载”；分别按原生字段和暂存状态核验后完整重跑。更早两次重连后首次下载泛化失败未取得错误码，最终三条入口均一次重试成功，不能把这项未定位现象宣称已修复。原生测试APK已卸载，生产APK保留。最终DSH23668、网关45644监听正常，没有改变电脑启动参数或现有授权。
- [APK及Android lint](../../artifacts/save-picker-android-build.log)、[15项文件/附件/日志传输回归](../../artifacts/save-picker-download-tests.log)通过。本批原生改动覆盖共享file.save，网页产物沿用前批，没有宣称重新构建Web。原生写入和分享快照复制期间中断、真实在途撤销、大文件/弱网及全部第三方仍待后续；R12网页转发保持待定，不缩减原范围。

## 会话标题插件（2026-09-26）

- 状态：原标题actions/utilities会话插槽已接入DSHM自有页面，新版APK已安装，独立电脑插件通过MuMu实际入口。维护角色：项目协作Agent；核验2026-09-26。来源：[插槽宿主](../../src/remote-plugin-slots.jsx)、[页面](../../src/ui/RemoteWorkspace.jsx)、[原契约](../../../deepseek-harness/packages/client/ui-conversation/src/client/contract/slots.ts)、[实际测试插件](../../tests/fixtures/live-header-plugin/client.js)。
- 采用标题下的独立局部区域，保留返回、更多与模式入口；每个原插件沿用同一SessionProvider和外层自适应，最高占25dvh，过高内容局部滚动。相比挤入固定手机顶栏，这种组合保留插件自然宽度及作者内部布局，代价是有扩展时增加标题区高度；无内容时不留空隙。
- 排除三个精确原注册项：模式选择`agent-preset`由手机标签承担；日志`session-log-download`直接下载电脑HTTP地址，保留已接通的手机原生保存入口；原终端恢复会打开交互终端，不随手机聊天挂载执行。其余同槽插件继续加载，缺服务的原插件仍按既有策略等待，不扩大网络或操作授权。leading/corner/lineage和其他完整第三方契约尚未完成。
- [完整浏览器回放](../../artifacts/header-slots-browser.log)覆盖延迟注册、两槽交互、真实Session状态通知、切会话、卸载、无内容零高度、720px→375px缩放与三个桌面条目不挂载；[315项手机测试](../../artifacts/header-slots-tests.log)、[Web构建](../../artifacts/header-slots-build.log)、[APK构建与lint](../../artifacts/header-slots-android-build.log)通过。
- 最终包[04:17:48 UTC MuMu验证](../../artifacts/header-slots-live-android.json)：桌面安装/启用独立header-ui-verification 0.0.1，两个按钮绑定相同专用聊天并可点击，720px自然宽度缩到420px视口（浮点误差0.000031px），页面无横向溢出；返回列表清除扩展，重入仍可交互，手机模式只显示一份，草稿保持。[截图](../../artifacts/header-slots-live-android.png)已查看。随后桌面卸载，[04:18:13清理复验](../../artifacts/header-slots-cleanup-android.json)确认无测试节点且区域高度为0，errors/resources为空。
- 初次回放错误地订阅不存在的SessionSnapshot.cursor并跳过事件，修正为原api-session/status通知，没有改生产协议；[失败记录](../../artifacts/header-slots-browser-first-failure.log)保留。实际入口发现原日志按钮重复且走桌面HTTP，已修复并在最终包重新安装/卸载验证。自动化的启动等待、隐藏页面选择及亚像素比较也已修正；不把脚本错误计为产品通过。没有新模型调用、Key/模型/设备权限变更，DSH与网关无需重启。

网页转发最新决定见下方R12章节：电脑明确开放指定地址/端口已确认；用户正在权衡带宽与必要性，延后首版只是建议，未据此缩减原验收范围。

## 页面批量刷新性能（2026-09-26）

- 状态：普通内容更新合并页面通知，新版APK已安装并通过真实MuMu分页；完整性能与Remote范围仍进行中。维护角色：项目协作Agent；核验日期2026-09-26。来源：[RemoteModel](../../src/remote-model.mjs)、[实际页面渲染计数](../../scripts/verify-remote-rendering.mjs)、[压力回放](../../scripts/check-remote-history-scale.mjs)。
- 原模型快照仍逐条同步更新，原`subscribe`与Session/插件独立订阅保持同步；所有直接读取RemoteModel的React视图改用`subscribeView`，普通通知合并到下一任务。切会话、会话就绪、连接状态和历史分页状态变化仍即时通知，避免已释放引用继续渲染及分页定位先于DOM更新。释放模型取消计时器和页面订阅；不使用后台可能暂停的动画帧来投递状态。
- 相比统一延迟模型通知，此方案保留断线处理、任务提醒和设置注册的及时性，代价是显式维护界面订阅与生命周期边界。最初微任务合并无法覆盖原异步流的逐条交付，压力回放仍为5000次；完整插件回归另外发现[旧会话引用错误](../../artifacts/view-batching-scope-regression.log)，真实MuMu发现[分页锚点跳动](../../artifacts/view-batching-pagination-regression.json)，均已修复并重跑，未降低验收阈值。
- 同一375×667桌面Headless Edge、1000轮5000事件：[本批基线](../../artifacts/view-batching-before.json)渲染5000次、加载28,167ms、最长任务1083ms；[最终结果](../../artifacts/view-batching-after.json)渲染50次、加载9960ms（单次对照减少64.6%）、最长任务280ms，52次长任务。输入到两帧p95为23.9ms，1000轮内容、旧消息渲染复用、阅读位置及50次尾部滚动保持。CPU采样见[之前](../../artifacts/view-batching-before.cpuprofile)和[之后](../../artifacts/view-batching-after.cpuprofile)。这不是模型吞吐、真机或统计稳定性结论，原投影和长任务仍需优化。
- [新版MuMu实际入口](../../artifacts/view-batching-after-android.json)在22:36:47 UTC重新打开专用聊天，连续3页加载至86条回复；打开656ms、分页426/545/600ms，锚点偏差0.067/0.133/0.400px，完整原窗口和草稿保留，errors为空。最长任务373ms，与前版371ms接近，不宣称真实手机长任务显著改善；已查看[实际截图](../../artifacts/view-batching-after-android.png)。没有模型请求、Key/权限/绑定变更，DSH820与网关28308保持运行。
- [315项手机测试](../../artifacts/view-batching-all-tests.log)、[完整插件页面回放](../../artifacts/view-batching-slots.log)、[千轮页面回放](../../artifacts/view-batching-rendering.log)、[Web构建](../../artifacts/view-batching-build.log)及[APK构建/lint](../../artifacts/view-batching-android-build.log)通过。测试覆盖同步操作订阅、最新快照、批量刷新、重入、取消订阅/释放、会话与断线边界、分页完成及时通知；插件页面覆盖真实原投影、切会话、草稿、输入服务、插件生命周期与文件入口。

## 历史导航摘要性能（2026-09-26）

- 状态：消除未变消息的重复导航摘要计算，新版APK已安装；千轮压力回放与真实MuMu分页通过，完整性能目标仍未达成。维护角色：项目协作Agent；核验日期2026-09-26。来源：[手机构建派生](../../scripts/remote-conversation-sources.mjs)、[统一构建别名](../../scripts/remote-source-aliases.mjs)、[正式模型入口](../../src/remote-model.mjs)。
- 同一375×667桌面Headless Edge/1000轮5000事件回放，[本批基线](../../artifacts/history-performance-baseline.json)加载44,763ms、最长任务1624ms；CPU采样约11.3秒集中于原turn-navigation的preview/responseText，布局约0.67秒。先前42,162ms记录见[此前结果](../../artifacts/history-performance-previous.json)，不是本批对照基线。
- 采用原函数计算短摘要、按原只读ChatNode对象身份WeakMap复用；同名节点替换会重新计算，节点释放后不保留历史。保留原空白折叠、长度、可见性、顺序、节点和插件注册语义。相比裁剪DOM或替换原会话投影，此改法不改变用户可读历史及插件生命周期；代价是构建维护三份原文件的窄范围派生，原函数锚点变化时构建失败。上游参考检出未修改。
- [修复前测试](../../artifacts/history-navigation-red.log)确认同一节点21次结构查询重复读取正文42次；修复后复用摘要。[针对性62项](../../artifacts/history-navigation-tests.log)包括原算法差分、可见性/移除/同名跨会话、真实RemoteModel流式增量→最终正文→新轮→切会话；不是仅检验缓存容器。
- [相同压力回放修复后](../../artifacts/history-performance-after.json)：加载27,962ms（本次对照减少37.5%）、最长任务1072ms、54次长任务，输入到两帧p95为20ms；1000轮内容、输入、新回复不重画旧节点、阅读位置和50次合并滚动全部保持。CPU文件分别为[基线](../../artifacts/history-performance-baseline.cpuprofile)与[修复后](../../artifacts/history-performance-after.cpuprofile)。剩余热点包括原投影rebuild、React协调及页面遍历，不能将本次提升描述为千轮性能已达标。
- 22:20:06 UTC的[旧APK真实分页](../../artifacts/history-navigation-before-android.json)与随后[新APK实际入口](../../artifacts/history-navigation-after-android.json)：同一专用聊天连续3页到86条回复；打开约812→668ms，分页567/765/937→458/538/661ms，最长任务397→371ms。均保持完整原窗口、草稿和小于0.4px锚点偏差，errors为空，已查看[新版截图](../../artifacts/history-navigation-after-android.png)。这是一次MuMu前后对照，包含自动操作开销，不作为真机、统计稳定提升或实际模型吞吐结论。未发送模型请求。
- [310项完整手机测试](../../artifacts/history-navigation-all-tests.log)、[完整插件页面回放](../../artifacts/history-navigation-slots.log)、[Web构建](../../artifacts/history-navigation-build.log)、[APK构建/lint](../../artifacts/history-navigation-android-build.log)通过；覆盖安装保留Key、绑定和数据，电脑DSH820/网关28308保持运行及权限不变。真实脚本新增独立输出前缀与长任务观测，见[分页脚本](../../scripts/verify-remote-pagination-android.mjs)。性能与完整R01–R16/A03–A06仍继续。

## 文件传输断线隔离（2026-09-26）

- 状态：整次文件读取及保存/分享准备已绑定发起时的连接；新版APK已安装，两类真实入口断线重试通过。维护角色：项目协作Agent；核验日期2026-09-26。此节补充此前“在途重连待验”的已测范围，完整Remote仍进行中。
- [工作区读取](../../src/remote-files.mjs)、[模型组合](../../src/remote-model.mjs)和[附件读取](../../src/remote-attachments.mjs)捕获调用方、模型及连接的取消信号。消费者等待原生写入时发生重连，旧读取不得继续下一块、最终stat或附件ACK；新操作重新捕获新连接。[共享传输](../../src/remote-download.mjs)将相同约束延伸到file.finish后的保存/分享入口，区分用户取消与连接失效，已确认的原生交付仍不被迟到取消覆盖。
- 选择在共享读取/传输层绑定整次生命周期，而非只依赖每次RPC的连接检查：后者无法覆盖两次请求之间等待磁盘写入的间隙。原生RemoteDownloads/RemoteDownloadStore已有代次核验与断线清理，本批未修改原生协议，也不将原有行为误述为此前会交付残缺文件。
- [修复前回归](../../artifacts/file-lifetime-red.log)复现跨重连读取及保存准备缺口；[307项手机测试](../../artifacts/file-lifetime-all-tests.log)全部通过，含真实RemoteModel组合、附件迟到ACK拒绝、下载/分享准备中断。实际共享页面[浏览器回放](../../artifacts/file-lifetime-transfers-web.log)、[Web构建](../../artifacts/file-lifetime-build.log)及[Android构建/lint](../../artifacts/file-lifetime-android-build.log)通过。
- 真实MuMu从原文档入口验证[85字节历史附件](../../artifacts/file-disconnect-attachment-android.json)与[19字节归档交付文件](../../artifacts/file-disconnect-workspace-android.json)：仅延迟原生已实际写入的第一条file.chunk成功回执，然后结束真实网关，收到closed后释放原回执。没有替换网络、文件内容或业务响应；不是随机弱网或大文件压力测试。两者均显示下载未完成、删除私有.part，旧操作没有调用finish/save/share。
- 恢复网关后，同一WebView重新点击下载，经Android系统保存窗口生成新副本，SHA256与原件一致；测试副本核对后删除，暂存目录为空，原聊天草稿、原文件和归档状态保留，页面错误为空。[复现脚本](../../scripts/verify-file-disconnect-android.mjs)默认附件，--workspace验证交付文件。已查看[附件失败提示](../../artifacts/file-disconnect-attachment-failed-android.png)及[工作区失败提示](../../artifacts/file-disconnect-workspace-failed-android.png)。
- 分享准备补验：同一脚本增加--share，改为延迟原生完成整份文件的file.finish成功回执，在其返回网页前实际结束网关。22:07:04 UTC的[附件报告](../../artifacts/share-disconnect-attachment-android.json)与22:08:02 UTC的[工作区报告](../../artifacts/share-disconnect-workspace-android.json)均确认旧操作没有调用file.save/file.share、暂存清空、没有新增分享快照；同一WebView重连后手动重试，实际系统分享面板打开，快照SHA256与原件一致。未选择接收方，核对后清理本次快照及空目录，草稿与原件保留，errors为空。已查看[附件分享截图](../../artifacts/share-disconnect-attachment-recovered-android.png)与[工作区分享截图](../../artifacts/share-disconnect-workspace-recovered-android.png)。
- 首次分享脚本误用只保留DocumentsUI节点的pickerNodes，导致已经出现的系统分享面板未被识别；[首次报告](../../artifacts/share-disconnect-attachment-first-attempt.json)保留为失败证据。随后改用原生UI层级中的chooser_header，核对首次快照的生成时间/名称/摘要后清理并完整重跑；未修改生产实现或用页面文字代替原生面板检查。本次仅测试脚本和文档变化，沿用上一批已安装APK与307项测试结果，不宣称重新构建。
- DSH进程820保持，本批结束后网关恢复为28308，3080/8787监听已核对；未改变Key、模型、绑定或设备权限，没有模型请求。仍待覆盖原生分享快照复制/系统保存写入期间的中断、在途设备撤销、大文件/弱网及全部第三方插件；已打开分享面板不等于接收App完成分享，不能据此宣布完整R01–R16/A03–A06完成。

## Office缓存与调度（2026-09-26）

- 状态：工作区文件的原客户端缓存已接入；工作区与历史附件转换支持原前台/后台优先级。维护角色：项目协作Agent，核验日期2026-09-26。此节更新下方历史“Office缓存与调度待接入”的工作区结论，不代表完整Remote交付。
- [读取组合](../../src/remote-office-cache.mjs)直接复用上游[OfficePreviewCache](../../../deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/office/cache.ts)。缓存最多8项、64MiB，两个在途转换、8个读者；每次lookup先查询转换器代次，再以原workspaceFiles/readBytes读取1字节核验权限，随后stat并比较版本/路径。不同会话、文件版本和转换器代次隔离。连接closed/ready、原connection/reset及释放均清理；传输使用模型与连接共同取消信号。
- [协议策略](../../../backend/packages/protocol/src/remote-policy.ts)仅新增无参数的officeToPdf/generation只读RPC；原服务仅返回生命周期ID，不开放render大JSON或文件写入。固定Office分片流可选foreground/background，省略保持foreground；协商officePriority后手机才发送新字段，旧Host继续逐次读取，旧Host不接受后台请求。Host两条Office传输容量共用，后台最多占用一条，原转换队列负责排序/合并与提升。本轮不新增自动预读。
- 历史附件仍逐次通过remote.attachmentOffice检查会话引用，使用电脑原转换队列的缓存；手机没有附件stat/内容摘要的缓存复验接口，不把显示名伪造为absolutePath。附件客户端PDF缓存尚未新增。
- [9项针对性测试](../../artifacts/office-cache-targeted.log)含复用仍授权、版本/会话/代次隔离、并发共享与取消、后台容量、旧版/附件回退和断线迟到拒绝；全套[303项手机测试](../../artifacts/office-cache-all-tests.log)通过。插件119项与类型检查通过，后端全套除旧策略断言外59项通过，更新该断言后10项策略回归通过（独立PostgreSQL默认跳过）；新增真实HTTP/WS网关路由核验包含代次读取和注入参数拒绝。浏览器原文档和附件页面回放通过，Web/APK构建与Android lint通过。
- 插件0.1.47已通过原CLI安装，核对身份后自行结束并按原参数恢复DSH与网关，现为DSH820/网关65244；没有等待用户恢复。APK覆盖安装，不清理App数据。没有模型请求、Key/模型设置或设备授权变更。
- 21:41:09 UTC（香港9月26日）[真实MuMu报告](../../artifacts/office-cache-android.json)：从正式“插件面板→工作区文件”打开独立测试docx。首次1条PDF流，重新读取仍为1条而代次/1字节授权各再次调用；替换为损坏内容后第二次转换报错并移除旧画布，恢复原件后第三次转换成功；删除后重新读取拒绝且没有第四条PDF流。只观察原生桥中所测只读操作的名称/优先级/范围，不记录凭据或替换响应。草稿保留、关闭标签后Worker为0，专用文件和目录已核对清理。
- 已查看[命中截图](../../artifacts/office-cache-hit-android.png)与[损坏截图](../../artifacts/office-cache-changed-android.png)。测试文档原本缺少指定字体，保留原字体提示，不把样例预览当作复杂Office排版保真验收。[实际脚本](../../scripts/verify-office-cache-android.mjs)保留完整复现与清理检查。
- 21:42:21 UTC[新版APK历史附件回归](../../artifacts/office-cache-attachment-formats-android.json)通过：原文本、1024×1024图片、隔离HTML及缺失依赖错误、docx/xlsx/pptx/doc/xls/ppt六种Office实际文字层/画布和损坏附件拒绝；关闭标签释放Worker，原草稿保留。完整插件页面回放另见[日志](../../artifacts/office-cache-slots.log)，errors为空。
- 完整在途撤销、真实后台并发/转换器替换、第三方全部来源与性能继续验收；模型余额、R12访问范围和可用整轮快照等既有边界保持。测试用协议回放不冒充这些真实场景。

## 历史附件原文档预览（2026-09-26）

- 状态：历史附件已通过独立资源契约进入原DocumentPreviewRegistry、TextPreview、标签和菜单；新版APK已安装，代表性独立插件和真实历史格式通过MuMu验证，完整Remote仍在实施。维护角色：项目协作Agent；最近核验2026-09-26。来源：[地址](../../src/remote-document-address.mjs)、[内容读取](../../src/remote-attachment-documents.mjs)、[原组件组合](../../src/remote-document-previews.jsx)、[构建派生](../../scripts/remote-document-sources.mjs)、[作者API](../plugin-validation/document-resources-api.md)。此前“附件沿旧预览/契约待接入”由本节更新。
- 比较了沿用第二套附件预览与扩展原文档来源两条路线：前者不能让同一文档插件处理附件且重复维护菜单/状态，因此选择后者。原组件在手机artifacts目录生成窄范围派生，准确锚点不匹配就拒绝构建；保持原布局、注册表、状态机、CSS及其余依赖，上游参考不修改。旧电脑没有workspaceFiles/read时仍保留旧预览回退。
- `dsh-resource://dshm-attachment/...`包含会话、类型、ID和显示名，原文件地址语义不变。同名附件不同标签，原useResource只发布引用描述，不伪造磁盘stat或权限成功。真实内容每次通过remote.attachment重新核验，不按显示名读取工作区，不缓存授权。单次32MiB、两个内容读取并发；文本每页最多5000行，目前每次分页先完整有界读取并验证原件，不宣称远端按行分页或大附件性能完成。
- `dshmDocuments`提供describe/readBytes/readPage，支持renderer自管读取；text-pages/bytes-complete沿原content契约。仅理解工作区路径、自行调用workspaceFiles的旧插件仍须适配附件来源，不能声称任意插件自动兼容。HTML继续独立沙箱并拒绝按附件名补读电脑依赖；Office沿原附件转换，下载分享保留原件。工具详情打开附件时收起原模态层，避免原文档portal被inert挡住。
- [4项新增来源测试](../../tests/remote-attachment-documents.test.mjs)覆盖规范地址、同名/跨会话、完整性迟到拒绝、容量、UTF8/二进制、并发、取消和模型释放；[全套297项Node](../../artifacts/attachment-document-all-tests.log)通过。[实际组件浏览器回放](../../scripts/check-attachment-documents.mjs)验证原文本、三种插件模式、资源hook、同名两标签、卸载回退及失败清除/重试，[报告](../../artifacts/attachment-document-web.json)errors为空；工作区原文档、完整插件回放和共享传输回归通过。此为隔离协议夹具，不能代替真实撤销。
- [Web构建](../../artifacts/attachment-document-build.log)、[APK构建/lint](../../artifacts/attachment-document-android-build.log)通过。21:15:33 UTC（香港9月26日）[MuMu默认文本报告](../../artifacts/attachment-document-plain-android.json)确认既有85字节历史附件进入原TextBody，内容与原件一致。
- 电脑通过官方plugin命令临时安装[独立验收包0.0.2](../../tests/fixtures/live-attachment-document-plugin/package.json)，经真实模块图进入MuMu；[插件报告](../../artifacts/attachment-document-plugin-android.json)确认分页文本、完整字节与renderer服务均读取同一历史原件，地址与tab一致、source=attachment。[截图](../../artifacts/attachment-document-plugin-android.png)已查看。0.0.1的验收输出为一条长JSON、被外层缩至很小，0.0.2只调整验收插件自身换行与宽度，再次实测；没有修改生产缩放逻辑。21:21:25 UTC[卸载回退报告](../../artifacts/attachment-document-cleanup-android.json)确认移除包后默认原文本恢复、草稿保留。
- [真实格式报告](../../artifacts/attachment-document-formats-android.json)：既有1024×1024 PNG、HTML脚本按钮与origin=null/无原生桥、缺失HTML依赖拒绝，以及docx/xlsx/pptx/doc/xls/ppt六格式真实中文/英文文字层及画布通过；损坏docx无旧PDF，关闭文档标签后工作线程为0。[图片](../../artifacts/attachment-document-image-android.png)、[HTML](../../artifacts/attachment-document-html-android.png)、[Office](../../artifacts/attachment-document-docx-android.png)截图保留。样例简单，不代表复杂排版或全部格式保真。关闭外层面板保留原标签，关闭标签才释放该预览。
- 21:19:47 UTC[新入口传输回归](../../artifacts/attachment-document-transfers-android.json)：历史附件与交付文件分别保存完整新副本，SHA256与原件一致，系统分享面板实际可见；未选择接收方，新副本核对后删除。所有实际验证只读取既有专用会话，原文件/归档/草稿保留；没有模型请求、Key/模型配置或权限修改，DSH42196/网关66496持续运行。[脚本](../../scripts/verify-attachment-documents-android.mjs)及[传输脚本](../../scripts/verify-file-transfers-android.mjs)可复验。
- 剩余：全部附件来源/第三方自管渲染与服务、真实在途撤销/重连、原Office缓存和调度、完整性能及R01–R16/A03–A06；整轮正向真实预览仍缺可用快照，R12范围/独立设备批准和模型余额边界保持。不缩减原目标，不将本批代表性插件通过当作完整兼容。

## 文件下载与分享统一（2026-09-26）

- 状态：原文档面板、旧预览与历史附件共用传输控件，新版APK已安装并完成两类真实入口验收，完整Remote仍在实施。维护角色：项目协作Agent；最近核验2026-09-26。来源：[共享操作](../../src/ui/RemoteDocumentActions.jsx)、[旧预览](../../src/ui/RemoteFilePreview.jsx)、[面板生命周期](../../src/remote-plugin-panels.jsx)、[传输引擎](../../src/remote-download.mjs)。
- 原预览只隐藏面板会保留React实例，因此关闭时单独卸载操作控件、取消传输，同时保留原文档状态。按会话/路径/附件ID隔离操作；取消后等旧操作清理完成再允许重试，离开文件后丢弃迟到结果，原生已确认完成的保存/分享不会被迟到取消覆盖。分享准备与取消文案区分下载。
- 工作区仍下载最新完整文件，历史附件使用原附件ID与独立provider，不能按文件显示名伪造路径。原TextPreview/hostFileOf与textFace/read需要真实文件地址，目前没有原附件资源契约；本批统一传输而非宣称历史附件已经兼容原文档插件。未改上游参考、网关、桌面插件或原生传输协议。
- [浏览器检查](../../scripts/check-file-transfers.mjs)经实际RemoteWorkspace/RemoteFilePreview验证关闭原面板取消、重新读取完整最新字节、取消清理前阻止重复操作、原生成功优先于迟到取消、同名不同ID附件隔离及禁止路径回退；[报告](../../artifacts/file-transfers-web.json)errors为空。此为隔离协议回放，不是设备撤销实测。
- [9项传输/附件测试](../../artifacts/file-transfers-tests.log)、[完整插件回放](../../artifacts/file-transfers-slots.log)、[Web构建](../../artifacts/file-transfers-build.log)、[APK构建/lint](../../artifacts/file-transfers-android-build.log)通过。
- 20:57:05 UTC（香港9月26日）[MuMu实际报告](../../artifacts/file-transfers-android.json)：从既有聊天打开85字节历史附件，从既有归档交付卡片打开19字节工作区文件；分别通过系统保存选择器写入新副本，SHA256与原件一致，系统分享面板可见。仅打开分享面板并返回，没有选择接收方；核对后仅删除本次新建副本。原聊天草稿保留，errors为空。见[脚本](../../scripts/verify-file-transfers-android.mjs)、[附件截图](../../artifacts/file-transfers-attachment-android.png)、[工作区截图](../../artifacts/file-transfers-workspace-android.png)。没有模型请求、Key/权限修改或电脑服务重启。
- 剩余：历史附件原插件预览契约、更多文件格式与在途撤销/重连、完整第三方兼容；整轮正常预览仍待可用真实快照。R12范围与独立设备授权等待原有确认，模型余额边界保留。完整R01–R16/A03–A06保持进行中。

## 原交付文件卡片（2026-09-26）

- 状态：原 DeliverablesTail、PresentedFileCard 与 PresentRow 已组合到DSHM聊天；新版APK已通过MuMu真实交付记录验收，完整Remote仍在实施。维护角色：项目协作Agent；最近核验2026-09-26。来源：[交付组合](../../src/remote-deliverables.jsx)、[原卡片](../../../deepseek-harness/packages/client/ui-deliverables/src/client/Deliverables.tsx)、[原工具行](../../../deepseek-harness/packages/client/ui-deliverables/src/client/PresentRow.tsx)、[能力策略](../../src/remote-plugin-policy.mjs)。
- 复用原局部组件而非继续维护简化文件按钮；既有原轮投影保持一份，订阅迟到交付/改动事件，重复路径沿原规则使用最新记录。新能力完整时隐藏旧按钮，旧电脑保留回退；不加载电脑顶层页面、不改上游参考。需要changes、workspaceFiles/read、desktopOpen与desktopReveal，能力不足不将原组件标为手机已提供。
- 卡片和ReviewTab共享摘要/电脑状态，摘要读取失败可重试；Host不再保留快照时沿原规则不显示已编辑文件卡片。交付预览携带原seq/index，菜单动作进入手机确认，不以显示路径作为授权。取消关闭本次确认，未知结果不重发。文件名引用继续用原交付/成功写入规则。历史原始附件不伪装成工作区文件。
- [浏览器回放](../../scripts/check-deliverables.mjs)通过实际RemoteWorkspace及原投影检查：最新声明去重、5文件展开、迟到改动、摘要错误重试、原文档预览、来源坐标保留、两种动作取消不写入、确认reveal使用最新seq/index、原Review入口。[报告](../../artifacts/deliverables-web.json)errors为空；此为显式隔离协议夹具，不是真实电脑动作证据。
- [19项针对性测试](../../artifacts/deliverables-tests.log)、[完整插件回放](../../artifacts/deliverables-slots.log)、[Review回归](../../artifacts/deliverables-review.log)、[Web构建](../../artifacts/deliverables-build.log)、[APK构建/lint](../../artifacts/deliverables-android-build.log)通过。未改协议、网关或插件生产代码，不重复后端测试。
- [实际MuMu脚本](../../scripts/verify-deliverables-android.mjs)读取既有已归档电脑打开联调聊天：原交付卡片、原文本预览与磁盘内容一致；默认应用打开/文件夹定位分别进入确认后取消；展开过程后原present工具行可见。返回原联调聊天，草稿与文件保持、errors为空，见[报告](../../artifacts/deliverables-android.json)、[卡片截图](../../artifacts/deliverables-android.png)、[工具行截图](../../artifacts/deliverables-tool-android.png)。未取消归档、请求模型、更改Key/权限或重启电脑服务；Windows实际定位证据仍见上一批，不把本批取消当作执行验收。
- 剩余：可用真实整轮快照的正向验收、原始附件插件契约、任意第三方兼容和在途异常，以及完整R01–R16/A03–A06。R12范围、独立设备批准和模型余额限制保持原边界；本批不缩减目标。此前章节的交付组合“待接入”以本节为准。

## 交付文件在电脑文件夹中显示（2026-09-26）

- 状态：原交付记录的文件夹定位通道已接通，插件0.1.46、新网关和APK已部署，本机真实链路通过；原DeliverablesTail/PresentRow完整组合仍待接入。维护角色：项目协作Agent；最近核验2026-09-26。来源：[原文件卡片](../../../deepseek-harness/packages/client/ui-deliverables/src/client/PresentedFileCard.tsx)、[原Host核验](../../../deepseek-harness/packages/client/ui-deliverables/src/present-open.ts)、[协议](../../../docs/protocol.md#在电脑打开文件插件-0134)、[手机确认组件](../../src/ui/RemoteDesktopOpen.jsx)。
- 原卡片同时有默认应用打开与文件夹定位，之前Remote仅实现前者。选择扩展既有受限记录通道，保留Host交付记录/路径/权限核验；不开放任意路径的通用桌面RPC。`desktopReveal:true`独立协商，`remote.openFile`可选action默认open，reveal仅允许presented来源，固定路由`/api/present.open?action=reveal`；changes、附件或任意动作拒绝。旧电脑不展示新入口，不将reveal悄悄降级成open。
- 手机「查看交付文件 → 在电脑文件夹中显示」先读取电脑名称并确认，取消不发送动作；确认才提交原会话/记录/文件索引，不传显示路径。中英文文案已加入，当前实际MuMu验证使用中文。保留既有打开流程及未知结果不重试语义，管理权限没有增加。
- 后端59项通过、独立PostgreSQL默认跳过1项；插件116项、两端类型检查与构建通过（各自artifacts/deliverables-*.log）。手机[7项桌面操作测试](../../artifacts/reveal-tests.log)、[完整插件回放](../../artifacts/reveal-slots.log)、[Web构建](../../artifacts/reveal-build.log)、[APK构建/lint](../../artifacts/reveal-android-build.log)通过。原回放增加文件夹确认取消、正确动作/坐标及其他文件来源不出现新入口；不是实际Windows动作证明。
- 浏览器控制服务不可用时，经DSH官方 `plugin --profile web add` 安装0.1.46包，再确认进程身份并重启本地网关和DSH。当前网关66496、DSH42196；没有手动编辑用户Key、模型或设备授权。已覆盖安装最终APK，Remote正常恢复。
- 20:27:58 UTC（香港9月26日）[MuMu报告](../../artifacts/reveal-android.json)：从已归档「DSHM 电脑打开联调 1790244874287」读取既有交付文件，原文档预览与磁盘匹配，确认页核对电脑与文件名，取消后再确认成功；返回原「DSHM Remote 联调提示」，草稿和文件内容不变、页面错误为空。[截图](../../artifacts/reveal-android.png)已查看。[脚本](../../scripts/verify-reveal-android.mjs)不创建会话、不请求模型、不取消归档。
- [Windows实际证据](../../artifacts/reveal-explorer.json)通过Shell API确认新开的资源管理器窗口选中准确目标文件；[清理记录](../../artifacts/reveal-explorer-cleanup.json)只关闭该新窗口，执行前再次核对句柄与选中文件，没有关闭原有窗口。没有将仅收到Host成功响应当作默认应用实际打开证据。
- 剩余：原交付轮尾与工具卡片组合、完整第三方兼容/在途异常、跨桌面平台及完整R01–R16/A03–A06。上一批整轮ReviewTab仍缺可用真实快照，R12访问范围、独立设备授权和模型余额限制保持原边界。此次正常交付文件链路不代替整轮快照验收。

## 原整轮改动预览（2026-09-26）

- 状态：原 ReviewTab 已接入 DSHM 自有面板，新版 APK 已安装；浏览器正常路径通过，MuMu 已验证真实快照缺失路径，正常整轮快照尚未实际验证。维护角色：项目协作Agent；最近核验2026-09-26。来源：[组件组合](../../src/remote-review-preview.jsx)、[读取状态](../../src/remote-review-store.mjs)、[整轮入口](../../src/ui/RemoteDiff.jsx)、[面板宿主](../../src/remote-plugin-panels.jsx)。
- 复用原 ReviewTab、标签定义和状态，保留多文件选择、并排对比、自动换行及打开当前文件；相较继续维护独立差异窗口，减少重复交互与布局，但须适配原 HTTP 读取和电脑打开行为。摘要/差异沿既有 remote.changes 分片通道，不开放新接口或路径权限，不嵌入电脑整页。旧电脑能力不足时仍走旧预览。
- 同一连接按会话/记录/文件去重，差异路径须与摘要相符。摘要失败可重试，缺失与读取错误分别显示；断线清除旧状态、取消读取，旧摘要等待者不能在新连接上继续请求差异。跨会话或轮次不匹配拒绝渲染。原电脑打开按钮进入手机确认流程，取消不写入，未知结果不重试。
- [原组件回放](../../scripts/check-review-tab.mjs)通过整轮入口、历史不读当前文件内容、并排/换行、第二文件读取失败后重试、电脑打开确认取消、原插件最新文档及标签偏好保留；[报告](../../artifacts/review-tab-web.json)无错误。命令 `node scripts/verify-remote-plugin-slots.mjs --reviews`。服务响应为显式隔离夹具，不等于真实电脑正向验证。测试须加载产品/原组件CSS，避免无样式布局影响点击定位。
- [15项针对性测试](../../artifacts/review-tab-tests.log)通过原差异流、电脑打开边界及4项新状态/连接隔离检查；[原插槽完整回放](../../artifacts/review-tab-slots.log)、工具文档回放、[Web构建](../../artifacts/review-tab-build.log)、[APK构建与lint](../../artifacts/review-tab-android-build.log)通过。本次没有重复全量Node及后端/插件测试。
- 20:15:08 UTC（香港9月26日）[MuMu报告](../../artifacts/review-tab-android.json)：专用会话6条既有整轮记录（75/74/73/40/36/3）均由电脑返回missing，原ReviewTab准确显示“这轮改动的内容已不可用”；页面错误为空，草稿保留，返回原聊天。[缺失截图](../../artifacts/review-tab-missing-android.png)已检查。[验收脚本](../../scripts/verify-review-tab-android.mjs)因无可用正向记录最终退出1，不能记成整轮正常预览验收通过。待存在真实可用快照时复验，未为此重发模型请求、伪造记录或修改电脑文件。
- 同一最终APK的[真实工具差异回归](../../scripts/verify-document-diff-android.mjs)20:14:45 UTC通过，见[报告](../../artifacts/document-diff-android.json)：本次修改/最新完整文件往返、原文件入口、磁盘内容、草稿与文件保持，errors为空。没有Key/权限/模型配置或DSH/网关重启。
- 剩余：真实可用整轮快照与电脑确认操作、原ui-deliverables的其他完整插槽组合、历史附件插件契约、完整第三方兼容和在途异常；原完整R01–R16/A03–A06仍进行中。R12访问范围、独立设备授权及模型余额限制保持原边界，不阻止其他独立工作。

## 工具差异与原文档标签（2026-09-26）

本节为前一批验收；整轮ReviewTab的后续状态以上节为准。

- 状态：工具的计划/历史差异和最新完整文件现已共用原文档标签；新版APK已通过MuMu真实工具入口验证。维护角色：项目协作Agent；最近核验2026-09-26。来源：[文件入口](../../src/ui/RemoteFilePreview.jsx)、[文档组合](../../src/remote-document-previews.jsx)、[聊天入口](../../src/ui/RemoteWorkspace.jsx)、[完整文件操作](../../src/ui/RemoteDocumentActions.jsx)。
- 选择在原标签中保留历史快照与当前文件两种视图，而非让旧差异窗口再打开另一套预览：复用原插件注册、读取和标签生命周期；代价是手机组合需维护本次导航的视图选择。历史差异继续使用原DiffBlock，只显示这条记录中的oldText/newText；打开历史视图不读取当前文件内容。“最新完整文件”进入原TextPreview及插件渲染器，下载/分享明确标为最新完整文件。多文件选择携带同一差异快照，普通文件导航默认当前文件，不因之前看过差异而进入旧快照。
- 从工具详情打开普通文件或差异时收起原生模态详情，避免其将新的插件portal窗口置于inert背景。旧电脑无文档能力时保留旧预览；原始附件仍走独立附件provider，不按显示名猜测电脑路径。
- [隔离回放](../../scripts/check-document-diff.mjs)使用原工具详情组件、实际标签与插件组件、[原生成文件接口](../../tests/fixtures/generated/README.md)，覆盖历史不读当前内容、扩展预览器、往返保持快照、多文件选择、普通导航及卸载回退；[报告](../../artifacts/document-diff-web.json)无错误。命令为 `node scripts/verify-remote-plugin-slots.mjs --documents`。此为显式协议夹具，不算真实第三方插件验证。完整旧能力插槽回放也通过，见[日志](../../artifacts/document-diff-slots.log)。测试构建改用与产品一致的automatic JSX，避免无React默认导入的原组件在测试中崩溃。
- 19:55:24 UTC（香港9月26日）[MuMu报告](../../artifacts/document-diff-android.json)：从专用聊天的真实write记录，经原“查看”按钮、DSHM工具详情进入差异，详情模态层关闭；最新文件与磁盘相符，再切回历史记录不变；随后原文件按钮进入当前预览，草稿与文件原文保持，errors为空。[截图](../../artifacts/document-diff-android.png)已检查。首次脚本在历史加载完成前结束分页，未找到目标记录；修正为等待真实记录增长后复验通过，未修改产品历史或制造新消息。[实际脚本](../../scripts/verify-document-diff-android.mjs)只读取既有联调会话和文件。
- [Web构建](../../artifacts/document-diff-build.log)、[Android构建与lint](../../artifacts/document-diff-android-build.log)通过，最新APK已覆盖安装。没有模型调用、插件安装、权限/Key变化或电脑服务重启。此批为UI接入，以新分支回放、完整现有页面回归和真实MuMu验证为证据，没有重复执行此前287项Node或后端/插件测试。
- 剩余：聊天原始附件的插件预览契约、整轮改动ReviewTab完整扩展、读取/下载在途撤销、其他格式/插件及完整Remote矩阵。原文档组件的hostFileOf只接受session文件地址；附件只持有不可透明解释的ID和显示名，不能伪装成工作区文件。需继续基于原附件/provider和渲染契约接入，不放宽电脑路径权限。

## 原文档预览器（2026-09-26）

本节是上一批文档组件验收；工具差异和内部最新文件切换的后续接入以上节为准，其余边界保留。

- 状态：原文档预览注册、文件标签和三种内容模式已接入 DSHM 自有窗口，新版 APK 已安装并在 MuMu 验证；完整 R10–13 仍未完成。维护角色：项目协作Agent，最近核验2026-09-26。来源：[组件组合](../../src/remote-document-previews.jsx)、[标签宿主](../../src/remote-plugin-panels.jsx)、[文件入口](../../src/ui/RemoteFilePreview.jsx)、[完整字节读取](../../src/remote-document-read.mjs)。
- 复用原 DocumentPreviewRegistry、TextPreview、文件标签与作用域状态，而非另建插件预览协议；保持原注册优先级和菜单切换，代价是需适配手机文件读取、HTML隔离和Office转换边界。普通会话文件及插件 openResource 共用实际标签地址，旧电脑缺少 workspaceFiles/read 时保留原手机回退。历史原始附件、差异窗口及差异内部的最新文件切换仍沿旧路径，不声称所有入口已统一。
- text-pages 调用既有原按行RPC；bytes-complete 经 RemoteFiles 的64KiB字节窗、读取前后版本核对及32MiB上限，返回原数据结构，不开放 readAll。renderer 保留插件自管内容语义。新增[3项读取测试](../../tests/remote-document-read.test.mjs)覆盖真实 RemoteFiles、大小拒绝、版本变化、原错误和取消。没有修改上游参考、网关或桌面插件生产代码，也未放宽权限。
- Markdown、图片与PDF使用原预览组件；HTML保留手机原生暂存与隔离沙箱，不接入桌面整页或凭据桥。Office复用原OfficeBody和PDF子预览，转换沿现有授权通道；原Office缓存与调度未完整移植。文件窗口保留[完整下载/分享操作](../../src/ui/RemoteDocumentActions.jsx)，本轮仅检查其显示，未再次执行实际下载/系统分享。
- 指定行号时先提交原文本预览选择，再挂载 TextPreview，避免旧渲染器提前消费导航版本；分页后按原组件定位。标签地址取真实 contentId，不使用不存在的 navigation.address。HTML注册顺序置于代码预览前，保持原默认匹配。
- 19:34:16 UTC（香港9月26日）[MuMu报告](../../artifacts/document-ui-live-android.json)：实际安装的[独立插件](../../tests/fixtures/live-document-ui-plugin/client.js)验证文本5000→5002行及EOF、完整98933字节、自管渲染真实RPC读取；720px外层等比缩至约420px，点击与原菜单切换通过。Markdown标题、SVG、缺失文件错误、隔离HTML内容以及PDF/docx可见画布通过。PDF/Office仅确认画布显示，不等于全部页面像素、文字或六格式完整验收。通过聊天实际 openFile 回调定位第5001行，页面/资源错误为空，草稿保持。
- [真实验证脚本](../../scripts/verify-document-ui-android.mjs)与[截图](../../artifacts/document-ui-android.png)保留。19:35:46 UTC [清理报告](../../artifacts/document-ui-cleanup-android.json)确认卸载插件后回退原文本预览、插件组件移除、核对内容后删除专用文件、返回原聊天且草稿保持；临时插件不再安装。没有模型请求、Key/模型配置或管理权限变化，DSH与网关未重启。
- 287项Node通过（[日志](../../artifacts/document-ui-tests.log)）、[原插槽回放](../../artifacts/document-ui-slots.log)、[Web构建](../../artifacts/document-ui-build.log)、[APK构建和lint](../../artifacts/document-ui-android-build.log)通过。隔离插槽夹具仍覆盖旧电脑回退模式，新文档模式由上述真实MuMu验证；最后指定行导航修复经最终APK和MuMu复验，不把旧回放当成该分支证据。
- 剩余：历史附件/差异预览插件兼容、其他第三方与格式、读取中撤销/重连、完整生命周期与长文档性能，以及原完整矩阵。R12网页访问范围和独立设备授权仍待确认；模型引用实测仍受此前余额不足影响。当前能力可继续独立推进，不缩减完整Remote目标。

## 原文件预览分页通道（2026-09-26）

本节保留前一批接口验收；其中组件“待接入”与“APK未变”描述仅指该批，当前组件状态以上节为准。

- 状态：原 `workspaceFiles/read` 已通过网关、真实Host及MuMu插件接口，桌面插件0.1.45和新版网关已安装并恢复运行。此批仅完成文档预览的读取前提，`documentPreviews` 注册、原TextPreview、renderer/bytes-complete及文件标签状态仍待接入；不能标记完整R10–13完成。维护角色：项目协作Agent，最近核验2026-09-26。来源：[原RPC](../../../deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/rpc.ts)、[协议](../../../docs/protocol.md#原文件预览按行分页)、[Host适配](../../../plugin/src/remote-adapter.ts)。
- 选择直接开放有界的原分页RPC，而非在手机按字节重新发明分行：前者保持Host的UTF-8/空行/EOF/版本、可取消调用及文件系统权限，兼容原createReadPage且无新依赖；代价是仍需后续接入原标签/预览组件。字节通道继续用于完整下载及已有预览，不用它伪造原分页接口。省略limit时沿用电脑配置，显式limit不超过5000；readAll/readRelated/写入仍关闭。文件读取权限与目录list包含边界不同，详见协议。
- 实测发现合法UTF-8页面经JSON转义后可能超过中继2MiB帧限制。原通用Relay会拒绝但原客户端归类成gateway/internal；现在Host适配器先检查实际帧大小，按原文件契约返回workspace-file/too-large，不截断页或关闭连接。新增[原Host回归](../../../plugin/tests/workspace-file-pages.test.ts)先失败后通过，覆盖中文/空行/空文件/末页、Host行/字节上限、错误会话、目录/二进制拒绝、注入参数及JSON膨胀；[网关真实HTTP/WS/SQL回归](../../../backend/tests/remote-permissions.test.ts)验证批准聊天设备可读、非法参数被拒。
- 19:03:22 UTC（香港9月26日）[MuMu报告](../../artifacts/document-pages-live-android.json)：电脑真实安装的[独立验证插件](../../tests/fixtures/live-document-pages-plugin/client.js)在DSHM专用聊天内调用原ctx.remote.workspaceFiles.read，四行38B中文/emoji文件的两页、默认页、同版本/大小通过；110万双引号文件返回workspace-file/too-large，后续正常页仍可读。最初验证代码误将RemoteResult当作裸结果、将ok:false误作Promise异常，已按原契约修正，未为通过测试改变成功标准。[验证脚本](../../scripts/verify-document-pages-android.mjs)没有发送消息或更改草稿。
- [读取截图](../../artifacts/document-pages-android.png)已检查，截图时Host重启的聊天恢复仍在进行；不能据接口成功声称当时聊天状态已同步完成。19:04:06的[清理报告](../../artifacts/document-pages-cleanup-android.json)确认插件卸载、原测试文件内容核对后移除、草稿保留；19:05:54的[恢复检查](../../artifacts/document-pages-recovered-android.json)确认断线提示消失、发送按钮恢复可用、临时组件不存在且原草稿完整。未实际发送模型消息。
- 后端59项通过（独立PostgreSQL1项默认跳过）、插件115项通过，两侧类型检查、构建、插件打包通过。手机生产代码/APK未变，仅新增验证插件和脚本。当前DSH73524/网关72560；Key、模型设置、绑定和管理权限没有变更。完整文档插件、其他来源/格式、在途撤销、R12访问范围等继续按原矩阵实施，不缩减范围。

## 长会话滚动与插件历史定位（2026-09-26）

- 状态：批量事件重复滚动和真实插件历史分页跳动已修复，新版 APK 已在 MuMu 验证；完整 R05/A06 性能与异常矩阵仍未完成。维护角色：项目协作 Agent。最近核验2026-09-26。来源：[聊天页](../../src/ui/RemoteWorkspace.jsx)、[历史定位](../../src/remote-history-position.mjs)、[压力检查](../../scripts/check-remote-history-scale.mjs)、[真实分页检查](../../scripts/verify-remote-pagination-android.mjs)。
- 原聊天页在每次会话投影发布后同步读取 scrollHeight 并写 scrollTop，密集事件重复强制布局。现在合并到下一动画帧，后续更新、卸载会取消旧任务，回调再次核对滚动容器和尾部跟随状态；用户向上阅读时不强制返回底部。记录实际滚动位置，避免自己的迟到滚动事件在新审批卡片出现后错误关闭尾部跟随；实际页面回放覆盖卡片独立出现后的定位，DOM出现后等待滚动帧。未移除历史 DOM、修改插件内部布局或改变原会话投影。
- 桌面 Headless Edge、375×667 的合成 1000 轮/5000 事件、每批20轮检查：修复前自动滚动5000次，加载47,149ms；最终复验50次、42,162ms，输入到两帧p95约19.3ms，输入和新增回复不重画已完成节点，向上阅读位置保留。见[修复前数据](../../artifacts/remote-history-scale-before.json)、[本批滚动修复后报告](../../artifacts/history-performance-previous.json)。这是原投影与真实 RemoteWorkspace 的事件压力回放，不是 MuMu、真实历史分页或模型吞吐测量。仍有55次长任务、最大1597ms，不宣称千轮加载性能已达标；后续摘要优化以[最新结果](#历史导航摘要性能2026-09-26)为准。
- 首次 MuMu 复验揭示旧定位函数只取 messages 的直接子元素；当前原插件的 display:contents 外壳没有坐标，导致已有回复下跳约7872px。现在选取原 ChatNodeSeat 实体行与直接消息，排除折叠/无高度节点；前插完成后使用仍存在且可见的原锚点。保留用户主动滚动、尾部增长、切换会话、锚点移除及失败后的恢复行为。[最小浏览器复现](../../scripts/verify-remote-history-position.mjs)先失败后通过，含插件外壳的7种情况；[真实失败记录](../../artifacts/history-pagination-before-android.json)保留。
- 18:40:31 UTC（香港9月26日）[MuMu正式入口报告](../../artifacts/remote-pagination-android.json)：最终APK覆盖安装后，从「DSHM Remote 联调提示」退出并重新进入，初始距底部0.67px；连续3次真实分页直到起点，共86条模型回复，锚点偏差0.067/0.133/0.400px，原窗口和草稿保持，页面错误为空。[截图](../../artifacts/remote-pagination-android.png)已查看。检查脚本同步支持 contenteditable；比较历史时包含原插件自动折叠的过程，避免把隐藏误报为内容丢失。
- 284项Node、完整插件页面回放、7种定位检查、Web/APK构建与Android lint通过。新版APK已覆盖安装；DSH68428/网关23120保持运行，没有模型请求、Key、模型配置或设备权限变化。公开会话服务、标准输入及此前兼容能力保持；其他完整插件、在途撤销、中文输入法与R12网页访问范围仍待完成或确认。

## 插件会话服务（2026-09-26）

- 状态：公开 Conversation 服务、同源 `useConversation`、会话输入 facade 和输入阻止提示已接入；不代表所有插件服务与内部附件接口兼容。维护角色：项目协作 Agent。最近核验2026-09-26。来源：[局部插件组合](../../src/remote-plugin-slots.jsx)、[输入绑定](../../src/remote-input-bindings.mjs)、[手机输入框](../../src/ui/RemoteComposer.jsx)、[原会话服务](../../../deepseek-harness/packages/client/ui-conversation/src/client/service.ts)。
- 直接复用原 ConversationController 与 ComposerBlockRegistry，没有另写一套会话发送/停止/队列语义，也不加载桌面页面。`useConversation` 使用已有 UiConversation 的同一 snapshot；公开 `send(text)` 按调用方会话发送原文，不消费输入框草稿。手机编辑器提交仍走 RemoteInputSession/RemoteModel 的附件、持久化和未知结果处理，不改成原包内部的浏览器附件发送路径。
- `conversation.input.for(actx)` 核对真实保留的 SessionBinding，返回稳定 facade 与同一 input 状态。编辑和提交只作用于当前有效手机输入；已释放作用域的回调无效。提示属于原会话，在仍被保留的会话内可晚到，换页重建 shell 时保留，不显示到新会话。没有长期保留会话的插件不能在会话释放后继续操作。
- 插件通过原 blocks API 设置原因时，手机显示原因，锁定编辑和提交、文件选择，保留草稿；解除后恢复。输入阻止是界面状态，不代替 Host 权限检查，也不阻止原公开 send API。停止生成按钮在其原本可用的空草稿状态仍可操作。插件负责卸载时清理自己的 block，宿主在输入 binding 释放时清理对应 registry。
- [真实页面回放](../../scripts/check-remote-conversation-api.mjs)覆盖同源 hook、聚焦、提示隔离/重建、阻止/恢复、过期 facade、卸载清理、公开 send/cancel/updateQueue 的正确会话、root 拒绝、业务错误与 steer 竞争收敛；[完整回放](../../scripts/verify-remote-plugin-slots.mjs)另通过公开 loadOlder 重试进入同一历史检查。电脑协议响应仅为隔离夹具，不宣称本轮真实模型发送或停止验收。
- [独立本地插件0.0.2](../../tests/fixtures/live-input-plugin/client.js)经电脑正式插件页安装和启用，18:10:52 UTC（香港9月26日）[MuMu报告](../../artifacts/conversation-api-live-android.json)通过会话状态、聚焦、提示、输入暂停/恢复、草稿写入、页面重入；页面/资源错误为空。临时卡片用于操作接口，不是产品布局或任意插件自适应的验收。[暂停截图](../../artifacts/conversation-api-block-android.png)、[输入截图](../../artifacts/conversation-api-live-android.png)已检查。
- 18:11:35 UTC 已卸载临时插件，[清理报告](../../artifacts/conversation-api-cleanup-android.json)确认手机界面移除、原草稿恢复。18:11:36 UTC [系统文件选择回归](../../artifacts/conversation-api-picker-android.json)通过打开、取消、无附件残留与草稿恢复。新版 APK 已覆盖安装，DSH68428/网关23120持续运行，没有模型请求或 Key、模型、设备授权更改。
- 284项 Node、完整页面回放与历史渲染、Web/APK构建、Android lint 通过，日志为 artifacts/conversation-api-{tests,slots-test,rendering-test,build,android-build}.log。以下批次中“完整 Conversation 服务未完成”已有本节公开服务补充，但包内附件 API、其他第三方扩展、后台会话编辑及其完整异常并未因此全部支持。真实中文输入法、命令附件未知结果/撤销、真实模型读取引用（此前余额不足）仍待验收，R01–R16/A03–A06继续实施；R12网页范围仍待确认。

## 标准输入插件接口（2026-09-26）

- 状态：标准 `useInput(selector)` / `inputActions` 与原文件选择动作已接入，新版 APK 已在 MuMu 验证；不代表完整第三方插件兼容。维护角色：项目协作 Agent。最近核验2026-09-26。来源：[绑定注册表](../../src/remote-input-bindings.mjs)、[会话输入](../../src/remote-input-session.mjs)、[手机编辑器](../../src/ui/RemoteComposer.jsx)、[文件动作](../../src/remote-command-actions.jsx)。
- 插槽沿真实 SessionBinding 订阅原 shell 状态，编辑器随页面与连接重建；不制造另一份会话数据。草稿修改、附件增删/清理和提交都进入同一输入实例；非本会话附件 ID、已释放作用域、非当前会话和提交中的普通编辑不被接纳。手机附件登记仍由 RemoteModel 持有。另一种让插件各自维护草稿的方案会产生两个权威状态，未采用。
- 修复再次选择同一聊天时原输入实例仍持有旧 reference 的问题：编辑器 key 纳入本次 selection。旧 React cleanup 不得释放新输入实例，已释放 Cordis fiber 也不再创建 shell。原 action 在提交仲裁期间可消费自己的 token，仍核对原 span/完整 token；文件选择沿手机既有选择器和上传路径，子会话限制保持，不把 `/file` 当消息发送。
- [标准接口组件回归](../../scripts/check-remote-input-api.mjs)通过状态订阅、插件写草稿、同一附件登记、外来 ID 拒绝、旧会话回调失效、卸载保留、候选文件动作及标准 submit 文件动作；[完整页面回放](../../artifacts/input-api-slots-test.log) errors 为空。284项 Node 测试、历史渲染、Web 构建、APK 构建与 lint 均通过，见 artifacts/input-api-{tests,rendering-test,build,android-build}.log。
- [独立插件](../../tests/fixtures/live-input-plugin/client.js)从电脑插件页真实安装并启用，经真实模块通道进入 MuMu 的 DSHM 自有输入框。17:49:22 UTC 的[报告](../../artifacts/input-api-live-android.json)验证实时读草稿、按钮追加文字、返回列表再打开后继续操作，原草稿恢复，页面/资源错误为空；[截图](../../artifacts/input-api-live-android.png)。插件没有自动写入或发送，只在专用联调会话提供可见按钮。
- 17:50:21 UTC 已从电脑卸载该测试包，手机[卸载回归](../../artifacts/input-api-cleanup-android.json)确认界面移除、草稿保持。17:50:32 UTC [引用回归](../../artifacts/references-android.json)通过原「＋」选择、自动文件/聊天引用、目录继续展开、页面返回和草稿恢复，临时文件已清理。首次回归曾被测试插件自己的固定浮层遮挡，未强行点击；卸载后正常路径通过，不能据此宣称任意插件浮层互不冲突。
- 17:52:35 UTC [Android 文件选择](../../artifacts/input-api-picker-android.json)实际打开系统 PickActivity，取消返回 Remote，无附件残留，原草稿 `DSHM_LANGUAGE_DRAFT_20260925` 恢复。验收脚本首次把系统窗口误识别为 DocumentsActivity，修正后复验通过。入口与清理见[验收脚本](../../scripts/verify-input-api-android.mjs)。本轮不发模型请求，不改 Key、模型或设备授权；DSH 68428 / 网关 23120 保持运行。
- 剩余范围：完整 Conversation 服务及第三方输入扩展、真实中文输入法、命令附件未知结果与在途撤销、真实模型读取引用（此前余额不足）。下节原编辑器批次中的“所有输入插件标准接口未完成”已由本节补上基础接口，但不等于这些剩余兼容与异常完成。R01–R16/A03–A06继续实施，R12网页访问范围仍待用户确认。

## Remote 原输入编辑器（2026-09-26）

- 状态：原编辑器、输入候选和提交状态机已接入，MuMu真实草稿交互通过；完整 Remote 与任意第三方输入插件兼容仍未完成。维护角色：项目协作 Agent。最近核验2026-09-26。来源：[RemoteComposer](../../src/ui/RemoteComposer.jsx)、[会话适配](../../src/remote-input-session.mjs)、[提交入口](../../src/remote-model.mjs)、[共享布局](../../src/ui/MobileComposer.jsx)。
- 沿用原 SessionInputShell、ComposerContentEditable、DecoratorPortals、keymap 与引用 codec，Lexical 及其四个子包固定0.49.0，与上游基线一致。普通聊天保留原 textarea；Remote 使用同一 MobileComposer 的可替换编辑区域，布局/附件入口/模型按钮/两态动画共用。仅输入 overlay 采用浮动外层，避免原候选菜单被通用缩放盒裁剪，不修改插件内部CSS或载入电脑整页。
- 手机普通 Enter 换行，有高亮候选时由原仲裁选择；Ctrl/⌘+Enter沿原提交入口。原组合输入检测保留，并避免compositionend当刻的Enter多换行。提交冻结会话引用、连接代次、正文及附件ID，异步序列化后重新核验当前身份和附件对象；沿用手机附件持久化、未知结果不重发、子会话requestId与现有队列路径，不绕过 RemoteModel。
- 原shell默认在发送确认前清空编辑器。手机在本次接纳期间锁定输入/附件操作并保留持久化草稿，确认成功才清理，失败沿原shell恢复；换页、断线或退出不会仅因编辑区清空而丢失未确认草稿。离线仍可编辑；重新连接或更换会话会重建编辑器，旧事件与迟到提交失效。卸载只释放编辑器，不删除手机附件原件；缓存原controller避免React清理时再次访问已释放的会话引用。
- [284项Node](../../artifacts/editor-all-tests.log)、[原组件完整回放](../../artifacts/editor-slots-test.log)、[历史渲染回归](../../artifacts/editor-rendering-test.log)通过。新增[8项原shell契约](../../tests/fixtures/remote-input-checks.mjs)覆盖owner模型表示、失败/owner卸载保留引用、序列化中离开取消、旧选择/代次拒绝、纯附件成功、命令回落与认领成功/失败；[实际页面回放](../../scripts/check-remote-composer.mjs)覆盖Enter、组合输入事件、双会话草稿与动画横向溢出0。组合事件回放不等于真实中文输入法验收。普通聊天共享输入框另见[触摸/鼠标聚焦回归](../../artifacts/editor-ordinary-composer.log)。
- [MuMu报告](../../artifacts/references-android.json) 2026-09-25 17:29:15 UTC（香港9月26日）通过「＋」选择、原候选菜单目录进入、中文/空格文件、聊天引用块、返回列表再打开原会话及草稿恢复；页面/资源错误为空。[菜单截图](../../artifacts/editor-candidates-android.png)、[文件引用](../../artifacts/editor-chip-android.png)、[聊天引用](../../artifacts/editor-chat-chip-android.png)已检查。[脚本](../../scripts/verify-references-android.mjs)仅操作专用联调草稿，恢复原DSHM_LANGUAGE_DRAFT_20260925，并核对后清理自建目录/文件。本轮没有模型请求或Key/授权更改，DSH及网关未重启；新版Web/APK/lint通过且覆盖安装。
- 验证中发现并修复菜单裁剪与已释放binding访问两项生产问题。测试工具先后修正目录普通点击（原语义是引用目录，进入需点箭头）、包含空格的完整标题查询（原token按词识别，改用标题关键词）、contenteditable读取和夹具Context释放；这些失败不计成功验收。外部进程创建的目录用显式`./`查询，因为原模糊文件索引可能尚未失效。
- 尚未验证真实模型读取引用（此前余额不足，下面保留证据）、真实中文软键盘、引用块跨重启的第三方自定义codec语义、所有输入插件的标准useInput/inputActions和文件选择扩展、命令附件完整未知结果及真实在途撤销。已有正文/附件发送测试不等于这些新边界全部完成；R01–R16/A03–A06继续推进，R12网页范围仍待用户确认。

## 引用发送验收与输入编辑器接入点（2026-09-26）

- 状态：真实引用读取尚未通过，电脑模型返回余额不足；其他 Remote 工作不因此阻塞。维护角色：项目协作 Agent。最近核验2026-09-26。来源：[分阶段手机验收脚本](../../scripts/verify-reference-send-android.mjs)、[来源消息发送报告](../../artifacts/reference-send-source-android.json)、[真实模型错误](../../artifacts/reference-send-source-observe-failure-dom.txt)、[清理报告](../../artifacts/reference-send-cleanup-android.json)。
- 16:51:08 UTC 在已有 DSH-TEST 工作区新建专用来源聊天，通过手机正式入口发送一次随机标记请求。电脑模型 DeepSeek-V4-Pro 返回 `Insufficient Balance`，没有成功模型回复。没有重发、切换模型、更换 Key 或修改权限。尚未发送包含文件与聊天引用的目标消息，不能把请求进入聊天等同于模型读取引用成功。
- 16:52:30 UTC 已归档仅用于本次验收的来源聊天，核对内容后删除独占创建的中文/空格文件与空目录，回到「DSHM Remote 联调提示」并确认原草稿 `DSHM_LANGUAGE_DRAFT_20260925` 保留。页面与资源错误为空。脚本按 source / source-observe / send / observe / cleanup 分阶段，发送前持久化意图，观察失败不重新发送；本次种子已清理，不能拿旧种子重新启动。模型服务恢复后需新建一轮种子，不覆盖既有证据。
- 接入前代码核验（已由上节实现取代）：此前 [MobileComposer](../../src/ui/MobileComposer.jsx) 是受控 textarea，[RemoteInputExtensions](../../src/remote-plugin-slots.jsx) 只挂载原 overlay。[原 InputHub](../../../deepseek-harness/packages/client/ui-conversation/src/client/input/hub.ts) 把四类 scoped mutation 与 shell、会话作用域生命周期绑定；[SessionInputShell](../../../deepseek-harness/packages/client/ui-conversation/src/client/input/facade.ts) 负责引用序列化、异步提交失败恢复与草稿镜像；[原编辑器](../../../deepseek-harness/packages/client/ui-conversation/src/client/input/editor/ComposerContentEditable.tsx) 和 [keymap](../../../deepseek-harness/packages/client/ui-conversation/src/client/input/editor/keymap.ts) 负责中文组合输入与键盘仲裁。插件状态 active 仅表示入口已加载，不能推断全部输入扩展已接通。
- 下一步实现取舍：沿用原 shell / Lexical 编辑器 / 引用 codec，放入 DSHM 共享输入框的可替换编辑区域；保留手机布局与聚焦动画。另一方案在 textarea 上补四类事件虽然初期改动少，但会重复实现引用块、claim 和失败恢复，持续兼容成本更高，不采用。需先让现有 [RemoteModel.send](../../src/remote-model.mjs) 接受原提交快照，保留手机附件持久化、未知结果不重发和子会话 requestId 语义；不能直接套用原 InputHub 的默认 sink 而绕过这些已验收行为。
- 必须覆盖的接入验收：原 @ 文件/聊天候选及目录继续补全；技能纯文本插入与第三方引用 codec；中文组合输入；引用序列化失败/插件卸载保留草稿；切换会话/断线后旧选择失效；附件与排队/停止路径；自有输入框两态动画与底部布局；手机重新打开后的草稿恢复。先进行不依赖额度的原组件回放和 MuMu 草稿交互；真实引用内容读取仍单独等待模型可用。该段是已核验接入依据与后续范围，不表示编辑器已替换。

## 文件与聊天引用选择（2026-09-26）

- 状态：插件0.1.43、新网关和新版APK已安装，MuMu真实选择入口通过；完整Remote仍在实施。维护角色：项目协作Agent。最近核验2026-09-26。来源：[引用候选](../../src/remote-references.mjs)、[手机选择页](../../src/ui/RemoteReferences.jsx)、[原文件语法](../../../deepseek-harness/packages/context/file-reference/src/grammar.ts)、[原聊天候选](../../../deepseek-harness/packages/context/session-reference/src/index.ts)。
- 「输入框＋ → 引用文件或聊天」调用原电脑候选服务，分别展示文件和聊天，输入变化后180ms查询；目录进入下一层，文件及聊天追加到现有草稿。选择不上传正文或发送模型消息，实际发送沿用既有会话通道。采用现有DSHM选择页模式（与技能一致），没有更换共享编辑器或加载电脑整页。直接连接原候选弹层需要补齐结构化编辑器及提交状态机，本轮未把它计作完成。
- 协议新增只读 `sessionReferenceResolver/candidates`，与已有 `fileReferences/list` 一并仅允许 `agentId/query`，身份最长200字符、查询最长4096字符；禁止注入cwd/limit/正文读取选项。原Host决定当前Agent、工作区和候选数量，聊天mention原样保留，文件引用复用原格式化函数，不能表达的文件名不展示。旧电脑可只提供文件来源，来源失败、能力缺失和没有结果分别显示；取消/改查询/换会话/断线丢弃旧结果，插入核对连接代次与会话。
- [MuMu报告](../../artifacts/references-android.json) 2026-09-25 16:42:17 UTC（香港9月26日）验证真实目录进入、中文/空格文件引用、既有「DSH Mobile 联调测试」聊天引用、两个来源无结果；errors/resources为空。[文件截图](../../artifacts/references-files-android.png)和[聊天截图](../../artifacts/references-chat-android.png)已查看。仅操作专用「DSHM Remote 联调提示」草稿，原 `DSHM_LANGUAGE_DRAFT_20260925` 已恢复，独占创建的文件和目录已清理，没有新模型请求、Key/绑定/管理权限变更。
- [手机281项](../../artifacts/reference-all-tests.log)、[后端58项](../../../backend/artifacts/reference-tests.log)（外部PostgreSQL1项跳过）、[插件111项](../../../plugin/artifacts/reference-tests.log)通过，Web/APK/lint和后端/插件类型检查构建通过。[候选规则回归](../../tests/remote-references.test.mjs)覆盖部分来源失败、取消、原文件格式、草稿上限与过期选择；[协议回归](../../../backend/tests/remote-reference-policy.test.ts)覆盖边界字段。[实际入口脚本](../../scripts/verify-references-android.mjs)首两次因测试工具导出/定位错误中止，修正后通过，不计生产失败或成功证据。
- DSH与网关自行重启为68428/23120，电脑浏览器已恢复。首次Android构建因未设置SDK环境变量失败，设置现有ANDROID_HOME后构建成功。未验证引用发送后的模型读取、所有第三方输入插件、完整在途撤销；子会话暂不提供此选择入口。R12网页范围仍待用户选择，不影响本项。

## 工作区文件按需浏览（2026-09-26）

- 状态：插件0.1.42及新版网关已部署，已有APK自动启用原文件树，MuMu实际入口通过；完整Remote继续实施。维护角色：DSH Mobile项目协作Agent。来源：[原文件树](../../../deepseek-harness/packages/client/ui-sidebar-files/src/client/index.ts)、[原Host](../../../deepseek-harness/packages/api/workspace-files/src/index.ts)、[协议策略](../../../backend/packages/protocol/src/remote-policy.ts)、[手机能力门槛](../../src/remote-plugin-policy.mjs)。
- 已确认R10要求已有工作区文件按需浏览。选择接通原workspaceFiles/list及原FilesBody，避免另写手机文件树；不改插件内部界面。只接受原会话身份与路径，Host按会话头解析工作区、规范路径核验范围；每次仅返回一层，默认2000项并提示截断。拒绝注入根目录/递归/上限，拒绝父目录、外部绝对目录及中间链接越界，最终链接不当作目录打开。不扫描同步整机目录或创建工作区。
- [真实Host/Gateway测试](../../../plugin/tests/workspace-file-list.test.ts)覆盖按层读取、大小/条目、截断、未知会话、缺失/非目录、工作区越界和Windows junction；不是仅测试参数名单。[后端57项](../../../backend/artifacts/workspace-list-tests.log)通过，外部PostgreSQL1项跳过；[插件111项](../../../plugin/artifacts/workspace-list-full-tests.log)、类型检查与构建通过。手机能力门槛7项通过；手机生产代码/APK未修改，沿既有动态加载能力启用。
- 真实MuMu [16:23:28 UTC报告](../../artifacts/workspace-files-verify-android.json)（香港9月26日）验证「Remote选项→插件面板→工作区文件」：当前DSH-TEST根、逐层展开、空目录、nested/readme.txt预览与磁盘一致、返回保留展开状态、新增文件后手动刷新出现，errors/resources为空、草稿保留。[文件树截图](../../artifacts/workspace-files-tree-android.png)已检查，[预览截图](../../artifacts/workspace-files-preview-android.png)保留；原组件在约388px容器内显示。
- [清理报告](../../artifacts/workspace-files-cleanup-android.json)16:23:43确认只删除本次自建且内容已核对的目录/文件，刷新后目录消失，返回聊天草稿不变。[验收脚本](../../scripts/verify-workspace-files-android.mjs)独占seed且不发送模型消息。无新管理授权、Key/模型配置或用户文件修改。DSH与网关已为部署自行重启，目前32508/67764。
- 该批覆盖已有会话工作区浏览；完整在途撤销、其他安装形态及原R01–R16仍未全部验收。R12网页访问范围仍待用户选择，未因此开放本地网页代理。下面较早的“不开放目录树”描述的是当时版本，不覆盖本次受限单层目录能力。

## 文件实时更新与并发容量（2026-09-26）

- 状态：网关容量修复及电脑文件元数据兼容补丁已部署，真实 MuMu 更新通过；完整 Remote 仍进行中。维护角色：DSH Mobile 项目协作 Agent。来源：[网关](../../../backend/packages/gateway/src/hub.ts)、[容量回归](../../../backend/tests/remote-stream-capacity.test.ts)、[兼容补丁](../../../plugin/compatibility/file-metadata/README.md)与[实际验收脚本](../../scripts/verify-file-resource-live-android.mjs)。
- 原网关把8条合法长期订阅与插件资源下载共用容量，真实同版本重装时返回 too_many_streams，导致插件不能重新加载。现分为各8条订阅/短传输，保留每连接32条和全局4096条总上限。独立容量、取消释放、ACK和总量测试通过，[后端全量](../../../backend/artifacts/stream-capacity-full-tests.log)56项通过，1项外部PostgreSQL未配置跳过；类型检查与构建通过。真实重装后恢复加载，原ClientEntries无生产修改，新增同版本重装回归通过。
- 第一轮工具真实写入证明隐藏面板的同一 resources.source 订阅收到新版本，但发现旧 provider 的 bytes 仍是34而磁盘已是33：[原问题报告](../../artifacts/file-resource-live-observe-android.json)。补丁收到新版本后复用原 stat，完整更新文件信息；相同版本去重、缺失/恢复及取消仍用原逻辑。不开放目录树或额外文件权限。六项[补丁回归](../../../plugin/artifacts/file-metadata-tests.log)通过，包含原浏览器产物复现、源码/编译一致性和隔离安装恢复。
- 部署后[第二轮真实报告](../../artifacts/file-resource-metadata-observe-android.json)于2026-09-25 16:10:42 UTC开始（香港9月26日）：在专用联调会话发起独立文件write，核对路径后允许一次沙盒升级；同一隐藏订阅收到新版本及33字节，打开预览与磁盘内容一致。草稿和“仅可查看”预设保持，errors为空；[截图](../../artifacts/file-resource-metadata-android.png)已检查。每轮只发送一次请求，观察失败后不重发；未更换Key、配置或授予设备管理权限。
- 两轮临时文件均已清理，测试包0.0.5已从电脑卸载。[16:15:09 UTC手机清理回归](../../artifacts/file-metadata-unloaded-android.log)确认原面板移除、草稿保留、管理入口仍要求授权，errors/resources为空。DSH已自行结束并恢复以加载补丁，目前39288；网关35704。79份文档及2247条本地链接校验通过。实际安装恢复未执行、由副本测试证明；其他资源provider、网页策略、任意第三方插件与完整R01–R16/A03–A06继续验收。后面的“工具修改尚未现场验收”是本轮之前的历史状态。

## 原文件资源服务与旧 WebView（2026-09-25）

- 状态：插件0.1.41、新网关与APK已安装；真实资源读取及面板回归通过，完整 Remote 仍进行中。维护角色：DSH Mobile 项目协作 Agent。来源：[协议策略](../../../backend/packages/protocol/src/remote-policy.ts)、[真实Host测试](../../../plugin/tests/workspace-file-feed.test.ts)、原[文件provider](../../../deepseek-harness/packages/api/workspace-files/src/client/provider.ts)、[手机URL兼容](../../src/remote-url-platform.cjs)与[启动入口](../../src/remote-main.jsx)。
- 原 provider 同时依赖 stat 和 changes。本次开放 `workspaceFiles/changes`，仅接收非空有界的 workspaceFileScopeId，禁止额外字段；工作区根目录由原 Host Session lookup 解析。只转发 DSH 已观察到的版本/消失事件，不是操作系统文件监视，不开放目录树或写入。关闭流、释放 adapter 和撤权均取消观察；真实 Host 测试覆盖工作区内外过滤及停止后不再输出。
- MuMu 原 URL 将 `dsh-resource://file/...` 的 hostname 解析为空，导致已注册 provider 返回 none。手机入口按实际能力检测启用现有 core-js URL 实现，现代引擎保留原生实现，不改原插件或参考源码。URL补丁与被序列化到 PDF Worker 的取消/Promise补丁分开；首次回归发现耦合破坏 Worker，分离后277项全部通过，含自定义协议、HTTP、配对链接解析、blob 创建/撤销及PDF兼容。
- [MuMu资源报告](../../artifacts/file-resource-android.json)15:39:16 UTC：独立面板0.0.5直接订阅原 resources.source，经真实授权通道取得26字节文件的元数据和版本；不存在路径返回原 not-found，停止订阅移除输出，草稿不变，errors/resources为空。[截图](../../artifacts/file-resource-android.png)已检查。测试包0.0.4遗漏 resources 注入，0.0.5修正；失败尝试不计入通过。
- [面板回归](../../artifacts/file-provider-panels-android.log)15:39:56 UTC覆盖原 Modal/Menu、Android返回逐层关闭、菜单扩展、720→388px缩放、文件预览及状态保持；[卸载回归](../../artifacts/file-provider-unloaded-android.log)15:40:41确认测试包移除、草稿及管理入口保持。DSH与网关为部署更新已重启，目前PID23588/35528；无新模型请求、Key/设置修改或新管理授权。
- 验证：[手机277项](../../artifacts/file-provider-phone-tests.log)、[Web构建](../../artifacts/file-provider-web-build.log)、[APK与lint](../../artifacts/file-provider-android-build.log)、[协议9项](../../../backend/artifacts/file-provider-tests.log)、[插件110项](../../../plugin/artifacts/file-provider-full-tests.log)及补充adapter释放后的[Host测试](../../../plugin/artifacts/file-provider-host-test.log)通过。模拟器只证明初次资源读取/错误/释放，工具修改后手机实时刷新尚未现场验收；Host过滤测试显式产生原 fs/observed 事件，不冒充真实模型工具执行。文件树、其他资源provider、网页策略及原完整矩阵继续推进。

## 插件面板的菜单与弹窗（2026-09-25）

- 状态：已实现并安装新版 APK，原组件回放及 MuMu 真实插件验证通过；完整 Remote 仍进行中。维护角色：DSH Mobile 项目协作 Agent。来源：[手机面板](../../src/remote-plugin-panels.jsx)、[Android 返回入口](../../src/ui/RemoteWorkspace.jsx)、原 [Modal](../../../deepseek-harness/packages/client/ui-primitives/src/Modal.tsx)、[Menu](../../../deepseek-harness/packages/client/ui-primitives/src/Menu.tsx)、[TabMenu](../../../deepseek-harness/packages/client/ui-dockkit/src/components/TabMenu.tsx)与[扩展契约](../../../deepseek-harness/packages/client/ui-sidebar-right/src/client/contract/slots.ts)。
- 原因与实现：原插件把 Modal/Menu 放到 document.body，浏览器 native dialog 外壳会让这些控件被遮挡、无法点击。[失败回放](../../artifacts/plugin-panel-overlays-red.log)复现指针被面板内容拦截。改用与电脑插件管理相同的 body 全屏容器方式，保留局部插件原组件/缩放和状态，不改写插件内部；背后当前可见聊天设为 inert，关闭恢复原值与焦点。真实 App 同时保留隐藏连接页，因此选择可见 remote-app；[插件管理容器](../../src/ui/RemotePlugins.jsx)的同类选择器同步修正。
- 手机「面板操作」复用原 TabMenu 并渲染 sidebar.right.tab.menu.item，传入真实 tab 与 dismiss，插件自行按 tab.kind 判断是否显示。关闭标签仍由原 controller 处理。Android 返回与 Escape 先关闭菜单，再交原 Modal 关闭，最后退出面板；菜单优先使用原 Menu/TabMenu 的外部 pointerdown 关闭契约，防止同一 Escape 同时触发 Modal。复杂第三方自定义弹窗契约尚未普遍验证。
- [页面回放报告](../../artifacts/plugin-panel-overlays-web.json)覆盖原弹窗输入/选择、嵌套菜单返回、标签扩展菜单、Escape 只关菜单、隐藏连接页下真实聊天 inert/恢复，以及上一批导航、文件、状态及卸载回归。[276项Node](../../artifacts/plugin-panel-overlays-tests.log)、[渲染回归](../../artifacts/plugin-panel-overlays-rendering.log)、[Web构建](../../artifacts/plugin-panel-overlays-build.log)、[APK/lint](../../artifacts/plugin-panel-overlays-android-build.log)通过。
- 真实验收：电脑安装自编面板包0.0.3，经真实模块图进入已安装 MuMu App。15:07:26 UTC [运行报告](../../artifacts/plugin-panel-overlays-verify-android.json)验证原 Modal/Menu 可输入/点击，实际 Android keyevent 4 先关菜单再关弹窗，面板保留；扩展菜单更新真实导航参数。720→388px缩放、26字节文件读取和状态保持回归通过，[弹窗截图](../../artifacts/plugin-panel-overlay-android.png)已检查。随后保持手机弹窗打开，在电脑卸载插件；15:08:08 [清理报告](../../artifacts/plugin-panel-overlays-unloaded-android.json)确认弹窗和局部正文移除、旧标签兜底可关闭、无错误与失败资源。
- 同一真实清理步骤检查管理入口仍要求授权；打开时当前聊天 inert，返回后恢复可用，草稿保持。首次现场测试发现隐藏连接页选择歧义，已修正源码并重新构建安装后完整复验，不把首次失败计入通过。没有新增设备权限、模型请求、电脑服务重启或用户设置修改；测试包已卸载。其余资源服务、任意第三方插件、多窗及完整撤销等原完整范围继续推进。

## 插件面板与原侧栏服务（2026-09-25）

- 状态：新版 APK 已安装，原服务回放及代表性独立插件的真实 MuMu 加载、文件读取和卸载通过；完整 R13 与 Remote 未完成。维护角色：DSH Mobile 项目协作 Agent。来源：[手机面板](../../src/remote-plugin-panels.jsx)、[插槽宿主](../../src/remote-plugin-slots.jsx)、[正式入口](../../src/ui/RemoteWorkspace.jsx)、原 [controller](../../../deepseek-harness/packages/client/ui-sidebar-right/src/client/service.ts)、[注册表](../../../deepseek-harness/packages/client/ui-sidebar-right/src/client/tab-registry.ts)和[标签 Hook](../../../deepseek-harness/packages/client/ui-sidebar-right/src/client/tab-info.ts)。
- 取舍：复用原 controller、tabDomain、会话 store、guide、导航参数和关闭信号；手机只组合窗口及文件预览。没有加载电脑根页面或提供虚假的 layout 服务。关闭原 store 的电脑 localStorage 持久化，导航快照只在当前已认证模型内按 sessionId 保存，随模型释放；不能据此宣称 App 重启恢复插件表单。收起窗口/切换标签/临时预览文件时保留组件，切换会话保留导航记录，插件自己的跨会话数据仍由其作用域负责。Surface 增加可控显示以保留组件，其他调用默认仍打开。
- 文件使用现有授权通道。原工作区文件 provider 同时需要 stat 与 changes，按实际 calls/streams 协商启动，未扩大接口名单。文件树、网页、原文档预览等依赖仍标记待接入，不能由侧栏存在推断全部可用；网页范围仍待用户确定。新增 picomatch 4.0.4 对齐原注册表浏览器 POSIX 依赖。
- [原组件回放](../../artifacts/plugin-panels-web.json)覆盖自有菜单、参数导航、720→343px 缩放、局部计数保留、关闭信号、文件入口、Android 返回、两会话隔离和卸载兜底；[检查脚本](../../scripts/check-plugin-panels.mjs)。[276项 Node](../../artifacts/plugin-panels-tests.log)、[渲染回归](../../artifacts/plugin-panels-rendering.log)、[Web 构建](../../artifacts/plugin-panels-build.log)、[APK/lint](../../artifacts/plugin-panels-android-build.log)通过。
- 真实流程：通过电脑公开插件页安装本项目[独立面板包](../../tests/fixtures/live-panel-plugin/README.md)，经实际模块图传至 MuMu。调用原 sidebarRightTabs/useTabInfo，720px 外层缩至约388px（420px视窗），点击、切换/收起重开、文件预览后局部计数与路径保留；读取已有26字节验收文件并核对磁盘内容，聊天草稿保持。14:53:11 UTC [运行报告](../../artifacts/plugin-panels-verify-android.json)、14:53:46 [卸载报告](../../artifacts/plugin-panels-unloaded-android.json)的 errors/resources 为空；[面板截图](../../artifacts/plugin-panels-android.png)、[文件截图](../../artifacts/plugin-panels-file-android.png)已检查。
- 首版验收包漏将 register 返回的 disposer 放入作者 ctx.effect，卸载后 guide 入口残留；这是夹具违反原注册契约，已在0.0.2及隔离夹具补上生命周期归属并复验。清除首版残留时仅重开手机App/刷新电脑页面。最终测试包已卸载，手机旧标签显示不可用后已关闭，聊天保留；DSH46776/网关57392持续运行，无模型请求、Key/配置/管理权限变更。真实脚本：[verify-plugin-panels-android.mjs](../../scripts/verify-plugin-panels-android.mjs)。
- 尚未证明任意第三方插件兼容：多窗分屏、插件菜单扩展、复杂 portal、所有资源 provider、完整设备撤销与其他矩阵项仍需接入/验收；当前窗口不提供电脑分屏能力。原完整 R01–R16/A03–A06 范围保持。

## 回复内容顺序（2026-09-25）

- 状态：已实现并安装新版 APK，混合内容原投影回放和 MuMu 实际历史回归通过；未用真实模型生成全部混合块类型。完整 R05/R06/R13 仍在实施。维护角色：DSH Mobile 项目协作 Agent。核验日期：2026-09-25。来源：[原块契约](../../../deepseek-harness/packages/client/ui-conversation/src/client/contract/records.ts)、[原渲染语义](../../../deepseek-harness/packages/client/ui-chat/src/client/chat/AssistantMarkdown.tsx)、[手机消息入口](../../src/ui/RemoteMessage.jsx)、[共享消息组件](../../src/ui/ChatMessage.jsx)。
- 原实现将全部文字和思考分别拼接，再把图片追加到末尾，遗漏 other 块。现在按原 AssistantBlock 顺序渲染，相邻图片共用一组，工具头留给独立工具节点，已完成空回复不生成 article。继续共用普通聊天消息外壳和思考样式；最终回复文件引用传给每个文字块，思考不自动解析为文件引用。
- 两种方案中选择复用原契约/JsonBlock/searchable-hidden并保留手机块渲染；直接挂载原 AssistantMarkdown 会带入电脑同源 `/api/file` 媒体路径及另一套布局。本次不新增文件权限、不修改插件内部界面。扩展内容默认收起，原 JsonBlock 按纯文本显示且上限20000字符；思考使用 hidden-until-found，查找命中展开所属轮次。
- [回放检查](../../scripts/check-assistant-blocks.mjs)经真实 RemoteWorkspace 和原事件投影覆盖图文先后、连续图片分组、思考位置、扩展数据展开/截断/不执行脚本、浏览器查找和空回复；[完整报告](../../artifacts/assistant-blocks-web.json)errors为空，文件引用、插件替换/卸载、自适应及其他原回归保持。初测等待空回复的分支按钮超时，原投影不会为无最终答复建立该入口；已改为等待后续有效消息并检查空回复不产生 article，没有修改生产协议。
- [275项Node测试](../../artifacts/assistant-blocks-tests.log)、[渲染回归](../../artifacts/assistant-blocks-rendering.log)、[Web构建](../../artifacts/assistant-blocks-build.log)、[APK/lint](../../artifacts/assistant-blocks-android-build.log)通过。新版覆盖安装后，[实际入口](../../artifacts/assistant-blocks-entry.log)errors/resources为空；[14:26:48 UTC折叠](../../artifacts/assistant-blocks-process-android.log)读取32个可折叠轮次、4个过程成员、约24px间距；[14:26:51文件引用](../../artifacts/assistant-blocks-mentions-android.log)预览26字符一致、权限仍仅可查看；[14:27:04工具回归](../../artifacts/assistant-blocks-tools-android.log)43条工具、通用差异/命令/文件入口与1024×1024图片通过。均保留草稿、无页面错误。[回复截图](../../artifacts/assistant-blocks-reply-android.png)已查看，[图片截图](../../artifacts/assistant-blocks-image-android.png)留存。
- 本次没有发送模型消息、改变授权/Key/模型配置或重启电脑服务；DSH46776和网关57392保持。混合图文和未知块使用隔离回放，不能冒充真实模型全部格式或第三方插件验收。

## 回复中的文件名引用（2026-09-25）

- 状态：新版 APK 已安装，真实 MuMu 工具写入后的最终回复引用及文件预览通过；完整 R10/R13 继续实施。维护角色：DSH Mobile 项目协作 Agent。核验日期：2026-09-25。来源：[交付投影](../../src/remote-changes.mjs)、[局部作用域](../../src/remote-plugin-slots.jsx)、[手机消息](../../src/ui/RemoteMessage.jsx)、[共享 Markdown](../../src/ordinary-rendering.jsx)、[原判定规则](../../../deepseek-harness/packages/client/ui-deliverables/src/client/turn-deliverables.ts)。
- 原手机投影只接受改动公告和交付事件，遗漏了成功 write/edit 等路径；现在完整沿用原 deliverablesDefinition 的工具判定，保留既有手机差异/交付入口。相比从回复猜文件名，复用原 selectProducedFiles/presentedForClosing/producedFileMentions，路径来源、失败排除、关闭序号及同名歧义判断保持一致。原 chatFileMentions 插件服务存在时优先使用，缺失时由手机已有交付投影提供解析；局部插件 owner 和 DSHM 共享 Markdown 均接同一能力，不开放新文件权限。
- 只对关闭轮次的最终回复启用，不改思考文本或普通聊天；订阅原轮尾/交付数据，关闭信息后到也会更新。完整路径可匹配，简称必须唯一；没有本轮事实、失败结果、未知名字和歧义简称保持普通行内代码。点击读取电脑当前文件，沿用已有预览、鉴权和容量限制。
- [275项Node](../../artifacts/file-mentions-tests.log)、[完整页面回放](../../artifacts/file-mentions-web.log)、[历史渲染回归](../../artifacts/file-mentions-rendering.log)、[Web构建](../../artifacts/file-mentions-build.log)及[APK/lint](../../artifacts/file-mentions-android-build.log)通过。[新增回放](../../scripts/check-file-mentions.mjs)经原事件投影覆盖关闭更新、成功/失败写入、交付、歧义、文件窗口及不同轮次/会话。初次回放的 tool/result 缺原 tool-result 内容层，修正测试数据后通过，没有改变生产协议。
- 原测试历史没有符合条件的正文行内引用，不能以零条作为通过。因此在既有专用聊天发起一次独立测试文件写入请求，使用[独占种子](../../artifacts/file-mentions-live-seed.json)阻止结果未知后重复发送。电脑先拒绝 read-only、再拒绝 workspace-write（项目验收目录位于该聊天工作区外），核对准确 write 路径后分别选择一次性批准，第三次成功写入本项目 artifacts 文件；未修改会话预设或授予设备管理权限。首次等待60秒时仍在审批中，后续只观察原请求，不重发。
- [14:14:19 UTC最终报告](../../artifacts/file-mentions-verify-android.json)真实回复引用一条完整路径，点击后显示26字符，与电脑磁盘 `DSHM_FILE_MENTION_VERIFIED` 一致；草稿保留、errors为空。实际[脚本](../../scripts/verify-file-mentions-android.mjs)默认只读，prepare必须显式启用真实请求。[引用截图](../../artifacts/file-mentions-link-android.png)、[预览截图](../../artifacts/file-mentions-preview-android.png)已检查；权限页实际为“当前权限：仅可查看”，检查后返回聊天。早期脚本误用“只读”匹配用户文案，已改为真实“仅可查看”后复验。
- DSH46776/网关57392保持；普通聊天Key、绑定、设备权限及模型配置未变，本轮产生一条模型请求、三个有记录的工具尝试（两次拒绝、一次成功），并保留独立测试文件。此轮真实覆盖成功 write 的引用，edit/交付/歧义等细分由原规则与回放覆盖；完整第三方扩展、资源撤销和原R01–R16仍未完成。

## 聊天过程折叠（2026-09-25）

- 状态：新版 APK 已覆盖安装，MuMu 真实历史折叠及原工具入口通过；完整 R13/Remote 仍进行中。维护角色：DSH Mobile 项目协作 Agent。核验日期：2026-09-25。来源：[插槽宿主](../../src/remote-plugin-slots.jsx)、[手机消息回退](../../src/ui/RemoteMessage.jsx)、[间距样式](../../src/ui/remote-product.css)、[原 ChatNodeSeat](../../../deepseek-harness/packages/client/ui-chat/src/client/chat/ChatNodeSeat.tsx)、[原 store](../../../deepseek-harness/packages/client/ui-chat/src/client/stores.ts)。
- 相比重新推算过程节点和维护手机折叠表，直接复用原 ChatNodeSeat、TurnProcessNodeView 与 createChatStore；手机只提供内部节点插槽及共享消息回退。原插件取得真实 `turnProcess.spec/foldable/open/setOpen`。同一轮所有节点共享状态，不同会话隔离，状态随会话作用域释放；当前使用原 compact 默认规则，没有新增或写入电脑配置。
- 运行中、最终回复尚未形成或历史未读全时不折叠。结束且具备过程记录时默认收起，最终回复保留；展开恢复中间回复、工具、上下文及最终回复的思考。保留原 `hidden=until-found` 与浏览器查找展开行为，不卸载插件子树。间距改为可见节点的 margin，避免隐藏节点仍作为 flex 项产生空白；手机自身注册不进入插件缩放框，避免外部插件作者关闭缩放后被宿主再次缩放。
- [完整插槽回放](../../artifacts/turn-process-web.log)通过，新增[过程检查](../../scripts/check-turn-process.mjs)经真实事件投影验证运行/结束、历史不全、展开收起、最终回复、浏览器查找、不同轮次/会话及折叠后24px间距；原缩放优先级与其他入口回归保持通过。初次过程测试因回放 seq 跳号触发原补读而失败，已修正为连续事件，不修改生产分页行为。[274项Node](../../artifacts/turn-process-tests.log)、[渲染回归](../../artifacts/turn-process-rendering.log)、[Web构建](../../artifacts/turn-process-build.log)、[APK构建与lint](../../artifacts/turn-process-android-build.log)通过。
- [13:58:18 UTC MuMu报告](../../artifacts/turn-process-android.json)完整读取已有专用会话，识别31个可折叠轮次；第1轮4个过程成员展开收起、最终回复、24px间距、草稿保留通过，errors为空。[折叠](../../artifacts/turn-process-collapsed-android.png)与[展开](../../artifacts/turn-process-expanded-android.png)截图已检查。脚本初次定位标题不唯一，收窄到工作区后复验通过。实际[Android脚本](../../scripts/verify-turn-process-android.mjs)只读取已有历史，不发模型请求。
- [原工具入口复验](../../artifacts/node-slot-tools-android.json)13:58:30 UTC通过：40条工具、展开过程后查看写入差异、打开当前文件、1024×1024图片和命令详情；无错误或电脑iframe、草稿保持。该报告是原文件的最新复验，前节时间指此前同名报告。DSH46776/网关57392未重启，Key、绑定、权限与模型配置保持。现场覆盖已完成历史；运行转完成规则由隔离回放覆盖，不冒充本轮真实运行工具测试。其他插件owner/服务、完整撤销及原完整范围保持未完成。

## 文件指定行号定位（2026-09-25）

- 状态：新版 APK 已安装，真实 MuMu 的文本/Markdown 链接定位通过；插件入口经正式组件隔离回放验证。完整 R10/R13 及 Remote 仍进行中。维护角色：DSH Mobile 项目协作 Agent。来源：[文件入口](../../src/ui/RemoteWorkspace.jsx)、[预览](../../src/ui/RemoteFilePreview.jsx)、[源码视图](../../src/ui/RemoteFileSource.jsx)、[行范围计算](../../src/remote-file-position.mjs)、[原 Markdown 契约](../../../deepseek-harness/packages/client/ui-primitives/src/markdown/MarkdownDelegate.tsx)。
- 原 `openFile(path, { line })` 的行号此前被手机忽略；现在插件与 Markdown 共用同一入口传递 1-based 行号，文件加载完成后高亮并滚动到目标，只移动文件窗口。Markdown 带行号默认显示源码，仍可切回阅读；HTML/SVG 带行号显示源码，无行号时保持原预览。图片、PDF 和 Office 不把源代码行号解释成页码。无效行号不强制转换；文件变短或为空时提示当前目标行不存在，重新读取会清除旧高亮。
- 选择有界全文定位：继续已有 2 MiB 文本读取及权限，不新增 Host 端点。相比对每行创建 DOM 或引入整套桌面文档页，仅把目标行从原文本切出并标记，保留 CRLF、空行和原始文本，避免大量行元素。原桌面 TextBody 逐行渲染适合其分页服务，此处不复制该整套分页状态。
- [274项Node测试](../../artifacts/file-line-tests.log)通过，新增行范围测试覆盖 CRLF、空行、最后换行、无效及超大行号。[完整组件回放](../../artifacts/file-line-slots-web.log)实际经过 RemoteWorkspace，验证插件按钮、Markdown链接、HTML/SVG源码、阅读切换、滚动可见性、内容不变、缩短及空文件。使用隔离文件服务，不将其作为真实电脑插件行号跳转的证明。
- [13:39:59 UTC准备](../../artifacts/file-line-prepare-android.json)仅在原专用联调会话发送一次请求，要求模型只返回两个文件链接、不调用工具；新文件均为 artifacts 内的独立180行验收文件。[13:42:15 UTC最终复验](../../artifacts/file-line-verify-android.json)未重发消息，新版冷启动后点击真实回复链接，两个入口均滚动约2536px且第120行可见、源码原文一致；文本暂时缩短与清空后的提示通过，finally恢复文件，原聊天草稿保留、errors为空。[文本截图](../../artifacts/file-line-text-android.png)已核对，[Markdown截图](../../artifacts/file-line-markdown-android.png)保留。实际脚本：[verify-file-lines-android.mjs](../../scripts/verify-file-lines-android.mjs)，默认只读验证；准备步骤需要显式开启真实请求，并用独占种子文件阻止未知结果后重复发送。
- [Web构建](../../artifacts/file-line-build.log)、[APK构建和Android lint](../../artifacts/file-line-android-build.log)通过。DSH46776/网关57392持续运行，Key、绑定、设备权限和模型配置保持。HTML/SVG行号由组件回放覆盖，本次未再发真实模型请求逐格式验收；其余插件owner语义、全部撤销和原完整范围继续推进。上一节历史记录中的文件行号缺口由本节补上，不能据此宣称全部插件兼容。

## 原消息节点与工具插件接入（2026-09-25）

- 状态：新版 APK 已在 MuMu 验证原工具卡片、文件入口、图片读取和两类详情窗口。R13 及完整 Remote 仍进行中。维护角色：DSH Mobile 项目协作 Agent。来源：[插槽宿主](../../src/remote-plugin-slots.jsx)、[消息入口](../../src/ui/RemoteMessage.jsx)、[工具详情](../../src/ui/RemoteToolDetail.jsx)、[图片桥](../../src/remote-images.mjs)、[原节点契约](../../../deepseek-harness/packages/client/ui-chat/src/client/contract/slots.ts)。
- 之前手机内置节点分支绕过 `conversation.chat.node`，只有未知节点能使用插件。现在全部节点先经过同一 keyed 插槽，无注册项仍回退 DSHM 排版；保留原节点、会话与轮数据，不加载电脑整页。相比为每个工具另写手机实现，复用原局部 renderer 可保留插件扩展，测试同时覆盖缺插件、替换和卸载恢复。
- 补充原 owner 的 `loadImage/peek`、`renderMessageImages`、`openSkill`、`fileMentions` 及既有打开文件/工具/分支回调。图片沿已有授权附件字节通道读取，复用并发、大小和 MIME 检查，Blob URL 随原会话作用域或模型关闭释放；未开放新的文件接口。工具详情按实际工具类型区分命令与一般调用，不把文件工具误导向“没有这条命令”。原工具与附件共用的 conversation 中英文字典也由手机宿主注册。
- 真实 MuMu 初测发现原卡片显示 `tool.title.write`、`row.failed` 等内部键；补字典后最终[13:31:25 UTC报告](../../artifacts/node-slot-tools-android.json)读取 40 条历史工具，原“查看”进入 DSHM 工具详情并显示真实写入差异，原文件按钮读取当前文件，原 read_image 卡片显示 1024×1024 图片，pwsh 查看进入命令详情。errors 为空，草稿保留，未嵌入电脑 iframe。[工具详情截图](../../artifacts/node-slot-tool-detail-android.png)和[图片截图](../../artifacts/node-slot-image-android.png)已检查。脚本初次失败来自标题定位不唯一及点击展开行中心碰到内嵌文件按钮，已改明确范围和 Enter 展开；不计为产品通过。
- [完整插槽回放](../../artifacts/node-slot-contract-web.log)覆盖内置回复替换、同一节点与 owner 回调、中文/英文、卸载恢复原手机消息；[渲染回归](../../artifacts/node-slot-rendering.log)保持已完成消息不因草稿或后续回复重复渲染。[272 项 Node 测试](../../artifacts/node-slot-tests.log)、[Web 构建](../../artifacts/node-slot-web-build.log)、[APK 与 Android lint](../../artifacts/node-slot-android-build.log)通过。新增图片测试覆盖复用、容量限制、无效 MIME、作用域取消、URL 回收和迟到结果。实际入口复验命令为设置 `DSHM_ANDROID_SERIAL` 后执行 [verify-remote-tool-slots-android.mjs](../../scripts/verify-remote-tool-slots-android.mjs)。
- 环境：DSH46776/网关57392保持，APK 覆盖安装保留 Key、绑定及草稿；未发送模型请求、安装电脑测试插件或扩大权限。原工具外层继续默认等比缩放，未改插件内部样式。完整 owner 语义尚未全部验收：`openFile` 行号定位、可选 `turnProcess`、技能/文件引用的完整真实插件交互、全部撤销和任意第三方兼容仍待后续，不能将回调存在或模块 active 当作全部兼容。

## 父会话不可用时停止与返回（2026-09-25）

- 状态：新版 APK 已在 MuMu 通过真实父句柄释放后的子任务停止和返回持久化父会话。完整 R03/R09 及 R01–R16 仍进行中。维护角色：DSH Mobile 项目协作 Agent。来源：[选择逻辑](../../src/remote-model.mjs)、[原 ClientSessions](../../../deepseek-harness/packages/api/session-controller/src/client/sessions/manager.ts)、[回归测试](../../tests/remote-model.test.mjs)、[真实手机脚本](../../scripts/verify-parent-offline-android.mjs)、[临时生命周期夹具](../../tests/fixtures/parent-offline-host.mjs)。
- 原因与修复：父 Agent 释放会使原客户端移除实时列表项，但聊天仍在电脑持久化记录中。旧实现先离开子会话再 retain 父会话，遇到 `sessions.retain: unknown session` 后一直加载。现在缺少列表项时先调用原会话列表刷新，并取得目标引用后再切换；同步取得引用失败保留当前页面、草稿和返回链，迟到的刷新不能覆盖更新的选择。保留原子会话地址及认证链路，不伪造会话目录，也不修改上游参考检出。
- 真实条件：使用显式 `--patch` 与 `DSHM_PARENT_LIFECYCLE_TEST=1` 加载本地测试夹具，只在已有 DSH-TEST 工作区创建自己的父子会话；子任务真实模型输出期间，释放夹具持有的父 AgentHandle。手机的禁止发送、独立停止及返回均通过正式 UI、中继和原接口完成。不是断开网络或伪造父状态，也不扩大设备权限。
- 首轮真实停止已通过，但返回实际失败，保留[原停止证据](../../artifacts/parent-offline-before-return-fix-android.json)和[原返回失败](../../artifacts/parent-offline-before-return-fix-cleanup.json)。早期夹具 setup 返回值、子任务不可向用户提问及文字定位失败均不计入产品通过；最终夹具使用纯文本输出，未重复发送结果未知的请求。
- 新版[运行报告](../../artifacts/parent-offline-run-android.json)为 13:08:42 UTC：电脑确认父在线/子运行中，13:08:54 释放父句柄后父离线/子仍运行，手机发送不可用但停止可用，13:08:55 确认子任务 inactive。[清理报告](../../artifacts/parent-offline-cleanup-android.json)为 13:09:10 UTC：从子会话返回父会话读取成功，测试聊天归档，原聊天及草稿保留；两份 errors 均为空。[返回截图](../../artifacts/parent-offline-returned.png)已检查。
- 验证：[55 项模型测试](../../artifacts/parent-return-model-tests.log)、[271 项完整 Node 测试](../../artifacts/parent-return-all-tests.log)、[Web 构建](../../artifacts/parent-return-web-build.log)、[APK 构建与 Android lint](../../artifacts/parent-return-android-build.log)通过。回归覆盖父列表刷新、读取失败保留子会话及迟到刷新不覆盖新选择；真实验收覆盖已安装 APK 的返回入口。首次安装后 Android 保留了旧系统分享任务，用仅清任务栈的启动参数恢复，未清应用数据。
- 环境恢复：临时 DSH 30336 已结束，恢复正常源码入口 DSH 46776（无测试 patch），网关 57392 保持；原 Key、聊天授权、绑定及 Subagent 深度未改。测试参数只用于验收，不进入用户正常启动配置。复杂弱网、完整设备撤销及其他剩余能力继续按下方矩阵推进。

## 历史断层保留重试（2026-09-25）

- 状态：断层/无进展页已在手机真实核心接入中处理，新版APK已安装；隔离错误注入及真实正常历史回归通过，不把隔离错误页当作用户电脑实际损坏记录。维护角色：DSH Mobile项目协作Agent。来源：[手机核心调用入口](../../src/remote-core.mjs)、[历史页检查](../../src/remote-history-page.mjs)、[原SessionEventStream](../../../deepseek-harness/packages/api/session-controller/src/client/transport.ts)、[原日志流](../../../deepseek-harness/packages/api/gateway/src/client/journal-stream.ts)、[原记录序号访问器](../../../deepseek-harness/packages/api/session-controller/src/client/sessions/history-records.ts)。
- **原因与取舍：**原journal在较早页末尾与当前首记录不连续时，先发布空`prepend/hasMore:false`再抛错误；Session吞掉异常，导致原只读事件观察误报到达起点。修改上游错误契约需要额外维护源码兼容，且只改UI无法阻止原状态被清空；本批在手机原Gateway的RPC接入边界先核对成功页。沿原`beforeSeq`和记录首尾访问器过滤重叠记录，末尾必须衔接，空页且`hasMore:true`必须报错；普通空起点仍允许，初始打开/重连无`beforeSeq`由原journal校验。结果对象保持原样，不合成成功或事件，也不修改认证、Host日志、参考源码和电脑配置。
- **错误回归：**[RED](../../artifacts/history-continuity-red.log)两项均出现Missing expected rejection；[GREEN](../../artifacts/history-continuity-green.log)通过断层页分别携带true/false、原窗口身份/草稿保持、分页入口保留、不自动重试、手动连续页重试、重叠连续记录、无进展空页和正常空起点。测试通过原RemoteModel/ClientSessions/Journal及实际核心hook。页内连续性和wire格式继续由原校验器处理，不另写日志拼接器。
- **两个用户入口：**[原组件回放](../../artifacts/history-continuity-ui.log)在聊天和后台任务历史分别交付断层页，显示“未能加载更早的记录，请重试。”且原加载按钮可用，之后正常页清除提示；业务读取失败和草稿保持回归继续通过。测试页全部在隔离夹具，未写入实际DSH记录。
- **新版MuMu：**[12:08:58 UTC真实历史报告](../../artifacts/history-continuity-pagination-android.json)23→45→69→82条回复到历史起点，偏移0.13/0.13/0.40px，全部原窗口内容和草稿保持，errors为空，截图已检查。只读取专用聊天，未发送模型消息、重启电脑服务或修改权限。DSH43052/网关57392保持，031未批准。
- **检查与范围：**[268项Node](../../artifacts/history-continuity-tests.log)、原完整页面回放、[Web构建](../../artifacts/history-continuity-web-build.log)、[APK及Android lint](../../artifacts/history-continuity-android-build.log)通过。此前“先空页再吞掉连续性错误无法区分”的限制由本节接入层处理；真实电脑业务拒绝、长期弱网、撤销及完整R01–R16仍继续验收。错误注入没有修改用户真实历史或假称发生实际日志断层。

## 实时输出期间的历史渲染（2026-09-25）

- 状态：性能缺陷已复现、修复并安装，真实MuMu持续输出期间完整分页通过；完整R05及R01–R16继续实施。维护角色：DSH Mobile项目协作Agent。来源：[消息组件](../../src/ui/RemoteMessage.jsx)、[真实聊天入口](../../src/ui/RemoteWorkspace.jsx)、[局部插件作用域](../../src/remote-plugin-slots.jsx)、[组件回归](../../scripts/verify-remote-rendering.mjs)、[实际验收脚本](../../scripts/verify-live-history-android.mjs)。
- **复现：**修复前三次真实生成测试分别在读取坐标或滚动按钮时超时，前一两页通过不能算完整通过。第三次[失败报告](../../artifacts/live-history-before-memo.json)观察到最长100ms定时器间隔约19.18秒；[CPU采样](../../artifacts/live-history-before-memo.cpuprofile)约71.54秒中57.33秒位于React同步更新调用栈，历史工具卡片和插件局部组件反复参与渲染。已存在的22条文章DOM全部保留，没有节点重建或页面转后台证据。定时器间隔是本次响应性探针，不是LCP/TBT或真机基准。
- **修复选择：**保留原不可变投影节点，以React.memo及按会话稳定的回调跳过未变化记录；命令与分支使用当前节点key，切会话仍更新闭包目标。插件宿主上下文按作用域依赖记忆，插件自身订阅、热启停和语言更新保持。相比整段历史虚拟化，这一变更无需重做高度、滚动锚点及插件挂载生命周期，兼容和验收范围较小；未修改参考上游或认证协议，也未用忽略回调的比较器掩盖旧闭包。
- **回归：**[修改前计数](../../artifacts/remote-rendering-red.json)在草稿更新后把同一已完成回复渲染数从3变5，修复后[回归报告](../../artifacts/remote-rendering.json)保持不变，新回复出现也不重画原记录；原插件会话状态、聊天计数及卸载/重载正常。计数注入仅在独立测试构建，不进入APK。原全页面/插件回放继续覆盖语言、文件命令入口、会话切换、自定义节点和反馈等路径，见[回放日志](../../artifacts/live-render-ui.log)。
- **真实新版APK：**[12:01:46 UTC报告](../../artifacts/live-render-live-android.json)在原“DSHM Remote 联调提示”仅发送一条无工具风景测试，生成中23→46→70→82条模型回复到起点，三次锚点偏移0/0.27/0.13px；每页后输出继续增长，阅读位置没有被拉回底部。100ms定时器最大间隔约247ms，页面errors为空，原22条DOM保留。手机停止本轮、392字符回复含唯一标记，原草稿恢复；电脑内置浏览器独立核对标记`DSHM_LIVE_HISTORY_1790337706347`及“已停止”，截图已检查。修复前的三次失败测试各自留下完整回复，没有重复发送同一请求。
- **静态与脚本边界：**[12:01:33 UTC静态分页](../../artifacts/live-render-static-android.json)22→45→69→81、草稿及全部旧内容保持。第一次静态复验脚本使用文本子串定位锚点，历史中重复正文导致匹配4条而失败；改为持有原DOM句柄后通过，两种分页脚本都使用同一修正，不放宽阅读偏移/内容断言。
- **交付与限制：**[266项Node](../../artifacts/live-render-tests.log)、[Web构建](../../artifacts/live-render-web-build.log)、[APK及Android lint](../../artifacts/live-render-android-build.log)通过。DSH43052和网关57392未重启，Key/地址/设备权限不变，031仍未批准。完整业务失败/连续性契约、真实在途撤销和其余矩阵继续验收；本次改善不代表全部性能指标或任意第三方插件达标。

## 历史读取失败反馈（2026-09-25）

- 状态：失败提示已接入两个正式入口，新版APK已安装；业务失败已隔离回放，真实电脑业务拒绝尚未现场注入，不代表完整R05完成。维护角色：DSH Mobile项目协作Agent。来源：[共享读取检查](../../src/remote-history.mjs)、[聊天页](../../src/ui/RemoteWorkspace.jsx)、[任务历史页](../../src/ui/RemoteJobOutput.jsx)、[原Session](../../../deepseek-harness/packages/api/session-controller/src/client/sessions/session.ts)、[原事件窗口](../../../deepseek-harness/packages/api/session-controller/src/client/contract/events.ts)。
- **原因与选择：**原`loadOlder`内部catch后正常完成，并不向调用者抛出部分读取失败。修改上游错误契约能提供更细的原因，但需要维护电脑和手机契约兼容；本批在手机侧只读观察原Binding的同步事件窗口，不修改参考源码或认证链路。一次读取没有`prepend`交付时提示“未能加载更早的记录，请重试。”，正常空页也有明确交付，不按消息数量猜测成功；`append`和模型消息结算不算分页结果。重连替换窗口、原会话或连接身份失效后不报告旧结果，finally移除订阅，不自动重试。
- **复现及隔离回归：**[RED日志](../../artifacts/history-read-red.log)中原Session的业务拒绝和并行实时追加均缺少预期失败反馈。新增三项[原模型测试](../../tests/remote-model.test.mjs)通过，覆盖业务失败后原内容/草稿保留、手动成功重试、正常空页、实时追加不掩盖失败和离开原会话。[正式组件回放](../../artifacts/history-read-ui.json)通过聊天与任务历史两个实际入口、失败提示、可重试按钮、成功后消失与草稿保留；沿原ClientSessions和投影，使用隔离协议样例，不冒充实际电脑业务拒绝。
- **真实MuMu回归：**[11:37:12 UTC全部历史](../../artifacts/history-read-pagination-android.json)22→45→69→78条模型回复到起点，偏移分别0/0.40/0.27px；[11:37:38 UTC加载中返回](../../artifacts/history-read-leave-android.json)及[11:38:08 UTC断开后手动重试](../../artifacts/history-read-recover-android.json)均通过，真实暂缓376801字节响应，草稿/已有内容保留、页面errors为空。截图已核对。未发送模型消息、读取Key或修改电脑设置/权限；DSH43052、网关57392保持，031未操作。代理退出且9878/18794无监听，ADB恢复tcp:8787→tcp:8787。
- **检查与边界：**[266项Node](../../artifacts/history-read-tests.log)、原组件完整回放、Web构建及[APK/Android lint](../../artifacts/history-read-android-build.log)通过。没有返回成功页的业务读取失败由本批处理；上游若先发布空页再吞掉连续性错误，现有只读接口无法区分正常起点，后续仍需专门契约处理。真实模型持续输出、现场业务拒绝、长时间弱网和完整授权撤销继续验收。下方通用脚本报告可能被本次复验更新，本节冻结副本对应本轮结果。

## 历史请求在途取消与恢复（2026-09-25）

- 状态：加载中返回阻塞已修复并安装APK；真实响应延迟、主动离开和连接中断后的重试通过，完整R05–R06异常仍待验收。维护角色：DSH Mobile项目协作Agent。来源：[正式页面](../../src/ui/RemoteWorkspace.jsx)、[Android在途验收](../../scripts/verify-pagination-fault-android.mjs)、[原始帧暂缓工具](../../../backend/scripts/verify-device-output-proxy.mjs)。
- **真实复现与修复：**原分页复用全页`act`忙碌锁，原响应暂缓时点击返回被直接忽略；[RED](../../artifacts/pagination-fault-leave-red-android.json)已确认暂存376801字节且已读内容/草稿未变，但三秒内无法返回。现分页使用独立请求身份并沿原Session.loadingOlder禁用自身按钮；不占用全页写操作锁。返回释放原会话引用，仍由上游取消请求；旧请求的滚动和错误反馈不得进入新会话，不另造分页通道或自动重放。
- **真实成功证据：**[11:23:44 UTC加载中返回](../../artifacts/pagination-fault-leave-android.json)中，保留真实响应后能立即回首页，释放迟到响应不会恢复旧聊天，重新打开后草稿仍在。[11:24:18 UTC断开恢复](../../artifacts/pagination-fault-recover-android.json)中，暂缓相同真实历史后丢弃设备连接，手机自动恢复，用户再次点击加载取得更早历史，原回复窗口及草稿保留。两份报告errors为空。均无模型调用、电脑配置或权限变更。
- **环境恢复：**工具只转发并暂存原响应字节，不记录凭据/聊天正文，不改原网关。测试将MuMu已有`tcp:8787`映射临时指向本机9878，finally恢复`tcp:8787→tcp:8787`并停止代理；已核对代理进程退出、9878/18794无监听。DSH43052与网关57392始终保持，主绑定聊天权限不变，031未动。
- **最终检查：**263项Node、六项生产定位函数浏览器检查、Web/APK/Android lint及脚本语法通过；[构建日志](../../artifacts/pagination-fault-build.log)。恢复直连后[11:24:43 UTC完整历史](../../artifacts/pagination-fault-final-history-android.json)仍22→45→69→78，偏移不足1px、顺序与草稿保持。最初测试曾误读连接外壳的同名标题，现将断言限定在remote-workspace，早期错误不计通过。
- **保留范围：**真实模型持续输出期间翻页、独立业务读取失败、长时间连续弱网和完整授权撤销仍待专项。上游Session.loadOlder可能内部消化读取失败，本轮不据断线重试通过就宣称所有错误都有独立提示，也未擅自改上游契约。

## 历史分页阅读位置（2026-09-25）

- 状态：真实缺陷已重复复现并修复，新版APK已安装；完整R05–R06网络/实时异常仍未验完。维护角色：DSH Mobile项目协作Agent。来源：[正式页面](../../src/ui/RemoteWorkspace.jsx)、[定位函数](../../src/remote-history-position.mjs)、[MuMu脚本](../../scripts/verify-remote-pagination-android.mjs)。
- **复现：**对已有「DSHM Remote 联调提示」连续向前加载到起点；两次都在第三次加载时从69到78条模型回复，原回复向上跳837.6px，前两次稳定。已有回复文本和顺序保持，因此是定位错误而非丢消息。[RED报告](../../artifacts/remote-pagination-all-red-android.json)保留。
- **取舍与修复：**继续用总高度差成本低，但把尾部变化、原节点合并和前插混为一体；选用存活消息DOM的内容坐标，前插后修正其位移。已有节点移除时沿用下一个存活节点，用户加载期间的滚动仍保留。只在该次加载期间暂停浏览器自动锚定，finally恢复；引用或连接世代变化后不调整新会话。复用原Session.loadOlder与投影，不改变协议或历史数据。
- **实际入口：**[11:16:14 UTC GREEN](../../artifacts/remote-pagination-android.json)连续三次加载22→45→69→78条模型回复并到达起点，位置偏移分别0、0.40、0.27px，原回复窗口及草稿保留，页面错误为空。[截图](../../artifacts/remote-pagination-android.png)已核对。未发送模型消息、修改Key/电脑配置/权限；DSH43052与网关57392保持。原脚本仅检查一页，现扩为全部可加载页；冷启动标题先显示、会话尚在打开时点击返回会被busy保护忽略，脚本已改为等真实消息挂载后再操作。
- **独立回归：**[浏览器报告](../../artifacts/remote-history-position-web.json)用生产定位函数与真实DOM覆盖前插、尾部同时增长、用户滚动、切换会话、首锚点移除、读取失败六项，包含自动锚定恢复。它不替代真实模型流与网络竞争；263项Node测试、Web构建、[APK/lint构建](../../artifacts/history-position-build.log)通过。当前已验证的是本机现有测试会话全部历史，不能据此宣称任意超长会话、在途断线/乱序或全部R05完成。

## 插件Worker生命周期（2026-09-25）

- 状态：代表性独立测试包已通过真实电脑安装与MuMu验收，完整R13及设备撤销矩阵未完成。维护角色：DSH Mobile项目协作Agent。来源：[测试包](../../tests/fixtures/worker-lifecycle-plugin/README.md)、[真实入口脚本](../../scripts/verify-plugin-worker-android.mjs)。本轮仅修正验收工具，不改产品代码或APK。
- 真实路径：手机原管理入口安装测试包，聊天局部卡片创建独立Worker；脚本通过电脑原package-local chunk路由与现有认证资源连接加载，线程再fetch自身入口脚本。三次均HTTP200、2723字节、命中固定标记，线程内无普通聊天或Remote原生桥。未读取Key、发送模型消息或执行安装脚本。
- [11:05:13 UTC成功报告](../../artifacts/plugin-manager-worker-lifecycle-android.json)：停用线程退出、重新启用成功、主动断开线程退出、断开后旧资源502且零字节、重连重新创建、卸载退出全部通过；原聊天草稿保留。卸载后package.json、pnpm-lock.yaml、pnpm-workspace.yaml解析内容与测试前一致，页面错误为空，已回原聊天。[运行截图](../../artifacts/plugin-worker-running-android.png)已核对。11:05:44 UTC临时管理权限已收回，[真实拒绝报告](../../artifacts/plugin-worker-final-denied-android.json)通过；保留聊天绑定，031仍未批准。DSH43052/网关57392未重启。
- 排查结论：初版验收包错误使用`ctx.on('dispose')`，当前Cordis无此通用事件，清理必须由`ctx.effect(() => cleanup)`登记。[RED](../../artifacts/plugin-worker-red-android.json)在卸载后仍可从真实线程读取tick=224，不能仅凭重新连接调试器后的空Worker列表认为已退出。修正测试包后三个释放入口均通过。另一次[清理等待失败](../../artifacts/plugin-worker-cleanup-race-android.json)是脚本把确认框关闭误当卸载完成；现在等待管理页回列表才检查磁盘配置，未放宽配置恢复断言。
- 复验命令：设置`DSHM_RUN_LIVE=1`、`DSHM_ANDROID_SERIAL=emulator-5554`、`DSHM_PROFILE_DIR`为目标web profile后执行`node scripts/verify-plugin-manager-android.mjs worker-lifecycle`，需要同一设备临时管理权限，结束后收回。测试包不进入正式APK。验收覆盖正常注册清理的插件，不能宣称强制终止未注册清理的任意第三方线程，也不替代在途下载/设备撤销竞争。

## 原生排队资源的连接隔离（2026-09-25）

- 状态：缺陷已复现并修复，新版APK已覆盖安装；完整R13及撤销矩阵继续实施。维护角色：DSH Mobile项目协作Agent。来源：[RemoteResources](../../android/app/src/main/java/dev/dshmobile/validation/RemoteResources.kt)、[原生回归](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteResourceChecks.kt)、[独立测试入口](../../android/app/src/androidTest/java/dev/dshmobile/validation/OrdinarySecurityInstrumentation.kt)。
- **原因与修复：**资源最多四路并发，旧实现仅清理已登记的流。第五个请求等待空位时不在清理集合中，断线释放空位后可继续发送；不能仅依赖发送器暂时不可用，因为新连接可能已经恢复。现在排队前记录代次，登记/发送与断开互斥；断开使旧代次失效，旧请求归还空位并返回502，不发送到新连接。流量确认与取消也核对所属代次。采用资源层统一生命周期门控，避免分别在每个插件/Worker中补网络重试规则，不改认证协议或资源允许名单。
- **确定性原生证据：**旧实现连续两次在`queuedConnectionChange`的“旧排队请求应返回502”断言失败，见[首次RED](../../artifacts/resource-generation-red-android.log)与[重复RED](../../artifacts/resource-generation-red-repeat-android.log)。修复后[GREEN](../../artifacts/resource-generation-green-android.log)通过：旧请求未发送，旧流读取失败，新连接仍可占满四个槽；既有分片、消费确认、结束帧缓存清理、主动关闭和非法帧检查也通过。这是实际Android资源类的独立样例，不连接真实网关，不冒充真实设备撤销或第三方Worker验收。
- **真实入口：**10:50:33 UTC，[MuMu报告](../../artifacts/resource-generation-real-android.json)验证正式Remote插件列表及断开/重连，插件状态保持、无重复样式、无残留加载script；22条当前页模型回复、一个输入框、无iframe，页面及失败资源为空。原DSHM_LANGUAGE_DRAFT_20260925草稿保留，[截图](../../artifacts/resource-generation-real-android.png)已核对。未发送模型消息、未改Key/地址/设备权限或电脑配置。DSH43052、网关57392保持运行，031仍未批准。
- **构建与复验：**APK、测试APK及Android lint通过，见[构建日志](../../artifacts/resource-generation-green-build.log)。使用项目`.tools/gradle-8.9/bin/gradle.bat --offline`及项目Gradle缓存；首次wrapper尝试另行下载发行包，核验并结束该下载进程后改用已安装的同版工具，没有并行构建。原生专项命令为`adb -s emulator-5554 shell am instrument -w -e resourcesOnly true dev.dshmobile.validation.test/dev.dshmobile.validation.OrdinarySecurityInstrumentation`，必须核对PASS及`INSTRUMENTATION_CODE: -1`，不能仅看adb退出码。真实入口复验使用`DSHM_ANDROID_SERIAL=emulator-5554 node scripts/verify-remote-mobile-android.mjs --plugins`（PowerShell分开设置环境变量）。
- **剩余范围：**真实第三方Worker资源加载/销毁、完整在途设备撤销及R01–R16其他功能不由本项覆盖。主绑定保留聊天权限，独立031保持等待批准；本轮未新增授权。

## 此前专项记录

应用阶段取消专项已通过（2026-09-25 10:40 UTC）：MuMu原管理页真实安装进入applying后，重建页面并从最近操作请求取消，原电脑返回too-late；提示经过手动刷新和轮询仍保留，释放测试队列后原记录显示已完成且提示消失。两个临时测试包已从手机卸载，三份profile配置恢复，页面错误为空。管理权限已收回，聊天与031保留；DSH43052/网关57392未重启，无遗留写入锁。仅增加验收脚本/测试包，产品代码和APK未改。完整Remote未完成，见[证据及范围](./plugin-management-current.md#应用阶段取消过晚已实测)。下方为历史批次，以较新结论为准。

未知结果专项已通过（2026-09-25 10:17 UTC）：MuMu一次真实下载途中强制结束DSH，同一WebView恢复后显示原操作“无法确认结果”，不重复安装；profile三份配置保持、下载连接关闭、页面错误为空。已清理核验后的遗留下载进程和写入锁，DSH43052/网关57392正常；临时管理权限收回、聊天与031保留。修改仅为验收脚本，未改APK或产品代码。此项不包含Windows整机重启或自动清锁；见[完整证据与限制](./plugin-management-current.md#下载中强制结束dsh后的未知结果已实测)。

服务恢复复核（2026-09-25 09:31 UTC）：用户已恢复原源码DSH41308，网关57392保持运行；遗留临时管理权限已收回，聊天授权和031待批准状态保留。新版APK已覆盖安装，真实MuMu管理权限拒绝、专用会话当前页22条回复、一个输入框/无iframe、原草稿保留均通过，页面和资源错误为空。profile三份配置哈希未变，无模型请求或配置写入。服务恢复阻塞已解除；在途安装跨电脑重启的unknown专项及applying竞态尚未完成。详见[最新证据](./plugin-management-current.md#服务恢复与新版apk复核)，下方离线/待安装/待清理描述属于历史批次。

未确认记录补验（2026-09-25）：已修复旧列表覆盖终态、跨绑定迟到响应、读取拒绝保留旧操作按钮，以及取消过晚提示被刷新吞掉/延续到未知结果的问题。手机263项测试、内置浏览器实际组件隔离回放及Web构建通过；不是实际DSH重启验收。DSH3080仍未监听，本轮未恢复服务或安装APK，临时管理权限待恢复后收回；见[证据与交接](./plugin-management-current.md)。

重启结果处理（2026-09-25）：手机已修复电脑回执清空后静默丢失未确认操作的问题，按绑定保留本次进程内摘要并显示未知结果，不自动重装；自动回归和构建通过，未安装新版APK。真实测试已停DSH19608并观测手机断线，但恢复服务命令被自动审批阻止，结果恢复未验收。测试下载进程已自行退出、三份profile哈希保持，网关57392运行；等待用户`pnpm dsh web`恢复，**本轮临时管理权限仍需在恢复后收回**。详见[当前修复、证据与交接](./plugin-management-current.md)。下方DSH19608运行中/权限已收回描述属于此前批次，不能作为当前状态。

脚本执行取消补验（2026-09-25 08:46 UTC）：MuMu通过原管理页批准专用脚本，在日志确认真实PID存活后取消，取消确认返回前进程退出，包清单/锁文件逐字节恢复，操作回执“已取消”。测试批准清理，08:46:11 UTC管理权限收回且手机拒绝管理；原绑定、031、Key/地址保留，DSH19608/网关57392未重启。本轮仅补验收脚本/测试包。首次日志折叠引发的观察超时已有清理和独立留证，详见[当前证据](./plugin-management-current.md)。applying竞态和电脑重启未知结果继续验收，完整Remote未完成。

插件异常补验（2026-09-25 08:36 UTC）：现有0.1.40及正式APK通过MuMu安装脚本阻止→明确批准→固定标记执行→卸载清理；另通过真实下载途中收回管理权限、原管理界面销毁、聊天权限拒绝访问，临时恢复后只读原失败回执。原profile恢复，测试包/批准已清理，08:36:18 UTC最终再次收回管理权限。只修改验收脚本/测试包，未改产品代码、Key或地址；DSH源码19608、网关57392保持。电脑重启未知结果、脚本执行中取消及applying竞态仍待验收，详见[当前证据](./plugin-management-current.md)。下文各阶段待办以此后的验证结果为准，完整Remote未完成。

插件长安装回执（2026-09-25 08:18 UTC）：0.1.40、新网关与APK已安装，MuMu45秒下载跨网关重启后可取消，Remote页面重建后可查询并取消另一笔pending；两次下载退出且三份profile配置哈希保持。手机不重发写入，完成回执保留1小时，电脑/插件重启清空。后端54/插件109/手机258项、类型/构建/APK/lint通过，真实PostgreSQL项未启用。权限已收回且手机拒绝管理；DSH源码19608、网关57392，原Key/绑定/031保持。首次旧运行时失败及清理已有记录；在途撤权、脚本批准等继续实施，见[当前证据](./plugin-management-current.md)。

安装取消修复（2026-09-25 07:52 UTC）：真实MuMu复现Windows取消后pnpm子进程残留/30秒结果未知。新增plugin-install-cancel-v1，使用原进程库整树取消；三文件已安装，DSH源码PID21580、网关60668、插件0.1.39/App保持。07:50:25 UTC两种取消均停止真实下载、保留原包清单/锁文件/脚本批准配置；7项进程/安装恢复回归和严格类型检查通过。07:51:46 UTC权限已收回、手机拒绝管理，聊天/031保留。长安装的30秒RPC超时、断线/在途撤权及脚本批准等仍待处理，详见[当前证据](./plugin-management-current.md)。下方PID和时间为历史，完整Remote未完成。

插件页面状态修复（2026-09-25 07:32 UTC）：受维护client-entries-v1及新版APK已装入本机，DSH源码PID7536、网关60668。MuMu组件关闭/恢复均保留详情页，电脑同步；安装/包启停/卸载回归通过，测试包已清理。07:31:28 UTC已收回管理权限且手机拒绝管理，保留聊天授权。7项兼容补丁回归、严格类型检查、手机253项、原组件回放、Web/APK与Android lint通过。详见[当前证据](./plugin-management-current.md)。下方07:13的导航问题为修复前历史，完整Remote仍未完成。

插件管理补验（2026-09-25 07:13 UTC）：既有0.1.39及新版App完成单组件关闭/恢复，电脑同步且包始终启用；故意无效的本地归档触发真实pnpm失败，原界面显示详情、返回编辑正常。发现组件变化重建手机插件树、详情退回列表，尚未修复，不能视为完整交互通过。测试包已卸载，管理权限已收回，07:12:47 UTC手机拒绝管理，聊天授权保留。仅测试脚本/文档变化，详见[当前证据和后续修复边界](./plugin-management-current.md)。

网页搜索配置增量（2026-09-25 07:00 UTC）：插件0.1.39、新网关/App已安装；次数沿用原表单，搜索Key/地址接既有原生窗口和独立站点确认。MuMu次数5→6、电脑同步、恢复默认5通过；真实Key状态/窗口取消、地址核对取消通过，无Key/地址写入或搜索请求。管理权限已收回，06:59:47 UTC手机重连拒绝管理。后端54/插件105/手机253项及构建/lint、原生隔离检查通过；完整Remote继续实施，详见[配置证据](./plugin-management-current.md)。当前DSH PID71516、网关PID60668，以下版本/PID为历史记录。

Subagent配置增量（2026-09-25 06:34 UTC）：插件0.1.38、新网关/App已安装，原Subagent整卡接固定限制及模型授权投影。MuMu深度1→2、电脑同步、恢复默认1与模型目录/勾选草稿退出丢弃通过；未保存真实模型授权、未改并行8、未发送模型消息。管理权限收回后手机重连拒绝管理，保留聊天授权和绑定。后端53/插件103/手机251项及构建/lint通过，模型授权真实写入、新会话生效和完整Remote仍待验收，见[配置证据](./plugin-management-current.md)。当前DSH PID62484、网关PID65060，以下PID/版本为历史记录。

插件配置增量（2026-09-25 06:14 UTC）：0.1.37与新网关/App已接原终端及Agent循环数值表单。MuMu超时120000→120001、电脑同步、恢复120000默认继承通过；输出上限64000、并发10只读。临时管理权限收回后手机重连拒绝管理。三端测试通过，真实在途异常、其他配置及完整Remote仍待完成，见[当前配置边界](./plugin-management-current.md)。当前DSH PID61784、网关PID69592，后续历史段落的PID和版本不再表示当前进程。

电脑插件管理增量（2026-09-25 05:52 UTC）：插件0.1.36、新网关与正式APK已安装，DSHM自有全屏容器复用原插件管理局部页，真实MuMu包列表、安装/启停/卸载及电脑同步、安装弹窗取消、Android返回与权限收回后拒绝通过。修复缩放被焦点横滚导致左侧裁切。临时测试包与管理授权已清理；当前DSH PID68016、网关PID14184。各插件配置与异常仍待专项，详见[电脑插件管理记录](./plugin-management-current.md)，完整Remote未完成。

原生电脑 Key 语言增量（2026-09-25 05:27 UTC）：生产密码窗口的标题、提示、校验、二次移除确认和保存中状态接手机中英资源，不重建输入或改变在途锁。独立无价值输入检查通过；MuMu 真实授权入口即时切语言后取消、未保存电脑设置草稿保持/关闭后原值重读通过，未读写 Key。临时管理权限已收回，中文/草稿恢复。APK/测试 APK、lint、原生检查和脚本语法通过；真正英文配置提交与其他原生窗口仍待专项，完整 Remote 未完成。见[边界与证据](./appearance-current.md)。

原生提醒语言增量（2026-09-25 05:18 UTC）：Android 提醒设置、分类/状态、横幅和系统摘要接入手机中英文资源。MuMu 同一打开窗口实时切换、两个设置入口、真实英文后台完成通知原地切中文（相同通知 key/PendingIntentRecord）、回对应聊天清除后不重放通过；四类开关与原中文/草稿恢复。正常 APK/测试 APK 构建、lint、原生外观资源及通知账本检查通过。前台横幅/锁屏/通知冷启动语言、其他原生窗口和完整 A04/A05 仍待验收；完整 Remote 未完成。详见[通知记录](./notifications-current.md)。

模式与导航语言增量（2026-09-25 05:03 UTC）：Agent模式/权限确认复用上游中英文字典；技能、子会话、工作区管理和日志导出固定标签/本地错误接入共享语言。四项生产组件回放核对确认保持/目录版本失效、原提交参数、工作区改名草稿、技能搜索与原文、自定义模式及inactive子会话不冒充完成。MuMu真实已开始模式锁定、权限确认勾选跨语言后取消（保持原Read Only）、33个技能搜索、实际空子会话刷新、无管理授权工作区提示、原日志导出到系统窗口后取消通过。246项JS、Web/APK/lint通过，正常新包安装，中文/草稿恢复；无权限/模式/工作区写入或模型请求。英文实际写入和非空子会话专项仍待验收；详细边界见[外观记录](./appearance-current.md)，完整Remote未完成。

电脑设置与插件语言增量（2026-09-25 04:52 UTC）：电脑设置、Key状态、服务地址确认和插件列表接入共享手机语言。六项生产组件隔离检查通过：草稿/确认保留且不重新读取、地址原文及HTTP提示、取消不保存、原设置提交值/快照和未知结果锁定、自适应用户覆盖/作者默认、管理权限边界。MuMu实际59个插件条目跨语言保持身份/状态/布局选择，未授权电脑设置英文提示正确；未变更授权或电脑配置。246项JS、Web/APK/lint通过，新包安装，恢复原中文及聊天草稿。已授权设置表单的英文真实链路与原生密码窗口尚未验证；其余详情及完整Remote继续实施。详见[记录](./appearance-current.md)。

目标与任务语言增量（2026-09-25 04:41 UTC）：目标摘要/编辑、后台任务/停止确认、输出记录和定时任务接入手机语言，重复频率/日期按语言格式化，目标/任务/提醒与原时间戳保持。MuMu实际读取目标并填写未提交编辑，跨语言保留；当前真实后台任务为空、定时功能未提供，两个状态英文通过。四项生产组件隔离回放核对版本失效、提交原值、停止回执/最终状态区分及离线定时投影，不能代替真实电脑写入。246项JS、Web/APK/lint通过，原中文/聊天草稿恢复，无新目标、任务、模型消息、电脑配置或授权变化。详见[记录](./appearance-current.md)，完整Remote继续实施。

文件与命令语言增量（2026-09-25 04:31 UTC）：文件/差异/命令及共享独立输出窗口接入手机语言。MuMu 读取既有专用聊天的命令、历史工具差异与最新文件、过期轮次快照、PDF/图片/损坏图片/HTML，通过中英文切换；保留全屏、内容、资源地址和 HTML 计数。真实复现并修复 HTML 打开时原生误阻父页面外观同步；预览子页面仍无原生桥和父 DOM 访问。正常 APK 已安装，246 项 JS 与 Web/APK/lint 通过，原中文/草稿恢复；无新模型请求、命令、文件写入或授权变化。后台输出读取、Office/下载/分享的英文专项尚未重新验收，其他详情及原生语言继续接入，见[证据与边界](./appearance-current.md)。

聊天卡片语言增量（04:08 UTC）：工具记录、审批/提问/计划确认、队列和计划模式面板接入手机语言，协议值及电脑内容保留原文。MuMu英文真实问题提交后，电脑原记录核对选项“保留原文”和补充“保留中文补充”，工具完成状态与计划Off读取通过。六场景组件回放验证批准/拒绝、计划批准/修改及失败锁定；该隔离回放不代表真实英文审批已执行。246项JS与Web/APK/lint通过，原中文/草稿已恢复，无Key/权限/计划设置变化。其余详情/原生语言仍待接入，见[记录](./appearance-current.md)。

语言 A05 增量（03:58 UTC）：手机语言通过原生固定枚举同步至 Remote 的连接/配对页、首页、主要菜单、共享聊天组件及原 LocaleRuntime；已有页面即时切换、不重建连接。MuMu 中英文切换、原评价插件标签更新、真实标题/正文不变与草稿保留/恢复通过；246项JS、原生持久化/旧字段兼容、恢复回放和构建检查通过。原中文已恢复，无模型发送或权限/电脑配置变化。详细功能页与原生窗口翻译仍未完成，实际语言通知冷入口未单独测试，见[语言范围与证据](./appearance-current.md)。

手机外观 A05 增量：普通聊天主题/字号已通过原生固定字段镜像到 Remote，MuMu 深色17px、浅色12px复用页面、已加载真实聊天/菜单，以及进程结束后点击已有通知直接冷启动 Remote 均通过。测试后已恢复跟随系统14px；246项JS测试、外观原生检查、五场景恢复回放、Web/APK/lint通过。完整语言和原生窗口外观仍待接入，详见[外观记录](./appearance-current.md)。DSH/网关/Key/地址/设备权限未改。

通知 A04 正在验收：[通知接入状态与源码依据](./notifications-current.md)。插件0.1.35、Gateway待办补丁和原生提醒APK已安装；本机DSH PID62904（3080）、网关PID66472（8787）。手机现由应用进程独立建立只读提醒连接，MuMu仅冷启动普通聊天即收到真实前台横幅/后台系统通知及点击通过；主动断开跨进程保持、离线冷启动恢复、结束进程后不通知/不唤醒及重开不补历史通过。新增真实提问/审批通知和手机答复同步、问题分类关闭抑制及恢复、电脑处理后通知清除、普通生成停止不误报通过；审批测试的目标在会话工作区外，写入被沙箱拒绝，后续完全访问请求已拒绝，不能记为写入成功。Android13+权限、异常结算及完整撤销仍未完成。下方旧现场记录保留历史事实，操作前核对现行进程。

- 状态：实施中，**未完成完整 Remote，也未完成正式 Android 入口验收**。

通知异常补验（03:24–03:29 UTC）：MuMu收到通知后新连接不可用，点击进入自有连接失败页；恢复本机映射并手动重试后回到正确聊天，问题仍待回答，手机提交后电脑同步。另从普通聊天设置明确重启提醒连接，在断线期间由电脑处理问题；恢复映射后手机自动重连并清掉旧通知，不补发完成提醒。DSH/网关未重启，ADB8787已恢复，Key/地址/权限/开关未改。详见上方通知记录；不代表撤销或所有在途异常已通过。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-09-25。
- 范围：[已确认功能清单](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md)，对应 KKC-17/18/19 及 KKC-20 的 Remote 整合部分。
- 上游基线：只读 `deepseek-harness`，commit `ddefc45fbc7f8e46dd73185e68295696d1297887`，`0.1.6-alpha.2`。

## 当前重构约束（2026-09-23 用户重新确认）

用户已授权彻底重构 Remote 并接入真实电脑。此前整套电脑客户端的挂载方式被否定；下文旧通道测试保留为历史证据，不代表新手机入口已通过。目标与 R01–R16 范围不缩减。

当前现场（2026-09-25）：插件0.1.34、新网关和APK已安装。原profile `pnpm dsh web --no-open` PID10540（3080）、网关PID32256（8787，搜索断线验收后已按原命令恢复），固定基线兼容补丁保留。01:06–01:07 UTC搜索同页真实网关中断/自动重连通过，关键词/标题匹配保留、无旧摘要和假空结果，回原聊天无草稿；见下方搜索节。00:35:52 UTC MuMu历史文本/PNG附件电脑副本打开、取消不落盘、编辑副本不改原件、Office准备/取消通过；Notepad/Photos真实窗口已核对，手机回“DSHM Remote 联调提示”。未发送新模型消息，Key、地址、遥测和设备权限未改，上游参考只读。启动日志 `artifacts/dsh-attachment-desktop.stdout.log` 含登录链接，不输出正文。旧内存任务随重启失效，不能沿用旧seed实时补读。Office六格式副本已逐一核对原件摘要；docx已核对Word文件窗口，xlsx/xls请求超时显示结果未确认，doc/pptx/ppt仅收到系统接受请求，未取得对应文件窗口，不能标为全部打开通过。当前附件副本8槽均占用，后续测试先核对缓存，不重复点击制造副本。第三方来源、真实在途撤销、其他安装形态和完整R01–R16仍未完成；评价临时配置、网页访问边界及独立031批准仍待答复。下方PID为历史证据，操作前核对。

### 源码启动交付与真实手机输出 · 2026-09-25

**在途设备撤销准备，尚未批准/验收：**当前代码用 `-PisolatedPairingTest=true` 构建独立UID的 `dev.dshmobile.validation.pairingtest`，复制至 `artifacts/dshm-output-revocation-isolated.apk` 并安装；原App未覆盖。`app/build/outputs/apk/debug/app-debug.apk` 此时属于独立包，后续更新主App必须先按默认参数重新构建，不能误装这个产物。通过电脑公开插件页生成一次性链接，独立App领取为“DSHM 输出撤销验收031”，指纹 `chmfoLTBXfBStqjL82OZu-g4ror_eodgIR8JPX3HMCA`；[领取报告](../../artifacts/output-revocation-pair-claim-android.json)确认等待批准且没有会话入口。已向用户申请仅聊天权限、读取专用测试会话后在请求途中撤销；尚未获回复，未批准、未授管理权限，日常绑定保持。

新[本机测试代理](../../../backend/scripts/verify-device-output-proxy.mjs)只转发9878至现有8787，不启动/更改网关，不记录凭据或正文。它暂缓完整数据帧，原ping/close控制帧立即通过，真实撤销close到达时丢弃已暂缓数据；上限512KiB。分帧/扩展长度、暂停/继续、close原字节保留及丢弃的[2项工具测试](../../../backend/scripts/held-websocket-frames.test.mjs)通过，仅证明故障工具，不算产品撤销通过。代理启动检查后已通过控制端停止，session52030确认exit0；ADB反向端口未改。DSH20288/网关38324保持。

续接时使用[配对脚本](../../scripts/verify-remote-pair-valid-android.mjs)的 `DSHM_PAIR_CASE=output-revocation` 独立证据前缀；批准后启动上述代理、将模拟器tcp8787反向至电脑tcp9878，使新测试连接经过代理，公开origin仍为原8787（DPoP严格核对地址，不能换成9878配对）。先关闭/重开独立App确保新连接，再运行connected；[撤销观察脚本](../../scripts/verify-output-revocation-android.mjs)的hold只读取已归档“DSHM 停止输出联调1790285080365”中pwsh-2，暂停错误输出响应并确认页面正在读取。随后在电脑撤销准确测试身份，再运行revoked验证页面释放、旧响应丢弃和重连拒绝。最后恢复ADB tcp8787→tcp8787、停止代理、回到主App并核验原绑定；整个流程尚未执行。脚本语法检查通过，不以准备完成代替实测。原会话owner回收及其他R01–R16仍可独立推进。

**停止后读取补充（源码入口）：**[Android验收脚本](../../scripts/verify-stopped-job-output-android.mjs)从正式自有页面新建DSH-TEST专用会话“DSHM 停止输出联调1790285080365”。一次提示只启动两个有时限的原pwsh后台任务，打印标记/进程ID并等待，不读写文件或访问网络。手机先取消停止确认，验证原进程仍在；随后确认停止pwsh-2，电脑回传“已取消”且原进程44920已退出。原stdout及中文stderr保留，实时/从头查看一致、没有末尾完成标记；同会话pwsh-3的进程31500此时仍运行、持续输出，随后正常结束。第二条模型提示只读原job_output，仍读到被停止任务的输出。

2026-09-24 21:24:40–21:26:27 UTC的[主验证](../../artifacts/stopped-job-output-prepare-android.json)、[模型读取](../../artifacts/stopped-job-output-model-read-android.json)、[清理](../../artifacts/stopped-job-output-cleanup-android.json)均errors为空；运行中/停止截图已查看。已归档并返回原联调聊天，DSH20288/网关38324及Key/配置/授权保持。首次只读inspect因Remote页面尚未打开而失败，补齐普通聊天抽屉进入Remote后继续，没有发送重复消息；验证器随后增加未知停止结果仅观察、不重发保护，语法检查通过，该保护分支未单独注入中断实测。本批只有验证脚本和文档变化，没有重新构建App。

此项证明用户停止任务后的输出保留与同会话其他任务隔离，不等同于会话owner回收。原[归档实现](../../../deepseek-harness/packages/workspace/workspace/src/index.ts)只保存归档索引，不能用归档替代owner销毁验收；核心服务卸载/活跃owner回收、跨会话销毁隔离及在途设备撤销仍保留待办。

[启动修复](../../../plugin/compatibility/source-start/README.md)保留原profile的依赖版本选择，统一同一安装同一包的源码身份；同时补齐当前Node/tsx版本的Worker转换器注册。五项实际模块/工具/Worker回归、四项安装器回归通过；源码安装器既有五项副本恢复回归继续作为依据。实际安装DSHM模块导入及真实DSH启动均通过，不能据此宣称任意第三方Worker或完整插件生命周期通过。

[Android脚本](../../scripts/verify-independent-job-output-android.mjs)使用独立 `source-start` 证据前缀，原App绑定自动恢复后在DSH-TEST新建上述专用聊天，只要求一次原pwsh后台打印中文stdout/stderr、等待35秒和结束标记。[run](../../artifacts/source-start-job-output-run-android.json)确认进程退出前已读到首段、错误输出可读、完整历史一致并支持全屏；[model-read](../../artifacts/source-start-job-output-model-read-android.json)确认原模型job_output仍读到全部内容。[cleanup](../../artifacts/source-start-job-output-cleanup-android.json)确认归档并返回原聊天，均errors为空，运行中/完成截图已查看。三个现场plan确认启动修复、10源码和22编译文件全部patched。剩余在途撤销、活跃owner/核心服务热重载、Bash/sandbox及其他安装形态继续按完整矩阵推进。

### 电脑独立重启与后台任务代次 · 2026-09-25

**插件热重载的真实手机补充：**[验收脚本](../../scripts/verify-plugin-reload-output-android.mjs)复用已归档的“DSHM 独立输出联调1790280969506”及当前pwsh-1，无新模型提示或任务。20:36:26–20:37:01 UTC从DSH公开插件页关闭/启用DSH Mobile，DSH24256和网关38324均未重启，Jobs注册表保留。MuMu离线仍显示原输出；恢复后旧reader提示任务已变化、不能推进游标；关闭输出窗口重新进入同一任务，stdout/stderr可完整读取，随后返回原联调聊天。[报告](../../artifacts/plugin-reload-output-verify-android.json)errors为空，两张截图已查看。插件最终启用、原绑定及权限未变。首轮脚本离线文案定位错误后中止并恢复插件，第二轮按不存在的aria-label查询弹窗超时，已保留[定位失败报告](../../artifacts/plugin-reload-output-locator-failure-android.json)；最终改用真实testid和角色定位通过，未修改产品代码。该项是远程插件热重载，不是核心Jobs服务重载或活跃owner回收，后两者手机全链路仍待验收。

**源码交付：**[十文件源码安装/恢复器](../../../plugin/compatibility/background-output/install-source.mjs)及5项文件副本回归支持LF/CRLF精确恢复、未知修改/版本/越界拒绝；同版源码和编译补丁可共存恢复。当前已完成现场安装及原源码启动真实输出验收，详见上方当前记录和[补丁说明](../../../plugin/compatibility/background-output/README.md#源码补丁交付)。

补充原生生命周期证据：2026-09-24 20:27:35–20:27:39 UTC，[独立验证脚本](../../../plugin/compatibility/background-output/verify-native-lifecycle.mjs)使用实际安装包及三个真实 PowerShell 进程，确认原 owner scope 回收终止自己的进程并删除记录、保留另一 owner；Jobs 服务卸载终止剩余进程并销毁旧 JobControl，重载后新代次拒绝旧请求，即使任务编号复用仍隔离，新输出可读且不消费模型位置。[报告](../../../plugin/artifacts/compatibility/background-output/native-lifecycle-verification.json)errors为空。此项在独立 Cordis 树执行、Agent 为内存注册对象，不调用模型、不操作当前 DSH/网关/App/授权；不能替代真实 Loader 和手机界面的服务热重载验收。

- 源码确认原任务注册表仅保留在进程内，owner/service销毁会清理任务；插件JobControl每次服务注入生成独立generation。先前手机只在原生socket ready时协商，电脑单独重启、中继socket仍在时会继续使用旧能力。因此不能只验证中继重启或手动重新进入App。
- [RemoteModel](../../src/remote-model.mjs)现在每个原Connection世代重新调用真实协商，在结果核验前保持连接中；旧世代取消时同时取消其能力读取。[Transport](../../src/remote-transport.mjs)检查取消信号和原生socket代次，迟到能力不得覆盖新结果。沿用原Gateway恢复订阅，不重新装载整个手机App，也不自动重发写操作。
- [真实重启脚本](../../scripts/verify-large-job-output-android.mjs)新增host-restart：20:13:55 UTC在已归档大输出会话读到65,536/400,036字节，保持网关38324运行，DSH54652停止后原命令恢复为24256。恢复后旧输出提示任务已变化，点击重新读取不改变字节/内容，任务列表为空。报告[host-restart](../../artifacts/large-job-output-host-restart-android.json)errors为空，截图已查看。只证明电脑进程更换后的清空/失效，不冒充活跃owner独立回收。
- 同一个App/Remote连接未重开，返回原聊天后通过[原入口脚本](../../scripts/verify-independent-job-output-android.mjs)创建专用会话“DSHM 独立输出联调1790280969506”，只调用一次pwsh后台打印中文、stderr、等待35秒及结束标记，不访问文件或网络。新进程任务pwsh-1的运行中、标准/错误输出、完成后从头读取、全屏无横向溢出均通过，证明旧能力不会阻断新任务。[run报告](../../artifacts/post-restart-job-output-run-android.json)20:16:09 UTC、[cleanup](../../artifacts/post-restart-job-output-cleanup-android.json)20:17:13 UTC均errors为空，已归档并回原聊天。使用独立artifact前缀，未覆盖此前独立输出证据。
- 219项手机Node测试通过，新增只发生Host断线时协商代次确实更新、核验完成前任务操作不可用、取消后迟到协商不能覆盖当前结果；原组件完整回放、Web/APK构建、Android lint通过。上游tracked状态为空，未改电脑插件/后端/配置/授权。完整Remote仍在实施。
- 后续仍须覆盖真实在途设备撤销、活跃会话owner销毁/服务热重载、连续复杂弱网、Bash/系统sandbox、其他安装形态及完整R01–R16；旧大输出脚本再次run会新建模型任务，只读read/reconnect等不能在重启后沿用已失效seed。

### Q20：断线期间保留阅读 · 2026-09-25

- 已实现[问卷第20项](../design/问卷结论与追问.md)：使用中中继断开保留真实聊天投影、插件作用域及现有页面节点，不再切连接页；原DSH Connection/Gateway取消旧世代交互并恢复只读订阅。重新协商后沿用当前模型，核心模块变更仍走受控重建。另建静态聊天副本会产生双份状态和插件生命周期，故没有采用。
- [RemoteApp](../../src/RemoteApp.jsx)仍先核对设备有效性，随后连接/协商；主动断开、撤销、权限改变或非法协议结束页面并停止自动恢复。首次连接失败没有可保留的模型，仍显示连接页；普通聊天不受阻。[Transport](../../src/remote-transport.mjs)只给明确载体断线的订阅错误加恢复标记，业务拒绝和RPC写入不重放。
- [离线提示](../../src/ui/RemoteOfflineStatus.jsx)用于[聊天页](../../src/ui/RemoteWorkspace.jsx)和[输出窗口](../../src/ui/RemoteLiveJobOutput.jsx)，显示最近成功接收数据的本机时间；离线编辑草稿不会刷新此时间。离线不开放发送/旧审批，也不释放当前聊天去加载其他会话；已读输出保留原游标，重连后仍需显式重新读取。
- [MuMu脚本](../../scripts/verify-offline-reading-android.mjs)对真实原生桥分别验证聊天和输出：原网关停止期间持续检查15秒，同一DOM节点、原文摘要及时间不变；聊天滚动位置不变、发送禁用，恢复后草稿仍在。报告[chat](../../artifacts/offline-reading-chat-android.json)20:01:00 UTC、[output](../../artifacts/offline-reading-output-android.json)20:02:35 UTC均errors为空，截图已查看。输出恢复后显式读取EOF保留最后一页；另重读400,036字节7页内容，SHA256与原记录一致。
- [initial](../../artifacts/offline-reading-initial-android.json)20:05:24 UTC：网关停止时强制重开App，首次Remote连接失败正确显示连接页，无旧工作区/离线阅读页，返回普通聊天可用。[disconnect](../../artifacts/large-job-output-disconnect-android.json)20:04:55 UTC：主动断开10秒没有自动重连，手动连接成功，专用消息仍仅1条。[finish](../../artifacts/large-job-output-finish-android.json)20:07:00 UTC回到原联调聊天。
- 217项手机Node测试通过（包含新增真实Transport+原Connection/Gateway的中继断开/草稿/时间不前移/只读订阅恢复回归）；原组件完整回放、Web/APK构建及Android lint通过。没有更改DSH、插件、网关代码或权限。首次主动断开验收脚本未切已归档筛选、首次清理脚本未识别已展开抽屉，均仅修正脚本并重测通过，失败不计入产品验收。
- 本轮仅验证本机中继停止/恢复及首次失败，不能替代真实在途撤销、并发审批、连续复杂弱网、Host任务回收等完整异常；R01–R16仍实施中。

### 输出请求在途的断线、超时与迟到响应 · 2026-09-25

- 新增[本机TCP故障代理](../../../backend/scripts/verify-relay-fault-proxy.mjs)：原网关临时监听8788，PUBLIC_ORIGIN及原配置不变；代理在8787逐字节转发，控制端仅监听本机18793。只识别设备socket的请求行，暂存最多512KiB原始响应，不改协议/鉴权、不记录凭据或正文，不进入生产产物。与仅在两次读取之间重启相比，此方式能先确认真实响应字节已被截住，再制造断线/迟到；属于受控网络故障注入，不是物理弱网结论。
- [MuMu脚本](../../scripts/verify-large-job-output-android.mjs)复用已归档的“大输出联调1790277256601”及原pwsh-3，无新模型请求/新任务/取消归档。19:41:02 UTC的[inflight报告](../../artifacts/large-job-output-inflight-android.json)确认下一段处于读取中，代理截住65,536字节后丢弃并断开；手机恢复时已确认游标仍为65,536，重新读取后完整400,036字节逐字及SHA256一致。
- 19:42:47 UTC的[timeout报告](../../artifacts/large-job-output-timeout-android.json)：截住响应约35.4秒，手机超时后保留原内容/游标；释放迟到字节仍未改变页面，显式重试后完整内容校验一致。19:44:45的[late报告](../../artifacts/large-job-output-late-android.json)：截住响应后关闭输出窗口、返回原聊天，再释放旧字节；当前聊天没有被旧输出覆盖，窗口不重新弹出。三份报告errors为空，最终输出截图已查看。
- 首次late脚本误判重连后的列表仍为归档筛选，等待“查看最近聊天”失败；修正为核对当前菜单后选择，未增加生产兜底或重复任务。finally恢复代理转发，最终重测通过。
- 新增[网关输出生命周期回归](../../../backend/tests/remote-output-lifecycle.test.ts)3项：真实HTTP配对/批准/票据与WS/SQL鉴权，覆盖在途撤销、取消后相同客户端请求id复用、权限变化及重连；旧Host路由结果不能泄漏给另一设备或新请求，失效票据不能重连。Host响应由测试socket控制，不冒充真实DSH/MuMu撤销验收。连同固定输出协议2项共5项通过，后端typecheck通过。
- 临时代理已停止，原网关恢复并重新核对监听端口；[finish报告](../../artifacts/large-job-output-finish-android.json)确认回到原聊天。没有修改生产代码、原配置、权限、Key或聊天内容，也没有重跑此前全部单元/API测试。真实设备撤销中的输出、任务回收、复杂连续弱网、Bash/sandbox及其他安装形态仍待验收。
- 本轮当时发现Q20缺口：中继断开会切连接页，重连后才恢复；已由上方Q20修复与真实入口验收补齐。不能将此前“最终返回同一聊天”的证据单独当成完整离线阅读体验。

### 大输出与中继重连 · 2026-09-25

- 实际MuMu/原Loader的pwsh-3输出400,036字节，包含中文和emoji，手机实时窗口保留131,070字符，完整文件分7段读取，逐字比对通过；原ANSI展示将CRLF规范为LF，展示文本SHA256为 `6a243871eb0be92bbfbc2b7ce3523e8a515d59cfb595c047d92b98b841b5dc60`。最终APK复测报告[large-job-output-read-android.json](../../artifacts/large-job-output-read-android.json)时间为2026-09-24 19:32:19 UTC（本地09-25）。
- 初次真实中继重启发现RemoteApp在原生socket关闭时卸载全部页面，丢失当前会话及输出位置。本节当时采用重新鉴权/重建运行环境并恢复本地阅读状态；现已由上方Q20改为 transient 断线保留模型/页面，重建恢复逻辑仍用于核心模块变化。瞬时断线按1/2/4/8/15秒上限退避；主动断开、移除绑定、撤销、权限变更及非法协议停止自动恢复，在途写操作仍为结果未知、不重放。
- [RemoteApp](../../src/RemoteApp.jsx)通过[captureRemoteResume](../../src/remote-resume.mjs)转移选中会话、草稿及打开的独立输出页。[Reader](../../src/remote-live-job-output.mjs)仅在内存转移已确认字节游标、展示文本和UTF-8解码尾字节；旧reader先卸载取消，再交给新reader。恢复输出页后需用户点击“重新读取”，重新核对会话、任务启动时间、Host代次和能力，不从零重读或自动轮询旧任务。EOF空段保留上一页文字，实时裁剪不切断emoji代理对。
- 实际中继重启19:28:07 UTC回到同一聊天/输出页，原65,536字节位置和内容保持，点击后续读到131,072，报告[reconnect](../../artifacts/large-job-output-reconnect-android.json)错误为空，截图已检查。19:31:55主动断开后10秒未自动连回；手动重连成功，同一专用用户消息仍只有1条，报告[disconnect](../../artifacts/large-job-output-disconnect-android.json)通过。19:32:49[cleanup](../../artifacts/large-job-output-cleanup-android.json)归档并返回原聊天。
- 手机针对性12项测试通过（独立输出6、客户端3、恢复2、原生契约1）；原组件完整回放增加真实RemoteWorkspace重挂载时保留输出页/游标、切换会话关闭窗口的回归，通过。Web/APK构建与Android lint通过，参考检出tracked状态为空。
- 实测中修正了三处验收问题：首次大输出预期按LF计数而实际进程输出CRLF；首次恢复后Workspace的初次选中effect清掉了输出窗口，已修正并增加组件回归；主动断开脚本起初使用不存在的消息aria-label/被压缩的CSS类，改为准确的专用消息正文定位并验证非零数量。原失败不计入通过，最终报告为上述结果。
- 本节当时只验证读取两段之间中继断开；在途断线、超时和离开后迟到响应已由上方专项补充。真实设备撤销、连续弱网、Host任务回收、真实Bash/系统sandbox和其他安装形态仍未完成，不代表R09或完整Remote完成。

### 独立后台输出真实接入 · 2026-09-25

- 插件0.1.31新增 `remote.jobOutput`，固定会话/任务启动身份与代次，每次64KiB；原注册表鉴权，Host补读完整spill后重新核对scope/归属，文件失效明确标记缺口。不会调用消费式jobs.read或改变reported。手机原生桥同步放行，自有页面提供标准/错误流、实时/从头分段、复制/全屏；实时最多128K字符，历史每次64KiB。退出/断线/代次变化取消在途并拒绝迟到结果。
- 原补丁Host回归3项、插件adapter/停止26项、后端协议及真实HTTP/WS/SQL4项、手机游标4项和原生方法表契约1项通过。类型检查、Web/APK构建和Android lint通过；未重复全量旧测试。参考tracked状态为空。
- 真实原Loader/模型工具/原生进程→插件→网关→Android入口：19:02:30 UTC创建“DSHM 独立输出联调 1790276550507”，pwsh-2在35秒等待期间先显示BEGIN中文，stderr可查看，结束后END出现，从头读取一致；全屏无横向溢出。19:03:49模型使用原job_output仍读到BEGIN/END和stderr，手机不消费模型游标。报告 `artifacts/independent-job-output-{run,model-read}-android.json` 错误为空。最终样式APK19:07:12重入历史通过，截图已检查，19:07:30归档返回原聊天。
- 首次真实入口暴露Android方法表遗漏，新方法在桥层被拒绝；已修复并加协议/原生表一致性回归。首条1790276373421任务未重发，结束后修复包19:02:14读取成功并归档。首次首页脚本两次等待失败均发生在发送前，按实际标题/异步导航修正。失败报告保留为 `independent-job-output-first-failure-android.json`；observe报告已被最终包重入结果覆盖。
- 大输出多页spill补读、读取间中继断开、本机源码启动及停止后输出保留已由专项补充；在途撤销、连续复杂弱网、真实Bash及操作系统sandbox完整矩阵、其他安装形态交付仍未完成。源码/可复现检查见[补丁说明](../../../plugin/compatibility/background-output/README.md)。

## R12 电脑本地网页预览：访问边界与投入评估

- 当前没有新增生产预览通道。原 [BrowserController](../../../deepseek-harness/packages/client/ui-sidebar-browser/src/client/browser/BrowserController.ts) 把目标 URL 直接交给 iframe；它没有将电脑的 localhost 转发到手机。将原界面直接放到手机也不能解决地址指向问题。
- 既有 [RemoteHtmlResources](../../android/app/src/main/java/dev/dshmobile/validation/RemoteHtmlResources.kt) 是静态文档的独立沙箱，明确禁止运行时网络；[RemoteResources](../../android/app/src/main/java/dev/dshmobile/validation/RemoteResources.kt) 只接受 `/plugins/` 模块资源。不能扩大这两个入口来冒充完整应用预览，也不能将 localhost URL 直接交给手机浏览器。
- 两种方案的差别：扩展静态打包器成本较小，但不能保留完整应用的运行时接口、WebSocket、导航等；专用网页通道能够覆盖这些能力，但需要独立页面环境、按目的地授权和连接生命周期，不与 DSHM 原生凭据桥共享来源，测试须覆盖脚本、相对路径、接口、实时连接、关闭/断线/撤销和迟到数据。
- 用户于2026-09-26已确认：由电脑明确开放指定地址或端口，手机只访问已开放服务。地址范围不再待确认，不能从聊天授权推导任意localhost访问。后面的历史“网页范围待选择”记录以本节为准。
- 随后用户提出公网中转带宽与加载速度的成本问题，要求重新评估必要性。经中转的页面资源、接口与WebSocket会消耗中转流量，性能同时受电脑上行、中转容量与手机网络影响；缓存/压缩不能消除成本。局域网直连或用户已有VPN可避免使用本项目中转，但不能替代开箱即用的跨网访问。
- 2026-10-03用户明确确认首版不做网站转发、后续再考虑。[KKC-21](https://linear.app/kkcodes/issue/KKC-21)独立记录必要性与成本评估；此项从首版验收障碍移除，不标记已实现。文件/HTML预览、只读命令输出及其他既定范围保留。

## 首页连接状态与兼容补丁决策（2026-09-25）

- **兼容补丁安装更新：**9包22个编译/声明文件已安装，71个打包源码输入与实际安装源码匹配、导出保留；副本安装/恢复hash一致、重复应用零写和未知修改拒绝通过。实际F盘恢复未执行。18:40:15 UTC的真实进程报告覆盖运行中2字节读取中文/emoji、stdout/stderr、独立历史、模型原游标、完成通知和真实停止后读取，errors为空；使用实际安装Windows subprocess/Pwsh/jobs与同版生产者适配，独立内存Agent，不代表Loader/模型工具或手机输出页。18:36:55 MuMu原首页自动恢复且返回原聊天，最新`home-connection-android.json`覆盖此前同名报告。完整证据、安装命令和源码启动限制见[补丁说明](../../../plugin/compatibility/background-output/README.md)。下一步是Host有界spill补读、插件/网关协议与手机正式输出页，不把已记录输出查看当作该功能完成。

- 首页连接状态：修复[RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx)固定的“已连接电脑”和绿色圆点，直接读取正式模型 connectionState；连接中、断开与已连接分别展示，屏幕阅读器可感知状态变化。正式组件回放覆盖三个状态，Web 构建、Android assembleDebug/lintDebug 均通过；本轮未重跑全部 Node 测试。
- 最新 APK 实际 MuMu 验证：[只读重启观察脚本](../../scripts/verify-home-connection-android.mjs)于2026-09-24 18:07:51 UTC观察首页已连接；核对原进程身份后停止电脑DSH，18:08:08显示灰点“正在连接电脑…”，原配置恢复启动后18:08:38重新显示绿点“已连接电脑”。自动恢复期间曾短暂重建页面；没有手动刷新或重复配对。已返回原联调聊天，报告 `artifacts/home-connection-android.json` errors为空、recovered/returned为true，断线/恢复截图已查看。之前一次观察脚本未在等待窗口内安排重启，超时失败，不计作通过。
- 日志：`artifacts/home-connection-{web,build,android-build}.log`。仅改变首页状态显示与验证入口，不修改 Key、模型地址、设备权限或网关。该例不能替代完整弱网、在途撤销和长时间恢复矩阵。
- 用户已明确允许电脑端提供维护中的 DSH 兼容补丁，保留完整能力。原版底层 Subprocess 的独立偏移读取可用，但 ShellProcess、生产者 JobHooks 与 LocalJobRegistry 未公开整条旁路；手机不能消费原模型的输出游标或改变reported。源码证据、交付边界和验收要求见[兼容补丁决策](../../../docs/project-knowledge/knowledge/decisions/2026-09-25-desktop-compatibility-patches.md)。[十个文件的核心补丁](../../../plugin/compatibility/background-output/README.md)提供单次最多64 KiB原始字节、原归属检查、不消费或修改完成通知，旧生产者明确不支持；严格类型检查、11项隔离测试及正反向patch检查通过，原停止接口另1项通过。四个executor分支的服务替身测试不代表操作系统沙箱实测；Windows真实进程与当前安装结果见上方。参考检出未改，Host spill补读、插件协议和正式手机页仍待接入，完整独立实时输出尚未验收。

## 原反馈插件接入（2026-09-25）

- **真实双端写入准备与当前待确认：**[目的地核验脚本](../../scripts/inspect-feedback-destination.mjs)通过原编译CLI合成web profile（包含用户/home补丁），只投影遥测配置；不执行任意JS表达式，也不打印完整配置。合成结果与同一启动环境确认默认FEEDBACK_ONLY、未禁用，目标`https://harness-telemetry.deepseeksvc.com/v1/logs`；这不是已观察到实际外传。已准备[本机收集器](../../scripts/feedback-local-collector.mjs)，仅监听127.0.0.1:18789、丢弃正文并记录事件类型/序号，以及[分阶段Android验收](../../scripts/verify-feedback-cross-device-android.mjs)。预定最新回复的只读基线通过（零写入、草稿/消息保留），原按钮位于turn-tail而非正文article，首次定位超时已修正。真实写入阶段尚未执行。
- **审批与现场：**自动审批拒绝临时设置`DSH_TELEMETRY_OTLP_URL`为本机并重启DSH的命令，未返回更具体原因。已向用户询问允许临时调整、只测试专用会话、撤回评价并恢复原启动方式；尚待答复，不能把等待当作批准。DSH仍PID34204和原启动配置；本机收集器PID42924已启动但未收到评价日志。不能在默认外部目的地下改走其他工具提交评价。当前没有改Key、模型地址、设备权限或真实评价；后续继续前核对进程及授权，再执行手机新增→电脑观察/修改→手机观察/撤回→电脑确认清理。

- **电脑同步实现（0.1.30）：**原电脑评价controller只在连接reset时刷新，跨端写入后可能保留旧缓存。现在通过原公开`conversation.input.overlay`插槽挂载同步生命周期，从`conversation.chat.assistant-actions`公开注入取得原controller并调用resync；不修改上游、替换按钮或改写私有方法。对比复制原反馈插件与附加同步组件后选择后者，维护范围仅为通知/读取/清理。原插槽卸载后停止订阅，重新加载或进入会话后重新读取。
- **通知与验证：**Host同时监听活动会话`session/event`和冷存档`feedback/committed`，仅发送ready/changed及递增版本。电脑`/api/dsh-mobile/feedback-events`沿用原Connection的Cookie和Host/Origin检查；手机继续原中继订阅。新增路线没有管理授权或写操作。83项插件测试、类型检查及构建通过：原Gateway/JSONL/loopback遥测→真实事件流→只读上游原controller的新增/撤回更新，冷通知、路由输入/鉴权、取消/卸载、断线与迟到读取均覆盖。测试的事件传递适配不是实际浏览器写入验收。
- **真实入口：**最终0.1.30已安装并以原编译入口重启（PID34204）。内置浏览器打开“DSHM Remote 联调提示”，CDP记录电脑通知HTTP200及ready，随后原`/api/messageFeedback/list`返回200；离开聊天通知请求以ERR_ABORTED取消，再进入重新握手并读取。最终文档17:16:56.980 UTC加载后没有新增页面错误；重启过程中旧页面17:16:54出现session-maybe adapter缺失和inspect同步取消，刷新后恢复，该重启热重载异常仍需单独排查。MuMu最终于2026-09-24 17:17:05 UTC重新进入专用会话，原插件激活、唯一通知握手、读取、两弹窗打开取消、草稿保留与无溢出通过。未提交/撤回真实评价，也未改Key或模型地址；电脑页确认同一设备仅有聊天与任务权限。电脑证据为`plugin/artifacts/feedback-desktop-browser.json`，手机报告`artifacts/feedback-read-cancel-android.json`覆盖此前同名报告。真实写入后的两端图标与实际日志目的地仍待验收，完整R01–R16保持实施中。

- **当前冷通知实现（0.1.28）：**[Host通知](../../../plugin/src/feedback-notifications.ts)订阅原 `feedback/committed`，仅把对应会话的失效版本发到独立只读通道；不构造 Session、不在反馈写锁内读取、不传递日志内容。比较重写原历史流和独立失效通道后采用后者，保留原序列连续性和上游只读约束。[手机监听](../../src/remote-feedback-notifications.mjs)在握手/变动后调用原controller的串行resync；多个回复共用一个订阅，切换会话/插件卸载取消，重连仅恢复订阅，迟到通知忽略。订阅异常显示重新连接提示，无轮询。
- **验证与已安装版本：**原服务隔离集成验证冷写入通知、会话隔离、取消和Host重建；真实HTTP/WS/SQL验证网关基本授权、身份信封及取消。原反馈组件回放在不发送session/event时更新评价图标，卸载后无订阅。手机208项、插件79项、后端42项通过（独立PostgreSQL一项跳过），类型检查、Web/APK构建和Android lint通过。插件0.1.28已安装并重启（DSH PID17396，网关PID12948）；最终APK覆盖安装。2026-09-24 16:53:05 UTC，MuMu正式入口重进专用测试聊天建立唯一冷通知订阅并收到真实ready；原评价读取、两弹窗打开/取消、草稿保持及无页面/资源错误通过。报告 `artifacts/feedback-read-cancel-android.json` 的 `coldNotificationSubscribed=true`，截图已查看。
- **仍待验收：**上述Android测试只读取/打开/取消，没有真实反馈写入，用户Key/模型地址和设备权限未变。冷写入到真实手机图标的端到端验收、原电脑反馈控件自动更新、实际运行日志目的地及完整异常仍未完成；原服务集成与原组件回放不能替代这些真实入口。完整R01–R16保持实施中。

- **真实服务隔离集成补齐：**[feedback-host.test.ts](../../../plugin/tests/feedback-host.test.ts)以固定测试消息经过 RemoteAdapter → 原 Connection/Gateway → 原 MessageFeedbackService → 原 JSONL 持久化，并由原 OpenTelemetry backend 发至本机临时 HTTP 收集端。两项集成覆盖 live 写入/另一设备上下文读取/旧版本冲突/撤回，及 Host Context 销毁重建后的冷存档读取和撤回；不是 mock 反馈服务，也不是 Android UI、实际配对或真实模型验收。临时 DSH_HOME、凭据、会话仅在 plugin/artifacts 中，结束清理；未读取用户聊天、未改当前运行 DSH 配置或设备权限。
- **修复前的冷路径依据：**实际冷写入只发布 `feedback/committed`，不创建 live Session，也不发 `session/event`。原 SessionHistoryController.follow 监听 `session/event`/`session/created`，仅靠手机eventSource不能覆盖此路径；上方0.1.28已增加独立通知。普通会话打开可能被Host激活，不能把冷服务测试推广为所有归档页面必现。原电脑控件仍需核验。
- **日志边界：**loopback 实测评价 put 释放规范会话前缀，delete 释放后续记录；版本冲突不写日志。Host 重建后遥测游标重置，下一次反馈重新释放当前规范前缀。该结果证明原服务语义，不证明用户运行实例的实际收集目的地。本次插件79项、类型检查和构建通过；只新增测试与开发依赖，运行插件保持0.1.27，无 APK/网关发布。真实双端 UI 提交、冷通知修复及实际日志目的地仍未验收。

- **触屏初读与事件同步：**原控件只在悬停/聚焦时预读评价，且仅重连触发 `resync`。手机对已核验的原反馈插槽增加[订阅适配](../../src/remote-feedback-sync.mjs)：首个可见控件订阅读取一次，多个回复复用同一原controller；当前绑定的 `eventSource` 收到 `feedback/message-put|delete` 或完整窗口替换时请求原 `resync()`，不直接写入controller状态，不轮询。普通流式消息、其他会话和前翻历史不触发读取；最后一个控件离开后释放事件订阅。原插件界面和串行写入/CAS保持不变，未知controller版本明确报不兼容。
- **验证范围：**[单元回归](../../tests/remote-feedback-sync.test.mjs)覆盖读请求合并、读取中到达事件、离开后停止及重新进入；原生成接口/原会话事件窗口/原插件页面回放验证触屏初始标记、两条回复单次读取、其他客户端新增/删除事件后的图标更新、未发起写操作及切换会话。测试新增专用会话时先漏掉目录注册，随后修正为局部登记，避免改变既有列表数量断言；还修正轮尾按钮不在正文article内、夹具返回会话需重放历史的定位/回放问题。最终完整回放通过，这些失败不算产品通过。
- **最终APK实测：**2026-09-24 16:28:43 UTC（本地09-25），MuMu退出再进入专用测试聊天，未悬停/点击评价前已通过真实原生桥调用 `messageFeedback/list`；回复与会话两弹窗打开/取消、草稿和消息数保留、无溢出/页面及资源错误。报告 `artifacts/feedback-read-cancel-android.json` 的 `readOnChatEntry=true`；本轮最终报告覆盖之前读取/取消报告。真实反馈新增/撤回没有执行，因此实际双端写入同步仍未验收。没有修改Key/地址/设备权限或发送模型消息。
- 手机 **205项**、原组件Web回放、Web/APK构建及Android lint通过，日志为 `artifacts/feedback-sync-{node,web,build,android-build,android-verification}.log`。插件/网关/上游未改，仍使用0.1.27。冷存档未发生新会话事件时如何通知活跃视图，以及电脑原页面自动更新仍需独立核验；不把当前手机事件适配描述为完整双端验收。

- **会话菜单补齐：**「Remote 选项 → 会话反馈」调用原插件注册的本地 action，与回复操作使用同一原弹窗。比较调用 `/feedback` 解析管线和直调已注册 action：前者在插件卸载时可能回退为电脑命令，后者不进入命令执行或发送管线，因此采用后者。保留原 CommandUiRuntime 的目录、装饰注册、弹窗及生命周期，手机仅派生 `decorate` 增加菜单索引；原反馈插件和内部界面未改造。先读取真实会话命令目录，再核对绑定、连接代次、插件注册身份和可用性，未知/缺少入口拒绝，不自动重试。子会话暂不提供会话反馈菜单，原回复评价仍按插件能力显示。
- 来源：[菜单动作](../../src/remote-command-actions.mjs)、[原命令服务派生](../../src/remote-command-actions.jsx)、[菜单入口](../../src/ui/RemoteWorkspace.jsx)、[生命周期回归](../../tests/remote-command-actions.test.mjs)。原 ui-commands 标记由手机组合，原 inputTriggers 和反馈插件仍从真实电脑图动态加载；不伪造 commandUi 服务、不开放通用 commands/execute。
- **新增实测：**2026-09-24 16:16:58 UTC，正常APK覆盖安装后，MuMu专用测试聊天的回复评价与会话菜单均打开原弹窗并取消，消息数和草稿不变，页面/资源错误为空。`artifacts/feedback-read-cancel-android.json` 已更新为此次结果；`artifacts/session-feedback-dialog-android.png` 已查看。原生桥写入观察器的拦截次数为零，没有真实评价提交、撤回或模型消息，没有改变Key、地址和管理权限。本轮没有修改或重启插件/网关（仍0.1.27）。
- 手机完整 Node **203 项**、原组件Web回放、Web/APK构建及Android lint通过；新增会话级提交、取消零写、草稿保留、卸载移除菜单，以及换聊天/重连/卸载/目录拒绝的迟到结果回归。隔离回放第一次因分类按钮真实名称为“产品功能与交互”而非“产品交互”超时，修正定位后通过；不算产品故障。真实提交/撤回与跨端更新依旧未验收。

- 状态：代码及隔离回归通过，真实 MuMu 已验证读取、打开及取消；真实提交/撤回、跨端反馈更新及完整 R14 仍未验收。维护角色：DSH Mobile 项目协作 Agent。来源：[原消息反馈](../../../deepseek-harness/packages/feedback/message-feedback/src/index.ts)、[原会话反馈](../../../deepseek-harness/packages/feedback/command-feedback/src/index.ts)、[原界面](../../../deepseek-harness/packages/client/ui-message-feedback/src/client/index.ts)、[手机插槽](../../src/remote-plugin-slots.jsx)、[协议策略](../../../backend/packages/protocol/src/remote-policy.ts)。
- 复用原插件与生成接口，避免重写评价状态和版本冲突语义。DSHM 自有聊天增加唯一会话级 `conversation.input.overlay`，回复操作与弹窗共用真实会话。只开放四项固定反馈调用，严格校验字段、版本、分类和 UTF-8 长度；原服务仍核对消息身份及版本。没有增加管理权限。
- 原[会话遥测](../../../deepseek-harness/packages/session/session-telemetry-otel/src/index.ts)可能因提交或删除评价而发送会话日志到配置的收集端。保留原日志提示；本批没有真实提交或撤回评价。真实写入验收需先核对实际目的地及数据授权，不能称为仅本地评价。
- 插件 **0.1.27**、新版网关及正常 APK 已更新，保留 Key、历史和绑定。恢复已退出的原服务：最终 DSH PID6356、网关 PID13256。MuMu 当前 `emulator-5554`，恢复 `adb reverse tcp:8787 tcp:8787` 后连通。没有发送模型消息或更改设备权限。
- [真实 Android 检查](../../scripts/verify-feedback-android.mjs)于 2026-09-24 16:03:14 UTC（本地 09-25）通过：原插件运行、测试聊天打开与取消、无溢出，页面/资源错误为空。报告 `artifacts/feedback-read-cancel-android.json`，已查看 `artifacts/feedback-dialog-android.png`。脚本临时阻止三项反馈写调用并要求触发次数为零，真实读取不变，结束恢复桥，避免冷加载意外撤回已有评价。前两次分别因反向映射缺失和标题定位不唯一失败，修正后通过。
- 手机 Node **200 项**、插件 **77 项**、后端 **42 项**通过，独立 PostgreSQL **1 项跳过**；类型检查、构建、原组件 Web 回放、APK 构建和 Android lint 通过。隔离回放覆盖唯一弹窗、取消零写、真实消息坐标、提交、撤回冲突及卸载；真实网关/Host 通道覆盖转发和非法参数拒绝。生成接口夹具来自实际运行版 DSH，仅用于测试。首次回放语言不符、首次构建继承共享 Gradle 缓存，明确中文和使用项目离线缓存后通过。
- 会话级菜单已由上方补齐；子会话/归档及断线完整行为、跨端实时更新和 portal 外层缩放仍待核验。移动尺寸下原弹窗可用不代表完整插件适配。

## 在电脑打开交付与改动文件（2026-09-24）

### 搜索断线与同页恢复（2026-09-25）

- **后续真实响应乱序核验（12:32–12:33 UTC）：**按既有临时配置在同一电脑开启内存索引，DSH PID76440，网关57392不变。[Android实际入口脚本](../../scripts/verify-search-order-android.mjs)先确认真实正文标记可命中，再用[本机代理](../../../backend/scripts/verify-device-output-proxy.mjs)暂缓旧搜索的原始响应。代理只输出结果形状计数，不记录关键词、摘要或凭据；`pass`允许新响应先通过，`resume`原样释放旧帧。
- 新查询已返回无匹配后释放旧命中、以及清空查询后释放旧命中，两种情形都没有旧摘要闪现。DOM观察覆盖中间变化，不仅核对最终画面；同一会话草稿保持。[结果](../../artifacts/search-order-android.json)两次均确认确有一个完整搜索响应被暂缓，页面错误为空，[截图](../../artifacts/search-order-android.png)已查看。首次脚本因未限定标题所属页面而失败，修正选择器后通过；未修改产品代码或桥事件。
- 已停止代理、恢复ADB `tcp:8787 → tcp:8787`，结束临时DSH并按原无`--patch`源码入口恢复为PID10784。12:33:37 UTC[默认模式回归](../../artifacts/remote-search-disabled-android.json)确认索引关闭提示、标题搜索和原聊天/草稿保留，错误与资源失败均空；网关57392未重启。无模型消息、权限/Key/持久profile写入。此项补齐本机在途响应迟到/乱序，不能代替复杂弱网、超大索引或完整R03验收。

- 状态：默认关闭正文索引环境下真实网络中断与恢复已验收，完整R03仍实施中。维护角色：DSH Mobile项目协作Agent。来源：[实际页面](../../src/ui/RemoteWorkspace.jsx)、[Android脚本](../../scripts/verify-search-reconnect-android.mjs)、[既有协议回放](../../scripts/verify-remote-plugin-slots.mjs)。
- 01:06:19 UTC从原联调聊天返回列表、搜索完整标题，核对电脑未开启正文索引的提示以及唯一标题结果；随后只停止核对过命令行的网关PID32288，DSH PID10540未停止。01:06:45 UTC手机同页关键词/匹配保留，改为不存在的关键词时不显示旧摘要或“没有找到匹配的聊天”假空状态，展示连接失败及标题降级；离线点击重新搜索不会卡住加载状态。测试未开启索引或改电脑配置。
- 按原node --env-file=.env.local packages/gateway/dist/main.js恢复网关，PID32256、8787监听、Host与设备重新连接成功；01:07:06 UTC无需手动刷新就自动恢复查询，重新出现正文索引关闭说明并清除断线搜索错误。清空查询后进入原聊天，原历史可读、草稿为空，没有发送模型消息或改设备权限。
- 报告：[基线](../../artifacts/search-reconnect-prepare-android.json)、[离线](../../artifacts/search-reconnect-offline-android.json)、[恢复](../../artifacts/search-reconnect-recovered-android.json)，errors均空；离线手机截图已查看。脚本仅观察正式入口，不替换桥或伪造搜索响应。仅新增验证脚本/文档，没有产品代码变化，不重复构建APK。
- 本节早期离线标题测试不覆盖正文响应乱序；后续真实内存索引与原始帧暂缓已补验，见上方记录。真实复杂弱网、子会话嵌套及其余R03保持原范围。

### 独立插件真实加载、文件入口与缩放（2026-09-25）

- 状态：代表性独立插件从电脑安装到真实MuMu的路径已通过，完整R13/R16继续实施。维护角色：DSH Mobile项目协作Agent。来源：[独立包](../../tests/fixtures/live-partial-plugin/README.md)、[原插槽宿主](../../src/remote-plugin-slots.jsx)、[手机验收脚本](../../scripts/verify-live-partial-plugin-android.mjs)、[作者接口](../plugin-validation/mobile-layout-api.md)。
- 比较直接注入手机运行时与通过电脑真实安装，采用后者：从DSH公开插件页安装自编@dsh-mobile/partial-ui-verification，Host原Loader发现/client并通过现有模块图/资源通道传至正式App。Host入口为空，无新服务或鉴权；手机未截获资源、注入测试脚本或修改APK。0.0.1默认未声明，0.0.2通过可选ctx.inject取得dshmLayout并configure({autoFit:false})；原DSH无此服务仍可加载。安装包分别shasum 2c7c0979f2dd8da84d501d70633607e9b3d83227、e91b6db63ad1ef521121f5c4b5849015d1d4ccfe。
- 00:58:20 UTC[默认/用户设置报告](../../artifacts/live-partial-verify-android.json)：原宽720px，外层372px，实际显示372.00003px；点击坐标有效。插件openFile真实读取既有专用测试文本，与磁盘原文一致，并进入DSHM共用「在电脑打开」确认后取消。用户关闭时transform:none，内容保持720px，恢复默认重新缩放；局部宽内容滚动不扩展全页。首次脚本严格比较整数clientWidth与亚像素DOMRect失败，是检查精度问题；改为核对无transform和内容720px后重跑成功，未改产品代码。
- 00:59:46 UTC[作者声明报告](../../artifacts/live-partial-author-android.json)：0.0.2真实更新后默认不缩放；无用户覆盖时恢复按钮不存在，用户手动开启后缩放，恢复默认再次不缩放。截图已核对缩放卡片、关闭后的局部横向滚动及DSHM原文件预览。
- 01:00:27 UTC[卸载报告](../../artifacts/live-partial-unloaded-android.json)：电脑公开插件页卸载后，手机卡片与模块列表均消失，电脑已安装列表仅保留原DSH Mobile；布局覆盖已先恢复默认。三个报告errors均空，手机在原“DSHM Remote 联调提示”且草稿为空。DSH PID10540和网关PID32288保持，未发模型消息、修改凭据/设备权限或创建附件副本。当前fixture保留为可重新打包的测试来源，不进入正式App。
- 本项覆盖真实独立包的轮尾插槽、文件回调、外层缩放、可选作者服务、用户覆盖、模块更新与卸载；它是自编代表性插件，不等同所有第三方插件/插槽/Worker兼容，也不替代在途撤销。其余管理、资源生命周期与完整功能矩阵保留。

### 历史附件补充（2026-09-25）

- 状态：0.1.34已实现、安装，本机MuMu文本/PNG实测通过；完整R16尚未完成。维护角色：DSH Mobile项目协作Agent。来源：[Host副本](../../../plugin/src/attachment-desktop.ts)、[原附件授权](../../../plugin/src/attachment-preview.ts)、[Host测试](../../../plugin/tests/attachment-desktop.test.ts)、[共用请求](../../src/remote-desktop.mjs)、[真实脚本](../../scripts/verify-attachment-desktop-android.mjs)、[协议](../../../docs/protocol.md)。
- 比较直接打开原附件仓库路径与生成独立副本，采用后者：不绑定本地provider目录结构，编辑器不能修改不可变原件。准备只核验引用，返回单次确认快照；确认重新读取原provider，精确长度/EOF摘要校验及最终引用检查成功后原生打开。文件/图片/Office共用入口，图片最终检查再次调用原会话附件服务。5分钟128份确认、处理25秒并发2、副本8槽位/每份最多256 MiB（图片16 MiB）；副本一小时过期后按需清理，锁定保留，原生结果未知也保留并不自动重试。临时副本编辑需另存。
- 00:35:52 UTC最终[报告](../../artifacts/attachment-desktop-android.json)：85 B历史文本实际Notepad打开、取消不落盘、写入独立副本后重新读取聊天原件仍一致（SHA256 `090416bcf450b460fa0f97330818ad33fa347010458d1ce461b0d4f5a10c37be`）；2,364,981 B原始PNG实际Photos打开，SHA256与先前上传的测试图片一致（`42643e60494b2f9e4d8ff121064e8b2083d50c3ea93882c4cae353edc075b911`）。[电脑窗口记录](../../artifacts/attachment-desktop-host-windows.json)核对Notepad6368和Photos62472；没有直接读取桌面正文。两张手机截图已查看，错误为空，回原聊天且无草稿。副本修改已恢复，测试窗口未强制关闭，避免影响共享Notepad标签。
- Office历史docx原先只检查准备/取消；00:49–00:50 UTC已用[六格式验证脚本](../../scripts/verify-office-desktop-android.mjs)逐一确认打开。docx/doc、xlsx/xls、pptx/ppt六个新副本分别为909/9216、1429/5632、1704/606720字节，均与先前上传的已知原件逐字节及SHA256核对一致。仅docx取得含准确测试文件名的Word窗口；Excel两次约25秒后显示“打开结果尚未确认，请先在电脑上核对。”，每次仅一份副本且未自动重试；doc/pptx/ppt为系统接受请求，未取得对应文件窗口，不能标记应用实际打开通过。Windows窗口出现产品激活失败提示，尚不能据此认定超时原因，未修改激活、文件关联或Office配置。
- 证据：[docx](../../artifacts/office-desktop-android.json)、[xlsx](../../artifacts/office-desktop-xlsx-android.json)、[pptx](../../artifacts/office-desktop-pptx-android.json)、[doc](../../artifacts/office-desktop-doc-android.json)、[xls](../../artifacts/office-desktop-xls-android.json)、[ppt](../../artifacts/office-desktop-ppt-android.json)、[电脑窗口](../../artifacts/office-desktop-host-windows.json)；xlsx手机截图已人工核对未知结果文案及原Office预览仍可见。脚本退出0只表示观察与副本核验完成，须读取requestAccepted，且它本身不表示办公软件呈现成功。手机回原聊天、无草稿、无新模型消息或权限变更；本轮只新增验证脚本，没有修改产品代码或重新构建APK。当前PID10540副本8槽占用完毕，未删除可能仍被办公软件使用的副本，不继续重复打开；过期清理按既有一小时按需规则。
- 首次文本附件验证脚本未等历史初始加载就查找更早按钮，未找到旧文本卡片，不算通过；增加真实消息出现等待后重跑成功，未修改产品分页，也没有重复模型请求。
- 手机237、插件97、后端50项通过（独立PostgreSQL默认跳过1项），类型检查/构建、四种文件入口原组件回放、Web/APK和lint通过。新增Host测试使用真实LocalAttachmentStore字节/摘要和磁盘，会话及OS打开为明确边界替身，覆盖异设备/连接/会话、引用丢失、原件损坏、EOF失败、取消、服务替换、单次/过期、容量与真实目录junction拒绝。该测试不代替实际在途设备撤销。用户/工具/上下文等全部附件来源和第三方插件专用入口仍需逐项实测。

### 正文和工具文件补充（2026-09-25）

- 状态：插件0.1.33、网关、App已安装并通过实际MuMu入口，完整R16尚未完成。维护角色：DSH Mobile项目协作Agent。来源：[Host快照](../../../plugin/src/workspace-desktop.ts)、[原服务集成](../../../plugin/tests/workspace-desktop.test.ts)、[共用请求](../../src/remote-desktop.mjs)、[共用窗口](../../src/ui/RemoteFilePreview.jsx)、[Android脚本](../../scripts/verify-workspace-desktop-android.mjs)、[协议](../../../docs/protocol.md)。下列0.1.26段落保留当时状态，新正文/工具范围以本节为准。
- 比较直接放行原通用打开RPC与新增受控准备/确认，采用后者。路径只用于原workspaceFiles/stat选择，原Session lookup和文件系统决定授权；Host反向映射核验后签发绑定设备连接/会话/服务/文件版本的一次性快照。确认接口不收路径，先消费再重新查权限及版本。取消无副作用、服务替换/过期失效、未知结果不重试。没有复制手机自己的路径权限规则，也不把附件名当电脑路径。
- 原文件服务允许工作区外的可读文件，因此此功能不是目录包含限制；只接受普通文件、拒绝URL/UNC/控制字符。最终Host打开沿用原服务，与原present.open一样仍有文件系统检查到系统打开之间的外部变化窗口，不承诺原子文件句柄打开。
- 00:08:03 UTC在DSH-TEST创建“DSHM 文件入口验证 1790294888136”，模型只read独立测试文本并回复Markdown链接，无命令执行/文件修改。00:08:17 UTC从工具文件按钮、正文链接打开确认成功，取消无打开；确认期间脚本仅修改自造文件后被拒绝，重新确认成功；暂移文件在准备阶段被拒绝。finally恢复原字节，截图已查看，`workspace-desktop-verify-android.json`错误为空。电脑真实窗口 `dshm-file-origin-1790294888136.txt - Notepad`、PID6368，证据 `workspace-desktop-host-window.json`；未直接核对记事本正文。00:08:32 UTC清理报告确认聊天已归档并回原聊天，测试文件恢复，Key/设备权限/模型地址未改。
- 验收矩阵：工具文件按钮、正文链接为真实MuMu通过；共享文件窗口确认/取消/未知结果为原组件回放通过；交付/整轮改动旧路径回放通过，未重跑已通过的旧真实脚本；历史附件没有新增入口；第三方专用卡片与独立diff入口尚未逐一真机实测，不能据共享代码认定全部完成。
- 手机235项、插件92项、后端49项通过，独立PostgreSQL默认跳过1项；两端类型检查、构建、原组件回放、Web/APK构建及Android lint通过。集成测试使用真实原Connection/Gateway/Session lookup/WorkspaceFiles/LocalFileSystem，只替换最终OS窗口副作用，验证异设备/连接/会话拒绝、一次性、过期、文件变更/删除、目录/最终目录链接拒绝、服务替换与未知结果。Windows普通文件symlink创建因EPERM失败，改用无需提权的真实junction检验最终链接拒绝，未声称已实测文件symlink。真实在途撤销/断线仍待专项验收。

- 状态：代码、更新安装和三个真实 MuMu 入口通过，完整 R16/R01–R16 仍未完成。维护角色：DSH Mobile 项目协作 Agent。最近核验：2026-09-24。来源：[手机确认组件](../../src/ui/RemoteDesktopOpen.jsx)、[请求边界](../../src/remote-desktop.mjs)、[Host](../../../plugin/src/desktop-open.ts)、[原核验](../../../deepseek-harness/packages/client/ui-deliverables/src/present-open.ts)、[Android 验证](../../scripts/verify-desktop-open-android.mjs)。
- 比较开放通用路径调用与复用原交付/改动路由，采用后者：电脑按 sessionId/seq/index 重新核对原事件或快照、访问权限及 Host 路径映射。手机保留原文件数组索引，先读电脑名称再确认；只打开当前文件，不打开历史差异内容。普通正文路径、通用工具文件链接及历史附件尚未接入，不能视作全部文件入口完成。详细字段见[协议](../../../docs/protocol.md)。
- 插件 **0.1.26** 已从电脑插件页覆盖安装并重启，页面显示运行中/已连接；本批 DSH PID75508、网关 PID77676。正常 APK 覆盖安装保留 Key、历史与绑定。手机200项、插件76项、后端40项通过（1项独立 PostgreSQL 跳过）；双方类型检查/构建、手机原组件回放、Web/APK构建和Android lint通过。回放覆盖确认/取消、固定坐标、未知响应不自动重发；原 Host Connection 与真实网关通道测试覆盖转发和通用路径拒绝。
- 10:14:29 UTC在 DSH-TEST 新建独立聊天 `DSHM 电脑打开联调 1790244874287`，只修改本项目自造的文本文件并调用原 present 工具；edit 使用一次批准，未扩大永久权限。10:14:56 开始的最终验证通过交付文件、整轮改动、最新完整文件三个入口，均先取消再确认；手机显示实际电脑名称、无横向溢出。电脑进程窗口证据为 Notepad `dshm-desktop-1790244874287.txt - Notepad`，没有用手机请求成功单独推断电脑已打开。手机确认截图已查看，未直接核验记事本正文。
- 10:16:02 临时移走上述自造文件，实际 Host 拒绝并显示记录/文件缺失；finally恢复原件。10:16:23 测试聊天已归档、返回原联调聊天。报告 `artifacts/desktop-open-{prepare,verify,missing,cleanup}-android.json` 与 `desktop-open-host-window.json`，页面/资源错误均为空。第一次脚本误命中隐藏思考中的标记，修正可见正文定位后继续原轮次，没有重发消息。
- 电脑插件页核对同一 DSHM Android 仍为「聊天与任务操作」，未授予管理权限、未改 Key/服务地址。真实在途撤销/断线、其他桌面平台、剩余文件来源尚未验收，完整目标保持实施中。
- 后台独立实时输出源码核验：原 [JobHooks.readOutput](../../../deepseek-harness/packages/jobs/jobs/src/types.ts) 明确是单个消费游标，不能轮询它作为手机旁路输出，否则会影响模型。现有已记录输出查看保持有效；独立读取仍需受支持的生产者/注册表接口扩展，没有以 mock、劫持方法或轮询消费接口替代。

## 工作流原卡片与成员导航（2026-09-24）

文字草稿跨 App 重启丢失的问题已修复，见下方“Remote 文字草稿持久化”。工作流和完整 Remote 的其余待验收范围不变。

- 状态：工作流真实运行、阶段/成员记录、自有子会话导航、运行中电脑 DSH 重启与 App 重开后的归档读取通过；完整 R09/R13/R01–R16 未完成。来源：[手机组合](../../src/remote-workflow-slots.jsx)、[点击边界](../../src/remote-workflows.mjs)、[原工作流投影](../../../deepseek-harness/packages/client/ui-workflow-run/src/client/workflow-definition.ts)、[原卡片](../../../deepseek-harness/packages/client/ui-workflow-run/src/client/WorkflowRunPanel.tsx)。
- **运行中 Host 重启（2026-09-25 本地日期）：**新增[分阶段实机脚本](../../scripts/verify-workflow-restart-android.mjs)，只在 DSH-TEST 创建 `DSHM 工作流重启 1790271312792` 并发送一次原 workflow，成员只生成文本、不调用工具。2026-09-24 17:35:17 UTC 确認卡片/成员正在运行后，将已核对身份的 DSH PID34204 按原编译入口重启为 PID67424；未改配置，网关仍 PID12948。手机不刷新或手动重连，17:35:43 观察到重新读取，17:35:45 自动回到同一会话；原卡片和成员均为 interrupted，运行成员入口撤下，草稿保留，提示和工具各只有一份。原记录的执行脚本与发送内容一致，报告 `artifacts/workflow-restart-run-android.json` errors/resources 均为空，截图已查看。中断由原投影在轮次关闭且缺少结束事件时推导，没有手机伪造状态。
- **App 重开与清理：**测试聊天归档后 force-stop/relaunch DSHM，再从正式 Remote 列表打开归档，17:36:54 UTC `artifacts/workflow-restart-history-android.json` 验证中断状态、成员、原记录和草稿仍在，未重新发送，errors/resources 均为空，最后返回“DSHM Remote 联调提示”。首次历史脚本误以为重开后自动进入上次聊天，实际入口是 Remote 列表；已修正两种合法入口后通过，不算产品缺陷。本批仅新增验收脚本/文档，未改产品代码或 APK。电脑管理权限未授予，Key/模型地址未改；评价日志临时改本机的授权仍待答复，未执行任何真实评价写入。该轮恢复为 PID67424；后续现场以本文顶部记录与实时进程核对为准。
- 原插件等待 `uiWorkspace`，而完整桌面导航还依赖 layout、目录选择及创建流程。比较加载整套桌面工作区和保留原投影/组件仅替换导航，采用后者：手机组合注册原 definition、字典和 WorkflowRunPanel，不复制执行或状态折叠逻辑，不修改插件内部样式。电脑提供的该插件标为“由手机提供”，避免重复注册；它仍显示外层自适应开关，用户偏好保留。此适配绑定当前上游版本，不代表任意后续版本或其他第三方插件已自动兼容。
- 工作流只由同一聊天中的原工具执行。卡片展示实际运行、完成、失败、取消与中断；只有原目录中仍在运行且属于当前父会话的成员可打开，点击时再次核对原记录和父子关系。打开一次性子会话沿用原地址和 DSHM 页面，禁止续聊；返回保留父草稿。已结束成员按原卡片语义不提供快捷跳转，历史仍可从“子会话”目录查看；没有新增目录、命令或设备权限。
- [真实 Android 验证](../../scripts/verify-remote-workflow-android.mjs)在 DSH-TEST 建立专用聊天 `DSHM 工作流联调 1790239375309`，只要求一次 workflow 和无工具的文本子任务。08:42:57 UTC 手机卡片运行中打开成员、只读页面、返回父草稿通过；08:43:18 完成阶段/成员显示及真实回复 `DSHM_WORKFLOW_OK_1790239375716` 通过。测试已归档并返回原联调聊天。08:44:07 强制结束并重开 App 后，归档记录重建、插件页外层自适应切换及恢复原偏好通过。报告 `artifacts/remote-workflow-{prepare,watch,finish,history}-android.json`，errors/resources 均为空，三张真实截图已查看。未修改 Key、电脑配置或设备授权。
- 第一轮真实工作流17秒完成，读取时已终止，因此另做第二轮即时观测验证运行中跳转，不用完成状态冒充实时验收。第一次结束定位同时命中思考和正文，修正为正文精确匹配后通过，没有重复发送那一轮。组件回放最初序号不连续触发缺页读取，修正序号后通过；继承先前英文语言的测试也改为明确中文。失败记录不算通过。
- [多场景 Android 验证](../../scripts/verify-workflow-cases-android.mjs)另建三条 DSH-TEST 聊天：parallel `1790239734364` 实际执行 `await parallel`，并行两成员后进入汇总第三成员；failure `1790239792353` 按要求抛出 `DSHM_WORKFLOW_EXPECTED_FAILURE`、不重试；cancel `1790239836523` 在成员运行中点击停止，原卡片及成员均回传 cancelled，输入框恢复。三条均已归档，返回原联调聊天。原执行报告 `artifacts/workflow-{parallel,failure,cancel}-run-android.json` 分别为08:48:53、08:49:51、08:50:36 UTC；最终 APK 覆盖安装后09:10:13–17 UTC三份 reopen 报告通过历史读取与状态检查，errors/resources 为空，没有重发模型消息。
- 实测发现工作流已取消，但通用工具记录仍标为失败。源码 [tool-workflow](../../../deepseek-harness/packages/workflow/tool-workflow/src/index.ts) 在失败及取消时均抛普通 Error，不能用通用 isError 判断工作流失败，也不能从错误正文猜测。手机工作流通用记录改为“调用已结束”，准确状态由原工作流卡片展示；明确 `ABORTED` / `ABORTED_BEFORE_DISPATCH` 及合成 `interrupted` 则经[共享适配](../../src/remote-tool-row.mjs)显示已停止，命令与输出读取一并使用。真实取消截图已检查；仅补 ABORTED 的首版未解决工作流，失败报告不算通过。
- 手机完整 Node **185 项**、包含原投影/组件的 Web 回放、Web/APK 构建及 Android lint 通过；回放覆盖取消码经原 tool/result 投影进入命令详情/输出记录、合成中断、无额外桌面布局和父草稿保留。夹具曾漏掉 surfaceOp，被原投影拒绝，补齐实际事件格式后通过。上游、插件和网关未改，也未增加管理权限。这些为该批历史结果；电脑重启的后续实测见本节上方，其余工作流完整异常仍待验收。
- **当时发现的草稿缺陷（已由后续修复）：**[RemoteModel](../../src/remote-model.mjs) 原来仅在 snapshot.drafts 内存保存，[重连恢复](../../src/remote-resume.mjs)保留的是当前运行中的模型快照。App 覆盖安装重启后 parallel/failure 的专用草稿为空（报告 savedTestDraftPresent=false），不能把父子切换或电脑重连保留草稿当作 App 重启恢复。cancel 草稿在复查时重新填过，其 true 不构成持久化证据；后续独立验收见下节。

## Remote 附件草稿持久化（2026-09-24）

- 状态：已实现并覆盖安装，真实 MuMu 重启恢复、重新上传和清理后重启通过。维护角色：DSH Mobile 项目协作 Agent。最近核验：2026-09-24。来源：[附件白名单序列化](../../src/remote-attachment-drafts.mjs)、[存储](../../src/remote-drafts.mjs)、[模型](../../src/remote-model.mjs)、[重连恢复](../../src/remote-resume.mjs)、[真实 Android 验证](../../scripts/verify-attachment-drafts-android.mjs)。
- Android 系统选择器提供临时读取许可，不能保存 content URI 当作持久原件；选择后先复制 Blob 字节，沿用独立 IndexedDB 严格事务、绑定/会话命名空间。比较持久原件与复用电脑 receipt，采用原件：只保存名称、类型、字节和是否结果未知，电脑 receipt/file/path 不持久化。图片恢复可直接使用，文件恢复后由用户点击「重新准备附件」取得当前电脑回执，不自动上传或发送。移除附件、发送成功、移除绑定清理对应存储，归档保留。
- 发送前必须先持久标记这批附件为未知；保存失败不提交模型，发送中的其他保存不能抹去标记。明确业务拒绝恢复可发送状态，未知响应或进程退出后保留待核对状态、禁止重新准备/发送，只允许用户核对后移除。尚未完成保存时杀进程、磁盘空间不足、最大尺寸附件及真实请求在途杀进程仍未专项实测；不能宣称所有异常已通过。
- 手机全量 **197 项**、原组件 Web 回放、Web/APK 构建与 Android lint 通过。模型/存储测试覆盖原始字节、重开后新回执、混合发送、未知状态持久化与阻止重发、发送中再次保存、磁盘失败不发请求，以及读取原件期间取消不复活。重连测试覆盖有原件文件恢复和无原件旧卡片失效。Web 回放未模拟真实杀进程，其结果不替代 Android 验收。
- 09:49:04 UTC 在既有 DSH-TEST 归档会话选择自造文本及 2,364,981 字节 PNG，保存后覆盖外部下载目录中这两个测试来源，再强制结束并重开 App。09:50:35 验证文字/两附件恢复、回复数不变（没有自动发送）；图片完整 RGBA 像素 SHA-256 与确定性原图一致，文件重新准备后主动发送，电脑只读取本轮测试附件并准确回复原文件唯一标记。图片随后移除；09:50:55 再次强制结束/重开确认附件和文字均已清空。报告 `artifacts/attachment-draft-{prepare,verify,clean}-android.json`，errors/resources 均为空，恢复截图已查看，返回原联调聊天。未动管理权限、模型选择、Key、电脑设置、上游、插件或网关。
- 初次图像核验用 fetch(blob URL) 被当前环境拒绝，未发送消息；改为对实际呈现图片解码后的完整像素计算摘要，通过后才继续发送文件。失败不计通过；没有为了测试放宽产品网络访问。未知响应恢复有模型/数据库测试证据，真实在途崩溃不在本轮 Android 结论中。完整 R01–R16 继续实施。

## Remote 文字草稿持久化（2026-09-24）

- 状态：文字草稿已修复并覆盖安装，MuMu 强制结束/重开、双会话恢复、手动清空和发送成功后的清理通过；附件草稿后续接入与验收见上节。来源：[存储边界](../../src/remote-drafts.mjs)、[数据库](../../src/remote-draft-database.mjs)、[正式入口](../../src/RemoteApp.jsx)、[模型](../../src/remote-model.mjs)、[原生绑定公开元信息](../../android/app/src/main/java/dev/dshmobile/validation/RemoteIdentity.kt)。
- 比较原生新增桥与 WebView 独立存储后，先试同源 localStorage；实际立即 force-stop 后读到上一条旧草稿，说明其写入返回不能作为落盘完成。最终使用独立 IndexedDB `dshm.remote.drafts.v1`，readwrite 采用 durability=strict，事务完成后才撤下“正在保存”提示；提示脱离布局，不挤动输入框。旧验证包仅迁移相同绑定的文本，提交成功后才移除旧值，不覆盖数据库已有记录。数据库初始化失败仍可进入聊天，但明确提示草稿不能读取/保存，不假装持久化成功。
- 命名空间来自原生 origin/deviceId/fingerprint，再按 sessionId 隔离；只保存文字，不持久化 Key、token、附件回执、待答审批或发送队列。打开聊天首次呈现输入框前读取预加载缓存；只读和可续聊子会话沿用各自 id。输入即时更新界面，写事务顺序与本地版本确保迟到成功/失败不覆盖新提示；发送成功仅清理仍等于本次发送文本的草稿，失败/未知结果保留且不自动重发。手动清空删除本会话，归档保留，移除绑定先释放旧模型再清理同绑定记录；其他绑定及普通聊天不清理。尚在保存时强制结束进程的未提交修改不能保证恢复。
- [模型测试](../../tests/remote-model.test.mjs)覆盖重建恢复、网络读取前首次输入值、失败保留、迟到发送不清新稿、销毁后不写、读写错误与恢复；[存储测试](../../tests/remote-drafts.test.mjs)覆盖绑定/会话隔离、连续严格事务、重开、清理与旧包迁移。原组件回放覆盖保存失败提示/重试及正式 RemoteApp 移除绑定确认、只清理本绑定（原生桥为隔离夹具，未移除用户真实绑定）。手机全量 **193项**、Web 回放、Web/APK 构建及 Android lint 通过。
- [真实 Android 脚本](../../scripts/verify-remote-drafts-android.mjs)复用已归档的两条 DSH-TEST 工作流测试聊天，09:29:54 UTC分别填写中文换行/空格/表情和无工具测试消息；保存后立即 force-stop/relaunch，09:30:03 校验两份原文和历史回复数量不变，第一条手动清空，第二条主动发送并收到 `DSHM_DRAFT_SENT_1790242200633`。再次 force-stop/relaunch，09:30:13 两个输入框均为空，返回原联调聊天。报告 `artifacts/remote-draft-{prepare,verify,clean}-android.json` errors/resources均为空，截图已检查。未动权限、Key、电脑配置、工作区或上游/插件/网关。
- 保存反馈最后改为输入框上方的绝对定位文字，避免事务期间挤动聊天布局；Web/APK/lint重新通过并覆盖安装，09:34:05 UTC再次执行 clean，只读取两条测试会话，确认输入为空且无页面/资源错误，返回原联调聊天。此检查没有再次发模型消息。
- 测试最初在会话历史加载前统计回复数量，得到0并产生假失败；补上原工作流卡片已加载的等待后重测。第一次输入框恢复也晚于标题，产品已提前恢复，避免用户在网络加载中覆盖旧草稿。测试失败没有重新自动发消息；旧 localStorage 方案的通过结果不替代最终数据库包的上述验收。完整 Remote 仍按 R01–R16 推进。

## 电脑模型服务地址（2026-09-24）

- 插件0.1.25与新版网关/手机接入固定endpointRead/endpointWrite，自有电脑设置提供当前站点、输入完整新地址、核对目的地及恢复默认入口。使用原DeepSeek解析器/启动环境和SettingsProvider.mutate，保留版本冲突和继承，不返回旧路径/查询/认证。HTTP可用但明确警告；确认文字说明后续电脑Key和聊天将发送至新站点，不将模型地址与中继地址混淆。来源及详细边界见[设置边界](../../../docs/project-knowledge/knowledge/domains/remote-access/settings-boundary.md)。
- 原服务回归、网关真实HTTP/WS/SQL授权、手机模型和正式组件协议回放通过；插件73项、手机181项、双方类型检查、Web/APK构建与Android lint通过。回放覆盖确认前不写、取消不写、凭据URL拒绝、HTTP提示和恢复默认。随后补充保存已发出后权限变化/取消的迟到响应回归，地址模型最终3项通过，未知结果不会重建可编辑视图或自动重发；最终Web/APK/lint重新通过并覆盖安装，08:31:12 UTC再次验证管理权限已收回、设置访问被拒绝，errors/resources为空。181项是补充该回归前的全量结果，不冒充最终全量重跑。真实用户模型地址保存尚未验收，未发送模型请求或更改Key。
- 0.1.25已通过电脑插件页安装并重启，DSH PID24528、网关PID26696；正常APK覆盖安装保留历史/绑定/普通聊天Key。用户确认后临时授予管理，MuMu真实读取官方站点和Messages继承状态、输入HTTP测试地址仅进入核对并取消、重读原站点一致通过；[脚本](../../scripts/verify-computer-endpoint-android.mjs)没有保存或模型请求步骤。初次截图发现确认区被旧的通用div样式横向排列，已将元信息行样式限定到专用类、确认区改为纵向并允许地址断行，新增组件及真实入口无溢出断言。最终Web/APK/lint重建覆盖安装，`computer-endpoint-review-cancel-android.json`（08:25:26 UTC）通过，截图已检查。随后收回管理权限，`computer-endpoint-blocked-android.json`（08:25:54）拒绝访问，电脑显示聊天与任务操作；全部errors/resources为空。真实用户地址保存仍未验收，完整R14及R01–R16保持实施中。

## 电脑 Key 入口（2026-09-24，状态读取与取消通过）

- 插件0.1.24、新版网关及App提供官方DeepSeek默认Key的状态和原生仅写入口，需管理权限。自有「电脑设置」显示已配置/可修改状态，不回传旧Key；原生密码窗口负责输入与直接发送，页面不持有输入值，也不能直接发送keyWrite。自定义引用、只读来源按明确边界拒绝；原服务没有跨客户端原子CAS，不能把变更计数称为完整并发保证。来源及协议见[电脑设置边界](../../../docs/project-knowledge/knowledge/domains/remote-access/settings-boundary.md)。
- 用户确认临时授权后，[真实入口脚本](../../scripts/verify-computer-key-android.mjs)在MuMu读到configured=true/writable=true，打开原生密码窗口并取消，再读状态一致。报告`computer-key-view-cancel-android.json`（08:00:56 UTC）无页面/资源错误；随后收回管理权限，`computer-key-blocked-android.json`（08:01:18）验证设置不可访问，电脑显示聊天与任务操作。没有输入、保存、移除或读取真实Key内容，也没修改其他设置。首次测试因未安装的Playwright原生输入驱动而超时，改用系统控件观测后通过，失败不计通过。
- Host原LocalCredentialProvider在独立目录用无价值哨兵完成持久写入/移除及边界回归；MuMu生产密码窗口以隔离传输验证取消、密码遮蔽、两次删除确认、错误投影和未知结果拒绝重试。此类测试不能替代用户真实Key写入验收。手机179项、插件70项、后端38项通过（独立PostgreSQL1项跳过）；Web回放、双方类型检查/构建、Web/APK构建、最终Android lint及原生隔离检查通过。日志`computer-key-native-checks.log`、`computer-key-final-lint.log`，最终设置截图已查看。
- 插件页已确认v0.1.24运行；DSH PID73648、网关PID33668，正常APK覆盖安装保留原绑定/历史/手机Key。真实Key替换/移除、网络在途异常、其他provider/自定义引用及完整设置尚未通过。完整R01–R16保持实施中。

## 会话日志导出（2026-09-24，基础 MuMu 路径通过）

- 自有会话菜单提供「导出会话日志」、包含子会话选项和 Android 系统保存窗口。复用电脑原 `/api/session.export` ZIP 流，保留原持久化快照、附件与后代语义；相比手机自行重建 JSONL/ZIP，此方案避免两套日志格式和附件解析。没有加载电脑导出界面或开放任意 HTTP。
- 来源：[Host 固定导出](../../../plugin/src/session-export.ts)、[原 ZIP 服务](../../../deepseek-harness/packages/session-query/session-log-export/src/archive.ts)、[手机消费](../../src/remote-session-export.mjs)、[自有窗口](../../src/ui/RemoteSessionExport.jsx)、[真实入口脚本](../../scripts/verify-session-export-android.mjs)。插件 0.1.21 协商 sessionExport，网关/Host 严格参数校验；基本会话授权即可，未恢复已收回的设备管理权限。64 KiB分片、四块窗口、Host并发2、归档上限256 MiB；原生写入确认后才ACK，完整end后才保存，取消和断线不交付半成品。
- 手机171项、插件59项通过，后端35项及修正后的权限/路由2项通过（其中一个重叠，合计36项，独立PostgreSQL1项跳过）。初次网关用例给同一socket发送非法帧后等待错误消息，但实际策略为直接关闭socket；修正为schema拒绝断言后真实HTTP/WS/SQL两项通过，未改生产拒绝策略。两端类型检查、Web/APK构建和Android lint通过。
- `artifacts/session-export-android.json`（06:31:41 UTC）：从「DSHM 工作区保留验证 20260924」实际菜单分别关闭/开启包含子会话，保存21878字节ZIP，解压均为session.v3.jsonl，各行JSON有效且存在原回复标记；该测试会话无子会话/附件，不能据此宣称后代或附件专项通过。系统返回取消显示「已取消导出」，没有误报成功，页面/资源错误为空。首次脚本只识别.zip结尾，漏掉Android生成的.zip (1)，已按实际编号修正并重跑；未覆盖或删除用户文件。
- 插件0.1.21已通过电脑页面安装并重启，DSH PID37020、网关PID72340；正常APK覆盖安装，保留Key、历史和现有聊天授权。截图发现选项与按钮挤在同一行，已分行调整，最终Web/APK/lint重建、覆盖安装后06:35:34 UTC重新完成两种选项保存/解压及系统取消，errors/resources为空；最终截图已查看。电脑页面确认v0.1.21；文档64文件1169链接检查通过，Linear任务和项目状态同步且保持In Progress。真实后代/附件归档、大日志、撤销/断线竞争及电脑设置/反馈其余部分仍待完成，完整R01–R16保持实施中。

- 追加真实后代/附件验收（本批未修改产品代码、未重装App）：06:38:32 UTC `session-export-descendants-android.json` 从已归档「DSHM 嵌套恢复验证 1790221843241」导出：不开启后代为62419字节、只含父记录；开启为2496590字节、含父记录与两个直接子会话记录，以及2364981字节原PNG；进入图片子会话单独导出为2395298字节，仅其记录与PNG。图片逐字节等于原夹具，SHA256 `42643e60494b2f9e4d8ff121064e8b2083d50c3ea93882c4cae353edc075b911`。未重新发消息、恢复归档或变更模型/权限。
- 06:41:21 UTC `session-export-attachments-android.json` 从既有「DSHM Remote 联调提示」自有菜单导出4966232字节，包含原日志、2张图片、32份普通附件；文本附件逐字节一致。两批都通过系统保存/取消，errors/resources为空，最终回到原联调会话。[ZIP验收器](../../scripts/session-export-check.mjs)进一步检查四份真实归档：每条JSONL可解析、子目录ID匹配日志header、所有图片/文件内容哈希与原内容寻址路径相等，附件总字节分别为0/2364981/2364981/7233300；报告`session-export-integrity.json`。归档不只是界面显示成功。
- 新增Host上限与等待取消回归，[导出测试](../../../plugin/tests/session-export.test.ts)本批3项通过，覆盖超过256MiB时停止原生产者、等待信用时取消不发end；这不是MuMu超大日志实测。原171/59/36项未重复运行，不混为本批结果。真实更深嵌套（当前maxDepth=1）、大日志与在途断线/撤销仍保留验收。

## 电脑设置接入（2026-09-24，首批五项 MuMu 路径通过）

- [边界与实施约束](../../../docs/project-knowledge/knowledge/domains/remote-access/settings-boundary.md)记录原接口、脱敏缺口及版本写入语义。原describe虽声明redactSecrets，但真实redactor保留union中的secret、未知字段和未标记的headers；pi-ai原headers为普通dict且仅验证Fetch合法性。测试哨兵通过原函数复现，无读取用户秘密。[回归](../../tests/remote-settings-boundary.test.mjs)本批1项通过并确认当前协议继续拒绝通用settings/credentials入口。
- 插件0.1.23、新版网关与App接入 `remote.settingsRead/settingsWrite` 和「Remote选项→电脑设置」自有表单。仅支持原DeepSeek思考、思考强度、回复上限、上下文长度、等待输出超时五项；使用原SettingsProvider和mutate持久化，必填版本与连接绑定的一次性快照，网关/Host独立检查管理权限。安全投影在电脑完成，不返回完整schema/base/user、地址、headers或原始错误。未知写入不自动重发，旧表单/冲突要求重新读取。
- 来源：[协议](../../../backend/packages/protocol/src/remote-settings.ts)、[Host](../../../plugin/src/computer-settings.ts)、[手机模型](../../src/remote-settings.mjs)、[自有表单](../../src/ui/RemoteComputerSettings.jsx)、[真实入口脚本](../../scripts/verify-computer-settings-android.mjs)。手机176项、最终插件66项、后端37项通过（独立PostgreSQL一项跳过），双方类型检查、正式组件协议回放、Web/APK构建和Android lint通过。真实保存发现Cordis追踪代理身份每次变化导致误报过期；真实ctx.get方式先复现4项失败，改为公开symbols.original核对服务身份后回归及真实保存通过，未取消版本/归属检查。
- 用户单独授权现有DSHM Android临时管理权限。读取五项后仅将等待输出超时从继承的300000ms改为301000ms，保存并重新读取确认；07:12:38 UTC `artifacts/computer-settings-change-android.json`通过。07:15:43 UTC `computer-settings-restore-android.json`恢复300000ms及overridden:false。电脑页收回管理权限后显示“已批准／聊天与任务操作”；07:16:49 UTC `computer-settings-blocked-android.json`确认手机设置被拒绝、无编辑入口。报告errors/resources为空，最终恢复截图已检查；未改Key、服务器地址或其他配置，保留绑定和聊天授权。
- 插件0.1.23已通过电脑页面安装并重启（DSH PID72976，网关PID58480），正常APK覆盖安装，保留Key/历史。首次截图发现表单控件过高，已调整为44px，重建安装后完成上述最终实测。仅写密钥、地址、其他provider/通用偏好和第三方设置，以及真实跨端冲突/在途断线仍待验收；原服务测试覆盖CAS和秘密保留，不冒充这些真实场景。完整R14和R01–R16保持实施中。

## 已有工作区管理（2026-09-24，真实 MuMu 与电脑基础路径通过）

- 手机自己的「管理工作区」窗口提供改名、排序和确认移除注册。复用原 ClientWorkspaceModel 与电脑生成 RPC，不复制 WorkspaceRegistry；选择此方案以保持电脑投影、顺序及业务错误一致，另建手机工作区模型会增加双端状态维护。移除原注册不删目录、文件或聊天，不开放手机创建工作区。
- 插件 0.1.20 声明 workspaceManagement；网关和 Host 分别要求设备 management 授权，严格拒绝额外字段/路径/文件删除标记。普通设备不会因升级得到权限。改变授权沿用原票据作废和断线流程。手机检查目标是否已变化、阻止重复写入，结果未知不重发；原接口没有版本 CAS，不宣称提供跨端 CAS。
- 来源：[手机操作层](../../src/remote-workspaces.mjs)、[自己的管理窗口](../../src/ui/RemoteWorkspaces.jsx)、[策略](../../../backend/packages/protocol/src/remote-policy.ts)、[原命令](../../../deepseek-harness/packages/api/workspace-controller/src/commands.ts)。[手机测试](../../tests/remote-workspaces.test.mjs)、[网关测试](../../../backend/tests/workspace-policy.test.ts)、[真实HTTP/WS权限测试](../../../backend/tests/remote-permissions.test.ts)、[Host测试](../../../plugin/tests/remote-adapter.test.ts)与[页面回放](../../scripts/verify-remote-plugin-slots.mjs)分别覆盖权限、精确参数、业务拒绝、排序、取消、确认移除、旧目标和未知结果。测试替身只用于隔离回放，不冒充真实电脑写操作。
- 手机167项、插件57项、后端36项通过（独立PostgreSQL一项跳过）；类型检查、Web/APK构建和Android lint通过。页面回放首次错误重复发baseline，被原状态流拒绝；修正为upsert/remove/order后通过，保留原协议约束。
- 插件0.1.20已通过电脑页面安装并重启，DSH PID53564、网关PID63336；正常APK覆盖安装保留原绑定/Key/历史。MuMu `remote-workspace-access-android.json`（最终06:06:19 UTC）验证能力可识别、普通权限明确提示且无写入口；联合插件/重连回归errors/resources为空。初次截图发现窗口漏标题，已统一可见标题与无障碍标题映射，最终Web/APK/lint重建、覆盖安装和实际入口重测通过，最终截图已确认标题显示。文档64文件1158链接通过。
- 用户明确允许临时为现有 DSHM Android 授予管理权限，验收后收回。电脑插件页核对指纹并授予；通过 Windows 原生目录选择器登记项目内 `artifacts/DSHM-WORKSPACE-TEST-20260924`，其中 `keep.txt` 为受控保留标记。没有通过手机开放工作区创建，也未改其他工作区。
- [真实 Android 脚本](../../scripts/verify-remote-workspaces-android.mjs)分阶段操作正式自有页面：prepare（06:12:07 UTC）在该工作区新建「DSHM 工作区保留验证 20260924」，只发送一次无工具标记请求；rename（06:12:37）改为带 RENAMED 后缀，sort（06:12:57）移到最后，remove（06:13:16）确认后移除注册。电脑内置浏览器逐项核对同名、顺序及注册消失；原 DSH-TEST 保持。
- preserved（06:13:18）在手机重新打开测试聊天并读到唯一回复 `DSHM_WORKSPACE_CHAT_KEPT_20260924`；电脑「未分组」也能打开同一历史。目录仍在，keep.txt 内容逐字一致，SHA256为 `32A701CDD45D2A4271A7D214F81F577FD0416DFF3DEB3743A20654EC63BB1CE0`。测试聊天和文件保留作证据，未将删注册伪称删除数据。
- 电脑点击「收回管理权限」后显示「已批准／聊天与任务操作」；revoked（06:14:35）手机重新连接，管理窗口无写入口，原「DSHM Remote 联调提示」历史仍可读取。未撤销原绑定，未操作插件管理或设置。各阶段 `artifacts/remote-workspace-<phase>-android.json` 的errors/resources为空，移除确认截图已检查；旧链接验收019保持已撤销。
- 本轮仅新增真实入口脚本及文档，没有修改产品代码/重装App；未重复跑上轮167/57/36项，将两批结果区分。工作区三项基础路径通过，不代表工作区跨端并发、在途断线以及R14设置/日志或完整R01–R16通过。

## 列表搜索与电脑索引（2026-09-24）

- 当前实现：手机继续使用原 `ClientSessions.search` → `session/search`，标题在当前会话目录匹配，正文命中展示电脑返回的纯文本摘要；不另存电脑全文到手机，也不把摘要作为 HTML 执行。180ms 输入合并，关键词改变、进入会话、连接状态改变和卸载时取消旧请求，旧结果不能覆盖新查询。工作区与归档过滤使用原工作区快照，不改变聊天归属。
- 补齐搜索中、无结果、失败重试和 `hasMore` 提示。标题匹配可先显示，正文请求失败时明确说明；有限结果未返回当前范围匹配时，不能据此断言完全无匹配。上游接口每次最多返回20个会话、摘要240码点，没有游标参数，因此结果过多时提示缩小关键词，不能伪造“加载更多”。正文按上游 unicode61 token/短语检索，不承诺任意子串或附件文件搜索。
- 来源：[正式列表](../../src/ui/RemoteWorkspace.jsx)、[原搜索实现](../../../deepseek-harness/packages/api/session-controller/src/list.ts)、[原接口](../../../deepseek-harness/packages/api/session-controller/src/types.ts)、[SQLite配置说明](../../../deepseek-harness/packages/session-query/session-query-sqlite/README.zh.md)、[真实Android检查](../../scripts/verify-remote-search.mjs)、[页面协议回放](../../scripts/verify-remote-plugin-slots.mjs)。比较仅做标题筛选与复用原正文搜索：前者遗漏正文且无法提供真实摘要；后者保留电脑授权和检索语义，手机只补齐交互状态。
- 实际默认 DSH Web 返回 `gateway/internal`，原因是上游 `session-query-sqlite.openAt: never`。手机现在显示“电脑尚未开启聊天内容搜索，当前仅搜索标题”，不将它误报为网络故障。以[临时配置](../../tests/fixtures/search.cordis.patch.yml)按官方方式设置 `path: ':memory:'`、`openAt: first-search` 后，真实搜索可用；首次覆盖遗漏 path 导致服务未加载，已补齐并重启，这次失败不计通过。配置是替换该条 config，不能只写 openAt。测试未修改用户持久 profile 或只读上游，索引只在电脑内存中。
- MuMu 报告 `remote-search-android.json`（2026-09-24T05:40:51.519Z）：在既有 `DSHM Remote 联调提示` 读取标记 `DSHM_HTML_ATTACHMENT_READY`，正文查询返回真实摘要、工作区筛选、归档排除当前会话、无结果、标题匹配、重新打开原会话及草稿保留通过；无发送/新建/归档操作，errors/resources为空，截图已查看。随后恢复原 `apps/cli/lib/bin.js web --no-open`，PID **67200**；`remote-search-disabled-android.json`（05:42:17 UTC）验证明确的关闭提示、标题搜索和打开原会话通过，错误为空。
- 164项Node测试、正式组件协议回放、Web/APK构建和 Android lint通过。回放覆盖加载不提前报空、摘要按文本渲染、旧关键词迟到、清空取消、失败保留标题/重试、索引关闭和结果上限；不把回放当作真实网络异常验收。日志 `search-node-tests.log`、`search-slots-final.log`、`search-web-final.log`、`search-android-final.log`。正常App覆盖安装保留Key/绑定/历史。完整索引规模/性能、真实网络在途竞争、嵌套会话及R01–R16剩余项未完成。
- 最终APK补齐有限返回不误报全部为空的边界后重新通过组件回放、Web/APK构建/lint，覆盖安装后 `--search-disabled --plugins` 联合回归通过，`search-final-regression.log`、`remote-search-disabled-android.json` 和 `remote-mobile-plugins-android.json` 的页面/资源错误为空；已查看内容命中与索引关闭截图。64文档1140本地链接校验通过，Linear KKC-18与项目状态已同步，继续In Progress。

## 后台任务的已记录输出（2026-09-24）

- 状态：新版 APK 已覆盖安装，MuMu 已验证“后台任务 → 查看输出记录”、真实输出和退出码、全屏/缩小及返回列表。完整实时输出通道仍未完成，不将本次记录查看等同于 R09 全部输出能力。
- 来源：[输出关联](../../src/remote-job-output.mjs)、[手机输出窗口](../../src/ui/RemoteJobOutput.jsx)、[模型测试](../../tests/remote-job-output.test.mjs)、[真实入口脚本](../../scripts/verify-remote-jobs.mjs)、原 [JobHooks 契约](../../../deepseek-harness/packages/jobs/jobs/src/types.ts)、[JobRegistry 实现](../../../deepseek-harness/packages/jobs/jobs-local/src/index.ts)、[job_output 工具](../../../deepseek-harness/packages/jobs/tool-jobs/src/index.ts)。
- 比较直接调用 jobs.read 与复用原会话记录：前者会消费唯一输出游标，结束后还会改变 reported，可能让电脑模型读不到内容或漏掉完成通知，因此当前查看页只订阅原 UiConversation 的 job_output 工具投影，不新增写入或消费调用。完整实时读取后续必须提供独立观察游标及可靠的任务/输出源绑定，不能用主动执行 job_output、猜测输出文件路径或修改共享读取位置来替代。
- 关联要求同一会话、同一任务 id/startedAt，并且实际调用时间不早于本代任务；缺少调用头/时间不猜测，用户可加载更早记录。嵌套调用仍按原投影读取，各次读取分开保留，终态重复输出不拼接为假流。保留 ANSI/原始截断和状态行；隐藏节点不展示。窗口显示断线最近记录，任务替换则失效，切换会话关闭。长内容默认120行，可展开；分段复制沿用原手机剪贴板限制。
- 162 项 Node 测试、原 RemoteWorkspace 页面/插件回放、Web/APK 构建与 Android lint 通过，日志 `artifacts/job-output-{tests,web,build,android-build}.log`。页面回放覆盖空记录、真实 tool/call→tool/result 更新、全屏、任务编号复用失效、返回列表、切换会话及没有新增 RPC。首次回放失败是夹具直接从 seq10 开始触发原历史补页，补齐从0连续序列后通过；未改生产投影以迎合夹具。
- `artifacts/remote-job-output-android.json`（2026-09-24T04:24:10.042Z）：在 `DSHM 后台任务联调 1790223854837` 发起仅休眠25秒并 Write-Output 的测试命令，真实 `pwsh-1` 完成。随后由电脑模型正常调用 job_output，手机页读到 `DSHM_BACKGROUND_DONE` 与 `[status: completed, exit code: 0]`；读取行为来自测试聊天要求，查看页本身不发起工具调用。全屏截图 `remote-job-output-android.png` 已检查，无横向溢出，`job-output-live.log` 的页面/资源错误均为空。测试会话已归档并返回原联调聊天，没有新增权限、清库或修改上游。
- 未覆盖：真实多页输出补读/分页失败、断线在途完整矩阵、未写入会话的实时输出和电脑已丢失/截断部分。任务快照随 Host 生命周期丢失时不把旧日志伪装成当前后台进程；完整历史任务管理仍保留范围。
- 进一步核对原 shell/processJob、JobRegistry 与 subprocess：独立偏移读取只存在于底层 SubprocessHandle，ShellProcess 仍是消费式读取，JobRegistry 的公开观察回调不暴露输出或句柄绑定。因此不根据命令文本/时间猜测进程、不替换全局 shell/jobs 服务或读取私有记录；当前没有安全完整通道。该能力保留待实现，继续推进独立的 R01 系统入口，不将记录查看当作完整输出交付。

## 系统分享与 App 配对链接（2026-09-24）

### DSHM 内置扫码与图片识别

- 状态：新版正常 APK 已覆盖安装，新增“扫描二维码”和“从图片识别”。识别只填入现有确认页，不自动领取，不新增设备授权；现有绑定、Key 和历史保留。与云端识别相比，选用本地 ZXing 解码可避免上传一次性材料；与仅依赖第三方扫码器相比，内置入口可保留同一确认流程和取消行为。第三方唤起兼容性、相机实际识别与完整配对异常仍未验收，R01–02 保持实施中。
- 来源：[扫描生命周期](../../android/app/src/main/java/dev/dshmobile/validation/RemotePairScanner.kt)、[本地图片解码](../../android/app/src/main/java/dev/dshmobile/validation/RemotePairQr.kt)、[原生测试](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemotePairQrChecks.kt)、[实际入口脚本](../../scripts/verify-remote-pair-scan-android.mjs)。相机 Activity 非导出，图片只读系统选择器临时授权的 content URI；压缩数据最多8 MiB、原图最多6400万像素、采样最长边2048，后台解码。相机和图片都再次调用既有配对解析器，页面切换、绑定、外部新链接或超时取消旧请求，迟到结果不得覆盖新页面。
- `remote-pair-scan-android.json`（2026-09-24T05:25:42.779Z）验证系统图片选择取消保留输入、桌面 qrcode 生成的图片正确回填规范链接并显示 HTTP 提醒、普通网页二维码被拒绝且不跳转、相机打开/取消后输入保留；页面错误为空，截图已查看。全部图片使用固定无效 key，仅检查格式/解码，没有领取设备。最初测试假设会出现权限弹窗而失败；核查显示 MuMu 已授权相机，撤销并设置拒绝标记后仍重新授权。因此最终报告明确记录权限拒绝未验证，不把相机取消当作权限拒绝通过，也不声称已从相机画面识别二维码。
- 164项Node测试、Web构建、Android assembleDebug/assembleDebugAndroidTest/lintDebug通过，日志 `pair-scan-node-tests.log`、`pair-scan-web-build.log`、`pair-scan-final-android-build.log`。实际 instrumentation 的 `pairingQrChecks=true`、整体PASS：覆盖HTTP/App链接、倒色/透明图片、非配对二维码、无二维码、损坏和超限输入，沿用现有安全测试。日志 `pair-scan-native-checks.log`。默认构建产物已恢复正常包；独立包仅用于本轮测试，未清除正常App数据。

- 正常包回归 `remote-mobile-plugins-android.json`（2026-09-24T05:26:57.636Z）通过，页面与资源错误为空；日志 `pair-scan-main-regression.log`，原绑定和历史保留，未更改 Key。核对本轮安装时间后已卸载独立测试包，并清理两张固定无效二维码测试图片；正常包未卸载或清库。文档校验64文件1132链接通过。

### 电脑生成 App 链接与二维码

- 插件 **0.1.19** 已安装到实际 DSH，编译入口进程 PID **39808**；网关仍为 **61912**。配置页从同一 `/pair#key=...` 派生 `dshm://pair?server=...#key=...`，不新增 key 或改变领取/批准协议。二维码使用打包在浏览器产物中的 qrcode，本地生成固定黑白 SVG 与四模块静区，不调用第三方二维码服务。复制失败保留手动选择，隐藏或原五分钟计时清除整张配对卡片。
- 来源：[配对卡片](../../../plugin/src/client/pair-card.tsx)、[链接与 SVG 路径](../../../plugin/src/client/pair-link.ts)、[独立解码测试](../../../plugin/tests/pair-link.test.ts)、[真实有效链接脚本](../../scripts/verify-remote-pair-valid-android.mjs)。选择打包生成而非外部二维码接口，避免将一次性材料交给第三方；现有粘贴入口保留。DSHM 内置扫码和第三方扫码器唤起兼容性仍待验收，不把生成二维码等同于扫码端完成。
- 插件 typecheck、build、**56 项测试**通过，报告在插件 `artifacts/pair-qr-{typecheck,build,tests,pack}.log`。HTTP、HTTPS、IPv6 App 链接均从真实 SVG 路径通过独立 jsQR 解码，key 与 origin 完全一致；异常路径、账号、查询参数、非网络协议拒绝转换。库及类型只作为构建依赖，生成器已内联到 ModuleLoader 包。
- 实际插件页面已确认版本/在线状态、二维码显示和复制 App 链接内容一致；复制检查后恢复原空剪贴板；批准后二维码和两种链接一起清除，重新生成后手动隐藏也全部清除。本轮没有实际等待五分钟验证计时，仍沿用原管理组件的过期 effect，不能把隐藏检查冒充计时实测。MuMu 独立包通过有效 App 链接冷启动，先显示服务器与 HTTP 提醒，没有自动领取；点击继续后进入等待批准，电脑与手机指纹一致。报告 `artifacts/remote-pair-valid-claim-android.json`（**2026-09-24T05:02:18.628Z**），errors为空，截图已查看。链接通过标准输入交给测试脚本，不写入报告或磁盘配置。
- 用户确认后，仅批准 `DSHM App 链接验收 019`（指纹 `3EBks0zBMBA_numscjhVi2E1LWthjSASoROPCEmrGrw`）的聊天权限，没有授予管理权限。`remote-pair-valid-connected-android.json`（05:06:07 UTC）确认加载 `/assets/web/remote.html` 自有页面，打开 `DSHM Remote 联调提示` 并读到23条模型回复；未发消息。电脑撤销后会话立即移除，`remote-pair-valid-revoked-android.json`（05:07:22 UTC）进一步点击重新连接，实际授权状态拒绝恢复。各报告 errors为空，连接/撤销截图已查看；电脑独立核对设备已撤销。隔离包 `dev.dshmobile.validation.pairingtest` 在核对安装时间后已卸载，仅移除本轮新建的测试包；正常包未清除或卸载，默认构建产物已恢复正常包 ID。
- 正常包在插件升级/DSH 重启后通过真实插件与重连检查：`artifacts/pair-qr-main-regression.log` / `remote-mobile-plugins-android.json`（**05:03:26 UTC**），页面/资源错误为空，原历史/绑定保留。未更改普通聊天 Key。原完整 R01–R16 范围与独立后台实时完整输出缺口保持。

- 状态：新版普通 APK 已覆盖安装，系统入口、已有绑定保护、隔离未绑定入口和真实网关无效 key 拒绝通过 MuMu。电脑插件 App 链接和二维码已补齐，真实有效链接已完成领取、批准、自有聊天读取、撤销与拒绝重连；内置扫码/图片识别已接入，实际相机识别及完整异常仍未验收，R01–02 未全部完成。
- 来源：[外部入口](../../android/app/src/main/java/dev/dshmobile/validation/PairingEntryActivity.kt)、[原生解析](../../android/app/src/main/java/dev/dshmobile/validation/RemotePairLink.kt)、[单次内存交接](../../android/app/src/main/java/dev/dshmobile/validation/RemotePairHandoff.kt)、[RemoteActivity](../../android/app/src/main/java/dev/dshmobile/validation/RemoteActivity.kt)、[原生桥](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)、[确认页](../../src/RemoteApp.jsx)、[展示用地址提取](../../src/remote-pair-link.mjs)、[Android 验收脚本](../../scripts/verify-remote-pair-link-android.mjs)。
- 采用系统分享原 HTTP/HTTPS 链接和 `dshm://pair?server=<encodeURIComponent(origin)>#key=<43位key>`，不注册任意 HTTP 网站以争抢浏览器；既有手动粘贴仍可用。严格限制协议、主机、端口、路径、唯一服务器参数和 fragment，拒绝 userinfo、控制字符及非网络来源。key 不进入网关 URL/query；既有 DPoP/claim 与电脑批准逻辑保留，显示用 JS 地址解析不参与认证准入。claim 的实际409映射为配对链接已失效提示，不透明重试。
- 外部入口是单独临时任务栈，校验后向非导出的 RemoteActivity 传一次性交接编号。链接只在进程内保留最多5分钟且最多一条，取走即清除；目标任务 Intent 不含 key，网页无持久化。已绑定时仅提示，不发起 claim、断开或覆盖。打开链接只填入输入框，用户可核对服务器和HTTP提示再继续；冷启动的返回普通聊天会建立普通聊天入口。
- 验证发现同一任务栈会使第二次系统分享直接投递到栈顶 RemoteActivity，跳过外部入口，导致链接不更新；独立 entry taskAffinity 后原问题消失，复用同一个 Remote WebView。冷启动原先未经过 ValidationActivity，补上 RemoteActivity 的 DEBUG-only WebView 调试开关。首次脚本存在双标题选择歧义及无输入框时等待、最初 taskAffinity 包名含连字符导致隔离包安装失败，均保留失败记录；纠正后按最终包重新验证，不计入通过。
- 最终 `artifacts/remote-pair-link-android.json`（2026-09-24T04:46:50.812Z）：正常包已有真实绑定保持连接；`dev.dshmobile.validation.pairingtest` 的不同 UID/存储验证冷启动分享、二次 HTTPS 分享、同页更新、交接不重放、file 协议拒绝、App 链接手动粘贴的 HTTP 提示、真实网关对固定无效 key 的409拒绝、返回普通聊天。未批准任何新设备，errors为空；最终错误页截图已查看。该隔离包通过 `-PisolatedPairingTest=true :app:assembleDebug` 构建，不清除正常用户数据；默认产物已恢复普通包 ID。本次新建的隔离包验收后已卸载，正常 App 保留，04:47:44 UTC 的插件/重连回归无错误。
- 164项Node、Web构建、APK构建/Android lint、真实 Android instrumentation 均通过。原生检查覆盖HTTP/HTTPS/IPv6/App格式、越界端口/账号/编码路径/重复参数等拒绝、内存交接的替换和单次消费；同一 runner 的既有安全检查也通过。日志 `pair-link-tests.log`、`pair-link-final-android-build.log`、`pair-link-native-checks.log`、`pair-link-final-live.log`。正常包真实插件/重连回归 `pair-link-main-regression.log` 通过，原绑定/历史保留。后台完整独立输出、扫码和其余 R01–R16 保持未完成。

## 子会话目录、续聊与停止（2026-09-24）

- 状态：真实 MuMu 与电脑通过一次性子任务历史、可继续子会话双端文本续聊、手机停止与父子草稿隔离，以及直接子会话的 Host 重启恢复、恢复后续聊、图片接纳/拒绝及历史预览。2026-09-25 两层嵌套导航、电脑重启恢复、父离线停止与返回持久化父会话已通过，测试后恢复默认一层与正常启动入口；完整异常、R03/R09 及整体继续实施。父离线最新依据见本文开头，以下保留插件 0.1.18 起的历史依据。
- 来源：[RemoteModel](../../src/remote-model.mjs)、[目录界面](../../src/ui/RemoteSubagents.jsx)、[类型与提示](../../src/remote-subagents.mjs)、[原目录与地址](../../../deepseek-harness/packages/api/session-controller/src/client/sessions/manager.ts)、[原 Host 控制](../../../deepseek-harness/packages/subagent/subagent/src/index.ts)、[Android 验收](../../scripts/verify-remote-subagents-android.mjs)。比较另建手机子任务表与复用原 ClientSessions，采用后者；目录的 inactive 不是完成状态，diagnostic 行保留错误提示，不能静默丢弃。
- 当前会话及其父目录随原事件/重连刷新；选择与返回传原 SubagentAddress，客户端重建保留完整地址和返回链。一次性任务不显示输入框或停止；可继续任务父状态未确认/不可用时禁止发送，运行中的独立停止不依赖父在线。原 Host 校验父子归属与执行所有权。文件 receipt 不进入子会话；图片走新增固定 `subagents/prompt` 分片地址，旧能力不回退大帧 RPC。
- 基线上游 Session.prompt 的子会话分支重建 requestId，会与 beginSubmission 回显不一致。手机直接调用同一原生成 subagents.prompt 并保留回显 id，拒绝时释放回显，接受后由原记录/Inbox 退休；没有修改上游或另造认证。原接口回放验证父子地址、嵌套返回、草稿、恢复载荷、业务拒绝、父离线发送/停止和回显退休。图片分片测试验证 2.4 MB 内容及严格路由，但不冒充真实模型图片验收。
- 实际 `DSHM 子会话联调 1790220930536`：一次性子任务回复 `DSHM_CHILD_READY_1790220930913`，手机目录显示“当前未运行 · 只读记录”；03:35:51 UTC 的 `remote-subagents-inspect-android.json` 验证没有输入/停止入口、返回父草稿保留。可继续子任务回复 `DSHM_CONTINUABLE_READY_1790221028951`，手机续聊收到 `DSHM_CHILD_CONTINUED_1790221052158`，03:37:31 UTC 的 `remote-subagents-continue-android.json` 验证输入清空、没有残留发送回显、父草稿保留。内置浏览器独立打开电脑同一子会话核对该消息与回复。
- 电脑发送 `DSHM_CHILD_PC_SYNC_20260924` 的测试，手机读取成功且自己的草稿保留。最初停止脚本把隐藏思考段也匹配进来导致 strict-mode 错误，保留 `remote-subagents-pc-and-stop-android.json`；修正为可见正文后 **未重复发送**，`remote-subagents-stop-existing-android.json`（03:39:35 UTC）停止同一进行中输出，电脑核对“已停止”且 Stop 消失。两张手机截图已查看。03:40:11 UTC `remote-subagents-finish-android.json` 归档父测试会话并回到原联调聊天，电脑也返回原聊天；无文件操作或权限变更。
- 手机全部 **157 项**、插件 **53 项**、后端 **34 项**通过（独立 PostgreSQL 1 项未运行）；补强回显观察后模型 **38 项**再次通过。原页面/插件联合 Web 回归、Web/APK 构建、Android lint、后端/插件类型检查通过；新增协议限制测试 **6 项**通过。日志 `subagents-all-tests.log`、`subagents-model-final.log`、`subagents-web-tests.log`、`subagents-android-build.log`，后端/插件同名主题日志在各自测试目录。03:34:26 UTC 的既有 Remote Android 联合回归无页面/资源错误，保持原 Pro/High/只读/草稿及单个输入框。当前 DSH PID 64004、网关 PID 61912。

### 两层子会话与电脑重启恢复（2026-09-25）

- 通过电脑原「插件 → Subagent」页面，把默认继承的最大递归深度从1临时设为2；并行上限8、模型选择关闭保持不变。使用原设置服务的配置能力，没有修改上游源码或为手机增加管理权限。
- [恢复脚本](../../scripts/verify-remote-child-recovery-android.mjs)新增 `DSHM_CHILD_TEST_PREFIX`，分开保存不同轮次的证据。真实 MuMu 创建专用父会话、可继续子会话和一次性孙会话；原目录实际存在孙会话且展示准确回复，不能只凭模型声称成功。12:43:09 UTC 的 [导航报告](../../artifacts/remote-nested-recovery-20260925-navigate.json)确认孙会话只读、逐级返回与父子草稿隔离。
- [重启报告](../../artifacts/remote-nested-recovery-20260925-watch.json)在 READY 后观察实际 DSH 进程10784被结束、新进程46196按原无补丁参数的源码启动入口恢复；网关57392持续运行。手机观察到连接中断后自动恢复原孙会话，保留完整返回链和两层草稿；返回父会话后再进入子会话发送限定的无工具消息，收到 `DSHM_CHILD_RECOVERED_1790340262075`。没有重发旧操作或手动重连，报告 errors 为空，两张截图已查看。
- 12:44:49 UTC 的 [清理报告](../../artifacts/remote-nested-recovery-20260925-finish.json)确认专用父会话已归档、手机回到原联调聊天。电脑原页恢复默认并保存，深度显示1且无覆盖标记；未改 Key、绑定或设备权限。此次仅修改验收脚本与文档，没有产品代码或 APK 变更。父不可用时停止运行中子任务、复杂连续断线与其余完整范围仍待验收。

### 子会话恢复与图片追加验收（2026-09-24）

- 来源：[恢复脚本](../../scripts/verify-remote-child-recovery-android.mjs)、[图片脚本](../../scripts/verify-remote-child-images-android.mjs)、原 [深度配置](../../../deepseek-harness/packages/subagent/subagent/src/index.ts)。只操作新建的 `DSHM 嵌套恢复验证 1790221843241` 与其子会话。该配置默认 `maxDepth=1`，实际工具返回 `subagent depth 2 exceeds maxDepth 1`；没有修改电脑配置。模型随后声称嵌套成功，但原目录为空、工具明确失败，因此**不采信该回复作为通过证据**。`remote-child-recovery-navigate.json` 明确标为 nestedUnavailable，嵌套仍待允许深度的环境实测。
- `remote-child-recovery-watch.json`（03:53:33 UTC 启动）在脚本打印 READY 且进程确认存活后，重启实际 DSH 编译入口。观察连接中断和自动恢复，当前直接子会话、父子地址及各自草稿保留，恢复后收到 `DSHM_CHILD_RECOVERED_1790222052418`。没有手动重连或重发旧操作；本结果仅覆盖直接子会话。新 DSH PID **34876**、网关仍 **61912**，启动日志留在本地，不输出带凭据链接。
- `remote-child-images-rejection.json`（03:56:18 UTC）：系统选择器选取 **2,364,981 B** PNG，Pro 子会话真实拒绝图片，保留文字和待发送图片，没有新增模型回复或残留发送回显。之后移除测试图片，恢复原子草稿。
- `remote-child-images-prepare.json`（03:59:28 UTC）在专用父会话临时选择 Flash，创建继承该模型的可继续子会话，再恢复父会话 Pro；没有改变原联调会话模型。`remote-child-images-send.json`（03:59:44 UTC）验证同尺寸 PNG 经原 `subagents/prompt` 进入真实模型，提示词不包含颜色，回复为蓝、红、绿；历史原附件在 DSHM 自有窗口解码为 1024×1024，截图已检查，页面和资源错误为空。
- 首次图片准备脚本在异步模型窗口尚未关闭时填写了 inert 背景输入框，实际发送了测试父草稿而非预期提示词，120 秒等待失败。保留 `remote-child-images-prepare-first-attempt.json`；现等待窗口真正卸载并核对历史中的准确提示词后才继续。第二次创建与图片发送均成功；第一轮不计为产品通过，也没有修改 App 行为来迎合脚本。
- `remote-child-recovery-finish.json`（04:00:20 UTC）已归档测试父会话并返回原 `DSHM Remote 联调提示`。Key、绑定、原历史保留；没有安装/清库或改上游。新增脚本语法检查通过，本轮未改产品代码，因此不把此前 157/53/34 项报告称作本轮重跑。完整子会话异常、嵌套、父离线停止和其余 R01–R16 继续保留。
- 源码核对发现子会话模型菜单原先沿用普通 `session/selectModel`，而原 ModelDirectory 与 Host agent ownership 明确拒绝对子会话调用该路由。子会话图片验证通过创建时继承 Flash 完成，不能据此声称子会话内切换模型已实现。该入口随后按下节修正为真实状态查看，并明确提示电脑端限制。

### 子会话模型入口修正（2026-09-24）

- 当前行为：子会话输入框显示原 `modelSelection` 投影的实际值，打开“当前模型”查看勾选与思考强度；所有更换项禁用并说明当前电脑端不支持。菜单提供同一窗口，一次性只读任务也能查看。普通会话仍使用原切换接口。模型层在发送 RPC 前拒绝子会话地址，不仅依赖按钮禁用。
- 来源：[原 ModelDirectory](../../../deepseek-harness/packages/client/ui-model-selection/src/client/directory.ts)、[原插件入口](../../../deepseek-harness/packages/client/ui-model-selection/src/client/index.ts)、[Host 路由](../../../deepseek-harness/packages/api/session-controller/src/agent.ts)、[手机模型层](../../src/remote-model.mjs)、[共享页面](../../src/ui/RemoteWorkspace.jsx)。比较另造子会话写接口与遵守原 Host 能力，当前采用后者，避免把子会话当普通 Agent 激活；没有扩大协议或修改上游。**这不是新增子会话模型切换能力**，当前 Host 限制仍保留。
- 回归覆盖一次性/可继续子会话均不调用普通 `session/selectModel`、返回父会话后能真实走该接口；页面回放覆盖菜单和输入框入口、投影更新时显示新模型、只读提示及所有选项禁用。完整手机 **158 项**通过，其中模型层 **39 项**；Web 页面/插件回放、Web 构建、Android assembleDebug/lintDebug 通过。日志为 `artifacts/child-model-{tests,all-tests,web,web-build,android-build}.log`。
- 新 APK 覆盖安装后，[实际 Android 脚本](../../scripts/verify-remote-child-models-android.mjs)只读打开此前归档的专用父会话及两个子会话，验证实际 Pro/High 勾选、菜单/输入框两个入口、一次性任务无输入框、草稿保留，未恢复归档或发送消息。`remote-child-models-android.json`（04:07:52 UTC）错误/失败资源为空，截图已查看，结束返回原联调聊天。
- 普通会话回归实际将 Pro 切为 Flash，再恢复 Pro/High，草稿保留，页面/资源错误为空；报告 `remote-child-root-flash-android.json`（04:08:40 UTC）与 `remote-mobile-models-android.json`（04:08:56 UTC）。这次没有用电脑浏览器重验反向同步，不把该检查夸大为新的双端全矩阵。Key、绑定、历史保留，后端与插件未修改。
- 嵌套/父离线停止、完整异常、后台输出/工作流、插件完整能力及其余 R01–R16 继续实施。不能以已修正无效入口为由关闭完整子会话或整体任务。

## 手机主动切换计划模式（2026-09-24）

- 状态：插件 **0.1.17**、新版网关与 App 已在 MuMu 验证空闲时的双向开关。来源：[手机控制](../../src/remote-plan-mode.mjs)、[自有窗口](../../src/ui/RemotePlanMode.jsx)、[协议边界](../../../docs/protocol.md#当前会话计划模式)、[实际验收脚本](../../scripts/verify-remote-plan-mode-android.mjs)。运行中真实切换、完整多端异常及 R01–R16 其余范围继续保留。
- 对比直接允许任意电脑命令与复用两个固定原计划命令，采用后者：手机仅发送 `/plan` 或 `/plan off`，网关和插件双侧校验无附件、无多余字段，不开放命令输入框。`/plan on` 会被原 Host 当作用户消息，本入口明确拒绝。协商能力与原命令 definitionId 核验避免旧插件或同名第三方命令被误用；当前/等待状态完全取自原 plan 投影，RPC 成功不伪造已生效。
- MuMu 会话 `DSHM 计划开关联调 1790219392318`：收到唯一 `DSHM_PLAN_MODE_READY_1790219393458` 后，手机开启计划模式，内置浏览器独立核对电脑 Plan 按钮与原命令记录；电脑按钮关闭、原指令重新开启，手机分别收到已关闭/已开启。最后手机关闭，模型回复数量仍为 **1**，未发送草稿保持完整；清理后会话归档并返回 `DSHM Remote 联调提示`。没有文件工具、执行命令或永久权限变化。
- 真实报告 `artifacts/remote-plan-mode-prepare-android.json`（**2026-09-24T03:09:47.421Z**）、`remote-plan-mode-pc-off-android.json`（03:11:01.899Z）、`remote-plan-mode-pc-on-android.json`（03:11:29.416Z）、`remote-plan-mode-finish-android.json`（03:11:30.537Z），errors/resources 均为空。已检查 `remote-plan-mode-prepare-android.png`，自有窗口文字和选中项清晰。
- Node **152 项**、插件 **52 项**、后端 **34 项**通过，独立 PostgreSQL 测试 1 项跳过；双方类型检查构建、Web/APK 构建与 Android lint 通过。真实 Gateway 模型回归覆盖命令参数、投影权威、切会话迟到目录、同名插件、互斥与未知结果不重放；独立自有页面回归覆盖开关、等待退出与取消等待。日志 `plan-mode-all-tests.log`、`plan-mode-web-tests.log`、`plan-mode-android-build.log`；后端/插件各项目另保留 `plan-mode-tests.log`。这些回放不冒充真实运行中排队验收。
- 已覆盖更新 App 和桌面插件并重启原本地服务，Key/绑定/历史保留。当前 DSH PID **29712**（原全编译入口），网关 PID **60480**。启动日志 `artifacts/plan-mode-dsh.stdout.log` 含登录链接，不输出正文。启动尚未监听时刷新了原内置浏览器标签，留下连接失败页；新临时标签正常完成电脑核对并已关闭，未关闭用户原标签。
- 最终原会话联合回归 **2026-09-24T03:13:38.920Z** 通过，报告 `artifacts/remote-mobile-goals-android.json` 和 `plan-mode-android-regression.log`；后台/定时/目标/模式/权限/模型/技能/插件及重连无页面/资源错误，单一输入框，原 Pro/High/只读和草稿保留。文档 **64 文件 / 1070 链接**校验通过，Linear KKC-18 与项目版本/状态同步。原浏览器错误标签恢复操作由 Codex UI 返回 queued，尚未核实执行；本机服务与 MuMu 均正常。

## 多端竞争与旧点击失效（2026-09-24）

- 状态：原 Host 与两个实际 RemoteModel/Client Gateway 的竞争集成回归已通过；MuMu 与电脑实际 UI 的在途旧点击失效已通过。没有用受控载体测试冒充真实网络上的同时提交。来源：[测试 Host 载体](../../tests/fixtures/remote-event-host.mjs)、[客户端回归](../../tests/remote-model.test.mjs)、原 [Host 事件仲裁](../../../deepseek-harness/packages/api/gateway/src/index.ts)。
- 新增仅供 Node 的原 Host Gateway + TypertRegistry，两个客户端使用原 Connection/Gateway 与本项目 RemoteModel。受控载体等两个不同 clientId 的结果请求均已在途，再交付同一原 Host；审批允许/拒绝、两个不同提问答案、计划批准/取消的两种顺序均只结算一次。另验证原请求取消同步清理两端、旧 eventId 无法重新提交。没有复制仲裁实现、假造生产认证或向 App 打包 Host 依赖；原 HTTP/中继鉴权仍由既有真实链路验收负责。
- MuMu 实测会话 `DSHM 交互同步联调 1790218277682`：手机选“手机确认”并按下提交但未松手，电脑选择“电脑确认”并提交；手机旧卡片被撤下后松手，没有覆盖电脑答案，也没有误触其他操作。电脑工具详情核对唯一答案“电脑确认”，两端收到 `DSHM_CROSS_END_1790218278100`；报告 `artifacts/remote-interactions-phone-stale-android.json`（**2026-09-24T02:51:51.830Z**）错误/资源失败为空。测试会话已归档并返回原聊天，无文件操作或权限变化。
- 手机 Node **149 项**通过，日志 `artifacts/interaction-race-all-tests.log`；这批只增加测试与证据，没有修改生产代码或重装 App。真正通过物理网络同时抵达的两次 UI 提交、拒绝/撤销/超时完整矩阵继续保留，不据此宣布 R07 或完整 Remote 完成。

## 计划确认与跨端提问（2026-09-24）

- 状态：新版 MuMu 已实测手机计划批准、提出修改及双向提问失效；真正多端同时提交、完整审批异常和其余 R07 仍未完成。来源：[手机交互](../../src/ui/RemoteInteraction.jsx)、[原 planReviewOf/PendingQuestion](../../../deepseek-harness/packages/client/ui-user-questions/src/client/contract/slots.ts)、[原计划工具](../../../deepseek-harness/packages/plan/plan-mode/src/index.ts)、[验收脚本](../../scripts/verify-remote-interactions-android.mjs)。
- 对比继续把计划当普通单选问题与复用原计划语义，采用后者。计划展示在 DSHM 自有消息区域，完整 Markdown 复用普通聊天；批准回传 Host 给定的准确选项，提出修改沿用原 PendingQuestion.cancel 的 ASK_CANCELLED，不能伪造成 decline/approve 答案。普通问题仍保留原多选与补充回答。组件提交后保持锁定直至原事件撤下，未知结果不提供重复提交；计划之外不新增取消入口或权限。
- 真实 DSH-TEST 会话 `DSHM 交互同步联调 1790217553964`：手机回答后电脑问题卡片消失并收到 `DSHM_CROSS_END_1790217554339`；电脑回答后手机卡片消失并收到 `DSHM_CROSS_END_1790217611938`。原生报告 `artifacts/remote-interactions-phone-answer-android.json`（02:39:56 UTC）和 `remote-interactions-desktop-answer-android.json`（02:40:35 UTC），电脑内置浏览器独立核对同一会话。此证据是双向顺序处理，不冒充同时竞争。
- 电脑测试会话进入计划模式，真实 exit_plan_mode 提交仅输出验证文字的计划。手机提出修改后，电脑保留计划模式并停止等待输入；报告 `remote-interactions-discuss-plan-android.json`（02:42:05 UTC）。最终覆盖安装后手机批准，收到准确正文 `DSHM_PLAN_FINAL_OK_20260924`，电脑同会话显示同一回复、计划模式退出；报告 `remote-interactions-approve-plan-android.json`（02:44:22 UTC）。没有文件读写、命令执行或权限扩张。会话已归档并返回原联调聊天，Key/绑定/历史保留；清理报告 `remote-interactions-finish-android.json`。
- 首次截图发现事件卡片新增没有触发底部跟随，已在 [RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx) 补入事件依赖；只在原本处于底部时跟随，不强制打断历史阅读。最终检查卡片底部 733.55 CSS px，小于聊天视口底部 765.20，滚动前已在视野内；截图 `remote-inspect-plan-android.png` 已查看。原计划动作插槽与手机主动切换计划模式仍未在此批完成，不以此宣称完整 R13。
- 手机全部 Node **147 项**通过；真实 Gateway 测试覆盖重复答案只发一次、原选项、不伪造取消、收到 cancel 后旧操作拒绝；自有 RemoteWorkspace 回放验证完整计划、提出修改、其他客户端取消不回传以及底部可见。原插件联合 Web 回归、Web/APK 构建和 Android lint 通过。日志 `artifacts/plan-all-tests.log`、`plan-web-tests.log`、`plan-final-android-build.log`。本批没有改网关/桌面插件或上游参考检出。

- DSHM 只加载自己的页面。普通聊天与 Remote 直接复用聊天组件，数据来源分别是手机直连 DeepSeek、本机历史，以及电脑同一个 DSH 会话的历史与实时事件。
- Remote 支持已有工作区的进行中/历史会话和新建会话；发送、审批、模型及执行结果在手机/电脑同步。不存在手机助手指挥电脑助手的主从关系。
- 保留原协议语义、配对、鉴权和撤销；不通过加载整个电脑 UI 代替消息/操作接入，不将预览内存状态冒充真实电脑状态。
- 插件可以提供消息中的局部界面。DSHM 默认仅等比例缩放最外层，内部布局由作者负责。提供作者配置和插件详情页用户开关，用户设置优先于作者声明，未声明默认开启。
- 当前首先接入工作区/列表与共享聊天展示，然后补齐实时会话、审批、文件及插件能力；最终需要从 Android 真实入口重新验收。

## 当前正式App队列操作（2026-10-03）

- 状态：当前MuMu、真实网关与DSH的队列编辑、取消和后续执行通过；维护角色：项目协作Agent。来源：[正式队列组件](../../src/ui/RemoteQueue.jsx)、[权威队列操作](../../src/remote-model.mjs)、[本轮驱动](../../scripts/verify-remote-queue-current.mjs)和[实际报告](../../artifacts/remote-queue-current-android.json)。本轮未修改生产代码、APK、网关、电脑插件或设置。
- 原清单引用的旧队列通过说明仍保留，但没有找到包含`queueEditedCancelledAndExecuted`字段的独立原始报告，因此本轮补做实际入口。当前原提问插件接管`conversation.composer`时会隐藏默认输入框，收起问题也不会解除接管；旧脚本依赖提问期间操作输入框，已不适用。两次模型按钮定位超时属于驱动前提失效，未强制操作隐藏元素；正常回答问题后在持续生成阶段操作队列。
- 在已有DSH-TEST工作区新建并改名专用聊天，真实模型开始持续生成后，将第一条排队消息修改为本轮唯一标记，第二条入队后取消。两次操作均等待电脑投影回传；生成期间模型选项全部禁用。当前轮自然结束后，仅修改后的消息进入聊天并收到准确回复，旧内容和已取消标记都不在历史，队列清空、输入框为空。没有用停止、伪造事件或直接模型请求替代原队列执行。
- 该会话随后归档，返回“DSHM Remote 联调提示”，原16条回复、空草稿保持，无残留队列/提问/生成，页面错误为空。首次清理在标题先于历史就绪时统计到0，驱动已补等待实际回复；该失败记录保留。管理状态首次读取失败，重试正常返回active、management=false，整个测试没有授予管理权限。
- 本项证明R06队列编辑/取消/执行和R08运行中锁定的当前版本路径。历史停止与立即引导沿用下节的实际报告，不冒充本轮重跑；原问题接管输入框是插件契约，不为测试而更改。完整Remote仍按[收尾表](./completion-audit.md)逐项验收，反馈目的地阻塞未解除。

## 历史分页、停止与即时引导（2026-09-24）

- 状态：新版真实 MuMu 已验证向前加载一页、停止正在输出的模型回复、排队转即时引导；完整分页异常、多端审批竞争和其余 R01–R16 继续实施。来源：[聊天页](../../src/ui/RemoteWorkspace.jsx)、[队列](../../src/ui/RemoteQueue.jsx)、[共享排版](../../src/ordinary-rendering.jsx)、[共用输入框](../../src/ui/MobileComposer.jsx)。
- [真实分页脚本](../../scripts/verify-remote-pagination-android.mjs)在 `DSHM Remote 联调提示` 重新打开后向前加载：模型回复从 23 条增至 47 条，原窗口文本顺序保持，阅读锚点位移约 0.13 px。报告 `artifacts/remote-pagination-android.json`，页面错误为空。初次测试用全文去重错误地拒绝了历史里合法的相同回复，已改为核对完整原有窗口顺序；不据此宣称所有消息身份去重或分页异常已通过。
- 长回复停止最初失败：电脑完成输出后手机仍在渲染，按钮点击超时。两次记录为 `remote-chat-controls-before.json`、`remote-chat-controls-stream-before.json`；后者采到 486 次长任务、总计约 29.9 秒，而普通等待提问状态的取消能成功。原因核验：共享包装层每次创建新的 labels，违背上游 MarkdownText 的引用稳定约定，导致已完成历史重新解析、流式缓存重置。现仅随语言变化重建 labels；不改原解析器、不丢消息，也不对取消/发送自动重试。
- [独立浏览器回归](../../scripts/verify-markdown-cache.mjs)直接渲染实际共享组件，测试包临时对只读上游解析入口计数：修改前五次无关状态更新使解析从 2 次升至 12 次；修复后保持 2 次，下一流式片段只解析 66 字符。`artifacts/markdown-cache-web.json` 通过；该回放不代替真实模型验收。
- 缓存修复 APK 的真实复验 **2026-09-24T02:23:06.286Z**：`DSHM 聊天控制联调 1790215834839` 在已看到本轮输出后点击停止，收到“已停止”；随后提问、加入队列、立即引导、回答提问及唯一正文 `DSHM_STEER_OK_1790216592182` 通过。报告 `remote-chat-controls-cache-fixed.json` 错误/资源失败为空，本次从发送至停止的测量窗口无长任务；不能与此前长时间失败窗口作等时性能比。更早一次停止发生于第一段回复之前，无助手节点可显示“已停止”，已修正脚本等待本轮新增回复，记录 `remote-chat-controls-early-stop.json`，不当作完整输出停止验收。
- 原 `agent.steer()` 是移入 next-step，不会中断正在等待的工具提问或跳过审批；原 session.ts 的简短注释不足以说明这点，已核对 [Agent 实现](../../../deepseek-harness/packages/core/agent-loop/src/agent.ts)与 [queue 控制](../../../deepseek-harness/packages/api/session-controller/src/commands.ts)。早期对照由电脑回答、手机读到唯一回复，`remote-chat-controls-gate.json` 保留该证据。最终 [控制脚本](../../scripts/verify-remote-chat-controls-android.mjs)自行回答后检查正文，支持 `--desktop-answer` 供双端验证，写入需 `DSHM_RUN_LIVE=1`。
- 共用输入框触摸回归本次连续两次复现首次点击未选中：pointerup 的零延时定时器早于兼容鼠标事件，blur 又提前改变布局。现以 click 结束正常点击，pointercancel/window blur 释放，未产生 click 的手势有 500 ms 兜底；鼠标/触摸首次点选、草稿保留与 Escape 收起均通过 [现有回归](../../scripts/verify-composer-focus.mjs)。原失败日志 `chat-controls-composer.log` / `chat-controls-composer-recheck.log` 保留。
- 最终 APK（含触摸修复）真实复验 **2026-09-24T02:26:15.543Z** 通过，报告 `artifacts/remote-chat-controls-android.json`：停止发生在本轮已输出后，随后引导回复 `DSHM_STEER_OK_1790216786048` 成功，错误/资源失败为空。内置浏览器直接核对同一电脑会话：第 8 轮在第 8 行后停止，第 9 轮同一提问已回答并显示该唯一正文，电脑发送按钮恢复空闲。已检查最终手机截图。测试会话已归档，App 返回原联调会话；最终 APK 的分页复验 **02:27:28.696Z** 仍保持 23→47、原窗口顺序及约 0.13 px 锚点位移。
- 手机 146 项 Node 测试、插件/原投影 Web 回归、缓存回归、输入框鼠标/触摸回归通过；最终 Web/APK 构建及 Android lint 通过并覆盖安装，Key/历史/绑定保留。没有修改后端、桌面插件或只读上游。此节不代表完整 Remote 完成，后续继续跨端审批竞争、完整记录与其他矩阵缺口。

## 电脑重启恢复（2026-09-24）

- 状态：当前自有聊天、权限和插件恢复路径已在真实 MuMu 通过；不代表网关重启、撤销、连续弱网及全部在途资源矩阵通过。来源：[传输适配](../../src/remote-transport.mjs)、[插件宿主](../../src/remote-plugins.jsx)、[App 组装](../../src/RemoteApp.jsx)、[恢复内容边界](../../src/remote-resume.mjs)。
- 修复前的实际重现：保持 `DSHM Remote 联调提示` 打开，重启本地 DSH。电脑恢复后权限目录能读取，但当前聊天订阅已结束，操作持续锁定；`artifacts/remote-host-restart-before-fix.json` 保留 120 秒观察。中继 `host_disconnected_outcome_unknown` 被传为普通错误，而原 Gateway 仅对载体错误恢复流。适配现仅为明确的 `host_offline` / `host_disconnected_outcome_unknown` 添加原 `dshRemoteStreamFailure` 标记，业务拒绝、取消及 RPC 写入保持失败，不重试。
- 同次排查发现 `remote.graphFollow` 原先断线即永久卸载插件。现在跟随原 Connection 世代重新订阅完整快照，旧回调不能卸载新树，业务错误仍结束插件。原模块服务 [allocateInitialRevision](../../../deepseek-harness/packages/client/modules/src/index.ts) 使用启动随机 nonce；因此不能把 Host 重启误当作版本永远不变，也不能忽略核心版本差异。比较忽略版本与重建完整运行环境后采用后者：RemoteApp 串行卸载旧作用域、重新协商及读取原定义、恢复所选会话和草稿。局部图变化仍只重建插件子树。
- 内容恢复只转移用户草稿及尚未发送的本地图片，文件上传凭据失效后要求重新选择；正在发送或结果未知的附件继续要求核对。审批、队列写入和发送操作均不自动重放。[单元回归](../../tests/remote-resume.test.mjs)核对凭据剔除、会话归属和在途状态；[原 Gateway 集成回归](../../tests/remote-model.test.mjs)经真实 RemoteTransport 覆盖会话/工作区订阅恢复。两处问题均先得到失败测试，再修复通过。
- 插件 Web 回归覆盖重订阅、后续图更新、旧回调忽略、单份样式和草稿保留。中间真实验证也暴露了核心版本变化导致退出连接，记录 `remote-host-restart-core-change-failure.json`；已通过上述运行环境重建解决。续聊脚本曾误把用户消息定位为不存在的 article，实际回复已收到；修正为唯一提示文本和可见模型正文检查，未用旧回复冒充成功。
- 最终真实重启报告 `artifacts/remote-host-restart-android.json`，**2026-09-24T01:59:23.030Z**：未手动断开/重连，自动返回原聊天，非空草稿保留，权限及插件列表/样式恢复，唯一消息 `DSHM_HOST_RESTART_OK_1790215159292` 收到真实回复；errors 为空。独立截图 `remote-host-restart-android.png`；[脚本](../../scripts/verify-remote-host-restart.mjs)默认只读，`--send` 需 `DSHM_RUN_LIVE=1`，由外部核对进程后重启 Host。手机 146 项测试、Web 回归、Web/APK 构建和 Android lint 通过。新版覆盖安装，保留 Key/历史/绑定；没有改动桌面插件、网关或只读上游。
- 最终联合回归 **2026-09-24T01:59:52.689Z** 通过，报告 `artifacts/remote-mobile-goals-android.json`：定时/后台/目标/模式/权限/模型/技能/插件正常，errors/resources 为空，单一输入框，Pro/High/只读及插件用户设置保留。文档 64 文件 / 1036 本地链接通过。当前实际 DSH 使用原全编译入口，PID 56472；网关 PID 17596。启动日志 `artifacts/dsh-restart-runtime.stdout.log` 含本机登录链接，不输出正文。Linear KKC-18 与项目当前状态已同步，保持进行中。
- 完整 R01–R16 继续保留。后续优先补齐当前新版聊天的历史分页、停止/立即引导及跨端审批竞争，再推进子会话与其他矩阵缺口；本项不替代完整恢复/插件兼容验收。

## 定时任务目录与真实提醒（2026-09-24）

- 状态：手机自己的定时任务目录已接入当前会话 schedule 投影，单次创建、重复记录、聊天删除和到时回复已在 MuMu 实测；新增跨到期时间的电脑离线恢复、单次仅补发一次、重复补发及下一周期实际触发验证。跨多个遗漏周期、完整并发/失败异常与 R09 仍未完成。来源：[手机窗口](../../src/ui/RemoteSchedules.jsx)、[RemoteModel](../../src/remote-model.mjs)、原 [Schedule 投影](../../../deepseek-harness/packages/schedule/schedule/src/projection.ts)、[工具](../../../deepseek-harness/packages/schedule/schedule/src/tools.ts)及[运行时](../../../deepseek-harness/packages/schedule/schedule/src/runtime.ts)。
- **重复与离线恢复实测（2026-09-25 本地日期）：**[分阶段脚本](../../scripts/verify-schedule-recovery-android.mjs)只在 DSH-TEST 创建 `DSHM 定时恢复 1790271789037`，原工具建立60秒单次及300秒重复提醒；后者为原协议最短间隔，未调系统时钟或伪造到期时间。按既有测试覆盖临时启用 Schedule（PID9492），首次到期前停止 DSH，手机保留旧任务并提示连接断开，正文回复计数均0；跨过两条提醒各自首次到期后于17:48:34 UTC按同一覆盖恢复（PID8268），手机自动重读，17:48:51–52分别收到单次及重复正文，单次条目移除，重复下次时间为17:53:13.130。17:53:14收到第二次重复正文，单次计数仍1，下次时间变为17:58:13.130，保持原创建基准，草稿不变。`artifacts/schedule-recovery-watch-android.json` errors/resources为空，实际截图已查看；状态样本中的“已连接”来自隐藏的连接页，不是离线时可见的状态声明。
- **清理与恢复：**17:53:25 UTC `schedule-recovery-cleanup-android.json` 通过，原记录恰好2次schedule_create、1次schedule_delete，列表没有剩余提醒，聊天归档。恢复无覆盖的原启动方式（PID37248），17:54:47 `schedule-recovery-history-android.json` 验证归档的单次1条/重复2条正文与草稿保留，默认“电脑暂未提供这个聊天的定时任务”提示正确，最终返回原联调聊天；报告均无页面/资源错误，Key、模型地址、设备管理权限与用户持久配置未改。
- **验证边界与脚本修正：**本批只有验收脚本/文档变化，未改产品代码、插件或APK。prepare最初错误地将折叠思考中提到的提醒计为回复，创建已经成功，因此没有重发；capture只读补齐原日期，统计改为正文后继续同一条会话。脚本现在要求旧测试已清理才能再次prepare。第一次恢复历史时，Host重建已把筛选恢复默认，退出步骤却等待“查看最近聊天”而超时；随后按当前筛选清理、重新只读验收通过。初始失败不算通过；watch/cleanup/history的最终报告为本轮依据。原源码定义错过多个周期只取最近一次，已有上游隔离测试可作语义依据，本轮没有跨多个遗漏周期实测，不据此关闭完整R09。
- 原电脑 UI 是只读目录，创建/删除由会话里的 `schedule_create/schedule_delete` 工具执行，没有现成公开 CRUD 服务。比较复制一套手机调度/伪造 RPC 与读取原投影，采用后者；手机仍通过共享聊天发送自然语言要求，电脑原工具负责持久化和调度。目录区分缺少能力与空列表，显示确切间隔、手机本地时间和待触发/已到时；到时不意味着执行成功，条目只随原投影更新。切换会话清空并重新订阅，断线明确为最近状态。未把此目录当作原插件全部浮层兼容或完整 R09 通过。
- 原 Web 默认关闭 Schedule，官方 [临时覆盖示例](../../../deepseek-harness/apps/cli/config/examples/schedule/cordis.yml)通过 time-context/schedule 与 ui-schedule 启用；本次使用内容相同的[本地测试覆盖](../../tests/fixtures/schedule.cordis.patch.yml)，启动参数 `web --patch Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/tests/fixtures/schedule.cordis.patch.yml --no-open`。没有修改用户持久 profile 或上游源码；Schedule 仅服务加载后创建的根 Agent。测试结束已恢复不含 --patch 的原全编译启动入口，默认未提供时手机显示明确说明。
- MuMu 真实过程：在 DSH-TEST 新建 `DSHM 定时任务联调 1790213113629`，原工具创建 60 秒单次与 300 秒重复提醒。手机目录显示两条和“每 5 分钟”；聊天删除重复提醒后对应条目消失；单次到时原投影移除，电脑产生真实 `DSHM_SCHEDULE_FIRED` 回复，测试会话归档。没有写文件、执行命令或留下循环提醒。证据 `artifacts/remote-schedules-live-android.json`（**2026-09-24T01:25:12.664Z**）errors/resources 为空，独立创建截图已检查。重启后从已归档聊天再次核对可见正文的精确回复，报告 `remote-schedules-history-android.json`（**01:30:02.794Z**），不把提示词或折叠思考中的文字算作回复。
- [验收脚本](../../scripts/verify-remote-schedules.mjs)通过主入口 `--schedules-live`（需 `DSHM_RUN_LIVE=1`）执行真实工具；`--schedules` 只查看当前能力。首次脚本因页面中两个 `.remote-heading` 导致定位歧义，未发送请求即终止，随后限制到正式工作区再执行成功。手机 Node **142** 项、独立 Web 投影回归、Web/APK 构建与 Android lint 通过。回放覆盖未提供、空态、到时排序、精确重复间隔、删除和会话隔离；不替代真实提醒验证。
- 恢复原 Host 后的首次联合回归发现当前会话权限按钮仍锁定，未修改权限；记录于 `artifacts/schedules-combined.log`。通过 App 断开并重新连接后归档历史可读取；这是恢复路径待追踪项，不能据此宣称自动重连全部通过。
- 手动重连后的最终定时/后台/目标/模式/权限/模型/技能/插件联合回归 **2026-09-24T01:30:48.819Z** 通过，`artifacts/remote-mobile-goals-android.json` errors/resources 为空，Pro/High/只读和草稿保留，单一输入框；恢复默认 Host 后“未提供定时任务”提示符合实际能力。文档 **64 文件 / 1025 链接**检查通过。当时主服务 PID 54788 使用原全编译启动方式，无临时 --patch；本次没有修改后端协议或桌面插件。此处发现的重启锁定已在上节修复，完整 R01–R16 继续保留。

## 后台任务停止（2026-09-24）

- 状态：插件 **0.1.16**、新版网关与 App 已接入当前会话后台任务的确认停止。真实 MuMu 基础停止链路已通过；完整输出、任务异常和其余 R09 保持未完成。来源：[手机操作](../../src/remote-job-actions.mjs)、[窗口](../../src/ui/RemoteJobs.jsx)、[Host 控制](../../../plugin/src/job-control.ts)、[协议](../../../docs/protocol.md#停止后台任务)。
- 对比开放通用 job/命令接口与固定停止入口，采用严格字段的 `remote.jobStop`，不接受命令、路径或另造 Agent。原 jobs/agents 注入时生成控制器代次，原存活 Agent 检查任务归属，再校验 startedAt；拒绝旧代次/外部会话/复用 id。原注册表判断 stopping/终态，重复停止不再调用 cancel。停止异常可能已触发副作用，手机按未知结果处理，同连接内不重试。不会乐观更新镜像为已取消。
- 原 `jobs.read` 消费 producer 输出游标，且终态会标记已报告；不能把它直接包装成无副作用的手机预览。当前停止只调用 get/kill，不抢占 Agent 的输出。完整输出与原 header 浮层兼容继续保留，不以独立手机列表宣称任意插件兼容。
- 真实 MuMu 基础验证：`--jobs-stop`（显式 `DSHM_RUN_LIVE=1`）在 DSH-TEST 新建专用会话，让原 pwsh 只等待 60 秒并输出固定文字。先取消确认，任务仍运行；再次确认后，原状态变为 killed，手机显示已取消和 `killed before exit`。测试会话已归档并返回原会话，未清理 Key/历史/绑定。第一份证据 `artifacts/remote-job-stop-android.json`（**2026-09-24T01:06:11.019Z**），页面/资源错误为空；该次还发现顶部等待提示未随终态更新，后续已按同任务身份派生最终提示并添加回归。
- 自动检查：手机 **142**、插件 **51**、后端 **34** 项通过，独立 PostgreSQL 一项跳过；双方类型检查/构建、手机 Web/APK 构建、Android lint 通过。原注册表测试覆盖会话隔离、代次、启动身份、一次 cancel、重复停止和不消费输出；手机回归覆盖未知结果禁止重试、重连后重新核对、确认取消不写入与收到真实终态才更新提示。日志见各项目 `artifacts/job-control-*.log`。
- 首次完整联合回归（后台/目标/模式/权限/模型/技能/插件重连）通过：`artifacts/remote-mobile-goals-android.json`（**2026-09-24T01:09:59.940Z**），errors/resources 为空，单一共享输入框。此后只调整停止提示并完成 Web 回归、构建与 Android lint；覆盖安装后的真实停止复验 **2026-09-24T01:14:42.124Z** 通过，报告 `artifacts/remote-job-stop-final-android.json`。确认取消不写入、再次确认后原任务 killed、顶部和任务行均显示已取消，errors/resources 为空，测试会话归档并返回原会话；已检查独立截图 `remote-job-stop-android.png`。本次文档 **64 文件 / 1015 链接**通过，插件 0.1.16 安装包说明同步更新，完整目标保持进行中。

## 后台任务查看（2026-09-24）

- 状态：自有后台任务窗口已接入真实数据；停止任务后续结果见上节，完整输出管理和后台任务全部异常仍未完成。来源：[手机窗口](../../src/ui/RemoteJobs.jsx)、原 [控制流](../../../deepseek-harness/packages/api/session-controller/src/control.ts)和 [JobListAction](../../../deepseek-harness/packages/client/ui-jobs/src/client/JobListAction.tsx)。
- 原后台列表通过已有 `session/control` baseline/jobs 帧进入 `ClientSessions.list.jobsBySession`，手机按当前会话读取同一镜像；无新 RPC、鉴权或后台进程代理。沿用原运行项优先顺序，显示 Host 的 status、label、detail 及耗时。窗口关闭停止计时，连接断开显示最近状态。任务快照取决于电脑进程内注册表，不声称永久历史；Host 对全局任务的归属规则仍保持原语义。
- 比较新增手机列表与挂载桌面 JobListAction：原弹出层为绝对定位，当前插件外层缩放容器会裁剪浮层，不能把未适配插槽当作可交付入口。当前使用 DSHM 自有窗口读取原数据，完整插件插槽/浮层兼容仍保留在 R13，不改上游内部布局。
- [真实验证脚本](../../scripts/verify-remote-jobs.mjs)使用主入口 `--jobs-live`（需 `DSHM_RUN_LIVE=1`）。仅在 DSH-TEST 新建专用会话，由实际 DSH 执行 `Start-Sleep -Seconds 25; Write-Output "DSHM_BACKGROUND_DONE"` 后台命令，没有文件写入。MuMu 观察运行中到已完成，显示 pwsh、约 26 秒、exit code: 0；模型另有一次原 job_output 读取完成结果。报告 `artifacts/remote-jobs-live-android.json`、`remote-jobs-result.json`，成功时间 **2026-09-24T00:52:03.295Z**，页面/资源错误为空，已检查运行及结束截图布局。
- 首次脚本错误地按 description 查找任务；原 pwsh 使用 command 作为 JobSnapshot.label，因此任务虽完成但断言超时。核验源码并修正选择器后重新验证通过，两条测试会话都已归档，回到原会话。没有重跑未确认的在途操作或清空 App 数据。
- 手机 **141** 项、Web 页面回放（空态、运行/失败更新、详情、会话隔离）、Web 构建与 Android assembleDebug/lintDebug 通过，日志 `artifacts/jobs-*.log`。当前 APK 已覆盖安装，Key/历史/绑定保留；插件与网关代码未改变。
- 下一步源码依据：原 [Schedule 插件](../../../deepseek-harness/packages/schedule/schedule/src/index.ts)通过会话投影与模型工具管理记录，没有现成 Remote CRUD；原 [ScheduleCatalogAction](../../../deepseek-harness/packages/client/ui-schedule/src/client/ScheduleCatalogAction.tsx)是只读当前会话目录。不能伪造 schedule RPC，也不能以后台进程列表替代定时任务。后续单独核验加载能力、投影和可审阅管理入口；工作流/子 Agent 同样保留。
- 最终目标/后台/模式/权限/模型/技能/插件联合回归通过，报告 `artifacts/remote-mobile-goals-android.json`（**2026-09-24T00:55:10.041Z**）errors/resources 为空、单一输入框、草稿与设置保留，无重复插件样式。前一次联合回归在技能页截图超时，进程终止后核对页面仍正常，再次只读检查通过；没有据此重启电脑或重放写入。文档 **64 文件 / 1004 链接**通过，Goal 0.1.15 安装包仅重新同步 README。后续联合回归会更新通用报告；本次真实后台任务的独立证据保存在 `remote-jobs-live-android.json`。

## 当前目标生命周期（2026-09-24）

- 状态：手机目标创建、暂停、编辑、继续、完成和清除以及电脑修改回传已通过本地 MuMu 联调。来源：[手机状态](../../src/remote-goals.mjs)、[自有窗口](../../src/ui/RemoteGoal.jsx)、原 [Goal 服务](../../../deepseek-harness/packages/goal/goal/src/index.ts)和[原始类型](../../../deepseek-harness/packages/goal/goal/src/types.ts)。R09 其余后台、定时、子 Agent、工作流继续保留。
- 原插件的 GoalBar 依赖完整 InputZone。比较直接挂载该桌面输入区域与自有窗口调用原业务接口，采用后者，保持 DSHM 共用输入框。已加载原插件不代表其 input.dock 插槽完整可用，不以 active 状态宣称完整插件兼容。
- 复用真实生成 get/create/edit/pause/resume/complete/clear（均无 AbortSignal 参数），不伪造 RPC。原 `{id,revision}` 执行版本检查；get 包含实时 activation，投影和 activation 事件触发重读。切会话/重连清理旧读取；并发写入互斥、结果未知不自动重发。清除保留历史，不承诺取消已启动轮次。插件 **0.1.15** 与网关双侧收紧参数，未扩大设备 management 权限。
- [Android 脚本](../../scripts/verify-remote-goals.mjs)通过主入口 `--goals`，只操作 DSH-TEST 的 `DSHM 目标联调 20260924`。手机创建后暂停，电脑原 GoalBar 核对并修改；手机读到 `DSHM_GOAL_PC_EDIT`，编辑上限至 2 并继续，标记完成和清除。此前内置浏览器实测确认电脑收到 `DSHM_GOAL_RESUMED`、目标栏消失且没有执行中的轮次，测试会话已归档。没有调用工具或修改文件。
- 实际报告 `artifacts/remote-goals-created-paused.json`（2026-09-24T00:37:31.289Z）、`remote-goals-lifecycle.json`（00:38:15.869Z）与最终联合 `remote-mobile-goals-android.json`（00:39:05.131Z）页面/资源错误为空。联合检查保留原会话、模式/模型/权限、草稿和插件设置；已覆盖安装 APK，保留 Key/历史/绑定。原联调中首个脚本因标题选择器不唯一在写入前失败，限定真实工作区后通过，没有创建重复目标。
- 手机 **141** 项、插件 **49** 项、后端 **33** 项通过，独立 PostgreSQL 一项跳过；Web 插槽回放、双方类型检查/构建、Web/APK 构建及 Android lint 通过，日志为各项目 `artifacts/goals-*.log`。夹具覆盖旧版本、旧会话、事件/重连、目录失败和未知结果；真实多设备同时写入、完整阻塞/上限异常矩阵尚未逐一实测，不能据此宣布 R09 全部完成。

## Agent 模式选择（2026-09-24）

- 状态：目录、空白会话选择、手机/电脑读取一致和第一轮后锁定已在正式 MuMu 入口验证；不代表自定义预设、管理或完整 R08 异常矩阵已验收。来源：[模型](../../src/remote-agent-presets.mjs)、[手机窗口](../../src/ui/RemoteAgentPresets.jsx)、原 [目录工具](../../../deepseek-harness/packages/client/ui-agent-preset/src/client/settings-store.ts)、原 [Host 选择](../../../deepseek-harness/packages/preset/agent-presets/src/index.ts)。
- 比较重新实现模式目录与复用原工具，采用原 `readRoster` / `presetOptions` / 显示名称工具，过滤损坏项并遵守 `modeSelectionEnabled`。不复用带默认设置/暂存自动应用副作用的完整桌面控制器。选择使用电脑生成的 `agentPresets.select(agentId, agentPreset)`，没有取消参数；当前值来自原投影，不乐观写入、不修改电脑默认模式或预设文件。第一轮后原 Host 拒绝切换；手机补齐发送互斥、会话隔离、旧目录丢弃和未知结果禁止重发。
- 插件 **0.1.14** 与网关双侧增加严格限定的 list/select，目录只接受空参数，选择仅允许会话和模式 id；预设复制、读取文件、删除和 settings 更新继续不随本能力放行。参数策略、真实 HTTP/WebSocket 转发及 Host 独立拒绝由后端/插件回归覆盖。当前实际 DSH、网关与覆盖安装的 APK 均使用新版，Key/历史/绑定保留。
- 手机在 `DSHM 模式联调 手机选择 20260924` 从标准选择极简，收到 `DSHM_AGENT_MODE_READY`；内置浏览器电脑同会话显示极简和同一回复。电脑在 DSH-TEST 空白会话选择极简，收到 `DSHM_AGENT_PC_READY` 后命名为 `DSHM 模式联调 电脑选择 20260924`，手机显示相同模式且禁止更换。该电脑空白入口复用了此前未发消息的专用权限测试空白会话，未操作普通业务会话。报告 `artifacts/remote-agent-phone-to-pc.json`（**2026-09-24T00:16:39.937Z**）、`remote-agent-pc-to-phone.json`（**00:18:19.579Z**）；两条会话已归档，回到原联调会话。
- 最终模式/权限/模型/技能/插件断开重连联合检查 `artifacts/remote-mobile-agent-presets-android.json`（**2026-09-24T00:19:08.869Z**）页面/资源错误为空，原标准模式、Pro / High、仅可查看与草稿保留，无重复样式。已查看最终模式窗口截图。手机 Agent 回归所在的 **135 项** Node 测试通过，Web 插槽/模式失败重试与历史锁定通过；插件 **48 项**、后端 **32 项**通过（独立 PostgreSQL 测试跳过），类型检查、Web/APK 构建和 Android lint 通过。自动化结果分别见各项目 `artifacts/agent-*.log`，本批没有重跑普通聊天完整 API 验收。
- 模拟器自动检查曾卡在 WebView 定位：Playwright 包名探测按 `grep PID` 匹配，PID 566 被后续含该数字的其他进程误覆盖；`webView({pid})` 也不属于该版本支持的选择器。修复为 [androidAppWebView](../../scripts/android-app-webview.mjs) 按系统 `pidof` 精确 PID 选择已有对象或等待对应事件，不改第三方依赖。只读连接和上述实际入口已通过，另有 [3 项回归](../../tests/android-app-webview.test.mjs)覆盖误识别、迟启动、进程缺失/不唯一。当前 Remote 主验证使用此 helper，旧独立脚本尚未逐一迁移；这不影响 App 本身连接。

- 收尾：新增验证定位回归后手机完整 Node **138 项**通过（`artifacts/agent-presets-final-node-tests.log`），文档 **64 文件 / 980 本地链接**通过。0.1.14 重新打包仅更新 README，运行时代码与已实测安装版本相同。Linear KKC-18 已同步当前范围及结果，仍为 In Progress。

## 原提问与计划超时（2026-09-27）

其中重连日志的后续排查：原源码已复现提供方销毁后继续同步、旧inventory拒绝继续发布两条路径；[生命周期补丁](../../../plugin/compatibility/cordis-client-lifetime/README.md)8项回归、完整类型检查及原预设构建通过，16文件补丁已安装。实际MuMu重启后恢复原会话、草稿及插件面板，同一WebView且console/pageerror为空；两个原模块active。07:00:41Z另通过有实际动态包的拒绝/批准/版本授权、电脑重启后清单与手动运行、Host回声、停止/移除，全部控制台和资源错误为空；临时包卸载，07:02:48Z日常入口收尾通过。源代码、原报告与截图见补丁文档；原空目录按钮隐藏的专项失败仍保留。双端目录、实际撤销及完整R13继续验收。

- 状态：当前日常APK在MuMu通过原请求自然超时与下一请求隔离；维护角色：项目协作Agent；核验2026-09-27。来源：[真实验收入口](../../scripts/verify-original-interactions-android.mjs)的`--timeout`分支、[超时检查](../../scripts/verify-interaction-timeout.mjs)、原[UserQuestionService](../../../deepseek-harness/packages/interaction/user-questions/src/index.ts)及[测试Host插件](../../tests/fixtures/live-interactions-plugin/index.js)。本轮未修改生产代码或APK。
- 原服务在既有专用会话分别发起提问与计划确认，使用测试插件既有90秒AbortSignal.timeout，不修改手机时钟或注入伪造取消事件。手机填写提问选项和未提交答案后等待；两个请求均由电脑返回ASK_ABORTED，原卡片从DOM移除、编辑器与非空聊天草稿保留。再发新提问，旧选项与自填答案均未带入；手机取消返回电脑ASK_CANCELLED。
- [14:15起的结果](../../artifacts/original-interactions-timeout-android.json)记录两类超时、后续请求独立、errors/resources为空；[提问](../../artifacts/interaction-timeout-question-android.png)与[计划](../../artifacts/interaction-timeout-plan-android.png)超时后页面截图已生成，计划截图已核对。该报告整体仍带failure：收尾脚本用fill空串后，临时草稿未清除，不能将其标记为整次零失败。随后[定向收尾脚本](../../scripts/restore-timeout-draft.mjs)先核对测试会话和完整临时内容，再通过真实全选/删除恢复原草稿；[14:19恢复报告](../../artifacts/interaction-timeout-draft-cleanup.json)已通过。后续验收脚本同样改为按键删除并等待编辑器状态。
- [首轮准备失败](../../artifacts/original-interactions-timeout-startup-race.json)发生在电脑重启后会话尚未恢复时，Host返回Test session is not a live Agent；增加列表已连接检查并重新进入会话后，才进行上述真实超时验证。卸载后首次收尾捕获[重连期间目录读取中止日志](../../artifacts/interaction-timeout-cleanup-reconnecting.json)，未忽略错误冒充通过；连接稳定后[再次收尾](../../artifacts/original-interactions-cleanup-android.json)确认原草稿、测试界面/计划面板移除，errors/resources为空。该重连日志的完整处理仍待核查，不据此宣称所有重启异常完成。
- 临时插件通过原CLI卸载，DSH32056/网关3128运行，控制文件已移除；未调用模型、修改Key/绑定/权限。此证据覆盖原userQuestions的提问和计划超时，不代表工具审批、多端同时提交、撤权或所有异常已经完成。

## 完成矩阵

当前收尾以[收尾验收表](./completion-audit.md)为准，下表保留历史专项范围。2026-10-04已完成[R09五类执行能力证据核对](./execution-capabilities-current.md)，并新增正式MuMu单个所属会话释放后的后台输出暂停/重读拒绝验收；历史「任务回收待验」由该专项替代，不将其扩大为全部并发通过。

插件兼容的逐模块依据见[当前兼容目录](./plugin-compatibility.md)。2026-09-27 14:40 UTC 从实际 Android 读取 59 个模块（29 active / 24 mobile / 6 waiting），版本元数据与功能证据分别记录；此次只读检查保留原页面、草稿和管理权限关闭状态。该目录不将 active 等同整包验收，也不以管理权限关闭或已排除的交互终端作为兼容故障。

R13/A05 最新补充：[插件全局导航](#插件全局页面导航2026-09-27)已实际接入原 layout/main/sidebar.panellist，14:47 新版 MuMu 还通过[叠层交互修复](./appearance-current.md#插件窗口叠层交互2026-09-27)：被遮挡旁栏不能抢焦点，顶层返回恢复；不代表任意第三方全局页面或完整读屏通过。

R14–15最新补充：[自定义服务协议切换](#自定义服务协议切换2026-09-27)已通过实际手机保存、取消、重读和电脑OpenAI/Anthropic模型发现请求切换；其余协议、真实第三方认证和模型推理仍待验收。

2026-09-27重新核对现有专项报告与实现记录后更新。下表区分已实现、实际Android验证、隔离回归和未完成事项；“基础”不等于完整交付。此次是证据审计，没有重新运行历史测试，也没有更改产品范围。后文逐次记录保留当时事实，当前状态以本表和链接的最新专项为准。

已核对报告包含旁栏/Worker/文件撤销、安装重启与撤权、动态插件重启、89条回复分页及HTML重试；各报告的具体路径与边界在表内链接章节。R16已补验[选择目的地前强制结束App后的清理与手动重试](#系统保存窗口中的进程结束与重试2026-09-27)，以及[目标文件写入中强停后的未知结果提示](#目标文件写入时进程结束2026-09-27)；后者使用受控提供方及真实进程结束，不等同任意实际提供方、后台低内存回收或系统断电。扫码旧报告仍明确记载MuMu会自动授予相机权限，不能证明用户拒绝权限流程。R12网站转发已于2026-10-03由用户明确移出首版、后续再评估；HTML文件预览保持独立。

| 编号 | 目标 | 当前状态及剩余工作 |
| --- | --- | --- |
| R01–02 | 配对、批准、拒绝、到期、重连、解绑 | 实际配对、批准、进程重启后重连、撤销后会话销毁/资源拒绝已验证；系统分享/App链接已接入并验证填入、现有绑定保护与无效key拒绝，插件 0.1.19 已生成 App 链接/二维码，新增入口有效领取/批准/自有聊天读取/撤销及拒绝重连通过；内置扫码和图片识别已接入，图片识别/取消及无关二维码拒绝通过，实际相机识别、权限拒绝及完整异常仍待验收；Q20断线保留聊天/滚动/输出/草稿和离线最后同步时间、首次失败连接页/返回普通聊天已在MuMu验证，完整异常仍待补齐 |
| R03 | 工作区、任务、搜索、归档、子会话 | 新版手机列表、归档恢复、子会话目录/一次性历史/返回父会话及直接子会话重启恢复已实测；正文搜索摘要、工作区/归档筛选和无结果通过真实MuMu，默认关闭索引时明确提示且标题可用；真实网关中断/自动重连时同页关键词和标题保留、离线更换查询无旧摘要/假空结果、恢复后原聊天读取通过。2026-09-25真实正文索引响应暂缓/乱序中，新词与清空查询均不被迟到摘要覆盖，默认启动方式已恢复；两层嵌套导航、电脑重启恢复与逐级草稿保留已通过；父释放后的返回持久化会话修复已通过新版MuMu，失败保留子会话与迟到刷新保护有原客户端回归；完整网络及子会话异常仍未完成 |
| R04 | 已有工作区新聊天、改名、分支、续聊 | 新版 DSH-TEST 新建、重命名、整段历史分支、按轮分支与独立续聊已实测；按轮分支排除较晚轮次并保留原会话/草稿；create 仍必须有 workspaceId 且禁止 cwd |
| R05–06 | 原始渲染、分页、实时输出、停止、队列与插话 | 共享消息/输入框、原会话投影和实时同步已接入；真实续聊、队列编辑/取消、输出中停止、队列转引导、在途返回/重连重试和生成期间翻页已通过。最新[外层测量与分页](#插件外层测量与历史分页2026-09-27)在MuMu加载到89条回复及会话起点，四次翻页锚点偏移不超过0.47px，草稿与原内容保留；普通流程最长315ms，另一次尺寸变化流程343ms，完整性能未达成。断层重试有原模型与页面隔离回归；超长会话性能、更多扩展记录及完整异常仍待验收 |
| R07 | 审批、提问、计划及多端竞争 | 新版真实提问、单次文件审批、手机计划批准/提出修改、双向提问失效与旧点击失效已通过；两个实际客户端对原 Host 的在途冲突集成测试只结算一次。[提问与计划自然超时](#原提问与计划超时2026-09-27)已在MuMu验证原Host中止、卡片移除、草稿保留及下一请求不继承旧答案。[原工具审批期限](#原工具审批请求期限与下一请求2026-09-27)由专用会话的真实 ApprovalService 与30秒请求 signal 实测：Host取消、手机旧卡片移除、下一请求独立拒绝和持久审计一致。[原审批双端同步](#原审批双端同步与相反决定2026-09-27)已通过MuMu和电脑Edge实际页面：两个方向拒绝、近同时相反决定均只持久化一次，两端卡片清理；样例不调用模型/工具，按钮按校准时间触发，不等于所有网络排序。[模型实际 write 的允许一次/拒绝](#模型实际工具审批与拒绝2026-09-27)已通过：批准后磁盘/预览一致、拒绝后原文件不变，原只读权限保持。其余撤销与网络交错异常仍待完成 |
| R08 | 实时模型、Agent/权限/技能预设 | 新版 MuMu 与电脑页面的模型、思考强度双向同步及进行中禁止切换已实测；技能按会话读取、搜索、说明预览、草稿插入与真实发送同步已验证。当前会话权限目录及双向收紧选择已实测，危险预设确认与业务拒绝有回归；[自定义只读权限预设](#自定义权限预设实际选择2026-09-27)实际名称/选择、Host状态、恢复与移除目录已验。Agent 目录、空白会话选择、两端读取一致及第一轮后锁定已实测；[自定义Agent模式](#自定义agent模式实际选择2026-09-27)实际空会话选择、原Host投影、恢复标准模式与移除目录通过；[专用自定义工具](./custom-agent-runtime-current.md)的真实模型调用、电脑执行、手机结果匹配与模式锁定现已验证，不外推其他第三方模式。[PTC只读程序与内部工具](./ptc-runtime-current.md)实际执行、结果匹配及重入层级已通过。[自动审核实际放行与取消](./auto-review-current.md)的手机确认、原模型审核、文件执行、停止/续聊和恢复/卸载已验，电脑补丁修正停止误报拒绝；[手机中文取消提示](#手机工具取消提示2026-09-28)实际历史读取通过，真实审核拒绝、PTC失败/停止及跨端并发仍待处理 |
| R09 | 目标、后台、定时、子 Agent、工作流 | 目标基础生命周期、独立后台 stdout/stderr、400,036字节分段补读、停止/历史与模型读取互不影响、断线续读、单次/重复定时及跨首次到期恢复已实测。直接和两层子会话续聊/停止、图片支持与拒绝、父释放后的停止及返回、重启恢复与逐层草稿通过；工作流并行、失败/取消、成员导航、重启后中断与归档恢复通过。[旁栏后台输出在途撤销](#旁栏输出在途撤销2026-09-26)及[主聊天命令输出在途撤销](#主聊天命令输出在途撤销2026-09-27)均有实际设备证据；后者为已结束前台命令的输出读取，不代表运行中任务停止。实际页面任务回收、定时跨多个遗漏周期/并发/失败恢复、完整目标/子会话/工作流异常仍待补齐 |
| R10–11 | 工作区浏览、上传、引用、最新完整文件下载、各格式预览 | 已有工作区按需文件树、系统选择上传、文件/聊天引用、文本/Markdown、PNG/SVG、PDF、沙箱 HTML、Office 六格式和最新完整文件已在 MuMu 验证。历史附件已复用原文档注册表、标签与菜单；独立插件三种读取模式与卸载回退通过。最新[HTML失败重试](#html文件预览失败与重试2026-09-27)及[Office错误语言](./appearance-current.md#office预览失败提示2026-09-27)均有实际入口证据。旧自有整轮差异已实测；现行[原 ReviewTab](#原整轮改动预览2026-09-26)已有浏览器回归、实际快照缺失与[Android正常读取](#原整轮快照的-android-正向验收2026-09-27)证据；后者使用受控事件和原Host真实Git快照，双文件/左右对比/最新文件区分通过，不代表模型实际改文件全流程；另有[真实模型 write 轮次](#模型写入后的真实整轮差异2026-09-27)已通过单栏/左右内容核对及源文件删除后历史快照读取。[工作区图片](#工作区图片格式真实预览2026-09-27)补验PNG、JPG/JPEG、WebP、BMP、ICO、静态GIF、约4.7MB宽图/长图与损坏后重读通过；[GIF与动态WebP](#工作区动态图实际播放2026-09-27)已实际截取三个不同播放帧、关闭后草稿保持。[二进制与超2 MiB文件](#改动预览边界与刷新期间的列表状态2026-09-27)已由原Host真实拒绝结果验证手机明确提示、清除旧diff并恢复普通文本；[冷启动后的文件引用](#持久化文件引用的真实模型读取2026-09-27)及[聊天引用](#持久化聊天引用的真实模型读取2026-09-27)实际读取已通过；更大图片内存压力/不同附件来源、跨工作区草稿交接后引用实际读取和完整异常仍待完成 |
| R12 | 只读命令详情与输出恢复 | 自有命令窗口已接原工具记录和实时输出；MuMu已验证短/长输出、ANSI颜色、历史/重连续读、非零退出、复制、全屏、客户端重建与滚动恢复；[实际撤销](#主聊天命令输出在途撤销2026-09-27)清除命令窗口、丢弃在途响应并拒绝旧授权重连。[中文编码补丁](#中文命令乱码的电脑端根因2026-09-27)已安装，实际电脑与Android同一新命令的标准/错误输出及最终结果正确，原只读权限保持；其他执行类型/控制台组合仍待核查。localhost网站转发尚未实现，用户已于2026-10-03确认移出首版、后续再评估，不再阻塞首版；若恢复开发仍只允许电脑明确开放的地址/端口。沙箱HTML文件预览不算网站转发。手机不提供终端写入/创建 |
| R13 | 原插件图、动态加载、管理及撤销 | 原模块图、会话/输入/标题/旁栏/文档插槽和外层缩放已接入；独立插件实际加载、交互与卸载有 MuMu 证据。[包管理](./plugin-management-current.md)已实测安装/组件启停/卸载、双端同步、脚本批准与取消、下载中撤权、网关断线、页面重建、DSH重启未知结果及应用阶段取消过晚。终端/Agent/Subagent/搜索次数配置保存恢复已验，搜索Key/地址仅取消。动态插件审批/版本授权、Host失败恢复、渲染故障归属、网关重连与[DSH重启恢复](#电脑重启后的动态插件恢复2026-09-27)已实测；[历史工具卡片Android读取与重入](#历史动态插件卡片的android读取2026-09-27)通过上游快照导入原持久层验证；[Worker资源在途撤销](#worker资源在途撤销2026-09-26)及运行线程释放已验。[运行中动态插件设备撤销](#运行中的动态插件设备撤销2026-09-27)已验证手机界面清理、重连拒绝及共享Host运行保留。[双独立客户端目录与运行/停止/移除同步](#动态插件的双独立客户端同步2026-09-27)已在同一MuMu两个UID实测。[真实动态调用响应在途撤销](#动态插件响应在途时撤销2026-09-27)已验证暂缓结果丢弃、手机清理和重连拒绝。[双端相反审批的迟到操作](#双端动态审批的迟到操作2026-09-27)已验证批准后拒绝、拒绝后批准均由Host拒绝且保留先完成结果。[激活期间的并发审批补丁](#动态审批激活过程的并发修复2026-09-27)已安装，真实旧拒绝/重复批准子流程保住请求；配套[清单同步补丁](#动态清单同步安装与双端验收2026-09-27)后完整双端专项通过，停止/移除两端旧行清理已验；[载体断开后的旧连接世代窗口](#网络载体与插件连接状态同步2026-09-27)已修复，新版APK在中转/DSH分别重启后面板恢复、草稿保留且无错误；[首次协商在途断线及取消](#首次装配断线与取消恢复2026-09-27)已通过旧APK失败/新版自动恢复和真实取消对照，迟到ready/撤销提示有页面时序回放；更广首次网络不可达及其他交错待验。仍缺更广并发异常、搜索真实Key/地址/请求、授权模型实际调用、其他插件服务与安装形态、大安装日志及更广第三方兼容；active不代表完整交互通过 |
| R14–15 | 设置、反馈/日志、已有工作区管理 | 已有工作区改名/排序/移除注册及文件/聊天保留、原日志ZIP父子记录/附件导出与系统保存已实测；大日志、深层嵌套、撤销竞争仍待补。五项官方模型非敏感设置已真实保存/同步/恢复继承；官方Key和地址只验证读取/确认取消，实际替换/移除/保存未验。[官方模型清单实际保存](#官方模型清单的真实手机保存2026-09-27)已通过MuMu名称保存、电脑重读、手机目录同步及恢复默认；其他字段与独立电脑选择器仍待验。[自定义提供方实际管理](#专用提供方的真实手机管理2026-09-27)已通过手机新增/移除专用路由、超时/模型名称容量/输入思考能力/两层supportsStore保存与重读、恢复兼容继承、专用地址确认取消与保存、无引用路由启用独立Key及原生窗口取消；测试路由清理、管理权限收回。[内置目录发现与覆盖](#内置模型发现与覆盖的真实手机验收2026-09-27)已通过MuMu两个编辑入口、保存重读、清单互斥与恢复默认；[自定义发现的本机HTTP专项](#自定义模型发现的真实http链路2026-09-27)通过失败/取消/重试、去重及元数据保存；[已有用户覆盖保留/删除与过期写入](#模型覆盖保留与过期写入的手机验收2026-09-27)通过真实单手机双表单竞争；基础层/隐藏字段手机实测、双设备竞争、真实第三方认证/TLS、其他协议、其他标量/兼容字段仍待验。[独立提供方 Key](#电脑提供方-key-的原生保存与实际请求2026-09-27)已通过原生保存、电脑实际 HTTP 发现请求携带匹配 Bearer、移除后不再请求和清理收权；不代表第三方认证/TLS或推理请求。任意凭据引用管理与OAuth尚未接入，通用settings/credentials不开放。反馈读取/取消、双端事件订阅通过，真实提交/撤回后的双端图标与本地日志目的地核验仍待完成 |
| R16 | 明确在电脑打开、手机下载/分享 | 最新完整字节下载/分享、取消、独立UID权限、附件/工作区文件网关中断后清理及手动重试已实测。交付/整轮改动/正文/工具电脑打开及历史附件独立副本已验，Office六格式副本与原件一致，Word实际窗口通过；Excel超时提示未知，其他办公应用待验。[附件暂存写入中真实撤销](#文件写入中撤销与插件线程释放2026-09-26)已证明不交付并清理；[Android目标文件写入中取消](#android目标文件写入中取消2026-09-26)已通过真实原生链路和受控DocumentsProvider。[半成品删除失败提示](#保存失败后半成品清理被拒绝2026-09-27)已修复。[写入中真实强停后的恢复提示](#目标文件写入时进程结束2026-09-27)通过受控提供方、普通/Remote入口、确认前后重启及目标保留；[分享复制中强停清理](#分享副本复制时进程结束2026-09-27)已实测保留完整快照、清理未发布副本。其他来源/格式、工作区文件撤销、接收App异常、低内存回收、不同实际提供方删除失败、大文件弱网及完整异常仍待验收 |

## 当前会话权限双向同步（2026-09-24）

- 状态：新版 Android 自有页面已接入当前会话权限目录和选择；完整 R08/R01–R16 尚未完成。来源：[权限模型](../../src/remote-permissions.mjs)、[手机窗口](../../src/ui/RemotePermissions.jsx)、原 [PermissionCatalogDirectory](../../../deepseek-harness/packages/client/ui-permission-presets/src/client/catalog.ts)、原 [权限 handler](../../../deepseek-harness/packages/interaction/permission-presets/src/index.ts)、原 [Session.command](../../../deepseek-harness/packages/api/session-controller/src/client/sessions/session.ts)。
- 比较直接调用 Session.command 与使用同一生成接口：前者只保留 matched，无法向用户显示 handler 的业务拒绝，因此调用原 remote.commands.execute，保留完整原结果；不是另造命令协议。当前值只取同一会话的 permissions 投影，不根据请求成功乐观更新。
- 「Remote 选项 → 会话权限」读取真实可选目录；配置变更和原连接代次触发刷新，失败可重试。进行中、子会话、旧会话及并发切换被拒绝，完全权限/自动审核使用原说明并要求勾选确认；失效目录或电脑当前值改变时关闭旧确认。自定义预设使用电脑名称，目录里没有的值不能提交；未知结果要求重新连接核对，不自动重发。
- 插件 **0.1.13** 与网关双侧仅允许 `/permission <预设>` 的精确参数，拒绝其他命令、多行、控制字符、附件和多余字段；当前会话权限不是插件管理授权，不修改设备已有 management 权限。测试覆盖独立 Host 拒绝与真实 HTTP/票据/WebSocket 转发，不以仅前端禁用代替策略。
- MuMu 在 DSH-TEST 创建「DSHM 权限联调 手机同步 有记录 20260924」，收到无工具回复后把工作区内修改收紧为仅可查看，电脑页面直接确认相同权限及原 permission 记录。另建「DSHM 权限联调 电脑同步 20260924」，在电脑页面收紧为只读，手机读取到相同值。报告分别为 `artifacts/remote-permissions-phone-to-pc.json`、`artifacts/remote-permissions-pc-before.json`、`artifacts/remote-permissions-pc-to-phone.json`；错误和失败资源为空，草稿保留。两条有记录的专用会话已归档，返回原测试会话，原 Pro/High/只读保持；没有实际启用完全权限或自动审核。
- 首次尝试使用没有消息的临时会话，离开后历史列表无法再定位，测试脚本未发送消息即超时；不能把该次记录当作完整同步通过。新验证先在独立会话创建真实无工具消息再切换，避免将空白会话当成持久历史。最终截图发现权限标题误继承辅助说明的灰色小字，已修正为按钮正文样式。
- [模型回归](../../tests/remote-model.test.mjs)使用[原生成接口样本](../../tests/fixtures/generated/README.md)，覆盖原 wire 参数、业务拒绝、无乐观更新、确认门槛、会话归属、目录错误/失效和未知结果。Node **132 项**、Web 插槽真实组件回归、Web/APK 构建及 Android lint 通过；插件 **47 项**、后端 **31 项通过 / 1 项独立 PostgreSQL 测试未运行**，双方类型检查和构建通过。当前实际电脑目录仅三种预设，自定义/自动审核由回归覆盖，未实测实际 Host 自定义配置。

- 最终 APK 覆盖安装保留 Key/历史/绑定。权限、模型、技能和插件重连联合报告 `artifacts/remote-mobile-permissions-android.json`（**2026-09-23T23:55:22.780Z**）错误/失败资源为空；权限标签字号和颜色与按钮正文一致，已查看截图；Pro/High/只读及原草稿保留，重连无重复样式。

## 手机选择电脑技能（2026-09-24）

- 状态：技能选择与调用已接入新版 Android；不代表原 ui-skill/inputTriggers/sidebarRight 的全部插件交互已完成。来源：[目录](../../src/remote-skills.mjs)、[手机技能界面](../../src/ui/RemoteSkills.jsx)、原 [ui-skill](../../../deepseek-harness/packages/client/ui-skill/src/client/index.ts)、原 [会话技能目录](../../../deepseek-harness/packages/api/session-controller/src/skill-catalog.ts)、原 [pre-step 技能注入](../../../deepseek-harness/packages/skill/tool-skill/src/index.ts)。
- 比较直接挂载原桌面输入/侧边栏与使用手机选择页，采用后者：维持已确认的 DSHM 页面与共享输入框，直接调用电脑生成的 skills/list 和 commands/list。选择仅插入原 `/name ` 文本；技能正文不由手机拼接、不交给普通聊天 Key，实际加载由电脑原 pre-step 处理。手机不开放任意命令执行。
- 当前会话、Agent 预设和连接世代决定目录归属；读取失败可重试，重叠加载共享在途请求，切会话/预设变更/重连/销毁取消技能读取并丢弃迟到结果。原 commands/list 没有 signal 参数，客户端仅丢弃其迟到结果，不声称取消电脑已接收的读取。同名命令由原 resolveCommand 判断并禁用，原 pre-step 不支持的技能名明确不可快捷调用。
- 「＋ → 选择技能」支持原 rankByName 搜索、空状态、仅手动调用标记、查看电脑原说明文件、保留原草稿和防重复插入。技能说明沿用现有文件预览权限，不能靠返回路径扩大访问权限。长说明由内容决定按钮高度，三行摘要和独立说明入口避免覆盖相邻项。
- MuMu 正式入口真实读取电脑目录；在专用 DSH-TEST 工作区临时放置[测试技能](../../tests/fixtures/remote-verification-skill.md)，不进入 APK。仅手动调用的技能在手机可见，说明预览成功，选择保留已有要求，实际发送不含预期标记。电脑 pre-step 注入正文并返回 `DSHM_SKILL_BODY_20260924_7E42`，内置浏览器确认同会话同时出现技能调用、上下文注入与回复。报告 `artifacts/remote-skill-invocation-android.json`，时间 **2026-09-23T23:14:50.507Z**，无页面/资源错误。未放宽仅可查看权限，未执行工具；临时技能测试后移除，模板仅保留在测试夹具。
- 实际截图发现最初长描述继承 48px 选项高度造成重叠，该初版功能通过不能视为视觉通过。已修正并重新构建/覆盖安装，`artifacts/remote-skills-layout-android.json`（**2026-09-23T23:16:29.714Z**）逐项检查子内容不溢出、搜索框高度 44px，截图确认；联合模型读取保留 Pro/High 与草稿。Node **130 项**、Web 插槽/技能失败重试/搜索/命令同名/草稿回归、Web 构建和 Android assembleDebug/lintDebug 通过。
- 原 ui-skill 插件仍等待完整输入/资源服务，此处是自有页面调用同一真实业务接口，不将 active 状态或技能选择当作全部插件兼容。Agent/权限预设、R09 等及其余完整矩阵保持待完成。技能清理后的联合重连检查再次复现既有故障，具体定位与修复见下一节。

## 空闲后首次重连失败（2026-09-24）

- 状态：已复现并修复空闲 HTTP 复用导致的首次重连失败，不代表全部弱网、代理和长期稳定性通过。来源：[原生桥](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)、[真实 Android 重连循环](../../scripts/diagnose-remote-reconnect.mjs)、实际网关 Fastify 默认 `keepAliveTimeout=72000`。此前记录中的“间歇故障未定位”是当时结论，现由本节补充。
- 反馈回路直接操作正式页面的断开和重新连接，不重新配对、不发聊天。8 次 0/1/5 秒短间隔全部成功；76 秒空闲后第一次失败，随即再点成功。临时日志只记录固定 API 路径、连接对象编号和异常类型，不含请求/响应正文或凭据。实际 `/v1/device` 复用旧连接，抛 `IOException`，cause 为 `EOFException`；新连接随后成功。证据 `artifacts/remote-reconnect-short-idle.json`、`remote-reconnect-idle-before.json`、`remote-reconnect-native-before.log`。
- 比较启用 OkHttp 自动重试与不保留空闲 HTTP，选择后者：这类请求只用于配对、状态和票据，额外建连成本有限；不改变禁止自动重试/重定向、身份签名及 TLS 校验，避免将配对领取等写入悄悄重复执行。活动 WebSocket 与消息通道不受空闲池释放影响。
- 修复前同一脚本 76 秒分支失败（66 ms），修复后正式覆盖安装，76/0/1/5 秒全部连接成功（约 2.7/1.9/1.9/1.8 秒），页面错误为空。报告 `artifacts/remote-reconnect-idle-after.json`。脚本支持 `DSHM_RECONNECT_IDLE_MS=76000,0,1000,5000`，仅使用 `DSHM_ANDROID_SERIAL` 指定的 MuMu 与已有绑定；不修改服务端超时来绕过真实问题。
- 临时 `[DEBUG-remote-connect]` 插桩已从源码移除，最终 Android assembleDebug/lintDebug 通过，原凭据/历史保留。此检查可在网关或网络库升级后重跑，防止只测立即重连遗漏空闲连接状态；不需要新增认证接口或放宽设备权限。

## 模型双向同步与输入框点击（2026-09-24）

- 状态：R08 的模型选择部分已在新版 Android 实测，其他预设/权限/技能不因本批通过而视为完成。来源：[模型层](../../src/remote-model.mjs)、[手机界面](../../src/ui/RemoteWorkspace.jsx)、原 [ModelCatalogDirectory](../../../deepseek-harness/packages/client/ui-model-selection/src/client/catalog.ts)、原 [模型选择命令](../../../deepseek-harness/packages/api/session-controller/src/commands.ts)。
- 对比继续手写一次性目录缓存与复用原目录服务，采用后者：共享在途加载，电脑适配器/设置/凭据变更事件刷新，连接世代变化清空旧目录并重新读取；旧请求晚到不会覆盖新目录。目录失败只影响选择菜单，已连通的历史和聊天保持；菜单给出加载、失败重试、服务商局部失败和不可路由提示。
- 切换会话立即清理上一会话的模型与队列展示。模型写入只使用捕获的当前 sessionId 和模型字段，禁止进行中/未打开会话切换、同会话并发提交；响应不乐观覆盖投影，电脑事件是当前值来源。传输失败明确“结果尚未确认”，不自动重放。原 DSH 的 selectModel 也保存新会话默认模型，本批未改变该原语义，测试结束恢复 Pro / High。
- MuMu 手机从 Pro / High 切至 Flash，内置浏览器的 DSH 同一专用会话立即显示 `DeepSeek-V41-Flash / High`；电脑再切回 Pro，手机同步。手机改 Low，电脑显示 Low；电脑恢复 High，手机也恢复。报告 `artifacts/remote-models-phone-to-pc.json`、`remote-models-pc-to-phone.json`、`remote-models-restored.json`。电脑观察使用内置浏览器真实菜单，不通过独立 RPC 假装页面同步。新增[手机验证入口](../../scripts/verify-remote-models.mjs)使用 `verify-remote-mobile-android.mjs --models`，可通过 `DSHM_MODEL_SELECT`、`DSHM_MODEL_EFFORT`、`DSHM_MODEL_EXPECT` 指定观察/切换；写入另需 `DSHM_RUN_LIVE=1`。
- 真实提问停留期间，全部模型和强度按钮不可点击；回答后正常结束。最终报告 `artifacts/remote-mobile-question-android.json`（**2026-09-23T22:59:45.943Z**），标记 `DSHM_CORE_QUESTION_1790204390459`，`runningModelDisabled=true`，页面/资源错误为空。
- 该实测发现共用 [MobileComposer](../../src/ui/MobileComposer.jsx) 在 blur 时立即收起，导致第一次按下/松开之间移动提问选项。现等待本次指针点击完成再收起，包括触摸 pointerup 后的兼容鼠标事件；键盘失焦、Esc、草稿和既有 transform/opacity 动画保留。独立[点击回归](../../scripts/verify-composer-focus.mjs)修改前复现目标移动，修改后鼠标和触摸一次点击均成功。报告 `artifacts/composer-focus-web.json`；前一条测试已单独完成，没有留下待回答项，不能把该次首次失败算通过。
- 模型及强度选中项增加可见勾选，已查看最终 MuMu 截图。Node **128 项**、Web 插槽/模型失败重试/运行中禁用回放、输入框指针回归、Web 构建与 Android assembleDebug/lintDebug 通过。最终 APK 覆盖安装保留 Key/历史/绑定；模型选择与插件断开重连联合检查 `artifacts/remote-mobile-models-android.json`（**2026-09-23T23:00:31.895Z**）通过，Pro / High 已恢复，草稿保留，无页面/资源错误或重复样式。普通聊天实际完整回归未重跑，共用输入框由独立鼠标/触摸测试覆盖；此前间歇重连故障仍未定位。

## 扩展聊天节点与语言服务（2026-09-24）

- 状态：自有聊天新增 `conversation.chat.node` keyed 插槽，用于现有手机消息分支未处理的扩展节点。数据来自原会话投影，提供同一节点的 `useChatNode`、`useChatNodeProcess`、`useTurnData`；缺 renderer 时展示原始内容，renderer 卸载后恢复兜底。已有普通消息、工具和文件等手机分支保持；尚未实现所有原 ChatNodeOwnerProps 或任意插件替换内置消息。
- 直接使用原 [LocaleRuntime](../../../deepseek-harness/packages/client/locale/src/client/index.ts) 的无 Host 独立组合模式，注册原 common/chat 字典并安装插槽翻译。初始语言取 DSHM 文档语言，插件可以注册字典并订阅变化；当前是连接内语言状态，不写电脑设置，不宣称已打通手机持久语言偏好。原 locale apply 由手机组合承担。
- 独立[插件回归](../../scripts/verify-remote-plugin-slots.mjs)通过真实事件投影、节点 key 对应、轮级 Hook、语言实时变化、迟加载、卸载兜底/重载、会话隔离；测试节点和 renderer 明确属于 fixture，不进入 APK，不冒充真实第三方插件验收。
- 该前置批次 MuMu 正式入口实际模块图为 **14 active / 12 mobile / 33 waiting**。补齐 locale 后，原审批、提问、输入触发、后台任务、轨迹、日志导出模块能够启动；它们的完整插槽、事件与交互仍未接通，不能把 active 等同功能验收。`ui-open-in-app` 原 apply 直接请求 `/open-in-app/apps` 导致 403，现明确等待独立路由适配并显示原因，保留模块表且不开放任意 HTTP；R16 仍待完成。
- Node **121 项**、独立 Web 插槽回归、Web/APK 构建、Android lint 通过。APK 覆盖安装保留 Key/历史/绑定，最终真实图、自适应恢复、断开重连、样式/脚本清理检查通过：`artifacts/remote-mobile-plugins-android.json`，时间 `2026-09-23T22:08:46.069Z`，27 条回复、一个输入框、零页面/资源错误。已查看最终聊天截图。期间一次 WebView 截图超时、一次重连出现 `remote_operation_failed`；随后重试恢复并完整通过，尚未定位这两个间歇问题，不能宣称已修复或长期稳定。没有发送新消息、改电脑配置或授予管理权限。

## 原连接服务与接口定义（2026-09-24）

- [Remote 核心](../../src/remote-core.mjs)复用原 installConnection、Client Gateway、TypertRegistry、PendingApproval/PendingQuestion；[模型](../../src/remote-model.mjs)移除手工方法表、固定假世代及事件循环。原 Gateway 独占事件连接和 wire 身份，手机交互只持有原 pending key。Agent 解析使用同一个 ClientSessions 的 retainAgentScope，并按原 owned-value 规则释放。
- [加载器](../../src/remote-plugins.jsx)先准备真实 bootstrap，导入已认证电脑的 `dsh-api-remotes/client`；安装接口、会话和手机插槽后才接收事件、启动业务插件。没有第二个 Gateway/ClientSessions 或桌面根页面。普通图更新重建插件子树；核心 revision 改变时断开并要求重新连接，避免继续使用过时接口。
- 原 Gateway 将载体异常转为 `gateway/internal`/`gateway/cancelled`，发送层将其视为结果未知，保留草稿、阻止附件重发；业务明确拒绝仍可编辑。审批本地答复先结算，实际回传由原 Gateway 完成；回传失败结束当前世代并取消其余交互，不宣称本地点击即为电脑确认。
- 服务存在不等于设备获准调用。已核验的动态插件、反馈、目标、预设、凭据及管理入口按协商 `endpoints.calls` 选择 apply；未开放时显示等待原因，保留完整模块表，不扩大后端权限。原普通设置服务在远程环境使用其 memory persistence。更多接口/界面仍属于完整 R01–R16 待办，暂停 apply 不算功能完成。
- 全控制台检查发现原动态插件自动请求被拒接口，以及 WebView 的 `/favicon.ico` 被隔离边界拦截。前者改为按协商条件启动，后者使用页面内空 favicon，未开放新路径。中途一次既有 `remote_operation_failed` 重连失败尚未定位；最终成功不能证明间歇故障已修复。
- 离线测试使用实际 DSH 构建的[生成贡献样本](../../tests/fixtures/generated/README.md)，不手写 descriptor，不进入 APK；产品无本机安装路径依赖。Node **126 项**通过，覆盖单一连接、事件随插件卸载、参数数量/取消、Agent 身份、重连清除旧交互、答复回传失败不重发。独立 Web 插槽回归、Web 构建、Android assembleDebug/lintDebug 通过。
- MuMu 真实提问收到 `DSHM_CORE_QUESTION_1790202272975`，报告 `artifacts/remote-mobile-question-android.json`（22:24:32 UTC）。同一专用会话随后完成两份独立文件修改，4 次允许一次、磁盘内容、工具/整轮差异、最新完整文件与删除后历史快照保留通过，报告 `artifacts/remote-mobile-changes-android.json`（22:25:25 UTC），回复 `DSHM_DIFF_DONE_1790202325314`。未修改其他文件或永久放宽权限。
- 最终 APK 覆盖安装保留 Key、历史和绑定。全控制台检查报告 `artifacts/remote-mobile-plugins-android.json`（**2026-09-23T22:39:39.798Z**）：**19 active / 16 mobile / 24 waiting**，当前分页窗口 24 条回复、一个输入框、无 iframe；错误/失败资源为空，开关恢复、断开重连、样式清理通过。更多局部 UI、输入/设置、管理、计划/多端竞争和完整撤销仍未验收。

## 真实模块图与外层自适应（2026-09-24，前置批次）

- 状态：已在正式 Android 读取真实电脑模块图与代码；**不是全部插件已兼容**。来源：[动态加载器](../../src/remote-plugins.jsx)、[组合策略](../../src/remote-plugin-policy.mjs)、[原生资源入口](../../src/remote-transport.mjs)、[手机插件列表](../../src/ui/RemotePlugins.jsx)、[外层 API](../plugin-validation/mobile-layout-api.md)。
- 从既有授权通道读取 `remote.graph`、订阅 `remote.graphFollow`，加载电脑真实 bootstrap，并复用原 ClientModuleSystem、Loader 和完整依赖表。仅排除手机已承担的组合 apply，包括会话/投影/顶层页面、连接和热更新入口；其他插件正常按真实服务依赖启动，未满足时保持 waiting。原桌面 HMR 请求 `/plugins/events` 曾返回 404，现由既有图订阅承担，最终回归无该请求错误。
- 图 revision 变化时当前实现重建插件子树，清理其 factory 样式和全局桥引用；同一模型、会话、草稿与 DSHM 根页面保留。不是逐插件热替换。script 元素标注加载代号；迟到注册不能写入下一代模块表，局部 AbortSignal 与连接取消合并。任意插件直接注册 root 会失败，不替换手机根页面。
- 默认仅缩放超宽内容最外层，窄内容不强行放大，内部 CSS 不变；外层高度随比例计算，关闭后局部滚动。新增 `ctx.dshmLayout.configure({ autoFit: false })`，通过条件注入兼容未提供该服务的原 DSH；作者声明随插件卸载释放。用户开关保存在手机独立来源，优先于作者，支持恢复默认；同插件嵌套插槽不重复缩放。
- 独立浏览器脚本现通过原 bootstrap 与真实 script 加载明确标识的测试插件，验证图 v1/v2/v3、宽内容比例与点击位置、用户 > 作者 > 默认、声明卸载、保留草稿/消息、拒绝根页面替换，以及样式/全局引用清理。此项是受控测试资源，**不冒充电脑第三方局部 UI 已实测**；证据 `artifacts/remote-plugin-slots-web.json`。
- MuMu 正式入口真实图共 **59** 个模块：**8 active、11 mobile、40 waiting**；包含已安装 `@dsh-mobile/plugin` 的真实代码加载。插件页面自适应切换/恢复可用。断开立即重连曾暴露 React 仍挂载时 adapter 已销毁的竞争，现 [RemoteApp](../../src/RemoteApp.jsx)先同步卸载界面，再串行释放上一代，之后才重连。最终重连保持模块状态和样式数量、无遗留 script，恢复原测试聊天；未发送模型消息、未修改电脑插件配置、未增加管理权限。
- 最终 `artifacts/remote-mobile-plugins-android.json` 页面/资源错误为空，聊天 27 条回复、一个输入框；额外连续重连报告位于 `artifacts/remote-plugins-reconnect-1.json` 与 `artifacts/remote-plugins-reconnect-2.json`。Node **120 项**、Web 构建、Android assembleDebug/lintDebug 通过，覆盖安装保留 Key/历史/绑定。
- 本前置批次后续已补局部语言和扩展节点，当前连接迁移结果与剩余事项见上一节。仍需更多局部插槽、真实第三方局部界面、管理授权、完整资源/Worker/撤销矩阵。当前列表主要展示模块 ID，完整插件包元数据与管理操作尚未接入。不能因为 bootstrap/部分模块 active 就认定任意插件兼容。

## 局部插件插槽基础（2026-09-24，前置批次）

- 状态：本前置批次只验证插槽，后续真实图与缩放进展见上一节；不代表 R13 完成。来源：[局部宿主](../../src/remote-plugin-slots.jsx)、[应用入口](../../src/RemoteApp.jsx)、[轮尾入口](../../src/ui/RemoteMessage.jsx)、[会话层](../../src/remote-model.mjs)。
- 在现有 RemoteModel 的同一个 Cordis Context 上安装原 SlotRegistry、React 插槽渲染器与 UiSession。复用现有 ClientSessions/UiConversation，不启动 bootClient，不提供桌面 uiRenderer/uiLayout，不创建第二套会话连接。保留 DSHM 根页面与共享消息/输入框。
- 声明原 `conversation.chat.turnTail` 与 `conversation.chat.assistant-actions` 插槽。传递原 TurnLocation、完成消息序号及 messageId；插件的 useSession/useChat/useSessionStatus 读取真实绑定。reference ready 前不交给 SessionProvider；切换会话隔离旧引用，连接销毁释放整代作用域和订阅。原 `$events` 的 emit 同步到本代远程事件订阅，审批 waterfall 路径不变。
- [独立回归脚本](../../scripts/verify-remote-plugin-slots.mjs)通过真实 RemoteWorkspace/RemoteMessage、原投影与插槽注册检查迟加载、实时新轮次、运行状态、身份、切换会话、卸载重载和断线销毁。输入为[测试协议回放和本地测试插件](../../tests/fixtures/remote-plugin-slots.jsx)，不进入 APK；**不是电脑插件动态加载实测**。报告 `artifacts/remote-plugin-slots-web.json` 无页面错误。
- Node 118 项、Web 构建、Android assembleDebug/lintDebug 通过。APK 覆盖安装保留普通聊天 Key/历史与既有绑定；MuMu 正式入口只读回归读取专用聊天 27 条回复、一个输入框、零页面/资源错误，既有按轮分支可用性保持。证据 `artifacts/remote-plugin-scope-android.json`，未发送新消息或修改电脑文件；插件、网关与上游未改。
- 该前置批次当时未覆盖真实图、作者声明和用户开关；后续范围保持有效，当前实现及剩余项以上一节为准。

## 按轮分支（2026-09-24）

- 状态：手机自身轮尾入口已接真实 DSH 分支，MuMu 实测通过；完整 Remote 仍按矩阵推进。来源：[分支坐标](../../src/remote-forks.mjs)、[会话操作](../../src/remote-model.mjs)、[消息入口](../../src/ui/RemoteMessage.jsx)、[实测脚本](../../scripts/verify-turn-fork.mjs)。
- 复用原 [TurnTailNodeView](../../../deepseek-harness/packages/client/ui-chat/src/client/chat/TurnTailNodeView.tsx) 的轮尾可用条件，以及原 [ClientSessions.fork](../../../deepseek-harness/packages/api/session-controller/src/client/sessions/service.ts) 标题和坐标处理。传递 `closing.finalNode.seq`，不把轮号、DOM 索引或 UI 排序序号当作日志位置；中断节点的小数坐标交给原客户端取整。未完成轮次、过期入口、切换会话后旧入口不提交。
- 原版文件改动位于轮尾插槽，DSHM 的独立 `remote-changes` 按钮仅是展示入口；它不影响原分支边界。其他后续聊天节点仍遵守原限制。原 `branchUnavailable` 所反映的工具/错误等业务状态不绕过。
- 内部防止并行重复分支；请求绑定原会话。创建期间用户已切换会话时，结果不会强行跳转；新分支仍进入原服务的会话列表。分支不复制未发送草稿，原草稿保留；失败不自动重放创建请求。
- MuMu 从专用“DSHM Remote 联调提示”的第 **37** 轮分支，检查可见前缀 **25** 条回复一致且原第 **38** 轮不存在；新分支独立收到 `DSHM_TURN_FORK_OK_1790197670342`，原会话回复保持一致、原草稿保留。测试分支 `DSHM 按轮分支联调 1790197670342` 已归档，原会话恢复并清理测试草稿。证据：`artifacts/remote-mobile-turn-fork-android.json` 与 `artifacts/remote-turn-fork-android.png`。
- 最终 APK 另以 `--fork-availability` 检查真实第 36 轮文件修改可分支，报告 `artifacts/remote-mobile-fork-availability-android.json`。两份报告页面/资源错误为空。Node **118 项**、Web 构建和 Android assembleDebug/lintDebug 通过；[模型测试](../../tests/remote-model.test.mjs)覆盖原事件到轮尾投影、真实消息坐标、差异入口、过期与并发/迟到结果；[纯规则检查](../../tests/remote-forks.test.mjs)覆盖扩展后续节点及中断坐标。插件、网关及只读上游未改，覆盖安装保留绑定/Key/历史。

## 只读命令详情（2026-09-24）

2026-09-25核心版本交错验收（当前）：[MuMu脚本](../../scripts/verify-core-rebuild-android.mjs)新增 `--overlapping-updates`，在原核心更新触发重建、模块script已加入页面而资源仍传输时，经透明设备代理暂缓真实响应（350120字节）；保持连接，改变同一bundle时间戳发布第二版，等待原500ms轮询观察后恢复传输。脚本只旁观真实图通知及成功script加载事件，确认最终加载URL属于第二版 `ea92a89d03ba` 的模块图，未替换消息/模块内容。草稿、全屏、历史首段和280像素滚动位置保留，续读65536→131072；恢复原时间戳导致后续重建仍可读完150799字节。

23:47:54 UTC[报告](../../artifacts/core-rebuild-overlap-android.json)错误为空，模块SHA256不变且原时间戳恢复，草稿清理、测试会话保持归档并回原聊天。23:48:47 UTC[清理记录](../../artifacts/overlap-proxy-cleanup-android.json)确认无离线提示；ADB恢复8787→8787，代理正常退出。首次脚本只监听body而script位于head，未触发暂停，不计交错验收；改为监听documentElement后再执行成功。本轮只扩展验证代码，无生产升级；证明当前兼容基线下两版交错能够收敛到最新版，不承诺任意不兼容核心升级。真实撤销、其他执行类型/安装形态、完整网页及R01–R16继续实施。下一批优先补齐R16尚缺的文件来源，先核对Host现有文件授权与打开接口。

2026-09-25核心重建中断修复（当前）：[RemoteApp](../../src/RemoteApp.jsx)原来只把已捕获的阅读状态存在一次load的局部变量，释放旧模型后装配失败便丢失；重连流程也因没有恢复资料而不自动启动。现将该资料在释放前交给recovery，成功呈现才清除，主动断开/权限变更/撤销仍走原清除规则。[生命周期回放](../../scripts/verify-remote-app-recovery.mjs)运行实际RemoteApp、隔离替代其模型与网络依赖：修复前“失败后回首页”和“中断后不自动恢复”均复现，修复后单次/连续失败、自动重连、主动断开、权限变化5种情况通过；不是鉴权或真实Host验收。

真实入口：[原MuMu脚本](../../scripts/verify-core-rebuild-android.mjs)的 `--network-failure` 使用[本地设备代理](../../../backend/scripts/verify-device-output-proxy.mjs)透明转发原8787网关；页面卸载进入装配时暂存真实响应（观测300字节），随后实际断开唯一设备TCP连接。新版App自动连接，新transport/模块加载器、原测试聊天/草稿/全屏/历史页恢复，滚动280→280，65536→131072字节续读，再在文件时间戳恢复引发的第二次重建后读完150799字节。23:41:32 UTC[报告](../../artifacts/core-rebuild-network-failure-android.json)错误为空，原模块哈希不变、时间戳恢复、测试草稿清理并回原聊天。随后ADB映射恢复8787→8787，代理正常退出；23:42:34 UTC[清理核对](../../artifacts/rebuild-proxy-cleanup-android.json)确认原聊天且无离线提示。

验证限制与排查：最初浏览器route注入无法拦截Android原生资源桥；第一次还误把加载页的disabled重连按钮视为失败，随后明确失败提示等待超时证实未注入故障，这两次不计通过。清理中的窗口再次重建曾遮挡返回按钮，下一次清理只清除了专用会话的已知测试草稿。最终改用真实设备代理而非伪造事件。233项手机测试、原组件回放、上述5项生命周期检查、Web构建与Android assembleDebug/lintDebug通过，最终APK已安装；未改Key、地址、遥测、设备授权或参考检出。连续更新交错、不兼容升级、实际在途撤销与完整R01–R16仍未完成；下方旧记录按其阶段理解。

2026-09-25核心模块真实重建补充（当前）：[MuMu脚本](../../scripts/verify-core-rebuild-android.mjs)打开此前已归档的专用颜色测试会话，不新增模型请求。以实际安装的 `packages/api/remotes/lib/client.js` 时间戳变化触发原DSH HMR轮询、模块图通知和手机 `RemotePlugins.coreRevision → RemoteApp.load → 新RemoteModel`；仅重挂载RemoteWorkspace的旧组件回放不作为该路径的证据。观察到原transport hooks和ModuleLoader facade均替换，当前聊天、未发送草稿、全屏/历史选择和首段65536字节输出保留，窗口滚动280→280像素；用户显式“重新读取”后游标131072。恢复时间戳引发第二次完整重建，再显式续读至150799字节末尾，未重发模型消息。

[报告](../../artifacts/core-rebuild-android.json)时间23:29:33 UTC，页面错误为空；原模块SHA256 `f31e216d148e3499ccccf646d16167f5a143ff378575f8e00672928c7d0694b3` 前后相同，时间戳恢复，测试草稿清理并返回原聊天，既有测试会话仍归档。截图已核对，未改模块代码、Key、权限、遥测或参考检出；本轮只新增验证脚本，无生产升级。本证据证明真实核心模块重建路径在成功加载时可恢复，不证明任意不兼容核心升级或重建中断/撤销。后续需覆盖装配中网络失败、多个更新交错与完整R01–R16；下方“仍待实测”按各历史阶段理解。

2026-09-25跨页颜色修复与验收（当前）：[共享ANSI状态](../../src/remote-output-ansi.mjs)为前台命令/后台任务保留有限SGR颜色及装饰，跨块CSI暂存最多256字符，OSC正文不入缓存；历史页和128K显示裁剪使用原上游parseAnsiLines渲染。原始文本、复制及字节游标独立；缺口清除未知状态，换流/身份不继承，内存交接保留状态，旧版无ANSI字段的checkpoint从保留文本恢复。它不负责恢复裁剪前的任意光标屏幕，不是完整终端仿真。

- [8项边界测试](../../tests/remote-output-ansi.test.mjs)先复现4项失败，再覆盖64KiB分页、CSI/OSC拆分、UTF-8中文/emoji逐字节、RGB/256色/装饰重置、128K裁剪、缺口及旧checkpoint空段恢复。补充属性测试最初使用了bold字符串，而原渲染器实际返回700；按源码修正断言。正式组件回放另复现旧checkpoint空读清空，修复后重跑通过，未修改回放来绕过问题。
- 手机233项测试、原RemoteWorkspace组件回放、Web构建、Android assembleDebug/lintDebug通过，最终APK已覆盖安装。新版[真实MuMu脚本](../../scripts/verify-output-ansi-boundary-android.mjs)单次发送专用pwsh打印命令，150,799字节实际输出：128K实时裁剪、第二及第三历史页均为rgb(236,19,19)，SGR重置后文字恢复默认色，截图核对一致。[运行报告](../../artifacts/output-ansi-boundary-run-android.json)为23:23:08 UTC、页面错误为空；[清理报告](../../artifacts/output-ansi-boundary-cleanup-android.json)23:23:42 UTC确认归档专用聊天并返回原联调会话。
- 本轮不改插件、电脑执行环境、Key、地址、遥测或设备权限；上游参考无改动。后台任务使用相同reader/render入口，边界单测走后台reader、真实大颜色样例走前台命令；没有把它表述为另一条后台真实大颜色样例。核心更新成功重建见上方后续实测；重建中断、在途撤销、其他执行器/安装形态及R01–R16继续实施。下方为此前短输出和早期失败的历史证据。

2026-09-25颜色核验补充：最初的Write-Output样例没有产生ANSI，不能据此判定手机丢色。[实际安装执行器对照](../../../plugin/compatibility/foreground-output/verify-native-ansi.mjs)用独立Cordis树、原Subprocess/Pwsh及真实Windows进程两次确认：PowerShell7.6.6管道样例在收集前已无ESC；同一环境下Console.Write显式ANSI的22字节及原最终结果完整保留。未改NO_COLOR、配置或运行DSH。随后[真实App脚本](../../scripts/verify-foreground-output-android.mjs) `run --ansi` 经原模型工具、Host、中继与MuMu，命令等待期间显示红色 `rgb(236, 19, 19)`；stdout/stderr、完整历史、最终退出7、全屏及重入通过，页面错误为空，截图已核对。报告`foreground-ansi-run-android.json`（23:05:57 UTC），23:07:05 UTC cleanup确认归档并回原聊天。本轮只调整验证代码，无生产升级。短输出ANSI端到端通过；跨64KiB历史分页及128K显示裁剪的ANSI状态尚未验证，下方早期color:null保留为历史证据。

2026-09-25 接口补充：[前台输出兼容补丁](../../../plugin/compatibility/foreground-output/README.md)已关联两个原工具的真实执行身份，经[Host注册表](../../../plugin/src/command-output.ts)、固定 `remote.commandOutput` 和Android桥接入[手机原命令详情](../../src/ui/RemoteCommand.jsx)。保留原前台超时/取消/审批/沙箱与最终结果；新增运行中stdout/stderr及分段历史，复用后台输出的解码、容量和取消组件。调用时间、token、会话/Agent和服务代次隔离旧数据；不接受任意路径或命令。手机已补窗口重建交接：保存坐标、全屏、实时/结果视图、流/分段选择、滚动位置及含outputId/UTF-8半字符的读者检查点；用户换流或从头查看从零读取，关闭或换会话不恢复旧窗口。

恢复验证：225项手机测试通过，新增覆盖检查点身份、半字符、旧响应丢弃及关闭不捕获；[正式组件回放](../../scripts/verify-remote-plugin-slots.mjs)从原工具投影恢复窗口，验证二次捕获/重挂载、全屏/流/模式/游标和关闭后不再弹出。首次夹具误把投影nodes当Map迭代、随后未等待异步投影，修正夹具后通过；不计生产问题或端到端证据。Web构建、Android assembleDebug/lintDebug通过，新版APK已安装。真实[MuMu中继重启](../../scripts/verify-foreground-reconnect-android.mjs)保留首段65536字节和全屏/历史选择，网关52088→65676后手动续读至100058字节，解码全文逐字一致，无重复/乱码，页面错误为空。报告`foreground-reconnect-observe-android.json`；首次run因忽略编码头导致预期总数少3字节而超时，改按Host原始游标并核对全文，只observe原命令未重发。23:01:01 UTC cleanup报告确认归档并回原聊天。核心模块更新导致整个RemoteApp重新装配的真实触发、滚动像素位置及在途撤销仍待实测；中继重启成功不替代这些分支。

源码8文件/编译5包11文件增量和安装/恢复器已生成；两个工具新增scope工作区依赖，由安装器核验并只恢复自己创建的链接。核心14项、安装副本7项、插件89项、手机223项、后端定向7项检查，以及Web/Android构建、lint和严格类型检查通过。原工具到Host测试使用真实执行器/会话身份但进程provider为替身；HTTP/WS测试走真实鉴权网络和PGlite。现场补丁、插件0.1.32、网关及App已配套更新并重新启动；[实际脚本](../../scripts/verify-foreground-output-android.mjs)22:40:26 UTC通过：35秒等待期间已显示BEGIN/中文且执行中，stderr、完成END、从头历史、复制反馈、原结果退出码7、全屏无横向溢出及重入成功。报告`foreground-command-run-android.json`页面错误为空；22:44:18 UTC cleanup确认测试聊天归档并回原聊天。颜色探针为null、截图未见红色，不计ANSI通过；DSH默认 `NO_COLOR=1` 不变。首次停止脚本因参数引号匹配失败却继续安装，随后已停止旧进程、核验全部文件和依赖后重启；后续安装须检查前置退出码。上游参考保持只读。

- 状态：工具记录接入及真实前台 pwsh 状态更新通过；完整 R12 尚未完成。来源：[数据适配](../../src/remote-commands.mjs)、[手机窗口](../../src/ui/RemoteCommand.jsx)、[真实检查](../../scripts/verify-commands.mjs)、[数据测试](../../tests/remote-commands.test.mjs)。
- 沿用原 [terminalCardModel](../../../deepseek-harness/packages/client/ui-tool/src/client/tool/models/terminal-card-model.ts) 与 [TerminalBlock](../../../deepseek-harness/packages/client/ui-primitives/src/TerminalBlock.tsx)，不加载整个电脑 UI。窗口保存会话、节点、callId 坐标，随当前投影取最新记录；支持根调用和 PTC 子调用，切换会话关闭，Android 返回先关窗口。
- 标准 shell 的非零退出/终止信号显示失败，修正原通用工具行仅看 `isError` 导致的误报成功。后台回执、持久 shell、spill 预览和工具错误保留原始结果，不能据此推断进程成功退出。目录只在原解析器可确定时展示，原输出不重编码或臆测修复。
- 原版源码核验：[pwsh 前台执行](../../../deepseek-harness/packages/shell/tool-pwsh/src/index.ts)等待 `shell.run` 完成后返回结果，没有增量事件；上方兼容补丁已补齐独立读取。另一个 [terminal/follow](../../../deepseek-harness/packages/api/terminal-controller/src/index.ts)会取得交互输入控制权，未为只读窗口放行。
- 实测使用 DSH-TEST 的“DSHM Remote 联调提示”，执行固定打印、等待 12 秒、退出 7 的只读命令。观察到执行中→失败，最终 13.6 秒/退出码 7、完整命令、目录、全屏、Android 返回和历史重开通过。最终记录为 `artifacts/remote-mobile-commands-resume-android.json`，截图 `artifacts/remote-command-android.png`；页面错误与资源错误均为空。恢复检查不重复发送消息。
- 两次颜色探测未通过：电脑返回的输出没有保留 ANSI 色码，受限 PowerShell 的部分 stderr 已乱码；手机保留原数据，报告 `color: null`。不能宣称真实颜色验收通过。运行中观察早于最终覆盖安装；最终包验证历史重开及上述窗口操作，仍需补齐其他执行类型和增量输出。
- MuMu 发现浏览器剪贴板写入不成功，已增加 [Remote 原生桥](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)固定 `clipboard.write`，仅本地主框架来源可写，最多 40,000 个字符、无读取入口。所有共用原复制控件通过 [宿主适配](../../src/ordinary-clipboard.mjs)使用同一个 RemoteClient；不新建竞争桥回调、不使用普通聊天 Key 或桥，宿主卸载解除注册。原生返回成功后才显示已复制，拒绝路径和旧宿主清理有[测试](../../tests/remote-clipboard.test.mjs)。超过上限不复制，不截断为成功。
- 手机 Node **115 项**通过，Web 构建、Android assembleDebug/lintDebug 通过，覆盖安装保留 Key、历史和绑定。上游检出、网关、插件及现有会话权限未修改。本节不替代 R01–R16 完整验收。

## 文件差异（2026-09-24）

- 状态：单次工具修改与整轮差异已接入并在 MuMu 实测，完整 R01–R16 未完成。来源：[手机读取](../../src/remote-changes.mjs)、[窗口](../../src/ui/RemoteDiff.jsx)、[Host 固定路由](../../../plugin/src/changes-preview.ts)、[真实验收](../../scripts/verify-changes.mjs)。
- 复用原 `diffCardModel` 与 `DiffBlock` 展示工具预期/结果修改，错误结果不伪造成功差异；整轮入口复用原 `deliverablesDefinition` 的轮次归属和最新公告，以 DSHM 自有节点展示。单次修改、整轮开始/结束记录和电脑最新文件分开；文件选择、全屏、增删行与原行号计算已接入，下载/分享继续读取当前完整文件。
- 插件 **0.1.12** 和网关新增固定 `remote.changes`，仅接受 sessionId/seq/index；原认证内 GET summary/diff，不接任意路径、快照 ID 或 HTTP 参数。32 MiB JSON、64 KiB/4 块窗、Host 并发 2 个；手机最终成功后才发布，关闭或会话销毁取消，60 秒总时限。网关不聚合完整结果，但原路由和手机 JSON 解析仍占用内存。
- MuMu 从「DSHM Remote 联调提示」发送独立两文件 read/edit，真实磁盘替换成功；手机工具差异与第 36 轮记录均显示 BEFORE/AFTER，文件选择和全屏通过。随后将第一份文件改成第三版，历史保持旧差异而“最新完整文件”显示第三版；删除第二份文件后，整轮记录仍可读，当前读取准确报错且没有残留历史内容。错误及失败资源均为空，已查看截图；最终构建报告 `artifacts/remote-mobile-changes-resume-android.json`。
- 实际重启 DSH 并重开 App 后，整轮服务返回记录缺失，手机显示“电脑已不再保留这轮改动记录”；持久工具日志中的单次差异仍可查看，报告 `artifacts/remote-mobile-changes-expired-android.json`。原 DSH 只在 Session 服务存续时保留整轮快照，不能用最新文件补造历史。覆盖安装保留普通聊天 Key、历史和原绑定。
- 验收脚本 `--changes` 仅在 `DSHM_RUN_LIVE=1` 下创建独立样例并发送一次，`--changes-resume` 只继续检查已记录样例，不重发；`--changes-expired` 在实际重启电脑服务后验证丢失语义。首次定位脚本错误地用默认只匹配可见元素的 role 查询折叠卡片，已改为先匹配对应文件再展开；不是重复发送模型消息解决。
- 手机 **111**、插件 **46**、后端 **30** 项测试通过，独立 PostgreSQL 默认跳过 1 项；类型检查、Web/Android 构建及 lint 通过。测试覆盖原会话实时投影与跨轮/跨会话归属、中文分片/迟到失败、原 HTTP 路由、背压/取消/容量，以及真实 WebSocket 的异连接 ACK 拒绝和撤销。二进制/超大差异提示已实现但未逐项用真实模型验收；命令详情、完整 localhost 预览、插件局部 UI 及其余完整矩阵继续实施。

## 已核验的接入边界

旧实现曾选择整套客户端载体复用，该页面方案现已被用户否定。重构保留 Connection/Gateway 等已验证业务通道，手机拥有页面与共享聊天组件；仅复用会话投影和必要的局部扩展，不挂载电脑顶层 renderer。

1. [ClientTransportHooks](../../../deepseek-harness/packages/client/connection/src/client/index.ts)允许注入 rpc/fetch/openStream/loadBundle；Remote 不得伪造 `ownsHost`。
2. [Host Connection](../../../deepseek-harness/packages/client/connection/src/rpc-host.ts)的 `createSharedFetchHandler('/api')`可以接收已认证请求，包含本地管理路由，**不能无条件代理**。
3. [Gateway](../../../deepseek-harness/packages/api/gateway/src/index.ts)原 `wireStream.open`支持业务流及 `$events`；`$events/result`沿用原审批竞争，新增公网设备/连接归属校验。
4. [ClientModuleRegistry](../../../deepseek-harness/packages/client/modules/src/index.ts)提供真实 `graph`、`onGraphChanged`、`fetchBundle`，无需修改上游。原 bundle 服务只接受广告过的 revision URL。
5. [Session create](../../../deepseek-harness/packages/api/session-controller/src/commands.ts)原本允许 cwd；手机额外限制必须使用已有 workspaceId。
6. [Terminal](../../../deepseek-harness/packages/api/terminal-controller/src/index.ts)的原 follow 会接管输入附件；不能简单把完整终端客户端搬过来声称只读。

## 当前代码

- [文件读取](../../src/remote-files.mjs)复用原 `workspaceFiles/stat`、`readBytes`，共享策略要求显式字节范围且每次不超过 64 KiB；[文件窗口](../../src/ui/RemoteFilePreview.jsx)由 DSHM 提供，普通 Markdown 委托与原工具路径模型负责入口；原 ImageBody 负责图片显示，[下载](../../src/remote-download.mjs)负责最新完整文件保存。`readAll`/任意 Host HTTP 未放开。
- [手机会话模型](../../src/remote-model.mjs)复用上游 ClientSessions、UiConversation 与工作区投影；[手机页面](../../src/ui/RemoteWorkspace.jsx)使用[共享消息](../../src/ui/ChatMessage.jsx)和[共享输入框](../../src/ui/MobileComposer.jsx)，普通聊天生产入口也直接使用这两套组件。
- [RemoteMessage](../../src/ui/RemoteMessage.jsx)、[RemoteInteraction](../../src/ui/RemoteInteraction.jsx)、[RemoteQueue](../../src/ui/RemoteQueue.jsx)分别负责记录展示、原审批/提问、权威队列；附件绑定原会话，取消后忽略迟到 receipt，未知发送结果不自动重放。
- 旧 [remote-runtime.jsx](../../src/remote-runtime.jsx)已无生产入口引用，保留为此前通道验证参考；不能再将它作为正式 UI 启动路径。
- [共享策略](../../../backend/packages/protocol/src/remote-policy.ts)：仅放行已审阅入口；未知接口、工作区创建、终端命令、本地 `/api/dsh-mobile` 不通行。插件管理需要额外授权，敏感设置尚未开放。
- [共享协议](../../../backend/packages/protocol/src/index.ts)：保留旧 protocol 1 六方法，新增 transport 2 协商、原 RPC/流与图接口。设备不能提交 Host 信封身份字段。
- [网关](../../../backend/packages/gateway/src/hub.ts)：从鉴权设备生成 hostId/deviceId/connectionId/management；旧 Host 返回升级提示；更改权限会作废 ticket、关闭连接并取消订阅。
- [设备存储](../../../backend/packages/gateway/src/store.ts)：幂等迁移 management=false，旧批准设备不自动升级权限；仅对应 Host 可改变活跃设备权限。
- [电脑适配](../../../plugin/src/remote-adapter.ts)：调用原 DSH Connection/Gateway；同一事件流的结果只能由同一设备、同一连接提交；图订阅退出释放监听。
- [桌面配置页](../../../plugin/src/client/index.tsx)：批准访问后另行确认管理权限，也可单独收回。

### 此前通道实现记录（旧界面，不计为新版 UI 验收）

用户已明确授权完整接入验证；桌面已核对「DSHM Remote 完整接入验证」并批准访问、授予管理权限，测试结束后已撤销该设备，其他设备未变更。插件已通过官方 CLI 升级至 0.1.6，网关为 transport 2，Android 已保留数据覆盖安装。旧载体曾加载真实电脑模块图和原 DSH 会话页面，在 DSH-TEST 新建会话并收到 DSHM_FULL_REMOTE_READY；内置浏览器确认电脑同步显示该回复。

- [Android 资源入口](../../android/app/src/main/java/dev/dshmobile/validation/RemoteResources.kt)：仅同一隔离来源 `/plugins/`，GET/HEAD、最多四个并发、64 KiB 分片、四块窗口、消费确认、断开取消；尚无文件上传/Range。
- [原客户端载体](../../src/remote-transport.mjs)与[运行环境](../../src/remote-runtime.jsx)：原平台单例 + 电脑实际模块图，`ownsHost:false`；每代独立 Cordis 树，清单跟随原 entries.sync，断线清除协商并释放树。
- [Remote 页面](../../src/RemoteApp.jsx)已替换旧 JSON 协议显示入口，配对页使用确认过的样式。加载后的移动布局尚待适配，当前不能视为 UI 全部交付。
- 原 Cordis Loader 1.0.3 在初始化时创建配置表达式 `Function`，因此 Remote CSP 允许 `unsafe-eval`；脚本/网络仍限定隔离来源，原生层拒绝其他 URL。此设置不允许读取普通聊天桥或 Key，也不替代网关逐接口授权。

当前证据：后端 24 项（默认 PostgreSQL 项跳过）、插件 32 项（含真实 Connection/Gateway fixture、目录读取不授予指令执行）、手机完整 Node 回归 70 项通过；Web 构建、Android 构建/lint 通过。真实 PostgreSQL 1 项在前一批通道改动后通过，本次未改数据库结构。MuMu 已验证实际插件图、新聊天、实时回复及 ask_user_question 的选择/提交，收到 DSHM_QUESTION_OK。随后验证了单次文件审批与实际上传；它们仍不等于完整 Remote 通过。

手机项目完整 Node 回归包含传输、上传以及旧 WebView 平台兼容；设计预览测试只证明预览自身行为，不计入真实 Remote 功能完成。

源代码增加了 [上传载体](../../src/remote-upload.mjs)和 [Host 有界请求体](../../../plugin/src/upload-body.ts)，通过原 `__DSH_FILE_UPLOAD__` hook 与固定 Connection 上传路由接入；不聚合完整文件、不转发任意 POST。分片 64 KiB、窗口 4、上限 256 MiB；原附件校验与 receipt 不变。真实 HTTP/WebSocket/SQL 测试已覆盖同设备不同连接不能注入上传、撤销管理权限取消在途上传。该版本已安装到网关、桌面插件和 MuMu；[系统选择器](../../android/app/src/main/java/dev/dshmobile/validation/RemoteFileChooser.kt)已接入原 file input，选择结果限定当前连接代次与系统 content URI，实际上传入口仍在验收。

Worker 源码核验：原 PDF 预览使用 [Blob module Worker](../../../deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/pdf/runtime.ts)，字体/CMap/WASM 由[同版本构建资源](../../../deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/pdf/assets.ts)内联；无需另建 PDF 资源下载代理，但 Worker 真正启动、断开销毁和各格式预览仍待测试。

MuMu 原生 `OrdinarySecurityInstrumentation` 已通过新增的 [Remote 资源测试](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteResourceChecks.kt)：隔离来源与 HTTP 方法、四块分片内容、消费确认、收到结束帧后仍未读缓存的断开失效、主动关闭后不可再读、缺失头帧拒绝。测试只使用独立字节与凭据样例，不连接电脑、不读取用户 Key；它不能替代真实网关撤销与完整插件加载验收。Web 与 APK 已重新构建并覆盖安装，绑定和普通聊天数据保留。

## 新版自有页面实际验证（2026-09-24）

当前 MuMu 沿用用户现有的「DSHM Android」已批准绑定（仅聊天与任务权限），没有新增权限，没有恢复已撤销身份，也没有撤销其他设备。实际运行的是 APK 本地 `remote.html`，页面直接渲染工作区/会话；未挂载整个电脑 renderer。

- 真实历史及续聊：在「DSHM Remote 联调提示」读到原历史，发送并收到 `DSHM_SHARED_CHAT_OK_20260924`。内置浏览器确认电脑同一会话也显示这一轮。
- 文本附件：新页面系统选择器选取独立 85 B 测试文件，显示上传完成；模型读出提示词未包含的 `DSHM_SHARED_UPLOAD_OK_20260924`。发送后待发附件清空，历史显示文件名与大小，电脑同样可见。
- 提问：电脑真实 ask_user_question 事件进入手机自己的卡片，选择并提交后生成 `DSHM_SHARED_QUESTION_OK_20260924`，电脑同步可见。
- 队列：等待提问时加入两条消息，修改第一条、取消第二条；回答问题后只执行修改后的消息并返回 `DSHM_SHARED_QUEUE_OK_20260924`。被取消内容没有进入聊天历史。
- 会话管理：仅在 DSH-TEST 新建测试会话并发送固定无工具消息，重命名、归档、恢复，再创建带原历史的分支均通过；最终完整跑通的两个测试会话已归档。早期测试脚本曾在异步创建/分支未完成时提前读取 DOM，已改为等待页面完成；这些脚本失败不计为功能通过证据。
- 覆盖安装保留 Key、历史和现有绑定；新页面重开连接与历史读取通过。本批没有更改电脑插件、网关或上游基线。
- 图形核对：WebView 调试截图曾漏画返回/附件等 SVG，但 DOM 尺寸与颜色正常；Android `screencap` 对照确认实际屏幕图标完整（本机 `artifacts/remote-mobile-native.png`）。此差异不应直接当作 CSS 回归修改。

验证入口：[新版 Android 联调脚本](../../scripts/verify-remote-mobile-android.mjs)。默认只读；`--send`、`--upload`、`--question`、`--queue`、`--manage` 需要 `DSHM_RUN_LIVE=1`，仅用于专用测试会话。模型层测试包含会话附件归属、取消/迟到结果、未知结果不重传、队列旧条目拒绝、原服务改名归档；这些夹具不是实机证据。本批手机 Node 全量 77 项通过，Web 构建、Android debug 构建与 lint 通过；文档检查 61 份 Markdown / 710 个本地链接通过。

下一步仍需完成：插件局部宿主及缩放 API/用户设置、其他格式资源预览和分享、子会话/高级任务/预设/设置、新版审批竞争与全部撤销路径、原生通知/链接入口和其余矩阵验收。不要将本批基本聊天打通视为整体完成。

## 新版文件预览接入（2026-09-24）

- 当前本地安装：电脑插件 **0.1.7**、更新后的 transport 2 网关、包含文件窗口的 Android APK；DSH/网关已重启加载，原绑定保留。本次未更改认证或增加管理授权。
- 源码依据：[WorkspaceFiles](../../../deepseek-harness/packages/api/workspace-files/src/index.ts)与[返回类型](../../../deepseek-harness/packages/api/workspace-files/src/types.ts)。实际安装的生成声明确认参数为 `workspaceFileScopeId`、`path`、`range`。原服务以会话工作区作为相对路径基准，文件读取遵循 composed fs 的读取权限，**并非一律禁止工作区外文件**；手机不伪造更窄或更宽的 Host 权限。
- 比较过直接 `readAll` 和字节窗：前者可能产生超过转发帧上限的大 JSON；当前选择原 `readBytes`，网关和插件都限制 64 KiB/请求，客户端拉取下一块形成背压。保持 Host 返回的版本、路径和大小校验；最后再 stat，变化即报错，不发布混合版本结果。
- MuMu 从专用会话的真实工具按钮读取 `dshm-approval-test-20260923.txt`，内容与电脑磁盘一致；从模型回复的 Markdown 链接读取独立测试文件，验证跨块中文和末尾换行、文件修改后刷新为新版、删除后错误且不残留旧文本，以及 Markdown 阅读/源码切换。测试文件只位于手机项目 `artifacts/`，未读取用户私有文件。脚本 `--file` 为只读，`--file-rich` 需 `DSHM_RUN_LIVE=1` 并向专用会话发送测试链接。
- 手机 Node 83 项、插件 33 项、后端 25 项通过（默认 PostgreSQL 独立测试跳过）；Web/后端/插件构建、类型检查、Android assembleDebug/lintDebug 通过。读取模型覆盖跨分片解码、版本变化、非法窗口、二进制/过大预览、权限错误和取消迟到结果；这些夹具不替代上述真实入口证据。
- 当前文本全文预览限制 2 MiB；代码文件显示源码，Markdown 可切换阅读。完整下载的后续结果见下节；分享、PDF/HTML/Office、附件卡片、文件差异及远端 localhost 预览尚未完成，不将文本预览等同于整个 R10–R12/R16 完成。插件局部宿主与其余 R01–R16 缺口保持原范围。

## 最新完整下载（2026-09-24）

- [下载流程](../../src/remote-download.mjs)每次重新读取 Host 最新文件，按 64 KiB 顺序交给 [Android 暂存](../../android/app/src/main/java/dev/dshmobile/validation/RemoteDownloadStore.kt)。每块确认、最终版本校验完成后，才由 [系统保存窗口](../../android/app/src/main/java/dev/dshmobile/validation/RemoteDownloads.kt)选择输出位置。与在网页聚合整份 Blob 相比，私有磁盘暂存降低大文件内存占用，也避免半成品提前保存。网页不能提交手机路径或目标 URI；每代连接只暂存一个文件，上限 256 MiB，文本预览的 2 MiB 上限不影响完整下载。
- MuMu 实测：先打开旧文字预览，再把电脑文件改成 3,145,747 字节二进制；通过真实文件窗口下载，手机保存结果 SHA-256 为 `81dd406c2b854c9afb5f427467296ef65befa14ada9dd5bbc2b634e044d5abaa`，与电脑最新版一致。系统保存取消和传输取消均正确提示，私有暂存为空。
- 将独立样例改成 32 MiB，在已传出数据后停止当场核对过的本机网关：手机连接关闭、预览卸载、暂存清空。测试恢复同一网关入口后重新连接成功，没有自动恢复下载或重发消息。首次重连仍可能遇到 `remote_operation_failed`（强制断网后的 HTTP 失败），再次点击成功；测试记录保留第一次失败，不宣称一次点击必定恢复。
- 复现：[新版联调脚本](../../scripts/verify-remote-mobile-android.mjs) `--download`；追加 `--download-offline` 必须传入当场核对的 `DSHM_VERIFIED_GATEWAY_PID`，只停止自有测试网关并在 finally 恢复。证据：本地 `artifacts/remote-mobile-download-android.json`，2026-09-24，包含取消/断线/重连与校验和。测试操作仅限专用会话和独立测试文件，不清理既有绑定。
- [下载单元检查](../../tests/remote-download.test.mjs)覆盖最终版本变化不保存、原生字节确认错误、取消和空文件；[原生检查](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteDownloadChecks.kt)覆盖名称、顺序、连接代次、旧 ID 隔离和遗留暂存清理。原生 instrumentation 已在 MuMu 通过，不能代替所有格式预览、分享、撤销竞争和进程被杀的完整实测。

## 图片和全屏（2026-09-24）

- 直接复用 [ImageBody](../../../deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/image/ImageBody.tsx)及原类型映射，支持 PNG/JPEG/GIF/WebP/BMP/ICO/SVG；当前实际 MuMu 覆盖 PNG 与 SVG，其他格式尚未逐一验收。图片从原有会话文件服务分块读取并完成版本校验，内存预览上限 16 MiB；超过上限仍可完整下载。SVG 只作为 img Blob 显示，不注入页面 HTML。图片关闭/刷新按原组件生命周期撤销 Blob URL。
- 正式文件窗口与设计预览复用 [FullscreenIcon](../../src/ui/FullscreenIcon.jsx)，支持底部窗口/全屏切换。MuMu 实测全屏宽高等于当前视窗、缩小恢复、PNG/SVG 自然尺寸正确、损坏图片错误且无旧图、关闭后旧 Blob 不可读取；测试 SVG 的脚本未执行。已查看全屏截图，图像与按钮正常。
- 原图片组件没有默认 React 导入；手机此前 classic JSX 转换导致 ReferenceError 和空白，现由 [构建脚本](../../scripts/build-web.mjs)统一 `jsx: automatic`，未修改上游。重新覆盖安装后实际入口通过；普通聊天/主题/插件诊断的 Web 回归也通过，此诊断不代表重新调用真实模型。
- 复现：[新版 Android 联调](../../scripts/verify-remote-mobile-android.mjs) `--image`，只发送专用会话的独立测试文件链接。证据为本地 `artifacts/remote-mobile-image-android.json` 和 `artifacts/remote-image-fullscreen-android.png`。手机 Node **88 项**、Web 构建、Android assembleDebug/lintDebug 通过。本批未修改后端/插件生产代码，也未扩大设备权限。

## 手机系统分享（2026-09-24）

- 从自有[文件窗口](../../src/ui/RemoteFilePreview.jsx)点击「分享完整文件」，复用 [remote-download.mjs](../../src/remote-download.mjs) 的版本核验、64 KiB 分块、原生确认和 256 MiB 单文件上限。与先保存公共文件再分享相比，私有快照无需额外存储权限，系统只向用户选择的接收 App 提供单文件只读 URI。
- [RemoteDownloads](../../android/app/src/main/java/dev/dshmobile/validation/RemoteDownloads.kt) 只接受下载 ID，不接受网页 URI 或手机路径。完成读取后由 [RemoteShareFiles](../../android/app/src/main/java/dev/dshmobile/validation/RemoteShareFiles.kt) 生成独立快照，复制中检查取消/连接代次，系统面板启动前再次检查原下载仍有效。仅返回 `opened:true`；没有“已发送”的假确认，已确认交付后的迟到取消也不覆盖已发生的操作。
- [Provider](../../android/app/src/main/java/dev/dshmobile/validation/RemoteFileProvider.kt) 非导出，路径配置仅覆盖 `cache/remote-shares/`，不含下载中的 `.part`、Key、历史或凭据。Intent 仅授予临时读权限，ClipData 与 EXTRA_STREAM 指向同一 URI。接口依据：[Android 文件分享](https://developer.android.com/training/secure-file-sharing/share-file)与 [FileProvider](https://developer.android.com/reference/androidx/core/content/FileProvider)。
- 独立副本最多 8 个、总计 512 MiB；新打开读取限 1 小时，Provider 本身检查文件时间，进程重启后也不能重新读取过期副本。进程仍在时延迟清理，或下次 Remote 初始化/分享时清理过期文件。限额不足明确报错，不提前删除其他仍有效分享。已经打开的句柄、接收 App 保存或转发的副本无法撤回；Remote 断线不会冒充撤回已交付文件。
- MuMu 实际从专用聊天打开旧文本预览，随后将电脑样例改为 **3,145,747 字节**二进制，再从同一窗口分享。独立 `androidTest` 接收 App（不同 UID）收到 SHA-256 `81dd406c2b854c9afb5f427467296ef65befa14ada9dd5bbc2b634e044d5abaa`，与电脑最新完整文件一致；写入和其他 URI 读取被系统拒绝。系统面板取消没有显示已发送，32 MiB 准备过程中取消清空下载暂存。未向任何第三方联系人或服务发送内容。
- 复现：[Android 联调](../../scripts/verify-remote-mobile-android.mjs) `--share`，需先安装 `assembleDebugAndroidTest` 的独立测试 APK，接收器 [RemoteShareReceiver.java](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteShareReceiver.java) 不进入正式 APK。初版接收器因独立 APK 缺少 Kotlin runtime 崩溃；改为仅依赖 Android 的 Java 接收器后，真实跨 UID 测试通过，未将同 UID 自读当作跨 App 权限证据。
- [原生检查](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteShareChecks.kt)已在 MuMu 覆盖未完成拒绝、准备取消、完整内容、MIME、只读 Intent、Provider 路径限制、容量和过期读取拒绝；[Node 检查](../../tests/remote-download.test.mjs)覆盖分享最终版本失败、取消、不确认发送及迟到取消。手机 Node **91 项**与 Web/Android 构建、lint 通过。完整 R10–R12/R16 仍有 HTML/Office、附件卡片、文件差异、命令、远端预览和在电脑打开缺口，不以本批分享通过关闭任务。
- 最终安装包的 `--share --download` 回归通过，证据为本地 `artifacts/remote-mobile-share-android.json`（2026-09-24 01:48 香港时间），包含分享和下载的字节/校验和、系统取消与准备取消结果。MuMu 不允许 shell 改组件启停状态；验收后已通过 `adb uninstall dev.dshmobile.validation.test` 移除独立测试 APK，避免常规分享面板出现验收入口。**没有卸载 DSHM 主 App**，原绑定、Key 和历史保留；复测需重新安装测试 APK。

## PDF 局部预览（2026-09-24）

- [RemotePdfPreview](../../src/ui/RemotePdfPreview.jsx)直接承接上游 LazyPdfBody/PdfBody 的局部渲染、文字层、按页请求及取消生命周期，只提供手机文件窗口需要的 store/tab 接口，不挂载电脑侧边栏。通过既有 Host 字节窗读取并校验整份文件，内存上限 32 MiB；更大文件仍可走完整下载。
- [构建资源](../../scripts/pdf-assets.mjs)固定 PDF.js **6.3.289**，与上游一致，选择同版本 legacy 引擎/Worker/viewer；字体、CMap、WASM 随 APK 内置，没有外部 CDN。独立 Worker 需自行安装 Promise.withResolvers 与 core-js **3.50.0** 的 ArrayBuffer.transferToFixedLength；只补缺失方法，不用主线程假 Worker 替代失败。
- 实际旧 WebView 110 先后出现 `Promise.withResolvers is not a function` 与 `transferToFixedLength is not a function`。后者发生在字体构建，导致画布不完整和渲染等待。Android 原场景补齐后通过；[兼容回归](../../tests/pdf-platform.test.mjs)验证截断、扩展补零、转移后原缓冲区失效和非法长度，不以简单复制冒充 transfer。
- MuMu Android 12 从专用聊天的真实文件链接打开独立两页 PDF：两页中心像素分别为红/蓝，文字选择结果为 `Selectable PDF text`，选区有实际尺寸且位于页面内；全屏截图已人工核对。实际 Worker 数量为 1，关闭为 0；损坏文件和 Worker 启动失败均显示错误且不残留画布。脚本 [verify-remote-mobile-android.mjs](../../scripts/verify-remote-mobile-android.mjs) `--pdf`，证据 `artifacts/remote-mobile-pdf-android.json`（2026-09-24 01:32 香港时间）、`artifacts/remote-pdf-android.png`。这不代表加密文档、超大页或任意 PDF 都已逐项验收。
- 图片回归同时修正旧测试：CSP 本来就禁止 fetch Blob，不能用 fetch 失败证明已释放。现在通过 img 通道确认关闭后的 URL 无法加载；真实 PNG/SVG、损坏图片和全屏回归通过。
- [构建脚本](../../scripts/build-web.mjs)仅在 PDF 模块注入大型资源对象，并校验普通聊天/Remote 的初始静态 JS 依赖不含 PDF 引擎或资源；清理自有生成目录中失效的旧分块。相较全局 define，可避免资源进入首页共享块。许可证随 `PDFJS-LICENSES.txt` 进入 APK。当前 debug APK **14,371,807 B（约 13.7 MiB）**；增加 PDF 的包体开销仍存在，不能把按需加载描述成减少安装体积。
- 手机 Node **89 项**、Web 构建、Web 主题/插件/普通聊天诊断回归、Android assembleDebug/lintDebug 通过。本批未改后端/插件权限，保留既有绑定和普通聊天数据。HTML/Office、分享、附件卡片及其他 R01–R16 缺口保持原范围；完整 Remote 尚未完成。
- 最终覆盖安装后，Remote 自动恢复既有会话，23 条模型回复与单一共享输入框可见，页面/资源错误为空。第一次回归在末尾截图阶段超时；未重启服务或修改代码，重跑同一只读脚本通过。该偶发截图问题保留为测试环境现象，未据此宣称存在或修复了产品连接故障。

## HTML 局部预览（2026-09-24）

- [RemoteHtmlPreview](../../src/ui/RemoteHtmlPreview.jsx)复用上游 [packHtml](../../../deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/html/pack.ts) 与 [createHtmlDocument](../../../deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/html/bootstrap.ts)，只挂载文件窗口内的文档，不挂载电脑页面。主页面读取原会话的文件，依赖地址以 Host 返回的绝对文档目录解析，最后仍由 Host 规范化和校验读取权限；不把文件读取回调交给文档脚本。收集依赖后再核对主文档版本，防止旧目录/新正文混用。
- 比较了直接 Blob iframe 与独立来源响应：Blob 继承主页面 CSP，会迫使聊天页放宽 inline script；选择 [RemoteHtmlResources](../../android/app/src/main/java/dev/dshmobile/validation/RemoteHtmlResources.kt) 登记独立 `preview.dshm.invalid` 文档。仅接受同连接代次的完整字节、GET 子框架请求；iframe 和响应 CSP 双重 sandbox，实际来源 null，无两种原生桥。文档可运行自身脚本、Blob 脚本和样式，但不能请求网络、访问父页面/存储、打开子框架或调用手机文件选择器。主页面 CSP 仅新增该 frame 来源，不放宽主页面脚本执行策略。
- 原生文档暂存按 64 KiB 交付并确认，编码后的 bootstrap 上限 64 MiB；原 HTML 与依赖合计 32 MiB，最多 64 个依赖，每个 4 MiB。关闭、断线、连接代次变更或销毁后清理私有缓存和在途读取，旧 URL 不再有效。桥及原生边界沿用原 Remote 主框架来源检查，没有修改网关/插件 RPC 白名单。
- MuMu Android 12 / WebView 110 从专用真实会话的 Markdown 文件按钮验证：直接本地 JS/CSS 加载、按钮计数、全屏、电脑修改后重读最新版、CSS 删除报错且不显示旧文档。实际检查文档 origin=null、普通/Remote 桥 undefined、父 DOM/存储/fetch 被拒绝、file input 不弹系统选择器；关闭后旧 URL 403、缓存为空。报告 `artifacts/remote-mobile-html-android.json`，截图 `artifacts/remote-html-android.png` 已视觉检查；报告中的一条 403 是主动读取已关闭文档的预期结果，页面错误数组为空。
- [Node 测试](../../tests/remote-html.test.mjs)覆盖依赖路径、Unicode 分片、取消和错误来源；[文件测试](../../tests/remote-files.test.mjs)覆盖文档正文前及依赖收集后的版本替换。[原生检查](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteHtmlChecks.kt)在 MuMu 验证主框架/非 GET 拒绝、CSP、字节、关闭、代次和旧 ID 隔离。当前手机 Node **94 项**、Web 构建、Android assembleDebug/assembleDebugAndroidTest/lintDebug 通过；覆盖安装保留绑定、Key 和历史。
- 支持范围与上游打包器一致：HTML 内直接声明的本地经典 `.js`/`.css` 与内嵌资源；不遍历模块图、CSS url/import、独立图片依赖或运行时 fetch，外部网络不开放。这是静态文档局部预览，不能作为完整 localhost 应用预览的验收。Office 后续接入结果见下节；附件卡片、文件差异、命令详情、远端应用和其他 R01–R16 缺口继续保留。

## Office 局部预览（2026-09-24）

- [Host 适配](../../../plugin/src/office-preview.ts)仅调用已核验的原 `officeToPdf/render`、`generation`，保留原会话文件权限、缓存和电脑转换队列。选择固定分片通道，避免开放返回整份 PDF 的通用 RPC，也不把 Office 转换引擎放入 APK。上游依据：[转换服务](../../../deepseek-harness/packages/document/office-to-pdf/src/index.ts)。
- [共享协议](../../../backend/packages/protocol/src/index.ts)增加 `remote.office`，插件 0.1.8 协商 `office` 通道。结果 32 MiB 上限、64 KiB / 4 块窗口、电脑并发 2 个，网关 ACK 绑定原连接；其他连接（包括同设备的另一连接）不能补额度。转换期间先发状态，手机最长等待 180 秒。源文件/权限/转换服务代次在结束前再查，失败不发布已收 PDF。
- [手机读取](../../src/remote-office.mjs)与[文件窗口](../../src/ui/RemoteFilePreview.jsx)共用现有 PDF 渲染器，提供缺失字体提示、全屏和取消。下载/分享沿用原路径的最新完整文件，不将 PDF 当作原 Office 文件交付。
- `node scripts/verify-remote-mobile-android.mjs --office` 已在 MuMu Android 12 / WebView 110 的正式 Remote 入口通过：doc/docx、xls/xlsx、ppt/pptx 均显示真实转换画布与中英文文字层；全屏正常，关闭后 Worker 数归零；docx/pptx 显示刻意缺失的字体名。损坏 docx 和删除文件均报错，不显示旧 PDF。
- 报告 `artifacts/remote-mobile-office-android.json`（2026-09-23 18:20:52 UTC），截图 `artifacts/remote-office-{格式}-android.png`；六格式来自只读上游官方简单样例，[构建工具](../../scripts/office-fixture.mjs)仅在显式 `--office` 验证时使用开发依赖 fflate。不宣称复杂排版或所有字体均可忠实还原。
- 插件已通过电脑本地安装页升级 0.1.8，DSH 编译入口与网关均重启，App 覆盖安装后完成上述实测；未清除 Key、历史或既有绑定。Web/Android 构建与 lint 已通过；手机 96 项、插件 35 项测试通过。默认后端 PostgreSQL 独立用例跳过，既有真实数据库证据不作为本轮重跑结果。
- [Host 测试](../../../plugin/tests/office-preview.test.ts)覆盖背压、取消、源变更、最终权限失败和无效结果；[手机测试](../../tests/remote-office.test.mjs)覆盖顺序/长度校验、取消和迟到失败；[网关测试](../../../backend/tests/remote-permissions.test.ts)覆盖真实 HTTP/票据/WebSocket 的 Office 流归属及撤销，[协议检查](../../../backend/tests/remote-file-policy.test.ts)确认不能绕过固定通道访问整份转换 JSON。
- R10–R12/R16 仍有其他图片格式实测、附件卡片、文件差异、命令详情、远端应用预览与在电脑打开等缺口；完整目标保持进行中。

### 附件原始内容与卡片（2026-09-24）

- 插件 0.1.9 的 [attachment-preview.ts](../../../plugin/src/attachment-preview.ts)增加固定 `remote.attachment` 流。普通文件在原 SessionController.inspect 的日志内容位置中核验引用，再用 AttachmentStore.readFileStream 读取；图片沿用原 session/attachment 的引用授权及 provider 完整性检查。[FileAttachmentRef / ImageAttachmentRef](../../../deepseek-harness/packages/attachment/attachment/src/types.ts)的 ID 不解释为磁盘路径，显示名不能绕过会话引用。
- 单文件 256 MiB、图片 16 MiB、Host 最多并发 4 个；64 KiB / 4 块窗口，网关 ACK 绑定原连接。文件 provider 在最后一块之后仍可能报告哈希失败，因此手机必须等待成功 end 后才发布预览或交付保存。手机总超时 180 秒，取消、断线、撤销清理请求。
- [RemoteFiles 卡片](../../src/ui/RemoteMessage.jsx)、[队列](../../src/ui/RemoteQueue.jsx)和[会话页面](../../src/ui/RemoteWorkspace.jsx)已将用户消息、模型图片、工具及嵌套结果、上下文、队列/正在提交附件接到同一个文件窗口。[RemoteAttachmentFiles](../../src/remote-attachments.mjs)与电脑文件共用文本/字节收集、下载和分享器，但始终取聊天原始附件。尚未进入会话日志的待处理附件可能被原授权拒绝；这些入口尚未逐一实测。
- MuMu 正式入口 `--attachment` 已打开历史 `dshm-shared-upload-20260924.txt`、全屏并通过系统窗口保存。85 字节文件 SHA-256 与原始附件一致：`090416bcf450b460fa0f97330818ad33fa347010458d1ce461b0d4f5a10c37be`。报告 `artifacts/remote-mobile-attachment-android.json`，2026-09-23 18:43:26 UTC。
- `--attachment-image` 使用专用会话的真实 read_image 工具结果，1024×1024 PNG 为 2,364,981 字节，大于 WebSocket 单帧上限；卡片打开、原 ImageBody 显示、全屏及关闭后 Blob 失效通过。模型正确识别顶部红/绿/蓝色块；这是工具返回图片验收，不是手机图片语义上传。报告 `artifacts/remote-mobile-attachment-image-android.json`，2026-09-23 18:47:04 UTC，截图 `artifacts/remote-attachment-image-android.png`。模型测试后恢复 Pro。
- 插件 0.1.9 已安装，DSH/网关已重启，App 已覆盖安装；保持原绑定、Key 和历史。Web/Android 构建与 lint 已通过。本轮重新检查：手机 **98**、插件 **38**、后端 **27** 项通过；独立 PostgreSQL 用例默认跳过。本轮未重跑物理手机或公网环境。
- [Host 测试](../../../plugin/tests/attachment-preview.test.ts)覆盖越权引用、显示名替换、信用窗口、图片原接口调用、迟到完整性失败和取消；[手机测试](../../tests/remote-attachments.test.mjs)覆盖迟到失败不发布/保存、长度与顺序、超限和取消；[协议](../../../backend/tests/remote-file-policy.test.ts)拒绝路径、身份和内容注入，[网关](../../../backend/tests/remote-permissions.test.ts)覆盖真实 HTTP/WS 的同设备异连接 ACK 与撤销。
- 后续 HTML 与 Office 附件预览已按后文接入；仍未完成图片内联展示及不同来源的完整验收。附件不假借同名电脑路径。文件差异、只读命令详情、远端应用预览和插件局部 UI 等原范围继续保留。图片输入已按下节实现并验证 PNG。
- 图片输入的依据：[PromptContentPart](../../../deepseek-harness/packages/api/session-controller/src/types.ts)中图片传 mediaType/base64，普通文件传同会话 receiptId；[prompt](../../../deepseek-harness/packages/api/session-controller/src/commands.ts)先检查模型 inputModalities，再 admitPromptContent，并串行化图片接纳。旧版相册全走 file receipt 的实现已被下节替代。

## 手机图片输入（2026-09-24）

- [手机编码](../../src/remote-image-input.mjs)保留系统 File，PNG/JPEG/WebP/GIF 使用原图片内容；未知 MIME 按支持的扩展名声明，真实格式仍由 Host 检查。相册不支持的格式明确失败，普通文件继续原 receipt 上传；同一条消息可混合文本、图片与文件。临时图片 URL 归属原 pending submission 生命周期，失败/结束/销毁释放，未知结果禁止再次提交附件。
- 比较了直接大 RPC 与固定分片入口：前者超过现有 2 MiB WebSocket 和原生桥单帧限制，选择 [remote.prompt](../../../docs/protocol.md#图片消息输入) 固定消息入口，不扩大通用权限。插件 0.1.10 保留原 Connection 信封和 requestId，Host 模型能力、图片接纳、队列/插话、原参数检查不变；64 KiB/4 块窗、256 MiB 编码正文、并发 2 个。网关仅转发，完整编码在手机和原 Host 仍占内存。
- MuMu Android 12 / WebView 110 从「添加附件 → 从相册选择」实际选择 `dshm-image-input.png`（2,364,981 B、1024×1024），Flash 正确返回提示词没有给出的蓝/红/绿顺序；原会话持久消息里的图片可再次打开并全屏。电脑 DSH 同一专用会话也显示图片及回复；没有 read_image 或其他工具参与这轮识图。模型恢复 Pro。报告 `artifacts/remote-mobile-image-input-android.json`，2026-09-23 19:20:22 UTC；截图 `artifacts/remote-image-input-android.png` 已检查。
- Pro 实际发送相同图片被原 Host 拒绝（MODEL_DOES_NOT_SUPPORT_IMAGES），没有新增模型回复，草稿与待发图片保留。测试随后移除自己的附件并清空测试草稿；报告 `artifacts/remote-mobile-image-input-rejection-android.json`，2026-09-23 19:19:14 UTC。
- 相册缩略图用 content-desc 命名，测试脚本原先只匹配文件列表文字且“下载”与面包屑冲突，导致停在选择器；已修正测试定位。[脚本](../../scripts/verify-remote-mobile-android.mjs)现在断言单次选择仅添加一张图片、恢复模型弹窗关闭后才结束，重跑通过。早期恢复过程遗留的重复测试附件保留为历史，不把它算作单张选择验收。
- [手机模型测试](../../tests/remote-model.test.mjs)覆盖会话归属、原字节、业务拒绝与未知结果、URL 释放；[上传测试](../../tests/remote-upload.test.mjs)覆盖大信封分片、原业务失败；[Host 测试](../../../plugin/tests/remote-adapter.test.ts)使用真实 Connection 验证大消息、取消、损坏 JSON 与正文改调其他 RPC 被拒绝；[网关测试](../../../backend/tests/remote-permissions.test.ts)覆盖同设备另一连接不能注入及撤销取消。
- Web/Android 构建与 lint 通过，插件 0.1.10 已安装并重启；保留原绑定、Key 和历史。尚未逐一实测 JPEG/WebP/GIF、图片与文件混合真实发送及全部大小/损坏边界，不能用 PNG 结果代替完整附件验收。HTML/Office 附件、图片内联预览、文件差异、命令、插件局部宿主及完整矩阵仍未完成。
- 本轮手机 **101**、插件 **40** 项通过；后端上一轮 **28** 项通过、独立 PostgreSQL 默认跳过。文档校验 **61 文件/817 本地链接**通过，插件 0.1.10 安装包说明已重新打包，KKC-19 状态与下一步已同步并保持进行中。

## HTML 原始附件预览（2026-09-24）

- [附件适配](../../src/remote-attachments.mjs)增加 document 读取：继承原附件流的容量、完整性和取消检查后返回字节，不构造电脑绝对路径。[文件窗口](../../src/ui/RemoteFilePreview.jsx)与[HTML 局部组件](../../src/ui/RemoteHtmlPreview.jsx)复用已有打包器及独立沙箱。
- 原始附件没有目录授权。比较按文件名查电脑与只读取附件自身两种方式，前者会混淆发送时内容和电脑当前文件，并扩大读取范围，因此只渲染附件自身的内嵌 HTML/JS/CSS。直接引用但未提供的本地脚本/样式明确报错；原电脑文件链接仍按原会话目录和版本读取依赖。没有扩大公网协议、Host 权限或沙箱网络权限。
- [实际脚本](../../scripts/verify-html-attachment.mjs)由主联调入口 `--html-attachment` 调用。MuMu Android 12 / WebView 110 验证：系统选择器上传两份独立 HTML 并发送到既有测试会话；历史卡片打开、内嵌脚本与计数按钮、全屏；改本机样例不替换历史附件；缺失脚本报错且不留下旧 iframe。
- 实测 origin=null，两种原生桥 undefined，父页面/存储/网络拒绝；关闭 iframe 消失且原生暂存为空。报告 `artifacts/remote-mobile-html-attachment-android.json`（2026-09-23 19:28:34 UTC），截图 `artifacts/remote-html-attachment-android.png` 已视觉检查。
- 电脑文件链接入口 `--html` 也重新实测通过本地脚本/样式、交互、全屏、最新版重读、依赖删除、沙箱隔离、文件选择器拒绝及关闭释放。报告 `artifacts/remote-mobile-html-android.json`（19:29:23 UTC），一条 403 来自主动验证已关闭 URL，属于预期。
- 手机 **102** 项测试、Web 构建、Android assembleDebug/lintDebug 通过；覆盖安装保留原 Key、绑定、历史。没有更改后端或插件代码；Office 附件转换、图片内联展示、文件差异、命令详情等仍保留在完整矩阵中。
- Office 后续依据已核验：原 [OfficeToPdf.convert](../../../deepseek-harness/packages/document/office-to-pdf/src/index.ts)支持授权元数据与延迟有界 read；应先确认原会话附件引用再向此共享转换器提供 AttachmentStore 字节，不把附件显示名拼成 workspace 文件。后续实现及证据见下节。

## Office 原始附件预览（2026-09-24）

- [Host 附件转换](../../../plugin/src/attachment-office.ts)先通过原会话日志核验文件引用，再提交原 `OfficeToPdf.convert`。源字节在队列预留容量后才从 AttachmentStore 读取，完整性由原 provider 检查；缓存 key 包含会话、原附件 ID 和名称，缓存命中也重新授权。不把显示名解释为电脑文件路径，不给手机开放通用转换 RPC。
- 插件 **0.1.11** 新增 `attachmentOffice` 能力和固定 `remote.attachmentOffice`。元数据绑定附件 ID/名称、PDF 长度、字体与转换器 generation；32 MiB PDF、64 KiB/4 块窗、180 秒手机时限，与电脑文件 Office 共用并发 2 个。网关和 Android 固定方法已同步。Office 包只作插件开发期类型依赖，原引擎留在电脑，不进入 APK。
- 真实 Cordis 每次取服务会创建不同代理，不能靠对象等号判断服务重启；适配读取原服务 generation，在读取、转换后和流结束时核对，同时重查附件引用。关闭或失败不发布未完成 PDF，原引擎错误只传稳定原因，不传内部路径。
- [Host 测试](../../../plugin/tests/attachment-office.test.ts)覆盖真实 Cordis 代理、排队不提前读、缓存授权、引用丢失、服务替换、完整性/容量/PDF 校验、错误脱敏、信用窗及取消；[手机测试](../../tests/remote-office.test.mjs)覆盖身份不符、路径字段拒绝、最终权限失败及不支持的 Host；[真实 HTTP/WS 检查](../../../backend/tests/remote-permissions.test.ts)覆盖同设备异连接不能 ACK、收回权限取消在途流。
- 插件 **44** 项、手机 **103** 项、后端 **29** 项测试通过；默认 PostgreSQL 独立用例 1 项跳过。插件/后端类型检查、构建及 Web/Android assembleDebug/lintDebug 通过。插件、网关与主 App 已覆盖升级，沿用原设备绑定、普通聊天 Key 和历史。
- [MuMu 真实入口脚本](../../scripts/verify-office-attachment.mjs)由 `verify-remote-mobile-android.mjs --office-attachment` 调用，只操作专用会话，经过系统文件选择器、原附件上传、真实消息发送、历史卡片和自有预览窗口。六格式中英文文字层、全屏、docx/pptx 缺失字体提示、损坏文档报错和关闭 Worker 已通过。更改上传前本地同名源后，历史仍能预览原附件；下载保存的是 909 B 原 docx，SHA-256 为 `dc2c22d14e7aa21925bbf7c3870ccc74675c3887454670af29d770a73fa26104`，没有把转换 PDF 交付为原件。
- 权威报告 `artifacts/remote-mobile-office-attachment-android.json`（2026-09-23 19:51:52 UTC），无页面错误或失败资源，截图 `remote-office-attachment-{格式}-android.png`。早期脚本错误地核对了下载目录已有的上传源，后续改为比较保存前后文件集合，严格核对本次新创建的 `dshm-office-attachment-1790193112958.docx (1)`；Android 自动加后缀，`ls` 转义空格，因此使用 NUL 分隔原始路径，避免误读。已改坏的旧上传源不会被当作成功证据；历史测试消息保留。
- 历史文本附件脚本同步修正为校验本次新保存文件，并在旧附件超出首屏历史时通过实际“加载更早的消息”入口分页查找；修正后的 `--attachment` 已在同一安装版本重新通过，85 B 原文本哈希一致，报告 `artifacts/remote-mobile-attachment-android.json`。没有修改 App 保存行为或清除旧历史。
- 上述简单样例不代表任意复杂排版完全保真；图片内联展示、其他输入格式、文件差异、命令详情、完整远端应用预览、插件局部 UI 及其他 R01–R16 功能仍待完成，完整目标保持进行中。

## 聊天内联图片（2026-09-24）

- [图片读取](../../src/remote-images.mjs)沿用 `remote.attachment` 及最终完整性确认，不走大 JSON 图片 RPC。每个会话单独维护可见消费者，同一身份共用在途请求，最多同时读取 2 张；单张 16 MiB，当前引用字节预留总计 64 MiB。此额度不是解码后像素/浏览器总内存上限。取消等待中的图片不会启动网络请求；断线、离屏及切换会话取消并忽略迟到结果。
- [共用附件组件](../../src/ui/RemoteMessage.jsx)的用户消息、模型图片、工具/子工具、上下文、next-step 和 next-turn 队列均进入 [RemoteInlineImage](../../src/ui/RemoteImages.jsx)。直接复用原 ImageBody，保持 img 静态显示与 Blob 清理；不复制上游整套聊天页面。点击图片继续进入已有自有文件窗口，可全屏/下载/分享。未知格式保留文件卡片，加载/解码失败显示错误并可重试。
- 手机本地 File 与 pending submission 的受管 URL 单独展示；日志里的任意 previewUrl 不进入图片标签。本地 File 的 URL 由缩略图组件释放，已提交图片的 URL 保留原模型 onRetire 所有权。队列中尚未进入原日志的附件若被 Host 引用检查拒绝，保持真实错误，不绕过授权。
- [读取测试](../../tests/remote-images.test.mjs)覆盖共享/并发、队列取消、内存额度、最后释放、断线/会话隔离、迟到字节、原流最终失败及显式重试。手机 **107** 项测试通过；Web 构建、Android assembleDebug/lintDebug 通过。主 App 覆盖安装，普通聊天 Key、Remote 绑定和历史保留；插件与网关无需更新。
- [真实 Android 检查](../../scripts/verify-inline-images.mjs)通过 `verify-remote-mobile-android.mjs --inline-images` 执行，只读取专用会话历史，并从系统相册选择/移除已有测试图片，不发送新模型消息。实际用户 PNG 为 1024×1024，三色像素为 `[25,25,230]`、`[230,25,25]`、`[25,230,25]`；工具 PNG 同样显示 1024×1024。全屏和已有下载/分享按钮、离屏后旧 Blob 无法加载、重新滚入重读、收起工具释放、切换会话释放、待发送相册缩略图及移除释放通过，页面无横向溢出。
- 实测发现 RemoteActivity 原先没有调用页面已有 `dshmHandleBack`，Android 返回会直接销毁整个 Remote。现与普通聊天一样交由自有页面先处理，未处理时才结束 Activity；实际全屏返回保留同一会话。首轮脚本因此失败；另一次脚本在本地图片刚插入 DOM、尚未解码时断言 naturalWidth=0，修正为等待真实解码后通过，没有以存在 img 标签代替加载成功。
- 权威报告 `artifacts/remote-mobile-inline-images-android.json`（2026-09-23 20:09:31 UTC），errors/resources 均为空；截图 `remote-inline-user-android.png` 与 `remote-inline-tool-android.png` 已检查。真实验证覆盖历史用户/工具 PNG 与相册草稿；模型生成图片、嵌套工具、上下文与运行中队列的不同来源尚未逐一实测，其他图片格式仍待补验。完整 R01–R16 目标保持进行中。

## 旧载体验证与遗留排查记录

本次授权验证已执行，测试设备已撤销；其他已批准设备未变更。完整 R01–R16 范围不变；主要缺口为正式移动布局、辅助接口、真实附件预览/下载、预设写入与其余任务操作。后续需要实际设备联调时应重新配对，不能恢复已撤销身份或借用其他设备。

### 本轮真实入口结果（2026-09-23）

- Android 系统选择器选取独立测试文本（75 B），经原输入插件发送到电脑；模型读取文件，返回 DSHM_REMOTE_ATTACHMENT_20260923。提示词没有包含该标记，确认实际内容抵达 Host。
- 电脑将专用会话收紧为“仅可查看”，手机同步显示；写入先被拒绝，正常升级请求出现“等待审批”，手机点击“允许一次”后写入独立测试文件，返回 DSHM_APPROVAL_OK。磁盘文件内容也核对一致；会话仍为只读，没有永久放宽权限。
- 手机将 Pro 切换为 Flash，电脑立即同步；电脑切回 Pro，手机同步恢复。没有在运行中变更模型。
- 强制结束并重新打开本 App 后，进入 Remote 自动连接，三轮历史及模型/只读设置恢复，未重复发送消息。
- 点击工具记录中的测试文件打开预览，显示“文件资源服务不可用”。原 workspaceFiles 文件服务及 `/api/changes.summary`、`/api/present.host` 尚未适配，不能算预览通过；需要先核验文件范围及大结果分片，不能直接开放任意文件/HTTP 读取。
- 桌面撤销本次测试设备后，手机聊天树销毁，旧 bundle 请求返回 502（原生已断开，不返回内容）；再连接被拒绝。证据在本机 `artifacts/remote-revocation-android.json`。在途真实下载/Worker/上传取消的完整矩阵未完成；已有协议测试和原生独立字节测试只作为边界证据。
- 重连错误原先泛化，现已补充 HTTP 401 的“连接授权已失效”提示及网关白名单关闭原因；不把认证失败一律误称为用户撤销。覆盖安装后，已撤销身份的实际 App 启动明确显示该提示并拒绝连接；新增的在线关闭原因透传尚未用新设备重复触发验证。

复现脚本：[Android 真实入口检查](../../scripts/inspect-remote-android.mjs)。其中发送/审批参数仅适用于上述专用测试会话，不能作为不经选择的通用自动回归。报告不读取 Key/token。

### 电脑启动入口的已验证问题

本机实际运行目录为 `F:\Program Files\deepseek-harness`。`pnpm dsh web` 的 tsx 源码入口与 profile 加载的编译模块混用，导致 dsh-tools 的唯一 Symbol 有两个实例；工具执行报 `Cannot read properties of undefined (reading 'prepare')`。同样问题在电脑新建的测试会话重现，因此不是 Remote 独有。通过实际 profile resolver 比较确认源码/编译版本 scheduler 和 class 身份不相同；全编译入口身份相同。

此前临时改用 `node apps/cli/lib/bin.js web --no-open`（相同profile、数据和插件）绕过混用，新建的「DSHM Remote 联调提示」完成真实提问。旧失败会话存在未完成工具调用，未拿来反复重试。源码依据为[工具调度](../../../deepseek-harness/packages/core/agent-loop/src/tool-calls.ts)和[tools Symbol](../../../deepseek-harness/packages/core/tools/src/index.ts)。

2026-09-25：[源码解析修复](../../../plugin/compatibility/source-start/README.md)精确复现后按原profile包版本选择统一同安装源码入口，实际原调度器、外部ESM/CJS、Worker与DSHM模块通过回归，插件自带版本不变。固定基线安装器已应用到现场，`pnpm dsh web`及原profile下MuMu后台独立输出、模型后续读取已验收；完整证据见上方源码启动记录。其他安装形态及完整R01–R16未完成。

Android 资源通道修复了重复 Content-Type 和 EOF 后错误；[平台兼容](../../src/remote-platform.mjs)仅在缺失时补充 AbortSignal.any/Promise.withResolvers。原模块 bundle 已真实返回 JavaScript 并完成挂载。辅助接口 dynamicCordisRunner 与 HMR 仍有拒绝/未适配日志，不能视为全部插件能力可用。

1. 完成授权资源载体：分片、背压、Range、上传/下载、取消、bundle 与 Worker 原生映射，撤销覆盖全部资源。
2. 接入原客户端核心与模块图，核验版本一致性，加载真实扩展，保留已确认移动页面。
3. 从正式 Remote Activity 验证纵向门槛：配对→工作区→真实扩展→已有工作区新聊天→一次审批→上传/预览→撤销全部通道。
4. 按矩阵补齐 R01–R16 与原生整合，更新 KKC-17/18/19/20/10 的实际验收。

本地网关/MuMu 为当前验收环境；不增加公网部署和物理手机前置。保持普通聊天独立 origin/Key/历史，不清库或卸载 App，不重放结果未知的写操作。
