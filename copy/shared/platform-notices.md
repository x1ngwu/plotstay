# 平台现实说明

实施状态：2026-10-19 本文件已审定界面文案已应用并发布；下文审定过程中的未实施描述为历史记录。见[发布记录](../releases/2026-10-19-travel-copy.md)。

范围：虚构性质、支付、个人信息及浏览器保存期限；表述须核对实际功能。

状态：2026-10-19 以下 5 条中英文均已确认。已确认条目已上线；表达审定不代表已验证实际功能。

依据：用户对声音分工及 5 条英文清单回复“是的”。见 [来源确认](../sources/2026-10-19-web-chat.md#故事内外声音与平台现实说明录用确认)；写作原则见 [文案原则](../voice/editorial-guide.md)。编号为文案库追踪编号，不代表程序现有键。

## platform.notices.heading

- 页面位置：现实说明区标题
- 英文审定状态：已确认
- 中文：PLOTSTAY · 故事之外
- 中文审定状态：已确认
- 决策来源：[平台现实说明中文确认](../sources/2026-10-19-web-chat.md#平台现实说明中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

PLOTSTAY · OUTSIDE THE STORY

## platform.notices.booking

- 页面位置：预约页说明
- 英文审定状态：已确认
- 中文：这是一项虚构的预订体验。您将获得故事世界中的旅行凭证，不会产生真实预订。无需付款或提供个人信息。
- 中文审定状态：已确认
- 决策来源：[平台现实说明中文确认](../sources/2026-10-19-web-chat.md#平台现实说明中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

This is a fictional booking experience. You'll receive an in-world travel document, not a real reservation. No payment or personal details required.

## platform.notices.confirmation

- 页面位置：最终确认勾选框
- 英文审定状态：已确认
- 中文：我已知悉，此操作仅签发虚构的旅行凭证，不会产生真实预订或付款。
- 中文审定状态：已确认
- 决策来源：[平台现实说明中文确认](../sources/2026-10-19-web-chat.md#平台现实说明中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

I understand this issues a fictional travel document only. No real reservation or payment will be made.

## platform.notices.document

- 页面位置：网页与下载凭条固定说明
- 英文审定状态：已确认
- 中文：Plotstay · 本凭证为虚构文件，不可用于现实中的旅行、入境或住宿。
- 中文审定状态：已确认
- 决策来源：[平台现实说明中文确认](../sources/2026-10-19-web-chat.md#平台现实说明中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Plotstay · Fictional document only. Not valid for real-world travel, entry or accommodation.

## platform.notices.recovery

- 页面位置：保存与找回说明
- 英文审定状态：已确认
- 中文：您可在当前浏览器中找回旅行凭证，最长 180 天。清除 Cookie 或更换设备后，可能无法找回。建议保存副本。
- 中文审定状态：已确认
- 决策来源：[平台现实说明中文确认](../sources/2026-10-19-web-chat.md#平台现实说明中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Your travel document can be retrieved in this browser for up to 180 days. Clearing cookies or switching devices may prevent recovery. We recommend saving a copy.

## 应用前核对事项

- 对照实际预约流程核实无需支付、无需个人信息的范围，尤其区分预约要求与账户／会话实际处理的数据；表述若不准确须修订，不将其扩展成全站不处理任何个人信息的承诺。
- 核实凭条访问凭证的期限、续期与过期行为，以及 Cookie 清除／换设备对找回的影响。未完成核验前不声称实际保证 180 天可找回。
- 核对最终确认勾选框的实际流程与操作结果，确保说明和签发行为一致。
- 网页与下载图片均须保留可读的虚构说明；具体版式和字号在应用环节检查，不因截图脱离页面而失去说明。
- 保留日期选择附近的“未来 365 天内”操作限制，并核实实际边界；独立中英文已确认，统一引用 [预约日期范围提示](../pages/booking.md#bookingdate-range-note)。
- 本轮不自动采用旧提案把虚构声明与世界内入境许可混写的段落，也不自动删除未在本轮逐项核对的其他提示。
