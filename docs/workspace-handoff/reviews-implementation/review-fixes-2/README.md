# 评价第二轮 code review 修复

2026-10-13，起始 HEAD `a0c9d350724cfb18cc24d78415a620ccd28d55d5`。用户要求先保存当前版本再修复两项发现；当前版本已在上一轮 commit/push，开工无待提交代码，仅原始 `example_pages.zip` 未跟踪，因此没有创建空提交。本轮新修复未 commit/push。

## 修复与证据

| 问题 | 最小修改 | 真实浏览器回归 |
| --- | --- | --- |
| P1 旧账号成功响应迟到，清空新账号编辑器 | `api()` 解析响应后先校验请求代际；过期响应在账号判断、清空或会话错误处理之前退出 | 挂起 A 的真实详情响应，切换登录 B，打开 B 的评价并输入，释放 A 响应；B 页面、正文、dirty 状态保持，随后保存的数据库版本属于 B，A 的历史未写入该正文 |
| P2 将他人私稿 head 当作可读预览版本 | 首次载入及冲突采用基准后，预览 ID 使用 `editableRevision()` 的可读版本；保存仍使用原 `baseRevisionId` 并发令牌 | 提供者换人、对方保存私稿、恢复原提供者；冲突采用新基准后预览本人回复；重新打开编辑也可正确预览；页面无对方私稿正文，随后保存使用正确并发基准成功 |

生产代码只改 `apps/web/src/lib/workspace-reviews.ts` 三处；新增回归位于 `tests/reviews-workspace-e2e.test.ts`。另更新本目录证据、实施 README 和 development-status。没有修改 API、领域授权、数据库、共享工作台壳或角色控制器/CSS，未发现其他 session 的工作区改动，没有覆盖共享文件。

## 命令与结果

在 `/tmp/plotstay-reviews-b-build` 构建，workspace 依赖指向临时目录自身；测试运行真实编译 API/Web 和 Chromium，数据库写入仅在随机隔离 schema，结束清理。既有 dotenv 仅用于连接数据库，没有读取或输出凭据。

```bash
npm run build
DOTENV_CONFIG_PATH=/data/apps/plotstay/.env ./node_modules/.bin/tsx --test --test-concurrency=1 tests/reviews-workspace-e2e.test.ts tests/persona-workspace-races-e2e.test.ts
DOTENV_CONFIG_PATH=/data/apps/plotstay/.env ./node_modules/.bin/tsx --test --test-concurrency=1 tests/reviews-workspace-e2e.test.ts
git diff --check
```

- [构建通过](build.txt)：TypeScript/Astro 0 errors/warnings/hints。
- [首轮记录](browser-first-run.tap)：角色异步回归10个场景及父测试共11/11通过；评价两个新增测试误将保存后的 `Input saved` 预期成载入提示，造成两个子测试和父测试失败。修正测试文案断言，生产代码无额外变动。
- [评价复验](browser.tap)：11个场景及父测试共12/12全通过，包含新增两项、先前保存快照/冲突、中英1440/390四页面矩阵、1100/360和200%文字、空错/加载、同账号恢复和慢导航输入保护。未重跑无关业务全量套件；不把父测试算作额外业务场景。
- `git diff --check`通过。沙箱阻止测试监听和公网DNS后，按权限机制重跑相同命令；这些环境失败不算业务测试失败。

新增截图来自1100px真实隔离浏览器：[旧响应到达后 B 的输入](screenshots/fix-late-account-response-en.png)、[本人可读回复预览](screenshots/fix-readable-reply-preview-en.png)。本次矩阵完整产物留在临时构建目录的 `docs/workspace-handoff/reviews-implementation/screenshots/`，原交付截图未覆盖。

## 开发域名与边界

保存旧 Web 构建为 `/tmp/plotstay-reviews-second-before-web-build.tar.gz`，将临时目录已验证的 Web dist 安装到现有服务，保留旧散列资源。API 源码与构建未替换。执行：

```bash
sudo systemctl restart plotstay-preview
curl --retry 10 --retry-connrefused --retry-delay 1 --fail http://127.0.0.1:4321/api/health
systemctl is-active plotstay-preview
systemctl show plotstay-preview --property=ActiveEnterTimestamp
node docs/workspace-handoff/reviews-implementation/review-fixes-2/check-deployment.mjs
```

服务于 **2026-10-13 17:46:45 JST** 更新，active、health ok；重启瞬间首次连接拒绝，按操作手册重试后正常。[31项只读部署检查通过](deployment-check.json)，[检查脚本](check-deployment.mjs)覆盖公网页面/API/静态资源的未认证及错误认证门禁、noindex/nofollow/noarchive、no-store、公开robots Disallow，以及本机中英评价两页手机登录壳、应用无会话403。现有 systemd 的 `SITE_INDEXABLE=false` 保持；未修改 Nginx/systemd 配置。

没有迁移、seed/reset、现用业务数据写入或新账号样例。附件未修改，`example_pages.zip` 仍未跟踪。本轮两项发现均已修复；**公网 Basic Auth 登录后交互、物理手机/软键盘、屏幕阅读器未验证**。本机隔离真实 API 测试不能替代这些验证。
