# Remote网页链接点击无反应排查

- 状态：通用修复已随[preview.12/code15](https://github.com/KKUCODES/deepseek-harness-mobile/releases/tag/v0.1.0-preview.12)公开发布；Actions40082470843构建/lint/原证书签名与APK及附件匿名下载核验通过，固定源码783e979；[发行证据](../releases.md#已核验范围)。旧preview.11不含修复。下述原始诊断与当时测试边界保留。[发行KKC-90](https://linear.app/kkcodes/issue/KKC-90)。
- 维护：手机端维护者；核验日期：2026-10-24；[诊断 KKC-87](https://linear.app/kkcodes/issue/KKC-87) · [修复 KKC-88](https://linear.app/kkcodes/issue/KKC-88)。
- 发布源码基线：`30f4c6c1e6d730bf53c8bb77c4ecc69f819e810a`（preview.11发行后的文档提交）；Android使用上轮已构建的同逻辑Debug/code13隔离包，不冒充用户真机或公开code14 APK的完整Remote验收。

## 结论与调用链

反馈属实。Remote的HTTP(S)链接会生成正常的蓝色锚点，但没有将点击交给手机浏览器；回退的WebView页面导航又被原生容器拦截。这条失败链不依赖DSH更新或中转联网，不能归因于公用服务带宽。

1. [RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx)的`renderContent`只传`onOpenFile`，没有传`onOpenLink`。
2. [共享Markdown](../../src/ordinary-rendering.jsx)直接把该值作为`MarkdownDelegateProvider.openExternalLink`；未传时，上游保留普通`<a target="_blank">`，没有绑定外链点击回调。
3. [RemoteActivity](../../android/app/src/main/java/dev/dshmobile/validation/RemoteActivity.kt)的`shouldOverrideUrlLoading`只根据`allowsHtmlNavigation`决定阻止，未向系统发送浏览器Intent；[RemoteBridge](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)只允许自有HTML预览的非主框架导航，也没有`links.open`操作。新窗口同样没有自定义外链处理。

颜色说明锚点渲染成功，不代表宿主的打开动作已接通。不能通过放开WebView加载任意网页来处理：自有页面、原生桥和Remote连接仍需保持隔离。

## 复现与对照

忽略目录`artifacts/remote-links/diagnose.mjs`使用现有合成会话夹具、固定官方rc.2 SDK和真实`RemoteWorkspace → RemoteMessage → OrdinaryMarkdown`路径，不替换点击函数或原生导航策略。

| 检查 | 结果与边界 |
| --- | --- |
| 桌面Edge | 三次点击同一HTTP(S) Markdown链接均打开正确的新窗口；DOM记录`target=_blank`、`defaultPrevented=false`，无页面错误。目的页由本地测试响应提供，不依赖外网。 |
| 隔离Android API36.1 | 原普通聊天菜单进入真实RemoteActivity后，在测试UID通过调试协议载入上述合成页面。三次原始指针点击均触发锚点事件，但URL保持`remote.dshm.invalid/assets/web/remote.html`，顶层Activity始终为RemoteActivity，未打开浏览器。无JS页面错误。 |
| 原App与数据 | 没有操控MuMu/emulator-5554；新装测试UID只在本任务启动的无窗口emulator-5556使用，结束后卸载该UID并关闭独立模拟器。未读取聊天、Key、配对凭据或调用模型。 |
| 测试驱动限制 | 初期夹具顶层await/ESM转换、WebView上下文选择及自动等待导航失败保留，不计通过；最终使用当前Remote页面和原始指针点击完成断言。Android报告及截图成功写入后CDP关闭等待未退出，已核对精确命令行后结束本任务驱动进程。 |

报告：`artifacts/remote-links/browser-report.json`、`android-report.json`，Android截图`android.png`。Android验证的是实际容器与产品组件的组合回放，不是电脑配对、真实用户会话或所有厂商真机测试。

## 影响范围与建议

- Remote正文、思考和工具文字复用同一`renderContent`，属于同一遗漏路径。普通Markdown链接、自动识别网址及网址行内代码最终共享上游外链锚点；本轮实际点击用普通Markdown链接，其余为源码同路径判断。
- [Markdown文件预览](../../src/ui/RemoteFilePreview.jsx)也没有传`onOpenLink`，存在同类缺口；本轮未单独点击该入口。
- [普通聊天](../../src/OrdinaryApp.jsx)已接`session.openLink → links.open → ACTION_VIEW`；[更新说明](../../src/ui/AppUpdates.jsx)已接独立受限更新外链接口。这两处不属于同一遗漏，本轮未重新做Android点击验收。
- 项目文件/行号继续走`onOpenFile`，不应混同网页链接；第三方插件自己的DOM或链接逻辑需单独诊断，不能据本轮宣称都正常或都失效。

原诊断比较了原生导航兜底与受限外链能力两种方案。用户随后授权采用受限外链接口及共享Markdown处理；没有放开WebView加载任意网页，也没有特化消息或插件。

## 已实现的通用修复

[RemoteMarkdownLinks](../../src/remote-markdown-links.jsx)在[RemotePluginScope](../../src/remote-plugin-slots.jsx)统一提供外链能力，覆盖主聊天、子会话、思考/工具正文、原内置文件面板及旧预览。[自有Markdown](../../src/ordinary-rendering.jsx)未显式指定外链处理时继承该能力；普通聊天和更新说明的显式处理仍优先，文件处理仍由当前调用者指定。

源码Markdown组件与已发布SDK中的Markdown组件各自有React上下文，统一层向两者提供同一个函数；仅接源码上下文会遗漏原内置Markdown文件面板。实际入口测试发现并覆盖了此差异，没有修改DSH或SDK。

网页通过`RemoteClient.call('links.open')`到[RemoteBridge](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)，无需电脑在线，也不经过中转。原生继续核对主框架、精确来源及`remote.html`入口，参数只接受`url`。[ExternalLinks](../../android/app/src/main/java/dev/dshmobile/validation/ExternalLinks.kt)由Remote与普通聊天共享：校验HTTP(S)、长度、主机、凭据、控制字符、反斜杠和合法端口后发送无额外授权的`ACTION_VIEW / CATEGORY_BROWSABLE` Intent；不注入Key、文件授权或指定其他组件。无浏览器和系统拒绝分别返回错误，Remote用共用Surface显示可关闭提示。

原WebView导航拦截、资源拦截、HTML沙箱及文件读取策略未放宽；没有接管第三方插件独立DOM的任意链接。该修复新增原生能力，后续交付需要新版APK，不能只向旧APK投放页面资源。本轮未发布APK或r2。

## 修复验收矩阵

| 范围 | 实际结果 |
| --- | --- |
| 修复前回归 | 新测试在正文真实点击后等待原生打开请求失败；日志`artifacts/remote-links/before-fix.log`。 |
| rc.2及alpha.2页面 | 正文、思考、工具文字、裸网址、行内代码网址、新版Markdown面板、旧版Markdown预览及失败对话框通过；项目文件仍进原文件面板，行号参数保留，未发送网页打开请求。 |
| Android真实桥及系统浏览器 | 本轮新建Debug/rc21test/code14候选在独立API36.1，从普通菜单进入Remote后回放产品组件与合成会话。聊天HTTPS和原内置Markdown文件HTTP链接实际唤起Chrome，系统返回后原Remote仍保留；没有修改日常MuMu。Chrome首用欢迎页未登录或接受条款，不将Intent唤起等同目标网站加载成功。 |
| 原生安全 | [ExternalLinkChecks](../../android/app/src/androidTest/java/dev/dshmobile/validation/ExternalLinkChecks.kt)在Android通过有效URL、非法协议/凭据/端口/类型/长度、Intent内容及无浏览器/系统拒绝分类；后两者由受控Activity抛出异常，非真实卸载浏览器。真实Remote桥另验拒绝非法URL、额外参数和非入口页面；同源子框架桥存在但调用不响应，opaque来源没有该桥，均未唤起浏览器。 |
| 对照与构建 | 550项Node、普通/Remote两个实际更新说明入口通过；rc.2页面、Debug/AndroidTest/Release构建及两变体lint通过。普通聊天继续使用同一受限原生帮助类，未重新生成真实模型回复。 |

复验：`node scripts/verify-remote-plugin-slots.mjs --links`；旧SDK用`--links --official-alpha2`。Android运行`linksOnly` instrumentation及[真实入口驱动](../../scripts/verify-remote-links-android.mjs)，只允许emulator-5556/rc21test；驱动先自动固定生成rc.2合成页面及浏览器回归，防止复用错版本的test.js。报告为`artifacts/remote-links-0.2.1-rc.2-web.json`、`remote-links-0.2.1-alpha.2-web.json`及`artifacts/remote-links/{native-policy.log,native-links-report.json,android-build.log,node-tests.log,update-ui-regression.log}`。

早期工具事件夹具形状、展开选择器与退出动效等待失败保留，未计通过；实际文件面板测试揭示双上下文遗漏后已修复，最终两版本均通过。首次原生断言遇到测试Activity在非主线程创建，已将该检查切到主线程；一次系统UI无响应打断Chrome返回，关闭阻塞提示后完整顺序复验通过。CDP闲置连接关闭问题在独立CLI报告落盘后显式退出，不改产品逻辑。合成会话与网络回放不冒充真实配对电脑、所有厂商或物理手机验收。

收尾检查：879处相关Markdown本地链接及diff检查通过；Release无调试回放类/路径，包含新原生帮助类和外链处理，资源信任公钥保持。校验器首次以中文原文查找压缩JS未命中，因构建转义Unicode，改按实际ASCII文案/错误码核验后通过，不属于运行时缺陷。已卸载独立5556的本任务测试包及AndroidTest包，并关闭该模拟器；仅用户5554仍在线。本轮没有安装或改动用户日常App，未提交推送或发布。
