import { reviewRatingKeys } from "@plotstay/contracts";
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const copy = <T>(v: T): T => structuredClone(v);
const snapshot = (v: any) => JSON.stringify(v);
export async function initWorkspaceReviews(root: HTMLElement) {
  const shell = document.getElementById("new-workspace")!,
    view = document.getElementById("account-view")!,
    content = document.getElementById("account-content")!;
  const login = document.getElementById("account-login") as HTMLFormElement,
    message = document.getElementById("persona-message")!;
  const head = document.getElementById("ws-page-title")!,
    context = document.getElementById("ws-context")!,
    back = document.getElementById("ws-back") as HTMLAnchorElement;
  shell.dataset.reviewController = "true";
  document.querySelector(".ws-main")!.classList.add("ws-reviews");
  const actions = document.createElement("div");
  actions.id = "rv-actions";
  actions.className = "rv-actions rv-page-actions";
  document.querySelector(".ws-page-head")!.append(actions);
  let zh = root.dataset.locale === "zh-CN",
    writeLang = zh ? "zh-CN" : "en",
    actor: any,
    personas: any[] = [],
    list: any,
    detail: any;
  let url = new URL(location.href),
    href = location.href,
    seq = 0,
    nav = 0,
    busy = false,
    editing = false,
    writing: any = null,
    baseline = "",
    lastCommand: any = null,
    conflict: any = null;
  let signingIn = false,
    lastSavedRevisionId: string | null = null;
  let selectedEntry: any = null,
    newPersona = "",
    entries: any = null,
    optional = false,
    entryQuery = "",
    entryPage = 1,
    historyIndex = Number(history.state?.reviewIndex ?? 0),
    restoring = false;
  history.replaceState(
    { ...history.state, reviewIndex: historyIndex },
    "",
    href,
  );
  const l = (a: string, b: string) => (zh ? a : b),
    locale = () => (zh ? "zh-CN" : "en"),
    prefix = () => (zh ? "zh" : "en");
  const side = () =>
    url.searchParams.get("view") === "replies" ? "replies" : "reviews";
  const dirty = () => editing && writing && snapshot(writing) !== baseline;
  const guard = () =>
    !busy &&
    (!dirty() ||
      confirm(
        l(
          "有未保存输入。离开并放弃这些修改？",
          "You have unsaved changes. Leave and discard them?",
        ),
      ));
  const prefKey = () => `plotstay:reviews:${actor?.id}:persona`;
  const pref = () => {
    try {
      return localStorage.getItem(prefKey()) ?? "";
    } catch {
      return "";
    }
  };
  const remember = (v: string) => {
    try {
      localStorage.setItem(prefKey(), v);
    } catch {}
  };
  const date = (v: string) =>
    v
      ? new Date(v).toLocaleString(locale(), {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const name = (profiles: any) =>
    profiles?.[locale()]?.name ??
    profiles?.en?.name ??
    profiles?.["zh-CN"]?.name ??
    l("未命名角色", "Unnamed persona");
  const kind = (k: string) =>
    ({
      stay: l("住宿", "Stay"),
      experience: l("活动", "Experience"),
      service: l("服务", "Service"),
    })[k] ?? k;
  const button = (a: string, label: string, attrs = "", cls = "") =>
    `<button type="button" data-action="${a}" class="${cls}" ${attrs}>${label}</button>`;
  const badge = (label: string, cls = "") =>
    `<span class="rv-badge ${cls}">${label}</span>`;
  const select = (id: string, label: string, options: any[], value: any) =>
    `<label>${label}<select id="${id}">${options.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(value ?? "") ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
  const errorText = (e: any) =>
    (
      ({
        SESSION_REQUIRED: l(
          "会话已过期。请重新登录，输入保留在本页。",
          "Session expired. Sign in again; input remains on this page.",
        ),
        ACCOUNT_CHANGED: l(
          "登录账号已变化，已清除上一账号的页面和输入。",
          "Account changed. The previous account’s page and input have been cleared.",
        ),
        REVISION_CONFLICT: l(
          "另一窗口已保存新版本。输入保留，请比较后继续。",
          "Another window saved a newer version. Your input is preserved; compare before continuing.",
        ),
        SUBMISSION_CONFLICT: l(
          "有效待审版本已变化，请核对后再提交。",
          "The effective submission changed. Compare before submitting.",
        ),
        PROFILE_SIGNATURE_STALE: l(
          "角色资料已变化，请核对最新署名后继续。",
          "The profile changed. Check the current signature before continuing.",
        ),
        PROVIDER_CHANGED: l(
          "提供者绑定已变化，不能沿用旧身份。输入仍保留。",
          "The provider assignment changed. You cannot use the old identity. Your input is preserved.",
        ),
        PROVIDER_FORBIDDEN: l(
          "你没有当前回复资格。",
          "You cannot currently reply to this review.",
        ),
        PERSONA_DISABLED: l(
          "角色已停用，当前只能阅读授权历史。",
          "This persona is disabled. Permitted history is read only.",
        ),
        TARGET_UNAVAILABLE: l(
          "世界或条目限制了此内容，暂不可读写。",
          "World or entry restrictions make this content unavailable.",
        ),
        INVALID_CREDENTIALS: l(
          "邮箱或密码不正确。",
          "Email or password is incorrect.",
        ),
        INVALID_INPUT: l(
          "请检查所标明语言和字段的内容。输入仍保留。",
          "Check the indicated language and field. Your input is preserved.",
        ),
        PERSONA_REJECTED: l(
          "角色资料已退回，请先修改角色资料，再核对新署名。",
          "The profile was returned. Revise the persona, then check the new signature.",
        ),
        REVIEW_FORBIDDEN: l(
          "当前账号无权访问此评价。",
          "This account cannot access this review.",
        ),
      }) as Record<string, string>
    )[e.code] ??
    l(
      "操作未完成。输入保留，请重试。",
      "The request did not complete. Input is preserved; try again.",
    );
  function purge() {
    seq++;
    nav++;
    detail = null;
    list = null;
    personas = [];
    writing = null;
    baseline = "";
    lastCommand = null;
    conflict = null;
    editing = false;
    selectedEntry = null;
    view.replaceChildren();
    actions.replaceChildren();
    content.hidden = true;
  }
  async function api(path: string, body?: unknown) {
    const requestSeq = seq;
    const init =
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          };
    const response = await (window.__plotstayWorkspace?.request(
      path,
      "reviews",
      init,
    ) ??
      fetch("/api" + path, {
        ...init,
        credentials: "same-origin",
        cache: "no-store",
      }));
    const data = await response.json();
    // An earlier page/account request cannot invalidate the current editor.
    if (requestSeq !== seq) throw { code: "STALE_RESPONSE" };
    if (!response.ok) {
      if (data.error?.code === "SESSION_REQUIRED" && requestSeq === seq) {
        seq++;
        nav++;
        content.hidden = true;
        login.hidden = false;
        message.textContent = errorText(data.error);
      }
      throw Object.assign(new Error(data.error?.message), data.error);
    }
    if (data.actorId && actor && data.actorId !== actor.id) {
      purge();
      throw { code: "ACCOUNT_CHANGED" };
    }
    return data;
  }
  async function identity() {
    const requestSeq = seq;
    const data = await api("/auth/me");
    if (requestSeq !== seq) throw { code: "STALE_RESPONSE" };
    if (!data.actor) throw { code: "SESSION_REQUIRED" };
    if (actor && actor.id !== data.actor.id) {
      purge();
      actor = data.actor;
      throw { code: "ACCOUNT_CHANGED" };
    }
    actor = data.actor;
    return actor;
  }
  const query = (u: URL) => {
    const q = new URLSearchParams({
      view: u.searchParams.get("view") === "replies" ? "replies" : "reviews",
      locale: u.pathname.startsWith("/zh/") ? "zh-CN" : "en",
    });
    for (const k of ["persona", "world", "kind", "status", "q", "sort", "page"])
      if (u.searchParams.get(k)) q.set(k, u.searchParams.get(k)!);
    return q;
  };
  function listURL() {
    const raw = url.searchParams.get("returnTo");
    if (raw) {
      const u = new URL(raw, location.origin);
      if (
        u.origin === location.origin &&
        /^\/(zh|en)\/workspace$/.test(u.pathname) &&
        ["reviews", "replies", "overview"].includes(
          u.searchParams.get("view") ?? "overview",
        )
      )
        return u;
    }
    const u = new URL(
      location.origin + `/${prefix()}/workspace?view=${side()}`,
    );
    if (pref()) u.searchParams.set("persona", pref());
    return u;
  }
  function setHistory(u: URL, push = true) {
    if (push) {
      historyIndex++;
      history.pushState({ reviewIndex: historyIndex }, "", u);
    } else
      history.replaceState(
        { ...history.state, reviewIndex: historyIndex },
        "",
        u,
      );
    href = location.href;
    url = new URL(href);
  }
  function saveActions() {
    return (
      button(
        "save",
        busy ? l("正在保存…", "Saving…") : l("暂存草稿", "Save draft"),
        busy ? "disabled" : "",
      ) +
      button(
        "submit",
        busy ? l("处理中…", "Working…") : l("保存并提交", "Save and submit"),
        busy ? "disabled" : "",
        "primary",
      )
    );
  }
  function header() {
    const isNew = url.searchParams.has("new"),
      title = isNew
        ? l("写评价", "Write a review")
        : detail
          ? side() === "reviews"
            ? l("评价详情", "Review details")
            : l("回复详情", "Reply details")
          : side() === "reviews"
            ? l("我的评价", "My reviews")
            : l("收到的评价", "Received reviews");
    head.textContent = title;
    document.title = title + " · Plotstay";
    context.textContent = detail
      ? ""
      : isNew
        ? l(
            "选择条目，再确认署名角色。",
            "Choose an entry, then confirm your persona.",
          )
        : side() === "reviews"
          ? l(
              "这里展示你所扮演的角色撰写的评价，以及提供者的公开回复。",
              "Reviews written by your personas, together with the providers’ public replies.",
            )
          : l(
              "这里展示其他旅人对你的提供者角色的评价，以及你的回复。",
              "Reviews received by your provider personas, together with your replies.",
            );
    document.getElementById("ws-head-action")!.hidden = true;
    back.href = (
      detail || isNew
        ? listURL()
        : new URL(location.origin + `/${prefix()}/workspace`)
    ).href;
    back.textContent =
      detail || isNew
        ? l("← 返回列表", "← Back to list")
        : l("← 返回工作台", "← Back to workspace");
    document.getElementById("ws-crumb-tail")!.textContent = title;
    actions.innerHTML = detail
      ? editing
        ? saveActions()
        : detail.canEdit && !historical()
          ? button(
              "edit",
              side() === "reviews"
                ? l("编辑评价", "Edit review")
                : l("编辑回复", "Edit reply"),
              "",
              "primary",
            )
          : ""
      : !isNew && side() === "reviews"
        ? button("new", l("＋ 写评价", "＋ Write a review"), "", "primary")
        : "";
    shell.dataset.view = side();
    const navLabels: Record<string, string> = {
      overview: l("概览", "Overview"),
      personas: l("我的角色", "My personas"),
      reviews: l("我的评价", "My reviews"),
      replies: l("收到的评价", "Received reviews"),
      works: l("我管理的内容", "Content I manage"),
      worlds: l("我管理的世界", "Worlds I manage"),
      settings: l("账号设置", "Account settings"),
    };
    for (const a of shell.querySelectorAll<HTMLAnchorElement>(".ws-nav a")) {
      const u = new URL(a.href),
        key = u.searchParams.get("view") ?? "overview";
      if (navLabels[key]) {
        for (const n of [...a.childNodes])
          if (n.nodeType === Node.TEXT_NODE) n.textContent = navLabels[key];
        u.pathname = `/${prefix()}/workspace`;
        a.href = u.href;
      }
      if (key === side()) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }

    for (const a of document.querySelectorAll<HTMLAnchorElement>(
      ".ws-utility a",
    )) {
      const u = new URL(url);
      u.pathname = u.pathname.replace(
        /^\/(zh|en)\//,
        a.lang === "en" ? "/en/" : "/zh/",
      );
      a.href = u.href;
    }
  }
  function tags(r: any) {
    return `<div class="rv-tags">${(side() === "reviews" ? r.public_revision : r.reply_public_revision) ? badge(l("已公开", "Published"), "public") : badge(l("未公开", "Not public"))}${r.submitted_revision_id ? badge(l("有待审版本", "Awaiting review"), "pending") : ""}${r.draft_revision_id ? badge(l("有未提交草稿", "Unsubmitted draft")) : ""}${r.rejected ? badge(l("需要修改", "Changes requested"), "warning") : ""}${!r.can_edit ? badge(l("只读历史", "Read-only history")) : ""}</div>`;
  }
  function focus() {
    const id = url.searchParams.get("persona") ?? "",
      p = personas.find((p) => p.id === id);
    return `<div class="rv-focus"><span class="rv-focus-label">${l("当前角色", "Persona focus")}</span><details class="rv-role-picker"><summary><strong>${p ? esc(name(p.draft ?? p.published)) : l("全部角色", "All personas")}</strong>⌄</summary><div class="rv-role-options"><label>${l("搜索角色", "Search personas")}<input type="search" id="role-search"></label><div id="role-options">${roleOptions("")}</div></div></details><div class="rv-quick-roles">${personas
      .slice(0, 2)
      .map((p) =>
        button(
          "role",
          esc(name(p.draft ?? p.published)),
          `data-persona="${p.id}" aria-pressed="${id === p.id}"`,
        ),
      )
      .join(
        "",
      )}</div>${button("all", l("全部角色", "All personas"), "", "rv-link")}<p>${l("两个评价页面共用查看范围，不改变发言身份。", "Shared across both review pages; your speaking identity stays unchanged.")}</p></div>`;
  }
  function roleOptions(q: string) {
    return (
      personas
        .filter((p) =>
          JSON.stringify(p.draft ?? p.published)
            .toLowerCase()
            .includes(q.toLowerCase()),
        )
        .map((p) =>
          button(
            "role",
            esc(name(p.draft ?? p.published)) +
              (p.disabled
                ? `<small>${l("已停用 · 可查看授权历史", "Disabled · Permitted history")}</small>`
                : ""),
            `data-persona="${p.id}"`,
          ),
        )
        .join("") || l("没有匹配的角色", "No matching personas")
    );
  }
  const eventLabel = (a: string) =>
    ({
      draft_saved: l("评价草稿已保存", "Review draft saved"),
      draft: l("回复草稿已保存", "Reply draft saved"),
      submitted: l("评价已送审", "Review submitted"),
      submit: l("回复已送审", "Reply submitted"),
      published: l("评价已公开", "Review published"),
      publish: l("回复已公开", "Reply published"),
      reply_published: l("收到公开回复", "Public reply published"),
      rejected: l("评价已退回", "Review returned"),
      reject: l("回复已退回", "Reply returned"),
      restored: l("评价已恢复", "Review restored"),
      restore: l("回复已恢复", "Reply restored"),
    })[a] ?? l("最近动态", "Recent activity");
  function card(r: any) {
    return `<article class="rv-card rv-interaction-card" id="card-${r.id}"><div class="rv-card-main"><div class="rv-card-intro"><div class="rv-context">${esc(r.world_name ?? l("上下文受限", "Context unavailable"))} / ${r.entry_kind ? kind(r.entry_kind) : l("本人授权历史", "Your permitted history")} / ${esc(r.entry_name ?? "")}${r.context_available && r.entry_locale !== locale() ? ` · ${l("语言回退", "Language fallback")}` : ""}</div><div class="rv-card-identity"><span>${side() === "reviews" ? l("我以此角色发表", "My reviewer identity") : l("评价者", "Reviewer")}：<strong>${esc(name(r.reviewer_profiles))}</strong></span>${side() === "replies" ? `<span class="rv-provider-label">${r.can_edit ? l("我的提供者身份", "My provider identity") : l("我的历史回复身份", "My historical reply identity")}：<strong>${esc(name(r.can_edit ? r.provider_profiles : r.reply_profiles))}</strong></span>` : ""}</div></div>${side() === "reviews" ? `<span class="rv-version-label">${r.draft_revision_id ? l("本人草稿", "Your draft") : r.submitted_revision_id ? l("本人待审版", "Your submission") : l("已保存评价", "Saved review")}</span>` : ""}<h2>${esc(r.title ?? l("历史回复", "Historical reply"))}</h2><p class="rv-excerpt">${esc(r.review_excerpt)}</p></div><aside class="rv-card-state">${tags(r)}<p class="rv-activity"><span>${eventLabel(r.activity_action)}</span><time>${date(r.activity_at)}</time></p><div class="rv-actions">${button("open", r.can_edit ? l("查看评价与回复", "View review and reply") : l("查看历史", "View history"), `data-id="${r.id}"`)}</div></aside>${r.reply_excerpt ? `<div class="rv-reply-summary"><div class="rv-reply-heading"><strong>${side() === "reviews" ? l("提供者公开回复", "Provider’s public reply") : l("我的回复", "My reply")} · ${esc(name(r.reply_profiles))}</strong></div><p class="rv-excerpt">${esc(r.reply_excerpt)}</p></div>` : `<div class="rv-no-reply">${l("暂无公开回复", "No public reply yet")}</div>`}</article>`;
  }
  function renderList() {
    header();
    const q = url.searchParams;
    view.innerHTML = `<section class="rv-filters">${focus()}<div class="rv-filter-controls"><div class="rv-search-sort"><label>${l("搜索评价", "Search reviews")}<input type="search" id="rv-search" value="${esc(q.get("q"))}" placeholder="${l("条目、评价标题或正文", "Entry, review title or text")}"></label>${select(
      "rv-sort",
      l("排序", "Sort by"),
      [
        ["recent", l("最近动态", "Recent activity")],
        ["action", l("需要处理优先", "Needs attention first")],
      ],
      q.get("sort") ?? "recent",
    )}</div><details class="rv-other-filters" ${innerWidth > 760 || ["world", "kind", "status"].some((k) => q.get(k)) ? "open" : ""}><summary>${l("世界、类型与状态", "World, type and status")}</summary><div class="rv-filter-grid">${select("rv-world", l("世界", "World"), [["", l("全部世界", "All worlds")], ...list.worlds.map((w: any) => [w.id, w.name])], q.get("world"))}${select("rv-kind", l("条目类型", "Entry type"), [["", l("全部类型", "All types")], ...["stay", "experience", "service"].map((k) => [k, kind(k)])], q.get("kind"))}${select(
      "rv-status",
      l("状态", "Status"),
      [
        ["", l("全部状态", "All statuses")],
        ["draft", l("有草稿", "Has a draft")],
        ["submitted", l("有待审版本", "Awaiting review")],
        ["published", l("已公开", "Published")],
        ["rejected", l("需要修改", "Changes requested")],
        ["readonly", l("只读历史", "Read-only history")],
        ["unanswered", l("可回复", "Can reply")],
      ],
      q.get("status"),
    )}</div></details></div></section><div class="rv-list">${list.items.map(card).join("") || `<section class="rv-empty"><h2>${l("当前范围没有匹配结果", "No matches in this scope")}</h2><p>${l("试试其他关键词，或清除筛选。", "Try a different keyword or clear filters.")}</p>${button("clear", l("清除筛选", "Clear filters"))}</section>`}</div><div class="rv-result-head"><span role="status">${l(`共 ${list.total} 篇评价`, `${list.total} reviews`)}</span>${button("clear", l("清除筛选", "Clear filters"), "", "rv-link")}</div><nav class="rv-pagination">${button("prev", l("上一页", "Previous"), list.page <= 1 ? "disabled" : "")}<span>${list.page} / ${list.pages}</span>${button("next", l("下一页", "Next"), list.page >= list.pages ? "disabled" : "")}</nav>`;
  }
  function historical() {
    return (
      Boolean(
        url.searchParams.get("revision") &&
        url.searchParams.get("revision") !== detail?.baseRevisionId,
      ) || Boolean(url.searchParams.get("replyEvent"))
    );
  }
  function editableRevision(d = detail) {
    return side() === "reviews"
      ? d.review?.revisions.find((r: any) => r.id === d.baseRevisionId)
      : d.reply?.revisions.find((r: any) => r.id === d.reply.editRevisionId);
  }
  function bodyFrom(d = detail): any {
    const r = editableRevision(d),
      reply = side() === "replies";
    if (reply)
      return {
        sourceLocale: r?.source_locale ?? locale(),
        texts: { "zh-CN": r?.body?.["zh-CN"] ?? "", en: r?.body?.en ?? "" },
      };
    const text = (lang: string) => {
      const t = r?.texts?.[lang];
      return {
        title: t?.title ?? "",
        description: t?.description ?? "",
        origin: t?.review?.origin ?? "",
        stayDuration: t?.review?.stayDuration ?? "",
        tags: t?.tags ?? [],
      };
    };
    return {
      sourceLocale: r?.source_locale ?? locale(),
      texts: { "zh-CN": text("zh-CN"), en: text("en") },
      rating: r?.attributes?.rating ?? null,
      reviewRatings: copy(r?.attributes?.reviewRatings ?? {}),
    };
  }
  function beginEdit() {
    if (!detail?.canEdit || historical()) return;
    editing = true;
    writing = bodyFrom();
    baseline = snapshot(writing);
    optional = false;
    writeLang = locale();
  }
  function readBlock(title: string, r: any, reply = false) {
    if (!r) return "";
    const text = reply
        ? (r.body?.[locale()] ?? r.body?.[r.source_locale] ?? "")
        : (r.texts?.[locale()] ??
          r.texts?.[r.source_locale] ??
          r.text ??
          r.source_text ??
          {}),
      profiles = r.profiles ?? (r.signature && { [locale()]: r.signature });
    return `<section class="rv-reading-block"><div class="rv-section-head"><h2>${title}</h2><span class="rv-small">${r.created_at ? date(r.created_at) : ""}</span></div><div class="rv-read-content"><div class="rv-read-copy"><p class="rv-read-byline">${reply ? l("回复署名", "Reply signature") : l("评价者", "Reviewer")} · <strong>${esc(name(profiles))}</strong></p>${reply ? "" : `<h3>${esc(text.title)}</h3>${r.attributes?.rating != null ? `<p class="rv-rating">${l("评分", "Rating")} ${r.attributes.rating} / 5</p>` : ""}`}<div class="rv-prose"><p>${esc(reply ? text : text.description)}</p></div>${!reply && (text.review?.origin || text.review?.stayDuration || text.tags?.length) ? `<details class="rv-supplement"><summary>${l("补充信息", "Additional details")}</summary><p>${esc([text.review?.origin, text.review?.stayDuration, ...(text.tags ?? [])].filter(Boolean).join(" · "))}</p></details>` : ""}</div></div></section>`;
  }
  function renderDetail() {
    header();
    const requested = url.searchParams.get("revision"),
      history = historical(),
      reply = side() === "replies";
    const own = detail.review?.revisions ?? [],
      replies = detail.reply?.revisions ?? [];
    const review = reply
      ? detail.publicReview
      : requested
        ? own.find((r: any) => r.id === requested)
        : (detail.publicReview ??
          own.find((r: any) => r.id === detail.baseRevisionId));
    const response =
      detail.linkedReply ??
      (reply
        ? requested
          ? replies.find((r: any) => r.id === requested)
          : (editableRevision() ?? replies[0] ?? detail.publicReply)
        : detail.publicReply);
    const exchange =
      readBlock(
        reply
          ? l("原评价 · 公开版", "Original review · Public version")
          : history
            ? l("指定历史评价", "Linked review revision")
            : l("我的评价", "My review"),
        review,
      ) +
      readBlock(
        reply
          ? l("我的回复", "My reply")
          : l("提供者公开回复", "Provider’s public reply"),
        response,
        true,
      );
    const long =
      String(
        review?.texts?.[locale()]?.description ??
          review?.text?.description ??
          "",
      ).length > 700;
    view.innerHTML = `<div class="rv-detail-context"><div><span>${l("世界", "World")}</span><strong>${esc(detail.world?.name ?? l("上下文受限", "Context unavailable"))}</strong></div><div><span>${detail.entry ? kind(detail.entry.kind) : l("条目不可用", "Entry unavailable")}</span><strong>${esc(detail.entry?.text.title ?? l("仅显示本人授权历史", "Only your permitted history is shown"))}</strong></div><div><span>${reply ? l("当前提供者身份", "Current provider identity") : l("本次署名角色", "Persona for this revision")}</span><strong>${esc(name(detail.identity?.profiles ?? detail.provider?.profiles))}</strong></div><div><span>${l("版本状态", "Version status")}</span><div class="rv-tags">${(reply ? detail.publicReply : detail.publicReview) ? badge(l("已公开", "Published"), "public") : ""}${detail.submittedRevisionId ? badge(l("有待审版本", "Awaiting review"), "pending") : ""}${(reply ? ["draft", "reject"].includes(editableRevision()?.status) : ["draft", "rejected"].includes(own.find((r: any) => r.id === detail.baseRevisionId)?.status)) ? badge(l("有未提交草稿", "Unsubmitted draft")) : ""}</div></div></div>${!detail.canEdit || history ? `<section class="rv-note"><strong>${l("只读历史", "Read-only history")}</strong><p>${!detail.contextAvailable ? l("关联条目或评价已下架。仅显示本人授权历史，不显示受限上下文。", "The entry or review is unpublished. Only your permitted history is shown; restricted context is omitted.") : history ? l("这是指定历史版本，只供阅读。", "This is the linked historical version, available for reading only.") : detail.identity?.disabled ? l("角色已停用，不能继续发言。本人授权历史仍可读。", "This persona is disabled. Your permitted history remains readable.") : l("条目已不再绑定你的提供者角色。可以读取本人历史，不能以旧身份回复。", "The entry is no longer assigned to your provider persona. You may read your history but cannot reply under the former identity.")}</p>${history ? button("current", l("打开当前版本", "Open current version")) : ""}</section>` : ""}${history && !review && !response ? `<p>${l("指定版本不在你的授权读取范围内。", "The linked version is outside your permitted history.")}</p>` : ""}${editing && long ? `<details class="rv-reading-block"><summary>${l("展开完整原评价与回复", "Read the complete review and reply")}</summary>${exchange}</details>` : exchange}${editing ? editor() : ""}<details class="rv-versions" ${detail.historyPage > 1 ? "open" : ""}><summary>${l("版本与审核记录", "Versions and moderation history")}</summary>${[...own, ...replies].map((r: any) => `<div class="rv-version-row"><div>${date(r.created_at)}<small>${r.id === detail.submittedRevisionId ? l("当前有效待审版", "Effective submission") : r.id === detail.baseRevisionId ? l("最新保存版", "Latest saved revision") : l("历史版本", "Historical revision")}</small></div>${button("version", l("阅读此版本", "Read version"), `data-revision="${r.id}"`)}</div>`).join("")}${(
      detail.review?.events ??
      detail.reply?.events ??
      []
    )
      .filter((e: any) => e.note)
      .map((e: any) => `<p>${date(e.created_at)} · ${esc(e.note)}</p>`)
      .join(
        "",
      )}<nav class="rv-pagination">${button("history-prev", l("较新历史", "Newer history"), detail.historyPage <= 1 ? "disabled" : "")}<span>${detail.historyPage} / ${detail.historyPages}</span>${button("history-next", l("更早历史", "Older history"), detail.historyPage >= detail.historyPages ? "disabled" : "")}</nav></details>`;
  }
  function field(key: string, label: string, value: any, area = false) {
    return `<label><span class="rv-field-label">${label}</span>${area ? `<textarea id="field-${key}" data-field="${key}">${esc(value)}</textarea>` : `<input id="field-${key}" data-field="${key}" value="${esc(value)}">`}</label>`;
  }
  function editor() {
    const reply = side() === "replies",
      w = writing,
      t = w.texts[writeLang],
      ratingOptions = [
        ["", l("不评分", "No rating")],
        ...[1, 2, 3, 4, 5].map((n) => [n, `${n} / 5`]),
      ];
    return `<section class="rv-editor ${reply ? "rv-reply-editor" : "rv-review-editor"}" id="editor"><div class="rv-section-head"><h2>${reply ? l("编辑回复", "Edit reply") : l("编辑本次修改", "Edit this revision")}</h2><span id="dirty-state" class="rv-small">${dirty() ? l("有未保存输入", "Unsaved changes") : l("输入与已载入版本一致", "Input matches the loaded version")}</span><p class="rv-signature">${l("本次署名", "Signature for this revision")} · <strong>${esc(name(detail.identity?.profiles))}</strong></p></div><div id="field-errors" role="alert"></div><fieldset><legend class="rv-sr">${l("写作区", "Writing area")}</legend><div class="rv-editor-main"><div class="rv-languages" role="tablist">${["zh-CN", "en"].map((lang) => button("write-lang", lang === "en" ? "English" : "中文", `data-lang="${lang}" role="tab" tabindex="${lang === writeLang ? 0 : -1}" aria-selected="${lang === writeLang}"`)).join("")}</div>${reply ? "" : field("title", l("标题", "Title"), t.title)}${field("description", l("正文", "Text"), reply ? t : t.description, true)}<p class="rv-small">${l("暂存不送审；保存并提交将此版本送审。", "Saving a draft does not submit it. Save and submit sends this fixed version for review.")}</p></div><aside class="rv-editor-aside">${reply ? `<h3>${l("回复与身份", "Reply and identity")}</h3><p class="rv-small">${l("提供者身份由条目绑定，不能在此切换。", "Your provider identity is fixed by the entry assignment.")}</p>` : select("rv-rating", l("总体评分（可选）", "Overall rating (optional)"), ratingOptions, w.rating ?? "")}<details class="rv-optional" ${optional ? "open" : ""}><summary>${l("可选补充信息", "Optional details")}</summary><div class="rv-optional-grid">${select(
      "rv-source",
      l("源语言", "Source language"),
      [
        ["zh-CN", "中文"],
        ["en", "English"],
      ],
      w.sourceLocale,
    )}${reply ? "" : field("origin", l("来自（自由文本）", "From (free text)"), t.origin) + field("stayDuration", l("旅程说明", "Journey notes"), t.stayDuration) + field("tags", l("关键词（逗号分隔）", "Keywords (comma-separated)"), t.tags.join(", ")) + `<div class="rv-dimensions">${reviewRatingKeys.map((k) => select("dimension-" + k, { cleanliness: l("清洁度", "Cleanliness"), accuracy: l("描述准确度", "Accuracy"), checkIn: l("入住体验", "Check-in"), communication: l("沟通", "Communication"), location: l("位置", "Location"), value: l("性价比", "Value") }[k], ratingOptions, w.reviewRatings[k] ?? "")).join("")}</div>`}</div></details></aside></fieldset><div id="rv-conflict"></div><div class="rv-editor-footer"><div class="rv-actions">${button("preview", l("预览已保存版本", "Preview saved version"), lastSavedRevisionId ? "" : "disabled", "rv-link")}${button("read", l("返回阅读", "Back to reading"), "", "rv-link")}${button("recover", l("重试上次保存请求", "Retry last save request"), lastCommand ? "" : "hidden", "rv-link")}</div><div class="rv-actions">${saveActions()}</div></div></section>`;
  }
  function renderNew() {
    header();
    view.innerHTML = selectedEntry
      ? `<section class="rv-card"><p class="rv-small">${l("第 2 步 · 确认署名角色", "Step 2 · Confirm your persona")}</p><h2>${esc(selectedEntry.title)}</h2><p>${esc(selectedEntry.world_name)} · ${kind(selectedEntry.kind)}</p>${
          personas.some((p) => !p.disabled)
            ? select(
                "new-persona",
                l("以此角色写评价", "Write this review as"),
                personas
                  .filter((p) => !p.disabled)
                  .map((p) => [p.id, name(p.draft ?? p.published)]),
                newPersona,
              ) +
              `<p id="existing-hint">${l("同角色同条目只保留一篇评价；已存在时会继续原记录。", "One review per persona and entry; an existing review will be continued.")}</p>` +
              button(
                "start",
                l("开始／继续评价", "Start / continue review"),
                busy ? "disabled" : "",
                "primary",
              )
            : `<a href="/${prefix()}/workspace?view=personas">${l("先创建一个角色", "Create a persona first")}</a>`
        }${button("choose-entry", l("重新选择条目", "Choose another entry"))}</section>`
      : `<section class="rv-card"><p class="rv-small">${l("第 1 步 · 选择条目", "Step 1 · Choose an entry")}</p><p>${l("无需预订。选择当前公开的住宿、活动或服务，再确认角色。", "No booking required. Choose a published stay, experience or service, then confirm your persona.")}</p><form id="entry-search-form"><label>${l("搜索条目", "Search entries")}<input id="entry-search" type="search" value="${esc(entryQuery)}"></label><button>${l("搜索", "Search")}</button></form><div class="rv-entry-list">${entries?.items.map((e: any) => `<article><div><span class="rv-small">${esc(e.world_name)} · ${kind(e.kind)}</span><h3>${esc(e.title)}</h3></div>${button("choose", l("选择", "Select"), `data-entry="${e.id}"`)}</article>`).join("") || `<p>${l("没有匹配的可评价条目。", "No matching entries are available.")}</p>`}</div><nav class="rv-pagination">${button("entry-prev", l("上一页", "Previous"), entryPage <= 1 ? "disabled" : "")}<span>${entryPage} / ${entries?.pages ?? 1}</span>${button("entry-next", l("下一页", "Next"), entryPage >= (entries?.pages ?? 1) ? "disabled" : "")}</nav></section>`;
  }
  async function navigate(u: URL, push = true, allow = false) {
    if (!allow && !guard()) return;
    const inputAtStart = snapshot(writing),
      request = ++nav,
      pageSeq = seq;
    const targetSide =
        u.searchParams.get("view") === "replies" ? "replies" : "reviews",
      id =
        u.searchParams.get(targetSide === "reviews" ? "review" : "reply") ??
        u.searchParams.get("id");
    if (
      !id &&
      !u.searchParams.has("new") &&
      !u.searchParams.has("persona") &&
      pref()
    )
      u.searchParams.set("persona", pref());
    message.textContent = l("正在载入…", "Loading…");
    try {
      let next: any;
      const lang = u.pathname.startsWith("/zh/") ? "zh-CN" : "en";
      if (id) {
        next = await api(
          `/me/review-workspace/${id}?${new URLSearchParams({ view: targetSide, locale: lang, ...(u.searchParams.has("revision") ? { revision: u.searchParams.get("revision")! } : {}), ...(u.searchParams.has("historyPage") ? { historyPage: u.searchParams.get("historyPage")! } : {}) })}`,
        );
        if (u.searchParams.get("replyEvent")) {
          const linked = await api(
            "/me/workspace/reply-events/" +
              encodeURIComponent(u.searchParams.get("replyEvent")!),
          );
          if (linked.review_id !== id) throw { code: "REVIEW_FORBIDDEN" };
          next.linkedReply = linked;
        }
      } else if (u.searchParams.has("new"))
        next = await api(
          "/me/review-workspace/entries?" +
            new URLSearchParams({
              locale: lang,
              q: entryQuery,
              page: String(entryPage),
            }),
        );
      else next = await api("/me/review-workspace?" + query(u));
      if (request !== nav || pageSeq !== seq) return;
      // Navigation may have been waiting while the user continued typing.
      if (!allow && snapshot(writing) !== inputAtStart && !guard()) {
        message.textContent = "";
        return;
      }
      seq++;
      editing = false;
      writing = null;
      baseline = "";
      conflict = null;
      lastCommand = null;
      selectedEntry = null;
      setHistory(u, push);
      zh = lang === "zh-CN";
      detail = id ? next : null;
      lastSavedRevisionId = detail ? (editableRevision()?.id ?? null) : null;
      list = !id && !u.searchParams.has("new") ? next : null;
      entries = u.searchParams.has("new") ? next : null;
      if (detail && u.searchParams.get("mode") === "edit") beginEdit();
      if (detail) renderDetail();
      else if (entries) renderNew();
      else renderList();
      message.textContent = "";
      content.hidden = false;
      login.hidden = true;
      if (detail && editing)
        document.getElementById("editor")?.scrollIntoView({ block: "start" });
      else if (!id) {
        try {
          const pos = JSON.parse(
            sessionStorage.getItem("plotstay:reviews:return:" + actor.id) ??
              "null",
          );
          if (pos?.href === u.pathname + u.search)
            requestAnimationFrame(() => scrollTo(0, pos.y));
          else scrollTo(0, 0);
        } catch {}
      } else scrollTo(0, 0);
    } catch (e) {
      if (request !== nav || pageSeq !== seq) return;
      message.textContent = errorText(e);
      if (!detail && !list && !entries)
        view.innerHTML = `<section class="rv-empty"><h2>${l("评价暂时没能载入", "Reviews could not be loaded")}</h2>${button("retry", l("重试", "Retry"))}</section>`;
    }
  }
  function validation() {
    const reply = side() === "replies";
    for (const lang of ["zh-CN", "en"]) {
      const t = writing.texts[lang],
        present = reply
          ? Boolean(t.trim())
          : Boolean(t.title.trim() || t.description.trim());
      if (!present && lang !== writing.sourceLocale) continue;
      const invalid = reply
        ? !t.trim() || t.length > 10000
          ? "description"
          : null
        : !t.title.trim() || t.title.length > 200
          ? "title"
          : !t.description.trim() || t.description.length > 20000
            ? "description"
            : t.origin.length > 200
              ? "origin"
              : t.stayDuration.length > 200
                ? "stayDuration"
                : t.tags.length > 12 ||
                    t.tags.some((x: string) => x.length > 80)
                  ? "tags"
                  : null;
      if (invalid) {
        writeLang = lang;
        optional = ["origin", "stayDuration", "tags"].includes(invalid);
        renderDetail();
        document.getElementById("field-errors")!.textContent =
          (lang === "en" ? "English" : "中文") +
          " · " +
          l(
            "请检查必填内容及现有字段长度限制。",
            "Check required text and existing field length limits.",
          );
        const el = document.getElementById("field-" + invalid);
        el?.setAttribute("aria-invalid", "true");
        el?.focus();
        return false;
      }
    }
    return true;
  }
  function payloadBody(input = writing) {
    const body = copy(input);
    for (const lang of ["zh-CN", "en"]) {
      const t = body.texts[lang];
      if (
        lang !== body.sourceLocale &&
        (side() === "replies"
          ? !t.trim()
          : !t.title.trim() && !t.description.trim())
      )
        delete body.texts[lang];
    }
    return body;
  }
  function updateBusy() {
    for (const b of document.querySelectorAll<HTMLButtonElement>(
      "[data-action=save],[data-action=submit],[data-action=recover]",
    ))
      b.disabled = busy;
  }
  async function save(action: "draft" | "submit", recover = false) {
    if (busy || !detail || !editing) return;
    if (!recover && !validation()) return;
    if (
      !recover &&
      action === "submit" &&
      detail.submissionGuard &&
      !confirm(
        l(
          "已有有效待审版本。明确提交本次新版本后，将替代它。继续？",
          "An effective submission already exists. Submitting this new version will replace it. Continue?",
        ),
      )
    )
      return;
    busy = true;
    nav++;
    const currentSeq = seq,
      submittedWriting = copy(writing);
    updateBusy();
    try {
      // Capture the validated input before any asynchronous identity check.
      // Later typing must never change this command or its saved baseline.
      const command = recover
        ? lastCommand
        : {
            requestId: "",
            kind: side() === "reviews" ? "review" : "reply",
            reviewId: detail.id,
            baseRevisionId: detail.baseRevisionId,
            expectedSubmittedRevisionId: detail.submissionGuard,
            expectedPersonaId: detail.identity.id,
            expectedPersonaRevisionId: detail.identity.revision_id,
            action,
            body: payloadBody(submittedWriting),
          };
      if (!command) return;
      await identity();
      if (seq !== currentSeq) return;
      if (!recover) {
        const key = snapshot({ ...command, requestId: "" });
        command.requestId =
          lastCommand && snapshot({ ...lastCommand, requestId: "" }) === key
            ? lastCommand.requestId
            : crypto.randomUUID();
        lastCommand = copy(command);
      }
      const result = await api("/me/review-workspace/save", command);
      if (currentSeq !== seq) return;
      lastSavedRevisionId = result.revisionId;
      detail.baseRevisionId = result.revisionId;
      detail.submittedRevisionId = result.submittedRevisionId;
      detail.submissionGuard = result.submittedRevisionId;
      const savedInput = normalizeBody(command.body),
        savedRevision = {
          id: result.revisionId,
          source_locale: savedInput.sourceLocale,
          profiles: copy(detail.identity.profiles),
          status:
            result.outcome === "submitted"
              ? side() === "reviews"
                ? "submitted"
                : "submit"
              : "draft",
          created_at: result.savedAt,
        };
      if (side() === "reviews")
        detail.review.revisions.unshift({
          ...savedRevision,
          texts: Object.fromEntries(
            Object.entries(savedInput.texts).map(([lang, t]: [string, any]) => [
              lang,
              {
                title: t.title,
                description: t.description,
                tags: t.tags,
                review: { origin: t.origin, stayDuration: t.stayDuration },
              },
            ]),
          ),
          attributes: {
            rating: savedInput.rating,
            reviewRatings: savedInput.reviewRatings,
          },
        });
      else {
        detail.reply.revisions.unshift({
          ...savedRevision,
          body: savedInput.texts,
          created_by: actor.id,
          persona_id: detail.identity.id,
        });
        detail.reply.editRevisionId = result.revisionId;
      }
      baseline = snapshot(
        recover ? normalizeBody(command.body) : submittedWriting,
      );
      conflict = null;
      message.textContent =
        (result.outcome === "submitted"
          ? l(
              "固定版本已保存并提交。",
              "The fixed version was saved and submitted.",
            )
          : l(
              "草稿已保存，原有效待审版保持。",
              "Draft saved. The effective submission is unchanged.",
            )) +
        (dirty()
          ? l(
              "保存期间的新输入仍未保存。",
              " Changes typed during saving remain unsaved.",
            )
          : "");
      const u = new URL(url);
      u.searchParams.delete("revision");
      u.searchParams.delete("event");
      setHistory(u, false);
      document.getElementById("dirty-state")!.textContent = dirty()
        ? l("有未保存输入", "Unsaved changes")
        : l("输入已保存", "Input saved");
      document.getElementById("rv-conflict")!.replaceChildren();
    } catch (e: any) {
      if (e.code === "ACCOUNT_CHANGED") {
        message.textContent = errorText(e);
        void initialize();
        return;
      }
      if (currentSeq !== seq) return;
      message.textContent = errorText(e);
      if (
        [
          "REVISION_CONFLICT",
          "SUBMISSION_CONFLICT",
          "PROFILE_SIGNATURE_STALE",
          "PROVIDER_CHANGED",
        ].includes(e.code)
      )
        document.getElementById("rv-conflict")!.innerHTML =
          `<section class="rv-note"><p>${esc(errorText(e))}</p>${button("compare", l("比较最新版本与署名", "Compare latest revision and signature"))}</section>`;
      else
        document.querySelector<HTMLButtonElement>(
          "[data-action=recover]",
        )!.hidden = false;
    } finally {
      busy = false;
      updateBusy();
    }
  }
  function normalizeBody(b: any) {
    if (side() === "replies")
      return { ...b, texts: { "zh-CN": "", en: "", ...b.texts } };
    const empty = {
      title: "",
      description: "",
      origin: "",
      stayDuration: "",
      tags: [],
    };
    return {
      ...b,
      texts: {
        "zh-CN": { ...empty, ...b.texts["zh-CN"] },
        en: { ...empty, ...b.texts.en },
      },
    };
  }
  async function compare() {
    const currentSeq = seq;
    const next = await api(
      `/me/review-workspace/${detail.id}?${new URLSearchParams({ view: side(), locale: locale() })}`,
    );
    if (seq !== currentSeq) return;
    conflict = next;
    const b = bodyFrom(next);
    document.getElementById("rv-conflict")!.innerHTML =
      `<section class="rv-note"><h3>${l("服务器最新版本", "Latest server revision")}</h3><p>${l("当前署名", "Current signature")} · ${esc(name(next.identity?.profiles))}</p>${["zh-CN", "en"].map((lang) => `<p>${lang === "en" ? "English" : "中文"} · ${esc(side() === "replies" ? b.texts[lang] : b.texts[lang].description)}</p>`).join("")}${next.canEdit ? button("adopt", l("已核对，保留我的输入并采用新基准", "Compared: keep my input and use this baseline")) : `<p>${l("当前已无写资格，不能采用新基准继续保存。", "You no longer have writing permission.")}</p>`}</section>`;
  }
  async function act(action: string, b: HTMLElement) {
    const u = new URL(url);
    if (action === "save" || action === "submit")
      return save(action === "save" ? "draft" : "submit");
    if (action === "recover") return save("draft", true);
    if (action === "compare") return compare();
    if (action === "adopt" && conflict) {
      baseline = snapshot(bodyFrom(conflict));
      detail = conflict;
      // The reply head can be another author's private concurrency token.
      lastSavedRevisionId = editableRevision()?.id ?? null;
      conflict = null;
      lastCommand = null;
      renderDetail();
      message.textContent = l(
        "已核对。保留本地输入；与服务器不同的内容仍未保存。",
        "Compared. Local input is preserved; differences from the server are still unsaved.",
      );
      return;
    }
    if (action === "write-lang") {
      writeLang = b.dataset.lang!;
      renderDetail();
      return;
    }
    if (action === "edit") {
      beginEdit();
      u.searchParams.set("mode", "edit");
      setHistory(u, false);
      renderDetail();
      document.getElementById("editor")?.scrollIntoView({ block: "start" });
      return;
    }
    if (action === "preview") {
      if (dirty()) {
        message.textContent = l(
          "请先保存输入，或返回阅读并明确放弃未保存输入。",
          "Save your input first, or return to reading and explicitly discard it.",
        );
        return;
      }
      u.searchParams.set("revision", lastSavedRevisionId!);
      u.searchParams.delete("mode");
      return navigate(u);
    }
    if (action === "read") {
      u.searchParams.delete("mode");
      return navigate(u);
    }
    if (action === "current") {
      u.searchParams.delete("revision");
      u.searchParams.delete("replyEvent");
      u.searchParams.delete("event");
      return navigate(u);
    }
    if (action === "history-prev" || action === "history-next") {
      u.searchParams.set(
        "historyPage",
        String(detail.historyPage + (action === "history-next" ? 1 : -1)),
      );
      return navigate(u);
    }
    if (action === "version") {
      u.searchParams.set("revision", b.dataset.revision!);
      u.searchParams.delete("mode");
      return navigate(u);
    }
    if (action === "open") {
      try {
        sessionStorage.setItem(
          "plotstay:reviews:return:" + actor.id,
          JSON.stringify({ href: url.pathname + url.search, y: scrollY }),
        );
      } catch {}
      u.searchParams.set("returnTo", url.pathname + url.search);
      u.searchParams.set(
        side() === "reviews" ? "review" : "reply",
        b.dataset.id!,
      );
      return navigate(u);
    }
    if (action === "new") {
      u.searchParams.set("new", "1");
      u.searchParams.set("returnTo", url.pathname + url.search);
      entryPage = 1;
      entryQuery = "";
      return navigate(u);
    }
    if (action === "retry") return navigate(new URL(url), false);
    if (action === "choose") {
      selectedEntry = entries.items.find((e: any) => e.id === b.dataset.entry);
      newPersona =
        personas.find((p) => p.id === pref() && !p.disabled)?.id ??
        personas.find((p) => !p.disabled)?.id ??
        "";
      renderNew();
      return;
    }
    if (action === "choose-entry") {
      selectedEntry = null;
      renderNew();
      return;
    }
    if (action === "entry-prev" || action === "entry-next") {
      entryPage += action === "entry-next" ? 1 : -1;
      return navigate(u, false);
    }
    if (action === "start") {
      if (busy) return;
      busy = true;
      b.setAttribute("disabled", "");
      try {
        await identity();
        const started = await api("/me/reviews", {
          parentId: selectedEntry.id,
          personaId: newPersona,
        });
        const target = new URL(
          location.origin +
            `/${prefix()}/workspace?view=reviews&review=${started.id}&mode=edit`,
        );
        target.searchParams.set(
          "returnTo",
          listURL().pathname + listURL().search,
        );
        await navigate(target, true, true);
      } finally {
        busy = false;
        b.removeAttribute("disabled");
      }
      return;
    }
    if (action === "role" || action === "all") {
      const id = action === "all" ? "" : b.dataset.persona!;
      remember(id);
      u.searchParams.set("persona", id);
      u.searchParams.delete("page");
      return navigate(u);
    }
    if (action === "clear") {
      for (const k of ["world", "kind", "status", "q", "sort", "page"])
        u.searchParams.delete(k);
      return navigate(u);
    }
    if (action === "prev" || action === "next") {
      u.searchParams.set(
        "page",
        String(list.page + (action === "next" ? 1 : -1)),
      );
      return navigate(u);
    }
  }
  document.addEventListener(
    "click",
    (e) => {
      const b = (e.target as Element).closest<HTMLElement>("[data-action]");
      if (b) {
        void act(b.dataset.action!, b).catch(
          (err) => (message.textContent = errorText(err)),
        );
        return;
      }
      const a = (e.target as Element).closest<HTMLAnchorElement>("a");
      if (!a || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey)
        return;
      const u = new URL(a.href);
      if (u.origin !== location.origin) return;
      if (a.closest(".ws-utility")) {
        e.preventDefault();
        zh = u.pathname.startsWith("/zh/");
        u.searchParams.delete("lang");
        setHistory(u, false);
        document.documentElement.lang = locale();
        if (editing) {
          renderDetail();
          return;
        }
        void navigate(u, false);
        return;
      }
      if (
        /^\/(zh|en)\/workspace$/.test(u.pathname) &&
        ["reviews", "replies"].includes(u.searchParams.get("view") ?? "")
      ) {
        e.preventDefault();
        void navigate(u);
        return;
      }
      if (!guard()) e.preventDefault();
    },
    true,
  );
  view.addEventListener("keydown", (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-action=write-lang]",
    );
    if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
      return;
    e.preventDefault();
    const lang =
      e.key === "Home"
        ? "zh-CN"
        : e.key === "End"
          ? "en"
          : writeLang === "en"
            ? "zh-CN"
            : "en";
    const target = view.querySelector<HTMLElement>(
      `[data-action=write-lang][data-lang="${lang}"]`,
    )!;
    void act("write-lang", target).then(() =>
      view
        .querySelector<HTMLElement>(
          `[data-action=write-lang][data-lang="${lang}"]`,
        )
        ?.focus(),
    );
  });
  view.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement,
      key = el.dataset.field;
    if (key && writing) {
      if (side() === "replies") writing.texts[writeLang] = el.value;
      else
        writing.texts[writeLang][key] =
          key === "tags"
            ? el.value
                .split(/[,，]/)
                .map((s) => s.trim())
                .filter(Boolean)
            : el.value;
      document.getElementById("dirty-state")!.textContent = dirty()
        ? l("有未保存输入", "Unsaved changes")
        : l("输入与已载入版本一致", "Input matches the loaded version");
    }
    if (el.id === "role-search")
      document.getElementById("role-options")!.innerHTML = roleOptions(
        el.value,
      );
  });
  view.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.id === "new-persona") {
      newPersona = el.value;
      return;
    }
    if (writing) {
      if (el.id === "rv-source") writing.sourceLocale = el.value;
      if (el.id === "rv-rating")
        writing.rating = el.value ? Number(el.value) : null;
      if (el.id.startsWith("dimension-")) {
        const k = el.id.slice(10);
        if (el.value) writing.reviewRatings[k] = Number(el.value);
        else delete writing.reviewRatings[k];
      }
    }
    if (
      ["rv-world", "rv-kind", "rv-status", "rv-sort", "rv-search"].includes(
        el.id,
      )
    ) {
      const u = new URL(url);
      u.searchParams.set(el.id.slice(3), el.value);
      if (el.id === "rv-search") {
        u.searchParams.delete("search");
        u.searchParams.set("q", el.value);
      }
      u.searchParams.delete("page");
      void navigate(u);
    }
  });
  view.addEventListener(
    "toggle",
    (e) => {
      if ((e.target as Element).classList.contains("rv-optional"))
        optional = (e.target as HTMLDetailsElement).open;
    },
    true,
  );
  view.addEventListener("submit", (e) => {
    if ((e.target as HTMLElement).id === "entry-search-form") {
      e.preventDefault();
      entryQuery = (document.getElementById("entry-search") as HTMLInputElement)
        .value;
      entryPage = 1;
      void navigate(new URL(url), false);
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (dirty() || busy) {
      e.preventDefault();
    }
  });
  window.addEventListener("workspace:leave", (e) => {
    if (!guard()) e.preventDefault();
  });
  window.addEventListener("popstate", () => {
    if (restoring) {
      restoring = false;
      return;
    }
    const next = new URL(location.href),
      nextIndex = Number(history.state?.reviewIndex ?? 0);
    if (!guard()) {
      restoring = true;
      history.go(historyIndex - nextIndex);
      return;
    }
    historyIndex = nextIndex;
    void navigate(next, false);
  });
  window.addEventListener("focus", () => {
    if (actor)
      void identity().catch((e) => {
        message.textContent = errorText(e);
        if (e.code === "ACCOUNT_CHANGED") void initialize();
      });
  });
  login.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (signingIn) return;
    signingIn = true;
    const submit = login.querySelector("button")!;
    submit.disabled = true;
    try {
      await api("/auth/login", Object.fromEntries(new FormData(login)));
      login.reset();
      const previous = actor?.id;
      try {
        await identity();
      } catch (e: any) {
        if (e.code !== "ACCOUNT_CHANGED") throw e;
      }
      content.hidden = false;
      login.hidden = true;
      if (previous === actor?.id && detail) {
        const next = await api(
          `/me/review-workspace/${detail.id}?${new URLSearchParams({ view: side(), locale: locale() })}`,
        );
        header();
        message.textContent = l(
          "已重新登录，输入已保留。",
          "Signed in again. Your input is preserved.",
        );
        if (
          next.baseRevisionId !== detail.baseRevisionId ||
          next.submissionGuard !== detail.submissionGuard ||
          next.identity?.revision_id !== detail.identity?.revision_id ||
          !next.canEdit
        ) {
          const box = document.getElementById("rv-conflict");
          if (box)
            box.innerHTML = `<section class="rv-note"><p>${l("当前版本或资格已变化，请先核对；输入仍保留。", "The current version or permission changed. Compare before saving; input is preserved.")}</p>${button("compare", l("比较最新版本与署名", "Compare latest revision and signature"))}</section>`;
        }
      } else await initialize();
      window.dispatchEvent(new Event("workspace:authenticated"));
    } catch (e) {
      message.textContent = errorText(e);
    } finally {
      signingIn = false;
      submit.disabled = false;
    }
  });
  async function initialize() {
    try {
      await identity();
      const p = await api("/me/personas");
      personas = p.personas ?? p;
      content.hidden = false;
      login.hidden = true;
      await navigate(new URL(location.href), false, true);
    } catch (e) {
      message.textContent = errorText(e);
      if ((e as any).code === "SESSION_REQUIRED") login.hidden = false;
    }
  }
  await initialize();
}
