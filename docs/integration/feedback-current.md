# 反馈提交与撤回验收

- 状态：六类反馈入口按本机范围验证通过；测试评价已撤回，默认启动环境及原会话恢复，临时收集器已关闭。
- 维护角色：项目协作Agent；最近核验：2026-10-04。
- 来源：[原反馈记录](./remote-current.md#完成矩阵)、[原会话遥测实现](../../../deepseek-harness/packages/session/session-telemetry-otel/src/index.ts)、[目的地只读检查](../../scripts/inspect-feedback-destination.mjs)、[双端手机驱动](../../scripts/verify-feedback-cross-device-android.mjs)。

## 本轮实际验收（2026-10-04）

用户在同一PowerShell先设置本机反馈URL再启动DSH，实际进程77492。本机收集器收到真实会话事件后，完成以下验收；第一次空探测不计为DSH事件。此前目的地未配置时留下的正评已撤回，其可能的外部上传结果仍未知，不能宣称已从外部删除。

| 场景 | 结果与原始证据 |
| --- | --- |
| 普通会话双向同步 | 手机正评→电脑原控件自动选中；电脑负评→手机自动更新；手机撤回→电脑清空。共两次put和一次delete。[手机提交](../../artifacts/feedback-cross-device-positive-android.json)、[观察电脑修改](../../artifacts/feedback-cross-device-negative-observed-android.json)、[撤回](../../artifacts/feedback-cross-device-retract-android.json)。 |
| 版本冲突 | 只暂缓手机真实原请求，电脑先提交新版本，再释放旧请求；真实Host返回version-conflict，手机显示最新状态，不覆盖或自动重试。测试负评已撤回。[报告](../../artifacts/feedback-version-conflict-android.json)、[实际提示](../../artifacts/feedback-version-conflict-android.png)。 |
| 断线与未知结果 | 真实put已在电脑提交，仅暂缓原返回帧；手机断开并重连，重新读取正评，全程只有一次put。释放迟到回执后撤回，16条回复及空草稿保留。[报告](../../artifacts/feedback-disconnect-android.json)。驱动误等remote-main超时，实际remote-workspace已恢复；旧回执在请求超时后释放，不冒充超时前跨代回执验收。 |
| 已归档父会话 | 正式手机打开原归档工作流会话，提交/撤回各一次，归档状态及草稿保留。[报告](../../artifacts/feedback-archived-android.json)。打开后它已进入实时注册表，因此本项不作为冷存档证明。 |
| 真正冷存档、一次性只读子会话 | 两端均通过正常导航打开原一次性子任务，无消息输入框。原session/control基线在提交前、提交后、撤回后均不含目标ID，证明保持冷状态。手机正评→电脑自动选中；电脑负评→手机自动更新；手机撤回→电脑自动清空。通过生产feedback/committed通知，无伪造Session或事件。[报告](../../artifacts/feedback-cold-readonly-android.json)、[手机负评同步画面](../../artifacts/feedback-cold-readonly-synced-android.png)。父会话为电脑导航临时取消归档，结束已重新归档；原聊天16回复/空草稿恢复。 |
| 打开取消与权限边界 | 原[正式手机取消报告](../../artifacts/feedback-read-cancel-android.json)仍有效，本轮归档弹窗取消也未写入。只读工具权限/一次性只读记录不禁止原评价；设备授权失效沿[通道专项](./remote-channel-current.md)拒绝访问，不另造反馈特权。 |

[本机收集报告](../../artifacts/feedback-local-collector.json)在收尾核对时requests=13；原主会话新增反馈序号1653–1660、归档父会话30–31、冷子会话18–20。冷反馈会重复导出规范前缀，同一sessionId+seq的重复条目不是重复写入。只保存事件类型、序号、会话ID，不保存正文，也不转发。全部测试评价当前为空，聊天原记录保留。两张关键手机截图已实际检查。

本轮未改生产代码、APK、网关或权限。归档菜单/子代理菜单的电脑导航及评价按钮名称定位超时属于驱动观察问题；电脑原控件以aria-pressed核对，不能把悬停时的“取消标记”名称作为唯一依据。

功能矩阵及环境清理均完成：用户确认在原终端移除临时DSH_TELEMETRY_OTLP_URL并恢复pnpm dsh web，3080监听更换为DSH21020，网关24312保持。核对收集器13004的可执行文件和命令后停止，进程不存在且18789无监听。手机通过正常断开/重连重新认证读取原聊天16条回复、空草稿、零选中评价，见[最终恢复报告](../../artifacts/feedback-final-restored-android.json)。恢复后不再提交测试反馈；默认目的地依据用户恢复操作，不通过向外部发送探测来证明。此前自动审批拒绝未通过其他机制绕过。

## 历史事实与阻塞

以下保留此前失败和准备过程；其中“待清理/待执行”是当时状态，当前结论以上方实测为准。

### 2026-10-04手动重启后的前置条件失败

用户回复“已启动”后，确认DSH从44728变为51792，网关24312及收集器13004保持。手机read阶段通过，专用“DSHM Remote 联调提示”最新`DSHM_API36_NOTICE_da691b93`无既有评价；随后positive阶段实际提交一次`messageFeedback/put`，草稿/消息保持，电脑原“取消标记”按钮自动变为aria-pressed=true。该证据只证明本次写入与同步，不能记为符合目的地要求的验收通过。

收集器未收到DSH事件。独立空`resourceLogs:[]`探测返回200，并使报告requests=1、events=[]；这个请求是探测，绝不是实际反馈接收。原模板批次延迟10000ms，观察已超出该延迟，但仅此不能判断外部上传结果。

用户随后明确“只重新启动了DSH，没设置地址”。因此先前把“已启动”作为本机目的地已配置的依据不足；本次评价可能触发默认外部遥测，未确认是否送达，不能声称日志未离开本机。已向用户说明并停止后续提交/撤回，电脑打开的负评窗口已取消。尚有这一条本轮测试正评待清理，不覆盖既有用户评价；正确配置目的地后先核实，再继续并撤回。

证据：[手机读取](../../artifacts/feedback-cross-device-read-android.json)、[手机实际提交](../../artifacts/feedback-cross-device-positive-android.json)、[收集器报告](../../artifacts/feedback-local-collector.json)。电脑原按钮由内置浏览器只读核对；未进行电脑负评提交。此前的“未提交评价”叙述仅对应以下历史阶段，不代表本次状态。

2026-10-03核对配置模板，缺少环境覆盖时mode默认为FEEDBACK_ONLY、目的地默认为原外部遥测服务。旧只读脚本误把检查子进程继承的环境当作实际DSH配置，输出configured=true、disabled=false和endpoint；这些字段不能证明从其他终端启动的DSH进程状态。现改为明确输出configuration-template、runningProcessVerified=false和已核对的两条表达式，不据此授权反馈写入。原提交和删除评价可能释放规范会话日志；不能把评价写入描述为只更新本地按钮，也不能向默认外部目的地发送测试来绕过本机目的地调整限制。

用户在先前拒绝之后给出“完全授权访问”。本次按正常方式尝试仅为测试DSH子进程设置`DSH_TELEMETRY_OTLP_URL=http://127.0.0.1:18789/v1/logs`，并按原参数重启；自动审批仍在执行前拒绝，返回`blocked by policy`，没有更具体原因。没有改用其他机制重试。随后确认DSH仍PID31144、网关70308，原配置未变；这些PID只用于本轮记录，后续操作须重查。

已请求用户停止原DSH，在电脑DSH目录手动设置上述临时进程环境并执行`pnpm dsh web`，用新链接打开内置浏览器，回复“本机反馈环境已启动”。本机[收集器](../../scripts/feedback-local-collector.mjs)已运行，PID13004，监听127.0.0.1:18789，只将事件类型、序号和会话ID写入报告，不转发或保存完整日志正文。暂时保留该服务等待用户准备；未获准备完成的证据前不执行写阶段。收尾时需停止收集器，并在用户终端移除临时环境变量、恢复普通启动。

2026-10-03本轮复查实际监听：18789仍归PID13004，3080归PID72472，8787归PID24312；该检查只证明端口监听，不能证明运行中的DSH使用本机目的地。已再次将具体手动准备步骤交给用户，未尝试绕过原自动审批拒绝，也未提交评价。检查器更正及当前输出见[模板报告](../../artifacts/feedback-destination-template.json)。

## 已完成的准备与验证

2026-10-04用户再次明确“我同意授权执行”后，重新尝试同一临时环境变量及原参数重启操作。执行工具仍在创建进程前返回`blocked by policy`，未提供细分原因；没有改换机制绕过。随后只读确认3080/8787/18789仍由原44728/24312/13004监听，未发生部分重启或反馈提交。用户授权已取得，剩余阻塞来自执行审批，需要用户在自己的DSH终端手动准备本机反馈环境。

新版手机编辑器是contenteditable DIV，旧脚本使用inputValue且将整段标题区域当标题；现改用textContent和准确标题节点，增加明确回复标记及有界调试连接关闭。没有修改生产App或后端。

07:56:49Z从正式MuMu的“DSHM Remote 联调提示”读取已存在的`DSHM_API36_NOTICE_da691b93`回复，两个评价按钮未选中，原桥写入记录为空、errors为空、草稿与消息保留，见[只读报告](../../artifacts/feedback-cross-device-read-android.json)。旧报告保存为[此前基线](../../artifacts/feedback-cross-device-read-before-20261003.json)。这不是反馈提交/撤回验证，也没有改变已有评价。

## 待执行路径

### 归档与只读的源码边界

2026-10-04只读核对原服务[withSession](../../../deepseek-harness/packages/feedback/message-feedback/src/index.ts)：live会话追加并验证持久化；无live实例但存在持久化记录时，以write句柄追加并flush，再发送`feedback/committed`。因此冷存档是原服务支持的写入路径，不能将归档状态直接映射为禁止评价。上述是源码契约，真实手机冷存档写入仍待验证。

原[评价控件](../../../deepseek-harness/packages/client/ui-message-feedback/src/client/MessageFeedbackActions.tsx)按提交状态锁定按钮，[反馈表面](../../../deepseek-harness/packages/client/ui-message-feedback/src/client/surface.ts)调用原反馈Remote；没有根据聊天工具的只读预设禁止评价。中转[反馈参数策略](../../../backend/packages/protocol/src/remote-policy.ts)限制原消息身份、分类、版本和文本字段，不能将工具执行权限混同为反馈权限。验收“只读”时须记录具体是哪种状态及原服务行为；设备授权失效则沿现有通道权限拒绝访问，不另造归档限制。

本轮未修改生产逻辑、未调用put/delete，也没有把上述源码核对计作真实写入验收。现有不写入的打开取消证据已完成；剩余反馈完整路径仍依赖手动目的地准备，重复读取同一页面不能补足该证据。

### 剩余真实入口验收矩阵

现有五阶段驱动只覆盖普通会话的双向提交/撤回。KKC-18第八条明确要求以下场景，不能以脚本正常结束或隔离回放代替；全部写入仍以实际DSH本机目的地核实为前提。

| 场景 | 所需实际证据 | 当前状态 |
| --- | --- | --- |
| 打开并取消 | 正式手机打开原反馈窗口后取消，原桥无put/delete、消息与草稿保留 | 原read-cancel报告通过；本轮重读noSubmitOrRetract=true，errors/resources为空 |
| 手机提交、电脑修改、手机撤回 | 原消息身份/分类与日志提示正确；两端不重开页面自动更新原控件；只发生预期写入，本机收集器收到对应元数据 | 本轮通过，见上方普通会话三份报告 |
| 冷存档/归档 | 核对确为冷存档读取路径；通过受支持的feedback/committed通知刷新手机与电脑原控件；清理测试评价 | 本轮分别验证归档父会话及真正冷子会话，均通过 |
| 只读或权限失效 | 正式手机按原电脑权限决定反馈是否可写；不能仅凭归档标签推断只读；被禁止时不发写入、已有评价和聊天保持 | 原一次性只读子会话评价通过；授权失效引用通道专项，不混同工具权限 |
| 断线及写入结果未知 | 真实入口断线保留消息/草稿，不自动重发；恢复后重读原值，电脑实际写入次数与最终两端状态一致 | 本轮通过；超时后迟到回执的明确边界见报告 |
| 版本冲突与已变化评价 | 双端针对同一原版本操作，原服务拒绝过期版本，手机重读权威结果且不覆盖另一端修改 | 本轮真实暂缓请求制造冲突通过，不是顺序修改 |

2026-10-04复查3080/8787/18789仍分别由44728/24312/13004监听，尚无用户确认手动准备完成的证据；没有执行写阶段或再次尝试改变目的地。恢复正常启动和停止本机收集器属于本专项清理，不得遗漏。

### 执行顺序

1. 核实用户启动的DSH与本机收集器已就绪；通过原界面进入同一专用测试会话。
2. 手机提交一条明确测试评价，电脑原界面自动更新；核验本机实际接收的事件元数据。
3. 电脑修改测试评价，手机在不重开会话的情况下同步。
4. 手机撤回该评价，电脑同步清除；确认消息/草稿保持，只发生预期写入。
5. 核对临时评价已清理，恢复正常DSH启动并停止收集器，保持原聊天授权和management=false。

首次拒绝的历史背景见[Remote历史证据](./remote-current.md)。上述准备不关闭R14；目的地限制与功能未验分别记录。
