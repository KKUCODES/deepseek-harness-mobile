# 独立局部界面验收包

仅用于明确授权的本机DSH/MuMu联调，不进入DSHM APK或正式桌面插件。
通过原bundle安装、原Host模块图和既有Remote通道加载，不能以浏览器拦截资源或直接注入脚本代替。
不注册Host服务、不增加协议权限、不读取凭据；文件按钮仅调用原插槽提供的openFile，实际文件读取仍由现有会话权限判断。

0.0.1不声明缩放，已打包产物用于验证默认开启；当前0.0.2通过可选dshmLayout声明autoFit:false，用于验证作者声明及用户覆盖。
720像素宽卡片用于观察外层等比缩放和点击坐标；插件页用户开关沿用产品本地设置。
在指定测试聊天填入已知测试文件，核对DSHM共用预览后卸载此包并恢复用户布局默认。
本包是自编代表性插件，不代表任意第三方插件均已兼容。

打包时从本目录运行`npm pack --pack-destination ../../../artifacts --ignore-scripts`。

已有0.0.1包保存在artifacts；如需从当前来源复现，先在独立测试副本中将package.json版本改为0.0.1，并删除client.js中可选dshmLayout声明这一行，其他逻辑不变。不要将0.0.2误用于默认开启测试。
安装并启用0.0.1后运行手机项目脚本verify-live-partial-plugin-android.mjs verify；更新0.0.2后运行author；卸载后运行unloaded。需要DSHM_RUN_LIVE=1和明确的DSHM_ANDROID_SERIAL，沿用workspace-desktop-seed.json中的既有测试文本；不新发模型消息。
