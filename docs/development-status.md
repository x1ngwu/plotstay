# Plotstay 开发顺序、进度与交接

更新日期：2026 年 10 月 6 日。**阶段 1 已提交推送，阶段 2 的内容管理与发布已完成验收；临时阶段 2.5「多语言 URL 与 SEO 规范修复」已立项，待实施。** 使用手工中英 dummy data。游客页面仍是基础浏览与路由验证页面，首页布局在阶段 2.5 完成后、阶段 3 开始前与用户讨论。

产品边界见[产品计划](plan.md)，技术选择见[架构方案](architecture.md)，确认经过见[决策记录](decisions.md)。本文记录当前实现和实际验证结果。

## 阶段状态

| 阶段 | 工作内容 | 当前进度 |
| --- | --- | --- |
| 0 方案记录 | 产品、架构、决策与原始讨论归档 | 已完成；方案 `af32393`、初次交接 `c3c4ce4` 已提交推送 |
| 1 基础工程与数据结构 | 工程、数据库、契约、双语 seed、权限与版本基础、API、Astro、语言与主题 | **已完成**；`531d90c` 已推送 `origin/main` |
| 2 内容管理与发布 | 管理页面与写 API、导入、审核、下架、回退、冲突、翻译适配器及 worker | **已完成并验收**；实现已提交 `f03cbef`，真实翻译供应商仍待配置 |
| 2.5 多语言 URL 与 SEO 规范修复（临时插入） | 语言与路径映射、旧链接兼容、canonical / hreflang、动态 sitemap、索引与回退规则 | **已立项，未实施**；详见[修复项目](i18n-seo-remediation.md)，完成验收后再进入阶段 3 |
| 3 发现首页 | 先讨论布局，再实现 digi-tech Lime 首页、卡片、分组、搜索筛选 | 未进入；基础浏览页不代表首页布局定稿 |
| 4 住宿与活动详情 | 图库、完整专有模块、人物、手记、关联内容 | 未交付；目前只有验证路由与取数的简版详情 |
| 5 模拟预订与凭条 | 游客身份、预订接口与组件、凭条、下载 | 未交付；保留原有领域函数与表结构草稿，尚未做该阶段验收 |
| 6 正式内容与上线 | 素材、术语表、外部翻译联调、域名、备份、切换与回退 | 未开始，没有生产部署 |

## 工作区与实现边界

- 路径 `/data/apps/plotstay`，分支 `main`。原有草稿已收进阶段 1 提交 `531d90c` 并推送；阶段 2 实现已提交为 `f03cbef`。阶段 2.5 立项与本次交接另作文档提交，用户要求一并推送 `origin/main`。
- `.env` 已由 setup 生成，重复 setup 保留它；凭据不写入文档或 Git。`.env.example` 只含占位值。
- 测试创建随机 `test_<uuid>` PostgreSQL schema，运行完整迁移和 seed，结束后清理。验收用的改名、下架等操作不改动开发 schema。
- 本机 PostgreSQL 容器 `plotstay-postgres-1` 健康，映射 `127.0.0.1:55432 → 5432`，数据在独立 Docker volume。验收进程已退出；随后为用户远程查看启动了构建版预览，Web/API 监听 `127.0.0.1:4321/4310`。这是当前会话中的预览进程，尚未配置开机自启。

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

以下地址反映当前运行代码。阶段 2.5 的目标中文路径为 `/zh`，尚未实施；现在仍通过 `/zh-CN` 查看，实施验收后再更新这些示例。

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
| Web 中文 | `http://localhost:4321/zh-CN` |
| Web 英文 | `http://localhost:4321/en` |
| 第二世界 | `http://localhost:4321/en?world=test-harbour` |
| 住宿详情样例 | `http://localhost:4321/zh-CN/worlds/lathe-worlds/stays/observation-room` |
| 活动详情样例 | `http://localhost:4321/en/worlds/lathe-worlds/experiences/forge-walk` |
| 中文管理页 | `http://localhost:4321/zh-CN/admin` |
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

关键配置为 `DATABASE_URL`、`API_HOST` / `API_PORT`、`API_INTERNAL_URL`、`HOST` / `PORT`、`WEB_ORIGIN`、`COOKIE_SECURE`。Web 只通过 `API_INTERNAL_URL` 取数，不导入数据库包。浏览器读到完整 SSR HTML。

Astro 已提供同域 `/api` 转发，只向固定 `API_INTERNAL_URL` 转发 Cookie、Origin 和正文；不跟随上游重定向，限制请求为 2 MB。管理页通过这个入口访问独立 API，原 SSH 隧道只需转发 Web 端口。登录使用 HttpOnly Cookie；写请求必须携带与 `WEB_ORIGIN` **完全一致**的 `Origin`，默认 `http://localhost:4321`。使用 `127.0.0.1` 或其他本地转发端口时需对应修改配置并重启。生产 HTTPS 时设 `COOKIE_SECURE=true`。

## 已实现接口

返回 JSON；失败统一为 `{ error: { code, message, details? } }`。API 与动态 HTML 使用 `Cache-Control: no-store`。

| 方法与路径 | 用途与边界 |
| --- | --- |
| `GET /api/health` | 检查数据库及基础 schema；不可用时返回 503 |
| `GET /api/locales` | 启用语言 |
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

Web 路由为 `/{locale}` 和 `/{locale}/worlds/{world}/stays|experiences/{slug}`。根路径 302 到 `/en` 并保留查询参数。语言切换保留路径和查询参数；无效语言、世界、类型、草稿、不存在条目返回 404；API 不可用返回本地化 503 页面。UI 有中英字典，新语言可以使用英文 UI 后备文案，正式增加语言时需补字典。

## 实际验收结果

以下结果来自本次真实运行：

| 检查 | 结果 |
| --- | --- |
| `npm ci` | 按 lockfile 重装成功；npm audit 当时报告 0 漏洞 |
| `npm run setup` | 已有 `.env` 保留，凭据被 Git 忽略 |
| migrate + seed 连续两遍 | 均正常；seed 无重复内容，并发与编辑后重跑另有测试覆盖 |
| 类型检查与构建 | TypeScript 与 `astro check` 通过，0 错误 / 0 警告；独立 API 与 Astro 产物构建成功 |
| `npm test` | 基础、管理 HTTP、翻译执行 3 组套件；Node runner 合计 22 tests 全部通过 |
| `npm run test:e2e` | 检查、构建、开发生命周期和 6 组 SSR / Chromium 验收通过；Node runner 合计 8 tests |
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

复验命令：

```bash
npm test
npx playwright install chromium --only-shell
npm run test:e2e
```

测试需要数据库连接、创建 schema 的权限及本机端口。首次浏览器测试发现旧缓存与 Playwright `1.63.0` 不匹配，已安装对应 Chromium headless shell `1243` 并重跑通过。截图在 Git 忽略的 `test-results/foundation-mobile.png`。测试不会自动下载浏览器，换环境需执行安装命令。

## 剩余问题与下一步

阶段 1、2 的功能验收没有已知阻塞；这不代表多语言 SEO 已完成。以下事项仍未交付：

- **临时阶段 2.5**：已核实语言键与 URL / HTML 标记耦合、`hreflang` 为相对地址，且缺少 canonical、动态 sitemap 与索引配置。本次只完成[立项及验收清单](i18n-seo-remediation.md)，代码与运行服务未调整；清单中的测试尚未执行。
- **元数据管理**：世界、地点、persona 当前由 seed 维护；世界创建/成员邀请、人物资料编辑的界面未开放。已有内容的稳定身份和归属创建后不可改写。
- **真实翻译**：执行器、适配器契约和失败/过期隔离已验证；真实供应商和术语表尚未接入，默认禁用，不使用其他项目密钥。
- **页面阶段**：当前简版页面只验收语言、取数、基础字段、价格与手记。搜索/筛选控件、图库、完整详情、关联内容和预订体验仍按阶段 3–5 完成。正式媒体与素材尚未接入。
- **发布运维**：没有生产 Nginx、常驻服务配置、备份恢复、release 健康检查与流量切换；本机验收不等于生产部署。

下一步先实施阶段 2.5，按 SEO-01 至 SEO-05 完成语言映射、路由兼容、搜索元数据、动态发现入口和回归。从阶段 2 提交 `f03cbef` 及其后的立项文档接续，开始时仍需核对 Git 状态并保留可能新增的工作区改动和数据库历史；正式域名未定不阻塞隔离测试，预览默认不开放索引。

阶段 2.5 验收完成后，再与用户讨论发现首页的布局、模块组合、搜索筛选行为和素材位置，进入阶段 3；视觉方向继续使用 digi-tech Lime。当前管理页面用于维护固定字段，不代表首页或详情的设计定稿。
