import { transaction, type Database, type Connection } from '@plotstay/database';
import { PAGE_SIZE, type BrowseState, type BrowseResponse, type ContentPage, type PublicPlace, type HomeSection } from '@plotstay/contracts';
import { publicSelect, mapContent, listWorlds } from './read.ts';
import { publicHome } from './home.ts';
import { assert } from './errors.ts';

const kind = (type: BrowseState['type']) => ({ stays: 'stay', experiences: 'experience', services: 'service', all: null })[type];
export async function publishedPage(db: Connection, locale: string, s: BrowseState, size = PAGE_SIZE, recommendedIds: string[] = []): Promise<ContentPage> {
  const args: unknown[] = [locale, s.world];
  let sql = publicSelect + " AND w.slug=$2 AND c.kind IN ('stay','experience','service')";
  const add = (clause: string, value: unknown) => { args.push(value); sql += clause.replace('?', `$${args.length}`); };
  if (kind(s.type)) add(' AND c.kind=?', kind(s.type));
  if (s.place) add(' AND pl.slug=?', s.place);
  if (s.category) add(" AND r.attributes->>'category'=?", s.category);
  if (s.q) add(` AND concat_ws(' ',t.body->>'title',t.body->>'summary',t.body->>'description',t.body->>'tags',
    coalesce(pl.names->$1,pl.names->r.source_locale)#>>'{}') ILIKE ? ESCAPE '\\'`, `%${s.q.replace(/[\\%_]/g,'\\$&')}%`);
  args.push(recommendedIds, size, (s.page - 1) * size);
  const n = args.length;
  const { rows: [result] } = await db.query(`WITH matching AS MATERIALIZED (${sql}), paged AS (
    SELECT * FROM matching ORDER BY array_position($${n-2}::uuid[],id) NULLS LAST,place_id NULLS LAST,published_at DESC,id
    LIMIT $${n-1} OFFSET $${n})
    SELECT (SELECT count(*)::int FROM matching) AS total,
      coalesce((SELECT jsonb_agg(to_jsonb(paged) ORDER BY array_position($${n-2}::uuid[],id) NULLS LAST,place_id NULLS LAST,published_at DESC,id) FROM paged),'[]') AS items`, args);
  const total = result.total as number;
  return { total, page: s.page, pageSize: size, pages: Math.max(1, Math.ceil(total / size)),
    contents: result.items.map((r: any) => mapContent({ ...r, published_at: new Date(r.published_at) }, locale)) };
}
export function browseWorld(db: Database, locale: string, s: BrowseState): Promise<BrowseResponse> {
  return transaction(db, async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const world = (await listWorlds(client, locale)).find(w => w.slug === s.world);
    assert(world, 404, 'NOT_FOUND', 'World not found.');
    const home = await publicHome(client, world.id, locale);
    const { rows: placeRows } = await client.query(`WITH matching AS (${publicSelect} AND w.slug=$2 AND c.kind IN ('stay','experience','service'))
      SELECT place_id AS id,place_slug AS slug,place_name AS name,count(*) FILTER (WHERE kind='stay')::int AS "stayCount"
      FROM matching WHERE place_id IS NOT NULL GROUP BY place_id,place_slug,place_name ORDER BY place_id`, [locale, world.slug]);
    const places: PublicPlace[] = placeRows;
    // All world places are valid filters; an empty place is a valid empty result, not an invented destination.
    const validPlaces = (await client.query('SELECT slug FROM places WHERE world_id=$1', [world.id])).rows;
    assert(!s.place || validPlaces.some(p => p.slug === s.place), 404, 'INVALID_PLACE', 'Place not found in this world.');
    const { rows: counts } = await client.query(`WITH matching AS (${publicSelect} AND w.slug=$2 AND c.kind IN ('stay','experience','service'))
      SELECT attributes->>'category' AS slug,kind,count(*)::int AS count FROM matching
      WHERE ($3::text IS NULL OR place_slug=$3) GROUP BY attributes->>'category',kind`, [locale, world.slug, s.place ?? null]);
    const categories = (home?.config.categories ?? []).map(c => ({ ...c, name: home!.text.categoryNames[c.slug]!,
      count: counts.find(v => v.slug === c.slug && v.kind === c.kind)?.count ?? 0 }));
    assert(!s.category || categories.some(c => c.slug === s.category && (s.type === 'all' || c.kind === kind(s.type))), 404, 'INVALID_CATEGORY', 'Category not found for this type.');
    const listing = await publishedPage(client, locale, s);
    assert(s.page <= listing.pages, 404, 'PAGE_OUT_OF_RANGE', 'Page not found.');
    const sections: HomeSection[] = [];
    if (s.view !== 'results') {
      const configured = home?.config.sections ?? [
        { id: 'experiences', type: 'experiences' as const, limit: 6, recommendedIds: [] },
        { id: 'homes', type: 'stays' as const, limit: 6, recommendedIds: [] },
      ];
      for (const section of configured) {
        const page = await publishedPage(client, locale, { ...s, q: '', page: 1, type: section.type, place: section.place, category: section.category }, section.limit, section.recommendedIds);
        sections.push({ ...section, title: home?.text.sectionTitles[section.id] ?? '', contents: page.contents });
      }
      const order = home?.config.placeOrder ?? [];
      const sorted = places.filter(p => p.stayCount).sort((a,b) => {
        const rank = (p: PublicPlace) => order.includes(p.slug) ? order.indexOf(p.slug) : order.length;
        return rank(a) - rank(b) || a.id.localeCompare(b.id);
      });
      for (const place of sorted.slice(0, home?.config.placeRows ?? 3)) {
        const page = await publishedPage(client, locale, { ...s, q: '', page: 1, type: 'stays', place: place.slug, category: undefined }, 6);
        sections.push({ id: 'place-' + place.slug, title: place.name, type: 'stays', place: place.slug, contents: page.contents });
      }
    }
    return { world, home, places, categories, listing, sections };
  });
}
