# Plotstay 项目操作约定

开始工作前阅读 `docs/operations.md`、`docs/development-status.md` 和本次任务相关方案。

- `https://plotstay.xingwu.dev` 是开发调试域名。用户已授权：每次代码修改完成、相关验证通过后，默认构建并更新该域名，再验证线上结果；除非用户明确要求暂不部署，不需要另问一次是否发布。只修改文档时无需重启服务。
- 发布命令与 Nginx/systemd 配置更新方法见 `docs/operations.md`。完成报告说明线上是否已更新，不能把只改了源文件当作已发布。
- 开发域名全站保持 `SITE_INDEXABLE=false`、`X-Robots-Tag: noindex, nofollow, noarchive`、`robots.txt` 的 `Disallow: /` 和 Nginx Basic Auth。新增页面、API、静态资源及代理路径必须继承这些设置。仅 `/robots.txt` 公开提供禁止爬取指令。
- Basic Auth 凭据与应用后台账户独立。密码与 htpasswd 哈希不提交 Git；源站密码文件为 `/etc/nginx/auth/plotstay.htpasswd`。
- 更新使用已有数据库及数据卷，不默认重跑 seed、不重置数据。仅在本次改动需要时执行增量迁移。
