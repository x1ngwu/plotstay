import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.ts';
import { createApp } from '../apps/api/src/app.ts';
import { saveOwnPersona, savePersona, savePersonaNotes, readPersonaNotes, myPersonas, moderatePersona, disablePersona, settingDetail, personaQueue, createAccount, startReview, reviewDetail, signatureProfiles } from '@plotstay/domain';
const profiles = { en: { name: 'Reed', bio: 'Signature', avatar: 'mint' }, 'zh-CN': { name: '苇舟', bio: '', avatar: 'sky' } };
const rejected = (fn: () => Promise<unknown>, code: string) => assert.rejects(fn, (e: any) => e.code === code);
const command = (overrides: any = {}) => ({ profiles, action: 'complete', requestId: randomUUID(), baseRevisionId: null, expectedSubmittedRevisionId: null, ...overrides });
test('persona workspace atomic commands, private notes and compatibility', { timeout: 120000 }, async (t) => {
    const f = await fixture();
    t.after(f.cleanup);
    const { db, data } = f;
    const u = await createAccount(db, data.admin, { email: 'private@tests.invalid', password: 'test-password-123' }), actor = { id: u.id, email: u.email, siteRole: 'user' as const };
    const app = await createApp(db);
    t.after(() => app.close());
    const login = async (email: string, password: string) => { const r = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: 'http://localhost:4321' }, payload: { email, password } }); assert.equal(r.statusCode, 200); return r.headers['set-cookie'] as string; };
    const userCookie = await login(u.email, 'test-password-123'), adminCookie = await login(f.credentials.email, f.credentials.password);
    const initial = command();
    let p = await saveOwnPersona(db, actor, initial);
    const state = async () => (await myPersonas(db, actor)).find(x => x.id === p.id)!;
    await t.test('ordinary and world admins submit, site admin completes own profile; retries are stable', async () => {
        assert.equal(p.outcome, 'submitted');
        assert.equal((await state()).submitted_revision_id, p.revisionId);
        assert.equal((await state()).published_revision_id, null);
        const repeats = await Promise.all(Array.from({ length: 6 }, () => saveOwnPersona(db, actor, initial)));
        assert(repeats.every(x => x.id === p.id && x.revisionId === p.revisionId));
        assert.equal((await db.query('SELECT count(*)::int n FROM personas WHERE owner_id=$1', [actor.id])).rows[0].n, 1);
        const admin = await saveOwnPersona(db, data.admin, command());
        assert.equal(admin.outcome, 'published');
        assert.equal((await db.query('SELECT count(*)::int n FROM detail_setting_publications WHERE revision_id=$1', [admin.revisionId])).rows[0].n, 1);
        const world = await saveOwnPersona(db, data.owner, command());
        assert.equal(world.outcome, 'submitted');
        await rejected(() => saveOwnPersona(db, data.admin, command({ personaId: p.id, baseRevisionId: p.revisionId })), 'PERSONA_FORBIDDEN');
        await rejected(() => saveOwnPersona(db, actor, { ...initial, action: 'draft' }), 'REQUEST_CONFLICT');
    });
    await t.test('draft B retains pending A and live P; replacing requires current pending pointer; histories stay fixed', async () => {
        await moderatePersona(db, data.admin, p.revisionId, 'approved', '');
        const live = p.revisionId;
        p = await saveOwnPersona(db, actor, command({ personaId: p.id, baseRevisionId: p.revisionId }));
        const pending = p.revisionId;
        p = await saveOwnPersona(db, actor, command({ personaId: p.id, baseRevisionId: p.revisionId, action: 'draft' }));
        assert.equal((await state()).submitted_revision_id, pending);
        assert.equal((await state()).published_revision_id, live);
        const next = command({ personaId: p.id, baseRevisionId: p.revisionId, expectedSubmittedRevisionId: pending });
        const competing = await Promise.allSettled([saveOwnPersona(db, actor, next), saveOwnPersona(db, actor, command({ ...next, requestId: randomUUID() }))]);
        assert.equal(competing.filter(x => x.status === 'fulfilled').length, 1);
        p = (competing.find(x => x.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
        await rejected(() => moderatePersona(db, data.admin, pending, 'approved', ''), 'SUBMISSION_SUPERSEDED');
        await moderatePersona(db, data.admin, p.revisionId, 'rejected', 'Clarify this version');
        const returned = p.revisionId;
        p = await saveOwnPersona(db, actor, command({ personaId: p.id, baseRevisionId: p.revisionId, action: 'draft' }));
        assert.equal((await state()).last_rejection.revisionId, returned);
        assert.equal((await state()).published_revision_id, live);
    });
    await t.test('failed validation or publication rolls back the entire operation', async () => {
        const count = async () => (await db.query('SELECT (SELECT count(*) FROM personas) p,(SELECT count(*) FROM detail_setting_revisions) r,(SELECT count(*) FROM persona_profile_commands) c')).rows[0];
        const before = await count();
        await rejected(() => saveOwnPersona(db, actor, command({ profiles: { en: profiles.en } })), 'TRANSLATIONS_REQUIRED');
        assert.deepEqual(await count(), before);
        await db.query("CREATE FUNCTION test_fail_publication() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test publication failure'; END $$; CREATE TRIGGER test_fail BEFORE INSERT ON detail_setting_publications FOR EACH ROW EXECUTE FUNCTION test_fail_publication()");
        await assert.rejects(() => saveOwnPersona(db, data.admin, command()), /test publication failure/);
        assert.deepEqual(await count(), before);
        await db.query('DROP TRIGGER test_fail ON detail_setting_publications; DROP FUNCTION test_fail_publication()');
    });
    const marker = 'PRIVATE_ONLY_' + randomUUID();
    let note: any;
    await t.test('owner-only notes are isolated even from site admin, review/history/list and signatures', async () => {
        const before = await state();
        note = await savePersonaNotes(db, actor, p.id, { body: marker, baseVersion: null, requestId: randomUUID() });
        assert.deepEqual(await state(), before);
        for (const a of [data.admin, data.owner, data.editor]) {
            await rejected(() => readPersonaNotes(db, a, p.id), 'PERSONA_FORBIDDEN');
            await rejected(() => savePersonaNotes(db, a, p.id, { body: 'x', baseVersion: null, requestId: randomUUID() }), 'PERSONA_FORBIDDEN');
        }
        await rejected(() => readPersonaNotes(db, actor, randomUUID()), 'PERSONA_FORBIDDEN');
        const setting = await settingDetail(db, data.admin, before.setting_id);
        const review = await startReview(db, actor, data.ids['observation-room']!, p.id);
        for (const result of [await myPersonas(db, actor), setting, await personaQueue(db, data.admin), await reviewDetail(db, actor, review.id), signatureProfiles(before.draft)])
            assert(!JSON.stringify(result).includes(marker));
        for (const cookie of ['', adminCookie]) {
            const r = await app.inject({ url: `/api/me/personas/${p.id}/notes`, headers: { cookie } });
            assert.equal(r.statusCode, cookie ? 403 : 401);
            assert(!r.body.includes(marker));
        }
        const history = await app.inject({ url: '/api/admin/settings/' + before.setting_id, headers: { cookie: adminCookie } });
        assert.equal(history.statusCode, 200);
        assert(!history.body.includes(marker));
        const forged = await app.inject({ method: 'POST', url: '/api/me/personas/save', headers: { cookie: userCookie, origin: 'http://localhost:4321' }, payload: command({ canPublish: true, ownerId: data.admin.id }) });
        assert.equal(forged.statusCode, 400);
    });
    await t.test('disabled owner still saves notes; exact Unicode limit, retry, concurrent version and legacy saves preserve notes', async () => {
        await disablePersona(db, data.admin, p.id, true);
        const input = { body: '文'.repeat(1994) + 'A， \n🌱!', baseVersion: note.version, requestId: randomUUID() };
        assert.equal(Array.from(input.body).length, 2000);
        note = await savePersonaNotes(db, actor, p.id, input);
        assert.deepEqual(await savePersonaNotes(db, actor, p.id, input), note);
        assert.throws(() => savePersonaNotes(db, actor, p.id, { ...input, body: input.body + '字', requestId: randomUUID() }));
        assert.equal((await readPersonaNotes(db, actor, p.id)).body, input.body);
        const results = await Promise.allSettled([savePersonaNotes(db, actor, p.id, { body: marker, baseVersion: note.version, requestId: randomUUID() }), savePersonaNotes(db, actor, p.id, { body: marker + ' other', baseVersion: note.version, requestId: randomUUID() })]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.code, 'NOTES_CONFLICT');
        await rejected(() => saveOwnPersona(db, actor, command({ personaId: p.id, baseRevisionId: p.revisionId })), 'PERSONA_DISABLED');
        await disablePersona(db, data.admin, p.id, false);
        const previousNotes = await readPersonaNotes(db, actor, p.id);
        const legacy = await savePersona(db, actor, profiles, p.id, p.revisionId);
        p = { ...legacy, outcome: 'draft' };
        assert.deepEqual(await readPersonaNotes(db, actor, p.id), previousNotes);
    });
});
