# Plotstay 开发顺序、进度与交接

更新日期：2026 年 10 月 6 日。**阶段 1 已提交推送，阶段 2 的内容管理与发布已完成验收；阶段 2.5「多语言 URL 与 SEO 规范修复」已实现并通过全部本地验收。阶段 3 首页结构及 Q1–Q3 已定稿：独立 Services、保存行程意向、现有账号登录管理，可在新 session 开工。** 使用手工中英 dummy data。游客页面仍是基础浏览与路由验证页面，阶段 3 首页功能尚未交付。

产品边界见[产品计划](plan.md)，技术选择见[架构方案](architecture.md)，确认经过见[决策记录](decisions.md)。本文记录当前实现和实际验证结果。

## 阶段状态

| 阶段 | 工作内容 | 当前进度 |
| --- | --- | --- |
| 0 方案记录 | 产品、架构、决策与原始讨论归档 | 已完成；方案 `af32393`、初次交接 `c3c4ce4` 已提交推送 |
| 1 基础工程与数据结构 | 工程、数据库、契约、双语 seed、权限与版本基础、API、Astro、语言与主题 | **已完成**；`531d90c` 已推送 `origin/main` |
| 2 内容管理与发布 | 管理页面与写 API、导入、审核、下架、回退、冲突、翻译适配器及 worker | **已完成并验收**；实现已提交 `f03cbef`，真实翻译供应商仍待配置 |
| 2.5 多语言 URL 与 SEO 规范修复（临时插入） | 语言与路径映射、旧链接兼容、canonical / hreflang、动态 sitemap、索引与回退规则 | **已完成并验收**；SEO-01 至 SEO-05 全部完成，详见[修复项目](i18n-seo-remediation.md) |
| 3 发现首页 | Lime 旅行平台首页、独立服务管理 / 基础详情、行程意向、现有账号入口、世界配置及完整列表分页 | **结构和 Q1–Q3 已确认、详细记录完成，尚未开发**；见[阶段 3 方案](phase-3-discovery.md)，包含 SEO review 的分页与内部链接整改 |
| 4 住宿、活动与服务详情 | 图库、完整专有模块、人物、手记、关联内容 | 未交付；目前只有住宿 / 活动简版详情，服务基础详情纳入阶段 3 |
| 5 模拟预订与凭条 | 游客身份、三类内容预订 / 预约、行程与价格快照、凭条、下载 | 未交付；原有领域函数与表结构仅为草稿，需随新增服务 / 行程完善并验收 |
| 6 正式内容与上线 | 素材、术语表、外部翻译联调、域名、备份、切换与回退 | 未开始，没有生产部署 |

## 工作区与实现边界

- 路径 `/data/apps/plotstay`，分支 `main`。阶段 1 为 `531d90c`，阶段 2 为 `f03cbef`；阶段 2.5 立项为 `ae00148`、实现为 `d705f6c`。SEO review 的空摘要描述修复与回归测试另行提交为 `4ecf563`。阶段 3 定稿及新 session 开发入口作为随后独立的文档提交，实际提交记录以 `git log` 为准。
- `.env` 已由 setup 生成，重复 setup 保留它；凭据不写入文档或 Git。`.env.example` 只含占位值。
- 测试创建随机 `test_<uuid>` PostgreSQL schema，运行完整迁移和 seed，结束后清理。验收用的改名、下架等操作不改动开发 schema。
- 本机 PostgreSQL 容器 `plotstay-postgres-1` 健康，映射 `127.0.0.1:55432 → 5432`，数据在独立 Docker volume。验收进程已退出；随后为用户远程查看启动了构建版预览，Web/API 监听 `127.0.0.1:4321/4310`。本次已在原端口重启为新构建，显式使用 `SITE_INDEXABLE=false`，实测 `/zh`、`/en`、中文管理及两类详情 200，旧中文组合地址一次 308，sitemap 空集合、robots 可抓取，均带 noindex；API 健康检查正常。这是当前会话中的预览进程，尚未配置开机自启。

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

默认开发数据共 2 个可见世界、8 条内容，其中 6 条公开（包括手记）、2 条草稿。每个世界有独立地点与所有者，另有拉斯世界编辑者用于权限验证。管理员登录使用 `.env` 中的 `ADMIN_EMAIL` / `ADMIN_PASSWORD`；其他 fixture 用户密码随机生成，不提供共享演示登录口令。

示例名称、金额和手记均非正式内容，图片数组暂为空。第三语言 `de` 只在测试 schema 中动态加入，用于验证扩展与公开源文回退，不改变本机中英配置。

## 运行方式

以下地址反映阶段 2.5 的构建版预览。中文统一为 `/zh`，旧 `/zh-CN`、大小写和末尾斜线组合通过一次 308 跳转；API 内部键继续使用 `zh-CN`。

在仓库根目录执行。首次准备需要 Node.js、npm、Docker Compose，以及运行容器的权限：

```bash
npm ci
npm run setup
npm run db:up
npm run db:migrate
npm run db:seed
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
| 中文管理页 | `http://localhost:4321/zh/admin` |
| 英文管理页 | `http://localhost:4321/en/admin` |
| API 就绪检查 | `http://127.0.0.1:4310/api/health` |
| PostgreSQL | `127.0.0.1:55432`，数据库与用户均为 `plotstay` |

`npm run dev` 同时运行 API watch 和 Astro，Ctrl+C 一起停止。也可在两个终端分别运行 `npm run dev:api`、`npm run dev:web`。`npm run db:stop` 停止数据库并保留数据卷。

**通过 SSH 远程查看时使用 `npm run preview`。** 先停止 dev，再执行 `npm run build && npm run preview`，通过 SSH 将本机端口转发到服务器的 `127.0.0.1:4321`。dev 与 preview 共用 `scripts/serve.mjs` 管理进程，preview 以 `NODE_ENV=production` 运行已有构建产物，Ctrl+C 同时停止两端。代码修改需要重新构建并启动；数据库内容发布无需重建。

用户反馈远程打开慢后进行了对照检查：本机开发页面 HTML 响应约 20–60 ms，但浏览器另加载 20 个开发 JavaScript 资源，总传输约 1.78 MB；同一基础页面的构建版总传输约 4.1 KB，没有 JavaScript 请求。已切换原端口到构建版预览并验证。该测量来自服务器本机浏览器，未测得用户机器到服务器的实际 SSH 网络耗时；切换消除了开发工具的额外传输，不能据此断言所有远端延迟都已解决。

独立构建产物运行方式：

```bash
npm run build
# 终端一
NODE_ENV=production npm run start:api
# 终端二
NODE_ENV=production npm run start:web
```

API 产物为 `apps/api/dist/server.mjs`，Astro 产物为 `apps/web/dist/server/entry.mjs`，worker 为 `apps/worker/dist/main.mjs`。start 脚本从根 `.env` 加载环境，外部已有环境变量优先。数据库和 seed 不依赖 dist。

关键配置为 `DATABASE_URL`、`API_HOST` / `API_PORT`、`API_INTERNAL_URL`、`HOST` / `PORT`、`WEB_ORIGIN`、`COOKIE_SECURE`、`SITE_URL`、`SITE_INDEXABLE`。Web 只通过 `API_INTERNAL_URL` 取数，不导入数据库包。浏览器读到完整 SSR HTML。

Astro 已提供同域 `/api` 转发，只向固定 `API_INTERNAL_URL` 转发 Cookie、Origin 和正文；不跟随上游重定向，限制请求为 2 MB。管理页通过这个入口访问独立 API，原 SSH 隧道只需转发 Web 端口。登录使用 HttpOnly Cookie；写请求必须携带与 `WEB_ORIGIN` **完全一致**的 `Origin`，默认 `http://localhost:4321`。使用 `127.0.0.1` 或其他本地转发端口时需对应修改配置并重启。生产 HTTPS 时设 `COOKIE_SECURE=true`。

### 索引配置与新增语言

`SITE_INDEXABLE` 默认 `false`，与 `NODE_ENV` 无关；当前预览继续关闭索引，即使使用构建产物也不输出 canonical / hreflang，`/sitemap.xml` 返回空 `urlset`。HTML 的 robots meta 与响应 `X-Robots-Tag` 都声明 `noindex, follow`，`/robots.txt` 允许抓取以读取该标记，不声明预览 sitemap。

正式启用索引需要同时设置 `SITE_INDEXABLE=true` 和 `SITE_URL=https://已确定的正式域名`。`SITE_URL` 必须为 HTTPS origin，不能带用户名、路径、query 或 fragment，也不能是 localhost / IP；错误配置使 Web 请求明确返回 503 并记录配置错误。SEO 地址只使用该配置，不读取 Host / 转发头。`WEB_ORIGIN` 仍单独负责管理写请求的 Origin 校验；通过 SSH 查看时保持实际浏览器 origin。站点配置在运行时读取，变更环境需要重启服务，不需为域名重新构建。

正式域名尚未选择。本次测试仅在随机 schema、随机端口的子进程中使用 `SITE_URL=https://plotstay-seo.invalid`、`SITE_INDEXABLE=true`；这是不可解析的隔离测试地址，没有改写本机预览配置，也没有进行生产部署或 Search Console 提交。日常运行不要复制测试开关到 dummy data 预览。

新增语言在 `locales` 配置 `code`、`path_prefix`、`language_tag`、`enabled`、`required_for_publish`；旧式 `INSERT(code,name)` 仍可用，默认路径为小写 code、标记为 code。特殊语言须显式配置，如未来繁体的 `zh-hant` / `zh-Hant`。公开路径和标记各有唯一性、格式约束。Web 从 `/api/locales` 实时读取，不复制页面模板；UI 字典仍需在 `lib/i18n.ts` 补全。UI 缺词典时显示英语并提示，正文标记实际语言，该页保持 noindex；启用语言并不自动表示有公开译文。繁体本次没有启用。

首页 canonical 去掉默认世界、`type=all`、空搜索和跟踪参数，非默认世界保留 `world`；详情 canonical 忽略不影响正文的 query。语言导航保留浏览路径和 query。非空搜索、类型筛选、管理、缺译与错误页没有 canonical / hreflang。详情依据当前发布快照与世界译文生成对应关系，首页还检查整个世界的公开住宿 / 活动语言完整性。`x-default` 只指向同页可索引的英文版本。

## 已实现接口

返回 JSON；失败统一为 `{ error: { code, message, details? } }`。API 与动态 HTML 使用 `Cache-Control: no-store`。

| 方法与路径 | 用途与边界 |
| --- | --- |
| `GET /api/health` | 检查数据库及基础 schema；不可用时返回 503 |
| `GET /api/locales` | 启用语言及 `code` / `pathPrefix` / `languageTag` 映射 |
| `GET /api/discovery` | 当前公开世界、住宿 / 活动稳定身份和实际公开语言集合；同一数据库快照、无默认 50 条截断 |
| Web `GET /sitemap.xml`、`GET /robots.txt` | 动态发现入口；sitemap 经 API 读取，与页面共用可索引与 URL 规则 |
| `GET /api/worlds?locale=en` | 公开世界，过滤隐藏和网站限制 |
| `GET /api/contents` | 默认住宿与活动；支持 `locale`、`world`、`kind`、`q`、`parentId`、`limit`、`offset` |
| `GET /api/contents/:id?locale=zh-CN` | 单条已发布内容；草稿和不存在条目返回 404 |
| `GET /api/worlds/:world/:kind/:slug?locale=en` | 按世界和类型读取；kind 为 `stay / experience / review` |
| `POST /api/auth/login` | `{ email, password }`；HttpOnly、SameSite=Strict Cookie，登录限流 |
| `POST /api/auth/logout` | 撤销会话并清 Cookie |
| `GET /api/auth/me` | 当前账号；失效或过期会话返回 401 |
| `GET /api/admin/worlds` | 账号可管理的世界 |
| `GET /api/admin/worlds/:worldId/contents` | 授权世界的编辑列表，可见草稿 |
| `GET /api/admin/contents/:id` | 授权条目的版本、译文、发布、审核和任务记录 |

列表默认 50 条、上限 100；当前游客页面没有分页 UI，管理列表最多返回 200 条。请求参数使用 Zod 校验，无效 UUID、类型、页长等返回 400。预订写接口仍留到阶段 5。

### 阶段 2 新增接口与使用方式

| 方法与路径 | 用途 |
| --- | --- |
| `GET /api/admin/worlds/:worldId/options` | 授权世界的地点、父内容、可用 persona 与翻译配置状态 |
| `POST /api/admin/contents` | 创建住宿、活动或手记草稿 |
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

Web 路由中的 locale 是公开前缀（`en` / `zh`），路径为 `/{locale}` 和 `/{locale}/worlds/{world}/stays|experiences/{slug}`。根路径 302 到 `/en` 并保留查询参数。语言切换保留路径和查询参数；无效语言、世界、类型、草稿、不存在条目返回 404；API 不可用返回本地化 503 页面。UI 有中英字典，新语言可以使用英文 UI 后备文案，正式增加语言时需补字典。

## 实际验收结果

以下结果来自真实运行；安装与 setup 行保留前阶段记录，本次阶段 2.5 重新执行了迁移、seed、检查、构建及全部测试：

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

## 剩余问题与下一步

阶段 1、2、2.5 验收没有已知阻塞。以下事项仍未交付：

- **元数据管理**：世界、地点、persona 当前由 seed 维护；世界创建/成员邀请、人物资料编辑的界面未开放。已有内容的稳定身份和归属创建后不可改写。
- **真实翻译**：执行器、适配器契约和失败/过期隔离已验证；真实供应商和术语表尚未接入，默认禁用，不使用其他项目密钥。
- **页面阶段**：当前简版页面只验收语言、取数、基础字段、价格与手记。搜索/筛选控件、图库、完整详情、关联内容和预订体验仍按阶段 3–5 完成。正式媒体与素材尚未接入。
- **阶段 3 分页与 SEO**：用户已确认在阶段 3 修复首页默认 50 条截断后的内部入口缺失。开发前须阅读[阶段 3 必做：分页与内部链接](plan.md#阶段-3-必做分页与内部链接)，实现 SSR 分页及分页 canonical / hreflang，并以同一世界至少 55 条双语内容验证全部条目从首页可达；正式开放索引前完成。
- **低优先级 URL 兼容项**：SEO review 曾观察到 `/ZH-CN//` 先经框架 301 到 `/ZH-CN/`，再经语言规范化 308 到 `/zh`，形成两次跳转；本轮未修改该组合的处理。标准规范地址不受影响，后续修改 URL 规范化时补充这类重复分隔符用例；不作为阶段 3 开工前的用户决策问题。
- **发布运维**：没有生产 Nginx、常驻服务配置、备份恢复、release 健康检查与流量切换；本机验收不等于生产部署。

用户已对[阶段 3 方案](phase-3-discovery.md#已回答的问题与后续细化)中的 Q1–Q3 全部选择 A，答案已写回：Services 独立管理 / 搜索 / 基础详情；日期 / 人数 / 房间数保存并带到详情，暂不按余量筛选；现有账号可登录管理，房东入口先放创作说明，公开注册后续开放。阶段 4 / 5 已在计划中扩展至服务，当前代码仍只有旧类型，不能误记为新增功能已交付。

下一步进入桌面 / 手机布局草图，细化 Logo、背景与 Lime 表现，再依 S3-01 至 S3-05 实现和验收。首页使用用户确认的旅行平台栏目顺序，搜索及查看全部进入完整列表；24 条页长与三 / 二 / 一列仅是完整列表建议，首屏不再强制放卡片。中英文案在布局之后处理，优惠 / 会员及三类内容的计价在阶段 5 前讨论。

本次只详细记录新方案并同步产品计划、决策、架构及文档入口，未开始首页编码。最新方案替代旧稿的首页分页网格和日期 / 人数暂缓规则；功能、正式文案、Logo、真实翻译与正式内容仍不能标记为已交付。上一轮 SEO 描述修复的代码与验证记录继续保留。

## 新 session 开发入口

阶段 3 开工所需的产品范围已齐备。用户要求本轮完成最终文档更新、commit 和 push，然后在新 session 实施。先核对 `git status` 与提交记录，依次阅读本文件、[阶段 3 方案](phase-3-discovery.md)、[产品计划](plan.md)、[架构方案](architecture.md)和[SEO 规范](i18n-seo-remediation.md)。本机服务、构建产物及配置需重新核实，文中的预览状态是上次操作记录，不保证进程仍在运行。

开发起点与完成边界：

1. 按 S3-00 形成桌面 / 手机布局草图或可运行初稿，沿已确认的 Expedia 式头部搜索、Airbnb 式发现栏目和 Lime 窗口风格继续实现；视觉微调与正式文案不阻断独立的数据 / 接口工作。
2. 完成 S3-01 至 S3-05，包括独立服务类型的完整管理链路与基础详情、只保存意向的行程参数、现有账号入口、世界首页配置、搜索与完整列表，以及 SSR 分页和 SEO。
3. 新增字段采用增量迁移，兼容既有内容与发布快照；开发与测试不能覆盖用户已有编辑。首发公开导航只有 Lathe Worlds，第二世界验证使用隔离数据。
4. 验收覆盖至少 55 条双语住宿 / 活动并另加服务，全部从首页沿真实链接可达；同时验证禁用 JavaScript、手机 / 桌面、语言切换、行程往返、权限与发布生命周期。
5. 执行适合变更的检查与 `npm test`、`npm run test:e2e`；后者包含类型检查和构建。测试使用隔离 schema，不因沙箱端口 / IPC 限制就认定实现失败。记录实际执行结果，不把旧测试结果充作本次验证。
6. 提供可运行预览和验证结果，更新交接及验收勾选。预览保持 `SITE_INDEXABLE=false`；完整详情、模拟预订、公开注册、真实翻译、正式内容和生产部署仍遵循各自阶段，不能提前计入阶段 3 完成范围。

Q1–Q3 不需重新确认。Q4 / Q5 可在开发预览中继续细化，Q6 在阶段 5 前讨论；若新 session 出现超出既定范围的选择，再单独说明影响。
