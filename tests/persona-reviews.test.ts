import {reviewRevision,replyAction} from './moderation-fixtures.ts';
import {historicalProvider} from './work-fixtures.ts';
import {createFixtureContent as createContent} from './work-fixtures.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.ts';
import { createApp } from '../apps/api/src/app.ts';
import {
  savePersona,
  submitOwnPersona,
  personaQueue,
  startReview,
  saveReview,
  submitReview,
  reviewDetail,
  myPersonas,
  moderatePersona,
  publishedDetail,
  getPublished,
  restorePublication,
  createAccount,
  disablePersona,
  adminWorlds,
} from '@plotstay/domain';
export const profiles = {
  en: { name: 'Moss', bio: 'A wandering archivist.', avatar: 'mint' },
  'zh-CN': { name: '苔', bio: '漫游的档案员。', avatar: 'mint' },
};
export const body = {
  sourceLocale: 'en',
  texts: {
    en: { title: 'A quiet night', description: 'Written freely, without any booking.' },
    'zh-CN': { title: '安静的一夜', description: '无需预订的角色创作。' },
  },
  rating: 4,
};
const rejected = (fn: () => Promise<unknown>, code: string) =>
  assert.rejects(fn, (e: any) => e.code === code);
test('persona draft and fixed submission remain separate until a newer submission replaces it', async t=>{
  const f=await fixture();t.after(f.cleanup);const {db,data}=f;
  const u=await createAccount(db,data.admin,{email:'persona-submit@tests.invalid',password:'test-password-123'});
  const actor={id:u.id,email:u.email,siteRole:'user' as const};
  const a=await savePersona(db,actor,profiles);
  await submitOwnPersona(db,actor,a.id,a.revisionId);
  await submitOwnPersona(db,actor,a.id,a.revisionId);
  const b=await savePersona(db,actor,{...profiles,en:{...profiles.en,name:'New draft'}},a.id,a.revisionId);
  const state=(await myPersonas(db,actor))[0];assert.equal(state.submitted_revision_id,a.revisionId);assert.equal(state.head_revision_id,b.revisionId);
  assert.equal((await personaQueue(db,data.admin)).items.length,1);
  await moderatePersona(db,data.admin,a.revisionId,'approved','First profile approved');
  assert.equal((await myPersonas(db,actor))[0].published.en.name,'Moss');
  await submitOwnPersona(db,actor,a.id,b.revisionId);
  const c=await savePersona(db,actor,{...profiles,en:{...profiles.en,name:'Latest draft'}},a.id,b.revisionId);
  await submitOwnPersona(db,actor,a.id,c.revisionId);
  await rejected(()=>moderatePersona(db,data.admin,b.revisionId,'approved','Stale'), 'SUBMISSION_SUPERSEDED');
  await moderatePersona(db,data.admin,c.revisionId,'approved','Current');
  assert.equal((await myPersonas(db,actor))[0].published.en.name,'Latest draft');
});
test('phase 5.6 personas and accommodation review checkpoint', async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const { db, data } = f;
  const u = await createAccount(db, data.admin, {
      email: 'ordinary@tests.invalid',
      password: 'test-password-123',
    }),
    v = await createAccount(db, data.admin, { email: 'other@tests.invalid', password: 'test-password-123' });
  const actor = { id: u.id, email: u.email, siteRole: 'user' as const },
    other = { id: v.id, email: v.email, siteRole: 'user' as const };
  const p = await savePersona(db, actor, profiles),
    p2 = await savePersona(db, other, profiles);
  let id: string, rev: string, firstPublication: string;
  const detail = () =>
    publishedDetail(db, 'en', { world: 'lathe-worlds', kind: 'stay', slug: 'observation-room' });
  const before = await detail();
  await t.test(
    'ordinary accounts have no world privileges; persona ownership and concurrent identity enforced',
    async () => {
      assert.deepEqual(await adminWorlds(db, actor), []);
      await rejected(() => startReview(db, actor, data.ids['observation-room']!, p2.id), 'PERSONA_FORBIDDEN');
      const results = await Promise.all(
        Array.from({ length: 8 }, () => startReview(db, actor, data.ids['observation-room']!, p.id)),
      );
      assert.equal(new Set(results.map((r) => r.id)).size, 1);
      assert.equal(results.filter((r) => r.created).length, 1);
      id = results[0]!.id;
      await rejected(() => reviewDetail(db, other, id), 'REVIEW_FORBIDDEN');
      assert.equal(await getPublished(db, 'en', { id }), null);
      assert.equal((await detail()).reviews.total, before.reviews.total);
      const saved = await saveReview(
        db,
        actor,
        id,
        (await reviewDetail(db, actor, id)).revisions[0].id,
        body,
      );
      rev = saved.revisionId;
      await rejected(() => saveReview(db, actor, id, results[0]!.id, body), 'REVISION_CONFLICT');
    },
  );
  await t.test('fixed profile + review submission, site/world approval split and publication', async () => {
    await submitReview(db, actor, id, rev);
    await rejected(
      () => reviewRevision(db, data.owner, id, rev, 'publish', 'world only'),
      'PERSONA_APPROVAL_REQUIRED',
    );
    await rejected(
      () => moderatePersona(db, data.owner, p.revisionId, 'approved', ''),
      'SITE_ADMIN_REQUIRED',
    );
    await savePersona(
      db,
      actor,
      { ...profiles, en: { ...profiles.en, name: 'Later name', avatar: 'violet' } },
      p.id,
      p.revisionId,
    );
    const published = await reviewRevision(db, data.admin, id, rev, 'publish', 'Joint approval');
    firstPublication = published.publicationId!;
    const pub = await getPublished(db, 'en', { id });
    assert.equal(pub!.text.review!.name, 'Moss');
    assert.ok(pub!.signature!.avatarImage?.startsWith('data:image/svg+xml;base64,'));
    assert.equal((await detail()).reviewSummary.rating, 4.5);
    assert.equal((await detail()).reviews.total, before.reviews.total + 1);
  });
  await t.test(
    'editing, returning, republishing and restoring count one score with immutable signature',
    async () => {
      const old = await getPublished(db, 'en', { id });
      const edit = await saveReview(db, actor, id, rev, { ...body, rating: 2 });
      assert.deepEqual(await getPublished(db, 'en', { id }), old);
      await submitReview(db, actor, id, edit.revisionId);
      await reviewRevision(db, data.admin, id, edit.revisionId, 'reject', 'Expand the story');
      assert.deepEqual(await getPublished(db, 'en', { id }), old);
      const retry = await saveReview(db, actor, id, edit.revisionId, { ...body, rating: 3 });
      await submitReview(db, actor, id, retry.revisionId);
      await reviewRevision(db, data.admin, id, retry.revisionId, 'publish', '');
      assert.equal((await detail()).reviewSummary.rating, 4);
      assert.equal((await getPublished(db, 'en', { id }))!.signature!.name, 'Later name');
      assert.equal((await detail()).reviews.total, before.reviews.total + 1);
      await restorePublication(db, data.owner, id, firstPublication);
      assert.equal((await detail()).reviewSummary.rating, 4.5);
      assert.equal((await getPublished(db, 'en', { id }))!.signature!.name, 'Moss');
      await assert.rejects(
        () => db.query("UPDATE review_signatures SET profiles='{}' WHERE revision_id=$1", [rev]),
        /immutable/,
      );
    },
  );
  await t.test(
    'cross-world persona reuse, disabled speaking, and guest/session/origin isolation',
    async () => {
      const otherWorld = (await db.query("SELECT id FROM contents WHERE slug='harbour-room'")).rows[0].id;
      const cross = await startReview(db, actor, otherWorld, p.id);
      assert.ok(cross.created);
      await rejected(() => reviewDetail(db, data.owner, cross.id, true), 'WORLD_FORBIDDEN');
      await disablePersona(db, data.admin, p.id, true);
      await rejected(
        async () => saveReview(db, actor, id, (await reviewDetail(db, actor, id)).revisions[0].id, body),
        'PERSONA_DISABLED',
      );
      assert.ok(await getPublished(db, 'en', { id }));
      await disablePersona(db, data.admin, p.id, false);
      const app = await createApp(db);
      t.after(() => app.close());
      assert.equal((await app.inject({ url: '/api/me/personas' })).statusCode, 401);
      const guest = await app.inject({
        method: 'POST',
        url: '/api/guest',
        headers: { origin: 'http://localhost:4321' },
        payload: {},
      });
      assert.equal(
        (
          await app.inject({
            url: '/api/me/personas',
            headers: { cookie: guest.headers['set-cookie'] as string },
          })
        ).statusCode,
        401,
      );
      assert.equal(
        (await app.inject({ method: 'POST', url: '/api/me/personas', payload: { profiles } })).statusCode,
        403,
      );
      assert.equal((await myPersonas(db, other)).length, 1);
    },
  );
});

test('phase 5.6 provider replies and all entry types', async (t) => {
  const {
    bindProvider,
    saveReply,
      replyDetail,
    providerInbox,
    unpublishContent,
    createContentSchema,
    submitRevision,
  } = await (async () => ({
    ...(await import('@plotstay/domain')),
    ...(await import('@plotstay/contracts')),
  }))();
  const f = await fixture();
  t.after(f.cleanup);
  const { db, data } = f;
  const account = await createAccount(db, data.admin, {
      email: 'reviewer@tests.invalid',
      password: 'test-password-123',
    }),
    provider = await createAccount(db, data.admin, {
      email: 'provider@tests.invalid',
      password: 'test-password-123',
    });
  const author = { id: account.id, email: account.email, siteRole: 'user' as const },
    host = { id: provider.id, email: provider.email, siteRole: 'user' as const };
  const p = await savePersona(db, author, profiles),
    hp = await savePersona(db, host, {
      ...profiles,
      en: { ...profiles.en, name: 'Host Moss' },
      'zh-CN': { ...profiles['zh-CN'], name: '房东苔' },
    });
  // Approve the provider through their own free review, not by granting world privileges.
  const providerReview = await startReview(db, host, data.ids['observation-room']!, hp.id);
  const pr = await saveReview(
    db,
    host,
    providerReview.id,
    (await reviewDetail(db, host, providerReview.id)).revisions[0].id,
    body,
  );
  await submitReview(db, host, providerReview.id, pr.revisionId);
  await reviewRevision(db, data.admin, providerReview.id, pr.revisionId, 'publish', '');
  for (const kind of ['stay', 'experience', 'service'] as const) {
    await t.test(kind + ' reply ownership, approval, edits, recovery and parent visibility', async () => {
      const input = createContentSchema.parse({
        kind,
        worldId: data.latheId,
        slug: 'persona-' + kind,
        sourceLocale: 'en',
        text: { title: 'Persona ' + kind, description: 'Testing' },
        translations: { 'zh-CN': { title: '角色' + kind, description: '测试' } },
        attributes: {
          price: {
            amount: 10,
            unit: kind === 'stay' ? 'night' : kind === 'experience' ? 'person' : 'session',
          },
          ...(kind !== 'stay' ? { durationMinutes: 30 } : {}),
        },
      });
      const target = await createContent(db, data.owner, input);
      await submitRevision(db, data.owner, target.id, target.revisionId);
      await reviewRevision(db, data.owner, target.id, target.revisionId, 'publish', '');
      const c = await startReview(db, author, target.id, p.id);
      const r = await saveReview(
        db,
        author,
        c.id,
        (await reviewDetail(db, author, c.id)).revisions[0].id,
        body,
      );
      await submitReview(db, author, c.id, r.revisionId);
      await reviewRevision(db, data.admin, c.id, r.revisionId, 'publish', '');
      await rejected(() => historicalProvider(db, author, target.id, hp.id), 'WORLD_FORBIDDEN');
      await historicalProvider(db, data.admin, target.id, hp.id);
      await rejected(
        () =>
          saveReply(db, author, c.id, { sourceLocale: 'en', texts: { en: 'Forged', 'zh-CN': '冒用' } }, null),
        'PROVIDER_FORBIDDEN',
      );
      await rejected(
        () =>
          saveReply(
            db,
            data.owner,
            c.id,
            { sourceLocale: 'en', texts: { en: 'Editor', 'zh-CN': '编辑' } },
            null,
          ),
        'PROVIDER_FORBIDDEN',
      );
      const inputReply = {
        sourceLocale: 'en',
        texts: { en: 'Thank you for visiting.', 'zh-CN': '欢迎到访。' },
      };
      const race = await Promise.allSettled(
        Array.from({ length: 6 }, () => saveReply(db, host, c.id, inputReply, null)),
      );
      assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal((await db.query('SELECT * FROM review_replies WHERE review_id=$1', [c.id])).rowCount, 1);
      const draft = await replyDetail(db, host, c.id);
      const rid = draft.revisions[0].id;
      await rejected(() => replyDetail(db, author, c.id), 'PROVIDER_FORBIDDEN');
      await rejected(() => replyAction(db, host, c.id, 'publish', rid), 'WORLD_FORBIDDEN');
      await replyAction(db, host, c.id, 'submit', rid);
      await replyAction(db, data.owner, c.id, 'publish', rid);
      const publicDetail = () => publishedDetail(db, 'en', { world: 'lathe-worlds', kind, slug: input.slug });
      let pub = await publicDetail();
      assert.equal(pub.reviewSummary.rating, 4);
      assert.equal(pub.reviews.contents[0]!.reply!.name, 'Host Moss');
      const first = (await replyDetail(db, host, c.id)).publications[0].id;
      const edited = await saveReply(
        db,
        host,
        c.id,
        { ...inputReply, texts: { en: 'Revised reply', 'zh-CN': '修改回复' } },
        rid,
      );
      assert.equal((await publicDetail()).reviews.contents[0]!.reply!.body, 'Thank you for visiting.');
      await replyAction(db, host, c.id, 'submit', edited.revisionId);
      await replyAction(db, data.owner, c.id, 'reject', edited.revisionId, 'Please expand');
      assert.equal((await publicDetail()).reviewSummary.rating, 4);
      const next = await saveReply(
        db,
        host,
        c.id,
        { ...inputReply, texts: { en: 'An expanded reply', 'zh-CN': '完整回复' } },
        edited.revisionId,
      );
      await replyAction(db, host, c.id, 'submit', next.revisionId);
      await replyAction(db, data.owner, c.id, 'publish', next.revisionId);
      assert.equal((await publicDetail()).reviews.contents[0]!.reply!.body, 'An expanded reply');
      await replyAction(db, data.owner, c.id, 'restore', next.revisionId, '', first);
      assert.equal((await publicDetail()).reviews.contents[0]!.reply!.body, 'Thank you for visiting.');
      await replyAction(db, data.owner, c.id, 'hide', next.revisionId);
      assert.equal((await publicDetail()).reviews.contents[0]!.reply, undefined);
      await replyAction(db, data.owner, c.id, 'restore', next.revisionId, '', first);
      const old = (await getPublished(db, 'en', { id: c.id }))!.publicationId;
      await unpublishContent(db, data.owner, c.id, false, 'Hidden');
      assert.equal((await publicDetail()).reviews.total, 0);
      assert.equal((await replyDetail(db,host,c.id)).canEdit,false); // Own history survives unpublication, context does not.
      await restorePublication(db, data.owner, c.id, old);
      assert.equal((await publicDetail()).reviews.contents[0]!.reply!.name, 'Host Moss');
      await assert.rejects(
        () => db.query("UPDATE reply_revisions SET body='{}' WHERE id=$1", [rid]),
        /immutable/,
      );
    });
  }
  await t.test(
    'provider name/avatar changes preserve published replies and ownership remains independent',
    async () => {
      const old = await providerInbox(db, host);
      assert.equal(old.items.length, 3);
      await savePersona(
        db,
        host,
        { ...profiles, en: { ...profiles.en, name: 'Changed Host', avatar: 'sky' } },
        hp.id,
        (await myPersonas(db, host))[0].head_revision_id,
      );
      const detail = await replyDetail(db, host, old.items[0].id);
      const r = await saveReply(
        db,
        host,
        old.items[0].id,
        { sourceLocale: 'en', texts: { en: 'New identity', 'zh-CN': '新身份' } },
        detail.revisions[0].id,
      );
      await replyAction(db, host, old.items[0].id, 'submit', r.revisionId);
      await rejected(
        () => replyAction(db, data.owner, old.items[0].id, 'publish', r.revisionId),
        'PERSONA_APPROVAL_REQUIRED',
      );
      await replyAction(db, data.admin, old.items[0].id, 'publish', r.revisionId);
      const d = await publishedDetail(db, 'en', {
        world: 'lathe-worlds',
        kind: old.items[0].target_kind,
        slug: old.items[0].target_slug,
      });
      assert.equal(d.reviews.contents[0]!.reply!.name, 'Changed Host');
      assert.equal(d.reviewSummary.rating, 4);
    },
  );
});

test('phase 5.6 missing languages, rejected profiles, immutable submissions and shared editor authority', async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const { db, data } = f;
  const account = await createAccount(db, data.admin, {
      email: 'branch@tests.invalid',
      password: 'test-password-123',
    }),
    actor = { id: account.id, email: account.email, siteRole: 'user' as const };
  const p = await savePersona(db, actor, { en: profiles.en });
  const c = await startReview(db, actor, data.ids['observation-room']!, p.id);
  const r = await saveReview(db, actor, c.id, (await reviewDetail(db, actor, c.id)).revisions[0].id, body);
  await submitReview(db, actor, c.id, r.revisionId);
  await rejected(
    () => reviewRevision(db, data.admin, c.id, r.revisionId, 'publish', ''),
    'TRANSLATIONS_REQUIRED',
  );
  assert.equal(
    (await db.query('SELECT * FROM persona_revision_decisions WHERE revision_id=$1', [p.revisionId]))
      .rowCount,
    0,
  );
  await moderatePersona(db, data.admin, p.revisionId, 'rejected', 'Add Chinese');
  const newPersona = await savePersona(db, actor, profiles, p.id, p.revisionId);
  await rejected(
    () => reviewRevision(db, data.admin, c.id, r.revisionId, 'publish', ''),
    'PERSONA_APPROVAL_REQUIRED',
  );
  const next = await saveReview(db, actor, c.id, r.revisionId, { ...body, texts: { en: body.texts.en } });
  await submitReview(db, actor, c.id, next.revisionId);
  await rejected(
    () => reviewRevision(db, data.admin, c.id, next.revisionId, 'publish', ''),
    'TRANSLATIONS_REQUIRED',
  );
  assert.equal(
    (await db.query('SELECT * FROM persona_revision_decisions WHERE revision_id=$1', [newPersona.revisionId]))
      .rowCount,
    0,
  );
  const { saveTranslation, textSchema, saveSetting, settingAction, settingDetail } = await (async () => ({
    ...(await import('@plotstay/domain')),
    ...(await import('@plotstay/contracts')),
  }))();
  await rejected(
    () =>
      saveTranslation(db, data.owner, c.id, next.revisionId, 'zh-CN', textSchema.parse(body.texts['zh-CN'])),
    'PERSONA_EDITOR_REQUIRED',
  );
  const full = await saveReview(db, actor, c.id, next.revisionId, body);
  await submitReview(db, actor, c.id, full.revisionId);
  const changed = await saveReview(db, actor, c.id, full.revisionId, { ...body, rating: 1 });
  // C12: a later draft no longer revokes the explicitly submitted fixed version.
  await reviewRevision(db, data.admin, c.id, full.revisionId, 'publish', '');
  assert.equal((await reviewDetail(db,actor,c.id)).content.head_revision_id,changed.revisionId);
  await submitReview(db, actor, c.id, changed.revisionId);
  await reviewRevision(db, data.admin, c.id, changed.revisionId, 'publish', '');
  const setting = (await myPersonas(db, actor))[0];
  const edit = await saveSetting(
    db,
    actor,
    setting.setting_id,
    { ...profiles, en: { ...profiles.en, name: 'Shared profile' } },
    setting.head_revision_id,
  );
  await settingAction(db, actor, setting.setting_id, 'submit', edit.revisionId);
  await rejected(
    () => settingAction(db, actor, setting.setting_id, 'publish', edit.revisionId),
    'SITE_ADMIN_REQUIRED',
  );
  await settingAction(db, data.admin, setting.setting_id, 'publish', edit.revisionId);
  assert.equal((await myPersonas(db, actor))[0].draft.en.name, 'Shared profile');
  assert.equal((await getPublished(db, 'en', { id: c.id }))!.signature!.name, 'Moss');
  await db.query("INSERT INTO locales(code,name)VALUES('de','Deutsch')");
  const fallback = await publishedDetail(db, 'de', {
    world: 'lathe-worlds',
    kind: 'stay',
    slug: 'observation-room',
  });
  assert.ok(fallback.reviews.contents.find((r) => r.id === c.id)!.isFallback);
  assert.equal(fallback.reviews.contents.find((r) => r.id === c.id)!.signature!.name, 'Moss');
});

test('phase 5.6 duplicate legacy identities abort upgrade without rewriting history', async (t) => {
  const { migrate } = await import('../packages/database/src/migrate.ts');
  const { historyDigest } = await import('./helpers.ts');
  const f = await fixture(true);
  t.after(f.cleanup);
  await f.db.query(
    "INSERT INTO contents(world_id,kind,slug,parent_content_id,persona_id,author_id)SELECT world_id,kind,'duplicate-legacy',parent_content_id,persona_id,author_id FROM contents WHERE kind='review' LIMIT 1",
  );
  const before = await historyDigest(f.db);
  await assert.rejects(() => migrate(f.db), /Duplicate legacy persona reviews/);
  assert.deepEqual(await historyDigest(f.db), before);
  assert.equal((await f.db.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n, 3);
});

test('phase 5.6 multiple personas, self-authored reviews, shared previews and receipt preservation', async (t) => {
  const {
    createGuest,
    quoteBooking,
    createBooking,
    getReceipt,
    bindProvider,
    previewDetail,
    adminDetail,
    settingDetail,
    myReviews,
  } = await import('@plotstay/domain');
  const { randomUUID } = await import('node:crypto');
  const f = await fixture();
  t.after(f.cleanup);
  const { db, data } = f;
  const ps = [];
  for (const email of ['many-a@tests.invalid', 'many-b@tests.invalid']) {
    const u = await createAccount(db, data.admin, { email, password: 'test-password-123' }),
      a = { id: u.id, email, siteRole: 'user' as const };
    for (let i = 0; i < 2; i++)
      ps.push({
        a,
        p: await savePersona(db, a, { ...profiles, en: { ...profiles.en, name: email + '-' + i } }),
      });
    assert.equal((await myPersonas(db, a)).length, 2);
  }
  for (const { a, p } of ps) {
    const r = await startReview(db, a, data.ids['observation-room']!, p.id);
    const rev = await saveReview(db, a, r.id, (await reviewDetail(db, a, r.id)).revisions[0].id, body);
    await submitReview(db, a, r.id, rev.revisionId);
    await reviewRevision(db, data.admin, r.id, rev.revisionId, 'publish', '');
  }
  assert.equal(
    (await publishedDetail(db, 'en', { world: 'lathe-worlds', kind: 'stay', slug: 'observation-room' }))
      .reviewSummary.ratedCount,
    5,
  );
  assert.equal((await myReviews(db, ps[0]!.a)).total, 2);
  const self = await savePersona(db, data.owner, profiles),
    r = await startReview(db, data.owner, data.ids['observation-room']!, self.id);
  assert.ok(r.created);
  const rev = await saveReview(
    db,
    data.owner,
    r.id,
    (await reviewDetail(db, data.owner, r.id)).revisions[0].id,
    body,
  );
  await submitReview(db, data.owner, r.id, rev.revisionId);
  await reviewRevision(db, data.admin, r.id, rev.revisionId, 'publish', 'Self-authored entry allowed');
  const guest = await createGuest(db),
    owner = { guestId: guest.id },
    day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const input = {
    contentId: data.ids['observation-room']!,
    locale: 'en',
    trip: { kind: 'stay' as const, start: day(4), end: day(5), guests: 1, rooms: 1 },
  };
  const quote = await quoteBooking(db, input);
  const receipt = (
    await createBooking(db, owner, { ...input, quoteHash: quote.quoteHash, idempotencyKey: randomUUID() })
  ).receipt;
  await historicalProvider(db, data.owner, input.contentId, self.id);
  const c = await adminDetail(db, data.owner, input.contentId);
  const preview = await previewDetail(
    db,
    data.owner,
    input.contentId,
    c.content.head_revision_id,
    c.content.draft_token,
    'en',
  );
  assert.equal(preview.content.provider!.name, 'Moss');
  assert.equal(preview.content.text.hostName, 'Moss');
  assert.ok(preview.content.provider!.avatarImage);
  const p = (await myPersonas(db, data.owner)).find((p) => p.id === self.id);
  assert.ok(
    (await settingDetail(db, data.owner, p.setting_id)).impacts.some((c) => c.id === input.contentId),
  );
  assert.deepEqual(await getReceipt(db, owner, receipt.id), receipt);
});

test('phase 5.6 private review pagination keeps every identity without exposing another account', async (t) => {
  const { myReviews } = await import('@plotstay/domain');
  const f = await fixture();
  t.after(f.cleanup);
  const { db, data } = f;
  const u = await createAccount(db, data.admin, {
      email: 'pages@tests.invalid',
      password: 'test-password-123',
    }),
    a = { id: u.id, email: u.email, siteRole: 'user' as const };
  const ids: string[] = [];
  for (let i = 0; i < 22; i++) {
    const p = await savePersona(db, a, { en: { ...profiles.en, name: 'Page ' + i } });
    ids.push((await startReview(db, a, data.ids['observation-room']!, p.id)).id);
  }
  const first = await myReviews(db, a, 1),
    second = await myReviews(db, a, 2);
  assert.equal(first.total, 22);
  assert.equal(first.pages, 2);
  assert.equal(first.items.length, 20);
  assert.equal(second.items.length, 2);
  assert.deepEqual(new Set([...first.items, ...second.items].map((r) => r.id)), new Set(ids));
  assert.ok((await myReviews(db, data.owner)).items.every((r: any) => !ids.includes(r.id)));
});

test('superseded cross-entry profile submission cannot publish until signature is refreshed', async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const { db, data } = f;
  const u = await createAccount(db, data.admin, {
      email: 'versions@tests.invalid',
      password: 'test-password-123',
    }),
    a = { id: u.id, email: u.email, siteRole: 'user' as const };
  const p = await savePersona(db, a, profiles);
  const old = await startReview(db, a, data.ids['observation-room']!, p.id);
  const oldVersion = await saveReview(
    db,
    a,
    old.id,
    (await reviewDetail(db, a, old.id)).revisions[0].id,
    body,
  );
  await submitReview(db, a, old.id, oldVersion.revisionId);
  await savePersona(
    db,
    a,
    { ...profiles, en: { ...profiles.en, name: 'Newer approved name', avatar: 'sky' } },
    p.id,
    p.revisionId,
  );
  const newer = await startReview(db, a, data.ids['signal-listening']!, p.id);
  const newVersion = await saveReview(
    db,
    a,
    newer.id,
    (await reviewDetail(db, a, newer.id)).revisions[0].id,
    body,
  );
  await submitReview(db, a, newer.id, newVersion.revisionId);
  await reviewRevision(db, data.admin, newer.id, newVersion.revisionId, 'publish', 'Newer first');
  await rejected(() => reviewRevision(db, data.admin, old.id, oldVersion.revisionId, 'publish', 'Old signature'), 'SUBMISSION_SUPERSEDED');
  const refreshed = await saveReview(db, a, old.id, oldVersion.revisionId, body);
  await submitReview(db, a, old.id, refreshed.revisionId);
  await reviewRevision(db, data.admin, old.id, refreshed.revisionId, 'publish', 'Updated signature');
  assert.equal((await myPersonas(db, a))[0].published.en.name, 'Newer approved name');
  assert.equal((await getPublished(db, 'en', { id: old.id }))!.signature!.name, 'Newer approved name');
  assert.equal((await getPublished(db, 'en', { id: newer.id }))!.signature!.name, 'Newer approved name');
});
