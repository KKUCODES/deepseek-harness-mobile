# DSHM 开发指南

本页说明手机端的环境、构建和检查入口。命令在注明的目录执行；普通旧基线与官方候选使用不同资源和包名，需先选择目标版本。

[返回项目首页](../README.md) · [使用指南](./usage.md) · [知识库总目录](./project-knowledge/catalog.md)

公开自动构建从[GitHub Actions 与下载说明](./releases.md)进入；下文保留原本地候选环境的构建方法。CI 自动安装锁定的已发布 SDK 和固定只读源码，不需要准备本机验收材料。

## 环境准备

| 工具 | 当前工程使用的版本 |
| --- | --- |
| Node.js | 24 |
| JDK | 17 |
| Android SDK | 35；最低运行版本 Android 9（API 28） |
| Gradle | 8.9，由工程 wrapper 提供 |
| Android Gradle Plugin | 8.7.3 |
| Kotlin | 1.9.24 |

在当前进程配置 `JAVA_HOME` 与 `ANDROID_HOME`，分别指向本机 JDK 和 Android SDK。Android 调试另外需要 SDK 中的 ADB。下文 Android 命令采用 Windows PowerShell 写法。

在本仓库根目录安装依赖：

```powershell
npm ci --ignore-scripts --legacy-peer-deps
```

当前目录布局如下，尚未完成独立克隆环境的一键准备：

```text
dsh-mobile/                  项目集合
├── dsh-mobile/              本仓库：手机端
├── deepseek-harness/        只读上游参考
├── plugin/                  电脑插件与固定版本 SDK 材料
└── backend/                 中转与共享协议
```

## 构建当前官方候选

已通过本地验收的 Remote 组合为官方 DSH `0.2.1-alpha.2`、插件 `0.1.80-latest.0` 和配套 Android 候选。构建前需要已经准备以下固定版本材料：

| 位置，相对本仓库 | 用途 |
| --- | --- |
| `artifacts/official-alpha2-source/` | 只读官方源码，固定 commit `d743267388641bc76f17c45ce8b4c231aed1d32c`。 |
| `artifacts/official-alpha2-mobile-runtime/` | 独立手机 SDK 依赖。 |
| `../plugin/artifacts/official-alpha2-sdk/` | 配套插件 SDK 依赖。 |
| `../plugin/artifacts/official-dsh-alpha2/` | 官方发布包及可用的 SDK 依赖。 |

这些本机材料不随 Git 分发，`npm ci` 不会替你补齐；本页记录已有候选环境的构建入口。材料与版本来源见[接口和构建入口审查](https://github.com/KKUCODES/dshm-plugin/blob/main/compatibility/latest-upstream/official-interface-audit.md#开发入口的版本边界)。只构建 DSHM，不修改或重新构建电脑 DSH、SDK 或 Electron。

在本仓库根目录构建页面：

```powershell
npm run build:web:official
```

输出为 `artifacts/official-alpha2-mobile-dist/`。接着在 `android/` 执行：

```powershell
.\gradlew.bat :app:assembleDebug :app:lintDebug -PlatestCompatibilityTest=true -PofficialPluginOnlyTest=true -PofficialDshVersion=0.2.1-alpha.2
```

APK 输出为 `artifacts/official-alpha2-android-build/outputs/apk/debug/app-debug.apk`，相对路径从本仓库根目录计算。候选包名为 `dev.dshmobile.validation.officialtest`，与原 App 独立存储；不能为了验收清除用户数据或覆盖日常 App。

源码未变化时复用已有候选。生成新包不等于已经通过兼容验收；版本、安装和真实结果从[当前兼容结论](https://github.com/KKUCODES/dshm-plugin/blob/main/compatibility/latest-upstream/official-support.md)进入。

## 旧基线与浏览器诊断

默认 `npm run build:web` 仍使用旧 `0.1.6-alpha.2` 基线，依赖相邻 `../deepseek-harness` 检出，输出 `dist/`。它不生成上面的官方 alpha.2 候选。

在本仓库根目录运行：

```powershell
npm run build:web
npm run serve
```

| 本地地址 | 用途 |
| --- | --- |
| `http://127.0.0.1:4399/mobile.html` | 普通聊天页面的浏览器入口。 |
| `http://127.0.0.1:4399/` | 插件与流协议诊断页。 |

浏览器没有 Android 原生桥，不能用它完成 Key 配置、真实模型请求或 Android 系统操作。`npm run serve` 固定读取 `dist/`，不能据此宣称正在查看官方候选资源。

旧基线 Android 构建在 `android/` 执行：

```powershell
.\gradlew.bat :app:assembleDebug :app:lintDebug
```

输出 `android/app/build/outputs/apk/debug/app-debug.apk`，包名 `dev.dshmobile.validation`。不要将此包当作当前官方候选的验收产物。

## Android 启动图标

当前图标来自用户确认的[第四版 Logo](./images/brand/README.md)，应用清单同时设置 `android:icon` 和 `android:roundIcon`。`mipmap-anydpi-v26/` 提供自适应图标，白色背景与 `drawable-nodpi/ic_launcher_foreground.png` 分层；五档密度的 PNG 用于传统入口。原图与来源说明保存在 `docs/images/brand/`。

替换图标后只需按所选官方候选重新执行 Android 构建与 lint，沿用对应 Web 产物、包名和签名。不为图标更新修改或重建 DSH，不清理 App 数据。打包后核对清单中的图标引用与 APK 内实际资源。

2026-10-13 的第四版图标包已通过 `assembleDebug`、`lintDebug`、签名和包内资源核对，168 个 Web 文件与原包一致；本轮未安装到设备或重跑模型与 Remote 全链路。APK 属于当前官方 alpha.2 的调试候选，不代表应用商店发行包。

## 测试和测量

在本仓库根目录执行默认测试：

```powershell
npm test
```

`npm run verify:web` 回归旧基线诊断页，使用本机 Microsoft Edge 和临时本地端口。它只证明相应页面回归，不代替正式 Android 或官方 Remote 验收。

设置 `DSHM_ANDROID_SERIAL` 后，部分旧基线脚本会通过 ADB 操作 `dev.dshmobile.validation`，强制结束并重启 App。先用 `adb devices` 核对设备及脚本的目标包名，再执行；不要把旧脚本的结果沿用为 `.officialtest` 验收。

| 需要检查的内容 | 入口与边界 |
| --- | --- |
| 普通聊天真实 API | `node scripts/verify-product-android.mjs` 需要 `DSHM_ANDROID_SERIAL` 和 `DSHM_RUN_LIVE=1`；使用设备内 Key 发送专用消息，会产生模型费用并重启目标 App，不属于默认测试。 |
| 自定义供应商（preview.5 起） | `tests/ordinary-providers.test.mjs` 覆盖数据兼容；`OrdinarySecurityInstrumentation` 的 `providersOnly=true` 覆盖原生目录和凭据；`scripts/verify-ordinary-providers-android.mjs` 操作隔离 `.toolstyletest` 的实际页面，范围见[模型服务验收](./integration/ordinary-providers-current.md)。 |
| 普通聊天页面性能 | `node scripts/measure-page.mjs --product` 使用隔离 Edge；`node scripts/measure-product-android.mjs` 使用指定 Android 设备。串行运行，页面耗时与模型网络耗时分别记录。 |
| 诊断页对照测量 | `npm run measure:page` 和 `node scripts/measure-android-page.mjs`；属于诊断页，不能替代产品页面结果。 |
| 旧基线软键盘诊断 | `node scripts/diagnose-ime.mjs` 对比 WebView 与原生输入框，会重启目标 App；历史环境问题见[诊断记录](./plugin-validation/results.md#真实软键盘环境诊断)。 |
| 当前官方 Remote | [官方组合验收](./integration/official-plugin-only.md)及[完整功能矩阵](https://github.com/KKUCODES/dshm-plugin/blob/main/compatibility/latest-upstream/official-feature-matrix.md)，按各专项核对目标版本与隔离环境。 |
| 文档链接 | 在相邻 `../backend/` 运行 `node scripts/check-docs.mjs`，检查整个项目集合的 Markdown 本地链接。 |

性能结果需要注明浏览器、模拟器或物理手机环境，不能把 MuMu 结果写成真机结果。既有测量和未覆盖范围见[普通聊天记录](./integration/ordinary-current.md)与[Remote 性能记录](./integration/performance-current.md)。

供应商专项使用 `'-PremoteToolLayoutTest=true'` 及上面的官方候选参数构建独立 `.toolstyletest`，另构建 `:app:assembleDebugAndroidTest`；不安装到日常 App。实际页面脚本当前锁定本机 MuMu serial `127.0.0.1:16384`，执行前须核对设备、包名与隔离范围。需设置 `DSHM_ANDROID_SERIAL`、`DSHM_ADB_PATH`；可选 `DSHM_DEEPSEEK_TEST_KEY_FILE` / `DSHM_GLM_TEST_KEY_FILE` 指向本人授权的外部测试凭据文件，分别只发送到 DeepSeek / 智谱官方地址，产生 API 费用。DeepSeek 文件可只含 Key；包含标签时分别使用 `deepseek: <Key>` / `glm: <Key>`，两者可以共用一个含两行标签的文件，不要纳入仓库。未提供真实凭据时只用一次性无效 Key 验证官方 401，不宣称真实模型通过；`--check-glm-form` 可额外用假 Key 检查通用表单的智谱配置，不发 GLM 请求。脚本结束移除专用供应商、Key 和聊天，并核对原记录及原 Key 配置状态。

## 仓库与依赖

本目录是独立 Git 仓库，默认分支为 `main`；电脑插件属于相邻的独立仓库，公网后端也位于本仓库之外。现阶段相邻依赖和部分文档链接仍按项目集合布局维护。

仓库保存手机源码、Android 工程、Gradle wrapper、依赖锁文件、测试与夹具，以及文档。依赖目录、APK、构建输出、下载工具、联调数据、环境配置和本机签名文件不纳入版本管理。

验收文档中的截图、日志和安装包属于本机证据，不随仓库分发；在新环境需重新生成。现有文档保留不同日期和版本的历史结果，当前支持以[固定组合结论](https://github.com/KKUCODES/dshm-plugin/blob/main/compatibility/latest-upstream/official-support.md)为准，旧补丁报告不作为当前兼容依据。

架构和专项资料从[知识库总目录](./project-knowledge/catalog.md)查找，具体模块入口见[模块地图](./project-knowledge/blueprint/module-map.md)。

## 维护依据

本页由 DSHM 手机端维护者维护，核对日期为 2026-10-13。命令与环境来源：[package.json](../package.json)、[Web 构建](../scripts/build-web.mjs)、[候选 SDK 选择](../scripts/latest-mobile-build.mjs)、[本地服务器](../scripts/serve.mjs)、[Android 工程](../android/app/build.gradle.kts)与[Gradle wrapper](../android/gradle/wrapper/gradle-wrapper.properties)。2026-10-10 的文档整理仅静态核对命令；2026-10-13 的启动图标与 APK 验证范围见上方对应说明，不代替产品全链路验收。
