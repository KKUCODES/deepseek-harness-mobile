# 普通聊天原生接入与本地历史

- 状态：MuMu 已通过真实 DeepSeek 回复、上下文、停止与历史恢复；实际 Remote 与双模式隔离见[独立记录](./remote-native.md)。
- 维护角色：DSH Mobile 项目协作 Agent。
- 核验日期：2026-09-22。
- 依据：用户确认自己的 Key、手机直连、本地历史；以下源码、官方 API 与[运行记录](./results.md)。

## 数据流和选择

当前采用 Kotlin 原生持有 Key/请求网络、Web 中的真实流解析与 IndexedDB 历史。与把 Key 放入 localStorage、用网页 fetch 相比，这需要一个受限桥，但插件不能直接读走 Key；与立即引入 Room 和另一套原生会话服务相比，IndexedDB 能在现有 Web/MuMu 验证中复用同一持久化实现。它是技术验证选择，不等于最终容器或完整产品存储方案。

| 入口 | 实际行为 |
| --- | --- |
| [OrdinaryCredentials.kt](../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryCredentials.kt) | Android Keystore AES-256-GCM 生成/持有加密密钥；每次平台生成新 IV，密文用 AtomicFile 保存到 noBackupFilesDir；读回与删除仅在原生层 |
| [OrdinaryBridge.kt](../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryBridge.kt) | WebMessageListener 精确 origin 白名单并检查主框架；原生密码窗口配置/移除 Key；固定 HTTPS 模型端点、请求白名单、pull 字节读取与取消 |
| [ordinary-native.mjs](../../src/ordinary-native.mjs) | 关联 RPC ID，字节流转 Response，取消/迟到响应收尾，不接收 Key |
| [ordinary-history.mjs](../../src/ordinary-history.mjs) | 普通 origin 内的独立 IndexedDB 库，每次事务读改写；会话、草稿、请求归属/终态与恢复；不会向模型重放失败/中断轮次 |
| [ordinary-chat.jsx](../../src/ordinary-chat.jsx) | 实际配置入口、选择本地会话、模型、发送/停止、恢复/删除；先保存用户轮次再联网；保存失败停止请求，不显示持久化成功 |

凭据实现依据 [Android Keystore](https://developer.android.com/privacy-and-security/keystore)、[AES/GCM 官方示例](https://developer.android.com/reference/android/security/keystore/KeyGenParameterSpec)；没有自制加密算法，不宣称模拟器具备硬件密钥保护。Key 输入不回填、不保存 View state、不启用 Autofill；原生窗口设置 FLAG_SECURE。密码 transformation 在单行属性设置后应用，避免被覆盖。

桥接依据 [WebViewCompat.addWebMessageListener](https://developer.android.com/reference/androidx/webkit/WebViewCompat)。允许 origin 为 `https://appassets.androidplatform.net`，只接受主框架；网页只能读取 APK assets，原生桥不提供任意 URL、文件、执行代码、读 Key 或 Remote 凭据的方法。原生导航可打开独立的 Remote Activity/origin；已有真实通道隔离验证，见[Remote 边界](./remote-native.md)，不以子框架测试替代实际双模式结果。

普通聊天插件仍处在同一受信 Web 环境，能接触普通聊天数据，也可能调用获准的普通聊天能力；Cordis 不是恶意插件沙箱。Key 不可从桥读取不等于不可信插件无法触发 API 消费。

## 网络契约与限制

按照 [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/) 的当前公开模型与字段实现：固定 `https://api.deepseek.com/chat/completions`，不跟随重定向，平台默认 TLS 校验。模型白名单 `deepseek-flash`、`deepseek-v4-pro`，只接受 user/assistant 纯文本，`stream=true`、`thinking.type=disabled`、`max_tokens=4096`；不携带 tools，不进入 Agent。

原生同一桥只允许一个请求，关联不可变 requestId。connect/read 超时分别20/90秒，读取总时长限制10分钟，每次 pull 最多8192字节；没有自动重试。HTTP 非成功或内容类型异常不会把上游响应正文送入网页。错误仅稳定代码；真实 API 回复和用户停止后本地不再更新已在 MuMu 验证，无法从客户端证明服务商内部计算/计费何时结束。

输入限额是本验证实现约束，不是官方模型上限：最多200条上下文消息、约240,000字符上下文；原生桥单条消息100,000字符、单RPC256,000字符。超过明确报错，不静默裁剪。历史中失败/中断的内容仍显示，但只有完整成功轮次送入下一轮上下文。

## 历史和生命周期

数据库 `dshm-ordinary-history-v1`，单个 `chats` store，chatId、requestId 使用随机 UUID，mode 固定 ordinary。用户轮次先持久化，再开始原生请求；分片串行提交，终态写入相同记录。进程或页面重启后，未结束轮次标记 `interrupted/app_restarted`，不自动重发；突然杀进程可能丢失尚未提交的末尾分片，不承诺字节级无损。

历史是 App 私有 Web 存储中的明文记录，不宣称历史内容被 Keystore 加密。Key 从不存入 Web 存储。按[Android 备份规则](https://developer.android.com/identity/data/autobackup)禁用云备份及设备转移；当前无导出/恢复，卸载或清空 App 数据会丢失历史。列表当前一次性读取，尚未实现分页/虚拟化；大历史与并行多窗口不是已验证能力。

## 已运行测试与复现

1. `npm test`：解析与取消协议、native transport 适配（明确的替身）、普通/Remote 上下文边界。
2. `npm run verify:web`，以及指定 `DSHM_ANDROID_SERIAL` 后同命令：实际草稿持久化、恢复/删除与原生拒绝路径。测试样例明确标记合成，结束只删除自己的新建会话。
3. 在 Android 目录构建 `:app:assembleDebugAndroidTest`，安装主 APK 与 androidTest APK，执行 `adb -s <serial> shell am instrument -w dev.dshmobile.validation.test/dev.dshmobile.validation.OrdinarySecurityInstrumentation`。独立测试密钥别名测试加密读回、随机 IV、重新实例、篡改与清除；结果 PASS，未联网。测试不包含在主 APK。
4. 用户已在设备内配置真实 Key；`DSHM_ANDROID_SERIAL=<serial>`、`DSHM_RUN_LIVE=1` 后运行 [verify-live-ordinary.mjs](../../scripts/verify-live-ordinary.mjs)，新建专用聊天并通过真实三轮验证：短回复、上下文、流式插件启停与停止，再强制结束/重启 App 比对完整历史。报告 `artifacts/ordinary-live.json`；不读取或输出 Key，不把此收费调用纳入默认测试。
