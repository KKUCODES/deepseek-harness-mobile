# App 内更新

状态：2026-10-24，`0.1.0-preview.8/code10` 已公开预发布，[云端构建、签名及匿名下载核验](../releases.md#已核验范围)通过。维护：手机端维护者。实现：[KKC-77](https://linear.app/kkcodes/issue/KKC-77)；发布：[KKC-78](https://linear.app/kkcodes/issue/KKC-78)。从已发布的分块修复基线 `ea4878d` 开始，不包含独立插件适配分支，不修改DSH、插件或中转业务代码。

## 使用入口

- 普通聊天：侧边栏 → 设置 → 软件更新。
- Remote：连接选项 → 软件更新；未配对也可进入，不依赖电脑在线或管理权限。
- 启动/返回App时，原生服务按24小时检查一次，发现新版显示可关闭的提示；不阻塞聊天。手动检查不受每日间隔限制。
- 查看版本、更新内容和配套电脑插件版本，点击下载；展示实际字节进度，可取消或重新下载。两页面共用应用级任务，切换模式不重复下载。
- 更新说明默认折叠，展开时复用聊天的Markdown组件渲染标题、列表、粗体、代码、表格和链接，不执行原始HTML。关闭折叠时不挂载解析器；渲染失败不遮住下载/安装按钮。链接交给系统浏览器，不在App内加载外部页面。
- 版本号、当前版本和包大小合并展示，下载中只保留进度、关闭窗口不影响下载的短提示及取消；保留数据说明在准备安装时显示。GitHub发行页与手动再检查平时收进“更多”，失败时显示发行页按钮。配套插件版本未声明或与当前App基线相同时不重复提示，不代表已检测到电脑插件的实际安装版本。
- 下载完成后点击安装；首次由系统允许DSHM安装此来源，返回后需再次点击安装。系统窗口最终决定是否覆盖安装，不静默安装、不先卸载。
- 系统安装取消后仍可再次安装；进程结束会丢弃半份下载并提供重试，完整下载可恢复，但安装前仍重新校验。安装完成后清理旧更新缓存，聊天、Key和配对存储不迁移、不清空。

preview.7及更早公开版没有更新入口，首次使用需从发行页手动安装preview.8。后续可在App内检查更新。插件更新沿用DSH官方机制，此处只提示配套版本；本版继续配套0.1.87，不要求额外升级插件或中转。

## 来源和版本规则

固定仓库 `KKUCODES/deepseek-harness-mobile` 的匿名GitHub Releases列表；当前预览渠道包含预发布，正式渠道排除预发布，草稿不参与。按版本号比较，不能按发布时间、字符串或列表第一项判断；最终用Android整数versionCode拒绝同版及降级。列表支持ETag缓存，单次最多20条、JSON最多2MiB；清单最多256KiB，APK最多256MiB。

只选择同时提供 `compatibility.json` 和 `DSHM-<version>.apk` 的签名发行。核对清单与tag/文件名、包名、签名声明及整数版本；清单和APK的GitHub资产SHA-256必须存在。未来发行从 [ci/release.json](../../ci/release.json) 的 `requiredPluginVersion` 经原CI整理与签名作业进入 `compatibility.json`，不依靠正文猜版本。旧附件缺失该字段时不额外占位告警，保留更新内容与发行页入口，不编造配套版本。

同包名、同签名、同版本名和整数版本的发行保留说明供阅读，状态仍为“当前已是最新版本”，不显示新版本徽标。原生 `download()` 也拒绝同版或较低整数版本，不能通过直接调用桥绕过界面的无下载按钮状态。

校验失败按原因分别提示：版本列表/JSON格式、版本号/tag/发行页、包名缺失或不匹配、签名状态缺失或未签名、可安装状态、证书指纹、配套插件版本、内部版本号、附件缺失/重名/未上传/地址/大小/SHA-256。清单文件与APK的完整性错误分别显示；安装前另区分实际版本不符、非升级及调试包。未知故障不统一归为网络错误。选中的最新渠道版本缺少清单时报告缺少附件，不跳过后显示“已是最新”。

本地 `rc21test` 与公开发行 `officialtest` 是不同包名，检查公开Release时应明确显示“新版与当前 App 的包名不一致，不能覆盖安装”。这是独立安装身份的拒绝，修改Release正文无法解决；不得为测试绕过包名或签名检查。

下载完全由原生匿名客户端处理，不经过DSHM中转，不使用模型Key、设备凭据或GitHub Token。只接受固定仓库返回的精确资产URL，每一跳仅允许HTTPS及GitHub/CDN白名单，禁止跨到HTTP、其他主机或带用户信息/非443端口的URL；有超时、尺寸上限和用户取消。

## 安装与存储边界

[原生服务](../../android/app/src/main/java/dev/dshmobile/validation/AppUpdates.kt)、[下载器](../../android/app/src/main/java/dev/dshmobile/validation/AppUpdateHttp.kt)、[发行契约](../../android/app/src/main/java/dev/dshmobile/validation/AppUpdateRelease.kt)与[APK校验器](../../android/app/src/main/java/dev/dshmobile/validation/AppUpdateVerifier.kt)分别负责生命周期、传输、候选选择和安装前校验。

完整APK写入本应用私有缓存的独立目录。核对实际字节数及SHA-256，再用Android解析实际包名、版本名、versionCode、最低系统版本及当前签名证书集合；要求包名和当前签名一致、versionCode严格递增。当前不支持签名轮换或不同包名迁移。恢复后的ready状态不能跳过安装前复验。

[独立更新桥](../../android/app/src/main/java/dev/dshmobile/validation/AppUpdateBridge.kt)仅允许两个自有页面的主框架。检查、下载、安装等更新操作的参数必须为空，不接受网页指定的URL、清单、文件路径或安装包；仅独立 `updates.openLink` 导航操作接收一个HTTP(S)链接，沿普通聊天已有规则限制长度、拒绝凭据/其他协议后交给系统浏览器，不进入下载器或自有WebView。JS与原生分别检查，不依赖Markdown层的清理。只读[更新Provider](../../android/app/src/main/java/dev/dshmobile/validation/AppUpdateFileProvider.kt)只开放更新缓存目录，未导出，通过临时URI读授权交给系统安装器。原分享Provider、原普通/Remote桥及存储域保持。

Android的 `REQUEST_INSTALL_PACKAGES` 和来源设置仍由用户决定；系统Play Protect或厂商扫描也可能要求额外确认。App不关闭或绕过这些系统检查。依据：[Android安装来源权限](https://developer.android.com/reference/android/content/pm/PackageManager#canRequestPackageInstalls())、[来源设置](https://developer.android.com/reference/android/provider/Settings#ACTION_MANAGE_UNKNOWN_APP_SOURCES)、[签名信息](https://developer.android.com/reference/android/content/pm/SigningInfo)、[GitHub发行资产与摘要](https://docs.github.com/en/rest/releases/assets)。

## 验证

- [JS更新服务测试](../../tests/app-updates.test.mjs)：共享订阅、迟到响应、取消后的进度隔离、失败/重试、无Android桥及非法操作；另核对原生错误码均有中英文提示且不被替换成网络错误，链接导航不能为下载附加URL参数；完整540项Node测试通过。
- [真实页面检查](../../scripts/check-app-updates-web.mjs)：正式普通设置和Remote入口、启动提示、检查/下载/取消/重试/权限返回/校验失败；360px布局、浅深色截图检查，无页面异常。另验两个入口的Markdown标题/列表/粗体/表格/代码/链接、原始HTML与危险协议不执行、最新状态保留说明但不允许下载。此处仅回放原生状态，不冒充浏览器下载安装。
- 最新Debug包另在实际Android普通设置和未配对Remote中进入同一更新窗口，原生版本读取正常；真实原生桥拒绝携带任意URL的下载参数，未要求电脑管理权限，无页面异常。
- [原生专项](../../android/app/src/androidTest/java/dev/dshmobile/validation/AppUpdateChecks.kt)：预览/正式渠道、版本排序、清单/URL/摘要/大小/包名拒绝、同版本拒绝、半份恢复及无效缓存清理；实际独立Android设备运行通过。2026-10-24补充在用户授权的MuMu独立rc21test包上断言各类失败的精确错误码，普通/Remote正式页面均验证独立提示，不改其他App的数据。
- [覆盖安装驱动](../../scripts/verify-app-updates-android.mjs)：强制独立 `emulator-5556`、ranchu设备、目标包不存在；用本地原证书签名的临时测试基线（code8）连接真实GitHub，发现并下载公开preview.7（code9），真实取消/重试、SHA/实际签名和系统权限/安装取消通过。最终从系统安装窗口及Play Protect扫描确认后覆盖安装成功，同UID、首次安装时间、聊天正文和草稿均保持；使用安装后非调试的公开APK实际页面核对，不以 `adb install -r` 代替该更新入口。

最初的原生与覆盖安装测试在另建的无窗口Android API36环境执行，数据目录位于本项目忽略目录，当时未操作日常MuMu或原App。公网APK直连较慢，后续仅为该独立设备配置本机HTTP代理后重试成功；App中的TLS、摘要和签名校验保持，未添加镜像或中转代理。没有模型调用或真实Key写入，不据此宣称所有厂商、旧Android、弱网或后台生命周期已通过。

随后按用户要求安装到MuMu的独立 `rc21test`，与旧 `toolstyletest` 图标相同，已明确切到新版。修正提示后用实际普通设置→软件更新→检查更新连接真实GitHub，页面已显示“新版与当前 App 的包名不一致，不能覆盖安装”；保留该窗口供用户检查。证据：忽略目录 `artifacts/app-update-errors-mumu.png`、`app-update-errors-native-check.log`、`app-update-errors-native-build.log` 与 `app-update-web-check/report.json`。此处是ADB覆盖安装本地测试包后的真实检查入口，不计为新的系统更新安装验收。

用户进一步要求亲自体验完整流程：核对MuMu未安装正式 `officialtest` 后，以当前功能源码、原证书和正式包名生成临时 `preview.6/code8` 验收包（release、非调试），本地安装。版本通过构建参数覆盖，不修改 `ci/release.json`，不发布该临时包；旧 `rc21test/toolstyletest` 数据不清理。该包用于从真实GitHub更新到公开 `preview.7/code9`；用户的下载/来源设置/系统确认完成情况单独核对，不把验收包安装算作更新完成。目标公开版尚无更新功能，覆盖后更新入口会随之消失；用户已告知。

验收包构建、原证书签名与本地安装已完成，实际前台为 `officialtest`，真实更新检查已显示“发现新版本 DSHM 0.1.0-preview.7”和10.6MB下载按钮。留在此页面，由用户自行下载、授予安装来源并确认系统安装；尚未代替用户执行这几步。证据：`artifacts/app-update-walkthrough-build.log`、`app-update-test-signature.txt`、`app-update-walkthrough-ui.xml`、`app-update-walkthrough-ready.png`（均忽略，不发布）。

随后核对MuMu已经安装公开 `preview.7/code9`。本轮说明排版与短文案本地包保持该包名、原证书和code9覆盖，未降级或执行卸载/清数据；后一次覆盖前后安装身份、版本与首次安装时间相同，记录在 `app-update-richtext-reinstall-{before,after}.txt`。此前首次身份采集无输出造成驱动断言失败，不据此断言用户历史数据连续性已验；失败与后续成功检查分开记录。

最新同签名非调试包在真实普通设置→软件更新→检查更新中读取GitHub本版说明，显示“当前已是最新版本”，展开后标题/项目列表按Markdown渲染；实际点击说明中的电脑插件链接进入系统Chromium，随后返回本App，保留说明展开页面供用户查看。证据：`artifacts/app-update-richtext-mumu-notes-final.png`、`app-update-richtext-mumu-notes.xml`、`app-update-richtext-link-activity.txt`。`app-update-richtext-native-check.log`通过原生安全与同版直接下载拒绝专项；`app-update-richtext-native-entries.json`验证普通/未配对Remote两入口的下载URL和危险链接拒绝；浏览器回放与真实Android验证分开。

本轮驱动先遇到Android36将userId字段改为appId，以及系统扫描尚未确认时过早断言版本；失败报告保留，修正等待与身份解析后另用实际系统状态及页面核验。当前源码的中断恢复改动随后经原生专项独立复验。

验收后已移除独立设备上的三个测试包、该设备的临时系统代理和调试转发，并关闭本轮无窗口模拟器；未清理或覆盖日常模拟器的数据。

本机证据在忽略目录 `artifacts/app-update-*`：Web截图与报告、原生专项构建/lint日志、`app-update-native-check/cover-install-verification.json` 及安装后页面/XML；临时签名基线与凭据不提交、不发布。正式版仍沿原受控签名流水线，测试构建不会覆盖公开Release。

## 复验入口

在本仓库执行 `npm test`、`npm run build:web:ci` 和 `node scripts/check-app-updates-web.mjs`。原生专项先按[开发入口](../development.md)构建当前rc.2自有Debug与AndroidTest包，再在专用设备执行 `am instrument -w -e updatesOnly true dev.dshmobile.validation.rc21test.test/dev.dshmobile.validation.OrdinarySecurityInstrumentation`；`updatesOnly`不连接模型或修改用户凭据。

覆盖安装驱动仅供维护者在已登记的空白独立设备上执行，需先准备 `artifacts/app-update-test-feature.apk`：与公开发行同证书、同包名、较低整数版本、包含本功能的临时可调试基线，不得发布。设置 `DSHM_UPDATE_TEST_SERIAL=emulator-5556` 后运行 `node scripts/verify-app-updates-android.mjs`；系统窗口必须实际确认，驱动不会以ADB直接安装新版。最终可用 `--verify-installed` 独立检查版本/UID/首次安装时间及系统可访问的实际聊天页面，失败记录与成功记录分别保留。
