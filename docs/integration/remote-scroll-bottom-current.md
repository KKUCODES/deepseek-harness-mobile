# Remote 回到底部：原 DSH 源码接入

- 状态：preview.15 本地候选，尚未提交或发布；不属于旧插件适配分支。
- 维护：手机端维护者；核验日期：2026-10-27；[KKC-115](https://linear.app/kkcodes/issue/KKC-115)。
- 基线：[以 preview.11 重建 preview.15](./preview15-rebuild-current.md)。官方 Session 连续历史与 DOM 虚拟化保持，不恢复双向数据窗口、较新消息栏或自动触顶分页。

## 直接复用的源码

以官方 DSH rc.2 commit `687f282e8625c6b8d11ff58211a90524be2e4317` 为事实来源，同时核对 alpha.2。构建仍由 `latestMobileBuild` 选择对应版本的原源码，不修改上游文件。

| 原 DSH 文件 | DSHM 接入方式 |
| --- | --- |
| `packages/client/ui-chat/src/client/chat/ChatView.tsx` | 原按钮未单独导出；[RemoteChatFrame](../../src/ui/RemoteChatFrame.jsx)保留 `!scroll.followingTail`、按钮 JSX、类名访问及 `scroll.returnToBottom` 接线 |
| 同目录 `ChatView.module.css` | 直接导入原 `frame`、`toBottomSlot`、`toBottom`，不重新绘制按钮 |
| 同目录 `use-scroll-follow.ts` | [滚动绑定](../../src/use-remote-scroll-follow.mjs)直接使用原 `useScrollFollow`、`scrollMetrics`；控制器绑定原 WeakMap 所有者 |
| 同目录 `use-chat-reading.ts` / `use-chat-scroll.ts` | 核对阈值和返回行为：25px 容差，返回时取消待处理输入折叠并立即回到物理底部，恢复跟随 |
| `packages/client/ui-chat/src/client/locale.ts` | 直接使用原中英文 `chat.toBottom` 字典，语言随手机设置 |
| `@deepseek-ai/dsh-client-ui-primitives` | 直接使用原 `IconChevronDownOutlineRegular` |
| `ui-theme/src/styles/gradient-shadow-text.css` | 原主题浮动控件阴影，生产入口原已导入；测试入口补齐相同依赖 |

保留原 34×34 CSS px 按钮、34px 圆形、原 SVG、浮动背景和阴影、距框底 16px。右边距继续由原 CSS 计算，手机提供与原移动布局一致的 `--dsh-composer-side-clearance: 8px`。没有另外添加动画；原返回按钮默认立即定位，不能把“平滑滚动”当作忠实移植的要求。

## 必要的手机接线与边界

比较过整套 `ChatView/useChatScroll` 替换与复用原按钮/控制器两条路径。前者同时引入原回合轨道、历史导航、折叠和测量系统，会改动本次要求保持的 .11 连续阅读与现有虚拟列表；本轮采用后者。宿主仍负责 React 状态通知、滚动元素绑定、ResizeObserver、虚拟组测量完成后的跟底，以及现有历史定位。它不是完整原 ChatView：未迁移原 ChatReading 的延时采样调度和回合导航系统。

[RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx)的主聊天和旁栏共用该接线。原 `ScrollFollow.active` 是唯一跟随意图；历史加载和虚拟列表通过引用读写同一控制器。虚拟列表自身高度补偿通过原 `jump()` 登记并保留意图，防止把程序定位误判成读者上滑。仅跟随时关闭原生滚动锚定，避免尾部动态高度与虚拟补偿竞争。

按钮包在默认正文框内；`conversation.session` 或局部 `Views` 取代正文时一起卸载，不覆盖第三方自有视图。恢复默认正文后重新绑定原滚动所有者；临时隐藏正文仍保留宿主阅读位置。更换整个 factory 可以重建其正文，这是既有生命周期，不承诺保存第三方组件仅有的 Hook 状态。会话引用、输入区、审批、公共服务和插件 factory 合同未替换；旧版没有 `cancelInput` 时跳过该可选动画接口。

该复用依赖当前支持版本的内部源码，不等于所有未来 DSH UI 插件都自动兼容。插件仍须通过已有公开插槽/服务；自行查询桌面私有 DOM 的扩展不在此承诺内。

## 验证与限制

[真实页面回归](../../scripts/check-remote-scroll-bottom.mjs)由 [preview.15 历史载体](../../scripts/verify-preview15-history.mjs)执行，点击真实首页进入官方 Session；协议为隔离合成数据，不冒充真实模型或电脑连接。

| 检查 | 结果 |
| --- | --- |
| rc.2、alpha.2 主聊天及旁栏 | 上滑出现、原控制器所有者、尺寸/阴影/位置、点击回实际尾部、连续输出跟随、阅读不受新输出打断通过 |
| 窄屏与输入区变化 | 390/320px 宽度、620/740px 高度、输入草稿保持、减少动态效果通过 |
| 插件入口与生命周期 | 主 `conversation.session` 与旁栏局部 `Views` 替换不叠加按钮；恢复可用；原 Session 引用、草稿不重建，回底不额外读取历史通过；返回真实列表后原所有者释放，再次点击进入重新绑定并跟到底部 |
| 语言 | 手机 LocaleProvider 切换原中英字典通过；仅改 Cordis locale 不代表手机语言已经改变 |
| 连续历史 | rc.2 主/旁栏各24批，保留1540事件，前插锚点误差0px；rc.2/alpha.2终页移除加载按钮后误差0px；失败重试和实时追加通过 |
| Node / Web | 577项通过；官方rc.2页面构建通过 |
| Android / MuMu | release与lint通过；原包名/证书code25覆盖安装，原配对成功连接；实际项目列表进入已有50轮复杂长聊天，上滑出现、点击回最后一轮并隐藏、输入区展开后按钮上移且可回底通过；未发送消息、操作审批或更改手机/电脑配置 |

命令：`node scripts/verify-preview15-history.mjs --scroll-bottom`，分别增加 `--alpha2`、`--aside-history`；连续历史不加专项参数，终页增加 `--terminal`。原版即时定位在减少动态效果设置下仍然即时。浏览器测试中的图形尺寸以 CSS px 记录，不能拿模拟器截图物理像素直接比较。

首次 alpha.2 按钮测试发现 `cancelInput` 不是函数，已通过可选接口接线修复并重跑通过；另一次测试临时端口被 Edge 判为 `ERR_UNSAFE_PORT`，重跑完成，不计作产品错误。Gradle 首次启动遇到本机 UDP 端口绑定冲突，不修改构建配置或结束其他程序。

MuMu使用Android12/WebView110；本地原签名包 `artifacts/DSHM-preview15-scroll-bottom.apk`，SHA256 `5de4c04069ee570e590d9fc7b50a39f0e856faf8ae6a7a85f82fc847e70a1df8`。实际截图 `artifacts/scroll-bottom-mumu-reading.png`、`scroll-bottom-mumu-returned.png`：按钮约66物理像素，与34 CSS px一致；点击前后尾部画面一致且按钮隐藏。未改变已安装首页插件的启停状态；本轮未实际触发新模型输出，实时增长与插件替换的结果来自上述隔离页面回归。
