# 预约与确认

范围：拉斯世界预约开始、资料填写与确认阶段；本轮字段以活动预约为例。

状态：2026-10-19 已录用以下 14 条英文。中文待统一校订；全部未应用。签发祝福单独维护于 [旅行凭条](receipt.md)。

依据：用户对三阶段文案及预约第一步 12 条配套英文清单回复“可以的”，同意英文录用、中文继续留待统一校订。见 [来源确认](../sources/2026-10-19-web-chat.md#预约三阶段与配套英文录用确认)；维护规则见 [文案库入口](../README.md)。编号为文案库追踪编号，不代表现有程序键。

## booking.start.title

- 页面位置：预约开始标题
- 英文审定状态：已确认
- 中文参考：一段值得记录的旅程。
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

A journey worth recording.

## booking.review.title

- 页面位置：确认阶段标题
- 英文审定状态：已确认
- 中文参考：各项细节，悉数核对。
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

Every detail accounted for.

## booking.start.eyebrow

- 页面位置：顶部小标题
- 英文审定状态：已确认
- 中文参考：尚未录入
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

LATHE WORLDS TRAVEL / JOURNEY DESK

## booking.start.intro

- 页面位置：页面介绍
- 英文审定状态：已确认
- 中文参考：尚未录入
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

Choose your itinerary, review the quoted price, and collect your travel document.

## booking.steps.choose

- 页面位置：步骤 01
- 英文审定状态：已确认
- 中文参考：尚未录入
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

Choose your itinerary

## booking.steps.review

- 页面位置：步骤 02
- 英文审定状态：已确认
- 中文参考：尚未录入
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

Review & confirm

## booking.steps.collect

- 页面位置：步骤 03
- 英文审定状态：已确认
- 中文参考：尚未录入
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

Collect your document

## booking.particulars.title

- 页面位置：行程资料区
- 英文审定状态：已确认
- 中文参考：尚未录入
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

Journey particulars

## booking.experience.date

- 页面位置：活动日期
- 英文审定状态：已确认
- 中文参考：尚未录入
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

Travel date · UTC

## booking.experience.session

- 页面位置：活动场次
- 英文审定状态：已确认
- 中文参考：尚未录入
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

Session time · UTC

## booking.experience.session-placeholder

- 页面位置：场次选择提示
- 英文审定状态：已确认
- 中文参考：尚未录入
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

Select a session time

## booking.experience.travellers

- 页面位置：人数
- 英文审定状态：已确认
- 中文参考：尚未录入
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

Travellers

## booking.experience.pricing-note

- 页面位置：活动计价说明
- 英文审定状态：已确认
- 中文参考：尚未录入
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

Per person, per session · all times UTC.

## booking.review.cta

- 页面位置：下一步按钮
- 英文审定状态：已确认
- 中文参考：尚未录入
- 中文审定状态：待确认，统一校订前不作为定稿
- 落地状态：未应用
- 实现位置：代码键或数据库实体／字段待应用前核对

Review itinerary & price →

## 应用前核对事项

- 三阶段依次为预约开始、确认、签发；签发的 `May your course run true.` 是祝福文案，见凭条文件，不据此确定它必须充当页面主标题。
- 页面介绍采用最后一轮的 `collect your travel document` 版本，不采用此前 `collect a travel document for your records` 候选。
- 场次提示采用本轮确认的 `Select a session time`，不采用后续示意稿的 `Choose a session`。`Select a date` 未在本轮清单中，不自动录用。
- 日期、场次、人数和按人按场计价说明用于活动预约；住宿和服务保留各自日期／房间／服务数量等实际业务含义，不做全类型替换。
- UTC 与计价规则应用前需核对实际行为。箭头若已有组件渲染则避免重复。
- 此次确认不包含平台现实说明、日期范围、浏览器保存期限、确认勾选框或签发按钮。仍需逐项核对，不因换用 quoted price 或 Session time 而删除现有现实说明。
- 仅修改文案库，不改变页面、业务规则或数据库。
