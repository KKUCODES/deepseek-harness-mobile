# 连接前通用界面宿主与默认回退

- 状态：preview.15本地实现、原签名安装MuMu并验收；未提交、推送或发行。维护：手机端维护者；核验：2026-10-27；[KKC-123](https://linear.app/kkcodes/issue/KKC-123)。
- 先前待连接页固定在宿主、不读插件状态的证据见[诊断](./remote-connection-plugin-diagnosis.md)。本次仍在`release/preview15-from-preview11`，保留已有图片/思考/UI工作，不修改DSH本体、电脑插件或中转，不混旧适配分支。

## 交付边界

[RemoteInterfaceHost](../../src/remote-interface-host.jsx)独立拥有本地Cordis、原SlotRegistry和原renderer，以及既有MobileInterfacePlugins/PhonePluginHost。它在RemoteApp打开时创建，连接前即可加载已安装界面；连接模型组装后借用同一实例，重建电脑模型不抢占另一份运行租约，也不重复激活界面包。

原renderer根含session-maybe域，因此本地宿主安装明确的无Session绑定与原renderSessionArea；要求具体Session会抛错。没有伪造会话/认证或引入电脑服务。与把新版连接页留在宿主按包名开关相比，该方案保留真实外部包、统一安装/卸载及第三方替换能力；没有把完整电脑插件组合提前到连接前运行。

两个根页面槽为`dshm.remote.home`和`dshm.remote.connection`。安装器包格式/API v1不变，原surface字段保留为界面选择组；可选连接页用`slots.inject`声明。旧首页包在新宿主的连接页使用默认视图；新样例的可选注册在没有连接槽的宿主不执行。没有修改原生包验证、内容地址约束或安装授权。

[RemoteConnectionPage](../../src/ui/RemoteConnectionPage.jsx)保留配对控制器，仅投影状态及限定操作；默认连接布局来自.11，保留现有粘贴、读取重试、诊断和当前授权提示。链接与设备名称仍在原RemoteApp状态中，宿主表单/身份/诊断节点经私有Context读取，不把配对链接、Key、凭据或原生桥放进公开owner。插件与宿主共享JS环境，这不是恶意代码沙箱。

[独立界面0.4.0](../../packages/remote-home-design/connection.jsx)提供新版连接页与原首页；插画原SVG和几何从既有实现移入包，控件用公开手机色板、样式限定插件根。源码不导入宿主私有组件；构建metafile确认独立包源码和旧remote-connection.css均未进入宿主JS/CSS。新版完整包经同一SDK构建并进入预装目录，不在宿主按插件名分支。

停用/卸载会释放整个模块及两个槽；模块加载或任一页面呈现失败也回退默认视图，并报告真实失败状态。缺某个可选槽时只回退该页。待连接页在ready后不挂载；聊天、导航、配对/重试、诊断、审批和数据所有权不迁入插件。

## 回归与真实入口

| 验收 | 结果 |
| --- | --- |
| rc.2/alpha.2实际RemoteApp＋真实本地宿主/插件页 | 未配对、待批准、连接中、读取中、读取失败、电脑离线，各自停用/启用/卸载、加载失败/渲染失败、另一款连接模块和旧首页包均通过 |
| 配对表单与能力边界 | 切换/卸载后链接与名称保持，未自动重新claim或forget；公开owner不含原生call/链接/Key/凭据字段 |
| RemoteApp模型替换 | 读取完成→显式模型重建，界面模块仅激活一次，原草稿保持，两SDK通过 |
| 既有完整首页回归 | 实际RemoteModel/Workspace、统一插件页、卸载/恢复、默认首页、连接世代、会话/草稿/阅读位置、主题与第三方焦点隔离通过 |
| 其他回归 | 580项Node、原19项连接恢复、图片及思考专项通过；预装代码摘要与当前SDK源码构建一致，原连接插画字节经SDK/实际组件输出核对 |
| 构建与隔离 | 网页及Android release/lint通过，原签名；无DSH/插件/后端修改，无原生安装器协议变更 |

入口：

```text
node scripts/verify-connection-interface.mjs
node scripts/verify-connection-interface.mjs --alpha2
node scripts/verify-mobile-interface.mjs
node scripts/verify-remote-app-recovery.mjs
node scripts/verify-preview15-history.mjs --images
node scripts/verify-preview15-history.mjs --reasoning
node --test tests/*.test.mjs
```

连接矩阵运行真实RemoteApp/本地宿主和插件管理，但连接生命周期使用明确的替身，不代替鉴权/真实网络验收；待批准、读取失败和插件故障注入来自该回归。额外模型重建测试最初用空的mock reconnect等待generation，因替身没有真实引擎而超时；改走RemoteApp正式requestRebuild入口后通过，未为此改生产重连逻辑。renderer的session-maybe适配缺口也已在真实页面测试发现并补齐明确的无会话绑定。

## MuMu验收

原签名覆盖`dev.dshmobile.validation.officialtest`，preview.15/code25。初次保留已安装0.3.1和原停用选择，没有让新预装包覆盖用户版本；主动卸载后才从插件页确认恢复0.4.0。实际连接前运行中、运行时卸载后默认待连接页出现、重新恢复安装均验证。再次覆盖APK时卸载记录仍保留，没有复活插件。

恢复最终0.4.0后经原配对重新连接公用中转/电脑，显示新版项目首页，打开原「DSHM 真实 DeepSeek 长聊天测试」中的50轮会话，原回答正常；没有发新模型请求、改Key、重新claim或操作审批。随后通过真实插件页停用，项目首页和待连接页均回到默认。最终0.4.0仍安装但已停用，MuMu停留默认待连接页，保留原配对/聊天。

APK为`artifacts/DSHM-preview15-connection-ui.apk`，SHA256 `1810a3e5fec25dc9c30a4c19e27b384360b992b08280bd1eb6254f2292562143`；安装base.apk同哈希、211网页文件逐个核对，原证书一致。最终预装/恢复包代码摘要`a17fdeda1ed5f7399a6cee4d1428e0135486873d5b8a080db3e66cd85b218a7c`。中途样例布局验证使用同版本早期候选，最终安装产物以本段哈希为准。

截图留在忽略的artifacts：`connection-ui-enabled.png`、`connection-ui-uninstall-active.png`、`connection-ui-plugin-disabled.png`、`connection-ui-home-default.png`、`connection-ui-chat-preserved.png`、`connection-ui-final-default.png`；安装核对`connection-interface-installed.json`。已视觉核验新旧连接布局；没有在MuMu重新制造待批准/插件故障注入，不能将页面矩阵与原配对实测合并成全部真机场景已验。

作者文档：[公开字段与示例](../plugins/remote-home-api.md)、[开发指南](../plugins/development.md)、[SDK0.1.1](../../packages/plugin-sdk/README.md)。中英README明确区分本地连接页扩展与已发布preview.14。
