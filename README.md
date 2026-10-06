# Plotstay

虚构世界中的住宿与活动。Astro 按需渲染 + 独立 Node.js / TypeScript API + PostgreSQL。

阶段 1、2 已通过基础工程和内容管理验收，使用手工中英 dummy data。当前已立项[阶段 2.5：多语言 URL 与 SEO 修复](docs/i18n-seo-remediation.md)，完成后再讨论首页布局、进入阶段 3。游客页面目前是基础浏览页；下列 `/zh-CN` 地址仍是当前运行地址，计划中的 `/zh` 尚未实施。

```bash
npm ci
npm run setup
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

需要 Node.js 22.12+、Docker Compose。本机 Web：`http://localhost:4321/en`、`http://localhost:4321/zh-CN`；API：`http://127.0.0.1:4310/api/health`。独立凭据保存在 `.env`，setup 和 seed 重跑会保留已有设置和内容。

远程查看时使用构建版预览，避免通过 SSH 隧道加载开发工具脚本：先停止 `npm run dev`，再执行 `npm run build && npm run preview`。Web/API 仍使用相同端口；`preview` 同时启动两端，Ctrl+C 一起停止。代码修改后需重新构建和启动，数据库内容发布仍即时生效。

管理入口：`http://localhost:4321/zh-CN/admin`（英文为 `/en/admin`）。使用 `.env` 中的 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 登录，可编辑、导入、审核发布、下架及恢复历史发布。浏览器通过 Web 的同域 `/api` 转发访问独立后端，不需另开 SSH 转发端口。

翻译任务执行器已实现，外部供应商保持禁用。`npm run start:worker` 启动独立 worker；`node --env-file=.env apps/worker/dist/main.mjs --once` 可检查一次后退出。测试适配器只在测试中注入，不会生成冒充正式译文的公开内容。

```bash
npm test                     # PostgreSQL / API 边界测试
npx playwright install chromium --only-shell
npm run test:e2e              # 类型检查、构建、独立服务与浏览器验收
```

运行参数、接口、实际验证结果和下一步见 [开发进度与交接](docs/development-status.md)。产品与架构依据见 [文档索引](docs/README.md)。
