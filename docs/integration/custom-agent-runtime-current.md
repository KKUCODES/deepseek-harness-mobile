# 自定义 Agent 的实际工具执行

- 状态：手机选择、真实模型调用、电脑执行、手机结果与开始后锁定已验证；正常服务已恢复，临时模式入口已移除，原只读权限和草稿保留。
- 维护角色：项目协作 Agent；核验日期：2026-09-28（香港时间）。
- 来源：原[模式服务](../../../deepseek-harness/packages/preset/agent-presets/src/index.ts)、[工具定义](../../../deepseek-harness/packages/core/tools/src/schema.ts)、[手机验收驱动](../../scripts/verify-custom-agent-runtime.mjs)、[专用工具](../../tests/fixtures/live-custom-agent-runtime.mjs)。

## 实际范围

### 子任务继承的实际执行（2026-10-01）

13:47–13:52 UTC补验自定义模式的子任务继承。[生成器](../../scripts/prepare-custom-agent.mjs)的`--inheritance`仅通过临时启动补丁增加测试目录，不写持久profile；模式只提供persona和[专用校验工具](../../tests/fixtures/live-custom-agent-inheritance.mjs)。手机正式新建测试聊天、选择该模式和只读权限、发送真实模型消息。父工具使用原[startInProcessRun](../../../deepseek-harness/packages/subagent/subagent-in-process-driver/src/index.ts)创建one-shot子任务，真实子模型调用同一继承工具生成新的随机值，再由父模型返回手机。

[Host报告](../../artifacts/custom-agent-inheritance-host.json)证明父子ID关联、子会话header与实际composition均为dshm-custom-agent-inheritance，子工具实际执行一次，sandbox/mode=read-only、approval/policy=never，结果completed；[Android观察报告](../../artifacts/custom-agent-inheritance-observe-android.json)证明手机最终回复匹配随机值、原工具卡片ok、开始后模式锁定、无pageerror。不是模拟模型回复，也未向模式加入业务文件、网络或命令工具。本例验证原one-shot driver的继承，不外推所有第三方子任务提供方。

首次子任务实际调用了工具，但夹具误要求权限名称等于read-only；原[child-agent](../../../deepseek-harness/packages/subagent/subagent/src/child-agent.ts)固定审批never后权限名称可为custom，故断言失败。保留[首次Host报告](../../artifacts/custom-agent-inheritance-policy-failure-host.json)，失败工具结果也保留在真实聊天中；修正为核对具体沙箱/审批事件后，在原测试聊天显式发送一次[重试](../../artifacts/custom-agent-inheritance-retry-android.json)，没有自动重发。

[清理报告](../../artifacts/custom-agent-inheritance-cleanup-android.json)确认父测试聊天归档、原聊天草稿一致；子任务由原driver处置结束。正常启动已恢复，不再带临时模式补丁。整个测试未授予设备管理权限、未修改Key或默认模式；实际恢复检查见[报告](../../artifacts/custom-agent-inheritance-restored-android.json)。

此前自定义模式只验证了空会话选择和电脑投影，未发送消息。本次通过既有 DSH-TEST 工作区新建专用聊天，在 DSHM 自有 Remote 页面选择“DSHM 自定义工具验证”并发送真实模型请求。模式仅组合原 persona 与一个自定义 `dshm_runtime_probe` 工具，没有加入文件、网络、Shell 工具，保留原 read-only 权限。

工具使用原 `defineTool` 注册，只在该模式作用域中存在；执行时核对真实 Agent 的模式和权限，生成新的随机校验值并写入项目内测试报告。这个值在发消息前不存在，手机最终回复必须与电脑记录一致，不以预置回复或直接插入消息代替实际模型调用。没有拦截或伪造模型请求、工具调度或结果事件。

## 验收证据

| 检查 | 证据与结果 |
| --- | --- |
| 创建与选择 | [开始报告](../../artifacts/custom-agent-runtime-start-android.json)记录手机正式入口发送；[临时模式生成器](../../scripts/prepare-custom-agent.mjs)的 `--runtime` 分支从实际配置保留默认值与原目录，仅增加项目内测试目录。完整配置只在内存解析，不保存 Key。 |
| 电脑真实执行 | [电脑报告](../../artifacts/custom-agent-runtime-host.json)记录指定 session、`dshm-custom-agent-runtime`、read-only 与实际生成的校验值。修正夹具后的运行仅执行一次专用工具。 |
| 手机结果及锁定 | [18:33 UTC观察报告](../../artifacts/custom-agent-runtime-observe-android.json)确认完整回复匹配电脑值、原工具行状态 ok、第一轮后标准模式切换禁用，无页面错误。[实际截图](../../artifacts/custom-agent-runtime-android.png)已核对。 |
| 归档与返回 | [清理报告](../../artifacts/custom-agent-runtime-cleanup-android.json)确认专用聊天已归档、返回原联调、原草稿一致。测试模式会话开始后不能改回其他模式，故保留原记录，不伪造“已恢复标准模式”。 |
| 正常服务恢复 | [18:35 UTC复验](../../artifacts/custom-agent-runtime-restored-android.json)确认临时模式选项消失、原聊天仍只读、草稿保留，无页面错误；正常DSH进程37528，无临时启动补丁，设备active/management=false。 |

临时服务通过 `web --patch … --no-open` 启动，不写用户持久 profile。验收后恢复不带 `--patch` 的正常源码入口；测试模式文件仍保留在项目 artifacts 中作为证据，但不再加入电脑扫描目录。未增加设备管理权限、未修改用户模型 Key或默认模式。

## 失败与修正

- [首次启动失败](../../artifacts/custom-agent-runtime-launch-failure.log)：将 `--patch` 放在 profile 名称之前，原 CLI 要求显式 profile 而退出。修正为原参数顺序后启动；[手机断线入口失败](../../artifacts/custom-agent-runtime-launch-failure.json)与[重连窗口失败](../../artifacts/custom-agent-runtime-reconnect-failure.json)保留，均未发送测试消息。不能把这些驱动失败称为产品通过。
- 第一轮工具实际运行，但测试插件错误使用 `output.toContent`，原工具契约要求 `output.render(args, value)`，Host拒绝输出，手机正确显示失败。[观察失败](../../artifacts/custom-agent-runtime-render-failure.json)、[电脑执行记录](../../artifacts/custom-agent-runtime-render-failure-host.json)及[截图](../../artifacts/custom-agent-runtime-observe-failure.png)保留。修正夹具、重启临时DSH后，通过[显式重试阶段](../../artifacts/custom-agent-runtime-retry-android.json)仅发送一次新消息；不是客户端自动重发未知写入。
- [展开驱动失败](../../artifacts/custom-agent-runtime-expand-failure.json)：多个折叠轮次展开后定位集合缩短，原 nth 跳过下一项。改为逐个展开 first 后只重新观察已有结果，没有追加模型请求。

2026-09-28仅修改测试夹具、驱动和证据，没有改产品代码或重建相同APK；当时只证明受控模式的实际自定义工具执行。2026-10-01另已补验上文one-shot子任务继承，不外推PTC、真实自动审核拒绝或所有第三方模式；完整范围保留在[收尾验收表](./completion-audit.md)。
