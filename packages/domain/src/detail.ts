import { transaction, type Database } from '@plotstay/database';
import type { ContentDetail } from '@plotstay/contracts';
import { getPublished, publicSelect, mapContent } from './read.ts';
import { assert } from './errors.ts';

// Main publication, notes and recommendations share one read snapshot.
export function publishedDetail(db: Database, locale: string,
  where: { world: string; kind: string; slug: string }, notesPage = 1): Promise<ContentDetail> {
  return transaction(db, async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    assert(Number.isSafeInteger(notesPage) && notesPage > 0 && notesPage <= 1000000, 400, 'INVALID_PAGE', 'Invalid notes page.');
    const content = await getPublished(client, locale, where);
    assert(content && content.kind !== 'review', 404, 'NOT_FOUND', 'Content not found.');
    const pageSize = 6;
    const { rows: [notes] } = await client.query(`WITH matching AS MATERIALIZED (
      ${publicSelect} AND c.parent_content_id=$2 AND c.world_id=$3 AND c.kind='review'
    ), paged AS (SELECT * FROM matching ORDER BY published_at DESC,id LIMIT $4 OFFSET $5)
    SELECT (SELECT count(*)::int FROM matching) AS total,
      (SELECT round(avg((attributes->>'rating')::numeric),2)::float FROM matching) AS rating,
      (SELECT count(attributes->>'rating')::int FROM matching) AS rated_count,
      (SELECT coalesce(jsonb_agg(d),'[]') FROM (SELECT (attributes->>'rating')::int AS rating,count(*)::int AS count
        FROM matching WHERE attributes ? 'rating' GROUP BY attributes->>'rating') d) AS distribution,
      (SELECT coalesce(jsonb_object_agg(key,stats),'{}') FROM (
        SELECT key,jsonb_build_object('rating',round(avg(value::numeric),2)::float,'count',count(*)::int) AS stats
        FROM matching CROSS JOIN LATERAL jsonb_each_text(coalesce(attributes->'reviewRatings','{}'))
        GROUP BY key) d) AS dimensions,
      (SELECT coalesce(jsonb_agg(topic ORDER BY count DESC,label),'[]') FROM (
        SELECT label,count(*)::int AS count FROM matching
        CROSS JOIN LATERAL (SELECT DISTINCT jsonb_array_elements_text(coalesce(body->'tags','[]')) AS label) tags
        GROUP BY label ORDER BY count DESC,label LIMIT 12
      ) topic) AS mentions,
      coalesce((SELECT jsonb_agg(to_jsonb(paged) ORDER BY published_at DESC,id) FROM paged),'[]') AS items`,
    [locale, content.id, content.worldId, pageSize, (notesPage - 1) * pageSize]);
    const pages = Math.max(1, Math.ceil(notes.total / pageSize));
    assert(notesPage <= pages, 404, 'PAGE_NOT_FOUND', 'Notes page not found.');
    const { rows } = await client.query(`${publicSelect}
      AND c.world_id=$2 AND c.id<>$3 AND c.kind IN ('stay','experience','service')
      ORDER BY (c.place_id=$4) DESC NULLS LAST,p.published_at DESC,c.id LIMIT 6`,
    [locale, content.worldId, content.id, content.placeId]);
    return { content, related: rows.map(row => mapContent(row, locale)),
      reviewSummary: { rating: notes.rating, ratedCount: notes.rated_count, mentions: notes.mentions, distribution:notes.distribution,dimensions:notes.dimensions },
      reviews: { total: notes.total, page: notesPage, pageSize, pages,
        contents: notes.items.map((row: any) => mapContent({ ...row, published_at: new Date(row.published_at) }, locale)) } };
  });
}
