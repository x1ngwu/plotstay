# 评价阶段 B：实际接入契约

2026-10-13 开工：main / origin main 为 `4d6ffd48b8cb0f298769e574bac3b253b34251eb`。tracked 工作区干净，仅 `example_pages.zip` 未跟踪。已读取角色 session 的 `4383ffe`、`f684b0d` 输入保护修复；没有另一 session 的未提交共享改动，也没有声称取得其他 session 的口头同意。本次由评价 session 单点修改下列共享函数，编辑前后核对差异。附件不变，不自动提交。

## 最小范围

- 保留 contents/content_revisions/review_signatures 及 review_replies/reply_revisions。`managed=true` 是个人角色评价；`managed=false` 是旧后台手记。我的评价仅前者，收到的评价允许合法公开旧手记。
- 新增 `012_review_submissions.sql`：评价与回复有效待审指针；评价固定送审 token 和译文引用；命令幂等记录；查询索引。仅回填有明确提交事件且仍未处理的有效版本，保留原历史行、head、公开指针；不重用 011，不 seed/reset。
- 新列表 DTO：稳定评价 ID、允许的世界/条目双语名称和类型、固定评价者署名、当前提供者及本人历史关系、公开/有效待审/本人草稿独立版本、摘要、最近可见事件、当前操作和原因、完整 total/page。权限、来源、角色/世界/状态/类型/搜索、最近动态或需要处理优先均在分页之前处理。分页不逐卡查询历史。
- 新详情 DTO：原文与公开回复、本人可读历史、固定 P/A/B、当前写资格、baseRevisionId（可为不含他人正文的并发基准）、预期提交、当前提供者/署名版本。对象深链接优先于列表记忆。
- 新增 `/api/me/review-workspace` 列表、`/:id` 详情、`/entries` 公开条目选择与 `/save` 组合用例；旧 replies/:id 始终是评价 ID。旧入口继续鉴权并使用同一有效提交规则。
- 保存命令携带 requestId、kind、reviewId、baseRevisionId、expectedSubmittedRevisionId、expectedPersonaId、expectedPersonaRevisionId、action、body。在一个事务中保存固定版本并可选送审；相同账号/requestId/负载返回原结果，不同负载冲突；失败整体回滚。草稿不改 A，提交明确替换 A；资料签名失效不静默换身份。
- 历史读取与写资格分别判断：回复历史只返回本人创作版本和合法公开版本；历史身份不授写权。当前绑定、角色停用、世界/站点/条目/评价可见性每次重查；世界/站点限制下不返回他人或上下文隐藏数据。下架但未受世界/站点封锁的本人历史仍保留列表入口，隐藏上下文名称和他人正文；当前绑定但从未写过回复的人不因此获得下架历史。新提供者不获得旧作者私稿。同账号换角色也必须重新保存当前署名。
- 最近动态只取本人可读保存/提交/审核事件及对方公开发布/恢复；对方私稿、改名、浏览不排序。LT-REV-01 仍为长期 TODO。

## 共享文件责任

| 文件 | 最小修改 |
| --- | --- |
| persona-reviews.ts | 仅评价/回复保存、送审、详情授权与审核查询；角色及笔记函数保持 |
| content.ts | review 类型固定 A 审核、恢复验证；其他内容继续原 head/token 规则 |
| domain/workspace.ts | 首页评价/回复待审来源改为有效提交，保持其他来源 |
| API app.ts / persona-routes.ts | 新模块注册，旧契约兼容所需字段 |
| workspace.astro / workspace.ts / persona-client.ts | 单一壳接入独立评价控制器；旧审核选择 A；不覆盖角色控制器 |
| 新 review-workspace 领域/路由/前端/样式 | 本 session 独占，沿用已验收预览结构 |
| 文档/测试/package.json | 追加测试、逐项证据与进度，不覆盖角色记录 |

## 迁移与发布次序

先在随机隔离 schema 验证迁移与 P/A/B、幂等、权限及旧接口，再构建真实服务测试。012 为向前兼容的新增结构，不删除旧列；发布前检查实际迁移目录、备份可用性并执行增量迁移，随后重启已通过验证的构建。出现失败不 reset 或重写历史；保留原服务/数据并报告。现用库仅允许必要迁移，不写验收样例。

本文件是冻结的实施契约，不是测试通过证明；实际结果另记验收记录。
