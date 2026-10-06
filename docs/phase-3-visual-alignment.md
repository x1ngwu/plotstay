# 阶段 3 视觉校准与文案审定

用户在阶段 3 功能完成后明确确认：现有功能和布局正确，本轮仅校准美工与样式。开始开发前必须阅读相关文档；未确定的视觉取舍先询问，不自行另创风格。本记录优先于此前将演示视觉概括为“已验收”的表述。

## 唯一视觉基准

- 页面：[/data/apps/cocoons-web/digi-tech-lime.html](/data/apps/cocoons-web/digi-tech-lime.html)。
- 截图：[/data/apps/cocoons-web/docs/previews/digi-tech-lime-desktop.png](/data/apps/cocoons-web/docs/previews/digi-tech-lime-desktop.png)。
- 皮肤：[/data/apps/cocoons-web/assets/digi-tech-lime.css](/data/apps/cocoons-web/assets/digi-tech-lime.css)，并核对该页面实际加载的 `styles.css`、`classic-desktop.css` 和 `vendor/system.css/system.css`。
- `colony-skin-lime-desktop` 已被用户明确排除为视觉基准。Colony 的业务 / 布局 / 皮肤分层只保留为架构参考。

| 部位 | 原版依据与本轮边界 |
| --- | --- |
| 品牌字标 | 原版 ChicagoFLF 字体、`-1px` 字距、3px 网格裁切成点阵字。用户确认仅品牌字标采用此处理 |
| 首页大标题与正文 | 原版文泉驿点阵正黑字体栈，`-webkit-font-smoothing: auto`；大标题不做点阵镂空。保留旅行页面的字号层级，不将整页缩成原参考的桌面窗口尺寸 |
| 辅助信息 | 原版 `Courier New, monospace`，区分标题、正文与数字 / 小字，不将全部文字统一成现代无衬线字体 |
| 配色 | `#33ff99`、`#99ff99`、`#111111`、`#444444`、`#424242`；正文辅助色来自原版 `#92c7a8` / `#a8d6bb` |
| 背景 | 原版 3px 灰黑方点 SVG；面板和控件为原版 4px 方点 SVG。重复平铺，不拉伸、不换成圆点或宽网格 |
| 窗框 | 原版 4px SVG 切片平铺；主搜索区为亮绿，次级栏目为灰色框，键盘焦点进入栏目时使用原版亮绿状态 |
| 标题栏 | 原版网格底、绿色文字、点阵分隔和小方格标记；用户最新要求所有发现栏目统一复用顶部 `PLOTSTAY / 世界` 标题栏，取消灰色底 |
| 控件 | 方形分格边框、黑底、原版悬停 / 按下 / 禁用状态；保留原生表单、菜单、滚动与焦点行为 |
| 插画 | 用户确认本轮保留现有世界背景、房间与检修插画，暂不重画 |
| 结构与业务 | 保留模块顺序、功能、URL、SEO、数据及发布历史。发现区图标、封面尺寸及排布按用户提供的 Airbnb 参考包调整；业务代码不变 |

## 页面文字的依据

[产品计划](plan.md#产品体验)规定平台使用认真经营世界内旅游业务的口吻，幽默来自具体的设施、活动、服务说明和细则。[首页方案](phase-3-discovery.md#促销与三项平台卖点)规定世界内促销，以及“组合优惠、丰富选择、会员权益”三个卖点。具体笑话和双语句子仍需审定，候选口号、折扣与日期不能自动成为定稿。

先前自行填写的“下一站：想象之外”“宇宙已收到”“No membership needed”等没有落实上述要求，不能将它们标为已验收文案。本轮不通过重跑 seed 覆盖已有配置；经审定的文字须经首页配置版本与发布流程写入，保留旧版本。

### 已审定文案（2026 年 10 月 7 日）

用户已明确选择“采用这份文案稿，通过新版本更新首页文字”。已通过既有 `saveHomeDraft` → `publishHome` 流程发布，仅修改下表的中英文本字段，所有目标、插画、分类与栏目配置保持不变。原首页版本及商品内容历史校验一致；未重跑开发库 seed。

保留已有栏目标题、类别、商品名称及所有按钮目标。以下为首页导语、促销与三个卖点的审定文字，优惠和会员继续属于叙事展示，不增加结算或会员功能。

| 位置 | 中文 | English |
| --- | --- | --- |
| 搜索区眉题 | 拉斯世界旅行服务 | LATHE WORLDS TRAVEL |
| 搜索区大标题 | 下一次休假，从这里开始。 | Your next leave starts here. |
| 搜索区说明 | 从观景客房到铸造厂导览，安排住宿、当地体验与旅途所需服务。 | Find a room, join a forge tour, and arrange local services for your stay. |
| 促销适用人群 | 携带机械部件的旅客适用 | FOR TRAVELLERS WITH AUGMETICS |
| 促销标题 | 随行机械肢体，免收加床费。 | No extra-bed fee for accompanying mechanical limbs. |
| 促销说明 | 为您与随行部件安排一处落脚点。请在入住前申报需单独充电的部件。 | Find a place for you and your accompanying parts. Please declare any parts that require separate charging before arrival. |
| 促销按钮 | 查看旅行选择 | Explore travel options |
| 组合优惠标题 | 住宿与体验组合礼遇 | Make more of your stay |
| 组合优惠说明 | 住进观景客房，再参加当地导览。行程一并安排，休假批准仍请分开申请。 | Pair a room with a local tour. Plan them together; leave approvals must still be requested separately. |
| 组合优惠按钮 | 安排行程 | Plan your trip |
| 丰富选择标题 | 从轨道码头到铸造厂 | From orbital docks to the forge |
| 丰富选择说明 | 按地区探索客房、活动与当地服务。静修客房的“安静”以当地生产标准为准。 | Explore homes, experiences and local services by district. Quiet rooms are assessed against local production standards. |
| 丰富选择按钮 | 探索当地 | Explore the area |
| 会员权益标题 | 常旅客特别礼遇 | A little extra for returning travellers |
| 会员权益说明 | 您的忠诚值得记录。休假申请仍需自行递交。 | Your loyalty deserves recognition. Leave requests remain your responsibility. |
| 会员权益按钮 | 了解旅行服务 | About our travel service |

## 验收记录

- [x] 只以原版 digi-tech Lime 为视觉基准；字体、边框、网格素材已核对原文件和浏览器实际字体。
- [x] 用户确认品牌字标点阵、大标题原版正文字体、保留插画。
- [x] 中英桌面 / 平板 / 手机预览逐项检查；字体缺失时的网络字体可加载。
- [x] 既有浏览器测试通过，搜索、语言、行程、分页、详情及管理流程无回归。
- [x] 预览关闭索引，记录地址、截图与验证结果。
- [x] 文案稿经用户审定后通过配置发布，历史保留。新首页 revision 为 `f7924c64-b717-4744-97f5-48156973ec97`，publication 为 `80288e21-a823-45c5-a33c-ad406a11648b`；既有内容 6 张表摘要前后一致，旧首页版本 / 发布逐行一致，记录在 `test-results/lime-copy-publication.json`。
- [x] 用户认可当前视觉版本并授权 commit & push（2026 年 10 月 7 日）；后续细节仍可按反馈迭代。

### 实际验证与交接（2026 年 10 月 7 日）

- `npm test`：31 tests 通过。
- 构建及类型检查通过，Astro 0 errors / warnings / hints。`npm run test:e2e` 首轮唯一失败子项仍断言旧文字色 `#e1e8df`；按原版 `#33ff99` 修正该断言后，在同一构建上完整重跑 `tsx --test --test-concurrency=1 tests/ssr.test.ts tests/seo.test.ts tests/dev.test.ts tests/discovery-e2e.test.ts`，25 tests 全通过。日志为 `test-results/lime-e2e-final.log`。
- 既有专项再次覆盖 73 条公开内容无脚本全量遍历、分页自引用 SEO、中英切换、日期与人数保留、服务管理、发布 / 下架 / 恢复、旧内容管理与导入流程。
- 原端口预览为 `http://localhost:4321/zh`、`/en`，API 为 `127.0.0.1:4310`；仍为会话进程，`SITE_INDEXABLE=false`。8 个代表性入口均 200 / noindex，无 canonical / hreflang，sitemap 为空。
- Chromium 检查中英 `1440 / 768 / 390 / 320px`，均无页面横向溢出；额外检查手机结果、服务详情、管理和帮助页，以及菜单 Escape / 焦点恢复、卡片轨道键盘滚动。无页面脚本错误。
- 对改动前后 `main` 的元素结构与属性进行比较，只忽略截图工具留下的空 `style` 属性及已批准更新的文字，结构、表单及全部链接目标一致。`packages/themes/layout.css`、页面查询 / 交互、API、契约、领域和迁移文件与本轮起点的哈希一致。
- 4 个 SVG 瓦片和 Chicago 字体直接复用原版。文泉驿点阵正黑按原字体完整 42,285 个码点分成 95 个互不重叠的 Unicode 包，保留字形、hinting 和内嵌位图；已验证浏览器禁用本地字体来源时仍实际使用 `ChicagoFLF` / `WenQuanYi Zen Hei Sharp`。本页实测只请求 11,008 字节 Chicago 和 138,876 字节常用字包。字体栅格化由浏览器及操作系统完成；本机字体与网络字体均已截图核对。
- 仅新增一条首页版本和一次发布，旧首页版本 / 发布逐行一致；内容、内容版本、译文、版本语言、发布及发布语言六张表摘要一致。新鲜安装的 discovery seed 复用已审定文字，已有库不靠重跑 seed 覆盖。
- 本轮更改限于皮肤 / 字体资源、品牌文字的样式包裹、已审定文案数据、旧颜色断言与文档。保留原有世界 / 房间 / 检修 SVG，未增加依赖到应用运行或构建流程，未改业务功能或数据库结构。

截图与检查结果：

- [桌面首屏](/data/apps/plotstay/test-results/lime-final-en-1440-fold.png)、[完整桌面](/data/apps/plotstay/test-results/lime-final-en-1440.png)。
- [中文手机首屏](/data/apps/plotstay/test-results/lime-final-zh-390-fold.png)、[完整手机](/data/apps/plotstay/test-results/lime-final-zh-390.png)、[手机服务列表](/data/apps/plotstay/test-results/lime-final-services-mobile.png)。
- 字体与预览探针：`test-results/lime-final-check.json`；文案发布核对：`test-results/lime-copy-publication.json`；本轮变更范围快照：`test-results/lime-scope-before.json` / `lime-scope-after.json`。以上为本地验收产物，不进入 Git。

该轮结束时，工作区仍包含从 `cc98987` 开始的阶段 3 未提交改动，尚待用户查看视觉效果；此后继续完成下文两轮校准。当前认可与提交授权见文末记录，不自动进入阶段 4。

## 间距与图标迭代（2026 年 10 月 7 日）

用户最新反馈：“这次是纯粹的艺术风格接近了，但是样式和间距很差”，要求参考 Airbnb 的图标大小、文字间距及栏目间距，解决留白过宽且没有变化的问题。本次据此调整样式尺寸与疏密。原版 digi-tech Lime 仍为美术基准；栏目顺序、响应式列数、内容、搜索和管理行为保持不变。

### 参照与取值

通过 `agent-reach` 的网页读取流程及 Chromium 核对 [Airbnb 首页](https://www.airbnb.com/)和[已加载的体验列表](https://www.airbnb.com/s/experiences)。首页内容区在本次访问中未完整加载，不据此声称量到首页栏目间距；下表中的卡片与网格数值来自实际加载的体验列表，窗口为 1440 × 1000。网页可能因地区和实验版本不同而变化，此处是本次采样。

| 部位 | Airbnb 实测参照 | PlotStay 此次取值 |
| --- | --- | --- |
| 顶栏图标 | 菜单 16px、账号 24px，按钮外框 40 × 40px | 菜单 16px、账号 24px；桌面外框 40 × 40px，手机 40 × 44px |
| 分类 / 卖点图标 | 使用上述 16 / 24px 图标层级作比例参照 | 原 32px 改为 24px 固定图标框，图文距离 8px；分类入口至少 48px 高 |
| 卡片文字 | 标题 14 / 20px，辅助信息 12 / 16px，文字组 gap 2px | 保留点阵字体可读性：标题 16 / 20px，摘要 14 / 19.6px，辅助信息 13 / 18.2px；取消段落默认外边距，文字组 gap 4px |
| 图文与标题栏 | 体验列表栏目标题 20 / 24px；网格横向 24px、纵向 40px | 栏目标题桌面 20 / 24px、手机 18 / 21.6px；标题栏到内容 12px，封面到文字 8px，卡片横向桌面 16px / 手机 12px |
| 栏目疏密 | 根据内容关系划分间距，数值为本项目适配，不宣称照抄首页 | 桌面大模块 32px、分类到活动及住宿到地点 24px、连续地点 16px；手机对应 24 / 20 / 12px，代替原来统一 44.8px / 32px |
| 搜索与促销 | 沿用已经确认的背景搜索与促销组织 | 搜索区外层内边距桌面 32px / 手机 16px，表单内边距 16px / 12px；大标题 48px / 32px；促销与卖点取消多余段落留白 |

没有下载或复用 Airbnb 图标、字体、图片、组件代码。本次只借鉴大小、行距与信息密度，原有 Lime 图形、字体文件、调色板、3px / 4px 纹理和窗框素材原样保留。现有首页文案版本继续使用，未执行 seed、迁移或数据发布。

### 验证与交接

- [x] 先阅读视觉校准、当前交接与首页方案，核对工作区及 `cc98987` 提交起点；保留已有未提交内容。
- [x] 仅修改 `packages/themes/layout.css`、`packages/themes/lime.css` 与相关文档。业务代码、页面模板、链接、文字、脚本、测试、迁移和图片 / 字体素材与本次起点哈希一致。
- [x] 注入候选 CSS 预览后完成构建，随后重启原端口，复核实际构建版截图；未将仅在浏览器中注入样式的草稿当成交付。
- [x] `npm run test:e2e`：构建与类型检查通过，Astro 0 errors / warnings / hints，25 tests 通过。覆盖 73 条公开内容无脚本遍历、分页 SEO、语言与行程保留、服务管理及发布流程。日志：`test-results/spacing-e2e.log`。后端代码无变化，本轮未重复运行上一轮已通过的 31 项领域测试。
- [x] 中英 `1440 / 768 / 390 / 320px` 无页面横向溢出；手机服务列表、详情、管理和帮助入口无溢出；卡片轨道键盘 / 按钮滚动、菜单 Escape 和焦点恢复通过，无页面脚本错误。
- [x] 对比完整 `main` 元素结构、属性、文字和链接，除截图工具产生的空 `style` 属性外完全一致。按钮和表单行为由既有浏览器回归覆盖。
- [x] `http://localhost:4321/zh`、`/en` 已更新，API 保持 `127.0.0.1:4310`，启动显式设置 `SITE_INDEXABLE=false`。8 个代表性入口 200 / noindex，不输出 canonical / hreflang，sitemap 无公开 URL。
- 用户随后要求继续校准标题栏、分类图标和封面尺寸，见下节；本轮技术结果不替代视觉确认。

同一数据与字体下，英文 1440px 页面高度由 4387px 降至 3440px（约 22%），中文 390px 由 4849px 降至 4067px（约 16%）。高度只用于说明去除了多余留白，不作为视觉质量的唯一标准；全部模块和文字继续存在。

- 桌面对照：[调整前](/data/apps/plotstay/test-results/spacing-before-en-1440.png)、[调整后](/data/apps/plotstay/test-results/spacing-final-en-1440.png)、[新版首屏](/data/apps/plotstay/test-results/spacing-final-en-1440-fold.png)。
- 手机对照：[调整前](/data/apps/plotstay/test-results/spacing-before-zh-390.png)、[调整后](/data/apps/plotstay/test-results/spacing-final-zh-390.png)、[新版首屏](/data/apps/plotstay/test-results/spacing-final-zh-390-fold.png)。
- 检查记录：`test-results/spacing-before-metrics.json`、`spacing-final-check.json`、`spacing-scope-before.json` / `spacing-scope-after.json`。Airbnb 采样保存在 `/tmp/plotstay-airbnb-metrics.json` 与 `/tmp/plotstay-airbnb-card-dimensions.json`，不进入应用资源或 Git。

该轮结束时预览为会话进程、工作区尚未提交；随后按用户提供的参考包继续校准，不自动进入阶段 4。

## 用户参考包校准（2026 年 10 月 7 日）

用户进一步要求：所有发现栏目标题横条复用顶部 `PLOTSTAY / 世界` 的黑底点阵、绿色文字和点状分隔；“icon”包括附近活动分类图标与热门活动 / 住宿的整张封面卡片，尺寸和排布都应尽可能接近 Airbnb。此轮明确允许调整发现区列数，覆盖前轮保持列数的限制，功能和模块顺序继续保持。

### 实际参照

用户提供的 [example_pages.zip](/data/apps/plotstay/example_pages.zip) 包含 Airbnb、Expedia 的完整保存页、资源目录与截图。Airbnb HTML 中确实存在 `Explore experiences nearby`、`Popular experiences in Tokyo`、热门住宿及地点栏目，解决了在线访问地区 / 页面版本不一致的问题。本轮以此包为准，不再用结果列表或未完整加载的首页推断这些栏目的尺寸。

原包保持原位。副本解压至 `/tmp/plotstay-user-reference`；本地重放关闭页面脚本和外部请求，仅在临时副本移除阻止本地 CSS 加载的 `crossorigin` 属性、让图片使用已保存的本地来源。提供的截图宽 3024 像素，HTML 保存的视口宽为 1512 CSS 像素。存档未含网络字体，文字字形以用户原始截图核对，几何尺寸来自保存的 CSS。没有把第三方图片、字体、脚本或组件代码放入应用。

| 项目 | 用户参考页实测 | PlotStay 本轮 |
| --- | --- | --- |
| 桌面分类缩略图 | 1512px 视口下约 125.4 × 119.1px，图上字下，图文 gap 8px、横向 gap 10px | 125 × 118.75px，原有 Lime 图形放入相同比例图框，名称移到下方，gap 8 / 10px |
| 桌面热门封面 | 约 181.7 × 172.6px，宽高比 20:19，横向 gap 12px | 182 × 172.9px、20:19、gap 12px；活动、住宿和地点排共用 `.card-track` |
| 手机分类 | 390px 时约 102.3 × 97.2px、每屏 3 个；320px 时每屏 2 个 | 390px 时约 104.7 × 99.4px、每屏 3 个；374px 以下改为 2 个，保留横向浏览 |
| 手机热门封面 | 390px 时约 157.5 × 149.6px、每屏 2 张 | 约 161 × 152.9px、每屏 2 张；小幅差异来自原页面容器与 Lime 边框 |
| 文字 | 卡片标题 13 / 16px，文字组 gap 2px，封面到文字 8px | 发现卡片标题 13 / 16px、辅助信息 12 / 16px、gap 2px；封面到文字 8px，保留全部原文字段 |
| 标题栏 | 用户要求采用 PlotStay 顶部窗口风格 | `.window-bar` 与所有 `.content-section > .section-heading` 共用背景、文字色、点状分隔和 13px 方格标记；取消发现标题灰底 |

页面整体容器、搜索区、促销与底部卖点沿用上一轮样式。参考库目前只有 3 个活动类别，内容排按现有 2–6 条数据呈现，不增加内容或修改首页配置。共享的卡片尺寸覆盖热门活动、热门住宿及所有地点栏目；完整结果列表继续采用自身的分页网格。

### 本轮验收与交接

- [x] 仅修改布局 CSS、Lime CSS 与相关文档。模板、业务代码、文案、链接、字体 / 图片资源、测试、迁移与本轮起点摘要一致；没有 seed、迁移或首页发布操作。
- [x] 最终 `npm run test:e2e` 构建及类型检查通过，25 tests 全部通过；涵盖 73 条内容无脚本遍历、分页 SEO、语言与行程保留、搜索类型、图片失败回退及服务管理。日志：`test-results/rails-e2e-final.log`。
- [x] 实际构建版中英 `1440 / 768 / 390 / 320px` 无页面横向溢出；窄屏分类末项可通过键盘聚焦滚入视野；卡片轨道键盘和按钮滚动、菜单 Escape / 焦点恢复通过。
- [x] 六个发现栏目的标题背景、文字色和点状底边与顶部窗口一致。桌面和手机均通过浏览器计算样式核对，记录在 `test-results/rails-shared-titlebars.json`。
- [x] 完整 `main` 的结构、文字和链接与前轮一致；手机服务列表、详情、管理和帮助页无溢出，无页面脚本错误。
- [x] 预览已重启为最新构建，仍为 `http://localhost:4321/zh`、`/en`，API `127.0.0.1:4310`，显式设置 `SITE_INDEXABLE=false`。8 个代表性入口均 200 / noindex，无 canonical / hreflang，sitemap 无公开 URL。
- [x] 用户认可当前版本并授权 commit & push；后续细节仍可按反馈迭代，不自动进入阶段 4。

截图：[桌面发现区域](/data/apps/plotstay/test-results/rails-final-discovery-1440.png)、[手机发现区域](/data/apps/plotstay/test-results/rails-final-discovery-390.png)、[完整桌面](/data/apps/plotstay/test-results/rails-final-en-1440.png)、[完整手机](/data/apps/plotstay/test-results/rails-final-zh-390.png)。

检查数据：`test-results/rails-final-check.json`、`rails-scope-before.json` / `rails-scope-after.json`；参考页测量为 `/tmp/plotstay-user-reference/measurements.json`。参考 ZIP 与本地验收产物仅保存在本地，不纳入 Git；阶段 3 源码与文档随本次提交交付。

### 当前版本认可与提交授权

2026 年 10 月 7 日，用户查看本轮结果后明确回复：“对，这个接近多了。commit & push”。据此记录当前视觉版本获认可，并提交、推送阶段 3 实现与样式校准成果。此记录不代表后续不能继续打磨细节，也不授权自动进入阶段 4。提交前仅同步验收与交接状态，没有再修改功能、样式或数据；沿用上文对当前代码的验证结果，实际提交编号以 Git 记录为准。
