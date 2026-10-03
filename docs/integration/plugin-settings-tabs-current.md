# Remote 插件设置分页

- 状态：已接入 DSHM 自有入口，新版 MuMu 正式路径通过。
- 维护角色：项目协作 Agent；核验日期：2026-09-28（香港时间）。
- 来源：原 [PluginsSettingsSection](../../../deepseek-harness/packages/client/ui-settings-plugins/src/client/PluginsSettingsSection.tsx)、原 [注册契约](../../../deepseek-harness/packages/client/ui-settings-plugins/src/client/index.ts)、手机[组合](../../src/remote-plugin-settings.jsx)、[呈现](../../src/remote-plugin-slots.jsx)、[权限与入口](../../src/ui/RemotePlugins.jsx)。

## 实现与取舍

此前原 settings-plugins 整个 apply 因通用 credentials 未开放而等待。四种配置卡片已有受限手机组合，但该包声明的 settings.plugins.tab 没有被声明/呈现，因此插件清单及其他贡献该插槽的插件缺少可访问页面。

新增“Remote 选项 → 电脑插件 → 插件设置”。手机组合原 PluginsSettingsSection，按原插槽顺序及语言版本生成稳定分页列表；子页面使用原 list/root、空 owner，原组件负责懒加载、切换保留和键盘导航。插件局部界面继续经过既有外层缩放，用户/作者设置优先级不变。管理授权和在线状态是呈现前提，失去任一条件后不挂载插件内容。

没有开放通用凭据/设置读写，也没有启动桌面根页面。相比补开任意 credentials/set，只补齐缺失的组合职责，保留已有受限 Host 通道；ui-settings-plugins 状态改为 mobile，表示配置卡片和分页由手机组合，不代表原 apply 原样运行或任意第三方设置均可用。ui-settings-models 的通用凭据依赖仍待处理。

## 验收矩阵

| 范围 | 结果与证据 |
| --- | --- |
| 生产入口 RED/GREEN | [页面检查](../../scripts/check-plugin-settings-tabs.mjs)在修改前因缺少“插件设置”按钮[失败](../../artifacts/settings-tabs-red.log)，修复后[通过](../../artifacts/settings-tabs-web.json)。两页签切换、root作用域、600→337px、收权清理、卸载均检查。 |
| 回归与构建 | [完整页面](../../artifacts/settings-tabs-full-web.log)、[13项设置/布局测试](../../artifacts/settings-tabs-unit.log)、[Web构建](../../artifacts/settings-tabs-build-web.log)、[Android构建/lint](../../artifacts/settings-tabs-build-android.log)通过，新APK覆盖安装未清数据。 |
| 真实电脑插件→手机 | [独立插件](../../tests/fixtures/live-settings-tabs-plugin/client.js)由原CLI安装，经真实模块图到MuMu；[17:03 UTC报告](../../artifacts/settings-tabs-live-android.json)显示内置插件列表/验证一/验证二，计数跨页保留、无会话作用域、600→380px；[截图](../../artifacts/settings-tabs-live-android.png)已核对。 |
| 卸载与原清单 | 原CLI卸载测试插件后，[17:04报告](../../artifacts/settings-tabs-removed-android.json)确认测试页签消失，原插件清单可读取（当前会话29、全局167）；仅此次部署的计数，不作为固定产品常量。 |
| 权限清理 | 临时管理按既有授权开启，测试后收回；[真实拒绝报告](../../artifacts/settings-tabs-denied-android.json)确认重连后无分页内容、管理提示正确、原聊天草稿保留。本轮无模型请求、Key或电脑设置修改。 |
| 当前插件状态 | [17:04目录](../../artifacts/plugin-compatibility-inventory-android.json)59项：29 active、25 mobile、5 waiting，无failed。旧快照保存在[变更前报告](../../artifacts/plugin-compatibility-before-settings-tabs.json)。 |

[Android驱动](../../scripts/verify-settings-tabs-android.mjs)分live/removed/denied三阶段，不安装插件、不授予权限，不提交设置。实际手机覆盖主聊天入口，旁栏通过共享页面组合，不宣称单独完成其手机专项。断线时的组件移除由现有连接组件与页面回归覆盖，未在本项重复停止DSH。

本项补齐R13分页扩展；原模型整包、通用凭据及其他[收尾缺口](./completion-audit.md)仍保留，localhost网站预览待定。
