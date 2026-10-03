# 跨工作区草稿中的文件引用

- 状态：真实同名文件误读已复现并修复，新版 MuMu 实际模型读取通过。
- 维护角色：项目协作 Agent；核验日期：2026-09-28（香港时间）。
- 来源：[交接入口](../../src/remote-workspace-drafts.mjs)、[引用转换](../../src/remote-workspace-references.mjs)、[编辑器投影](../../src/remote-input-session.mjs)、[原引用契约](../../../deepseek-harness/packages/client/ui-reference/src/client/index.ts)。

## 根因与修复

原 `reference` 文件卡片的 ref 保存相对 mention，codec.serialize 原样返回。之前只复制 JSON，换工作区后相同路径指向目标目录的同名文件；旧测试只能证明结构保留，不能证明引用身份正确。

电脑登记两个专用测试工作区，放置同名不同内容的文件。手机通过原候选选择文件和已有专用聊天，移动两枚结构化引用，再真实发送。16:26 UTC [原版结果](../../artifacts/workspace-reference-send-observe.json)返回 TARGET 标记、聊天标记正确，证实文件误读。失败和请求意图保留，该请求未重发。

现于原子保存前，将原 reference 的 file/folder 相对 ID 固定到源会话 cwd，同步 clipboardText，保留显示标签。文字由原 Lexical 投影重算，不手工拼接段落。源编辑器不先修改，提交失败仍保留源草稿；源目录未知、路径不可表达或投影不一致时拒绝交接。绝对路径、主目录、聊天引用及其他插件ID保持原样。

相比禁止带引用切换，这样保留完整交接能力；转换局限在手机交接边界，不修改上游插件内部。原电脑读取权限和审批仍生效，没有扩大路径权限。普通手写文本中的相对路径不推断为结构化引用，不外推任意第三方引用契约。

## 验证与清理

| 范围 | 证据 |
| --- | --- |
| 真实交接入口回归 | [单测](../../tests/remote-workspace-drafts.test.mjs)修改前 [red](../../artifacts/workspace-reference-red.log)失败；修改后通过来源路径和原子落盘断言。 |
| 规则和模型 | [规则测试](../../tests/remote-workspace-references.test.mjs)覆盖Windows/POSIX、空格、目录、未知源目录及投影不一致；[模型与交接108项](../../artifacts/workspace-reference-model-tests.log)全部通过。 |
| 页面 | [检查脚本](../../scripts/check-workspace-drafts.mjs)使用实际Lexical、原工作区选择器验证卡片、源清空、目标投影和附件重新上传；[完整回归](../../artifacts/workspace-reference-browser.log)通过。首次驱动遗漏TokenSpan，补充原契约后通过。 |
| 构建 | [Web](../../artifacts/workspace-reference-build-web.log)、[Android构建/lint](../../artifacts/workspace-reference-build-android.log)通过，APK已覆盖安装MuMu，未清理数据。 |
| 新版真实模型 | 16:33 UTC [准备](../../artifacts/workspace-reference-fixed-prepare.json)两枚卡片交接/往返保留、源为空；[单次发送](../../artifacts/workspace-reference-fixed-send.json)后的[结果](../../artifacts/workspace-reference-fixed-observe.json)sourceRead=true、targetRead=false、chatRead=true。两个文件未修改，[截图](../../artifacts/workspace-reference-fixed-result.png)已核对。 |
| 清理 | [原版](../../artifacts/workspace-reference-send-cleanup.json)及[新版](../../artifacts/workspace-reference-fixed-cleanup.json)各两条测试会话归档、测试文件删除、原聊天空草稿恢复。原CLI卸载临时插件后，[16:34手机复核](../../artifacts/workspace-reference-unloaded-android.json)扩展和工作区注册均移除；未递归删除目录。 |

[分阶段驱动](../../scripts/verify-workspace-reference-send.mjs)用 `--fixed` 隔离新版报告，发送前持久化意图，超时只能继续观察。初次准备因编辑器尚未可编辑失败，用 resume-prepare 接续同一对会话；新版增加真实editable等待，没有重复创建。

电脑/网关未重启，日常设备active、management=false，未修改Key或模型设置。R10此项实际读取已补验；完整Remote按[验收表](./completion-audit.md)继续。
