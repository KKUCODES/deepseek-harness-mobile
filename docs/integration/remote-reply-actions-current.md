# Remote 回复操作图标

状态：2026-10-15手机端维护者核验；任务 [KKC-58](https://linear.app/kkcodes/issue/KKC-58)。只修改DSHM，保留官方DSH、插件和中转服务。

## 原因与规则

DSHM用自有消息布局承接原会话投影。原 `turn-tail` 渲染器没有挂到该布局时，走 [RemoteMessage](../../src/ui/RemoteMessage.jsx) 的手机回退；这里仍使用早期“在新聊天中分支”文字按钮，且原反馈插槽与分支分别呈现。电脑DSH使用分支图标，因此出现截图中的差异。

本次复用官方分支图标与既有版本映射：旧版 `IconBranchOutline16` 在新版候选中由 [SDK选择器](../../scripts/latest-mobile-build.mjs)映射到官方 `IconBranchOutlineRegular`，不另画SVG、不改DSH源码。操作使用44×44px触摸区域，保留轮次可访问名称和提示标题。菜单中的文字入口保持。

[RemoteTurnExtensions](../../src/remote-plugin-slots.jsx)将官方反馈和分支放到共享操作行；功能型 `turnTail` 插槽仍在操作行之外。只对官方反馈的 `conversation.chat.assistant-actions` 外框启用 [MobilePluginFrame](../../src/ui/MobilePluginFrame.jsx) 的内容宽度模式，避免其默认100%宽度把分支推到右端。其他插件和插槽保持原等比缩放、作者声明与用户覆盖规则，未修改反馈插件内部。

比较过直接替换整套桌面回复操作栏和仅接入原图标两种路径。采用后者，并归并现有操作行，保留当前反馈作用域和分支调用链；复制、用量、时间等其他入口不混入本次显示修复。

分支仍调用原 `forkTurn` 和 [turnForkAnchor](../../src/remote-forks.mjs)，按已完成回复节点的原序号分支；本次不更改边界策略、会话创建或认证逻辑。

## 验收

| 范围 | 结果与依据 |
| --- | --- |
| 复现 | 正式页面原投影回放显示文字“在新聊天中分支”、SVG数量0；`artifacts/remote-fork-actions-before.json` |
| 主/embedded布局 | 新旧两代组件均使用官方图标，和反馈同一行；320/420px、深浅主题，44×44px、横向溢出0，反馈到分支间距4px |
| 操作 | 隔离传输记录键盘和触摸各一次原分支请求，`sessionId=two`、原最后助手节点`atSeq=5`；随后明确拒绝，不伪造成功，不创建真实聊天，草稿保持 |
| 禁用 | 正式页面离线时禁用；原不可分支条件沿用，纯函数测试继续覆盖关闭边界/后续节点等情况 |
| 完整回归 | 497项Node、完整Remote页面、Web构建、Android构建与lint通过 |
| MuMu真实入口 | 正常App读取已有 `Greeting (1)`，原12个投影节点、运行状态和空草稿哈希保持；分支从112×36px文字变为44×44px图标，与反馈居中且相邻；没有新消息或分支请求 |

专项：[浏览器检查](../../scripts/check-remote-fork-actions.mjs)、[原生只读检查](../../scripts/verify-fork-actions-android.mjs)。产物分别为 `artifacts/remote-fork-actions-alpha2.json`、`artifacts/remote-fork-actions-legacy.json`、`artifacts/remote-fork-android-after.json`，正常APK真实截图 `artifacts/remote-fork-android-after.png`。Android只读验证显示；点击和触摸行为由正式页面隔离回放检查，不冒充真实Host新建分支测试。

早期检查与纠正：直接用新版图标名触发已有图标别名白名单失败，改为复用现行兼容入口；回放第一次错把step/end的6当作助手消息锚点，按原投影核对为5，没有改生产边界。Android最初仍在首页，恢复到之前“你是谁”会话后发现其结尾是错误且没有可分支回复，随后只读选择已有完成会话；没有为验证发送新消息。第一版已把反馈与分支放入一行，但真实截图显示反馈外框全宽、分支靠右，因此补上外框内容宽度和水平间距断言。

## 当前候选

`artifacts/releases/DSHM-2026-10-15-fork-actions.apk`，13,487,047字节，SHA-256 `93ddc3a6fe871490c9d808ccdc310cd62453ab282534b7e6b14e3a6dbc8e45fe`。已由下方尺寸补验候选替换上一轮同名本地产物。

正常包 `dev.dshmobile.validation.officialtest` 已覆盖安装，168份Web资源与候选一致，设备已安装APK哈希相同。原数据和绑定保留，未重启DSH；本次没有提交、推送或更新公开Release。

## 三个操作的视觉尺寸补验

用户补充图标大小仍不一致后，重新打开KKC-58。上轮验收只量了分支按钮区域和同排位置，遗漏了反馈SVG15px、按钮28px与分支SVG20px、按钮44px的差异。

[宿主操作行样式](../../src/ui/remote-product.css)现在对这三个官方操作共用尺寸令牌：默认SVG20×20px、点击区44×44px、相邻间距4px，字号delta增加4px时三个SVG均为24px。仅匹配该操作行的分支及官方反馈框，不影响其他插件或反馈弹窗。

浏览器两代主/embedded、320/420px与深浅主题、字号放大及键盘/触摸/禁用/草稿检查通过；检查新增每个图标、每个按钮和全部相邻间距断言。最初严格`>=44`遇到变换后浮点误差，按0.1px容差修正，不放宽产品尺寸。MuMu正常包同一已有会话只读验证三个SVG20px、三个按钮44px和间距4px，原12节点及草稿哈希保持。

本次只改局部CSS，运行对应页面专项、Web和Android构建/lint、资源与设备哈希、文档检查；497项Node与完整页面是上一轮的通过记录，不描述为本次重跑。最终专项报告沿用 `artifacts/remote-fork-actions-alpha2.json` / `legacy.json` 和 `artifacts/remote-fork-android-after.json`，构建日志前缀 `remote-reply-icons`。没有发送真实消息或分支请求，未提交或发布。
