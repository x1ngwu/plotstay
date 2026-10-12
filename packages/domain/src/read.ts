import {signatureProfiles} from './persona-reviews.ts';
import type { Connection } from '@plotstay/database';
import type { Discovery, Locale, PublicContent, World } from '@plotstay/contracts';
import { requireWorld, type Actor } from './auth.ts';
import { assert } from './errors.ts';

export async function enabledLocale(db: Connection, locale: string) {
  const r = await db.query('SELECT code FROM locales WHERE code=$1 AND enabled', [locale]);
  assert(r.rowCount, 404, 'INVALID_LOCALE', 'Language not found.');
}
export async function listLocales(db: Connection): Promise<Locale[]> {
  return (await db.query('SELECT code,name,path_prefix AS "pathPrefix",language_tag AS "languageTag" FROM locales WHERE enabled ORDER BY code')).rows;
}
// All public readers, including discovery, use the same publication and visibility boundary.
export const publicFrom = `FROM contents c JOIN worlds w ON w.id=c.world_id
  JOIN publications p ON p.id=c.published_publication_id
  JOIN content_revisions r ON r.id=p.revision_id`;
export const publicVisibility = `w.visible AND NOT w.site_blocked AND NOT c.site_blocked
  AND (c.parent_content_id IS NULL OR EXISTS (
    SELECT 1 FROM contents parent WHERE parent.id=c.parent_content_id AND parent.published_publication_id IS NOT NULL AND NOT parent.site_blocked))`;
const publishedLocales = `ARRAY(SELECT pt.locale FROM publication_locales pt JOIN locales l ON l.code=pt.locale AND l.enabled
  WHERE pt.publication_id=p.id ORDER BY pt.locale)`;
const worldLocales = `ARRAY(SELECT l.code FROM locales l WHERE l.enabled AND w.translations ? l.code ORDER BY l.code)`;
const listingLocales = `ARRAY(SELECT l.code FROM locales l WHERE l.enabled AND w.translations ? l.code
  AND NOT EXISTS (SELECT 1 ${publicFrom} WHERE ${publicVisibility}
    AND c.world_id=outer_world.id AND c.kind IN ('stay','experience','service')
    AND NOT EXISTS (SELECT 1 FROM publication_locales pt WHERE pt.publication_id=p.id AND pt.locale=l.code)) ORDER BY l.code)`;
const homeLocales = `ARRAY(SELECT l.code FROM locales l WHERE l.enabled AND w.translations ? l.code AND
  (NOT EXISTS (SELECT 1 FROM world_home_settings hs WHERE hs.world_id=w.id AND hs.published_id IS NOT NULL) OR
   EXISTS (SELECT 1 FROM world_home_settings hs JOIN world_home_publications hp ON hp.id=hs.published_id
     JOIN world_home_revisions hr ON hr.id=hp.revision_id WHERE hs.world_id=w.id AND hr.body->'translations' ? l.code)) ORDER BY l.code)`;
export async function listWorlds(db: Connection, locale: string): Promise<World[]> {
  await enabledLocale(db, locale);
  const { rows } = await db.query(`SELECT w.id,w.slug,w.theme_id,w.source_locale,
    coalesce(w.translations->$1,w.translations->w.source_locale) AS text,
    CASE WHEN w.translations ? $1 THEN $1 ELSE w.source_locale END AS locale,
    (SELECT language_tag FROM locales WHERE code=CASE WHEN w.translations ? $1 THEN $1 ELSE w.source_locale END) AS language_tag,
    ${worldLocales} AS available_locales, ${listingLocales} AS listing_locales, ${homeLocales} AS home_locales
    FROM worlds w JOIN worlds outer_world ON outer_world.id=w.id
    WHERE w.visible AND NOT w.site_blocked ORDER BY w.created_at,w.id`, [locale]);
  return rows.map(w => ({ id: w.id, slug: w.slug, themeId: w.theme_id, sourceLocale: w.source_locale,
    locale: w.locale, name: w.text.name, description: w.text.description, currencyName: w.text.currencyName,
    languageTag: w.language_tag, availableLocales: w.available_locales, listingLocales: w.listing_locales, homeLocales: w.home_locales }));
}
export async function publicDiscovery(db: Connection): Promise<Discovery> {
  // One statement gives discovery a consistent snapshot, including enabled languages.
  const { rows: [row] } = await db.query(`SELECT
    (SELECT coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'pathPrefix',path_prefix,'languageTag',language_tag) ORDER BY code),'[]') FROM locales WHERE enabled) AS locales,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('slug',w.slug,'availableLocales',${worldLocales},'listingLocales',${listingLocales},'homeLocales',${homeLocales}) ORDER BY w.slug),'[]')
      FROM worlds w JOIN worlds outer_world ON outer_world.id=w.id WHERE w.visible AND NOT w.site_blocked) AS worlds,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('worldSlug',w.slug,'slug',c.slug,'kind',c.kind,'availableLocales',${publishedLocales}) ORDER BY w.slug,c.kind,c.slug),'[]')
      ${publicFrom} WHERE ${publicVisibility} AND c.kind IN ('stay','experience','service')) AS contents`);
  return row;
}
export const publicSelect = `SELECT c.id,c.world_id,c.slug,c.kind,w.slug AS world_slug,c.place_id,pl.slug AS place_slug,
  coalesce(pl.names->$1,pl.names->r.source_locale) #>> '{}' AS place_name,
  (SELECT coalesce(hr.body->'translations'->$1,hr.body->'translations'->(hr.body->>'sourceLocale'))->'categoryNames'->>(r.attributes->>'category')
    FROM world_home_settings hs JOIN world_home_publications hp ON hp.id=hs.published_id JOIN world_home_revisions hr ON hr.id=hp.revision_id WHERE hs.world_id=w.id) AS category_name,
  t.locale,t.body,r.attributes,p.id AS publication_id,p.published_at,
  (SELECT language_tag FROM locales WHERE code=t.locale) AS language_tag,
  ${publishedLocales} AS available_locales,
  coalesce(sig.profiles->$1,sig.profiles->r.source_locale,person.profiles->$1,person.profiles->r.source_locale)->>'name' AS persona_name,
  sig.profiles AS signature_profiles,sig.managed AS persona_managed,provider.profiles AS provider_profiles
  ${publicFrom}
  JOIN LATERAL (
    SELECT tx.locale,tx.body FROM publication_locales pt JOIN translations tx ON tx.id=pt.translation_id
    WHERE pt.publication_id=p.id AND tx.locale IN ($1,r.source_locale)
    ORDER BY (tx.locale=$1) DESC LIMIT 1
  ) t ON true
  LEFT JOIN places pl ON pl.id=c.place_id
  LEFT JOIN provider_bindings binding ON binding.content_id=c.id
  LEFT JOIN personas provider ON provider.id=binding.persona_id AND provider.approved
  LEFT JOIN review_signatures sig ON sig.revision_id=r.id
  LEFT JOIN personas person ON person.id=c.persona_id AND person.approved
  WHERE ${publicVisibility}`;
export function mapContent(row: any, requestedLocale: string): PublicContent {
  const {editorListIds: _editorListIds,...publicText}=row.body;
  const profile=row.signature_profiles?.[row.locale]??Object.values(row.signature_profiles??{})[0] as any;
  const providerProfiles=row.provider_profiles?signatureProfiles(row.provider_profiles):{};
  const provider=providerProfiles[row.locale]??Object.values(providerProfiles)[0] as any;
  return { ...(provider?{provider}:{}), ...(profile?{signature:profile}:{}), id: row.id, worldId: row.world_id, worldSlug: row.world_slug, slug: row.slug,
    kind: row.kind, placeId: row.place_id, placeSlug: row.place_slug, placeName: row.place_name, locale: row.locale, requestedLocale,
    isFallback: row.locale !== requestedLocale, languageTag: row.language_tag, availableLocales: row.available_locales, text: { tags: [], highlights: [], included: [], serviceItems: [], ...publicText, ...(provider?{hostName:provider.name,hostBio:provider.bio,...(row.body.clearedFields?{clearedFields:row.body.clearedFields.filter((f:string)=>!['hostName','hostBio'].includes(f))}:{})}:{}), ...(row.persona_managed&&profile?{review:{...row.body.review,name:profile.name}}:{}) }, attributes: row.attributes,
    publicationId: row.publication_id, publishedAt: row.published_at.toISOString(), categoryName: row.category_name, personaName: row.persona_name };
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
  else query += " AND c.kind IN ('stay','experience','service')";
  if (filters.q) {
    add(` AND (t.body->>'title' || ' ' || coalesce(t.body->>'summary','') || ' ' || coalesce(t.body->>'description','') || ' ' || coalesce(coalesce(pl.names->$1,pl.names->r.source_locale) #>> '{}','') || ' ' || coalesce(t.body->>'tags','')) ILIKE ? ESCAPE '\\'`, `%${filters.q.replace(/[\\%_]/g, '\\$&')}%`);
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
export async function adminList(db: Connection, actor: Actor, worldId: string, filters: {page?:number;kind?:string;q?:string;status?:string;parentId?:string}={}) {
  await requireWorld(db, actor, worldId);
  const page=filters.page??1,pageSize=25;
  const { rows: [result] } = await db.query(`WITH matching AS MATERIALIZED (
    SELECT c.id,c.kind,c.slug,c.parent_content_id,c.site_blocked,c.published_publication_id,
    r.id AS revision_id,r.number,r.status,r.source_locale,r.source_text->>'title' AS title,r.created_at
    FROM contents c JOIN content_revisions r ON r.id=c.head_revision_id WHERE c.world_id=$1
    AND ($2::text IS NULL OR c.kind=$2) AND ($3::text IS NULL OR r.source_text->>'title' ILIKE $3 OR c.slug ILIKE $3 OR EXISTS(SELECT 1 FROM revision_locales rl JOIN translations tx ON tx.id=rl.translation_id WHERE rl.revision_id=r.id AND tx.body->>'title' ILIKE $3))
    AND ($4::text IS NULL OR ($4='published' AND c.published_publication_id IS NOT NULL) OR ($4='unpublished' AND c.published_publication_id IS NULL) OR r.status=$4)
    AND ($5::uuid IS NULL OR c.parent_content_id=$5)
  ) SELECT (SELECT count(*)::int FROM matching) AS total,
    coalesce((SELECT jsonb_agg(p ORDER BY created_at DESC,id) FROM (SELECT * FROM matching ORDER BY created_at DESC,id LIMIT $6 OFFSET $7)p),'[]') AS contents`,
    [worldId,filters.kind??null,filters.q?`%${filters.q}%`:null,filters.status??null,filters.parentId??null,pageSize,(page-1)*pageSize]);
  return {...result,page,pageSize,pages:Math.max(1,Math.ceil(result.total/pageSize))};
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
    db.query(`SELECT j.id,j.revision_id,j.locale,j.status,j.attempts,j.max_attempts,j.last_error,j.provider,j.available_at FROM translation_jobs j
      JOIN content_revisions r ON r.id=j.revision_id WHERE r.content_id=$1 ORDER BY j.created_at DESC`, [id])
  ]);
  return { content, canReview: actor.siteRole === 'admin' || ['owner','admin'].includes(world.role),
    revisions: results[0].rows, publications: results[1].rows, events: results[2].rows, jobs: results[3].rows };
}
