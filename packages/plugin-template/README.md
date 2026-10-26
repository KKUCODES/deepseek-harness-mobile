# 独立首页插件模板

复制本目录到新的开发目录，安装 `@dshm/plugin-sdk` 的本地 `.tgz` 后执行 `npm run build`。将输出的 `.dshm-plugin` 发到手机，在「插件 → 手机 → 从文件安装」选择并确认信任。

修改包名时同时修改 `index.jsx` 的 `name`。更新时递增 `package.json` 的三段版本号；插件不依赖 DSHM 私有组件。

完整说明：[开发指南](../../docs/plugins/development.md)；公开类型：`import('@dshm/plugin-sdk').HomeProps`。
