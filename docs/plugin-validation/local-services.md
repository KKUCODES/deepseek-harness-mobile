# 普通聊天最小服务与 DSH 适配契约

- 状态：实现规格；用户已确认自己的 DeepSeek Key、手机直连、本地历史，实际实现与验证分项记录。
- 维护角色：DSH Mobile 项目协作 Agent。
- 核验日期：2026-09-22。
- 来源：[插件依赖矩阵](./plugin-dependencies.md)、用户要求的非 Agent 普通聊天与插件支持。

## 原则与两个实现路线

| 路线 | 影响 | 判定 |
| --- | --- | --- |
| 重建整个 DSH Host API，让全部客户端以为连接电脑 | 能少改部分 client，但需要实现大量 Agent/workspace/文件/审批语义；空实现会误导插件 | 不采用假 Host；仅对能真实提供等价行为的接口做适配 |
| 本地普通聊天服务 + 逐项兼容浏览器服务 | 普通聊天语义明确；需记录各插件需要的适配点 | 本次验证路线。Remote 继续使用原 Host，不把缺失功能默默转发 |

本地与 Remote 可共享纯协议和渲染代码；每个会话必须有 mode 所属。普通聊天不产生工具循环，不凭模型返回的文本执行命令。

## 服务与最小行为

| 服务 | 必须真实提供的行为 | 与上游区别/边界 |
| --- | --- | --- |
| 本地会话 | 建立、列表、读取、发送、停止、订阅、删除；稳定 chatId/messageId/requestId，保存普通聊天历史 | 不伪造 workspace/cwd/Agent 运行状态，不把普通 chatId 传入 Remote |
| 模型请求 | UTF-8/SSE 流解析、正文与推理字段分开、HTTP/模型错误、取消、完成标记；只请求公开 API 支持字段 | 不复用 Harness 私有请求字段；完成前中断为 interrupted，不记为 completed |
| 流状态 | idle → sending → streaming → completed/failed/interrupted；请求归属固定，迟到分片不能写入新会话 | 模式切换不改变请求目标；失败不自动重发产生重复计费/消息 |
| 历史存储 | 消息、草稿、终态原子更新；重启恢复，unfinished turn 标记中断；分页和删除有明确行为 | 用户已选本地历史；验证实现采用普通聊天 origin 的 IndexedDB 事务，Key 不进入 Web 存储。性能测试数据与用户历史分开 |
| 设置 scope | 对已注册 namespace 提供 getSnapshot/subscribe/set/unset/mutate，schema 校验、默认/用户层、revision 与写入顺序 | 参考 [SettingsScope](../../../deepseek-harness/packages/client/ui-settings/src/client/settings-contract.ts)；本地 provider 明确归属，不伪造远程 isLoopback。兼容层若映射 host 模式，指真实本机持久化服务而非电脑 |
| 语言与主题 | 保留 locale/theme 行为，实际订阅并同步到 DOM；设置跨重启存在 | 原主题 CSS 注入和卸载沿用；不能只换背景色替代原插件 |
| 输入上下文 | 会话绑定生命周期、draft/caret/revision、文本插入、来源注册与释放 | InputTriggerController 的插入必须检查 span/draftRev；Agent 命令与引用按能力拒绝 |
| 插件运行 | 真实模块加载、共享依赖、Cordis effect、slots owner/props、配置/启停/卸载和错误 | 静态 allowlist 的验证用安装源先于任意包安装；依赖缺失明确拒绝，不能给 proxy 默认成功 |
| 文件/导出 | 通过用户选择取得文件或导出目标，使用受限资源标识、取消与释放 | 不把电脑绝对路径视为手机路径；附件模型支持取决于真实 API 能力，不默认承诺 |
| 平台网络与凭据 | 模型 Key、Remote 私钥/token 分别保存，只给各自执行服务使用；流式与取消可验证 | 原生签名/安全存储需核对官方接口后实现，不自制假安全存储。不能将 Key 交给任意插件 fetch |

## 最小验证接口边界

普通聊天业务接口以本地语义命名，不宣称与完整 `ISessions` 等价。对真实插件需要的字段/方法建立显式 adapter；未知服务和未知方法必须失败，并给出“需要电脑”或“尚未适配”的明确原因。

模块层继续使用 DSH 的 ModuleLoader 注册协议。作为测试宿主，根布局只负责声明验证的 settings.general.item、shell.overlay、plugins.row.config 和输入展示插槽；不能据此宣称完整 DSH layout 插槽已覆盖。

凭据方案现已确认，可以实现受限原生请求桥和本地历史。用户在原生安全输入入口配置 Key；不擅自读取电脑 DSH 凭据。模型测试使用真实服务后才能计入第三步通过；分片夹具只覆盖解析器边界。

### 已实现的流协议部分

[ordinary-stream.mjs](../../src/ordinary-stream.mjs) 接收平台 transport 返回的 `Response`，不自行读取 Key、选择端点或发送 HTTP。普通聊天请求由不可变 `mode/chatId/requestId` 归属，实例不能重跑；切换界面不能更改其归属。当前是内存请求状态，不是持久化历史，也不是 Web 环境之间的安全隔离。

协议依据为 [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/) 与 [WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation)。沿用[上游 SSE 实现](../../../deepseek-harness/packages/llm/llm-deepseek/src/protocols/chat-completions/sse.ts)所选的 `eventsource-parser`，固定 3.1.0；不直接引入依赖 Host/附件/凭据体系的完整 adapter。

- 正文和推理分别累积。要求一致的响应 ID、单个 index=0 choice；未知结构明确失败，不静默拼接其他请求。
- 同时收到 finish_reason 与 `[DONE]` 才承认协议完成。`stop` 正常完成；`length` 完成但保留截断原因；`content_filter` 失败；`aborted`、`insufficient_system_resource` 标为中断。工具调用不执行，并明确报未支持。
- EOF 缺少完整 `[DONE]` 为中断，即便之前已经收到 finish_reason。停止会取消 transport signal 和正在读取的 body；迟到响应只关闭 body，不修改终态；不自动重试。
- 错误状态仅保留稳定错误码或 HTTP 状态，不透传错误响应正文。非法 UTF-8、JSON、超大单事件明确失败。事件大小上限 1,048,576 字符是当前实现限制，不是 API 官方限制。
- 原生凭据/请求桥、超时与历史恢复现已接入，见[实际接入边界](./ordinary-native.md)；真实 API 和[实际双模式](./remote-native.md)已通过 MuMu 验证，证据与离线夹具分别记录。

### 原输入插件的普通聊天适配

[ordinary-input.mjs](../../src/ordinary-input.mjs) 加载只读上游原 `ui-input-trigger` 入口，由原服务创建控制器，原 `apply` 注册菜单插槽。单独隔离 `sessions` / `inputTriggers` 服务范围；只向该已审计插件提供 `sessionOf` / `binding` / `scope` 三个实际消费的方法。身份来自当前真实本地 chatId，不是假的电脑 Session，不提供 Agent、工作区、命令或引用执行。

[ordinary-composer.jsx](../../src/ordinary-composer.jsx) 把版本匹配的插入交给原 `OrdinaryChat` 草稿事务与发送流程。组合态、发送中、已销毁的绑定、跨聊天及过期 span 都不能写入；卸载释放绑定、控制器、订阅和菜单，重新加载从现存草稿恢复。此适配并不声称实现完整 `ISessions`，根环境依赖 Host 的插件仍无法获得 `sessions`。

## 隔离要求与验收

1. 普通聊天与 Remote 采用不同 Web 存储分区或等效隔离设施、独立 Context 与消息入口。仅不同页面路径不够。
2. Remote 脚本尝试读取普通聊天 localStorage/IndexedDB/Key、调用普通聊天请求接口，应失败；普通模式不能取得 Remote 设备私钥。
3. 原生桥按载体/来源和操作授权；不提供任意读文件、任意执行脚本、取全部凭据的方法。
4. 同一普通聊天运行环境中的插件可接触该环境被授予的聊天数据；Cordis 不是恶意插件沙箱。插件不能被描述为彼此安全隔离，普通聊天 Key 仍应留在受控请求服务。
5. 隔离测试可以使用明确标记的攻击测试页面，但不能把一个空白 Remote 页当作真实 Remote 全链路通过；原始目标仍保留实际双模式集成验证。
