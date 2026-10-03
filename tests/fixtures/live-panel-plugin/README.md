# 独立面板验收插件

真实工具更新验收：设置 `DSHM_ANDROID_SERIAL`、`DSHM_RUN_LIVE=1`、独立的 `DSHM_RESOURCE_RUN` 标识，运行 `node scripts/verify-file-resource-live-android.mjs start`，然后 `observe`，最后 `cleanup`。start 仅在已选中的专用会话发送一次独立文件写入请求；observe 核对测试文件后批准一次，不重发消息，并检查同一隐藏订阅的版本/字节数及文件预览。独占种子防止重发，重新验收使用新标识保留原证据。最终[实时刷新验收](../../../docs/integration/remote-current.md#文件实时更新与并发容量2026-09-26)通过，测试文件及插件已清理。

0.0.5增加原 resources 服务消费（0.0.4漏声明注入，已修正）。运行 `node scripts/verify-file-resource-android.mjs` 验证现有文件的真实元数据、缺失文件错误及停止订阅，完成后卸载。最终包已从电脑移除，详见[资源验收](../../../docs/integration/remote-current.md#原文件资源服务与旧-webview2026-09-25)。

本项目自编临时验收包，不是产品功能或第三方兼容性保证。无 Host 业务逻辑、安装脚本或模型调用；客户端注册原侧栏类型及局部正文，使用原 useTabInfo 导航和文件入口。

在本目录执行 `npm pack --ignore-scripts --pack-destination ../../../artifacts`，通过电脑 DSH 插件页安装并启用生成的包。原生 App 已连到专用「DSHM Remote 联调提示」会话后，在手机项目根设置 `DSHM_ANDROID_SERIAL`，运行 `node scripts/verify-plugin-panels-android.mjs`。它核对720px缩放、计数状态与已存在的专用验收文件，不发送消息。完成后通过电脑卸载，再运行同脚本 `unloaded` 阶段。

0.0.1漏持有原 register 返回的 disposer；0.0.2使用 ctx.effect 归属注册，卸载可移除入口。首版错误不计入生命周期通过；最终证据与局限见[接入记录](../../../docs/integration/remote-current.md#插件面板与原侧栏服务2026-09-25)。测试后已卸载，仅在项目中保留源码和产物。

0.0.3增加原 Modal/Menu 和 tab.menu.item 扩展。运行 `node scripts/verify-plugin-panels-android.mjs verify --hold-overlay` 可在检查真实 Android 返回后保留弹窗，随后电脑卸载并运行 `unloaded`，核对弹窗释放、旧标签兜底及管理页背景隔离/恢复。最终[运行和清理证据](../../../docs/integration/remote-current.md#插件面板的菜单与弹窗2026-09-25)通过；未授予设备管理权限。
