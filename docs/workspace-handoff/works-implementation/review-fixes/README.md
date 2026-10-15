# 内容列表 / 创建页 code review 修复

归档补充（2026-10-15）：用户已授权 commit & push 本轮修复，以下“未 commit/push”及 `final-state.json` 保留为验收时状态；实际提交以 Git 为准。MANIFEST 校验对应本次归档内容，development-status 只提交本轮两条记录，其他 session 的阶段 A 记录留在工作区。该授权不包含现用数据库审计 / 迁移或部署。

2026-10-15，基线 `0cb348b10c872ef36baf8d1e65d79236763131dd`。用户授权依次修复五项审查问题。本轮只修改源码、增量迁移、隔离测试和交接资料；没有现用数据库访问、迁移、清理或测试写入，没有部署、服务重启、代理配置修改、commit/push。开发域名仍运行此前版本。

## 修复结果

| 问题 | 修改后的行为 | 主要证据 |
| --- | --- | --- |
| R1 撤销经营资格后仍可审核发布 / 恢复回复 | 发布和恢复在事务锁内检查原回复作者当前账号及经营资格；撤权 / 退出后阻断。送审记录资格 epoch，重新批准不使旧待审复活，必须明确重新送审。详情、列表、审核队列和概览使用同一有效待审判定；仅暂存新草稿不会使旧待审重新生效 | 专项领域测试；真实旧 HTTP 发布 / 恢复均 403，重新批准后旧发布 409，明确重新送审后 200；中英桌面 / 手机回复截图 |
| R2 保存后的 GET 回读覆盖新输入 | 在 GET 完成、写入表单之前比较提交快照与当前输入。晚输入保留为未保存；首次保存保留真实 ID，第二次保存不会重复创建。另一窗口抢先更新时保留输入并阻止静默采用新基准，允许导出 / 重新载入比较 | 普通作者两语言 × 两尺寸的 GET 延迟测试、首次保存、另一窗口抢先更新；旧 / 新编辑器回归 |
| R3 回复与作品保存锁顺序相反 | 旧回复保存、送审和新原子保存入口统一先锁所属作品，再检查账号 / 经营资格，再取角色 / 回复锁，与作品保存一致 | 用事务屏障固定旧死锁顺序；旧保存、旧送审、新组合保存与作品保存全部完成，无 `40P01` |
| R4 新建页首次加载失败丢失合法预填 | 加载失败不能证明选项无效，保留 URL / 内存中的选择；成功收到候选响应后才清除真实失效项 | 两语言 × 两尺寸失败 / 重试；成功响应确认角色不可用时仍会清除 |
| R5 列表迟到响应销毁更多筛选面板 | 保留原生 dialog 节点，列表只更新内容区域；面板焦点和未应用选择保留。取消 / Escape 丢弃面板改动，应用才写入筛选 | 两语言 × 两尺寸 × 取消 / 应用 / Escape；焦点返回触发按钮 |

R1 补测暴露了既有回复状态排序问题：同一事务“保存并送审”的两条事件共享 `now()`，以随机 UUID 排序可能误读成草稿。已在相关状态查询中明确同一时刻初始 draft 先于后续状态。新增测试固定 draft 的 UUID 大于 submit 的 UUID，验证详情、审核队列、列表和真实发布路径。只调整读取顺序，不修改历史事件。

编辑器、公开模板、工作台外壳与导航布局保持本轮已验收设计。本次没有修改页面 CSS。回复页面仅补资格撤销 / 原待审失效提示，属于 R1 所需的真实状态反馈。

## 接口与迁移

新增 `014_reply_operating_eligibility.sql`，未修改 001–013：

- `review_replies.submitted_access_epoch` 随成功送审写入；审核发布匹配当前 epoch；发布 / 退回清空当前送审指针和 epoch。
- 已撤权或存在撤权 / 退出历史的待审保留历史指针，但 epoch 留空，因此不可自动审核生效。没有撤权历史的原待审按当前资格 epoch 补齐；从未有资格记录的旧回复使用 0，维持既有回复权限模型，不凭空授予作品经营能力。
- 迁移不修改回复正文、历史署名、事件或发布快照。013 的作品所有权与永久锁约束不变。

旧 HTTP 路径和写请求参数不变。回复详情增加 `submissionExpired`、`eligibilityRevoked`，向有权读取者说明当前状态；`reply.submitted_revision_id` 只表示有效待审。原始指针仍作为 `submissionGuard` 并发令牌使用，不能据此读取其他人的私稿。

组合保存 `/api/me/review-workspace/save` 返回的 `submittedRevisionId` 只表示有效待审，另加 `submissionGuard` 保留实际并发令牌。草稿保存不能把已失效的旧指针显示成有效待审。`403 ELIGIBILITY_REVOKED` 阻止撤权后的写 / 发布 / 恢复，`409 SUBMISSION_EXPIRED` 要求重新送审。

后续现用升级需要 **013 + 014** 和明确授权；先解决 G02 / G04 历史所有权、经营绑定的审计与映射，再按[迁移计划](../migration-plan.md)执行备份、隔离副本验证、迁移和构建切换。本轮未执行这些步骤，也不提供任何管理员解锁例外。不可通过回退到绕过资格校验的旧代码恢复审核能力。

## 验证与证据

| 检查 | 结果 / 证据 |
| --- | --- |
| 原有领域套件 | 112/112，[日志](regression-domain-tests.log) |
| 作品 / 回复首轮专项 | 55/55，包含 `works.test.ts`、旧回复和评价权限，[日志](domain-tests.log) |
| 最终回复 / 并发 / 迁移 / 概览专项 | 47/47，[日志](final-reply-domain-tests-rerun.log)；覆盖撤权、退出、重新批准、并发撤权、锁顺序、组合暂存、固定 UUID 顺序、014 重复迁移及历史不变量 |
| 新浏览器专项 | 23 个 R2/R4/R5 场景及 R1 旧 HTTP + 四个中英尺寸检查，[交互记录](browser-evidence.json)、[回复记录](reply-browser-evidence.json)、[日志](final-review-browser-tests.log) |
| 作品列表 / 新建页完整矩阵 | 25 组通过，72 条隔离数据库内容，中文 / 英文、1440 / 1100 / 390 / 360px、200% 字体、菜单、键盘、长名称、状态 / 错误 / 资格变化，[记录](works-matrix/browser-verification.json)、[日志](works-browser-tests.log) |
| 旧 / 新编辑器、公开详情、角色评价、概览回归 | 首轮 40/40，[日志](regression-browser-tests.log)；最后回复状态读取变更后评价、角色评价与概览 20/20，[最终日志](final-reviews-regression.log) |
| 类型 / Astro 检查 | 0 errors、0 warnings、0 hints，[日志](check.log) |
| 隔离构建 | Web / API / worker 输出到 `/tmp`，没有覆盖现用构建；[Web 日志](build.log)、[可复用构建脚本](build-isolated.mjs) |

上述批次存在重叠，不合计成唯一测试数量。首次扩展领域复测曾为 45/46：发现同事务事件排序缺陷，保留[失败日志](final-reply-domain-tests.log)，修复后最终 47/47。未以重复运行碰运气消除失败；新测试强制触发旧排序。

浏览器使用真实 Web、真实 API、临时 PostgreSQL 和普通作者账号（无世界管理角色）。网络拦截只用于延迟 / 失败或返回无可选角色的场景；没有用本地数组模拟保存成功。截图为实际 Chromium 页面，不代表物理手机、Safari 或公网 Basic Auth 交互已验收。

## 截图

| 场景 | 中文桌面 | 英文手机 |
| --- | --- | --- |
| 创建选项失败后重试，合法预填保留 | [1440px](screenshots/r4-prefill-retried-zh-1440.png) | [390px](screenshots/r4-prefill-retried-en-390.png) |
| 更多筛选面板 | [1440px](screenshots/r5-modal-zh-1440.png) | [390px](screenshots/r5-modal-en-390.png) |
| 保存回读期间的新输入保留 | [1440px](screenshots/r2-preserved-input-zh-1440.png) | [390px](screenshots/r2-preserved-input-en-390.png) |
| 撤权后的回复只读 / 旧待审失效 | [1440px](screenshots/r1-revoked-reply-zh-1440.png) | [390px](screenshots/r1-revoked-reply-en-390.png) |

每个场景也有英文桌面与中文手机截图。完整页面矩阵在 [works-matrix/screenshots](works-matrix/screenshots)，角色评价回归在 [reviews-regression/screenshots](reviews-regression/screenshots)。实际打开抽查了新建页、手机筛选、回复资格失效页面，保留原浅色壳、文字横卡、同页三选结构和原操作层级。

## 复测方式与环境边界

只允许专门临时库，不能加载现用 `.env`。本轮使用 `postgres:18-bookworm`、tmpfs 数据目录、`127.0.0.1:55439`，测试在每个随机 schema 内迁移并生成合成样例，结束清理 schema。以下命令中的凭据仅用于这个临时实例。

```bash
docker run --rm -d --name plotstay-works-fixes-0cb348b \
  --tmpfs /var/lib/postgresql:rw -p 127.0.0.1:55439:5432 \
  -e POSTGRES_USER=works_test -e POSTGRES_PASSWORD=isolated-works-test-only \
  -e POSTGRES_DB=works_test postgres:18-bookworm

export DOTENV_CONFIG_PATH=/dev/null
export DATABASE_URL=postgres://works_test:isolated-works-test-only@127.0.0.1:55439/works_test
export PLOTSTAY_TEST_BUILD=/tmp/plotstay-works-fixes-0cb348b
node docs/workspace-handoff/works-implementation/review-fixes/build-isolated.mjs

./node_modules/.bin/tsx --test tests/works-review-fixes.test.ts tests/works.test.ts
./node_modules/.bin/tsx --test tests/works-review-fixes-e2e.test.ts
```

旧矩阵用 `PLOTSTAY_TEST_EVIDENCE` 指向新的证据目录，避免覆盖以前验收资料。不可直接运行包含正式输出目录构建的 `npm run test:e2e`。测试端口只用于进程间隔离验收，本轮没有发布新的 localhost 交付页，也没有更新已托管原型或测试域名。本轮结束时测试 schema 为 0，自建 tmpfs 容器已停止并自动移除；现用 Web 构建摘要与开工前一致。

## 改动范围与遗留事项

生产文件：原编辑器 `admin.ts`；列表 / 新建控制器 `workspace-works.js`；回复提示 `workspace-reviews.ts`；共享回复领域、原子命令、列表和概览查询；新增资格判定模块及迁移 014。两页以外的共享改动用于关闭旧 API 旁路、统一锁顺序及显示真实待审状态，已覆盖旧后台、角色评价和概览回归。

测试文件：新增 `works-review-fixture.ts`、`works-review-fixes.test.ts`、`works-review-fixes-e2e.test.ts`；基础迁移数更新为 14；两份既有浏览器测试只增加证据输出目录配置。逐项[文件清单](files.txt)、[SHA-256 校验](MANIFEST.sha256)和[最终状态](final-state.json)一并归档。

开工时已有的 Nginx、operations、阶段 A 目录和两个 ZIP 没有改动；development-status 只追加本轮记录，保留已有内容。G02 / G04 没有获得现用审计 / 修复授权，仍待确认。没有进行历史手记清理。修复完成后停止，等待后续明确的现用迁移 / 部署授权。
