# Remote 含图会话空白：诊断

- 状态：原诊断已完成，后续[本地修复与验收](./remote-image-gallery-current.md)见KKC-120；本页保留修复前证据。维护：手机端维护者；核验：2026-10-27；[KKC-119](https://linear.app/kkcodes/issue/KKC-119)。
- 本轮仅诊断，保留其他未提交工作。不修改产品或 DSH 源码、不重新安装或发布 APK、不发送模型请求或操作审批；隔离脚本和原数据留在忽略的 `artifacts/`。

## 结论

[RemoteInlineImage](../../src/ui/RemoteImages.jsx)将原 DSH 的文档预览组件 `ImageBody` 当作聊天缩略图使用，只传入 `content`、`resourceAddress`、`t`。当前 alpha.2 和 rc.2 原组件均还需要文档标签页、缩放状态和动作等宿主接口；开始渲染时立即调用 `props.useTabInfo()`，手机接线没有提供该函数。

因此错误发生在**图片字节读取成功、可见图片开始渲染**后，而不是必须发生在上传或中转阶段。图片未进入可见区域、尚在加载或读取失败时，没有进入该组件，容易在早期测试中遗漏。

异常为 `TypeError: props.useTabInfo is not a function`。外层所有聊天节点共用 [dshm.chat.node 注册项](../../src/remote-plugin-slots.jsx)；原 SlotCore 对 single 插槽中的渲染错误执行 `reportEntryError(..., { abdicate: true })`，撤下该注册项，而不只是当前图片。实测所有聊天组文字数同时降为0，保留标题和输入框，与用户截图一致。

[RemoteHistoryList](../../src/ui/RemoteHistoryList.jsx)的组级 `RemoteErrorBoundary` 没有收到该异常，因为更内层原插槽边界已经捕获并完成退让；所以也没有出现组级恢复提示。这是故障隔离层级的缺口，不是历史记录真的被清空。官方 Session 中28条原记录仍完整存在，游标0–27不变。

## 数据和复现依据

只读定位标题「这个是什么」的原会话，解码原 DSH 会话日志的全部连续 zstd 帧：1行会话头、28条记录，保留原序号、时间和来源引用。包含用户图片、文字、read_image工具和模型正常回答。原图945×1671，1,551,471字节，实际SHA256与附件ID匹配。

在 MuMu Android12/WebView110 的独立调试包中加载实际 `RemoteWorkspace`、原 Session 和虚拟列表，将原数据通过隔离传输回放；图片使用原附件字节和现有附件分块接收路径。没有重新向模型提问，也未修改电脑原日志。**这是实际页面的隔离协议重放，不是正式包原配对网络的抓包验证。**

源码核验范围：官方 rc.2 commit `687f282e8625c6b8d11ff58211a90524be2e4317` 的 `ui-sidebar-documentpreview/.../ImageBody.tsx`、`ui-attachment/.../MessageImage.tsx`、`ui-slots/src/index.ts`，以及隔离的 alpha.2 同名文件。`v0.1.0-preview.11` 中已存在同一手机调用；只能说明接线被继承，不能宣称公开.11 APK已实测复现。

| 隔离实验 | 结果 |
| --- | --- |
| 当前rc.2接线，完整快照＋原图成功读取 | useTabInfo异常；`dshm.chat.node`实际报告abdicated=true；28条记录仍在、两组文字均为0 |
| 当前rc.2接线，先进入空会话再逐条实时接收原记录 | 相同异常和整段空白，不只影响重开会话 |
| 原alpha.2接线，原图成功读取 | 相同异常及插槽退让；不是rc.2独有更新问题 |
| 同一记录仅移除图片作为对照 | 文字和回答正常，内容未被虚拟列表丢弃 |
| 图片读取不可用 | 当前路径保留失败占位和回答，不触发ImageBody崩溃 |
| 仅纠正先前FlowMotion驱动器返回值，保留原图片接线 | 仍因useTabInfo异常整段空白；与思考展开问题独立 |
| 仅诊断产物改接原聊天ImageGallery及既有授权loadImage | 图片和回答恢复；单图及多图对照均能解码原图。未修FlowMotion的实时对照另有已知begin异常，不计完整无错通过 |
| 诊断产物同时纠正FlowMotion；两张用户图片＋工具图片实时重放 | 三张图naturalWidth=945，回答保留，无pageerror、无插槽错误；同图共享既有URL读取缓存 |
| 上一对照让附件读取不可用 | 原画廊显示失败重试按钮，回答保留，无插槽错误 |

主因日志：`artifacts/image-live-original.log`、`image-alpha2-original.log`、`image-driver-only-control.log`。对照日志：`image-text-control.log`、`image-original-gallery-control.log`、`image-multi-gallery-control.log`、`image-gallery-driver-control.log`、`image-gallery-failure-control.log`。记录状态、长度、几何和错误，不将聊天全文或原图复制到公开夹具。

## 通用修复建议

1. 聊天图片直接接入当前SDK的原 `ui-attachment` 消息画廊与公开图片席位，使用既有 `RemotePluginImageUrls` 授权加载；不要为聊天伪造文档标签页，也不要继续直接调用缺失宿主接口的文档预览组件。核对两版席位差异：rc.2 原席位为 `conversation.chat.user.images` / `conversation.chat.message.images`，手机仍保留旧 `conversation.message.images` 接线，不能只导入组件就宣称插件合同一致。
2. 默认回退、用户图、助手图和工具图统一遵守画廊加载/重试/释放合同；文档面板仍走原文档宿主注入。[旧RemoteFilePreview](../../src/ui/RemoteFilePreview.jsx)亦有直接调用ImageBody的同类接线，实施时一并检查，不把本轮未运行的入口算作已复现。
3. 让图片异常止于图片或单次内容工厂，不污染共用聊天节点注册项；保留原插槽错误语义，补用户可见错误与重试，避免被内层捕获后外层恢复完全不出现。
4. 回归必须让真实字节成功读完并进入视口；覆盖实时发送/快照重开、离屏再进入、混合多图、工具图片、下载/解码失败、会话切换及其他聊天是否仍可显示。两SDK、主/旁栏、文档入口分别核验。

隔离画廊替换仅通过esbuild内存生成，不写入`src/`；本轮未完成生产接线、完整插件合同和正式包原配对回归，不应描述为App已修复。当前公开README能力没有变化，本轮不改其宣传或使用说明。
