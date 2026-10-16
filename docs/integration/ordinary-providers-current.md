# 普通聊天：自定义供应商与模型

- 状态：已接入并完成本地验收；正在准备 `0.1.0-preview.5` 签名发行，preview.4 不含该功能。
- 维护角色：DSHM 手机端维护者。
- 最近核验：2026-10-15。
- 需求与验收：[KKC-63](https://linear.app/kkcodes/issue/KKC-63)。只修改手机端，不修改 DSH、电脑插件或中转。
- 使用步骤：[供应商配置](../usage.md#自定义供应商与模型)。此前固定 DeepSeek 的接入事实保留在[原普通聊天记录](./ordinary-current.md)。

## 选择与边界

只开放一个可编辑地址虽然成本较低，但会让原 DeepSeek Key、默认模型和已有聊天共用会变化的请求目标。本次采用独立供应商目录：每个供应商持有地址、模型列表和自己的原生凭据；聊天保存供应商 ID 与模型 ID。维护成本增加一份小型原生目录，但可以保留旧配置，并防止同名模型和不同站点的 Key 混用。

普通聊天使用 OpenAI Chat Completions 兼容的 `POST <baseURL>/chat/completions` 和 SSE；模型数据从手机直接发送到所选服务，不经过 DSHM Remote 中转。支持文本、多轮和按声明启用的内联图片；不提供工具调用、Responses 或 Anthropic 协议。仅“兼容 OpenAI”名称不足以保证所有模型的扩展字段都兼容。

供应商最多 30 个，每个最多 50 个模型。模型可设置显示名、图片能力、思考字段、输出上限字段以及是否发送随机性参数；没有自动获取模型目录或通用自定义请求头。

| 模型设置 | 请求行为 |
| --- | --- |
| 默认兼容配置 | 只发送 `model`、`messages`、`stream`。显式填写输出上限时才添加上限字段。 |
| `thinking.type` | 按聊天开关发送 `enabled` / `disabled`；只用于确实接受这两个值的服务。 |
| `reasoning_effort` | 开启自定义强度时发送 `low` / `high`；关闭时省略该字段，使用服务端默认思考，不代表强制关闭模型思考。 |
| 输出上限 | 在 `max_tokens` / `max_completion_tokens` 中选择；自定义服务留空时不发送，具体范围由服务校验。 |
| 随机性 | 只有模型允许、设置已保存且未开启自定义思考时才发送 `temperature`。默认不发送。 |
| 内置 DeepSeek | 保持原 Flash / Pro 能力、`thinking.type`、思考强度与默认输出上限行为。 |

所有服务统一使用「添加供应商」表单，没有指定厂商的添加按钮。验收时智谱使用官方 `https://open.bigmodel.cn/api/paas/v4`、`glm-5.3` 和 `reasoning_effort`，不发 `thinking.type: disabled`。[GLM-5.3 官方文档](https://docs.bigmodel.cn/cn/guide/models/text/glm-5.3)明确该模型始终思考。通用输出字段参考 [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)，内置参数沿用 [DeepSeek 文档](https://api-docs.deepseek.com/api/create-chat-completion/)。核验日期见页首，不承诺未来所有模型保持这些能力。

## 配置、凭据和请求归属

- [OrdinaryProviders](../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryProviders.kt)使用 `AtomicFile` 将版本化配置保存在原生 `noBackupFilesDir`，网页只取得公开目录与是否配置 Key。
- 凭据复用原 [OrdinaryCredentials](../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryCredentials.kt) 的 Android Keystore / AES-GCM。内置 DeepSeek 别名 `dshm.ordinary.deepseek.v1` 保持；自定义供应商使用不同的 `p-UUID` 别名。旧 Key 不解密迁移、不复制到网页或其他供应商。
- API 地址只允许 HTTPS，拒绝地址内认证信息、查询、片段和路径穿越；填写基础地址，不含 `/chat/completions`。更换地址时，若旧 Key 仍存在，原生拒绝保存；用户须先显式移除旧 Key。
- 网页请求只传供应商 ID、模型和配置修订号，不能指定临时 URL、Key 或 Authorization。原生重新解析目录并固定该次请求的供应商快照；过期修订号拒绝。生成期间不能修改供应商或凭据，HTTP 重定向不跟随。
- 供应商增改删和默认选择仅开放给正式普通聊天 `mobile.html`；Remote 来源不获得普通聊天桥。诊断页可读取目录和选择已有模型，不能管理目录。
- 不在错误消息中返回上游错误正文、Key 或请求头。停止与断线沿用原单次请求机制，不自动重发。

## 历史、默认模型与删除

沿用原 ordinary origin 和 IndexedDB v2，不重建历史库。没有 `provider` 的旧记录按内置 DeepSeek 解释，优先保留最后一次实际使用的旧模型。首次没有原生默认选择时继续使用旧本地默认模型；新默认选择保存在原生目录，只影响新聊天。

[OrdinarySession](../../src/ordinary-session.mjs)固定每轮的供应商、模型、参数和请求归属。聊天间切换或之后修改模型不会改写已有回复；分支保留原记录和对应供应商标识。同名模型以供应商 ID 区分。

删除供应商会移除其目录与 Key，但不删除聊天、回复或草稿。移除模型也不删除旧消息。受影响聊天仍可打开阅读，发送前明确要求重新选择，不能静默切到内置 DeepSeek。

[备份](../../src/ordinary-backup.mjs)导出 v2，接受原 v1。v1 不接受供应商字段，避免伪装为旧格式而使用错误目标；旧 App 会拒绝新版格式。备份白名单只含聊天数据及供应商/模型标识，不含目录、地址或 Key。跨设备导入后，可阅读记录；需要重新配置服务并明确选择模型才能发送。

## 代码与验证入口

| 入口 | 职责与范围 |
| --- | --- |
| [供应商配置](../../src/ordinary-providers.mjs) / [原生目录](../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryProviders.kt) | 公共目录、模型能力、配置校验、修订号、默认选择与凭据引用。 |
| [供应商页面](../../src/ui/OrdinaryProviders.jsx) / [共享模型选择](../../src/ui/OrdinaryModels.jsx) | 正式设置增改删；聊天和默认模型菜单复用同一目录。 |
| [原生请求桥](../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryBridge.kt) | 受限 RPC、独立 Key 窗口、目标固定、请求参数与 HTTPS 流。 |
| [Node 回归](../../tests/ordinary-providers.test.mjs) / [流回归](../../tests/ordinary-stream.test.mjs) | 旧数据、同名模型、分支、备份、参数、删除拒发及独立 usage 尾块。 |
| [原生专项](../../android/app/src/androidTest/java/dev/dshmobile/validation/OrdinaryProviderChecks.kt) | 真实 Android 加密隔离、原别名保留、配置重开、地址保护、过期拒绝与参数白名单。使用一次性假 Key，不连接模型。 |
| [实际页面验收](../../scripts/verify-ordinary-providers-android.mjs) | 隔离 UID 的真实表单、原生密码窗口、供应商切换、HTTPS 请求、进程重启、旧记录和清理；可显式传入官方服务测试凭据。 |

验收材料在本地 `artifacts/ordinary-providers-android/`，不纳入公开仓库。测试只操作独立 `dev.dshmobile.validation.toolstyletest` 的专用供应商和聊天，不覆盖日常 App、读取用户已保存的 Key 或修改 DSH。真实外部凭据只进入原生密码输入与指定官方 HTTPS 服务，脚本、报告、截图及备份不记录凭据。

### 本次验收矩阵

环境为本机 MuMu Android 12L、实际 WebView `mobile.html` 和上述独立 UID。没有使用浏览器假原生桥或替换生产请求方法。

| 检查 | 结果与证据 |
| --- | --- |
| 正式设置的供应商、模型增改删 | 最终报告 `5099fb7b-15c2-4198-9098-5ad90a841c74` 全流程通过：添加两个模型、改名保存、移除模型、原生 Key 窗口、地址锁定；GLM 通过统一添加表单保存，无厂商专属入口。 |
| 默认与旧数据 | 同一最终报告通过进程重启默认选择、无供应商字段的旧 Pro 记录、回复和草稿保留；删除自定义服务后记录可读且明确提示重新选模。结束只移除三条专用聊天及测试供应商，原记录和原 Key 状态一致。 |
| 真实 DeepSeek 与 GLM | `c36f544c-5575-44f0-8941-5faaa1d8b2d2` 的两个真实官方流式回复、终态和精确标记通过，同一聊天从 GLM 切回 DeepSeek 后再次正常回复，证明两组 Key 独立可用。该次完整脚本在之后的旧记录定位处失败，不能标为整轮通过；最终 UI 流程由前两行单独验收。 |
| 原生安全与兼容 | `providersOnly=true` instrumentation 通过：一次性旧 DeepSeek 加密凭据的原别名及原文件字节保持、自定义 Key 加密隔离、重开、目标锁定、过期拒绝、默认与参数白名单。不存在旧 Key 时只在独立 UID 种入假凭据，结束恢复未配置状态。 |
| 请求失败 | 真实官方 DeepSeek 无效凭据 401 被拒绝；GLM 后续复测 `e2ff0b3c-e5f2-4c6b-8c0e-c24371e66a85` 返回并持久化 `http_429`，按失败记录，停止继续 GLM 调用，没有自动重试或记为成功。 |
| 自动回归与构建 | 512 项 Node 测试通过；官方候选 Web、隔离 Android APK / test APK 构建及 `lintDebug` 通过。既有停止、断流、分支、参数和备份测试保持；没有据此声明新增供应商在真机或所有异常网络下已验证。 |

早期驱动曾因原生输入定位、覆盖原生消息分发回调、模型控件的精确标签、历史名称重叠及提示包含子按钮而失败；已修正测试驱动，不向产品添加测试后门。首轮残留的专用供应商/记录已按原报告标识单独清理。`2c881bd6-c11e-4868-b494-f01a5b61124d` 的后续 GLM 回复等待超时没有保留足以归因的上游状态，不能反推它与另一次 429 原因相同；失败报告保留。

尚未验证任意第三方中转站、真实 OpenAI 模型、所有图片模型、Android 9–11/15 或物理手机。模型能力以各服务文档为准，不因某两家官方接口通过而宣称所有“兼容”服务都可用。公开 preview.4 包不含本次功能；[preview.5 发行工作](https://linear.app/kkcodes/issue/KKC-64)单独记录构建、签名和下载结果，不扩大运行验收范围。
