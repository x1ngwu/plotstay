import {historicalProvider} from './work-fixtures.ts';
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.ts";
import { randomUUID } from "node:crypto";
import { saveReviewCommand } from "../packages/domain/src/review-commands.ts";
import {
  reviewWorkspaceList,
  reviewWorkspaceDetail,
  reviewEntries,
} from "../packages/domain/src/review-workspace.ts";
import {
  createAccount,
  submitOwnPersona,
  moderatePersona,
  savePersonaNotes,
  moderationQueue,
  workspaceOverview,
  unpublishContent,
} from "@plotstay/domain";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { migrate } from "../packages/database/src/migrate.ts";
import { createApp } from "../apps/api/src/app.ts";
import {
  savePersona,
  startReview,
  saveReview,
  submitReview,
  reviewRevision,
  reviewDetail,
  bindProvider,
  saveReply,
  replyAction,
  replyDetail,
  getPublished,
} from "@plotstay/domain";
const profiles = {
  en: { name: "Fixed author", bio: "Public profile", avatar: "mint" },
  "zh-CN": { name: "固定作者", bio: "公开资料", avatar: "mint" },
};
const body = {
  sourceLocale: "en",
  texts: {
    en: { title: "A night", description: "A review without a reservation." },
    "zh-CN": { title: "一夜", description: "不要求预订的评价。" },
  },
  rating: 4,
};
async function setup() {
  const f = await fixture();
  const p = await savePersona(f.db, f.data.admin, profiles);
  const r = await startReview(
    f.db,
    f.data.admin,
    f.data.ids["observation-room"]!,
    p.id,
  );
  const d = await reviewDetail(f.db, f.data.admin, r.id);
  return { ...f, p, id: r.id, base: d.revisions[0].id };
}
test("review P/A/B: saving B preserves A; approve A keeps B; replacing submission rejects stale review", async (t) => {
  const f = await setup();
  t.after(f.cleanup);
  const { db, data, id } = f;
  const p = await saveReview(db, data.admin, id, f.base, body);
  await submitReview(db, data.admin, id, p.revisionId);
  await reviewRevision(db, data.admin, id, p.revisionId, "publish", "");
  const a = await saveReview(db, data.admin, id, p.revisionId, body);
  await submitReview(db, data.admin, id, a.revisionId);
  const token = (await reviewDetail(db, data.admin, id)).content.draft_token;
  const b = await saveReview(db, data.admin, id, a.revisionId, body);
  await reviewRevision(
    db,
    data.admin,
    id,
    a.revisionId,
    "publish",
    "Fixed A",
    token,
  );
  assert.equal(
    (
      await db.query(
        "SELECT revision_id FROM publications WHERE id=(SELECT published_publication_id FROM contents WHERE id=$1)",
        [id],
      )
    ).rows[0].revision_id,
    a.revisionId,
  );
  assert.equal(
    (await reviewDetail(db, data.admin, id)).content.head_revision_id,
    b.revisionId,
  );
  await submitReview(db, data.admin, id, b.revisionId);
  const c = await saveReview(db, data.admin, id, b.revisionId, body);
  await submitReview(db, data.admin, id, c.revisionId);
  await assert.rejects(
    () => reviewRevision(db, data.admin, id, b.revisionId, "publish", "stale"),
    (e: any) => e.code === "SUBMISSION_SUPERSEDED",
  );
});
test("reply P/A/B: draft does not revoke submitted version, approval leaves latest head", async (t) => {
  const f = await setup();
  t.after(f.cleanup);
  const { db, data, id } = f;
  const p = await saveReview(db, data.admin, id, f.base, body);
  await submitReview(db, data.admin, id, p.revisionId);
  await reviewRevision(db, data.admin, id, p.revisionId, "publish", "");
  await historicalProvider(db, data.admin, data.ids["observation-room"]!, f.p.id);
  const input = {
    sourceLocale: "en",
    texts: { en: "Thank you.", "zh-CN": "谢谢。" },
  };
  const a = await saveReply(db, data.admin, id, input, null);
  await replyAction(db, data.admin, id, "submit", a.revisionId);
  const b = await saveReply(db, data.admin, id, input, a.revisionId);
  await replyAction(db, data.admin, id, "publish", a.revisionId);
  const d = await replyDetail(db, data.admin, id);
  assert.equal(d.reply.head_revision_id, b.revisionId);
  assert.equal(d.publications[0].revision_id, a.revisionId);
});
test("atomic command retries return the same fixed result; conflicts and failed submission roll back", async (t) => {
  const f = await setup();
  t.after(f.cleanup);
  const { db, data, id } = f;
  const command = {
    requestId: randomUUID(),
    kind: "review",
    reviewId: id,
    baseRevisionId: f.base,
    expectedSubmittedRevisionId: null,
    expectedPersonaId: f.p.id,
    expectedPersonaRevisionId: f.p.revisionId,
    action: "submit",
    body,
  };
  const results = await Promise.all(
    Array.from({ length: 5 }, () => saveReviewCommand(db, data.admin, command)),
  );
  results.forEach((r) => assert.deepEqual(r, results[0]));
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM content_revisions WHERE content_id=$1",
        [id],
      )
    ).rows[0].n,
    2,
  );
  await assert.rejects(
    () =>
      saveReviewCommand(db, data.admin, {
        ...command,
        body: { ...body, rating: 2 },
      }),
    (e: any) => e.code === "REQUEST_CONFLICT",
  );
  const saved = results[0];
  const draft = await saveReviewCommand(db, data.admin, {
    ...command,
    requestId: randomUUID(),
    action: "draft",
    baseRevisionId: saved.revisionId,
  });
  assert.equal(draft.submittedRevisionId, saved.revisionId);
  await reviewRevision(db, data.admin, id, saved.revisionId, "publish", "");
  assert.deepEqual(await saveReviewCommand(db, data.admin, command), saved);
  await assert.rejects(
    () =>
      saveReviewCommand(db, data.admin, {
        ...command,
        requestId: randomUUID(),
        baseRevisionId: draft.revisionId,
        expectedSubmittedRevisionId: saved.revisionId,
      }),
    (e: any) => e.code === "SUBMISSION_CONFLICT",
  );
  assert.equal(
    (await reviewDetail(db, data.admin, id)).content.head_revision_id,
    draft.revisionId,
  );
  await db.query(
    `CREATE FUNCTION fail_review_submit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='submitted' THEN RAISE EXCEPTION 'Injected failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_submit BEFORE INSERT ON moderation_events FOR EACH ROW EXECUTE FUNCTION fail_review_submit();`,
  );
  await assert.rejects(
    () =>
      saveReviewCommand(db, data.admin, {
        ...command,
        requestId: randomUUID(),
        baseRevisionId: draft.revisionId,
      }),
    /Injected failure/,
  );
  assert.equal(
    (await reviewDetail(db, data.admin, id)).content.head_revision_id,
    draft.revisionId,
  );
});
test("old provider reads own history, new provider cannot inherit private drafts; same-account identity changes cannot submit old identity", async (t) => {
  const f = await setup();
  t.after(f.cleanup);
  const { db, data, id } = f;
  const u = await createAccount(db, data.admin, {
      email: "new-provider@tests.invalid",
      password: "testing-password-only",
    }),
    other = { id: u.id, email: u.email, siteRole: "user" as const };
  const np = await savePersona(db, other, profiles);
  await submitOwnPersona(db, other, np.id, np.revisionId);
  await moderatePersona(db, data.admin, np.revisionId, "approved", "");
  const p = await saveReview(db, data.admin, id, f.base, body);
  await submitReview(db, data.admin, id, p.revisionId);
  await reviewRevision(db, data.admin, id, p.revisionId, "publish", "");
  await historicalProvider(db, data.admin, data.ids["observation-room"]!, f.p.id);
  const old = await saveReply(
    db,
    data.admin,
    id,
    { sourceLocale: "en", texts: { en: "Old private sentinel" } },
    null,
  );
  await historicalProvider(db, data.admin, data.ids["observation-room"]!, np.id);
  const oldDetail = await replyDetail(db, data.admin, id);
  assert.equal(oldDetail.canEdit, false);
  assert.equal(oldDetail.revisions[0].id, old.revisionId);
  const newDetail = await replyDetail(db, other, id);
  assert.equal(newDetail.canEdit, true);
  assert.equal(newDetail.revisions.length, 0);
  assert.equal(newDetail.baseRevisionId, old.revisionId);
  assert.ok(
    !JSON.stringify(
      await reviewWorkspaceDetail(db, other, id, "replies", "en"),
    ).includes("Old private sentinel"),
  );
  const next = await saveReply(
    db,
    other,
    id,
    { sourceLocale: "en", texts: { en: "New private sentinel" } },
    newDetail.baseRevisionId,
  );
  assert.ok(
    !JSON.stringify(await replyDetail(db, data.admin, id)).includes(
      "New private sentinel",
    ),
  );
  await assert.rejects(
    () =>
      saveReply(
        db,
        data.admin,
        id,
        { sourceLocale: "en", texts: { en: "Forbidden" } },
        next.revisionId,
      ),
    (e: any) => e.code === "PROVIDER_FORBIDDEN",
  );
  const np2 = await savePersona(db, other, profiles);
  await submitOwnPersona(db, other, np2.id, np2.revisionId);
  await moderatePersona(db, data.admin, np2.revisionId, "approved", "");
  await historicalProvider(db, data.admin, data.ids["observation-room"]!, np2.id);
  await assert.rejects(
    () => replyAction(db, other, id, "submit", next.revisionId),
    (e: any) => e.code === "PROVIDER_FORBIDDEN",
  );
  await db.query("UPDATE worlds SET site_blocked=true WHERE id=$1", [
    data.latheId,
  ]);
  await assert.rejects(
    () => replyDetail(db, data.admin, id),
    (e: any) => e.code === "TARGET_UNAVAILABLE",
  );
  assert.equal(
    (await reviewWorkspaceList(db, data.admin, { view: "replies" })).total,
    0,
  );
});
test("list and details use readable real context, personal source scope and public entry search", async (t) => {
  const f = await setup();
  t.after(f.cleanup);
  const { db, data, id } = f;
  await saveReview(db, data.admin, id, f.base, body);
  const list = await reviewWorkspaceList(db, data.admin, {
    view: "reviews",
    locale: "en",
  });
  assert.equal(list.total, 1);
  assert.equal(list.items[0].id, id);
  assert.ok(list.items[0].entry_name);
  assert.ok(list.items[0].world_name);
  assert.equal(list.items[0].state, "draft");
  assert.equal(
    (await reviewWorkspaceList(db, data.admin, { q: "no match at all" })).total,
    0,
  );
  const detail = await reviewWorkspaceDetail(
    db,
    data.admin,
    id,
    "reviews",
    "en",
  );
  assert.equal(detail.canEdit, true);
  assert.equal(detail.identity.id, f.p.id);
  const entries = await reviewEntries(db, { locale: "en", q: "Observation" });
  assert.ok(
    entries.items.some((e: any) => e.id === data.ids["observation-room"]),
  );
});
test("45 reviews: full-scope count/search/order, visible reply activity, no private updates and one list query", async (t) => {
  const f = await setup();
  t.after(f.cleanup);
  const { db, data, id } = f;
  const first = await saveReview(db, data.admin, id, f.base, {
    ...body,
    texts: {
      ...body.texts,
      en: {
        title: "First review",
        description: "x".repeat(600) + " distant-search-marker",
      },
    },
  });
  await submitReview(db, data.admin, id, first.revisionId);
  await reviewRevision(db, data.admin, id, first.revisionId, "publish", "");
  for (let i = 0; i < 44; i++) {
    const p = await savePersona(db, data.admin, {
      ...profiles,
      en: { ...profiles.en, name: "Traveller " + i },
    });
    const r = await startReview(
      db,
      data.admin,
      data.ids["observation-room"]!,
      p.id,
    );
    const head = (
      await db.query("SELECT head_revision_id FROM contents WHERE id=$1", [
        r.id,
      ])
    ).rows[0].head_revision_id;
    await saveReview(db, data.admin, r.id, head, body);
  }
  const pages = await Promise.all(
    [1, 2, 3].map((page) =>
      reviewWorkspaceList(db, data.admin, { view: "reviews", page }),
    ),
  );
  assert.deepEqual(
    pages.map((p) => p.items.length),
    [20, 20, 5],
  );
  assert.ok(pages.every((p) => p.total === 45 && p.pages === 3));
  assert.equal(
    new Set(pages.flatMap((p) => p.items.map((i: any) => i.id))).size,
    45,
  );
  assert.equal(
    (await reviewWorkspaceList(db, data.admin, { q: "distant-search-marker" }))
      .total,
    1,
  );
  assert.equal(
    (await reviewWorkspaceList(db, data.admin, { persona: f.p.id })).total,
    1,
  );
  const u = await createAccount(db, data.admin, {
      email: "host-pagination@tests.invalid",
      password: "testing-password-only",
    }),
    host = { id: u.id, email: u.email, siteRole: "user" as const };
  const hp = await savePersona(db, host, profiles);
  await submitOwnPersona(db, host, hp.id, hp.revisionId);
  await moderatePersona(db, data.admin, hp.revisionId, "approved", "");
  await historicalProvider(db, data.admin, data.ids["observation-room"]!, hp.id);
  const before = await reviewWorkspaceList(db, data.admin, {});
  const privateReply = await saveReply(
    db,
    host,
    id,
    {
      sourceLocale: "en",
      texts: { en: "Opposing-private-sentinel", "zh-CN": "私稿" },
    },
    null,
  );
  assert.deepEqual(await reviewWorkspaceList(db, data.admin, {}), before);
  await replyAction(db, host, id, "submit", privateReply.revisionId);
  await replyAction(db, data.admin, id, "publish", privateReply.revisionId);
  const promoted = await reviewWorkspaceList(db, data.admin, {});
  assert.equal(promoted.items[0].id, id);
  assert.equal(promoted.items[0].activity_action, "reply_published");
  await savePersona(
    db,
    host,
    { ...profiles, en: { ...profiles.en, name: "Changed provider name" } },
    hp.id,
    hp.revisionId,
  );
  assert.equal(
    (await reviewWorkspaceList(db, data.admin, {})).items[0].activity_at,
    promoted.items[0].activity_at,
  );
  await savePersonaNotes(db, data.admin, f.p.id, {
    requestId: randomUUID(),
    baseVersion: null,
    body: "PRIVATE-NOTES-SENTINEL",
  });
  let queries = 0;
  const connection = {
    query: (...args: any[]) => {
      queries++;
      return (db.query as any)(...args);
    },
  } as any;
  const measured = await reviewWorkspaceList(connection, data.admin, {});
  assert.equal(queries, 1);
  assert.ok(!JSON.stringify(measured).includes("PRIVATE-NOTES-SENTINEL"));
  assert.equal(
    (await reviewWorkspaceList(db, data.admin, { q: "PRIVATE-NOTES-SENTINEL" }))
      .total,
    0,
  );
  assert.ok(
    !JSON.stringify(
      await reviewWorkspaceDetail(db, data.admin, id, "reviews", "en"),
    ).includes("PRIVATE-NOTES-SENTINEL"),
  );
  assert.ok(
    !JSON.stringify(await moderationQueue(db, data.admin)).includes(
      "PRIVATE-NOTES-SENTINEL",
    ),
  );
});
test("fixed translation snapshot, pending homepage/admin queue and rejection bind to A without altering B", async (t) => {
  const f = await setup();
  t.after(f.cleanup);
  const { db, data, id } = f;
  const a = await saveReview(db, data.admin, id, f.base, body);
  await submitReview(db, data.admin, id, a.revisionId);
  const b = await saveReview(db, data.admin, id, a.revisionId, body);
  assert.equal(
    (await moderationQueue(db, data.admin)).items.find((x: any) => x.id === id)
      .revision_id,
    a.revisionId,
  );
  const overview = await workspaceOverview(db, data.admin, { locale: "en" });
  assert.ok(JSON.stringify(overview).includes("submitted"));
  const translation = (
    await db.query(
      "INSERT INTO translations(revision_id,locale,body,origin,created_by) VALUES($1,'en',$2,'manual',$3) RETURNING id",
      [
        a.revisionId,
        {
          title: "Changed after submission",
          description: "Must not publish this",
        },
        data.admin.id,
      ],
    )
  ).rows[0];
  await db.query(
    "UPDATE revision_locales SET translation_id=$2 WHERE revision_id=$1 AND locale='en'",
    [a.revisionId, translation.id],
  );
  await reviewRevision(db, data.admin, id, a.revisionId, "publish", "");
  assert.equal(
    (await getPublished(db, "en", { id }))!.text.title,
    body.texts.en.title,
  );
  await submitReview(db, data.admin, id, b.revisionId);
  const c = await saveReview(db, data.admin, id, b.revisionId, body);
  await reviewRevision(
    db,
    data.admin,
    id,
    b.revisionId,
    "reject",
    "Only B is returned",
  );
  const d = await reviewDetail(db, data.admin, id);
  assert.equal(d.content.head_revision_id, c.revisionId);
  assert.equal(d.revisions[0].status, "draft");
  assert.ok(
    d.events.some(
      (e: any) =>
        e.revision_id === b.revisionId && e.note === "Only B is returned",
    ),
  );
  await unpublishContent(
    db,
    data.admin,
    data.ids["observation-room"]!,
    false,
    "",
  );
  const history = await reviewWorkspaceDetail(
    db,
    data.admin,
    id,
    "reviews",
    "en",
  );
  assert.equal(history.canEdit, false);
  assert.equal(history.entry, null);
  assert.equal(history.publicReply, null);
  assert.ok(history.review!.revisions.length > 0);
  const listed = await reviewWorkspaceList(db, data.admin, {
    view: "reviews",
    status: "readonly",
  });
  const historical = listed.items.find((r: any) => r.id === id);
  assert.ok(historical);
  assert.equal(historical.world_name, null);
  assert.equal(historical.entry_name, null);
  assert.equal(historical.can_edit, false);
  assert.equal(historical.title, body.texts.en.title);
});
test("012 migration backfills effective A while preserving B and every historical body", async (t) => {
  const f = await fixture(true);
  t.after(f.cleanup);
  const { db, data } = f;
  const folder = new URL("../packages/database/migrations/", import.meta.url);
  for (const file of (await readdir(folder))
    .filter(
      (n) =>
        n.endsWith(".sql") && n > "003_translation_execution.sql" && n < "012",
    )
    .sort()) {
    const sql = await readFile(new URL(file, folder), "utf8");
    await db.query(sql);
    await db.query(
      "INSERT INTO schema_migrations(name,checksum)VALUES($1,$2)",
      [file, createHash("sha256").update(sql).digest("hex")],
    );
  }
  const p = await savePersona(db, data.admin, profiles);
  await submitOwnPersona(db, data.admin, p.id, p.revisionId);
  const started = await startReview(
    db,
    data.admin,
    data.ids["observation-room"]!,
    p.id,
  );
  const head = (
    await db.query("SELECT head_revision_id FROM contents WHERE id=$1", [
      started.id,
    ])
  ).rows[0].head_revision_id;
  const a = await saveReview(db, data.admin, started.id, head, body);
  await db.query(
    "UPDATE content_revisions SET status='submitted' WHERE id=$1",
    [a.revisionId],
  );
  await db.query(
    "INSERT INTO moderation_events(content_id,revision_id,world_id,actor_id,action)VALUES($1,$2,$3,$4,'submitted')",
    [started.id, a.revisionId, data.latheId, data.admin.id],
  );
  const b = await saveReview(db, data.admin, started.id, a.revisionId, body);
  const history = (
    await db.query("SELECT * FROM content_revisions ORDER BY id")
  ).rows;
  await migrate(db);
  await migrate(db);
  assert.deepEqual(
    (await db.query("SELECT * FROM content_revisions ORDER BY id")).rows,
    history,
  );
  const row = (
    await db.query("SELECT * FROM contents WHERE id=$1", [started.id])
  ).rows[0];
  assert.equal(row.submitted_revision_id, a.revisionId);
  assert.equal(row.head_revision_id, b.revisionId);
  await reviewRevision(
    db,
    data.admin,
    started.id,
    a.revisionId,
    "publish",
    "After migration",
  );
  assert.equal(
    (await reviewDetail(db, data.admin, started.id)).content.head_revision_id,
    b.revisionId,
  );
});
test("real route commands enforce sessions/origin, fixed author and fixed A through old moderation API", async (t) => {
  const f = await setup();
  t.after(f.cleanup);
  const { db, data, id } = f,
    app = await createApp(db);
  t.after(() => app.close());
  assert.equal(
    (await app.inject({ url: "/api/me/review-workspace" })).statusCode,
    401,
  );
  const logged = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin: "http://localhost:4321" },
    payload: f.credentials,
  });
  const headers = {
    origin: "http://localhost:4321",
    cookie: String(logged.headers["set-cookie"]),
  };
  const command = {
    requestId: randomUUID(),
    kind: "review",
    reviewId: id,
    baseRevisionId: f.base,
    expectedSubmittedRevisionId: null,
    expectedPersonaId: f.p.id,
    expectedPersonaRevisionId: f.p.revisionId,
    action: "submit",
    body,
  };
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/me/review-workspace/save",
        payload: command,
        headers: { cookie: headers.cookie },
      })
    ).statusCode,
    403,
  );
  const response = await app.inject({
    method: "POST",
    url: "/api/me/review-workspace/save",
    headers,
    payload: command,
  });
  assert.equal(response.statusCode, 200, response.body);
  const a = response.json();
  assert.deepEqual(
    (
      await app.inject({
        method: "POST",
        url: "/api/me/review-workspace/save",
        headers,
        payload: command,
      })
    ).json(),
    a,
  );
  const b = await saveReview(db, data.admin, id, a.revisionId, body);
  const approval = await app.inject({
    method: "POST",
    url: `/api/admin/contents/${id}/review`,
    headers,
    payload: {
      revisionId: a.revisionId,
      draftToken: a.submissionToken,
      decision: "publish",
      note: "Fixed version",
    },
  });
  assert.equal(approval.statusCode, 200, approval.body);
  assert.equal(
    (await reviewDetail(db, data.admin, id)).content.head_revision_id,
    b.revisionId,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/admin/contents/${id}/review`,
        headers,
        payload: {
          revisionId: a.revisionId,
          decision: "publish",
          note: "stale",
        },
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/me/review-workspace?status=submitted",
        headers,
      })
    ).json().total,
    0,
  );
});
test("concurrent approval versus save-and-submit serializes; bounded history retains explicit old version and current P/A/B", async (t) => {
  const f = await setup();
  t.after(f.cleanup);
  const { db, data, id } = f;
  let head = f.base;
  for (let i = 0; i < 3; i++) {
    const a = await saveReview(db, data.admin, id, head, body);
    await submitReview(db, data.admin, id, a.revisionId);
    const outcomes = await Promise.allSettled([
      reviewRevision(
        db,
        data.admin,
        id,
        a.revisionId,
        "publish",
        "Concurrent approval",
      ),
      saveReviewCommand(db, data.admin, {
        requestId: randomUUID(),
        kind: "review",
        reviewId: id,
        baseRevisionId: a.revisionId,
        expectedSubmittedRevisionId: a.revisionId,
        expectedPersonaId: f.p.id,
        expectedPersonaRevisionId: f.p.revisionId,
        action: "submit",
        body,
      }),
    ]);
    assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
    const failed = outcomes.find(
      (x) => x.status === "rejected",
    ) as PromiseRejectedResult;
    assert.ok(
      ["SUBMISSION_CONFLICT", "SUBMISSION_SUPERSEDED"].includes(
        failed.reason.code,
      ),
    );
    const detail = await reviewDetail(db, data.admin, id);
    head = detail.content.head_revision_id;
    if (detail.content.submitted_revision_id)
      await reviewRevision(
        db,
        data.admin,
        id,
        detail.content.submitted_revision_id,
        "publish",
        "Resolve race",
      );
  }
  const pending = await saveReview(db, data.admin, id, head, body);
  await submitReview(db, data.admin, id, pending.revisionId);
  head = pending.revisionId;
  for (let i = 0; i < 25; i++)
    head = (await saveReview(db, data.admin, id, head, body)).revisionId;
  const page = await reviewWorkspaceDetail(db, data.admin, id, "reviews", "en");
  assert.ok(page.review!.revisions.length <= 24);
  assert.equal(page.historyPages, 2);
  assert.ok(
    page.review!.revisions.some((r: any) => r.id === pending.revisionId),
  );
  const linked = await reviewWorkspaceDetail(
    db,
    data.admin,
    id,
    "reviews",
    "en",
    { page: 1, revision: f.base },
  );
  assert.ok(linked.review!.revisions.some((r: any) => r.id === f.base));
  const older = await reviewWorkspaceDetail(
    db,
    data.admin,
    id,
    "reviews",
    "en",
    { page: 2 },
  );
  assert.ok(older.review!.revisions.some((r: any) => r.id === f.base));
});

test("reply command fixed results and replacement of a former provider submission expose no private body", async (t) => {
  const f = await setup();
  t.after(f.cleanup);
  const { db, data, id } = f;
  const p = await saveReview(db, data.admin, id, f.base, body);
  await submitReview(db, data.admin, id, p.revisionId);
  await reviewRevision(db, data.admin, id, p.revisionId, "publish", "");
  await historicalProvider(db, data.admin, data.ids["observation-room"]!, f.p.id);
  const a = await saveReply(
    db,
    data.admin,
    id,
    { sourceLocale: "en", texts: { en: "Former provider private submission" } },
    null,
  );
  await replyAction(db, data.admin, id, "submit", a.revisionId);
  const u = await createAccount(db, data.admin, {
    email: "reply-command@tests.invalid",
    password: "isolated-password",
  });
  const actor = { id: u.id, email: u.email, siteRole: "user" as const };
  const np = await savePersona(db, actor, profiles);
  await submitOwnPersona(db, actor, np.id, np.revisionId);
  await moderatePersona(db, data.admin, np.revisionId, "approved", "");
  await historicalProvider(db, data.admin, data.ids["observation-room"]!, np.id);
  const d = await reviewWorkspaceDetail(db, actor, id, "replies", "en");
  assert.equal(d.submissionGuard, a.revisionId);
  assert.equal(d.submittedRevisionId, null);
  assert.ok(!JSON.stringify(d).includes("Former provider private submission"));
  const input = {
    requestId: randomUUID(),
    kind: "reply",
    reviewId: id,
    baseRevisionId: d.baseRevisionId,
    expectedSubmittedRevisionId: d.submissionGuard,
    expectedPersonaId: np.id,
    expectedPersonaRevisionId: np.revisionId,
    action: "draft",
    body: { sourceLocale: "en", texts: { en: "New provider draft" } },
  };
  const b = await saveReviewCommand(db, actor, input);
  assert.equal(
    (await replyDetail(db, data.admin, id)).reply.submitted_revision_id,
    a.revisionId,
  );
  const command = {
    ...input,
    requestId: randomUUID(),
    baseRevisionId: b.revisionId,
    action: "submit",
  };
  const results = await Promise.all([
    saveReviewCommand(db, actor, command),
    saveReviewCommand(db, actor, command),
  ]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].replacedRevisionId, a.revisionId);
  await assert.rejects(
    () => replyAction(db, data.admin, id, "publish", a.revisionId),
    (e: any) => e.code === "SUBMISSION_SUPERSEDED",
  );
  assert.ok(
    !JSON.stringify(await replyDetail(db, data.admin, id)).includes(
      "New provider draft",
    ),
  );
  await unpublishContent(
    db,
    data.admin,
    data.ids["observation-room"]!,
    false,
    "",
  );
  const history = (
    await reviewWorkspaceList(db, actor, {
      view: "replies",
      status: "readonly",
    })
  ).items.find((r: any) => r.id === id);
  assert.ok(history);
  assert.equal(history.entry_name, null);
  assert.equal(history.review_excerpt, null);
  assert.equal(history.reply_excerpt, "New provider draft");
  assert.equal(history.can_edit, false);
});

test("reply visibility events preserve submission and draft states across moderation, lists and home", async (t) => {
  for (const decision of ["publish", "reject"] as const)
    for (const newerDraft of [false, true]) {
      await t.test(
        `${decision} fixed A after hide/restore, newer draft: ${newerDraft}`,
        async (t) => {
          const f = await setup();
          t.after(f.cleanup);
          const { db, data, id } = f;
          const review = await saveReview(db, data.admin, id, f.base, body);
          await submitReview(db, data.admin, id, review.revisionId);
          await reviewRevision(
            db,
            data.admin,
            id,
            review.revisionId,
            "publish",
            "",
          );
          await historicalProvider(
            db,
            data.admin,
            data.ids["observation-room"]!,
            f.p.id,
          );
          const input = {
            sourceLocale: "en",
            texts: { en: "Public reply", "zh-CN": "公开回复" },
          };
          const p = await saveReply(db, data.admin, id, input, null);
          await replyAction(db, data.admin, id, "submit", p.revisionId);
          await replyAction(db, data.admin, id, "publish", p.revisionId);
          const publication = (await replyDetail(db, data.admin, id))
            .publications[0].id;
          const a = await saveReply(db, data.admin, id, input, p.revisionId);
          await replyAction(db, data.admin, id, "submit", a.revisionId);
          const b = newerDraft
            ? await saveReply(db, data.admin, id, input, a.revisionId)
            : null;
          const head = b?.revisionId ?? a.revisionId;
          await replyAction(db, data.admin, id, "hide", head);
          let detail = await replyDetail(db, data.admin, id);
          assert.equal(detail.reply.hidden, true);
          assert.equal(detail.reply.submitted_revision_id, a.revisionId);
          assert.equal(
            detail.revisions.find((r: any) => r.id === head).status,
            b ? "draft" : "submit",
          );
          assert.ok(detail.events.some((e: any) => e.action === "hide"));
          assert.equal(
            (await moderationQueue(db, data.admin)).items.find(
              (r: any) => r.id === id,
            ).reply_status,
            "submit",
          );
          const list = await reviewWorkspaceList(db, data.admin, {
            view: "replies",
            status: b ? "draft" : "submitted",
          });
          assert.ok(list.items.some((r: any) => r.id === id));
          if (b)
            assert.ok(
              JSON.stringify(
                await workspaceOverview(db, data.admin, { locale: "en" }),
              ).includes("reply:" + id + ":" + b.revisionId),
            );
          if (!b) await replyAction(db, data.admin, id, "submit", a.revisionId); // Same submission remains idempotent after hide.
          await replyAction(
            db,
            data.admin,
            id,
            "restore",
            head,
            "",
            publication,
          );
          detail = await replyDetail(db, data.admin, id);
          assert.equal(
            detail.revisions.find((r: any) => r.id === p.revisionId).status,
            "publish",
          );
          assert.equal(detail.reply.submitted_revision_id, a.revisionId);
          await replyAction(
            db,
            data.admin,
            id,
            decision,
            a.revisionId,
            "Only A",
          );
          detail = await replyDetail(db, data.admin, id);
          assert.equal(detail.reply.submitted_revision_id, null);
          assert.equal(detail.reply.head_revision_id, head);
          if (b) {
            assert.equal(
              detail.revisions.find((r: any) => r.id === b.revisionId).status,
              "draft",
            );
            await replyAction(db, data.admin, id, "submit", b.revisionId);
            await assert.rejects(
              () => replyAction(db, data.admin, id, "publish", a.revisionId),
              (e: any) => e.code === "SUBMISSION_SUPERSEDED",
            );
          }
        },
      );
    }
});
