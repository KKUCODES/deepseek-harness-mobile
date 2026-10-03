# Remote 旧草稿迁移验证

- 状态：旧localStorage纯文字格式到当前IndexedDB的正式Android入口已验证；不代表全部历史APK升级组合。
- 维护角色：DSH Mobile协作Agent；核验日期：2026-10-01。
- 来源：[迁移实现](../../src/remote-drafts.mjs)、[事务存储](../../src/remote-draft-database.mjs)、[数据回归](../../tests/remote-drafts.test.mjs)、[实际驱动](../../scripts/verify-remote-draft-migration-android.mjs)。

## 当前证据

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
