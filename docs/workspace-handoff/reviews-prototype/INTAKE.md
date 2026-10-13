# 阶段 A 只读盘点与共享责任

归档更新：用户确认重排后的预览「基本正确」，授权提交并推送阶段 A 成果。下文 HEAD、未提交及待验收表述为开工与各次交付时的历史记录；归档提交以 Git 历史为准。本次没有启动阶段 B。

日期：2026-10-13。附件位于 `/data/apps/plotstay/plotstay-reviews-development-handoff-2026-10-13.zip`，已直接阅读 START-HERE、开发交接、验收清单、decisions 原方案与讨论记录；四张参考图已逐张查看。包内 MANIFEST 全部核验通过，图像只解出到 `/tmp/plotstay-reviews-reference`，没有改动原附件。仓库用户列出的 AGENTS、operations、development-status、工作台 README、阶段一记录、角色实施／review 修复、首页布局／数据契约及旧评价方案均已阅读，沿实际源码核对。

## 1. 真实基线

- 分支 `main`；开工与交付 HEAD 均为 `4383ffe48ad8d0adf3517009daaf249d1f509cbc`。
- `gh api repos/x1ngwu/plotstay/commits/main` 只读核对远端 main 同 SHA；没有 fetch/pull/merge、分支切换或回滚。
- 开工无 tracked／staged 差异，仅三个 untracked ZIP：`example_pages.zip`、`reviews_page.zip`、本次 handoff ZIP。
- 近期历史：`4383ffe` 冲突比较后 dirty 修复 → `f684b0d` 异步竞态保护 → `4aa911f` 角色真实接入及私有笔记 → `9f42a6b` 角色预览归档 → `f494b1c` 首页列表排版。旧文档的未提交说明是历史记录，不等同当前 Git 状态。
- 没有通过 reset/clean/stash/checkout 整理工作区，没有读取 `.env`、密码、哈希、密钥或敏感日志，没有查询现用数据库。角色 session 是否仍在工作无法仅靠 Git 判断，因此共享业务文件不修改；后续经用户明确授权的预览 Nginx 追加见第 4 节。

原附件 SHA-256（开工与交付复核相同）：

| 文件 | SHA-256 |
| --- | --- |
| example_pages.zip | `2338ebbf7ead485b3842e0d8eb3204da83dfd52c4eb8994c85c2daa232b72d26` |
| reviews_page.zip | `7ffab296548e7b81dc51c3d091efadd54b20f23bb4804b210c7250d0adef5973` |
| plotstay-reviews-development-handoff-2026-10-13.zip | `5de865555a0275d66d28330c922965f93eeec98b296e5956aa9d1dc17ad051a2` |

## 2. 当前数据来源与入口

| 层 | 真实位置与作用 |
| --- | --- |
| 工作台壳 | `apps/web/src/pages/[locale]/workspace.astro` 已有 reviews／replies 独立侧栏、管理分组和唯一页标题；`workspace.ts` 处理标题、选中、返回、手机菜单及历史；`WorkspaceLayout.astro` 和 workspace 样式提供壳。角色控制器已有独立启用与离开保护，不能重复初始化 |
| 旧／新页面共用客户端 | `apps/web/src/lib/persona-client.ts` 的 reviews、editReview、providerReviews、editReply、moderate／moderateReply。旧账户与新版评价目前仍走该文件；新版角色已转向 `workspace-personas.ts` |
| 本人列表／详情 | `GET /api/me/reviews` → `myReviews`；`GET /api/me/reviews/:id` → `reviewDetail`。列表读取 `contents` 的 author、persona、head，再联 `content_revisions`、`review_signatures`、parent/world slug；按 head 创建时间分页 20 条。详情按作者鉴权，返回全版本、译文、审核事件、发布历史 |
| 本人开始／保存／提交 | POST reviews → `startReview`；PUT reviews/:id → `saveReview`；POST submit → `submitReview`。同 persona／parent 查旧记录，唯一索引由 008 提供。草稿存 `content_revisions`、`revision_locales`／translations；署名快照存 `review_signatures` |
| 提供者列表 | `GET /api/me/provider-reviews` → `providerInbox`，由 `provider_bindings` 联 persona owner 和已发布评价，读取 parent/world slug、评价 source title、reply_id；按评价创建时间 LIMIT 21，没有完整回复状态／最近有权事件 |
| 提供者详情／保存 | `GET /api/me/replies/:id` → `replyDetail`；PUT → `saveReply`；submit／moderation → `replyAction`。**id 始终是评价 ID**。`review_replies` 是一评价一回复实体；`reply_revisions` 保存作者、persona、资料版本、署名、正文与源语言；reply_events／reply_publications 保存事件与发布 |
| 当前回复资格 | `providerAccess` 要求当前绑定 persona owner、未停用、评价公开可见；保存时锁父条目再次核验绑定，提交还校验版本的 persona 和 created_by。世界管理能力不替代此资格 |
| 评价审核／发布 | `apps/api/src/persona-routes.ts` 与 admin content 路由 → `packages/domain/src/content.ts` 的 submitRevision／reviewRevision／restorePublication。`reviewRevision` 同时检查 head、draft_token、submitted 状态，再调用 `validateReviewPublication` 核对固定署名、角色审批、父条目与双语。发布复制 publication_locales 并更新公开指针，不应通过回退 head 解决 A/B |
| 角色资料／笔记 | `persona-routes.ts` 共文件还有 `/me/personas/save` 与 notes GET/PUT；domain 同文件含角色事务、幂等及私人笔记用例。仅参照已完成的固定版本事务设计，不借用其免审特例；本预览不读取或实现笔记 |
| 首页／旧深链接 | `workspace-bootstrap.js` 预取并复用初始 auth/list，写后清理；`workspace-revision.ts` 保护指定历史版本；domain `workspace.ts` 聚合真实事项并形成 review/reply/revision/replyEvent 深链接。后续需一起适配有效提交，不能只换列表 |

## 3. 已确认需求与代码的实质差距

| 差距 | 证据及阶段 B 所需工作 |
| --- | --- |
| 完整列表 DTO | myReviews 不含世界／条目双语显示名、公开正文／回复摘要、复合状态、可靠最近事件及能力；providerInbox 更只有粗略 reply_id。新增有界聚合查询，权限与来源过滤必须先于搜索／计数／排序／分页，禁止逐卡历史查询。明确缺译回退及受限上下文 |
| 旧手记来源 | myReviews 按 `kind=review AND author_id`，没有 managed 来源过滤；不能凭 persona_id 或名字剥离。核对签名 managed 和原始创建／权限证据，个人列表排除旧后台手记，但不删数据，不禁掉收到的合法旧手记回复 |
| C12 评价 P/A/B | 保存 appendRevision 更新 head 和 draft_token；submitReview 只将当前 revision.status 改为 submitted；reviewRevision 要求目标仍是 head。保存 B 后不能正常审 A。需有效提交指针／档案、固定 A 的译文／署名／审核令牌设计；A 批准仅更新 public，不清 B。旧审核、管理写入、恢复和首页也必须一致 |
| C12 回复 P/A/B | review_replies 当前仅 head/published/hidden；replyAction 对所有动作先要求 revision=head，队列亦跟随 head。需回复独立当前提交及不可变提交历史；提交 B 明确替代仍有效 A，旧 A 请求拒绝，退回意见归 A |
| 组合完成／幂等 | saveReview／submitReview 与 saveReply／replyAction 是分开的事务；页面按钮也是先保存、再提交。新增最小组合用例，以 actor、实体、base revision、expected submission、requestId、绑定及署名版本核验，重复请求恢复同一结果；不同负载同 ID 冲突。不能串两个请求假称原子保存提交 |
| C13 原提供者历史 | replyDetail 先 providerAccess，旧提供者绑定结束后不可读；通过资格后 SQL 按 reply_id 返回全 revisions，缺少历史作者私稿过滤。需按 created_by／签名证明本人历史，和当前绑定写资格分开；旧／新提供者不得互读私稿，同账号换 persona 也不能冒旧身份提交 |
| C13 上下文隔离 | reviewDetail 非审核分支只检查作者，不足以直接当新历史 DTO 的所有区域授权。世界／站点／父条目／他人公开发言／本人历史分别核验。当前 head 是他人私稿时，设计不返回正文的合法写入基准，而不是先把别人稿件发给新提供者 |
| 搜索／动态事件 | 现有列表主要是创建时间；需明确 publication、本人保存／提交／审核结果等事件类型、时间、关联固定版本。外部未公开草稿、浏览、改名不参与；“需要处理优先”是排序，不做已读或催办系统 |
| 后台新写入口 | 旧客户端起点依赖 parentId；需给普通用户有界搜索当前可评价的公开三类条目，不能借用世界管理全量列表。选条目不写垃圾草稿，已有评价继续原 ID，多标签页唯一性由后端保证 |
| 兼容与字段 | 保留旧 `/account`、`/admin`、现有 `replies/:评价ID`、revision／replyEvent；保留原评分、源语言、翻译、署名和公开规则。新控制器接入时避免旧客户端同时渲染，维持 bootstrap 请求复用和写后失效 |

这些是代码盘点结果，不是对现用数据的审计结论。未读取真实业务行，没有用合成样例声称修复了现用权限。

建议下一阶段 DTO 概念：评价稳定 ID、允许的 world/entry 显示上下文、reviewer signature／current provider／historical relation、公开／提交／本人草稿各自的版本及时间、明确摘要所属版本、latestActivity 类型与固定目标、canRead/canEdit/canSubmit/canReply 与原因、有界 total/page。具体路径和 schema 需阶段 B 冻结，不把本预览 fixture 字段直接当契约。

建议最低隔离测试：P→A→B 的保存／提交／批准／退回与乱序旧请求；幂等重试与丢响应；原／新提供者跨账号及同账号换 persona；head 恰为他人私稿；世界／站点限制；旧写入与管理审核／恢复；单语草稿、字段保留、签名、评分及来源；超过两页的权限过滤／计数／排序；旧深链接、会话与角色竞态回归。后端／数据库未执行任何验证。

## 4. 文件责任与共享冲突

| 路径 | 本轮动作／必要性 | 另一 session 状态／建议负责方 |
| --- | --- | --- |
| `docs/workspace-handoff/reviews-prototype/index.html`、`app.js`、`data.js`、`style.css` | 新增独立 UI、内存数据和局部样式 | 本次评价阶段 A 独占新目录 |
| 本目录 `workspace-shell.css` | 当前 workspace.css 的只读完整快照；离线包不依赖正式应用资源 | 源文件没有修改；B 接入应导入正式壳，不能把快照覆盖回去 |
| 本目录 serve／verify、screenshots／verification、README／INTAKE／gallery | 本机服务、浏览器证据、盘点与验收入口 | 本次评价阶段 A 独占；没有改共享 package.json |
| workspace.astro、workspace.ts、WorkspaceLayout.astro | 只读；B 才做最小模块接线、标题／返回协调 | 当前角色成果在 4383ffe，未发现 tracked 本地差异；唯一壳修改方仍待 B 开工协调，不声称已获另一 session 同意 |
| workspace-personas.ts／css | 只读，不改角色业务和私有笔记 | 保留角色 session 负责，不复制其控制器 |
| persona-client.ts | 只读；B 保留旧模式，关闭新页面重复初始化，审核兼容 | 接入负责人单点修改；不让壳和后端 session 同时整文件覆盖 |
| persona-routes.ts、persona-reviews.ts | 只读；B 仅新增评价／回复聚合、提交与历史用例相关段落 | 与角色／笔记共文件，需后端唯一修改方按函数边界提交，保留角色保存与笔记隔离 |
| content.ts、审核调用方、workspace 聚合、bootstrap/revision | 只读；B 按固定提交兼容链路最小调整 | 后端／前端适配负责人约定后再改，不能改坏其他三类内容工作流 |
| contracts、migrations | 无变更 | B 冻结最小契约后按当时目录分配编号；011 已存在，不预占号、不改已应用迁移 |
| docs/development-status.md、正式 backlog、工作台 README | 无变更，避免共享文档冲突 | 评价验收后由文档单点追加准确状态与 LT-REV-01，不覆盖角色记录 |

本地交付时 tracked 文件差异为空。用户随后要求复用既有线上交互预览方式，并明确授权安装新增静态路径和 reload Nginx；现已在 `deploy/nginx/plotstay.xingwu.dev.conf` 追加 `/_design/reviews/` alias。安装前只读比较确认线上配置与 HEAD 原版完全一致，未覆盖另一 session 的配置差异；既有 personas／overview 路径及公共保护原样保留。配置检查与 reload 成功，15 项公网保护检查通过。其余 tracked 文件仍无差异，本目录之外只有原先三个 ZIP 未跟踪。正式业务共享文件的归属仍待阶段 B 协调。

## 5. 长期 TODO 与阶段门槛

LT-REV-01「未查看更新提醒」只登记未来工作：账号对可见具体版本的阅读记录、跨设备与权限过滤、首页一致性另行设计。本轮没有通知、未读数字、红点、邮件或推送。

阶段 A 验收不等于 C12/C13 后端通过。等用户明确确认可点击预览，再重查 HEAD／远端／status，协调上述共享文件，建立隔离行为测试，实施最小接口／版本／权限变更。正式应用构建、迁移与部署属于获准后的阶段 B，本轮均未执行。

## 6. 用户拒绝首版后的结构返工

首版 UI 没有通过用户验收。已按四张参考图重排列表和详情，完整偏差、文件范围与验证见 [LAYOUT-REVISION.md](LAYOUT-REVISION.md)。本轮继续只修改独立预览目录；沿用现有受保护静态 alias，无新增 Nginx 配置修改或 reload，未进入阶段 B。原 ZIP 校验值与第 1 节一致。
