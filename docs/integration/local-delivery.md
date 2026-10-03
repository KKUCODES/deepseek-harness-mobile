# 本地验收版使用与产物核对

- 状态：已确认首版范围的本地验收版；不是应用商店发布包或通用安装器。
- 维护角色：项目协作Agent；最近核验：2026-10-04。
- 来源：[产物校验脚本](../../scripts/check-delivery-artifacts.mjs)、[当前报告](../../artifacts/delivery-artifacts-current.json)、[Android构建配置](../../android/app/build.gradle.kts)、[电脑兼容补丁决策](../../../docs/project-knowledge/knowledge/decisions/2026-09-25-desktop-compatibility-patches.md)。

## 当前配套文件

| 部分 | 文件与当前状态 |
| --- | --- |
| Android | [app-debug.apk](../../android/app/build/outputs/apk/debug/app-debug.apk)，13,025,089字节。包名`dev.dshmobile.validation`；构建元数据versionCode=2、versionName=`0.1.0-ordinary`，旧名称不代表仅含普通聊天。仍为debug构建。 |
| 电脑插件 | [dsh-mobile-plugin-0.1.75.tgz](../../../plugin/artifacts/dsh-mobile-plugin-0.1.75.tgz)，214,864字节；需重启DSH加载。 |
| 网关 | [启动入口](../../../backend/packages/gateway/dist/main.js)和配套protocol产物；报告登记锁文件、包元数据及两个dist目录共73个文件的哈希，不是单文件可执行程序。依赖和启动配置见[后端说明](../../../backend/README.md)。 |
| 电脑兼容补丁 | [后台输出](../../../plugin/compatibility/background-output/README.md)、[前台输出](../../../plugin/compatibility/foreground-output/README.md)、[源码启动](../../../plugin/compatibility/source-start/README.md)及[插件知识目录](../../../plugin/docs/project-knowledge/catalog.md)中的后续补丁；基线DSH `0.1.6-alpha.2`。补丁不包含在插件tgz中，不能只装tgz便承诺所有Remote能力。 |

APK SHA-256：`37b9eaea3218ef5523caf4bd5f038c2fd234cb6230a39ef08ed10fa37dbd11db`。

插件tgz SHA-256：`3dffe1285051fba02ef0b02c149fa885830cfeeb28907a170631b69047670bd0`。

这些哈希只识别本次文件；重新构建后须重新核对，不以文件名或旧版本名判断字节是否相同。当前报告不是源码到二进制的可重现构建证明，也未验证未知电脑的完整安装流程。

## 已配置的本机如何恢复使用

1. 在`backend`目录执行`node --env-file=.env.local packages/gateway/dist/main.js`，使用原配置和数据库。
2. 在实际DSH安装目录执行`pnpm dsh web`，通过当次终端链接登录。参考源码目录不作为实际运行目录。
3. 查看电脑插件的连接状态；已有绑定不必重新注册或重新配对。新设备才生成一次性链接、在手机领取并由电脑批准。
4. MuMu本机联调使用已登记设备的ADB端口映射：`adb -s 127.0.0.1:16384 reverse tcp:8787 tcp:8787`。该地址与映射仅适用于当前模拟器；手机上的`127.0.0.1`不代表电脑。
5. 打开DSHM→Remote；应进入DSHM自己的工作区/聊天页。普通聊天使用手机自己的Key，Remote会话同步电脑记录。管理电脑设置需独立管理授权，测试后收回。

更新当前调试App时使用相同签名的APK覆盖安装，保留原数据；不要为了更新而先卸载。首次安装到其他电脑、换签名、数据库/网关迁移和公网部署不由本机覆盖安装结果证明。DSH兼容补丁按各自基线和安装说明处理，未知内容应停止；多个补丁存在先后依赖，不能批量乱序套用旧安装器。

插件升级提示需配套[plugin-restart-notice-v1](../../../plugin/compatibility/plugin-restart-notice/README.md)，独立三文件补丁已安装实际运行目录，`plan`返回patched=3。真实手机安装/升级及DSH重启后新Host版本执行已验证；需要重启时只保留完成关闭操作。APK/网关/插件tgz无需变化。补丁固定哈希和before/after文件由其独立manifest保存，不由下方APK产物检查代替。

## 如何核对文件

电脑安装的全部补丁另见[组合清单与只读检查](../../../plugin/compatibility/README.md)。2026-10-03实际核对112个修改文件全部匹配，源码启动和两个scope依赖链接一致。该检查补足本节APK/网关/插件产物检查未覆盖的电脑磁盘状态；两者均不替代实际功能验收。

在手机项目目录运行：

```text
node scripts/check-delivery-artifacts.mjs
```

脚本仅读取明确构建产物并写本项目JSON报告，不读取`.env.local`、数据库、Key或会话，不安装或启动应用。校验失败退出1；`ok`仅表示本地文件检查通过：

- APK的`assets/web`与`dist`逐文件比对清单及SHA-256，包含自有`mobile.html`和`remote.html`。
- 插件tgz包元数据与当前package.json一致，两个JS运行文件和Cordis声明与当前产物一致；README等包内说明不作为运行代码一致性的判断。
- 网关及协议产物登记哈希，供后续比对；不据此推断运行进程已加载最新产物，也不校验运行电脑的补丁安装状态。

2026-10-03 13:51Z构建产物检查通过：117个Web文件、插件0.1.75及73个后端文件。当前APK补齐[无需电脑授权的手机外观入口](./appearance-current.md#手机外观入口不依赖电脑授权)，Web/Android构建和lint通过，已覆盖安装；[正式MuMu报告](../../artifacts/appearance-shortcut-android.json)包含实际base.apk哈希，与上方文件一致。主题/字号同步、原页面/草稿及偏好恢复通过；原审批读屏修复保留，本次未重复读屏验收。未变更设备管理权限、电脑插件或网关。

2026-10-04最终文件核对仍为117个Web文件、插件0.1.75和73个后端文件；电脑112个补丁文件、17份清单、源码入口及两个依赖链接匹配。[反馈六类真实验收](./feedback-current.md)完成后，用户恢复默认DSH启动，临时收集器停止；正式手机重连读取原16条回复和空草稿。当前交付结论见[验收表](./completion-audit.md)，具体读屏/通知边界仍按专项证据，不由文件相同推断。localhost网站转发已移出首版，后续由[KKC-21](https://linear.app/kkcodes/issue/KKC-21)评估；保留文件/HTML预览及只读命令输出。

当前安装APK另经[真实Remote三次测量](./performance-current.md)核对安装字节与上方哈希一致；绘制、数据就绪、聊天打开及长任务分开记录。该报告不是冷启动或标准TBT报告，不能据产物相同推断所有性能已达标。
