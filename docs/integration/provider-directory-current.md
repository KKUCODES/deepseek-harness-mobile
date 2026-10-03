# Remote 提供方目录实时同步

- 状态：自有模型设置入口已修复，新版 MuMu 的电脑事件及手机管理路径通过。
- 维护角色：项目协作 Agent；核验日期：2026-09-28（香港时间）。
- 来源：[手机目录组件](../../src/ui/RemoteProviderSettings.jsx)、[固定管理服务](../../src/remote-settings.mjs)、原[模型设置更新订阅](../../../deepseek-harness/packages/client/ui-settings-models/src/client/index.ts)及[原目录控制器](../../../deepseek-harness/packages/client/ui-settings-models/src/client/store.ts)。

## 当前行为

### 新增与已有提供方之间保留草稿（2026-10-02）

对照原ModelsSection中各类卡片独立保留状态的契约，发现手机仅保留已有提供方之间的草稿；选择已有路由会卸载RemoteProviderCreation。[回归](../../scripts/check-provider-directory-sync.mjs)先复现返回后新增表单数量为0，见[失败日志](../../artifacts/provider-creation-draft-before.log)。现改为隐藏并禁用隐藏区域交互，完成创建并进入设置后重新建立新增表单，避免保留成功结果而无法再次创建。关闭目录、换连接或收权仍释放表单；不跨进程保存新增草稿，不改协议和凭据接口。

[专项](../../artifacts/provider-creation-draft-after.log)、[完整页面回归](../../artifacts/provider-creation-draft-full-web.log)、[Web构建](../../artifacts/provider-creation-draft-build.log)、[APK与lint](../../artifacts/provider-creation-draft-android-build.log)通过。页面回归使用已有协议schema的测试响应，只验证UI，不替代Host。

新版正常APK安装MuMu后，[真实驱动](../../scripts/verify-provider-switch-android.mjs)经正式普通→Remote→电脑设置入口，连续创建两个独立无Key路由，再填写第三份未提交草稿，切换已有路由后返回，标识和地址保持。已有路由独立草稿、关闭释放、真实移除及聊天草稿保持均通过，见[17:39:58Z报告](../../artifacts/provider-creation-draft-android.json)。两个测试路由已删除，第三份草稿取消、管理权限收回，聊天授权保留；没有模型请求或修改已有Key。完整models整包仍未接入，本修复仅补齐新增表单生命周期。

### 提供方表单重读失败保留草稿（2026-10-02）

此前官方设置表单的失败保护未覆盖ProviderForm。新增[回归](../../scripts/check-provider-directory-sync.mjs)实际复现重读失败后输入框数量为0，见[失败日志](../../artifacts/provider-form-read-before.log)。现失败保留已显示表单与各类草稿，以服务快照是否仍匹配判定失效；失效时禁止提交、确认协议及启用Key，成功重读后才采用电脑值。本地校验未失效时仍可修正，不更改服务中的未知写入保护。首次读取失败仍不伪造表单。

[专项](../../artifacts/provider-form-read-after.log)、[完整页面回归](../../artifacts/provider-form-read-full-web.log)、[Web构建](../../artifacts/provider-form-read-build.log)和[Android构建/lint](../../artifacts/provider-form-read-android-build.log)通过。新版APK覆盖安装后，17:08:20Z [MuMu实际报告](../../artifacts/provider-switch-validation-android.json)通过两个独立无Key提供方的创建、切换草稿保持、本地空超时值拒绝后保留、修正可提交、关闭丢弃及正式删除，原聊天草稿保持。没有发送模型请求或改变已有提供方；临时管理已收回。真实Host读取故障本次未注入，故障重试证据限于页面协议回放，不描述为Android故障验收。

安装APK后App未启动导致第一次驱动失败，报告保留在[启动失败记录](../../artifacts/provider-switch-validation-startup-failed.json)，未创建提供方。正常启动后重跑通过，没有重启DSH或网关。

### 切换提供方保留编辑草稿（2026-10-01）

原电脑ModelsSection为不同卡片保留编辑状态，手机却用selected作为唯一ProviderForm键，切换就销毁上一表单。[新增回归的修复前报告](../../artifacts/provider-switch-before.log)确认返回后“Unsaved phone draft”变为电脑值Renamed。现只挂载本轮访问过的提供方，切换时隐藏并inert，表单输入使用独立useId；目录移除对应条目、关闭目录、收权或更换连接时释放。相比将所有嵌套表单状态搬到全局仓库，此方案复用现有模型、协议、Key与插件卡片状态，不另建保存路径。

[专项回归](../../artifacts/provider-switch-after.log)与[完整页面回归](../../artifacts/provider-switch-full-web.log)通过，涵盖切换双草稿、目录改名、失败保留、迟到读取、移除及关闭。Web/Android构建通过，新APK已覆盖安装。

[15:21正式MuMu结果](../../artifacts/provider-switch-android.json)经真实管理接口新增两个随机专用提供方（127.0.0.1:1，无Key、无模型请求），填写不同未提交名称，来回切换各自保持；只有一份可见表单，另一份隐藏且inert。关闭目录重开后草稿释放，随后通过正式确认界面移除两路由；原聊天编辑器HTML保持，errors为空，管理权限已收回。依据[实际驱动](../../scripts/verify-provider-switch-android.mjs)。未修改已有提供方配置。

前置失败保留：内测声明遮挡、聊天页无首页连接点、权限改变后需手动重连，以及新增表单select标签的精确文字匹配错误。截图证实目录为空且新增表单实际已显示，最后使用combobox名称定位通过；不能把驱动错误记为业务失败。最终报告内两个明确测试路由均removed，不清理来源不明的配置。该范围不等同跨进程草稿持久化或全部设置功能完成。

15:23追加[正式保存专项](../../artifacts/provider-switch-save-android.json)：在新建的两个独立测试提供方中，A/B均填写不同草稿，仅保存当前B；电脑目录事件将B名称更新，隐藏A草稿仍保留。关闭目录后重新从电脑读取，A未变为草稿值，B为已保存值，证明没有跨提供方误写。测试路由均通过正式确认移除、聊天HTML保持、errors为空，管理权限再次收回。脚本`--save`模式保存独立报告，不覆盖上一轮只编辑未提交内容的证据；未调用模型或触碰Key。原生端点使用独立useId，其余子表单用隐式label，无新增固定ID冲突。生产代码/APK本轮未变。

原手机目录只在展开或手动刷新时读取，电脑新增、改名、移除提供方不会反映到已经打开的列表。现于目录打开且获管理授权时订阅 settings/document-updated 和 llm/adapters-updated；事件触发既有只读 providerSettingsList，不新增权限或通用 settings 接口。

选择原事件而非轮询，与原 DSH 的目录失效规则一致，关闭面板后不持续请求。读取串行，变化中的旧响应不发布，事件合并为后续重读；换连接时取消旧请求并等待服务锁释放。自动或手动刷新目录只更新目录，仍存在的选中表单不重挂载，因此未保存草稿保持。电脑已移除当前路由时清除选择；读取失败保留上次目录和表单并显示失败，可手动重试。

手机自己的新增/移除仍走原确认和受限写入；新增成功后点击“查看提供方设置”将选择目标路由。目录更新不重写表单、模型草稿或重新提交设置，表单的版本冲突检查保持。

## 验证矩阵

| 入口/条件 | 证据与边界 |
| --- | --- |
| 生产页面回归 | [修改前](../../artifacts/provider-directory-red.log)等待电脑新增的beta选项失败；[修改后](../../artifacts/provider-directory-web.json)通过。[检查脚本](../../scripts/check-provider-directory-sync.mjs)覆盖新增/改名/移除、草稿保留、刷新失败、迟到请求及关闭后不读。隔离协议回放不代表真实电脑。 |
| 全量回归/构建 | [完整页面](../../artifacts/provider-directory-full-web.log)、[6项提供方服务测试](../../artifacts/provider-directory-unit.log)、[Web](../../artifacts/provider-directory-build-web.log)、[Android assemble/lint](../../artifacts/provider-directory-build-android.log)通过。APK已覆盖安装，未清数据。 |
| 电脑原设置→手机 | [17:34 UTC报告](../../artifacts/provider-directory-live-android.json)：原CLI加载[临时Host插件](../../tests/fixtures/live-provider-directory-plugin/index.js)，仅在随机独立路由上通过原settings.mutate新增、改名、移除。手机自有目录不手动刷新即可同步，改名时未保存草稿仍在，[截图](../../artifacts/provider-directory-live-android.png)已核对。 |
| 手机自己新增/编辑/移除 | [17:35 UTC报告](../../artifacts/provider-directory-own-management-run-android.json)：手机创建专用提供方、确认、进入设置，真实本机HTTP模型发现失败/取消/重试，添加模型并保存重读，最后移除提供方全部通过。新目录事件没有打断确认后导航或模型编辑；无认证HTTP，无模型推理。 |
| 清理与收权 | 原CLI卸载测试插件，[Host最终状态](../../artifacts/provider-directory-host.json)disposed且present=false；手机管理专项的[独立路由记录](../../artifacts/provider-directory-own-management-live-seed.json)cleaned=true。本机测试HTTP已关闭，管理权限收回，日常聊天授权保留；[17:35拒绝验证](../../artifacts/provider-directory-denied-android.json)无管理目录，原聊天草稿保持。 |

实际手机用例由[目录驱动](../../scripts/verify-provider-directory-android.mjs)及[原管理驱动](../../scripts/verify-model-http-discovery-android.mjs)的--directory-regression独立报告执行。测试不读取、替换用户Key，不创建聊天或调用模型。

本项只补齐已支持提供方的目录同步，不等同所有设置字段实时覆盖手机编辑草稿，也不将原ui-settings-models整包标为兼容。原通用凭据/任意第三方设置的边界仍见[兼容目录](./plugin-compatibility.md)和[收尾表](./completion-audit.md)。
