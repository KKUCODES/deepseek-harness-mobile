# Remote 文件预览与列表排版

- 状态：排版修正、浏览器专项、完整页面回归与独立 MuMu 真实文件验证通过；已随[公开preview.3](../releases.md#已核验范围)提交发布，以下保留本地候选证据。
- 维护角色：DSHM 手机端维护者。
- 最近核验：2026-10-15。
- 任务：[KKC-55](https://linear.app/kkcodes/issue/KKC-55)。

## 原因与边界

DSHM 自有文档容器和复用的内置正文也经过了通用插件等比缩放。该容器按内容自然宽度测量，长路径、长行可能撑宽整个文档，再被压缩回手机宽度。回放中长内容撑至约 4000px，375px 下正文实际仅约 1px；短文档的原始正文也只有 11px。上一轮工具记录排版未覆盖这个入口，旧文档测试只检查内容存在，不能证明可读。

[文档适配](../../src/remote-document-previews.jsx)按确切组件身份标识 DSHM 自有外壳及本地复用的文本、Markdown、源码、图片、PDF、Office、HTML 预览器，[插槽注册](../../src/remote-plugin-slots.jsx)不再给这些组件叠加桌面缩放。原加载状态、资源与标签、换行开关、刷新、历史改动和源文件切换保持。不是按插件名或槽名放开所有内容，第三方文档渲染器继续经过原 `MobilePluginFrame`，保留作者声明和用户开关。

[手机样式](../../src/ui/remote-product.css)约束自有外壳的可用宽度和 flex 收缩。纯文本与源码最低 14px、1.6 行高，路径 13px，继续使用原路径尾部收纳与完整路径 title。换行开启时文本随宽度折行；关闭时由正文区域横向滚动，纵向滚动也只属于正文。图片/PDF 保留自己的缩放和滚动，不对第三方内部结构重排。

## 验证证据

[排版专项](../../scripts/check-remote-file-layout.mjs)通过实际文档控制器、原资源/正文组件，检查短文件、长电脑路径/长行、320/375/420/760px、浅深主题、正文高度和页面无横向溢出；另外覆盖源码、换行开关、双向局部滚动、附件自定义 720px 渲染器的默认缩放/用户关闭后滚动，以及卸载后回到可读内置文本。回放是明确的协议夹具，不代替真实电脑或 Android。命令：`node scripts/verify-remote-plugin-slots.mjs --file-layout --official-alpha2`。本机报告：`artifacts/remote-file-layout-alpha2-web.json`；修改前记录保留在 `artifacts/remote-file-layout-before.log`。

实际 MuMu 报告：`artifacts/remote-file-layout-android/60353c96-b038-4ff6-ab49-3a5f81e29e2c/report.json`。使用未修改的官方 DSH `0.2.1-alpha.2`、已发布插件 `0.1.84-latest.0`、生产中转和正常 App 配对/Remote 入口，在独立工作区新建空会话，读取真实长路径 TXT。浅深主题正文均 14px、路径 13px、比例为 1；正文高度 589px、内容高度 3398px，横纵滚动实际约 100px。返回保留草稿，没有读取 Key 或发送模型消息。

本轮复用独立 `.toolstyletest` UID，不清空正常 App 的数据或绑定。临时设备已撤销、自己的绑定移除、转发移除、自有 Host 和网关关闭，清理无错误；Android 安装包 SHA 为 `2680428ecb64c07935d22b017a55df44587e2234c454a960d44dbccc4582efc4`。独立 UID 的实测不冒充正常包同一二进制验证。未修改 DSH 本体、已发布插件或公网服务。

两代组件的排版专项分别有 16 个宽度/主题/内容组合通过，源码均 14px，第三方自适应及卸载回退通过；报告为 `artifacts/remote-file-layout-alpha2-web.json`、`remote-file-layout-legacy-web.json`。文档/历史差异/多标签和附件/自定义渲染器/失败重试分别通过 `--documents`、`--attachment-documents` 回归，完整页面回归无异常；记录在 `artifacts/remote-file-layout-documents.log`、`remote-file-layout-attachments.log`、`remote-file-layout-full-page.log`。495 项 Node 测试、Web 构建和独立/正常 Android assembleDebug、lintDebug 均通过。Web 构建仅有上游已有的 office-to-pdf 重复依赖键警告，未修改上游文件。

正常本地候选：`artifacts/releases/DSHM-2026-10-15-remote-file-layout.apk`，12,709,141 字节，SHA-256 `d1268e4e5676dab84c307d8658e7b9276ce146a4cab11482ce0b1405e0380d45`。168 个 Web 文件与 APK 完全一致，源码摘要见 `artifacts/remote-file-layout-apk.json`。已覆盖安装到正常 `.officialtest`，设备上 APK 摘要与候选一致，正常 Activity 启动成功，未清空数据或绑定；独立测试 UID 已卸载，安装核对在 `artifacts/remote-file-layout-installed.json`。

这次专门增加实际字号、祖先缩放和滚动范围断言，避免再次把“DOM 中有正文”误作“手机能读清”。当时仅完成本地修复，现已随公开preview.3提交发布。README仅更新下载入口与版本概述，详细证据留在本记录。

## 2026-10-15：补齐文件列表与统一面板尺寸

用户随后截图中的“文件”标签是已组件化的 `FilesBody`，而非 `TextPreview`。两者有独立正文组件；新版又复用 `PathLabel`，但接入层只为正文绕过缩放，目录仍被通用框测量成桌面自然宽度，窗口外壳也未赋予目录明确高度。375px 回放下文件名约 6.8px，滚动区域只有 16px。问题是适配职责分散和入口覆盖遗漏，并非缺少组件或重复编写目录业务。

比较过逐组件继续补字号/例外与统一面板尺寸契约：只加字号不能解决比例和高度，且容易继续遗漏；因此[面板布局规则](../../src/remote-panel-layout.mjs)集中维护文档、差异、文件目录的完整视口要求。下发的目录组件不能与本地函数比较身份，故同时检查官方注册域、目标槽和条目；第三方同槽替换继续缩放。目录文件名14px、路径13px、行高至少36px，保持原目录读取、折叠、刷新及打开文件。

目录和正文继续使用同一个 `MobilePluginPanels` / `PanelSurface` 外壳，沿用原组件自己的展开与滚动状态；本次只统一尺寸与内置组件的缩放边界，没有引入另一套目录、正文或位置恢复逻辑。

浏览器命令 `node scripts/verify-remote-plugin-slots.mjs --file-list-layout --official-alpha2`，旧基线去掉最后一个参数。各自覆盖320/375/420/760px和浅深主题，文件名14px、路径13px、可用滚动高度497px，目录展开、打开正文、重新打开目录，以及第三方同槽720px视图默认缩放/点击/用户关闭/卸载回退。旧生成夹具缺少新版观察接口的path参数，在此专项按已核验的同版scope/path契约补齐，另断言没有目录读取失败；不修改生产协议或生成文件。正文专项也另行回归。

最终 Android 报告为 `artifacts/remote-file-list-layout-android/d0299489-88a3-4473-b1e8-7eb2a893e636/report.json`，官方DSH/发布插件/生产中转组合与前述正文阶段相同。正常菜单→插件面板→打开面板→工作区文件进入实际电脑下发的目录组件；75份真实文件、嵌套目录、刷新、点击正文和返回、重新打开后明确切回文件标签，逐项通过。浅深主题文件名14px、路径13px、缩放比1，目录滚动区高673px、内容2824px；原展开和滚动位置保持，正文仍14px。没有模型请求，自己的设备、绑定、转发及Host均清理无误。独立APK摘要 `b473bd9921df62811ae358ed01e5000ac95ad83a5914a3bbcd203b9e79767145`，正常包另行核对。

早期驱动失败保留，不计作完整通过：`430eda80-72fe-48b5-b2b3-faf536c96685`、`e9ed25d3-0fc8-486d-bd1a-5fa6224ce886` 实际字号通过，但驱动重新打开的是guide页，读取了隐藏文件列表的偏移0。`d5fee4f5-0d98-4c8e-8816-3012bbeb6ffa` 的试验恢复实现也遇同样错误；复查实际菜单调用后已撤下该无充分依据的实现与合成隐藏归零测试，最终驱动切回文件标签、等待可见后再核对位置。不能把此前失败当成已证明的WebView缺陷。`169108c0-ba02-4ac5-bb10-ada384d3b1cc` 在配对前遇ADB连接超时退出，复查时临时CLI进程与端口映射均不存在。原App数据未清空。

两代目录专项各8种宽度/主题组合、同槽第三方替换和正文专项通过；完整页面回归 `artifacts/remote-file-list-layout-full-page.log` 无异常，495项Node通过。对应最终Web、独立/正常Android构建和lint均通过；Web只保留原上游重复依赖键警告。本次没有扩大公开SDK支持范围。

补齐目录后的正常候选为 `artifacts/releases/DSHM-2026-10-15-remote-file-list-layout.apk`，12,709,617字节，SHA-256 `0287a2f1f076c2db20caeec38c112840a48b4e9e4fb7f0e86b294b9ec6364420`；168份Web资源与APK一致。已覆盖安装正常 `.officialtest`，设备摘要相同并正常启动，没有清空聊天或绑定。独立测试UID已卸载；记录为 `artifacts/remote-file-list-layout-apk.json`、`remote-file-list-layout-installed.json`。前述 `d126…` 是正文阶段旧候选。项目知识库、内部记录及KKC-55同步，本地修复仍未提交、推送或发布。
