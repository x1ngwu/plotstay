# Plotstay 开发顺序、进度与交接

更新日期：2026 年 10 月 7 日。**阶段 1、2、2.5 已验收；阶段 3 S3-00 至 S3-05 功能测试通过，功能与布局获用户确认，中英文案已审定发布，当前视觉版本获用户认可并授权提交。** [视觉校准](phase-3-visual-alignment.md)严格使用原版 `digi-tech-lime-desktop`，排除 Colony 视觉；发现栏目尺寸与间距依据用户提供的 Airbnb 参考包。保留现有功能、模块顺序和插画，预览保持 `SITE_INDEXABLE=false`。后续视觉细节仍可按反馈迭代，不自动进入阶段 4。

最新反馈：用户提供 `example_pages.zip`，明确分类图标与整张封面卡片的大小及排布都应接近 Airbnb，并要求所有发现栏目标题横条复用顶部 `PLOTSTAY / 世界` 的 Lime 样式。此次按保存页面与截图调整共用 CSS，包括发现区响应式列数；模块顺序、功能及审定文案保持不变。参考包优先于之前未对准栏目类型的在线采样，详见[参考包校准](phase-3-visual-alignment.md#用户参考包校准2026-年-10-月-7-日)。

后续字体确认（2026 年 10 月 7 日）：在阶段 3 已提交版本 `daf5a98` 上，制作[三套像素字体对照](font-previews.md)后，用户选择**英文 C、中文默认 B，并保留中文 C**。已在统一布局接入语言默认字体，中文可从右上角菜单的“中文字体”切换 B / C，并记住浏览器偏好；列表、详情等页面沿用同一选择。`/font-preview` 保留全部方案用于回看。未推进阶段 4，也未修改内容数据。

加载优化（同日）：预览原本已是构建版，主要额外传输来自整包像素字体、后备字库与未压缩资源。现已完成无字形改动的字体分包、按语言预载、Brotli / gzip 和资源哈希缓存。模拟 1 Mbps / 150 ms 的冷访问中，中英首页传输量分别由约 655 / 720 KB 降至 109 / 106 KB，字体就绪由 5.86 / 6.41 秒降至 1.55 / 1.51 秒。26 项端到端测试与 54 个页面视口检查通过，已更新原 `4321 / 4310` 构建版预览；细节与证据见[字体加载优化](font-previews.md#加载优化2026-10-07)。

产品边界见[产品计划](plan.md)，技术选择见[架构方案](architecture.md)，确认经过见[决策记录](decisions.md)。本文记录当前实现和实际验证结果。

## 阶段状态

| 阶段 | 工作内容 | 当前进度 |
| --- | --- | --- |
| 0 方案记录 | 产品、架构、决策与原始讨论归档 | 已完成；方案 `af32393`、初次交接 `c3c4ce4` 已提交推送 |
| 1 基础工程与数据结构 | 工程、数据库、契约、双语 seed、权限与版本基础、API、Astro、语言与主题 | **已完成**；`531d90c` 已推送 `origin/main` |
| 2 内容管理与发布 | 管理页面与写 API、导入、审核、下架、回退、冲突、翻译适配器及 worker | **已完成并验收**；实现已提交 `f03cbef`，真实翻译供应商仍待配置 |
| 2.5 多语言 URL 与 SEO 规范修复（临时插入） | 语言与路径映射、旧链接兼容、canonical / hreflang、动态 sitemap、索引与回退规则 | **已完成并验收**；SEO-01 至 SEO-05 全部完成，详见[修复项目](i18n-seo-remediation.md) |
| 3 发现首页 | Lime 旅行平台首页、独立服务管理 / 基础详情、行程意向、现有账号入口、世界配置及完整列表分页 | **S3-00–S3-05 功能完成，功能及布局获确认；文案已审定发布，当前视觉版本获认可并授权提交**，见[阶段 3 方案](phase-3-discovery.md)和[视觉校准](phase-3-visual-alignment.md) |
| 4 住宿、活动与服务详情 | 图库、完整专有模块、人物、手记、关联内容 | 未交付；三类基础详情已完成，完整专有模块仍在阶段 4 |
| 5 模拟预订与凭条 | 游客身份、三类内容预订 / 预约、行程与价格快照、凭条、下载 | 未交付；原有领域函数与表结构仅为草稿，需随新增服务 / 行程完善并验收 |
| 6 正式内容与上线 | 素材、术语表、外部翻译联调、域名、备份、切换与回退 | 未开始，没有生产部署 |

## 工作区与实现边界

- 路径 `/data/apps/plotstay`，分支 `main`。阶段 1 为 `531d90c`，阶段 2 为 `f03cbef`；阶段 2.5 立项为 `ae00148`、实现为 `d705f6c`。SEO review 的空摘要修复为 `4ecf563`。本次从干净工作区 `cc98987` 开工，阶段 3 实现、视觉校准及本交接随本次提交交付；实际提交状态以 `git status` / `git log` 为准。用户提供的参考 ZIP 及本地验收产物不纳入 Git。
- `.env` 已由 setup 生成，重复 setup 保留它；凭据不写入文档或 Git。`.env.example` 只含占位值。
- 测试创建随机 `test_<uuid>` PostgreSQL schema，运行完整迁移和 seed，结束后清理。验收用的改名、下架等操作不改动开发 schema。
- 本机 PostgreSQL 继续使用 `127.0.0.1:55432` 与原有数据卷。阶段 3 已在原库应用 `005_discovery.sql`，未修改 `001`–`004`。最终构建版预览使用 `127.0.0.1:4321/4310`，显式关闭索引；仍是会话进程，没有配置开机自启。完整验收与原库摘要见下方「阶段 3 实际交付与验收」。

### 工程与依赖

| 项目 | 当前实现 |
| --- | --- |
| 运行时 | 实测 Node.js `22.22.3`；要求 `>=22.12.0` |
| Astro | `7.3.5`，`@astrojs/node 11.1.6`，`output: 'server'`，独立服务器模式 |
| API | Fastify `5.12.5`，TypeScript 入口，经 esbuild 生成 Node ESM 产物 |
| 类型检查 | TypeScript 固定 `6.0.3`，兼容 `@astrojs/check 0.9.10` 的 `^5 || ^6` peer；Node 类型固定 `22.20.5` |
| 数据层 | `pg 8.23.1`，PostgreSQL 18；SQL 迁移带 checksum、事务与 advisory lock |
| 安装复现 | 更新 lockfile，实际重新执行 `npm ci` 成功；安装时 npm audit 报告 0 漏洞 |
| worker | 已补齐 `apps/worker/src/main.ts`、构建及 dev/start 脚本；独立启动，供应商默认禁用 |

Astro 服务器模式与运行时环境加载依据 [Node adapter 官方文档](https://docs.astro.build/en/guides/integrations-guide/node/)。所选 adapter 的本地 peer 要求为 `astro ^7.2.1`，当前安装满足要求。

Astro 7 在代理环境中可能自动把 `astro dev` 转入后台。本项目使用 `astro dev --ignore-lock` 保持前台，由 `scripts/dev.mjs` 管理两个进程组；配置 `strictPort`，端口占用时失败而不是改用其他端口。统一启动与 SIGTERM 停止均纳入验收。

### 数据与版本

- 保留 `001_foundation.sql`：语言、用户与会话、fandom、世界与成员、地点、虚构身份、内容、版本、译文、发布快照、审核事件，以及后续导入、任务、预订所需的表。
- 新增 `002_history_guards.sql`：禁止改写内容稳定身份与世界归属、禁止删除版本正文，补齐恢复发布与预订记录的同一内容外键。原有译文和发布快照不可变约束继续生效。
- 阶段 2.5 新增 `004_locale_urls.sql`：`locales.path_prefix` / `language_tag` 分别保存公开路径和标准语言标记，中文映射为 `zh` / `zh-Hans`；`001`–`003` 未修改。已有 `code=zh-CN`、译文、任务和发布快照保留。
- 阶段 2 新增 `003_translation_execution.sql`：任务绑定供应商与生成配置，保存最大重试次数；内容增加 `draft_token`，即使源文版本号未改变，译文修改也会使旧编辑表单产生冲突。
- 公共查询从 `published_publication_id → publication_locales` 读取发布快照，不从编辑中的 `head_revision_id` 或 `revision_locales` 读取公开正文。
- 世界可见性、网站限制、条目下架及手记父条目的公开状态共同决定可见性。世界所有者、管理员、编辑者和网站管理员的权限分别检查；persona 不增加管理权限。
- 语言可用性来自 `locales` 表。缺少目标语言时只整条回退到该公开版本的源文，返回 `locale`、`requestedLocale`、`isFallback`。中英都是发布必需语言，缺译样本保持草稿。
- 布局在 `packages/themes/layout.css`，Lime 色彩与外观在 `lime.css`；世界携带 `themeId`。目前唯一实现的主题是 Lime，未知主题值使用 Lime。

### 可重复 seed

入口为 `scripts/seed.ts`，通过 `npm run db:seed` 执行。使用单事务和 advisory lock；按稳定 slug/ID 查找已有记录，重复或并发执行不新增版本、不重新发布、不覆盖编辑、不重置密码。手工双语示例只在创建时发布，保留 seed 审核记录。

| 世界 | 条目 | 状态 |
| --- | --- | --- |
| `lathe-worlds` / 拉斯世界 | `observation-room`、`shift-rest-cabin` | 两条中英已发布住宿 |
| 同上 | `forge-walk`、`signal-listening` | 两条中英已发布活动 |
| 同上 | `visitor-note`，关联 `observation-room` | 中英已发布虚构手记，显示旅客十七 |
| 同上 | `unpublished-room` | 双语草稿，公开接口与页面不可见 |
| 同上 | `missing-translation` | 缺中文的活动草稿；生成 pending 翻译任务，不能发布 |
| `test-harbour` / 测试港湾 | `harbour-room` | 第二世界的中英已发布住宿 |

基础 `db:seed` 保持 2 个可见世界、8 条内容，其中 6 条公开（包括手记）、2 条草稿。独立 `db:seed:discovery` 再追加 14 条双语内容与首页配置，当前开发库为 22 条内容、20 条公开（含 1 条手记）、2 条草稿。拉斯世界的完整列表为 18 条（8 住宿、8 活动、2 服务）；测试港湾仍有 1 条住宿。每个世界有独立地点与所有者，另有拉斯世界编辑者用于权限验证。管理员登录使用 `.env` 中的 `ADMIN_EMAIL` / `ADMIN_PASSWORD`；其他 fixture 用户密码随机生成，不提供共享演示登录口令。

示例名称、金额和手记均非正式内容。新增演示条目使用本仓库原创 SVG 插画；既有无图记录原样保留。第三语言 `de` 只在测试 schema 中动态加入，用于验证扩展与公开源文回退，不改变本机中英配置。

## 运行方式

以下地址反映阶段 3 的构建版预览。中文统一为 `/zh`，旧 `/zh-CN`、大小写和末尾斜线组合通过一次 308 跳转；API 内部键继续使用 `zh-CN`。

在仓库根目录执行。首次准备需要 Node.js、npm、Docker Compose，以及运行容器的权限：

```bash
npm ci
npm run setup
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:seed:discovery  # 可选：追加阶段 3 双语演示与首页配置
npm run dev
```

重复 setup / migrate / seed 不重置已有配置或数据。应用不会在启动时自动迁移或 seed。不要改写已应用的迁移文件，后续结构变化新增编号 SQL。

| 服务 | 默认位置 |
| --- | --- |
| Web 中文 | `http://localhost:4321/zh` |
| Web 英文 | `http://localhost:4321/en` |
| 第二世界 | `http://localhost:4321/en?world=test-harbour` |
| 住宿详情样例 | `http://localhost:4321/zh/worlds/lathe-worlds/stays/observation-room` |
| 活动详情样例 | `http://localhost:4321/en/worlds/lathe-worlds/experiences/forge-walk` |
| 完整列表 | `http://localhost:4321/zh?view=results` |
| 服务详情样例 | `http://localhost:4321/zh/worlds/lathe-worlds/services/augmetic-tune-up` |
| 帮助 / 创作说明 | `http://localhost:4321/zh/help`、`/zh/host` |
| 中文管理页 | `http://localhost:4321/zh/admin` |
| 英文管理页 | `http://localhost:4321/en/admin` |
| API 就绪检查 | `http://127.0.0.1:4310/api/health` |
| PostgreSQL | `127.0.0.1:55432`，数据库与用户均为 `plotstay` |

`npm run dev` 同时运行 API watch 和 Astro，Ctrl+C 一起停止。也可在两个终端分别运行 `npm run dev:api`、`npm run dev:web`。`npm run db:stop` 停止数据库并保留数据卷。

**通过 SSH 远程查看时使用 `npm run preview`。** 先停止 dev，再执行 `npm run build && npm run preview`，通过 SSH 将本机端口转发到服务器的 `127.0.0.1:4321`。dev 与 preview 共用 `scripts/serve.mjs` 管理进程，preview 以 `NODE_ENV=production` 运行已有构建产物，Ctrl+C 同时停止两端。代码修改需要重新构建并启动；数据库内容发布无需重建。

早期基础页面的历史对照：本机开发 HTML 响应约 20–60 ms，但浏览器另加载 20 个开发 JavaScript 资源，总传输约 1.78 MB；当时基础页面的构建版总传输约 4.1 KB，没有 JavaScript 请求，随后切换原端口到构建版预览。该数据不代表当前阶段 3 页面；当前像素字体加载量及慢网模拟见本文开头的加载优化记录。两轮检查均未测得用户机器到服务器的实际 SSH 网络耗时。

独立构建产物运行方式：

```bash
npm run build
# 终端一
NODE_ENV=production npm run start:api
# 终端二
NODE_ENV=production npm run start:web
```

API 产物为 `apps/api/dist/server.mjs`，Astro 产物为 `apps/web/dist/server/entry.mjs`，worker 为 `apps/worker/dist/main.mjs`。`start:web` 使用 `apps/web/server.mjs` 包装 Astro 的静态资源与 SSR handler，关闭 adapter 自动监听并添加 Brotli / gzip；不启动开发服务器或运行构建。start 脚本从根 `.env` 加载环境，外部已有环境变量优先。数据库和 seed 不依赖 dist。

关键配置为 `DATABASE_URL`、`API_HOST` / `API_PORT`、`API_INTERNAL_URL`、`HOST` / `PORT`、`WEB_ORIGIN`、`COOKIE_SECURE`、`SITE_URL`、`SITE_INDEXABLE`。Web 只通过 `API_INTERNAL_URL` 取数，不导入数据库包。浏览器读到完整 SSR HTML。

Astro 已提供同域 `/api` 转发，只向固定 `API_INTERNAL_URL` 转发 Cookie、Origin 和正文；不跟随上游重定向，限制请求为 2 MB。管理页通过这个入口访问独立 API，原 SSH 隧道只需转发 Web 端口。登录使用 HttpOnly Cookie；写请求必须携带与 `WEB_ORIGIN` **完全一致**的 `Origin`，默认 `http://localhost:4321`。使用 `127.0.0.1` 或其他本地转发端口时需对应修改配置并重启。生产 HTTPS 时设 `COOKIE_SECURE=true`。

### 索引配置与新增语言

`SITE_INDEXABLE` 默认 `false`，与 `NODE_ENV` 无关；当前预览继续关闭索引，即使使用构建产物也不输出 canonical / hreflang，`/sitemap.xml` 返回空 `urlset`。HTML 的 robots meta 与响应 `X-Robots-Tag` 都声明 `noindex, follow`，`/robots.txt` 允许抓取以读取该标记，不声明预览 sitemap。

正式启用索引需要同时设置 `SITE_INDEXABLE=true` 和 `SITE_URL=https://已确定的正式域名`。`SITE_URL` 必须为 HTTPS origin，不能带用户名、路径、query 或 fragment，也不能是 localhost / IP；错误配置使 Web 请求明确返回 503 并记录配置错误。SEO 地址只使用该配置，不读取 Host / 转发头。`WEB_ORIGIN` 仍单独负责管理写请求的 Origin 校验；通过 SSH 查看时保持实际浏览器 origin。站点配置在运行时读取，变更环境需要重启服务，不需为域名重新构建。

正式域名尚未选择。本次测试仅在随机 schema、随机端口的子进程中使用 `SITE_URL=https://plotstay-seo.invalid`、`SITE_INDEXABLE=true`；这是不可解析的隔离测试地址，没有改写本机预览配置，也没有进行生产部署或 Search Console 提交。日常运行不要复制测试开关到 dummy data 预览。

新增语言在 `locales` 配置 `code`、`path_prefix`、`language_tag`、`enabled`、`required_for_publish`；旧式 `INSERT(code,name)` 仍可用，默认路径为小写 code、标记为 code。特殊语言须显式配置，如未来繁体的 `zh-hant` / `zh-Hant`。公开路径和标记各有唯一性、格式约束。Web 从 `/api/locales` 实时读取，不复制页面模板；UI 字典仍需在 `lib/i18n.ts` 补全。UI 缺词典时显示英语并提示，正文标记实际语言，该页保持 noindex；启用语言并不自动表示有公开译文。繁体本次没有启用。

首页与完整列表分别输出 canonical；结果态保留 `view=results`，第 2 页起保留 `page`，第 1 页省略。默认世界、`type=all`、空搜索与跟踪参数去掉，非默认世界保留 `world`；详情 canonical 忽略行程 / 返回 query。语言导航保留浏览状态，有关键词时移除页码。非空搜索、类型 / 地点 / 类别筛选、携带行程的结果、管理、缺译与错误页没有 canonical / hreflang。详情依据当前发布快照与世界译文生成对应关系，首页还检查整个世界三类公开内容的语言完整性，并检查发现首页配置的实有语言。`x-default` 只指向同页可索引的英文版本。

## 已实现接口

返回 JSON；失败统一为 `{ error: { code, message, details? } }`。API 与动态 HTML 使用 `Cache-Control: no-store`。

| 方法与路径 | 用途与边界 |
| --- | --- |
| `GET /api/health` | 检查数据库及基础 schema；不可用时返回 503 |
| `GET /api/locales` | 启用语言及 `code` / `pathPrefix` / `languageTag` 映射 |
| `GET /api/discovery` | 当前公开世界、住宿 / 活动 / 服务稳定身份和实际公开语言集合；同一数据库快照、无默认 50 条截断 |
| Web `GET /sitemap.xml`、`GET /robots.txt` | 动态发现入口；sitemap 经 API 读取，与页面共用可索引与 URL 规则 |
| `GET /api/worlds?locale=en` | 公开世界，过滤隐藏和网站限制 |
| `GET /api/browse` | 共享世界查询：配置、稳定地点与分类、完整总数 / 24 条分页、发现栏目；全部读取同一 REPEATABLE READ 快照 |
| `GET /api/contents` | 默认住宿、活动与服务；支持 `locale`、`world`、`kind`、`q`、`parentId`、`limit`、`offset` |
| `GET /api/contents/:id?locale=zh-CN` | 单条已发布内容；草稿和不存在条目返回 404 |
| `GET /api/worlds/:world/:kind/:slug?locale=en` | 按世界和类型读取；kind 为 `stay / experience / service / review` |
| `POST /api/auth/login` | `{ email, password }`；HttpOnly、SameSite=Strict Cookie，登录限流 |
| `POST /api/auth/logout` | 撤销会话并清 Cookie |
| `GET /api/auth/me` | 当前账号；失效或过期会话返回 401 |
| `GET /api/admin/worlds` | 账号可管理的世界 |
| `GET /api/admin/worlds/:worldId/contents` | 授权世界的编辑列表，可见草稿 |
| `GET /api/admin/contents/:id` | 授权条目的版本、译文、发布、审核和任务记录 |

旧 `/api/contents` 保留默认 50 条、上限 100 的兼容行为；游客完整列表使用 `/api/browse`，固定每页 24 条、真实分页链接与总数。管理列表当前最多返回 200 条，暂不属于游客全量分页接口。请求参数使用 Zod 校验，无效 UUID、类型、页长等返回 400。预订写接口仍留到阶段 5。

### 阶段 2 新增接口与使用方式

| 方法与路径 | 用途 |
| --- | --- |
| `GET /api/admin/worlds/:worldId/options` | 授权世界的地点、父内容、可用 persona 与翻译配置状态 |
| `POST /api/admin/contents` | 创建住宿、活动、服务或手记草稿 |
| `POST /api/admin/contents/:id/revisions` | 携带 `baseRevisionId` 和 `baseDraftToken` 保存新版本，过期表单返回 409 |
| `POST /api/admin/contents/:id/submit` | 提交指定当前版本 |
| `POST /api/admin/contents/:id/review` | 世界管理员 publish / reject，审核备注留档 |
| `POST /api/admin/contents/:id/unpublish` | 普通下架；`siteBlock=true` 仅网站管理员可用 |
| `POST /api/admin/contents/:id/release-site-block` | 网站管理员解除限制，不自动重新发布 |
| `POST /api/admin/contents/:id/restore` | 指定历史 publication，形成新的恢复发布记录 |
| `PUT /api/admin/contents/:id/revisions/:revisionId/translations/:locale` | 修改可编辑草稿的译文，比较 `baseTranslationId` 防覆盖 |
| `POST /api/admin/imports/preview`、`/apply` | 同一校验逻辑；预览完整回滚，正式导入只生成草稿 |
| `GET /api/admin/worlds/:worldId/imports` | 最近 50 个批次及逐项结果 |
| `POST /api/admin/translation-jobs/:id/retry` | 有权限的编辑者重新排队失败或已过期的当前草稿任务 |

管理员使用本机 `.env` 中的账号密码登录。seed 重跑不会重置密码，单独修改环境文件中的密码也不会改变已存在账号。

管理页提供世界选择、内容列表、新建与固定字段编辑、逐语言文本、图片引用、金额/时长/评分、审核及发布、普通/网站下架、解除限制、历史全文载入与恢复发布、任务和审核记录。每次表单保存创建新草稿；冲突时保留表单输入，不自动覆盖或强制重载。源文修改后需检查译文；也可清空目标语言后保存，生成缺译任务。

批量导入可选择 JSON 文件或粘贴内容，点击“填入示例”会生成当前世界的示例。必须先预览才可从页面执行导入；输入改变后需重新预览。每批最多 100 项、2 MB。逐项字段/关系错误会出现在结果中；有效项仍可导入；相同来源与外部编号的并发导入只创建一次，输入改变会报告 conflict，不改写既有作品。

### 翻译任务与 worker

任务固定关联源版本、源/目标语言、术语表版本、供应商标识与生成配置。执行器使用事务、`SKIP LOCKED`、60 秒租约、30 秒调用超时，失败后指数退避，默认最多 3 次尝试；进程中断后其他 worker 可回收过期租约。人工重试检查世界权限和当前草稿状态，并写审核记录。

执行前后都检查源版本仍是当前可编辑草稿；写回前再次检查租约令牌及是否已经有译文。过期源版本、审核中的版本、人工校订、旧租约的晚到结果都不能改写内容。机器译文只写草稿，仍须经管理员审核才能公开。错误记录不保存供应商原始响应或密钥。

`TRANSLATION_PROVIDER=disabled` 时不领取任务、不扣重试次数；新任务持久保存。可执行 `npm run dev:worker` 或构建后的 `npm run start:worker`。一次性检查为 `node --env-file=.env apps/worker/dist/main.mjs --once`，本次已实测正常退出并保留 pending 任务。preview 不自动启动 worker。

目前只开放禁用配置，未实现真实供应商适配器；设置其他 provider 会明确报错，避免误以为服务已接通。测试通过注入确定性的内存适配器验证执行逻辑，没有把伪翻译作为正式内容。真实供应商、密钥、费用、术语表和任务切换方案待用户配置后再接入。

Web 路由中的 locale 是公开前缀（`en` / `zh`），路径为 `/{locale}` 和 `/{locale}/worlds/{world}/stays|experiences|services/{slug}`。根路径 302 到 `/en` 并保留查询参数。语言切换保留路径和查询参数；无效语言、世界、类型、草稿、不存在条目返回 404；API 不可用返回本地化 503 页面。UI 有中英字典，新语言可以使用英文 UI 后备文案，正式增加语言时需补字典。

## 实际验收结果

以下保留阶段 1–2.5 历史验收记录，不作为阶段 3 的本次测试结果。阶段 3 的命令与结果另见下方专节：

| 检查 | 结果 |
| --- | --- |
| `npm ci` | 按 lockfile 重装成功；npm audit 当时报告 0 漏洞 |
| `npm run setup` | 已有 `.env` 保留，凭据被 Git 忽略 |
| migrate + seed 连续两遍 | 均正常；seed 无重复内容，并发与编辑后重跑另有测试覆盖 |
| 类型检查与构建 | TypeScript 与 `astro check` 通过，0 错误 / 0 警告；独立 API 与 Astro 产物构建成功 |
| `npm test` | 基础、管理 HTTP、翻译执行与旧 schema 升级 4 组套件；Node runner 合计 **23 tests 全部通过** |
| `npm run test:e2e` | 检查、构建、开发生命周期、SEO 与 SSR / Chromium 回归通过；Node runner 合计 **17 tests 全部通过** |
| 浏览器 | Chromium 桌面 1280×800、移动端 390×844；直达、刷新、语言切换及查询保留通过，无脚本错误或横向溢出 |

验收覆盖：

1. **迁移与 seed**：全新 schema 建表、重复迁移、checksum 防篡改、并发 seed 不增版本、密码保留、编辑和回退后 seed 不覆盖。
2. **权限**：草稿 404，匿名管理读取 401，跨世界读取/写入被拒；地点和手记父条目的世界校验；编辑者不能审核；世界所有者权限有效。
3. **版本与语言**：并发编辑一个成功、一个冲突；新草稿不改公开正文；已提交译文不能偷改；缺必需译文不能发布；正文及历史不可改写；回退保留历史。第三语言只回退公开源文，不泄露草稿译文。
4. **限制与下架**：隐藏/限制世界、下架条目立即影响查询；父条目不可见时手记也不可见；世界管理员不能通过恢复发布绕过网站限制。
5. **无需全站构建**：已运行的构建产物在保存草稿后仍显示旧值，审核发布后读取新值；构建后新增条目可直接访问；新语言无需复制模板；下架立即 404。全程 Web dist 的 SHA-256 聚合哈希不变，API/Web 未重启。
6. **故障与启动**：API 停止后 Astro 返回本地化 503；开发 supervisor 启动两端，SIGTERM 后释放两个端口，未残留后台服务。
7. **阶段 2 浏览器全流程**：同域 Cookie 登录、创建双语草稿、审核发布、双窗口编辑冲突后保留输入、下架、历史恢复、JSON 导入预览和执行、退出后的会话撤销都实际通过。原有公开页面与语言路由测试继续通过。
8. **阶段 2 后端边界**：新增管理角色校验、译文变更使旧源文表单冲突、导入预览无残留、逐项错误和并发幂等、失败重试/超时/非法译文、任务抢占与租约恢复、晚到结果不能覆盖新版本/人工译文/已提交版本。

### 阶段 2.5 的实际验证证据

- **开发库升级**：原先只有 `001`–`003`，已增量执行 `004`；migrate + seed 连续执行两遍。8 条内容、8 个版本、15 条译文、6 次发布、12 条发布语言快照、1 个翻译任务、14 条审核事件、4 个用户、2 个世界保持原值。内容、历史、账号等 11 张表逐行规范化后 SHA-256 前后均为 `b89e081626c9ba615ce6575957afca307f9b0d1b9bdd3b57ba7ad8047f94a578`。没有重置数据库。测试还独立构造了有数据的 `001`–`003` schema 验证升级，以及全新 schema 安装。
- **路由**：GET / HEAD 覆盖旧前缀多种大小写、首页 / 管理 / 两类详情与末尾斜线组合，Location 一次达到 200 规范页；保留查询与 slug 的原始大小写。未知语言 / 世界 / 类型、草稿与下架均真实 404，API 和 POST 没有被重定向。
- **SSR / SEO**：初始 sitemap 的 14 个 URL 逐一核对唯一绝对 canonical、标题 / 描述、标准语言标记、双向 hreflang 和英文 x-default；另验默认 / 非默认世界、搜索 / 类型 / 跟踪参数、没有英文时省略 x-default。伪造 Host / X-Forwarded-* 未改变受信域名；错误索引配置返回 503。
- **回退**：第三语言 `de` 实时启用，未审译文不可见；发布德文后正文 `lang=de`、英语后备界面 `lang=en`，有提示且 noindex。单语发布只在隔离测试中放宽发布要求，验证中文源文回退、草稿译文、公开译文增加、恢复旧语言集合、语言禁用 / 恢复及世界缺译。开发库仍要求中英齐全。
- **动态 sitemap**：Chromium DOMParser 验证 XML namespace、无解析错误、无重复 URL；额外发布 55 条双语内容，新增 **110 个详情 URL**，普通列表仍为 50 条，sitemap 全量覆盖。全部 sitemap URL 返回 200 且 canonical 相同。草稿、下架、网站限制、隐藏世界、管理、手记独立地址、禁用语言与回退均排除。
- **运行中生效**：发布、下架、历史恢复、启停语言及世界限制改变后，HTML 与 sitemap 下次请求即更新；Web dist 的聚合 SHA-256 始终为 `354dbb67aa30b5c620c6866db0ecb6f87bfd75af06e78a55c94fdaab1cc0a7f0`，API / Web 没有重启。停止隔离 API 后，中文首页 / 详情 / 管理及 sitemap 返回 503。
- **浏览器与环境**：Chromium 桌面 / 移动端及完整管理操作回归通过。首次 e2e 被沙箱 socket 权限拦截，获准在沙箱外执行后通过；所有测试使用随机 schema 并清理，浏览器与服务进程退出。远程查看仍使用 `npm run preview` 的构建产物。

### SEO review 后续修复与复验

2026 年 10 月 6 日，按用户确认将列表超过 50 条后的分页与内部入口问题纳入阶段 3 必做清单，并修复详情页空摘要时的搜索描述。住宿和活动均优先使用当前公开版本的人工摘要；缺省时从实际展示语言的正文提取片段，归一空白并限制自动片段长度，人工摘要保持优先。

类型检查和构建通过；在同一构建产物上重跑 `tests/ssr.test.ts`、`tests/seo.test.ts`、`tests/dev.test.ts`，合计 **18 tests 全部通过**。新增 SSR 验证覆盖中英、两类详情、空 / 缺省 / 空白摘要、长正文与 Unicode、人工摘要优先，以及草稿摘要仅在发布后生效。测试同时将德语 URL 排除断言改为匹配完整 `/de` 语言段，避免把 `description-…` 条目误判为德语页面。测试使用独立 schema 与端口，未改开发内容数据。

修复及测试已保存为 `4ecf563`。阶段 3 方案定稿过程中只变更文档，没有修改这次已验收的代码；文档提交前另外检查 Markdown 内部链接、锚点与 `git diff --check`。本轮未重新运行应用测试，也未重启预览或进行生产部署。

复验命令：

```bash
npm test
npx playwright install chromium --only-shell
npm run test:e2e
```

测试需要数据库连接、创建 schema 的权限及本机端口。阶段 1 首次浏览器测试发现旧缓存与 Playwright `1.63.0` 不匹配，已安装对应 Chromium headless shell `1243` 并重跑通过。截图在 Git 忽略的 `test-results/foundation-mobile.png`。测试不会自动下载浏览器，换环境需执行安装命令。

## 阶段 3 实际交付与验收

本次从干净的 `main @ cc98987` 开始，先形成桌面 / 手机可运行初稿并用 Chromium 截图，再接入完整功能。视觉使用原创故障导航箭头、灰黑 / 薄荷绿窗框、世界背景 SVG、横向发现卡片；最终文案及正式素材仍待内容阶段审定。没有调用真实翻译服务，也没有生产发布。

| 工作包 | 已交付 |
| --- | --- |
| S3-00 | 1440px 桌面与 390px 手机初稿及预览迭代，补验 768px 平板；图稿 / 文案是可替换演示版 |
| S3-01 | `005_discovery.sql`；独立 service 与 `session` 报价、可翻译 tags、分类、稳定 placeId / placeSlug、完整总数与分页；首页配置草稿 / 不可变发布快照；旧发布与旧导入兼容 |
| S3-02 | 共享 browse 契约；发现 / results / page 身份、语言切换、分页 canonical / hreflang、全量 sitemap、404 / 503 / 合法空结果 |
| S3-03 | 顶栏、单首发世界入口、现有账号入口、权限菜单、受保护退出、帮助 / 创作说明；四类型 GET 搜索及按类型字段、行程校验 / 保留 |
| S3-04 | 已发布世界背景 / 促销 / 类别 / 栏目 / 推荐 / 三项卖点；自动地点排、共享三类卡片、缺图与加载失败占位；所有发现入口可用 |
| S3-05 | 24 条 SSR 分页、详情往返、无脚本全量遍历、键盘 / 手机、服务管理链路、发布实时生效及原有回归 |

### 数据保留与复现

先在原开发库执行 `005` 与基础 migrate / seed 连续两遍，再追加演示数据。升级前后 11 张既有业务表规范化 SHA-256 完全一致：

`b89e081626c9ba615ce6575957afca307f9b0d1b9bdd3b57ba7ad8047f94a578`

当时仍为 8 内容、8 版本、15 译文、6 发布、12 发布语言快照、1 翻译任务、14 审核事件、4 用户、2 世界和 0 预订。审计输出在 Git 忽略的 `test-results/s3-upgrade.json`。随后 `db:seed:discovery` 只追加 6 住宿、6 活动、2 服务、2 地点和 1 份已审核双语首页配置；不重新发布旧内容，不修改旧密码。

`seedDiscovery` 使用 advisory lock 与稳定 slug；已有配置、编辑及下架状态均保留。重复 seed 有回归断言。原导入没有 tags 的空字段情况接受历史哈希，新增非空标签仍报告 conflict，不覆盖旧作品。

### URL、查询和配置

- `/{locale}` 为发现首页；`?view=results` 为完整列表；`page=1` 在生成链接和 canonical 中省略，后续页保留。旧 `type/q` 搜索地址继续进入结果态。未知跟踪参数不影响查询或 SEO；重复的已知状态键与非法值拒绝。
- 筛选为 `world/type/place/category/q`；行程为 `start/end/guests/rooms/quantity/time`。日期采用有效 ISO 公历日期，结束晚于开始，人数 1–99、房间 1–20、服务数量 1–99，时段 morning / afternoon / evening。未选保持空值。行程不参与匹配或余量筛选。
- 一致快照内先对完整匹配集合分页，再在页面按稳定地点 ID 分组。排序为地点 ID（无地点最后）、公开时间降序、内容 ID；语言不改变无关键词集合与排序。关键词搜索实际展示语言的名称、摘要、正文、地点和标签。
- `from=home|results` 与白名单查询状态携带详情返回信息，没有任意 return URL。返回状态固定详情世界，串世界状态回到该世界首页。有关键词时语言切换回第一页，其余状态保留。
- 推荐按配置 ID 优先，并从当前公开内容补位；无效推荐、草稿和下架不可出现在卡片里。自动地点排默认最多 3 排。完整世界列表入口覆盖未进入推荐或无地点的条目。
- 首页配置保存在 `world_home_revisions` / `world_home_publications` / `world_home_settings`。源文和中英 hero、促销、类别名、栏目模板、三项卖点与站内目标统一校验；时间带 offset，展示采用 UTC，过期或关闭促销隐藏。所有前台读取只使用 published 指针，草稿不可见。
- 受控配置维护可调用领域 `saveHomeDraft` / `publishHome` 或 `PUT /api/admin/worlds/:worldId/home`（`body`、`baseRevisionId`）与 `POST .../home/publish`（`revisionId`）；要求世界 owner/admin 或网站管理员，版本冲突和发布所需语言会阻止写入。初始配置可参考 `scripts/seed-discovery.ts`。可视化世界编辑器仍在后续阶段，因此菜单没有虚构的“管理世界”目标。
- `db:seed` 为原基础 seed；`db:seed:discovery` 为可选追加演示。缺首页配置的第二世界使用通用布局和自身内容，不复用拉斯背景或促销。

### 本次执行结果

| 检查 | 结果 |
| --- | --- |
| 原库增量迁移与基础 seed ×2 | 原 11 表 SHA-256 不变；旧内容 / 发布 / 账号 / 任务保留 |
| `npm test` | **31 tests 全部通过**；包括新增发现 / 服务 / 旧导入兼容测试 |
| `npm run test:e2e` | **25 tests 全部通过**；包含类型检查、构建、开发生命周期、SSR、SEO、Chromium 与阶段 3 专项 |
| `astro check` | 0 errors / 0 warnings / 0 hints |
| `git diff --check` | 通过 |
| 响应式 | Chromium 1440 / 768 / 390px，中英均无整页横向溢出；菜单 Escape 返回焦点、卡片键盘与滚动、图片失败回退通过 |

分页专项在随机 schema 中追加 **55 条双语住宿 / 活动**；加上演示库原有 18 条公开旅行内容，共 **73 条，含 2 条服务**。禁用 JavaScript 后从首页“浏览全部”点击完整列表与真实下一页链接，得到 73 个不重复 ID，所有详情返回 200。覆盖同一地点跨页、同名地点、无地点、第二世界、筛选组合、合法空结果与越界页。

隔离索引配置使用 `https://plotstay-phase3.invalid`。首页与列表分别自引用；第 2 页 canonical / hreflang 保留结果态与页码，中英页内容集合一致，sitemap 包括所有分页和三类详情。关键词 / 类型 / 地点 / 类别 / 行程页 noindex 且不输出 canonical / hreflang。旧阶段的可信 origin、404 / 503、缺译、旧链接、XML、摘要回退与动态发布验收同时通过。

浏览器验证日期 / 人数 / 房间数随翻页、语言、详情和返回保留；关键词切换语言重置页码，服务数量 / 时段显示正确。无脚本选择字段和 GET 搜索、分类 / 查看全部、语言与详情入口可用。现有账号完成服务新建、双语标签 / 提供者 / 分类编辑、审核发布与搜索；匿名 / 无世界权限 / 有管理权限菜单和退出正确。原有编辑冲突、导入与恢复发布浏览器流程也通过。

服务的世界权限、价格单位、手记父关联、草稿隔离、翻译任务、导入、审核、下架与历史恢复有后端断言。首页配置的草稿隔离、角色权限、缺必需译文、冲突及不可变历史也有断言。运行中的发布 / 下架 / 恢复改变列表总数、页数、首页和 sitemap；Web dist 哈希保持不变，未重启服务。

### 最终预览与截图

```bash
npm run db:migrate
npm run db:seed:discovery
npm run build
SITE_INDEXABLE=false npm run preview
```

当前 Web `http://localhost:4321/zh`、`/en`，完整列表 `http://localhost:4321/zh?view=results`，服务 `http://localhost:4321/zh/worlds/lathe-worlds/services/augmetic-tune-up`，管理 `/zh/admin`。SSH 只需转发 Web 的 4321 端口；管理写请求的浏览器 origin 必须与 `.env` 中 `WEB_ORIGIN` 一致（默认 `http://localhost:4321`）。

预览显式 `SITE_INDEXABLE=false`，HTML / 响应头 noindex、无 canonical / hreflang，sitemap 空集合，robots 允许抓取。管理员凭据沿用 `.env`，不写入截图或文档。截图在 `test-results/s3-draft-desktop.png`、`s3-draft-mobile.png` 与 `s3-*-1440.png` / `768.png` / `390.png`；它们是本地验收产物，Git 忽略。最终演示截图另存 `s3-preview-desktop.png` / `s3-preview-mobile.png`。

## 剩余问题与下一步

### 本轮视觉校准结果

已严格以原版 `digi-tech-lime-desktop` 落实字体、点阵品牌、窗框、纹理和控件；所有发现栏目共用顶部窗口标题栏，分类缩略图、封面和间距按用户提供的 Airbnb 参考包校准。现有功能、模块顺序与插画保留。首页中英文案按用户审定稿，以新配置版本发布，旧版本和商品内容历史一致。31 项后端测试已通过；最终样式构建后的 25 项浏览器 / SEO 回归全部通过，1440 / 768 / 390 / 320px 中英检查无横向溢出。原 4321 端口已更新，显式 `SITE_INDEXABLE=false`。完整证据、截图、资源来源与用户认可记录见[视觉校准记录](phase-3-visual-alignment.md#用户参考包校准2026-年-10-月-7-日)。

阶段 3 已完成本轮样式校准与中英文案发布，用户认可当前版本并要求 commit & push。后续视觉细节仍可按反馈迭代，未进入阶段 4。后续阶段边界保留：

- 阶段 4：三类完整详情、图库、专有模块、人物及关联内容。
- 阶段 5：细化三类日期 / 数量计价，模拟预订、预约、长期记录和凭条；当前只有行程意向，未实现库存、积分、会员或优惠结算。
- 阶段 6：正式素材 / 术语 / 世界文案、真实翻译供应商、域名与生产部署、备份恢复和运维。
- 世界 / 地点 / persona 的完整编辑器、公开注册 / 房东申请仍未开放。当前世界配置由受控 seed / API 维护。
- 旧兼容组合 `/ZH-CN//` 的框架重定向链仍是已知低优先级历史问题；标准旧前缀与末尾单斜线组合一次 308，本阶段未扩展重复分隔符规则。
- 管理列表当前仍最多 200 条；公开完整列表已经分页。sitemap 为动态单文件，达到协议容量前需拆分；当前没有生产规模性能验证。

## 新 session 开发入口

先核对工作区与提交，必须阅读本文件、阶段 3 方案、[视觉校准记录](phase-3-visual-alignment.md)、计划、架构与 SEO 规范，再开发。阶段 3 视觉已获用户认可；后续字体与速度优化的实际提交状态以 Git 为准，下一步按用户新指示推进，不自动进入阶段 4。后续样式调整保持业务功能，不确定先问。美术依据为原版 `digi-tech-lime-desktop`，品牌字标保留 Chicago 点阵镂空；字体遵循后续确认的英文 C / 中文默认 B、可选 C。插画保留，分类、封面和间距参照用户提供的 Airbnb 存档。预览是会话进程，重新核实监听状态；不要重置数据或改写 `001`–`005`。本轮首页文案已获审定并以新版本发布；后续文字仍须遵循文档并单独审定，不能把其他演示稿当作定稿。
