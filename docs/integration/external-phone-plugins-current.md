# 固定 APK 的外部首页插件验证

后续（2026-10-26，KKC-103）：新增预装完整包目录，同一安装器与加载器支持首次安装和显式恢复，当前规则见[预装专题](./preinstalled-phone-plugins-current.md)。以下KKC-102“不在APK包含新版首页”的表述保留当时外部分发验证语境；当前APK携带完整独立包，仍不直接导入宿主JS。

- 状态：已实现并完成下列本地验收，纳入preview.14/code22；公开包结果见[发行核验](../releases.md#已核验范围)。下文code17和未发布描述保留首次验收阶段。
- 维护：DSHM 手机端维护者；日期：2026-10-26；任务：[KKC-102](https://linear.app/kkcodes/issue/KKC-102)。
- 范围：只修改手机宿主、SDK、模板及文档；不修改 DSH 本体，不合入之前的 npm/桌面插件适配分支。

## 结果与边界

「Remote 新版首页」从 APK 的内置插件目录移除。App 保留默认首页、安装器、动态目录和公开 API；新版首页通过外部 `.dshm-plugin` 包安装和更新。普通聊天的三个内置插件仍随 App 提供，二者共用插件页和生命周期管理。

采用用户主动选择的完整本地单文件包，避免首轮引入 npm 依赖解析、在线分发和自动信任。另一可行方案是立即建设 npm 安装器，但还要承担浏览器依赖打包、版本解析及分发信任成本。本轮选择前者以验证独立插件边界；不妨碍将来通过同一包格式增加分发渠道。

公开交付：[开发指南](../plugins/development.md)、[首页API](../plugins/remote-home-api.md)、[SDK及自包含README](../../packages/plugin-sdk/README.md)、[类型](../../packages/plugin-sdk/index.d.ts)、[模板](../../packages/plugin-template/)、[完整首页示例](../../packages/remote-home-design/)。SDK `.tgz` 包含自己的完整最小开发步骤，不要求安装者去找宿主私有源码。

## 固定 APK 的真实入口矩阵

环境：MuMu Android12实例0，原App包名与原签名；手机本地候选`0.1.0-preview.13-external`、code17。电脑为官方DSH `0.2.1-alpha.2`＋现有插件`0.1.81-latest.0`，原公网中转及原配对。只启动已有隔离官方CLI，没有修改或打包DSH，没有配置模型Key或发送模型消息。

最终固定调试APK：`artifacts/tests/external-plugins/DSHM-external-plugins-fixed.apk`，SHA-256：`81a4caa9d64040c04dc805b3963bef43575a19c8f05d0811f956effc4703f322`。首轮验收后发现外部包错误显示「已是最新版本」，移除该无联网依据的状态，再固定最终APK重新执行下表完整流程。最终矩阵中未再替换APK。调试仅用于精确PID的WebView核验；不是公开发行APK。首轮记录保存在`verification-phase1.json`，不与最终APK混淆。

| 实际入口 | 结果 |
| --- | --- |
| 覆盖安装后「插件 → 手机」 | 无内置新版首页条目；普通聊天插件与原数据保留 |
| 从文件安装v1 | 真正打开Android系统选择器，选择`home-0.1.0.dshm-plugin`，原生确认信任后登记；未进入Remote显示待加载 |
| 进入已有电脑连接 | 真正下载/导入本机内容地址脚本，首页显示已连接；插件页显示运行中 |
| 插件详情停用/启用 | 默认首页与外部首页切换，保持同一RemoteModel；不是只修改开关文案 |
| 从文件更新v2 | 同APK导入`0.2.0`；实际请求新内容摘要地址，详情显示0.2.0、运行中，仅一个首页插槽；专用项目及`Greeting`查询保持 |
| 再导入v1 | 显示「已安装相同或更新版本」，保留v2及其运行状态 |
| 外部插件详情 | 只显示已安装版本及从文件更新，不声称已联网确认最新版 |
| 卸载 | 插槽数量0，恢复默认首页且查询保持；已安装条目消失，原生私有目录仅剩索引文件，脚本实际删除 |
| 重新安装v2 | 同一APK从文件再次安装并运行 |
| 实际核心重连 | 公用中转连接世代1→2，保持同一模型、首页fiber及查询，一个插槽 |
| 强行结束再正常启动 | 安装记录仍为0.2.0，进入Remote前待加载；原配对正常重连后外部首页运行 |
| 第二款独立插件 | 单独目录只复制模板和安装SDK `.tgz`，构建`@example/plain-home`；同APK从系统选择器安装并显示另一种首页；启用互斥、卸载回到默认、重新启用原v2均通过 |
| 不兼容包 | 从真正文件入口选择API99包，显示具体不兼容提示；现有运行首页保持 |
| 激活故障 | 特制测试包在注册后抛错：状态加载失败、半成品注册释放、默认首页可用；卸载失败包后重新启用v2通过 |

v1代码摘要`35ecd5cdd5eba57e554a3ea1012cc9c7c5c364aae7e9815eb02800c3f6f76687`；v2 `e5f264c97ea6579969689747517c86062c4e472a61250187f5acbe511f43a663`；第二款独立模板`c96d45038e991399f7d24f83692ba2296c0af36a23b02e6f32f6ad8bc00be447`。它们是代码摘要，不是APK或整个JSON文件摘要。

## 自动回归与来源

- Node全量589项通过，含独立SDK构建、共享React、两版摘要/模块、内容路由约束，以及停止/卸载持续失败后正确显示与显式重试。
- rc.2与alpha.2的`verify-mobile-interface.mjs`页面矩阵通过。该脚本明确注入**测试目录**以复验原有Cordis/插槽/实际RemoteWorkspace、草稿、滚动、返回优先级与故障处理；不能冒充Android外部安装证据。
- Android debug/AndroidTest编译及release lint通过。原生隔离专项执行实际包解析、API/字段/摘要/大小/ID拒绝、版本递增、内容路由、持久化、活宿主停止确认后删文件、安装提交失败回退；没有操作用户插件目录。
- 原有RemoteApp的19项隔离恢复脚本单独复验，结果见本机记录；和实际电脑连接证据分开。

源文件：[外部目录适配](../../src/external-phone-plugins.mjs)、[统一管理器](../../src/phone-plugins.mjs)、[原生安装器](../../android/app/src/main/java/dev/dshmobile/validation/PhonePluginImport.kt)、[包存储](../../android/app/src/main/java/dev/dshmobile/validation/PhonePluginPackages.kt)、[状态存储](../../android/app/src/main/java/dev/dshmobile/validation/PhonePluginStore.kt)、[SDK测试](../../tests/external-phone-plugins.test.mjs)、[原生测试](../../android/app/src/androidTest/java/dev/dshmobile/validation/PhonePluginPackageChecks.kt)。

本机证据位于忽略目录`artifacts/tests/external-plugins/`：`verification.json`、固定APK、v1/v2及独立工程产物、节点测试日志、`v1-home.png`、`v2-details.png`、`independent-plugin-details.png`、`final-v2-running.png`。SDK源码包验证使用真实npm安装构建，不访问模型服务。

## 尚未覆盖

没有验证所有物理设备/Android版本、磁盘真实写满、任意恶意插件或所有进程中断时序。安装器采用AtomicFile写包索引、提交失败恢复旧索引；跨两个持久存储的极端断电一致性未做故障注入验收。没有插件作者签名、沙箱、npm运行环境、市场和自动更新；共享JS线程的同步死循环不能靠同线程超时解除。新包激活失败使用默认首页，不保证回滚到旧插件版本。

测试注意：后台原生WebView可能暂停动画帧，Playwright默认`waitForFunction`的RAF轮询会超时，即使连接已经恢复。跨Activity检查应显式使用定时轮询或重新读取实际状态；本次曾遇到该测试等待问题，直接核对已连接、世代2、同fiber和查询保持，不能误报为产品重连失败。

旧preview.13/code16不具备外部安装器；界面按`installerApi:1`决定是否显示导入入口。新功能应随新的APK发布；本轮没有发布资源包或把新原生能力当成旧APK可用。
