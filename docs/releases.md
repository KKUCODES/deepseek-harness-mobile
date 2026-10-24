# APK 构建、签名与下载

[返回首页](../README.md) · [使用指南](./usage.md)

## 下载并安装

直接下载 [DSHM 0.1.0-preview.11 APK](https://github.com/KKUCODES/deepseek-harness-mobile/releases/download/v0.1.0-preview.11/DSHM-0.1.0-preview.11.apk)，Android 9 及以上可安装。[公开发行页](https://github.com/KKUCODES/deepseek-harness-mobile/releases/tag/v0.1.0-preview.11)另附 `SHA256SUMS.txt`、`signature.txt` 与 `compatibility.json`，无需登录 GitHub。

也可打开 [Build Android APK](https://github.com/KKUCODES/deepseek-harness-mobile/actions/workflows/android-build.yml)，在成功构建的 Artifacts 下载 `dshm-signed-apk`。Actions 下载需要登录 GitHub，产物保留 30 天。`dshm-unsigned-apk` 是构建检查产物，不能直接安装。

当前是开发预览，沿用 `dev.dshmobile.validation.officialtest` 包名与原候选证书，可覆盖 preview.1–preview.10及本地preview.11-dev/code13。不要卸载旧版来更新，以免删除本地数据。preview.8起可在App内检查新版；更早的公开版没有更新入口，请手动下载本版覆盖安装。普通聊天使用你自己的供应商 API Key；Remote 核心连接已验官方 DSH `0.2.0-rc.2` / `0.2.1-alpha.2` / `0.2.1-rc.2`，配套电脑插件仍为 `0.1.87-latest.0`；本版不要求额外升级插件或中转。此前大响应分块仍要求中转包含提交 `94183d0`。

## 自动构建与发布

`0.1.0-preview.11`（versionCode 14）加入[统一更新界面与一键重启](./integration/unified-updates-current.md)：资源下载后保存草稿并自动重启，恢复内置页也无需系统强停。保留[签名资源加载器](./integration/web-resource-updates-current.md)、返回手势与此前能力。身份与签名保持，历史发行及附件不覆盖。本次只发布APK，不投放r2。

- `main` 的相关源码、构建或依赖变更自动构建并签名，不自动发布每次提交。
- 指向 `main` 的 PR 只构建无签名包，签名作业不运行。
- 手动选择 `main` → Run workflow 可生成签名包；勾选 `publish_release` 发布公开开发预览。
- 推送对应 `v<version>` 标签时，版本校验、构建、签名成功后发布预览。
- 发新版本前同步修改 [ci/release.json](../ci/release.json) 中的版本并递增 `versionCode`，提供 `ci/release-notes/<version>.md` 中英文发行说明，更新两份 README 的直接下载链接。发行作业按固定提交读取该文件；已存在的 Release 不覆盖，重新发版应使用新版本号。
- 修改工作流的发版提交须先进入 `main`，再发布版本标签。目标提交相对默认分支仍有工作流差异时，GitHub 会要求额外的工作流写权限，原 `GITHUB_TOKEN` 无法取得；此时同步主分支后仅重跑失败的发行作业，复用已有签名产物。[GitHub 发行权限说明](https://docs.github.com/en/rest/releases/releases#create-a-release)

## 签名凭据

指定仓库 `KKUCODES/deepseek-harness-mobile` 的 Settings → Secrets and variables → Actions 中配置四个 **Secrets**，不使用普通 Variables：

| Secret | 内容 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | 签名文件的 Base64 编码；Base64 只是编码，保密由 Secrets 提供。 |
| `ANDROID_STORE_PASSWORD` | 签名文件密码。 |
| `ANDROID_KEY_PASSWORD` | 私钥密码。 |
| `ANDROID_KEY_ALIAS` | 私钥别名。 |

构建作业不读取签名 Secrets。独立签名作业只在本仓库受信任的 `main` 或版本标签上运行，不检出项目源码或安装项目依赖；私钥仅在签名步骤写入临时文件，步骤结束删除，不输出到日志或下载附件。它使用官方 `zipalign`、`apksigner` 校验签名，核对证书摘要、包身份和版本，失败即停止，不回退到随机签名。

当前沿用本地测试候选的证书，公开摘要写入 `ci/release.json`；保持本地私钥备份。Secrets 不代替备份。后续应用商店身份、签名迁移和完整真机验收另行处理。

页面资源使用单独的 `WEB_RESOURCE_SIGNING_KEY_BASE64` Secret和APK内置公钥，已获用户授权配置；不复用APK签名私钥。资源工作流独立构建及签名，可选择发布至 `web-preview`；目前仅有适配code12的r1，本次不触发资源工作流、不投放r2。

## 构建来源与边界

GitHub 托管的 Ubuntu 24.04 + Node.js 24 + JDK 17 + Android SDK 35。只读官方源码固定于 `687f282e8625c6b8d11ff58211a90524be2e4317`；官方 SDK 从本仓库锁文件安装，共享协议来自固定的中转仓库提交。不修改或构建 DSH 本体、SDK 或 Electron。

Web 与 Gradle 的 `ciBuild` 产物独立放在 `artifacts/ci/`，默认本地入口保持。签名和可安装性核验不代表完整模型、真机或公网功能复验。

维护来源：[工作流](../.github/workflows/android-build.yml)、[版本与证书](../ci/release.json)、[SDK 准备](../scripts/prepare-ci.mjs)、[无签名产物整理](../scripts/ci-package.mjs)、[Android 构建规则](../android/app/build.gradle.kts)。

## 已核验范围

2026-10-24的[Actions40061714169](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/40061714169)完成preview.11/code14构建、lint、原证书签名和公开发布，源码固定`dbd1e4ec420da404f0eb84efed6fb972818c118d`。同一签名产物直接进入[Release](https://github.com/KKUCODES/deepseek-harness-mobile/releases/tag/v0.1.0-preview.11)，APK及三个附件均实际匿名下载，字节与SHA-256匹配公开资产和校验文件。APK11,200,676字节，SHA-256 `0313772d4784f41f01c4746813b464d884ca79d1bf2ca27e74444e8efe77ed8e`。本机apksigner/aapt复核原证书、原包名、code14、最低Android9和非调试属性；包内资源公钥保持，原生重启及页面操作存在，Debug资源回放类/路径与私钥未包含。code14支持覆盖本地code13候选。本次未安装或操控用户模拟器，不将发行核验视为新增真机/公网Remote复验；550项Node及双页面、Android真实重启和数据保留证据见[专题](./integration/unified-updates-current.md)。公共web-preview两个r1资产ID、大小及摘要与发布前一致，未触发资源工作流、未发布r2。插件0.1.87保持，不改DSH/插件/中转，旧插件适配分支不在祖先链。证据在忽略目录`artifacts/unified-release/public-verification.json`。[发布任务](https://linear.app/kkcodes/issue/KKC-86)。

2026-10-24的[Actions40009039704](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/40009039704)完成preview.10/code12构建、lint与原证书签名，固定源码 `8d8d152aa8896335813e89e67e671a9d9a6dd504`。发行作业两次返回403；已通过获授权账号创建对应版本标签、上传同一CI签名产物并公开[Release](https://github.com/KKUCODES/deepseek-harness-mobile/releases/tag/v0.1.0-preview.10)，没有重新构建，不能将该Actions整体描述为成功。APK及三个附件均匿名下载，字节与SHA-256匹配资产及校验文件；APK11,188,388字节，SHA-256 `1e42e749c2119ab5c8fd0aec119e55f4294bff2279c80cc719833b822c54e3d3`。本机apksigner/aapt核对原证书、原包名、code12、最低Android9、非调试及APK内置资源公钥。配套插件保持0.1.87，不改DSH或中转，未混入插件适配分支。

[资源工作流40009515878](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/40009515878)完成独立构建与Secret签名，未公开资源包；下载产物验证P-256签名、ZIP和167个文件摘要，APK内置公钥匹配。与APK对照166个文件字节一致，SDK版本清单仅键顺序不同。545项本地Node、双入口页面和Android真实加载/回退证据及公网/真机限制见[专题](./integration/web-resource-updates-current.md)。本轮公开下载验证未安装用户日常App。证据位于 `artifacts/web-resource-release/public-verification.json` 和 `cloud-resource-verification.json`。[发布任务](https://linear.app/kkcodes/issue/KKC-83)。

2026-10-24 的[Actions](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/40002662780)完成preview.9/code11构建、lint、原证书签名及公开发布，源码固定 `8a44e5bfd4f8c61bb5bfe4022d58785a26f76ce5`，共享协议提交保持。签名产物直接进入[Release](https://github.com/KKUCODES/deepseek-harness-mobile/releases/tag/v0.1.0-preview.9)，未二次打包；APK和三个校验附件均匿名下载，字节及SHA-256与GitHub资产、校验文件一致。APK为11,147,354字节，SHA-256 `2f0d11acc48267cd7361f5b39ed2b3d2f3d613408f9ef59bf178b9ebba78603f`。本机apksigner/aapt复核原证书、原包名、code11、最低Android9及非调试属性。配套插件仍为0.1.87，插件及中转不需额外升级；未混入旧插件适配分支。返回修复的rc.2/alpha.2回放、Android16原生事件及已知动效检查限制见[专题](./integration/remote-back-diagnosis.md)；发行下载核验不扩大为真实配对/真机完整验收。首次误选旧提交的调度40002614467已取消，不计本版结果。证据在本机忽略目录 `artifacts/back-release/public-verification.json`。[发布任务](https://linear.app/kkcodes/issue/KKC-80)。

2026-10-24 的[Actions](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/39994715181)完成preview.8构建、lint、原证书签名及公开发布，源码固定 `07b98321fd42f81e4f5b138e05bf4efc1e057806`、共享协议固定 `94183d08ccbb8752d14c819608d79fe3870a9a60`。同一次签名产物直接进入[Release](https://github.com/KKUCODES/deepseek-harness-mobile/releases/tag/v0.1.0-preview.8)，未二次打包；APK及3个附件均实际匿名下载，字节和SHA-256与GitHub资产、校验文件一致。APK为11,147,354字节，SHA-256 `60f64e05e18d2e7a6b7ec4dca0ae1c1b2bd9741bc19053c3bfd513f10e5f8f14`。本机apksigner/aapt复核原证书、原包名、code10、最低Android9及非调试属性；版本附件声明配套插件0.1.87。本地540项Node、双入口页面/原生更新及同签名覆盖安装验收见[更新专题](./integration/app-updates-current.md)，本轮公开APK的下载/签名核验不冒充完整真机、模型或Remote复验。证据在本机忽略目录 `artifacts/updates-release/public-verification.json`。[发布任务](https://linear.app/kkcodes/issue/KKC-78)。

2026-10-23 的[Actions](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/39971214827)完成 preview.7 构建、lint、原证书签名及包身份检查，源码固定 `dc8ae2108a315ee8bfe020e96ee9c06e40e0e9ae`、共享协议固定 `94183d08ccbb8752d14c819608d79fe3870a9a60`。复用该次成功产物公开[Release](https://github.com/KKUCODES/deepseek-harness-mobile/releases/tag/v0.1.0-preview.7)，没有二次打包。APK 与三个校验附件已匿名下载并核对 GitHub 摘要；APK 为 11,094,050 字节，SHA-256 `0b675c3d59aae12e4b7561f46e2583b5925b6b784780e51799f2ffde40a1887b`。本机 apksigner/aapt 复核原证书、原包名、code9、Android9 与非调试属性。配套插件0.1.87；公共中转后续已升级并完成2.60MB分块、重连和旧端通信核验，见[公网升级记录](https://github.com/KKUCODES/dshm-relay/blob/main/deploy/public-server.md)。实现与本地 Android 验证见[分块专题](./integration/remote-response-chunks.md)，发行及合成公网传输核验不扩大为真机或完整DSH/Android公网验收。匿名记录位于本机忽略目录 `artifacts/chunks-release/mobile/public-verification.json`。

2026-10-23 的[Actions](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/39935697926)完成 preview.6 构建、lint、独立签名及身份检查，源码固定 `0a334e8004279279ba6ff0915831d23d57c52dcd`。复用该次签名产物创建并公开[Release](https://github.com/KKUCODES/deepseek-harness-mobile/releases/tag/v0.1.0-preview.6)，没有再次打包。APK及三个校验附件均已匿名下载200，摘要与Actions产物、GitHub资产一致；APK为11,089,954字节，SHA-256 `6046e6a183e8d859522fa0367ae079bfd50ee8e1305587874c46b83714ce67e6`。本机apksigner复核原证书，aapt核对原包名、code8、Android9和非调试包。配套插件0.1.86，两端需同时更新；[核心功能验收边界](./integration/dsh-rc21-compatibility.md)保持，发行核验不替代完整Electron/真机/模型测试。本机下载记录在忽略目录 `artifacts/release-tools/mobile/public-verification.json`。

2026-10-16 的[版本发布 Actions](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/38859168543)已完成 `0.1.0-preview.5` 构建、lint、签名和公开发布，固定源码为 `a1dc8a0878dfe0f61efdc39e27b6e4dac1ca4b6e`，共享协议固定提交保持。APK 与三个校验附件均已匿名下载，APK 为 11,057,186 字节，SHA-256 `60b005439111df6e238857f0c07876d9a629e7250a88ba284a61e0b8819f64e4`，与 GitHub 资产摘要和校验文件一致。本机 `apksigner` 复核原证书，`aapt` 核对原包名、versionCode7、最低Android9和非调试包。512项Node回归及[自定义供应商的本地真实入口验证](./integration/ordinary-providers-current.md)通过，GLM 后续限流失败保持；此次公开 APK 只做下载、身份、签名核验，没有覆盖安装日常 App 或外推真机、任意模型与完整 Remote 复验。证据在本地 `artifacts/public-release/0.1.0-preview.5/verification.json`。

2026-10-15 的[版本发布 Actions](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/38718066086)已完成 `0.1.0-preview.4` 构建、lint、签名与公开发布，固定源码为 `00f2de5887655ac456de758610dd1ad7a0b6d687`、共享协议为 `056bf6f19527c58f456ee5f7eec55e715f401ab5`。APK 与三个校验附件均已匿名下载，APK 为 11,040,802 字节，SHA-256 `af10da7aef516299c61bbdf0840d9c0ff743801717c4649f57e17ceb6a653b53`，与 GitHub 资产摘要及校验文件一致。本机 `apksigner` 验证原证书，`aapt` 核对原包名、versionCode 6、Android 9 与非调试包。505 项手机 Node 回归及缓存/启动的浏览器、MuMu 专项已通过；此次公开 APK 只做下载、身份和签名核验，不将本地候选运行证据扩大为真机或完整公网验收。

2026-10-15 的[版本发布 Actions](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/38687975185)已完成 `0.1.0-preview.3` 构建、lint、签名和公开发布，固定源码提交为 `2124df87cb625a4a83d7afcfa3956419d85570e0`。首次发行因工作流改动尚未进入默认分支返回403；同步 `main` 后仅重跑失败的发行作业，复用原签名附件，没有重新打包。APK与三个校验附件已匿名下载，APK为10,979,098字节，SHA-256 `b168715c79ebdfcea7369cff607f7c8c302b5c7f3c4fbed124266de3aab310b8`，与GitHub资产摘要及校验文件一致。本机 `apksigner` 复核原证书，`aapt` 核对原包名、versionCode5、Android9和非调试包。此轮核验发布与下载，界面运行证据沿用对应浏览器/MuMu专项，不扩大真机或公网验收范围。

2026-10-14 的[版本发布 Actions](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/38529805782)已通过构建、lint、签名、证书/身份/版本检查及公开发布。APK 和三个校验附件均已匿名下载，SHA-256 与公开发行元数据及校验文件一致；本机 `apksigner` 和 `aapt` 复核原证书、versionCode 4 与最低 Android 9。发布下载专项不扩大[两版核心聊天验证](./integration/market-baseline.md)的设备与功能范围。

2026-10-13 的[实际签名与发布构建](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/38375720876)已通过 Web、Android 构建、lint、签名及证书/版本核对，并发布 [0.1.0-preview.1](https://github.com/KKUCODES/deepseek-harness-mobile/releases/tag/v0.1.0-preview.1)。APK 与三个校验附件均已实际匿名下载并核对摘要。

同一公开 APK 已在隔离 MuMu 中覆盖原本地候选，版本 code 2 → 3；安装、启动、原 UID/首次安装时间、本地草稿及语言偏好保留通过。该环境未配置模型 Key，没有读取用户凭据或个人聊天；此核验不代表重新完成模型、Remote、真实手机或完整公网验收。
