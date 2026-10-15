import {readReplies,signatureProfiles} from './persona-reviews.ts';
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
      (SELECT coalesce(jsonb_agg(d ORDER BY rating DESC),'[]') FROM (SELECT (attributes->>'rating')::int AS rating,count(*)::int AS count
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
    const replies=await readReplies(client,locale,notes.items.map((r:any)=>r.id));
    return { content, related: rows.map(row => mapContent(row, locale)),
      reviewSummary: { rating: notes.rating, ratedCount: notes.rated_count, mentions: notes.mentions, distribution:notes.distribution,dimensions:notes.dimensions },
      reviews: { total: notes.total, page: notesPage, pageSize, pages,
        contents: notes.items.map((row: any) => ({...mapContent({ ...row, published_at: new Date(row.published_at) }, locale),...(replies[row.id]?{reply:replies[row.id]}:{})})) } };
  });
}

// A preview is tied to the saved head AND its translation token. No public lookup accepts these IDs.
export async function previewDetail(db: Database, actor: import('./auth.ts').Actor, id: string, revisionId: string, token: string, locale: string, own = false): Promise<ContentDetail> {
  return transaction(db, async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { adminDetail, listWorlds, listLocales } = await import('./read.ts');
    const data = own?await (await import('./works.ts')).workDetail(client,actor,id):await adminDetail(client, actor, id);
    const c = data.content;
    assert(c.head_revision_id === revisionId && c.draft_token === token, 409, 'REVISION_CONFLICT', 'This preview is out of date. Save or reload the editor.');
    const worlds = await listWorlds(client, locale);
    const world = worlds.find(w => w.id === c.world_id);
    assert(world && !c.site_blocked, 403, 'SITE_BLOCKED', 'Restricted content cannot be previewed.');
    if(c.parent_content_id) assert(await getPublished(client,locale,{id:c.parent_content_id}),403,'PARENT_UNPUBLISHED','The parent must be public.');
    const r=data.revisions[0];const actual=r.translations[locale]?locale:r.source_locale;
    const languages=await listLocales(client);
    const place=c.place_id?(await client.query('SELECT slug,names FROM places WHERE id=$1',[c.place_id])).rows[0]:null;
    const persona=c.kind==='review'&&c.persona_id?(await client.query('SELECT profiles FROM personas WHERE id=$1 AND approved',[c.persona_id])).rows[0]:null;
    let result:ContentDetail={content:null as any,related:[],reviews:{total:0,page:1,pageSize:6,pages:1,contents:[]},reviewSummary:{rating:null,ratedCount:0,mentions:[],distribution:[],dimensions:{}}};
    if(c.published_publication_id && c.kind!=='review') result=await publishedDetail(db,locale,{world:world.slug,kind:c.kind,slug:c.slug});
    result.content={id:c.id,worldId:c.world_id,worldSlug:world.slug,kind:c.kind,slug:c.slug,placeId:c.place_id,placeSlug:place?.slug??null,placeName:place?.names[locale]??place?.names[r.source_locale]??null,personaName:persona?.profiles[locale]?.name??null,locale:actual,requestedLocale:locale,isFallback:actual!==locale,languageTag:languages.find(l=>l.code===actual)!.languageTag,availableLocales:Object.keys(r.translations),text:r.translations[actual],attributes:r.attributes,publicationId:'',publishedAt:r.created_at.toISOString(),preview:true};
    if(c.kind==='review'){
      const signature=(await client.query('SELECT profiles,managed FROM review_signatures WHERE revision_id=$1',[revisionId])).rows[0];
      const profile=signature?.profiles?.[actual]??Object.values(signature?.profiles??{})[0] as any;
      if(profile){result.content.signature=profile;if(signature.managed&&result.content.text.review)result.content.text={...result.content.text,review:{...result.content.text.review,name:profile.name}};}
    }
    const binding=(await client.query('SELECT p.profiles FROM provider_bindings b JOIN personas p ON p.id=b.persona_id AND p.approved WHERE b.content_id=$1',[id])).rows[0];
    if(binding){const profiles=signatureProfiles(binding.profiles),profile=profiles[actual]??Object.values(profiles)[0];result.content.provider=profile;result.content.text={...result.content.text,hostName:profile.name,hostBio:profile.bio,...(result.content.text.clearedFields?{clearedFields:result.content.text.clearedFields.filter(f=>!['hostName','hostBio'].includes(f))}:{})};}
    return result;
  });
}
