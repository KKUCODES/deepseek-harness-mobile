# DSH 原版与手机适配对照

- 状态：原版观察已核验；适配方案待用户审阅，尚未实现正式 UI。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-09-23。
- 依据：用户明确要求 DSHM 继承 DSH 页面风格与布局，并指定内置浏览器 375 × 667；实际查看 `http://127.0.0.1:3080/` 的空白会话、已有会话、展开/收起侧栏、插件列表、右侧工具面板。
- 源码参考：只读上游 `ddefc45fbc7f8e46dd73185e68295696d1297887`。运行实例显示 `0.1.6-alpha.2-ddefc45-dirty`，不能据此认为运行实例与只读参考逐字相同。
- 关联：[页面地图](./页面地图与核心流程.md)、[追问结论](./问卷结论与追问.md)、[KKC-9](https://linear.app/kkcodes/issue/KKC-9)。

## 设计基线

以真实 DSH 在 375 × 667 下的页面为起点。保留原版字体、颜色、图标、气泡、按钮、输入框、列表和工具内容，只针对手机空间、触控、双模式入口及已确认的功能差异进行适配。页面地图表达功能归属，不代表重新设计整套视觉。

此前“侧栏变抽屉、工具变底部窗口”的方向需要基于已有响应式能力实现，不能先假定 DSH 完全没有窄屏适配，再造一套布局。

## 已观察到的原版行为与适配建议

| 区域 | 375 × 667 实际表现 | DSHM 建议 |
| --- | --- | --- |
| 空白聊天 | 鲸鱼标识、欢迎语、工作区/模式选择、输入框组成居中的区域 | 保留视觉与相对关系；普通聊天移除工作区和 Agent 控件；Remote 按用户要求显示居中的“在项目中工作”，每次选择已有工作区 |
| 左侧导航 | 收起后仍保留约 56px 图标栏；展开后占据主要宽度并挤压正文，长文字出现逐字换行 | 改为覆盖式抽屉，关闭时不常驻图标栏；复用原侧栏样式与分组，在其中增加 Remote 入口 |
| 聊天内容 | 用户淡色右侧气泡、助手无气泡正文、思考折叠、消息操作仍可用 | 优先复用消息组件；保留复制/重新生成/分支的直接入口，扩大触控区域，调整边距 |
| 顶栏 | 会话标题、模式、打开目录、更多、右栏入口挤在一行，标题截短 | 保留标题及主操作；手机无对应能力的“本地文件管理器打开”不照搬，低频操作收进菜单 |
| 输入框 | 原圆角输入卡仍能排布；模型等操作在窄屏下缩为图标，部分统计截断 | 保留输入卡与工具插槽；确保模型选择可辨认、按钮易点；统计可折叠，不新增手机终端输入 |
| 右侧工具 | 打开后覆盖全屏，存在“退出全屏”和“收起右侧边栏” | 保留原工具内容和已有全屏能力；按已确认要求补充代码/只读命令的底部窗口及放大切换，无需重做工具页面 |
| 插件列表 | 已能纵向排列，长名称和说明截断，开关保持在右边 | 保留列表样式；手机/电脑归属显式区分，详情可查看完整名称与说明 |

以上是布局建议，不能视为用户已经确认了每个按钮的位置。

## 对应源码入口

| 职责 | 参考文件 | 复用边界 |
| --- | --- | --- |
| 三栏与窄屏布局 | [AppFrame](../../../deepseek-harness/packages/client/ui-layout/src/client/AppFrame.tsx)、[布局状态](../../../deepseek-harness/packages/client/ui-layout/src/client/stores.ts) | 已有窄屏自动折叠与右栏全屏状态；手机抽屉应在布局边界适配，保留 Slots 和服务作用域 |
| 侧栏 | [SidebarRoot 样式](../../../deepseek-harness/packages/client/ui-sidebar/src/client/SidebarRoot.module.css) | 保留导航视觉，修改手机容器占位方式 |
| 主题与字体 | [design-platform](../../../deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css)、[base](../../../deepseek-harness/packages/client/ui-theme/src/styles/base.css) | 直接沿用主题变量与字体栈，不另建视觉规范 |
| 消息气泡 | [MessageItem 样式](../../../deepseek-harness/packages/client/ui-chat/src/client/chat/MessageItem.module.css) | 沿用气泡、文本和消息动作关系，适配可用宽度 |
| 输入卡 | [InputBar 样式](../../../deepseek-harness/packages/client/ui-conversation/src/client/skeleton/InputBar.module.css) | 沿用输入框与插槽，按模式提供能力 |
| 按钮与工具内容 | [Button](../../../deepseek-harness/packages/client/ui-primitives/src/Button.tsx)、[DiffBlock](../../../deepseek-harness/packages/client/ui-primitives/src/DiffBlock.tsx)、[TerminalBlock](../../../deepseek-harness/packages/client/ui-primitives/src/TerminalBlock.tsx) | 优先直接复用；语法高亮、最新完整文件下载等仍需核验和补齐，不因已有差异组件就声称已满足 |

## 本地观察证据与限制

截图保存在手机项目 `artifacts/design-reference/`，属于不提交的本地观察产物：

- `dsh-chat-375x667.png`：收起侧栏的真实聊天。
- `dsh-expanded-sidebar-375x667.png`：展开侧栏挤压正文。
- `dsh-plugins-375x667.png`：原版插件列表。
- `dsh-tools-375x667.png`：右侧工具全屏。

DOM 核验得到 `innerWidth/clientWidth = 375`、`innerHeight/clientHeight = 667`，页面声明 `width=device-width, initial-scale=1`。这是内置浏览器尺寸观察，未验证 Android 软键盘、安全区、触摸手势、性能或后台行为；未发送模型消息、执行命令、批准设备或修改插件开关。空白会话仅查看输入界面，未发送或保存内容。

## 下一步交付

先做原版页面上的最小手机适配预览：关闭时无占位的侧边抽屉、精简顶栏、普通聊天与 Remote 入口，以及原工具面板的底部/全屏切换。用同一 375 × 667 尺寸与本次截图对照审阅。未覆盖的异常状态继续依据页面地图补齐，不把这次尺寸观察当作全部页面设计完成。
