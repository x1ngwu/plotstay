# 首页数据契约与隔离测试准备

日期：2026-10-12；代码核对基线：`574fda8`（应用实现为 `8d66a07`）。

状态：用户已确认紧凑排版、范围页签及按账号＋浏览器保存常用世界，真实查询与接口已接入。沿用已有业务权限，无数据库结构变更。下文保留来源盘点和先前提案；最终接口以本节及源码为准。

### 最终接口

- `GET /api/me/workspace?locale=zh-CN|en`：一次有界摘要；attention 最多 6 项，continue 每范围／组最多 2 项，progress 最多 5 项。所有过滤、排序及完整计数在 SQL 截取前完成。
- `GET /api/me/workspace/items?section=attention|continue|progress&scope=mine|assisted&group=persona|project|world|interaction&page=1&locale=en`：同源筛选，每页 20 项，返回 `items/total/page/hasNext`；越界页保留真实总数。
- `GET /api/me/workspace/worlds?ids=<逗号分隔 UUID>&locale=en`：最多解析 20 个 ID，按传入顺序返回最多 4 个有权查看的世界、实际身份及 `canVisit/canManage`。固定和访问仅在本机保存。
- `GET /api/me/workspace/reply-events/:id`：仅评价作者可读、对应公开／恢复事件的固定回复版本；隐藏回复或不可见目标返回 404。
- `GET /api/moderation/personas/:id`：仅网站管理员读取该固定送审版本；已被替代的提交只读。

事项实际字段为 `key/id/revisionId/title/kind/world/parent/persona/state/published/note/at/action/target`；parent、persona 为已授权对象的显示文字，target 携带准确 ID。`note` 仅使用真实审核意见或评价摘录；不伪造修改摘要。摘要为 `attention:{items,total}`、`continue:{mine,assisted}`、`progress:{items,total}`、`canManage`；continue 各组为 `{items,total}`。失败使用现有 HTTP 错误契约，不能冒充空集合。常用世界查询可独立失败和重试；统一摘要查询失败时整体显示重试，侧栏仍可使用。

用户确认：两个页签始终显示，默认 mine，返回保留选择；共享配置及本人实际保存的代编归 assisted。首行主体＋类型／状态＋动作，第二行上下文及保存时间，仅有真实反馈时显示第三行。审核世界显示“拉斯世界　世界 · 3 条内容待审核”；首页仅离开工作台的世界入口保留 ↗。

## 1. 已核对的数据含义

| 数据 | 已有写入与来源 | 能证明什么 | 不能证明什么 |
| --- | --- | --- | --- |
| `personas.owner_id` | `savePersona` 创建角色 | 账号拥有角色 | 世界管理、入驻或作品所有权 |
| `contents.author_id` | `createContentInTransaction`、`startReview` 写为执行创建的账号；导入复用前者 | 账号创建记录；角色评价由本人发言入口创建 | 文学作者；管理员代建的真正委托人；经营角色归属 |
| `content_revisions.created_by`＋`draft_saved` | `appendRevision` 创建版本及保存事件 | 账号实际保存该版本 | 仅浏览、仅审核的账号有代编任务 |
| `translations.created_by`、`origin=manual`、`translation_saved` | `saveTranslation` 更新当前版本的译文指针与 draft token | 人工保存译文，同一内容版本仍可能改变 | 自动翻译任务代表本人编辑；旧版本译者拥有新版本任务 |
| `review_signatures.managed` | `startReview/saveReview` 为真实角色评价；旧后台手记及迁移历史为 false | 当前评价是否使用角色评价流程 | 所有 kind=review 都能进入本人评价编辑器 |
| `provider_bindings`＋角色 owner | 显式绑定提供者角色 | 通过现有可见性、停用校验后可回复 | 项目作者、管理权限或替他人发言权限 |
| `detail_setting_revisions.created_by`＋`draft_saved` | 共享设定保存新版本 | 账号保存当前共享修改 | 初始化公共投影就是未完成任务 |
| `world_home_revisions.created_by`＋`home_draft_saved` | 首页配置保存新版本 | 当前首页配置的保存者 | 世界所有者自动拥有全部配置草稿任务 |
| 各类事件 `created_at` / publication `published_at` | 数据库真实事件与快照 | 发生时间与当时版本 | 未读状态；最后浏览时间；另一事件的发生时间 |

源码：`packages/domain/src/{content,imports,persona-reviews,settings,home,auth,read}.ts`。当前 `providerInbox` 缺少回复状态，`myReviews` 缺少完整对象上下文，角色列表缺事件时间；不能直接拼接旧 DTO 假装已经满足契约。

## 2. 每类事项的映射

| 事项 | 本人关系／权限 | 当前动作和栏目 | 退出／转栏 | 定位目标 |
| --- | --- | --- | --- | --- |
| 角色当前资料被退回 | persona owner；对应 head 的 decision=rejected | 待办：看意见并修改 | 保存新 head → 继续；提交有效版本 → 进展 | personas＋persona ID＋revision ID |
| 角色未提交草稿 | persona owner；head 不等于公开版本，且不是仍在等待的 submitted 版本 | 继续／我的创作／角色 | 提交 → 进展；完成 → 退出 | 同上，编辑当前 head |
| 本人创建的住宿／活动／服务 | author=actor 且仍通过 requireWorld；当前未完成版本 | 退回 → 待办；草稿 → 继续／我的创作／项目 | 新版本、送审、发布重新核对 | editor＋world＋content＋revision |
| 实际代编项目 | author≠actor；当前版本有本人 draft_saved 或有效人工译文保存依据；仍有管理编辑权限 | 退回 → 待办；草稿 → 继续／协助／项目 | 旧保存被新版本取代不自动延续任务；送审／发布退出 | 同上 |
| 旧后台手记 | 使用后台内容权限与保存依据；不能强制映射为角色评价 | 继续／互动；标“后台手记”，带父项目 | 沿用内容版本流程 | editor＋content；不送到本人评价编辑器 |
| 本人角色评价 | author=actor；persona owner；遵守现有停用及目标可见性规则 | 退回 → 待办；新草稿 → 继续／我的创作／互动 | 提交 → 进展；审核／发布 → 进展 | reviews＋review ID＋revision |
| 收到尚未回复评价 | 当前绑定 persona owner=actor，未停用，评价及父项目公开可见，满足 providerAccess | 待办：可回复（排在审核／退回之后） | 有回复草稿 → 继续；submitted/published 不再提示新回复 | replies＋reply=**评价 ID** |
| 本人回复新草稿／退回 | 当前绑定身份与当前 revision.created_by 均匹配，继续满足 providerAccess | draft → 继续／互动；reject → 待办 | 保存新版本 → 继续；submit → 进展 | replies＋reply=评价 ID＋revision |
| 共享世界／地点设定 | 当前 head 的本人实际保存依据；通过 settings.access | 继续／协助／世界；退回进入待办 | 提交 → 进展；发布当前版 → 退出 | world-settings＋world＋setting＋revision |
| 世界首页配置 | 当前 head 的保存者=actor；requireWorld(manage=true) | 同上，明确“首页配置” | 以 head/submitted/publication 和匹配版本事件判断 | world-settings＋world＋module=home＋revision |
| 他人角色资料代编 | 网站管理员实际保存 head；通过 settings.access | 继续／协助／角色 | 与本人角色走同一实体，单一工作去重 | 对应共享角色设定；不伪装成 ownPersona |
| 全站详情文案 | 网站管理员实际保存 head | 属共享配置；若纳入世界组须明确“全站共享，无所属世界” | 当前版发布退出 | settings 模块的真实可达入口；不得虚填一个世界 |
| 角色审核 | 仅 site admin；有效 submitted pointer 且无决定 | 待办：角色审核队列／指定提交 | 决定、替代后退出；无权账号不返回 | site＋persona submission |
| 内容／发言／回复／设定审核 | 当前世界 owner/admin 或 site admin；各对象符合真实待审状态 | 待办，按对象类型／世界有界汇总 | 当前有效任务处理后重算 | world-review／moderation／setting 指定队列与对象 |
| 送审、审核、发布、本人评价收到回复 | 本人关系或本人实际编辑的对应版本；再次校验读取权限 | 最近进展：主体＋动作＋实际事件时间 | 保留历史语义，不占当前待办 | 对象＋事件／版本；已不可读时不泄露信息 |

内容 `reviewRevision(publish)` 同事务将状态置 approved 并创建 publication。**不能把所有 approved 记录当成“等待发布”**。撤下的旧 approved 版本也不能自动当成草稿。

`detail_settings.submitted_revision_id` 和部分首页配置 submitted 指针发布后可能仍保留。必须排除已发布的同一 revision，并检查该 revision 的最新相关事件；不能仅用非空 submitted 判断待审。角色允许旧 submitted 与新 head 并存，首页可以同时展示不同版本的待审进展与新草稿。角色审核决定会清空 submitted 指针；已完成审核结果必须从 persona_revision_decisions／detail_setting_events 读，不能指望 myPersonas.submitted_decision 继续返回历史决定。

回复 `hide/restore` 与草稿状态不是同一个维度。公开指针、hidden、当前 head 的事件分别表达；隐藏过的回复不能重新变成“从未回复”。提供者绑定改变后，旧回复保存者不再获得当前操作入口。

## 3. 检查点时的接口提案（历史记录，最终实现见页首）

保持原接口与写操作不变。新查询放在 domain，统一权限谓词；Web 仅渲染摘要。

- `GET /api/me/workspace?locale=zh-CN`：首页有界摘要。服务端确定归属、能力、状态、去重、稳定排序、完整计数后再截取。
- `GET /api/me/workspace/items?section=continue&scope=mine&group=project&page=1&locale=zh-CN`：与摘要完全相同的筛选规则，每页 20 条；不借用会扩大范围的世界内容总列表。
- 常用世界若采用浏览器存储：`POST /api/me/workspace/worlds/resolve` 为只读解析，最多提交 20 个世界 ID，返回最多 4 个允许展示的世界、当前身份和可用目的地。响应 no-store；不信任本地缓存的名称或权限。若选跨设备则另立最小偏好表增量迁移。

DTO 草案：

```ts
type WorkScope = 'mine' | 'assisted';
type WorkGroup = 'persona' | 'project' | 'world' | 'interaction';
type Item = {
  key: string; // entity type + entity id + action + revision/submission/message id
  entity: { type: string; id: string; revisionId?: string };
  scope?: WorkScope;
  group: WorkGroup;
  title: string;
  kind: string;
  world?: { id: string; name: string };
  parent?: { id: string; title: string; kind: string };
  persona?: { id: string; name: string };
  currentState: string;
  publicState: 'unpublished' | 'published' | 'hidden';
  reason: string; // 可本地化的语义键，不使用 UUID 作说明
  action: { type: string; target: Record<string, string> };
  evidence: 'persona_owner' | 'account_created' | 'head_saved' | 'manual_translation_saved' | 'provider_owner' | 'moderator';
  occurredAt: string; // ISO 数据库时间；无法确定则不构造相对时间
};
```

每栏返回 `status: ready|error`、`items`、`total`、`hasMore`。服务端身份校验先于数据；失败是错误，不是空集合。总鉴权失败返回现有错误码。独立数据来源失败的栏目可重试；有限重试请求只重读对应栏目。计数不把 loading/error DOM 算入。

实现目标：入口身份请求与聚合摘要并行，沿用 workspace bootstrap 单次导航共享响应、写后清空的规则。概览不再逐世界请求两份完整列表，客户端请求数不随可管理世界数量增长。查询按类型批量执行，避免逐项详情 N+1。稳定排序：待办审核／退回先于可回复，类内时间降序＋稳定 ID；继续按保存时间降序＋ID；最近进展按真实事件时间降序＋ID。每个继续组默认 2 条；最近进展 5 条，无伪未读模型。

去重针对动作及版本：同一个评价回复工作仅处于一个当前操作栏目；同一项目的新稿与其另一评价的回复可独立出现。汇总审核数显示“3 条内容”，首页卡片总数显示“3 项”，不相互替代。

## 4. 已确认的范围与存储

用户已确认两个页签始终可见、默认 mine、当前浏览返回时保留选择；共享世界配置在 assisted。内容 account_created 表示创建记录；旧导入／代建无法仅凭已有字段确定文学作者，不重写归属。

建议协助编辑采用**当前工作版本的保存证据**：本人创建当前 head 或保存其当前有效人工译文（连同该 revision 的保存事件），排除仅在旧版参与者、自动翻译、只有审核记录者。本人创作优先，不在同一账号的两个页签重复。

常用世界建议账号＋浏览器 localStorage，只存 ID、pin 顺序及最后成功访问时间；上限 20 个历史 ID，最多显示 4 项；固定先行且顺序稳定、最近访问降序补位、去重。登录换账号前清空页面旧结果，键含 actor.id，跨标签读取当前账号命名空间，失败保留错误／重试。不存草稿正文、名称、权限、会话令牌。私有世界只有当前管理权限可显示，公开不可见时隐藏“进入世界”，合法管理入口可单独保留。无记录时整个栏目隐藏。

来源核对、隔离场景与基线先于视觉反馈完成；收到确认后已注册真实接口并接入首页，验证及部署结果见实施记录。

## 5. 对象定位与返回支持

- 已有：内容 `content`，评价 `review`，回复 `reply`；工作台内容列表可保留筛选、页码和滚动。
- 本轮补齐：角色 persona ID、共享配置 setting/home、审核对象及固定送审版本定位；返回白名单加入经校验的 overview 上下文。
- 只接收同源、当前语言工作台路径，且 view/世界/对象一致的 returnTo；不接受外部 URL、协议相对 URL、非工作台路由。返回保留范围、查看全部分页、scroll 与 focus。账号改变后丢弃前一账号返回数据。
- 入详情重新获取当前权限和版本。版本已经变化时显示明确说明，不能默默把旧事项动作应用到最新版本。保留现有未保存输入保护和冲突提示。
- “查看全部”是同一服务端范围的小型列表，不跳到全部世界内容造成语义扩大。可作为 overview 的子视图，不改其他页面信息架构。

## 6. 隔离测试矩阵

测试沿用 `tests/helpers.ts`：随机 `test_<uuid>` schema，connection 固定 search_path，fixture 仅在该 schema 建模；finally 清理。业务现用 schema 不 seed/reset。新来源核对测试须先断言 current_schema() 与 fixture.schema 一致。

| 测试族 | 必需断言 |
| --- | --- |
| 本人／他人 | 角色 owner 与项目 account_created 区别；普通账号不获得世界编辑权；账号切换不混淆 |
| 代编依据 | head 保存者与 author 可不同；仅管理／读取／审核不产生编辑证据；人工译文保存纳入，机器翻译排除；旧版本证据不扩散 |
| 公开／当前状态 | 发布版＋新稿同时表达；published=approved 无额外发布任务；撤下旧 approved 不当草稿；发布后残留 submitted 指针不重复计数 |
| 角色提交 | A 待审与 B 草稿并存；A 退回但 B 已保存只提示 B 的当前工作；被替代申请不再可审 |
| 回复转栏 | 未回复→草稿→提交→退回→新草稿→发布；读取不完成；已发布／隐藏不再提醒“首次回复”；绑定变化与停用立即生效 |
| 去重 | 同一动作／版本不跨当前栏目重复；同项目不同评价／内容工作保留；后台手记与 managed 评价目标正确 |
| 审核能力 | editor 无审核入口；owner/admin/site 按真实对象权限；角色审核仅 site；等待角色批准时明确依赖，不产生无权发布按钮 |
| 世界偏好 | 无记录隐藏，权限失败显示错误；过期 ID／私有世界过滤；固定稳定与最近补位；不同账号、浏览器及退出登录 |
| 查询与导航 | 超过一页仍计数正确；时间相同稳定排序；分组查看全部等价；名称长／中英／返回焦点／冲突／跨世界清理 |
| 加载 | 聚合不按世界 N+1；部分故障不把其他栏目清空；bootstrap 复用、写后失效、30 秒清理；网络下导航始终可点击 |

首批 executable source tests 仅验证已有行为与可信依据，不能称为新聚合接口验收。视觉确认并实现后补充 DTO／API／浏览器实际任务断言；涉及共用权限、版本逻辑时运行 `npm test` 与标准 `npm run test:e2e`。
