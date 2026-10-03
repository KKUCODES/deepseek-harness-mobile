# 旁栏输出真实验证夹具

仅安装到本机 DSH 的临时测试插件，不进入 DSHM APK、网关或正式桌面插件。

- 经原 `ctx.shell` 启动固定打印命令，并由原 `ctx.jobs` 登记到脚本选定的专用测试会话；不调用模型、不写用户文件，不开放新的远程命令接口。
- `processJob` 来自已构建的后台输出兼容补丁，继续使用真实进程的独立字节读取；不是伪造的手机输出数据。
- 控制文件固定为手机项目 `artifacts/sidebar-output-control.json`，只允许 start/stop/notify，每个 DSH 进程只创建一项任务和一个提问。notify经原userQuestions向脚本指定的既有测试聊天发起提问，用于点击原生通知切换会话；不调用模型。生产插件没有这个控制入口。
- 原 jobs.wait 在结算时标记已报告，避免测试结束触发额外模型请求。正常结束、失败与卸载都须停止本夹具拥有的任务；测试后卸载并重启 DSH 释放 Host 轮询。
- 由[Android专项](../../../scripts/verify-sidebar-output-android.mjs)经正式页面打开旁栏、查看实时输出并触发两次核心更新；核心 bundle 字节不变，时间戳最终恢复。当前产品要求点击“重新读取”后续读，专项不能声称自动续读通过。
- 该脚本的`--switch`模式不触发核心更新：点击真实原生提问通知跳到另一聊天、取消问题，再经列表返回原旁栏，检查内容/全屏状态和手动续读。停止任务或卸载会取消仍在等待的问题；问题也有90秒截止时间。
- `--streams`模式使用0.0.7的固定大输出及持续stdout/stderr：手机三页拼接核验140,037字符，分别查看两条流；脚本打印READY/OFFLINE信号后，由执行者核对本机网关进程并停止、恢复，验证旁栏内容保留与错误输出连续续读。网关使用原环境配置；禁止只改手机连接状态冒充断网。与`--switch`互斥，不触发核心更新。`DSHM_OUTPUT_ARTIFACT`可指定独立证据文件前缀。

- `--revoke`模式只使用独立包`dev.dshmobile.validation.pairingtest`，不改变日常App绑定；与其他模式互斥。通过后端本机`verify-device-output-proxy.mjs`暂缓真实输出响应，看到`SIDEBAR_OUTPUT_HELD_REVOKE_ISOLATED_DEVICE`后，在电脑设备页撤销已核对指纹的测试设备。脚本检查真实撤销通知、页面清理及重连拒绝，然后经Host控制文件停止测试任务。代理帧上限覆盖正式协议的2MiB及WebSocket头；结束必须停止代理、恢复ADB反向端口8787→8787、卸载临时插件并重启DSH。

实际执行结果及限制见[Remote验收](../../../docs/integration/remote-current.md)。
