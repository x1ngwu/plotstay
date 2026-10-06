import { randomUUID } from 'node:crypto';
import { transaction, type Database, type PoolClient } from '@plotstay/database';
import { textSchema, type ContentText, type CreateContentInput, type EditContentInput } from '@plotstay/contracts';
import { requireWorld, type Actor } from './auth.ts';
import { assert, DomainError } from './errors.ts';

async function event(db: PoolClient, actor: Actor, content: any, action: string, revisionId?: string, note = '') {
  await db.query(`INSERT INTO moderation_events(content_id,revision_id,world_id,actor_id,action,note)
    VALUES ($1,$2,$3,$4,$5,$6)`, [content.id, revisionId ?? null, content.world_id, actor.id, action, note]);
}
export async function lockContent(db: PoolClient, actor: Actor, id: string, manage = false) {
  const { rows: [content] } = await db.query('SELECT * FROM contents WHERE id=$1 FOR UPDATE', [id]);
  assert(content, 404, 'NOT_FOUND', 'Content not found.');
  const world = await requireWorld(db, actor, content.world_id, manage);
  return { content, world };
}
async function putTranslation(db: PoolClient, revisionId: string, locale: string, body: ContentText, origin: string, actorId: string) {
  const { rows: [t] } = await db.query(`INSERT INTO translations(revision_id,locale,body,origin,created_by)
    VALUES ($1,$2,$3,$4,$5) RETURNING id`, [revisionId, locale, body, origin, actorId]);
  await db.query(`INSERT INTO revision_locales(revision_id,locale,translation_id) VALUES ($1,$2,$3)
    ON CONFLICT (revision_id,locale) DO UPDATE SET translation_id=excluded.translation_id`, [revisionId, locale, t.id]);
}
async function appendRevision(db: PoolClient, actor: Actor, content: any, input: Omit<EditContentInput, 'baseRevisionId'>) {
  const { rows: locales } = await db.query('SELECT code FROM locales WHERE enabled');
  const allowed = new Set(locales.map(l => l.code));
  assert(allowed.has(input.sourceLocale) && Object.keys(input.translations).every(l => allowed.has(l)), 400, 'INVALID_LOCALE', 'Language is not enabled.');
  assert(!Object.hasOwn(input.translations, input.sourceLocale), 400, 'DUPLICATE_SOURCE', 'Use text for the source language.');
  if (content.kind !== 'review') {
    assert(input.attributes.price && input.attributes.price.unit === (content.kind === 'stay' ? 'night' : 'person'), 400, 'INVALID_PRICE', 'The price unit must match the content type.');
    if (content.kind === 'experience') assert(input.attributes.durationMinutes, 400, 'DURATION_REQUIRED', 'An experience needs a duration.');
  } else assert(!input.attributes.price, 400, 'INVALID_PRICE', 'Reviews do not have a booking price.');
  const { rows: [previous] } = await db.query('SELECT coalesce(max(number),0)::int AS number FROM content_revisions WHERE content_id=$1', [content.id]);
  const { rows: [revision] } = await db.query(`INSERT INTO content_revisions(content_id,number,source_locale,source_text,attributes,created_by)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [content.id, previous.number + 1, input.sourceLocale, input.text, input.attributes, actor.id]);
  await putTranslation(db, revision.id, input.sourceLocale, input.text, 'source', actor.id);
  for (const [locale, body] of Object.entries(input.translations)) await putTranslation(db, revision.id, locale, body, 'manual', actor.id);
  const { rows: [glossary] } = await db.query('SELECT id FROM glossaries WHERE world_id=$1 ORDER BY version DESC LIMIT 1', [content.world_id]);
  for (const { code } of locales) {
    if (code !== input.sourceLocale && !input.translations[code]) {
      await db.query('INSERT INTO translation_jobs(revision_id,locale,glossary_id,provider,configuration) VALUES ($1,$2,$3,$4,$5)',
        [revision.id, code, glossary?.id ?? null, process.env.TRANSLATION_PROVIDER ?? 'disabled', { model: process.env.TRANSLATION_MODEL ?? '' }]);
    }
  }
  await db.query('UPDATE contents SET head_revision_id=$2,draft_token=gen_random_uuid() WHERE id=$1', [content.id, revision.id]);
  await event(db, actor, content, 'draft_saved', revision.id);
  return revision;
}
export async function createContentInTransaction(db: PoolClient, actor: Actor, input: CreateContentInput) {
  await requireWorld(db, actor, input.worldId);
  if (input.placeId) {
    const place = await db.query('SELECT id FROM places WHERE id=$1 AND world_id=$2', [input.placeId, input.worldId]);
    assert(place.rowCount, 400, 'INVALID_PLACE', 'The place must belong to this world.');
  }
  if (input.kind === 'review') {
    const parent = await db.query("SELECT id FROM contents WHERE id=$1 AND world_id=$2 AND kind IN ('stay','experience')", [input.parentContentId, input.worldId]);
    assert(parent.rowCount, 400, 'INVALID_PARENT', 'A review needs a stay or experience in this world.');
  } else assert(!input.parentContentId, 400, 'INVALID_PARENT', 'Only reviews have a parent entry.');
  if (input.personaId) {
    const persona = await db.query('SELECT id FROM personas WHERE id=$1 AND approved AND (owner_id=$2 OR $3)', [input.personaId, actor.id, actor.siteRole === 'admin']);
    assert(persona.rowCount, 403, 'PERSONA_FORBIDDEN', 'This persona is not available to you.');
  }
  const { rows: [content] } = await db.query(`INSERT INTO contents(world_id,place_id,kind,slug,parent_content_id,persona_id,author_id)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [input.worldId, input.placeId, input.kind, input.slug, input.parentContentId, input.personaId, actor.id]);
  const revision = await appendRevision(db, actor, content, input);
  return { id: content.id as string, revisionId: revision.id as string, number: revision.number as number };
}
export function createContent(db: Database, actor: Actor, input: CreateContentInput) {
  return transaction(db, client => createContentInTransaction(client, actor, input));
}
export function editContent(db: Database, actor: Actor, id: string, input: EditContentInput) {
  return transaction(db, async client => {
    const { content } = await lockContent(client, actor, id);
    assert(content.head_revision_id === input.baseRevisionId, 409, 'REVISION_CONFLICT', 'Another editor saved a new version. Your changes have not been overwritten.');
    assert(!input.baseDraftToken || content.draft_token === input.baseDraftToken, 409, 'REVISION_CONFLICT', 'Draft translations changed. Your input is preserved; reload before saving.');
    const revision = await appendRevision(client, actor, content, input);
    return { id, revisionId: revision.id as string, number: revision.number as number };
  });
}
export function saveTranslation(db: Database, actor: Actor, id: string, revisionId: string, locale: string, body: ContentText, baseTranslationId?: string | null) {
  return transaction(db, async client => {
    const { content } = await lockContent(client, actor, id);
    assert(content.head_revision_id === revisionId, 409, 'REVISION_CONFLICT', 'This is no longer the current draft.');
    const { rows: [revision] } = await client.query('SELECT * FROM content_revisions WHERE id=$1', [revisionId]);
    assert(['draft','rejected'].includes(revision.status), 409, 'REVISION_LOCKED', 'Create a new draft to edit reviewed content.');
    assert(locale !== revision.source_locale, 400, 'SOURCE_EDIT', 'Source changes require a new content revision.');
    const enabled = await client.query('SELECT code FROM locales WHERE code=$1 AND enabled', [locale]);
    assert(enabled.rowCount, 400, 'INVALID_LOCALE', 'Language is not enabled.');
    if (baseTranslationId !== undefined) {
      const { rows: [current] } = await client.query('SELECT translation_id FROM revision_locales WHERE revision_id=$1 AND locale=$2', [revisionId, locale]);
      assert((current?.translation_id ?? null) === baseTranslationId, 409, 'TRANSLATION_CONFLICT', 'This translation changed. Reload it before saving.');
    }
    await putTranslation(client, revisionId, locale, textSchema.parse(body), 'manual', actor.id);
    await client.query('UPDATE contents SET draft_token=gen_random_uuid() WHERE id=$1', [id]);
    await event(client, actor, content, 'translation_saved', revisionId, locale);
    return { saved: true };
  });
}
export function submitRevision(db: Database, actor: Actor, id: string, revisionId: string) {
  return transaction(db, async client => {
    const { content } = await lockContent(client, actor, id);
    assert(content.head_revision_id === revisionId, 409, 'REVISION_CONFLICT', 'Submit the current draft.');
    const result = await client.query("UPDATE content_revisions SET status='submitted' WHERE id=$1 AND status IN ('draft','rejected') RETURNING id", [revisionId]);
    assert(result.rowCount, 409, 'REVISION_LOCKED', 'This version cannot be submitted.');
    await event(client, actor, content, 'submitted', revisionId);
    return { submitted: true };
  });
}
export function reviewRevision(db: Database, actor: Actor, id: string, revisionId: string, decision: 'publish' | 'reject', note: string) {
  return transaction(db, async client => {
    const { content, world } = await lockContent(client, actor, id, true);
    assert(content.head_revision_id === revisionId, 409, 'REVISION_CONFLICT', 'Review the current submitted version.');
    const { rows: [revision] } = await client.query('SELECT * FROM content_revisions WHERE id=$1', [revisionId]);
    assert(revision.status === 'submitted', 409, 'NOT_SUBMITTED', 'Submit this version for review first.');
    if (decision === 'reject') {
      await client.query("UPDATE content_revisions SET status='rejected' WHERE id=$1", [revisionId]);
      await event(client, actor, content, 'rejected', revisionId, note);
      return { published: false };
    }
    assert(!world.site_blocked && !content.site_blocked, 403, 'SITE_BLOCKED', 'Site moderation prevents publication.');
    const { rows: missing } = await client.query(`SELECT code FROM locales WHERE enabled AND required_for_publish
      AND NOT EXISTS (SELECT 1 FROM revision_locales rl WHERE rl.revision_id=$1 AND rl.locale=locales.code)`, [revisionId]);
    if (missing.length) throw new DomainError(409, 'TRANSLATIONS_REQUIRED', 'Complete the required translations before publishing.', missing.map(l => l.code));
    const publicationId = randomUUID();
    await client.query('INSERT INTO publications(id,content_id,revision_id,published_by) VALUES ($1,$2,$3,$4)', [publicationId, id, revisionId, actor.id]);
    await client.query(`INSERT INTO publication_locales(publication_id,revision_id,locale,translation_id)
      SELECT $1,revision_id,locale,translation_id FROM revision_locales WHERE revision_id=$2`, [publicationId, revisionId]);
    await client.query("UPDATE content_revisions SET status='approved' WHERE id=$1", [revisionId]);
    await client.query('UPDATE contents SET published_publication_id=$2 WHERE id=$1', [id, publicationId]);
    await event(client, actor, content, 'published', revisionId, note);
    return { published: true, publicationId };
  });
}
export function restorePublication(db: Database, actor: Actor, id: string, publicationId: string) {
  return transaction(db, async client => {
    const { content, world } = await lockContent(client, actor, id, true);
    assert(!world.site_blocked && !content.site_blocked, 403, 'SITE_BLOCKED', 'Site moderation prevents publication.');
    const { rows: [previous] } = await client.query('SELECT * FROM publications WHERE id=$1 AND content_id=$2', [publicationId, id]);
    assert(previous, 404, 'NOT_FOUND', 'Published version not found.');
    const next = randomUUID();
    await client.query('INSERT INTO publications(id,content_id,revision_id,published_by,restored_from) VALUES ($1,$2,$3,$4,$5)', [next, id, previous.revision_id, actor.id, publicationId]);
    await client.query(`INSERT INTO publication_locales(publication_id,revision_id,locale,translation_id)
      SELECT $1,revision_id,locale,translation_id FROM publication_locales WHERE publication_id=$2`, [next, publicationId]);
    await client.query('UPDATE contents SET published_publication_id=$2 WHERE id=$1', [id, next]);
    await event(client, actor, content, 'restored', previous.revision_id, publicationId);
    return { publicationId: next };
  });
}
export function unpublishContent(db: Database, actor: Actor, id: string, siteBlock: boolean, note: string) {
  return transaction(db, async client => {
    const { content } = await lockContent(client, actor, id, true);
    if (siteBlock) assert(actor.siteRole === 'admin', 403, 'SITE_ADMIN_REQUIRED', 'Only site administrators can impose a site restriction.');
    await client.query('UPDATE contents SET published_publication_id=NULL,site_blocked=(site_blocked OR $2) WHERE id=$1', [id, siteBlock]);
    await event(client, actor, content, siteBlock ? 'site_blocked' : 'unpublished', undefined, note);
    return { unpublished: true };
  });
}
export function releaseSiteBlock(db: Database, actor: Actor, id: string, note: string) {
  assert(actor.siteRole === 'admin', 403, 'SITE_ADMIN_REQUIRED', 'Only site administrators can lift a site restriction.');
  return transaction(db, async client => {
    const { content } = await lockContent(client, actor, id, true);
    await client.query('UPDATE contents SET site_blocked=false WHERE id=$1', [id]);
    await event(client, actor, content, 'site_unblocked', undefined, note);
    return { unblocked: true };
  });
}
