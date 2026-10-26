# Remote 的 Figma 实现

维护：DSHM 手机端维护者；核对日期：2026-10-24；任务：[KKC-94](https://linear.app/kkcodes/issue/KKC-94)。本次为基于 preview.13/main 的本地改动，未提交、未发布，也未合入手机 npm 插件适配分支。

## 设计与复用边界

采用已有 React、CSS 和原模态层实现 [Figma](https://www.figma.com/design/4O2ww8JdFAYnZRLVo7on83/DSHM?node-id=21-1399) 的配对、等待、读取与首页。保留电脑端真实批准、会话模型、缓存和插件作用域，没有引入桌面网页或修改 DSH 本体。

配对/读取页面采用作用域内的共享组件。2026-10-25 经只读审查确认，原首页祖先设计类曾覆盖插件设置焦点，固定颜色也改变了主题继承，不能描述为完全无覆盖。新版首页现已转为[独立界面插件](./mobile-interface-current.md)，不再由工作区祖先设计类控制；配对、批准与读取逻辑仍由宿主维护。该调整的验收边界以新专题为准。

| 层级 | 位置 | 职责 |
| --- | --- | --- |
| 规范 | [system.css](../../src/ui/system/system.css) | 明暗色、字体层级、间距、圆角、阴影、控件状态、减少动态效果 |
| 通用组件 | [Primitives](../../src/ui/system/Primitives.jsx)、[Icons](../../src/ui/system/Icons.jsx)、[LoadingToast](../../src/ui/system/LoadingToast.jsx) | 按钮、输入、顶栏、操作卡、列表、状态、骨架、空态、提示、模态与浮层 |
| 页面 | [RemoteConnectionPage](../../src/ui/RemoteConnectionPage.jsx)、[RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx) | 配对表单、电脑状态、读取反馈及真实项目/聊天列表 |
| 操作生命周期 | [RemoteApp](../../src/RemoteApp.jsx) | 配对、批准状态检查、连接、装配、取消、恢复与更新入口 |

插画和图标来源见[资源清单](../../src/ui/assets/remote/README.md)。原设计字体在缺失时使用系统无衬线字体，不承诺所有平台字形像素相同。布局在窄屏换行或滚动，不缩小文字；44px 操作槽保持顶栏标题居中。

## 状态与操作

- 扫码为主操作，图片识别和配对链接为备选；设备名仍可直接编辑。领取失败保留链接供修正重试，成功后清除表单中的一次性链接。
- 等待批准时串行检查只读 `binding.status`，正常每两秒一次。隐藏页面暂停检查；取消、解绑、卸载或权限失效会使旧回调失效。不会自动批准或重放领取请求。检查失败展示具体错误并允许重新检查。
- 批准后自动连接；原连接真实就绪才显示“已连接”和读取骨架。数据已准备好时直接进入 Remote，没有额外“进入”按钮或固定延迟。
- 会话读取失败可“重试读取”，沿现有 socket 重建手机运行环境，保留配对。版本/能力拒绝和断线沿既有错误与恢复规则处理，不伪装成普通读取失败。
- 首页的项目、会话、搜索、新建和返回仍使用原模型。历史、审批、消息发送、草稿、第三方界面和插件面板仍走原入口。
- LoadingToast 默认无蒙层且不拦截页面，发起操作独立禁用。加载由操作结束驱动，不按固定时长消失；成功短暂显示后收起。遮罩与操作拦截分别配置，拦截模式必须提供可取消出口，复用原 Surface 的模态层和键盘关闭逻辑。

## 原生粘贴边界

新增 `binding.paste`，只允许未配对、前台聚焦的 Remote 自有主页面、空参数、无 HTML 预览时调用。[RemotePairClipboard](../../android/app/src/main/java/dev/dshmobile/validation/RemotePairClipboard.kt) 仅接受一项、最多4096字符的文本，经已有 `RemotePairLink` 校验后返回规范链接；不读取 URI 内容，不返回无关剪贴板文本。不包含通用剪贴板读取能力。

旧 APK 不认识此操作时，页面提示长按输入框使用系统粘贴，扫码、手动输入和既有配对保持。当前原生改动需要新 APK；单独投放页面资源无法为旧 APK 增加这项能力。HTTP 未加密提醒保留，没有把视觉上的连接状态当作加密保证。

## 验收矩阵

### 后续 MuMu 安装（2026-10-24）

用户追加授权安装并卸载其他版本。已在 MuMu Android12（`emulator-5554`）用原应用ID `dev.dshmobile.validation.officialtest`、原证书覆盖 preview.12，安装本地 `0.1.0-preview.13-remote-ui` / code16。没有卸载正式主包或清除数据，没有读取 Key 或配对凭据。安装后 APK SHA256 与本地签名包一致，四个遗留的 DSHM instrumentation 包已卸载，最终只保留一个 DSHM。

已从普通聊天抽屉进入 Remote，实机截图确认新版配对页、图标、操作卡、设备名和底部按钮可见。此处为 MuMu 模拟器验证，不是真机或真实电脑配对验收；后者仍待完成。原生粘贴只观察到无有效材料时的提示，未写入测试配对材料。安装报告、旧 APK 备份与截图保存在忽略目录 `artifacts/remote-design-install/`。未提交、推送或发布。

| 入口 | 验证 | 边界 |
| --- | --- | --- |
| 正式 RemoteApp 表单 | 扫码调用、图片失败、粘贴反馈、过期链接保留、等待批准、自动进入、取消后迟到回调 | [页面回归](../../scripts/verify-remote-design.mjs)使用隔离桥/模型，不代表真实认证和网络验收 |
| 正式 RemoteApp 读取与恢复 | 已连通后读取失败重试不重连 socket；装配失败、撤销、重建、提醒导航 | [恢复回归](../../scripts/verify-remote-app-recovery.mjs)19条场景通过 |
| 正式 RemoteWorkspace 首页 | 项目/会话进入、搜索、新建工作区选择、明暗主题、390/320px | [首页回归](../../scripts/check-remote-home-design.mjs)沿原模型协议回放，未替换页面组件 |
| 会话真实进入路径 | 忙碌解除、连续系统返回、项目层级、自有弹窗、插件菜单/模态/面板/设置优先级、草稿 | `node scripts/verify-remote-plugin-slots.mjs --back-navigation`，rc.2通过 |
| 通用加载提示 | 四种遮罩/交互组合、Escape取消、长操作不自动关闭、减少动态效果 | 独立共享组件与正式表单同时回归，无真实写请求 |
| Node | 567项通过 | 沿已有测试，不代替 Android 运行验收 |
| Android | `assembleDebug`、`assembleDebugAndroidTest`、`lintDebug`通过 | 原生粘贴样例已编译，尚未在设备执行；未安装或操作用户 MuMu |

本机截图及报告在忽略目录 `artifacts/tests/remote-design/`，含配对、等待、读取、错误和首页的明暗/窄屏截图；资产审计通过。截图是实际 React 页面，不是 Figma 整页贴图。新 APK 的真机扫码/剪贴板/真实电脑批准仍需后续设备验收，不将隔离回放描述为线上验证。

项目集合的全量文档链接检查仍有历史缺失引用，主要指向独立插件适配分支和旧本机产物；本次没有补入那些分支文件。新增专题、索引和资源说明的相对链接单独核验。

验证命令均在手机仓库执行：

```powershell
node scripts/verify-remote-design.mjs
node scripts/verify-remote-plugin-slots.mjs --design-home
node scripts/verify-remote-plugin-slots.mjs --back-navigation
node scripts/verify-remote-app-recovery.mjs
node --test tests/*.test.mjs
node scripts/build-web.mjs --latest-candidate --official-candidate --official-rc21
```

Android 在 `android/` 使用 JDK17 和本机 Android SDK，以带引号的 Gradle 参数执行：

```powershell
.\gradlew.bat :app:assembleDebug :app:assembleDebugAndroidTest :app:lintDebug '-PlatestCompatibilityTest=true' '-PofficialPluginOnlyTest=true' '-PofficialDshVersion=0.2.1-rc.2'
```
