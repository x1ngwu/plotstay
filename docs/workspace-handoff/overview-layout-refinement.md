# 首页两块列表的排版微调

日期：2026-10-12。基线：`a3b0ac7`。状态：**用户确认预览后，已应用到真实中英文首页并更新开发域名**。

## 依据与范围

用户提供[已讨论的文字方案](https://chatgpt.com/share/6accb0cc-e55c-83ee-8b9b-79f43122ce98)，并上传 `/tmp/排版示意1.png`、`/tmp/排版示意2.png` 补齐分享页无法显示的图示。两张图均已查看。沿用现有 Plotstay 浅色风格，落实图中层级与对齐；先调整独立交互稿，用户回复“对，这就对了！”后，将已确认的两块列表布局同步到真实首页。

- 继续处理：名称＋独立状态标签 → 类型、世界、项目路径与署名 → 可选说明 → 左侧保存时间。已公开与未提交修改各保留一个标签。
- 需要你处理：名称 → 类型＋状态 → 有内容时的上下文 → 退回原因或评价摘录。退回原因加重，摘录使用左侧细线。
- 两块列表统一描边操作按钮，桌面右边缘及顶部对齐；面板窄于 440px 时按钮移到内容下方、仍靠右。
- 分组名称和数量降低至辅助层级；保留原 Tabs、角色／项目／世界／互动分组、按钮文案、演示目标和状态流程。

## 实测来源与调整

修改前浏览器 computed styles 显示：`.compact-meta` 为 `display:flex; justify-content:space-between`，是时间被推到右侧的直接原因；`.row` 为 `align-items:center`，使不同高度条目的按钮位置不稳定；分组名称为 14px／700，条目名称为 16px／650，层级过近。Tabs 和分组头左右为 22px，而条目为 20px、组间线铺满面板；旧样式与后加紧凑样式共同决定了最终间距。预览没有 prose／Typography 容器继承问题。

本次 `app.js` 的 `row()` 明确分开标题、状态、辅助信息、说明与时间；`style.css` 局部规则限定列表与相应面板：

| 元素 | 本次预览 |
| --- | --- |
| 模块标题 | 沿用 18px，手机 17px |
| 条目名称 | 16px／650，行高 1.5 |
| 分组名称、数量 | 13px／500，行高 1.5 |
| 说明与辅助信息 | 14px，行高 1.5 |
| 状态标签 | 12px／500，行高 1.5 |
| 保存时间 | 13px，行高 1.5，左侧末行 |
| 条目内部字段 | 单一 grid gap 5px，段落 margin 清零 |
| 分组头到内容 | 10px |
| 分组间隔 | 边界前后各 12px，共 24px；含一条分隔线 |
| 水平边界 | 桌面统一 22px，手机 20px |
| 操作按钮 | 13px，最小高度 40px；窄屏／手机 44px |

## 预览与对照

- [中文交互预览](https://plotstay.xingwu.dev/_design/overview/?lang=zh)
- [英文交互预览](https://plotstay.xingwu.dev/_design/overview/?lang=en)
- [中文桌面修改前](https://plotstay.xingwu.dev/_design/overview/screenshots/layout-before-zh-mine-1440.png)／[修改后](https://plotstay.xingwu.dev/_design/overview/screenshots/layout-after-zh-mine-1440.png)
- [中文手机修改后](https://plotstay.xingwu.dev/_design/overview/screenshots/layout-after-zh-mine-390.png)
- [1100px 窄桌面](https://plotstay.xingwu.dev/_design/overview/screenshots/layout-after-zh-mine-1100.png)
- [英文桌面](https://plotstay.xingwu.dev/_design/overview/screenshots/layout-after-en-mine-1440.png)／[英文手机](https://plotstay.xingwu.dev/_design/overview/screenshots/layout-after-en-mine-390.png)

`screenshots/layout-{before,after}-{zh,en}-{mine,assisted}-{1440,1100,390}.png` 为同视口、同示例的 24 张对照；既有场景截图也随预览更新。

## 预览阶段验证与发布边界

- 12 组语言／尺寸／页签布局检查，无页面横向溢出或浏览器异常。
- 12 组可读性检查：三个宽度、中英各验证 200% 文字字号，以及 1.5 行高、0.12em 字距、0.16em 词距、2em 段落下距覆盖。目标内容区和按钮无溢出或裁切。此处验证文字放大，不把 CSS 整页 zoom 当作浏览器缩放。
- 既有 `verify.mjs` 的 7 组交互检查通过，覆盖 28 种场景组合及 20 张截图。预览不访问业务 API。
- `overview-validation/layout-{before,after,readability}.json` 保存样式与检查结果。临时复验脚本为 `/tmp/plotstay-layout-capture.mjs`、`/tmp/plotstay-layout-readability.mjs`。
- Nginx 既有静态 alias 直接提供更新后的预览文件，无应用构建／重启或配置变更。公网预览匿名 401，仍有 Basic Auth、noindex/nofollow/noarchive、private/no-store；浏览器检查使用同目录受控本机服务，没有声称验证公网认证后交互。
- 预览阶段未修改真实首页、API、数据库；没有本轮 commit/push。`example_pages.zip` 原样保留，SHA-256 仍为 `2338ebbf7ead485b3842e0d8eb3204da83dfd52c4eb8994c85c2daa232b72d26`。

## 确认后的真实页面实施与验收

- 用户确认本次预览，已修改 `apps/web/src/lib/workspace-overview.ts` 与 `apps/web/src/styles/workspace-overview.css`，按相同层级与尺寸呈现真实 DTO。两个区块的“查看全部”沿用同一行组件与容器适配。
- 标题／状态／上下文／说明／保存时间分别渲染；已公开与未提交修改为两个标签；审核队列保留“世界”及真实数量。只有接口提供说明时才显示，未把示例“入住说明”写入真实数据或硬编码到应用。
- 描边按钮顶部右侧对齐；面板宽度不超过 440px 时移到内容下方靠右。角色／项目等组标题改为 13px／500，统一边界和分隔线。真实工作台原有整体响应式断点保留。
- 未修改 API、归属／权限、对象目标、返回定位、最近进展与常用世界逻辑。没有迁移、seed/reset；没有本轮 commit/push，ZIP 校验值不变。

### 验证结果

- `npm run build` 通过，TypeScript／Astro 检查 0 错误、0 警告、0 提示。
- 现有隔离浏览器用例 `tests/overview-e2e.test.ts` 通过：真实摘要请求、键盘切换两个页签、精确编辑及返回、角色保存、历史只读、共享配置定位、常用世界固定和失败重试；截图覆盖中英桌面／手机。测试写入只发生在隔离测试 schema。
- 重启 `plotstay-preview` 后为 `active`，`/api/health` 为 `ok`。
- 同一部署服务经本机受控入口完成真实应用登录后，只读检查 8 个页面／接口，中英 1440／1100／390px × 两个页签共 12 张真实数据截图，无横向溢出或浏览器异常。
- 当前真实账号的待处理项为空，因此另用浏览器路由替换摘要响应，验证部署后的真实渲染器呈现审核／退回／可回复／草稿／公开版加修改等状态；12 组布局检查与 12 组 200% 文字／间距检查通过。此类截图明确为示例响应，不代表线上真实业务记录；未写现用业务数据库。
- 公网 12 个页面／API／预览／资源及 robots 保护检查通过，匿名 401，robots 200 且 `Disallow: /`，Basic Auth、noindex/nofollow/noarchive、private/no-store 保持。未持有 Basic Auth 明文，未声称完成公网认证后的浏览器交互。
- 本轮仅调整渲染与 CSS，未变更请求逻辑；既有浏览器回归仍核验摘要只请求一次、不拉全量内容。部署后 120ms 模拟延迟的首页侧栏导航就绪采样为 490ms，单次采样仅作冒烟参考，不据此声称性能提升。

### 验收入口与证据

- 真实页面：[中文工作台](https://plotstay.xingwu.dev/zh/workspace)／[英文工作台](https://plotstay.xingwu.dev/en/workspace)。
- 真实数据截图：[中文桌面](https://plotstay.xingwu.dev/_design/overview/screenshots/layout-live-zh-assisted-1440.png)／[英文手机](https://plotstay.xingwu.dev/_design/overview/screenshots/layout-live-en-assisted-390.png)。
- 真实渲染器＋浏览器内示例响应：[中文桌面](https://plotstay.xingwu.dev/_design/overview/screenshots/layout-renderer-sample-zh-mine-1440.png)／[英文手机](https://plotstay.xingwu.dev/_design/overview/screenshots/layout-renderer-sample-en-mine-390.png)。
- `overview-validation/layout-{live,renderer,security}.json` 保存本轮结果；`screenshots/layout-live-*` 为真实数据，`screenshots/layout-renderer-sample-*` 为示例响应。
- 临时复验脚本：`/tmp/plotstay-layout-live.mjs`、`/tmp/plotstay-layout-real-fixture.mjs`、`/tmp/plotstay-overview-security.mjs`；构建及隔离回归日志：`/tmp/plotstay-layout-build.log`、`/tmp/plotstay-layout-e2e.log`。


## 提交归档

2026-10-12 用户在部署完成后明确授权 commit & push。本次归档包含实现、独立预览、截图和验证记录，`example_pages.zip` 不纳入提交。上文“未 commit/push”为当时实施阶段状态；提交标识以 Git 历史为准。本次归档无需再次构建或重启。
