# Remote 新版首页

`@dshm/remote-home-design` 是独立的 DSHM 手机界面插件，替换 Remote 首页的顶栏、电脑摘要、项目/会话列表和搜索区。仅依赖 React 和公开的 `dshm.remote.home` 插槽，不导入宿主私有组件、模型或原生桥。

当前构建为独立 `.dshm-plugin`，默认完整包放入[预装目录](../../preinstalled-plugins/README.md)随APK提供，源码不直接编译到宿主JS。预装和外部文件都使用同一安装器、目录与加载器；支持独立更新、启停、卸载及恢复预装版本，停用/卸载后回到默认首页。也可通过「从文件安装」选择外部版本并确认信任。运行中由实际宿主确认。只在本地候选验证，尚未公开发布；不是DSH桌面插件或任意npm安装器。

宿主提供数据投影与操作，插件负责展示。关闭插件会释放插槽和样式，连接、会话和草稿继续由宿主持有；故障时回到默认首页。

- 入口：`index.jsx` 导出 Cordis `name`、`inject`、`apply` 和 `mobileInterface` 能力声明。
- 样式：`styles.mjs` 的所有选择器限定 `.dshm-home-plugin`，样式节点随界面卸载。
- 主题：背景、正文、按钮与状态使用公开首页槽提供的同一套 `--dshm-*` 手机色板，跟随手机浅色/深色设置，避免混用电脑皮肤颜色。
- 图标：`assets/` 携带原 Figma SVG；SDK 内联原字节，独立包不依赖宿主资源路径。
- 契约：[公开首页 API](../../docs/plugins/remote-home-api.md)。

在 DSHM 源码目录执行 `node packages/plugin-sdk/build.mjs --root packages/remote-home-design`，输出 `packages/remote-home-design/dist/remote-home-design-0.3.1.dshm-plugin`。独立开发方式见[开发指南](../../docs/plugins/development.md)与[SDK](../plugin-sdk/README.md)。界面代码可独立更新；手机主题边界等宿主能力需先升级配套APK。无需额外后端、电脑补丁或中转资源转发，手机不从电脑复制这个插件。
