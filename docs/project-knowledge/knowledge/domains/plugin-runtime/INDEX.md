# 普通聊天插件验证

- 状态：技术验证中，正式手机应用未交付。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-09-22。
- 来源：[模块地图](../../../blueprint/module-map.md)、实际验证脚本及以下记录。

| 任务 | 阅读入口 |
| --- | --- |
| Remote业务操作收尾 | [KKC-18八项标准与反馈矩阵](../../../../integration/remote-operations-current.md)；功能已有本地证据，临时环境恢复状态单独记录 |
| Remote 通道与权限 | [KKC-17七项标准与真实链路证据](../../../../integration/remote-channel-current.md)；原参数、独立授权、撤销、模式隔离及外层自适应按本地范围通过 |
| Android 综合验收 | [KKC-20六项现行标准及原始证据](../../../../integration/android-experience-current.md)；本地范围通过，反馈专项另列 |
| 核心聊天与连接 | [共用组件、会话管理、双向模型与证据边界](../../../../integration/core-chat-current.md)；自然过期、待批准设备拒绝及重新配对已通过独立包真实手机入口 |
| 文件、只读输出与交付 | [五项契约及当前APK保存/分享](../../../../integration/files-delivery-current.md)；最新完整文件、附件原件、颜色证据与电脑外部应用边界分别核对 |
| 目标与电脑执行状态 | [R09五类能力及单会话释放实测](../../../../integration/execution-capabilities-current.md)；原生命周期、定时补发、子会话和工作流证据逐项核对 |
| 当前正式App队列操作 | [真实生成期间编辑/取消、自然执行及模型锁定](../../../../integration/remote-current.md#当前正式app队列操作2026-10-03)；测试会话归档、原聊天恢复，区别于提问插件接管输入框的旧驱动前提 |
| 当前Remote启动与打开聊天速度 | [真实MuMu三次测量及范围](../../../../integration/performance-current.md)；不把首屏绘制等同电脑数据就绪，不把长任务合计当作标准TBT |
| 本地验收版安装文件 | [配套产物、恢复使用与哈希核对](../../../../integration/local-delivery.md)；不等于正式发布或全功能验收通过 |
| 反馈双端同步验收 | [六类实际入口、冷状态证据、历史失败及恢复步骤](../../../../integration/feedback-current.md) |
| 核对当前剩余范围 | [收尾验收表](../../../../integration/completion-audit.md)；[整理前历史快照](../../../../integration/completion-audit-history-20261003.md)保留旧失败与待办，不作为现行清单 |
| Remote旧版草稿迁移 | [实际Android恢复、新旧冲突与验证边界](../../../../integration/draft-migration-current.md) |
| 电脑基础设置同步 | [事件重读、草稿保护与实际验证](../../../../integration/scalar-settings-sync-current.md) |
| 原模型设置整页兼容 | [依赖、密码入口差异与启动门槛](../../../../integration/model-settings-compatibility.md) |
| 配对相机权限与验收限制 | [实际MuMu权限行为与后续验证条件](../../../../integration/camera-permission-current.md) |
| PTC真实执行与历史 | [手机选择、原程序/工具层级及清理](../../../../integration/ptc-runtime-current.md) |
| 自定义模式实际工具执行 | [原模式组合、真实工具结果与正常服务恢复](../../../../integration/custom-agent-runtime-current.md) |
| 自动审核实际运行 | [原插件、手机确认、真实模型与权限恢复](../../../../integration/auto-review-current.md)；[共享取消提示与实际历史](../../../../integration/auto-review-current.md#手机取消提示与共享入口2026-09-28) |
| 模型提供方目录同步 | [打开期间原事件更新、表单保留与手机管理回归](../../../../integration/provider-directory-current.md) |
| 电脑 Key 状态同步 | [原事件、合并重读及实际电脑到手机验证](../../../../integration/key-state-current.md) |
| 插件设置分页 | [原插槽声明、受限组合与实际手机入口](../../../../integration/plugin-settings-tabs-current.md) |
| 引用菜单与草稿保留 | [原编辑器追加、主聊天/旁栏检查与真实读取](../../../../integration/reference-menu-current.md) |
| 跨工作区文件与聊天引用 | [引用身份固定、原子保存和真实模型读取](../../../../integration/workspace-reference-current.md) |
| 新建聊天的连接状态 | [离线入口、创建处理中菜单和实际恢复验证](../../../../integration/new-chat-connection-current.md) |
| 定时离线恢复与本轮导航异常 | [两个遗漏周期的实际时间、清理与后续核查](../../../../integration/schedule-missed-current.md) |
| 模型设置插件扩展 | [卡片契约、只读投影与真实手机范围](../../../../integration/provider-card-current.md) |
| 了解验证范围和进度 | [四步验证](../../../../plugin-validation/README.md) |
| 将确认页面接入真实服务 | [正式接入清单](../../../../integration/README.md)：源码差距、L/R/A 归属、开发顺序与真实 Remote 门槛 |
| 继续普通聊天真实接入与验收 | [当前实现与证据](../../../../integration/ordinary-current.md)：正式入口、原生模型、手机插件、附件、备份与剩余验收 |
| 继续 Remote 完整接入 | [Remote 当前实现与验收](../../../../integration/remote-current.md)：完整 R01–R16 矩阵、原客户端通道、独立管理权限、资源边界及 Android 验证 |
| 判断插件适用模式 | [依赖矩阵](../../../../plugin-validation/plugin-dependencies.md) |
| 核对当前 Remote 插件交付范围 | [逐模块兼容目录](../../../../integration/plugin-compatibility.md)：实际 Android 清单、安装版本来源、手机适配、功能证据及未验证边界 |
| 插件作者控制手机外层缩放 | [局部界面与自适应 API](../../../../plugin-validation/mobile-layout-api.md)：默认开启、条件注入、用户优先级与当前插槽范围 |
| 文档插件读取历史附件 | [文档与附件资源API](../../../../plugin-validation/document-resources-api.md)：独立附件地址、原注册表、三种内容模式与真实读取边界 |
| 审阅插件管理页面与异常状态 | [双端插件管理预览](../../../../design/ordinary-preview/plugins-preview.md)：仅示例交互，不代表真实安装与权限接入 |
| 继续真实电脑插件管理 | [包管理接入](../../../../integration/plugin-management-current.md)：原组件、管理授权、手机安装/启停/卸载与剩余配置边界 |
| 审阅手机设置、通知与数据操作 | [设置页预览](../../../../design/ordinary-preview/settings-preview.md)：Key/系统权限为演示，本地历史与 Remote 使用预览内存数据 |
| 核对跨页返回、草稿、连接及异常恢复 | [全流程交互核对](../../../../design/ordinary-preview/flow-audit.md)：本地设计预览的验收矩阵与修复依据 |
| 修改本地服务 | [服务契约](../../../../plugin-validation/local-services.md) |
| 修改手机主题与字号同步 | [外观接入记录](../../../../integration/appearance-current.md)：普通设置权威、原生镜像、Remote只读与冷启动 |
| 调整抽屉和实时搜索 | [独立搜索页](../../../../design/ordinary-preview/search-preview.md)，当前仅搜索普通聊天标题与正文 |
| 调整页面说明、按钮与反馈文案 | [页面文案约定](../../../../design/ordinary-preview/copy-guidelines.md) |
| 修改原生 Key、请求或历史 | [原生接入与本地历史](../../../../plugin-validation/ordinary-native.md) |
| 修改 Remote 配对与模式隔离 | [Remote 原生边界](../../../../plugin-validation/remote-native.md) |
| 运行验证、查看限制 | [实际结果](../../../../plugin-validation/results.md)、[Android 性能计划](../../../../plugin-validation/validation-plan.md) |

当前可复用的是已验证的模块加载和主题/语言设置链；不能推出任意第三方插件兼容。普通聊天不提供电脑文件树、Host 命令或 Agent 循环。
