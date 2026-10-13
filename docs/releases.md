# APK 构建、签名与下载

[返回首页](../README.md) · [使用指南](./usage.md)

## 下载并安装

从 [GitHub Releases](https://github.com/KKUCODES/dshm/releases) 下载 `DSHM-<version>.apk`，Android 9 及以上可安装。公开发行附件无需登录，另附 `SHA256SUMS.txt`、`signature.txt` 与 `compatibility.json`。

也可打开 [Build Android APK](https://github.com/KKUCODES/dshm/actions/workflows/android-build.yml)，在成功构建的 Artifacts 下载 `dshm-signed-apk`。Actions 下载需要登录 GitHub，产物保留 30 天。`dshm-unsigned-apk` 是构建检查产物，不能直接安装。

当前是开发预览，沿用 `dev.dshmobile.validation.officialtest` 包名与原候选证书，支持同身份、同签名的正常覆盖更新。不要卸载旧版来更新，以免删除本地数据。普通聊天使用你自己的 DeepSeek Key；Remote 适配官方 DSH `0.2.1-alpha.2`。

## 自动构建与发布

- `main` 的相关源码、构建或依赖变更自动构建并签名，不自动发布每次提交。
- 指向 `main` 的 PR 只构建无签名包，签名作业不运行。
- 手动选择 `main` → Run workflow 可生成签名包；勾选 `publish_release` 发布公开开发预览。
- 推送对应 `v<version>` 标签时，版本校验、构建、签名成功后发布预览。
- 发新版本前同步修改 [ci/release.json](../ci/release.json) 中的版本并递增 `versionCode`。已存在的 Release 不覆盖，重新发版应使用新版本号。

## 签名凭据

指定仓库 `KKUCODES/dshm` 的 Settings → Secrets and variables → Actions 中配置四个 **Secrets**，不使用普通 Variables：

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
