import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createContentSchema, editContentSchema, textSchema } from '@plotstay/contracts';
import { createContent, editContent, saveTranslation, submitRevision, runTranslationOnce, retryTranslation, type TranslationAdapter } from '@plotstay/domain';
import { fixture } from './helpers.ts';

test('translation execution and stale result isolation', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const output = textSchema.parse({ title: '测试译文', description: '仅测试适配器，不调用外部服务。' });
  async function draft() {
    const input = createContentSchema.parse({ worldId: f.data.latheId, kind: 'stay', slug: 'translation-' + randomUUID(),
      sourceLocale: 'en', text: { title: 'Source', description: 'Source text' }, attributes: { price: { amount: 1, unit: 'night' } } });
    const created = await createContent(f.db, f.data.owner, input);
    // Unique provider per case keeps pending retries from another case out of its queue.
    const provider = randomUUID();
    const { rows: [job] } = await f.db.query('UPDATE translation_jobs SET provider=$2 WHERE revision_id=$1 RETURNING *', [created.revisionId, provider]);
    return { ...created, input, job, provider };
  }
  const getJob = async (id: string) => (await f.db.query('SELECT * FROM translation_jobs WHERE id=$1', [id])).rows[0];
  const translation = async (revision: string) => (await f.db.query(`SELECT t.* FROM revision_locales rl JOIN translations t ON t.id=rl.translation_id
    WHERE rl.revision_id=$1 AND rl.locale='zh-CN'`, [revision])).rows[0];
  function delayed(provider: string) {
    let started!: () => void, release!: (value: typeof output) => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    const result = new Promise<typeof output>(resolve => { release = resolve; });
    const adapter: TranslationAdapter = { id: provider, translate: async () => { started(); return result; } };
    return { entered, release, adapter };
  }
  await t.test('disabled preserves tasks; configured adapter gets version, glossary and configuration', async () => {
    const before = (await f.db.query('SELECT attempts,status FROM translation_jobs ORDER BY id')).rows;
    assert.equal(await runTranslationOnce(f.db, null), false);
    assert.deepEqual((await f.db.query('SELECT attempts,status FROM translation_jobs ORDER BY id')).rows, before);
    const { rows: [glossary] } = await f.db.query('INSERT INTO glossaries(world_id,version,entries) VALUES ($1,1,$2) RETURNING id',
      [f.data.latheId, JSON.stringify([{ source: 'Lathe Worlds', target: '拉斯世界' }])]);
    const d = await draft(); let calls = 0;
    await runTranslationOnce(f.db, { id: d.provider, translate: async request => {
      calls++; assert.equal(request.revisionId, d.revisionId); assert.equal(request.sourceLocale, 'en'); assert.equal(request.targetLocale, 'zh-CN');
      assert.equal(request.glossaryId, glossary.id); assert.deepEqual(request.glossary, [{ source: 'Lathe Worlds', target: '拉斯世界' }]);
      assert.equal(typeof request.configuration.model, 'string'); return output;
    } });
    assert.equal(calls, 1); assert.equal((await getJob(d.job.id)).status, 'completed');
    assert.equal((await translation(d.revisionId)).origin, 'machine');
    assert.equal((await f.db.query('SELECT published_publication_id FROM contents WHERE id=$1', [d.id])).rows[0].published_publication_id, null);
  });
  await t.test('failure backs off, stops at the limit and can be retried only by authorized members', async () => {
    const d = await draft();
    const adapter: TranslationAdapter = { id: d.provider, translate: async () => { throw new Error('secret-vendor-key-must-not-leak'); } };
    for (let attempt = 1; attempt <= 3; attempt++) {
      await runTranslationOnce(f.db, adapter);
      const job = await getJob(d.job.id); assert.equal(job.attempts, attempt);
      assert.equal(job.status, attempt === 3 ? 'failed' : 'pending');
      assert.ok(!job.last_error.includes('secret-vendor'));
      if (attempt < 3) {
        assert.equal(await runTranslationOnce(f.db, adapter), false);
        await f.db.query('UPDATE translation_jobs SET available_at=now() WHERE id=$1', [job.id]);
      }
    }
    assert.equal(await runTranslationOnce(f.db, adapter), false);
    await assert.rejects(() => retryTranslation(f.db, f.data.secondOwner, d.job.id), (error: any) => error.code === 'WORLD_FORBIDDEN');
    await retryTranslation(f.db, f.data.owner, d.job.id);
    await runTranslationOnce(f.db, { id: d.provider, translate: async () => output });
    assert.equal((await getJob(d.job.id)).status, 'completed');
  });
  await t.test('timeouts release the lease for retry and invalid adapter output is rejected', async () => {
    const d = await draft();
    await runTranslationOnce(f.db, { id: d.provider, translate: () => new Promise(() => {}) }, { timeoutMs: 5, leaseMs: 1000 });
    assert.equal((await getJob(d.job.id)).last_error, 'Translation timed out');
    await f.db.query('UPDATE translation_jobs SET available_at=now() WHERE id=$1', [d.job.id]);
    await runTranslationOnce(f.db, { id: d.provider, translate: async () => ({ title: '' } as any) });
    assert.equal(await translation(d.revisionId), undefined);
  });
  await t.test('concurrent workers claim once; an expired lease can recover without late overwrite', async () => {
    const d = await draft(), slow = delayed(d.provider);
    const first = runTranslationOnce(f.db, slow.adapter);
    await slow.entered;
    assert.equal(await runTranslationOnce(f.db, { id: d.provider, translate: async () => { throw new Error('Must not claim'); } }), false);
    await f.db.query("UPDATE translation_jobs SET leased_until=now()-interval '1 second' WHERE id=$1", [d.job.id]);
    const recovered = textSchema.parse({ ...output, title: 'Recovered result' });
    await runTranslationOnce(f.db, { id: d.provider, translate: async () => recovered });
    slow.release(output); await first;
    assert.equal((await translation(d.revisionId)).body.title, 'Recovered result');
    assert.equal((await getJob(d.job.id)).attempts, 2);
  });
  for (const change of ['new revision', 'manual translation', 'submitted revision']) {
    await t.test(`late results cannot overwrite ${change}`, async sub => {
      const d = await draft(), slow = delayed(d.provider);
      const work = runTranslationOnce(f.db, slow.adapter); await slow.entered;
      sub.after(async () => { slow.release(output); await work; });
      if (change === 'new revision') await editContent(f.db, f.data.owner, d.id, editContentSchema.parse({ sourceLocale: d.input.sourceLocale,
        attributes: d.input.attributes, translations: {}, baseRevisionId: d.revisionId, text: { ...d.input.text, title: 'New source' } }));
      if (change === 'manual translation') await saveTranslation(f.db, f.data.owner, d.id, d.revisionId, 'zh-CN', textSchema.parse({ ...output, title: 'Human correction' }), null);
      if (change === 'submitted revision') await submitRevision(f.db, f.data.owner, d.id, d.revisionId);
      slow.release(output); await work;
      assert.equal((await getJob(d.job.id)).status, 'superseded');
      if (change === 'manual translation') assert.equal((await translation(d.revisionId)).body.title, 'Human correction');
      else assert.equal(await translation(d.revisionId), undefined);
    });
  }
});
