# 本轮实际接口与权限契约

阶段 B，2026-10-15。以下是隔离环境已实现的接口，不代表现用环境已提供。产品确认来源见 [contract.md](contract.md)。

## 账号、经营与所有权

- `work_ownership` 是本轮新作品的账号所有权证据，由首次保存事务写入当前会话账号；客户端不能指定 owner。管理员编辑不转移所有权。
- `world_participations` 记录加入；`work_eligibilities` 记录经营批准/撤销及 epoch。它们不授予 `world_members` 的 editor/admin 权限。
- 世界 owner/admin、网站 admin 可调用最小记录命令。先加入才可批准。没有申请、邀请或创建世界流程，也没有新增管理页面。
- 从未取得经营资格的普通账号可在允许的世界准备本人草稿；已撤销者不能退回“从未取得”的宽松状态。正式提交、发布、恢复重新检查当前账号、世界、作品、批准身份和经营资格。
- `provider_bindings` 是当前经营身份唯一依据；原 `persona_id` 保持不可变历史字段。首次成功送审或发布写入不可逆锁，旧管理接口、重新保存、历史恢复均不能解锁。失败事务不留锁。
- 已锁角色停用后可保存正文草稿，不能提交/发布/回复；经营资格撤销优先阻止保存。人工翻译和重试受同一写权限约束；迟到机器译文在撤销/限制后不再写入作品。
- 三类作品仍采用 head + draft token；新 head 取代旧送审的当前位置。资格 epoch 变化使旧送审失效，重新批准不会自动复活，必须明确重新提交。没有移植评价页 A/B 模型。

## HTTP

所有接口使用既有 Cookie 会话和 Origin 检查。作者写请求额外带 `X-Plotstay-Actor: <打开表单时的账号 UUID>`；它仅用于检测账号切换，不能授予权限。Web 代理转发该头。浏览器侧会话错误仍为 403 + `SESSION_REQUIRED`，避免触发 Basic Auth 重新认证。

| 方法和路径 | 输入 | 返回及限制 |
| --- | --- | --- |
| GET `/api/me/works` | `scope=mine\|managed`, `world`, `persona`, `kind=stay\|service\|experience`, `q` ≤200 字符, `visibility=public,private`, `state`, `page`, `locale` | 权限过滤后筛选、计数、稳定排序和 25 条分页；`items,total,pages,page,pageSize,facets,options,canManage,actorId`。不含预览 token 或全量正文 |
| GET `/api/me/works/filter-options` | `scope` | 整个授权范围的世界与经营角色显示名，不从某一页提取，不包含私有笔记 |
| GET `/api/me/works/create-options` | 无 | 可准备第一件作品的世界；本人已保存、未停用的角色，可未批准；显示名及批准状态、世界资格 |
| GET `/api/me/works/editor-options` | `world`, 可选 `content` | 具体世界的地点/公开类别和本人可选角色；已有作品另附当前绑定显示，不开放全世界私稿 |
| GET `/api/me/works/:id` | 内容 ID | 本人或已有管理权限的具体作品、版本历史、公开历史、审计、当前绑定和永久锁、送审是否失效。API 使用一致的只读事务快照；作者不能读取他人作品 |
| POST `/api/me/works/save` | 见下 | 首次创建或追加草稿，事务与幂等；返回 `id,revisionId,number,draftToken` |
| POST `/api/me/works/:id/translation-jobs/:jobId/retry` | 空 JSON + 账号头 | 仅该作品的当前可编辑版本；不开放世界任务；详情只含任务状态，不返回模型配置/内部错误 |
| POST `/api/me/works/:id/submit` | `revisionId,draftToken` | 当前 head/token 与当前资格一致才送审 |
| GET `/api/me/works/:id/preview` | `revisionId,token,locale` | 仅指定作品的当前已保存 head + token；过期返回冲突，不转公开页 |
| GET `/api/me/work-preview/:lang/:id`（Web） | 同上；可选安全 `returnTo` | 复用真实公开模板，显式保存版预览，不可预订；private/no-store、noindex/nofollow/noarchive |
| POST `/api/moderation/worlds/:worldId/operating-access/:userId` | `action=join\|leave\|approve\|revoke` | 仅世界 owner/admin 或网站 admin；审批前必须已加入；留不可变事件 |

保存请求：

```text
首次：{requestId, providerId, draft: 既有 createContentSchema}
再次：{requestId, contentId, providerId, expectedProviderId,
       draft: {baseRevisionId, baseDraftToken, ...既有 editContentSchema}}
```

首次的 providerId 为唯一生效绑定参数，领域命令将其与当前账号一起核验。内容、首版、翻译引用/任务、账号归属、绑定与幂等结果在一个事务中提交。幂等按账号 + 请求 ID，负载按递归键排序比较语义；同键不同负载 409，同键同负载返回原结果。后续保存同时验证 head、draft token 和预期经营身份。编辑器保留提交快照以外的新输入。

列表总数与 facets 都来自数据库授权 CTE；facets 应用除类型以外的同一筛选。排序为当前 head 创建时间、当前人工译文保存时间、纯草稿改绑时间中的最新值，倒序后以 ID 稳定排序。机器翻译、浏览、审核、角色改名不提升排序。候选接口返回授权范围的名称元数据，没有任意 500 条截断；规模较大时可后续增加远端候选搜索，不能改为截断。

## 旧入口兼容与必要共享改动

旧创建/导入必须显式填写本人保存且未停用角色 `personaId`，领域层将其作为初始正式绑定；缺失逐项报错，不自动拿管理员或第一个角色。旧管理编辑/人工翻译/提交/发布/恢复共用权限校验；旧改绑入口共用永久锁。旧 `/admin`、`/account`、世界内容/审核/工具和深链接保留。

现有编辑器只增加作者接口选择、创建参数、经营身份与锁定提示、保存/预览/返回衔接。私有预览使用现有 DetailBody；公开页没有新增后台脚本或样式。公开经营显示名改为读取正式绑定，评价署名规则保留。回复权限增加撤销资格检查；角色页只补从新建页返回的安全上下文。新页 CSS 限于 `#workspace-works` 和 `#new-workspace[data-works]`。

历史归属与缺失/冲突绑定没有自动修复。没有所有权证据的存量作品在管理范围显示待核对，写入受阻；本人列表不将它们猜作管理员作品。迁移/部署前必须解决对应审计授权和人工映射，见 [migration-plan.md](migration-plan.md)。
