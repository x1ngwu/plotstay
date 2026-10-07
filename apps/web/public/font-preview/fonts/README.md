# 首页字体试排素材

2026-10-07 从 `/data/apps/cocoons-web/assets/fonts/pixel/` 原样复制以下五个文件，用于用户请求的首页字体对照。未改名、转码、裁剪或修改字体文件。

| 文件 | 试排用途 |
| --- | --- |
| `DinkieBitmap-7px.woff2` | C 中文展示标题 |
| `DinkieBitmap-9px.woff2` | A / B 中文标题、B / C 中文正文 |
| `DinkieBitmap-9pxCode.woff2` | A 英文标题、B 英文与数字 |
| `cc-red-alert-inet.ttf` | C 英文正文及栏目标题、A / B 窄屏英文栏目标题 |
| `press-start-k.ttf` | C 英文大标题、促销标题 |

来源目录已记录用户确认持有授权。丁卯字体保留 Willie Liu 的内嵌版权信息，Press Start K 保留 codeman38 的内嵌版权信息；不将这些字体标为开源或无条件再分发。沿用用户实际授权范围。

C&C 的原始 `README-c-c-red-alert.txt` 逐字节保留，具体使用条件见该文件。来源文件大小、SHA-256 及字形抽查见 Cocoons 的 `assets/fonts/pixel-manifest.json`。

这里保留完整源文件和旧版 `/font-preview/fonts.css`，便于追溯及兼容旧页面。当前页面由 `packages/themes/pixel.css` 注册字体，使用 `apps/web/src/assets/fonts/pixel/` 中的交付副本和丁卯分包，生成带内容哈希的缓存地址；原始文件不变。用户已确认英文采用 C、中文默认 B 并保留 C 切换；原版与 A 仍保留为对照。具体入口、映射及加载优化见仓库 `docs/font-previews.md`。
