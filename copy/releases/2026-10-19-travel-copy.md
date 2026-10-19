# 拉斯世界文案应用与发布

日期：2026-10-19（JST），18:48 左右完成服务更新，18:50 完成认证路径补查。

## 发布范围

- 本轮审定的首页、目录、三类详情栏目、搜索筛选、预约与恢复提示、凭证网页与导出图片、Isi 页脚和签发署名已应用。
- `copy/` 为审稿来源，`python3 scripts/build-copy-catalog.py` 导出 `apps/web/src/lib/travel-copy.json`（167 个中英条目）；`travel-copy.ts` 维护代码旧字符串到审定条目的明确绑定。
- 首页通过 saveHomeDraft → submit → publish 发布新版本；示例铸造区改为铸造区／Foundry Ward、静默档案区改为静谧档案区，使用已有地点版本流程。轨道船坞名称已一致，不新建版本；slug 与关联内容未改变。地点介绍在目录展示层按对应 slug 呈现。
- 详情栏目通过当前请求的拉斯世界文案覆盖层应用，保留原稳定键；全站共享数据库文案配置未变。其他世界继续使用其既有配置。
- 真实 Cookie／存储／重复提交说明保持平台口吻；角色化段落及署名限定拉斯世界。历史预订快照未写入或重算。
- 未修改业务规则、seed 或数据库结构。未将后台与审核的既有未提交改动纳入本轮修改；构建包含其此前已经部署的现用源码，见此前整合发布记录。

## 版本与证据

- 文案审定基线：`eadd122`（此前已推送）。本轮应用代码与页脚修订纳入此次提交推送；源文件摘要见 [文件清单](2026-10-19-copy-files.json)。
- 首页、地点新旧 revision / publication ID 见 [版本记录](2026-10-19-copy-versions.json)。版本历史仍在数据库内。
- 发布前产物备份：`.runtime/copy-20261019/original-artifacts/{web,api,worker}`。
- 发布前公开文案与原版本：`.runtime/copy-20261019/before.json`；实际目标及结果：`proposed.json`、`published.json`。
- 浏览器证据、导出图片和构建日志保存在 `.runtime/copy-20261019/`，使用合成预订响应，不包含真实旅客资料。

## 验证

- `npm run build` 通过，TypeScript / Astro 0 errors、0 warnings、0 hints；`git diff --check` 通过。
- 文案绑定专项测试通过：其他世界不被覆盖、共享配置不被修改、恢复状态区分及绑定目标有效；28 个详情绑定均找到唯一现有稳定键。
- 发布前预览、发布后现用服务分别通过同一组 30 项浏览器检查（不相加）：中英、桌面／390px、首页、目录、三类详情与预约、同一请求重试、剪贴板失败、图片导出与失败、其他世界隔离、凭证无法访问。
- 测试通过拦截浏览器写请求模拟预订与签发，不在现用库创建测试预订或游客；重试请求内容完全一致。未执行全量后台测试，业务算法未改。
- 49 张表发布前后摘要比较：仅首页及地点文案的 9 张预期配置／版本／审计表变化；其余 40 张表一致，包括 8 条既有预订及内容历史。共享 detail copy 原发布版本保留。
- `plotstay-preview` active，`/api/health` 正常。公网 `/zh`、`/en`、`/api/health`、媒体及设计预览未认证均为 401，带 `noindex, nofollow, noarchive` 和 `private, no-store`；`robots.txt` 公开返回 `Disallow: /`。
- 按本次用户项目约定恢复 Basic Auth，结束先前临时匿名预览。中英业务页面验证通过同一部署服务的本机监听地址；没有读取 Basic Auth 密码，未另测公网认证后的浏览器会话。

## 回退

1. 若数据版本尚未再次变更，执行 `node --import tsx scripts/apply-travel-copy.ts --rollback`，通过现有恢复发布流程切回记录中的旧发布版本。脚本依赖本机 before / published 记录；若文件丢失，按本记录版本 ID 通过已有后台历史恢复。
2. 应用产物回退：停止 `plotstay-preview`，将当前 `apps/{web,api,worker}/dist` 移到新的故障备份目录，再把上述 original-artifacts 的对应目录复制回各 dist，重启并核验 health、首页及认证保护。
3. 不恢复整个数据库，不重跑 seed，不撤销预订或业务历史。保持开发域名 Basic Auth 和禁止索引设置。

## 中文页脚姓名补充（18:58 JST）

中文维护署名增加“（Isidorrus）”，使下一行“第二个 R”的附注有明确对应；英文沿用原稿。文案库与生成目录已同步，构建通过并重启开发站服务。现用服务 `/zh`、`/en` 的署名和附注核验通过；公网页面未认证 401、noindex 与 robots 禁止爬取均保持。本次无数据库修改。
