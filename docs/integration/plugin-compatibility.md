# Remote 插件兼容目录

- 状态：当前安装集合的逐模块核对，**未达到全插件兼容验收**；运行状态与功能证据分别记录。
- 维护角色：DSH Mobile 项目协作 Agent。
- 核验日期：2026-10-03（香港时间）。
- 范围依据：[已确认架构第 6 节](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md#6-插件兼容承诺的可验收定义)。普通聊天的插件能力另见[普通聊天实现](./ordinary-current.md)，不得将本表的 Remote 能力外推为本地能力。

## 环境与证据口径

模型设置已按[九类具体契约](./model-settings-compatibility.md#模型设置契约核对2026-10-03)核对原入口、当前手机实现、真实Android报告与驱动断言。30项边界测试和模型扩展页面回归通过；mobile状态本身不作为证明。[手机同名包升级](./plugin-management-current.md#手机发起同名插件升级2026-10-03)已通过真实MuMu局部界面换版、交互、卸载和收权。共享Key实际替换、搜索请求等余项继续见[收尾表](./completion-audit.md)，不以“全部第三方未验证”代替具体清单。

[Subagent模型授权实际执行](./plugin-management-current.md#子任务模型授权的实际调用2026-10-03)已补齐：手机保存Flash授权后，真实新父会话Pro显式创建Flash子任务，原导出日志核对实际请求与回复；设置及临时管理均恢复。这与自定义Agent的默认继承专项分别记录，不重复以“新会话实际调用未验”作为待办。

2026-10-03 07:37:26Z从正式MuMu的“电脑插件”重新读取59项：[当前实际清单](../../artifacts/plugin-compatibility-inventory-android.json)为29 active、26 mobile、4 waiting，errors为空，关闭窗口后页面和草稿保留。settings-models现为mobile，与[组合策略](../../src/remote-plugin-policy.mjs)及[标准模型页](./model-settings-compatibility.md)一致；不再要求执行桌面apply。四项waiting分别是未授予管理权限的plugin-manager/settings-plugin-inventory、明确排除的交互终端、用户已于2026-10-03移出首版的localhost网页转发。不能将这些状态一律描述为未开发或强制启动，加载也不代表完整功能验收。

下方保留旧版本采集过程；原29 active/25 mobile/5 waiting报告保存为[本次核验前快照](../../artifacts/plugin-compatibility-before-20261003-audit.json)，旧段落中的同名报告链接已由本次报告更新，旧数值以快照为准。

本次脚本写出完整成功报告并关闭插件窗口后，在调试连接的device.close阶段未退出；已核对并仅结束检查脚本PID66900，没有重启App或DSH。不宣称脚本自然退出成功。随后只读授权检查仍为active、management=false。页面断言已完成与驱动清理异常分别记录。

2026-10-01 14:38 UTC新版APK已在MuMu覆盖安装并从普通抽屉进入Remote，[实际清单](../../artifacts/plugin-compatibility-inventory-android.json)仍为29 active/25 mobile/5 waiting，页面检查无错误。两个管理插件现明确提示当前手机缺电脑管理权限；网页面板明确提示当前版本不支持，不再暗示配置后即可使用。只调整原因文字及中英文翻译，不改变允许名单或启动规则。10项策略回归、Web及Android构建通过，三条实际原因断言通过，原联调聊天仍可进入。此前管理查询失败后同一PID9512原进程正常返回active/management=false，未重启或修改权限；短暂失败根因未证实。更早清单保存于[变更前报告](../../artifacts/plugin-compatibility-before-final-audit.json)。

2026-10-01 11:28 UTC新版APK再次读取清单，仍为29 active/25 mobile/5 waiting，无错误且页面/草稿保留；此前报告移至[模型检查变更前](../../artifacts/plugin-compatibility-before-model-gate.json)。本次补齐[原模型设置的启动接口检查](./model-settings-compatibility.md)，原整页仍waiting，没有扩大Host权限。下文17:04记录为历史核对背景，当前报告时间以JSON为准。

本次从已安装 Android App 的「Remote 选项 → 电脑插件」读取实际列表，不从测试夹具推导。环境为 MuMu Android 12、当前日常 App、电脑源码启动的 DSH 和本地网关；设备仍有聊天授权、没有管理权限。17:04 UTC 重读 59 个条目，其中 29 active、25 mobile、5 waiting，没有 failed。关闭列表后原页面和草稿保持，无页面错误。见[实际报告](../../artifacts/plugin-compatibility-inventory-android.json)、[变更前快照](../../artifacts/plugin-compatibility-before-settings-tabs.json)及[只读采集脚本](../../scripts/inspect-plugin-compatibility-android.mjs)。

下表 ID 省略共同前缀 `@deepseek-ai/dsh-`，`@dsh-mobile/plugin` 保留全名。版本 `V` 表示 **0.1.6-alpha.2**，来自正在使用的电脑安装目录对应 package.json；58 个内置条目均核对到该版本。安装目录包含兼容补丁，版本号不能代表原版字节，也不能单凭包文件证明 WebView 当前加载字节完全一致。`@dsh-mobile/plugin` 不在该 packages 目录，采集结果保留版本未知，不用项目仓库版本冒充实际版本。

- **active**：原模块已经启动，不代表每个入口、配置或异常都已验证。
- **mobile**：由 DSHM 组合原模块服务/组件并提供手机入口，原桌面 apply 不启动；不是嵌入电脑根页面。
- **waiting**：当前能力或依赖不满足，也可能是用户明确排除的桌面交互。具体原因须逐项看，不能要求用户一律在电脑启用插件。
- 表中证据代码指向下方可复查的专项。所有行均只承诺证据覆盖的行为；未覆盖项保留未验证，不自动给整包打“通过”。

## 逐模块状态

| 模块 ID | 版本 | 当前状态 | 手机处理与功能证据 |
| --- | --- | --- | --- |
| client-ui-open-in-app | V | mobile | 手机确认执行设备；电脑应用能力须协商，见 E2；不是全部桌面应用均通过 |
| api-workspace-files | V | active | 授权工作区的元数据/内容通道，见 E2 |
| client-hmr | V | mobile | 使用授权模块图更新，见 E1；不请求桌面 HMR 路由 |
| client-modules | V | active | 原模块加载器及依赖解析，见 E1 |
| cordis-client-runner | V | active | 原动态插件运行、审批及 Host 调用，见 E3 |
| client-ui-layout | V | mobile | DSHM 自有页面/移动插槽，见 E4 |
| client-ui-renderer | V | mobile | 局部渲染，不替换手机根页面，见 E4 |
| client-ui-session | V | mobile | 同一原会话与手机视图作用域，见 E4 |
| client-resources | V | active | 授权资源地址与释放，见 E2；不代表任意插件的 fetch 均兼容 |
| client-ui-sidebar | V | mobile | DSHM 自有插件页面目录，复用原 layout/main/sidebar.panellist 契约；独立插件实际导航、返回与卸载通过，见[专项](./remote-current.md#插件全局页面导航2026-09-27)。不启动桌面侧栏 apply，不恢复用户已删除的新聊天按钮；不代表所有第三方页面均兼容 |
| client-ui-sidebar-right | V | mobile | 自有旁栏、主/旁栏会话和草稿隔离，见 E4 |
| client-ui-sidebar-documentpreview | V | mobile | 原文档注册表与 ReviewTab 在手机容器中运行，见 E2 |
| client-ui-sidebar-browser | V | waiting | 完整localhost网站转发未实现；用户已于2026-10-03确认移出首版，由[KKC-21](https://linear.app/kkcodes/issue/KKC-21)后续评估；waiting不作为首版缺口 |
| client-ui-sidebar-terminal | V | waiting | 用户明确不提供交互终端；只读命令结果另见 E5，不需启动此桌面入口 |
| client-ui-sidebar-files | V | active | 已有工作区按需文件树，见 E2；不同步整机目录 |
| client-ui-settings | V | active | 原设置作用域结合手机入口，见 E6/E7；不开放通用电脑设置写入 |
| client-ui-settings-general | V | active | 运行已核对；手机外观证据见 E7，不代表该包所有桌面设置入口通过 |
| client-ui-settings-models | V | mobile | 手机持有标准models插槽及两步引导，模型编辑/草稿发现、[footer扩展](./remote-current.md#模型设置底部扩展2026-09-27)与[provider-card扩展](./provider-card-current.md)已接入；原生Key和限定管理接口保持。见[具体契约与证据](./model-settings-compatibility.md)，不是原桌面apply原样运行，也不等于任意依赖兼容。 |
| client-ui-plugin-manager | V | waiting | 本次设备无管理权限；临时授权的实际包管理证据见 E6 |
| client-ui-settings-plugin-inventory | V | waiting | 本次设备无管理权限；临时授权时原插件设置分页中的真实目录已验证，见[分页专项](./plugin-settings-tabs-current.md)和E6 |
| client-ui-settings-unarchive-sessions | V | active | 原设置页搜索、取消归档和实时更新已通过正式Android，测试聊天重新归档且草稿保持，见[专项](./model-settings-compatibility.md)；自有入口另见 E8 |
| client-ui-conversation | V | mobile | 同一原投影、消息与输入状态，见 E4/E8 |
| client-ui-approval | V | mobile | 复用原审批卡片与结算，见 E8；原服务请求期限、实际双端相反决定及[模型工具批准/拒绝](./remote-current.md#模型实际工具审批与拒绝2026-09-27)已实测，其他网络交错仍待验 |
| client-ui-chat | V | mobile | DSHM 自有聊天布局、原工厂及扩展，见 E4/E8 |
| client-ui-brand-official | V | active | 仅确认模块启动；品牌插槽逐入口功能证据不足 |
| client-ui-attachment | V | active | 原附件与文档预览，见 E2 |
| client-ui-tool | V | active | 工具记录、交付卡片与改动入口，见 E2/E5；不代表所有工具类型 |
| client-ui-cordis | V | active | 原动态插件局部面板，见 E3 |
| client-ui-workspace | V | mobile | 已有工作区导航、新聊天和受限管理，见 E4/E8；创建工作区拒绝 |
| client-ui-workflow-run | V | mobile | 原工作流记录与手机成员导航，见 E5 |
| client-ui-input-trigger | V | active | 原输入触发与编辑器接口，见 E4；[真实中文候选提交和键盘避让](./appearance-current.md#中文候选输入与键盘避让2026-10-03)已通过，网页内联composition仍未由该输入法证明 |
| client-ui-commands | V | mobile | 手机菜单和原命令执行语义，见 E4/E8；不等同任意新增命令已测试 |
| client-ui-skill | V | active | 真实技能目录、说明及草稿插入，见 E8 |
| client-ui-subagent | V | mobile | 子会话、祖先导航和自有旁栏，见 E4/E5 |
| client-ui-reference | V | active | 原候选、结构化草稿与发送序列化，见 E4；冷启动及[跨工作区引用实际读取](./workspace-reference-current.md)、[菜单追加和实际读取](./reference-menu-current.md)通过 |
| client-ui-jobs | V | active | 实际后台任务、输出和定时记录，见 E5 |
| client-ui-goal | V | active | 目标基础生命周期，见 E5；完整异常未完成 |
| client-ui-message-feedback | V | active | 读取/打开/取消已有依据；实际提交/撤回及双端图标未完成，见 E9 |
| client-ui-model-selection | V | active | 实际模型/思考强度同步，见 E8 |
| client-ui-permission-presets | V | active | 真实目录、收紧选择和危险项确认取消，见 E8；[自动审核放行、取消、真实审核拒绝与手机续聊](./auto-review-current.md)有专项证据，不外推所有策略/风险类型 |
| client-ui-agent-preset | V | active | 原目录及空会话选择见 E8；[预设设置与创造导航](./model-settings-compatibility.md)、[自定义工具及one-shot子任务继承执行](./custom-agent-runtime-current.md)已实测，不外推所有第三方模式 |
| client-ui-settings-plugins | V | mobile | 四种原配置卡片及[原设置分页](./plugin-settings-tabs-current.md)由手机组合，分页实际切换保留/缩放/卸载/收权通过；原apply不运行，未开放通用凭据，不等同任意插件设置全支持 |
| client-ui-plan | V | active | 计划批准/修改及自然超时，见 E8 |
| client-ui-user-questions | V | mobile | 原提问 UI/结算和超时，见 E8 |
| client-ui-trajectory | V | active | 原消息与工具轨迹，见 E8；完整扩展记录需各插件专项 |
| client-ui-theme | V | active | 手机偏好驱动主题，见 E7 |
| client-locale | V | mobile | 复用 LocaleRuntime 与手机语言，见 E7；不写电脑偏好 |
| client-file-upload | V | active | Android 系统选择及授权上传，见 E2 |
| api-gateway | V | mobile | 原 Gateway 使用授权载体，见 E1；不建立第二套桌面会话连接 |
| api-terminal-controller | V | active | 仅模块启动证据；交互终端不在手机范围，active 不代表可以输入命令 |
| api-remotes | V | mobile | 从实际电脑导入生成接口，见 E1 |
| client-ui-deliverables | V | mobile | 原交付卡片和手机文件/电脑打开入口，见 E2 |
| session-log-export | V | active | 原日志 ZIP 与系统保存，见 E6；大日志/深层树待验 |
| typert-registry | V | mobile | 复用原生成类型注册与 Gateway，见 E1 |
| api-session-controller | V | mobile | 同一 ClientSessions 与原命令，见 E8 |
| client-connection | V | mobile | 原连接世代跟随真实载体，见 E1 |
| api-workspace-controller | V | mobile | 已有工作区控制及导航，见 E4/E8 |
| @dsh-mobile/plugin | 未核定 | active | 本次只证明客户端条目启动；Host 配对/转发另有验收，不据此声称手机可操作其全部桌面设置 |
| client-ui-directory-picker-native | V | active | 仅模块启动证据；手机创建工作区明确排除，不将其视为可用的手机目录选择器 |

## 功能证据索引

原全局浮层` shell.overlay `已由DSHM根容器提供；独立电脑插件在真实Android上的加载、交互、缩放、跨聊天状态与卸载清理见[专项证据](./remote-current.md#插件全局浮层2026-09-27)。后续[全局页面导航](./remote-current.md#插件全局页面导航2026-09-27)已补齐 layout/main/sidebar.panellist，sidebar 当前为 mobile；两项都不代表任意第三方页面完整兼容。

这些是已存在、按具体断言使用的证据，不是本次重新执行全部专项。运行状态采集是本次新执行的检查。

| 代码 | 已核对依据与适用范围 | 尚未证明的范围 |
| --- | --- | --- |
| E1 | [真实网关/DSH 重启](../../artifacts/remote-readiness-recovery-final.json)：两类重启后原面板、草稿恢复且无页面/资源错误；[连接恢复说明](./remote-current.md#网络载体与插件连接状态同步2026-09-27) | 所有首次网络失败、任意版本组合和任意插件重启 |
| E2 | [受控原 ReviewTab 实测](../../artifacts/review-live-android.json)：双文件、左右对比、二进制/超上限提示、最新文件区分；另有[模型实际 write 轮次](../../artifacts/model-review-android.json)的单栏/左右对比与源文件删除后历史快照读取；[R10–11/R16 完成矩阵](./remote-current.md#完成矩阵)链接各真实文件/资源专项 | 受控报告与实际模型报告分别保留；各种来源和更大内存压力未全验 |
| E3 | [实际双客户端动态运行与竞争](../../artifacts/cordis-inventory-live-android.json)、[说明与清理](./remote-current.md#动态清单同步安装与双端验收2026-09-27)；[撤销边界](./remote-current.md#动态插件响应在途时撤销2026-09-27) | 专用测试插件覆盖实际 Host/手机链路，不是所有第三方动态代码；更多异常未验 |
| E4 | [输入、工厂、插槽等隔离回归](../../artifacts/remote-plugin-slots-web.json)、[手机独立插件的输入区域接管](./remote-current.md#插件输入区域接管2026-09-26)、[导航](./remote-current.md#插件工作区会话导航2026-09-26)、[引用持久化](./remote-current.md#输入引用持久化2026-09-26) | 浏览器隔离回归不能替代 Android；各手机专项的覆盖面以链接原记录为准 |
| E5 | [R09/R12 当前矩阵](./remote-current.md#完成矩阵)、[后台输出补丁](../../../plugin/compatibility/background-output/README.md)、[跨两个遗漏周期的真实恢复](./schedule-missed-current.md) | 多周期专项证明只补发最近一次并保留周期基准；不外推任意任务类型/故障恢复，不支持手机手动命令 |
| E6 | [真实包管理](./plugin-management-current.md)、[模型协议保存/请求切换](../../artifacts/provider-protocol-run-android.json)、[独立提供方Key保存/使用/移除](../../artifacts/provider-key-http-run-android.json)、[R14–15 矩阵](./remote-current.md#完成矩阵) | 管理权限须单独授予；独立本机HTTP验证不代表第三方认证、官方/共享Key替换，不开放通用 credentials/settings |
| E7 | [A05五条规则映射](./appearance-current.md#首版a05验收结论2026-10-03)、[当前字号/主题入口](../../artifacts/appearance-shortcut-android.json)、[系统主题切换](../../artifacts/phone-appearance-system-android.json)、[中文候选清理](../../artifacts/mumu-chinese-input-cleanup.json)及实际TalkBack消息/文本/审批证据 | 已确认的本地范围通过；网页内联组词、扬声器音质和任意插件/文件格式读屏未由此证明，不能仅凭ui-theme active外推全部能力 |
| E8 | [原单次工具审批](../../artifacts/remote-mobile-changes-android.json)、[原服务审批期限](../../artifacts/approval-timeout-android.json)、[双端决定](../../artifacts/approval-two-clients.json)、[模型选择](../../artifacts/remote-mobile-models-android.json)、[预设目录/锁定](../../artifacts/remote-mobile-agent-presets-android.json)、[R03–08 矩阵](./remote-current.md#完成矩阵) | 历史报告对应当时 UI；当前同名包版本不能证明任意后续变化无回归。期限/双端样例不调用模型或工具；其他网络交错仍待验 |
| E9 | [R14–15 反馈边界](./remote-current.md#完成矩阵) | 真实反馈提交/撤回未完成；不能绕过反馈目的地变更的待确认事项向默认外部遥测地址发送测试内容 |

## 后续验收与复查方法

1. 新增/升级插件后先重采实际目录，记录版本来源、实际能力和缺失依赖；没有行或没有版本依据时标记未知，不沿用旧结论。
2. 每个插件的功能证明需要覆盖该插件真实入口；加载、显示、功能、启停/卸载、重启、资源更新、拒绝/撤销分开记录。无 Host/资源能力的项目须说明“不适用”的代码依据，不能默认通过。
3. 第三方插件按具体包、版本及使用能力加入目录。当前专用验证包的证据只证明对应扩展契约，不对未知第三方包作无限兼容承诺。
4. 本表没有把 waiting 全部当成产品缺口：管理权限关闭是本次连接条件；交互终端/新工作区是明确排除；localhost网页转发已移出首版；手机设置采用原生Key及限定管理接口，不以开放通用凭据作为完成条件。layout 已由手机提供，不再列为缺少。连接权限、排除项和已确认的手机适配不可混写。

在手机已经打开 Remote 时，PowerShell 执行：

```powershell
$env:DSHM_HOST_ROOT='F:/Program Files/deepseek-harness'
$env:DSHM_ANDROID_SERIAL='emulator-5554'
node scripts/inspect-plugin-compatibility-android.mjs
```

脚本只打开/关闭实际插件列表，读取公开包元数据、状态与缺失依赖；不发模型消息、不更改权限、不读取配置密钥。重新采集会覆盖当前快照，重要历史验收应另行保留。
