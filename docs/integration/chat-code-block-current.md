# 聊天代码块：复用原 DSH 组件

- 状态：preview.15 本地候选，未提交、推送或发布。
- 维护：手机端维护者；核验：2026-10-27；[KKC-116](https://linear.app/kkcodes/issue/KKC-116)。
- 以 `release/preview15-from-preview11` 为基线，保留上一轮返回底部改动。不修改 DSH、电脑插件或中转，不混旧插件适配分支。

## 原因与接入

两个聊天原本已经共用 `OrdinaryMarkdown`，并非两份独立代码块。但手机封装只提供复制标签，未传原 DSH `toolbarLabels`，所以原 `CodeBlock` 走旧文字复制头，而不是带自动换行按钮的 `CodeToolbar`。实际 Remote 会话入口和完整普通聊天页面均先复现了缺少按钮。

现在[共享 ChatMarkdown](../../src/ui/ChatMarkdown.jsx)直接导入原 `MarkdownText` 和 `ui-chat/markdown-labels.ts`，使用原 `locale` 中英字典。原组件继续负责代码卡、图标、复制反馈、自动换行/取消自动换行、横向滚动和流式高亮。原始换行和空行保持；官方此工具栏没有行号切换按钮，本轮不新增另一套控件。

普通聊天的 `ordinary.message.content` 排版插件席位与 RemoteWorkspace 都调用同一 `ChatMarkdown`；旧 Markdown 文件预览、更新说明也复用它。`OrdinaryMarkdown` 仅保留为旧模块导出的别名。新版 MarkdownBody 继续使用官方自己的 MarkdownText/CodeBlock 与工具栏合同，不改写其资源和文件导航。外链委托、项目文件引用和稳定 labels 身份保持，避免每个流式片段重建解析缓存。

来源：官方 rc.2 commit `687f282e8625c6b8d11ff58211a90524be2e4317` 的 `packages/client/ui-primitives/src/markdown/CodeBlock.tsx`、`CodeBlock.module.css`、`CodeToolbar.tsx`、`ui-chat/src/client/markdown-labels.ts` 和公共 locale；同时按 alpha.2 源码构建验证。上游只读。

## 字体与交付

DSH 默认字体栈包含桌面字体及 `Courier`。MuMu Android12/WebView110 的实际字体探测显示，旧代码字体落到 **Cutive Mono**；只追加 `monospace` 不能越过这个已存在的别名。选择将原列表已有的 **JetBrains Mono** 随包提供，继续沿用原字体优先级，避免为手机重写组件或复制受限系统字体。

[字体原件与许可](../../src/assets/fonts/README.md)固定 JetBrains Mono v2.304 Regular WOFF2，92,164字节，SHA256 `a9cb1cd82332b23a47e3a1239d25d13c86d16c4220695e34b243effa999f45f2`。共享 mobile.css 提供字体声明，两个页面离线读取 APK/页面资源包内的同一文件，不通过电脑、中转或字体CDN分发。OFL许可由网页构建复制进 `licenses/`；原生资源清单已允许 woff2/txt。默认字体完全不可用时再回退系统 monospace；用户/作者的 `--dsh-font-family-code` 仍优先。

普通聊天主题插件会延迟加载 body 字体变量，手机默认回退用 `html body` 接线，避免加载顺序导致普通聊天与 Remote 不同。未修改原字号阶梯：当前代码块默认11px，内置文件面板仍保留既有专用字号。

隔离调试包的同一 WebView CDP 探测已从 `Cutive Mono / isCustomFont:false` 变为 `JetBrains Mono / isCustomFont:true`。这证明字体实际参与渲染，不只是 CSS 声明存在；不将桌面各操作系统原生字体的字形宣称为逐像素一致。

## 旧WebView与粘性工具栏

真实50轮会话仍出现工具栏落到代码卡底部。隔离调试包重放实际组件生成的DOM/CSS，在5000px历史偏移复现：采用 `translateY` 时，卡片顶12px、底365px，工具栏顶323px；同位置改为绝对 `top` 后，工具栏顶112px，恰好与聊天滚动区顶112px一致。不是代码组件缺少header，也不是重写CSS的理由。

[RemoteHistoryList](../../src/ui/RemoteHistoryList.jsx)只把虚拟组定位从transform改为top，仍用原DSH粘性工具栏和相同DOM虚拟化、连续Session数据；不引入新的分页按钮。[Android回归](../../scripts/verify-chat-code-block-android.mjs)重放已生成的无用户数据快照，不在生产包开放调试。其CSS字体通过现有APK自有来源加载，不绕过CSP。

## 验收

| 路径 | 结果与边界 |
| --- | --- |
| 普通聊天 | 完整 OrdinaryApp、真实排版插件席位和隔离 IndexedDB 合成历史；真实侧栏进入会话，两SDK换行/横向滚动/复制/空行/320px通过 |
| Remote | 实际列表点击进入官方Session，隔离事件回放；两SDK同一组代码卡检查通过 |
| 流式与语言 | 共享组件连续追加、完成和切换英文时，代码卡身份和取消换行状态保持；属于组件流式专项，未调用真实模型 |
| 浅深色 | 普通聊天真实系统色彩变化，代码卡从 `rgb(249,250,251)` 变为 `rgb(27,27,28)`，两SDK通过 |
| 导航与回归 | Remote正文、思考、工具及新旧Markdown预览外链回归通过；新旧Markdown预览原始换行及工具栏切换通过；上一轮返回底部回归保持；577项Node通过 |
| 虚拟定位变更 | 主/旁栏各24批历史，1540事件保留、前插锚点误差0px；rc.2/alpha.2终页及返回底部通过；旧WebView大偏移粘性位置和实际字体回归通过 |
| 构建 | 两SDK Web、Android release/debug与lint通过，原签名code25候选覆盖安装MuMu；未读取Key、发送模型请求或操作审批 |

脚本：[Remote专项](../../scripts/verify-preview15-history.mjs) `--code-block`，可增加 `--alpha2`；[普通聊天专项](../../scripts/verify-chat-code-block.mjs)，可增加 `--alpha2`。共用[断言](../../scripts/check-chat-code-block.mjs)；Windows系统剪贴板按CRLF规范化后比较，未改原复制实现。

最终原签名code25本地包：`artifacts/DSHM-preview15-code-block.apk`，SHA256 `b77e1994977ba98e99f9dce4ef8342b22903df0d9f58ea8aa8db5e56c8f8dd65`。APK已核验包含字体文件和OFL许可；覆盖安装不更改原聊天、Key、配对或插件启停记录。MuMu正式包实际普通聊天与原配对50轮Remote代码卡已检查，未发送消息；字体/粘性精确测量来自上述独立调试包专项，不将其描述为正式包CDP调试。

最后一次覆盖安装后的实际Remote截图：`artifacts/code-block-mumu-remote-final.png` / `code-block-mumu-remote-nowrap-final.png`。原代码栏已在顶部，切换后代码长行横向滚动、源换行保留；检查后恢复自动换行。调试包曾尝试运行未经WebView降级的浏览器夹具，遇到`Invalid regular expression flags`，未计通过；改用正式组件DOM/CSS快照和APK字体的隔离布局回归，上述正式包功能通过，不为此改变生产编译或WebView安全设置。
