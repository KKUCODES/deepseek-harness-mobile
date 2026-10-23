# 完整页面资源热更新

- 状态：从干净main独立实现，本地页面、Android专项和两入口验收通过；正在发布preview.10/code12。preview.9及更早版本不包含加载器，需要先升级APK。[发布任务 KKC-83](https://linear.app/kkcodes/issue/KKC-83)。
- 维护：DSHM手机端维护者；最近核验：2026-10-24。
- [实现任务 KKC-82](https://linear.app/kkcodes/issue/KKC-82)；[已确认方案 KKC-81](https://linear.app/kkcodes/issue/KKC-81)。DSH、电脑插件、中转与旧插件适配分支不修改。

## 使用与边界

普通设置与Remote连接选项共用「软件更新」，增加「页面资源」：检查、下载、进度、取消、错误、待生效和恢复内置页面。应用启动/返回前台时每天检查一次；资源包与APK分别检查，下载不经过Remote中转，也不使用模型Key、电脑凭据或GitHub Token。Markdown说明沿用既有渲染器，链接走原受限外部浏览器入口。

完整资源包包含普通聊天、Remote及其随包客户端依赖。首版不做文件增量；不变的清单从本地摘要缓存读取，已接受的序号不会重复下载。下载、校验、解压均在原生工作线程完成，页面不传入地址、清单或文件路径。

完成下载只登记pending，当前页面继续使用旧资源。「下次完整启动」指Application进程重新创建；切换模式、重新创建Activity、返回前台和页面reload不算。一个进程的所有WebView固定同一资源目录；活动资源缺少文件时返回404，不从APK逐文件补齐，避免混合两版代码。

适用范围是兼容当前桥接口和存储结构的HTML、JS、CSS、图片、字体、JSON与Wasm资源。Kotlin、权限、通知、文件原生能力、桥接口或不兼容存储迁移仍升级APK。首版拒绝不同SDK或配套插件要求，不替代DSH或电脑插件升级。

## 信任和兼容

[Node打包/签名工具](../../scripts/web-update-package.mjs)与[Android校验器](../../android/app/src/main/java/dev/dshmobile/validation/WebResourceManifest.kt)使用标准P-256 ECDSA＋SHA-256，签名为DER，公钥为SPKI。签确切UTF-8清单字节，外层只携带 `keyId`、base64的 `payload` 和 `signature`，不依赖跨语言JSON重排。依据：[Android Signature](https://developer.android.com/reference/java/security/Signature)、[Node crypto](https://nodejs.org/api/crypto.html#signsignprivatekey-outputencoding)。

APK内置[资源信任公钥](../../android/app/src/main/assets/web-update-trust.json)，签名私钥独立于APK签名。不能通过更新包自身提供新的受信任公钥；更换信任根需先升级APK。本地私钥保存在忽略目录 `.tools/signing/web-resource-updates-private.pem`，工作副本在 `artifacts/web-update-signing/private.pem`；二者均不进入源码，不输出内容。用户已授权并已配置指定仓库独立 `WEB_RESOURCE_SIGNING_KEY_BASE64` Actions Secret，与APK公钥对应；原APK签名凭据不变。

签名清单约束包名、preview渠道、严格递增的资源序号、APK整数版本范围、桥版本1、数据版本1、SDK版本及配套插件要求；还包含压缩包名/大小/SHA-256和完整逐文件清单。校验签名后才解释清单并下载。最高已接受序号持久化：故障回退或手动恢复后不自动重新安装同一序号，修复应发布更高序号。

清单上限2MiB、压缩包64MiB、解压后128MiB/4096文件。仅接受预定扩展名和相对路径，拒绝绝对路径、反斜线、空段、`.`/`..`、百分号路径编码、重复或大小写冲突、未列出/缺失/超长文件及逐文件摘要不符。安全解压在staging目录，完整验证后同盘重命名并用AtomicFile登记；取消或写入失败不替换活动包。下载前检查空间，开始新进程时清理未完成下载和无引用的受控资源目录。

## 资源选择、数据与回退

[资源存储](../../android/app/src/main/java/dev/dshmobile/validation/WebResourceStore.kt)仅管理 `noBackupFilesDir/web-updates`，与聊天IndexedDB、普通Key、设备Keystore和Remote配对域分开。来源地址继续使用原普通聊天和Remote两个HTTPS域；原生桥主框架与精确入口校验、CSP、HTML预览沙箱都保持，热更新不清缓存或迁移聊天结构。

进程开始时重新验证签名、兼容性和磁盘文件；符合要求的pending一次性成为活动包。普通与Remote分别通过现有启动封面、原生消息和首帧屏障确认本地页面就绪，不等待模型、配对或电脑联网。两入口都就绪的包才可作为下一版的已知良好回退点；未访问Remote本身不算失败。

页面开始加载前记录启动未完成标志，首帧后清除。加载失败、启动超时或Renderer退出安排回退；进程在首帧确认前被杀也会保守回退。因此用户在首次加载期间主动结束进程，也可能触发恢复。当前进程不强行切换资源或终止其他会话，下次完整启动回到上一已知良好包，否则使用APK内置页面。

启动封面始终有原生「恢复内置页面」按钮，不依赖JS正常运行。软件更新内也有同一入口，原生确认后登记恢复并退出本App，重新打开使用内置页面；不自动重新安装已停用序号。该恢复不是恢复出厂设置，不清聊天、Key、配对或设备身份。

## 发布与构建

[单独工作流](../../.github/workflows/web-resources.yml)手动构建固定官方SDK的完整资源包；签名作业只在受信任main运行，不检出或执行项目依赖，使用Node内置crypto和独立Secret。普通APK流水线继续使用原签名。发布前验证资源序号递增，先上传不可变序号ZIP，再发布签名清单。

资源使用同仓库固定 `web-preview` Release及 `web-update.json`，压缩包为 `dshm-web-r<序号>.zip`。它不符合旧APK更新器的 `v<版本>` 格式，也不会每次创建新Release挤占旧端20条列表窗口。替换GitHub清单附件的短暂间隙可能检查失败，保留旧包并可重试。本次先发布加载器APK，并验证资源云端构建与签名，不创建公开资源Release或投放重复资源包。

本地打包命令参数：`node scripts/web-update-package.mjs pack --source <Web输出目录> --output <新输出目录> --private <本地私钥文件> --revision <递增序号> --min-apk <最小versionCode> --max-apk <最大versionCode> --application-id <目标包名> --notes <更新说明>`。目录不得已有同名输出。生产用公开包名，实际兼容范围必须以包含加载器且已验收的APK为准；测试包名不能投放给公开App。`pack-unsigned`用于无私钥构建。

## 验证结果

| 范围 | 入口与结果 |
| --- | --- |
| Node与旧功能 | `node --test tests/*.test.mjs`：545项通过；签名篡改/未知密钥、完整包摘要、路径策略、桥参数拒绝及中英文错误覆盖 |
| 两个实际页面 | `node scripts/check-web-resource-updates-web.mjs`：普通设置/未配对Remote入口、进度/取消、待启动不冒充启用、签名拒绝、说明渲染、回退提示及恢复入口通过；360px无横向溢出，属于原生状态回放 |
| Android互通与存储状态机 | `-e webUpdatesOnly true`：Node生成的真实ECDSA签名由Android验证，包/桥/数据/SDK/插件不兼容拒绝，路径攻击、摘要错误、取消、不即时启用、下一进程切换、启动失败/未确认退出回退、旧序号拒绝和APK底座变化通过 |
| Android真实入口 | `DSHM_WEB_UPDATE_TEST_SERIAL=emulator-5556 node scripts/verify-web-resource-updates-android.mjs`：完整签名r1经原生下载器/校验/解压登记，重启后两来源同进程加载r1；r2故意启动失败、原生恢复入口可见、再启动自动回到r1；原生确认恢复到APK资源通过 |
| 数据保留 | 原实际聊天界面在更新、故障回退及恢复内置页面后都显示合成历史和草稿；原生比较测试普通Key、Remote加密令牌存储和设备指纹/配对域标记均保留。没有真实模型调用或电脑配对授权，不冒充真实已批准设备的联网验收 |
| 构建 | 官方rc.2手机页面、独立Debug/AndroidTest APK、Android lint通过；工作流YAML语法检查通过；主APK的167个Web文件与构建逐字节一致，公钥存在，测试包和私钥未进入主APK，本地签名备份对应公钥 |

Android环境为独立无窗口API36设备、`.rc21test` UID，未操作用户MuMu或日常App。测试的Release响应由OkHttp拦截器回放；URL白名单、真实签名、大小/摘要、解压和加载器保持生产实现。实际验证了下载截断失败保留旧包、取消后重试、后续进程切换及故意启动失败；不是公网资源Release或GitHub云端签名验收。物理磁盘耗尽、真实已配对电脑及所有Android/厂商仍未全量实测。

复验前运行 `node scripts/generate-web-update-fixtures.mjs`（生成独立测试签名，不保存测试私钥）、`node scripts/generate-web-update-live-fixtures.mjs`（使用本地资源签名密钥为独立测试UID签名），再构建AndroidTest包。驱动只接受指定ranchu设备，不能指向日常MuMu；需要空白专用UID，避免覆盖未知Key。测试APK中的资源回放不进入生产APK。实际报告在忽略目录 `artifacts/web-update-tests/`，包括Node、页面截图、Android构建/lint、`native-check-final.log`、`android/report.json`及数据保留检查。

初次Gradle wrapper网络失败、PowerShell参数未加引号、旧APK误跑默认专项、Android36先于应用代码拒绝ZIP路径的失败均保留，不计通过；修正驱动/错误归类后重建并复验。额外旧全屏动效专项的既存偶发问题沿[返回修复记录](./remote-back-diagnosis.md)保留，不计此次通过。
