# 原审批期限验收样例

## 明确取消与中断清理（0.0.2）

同一夹具支持 `approval-cancel` / `question-cancel`，分别调用原审批/提问服务；发送匹配当前请求ID的 `cancel` 控制项才中止信号。三分钟期限仅用于测试故障兜底，正常验收必须显式取消，不能把超时算作主动取消。提问服务的信号取消结果为 `ASK_ABORTED`，手机主动放弃回答才是 `ASK_CANCELLED`；原 `timeout` / `reject` 的30秒行为保留。

[通知取消脚本](../../../scripts/verify-notice-cancel-android.mjs)通过 `run` / `restore` / `cleaned` 检查真实后台系统通知、原卡片消失和前台恢复。后台网页截图会等待渲染而超时，因此后台阶段核对系统通知key、原生投递日志和真实DOM；回前台再检查无旧操作入口。`discard` 仅用于清理中断的测试提问，不计入电脑主动取消结果。

`--background-dwell --preview` 使用独立报告前缀 `notice-background-dwell`：先退到系统桌面，每30秒核对同一进程、后台状态及无旧通知；满5分钟后才发出原审批和提问请求，检查新通知标题、取消清理与草稿。驱动保持ADB/WebView连接，不强制Doze或熄屏；不能将此场景描述为无调试器、锁屏省电或无限期后台保证。结束后按同样标志执行restore、卸载夹具，再执行cleaned核验登记清理。

若进程被直接结束，dispose不能执行。再次加载时，仅在旧报告标题、会话ID、工作区规范路径及唯一会话归属全部匹配后，归档旧测试会话并移除工作区登记，保留 `approval-recovered-<sessionId>.json`；不删除文件。缺项或不匹配仍停止，不能通过手动把cleaned改为true跳过清理。正常卸载须先等Host报告cleaned=true，再决定是否重启服务。

2026-10-03两类明确取消通过：见[运行报告](../../../artifacts/notice-cancel-run-android.json)、[原Host结果](../../../artifacts/notice-cancel-host.json)、[归档清理](../../../artifacts/notice-cancel-cleanup-host.json)和[实际列表恢复](../../../artifacts/notice-cancel-cleaned-android.json)。首轮审批拒绝/提问放弃是驱动中断后的清理，不混入最终同轮通过结论。

本样例不进入产品 APK。安装后，在手机项目 artifacts 下创建独立工作区和原 DSH Agent/Session，原构造器写入明确标记的受控会话记录；不启动模型循环、不执行工具、不改变日常会话的权限策略。

手机脚本写入与样例 sessionId 匹配的控制文件，样例调用电脑原 `ApprovalService.request`。请求携带真实 30 秒 `AbortSignal.timeout`；这是**测试请求指定的期限**，不是声称所有 DSH 工具默认 30 秒超时。原服务负责请求、取消以及 approval/asked、approval/decided 持久审计，手机使用原审批组件。第二次请求从手机拒绝，验证新请求不继承过期卡片。

源码依据：[原服务](../../../../deepseek-harness/packages/interaction/user-approval/src/index.ts)、[原手机复用组件](../../../../deepseek-harness/packages/client/ui-approval/src/client/ApprovalPanel.tsx)。需要开着已绑定的日常 App，并位于「DSHM Remote 联调提示」。

1. 本目录执行 `npm pack --pack-destination ../../../artifacts --ignore-scripts`。
2. 在实际 DSH 安装目录使用原 CLI 的 `plugin --profile web add <tgz绝对路径>` 安装；等待 `artifacts/approval-timeout-host.json` 中 ready=true。
3. 手机项目根目录设置 `DSHM_RUN_LIVE=1`、`DSHM_ANDROID_SERIAL=emulator-5554`，执行 `node scripts/verify-approval-timeout-android.mjs`。脚本正常打开实际列表、聊天和审批卡片，不注入页面状态；不更改已有草稿。
4. 用原 CLI `plugin --profile web remove @dsh-mobile/approval-timeout-verification` 卸载。dispose 中先中止/等待未完成审批，再归档专用会话、释放 Agent、移除工作区登记；保留测试文件和报告。
5. 确认 Host 报告 cleaned=true，并从实际 Remote 列表复查测试工作区/会话消失、日常聊天与草稿保留。不要只看 pnpm 退出码宣称清理完成。

报告：[Android](../../../artifacts/approval-timeout-android.json)、[期限专项 Host 归档](../../../artifacts/approval-timeout-first-host.json)、[本次清理](../../../artifacts/approval-timeout-cleanup.json)。2026-09-27 已在 MuMu Android 12/本地网关实测，30,003ms 取消、下一请求 rejected，匹配原持久审计、页面/资源无错误。覆盖的是真实审批服务到手机的期限清理，不冒充模型实际发起某个文件/命令工具。

另有[双端脚本](../../../scripts/verify-approval-two-clients.mjs)，需要新安装、ready 且 results 为空的样例实例；用正常登录的独立桌面 Edge 与实际 MuMu 页面验证两个方向拒绝及校准时刻的相反按钮点击。凭据仅在内存，电脑只保留一个决定。见[报告](../../../artifacts/approval-two-clients.json)、[Host 审计归档](../../../artifacts/approval-two-clients-host.json)和[清理](../../../artifacts/approval-two-clients-cleanup.json)。不同轮次会覆盖工作用 approval-timeout-host.json，须归档对应 Host 报告，不能用后一次会话的审计证明前一次测试。
