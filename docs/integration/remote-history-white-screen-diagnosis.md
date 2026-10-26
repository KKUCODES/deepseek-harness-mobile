# 长聊天连续加载历史后的白屏排查

本文保留修复前诊断；用户随后授权的实现与回归见[长聊天窗口与恢复](./remote-history-window-current.md)。下方“未修改”等描述均指当时排查阶段。

状态：2026-10-24，阶段性排查；已确认累计渲染的资源压力，尚未复现反馈用户的持续白屏，不能据此认定其唯一根因。维护角色：手机端维护者。[KKC-89](https://linear.app/kkcodes/issue/KKC-89)。本轮不修改产品代码、不提交发布、不修改 DSH，不混入插件适配分支；此前未提交的外链修复保持。

## 已确认的代码路径

- 用户点击[聊天页面](../../src/ui/RemoteWorkspace.jsx)的“加载更早的消息”，经过 [loadEarlierHistory](../../src/remote-history-position.mjs)、[loadRemoteHistory](../../src/remote-history.mjs)，调用原 SDK `session.loadOlder()`。已有请求互斥和切换会话后的失效保护。
- rc.2 SDK 的 `packages/api/session-controller/src/client/sessions/session.ts` 按回合分页，每页最多 500 条消息记录；`prependWindow()` 将新页交给事件窗口。`contract/events.ts` 的 `SessionEventSource.prepend()` 连接原窗口和新页，不淘汰已加载页。源码核验路径为本项目忽略目录 `artifacts/rc21/source/`，未修改上游。
- DSHM 对 `state.conversation.order` 中全部节点执行 `map`，没有聊天可见窗口的虚拟渲染。原消息经过 [RemoteMessage](../../src/ui/RemoteMessage.jsx)、[插件节点席位](../../src/remote-plugin-slots.jsx)及 [Markdown](../../src/ordinary-rendering.jsx)渲染；折叠和 memo 不等同于释放离屏节点。
- 历史定位会查询全部消息实体行，逐项测量可见性和位置，并保存锚点数组；不是只查询当前屏幕内的少量行。
- [Remote 页面入口](../../src/remote-main.jsx)与聊天外壳未设置整页 React 错误边界。JS 渲染异常和 WebView 进程退出是不同路径；[RemoteActivity](../../android/app/src/main/java/dev/dshmobile/validation/RemoteActivity.kt)已有 `onRenderProcessGone`，会显示原生失败封面并销毁旧 WebView，未自动重建。不能把任何白屏都归为原生进程崩溃。

上次[通用分块](./remote-response-chunks.md)修复的是响应能够到达手机。32 MiB 单条/64 MiB 在途预算是传输字节预算，不限制会话已累计的数据、React 节点、Markdown 或浏览器布局内存。

## 本轮复现方法和证据

诊断脚本位于忽略目录 `artifacts/history-white-screen/probe.mjs`。用现有真实 `RemoteWorkspace`、原 SDK 会话/事件源/会话投影，点击实际分页按钮，并向 `session/page` 回放递减游标、互不重复的旧回合。每页由合法的 turn/step/message/end 事件组成，始终逐页等待完成，不直接向 DOM 塞历史。

运行时固定 rc.2 SDK。数据为合成文本，产品源码处于 main 加此前未提交外链修复状态，历史分页逻辑未改；不是公开 APK 的独立二进制复验。Android 使用 API 36.1 独立模拟器 5556、专用 rc21test UID 和真实 RemoteActivity，CDP 装入产品组件夹具。没有连接用户电脑、读取原聊天/Key/配对或调用模型，未操作日常 MuMu 5554。

| 路径 | 已观察结果 | 限制 |
| --- | --- | --- |
| Edge，100 回合/页，普通长段落，连续 15 页 | 已加载 1,600 回合、8,000 条事件，约 43,290 个页面元素；JS 堆约 167 MB，页面仍可显示 | 桌面浏览器，不是真机；约 1,000 字符参数的早期脚本按固定重复单位生成，不能和后续脚本直接作精确性能比值 |
| Android，100 回合/页，长段落，连续 12 页 | 1,300 回合、6,500 条事件，35,197 个页面元素；JS 堆约 191 MB，最后截图正常 | 未发生相同白屏；自动化整条翻页耗时含滚动、桥往返和布局，不能当成纯 JS 阻塞时长 |
| Edge，25 回合/页，约 8,000 字符 Markdown 多段加粗，连续 6 页 | 175 回合、875 条事件，169,490 个页面元素；JS 堆约 199 MB，仍显示 | 排版复杂度明显增加了节点数，未捕获渲染异常 |
| Android，同类多段 Markdown | 第 8 页已达 217,897 个页面元素；独立采样 WebView 渲染进程 RSS 约 1.1 GB。第 10 次翻页超过自动化 20 秒完成等待，随后重新连接读取到 275 回合、1,375 条事件、266,297 个元素，loadingOlder=false，仍能显示 | 这是渲染进程总量，包含原普通聊天 WebView、Remote、夹具及调试开销，不等于聊天 JS 堆，也不是真机阈值；超时未完成计划的 GC/离开会话测量，不能将该次自动化超时认定为持续白屏 |

表中 MB 按十进制约数。多段 Markdown 每页为约 242,226 个 JSON 字符；中文 UTF-8 字节更多，不能把报告字段 `bytes`（早期脚本实为 `JSON.stringify(...).length`）直接当成网络字节。正文约 459 KB/页，加事件包络仍低于原 2 MiB 单帧上限。

结果、截图及日志：

- `artifacts/history-white-screen/report-0.2.1-rc.2-100-1000.json`：第一轮普通段落。
- `report-android-0.2.1-rc.2-100-10000.json`：Android 连续 12 页普通段落。
- `report-web-0.2.1-rc.2-paragraphs-25-8000.json`：Edge 多段 Markdown。
- `report-android-0.2.1-rc.2-paragraphs-25-8000.json`：Android 多段 Markdown；最初一次因复用 Activity 时选到错误页面，未进入分页，不能计作复现。最终运行先结束本任务 UID，再从普通聊天真实按钮进入 Remote。
- `android-renderer-memory.txt`、`android-errors.txt`：独立模拟器采样；不能用启动阶段的系统内存回收或 WebView 配置日志冒充聊天崩溃证据。
- `after-timeout.json`、`after-timeout.png`、`after-timeout-native.png`：第 10 页超时后的实际状态和页面/原生截图；根节点仍存在、openError=null、loadingOlder=false，正文正常绘制。额外的原始 CDP 连接探针未成功完成，不计诊断依据。

附加对照只在诊断页移除两条消息间距的兄弟选择器：`report-web-0.2.1-rc.2-plain-100-1000-no-gap.json`。节点和内存仍持续增长，未消除随历史增多而变慢的趋势。其 GC 后堆约 145 MB，离开会话后约 54 MB；不据此宣称已证明永久泄漏或精确定位某条 CSS。应区分当前会话合法持有、临时解析/布局和真正泄漏。

诊断结束已卸载本任务 rc21test 应用并关闭独立 5556 模拟器；日常 5554 保持在线。296 处涉及文档的本地链接和 `git diff --check` 通过，公开安装包、用户 App 和原有外链修复未改变。

## 结论与尚未确认的部分

**确认：长聊天能传到手机后，手机端仍会累计持有并渲染全部已加载历史，没有总渲染规模预算。** 同页数下复杂 Markdown 产生更多节点和更高内存压力。脱离公网中转仍能出现该压力，因此它不需要中转故障才能发生；尚不能排除用户实际链路存在另一问题。

持续白屏本身尚未复现。没有捕获对应的 React 异常、渲染进程死亡或异常滚动结果，故“内存耗尽导致该用户白屏”仍为待核实推断。重启会释放内存和重建页面，也会清除异常运行状态，不能仅凭重启有效认定根因。Android 已有原生崩溃封面，但 JS 错误的页面级恢复仍有缺口。

## 建议的后续修复范围（本轮未实施）

1. 在 DSHM 聊天层按回合实现有界的可见渲染窗口，离屏历史保留定位信息并可重新读取；大段正文、思考、工具输出按需展开/解析。保留文件入口、插件席位和查阅旧记录能力，不能简单丢弃历史来规避。
2. 分页后的投影/渲染分批处理，锚点只保留所需少数行；同时限制累计数据和临时工作集，避免只减少 DOM 而事件/解析仍无界增长。现有 SDK 数据语义保持，通过手机端适配实现，不修改 DSH 本体。
3. 补充页面错误边界、局部消息错误隔离和可操作的恢复入口；补充不含正文/凭据的错误类型、页数、节点量及渲染进程退出分类。原生死亡时应能够重建页面并保留草稿，而不是对已销毁的 WebView 继续操作。
4. 回归必须走真实分页按钮，覆盖多页、复杂 Markdown/代码/工具、实时追加、重连、切换会话及返回；同时验证节点/内存预算和失效恢复。原来单次大页验收、持续追加 1,000 回合的测试，不能替代这次反复向前翻页。

## 成熟方案的公开依据

2026-10-24 按用户要求联网核验，仅采用官方一手文档，不修改产品代码。这些资料支持通用优化方向，不证明本次反馈用户白屏的直接原因。

| 层次 | 一手依据 | 对 DSHM 的意义与边界 |
| --- | --- | --- |
| 可见区域渲染 | [Stream Chat VirtualizedMessageList](https://getstream.io/chat/docs/sdk/react/components/core-components/virtualized-list/) 为长历史仅保留可见消息 DOM；[Virtuoso Message List](https://virtuoso.dev/message-list/)提供聊天/机器人对话的虚拟列表、实时消息和滚动控制 | 有商用聊天 SDK 实践。DSHM 仍须验证变高消息、向前插入时的阅读锚点、流式输出及插件状态；不是已选定某个库。Virtuoso 独立 Message List 包采用商业许可，不能和基础 React Virtuoso 混同 |
| 历史数据内存 | [TanStack Query Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries#what-if-i-want-to-limit-the-number-of-pages) 使用 maxPages 配合双向游标限制内存中的页数 | DOM 虚拟化不自动释放会话数据。DSHM 应先核对 SDK 投影重建所需的事件/检查点及读取能力，再制定手机端活动窗口；不直接截断原事件数组或删除电脑历史 |
| 主线程响应 | [Chrome 团队 Optimize long tasks](https://web.dev/articles/optimize-long-tasks)建议拆分长任务并让出主线程 | 按回合或内容块安排工作，保留一致的发布边界。仅拆函数、Promise 微任务或网络分块，不代表浏览器获得绘制机会；新调度 API 需要兼容旧 WebView |
| 渲染异常隔离 | [React Error Boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)指出未捕获的渲染异常会移除界面，并以聊天列表和单条消息为隔离例子 | 补充可恢复的页面/消息边界。不能捕获所有事件处理/异步异常，也不能恢复已被系统结束的 WebView 进程，不能作为内存优化的替代 |
| 原生进程恢复 | [Android Handle WebView termination](https://developer.android.com/develop/ui/views/layout/webapps/handle-termination)要求销毁失效实例、重建 WebView，并区分系统回收与自身崩溃 | 沿用现有桥的来源/权限限制，重建后恢复草稿与有效连接，不自动重放发送或审批决定 |

[content-visibility](https://web.dev/articles/content-visibility)可以减少离屏布局和绘制，但节点仍在 DOM 中；官方还提示几何测量可能迫使离屏渲染。因此它适合作为辅助优化，不能单独解决本轮已确认的节点和数据累计问题。最终策略是分别限制可见节点与活动数据，分批处理，并为不同故障提供恢复；不以文档示例的固定三页或任意固定消息数作为 DSHM 的验收预算。
