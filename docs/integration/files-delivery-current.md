# Remote 文件与只读输出验收

- 状态：R10–R12、R16 的首版本地契约按下列五项标准验收通过，对应 KKC-19 可关闭；完整 Remote 仍按[收尾表](./completion-audit.md)推进。
- 维护角色：项目协作 Agent；最近核验：2026-10-04。
- 来源：[已确认功能范围](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md)、[KKC-19](https://linear.app/kkcodes/issue/KKC-19)、下列实际报告、驱动断言与生产入口。localhost 网站转发已移出首版，HTML 文件预览继续保留。

## 五项验收标准与对应证据

| 标准 | 当前实现与实际证据 | 判断及范围 |
| --- | --- | --- |
| 上传、引用与最新完整文件 | [原会话文件读取](../../src/remote-files.mjs)保持 workspaceFileScopeId，首尾校验版本；[下载](../../src/remote-download.mjs)重新读取完整字节。[3,145,747字节下载](../../artifacts/remote-mobile-download-android.json)明确 latestNotPreview；[跨工作区真实引用](./workspace-reference-current.md)及[菜单引用](./reference-menu-current.md)核对原文件身份；[相册实际发送](../../artifacts/remote-mobile-image-input-android.json)与[模型拒绝](../../artifacts/remote-mobile-image-input-rejection-android.json)分别留证 | 支持按电脑模型实际能力发送，不因图片能预览便承诺模型能理解。历史附件下载原件、工作区文件下载当前版，两种来源不混淆。 |
| 支持格式预览 | [历史附件格式](../../artifacts/attachment-document-formats-android.json)、[工作区图片](../../artifacts/image-formats-android.json)、[PDF双页与真实Worker](../../artifacts/remote-mobile-pdf-android.json)、[HTML文件](../../artifacts/remote-mobile-html-android.json)/[HTML附件](../../artifacts/remote-mobile-html-attachment-android.json)、[Office工作区](../../artifacts/remote-mobile-office-android.json)/[Office附件](../../artifacts/remote-mobile-office-attachment-android.json)；[真实模型写入差异](../../artifacts/model-review-android.json) | 六种Office均有画布/文本证据，重型转换留电脑；HTML没有原生桥，父页面/存储/网络隔离。简单样例不保证任意复杂排版保真，实际支持格式及容量沿用现行限制。 |
| 删除、变化、失败与断线 | [历史差异与最新文件分离](../../artifacts/remote-mobile-changes-resume-android.json)、[快照失效](../../artifacts/remote-mobile-changes-expired-android.json)、[附件断线](../../artifacts/file-disconnect-attachment-android.json)/[工作区断线](../../artifacts/file-disconnect-workspace-android.json)均有清理、不交付、手动重试后摘要匹配；[当前66项回归](../../artifacts/files-delivery-current-tests.log)包括版本变化、取消后迟到字节、最终完整性失败、路径作用域和输出控制序列 | 两种来源恢复均重新读取，不把旧预览作为失败后的成功结果。隔离测试只证明所测契约，不替代真实设备断线报告。 |
| 命令详情与输出只读 | [原工具解析](../../src/remote-commands.mjs)、[真实前台命令](../../artifacts/foreground-command-run-android.json)、[中文结果](../../artifacts/command-encoding-live-observe.json)、[实际ANSI](../../artifacts/foreground-ansi-run-android.json)、[颜色跨段/截断](../../artifacts/output-ansi-boundary-run-android.json)、[详情与退出7](../../artifacts/remote-mobile-commands-resume-android.json) | 真实状态、目录、完整命令、时长、标准/错误输出、复制、全屏和历史有依据。旧报告color=null不是颜色通过；后续实际rgb(236,19,19)及跨段重置才是对应证据。手机无命令输入控制权。 |
| 下载、分享、在电脑打开 | [三处电脑打开](../../artifacts/desktop-open-verify-android.json)、[文件缺失拒绝](../../artifacts/desktop-open-missing-android.json)、[附件与工作区系统交付](../../artifacts/attachment-document-transfers-android.json)、[保存进程结束](../../artifacts/save-death-after.json)、[分享复制进程结束](../../artifacts/share-death-after.json)；[当前APK实测](../../artifacts/file-delivery-current-android.json)见下 | 保存成功以原生回执及新文件字节核对；分享仅表示系统选择器已打开。电脑打开须明确确认，不能保证任意外部办公软件完成呈现。Excel请求曾超时，保留未知提示，不记为打开成功，不自动重试。 |

当前66项回归来自 files、download、attachments、attachment-documents、office/cache、html、review-store、commands、output-ansi、desktop/apps及pdf-platform，全部通过。历史运行时报告未在本轮全部重跑；本轮没有修改生产代码或重建APK。

2026-10-04收尾复核KKC-19现行五项验收标准，与上表范围一致。另核对[真实文件撤权](../../artifacts/file-revocation-android.json)：已写入85字节后撤销，temporaryFileRemoved、workerDisposed、workspaceRemoved、notDelivered及reconnectRejected均为true，errors=[]；补足第三条的实际撤销依据。任务完成限于已确认支持格式和本地环境，不承诺任意外部办公应用打开成功或系统接收App最终发送；这些结果在界面准确报告，原有效标准没有删除。

## 当前正式 App 的保存与分享

2026-10-04在MuMu日常绑定的DSHM自有Remote聊天，经过4次「加载更早的消息」打开原85字节附件。原文预览与电脑样本完全一致；系统保存后根据目录前后差集找到本次新文件，SHA-256为`090416bcf450b460fa0f97330818ad33fa347010458d1ce461b0d4f5a10c37be`，与原件一致。

点击分享后实际Android面板显示准确附件名和可选接收应用，见[系统截图](../../artifacts/file-delivery-current-share-android.png)。未选择接收者，不宣称分享已发送。返回后再次核对本次保存文件摘要，仅删除这个测试副本；原聊天恢复16条回复/空草稿，页面errors为空。没有发送模型消息、重启服务或改权限。

两处驱动观察失败保留在[本轮报告](../../artifacts/file-delivery-current-android.json)：Android把重名编号放在扩展名之后，初版正则不接受`.txt (3)`；内容核对前没有删除。系统层级未提供chooser_header，重新观察同一窗口仍为空，最终以实际屏幕确认面板；不能把App内部“已打开”文字单独当作系统窗口证据。

## 保留的限制

- [Excel记录](../../artifacts/office-desktop-xlsx-android.json)为requestAccepted=false，既有[电脑窗口记录](../../artifacts/office-desktop-host-windows.json)只支持已观察的窗口；Office预览六格式通过与电脑默认应用打开是两项不同能力。
- 原模型生成图片、任意第三方插件结果类型、任意文档复杂排版、任意系统文件提供方/接收App异常不由有限样例证明。已有具体失败处理与容量限制继续保留，不以这些开放集合创建无限验收组合。
- 网站转发后续见KKC-21；当前页面加载DSHM自己的文件与聊天界面，不映射电脑整站，不提供手机终端。
