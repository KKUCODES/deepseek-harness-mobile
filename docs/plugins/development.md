# 开发可独立安装的 DSHM 手机插件

状态：随 preview.14 APK 交付；维护：手机端维护者；核验日期：2026-10-26。当前只开放 Remote 首页插槽 API v1。不要把此能力等同于完整 DSH 插件兼容层或任意 npm 包安装器；[发行核验](../releases.md#已核验范围)。

## 从零到安装

1. 从源码中的 [plugin-sdk](../../packages/plugin-sdk/README.md) 打出 SDK `.tgz`。
2. 把[模板](../../packages/plugin-template/)复制到独立开发目录，安装 SDK 为开发依赖。**无需引用 DSHM 或 DSH 源码**。
3. 修改 `package.json` 的名称、描述、三段版本号和 `dshm` 声明，同时修改入口导出的 `name`。
4. 执行 `npm run build`，得到 `dist/<name>-<version>.dshm-plugin`。
5. 将文件传到手机，打开「插件 → 手机 → 从文件安装」。选择文件后核对名称和版本，只有确认信任才会安装。
6. 进入已连接电脑的 Remote。模块实际激活后，手机插件页才显示「运行中」。不需要重新安装 APK。

发行者也可将同一文件放进源码的[preinstalled-plugins目录](../../preinstalled-plugins/README.md)，构建时校验后作为APK资产提供。无需在宿主JS中导入插件源码；首次启动自动安装没有记录的包，仍走同一安装器和加载器。升级不会替换已安装包或复活卸载条目。用户可从安装目录明确恢复APK提供的版本；APK原件不能通过普通卸载释放空间。

[SDK README](../../packages/plugin-sdk/README.md)包含完整的最小 `package.json`、JSX 示例、构建参数和边界，即使 SDK 单独分发仍可阅读。[Remote 新版首页](../../packages/remote-home-design/)是完整页面示例，模板是第二款更小的实现。[API 字段表](./remote-home-api.md)及[公开类型](../../packages/plugin-sdk/index.d.ts)描述数据投影与操作。

需要实现外部安装器 API 1 的 preview.14 或更新 APK；preview.13 不具备此外部安装功能。最初隔离验证使用本地 `0.1.0-preview.13-external / code17`。SDK 和模板随源码提供，不发布到 npm。

## 包格式和版本

`.dshm-plugin` 是 UTF-8 JSON 单文件包，而非 ZIP、APK 或电脑插件 `.tgz`。SDK 将 JSX 与依赖编译成单一浏览器模块，把图片/字体内联，React 使用宿主的同一实例；安装时不执行 npm、Node 或安装脚本。

| 字段 | 约束 |
| --- | --- |
| `schema` | 整数 `1`，包格式版本 |
| `id` | npm 风格小写包名；不能与内置 input/theme/rendering 重名 |
| `name / description` | 显示名称和用途，分别最多80/500字符 |
| `version` | `x.y.z`，不接受 `latest` 或预发布标签；同ID更新必须严格递增 |
| `apiVersion / surface` | 整数 `1` / `dshm.remote.home` |
| `code` | 自包含的 ESM，默认导出接收 `{ apiVersion, React }` 的工厂，由 SDK 生成 |
| `sha256` | `code` 的 UTF-8 字节摘要，必须与代码一致 |

包最多2 MB，最多同时保留32个外部插件。包中不接受脚本地址、路径或额外字段；私有代码文件名由摘要生成，不解压路径。只有系统选择器返回的单文件可以导入，网页不能提交路径或 URL。后续 APK 新增能力仍需升级 APK；插件包不能给旧宿主补出不存在的 API。

## 更新、启停与卸载

更新时递增版本并重新构建，在插件详情点击「从文件更新」。不兼容、摘要不符、相同版本和降级请求不会替换已安装包。新代码激活失败则恢复默认首页、显示加载失败；**不会自动降级回旧包**。

停用保留包和配置。卸载先要求对应宿主停止并释放插槽，确认后移除私有副本；无预装原件的条目从目录消失，有预装原件的条目留在安装目录提供「恢复安装」。停止/卸载失败显示具体失败并允许重试，不以保存意图代替完成。没有活动 Remote 宿主时可以直接移除包。聊天、Key、配对及宿主草稿不属于插件安装目录，不随卸载删除。

同一首页槽只能有一个启用插件；启用另一个会停用前者。卸载当前插件后使用默认首页，不擅自启用其他插件。断线不卸载插件，真实连接状态继续通过公开投影更新；进程重启恢复安装和启用记录，重新进入 Remote 才激活模块。插件自己的 React Hook 状态不承诺跨卸载或进程结束保持。

## 生命周期、样式与信任

插件通过 `apply(ctx)` 注册 `dshm.remote.home`；`ctx.slots.register` 的注册随 Cordis 生命周期释放。自建订阅/定时器应由 `ctx.effect` 返回清理函数，不把后台操作遗留在全局。异步加载、激活和释放受8秒上限约束；渲染错误也回到默认首页。同步死循环仍可占满同一 JS 线程，因此此机制不承担恶意代码隔离。

首页只获得 `home` 数据投影与操作。不要导入宿主私有组件、访问 `RemoteModel`、页面 DOM 或原生桥；不要隐藏审批、设置、聊天或连接提示。样式限定插件根节点，使用实际手机宽度；不适用电脑局部插件的等比缩放。

首页宿主提供公开手机主题变量（见[API主题约定](./remote-home-api.md#样式和生命周期)）。例如背景取`var(--dshm-bg)`、正文取`var(--dshm-text)`，按钮底色取`var(--dshm-subtle)`、前景同样取`var(--dshm-text)`。不要混合电脑全局色板与手机主题标记。SVG作为本地文件导入，SDK内联原字节；不要复制手写近似路径或依赖宿主私有资源地址。

**插件和页面共享运行环境。** 用户确认信任不等于沙箱授权，摘要不等于签名认证。当前本地导入没有作者签名体系、在线市场、自动更新或安装依赖解析。不要把 `dshm.remote.home` 的公开契约描述成全面的插件平台。

## 本轮验证及来源

已用固定APK验证两个版本与第二款独立工程插件，包含真实系统文件选择器、更新/降级拒绝、启停、实际卸载、冷启动、电脑重连和故障回退。详细环境、哈希与未验范围见[外部插件验证记录](../integration/external-phone-plugins-current.md)。

代码来源：[SDK 构建器](../../packages/plugin-sdk/build.mjs)、[原生安装器](../../android/app/src/main/java/dev/dshmobile/validation/PhonePluginImport.kt)、[包存储](../../android/app/src/main/java/dev/dshmobile/validation/PhonePluginPackages.kt)、[统一管理器](../../src/phone-plugins.mjs)、[外部加载器](../../src/external-phone-plugins.mjs)、[首页生命周期](../../src/mobile-interface-plugins.mjs)。
