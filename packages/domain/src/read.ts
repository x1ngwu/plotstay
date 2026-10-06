import type { Connection } from '@plotstay/database';
import type { PublicContent, World } from '@plotstay/contracts';
import { requireWorld, type Actor } from './auth.ts';
import { assert } from './errors.ts';

export async function enabledLocale(db: Connection, locale: string) {
  const r = await db.query('SELECT code FROM locales WHERE code=$1 AND enabled', [locale]);
  assert(r.rowCount, 404, 'INVALID_LOCALE', 'Language not found.');
}
export async function listWorlds(db: Connection, locale: string): Promise<World[]> {
  await enabledLocale(db, locale);
  const { rows } = await db.query(`SELECT id,slug,theme_id,source_locale,
    coalesce(translations->$1,translations->source_locale) AS text,
    CASE WHEN translations ? $1 THEN $1 ELSE source_locale END AS locale
    FROM worlds WHERE visible AND NOT site_blocked ORDER BY created_at,id`, [locale]);
  return rows.map(w => ({ id: w.id, slug: w.slug, themeId: w.theme_id, sourceLocale: w.source_locale,
    locale: w.locale, name: w.text.name, description: w.text.description, currencyName: w.text.currencyName }));
}
const publicSelect = `SELECT c.id,c.world_id,c.slug,c.kind,w.slug AS world_slug,
  coalesce(pl.names->$1,pl.names->r.source_locale) #>> '{}' AS place_name,
  t.locale,t.body,r.attributes,p.id AS publication_id,p.published_at,
  coalesce(person.profiles->$1,person.profiles->r.source_locale)->>'name' AS persona_name
  FROM contents c JOIN worlds w ON w.id=c.world_id
  JOIN publications p ON p.id=c.published_publication_id
  JOIN content_revisions r ON r.id=p.revision_id
  JOIN LATERAL (
    SELECT tx.locale,tx.body FROM publication_locales pt JOIN translations tx ON tx.id=pt.translation_id
    WHERE pt.publication_id=p.id AND tx.locale IN ($1,r.source_locale)
    ORDER BY (tx.locale=$1) DESC LIMIT 1
  ) t ON true
  LEFT JOIN places pl ON pl.id=c.place_id
  LEFT JOIN personas person ON person.id=c.persona_id AND person.approved
  WHERE w.visible AND NOT w.site_blocked AND NOT c.site_blocked
  AND (c.parent_content_id IS NULL OR EXISTS (
    SELECT 1 FROM contents parent WHERE parent.id=c.parent_content_id AND parent.published_publication_id IS NOT NULL AND NOT parent.site_blocked))`;
function mapContent(row: any, requestedLocale: string): PublicContent {
  return { id: row.id, worldId: row.world_id, worldSlug: row.world_slug, slug: row.slug,
    kind: row.kind, placeName: row.place_name, locale: row.locale, requestedLocale,
    isFallback: row.locale !== requestedLocale, text: row.body, attributes: row.attributes,
    publicationId: row.publication_id, publishedAt: row.published_at.toISOString(), personaName: row.persona_name };
}
export async function listPublished(db: Connection, locale: string, filters: {
  world?: string; kind?: string; q?: string; parentId?: string; limit?: number; offset?: number
} = {}) {
  await enabledLocale(db, locale);
  const args: unknown[] = [locale];
  let query = publicSelect;
  const add = (sql: string, value: unknown) => { args.push(value); query += sql.replace('?', `$${args.length}`); };
  if (filters.world) add(' AND w.slug=?', filters.world);
  if (filters.parentId) add(" AND c.kind='review' AND c.parent_content_id=?", filters.parentId);
  else if (filters.kind) add(' AND c.kind=?', filters.kind);
  else query += " AND c.kind IN ('stay','experience')";
  if (filters.q) {
    add(` AND (t.body->>'title' || ' ' || coalesce(t.body->>'summary','') || ' ' || coalesce(t.body->>'description','') || ' ' || coalesce(pl.names::text,'')) ILIKE ? ESCAPE '\\'`, `%${filters.q.replace(/[\\%_]/g, '\\$&')}%`);
  }
  query += ' ORDER BY p.published_at DESC,c.id';
  add(' LIMIT ?', filters.limit ?? 50);
  add(' OFFSET ?', filters.offset ?? 0);
  const { rows } = await db.query(query, args);
  return rows.map(r => mapContent(r, locale));
}
export async function getPublished(db: Connection, locale: string, where: { id?: string; world?: string; kind?: string; slug?: string }): Promise<PublicContent | null> {
  await enabledLocale(db, locale);
  const { rows: [row] } = where.id
    ? await db.query(publicSelect + ' AND c.id=$2', [locale, where.id])
    : await db.query(publicSelect + ' AND w.slug=$2 AND c.kind=$3 AND c.slug=$4', [locale, where.world, where.kind, where.slug]);
  return row ? mapContent(row, locale) : null;
}
export async function adminWorlds(db: Connection, actor: Actor) {
  const { rows } = await db.query(`SELECT w.id,w.slug,w.translations,w.theme_id,w.site_blocked,w.visible,m.role
    FROM worlds w LEFT JOIN world_members m ON m.world_id=w.id AND m.user_id=$1
    WHERE $2 OR m.role IS NOT NULL OR w.owner_id=$1 ORDER BY w.created_at,w.id`, [actor.id, actor.siteRole === 'admin']);
  return rows;
}
export async function adminList(db: Connection, actor: Actor, worldId: string) {
  await requireWorld(db, actor, worldId);
  const { rows } = await db.query(`SELECT c.id,c.kind,c.slug,c.site_blocked,c.published_publication_id,
    r.id AS revision_id,r.number,r.status,r.source_locale,r.source_text->>'title' AS title
    FROM contents c JOIN content_revisions r ON r.id=c.head_revision_id WHERE c.world_id=$1 ORDER BY r.created_at DESC,c.id LIMIT 200`, [worldId]);
  return rows;
}
export async function adminDetail(db: Connection, actor: Actor, id: string) {
  const { rows: [content] } = await db.query('SELECT * FROM contents WHERE id=$1', [id]);
  assert(content, 404, 'NOT_FOUND', 'Content not found.');
  const world = await requireWorld(db, actor, content.world_id);
  const results = await Promise.all([
    db.query(`SELECT r.*,coalesce((SELECT jsonb_object_agg(rl.locale,t.body) FROM revision_locales rl
      JOIN translations t ON t.id=rl.translation_id WHERE rl.revision_id=r.id),'{}') AS translations
      FROM content_revisions r WHERE content_id=$1 ORDER BY number DESC`, [id]),
    db.query('SELECT * FROM publications WHERE content_id=$1 ORDER BY published_at DESC,id', [id]),
    db.query('SELECT action,note,actor_id,revision_id,created_at FROM moderation_events WHERE content_id=$1 ORDER BY created_at DESC', [id]),
    db.query(`SELECT j.id,j.revision_id,j.locale,j.status,j.attempts,j.last_error FROM translation_jobs j
      JOIN content_revisions r ON r.id=j.revision_id WHERE r.content_id=$1 ORDER BY j.created_at DESC`, [id])
  ]);
  return { content, canReview: actor.siteRole === 'admin' || ['owner','admin'].includes(world.role),
    revisions: results[0].rows, publications: results[1].rows, events: results[2].rows, jobs: results[3].rows };
}
