# Remote 连接诊断

- 状态：手机端本地实现；原签名候选 APK 已覆盖安装 MuMu，未提交、推送或发布。
- 维护角色：手机端维护者；核验日期：2026-10-25。
- 任务：[KKC-95](https://linear.app/kkcodes/issue/KKC-95)。设计依据：Figma `4O2ww8JdFAYnZRLVo7on83` 的连接诊断及聊天入口位置示意。聊天正文、工具、审批、输入区和插件插槽继续沿用现有实现。

## 用户入口

连接、配对或读取失败处可点击「查看诊断详情」。已进入聊天时，只在已有断线提示内增加同一入口；历史读取失败也能查看当前错误。Remote 的「电脑连接 → 问题诊断」查看最近记录，原版本/兼容信息保留在「应用与兼容信息」。普通聊天的原诊断入口保持原行为。

详情先显示失败摘要、阶段和建议；异常类型和栈位置需展开「技术详情」。支持复制脱敏报告及复制结果反馈。未提供异常栈时明确说明，不生成示意栈。连接恢复后保留此前失败并标记已恢复，只有真实电脑会话连接就绪才标记恢复。

HTTP 404 只表示服务返回该状态，不自动断言代理故障或电脑离线。网络不可达、超时、TLS、授权、能力协商和传输校验错误分别展示可核验信息；未知原因保留未知。连接失败不会要求用户一律重新配对。

## 实现边界

- [原生存储](../../android/app/src/main/java/dev/dshmobile/validation/RemoteDiagnostics.kt)由 Application 持有，聊天连接和提醒连接各最多5条，共10条；跨进程保留，移除绑定时清理。后台重复失败不会清空全部前台证据。
- [RemoteBridge](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)在原 HTTP/WebSocket 回调采集结构信息，旧世代/已关闭回调不写入；[提醒连接](../../android/app/src/main/java/dev/dshmobile/validation/RemoteNoticeConnection.kt)使用独立来源。没有改动电脑 DSH、SDK、插件或中转协议。
- [页面存储投影](../../src/remote-diagnostics.mjs)拒绝迟到读取覆盖新事件，避免在途请求的派生断线错误覆盖更具体的原生原因。旧 APK 没有新桥时使用最多10条内存回退，不阻塞聊天；原生栈及跨进程保留需要本次 APK。
- [诊断窗口](../../src/ui/RemoteDiagnostics.jsx)使用现有 Surface 和原生 dialog 返回优先级；自有明暗样式仅挂在独立窗口，聊天内只增加14px/44px点击区域的链接，不覆盖插件样式、工厂或组件。

## 数据最小化

持久化与复制均逐字段白名单投影。只保留随机诊断 ID、时间、来源、固定阶段/错误码、HTTP/关闭码、已知关闭原因，以及最多3层异常、共18个栈位置。

不保留 Throwable.message、原始 Error.stack、HTTP 正文/头部、任意关闭文本、地址、设备身份、Key、票据、聊天或草稿。原生只接受应用/平台/网络库的结构化帧；JavaScript 只接受自有资源文件名与行列，去除函数名和 URL。报告不会自动上传，复制仅由用户主动触发。

## 已执行验证

| 入口 | 结果与限制 |
| --- | --- |
| [字段与状态单测](../../tests/remote-diagnostics.test.mjs) | 7项通过：404阶段、未知信息投影、自有安全帧、有界旧桥回退、恢复、迟到读取和派生错误不覆盖。之前完整571项 Node 基线通过；随后新增3项上述状态测试通过。 |
| [正式 RemoteApp 回放](../../scripts/verify-remote-design.mjs) | HTTP404摘要、详情展开、复制、Escape关闭、恢复后历史、390/320px明暗主题通过；截图已目视检查，无横向溢出。使用隔离网络/模型，不能冒充真实认证。 |
| 原页面恢复及会话返回 | [恢复脚本](../../scripts/verify-remote-app-recovery.mjs)19种场景通过；[会话路径](../../scripts/check-remote-back-navigation.mjs)覆盖项目层级、草稿、原生返回、自有窗口、插件菜单/模态/面板/设置优先级。 |
| [Android 检查](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteDiagnosticsChecks.kt) | MuMu Android12 执行真实本机 HTTP404 WebSocket 失败、Throwable 安全过滤、原因分类、有界存储、重启重读、恢复标记及无栈关闭，全部通过。独立测试包已移除，不接触用户配对。 |
| 构建与安装 | rc.2 原 SDK 页面构建、release/debug/test APK 和 lintRelease 通过。原包名/code16/原证书覆盖安装 `preview.13-remote-ui-diagnostics`，没有卸载主包或清数据。 |
| MuMu 正式 App 入口 | 从普通聊天抽屉进入 Remote，沿原有配对实际连接电脑并显示工作区；「Remote 选项 → 电脑连接 → 问题诊断」显示最近记录空态，系统返回只关闭窗口，底层仍已连接。没有发送消息、执行审批或改动用户网络配置。 |

原签名 SHA256 为 `d97f5b68c6a327f4ae455834ba30f23ce7b64f2eeafd8a222e0e74b0a998e51e`；APK SHA256 为 `d733a4d9bdd6ba9d3002e9de56565d79d157380c6c95b7555385fae5bfc3c4ed`。APK、安装信息及截图在忽略目录 `artifacts/remote-diagnostics-install/`，页面回放在 `artifacts/tests/remote-design/`。不提供私钥或凭据。

既有同条件网络排查曾证明 MuMu 直连 WebSocket 返回101，经本机代理返回404；按用户要求移除模拟器代理后，用户确认连接成功。此结论只适用于当时链路，不将所有404都归因代理。

尚未在多款物理手机、所有 WebView/代理/证书错误组合上复测；远端未提供原因的正常关闭依然只能报告关闭码/未知原因。诊断不自动重放消息、审批或其他写操作。
