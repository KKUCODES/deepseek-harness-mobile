# 首页图标资产

这些文件原样复制自[已导出的 Figma 资源](../../../src/ui/assets/remote/README.md)，独立插件必须携带自己的副本，不引用宿主私有路径。2026-10-26重新核对Figma首页21:2277：back/more/monitor/folder/chevron对应原设计资产，edit沿用配对页导出的同一原组件。

保留SVG原尺寸：back/more/folder为24，monitor为28，chevron/edit为20。通过mask使用currentColor，SDK以base64封装原字节，防止原始data URL中的引号破坏CSS。修改设计时应重新导出，不能手写近似路径。搜索图标是既有搜索功能的图形，不属于该Figma首页帧，本轮保持。
