# Remote 通道与权限验收

- 状态：KKC-17 七项现行标准按已确认本地范围通过；不表示完整 Remote 或任意第三方插件都已验收。
- 维护角色：项目协作 Agent；最近核验：2026-10-04。
- 需求来源：[KKC-17](https://linear.app/kkcodes/issue/KKC-17)、[正式接入门槛](./README.md)、用户确认的共享聊天界面及电脑补丁交付方案。

## 七项标准

| 标准 | 证据与结论 |
| --- | --- |
| 1. 原通道、参数和权限有源码依据 | [Host适配器](../../../plugin/src/remote-adapter.ts)调用原Connection/Gateway与模块服务；[原Gateway集成测试](../../../plugin/tests/remote-adapter.test.ts)核对命名参数和原始流结果。协议仅定义授权载体，不伪造Host能力。上游参考检出不作为运行目录；实际维护补丁另有固定基线。 |
| 2. 聊天与管理授权分离、能力协商 | 网关[真实HTTP/WS/SQL矩阵](../../../backend/tests/remote-permissions.test.ts)拒绝普通设备的安装/配置、伪造context和过期票据；Host独立检查管理权限。手机[版本与通道测试](../../tests/remote-transport.test.mjs)拒绝未知DSH/传输版本、未协商调用及任意本地HTTP入口。真实手机管理/收权证据见[插件管理](./plugin-management-current.md)；当前日常设备active、management=false。 |
| 3. RPC、流和资源的归属及撤销 | [原生桥](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)在断线/撤销时清理资源、下载、HTML、敏感窗口和连接代次；凭据及票据留在原生层。[实际RPC在途撤销](../../artifacts/cordis-inflight-android.json)丢弃166字节、移除手机实例并拒绝重连；[输出流](../../artifacts/sidebar-revocation-android.json)丢弃496字节；[Worker资源](../../artifacts/worker-revocation-android.json)丢弃4163字节并释放；[文件交付](../../artifacts/file-revocation-android.json)清理85字节暂存、不交付、拒绝重连。旧bundle撤销报告只证明502/页面销毁，结合当前Host bundle背压/取消与网关归属矩阵核对。 |
| 4. 两种模式的隔离 | [核心聊天核对](./core-chat-current.md)确认两个正式入口复用ChatMessage/MobileComposer，同时保持独立Activity/origin/原生桥和历史；[真实Remote不可用时普通请求](../../artifacts/ordinary-without-remote-android.json)通过。普通页没有Remote桥，Remote页没有普通桥；相同UI组件不等于共享凭据。 |
| 5. 真实纵向接入 | [有效配对与异常恢复](../../artifacts/pair-failures-android.json)进入自有工作区；[独立电脑插件局部UI](../../artifacts/live-partial-verify-android.json)真实点击及共享文件预览；[已有工作区新建/管理](./core-chat-current.md)核对原报告与驱动；[模型实际写文件的允许一次/拒绝](./remote-current.md#模型实际工具审批与拒绝2026-09-27)有磁盘及手机预览证明；[真实附件](../../artifacts/remote-mobile-attachment-android.json)和[图片](../../artifacts/remote-mobile-attachment-image-android.json)可读取/预览。撤销证据见上一行。手机自己的页面与共享渲染为当前实际入口，不采用早期整站载体作为通过依据。 |
| 6. 外层自适应与插件生命周期 | [默认缩放](../../artifacts/live-partial-verify-android.json)720px→372px且点击正确、用户关闭/恢复通过；[作者声明](../../artifacts/live-partial-author-android.json)及用户覆盖优先通过；[卸载](../../artifacts/live-partial-unloaded-android.json)从图和UI移除。[API说明](../plugin-validation/mobile-layout-api.md)规定仅处理外层，窄内容原尺寸，用户设置优先。[实际Worker生命周期](../../artifacts/plugin-manager-worker-lifecycle-android.json)覆盖停用/断线/重连/卸载；不承诺替未知第三方清理它自己的任意副作用。 |
| 7. 上游改动有核验与授权 | 用户已确认电脑端允许维护兼容补丁。[交付组合](../../../plugin/compatibility/README.md)核对112个文件、17份manifest及源码启动依赖，固定基线不同则拒绝套用；不扩大为任意原生权限或通用URL代理。手机/插件/网关仍独立部署配套版本。 |

## 本轮验证与边界

重新执行通道相关当前源码测试：手机17项、插件40项、网关16项，均通过、无跳过。分别保留[手机日志](../../artifacts/channel-audit-tests.log)、[插件日志](../../../plugin/artifacts/channel-audit-tests.log)和[网关日志](../../../backend/artifacts/channel-audit-tests.log)。网关使用真实HTTP/WebSocket及隔离SQL存储；Host测试复用原Connection/Gateway但业务服务可为受控夹具，不能称为整套真实电脑模型操作。上传在途取消的Host测试证明原请求体abort、无成功receipt；网关矩阵证明同设备异连接不能注入上传、权限变化取消请求。这不是新增Android系统文件选择器上传中撤销实测，不宣称覆盖所有在途组合。

[当前正式MuMu复查](../../artifacts/channel-audit-current-android.json)：Remote本地页面实际读取59项插件，29 active/26 mobile/4 waiting，关闭后原16回复/空草稿保持。waiting分别对应无管理权限的两个入口和明确排除的交互终端/网站转发；不能把计数本身当成功能验收。产物检查117个Web文件、插件0.1.75/73个后端文件一致，实际管理状态仍active、management=false。

本轮没有生产代码、APK、Key、配置、授权或服务进程变更，没有新模型调用。旧专项的版本、驱动失败和修复过程保留；本轮只复查其明确断言，不冒充全部历史场景在当前APK重跑。根据七项标准关闭KKC-17，具体业务操作及反馈仍由KKC-18/KKC-10完成，不据此关闭总目标。
