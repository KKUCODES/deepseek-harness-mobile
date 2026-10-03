# Remote 执行能力核对

- 状态：R09 五类能力的具体证据已核对；不代表完整 Remote 已交付。
- 维护角色：项目协作 Agent；最近核验：2026-10-04。
- 依据：[原始 R09](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md)、以下生产入口、实际报告与当前回归。按电脑已安装的真实能力展示，不增加手机调度器或手机执行任务。

## 原要求与证据

| 能力 | 实现与验收依据 | 结论边界 |
| --- | --- | --- |
| 目标 | [原控制入口](../../src/remote-goals.mjs)、[创建并暂停](../../artifacts/remote-goals-created-paused.json)、[生命周期](../../artifacts/remote-goals-lifecycle.json) | 电脑修改可见、修改后恢复执行并完成、清除均有实际字段；空目标截图不能替代生命周期报告。 |
| 后台任务 | [任务面板](../../src/ui/RemoteJobs.jsx)、[原停止控制](../../src/remote-job-actions.mjs)、[运行中停止](../../artifacts/remote-job-stop-final-android.json)、[独立输出](../../artifacts/independent-job-output-run-android.json)、[模型后续读取](../../artifacts/independent-job-output-model-read-android.json) | 运行、停止和独立读取已有真实证据；模型读取未被手机消费。精确所属会话释放新增实测见下。 |
| 定时任务 | [单周期恢复](../../artifacts/schedule-recovery-watch-android.json)、[两次遗漏周期](./schedule-missed-current.md) | 由电脑调度；两次遗漏只补最新一次并保持原周期基准。报告 repeatDeliveredTwice=false 是该场景预期，不能当成失败或两次补发成功。 |
| 子 Agent | [继续聊天](../../artifacts/remote-subagents-continue-android.json)、[输出后停止](../../artifacts/remote-subagents-stop-existing-android.json)、[三层导航](../../artifacts/remote-nested-recovery-20260925-navigate.json)、[断线恢复](../../artifacts/remote-nested-recovery-20260925-watch.json) | 原父子关系、只读/可输入条件和各层草稿已有证据；不把根会话恢复当成孙会话恢复。 |
| 工作流 | [原控制与导航](../../src/remote-workflows.mjs)、[并行成功](../../artifacts/workflow-parallel-run-android.json)、[失败](../../artifacts/workflow-failure-run-android.json)、[取消](../../artifacts/workflow-cancel-run-android.json)、[Host重启中断](../../artifacts/workflow-restart-history-android.json)、[成员与历史](../../artifacts/remote-workflow-history-android.json) | 三成员完成、failed、cancelled、interrupted均对应原工具记录；保留草稿与成员导航条件，不伪造本机执行状态。 |

历史报告对应其实际版本，并非本轮全部重跑。[当前源码回归](../../artifacts/r09-current-audit-tests.log)112项通过，涵盖 remote-model、workflows、job-actions、live-job-output、live-command-output、lineage；隔离测试不替代上述实际Android证据。当前生产代码和APK本轮未变。

## 单个所属会话释放后的实时输出

[临时Host夹具](../../tests/fixtures/job-owner-lifecycle-host.mjs)通过原 Agent 工厂持有自己创建的句柄，在既有 DSH-TEST 工作区建立专用会话。原模型只回复 DSHM_OWNER_READY，让手机正常列表能打开会话；随后通过原 jobs/shell 启动仅打印固定标记的进程。手机使用正式 Remote 页面打开「后台任务 → 查看实时输出」，没有注入手机任务状态。

同一DSH进程73000、同一网关24312期间，夹具仅调用自己持有句柄的 dispose。释放前任务 running；释放后原进程 killed、Agent移出注册表、所属任务数量为0。手机显示「任务已变化，请返回任务列表重新查看」，保留931字节已读内容；点击重新读取仍拒绝，输出保持，原后台列表显示无任务。这里的释放是受控生命周期动作，不代表用户主动停止或整机重启。

- [手机实际报告](../../artifacts/job-owner-lifecycle-android.json)、[释放瞬间Host报告](../../artifacts/job-owner-lifecycle-disposed-host.json)、[实际页面](../../artifacts/job-owner-lifecycle-android.png)。两端errors均为空。
- [首次失败](../../artifacts/job-owner-lifecycle-first-failure.json)：空会话被正式列表过滤，标题定位超时，原任务自然结束；[原Host结果](../../artifacts/job-owner-lifecycle-blank-host.json)保留。改为真实准备消息后再单独启动任务，未穿透隐藏元素。驱动中尚未执行的工作目录取值也改为创建时核实的工作区路径。
- 关闭输出后原任务列表仍在前景，清理驱动错误地点击下层菜单超时；改用已打开列表验证，不强制点击。该失败保留在手机报告 cleanupNavigationFailure。
- 两个有消息的专用测试会话已归档；首个空会话已释放。最终恢复正常DSH进程44728，启动参数无临时patch，命令文件移除；临时模块不安装到用户profile。原聊天16条回复、空草稿、正常连接恢复；日常设备active、management=false。本轮没有扩大管理权限或修改模型Key、反馈目的地。

该项关闭了原矩阵中「任务所属会话被回收」的明确证据缺口，不把全局重启当作等价证明。生产读取仍由[任务身份校验](../../src/remote-live-job-output.mjs)约束：所属会话、任务起始时间、Host代次与连接失效时暂停，旧回执不得追加。
