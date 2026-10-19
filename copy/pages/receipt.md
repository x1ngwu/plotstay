# 签发与旅行凭条

实施状态：2026-10-19 本文件已审定界面文案已应用并发布；下文审定过程中的未实施描述为历史记录。见[发布记录](../releases/2026-10-19-travel-copy.md)。

范围：签发结果、网页凭条和下载图片中的文字。

状态：2026-10-19 签发祝福、配套文案与任职署名共 7 条，以及保存／复制／后续操作 12 条、读取与找回提示 5 条，合计 24 条中英文均已确认；呈现关系已确认；Texo 按用户确认保留英文，不再列为待译项。已确认条目已上线。

依据：用户对三阶段及预约配套英文清单回复“可以的”。见 [来源确认](../sources/2026-10-19-web-chat.md#预约三阶段与配套英文录用确认)；维护规则见 [文案库入口](../README.md)。

## receipt.blessing

- 页面位置：签发祝福
- 英文审定状态：已确认
- 中文：愿您的航程准确无偏。
- 中文审定状态：已确认
- 决策来源：[预约首批中文确认](../sources/2026-10-19-web-chat.md#预约首批中文确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

May your course run true.

## receipt.eyebrow

- 页面位置：顶部状态标识
- 英文审定状态：已确认
- 中文：世界内预订确认／已签发
- 中文审定状态：已确认
- 决策来源：[签发中文与任职署名确认](../sources/2026-10-19-web-chat.md#签发中文与任职署名确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

IN-WORLD CONFIRMATION / ISSUED

## receipt.title

- 页面位置：成功标题
- 英文审定状态：已确认
- 中文：您的预订已确认。
- 中文审定状态：已确认
- 决策来源：[签发中文与任职署名确认](../sources/2026-10-19-web-chat.md#签发中文与任职署名确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Your reservation is confirmed.

## receipt.intro

- 页面位置：成功说明
- 英文审定状态：已确认
- 中文：您的行程已登记。请妥善保管旅行凭证，以备抵达时查验。
- 中文审定状态：已确认
- 决策来源：[签发中文与任职署名确认](../sources/2026-10-19-web-chat.md#签发中文与任职署名确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

Your itinerary has been recorded. Please retain your confirmation for inspection upon arrival.

## receipt.document.heading

- 页面位置：凭条抬头
- 英文审定状态：已确认
- 中文：拉斯世界旅行服务 · 旅行凭证
- 中文审定状态：已确认
- 决策来源：[签发中文与任职署名确认](../sources/2026-10-19-web-chat.md#签发中文与任职署名确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

LATHE WORLDS TRAVEL · TRAVEL DOCUMENT

## receipt.signature

- 页面位置：祝福署名
- 英文审定状态：已确认
- 中文：——代理人伊斯多鲁斯
- 中文审定状态：已确认
- 决策来源：[签发中文与任职署名确认](../sources/2026-10-19-web-chat.md#签发中文与任职署名确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

— Factor Isidorrus

## receipt.signature-affiliation

- 页面位置：祝福署名下的任职信息
- 英文审定状态：已确认
- 中文审定状态：已确认，Texo 保留英文
- 决策来源：[签发中文与任职署名确认](../sources/2026-10-19-web-chat.md#签发中文与任职署名确认)
- 落地状态：已上线
- 实现位置：代码键或数据库实体／字段待应用前核对

英文：Visitor Services, Excipio Station Texo

中文：Texo 接迎空间站 · 访客服务处

## 已确认的呈现关系

2026-10-19 用户对 10 条确认／签发配套英文及呈现关系回复“是的，继续”。见 [录用记录](../sources/2026-10-19-web-chat.md#确认页与签发页配套文案录用确认)。

- `Your reservation is confirmed.` 作成功主标题。
- `May your course run true.` 放在凭证中作为签发祝福，下接 `— Factor Isidorrus`，再下一行标注 `Visitor Services, Excipio Station Texo`。中文依次为“愿您的航程准确无偏。”“——代理人伊斯多鲁斯”“Texo 接迎空间站 · 访客服务处”。
- TX-017 保留为内部档案编号，不加入这段面向旅客的祝福署名。
- 网页及下载图片都保留已确认的 [平台虚构说明](../shared/platform-notices.md)。

与 [预约开始和确认阶段](booking.md)共同组成三阶段文案。具体版式、字段映射与图片渲染留待应用环节核对；上述关系不等于完整视觉设计已完成。

## 应用边界

遵循 [声音分工](../voice/editorial-guide.md)，将故事内确认与平台实际效果说明同时保留。预约标题、地点、日期、旅客数量等动态业务数据不硬编码成示意稿内容；历史凭条与预订快照不因本轮文案整理被改写。

## 旅行凭证操作补充（2026-10-19）

以下 12 条中英文均已确认，已确认条目已上线。用户回复“可以的，这里没问题”，见[确认记录](../sources/2026-10-19-web-chat.md#旅行凭证操作文案确认)。编号为文案库追踪编号。

### 操作按钮

| 编号 | 中文 | 英文 |
| --- | --- | --- |
| receipt.action.save-image | 保存旅行凭证图片 | Save document image |
| receipt.action.copy-listing | 复制详情页链接 | Copy listing link |
| receipt.action.copy-document | 复制我的旅行凭证链接 | Copy my document link |
| receipt.action.reload | 重新读取旅行凭证 | Reload travel document |
| receipt.action.book-again | 再次预订此行程 | Book this trip again |
| receipt.action.return-listing | 返回详情页 | Return to listing |
| receipt.action.return-desk | 返回旅行服务台 | Return to travel desk |

### receipt.retention-aside

页面位置：保存按钮附近新增的 Isi 附注，适用于拉斯世界。

中文：请自行留存一份旅行凭证。档案库自有其神圣职责，随时响应您的查阅并不总在其中。

英文：Please retain a copy of your travel document. The archive has its sacred duties. Answering your enquiries promptly is not invariably among them.

### 平台操作反馈

| 编号 | 中文 | 英文 |
| --- | --- | --- |
| receipt.feedback.link-copied | 链接已复制。 | Link copied. |
| receipt.feedback.copy-failed | 自动复制失败，请手动复制下方链接。 | Automatic copying failed. Please copy the link below manually. |
| receipt.feedback.image-ready | 旅行凭证图片已生成。请查看浏览器下载记录，或使用设备的图片保存功能。 | Your travel document image is ready. Check your browser’s downloads, or use your device’s save image option. |
| receipt.feedback.download-failed | 图片下载失败，您的预订记录仍已保存。请重试，或先截图保存旅行凭证。 | The image could not be downloaded. Your booking record is still saved. Please retry, or take a screenshot of your travel document. |

### 本批应用核对

- 对照位置：`apps/web/src/pages/[locale]/receipts/[id].astro` 与 `apps/web/src/lib/booking-client.ts` 的 `initReceipt()`。具体绑定留待应用时落实。
- “再次预订此行程”重新打开同一项目的预约表单，不表示点击后已新建预订。
- 图片成功提示仅说明图片已生成，不承诺已保存到用户设备。
- 平台反馈保持实际操作含义；Isi 附注不替代 Cookie、保存期限及找回条件说明。
- 读取中、无法访问、旧版测试凭证、JavaScript 提示及找回说明已于后续批次确认，见下文。

## 旅行凭证读取与找回（2026-10-19）

以下 5 条中英文均已确认，已确认条目已上线。用户回复“是的，可以，就这样”，见[确认记录](../sources/2026-10-19-web-chat.md#旅行凭证读取与找回确认)。均采用平台口吻，保留实际访问条件；Isi 保存附注另行呈现。

### receipt.loading

中文：正在核对访问权限，调阅您的旅行凭证……

英文：Checking access and retrieving your travel document…

“访问权限”指平台访问权限，不指故事内的旅行许可。

### receipt.access-unavailable

中文：无法读取这份旅行凭证。请核对链接，并使用办理预订时的浏览器，确认原有 Cookie 仍被保留。仅凭编号或链接，无法在其他浏览器中找回凭证。

英文：This travel document could not be retrieved. Check the link and use the browser in which you made the booking, with its original cookie intact. A document number or link alone cannot restore access in another browser.

### receipt.link-access-note

中文：旅行凭证链接仅在保留原有 Cookie 的浏览器中可用。清除 Cookie、Cookie 到期或更换设备后，无法仅凭编号或链接找回。建议另存凭证图片。

英文：Your travel document link works only in the browser retaining the original cookie. If that cookie is cleared or expires, or you change devices, the number or link alone cannot restore access. Please save a copy of the document image.

与已确认的“最长 180 天”平台说明协调排版，避免重复；应用前核对实际访问与保存期限行为。

### receipt.javascript-required

中文：请启用 JavaScript，以读取您的旅行凭证。

英文：Please enable JavaScript to retrieve your travel document.

### receipt.legacy-document

中文：这是一份早期测试旅行凭证，未保存完整行程，暂无法按当前格式展示。

英文：This is an early test travel document without a complete itinerary. It cannot currently be displayed in the present format.

仅用于旧测试记录的兼容提示，不展示给正常版本的凭证。

### 本批应用核对

对照位置：`apps/web/src/pages/[locale]/receipts/[id].astro` 的读取状态、链接说明和 noscript；`apps/web/src/lib/booking-client.ts` 中 `initReceipt()` 的访问失败及快照版本分支。具体字段绑定和功能验证在应用阶段完成；本次只录用文案，不改变身份恢复、访问权限或历史记录。
