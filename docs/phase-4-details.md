# 阶段 4：住宿、活动与服务详情

从 `main / 0572ce1` 开始。2026-10-08 更新：首轮基础组件不足以构成完整详情验收，撤回此前“三类完整详情已完成”的结论。用户要求住宿严格补齐指定 Airbnb 房源的栏目，缺失文本允许占位，不能因空字段隐藏栏目。本轮修复与证据见[住宿完整性修复](phase-4-stay-remediation.md)。活动现已按指定体验页完成八组栏目及评分评论修复，用户已授权提交当前版本，见[活动修复记录](phase-4-experience-remediation.md)。随后用户明确通过活动页，授权按 Airbnb 服务 702821 进入服务开发；服务八组模块已完成并获用户认可、授权提交推送，见[服务修复记录](phase-4-service-remediation.md)。

## 已确认范围

- 首页保持获认可的 Lime 风格与几何样式；英文 C / 中文默认 B、中文 C 切换继续由 Base 控制。
- 标题、地点与图库在顶部；桌面住宿主内容在左，价格 / 行程摘要在右。手记、地点、完整房东与须知全宽排列；手机单列，栏目不删减。
- 图库采用首图 / 缩略图和原生大图 dialog，支持左右键、Tab 循环、Escape、遮罩关闭与焦点返回；无图保留类型图形。
- 住宿占位正文及虚构手记已获用户授权。原有正文和发布历史保留，通过新版本追加；此授权不等于新增文案获正式审定。
- 模拟预订、总价、凭条和正式上线仍属于阶段 5、6。联系房东打开演示说明，不发送消息。

## 实施清单与边界

| 层次 | 当前实现 |
| --- | --- |
| 公共读取 | `/api/worlds/:world/:kind/:slug/detail` 在同一 REPEATABLE READ 只读事务内读取主条目、每页 6 条公开手记、跨页评分 / 关键词汇总和最多 6 条关联内容；继承世界 / 父条目 / 发布可见性 |
| 共用 | `Gallery / DetailSection / PersonCard / VisitorNotes`；复用 `Card / Trip / Base`，不复制首页或全站样式 |
| 住宿 | 独立 `detail/stay/` 组件：规格、喜爱与评分、顶部房东、图文亮点、介绍 / 空间 / 登记、睡眠安排、完整设施、评价与分项、地区、完整房东、三组须知。空数据也保留栏目和待补充提示 |
| 活动 | 独立 experience 组件：四图拼贴、简介／五项亮点、价格与场次、活动说明、五步图文流程、集合地图、向导、六项须知；旧资料保留全部栏目。已更新开发域名，用户已授权提交当前版本 |
| 服务 | 独立 service 组件：简介、价格日期、服务内容、评分评论、资质、独立图库、地点地图、三组须知。旧内容缺资料也保留栏目；用户已验收通过 |
| 样式 | `styles/detail.css` 为基础详情，`styles/stay.css` 为住宿，`styles/experience.css` 为活动，`styles/service.css` 为服务。Lime 标题栏、窗框、字体和首页模板保持原样 |
| 展开交互 | 介绍、设施、手记、周边入口、联系说明和须知采用原生 details，可键盘操作、Escape 收起，禁用 JS 也可展开 |
| 数据 | `highlights / included / serviceItems` 保留；可选 `text.stay / text.review / attributes.stay / attributes.reviewRatings` 承载住宿与评价资料，不改旧 SQL 迁移 |
| 管理 | 中英表单可编辑扩展 JSON，草稿 / 审核 / 翻译 / 恢复 / 导入沿用版本机制；空新增数组兼容历史导入哈希 |
| 浏览状态 | 返回、语言和关联链接保留列表筛选与行程；手记页码独立。周边活动入口保留可用日期 / 人数，清除住宿专用退房日期与房间数 |
| SEO | 手记第二页起 noindex / follow，不进入 sitemap；非法或越界页 404。预览全站保持 noindex，无公开 canonical / hreflang |

## 数据补充与验证入口

`npm run db:seed:stay-details` 默认只输出计划；加 `-- --apply` 才追加。脚本只处理九个既有示例房源白名单，跳过不可见条目、缺中英发布和存在未发布编辑的条目。每条追加完整住宿版本和六篇双语虚构手记，经过原审核发布流程；重复执行保留已有资料，不新增重复手记。不会随启动自动运行。

开发库从 22 条内容追加至 76 条：原 22 条 + 54 条虚构手记；九处住宿各新增一个版本，原 22 个版本全部保留。首页 settings / revisions / publications 没有变动，预订仍为 0。旧正文、图片、价格、译文和旧发布记录逐项对照通过。主验收房源有 24 项演示设施、6 条手记；有旧设施的房源合并展示原清单。

检查入口：`npm test`、`npm run test:e2e`。测试使用隔离 schema，包括旧数据兼容、发布 / 恢复、隐藏评价、跨页统计、管理字段保留、大图、展开、语言 / 返回、无脚本和不同宽度。实际开发库 / 4321 检查单独保存，不能只以 fixture 截图代替交付。

## 预览与交接

- 主验收：`http://localhost:4321/zh/worlds/lathe-worlds/stays/dockside-window`；英文换成 `/en`。
- 旧设施 / 手记、无图：`/zh/worlds/lathe-worlds/stays/observation-room`。
- 第二世界：`/zh/worlds/test-harbour/stays/harbour-room`。
- 活动和服务：`/zh/worlds/lathe-worlds/experiences/forge-walk`、`/zh/worlds/lathe-worlds/services/augmetic-tune-up`。

启动：`SITE_INDEXABLE=false npm run preview`；Web 4321 / API 4310，仍为会话预览，不是正式部署。2026-10-08 用户认可住宿修复结果并授权提交推送，阶段 4 共用基础及本次修复随本次提交交付，实际编号以 Git 记录为准。用户的 `example_pages.zip` 保留本地。

最终测试数、参考访问过程、逐项截图和剩余事项以[修复验收记录](phase-4-stay-remediation.md)为准。首轮记录保留在 `test-results/phase4/`，本次记录在 `test-results/stay-repair/`，均不纳入 Git。

2026-10-08 后续：活动详情完成指定参考的结构修复并更新开发域名，样例为 forge-walk。新增可选 `text.experience / attributes.experience` 及后台编辑；实际数据追加、测试与审核边界见[活动修复记录](phase-4-experience-remediation.md)。用户已授权提交当前活动页及追加评论区；本次不推进服务修复或阶段 5。

2026-10-08 服务修复：新增可选 `text.service / attributes.service` 和后台字段，专用脚本仅为 augmetic-tune-up 增量发布一版及六篇双语虚构评论。活动已获用户通过；本轮服务已获用户认可并授权提交推送，三类详情本轮验收均通过，未进入阶段 5。
