# 我的角色：阶段 A 独立交互预览

日期：2026-10-13。**阶段 A 独立交互预览及笔记细则已获用户明确确认，已授权 commit & push 归档；真实接入尚未开始。** 下文的“待确认／未 commit/push”记录对应当时的工作状态，最新状态见文末。

## 开工盘点

已阅读 AGENTS.md、operations、development-status、workspace-handoff README、phase-one-implementation、overview-layout-refinement，以及用户上传的完整 `plotstay-personas-development-handoff.md`。两张 PNG 已实际查看。交接说明最初未出现，用户补上传后再完整阅读，不推测缺失附件。

实际 HEAD 与 GitHub API 查询的远端 main 均为 `f494b1c5d28a53824e2901817faf85a6cc4141eb`。分支 main，origin 为 x1ngwu/plotstay。开工无已跟踪文件的未提交改动；未跟踪文件为 `example_pages.zip` 和三份用户附件。没有回滚、清理或覆盖已有文件。

| 现有实现 | 核对结论／接入阶段影响 |
| --- | --- |
| `workspace.astro`、`workspace.ts` | 新版嵌入旧账户横向总导航；persona 内部再输出 h2，形成重复标题。回复／审核的侧栏选中态合并到 reviews。以后需同步标题、分组、选中、返回，保留 works、语言、账号和旧入口。 |
| `persona-client.ts` | 新旧账户共用。当前 savePersona 保存后返回列表，再单独 submit。初始化直接解引用 `[data-review-admin]`，删除导航须同步能力处理。站点管理员入口不能依赖 worlds.some 的非空数组。 |
| `/api/me/personas` | 按 `owner_id` 读取；返回 draft、submitted、published 和相关指针，不含笔记。列表缺少公开资料更新时间及独立的上次退回信息，接入时需补有界字段，不能逐卡拉历史。 |
| `savePersona`、`submitOwnPersona` | 各自开启事务；保存检查所有权、停用和 baseRevisionId，保留原待审指针。单独提交需中英资料，针对当前固定版本。不能把现有两个顶层事务简单套起来宣称原子。 |
| `approvePersonaVersion` | 仅网站管理员；锁 persona／setting，核对当前待审指针，创建决定、发布与事件记录；旧申请被替代后拒绝审核，避免较老批准回滚较新投影。 |
| 共享资料历史 | `detail_settings`、不可变 `detail_setting_revisions`、`detail_setting_publications`、`detail_setting_events`，以及 `persona_revision_decisions`；共享历史允许站点管理员读取，因此不能装入私人笔记。 |
| 公开契约 | 仅 name、bio、avatar；name 为 trim 后 1–20000，bio 最多 6000 且可空；头像为 mint／amber／violet／sky，按语言存储；无唯一姓名或唯一所属世界要求。 |
| 权限／固定署名 | 角色不提供账号管理权限。跨世界角色资料审核仅站点管理员；世界管理员只审其世界发言。评价／回复有固定署名快照；提供者回复归绑定 persona 的所有者。 |
| 旧入口／深链接 | `/account`、`/admin` 保留；persona、new、revision、submission、review、reply、returnTo 等参数不能随意重命名。`workspace-revision.ts` 对历史只读。 |
| 加载 | `workspace-bootstrap.js` 提前并行请求身份／菜单数据，同文档按 consumer 复用响应，30 秒释放、写入失效；列表一次 `/me/personas`，历史按进入时读取。 |

导航分组、卡片、编辑栏目、语言控件和样式属于 UI 调整。**私人笔记最小独立表及仅本人接口、合并保存／提交／管理员生效用例属于已确认但尚未实施的新能力。** 真实接入先做服务端事务、权限、笔记隔离与冲突测试，再接 UI。阶段 A 不新增应用接口、迁移或业务组件。

## 入口与使用

- 中文：<https://plotstay.xingwu.dev/_design/personas/?lang=zh>
- 英文：<https://plotstay.xingwu.dev/_design/personas/?lang=en>
- 截图浏览：<https://plotstay.xingwu.dev/_design/personas/?view=gallery&lang=zh>
- 源目录：`docs/workspace-handoff/personas-prototype/`。本机运行 `node docs/workspace-handoff/personas-prototype/serve.mjs`，监听 `127.0.0.1:4397`；这个本机地址需要端口转发，不是公网入口。静态预览也可离线打开 index.html（推荐 HTTP，以保留标准导航行为）。

页面常显“示例数据；模拟保存，刷新重置”。打开右上方“演示设置”切换：

| 控件 | 内容 |
| --- | --- |
| 示例权限 | 普通用户、世界管理员、网站管理员；仅后者显示“保存并生效”。 |
| 场景 | 复合状态、退回后新草稿、空列表、长资料／缺失头像、停用、载入中、载入失败。切换场景重置示例，未保存时会提示。 |
| 下一次保存 | 正常、网络失败、冲突、权限不足、会话过期。失败只模拟一次，可重试；未接后端。 |

建议路径：

1. 默认列表的苇舟同时有已生效 v1、待审 v2、草稿 v3。筛选可以重叠，全部只统计三个独立角色；搜索匹配中英文名字／公开简介，不匹配笔记。最近更新按示例资料保存时间，笔记保存不更新此时间。
2. 编辑苇舟，切换中文／English 内容，再切换顶部界面语言；输入保留，头像仅改变所编辑语言。
3. 在公开资料和笔记都输入内容，保存其中一个，另一个仍显示未保存。离开角色、侧栏导航、浏览器后退和关闭页面有保护。
4. 暂存草稿后，旧待审 v2 不变；点击保存并提交，出现明确的待审替换对话框，可取消。成功后留在当前编辑器；当前已送审／生效且无新修改时不再鼓励重复提交。
5. 选择网站管理员，编辑青苔并保存生效，演示创建新固定版本并保留历史。世界管理员仍要提交网站审核。
6. 选择退回场景，编辑青苔：退回原因固定指向 v1，新草稿明确尚未审核；暂存后仍可查看旧原因。展开“资料状态与历史”查看只读版本。
7. 创建角色时可先写笔记，尚未保存会明确告知。任一语言填名字并暂存角色后，示例 URL 获得新 ID，笔记再独立保存；无需补齐双语或送审。
8. 概览入口是来源定位演示，可进入当前草稿或指定历史版本，按来源返回。其他侧栏页面只演示目标、标题和选中态，明确标注业务未接入；不伪造新的评价／审核表单。

数据仅在当前浏览器文档内存，未用 localStorage/sessionStorage。公开版本与 notes Map 分离；CSP `connect-src 'none'` 阻止业务网络请求。它是设计预览的隔离措施，**不是本人接口鉴权、数据库隔离、原子性或并发测试的替代品**。

## 截图

所有图片由 Playwright／Chromium 实际渲染。基础矩阵共 12 张；另有 1100px、360px 与状态截图。

| 页面 | 中文桌面 1440 | 中文手机 390 | 英文桌面 1440 | 英文手机 390 |
| --- | --- | --- | --- | --- |
| 角色列表 | [查看](personas-prototype/screenshots/personas-list-zh-1440.png) | [查看](personas-prototype/screenshots/personas-list-zh-390.png) | [查看](personas-prototype/screenshots/personas-list-en-1440.png) | [查看](personas-prototype/screenshots/personas-list-en-390.png) |
| 对外资料 | [查看](personas-prototype/screenshots/personas-public-zh-1440.png) | [查看](personas-prototype/screenshots/personas-public-zh-390.png) | [查看](personas-prototype/screenshots/personas-public-en-1440.png) | [查看](personas-prototype/screenshots/personas-public-en-390.png) |
| 私人笔记 | [查看](personas-prototype/screenshots/personas-notes-zh-1440.png) | [查看](personas-prototype/screenshots/personas-notes-zh-390.png) | [查看](personas-prototype/screenshots/personas-notes-en-1440.png) | [查看](personas-prototype/screenshots/personas-notes-en-390.png) |

附加：[1100px 编辑器](personas-prototype/screenshots/personas-public-en-1100.png)、[360px 笔记](personas-prototype/screenshots/personas-notes-en-360.png)、[管理员](personas-prototype/screenshots/scenario-admin.png)、[退回](personas-prototype/screenshots/scenario-returned.png)、[替换待审](personas-prototype/screenshots/scenario-replace-pending.png)、[空状态](personas-prototype/screenshots/scenario-empty.png)、[长资料](personas-prototype/screenshots/scenario-long.png)、[旧长资料编辑](personas-prototype/screenshots/scenario-long-editor.png)、[停用](personas-prototype/screenshots/scenario-disabled.png)、[载入失败](personas-prototype/screenshots/scenario-error.png)、[载入中](personas-prototype/screenshots/scenario-loading.png)。

同宽前后：[现有渲染器 1440px](personas-prototype/screenshots/personas-before-zh-1440.png) → [独立预览 1440px](personas-prototype/screenshots/personas-list-zh-1440.png)。前图通过浏览器替换所有 API 响应为合成示例，未登录或写入业务；两张均为三个角色，未用截图缩放伪装同视口。

## 参考图落实与差异

- 暖白底、浅色卡片、深绿顶栏／主按钮、黄绿选中导航沿用现有变量；正文沿用 system-ui 工作台字体栈，未引入像素正文。侧栏 218px。
- 桌面网格按 218px 最小卡宽自然减列，18px 间距、20px 内边距。头像 80px、名字 17px、简介 14px。主要入口统一描边，创建／完成用深绿。
- 手机改为头像 56px＋紧凑条目，单一编辑点击目标；筛选只在自身区域横滚，整页不横滚。保留搜索和排序，因此顶部比静态参考图多一排工具。
- 编辑器宽屏三列；1100px 将局部导航移到顶部，表单与预览两列；更窄时预览下移。笔记占用宽的主编辑区，无公开预览。
- 手机操作栏在文档流中，避免固定底栏遮挡软键盘或文字；在缩短视口中可滚动到保存。物理手机软键盘仍待人工体验。
- 一个页面主标题；名字／头像先于状态。列表截取摘要，编辑器保留完整旧长文字。复合状态三个简短标签，完整版本关系在编辑器展开说明。
- 采用现有四色头像，非参考图像素人物；无铃铛、用户示例头像、封面、空更多菜单或公开主页。保留“我管理的内容”、账号、语言与旧入口，审核按示例权限显示。
- 补充参考图没有画出的笔记、英文、缺译、状态、失败和未保存保护。未引入图中 50／300 限制。
- 英文手机 200% 文字放大最初发现创建按钮溢出，已将标题操作行改为允许自然换行；不缩小字体解决。

## 本轮补充的三个业务细则（2026-10-13）

用户确认前两项，并提出笔记上限 2000 字；本轮预览采用以下规则：

1. **新角色保存笔记**：先填写任一语言的名字并暂存角色，再独立保存笔记。未保存输入保留；无需补齐双语或提交审核。
2. **停用角色的私人笔记**：本人仍可编辑与保存。停用限制公开资料及对外行为，不限制仅面向自己的笔记；所有权检查仍须在真实后端实现。
3. **笔记长度**：预览采用 2000 个字符上限，按 Unicode 码点计数，包含中英文、标点、空格及换行。单个基本 emoji 计一个，组合 emoji 中的多个码点分别计数；真实客户端与服务端须使用相同口径。输入区显示计数；超限保留完整输入，提示并拒绝本次保存，不自动截断。此限制仅适用私人笔记，公开资料原有契约保持。

各语言头像继续分别保存。上述细则确认不等于整体预览验收，真实接入仍等待明确确认。

## 验证与发布记录

实际结果以 `personas-prototype/verification.json`、`baseline-readonly.json` 和 `protection.json` 为准。首次测试曾因折叠历史区选择器、匹配到对话框的同名 actions、CSP 禁止测试样式标签失败，均修正测试；文字放大发现的创建按钮溢出属于实际 CSS 问题，已修复。

- `node personas-prototype/verify.mjs`（从本目录执行）：示例交互、截图、响应式、未保存保护、内存版本／笔记关系、键盘和文字可读性。
- `node personas-prototype/check-readability.mjs`：中英四宽度三页面，共 24 组 200% 文字放大；不是整页 CSS zoom。
- `node personas-prototype/capture-before.mjs`：现有部署渲染器的示例对照图，以及中英工作台／旧账户／旧后台／health 七项只读 HTTP 检查。
- 不执行现用 API 写入、迁移、seed/reset，也不重启应用。独立 HTML/CSS/JS 无应用构建依赖；仅 Nginx 静态 alias 按 operations 安装、检查并 reload。真实工作台继续原构建。
- 未验证：真实服务端权限拒绝、非所有者笔记隔离、事务／幂等／多窗口并发、旧版交替写入、真实历史署名及凭条回归；这些属于阶段 B。现有加载代码未变，不宣称性能改善。旧深链接只做源码核对和预览演示，不能冒充全部真实登录链路回归。
- 未持有 Basic Auth 明文，不声称公网认证后浏览器验收通过。浏览器截图来自同目录受控本机静态服务；公网匿名与错误密码保护单独检查。

ZIP 开工 SHA-256：`2338ebbf7ead485b3842e0d8eb3204da83dfd52c4eb8994c85c2daa232b72d26`。交付须核对不变。没有自动 commit/push；用户附件原样保留。

### 首次交付实际结果

- 最终 `verify.mjs` 全部通过：13 组检查，25 张预览截图，其中基础矩阵 12 张。24 组四宽度／双语／三页面布局无整页溢出；基础 12 组分别检查 200% 文字和扩展间距。`check-readability.mjs` 额外四宽度 24 组文字放大全通过。
- `capture-before.mjs` 通过：1 张现有渲染器的合成示例截图、7 项现有中英入口及 health 只读 HTTP 200、无相关浏览器异常。总计 26 张截图。
- Nginx 新增 alias 已安装，`sudo nginx -t` 通过，reload 成功。开发域名的**独立预览已更新**。本次无应用构建／重启；服务 active，前后 `ExecMainStartTimestamp` 均为 `2026-10-12 19:21:18 JST`，仍 `SITE_INDEXABLE=false`。
- `check-protection.mjs` 13 项全通过：页面／资源／截图／未知文件／旧入口／API 匿名 401，错误凭据 401；robots 200 且 `Disallow: /`；各响应保持 Basic Auth（除 robots）、noindex/nofollow/noarchive 和 private/no-store。公网认证后交互仍未验证。
- `node --check app.js`、`git diff --check` 通过。当前没有遗留的失败检查；早期失败及修复原因在上方如实记录。没有运行真实业务测试，不将模拟成功计作后端验收。
- 交付时 HEAD 仍为 `f494b1c`。改动仅 Nginx 预览 alias、开发进度／交接目录、独立预览和验收记录；应用组件、API、契约、迁移零改动。用户三份附件和 ZIP 保持未跟踪；新预览目录及记录尚未提交，未 commit/push。
- ZIP 最终 SHA-256 与开工完全一致；未连接数据库做写入，没有 seed/reset，既有业务历史和数据卷保持原样。阶段 A 在此停止，等待用户明确验收。

### 细则补充后的预览更新

2026-10-13 根据上方三项细则，调整独立预览 `app.js` 的笔记可编辑条件、计数、校验和提示；新增停用角色保存与 2000／2001 边界检查。验证公开资料、待审指针、资料时间及原笔记在超限失败时不变；改短后可重试。所有能力仍为内存模拟，不代表服务端已实现。

最终 `verify.mjs` 15 组全通过，27 张预览截图更新；加上原对照图共 28 张。补充[停用角色保存笔记](personas-prototype/screenshots/scenario-disabled-notes.png)与[超限提示](personas-prototype/screenshots/scenario-notes-limit.png)。`check-protection.mjs` 13 项通过；`git diff --check` 通过，ZIP 校验值不变。

更新已由现有 Nginx 静态 alias 直接提供，未构建或重启真实应用，未更改 API／迁移／现用库，也未 commit/push。公网认证后交互仍未验证。等待用户对整体预览明确确认后才进入阶段 B。

## 用户验收与提交归档

2026-10-13 用户回复“我觉得可以，就按照这个来。先commit&push然后我们继续”，明确确认整体预览和三项笔记细则，并授权先提交推送当前成果。本轮归档包含独立预览、28 张浏览器截图、验证脚本／结果、Nginx 预览入口、进度与验收文档，以及原始交接说明和两张参考图；ZIP 原样排除。原始附件保留原文作为历史依据，后续实施以本记录中的最新确认细则为准。

阶段 A 已验收。阶段 B 的既有顺序为：最小独立笔记存储与本人读写接口、固定版本的事务保存／提交／管理员生效、权限／隔离／冲突／幂等测试，然后接真实 UI 与兼容回归。确认预览不等于这些后端能力已经实现。

本次提交沿用刚完成的检查及已部署预览，无业务代码改动，不重复应用构建、迁移或重启；提交标识以 Git 历史为准。
