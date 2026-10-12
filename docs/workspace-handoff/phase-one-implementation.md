# 第一阶段实现与人工体验记录

状态：新版独立工作台与旧后台并存。所有内容、角色、评价和管理操作使用原数据库及已有 domain 权限。旧入口与旧深链接保持有效；本次没有公开注册、世界创建或普通作者新权限。

## WS-00 入口与能力映射

| 旧操作 | 新入口 | 服务端权限与版本约束 |
| --- | --- | --- |
| `/account?view=personas`：角色创建、编辑、头像 | `/workspace?view=personas` | 本人账号；`baseRevisionId`；独立送审只提交当前草稿 |
| `/account?view=reviews`：本人评价与署名 | `/workspace?view=reviews` | 作者及本人 persona；评价版本、角色署名版本、同角色同条目唯一 |
| `/account?view=replies`：提供者收到的评价及回复 | `/workspace?view=replies` | 绑定提供者 persona 的所有者；回复接口的 `id` 仍是评价 ID |
| `/account?view=moderation`：评价、回复、角色审核和账号创建 | `/workspace?view=moderation`、网站管理员 `/workspace?view=site` | 世界 owner/admin 审本世界发言；只有网站管理员审跨世界角色、创建账号；固定版本审核 |
| `/admin`：三类作品、后台手记、保存预览、审核发布和历史 | `/workspace?view=works`、`?view=editor&content=…`、`?view=world-content&world=…`、`?view=world-review&world=…` | 世界成员编辑；owner/admin 或网站管理员审核；`baseRevisionId` 与草稿 token 阻止覆盖；下架、恢复、站点限制沿用原服务端门槛 |
| `/admin`：共用文案、世界首页、地点和人物设置 | `/workspace?view=world-settings&world=…` | 原设置权限、版本、审核与引用范围；共享资料独立版本，不复制进作品 |
| `/admin`：批量导入、预演、翻译重试 | `/workspace?view=world-tools&world=…`，复杂任务仍可切回 `/admin` | 原导入、翻译 API 和世界权限；导入不覆盖现有作品 |
| 原数据库世界成员关系 | `/workspace?view=world-members&world=…` 只读查看 | owner/admin 或网站管理员可读；第一阶段没有新增成员变更写操作 |

新版路由只接受既有应用会话；Nginx 仍给整个域名执行 Basic Auth。旧版与新版都调用相同 API。编辑器保存保持全部既有 schema 字段，新增 `editorListIds` 只记录双语重复项目的身份与顺序；已有发布版和历史快照不回写。旧脚本与新版共用字段渲染器，因此旧版重新打开新版草稿会保留项目 ID。直接使用旧 API 写入已带 ID 的草稿而遗漏 ID 时返回 `LIST_IDENTITY_REQUIRED`，避免静默丢失对应关系。

导航使用 `view`、`world`、`content`、`kind`、`q`、`status`、`page` 形成私有链接。作品从世界内容进入时，返回链接保留原 URL；筛选与页码写回 URL。新开深链接没有来源时回到作品列表或世界管理。浏览器返回与界面切换均提示未保存输入；取消后留在原编辑器。

## 字段、预览与兼容

住宿、活动、服务及手记继续由原 `textSchema`、`attributesSchema` 和结构化字段渲染器生成；高级 JSON、图片 ID、空值、0、`clearedFields`、公开版本及历史均沿用原契约。预览只加载已保存版本，依旧走 `/api/admin/preview/{locale}/{id}` 的真实页面渲染。私有预览桥接只发送栏目选择，核对同源、iframe 来源、会话 nonce、作品 ID 和当前版本；公开详情页不加载该脚本。

重复列表新增、删除、上移、下移同步中英项目 ID 与顺序；单语输入清空保留共用槽位。旧数据两种语言项目数量不同且无法判断对应时，编辑器提示人工校订，阻止直接重排。图标候选与正式页共用 SVG 路径；未知旧图标显示原值，不自动替换。

角色申请以当前 `submitted_revision_id` 为唯一有效待审指针。保存 B 草稿保留 A 待审；提交 B 才替代 A。审核旧申请被拒绝；未发布评价或回复若仍引用被替代的 A 署名，必须明确重新保存署名并重提。原版角色设置和联合送审均进入相同 domain 校验。迁移 `009_persona_current_submission.sql` 与 `010_persona_submission_pointer_guard.sql` 只校正历史中被旧保存逻辑清空或错误恢复的当前待审指针，不改不可变历史。

## 世界管理逐项人工体验

以下项目在开发站均保持旧版可用，用户需按同一账号和世界逐项对照新版位置、返回路径和操作信息，记录“可替代／需调整／继续保留旧版”：

1. 世界首页配置、分类与推荐内容：`world-settings`，检查全部配置、版本和影响范围。
2. 地点、共用人物和文案：`world-settings`，检查引用作品、真实预览、权限和历史恢复。
3. 三类作品列表与编辑：`world-content` → `editor`，检查筛选、字段、返回位置和双语项目。
4. 固定版本审核、退回、下架、恢复与网站限制：`world-review` 与作品历史，检查版本与原因。
5. 评价／提供者回复审核及绑定：`moderation` 或 `site`，检查世界范围与角色所有权。
6. 导入预演／执行、翻译和失败重试：`world-tools` 与作品历史，比较旧版复杂工具是否需要继续保留。
7. 成员与权限：`world-members` 为只读关系；若需要变更成员，需另定操作与审核规则。

世界管理的排列与细节尚待人工体验。旧版退役、第二阶段 WS-08～13、BUG-003 前台来源标示和正式内容填充均不在本次实现范围。
