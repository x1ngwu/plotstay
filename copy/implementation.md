# 文案应用清单

状态：2026-10-19 已完成首轮源码对应关系核对；尚未修改应用代码、数据库或线上文案。本文是实施清单，不是发布记录。

## 已核对的来源与落点

| 文案范围 | 当前实现落点 | 应用方式 |
| --- | --- | --- |
| 首页主标题、小标题、介绍 | `packages/contracts/src/home.ts` 的 `translations[locale].title / eyebrow / intro`；首页读取 `home.text` | 更新拉斯世界首页配置的中英版本，并走现有版本发布机制 |
| 首页礼遇与三张服务卡 | `translations[locale].promotion` 与 `benefits[]` | 只替换审定文字，保留图片、目标、有效期、图标及配置关系 |
| 首页栏目标题 | `translations[locale].sectionTitles`；首页另有地点前缀及通用标题 | 对照实际 section ID 映射，保留动态地点名称；不能只改代码回退值 |
| 目录标题、计数与返回链接 | `apps/web/src/pages/[locale]/index.astro` | 使用审定中英文，保留筛选参数、动态总数及单复数 |
| 搜索筛选 | `apps/web/src/components/Search.astro` | 使用已确认功能标签；不改变筛选和日期规则 |
| 三类详情栏目 | `apps/web/src/components/detail/`、`apps/web/src/lib/detail-copy.ts` | 核对 `detailCopyDefaults` 键与实际 `content.detailCopy` 覆盖值；不得只替换默认文本后宣称已生效 |
| 预约字段及确认 | `apps/web/src/pages/[locale]/booking/[id].astro`、`components/booking/Summary.astro` | 按住宿、活动、服务分别应用；保留计价含义和 UTC |
| 预约异常、重试与恢复 | `apps/web/src/lib/booking-client.ts` | 对照错误码和状态分支，保持请求身份及“不重复创建”逻辑 |
| 旅行凭证与图片 | `apps/web/src/pages/[locale]/receipts/[id].astro`、`booking-client.ts` 的 `initReceipt()`、`downloadReceipt()` | 网页及导出图片分别核验；加入审定署名和现实说明，保留原有预订快照 |
| 内容缺译与界面回退 | `apps/web/src/lib/i18n.ts`、`layouts/Base.astro` | 两类提示分开；角色化版本仅用于拉斯世界 |
| Isi 维护署名与附注 | 新增展示位置，尚需结合页面布局安排 | 保留平台导航与真实功能说明，检查长文案和移动端排版 |

首页数据库读取链已核实：`world_home_settings.published_id` → `world_home_publications.revision_id` → `world_home_revisions.body`，见 `packages/domain/src/home.ts`。此轮未查询当前数据库具体版本、草稿或发布 ID，不虚构当前值。

## 应用前剩余核对

- 读取拉斯世界当前已发布首页、详情文案覆盖值和草稿，保存具体 ID 及差异；沿用既有版本机制，不重跑 seed 或重置数据。
- 目录样板地区名称与介绍须核对真实地点实体、层级及可用字段；本轮定稿不授权重命名任意现用地点。
- 详情文案查找依赖原始中英字符串与 scope；应用时维护稳定键，避免改文字导致覆盖匹配失效。
- 代码中的通用错误提示还供其他世界使用；Isi 文案须限定拉斯世界，平台技术说明可共用。
- 内容正文、房东／向导档案和既有凭证快照不因页面栏目或 Isi 接待署名变更而覆盖。
- 当前工作区存在另一批未提交的后台／审核与部署修改；本次文案提交已排除。代码应用与构建前核实这些改动和实际运行版本，避免顺带发布无关变更。

## 验证与发布

1. 对照 `copy/pages/`、`copy/shared/` 完成具体键及字段清单，已确认普通功能文案按现有表达和术语一致性处理。
2. 核验中英文首页、目录、三类详情、三类预约、凭证网页与下载图；验证回退、零结果、过期场次和请求重试。
3. 核验日期边界、计价、原浏览器找回条件与保存期限等承诺，不通过文案改动变更业务规则。
4. 代码修改验证通过后按项目操作约定构建并更新开发域名，继承访问保护与 noindex 要求；实际发布后填写 `copy/releases/` 并标记已上线。
5. 回退分别记录代码版本与数据库文案发布版本，不用整库恢复撤销文案。
