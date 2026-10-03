# 整轮快照联调样例

仅用于开发验收，不随产品发布。[实现](./index.js)在手机项目 artifacts 下创建独立 Git 工作区，使用原 DSH 消息构造器、受控会话事件和原 workspaceChanges 服务生成真实前后文件快照。**不调用模型，也不声称这些事件由 Agent 实际执行。**

通过原 CLI 安装本目录打包产物；使用[Android 验收脚本](../../../scripts/verify-live-review-android.mjs)操作日常 App 的实际 Remote 列表、聊天卡片及原 ReviewTab。该样例不发送 Agent running 状态帧，脚本需从页面刷新会话列表，使电脑当前 blank=false 投影生效。

0.0.4另包含真实二进制文件和3,200,000字节文本，原服务应分别返回 binary 与 oversized；默认文件对比上限2 MiB。配置了其他上限时先核对，不应为了通过验收静默修改电脑配置。脚本支持 `--launch` 从已启动的普通首页进入 Remote；会关闭刷新菜单并等待列表行可操作，不强制穿透遮挡。

同一进程卸载/重装同名包可能仍使用已缓存的旧模块。修改样例后先卸载，确认 `artifacts/review-live-host.json` 的 cleaned=true，再重启 DSH 并安装；不能只凭 node_modules 中的版本认定新代码已执行。

完成后用原 CLI 卸载 `@dsh-mobile/review-verification`。dispose 归档测试会话并移除工作区登记，保留 artifacts 中独立测试文件和报告。不要在样例运行中重启 DSH：原快照属于进程内状态，且异常退出可能来不及执行清理。清理标志与原服务状态均应核对。
