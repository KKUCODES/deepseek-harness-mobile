# 普通聊天与 Remote 启动 Logo 交接

- 状态：本地修复，尚未发布。
- 维护角色：DSHM 手机端维护者。
- 最近核验：2026-10-15。
- 任务：[KKC-61](https://linear.app/kkcodes/issue/KKC-61)。
- 来源：[共享启动容器](../../android/app/src/main/java/dev/dshmobile/validation/StartupScreen.kt)、[普通入口](../../android/app/src/main/java/dev/dshmobile/validation/ValidationActivity.kt)、[Remote入口](../../android/app/src/main/java/dev/dshmobile/validation/RemoteActivity.kt)、[共享封面](../../src/startup.html)、[共享样式](../../src/startup.css)、[启动控制器](../../src/startup.js)、[聊天首屏](../../src/OrdinaryApp.jsx)及[Remote首屏](../../src/RemoteApp.jsx)。

## 当前行为

原先 `mobile.html` / `remote.html` 在 React 挂载前分别显示“正在打开聊天…”/“正在打开 Remote…”。两个实际 Android 入口现在使用同一个原生容器，以及构建时注入的同一份 HTML 封面、CSS 和控制器；不再分别维护相似实现。Remote 的 CSP 保持原约束，重试通过事件监听绑定，不使用内联 `onclick`。

1. Android 12 及以上保留系统 `SplashScreenView`；更早版本使用同一 Logo 的原生封面和窗口背景。
2. `OrdinarySession.start()` 读取本地记录、恢复状态并确认原生 Key 配置状态；已有错误仍走原聊天错误展示，不等模型请求或 Remote 网络。
3. `OrdinaryApp` 提交 `state.ready` 后经过两次浏览器动画帧，移除网页占位，并发送无参数 `ready`。
4. 原生 `postVisualStateCallback` 确认下一帧可以显示真实页面，随后用 220ms 不透明度淡出。系统关闭动画时直接撤下；浏览器审阅入口响应 `prefers-reduced-motion`。
5. 加载封面遮挡期间，WebView 子节点不参与读屏；撤下后恢复，避免读到不可操作的后台按钮。

Remote 等待本地 `binding.info` 与 `appearance.read` 结算并提交首屏后，使用同一就绪通知和绘制屏障。它不等待 `binding.status`、电脑在线、插件资源或工作区加载完成：未配对显示配对表单，已配对显示可返回、重试的连接页，后续真实连接状态继续由原界面更新。普通/Remote模式之间已有页面的切换不重载，不重新播放启动封面。

原生目标使用固定枚举，只接受当前容器对应 origin 与准确主文档：普通为 `appassets.androidplatform.net/assets/web/mobile.html`，Remote 为 `remote.dshm.invalid/assets/web/remote.html`。子框架、另一模式和外部页面均不能发出有效就绪信号。不增加文件、网络、Key 读取或 Remote 管理能力。独立诊断入口不等待产品首屏信号。

只改网页占位的方案不能覆盖 WebView 第一帧之前的空档，因此采用原生持有、网页通知、绘制屏障的组合。没有额外延迟或新依赖，所有构建入口从同一源文件复制启动控制器与原图。

## 失败与生命周期

资源/脚本错误、宿主初始化失败或 30 秒仍未就绪时，显示可点击的重试页面，不输出异常细节、不永远卡在 Logo。主文档加载失败由原生接管。原生按钮只重载本地页面；不清空历史、草稿、Key 或配对。

每次重新加载有独立代次，旧绘制回调或动画不能关闭新封面。Activity 销毁时撤销定时器、动画和启动消息监听。启动失败后的迟到 `ready` 不会自动盖掉错误页面。

## 验证入口

```text
npm run build:web:official
node --test tests/startup.test.mjs
node scripts/verify-startup.mjs --android
```

脚本要求先构建并安装 `remoteToolLayoutTest=true` 的隔离 APK，只操作 `dev.dshmobile.validation.toolstyletest`。报告、截图和原生启动录像保存在 `artifacts/startup-transition/<唯一编号>/`。不发送模型请求，不读取 Key，不修改日常 App 或 DSH。

- 4 项控制器测试覆盖帧前持有、单次就绪、失败与迟到就绪竞争、看门狗及减少动画清理；500 项原有 Node 回归通过。
- Edge 的实际 `mobile.html` 四种深浅主题/减少动画组合通过；故意延迟真正业务模块时保留 Logo，模块失败后重试能进入聊天。
- MuMu Android 12L 的真实冷启动、重开、主动持有就绪信号、原生失败重试已通过；延迟仅用于验证遮挡，不把它作为性能结果。
- 原生深色恢复、系统关闭动画、重试后从真实抽屉恢复原草稿均通过。只调整隔离测试 UID 的外观；系统动画倍率在 `finally` 恢复原值。

最终整轮：`artifacts/startup-transition/3e35e7a6-e7a7-43a3-87ef-8ffebf14cf6c/report.json`，`passed: true`。同目录保留 `android-cold-transition.mp4`、持有 Logo、深色首屏和原生错误截图。APK 构建与 lint 通过，没有新增启动代码警告。

## 补齐 Remote 入口

第一轮只接入普通聊天，用户实际截图指出 Remote 的独立占位仍然存在，不能把普通入口通过当作全入口完成。本轮将两端模板和原生容器统一，并将任务重新打开验收。

- `artifacts/startup-transition/9032fbd0-276d-4772-a1ff-b8b192889c9f/report.json` 全部通过：普通聊天的原矩阵继续通过；两个真实构建页面各有四种主题/减少动画组合与一次模块失败重试，共10项浏览器路径。
- 真实 Android 抽屉首次进入未配对 Remote、模式来回切换保持页面、延迟本地就绪时持有 Logo、Remote 原生失败后实际点击重试全部通过。同目录的 `android-remote-first.mp4` 已逐帧核对，无裸占位文字；保留配对页与持有 Logo 截图。
- 504项既有Node整轮通过，另补本地外观就绪/失败回退/卸载迟到结果测试，相关8项通过。官方Web构建和隔离APK/lint通过；未修改DSH、插件或公网服务代码。
- 真实配对后的离线与恢复专项另记录；`8a0f0db6-2e8b-4643-abf3-9c47fa8f8dbb` 在配对过程中遭遇 Playwright ADB `127.0.0.1:5037` 连接超时而退出，不计通过。已核对测试Host退出、端口关闭，只移除本轮18535反向映射，原8000/8001映射保持。第二轮 `bca398f5-e7fb-4211-af5b-7e7617f95cc8` 因残留绑定保护而停止并完整清理；随后只读取隔离UID可见的来源与指纹，确认来源准确对应首轮18535，才能显式清理该测试绑定；日常App绑定不在范围内。
- 最终真实组合 `artifacts/remote-sync-cache-android/dd857aa9-bc6a-46e9-972e-523b615e06a1/report.json` 通过。官方独立CLI＋DSHM插件＋生产网关实现＋MuMu：三次资源/数据缓存恢复继续通过；临时关闭该测试插件连接后，再结束App并沿抽屉进入Remote，固定配对指纹、电脑离线提示和可操作连接页保留，原生/网页Logo已撤下。重新启用同一测试插件后，原绑定重新进入工作区；`startup`四项全部true。原专用历史摘要不变、模型请求0、设备撤销/本机移除/测试Host停止/映射移除均通过，`errors`和`cleanupErrors`为空。截图 `startup-paired-offline.png` 与报告同目录。

验证驱动的失败保留：首次截图等待整页字体导致业务脚本持有测试超时，改为即时 CDP 截图；随后修正 `am start -W`、CDP 的 `Page.enable`、旧原生驱动等待/点击，以及被遮住的网页按钮误匹配。草稿最初误用 `innerText` 检查 textarea，改用实际 `value` 并等待数据库完成；深色测试改为等原生镜像提交和窗口空闲后再结束进程。这些早期报告不计通过，不能据此声称数据丢失或测试完成。

Android 9–11 的原生封面分支与 Android 15 窗口分支仅编译/lint，本次没有相应设备；不宣称真机或所有系统启动时长通过。录像核对 Logo 出现后的首屏交接，不能外推系统创建启动窗口之前的等待。
