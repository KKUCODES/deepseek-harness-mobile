# Remote 正文 Markdown 图片

- 状态：preview.22本地候选，未推送、未发行。维护：手机端维护者；核验：2026-11-20。完整接入与设备边界见[preview.22验收](./preview22-pr1-current.md)。
- 本轮只改 `app` 仓库；DSH、电脑插件与中转未修改。

## 问题与原因

模型在回复正文里用 `![说明](路径)` 引用本地图片时，电脑端能显示，App 端只显示替代文字。

电脑端聊天客户端构造 `fileImages`（`resolve` 把相对路径按会话 `cwd` 补全，再转成 `…/api/file?path=…`），原 `MarkdownText` 通过该能力加载正文图片；相对路径也由聊天文件提及解析。

App 端 [ChatMarkdown](../../src/ui/ChatMarkdown.jsx) 只提供 `openExternalLink` / `openFile`，从未提供 `fileImages` 或 `pathImages`。编译后的原图片节点在拿不到图片能力时只渲染替代文本，不发起任何读取。Remote 页面也没有到电脑文件服务的 URL 通道，且 CSP `img-src 'self' data: blob:` 不允许外链图片。

本机 142 个会话中，assistant 消息内的图片附件块为 0，正文 Markdown 图片 96 处，说明模型实际发送图片的方式就是正文 Markdown。

## 实现

[RemoteMarkdownImages](../../src/remote-markdown-images.mjs) 按会话缓存正文图片：

1. [ChatMarkdown](../../src/ui/ChatMarkdown.jsx) 在正文结束流式后扫描图片目标并预取；直接使用原 `parseGfmWithMath` 和 `parseFileLink`，覆盖空格路径、Windows反斜杠及编码字符，解码只进行一次。原 `MarkdownText` 只在非流式分支解析图片。
2. 相对路径按会话 `cwd` 补全，绝对路径原样提交；只接受常见图片扩展名，`http(s)`、`data:` 等非本地目标不处理。
3. 字节仍走现有 `model.files` 会话文件授权读取，成功后才发布 `blob:` URL；原 CSP 已允许 `blob:`，未放宽网络来源。
4. 缓存变化时重建 `fileImages` 身份，原图片节点经 React context 重新渲染并显示图片。
5. 读取失败或超出预算时返回固定失败目标，原组件显示“图片加载失败”与替代文字；临时错误可由正文下的按钮重试，恢复连接/世代变化时也受控重试。格式、超限和权限拒绝不自动重读，普通重画不重复请求，离线读取等恢复后才开始。
6. 单张上限 16 MiB、总量预算 64 MiB、最多 2 个并发读取；会话切换、连接生命周期结束或组件卸载时撤销全部 URL。

[RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx) 按当前会话创建并释放该缓存，主聊天与旁栏共用。

## 原图预览缩放

[RemoteImageZoom](../../src/remote-image-zoom.mjs) 在 [RemoteImages](../../src/ui/RemoteImages.jsx) 挂载时接入原图库预览：双指捏合 1–5 倍、双击切换、放大后单指拖动，网页端支持滚轮与双击。缩放通过调整图片布局尺寸让 WebView 按新尺寸重新栅格化，而不是拉伸已渲染的位图；只识别“单图 + 遮罩 + 关闭按钮”的预览层，文档预览等界面不受影响。会话切换或组件卸载时释放，系统返回仍由原 Escape 合同关闭。

## 边界

- 只支持本地文件路径；外链图片保持现状（CSP 禁止），未新增网络权限。
- 工作区外绝对路径交由电脑端按现有会话文件授权判断，拒绝时显示失败占位。
- 流式输出期间原 DSH 渲染器本身不渲染图片，消息结束后才出现，App 沿用该行为。
- 普通聊天（无会话文件授权）不传图片能力，行为不变。
- 图片上限与现有附件预览一致；不做跨会话缓存。

## 回归

- [remote-markdown-images.test.mjs](../../tests/remote-markdown-images.test.mjs) 10 项：原语法目标提取（含引用式图片、代码块忽略）、本地/外链过滤、路径解码、去重、临时错误重试、离线/重连、预算、并发上限、释放后 URL 与订阅失效。
- 新增 [remote-image-zoom.test.mjs](../../tests/remote-image-zoom.test.mjs) 4 项：缩放倍数限制、围绕指针缩放的锚点、平移边界、双指距离与中点。
- 当前rc.3单测通过（10/10、4/4）；全量616项Node、Web/Android构建与lint通过。主聊天/旁栏实际Markdown入口、原预览放大/系统返回、显式及重连重试均通过浏览器与MuMu RemoteActivity受控回放；[回归入口](../../scripts/check-remote-markdown-images.mjs)。这不是用户远程电脑的真实文件读取验收，真实连接与安装数据保留另见preview.22专题。
