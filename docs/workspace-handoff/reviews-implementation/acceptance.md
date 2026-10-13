# 阶段 B 验收记录

日期：2026-10-13。起始与结束 HEAD 均为 `4d6ffd48b8cb0f298769e574bac3b253b34251eb`。没有 commit/push。用户已验收阶段 A，本轮按其明确授权真实接入和发布开发域名。

## 环境与实际命令

所有数据库和登录交互测试使用一次性随机 `test_*` schema，测试结束清理。浏览器启动真实编译后的 API/Web；只有网络延迟、失败、丢响应使用 Playwright 拦截，成功数据来自真实数据库。使用隔离测试账号，不在现用库建立截图样例。

构建目录 `/tmp/plotstay-reviews-b-build`。复制 apps/packages/scripts/tests 时排除 dist、node_modules、环境文件与日志；普通依赖链接现有安装，`@plotstay/*` 链接临时目录自身的包，避免重复加载领域错误类型。

实际执行：

```bash
# 以下测试在临时构建目录执行，环境只供连接本机测试数据库，不输出变量值。
DOTENV_CONFIG_PATH=/data/apps/plotstay/.env npm test
npm run build
DOTENV_CONFIG_PATH=/data/apps/plotstay/.env ./node_modules/.bin/tsx --test --test-concurrency=1 tests/ssr.test.ts tests/seo.test.ts tests/dev.test.ts tests/discovery-e2e.test.ts tests/details-e2e.test.ts tests/booking-e2e.test.ts tests/content-management-e2e.test.ts tests/persona-reviews-e2e.test.ts tests/persona-workspace-e2e.test.ts tests/persona-workspace-races-e2e.test.ts tests/reviews-workspace-e2e.test.ts tests/workspace-e2e.test.ts tests/overview-e2e.test.ts
# 最后补齐下架历史列表、回复原子提交和键盘/加载/长文证据后：
DOTENV_CONFIG_PATH=/data/apps/plotstay/.env ./node_modules/.bin/tsx --test tests/reviews-workspace.test.ts
npm run build
DOTENV_CONFIG_PATH=/data/apps/plotstay/.env ./node_modules/.bin/tsx --test tests/reviews-workspace-e2e.test.ts
```

| 实际运行 | 结果 | 证据 |
| --- | --- | --- |
| 标准后端套件 | 106/106 通过，65.5 秒 | [完整 TAP](verification/unit-full.tap) |
| 完整端到端套件 | 93/93 通过，356.0 秒 | [完整 TAP](verification/e2e-full.tap) |
| 最终评价数据／权限补测 | 11/11 通过，13.5 秒 | [TAP](verification/reviews-final.tap) |
| 最终评价浏览器补测 | 8/8 通过，16.0 秒；包含父测试，7 个子场景 | [TAP](verification/browser-final.tap) |
| 最终构建 | TypeScript、Astro 检查及构建通过；0 errors/warnings/hints | [构建输出](verification/build-final.txt) |
| 部署后只读检查 | 31 项通过，无浏览器异常 | [结果](deployment-check.json)、[可复跑脚本](check-deployment.mjs) |

这些数字有重叠，不能相加冒充独立用例数。完整套件在最后小范围补充前执行；最终相关套件覆盖补充代码，没有虚称重新运行完整套件。新增测试在修复前曾暴露 head-only 审核、旧 fixture 假设及上下文遮蔽缺口；均已修复。临时构建包链接不正确导致的错误类型失配、浏览器测试对话框等待竞态也已纠正。未删除失败用例掩盖结果；旧测试的 head-only 断言依据已确认 C12/C13 改为固定 A 与保留 B，历史摘要旧列对比另由 012 专项检验新增指针。

## B01–B36

下表“通过”只表示列明的隔离 API、浏览器或代码核对证据，不表示公网认证或物理手机验收。主要证据：

- **D**：[评价专项](../../../tests/reviews-workspace.test.ts)；11 项，固定版本、事务、权限、迁移、分页与旧路由。
- **U**：[既有评价／回复测试](../../../tests/persona-reviews.test.ts)及标准套件，字段、评分、旧账户、各条目类型和恢复。
- **W**：[浏览器专项](../../../tests/reviews-workspace-e2e.test.ts)、[交互请求记录](browser-evidence.json)。
- **E**：[完整 E2E](verification/e2e-full.tap)，包括旧 account/admin、首页、角色保存和两轮 dirty／请求竞态修复。

| ID | 结果 | 本轮证据与边界 |
| --- | --- | --- |
| B01 | 通过 | D 个人来源／提供者授权查询及普通账号路由；管理员的个人列表也按本人关系筛选。 |
| B02 | 通过 | D managed 来源隔离；U/E 旧后台手记、前台和合法提供者回复；无按姓名认领。 |
| B03 | 通过 | D 45 条、20/20/5 三页、完整 total、角色及正文尾部搜索、旧记录公开新回复升序；权限在 CTE 分页前处理。 |
| B04 | 通过 | D P/A/B 独立指针与多状态筛选；W 中英 16 张基础矩阵，不重复评价实体。 |
| B05 | 通过 | D 对方私稿前后列表深比较一致，公开后才改变摘要与最近事件。 |
| B06 | 通过 | D 公开回复事件时间／角色改名不改变列表；没有浏览写入和已读模型。 |
| B07 | 通过 | U 唯一评价及并发开始；W 选条目／角色后继续已有评价。 |
| B08 | 通过 | D/W 普通无订单账号创建、保存、提交；复用现有资格检查。 |
| B09 | 通过 | D 预期 persona 和资料版本、作者与提供者归属检查；URL 聚焦仅筛选。 |
| B10 | 通过 | W 中英文、emoji、换行、源语言、origin 保存重读；可选字段保留。错误语言／字段展开定位由前端 validation 明确实现，未逐字段穷举浏览器输入。 |
| B11 | 通过（有边界） | 代码核对与 U：沿用实际 200 标题／20000 评价正文／10000 回复正文限制，读取不截断历史，列表有摘要；W 长原文和 Unicode 输入。超长历史数据的所有旧格式组合未穷举。 |
| B12 | 通过 | U 公开评分、替代贡献与回复不影响评分的回归；新 UI 空值发送 null，不以 0 替代。 |
| B13 | 通过 | D 组合保存送审同事务、固定 revisionId/savedAt/outcome；注入提交失败全部回滚。 |
| B14 | 通过 | D 同 requestId 并发五次返回相同结果、不同负载冲突，回复双请求一致；W 丢响应后重试版本数不增加。 |
| B15 | 通过 | D 评价和回复保存 B 保持 A，审核队列及旧 admin 仍读 A；W P/A/B 截图。 |
| B16 | 通过 | D 明确提交新版本才替代 A，旧审核返回 SUBMISSION_SUPERSEDED；旧提交记录不可变。 |
| B17 | 通过 | D 三轮真实 Promise 并发批准 A 与保存提交，固定结果和事务串行；批准 A 不清 B。 |
| B18 | 通过 | D 退回意见绑定 A，head B 仍为 draft；没有把 B 错标退回。 |
| B19 | 通过 | U 签名快照、被替代资料不可误发；D 资料版本冲突检查与角色改名不改公开署名。 |
| B20 | 通过（有边界） | D 笔记 sentinel 不出现在 DTO/搜索；W 不调用 notes API、DOM 无标记；代码不从私人笔记表获取评价数据。未读取或审计现用敏感日志，日志管道逐条穷举未验证。 |
| B21 | 通过 | D 旧作者历史可读不可写、互不可读私稿；W 只读历史无 editor。 |
| B22 | 通过 | D 同账号换 persona 后提交旧稿被拒绝；旧 saveReply 无明确新身份时拒绝沿用旧角色，组合命令核对绑定。 |
| B23 | 通过 | D 新提供者初始私稿列表为空，仅得 opaque base/submissionGuard；保存自己的稿后明确替代旧待审，不继承正文；U 公开署名恢复。 |
| B24 | 通过 | D 条目下架的本人历史仍在只读列表和详情，条目标题／他人评价上下文遮蔽；U 角色停用仍读本人历史，写入关闭。 |
| B25 | 通过 | D 世界／站点限制拒绝历史并排除列表计数；entries 只返回公开合法条目；U 公共可见性回归。 |
| B26 | 通过 | D 绑定、角色、资料版本、公开上下文逐次重验；W 冲突保留输入，不显示假成功。浏览器中途停用的每个排列未穷举。 |
| B27 | 通过 | W 同账号重登保留输入并请求当前版本／资格，再由用户继续；旧命令不盲重发。 |
| B28 | 通过 | W 换账号清空表单与 DOM；seq/nav/actorId 拒绝迟到响应，本地范围按 actor.id 隔离。 |
| B29 | 通过 | W 比较服务器版本后保留中英输入，以服务器正文为 dirty 基准，取消离开仍在编辑；E 角色既有 dirty 四场景不回退。 |
| B30 | 通过 | W 慢保存继续输入、已提交但丢响应、导航等待时继续输入、失败仍在编辑；序号使旧请求无法覆盖当前上下文。 |
| B31 | 通过（有边界） | W 返回恢复搜索与两页共用角色；实现保存完整 returnTo/scroll、revision/replyEvent 深链接优先；E 首页对象来源回归。每一种浏览器原生后退栈、全部滚动位置组合未穷举。 |
| B32 | 通过 | W 历史详情无输入或保存按钮；D 原作者／当前绑定／可见性分开判断并给出只读原因。 |
| B33 | 通过 | U 各类型公开隐藏、恢复及签名快照回归；review 恢复额外验证父条目当前可见性，草稿指针独立。 |
| B34 | 通过 | D 新旧 route 固定 A 审核、origin/session 与令牌检查；E account/admin；旧 replies/:id 仍为评价 ID。 |
| B35 | 通过 | E 角色、私人笔记、dirty、慢请求与首页回归通过；角色控制器/CSS diff 为空。 |
| B36 | 通过（限定规模） | D 45 条列表每次 1 条聚合 SQL，20 条分页；历史每页 20 加固定 P/A/B/指定授权版，事件上限100。W 无逐卡历史／笔记调用。未做公网容量、万级数据或长期负载压测。 |

## V01–V12：真实视觉与交互

[截图索引及同尺寸前后对照](visual-review.md)。本轮 30 张均来自隔离 schema 的真实 API/Web，不是阶段 A mock，也不是生成图。V01–V04 的 16 张覆盖中英文 1440/390。人工查看渲染图并结合几何断言核对：

| ID | 结果与依据 |
| --- | --- |
| V05 | 通过。一个 h1，世界/条目背景、身份、正文、回复层级独立，阅读主体在主列。 |
| V06 | 通过。无设计说明侧栏、铃铛、未读数、假官方身份或示意字数。 |
| V07 | 通过。桌面右侧状态/时间/操作稳定；手机自然堆叠，长英文按钮换行，不横溢。 |
| V08 | 通过。没有空图片大框或上传入口，未新增头像/条目图片能力。 |
| V09 | 通过。纯阅读态完整正文；编辑长原文可展开，进入编辑滚到输入区；不铺三份 P/A/B 正文。 |
| V10 | 通过（浏览器模拟）。390/360 手机、1100 窄桌面，现有手机菜单和角色范围可见；无整体缩放。物理设备及软键盘未验证。 |
| V11 | 通过。可选字段 details 保值，定位错误会切语言/展开目标区；长文和中英切换截图及交互。 |
| V12 | 通过（有限检查）。原生标签/按钮/select/details，状态带文字；角色筛选键盘 Enter，语言 tab 方向键，输入焦点。未做屏幕阅读器人工验收。 |

## O01–O10：发布与审计

| ID | 结果 | 证据 |
| --- | --- | --- |
| O01 | 通过 | 仅新增 012；001–011 未改，011 私人笔记未占用；无 seed/reset。 |
| O02 | 通过 | [契约](contract.md)说明指针、不可变快照、幂等表和索引；D 回填旧 A/B、重复 migrate、历史不变；发布前受限备份及目录校验，未做现用备份还原演练。 |
| O03 | 通过 | [迁移审计](migration-audit.json)：14 张原业务表计数及原字段摘要一致；现用写入仅获授权迁移新增结构/有效指针回填。 |
| O04 | 通过 | 上列实际命令、最终结果与失败修复记录；完整与最终补测次数分列。 |
| O05 | 通过 | 开发域名已更新；停止服务→备份→审计→迁移→安装已验证产物→启动→health/active；无 Nginx/systemd 配置变更。 |
| O06 | 通过（公网门禁） | 31 项只读检查，Basic Auth、noindex/nofollow/noarchive、no-store、robots；应用无会话403仍保留。公网通过 Basic Auth 后的认证交互未验证。 |
| O07 | 通过 | [文件范围](files.txt)、共享函数最小修改；persona 控制器/CSS 未改，三个 ZIP SHA256 不变，未整理其他 session。 |
| O08 | 通过 | HEAD 不变，未 commit/push，未 git add -A；原 example_pages.zip 保持未跟踪。 |
| O09 | 通过 | LT-REV-01 已加入既有长期问题清单，明确非本轮、不实现已读。 |
| O10 | 通过 | 明确区分 mock／隔离真实服务／本机已部署服务／公网门禁／公网认证／物理设备，未验证项未冒充通过。 |

## 当前限制和未验证项

- 公网通过 Basic Auth 的登录后交互未验证：没有读取密码文件或索取/输出凭据。本机隔离服务已完成真实登录、保存、权限和截图，已部署服务仅做无登录只读检查。
- 物理手机、真实软键盘和屏幕阅读器未验证；响应式证据为 Chromium 视口和 200% 文字放大。
- 未做万级数据压力测试、所有浏览器历史栈/滚动排列、每个错误字段及资格变更的笛卡尔积测试。对应已实现约束和实际覆盖如上。
- 012 对过去没有冻结过的译文只能冻结迁移时仍有效的引用，不伪造当时快照；没有改写历史正文或旧公开署名。
- 备份已验证可读目录，未在现用库做还原演练。保留旧产物和备份，优先修复前进；不得无授权回写备份覆盖新业务。
- 当前无已知阻断测试失败。用户实机体验验收仍待进行；LT-REV-01 继续长期待办。
