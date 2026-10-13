# 我的角色：真实接入记录

2026-10-13 后续 code review 的三项异步问题已修复并部署；26 项联合回归和 28 项部署检查通过，尚未 commit/push。详情见 [review 修复记录](review-fixes.md)。以下为初次接入的历史记录。

日期：2026-10-13。阶段 B；独立预览已获用户确认，预览归档提交为 `9f42a6b8e4fae210350716ebd45f507692e5753d`。本轮在该提交上接真实接口与页面，不回滚到原始讨论基线 `f494b1c`。用户现已明确授权 commit & push 归档；提交标识以 Git 历史为准。

## 入口与范围

- 真实中文：<https://plotstay.xingwu.dev/zh/workspace?view=personas>
- 真实英文：<https://plotstay.xingwu.dev/en/workspace?view=personas>
- 已验收的独立演示仍在 `/_design/personas/`，示例保存仍是模拟，不作为真实后端证据。
- 旧 `/account`、`/admin` 保留。新版角色列表、创建和编辑使用新控制器；评价／回复／审核保留原表单，仅适配侧栏、标题、选中态。
- 没有新增待用户决定的业务细则。沿用已确认的先建角色再保存笔记、停用角色仍可保存本人笔记、2000 Unicode 码点上限。

## 组件、接口与迁移

| 改动 | 具体范围 |
| --- | --- |
| `apps/web/src/lib/workspace-personas.ts` | 真实列表、搜索、重叠状态筛选、排序、创建、双语公开资料、私人笔记、历史只读、冲突核对、独立保存状态及离开保护。头像沿用四色样式，各语言独立。 |
| `workspace-personas.css`、`WorkspaceLayout.astro` | 卡片网格、手机紧凑条目、宽屏局部导航／表单／预览、窄屏减列，操作在文档流中。样式作用于新版角色区域。 |
| `workspace.astro`、`workspace.ts`、`persona-client.ts` | 侧栏分组、评价／收到的评价／审核入口；保留我管理的内容、世界、设置、语言、旧入口。新版去横向总导航，旧账户保留；手机可展开菜单。 |
| `POST /api/me/personas/save` | `{personaId?, baseRevisionId, profiles, action: draft/complete, expectedSubmittedRevisionId, requestId}`。所有权、停用、双语、当前版本及站点身份由服务端验证。 |
| `GET /api/me/personas/:id/notes` | 仅所有者读取独立笔记；非所有者网站管理员无例外。列表不读取笔记。 |
| `PUT /api/me/personas/:id/notes` | `{body,baseVersion,requestId}`；本人保存，2000 码点，独立并发版本及重复请求检查。停用角色允许。 |
| 现有 `GET /api/me/personas` | 添加真实创建／资料保存时间、已生效标记及最新退回版本说明。仍为一次列表请求，不逐卡加载历史。 |
| 现有 `GET /api/auth/me` | 添加审核导航能力标记；依据实际站点／世界权限计算，不赋予额外权限。初始身份请求继续由 bootstrap 复用。 |
| `011_persona_private_notes.sql` | `persona_private_notes` 独立私有正文／版本；`persona_profile_commands` 保存公开操作的请求指纹与结果以保证幂等；新增角色历史查询索引。未修改已应用迁移。 |
| 契约、错误日志 | 笔记与公开资料 schema 分离；笔记 API 内部错误日志排除可能含行正文的数据库诊断。私人正文不写浏览器持久存储。 |

保存公开资料在同一数据库事务内建立一个固定版本，再送审；网站管理员本人资料在同一事务内批准生效。事务失败全部回滚。请求 ID 防重复，persona 行锁与版本令牌处理并发；草稿不改变待审指针，提交新稿才替换旧待审。客户端没有通过串联多个写请求假装原子完成。

笔记完全独立：不更新公开资料版本、待审指针、公开时间、署名或历史。其接口不提供管理员读取能力。客户端切换账号／退出页面会清理笔记；过期后隐藏清除私人输入，同账号重新登录可恢复公开资料未保存输入。返回浏览器标签页时复核身份，旧异步响应不能重新填入上一账号的笔记。

## 截图与视觉核对

截图均由 Chromium 渲染**真实构建页面与真实 API**，使用一次性隔离 schema 中的测试角色；日期来自当次实际保存。没有向现用库写示例角色，也没有使用生成图作为验收截图。

| 页面 | 中文桌面 1440 | 中文手机 390 | 英文桌面 1440 | 英文手机 390 |
| --- | --- | --- | --- | --- |
| 角色列表 | [查看](screenshots/list-zh-1440.png) | [查看](screenshots/list-zh-390.png) | [查看](screenshots/list-en-1440.png) | [查看](screenshots/list-en-390.png) |
| 对外资料 | [查看](screenshots/public-zh-1440.png) | [查看](screenshots/public-zh-390.png) | [查看](screenshots/public-en-1440.png) | [查看](screenshots/public-en-390.png) |
| 私人笔记 | [查看](screenshots/notes-zh-1440.png) | [查看](screenshots/notes-zh-390.png) | [查看](screenshots/notes-en-1440.png) | [查看](screenshots/notes-en-390.png) |

附加：[1100px](screenshots/public-en-1100.png)、[360px](screenshots/public-en-360.png)、[360px 笔记](screenshots/notes-en-360.png)、[长资料](screenshots/long-profile-390.png)、[管理员直接生效](screenshots/admin-published.png)、[空状态](screenshots/empty-390.png)。本地可打开 [截图总览](gallery.html)。

与参考图保持：暖白底、深绿主按钮、黄绿导航，80px 桌面头像／56px 手机头像，17px 卡片名字、14px 简介、18px 卡片间距，输入约 16px／44px 高。没有铃铛、封面、删除／复制或空更多菜单。真实头像仍是原有四种样式；搜索和双语切换、复合状态、错误与私有笔记补足静态参考图未呈现的情形。旧长资料只在卡片摘要截取，编辑值不截断。

## 验证结果

最终机器结果见 [verification.json](verification.json)。

- 数据回归：`npm test`，96 项通过。包含现有评价／回复不可变历史、旅行凭条、审核权限；新增角色测试另覆盖事务故障回滚、普通／世界管理员送审、站点管理员本人直接生效、非本人禁止、待审 A／新稿 B／已生效 P、过期审核、并发及请求重试。
- 63 项现有端到端回归通过：旧账户、旧后台、三类条目、评价回复、预订、概览来源／指定历史版本及工作台请求复用均保持。
- 最终角色浏览器验收 11 项全部通过；此前角色＋概览＋工作台联合回归 13 项全部通过。新角色浏览器验收包括：双语输入保留、独立 dirty/saving/error/saved 状态、替换待审、网络丢响应后创建幂等、2000／2001 码点、停用笔记、两窗口笔记冲突、加载失败重试、空搜索、同账号重新登录和切换账号、后台导航权限、真实截图矩阵。
- 1440／1100／390／360 无整页横向溢出；长英文名字及简介、200% 文字放大通过。手机 390×440 缩短视口可滚动输入／保存，操作栏无固定覆盖。
- 初始列表仅一次 `/auth/me`、一次 `/me/personas`；没有逐卡历史或笔记读取。历史在展开时加载，笔记在进入栏目时加载。概览和编辑器继续使用已有 bootstrap。
- 公开 DTO、共享历史、审核队列／详情、评价署名等排除私有测试标记；非所有者（包括网站管理员、世界所有者和编辑者）读取或写入笔记被拒绝。笔记保存前后的公开 DTO 完全相同。

发现并修复：初次笔记超限测试将同步契约异常误用异步断言；截图发现旧 CSS 覆盖新版主按钮／手机菜单，以及手机整行链接文案叠在头像上；会话恢复后笔记错误状态未重置。均已修正并复测。一次组合回归未返回完整结果，单独旧账户回归及随后完整 63 项回归均通过，不将提前结束的运行计为通过。

未验证：真实物理手机软键盘及输入法、公网通过 Basic Auth 后的登录交互（没有 Basic Auth 明文）。真实业务交互已在隔离数据库的构建服务验证；不把本机验证写成公网登录验收。未实施跨站权限制度变化、头像上传／绘制或公开角色主页。

## 发布与数据保留

**已更新开发域名。** 最终服务启动于 `2026-10-13 12:52:35 JST`，systemd active，health 返回 ok，实际服务环境 `SITE_INDEXABLE=false`。

[迁移审计](migration-audit.json)：仅应用 `011_persona_private_notes.sql`，迁移前后 36 张既有表的行摘要完全一致；新增笔记表与操作幂等表均为 0 行。没有 seed/reset，没有现用业务测试写入，已有数据库和数据卷继续使用。

[部署检查](deployment-check.json)：28 项通过，包括中英入口／旧后台／新 API／静态资源的匿名 Basic Auth 拒绝、错误凭据拒绝、robots 禁止爬取、noindex/nofollow/noarchive、private/no-store，以及本机实际构建的中英登录恢复界面。应用会话错误仍为浏览器侧 403，没有 Basic Auth challenge。公网认证后交互仍明确列为未验证。

- ZIP 开工及复核 SHA-256：`2338ebbf7ead485b3842e0d8eb3204da83dfd52c4eb8994c85c2daa232b72d26`。
- 原始交接说明、参考图、预览成果保留。ZIP 原样保持未跟踪。
- 本轮仅在工作区实现；没有再次 commit/push。远端 main 保持预览归档 `9f42a6b`。


## 用户授权提交归档

2026-10-13 用户回复“commit & push”，授权提交并推送阶段 B 实现、迁移、测试、19 张截图及验收记录。上文未提交状态对应首次交付时；本次归档沿用已通过的构建、回归与部署结果，仅补充本提交记录，不重复迁移或重启服务。`example_pages.zip`、凭据和本地构建产物继续排除。
