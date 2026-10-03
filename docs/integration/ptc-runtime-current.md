# PTC 模式的真实手机执行

- 状态：实际单程序只读成功、文件缺失失败、内部工具层级、重入及失败后续聊通过；停止、其他失败和并发专项未完成。
- 维护角色：项目协作 Agent；核验日期：2026-10-01。
- 来源：原[PTC模式](../../../deepseek-harness/packages/preset/agent-presets/presets/ptc/agent.cordis.yml)、原[工具树](../../../deepseek-harness/packages/client/ui-tool/src/client/tool/ToolCallTree.tsx)、[实际Android驱动](../../scripts/verify-ptc-runtime.mjs)。

## 实际链路

### 文件缺失失败与续聊（2026-10-01）

同一[驱动](../../scripts/verify-ptc-runtime.mjs)新增 `--missing`，独立seed及报告前缀，不覆盖成功专项。prepare只确认随机专用路径确实ENOENT，不创建文件；手机新建只读PTC会话，要求只执行一次run_code内的read，不捕获错误、不重试或写文件。真实Host产生read not found和外层ToolCallError，没有替换工具或伪造错误事件。

- [10:53开始](../../artifacts/ptc-missing-start-android.json)及[观察](../../artifacts/ptc-missing-observe-android.json)通过：外层run_code与其容器内read均error，只存在一次程序调用，错误包含文件不存在信息；电脑路径仍不存在。
- [返回列表后重入](../../artifacts/ptc-missing-replay-android.json)保留相同层级和失败状态，没有重发工具。[实际截图](../../artifacts/ptc-missing-observe-android.png)已核对：长路径错误沿原插件外层缩放后字较小，不能将状态正确当成可读性已完善；保留此显示问题，不擅自改插件内部布局或取消用户既定的缩放策略。
- 通过[独立续聊消息](../../artifacts/ptc-missing-resume-android.json)要求普通回复，[10:54实际回复](../../artifacts/ptc-missing-resume-observe-android.json)出现且生成结束，证明失败后会话仍可继续；未把此前失败改写为成功。
- [清理](../../artifacts/ptc-missing-cleanup-android.json)：测试会话归档、返回原联调、草稿一致，目标路径仍不存在，无文件需删除。日常设备active/management=false，没有新增授权或服务重启。

本增量只改验收驱动及文档，没有修改产品代码或重建APK。停止、审批竞争、并发和其他错误类型仍未由此证明。

### 此前成功调用

手机在已有DSH-TEST工作区新建专用会话，设置只读权限，通过正式模式选择器选择“PTC 模式”。真实DeepSeek V4 Pro执行一次 `run_code`，在程序内调用 `read` 读取专用文件，最后回复文件内的完整随机校验行。随机内容仅在电脑文件中生成，不放入模型提示词；没有替换模型服务、注入结果或安装测试插件。

| 检查 | 证据 |
| --- | --- |
| 手机选择与发送 | [10:48 UTC开始报告](../../artifacts/ptc-runtime-start-android.json)，一次消息，既有工作区和read-only权限；默认模式、Key及设备权限不改。 |
| 实际执行与手机结果 | [观察报告](../../artifacts/ptc-runtime-observe-android.json)：外层程序与内部read可见、最终回复匹配随机文件原文、文件未改。[实际截图](../../artifacts/ptc-runtime-android.png)已核对。 |
| 回到列表后重入 | [重入报告](../../artifacts/ptc-runtime-replay-android.json)：原消息和结果仍在，明确检查read成功行位于run_code调用容器内，外层/内层均为ok。[重入截图](../../artifacts/ptc-runtime-replay-android.png)。未再次发送。 |
| 清理 | [10:49 UTC清理](../../artifacts/ptc-runtime-cleanup-android.json)：测试会话归档，专用文件内容核对后删除，返回原联调聊天且草稿一致。设备active/management=false。 |

## 环境恢复与入口失败

本轮开始时3080/8787无监听，ADB无设备。按既有配置恢复正常DSH源码启动（PID68808）及网关（PID74356），未重建数据库或设备绑定，未修改环境配置。恢复的原MuMu主实例index=0当前通过`127.0.0.1:16384`连接，已设置本机8787反向映射。

历史文档指向的index=2仍是早期技术验证版，启动后发现URL为index.html；[首次入口失败](../../artifacts/ptc-runtime-old-instance-failure.json)未发送消息，未覆盖该实例数据，随后关闭本轮启动的index=2。主实例有正式mobile.html与原绑定。重复启动后观察到两个同URL页面并出现[点击等待失败](../../artifacts/ptc-runtime-activity-entry-failure.json)；使用既有清理Activity栈的正常启动参数后入口可用，未清理App数据，不能仅凭此确定点击失败根因。随后[首页加载失败](../../artifacts/ptc-runtime-home-loading-failure.json)来自驱动在列表未返回时立即判断行数量，改为等待原列表入口后通过。这些失败不能当作PTC成功证据。

本轮仅新增实际验证驱动和记录，产品代码、APK、上游参考及兼容补丁未变。模拟器与本机服务保持正常运行。驱动将发送和观察分开，等待超时不重新发送；清理只针对seed记录的专用路径并核对原文，不删除未知会话或文件。

## 剩余边界

### 内部工具停止：修复后实际验证（2026-10-01）

状态：本次原样抛出取消reason专项已通过，不外推全部并发/审批组合。原registry精确识别已取消signal的同一reason，独立错误保持；[固定基线增量补丁与回归](../../../plugin/compatibility/ptc-cancel/README.md#内部工具原样抛出取消原因2026-10-01)已安装源码和编译入口。原测试加新增两项共127通过，原版新增取消用例失败；两套安装/回滚各3项通过。

纠正下方初步判断：正式手机由remote-model.mjs注册conversation-nodes/tool.ts，childResult已经传递data.error；bundle-analysis亦包含该入口。遗漏字段的是旧model/tool-call-tree.ts，不应为修复本入口修改未使用的旧投影。因此此次APK和手机生产代码未改。

- [14:19实时停止](../../artifacts/ptc-inner-stop-patched-stop-observe-android.json)与[重入历史](../../artifacts/ptc-inner-stop-patched-stop-replay-android.json)：父run_code和其内部等待工具均stopped，Host确认收到取消、未完成。[截图](../../artifacts/ptc-inner-stop-patched-stop-replay-android.png)已检查，两层均中文“工具调用已停止”。
- [真实续聊](../../artifacts/ptc-inner-stop-patched-resume-observe-android.json)成功；[清理](../../artifacts/ptc-inner-stop-patched-cleanup-android.json)归档专用聊天、原草稿保持；[Host最终报告](../../artifacts/ptc-inner-patched-host.json)disposed=true。原公共Host报告文件会被每次启动覆盖，不作为首轮session身份的固定证据，首轮以持久事件摘录和失败Android报告为准。
- [14:20真实文件缺失失败](../../artifacts/ptc-missing-inner-patched-observe-android.json)与[历史重入](../../artifacts/ptc-missing-inner-patched-replay-android.json)仍为内外error、一次调用；[续聊](../../artifacts/ptc-missing-inner-patched-resume-observe-android.json)与[清理](../../artifacts/ptc-missing-inner-patched-cleanup-android.json)通过，目标文件始终不存在。

正常DSH PID9512，等待插件已卸载、日常设备active/management=false；无需改变Key或管理授权。整体Remote仍按完整矩阵验收。

### 内部工具停止：真实失败已复现（2026-10-01）

状态：未通过，待修复。通过[专用等待工具](../../tests/fixtures/live-ptc-wait/index.js)和[正式 Android 驱动](../../scripts/verify-ptc-runtime.mjs)的 `--inner-stop` 路径验证。真实模型在只读 PTC 会话内调用一次 run_code，再调用无文件/网络/进程副作用的等待工具；确认工具实际运行后，手机点击停止。

- [Host 报告](../../artifacts/ptc-inner-wait-host.json)确认内部调用收到取消，aborted=true、completed=false；不是仅隐藏手机生成状态。
- [实际手机结果](../../artifacts/ptc-inner-stop-stop-observe-android.json)失败：外层 stopped，内层 error。[原持久事件摘录](../../artifacts/ptc-inner-persisted-events.json)中内部结果仅有 `Error: [object Object]`，缺少结构化 error。原工具 registry 的 dispatchToolBody catch 将抛出的取消 reason 当通用异常；不能据正文或停止按钮点击记录伪造取消状态。
- [原客户端内部投影](../../../deepseek-harness/packages/client/ui-chat/src/client/model/tool-call-tree.ts)的 settled block 未传递 data.error。即使 Host 修好标记，此投影仍需保留结构化错误；须检索并覆盖其他内部工具投影与手机实际入口。当前仅定位，尚未修改生产逻辑。
- [外层诊断](../../artifacts/ptc-inner-stop-stop-evidence-android.json)证明 runtime abort 与已产生输出保留；该报告不能替代内层状态验收。[停止后续聊](../../artifacts/ptc-inner-stop-resume-observe-android.json)实际收到模型回复。
- [清理](../../artifacts/ptc-inner-stop-cleanup-android.json)已归档专用会话并返回原聊天，草稿保持；等待插件经原 CLI 卸载、Host disposed=true，管理权限仍 false。正常 DSH PID2384，无临时启动补丁，APK未改。

下一步优先在原 registry 调用链复现“取消 reason 被工具原样抛出”，与真正独立异常区分，避免将停止时发生的全部错误吞成取消；再补齐手机共享内部投影并回归真实 Android 与非取消失败。重测使用独立 seed/报告，保留本次失败证据。

### PTC停止分类修复（2026-10-01）

#### 补丁后的真实非取消失败回归

11:18 UTC通过正式手机入口新建独立只读PTC会话，实际模型仅调用一次run_code并在内部read读取不存在的专用路径。[观察](../../artifacts/ptc-missing-patched-observe-android.json)确认内层和外层仍为error，不被取消补丁误改为stopped；[历史重入](../../artifacts/ptc-missing-patched-replay-android.json)保留嵌套关系和失败原因，无重试调用。随后[真实续聊](../../artifacts/ptc-missing-patched-resume-observe-android.json)通过，[清理](../../artifacts/ptc-missing-patched-cleanup-android.json)归档专用会话、原草稿一致、目标文件始终不存在。此次未修改代码、APK、配置或授权。与下方纯等待停止专项一起证明本补丁对这两种真实结果的分类边界，不外推其他失败组合。

状态：本专项修复并实际验证；维护角色：DSH Mobile协作Agent；最近核验：2026-10-01。下方原版失败记录保留，不代表当前新结果。

[电脑兼容补丁](../../../plugin/compatibility/ptc-cancel/README.md)按结构化runtime.error.kind区分abort，保留完整输出与非取消失败；原125项测试及3项安装回滚检查通过，已安装两个入口并正常重启DSH为PID55988，手机生产代码/APK未变。上游参考未改，旧记录不重写。

- 第一轮[停止显示](../../artifacts/ptc-stop-patched-stop-observe-android.json)为stopped，但停止过早没有Captured output，[输出断言](../../artifacts/ptc-stop-patched-stop-evidence-android.json)如实失败。此后详情未关闭导致续聊按钮禁用超时；关闭窗口后显式发送一次，[续聊](../../artifacts/ptc-stop-patched-resume-observe-android.json)及[清理](../../artifacts/ptc-stop-patched-cleanup-android.json)通过。首次服务尚未就绪时的[新建等待失败](../../artifacts/ptc-stop-patched-startup-wait.json)未发送消息，恢复就绪后才新建。
- 第二轮留出进程启动时间再停止，[11:16停止显示](../../artifacts/ptc-stop-output-stop-observe-android.json)及[完整详情核对](../../artifacts/ptc-stop-output-stop-evidence-android.json)通过：state=stopped，runtimeAbort=true，Captured output含开始标记、不含等待后的结束标记；[实际截图](../../artifacts/ptc-stop-output-stopped-android.png)显示中文“工具调用已停止”。源码中的标记不作为已输出证据。
- [续聊](../../artifacts/ptc-stop-output-resume-observe-android.json)及[清理](../../artifacts/ptc-stop-output-cleanup-android.json)通过，两个专用会话归档、原聊天草稿一致、未创建测试文件；设备active/management=false。
- 此专项验证纯等待程序取消及部分输出保留；内部工具取消竞争、其他明确剩余范围仍分别核验，完整Remote未完成。

### PTC 停止分类缺陷（2026-10-01）

状态：真实复现，未修复；维护角色：DSH Mobile 协作 Agent；最近核验：2026-10-01。

[验证驱动](../../scripts/verify-ptc-runtime.mjs)增加独立 `--stop` 场景：新建已有DSH-TEST下的只读PTC聊天，让实际模型执行一次纯等待程序，输出开始标记、等待90秒、再输出结束标记；不调用内部文件/网络/Shell工具。

- [11:08发送](../../artifacts/ptc-stop-start-android.json)、[手机停止](../../artifacts/ptc-stop-stop-android.json)；[观察失败](../../artifacts/ptc-stop-stop-observe-android.json)明确记录实际state=error、预期stopped，保留[截图](../../artifacts/ptc-stop-stopped-android.png)。这不是通过报告。
- [独立错误详情核对](../../artifacts/ptc-stop-stop-evidence-android.json)：电脑结果为 `code run failed (abort)`，Captured output 包含开始标记、不含结束标记，生成已结束；部分输出保留，但取消误报失败尚未修复。首次停止前定位包含源码，不能单独证明输出已发生；上述持久结果提供了补充依据。
- [续聊观察](../../artifacts/ptc-stop-resume-observe-android.json)真实回复成功；[清理](../../artifacts/ptc-stop-cleanup-android.json)归档专用测试会话、返回原联调且草稿一致，未创建文件或变更授权。
- 根因：原[ptc.ts](../../../deepseek-harness/packages/core/tools/src/ptc.ts)对所有result.error抛CodeRunFailedError，包含abort，错误结构只保留name/code。实际安装源码与参考SHA256均为 `7a7c19cfdabce7bad053291614b1d727205e94601771a7b239790b3b0f0a7eab`；对应原[测试](../../../deepseek-harness/packages/core/tools/tests/ptc.spec.ts)也只要求abort正文。
- 下一步：电脑兼容补丁保留取消的结构化身份与部分输出，再验证手机显示及非取消失败不变；不得仅按手机点击记录或错误正文猜测停止。本轮未修改电脑运行时或App生产代码，也不把已停止执行外推为状态正确。

已证明当前电脑提供PTC能力时，DSHM自己的聊天页能发起真实程序、展示嵌套工具并重读历史。内部文件缺失错误与失败后续聊见上；停止、其他失败、审批竞争和子Agent继承等具体场景仍须分别核验。原插件长路径摘要仍按既定规则缩放，完整内容通过下方独立详情阅读；不将本次单read成功/失败外推全部情况。完整目标继续见[收尾验收表](./completion-audit.md)。

## 工具详情可读性（2026-10-01）

- 状态：实现并完成本专项验证；维护角色：DSH Mobile 协作 Agent；最近核验：2026-10-01。
- 取舍：不修改第三方插件内部换行规则，也不取消用户既定的外层等比例缩放；在原节点的可见性/过程折叠范围内增加 DSHM 自有详情入口。该入口位于插件框外，复用已有详情窗口与真实工具记录，主聊天和旁栏共用。普通终端命令仍走原命令详情。
- 来源：[共享节点接入](../../src/remote-plugin-slots.jsx)、[工具详情](../../src/ui/RemoteToolDetail.jsx)、[备用与嵌套渲染](../../src/ui/RemoteMessage.jsx)、[局部详情样式](../../src/ui/remote-product.css)。当前工具默认展开；内部工具按需展开；详情参数换行不影响其他文件预览。
- [完整页面回归](../../artifacts/tool-detail-full-web.log)通过，无控制台错误；[专项页面回归](../../artifacts/tool-cancellation-web.json)另验证主聊天/旁栏详情、普通失败保留及入口不属于缩放框。后者包含随后补充的旁栏详情点击用例。
- Web 构建与[Android 构建/lint](../../artifacts/tool-detail-android-build.log)通过，新 APK 已覆盖安装 MuMu。11:05 UTC，[正式 Remote 入口验证](../../artifacts/tool-detail-android.json)读取此前真实 PTC 文件缺失记录，入口14px/32px且无缩放祖先，详情展开、内部 read 错误及换行均通过；[截图](../../artifacts/tool-detail-android.png)已人工核对字体可读。
- 首次[驱动失败](../../artifacts/tool-detail-driver-failure.json)误用了不存在的过程折叠选择器，入口仍被原折叠隐藏；更正为现有 data-turn-process 后通过，保留[失败截图](../../artifacts/tool-detail-entry-failure.png)，未改生产折叠行为。
- 返回原联调、草稿保留，设备 active/management=false；没有新模型调用、权限提升或电脑配置变更。此专项不证明 PTC 停止、其他失败及完整 Remote 已完成。
