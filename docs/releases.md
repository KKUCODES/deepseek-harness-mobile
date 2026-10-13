# APK 构建与下载

[返回首页](../README.md) · [使用指南](./usage.md)

## 下载构建产物

打开 [Build Android APK](https://github.com/KKUCODES/dshm/actions/workflows/android-build.yml)，选择成功的构建，在 Artifacts 下载 `dshm-unsigned-apk`。其中包含 `DSHM-<version>-unsigned.apk`、`SHA256SUMS.txt` 与 `compatibility.json`。下载需要登录 GitHub，产物保留 30 天。

**当前仅生成无签名 APK，不能直接安装。** 本工作流不访问签名私钥或密码，不配置签名 Secrets，也不创建 Android Release 草稿。可安装的公开发行包尚未发布；签名、覆盖更新与发行验收留待后续。

APK 使用候选身份 `dev.dshmobile.validation.officialtest`，适配官方 DSH `0.2.1-alpha.2`。构建成功只证明打包检查通过，不代表安装、真机或完整公网验收通过。

## 触发构建

- `main` 的相关源码、构建或依赖变更自动构建；指向 `main` 的 PR 同样构建。
- Actions → Build Android APK → Run workflow 可手动构建，不需要 Secrets。
- 推送 `v<version>` 标签也会构建；标签须与 [ci/release.json](../ci/release.json) 中的版本一致。
- 更改应用版本时同步递增 `versionCode`，不要把无签名包视为可覆盖更新包。

## 构建来源

GitHub 托管的 Ubuntu 24.04 + Node.js 24 + JDK 17 + Android SDK 35。只读官方源码固定于 `d743267388641bc76f17c45ce8b4c231aed1d32c`；官方 SDK 从本仓库锁文件安装，共享协议来自配置中固定的中转仓库提交。不修改或构建 DSH 本体、SDK 或 Electron。

CI 使用 `npm run prepare:ci`、`npm run build:web:ci` 与 Gradle 的 `ciBuild` 参数；产物独立放在 `artifacts/ci/`。默认本地构建与原 App 不受这些参数影响。

维护来源：[工作流](../.github/workflows/android-build.yml)、[版本配置](../ci/release.json)、[SDK 准备](../scripts/prepare-ci.mjs)、[产物整理](../scripts/ci-package.mjs)、[Android 构建规则](../android/app/build.gradle.kts)。

## 已核验范围

2026-10-13 的[实际云端构建](https://github.com/KKUCODES/dshm/actions/runs/38368759360)已通过 Web 打包、`assembleRelease` 与 `lintRelease`。下载后核对 APK 包名、版本、Android 版本要求、164 个 Web 资源和 SHA-256，签名检查确认包未签名。此记录不包含安装、覆盖更新或模型请求。
