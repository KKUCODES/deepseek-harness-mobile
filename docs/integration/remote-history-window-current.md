# Remote 长聊天窗口与恢复

- 状态：2026-10-24 已随[preview.12/code15](https://github.com/KKUCODES/deepseek-harness-mobile/releases/tag/v0.1.0-preview.12)公开发布；[Actions40082470843](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/40082470843)构建/lint/原签名和APK及附件匿名下载核验通过。源码固定783e979；[发行证据](../releases.md#已核验范围)。旧preview.11不含本轮修复。
- 维护角色：DSHM 协作 Agent。
- 需求：[KKC-89](https://linear.app/kkcodes/issue/KKC-89)。只修改手机端，不改 DSH、插件、中转，不合入插件适配分支。
- 依据：[连续翻页的资源压力、未复现部分与行业方案](./remote-history-white-screen-diagnosis.md)。资源压力不等于已证明反馈用户白屏的唯一根因。

## 数据与显示

比较过仅虚拟化DOM和同时限制数据窗口：前者接入较少，但仍累计事件/投影；后者需要双向读取和锚点回归，能同时约束两层资源，采用后者。虚拟化沿用现有TanStack依赖，避免新增消息列表运行库；代价是由手机层维护可变高度、焦点和前插校正，并分别验证两个SDK。

手机分别保留实时尾部和当前查阅窗口，以 400 条事件、4 MiB 编码内容、24 个回合为目标预算。窗口移动不删除电脑日志；可以向前、向后查阅或返回最新。原始单条事件和未结算的流式步骤作为原子单元完整保留，允许超过预算，避免正文悄悄变短。连续文本/思考增量无损合并，原 SDK 仍按 attemptId 结算。因此这是事件窗口预算，**不是整个 WebView 的硬性内存上限**；巨型原子记录、任意插件自身缓存仍可能产生压力。

使用已有 TanStack Virtual 依赖，仅挂载可见区域和缓冲，每组至多四个节点。前插和变高消息保留可见锚点，不遍历全部历史 DOM 定位。长内置回复/思考在统一节点席位分段，原回退 Markdown 和后台输出也分段；原正文不改写。跨段代码围栏补齐，跨段引用定义、表格或内联语法的局部格式可能不同于整篇解析。

读取前、发布前各让出一次任务，校验连续 seq 和请求 cut，取消过时读取。失败保留原画面，允许手动重试。通过 SDK 公开可变呈现源裁剪手机窗口，不修改原 Journal 游标或私有字段；所有手机历史读取经过同一装饰 binding。长期追加淘汰 2,000 条后，仅在任务空闲、没有待发送回执/活动流时调用公开只读 resync，刷新 SDK 序号索引，保留控制投影与插件作用域。

| 状态 | 保留方式 |
| --- | --- |
| 实时同步、发送回执 | 原 Session 持续订阅；即使查阅旧页，写入确认仍从实时源核对 |
| 审批、模型、队列、插件服务 | 沿用原控制投影和待办载体，翻页不重建插件树，不重放发送/审批 |
| 输入与显示状态 | 输入区持续挂载；SDK 会话折叠/交互状态归原服务，长内容页码只存有界元数据 |
| 插件消息组件 | 保留席位和身份。离屏会卸载，任意插件只存在 React Hook 内的临时状态无法通用序列化；作者需放在会话服务/存储。不宣称保存任意第三方私有状态 |
| 阅读位置 | 按来源、设备、指纹隔离保存会话地址、seq、组和偏移；不保存正文、凭据或审批决定。损坏/过期记录不恢复 |
| 子会话 | 沿用原地址解析和公开 page 读取，不降级为普通主会话 |

## 触顶自动加载

已随[preview.13/code16](https://github.com/KKUCODES/deepseek-harness-mobile/releases/tag/v0.1.0-preview.13)公开发布；源码dcca782，Actions40088585593构建/lint/原签名/Release及APK与附件匿名下载核验通过。[发行KKC-93](https://linear.app/kkcodes/issue/KKC-93)与[发行证据](../releases.md#已核验范围)记录准确来源。旧preview.12没有自动加载入口。

2026-10-24，[KKC-92](https://linear.app/kkcodes/issue/KKC-92)。[自动加载控制器](../../src/remote-history-auto-load.mjs)由主聊天和旁栏共用的 RemoteWorkspace 挂载：用户向上阅读到距离顶部 160 CSS px 内，复用同一个 loadHistory → loadEarlierHistory → loadRemoteHistory 路径。只增加触发入口，不扩大历史窗口或改写电脑日志；原虚拟列表继续维护可见锚点。

采用用户输入意图配合滚动距离，而非顶部 IntersectionObserver 一直可见就反复加载。触摸、滚轮、键盘和鼠标滚动条均支持；抬手后最多 1.5 秒的上行惯性仍可触发。一次触摸最多读一批，请求及两帧前插校正期间不排队，继续阅读才加载下一页。初次进入、程序滚动、返回最新、切换聊天、离线后恢复不重放旧手势；失败阻止自动重试，原按钮仍可手动重试。顶部显示加载状态，读完显示「没有更早的消息」。后台任务输出是独立分页面板，本轮不改成自动拉取。

rc.2 与 alpha.2 的真实列表点击入口、连续 24 次自动加载、原锚点/数据/DOM预算、实时/审批/草稿/插件状态回归通过。新增实际触摸输入、键盘、离线恢复不重放、在途切换、读完不再请求、旁栏四次自动翻页均通过；数据为隔离合成协议，不冒充真实电脑会话。最初实际触摸发现同一手势在快速回执后连读，已加入手势消费门槛并复验；rc.2 旁栏夹具补齐原 SDK subagentCatalog 投影后通过，未修改产品子会话逻辑。新增四项自动加载单元测试，全量 567 项通过，正式页面构建通过（原翻译重复键警告保持）。

隔离 API36.1/5556、独立 rc21test UID 的真实 RemoteActivity/WebView 使用当前产品组件和合成协议复验同一路径通过：连续24批、实际触摸、键盘、主/旁栏、在途切换、失败与重连、审批/输入插件状态均验证。页面保持120条查阅事件、6个挂载组，DOM约1239–1255。本轮未测试真实配对的用户长会话，也未改原生代码；`--auto-load`专门跳过不相关的渲染进程崩溃专项，旧崩溃验收沿用原记录。初次冷启隔离模拟器 System UI 无响应、原驱动停留的问题未计通过；重试的完整路径有独立报告。未操作日常MuMu/5554或其preview.12。

证据：`artifacts/remote-history-window-0.2.1-rc.2.json`、`artifacts/remote-history-window-0.2.1-alpha.2.json`、`artifacts/history-auto-load/android-window-report.json`及同目录Node报告；均为忽略产物。锚点必须存在后再做小于4px的断言，不允许因虚拟卸载而跳过位置验证；两版桌面回放24批均为0px，Android均约0.381px。专项结束卸载独立测试包、关闭5556及自有临时转发，日常MuMu保持。

来源：[自动输入回归](../../scripts/check-remote-history-auto-inputs.mjs)、[连续历史回归](../../scripts/check-remote-history-window.mjs)、[意图门控测试](../../tests/remote-history-auto-load.test.mjs)。不包含插件适配分支。

## 故障恢复

局部呈现错误提供「重新显示」，保留其他区域和输入。页面级渲染错误通过既有草稿保存屏障重新加载，一次性标记恢复同一绑定下的阅读位置。React 边界不覆盖全部异步错误，原插件内部错误仍遵循 SDK 隔离/诊断。

Android onRenderProcessGone 关闭旧桥、销毁失效 WebView，重建可见 Activity；后台页面再次进入时恢复。60 秒内最多自动恢复两次，之后保留原生手动恢复，防止循环。原来源和权限检查保持，不清除数据库、Key 或配对存储，不重放写操作。渲染器突然退出前尚未持久化的输入不能保证恢复。

原生日志仅区分普通聊天/Remote 及 crashed/reclaimed，JS 边界仅记录异常类别，不记录正文和凭据。

## 实际验收与限制

563项Node测试、CI固定rc.2页面构建、Android debug/release构建与对应lint通过；涉及文档1,011处本地链接已核对。

验收后卸载专用rc21test并关闭5556，日常MuMu/5554未变；本次发行没有覆盖安装日常App。此前Linear传输失败已补同步，KKC-89实现与[发行KKC-90](https://linear.app/kkcodes/issue/KKC-90)分别记录实现验收和云端签名/公开下载。

| 路径 | 结果 |
| --- | --- |
| 列表按钮进入 → 连续 24 次历史按钮 | rc.2、alpha.2 产品组件回放通过：每页查阅 120 条，挂载 5 组，约 1,041–1,057 个元素，没有随页数累计 |
| 实时追加、较新记录、失败重试、重连基线 | 通过；旧读取不覆盖最新窗口，控制状态独立 |
| 审批和插件输入 | 同一待审批跨 24 页保留，允许/拒绝各一次原 Gateway 结果；通用输入扩展计数和草稿保留 |
| 超长内置回复、局部异常 | 统一席位分页可翻至下一段；注入异常后可恢复，输入/插件计数保留 |
| 后台任务输出 | 固定测试任务目录作为输入，真实工具事件投影和面板入口验证长ANSI输出分段、DOM预算；不计为电脑任务目录协议验证 |
| Android API 36.1 独立 UID、真实 WebView | 同一路径通过：6 组，约 1,238–1,254 个元素。协议合成，不冒充真实电脑长聊天 |
| Android 渲染进程真实退出 | CDP Page.crash 后自动进入真实 Remote 入口，主进程与同源存储保持。该 UID 未配对，真实连接后的同一聊天/阅读位置恢复尚未实际验证 |
| 外链、文件预览及返回优先级 | 原聊天/Markdown 文件外链、项目文件入口及真实列表/项目返回、弹窗/菜单/插件面板、草稿回归通过 |

用户原长聊天和持续白屏未取得，不保证覆盖全部真机、任意巨型原子记录或第三方组件。原始高压样本与当前合成数据/屏幕不同，不据此声称精确内存节省比例。

来源与重跑入口：

- [数据窗口](../../src/remote-history-window.mjs)、[Session 接入](../../src/remote-sessions.mjs)、[虚拟列表](../../src/ui/RemoteHistoryList.jsx)、[统一节点分页](../../src/ui/RemotePagedNode.jsx)、[阅读位置](../../src/remote-reading-memory.mjs)。
- [错误边界](../../src/ui/RemoteRecovery.jsx)、[原生恢复](../../android/app/src/main/java/dev/dshmobile/validation/RendererRecovery.kt)。
- [连续历史回归](../../scripts/check-remote-history-window.mjs)、[Android 驱动](../../scripts/verify-remote-history-android.mjs)、[窗口单测](../../tests/remote-history-window.test.mjs)。
- `npm test`；`npm run build:web:ci`；`node scripts/verify-remote-plugin-slots.mjs --history-window`；增加 `--official-alpha2` 核验旧 SDK。
- Android 驱动仅允许 emulator-5556/ranchu、dev.dshmobile.validation.rc21test；debug/release 构建及 lint，不签名、不替换日常 App、不发布。
- 本地自动加载专项：`node scripts/verify-remote-history-android.mjs --auto-load`；使用已有隔离 debug APK，注入当前构建的产品组件，实际触摸和共享会话入口回放，不重测无关原生崩溃恢复。
- 报告：`artifacts/remote-history-window-0.2.1-rc.2.json`、`artifacts/remote-history-window-0.2.1-alpha.2.json`、`artifacts/history-white-screen/android-window-report.json` 及同目录 Node/构建/视觉证据，均为忽略产物。
