# APK 预装插件

将完整的 `.dshm-plugin` 文件放在此目录，构建 APK 时会校验并放入原生资产。默认包含「Remote 新版首页」0.3.1；目录没有插件包时不预装，README 等其他文件不会成为插件。

更新首页源码后，在手机仓库根目录显式重建包：

```sh
node packages/plugin-sdk/build.mjs --root packages/remote-home-design --out preinstalled-plugins/remote-home-design.dshm-plugin
node scripts/check-preinstalled-plugins.mjs
```

其他插件也使用相同 SDK/包格式。不在宿主目录添加包名判断，不把插件 JSX 导入宿主 bundle。包字段/API/大小/摘要或重复ID不合法时，APK构建会失败。

首次启动只安装没有记录的预装插件。已安装版本、停用选择和卸载记录优先于 APK 默认值，升级不会自动替换现有插件。卸载删除私有运行副本，APK中的预装原件仍占空间；用户可在「插件 → 手机 → ＋ → 插件详情」确认恢复当前APK提供的版本。外部更新沿用原文件安装流程。

预装包是发行者随签名APK提供的代码，首次安装及显式恢复不再要求选择文件；仍经过手机的包校验、同一安装器与加载器。外部来源依然需要系统选择器及信任确认。更多见[开发指南](../docs/plugins/development.md)与[实现和验收](../docs/integration/preinstalled-phone-plugins-current.md)。
