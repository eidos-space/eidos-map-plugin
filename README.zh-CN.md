# 地图

使用 MapLibre GL JS 在表格视图中显示带经纬度的记录。

国际化版本需要插件 API **3.7.0**，支持 **Eidos Lite 0.29.0** 及以上版本。此安装包使用宿主网络 API，CLI Serve 暂不支持；已经安装的旧版仍可使用，请勿用此包替换旧版 CLI 安装。旧宿主会拒绝安装新归档。

从插件市场或 GitHub Release 安装并在 Space 启用，打开表格，添加地图视图。在视图设置中选择经度、纬度、标题字段及底图。映射按字段 ID 保存，各视图相互独立；切换语言保留配置和地图位置。

- 跟随宿主的搜索、筛选和排序，每页读取 1,000 条，最多显示 50,000 条匹配记录。
- 零坐标有效，缺少或非法坐标的记录会被排除并统计。
- 相邻点自动聚合，点击聚合点放大；显示全部按钮适应所有已加载的有效点。
- 点击记录弹窗可打开宿主记录面板。
- 默认使用 OpenFreeMap 在线底图；失败时回退到内置世界轮廓，不含街道细节。不提供离线瓦片下载。
- 只声明 `https://tiles.openfreemap.org`。服务会收到视口所需的瓦片请求，表格记录不会上传。
- 记录数据只读；宿主允许时可保存视图配置。需要 WebGL，MapLibre 及 Worker 随归档打包。

## 开发

使用 Node.js 22.12 及以上版本及 SDK/tools 0.9.0，运行 `npm ci`、`npm test` 和 `npm run pack:plugin`。自定义打包器保留不透明 iframe 中的本地 Worker 适配，输出标准插件归档及 `SHA256SUMS`。更新 MapLibre 时需要复核适配，不放宽 CSP 或网络授权。

保留 MapLibre、World Atlas、Natural Earth 与 OpenFreeMap/OpenMapTiles/OpenStreetMap 的许可和署名。
