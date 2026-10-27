# preview.15 部分思考内容无法展开：诊断

- 状态：修复前诊断记录，原因已复现并完成单变量验证；后续已按[原思考组件修复与验收](./remote-reasoning-current.md)实现并安装MuMu。下文保留当时只读诊断的范围；维护：手机端维护者，2026-10-27；[KKC-118](https://linear.app/kkcodes/issue/KKC-118)。
- 本轮只读排查，不修改产品/DSH源码、不重新安装或发行APK，不发送模型请求、不操作审批。诊断代码和隔离构建在忽略的 `artifacts/` 中；既有未提交改动保留。

## 结论

当前手机动画接口接线仍使用旧回调，而 rc.2 的原 `createFlowMotion` 已将第一个参数改成“取得当前滚动动画驱动器的函数”。[RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx)传入 `() => {}`，得到 `undefined`；原控制器要求驱动器对象或明确的 `null`。

发生收起批次时，原 `flushBatch` 按 `current !== null` 判断可用驱动器，因此误将 `undefined` 交给 `runBatch`，调用 `current.begin` 抛错。动画已进入批次，却未完成收尾；后续展开会被当作等待中的动作，留下 `height:0px; opacity:0; overflow:hidden`。内部 details 的 `open`、`aria-expanded` 仍可为 true，文本也仍存在，外观便呈现“箭头改变但看不到内容”，甚至后续正文覆盖/拦截该位置。

这是**已复现的一条具体触发路径**：先正常展开某轮思考，收起外层「已完成」，再展开外层。未经过收起批次的新实例可以正常展开，所以表现有选择性；不能据此按轮号或思考长度判定可用性。

## 数据与源码证据

- 原第49轮有7,842字思考；第50轮有工具前2,737字和工具后191字两段，均不是缺失数据。
- 单独回放这三段，在 rc.2/alpha.2 Edge 和 MuMu WebView 均可正常展开。第49轮展开后内容高约6,463 CSS px。仅“内容长”不足以复现本问题。
- 进一步只读解码原 DSH 的 `session.v4.jsonl.zstd`：510行，含1行会话头、509条原记录，序号0–508。zstd按连续帧读取；保留原序号、时间、来源引用与数据，回放完整50轮，而不是伪造生产数据。
- 较早的展示事件镜像省略内部记录，直接当快照会触发合法连续性校验；重编号还会破坏 `sourceEventSeqs`。这两种载体均未计通过，未为此放宽产品校验；最终使用完整原日志。

核对原源码：官方 rc.2 commit `687f282e8625c6b8d11ff58211a90524be2e4317` 的 `ui-chat/src/client/chat/flow-motion.ts`：

| 层 | 实际合同 |
| --- | --- |
| alpha.2 `createFlowMotion` | 首参为 `reserve(px): void`，空回调是有效的旧接法 |
| rc.2 `createFlowMotion` | 首参为 `driver(): InputFoldDriver \| null`，`undefined`不满足合同 |
| 手机 `RemoteWorkspace` | 同一空回调直接交给两个版本，缺少这层适配 |

`v0.1.0-preview.11` 中也存在同一空回调，公开构建元数据亦固定上述rc.2 commit。这里只证明该接线是继承的，不将未经实测的公开.11 APK也宣称已复现；不能仅凭本轮截图归因于新首页插件或字体/表格改动。

当前手机思考内容另外使用自建 `MotionDetails`，而官方使用 `ReasoningRow/useDisclosure`。这是源码复用差异，但本次因果证据指向动画驱动器接线，不能把“存在自建组件”直接等同于根因。

## MuMu 单变量实验

环境：Android12/WebView110，独立调试包 `dev.dshmobile.validation.rc21test`；实际 Workspace、原 Session、原日志和完整虚拟列表，不修改正式包数据。

| 载体 | 相同第49轮的收起/重开结果 |
| --- | --- |
| 原rc.2接线 | `Cannot read properties of undefined (reading 'begin')`；details仍open、文本仍在，父容器残留height0/opacity0；点击位置被正文拦截 |
| 仅隔离构建替换返回值为null | 无该异常；父样式清空，外层重开及内层连续3次开合均正常，文本高约6,463px |
| 原alpha.2接线对照 | 无异常；相同外层/内层4阶段样式均清空，符合旧reserve合同 |

实验只在 esbuild诊断插件的内存返回值中替换调用文本，未写入 `src/` 或原DSH；当前产品源码仍为旧空回调，不能称为“已经修复”。日志：`artifacts/reasoning-history-contract-bad.log`、`reasoning-history-contract-correct.log`、`reasoning-history-alpha2-control.log`。原完整内容不进入公开回归夹具，日志只记录长度、几何、状态和异常。

## 通用修复建议与验收

1. 在已有手机适配边界按真实SDK合同构造FlowMotion；没有接入原InputFoldDriver时，rc.2使用官方支持的显式null路径，旧版仍满足reserve合同，不用undefined假装驱动器。
2. 保证收起、取消、异常与卸载均清理临时隐藏样式，避免一个失败批次污染后续展开；不修改DSH本体。
3. 补真实Session/虚拟列表下的回归：首次展开、外层收起再开、内层反复开合、快速取消、离屏重挂、历史读取及滚动位置；分别覆盖新旧合同、单步纯回复和多步工具前后思考。

这是后续实施范围，本轮未更改开关行为、组件或安装包。模拟器正式包上一轮存在并行操作，本轮只使用隔离调试包；没有把隔离回放描述为正式包原配对端到端点击验证。
