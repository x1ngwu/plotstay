import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/src/app.ts';
import { fixture } from './helpers.ts';
import { digest } from '@plotstay/domain';

test('content management HTTP workflows', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const app = await createApp(f.db, { webOrigin: 'http://localhost:4321' }); t.after(() => app.close());
  const cookie = async (userId: string) => {
    const token = randomUUID(); await f.db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '1 hour')", [digest(token), userId]);
    return `plotstay_session=${token}`;
  };
  const ownerCookie = await cookie(f.data.owner.id), editorCookie = await cookie(f.data.editor.id), foreignCookie = await cookie(f.data.secondOwner.id), adminCookie = await cookie(f.data.admin.id);
  const post = (path: string, payload: Record<string, unknown>, token = ownerCookie) => app.inject({ method: 'POST', url: '/api/admin' + path,
    headers: { origin: 'http://localhost:4321', cookie: token }, payload });
  const read = async (id: string) => (await app.inject({ url: '/api/admin/contents/' + id, headers: { cookie: ownerCookie } })).json();
  const input = (slug: string) => ({ worldId: f.data.latheId, kind: 'stay', slug, sourceLocale: 'en',
    text: { title: 'Management source', description: 'English source' }, translations: { 'zh-CN': { title: '管理中文', description: '中文说明' } },
    attributes: { price: { amount: 10, unit: 'night' } } });
  let id: string, oldPublication: string;
  await t.test('authenticated create, save, conflict, review, reject and publish', async () => {
    assert.equal((await post('/contents', input('unauthorized'), '')).statusCode, 401);
    assert.equal((await post('/contents', input('wrong-world'), foreignCookie)).statusCode, 403);
    const response = await post('/contents', input('managed-room'), editorCookie);
    assert.equal(response.statusCode, 201); id = response.json().id;
    assert.equal((await post('/contents', input('managed-room'))).statusCode, 409);
    let detail = await read(id);
    const revision = detail.revisions[0];
    const edit = { baseRevisionId: revision.id, baseDraftToken: detail.content.draft_token, sourceLocale: 'en', text: { ...revision.source_text, title: 'Revision two' }, attributes: revision.attributes, translations: { 'zh-CN': revision.translations['zh-CN'] } };
    assert.equal((await post(`/contents/${id}/revisions`, edit)).statusCode, 200);
    assert.equal((await post(`/contents/${id}/revisions`, edit)).json().error.code, 'REVISION_CONFLICT');
    detail = await read(id);
    assert.equal((await post(`/contents/${id}/submit`, { revisionId: detail.content.head_revision_id }, editorCookie)).statusCode, 200);
    assert.equal((await post(`/contents/${id}/review`, { revisionId: detail.content.head_revision_id, decision: 'publish' }, editorCookie)).statusCode, 403);
    assert.equal((await post(`/contents/${id}/review`, { revisionId: detail.content.head_revision_id, decision: 'reject', note: 'Revise wording' })).statusCode, 200);
    assert.equal((await app.inject(`/api/contents/${id}`)).statusCode, 404);
    assert.equal((await post(`/contents/${id}/submit`, { revisionId: detail.content.head_revision_id })).statusCode, 200);
    const published = await post(`/contents/${id}/review`, { revisionId: detail.content.head_revision_id, decision: 'publish' });
    assert.equal(published.statusCode, 200); oldPublication = published.json().publicationId;
    assert.equal((await app.inject(`/api/contents/${id}?locale=zh-CN`)).json().content.text.title, '管理中文');
  });
  await t.test('manual translation updates invalidate a stale source editor token', async () => {
    let detail = await read(id);
    const revision = detail.revisions[0];
    await post(`/contents/${id}/revisions`, { baseRevisionId: revision.id, baseDraftToken: detail.content.draft_token,
      sourceLocale: 'en', text: revision.source_text, attributes: revision.attributes, translations: {} });
    detail = await read(id);
    const body = { title: '人工新译文', description: '不得被旧表单覆盖。' };
    const put = () => app.inject({ method: 'PUT', url: `/api/admin/contents/${id}/revisions/${detail.content.head_revision_id}/translations/zh-CN`,
      headers: { cookie: ownerCookie, origin: 'http://localhost:4321' }, payload: { baseTranslationId: null, body } });
    assert.equal((await put()).statusCode, 200);
    assert.equal((await put()).json().error.code, 'TRANSLATION_CONFLICT');
    assert.equal((await post(`/contents/${id}/revisions`, { baseRevisionId: detail.content.head_revision_id, baseDraftToken: detail.content.draft_token,
      sourceLocale: 'en', text: revision.source_text, attributes: revision.attributes, translations: {} })).json().error.code, 'REVISION_CONFLICT');
    assert.equal((await app.inject(`/api/contents/${id}?locale=zh-CN`)).json().content.text.title, '管理中文');
  });
  await t.test('unpublish, restore and site intervention cannot be bypassed', async () => {
    assert.equal((await post(`/contents/${id}/unpublish`, { siteBlock: true })).statusCode, 403);
    assert.equal((await post(`/contents/${id}/unpublish`, {})).statusCode, 200);
    assert.equal((await app.inject(`/api/contents/${id}`)).statusCode, 404);
    assert.equal((await post(`/contents/${id}/restore`, { publicationId: oldPublication })).statusCode, 200);
    assert.equal((await post(`/contents/${id}/unpublish`, { siteBlock: true }, adminCookie)).statusCode, 200);
    assert.equal((await post(`/contents/${id}/restore`, { publicationId: oldPublication })).json().error.code, 'SITE_BLOCKED');
    assert.equal((await post(`/contents/${id}/release-site-block`, {})).statusCode, 403);
    assert.equal((await post(`/contents/${id}/release-site-block`, {}, adminCookie)).statusCode, 200);
    assert.equal((await app.inject(`/api/contents/${id}`)).statusCode, 404);
    assert.equal((await post(`/contents/${id}/restore`, { publicationId: oldPublication })).statusCode, 200);
  });
  await t.test('import preview rolls back; row errors, concurrent retries and changed inputs are explicit', async () => {
    const count = async () => (await f.db.query(`SELECT (SELECT count(*) FROM contents) AS contents,
      (SELECT count(*) FROM import_batches) AS batches,(SELECT count(*) FROM translation_jobs) AS jobs`)).rows[0];
    const batch = { worldId: f.data.latheId, source: 'acceptance', items: [
      { externalId: 'valid', content: input('imported-room') }, { externalId: 'invalid', content: { ...input('bad-room'), text: {} } },
      { externalId: 'foreign', content: { ...input('foreign-room'), worldId: f.data.harbourId } },
    ] };
    const before = await count();
    const preview = await post('/imports/preview', batch);
    assert.equal(preview.statusCode, 200); assert.deepEqual(preview.json().results.map((r: any) => r.status), ['valid', 'error', 'error']);
    assert.deepEqual(await count(), before);
    const [first, second] = await Promise.all([post('/imports/apply', batch), post('/imports/apply', batch)]);
    assert.equal(first.statusCode, 200); assert.equal(second.statusCode, 200);
    assert.deepEqual([first.json().results[0].status, second.json().results[0].status].sort(), ['created', 'unchanged']);
    const importedId = first.json().results[0].contentId;
    assert.equal((await app.inject(`/api/contents/${importedId}`)).statusCode, 404);
    batch.items[0].content.text = { title: 'Changed source', description: 'A conflicting reimport' };
    assert.equal((await post('/imports/apply', batch)).json().results[0].status, 'conflict');
    assert.equal((await post('/imports/apply', batch, foreignCookie)).statusCode, 403);
    const history = await app.inject({ url: `/api/admin/worlds/${f.data.latheId}/imports`, headers: { cookie: ownerCookie } });
    assert.equal(history.json().batches.length, 3);
  });
});
