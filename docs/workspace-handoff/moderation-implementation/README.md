# 审核工作台真实接入 · 2026-10-16

> 2026-10-18更新：用户已明确授权部署，`216d64c`构建已更新开发域名，44项部署只读检查通过。下文未部署为历史状态；实现随后已按用户授权合并main；当前产物、源码分支及回退步骤见[部署记录](deployment-20261018/README.md)。

用户已通过 `/_design/moderation/` 效果稿，随后按此前开发授权完成真实接入。应用尚未部署；用户于2026-10-16授权提交推送本隔离分支的实现与修复。提交标识以Git历史为准，先前记录中的未提交状态为验收时状态。开发域名仍运行原应用和已获准托管的静态效果稿。

实现位于隔离 worktree `/tmp/plotstay-moderation-dev`，分支 `codex/moderation-20261016`，基线 `4d7d72c95b11e7833e0757431a8012e9bc4643bb`。主工作区的静态预览、Nginx、operations、development-status 和其他会话的未跟踪文件均保留。未经后续授权，不把本实现发布到现用服务。

2026-10-16 code review 的三项问题已修复：连续导航循环加载、评价公开字段缺失、已退回版本被草稿替代展示。最新16项后端与14组真实浏览器回归通过，check／构建通过；修复范围、失败复验和截图见 [验收记录](acceptance.md#2026-10-16-code-review-修复)。

## 实现范围

| 类型 | 实现 | 主要文件 |
| --- | --- | --- |
| UI | 两个真实 WorkspaceLayout 入口：评价／回复独立队列与详情；网站管理的资料、普通账号、提供者绑定三个独立栏目；中英文、手机、独立分页、筛选与返回位置 | `apps/web/src/lib/{workspace-moderation,moderation-view}.ts`、`styles/workspace-moderation.css`、`pages/[locale]/workspace.astro` |
| 查询 | 先按网站管理员、world owner_id 或 owner/admin 成员授权，再搜索、计数、稳定排序与分页；每页20，回复路由对象仍是评价 ID；资料队列不再混入评价列表 | `packages/domain/src/moderation-workspace.ts`、`apps/api/src/moderation-workspace-routes.ts` |
| 权限修正 | 世界编辑者读取他人个人评价时只能获得可公开的 P 快照，不能读取 A/B、私有译文、草稿 token、历史或预览；搜索和共享资料关联也过滤。作者、合法审核者及旧编辑型手记协作保留 | `review-privacy.ts`、`read.ts`、`detail.ts`、`settings.ts` |
| 审核保护 | 联合批准显式携带固定资料 ID，在同一事务批准 R 并发布 A；普通发布不再隐式批准资料。送审、公开指针和权限变化拒绝过时请求。旧 `/account`、`/admin` 增加相同确认语义 | `content.ts`、`persona-reviews.ts`、`contracts/src/base.ts`、旧客户端 |
| 账号／绑定 | 普通账号创建和精确请求结果核对；只沿用邮箱、初始密码，无角色／权限自动分配。绑定沿用世界管理权、本人所有权、本人已保存且启用角色、永久锁及资格规则 | 新 API 与原 `work-access.ts` 领域服务 |

没有新增迁移；沿用已有 001–014 结构、固定版本、公开历史、绑定锁与资格记录。没有新增通知、批量批准、账号管理、公开审批或邀请机制。世界管理的名称、顺序和 UI 未重做。

## 契约与交互

全部新接口位于 `/api/moderation-workspace/`，继承应用会话、Origin 检查、no-store/noindex；不增加公开代理路径。写请求必须携带当前账号的 `X-Plotstay-Actor`。站点资料和账号动作逐请求校验网站管理员；绑定接口仍允许原有合法世界管理身份，不因网站管理入口仅管理员可见而删去权限。

- `GET scopes`、`GET queue`：可审核世界及真实计数；queue 参数为 kind/world/status/enabled/q/page/locale。返回总数、合法页码、pageSize 和独立待审数。
- `GET/POST records/{reviews|replies}/{reviewId}`：读取 A/P/B、各版固定署名、公开原评价上下文和历史；写入同时校验送审版本／token或资格epoch、当前公开指针与隐藏状态。
- `GET/POST profiles/{revisionId}`：固定申请与已批准资料比较；审批仅针对固定申请，不自动发布关联发言。`POST personas/{id}/availability` 独立控制启用状态，保留历史公开内容。
- `GET providers/{worldId}`、`PUT providers/{contentId}`：所有者、当前提供者、可修改原因、本人候选；保存比较旧提供者与 draft token，再复用原事务内绑定服务。首次成功送审／发布后的锁不解除。
- `POST accounts`：邮箱、初始密码和浏览器生成的请求 UUID；该 UUID 用作新用户 ID。对同一请求加事务锁，重试不二次改密码。`GET accounts/{requestId}?email=…` 只核对该次精确结果，不提供账号列表。密码不出现在响应、URL、storage 或错误日志中。

`approvePersonaRevisionId` 是明确联合批准意图，不是“允许服务器自行选择最新资料”。旧客户端也必须先展示影响并确认该 ID。资料已被另一管理员处理、被替代或发言已处理时提示重新核对；失败事务不会留下新的一半审批结果。

审核说明只在当前文档内存保存，按账号／对象／固定版本区分。切内容语言、界面语言及资料往返保留；申请被替代时单独展示旧说明，用户核对后才能带入新版本。离开有保护。账号或权限变化重新校验，旧请求不能覆盖当前对象。写入超时先核对服务器结果，未知状态不盲目重复提交；账号用精确请求 ID 核对，不用“邮箱已存在”冒充成功。

## 隔离验证

测试专用 PostgreSQL 18 容器 `plotstay-moderation-isolated-20261016`，仅绑定随机 loopback 端口，数据目录为 tmpfs，没有现用 volume。每个测试在该库中新建随机 schema，执行已有迁移／种子后清理自己的 schema。未读取现用 `.env`，未连接现用数据库，没有现用 migrate/setup/seed/reset。

`run-isolated.mjs` 从 `/tmp/plotstay-moderation-isolation/` 的私有配置读取连接，强制 `DOTENV_CONFIG_PATH=/dev/null`、临时库名和测试文件白名单，不输出连接串。依赖软链指向现有安装，但 `@plotstay/*` 指向本 worktree。构建输出只写 `/tmp/plotstay-moderation-isolation/build`；浏览器服务使用随机本机端口、测试 schema 和禁止索引设置，结束时关闭。

```bash
DOTENV_CONFIG_PATH=/dev/null node docs/workspace-handoff/moderation-implementation/build-isolated.mjs
node docs/workspace-handoff/moderation-implementation/run-isolated.mjs tests/moderation-workspace.test.ts
node docs/workspace-handoff/moderation-implementation/run-isolated.mjs tests/moderation-workspace-e2e.test.ts
```

实际检查结果、截图和覆盖关系见 [acceptance.md](acceptance.md)。所有截图使用合成身份及真实隔离 API，没有生产数据。此前的静态原型验证不计入本轮真实业务测试。

## 发布边界与兼容影响

只批准资料仍是独立操作；角色启停不是账号封禁，也不自动隐藏旧发言。网站管理员仍无法读取他人私人角色笔记。普通账号创建不授予管理权、不创建角色。绑定保存不改变所有权、历史署名和旧凭条。

唯一有意收紧的旧行为：个人评价私稿不再对世界 editor 开放；资料未批准时旧普通发布不会隐式变成联合批准，需要使用明确确认的联合动作。旧合法后台与作者流程保留。现用数据无需修复或迁移；生产合并／构建／重启仍需遵守本轮“暂不部署”的明确限制。
