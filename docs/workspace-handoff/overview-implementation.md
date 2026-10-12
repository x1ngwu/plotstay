# 首页体验调整实施记录

日期：2026-10-12。当前状态：**已按用户反馈完成真实首页接入、技术验证并更新开发域名；交用户体验验收**。用户随后明确授权本轮 commit & push，实现、交互稿、截图与验证记录纳入本次提交；ZIP 仍排除。提交标识以 Git 历史为准。

## 本轮确认与实际实现

用户确认页签及常用世界存储方案，并要求压缩信息层级、删除内部箭头、世界入口改为三列图标。最终审核行采用“拉斯世界　世界 · 3 条内容待审核”；同意其余合并示例。两个页签始终显示，默认“我的创作”，返回保留选择；账号拥有／本人创建归 mine，实际保存的代编及共享配置归 assisted。此确认后继续真实接入，无需再次申请发布授权。

- `workspaceOverview` 在数据库侧核验来源、当前版本、权限、过滤和计数，再截取摘要；首页请求数不随世界数量增长。保留 bootstrap 预取、单次导航响应复用及写后失效。
- 待办审核／退回优先，未回复评价标“可回复”。回复草稿、提交、退回、发布按真实状态转栏；阅读不完成。公开版和新修改同时表达，完成项退出，历史进展保留实际事件时间。
- 继续处理保留角色／项目／世界／互动分组、空组隐藏和范围一致的分页查看全部。依据当前保存证据，不把仅管理、访问或审核算作代编。
- 角色、评价、回复、固定角色提交、共享配置、首页配置及内容编辑精确定位；经校验的同语言首页返回保留页签、分页、滚动和焦点。旧版本链接只读，显式进入当前版本后才能继续操作。
- 常用世界按账号 localStorage 隔离，只存 ID、固定顺序和访问时间；最近记录最多 20 个，显示最多 4 个；每次展示重新核验权限。无记录隐藏、失败可单独重试。直接进入项目编辑也记录已授权的世界访问。
- 收到提供者回复可直接查看对应事件的固定回复正文；接口只允许评价作者读取，仍检查公开状态和隐藏状态。
- 原有后台、业务权限和 WS-08～13 范围保持原约定。本轮无数据库迁移，业务写入验证全部在隔离 schema；现用数据只读验收。

真实接口详见 [数据契约](overview-data-contract.md)。独立交互稿已经同步紧凑布局；真实实现的隔离截图在 `test-results/overview/`，上线截图与最终测试／性能结果见下文。

### 真实接入的验证

- 最终 `npm test`：90 项通过、0 失败；最新聚合接口专项另复验 4 项通过。涵盖本人／他人、保存者／仅管理、人工译文、固定提交与新稿、共享配置、分页总数及越界页、回复转栏、事件访问隔离与目标隐藏。
- 标准 `npm run test:e2e`：63 项通过、0 失败；包含本轮新增首页测试。`npm run build`：TypeScript／Astro 0 error、0 warning、0 hint。
- 首轮端到端发现首页直达项目编辑未记录常用世界访问；已补入现有世界权限核验分支，首页专项复验通过。收到回复的事件接口补测发现测试误把回复正文当作 `body.texts`，已按真实结构 `body[locale]` 修正断言，业务正文结构未改动。
- 首页浏览器专项覆盖真实隔离数据、键盘切换、保存后返回、历史版本只读、配置定位、独立失败重试，以及中英 1440px／390px、两个页签共 8 张实现截图。无横向溢出或浏览器异常。
- 沿用旧标准端到端检查未保存保护、冲突、旧后台、新旧共享表单、公开详情、预订、SEO、保存预览及发布恢复。示例写入只在随机测试 schema，开发站只读验收。
- 首轮线上性能对照发现摘要查询约 633ms。只读执行计划显示 PostgreSQL JIT 编译约 565ms，关闭 JIT 后实际执行约 15ms（规划约 12ms）。首页查询现用事务内 `SET LOCAL jit = off`，不更改数据库／连接池全局设置；另验证查询结束后设置不泄漏。历史进展“submitted”显示“已提交审核”，与当前事项的“待审核”区分。此两项在完整回归后另执行最终构建与首页专项复验。
- 最终构建后的 `tests/overview.test.ts`＋`tests/overview-e2e.test.ts`：5 项通过、0 失败。日志分别在 `/tmp/plotstay-overview-unit-final.log`、`/tmp/plotstay-overview-e2e-final.log`、`/tmp/plotstay-overview-final-focused.log`、`/tmp/plotstay-overview-final-build.log`。

### 最终部署与线上验收

- 已按 operations 授权构建并重启 `plotstay-preview`；服务 `active`，`/api/health` 为 `ok`。部署为基线 `574fda8` 之上的本轮实现；部署时尚未 commit/push，后续按用户明确授权归档本次提交。
- 真实入口：[中文首页](https://plotstay.xingwu.dev/zh/workspace)、[英文首页](https://plotstay.xingwu.dev/en/workspace)。共 8 项同一部署服务的应用登录后只读页面／API 检查通过，新旧入口均正常；中英、两页签、桌面／手机共 8 张线上截图，无横向溢出或浏览器异常。
- 主要截图：[中文桌面](https://plotstay.xingwu.dev/_design/overview/screenshots/live-zh-mine-1440.png)、[中文手机](https://plotstay.xingwu.dev/_design/overview/screenshots/live-zh-mine-390.png)、[英文桌面](https://plotstay.xingwu.dev/_design/overview/screenshots/live-en-mine-1440.png)、[英文手机](https://plotstay.xingwu.dev/_design/overview/screenshots/live-en-mine-390.png)。同目录 `live-*-assisted-*.png` 为协助页签。
- 公网 12 项保护检查通过：中英页面、新 API、独立预览、JS、截图匿名均为 401，Basic Auth、noindex/nofollow/noarchive、private/no-store 保留；仅 robots.txt 公开且 `Disallow: /`。服务配置继续 `SITE_INDEXABLE=false`。
- 无 Basic Auth 明文凭据，**未复验公网认证后的浏览器交互**。上述真实截图和应用交互使用受控 loopback 入口访问同一部署服务；公网仅核验匿名保护响应。用户仍用原开发站凭据打开页面。
- 无数据库迁移、现用库 seed/reset 或示例写入。`example_pages.zip` SHA-256 保持 `2338ebbf7ead485b3842e0d8eb3204da83dfd52c4eb8994c85c2daa232b72d26`。

### 最终性能对照

沿用同一已部署服务、账号、现有数据和脚本：Chromium 1440×900、关闭缓存、20Mbps／10Mbps、CDP 延迟 0／120ms，完成判定保持一致。首页判定为主摘要可用，常用世界是独立补充请求。结果为单次诊断，不能当作 P95 或公网容量承诺。

| 页面 | 0ms：修改前 → 后 | 120ms：修改前 → 后 | 基础 API 请求：前 → 后 |
| --- | ---: | ---: | ---: |
| 概览 | 238 → 283ms | 523 → 521ms | 9 → 2 |
| 我管理的内容 | 235 → 277ms | 552 → 618ms | 4 → 4 |
| 世界设定 | 366 → 369ms | 592 → 754ms | 6 → 6 |
| 管理工具 | 218 → 213ms | 523 → 621ms | 4 → 4 |

首页基础请求仅身份与摘要，有本机常用世界记录时另发 1 次权限解析；不随世界数量增长。前次 API 预取、响应复用及去瀑布优化保留。其他菜单本次部分采样高约 60～160ms，资源轨迹显示新增共享脚本加载开销；本轮没有声称全站提速，此项作为后续性能关注点记录。首页聚合自身的 JIT 回退已解决。

另做最终真实侧栏点击（120ms、禁用缓存）：内容 659ms、角色 663ms、评价 650ms、返回首页 486ms。这组包含点击开销，未有本轮修改前同路径采样；角色／评价判定较早，不混入主对照表。

原始证据保存于 `overview-validation/`：`performance-before.json`、`performance-after.json`、`public-protection.json`、`deployed-read-only.json`。性能与线上脚本在 `/tmp/plotstay-menu-performance.mjs` 和 `/tmp/plotstay-overview-live.mjs`；查询计划诊断在 `/tmp/plotstay-overview-query-plans.json`。

### 已知边界

- 旧导入的 `author_id` 表示创建账号，不声称文学作者；没有可靠保存证据的旧代编不会凭管理权限被收录。
- 常用世界首版不跨设备同步；首次使用的浏览器没有记录时整栏隐藏。
- 没有新增未读模型或自动完成模型；事件列表只报告实际事件。统一业务摘要失败整体重试，常用世界独立恢复。
- 真实数据集未必包含示例稿中所有状态；丰富场景通过隔离交互稿与测试展示，不向开发库补造状态。
- 视觉基准已获确认；部署后的具体体验仍交用户验收。WS-08～13、完整世界目录、暂不回复／收起提醒、旧后台退役均未启动。

## 首个检查点历史记录

以下记录交互稿首次交付时的状态；其中“等待反馈／未接入”描述当时阶段，已由上面的用户确认及真实接入替代。

## 基线与范围

实际 HEAD：`574fda8`，已归档方案保留，运行时代码基线为 `8d66a07`。开工时唯一未跟踪文件为 `example_pages.zip`。不重置工作区、不自动提交／推送，不启动 WS-08～13。

本轮先核对了首页／bootstrap、内容和译文保存、角色归属与固定提交、评价与回复、共享设定、首页配置、实际权限及返回路径。映射、接口提案和测试矩阵见 [数据契约](overview-data-contract.md)。

## 可审阅产物

- [中文交互稿](https://plotstay.xingwu.dev/_design/overview/?lang=zh)
- [英文交互稿](https://plotstay.xingwu.dev/_design/overview/?lang=en)
- [字号与交互规格](https://plotstay.xingwu.dev/_design/overview/?lang=zh#spec)
- 截图位于 `overview-prototype/screenshots/`，已保存 20 张，含中英 1440px／390px、完整／普通作者／空／部分失败，以及协助页签。
- 四张主要截图：`zh-manager-1440.png`、`zh-manager-390.png`、`en-manager-1440.png`、`en-manager-390.png`。
- 源码：`overview-prototype/{index.html,style.css,app.js}`；浏览器复验：`node docs/workspace-handoff/overview-prototype/verify.mjs`；本机服务：`node docs/workspace-handoff/overview-prototype/serve.mjs`（默认 4398，仅 loopback）。

预览全部使用隔离示例数据，不访问任何业务 API。示例状态仅存独立 sessionStorage，工具栏可重置；当前业务数据库没有演示写入。普通作者场景仅展示已开放能力，未来项目编辑单独标为规划示例。

手机顺序：需要你处理 → 继续处理 → 常用世界（有记录才有）→ 快捷开始 → 最近进展。桌面保持主辅双栏。继承现有浅灰绿底、米白面板、深绿顶部和 Lime 导航；不引用外部字体或运行时依赖。Asana／Strapi／Confluence 的借鉴点沿用已归档官方调研，本轮未重新声称登录实测这些产品。

## 待用户集中确认

1. 字号、间距、密度、动作尺寸、手机顺序与交互是否作为实现基准。
2. 两页签始终显示，默认“我的创作”，返回保留选择；共享世界配置和本人实际保存的代编放“我协助编辑的”。“我的创作”采用账号拥有／本人创建依据，不能把管理员创建或导入的 author_id 宣称为文学作者。
3. 常用世界首版按账号＋浏览器存储，固定稳定、最近访问补到 4 项，每次展示重新校验权限；不跨设备同步。

这些问题来自本次用户明确指定的视觉检查点及未定范围，不重复申请实现或发布权限。收到反馈前继续来源契约、隔离测试和性能基线准备；不将预览当作最终上线。

## 验证结果与已确认技术事实

- 独立 Chromium 检查：28 种语言／场景／尺寸组合无文档横向溢出；7 组交互检查通过，20 张截图。覆盖页签键盘、对象定位、返回焦点、未保存保护、阅读不完成任务、回复草稿／提交转栏、范围一致的查看全部、独立失败重试、固定入口、普通作者能力及规划标记。无浏览器异常、业务接口或外网请求。结果见 `overview-prototype/verification.json`。
- 新增 `tests/overview-sources.test.ts`：在随机 schema 验证创建者、当前版保存者、人工译文保存者、审核者的区别；确认公开版和新稿可并存，旧版代编证据不能扩散到新版本；确认角色所有者、管理员代编、固定提交与新稿分别记录。它是来源准备测试，**不是新聚合 API 的验收**。
- 首轮来源测试发现断言误用了 `myPersonas.submitted_decision` 读取已完成审核：真实实现会清空提交指针。已改为查不可变决定历史，并补入数据契约；未修改生产逻辑。
- TypeScript 检查用于验证新增测试文件。完整应用测试／构建／真实接口测试安排在视觉确认后的真实接入阶段，本检查点不引用以前通过数量作为本轮结果。

## 本轮性能基线

通过同一已部署服务的 loopback 入口，现有应用账号登录后只读浏览业务数据；未修改内容。Chromium 1440×900、禁用缓存、20Mbps 下行／10Mbps 上行，CDP 网络延迟分别为 0 与 120ms。复用前轮脚本，角色／评价完成条件较早，因此不把这两项作为关键对比。

| 页面 | 0ms 条件可用时间 | 120ms 条件可用时间 | API 请求数 |
| --- | ---: | ---: | ---: |
| 概览 | 238ms | 523ms | 9 |
| 我管理的内容 | 235ms | 552ms | 4 |
| 世界设定 | 366ms | 592ms | 6 |
| 管理工具 | 218ms | 523ms | 4 |

这是单次诊断基线，不是 P95 或公网性能承诺。原始结果 `/tmp/plotstay-menu-performance-overview-20261012-baseline.json`；脚本 `/tmp/plotstay-menu-performance.mjs`。后续真实接入应保持账号、数据量、网络条件和完成判定一致，另做侧栏真实点击比较。

## 预览发布与保护

按已有授权，Nginx 增加 `/_design/overview/` 静态 alias 指向独立交互稿目录。已安装配置，`nginx -t` 通过并平滑 reload。新 location 继承服务器级 Basic Auth、`X-Robots-Tag: noindex, nofollow, noarchive` 与 `Cache-Control: private, no-store`，无新增公开例外，禁止目录索引。

公网交互稿 HTML 和 JS 匿名均为 401，响应保护头齐全；公开 robots 仍为 `Disallow: /`；`plotstay-preview` 为 active。无 Nginx Basic Auth 明文凭据，因此没有声称通过公网认证后的浏览器检查；交互截图和功能检查使用同一目录的受控本机服务。用户可使用原开发站凭据打开远程预览。

**仅独立预览已更新；真实 `/zh/workspace`、`/en/workspace` 尚未替换，没有应用 build/restart。** 真实接入、完整验证与最终线上验收仍待视觉反馈后执行，届时沿用已有部署授权。无迁移，无现用数据库 seed/reset，无 commit/push。

`example_pages.zip` SHA-256 开工与检查点均为 `2338ebbf7ead485b3842e0d8eb3204da83dfd52c4eb8994c85c2daa232b72d26`。
