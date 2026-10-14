# rc.2 与 alpha.2 的手机兼容

- 状态：核心路径已在同一独立 MuMu APK 上通过；新版公开 APK 尚未发布。
- 维护角色：DSHM 手机端维护者；核验日期：2026-10-14。
- 来源：[JS 版本规则](../../src/remote-dsh-version.mjs)、[实际聊天协商](../../src/remote-transport.mjs)、[原生通知连接](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeConnection.kt)、[Android 实测驱动](../../tests/support/market-baseline-android.mjs)。

手机仍使用固定 alpha.2 SDK，不修改或编译 DSH 本体。只有 `0.2.1-alpha.2` SDK 明确增加接受官方 `0.2.0-rc.2`；alpha.1、旧版 SDK、未来预发布和其他稳定版本不因这个改动自动放行。聊天与 Kotlin 原生通知必须同时检查该组合，避免聊天在线、后台连接拒绝。

已核对 rc.2 的五参数流、文件 options/字节响应和 profile 服务契约。`isProfileDshVersion` 增加 rc.2，使文件、预览、插件设置和预设的既有分支选择正确。定时目录继续按官方 alpha.2 版本和宣告能力显示。

本地候选 `0.1.0-preview.2`、versionCode 4 保留原公开应用身份与签名配置；公开 `0.1.0-preview.1` 下载仍只连接 alpha.2，不能仅更新电脑插件就获得 rc.2 支持。

## 实测

同一 APK（独立测试 UID `dev.dshmobile.validation.baselinetest`，SHA256 `f80db3275e54aa6e8e18017bffba4ec276e0da3289c9886d9689f0ee9860b52b`）在 MuMu 设备 3 分别连接两版未修改官方 DSH。两轮均实际原生领取链接、电脑批准、进入 DSHM 自有 Remote 页面、读取真实历史、从手机发送并收到真实 DeepSeek 回复；官方历史与回复相符，页面没有 iframe，没有 page error。

原生独立通知连接也在两版完成协商并请求 `remote.taskFollow`。这只证明连接和订阅成功，不扩大为新一轮系统通知投递和所有后台生命周期验收。

- rc.2：[手机报告](../../artifacts/market-baseline/run-lMWhdI/android.json)、[实际画面](../../artifacts/market-baseline/run-lMWhdI/remote.png)。
- alpha.2：[手机报告](../../artifacts/market-baseline/run-dc06AU/android.json)、[实际画面](../../artifacts/market-baseline/run-dc06AU/remote.png)。
- [电脑插件双版本实测](../../../plugin/compatibility/latest-upstream/market-baseline.md)包含真实模型切换、write 允许/拒绝、重连与撤销；这些审批由真实协议连接处理，不描述为手机审批界面全量重验。

测试使用本轮创建的独立包身份，不覆盖或清空原 App，不读取其 Key、绑定和聊天；设备授权测试后撤销，ADB 端口映射移除。MuMu 起始停机，本轮通过官方 CLI 启动，收尾恢复停机。临时隔离构建脚本只改变我们 Android 测试包身份，不改变 DSH。

Web 构建、Android Kotlin/Java/APK 构建和版本/传输回归另行执行。物理手机、完整公网、任意插件和模型，以及全部 R01–R16 扩展不属于此次全面重验范围；原 alpha.2 的完整验收仍保留历史边界。

最终手机 Node 回归 495 项通过。正常应用身份的 [preview.2 本地测试 APK](../../artifacts/market-baseline/DSHM-0.1.0-preview.2.apk)已构建：`dev.dshmobile.validation.officialtest`、versionCode 4、最低 Android 9，签名证书 SHA256 为 `d97f5b68c6a327f4ae455834ba30f23ce7b64f2eeafd8a222e0e74b0a998e51e`，与原公开候选相同。它是本机调试签名候选；未代替公开 Release，功能实测仍以独立 UID 报告为准。
