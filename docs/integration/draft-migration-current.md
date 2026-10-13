# Remote 旧草稿迁移验证

- 状态：旧localStorage纯文字格式到当前IndexedDB的正式Android入口已验证；不代表全部历史APK升级组合。
- 维护角色：DSH Mobile协作Agent；核验日期：2026-10-01。
- 来源：[迁移实现](../../src/remote-drafts.mjs)、[事务存储](../../src/remote-draft-database.mjs)、[数据回归](../../tests/remote-drafts.test.mjs)、[实际驱动](../../scripts/verify-remote-draft-migration-android.mjs)。

## 当前证据

### 发送确认丢失后的恢复（2026-10-06）

- 状态：共享生产实现已修复，固定新版源码及 npm 发布入口的真实Android冷启动、历史重入与草稿清理均通过，含真实成功回执未处理与正常发送流程；不代表全部设备和存储异常。
- 维护角色：项目协作Agent；来源：[发送入口](../../src/remote-model.mjs)、[原输入shell绑定](../../src/remote-input-session.mjs)、[共享主/旁栏选择](../../src/remote-session-view.mjs)、[源码实际进程结束证据](./notifications-current.md#固定源码的进程结束与草稿恢复2026-10-06)及[发布复验](./notifications-current.md#发布入口的进程结束与草稿恢复2026-10-06)。最近核验：2026-10-06。

原Android失败证明电脑已收到消息，而手机重开恢复了发送前草稿。缺失的持久化请求身份使手机无法安全区分“未发送”和“收到但确认未处理”。提前删除草稿实现较简单，但电脑未收到时会丢失内容；当前选择严格持久化原请求编号，然后依据电脑事实清理。这样增加一条本地事务，不新增后端协议或自动重试。

在原 `beginSubmission` 后、实际发送前，保存 `:submission` 记录：version=1、原requestId、冻结的展示草稿/编辑器结构及附件ID。引用展示形式可以不同于模型正文，不能用模型正文比较并删除引用草稿。记录不包含Key、token、Host附件receipt、端点或可自动重放的模型请求。保存失败时不发送，原文字和已准备附件保留，可重试；请求已发出后载体失败仍为未知结果。

确认来源仅限原成功发送回执，或同一会话的原 `user/message.source`、原inbox的next-turn/next-step用户来源，其rpcId必须与持久编号完全相同。依据[原电脑去重实现](../../../deepseek-harness/packages/api/session-controller/src/commands.ts)及实际用户消息。未加载的历史中没找到编号，不构成拒绝或未发送证明，保留草稿且不自动重发。

确认后以严格原子事务清理核对记录、仍与提交快照相同的草稿以及对应附件ID；新附件保留。用户改写文字或替换引用身份后，旧清理资格取消，新草稿不得被迟到回执删除。事务中止保留已提交内容及核对记录。主聊天、旁栏和历史分页共同使用同一恢复逻辑，生命周期/草稿与附件版本检查阻止迟到清理覆盖新状态。

[数据回归](../../tests/remote-drafts.test.mjs)覆盖严格落盘、错误编号、结构化引用、新附件、事务中止和用户编辑；[正式模型回归](../../tests/remote-model.test.mjs)覆盖确认丢失后的持久重建、不匹配编号、新草稿、inbox、旁栏及存储失败零次发送。实际原编辑器契约还核对展示引用ID随提交传入。最初离线回放的用户记录遗漏原surfaceOp标记，本身未进入显示历史；按真实记录补齐后核对通过，不能将缺字段造成的红灯当成该用户场景复现。原真实MuMu失败是本次修复的症状依据。

旧版只有文字/编辑器、没有发送编号的遗留草稿，不按文字推断是否已发送；该版本只能保留让用户核对。本次仅清理已由原测试记录证明发送的专用草稿，见实际证据。未宣称全部旧APK升级组合或物理存储故障通过。

### 保存失败时的缓存修复（2026-10-01）

原openDraftDatabase.write在事务完成前更新entries，事务中止后同一store仍能读到未提交值。新增[回归](../../tests/remote-drafts.test.mjs)通过真实存储入口中止fake-indexeddb事务，先复现“未提交”覆盖“已保存”，再将缓存更新移到await done之后；删除失败同样保留旧值。草稿及Remote模型101项回归通过，Web/Android构建通过，新APK已覆盖安装。

[14:50正式Android报告](../../artifacts/remote-draft-abort-android.json)通过：仅对下一次真实WebView草稿事务调用abort并立即恢复方法，界面提示保存失败、数据库原记录不变；点击重试保存后提交成功。随后旧格式迁移、新值优先、键盘全选删除、数据库删除、归档及原草稿保持全部通过。此故障注入不冒充物理磁盘耗尽，缓存原缺陷由隔离存储回归证明，手机验证完整入口与异常处理。

[首次清空失败](../../artifacts/remote-draft-abort-first.json)和[等待渲染后仍失败](../../artifacts/remote-draft-abort-render-wait-failure.json)保留：Playwright fill空串后编辑器仍为原值，数据库未删；改为真实键盘全选/Backspace操作后完整通过，不能把等待两帧描述为修复。失败专用会话已归档，首轮归档前fill清空未独立确认，不能宣称其草稿一定已删除；最终轮数据库删除有明确断言。未改电脑配置或权限。

[14:31最终报告](../../artifacts/remote-draft-migration-android.json)来自现有MuMu正式App、自有Remote页面和真实电脑连接。驱动只在新建的DSH-TEST专用聊天测试；先真实发送无工具消息并收到回复，再经编辑器生成唯一测试键，清空该测试草稿后写入源码确认的旧localStorage字符串格式。没有替换迁移函数或读取凭据，没有实际安装旧APK。

1. 重载正式Remote页面，旧中文、多行、表情文字在编辑器恢复，数据库原文一致，旧localStorage记录消失。编辑器可能将纯文字重存为version=1结构化记录，验证文字内容而不是要求永久保留旧存储形状。
2. 正式编辑器保存新内容，再写入迟到的旧字符串并重开。当前数据库记录及编辑器文字保持新版，旧副本清理，不覆盖新草稿。
3. 清空专用草稿并确认数据库删除，归档测试聊天，返回原联调会话且原草稿相同。未发送测试草稿、修改Key或申请管理权限；没有生产代码/APK修改。

8项现有草稿数据回归全部通过，包括绑定隔离、结构化记录、事务顺序和附件字节恢复。它们使用fake-indexeddb，不能替代上述实际WebView证据。

## 驱动失败与修正

- [空会话导航失败](../../artifacts/remote-draft-migration-empty-failure.json)：未发送消息的空会话重开后不在最近列表，驱动无法点击；不据此认定迁移失败。原测试键对应session-0e4106a5-b4b7-40d3-beab-8590ece083bb经真实通道归档，专用记录删除；恢复时临时创建的另一空会话也从当时选中页面归档。
- [段落读取失败](../../artifacts/remote-draft-migration-paragraph-failure.json)、[结构化记录断言失败](../../artifacts/remote-draft-migration-structure-failure.json)、[换行表示断言失败](../../artifacts/remote-draft-migration-linebreak-failure.json)：驱动先后错误假定textContent保留段落边界、数据库恢复后仍为字符串、每行必为单独段落。按实际Lexical段落/换行表示及存储契约修正，未修改产品行为。各专用聊天清空草稿后归档。
- [初始入口等待失败](../../artifacts/remote-draft-migration-entry-failure.json)：清理脚本使用未限定主视图的重复标题选择器失败，后续驱动在原聊天入口等待超时；该轮未创建聊天。修正为remote-workspace作用域后恢复，再执行最终完整验证。

失败报告保留，不能被最终通过覆盖。该专项不证明安装旧包再升级、跨版本原生凭据迁移、全部旧结构化格式或存储中途故障。末尾管理状态辅助查询失败，没有发生授权修改，不能报告这次查询通过。

后续同一DSH PID9512管理查询恢复，确认日常设备active/management=false；未为观察超时而重启。此前失败保留，尚不能确定其短暂失败原因。
