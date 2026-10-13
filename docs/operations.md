# Plotstay 项目操作手册

## 开发域名与默认发布规则

`https://plotstay.xingwu.dev` 是开发调试环境，中文入口 `/zh`，英文入口 `/en`，后台 `/zh/admin`。域名根路径自动跳转语言首页。

用户于 2026-10-08 授权：以后每次代码修改完成并通过相关验证，都默认更新线上开发域名，无需再次确认发布。除非用户明确要求暂不部署，否则任务完成包含构建、服务更新和线上验证。只修改文档时不需要重启；这项授权不代表自动推进尚未授权的产品阶段。

## 访问和爬虫设置

- 整个开发域名默认需要 Nginx Basic Auth，用户名 `admin`，密码使用用户指定值。密码哈希仅保存在服务器 `/etc/nginx/auth/plotstay.htpasswd`，不写入仓库；应用后台仍使用原 `.env` 账户。
- 所有应用页面、API、静态资源及未找到页面都受认证保护；未登录或密码错误返回 `401`。
- HTTP 自动跳转 HTTPS；全域响应（包括跳转与错误）都带 `X-Robots-Tag: noindex, nofollow, noarchive`。
- 唯一公开例外为 `/robots.txt`，始终返回 `User-agent: *` 和 `Disallow: /`，让爬虫无需认证也能读取禁止爬取规则。
- 应用维持 `SITE_INDEXABLE=false`，页面不开放索引，sitemap 为空。Nginx 同时统一覆盖上游索引头，避免新增页面遗漏。
- 开发域名响应使用 `Cache-Control: private, no-store`，避免认证后的页面或静态资源被共享缓存。新增 Nginx location 时必须保留认证和上述响应头。

### Basic Auth 与应用会话的状态码

浏览器会因应用接口的 `401` 清除同源 Basic Auth 凭据，即使该响应没有 `WWW-Authenticate`，也会导致之后的页面和资源重新弹窗。因此浏览器入口由 Web middleware 将应用返回的 `401` 转为 `403`，保留 `SESSION_REQUIRED` / `INVALID_CREDENTIALS` 错误正文；账号、后台与预订客户端按错误码处理重新登录或游客身份恢复。草稿预览的未登录响应同样转换。

Nginx 未通过 Basic Auth 时仍返回 `401` 和原认证 realm；内部 API 的原始状态码不变。不要将应用会话失败重新暴露为浏览器端 `401`，也不要为解决弹窗而放开页面、API 或资源的 Basic Auth。浏览器负责记住 Basic Auth 凭据，其保留时间受浏览器会话／隐私设置影响，不是应用账号的 12 小时 Cookie 有效期。

## 日常发布

工作目录为 `/data/apps/plotstay`。按修改范围完成相关检查，然后执行：

```bash
npm run build
sudo systemctl restart plotstay-preview
curl --retry 10 --retry-connrefused --retry-delay 1 --fail http://127.0.0.1:4321/api/health
systemctl is-active plotstay-preview
```

构建失败时先修复，不重启到失败产物。`npm run build` 包含 TypeScript / Astro 检查；域名运行构建版，修改源码不会自动热更新。若涉及数据库结构，发布时执行所需增量迁移，保留原数据库及数据卷，不默认重新 seed。

线上验收至少包括：未认证页面返回 `401`、`/robots.txt` 返回禁止爬取指令、认证后 `/zh` 与 `/en` 正常、相关改动页面或功能正常，以及响应中包含 `noindex`。可用以下命令检查；`curl --user admin` 会交互询问密码：

```bash
curl -I https://plotstay.xingwu.dev/zh
curl https://plotstay.xingwu.dev/robots.txt
curl --user admin -I https://plotstay.xingwu.dev/zh
curl --user admin https://plotstay.xingwu.dev/api/health
```

## 代理和服务配置

配置源文件：`deploy/nginx/plotstay.xingwu.dev.conf`、`deploy/systemd/plotstay-preview.service`。

Nginx 配置变更后安装并检查，再平滑重载：

```bash
sudo install -m 644 deploy/nginx/plotstay.xingwu.dev.conf /etc/nginx/sites-available/plotstay.xingwu.dev.conf
sudo nginx -t
sudo systemctl reload nginx
```

已有 `/etc/nginx/sites-enabled/plotstay.xingwu.dev.conf` 链接。TLS 使用 `/etc/ssl/cloudflare/xingwu.dev/` 的现有源站证书，经 Cloudflare 对外提供 HTTPS。密码文件属主为 `root:www-data`、权限 `640`；更换 Basic Auth 密码可执行 `sudo htpasswd /etc/nginx/auth/plotstay.htpasswd admin`，交互输入新值。

systemd 配置变更后：

```bash
sudo install -m 644 deploy/systemd/plotstay-preview.service /etc/systemd/system/plotstay-preview.service
sudo systemctl daemon-reload
sudo systemctl restart plotstay-preview
```

`plotstay-preview` 已开机自启，同时托管 Web/API，故障自动重启。服务覆盖 HTTPS `WEB_ORIGIN`、安全 Cookie 和关闭索引设置，`.env` 保留本地开发参数及应用凭据。内部 Web/API 仅监听 `127.0.0.1:4321/4310`；本机开发请另选端口，或明确停止域名服务后再运行。

```bash
systemctl status plotstay-preview
journalctl -u plotstay-preview -n 100 --no-pager
sudo tail -n 50 /var/log/nginx/plotstay.xingwu.dev.error.log
```


## 阶段 5.5 增量配置接入

当前库新增 `007_detail_management.sql`；不要改写已应用迁移。首次接入在原库运行必要迁移后，可预演并初始化缺失详情配置：

```bash
npm run db:init:details
npm run db:init:details -- --apply
```

脚本仅创建缺失的文案／世界／地点／人物版本，记录原值，不覆盖既有草稿或发布，不自动 seed。后台正常修改通过保存、审核、发布生效，无需重建。共享资料发布影响当前引用页面，历史凭条不改变；内容恢复与共享资料恢复分别操作。

后台预览路由 `/api/admin/preview/{locale}/{id}` 仍受 Nginx Basic Auth 和应用后台身份双重保护，响应禁止缓存和索引；不要为此路径添加 Nginx 公开例外。只有 robots.txt 公开。验收步骤及证据见 `docs/phase-5-5-content-management.md`。

## 阶段 5.6 角色评价与回复

用户入口为 `/zh/account`（英文 `/en/account`）；审核及普通账号创建为 `?view=moderation`，原后台有链接。头像是内置样式，评价／回复将图像内容写入独立历史署名，不新增公开上传路径。操作步骤见 `docs/phase-5-6-persona-reviews.md`。

新增必要迁移 `008_persona_reviews.sql`，沿用原库运行 `npm run db:migrate`；不运行 seed。迁移遇到已有同角色同条目多篇评价会整体中止，不自动删除或合并历史。本次开工盘点无重复关系。角色资料审核仅网站管理员可做，世界管理员只审核其世界的发言；普通账号无需后台成员权限。

提供者绑定在审核页显式指定；角色所属账号才可写回复。将角色设为停用只阻止新发言，若要隐藏已有评价或回复，必须执行相应内容审核操作。历史恢复同时恢复该版署名与头像，既有旅行凭条不会改变。

新 `/api/me/*`、`/api/moderation/*` 以及 `/account` 页面继承全站 Basic Auth、no-store 和 noindex，禁止为其添加公开 Nginx 例外；仍只有 `/robots.txt` 公开。用户页面是私有数据的客户端壳，数据接口逐请求核验账号／世界权限；不要把游客 Cookie 或已过期会话当作账号登录。

## 后台工作台第一阶段

新版独立入口为 `/zh/workspace`、`/en/workspace`；旧 `/account`、`/admin` 及其深链接保持可用。新版 `view`、`world`、`content`、筛选和页码参数用于私有导航，管理能力依旧由相同 API 逐请求校验。实现和世界管理人工体验清单见 [第一阶段记录](workspace-handoff/phase-one-implementation.md)。

必要增量迁移为 `009_persona_current_submission.sql` 与 `010_persona_submission_pointer_guard.sql`，按 `npm run db:migrate` 应用；它们只修正角色当前待审指针，不改不可变历史，不 seed、不重置数据。工作台页面及其私有预览继续继承 Basic Auth、noindex、no-store 和 robots 禁止抓取设置。


## 工作台角色资料与私人笔记

2026-10-13 新版 `/zh/workspace?view=personas` 与英文入口已接真实保存。必要增量迁移为 `011_persona_private_notes.sql`；保留原库、原卷和既有迁移，不 seed/reset。旧 `/account` 与旧后台继续可用。

新版 `POST /api/me/personas/save` 在一个事务内保存固定资料版本并送审，或由网站管理员完成本人资料直接生效；草稿不清除旧待审指针。`/api/me/personas/:id/notes` 的 GET／PUT 仅角色所有者可用，网站管理员不能读取他人的私人笔记。笔记不进入公共资料与历史、审核、署名或索引，内部错误日志不得包含私有数据库行正文。

后续验证仍应使用隔离测试 schema；不要向现用角色写测试笔记。所有页面、接口与资源继承现有 Basic Auth、noindex、no-store，应用会话错误继续由 Web 层转换为 403。详细证据与已知验证边界见[真实接入记录](workspace-handoff/personas-implementation/README.md)。

## 工作台个人评价／收到的评价（阶段 B）

2026-10-13 `/zh/workspace?view=reviews`、`view=replies` 及英文入口已接真实 API，沿用既有壳与手机导航；旧 `/account`、`/admin` 仍可达。必要增量迁移 `012_review_submissions.sql`，011 私人笔记迁移保持原样。

评价和回复的有效待审 A 与 head 草稿 B 分离；提交新版本才替代 A，旧审核请求不能批准新 head。评价提交另冻结署名所附版本及译文引用，回复 ID 路由参数仍是评价 ID。`POST /api/me/review-workspace/save` 同事务保存/送审，按 actor/requestId 幂等并校验版本及身份。管理员角色页直接生效特例不用于个人评价。

本次发布先停止开发服务、备份 public schema 与旧构建、记录历史聚合摘要，然后 `npm run db:migrate`，安装临时目录验证通过的构建并重启。012 已应用；原历史字段/计数不变，无 seed/reset 或现用验收样例。备份放在 `/tmp/plotstay-reviews-pre012-backup/`（目录700、文件600），目录校验通过，未做现用恢复演练；后续勿无授权恢复并覆盖新数据。迁移及 API 细节见[契约](workspace-handoff/reviews-implementation/contract.md)，本轮测试和部署证据见[验收记录](workspace-handoff/reviews-implementation/acceptance.md)。

新私有接口和静态资源继承 Basic Auth、noindex/nofollow/noarchive、no-store、robots 禁爬，浏览器无应用会话继续返回403。复验脚本：`node docs/workspace-handoff/reviews-implementation/check-deployment.mjs`，只读，不生成账号或业务样例。公网门禁已验，公网认证后交互和物理手机仍未验证。没有改 Nginx/systemd 配置。
