# Remote 长聊天窗口与恢复

- 状态：2026-10-24 本地验收完成，纳入 preview.12/code15 发行候选；云端构建与公开下载待验证。preview.11 不包含本轮修复。
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

## 故障恢复

局部呈现错误提供「重新显示」，保留其他区域和输入。页面级渲染错误通过既有草稿保存屏障重新加载，一次性标记恢复同一绑定下的阅读位置。React 边界不覆盖全部异步错误，原插件内部错误仍遵循 SDK 隔离/诊断。

Android onRenderProcessGone 关闭旧桥、销毁失效 WebView，重建可见 Activity；后台页面再次进入时恢复。60 秒内最多自动恢复两次，之后保留原生手动恢复，防止循环。原来源和权限检查保持，不清除数据库、Key 或配对存储，不重放写操作。渲染器突然退出前尚未持久化的输入不能保证恢复。

原生日志仅区分普通聊天/Remote 及 crashed/reclaimed，JS 边界仅记录异常类别，不记录正文和凭据。

## 实际验收与限制

563项Node测试、CI固定rc.2页面构建、Android debug/release构建与对应lint通过；涉及文档1,011处本地链接已核对。

验收后卸载专用rc21test并关闭5556，日常MuMu/5554未变。此前Linear传输失败，发布阶段已补同步并关闭KKC-89；[发行KKC-90](https://linear.app/kkcodes/issue/KKC-90)独立跟踪云端签名与公开下载。

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
- 报告：`artifacts/remote-history-window-0.2.1-rc.2.json`、`artifacts/remote-history-window-0.2.1-alpha.2.json`、`artifacts/history-white-screen/android-window-report.json` 及同目录 Node/构建/视觉证据，均为忽略产物。
