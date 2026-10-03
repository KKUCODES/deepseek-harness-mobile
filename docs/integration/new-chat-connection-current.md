# 新建聊天的连接状态与连续操作

- 状态：离线入口修复，页面回归与新版 MuMu 实测通过；首次定时测试是否留下空会话仍待核对。
- 维护角色：项目协作 Agent；核验日期：2026-09-28（香港时间）。
- 来源：[生产页面](../../src/ui/RemoteWorkspace.jsx)、[原创建路径](../../src/remote-model.mjs)、[导航连接检查](../../src/remote-session-view.mjs)。

## 原因与修复

此前[定时验收](./schedule-missed-current.md)发现新建后立即改名仍操作旧聊天。正常连接和稳定的 Schedule 临时覆盖下，快速操作均能进入新聊天；电脑刚重启的失败记录保存在 [restart-failure](../../artifacts/new-chat-rapid-restart-failure.json)。

16:14 UTC 主动停止实际 DSH 后，在原 APK 的正式聊天入口复现：新建按钮可点击，选择工作区后出现“电脑暂时离线，恢复连接后可打开其他聊天。”，标题仍是原聊天，见[真实离线复现](../../artifacts/new-chat-offline-probe-android.json)。原 `beginNavigation()` 在 `sessions.create()` 之前拒绝，未把失败当成新建成功；缺陷在页面仍允许操作，旧验收驱动也没有检查创建结果。此证据解释了可复现路径，不代替首次定时测试缺失的请求记录。

修改共享 `RemoteWorkspace` 的首页按钮、菜单项和已打开的工作区选择按钮，统一要求已连接且没有进行中的操作。操作进行时禁用顶部菜单，避免创建尚未结束就进入旧聊天的改名窗口。原导航和创建协议不变，不自动重发请求。相比重写导航流程，这个方案直接覆盖复现入口，复用原离线拒绝和迟到导航隔离规则；无需改变 Host、网关或插件协议。

## 验证

| 范围 | 结果与依据 |
| --- | --- |
| 生产页面回归 | [新增断言](../../scripts/check-new-chat-availability.mjs)修改前在离线菜单失败，见 [red](../../artifacts/new-chat-availability-red.log)。修复后覆盖 disconnected/connecting、首页/聊天菜单、选择页中断、重连启用、草稿保留、创建处理中菜单锁定及创建失败保留原聊天，见[通过报告](../../artifacts/new-chat-availability-web.json)。这是隔离协议测试，不冒充真实电脑。 |
| 模型边界 | [模型测试输出](../../artifacts/new-chat-model-tests.log)六项通过，包含离线不发送创建请求及迟到创建隔离；完整[插件页面回归](../../artifacts/new-chat-full-regression.log)通过。 |
| 构建 | [Web](../../artifacts/new-chat-build-web.log)、[Android assembleDebug/lintDebug](../../artifacts/new-chat-build-android.log)通过，APK 已覆盖安装到 MuMu，数据未清除。安装后系统停在旧文件保存窗口，无 App 进程；重建 Activity 任务后从普通聊天侧栏进入正式 Remote。 |
| 新版真实断线 | 16:19:58 UTC 停止实际 DSH 后，[MuMu 正式聊天菜单及首页](../../artifacts/new-chat-offline-guard-android.json)均禁用新建。未发送创建或模型消息。 |
| 新版恢复与快速操作 | DSH 恢复普通源码启动 PID47116，未携带 Schedule 覆盖。16:20:43 UTC [真实快速检查](../../artifacts/new-chat-rapid-android.json)新建后立即打开改名，目标与标题均 DSH-TEST、0条模型回复；取消改名，仅归档确认的新空聊天，返回原联调会话，errors 为空。 |

日常 DSHM Android 授权保留，收尾实际检查 active / management=false。网关未重启，未更改 Key 或模型设置，未发送模型消息。

## 剩余范围

本次证明实际离线误入口已修复。首次定时测试缺少创建请求记录，是否留下额外空聊天仍未核实，不删除身份无法确认的历史聊天。电脑已接受创建但响应途中连接丢失的未知结果仍按原规则处理，不自动重发；不以这组检查宣称 R04 的所有异常已完成。完整 Remote 继续按[验收表](./completion-audit.md)推进，localhost 网页转发仍待范围确认。
