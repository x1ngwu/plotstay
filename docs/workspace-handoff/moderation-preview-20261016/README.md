# 审核工作台 · 效果核对稿（2026-10-16）

> 2026-10-18归档：本效果稿已获通过，真实实现已部署并合并main。此处继续保留静态示例；实际测试使用 `/zh/workspace?view=moderation` 与 `?view=site`。以下为效果稿交付时记录。

当前阶段只交付独立静态预览，等待用户核对效果。真实工作台、API、权限、账号及数据库尚未修改；不把本稿的演示成功或模拟权限当作业务验收结果。

## 入口

以下页面共用同一份预览，页签和详情可直接进入。沿用开发域名现有 Basic Auth。

| 效果 | 地址 |
| --- | --- |
| 评价与回复审核 | [中文](https://plotstay.xingwu.dev/_design/moderation/index.html?lang=zh&view=moderation) · [English](https://plotstay.xingwu.dev/_design/moderation/index.html?lang=en&view=moderation) |
| 网站管理 / 角色资料 | [中文](https://plotstay.xingwu.dev/_design/moderation/index.html?lang=zh&view=site&tab=profiles) · [English](https://plotstay.xingwu.dev/_design/moderation/index.html?lang=en&view=site&tab=profiles) |
| 评价详情 / 联合批准 | [查看](https://plotstay.xingwu.dev/_design/moderation/index.html?lang=zh&view=moderation&tab=reviews&detail=r1) |
| 回复详情 | [查看](https://plotstay.xingwu.dev/_design/moderation/index.html?lang=zh&view=moderation&tab=replies&detail=a1) |
| 角色资料对照 | [查看](https://plotstay.xingwu.dev/_design/moderation/index.html?lang=zh&view=site&tab=profiles&detail=p1) |
| 创建普通账号 | [查看](https://plotstay.xingwu.dev/_design/moderation/index.html?lang=zh&view=site&tab=accounts) |
| 提供者绑定 · 可修改 | [查看](https://plotstay.xingwu.dev/_design/moderation/index.html?lang=zh&view=site&tab=bindings&entry=b2) |
| 提供者绑定 · 永久锁定 | [查看](https://plotstay.xingwu.dev/_design/moderation/index.html?lang=zh&view=site&tab=bindings&entry=b1) |
| 提供者绑定 · 非所有者 | [查看](https://plotstay.xingwu.dev/_design/moderation/index.html?lang=zh&view=site&tab=bindings&entry=b3) |
| 提供者绑定 · 无候选角色 | [查看](https://plotstay.xingwu.dev/_design/moderation/index.html?lang=zh&view=site&tab=bindings&entry=b2&scenario=no-candidates) |

右下角“预览选项”可切换示例身份、空列表、加载失败、他人已处理、无候选角色、表单保存失败及结果待确认。它们仅用于核对效果，不是产品功能。中英文都可在顶栏切换；详情中的正文语言独立切换。

## 来源及边界

- 基线：`main 4d7d72c95b11e7833e0757431a8012e9bc4643bb`。其他会话已有未跟踪附件和作品预览目录均保留。
- 直接采用附件 `plotstay-moderation-development-handoff_2026-10-16.zip` 内 `reference/plotstay-moderation-ui.html` 的已确认布局、配色、卡片和详情结构，没有另起一套设计。
- 本阶段使用附件的静态工作台外壳，尚未挂入 Astro 的真实 `WorkspaceLayout`，也未初始化现有工作台控制器；真实接入阶段仍必须使用 `WorkspaceLayout` 和限定页面范围的 CSS。
- 增补可分享的 query 入口、外置资源和 CSP、动态绑定确认、独立界面/内容语言、窄账号表单，以及表单等待/失败/结果待确认、无候选角色状态。绑定候选文案采用“我的提供者角色”，与已保存且启用中的本人角色可绑定规则一致。
- 数据、数字、版本、日期和每页 5 条均为原型演示。操作只改当前页面内存，刷新恢复示例；不调用任何业务 API、不创建真实账号、不发布真实内容。不使用 localStorage、sessionStorage 或 Cookie 保存表单内容。密码不进 URL、日志或成功结果。
- HTML 的 CSP 明确禁止网络连接和原生表单提交；无真实登录或密码。请不要填写真实凭据。
- 本轮不执行应用构建、数据库操作或应用服务重启，不新增迁移，不 commit/push。用户另行明确允许**仅静态托管**，Nginx 只增加 `/_design/moderation/` alias，并继承现有 Basic Auth、noindex 和 private/no-store。

## 验证

运行 `node docs/workspace-handoff/moderation-preview-20261016/verify.mjs` 可启动随机本机端口的静态服务器并执行浏览器核对；不读取 `.env`、不初始化应用、不连接数据库。

- [verification.json](verification.json)：子路径下的独立分页、搜索、返回位置、未提交说明、版本对照、联合/单独批准、绑定确认、表单状态、权限提示和中英桌面/手机布局核对。
- [screenshots/](screenshots/)：1440px 和 390px 的两个页面、全部工具和详情截图。
- 本机截图与交互检查不等于公网认证后的浏览器验收；公网匿名保护检查另记于 [hosting-verification.json](hosting-verification.json)。

效果确认后，才继续真实 API、事务及权限修正；本阶段没有完成这些业务工作。
