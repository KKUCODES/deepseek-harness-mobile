# 已执行的验证与限制

- 状态：真实普通聊天、输入插件纯文本能力、实际 Remote 和双模式隔离已通过；页面指标已测，真实中文软键盘仍有环境限制。以下早期分节为历史证据，当前结果见文末。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-09-23。
- 来源：[单元测试](../../tests/local-settings.test.mjs)、[浏览器回归](../../scripts/verify-web.mjs)、本次本机命令输出。

## Web 与服务

环境：Windows、Node.js 24.11.0、Edge headless 136.0.3240.50、412 × 915 CSS 像素。独立验证服务器使用 loopback，不依赖运行中的电脑 DSH 或网关。

| 检查 | 结果与边界 |
| --- | --- |
| `npm run build:web` | 通过，复制 Modules/renderer/locale/theme 原始发布 bundle 及上游 fixture，记录版本与 SHA256 |
| `npm test` | 12 项通过：设置 3 项、输入 3 项、普通聊天流解析/生命周期 6 项；详细覆盖见下方分节与对应测试文件 |
| `npm run verify:web` | 通过：实际主题/字号按钮、语言切换、页面刷新后读回、原样例翻译随语言更新、表单提交、20 次实际卸载/重载 |
| 清理 | 每次卸载 style=0、配置和 overlay 不存在、事件 ping 不再增加；重载 style=1、监听仅增加一次 |
| 视觉 | 已检查生成截图：窄屏无横向溢出。上游样例硬编码深色文字，暗色主题下对比度不足；此样例并非完整移动端 UI，尚未修改其原始 bundle |

完整原始读数和截图由脚本输出到 `artifacts/browser-verification.json` 与 `artifacts/browser-plugins.png`，这些产物不提交。周期时长包含 Playwright 操作等待，**不作为手机插件耗时或性能结论**。

主题插件与上游 `fixture-live-client` 分别通过 20 次卸载/重载；输入提示词源另有 20 次启停测试。完整输入插件会话适配及所有第三方插件尚未覆盖。

## 已解决的接入差异

1. Modules bootstrap 工厂必须从 pendingQueue 取出后再作为预先物化模块传入；否则真实模块系统拒绝重复注册。
2. renderer 根节点固定经过 `session-maybe`；纯设置宿主安装真实“未选中会话” binding，显式拒绝非空 target，不创建假 `ISessions`。
3. 主题不仅是设置状态：复用原 `ThemePresenter` 将快照投影到 DOM，字号变量位于 body。

## Android 环境

载体源码为 Kotlin Activity + WebViewAssetLoader，仅用于读取同一份本地 Web bundle，无网络权限和原生业务桥。参考 [Android 本地内容指南](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)；工具链采用 [AGP 8.7 兼容表](https://developer.android.com/build/releases/agp-8-7-0-release-notes) 对应的 Gradle 8.9/JDK 17/SDK 35。Gradle 下载后核对官方 SHA256。

SDK 中现有镜像为 Android 36.1 Google Play x86_64。创建项目内专用 AVD，不修改用户原有 AVD；首次启动失败：项目盘当时可用约 5921 MiB，镜像要求 7373 MiB。没有清理用户文件或迁移项目。随后用户启动 MuMu，使用其现有实例继续验证，解除 Android 功能运行阻塞。

首次 debug APK 文件大小 5,136,909 字节（约 4.90 MiB），`apksigner verify` 通过；包名 `dev.dshmobile.validation`，minSdk 28、target/compileSdk 35，不含网络权限。`:app:assembleDebug :app:lintDebug` 通过，lint 0 errors / 3 warnings（较旧 WebKit 依赖、备份规则、缺少正式图标）；另有旧 Insets API 编译警告，正式手机实现仍需处理。该 APK 只有插件设置实验，不代表完整应用包体。

## MuMu 实际运行

- 用户授权操控已启动的 MuMu；管理 CLI 返回运行实例 index=2，名称 `MuMu模拟器12-noGP`，ADB `127.0.0.1:16448`。Android 12 / x86_64，报告型号 HBP-AL00 是模拟属性，不视为华为真机。
- APK 安装成功，Activity 冷启动命令返回成功；WebView 110.0.5481.154，页面视口 420 × 867 CSS px，已实际查看设备截图。
- 复用同一个 `scripts/verify-web.mjs`，通过 Playwright Android WebView 接口操作真实 APK：主题/字号/语言切换和刷新持久化、原始插件翻译、配置提交、20 次卸载/重载、style/slot/listener 清理均通过。
- 强制结束 `dev.dshmobile.validation` 并重新启动后，dark、字号 15 和中文设置恢复；运行错误列表为空。只操作本验证包，没有清理设备数据或其他 App。
- 证据产物：`artifacts/android-verification.json`、`artifacts/android-plugins.png`、`artifacts/android-device.png`。设备交互时长不能当作真机性能指标。

## 剩余验收

上述早期验证当时尚缺真实模型、历史、完整输入插件与双模式；这些缺口的后续结果见文末。KKC-14 尚需处理真实中文键盘的环境限制和阶段验收结论，不能把早期已补齐的缺口继续当作当前阻塞。

## 输入增强核心验证

来源：[输入适配层](../../src/input-runtime.mjs)、[界面](../../src/input-validation.jsx)、[边界测试](../../tests/input-runtime.test.mjs)、[共用交互检查](../../scripts/check-input.mjs)。原 Controller、MenuView、locale 和 trigger grammar 从只读上游基线引用，React/store/primitives 强制使用本宿主同一实例，避免上游 tsconfig 将依赖引回另一套 workspace。

| 场景 | 结果 |
| --- | --- |
| 中文候选和回车 | Web 与 MuMu 中 `/总` 选择和 `/tra` 回车插入成功，经过原控制器和真实 Cordis 事件 |
| 旧草稿保护 | 捕获原控制器的旧 span，编辑新草稿后重放实际写事件；返回拒绝且新内容保持。单测另覆盖非法范围和组合态拒绝 |
| 源启停 | 实际按钮重复 20 次，停用后菜单消失、lexicon 订阅为 0；启用后为 1，无重复订阅 |
| 迟到结果 | 单测中移除源后再完成候选请求，菜单不复活；销毁后旧控制器不能继续修改草稿 |
| 组合输入协议 | Edge 与 MuMu WebView 均执行 CDP `Input.imeSetComposition` + `Input.insertText`；组合期间不弹候选，提交后正常选择，不重复文字 |
| 真实 Android 软键盘 | 未通过。MuMu 当前 Sogou IME 报告已显示但窗口高度为 0；新进程原生 EditText 对照同样复现，详见下方环境诊断。未更改用户 IME 或模拟器设置；CDP 结果不能替代这项 |

页面全链路最初复现 `/总` 变成 `/总总`；调整为浏览器拥有组合输入中的 DOM，适配层仅在插件插入或清空时回写 value/selection，完整流程通过。上方候选菜单曾遮挡启停按钮，已把验证动作放到输入框下方并通过实际点击。

本地提示词源是明确标识的验证源，草稿只存在于本页内存，不冒充聊天历史持久化。没有装配原 InputTriggerService、完整 Session 或 Agent 命令。结果保存在 `artifacts/browser-verification.json`、`artifacts/android-verification.json` 的 `input` 字段；其中 `imeMethod` 明确标注协议模拟范围。

## 普通聊天流协议与请求生命周期

来源：[实现](../../src/ordinary-stream.mjs)、[6 项测试](../../tests/ordinary-stream.test.mjs)、[真实界面检查](../../scripts/check-stream.mjs)、[公开协议依据与实现边界](./local-services.md#已实现的流协议部分)。使用明确标记的人工协议夹具，没有调用模型或读取用户 Key。

| 验证层 | 实际结果与限制 |
| --- | --- |
| Node 字节/状态测试 | 逐字节 UTF-8 中文/emoji；BOM、CR/LF/CRLF、注释、多 data 行；未终止尾事件、缺失 DONE/finish_reason；HTTP 错误、非法 JSON/编码/usage、超大事件；正文与推理分离；所有已知结束原因；工具调用拒绝 |
| 请求生命周期 | 等待响应时停止、读流中销毁、关闭迟到响应、禁止复用请求实例；后续请求不受旧请求影响。只证明内存请求归属，不代表双 WebView 安全隔离 |
| 本机真实 HTTP | Node fetch 读取 loopback SSE；完整结束通过，停止时服务端观察到连接关闭。服务端内容是夹具，不是 DeepSeek API |
| Edge 与 MuMu 界面 | 实际点击完整回放、断流、等待后停止；分别得到 completed / interrupted(stream_closed) / interrupted(stopped)，正文与推理一致且按钮状态恢复。原插件与输入回归、MuMu 重启设置恢复同时通过 |
| Android 构建与显示 | 更新 APK 构建并安装成功；原生截图 `artifacts/android-stream-device.png` 已核对，按钮换行且无横向溢出。MuMu 字体将测试 emoji 显示为缺字框，DOM 字符与逐字节解码正确，字体显示问题未解决 |

发现 `eventsource-parser@3.1.0` 在 EOF 前保留末尾 CR 等待 LF：仅在实际以 CR 结尾时补配 LF，让已有换行结算；不会给其他尾片补事件结束符。测试覆盖 `data: [DONE]`、单 LF、单 CR 尾片都不能被误判完成。

原始结果在 `artifacts/browser-verification.json`、`artifacts/android-verification.json` 的 `stream` 字段，明确标注离线 SSE 回放。MuMu 的 CDP fullPage 长截图出现重复拼接，因此本次新增界面以原生 device screenshot 核对。没有模型性能或真实网络性能结论；Android 仍无联网权限和业务桥。

## 主题插件实际卸载与恢复

来源：[宿主生命周期装配](../../src/main.jsx)、[主题实际操作检查](../../scripts/check-theme.mjs)、原始 `ui-theme` 发布 bundle 与只读上游 `ThemePresenter`。Edge 和 MuMu 均通过同一组 20 次实际按钮操作，APK 已重新构建并安装。

验证页根节点不再强依赖 theme 服务；另一个真实 Cordis 插件依赖 theme，负责创建、订阅和释放原 `ThemePresenter`。主题卸载后根页仍能操作重新加载，没有补假服务，也没有修改上游插件 bundle。

- 卸载后主题 style 节点由 8 变为 0，外观/字号设置项移除；语言设置仍可用。
- presenter 拥有的暗色属性、主题来源、color-scheme、字号变量和 theme-color meta 均清理；重载恢复为 8 个 style、1 个 meta，深色/15px 设置不丢失。
- 20 次循环后 presenter mounts=21、disposals=20；每次浅色/深色设置变更分别只触发 1 次 DOM 投影，没有叠加更新监听。该检查不是完整内存泄漏检测。
- 根页中的草稿文本、离线流正文和中断状态保持不变；设置变更、原样例、输入和流检查均通过，MuMu 强制结束 App 后设置恢复仍通过。
- 原始结果位于两份 verification JSON 的 `theme` 字段。已核对模拟器原生截图 `artifacts/android-theme-unloaded.png` 与 `artifacts/android-theme-restored.png`；卸载后基础样式与恢复后的暗色界面均可操作。原生截图可能滞后 DOM 一帧，视觉核验使用最终稳定帧。

仍不能将此结果扩大为全部插件兼容、真实流式期间卸载或真机性能通过。

## 真实软键盘环境诊断

来源：[debug 原生输入框](../../android/app/src/debug/java/dev/dshmobile/validation/NativeInputProbeActivity.kt)、[可重复诊断脚本](../../scripts/diagnose-ime.mjs)、[Android 官方输入法显示条件](https://developer.android.com/develop/ui/views/touch-and-input/keyboard-input/visibility)。原生对照等待窗口焦点后请求软键盘，采用 adjustResize；不加载 WebView/DSH，不联网、不保存输入。每次对照前结束本 App，再从新进程直接启动原生 Activity，排除 WebView/插件的进程内状态。

重复诊断结果：

- MuMu Android 12；当前且唯一已列出的 IME 为 `com.sohu.inputmethod.sogou.chuizi/com.sohu.inputmethod.sogou.SogouIME`；`show_ime_with_hard_keyboard=1`，本次未修改。
- WebView 和原生 EditText 都有 `mShowRequested=true`、`mInputShown=true`、`mIsInputViewShown=true`；每次输入法与其当前目标 App 位于同一 display。
- 两种输入框的键盘 `mFrame=[0,1624][786,1624]`，实际高度为 0，App 仍占 786×1624；WebView visualViewport 约 867.2 CSS px，未缩小。原生截图同样没有键盘。
- 因此当前现象不是 DSH 插件/React 特有的问题，也不是已观察到的跨屏错位；更深层的 MuMu/IME 配置原因尚未确定。没有证据支持通过修改 WebView 布局修复零高度输入法。
- MuMuManager 的实际 CLI 帮助与实例设置没有提供已核实的软键盘显示开关。没有猜测配置键、切换默认输入法、清理输入法数据或安装第三方 APK。

脚本输出 `artifacts/ime-diagnosis.json`、`ime-webview.png`、`ime-native.png`；`keyboardGeometryPassed=false` 时故意返回非零，不得据此报告键盘验收通过。它只检验正高度可见窗口，不能替代真实中文组合输入、候选选择、避让/返回及性能验收。结束后关闭对照进程并恢复验证页，避免调试 Activity 留在返回栈；持久设置保留。

debug APK 构建与 lint 通过（0 errors / 3 原有 warnings）；已核验 release 合并 manifest 不包含 `NativeInputProbeActivity`。本次没有修复一个已证实的 App 键盘缺陷，而是建立了设备环境前置检查；后续需要可实际显示的安卓中文输入法或目标真机，再运行原生对照和 WebView 组合输入验证。

## 阻塞与恢复条件

**下述为已解除的历史阻塞。** 用户后续已明确自己的 DeepSeek Key、手机直连、本地历史，并将性能改为页面指标合理区间，不再要求目标真机。当前实现与结果见下一节，不得再次索要已经确认的路线/设备前置选择。

2026-09-22 完成审计依据：当前源码/manifest、上述真实运行产物、`adb devices -l` 与 Linear KKC-14。依赖矩阵和服务契约已有文档；Android 目前实际运行的是有限插件、草稿与协议实验，未实现模型凭据/请求桥、持久聊天历史或完整双模式。因此第三步未完成，第四步只有测量计划，不能给出最终外壳结论。

以下前置条件已连续多轮未获得答复；模块/设置/输入核心/流协议/主题生命周期及键盘诊断已先行推进。本轮没有重跑这些已通过的检查，也不新增替代真实目标的样例，自动目标记为受阻，保留完整范围。

| 待补输入 | 影响 | 恢复后的第一步 |
| --- | --- | --- |
| 普通聊天采用手机持有用户 Key、手机直连、本地历史，还是后端请求及其他存储归属 | 凭据处理位置、平台请求桥、历史服务、完整会话插件适配与数据隔离的具体实现 | 根据确认的数据流实现安全配置入口与真实 transport/存储，再进行真实模型和隔离验证；不用现有 DSH Key 代替授权 |
| 目标安卓机型号与 USB 调试连接条件 | 真机键盘、长聊天/流式/内存/包体对照；当前 ADB 仅连接 MuMu | 接入实际目标机，先检查原生输入，再运行完整验收和性能对照。MuMu 零高度 IME 问题不能用 CDP 模拟结果关闭 |

当时无需把 Key 发进聊天；Linear KKC-14 保持 In Progress。本段只记录历史暂停原因，不代表当前范围和状态。

## 手机直连、本地历史与页面指标

用户确认的数据流已落地为技术验证入口：普通聊天使用原生 Key 配置、固定 DeepSeek HTTPS 请求桥和 IndexedDB 历史。入口位于插件验证页顶部，支持新聊天、发送、停止、草稿/历史恢复与删除；当前纯文本，尚未接入完整输入插件或实际 Remote 页面。

已执行证据：

- Node 共16项通过，新增 native transport 字节转接、缺 Key、取消期间迟到响应和普通/Remote 上下文拒绝测试；这些替身测试不算真实 API。
- Edge/MuMu 同一实际 UI 测试通过：专用草稿刷新恢复、合成未完成轮次标记 `app_restarted` 且保留部分文本、删除当前历史。只清理本次专用样例，不清空用户库。
- MuMu 原生桥实际拒绝 `key.read`、任意 URL 字段、未知模型和缺 Key 请求；同源子框架得不到响应。`key.status` 只返回 configured。原始证据为 `artifacts/android-verification.json` 的 ordinary 字段；不是实际 Remote 双模式安全验收。
- 独立 Android instrumentation 在 MuMu 测试真实 Keystore：加密读回、同内容不同 IV、重新实例读回、篡改拒绝、删除通过；专用测试别名，不读取用户 Key，不联网。源文件为 `OrdinarySecurityInstrumentation.kt`。
- 原生窗口通过真实打开/取消检查，密码输入字段、保存/移除按钮可用。修正 `setSingleLine` 覆盖密码 transformation 的初始化顺序，复测 password=true；测试前后均未配置真实 Key。读数 `artifacts/native-key-dialog.json`。
- APK 构建/lint 通过（0 errors / 2 warnings：固定 WebKit 版本、正式图标）；debug APK 5,999,736 字节，不代表正式产品最终包体。原生桥错误不透传上游正文，Key 不返回页面。限制见[原生接入边界](./ordinary-native.md)。

页面实验（三次/组，Edge 独立存储复测无 Lighthouse warnings）：

| 环境与插件 | FCP 中位/最差 ms | LCP 中位/最差 ms | TBT 中位/最差 ms | CLS 中位/最差 |
| --- | --- | --- | --- | --- |
| Edge 136，关闭可选插件 | 44.7 / 60.4 | 501.0 / 504.5 | 182.1 / 184.5 | 0 / 0.0861 |
| Edge 136，开启可选插件 | 45.9 / 52.2 | 566.3 / 588.1 | 206.9 / 223.3 | 0.0861 / 0.0861 |
| MuMu WebView 110，关闭可选插件 | 51.2 / 82.0 | 583.5 / 635.2 | 未测标准 TBT | 0 / 0.0900 |
| MuMu WebView 110，开启可选插件 | 59.5 / 106.5 | 657.0 / 700.9 | 未测标准 TBT | 0 / 0 |

加载指标未见明显瓶颈；Edge 开插件 TBT 略高于200ms良好参考线，按用户“合理区间”的要求记录为轻微优化空间，不称全部指标严格达标。当前只是技术验证页、空聊天、本地资源与模拟器/桌面实验；不能推出长历史、真实模型输出或正式产品性能。原始报告位于 `artifacts/performance/`，方法见[性能计划](./validation-plan.md)。

用户随后已在设备内配置 Key，真实收发结果见下节。仍需完整输入插件与实际双模式隔离；以上完成不等于四步全部完成。

## 真实 DeepSeek 三轮与进程恢复

2026-09-22，用户保存 Key 后，实际操作 MuMu Android 12 中的普通聊天入口，新建专用会话 `a839d793-bce3-48e6-a89e-e37de7d36c53`，仅使用其测试内容。没有读取、输出或重新配置 Key。

- 第一轮 `deepseek-flash` 实际返回 `DSHM_LIVE_1790090019145`，状态 completed，收到 finish_reason=stop 和 usage。
- 第二轮只问上一条标记，没有在新提示词重复标记；模型正确回忆，验证历史上下文实际传给 API。
- 第三轮请求长输出，观察到49次可见文本增长。生成仍在进行时卸载/重载真实主题和上游样例；根聊天保留且流继续。恢复后样式数量一致、运行错误为空。
- 点击真实停止按钮后，保留177字符，终态 interrupted/stopped；等待2秒再读取同一记录，内容/状态不再改变。仅证明客户端取消和停止接收，不推断服务商内部计算或计费状态。
- 强制结束本 App 后重新打开，三轮记录逐字段与停止后的存储完全一致，当前会话恢复，Key 仍显示 configured。测试聊天保留，供用户查看。

可重复脚本：[verify-live-ordinary.mjs](../../scripts/verify-live-ordinary.mjs)。需显式 `DSHM_RUN_LIVE=1`，防止默认回归触发真实 API 费用。证据：`artifacts/ordinary-live.json`、`artifacts/ordinary-live-device.png`。此前合成协议/恢复测试与本节真实模型证据分别记录；当时尚缺输入插件和双模式的后续验证见下节。

原生截图同时发现真实长标题会撑出历史选择框并扩大布局 viewport（440px）。补充下拉框宽度限制，重建 APK 覆盖安装后，同一真实会话 viewport/document 均恢复420px，下拉框右边界383.73px在卡片400.27px之内；三轮历史和 Key 配置保留，未再次调用模型。修复后截图 `artifacts/ordinary-live-layout-fixed.png`，报告 layoutFix 字段；非正式 UI 设计变更。

## 原输入入口与实际双模式联调

2026-09-22 晚至09-23，继续使用同一 MuMu、真实电脑 DSH 和本地网关，没有修改上游检出。

| 实际入口 | 已验证结果 | 证据 |
| --- | --- | --- |
| 普通聊天输入框 | 原入口/服务/菜单插槽、中文/英文候选、真实草稿刷新恢复；拒绝旧 revision 和旧聊天上下文；源与插件各5次卸载重载，无残留订阅 | [共用页面检查](../../scripts/check-ordinary-input.mjs)，Web/MuMu verification 中 ordinary.inputPlugin |
| 输入插件 → 模型发送 | `/translate` 插入后追加 Hello, world!，实际回复“你好，世界！”；发送后卸载重载输入插件，历史保存 completed、草稿清空 | [实际 API 脚本](../../scripts/verify-live-input.mjs)，artifacts/ordinary-live-input.json；仅1次新 DeepSeek 请求 |
| Remote 配对 | 原生 Keystore P-256 签名经真实网关验证；未批准时403，用户批准后连接成功 | artifacts/mode-isolation.json、remote-live.json |
| Remote 读/写 | 读取真实任务和此前联调聊天，在同一测试会话发送限定回复消息；安卓与电脑均看到 DSHM_ANDROID_REMOTE_1790092594488 | [真实脚本](../../scripts/verify-live-remote.mjs)、电脑浏览器可见记录 |
| 断线与重启 | 重新连接/跟随后标记只出现一次；强制结束 App 后配对指纹不变并能重连；普通 Key 仍已配置 | artifacts/remote-live.json |
| 模式隔离 | origin 与原生桥独立；Remote 不见普通 IndexedDB、localStorage 哨兵，互调对方操作拒绝；普通专用测试记录在远端操作前后哈希一致 | [隔离脚本](../../scripts/check-mode-isolation.mjs)、两个真实链路报告 |
| 撤销 | 用户授权测试后撤销该设备；现有连接关闭、记录清空，再连接401；本机测试 Remote 凭据已移除 | remote-live.json 的 revocationVerified/localTestCredentialRemoved |

技术限制：[Remote 边界](./remote-native.md)。此结果证明代表性输入插件与两种实际业务链路能共存，不等于完整 DSH 插件体系、所有消息投影或正式产品已交付。真实中文键盘仍未通过，CDP 组合协议测试不替代该项；正式外壳、UI、Remote 插件与工作区内新聊天另行推进。

最新构建与收尾：Node 18项通过；APK assemble/lint通过，0 errors / 2 warnings（依赖版本、正式图标）。调试 APK 10,162,369 字节，约9.69MiB，新增包含 OkHttp/Nimbus 的原生 Remote 能力；不是 release 包体预测。覆盖安装后复查输入插件卸载/恢复、诊断菜单独立字典、Remote 已清理状态、非法链接拒绝、普通 Key 状态与窄屏布局，见 `artifacts/final-entry-smoke.json`。上游 `git status --short` 仍为空。

2026-09-23 页面复测，MuMu 保留实际测试历史，未清理用户数据。可选项仍是主题/上游样例开关，原输入插件在两组都加载。开启组 FCP 中位/最差46.5/68.3ms、LCP650/663ms、CLS0；关闭组 FCP94.5/139ms、LCP637.9/688.9ms、CLS0.1854。关闭组存在历史加载阶段布局跳动的优化空间，不称所有状态都达到CLS≤0.1；默认开启状态没有该次跳动。未测标准 MuMu TBT，原始文件 `artifacts/performance/android-page.json`。

Edge 136/Lighthouse 13.5.0 最终单独复测（三次/组，无并行构建）：开启组 FCP46.4/46.6ms、LCP532.5/539.5ms、TBT196.6/198.2ms、CLS0.0902；关闭组 FCP41.1/59.4ms、LCP561.9/614.7ms、TBT248.1/248.6ms、CLS0.0902，均为中位/最差。默认开启组落在参考范围，关闭组 TBT 有轻微优化空间；不能从少量本地样本推断插件使页面更快。最终报告 `artifacts/performance/summary.json` 替换了此前与构建重叠的初次复测；以前表格保留为当时的历史结果。新 APK 验签成功，44份 Markdown/438个本地链接校验通过。
