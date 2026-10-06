import { createContentSchema, importSchema } from '@plotstay/contracts';
import { transaction, type Database } from '@plotstay/database';
import { assert } from './errors.ts';
import { requireWorld, digest, type Actor } from './auth.ts';
import { createContentInTransaction } from './content.ts';

// Importing never publishes or silently overwrites existing work.
export async function importContent(db: Database, actor: Actor, raw: unknown, dryRun: boolean) {
  const input = importSchema.parse(raw);
  await requireWorld(db, actor, input.worldId);
  assert(new Set(input.items.map(i => i.externalId)).size === input.items.length, 400, 'DUPLICATE_IMPORT_ID', 'Import identifiers must be unique within a batch.');
  return transaction(db, async client => {
    await client.query('SAVEPOINT import_preview');
    // One lock per source also avoids lock-order deadlocks between differently ordered batches.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify([input.worldId, input.source])]);
    const { rows: [batch] } = await client.query('INSERT INTO import_batches(world_id,source,actor_id,results) VALUES ($1,$2,$3,$4) RETURNING id', [input.worldId, input.source, actor.id, '[]']);
    const results: { externalId: string; status: string; contentId?: string; message?: string }[] = [];
    for (const item of input.items) {
      await client.query('SAVEPOINT import_item');
      try {
        const content = createContentSchema.parse(item.content);
        assert(content.worldId === input.worldId, 400, 'WORLD_MISMATCH', 'Every imported item must belong to the selected world.');
        // The same external item is serialized across concurrently submitted batches.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify([input.worldId, input.source, item.externalId])]);
        const hash = digest(JSON.stringify(content));
        // Prior imports predate optional translated tags. Empty tags must not turn an unchanged legacy import into a conflict.
        const legacy = structuredClone(content) as any;
        const texts = [legacy.text, ...Object.values(legacy.translations)] as any[];
        const emptyTags = texts.every(text => !text.tags?.length);
        if (emptyTags) for (const text of texts) delete text.tags;
        const legacyHash = emptyTags ? digest(JSON.stringify(legacy)) : null;
        const { rows: [existing] } = await client.query('SELECT * FROM import_items WHERE world_id=$1 AND source=$2 AND external_id=$3', [input.worldId, input.source, item.externalId]);
        if (existing) {
          results.push({ externalId: item.externalId, contentId: existing.content_id,
            status: (existing.payload_hash === hash || existing.payload_hash === legacyHash) ? 'unchanged' : 'conflict',
            ...((existing.payload_hash === hash || existing.payload_hash === legacyHash) ? {} : { message: 'This imported item has changed. Edit its existing draft explicitly.' }) });
        } else {
          const created = await createContentInTransaction(client, actor, content);
          await client.query('INSERT INTO import_items(world_id,source,external_id,content_id,payload_hash,batch_id) VALUES ($1,$2,$3,$4,$5,$6)', [input.worldId, input.source, item.externalId, created.id, hash, batch.id]);
          results.push({ externalId: item.externalId, contentId: dryRun ? undefined : created.id, status: dryRun ? 'valid' : 'created' });
        }
      } catch (error: any) {
        await client.query('ROLLBACK TO SAVEPOINT import_item');
        results.push({ externalId: item.externalId, status: 'error', message: error.code === '23505' ? 'The slug already exists in this world.' : error.issues ? JSON.stringify(error.issues) : error.status ? error.message : 'The item could not be imported.' });
      }
      await client.query('RELEASE SAVEPOINT import_item');
    }
    if (dryRun) {
      // Roll back the complete validation transaction, including all draft/job inserts.
      await client.query('ROLLBACK TO SAVEPOINT import_preview');
      return { dryRun, results };
    }
    await client.query('UPDATE import_batches SET results=$2 WHERE id=$1', [batch.id, JSON.stringify(results)]);
    return { batchId: batch.id as string, dryRun, results };
  });
}
