# 真实页面视觉与交互证据

本轮 30 张截图均为 Chromium 渲染真实构建页面，数据来自一次性 PostgreSQL schema 的真实 API。测试账号和文字是隔离验收样例，权限判定与写入调用是真实实现；现用账号没有写样例。阶段 A 的 mock 截图保留原目录。

## 16 张基础矩阵

| 页面 | 中文 1440 | 中文 390 | 英文 1440 | 英文 390 |
| --- | --- | --- | --- | --- |
| 我的评价 | [zh 1440](screenshots/reviews-list-zh-1440.png) | [zh 390](screenshots/reviews-list-zh-390.png) | [en 1440](screenshots/reviews-list-en-1440.png) | [en 390](screenshots/reviews-list-en-390.png) |
| 收到的评价 | [zh 1440](screenshots/received-list-zh-1440.png) | [zh 390](screenshots/received-list-zh-390.png) | [en 1440](screenshots/received-list-en-1440.png) | [en 390](screenshots/received-list-en-390.png) |
| 评价编辑 | [zh 1440](screenshots/review-edit-zh-1440.png) | [zh 390](screenshots/review-edit-zh-390.png) | [en 1440](screenshots/review-edit-en-1440.png) | [en 390](screenshots/review-edit-en-390.png) |
| 回复编辑 | [zh 1440](screenshots/reply-edit-zh-1440.png) | [zh 390](screenshots/reply-edit-zh-390.png) | [en 1440](screenshots/reply-edit-en-1440.png) | [en 390](screenshots/reply-edit-en-390.png) |

## 同尺寸前后对照

- 我的评价，中文1440：[改版前真实渲染器归档](../reviews-prototype/screenshots/previous-reviews-list-zh-1440.png) → [阶段 A 已验收结构](../reviews-prototype/screenshots/reviews-list-zh-1440.png) → [本轮真实接入](screenshots/reviews-list-zh-1440.png)。
- 评价编辑，中文1440：[改版前归档](../reviews-prototype/screenshots/previous-review-edit-zh-1440.png) → [阶段 A](../reviews-prototype/screenshots/review-edit-zh-1440.png) → [本轮](screenshots/review-edit-zh-1440.png)。

对照沿用既有归档，没有重新生成或改写“改版前”截图。前后账号与数据不相同，比较结构、信息层级和可操作性，不声称逐像素一致。

## 图文纠偏与实际差异

保留用户已确认的横向互动卡片、桌面状态/时间/操作区、嵌套回复摘要、详情上下文栏、阅读后编辑与可选信息侧栏。保留现有工作台配色、字体、公共导航和手机菜单；CSS 限于 `.ws-reviews`，没有覆盖全站 h2/p/button/.panel 或角色页。

四张灰度图的设计说明、铃铛和假未读数不进入产品。日期、人物、类型、评分来自真实 DTO；复合状态对应独立版本。只读历史不出现保存表单；旧手记来源保持独立，角色私人笔记不取用。没有图片则没有空大框，不新增上传。

与阶段 A 的必要差异：真实每页20条、真实账户角色数和可见状态；未保存内容不能冒充已保存预览；受限上下文显示本人授权历史说明；版本历史按20条分页；原文超过700字符时编辑区前的全文可折叠，阅读态仍完整。没有把页面锁定16:9、整体缩放或绝对定位凑图。

## 额外截图

- [conflict-comparison-en-1440](screenshots/conflict-comparison-en-1440.png)
- [conflict-preserved-en-1440](screenshots/conflict-preserved-en-1440.png)
- [empty-en-1100](screenshots/empty-en-1100.png)
- [loading-en-1100](screenshots/loading-en-1100.png)
- [long-original-en-1100](screenshots/long-original-en-1100.png)
- [navigation-input-protection-en-1440](screenshots/navigation-input-protection-en-1440.png)
- [network-error-en-1100](screenshots/network-error-en-1100.png)
- [new-review-confirm-zh-1440](screenshots/new-review-confirm-zh-1440.png)
- [new-review-zh-1440](screenshots/new-review-zh-1440.png)
- [reply-edit-en-1100](screenshots/reply-edit-en-1100.png)
- [reply-edit-en-360](screenshots/reply-edit-en-360.png)
- [reply-history-en-1440](screenshots/reply-history-en-1440.png)
- [review-reading-zh-1440](screenshots/review-reading-zh-1440.png)
- [reviews-list-en-200-percent](screenshots/reviews-list-en-200-percent.png)

## 已执行交互

真实 API 验证角色/世界/类型/状态/搜索/排序和全范围分页，列表不逐卡取历史。浏览器专项操作了角色搜索、一键全部、两页沿用、打开详情、恢复搜索、选条目/角色/继续既有评价、中英写作与界面切换、可选信息保留、暂存、冲突比较、取消未保存离开、慢响应继续输入、响应丢失恢复、导航失败、同账号重登与换账号清理。组合提交、明确替换待审、双击幂等与旧审核由真实 API 专项验证；不把截图当作权限证明。

[浏览器命令与测试结果](acceptance.md) · [请求路径和16张基础截图记录](browser-evidence.json)。测试源码还包含额外14张截图的生成步骤和断言。390/360为浏览器视口，200%为文字尺寸放大；物理手机、软键盘、屏幕阅读器与公网认证后操作未验证。
