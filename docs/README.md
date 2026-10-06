# Plotstay 文档

Plotstay 首期是围绕《战锤 40,000》Lathe Worlds（拉斯世界）的虚构旅行网页游戏，先完成中英双语的内容浏览和模拟预订。采用 digi-tech Lime 风格，以 dummy data 起步。**基础架构已确认：Astro 按需渲染、独立 Node.js / TypeScript API、PostgreSQL、后台翻译任务。** 内容需要审核与版本历史；翻译服务和密钥稍后配置。

基础方案已提交推送，阶段 1、2 已完成功能验收，阶段 2 实现已提交为 `f03cbef`。当前临时插入阶段 2.5「多语言 URL 与 SEO 规范修复」，已立项、待实施；验收后再讨论首页布局并进入阶段 3。方案状态以以下文档为准。

新 session 请先阅读[开发顺序、进度与交接](development-status.md)，核对当前工作区，再按计划继续。

| 文档 | 用途 |
| --- | --- |
| [当前产品计划](plan.md) | 已确认决策、首期页面、功能、多世界与多语言结构、开发顺序及后续范围 |
| [开发顺序、进度与交接](development-status.md) | 各阶段状态、运行方式、实际验收结果、剩余事项与下一 session 的目标 |
| [阶段 2.5：多语言 URL 与 SEO 修复](i18n-seo-remediation.md) | 临时修复项目的范围、统一规范、开发清单、验收标准和官方依据；已立项，待实施 |
| [架构方案与取舍](architecture.md) | 已确认的架构、基于 Tomodachi 与 Cocoons 实际代码的选择理由、数据流转、权限、翻译、缓存与发布机制 |
| [决策记录](decisions.md) | 本次讨论的确认经过、实施边界、后续细化事项，以及先文档提交再开发的执行顺序 |
| [完整讨论文字](sources/chatgpt-discussion-2026-10-06.md) | 原分享记录的 10 轮讨论，包含 45 条可见消息和主题索引 |
| [结构化原文](sources/chatgpt-discussion-2026-10-06.json) | 保留原始消息文字、时间、引用和附件元数据，便于后续处理 |
| [原始网页快照](sources/chatgpt-discussion-2026-10-06.html.gz) | 从公开分享页获取的 HTML，使用 gzip 压缩保存 |
| [抓取与完整性记录](sources/chatgpt-discussion-2026-10-06.manifest.json) | 来源、时间、消息计数、校验值与附件下载状态 |

讨论来源：[ChatGPT 分享记录](https://chatgpt.com/share/6ac4b779-86ac-83ec-b60c-faaac3f70716)。抓取日期为 2026 年 10 月 6 日。原文保留方案演变，当前执行范围以产品计划为准。

文字已完整提取并核对。第一条消息的两张截图因公开下载接口返回 HTTP 401 而未下载，已保留其文件名、尺寸、大小和引用；图片附件归档仍有这一缺口。
