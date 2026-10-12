# 接口、权限与数据交接

本文件是实施契约草案。“已有”来自源码盘点；“建议新增”尚未实现。WS-00／WS-08 由后端负责人冻结实际 schema 和错误码，不把示意当作已可调用 API。

## 并存期兼容前提

遵守[新旧后台并存](coexistence.md)：旧 account/admin 页面和原接口继续可用，新版独立入口；共享数据、domain 及审核规则。新增字段、双语项目 ID 和版本信息必须兼容旧客户端读写。新权限门槛覆盖旧写入／审核／恢复接口，不能让旧版成为绕过方式。角色审核等修复同时约束两套界面；发现旧客户端无法表达的新对象，明确提示并定向转到新版，不静默丢数据。只切换界面不等于回滚数据库。

## 1. 四种不同关系

| 关系 | 沿用／新增的表达 | 授予什么 |
| --- | --- | --- |
| 账号拥有 persona | 现有 persona 归属与资料版本 | 修改自己的角色、以获准角色发言 |
| 账号管理世界 | 现有 `worlds.owner_id`／`world_members` | 按 owner/admin/editor 既有边界管理世界内容 |
| 账号入驻世界 | 新的 account＋world 资格记录、申请与事件历史 | 创作该世界自己的三类作品，不编辑他人作品 |
| 作品的经营角色 | 现有 `provider_bindings` 等关联 | 对外署名及提供者回复资格，不自动改变作品编辑权 |

作品已有 `contents.author_id`，必须确认它在导入／管理员代建／历史数据中的语义。若可代表创作者归属则复用；否则新增明确归属记录并输出核对清单。**不能按 provider persona 的所属账号自动转移旧作品。** 本轮不增加作品协作或所有权转让产品。

第一阶段继续使用现有权限。第二阶段普通作者写入条件：账号有效、当前世界入驻有效、作品归本人、动作被状态允许；世界管理者走原管理能力；所有路径仍校验站点限制。私有读取范围单独设计，取消资格后本人仍能查看已保留稿件和历史。

UI 可读取服务端计算的 `capabilities`（如 `canEdit/canSubmit/canPublish/canReply/canReview`）和受限原因，不能只用角色名称判断业务。每次写请求重新检查；客户端缓存不作为授权。

## 2. 现有 API 复用清单

| 范围 | 已有接口 | 注意 |
| --- | --- | --- |
| 登录／退出／账号 | `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me` | Web 沿用应用会话 403＋错误码，避免 Basic Auth 重弹 |
| 角色 | `GET/POST /api/me/personas`、`PUT /api/me/personas/:id` | 独立送审和队列由 BUG-001 补齐 |
| 本人评价 | `GET/POST /api/me/reviews`、`GET/PUT /api/me/reviews/:id`、`POST .../:id/submit` | 历史署名、同角色同条目一篇保留 |
| 提供者收到的评价 | `GET /api/me/provider-reviews` | 第二阶段补经营资格限制 |
| 提供者回复 | `GET/PUT /api/me/replies/:id`、`POST .../:id/submit` | **id 当前是评价 ID**，不是未来讨论消息 ID；不得重解释旧链接 |
| 发言审核 | `/api/moderation/reviews`、`/reviews/:id`、`/replies/:id` | 复用实际动作 schema，世界／网站边界不变 |
| 角色审核／可用性 | `POST /api/moderation/personas/:id`、`POST .../:id/availability` | BUG-001 覆盖版本审核与所有旧入口 |
| 提供者绑定 | `GET/PUT /api/moderation/providers/:id` | 保留本人角色／站点管理员的现有可选范围 |
| 世界内容管理 | `GET /api/admin/worlds`、`GET /api/admin/worlds/:worldId/contents`、`GET /api/admin/contents/:id` | 不能直接开放世界范围接口给入驻作者 |
| 创建／保存／送审／审核 | `POST /api/admin/contents`、`/:id/revisions`、`/:id/submit`、`/:id/review` | 沿用基础版本和草稿 token；作者入口共享 domain 规则 |
| 私有预览 | `GET /api/admin/contents/:id/preview`；Web `/api/admin/preview/{locale}/{id}` | 会话、版本及 token 检查；第二阶段增加作者预览授权 |
| 历史公开控制 | `POST /api/admin/contents/:id/restore`、`/unpublish`、`/release-site-block` | 新门槛覆盖相关发布路径，解除限制不自动发布 |
| 共享资料／世界首页 | `/api/admin/settings/:id`、`/api/admin/worlds/:worldId/settings`、`/home` 等 | 独立版本与权限，重排不放宽 |
| 导入、翻译、账号创建 | `/api/admin/imports/{preview,apply}`、翻译更新／任务重试、`POST /api/admin/accounts` | 保留原流程，界面重排不删除 API |

精确方法、字段与动作枚举见 `apps/api/src/app.ts` 和 `persona-routes.ts`；此表不替代现有 Zod schema。

## 3. 建议新增的最小接口面

路径为提案，后端负责人可以调整命名，但须统一后再并行实施。

| 建议接口 | 用途 | 阶段 |
| --- | --- | --- |
| `POST /api/me/personas/:id/submit`；独立 persona 审核列表／详情 | BUG-001 当前申请及替代 | 一 |
| `GET /api/me/workspace`（确有聚合需要时） | 本人待办、最近稿件和能力，不做假未读数；可先组合已有接口 | 一 |
| `GET/POST /api/me/works`、`GET /:id`、`POST /:id/revisions`、`POST /:id/submit` | 本人作品列表、作者写入 | 二 |
| 作者私有预览入口或现有预览授权扩展 | 同一 renderer，包含私有世界上下文 | 二 |
| `/api/me/admissions`、申请创建／撤回／历史 | 账号＋世界申请及资格 | 二 |
| `/api/me/invitations/:id/accept`；世界邀请创建／撤销 | 已有账号接受邀请，细节待确认 | 二 |
| 世界入驻队列／详情／决定／取消资格 | 本世界管理员审核固定申请 | 二 |
| `/api/me/worlds`、世界草稿保存／提交 | 创建者、设定草稿和待审版本 | 二 |
| 网站世界审核队列／详情／决定 | 首次公开及选定资料更新审核 | 二 |

创建／提交／决定返回实体 ID、实际版本、当前申请、公开版本、可执行动作及必要提示。分页包含稳定排序。审核决定必须携带申请 ID 与预期版本，不能用“批准最新稿”代替固定对象。

错误类别区分：无会话、无权限、版本冲突、申请被替代、世界未公开、资格变更、站点限制、字段不合法。优先沿用已有错误码，新增码在共享契约登记。返回足够恢复操作的信息，不泄露无权对象；前端保留输入，恢复会话后核对基线再重试。

## 4. 数据与状态提案

- **入驻资格**：账号＋世界唯一；资格与申请分开表达，避免重申覆盖已有资格。申请存固定提交内容、审核者和原因；事件保留邀请、批准、拒绝、取消与重申。
- **世界审核**：沿用 worlds 身份、所有者和公开读取字段；追加不可变设定版本、当前草稿／申请／批准指针及事件。新草稿初始 `visible=false`；批准后事务更新公开投影。站点封禁字段不能充当审核状态。
- **已有世界**：保持可见性及限制；迁移登记既有批准资料，不能全量改回待审。旧成员不自动失去权限。
- **旧作品／回复者**：输出归属和资格衔接报告；有明确历史授权者采用可审计兼容资格方案。不能一上线就因没有入驻记录锁死合法旧提供者，也不能为所有绑定角色自动授予作品所有权。WS-08 审阅映射并保留异常清单。
- **旧历史**：不改写已发布内容版本、署名、审核事件或凭条；双语列表稳定 ID 在新草稿通过兼容映射接入。迁移顺序号以实际分支为准，不预占已有编号。
- **事务竞争**：资格取消与作者提交／审核发布必须在一致锁策略内核对；取消后旧请求不能放行。世界公开、站点封禁与历史恢复同理。

入驻申请可抽象为 `pending → approved/rejected/withdrawn`，资格为 `active/revoked`；重申是新申请，旧事件不可改写。世界申请与草稿分开，不能用一个 status 同时表达已公开和有待审修改。实际枚举以 D01–D03 和冻结后的契约为准。

## 5. 多轮回复的扩展边界

本轮继续一篇评价对应一条提供者回复，公开返回和展示保持不变。不新增多轮写入 API，不提前放开唯一约束。

1. 客户端／domain 适配层避免将回复永久限制为一个不可扩展文本槽。保留当前单条 DTO，记录未来集合 DTO 的适配位置。
2. 未来集合建议包含 `id/reviewId/parentReplyId?/authorPersonaId/authorAccountId/authorRole/revisionId/signatureSnapshot/status/createdAt`，分页读取。是否嵌套、多深、编辑删除规则另定。
3. 父回复属于同一评价；每条独立鉴权、审核、保存署名快照。经营者回复和游客回复分别校验，不只检查是否登录。
4. 未来将旧回复映射为集合中的一条消息，保留 ID、版本及署名映射；旧单条接口继续适配，前台升级另行授权。

本轮“预留接口”交付是明确的扩展契约和适配位置，不提前实现聊天系统。
