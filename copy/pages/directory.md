# 全部目录

实施状态：2026-10-19 本文件已审定界面文案已应用并发布；下文审定过程中的未实施描述为历史记录。见[发布记录](../releases/2026-10-19-travel-copy.md)。

范围：拉斯世界全部目录页的标题、统计、样板地区名称与介绍、返回按钮。

审定状态：2026-10-19 用户确认录用以下 10 条英文；对应 10 条中文已全部确认，包含公共区域及样板地区名称与介绍。落地状态：已确认条目已上线。维护规则见 [文案库入口](../README.md)。

依据：用户对本地会话中目录页清单及“先录用英文”的提议回复“是的”，并明确确认把 Back to discovery 改为 Return to travel desk。见 [来源确认](../sources/2026-10-19-web-chat.md#全部目录页录用确认)。

以下编号是文案库追踪编号，不代表现有程序键。每条实现位置（代码键或数据库实体／字段）均待应用前核对。

## directory.eyebrow

- 页面位置：顶部小标题
- 英文审定状态：已确认
- 中文审定状态：已确认
- 决策来源：[目录页公共区域中文确认](../sources/2026-10-19-web-chat.md#目录页公共区域中文确认)
- 落地状态：已上线

LATHE WORLDS / TRAVEL DIRECTORY

中文：拉斯世界／旅行目录

## directory.title

- 页面位置：主标题
- 英文审定状态：已确认
- 中文审定状态：已确认
- 决策来源：[目录页公共区域中文确认](../sources/2026-10-19-web-chat.md#目录页公共区域中文确认)
- 落地状态：已上线

Wonders, properly catalogued.

中文：万千奇观，妥善归档。

## directory.count

- 页面位置：条目统计
- 英文审定状态：已确认
- 中文审定状态：已确认
- 决策来源：[目录页公共区域中文确认](../sources/2026-10-19-web-chat.md#目录页公共区域中文确认)
- 落地状态：已上线

{total} entries on record

中文：共收录 {total} 条记录

### 计数单复数

- 审定状态：中英文已确认；未应用。
- total = 1：英文 `1 entry on record`；中文 `共收录 1 条记录`。
- total = 0 或其他数量：英文 `{total} entries on record`；中文 `共收录 {total} 条记录`。
- 决策来源：[收尾文案确认](../sources/2026-10-19-web-chat.md#日期范围计数与页脚收尾确认)。
- 仍使用同一个目录计数条目，按动态计数选择英文单复数；具体程序键映射在应用时确定。

## directory.foundry.name

- 页面位置：样板铸造区名称
- 英文审定状态：已确认
- 中文审定状态：已确认
- 决策来源：[样板地区中文确认](../sources/2026-10-19-web-chat.md#样板地区中文确认)
- 落地状态：已上线

Foundry Ward

中文：铸造区

## directory.foundry.description

- 页面位置：样板铸造区介绍
- 英文审定状态：已确认
- 中文审定状态：已确认
- 决策来源：[样板地区中文确认](../sources/2026-10-19-web-chat.md#样板地区中文确认)
- 落地状态：已上线

Where industry is the view.

中文：工业即是风景线。

## directory.archive.name

- 页面位置：样板档案区名称
- 英文审定状态：已确认
- 中文审定状态：已确认
- 决策来源：[样板地区中文确认](../sources/2026-10-19-web-chat.md#样板地区中文确认)
- 落地状态：已上线

Quiet Archive

中文：静谧档案区

## directory.archive.description

- 页面位置：样板档案区介绍
- 英文审定状态：已确认
- 中文审定状态：已确认
- 决策来源：[样板地区中文确认](../sources/2026-10-19-web-chat.md#样板地区中文确认)
- 落地状态：已上线

Silence is observed. Access is regulated.

中文：请保持肃静。出入此地需要经过许可。

## directory.docks.name

- 页面位置：样板轨道船坞名称
- 英文审定状态：已确认
- 中文审定状态：已确认
- 决策来源：[样板地区中文确认](../sources/2026-10-19-web-chat.md#样板地区中文确认)
- 落地状态：已上线

Orbital Docks

中文：轨道船坞

## directory.docks.description

- 页面位置：样板轨道船坞介绍
- 英文审定状态：已确认
- 中文审定状态：已确认
- 决策来源：[样板地区中文确认](../sources/2026-10-19-web-chat.md#样板地区中文确认)
- 落地状态：已上线

Arrivals, departures, and a fine view of both.

中文：星舰来往，皆是风景。

## directory.back

- 页面位置：返回首页按钮
- 英文审定状态：已确认
- 中文审定状态：已确认
- 决策来源：[目录页公共区域中文确认](../sources/2026-10-19-web-chat.md#目录页公共区域中文确认)
- 落地状态：已上线

Return to travel desk

中文：返回旅行服务台

## 应用前核对事项

- 返回按钮用 `Return to travel desk` 替换 `Back to discovery`；用户消息中的换行仅为排版，不写入按钮文字。目的地为返回首页的既有入口，应用时核对链接与筛选上下文。
- `{total}` 保留为动态条目计数，不是地点数量；原讨论示例数字 24 和页码不录为固定文案。单复数已审定，见 directory.count；应用时核对实际计数范围和分支。
- Foundry Ward 暂替代 Sample Forge District，另外两个样板名称保留；本轮仅确认样板文案，不确定星球归属、地点层级或迁移现用数据。
- 地区介绍与地区名称分字段维护。应用时核对是否已有介绍字段及展示位置，不将广告语拼进地点名称。
- 不自动录用示意稿中的搜索占位文字、筛选标签或额外说明；本轮录用范围仅上述 10 条英文。
