# Android Remote 与模式隔离

- 状态：技术验证入口已通过真实本机网关联调，不是完整手机产品。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-09-25。
- 来源：[现有协议](../../../docs/protocol.md)、[RemoteBridge](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)、[RemoteIdentity](../../android/app/src/main/java/dev/dshmobile/validation/RemoteIdentity.kt)、[客户端](../../src/remote-client.mjs)、[真实联调脚本](../../scripts/verify-live-remote.mjs)。

## 采用的边界

插件资源由[RemoteResources](../../android/app/src/main/java/dev/dshmobile/validation/RemoteResources.kt)统一走认证连接：四路并发排队前记录连接代次，断开使已登记流与排队请求全部失效，旧流量确认/取消不进入新连接。2026-09-25原生竞争复现与修复、MuMu正式插件加载/重连已通过；该原生样例不等同于真实在途设备撤销，详见[证据与限制](../integration/remote-current.md#原生排队资源的连接隔离2026-09-25)。独立插件的真实Worker脚本及自身资源读取、停用/断开/卸载退出和重连已通过[专项验收](../integration/remote-current.md#插件worker生命周期2026-09-25)；插件须用`ctx.effect`登记`worker.terminate()`清理，不能误用不存在的通用`dispose`事件，也不宣称宿主自动回收任意未登记的第三方线程。

普通聊天保持 `https://appassets.androidplatform.net`，Remote 使用独立 Activity/WebView 和 `https://remote.dshm.invalid` 本地资源 origin。两者的 localStorage、IndexedDB 按浏览器同源规则隔离，各自只有相应的主框架原生桥。与同一个页面切换 tab 相比，多一个 WebView 的生命周期成本换来明确的来源边界；与立即拆成两个 Android 进程相比，实施和调试成本更低。它不是 Android 进程沙箱，不宣称抵抗 WebView 或系统漏洞。

`DSHMOrdinary` 只提供普通聊天与原生导航；`DSHMRemote` 只提供配对、设备状态、连接和协议白名单。另一方桥不存在，即使对本方桥发送另一模式的操作也返回 `unsupported_operation`。网页网络/外部导航被拦截；Remote CSP 禁止 connect/object，frame 只允许下述独立 HTML 预览来源。手机原生网络支持 HTTP/HTTPS；普通聊天仍固定 HTTPS DeepSeek 端点。HTTP 配对/连接页面明确提示未加密。

Remote P-256 私钥由 Android Keystore 生成并不可导出，Nimbus JOSE JWT 9.47 的 `ECDSASigner(PrivateKey, Curve)` 在原生侧签名并处理 JOSE 编码；实现依据已核验该版本官方 Maven source jar。设备 token 复用已有 AES-GCM 存储实现，但使用 `dshm.remote.token.v1` 独立别名及文件；非秘密 origin/deviceId 放在独立 SharedPreferences。不会返回私钥、token、DPoP 或临时 ticket 给网页。模拟器不承诺硬件级保护。

2026-09-24 配对扫码只对未绑定的 Remote 主框架开放。相机由非导出的扫码 Activity 读取；图片由 ACTION_OPEN_DOCUMENT 临时授权单个 content URI，不申请广泛存储权限。图片最多 8 MiB、原图最多 6400 万像素，采样后最长边不超过 2048；后台解码且两分钟超时。相机与图片结果均通过现有 RemotePairLink 解析器，仅回填规范链接，不能发起领取或导航。绑定、切换页面、外部新链接和关闭会取消旧扫描，迟到回调按独立 requestCode 丢弃。实际验证与未覆盖项见[配对入口](../integration/remote-current.md#系统分享与-app-配对链接2026-09-24)。

OkHttp 4.12.0 执行 HTTP/WebSocket。HTTP 不跟随重定向、不自动重试，固定调用现有协议路径；`htu` 使用配对链接的规范 origin。无正文 ticket 请求不声明 JSON Content-Type。连接断开后不重发写操作；重新取得票据并重新 follow，opening snapshot 替换旧记录。超时或断开导致写入结果未知时保留提示与 requestId。

低频 HTTP 配对/状态/票据请求不保留空闲连接（`ConnectionPool(0, 1, SECONDS)`）；长期消息仍走已认证 WebSocket。实测默认池复用已被网关空闲超时关闭的连接会导致首次 GET EOF，随后手动重试才成功。采用释放空闲连接而非打开自动重试，代价是这些低频 HTTP 请求增加建连开销，保持领取和票据请求不透明重放；诊断及修复前后证据见[重连记录](../integration/remote-current.md#空闲后首次重连失败2026-09-24)。

## 使用与验证

系统分享和 App 配对链接由独立任务栈的 PairingEntryActivity 校验，只经进程内一次性交接进入非导出的 RemoteActivity。不会导航外部 URL、自动领取或覆盖绑定；目标任务 Intent 不携带 key，用户点击后才走原有 DPoP/claim。链接格式、隔离包验证及未覆盖范围见[系统入口记录](../integration/remote-current.md#系统分享与-app-配对链接2026-09-24)。

2026-09-24 HTML 预览使用 `https://preview.dshm.invalid/document/<id>.html`，仅原生登记的完整文档、当前连接代次、GET 子框架请求可读。`html.begin/chunk/finish/close` 仍只接受 Remote 主框架；文档没有 Host 回调或凭据桥。iframe 与响应 CSP 均为 `sandbox allow-scripts`，不含 allow-same-origin，文档实际来源为 null；禁止网络、子框架、Worker、表单和顶层跳转。原生文件选择回调无法区分子框架，因此 HTML 打开期间拒绝页面文件选择；窗口关闭后恢复原聊天附件入口。主页面 CSP 不增加 inline script 权限。完整代码、尺寸边界及 MuMu 验收见 [HTML 局部预览](../integration/remote-current.md#html-局部预览2026-09-24)。

2026-09-24 系统分享复用原生完整下载，`file.share` 只接受同连接代次已完成的下载 ID；Provider 只允许独立分享缓存，URI 不返回网页，接收 App 获得临时只读授权。新读取在 1 小时后拒绝；准备取消清理暂存，已交付副本不能撤回。限制、容量与跨 UID 验证见[手机系统分享](../integration/remote-current.md#手机系统分享2026-09-24)。

2026-09-24 PDF 接入沿用 Remote 独立来源与已有分片文件读取；在本地 Blob module Worker 中解析，关闭组件终止线程并撤销 Worker URL。字体等资源内置，不新增网络来源、不访问普通聊天桥；WebView 110 的缺失方法在 Worker 内独立补齐。真实多页/文字选择、损坏文件及线程启动失败结果见[PDF 验收](../integration/remote-current.md#pdf-局部预览2026-09-24)。尚未实测的撤销竞争仍保留在完整矩阵。

2026-09-25 外观同步：已核验来源与主框架的 `appearance.read` 在 HTML 预览打开时仍可读取四个固定偏好字段，外观变更只向顶层 DSHM 投递事件；子框架不拥有原生桥。不能因文件选择回调无法区分子框架而一并禁止父页面的只读偏好。MuMu 真实 HTML 打开、中英文切换、内部状态保留和子框架隔离通过，见[源码与回归](../integration/appearance-current.md)。

2026-09-24 新版下载边界：Remote 原生桥新增 `file.begin/chunk/finish/save/abort`，仅主框架同源可用。完整字节先存本 App 私有缓存，按连接代次和递增偏移验证；`file.save` 只接受暂存 ID，由 Android ACTION_CREATE_DOCUMENT 返回保存位置，不接受网页指定 URI。关闭预览、断开或取消清理暂存；下次创建存储清理遗留 `.part`。下载不调用普通聊天桥，不暴露两端凭据。实际最新二进制校验、取消和断线结果见[当前验收](../integration/remote-current.md#最新完整下载2026-09-24)。本节下方旧配对验证记录保留历史，不代表当前用户绑定已撤销。

1. 安卓普通聊天页选择「进入 Remote 验证」。
2. 电脑插件生成一次性链接，在 Remote 页领取；核对公钥指纹后从电脑批准。
3. 检查批准状态、连接、读取任务列表、选择已有会话并继续聊天。
4. 测试结束从电脑撤销，手机「移除本机绑定」清除该 Remote 身份，不动普通聊天 Key 或历史。

本机测试电脑监听 `127.0.0.1:8787`，使用 `adb -s <serial> reverse tcp:8787 tcp:8787` 让模拟器相同 origin 到达电脑。不代表公网部署或实际手机能直接访问电脑 loopback；公网和真机网络不属于本轮验收。

实际证据：`artifacts/remote-live.json`、`artifacts/mode-isolation.json`。已验证 pending 返回403、批准后列任务/读聊天/实际续聊、重连不重复历史、进程重启后设备身份和两模式历史仍正确、撤销后断线并返回401。普通聊天专用测试记录在 Remote 操作前后 SHA-256 一致；没有读取任何 Key。测试设备已撤销，本机测试 Remote 凭据已清除，普通 Key 和聊天保留。

`check-mode-isolation.mjs` 要求两个实际页面均打开，默认用于 pending 设备阶段；仅检查模式隔离与未批准拒绝，不冒充已批准全链路。真实 Remote 脚本需要 `DSHM_RUN_LIVE=1`、`DSHM_ANDROID_SERIAL`、`DSHM_REMOTE_TEST_SESSION`、`DSHM_ORDINARY_TEST_CHAT`，会在明确指定的远端测试会话发送一条消息并重启本 App，调用模型可能计费。凭据通过 UI 配对，不放入脚本或环境变量。

## 当前限制

这里只渲染原协议中的消息内容和最近过程帧，尚未实现上游完整投影/富文本 renderer、历史翻页、Remote 插件加载、工作区内新聊天或正式导航。普通聊天输入插件只适配纯文本来源，不承诺任意 Host/Agent 插件可在本机执行。浏览器页面没有原生桥，不能配对。移动端后台保活/推送/自动重连与多设备管理属于后续产品范围。
