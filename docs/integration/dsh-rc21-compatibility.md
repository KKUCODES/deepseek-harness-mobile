# DSH 0.2.1-rc.2 兼容

- 状态：独立修复分支；本次发行 App `0.1.0-preview.6`，配套插件 `0.1.86-latest.0`；2026-10-23 核验。
- 维护角色：DSHM 手机端维护者。
- 来源：[版本与协议能力](../../src/remote-dsh-version.mjs)、[加载器能力](../../src/remote-module-capabilities.mjs)、[共享平台模块](../../src/client-static-modules.jsx)、[主题组合](../../src/plugin-host.jsx)、[原生通知兼容](../../android/app/src/main/java/dev/dshmobile/validation/RemoteDshCompatibility.kt)。

## 规则

手机运行兼容范围为 `>=0.2.0-rc.2 <0.3.0-0`，包括范围内的预发布版本；固定构建依赖与运行兼容范围分开维护。正式构建固定官方rc.2 SDK与对应只读源码，电脑旧版本继续兼容。alpha.2构建选项保留作诊断；alpha.1和更旧SDK的原有精确匹配行为保留。

范围内仍检查 transport 2、RPC/流/模块图/资源通道、会话读取和订阅端点。加载业务模块前检查原加载器的工厂与公共接口；缺能力返回明确提示。可选定时目录按电脑实际宣告的 `schedule/list` 开启，不靠版本硬相等。原生通知使用同一范围及独立的流/通知能力检查，JS 与 Kotlin 共享92条回归样例。

不修改 DSH 本体、SDK 包或 Electron。电脑仍执行任务，手机只接入批准后的会话，权限与端点白名单保持。

## 启动与主题

rc.2 官方平台静态模块增加了 `zod` 和 `@tanstack/react-virtual`。原 DSHM 未注册，实际导入在 bootstrap 后报 `require("zod") missed module table`。普通聊天、Remote、诊断入口现在共用一份平台单例表，原 remotes 模块可正常导入。

主题初始化原来只对字符串 `0.2.1-alpha.2` 提供默认字段。使用 rc.2 SDK 时字段缺失，真实主题插件无法激活。现在按协议族提供字段，保留激活失败审计；没有把异常降级为警告。

用户报告的“同步占满线程”尚未独立复现，不能把缺模块异常等同于同一个死循环根因。真实 rc.2 连接入口已能完成装配。一次重载回归误把项目首页当作应恢复聊天输入框，已修正测试断言；该次不计产品卡死证据。

## 验证入口与边界

- [真实 Android 驱动](../../scripts/verify-rc21-android.mjs)：专用 UID、普通聊天进入 Remote、原生配对、电脑批准、工作区/聊天输入区、页面重载后重连、原生通知订阅、撤销。
- [原主题条件回归](../../scripts/verify-rc21-theme.mjs)：只在诊断响应恢复旧条件，可复现 `inactive_plugins:@deepseek-ai/dsh-client-ui-theme`；修复条件正常启动。
- [模块导入诊断](../../scripts/diagnose-rc21-startup.mjs)：原官方 CLI 图与 bundle，实际 `RemotePlugins.prepare()`；该隔离诊断跳过配对，不代替 Android 全链路。
- Android 新增 `--official-rc21` 自有 Web 构建和隔离 `rc21test` 包，供原 rc.2 SDK 验证；默认 alpha.2 构建使用隔离 `compatibilitytest` 验证。均不覆盖用户 App。

### 2026-10-23 实测矩阵

两种隔离APK分别内置alpha.2、rc.2 SDK，使用同一份自有GitHub插件载荷和原官方CLI。下表核心入口包含普通聊天启动、三种主题、配对/批准、工作区读取、打开聊天输入区、重载重连、原生通知订阅和撤销；不是模型推理测试。

| 电脑官方DSH | alpha.2 SDK手机 | rc.2 SDK手机 |
| --- | --- | --- |
| `0.2.0-rc.2` | 通过 | 通过 |
| `0.2.1-alpha.2` | 通过 | 通过 |
| `0.2.1-rc.2` | 核心入口通过，但4个界面插件激活失败；不用于正式构建 | 通过；插件清单无failed项，主题active |

这次对照说明只放开Host版本还不够：alpha.2平台单例与rc.2界面模块存在接口差异。正式构建改用rc.2平台，已验证继续连接两版旧Host；没有把旧SDK的部分可用当作完整插件兼容，也没有合并此前插件适配分支。

本机报告在忽略目录 `artifacts/rc21/android-<DSH版本>-<compatibilitytest或rc21test>.json`，对应PNG；主题回归为 `theme-regression.json`，导入诊断为 `loader-diagnosis/report.json`。Node全套518项通过，原生共享92条样例在Android设备上通过；两种APK构建及lint通过。断言失误的旧失败截图、缺静态模块的修复前报告保留，不能把旧失败当作新结果。

默认CI路径也已独立安装原包、构建Web、无签名Release APK及lint；该项是本机无签名构建验证；公开签名包由远端 Actions 另行生成。只读源码固定 `687f282e8625c6b8d11ff58211a90524be2e4317`，SDK锁定rc.2；应用ID、签名配置及本地数据格式不变。

没有调用真实模型，也没有覆盖 Electron、真机、公网带宽、全部插件、文件/Office及所有审批生命周期；不能据此宣布所有功能全面兼容。

## 分支

`fix/dsh-0.2.1-rc.2` 从已发布 main 创建。未合并或摘取 `feature/plugin-adaptation`；本地 npm 插件安装和此前通用插件宿主阶段仍留在原分支。本修复需同时更新 App 与电脑插件，公开 preview.5 和插件0.1.85旧下载不会自行获得新代码。
