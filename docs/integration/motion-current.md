# Remote 动效

- 状态：实现、浏览器专项、完整页面回归与 MuMu 实际入口验证完成；尚未提交或发布。
- 维护角色：DSHM 手机端维护者。
- 最近核验：2026-10-14。
- 任务：[KKC-53](https://linear.app/kkcodes/issue/KKC-53)。

## 当前范围

Remote 的工作区、会话进退使用有方向的短距离位移与淡入；同一会话的流式更新、模型状态或草稿变化不会重播整页动画。窗口打开约 260 ms、退出约 170 ms，执行过程按原视口折叠时钟处理；不添加循环装饰动画或新的动画依赖。

共享的 `Surface`、插件/设置 `PanelSurface` 与电脑插件管理窗口使用同一进出规则。文件、命令和输出窗口的全屏变化使用外层尺寸变换，内部表单与滚动容器保持同一实例；普通聊天使用共享窗口，也获得相同的开关效果。插件内部布局仍由作者控制。

## 需要保留的行为

- 窗口视觉退出与业务关闭分开：关闭即停止读取、取消恢复登记并屏蔽旧按钮。侧栏输出在退出期间不能重新写回“仍然打开”的恢复记录。
- 原生 dialog 在逻辑关闭时立即释放模态状态，使用不可操作的普通窗口保留退出画面；同级遮罩单独淡出。残影不重新执行 `show()` 聚焦步骤，避免新会话首个输入被拦住或背景输入框收起。中途重新打开时进入原生模态层。
- 插件面板仍保留原标签实例；关闭即释放背景交互和返回处理，不延迟权限撤销。窗口卸载、会话切换、重连和读屏契约沿原生命周期处理。
- 动画中途可取消或反向；完成后清理临时变换。页面最外层不承担滚动，聊天和插件自身的滚动能力保持。
- 系统要求减少动态效果时直接到达最终状态；改变该设置也会结算正在播放的自有动画。

## 验证入口与边界

| 范围 | 命令或证据 | 当前结论 |
| --- | --- | --- |
| 实际 RemoteWorkspace 与共享窗口 | `node scripts/verify-remote-plugin-slots.mjs --motion`；本机 `artifacts/remote-motion-web.json` | 已通过模型窗口进退、导航、远程追加不重播、草稿、焦点、十次中途开关、全屏、折叠和减少动态效果 |
| alpha.2 原节点与手机折叠适配 | `node scripts/verify-remote-flow-motion.mjs`；本机 `artifacts/remote-flow-motion-web.json` | 主聊天/旁栏展开收起、局部草稿、中断清理和减少动态效果通过；属于组件回放 |
| 原输入框鼠标/触摸 | `node scripts/verify-composer-focus.mjs` | 首次点击、输入框收起、草稿与 Escape 通过 |
| 全量页面与业务契约 | `node scripts/verify-remote-plugin-slots.mjs`；本机 `artifacts/remote-motion-full-page.log` | 已通过窗口交接、插件局部状态、主/旁栏、审批、模型/设置、文件、输出及恢复登记。旧夹具缺失地址核对日志的真实存储，已补入隔离 IndexedDB，未绕过生产保护 |
| Android 实际 Remote | `node scripts/verify-remote-motion-android.mjs`；本机 `artifacts/remote-motion-android/16d5b543-0117-4b86-9d85-1bc9a1cc9f11/report.json` | 已通过普通入口→Remote→已有工作区新建聊天、模型菜单、真实电脑文件预览、返回及工作区进退；帧采样的外层宽高始终为 420×843，无新增滚动范围；草稿、焦点和授权清理通过 |
| 构建与包内一致性 | `node scripts/verify-motion-apk.mjs`；本机 `artifacts/remote-motion-apk.json` | 官方 alpha.2 手机资源与 Android assembleDebug/lintDebug 通过；168 个 Web 文件与 APK 内资源逐字节一致，并记录当前源码摘要 |

实际环境使用官方 DSH `0.2.1-alpha.2`、已发布插件 `0.1.84-latest.0`、生产中转实现与独立 `.officialtest` UID，没有修改或构建 DSH 本体。测试没有读取 Key 或发送模型消息；空会话不会出现在历史列表，因此 Android 通过正常的新建聊天入口验证，历史列表导航另由实际 RemoteWorkspace 的浏览器回放覆盖。此前 ADB 枚举、已有绑定的原生提示和空列表造成的驱动失败保留在同目录其他 UUID 下，不计为通过。最终测试设备已撤销、本机测试绑定已移除、临时转发及自有 Host 已关闭。

本地调试候选为 `artifacts/releases/DSHM-2026-10-14-remote-motion.apk`，13,480,416 字节，SHA-256 `601b22f14b131018ded457afc4d4da3f3ff35ac5318bfb21448c1e4c08033bbb`；与 MuMu 实际安装包一致。它保留独立测试身份，不是新的公开 Release。

浏览器组件回放不等于真实电脑或 Android 验收。这里不宣称所有第三方插件、物理手机帧率或全部旧功能已重新验证；公开 Release 尚未包含本次未提交的改动。

## 代码来源

[共享动效](../../src/ui/motion.jsx)、[原生窗口](../../src/ui/Surface.jsx)、[Remote 页面](../../src/ui/RemoteWorkspace.jsx)、[插件窗口](../../src/remote-plugin-panels.jsx)、[窗口交互隔离](../../src/remote-surface-inert.mjs)、[alpha.2 折叠适配](../../src/remote-chat-presentation-alpha2.jsx)、[只读输出](../../src/ui/RemoteLiveJobOutput.jsx)与[样式](../../src/ui/mobile.css)。仅修改 DSHM，官方 DSH 与固定 SDK 源码保持只读。
