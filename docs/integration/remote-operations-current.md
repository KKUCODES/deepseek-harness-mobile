# Remote 业务操作验收对照

- 状态：八项功能标准按已确认本地范围通过；反馈测试数据、临时环境及原会话均已恢复。
- 维护角色：项目协作 Agent；最近核验：2026-10-04。
- 来源：[KKC-18 现行八项标准](https://linear.app/kkcodes/issue/KKC-18)、[完整编号](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md)、以下原始报告和生产入口。历史报告只证明其对应版本，不冒充本轮重新执行。

## 八项标准与证据

| 标准 | 当前依据 | 结论与边界 |
| --- | --- | --- |
| 1. 配对、失效、单电脑连接 | [核心连接](./core-chat-current.md)、[通道与权限](./remote-channel-current.md)、[相机实际范围](./camera-permission-current.md) | 真实领取/批准、自然过期、待批准时拒绝、重连和解绑已有证据；HTTP保留提醒。相机为模拟器真实权限与虚拟帧，不外推物理拍摄条件。 |
| 2. 工作区、搜索、历史和实时会话 | [核心契约](./core-chat-current.md)、[执行与子会话](./execution-capabilities-current.md)、[当前加载测量](./performance-current.md) | 手机读取实际电脑数据，正文检索取决于电脑索引，未启用时明确降级标题搜索。主聊天与旁栏复用DSHM页面，不加载电脑整站；不创建工作区或接受任意cwd。 |
| 3. 会话操作、停止和队列 | [会话管理与分支](./core-chat-current.md)、[当前队列原始报告](../../artifacts/remote-queue-current-android.json)、[停止与引导](./remote-current.md#历史分页停止与即时引导2026-09-24) | 本轮重读队列报告确认电脑回传编辑/取消、仅执行修改后的消息，清理后16回复、零队列/待提问/生成。旧管理报告最终0回复属于加载中采样，不能当作恢复完成证明。 |
| 4. 审批、提问、计划竞争 | [双端竞争](../../artifacts/approval-two-clients.json)、[过期与随后新请求](../../artifacts/approval-timeout-android.json)、[真实模型工具批准/拒绝](./remote-current.md#模型实际工具审批与拒绝2026-09-27)、[原交互记录](./remote-current.md) | 原服务受控竞争、真实模型执行和旧点击失效分别留证；本轮读取的竞争/超时报告complete=true且无页面错误。受控原服务请求不冒充每类模型工具的并发执行；撤权沿通道契约取消访问。 |
| 5. 模型双向同步 | [双端模型证据说明](./core-chat-current.md)、[当前队列报告](../../artifacts/remote-queue-current-android.json) | 手机Pro→Flash、电脑改回后的手机观察、恢复强度分别有报告；电脑菜单观察来自现场记录。当前生成期选项禁用有独立字段，未知写入遵守先核对、不重放。 |
| 6. 预设、权限、技能与执行能力 | [执行能力五类](./execution-capabilities-current.md)、[技能报告](../../artifacts/remote-mobile-skills-android.json)、[自定义模式](./custom-agent-runtime-current.md)、[自动审核](./auto-review-current.md) | 按电脑真实安装能力提供。技能报告证明目录、筛选和草稿保留，sent=false，不把它写成技能模型调用；后台独立输出与模型后续消费有各自实测。 |
| 7. 电脑配置和工作区管理 | [工作区管理](./core-chat-current.md)、[数值同步](./scalar-settings-sync-current.md)、[模型九类契约](./model-settings-compatibility.md#模型设置契约核对2026-10-03)、[插件管理](./plugin-management-current.md)、[凭据状态](./key-state-current.md) | 管理独立授权，凭据走原生输入，只返回配置状态；原值/默认继承及临时权限恢复有报告。数值报告本轮重读确认实时刷新、保留草稿、手动重读和恢复；隔离协议故障回放不冒充Android真实故障注入。 |
| 8. 评价、同步和异常 | [反馈专项六类矩阵](./feedback-current.md)、[真实打开取消报告](../../artifacts/feedback-read-cancel-android.json)、[生产只读同步监听](../../src/remote-feedback-notifications.mjs) | 本轮真实双向提交/撤回、原电脑控件自动更新、归档父会话、冷且只读子会话、断线未知结果不重放、真实版本冲突通过。冷状态由原控制基线核对，不拿归档标签代替；全部测试评价清理。 |

## 收尾边界

本轮在用户正确设置本机反馈URL并启动DSH77492后完成反馈实际验收，收集器收到真实事件；未修改产品代码、安装包、模型Key或管理权限。此前默认目的地的一条测试评价及其风险保留在反馈专项历史记录，不隐去。APK117个Web文件、插件0.1.75、网关73文件与电脑112补丁文件/17清单均重新核对通过。

功能矩阵完成，用户已恢复默认启动，DSH21020正常服务，临时收集器已关闭；手机重新认证读取原16条回复、空草稿、零选中评价。电脑插件页确认日常手机仍为聊天与任务操作权限，管理关闭。KKC-17/19/20已分别按自身标准验收，KKC-18和KKC-10已同步Done。公网部署、物理真机、多电脑、手机终端、新建工作区和localhost网站转发不新增为当前验收门槛。
