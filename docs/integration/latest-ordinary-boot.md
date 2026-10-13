# 新版普通聊天冷启动兼容

- 状态：新旧浏览器输入/外观回归、发布与源码入口的原Android进程结束/重开组合、原源码与资源恢复均已通过；不代表完整新版兼容验收。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-10-05。
- 目标：固定 DSH `0.2.1-alpha.1`；日常旧版 `0.1.6-alpha.2` 未升级。

## 实际问题与修复

文件保存生命周期的第二轮实际 Android 验证在停止独立 Office App 后，通过原 Launcher 重新打开普通聊天，出现 `inactive_plugins`（locale、ui-theme）。该轮整体失败，不能用直接打开 Remote Activity 代替冷启动验收。

新版原 locale/theme 插件已从 `settingsScope` 改用 `configForms.get(namespace)`。手机宿主现在提供本地 ConfigForm 适配，与旧 SettingsScope 共用固定 namespace 校验、原子存储、revision 和订阅；写入成功返回接受结果，存储失败继续拒绝。没有增加电脑配置、文件或认证能力。

补齐设置接口后，输入插件仍未启用：它安装时依赖的隔离 sessions provider 尚未就绪；provider 原来属于非隔离的父插件，父插件就绪通知以其上下文隔离域过滤，遗漏隔离域的消费者。现由隔离上下文中的独立插件持有 sessions，启用输入插件前等待该 provider 就绪，使用 Cordis 公共生命周期接口。根域仍没有 sessions，不激活电脑 Host 插件；没有调用私有刷新接口或禁用输入增强。

## 已验证范围

原普通聊天首页与抽屉 Remote 入口在新旧两套 SDK 均冷启动成功。使用同一套实际输入插件进一步验证中文/英文提示词选择、旧候选拒绝、跨会话写入拒绝、五轮提示词源与插件卸载/重载、草稿刷新恢复和根域 Host 服务隔离。原外观界面的深色、字号修改及语言切换在刷新后保留；两套浏览器均无页面或控制台错误。本地设置四项、手机全量436项、插件全量215项及后端类型检查通过。

浏览器回归不替代实际 Android 冷启动。独立 Office APK 已重新构建并仅安装到 `dev.dshmobile.validation.latestofficetest`，165资源逐字节核对通过；持久模型验收 App、原绑定和用户 Key 保留。发布入口原Android完整组合180.92秒、实际源码pnpm203.34秒（外层206.20秒）通过，原Launcher启动新进程后经普通聊天抽屉进入Remote，原绑定/会话恢复及完整文件重新保存通过。源码完整构建293.66秒、原回归、恢复构建289.60秒及28原源码/355原资源精确恢复/Git干净通过，完整范围按[文件传输专项](../../../plugin/compatibility/latest-upstream/file-transfers.md)核对。

## 代码与证据

2026-10-06：持久模型测试包重新启动时也出现同一locale/theme错误。该UID此前为保留绑定而没有安装Office包的修复版；本次只用`install -r`更新`dev.dshmobile.validation.latesttest`，不清除数据。APK的165个Web资源与新版产物逐字节一致，构建及lint通过。普通Launcher和抽屉Remote入口恢复；原指纹/active聊天授权、两条模型/PTC会话保持，management=false。模拟器原16901反向端口已丢失，恢复后原手机连接成功。原进程结束原因未知，不把它归因于App缺陷。见[实际前置失败及恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-notification-before.json)、[APK核对](../../../plugin/artifacts/latest-runtime-check/latest-live-updated-apk.json)。

这次恢复不算后台通知验收：测试消息尚未发送，打开原会话并启动验证的组合命令被自动审批以`blocked by policy`拒绝，未返回更具体原因。已请求用户手动打开专用模型会话；后续通过[受限通知验证器](../../scripts/verify-latest-live-notification-android.mjs)观察真实模型完成、系统通知及点击目标，不能用已有旧版结果替代。

后续用户反馈前台MuMu没有App。重新核验当前唯一ADB实例`emulator-5554`（DCO-AL00/MuMu、当前用户0）时，`pm list packages`及`-u`都已没有主App，只有旧androidTest辅助包；原因尚不明确，不能继续声称原手机绑定仍存在。再次安装同一已核对APK后，正常首页显示；原抽屉Remote明确为未绑定。通过新的一次性链接正常配对，电脑核对新指纹并只批准聊天权限，新设备active/management=false；旧丢失绑定已撤销。原两条模型/PTC测试会话出现在自有Remote最近列表，没有新建或发送消息，也没有清除App数据或读取Key。见[恢复驱动](../../scripts/recover-latest-live-binding.mjs)、[新配对](../../../plugin/artifacts/latest-runtime-check/latest-live-binding-recovery-claim.json)、[正常连接与原列表](../../../plugin/artifacts/latest-runtime-check/latest-live-binding-recovery-connect.json)及[实际页面](../../../plugin/artifacts/latest-runtime-check/latest-live-reinstalled-remote.png)。这是原环境恢复，不证明后台通知成功。

- [宿主组合](../../src/plugin-host.jsx)、[本地设置适配](../../src/local-settings.mjs)、[隔离输入 provider](../../src/ordinary-input.mjs)、[设置回归测试](../../tests/local-settings.test.mjs)。
- [实际页面回归入口](../../scripts/check-ordinary-boot-web.mjs)，先运行对应 `scripts/build-web.mjs`；新版使用 `--latest-candidate`，旧版不加参数。
- [修复前实际浏览器失败](../../artifacts/latest-mobile-runtime/ordinary-boot-web-before.json)、[新版实际页面/输入结果](../../artifacts/latest-mobile-runtime/ordinary-boot-web.json)、[旧版实际页面/输入结果](../../artifacts/ordinary-boot-web.json)。
- [原 Android 第二轮失败](../../artifacts/latest-mobile-runtime/latest-file-picker-npm-second-failed-android.json)、[实际启动失败截图](../../artifacts/latest-mobile-runtime/latest-file-picker-npm-second-failed-android.png)。
- [修复后原Android完整结果](../../artifacts/latest-mobile-runtime/latest-file-picker-npm-android.json)、[同一会话恢复截图](../../artifacts/latest-mobile-runtime/latest-file-picker-npm-after-process-reopen.png)。

测试静态服务仅针对浏览器自动请求的 favicon 返回 204；真实页面、模块或资源的失败仍会被回归捕获。临时诊断日志已经移除。
