# 第二次内容工作台 review 修复与部署

2026-10-15，基线 `d0ac1d1`。用户要求修复本轮两项问题，并明确回复“允许，更新测试域名”。验收后用户授权 commit & push，并确认这一块暂时收尾；本次归档包含数据库修复及部署记录，沿用已通过的验证，不重复部署。

## 结果

1. 数据库013/014与旧写服务混用：使用已有新领域逻辑替换运行中的旧 Web/API，不增加数据库补丁。新服务的旧创建接口缺角色时返回400；合法创建在同一事务写入所有权和经营绑定，送审后建立永久锁。测试域名服务于16:03:04 JST更新，health正常。切换前后只读盘点均为24条作品，迁移后新增0、缺归属/缺绑定/归属冲突0、缺资格记录的待审0，因此没有二次修改业务数据。后续不能再切回不维护这些字段的旧构建。
2. 首次保存成功后GET失败：编辑器立即保留已提交结果与作品ID，并更新地址；再次保存先重试详情读取。持续失败不再发保存POST；读取恢复后，无新输入则只完成读取，有新输入则编辑原作品。服务器已被另一窗口更新时保留输入并阻止写入。明确重新载入可使用已保存ID；切换世界或新建时清除待恢复上下文。旧编辑器共用相同恢复代码，布局和样式未改。

## 验证

- [最小真实浏览器记录](verification.json)：普通作者、真实隔离PostgreSQL/API，修改后重试、未修改重试、并发冲突三种场景；每种先模拟两次GET失败，确认期间只有一次POST，最终仍只有一个作品。另验证新服务旧创建/送审入口的原子归属与绑定。1个测试组通过，不宣称是全套回归。[测试日志](tests.log)
- [构建日志](build.log)与[类型检查](check.log)：0 errors、0 warnings、0 hints。
- [切换后只读审计](live-audit.json)：无现用业务数据写入；审计脚本使用BEGIN READ ONLY，独立于隔离测试，不会seed或迁移。
- [部署验证](deployment-check.json)：25项通过，覆盖公网Basic Auth、noindex/no-store、robots禁止抓取、新API/资源保护、同一已部署服务登录后列表/创建页面，以及旧入口/公开页HTTP烟测。已登录截图通过本机受控监听访问实际部署服务；没有声称完成公网Basic Auth登录后的浏览器验证。线上未执行保存测试，普通作者写入验证只在隔离库完成。

## 截图

| 页面 | 中文桌面1440 | 英文手机390 |
| --- | --- | --- |
| 已部署列表 | [截图](screenshots/deployed-works-zh-1440.png) | [截图](screenshots/deployed-works-en-390.png) |
| 已部署创建 | [截图](screenshots/deployed-create-zh-1440.png) | [截图](screenshots/deployed-create-en-390.png) |

隔离复现截图：[修改后恢复](screenshots/recovery-edited-en-1440.png)、[未修改恢复](screenshots/recovery-unchanged-zh-390.png)、[并发冲突](screenshots/recovery-conflict-en-390.png)。

## 范围与运行方式

生产源码只改 `apps/web/src/lib/admin.ts`。新增测试 `tests/works-readback-recovery-e2e.test.ts`；更新 development-status、migration-plan 和本目录证据。沿用013/014，没有015；没有改代理、重跑seed或历史清理。开工已有的阶段A、Nginx、operations和原始ZIP保持原样。

隔离测试使用临时tmpfs PostgreSQL端口55439、`DOTENV_CONFIG_PATH=/dev/null`、`DATABASE_URL=postgres://works_test:isolated-works-test-only@127.0.0.1:55439/works_test`，测试账号凭据仅用于该临时实例。`PLOTSTAY_TEST_BUILD=/tmp/plotstay-works-fixes-second` 指向隔离构建；执行 `./node_modules/.bin/tsx --test tests/works-readback-recovery-e2e.test.ts`。测试结束清理schema和临时进程，专用容器随后停止删除。

部署按operations执行 `npm run build`、`sudo systemctl restart plotstay-preview`，用户已明确批准；未修改systemd配置。浏览器核验仅登录/退出已有demo账号并读取页面/API，不写作品、角色、评价或资格。
