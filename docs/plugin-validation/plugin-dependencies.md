# 真实插件依赖矩阵

- 状态：依赖事实经静态核验；主题/语言、上游样例以及输入控制器/菜单的有限 Android 运行结果见[实际记录](./results.md)，不代表整表或全部第三方插件兼容。
- 维护角色：DSH Mobile 项目协作 Agent。
- 核验日期：2026-09-22。
- 源码：上游 commit `ddefc45fbc7f8e46dd73185e68295696d1297887`。

## 代表性对象

| 对象 | 真实依赖与行为 | 普通聊天需要补充什么 | 分类 |
| --- | --- | --- | --- |
| [ui-theme](../../../deepseek-harness/packages/client/ui-theme/src/client/index.ts) | inject 为 slots/locale/remote/settingsScope；绑定 theme 设置；提供 theme service，注册 settings.general.item；[styles](../../../deepseek-harness/packages/client/ui-theme/src/client/styles.ts) 用 effect 管理六份 CSS | 真正可持久化的 namespace 设置、对应 schema/default/revision、通用设置插槽；layout 订阅主题并应用 DOM。不能用空 remote 欺骗加载器 | 浏览器插件可保留，需本地设置服务适配 |
| [locale](../../../deepseek-harness/packages/client/locale/src/client/index.ts) | 管理语言目录与订阅，绑定 locale 设置并注册语言设置行 | 本地设置及 slots；不是只有一份翻译 JSON | 浏览器实现复用，接本地设置 |
| [ui-chat](../../../deepseek-harness/packages/client/ui-chat/src/client/apply.ts) | sessions/uiWorkspace/uiSession/uiConversation/locale/settingsScope/remote.session/sidebarRight；绑定 conversation target，注册 renderer、历史加载、文件打开 | 完整的会话视图和上下文契约，不能把简单 messages 数组硬塞成 Agent Session | 整包不直接用于普通聊天；先核验/复用纯渲染，再明确兼容面 |
| [AssistantMarkdown](../../../deepseek-harness/packages/client/ui-chat/src/client/chat/AssistantMarkdown.tsx) | MarkdownText、ReasoningRow、CSS；`localPathMediaUrl` 将绝对路径转成 `/api/file` | 普通聊天没有电脑文件 API；需明确附件资源解析，禁止把模型文本当成本机路径授权 | 渲染适配，不能只复制组件就承诺安全可用 |
| [ui-input-trigger](../../../deepseek-harness/packages/client/ui-input-trigger/src/client/index.ts) | inject sessions/locale；注册 conversation.input.overlay；[service](../../../deepseek-harness/packages/client/ui-input-trigger/src/client/service.ts) 通过 sessionOf/binding/scope 管理控制器生命周期 | 真正本地会话身份、绑定与输入事件；[controller](../../../deepseek-harness/packages/client/ui-input-trigger/src/client/controller.ts) 有文本/引用/命令三类回调和 draft revision CAS；纯提示词源可复用控制器，但这不等同于整个插件零修改 | 核心可复用，完整插件需会话与 composer 适配 |
| [ui-commands](../../../deepseek-harness/packages/client/ui-commands/src/client/index.ts) | inputTriggers/sessions/remote.commands；命令目录与执行来自 Host | 普通聊天仅注册真实本地命令；不要把 Agent 命令实现成空成功，也不要静默转发电脑 | 部分适配；Agent 命令仅 Remote |
| [ui-reference](../../../deepseek-harness/packages/client/ui-reference/src/client/index.ts) | remote.fileReferences、remote.sessionReferenceResolver、sidebarRight；引用电脑文件/会话 | 手机文件需用户明确选择、本地附件索引与序列化；电脑路径引用仍属于 Remote | 当前电脑能力仅 Remote；移动附件另实现 |
| [fixture-live-client](../../../deepseek-harness/apps/web/tests/fixtures/plugins/fixture-live-client/client.js) | 真实发布注册协议 `__ModuleLoader__.load`，shared React、slots、locale；shell.overlay、plugins.row.config；style 与 effect 释放 | 原加载器、同一 React/Cordis、真实父插槽声明与 renderer、生命周期；样例没有 Host 业务，是上游测试插件，必须如实标识 | 用于安装/启停/卸载与自定义设置页验证，不代表市场插件全集 |
| [ui-message-feedback](../../../deepseek-harness/packages/client/ui-message-feedback/src/client/index.ts) | remote.messageFeedback/remote.sessionFeedback；assistant-actions 与 input.overlay；连接重置同步 | 反馈接口有真实 Host 语义；不能自行改成 localStorage 点赞就声称兼容原反馈服务 | 当前仅 Remote；若移植需明确定义反馈对象和接收方 |
| [动态 Cordis runner](../../../deepseek-harness/packages/extensions/cordis-client-runner/src/client/index.ts) | loader/modules/slots/remote.dynamicCordisRunner；获取代码、runHostHalf、invoke、授权/诊断与撤销事件 | client-only 动态代码可另定义入口，但原 runner 的执行身份与 Host 授权不能伪造。本阶段不在手机装 Node 来绕过 | 原 Host 协作保留 Remote；普通模式支持面需独立约定 |

## 不可跳过的运行契约

- React/Cordis/store/slots 为共享实例，避免插件加载多份导致上下文断裂。
- 插槽由 owner 声明，销毁父插槽会影响子贡献；自定义手机根布局必须实际声明并渲染验证涉及的插槽，而非手动调用插件 React 组件。
- 生命周期测试既观察界面，也观察 CSS、事件监听、订阅和 pending 请求。停用后不能留下隐藏运行的插件。
- 两种模式的 Context 分开只解决服务树归属，不构成存储/凭据隔离；必须检查 WebView profile/origin 和原生桥。
- `dsh.client.inject` 的模块依赖、插件运行期 inject，以及运行中直接访问的远程服务都要核对。不能只扫描 package.json 得出兼容结论。

## 最小样例组合

第一组使用真实 ui-theme 与 locale 浏览器代码，验证本地持久化和主题生命周期。第二组加载未经业务改写的上游 fixture-live-client，验证模块注册、设置页、overlay、卸载与重装。第三组先验证控制器与菜单，随后通过原 ui-input-trigger 入口接入真实普通聊天，使用本地纯文本提示词 source；两阶段证据分别记录。第四组针对 Host 依赖插件核对不可用原因和 Remote 路由边界，不返回假成功。

这些样例选择是验证顺序，不是把产品的“插件兼容”目标缩小到只支持这些插件。

早期独立诊断页只引用原控制器和菜单；现已另将原 `ui-input-trigger` 入口加载到真实普通聊天，原 `InputTriggerService` 和 `apply` 注册的菜单插槽均参与运行。适配仅提供三个真实消费的身份方法，并隔离服务范围；不实现或宣称完整 `ISessions`。Web/MuMu 验证源启停、插件卸载、过期/跨聊天插入拒绝、真实草稿持久化，并用候选插入后的文本完成真实 DeepSeek 请求。Agent 命令/电脑引用仍未在普通模式适配。

真实 `ui-theme` 发布插件已在 Web/MuMu 分别执行 20 次卸载重载；样式、设置项、DOM 投影和持久设置恢复通过。宿主将原 `ThemePresenter` 绑定到 theme 服务的 Cordis 生命周期，根页独立保留重新加载入口；没有给缺失的服务提供空实现。详见[运行记录](./results.md#主题插件实际卸载与恢复)。
