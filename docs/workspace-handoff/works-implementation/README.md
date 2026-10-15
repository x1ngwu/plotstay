# 我管理的内容＋创建内容：阶段 B 交付

2026-10-15。本会话已确认阶段 A 原型、B0 范围及 G01/G03/G05/G06 选择，现已接入应用代码和真实作者 API，完成隔离验收。**未连接现用数据库，未迁移现用数据，未部署/重启/改代理，未 commit/push。** 开发域名仍是此前版本；原 `/_design/works/` 静态原型不是本轮真实应用上线证明。

实际 HEAD 和远端 main 均为 `8b783e4f0a698320387cb2bab7f0ce298c086b92`。只有一个工作树。开工时的 Nginx/operations/阶段 A 文档与附件均保留，没有 reset；进程/工作树盘点不能保证不存在不可见的外部 session，因此仅按已识别的变更范围工作。[起始记录](starting-state.json)与 [最终文件清单](changed-files.json)可核对。

## 已实现

- 本人账号所有权、独立世界加入/经营资格、经营绑定唯一真值、原子首次保存及重试幂等、首次成功送审/发布永久锁、具体作品的作者详情/历史/预览权限。
- 普通作者无需世界 editor/admin，可准备本人草稿。世界管理员或网站总管理员批准经营资格前必须先有加入记录。未批准角色只能准备草稿；正式操作重新校验资格。资格撤销不会回退为“从未加入”，旧待审不会自动复活。
- `/{zh|en}/workspace?view=works` 默认本人、跨世界服务器筛选/计数/排序/分页；管理员可以主动进入全部授权范围。
- `/{zh|en}/workspace?view=create` 保留认可的一页三选，合法预填、错误/空态、角色页返回。进入编辑不创建记录；编辑器首次成功保存才创建。
- 现有编辑器最小桥接，真实保存、批准身份预览、绑定/锁定、冲突与会话恢复、返回原筛选及排序变化提示。旧世界内容、审核、工具、account/admin 保留。

没有搭建完整加入申请/邀请/经营审批页面；最小受控审批 API 已提供。存量归属和历史绑定仍是 **G02/G04 待审计事项**，没有假装通过；缺证据的旧作品显示待核对并阻止写入。现用升级前需要单独确认审计范围及逐条处理方案。

## 截图与核验

44 张本轮真实浏览器截图位于 [screenshots/](screenshots/)，覆盖 16 个中英桌面/手机基础场景、4 个 200% 字体场景以及筛选、双状态、预览、无角色/无世界、错误与会话等补充场景。

| 页面 | 中文桌面 | 英文桌面 | 中文手机 | 英文手机 |
| --- | --- | --- | --- | --- |
| 内容列表 | [1440](screenshots/works-zh-1440.png) | [1440](screenshots/works-en-1440.png) | [390 卡片](screenshots/works-zh-390-cards.png) | [360 卡片](screenshots/works-en-360-cards.png) |
| 创建内容 | [1440](screenshots/create-zh-1440.png) | [1440](screenshots/create-en-1440.png) | [390](screenshots/create-zh-390.png) | [360](screenshots/create-en-360.png) |

[公开版＋新草稿](screenshots/works-public-plus-new-draft.png)、[修改待审](screenshots/works-public-plus-submitted.png)、[修改被退回](screenshots/works-public-plus-returned.png)、[真实私有预览](screenshots/private-saved-preview-en.png)、[手机筛选面板](screenshots/works-en-mobile-more.png)、[保存期间继续输入](screenshots/editor-input-during-save-zh.png)、[无世界](screenshots/create-no-world.png)。

`check` 无错误/警告/hint；隔离构建通过。原领域回归 112/112，本轮专项及翻译回归 23/23。原浏览器回归按每组末次结果为 98/98；本轮另有真实普通作者的 25 组场景记录。不同日志有重复回归，不将数字相加冒充独立用例。详细步骤、初次失败原因和最终证据见 [acceptance.md](acceptance.md)。物理手机/软键盘及本轮部署后的公网认证交互未测。

## 工程核实状态

| 项目 | 已存在 | 本轮新增/适配 | 依赖缺失或待确认 |
| --- | --- | --- | --- |
| 账号归属 | 历史 author_id/编辑/导入记录 | 新作品不可变 `work_ownership`，不随管理员编辑转移 | G02 现用历史证据、人工 owner 映射 |
| 作者/经营资格 | 只有世界管理成员权限 | 独立加入与资格/epoch，普通作者窄权限，管理员受控记录命令 | 完整申请/邀请/审批界面不在本轮 |
| 经营身份 | persona_id、provider_bindings 并存 | 列表、保存、预览、回复统一正式 binding；旧 API 同规则 | G04 历史缺失/冲突清单及修复授权 |
| 永久锁 | 原改绑允许覆盖 | 领域校验＋数据库单调锁；旧成功事件回填锁 | 历史缺绑定不能凭锁猜角色 |
| 跨世界列表 | 原按单世界的 adminList | 权限 CTE 后筛选/计数/分页和稳定 lastSavedAt | 现用数据规模性能待授权副本复核 |
| 真实预览 | 原管理员预览及公开模板 | 作者对象级授权，复用模板、版本/token、保护头及返回 | 无新增世界私稿读取权限 |
| 版本 | 原三类 head/token；评价另有 A/B | 保留三类机制；资格失效后明确重新提交 | 不将评价新机制扩展给作品 |
| 首次保存 | 原编辑器创建逻辑 | 参数进入编辑零写入；首次保存事务、账号级幂等、并发保护 | 现用迁移/部署须后续授权 |

## 隔离复现方式

以下仅用于新的独立测试实例。端口/库名与测试守卫一致，不读取现用 .env，不将现用数据库 URL 替换进这些命令。若同名容器已存在，先确认它确为本轮隔离实例；不要删除业务容器。

```bash
docker run --detach --rm --name plotstay-works-b-20261015 \
  --publish 127.0.0.1:55439:5432 --tmpfs /var/lib/postgresql:rw \
  --env POSTGRES_USER=works_test --env POSTGRES_PASSWORD=isolated-works-test-only \
  --env POSTGRES_DB=works_test postgres:18-bookworm

DOTENV_CONFIG_PATH=/dev/null PLOTSTAY_TEST_OUT_DIR=/tmp/plotstay-works-b-final/web \
  npm run build --workspace @plotstay/web

DOTENV_CONFIG_PATH=/dev/null \
DATABASE_URL=postgres://works_test:isolated-works-test-only@127.0.0.1:55439/works_test \
  ./node_modules/.bin/tsx --test tests/works.test.ts tests/translation.test.ts

DOTENV_CONFIG_PATH=/dev/null \
DATABASE_URL=postgres://works_test:isolated-works-test-only@127.0.0.1:55439/works_test \
PLOTSTAY_TEST_BUILD=/tmp/plotstay-works-b-final \
  ./node_modules/.bin/tsx --test tests/works-e2e.test.ts
```

浏览器测试自行启动真实临时 API/Web、创建合成数据、执行交互和截图，结束时关闭它们并删除随机测试 schema。这里的临时端口仅供隔离自动化，不作为交付用户体验的 localhost 替代域名。正式体验入口仍应在后续获准更新开发域名后提供。

接口细节见 [api-contract.md](api-contract.md)，本会话确认记录见 [contract.md](contract.md)，必要共享范围和回归见 [acceptance.md](acceptance.md)，待授权执行的增量升级与回退安排见 [migration-plan.md](migration-plan.md)。本轮临时 API/Web 与随机测试 schema 已清理，专用 tmpfs PostgreSQL 容器已移除。当前停止在现用审计、迁移及部署之前。
