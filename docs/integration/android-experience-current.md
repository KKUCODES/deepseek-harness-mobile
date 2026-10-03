# Android 设置、通知与恢复验收

- 状态：KKC-20 六项现行标准按本地 Android 范围通过；完整 Remote 仍有独立收尾项。
- 维护角色：项目协作 Agent；最近核验：2026-10-04。
- 需求来源：[KKC-20](https://linear.app/kkcodes/issue/KKC-20)的“有效范围与验收标准”、[原功能编号](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md)。

本次读取原始报告字段、相关驱动断言和当前代码；除下述普通聊天独立性专项外，没有重跑全部历史验收。各项保留其版本与环境，不能称为所有 Android 设备或第三方插件都已通过。

| 现行标准 | 权威依据与结论 |
| --- | --- |
| 1. 返回、输入、避让、安全区与外观 | [键盘/字体/主题/触屏与读屏](./appearance-current.md#首版a05验收结论2026-10-03)逐项通过；实际普通及Remote键盘缩小可视区、输入框保持可见。原插件[叠层报告](../../artifacts/global-panel-live-android.json)androidBack=true，背景inert/焦点保持；[诊断窗口驱动](../../scripts/verify-support-diagnostics-android.mjs)在三个正式入口发Android返回并断言只关闭窗口、保留页面。[RemoteActivity](../../android/app/src/main/java/dev/dshmobile/validation/RemoteActivity.kt)沿dialog.cancel再交给页面导航；[系统栏](../../artifacts/system-bars-android.json)核对两模式深浅色与恢复。 |
| 2. 全界面语言、作用域与系统操作 | [语言实际入口](../../artifacts/phone-language-android.json)、[提问/计划](../../artifacts/phone-language-interactions-android.json)、[文件/命令](../../artifacts/phone-language-details-android.json)切换及恢复通过，电脑正文保持原文；其他原生/设置窗口的专项见[外观记录](./appearance-current.md)。[真实SAF附件和模型读取](../../artifacts/ordinary-attachments-android.json)、[回复复制与分享](../../artifacts/ordinary-replies-android.json)、[完整文件保存/分享](./files-delivery-current.md)通过。系统分享只验到选择器，不替用户发送；系统窗口语言由Android控制。 |
| 3. 前台/后台通知、去重与跳转 | [九项通知规则](./notifications-current.md#首版通知验收结论2026-10-03)逐项通过。本次复读前台bannerOpenedTestChat、后台300119ms后真实审批/提问、完成正确会话、失败分类开关、电脑结算移除等原字段；不以受控请求冒充所有模型错误。 |
| 4. 进程结束、重连、模式独立与未知写入 | [真实进程退出](../../artifacts/killed-notification-live.json)在释放电脑响应前确认旧PID消失，无唤醒/新通知，重开读回结果且不补发；[真实服务恢复](../../artifacts/remote-current-service-recovery-connected.json)两组均恢复且保留面板/草稿；[本轮Remote不可用时普通模型请求](./core-chat-current.md#remote不可用时的普通聊天实测2026-10-04)完整通过。[插件安装中DSH退出](../../artifacts/plugin-manager-install-restart-android.json)显示未知结果、下载请求仅一次、原配置保持，不自动重发。 |
| 5. 本地安装/升级、缓存、包体与合理性能 | [本地配套产物](./local-delivery.md)登记当前APK 13,025,089字节、安装哈希和插件/网关对应关系；[实际清理与重启](../../artifacts/remote-cache-android.json)保留Key配置、17条普通聊天、Remote草稿与绑定，[旧草稿迁移](./draft-migration-current.md)核对旧数据及冲突。普通聊天[独立Lighthouse](../../artifacts/performance/product-summary.json)TBT中位177.069ms、CLS0；[当前Remote三次测量](./performance-current.md)FCP45.3ms/LCP818.5ms/CLS0.00189，列表3.28秒、打开16回复聊天0.617秒。Remote最长任务381ms仍有优化空间，其长任务超额合计不是标准TBT。按用户合理区间要求接收此已测表现，不新增真机、公网或严格帧率门槛。 |
| 6. 中文软键盘必须实际验证 | [MuMu真实候选](../../artifacts/mumu-chinese-input.json)提交“你好”，trusted输入、可视高度843→553、composerAboveKeyboard=true；[清理](../../artifacts/mumu-chinese-input-cleanup.json)草稿清空、原搜狗恢复。此前高度0限制已由实际系统输入法验证解除；未观察到网页composition事件不冒充观察到，也不把缩小浏览器视口当键盘验收。 |

因此关闭KKC-20；R14反馈真实提交/撤回仍在KKC-18和完整验收KKC-10内，按[目的地限制](./feedback-current.md)保留未验。KKC-20关闭不等于整个Remote目标完成。首版不含localhost网站转发、手机交互终端、创建工作区或iPhone。
