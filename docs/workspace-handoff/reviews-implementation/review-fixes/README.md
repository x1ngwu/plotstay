# 评价阶段 B code review 修复

2026-10-13。用户要求修复对 `bffb07085b4048f15e7165dc77b19af4922fea75` 的三项 review 发现。本轮起始及结束 HEAD 不变，没有 commit/push。开工仅有原未跟踪 `example_pages.zip`，没有其他 session 的已跟踪改动。

## 修复结果

| 问题 | 修复 | 验证 |
| --- | --- | --- |
| P1 身份检查期间输入与保存基准不一致 | 身份请求发出前，从同一份已校验的点击快照生成命令正文和保存基准；检查期间及保存期间的后续输入不进入该命令。账号与版本校验仍在写入前执行。 | 真实浏览器分别操作评价与回复，延迟 auth/me 和保存响应；暂存后新输入仍 dirty，取消离开保留输入；提交期间输入再撤回到点击快照时，数据库与界面相同且可正常离开。 |
| P2 隐藏公开回复阻断 A 审核 | 版本状态只取 draft/submit/publish/reject，hide/restore 作为公开可见性事件保留。详情、写入校验、列表、审核队列和首页使用一致规则。 | 公开 P、待审 A，分别有／无 B；隐藏并恢复 P 后 A 可批准或退回，B 保持草稿可再送审，旧 A 请求不能误批；只读事件历史仍含 hide/restore。 |
| P2 冲突核对后预览旧版本 | 采用服务器基准时，同步已保存预览版本 ID；本地输入继续保留。 | 评价和回复分别制造服务器新版本与本地输入完全一致的冲突；核对后为 clean，预览 URL 和正文均属于采用的新版本。 |

隐藏／恢复事件的原记录及旧 API 参数语义保持，已存在的此类事件也由新读取规则正确处理，无数据修复脚本或迁移。没有覆盖整个共享文件，没有改角色控制器或角色样式。

## 实际文件范围

- `apps/web/src/lib/workspace-reviews.ts`：固定命令快照、采用基准后同步预览版本。
- `packages/domain/src/persona-reviews.ts`：回复详情、审核队列和操作的版本状态读取。
- `packages/domain/src/review-workspace.ts`：回复列表的草稿／送审状态。
- `packages/domain/src/workspace.ts`：首页回复状态，与可见性分开。
- `tests/reviews-workspace.test.ts`：新增 hide/restore 与 P/A/B 四种审核组合。
- `tests/reviews-workspace-e2e.test.ts`：新增评价／回复的慢身份请求、暂存／提交、撤回输入、dirty 离开与匹配基准预览回归。
- 本目录及实施 README、development-status 的交接更新。旧阶段 B 截图和测试记录保持原样。

## 实际命令和结果

在 `/tmp/plotstay-reviews-b-build` 构建和测试，workspace 包链接指向临时目录自身；数据库均为一次性随机 schema，测试完成清理。`DOTENV_CONFIG_PATH` 仅供既有测试连接数据库，没有读取或输出凭据。浏览器连接真实编译 API/Web；故障注入仅用于延迟请求，成功写入使用真实隔离数据库。

```bash
npm run build
DOTENV_CONFIG_PATH=/data/apps/plotstay/.env ./node_modules/.bin/tsx --test --test-concurrency=1 tests/reviews-workspace.test.ts tests/persona-reviews.test.ts tests/overview.test.ts tests/overview-sources.test.ts
DOTENV_CONFIG_PATH=/data/apps/plotstay/.env ./node_modules/.bin/tsx --test --test-concurrency=1 tests/reviews-workspace-e2e.test.ts tests/persona-reviews-e2e.test.ts tests/persona-workspace-races-e2e.test.ts tests/overview-e2e.test.ts
```

- [构建通过](build.txt)，TypeScript/Astro 0 errors/warnings/hints。
- [相关后端回归 38/38 通过](unit.tap)，包括评价权限与 P/A/B、旧回复操作、首页来源及新增四个组合。34.9 秒。
- [浏览器回归 27/27 通过](browser.tap)，包含旧账户／审核、首页、角色 dirty 和异步请求、评价页面原有9项子场景（含本次新增2项）。58.9 秒。测试数量包括父测试，没有冒充27个新增用例。
- 本轮最终运行无失败。review 前的三个缺陷已通过隔离复现确认，临时复现脚本在 `/tmp/plotstay-reviews-b-build/tests/review-audit-*.test.ts`，断言当时的错误行为，仅为历史诊断，不加入标准回归；正式新增测试断言修复后的正确行为。

没有重跑所有无关业务套件，不将上一轮全量结果算作本轮结果。

## 补充真实截图

原有中英1440/390矩阵及1100/360、200%文字测试随浏览器专项重新执行；原交付截图不覆盖。本次新增截图为1100px真实浏览器：

- [评价：保存后仍有未保存输入](screenshots/fix-save-input-reviews-en.png)
- [回复：保存后仍有未保存输入](screenshots/fix-save-input-replies-en.png)
- [评价：采用新基准后预览新版本](screenshots/fix-adopted-preview-reviews-en.png)
- [回复：采用新基准后预览新版本](screenshots/fix-adopted-preview-replies-en.png)

## 开发域名与边界

已将验证通过的同一批构建产物安装到现有 dist，保留旧散列资源；旧产物备份 `/tmp/plotstay-reviews-fixes-before-build.tar.gz`。执行 `sudo systemctl restart plotstay-preview` 后，服务于 **2026-10-13 17:25:55 JST** active；本机 `/api/health` 为 `ok`。启动瞬间首次连接被拒绝，按 operations 的 retry 命令一秒后正常。

[部署检查31项通过](deployment-check.json)，[可复跑脚本](check-deployment.mjs)：公网未认证／错误认证门禁、页面/API/静态资源的 Basic Auth、noindex/nofollow/noarchive、no-store、robots Disallow；本机已部署服务的中英两页手机登录壳和无会话403。只读检查不写现用账号或业务数据，没有改 Nginx/systemd 配置。

**未验证**：公网通过 Basic Auth 的登录后交互、物理手机／软键盘和屏幕阅读器。登录、输入、保存及权限回归使用本机隔离服务，不能替代这些未验证项。

本轮无迁移、seed/reset、现用业务写入、commit/push。角色 controller/CSS 和迁移目录 diff 为空；三个用户 ZIP 校验值不变，`example_pages.zip` 仍未跟踪。无已知未解决的本轮三项缺陷。
