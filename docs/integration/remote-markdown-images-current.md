# Remote 正文 Markdown 图片

- 状态：本地实现，未推送、未发行。维护：手机端维护者；核验：2026-11-20。
- 本轮只改 `app` 仓库；DSH、电脑插件与中转未修改。

## 问题与原因

模型在回复正文里用 `![说明](路径)` 引用本地图片时，电脑端能显示，App 端只显示替代文字。

电脑端聊天客户端构造 `fileImages`（`resolve` 把相对路径按会话 `cwd` 补全，再转成 `…/api/file?path=…`），原 `MarkdownText` 通过该能力加载正文图片；相对路径也由聊天文件提及解析。

App 端 [ChatMarkdown](../../src/ui/ChatMarkdown.jsx) 只提供 `openExternalLink` / `openFile`，从未提供 `fileImages` 或 `pathImages`。编译后的原图片节点在拿不到图片能力时只渲染替代文本，不发起任何读取。Remote 页面也没有到电脑文件服务的 URL 通道，且 CSP `img-src 'self' data: blob:` 不允许外链图片。

本机 142 个会话中，assistant 消息内的图片附件块为 0，正文 Markdown 图片 96 处，说明模型实际发送图片的方式就是正文 Markdown。

## 实现

[RemoteMarkdownImages](../../src/remote-markdown-images.mjs) 按会话缓存正文图片：

1. [ChatMarkdown](../../src/ui/ChatMarkdown.jsx) 在正文结束流式后扫描图片目标并预取；原 `MarkdownText` 只在非流式分支解析图片。
2. 相对路径按会话 `cwd` 补全，绝对路径原样提交；只接受常见图片扩展名，`http(s)`、`data:` 等非本地目标不处理。
3. 字节仍走现有 `model.files` 会话文件授权读取，成功后才发布 `blob:` URL；原 CSP 已允许 `blob:`，未放宽网络来源。
4. 缓存变化时重建 `fileImages` 身份，原图片节点经 React context 重新渲染并显示图片。
5. 顶层独立图片段落读取失败时，[ChatMarkdown](../../src/ui/ChatMarkdown.jsx) 用手机端失败块替换该段：红色“图片加载失败”、重新加载、可折叠的失败原因；行内图片、表格和列表里的失败仍走原组件替代文字。失败原因分读取失败、超过大小上限、缓存已满、解码失败、工作区未知，只有读取失败和缓存已满显示重试；正文里的浏览器解码失败按 blob URL 回查缓存后转成解码原因。
6. 单张上限 16 MiB、总量预算 64 MiB、最多 2 个并发读取；会话切换、连接生命周期结束或组件卸载时撤销全部 URL。

[RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx) 按当前会话创建并释放该缓存，主聊天与旁栏共用。

## 失败态与重试

[RemoteImageFailure](../../src/ui/RemoteImageFailure.jsx) 与 [RemoteAttachmentFailure](../../src/ui/RemoteAttachmentFailure.jsx) 共用 [失败原因目录](../../src/remote-image-failure.mjs)：读取失败、超过大小上限、缓存已满、解码失败、工作区未知；前两者可重试，后三者只显示原因。正文展开区给一句原因、图片路径和错误码；重试按目标重新读取，期间按钮显示“重新加载中…”并禁用，成功后就地换回图片。

消息附件保留原画廊的缩略图、原图预览和拖拽，失败分支换成 [RemoteMessageImage](../../src/ui/RemoteMessageImage.jsx)：多图为 64px 失败格（上行打开原因小卡，下行直接重试），单图为 240px 失败卡（卡内重试和查看原因）。小卡用底部弹层显示原因、附件名和错误码；不可重试时只留关闭；文件预览的图片读取失败用同一块的面板形态。

失败图片段落由手机端按顶层独立段落切分，其余 Markdown 仍由原组件解析；附件失败在手机端保存原始错误，再按错误码归类。

## 原图预览缩放

[RemoteImageZoom](../../src/remote-image-zoom.mjs) 在 [RemoteImages](../../src/ui/RemoteImages.jsx) 挂载时接入原图库预览：双指捏合 1–5 倍、双击切换、放大后单指拖动，网页端支持滚轮与双击。缩放通过调整图片布局尺寸让 WebView 按新尺寸重新栅格化，而不是拉伸已渲染的位图；只识别“单图 + 遮罩 + 关闭按钮”的预览层，文档预览等界面不受影响。会话切换或组件卸载时释放，系统返回仍由原 Escape 合同关闭。

## 边界

- 只支持本地文件路径；外链图片保持现状（CSP 禁止），未新增网络权限。
- 正文失败块只替换顶层独立图片段落；行内图片、表格和列表里的失败保持原替代文字，引用式定义被切到另一段时不保证解析。
- 工作区外绝对路径交由电脑端按现有会话文件授权判断，拒绝时显示失败占位。
- 流式输出期间原 DSH 渲染器本身不渲染图片，消息结束后才出现，App 沿用该行为。
- 普通聊天（无会话文件授权）不传图片能力，行为不变。
- 图片上限与现有附件预览一致；不做跨会话缓存。

## 回归

- 新增 [remote-markdown-images.test.mjs](../../tests/remote-markdown-images.test.mjs) 18 项：目标提取（含引用式图片、代码块忽略）、本地/外链过滤、去重、失败原因归类、工作区未知、重试、解码失败、失败段落切分、预算、并发上限、释放后 URL 与订阅失效。
- 新增 [remote-image-failure.test.mjs](../../tests/remote-image-failure.test.mjs) 4 项：五类原因目录、未知原因回退、读取错误归类、文件预览失败对象。
- 新增 [remote-image-zoom.test.mjs](../../tests/remote-image-zoom.test.mjs) 4 项：缩放倍数限制、围绕指针缩放的锚点、平移边界、双指距离与中点。
- 单测在隔离依赖环境实际执行通过（18/18、4/4、4/4）；`ChatMarkdown.jsx`、`RemoteMessageImage.jsx`、`RemoteAttachmentFailure.jsx`、`RemoteImageFailure.jsx`、`RemoteFilePreview.jsx` 经 esbuild JSX 转换通过。
- 已用 rc3 CI Web 构建通过并核对新失败组件进入 `remote-main.js`；未构建调试 APK，也未做 MuMu 自动化回归，安装与真机验证由用户执行。
