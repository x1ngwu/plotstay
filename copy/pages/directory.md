# 全部目录

范围：拉斯世界全部目录页的标题、统计、样板地区名称与介绍、返回按钮。

审定状态：2026-10-19 用户确认录用以下 10 条英文；中文待确认。落地状态：全部未应用。维护规则见 [文案库入口](../README.md)。

依据：用户对本地会话中目录页清单及“先录用英文”的提议回复“是的”，并明确确认把 Back to discovery 改为 Return to travel desk。见 [来源确认](../sources/2026-10-19-web-chat.md#全部目录页录用确认)。

以下编号是文案库追踪编号，不代表现有程序键。每条实现位置（代码键或数据库实体／字段）均待应用前核对。

## directory.eyebrow

- 页面位置：顶部小标题
- 英文审定状态：已确认
- 中文审定状态：待确认
- 落地状态：未应用

LATHE WORLDS / TRAVEL DIRECTORY

## directory.title

- 页面位置：主标题
- 英文审定状态：已确认
- 中文审定状态：待确认
- 落地状态：未应用

Wonders, properly catalogued.

## directory.count

- 页面位置：条目统计
- 英文审定状态：已确认
- 中文审定状态：待确认
- 落地状态：未应用

{total} entries on record

## directory.foundry.name

- 页面位置：样板铸造区名称
- 英文审定状态：已确认
- 中文审定状态：待确认
- 落地状态：未应用

Foundry Ward

## directory.foundry.description

- 页面位置：样板铸造区介绍
- 英文审定状态：已确认
- 中文审定状态：待确认
- 落地状态：未应用

Where industry is the view.

## directory.archive.name

- 页面位置：样板档案区名称
- 英文审定状态：已确认
- 中文审定状态：待确认
- 落地状态：未应用

Quiet Archive

## directory.archive.description

- 页面位置：样板档案区介绍
- 英文审定状态：已确认
- 中文审定状态：待确认
- 落地状态：未应用

Silence is observed. Access is regulated.

## directory.docks.name

- 页面位置：样板轨道船坞名称
- 英文审定状态：已确认
- 中文审定状态：待确认
- 落地状态：未应用

Orbital Docks

## directory.docks.description

- 页面位置：样板轨道船坞介绍
- 英文审定状态：已确认
- 中文审定状态：待确认
- 落地状态：未应用

Arrivals, departures, and a fine view of both.

## directory.back

- 页面位置：返回首页按钮
- 英文审定状态：已确认
- 中文审定状态：待确认
- 落地状态：未应用

Return to travel desk

## 中文候选（未录用）

以下为原讨论助手提出的候选，供后续校订；不得当作已确认中文上线。

| 对应条目 | 中文候选 |
| --- | --- |
| directory.title | 万千奇观，妥善归档。 |
| directory.foundry.description | 工业，即是风景。 |
| directory.archive.description | 请保持肃静。出入须经许可。 |
| directory.docks.description | 迎来送往，尽收眼底。 |

其余条目的中文尚未录入。

## 应用前核对事项

- 返回按钮用 `Return to travel desk` 替换 `Back to discovery`；用户消息中的换行仅为排版，不写入按钮文字。目的地为返回首页的既有入口，应用时核对链接与筛选上下文。
- `{total}` 保留为动态条目计数，不是地点数量；原讨论示例数字 24 和页码不录为固定文案。应用时核对计数范围及单复数；单数模板尚未审定。
- Foundry Ward 暂替代 Sample Forge District，另外两个样板名称保留；本轮仅确认样板文案，不确定星球归属、地点层级或迁移现用数据。
- 地区介绍与地区名称分字段维护。应用时核对是否已有介绍字段及展示位置，不将广告语拼进地点名称。
- 不自动录用示意稿中的搜索占位文字、筛选标签或额外说明；本轮录用范围仅上述 10 条英文。
