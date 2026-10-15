# Remote 内置面板的统一尺寸

- 状态：代码、浏览器与独立 MuMu 验证通过，正常本地 APK 已覆盖安装；未提交或发布。
- 维护角色：DSHM 手机端维护者。
- 最近核验：2026-10-15。
- 任务：[KKC-56](https://linear.app/kkcodes/issue/KKC-56)，接续[文件和目录排版](./file-preview-layout-current.md)。
- 来源：[尺寸契约](../../src/remote-panel-layout.mjs)、[官方插槽适配](../../src/remote-plugin-slots.jsx)、[共用内置面板](../../src/ui/NativePanelFrame.jsx)、[全局页面外壳](../../src/remote-global-panels.jsx)、[手机样式](../../src/ui/remote-product.css)、[表单样式](../../src/ui/ordinary-product.css)。

## 统一规则与边界

已支持的内置阅读面板使用手机的实际宽度，占满标题、标签和操作栏之外的空间，由正文区域滚动。辅助说明和控件最低 13px；文本、源码、Markdown 代码及改动正文 14px；保留更大的原标题。图片、PDF 与 Office 转换后的文档继续使用自己的缩放与滚动，不把 PDF 文本层或图片尺寸当作应用字号问题。

侧栏和全局页面的尺寸选择集中在 `remote-panel-layout.mjs`。识别下发组件时必须同时匹配插槽、条目与官方注册域；不能按 `@deepseek-ai` 前缀或整个槽放开。目录、计划、任务和插件管理使用同一 `NativePanelFrame`，设置页面使用其自然高度模式。局部文字最低字号由这个边界统一兜底，保留大字号；嵌套面板只维护自己的标记，跳过第三方 `data-plugin-frame` 子树。

比较过两条路线：全局关闭插件缩放成本低，但会覆盖第三方作者声明和用户开关；集中维护官方面板尺寸契约则能保留第三方行为，本次采用后者。没有修改 DSH、SDK 或第三方插件源码。第三方同槽替换、720px 原宽、用户关闭自适应、局部滚动与卸载回退继续验收。

单行 `input/select.sheet-editor` 统一为 44px，不再继承多行文本框的 90px 最小高度；`textarea` 保留多行空间。该规则属于手机自己的公共表单样式，也覆盖普通聊天中的同类自有控件。

## 面板清单与验收矩阵

| 范围 | 本次检查与结果 |
| --- | --- |
| 打开面板/引导 | 原组件，完整高度、说明 13px、长清单局部滚动；浏览器与 MuMu |
| 工作区文件 | 沿用上轮目录修正；共享容器、展开、打开正文、滚动与第三方替换回归 |
| 纯文本、源码、Markdown | 本文/路径/代码块说明，长内容局部滚动、换行；浏览器与真实文件入口 |
| 图片、PDF、Office、HTML | 外壳和正文可用高度、缩放控件 13px，保留原媒体缩放；实际文件入口 |
| 历史改动预览 | 原 ReviewTab，统一/分栏正文 14px、路径与计数 13px；实际侧栏控制器的浏览器回放 |
| 计划预览 | 长 Markdown 和代码块不再撑成约 9980px 宽，完整正文高度；浏览器与 MuMu 原下发组件。Android 使用临时计划导航，不伪称新模型推送 |
| 官方任务详情/任务全局页 | 回放复现详情约 9px、滚动高约 48px，全局列表约 11px、滚动高 3px；修后原比例、最小 13px、高约 475/607px。当前实际模块因缺少 `workspaces` 服务等待，未在 MuMu 将其伪装成已启用；手机现有“定时任务”列表另行实测 |
| 插件全局页/管理电脑插件 | 两个实际入口，共享原管理组件和完整高度；状态标签由 10px 提升至 13px，保留原大标题与操作 |
| 电脑设置 | 通用、模型、Agent 预设三个实际分页；内置行不再二次缩放，嵌套说明 13px，单行下拉 44px |
| 插件设置 | 手机自有配置入口的说明和表单，第三方分页仍保留原自适应 |
| 子会话 | 保留已适配的嵌入聊天高度与自身滚动；完整页面回归覆盖原入口/输入/草稿与切回 |
| 文件/命令/任务输出的后备窗口 | 自有预览 pre 和后备历史差异正文统一 14px、路径 13px；原全屏与滚动机制保持，未重新发送模型或执行命令 |
| 电脑网页/交互终端 | 先前已取消的能力，仍不可用；不为排版检查重新启用 |

## 证据与限制

[浏览器专项](../../scripts/check-builtin-panel-layout.mjs)经真实 RemoteWorkspace、原插件注册和控制器验证 7 类面板 × 4 种宽度 × 两主题，共 56 组；另检查任务加载/失败/空状态、第三方同槽全局页的自适应开关与回退，以及嵌套字号兜底、保留 22px 标题、动态切换到 20px 和不改第三方 10px 文字。协议数据为显式隔离回放，不能当成真实 Host 或 Android。

命令：`node scripts/verify-remote-plugin-slots.mjs --builtin-panels --official-alpha2`。证据 `artifacts/builtin-panel-layout/before.json`、`after.json`、`builtin-panel-layout-web.json`。初始回放忘记协商 DSH 版本时，ReviewTab 缺少新版子槽导致渲染失败；补齐夹具真实版本后通过，不修改生产 ReviewTab 接口。第三方初次检查沿用了 760px 视口，也已纠正为 375px；不是产品缩放故障。

[Android 专项](../../scripts/check-builtin-panel-android.mjs)使用[隔离驱动](../../scripts/verify-remote-motion-android.mjs)，官方 DSH 0.2.1-alpha.2、发布插件 0.1.84-latest.0、生产网关实现和独立 MuMu UID。自己的临时工作区/文件/绑定/管理授权，只读取和导航，不读取 Key、不发送模型消息、不修改电脑配置。真实图片/PDF/Office 的文本层不参与控件字号断言；另核对其正文可用高度。公共服务及正常 App 数据不清空。

早期 Android 报告保留为排查证据：`87a6d564…` 识别到官方任务页尚未启用；`c27f937d…` 找到设置缩放遗漏；`9a6e7532…` 找到嵌套字号标记互相清除和多行控件高度复用，驱动还漏关底层“电脑插件”窗口；`20b4992d…` 的常用页面两主题通过；`beaacf6d…` 完成额外真实文件检查并发现媒体缩放百分比 12px。失败不计作最终通过，所有这些专用授权、绑定、转发和 Host 均已清理。

最终 Android 报告 `artifacts/builtin-panel-layout-android/28d03406-40a4-4770-abe5-757439cb2c51/report.json`：16 个实际视图 × 两主题共32项，控件/辅助文字最低13px，无应用层重复缩放，横向页面无溢出，原草稿保留。真实 TypeScript、PNG、PDF、HTML、DOCX 转换和文件不存在状态通过，正文宽420px、高584px；PDF文本层不参与应用字号判断，媒体原缩放保持。设置页面下拉高度44px，允许0.5px内设备小数误差。源码、图片、文档均为自己创建或复制的既有测试素材。

未启用的官方任务页面明确记录为缺少 `workspaces`，没有为通过检查临时提供服务；手机原有定时任务入口通过。计划页只验证原组件临时导航，历史改动在浏览器原控制器回放通过；本轮没有新模型请求、任务执行、审批提交或另一版官方 Host 的 Android 重测。

专用设备已撤销、自己的绑定移除、反向端口删除、Host/网关/数据库关闭，错误和清理错误数组均为空。被保留的独立APK为 `artifacts/releases/DSHM-2026-10-15-builtin-panels-isolated.apk`，SHA-256 `96e0c2b8c5538b7133cd230dbb1a1b221340c46a96c740eefa45c1d236f66165`。此前 `fdbd8b74…` 仅因44.0000038px与44px的严格比较失败，已修正驱动容差，不是产品高度故障。

最终 Web、独立与正常 Android 构建和 lint 通过；495项 Node、完整页面回归、正文与目录专项、文档与 diff 检查通过。浏览器完整回归是旧基线，56组专项是官方 alpha.2 的真实源码/SDK组合；本轮没有据此扩大公开兼容范围。

正常候选 `artifacts/releases/DSHM-2026-10-15-builtin-panels.apk`，12,711,001字节，SHA-256 `b8af36789462390a516695e02dabe908833a6fe5ab64084a6570bb8a2c37aff0`。168份Web资源逐字节一致；`.officialtest`已覆盖安装，设备上SHA相同、Activity正常启动，没有清空原聊天或绑定；独立测试UID已卸载、ADB转发清单为空。记录为 `artifacts/builtin-panel-layout-apk.json`、`builtin-panel-layout-installed.json`。正常包与独立测试包分别记录，未把二者当成同一个二进制；公开Release仍保持原状态。
