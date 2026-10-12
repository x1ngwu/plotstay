import { randomUUID } from 'node:crypto';
import { transaction, type Database } from '@plotstay/database';
import { textSchema, type ContentText } from '@plotstay/contracts';
import { requireWorld, type Actor } from './auth.ts';
import { assert } from './errors.ts';

export interface TranslationRequest {
  revisionId: string; sourceLocale: string; targetLocale: string; text: ContentText;
  glossaryId: string | null; glossary: unknown; configuration: Record<string, unknown>; signal: AbortSignal;
}
export interface TranslationAdapter {
  id: string;
  translate(request: TranslationRequest): Promise<ContentText>;
}

// No external calls and no dequeueing occur until an adapter is explicitly supplied.
export async function runTranslationOnce(db: Database, adapter: TranslationAdapter | null, options: { timeoutMs?: number; leaseMs?: number } = {}) {
  if (!adapter) return false;
  const timeoutMs = options.timeoutMs ?? 30000;
  const leaseMs = options.leaseMs ?? 60000;
  assert(leaseMs > timeoutMs, 500, 'INVALID_LEASE', 'The lease must outlast the adapter timeout.');
  const job = await transaction(db, async client => {
    await client.query(`UPDATE translation_jobs SET status='failed',lease_token=NULL,leased_until=NULL,last_error='Lease expired after the final attempt'
      WHERE status='running' AND leased_until<=now() AND attempts>=max_attempts AND provider=$1`, [adapter.id]);
    const { rows: [row] } = await client.query(`SELECT * FROM translation_jobs WHERE provider=$1 AND attempts<max_attempts
      AND ((status='pending' AND available_at<=now()) OR (status='running' AND leased_until<=now()))
      ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1`, [adapter.id]);
    if (!row) return null;
    const token = randomUUID();
    await client.query(`UPDATE translation_jobs SET status='running',attempts=attempts+1,lease_token=$2,
      leased_until=now()+($3::int * interval '1 millisecond'),last_error=NULL WHERE id=$1`, [row.id, token, leaseMs]);
    return { ...row, lease_token: token, attempts: row.attempts + 1 };
  });
  if (!job) return false;
  const { rows: [revision] } = await db.query(`SELECT r.*,c.head_revision_id,g.entries AS glossary,
    EXISTS(SELECT 1 FROM revision_locales WHERE revision_id=r.id AND locale=$2) AS has_translation
    FROM content_revisions r JOIN contents c ON c.id=r.content_id LEFT JOIN glossaries g ON g.id=$3 WHERE r.id=$1`,
  [job.revision_id, job.locale, job.glossary_id]);
  let body: ContentText | undefined, failure: string | undefined;
  const staleAtStart = revision.head_revision_id !== revision.id || !['draft', 'rejected'].includes(revision.status) || revision.has_translation;
  if (!staleAtStart) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      body = textSchema.parse(await Promise.race([
        adapter.translate({ revisionId: revision.id, sourceLocale: revision.source_locale, targetLocale: job.locale,
          text: revision.source_text, glossaryId: job.glossary_id, glossary: revision.glossary ?? [], configuration: job.configuration, signal: controller.signal }),
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => {
          controller.abort(); reject(new Error('ADAPTER_TIMEOUT'));
        }, timeoutMs); }),
      ]));
      if(revision.source_text.editorListIds){
        for(const [path,ids] of Object.entries(revision.source_text.editorListIds) as [string,string[]][]){
          let value:any=body;for(const segment of path.split('.'))value=value?.[segment];
          if((Array.isArray(value)?value.length:0)!==ids.length)throw new Error('LIST_ALIGNMENT');
        }
        body.editorListIds=structuredClone(revision.source_text.editorListIds);
      }
    } catch (error) {
      // Do not persist vendor responses, keys or input text in a task error.
      failure = error instanceof Error && error.message === 'ADAPTER_TIMEOUT' ? 'Translation timed out' : 'Translation failed or returned invalid fields';
    } finally { if (timer) clearTimeout(timer); }
  }
  await transaction(db, async client => {
    // Same lock order as editors: content first, then task.
    const { rows: [content] } = await client.query('SELECT * FROM contents WHERE id=$1 FOR UPDATE', [revision.content_id]);
    const { rows: [currentJob] } = await client.query('SELECT * FROM translation_jobs WHERE id=$1 FOR UPDATE', [job.id]);
    if (currentJob.status !== 'running' || currentJob.lease_token !== job.lease_token || new Date(currentJob.leased_until).getTime() <= Date.now()) return;
    const { rows: [currentRevision] } = await client.query('SELECT status FROM content_revisions WHERE id=$1', [revision.id]);
    const existing = await client.query('SELECT 1 FROM revision_locales WHERE revision_id=$1 AND locale=$2', [revision.id, job.locale]);
    if (staleAtStart || content.head_revision_id !== revision.id || !['draft', 'rejected'].includes(currentRevision.status) || existing.rowCount) {
      await client.query("UPDATE translation_jobs SET status='superseded',lease_token=NULL,leased_until=NULL,completed_at=now() WHERE id=$1", [job.id]);
    } else if (failure) {
      await client.query(`UPDATE translation_jobs SET status=$2,last_error=$3,lease_token=NULL,leased_until=NULL,
        available_at=now()+($4::int * interval '1 second') WHERE id=$1`,
      [job.id, job.attempts >= job.max_attempts ? 'failed' : 'pending', failure, Math.min(300, 2 ** job.attempts)]);
    } else {
      const { rows: [translation] } = await client.query(`INSERT INTO translations(revision_id,locale,body,origin,glossary_id)
        VALUES ($1,$2,$3,'machine',$4) RETURNING id`, [revision.id, job.locale, body, job.glossary_id]);
      await client.query('INSERT INTO revision_locales(revision_id,locale,translation_id) VALUES ($1,$2,$3)', [revision.id, job.locale, translation.id]);
      await client.query('UPDATE contents SET draft_token=gen_random_uuid() WHERE id=$1', [content.id]);
      await client.query("UPDATE translation_jobs SET status='completed',lease_token=NULL,leased_until=NULL,completed_at=now() WHERE id=$1", [job.id]);
    }
  });
  return true;
}

export async function retryTranslation(db: Database, actor: Actor, jobId: string) {
  return transaction(db, async client => {
    const { rows: [job] } = await client.query(`SELECT j.*,r.content_id FROM translation_jobs j
      JOIN content_revisions r ON r.id=j.revision_id WHERE j.id=$1`, [jobId]);
    assert(job, 404, 'NOT_FOUND', 'Translation task not found.');
    const { rows: [content] } = await client.query('SELECT * FROM contents WHERE id=$1 FOR UPDATE', [job.content_id]);
    await requireWorld(client, actor, content.world_id);
    const { rows: [revision] } = await client.query('SELECT status FROM content_revisions WHERE id=$1', [job.revision_id]);
    assert(content.head_revision_id === job.revision_id && ['draft', 'rejected'].includes(revision.status), 409, 'REVISION_LOCKED', 'Only the current editable draft can be translated.');
    assert(!(await client.query('SELECT 1 FROM revision_locales WHERE revision_id=$1 AND locale=$2', [job.revision_id, job.locale])).rowCount,
      409, 'TRANSLATION_EXISTS', 'An existing translation will not be overwritten.');
    const result = await client.query(`UPDATE translation_jobs SET status='pending',attempts=0,available_at=now(),
      lease_token=NULL,leased_until=NULL,completed_at=NULL,last_error=NULL
      WHERE id=$1 AND (status IN ('failed','superseded') OR (status='running' AND leased_until<=now())) RETURNING id`, [jobId]);
    assert(result.rowCount, 409, 'TASK_NOT_RETRYABLE', 'This task is not ready for manual retry.');
    await client.query(`INSERT INTO moderation_events(content_id,revision_id,world_id,actor_id,action,note)
      VALUES ($1,$2,$3,$4,'translation_retried',$5)`, [content.id, job.revision_id, content.world_id, actor.id, job.locale]);
    return { queued: true };
  });
}
