# 定时任务跨多个遗漏周期

- 状态：真实时钟、DSH重启和MuMu恢复通过；发现新建聊天后的目标切换异常，另行跟踪，不把它记为通过。
- 维护角色：项目协作Agent；核验日期：2026-09-28（香港时间）。
- 契约：[原说明](../../../deepseek-harness/packages/schedule/schedule/README.zh.md)、[原运行时](../../../deepseek-harness/packages/schedule/schedule/src/runtime.ts)、[固定周期计算](../../../deepseek-harness/packages/schedule/schedule/src/domain.ts)。实际安装目录的两个源文件与参考版本[摘要一致](../../artifacts/schedule-missed-source-check.json)。

## 原规则与实施

重复提醒每次只交付最近的到期点，不逐个追赶积压；下一次保持创建时的周期基准。到期消息进入原会话，目录移除/推进只代表已入队，不等同模型回复成功。手机使用原投影，不自建调度器。

使用[原覆盖配置](../../tests/fixtures/schedule.cordis.patch.yml)临时启动实际DSH，再由手机发起原schedule_create。未改系统时钟、到期记录、工具最短间隔或用户持久profile。驱动：[分阶段验收](../../scripts/verify-schedule-recovery-android.mjs)的 `--missed` 和[真实时钟等待器](../../scripts/wait-schedule-missed.mjs)。与旧单周期报告分开保存。

## 实际结果（以下时间为UTC）

| 时间 | 证据 |
| --- | --- |
| 15:51:45 | [读取真实记录](../../artifacts/schedule-missed-capture-android.json)：单次15:51:53.549，重复首次15:55:53.572、周期300秒；正文回复均0。 |
| 15:51:47 | 核对PID44136为本次带schedule覆盖的DSH后停止；手机保留最近列表、显示断线和待核对，见[离线可见状态](../../artifacts/schedule-missed-offline.json)。 |
| 16:01:01 | [等待器](../../artifacts/schedule-missed-clock.json)确认已跨15:55:53和16:00:53两个真实到期点；随后以同一覆盖重启DSH，PID52752。 |
| 16:01:42 | [恢复报告](../../artifacts/schedule-missed-watch-android.json)：单次正文1、重复正文1；目录仅余重复项，下一次16:05:53.572，保持原基准。手机自动恢复，不重发创建请求；草稿保留、页面/资源错误为空。 |
| 16:02:05 | 原schedule_delete删除本轮重复提醒，目录为空；[清理报告](../../artifacts/schedule-missed-cleanup-android.json)和[seed](../../artifacts/schedule-missed-seed.json)保留。 |
| 16:03:24 | 移除临时启动覆盖，实际DSH PID35728恢复普通源码启动；[手机报告](../../artifacts/schedule-missed-restored.json)确认未提供定时能力、原联调标题和空草稿恢复。日常设备active、management=false。 |

[截图](../../artifacts/schedule-missed-dispatched-android.png)已核对。报告中的旧余额不足及旧改动提示属于既有聊天历史，不是这两次提醒的新执行错误。下一正常周期未再等待；本项证明多个遗漏周期只补发一次及下次基准，正常周期实际触发已有[旧专项](./remote-current.md#定时任务目录与真实提醒2026-09-24)。

## 发现的异常与下一步

后续结论：[新建连接状态专项](./new-chat-connection-current.md)已在真实离线时复现并修复可点击的新建入口，新版MuMu快速操作正确。以下保留首次发现过程；首次是否遗留空会话仍未核实。

首次prepare在本地化间隔文案空格上超时，报告保留，随后只capture，未重复创建。已改为接受原Intl产生的空格差异。

检查实际正文和本次草稿记录时发现：新建操作后仍在既有专用联调会话 `session-d4ec40ee-a27c-41fc-a860-b3974434e637`，名称也被旧驱动改为本轮测试标题。提醒确实创建/执行在该授权测试会话，因此不影响上面的时间恢复结论，但不能据此证明新建成功。清理没有归档该会话，已恢复名称“DSHM Remote 联调提示”和原空草稿，旧记录保留。本轮临时创建是否留下空会话、导航为何未完成仍须查明。

后续prepare已增加等待工作区选择窗口关闭和空聊天出现，未满足就停在发送前。16:05 UTC以[只创建、不发消息的正式入口检查](../../scripts/verify-new-chat-navigation-android.mjs)再次核对：[实际报告](../../artifacts/new-chat-navigation-android.json)中初始旧标题/16条回复/选择窗口未关闭，约531ms后变成DSH-TEST空聊天/0条回复/窗口关闭。仅将已确认的新空聊天归档，返回原联调会话，页面错误为空。

因此普通新建路径已确认可用，剩余核查收窄为：旧驱动紧接着打开菜单、改名的快速交互，为什么导致目标仍留旧会话；本轮首次操作是否留下空会话也未核实。不要据此宣称竞态已修复，后续必须在发送前确认目标。未修改产品代码来猜测修复原因。

本轮无产品源码/APK变化，不改变网页转发待定范围。R09其他具体并发/失败恢复及完整Remote继续按[收尾表](./completion-audit.md)执行。
