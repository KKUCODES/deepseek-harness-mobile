# 预装手机插件与恢复安装

后续[主题与原图标修复](./remote-theme-current.md)将当前预装包更新为0.3.1，安装/卸载保持规则不变。以下0.1.0/0.2.0矩阵保留首次预装功能的历史验收，不是当前包版本。

- 状态：实现与下列范围验收完成，纳入preview.14/code22，当前预装0.3.1；公开包结果见[发行核验](../releases.md#已核验范围)。下文旧包与未发布描述保留首次验收阶段。
- 维护：手机端维护者；核验日期：2026-10-26；任务：[KKC-103](https://linear.app/kkcodes/issue/KKC-103)。
- 范围：仅手机端；不修改或打包DSH，不合入旧npm/桌面插件适配分支，保留现有Key、聊天、配置与配对。

## 构建与加载

[preinstalled-plugins](../../preinstalled-plugins/README.md)内的完整`.dshm-plugin`包进入APK原生资产。默认放置「Remote 新版首页」0.1.0；没有包时不预装。预装原件和网页热更新资源分开，仍不将首页JSX直接编译进宿主JS。

[构建检查](../../scripts/check-preinstalled-plugins.mjs)复用[SDK包校验](../../packages/plugin-sdk/package.mjs)，拒绝不合法文件名、字段、API、摘要、大小、重复ID和超过32个包。Gradle每次校验并Sync预装目录，始终生成清单；即使目录为空，Sync仍运行并删除上次构建留下的包。实际测试了从有包输出切换到空目录：输出只剩空清单；正常构建再恢复默认包。

[PhonePreinstalledPlugins](../../android/app/src/main/java/dev/dshmobile/validation/PhonePreinstalledPlugins.kt)从APK资产读取包，调用已有`PhonePluginPackages.parse`复核。首次安装与恢复都进入[PhonePluginStore](../../android/app/src/main/java/dev/dshmobile/validation/PhonePluginStore.kt)相同的安装提交，运行副本仍由[PhonePluginPackages](../../android/app/src/main/java/dev/dshmobile/validation/PhonePluginPackages.kt)内容地址存储。动态目录、Cordis生命周期和加载器沿用KKC-102，没有按样例包名分支。

## 选择与持久化

| 场景 | 规则 |
| --- | --- |
| 首次遇到预装ID，无记录 | 安装完整包；没有其他已启用首页或旧明确选择时默认启用 |
| 已安装相同/更低/更高版本 | 保留当前版本与启停；APK不自动替换，外部版本也不降级 |
| 已卸载 | 保留卸载墓碑，不重新安装。即使安装其他包、预装定义移除再加入也不复活 |
| 明确恢复 | 仅对未安装且可取得预装原件的条目提供；确认后安装当前APK里的版本 |
| 外部更新 | 原系统文件选择、信任确认、版本递增及完整性校验继续适用 |
| 卸载 | 停止并释放插槽后删除私有代码；APK原件仍保留，安装目录提供恢复入口 |
| 运行与故障 | 对应Remote宿主真实激活才显示运行中，停用/失败回退默认首页 |

卸载后的详情显示当前可恢复的预装版本，而非上次安装的高版本；来源同时显示APK预装版本。不会声称已联网检查最新版。恢复前有确认窗口，取消不会改变安装状态。外部更新后仍显示预装来源，运行代码取已安装副本。

本轮选择“自动初始化缺失记录”，保留所有已有选择；另一可行方案是随APK替换已安装旧版本，但会增加外部来源归属及用户选择冲突。本轮不引入这种自动升级。需要新预装版本时，作者更新目录里的完整包；用户明确恢复或从文件更新。

## 验收证据

| 范围 | 结果 |
| --- | --- |
| Node全量 | 591项通过；新增空/缺失目录、真实完整包、重复ID及错误API/摘要/版本拒绝 |
| Android原生隔离专项 | 用实际APK资产和专用存储验证首次安装、重复启动、停用保持、预装高低版本都不替换外部2.0.0、卸载跨升级/其他安装/目录移除再加入保持、显式恢复及空目录；原文件安装/管理测试同时通过 |
| 真实MuMu升级 | 原签名code17上的外部0.2.0升级到code18（APK预装0.1.0），仍显示0.2.0及预装来源；启停、默认回退通过 |
| 真实卸载再升级 | code18卸载后私有目录无脚本，再覆盖安装code19，已安装列表无新版首页；安装目录显示未安装，可恢复 |
| 真实恢复 | 取消确认仍未安装，明确恢复后为0.1.0；打开真实电脑连接，原加载器运行成功 |
| 外部升级 | 从系统文件选择器导入0.2.0并信任，运行版本变为0.2.0，预装来源仍为0.1.0 |
| 页面回归 | rc.2的真实RemoteWorkspace/Cordis页面回放矩阵通过；该回放目录是测试夹具，不当作预装原生证据 |
| 构建 | debug/release/AndroidTest及release lint通过；保留原有重复翻译键和旧API弃用警告，不混入无关修改 |

环境为MuMu Android12实例0、现有官方DSH alpha.2＋电脑插件0.1.81＋公用中转。没有修改电脑设置、读取Key或发送模型消息。最终覆盖安装原签名非调试`0.1.0-preview.13-preinstalled / code19`，仍保留外部0.2.0和原配对；最终APK SHA256：`2d5734808b477875ab76fc8910132fb577026c1d8c6c47301af713c8b7ad635e`。最后的非调试UIA确认0.2.0、预装来源0.1.0、真实连接与运行中均通过。首次等待时曾停在连接中，随后自动恢复；不把该等待误记为已连接。

当前公开`ci/release.json`仍登记preview.13/code16，没有为本地验收改公开版本。后续发行需分配高于本地code19的版本码，并保持新原生能力的资源兼容边界。

本机证据：`artifacts/tests/preinstalled-plugins/`中的Node日志、隔离测试输出、code18/19测试APK、`DSHM-preinstalled.apk`、卸载/恢复/外部更新截图、`final-release.png`和`verification.json`。测试包结束后移除，用户App未卸载或清数据。没有在用户主包执行全新清空安装；首次初始化通过实际APK资产的隔离原生路径验证。未覆盖所有真机、真实磁盘写满或所有断电时序。

源码：[Gradle资产构建](../../android/app/build.gradle.kts)、[Application初始化](../../android/app/src/main/java/dev/dshmobile/validation/DshmApplication.kt)、[恢复入口](../../src/ui/PhonePlugins.jsx)、[隔离原生测试](../../android/app/src/androidTest/java/dev/dshmobile/validation/PhonePreinstalledChecks.kt)、[包/目录测试](../../tests/preinstalled-plugins.test.mjs)。
