# 聊天宽表触摸滚动

- 状态：preview.15 本地候选，未提交/推送/发布；维护：手机端维护者，2026-10-27；[KKC-117](https://linear.app/kkcodes/issue/KKC-117)。
- 保留上一轮原代码块、字体和返回底部改动；不修改 DSH、电脑插件或中转，不混旧插件适配分支。

## 原因和最小接线

官方 rc.2 commit `687f282e8625c6b8d11ff58211a90524be2e4317` 的 `ui-primitives/src/markdown/MarkdownText.module.css` 对四列以上表格使用 `md-table-wide`：默认 `overflow-x:hidden`，悬停或键盘 `focus-visible` 才改为 `scroll`。alpha.2行为相同。桌面滚轮/触控板经过表格会触发悬停，但手机不能依赖该状态。

从实际列表进入 Remote 并回放合成表格后，清除列表点击残留的 hover，得到容器350px、内容534px、`overflow:hidden`；宽度没有被外层撑大，问题确实是触摸滚动被关闭。只有程序设置scrollLeft无法验证这类错误，因为hidden容器仍可被程序定位。

[共享 mobile.css](../../src/ui/mobile.css)仅在 `(hover:none)` 或 `(pointer:coarse)` 下，通过原公开 `md-table-wide` 钩子将原容器改为 `overflow-x:auto`，取消为隐藏滚动条预留的底部间距。保留原 MarkdownText、表格列宽、窄表/引用内表格填充规则、横向 overscroll、触摸方向和插件 DOM，不另写表格组件，不扩大外层聊天或去掉页面裁剪。

该规则存在于手机页面宿主样式，覆盖普通排版插件、Remote主/旁栏及新旧Markdown文件预览；桌面鼠标环境保留上游行为。与禁用整个页面overflow裁剪相比，此方案只开放表格自己的横向滚动；没有用横向滑动手势拦截纵向聊天。

## 实际验证

| 入口/环境 | 结果 |
| --- | --- |
| rc.2 / alpha.2 Remote主聊天 | 实际列表进入官方Session，合成五列表格；触摸从0滑到184px，最右列完整可见；窄表和从表格上纵向滚动聊天通过 |
| rc.2 / alpha.2 普通聊天 | 完整OrdinaryApp＋真实排版席位，隔离IndexedDB样例，由侧栏进入；同一组手势通过，不调用模型 |
| 两SDK Remote旁栏 | 原子会话菜单进入，触摸横向与纵向滚动通过 |
| 两SDK新/旧Markdown预览 | 原插件面板/旧文件预览入口，真实触摸滑到最右列通过 |
| MuMu Android12/WebView110 | 正式组件DOM/CSS无用户数据快照，在独立调试包里以实际WebView触摸推进约171.7px，最右列完全进入380px容器，继续纵向滚动通过；不在正式包开启调试 |
| 回归/构建 | 577项Node、代码块/流式/语言/预览专项、两SDK网页、Android release/lint通过 |

脚本：[共享手势断言](../../scripts/check-chat-table.mjs)；`node scripts/verify-preview15-history.mjs --table`（可加`--alpha2`、`--aside-history`）；`node scripts/verify-chat-code-block.mjs --table`（可加`--alpha2`）；[Android快照手势回归](../../scripts/verify-chat-table-android.mjs)。没有把“能赋scrollLeft”当作触摸通过。

浏览器专项每个独立CDP会话显式启用触摸仿真：Chromium在此会话detach后会清除仿真，若直接复用后续页面会假变成鼠标环境。手机样式不依赖该测试设置。

本地原包名/证书code25覆盖安装：`artifacts/DSHM-preview15-table.apk`，SHA256 `430b76aae2dfed68e94eb6cebde3a4cb1cd2599bcb98042a4df0d54463e8997d`。实际聊天、Key、配对与插件状态保持；不发送消息或操作审批。

正式包普通聊天：打开既有第50轮总结，在「关键决定表」横向滑动，右侧「状态」列由x695起且裁切，移至x515–742完整显示；纵向位置保持，之后恢复左侧位置。截图 `artifacts/chat-table-api-before.png` / `chat-table-api-after.png`。只读查看既有内容，不执行其中的文字指令。

正式包Remote原会话的本轮手势复验未计通过：模拟器在未发出相应命令时出现聊天、项目和菜单的并行切换，停止继续点选，避免干扰其他操作。Remote实际Session入口/旁栏与预览的结果来自上述双SDK页面，Android触摸结果来自独立调试包的正式组件快照；不将两者合并表述为正式包Remote端到端手势通过。
