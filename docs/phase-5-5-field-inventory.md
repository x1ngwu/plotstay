# 阶段 5.5 字段清单与验收映射

基线 d9e803b；2026-10-08。55-01 开工时逐字段追踪，以下为实施后的映射。最终测试数与线上状态见 [实施记录](phase-5-5-content-management.md)。

## 保存层、权限与默认规则

- 正文路径：详情组件 → detail API → publication_locales / translations；数字与共用图片：publications → content_revisions.attributes。后台普通表单使用同一 Zod 契约。高级模式明确切换，与栏目表单共用状态，不再把 JSON 存在视为已完成。
- 内容与手记沿用世界编辑权限，提交／审核沿用世界管理员权限；版本 ID 与 draft_token 共同防冲突。slug、世界、地点、人物和手记父条目的既有身份关系不能在普通编辑中重绑。
- 中英文本列表是明确的语言独立列表，增删排序不改另一语言。步骤图片按 imageId 关联；共用图库顺序、图片 ID、价格、数字规格和场次跨语言共享。列表单项中的中文换行也保留。
- 文本空字符串、数组空值和数值 0 分别保存。对历史上使用 `||` 的字段，通过 clearedFields 记录明确清空；恢复栏目默认会移除相应覆盖。旧内容和不可变快照不批量改写。栏目结构保留，缺数据可显示空状态。
- 可选数字留空表示未配置；文本栏目的“配置此栏目”开关区分旧默认与显式配置。必填标题／完整介绍、有效金额和阶段 5 必需时长仍校验。
- hostBio 与类型人物介绍分别保存。住宿及服务保留独立原介绍；活动的 hostBio 仍是类型人物介绍缺省时的兼容来源。旧 facilities、rules、itinerary 等继续在原有设施或展开正文使用，未适用于当前类型的旧字段保留，高级模式可检查。
- 手记常规表单只显示标题、正文、姓名、来源、参与说明、标签、星级、分项。手记契约内历史遗留图片等未被详情使用的字段保留，不伪称为前台栏目。

## 证据索引

- **A：** `tests/content-management.test.ts` 的 every contract leaf 测试按契约构造全部叶字段（含 map、review），逐项比较保存、重读与中英发布；完整三类演示资料另验 0、空串、数组排序、另一语言不变及恢复。数据测试在隔离 schema 中执行。
- **B：** `tests/content-management-e2e.test.ts` 实际填写三类栏目表单、中英、列表换行、排序、UTC 场次、预览、发布和恢复；手记集中入口、会话恢复与失败不丢输入。通用字段渲染器直接遍历同一 schema，因此每个适用叶字段都有普通控件，不以手写字段名单遗漏扩展。并非每一叶字段都单独截图。
- **C：** 共用文案、共享资料的真实数据库权限／冲突／发布／恢复测试；浏览器代表性栏目标题及配置草稿预览、发布即时生效和类型隔离。所有注册键统一进行双语、占位符、未知键与文本校验。
- **D：** 原 `details-e2e`、三类 repair、`management`、`translation`、`booking` 与 `booking-e2e` 标准回归；保护原布局、空状态、图库、权限、导入、翻译任务及不可变凭条。

## 条目字段逐项映射

字段中的 [] 代表重复项目，<imageId> 为共用图库的稳定图片 ID。表中为正常后台入口；未适用类型的历史值不会随保存丢失。

| 字段路径 | 前台用途／后台栏目 | 保存位置 | 默认与清空规则 | 状态／证据 |
| --- | --- | --- | --- | --- |
| `text.title` | 基础介绍／原有展开字段／价格 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.summary` | 基础介绍／原有展开字段／价格 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.description` | 基础介绍／原有展开字段／价格 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.tags[]` | 基础介绍／原有展开字段／价格 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.facilities[]` | 基础介绍／原有展开字段／价格 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.rules[]` | 基础介绍／原有展开字段／价格 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.itinerary[]` | 基础介绍／原有展开字段／价格 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.hostName` | 基础介绍／原有展开字段／价格 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.hostBio` | 基础介绍／原有展开字段／价格 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.imageAlts.<imageId>` | 共用图库与各语言说明 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.highlights[]` | 基础介绍／原有展开字段／价格 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.included[]` | 基础介绍／原有展开字段／价格 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.serviceItems[]` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.service.introduction` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.providerRole` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.venueName` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.venueAddress` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.offeringTitle` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.offeringDescription` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.offeringImageId` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.customization` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.cancellationBadge` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.qualifications[].icon` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 限定选项；与文字列表一起保存顺序；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.service.qualifications[].title` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.service.qualifications[].description` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.service.contactNote` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.locationNote` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.directions` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.guestRequirements` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.accessibility` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.service.cancellation` | 服务：简介／项目／资质／地点／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.introduction` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.privateGroups` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.cancellationBadge` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.hostRole` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.language` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.expertiseTitle` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.expertiseDescription` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.originalTitle` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.originalDescription` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.whatToDo` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.steps[].title` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.experience.steps[].description` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.experience.steps[].imageId` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.experience.steps[].icon` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 限定选项；与文字列表一起保存顺序；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.experience.meetingTitle` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.meetingAddress` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.meetingNote` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.directions` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.hostIntroduction` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.contactNote` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.guestRequirements` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.activityLevel` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.bring` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.accessibility` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.cancellation` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.experience.screening` | 活动：简介／向导／流程／集合／须知／UTC 场次 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.propertyType` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.bathroom` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.introduction` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.space` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.registration` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.sleeping[].name` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.sleeping[].description` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.favoriteTitle` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.favoriteDescription` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.highlights[].icon` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 限定选项；与文字列表一起保存顺序；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.highlights[].title` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.highlights[].description` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.amenities[].icon` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 限定选项；与文字列表一起保存顺序；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.amenities[].name` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.amenities[].category` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.amenities[].status` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 限定选项；与文字列表一起保存顺序；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.amenities[].description` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.hostBadge` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.hostIntroduction` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.hostBadgeDescription` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.responseTime` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.contactNote` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.neighborhood` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.locationNote` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.nearby[].kind` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 限定选项；与文字列表一起保存顺序；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.nearby[].title` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.nearby[].description` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.cancellation` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.cancellationDetails` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.checkIn` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.checkOut` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.stay.houseRules[]` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.safety[].icon` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 限定选项；与文字列表一起保存顺序；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.safety[].title` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.stay.safety[].description` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `text.map.transit` | 三类地图叙事标注 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.map.lounge` | 住宿地图休息区标注（活动／服务不显示此控件，旧值保留） | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.map.dining` | 三类地图叙事标注 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.map.center` | 三类地图叙事标注 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.map.accessibleDescription` | 三类地图叙事标注 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.map.caption` | 三类地图叙事标注 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.clearedFields[]` | 由主动清空动作维护（非自由文字） | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 仅记录允许的文本路径；旧快照缺失时沿用旧兜底，不改历史 | 已接入；A＋B |
| `text.review.name` | 条目手记：旅客／分项评分 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.review.origin` | 条目手记：旅客／分项评分 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `text.review.stayDuration` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | translations.body（源文另存 content_revisions.source_text）；publication_locales 绑定不可变译文 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `attributes.images[].id` | 共用图库与各语言说明 | content_revisions.attributes；publications 绑定不可变版本 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `attributes.images[].url` | 共用图库与各语言说明 | content_revisions.attributes；publications 绑定不可变版本 | 文本可清空；必填名称与正文拒绝空；换行保留；数组支持增删排序，空数组持久保存 | 已接入；A＋B |
| `attributes.price.amount` | 基础介绍／原有展开字段／价格 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.price.unit` | 基础介绍／原有展开字段／价格 | content_revisions.attributes；publications 绑定不可变版本 | 限定选项；与文字列表一起保存顺序 | 已接入；A＋B |
| `attributes.category` | 基础介绍／原有展开字段／价格 | content_revisions.attributes；publications 绑定不可变版本 | 文本可清空；必填名称与正文拒绝空；换行保留 | 已接入；A＋B |
| `attributes.durationMinutes` | 基础介绍／原有展开字段／价格 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.rating` | 基础介绍／原有展开字段／价格 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.service.demo` | 服务：简介／项目／资质／地点／须知／UTC 场次 | content_revisions.attributes；publications 绑定不可变版本 | 布尔值保留 false，不用真值判断替代缺省 | 已接入；A＋B |
| `attributes.service.sessions[].startsAt` | 服务：简介／项目／资质／地点／须知／UTC 场次 | content_revisions.attributes；publications 绑定不可变版本 | UTC 日期表单；结束晚于开始；空固定场次沿用阶段 5 每日模拟规则 | 已接入；A＋B |
| `attributes.service.sessions[].endsAt` | 服务：简介／项目／资质／地点／须知／UTC 场次 | content_revisions.attributes；publications 绑定不可变版本 | UTC 日期表单；结束晚于开始；空固定场次沿用阶段 5 每日模拟规则 | 已接入；A＋B |
| `attributes.experience.demo` | 活动：简介／向导／流程／集合／须知／UTC 场次 | content_revisions.attributes；publications 绑定不可变版本 | 布尔值保留 false，不用真值判断替代缺省 | 已接入；A＋B |
| `attributes.experience.opensAt` | 活动：简介／向导／流程／集合／须知／UTC 场次 | content_revisions.attributes；publications 绑定不可变版本 | UTC 日期表单；结束晚于开始；空固定场次沿用阶段 5 每日模拟规则 | 已接入；A＋B |
| `attributes.experience.sessions[].startsAt` | 活动：简介／向导／流程／集合／须知／UTC 场次 | content_revisions.attributes；publications 绑定不可变版本 | UTC 日期表单；结束晚于开始；空固定场次沿用阶段 5 每日模拟规则 | 已接入；A＋B |
| `attributes.experience.sessions[].endsAt` | 活动：简介／向导／流程／集合／须知／UTC 场次 | content_revisions.attributes；publications 绑定不可变版本 | UTC 日期表单；结束晚于开始；空固定场次沿用阶段 5 每日模拟规则 | 已接入；A＋B |
| `attributes.stay.demo` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | content_revisions.attributes；publications 绑定不可变版本 | 布尔值保留 false，不用真值判断替代缺省 | 已接入；A＋B |
| `attributes.stay.guests` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.stay.bedrooms` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.stay.beds` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.stay.bathrooms` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.stay.hostYears` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.stay.hostReviewCount` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.stay.hostRating` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.stay.responseRate` | 住宿：规格／口碑／亮点／介绍／设施／房东／周边／须知 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.reviewRatings.cleanliness` | 条目手记：旅客／分项评分 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.reviewRatings.accuracy` | 条目手记：旅客／分项评分 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.reviewRatings.checkIn` | 条目手记：旅客／分项评分 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.reviewRatings.communication` | 条目手记：旅客／分项评分 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.reviewRatings.location` | 条目手记：旅客／分项评分 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |
| `attributes.reviewRatings.value` | 条目手记：旅客／分项评分 | content_revisions.attributes；publications 绑定不可变版本 | 数值独立于语言；空输入移除可选值，0 按字段上下限校验 | 已接入；A＋B |

## 关联资料与计算字段

| 数据 | 来源与保存 | 后台入口／权限 | 默认、清空与生效 | 状态／证据 |
| --- | --- | --- | --- | --- |
| 世界名称、介绍、货币名称 | detail_setting_revisions/publications；审核事务更新 worlds.translations 公开投影 | 共用资料 → world；世界编辑保存、管理员审核 | 名称／货币必填，中英必需；独立恢复不改变内容历史 | 已接入 C、D |
| 地点名称 | detail_setting_revisions/publications；places.names 公开投影 | 共用资料 → place；本世界权限 | 稳定 ID／slug；必需双语；发布影响首页分组／列表／详情 | 已接入 C |
| 人物姓名、简介 | detail_setting_revisions/publications；personas.profiles 公开投影 | 共用资料 → persona；人物所有者或网站管理员 | 延续既有所有权，不给世界成员增加跨世界人物编辑权；条目自写姓名仍优先 | 已接入 C |
| 分类名称 | 原 world_home_revisions / world_home_publications | 共用资料 → 分类名称；原世界管理员权限 | 只改 categoryNames，保留其他首页配置；审核发布与历史恢复使用原权威源 | 已接入 C |
| 手记 | review 内容版本／父条目固定 | 条目“管理此条目的手记”／“新增后台手记”及全局分类搜索分页 | 只有已发布手记纳入总评分、分布、关键词计数；不实现游客投稿／回复 | 已接入 A、B、D |
| 评分汇总、分布、计数、设施总数 | publishedDetail 对当前公开集合计算／模板按数组计数 | 只读；在真实详情预览查看 | 不提供直接覆盖；房东叙事统计另有 attributes.stay.* 字段，不混为实际评价 | 已核对 D |
| 稳定 ID、发布／签发时间、预订总价 | contents／publications／不可变 bookings 快照 | 只读 | 新价格／名称不修改历史凭条，恢复内容不回退全世界资料 | 已核对 A、D |

## 共用详情文案注册表

保存于网站级 copy 设置的双语版本。仅网站管理员可维护；按 common 与三类差异组织，不做世界／条目覆盖。正文按文本转义，动态模板只允许表中注册的占位符；one／other 对应单复数。历史配置缺少新增注册键时只在读取时补同义默认值，不修改历史正文。

文案来源是原三类详情、图库、展开、评分、Trip 行程摘要及预订入口；独立预订确认页和凭条模板不在本次范围。几何图形、锚点、机器字段名、UTC、固定业务数字不做可编辑文案。地图故事标注归 text.map；其旧文字仅为老条目兼容兜底。

| 注册键 | 作用域 | 英文初值 | 中文初值 | 状态 |
| --- | --- | --- | --- | --- |
| `common.e0e8907ccca8` | common | Visitor notes pages | 手记分页 | 已接入 C；注册键校验 |
| `common.a57b08a480b8` | common | Previous | 上一页 | 已接入 C；注册键校验 |
| `common.1ff57a29d7c9` | common | Next | 下一页 | 已接入 C；注册键校验 |
| `common.0f882d93021f` | common | Stay highlights | 住宿亮点 | 已接入 C；注册键校验 |
| `common.3e671d3a0d15` | common | Amenities | 设施 | 已接入 C；注册键校验 |
| `common.2d2e835244cc` | common | What you’ll do | 活动行程 | 已接入 C；注册键校验 |
| `common.a441e0502556` | common | What’s included | 包含项目 | 已接入 C；注册键校验 |
| `common.89f957ebb1eb` | common | Facilities | 设施 | 已接入 C；注册键校验 |
| `common.7b3dbe39b457` | common | Service offerings | 服务项目 | 已接入 C；注册键校验 |
| `common.3ab8b679555e` | common | Service itinerary | 服务流程 | 已接入 C；注册键校验 |
| `common.530c5047a524` | common | Things to know about your stay | 入住须知 | 已接入 C；注册键校验 |
| `common.52a98807af09` | common | Before you join | 参与须知 | 已接入 C；注册键校验 |
| `common.8d26b58e370e` | common | Before your service | 服务须知 | 已接入 C；注册键校验 |
| `common.5bb55a4bb4fd` | common | View image | 查看图片 | 已接入 C；注册键校验 |
| `common.83185eb03074` | common | Photo gallery | 图库 | 已接入 C；注册键校验 |
| `common.324ca03d1fe9` | common | View photos | 查看图片 | 已接入 C；注册键校验 |
| `common.ac1a410c2005` | common | Photo viewer | 图片查看器 | 已接入 C；注册键校验 |
| `common.7d9eb7acb13e` | common | Close | 关闭 | 已接入 C；注册键校验 |
| `common.8d25d2b1ce81` | common | This image is unavailable. | 图片暂时无法显示。 | 已接入 C；注册键校验 |
| `common.f0a859a7ecd7` | common | Previous image | 上一张图片 | 已接入 C；注册键校验 |
| `common.a4903f732746` | common | Next image | 下一张图片 | 已接入 C；注册键校验 |
| `common.af127f7c419b` | common | No photos yet | 暂无图片 | 已接入 C；注册键校验 |
| `common.7a05fdb42e27` | common | Your host | 房东 | 已接入 C；注册键校验 |
| `common.9ea70d66fa69` | common | Your guide | 向导 | 已接入 C；注册键校验 |
| `common.22fa48ede44e` | common | Your service provider | 服务提供者 | 已接入 C；注册键校验 |
| `stay.f230b2d2e886` | stay | To be added | 待补充 | 已接入 C；注册键校验 |
| `stay.82cd8a1b364b` | stay | Things to know | 入住须知 | 已接入 C；注册键校验 |
| `stay.51d5a0527c80` | stay | Cancellation policy | 取消政策 | 已接入 C；注册键校验 |
| `stay.1be38d27d5c5` | stay | Cancellation policy will be added. | 取消政策待补充。 | 已接入 C；注册键校验 |
| `stay.595148fbc8f6` | stay | Review the host’s full policy for details. | 请查看房东的完整政策说明。 | 已接入 C；注册键校验 |
| `stay.1445799c033a` | stay | Learn more | 了解更多 | 已接入 C；注册键校验 |
| `stay.152b8e467b19` | stay | House rules | 房屋守则 | 已接入 C；注册键校验 |
| `stay.6ed134d0c013` | stay | Check-in:  | 入住： | 已接入 C；注册键校验 |
| `stay.44a086fa5bff` | stay | Checkout:  | 退房： | 已接入 C；注册键校验 |
| `stay.6fb0e04a7e58` | stay | Maximum guests:  | 最多接待： | 已接入 C；注册键校验 |
| `stay.e3b0c44298fc` | stay |  |  位旅客 | 已接入 C；注册键校验 |
| `stay.d820b9cf68d5` | stay | Full house rules will be added. | 完整房屋守则待补充。 | 已接入 C；注册键校验 |
| `stay.7b571f798c06` | stay | Safety & property | 安全与房产信息 | 已接入 C；注册键校验 |
| `stay.dab3b3a889cb` | stay | Alarm equipment and shared-area information will be added. | 报警设备及共用区域说明待补充。 | 已接入 C；注册键校验 |
| `stay.d0637b9e278b` | stay | Full safety details will be added. | 完整安全信息待补充。 | 已接入 C；注册键校验 |
| `stay.f77017c8b8f3` | stay | Host name to be added | 房东姓名待补充 | 已接入 C；注册键校验 |
| `stay.5cbb23579a09` | stay | Meet your host | 认识你的房东 | 已接入 C；注册键校验 |
| `stay.5310be08511b` | stay | Status to be added | 身份待补充 | 已接入 C；注册键校验 |
| `stay.84cb7871b741` | stay | Reviews | 条手记 | 已接入 C；注册键校验 |
| `stay.9f29530464f7` | stay | Rating | 评分 | 已接入 C；注册键校验 |
| `stay.3f03d2e19f5c` | stay | Years hosting | 年接待经验 | 已接入 C；注册键校验 |
| `stay.b9fecd5fa827` | stay | Profile statistics are demonstration details | 人物数据为演示占位 | 已接入 C；注册键校验 |
| `stay.e10325859972` | stay | About the host | 关于房东 | 已接入 C；注册键校验 |
| `stay.7245a7fbd628` | stay | Host status details will be added. | 房东身份说明待补充。 | 已接入 C；注册键校验 |
| `stay.312dcb7543b1` | stay | The host’s introduction will be added. | 房东介绍待补充。 | 已接入 C；注册键校验 |
| `stay.49a9db7034ab` | stay | Host details | 房东详情 | 已接入 C；注册键校验 |
| `stay.1e70a60de9a2` | stay | Response rate:  | 回复率： | 已接入 C；注册键校验 |
| `stay.0a2391a770e1` | stay | Response time will be added. | 回复时间待补充。 | 已接入 C；注册键校验 |
| `stay.5e3649316260` | stay | Message host | 联系房东 | 已接入 C；注册键校验 |
| `stay.cbc7311e953e` | stay | Contact information | 联系说明 | 已接入 C；注册键校验 |
| `stay.763fd69ff9cf` | stay | Contact details will be added. Messaging is not available yet. | 联系资料待补充，当前不发送消息。 | 已接入 C；注册键校验 |
| `common.ff35464a986d` | common | Cleanliness | 清洁度 | 已接入 C；注册键校验 |
| `common.ac991dd3c2d9` | common | Accuracy | 描述准确度 | 已接入 C；注册键校验 |
| `common.adc719587244` | common | Check-in | 入住体验 | 已接入 C；注册键校验 |
| `common.3981a2b9c1ef` | common | Communication | 沟通 | 已接入 C；注册键校验 |
| `common.15b61974b270` | common | Location | 位置 | 已接入 C；注册键校验 |
| `common.8e37953d23da` | common | Value | 性价比 | 已接入 C；注册键校验 |
| `common.470fa4d064af` | common | Guest impressions | 旅客口碑 | 已接入 C；注册键校验 |
| `common.fe237b713325` | common | No ratings yet. The first visitor note is still to come. | 暂无评分，期待第一篇手记。 | 已接入 C；注册键校验 |
| `common.ee62b830579d` | common | Overall rating | 总体评分 | 已接入 C；注册键校验 |
| `common.8dc08c579c80` | common | Guests mention | 旅客提到 | 已接入 C；注册键校验 |
| `common.e95df0a670a3` | common | Topics and mention counts will appear when visitor notes are published. | 关键词与提及次数将在手记发布后显示。 | 已接入 C；注册键校验 |
| `common.b96b8940a78d` | common | Visitor name to be added | 旅客姓名待补充 | 已接入 C；注册键校验 |
| `common.826ddb22062f` | common | From: to be added | 来自：待补充 | 已接入 C；注册键校验 |
| `common.f5ad08711247` | common | Not rated | 暂无评分 | 已接入 C；注册键校验 |
| `common.8cebb75b5359` | common | Session details to be added | 参与场次待补充 | 已接入 C；注册键校验 |
| `common.abef7bda2210` | common | Stay duration to be added | 住宿时长待补充 | 已接入 C；注册键校验 |
| `common.f5c9bd131486` | common | Show more | 显示更多 | 已接入 C；注册键校验 |
| `common.c69baa806b04` | common | The first visitor’s note | 第一位旅客的手记 | 已接入 C；注册键校验 |
| `common.3673805e49e3` | common | Visitor, origin, rating, date and session details to be added. | 人物、所在地、评分、日期与参与场次待补充。 | 已接入 C；注册键校验 |
| `common.9da88ec557fa` | common | Visitor, origin, rating, date and stay duration to be added. | 人物、所在地、评分、日期与住宿时长待补充。 | 已接入 C；注册键校验 |
| `common.600c98bec661` | common | No published visitor notes yet. | 暂无公开手记。 | 已接入 C；注册键校验 |
| `stay.49b22c5ff090` | stay | Find things to do | 寻找当地活动 | 已接入 C；注册键校验 |
| `stay.9d9987d0479a` | stay | Try a local café | 试试附近的咖啡馆 | 已接入 C；注册键校验 |
| `stay.6583c82a9662` | stay | Find public transit | 查找公共交通 | 已接入 C；注册键校验 |
| `stay.3ca8750b2344` | stay | Explore dining | 探索附近餐饮 | 已接入 C；注册键校验 |
| `stay.071f044c6226` | stay | Where you’ll be | 你将入住的地区 | 已接入 C；注册键校验 |
| `stay.b9a87f6a4d84` | stay | Neighborhood details will be added. | 周边环境介绍待补充。 | 已接入 C；注册键校验 |
| `stay.15e9450f0b47` | stay | Fictional area sketch: the stay is in the centre, with a shuttle stop, lounge and shared dining area nearby. | 虚构区域示意图：住宿位于中央，附近有接驳站、休息区和公共用餐区。 | 已接入 C；注册键校验 |
| `stay.fb1383dda7c8` | stay | Shuttle stop | 接驳站 | 已接入 C；注册键校验 |
| `stay.6b9b9841cfc5` | stay | Guest lounge | 旅客休息区 | 已接入 C；注册键校验 |
| `stay.adf7b51953dc` | stay | Dining area | 公共用餐区 | 已接入 C；注册键校验 |
| `stay.1889d7219168` | stay | Your stay | 你的住宿 | 已接入 C；注册键校验 |
| `stay.aa5c24a5fbf6` | stay | Fictional area sketch · no real-world coordinates | 虚构区域示意图 · 不对应现实坐标 | 已接入 C；注册键校验 |
| `stay.a37cfce76233` | stay | Nearby places and directions will be added. | 周边地点与路线资料待补充。 | 已接入 C；注册键校验 |
| `stay.f98b000a4a7b` | stay | Browse local experiences | 浏览该地区的活动 | 已接入 C；注册键校验 |
| `common.94ea9b1d33a0` | common | Show less | 收起 | 已接入 C；注册键校验 |
| `stay.5b2e8b31f550` | stay | Other amenities | 其他设施 | 已接入 C；注册键校验 |
| `stay.ca1844969742` | stay | Unavailable | 不提供 | 已接入 C；注册键校验 |
| `stay.adadface0166` | stay | Not reported | 未说明 | 已接入 C；注册键校验 |
| `stay.e674447337e8` | stay | Available | 提供 | 已接入 C；注册键校验 |
| `stay.3e671d3a0d15` | stay | Amenities | 设施 | 已接入 C；注册键校验 |
| `stay.71ee965f758d` | stay | What this place offers | 这里提供什么 | 已接入 C；注册键校验 |
| `stay.7a1378cf0bb3` | stay | The amenity list and availability details will be added. | 设施清单待补充，可用状态尚未说明。 | 已接入 C；注册键校验 |
| `stay.70c14ae289a8` | stay | View amenity details | 查看设施说明 | 已接入 C；注册键校验 |
| `stay.54078186a1f9` | stay | The host has not provided a complete amenity list. | 房东尚未提供完整设施资料。 | 已接入 C；注册键校验 |
| `stay.0af9fcf87085` | stay | Bathroom details to be added | 卫浴信息待补充 | 已接入 C；注册键校验 |
| `stay.794adbbc6c1c` | stay | Arrival | 入住方式 | 已接入 C；注册键校验 |
| `stay.542aa51c9ff9` | stay | The room | 房间空间 | 已接入 C；注册键校验 |
| `stay.e741dc32bad3` | stay | Bathroom arrangement | 卫浴安排 | 已接入 C；注册键校验 |
| `stay.bd4c0e9d47b0` | stay | Property type to be added | 住宿类型待补充 | 已接入 C；注册键校验 |
| `stay.c400c7c7b104` | stay | Includes demonstration details | 含演示占位资料 | 已接入 C；注册键校验 |
| `stay.470fa4d064af` | stay | Guest impressions | 旅客口碑 | 已接入 C；注册键校验 |
| `stay.80a902cd152f` | stay | Guest favorite details to be added. | 旅客喜爱说明待补充。 | 已接入 C；注册键校验 |
| `stay.0e9c11956561` | stay | Out of 5 stars | 满分 5 分 | 已接入 C；注册键校验 |
| `stay.f5ad08711247` | stay | Not rated | 暂无评分 | 已接入 C；注册键校验 |
| `stay.d04444a24aef` | stay | Hosted by  | 房东： | 已接入 C；注册键校验 |
| `stay.b3dc481b0262` | stay | Host status to be added | 身份待补充 | 已接入 C；注册键校验 |
| `stay.c941c35b5a4c` | stay | Hosting experience to be added | 接待年限待补充 | 已接入 C；注册键校验 |
| `stay.89fe62428fe4` | stay | Listing highlights | 住宿亮点 | 已接入 C；注册键校验 |
| `stay.acb3e644d2bc` | stay | About this stay | 关于这处住宿 | 已接入 C；注册键校验 |
| `stay.dc2daee9e538` | stay | A detailed introduction will be added. | 详细介绍待补充。 | 已接入 C；注册键校验 |
| `stay.b40e7b090f18` | stay | The space | 房间与公共空间 | 已接入 C；注册键校验 |
| `stay.5b69ce210693` | stay | Room layout and shared-space details will be added. | 房间布局与公共空间说明待补充。 | 已接入 C；注册键校验 |
| `stay.e33b85e5ec1b` | stay | Registration details | 登记信息 | 已接入 C；注册键校验 |
| `stay.e6f9b5bd02f9` | stay | Registration details will be added. | 登记信息待补充。 | 已接入 C；注册键校验 |
| `stay.b435a340b94f` | stay | Where you’ll sleep | 你将在哪里休息 | 已接入 C；注册键校验 |
| `stay.0b42cfcdd7ec` | stay | Sleeping arrangements | 睡眠安排 | 已接入 C；注册键校验 |
| `stay.40820da6d314` | stay | Bedroom and bed details will be added. | 卧室与床铺详情待补充。 | 已接入 C；注册键校验 |
| `service.c4304ac222b1` | service | Details will be added. | 资料待补充。 | 已接入 C；注册键校验 |
| `service.8f3546ff9269` | service | Your local provider | 当地服务提供者 | 已接入 C；注册键校验 |
| `service.8eab0f09df01` | service | Experience | 服务经验 | 已接入 C；注册键校验 |
| `service.74cf2bc63fe1` | service | Achievements | 代表成就 | 已接入 C；注册键校验 |
| `service.7b4339cf860e` | service | Qualifications | 专业研修 | 已接入 C；注册键校验 |
| `service.9504f09b836f` | service | Guest requirements | 参与要求 | 已接入 C；注册键校验 |
| `service.d3368cbffe23` | service | Accessibility | 无障碍设施 | 已接入 C；注册键校验 |
| `service.51d5a0527c80` | service | Cancellation policy | 取消政策 | 已接入 C；注册键校验 |
| `service.64c5c0bea212` | service | Service introduction and price | 服务简介与价格 | 已接入 C；注册键校验 |
| `service.d44e4d4d638f` | service | View the service gallery | 查看服务图库 | 已接入 C；注册键校验 |
| `service.73cdecabc2d8` | service | About the provider | 查看服务提供者 | 已接入 C；注册键校验 |
| `service.93db883afe39` | service | Provided at  | 服务地点： | 已接入 C；注册键校验 |
| `service.dce550d322a1` | service | Price & dates | 价格与日期 | 已接入 C；注册键校验 |
| `service.45a65c0fe304` | service | and up | 起 | 已接入 C；注册键校验 |
| `service.d8f544ae44f8` | service | See cancellation policy | 查看取消政策 | 已接入 C；注册键校验 |
| `service.127ccb7a9341` | service | Show dates | 查看日期 | 已接入 C；注册键校验 |
| `service.a77c8b5bcdbb` | service | Simulation sessions · UTC · fictional reservations available | 模拟场次 · UTC · 可预约虚构服务 | 已接入 C；注册键校验 |
| `service.45314e97b0c2` | service | Simulation | 模拟场次 | 已接入 C；注册键校验 |
| `service.424a2551d356` | service | Expired | 已过期 | 已接入 C；注册键校验 |
| `service.97e32dd21c8f` | service | Open reservations to view daily simulation sessions. | 进入预约查看每日模拟场次。 | 已接入 C；注册键校验 |
| `service.aa507865bef3` | service | A fictional-world service · no real payment | 虚构世界服务 · 不涉及真实付款 | 已接入 C；注册键校验 |
| `service.7b3dbe39b457` | service | Service offerings | 服务内容 | 已接入 C；注册键校验 |
| `service.1089b7332514` | service | View service photos | 查看服务图片 | 已接入 C；注册键校验 |
| `service.9ce2042fd666` | service | You can discuss your needs with the provider. | 可与服务提供者讨论你的具体需求。 | 已接入 C；注册键校验 |
| `service.99f47067f585` | service | Message provider | 联系提供者 | 已接入 C；注册键校验 |
| `service.b7a17f6da566` | service | Full service details | 查看完整服务说明 | 已接入 C；注册键校验 |
| `service.2b049606af7f` | service | Service process | 服务流程 | 已接入 C；注册键校验 |
| `service.89f957ebb1eb` | service | Facilities | 设施 | 已接入 C；注册键校验 |
| `service.51e8a030db39` | service | My qualifications | 服务资质 | 已接入 C；注册键校验 |
| `service.e65248f8c934` | service | Experience and qualifications are fictional character details. | 人物经历与资质为虚构设定。 | 已接入 C；注册键校验 |
| `service.2f77668a9dfb` | service | Message | 联系 | 已接入 C；注册键校验 |
| `service.f94c695a8aa7` | service | Messaging is not open yet. This page does not send messages. | 联系功能尚未开放，本页不会发送消息。 | 已接入 C；注册键校验 |
| `service.344524f92990` | service | A fictional journey: no off-site payment or real identity documents are needed. | 这是一次虚构旅行，无需站外付款或提供真实证件。 | 已接入 C；注册键校验 |
| `service.3108d06b89ff` | service | My gallery | 服务图库 | 已接入 C；注册键校验 |
| `service.32d493cd7db4` | service | Where you’ll go | 服务地点 | 已接入 C；注册键校验 |
| `service.0299b0fecc71` | service | Fictional quarter map: shuttle stop, workshop and guest lounge. | 虚构街区地图：接驳站、检修工坊和旅客休息区。 | 已接入 C；注册键校验 |
| `service.fb1383dda7c8` | service | Shuttle stop | 接驳站 | 已接入 C；注册键校验 |
| `service.6b9b9841cfc5` | service | Guest lounge | 旅客休息区 | 已接入 C；注册键校验 |
| `service.c0086f23dcdd` | service | Workshop | 检修工坊 | 已接入 C；注册键校验 |
| `service.aa5c24a5fbf6` | service | Fictional area sketch · no real-world coordinates | 虚构区域示意图 · 不对应现实坐标 | 已接入 C；注册键校验 |
| `service.ecb4213bb230` | service | Getting here | 查看抵达路线 | 已接入 C；注册键校验 |
| `service.82cd8a1b364b` | service | Things to know | 须知 | 已接入 C；注册键校验 |
| `service.5871e1abaa63` | service | Additional notes | 其他须知 | 已接入 C；注册键校验 |
| `experience.09f1f6023c1d` | experience | Dates & prices | 场次与价格 | 已接入 C；注册键校验 |
| `experience.218197693424` | experience | From | 每位 | 已接入 C；注册键校验 |
| `experience.248f347044eb` | experience | / guest | 起 | 已接入 C；注册键校验 |
| `experience.281605042f35` | experience | In-story release time | 故事中的开放时间 | 已接入 C；注册键校验 |
| `experience.4cd6c87e8135` | experience | About simulation sessions | 关于模拟场次 | 已接入 C；注册键校验 |
| `experience.c16bc4a3c5b9` | experience | These are fictional sessions. Reserve a visit below, review your trip and collect a ticket. No notifications are subscribed. | 这些是虚构场次。现在可进入模拟预约，核对行程与价格后领取活动票；不会订阅通知。 | 已接入 C；注册键校验 |
| `experience.45314e97b0c2` | experience | Simulation | 模拟场次 | 已接入 C；注册键校验 |
| `experience.424a2551d356` | experience | Expired | 已过期 | 已接入 C；注册键校验 |
| `experience.97e32dd21c8f` | experience | Open reservations to view daily simulation sessions. | 进入预约查看每日模拟场次。 | 已接入 C；注册键校验 |
| `experience.3abbc6ac92e1` | experience | Fictional experience · sample sessions · all times UTC | 虚构体验 · 样例场次 · 时间以 UTC 为准 | 已接入 C；注册键校验 |
| `experience.c4304ac222b1` | experience | Details will be added. | 资料待补充。 | 已接入 C；注册键校验 |
| `experience.c720812efd54` | experience | Your local guide | 当地向导 | 已接入 C；注册键校验 |
| `experience.f772bf271285` | experience | Hosted by | 由 | 已接入 C；注册键校验 |
| `experience.6e3f3f5ac222` | experience | Around | 约 | 已接入 C；注册键校验 |
| `experience.977d304ee538` | experience | Your host’s expertise | 向导的专业经历 | 已接入 C；注册键校验 |
| `experience.a5b2a013ce39` | experience | About this experience | 关于这项体验 | 已接入 C；注册键校验 |
| `experience.9504f09b836f` | experience | Guest requirements | 参与者要求 | 已接入 C；注册键校验 |
| `experience.95e7781119cc` | experience | Activity level | 活动强度 | 已接入 C；注册键校验 |
| `experience.3090fd37d1a6` | experience | What to bring | 需要携带 | 已接入 C；注册键校验 |
| `experience.d3368cbffe23` | experience | Accessibility | 无障碍设施 | 已接入 C；注册键校验 |
| `experience.51d5a0527c80` | experience | Cancellation policy | 取消政策 | 已接入 C；注册键校验 |
| `experience.ab93729874da` | experience | Pre-screening | 参加前须知 | 已接入 C；注册键校验 |
| `experience.ad1a01429fcc` | experience | LOCAL EXPERIENCE | 当地体验 | 已接入 C；注册键校验 |
| `experience.27d52d60f26e` | experience | Group details pending | 团体安排待补充 | 已接入 C；注册键校验 |
| `experience.9ccec44e67fc` | experience | Cancellation details pending | 取消政策待补充 | 已接入 C；注册键校验 |
| `experience.89fe62428fe4` | experience | Listing highlights | 活动细节 | 已接入 C；注册键校验 |
| `experience.2d2e835244cc` | experience | What you’ll do | 你会做什么 | 已接入 C；注册键校验 |
| `experience.addcd2638a0e` | experience | More about the experience | 更多活动介绍 | 已接入 C；注册键校验 |
| `experience.f746cd0fc7d1` | experience | The experience, step by step | 一起度过的时光 | 已接入 C；注册键校验 |
| `experience.a441e0502556` | experience | What’s included | 包含项目 | 已接入 C；注册键校验 |
| `experience.89f957ebb1eb` | experience | Facilities | 设施 | 已接入 C；注册键校验 |
| `experience.de36211d6505` | experience | Where we’ll meet | 见面地点 | 已接入 C；注册键校验 |
| `experience.fbbf87c33050` | experience | Fictional meeting area: shuttle stop, meeting point and foundry gallery. | 虚构集合区域示意图：接驳站、集合点与铸造区观察廊。 | 已接入 C；注册键校验 |
| `experience.fb1383dda7c8` | experience | Shuttle stop | 接驳站 | 已接入 C；注册键校验 |
| `experience.6e95ac910fbc` | experience | Viewing gallery | 观察廊 | 已接入 C；注册键校验 |
| `experience.7a75be8fa1f4` | experience | Meet here | 在这里碰面 | 已接入 C；注册键校验 |
| `experience.aa5c24a5fbf6` | experience | Fictional area sketch · no real-world coordinates | 虚构区域示意图 · 不对应现实坐标 | 已接入 C；注册键校验 |
| `experience.ecb4213bb230` | experience | Getting here | 查看抵达路线 | 已接入 C；注册键校验 |
| `experience.1359ec883b21` | experience | About me | 关于向导 | 已接入 C；注册键校验 |
| `experience.d17af4eb253b` | experience | Your local perspective | 带你认识这个世界 | 已接入 C；注册键校验 |
| `experience.2f77668a9dfb` | experience | Message | 联系 | 已接入 C；注册键校验 |
| `experience.7cc79de89fef` | experience | Messaging is not open. This page does not send messages. | 联系功能尚未开放，本页不会发送消息。 | 已接入 C；注册键校验 |
| `experience.344524f92990` | experience | A fictional journey: no off-site payment or real identity documents are needed. | 这是一次虚构旅行。无需站外付款，也无需提供真实证件。 | 已接入 C；注册键校验 |
| `experience.82cd8a1b364b` | experience | Things to know | 须知 | 已接入 C；注册键校验 |
| `experience.0cad1307a4aa` | experience | Additional participation notes | 其他参与须知 | 已接入 C；注册键校验 |
| `common.18190a039832` | common | Stay detail sections | 住宿详情栏目 | 已接入 C；注册键校验 |
| `common.d4b1ea5708dd` | common | Overview | 概览 | 已接入 C；注册键校验 |
| `common.84cb7871b741` | common | Reviews | 手记 | 已接入 C；注册键校验 |
| `common.4a823118b9ba` | common | Host | 房东 | 已接入 C；注册键校验 |
| `common.82cd8a1b364b` | common | Things to know | 须知 | 已接入 C；注册键校验 |
| `common.c55648fd345c` | common | Price and trip preferences | 价格与行程 | 已接入 C；注册键校验 |
| `common.64bd46206f05` | common | Trip summary | 旅行摘要 | 已接入 C；注册键校验 |
| `common.c7ef0e278b1e` | common | Back to results | 返回列表 | 已接入 C；注册键校验 |
| `common.ba12ecefbd57` | common | Continue exploring | 继续浏览 | 已接入 C；注册键校验 |
| `common.c6f26ab48e8f` | common | Explore more in this world | 继续探索这个世界 | 已接入 C；注册键校验 |
| `common.2353ac329ba0` | common | Trip preferences | 行程条件 | 已接入 C；注册键校验 |
| `common.5dd40cfcfbba` | common | travellers | 人 | 已接入 C；注册键校验 |
| `common.5d88c569d237` | common | rooms | 间客房 | 已接入 C；注册键校验 |
| `common.822bab8d41bc` | common | Quantity | 数量 | 已接入 C；注册键校验 |
| `common.e9376a281aac` | common | Morning | 上午 | 已接入 C；注册键校验 |
| `common.fb847b43637e` | common | Afternoon | 下午 | 已接入 C；注册键校验 |
| `common.458c1fed5743` | common | Evening | 晚间 | 已接入 C；注册键校验 |
| `common.4dea2d1a0abc` | common | Your choices are saved; availability has not been checked. | 已保留你的选择，尚未核查余量。 | 已接入 C；注册键校验 |
| `common.338e55831e0a` | common | Draft preview · booking disabled | 草稿预览 · 不可预订 | 已接入 C；注册键校验 |
| `common.39d1be31f0bb` | common | No account needed · no real charge | 无需注册 · 不会真实扣款 | 已接入 C；注册键校验 |
| `common.f6172aa8c318` | common | Recover my latest document for this listing | 恢复此内容的最近凭条 | 已接入 C；注册键校验 |
| `stay.guests.one` | stay | {count} guest | {count} 位旅客 | 已接入 C；注册键校验 |
| `stay.guests.other` | stay | {count} guests | {count} 位旅客 | 已接入 C；注册键校验 |
| `stay.bedrooms.one` | stay | {count} bedroom | {count} 间卧室 | 已接入 C；注册键校验 |
| `stay.bedrooms.other` | stay | {count} bedrooms | {count} 间卧室 | 已接入 C；注册键校验 |
| `stay.beds.one` | stay | {count} bed | {count} 张床 | 已接入 C；注册键校验 |
| `stay.beds.other` | stay | {count} beds | {count} 张床 | 已接入 C；注册键校验 |
| `stay.hostYears.one` | stay | {count} year hosting | {count} 年接待经验 | 已接入 C；注册键校验 |
| `stay.hostYears.other` | stay | {count} years hosting | {count} 年接待经验 | 已接入 C；注册键校验 |
| `stay.allNotes.one` | stay | Read all {count} visitor notes | 查看全部 {count} 条游客手记 | 已接入 C；注册键校验 |
| `stay.allNotes.other` | stay | Read all {count} visitor notes | 查看全部 {count} 条游客手记 | 已接入 C；注册键校验 |
| `stay.allAmenities.one` | stay | Show all {count} amenities | 查看全部 {count} 项设施 | 已接入 C；注册键校验 |
| `stay.allAmenities.other` | stay | Show all {count} amenities | 查看全部 {count} 项设施 | 已接入 C；注册键校验 |
| `common.rated.one` | common | {count} rated reviews · out of 5 | {count} 条评分 · 满分 5 分 | 已接入 C；注册键校验 |
| `common.rated.other` | common | {count} rated reviews · out of 5 | {count} 条评分 · 满分 5 分 | 已接入 C；注册键校验 |
| `common.distribution.one` | common | {rating} stars: {count} reviews | {rating} 星：{count} 条 | 已接入 C；注册键校验 |
| `common.distribution.other` | common | {rating} stars: {count} reviews | {rating} 星：{count} 条 | 已接入 C；注册键校验 |
| `common.ratingCount.one` | common | {count} ratings | {count} 条评分 | 已接入 C；注册键校验 |
| `common.ratingCount.other` | common | {count} ratings | {count} 条评分 | 已接入 C；注册键校验 |
| `common.stars.one` | common | {count} out of 5 stars | {count} 星，满分 5 星 | 已接入 C；注册键校验 |
| `common.stars.other` | common | {count} out of 5 stars | {count} 星，满分 5 星 | 已接入 C；注册键校验 |
| `common.notePage.one` | common | {count} notes in total, showing up to {pageSize} per page. | 共 {count} 条手记，每页最多显示 {pageSize} 条。 | 已接入 C；注册键校验 |
| `common.notePage.other` | common | {count} notes in total, showing up to {pageSize} per page. | 共 {count} 条手记，每页最多显示 {pageSize} 条。 | 已接入 C；注册键校验 |
| `service.reviews.one` | service | {count} reviews | {count} 条评价 | 已接入 C；注册键校验 |
| `service.reviews.other` | service | {count} reviews | {count} 条评价 | 已接入 C；注册键校验 |
| `common.ui.home` | common | Browse | 浏览 | 已接入 C；注册键校验 |
| `common.ui.sample` | common | Fictional sample content | 虚构占位内容 | 已接入 C；注册键校验 |
| `common.ui.stays` | common | Homes | 住宿 | 已接入 C；注册键校验 |
| `common.ui.experiences` | common | Experiences | 活动 | 已接入 C；注册键校验 |
| `common.ui.services` | common | Services | 服务 | 已接入 C；注册键校验 |
| `common.ui.session` | common | session | 次 | 已接入 C；注册键校验 |
| `common.ui.notes` | common | Fictional visitor notes | 虚构游客手记 | 已接入 C；注册键校验 |
| `common.ui.empty` | common | No published content yet. | 暂无已发布内容。 | 已接入 C；注册键校验 |
| `common.ui.fallback` | common | This content is currently shown in its original language. | 此内容暂以原文展示。 | 已接入 C；注册键校验 |
| `common.ui.notFound` | common | This page could not be found. | 未找到此页面。 | 已接入 C；注册键校验 |
| `common.ui.unavailable` | common | Content is temporarily unavailable. Please try again. | 内容暂时无法读取，请稍后重试。 | 已接入 C；注册键校验 |
| `common.ui.night` | common | night | 晚 | 已接入 C；注册键校验 |
| `common.ui.person` | common | person | 人 | 已接入 C；注册键校验 |
| `common.ui.minutes` | common | minutes | 分钟 | 已接入 C；注册键校验 |
| `common.ui.facilities` | common | Facilities | 设施 | 已接入 C；注册键校验 |
| `common.ui.rules` | common | Things to know | 须知 | 已接入 C；注册键校验 |
| `common.ui.itinerary` | common | Itinerary | 行程 | 已接入 C；注册键校验 |
| `common.ui.about` | common | Homes, experiences and services in fictional worlds. All journeys and prices are fictional. | 在虚构世界中寻找住宿、活动与服务。所有旅行和价格均为虚构。 | 已接入 C；注册键校验 |
| `common.ui.uiFallback` | common | The interface is currently shown in English. | 界面暂以英语展示。 | 已接入 C；注册键校验 |
| `common.bookStay` | common | Book a fictional stay | 模拟预订 | 已接入 C；注册键校验 |
| `common.bookVisit` | common | Reserve a fictional visit | 模拟预约 | 已接入 C；注册键校验 |
| `common.aa997eae79ec` | common | Previous | 上一张 | 已接入 C；注册键校验 |
| `common.18e9e13c7360` | common | Next | 下一张 | 已接入 C；注册键校验 |
| `stay.257b19675376` | stay | Reviews | 条评价 | 已接入 C；注册键校验 |
| `common.4ef7ceec3ac6` | common | Show more | 查看完整手记 | 已接入 C；注册键校验 |
| `common.imagePosition` | common | View image {index} / {count} | 查看图片 {index} / {count} | 已接入 C；注册键校验 |

## 已说明的边界

- 无图片上传／裁剪，使用已有 /media 路径或 HTTPS 地址；图片说明字段可刷新，失效图片显示错误并保留地址。
- 世界／地点／人物只维护详情依赖资料，不扩展创建世界、邀请成员或角色社交管理。
- 演示叙事和正式文字审定留阶段 6；游客评价与回复留阶段 5.6。
