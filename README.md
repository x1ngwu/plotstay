# Plotstay

虚构世界中的住宿、活动与服务。Astro 按需渲染 + 独立 Node.js / TypeScript API + PostgreSQL。

阶段 1、2、[2.5 多语言 URL 与 SEO 修复](docs/i18n-seo-remediation.md)已完成验收，使用手工中英 dummy data。中文规范路径为 `/zh`（标记 `zh-Hans`），旧 `/zh-CN` 自动跳转；预览默认关闭索引。阶段 3 S3-00–S3-05 功能与布局已获确认：发现首页、独立 Services、行程条件、世界配置与完整 SSR 分页已可用。样式以原版 digi-tech Lime 为准，并按用户提供的 Airbnb 参考包校准发现栏目尺寸与间距；中英文案已审定发布，当前视觉版本获用户认可并授权提交，见[视觉校准记录](docs/phase-3-visual-alignment.md)。

```bash
npm ci
npm run setup
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:seed:discovery # 可选：追加多地点、服务及首页配置演示
npm run dev
```

需要 Node.js 22.12+、Docker Compose。本机 Web：`http://localhost:4321/en`、`http://localhost:4321/zh`；API：`http://127.0.0.1:4310/api/health`。独立凭据保存在 `.env`，setup 和 seed 重跑会保留已有设置和内容。

远程查看时使用构建版预览，避免通过 SSH 隧道加载开发工具脚本：先停止 `npm run dev`，再执行 `npm run build && npm run preview`。Web/API 仍使用相同端口；`preview` 同时启动两端，Ctrl+C 一起停止。代码修改后需重新构建和启动，数据库内容发布仍即时生效。

固定域名调试入口：`https://plotstay.xingwu.dev/zh`（英文 `/en`，管理 `/zh/admin`），无需 localhost 映射。服务器通过 Nginx 和现有 Cloudflare 源站证书提供 HTTPS；`plotstay-preview.service` 托管 Web/API，并在重启后自动启动。部署配置保存在 `deploy/nginx/plotstay.xingwu.dev.conf` 和 `deploy/systemd/plotstay-preview.service`。域名服务单独设置 HTTPS `WEB_ORIGIN`、安全 Cookie 和 `SITE_INDEXABLE=false`，本地 `.env` 仍可用于 localhost 开发。

更新域名预览：`npm run build && sudo systemctl restart plotstay-preview`。查看状态：`systemctl status plotstay-preview`；查看日志：`journalctl -u plotstay-preview -n 100 --no-pager`。同一服务器上的域名服务占用 4321/4310，运行本地开发命令前需要先停服务，或为开发另选端口。

**默认发布约定：每次代码修改完成并通过相关验证后，默认更新上述开发域名并验证线上结果，无需再次确认。** 全站启用 Basic Auth（用户名 `admin`，密码按用户指定的服务器配置），保持 `noindex`；公开的 `/robots.txt` 统一禁止爬取。完整流程见[项目操作手册](docs/operations.md)。

`start:web` 通过 `apps/web/server.mjs` 加载已构建的 Astro handler，启用 Brotli / gzip；浏览时不会编译。字体按字符分包，构建资源使用内容哈希及长期缓存，HTML 继续 `no-store`。优化后的字体规则和同条件测速见[加载优化记录](docs/font-previews.md#加载优化2026-10-07)。

管理入口：`http://localhost:4321/zh/admin`（英文为 `/en/admin`）。使用 `.env` 中的 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 登录，可编辑、导入、审核发布、下架及恢复历史发布。浏览器通过 Web 的同域 `/api` 转发访问独立后端，不需另开 SSH 转发端口。

SEO 配置与写请求的 `WEB_ORIGIN` 独立：`SITE_INDEXABLE` 默认 `false`；正式启用需要 `SITE_INDEXABLE=true` 及有效 HTTPS origin 的 `SITE_URL`。当前预览保持关闭，动态 `/sitemap.xml` 为空；隔离测试会显式打开索引验证。不要为 dummy data 开放索引。增量迁移包含 `004_locale_urls.sql` 与 `005_discovery.sql` 使用 `npm run db:migrate` 增量应用，不改写历史迁移或重置数据。

翻译任务执行器已实现，外部供应商保持禁用。`npm run start:worker` 启动独立 worker；`node --env-file=.env apps/worker/dist/main.mjs --once` 可检查一次后退出。测试适配器只在测试中注入，不会生成冒充正式译文的公开内容。

```bash
npm test                     # PostgreSQL / API 边界测试
npx playwright install chromium --only-shell
npm run test:e2e              # 类型检查、构建、独立服务与浏览器验收
```

当前字体为英文 C、中文默认 B；中文可在右上角菜单选择“细点阵”或“街机像素”，浏览器会记住选择。`/font-preview` 保留原版及全部对照方案，见[字体规则](docs/font-previews.md)。

运行参数、接口、实际验证结果和下一步见 [开发进度与交接](docs/development-status.md)。产品与架构依据见 [文档索引](docs/README.md)。

完整列表：`/zh?view=results`；服务：`/zh/worlds/lathe-worlds/services/augmetic-tune-up`；帮助与创作说明：`/zh/help`、`/zh/host`。阶段 3 的 31 项后端测试通过；加载优化后重跑 26 项端到端测试通过，隔离验收从首页遍历 73 条公开内容无遗漏。正式素材、完整详情、模拟预订、公开注册与生产部署仍按后续阶段推进。
