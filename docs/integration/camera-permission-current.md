# 配对相机权限验证

- 状态：标准Android模拟器拒绝分支及虚拟相机实际二维码识别已验证；维护角色：DSH Mobile协作Agent；最近核验：2026-10-02。
- 来源：[实际驱动](../../scripts/verify-camera-denial-android.mjs)、[报告](../../artifacts/camera-denial-android.json)、[扫描实现](../../android/app/src/main/java/dev/dshmobile/validation/RemotePairScanner.kt)、[手机错误提示](../../src/RemoteApp.jsx)。

在MuMu主实例Android API32使用最新源码构建独立pairingtest包，不覆盖日常包或绑定。[构建日志](../../artifacts/pair-camera-denial-build.log)。系统应用信息→权限→相机明确显示“不允许”，包状态granted=false。pm set-permission-flags返回Unknown command，cmd package help也没有对应入口。

实际点击手机“扫描二维码”后，系统没有拒绝弹窗，而直接打开扫码界面，包权限变为granted=true。报告denialObserved=false，不能因为脚本退出0就称拒绝场景通过。此前相同限制仍存在，不能通过伪造Activity结果或修改生产权限逻辑替代真实拒绝验证。

验证结束关闭独立测试包并恢复相机granted=false，未领取配对、未变更电脑授权或日常App数据。恢复日常App。源码当前映射缺少相机权限为“未获得相机权限，可从图片识别或粘贴配对链接”；这是实现依据，不是运行时通过证据。

## 标准Android权限弹窗实测

2026-10-01使用已有API36.1标准AVD，以read-only、no-snapshot方式启动，独立pairingtest包构建并安装成功。未覆盖MuMu日常App、绑定或凭据。

[最终报告](../../artifacts/camera-denial-standard-android.json)确认：实际点击系统拒绝按钮后，正式Remote配对页显示“未获得相机权限”，未提交链接保持，链接输入和“从图片识别”入口仍可用；结束后测试App关闭、相机权限为拒绝。[页面截图](../../artifacts/camera-denial-standard-android.png)与[构建日志](../../artifacts/standard-camera-gradle.log)保留。

首次拒绝成功后，重复请求的系统按钮变为permission_deny_and_dont_ask_again_button，原驱动只匹配permission_deny_button，导致未点击并在系统弹窗覆盖时截图超时。[失败报告](../../artifacts/camera-denial-standard-repeat-failure.json)保留。驱动根据实际系统节点支持两种拒绝按钮，复验通过，并明确要求denialObserved为true才算成功。生产权限处理未修改。

该结果证明标准模拟器上的系统权限拒绝和替代入口可用，不代表图片识别在本次执行，也不代表相机已识别真实二维码；后者仍需独立验证。

## 虚拟相机场景尝试（2026-10-02，识别未通过）

本节为失败过程，识别后来通过，见下一节；电视红色区域不能证明海报加载失败。

使用已有API36.1只读AVD、独立pairingtest包，按本机emulator的`-help-virtualscene-poster`设置wall图片，亦尝试console `virtualscene-image wall`及两种Windows路径分隔符。素材为原图片识别已用的固定无效配对码，仅拟验证识别后填入，不领取配对、不授权电脑访问。

[驱动](../../scripts/verify-camera-scene-android.mjs)实际通过系统权限窗口授权，启动原CaptureActivity与摄像头。场景画面仍为棋盘电视及红色占位，没有可识别二维码；[最终报告](../../artifacts/camera-scene-android.json)为45秒超时，cameraDecoded未成立。[场景截图](../../artifacts/camera-scene-failed.png)保留。图片自身为8位RGBA PNG；命令返回OK不足以证明纹理加载成功，不能据此判断生产二维码识别器有缺陷。

最初System UI无响应遮挡权限窗口的[失败报告](../../artifacts/camera-scene-system-ui-failed.json)独立保留；关闭残留窗口后，实际授权成功但仍未识别，[初次场景超时](../../artifacts/camera-scene-poster-failed.json)亦保留。测试没有伪造Activity结果或调用图片识别冒充相机。一次额外截图命令因Node默认缓冲区上限ENOBUFS失败，不采用其旧文件作为新证据。

结束后独立测试包已强停，相机权限granted=false，临时模拟器经console kill关闭；[正常包重建](../../artifacts/camera-scene-normal-build.log)通过，避免独立包残留为默认产物。日常MuMu未覆盖安装、绑定和Key未改，DSH和网关未重启。相机识别继续未验；下一次需先确认虚拟场景确实显示二维码，再运行识别测试，不能仅重复相同命令。

## 虚拟相机实际识别通过（2026-10-02）

核对本机SDK的resources/Toren1BD.posters后发现wall海报在另一房间，resources/macros/Walk_to_image_room提供官方移动路径。console automation play后[实际画面](../../artifacts/camera-room-current.png)显示二维码已加载，但左侧超出画面；[裁剪失败报告](../../artifacts/camera-room-cropped-failed.json)保留。此前红色电视并非wall海报，不能继续将它归因于图片格式或加载失败。

[素材脚本](../../scripts/build-camera-poster.mjs)使用项目已有qrcode依赖生成相同固定测试链接，将二维码置于白底海报右侧，以适配官方宏停止位置。随后[真实驱动](../../scripts/verify-camera-scene-android.mjs)的`--image-room`经标准API36.1原系统授权、CaptureActivity与virtualscene相机帧识别成功；17:22:53Z [报告](../../artifacts/camera-room-android.json)cameraDecoded、prefilledWithoutClaim及permissionRestoredDenied均true、errors为空。[返回配对页截图](../../artifacts/camera-room-android.png)已核对，输入值等于规范链接、服务器提示存在、尚无配对指纹；没有点击继续配对。不是文件选择识别或伪造Activity返回值，也不声称物理摄像头/任意光照已验证。

测试包已强停、相机权限撤销，临时标准模拟器console kill关闭，仅日常MuMu保留在线。默认APK已[重建为正常包](../../artifacts/camera-room-normal-build.log)，生产代码未改、日常App未覆盖安装、绑定与电脑权限未动。新一轮[System UI遮挡失败](../../artifacts/camera-room-system-ui-failed.json)同样保留；当前识别通过替代此前“相机未验”结论。

扫码返回后的系统栏疑点已补核：首轮识别报告另存为[原报告](../../artifacts/camera-room-first-success.json)，17:28:32Z重新运行真实扫码后，驱动先确认RemoteActivity取得焦点，再核对窗口LIGHT_STATUS_BARS与LIGHT_NAVIGATION_BARS，当前[报告](../../artifacts/camera-room-android.json)通过。即时截图仍可能处于系统转场，不能仅凭该帧认定持续颜色错误；取消扫码返回的独立核验及截图见[系统栏核验](./appearance-current.md#相机返回后的系统栏核验2026-10-02)。没有据此修改生产窗口逻辑，也不扩展为全部外观通过。
