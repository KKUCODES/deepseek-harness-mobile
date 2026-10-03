# 手机端知识总目录

版本管理：[独立仓库边界与相邻源码依赖](../../README.md#git-仓库边界)。源码、Android 工程及测试纳入本地 Git；APK、工具与联调证据留在本机，远端后续单独关联。

Remote加载测量：[当前APK三次真实MuMu连接、列表与聊天](../integration/performance-current.md)。FCP/LCP/CLS与数据就绪分别记录；保留381ms长任务与标准TBT未测边界，原聊天/草稿/权限保持。

Host插件升级：[实际重启生效、正确提示与权限清理](../integration/plugin-management-current.md#host升级的重启边界2026-10-03)通过；电脑兼容补丁已安装，无需更新APK。首次启用仍可用，需重启的升级不再误提供“立即启用”。

真实搜索：[手机发消息、电脑模型调用与外部结果](../integration/plugin-management-current.md#真实模型搜索与手机结果2026-10-03)通过。原会话ZIP证明一次工具调用与8条来源，手机链接逐项一致；测试会话归档、原聊天恢复，Key和设置未改。

共享设置：[官方/搜索共用Key原生写入与真实HTTP](../integration/plugin-management-current.md#共享-key-与搜索地址的实际写入2026-10-03)通过：保存、替换、移除、搜索地址保存及恢复，原Key不读取/替换、权限收回。只证明受控401端点下的真实传输，外部搜索与模型调用继续核对；前两轮夹具断言问题保留。

子任务选模执行：[手机授权Flash、父Pro/子Flash的真实请求及恢复](../integration/plugin-management-current.md#子任务模型授权的实际调用2026-10-03)已通过。原会话ZIP与只读断言脚本证明显式路由，测试会话归档、默认继承恢复、临时管理收回；不等于既有会话重采样或任意模型兼容。

手机插件升级：[真实同名包0.0.1至0.0.2、局部界面换版与清理](../integration/plugin-management-current.md#手机发起同名插件升级2026-10-03)通过。测试包已由手机卸载、临时管理收回，原聊天/空草稿保持；不等同任意依赖或安装脚本副作用可回滚。

模型设置范围：[九类实际契约与证据](../integration/model-settings-compatibility.md#模型设置契约核对2026-10-03)已核对。当前30项测试和模型扩展页面回归通过；已验证的固定模型功能不再笼统列为待做，共享Key/搜索请求与其余插件管理仍按收尾表推进。

手机外观与交互：[A05 五条规则的实际证据映射](../integration/appearance-current.md#首版a05验收结论2026-10-03)按本地范围通过。补齐 Remote 无管理权限时的手机外观入口，当前 MuMu 字号/主题同步及恢复通过；完整产品仍按收尾表推进。

审批读屏：[真实消息、文本文件和审批理由/拒绝回传](../integration/appearance-current.md#talkback聊天与审批理由2026-10-03)。Android 实测发现 description 字段不朗读，最终辅助名称修复已随新版 APK 验证；临时读屏组件与测试登记清理，原聊天恢复。

首版通知验收：[按九条已确认规则逐项核对](../integration/notifications-current.md#首版通知验收结论2026-10-03)，A04本地范围通过，已从当前功能缺口移除。保留不同版本和环境边界，不代表完整Remote交付；读屏、反馈及其余收尾继续按总验收表推进。

模型兼容模板：[提供方与单模型的实际保存、重读和恢复继承](../integration/model-settings-compatibility.md#模板兼容参数的实际手机保存2026-10-03)通过；独立测试路由已移除，原聊天/草稿保持，管理权限收回。仅验证固定字段存储链路，不宣称第三方模型实际使用或全部协议组合。

TalkBack语音输出：[模型入口、关闭与模型名称的实际覆盖层记录](../integration/appearance-current.md#talkback语音输出核验2026-10-03)已取得；已安装中英语音的固定文字合成通过，七项系统设置恢复、临时包卸载、原聊天和草稿保持。完整聊天读屏与扬声器听辨不由此证明。

Android通知队列：[真实帧受控回放的上限、自动重连与后续新事件](../integration/notifications-current.md#android通知排队上限与恢复2026-10-03)通过，原生PASS、旧回调隔离、实际手机清理均有证据；仅修改验收包，生产APK与日常授权保持。

反馈目的地核验：[检查模板与实际DSH进程的区别](../integration/feedback-current.md)。只读检查器现明确标注runningProcessVerified=false；已确认本机收集器端口仍监听，实际进程目的地等待用户手动准备确认，未执行反馈提交/撤回。

后台新待办：[5分钟实际停留后审批/提问通知](../integration/notifications-current.md#五分钟后台后新待办通知2026-10-03)及取消清理通过；含调试连接、屏幕开启，不外推锁屏省电或无限后台。测试登记已移除，原聊天/草稿保持；[兼容目录](../integration/plugin-compatibility.md)同步纠正中文候选、自动审核和多周期恢复的过时待验表述。

失败分类与受阻显示：[通知开关验收](../integration/notifications-current.md#执行失败分类的真实受阻事件2026-10-03)及[聊天结果修复](../integration/notifications-current.md#聊天受阻结果显示2026-10-03)通过。共享主/旁栏与中英文有页面证据，正式MuMu真实结算和历史重入通过；新APK已安装，原设置/聊天恢复、临时插件卸载。

审批提醒开关：[需要批准分类关闭与恢复](../integration/notifications-current.md#需要批准分类关闭与恢复2026-10-03)。正式MuMu通过原生设置及真实Host三阶段请求；原设置/聊天恢复，测试夹具和工作区登记已清理。

通知内容：[会话标题与正文摘录](../integration/notifications-current.md#会话标题与正文摘录2026-10-03)补齐问卷22；[0.1.75待办标题修复](../integration/notifications-current.md#待审批与提问通知标题修复2026-10-03)解决插件作用域中断，正式Android审批/提问通知及取消清理已通过。

实际撤权：[活跃通知连接收到真实事件后由电脑撤销](../integration/notifications-current.md#活跃连接实际撤权与迟到事件2026-10-03)。旧事件丢弃、真实重连与手机入口拒绝通过；独立绑定移除并停止，测试会话归档，日常授权与APK保持。

原生连接隔离：[真实WebSocket事件排队、断开与重连后旧回调](../integration/notifications-current.md#真实websocket事件跨原生连接换代2026-10-03)。真实认证和模型事件、旧数据丢弃及后续新系统通知通过，日常App未覆盖、聊天和权限恢复；不冒充网关实际在途撤权。

嵌套提醒：[实际孙会话系统通知及逐层返回](../integration/notifications-current.md#嵌套孙会话的真实通知跳转2026-10-03)。真实模型、正确最深层回复、返回父/根会话与草稿保持已核对；深度默认继承、日常聊天和权限恢复，标题时序失败保留。

通知重连：[旧原生通知读取回执跨断开重连](../integration/notifications-current.md#通知读取回执迟到于重新连接2026-10-03)。正式App实际系统通知点击、显式重连后释放旧回执，页面与草稿保持；准备失败和草稿四次复查分别保留。

后台页面销毁：[系统销毁Activity后的通知与会话恢复](../integration/notifications-current.md#android销毁后台页面后的恢复2026-10-03)。真实电脑回复、实际通知点击、同一进程重建页面及草稿恢复通过，系统设置与原聊天已恢复。

首版范围已于2026-10-03确认：不提供手机访问电脑localhost网站，后续由[KKC-21](https://linear.app/kkcodes/issue/KKC-21)评估；文件预览、HTML文件预览和只读命令输出保留。详见[当前范围](../integration/completion-audit.md)。历史记录中的网站转发待定状态以此决定为准。

冷启动子会话：[目录解析修复与实际通知重启验证](../integration/notifications-current.md#子会话通知冷启动修复2026-10-03)。共用聊天入口先确认原父目录；98项相关回归、新版MuMu通知冷启动及草稿恢复通过，嵌套目标仅有自动测试。

子会话通知：[真实模型产生的后台子会话提醒点击](../integration/notifications-current.md#后台子会话完成通知点击2026-10-03)。正确子会话、回复、返回父会话与草稿保持已核对；专用聊天归档，冷启动未加载目录与孙会话目标未验。

待办取消通知：[电脑主动取消原审批/提问后的实际清理](../integration/notifications-current.md#电脑取消待审批与待回答2026-10-03)。两类系统通知、原卡片均移除，草稿保留；夹具、专用工作区登记及测试草稿已清理。

撤销后的通知：[独立Android包进程退出后撤销并点击旧提醒](../integration/notifications-current.md#已撤销绑定的旧通知点击2026-10-03)。实际新进程拒绝聊天/重连并清理提醒；临时绑定移除，日常聊天、草稿、授权保持，服务恢复。

聊天提示语言：[共享错误显示与正式Android中英文切换](../integration/appearance-current.md#共享聊天错误提示语言2026-10-03)。固定提示翻译、未知插件错误原文保留；新版已装，测试草稿和临时插件已清理。

失效通知目标：[实际Android点击与聊天保护](../integration/notifications-current.md#点击已消失会话的通知2026-10-03)。电脑临时会话消失后点击旧通知，显示通用失败提示，原聊天/回复/草稿保留；测试草稿和插件已清理。

任务完成提醒：[正式MuMu分类开关](../integration/notifications-current.md#任务完成分类关闭与恢复2026-10-03)及[系统渠道后台禁用/恢复](../integration/notifications-current.md#android系统渠道禁用与恢复2026-10-03)分别通过。原Host独立Session受控结算，系统渠道专项明确确认事件已到达Android；设置、聊天和授权恢复，测试通知已清理。

本地验收版：[配套文件、恢复使用与产物校验](../integration/local-delivery.md)。APK内117个Web文件与dist一致，MuMu已安装APK与本地产物哈希一致；插件包运行文件一致，仍为debug构建。

反馈验收：[当前只读基线与目的地阻塞](../integration/feedback-current.md)。2026-10-03本机目的地启动再次遭自动审批拒绝，等待手动准备；未提交真实评价，收集器暂留等待。

通知溢出恢复：[真实Host队列超限、Android重连与后续投递](../integration/notifications-current.md#host队列溢出后的实际重连2026-10-03)。新版MuMu通过，临时插件卸载、原聊天在线、管理权限保持关闭；不外推手机主线程帧队列超限。

当前收尾：[逐项状态与剩余工作包](../integration/completion-audit.md)，历史过程保留在[整理前快照](../integration/completion-audit-history-20261003.md)。2026-10-03已实际重读MuMu插件目录：29 active、26 mobile、4 waiting；模型页为手机组合。下方条目保留各次专项背景，旧“未验”以当前表和对应最新证据为准。

设置草稿恢复：[临时断线保留与真实网关恢复](../integration/model-settings-compatibility.md#临时断线保留设置草稿2026-10-03)。数值/地址草稿已在 MuMu 通过，插件局部状态及离线焦点有页面回归；明确收权仍移除表单。

模型获取收权：[实际请求取消、恢复重试与空白设置修复](../integration/model-settings-compatibility.md#草稿探测收权与设置入口提示2026-10-03)。新版 MuMu 正式入口通过，原聊天与授权恢复；不等同所有生命周期组合。

TalkBack 手势：[正式 MuMu 模型入口与环境恢复](../integration/appearance-current.md#talkback-实际手势与清理2026-10-03)。焦点滑动、双击打开及关闭通过；真实朗读内容仍未验收，临时组件已卸载。

模型读屏标签：[中英文辅助名称修复及正式 Android 证据](../integration/appearance-current.md#模型按钮辅助名称2026-10-03)。主/子会话页面回归与 MuMu 主会话实际切换通过，保留模型原名和只读边界；不冒充 TalkBack 已通过。

中文候选输入：[MuMu 真实拼音候选与键盘避让](../integration/appearance-current.md#中文候选输入与键盘避让2026-10-03)。正式 Remote 输入成功、草稿清空、原输入法恢复；不等于网页内联组词或 TalkBack 已验证。

电脑基础设置：[实时更新与草稿保护](../integration/scalar-settings-sync-current.md)。原事件驱动，MuMu正式入口通过同步、核对和恢复；临时管理权限已收回。

模型设置组合：[当前调用面、原生Key边界与验证证据](../integration/model-settings-compatibility.md)。标准模型页、引导、结构化编辑和草稿发现由手机承接，桌面整页 apply 不执行；各专项证据不外推任意第三方契约或完整 Remote。

扫码权限：[当前MuMu自动授予限制](../integration/camera-permission-current.md)。系统“不允许”在扫码请求后变为允许，拒绝分支仍未实际验证；独立测试包已恢复未授权，日常绑定不变。

PTC停止：[分类修复与实际验证](../integration/ptc-runtime-current.md#ptc停止分类修复2026-10-01)。电脑补丁已安装，纯等待程序取消、部分输出保留、手机停止和续聊通过；原失败记录保留，内部工具取消竞争等范围继续。

PTC实际执行：[原模式、内层工具、结果匹配与历史重入](../integration/ptc-runtime-current.md)。MuMu只读成功、文件缺失失败、重入及失败后续聊通过；已补不缩放的工具详情入口并实际验证，原卡片缩放保留；停止与其他失败继续。

自定义模式执行：[真实模型调用专用工具、手机结果与服务恢复](../integration/custom-agent-runtime-current.md)。受控只读工具已通过实际链路，原配置/草稿保留；PTC及其他明确范围继续核验。

自动审核取消：[原版误报与电脑补丁](../integration/auto-review-current.md#审核途中取消与错误分类2026-09-28)、[手机取消提示与共享入口](../integration/auto-review-current.md#手机取消提示与共享入口2026-09-28)。工具未执行且后续可继续；新版APK实际历史中文提示通过，旁栏及备用渲染由页面回归验证。

自动审核：[原实验插件的手机确认、实际模型放行及恢复卸载](../integration/auto-review-current.md)。专用聊天真实write/read/write及文件结果通过，已恢复只读；拒绝和取消仍待验。

提供方目录：[电脑变化同步、手机草稿保留与双向入口验收](../integration/provider-directory-current.md)。已通过MuMu实际新增/改名/移除同步以及手机自己管理的回归，测试路由清理、管理收权。

Key状态：[原事件失效、读取顺序和真实手机验证](../integration/key-state-current.md)。电脑专用测试提供方设置/移除后自动更新，测试资源清理且管理权限收回；用户Key未改。

插件设置：[原分页组件、自有入口和实际手机验证](../integration/plugin-settings-tabs-current.md)。不开放通用凭据，原 settings-plugins 由手机组合；真实页签切换/缩放/卸载/收权通过。

引用菜单：[结构化草稿保留与真实读取](../integration/reference-menu-current.md)。修复“＋”菜单清除已有引用身份；MuMu聊天追加、文件选择、跨工作区后实际读取与清理通过。

跨工作区引用：[同名文件误读修复与真实模型验收](../integration/workspace-reference-current.md)。原文件引用在交接时固定来源，实际读取源文件和聊天标记通过；临时插件和测试文件已清理。

新建聊天：[离线入口根因、共享页面修复与新版 MuMu 验证](../integration/new-chat-connection-current.md)。重连期间不接受新建，恢复后快速操作目标正确；首次定时测试是否遗留空会话仍待核查。

定时遗漏恢复：[跨两个真实周期只补发一次与清理](../integration/schedule-missed-current.md)。原周期基准、单次只发一次和草稿保留通过；测试暴露新建后仍停留旧会话的异常，下一步核对导航及是否留下空会话。

模型设置扩展：[footer](../integration/remote-current.md#模型设置底部扩展2026-09-27)与[提供方卡片](../integration/provider-card-current.md)已接入自有电脑设置，保留 root 作用域、外层缩放和管理权限。卡片官方/内置草稿/自定义保存后及已有入口、Key和名称自动更新已在MuMu验证；完整原设置包兼容继续。

收尾入口：[完整编号与具体缺口](../integration/completion-audit.md)。区分功能缺失、实际验证不足、环境限制和范围待定；不以旧技术验证页代替正式入口。

问题诊断：[正式双模式入口与字段范围](../integration/diagnostics-current.md)。新版 APK 在 MuMu 通过普通/在线/断开三入口、复制刷新及返回恢复；报告不含聊天或凭据，完整 A06 继续。

窗口叠层交互：[被遮挡窗口的焦点与恢复](../integration/appearance-current.md#插件窗口叠层交互2026-09-27)。浏览器复现后修复，新版 APK 在 MuMu 验证旁栏保护、返回恢复与草稿保持；不代表完整读屏验收。

插件全局导航：[原 layout、全局页面与 Android 验收](../integration/remote-current.md#插件全局页面导航2026-09-27)。新版 APK 支持插件自己的页面切换、返回与卸载清理，主聊天和旁栏仅共用一个全局容器。

插件全局浮层：[原shell.overlay契约与手机实际验收](../integration/remote-current.md#插件全局浮层2026-09-27)。新版APK补齐局部浮层，独立电脑插件经真实模块通道加载、交互、缩放、导航与卸载通过；不加载桌面根页面。

中文命令乱码：[电脑控制台代码页与原初始化限制](../integration/remote-current.md#中文命令乱码的电脑端根因2026-09-27)。兼容补丁已安装；真实Android单次发送、独立标准/错误输出、最终结果及电脑原记录均正确，原只读权限保留。

主聊天输出撤销：[原命令窗口读取、真实响应在途撤销与旧授权拒绝](../integration/remote-current.md#主聊天命令输出在途撤销2026-09-27)。独立App与测试身份，233字节结果被丢弃，窗口清除、日常授权保留；命令受原只读沙箱限制，未提升权限或重发。

电脑 Key 实际写入：[独立提供方原生保存、电脑 HTTP 请求使用与移除](../integration/remote-current.md#电脑提供方-key-的原生保存与实际请求2026-09-27)。临时本机服务与无外部用途测试值，原生产凭据链路；测试配置清理、管理收权和原聊天保留通过，不冒充第三方认证。

模型真实差异：[实际 write 轮次的原 ReviewTab](../integration/remote-current.md#模型写入后的真实整轮差异2026-09-27)。单栏/左右内容与模型实际写入一致，源文件删除后仍读取历史快照，草稿保留；非受控事件或新模型请求。

真实工具审批：[模型发起写入，手机允许一次/拒绝的实际执行结果](../integration/remote-current.md#模型实际工具审批与拒绝2026-09-27)。批准后文件和预览一致，拒绝后原文件不变；原只读权限/空草稿保持，两轮测试文件已清理。

引用实际发送：App 冷启动后，[文件引用](../integration/remote-current.md#持久化文件引用的真实模型读取2026-09-27)和[聊天引用](../integration/remote-current.md#持久化聊天引用的真实模型读取2026-09-27)均由真实模型读取，分别返回未写入提示词的标记；源文件/来源聊天未改，收尾完成。跨工作区草稿交接后的模型读取仍待验。

审批双端：[实际电脑原页面与MuMu的同步、相反决定和单次审计](../integration/remote-current.md#原审批双端同步与相反决定2026-09-27)。两个方向拒绝及近同时相反点击通过；受控会话不执行模型/工具，测试清理完成，不外推全部弱网排序。

审批期限：[原 ApprovalService 经真实通道到手机的期限清理与下一请求](../integration/remote-current.md#原工具审批请求期限与下一请求2026-09-27)。MuMu30秒请求取消、旧卡片移除及下一次拒绝/持久审计通过；受控会话无模型/工具执行，测试插件与工作区登记已清理。

插件交付核对：[逐模块兼容目录](../integration/plugin-compatibility.md)。实际 Android 59 个条目的版本来源、状态、适配方式和功能证据分开记录；加载不等于完整兼容，网页转发仍待范围确认。

刷新与文件边界：[列表忙碌状态修复及二进制/过大改动的实际手机提示](../integration/remote-current.md#改动预览边界与刷新期间的列表状态2026-09-27)，新版APK已安装；原草稿与授权保留，测试插件清理。

整轮快照：[原 ReviewTab 的真实 Android 正向链路](../integration/remote-current.md#原整轮快照的-android-正向验收2026-09-27)，受控事件驱动原 Host Git 快照，双文件/左右对比/最新文件区分通过；临时插件清理，非模型执行验收。

服务协议：[自定义提供方确认切换与电脑真实请求同步](../integration/remote-current.md#自定义服务协议切换2026-09-27)，0.1.66及配套网关/App已安装；MuMu取消/保存/重读和OpenAI/Anthropic模型发现切换通过，完整设置继续验收。

模型覆盖保留：[已有用户行、精确容量、单项删除和过期写入的实际手机检查](../integration/remote-current.md#模型覆盖保留与过期写入的手机验收2026-09-27)。临时配置清理和权限收回通过；基础层/隐藏字段手机实测及双设备竞争仍未覆盖。

自定义模型发现：[实际电脑HTTP请求、失败/取消/重试与手机保存](../integration/remote-current.md#自定义模型发现的真实http链路2026-09-27)。受控本机无认证服务实测通过，配置/服务已清理、管理权限收回；真实第三方认证/TLS和其他协议尚未覆盖。

内置模型发现：[两个编辑入口、保存重读与恢复默认的MuMu实测](../integration/remote-current.md#内置模型发现与覆盖的真实手机验收2026-09-27)。临时内置路由已移除、管理权限已收回；自定义地址发现、已有覆盖合并等仍待验。

官方模型实际保存：[手机编辑、电脑重读、聊天目录同步与恢复](../integration/remote-current.md#官方模型清单的真实手机保存2026-09-27)。MuMu已通过名称修改与默认继承恢复，管理权限收回后拒绝设置访问、聊天草稿保留；其他模型字段及独立电脑选择器仍待验。

首次连接恢复：[协商在途断线、取消终态与真实Android对照](../integration/remote-current.md#首次装配断线与取消恢复2026-09-27)。新版APK无需已有聊天快照即可恢复初次加载，迟到事件不覆盖取消/撤销；19项页面时序和MuMu正反向验证通过，完整Remote继续。

连接状态同步：[旧清单失败回放与真实服务重启](../integration/remote-current.md#网络载体与插件连接状态同步2026-09-27)。新版APK同步撤回失效载体的原连接世代，MuMu中转/DSH重启后面板和草稿恢复通过；更广握手交错与完整Remote继续。

动态清单同步：[安装与真实双端完整专项](../integration/remote-current.md#动态清单同步安装与双端验收2026-09-27)。电脑已安装，MuMu审批竞争、停止及两端旧行移除、撤销拒绝通过；后续连接窗口修复见上。

动态审批激活竞争：[真实复现、电脑补丁与未完成收尾](../integration/remote-current.md#动态审批激活过程的并发修复2026-09-27)。启动中旧拒绝/重复批准不再抢走审批；整套脚本在移除后的清单旧行残留处失败，下一步排查刷新顺序及跨端移除通知，不视为全套通过。

动态审批双端竞争：[状态延迟下的相反审批与真实Host拒绝](../integration/remote-current.md#双端动态审批的迟到操作2026-09-27)。两个独立App实际批准后拒绝、拒绝后批准均保持先完成结果；原面板自动收起的驱动问题已修正，激活过程中的重叠竞争仍待验。

动态调用在途撤销：[真实响应暂缓、撤销清理与重连拒绝](../integration/remote-current.md#动态插件响应在途时撤销2026-09-27)。独立App实测166字节真实回声被丢弃，日常授权/入口保留；不扩大为Host副作用回滚或全部插件异常。

动态插件双端同步：[两个独立App的激活、停止、重新运行与移除](../integration/remote-current.md#动态插件的双独立客户端同步2026-09-27)。同一MuMu两个UID/凭据实测，共享Host实例、各端界面独立激活；在途调用撤销和并发竞争仍待验。

动态插件设备撤销：[运行中手机界面清理、重连拒绝与共享Host保留](../integration/remote-current.md#运行中的动态插件设备撤销2026-09-27)。独立测试设备真实配对/撤销通过，临时插件与绑定已清理，日常授权和草稿保留；调用在途回包与双端目录仍待验。

提供方真实管理：[手机新增、设置保存/重入、Key窗口取消及移除](../integration/remote-current.md#专用提供方的真实手机管理2026-09-27)。固定本机登录/插件接口完成既有授权设备的临时管理与收回；专用自定义路由实测通过，官方清单/发现/覆盖与真实Key请求仍待验。

分享复制中退出：[独立暂存、完整发布与实际Android进程恢复](../integration/remote-current.md#分享副本复制时进程结束2026-09-27)。新版APK清理旧进程的未完成副本，保留完整分享快照；实际远端附件/工作区文件回归通过，接收App异常及其他R16仍待验。

保存中进程结束：[真实首块写入后强停与双入口恢复提示](../integration/remote-current.md#目标文件写入时进程结束2026-09-27)，独立UID验证未知结果提醒、确认前后重启与目标保留；不等同所有实际文件提供方或低内存回收。

冷启动连续点击：[两条真实系统通知的后点击目标与草稿保留](../integration/notifications-current.md#冷启动后连续点击两条通知2026-09-27)，MuMu进程回收后6569ms间隔操作通过，两题取消回电脑；更短间隔及受控迟到竞争仍待验。

重连目录日志：[原源码复现与生命周期补丁](../../../plugin/compatibility/cordis-client-lifetime/README.md)，8项回归及完整构建通过；MuMu普通重启与有动态包的审批、重启后清单/手动运行/Host调用/移除通过，无控制台与资源错误，临时插件已卸载。双端及撤销仍待验。

提问与计划超时：[原Host自然超时、手机卡片清理与下一请求隔离](../integration/remote-current.md#原提问与计划超时2026-09-27)，MuMu两类真实90秒超时通过；测试草稿已定向恢复，工具审批/多端竞争仍待补验。

恢复通知语言：[冷启动后的中英文切换与点击目标保留](../integration/notifications-current.md#冷启动恢复通知的语言切换2026-09-27)，真实系统通知、两会话取消回电脑及草稿保持通过；临时插件已卸载。

当前首屏与包体：[普通聊天正式入口串行复测](../integration/ordinary-current.md#当前正式入口复测2026-09-27)，Edge三次TBT171–179ms、MuMu LCP681–718ms、CLS0、APK约11.67MiB；不能外推Remote长会话或真机冷启动。

多通知冷启动：[已有通知保留与绑定核验清理](../integration/notifications-current.md#多条通知冷启动恢复2026-09-27)，修复点击第一条后其他待办通知消失；真实两条依次点击与原生边界通过，快速竞争及其他A04异常仍待验。

动态图：[工作区GIF与WebP的实际播放](../integration/remote-current.md#工作区动态图实际播放2026-09-27)，MuMu真实画面三帧核对、关闭与草稿保持通过；其他附件来源和大图压力继续待验。

保存窗口进程恢复：[目的地选择前结束App、正常入口恢复与真实重试](../integration/remote-current.md#系统保存窗口中的进程结束与重试2026-09-27)，MuMu暂存清理/不自动保存/摘要与草稿保持通过；目标文件写入中进程结束仍待验。

保存失败：[目标半成品删除被拒绝的明确提示](../integration/remote-current.md#保存失败后半成品清理被拒绝2026-09-27)，受控Android提供方与两预览回归通过；进程回收和任意云盘故障仍待验。

原生对话框：[手机主题包装与实际入口](../integration/appearance-current.md#原生对话框使用手机主题2026-09-27)，配对/提醒与Key窗口统一主题，保留Activity窗口归属及系统媒体查询；完整原生外观仍待验。

中文软键盘：[Remote与系统原生输入框的窗口对照](../integration/appearance-current.md#中文软键盘实际窗口对照2026-09-27)，两处输入法窗口均高度0；环境现象已核对，组词与键盘避让未验收。

系统配色：[Android真实深浅色切换与会话保留](../integration/appearance-current.md#跟随android系统主题与页面保留2026-09-27)，修复固定浅色宿主与uiMode页面重建；新版APK已实测，原生完整外观仍待完成。

插件测量：[集中读取尺寸与真实历史定位](../integration/remote-current.md#插件外层测量与历史分页2026-09-27)，200个插件布局201→2次；最终APK真实四页与尺寸变化通过，完整性能仍待优化。

后台连续通知：[不同会话实际系统通知点击与最终目标核对](../integration/notifications-current.md#不同会话后台连续点击2026-09-27)，两题取消、草稿和通知清除通过；多通知跨进程仍待验。

自定义Agent模式：[手机选择、电脑原投影核对与恢复](../integration/remote-current.md#自定义agent模式实际选择2026-09-27)，实际空会话选择通过，未调用模型或执行模式工具。

自定义权限：[手机选择与原Host状态核对、恢复和目录清理](../integration/remote-current.md#自定义权限预设实际选择2026-09-27)，仅验证read-only + ask组合，自动审核与自定义Agent预设仍待验。

重启菜单：[页面重建关闭菜单与两次自动恢复实测](../integration/remote-current.md#重启期间菜单关闭的实际排查2026-09-27)，面板恢复可用，取消日志保留，不将旧菜单选择器超时等同永久卡住。

通知进程恢复：[后台进程回收后点击已有通知](../integration/notifications-current.md#后台进程回收后点击已有通知2026-09-27)，实际新进程、正确会话、双边草稿与取消回执通过；后台连续点击仍待验。

官方模型：[DeepSeek清单共用编辑器与固定管理通道](../integration/remote-current.md#官方deepseek模型清单2026-09-27)，0.1.65已安装，真实授权保存待验。

工作区图片：[七种后缀、约4.7MB宽图/长图及损坏后重读的真实Android验证](../integration/remote-current.md#工作区图片格式真实预览2026-09-27)，不等同动画、更大内存压力或所有附件来源已验收。

扫码权限：[无效shell命令修正、真实系统拒绝设置及模拟器限制](../integration/remote-current.md#相机权限复查与模拟器限制2026-09-27)，MuMu扫码请求仍自动授予，标准AVD因Q盘空间检查未启动，权限拒绝验收未通过。

真实管理验收：[专用提供方脚本与当前手动授权条件](../integration/remote-current.md#提供方真实管理验收准备2026-09-27)，只读probe已确认未授权，正向run/cleanup尚未执行。

既有提供方Key：[无引用路由启用、确认与原生窗口衔接](../integration/remote-current.md#既有提供方启用api-key2026-09-27)，0.1.64已安装，真实授权启用待验。

提供方新增：[内置/自定义创建、独立Key与验证边界](../integration/remote-current.md#新增模型提供方2026-09-27)，0.1.63及新App已安装，实际授权新增待验。

提供方移除：[确认、凭据保留与验证边界](../integration/remote-current.md#移除已有模型提供方2026-09-27)，0.1.62及新版App已安装，实际授权移除待验。

当前交付缺口：[Remote完成矩阵](../integration/remote-current.md#完成矩阵)，2026-09-27按实际报告区分已验专项、未实现和待验收；历史记录中的旧待办不能代替此表。

HTML 文件：[读取异常、显式重试与真实依赖恢复](../integration/remote-current.md#html文件预览失败与重试2026-09-27)，不涉及 localhost 网站转发。

Office 提示：[真实失败复现、语言切换与正常预览](../integration/appearance-current.md#office预览失败提示2026-09-27)。新版 APK 已实际验证，不代表全部 A05 完成。

模型发现：[候选选择、草稿和实际验证边界](../integration/remote-current.md#已有提供方模型发现2026-09-27)，配套0.1.61，真实手机管理发现待验。

历史导航：[增量投影、上游对照与真实分页](../integration/remote-current.md#历史轮次导航增量更新2026-09-27)。新版APK已安装，完整性能仍待优化。

内置模型覆盖：[共享编辑器、目录保留与验证边界](../integration/remote-current.md#内置模型逐项覆盖2026-09-27)，配套0.1.60，实际管理保存待验。

提供方默认兼容：[共用表单、基础继承与验收边界](../integration/remote-current.md#提供方默认兼容设置2026-09-27)，0.1.59与新App已安装，实际管理保存待验。

模型兼容配置：[固定26项、模板参数与继承边界](../integration/remote-current.md#模型协议兼容配置2026-09-27)，0.1.58及新App已安装，实际管理保存待验。

面板打开时序：[会话ID早于引用就绪的复现与修复](../integration/remote-current.md#会话未就绪时打开插件面板2026-09-27)，同一就绪条件约束菜单与待审批入口。

模型能力：[输入类型、思考档位及继承语义](../integration/remote-current.md#模型输入与思考能力2026-09-27)，配套0.1.57，真实Android管理保存待验。

模型清单编辑：[四字段、默认继承与实际验证边界](../integration/remote-current.md#模型清单编辑2026-09-27)，配套插件0.1.56，真实手机管理保存待验。

提供方Key：[原生窗口、路由隔离与验证限制](../integration/remote-current.md#其他提供方key原生入口2026-09-27)，配套插件0.1.55，真实管理保存仍待验。

提供方模型：[与聊天选择器共享目录及验证边界](../integration/remote-current.md#提供方设置中的共享模型目录2026-09-27)，读取已接入；基本清单编辑见上，完整模型选项仍待实现。

其他提供方地址：[共用核对界面、默认来源及实际验证边界](../integration/remote-current.md#其他提供方服务地址2026-09-27)，配套插件0.1.54，真实管理保存待验。

聊天尺寸变化：[尾部跟随、历史阅读与真实分页验收](../integration/remote-current.md#布局变化后的尾部跟随2026-09-27)。主聊天/旁栏共用尺寸观察；排序实验未采用，完整性能仍待优化。

其他模型提供方：[七字段设置、真实入口与未验范围](../integration/remote-current.md#其他模型提供方的已有配置2026-09-27)，配套0.1.53，完整模型管理继续接入。

当前产品基线入口：[已确认架构与功能清单](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md)；路线和插件权限已确认，进程结束不推送、重新打开尝试重连；当前页面已获用户确认。普通聊天功能已真实接入并本地验收，见[当前实现与证据](../integration/ordinary-current.md)；全部批次见[接入清单](../integration/README.md)。

| 分类 | 入口 |
| --- | --- |
| 系统蓝图 | [验证宿主模块地图](./blueprint/module-map.md)；参考[整体边界](../../../docs/project-knowledge/blueprint/module-map.md) |
| 业务域 | [普通聊天插件验证](./knowledge/domains/plugin-runtime/INDEX.md) |
| 开发规则 | [手机端工作入口](../../AGENTS.md) |
| 页面文案 | [面向普通用户的文案约定](../design/ordinary-preview/copy-guidelines.md)，开发计划不进入正常操作页面 |
| 聊天搜索 | [抽屉入口与独立搜索页](../design/ordinary-preview/search-preview.md)，含当前分类数据条件与验证范围 |
| 共享知识 | [已实现的服务协议](../../../docs/protocol.md)，不代表手机 UI 或存储方案已确定 |
| 长期决策 | [普通聊天数据流](../plugin-validation/ordinary-native.md)与[Remote 隔离](../plugin-validation/remote-native.md)：独立凭据/来源，已确定 Kotlin/WebView |
| 候选知识 | [待讨论事项](../../README.md)、[四项源码拆分研究](../../../docs/feasibility/README.md)、[普通聊天插件与 Android 验证](../plugin-validation/README.md)：新四步目标及进度 |
| 校验方式 | [已执行结果与限制](../plugin-validation/results.md)、[Android 验收计划](../plugin-validation/validation-plan.md) |

Remote 正式接入：[当前实现、完整验收矩阵与续接入口](../integration/remote-current.md)。

电脑自定义Key：[已配置引用的接入与真实验证边界](../integration/remote-current.md#电脑已有自定义key引用2026-09-27)，两个固定目标已接入，其他提供方及真实手机写入继续验收。

电脑重启：[动态实例清理、待激活目录与手动恢复](../integration/remote-current.md#电脑重启后的动态插件恢复2026-09-27)，MuMu真实进程重启通过，区别于短暂网关断线和动态包持久化。

插件渲染故障：[组件身份修复、局部隔离与真实恢复](../integration/remote-current.md#动态插件渲染错误归属2026-09-27)，新增手机包装需保留原组件错误归属。

历史动态插件卡片：[原组件回放与已移除工具边界](../integration/remote-current.md#历史动态插件工具卡片2026-09-27)、[Android实际持久记录读取与重入](../integration/remote-current.md#历史动态插件卡片的android读取2026-09-27)。源码切换、历史结果/停止卡片及会话恢复通过；上游样例未重新执行旧工具，临时插件已卸载，测试会话归档。

动态插件调用异常：[真实Host失败与后续调用恢复](../integration/remote-current.md#动态插件电脑调用失败2026-09-27)，同一运行保留、失败不自动重试；不代表未捕获异常或撤销验收完成。

动态插件提示语言：[真实待审批状态下的手机语言切换](../integration/appearance-current.md#动态插件待审批提示2026-09-27)，新版APK修复两处遗漏，原请求与草稿保持，切回后继续审批通过。

动态Cordis插件：[电脑安装与协议](../../../plugin/compatibility/cordis-inspect/README.md)、[手机审批与版本授权](../integration/remote-current.md#动态插件审批与版本授权2026-09-27)。手机要求完整12个接口；原页脚入口、审批/版本授权、运行/Host调用/停止/移除已在MuMu验证，双端、工具卡片与完整异常继续，R13尚未完成。

电脑插件管理 R13：[实际包管理入口、权限与验收](../integration/plugin-management-current.md)，包含原局部组件、缩放焦点修复和待验证配置边界。

动态包恢复：[客户端更新失败、原回退与真实网关重连](../integration/remote-current.md#动态插件失败回退与真实重连2026-09-27)，保留局部界面但离线调用拒绝，不自动重放；双端与实际撤销继续。

通知 A04：[电脑事件通道与应用级提醒连接](../integration/notifications-current.md)，MuMu冷启动和主要真实提醒链路通过；完整权限与异常验收继续进行。

手机外观 A05：[普通聊天与 Remote 主题/字号同步](../integration/appearance-current.md)，包含原生镜像边界、实际通知冷启动与恢复证据；完整语言及原生窗口外观未完成。

交互设计：[已填写问卷](../design/页面结构与核心交互问卷.md)、[追问结论](../design/问卷结论与追问.md)、[页面地图与核心流程草案](../design/页面地图与核心流程.md)、[DSH 原版与手机适配对照](../design/DSH原版与手机适配对照.md)、[普通聊天首页与抽屉预览及检查记录](../design/ordinary-preview/README.md)、[Remote 首页与任务列表预览及验收](../design/ordinary-preview/remote-preview.md)。普通聊天、Remote 首页、任务列表与已有工作区新建可审阅；[远程聊天详情](../design/ordinary-preview/remote-chat-preview.md)已完成四项示例交互及浏览器检查，[插件管理](../design/ordinary-preview/plugins-preview.md)也已覆盖两端列表、设置、安装更新卸载及异常状态；[设置页](../design/ordinary-preview/settings-preview.md)覆盖普通聊天配置、外观、通知、数据与电脑连接；[全流程交互核对](../design/ordinary-preview/flow-audit.md)已完成并记录跨页状态与异常恢复；真实协议与正式 App 接入仍待后续。
