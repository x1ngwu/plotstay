# Plotstay

虚构世界中的住宿与活动。Astro 按需渲染 + 独立 Node.js / TypeScript API + PostgreSQL。

阶段 1、2、[2.5 多语言 URL 与 SEO 修复](docs/i18n-seo-remediation.md)已完成验收，使用手工中英 dummy data。中文规范路径为 `/zh`（标记 `zh-Hans`），旧 `/zh-CN` 自动跳转；预览默认关闭索引。游客页面仍为基础浏览页，下一步先讨论阶段 3 首页布局，保持 digi-tech Lime。

```bash
npm ci
npm run setup
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

需要 Node.js 22.12+、Docker Compose。本机 Web：`http://localhost:4321/en`、`http://localhost:4321/zh`；API：`http://127.0.0.1:4310/api/health`。独立凭据保存在 `.env`，setup 和 seed 重跑会保留已有设置和内容。

远程查看时使用构建版预览，避免通过 SSH 隧道加载开发工具脚本：先停止 `npm run dev`，再执行 `npm run build && npm run preview`。Web/API 仍使用相同端口；`preview` 同时启动两端，Ctrl+C 一起停止。代码修改后需重新构建和启动，数据库内容发布仍即时生效。

管理入口：`http://localhost:4321/zh/admin`（英文为 `/en/admin`）。使用 `.env` 中的 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 登录，可编辑、导入、审核发布、下架及恢复历史发布。浏览器通过 Web 的同域 `/api` 转发访问独立后端，不需另开 SSH 转发端口。

SEO 配置与写请求的 `WEB_ORIGIN` 独立：`SITE_INDEXABLE` 默认 `false`；正式启用需要 `SITE_INDEXABLE=true` 及有效 HTTPS origin 的 `SITE_URL`。当前预览保持关闭，动态 `/sitemap.xml` 为空；隔离测试会显式打开索引验证。不要为 dummy data 开放索引。新增 `004_locale_urls.sql` 使用 `npm run db:migrate` 增量应用，不改写历史迁移或重置数据。

翻译任务执行器已实现，外部供应商保持禁用。`npm run start:worker` 启动独立 worker；`node --env-file=.env apps/worker/dist/main.mjs --once` 可检查一次后退出。测试适配器只在测试中注入，不会生成冒充正式译文的公开内容。

```bash
npm test                     # PostgreSQL / API 边界测试
npx playwright install chromium --only-shell
npm run test:e2e              # 类型检查、构建、独立服务与浏览器验收
```

运行参数、接口、实际验证结果和下一步见 [开发进度与交接](docs/development-status.md)。产品与架构依据见 [文档索引](docs/README.md)。
