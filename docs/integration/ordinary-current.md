# 普通聊天真实接入状态

- 状态：普通聊天 L01–L08 已接入并完成本地验收；完整 Remote 产品及 Android 综合体验仍按后续批次推进。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-09-23。
- 范围：用户要求普通聊天完整真实接入；对应 [KKC-15](https://linear.app/kkcodes/issue/KKC-15) 与 [KKC-16](https://linear.app/kkcodes/issue/KKC-16)，覆盖 L01–L08。

## 当前入口和边界

Android 默认进入 `mobile.html`，应用名 DSHM；沿用 `dev.dshmobile.validation` 和原 ordinary origin，避免另建来源导致 Key 或历史不可见。debug 包可用启动参数 `--ez diagnostics true` 进入独立技术验证页；正常启动不带参数。Web 审阅入口为 `http://127.0.0.1:4399/mobile.html`，浏览器不能直接调用原生 Key 或模型桥。

确认过的预览继续在 4400，复用 `src/ui` 的输入框及样式；示例 reducer 不接网络。普通聊天正式页面为 [OrdinaryApp](../../src/OrdinaryApp.jsx)，会话服务为 [OrdinarySession](../../src/ordinary-session.mjs)，实际插件宿主为 [plugin-host](../../src/plugin-host.jsx)。Remote 仍是独立来源和 Activity，本轮不把协议验证页宣称为完整 Remote 产品。

## 已实现与已验证

| 能力 | 实现 | 本轮证据 / 尚未完成 |
| --- | --- | --- |
| Key、直连、思考、多轮、停止 | 固定 DeepSeek HTTPS 原生桥，网页不读取 Key；请求归属固定，下一条内容只保存草稿 | 当前 MuMu 默认入口真实 API 通过：思考内容、精确标记回复、上下文、停止、草稿保留；[验收脚本](../../scripts/verify-product-android.mjs) |
| 历史、搜索、分页、分支 | IndexedDB v1 → v2 增加复合索引；不重建数据库；按会话持久模型/思考，支持分页、改名、分支 | 实际入口搜索、重启、重新生成、编辑分支、保留原回复、改名和删除专用分支通过；[回复验收](../../scripts/verify-product-replies.mjs)。[分页验收](../../scripts/verify-product-history-ui.mjs)在隔离 Edge 的正式页面检查 85 条聊天、65 轮历史及搜索分页；[数据测试](../../tests/ordinary-history.test.mjs)覆盖迁移与边界 |
| 写入和请求竞争 | 草稿保存成功后才联网；写入失败重试使用屏幕草稿；合并流分片写入；退出前保存终态 | [会话测试](../../tests/ordinary-session.test.mjs) 覆盖切页归属、快速输入、写失败、预备阶段停止、退出保存 |
| 手机插件 | 原 Cordis/Slots 宿主，随包目录真实启停/卸载/重装；失败恢复运行配置；提示词实际服务配置 | 正式页面 Web/MuMu 输入插件卸载重装、草稿保留、配置新增提示词实际插入通过；MuMu 排版插件卸载为原文、重装恢复真实代码和公式通过。[本地验收](../../scripts/check-product-local.mjs)、[排版与配置](../../scripts/verify-product-rendering.mjs)；失败回滚由真实生命周期依赖测试覆盖 |
| 附件 | 系统单文件授权，JPEG/PNG/GIF/WebP 与 UTF-8 文本，真实消息内容，不读取任意路径 | [实际系统选择与模型验收](../../scripts/verify-product-attachments.mjs)通过：识别红色测试图及只在文本文件中的独立标记；切到 Pro 后明确拒绝含图历史，无新增请求；格式边界有[测试](../../tests/ordinary-attachments.test.mjs) |
| 备份、统计、清理 | 版本化白名单格式，整批校验、去重、冲突事务回滚；系统导入/导出入口，保留凭据 | MuMu 实际导出、重复导入去重、[新记录及草稿恢复](../../scripts/verify-product-restore.mjs)、非法格式拒绝、[缓存清理保留 Key/历史](../../scripts/verify-product-backup.mjs)通过；清空的取消/确认只在隔离浏览器夹具执行，不清用户手机历史；冲突回滚有数据库测试 |
| 语言、主题、排版 | 本地语言作用于正式页面；复用原 theme/locale 服务，DSH Markdown 渲染插槽、代码与公式 | Web 375×667 与 MuMu 全局中英文/深色/恢复设置通过；真实 Pro 回复标题、代码、公式、复制代码/回复及系统分享窗口通过。分享验收只打开窗口，未发送给他人 |
| Android 升级和安全边界 | APK versionCode 2，不卸载、不清 App 数据；默认入口改造保留来源 | assembleDebug / lintDebug、真实 Keystore 独立别名加密/重开/篡改拒绝通过；本轮覆盖安装保留 Key 与 4 条记录哈希；[正式桥边界](../../scripts/verify-product-boundaries.mjs)验证非法请求拒绝、无 Key/剪贴板读取、普通/Remote 来源和能力隔离 |
| 模型与回复参数 | Flash / Pro，思考开关；按聊天保存、每轮快照参数 | Pro 真实调用使用 512 Token 上限与 0.2 随机性；Flash 思考真实调用通过。参数范围/类型/未知字段/旧轮快照/备份由[参数测试](../../tests/ordinary-options.test.mjs)、[会话测试](../../tests/ordinary-session.test.mjs)及真实原生拒绝检查覆盖 |

真实 API 的输出证据在本地 `artifacts/ordinary-product-android.json`、`ordinary-replies-android.json`、`ordinary-attachments-android.json` 与截图。脚本只使用专用测试聊天，保留用户其他记录。当前实例由用户在原生窗口配置 Key；不记录 Key。本轮默认单元测试 59 项通过，另有真实 Android、正式页面及旧诊断宿主回归；预览测试的通过不替代正式入口验证。

复制通过[平台适配](../../src/ordinary-clipboard.mjs)复用同一个原生消息分发器，防止复制期间覆盖生成请求的回调。代码块仍使用原 DSH 组件；构建时只替换剪贴板写能力，上游检出未修改。不提供原生剪贴板读取接口。

## 插件来源和兼容范围

当前手机目录只提供三个随包核验组件：[PhonePlugins](../../src/phone-plugins.mjs)。输入提示词与外观主题来自上游 `0.1.6-alpha.2`；聊天排版是本地 `0.1.0` 插槽插件，直接复用只读上游 Markdown 组件。包代码随 App 更新，实际版本按当前打包代码显示；安装、卸载与启停状态保留。不能显示旧版本却运行新代码，也不宣称任意 npm/Host 插件已兼容。电脑插件在独立 Remote 环境，本地管理不变更电脑配置。

## 模型与文件依据

2026-09-23 核对 [DeepSeek 模型能力](https://api-docs.deepseek.com/quick_start/pricing/)、[思考参数](https://api-docs.deepseek.com/guides/thinking_mode/)、[图片输入](https://api-docs.deepseek.com/guides/vision/) 和 [Files API](https://api-docs.deepseek.com/guides/files_api/)：普通聊天使用 `deepseek-flash` / `deepseek-v4-pro`；图片仅 Flash；不把通用文件当成可直接上传理解的模型输入。采用内联图片与 UTF-8 文本内容，不上传 PDF/Office 等未解析格式。

App 当前每消息最多 4 个附件，图片每个 4 MiB、尺寸最高 8192，文本最多 100,000 字符；图片限制比服务端更保守。文件由 [OrdinaryFiles](../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryFiles.kt) 经 Android SAF 单次选择，不授予整目录访问。备份最大 32 MiB；没有提供“分批导出”按钮，因此超限文案不承诺此功能。

回复参数依据 [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)：输出上限 1–393216，留空使用 App 默认的普通 8192 / 思考 16384；随机性 0–2 只发送于非思考模式；思考强度 low/high/max 与 top_p 0.95–1 只发送于思考模式。历史保留当时参数，修改只影响之后的新请求。该范围是核验日支持能力，不表示字段永远有效。

## 性能、验证边界与后续批次

### 当前正式入口复测（2026-09-27）

- 状态：现有日常APK的普通聊天首屏达到既有实验参考范围，不能外推完整Remote性能。维护角色：项目协作Agent；核验2026-09-27。来源：[Android测量脚本](../../scripts/measure-product-android.mjs)、[MuMu最终报告](../../artifacts/ordinary-product-performance.json)、[独立Edge最终报告](../../artifacts/performance/product-summary.json)、[既定标准](../plugin-validation/validation-plan.md#当前性能验收)。
- MuMu三次真实mobile.html reload，保留用户历史和插件：FCP中位37.0/最差38.4ms，LCP中位700.0/最差717.5ms，CLS均0；超过50ms长任务的超额合计中位381/最差412ms，不是标准TBT。当前正常debug APK为12,237,334字节，约11.67MiB。
- Edge136/Lighthouse13.5.0独立临时profile、移动视口、本地资源、不额外节流，三次FCP中位56.293/最差64.84ms，LCP中位538.847/最差641.228ms，TBT中位177.069/最差178.524ms，CLS均0，无runWarnings，withinReference=true。报告代表当前实验条件，不将与旧版本的差异单独归因于某项代码优化。
- 首组两环境测量同时启动，可能竞争CPU；[初次Android](../../artifacts/product-performance-overlap-android.json)与[初次Edge](../../artifacts/product-performance-overlap-edge.json)保留但不用于最终结论。最终先完成MuMu、再运行Edge三次，中间没有构建或其他UI验收。Android脚本改用精确PID的WebView入口，明确选择普通聊天页面，结束后通过抽屉返回原Remote；原生前台状态已核对。未发送模型消息、清理用户数据或修改Key/绑定/授权。
- 性能要求仍是用户确认的合理区间；200ms是优化参考，不把单次轻微波动当失败。本次更新普通聊天首屏及包体，Remote长历史/实时插件的渲染证据继续见[完整矩阵](./remote-current.md#完成矩阵)，中文软键盘等其他A03–A06缺口保持。下段保留较早版本历史记录，不能继续作为当前APK首屏或包体结论。

[正式页面 MuMu 测量](../../scripts/measure-product-android.mjs)最终分包 APK 三次 reload：FCP 37–45 ms，LCP 711–811 ms，CLS 0，观察期超过 50 ms 的长任务超额合计 395–470 ms；后者不是 Lighthouse TBT。APK 8,294,167 字节（约 7.9 MiB）。构建保留原语法库的动态加载，并在 Android 验证代码/公式加载及插件卸载恢复。标准 Lighthouse 通过 `node scripts/measure-page.mjs --product` 测得 FCP 60–91 ms、LCP 831–1195 ms、CLS 0、TBT 354–500 ms；TBT 高于内部 200 ms 参考线，保留到 KKC-20 优化。报告在 `artifacts/performance/product-summary.json`。这些是本地 assets、无限速的模拟器/独立 Edge 数据，不是真机冷启动或模型延迟，不能宣称全部性能参考指标通过。

- 正式输入框通过 CDP 中文组合输入、提交后提示词候选及 Enter 换行；真实系统中文软键盘此前 MuMu 高度为 0 的限制仍保留，归 Android 综合验收 KKC-20。用户不要求新增真机或公网部署前置条件。
- 当前 MuMu 16384 初始无旧安装，旧实例 16448 不可连接；本轮后续 APK 覆盖安装已验，历史旧 schema 迁移有数据库测试，不能宣称已在不可连接实例上做过升级。
- 401/402/429/断流/写入失败由受控错误与协议测试覆盖，未修改用户真实 Key 或故意耗尽额度来制造上游错误；独立 Keystore instrumentation 不读取用户凭据。
- 完整 Remote、电脑插件/资源通道、远程审批文件及通知等继续归 KKC-17–20；本文件完成仅指普通聊天范围，不代表整个 DSHM 首版已完成。
