# APK 下载与 GitHub Actions

[返回首页](../README.md) · [使用指南](./usage.md)

## 下载 APK

打开 [Build Android APK](https://github.com/KKUCODES/dshm/actions/workflows/android-build.yml)，选择成功的手动构建，在 Artifacts 下载 `dshm-signed-apk`。其中包含可安装的 APK、SHA-256、签名报告与兼容元数据。Actions 产物下载需要登录 GitHub，签名产物保留 30 天。

普通提交与 PR 只生成 `dshm-unsigned-apk`，用于构建检查，不能直接安装。APK 保持现有测试包身份 `dev.dshmobile.validation.officialtest`，适配官方 DSH `0.2.1-alpha.2`。它仍是开发预览，构建和签名成功不代表真机或完整公网验收通过。

公开发行包从 [Releases](https://github.com/KKUCODES/dshm/releases) 下载。工作流只创建未发布草稿，维护者检查后再发布；草稿不对普通用户开放。

## 运行与发版

- 普通 `main` 提交与 PR 自动构建无签名 APK，不访问签名私钥。
- Actions → Build Android APK → Run workflow 手动生成签名 APK；勾选 `release_draft` 时创建预发布草稿。
- 发版前修改 [ci/release.json](../ci/release.json) 的版本与 `versionCode`，再推送对应 `v<version>` 标签。`versionCode` 每次递增，标签须与版本一致。
- 已公开的 Release 不覆盖；同一提交的草稿可以重跑更新。下一次版本使用新版本号。

## 签名配置

维护者在 `KKUCODES/dshm` 的 Settings → Secrets and variables → Actions 配置：

| Secret | 用途 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | 签名文件的 Base64；不放入代码仓库。 |
| `ANDROID_STORE_PASSWORD` | 签名文件密码。 |
| `ANDROID_KEY_PASSWORD` | 私钥密码。 |
| `ANDROID_KEY_ALIAS` | 私钥别名。 |

当前预览使用原测试包签名。工作流必须核对证书摘要与 `ci/release.json` 一致，以保持覆盖更新；不要随意换签名或删除本地备份。正式发行的独立身份、签名与数据迁移另行确认。

私钥只传给可信手动或标签构建的独立签名步骤，不提供给 PR 构建。签名文件使用临时目录，步骤结束删除；生成的下载目录不包含私钥。缺少 Secrets 或证书不符时签名失败，不回退到随机调试签名。

## 构建来源

GitHub 托管的 Ubuntu 24.04 + Node.js 24 + JDK 17 + Android SDK 35。只读官方源码固定于 `d743267388641bc76f17c45ce8b4c231aed1d32c`，官方 SDK 由本仓库锁文件安装，不修改或构建 DSH 本体、SDK 或 Electron。

CI 使用 `npm run prepare:ci`、`npm run build:web:ci` 与 Gradle 的 `ciBuild` 参数；产物独立放在 `artifacts/ci/`。默认本地构建与原 App 不受这些参数影响。

维护来源：[工作流](../.github/workflows/android-build.yml)、[SDK 准备](../scripts/prepare-ci.mjs)、[Android 构建规则](../android/app/build.gradle.kts)。
