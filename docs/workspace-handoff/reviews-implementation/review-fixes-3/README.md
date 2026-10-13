# 评价第三轮 review 修复

2026-10-13，基线 `5d1496d`，开工无已跟踪修改，仅原始 `example_pages.zip` 未跟踪。用户授权修复历史分页遗漏当前角色回复、首次保存回复后预览按钮仍禁用两项问题。

## 实际修改

- `packages/domain/src/persona-reviews.ts`：仅修改 `replyDetail`，先按当前账号、当前绑定角色查出最新本人回复版本，再将它作为每页必带版本。历史分页、总数、公开/待审指针及原权限过滤保持；新增一次有界详情查询，不影响列表或引入逐卡历史查询。
- `apps/web/src/lib/workspace-reviews.ts`：保存成功后启用现有预览按钮，不重建编辑器，不丢失保存期间的新输入；预览动作继续检查 dirty。
- `tests/reviews-workspace-e2e.test.ts`：新增两组真实 API/浏览器回归。角色切换并保存21个其他角色版本后，历史第1、2页都加载并预览正确本人版本，原并发 head 保持，旧提供者只读自己的私稿；分别验证首次暂存/提交后立即预览持久化版本。
- 本目录及 development-status、实施 README 归档。共享修改已在开工说明，局限于回复详情函数；角色页、公共导航、API参数、迁移目录不改，没有其他 session 的工作区修改。

## 测试与截图

在 `/tmp/plotstay-reviews-b-build` 构建测试；依赖的 workspace 包指向该目录自身。数据库操作只在随机隔离 schema 中，测试结束清理；浏览器运行真实编译 API/Web，不使用预览假数据。没有读取或输出凭据。

```bash
npm run build
DOTENV_CONFIG_PATH=/data/apps/plotstay/.env ./node_modules/.bin/tsx --test --test-concurrency=1 tests/reviews-workspace.test.ts tests/persona-reviews.test.ts
DOTENV_CONFIG_PATH=/data/apps/plotstay/.env ./node_modules/.bin/tsx --test --test-concurrency=1 tests/reviews-workspace-e2e.test.ts tests/persona-reviews-e2e.test.ts tests/persona-workspace-races-e2e.test.ts
git diff --check
```

- [构建](build.txt)通过，TypeScript/Astro 0 errors/warnings/hints。
- [后端回归](unit.tap)32/32通过，含现有权限、固定待审版本及旧回复操作。
- [浏览器回归](browser.tap)30/30通过（包含父测试）：评价13个场景、角色异步10个场景及旧账户/审核流程。包括原中英1440/390四页面矩阵、1100/360、200%文字、只读与空错状态，以及前两轮输入/账号竞态回归。本轮最终测试无失败，未重跑无关业务全量套件。
- `git diff --check`通过。

新增1100px真实浏览器截图：[历史第2页的本人回复预览](screenshots/fix-paginated-reply-preview-en.png)、[首次提交后直接预览](screenshots/fix-first-reply-preview-en.png)。中英桌面/手机矩阵本轮也已重跑，产物位于临时构建目录 `docs/workspace-handoff/reviews-implementation/screenshots/`；原交付截图未覆盖。

## 部署与验证边界

旧构建备份 `/tmp/plotstay-reviews-third-before-build.tar.gz`。已安装测试通过的 API/Web dist，保留旧散列资源，执行 `sudo systemctl restart plotstay-preview`。服务于 **2026-10-13 17:58:52 JST** 更新；`systemctl is-active plotstay-preview` 为 active，`curl --retry 10 --retry-connrefused --retry-delay 1 --fail http://127.0.0.1:4321/api/health` 为 ok（启动瞬间首次连接拒绝，重试正常）。

`node docs/workspace-handoff/reviews-implementation/review-fixes-3/check-deployment.mjs`：[31项只读检查通过](deployment-check.json)。公网未认证/错误认证页面、API、静态资源保持 Basic Auth、noindex/nofollow/noarchive、no-store；公开 robots 保持 Disallow。本机已部署中英两页手机登录壳正常，应用无会话返回403。现有 `SITE_INDEXABLE=false` 保持，未修改 Nginx/systemd。

没有迁移、seed/reset、现用账号或业务样例写入；附件保持原样。两项发现已修复，新修复未commit/push。**未验证：公网 Basic Auth 登录后交互、物理手机/软键盘、屏幕阅读器**；本机隔离真实 API 测试不能替代这些验证。
