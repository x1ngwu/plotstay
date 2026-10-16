import {reviewRevision,replyAction} from './moderation-fixtures.ts';
import {historicalProvider} from './work-fixtures.ts';
import {testEntry} from './runtime.ts';
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium, expect } from "@playwright/test";
import { fixture } from "./helpers.ts";
import { unusedPort, waitFor, stop } from "./runtime.ts";
import {
  createAccount,
  saveOwnPersona,
  moderatePersona,
  startReview,
  saveReview,
  submitReview,
  reviewDetail,
  bindProvider,
  saveReply,
  replyDetail,
  savePersonaNotes,
} from "@plotstay/domain";
const evidenceDir = new URL(process.env.PLOTSTAY_TEST_EVIDENCE ?? "../docs/workspace-handoff/works-implementation/regression-reviews/", import.meta.url);
const artifactDir = new URL("screenshots/", evidenceDir);
const profile = (en: string, zh: string) => ({
  en: {
    name: en,
    bio: "Following quiet paths between worlds.",
    avatar: "mint",
  },
  "zh-CN": {
    name: zh,
    bio: "记录旅途，也聆听不同世界的故事。",
    avatar: "mint",
  },
});
const reviewBody = (i = 0) => ({
  sourceLocale: "zh-CN",
  texts: {
    "zh-CN": {
      title: [
        "窗边的一夜，听见城市缓慢醒来",
        "沿着旧信号，走到风停下的地方",
        "雨后的港湾值得多留一晚",
      ][i % 3],
      description:
        "到达时正是傍晚，窗外的灯一盏一盏亮起来。房间没有过多装饰，桌上留着一本记录天气的旧册子。\n\n我最喜欢清晨沿廊散步的时刻。提供者耐心地告诉我哪扇窗能看见远处的信号塔，也提醒我夜间的钟声。这里适合慢慢停留，把旅程写成自己的故事。",
      origin: "北方旧城",
      stayDuration: "停留两夜",
      tags: ["安静", "窗边"],
    },
    en: {
      title: [
        "A night by the window as the city slowly wakes",
        "Following an old signal to the place where the wind settles",
        "One more evening in the harbour after the rain",
      ][i % 3],
      description:
        "We arrived at dusk, as the lights beyond the window began to glow. The room was simple and welcoming, with an old weather journal waiting on the desk.\n\nI especially enjoyed walking along the corridor in the morning. Our host patiently pointed out the window overlooking the distant signal tower and explained the bells we might hear at night. This is a place to stay a little longer and turn a journey into a story of your own.",
      origin: "The old northern town",
      stayDuration: "Two nights",
      tags: ["quiet", "window"],
    },
  },
  rating: 4,
  reviewRatings: { communication: 5, value: 4 },
});
const replyBody = {
  sourceLocale: "zh-CN",
  texts: {
    "zh-CN":
      "谢谢你认真记录这段旅程。那本天气册已经陪伴了许多旅人，如果下次再来，欢迎续写一页。清晨的廊道总有新的风景，期待与你再次相遇。",
    en: "Thank you for taking the time to record your journey. That weather journal has travelled with many guests; you are welcome to add another page next time. The morning corridor always has something new to offer, and we look forward to seeing you again.",
  },
};
test(
  "real reviews workspace: approved layout, live APIs, isolated data, input races and browser evidence",
  { timeout: 300000 },
  async (t) => {
    const f = await fixture();
    t.after(f.cleanup);
    const { db, data } = f;
    const user = await createAccount(db, data.admin, {
        email: "reviews-ui@tests.invalid",
        password: "reviews-test-123",
      }),
      owner = { id: user.id, email: user.email, siteRole: "user" as const };
    const otherUser = await createAccount(db, data.admin, {
        email: "other-reviews-ui@tests.invalid",
        password: "reviews-test-456",
      }),
      other = {
        id: otherUser.id,
        email: otherUser.email,
        siteRole: "user" as const,
      };
    const persona = async (a: any, n: string, zh: string) => {
      const p = await saveOwnPersona(db, a, {
        requestId: randomUUID(),
        profiles: profile(n, zh),
        action: "complete",
        baseRevisionId: null,
        expectedSubmittedRevisionId: null,
      });
      if (a.siteRole !== "admin")
        await moderatePersona(db, data.admin, p.revisionId, "approved", "");
      return p;
    };
    const mine = await persona(
        owner,
        "Lin, Keeper of the Northern Weather Journal",
        "林间 · 北方天气册的记录者",
      ),
      host = await persona(
        owner,
        "Moss of the Quiet Corridor",
        "苔 · 廊道守望者",
      ),
      guest = await persona(
        other,
        "Reed, Traveller Beyond the Signal Tower",
        "苇舟 · 信号塔另一端的旅人",
      ),
      nextHost = await persona(other, "New harbour keeper", "新任港湾守望者");
    const entryIds = ["observation-room", "forge-walk", "harbour-room"].map(
      (k) => data.ids[k]!,
    );
    const createReview = async (a: any, p: any, parent: string, i: number) => {
      const r = await startReview(db, a, parent, p.id);
      const current = await reviewDetail(db, a, r.id);
      const saved = await saveReview(
        db,
        a,
        r.id,
        current.content.head_revision_id,
        reviewBody(i),
      );
      await submitReview(db, a, r.id, saved.revisionId);
      await reviewRevision(
        db,
        data.admin,
        r.id,
        saved.revisionId,
        "publish",
        "",
      );
      return { ...r, revisionId: saved.revisionId };
    };
    const mineReviews: any[] = [];
    const received: any[] = [];
    for (let i = 0; i < 3; i++) {
      mineReviews.push(await createReview(owner, mine, entryIds[i]!, i));
      received.push(await createReview(other, guest, entryIds[i]!, i));
      await historicalProvider(db, data.admin, entryIds[i]!, host.id);
    }
    const own = mineReviews[0]!;
    const response = await saveReply(db, owner, own.id, replyBody, null);
    await replyAction(db, owner, own.id, "submit", response.revisionId);
    await replyAction(db, data.admin, own.id, "publish", response.revisionId);
    const a = await saveReview(db, owner, own.id, own.revisionId, reviewBody());
    await submitReview(db, owner, own.id, a.revisionId);
    const b = await saveReview(db, owner, own.id, a.revisionId, reviewBody());
    const returned = mineReviews[1]!;
    const ret = await saveReview(
      db,
      owner,
      returned.id,
      returned.revisionId,
      reviewBody(1),
    );
    await submitReview(db, owner, returned.id, ret.revisionId);
    await reviewRevision(
      db,
      data.admin,
      returned.id,
      ret.revisionId,
      "reject",
      "请补充夜间路线。Please add the evening route.",
    );
    const receivedReply = await saveReply(
      db,
      owner,
      received[0]!.id,
      replyBody,
      null,
    );
    await replyAction(
      db,
      owner,
      received[0]!.id,
      "submit",
      receivedReply.revisionId,
    );
    await replyAction(
      db,
      data.admin,
      received[0]!.id,
      "publish",
      receivedReply.revisionId,
    );
    const ra = await saveReply(
      db,
      owner,
      received[0]!.id,
      replyBody,
      receivedReply.revisionId,
    );
    await replyAction(db, owner, received[0]!.id, "submit", ra.revisionId);
    await saveReply(db, owner, received[0]!.id, replyBody, ra.revisionId);
    const historical = await saveReply(
      db,
      owner,
      received[2]!.id,
      replyBody,
      null,
    );
    await historicalProvider(db, data.admin, entryIds[2]!, nextHost.id);
    await savePersonaNotes(db, owner, mine.id, {
      requestId: randomUUID(),
      baseVersion: null,
      body: "PRIVATE-NOTES-UI-SENTINEL",
    });
    const apiPort = await unusedPort(),
      webPort = await unusedPort(),
      apiUrl = `http://127.0.0.1:${apiPort}`,
      webUrl = `http://127.0.0.1:${webPort}`;
    const env = {
      ...process.env,
      PGOPTIONS: f.options,
      NODE_ENV: "production",
      SITE_INDEXABLE: "false",
      COOKIE_SECURE: "false",
      API_PORT: String(apiPort),
      API_HOST: "127.0.0.1",
      HOST: "127.0.0.1",
      PORT: String(webPort),
      WEB_ORIGIN: webUrl,
      API_INTERNAL_URL: apiUrl,
    };
    const launch = (entry: string) => {
      const child = spawn(process.execPath, [testEntry(entry)], {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let logs = "";
      child.stdout!.on("data", (d) => (logs += d));
      child.stderr!.on("data", (d) => (logs += d));
      t.after(() => stop(child));
      return { child, logs: () => logs };
    };
    const api = launch("apps/api/dist/server.mjs");
    await waitFor(apiUrl + "/api/health", api.child, api.logs);
    const web = launch("apps/web/server.mjs");
    await waitFor(webUrl + "/en", web.child, web.logs);
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await ctx.newPage();
    const errors: string[] = [],
      paths: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (r.url().includes("/api/")) paths.push(new URL(r.url()).pathname);
    });
    assert.equal(
      (
        await ctx.request.post(webUrl + "/api/auth/login", {
          headers: { Origin: webUrl },
          data: { email: user.email, password: "reviews-test-123" },
        })
      ).status(),
      200,
    );
    const route = (lang = "zh", view = "reviews", id?: string, edit = false) =>
      webUrl +
      `/${lang}/workspace?view=${view}` +
      (id ? `&${view === "reviews" ? "review" : "reply"}=${id}` : "") +
      (edit ? "&mode=edit" : "");
    await mkdir(artifactDir, { recursive: true });
    const records: any[] = [];
    await t.test(
      "16 real browser screenshots: bilingual desktop/mobile, lists and edit contexts",
      async () => {
        for (const lang of ["zh", "en"])
          for (const width of [1440, 390])
            for (const [label, side, id, edit] of [
              ["reviews-list", "reviews", undefined, false],
              ["received-list", "replies", undefined, false],
              ["review-edit", "reviews", own.id, true],
              ["reply-edit", "replies", received[0]!.id, true],
            ] as const) {
              await page.setViewportSize({ width, height: 1000 });
              await page.goto(route(lang, side, id, edit));
              await expect(
                page.locator(edit ? "#editor" : ".rv-interaction-card").first(),
              ).toBeVisible();
              await page.evaluate(() => scrollTo(0, 0));
              assert.equal(await page.locator("h1").count(), 1);
              assert.ok(
                await page.evaluate(
                  () => document.documentElement.scrollWidth <= innerWidth + 1,
                ),
              );
              const file = `${label}-${lang}-${width}.png`;
              await page.screenshot({
                path: new URL(file, artifactDir).pathname,
                fullPage: true,
              });
              records.push({
                file,
                lang,
                width,
                source: "built service + real API + isolated schema",
              });
            }
      },
    );
    await t.test(
      "read-only history, new entry, role focus, full reading and return filters",
      async () => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(route());
        await page.locator("#rv-search").fill("窗边的一夜");
        await page.locator("#rv-sort").focus();
        await expect(page.locator(".rv-interaction-card")).toHaveCount(1);
        await page.locator("[data-action=open]").click();
        await expect(page.locator("#editor")).toHaveCount(0);
        await page.screenshot({
          path: new URL("review-reading-zh-1440.png", artifactDir).pathname,
          fullPage: true,
        });
        await page.locator("#ws-back").click();
        await expect(page.locator("#rv-search")).toHaveValue("窗边的一夜");
        await page.locator("[data-action=clear]").first().click();
        await page
          .locator("[data-action=role]")
          .filter({ hasText: "林间" })
          .last()
          .click();
        await page.locator('.ws-nav a[href*="view=replies"]').click();
        await expect(page.locator(".rv-role-picker summary")).toContainText(
          "林间",
        );
        await page.locator("[data-action=all]").click();
        await expect(
          page.locator(".rv-interaction-card").first(),
        ).toBeVisible();
        await page.goto(route("en", "replies", received[2]!.id));
        await expect(page.locator(".rv-note")).toContainText(
          "Read-only history",
        );
        await expect(page.locator("#editor")).toHaveCount(0);
        await page.screenshot({
          path: new URL("reply-history-en-1440.png", artifactDir).pathname,
          fullPage: true,
        });
        await page.goto(route() + "&new=1");
        await expect(
          page.locator(".rv-entry-list article").first(),
        ).toBeVisible();
        await page.screenshot({
          path: new URL("new-review-zh-1440.png", artifactDir).pathname,
          fullPage: true,
        });
        await page
          .locator(".rv-entry-list article")
          .filter({ hasText: "观察室" })
          .getByRole("button")
          .click();
        await page.locator("#new-persona").selectOption(mine.id);
        await page.screenshot({
          path: new URL("new-review-confirm-zh-1440.png", artifactDir).pathname,
          fullPage: true,
        });
        await page.locator("[data-action=start]").click();
        await expect(page.locator("#editor")).toBeVisible();
        assert.ok(page.url().includes(own.id));
      },
    );
    await t.test(
      "bilingual fields, source language and optional values survive; conflict comparison preserves dirty input",
      async () => {
        await page.goto(route("zh", "reviews", own.id, true));
        await page
          .locator("#field-description")
          .fill("保留中文输入 🌙\n下一行");
        await page.locator("[data-action=write-lang][data-lang=en]").click();
        await page.locator("#field-description").fill("Unsaved English input.");
        await page.locator(".ws-utility a[lang=en]").click();
        await expect(page.locator("#field-description")).toHaveValue(
          "Unsaved English input.",
        );
        await page
          .locator('[data-action=write-lang][data-lang="zh-CN"]')
          .click();
        await expect(page.locator("#field-description")).toHaveValue(
          "保留中文输入 🌙\n下一行",
        );
        await page.locator(".rv-optional summary").click();
        await expect(page.locator("#rv-source")).toHaveValue("zh-CN");
        await expect(page.locator("#field-origin")).toHaveValue("北方旧城");
        await saveReview(db, owner, own.id, b.revisionId, {
          ...reviewBody(),
          texts: {
            ...reviewBody().texts,
            "zh-CN": {
              ...reviewBody().texts["zh-CN"],
              description: "服务器的另一个版本",
            },
          },
        });
        await page.locator("[data-action=save]").first().click();
        await expect(page.locator("[data-action=compare]")).toBeVisible();
        await page.locator("[data-action=compare]").click();
        await page.screenshot({
          path: new URL("conflict-comparison-en-1440.png", artifactDir)
            .pathname,
          fullPage: true,
        });
        await page.locator("[data-action=adopt]").click();
        await expect(page.locator("#field-description")).toHaveValue(
          "保留中文输入 🌙\n下一行",
        );
        await expect(page.locator("#dirty-state")).toContainText("Unsaved");
        await page.screenshot({
          path: new URL("conflict-preserved-en-1440.png", artifactDir).pathname,
          fullPage: true,
        });
        page.once("dialog", (d) => d.dismiss());
        await page.locator("#ws-back").click();
        await expect(page.locator("#editor")).toBeVisible();
        await page.locator("[data-action=save]").first().click();
        await expect(page.locator("#persona-message")).toContainText(
          "Draft saved",
        );
        const saved = await reviewDetail(db, owner, own.id);
        assert.equal(
          saved.revisions[0].texts["zh-CN"].review.origin,
          "北方旧城",
        );
        assert.equal(saved.content.submitted_revision_id, a.revisionId);
      },
    );
    await t.test(
      "typing during slow save is preserved; response loss reuses the committed request",
      async () => {
        await page
          .locator("#field-description")
          .fill("Snapshot sent to server");
        let release!: () => void;
        const gate = new Promise<void>((r) => (release = r));
        let arrived!: () => void;
        const sent = new Promise<void>((r) => (arrived = r));
        await page.route(
          "**/api/me/review-workspace/save",
          async (route) => {
            const response = await route.fetch();
            arrived();
            await gate;
            await route.fulfill({ response });
          },
          { times: 1 },
        );
        await page.locator("[data-action=save]").first().click();
        await sent;
        await page
          .locator("#field-description")
          .fill("Typed while save response was delayed");
        release();
        await expect(page.locator("#persona-message")).toContainText(
          "remain unsaved",
        );
        await expect(page.locator("#field-description")).toHaveValue(
          "Typed while save response was delayed",
        );
        await page.route(
          "**/api/me/review-workspace/save",
          async (route) => {
            await route.fetch();
            await route.abort("failed");
          },
          { times: 1 },
        );
        await page.locator("[data-action=save]").first().click();
        await expect(page.locator("[data-action=recover]")).toBeVisible();
        const count = async () =>
          (
            await db.query(
              "SELECT count(*)::int n FROM content_revisions WHERE content_id=$1",
              [own.id],
            )
          ).rows[0].n;
        const n = await count();
        await page.locator("[data-action=recover]").click();
        await expect(page.locator("#persona-message")).toContainText(
          "Draft saved",
        );
        assert.equal(await count(), n);
      },
    );
    await t.test(
      "navigation waits recheck new input and failure leaves the editor intact",
      { timeout: 30000 },
      async () => {
        let release!: () => void;
        const gate = new Promise<void>((r) => (release = r));
        let arrived!: () => void;
        const sent = new Promise<void>((r) => (arrived = r));
        await page.route(
          "**/api/me/review-workspace?*",
          async (route) => {
            const response = await route.fetch();
            arrived();
            await gate;
            await route.fulfill({ response });
          },
          { times: 1 },
        );
        const href = page.url();
        await page.locator("#ws-back").click();
        await sent;
        await page
          .locator("#field-description")
          .fill("Input typed during navigation");
        const dismissed = new Promise<void>((resolve) =>
          page.once("dialog", async (d) => {
            await d.dismiss();
            resolve();
          }),
        );
        release();
        await dismissed;
        await expect(page.locator("#field-description")).toHaveValue(
          "Input typed during navigation",
        );
        assert.equal(page.url(), href);
        await page.route(
          "**/api/me/review-workspace?*",
          (r) => r.abort("failed"),
          { times: 1 },
        );
        page.once("dialog", (d) => d.accept());
        await page.locator("#ws-back").click();
        await expect(page.locator("#persona-message")).not.toContainText(
          "Loading",
        );
        await expect(page.locator("#field-description")).toHaveValue(
          "Input typed during navigation",
        );
        assert.equal(page.url(), href);
        await page.screenshot({
          path: new URL("navigation-input-protection-en-1440.png", artifactDir)
            .pathname,
          fullPage: true,
        });
      },
    );
    await t.test(
      "same-account reauthentication preserves input; switching accounts clears it",
      async () => {
        await ctx.clearCookies();
        await page.locator("[data-action=save]").first().click();
        await expect(page.locator("#account-login")).toBeVisible();
        await expect(page.locator("#account-content")).toBeHidden();
        await page.locator("#account-login [name=email]").fill(user.email);
        await page
          .locator("#account-login [name=password]")
          .fill("reviews-test-123");
        await page.locator("#account-login button").click();
        await expect(page.locator("#account-login")).toBeHidden();
        await expect(page.locator("#field-description")).toBeVisible();
        await expect(page.locator("#field-description")).toHaveValue(
          "Input typed during navigation",
        );
        await ctx.clearCookies();
        await page.locator("[data-action=save]").first().click();
        await expect(page.locator("#account-login")).toBeVisible();
        await page.locator("#account-login [name=email]").fill(other.email);
        await page
          .locator("#account-login [name=password]")
          .fill("reviews-test-456");
        await page.locator("#account-login button").click();
        await expect(page.locator("#field-description")).toHaveCount(0);
        assert.ok(
          !(await page.content()).includes("Input typed during navigation"),
        );
        assert.equal(
          (
            await ctx.request.post(webUrl + "/api/auth/login", {
              headers: { Origin: webUrl },
              data: { email: user.email, password: "reviews-test-123" },
            })
          ).status(),
          200,
        );
      },
    );
    await t.test(
      "1100/360, 200 percent text, long content, empty/error/loading and keyboard controls",
      async () => {
        for (const width of [1100, 360]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.goto(route("en", "replies", received[0]!.id, true));
          await expect(page.locator("#editor")).toBeVisible();
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          );
          await page.screenshot({
            path: new URL(`reply-edit-en-${width}.png`, artifactDir).pathname,
            fullPage: true,
          });
        }
        await page.setViewportSize({ width: 1100, height: 1000 });
        await page.goto(route("en"));
        await expect(
          page.locator(".rv-interaction-card").first(),
        ).toBeVisible();
        await page.addStyleTag({ content: "html{font-size:200%!important}" });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await page.screenshot({
          path: new URL("reviews-list-en-200-percent.png", artifactDir)
            .pathname,
          fullPage: true,
        });
        // A genuinely long published original must not push the writing area far down.
        const currentLong = await reviewDetail(db, other, received[0]!.id);
        const longBody = reviewBody();
        longBody.texts.en.description = (
          longBody.texts.en.description + "\n\n"
        ).repeat(8);
        const longSaved = await saveReview(
          db,
          other,
          received[0]!.id,
          currentLong.content.head_revision_id,
          longBody,
        );
        await submitReview(db, other, received[0]!.id, longSaved.revisionId);
        await reviewRevision(
          db,
          data.admin,
          received[0]!.id,
          longSaved.revisionId,
          "publish",
          "",
        );
        await page.goto(route("en", "replies", received[0]!.id, true));
        await expect(
          page.locator("details.rv-reading-block"),
        ).not.toHaveAttribute("open");
        await expect(page.locator("#field-description")).toBeVisible();
        await page.locator("[data-action=write-lang][data-lang=en]").focus();
        await page.keyboard.press("ArrowLeft");
        await expect(
          page.locator('[data-action=write-lang][data-lang="zh-CN"]'),
        ).toBeFocused();
        await page.screenshot({
          path: new URL("long-original-en-1100.png", artifactDir).pathname,
          fullPage: true,
        });
        let releaseLoading!: () => void;
        const loadingGate = new Promise<void>((r) => (releaseLoading = r));
        await page.route(
          "**/api/me/review-workspace?*",
          async (r) => {
            await loadingGate;
            await r.continue();
          },
          { times: 1 },
        );
        await page.goto(route("en"));
        await expect(page.locator("#persona-message")).toContainText("Loading");
        await page.screenshot({
          path: new URL("loading-en-1100.png", artifactDir).pathname,
          fullPage: true,
        });
        releaseLoading();
        await expect(
          page.locator(".rv-interaction-card").first(),
        ).toBeVisible();
        await page.goto(route("en") + "&q=unmatched-query");
        await expect(page.locator(".rv-empty")).toBeVisible();
        await page.screenshot({
          path: new URL("empty-en-1100.png", artifactDir).pathname,
          fullPage: true,
        });
        await page.route(
          "**/api/me/review-workspace?*",
          (route) => route.abort("failed"),
          { times: 1 },
        );
        await page.goto(route("en"));
        await expect(page.locator("[data-action=retry]")).toBeVisible();
        await page.screenshot({
          path: new URL("network-error-en-1100.png", artifactDir).pathname,
          fullPage: true,
        });
        await page.locator("[data-action=retry]").click();
        await expect(
          page.locator(".rv-interaction-card").first(),
        ).toBeVisible();
        await page.locator(".rv-role-picker summary").focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("#role-search")).toBeVisible();
        await page.locator("#role-search").fill("Lin");
        await expect(page.locator("#role-options button")).toHaveCount(1);
        assert.ok(!paths.some((p) => p.endsWith("/notes")));
        assert.ok(
          !(await page.content()).includes("PRIVATE-NOTES-UI-SENTINEL"),
        );
      },
    );

    await t.test(
      "save and submit freeze input before a slow identity check for reviews and replies",
      async () => {
        for (const view of ["reviews", "replies"])
          for (const revert of [false, true]) {
            const id = view === "reviews" ? own.id : received[0]!.id;
            await page.goto(route("en", view, id, true));
            await expect(page.locator("#field-description")).toBeVisible();
            const initial = `Click snapshot ${view} ${revert}`,
              later = `Typed during authentication ${view}`;
            await page.locator("#field-description").fill(initial);
            let releaseAuth!: () => void,
              authArrived!: () => void,
              releaseSave!: () => void,
              saveArrived!: () => void;
            const authGate = new Promise<void>((r) => (releaseAuth = r)),
              authSeen = new Promise<void>((r) => (authArrived = r));
            const saveGate = new Promise<void>((r) => (releaseSave = r)),
              saveSeen = new Promise<void>((r) => (saveArrived = r));
            await page.route(
              "**/api/auth/me",
              async (r) => {
                const response = await r.fetch();
                authArrived();
                await authGate;
                await r.fulfill({ response });
              },
              { times: 1 },
            );
            let payload: any;
            await page.route(
              "**/api/me/review-workspace/save",
              async (r) => {
                payload = r.request().postDataJSON();
                const response = await r.fetch();
                saveArrived();
                await saveGate;
                await r.fulfill({ response });
              },
              { times: 1 },
            );
            if (revert) page.once("dialog", (d) => d.accept());
            await page
              .locator(`[data-action=${revert ? "submit" : "save"}]`)
              .first()
              .click();
            await authSeen;
            await page.locator("#field-description").fill(later);
            releaseAuth();
            await saveSeen;
            if (revert) await page.locator("#field-description").fill(initial);
            releaseSave();
            await expect(page.locator("#persona-message")).toContainText(
              revert ? "fixed version" : "Draft saved",
            );
            assert.equal(
              view === "reviews"
                ? payload.body.texts.en.description
                : payload.body.texts.en,
              initial,
            );
            const current =
              view === "reviews"
                ? await reviewDetail(db, owner, id)
                : await replyDetail(db, owner, id);
            const stored =
              view === "reviews"
                ? current.revisions[0].texts.en.description
                : current.revisions[0].body.en;
            assert.equal(stored, initial);
            await expect(page.locator("#field-description")).toHaveValue(
              revert ? initial : later,
            );
            await expect(page.locator("#dirty-state")).toHaveText(
              revert ? "Input saved" : "Unsaved changes",
            );
            if (!revert) {
              const dismissed = new Promise<void>((resolve) =>
                page.once("dialog", async (d) => {
                  await d.dismiss();
                  resolve();
                }),
              );
              await page.locator("#ws-back").click();
              await dismissed;
              await expect(page.locator("#field-description")).toHaveValue(
                later,
              );
              await page.screenshot({
                path: new URL(`fix-save-input-${view}-en.png`, artifactDir)
                  .pathname,
                fullPage: true,
              });
              await page.locator("#field-description").fill(initial);
            }
            await page.locator("#ws-back").click();
            await expect(
              page.locator(".rv-interaction-card").first(),
            ).toBeVisible();
          }
      },
    );
    await t.test(
      "matching conflict adoption previews the adopted review and reply revision",
      async () => {
        for (const view of ["reviews", "replies"]) {
          const id = view === "reviews" ? own.id : received[0]!.id;
          await page.goto(route("en", view, id, true));
          await expect(page.locator("#editor")).toBeVisible();
          const marker = `Matching server baseline ${view}`;
          await page.locator("#field-description").fill(marker);
          let revisionId: string, oldId: string;
          if (view === "reviews") {
            const current = await reviewDetail(db, owner, id),
              r = current.revisions[0];
            oldId = current.content.head_revision_id;
            const texts = Object.fromEntries(
              Object.entries(r.texts).map(([lang, t]: [string, any]) => [
                lang,
                {
                  title: t.title,
                  description: lang === "en" ? marker : t.description,
                  origin: t.review?.origin ?? "",
                  stayDuration: t.review?.stayDuration ?? "",
                  tags: t.tags ?? [],
                },
              ]),
            );
            revisionId = (
              await saveReview(db, owner, id, oldId, {
                sourceLocale: r.source_locale,
                texts,
                rating: r.attributes.rating ?? null,
                reviewRatings: r.attributes.reviewRatings ?? {},
              })
            ).revisionId;
          } else {
            const current = await replyDetail(db, owner, id),
              r = current.revisions.find(
                (r: any) => r.id === current.editRevisionId,
              );
            oldId = current.baseRevisionId;
            revisionId = (
              await saveReply(
                db,
                owner,
                id,
                {
                  sourceLocale: r.source_locale,
                  texts: { ...r.body, en: marker },
                },
                oldId,
              )
            ).revisionId;
          }
          await page.locator("[data-action=save]").first().click();
          await expect(page.locator("[data-action=compare]")).toBeVisible();
          await page.locator("[data-action=compare]").click();
          await page.locator("[data-action=adopt]").click();
          await expect(page.locator("#dirty-state")).toHaveText(
            "Input matches the loaded version",
          );
          await page.locator("[data-action=preview]").click();
          await expect(page.locator("#editor")).toHaveCount(0);
          assert.equal(
            new URL(page.url()).searchParams.get("revision"),
            revisionId,
          );
          assert.notEqual(revisionId, oldId);
          assert.ok(
            (await page.locator(".rv-prose").allTextContents())
              .join(" ")
              .includes(marker),
          );
          await page.screenshot({
            path: new URL(`fix-adopted-preview-${view}-en.png`, artifactDir)
              .pathname,
            fullPage: true,
          });
        }
      },
    );
    await t.test(
      "reply previews use own readable revision after provider changes and baseline adoption",
      async () => {
        const id = received[2]!.id;
        await historicalProvider(db, data.admin, entryIds[2]!, host.id);
        await page.goto(route("en", "replies", id, true));
        await expect(page.locator("#editor")).toBeVisible();
        const ownBefore = await replyDetail(db, owner, id);
        await historicalProvider(db, data.admin, entryIds[2]!, nextHost.id);
        const foreign = await saveReply(db, other, id, {
          sourceLocale: "en",
          texts: { en: "Foreign private draft sentinel", "zh-CN": "对方私稿" },
        }, ownBefore.baseRevisionId);
        await historicalProvider(db, data.admin, entryIds[2]!, host.id);
        await page.locator("[data-action=save]").first().click();
        await expect(page.locator("[data-action=compare]")).toBeVisible();
        await page.locator("[data-action=compare]").click();
        await page.locator("[data-action=adopt]").click();
        await expect(page.locator("#dirty-state")).toHaveText("Input matches the loaded version");
        await expect(page.locator("#field-description")).toHaveValue(replyBody.texts.en);

        // Both conflict adoption and a fresh load must ignore the opaque head.
        for (const fresh of [false, true]) {
          if (fresh) {
            await page.goto(route("en", "replies", id, true));
            await expect(page.locator("#editor")).toBeVisible();
          }
          await page.locator("[data-action=preview]").click();
          await expect(page.locator("#editor")).toHaveCount(0);
          assert.equal(new URL(page.url()).searchParams.get("revision"), ownBefore.editRevisionId);
          assert.notEqual(ownBefore.editRevisionId, foreign.revisionId);
          const rendered = (await page.locator(".rv-prose").allTextContents()).join(" ");
          assert.ok(rendered.includes(replyBody.texts.en));
          assert.ok(!(await page.content()).includes("Foreign private draft sentinel"));
        }
        await page.screenshot({
          path: new URL("fix-readable-reply-preview-en.png", artifactDir).pathname,
          fullPage: true,
        });
        // Preview selection must not replace the concurrency token for saving.
        await page.goto(route("en", "replies", id, true));
        await page.locator("#field-description").fill("Own reply after provider return");
        await page.locator("[data-action=save]").first().click();
        await expect(page.locator("#dirty-state")).toHaveText("Input saved");
        const saved = await replyDetail(db, owner, id);
        assert.notEqual(saved.baseRevisionId, foreign.revisionId);
        assert.equal(saved.revisions.find((r: any) => r.id === saved.editRevisionId)?.body.en,
          "Own reply after provider return");
      },
    );
    await t.test(
      "current provider editable reply survives multiple history pages and persona changes",
      async () => {
        const id = received[2]!.id;
        const before = await replyDetail(db, owner, id);
        const editable = before.revisions.find((r: any) => r.id === before.editRevisionId);
        await historicalProvider(db, data.admin, entryIds[2]!, mine.id);
        let base = before.baseRevisionId;
        for (let i = 0; i < 21; i++) {
          base = (await saveReply(db, owner, id, {
            sourceLocale: "en", texts: { en: `Alternate persona draft ${i}` },
          }, base, mine.id)).revisionId;
        }
        await historicalProvider(db, data.admin, entryIds[2]!, host.id);
        for (const historyPage of [1, 2]) {
          const paged = await replyDetail(db, owner, id, false, { page: historyPage });
          assert.equal(paged.editRevisionId, before.editRevisionId);
          assert.equal(paged.baseRevisionId, base);
          assert.equal(paged.revisions.find((r: any) => r.id === paged.editRevisionId)?.body.en, editable.body.en);
          assert.ok(!paged.revisions.some((r: any) => r.created_by === other.id));
          await page.goto(route("en", "replies", id, true) + `&historyPage=${historyPage}`);
          await expect(page.locator("#field-description")).toHaveValue(editable.body.en);
          await page.locator("[data-action=preview]").click();
          await expect(page.locator("#editor")).toHaveCount(0);
          assert.equal(new URL(page.url()).searchParams.get("revision"), before.editRevisionId);
          assert.ok((await page.locator(".rv-prose").allTextContents()).join(" ").includes(editable.body.en));
        }
        await page.screenshot({
          path: new URL("fix-paginated-reply-preview-en.png", artifactDir).pathname,
          fullPage: true,
        });
        // A different account's former provider retains only its own private history.
        const former = await replyDetail(db, other, id, false, { page: 1 });
        assert.equal(former.canEdit, false);
        assert.equal(former.editRevisionId, null);
        assert.ok(former.revisions.every((r: any) => r.created_by === other.id));
      },
    );
    await t.test(
      "first reply save and submit immediately enable preview of the persisted version",
      async () => {
        for (const action of ["save", "submit"]) {
          const id = action === "save" ? received[1]!.id : mineReviews[1]!.id;
          await page.goto(route("en", "replies", id, true));
          await expect(page.locator("[data-action=preview]")).toBeDisabled();
          const marker = `First reply ${action} is immediately previewable`;
          await page.locator("#field-description").fill(marker);
          await page.locator(`[data-action=${action}]`).first().click();
          await expect(page.locator("#dirty-state")).toHaveText("Input saved");
          await expect(page.locator("[data-action=preview]")).toBeEnabled();
          const saved = await replyDetail(db, owner, id);
          await page.locator("[data-action=preview]").click();
          await expect(page.locator("#editor")).toHaveCount(0);
          assert.equal(new URL(page.url()).searchParams.get("revision"), saved.editRevisionId);
          assert.ok((await page.locator(".rv-prose").allTextContents()).join(" ").includes(marker));
        }
        await page.screenshot({
          path: new URL("fix-first-reply-preview-en.png", artifactDir).pathname,
          fullPage: true,
        });
      },
    );
    await t.test(
      "late previous-account detail response preserves the new account editor and save",
      async () => {
        await page.goto(route("en", "reviews"));
        await expect(page.locator(".rv-interaction-card").first()).toBeVisible();
        let arrived!: () => void, release!: () => void;
        const seen = new Promise<void>((resolve) => { arrived = resolve; });
        const gate = new Promise<void>((resolve) => { release = resolve; });
        await page.route(`**/api/me/review-workspace/${own.id}?*`, async (r) => {
          const response = await r.fetch();
          arrived();
          await gate;
          await r.fulfill({ response });
        }, { times: 1 });
        try {
          await page.locator(`[data-action=open][data-id="${own.id}"]`).click();
          await seen;
          assert.equal((await ctx.request.post(webUrl + "/api/auth/login", {
            headers: { Origin: webUrl },
            data: { email: other.email, password: "reviews-test-456" },
          })).status(), 200);
          await page.evaluate(() => window.dispatchEvent(new Event("focus")));
          const card = page.locator(`[data-action=open][data-id="${received[0]!.id}"]`);
          await expect(card).toBeVisible();
          await card.click();
          await page.locator("[data-action=edit]").click();
          const marker = "New account input must survive old response";
          await page.locator("#field-description").fill(marker);
          const late = page.waitForResponse((r) => r.url().includes(`/review-workspace/${own.id}?`));
          release();
          await (await late).finished();
          // Let the delivered response handler finish before checking absence of damage.
          await page.evaluate(() => new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          await expect(page.locator("#account-content")).toBeVisible();
          await expect(page.locator("#field-description")).toHaveValue(marker);
          await expect(page.locator("#dirty-state")).toHaveText("Unsaved changes");
          assert.equal(new URL(page.url()).searchParams.get("review"), received[0]!.id);
          await page.screenshot({
            path: new URL("fix-late-account-response-en.png", artifactDir).pathname,
            fullPage: true,
          });
          await page.locator("[data-action=save]").first().click();
          await expect(page.locator("#dirty-state")).toHaveText("Input saved");
          const saved = await reviewDetail(db, other, received[0]!.id);
          assert.equal(saved.revisions.find((r: any) => r.id === saved.content.head_revision_id)?.texts.en.description, marker);
          const original = await reviewDetail(db, owner, own.id);
          assert.ok(!original.revisions.some((r: any) => r.texts.en?.description === marker));
        } finally {
          release();
        }
      },
    );
    assert.deepEqual(errors, []);
    await writeFile(
      new URL("browser-evidence.json", evidenceDir),
      JSON.stringify(
        {
          environment:
            "isolated PostgreSQL schema; real built API and web; Chromium",
          physicalDevice: false,
          publicBasicAuth: false,
          screenshots: records,
          errors,
          requestPaths: [...new Set(paths)],
        },
        null,
        2,
      ),
    );
  },
);
