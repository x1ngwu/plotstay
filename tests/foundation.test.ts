import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createContentSchema, editContentSchema, textSchema } from '@plotstay/contracts';
import { createContent, editContent, getPublished, listPublished, listWorlds, requireWorld,
  reviewRevision, restorePublication, submitRevision, unpublishContent, saveTranslation, digest } from '@plotstay/domain';
import { createApp } from '../apps/api/src/app.ts';
import { migrate } from '../packages/database/src/migrate.ts';
import { seed } from '../scripts/seed.ts';
import { fixture } from './helpers.ts';

test('PostgreSQL foundation and API boundaries', async t => {
  const f = await fixture();
  t.after(f.cleanup);
  const { db, data } = f;
  const app = await createApp(db, { webOrigin: 'http://localhost:4321' });
  t.after(() => app.close());
  const room = data.ids['observation-room'];
  const draft = data.ids['unpublished-room'];
  const missing = data.ids['missing-translation'];
  const input = (slug: string) => createContentSchema.parse({ worldId: data.latheId, placeId: data.forgePlace,
    kind: 'stay', slug, sourceLocale: 'en', text: { title: 'Draft A', description: 'Private content' },
    translations: { 'zh-CN': { title: '草稿 A', description: '私有内容' } }, attributes: { price: { amount: 88, unit: 'night' } } });
  const rejects = (fn: () => Promise<unknown>, code: string) => assert.rejects(fn, (error: any) => error.code === code);
  const adminCookie = async (actorId: string) => {
    const token = randomUUID();
    await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '1 hour')", [digest(token), actorId]);
    return `plotstay_session=${token}`;
  };

  await t.test('fresh migrations, repeated migrations and concurrent seeds preserve IDs and history', async () => {
    const counts = async () => (await db.query(`SELECT (SELECT count(*) FROM contents) AS contents,
      (SELECT count(*) FROM content_revisions) AS revisions, (SELECT count(*) FROM publications) AS publications,
      (SELECT count(*) FROM translations) AS translations, (SELECT count(*) FROM moderation_events) AS events,
      (SELECT count(*) FROM translation_jobs) AS jobs`)).rows[0];
    const before = await counts();
    const oldHash = (await db.query('SELECT password_hash FROM users WHERE id=$1', [data.admin.id])).rows[0].password_hash;
    await migrate(db);
    const repeated = await Promise.all([seed(db, f.credentials), seed(db, { ...f.credentials, password: randomUUID() })]);
    assert.deepEqual(repeated[0].ids, data.ids);
    assert.deepEqual(repeated[1].ids, data.ids);
    assert.deepEqual(await counts(), before);
    assert.equal((await db.query('SELECT password_hash FROM users WHERE id=$1', [data.admin.id])).rows[0].password_hash, oldHash);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, 11);
    await db.query("UPDATE schema_migrations SET checksum='tampered' WHERE name='002_history_guards.sql'");
    await assert.rejects(() => migrate(db), /Applied migration changed/);
  });

  await t.test('public API returns only published content, bilingual text and validated errors', async () => {
    assert.equal((await app.inject('/api/health')).statusCode, 200);
    const en = await app.inject('/api/contents?world=lathe-worlds&locale=en');
    assert.equal(en.statusCode, 200);
    assert.equal(en.headers['cache-control'], 'no-store');
    assert.equal(en.json().contents.length, 4);
    assert.equal((await app.inject(`/api/contents/${room}?locale=zh-CN`)).json().content.text.title, '观察室');
    assert.equal((await app.inject(`/api/contents/${draft}`)).statusCode, 404);
    assert.equal((await app.inject(`/api/contents/${missing}`)).statusCode, 404);
    assert.equal((await app.inject(`/api/contents/${room}?locale=de`)).statusCode, 404);
    assert.equal((await app.inject('/api/contents/not-a-uuid')).statusCode, 400);
    assert.equal((await app.inject('/api/contents?limit=-1')).statusCode, 400);
    assert.equal((await app.inject('/api/contents?kind=unknown')).statusCode, 400);
    assert.equal((await app.inject('/api/contents?locale=en&draft=true')).statusCode, 400);
    assert.equal((await app.inject('/api/contents?q=%25')).json().contents.length, 0);
    assert.equal((await app.inject('/api/contents?world=lathe-worlds&q=Observation')).json().contents.length, 1);
    assert.equal((await app.inject('/api/worlds/test-harbour/stay/observation-room')).statusCode, 404);
    const notes = (await app.inject(`/api/contents?parentId=${room}&locale=zh-CN`)).json().contents;
    assert.equal(notes.length, 1);
    assert.equal(notes[0].personaName, '旅客十七');
    assert.equal((await app.inject('/api/admin/worlds')).statusCode, 401);
  });

  await t.test('login cookies, origin checks, logout and world-scoped admin reads', async () => {
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', payload: f.credentials })).statusCode, 403);
    const bad = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: 'http://localhost:4321' }, payload: { ...f.credentials, password: 'wrong' } });
    assert.equal(bad.statusCode, 401);
    const signedIn = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: 'http://localhost:4321' }, payload: f.credentials });
    assert.equal(signedIn.statusCode, 200);
    const setCookie = String(signedIn.headers['set-cookie']);
    assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /SameSite=Strict/);
    assert.equal(signedIn.json().actor.siteRole, 'admin');
    assert.equal(signedIn.json().token, undefined);
    const cookie = setCookie.split(';')[0];
    assert.equal((await app.inject({ url: `/api/admin/contents/${draft}`, headers: { cookie } })).statusCode, 200);
    const ownerCookie = await adminCookie(data.owner.id);
    assert.equal((await app.inject({ url: `/api/admin/worlds/${data.latheId}/contents`, headers: { cookie: ownerCookie } })).statusCode, 200);
    assert.equal((await app.inject({ url: `/api/admin/worlds/${data.harbourId}/contents`, headers: { cookie: ownerCookie } })).statusCode, 403);
    assert.equal((await app.inject({ url: `/api/admin/contents/${data.ids['harbour-room']}`, headers: { cookie: ownerCookie } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { origin: 'http://localhost:4321', cookie } })).statusCode, 200);
    assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie } })).statusCode, 401);
    await db.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1", [data.owner.id]);
    assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie: ownerCookie } })).statusCode, 401);
  });

  await t.test('world and relationship permissions apply to writers and reviewers', async () => {
    await rejects(() => createContent(db, data.secondOwner, input('foreign-write')), 'WORLD_FORBIDDEN');
    await rejects(() => createContent(db, data.owner, { ...input('foreign-place'), placeId: data.harbourPlace }), 'INVALID_PLACE');
    await rejects(() => createContent(db, data.owner, { ...input('foreign-review'), kind: 'review', parentContentId: data.ids['harbour-room'], attributes: { images: [] } }), 'INVALID_PARENT');
    await assert.rejects(() => db.query('INSERT INTO contents(world_id,place_id,kind,slug,author_id) VALUES ($1,$2,$3,$4,$5)',
      [data.latheId, data.harbourPlace, 'stay', 'invalid-sql-place', data.owner.id]), (error: any) => error.code === '23503');
    await db.query('DELETE FROM world_members WHERE world_id=$1 AND user_id=$2', [data.latheId, data.owner.id]);
    await requireWorld(db, data.owner, data.latheId, true);
    const created = await createContent(db, data.editor, input('editor-draft'));
    await submitRevision(db, data.editor, created.id, created.revisionId);
    await rejects(() => reviewRevision(db, data.editor, created.id, created.revisionId, 'publish', ''), 'REVIEW_FORBIDDEN');
    await reviewRevision(db, data.owner, created.id, created.revisionId, 'publish', 'World owner review');
    assert.ok(await getPublished(db, 'en', { id: created.id }));
  });

  await t.test('missing required translations block publication', async () => {
    const revisionId = (await db.query('SELECT head_revision_id FROM contents WHERE id=$1', [missing])).rows[0].head_revision_id;
    await submitRevision(db, data.owner, missing, revisionId);
    await rejects(() => reviewRevision(db, data.owner, missing, revisionId, 'publish', ''), 'TRANSLATIONS_REQUIRED');
    assert.equal(await getPublished(db, 'en', { id: missing }), null);
  });

  await t.test('draft edits and concurrent conflicts cannot change published snapshots; restore keeps history', async () => {
    const before = (await getPublished(db, 'en', { id: room }))!;
    const oldHead = (await db.query('SELECT head_revision_id FROM contents WHERE id=$1', [room])).rows[0].head_revision_id;
    const edit = editContentSchema.parse({ baseRevisionId: oldHead, sourceLocale: 'en',
      text: { ...before.text, title: 'Updated Room' }, attributes: before.attributes,
      translations: { 'zh-CN': { ...before.text, title: '新版客房' } } });
    const results = await Promise.allSettled([editContent(db, data.owner, room, edit), editContent(db, data.editor, room, edit)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.code, 'REVISION_CONFLICT');
    const next = (results.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ revisionId: string }>).value;
    assert.deepEqual(await getPublished(db, 'en', { id: room }), before);
    await submitRevision(db, data.owner, room, next.revisionId);
    await rejects(() => saveTranslation(db, data.owner, room, next.revisionId, 'zh-CN', textSchema.parse({ title: 'Unreviewed', description: 'Must not mutate submitted text' })), 'REVISION_LOCKED');
    await reviewRevision(db, data.owner, room, next.revisionId, 'publish', 'Verified update');
    assert.equal((await getPublished(db, 'en', { id: room }))!.text.title, 'Updated Room');
    await assert.rejects(() => db.query("UPDATE content_revisions SET source_text='{}' WHERE id=$1", [oldHead]), /immutable/);
    await assert.rejects(() => db.query('DELETE FROM content_revisions WHERE id=$1', [oldHead]), /immutable/);
    await assert.rejects(() => db.query('UPDATE contents SET world_id=$2 WHERE id=$1', [room, data.harbourId]), /immutable/);
    await assert.rejects(() => db.query("UPDATE translations SET body='{}' WHERE revision_id=$1", [oldHead]), /immutable/);
    await restorePublication(db, data.owner, room, before.publicationId);
    const restored = (await getPublished(db, 'en', { id: room }))!;
    assert.equal(restored.text.title, before.text.title);
    assert.notEqual(restored.publicationId, before.publicationId);
    const headBeforeSeed = (await db.query('SELECT head_revision_id FROM contents WHERE id=$1', [room])).rows[0].head_revision_id;
    await seed(db, f.credentials);
    assert.deepEqual(await getPublished(db, 'en', { id: room }), restored);
    assert.equal((await db.query('SELECT head_revision_id FROM contents WHERE id=$1', [room])).rows[0].head_revision_id, headBeforeSeed);
  });

  await t.test('third language falls back only to the published source, never draft translations', async () => {
    await db.query("INSERT INTO locales(code,name) VALUES ('de','Deutsch')");
    const original = (await getPublished(db, 'en', { id: room }))!;
    const head = (await db.query('SELECT head_revision_id FROM contents WHERE id=$1', [room])).rows[0].head_revision_id;
    const next = await editContent(db, data.owner, room, editContentSchema.parse({ baseRevisionId: head, sourceLocale: 'en', text: original.text,
      attributes: original.attributes, translations: { de: { title: 'PRIVATE GERMAN DRAFT', description: 'Never published' } } }));
    const fallback = (await getPublished(db, 'de', { id: room }))!;
    assert.equal(fallback.locale, 'en'); assert.equal(fallback.requestedLocale, 'de'); assert.equal(fallback.isFallback, true);
    assert.deepEqual(fallback.text, original.text);
    assert.equal((await listWorlds(db, 'de'))[0].locale, 'en');
    assert.equal((await db.query('SELECT status FROM translation_jobs WHERE revision_id=$1', [next.revisionId])).rows[0].status, 'pending');
  });

  await t.test('site restrictions and hidden worlds suppress lists, details and child reviews', async () => {
    const before = (await getPublished(db, 'en', { id: room }))!;
    await unpublishContent(db, data.admin, room, true, 'Site restriction');
    assert.equal(await getPublished(db, 'en', { id: room }), null);
    assert.equal((await listPublished(db, 'en', { parentId: room })).length, 0);
    await rejects(() => restorePublication(db, data.owner, room, before.publicationId), 'SITE_BLOCKED');
    await db.query('UPDATE worlds SET site_blocked=true WHERE id=$1', [data.harbourId]);
    assert.equal((await listWorlds(db, 'en')).length, 1);
    assert.equal((await listPublished(db, 'en', { world: 'test-harbour' })).length, 0);
    assert.equal(await getPublished(db, 'en', { id: data.ids['harbour-room'] }), null);
    await db.query('UPDATE worlds SET visible=false WHERE id=$1', [data.latheId]);
    assert.equal((await listPublished(db, 'en')).length, 0);
    assert.equal((await listWorlds(db, 'en')).length, 0);
  });
});
