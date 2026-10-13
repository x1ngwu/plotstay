# 评价阶段 B 真实接入

阶段 B 已真实接入并于 2026-10-13 约 17:00 JST 更新开发域名。012 增量迁移已应用；服务 active、health ok，31 项部署后只读保护检查通过。用户实机体验待验收；阶段 A 的合成数据演示不算真实权限证据。

真实入口：[我的评价](https://plotstay.xingwu.dev/zh/workspace?view=reviews)、[收到的评价](https://plotstay.xingwu.dev/zh/workspace?view=replies)；英文切换 `/en/`。沿用现有 Basic Auth 与应用账号登录，不建立演示账号。

[逐项验收 B01–B36、V01–V12、O01–O10](acceptance.md) · [30 张截图与前后对照](visual-review.md) · [迁移审计](migration-audit.json) · [实际文件范围](files.txt)。

入口：`/zh/workspace?view=reviews`、`/zh/workspace?view=replies`；英文使用 `/en/`。沿用用户已确认的 [阶段 A](../reviews-prototype/README.md) 与原始 ZIP 内 handoff/checklist；没有重新设计角色页。

[实际契约与共享范围](contract.md)。起始 HEAD `4d6ffd4`；不自动 commit/push。角色控制器与角色样式不改，另一 session 的两轮 dirty 修复保留。

## 实际接口与版本

- `GET /api/me/review-workspace`：view、locale、persona、world、kind、status、q、sort、page；统一授权和查询范围，每页 20 条及完整 total/pages，单条聚合 SQL。
- `GET /api/me/review-workspace/entries`：当前可评价的公开条目，有界搜索及分页。选条目、选角色不写数据库；确认继续时复用现有 startReview 的唯一约束。
- `GET /api/me/review-workspace/:评价ID`：固定 P/A/B、独立写资格与本人历史，historyPage 每页 20 个历史版本并附当前 P/A/B，revision 可指定授权旧版；关联审核记录有界。上下文下架时仅保留本人允许的历史；世界或站点限制不绕过。
- `POST /api/me/review-workspace/save`：一个事务保存并可选送审，actor/requestId 幂等、baseRevisionId、预期有效提交、当前绑定和资料版本检查。结果包含固定 revisionId、savedAt、outcome 和替代版本；角色直接生效特例不用于评价。
- 当前 head 来自其他提供者私稿时，只给并发 token，不返回正文。当前写入者可获得不含正文的 submissionGuard；它只用于提交冲突校验，不授予历史阅读权。
- 旧 `/me/reviews`、`/me/replies`、`/moderation`、`/admin/contents` 使用同一有效提交约束。`replies/:id` 仍是评价 ID。旧后台读 A 的固定译文，发布/退回针对 A，保存 B 不改变 A。

## 012 迁移

`012_review_submissions.sql` 新增 contents 的 submitted_revision_id/submission_token、不可变 review_submissions/review_submission_locales、回复有效待审指针、review_save_commands 与查询索引。保留原 head、公开指针、历史正文及既有表；不改已应用的 001–011。

回填只采用最后一次明确且尚未处理的提交，不复活较早的遗留 submitted 状态。已有译文引用在迁移时冻结；无法恢复过去不存在的快照，不伪称历史时点重建。012 在隔离 schema 已验证 A/B 回填、重复 migrate 与原历史正文不变。

发布顺序：完成测试 → 停止开发服务写入 → 保留仅现用 public schema 的受限备份及历史聚合摘要 → 增量 migrate → 安装已验证产物 → 启动并复验。备份不提交仓库，不输出记录或凭据。迁移在事务中执行，失败整体回滚，不启动半完成产物。迁移后若启动失败，保留备份和原产物，以修复前进为优先；不擅自 reset 数据库，不覆盖发布后的新写入。

## 验证边界

本轮单元、API 与浏览器验收数据全部位于随机 `test_*` schema，结束清理；没有向现用账号写测试评价、回复、角色或笔记。构建使用 `/tmp/plotstay-reviews-b-build`，其 workspace 包链接指向该临时目录，避免与项目依赖重复加载。本轮已安装临时目录中验证通过的同一构建产物，保留旧散列资源，不更改 Nginx/systemd 配置。

截图目录 [screenshots](screenshots/)，浏览器交互记录见 [browser-evidence.json](browser-evidence.json)。物理手机及公网 Basic Auth 登录后交互必须分别标记，不能用本机 Chromium 替代。后端完整套件 106/106、完整 E2E 93/93；最后增补代码分别由评价数据 11/11、浏览器 8/8 复验，数字有重叠不相加。命令、通过／失败修复／未验证见逐项验收。

现用库仅执行已授权 012 结构与待审回填，14 张历史业务表原字段摘要和计数迁移前后相同；没有 seed/reset 或测试样例写入。备份与旧构建保留在受限 `/tmp/plotstay-reviews-pre012-backup/`，不纳入 Git。附件 SHA256 不变，HEAD 仍为 `4d6ffd4`，未 commit/push。
