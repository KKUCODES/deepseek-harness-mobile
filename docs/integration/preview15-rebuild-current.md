# preview.15：以 preview.11 重建

- 状态：本地候选，按用户后续要求提交保存；未推送远端、未触发 Actions、未公开发行。
- 维护：手机端维护者；核验日期：2026-10-27；[KKC-114](https://linear.app/kkcodes/issue/KKC-114)。
- 基线：`v0.1.0-preview.11` / `dbd1e4ec420da404f0eb84efed6fb972818c118d`。当前分支 `release/preview15-from-preview11` 从该提交创建，没有合并旧 `feature/plugin-adaptation`。
- 原本地改动已保存在 `archive/preview14-before-preview15` / `da7c40b`；main 和远端历史不变。

## 用户可见行为

聊天回到 .11 的操作方式：手动「加载更早的消息」，已加载的记录连续查阅；没有「加载较新的消息」操作栏，没有正文「下一段」，不触顶自动加载。普通聊天、模型服务、草稿、审批与系统返回沿用 .11。

选择性保留四项：聊天与 Markdown 文件预览的网页外链；长聊天虚拟渲染与故障恢复；新版 Remote 连接页及首页；脱敏错误栈。用户进一步确认保留独立首页插件的安装、更新、启停、卸载和恢复安装。因此新版首页仍是完整预装包，通过公开 API 加载，未直接编译进宿主页面；其 SDK、通用安装器、租约运行状态和默认回退属于必要依赖。

不修改 DSH、电脑插件或中转。包名、签名和数据存储身份不变，版本 `0.1.0-preview.15` / code25；覆盖安装，不清除聊天、Key、配对或插件安装记录。预装初始化不复活卸载记录、不覆盖用户更新版本。

## 长历史选择与边界

比较两种方案：沿用 .12 的双向有界数据窗口，或保留官方 Session 累积历史、仅限制挂载 DOM。前者能约束更多内存，但增加较新页读取和插件接口转译；本次选择后者，降低行为变化和维护成本，恢复用户要求的连续阅读。

[RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx)仍交给官方 Session 的 `loadOlder()`；[内部确认](../../src/remote-history.mjs)只观察原事件源是否真实 prepend。公开插件看到原 Session/Conversation，不包裹历史代理，不改变官方失败 Promise 行为。失败保留原记录、显示错误并允许重试，重复点击由当前请求与原 loadingOlder 双重保护。

[RemoteHistoryList](../../src/ui/RemoteHistoryList.jsx)使用现有 TanStack 虚拟列表，按原聊天节点分组；只挂载可见组、overscan 及焦点组。已读数据留在原 SDK，组高仅保存数字。前插根据原组身份校正锚点；首次已有历史时从实际 DOM 查找滚动容器，避免子 layout effect 早于父 ref 的空引用。主聊天和旁栏共用同一个组件，编辑器、控制流、审批和会话级插件服务不随虚拟组滚动而重建。

真实MuMu又发现最后一批移除顶部按钮会使scrollMargin变化，原虚拟锚点仍偏移约60 CSS px；已补终页回归并在[原分页位置协调器](../../src/remote-history-position.mjs)按稳定组身份完成三帧像素校正，不使用占位总高度。两SDK终页回归误差小于1px，不恢复旧数据代理或额外操作栏。

**这不是固定内存上限。** SDK 历史数据仍随读取增长，单个巨大 Markdown 节点也没有正文分段；不能保证任意数据规模永不 OOM。离屏消息组件会卸载，第三方组件仅存在 React Hook 内的私有状态不会自动序列化；官方 Session/席位状态和宿主草稿保留。保留局部/页面错误重试、阅读锚点及原生渲染进程退出恢复，但未证明反馈用户原始白屏的唯一根因。

## 验收证据

| 入口与环境 | 本轮结果 |
| --- | --- |
| Node | 577 项通过；含安装管理、外部包校验、预装保持、诊断与阅读锚点 |
| rc.2 / alpha.2 连续历史 | 实际 Workspace＋官方 Session，隔离合成协议；24批后1540事件累积保留，前插误差小于1px；失败不清空、重复点击无重入、已读历史往返不请求较新页、草稿/引用不变、实时追加通过 |
| 同条件 .11 组件对比 | 同一浏览器、SDK、合成数据，最后一批 .11 约40744 DOM、新候选约887 DOM；GC后保留JS堆约64.9MiB→26.6MiB。只替换为公开 .11 Workspace 组件比较，不是完整旧APK或真机峰值内存测试 |
| 外链 | 两SDK：真实消息/思考/工具节点、内置与旧Markdown文件预览入口通过；项目文件与行号仍预览，危险协议不生成可点击外链，浏览器失败可见 |
| 首页插件与返回 | 两SDK：独立动态模块、启停/卸载/重装、默认回退、加载错误重试、断线重连、状态保持、替代插件、主题/原SVG及两种首页真实列表返回优先级通过 |
| 旁栏 | 两SDK：原资源与标签、只读子会话、定向发送、输入接管、草稿/引用交接、输出及导航恢复通过；仅合成协议，不声称本轮调用真实模型 |
| 原生隔离专项 | MuMu：外链URL/Intent/失败拒绝；真实HTTP404与脱敏错误栈；统一安装管理、预装资产、升级不覆盖及卸载不复活通过；专用测试UID/存储 |
| 构建 | 官方 rc.2 Web、Android release/debug/test及 release lint 通过；APK保留原证书、code25 |
| 实际电脑连接与MuMu | 最终原签名code25覆盖安装、原配对连接通过；读取现有50轮真实复杂聊天和56回合回归会话。最终包两次手动前插，末页移除按钮后第07条用户消息仍在y376→378（约1 CSS px），可向前至第一轮、连续滚回第56轮，无较新页控件或白屏；新版首页原SVG/手机浅色、插件页真实运行状态、系统返回和诊断详情/技术栈入口已验 |

原始输出位于本地忽略的 `artifacts/preview15-*.log`、`artifacts/tests/preview15-history/` 和 `artifacts/tests/mobile-interface/`。回归入口：[连续历史与链接/旁栏](../../scripts/verify-preview15-history.mjs)、[首页/管理/主题](../../scripts/verify-mobile-interface.mjs)、[连接界面](../../scripts/verify-remote-design.mjs)。测试数据不进入 APK。

最终本地APK为`artifacts/DSHM-preview15-local.apk`，SHA256 `2f53e77edbe821dab8b64d936975119dbb2d886bc2122475d1a16bb8f0db9a7c`；原证书摘要仍为`ci/release.json`中的值。APK检查确认包含完整预装包，但宿主JS没有直接编译该首页实现，也没有旧历史窗口、自动加载或正文分页模块。

升级后首页插件仍保留原先停用状态；临时启用确认真实运行、新首页显示后，已在插件页恢复停用。最终MuMu停留在该插件详情，现有安装版本0.3.1、外部更新入口和原配对保持。未发送模型消息、处理审批或修改电脑配置。

后续修复与验证分别见[原滚动控制](./remote-scroll-bottom-current.md)、[共用代码块](./chat-code-block-current.md)、[表格横向滚动](./chat-table-current.md)、[图片画廊](./remote-image-gallery-current.md)、[思考过程](./remote-reasoning-current.md)和[连接页插件](./remote-connection-plugin-current.md)。最新本地候选为`artifacts/DSHM-preview15-connection-ui.apk`，原签名code25，SHA256 `1810a3e5fec25dc9c30a4c19e27b384360b992b08280bd1eb6254f2292562143`；580项Node及两SDK专项、最终MuMu原配对和旧聊天读取通过。原0.3.1未被自动覆盖；手动恢复0.4.0后验证启停、卸载及默认待连接页回退，最终保留0.4.0安装与原停用偏好。

用户已授权公开发布，发行构建与匿名下载结果见[发行核验](../releases.md)。不发布r2，不混旧插件适配分支。本轮未声称完整真机性能验收，未在未知第三方插件上证明全生态兼容。
