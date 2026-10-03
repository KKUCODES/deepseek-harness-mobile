# 插件局部界面与外层自适应

- 状态：Remote 原轮尾/回复操作插槽已接运行时；完整插件兼容仍在实施。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-09-27。
- 来源：[插槽宿主](../../src/remote-plugin-slots.jsx)、[作者声明与用户偏好](../../src/mobile-plugin-layout.mjs)、[外层组件](../../src/ui/MobilePluginFrame.jsx)、[运行时](../../src/remote-plugins.jsx)、[浏览器验证](../../scripts/verify-remote-plugin-slots.mjs)。

## 作者接口

宿主在同一窗口内集中读取插件尺寸后批量更新外层缩放，避免逐个交错读写。首次测量在React提交后的微任务完成，确保历史分页定位使用已缩放的高度；后续尺寸变化按动画帧合并，卸载取消尚未执行的测量。此行为不改作者接口、用户优先级或内部样式。来源：[调度器](../../src/plugin-frame-measurement.mjs)与[实际分页和测量证据](../integration/remote-current.md#插件外层测量与历史分页2026-09-27)，不能推出任意插件或整体性能已验收。

手机尺寸和工厂包装必须保留原组件的错误归属。[私有身份映射](../../src/remote-component-identity.mjs)供宿主包装登记来源，错误通知还原原组件；原ledger继续隔离实际条目，工厂定义不因单次实例失败退位。不能按registrant/name猜测归属，也不能修改插件内部来补偿包装遗漏。依据：[真实故障、回归与恢复](../integration/remote-current.md#动态插件渲染错误归属2026-09-27)。

原 `sidebar.footer.action` 现呈现在手机插件面板底部。外层只测正常布局宽度，排除视口fixed弹层对触发器缩放的反向影响；比例为1时不创建transform定位容器。保留作者声明、用户优先和默认开启，未改内部CSS。原CordisPanel的手机弹窗、运行与移除实测见[记录](../integration/remote-current.md#动态插件手机入口与真实运行2026-09-27)；需要实际缩小的第三方fixed弹层尚不能泛化为已兼容。

原审批/提问apply已接入conversation.composer，插件可沿原conversation.approval.detail显示调用详情，沿conversation.plan-review.actions扩展计划操作。原ui-plan在DSHM面板打开完整计划，不替换App页面；包装继续按作者声明与用户偏好控制外层缩放。见[实际验证和边界](../integration/remote-current.md#原审批与提问插件2026-09-26)。

空聊天品牌/工作区/模式已在DSHM自有布局显示。`conversation.hero.workspace`在无会话和已绑定空聊天中都接收open、anchorRef、selectedId、onPick、onClose；选择通过同一真实导航与草稿转移服务，失败收起选择器并由宿主显示错误。缺少工作区的空聊天会向composer.bar提供disabled、placeholder、workspacePickerOpen和onRequestWorkspace。品牌可用宽度按size=34预留，仍只缩放外层。见[实际入口与验证范围](../integration/remote-current.md#空聊天品牌与工作区插件2026-09-26)。本段更新下方绑定空会话hero未完成的历史描述；独立测试包通过不等于任意第三方组件兼容。

`conversation.content` 统一声明 `conversation.session`、`conversation.composer`、`conversation.composer.bar`、`conversation.input.dock`、`conversation.hero.brand.mark`、`conversation.hero.workspace`、`conversation.hero.agentPreset`。主聊天、标准旁栏和直接实例使用同一工厂所有者；调用者提供的局部 Views 可通过原 `renderSlot` / `renderSlotChain` 使用这些入口。输入状态仍由当前手机会话持有，不因正文替换丢失。见[统一输入扩展及实际验证](../integration/remote-current.md#会话工厂统一输入扩展2026-09-26)，本段更新下方child尚未统一的历史描述；绑定空会话完整hero仍未完成。

`conversation.content` 已注入 `selectWorkspace(workspaceId)`，只接收电脑已登记的工作区。无会话调用直接选择；绑定空会话时原子交接本机草稿与原件，文件在目标重新上传，不继承旧 receipt。目标已有草稿则拒绝覆盖；factory 原会话作用域与当前视图不一致时拒绝旧回调。主空聊天选择器复用同一服务，见[交接验收](../integration/remote-current.md#工作区草稿与附件交接2026-09-26)。

factory 提供 `useComposerBlock(selector)`，与编辑器共用输入禁用来源；无会话返回 undefined。标准旁栏与注册插件直接创建的工厂实例均在工厂外持有导航，子→父切换后 Hook 和 selectWorkspace 重新绑定当前会话，见[标准旁栏](../integration/remote-current.md#旁栏工厂作用域与输入禁用2026-09-26)及[独立入口验收](../integration/remote-current.md#插件直接创建聊天视图2026-09-26)。完整 child 所有权仍未统一，独立包通过不代表全部第三方兼容。

主聊天现已通过同一 `conversation.content` 的默认 Views 渲染 `conversation.session`。该插槽的替换同时适用于主聊天和旁栏，输入框、附件与发送状态不随正文替换而重建；完整 child 所有权尚未迁入工厂。主视图保留真实 mainView 身份与原阶段判定，见[实际边界](../integration/remote-current.md#主聊天接入同一内容工厂2026-09-26)。

未声明时默认开启外层自适应。已有插件不必修改内部布局；当前实现按内容自然宽度等比例缩小超宽内容，保留窄内容原尺寸，外层高度按相同比例占位。点击坐标由浏览器变换处理。关闭时不缩放，超宽内容在局部区域滚动，不撑开聊天页面。

开启时外层使用 `overflow:clip`，避免浏览器在弹窗归还焦点时按缩放前宽度横滚、裁切已缩放内容；关闭时保持 `overflow:auto`。原组件回放与[电脑插件管理实际入口](../integration/plugin-management-current.md)已验证。

已自行适配手机布局的插件可以关闭默认缩放：

```js
export const inject = ['slots'];

export function apply(ctx) {
  // 条件注入只影响这条手机声明；桌面没有该服务时，插件其余部分照常运行。
  ctx.inject(['dshmLayout'], mobile => {
    mobile.dshmLayout.configure({ autoFit: false });
  });

  // 原 slots 注册代码保持不变。
}
```

这是 DSHM 运行时扩展服务，并非上游 DSH 已有 API。当前未独立发布 SDK。`configure` 仅接受布尔值 `autoFit`，不接受任意 CSS、脚本或内部布局改写。声明归属当前插件的 Loader entry，随 fiber 卸载释放；新版本不再声明时恢复默认开启。

优先级为 **用户设置 > 作者声明 > 默认开启**。用户在 Remote 选项 → 电脑插件中切换自适应，或恢复插件默认；偏好只保存在手机的独立 Remote 来源，不改电脑设置、普通聊天 Key 或历史。用户覆盖在插件卸载/重载后保留。

## 边界

- `conversation.hero.agentPreset` 已按 single/session-maybe 接入无会话及主聊天空会话，使用电脑原插件 staged 状态和真实 mainView 接收者；旁栏不冒充主视图。原组件的读取/应用和选择期间共用手机发送锁，完成后恢复编辑器。MuMu 已验证 standard→预选 minimal→选择工作区后实际 minimal→恢复 standard；没有修改默认模式或发送模型请求。此条替代下方“staged 模式预选未接入”，完整 hero/工厂/设置写入竞态仍待补齐，见[证据与边界](../integration/remote-current.md#原插件模式预选与主聊天身份2026-09-26)。

- 无 session 的 `conversation.content` 已有 DSHM 欢迎页、`conversation.hero.brand.mark`（size）、`conversation.hero.workspace`（open/anchorRef/onPick/onClose），只选择已有工作区。无会话 `conversation.composer.bar` 接收 variant=hero、disabled=true、placeholder、workspacePickerOpen/onRequestWorkspace；显式清除继承会话，默认输入和发送禁用。实际选择复用原工作区导航并打开手机主聊天；MuMu 已验证电脑既有空聊天复用及卸载恢复。原 staged 模式预选、已绑定空会话完整 hero、selectWorkspace/composerBlock 与完整 child 尚未完成；此条替代下方无会话完全未接入的历史描述。见[当前证据与限制](../integration/remote-current.md#插件无会话入口与工作区选择2026-09-26)。

- 已选会话的 factory Views 与输入框分离：`conversation.session` 只提供 DSHM 当前会话的标题与正文，外部常驻 RemoteWorkspace 持有同一输入状态、附件、队列和操作窗口。局部 Views 可以不调用该插槽而只呈现自定义内容，输入框仍在；恢复正文保持阅读位置，正文不显示时暂停阅读回执。MuMu 已验证同一编辑器 DOM、草稿和滚动位置；此条替代下方“独立 composer 未完成”，无会话 hero/完整 child 与注入、主页面统一 factory 仍未完成，见[分离边界](../integration/remote-current.md#插件内容与常驻输入框分离2026-09-26)。

- `conversation.content` 已提供默认 DSHM 聊天、调用方局部 `views/widthControls`，控件接收 container/phase/locale。工厂实例持有当前会话引用，局部视图替换及整个宿主卸载保留导航与草稿；读取失败可重试。整块 `sidebar.chat.conversation` 的外层继承窗口高度并反算缩放前高度，不改插件内部，其他插槽仍按自然高度。真实 MuMu 已验证输入框位于屏幕内。完整 child 集合、Views 之外独立 composer、无会话 hero 与 selectWorkspace/composerBlock 尚未完成，见[验收与边界](../integration/remote-current.md#插件会话视图与局部控件2026-09-26)。

- 已选择会话的主聊天和旁栏支持原 `conversation.composer.bar`（single/session-maybe）和 `conversation.input.dock`（list/session）。bar 接收原 owner 的 variant/disabled/blocked/placeholder 和标准 useInput/inputActions；dock 接收当前 session/input。输入状态机常驻，替换仅影响呈现，草稿、引用与提交路径保持；离线回到默认禁用输入，一次性子任务不开放编辑。原内置目标 dock 由手机现有摘要承担，其他 dock 正常。完整 factory 与无会话 hero 尚未接入，见[真实验收及限制](../integration/remote-current.md#插件输入框与停靠区2026-09-26)。

- `uiWorkspace` 会话导航服务已提供：`openSession/connectWorkspace/openWorkspace/startSession/forkSession/archiveSession/unarchiveSession` 使用真实会话控制器，根 `useWorkspaces` 提供工作区快照。原接口导航主聊天，从旁栏调用也收起旁栏并打开 DSHM 主聊天；连接工作区只返回 ID，不导航。`pickDirectory/listDirectory/createDirectory` 按手机范围抛出 `remote_directory_navigation_disabled`，插件应处理不支持结果。完整 conversation.content 工厂仍未完成；下方旧记录的 uiWorkspace 未接入描述以本条为准。见[接口契约与 MuMu 验收](../integration/remote-current.md#插件工作区会话导航2026-09-26)。

- `conversation.composer`已按原chain/session契约接入主聊天与旁栏。owner提供当前`sessionId/session/pendingInteraction`，使用原优先级升序选首个匹配，匹配结果传入`matched`。`overlay:true`仅隐藏默认编辑器、不卸载，结束或卸载后恢复；断线使用fallback。插件局部界面继续遵循本页自适应设置。这不代表完整conversation.content工厂或原审批/提问apply已兼容，手机现有审批/提问仍由自己的已接通入口承担。实际独立电脑插件验收见[输入区域接管](../integration/remote-current.md#插件输入区域接管2026-09-26)。

- 子会话旁栏复用原资源、标签和ConversationSlotPanel，手机conversation.content组合承载DSHM自身RemoteWorkspace。仅两个受控旁栏组合按组件身份免于插件外层缩放，聊天内其他插件仍沿本页优先级；这不是作者可用的通用豁免开关。原conversation.content完整composer/hero契约和uiWorkspace仍待接入，不能据此认定完整ui-subagent已兼容。见[旁栏当前边界](../integration/remote-current.md#子会话旁栏实际接入2026-09-26)。

- 会话标题下支持原 `conversation.session.header.leading`、`actions`、`utilities` 和 `corner`，按该顺序进入手机插件区域；leading/corner保留原session范围single类型，actions/utilities保留list类型，提供原 `sessionId/useSession` 等标准属性，外层自适应规则相同。手机保留自己的模式选择和日志导出入口，对应原内置条目不重复注册，其他插件同槽注册不受影响。原交互终端插件的完整apply已排除，包含旁栏创建与标题恢复；模块依赖表和只读命令结果保留，见[终端边界实测](../integration/remote-current.md#手机终端边界与遮挡通知2026-09-26)。标题扩展来源见[标题边缘扩展验收](../integration/remote-current.md#标题前置与角落插件2026-09-26)。
- `conversation.session.header.lineage` 保留single/session类型和原owner：`lineageSessionId`、`displayTitle`、可选`openTitle`。当前普通会话在默认标题旁渲染，当前子会话和子会话祖先替换默认标题；普通祖先保持手机导航按钮。标准`sessionId/useSession`始终属于当前打开的聊天，`lineageSessionId`才是该层目标；只有祖先提供`openTitle`，且点击时复核当前引用及父关系。卸载恢复默认标题，导航复用真实会话地址、草稿与只读限制。原内置子会话下拉还依赖`uiWorkspace`等服务，本插槽完成不表示那些依赖已实现。详见[层级契约及实际验收](../integration/remote-current.md#会话层级与祖先导航2026-09-26)。

- 原侧栏服务已由[手机面板](../../src/remote-plugin-panels.jsx)提供，入口为 Remote 选项 → 插件面板，支持原标签类型/正文/标题及 guide 插槽，局部界面继续遵循相同缩放优先级。类型作者必须用 `ctx.effect(() => ctx.sidebarRightTabs.register(definition))` 持有原注册 disposer，卸载才会移除入口。实际安装、文件读取和卸载见[面板验收](../integration/remote-current.md#插件面板与原侧栏服务2026-09-25)；其他侧栏服务并非自动可用。
- 目前接入原 `conversation.chat.turnTail`、`conversation.chat.assistant-actions`、`conversation.input.overlay` 和全部消息节点的 `conversation.chat.node`。插件可替换内置节点，缺 renderer 回退 DSHM 原排版；同一会话/节点/轮数据 Hook、翻译、文件/工具/分支回调继续保留。消息图片插槽 `conversation.message.images` 和有界 `loadImage/peek` 已提供，图片 URL 随作用域释放。`openFile(path, { line })` 保留原1-based文本行号，在手机源码视图定位；原工具/图片及文本/Markdown链接在MuMu通过，插件指定行号经组件回放验证。可选 `turnProcess` 已通过原 ChatNodeSeat/store 接入，提供同一轮的展开控制；[真实历史验收](../integration/remote-current.md#聊天过程折叠2026-09-25)通过。其他 owner 完整语义仍待验收，不能视为任意插件均兼容。
- 每个局部注册外层包裹缩放容器，同插件嵌套插槽不重复缩放。插件内容变化和可用宽度变化由 ResizeObserver 重新测量；卸载移除观察器。
- 插件不能通过注册 `root` 替换 DSHM 页面，该操作报错。局部插件仍处于可信插件运行环境，这项约束不构成任意恶意 JavaScript 的安全沙箱。
- 模块图、bundle 和资源仍通过既有 Remote 鉴权链路。手机组合层不再执行已由手机承担的会话/页面入口；缺少服务的插件明确显示暂不可用，不虚构服务以让其通过。
- 普通模块图变化时重建插件子树并清理样式，保留页面/会话和草稿；连接核心或生成接口 revision 变化时要求重新连接。完整逐插件热替换、Worker/全部资源撤销及真实第三方插件覆盖仍待验证。
- 插件可取得原 Remote 命名空间和 Agent 作用域；服务存在不等于设备获准调用。已核验内置插件根据电脑协商的接口名单选择启动，缺少接口显示等待；不能据 active 推断完整交互可用。

## 已验证

原页脚组件只在插件面板可见且文件窗口未覆盖时挂载；隐藏时卸载局部界面，待审批状态仍保存在原运行器。宿主投影提醒并在“查看请求”后打开原界面，不替代插件审批逻辑。聊天实际审批/版本授权与首页回放范围见[验收记录](../integration/remote-current.md#动态插件审批与版本授权2026-09-27)。插件作者不能依赖隐藏页脚组件持续挂载来保存业务状态。

原侧栏标签菜单可通过 `sidebar.right.tab.menu.item` 注册列表项，owner 提供真实 `tab` 和 `dismiss`；执行动作后按原契约调用 dismiss。面板使用 body 容器，原 Modal/Menu 的 body portal 不再被 native dialog 遮挡，Android 返回按层关闭。隔离回放与0.0.3实际电脑插件→MuMu验证见[菜单与弹窗记录](../integration/remote-current.md#插件面板的菜单与弹窗2026-09-25)。第三方自定义 portal、弹窗尺寸和键盘契约仍须分别核验；不承诺任意 body 内容自动缩放。

文件引用 owner 与手机默认回复共用原成功写入/交付判定。原 `chatFileMentions` 服务存在时优先交给插件；不存在时使用手机现有交付投影，保留完整路径与唯一简称匹配、失败/歧义拒绝。真实 write 后最终回复点击进入DSHM预览已通过，详见[文件名引用记录](../integration/remote-current.md#回复中的文件名引用2026-09-25)。这不等于全部第三方引用服务均已验收。

独立浏览器回放使用原模块 bootstrap、真实 script 注册和明确标识的测试插件，验证动态图更新、800px 内容缩放、点击、用户优先级、作者卸载恢复默认、草稿保持、禁止替换根页面及样式清理。该回放不代替真实电脑加载。

2026-09-25另以[独立验收包](../../tests/fixtures/live-partial-plugin/README.md)通过电脑公开插件页实际安装并经原模块图传至MuMu：0.0.1未声明时720px缩到372px，按钮点击及openFile进入DSHM共用预览、电脑打开确认取消通过；用户关闭缩放保留原宽。0.0.2声明autoFit:false后实际不缩放，用户手动开启可覆盖，恢复默认回到作者声明。两版本均未替换根页面、插入电脑整页或更改插件内部布局。卸载后手机模块条目与卡片消失，没有重启DSH或网关、发送模型消息或改变授权。实际[脚本](../../scripts/verify-live-partial-plugin-android.mjs)及三份报告见[完整记录](../integration/remote-current.md)。该包为自编代表性插件，不证明任意第三方服务、插槽、Worker均兼容。
