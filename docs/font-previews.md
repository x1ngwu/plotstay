# 首页像素字体对照

2026-10-07，按用户“内容不变，只变字体，先做几套首页看看效果”的要求制作，基于阶段 3 的 `daf5a98`。用户随后确认：**英文采用 C；中文以好读性为先，默认 B，同时保留 C 供选择。**

## 已确认的字体规则

- 英文 `/en` 默认 C：英文大标题采用 Press Start K，正文及紧凑信息采用 C&C Red Alert INET。
- 中文 `/zh` 默认 B：丁卯 9px 标题和正文，英文 / 数字搭配丁卯 Code。
- 中文右上角菜单新增“中文字体”，可选“细点阵”（B）与“街机像素”（C），点击即时切换，并记住当前浏览器的选择。
- 中文偏好通过 `plotstay-zh-font` Cookie 保存一年，路径 `/`、SameSite=Lax，在 HTTPS 下加 Secure；只接受 `terminal` / `arcade`。SSR 读取偏好，刷新与浏览列表、详情、帮助和管理页时直接使用所选字体。英文始终默认 C，不受中文偏好影响。
- 正常页面使用统一 Base 中的字体规则。Press Start K 仍仅用于首页大标题和促销标题，正文与其他页面的密集信息采用较紧凑的字体。
- 字体偏好不进入浏览 URL，不改变 canonical、语言映射或内容数据。显式字体预览只影响当前预览，不写入个人偏好。

## 查看方式

- 对照页：`http://localhost:4321/font-preview`。保留原版 / A / B / C、中英文和桌面 / 390px 手机视口；切换字体保留当前阅读位置。未指定方案及切换语言时，中文展示 B，英文展示 C。地址记录所选方案，刷新及分享可复现。
- 独立首页：`/zh?font-preview=soft`、`/zh?font-preview=terminal`、`/zh?font-preview=arcade`。英文将 `/zh` 换成 `/en`；原版为 `font-preview=original`。
- `/zh` 和 `/en` 已采用上述默认规则；结果页、详情、管理及帮助页同步采用该语言的字体偏好。

对照页的工具栏独立于 iframe 内的首页，不进入产品首页。各方案复用同一份 SSR 首页及当前公开数据，未复制或重写首页内容；搜索、链接和菜单继续可用。通过内容链接进入其他页面后，可点方案按钮返回首页继续比较。

## 三套候选

| 方案 | 中文标题 | 英文标题 | 正文与辅助信息 |
| --- | --- | --- | --- |
| A · 轻像素 | 丁卯 9px | 丁卯 9px Code | 沿用原版文泉驿 / Courier 字体栈 |
| B · 细点阵 | 丁卯 9px | 丁卯 9px Code | 中文丁卯 9px，英文 / 数字丁卯 9px Code |
| C · 街机感 | 大标题、栏目及卖点用丁卯 7px；小卡片标题用 9px | 大标题、促销标题用 Press Start K；紧凑标题用 C&C Red Alert INET | 中文丁卯 9px，英文 / 数字 C&C Red Alert INET |

A 改动较轻，B 整页字体更统一，C 具有更明显的街机感。A / B 在 600px 及以下将英文栏目标题换成较窄的 C&C Red Alert，避免长单词把原有标题与“查看全部”横排撑宽；中文仍用丁卯 9px。`7px / 9px` 是字体款式名，实际字号沿用原首页。

所有方案保留原有品牌字标、字号、行高、字距、容器间距、图片尺寸、配色、纹理、边框和图标。字体字宽不同会带来自然换行与页面高度变化；这次没有调整布局或删减文字。候选点阵字体关闭浏览器合成粗体 / 斜体，以免细小字形糊成一团。没有修改数据库、文案版本、发布历史或种子数据。

## 实现与素材

- `apps/web/src/lib/typography.ts`：语言默认值、中文偏好白名单与 Cookie 名；`components/FontPreference.astro` 提供中文菜单切换。禁用 JavaScript 时保留 SSR 字体，并隐藏交互按钮。
- `apps/web/src/lib/font-preview.ts`：对照方案白名单及名称。
- Base 使用 `data-font-style` 指定当前样式，默认按语言 / 中文 Cookie 选择。首页在有效 `font-preview` 参数下显式覆盖样式；预览强制 noindex，不输出 canonical / hreflang。普通页面 SEO 沿用既有规则。
- `apps/web/src/pages/font-preview.astro`：独立比较工具，使用原首页 iframe，无新增运行依赖，也不写入中文偏好 Cookie。
- `packages/themes/pixel.css`：仅覆盖字体，不改布局规则；引入生成的 `pixel-fonts.css`，按 Unicode 范围加载 Dinkie 分包，保留缺字回退。旧版 `public/font-preview/fonts.css` 留作兼容，不再由当前页面引用。
- 五个字体文件来自 `/data/apps/cocoons-web/assets/fonts/pixel/`，逐字节复制；C&C 原始说明随附。SHA-256 均与 Cocoons 素材清单一致。授权来源及用途见素材目录的 `README.md`。

## 首轮对照核对（采用默认字体之前）

- 类型检查及构建通过。
- Chromium 核对中英 × 四方案 × 1440 / 768 / 390 / 320px，共 32 个视图，无页面横向溢出或主标题裁切。
- 首页 header / main / footer 的元素、文字、图片、表单及链接与修改前快照一致；语言链接仅多出用于保留方案的 `font-preview` 参数。
- 浏览器实际字形记录确认 Dinkie 7 / 9 / Code、Press Start K、C&C Red Alert 按方案加载，未误用系统回退字体代替候选字体。没有字体资源请求失败或页面脚本错误。
- 对照页切换字体不重新加载首页，并保留阅读位置；中英切换、手机视口、刷新后恢复方案、独立打开、无脚本方案链接及浏览后回到首页均通过。普通首页及结果 / 帮助页未请求候选字体。
- 最终构建已在原来的 `127.0.0.1:4321` 预览地址运行，API 仍为 `4310`，显式保持 `SITE_INDEXABLE=false`。实际 HTTP 返回的 CSS / 五个字体与源码逐字节一致。仍沿用会话预览进程，未配置生产部署或开机自启。
- 本地截图与记录在 `test-results/font-preview/`，不进入 Git。`verification.json` 包含各视口排版指标与真实字体；文件名如 `terminal-zh-1440-fold.png`、`soft-en-390.png`。

## 默认字体落地核对

采用用户选定的英文 C / 中文 B，并提供中文 C 切换。保留初轮全部对照方案；页面文案、插画、字号及布局规则继续沿用原版。当前实际验收记录及截图保存在 `test-results/font-defaults/`。

- `npm run build` 通过，Astro 0 errors / warnings / hints。
- Chromium 检查英文 C、中文 B / C 在 1440 / 390 / 320px 下的首页、结果、服务详情、帮助、创作说明及管理页，共 54 个视图，无页面横向溢出；首页 main 结构、内容和链接与调整前一致。
- 即时切换、按钮状态、Cookie 与 SSR、刷新、列表 / 详情及语言切换保留偏好、非法 Cookie 回退、对照页覆盖隔离与语言默认值、禁用 JavaScript 的 SSR 均通过，无脚本或字体资源错误。
- 现有 `tests/seo.test.ts` 与 `tests/discovery-e2e.test.ts` 共 17 tests 全通过，覆盖搜索、语言、行程、73 条内容遍历、服务管理、发布流程及 SEO。测试使用隔离数据库 schema。

## 加载优化（2026-10-07）

用户反馈重新开放端口后加载慢，断线后继续完成。检查确认 `4321` 原本运行的就是已构建 Astro SSR，未运行 Vite 开发服务。主要额外传输为整包丁卯 9px、符号触发的文泉驿中文 core、未压缩的 HTML / CSS / TTF；英文的一处标点也会请求完整中文字体。

- `scripts/prepare-pixel-fonts.py` 将丁卯 7px / 9px 拆成常用字、标点和剩余 Unicode 区块；浏览器依文字按需加载。两款字体分别保留原 CSS 暴露的 7,519 / 11,149 个码位，生成时验证覆盖不重叠、无遗漏，字宽与轮廓坐标相同。中文 9px 常用字包从整包 409,408 B 缩为 21,348 B，7px 常用字包为 16,776 B。
- 后备符号使用同一文泉驿字形的 22,064 B 小包，覆盖原 core 中低于 U+3000 及丁卯缺少的字符；全角斜杠 `／` 不再额外触发约 139 KB 的中文 core。其他缺字仍保留原回退。
- C&C、Press Start K、Code 与 Chicago 原始二进制不变；字体交付副本由 Vite 输出带内容哈希的 `/_astro/` 地址，使用一年 `immutable` 缓存。`assetsInlineLimit: 0` 防止小分包内联后失去按需加载能力。Base 按语言、方案及是否首页预载主要字体。
- `apps/web/server.mjs` 复用已构建 Astro 的静态资源 / SSR handler，添加 Brotli / gzip，`start:web` 与 preview 使用该入口。HTML 保持 `no-store`；中文 Cookie 偏好与内容实时发布继续生效。Range 响应不压缩。
- 原字体及附带说明保留在 `public/font-preview/fonts/`；交付字体说明、许可与生成清单位于 `src/assets/fonts/pixel/`。Python / FontTools 只用于再生成，不参与普通构建或运行。

同条件 Chromium 测量：1440 × 1000，禁用本机字体，模拟 1 Mbps 下载 / 150 ms 延迟，冷访问使用新浏览器上下文，暖访问使用该上下文再次导航；字体就绪时间包含从发起导航到 `document.fonts.ready` 的过程。传输量包含页面及其资源，按十进制 KB 显示。这是可复现的模拟结果，不是用户机器或真实 SSH 链路测速。

| 页面 | 首次传输量：优化前 → 后 | 字体就绪：优化前 → 后 | 再次访问传输量 / 字体就绪（优化后） |
| --- | --- | --- | --- |
| 中文 B | 655.1 → 109.1 KB（−83.3%） | 5.86 → 1.55 s | 6.7 KB / 0.42 s |
| 英文 C | 719.9 → 106.1 KB（−85.3%） | 6.41 → 1.51 s | 6.1 KB / 0.40 s |

验证与记录：

- 完整构建通过，Astro 0 errors / warnings / hints。SSR / SEO / discovery suites 改用实际服务入口，并与 dev suite、新增压缩回归一起运行，共 26 tests 通过；隔离 schema 验证登录、Cookie、管理、发布即时可见、搜索及 73 条内容遍历。
- Brotli / gzip 解压内容与 identity 完全相同；验证 `Vary`、HTML `no-store`、哈希字体缓存、HEAD、Range 206 字节正确。
- 54 个页面 / 视口检查通过，中文切换、刷新持久化、SSR、语言隔离、无脚本及预览对照正常。中英 B / C 首页在 1440 / 390px 下，正文元素的位置、尺寸、换行与文本逐项对比一致，无脚本或字体资源错误。
- 性能原始记录：`test-results/loading/before-no-local.json`、`after-final.json`；排版对照：`parity-before.json` / `parity-after.json` 及截图；完整字体验收：`test-results/loading/font-defaults-after/verification.json`。均为本地验收产物，不进入 Git。
- 优化构建已更新原来的 `127.0.0.1:4321`，API 仍为 `4310`，保持 `SITE_INDEXABLE=false` 与会话预览方式。
