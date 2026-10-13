# 普通聊天插件验证

固定官方alpha.2的[接口/历史依赖/交付入口审查](../../../../../../plugin/compatibility/latest-upstream/official-interface-audit.md)：只读官方源码与手机自身渲染适配分别记录；手机候选使用专用构建命令，默认命令仍为旧基线。插件0.1.80已清理两个遗留预设管理协议声明，实际管理请求在转发前拒绝，核心真实Android复验通过。

- 状态：技术验证中，正式手机应用未交付。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-10-10（纯官方附件断线、App及Host恢复；历史专项保持各自日期与范围）。
- 来源：[模块地图](../../../blueprint/module-map.md)、实际验证脚本及以下记录。

| 任务 | 阅读入口 |
| --- | --- |
| 电脑插件自适应设置 | [作者声明与用户开关](../../../../integration/official-plugin-only.md#电脑插件的自适应设置)实际通过；用户覆盖、恢复默认、正常重连、页面重载和卸载声明释放均核对，仅变换外层，内部720px尺寸/style及交互保持；其他插件与进程结束另验 |
| 历史分页在途隔离 | [真实分页回执在途切换聊天与断线](../../../../integration/official-plugin-only.md#加载历史时切换聊天与断线)通过；迟到回执实际送达，另一会话/原记录/草稿保持、无迟到错误，正常重连无旧分页自动重放，显式重试补齐三页561条原事件。源专用长会话只读；撤权/进程结束及其他生命周期另验 |
| 长聊天分页与重连 | [普通会话52轮真实回复、三页完整原事件、实际历史按钮及阅读位置/草稿保持](../../../../integration/official-plugin-only.md#长聊天记录的加载与恢复)通过；断线后包含实际审批结果的559条完整历史再加载通过。只复用现有产品，加载在途切换/撤权与其他生命周期另验 |
| 附件上传/提交中电脑退出 | [单TXT三次真实Host结束与正常启动](../../../../../../plugin/compatibility/latest-upstream/official-alpha2.md#附件上传与提交中的电脑退出与恢复2026-10-10)通过；同一手机进程/原会话、完整Blob/草稿保持，部分上传仅显式准备，未转发消息核对后系统重选新发，已接受原请求按编号清理并显示中断，明确新请求实际读取原附件并唯一回复。其他格式/多附件、steer和多端竞争另验 |
| 附件上传/提交中App结束 | [单个TXT三次实际App结束、正常Launcher恢复](../../../../../../plugin/compatibility/latest-upstream/official-alpha2.md#附件上传与提交中的app结束与恢复2026-10-10)通过；原绑定/会话、完整Blob与草稿恢复，部分上传仅显式准备、未送达核对后系统重选新发、已接受按原编号清理，无自动重传/重发。只验force-stop；单TXT的Host结束见上项，图片/多附件与其他回收策略另验 |
| 附件上传/提交断线 | [单个TXT首块上传、消息未转发与原回执丢失](../../../../../../plugin/compatibility/latest-upstream/official-alpha2.md#附件上传与消息提交断线2026-10-10)通过；完整Blob保留、上传仅显式准备、未知消息核对后系统重选新发、已接受按原编号清草稿，不自动重传/重发。真实read/模型首行回复、完整附件字节和跨会话拒绝核对；单TXT的App/Host结束见上方专项，图片/其他文件/多附件及竞争另验 |
| 普通文字发送中电脑退出 | [未转发/已接受但未确认时真实结束Host与正常启动](../../../../../../plugin/compatibility/latest-upstream/official-alpha2.md#普通消息发送中的电脑退出与恢复2026-10-10)通过；同一手机进程恢复原会话，未送达草稿只显式重试，已接受原消息清草稿、显示真实中断且不重发，显式新请求得到唯一真实回复。只覆盖纯文字queue，附件/steer/竞争另验 |
| 普通文字发送中App退出 | [未转发/已接受但未确认时真实结束、正常Launcher重开](../../../../../../plugin/compatibility/latest-upstream/official-alpha2.md#app-发送中结束与恢复2026-10-10)通过；原绑定/会话恢复，未送达草稿只显式重试，已送达按原编号确认并清草稿，无重复消息或模型回复。Host退出见上一行；附件/steer/竞争和其他回收策略另验 |
| 普通文字发送中断 | [原消息未转发、已接受但回执丢失及手机重连](../../../../../../plugin/compatibility/latest-upstream/official-alpha2.md#普通消息发送断线与回执丢失2026-10-10)通过；保留未送达草稿/显式重试，按原请求编号清理已送达草稿，原用户事件/实际回复各一次，无自动重发。App和Host结束见上方专项；附件及并发另验 |
| 官方alpha.2兼容复验 | [配套SDK、正常插件加载与真实Android核心链路](../../../../../../plugin/compatibility/latest-upstream/official-alpha2.md)已通过；主题默认值、聊天节点底部订阅与折叠控制由手机组合适配。其他扩展按新版单独复验，历史alpha.1报告保留 |
| 纯官方提问与计划发送断线 | [真正手机答案未转发、真实回执丢失后的自动恢复](../../../../integration/official-plugin-only.md#默认提问与计划答复发送断线及确认丢失)通过；原问题或单次结果、完整历史/草稿/模型保持，无旧答案重放；continued/计时答案/要求修改发送及其他类型另验 |
| 纯官方提问、计划与补答竞争 | [六次真实相反答复竞争与手机同步](../../../../integration/official-plugin-only.md#默认提问计划与超时补答的同时竞争)通过；两条独立clientId请求重叠，原工具结果或迟到补答唯一，手机撤下旧卡片、历史/草稿保持；其他审批类型/在途另验 |
| 纯官方默认提问与计划的电脑恢复 | [等待时Host结束、旧交互失效、显式新请求与结算后重启](../../../../integration/official-plugin-only.md#默认提问与计划中的电脑退出与恢复)通过；旧未知结果/原历史/草稿/模型保持，新答案/批准/要求修改结果唯一，其他工具/在途另验 |
| 纯官方带超时提问的电脑恢复 | [等待时Host结束、原问题手机补答与结算后重启](../../../../integration/official-plugin-only.md#带超时提问中的电脑退出与恢复)通过；原未知结果/日志保持、补答唯一、同一手机/草稿/模型恢复，默认提问/计划恢复见上一行，在途另验 |
| 纯官方带超时提问 | [等待期间App结束恢复、超时后补答及原记录保持](../../../../integration/official-plugin-only.md#带超时提问的app恢复与补答)通过；独立声明模式清理、原配置保持；Host退出见上一行专项，其他Host时序/在途/计时策略另验 |
| 纯官方计划审批的App恢复 | [同一原计划恢复后手机批准/要求修改、另一连接结算后旧卡片清理](../../../../integration/official-plugin-only.md#计划审批等待时app结束与恢复)四种情况通过；草稿/完整前缀与唯一结果保持，顺序旧答复幂等，Host恢复见上方专项，在途另验，竞争见独立专项 |
| 纯官方默认提问的App恢复 | [同一待回答问题恢复、另一连接答复后旧卡片清理、草稿与完整历史保持](../../../../integration/official-plugin-only.md#默认提问等待时app结束与恢复)通过；只覆盖默认legacy，timed/其他生命周期另验 |
| 纯官方审批答复在途断线 | [真实批准未转发与生产确认丢失、原审批/单次结果恢复](../../../../integration/official-plugin-only.md#普通write审批答复断线与确认丢失)通过；DSHM修复能力协商前订阅读取误使协商失效，原失败与新App核心回归保留，其他审批类型另验 |
| 纯官方Host重启与中断显示 | [普通write审批等待/结算后的官方进程树退出、手机自行重连和原事件保持](../../../../integration/official-plugin-only.md#普通write审批中的电脑端结束与恢复)；“已中断”自有页面与主聊天/旁栏回归、实际文件及旧审批边界分别记录，不扩展为全部工具或系统回收策略 |
| 纯官方审批进程恢复 | [write审批等待时独立App结束、原审批/已拒绝结果及草稿恢复](../../../../integration/official-plugin-only.md#审批等待时app结束与原会话恢复)通过；原eventId/callId、完整历史前缀、消息/结果唯一与实际文件核对，普通write的Host恢复见上方专项，其他工具Host/答复在途/其他审批类型另验 |
| 纯官方系统目标写入中断 | [真实Downloads写入时原按钮取消、生产Host断线、桌面设备撤销与完整重试](../../../../integration/official-plugin-only.md#系统目标写入时取消断线与撤权)通过；实际外部半成品/私有暂存/保存记录清理，无自动重试，其他provider/失败清理/成功回执竞争待验 |
| 纯官方系统目标写入时App结束 | [真实Downloads半成品、生产未确认提示、确认前后重开、原会话/草稿与手动完整重试](../../../../integration/official-plugin-only.md#系统目标写入时app结束与恢复)通过；启动保留外部目标，仅清理私有暂存，其他回收策略另验 |
| 纯官方手机附件 | [真实系统选择/上传、模型读取、历史文本/PDF/DOCX预览与原件保存](../../../../integration/official-plugin-only.md#手机上传与历史附件预览下载)通过；独立附件流完整字节与跨会话拒绝核对，其他附件/生命周期仍待验 |
| 纯官方系统保存窗口 | [完整暂存后的系统取消/断线关闭、清理与显式重试](../../../../integration/official-plugin-only.md#系统保存窗口取消断线与显式重试)通过；修复DSHM传输生命周期，迟到旧错误不取消新操作；目标写入中断与App结束另见上方 |
| 纯官方文件下载中断 | [取消/断线/原件变化后的真实暂存清理、系统保存最新完整字节与摘要](../../../../integration/official-plugin-only.md#文件下载中断与最新完整原件重试)通过；实际分享接收端仍待验，目标写入与附件另见上方专项 |
| 当前纯官方 Remote | [正常 pnpm、生产中转、真实 Android 的核心链路与重启复验](../../../../integration/official-plugin-only.md)通过；新菜单能力门控、独立SDK依赖/UID及原App保护有实际证据，其他扩展继续验收 |
| 纯官方完成通知与App恢复 | [实际系统通知/摘要/原会话点击、进程结束无推送、Launcher重开与新完成送达](../../../../integration/official-plugin-only.md#完成通知系统点击与app进程结束后的恢复)通过；只覆盖完成类别和独立UID force-stop，不含其他通知或所有回收策略 |
| 纯官方功能范围 | [R01–R16、协商字段及已取消扩展](../../../../../../plugin/compatibility/latest-upstream/official-feature-matrix.md)；审批/提问/计划及write等待时断线/相反答复竞争、输出、文件/Office、局部插件与部分管理、队列/停止/重连、普通会话导航已有实际证据；内容搜索需电脑开启，其余范围继续 |
| 新版子任务与原控制工具 | [显式恢复父任务后第二层手机续聊、停止保留待办与收尾释放](../../../../integration/latest-child-model.md#恢复父任务后的第二层手机续聊2026-10-07)，两种真实入口通过；历史失败、父释放后的发送限制及原安装恢复分别记录 |
| 新版安装回执恢复 | [原查询、下载/脚本取消与退出、修复中取消/完整DSH树退出/手机超时分类与详情、未知记录及测试清理](../../../../integration/latest-install-recovery.md)，两种真实入口各有证据；普通安装脚本的手机超时页另已通过，手机安装摘要冷恢复及仅Host退出仍待验，进程补丁、磁盘残留、失败和独立收尾分别记录 |
| 新版模式创作 | [实际模型生成、手机安装审批、新聊天选用与重启恢复](../../../../integration/latest-creator-model.md)，固定源码及发布入口通过，临时模式/文件清理，其余完整管理范围继续 |
| 新版通知与受阻渲染 | [发布提问/审批、两种入口受阻通知与原聊天历史、手机共享节点修复](../../../../integration/notifications-current.md#新版待办通知与受阻显示2026-10-06)，真实 Android 和回放证据区分记录，完整范围保持 |
| 新版普通聊天冷启动 | [本地ConfigForm适配、隔离输入provider与新旧页面回归](../../../../integration/latest-ordinary-boot.md)，发布与源码实际Android完整恢复及原源码/资源恢复通过 |
| 最新版 DSH 适配 | [隔离构建、真实 Web/Android 与未验证范围](../../../../integration/latest-compatibility.md)，禁止混用旧 SDK 或直接升级日常数据 |
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
| Remote草稿迁移与发送恢复 | [旧格式迁移、原发送编号核对、新引用保护与实际进程结束边界](../../../../integration/draft-migration-current.md) |
| 插件操作摘要冷恢复 | [严格保存、绑定隔离、授权核对和手机/Host都结束后的实际范围](../../../../integration/latest-install-recovery.md#手机与电脑都结束后的安装摘要)；不保存请求参数或自动重放安装 |
| 电脑基础设置同步 | [事件重读、草稿保护与实际验证](../../../../integration/scalar-settings-sync-current.md) |
| 原模型设置整页兼容 | [依赖、密码入口差异与启动门槛](../../../../integration/model-settings-compatibility.md) |
| 配对相机权限与验收限制 | [实际MuMu权限行为与后续验证条件](../../../../integration/camera-permission-current.md) |
| PTC真实执行与历史 | [手机选择、原程序/工具层级及清理](../../../../integration/ptc-runtime-current.md) |
| 自定义模式实际工具执行 | [原模式组合、真实工具结果与正常服务恢复](../../../../integration/custom-agent-runtime-current.md) |
| 自动审核实际运行 | [原插件、手机确认、真实模型与权限恢复](../../../../integration/auto-review-current.md)；[新版发布及实际源码取消与待验边界](../../../../integration/latest-auto-review.md)；[共享取消提示与实际历史](../../../../integration/auto-review-current.md#手机取消提示与共享入口2026-09-28) |
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
