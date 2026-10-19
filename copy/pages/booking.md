# 预约与确认

实施状态：2026-10-19 本文件已审定界面文案已应用并发布；下文审定过程中的未实施描述为历史记录。见[发布记录](../releases/2026-10-19-travel-copy.md)。

范围：拉斯世界预约开始、资料填写、确认与异常恢复；包含活动、住宿和服务的已审定字段。

状态：2026-10-19 基础文案 20 条及行程／报价异常提示 6 条，另有连接中断与恢复提示 8 条，以及表单校验与流程提示 7 条，以及住宿／服务字段与计价说明 7 条，合计 48 条中英文均已确认；已确认条目已上线。签发祝福单独维护于 [旅行凭条](receipt.md)。

依据：用户对三阶段文案及预约第一步 12 条配套英文清单回复“可以的”，同意英文录用、中文继续留待统一校订。见 [来源确认](../sources/2026-10-19-web-chat.md#预约三阶段与配套英文录用确认)；维护规则见 [文案库入口](../README.md)。编号为文案库追踪编号，不代表现有程序键。

## booking.start.title

- 页面位置：预约开始标题
- 英文审定状态：已确认
- 中文：一段值得记录的旅程。
- 中文审定状态：已确认
- 决策来源：[预约首批中文确认](../sources/2026-10-19-web-chat.md#预约首批中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

A journey worth recording.

## booking.review.title

- 页面位置：确认阶段标题
- 英文审定状态：已确认
- 中文：各项细节，悉数核对。
- 中文审定状态：已确认
- 决策来源：[预约首批中文确认](../sources/2026-10-19-web-chat.md#预约首批中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Every detail accounted for.

## booking.start.eyebrow

- 页面位置：顶部小标题
- 英文审定状态：已确认
- 中文：拉斯世界旅行服务／旅行服务台
- 中文审定状态：已确认
- 决策来源：[预约首批中文确认](../sources/2026-10-19-web-chat.md#预约首批中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

LATHE WORLDS TRAVEL / JOURNEY DESK

## booking.start.intro

- 页面位置：页面介绍
- 英文审定状态：已确认
- 中文：选择您的行程，核对报价，领取旅行凭证。
- 中文审定状态：已确认
- 决策来源：[预约首批中文确认](../sources/2026-10-19-web-chat.md#预约首批中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Choose your itinerary, review the quoted price, and collect your travel document.

## booking.steps.choose

- 页面位置：步骤 01
- 英文审定状态：已确认
- 中文：选择行程
- 中文审定状态：已确认
- 决策来源：[预约首批中文确认](../sources/2026-10-19-web-chat.md#预约首批中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Choose your itinerary

## booking.steps.review

- 页面位置：步骤 02
- 英文审定状态：已确认
- 中文：核对并确认
- 中文审定状态：已确认
- 决策来源：[预约首批中文确认](../sources/2026-10-19-web-chat.md#预约首批中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Review & confirm

## booking.steps.collect

- 页面位置：步骤 03
- 英文审定状态：已确认
- 中文：领取旅行凭证
- 中文审定状态：已确认
- 决策来源：[预约首批中文确认](../sources/2026-10-19-web-chat.md#预约首批中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Collect your document

## booking.particulars.title

- 页面位置：行程资料区
- 英文审定状态：已确认
- 中文：行程详情
- 中文审定状态：已确认
- 决策来源：[预约表单与价格确认中文确认](../sources/2026-10-19-web-chat.md#预约表单与价格确认中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Journey particulars

## booking.experience.date

- 页面位置：活动日期
- 英文审定状态：已确认
- 中文：出行日期 · UTC
- 中文审定状态：已确认
- 决策来源：[预约表单与价格确认中文确认](../sources/2026-10-19-web-chat.md#预约表单与价格确认中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Travel date · UTC

## booking.experience.session

- 页面位置：活动场次
- 英文审定状态：已确认
- 中文：场次时间 · UTC
- 中文审定状态：已确认
- 决策来源：[预约表单与价格确认中文确认](../sources/2026-10-19-web-chat.md#预约表单与价格确认中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Session time · UTC

## booking.experience.session-placeholder

- 页面位置：场次选择提示
- 英文审定状态：已确认
- 中文：请选择场次时间
- 中文审定状态：已确认
- 决策来源：[预约表单与价格确认中文确认](../sources/2026-10-19-web-chat.md#预约表单与价格确认中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Select a session time

## booking.experience.travellers

- 页面位置：人数
- 英文审定状态：已确认
- 中文：出行人数
- 中文审定状态：已确认
- 决策来源：[预约表单与价格确认中文确认](../sources/2026-10-19-web-chat.md#预约表单与价格确认中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Travellers

## booking.experience.pricing-note

- 页面位置：活动计价说明
- 英文审定状态：已确认
- 中文：按每人每场计费，所有时间均为 UTC。
- 中文审定状态：已确认
- 决策来源：[预约表单与价格确认中文确认](../sources/2026-10-19-web-chat.md#预约表单与价格确认中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Per person, per session · all times UTC.

## booking.review.cta

- 页面位置：下一步按钮
- 英文审定状态：已确认
- 中文：核对行程与报价 →
- 中文审定状态：已确认
- 决策来源：[预约表单与价格确认中文确认](../sources/2026-10-19-web-chat.md#预约表单与价格确认中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Review itinerary & price →

## booking.review.eyebrow

- 页面位置：确认页顶部小标题
- 英文审定状态：已确认
- 中文：旅行服务台／核对
- 中文审定状态：已确认
- 决策来源：[预约表单与价格确认中文确认](../sources/2026-10-19-web-chat.md#预约表单与价格确认中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

JOURNEY DESK / REVIEW

## booking.review.intro

- 页面位置：确认标题下说明
- 英文审定状态：已确认
- 中文：请核对您的行程与报价总额，再继续办理。
- 中文审定状态：已确认
- 决策来源：[预约表单与价格确认中文确认](../sources/2026-10-19-web-chat.md#预约表单与价格确认中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Please review your itinerary and quoted total before proceeding.

## booking.review.breakdown

- 页面位置：价格明细标题
- 英文审定状态：已确认
- 中文：费用明细
- 中文审定状态：已确认
- 决策来源：[预约表单与价格确认中文确认](../sources/2026-10-19-web-chat.md#预约表单与价格确认中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Price breakdown

## booking.review.total

- 页面位置：总价标签
- 英文审定状态：已确认
- 中文：报价总额
- 中文审定状态：已确认
- 决策来源：[预约表单与价格确认中文确认](../sources/2026-10-19-web-chat.md#预约表单与价格确认中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Quoted total

## booking.confirm.cta

- 页面位置：最终确认按钮
- 英文审定状态：已确认
- 中文：确认并签发旅行凭证
- 中文审定状态：已确认
- 决策来源：[预约表单与价格确认中文确认](../sources/2026-10-19-web-chat.md#预约表单与价格确认中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Confirm & issue document

## booking.date-range-note

- 页面位置：日期选择附近的范围提示
- 英文审定状态：已确认
- 中文审定状态：已确认
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对
- 决策来源：[收尾文案确认](../sources/2026-10-19-web-chat.md#日期范围计数与页脚收尾确认)

英文：Choose a date within the next 365 days.

中文：请选择未来 365 天内的日期。

应用前核对实际起止边界、时区及三类业务适用范围；本次确认文案不代表已经核实日期校验行为，不因措辞调整更改业务规则。

## 应用前核对事项

- 三阶段依次为预约开始、确认、签发；签发的 `May your course run true.` 是祝福文案，见凭条文件，不据此确定它必须充当页面主标题。
- 页面介绍采用最后一轮的 `collect your travel document` 版本，不采用此前 `collect a travel document for your records` 候选。
- 场次提示采用本轮确认的 `Select a session time`，不采用后续示意稿的 `Choose a session`。`Select a date` 未在本轮清单中，不自动录用。
- 日期、场次、人数和按人按场计价说明用于活动预约；住宿和服务保留各自日期／房间／服务数量等实际业务含义，不做全类型替换。
- UTC 与计价规则应用前需核对实际行为。箭头若已有组件渲染则避免重复。
- 平台现实说明与勾选框引用已确认的独立说明文件；最终签发按钮已于后续批次确认。日期范围独立中英文已审定，实际边界仍待应用前核验，不因换用 quoted price 或 Session time 而遗漏现有现实说明。
- 仅修改文案库，不改变页面、业务规则或数据库。

## 后续确认：平台说明

2026-10-19 用户已另行确认 [声音分工](../voice/editorial-guide.md)及 [5 条平台现实说明](../shared/platform-notices.md)。相应说明统一引用上述文件，应用前仍需核验实际行为。确认页后续 5 条英文已于本轮录用，见 [确认与签发录用记录](../sources/2026-10-19-web-chat.md#确认页与签发页配套文案录用确认)。具体布局与字段映射留待应用环节核对。

## 行程与报价异常提示（2026-10-19）

以下 6 条中英文均已确认，已确认条目已上线。用户回复“可以”，见[确认记录](../sources/2026-10-19-web-chat.md#行程与报价异常提示确认)。

### booking.error.invalid-dates

对应现有错误码：`INVALID_DATES`。

中文：所选日期已失效或超出可预约范围。请选择未来 365 天内开始的行程；住宿须为 1–30 晚。

英文：The selected dates are no longer valid or fall outside the booking range. Please choose a trip starting within the next 365 days; stays must be 1–30 nights.

日期范围、时区与住宿晚数应用前核对；此前已确认的亚空间时间附注仍用于退房日期次序校验。

### booking.error.capacity-exceeded

对应现有错误码：`CAPACITY_EXCEEDED`。

中文：所选房间无法接待这么多旅客。请增加房间或减少人数。随身义体不计入同行人数。

英文：The selected rooms cannot accommodate this many travellers. Please add rooms or reduce the number of travellers. Attached augmetics do not count as additional guests.

### booking.error.session-unavailable

对应现有错误码：`SESSION_UNAVAILABLE`。

中文：所选场次暂不可预约，或尚未公布时长。请另选场次，或返回旅行目录。尚未确定的安排，不宜写入您的行程。

英文：The selected session is unavailable, or its duration has not yet been published. Please choose another session or return to the travel directory. Unsettled arrangements have no place in your itinerary.

### booking.error.not-bookable

对应现有错误码：`NOT_BOOKABLE`。

中文：此项目已从目录撤下，或暂不接受预订。本次未创建新的预订，请返回旅行目录，另作安排。

英文：This listing has been withdrawn or is not currently accepting bookings. No new booking was created. Please return to the travel directory to make alternative arrangements.

### booking.error.quote-changed

对应现有错误码：`QUOTE_CHANGED`。

中文：项目详情或报价已有更新，本次未创建预订。请重新核对行程与报价。文书上的每个数字，都值得再看一眼。

英文：The listing details or quoted price have changed. No booking was created. Please review your itinerary and the updated quote. Every figure on a document deserves a second look.

### booking.error.price-unavailable

对应现有错误码：`PRICE_UNAVAILABLE`。

中文：此项目的计价资料尚未备齐，请先浏览其他条目。未经核定的数字，不便作为报价呈交给您。

英文：Pricing details for this listing are not yet complete. Please browse other entries for now. Unverified figures would not make a proper quotation.

### 本批应用核对

对照位置：`apps/web/src/lib/booking-client.ts` 的 `errorMessage()`。Isi 口吻仅适用于拉斯世界。应用前核对错误分支、目录返回路径及“未创建预订”的实际保证；不得将明确失败提示用于结果未确认的请求。本批不包含连接中断、请求恢复及身份／本地存储提示，不改变任何业务规则。

## 连接中断与预订恢复（2026-10-19）

以下 8 条中英文已确认，已确认条目已上线。用户回复“可以的，我觉得这里也不需要太多角色扮演。继续”。采用清楚、直接的平台口吻，区分尚未提交与结果未确认。

### booking.recovery.issuing

中文：正在签发您的旅行凭证，请稍候……

英文：Issuing your travel document. Please wait…

### booking.recovery.network

中文：连接暂时中断，请稍后重试。

英文：The connection was interrupted. Please try again shortly.

### booking.recovery.outcome-pending

中文：本次预订的结果尚未确认。请选择“重试同一次预订”，继续处理原请求；此操作不会重复创建预订。

英文：The outcome of this booking is not yet confirmed. Select “Retry this booking” to continue the original request without creating a duplicate booking.

### booking.recovery.retry

中文：重试同一次预订

英文：Retry this booking

### booking.recovery.pending-found

中文：您有一次预订尚未确认结果。请选择“重试同一次预订”，继续处理并获取旅行凭证。

英文：A previous booking request is still awaiting confirmation. Select “Retry this booking” to continue and retrieve your travel document.

### booking.recovery.storage

中文：浏览器无法保存预订恢复信息，本次预订尚未提交。请允许本站使用本地存储，然后重试。

英文：Your browser could not save the information needed to recover this booking. No booking has been submitted. Please allow local storage for this site, then retry.

### booking.recovery.session-required

中文：无法读取办理本次预订时使用的 Cookie。请使用原浏览器，并确认已允许本站使用 Cookie。结果确认前，请勿更换浏览器重新预订。

英文：The cookie used for this booking could not be read. Please use the original browser and ensure cookies are allowed for this site. Do not start another booking in a different browser until the outcome is confirmed.

### booking.recovery.rate-limited

中文：操作过于频繁，请稍候再试。

英文：Too many requests. Please wait a moment before trying again.

应用对照：`apps/web/src/lib/booking-client.ts` 的 `errorMessage()`、提交及恢复流程，以及预约页的重试按钮。结果未确认提示只在对应提交／恢复状态显示；本地存储失败的“尚未提交”须限定在提交前保存失败的分支。应用前核验同一次请求重试不重复创建的保证，不改变身份、存储和业务规则。请求冲突及其余表单提示已在下一节确认。

## 表单校验与流程提示（2026-10-19）

以下 7 条中英文已确认，已确认条目已上线。用户回复“可以，继续”。确认记录见[来源文件](../sources/2026-10-19-web-chat.md#表单校验与流程提示确认)。

### booking.flow.invalid-input

中文：请检查日期、场次、人数及数量是否填写正确。

英文：Please check that the dates, session, number of travellers and quantities are correct.

### booking.flow.invalid-trip

中文：所选行程与当前项目不匹配。请返回详情页，重新填写预订信息。

英文：The selected trip does not match this listing. Please return to the listing and enter your booking details again.

### booking.flow.request-conflict

中文：此次请求已关联另一笔预订。请先恢复原请求；如需另行预订，请返回详情页重新开始。

英文：This request is already linked to another booking. Please recover the original request first. To make a separate booking, return to the listing and start again.

### booking.flow.edit-itinerary

中文：修改行程

英文：Edit itinerary

### booking.flow.review-reminder

中文：请核对行程与报价。只有在您确认后，才会提交预订。

英文：Please review your itinerary and quote. Your booking will be submitted only after you confirm.

### booking.flow.javascript-required

中文：请启用 JavaScript，以核对行程、确认报价并领取旅行凭证。

英文：Please enable JavaScript to review your itinerary, confirm the quote and receive your travel document.

### booking.flow.reload-to-retry

中文：请刷新页面后重试。

英文：Please reload the page and try again.

应用对照：`apps/web/src/lib/booking-client.ts` 中 INVALID_INPUT、INVALID_TRIP、IDEMPOTENCY_CONFLICT、报价完成与初始化分支；预约页的修改按钮及 noscript。刷新提示仅用于没有待确认预订请求的初始化失败；已有待确认请求使用“重试同一次预订”。请求冲突提示不能被解读为覆盖或重新提交其他预订；实际恢复路径在应用前核验。

## 住宿与服务预约补充（2026-10-19）

以下 7 条中英文已确认，已确认条目已上线。用户回复“可以，继续”，见[确认记录](../sources/2026-10-19-web-chat.md#住宿与服务预约补充确认)。出行人数／Travellers 沿用既有定稿，不新增重复条目。

### booking.specialized.check-in

中文：入住日期

英文：Check-in date

### booking.specialized.check-out

中文：退房日期

英文：Check-out date

### booking.specialized.rooms

中文：房间数

英文：Number of rooms

### booking.specialized.service-quantity

中文：服务数量

英文：Service quantity

### booking.specialized.stay-pricing

中文：按每间每晚计费，可预订 1–30 晚。入住与退房日期均按 UTC 日期计算。

英文：Charged per room, per night, for stays of 1–30 nights. Check-in and check-out dates use UTC calendar dates.

### booking.specialized.service-pricing

中文：按服务数量计费。增加数量不会延长场次时长，出行人数不另行计费。所有场次时间均为 UTC。

英文：Charged by service quantity. Increasing the quantity does not extend the session, and no additional charge applies for the number of travellers. All session times are in UTC.

### booking.specialized.session-started

中文：（已开始，不可预约）

英文：(Started — unavailable)

应用对照：`apps/web/src/pages/[locale]/booking/[id].astro` 中住宿／服务字段、分类型计价提示和场次禁用标记。场次状态按开始时间已到判断，不称为“已结束”。服务数量不表示连续时段；计价、UTC 日期和晚数限制在应用前核验。本次不改变业务规则。
