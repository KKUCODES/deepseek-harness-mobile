# Remote 收尾验收表

- 状态：已确认首版本地验收范围通过；测试数据和临时环境已清理，当前为配套debug交付版。
- 维护角色：项目协作 Agent；最近核验：2026-10-04。
- 需求来源：[已确认架构与完整编号](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md)、[正式接入要求](./README.md)。按用户2026-10-03确认，R12中的localhost网站转发移出首版；文件/HTML预览与只读命令输出保留，其余已确认范围不变。
- 最近核验：当前插件目录及实际报告字段已校准，新版MuMu通过Host通知队列真实溢出后的自动恢复；当前源码自动回归为手机424、插件194、网关86及独立PostgreSQL1项通过，类型检查通过。网关过时断言修正及原失败日志见[回归证据](../../../docs/project-knowledge/validation/README.md#当前源码自动回归2026-10-03)。其余历史运行时用例未重跑，报告只证明对应版本和场景。
- 历史过程：[截至本次整理的原验收表](./completion-audit-history-20261003.md)完整保留，包括失败、恢复和被后续结果替代的待办；其他详细证据仍在[功能记录](./remote-current.md#完成矩阵)。后续更新本表的对应行，不再在顶部累加迭代流水账。

## 明确的功能缺口与下一步

**Remote 已真实接入 DSHM 自有页面，并按已确认首版范围完成本地验收。** 模型、设置、插件等功能按实际契约判断；下表记录最后工作包的完成依据，后文保留各专项环境和版本边界。

| 工作包 | 当前事实 | 下一步与完成依据 |
| --- | --- | --- |
| R14 反馈提交/撤回 | [完整真实入口矩阵](./feedback-current.md#剩余真实入口验收矩阵)六类入口通过：双向写入、原控件、归档、冷只读记录、未知结果不重放及版本冲突；收集器收到真实事件，测试评价清理 | 默认启动已由用户恢复，临时收集器停止且端口关闭，正式手机重新连接并恢复原聊天；此前错误前提下的提交风险保留记录。 |
| R13/R14 插件与共享配置收尾 | [模型九类契约](./model-settings-compatibility.md#模型设置契约核对2026-10-03)、[客户端换版](./plugin-management-current.md#手机发起同名插件升级2026-10-03)、[Subagent实际选模](./plugin-management-current.md#子任务模型授权的实际调用2026-10-03)、[共享Key/地址](./plugin-management-current.md#共享-key-与搜索地址的实际写入2026-10-03)、[真实搜索](./plugin-management-current.md#真实模型搜索与手机结果2026-10-03)及[Host升级重启边界](./plugin-management-current.md#host升级的重启边界2026-10-03)均有具体证据 | 此工作包已列的具体缺口关闭，保留各自测试边界；Host原服务要求重启，配套补丁修正误导性启用按钮，真实重启后新版本执行已证明。不外推任意第三方热更新，后续按完整编号做交付核对。 |
| R01–R16/A01–A06 最终交付 | [本地配套文件与使用说明](./local-delivery.md)及[KKC-18八项对照](./remote-operations-current.md)已建立；本轮117个Web文件、插件0.1.75、73后端文件及112个电脑补丁文件/17清单重新核对通过 | 默认服务及实际手机连接已恢复。当前仍是debug包，补丁需独立配套；历史报告保留版本边界，不冒充本轮全部重跑，不扩展为无限测试。 |

## 本次核实的已通过项

| 场景 | 核验结果与具体证据 |
| --- | --- |
| KKC-17 Remote 通道与权限 | [七项现行标准](./remote-channel-current.md)按本地范围通过；本轮手机17/插件40/网关16项通道回归及实际MuMu清单复查通过。按原报告区分Android在途撤销与受控Host/网关上传取消，不外推所有组合；业务操作和反馈仍属KKC-18/10。 |
| KKC-20 Android 设置、通知与恢复 | [六项现行标准](./android-experience-current.md)逐项通过本地验收；本轮正式App在Remote不可用期间完成真实普通聊天，清理后原17条历史摘要一致，连接/原会话/权限恢复。可关闭此任务；R14反馈和完整产品验收保持未完成。 |
| KKC-19 文件与只读命令 | [五项现行标准](./files-delivery-current.md)已逐项通过本地验收；包含实际文件撤权后的不交付和资源清理。可关闭此任务，不将反馈等其他模块缺口留在文件任务中；完整Remote目标保持未完成。 |
| R01 配对异常提示与恢复 | [当前源码独立包实测](./core-chat-current.md#配对异常与重新配对实测2026-10-04)：电脑拒绝pending设备后，手机显示授权失效；正常五分钟链接自然过期后实际领取被拒，无新设备/绑定；新链接批准后进入自有聊天并读到16条回复。两测试身份撤销、手机绑定移除，原聊天/草稿/全部原设备授权保持；不修改时钟或数据库有效期。 |
| 当前电脑补丁交付组合 | [全部维护目录的只读核对](../../../plugin/compatibility/README.md)通过：112个修改文件匹配单条变更链的最终哈希，17份manifest登记、源码启动和两个scope依赖链接一致。两个组合链回归拒绝分叉/断链/循环；不修改DSH或配置。只证明磁盘组合，功能仍按原专项，不据此宣告全产品完成。 |
| 当前APK真实Remote加载测量 | [三次MuMu测量及实际安装哈希](./performance-current.md)证明FCP中位45.3ms、LCP818.5ms、CLS0.00189；列表就绪3280.9ms、打开16回复聊天617.1ms。最长任务381ms，观察窗长任务超额合计不是TBT；没有以绘制值掩盖连接等待，保留优化空间。原聊天/草稿/授权恢复，errors为空；不代表所有负载性能通过。 |
| R13 Host升级重启边界 | [真实MuMu安装/升级和DSH重启](./plugin-management-current.md#host升级的重启边界2026-10-03)证明首次0.0.1可启用，同名0.0.2升级显示重启提示且无立即启用，重启前旧版本保持、重启后实际Host执行0.0.2。测试包卸载、原聊天/草稿恢复、管理收回并拒绝，页面错误为空；三文件补丁实际匹配，四项回归及[证据断言](../../scripts/check-plugin-restart-report.mjs)通过。 |
| R13/R14 真实模型搜索 | [手机发起及原日志](./plugin-management-current.md#真实模型搜索与手机结果2026-10-03)证明Pro实际调用一次web_search，官方搜索服务返回8条来源，手机链接与结果一致、模型引用真实来源；[只读断言](../../scripts/check-real-search-archive.mjs)通过。测试会话归档、原聊天恢复，管理权限一直关闭。 |
| R14 共享Key与搜索地址 | [正式手机与原Host服务](./plugin-management-current.md#共享-key-与搜索地址的实际写入2026-10-03)通过：搜索入口写入、官方入口替换、下一次HTTP使用新值、移除后无HTTP、地址保存/恢复、原引用与权限恢复；[只读断言](../../scripts/check-shared-key-report.mjs)通过。原Key未读取或替换；端点401不是互联网搜索成功。 |
| R13/R14 Subagent指定模型实际调用 | [正式MuMu与原电脑日志](./plugin-management-current.md#子任务模型授权的实际调用2026-10-03)证明手机允许Flash后，新父会话Pro通过真实subagent工具显式选Flash；子请求使用该模型且返回本轮标记，没有其他工具调用。默认继承、运行限制、原聊天/草稿及通知恢复，管理权限收回；日志断言脚本通过。不把设置保存或普通子任务继承当作选模执行证明。 |
| R13 手机发起插件升级 | [真实MuMu专项](./plugin-management-current.md#手机发起同名插件升级2026-10-03)：手机安装0.0.1，再提交同名0.0.2；电脑详情与实际局部界面均换版，新按钮可用、旧卡片消失且数量不重复。手机卸载、客户端目录清理、原聊天/空草稿及收权后拒绝均通过。只覆盖本地归档包更新，不外推任意依赖或脚本副作用。 |
| R14 固定模型设置与扩展 | [九类契约映射](./model-settings-compatibility.md#模型设置契约核对2026-10-03)核对原注册、当前手机实现、实际报告字段和驱动断言：创建/移除、清单/覆盖、两层兼容、协议、独立Key、草稿发现、两端刷新与卡片/页尾扩展已有具体依据。本次30项测试及扩展页面回归通过；历史Android专项未重跑，不等同所有第三方认证和模型参数效果通过。 |
| A04 首版通知 | [九条已确认行为的逐项证据](./notifications-current.md#首版通知验收结论2026-10-03)已核对原报告字段、驱动断言与生产代码，按本地范围通过，移出功能缺口。覆盖前台/后台、进程结束、去重与两端处理、摘要/公开锁屏版本、跳转恢复及权限/分类；厂商锁屏视觉、无限后台和任意多手机并发不在通过声明内。本轮没有重跑所有历史场景，也未因此宣称完整Remote完成。 |
| Android帧队列上限 | [原生PASS](../../artifacts/notice-queue-instrumentation.log)证明真实帧受控重放256条允许、257条取消，实际自动认证恢复、去重、旧回调隔离及新真实通知；[清理](../../artifacts/notice-queue-live-cleanup-android.json)保留原聊天/空草稿/授权。首次驱动断言和定位失败保留，[具体范围](./notifications-current.md#android通知排队上限与恢复2026-10-03)不等同257个真实任务洪峰。 |
| 后台停留后新待办 | [正式MuMu报告](../../artifacts/notice-background-dwell-run-android.json)：实际300119毫秒后才发出原审批/提问请求，两类后台通知标题正确，电脑取消后卡片/通知移除，草稿及进程保持。[清理](../../artifacts/notice-background-dwell-cleaned-android.json)确认测试登记移除、原聊天/草稿保持；异步卸载首次检查失败保留，边界见[专项](./notifications-current.md#五分钟后台后新待办通知2026-10-03)。 |
| R04/R09 受阻结果可见性 | [原Conversation节点与共享渲染](./notifications-current.md#聊天受阻结果显示2026-10-03)已补齐；正式MuMu真实blocked结算显示、通知关闭仍显示及历史重入通过。主/旁栏、中英文和独立草稿由页面回放验证；不伪造执行前未保存的消息。新APK已安装，临时插件卸载、原设置和聊天恢复。 |
| 失败分类通知开关 | [真实pre-step拒绝→blocked结算→手机通知](./notifications-current.md#执行失败分类的真实受阻事件2026-10-03)通过开启/关闭/恢复三阶段，保留草稿并恢复设置、原聊天；插件卸载。聊天内结果显示另有上行修复与实际验收依据。 |
| 审批提醒分类开关 | [正式MuMu三阶段](./notifications-current.md#需要批准分类关闭与恢复2026-10-03)通过：原设置入口开启/关闭/恢复，电脑原审批服务发出三次请求，后台投递/有界抑制/再次投递正确，原卡片与草稿保留。请求取消、原设置恢复、夹具卸载及聊天/工作区清理通过；不替代执行失败分类或长期后台验证。 |
| 通知标题与少量正文 | [完成通知验收](./notifications-current.md#会话标题与正文摘录2026-10-03)补齐问卷22：真实完成通知显示标题/摘录，点击进入正确自有聊天；旧协议、原生恢复与锁屏隐藏已有回归。[0.1.75实际待办验收](./notifications-current.md#待审批与提问通知标题修复2026-10-03)发现并修复插件作用域中断，正式Android审批/提问通知标题、取消后卡片/通知清理通过，原聊天/草稿/授权保持。 |
| 活跃连接实际撤权 | 独立Android测试绑定收到真实Host outcome后暂缓该帧，电脑实际撤销，手机unauthorized、旧帧丢弃、真实重连拒绝；[原生PASS/code=-1](../../artifacts/notice-epoch-revoke-instrumentation.log)、[手机拒绝/绑定清理](../../artifacts/notice-epoch-revoke-binding-cleanup.json)、[日常会话恢复](../../artifacts/notice-epoch-revoke-cleanup-android.json)均通过。[边界](./notifications-current.md#活跃连接实际撤权与迟到事件2026-10-03)不外推多设备冲突；日常授权和APK不变。 |
| 原生通知帧跨连接换代 | [实际Android生产监听器](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteNoticeEpochLiveChecks.kt)处理真实Host outcome排队后断开、旧回调迟到于新连接，[专项PASS/code=-1](../../artifacts/notice-epoch-live-instrumentation.log)；随后新真实回复正常通知。[清理](../../artifacts/notice-epoch-live-cleanup-android.json)完成。不等于当前连接遭网关实际撤权，详见[验证边界](./notifications-current.md#真实websocket事件跨原生连接换代2026-10-03)。 |
| 实际孙会话通知 | [三层真实会话](../../artifacts/notice-nested-prepare-android.json)、[最深层回复](../../artifacts/notice-nested-inspect-android.json)及[逐层返回](../../artifacts/notice-nested-verify-return-android.json)共同证明正确目标与根会话草稿保持；原标题加载时序失败保留。[设置恢复](../../artifacts/notice-nested-depth-off-android.json)、[收权后原聊天恢复](../../artifacts/notice-nested-restored-android.json)通过，不外推孙会话冷启动或在途撤权，见[范围](./notifications-current.md#嵌套孙会话的真实通知跳转2026-10-03)。 |
| 旧通知回执跨重连 | [真实原生回执暂缓3614ms后释放](../../artifacts/notice-late-reconnect-navigate-android.json)通过：正式入口断开重连后旧目标不导航、不ack，当前聊天与草稿保持；[清理](../../artifacts/notice-late-reconnect-cleanup-android.json)完成。不等同WebSocket旧帧或撤销验收。准备失败及四次草稿复查见[专项边界](./notifications-current.md#通知读取回执迟到于重新连接2026-10-03)。 |
| 系统销毁后台页面 | [真实系统销毁与后台提醒](../../artifacts/activity-destroy-prepare-android.json)、[实际通知点击恢复](../../artifacts/activity-destroy-inspect-android.json)通过：同一App进程中页面重建、正确会话/最新回复/草稿保持；[设置恢复](../../artifacts/activity-destroy-system-restored.json)及[测试清理](../../artifacts/activity-destroy-cleanup-android.json)完成。仅覆盖系统“不保留活动”，不外推自然低内存回收或长时间存活。 |
| 子会话通知冷启动 | [原故障与实际修复验收](./notifications-current.md#子会话通知冷启动修复2026-10-03)：旧进程16866退出、通知保留，实际点击启动17746并进入正确子会话；回复、返回父会话及草稿保持。共用入口98项回归通过；目录失败保护和孙会话为自动测试范围，不冒充实际嵌套通知验收。 |
| 已加载父目录的子会话通知 | [实际模型与系统通知点击](./notifications-current.md#后台子会话完成通知点击2026-10-03)：子会话回复、返回父会话与原草稿保持；独立返回/清理报告通过，保留旧选择器和标题断言失败。专用会话归档，日常16回复/空草稿及原授权保持；不等同冷启动或孙会话目标已验。 |
| 待审批/提问主动取消 | [正式Android同轮结果](../../artifacts/notice-cancel-run-android.json)证明两类真实系统提醒与原卡片清除、草稿保留；原审批cancelled、提问信号ASK_ABORTED。[清理检查](../../artifacts/notice-cancel-cleaned-android.json)确认测试工作区/会话移出列表、日常聊天和授权保留；[范围及失败记录](./notifications-current.md#电脑取消待审批与待回答2026-10-03)不外推网络在途或并发。 |
| 撤销后的旧通知点击 | [独立Android包实测](../../artifacts/notice-revoked-inspect-android.json)：进程退出后撤销，再从系统通知点击，拒绝聊天访问及重连、清除旧提醒；[恢复检查](../../artifacts/notice-revoked-restored-android.json)确认原聊天/空草稿、日常授权和通知清理，夹具已卸载。范围见[通知记录](./notifications-current.md#已撤销绑定的旧通知点击2026-10-03)，不等同活跃连接在途撤销。 |
| 聊天错误语言 | [新版MuMu中英切换](../../artifacts/workspace-errors-android.json)通过真实失效通知提示、会话/草稿保持；[完整组件回归](../../artifacts/workspace-errors-web.json)另覆盖草稿保存错误和未知插件原文。范围及清理见[外观记录](./appearance-current.md#共享聊天错误提示语言2026-10-03)，不外推完整语言或Android存储故障验收。 |
| 失效通知目标 | [实际通知点击](../../artifacts/notice-missing-inspect-android.json)显示失败提示，保留原聊天、16条回复及未发送草稿；[清理](../../artifacts/notice-missing-cleanup-android.json)恢复空草稿、临时包移除。只覆盖目标Session消失，不外推设备撤销。 |
| Host通知队列溢出 | [新版MuMu报告](../../artifacts/notice-overflow-android.json)：真实溢出错误→重连→新提醒单次投递，旧突发不回放，进程/页面/草稿保持；[清理](../../artifacts/notice-overflow-cleanup-android.json)确认插件卸载和原聊天在线。 |
| 当前插件目录 | [本次MuMu报告](../../artifacts/plugin-compatibility-inventory-android.json)：59项，29 active/26 mobile/4 waiting，模型设置为mobile，页面和草稿保留、errors为空。调试断开挂起后仅结束检查脚本，见[驱动清理边界](./plugin-compatibility.md#环境与证据口径)。 |
| 设置临时断线 | [实际网关停止/恢复](../../artifacts/settings-disconnect-android.json)：数值和地址确认草稿保留、电脑原值不变、管理收回、聊天草稿保留均为true，errors为空。 |
| 模型探测中收权 | [实际请求取消/重试](../../artifacts/model-probe-revocation-android.json)：请求取消、重连拒绝、恢复后重试、迟到结果丢弃及清理均通过。 |
| 扫码与系统拒绝 | [摄像头帧识别](../../artifacts/camera-room-android.json)和[系统拒绝](../../artifacts/camera-denial-standard-android.json)均有明确true断言；标准模拟器，不冒充物理相机。 |
| 中文候选与清理 | [输入报告](../../artifacts/mumu-chinese-input.json)证明候选提交和键盘避让；其draftEmpty=false是测试时状态，后续[清理报告](../../artifacts/mumu-chinese-input-cleanup.json)证明草稿清空及原搜狗恢复。compositionEventsObserved=false保持未验结论。 |
| 网关与DSH恢复 | [真实服务恢复](../../artifacts/remote-current-service-recovery-connected.json)ok=true、errors为空；不代表全部并发。 |
| 三类失败提醒 | [HTTP失败](../../artifacts/error-notification-live.json)、[输出上限](../../artifacts/limit-notification-live.json)、[受阻](../../artifacts/blocked-notification-live.json)均进入正确会话并清理测试配置；受控端点/请求的边界见专项。 |
| 后台连接恢复 | [实际连接恢复](../../artifacts/notice-transport-recovery-android.json)保持同进程和后台；[返回前台](../../artifacts/notice-transport-recovery-return.json)online=true、alerts为空。 |
| 进程结束后的提醒 | [force-stop报告](../../artifacts/killed-notification-live.json)：响应前进程结束、观察期间不唤醒/不通知、重开不补发历史均为true；不外推自然回收或无限时观察。 |

当前授权只读核验：运行 `node scripts/verify-desktop-management-access.mjs status` 返回 DSHM Android 为active、management=false。溢出专项临时安装/卸载测试插件、覆盖安装App并重启DSH，已恢复；没有管理授权、Key变更或模型调用，具体边界见[通知专项](./notifications-current.md#host队列溢出后的实际重连2026-10-03)。

## 逐项核对

“已有证据”表示列出的具体行为已有依据，不代表整个编号完成。完成判断还须覆盖原功能定义及下列明确未验项；历史记录中“所有异常”“任意第三方”这类笼统表述不自动增加无限测试组合，但原有具体承诺不能删除。

| 编号 | 已有实现与可复查证据 | 仍需处理或明确验证边界 |
| --- | --- | --- |
| R01 | [真实批准后自有页面](../../artifacts/remote-pair-valid-connected-android.json)、[撤销与重连拒绝](../../artifacts/remote-pair-valid-revoked-android.json)；[二维码图片识别](../../artifacts/remote-pair-scan-android.json)；[标准Android系统相机拒绝](../../artifacts/camera-denial-standard-android.json)；[虚拟相机实际识别](../../artifacts/camera-room-android.json) | API36.1原系统授权及摄像头帧识别已通过，返回链接后未自动领取；拒绝保留输入与替代入口也已有证据。见[验证边界](./camera-permission-current.md)。不冒充物理摄像头或任意光照验收。 |
| R02 | 单电脑连接、解绑、重连及[真实网关/DSH恢复](../../artifacts/remote-readiness-recovery-final.json) | 2026-10-02另有[网关与DSH实际恢复报告](../../artifacts/remote-current-service-recovery-connected.json)；后续通信修改按影响复验，不新增多电脑功能。 |
| R03 | [正文搜索与工作区范围](../../artifacts/remote-search-android.json)、[迟到搜索结果](../../artifacts/search-order-android.json)、[设置页恢复归档](../../artifacts/settings-unarchive-android.json)、[父子孙导航](../../artifacts/remote-nested-recovery-20260925-navigate.json)、[嵌套断线恢复](../../artifacts/remote-nested-recovery-20260925-watch.json)；[当前APK标题搜索降级](../../artifacts/current-search-android.json) | 当前电脑未开启正文搜索，14:42仅标题提示、工作区、归档筛选与草稿保持通过。历史正文/嵌套报告仅证明其实际环境，不冒充本轮重跑。 |
| R04 | [核心契约与驱动核对](./core-chat-current.md)已定位已有工作区新建、真实回复、改名、归档/恢复、整段及按轮分支的独立报告 | 已有工作区限制持续保留；真实新建未知结果不得自动重发。旧管理报告收尾仍加载历史，不作为最终聊天已恢复的证明。 |
| R05 | 自有共享渲染、历史分页、实时记录、复制与导出已接入；[原插件生产页面回归](../../artifacts/remote-plugin-slots-web.json)、[分页证据](./remote-current.md#插件外层测量与历史分页2026-09-27)及[当前APK真实Remote加载](./performance-current.md) | 回归是隔离协议，不替代实际手机实时记录。当前16回复打开约0.6秒、列表就绪2.8–3.7秒，最长任务381ms；首屏指标不等于全部交互或标准TBT。分页旧数据保留为基线，性能按用户要求合理区间，不擅自加严格真机门槛。 |
| R06 | [当前正式App队列编辑/取消/实际执行](./remote-current.md#当前正式app队列操作2026-10-03)已补验：当前轮自然结束后只执行修改后的消息，取消内容未进历史；原16回复/空草稿恢复、测试会话归档。停止与转引导见[原实际报告及驱动](./remote-current.md#历史分页停止与即时引导2026-09-24) | 旧独立队列报告未找到，已以本轮真实报告补足；原提问插件接管输入框时不强行穿透，队列在正常生成阶段验证。必须区分“发送前停止无回复节点”和“输出中停止”；旧失败不能因后续重跑而抹去。 |
| R07 | [双端实际决定](../../artifacts/approval-two-clients.json)、[模型工具批准/拒绝](./remote-current.md#模型实际工具审批与拒绝2026-09-27)，提问/计划自然超时已有证据 | 原服务受控请求与真实模型调用分别记录；保持单次结算与未知写入不重发。 |
| R08 | [实际模型同步](../../artifacts/remote-mobile-models-android.json)、[技能入口](../../artifacts/remote-mobile-skills-android.json)、自定义模式/权限选择已有记录；[受控自定义工具及one-shot子任务继承实际执行](./custom-agent-runtime-current.md)、[PTC只读成功/文件缺失失败、内部工具停止、重入及续聊](./ptc-runtime-current.md)通过；[自动审核实际放行、取消、受控请求真实拒绝与续聊](./auto-review-current.md)通过，电脑补丁修正停止误报拒绝；[手机中文取消提示](./auto-review-current.md#手机取消提示与共享入口2026-09-28)实际历史读取通过；[不缩放的工具详情入口](./ptc-runtime-current.md#工具详情可读性2026-10-01)已在新版MuMu读取真实长错误通过 | 内部工具同一取消reason链路已实际验证，不外推任意并发/审批组合。原插件摘要仍按既定规则缩放，完整阅读使用独立详情。不将受控单工具验证外推全部第三方模式，按电脑真实能力验收，不增造模式。 |
| R09 | [五类执行能力逐项核对](./execution-capabilities-current.md)：目标生命周期、后台停止/独立输出、定时补发、父子孙会话及工作流成功/失败/取消/重启中断均有具体报告；当前112项回归通过。新增正式MuMu单会话释放实测：原后台进程停止、手机暂停且拒绝重读、任务移出列表 | 本轮关闭明确的所属会话回收证据缺口，原聊天/草稿/授权与正常DSH恢复。历史专项未全部重跑，不把空目标状态或全局重启替代目标生命周期或单会话释放；按电脑真实能力保留版本条件，不扩展为任意插件并发验收。 |
| R10 | 上传、工作区按需浏览、引用与[完整文件下载](../../artifacts/remote-mobile-download-android.json)；冷启动及[跨工作区结构化引用实际读取](./workspace-reference-current.md)通过；[菜单引用](./reference-menu-current.md)修复卡片丢失并通过MuMu真实文件/聊天读取 | 不同步整机目录，不自动扩大允许路径；原文件/聊天引用已有实证，不外推任意第三方引用或所有存储耗尽场景。 |
| R11 | 支持的文本/图片/PDF/HTML/Office 格式已有专项；[真实模型改动预览](../../artifacts/model-review-android.json) | 格式及失败范围以具体专项为准。沙箱 HTML 文件不是整站代理，内存压力测试不等于支持无限大文件。 |
| R12 | [只读输出契约核对](./files-delivery-current.md)：原命令详情、重连续读、复制/全屏、中文输出均有实际证据；颜色明确引用foreground-ansi及output-ansi-boundary真实报告，不引用color=null的旧报告。当前文件/输出66项回归通过 | localhost网站转发未实现，用户已明确移出首版，由[KKC-21](https://linear.app/kkcodes/issue/KKC-21)后续评估，不计为首版阻塞或通过项；手机交互终端已排除。 |
| R13 | [实际动态插件目录/生命周期](../../artifacts/cordis-inventory-live-android.json)、[全局页面与叠层](../../artifacts/global-panel-live-android.json)、[包管理记录](./plugin-management-current.md) | 当前59项状态是加载/组合状态，不是全包验收。未知第三方插件按契约与具体版本核验；未适配设置能力见上。 |
| R14 | [独立提供方 Key 保存/使用/移除](../../artifacts/provider-key-http-run-android.json)、[电脑Key变化自动同步](./key-state-current.md)、[提供方目录同步与手机管理回归](./provider-directory-current.md)、[协议保存与真实请求](../../artifacts/provider-protocol-run-android.json)、[官方/搜索共享Key正式入口写入与真实HTTP](./plugin-management-current.md#共享-key-与搜索地址的实际写入2026-10-03)、固定设置和日志导出已接入 | [反馈六类入口](./feedback-current.md)实际通过并撤回，临时环境已恢复。共享Key用随机临时引用隔离用户原Key，不代表任意凭据管理或外部搜索成功。 |
| R15 | [改名、排序、确认移除、文件/聊天保留和收权](./core-chat-current.md)已逐项核对原报告与实际驱动断言 | 不把移除注册描述为删除目录；创建工作区继续排除。 |
| R16 | [五项契约与交付证据](./files-delivery-current.md)已核对；当前正式MuMu经4次历史分页打开真实附件，系统保存85字节摘要匹配，实际分享面板已查看、未选接收者；测试副本清理，原16回复/空草稿恢复 | 受控 DocumentsProvider 不等于全部系统文件提供方；Excel未知结果保持原提示，不假称所有办公应用启动通过。系统分享只证明面板打开，不保证接收App完成发送。 |
| A01 | [双模式架构和生产入口](./ordinary-current.md)；覆盖安装保留Key/历史/绑定及撤销隔离已有专项；[实际Remote连接失败期间普通模型请求](./core-chat-current.md#remote不可用时的普通聊天实测2026-10-04)已通过，17条原普通聊天逐条摘要一致，Remote恢复16条回复/空草稿 | 新增原生诊断等接口必须沿原origin/载体检查，不能泄露另一模式数据。本轮断开MuMu到中转的通道，手机模型网络保持；不冒充电脑关机或手机离线。 |
| A02 | [实际插件兼容清单](../../artifacts/plugin-compatibility-inventory-android.json)、动态失败回退/清理和错误归属已有记录 | 版本字段来自安装包元数据，不能冒充 WebView 字节哈希；等待管理权限与实际缺少能力应区别提示。 |
| A03 | 断线/首次失败/恢复/写入结果未知已有[当前矩阵](./remote-current.md#完成矩阵) | 只读可重新读取，写入仍需核对权威结果；不以自动重试掩盖未知副作用。 |
| A04 | [首版九条规则及实际证据](./notifications-current.md#首版通知验收结论2026-10-03)、[已有系统通知跨进程](../../artifacts/notification-multiple-restart-android.json)、[后台连接恢复](../../artifacts/notice-transport-recovery-android.json) | 按已确认本地范围通过。重新核对实际字段而非只读取历史总结；生产PRIVATE/公开锁屏版本有原生实证，但不外推所有厂商锁屏视觉、无限后台或全部并发。后续出现具体缺陷再重开，不把环境限制继续列作无边界功能缺口。 |
| A05 | [五条原始规则与证据映射](./appearance-current.md#首版a05验收结论2026-10-03)按本地范围通过；当前MuMu主题/字号、实际中文键盘、TalkBack消息/文件/审批、窗口焦点及系统栏均有具体依据 | 本轮修复无电脑管理权限时的手机外观入口，原偏好和草稿恢复。历史报告对应不同版本，不冒充全部重跑；内联composition、扬声器音质和任意第三方格式等是覆盖边界，不继续列作无边界功能缺口。 |
| A06 | 版本拒绝/恢复、备份迁移、覆盖安装和缓存入口已实现；[当前实际清理与重启](../../artifacts/remote-cache-android.json)保留普通统计/Key配置、Remote草稿/历史及原绑定；[正式诊断](./diagnostics-current.md)已实现并实际通过 | 旧[清理组](../../artifacts/remote-cache-after.json)原已存在，首次审计只查同名控制报告而漏引；当前已复测并将[控制组](../../artifacts/remote-cache-control-android.json)分开保存。升级迁移仍须匹配具体旧数据版本，不能仅凭APK安装成功。 |

## 继续工作的规则

1. A06 正式诊断入口已经补齐；后续字段扩展仍需白名单与来源核验，不收集完整日志、聊天或凭据来“方便排查”。下一项按上方收尾工作包及对应专项的具体未验项推进。
2. 具体缺口完成后更新其原任务与本表，并保留失败/恢复证据；已经完成的功能不因文档存在历史“待验”而重新从零实现。
3. 功能缺口、运行环境限制、用户待定项分别处理。局域网/公网部署、真机、iPhone、多电脑不因本次审计成为新增交付门槛。
4. 本地交付结论只覆盖已确认范围及所列环境；历史专项中的“完整目标继续”属于当时状态。出现具体缺陷后按对应任务重开，不将未知第三方、物理手机和公网环境泛化为已通过。
