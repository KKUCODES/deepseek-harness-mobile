# APK 构建、签名与下载

[返回首页](../README.md) · [使用指南](./usage.md)

## 下载并安装

直接下载 [DSHM 0.1.0-preview.3 APK](https://github.com/KKUCODES/deepseek-harness-mobile/releases/download/v0.1.0-preview.3/DSHM-0.1.0-preview.3.apk)，Android 9 及以上可安装。[公开发行页](https://github.com/KKUCODES/deepseek-harness-mobile/releases/tag/v0.1.0-preview.3)另附 `SHA256SUMS.txt`、`signature.txt` 与 `compatibility.json`，无需登录 GitHub。

也可打开 [Build Android APK](https://github.com/KKUCODES/deepseek-harness-mobile/actions/workflows/android-build.yml)，在成功构建的 Artifacts 下载 `dshm-signed-apk`。Actions 下载需要登录 GitHub，产物保留 30 天。`dshm-unsigned-apk` 是构建检查产物，不能直接安装。

当前是开发预览，沿用 `dev.dshmobile.validation.officialtest` 包名与原候选证书，支持同身份、同签名的正常覆盖更新。不要卸载旧版来更新，以免删除本地数据。普通聊天使用你自己的 DeepSeek Key；Remote 适配官方 DSH `0.2.0-rc.2` / `0.2.1-alpha.2`，配套使用电脑插件 `0.1.84-latest.0`。

## 自动构建与发布

`0.1.0-preview.3`（versionCode 5）改善 Remote 动效、工具/文件/内置面板的手机排版、等待回复提示与回复操作图标，保留 preview.2 的双版本连接范围。preview.1 / preview.2 的历史下载保持，不覆盖旧附件；[双版本验证](./integration/market-baseline.md)。

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

## 构建来源与边界

GitHub 托管的 Ubuntu 24.04 + Node.js 24 + JDK 17 + Android SDK 35。只读官方源码固定于 `d743267388641bc76f17c45ce8b4c231aed1d32c`；官方 SDK 从本仓库锁文件安装，共享协议来自固定的中转仓库提交。不修改或构建 DSH 本体、SDK 或 Electron。

Web 与 Gradle 的 `ciBuild` 产物独立放在 `artifacts/ci/`，默认本地入口保持。签名和可安装性核验不代表完整模型、真机或公网功能复验。

维护来源：[工作流](../.github/workflows/android-build.yml)、[版本与证书](../ci/release.json)、[SDK 准备](../scripts/prepare-ci.mjs)、[无签名产物整理](../scripts/ci-package.mjs)、[Android 构建规则](../android/app/build.gradle.kts)。

## 已核验范围

2026-10-15 的[版本发布 Actions](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/38687975185)已完成 `0.1.0-preview.3` 构建、lint、签名和公开发布，固定源码提交为 `2124df87cb625a4a83d7afcfa3956419d85570e0`。首次发行因工作流改动尚未进入默认分支返回403；同步 `main` 后仅重跑失败的发行作业，复用原签名附件，没有重新打包。APK与三个校验附件已匿名下载，APK为10,979,098字节，SHA-256 `b168715c79ebdfcea7369cff607f7c8c302b5c7f3c4fbed124266de3aab310b8`，与GitHub资产摘要及校验文件一致。本机 `apksigner` 复核原证书，`aapt` 核对原包名、versionCode5、Android9和非调试包。此轮核验发布与下载，界面运行证据沿用对应浏览器/MuMu专项，不扩大真机或公网验收范围。

2026-10-14 的[版本发布 Actions](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/38529805782)已通过构建、lint、签名、证书/身份/版本检查及公开发布。APK 和三个校验附件均已匿名下载，SHA-256 与公开发行元数据及校验文件一致；本机 `apksigner` 和 `aapt` 复核原证书、versionCode 4 与最低 Android 9。发布下载专项不扩大[两版核心聊天验证](./integration/market-baseline.md)的设备与功能范围。

2026-10-13 的[实际签名与发布构建](https://github.com/KKUCODES/deepseek-harness-mobile/actions/runs/38375720876)已通过 Web、Android 构建、lint、签名及证书/版本核对，并发布 [0.1.0-preview.1](https://github.com/KKUCODES/deepseek-harness-mobile/releases/tag/v0.1.0-preview.1)。APK 与三个校验附件均已实际匿名下载并核对摘要。

同一公开 APK 已在隔离 MuMu 中覆盖原本地候选，版本 code 2 → 3；安装、启动、原 UID/首次安装时间、本地草稿及语言偏好保留通过。该环境未配置模型 Key，没有读取用户凭据或个人聊天；此核验不代表重新完成模型、Remote、真实手机或完整公网验收。
