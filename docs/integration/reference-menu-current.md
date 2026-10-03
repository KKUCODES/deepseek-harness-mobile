# 引用菜单与结构化草稿

- 状态：真实 App 已复现并修复引用丢失，新版 MuMu 实际读取通过。
- 维护角色：项目协作 Agent；核验日期：2026-09-28（香港时间）。
- 来源：[菜单插入](../../src/remote-references.mjs)、[原编辑器绑定](../../src/remote-input-session.mjs)、[共享选择页](../../src/ui/RemoteReferences.jsx)。

## 根因与边界

“＋ → 引用文件或聊天”原先调用 model.draft，将全部草稿重写为纯文本，已有引用的 owner/ID 丢失。MuMu 原版先用 @ 添加一枚聊天引用，再从菜单添加同一聊天，卡片由1变0；见[失败报告](../../artifacts/reference-menu-before-android.json)。

现改用已挂载输入框的原 insertReference 操作追加，保留既有文字与卡片身份；偏移使用原编辑器 detectText，而非显示标签或复制文字长度。原文件格式和电脑返回的聊天 mention 保持不变。菜单只接受当前连接/会话/候选，未就绪、提交或草稿交接中拒绝插入，不回退重写纯文本。

相比手动拼接编辑器JSON，复用原操作能保留插件引用契约和草稿生命周期，不另造卡片结构。发送仍经各引用的原提供方序列化；电脑读取权限不变。子任务原有只读/引用限制未扩大，普通主会话和旁栏内的同一会话共用该实现。

## 入口与证据

| 入口/行为 | 验证 |
| --- | --- |
| 主聊天菜单文件、聊天 | [生产页面检查](../../scripts/check-reference-menu.mjs)验证原卡片身份、正文、两种新增卡片及重新进入；[专项报告](../../artifacts/reference-menu-web.json)。 |
| 旁栏内父会话菜单 | [旁栏页面检查](../../scripts/check-sidebar-chat.mjs)验证已有卡片、菜单追加及返回主聊天后两枚保留；[完整页面回归](../../artifacts/reference-menu-full-web.log)通过。此入口为浏览器回放，未单独做MuMu旁栏专项。 |
| 真正提交接口 | [原输入框契约检查](../../tests/fixtures/remote-input-checks.mjs)验证两个不同ID分别序列化、提交/交接期间拒绝追加；完整页面回归中的17项契约通过。 |
| 候选与交接规则 | [8项单元结果](../../artifacts/reference-menu-unit.log)通过；[接口生成样本来源](../../tests/fixtures/generated/README.md)已核对，仅用于测试。 |
| 构建 | [Web](../../artifacts/reference-menu-build-web.log)、[Android构建/lint](../../artifacts/reference-menu-build-android.log)通过；APK覆盖安装，无清除数据。 |
| MuMu菜单聊天 | [实际入口脚本](../../scripts/verify-reference-menu-android.mjs)与[新版报告](../../artifacts/reference-menu-fixed-android.json)：16:51 UTC 卡片1→2，重新进入保留，无页面错误，原草稿恢复。 |
| MuMu菜单文件与真实发送 | [分阶段驱动](../../scripts/verify-workspace-reference-send.mjs)的 --menu：已有@聊天引用，再从菜单选择文件，切换工作区并往返。16:53 UTC [准备](../../artifacts/workspace-reference-menu-resume-prepare.json)、[单次发送](../../artifacts/workspace-reference-menu-send.json)、[结果](../../artifacts/workspace-reference-menu-observe.json)：sourceRead=true、targetRead=false、chatRead=true，两个文件未改。 |
| 清理 | [两条新测试会话归档及文件删除](../../artifacts/workspace-reference-menu-cleanup.json)；原CLI卸载临时插件后，[手机复核](../../artifacts/reference-menu-unloaded-android.json)确认扩展/工作区注册消失、原聊天空草稿恢复。管理状态active、management=false，本轮未授予管理权限。 |

初次真实准备因测试驱动漏写候选的 `./` 前缀而超时，[失败报告](../../artifacts/workspace-reference-menu-prepare.json)保留。核对页面实际候选后修正定位，清除已确认的本次测试草稿并在同一对测试会话续接；未重复创建或发送。启动App时驱动错过新页面事件，后续重新读取实际已打开的WebView，没有重复启动或清数据。

本项补齐R10菜单路径；并非完整Remote完成证明。网页中转仍暂不开发、范围待用户最终确认，完整工作见[验收表](./completion-audit.md)。
