# 原模型设置插件接入边界

- 状态：模型页采用手机组合，标准注册、引导、结构化模型编辑和草稿发现已接入；不执行桌面整页 apply。维护角色：DSH Mobile协作Agent；最近核验：2026-10-02。
- 来源：原[index](../../../deepseek-harness/packages/client/ui-settings-models/src/client/index.ts)、[store](../../../deepseek-harness/packages/client/ui-settings-models/src/client/store.ts)、[operations](../../../deepseek-harness/packages/client/ui-settings-models/src/client/operations.ts)、[设置镜像](../../../deepseek-harness/packages/client/ui-settings/src/client/settings-mirror.ts)。

原插件不仅包含模型卡片，还注册ModelsSection、WelcomeNotice和DeepSeekOnboardingDialog。启动依赖remote.credentials、remote.llm、remote.settings与settingsScope/settingsSchema。实际调用包括credentials describe/set/unset、llm listProviders/listConfigurableProviders/discoverModels、settings describe/mutate。原密码输入把明文交给Web组件的storeCredential(ref,value)，与现有原生Key入口不同；settings.describe返回整份镜像，不能用固定设置表单已通过推断任意字段安全或整包兼容。

当前手机通过标准 settings.section/models 注册自己的模型页，承接两步引导及 provider-card/footer 扩展。原模块保留用于依赖解析，桌面 apply 被组合策略排除，避免重复注册；这符合 DSHM 自有页面的目标，不再把执行桌面整页作为待办。保持[设置边界](../../../docs/project-knowledge/knowledge/domains/remote-access/settings-boundary.md)，不开放通用 settings/credentials。下方专项记录各项能力的证据和局限，不以组合状态替代任意第三方插件验收。

### 模型设置契约核对（2026-10-03）

状态：下表列出的固定模型设置行为已有实现与实际 Android 专项证据；R14 整体仍未完成。维护角色：项目协作 Agent。核对来源包括原插件入口、手机组合代码、实际报告字段与对应驱动断言，不以 active/mobile 状态作为功能通过依据。本次没有重新执行历史 Android 写入，也没有修改 App、Key 或电脑设置。

| 原功能或手机承接职责 | 当前实现与实际证据 | 结论与边界 |
| --- | --- | --- |
| 标准模型设置入口与两个引导 | [原注册职责](../../../deepseek-harness/packages/client/ui-settings-models/src/client/index.ts)、[手机注册](../../src/remote-model-onboarding.jsx)；[组合后的实际模型页](../../artifacts/model-composition-android.json)、[引导顺序](../../artifacts/settings-onboarding-live-android.json)、[原生保存后引导完成](../../artifacts/model-save-android.json) | 手机持有 models 条目和对应引导，原桌面 apply 按组合策略排除；不再列为缺失整页。原生保存专项的测试凭据已恢复，不代表更换用户现有共享 Key。 |
| 提供方新增、修改、移除 | [正式入口专项](../../artifacts/provider-management-run-android.json)通过 custom 创建、设置保存后电脑重读、正式移除及 cleaned；[内置目录专项](../../artifacts/model-discovery-run-android.json)通过已有适配器路由创建/移除 | 测试提供方唯一命名并清理；不是任意适配器认证均已验收。 |
| 模型清单、覆盖和默认继承 | [官方模型](../../artifacts/official-models-run-android.json)通过改名、电脑重读、聊天选择器同步及原字段/继承恢复；[覆盖合并](../../artifacts/model-overrides-merge-run-android.json)覆盖保留原行、精确容量、移除单行、陈旧写入拒绝和恢复默认 | 不再把基本模型编辑列为待开发。 |
| 输入/思考能力、提供方默认及单模型兼容 | [共用兼容表单](../../src/ui/RemoteModelCompat.jsx)、[实际能力与两层继承](../../artifacts/provider-management-run-android.json)、[模板保存与恢复](../../artifacts/compat-templates-run-android.json) | 证明固定字段经手机保存到电脑和恢复；未验证每个选项在每家第三方推理服务的效果，不把存储证明写成推理兼容证明。 |
| 服务地址和协议 | [地址保存/取消](../../artifacts/provider-management-run-android.json)、[真实 HTTP 发现协议切换](../../artifacts/provider-protocol-run-android.json) | 实际电脑请求从 OpenAI 切到 Anthropic 路径/请求头并恢复，失败后重试、关闭取消通过；不外推第三方 TLS 或全部部署环境。 |
| 独立提供方 Key | [真实原生保存、HTTP 使用和移除](../../artifacts/provider-key-http-run-android.json)；[插件卡片同步](../../artifacts/provider-card-state-run-android.json) | 页面只接收配置状态；专项使用隔离测试凭据。官方/搜索共享 Key 替换仍保留在总验收表，不能由此移除。 |
| 未保存地址的模型发现 | [当前组合入口](../../artifacts/model-composition-android.json)、[已存凭据发现](../../artifacts/model-probe-stored-android.json)、[实际撤权](../../artifacts/model-probe-revocation-android.json) | 无认证、临时原生认证、已有认证、302 拒绝与重试、关闭取消、撤权后迟到结果丢弃及恢复重试均有专项；结果进入草稿，未自动保存或发送模型请求。 |
| 表单和两端变化同步 | [三类模型清单](../../artifacts/model-list-sync-android.json)、[提供方切换保存](../../artifacts/provider-switch-save-android.json)、[创建草稿](../../artifacts/provider-creation-draft-android.json) | 实际刷新、草稿保持、陈旧保存禁用和明确重读通过；目录/卡片保留策略不冒充卸载重建。 |
| provider-card/footer 扩展 | [实际卡片状态](../../artifacts/provider-card-state-run-android.json)、[页尾加载与交互](../../artifacts/model-footer-live-android.json)、[卸载](../../artifacts/model-footer-removed-android.json)、[收权清理](../../artifacts/model-footer-cleanup-android.json) | 原作用域、数据 owner、外层缩放、交互和卸载有依据；不声称所有第三方扩展均兼容。 |

本次对当前源码补跑[30项固定模型/凭据边界测试](../../artifacts/model-contract-audit-tests.log)，全部通过；[模型扩展页面回归](../../artifacts/model-contract-audit-footer.log)通过生产设置入口、卡片数据刷新/失败重试保留草稿、root 作用域、交互、缩放、撤权隐藏与卸载。后者为隔离协议回放，不替代上表真实 Android 报告。

结论：这些已核验行为不再使用“模型设置整体待做”作为待办；后续按具体差异重开。反馈、官方/搜索共享凭据实际替换及插件管理其余操作仍由[当前收尾表](./completion-audit.md)跟踪，未据此宣称 R13/R14 或完整 Remote 完成。下文按时间保留旧审查与失败记录，其中已经被本表证据覆盖的“未实现/待验”不再作为现行状态。

### 当前证据核对（2026-10-02）

- [手机组合策略](../../src/remote-plugin-policy.mjs)与[标准注册](../../src/remote-model-onboarding.jsx)已核对；[模型草稿服务](../../src/remote-model-probe.mjs)通过限定协议承接未保存地址与协议，临时 Key 仍只进入原生窗口。
- [当前 Android 报告](../../artifacts/model-composition-android.json)证明实际发现、原生取消、临时认证、拒绝跳转后重试及关闭页面取消在途请求；[已有认证报告](../../artifacts/model-probe-stored-android.json)证明未保存地址使用既有测试凭据并清理测试提供方。报告时间按文件内 UTC 为准，本次仅核对既有证据，没有重新运行 Android。
- 本次重新执行客户端全部测试：424 项通过、0 失败，见[日志](../../artifacts/remote-current-regression.log)。该检查不替代 Android 运行，也不证明完整 Remote 已完成。

### 模板兼容参数的实际手机保存（2026-10-03）

状态：正式 MuMu 的提供方/单模型模板保存、重读与恢复继承通过。维护角色：项目协作 Agent。来源：[实际驱动](../../scripts/verify-compat-templates-android.mjs)、[完整结果](../../artifacts/compat-templates-run-android.json)、[清理种子](../../artifacts/compat-templates-seed.json)及[收权后恢复](../../artifacts/compat-templates-restored-android.json)。

在已有授权设备上临时开放管理，通过手机正式新增入口建立唯一 `dshm-compat-check-*` 提供方，地址为保留的 `.invalid` 域名、不开启Key、不发现或调用模型。提供方保存 `thinkingFormat=chat-template`、`maxTokensField=max_tokens`、`vllmPriority=-2` 及两个模板字典；单模型保存不同格式/容量参数名/优先级与字典。固定内容覆盖中文字符串、数字、布尔、null、三个允许的 thinking 变量及 omitWhenOff，经真实电脑保存后主动重新读取并比对。

切换到未选择提供方再返回，两层值保持各自内容；卡片按现有设计隐藏并保留，因此该步骤不冒充冷启动持久化。恢复单模型兼容设置后重读确认模板清空、格式继承，提供方模板仍保持；随后恢复提供方继承并重读，模板、格式和优先级覆盖清空。测试路由通过正式移除入口删除、目录条目消失，草稿保持；临时管理收回，聊天授权保留。没有改生产代码/APK、用户Key或已有提供方，也没有重启服务。

最初几次驱动失败分别为[重连后仍在列表](../../artifacts/compat-templates-entry-before.json)、[选择器匹配](../../artifacts/compat-templates-selector-before.json)、[等待短暂保存提示](../../artifacts/compat-templates-save-notice-before.json)、[重读后折叠](../../artifacts/compat-templates-reread-collapse-before.json)、[重入时反向切换已展开区域](../../artifacts/compat-templates-reentry-before.json)和[误要求保留表单卸载](../../artifacts/compat-templates-retained-form-before.json)。记录保留；已尝试创建的各轮都通过正式入口清理并收权。最终按实际 hidden/aria-expanded 状态操作，以电脑重读字段和清理结果作断言，不把短暂“已保存”文案作为唯一完成信号。

收权后恢复报告确认原16条回复、空草稿、DeepSeek-V4-Pro、无错误及 active/management=false。首次恢复检查的业务断言通过，但 Node 在强制退出与设备关闭交错时出现原生断言退出，原报告保留为[退出前结果](../../artifacts/compat-templates-restored-before-exit.json)。改为等待设备关闭后，复查再次通过并落盘，但驱动的 `device.close()` 未返回；核对 PID6420 的 node.exe 命令确为本次 `--restore` 检查后，仅结束该检查器。主验证 run 命令正常退出0；这两次恢复检查只证明已落盘业务断言，不算完整命令正常退出，没有因此重启 App/DSH/网关或重做写入。

本项只证明上述字段经实际 App/网关/Host 的存储、重读及继承操作；不证明这些模板已经用于第三方模型请求、不覆盖所有26项兼容组合或全部认证协议。其他具体缺口仍按收尾验收表。

### 草稿探测收权与设置入口提示（2026-10-03）

状态：空白设置入口已修复，新版 MuMu 正式入口通过收权取消和恢复重试；维护角色：项目协作 Agent。来源：[设置导航](../../src/ui/RemoteSettings.jsx)、[完整页面检查](../../scripts/check-settings-access.mjs)、[真实 Android 驱动](../../scripts/verify-model-probe-revocation-android.mjs)。

实际收回管理权限会终止旧连接。重新连接后，设置导航不再挂载管理页插槽，原来放在内部表单的拒绝提示也随之消失，导致窗口空白。[失败报告](../../artifacts/model-probe-revocation-settings-blank.json)确认实际请求已被取消，但手机权限提示不可见；[修改前页面回归](../../artifacts/settings-access-before.log)同样复现。现由设置导航外层显示权限或连接提示，仍不挂载未授权内容、不放宽 Host 权限。所有主聊天/旁栏窗口共用此入口，没有单独修补模拟器页面。

[修改后页面报告](../../artifacts/settings-access-web.json)覆盖初始无管理权限、连接中/断线提示优先、授权后显示及再次收权移除；[引导回归](../../artifacts/settings-access-onboarding.log)、[Web构建](../../artifacts/settings-access-web-build.log)、[APK构建及lint](../../artifacts/settings-access-android-build.log)通过，新 APK 已覆盖安装。

07:10:56Z 开始的[真实报告](../../artifacts/model-probe-revocation-android.json)通过正式新增表单向本机 HTTP 端点获取候选，端点收到无认证请求后暂缓响应，再收回同一设备管理权限。连接在约329毫秒内关闭（请求存活337毫秒，早于Host的20秒超时），手机管理表单移除；重连保留聊天授权，电脑设置明确拒绝。重新授权并重新连接后，同一入口重新获取成功，候选加入未保存草稿，旧结果未出现。原草稿保持、页面无错误；管理权限最终收回，设备 active。没有保存提供方、输入Key或调用外部模型。

首两次驱动分别遗漏权限变更后的重连和内测声明，报告保留为[重连缺失](../../artifacts/model-probe-revocation-reconnect-missing.json)、[引导遮挡](../../artifacts/model-probe-revocation-onboarding.json)，不当成产品请求失败。安装后直接启动非导出的 RemoteActivity 被 Android 拒绝，驱动现从公开 ValidationActivity 经侧栏 Remote 进入，不改变组件导出策略。

本项实际覆盖无认证的新建草稿入口及管理收权，不外推临时Key原生窗口、已保存路由、网络故障和五分钟过期的完整交叉组合；页面关闭取消及其他认证来源的既有证据仍独立保留。完整 Remote 尚未完成。

### 临时断线保留设置草稿（2026-10-03）

状态：已修复并安装，新版 MuMu 经真实网关中断和恢复通过；维护角色：项目协作 Agent。来源：[设置外壳](../../src/ui/RemoteSettings.jsx)、[原有三入口回归](../../scripts/check-management-status.mjs)、[插件表单回归](../../scripts/check-settings-access.mjs)、[Android 驱动](../../scripts/verify-settings-disconnect-android.mjs)。

标准设置导航此前只在连接且有管理权限时呈现插槽。断线会卸载表单，恢复后重新读取，从而丢失本地草稿。[修改前回归](../../artifacts/settings-disconnect-before.log)在输入数值与地址确认后断线，原输入框消失。外壳现仅在当前 model 已确认管理权限后保留设置页；临时断线时通过 disabled/inert 冻结操作，插件旧 close 回调也暂时失效。确认收权或更换 model 时释放旧页面，Host 的逐请求权限校验保持不变。

连接提示由外层统一展示；模型表单通过可选参数关闭重复提示，单独使用组件时仍保留原提示。普通模型/地址草稿及插件自有局部状态不另复制到新存储，不恢复或自动重发写入操作。插件卸载、页面关闭、model 更换不在“临时断线保留”的保证范围内。

[三入口回归](../../artifacts/settings-disconnect-management.log)覆盖数值草稿、地址确认草稿、工作区草稿、离线禁用和明确收权；[插件回归](../../artifacts/settings-disconnect-access.log)覆盖插件草稿、跨 ShadowRoot 的 inert、聚焦失败与旧关闭回调失效。最初误把 ShadowRoot 内输入的 isDisabled 当作 inert 证据，已改为核对宿主 inert 并实际尝试聚焦；同时沿用项目 React 当前支持的空字符串 inert 写法。[设置引导](../../artifacts/settings-disconnect-onboarding.log)、[Web构建](../../artifacts/settings-disconnect-web-build.log)、[APK构建及lint](../../artifacts/settings-disconnect-android-build.log)通过。

07:24:45Z开始的[正式 MuMu 报告](../../artifacts/settings-disconnect-android.json)：修改等待输出超时的未提交值、填写未提交地址并进入确认页，核验网关进程后停止服务；实际离线状态下两份内容保留且确认不可用。按原参数恢复网关后，同一页面内容保留、操作恢复；取消地址确认仍读到原输入，主动重读基础设置恢复电脑原值。未点击保存、不改Key、不调用模型；原聊天草稿保持，管理权限已收回，设备active。已检查[离线画面](../../artifacts/settings-disconnect-offline.png)和[重读画面](../../artifacts/settings-disconnect-restored.png)。网关恢复为PID70308仅为本次运行记录，后续需重新核验。

首次实际脚本在地址确认页寻找已被正常隐藏的输入框而失败，[报告](../../artifacts/settings-disconnect-endpoint-failure.json)保留；网关随后恢复并收权。再次打开时尝试点击后台普通页也曾失败，[记录](../../artifacts/settings-disconnect-foreground-failure.json)保留；驱动现复用已打开的Remote。最终报告退出0。这里不外推DSH进程重建、插件重新装载、永久撤权或任意第三方弹窗的状态保留。

## 原模型页与手机组合的具体差异（2026-10-02）

状态：以下为最初源码对照的历史差异表，不是当前待办。结构化创建、候选选择、草稿探测与标准模型页组合已由后续源码和专项证据覆盖；早期“缺失”和“waiting”描述不再用于判定当前状态。维护角色：项目协作Agent。

| 原入口与契约 | 手机当前入口 | 核验结论 |
| --- | --- | --- |
| [ProviderEditor](../../../deepseek-harness/packages/client/ui-settings-models/src/client/ProviderEditor.tsx)以当前表单中的地址、协议、未保存Key组成probe | [模型发现服务](../../src/remote-settings.mjs)仅发送已保存provider，电脑[适配](../../../plugin/src/provider-model-discovery.ts)只读取已保存配置 | **缺少草稿探测**。修改地址/协议后必须先保存才能发现；不能描述为原编辑流程等价。 |
| [CustomProviderCard](../../../deepseek-harness/packages/client/ui-settings-models/src/client/CustomProviderCard.tsx)创建前可发现模型、选择候选并编辑模型属性 | [新增页面](../../src/ui/RemoteProviderCreation.jsx)经[协议](../../../backend/packages/protocol/src/remote-provider-creation.ts)和[Host](../../../plugin/src/provider-creation.ts)支持结构化行，旧能力保留ID数组 | 结构化创建已通过实际Android；**创建前模型发现仍缺失**。 |
| [ModelListEditor](../../../deepseek-harness/packages/client/ui-settings-models/src/client/ModelListEditor.tsx)候选按ID/名称搜索、批量选择并加入草稿 | [手机模型编辑器](../../src/ui/RemoteProviderModelEditor.jsx)共用候选搜索和当前结果批量选择 | 两个入口已通过页面回归和真实Android目录验证，见下方专项；仅适用于已保存提供方的发现。 |
| 原ModelRow允许模型名称、容量与输入类型，保留未编辑字段 | 新增和已有模型共用[基础字段控件](../../src/ui/RemoteModelFields.jsx)，输入类型沿原能力控件 | 新增时字段已接入并从真实电脑读回；旧版电脑仍为ID数组，升级配套插件/网关才开启新能力。 |
| 原models模块注册ModelsSection和两个onboarding，以及provider-card/footer子插槽 | 手机自有设置、[引导](../../src/remote-model-onboarding.jsx)和原局部插槽分别承接 | 局部组合已有证据；原apply因完整八项接口未满足仍waiting，不应直接改状态。待功能差异闭合后，再核验组合生命周期/对外契约并据实登记适配状态。 |

### 实施顺序与约束

1. **结构化创建模型行**：复用现有模型行的字段约束和编辑控件，保留旧ID数组客户端兼容；新增能力需由电脑协商确认，旧电脑不静默丢弃扩展属性。原SettingsProvider仍以一次创建提交完整profile，失败/未知结果不自动重复创建。验证需覆盖新增时字段实际落到电脑、新客户端连接旧能力、重复ID/非法容量拒绝及测试路由清理。
2. **草稿模型发现**：必须同时覆盖已有路由编辑与新建，返回只进入未保存草稿。原[pi-ai注册](../../../deepseek-harness/packages/llm/llm-pi-ai/src/index.ts)的storedDiscoveryProfile会按provider带入已保存凭据及部署headers，因此不能简单给当前固定请求加一个任意baseURL。应分别绑定新地址确认、认证来源和请求快照；未保存Key仍由原生临时输入传递，不返回JS、不写电脑或手机持久凭据。继续调用真实LlmRuntime发现器，取消/收权/换连接后丢弃结果，错误不泄漏认证信息。
3. **候选操作与整体验收**：在共享模型候选界面补搜索/批量选择，检查重复模型不覆盖、筛选不误删选择、无匹配和失败可手动输入；再对模块注册、引导、插槽、创建/编辑/删除作一轮完整实际入口核验。

两种实现路线已比较：直接开放原通用settings/credentials可减少页面改造，但会扩大任意配置/凭据访问面，并与现有原生Key边界冲突；扩展固定通道需要同步协议、Host、Android和页面，维护成本更高，但能保留现有授权和未知写入保护。继续采用后者，原通用接口不作为捷径开放。上述为实施约束，**本次未改生产接口或运行新的Android用例**。

## 本次修复与验证

### 模型组合注册审查（2026-10-02）

当前入口归属：原Slots严格拒绝重复list ID及重复子插槽声明，因此上一版“原apply active后再撤手机条目”并不能保证安全交接。现将models列入[手机组合策略](../../src/remote-plugin-policy.mjs)，保留模块用于依赖解析，始终排除桌面apply；手机模型页固定注册一次并随model销毁释放，引导仍按原模块存在情况注册。不是执行原整包，也不授予通用credentials。该选择匹配用户要求的DSHM自有页面与原生Key边界，替代下面关于动态apply交接的计划；不再把启动桌面模型页作为验收目标。

[10项策略测试](../../artifacts/model-composition-policy.log)覆盖通用接口缺失/齐全都不启动原apply、模块保留和手机状态；[导航](../../artifacts/model-composition-navigation.log)、[引导](../../artifacts/model-composition-onboarding.log)、[卡片页尾](../../artifacts/model-composition-footer.log)回归通过。Web及Android构建/lint通过，新APK已安装，[实际报告](../../artifacts/model-composition-android.json)通过正式模型页无认证/临时Key/302拒绝重试、关闭设置取消在途和重开，聊天草稿保持、errors为空，管理权限收回。此轮未改电脑模型配置；不据此宣称所有第三方模型设置或完整Remote已完成，剩余按整体审计核对具体契约。

修复与验证：手机现注册 `settings.section/models`、order=10和原locale标签；RemoteSettings通过统一插槽呈现所有设置页，删除硬编码模型组件分支。模型页注册独立于欢迎提示的settingsScope依赖，原apply处于active时撤去手机条目；未执行原apply或开放通用凭据接口，policy仍未改。初版依赖settingsScope导致隔离场景模型页消失，导航回归复现后已解耦并通过。[标准枚举/导航](../../artifacts/model-section-navigation.log)、[卡片/页尾](../../artifacts/model-section-footer.log)、[模型引导](../../artifacts/model-section-onboarding.log)均无错误；Web及Android构建/lint通过。新版APK已安装，[真实Android报告](../../artifacts/model-section-android.json)通过普通→Remote→标准模型设置入口，无认证/临时Key/stored探测及创建清理、聊天草稿保持。测试Key和提供方删除、管理授权收回。原apply动态交接及整体兼容状态仍需核对；下方为修复前审查记录。

状态：源码已核对，组合注册缺口未修复；维护角色：项目协作Agent。来源：[原apply](../../../deepseek-harness/packages/client/ui-settings-models/src/client/index.ts)、[手机导航](../../src/ui/RemoteSettings.jsx)、[手机引导](../../src/remote-model-onboarding.jsx)、[插槽声明和分派](../../src/remote-plugin-slots.jsx)、[策略](../../src/remote-plugin-policy.mjs)。

| 原组合职责 | 手机实际承接 | 当前判断 |
| --- | --- | --- |
| 注册 `settings.section/models`，order=10 | RemoteSettings过滤models并直接渲染RemoteComputerSettings；没有对应标准条目注册 | **明确缺口**：插件枚举设置插槽时看不到models。硬编码导航可打开不等于注册契约已满足。 |
| welcome-notice与deepseek-official两条引导 | installRemoteModelOnboarding在原插件未active/failed时注册，Key走原生窗口 | 已有实现与专项证据；后续组合改动必须保持只注册一次、卸载清理及原apply启动后的交接。 |
| provider-card与footer子插槽 | remote-plugin-slots声明，RemoteProviderCard按namespace传公开owner，页尾空owner | 已有实现；组合改动必须维持原keyed/list契约和root作用域，不能创建第二套局部界面。 |
| 模型表单与发现 | RemoteComputerSettings及共享编辑器/草稿探测 | 具体功能已有专项验证；不直接证明所有对外注册契约。 |
| 原apply的八项服务依赖 | remote-plugin-policy仍保持requiredCalls，不执行原apply | 保持waiting是当前事实，不能只改为mobile/active消除差异。须先补组合注册并验证导航使用同一已注册组件。 |

下一步：让手机模型页按原ID/order注册到settings.section，并让设置导航通过该条目呈现同一组件；继续使用固定Host操作和原生Key，不开放通用credentials来启动原apply。验收应包含枚举、导航、单实例草稿保持、原插件状态变化的注册/卸载，以及已有引导和两个扩展插槽回归。本轮未改产品代码或运行新Android验证，未将源码审查记为兼容完成。

### 草稿模型发现的认证与跳转基线（2026-10-02）

关闭页面取消实测：19:23:51Z [生命周期报告](../../artifacts/model-probe-lifecycle-android.json)，同一[Android驱动](../../scripts/verify-model-probe-android.mjs)以`--lifecycle`在真实Host请求已到本机端点后暂缓响应，关闭电脑设置窗口，五秒内端点确认连接关闭；迟到响应未进入重新打开的表单，重新获取并加入候选成功。pendingRequestClosed/reopenAfterCancelSucceeded/chatDraftPreserved=true，errors为空。无提供方或凭据写入，管理权限收回。本项证明页面卸载取消，不等同真实网络断线、撤权或快照过期；后者Host测试已有边界证据，Android实际覆盖仍有限。

已有认证实测：19:21:30Z [stored Android报告](../../artifacts/model-probe-stored-android.json)经正式页面创建独立 `dshm-draft-probe-*` 测试提供方，在原生Key窗口写入本进程虚构值；已有提供方的完整地址草稿改为同一本机端点 `/draft`，未保存该地址，选择stored并核对路由后，电脑实际请求 `/draft/models` 且认证匹配。未读取或替换用户Key，不调用外部模型。无认证/临时Key/重定向/桥拒绝同时回归通过；随后原生移除测试Key、页面移除提供方，cleaned/chatDraftPreserved=true、errors为空，管理权限收回。首次清理脚本因系统按钮KEY大写匹配失败，保留失败报告并通过独立cleanup清理，再完整重跑成功；不是产品Key操作故障。此轮无生产代码或APK变更。断线/收权/过期等实际生命周期仍需补验，原models完整组合审查尚未完成。

临时Key与拒绝路径实测：扩展[Android驱动](../../scripts/verify-model-probe-android.mjs)，同一生产App/网关/Host和本机HTTP端点，19:17:10Z[报告](../../artifacts/model-probe-android.json)确认：原生密码窗口取消不请求端点且草稿保持；原生输入本进程生成的字母数字虚构值，端点收到匹配的Bearer认证，只记录匹配布尔值，页面正文不含该值；候选正常返回。通用页面桥分别拒绝temporary准备、temporary执行和none执行夹带apiKey，三项均返回unsupported_operation。无认证请求遇302时不访问跳转目标，保持草稿，端点恢复后重新确认可成功。errors为空、聊天草稿保持，测试未保存提供方或调用外部模型，管理权限已收回并保留聊天授权。此次未修改生产代码/APK；已有提供方stored认证、断线/收权/过期等实际生命周期尚需补验，不以本次结果推定通过。

部署及真实首验：插件0.1.73经原CLI安装。首次命令缺profile、补参数后lockfile重命名失败；停DSH后重新安装成功，保留原日志，不绕开原包管理器。DSH按原参数重启至58864，网关更新构建后重启至66820，新APK覆盖安装MuMu，原绑定保留。[实际Android驱动](../../scripts/verify-model-probe-android.mjs)在正式Remote→电脑设置→新增提供方入口，先核对目标再执行，电脑经真实网关/Host请求本机HTTP `/v1/models`，无认证头，返回候选加入草稿；没有创建或保存提供方、没有调用外部模型。03:12本地时间[报告](../../artifacts/model-probe-android.json)actualDiscovery/chatDraftPreserved=true、errors为空；原生管理权限随后收回且聊天授权保留。首次驱动的协议选择器超时报告保留，改用已有页面回归同款combobox定位后通过。仅证明新增无认证路径；临时Key原生输入/取消、通用桥拒绝、已有stored认证及异常路径仍未实测，下方“未部署”是历史阶段。

能力与原生桥进展：[Host引擎](../../../plugin/src/model-probe.ts)通过原Runtime空目标验证专用注册：原Runtime先查注册再拒绝无目标，不进入发现回调、不发网络。RemoteAdapter协商返回 `providerModelProbe`；无服务、无凭据版本、未注册或卸载后为false。[44项Host/Adapter回归](../../../plugin/artifacts/model-probe-capability.log)包含原Runtime注册/卸载和真实Adapter协商路径；[类型检查](../../../plugin/artifacts/model-probe-capability-typecheck.log)通过。新增测试首次使用错误协商字段被类型检查和用例拒绝，修正为现行version:2后完整重跑通过。

[Android桥](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)开放prepare/execute，但仅DSHM主页面可调用，固定顶层字段及none/stored认证；拒绝temporary和额外字段。临时Key仍只能由原生窗口直接发送。[Android构建/lint](../../artifacts/model-probe-bridge-build.log)通过，尚未安装新APK或验证运行时拒绝路径。配套网关、插件及APK部署和真实端到端请求是下一步；下方“协商/白名单待接”属于此前阶段。

已有提供方入口已接：[地址组件](../../src/ui/RemoteComputerEndpoint.jsx)向父表单报告当前未保存地址和可用状态，[提供方表单](../../src/ui/RemoteProviderSettings.jsx)将该地址及当前协议草稿传给模型清单/内置覆盖的共享探测组件。沿用认证确认显示提供方标识；不根据已保存origin猜测完整URL，需填写完整草稿地址。候选采用原编辑器规则，清单带入公开能力，覆盖仅带ID。[页面回归](../../artifacts/model-probe-existing-ui.log)通过实际设置入口验证草稿地址+协议、stored路由、加入模型草稿和无提前写入；新增入口及其他原页面回归同时通过。[Web构建](../../artifacts/model-probe-existing-build.log)通过。仍未部署或运行Android，能力协商与原生通用通道白名单未开放；下文“已有提供方入口待接”由本段替代。

页面进展：[客户端控制器](../../src/remote-model-probe.mjs)及[探测组件](../../src/ui/RemoteModelProbe.jsx)已接[新增提供方](../../src/ui/RemoteProviderCreation.jsx)，缺少 `providerModelProbe` 能力时隐藏。无认证模式先准备并显示目标/协议，再明确执行；临时模式只调用原生窗口，页面不接收Key。地址、协议、认证来源及设置事件变化清除旧确认/候选并取消在途；加入候选只更新草稿，保留已有填写内容，只移除完全空白的初始行。[共享候选控件](../../src/ui/RemoteModelCandidates.jsx)同时用于原模型清单及覆盖编辑器，维持搜索、隐藏选择和批量选择规则。

[正式设置页面回归](../../scripts/verify-provider-settings.mjs)经隔离响应验证新增入口的目标变化、执行确认、候选带入、无保存及原生取消保留草稿；完整回归通过，报告 [model-probe-ui-regression.log](../../artifacts/model-probe-ui-regression.log)。[客户端4项测试](../../tests/remote-model-probe.test.mjs)及[Web构建](../../artifacts/model-probe-ui-build.log)通过。这是页面/客户端证据，不等同真实Host或Android探测验收；尚未部署，能力协商、原生通用操作白名单及已有提供方草稿入口仍待接入。以下为此前阶段记录，当前状态以本段为准。

Android进展：[原生临时探测窗口](../../android/app/src/main/java/dev/dshmobile/validation/RemoteModelProbe.kt)和RemoteBridge的`modelProbe.temporary/cancel`已接入源码。页面只提供baseURL/api；原生先发prepare，核对Host返回的同一目标、协议、temporary来源、UUID及有效期，再显示密码窗口。窗口禁止截图/自动填充/保存输入，提交清空，不调用凭据存储；Host结果在原生先消费，仅接受固定候选字段或通用失败，关闭/断线发送取消并清理。中英文本与语言刷新已接。[Android构建及lint](../../artifacts/model-probe-native-build.log)通过，但本批尚未安装或运行窗口验收，不能宣称临时Key端到端已验证；页面、能力协商及配套网关/插件部署继续。

端点分支已补齐：[v2兼容增量](../../../plugin/compatibility/model-discovery/README.md#端点探测增量2026-10-02已安装)固定跳过内置目录并拒绝跳转，Host改用新命名空间。5项实际编译插件/安装测试及Adapter与引擎42项回归通过，本机增量已安装、DSH50360和原权限状态正常。此前“内置目录绕开待实现”由此专项替代；原生临时Key、页面与整条Remote探测仍未接入。

通道进展：协议联合类型、网关管理检查及RemoteAdapter已接入源码，Host只在当前已验证管理请求且signal未取消时允许引擎操作；复用computerKey的凭据版本源。Host断开dispose清空；手机新连接无法使用旧连接快照，剩余快照五分钟过期。[真实HTTP/WS权限及协议5项](../../../backend/artifacts/model-probe-permissions.log)通过；[Adapter和引擎回归](../../../plugin/artifacts/model-probe-adapter.log)覆盖无权拒绝、缺服务、准备/执行、连接隔离、一次消费与dispose。两项目类型检查通过。尚未部署新网关/插件、未声明手机能力或接Android；原生Key、内置目录绕开与端到端探测继续。下方未接Adapter/白名单的描述是此前阶段记录。

Host进展：[ModelProbe](../../../plugin/src/model-probe.ts)已实现设备归属、五分钟有效期、单次消费、配置/服务身份/凭据版本对照、同设备在途互斥、失效取消及公开候选投影。快照不存临时Key；临时/无认证不带provider，沿用认证才取已登记路由。[4项测试](../../../plugin/artifacts/model-probe-host.log)通过，使用原SettingsProvider与受控发现服务验证生命周期，类型检查通过；不等同真实网络或Android验证。该类尚未接入RemoteAdapter，管理回调和凭据版本源、撤销/断线invalidate仍需接线，不能宣称权限端到端生效。

协议进展：[严格草稿协议](../../../backend/packages/protocol/src/remote-model-probe.ts)已导出但未加入Remote操作白名单。prepare只接受HTTP/HTTPS目标、原支持的三种协议及none/temporary/stored认证来源，stored才允许提供方标识；执行只接受快照、confirmed=true及匹配模式，临时Key不能进入准备请求，执行不能替换地址/提供方。准备响应不含凭据，候选复用既有唯一ID/容量约束。[3项协议测试](../../../backend/artifacts/model-probe-protocol.log)通过；协议构建及后端类型检查通过。尚需Host一次性快照、过期/版本/权限隔离、网关和原生转发接入，不将schema测试当实际安全路径完成。内置目录优先返回的行为还需在端点探测专用调用中明确绕开，以免把目录结果当成草稿端点结果。

后续实现进展：[受限发现兼容补丁](../../../plugin/compatibility/model-discovery/README.md)已安装本机DSH；8项发现器、4项安装恢复及实际编译插件注册/卸载测试通过。两种协议跳转均无第二目标请求，原入口保持默认行为。DSH按原参数重启至58624，3080及原管理状态正常、日常设备management=false。准备/执行协议及Android接入仍待完成，下文“无兼容补丁”是基线核验时的历史状态。

状态：原实现行为已核验，草稿发现尚未接入；维护角色：项目协作Agent。来源：[原发现器](../../../deepseek-harness/packages/llm/llm-pi-ai/src/discovery.ts)、[原注册与profile解析](../../../deepseek-harness/packages/llm/llm-pi-ai/src/index.ts)、[实际本机HTTP测试](../../../plugin/tests/provider-model-discovery.test.ts)、[5项结果](../../../plugin/artifacts/model-draft-discovery-baseline.log)。测试编译原发现器，经原LlmRuntime调用；profile解析夹具按原index的有路由/无路由分支提供测试值，不读取用户配置或Key。

- 不带provider的草稿使用给定地址、协议和临时Key，不读取旧凭据或部署headers；省略Key时无认证请求头。配置未改变。
- 携带已配置provider时，临时Key覆盖旧Key解析，但部署headers仍保留。不能把“临时Key模式”实现为旧路由加apiKey，否则会夹带其他认证字段。
- 内置provider优先返回内置目录，不访问草稿地址；若用户明确测试草稿端点，需要区分端点探测和内置目录，不能把目录成功当端点鉴权成功。
- 原fetch默认跟随重定向。两个独立本机HTTP服务复现Anthropic的x-api-key被带到另一个端口；仅使用虚构值。该测试通过是在记录需要处理的上游行为，不是证明Remote草稿探测安全。

接入方案：保留原发现器的解析与协议能力，通过兼容补丁为Remote探测提供明确的重定向拒绝选项，默认原行为不变；新能力协商缺失时不开放草稿入口。Host准备请求时固定目标、协议、认证来源与配置版本，手机核对后才执行。临时Key由原生窗口短暂持有并直达绑定通道，不进入页面、凭据存储或日志；临时Key/无认证模式省略provider，已有认证模式明确显示沿用电脑配置并校验版本。取消、收权、连接更换与配置变化使准备结果失效。

直接复用旧路由虽改动少，但已被以上测试证明会附带旧headers且自动跳转；采用固定准备/执行通道与兼容选项增加协议和原生测试成本，可保留用户确认目标及现有Key边界。下一步先实现并验证重定向选项，再接协议、Host、原生窗口和两个草稿入口。当前没有新增生产API、兼容补丁或APK，不修改已部署服务，也不据此宣布原models整包完成。

### 模型候选搜索与批量选择（2026-10-02）

共用编辑器按ID/名称做去首尾空格、不区分大小写的包含匹配。选择/取消只作用于当前结果，隐藏的已选项保留；加入草稿采纳全部已选且尚未存在的模型，不自动保存。相比单独新增选择弹窗，复用现有fieldset保持两种编辑入口和草稿生命周期一致，不增加协议或凭据通道。

[页面回归](../../artifacts/model-candidate-search-web.log)通过，覆盖模型清单和内置覆盖的名称/ID搜索、当前结果选择/取消、无匹配禁用、隐藏选择保持、去重及不产生写请求。旧脚本补齐空插槽和事件接口，选择器跟随当前可见表单，避免已保留的隐藏草稿干扰。Web构建、[Android构建/lint](../../artifacts/model-candidate-search-android-build.log)通过。

新版APK覆盖MuMu，[实际驱动](../../scripts/verify-model-candidate-search-android.mjs)于18:12:07Z通过正式Remote电脑设置入口，[报告](../../artifacts/model-candidate-search-android.json)确认两个入口均读取39个原内置目录候选、筛选选择10个、隐藏选择保留、重新发现排除草稿已有ID、重读丢弃未保存草稿。没有模型调用、Key输入或模型配置保存。专用无Key内置提供方已删除，聊天草稿保持，临时管理权限收回。首次ADB短暂超时及声明遮挡/旧label选择器失败未进入配置写入，修正驱动后通过；未据此改生产代码。

该专项不代表未保存地址/协议/Key的模型发现已实现，原models完整组合仍未完成。localhost网页预览仍待用户范围决定。

### 创建前结构化模型行（2026-10-02，0.1.72）

共享创建协议兼容旧string数组，并新增严格模型对象数组；不允许混合数组、重复ID、历史source、凭据或任意额外字段。名称/容量复用既有模型行约束，input只接受非空且不重复的text/image。Host沿原SettingsProvider单次创建完整profile，不改Key处理、快照归属、版本、一次消费和未知结果保护。新能力`providerCreationModelRows`只由新版Host协商；手机在旧能力下仍显示旧输入，不丢弃扩展字段后偷偷降级发送。

手机新增和已有模型编辑直接共用[字段控件](../../src/ui/RemoteModelFields.jsx)，输入类型复用RemoteModelCapabilities，提交时按原parseCapacity解析K/M。新建路由暂不提供思考映射/兼容参数，这些属于已有高级编辑器；本批覆盖原创建页面的名称、容量、输入类型，未实现草稿模型发现。

- [协议3项](../../../backend/artifacts/provider-creation-rows-protocol.log)、[原SettingsProvider及pi-ai校验5项](../../../plugin/artifacts/provider-creation-rows-host.log)、[HTTP/WS管理权限2项](../../../backend/artifacts/provider-creation-rows-permissions.log)、[手机服务4项](../../artifacts/provider-creation-rows-service.log)通过。类型检查及后端/插件构建通过；拒绝旧Host结构化提交不会产生写请求。
- [页面专项](../../artifacts/provider-creation-rows-web.log)和[完整回归](../../artifacts/provider-creation-rows-full-web.log)通过，实际渲染新旧输入分支、非法零容量禁止核对、结构化提交内容准确；此处使用隔离协议响应，不冒充真实写入。Web和[Android构建/lint](../../artifacts/provider-creation-rows-android-build.log)通过。
- 插件0.1.72已通过原CLI安装，本机DSH与网关按原参数重启，正常APK覆盖安装MuMu。[实际驱动](../../scripts/verify-provider-switch-android.mjs)的`--model-rows`于17:54:09Z通过正式入口创建两个独立无Key路由；从电脑模型编辑接口读回名称、128K/8K及图文输入类型，[报告](../../artifacts/provider-switch-model-rows-android.json)structuredModelReadBack=true、errors为空。没有发起模型请求；不证明新路由能调用外部模型。
- 两个测试路由均已移除，第三份未提交草稿取消，原聊天草稿保持；管理权限已收回，聊天授权保留。当前DSH PID70388、网关73992。完整原models组合、草稿发现和候选操作继续，不凭该专项修改waiting状态。

### 新增表单生命周期（2026-10-02）

原ModelsSection明确各卡片独立保留草稿；手机在已有表单间已支持，但新增表单仍因切换卸载。现已补齐并通过正式Android连续创建及切换草稿验证，详见[目录证据](./provider-directory-current.md#新增与已有提供方之间保留草稿2026-10-02)。不以该局部修复替代原整包契约，也不开放通用settings/credentials。

### 提供方卡片刷新保留插件草稿（2026-10-02）

[RemoteProviderCard](../../src/ui/RemoteProviderCard.jsx)此前在settings、credentials和llm推送失效事件后清空结果并卸载扩展，导致插件未保存输入丢失。[修复前回归](../../artifacts/provider-card-draft-before.log)实际读到空字符串。现同一连接、同一路由的读取保留旧插件实例，核验完成前隐藏旧owner；读取失败仍保留实例，明确重试后更新。收权、换连接、换路由及插件卸载仍释放对应界面。相比直接显示旧owner，保留实例但隐藏可避免用户按过期状态交互。

[专项](../../artifacts/provider-card-draft-after.log)覆盖正常刷新、失败重试、读取中隐藏、草稿保持、收权和卸载；[完整页面回归](../../artifacts/provider-card-draft-full-web.log)、[Web构建](../../artifacts/provider-card-draft-build.log)及[Android构建/lint](../../artifacts/provider-card-draft-android-build.log)通过。共用组件覆盖官方、已配置提供方及新增内置提供方草稿入口。

新版APK已安装MuMu。17:02:01Z [实际Android报告](../../artifacts/provider-card-draft-android.json)通过正式普通→Remote→电脑设置入口，从[真实测试插件](../../tests/fixtures/live-model-footer-plugin/index.js)发出llm/adapters-updated，经原事件通道触发读取，确认隐藏再恢复、DOM实例未更换、输入保持且无页面错误。此为受控Host失效通知，不是修改真实模型配置；没有调用模型或写Key。Android实际入口验证为官方卡片，其他入口共用同一组件但本次未逐个实测；读取失败路径为隔离页面证据。测试插件已由原CLI[卸载](../../artifacts/provider-card-draft-remove.log)，临时管理收回、聊天授权保持。完整原models整包仍未接入。

### 首次引导保存凭据的Android验证（2026-10-02）

16:50:29Z [真实Android报告](../../artifacts/model-save-android.json)确认：缺少Key时打开原生密码窗口，保存后电脑原凭据服务显示已配置，引导自动结束，原聊天草稿保持。执行入口为[验收脚本](../../scripts/verify-model-missing-android.mjs)的`--save`，通过[独立Host夹具](../../tests/fixtures/live-model-readiness-plugin/index.js)核对状态，未读取凭据内容。

测试仅将官方配置临时指向已确认不存在、可写的唯一凭据引用，并保存无效测试值；没有调用模型，不证明DeepSeek API鉴权通过，也没有替换用户原Key。结束后恢复原引用及继承状态、删除测试凭据；[Host最终报告](../../artifacts/model-readiness-host.json)为disposed、changed=false、failed=false、testCredentialConfigured=false。[原CLI卸载记录](../../artifacts/model-save-plugin-remove.log)确认测试插件移除，管理权限已收回且聊天授权保留。生产代码和APK未改。

下文历史“引导保存新Key未验”由本项存储链路证据替代；有效Key的外部鉴权及原models整包接口兼容仍不能由此推断。

### Android插件跳转模型设置（2026-10-02）

16:47:00Z由原CLI安装[独立测试插件](../../tests/fixtures/live-settings-tabs-plugin/client.js)0.0.2，经真实电脑模块图在MuMu注册settings.onboarding。手机按正常步骤完成first，再点击last的“打开模型设置”，由原owner.openSection('models')进入DSHM自己的电脑设置窗口；导航值models、原生Key入口及回复上限字段均可见。[实际报告](../../artifacts/settings-onboarding-models-android.json)证明root作用域、步骤结束、返回聊天草稿保持与errors为空，[截图](../../artifacts/settings-onboarding-models-android.png)已核对。未修改设置、Key或发送模型消息，未修改生产代码/APK。

原CLI已卸载测试插件；16:47:23Z[实际移除检查](../../artifacts/settings-onboarding-removed-android.json)确认引导入口消失、聊天草稿保持。临时管理权限已收回，聊天授权保留；DSH和网关未重启。来源：[扩展验收脚本](../../scripts/verify-settings-onboarding-android.mjs)、[安装](../../artifacts/settings-models-plugin-install.log)和[卸载](../../artifacts/settings-models-plugin-remove.log)记录。此项补齐models目标的Android导航证明，不扩大为原models整包启动或引导保存新Key已通过。

### 当前设置边界的全套回归（2026-10-02）

全套手机端检查实际发现一项过时断言：[修正前报告](../../artifacts/remote-current-unit-audit.log)为415/416通过，`remote-settings-boundary`仍要求`settings/update`完全不存在。现行[共享策略](../../../backend/packages/protocol/src/remote-policy.ts)早已为Agent预设开放该管理入口，且仅允许`agent-presets`的`default`、`modeSelectionEnabled`及可选版本号；不是通用模型设置接口。

[测试](../../tests/remote-settings-boundary.test.mjs)保留原真实脱敏函数核验，并将限定预设写入单独验证：普通设备协商清单不含该入口，管理设备清单包含；任意模型/凭据namespace、Key引用、请求头、地址、错误类型、额外管理标记和负版本均拒绝。通用`settings.describe/replace/mutate`及`credentials.describe/set/unset`继续不可用。只修正测试，没有放宽生产策略或调整原models兼容状态。

[专项](../../artifacts/settings-boundary-current.log)和[完整417项](../../artifacts/remote-current-unit-audit-after.log)通过。该证据为当前协议/客户端单元检查，不是新的手机授权写入验收；原实际手机预设保存证据仍见下方。源码另核对`RemoteSettingsOnboarding.openSection('models')`进入手机设置以及provider-card/footer各自root插槽，已有专项保留其原覆盖范围；不能据本轮测试声称原models整包已兼容。

### 关闭模式选择时的生效默认值（2026-10-01）

原[AgentPresets.selectionPolicy](../../../deepseek-harness/packages/preset/agent-presets/src/index.ts)明确区分保存的用户默认值和当前生效默认值：modeSelectionEnabled=false时使用部署config.default，不使用settings.default。手机应跟随原服务返回的isDefault与会话投影，不能自行让已保存的minimal继续生效；模式查看可以保留，但选择按钮及创造模式入口禁用。

13:42 UTC正式Android通过[脚本--selection-disabled](../../scripts/verify-preset-policy-android.mjs)：临时保存minimal后关闭模式选择，真实agentPresets/list返回生效standard，手机新建的原Host投影为standard且页面选中标准模式，所有模式选择按钮禁用，并提示电脑未开启模式选择。已有联调聊天投影未变、草稿保持；见[报告](../../artifacts/preset-selection-disabled-android.json)。本次仅验证模式策略与新会话组成，没有发送模型消息。

首次测试错误地要求采用已保存minimal，原服务实际standard导致断言失败，保留[原报告](../../artifacts/preset-selection-disabled-first-android.json)。依据源码修正测试为核对真实生效默认值后重跑通过，没有修改生产策略。两次明确创建的空会话session-8c08ce6d-eb60-47af-9680-6559f823b6ce和session-abc40b91-c350-4ca8-b29a-88eaaed2aade均已从手机归档。原设置值及继承状态恢复，观察插件卸载，13:43管理权限收回、正式拒绝检查通过；DSH继续以PID31632运行。

### 创造模式导航与设置页归档恢复（2026-10-01）

实际0.1.71与已安装App通过两项原插件入口：

- [创造模式脚本](../../scripts/verify-preset-creator-android.mjs)先在DSH-TEST创建专用空会话，再从设置页点击「用创造模式创作自定义预设」。原插件复用该空会话并应用cordis，独立Host投影及手机模式一致，设置窗口关闭，最终手机归档并回到原聊天，草稿一致；见[13:36报告](../../artifacts/preset-creator-android.json)。没有发送消息，不将导航通过等同模型已经创作出预设。
- [归档设置脚本](../../scripts/verify-settings-unarchive-android.mjs)仅给上述有明确创建证据的已归档会话设置唯一标题；从正式设置页搜索、点击取消归档，行消失并显示无匹配结果，alert/pageerror为空、原草稿保持。清理经真实手机认证通道重新归档，电脑回执包含该ID；见[13:38报告](../../artifacts/settings-unarchive-android.json)。

第一次Creator测试在旧聊天尚未进入定时Host报告时读取基线，把旧聊天计入新增而中止；未点击创造模式，遗留测试空会话已从当时当前页面归档（session-945ea420-3c52-4191-a69c-292751057cb1）。脚本现等待原聊天出现在Host报告，并保存前后ID作为依据。归档脚本首次准备请求漏args包装，被实际协议拒绝；修正为既有调用格式后完整重跑通过，没有把驱动错误当成功。

正式测试会话session-86516fbd-29db-4ccf-9640-96e33f33f6a4最终保持归档。观察插件已卸载、原设置值和继承状态保持、管理权限收回。DSH当前PID64352。未修改生产代码或APK；关闭模式选择后新建及其他R14明确边界继续按完成矩阵验收。

### 新会话实际采用默认预设（2026-10-01）

13:25 UTC使用0.1.71与已安装App，从正式「电脑设置 → Agent预设」选择极简为默认，再由「新建聊天 → DSH-TEST」创建会话。扩展后的[Android脚本](../../scripts/verify-preset-policy-android.mjs)以`--new-session`执行；[独立Host观察器](../../tests/fixtures/live-preset-policy-plugin/index.js)只读原sessions和sessionProjections，核对新建的唯一ID及agentPreset投影，不替代创建或选择接口。实际结果为电脑minimal、手机极简模式，两端一致，见[独立报告](../../artifacts/preset-default-new-session-android.json)。

测试会话session-5418f260-ff61-47a8-9f7f-f9b9f85e3c74已通过手机归档，回到原联调聊天且草稿一致；未发送模型消息。原default=standard、modeSelectionEnabled=true及用户层继承状态已恢复，观察插件卸载（Host报告disposed/restored），13:26管理权限收回且正式拒绝检查通过。DSH继续以PID60144运行。未修改生产代码或APK，不替代Creator导航、设置页归档恢复、关闭模式选择后新建等其他场景的验证。

### 默认预设与模式开关（2026-10-01，0.1.71保存同步通过）

原预设页面通过settings.update写入agent-presets。共享[策略](../../../backend/packages/protocol/src/remote-policy.ts)现只允许该namespace的default和modeSelectionEnabled，校验ID、布尔值、可选非负整数版本及全部参数键；网关与Host独立要求管理权限，其他namespace、字段、replace/mutate仍拒绝。写入继续经过原[SettingsController](../../../deepseek-harness/packages/api/settings-controller/src/index.ts)，保留其校验、版本冲突和错误返回；不重做第二套设置存储。

0.1.71与新网关已安装。13:17 UTC[Android脚本](../../scripts/verify-preset-policy-android.mjs)从正式设置页切换开关、选择极简为默认，独立[Host观察插件](../../tests/fixtures/live-preset-policy-plugin/index.js)读取原设置确认写入；[报告](../../artifacts/preset-policy-android.json)可见alert与pageerror均为空，草稿保持。测试恢复原default=standard、modeSelectionEnabled=true及用户层两字段的继承状态，测试插件已卸载，[Host报告](../../artifacts/preset-policy-host.json)restored=true、command=disposed。13:18管理权限收回，[拒绝检查](../../artifacts/computer-settings-blocked-android.json)通过。

[网关/策略测试](../../../backend/artifacts/preset-policy-tests.log)5项、[Host适配测试](../../../plugin/artifacts/preset-policy-tests.log)36项、类型检查与构建通过。本次13:17未创建新会话，13:25追加的实际采用验证见上；Creator创作或设置页归档恢复仍未验。下方旧“默认预设和模式开关待接入”已由本段替代。

### 预设目录的手机承接（2026-10-01，0.1.70实际通过）

原settings/openAgentPresetDirectory有桌面时打开文件管理器，否则返回`{opened:false,path}`。手机采用后者：[preset-directory](../../../plugin/src/preset-directory.ts)从原agentPresets.resolve按ID解析用户预设，只返回其真实目录，不调用桌面打开接口，不接受目录参数。服务失效/替换、取消、非用户预设均拒绝；网关和Host独立要求管理权限。相比直接转发原打开命令，避免复制完成后的自动调用无意弹出电脑窗口，仍保留原插件的路径展示能力。

0.1.70和新网关已安装。13:11 UTC[正式Android脚本](../../scripts/verify-agent-preset-settings-android.mjs)通过查看、复制、等待真实目录路径、重入、可见alert为空、删除和原聊天草稿保持，[报告](../../artifacts/agent-preset-settings-android.json)及[截图](../../artifacts/agent-preset-settings-android.png)已核对。副本dshm-settings-147e67fc已删除，管理权限收回，[拒绝检查](../../artifacts/computer-settings-blocked-android.json)通过。未修改默认预设或模式开关。

[网关/策略测试](../../../backend/artifacts/preset-directory-tests.log)、[Host适配测试](../../../plugin/artifacts/preset-directory-tests.log)和插件类型检查通过。第一次启动验收早于DSH就绪而停在会话入口，未创建副本；确认同一进程存活并就绪后重跑通过，没有因观察超时重启进程。下方0.1.69目录错误是已修复的历史证据，不再是当前缺口；默认配置、模式开关、创作导航和归档操作仍待独立验收。

### Agent预设管理真实缺口与接入（2026-10-01，待部署复验）

**部署与实际结果更新（13:05 UTC）**：0.1.69插件、新网关和新版APK已安装。实际查看先暴露native dialog顶层与插件body portal冲突，关闭按钮被下层拦截；现[设置外壳](../../src/ui/RemoteWorkspace.jsx)复用[PanelSurface](../../src/remote-plugin-panels.jsx)及既有inert管理，保留自己的设置页和原插件弹窗。完整[页面回归](../../artifacts/preset-surface-web.log)、[构建](../../artifacts/preset-surface-build.log)和[Android构建/lint](../../artifacts/preset-surface-android-build.log)通过。

[实际报告](../../artifacts/agent-preset-settings-android.json)证明标准预设查看、专用副本创建、页面重入、删除及聊天草稿保持；副本dshm-settings-d2cac559已通过正式删除入口清理，13:06管理权限收回且拒绝检查通过。但[截图](../../artifacts/agent-preset-settings-android.png)显示复制后的`settings/openAgentPresetDirectory`被拒绝，原section-store.confirmCopy在创建后自动调用openLocation。报告errors只监听pageerror，不能掩盖这条业务错误；因此复制流程整体仍未验收完成。验证脚本现另收集并断言alertsAfterCopy为空，下一轮需在该断言下复验。

下一步核对目录入口在手机上的承接，不能因为复制成功便忽略自动后续操作；默认预设及模式开关仍待处理。下面“未部署”为早期状态，已由本段替代。

[实际Android操作](../../scripts/verify-agent-preset-settings-android.mjs)发现原预设列表可见，但查看标准模式返回`remote_operation_denied`，见[失败报告](../../artifacts/agent-preset-settings-android.json)。未进入复制阶段，未创建测试预设。原因是共享协议只开放list/select；此前设置页挂载证据不能证明预设管理可用。临时管理权限已收回，13:00 UTC[正式拒绝检查](../../artifacts/computer-settings-blocked-android.json)通过。

对照原[AgentPresets接口](../../../deepseek-harness/packages/preset/agent-presets/src/index.ts)与[文件边界](../../../deepseek-harness/packages/preset/agent-presets/src/authoring.ts)，已在[共享策略](../../../backend/packages/protocol/src/remote-policy.ts)补read/copy/deletePreset三个管理入口。只接受合法预设ID、复制名称，不接受路径、组装源码或任意设置；原Host负责存在性、可写目录、禁止覆盖和禁止删除内置预设。相比重做手机表单，此方案复用原插件局部界面及Host行为，代价是需要同步更新网关和桌面插件。未开放通用settings.update；默认预设、模式开关及打开目录仍需独立核验和接入。

[策略/真实网关HTTP与WS测试](../../../backend/artifacts/agent-preset-management-tests.log)4项通过，包含三个操作未授权拒绝、授权后正确转发；[Host适配测试](../../../plugin/artifacts/agent-preset-management-tests.log)34项通过，含独立权限与参数边界；插件类型检查通过。运行中仍为0.1.68，尚未安装本增量或实际完成手机复制/删除；下一步打包部署并运行上述专用副本脚本，不得将现有失败报告标为通过。

### 模型首次配置引导（2026-10-01，已配置电脑的Android路径通过）

**缺少Key的真实路径已补验（12:52 UTC）**：[独立Host测试插件](../../tests/fixtures/live-model-readiness-plugin/index.js)确认唯一活跃提供方为官方DeepSeek后，只将其apiKeyEnv临时指向随机、确实未配置且可写的凭据引用；不读取、写入或移除任何Key。恢复信息在修改前保存，结束按版本校验恢复原引用和用户层继承状态；不为触发场景停用其他提供方。

[实际Android脚本](../../scripts/verify-model-missing-android.mjs)通过首页引导显示、原生密码窗口打开取消、稍后跳过、重进再提示、恢复配置后原事件自动结束、原聊天草稿保留。[报告](../../artifacts/model-missing-android.json)无页面错误，[截图](../../artifacts/model-missing-android.png)已核对。测试插件已卸载，[Host状态](../../artifacts/model-readiness-host.json)为disposed且changed=false，临时管理权限已收回。此测试未输入或保存新Key，不等于引导中新Key实际保存已验收。

测试脚本前两次尚未操作配置：一次停在DSH重启后的重连页，一次停在首页欢迎提示。补齐这两个实际前置状态后运行通过；重启后的自动恢复仍需按其独立范围评估，不能以手动重连证明自动恢复。

插件0.1.68增加[只读就绪投影](../../../plugin/src/model-readiness.ts)，沿原ModelsSettingsStore的目录、配置与凭据describe语义判断任意可用路由；无命名Key的活跃路由不会被误判成必须填写官方Key。只返回provider-ready、adapter-absent、credential-missing或unavailable，不回传配置、凭据引用或错误详情。网关和Host各自检查管理权限，读取期间服务、配置或凭据版本变化拒绝旧结果。

[手机引导](../../src/remote-model-onboarding.jsx)订阅原设置/凭据/适配器变化，只在缺少凭据时显示自己的窗口并复用原生Key管理入口；稍后可跳过，其他就绪结果沿原行为结束步骤。原models整包仍未启动，不扩大通用凭据或设置接口。

本机插件、网关与APK已更新。12:45 UTC [真实Android验收](../../scripts/verify-model-readiness-android.mjs)观察正式首页组件经原生桥、网关和电脑返回provider-ready，未出现Key提示，进入原测试会话后草稿保持；[报告](../../artifacts/model-readiness-android.json)无页面错误，[截图](../../artifacts/model-readiness-android.png)已核对。12:46已收回临时管理权限，[实际拒绝检查](../../artifacts/computer-settings-blocked-android.json)通过。未修改用户Key或发送模型请求。

[插件全量测试](../../../plugin/artifacts/model-readiness-full-tests.log)176项通过；[页面专项](../../artifacts/model-onboarding-web.json)覆盖缺失提示、原生窗口取消、稍后、就绪事件完成和重进不提示；[Android构建与lint](../../artifacts/model-onboarding-android-build.log)通过。缺少Key的真实电脑环境仍未验收，页面专项为隔离协议回放，不能代替该证据；原预设/归档等完整设置范围继续保留。

### 内置欢迎提示与模型就绪边界（2026-10-01）

[手机组合](../../src/remote-model-onboarding.jsx)已复用原WelcomeNoticeStore、原ui-onboarding namespace和中英文文案，使用DSHM Surface显示。仅实际模型插件目录存在、原apply尚未运行且未失败时注册welcome-notice；原apply将来启动时撤下手机注册，避免重复。依赖真实settingsScope，明确要求memory模式，不新增电脑设置写入。确认由原store在当前客户端内保留，整个客户端重建后按原远程语义重新确认，不宣称跨进程持久化。

12:29 UTC新版APK已覆盖安装，[实际Android脚本](../../scripts/verify-model-welcome-android.mjs)从普通模式打开真实Remote，返回首页显示内测声明，点击继续，再进入历史聊天并返回首页，确认不重复弹出、草稿保持，无页面错误。见[报告](../../artifacts/model-welcome-android.json)和[已查看截图](../../artifacts/model-welcome-android.png)。12:30管理授权已收回，[正式入口拒绝读取](../../artifacts/computer-settings-blocked-android.json)通过。没有输入Key、发模型请求或修改电脑业务设置。

[Web构建](../../artifacts/model-welcome-build.log)、[通用引导回归](../../artifacts/model-welcome-regression.log)、[完整页面回归](../../artifacts/model-welcome-full-web.log)及[Android构建/lint](../../artifacts/model-welcome-android-build.log)通过；页面夹具本身未注册原模型目录和settingsScope，欢迎组件的运行证据是上述真实Android验收。

首次模型配置尚未实现：原store的providerUsable/onboardingReadiness联合目录、profile命名apiKeyEnv、凭据状态、设置及凭据可写性；任意可用提供方都结束引导。无命名引用的活跃路由可能使用ADC/Bedrock或无认证网关，不能因keyConfigured=false判不可用。现有providerCard只返回configured/keyConfigured和公开目录，没有这一完整事实，也未覆盖无设置坐标的活跃路由。因此下一步需要电脑侧经审阅的只读就绪投影，复用原目录/设置/credentials.describe语义且不返回引用或Key；手机只在官方路由确实缺少可写凭据时显示现有原生Key入口。不能用官方Key单一状态或模型目录非空来伪造判断。

依据：[原onboardingReadiness及providerUsable](../../../deepseek-harness/packages/client/ui-settings-models/src/client/store.ts)、[原首次配置页](../../../deepseek-harness/packages/client/ui-settings-models/src/client/DeepSeekOnboardingDialog.tsx)、[当前卡片投影](../../../plugin/src/provider-card.ts)。原models整包仍保持waiting，欢迎提示的部分承接不改变完整兼容结论。

### 通用设置引导协调（2026-10-01）

[RemoteSettingsOnboarding](../../src/ui/RemoteSettingsOnboarding.jsx)沿原SettingsRoot以目录ready且没有mainView会话或主会话blank为进入条件；另要求在线和电脑管理授权。仅主RemoteWorkspace挂载，旁栏不重复创建。每次只渲染一个按order排序、尚未完成的settings.onboarding条目，保持root作用域；插件自己决定是否显示界面，协调器不为仍在读取的步骤画空弹窗。离开空会话/首页后清除本轮完成集合，原插件仍负责持久化自己的确认事实。

owner保留stepId/complete/openSection。openSection选择手机既有模型表单或实际注册的设置页，不加载原桌面根页面；打开另一设置页时已有设置页草稿保持。步骤切换、卸载、收权和整个协调器卸载后，旧owner不能再导航或完成。条目按实际注册对象核验，不能因同名新条目重注册就恢复旧回调。

方案沿用原owner并新增手机协调器，相比挂载原SettingsRoot，保留DSHM自己的导航、窗口和Key入口；需要自行验证步骤生命周期。没有因此开放原models所需的通用凭据/设置服务。原welcome-notice/deepseek-official仍未注册进来，下一步需复用已核验原欢迎状态及现有手机模型/原生Key入口，不能仅改waiting状态。

[专项页面测试](../../scripts/check-settings-onboarding.mjs)验证历史聊天不显示、返回首页后自动跳过无界面步骤、逆序注册按order执行、root作用域、原生手机组合的扩展/模型设置跳转、完成后重进、收权/卸载和旧回调拒绝。见[报告](../../artifacts/settings-onboarding-web.json)。首次驱动未选择历史聊天，误把首页当历史会话，断言失败；修正为实际选择one后通过，没有改变进入条件来迎合测试。

12:23 UTC新版APK已安装，[独立电脑插件](../../tests/fixtures/live-settings-tabs-plugin/client.js)通过真实模块通道注册步骤；[Android驱动](../../scripts/verify-settings-onboarding-android.mjs)实际验证自动跳过、排序、root、完成、跳转自有设置和原聊天草稿保留，无错误。见[实际报告](../../artifacts/settings-onboarding-live-android.json)和[已查看截图](../../artifacts/settings-onboarding-live-android.png)。12:24卸载插件后[入口移除](../../artifacts/settings-onboarding-removed-android.json)通过；临时管理权限收回，[拒绝读取](../../artifacts/computer-settings-blocked-android.json)通过，聊天授权保持。未发送模型消息、修改电脑业务设置或Key。

[完整页面回归](../../artifacts/settings-onboarding-full-web.log)、[Web构建](../../artifacts/settings-onboarding-build.log)、[Android构建/lint](../../artifacts/settings-onboarding-android-build.log)通过。通用协调和独立插件验证不能替代原欢迎提示、首次模型配置及任意第三方弹窗的完整验收。

### 手机设置页导航（独立插件Android通过，2026-10-01）

**原通用页问题记录（12:06 UTC，现已通过下述入口修复）**：[实际主题探测](../../artifacts/settings-sections-theme-android.json)中点击“深色”后按钮aria-pressed更新，但页面colorScheme仍light、body背景仍白色；选择已恢复，管理权限收回、聊天草稿保持。不能将该页面的原主题按钮记为有效手机设置。

根因已由源码确认：原ui-settings对非loopback使用memory SettingsScope，原ThemeRuntime写的是该scope；手机实际显示由[watchPhoneAppearance](../../src/phone-appearance.mjs)读取原生镜像驱动，权威偏好仍在普通聊天[LocalSettings](../../src/local-settings.mjs)。[RemoteBridge](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)只读取外观镜像，[OrdinaryBridge](../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryBridge.kt)提供镜像写入。仅连接原theme/change到显示会产生第二套偏好，直接开放Remote镜像写入也会被普通聊天下次同步覆盖。手机外观不写入电脑设置。

修复选择导航至已有权威入口，相比再开放一套写入服务，复用现有持久化、主题插件开关和镜像同步，代价是跨模式打开手机设置。[插槽适配](../../src/remote-plugin-slots.jsx)只将原ui-theme的appearance/font-size两行合并为「外观与语言」，其他插件条目仍保留。新的appearance.settings只接受顶层Remote自有页面、空参数，HTML预览期间拒绝；通过[ModeNavigation](../../android/app/src/main/java/dev/dshmobile/validation/ModeNavigation.kt)前移已有普通聊天Activity，不重载或销毁Remote。普通页冷启动标记与热启动事件由[OrdinaryApp](../../src/OrdinaryApp.jsx)消费，进入现有[OrdinarySettings](../../src/ui/OrdinarySettings.jsx)。没有增加镜像写权限或任意URL导航。

12:15 UTC新版APK的[真实Android脚本](../../scripts/verify-remote-appearance-settings-android.mjs)验证：带固定外观目标的冷启动、实际Remote→电脑设置→通用设置→外观与语言、重复打开、主题及字号即时同步，两个页面performance.timeOrigin保持，原聊天草稿保留，无页面错误。见[报告](../../artifacts/remote-appearance-settings-android.json)与[已核对截图](../../artifacts/remote-appearance-settings-android.png)。偏好已恢复；管理权限收回后[拒绝检查](../../artifacts/computer-settings-blocked-android.json)通过。测试未发模型请求或修改电脑业务设置。冷启动目标通过Android启动参数验证；跨模式点击走实际原生桥。

[Web构建](../../artifacts/appearance-settings-build.log)、[Android构建/lint](../../artifacts/appearance-settings-android-build.log)、[原设置页专项回归](../../artifacts/appearance-settings-web.log)及phone-appearance三个单测通过。此增量不代表原预设、归档页或onboarding已完整验收。

[原页面读取探测](../../artifacts/settings-sections-builtin-android.json)显示General、Agent预设、归档会话均可挂载，无页面错误；预设展示真实四种内置模式，归档页有真实取消归档入口。此次只读取与切换，未执行预设创作、复制或取消归档，不是这些操作的验收证明。[探测脚本](../../scripts/verify-settings-sections-android.mjs)的builtin阶段是短时观察；无报错不能外推全部异步操作成功。

[RemoteSettings](../../src/ui/RemoteSettings.jsx)现作为正式Remote电脑设置窗口的内容入口，默认保留已有模型表单。声明原settings.section后，注册页面按order/label列出，选择后通过[原root插槽](../../src/remote-plugin-slots.jsx)渲染，并沿用插件外层缩放。访问过的页面切换时保持挂载以保留草稿；卸载移除页面，当前页消失回到模型设置。管理权限或连接失效时卸载扩展。原owner.close关闭DSHM自己的设置窗口；隐藏或卸载页面持有的旧close回调不能关闭当前窗口。

[页面专项](../../scripts/check-plugin-settings-tabs.mjs)从Remote选项→电脑设置实际组件入口验证独立插件设置页、root作用域、切换保留草稿、600px内容缩放、close关闭、卸载回退和失效close。[专项日志](../../artifacts/settings-sections-web.log)、[完整页面回归](../../artifacts/settings-sections-full-web.log)与[Web构建](../../artifacts/settings-sections-build.log)通过；完整回归先于最后的失效回调保护，保护变更后专项和构建再次通过。这些仍是隔离协议页面测试，不是真实Android证据。

12:02 UTC新版APK已覆盖安装，Android构建/lint通过。MuMu正式电脑设置入口从真实电脑加载[独立插件](../../tests/fixtures/live-settings-tabs-plugin/client.js)，选择其设置页、输入草稿、切回模型表单再返回，草稿保持；root作用域没有聊天session，600px外层缩到约380px，原owner.close关闭DSHM窗口，聊天草稿保持，无页面错误。见[验证脚本](../../scripts/verify-settings-sections-android.mjs)、[实际报告](../../artifacts/settings-sections-live-android.json)、[截图](../../artifacts/settings-sections-live-android.png)、[构建日志](../../artifacts/settings-sections-android-build.log)。截图已核对设置页选择器和缩放内容确实在DSHM窗口内。

实际导航同时出现原general、agent-presets、archived-sessions条目，只证明注册可见，不代表各页内部全部操作通过。12:03卸载测试插件后其导航项消失，[移除报告](../../artifacts/settings-sections-removed-android.json)无错误；随后收回管理权限，[实际拒绝读取](../../artifacts/computer-settings-blocked-android.json)通过，保留聊天授权。测试没有修改电脑业务设置。

下一步补验原General/预设/归档页的具体功能与手机作用域，再接入onboarding的排序/complete/openSection契约。原models apply仍不启动，没有开放通用凭据或设置写入。

### 原功能与手机承接核对（2026-10-01）

“原models整包waiting”不能直接推导成缺少全部模型功能，也不能直接改成mobile当作完成。本次沿原注册入口、组件分支和手机调用位置核对如下：

| 原能力 | 手机承接 | 当前结论 |
| --- | --- | --- |
| 官方与pi-ai提供方配置、添加/移除 | RemoteComputerSettings、RemoteProviderSettings、RemoteProviderCreation/Removal | 已有专门管理入口与原Host操作，详见[配置验收](./plugin-management-current.md)；与原整页不是同一组件 |
| Key配置/移除/状态 | RemoteComputerKey及原生窗口 | 保留原生输入边界；原ProviderEditor把明文传给Web回调，不能直接替换成伪成功回调 |
| 模型列表、覆盖、发现 | RemoteProviderModelEditor与受限模型服务 | 列表三个入口同步已实测；原发现/配置证据保持，见下文 |
| 模型页footer和提供方卡片 | RemoteModelSettingsExtensions、RemoteProviderCard | 原root插槽已由手机承接，有独立实际验证 |
| settings.section中的models入口 | RemoteSettings将models目标导航到手机模型表单；原models整包未启动 | 页面回归及Android独立插件openSection('models')均通过，见[实际导航](#android插件跳转模型设置2026-10-02)；不等于原整包启动 |
| settings.onboarding中的welcome-notice、deepseek-official | installRemoteModelOnboarding注册手机组合，保留原WelcomeNoticeStore；RemoteSettingsOnboarding负责排序、complete与openSection | 已接入。已有配置跳过、缺少Key取消/稍后、恢复后结束、独立测试凭据保存及草稿保留有Android证据；不等同外部API鉴权或原整包启动 |
| 任意未知适配器的配置 | 原ProviderEditor的unknown分支仅显示提示，禁止提交 | 原版也不是通用schema表单，不能将无限第三方设置编辑扩大成此原插件的既有能力；已确认的插件契约范围保持 |

源码入口：[ProviderEditor](../../../deepseek-harness/packages/client/ui-settings-models/src/client/ProviderEditor.tsx)、[原设置Root](../../../deepseek-harness/packages/client/ui-settings-general/src/client/SettingsRoot.tsx)、[原设置注册](../../../deepseek-harness/packages/client/ui-settings-general/src/client/index.ts)、[引导owner契约](../../../deepseek-harness/packages/client/ui-settings/src/client/contract/slots.ts)、[手机插槽组合](../../src/remote-plugin-slots.jsx)。原SettingsRoot注册在sidebar.settings下；手机当前组合sidebar.footer.action、全局页面与自己的电脑设置入口，不直接承载该桌面设置Root。原ui-settings-general处于active不能证明其设置导航与引导已显示。

2026-10-02复核时，上述手机设置导航/引导组合已经实现，不能继续按旧文字重复开发。当前源码为[设置导航](../../src/ui/RemoteSettings.jsx)、[引导协调](../../src/ui/RemoteSettingsOnboarding.jsx)和[模型引导注册](../../src/remote-model-onboarding.jsx)；本轮重跑[导航契约](../../artifacts/settings-contract-audit.log)与[模型引导](../../artifacts/model-contract-audit.log)通过，均为隔离协议页面证据。Android范围分别以[独立插件导航](../../artifacts/settings-onboarding-live-android.json)、[已有模型跳过](../../artifacts/model-readiness-android.json)、[缺少Key取消及恢复](../../artifacts/model-missing-android.json)为准。下一步是补齐明确未验路径及原models整包契约差异，不是再实现同一导航。直接启动原整页仍会涉及原Web密码回调及通用镜像暴露，不能仅开放接口或改兼容状态消除缺口。

### 模型清单刷新增量（2026-10-01，三个 Android 入口通过）

源码对照发现原 index 在 settings/document-updated、llm/adapters-updated 后刷新已加载模型页；手机清单编辑器此前仅在展开或手动操作时读取。现已在[共享编辑器](../../src/ui/RemoteProviderModelEditor.jsx)订阅这两个原事件，覆盖官方清单、提供方清单和内置模型覆盖的共用入口。关闭时取消订阅；未保存草稿保持并禁止旧值提交，用户重新读取后核对。读取或模型发现期间发生变化，旧结果不再覆盖新状态，按需补读。

采用在既有受限服务之上刷新，而不为同步开放通用settings接口。已有模型发现请求可能使用电脑上已保存的配置，因此事件只触发配置读取，不会自动重复请求模型发现。

[页面脚本](../../scripts/check-key-state-sync.mjs)已在正式电脑设置组件的官方模型清单入口验证自动更新、草稿保留/禁用保存、手动核对、在途旧响应丢弃及关闭不读；[专项日志](../../artifacts/model-list-sync-web.log)、[完整页面回归](../../artifacts/model-list-sync-full-web.log)、[Web构建](../../artifacts/model-list-sync-build.log)与[Android构建/lint](../../artifacts/model-list-sync-android-build.log)通过。

11:52 UTC新版APK已覆盖安装，MuMu正式电脑设置页通过官方清单、专用自定义提供方清单、原先未配置的内置openai覆盖三个入口。[真实Host插件](../../tests/fixtures/live-model-list-plugin/index.js)调用原设置服务变更模型名称；[Android脚本](../../scripts/verify-model-list-sync-android.mjs)逐入口确认自动更新、保留手机草稿、禁止旧值保存、明确重新读取。见[实际报告](../../artifacts/model-list-sync-android.json)，无页面错误。没有发起模型请求或修改Key。

测试恢复官方完整清单与原继承状态，移除两个临时提供方，卸载测试插件，[Host报告](../../artifacts/model-list-host.json)为cleaned/disposed。管理权限收回后，[正式入口拒绝读取](../../artifacts/computer-settings-blocked-android.json)通过；原聊天草稿保持。DSH已正常重启运行。

测试工具的早期失败单独保留：启动时适配器namespace尚未注册，补充就绪等待；自定义路由不能使用内置modelOverrides，原服务正确拒绝，见[失败报告](../../artifacts/model-list-startup-failed.json)。修正为实际本机内置目录中的模型后验证通过，没有修改原配置校验或伪造目录。原模型整页兼容仍未完成。

### 原插件启动检查

旧[启动策略](../../src/remote-plugin-policy.mjs)只检查三个接口，部分能力存在时会启动实际缺少其他调用的原页。现补齐上述八项，保持模块依赖表不变；任何必需接口缺失时不启动原apply，即使管理标记存在或旧loader声称active也保持waiting。未扩大电脑允许名单，未改变原生Key链路。

- [回归测试](../../tests/mobile-plugin-layout.test.mjs)逐项移除接口，验证启动清单和展示状态一致；[修改前](../../artifacts/model-settings-gate-before.log)1失败/9通过，[修改后](../../artifacts/model-settings-gate-after.log)10通过。
- [完整页面回归](../../artifacts/model-settings-gate-full-web.log)、Web构建与[Android构建/lint](../../artifacts/model-settings-gate-android-build.log)通过。
- 新APK覆盖安装后，11:28 UTC从真实Remote进入电脑插件列表：[实际报告](../../artifacts/plugin-compatibility-inventory-android.json)为25 mobile/29 active/5 waiting，无错误，返回页面和草稿保留；[此前报告](../../artifacts/plugin-compatibility-before-model-gate.json)保留。当前电脑仍不提供通用凭据，所以本次没有启用原模型页，也不声称其功能通过。
- 实际手机证明正常现有入口未回退；八种部分接口场景由确定性策略测试覆盖，没有向真实Host开放这些接口来造验收环境。
