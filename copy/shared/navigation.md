# 全站导航与通用操作

范围：跨页面复用的导航、按钮与提示。本批先核对前台共用项目；预约异常、凭证操作及后台提示另行盘点。

状态：2026-10-19 Isi 口吻修订的 7 项中英文已确认，搜索无结果采用推荐 A 版；搜索／筛选／分页功能文案亦已确认，见后文。全部未应用。历史底稿中未被本轮覆盖的条目不自动视为已审定。

维护规则见 [文案库入口](../README.md)。三类详情页共用区域见 [详情页共用文案](detail.md)。

## 第一批提案（历史底稿，相关项由下文修订覆盖）

英文按现有界面列出；返回旅行服务台沿用已审定英文。中文为本批建议，不视作已录用。

| 英文 | 中文建议 |
| --- | --- |
| All | 全部 |
| Homes | 住宿 |
| Experiences | 活动 |
| Services | 服务 |
| Where to? | 想去哪里？ |
| Search places, titles or tags | 搜索名称、地点或标签 |
| Destination | 目的地 |
| Anywhere in this world | 全部地点 |
| Search | 搜索 |
| Clear filters | 清除筛选 |
| Previous / Next | 上一页／下一页 |
| Return to travel desk | 返回旅行服务台（沿用已定稿） |
| No published content yet. | 暂无可浏览的内容。 |
| No stories match this search yet. | 暂未找到符合条件的结果。 |
| Try another phrase, or explore the whole world. | 请尝试其他关键词，或清除筛选以浏览全部内容。 |
| This page could not be found. | 未找到此页面。 |
| Content is temporarily unavailable. Please try again. | 内容暂时无法加载，请稍后重试。 |
| This content is currently shown in its original language. | 此内容暂无中文译文，暂以原文显示。 |
| The interface is currently shown in English. | 界面暂以英语显示。 |
| Checkout must follow the start date. | 退房日期须晚于入住日期。 |

来源位置：`apps/web/src/lib/i18n.ts`、`apps/web/src/components/Search.astro`、`apps/web/src/pages/[locale]/index.astro`。搜索空结果辅助提示为中文改写；应用时核对清除筛选行为。原文回退提示此处仅定中文版，不能复用于其他语言后仍声称缺少中文译文。返回按钮沿用目录页定稿，替换现有 Back to discovery。

## Isi 口吻修订：2026-10-19

用户要求功能明确且具有世界观背景；搜索入口采用表单式名词短语。空目录附注应暗示曾受同僚纠缠，不将纠纷经过直接讲明。用户回复“可以可以！非常好！就这样”，确认下列 7 项中英文；搜索无结果按上一轮推荐采用 A 版。

### 搜索入口 · 中英文已确认

Your Planned Destination

您计划前往的目的地

### 空目录 · 中英文已确认

No entries are currently available in this directory.
For the benefit of my esteemed colleagues: the absence of entries does not imply an absence of places worth visiting. Please consult trusted local units.

本目录尚无可供查阅的条目。
谨向我亲爱的同僚们说明：目录空白，不代表此地没有值得访问之处。请向当地可信赖的单位咨询。

### 搜索无结果 · 中英文已确认（A 版）

No entries match your selected criteria. You may wish to relax a condition or two. These are travel preferences, after all, not sacred vows.

本目录中，暂无符合您所选条件的条目。您不妨放宽一两项条件。毕竟，这是出行偏好，并非神圣誓约。

### 页面不存在 · 中英文已确认

Page not found. Please check the address or return to the travel desk.
Our esteemed colleagues in the Administratum maintain their own records. They do not, however, maintain ours.

未找到此页面。请核对地址，或返回旅行服务台。
我们尊敬的帝国行政部同僚自有一套档案。但本处档案，并不由他们保管。

### 加载失败 · 中英文已确认

This record cannot be retrieved at present. Please try again shortly.
The machine-spirit must be approached with the proper rites. The order of those rites is currently being checked.
Archives may be delayed. Your leave should not be.

暂时无法调阅这份资料，请稍后重试。
与机魂沟通须遵循正确的仪式。目前正在核对仪式次序。
档案库偶有迟滞，您的休假不应如此。

### 界面语言回退 · 中英文已确认

The interface is currently displayed in English. The corresponding translation is not yet in the archive. The translation has encountered more paperwork than anticipated.

界面暂以英语显示，相应译文尚未归档。译文所需的手续，比预想中略多一些。

保留实际语言名称 English／英语；不直接等同高哥特语。本句仅用于界面回退，中文正常可用时不应显示。

### 退房日期 · 中英文已确认

Checkout must be later than check-in. Even allowing for temporal discrepancies in warp travel, this form must be completed in that order.

退房日期须晚于入住日期。即便考虑到亚空间航行中的时间偏差，本表仍须依此次序填写。

## 背景依据与原创边界

已读取的[知识库](https://kb.xingwu.dev/lathes/reader.html)《The Lathe Worlds》记录：`DH18-p007-b006-r0`（机械教自治）、`DH18-p009-b008-r1`（火星条约）、`DH18-p010-b005-r0`（自治权逐渐受限）、`DH18-p075-b006-r0`（拉斯机构与帝国问询之间的张力）；`DH18-p024-b012-r0q1` 说明与机魂接触须正确履行仪式。档案互不代管、同僚纠纷与仪式核对是据背景创作的本站情境，不是书中原话或实际故障诊断。

语言补查：[High Gothic](https://wh40k.lexicanum.com/wiki/High_Gothic)、[Low Gothic](https://wh40k.lexicanum.com/wiki/Low_Gothic) 为二手资料。高哥特语常以拉丁化语言呈现；英语通常用于呈现低哥特语，呈现惯例不意味着两种语言在设定中相同。本轮未直接查验其引用的规则书语言章节。

## 未录用备选（留档，不用于实施）

搜索无结果 B 版：

B: No entries match your selected criteria. Please adjust your search. I am permitted to recommend accommodation, but not to invent it.

本目录中，暂无符合您所选条件的条目。请调整搜索条件。我的职权允许推荐住处，尚不包括凭空增设一处。

## 搜索、筛选与分页（2026-10-19 已确认）

本节中英文已确认，全部未应用。用户回复“可以，这里其实还是功能性为主，不太适合修改文案”。保留清楚、常见的功能表达，不增加角色台词或为风味改写标签；搜索入口沿用已定 Your Planned Destination／您计划前往的目的地。以下条目覆盖历史底稿中的对应候选。

| 中文 | 英文 |
| --- | --- |
| 全部 | All |
| 住宿 | Homes |
| 活动 | Experiences |
| 服务 | Services |
| 搜索名称、地点或标签 | Search names, places or tags |
| 目的地 | Destination |
| 全部地点 | All destinations |
| 搜索 | Search |
| 清除筛选 | Clear filters |
| 出行日期 | Travel date |
| 返回／退房日期 | Return / check-out date |
| 出行人数 | Travellers |
| 房间数 | Number of rooms |
| 服务数量 | Service quantity |
| 尚未确定 | Not yet decided |
| 时段偏好 | Preferred time |
| 不限时段 | Any time |
| 上午 | Morning |
| 下午 | Afternoon |
| 晚间 | Evening |
| 类别 | Category |
| 全部类别 | All categories |
| 上一页 | Previous |
| 下一页 | Next |

“尚未确定”用于人数、房间数和服务数量的空白占位；时段默认值为“不限时段”。与预约页共用含义的字段沿用一致译法。

### 搜索范围说明

中文：日期与数量仅用于记录您的行程偏好，搜索暂不核查可用余量。

英文：Dates and quantities record your trip preferences only. Search does not currently check availability.

应用对照：`apps/web/src/components/Search.astro` 及目录页分页。功能说明应用前核对搜索行为，不因文案审定改变筛选、余量或预约逻辑。无障碍辅助标签及其他尚未列出的提示不自动计入本批确认范围。
