# 审核工作台部署 · 2026-10-18

用户明确授权“部署一下让我测试”。开发域名已于 **2026-10-18 19:47:17 JST** 更新；`plotstay-preview` active/running，Web/API 健康检查通过。

发布来源为隔离分支 `codex/moderation-20261016` 的 `216d64cfd3a0a26c3a9a3b34ac6f752f5543de66`（实现及修复 `af707f3`，后续提交归档验证日志）。重新执行完整构建，TypeScript/Astro 0 errors / warnings / hints；316 个部署文件的 SHA-256 与该次构建记录一致。

## 入口

- `/zh/workspace?view=moderation`：评价与回复审核。
- `/zh/workspace?view=site`：网站管理；角色资料审核、创建普通账号、条目提供者绑定。
- 英文将 `/zh/` 换为 `/en/`。沿用现有账号；网站管理仅网站管理员可见。
- `/_design/moderation/` 仍是静态示例，真实验收使用上面的工作台入口。

## 验证与边界

[只读检查结果](checks.json)共44项通过，浏览器无JS异常或失败响应。涵盖公网未认证门禁、robots、响应头、新接口未登录403、现有管理员读取队列/绑定、两种语言五个页签、1440/390px无横向溢出、现有评价/回复/资料详情和旧入口。使用同一已部署服务的本机监听地址核验登录后浏览器；未读取Basic Auth密码，公网通过Basic Auth后的浏览器交互未验证。截图记录在本目录，含现用演示资料，留作本地验收，不自动推送。

检查只登录/退出既有管理员；无业务保存、审批、创建账号、绑定修改。无迁移、seed/reset、数据修复；沿用001–014及现有数据库、卷、账号。Basic Auth、SITE_INDEXABLE=false、noindex/nofollow/noarchive、private/no-store、robots Disallow:/保持。未改Nginx/systemd配置。

核验脚本首轮错误地使用角色ID访问资料版本详情，产生404并超时；修正为revision_id后全套44项通过。此为核验脚本修复，不涉及应用修改。

## 运行产物与回退

> 部署后更新：用户已通过验收并授权合并及清理分支，`216d64c`已快进合并main；本次只新增交接与预览归档，应用源码与运行构建一致，可恢复从main构建。隔离worktree保留为detached HEAD，保留本地产物。以下为部署时历史状态。

主工作区仍是 `main` / `4d7d72c`，没有合并或覆盖其他会话源码/文档。构建来自 `/tmp/plotstay-moderation-dev`，安装至 `/data/apps/plotstay/apps/{api,web,worker}/dist`，现有systemd脚本启动Web/API。**主工作区源码与已部署构建暂不一致，不要直接在main重新build覆盖本次发布；后续先完成明确的源码整合，或继续从上述提交构建。** 本轮未额外commit/push。

旧产物及完整发布摘要保留于 `.runtime/moderation-deploy-20261018/`；实际安装前的目录保留在其 `original-artifacts/{api,web,worker}`。需要回退时停止plotstay-preview，将旧产物恢复到对应dist，再启动并检查health；不恢复数据库。部署脚本已包含安装/健康失败时自动恢复旧产物，本轮未触发回退。发布摘要见[release.json](release.json)，构建日志见[build.log](build.log)。
