# Remote 资源缓存与数据差量

状态：已随 `0.1.0-preview.4` 公开预发布。维护：DSHM 手机端；核验日期：2026-10-15。任务：KKC-60、KKC-62。

## 当前规则

- App 页面仍随 APK 打包。电脑下发的插件资源写入 App 私有临时目录，按绑定身份和完整资源地址隔离；单项最多 16 MiB，总量最多 64 MiB / 256 项，总量超限淘汰旧项。超过单项上限的资源直接读取、不落缓存。
- 本地字节先核对 SHA-256，再通过当前已认证连接发送 HEAD。电脑原模块注册表仍须允许访问，且当前内容指纹一致才复用；更新、删除、断线或拒绝不返回旧资源。未提供指纹的旧插件保持完整读取。
- 只读基线缓存覆盖 `session/list`、`session/page`、`session/control`、`workspace/follow`、`session/follow`。手机按绑定、DSH 版本和原请求隔离；电脑额外按当前授权范围隔离。每次仍读取电脑的权威结果，只将未变化子结构替换为旧基线引用，再由手机验证完整摘要和还原。
- 这不是 DSH 内部增量读取，也不改变 Host 日志或事件序号。连接期间的原实时流继续原样传输；模型、审批、提问与写操作不使用此缓存，不重放旧决定。
- 单个基线最多 2 MiB。手机最多 128 项 / 16 MiB，电脑最多 128 项 / 32 MiB，超过七天不复用。大结果、复杂结构、插件重启、基线丢失或存储失败回退完整结果；坏差量仅重新请求一次只读完整基线。
- 清理临时缓存、移除绑定或授权失效会使缓存失效；原生清理代次持久化，关闭的 Remote 页面再次打开时也会清除旧数据。正常重连不会清空有效资源和基线。

## 兼容与交付

配套电脑插件协商 `syncCacheVersion: 1` 后启用数据差量。扩展字段 `_dshmSync` 位于现有 RPC payload，进入原 DSH Gateway 前由插件剥离；现行中转的已知只读接口可原样转发，无需升级公网网关。旧 App / 旧插件分别保持原行为，不要求 DSH 本体补丁。

手机端 `0.1.0-preview.4` 与插件 `0.1.85-latest.0` 需配套更新才有完整优化。旧 `0.1.0-preview.3` 和插件 `0.1.84-latest.0` 没有这次优化；新版本均已公开预发布，附件已匿名下载核验。

共享协议已先推送到 `056bf6f19527c58f456ee5f7eec55e715f401ab5`，手机端与插件 `ci/release.json` 均固定到该真实提交，再升级版本并重建插件 `lib/` 安装载荷后运行 Actions。APK 的构建、lint、原签名和公开发行检查通过；插件三版构建、载荷一致性及 rc.2 / alpha.2 官方安装/Web/卸载通过。此顺序不涉及中转服务器部署。[发行与下载核验](../releases.md#已核验范围)。

## 已执行验证

| 范围 | 结果 |
| --- | --- |
| 手机 Node 回归 | 500 项通过；真实编码器＋手机传输边界覆盖重开、移动窗口、新增/删除、实时增量、坏差量单次只读重试、身份隔离、原生清理代次和不缓存写操作。 |
| 插件新增回归 | 4 项通过，包含旧中转结构接受、元数据剥离、未变化引用、窗口移动、设备/授权隔离、淘汰、超限与资源更新/删除。 |
| SDK 与构建 | 同一插件源码分别通过官方 `0.2.0-rc.2` 和 `0.2.1-alpha.2` 隔离 SDK 的声明/运行构建；手机官方 alpha.2 Web、Android 调试 APK、测试 APK 和 lint 通过。默认旧 SDK 的全仓类型检查仍因既有缺包失败，不计通过。 |
| 原生资源专项 | MuMu instrumentation 通过持久缓存、HEAD 校验、内容更新/删除、换身份、损坏、清理、取消及排队连接隔离。 |
| 正式 Remote 路径 | 官方 alpha.2 原 CLI＋新独立插件候选＋原生产网关实现＋MuMu 独立 `toolstyletest` UID。完整结束进程并正常打开三次，24 个原消息节点保持，电脑改名实时同步、重开后保持新值，损坏资源重新下载恢复。 |

本轮真实字节统计：

| 场景 | 资源 GET / HEAD | 资源正文 | 编码后的首批基线 |
| --- | --- | ---: | ---: |
| 首次打开 | 3 / 0 | 12,299,991 B | 157,550 B |
| 内容未变，结束进程后重开 | 0 / 3 | 0 B | 7,937 B |
| 电脑修改后再次重开 | 0 / 3 | 0 B | 8,010 B |
| 故意损坏资源后重开 | 3 / 0 | 12,299,991 B | 989 B |

统计不包含连接、鉴权、普通实时消息和其他 RPC，不是完整网络流量或公网速度。测试只复制已验收的专用聊天日志，不复制 profile、Key 或日常会话；没有发模型请求。测试设备已撤销并移除绑定，独立 Host/网关/映射已关闭，原专用日志摘要保持。正常使用的 App 与 Host 未升级或重启。

首次观测器未识别 Host URL 的 `transport` 查询参数，报告失败；修正后发现大资源超过初设 8 MiB 缓存上限，再调整为 16 MiB。失败报告保留，不当作通过。

真实证据：[通过报告](../../artifacts/remote-sync-cache-android/670750a7-181d-4373-aa5b-9ad8b6a2cb50/report.json)、[原始统计](../../artifacts/remote-sync-cache-android/670750a7-181d-4373-aa5b-9ad8b6a2cb50/cache-cases.json)。它们属于本机忽略产物，不随 Git 分发。rc.2 只做构建核对，真机、公网以及任意第三方插件的热更新仍未据此通过。

最终结构引用优化和缓存流 close 后拒读补验后，[整轮复验](../../artifacts/remote-sync-cache-android/17e36f9b-7ae2-4615-9f10-6ec7d2373b60/report.json)再次通过，以上字节统计相同。解码失败的重试使用本机专有标记识别，远端同名错误不能触发写操作重发；该负例、完整 500 项 Node 和最终普通候选构建/lint 均已通过。

## 代码与复验入口

- [手机缓存](../../src/remote-sync-cache.mjs)、[正式传输](../../src/remote-transport.mjs)、[App 接入](../../src/RemoteApp.jsx)。
- [原生资源读取](../../android/app/src/main/java/dev/dshmobile/validation/RemoteResources.kt)、[缓存文件与限额](../../android/app/src/main/java/dev/dshmobile/validation/RemoteResourceCache.kt)、[清理通知](../../android/app/src/main/java/dev/dshmobile/validation/DshmApplication.kt)。
- [共享差量工具](../../../backend/packages/protocol/src/sync-cache.ts)、[电脑缓存](../../../plugin/src/sync-cache.ts)、[资源指纹](../../../plugin/src/resource-validator.ts)、[原接口接入](../../../plugin/src/remote-adapter.ts)。
- [Node 用例](../../tests/remote-sync-cache.test.mjs)、[原生用例](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteResourceChecks.kt)、[Android 实测](../../scripts/check-remote-cache-android.mjs)。

先构建共享协议和两版插件候选、官方手机 Web；Android 使用既有 `remoteToolLayoutTest=true` 的独立 UID。运行 `scripts/verify-remote-motion-android.mjs --cache-sync`，显式设置 `DSHM_ADB_PATH` 与 `DSHM_ANDROID_SERIAL=127.0.0.1:16384`；该命令只安装到独立 UID，并使用本机自有测试配置。原生测试入口为对应测试 APK 的 `resourcesOnly=true`。不要用旧基线包或日常 App 替代此范围。
