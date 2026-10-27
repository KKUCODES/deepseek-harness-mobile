# Remote 思考折叠修复与原组件复用

- 状态：本地实现并原签名安装MuMu，未提交、推送或发行。维护：手机端维护者；核验：2026-10-27；[KKC-121](https://linear.app/kkcodes/issue/KKC-121)。
- [原诊断](./remote-reasoning-diagnosis.md)记录了修复前完整日志与单变量证据。仍在`release/preview15-from-preview11`，保留既有未提交UI及图片修复；未修改DSH本体、电脑插件或中转，不混旧插件适配分支。

## 原因与选择

rc.2的原FlowMotion首参是`driver(): InputFoldDriver | null`，手机却沿用alpha.2的空reserve回调，返回undefined；外层收起触发`undefined.begin`，残留height0/opacity0，导致箭头改变而正文不可见。正文数据没有丢失，不能按轮号或长度判断可展开性。

只改回调可以消除已确认异常，但继续维护手机自己的显隐与思考展开会增加合同差异；完整移植桌面输入框驱动器又会扩大滚动、输入区和性能测试范围。本次使用原控制器明确支持的无驱动器路径，并直接复用原思考行、状态Hook及内容席位，不引入桌面专用协调器。

## 接线与兼容边界

- [RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx)的首参显式返回null。rc.2不会误入驱动器批次；alpha.2旧reserve回调不使用返回值，同一回调满足新旧合同，没有写死SDK版本分支。
- [手机视口适配](../../src/remote-chat-presentation-alpha2.jsx)直接调用当前SDK的原`useFlowHidden`，删除手机复制的显隐/取消实现；原控制器与Hook负责取消、卸载和临时样式清理。Workspace卸载仍调用原`clear()`。
- [新版呈现边界](../../src/remote-chat-presentation-latest.jsx)直接导出当前SDK的原`ReasoningRow`、`bindDisclosure`，注册原`ReasoningContent`工厂和`DefaultReasoningBody`。原样式、图标、摘要、键盘操作、Markdown紧凑排版和本地化均归原组件。
- [节点接线](../../src/remote-plugin-slots.jsx)将原ChatNodeSeat的`disclosureReset`交给原bindDisclosure，稳定保存每次调用的Hook身份；默认助手与第三方节点继续共享原重置合同。根思考正文席位允许插件包装，并调用原`conversation.chat.reasoning.content`工厂，不特化插件名称。
- [RemoteMessage](../../src/ui/RemoteMessage.jsx)只连接思考内容、运行状态和原席位props，空白思考不绘制行；外层过程仍遵守原会话投影。旧基础SDK入口[remote-chat-presentation](../../src/remote-chat-presentation.jsx)保留原回退，不强制导入该版本没有的模块。普通API聊天的思考布局不在本次改动范围内。

## 回归结果

新回归先在真实Workspace/原Session/虚拟列表下复现`undefined.begin`和父容器height0/opacity0，再运行同一测试验证修复。合成事件连续编号，不放宽历史校验；不将原用户思考正文加入公开夹具。

| 验收项 | rc.2 | alpha.2 |
| --- | --- | --- |
| 首次展开、外层收起再开、内层反复开合和键盘操作 | Edge、MuMu实际RemoteActivity通过 | Edge、MuMu实际RemoteActivity通过 |
| 快速反向、减少动画、折叠中离开/重进、临时样式及锚定恢复 | 两环境通过 | 两环境通过 |
| 工具前后两段思考、插件正文包装/原工厂及停用回退 | 两环境通过 | 两环境通过 |
| 历史前插、离屏卸载/重挂、原Session与草稿保持、阅读时实时追加 | 两环境通过 | 两环境通过 |
| 旁栏独立会话完整专项 | Edge、MuMu通过 | Edge通过 |

578项Node测试、图片专项及连续历史回归通过；历史前插锚点误差0px。两SDK网页构建、Android release构建与lint通过。专项会核对实际展开的完整正文及祖先可见性，不能仅凭摘要文字或aria状态宣布成功。

```text
node scripts/verify-preview15-history.mjs --reasoning
node scripts/verify-preview15-history.mjs --reasoning --alpha2
node scripts/verify-preview15-history.mjs --reasoning --aside-history
node scripts/verify-preview15-history.mjs --reasoning --aside-history --alpha2
node scripts/verify-remote-images-android.mjs --reasoning
node scripts/verify-remote-images-android.mjs --reasoning --alpha2
node scripts/verify-remote-images-android.mjs --reasoning --aside-history
node scripts/verify-preview15-history.mjs --images
node scripts/verify-preview15-history.mjs --terminal
node --test tests/*.test.mjs
```

[真实入口检查](../../scripts/check-remote-reasoning.mjs)与[合成协议夹具](../../tests/fixtures/remote-reasoning-chat.jsx)可重复执行；Android复用现有隔离运行器，通过普通聊天抽屉实际进入RemoteActivity，不放宽CSP，不读取正式包Key。测试曾把display:contents的零盒高误当隐藏、英文标题误写为Thought、用程序滚动代替用户取消跟随；均修正测试后复验，没有借此增加产品滚动逻辑。构建盘满时仅清理可重建的test.js/test.css，报告、截图、源码和用户数据保留。

## 正式包真实电脑验收

原签名覆盖`dev.dshmobile.validation.officialtest`，`preview.15`/code25；APK为`artifacts/DSHM-preview15-reasoning.apk`，SHA256为`b9bfcdaff69235446553d672ba6ad92eaf3ee79b722e860e7afa8e45a9b847df`。安装base.apk哈希一致，211个网页资源逐文件与构建产物一致，原签名证书校验通过。

通过原电脑配对进入「DSHM 真实 DeepSeek 长聊天测试」→「真实 DeepSeek · 50轮复杂往返（已完成）」。实际展开第50轮工具前思考；第49轮完整思考展开后，收起外层「已完成，用时22秒」再重开，正文可见，再反复点击内层仍可展开。原截图`artifacts/reasoning-real50-open.png`、`reasoning-real49-reopened.png`、`reasoning-real49-final.png`已视觉核验，最终停留在第49轮展开状态。

原聊天、Key、配对及插件数据保留，没有向模型发送新消息、改设置或操作审批。正式电脑的实时新输出/故障注入没有另发请求；对应分支由上述合成协议覆盖，不冒称真实配对全场景验收。README已核对，本次修复既有能力，没有新增公开操作或发行承诺。
