import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editContentSchema } from '@plotstay/contracts';
import { editContent, publishedDetail, unpublishContent, restorePublication } from '@plotstay/domain';
import { fixture, historyDigest } from './helpers.ts';
import { seedDiscovery } from '../scripts/seed-discovery.ts';
import { seedStayDetails } from '../scripts/seed-stay-details.ts';

test('stay enrichment preserves authored data and immutable history', {timeout:120000}, async t => {
  const f=await fixture();t.after(f.cleanup);await seedDiscovery(f.db,f.data);
  const get=(slug='dockside-window',locale='en',page=1)=>publishedDetail(f.db,locale,{world:'lathe-worlds',kind:'stay',slug},page);
  const before=await get();
  const harbour=(await f.db.query(`SELECT c.*,r.source_locale,r.attributes FROM contents c JOIN content_revisions r ON r.id=c.head_revision_id WHERE c.slug='harbour-room'`)).rows[0];
  await editContent(f.db,f.data.admin,harbour.id,editContentSchema.parse({baseRevisionId:harbour.head_revision_id,sourceLocale:'en',attributes:harbour.attributes,text:{title:'Unpublished author edit',description:'Preserve this work.'}}));
  const legacyTables=['content_revisions','translations','publications','moderation_events','world_home_revisions','world_home_publications'];
  const snapshots=new Map<string,any[]>();
  for(const table of legacyTables)snapshots.set(table,(await f.db.query(`SELECT * FROM ${table} ORDER BY id`)).rows);
  await t.test('dry run is read-only, apply skips unpublished work and appends reviewed versions',async()=>{
    const digest=await historyDigest(f.db);const plan=await seedStayDetails(f.db,f.data.admin);assert.equal(plan.length,9);assert.deepEqual(await historyDigest(f.db),digest);
    const result=await seedStayDetails(f.db,f.data.admin,true);
    assert.equal(result.filter(r=>r.status==='appended and published').length,8);
    assert.equal(result.find(r=>r.slug==='harbour-room')?.status,'skipped: unpublished editing exists');
    assert.equal(result.reduce((n,r)=>n+(r.notes??0),0),48);
    const after=await get();assert.notEqual(after.content.publicationId,before.content.publicationId);
    const {stay,...text}=after.content.text;assert.deepEqual(text,before.content.text);
    const {stay:attributes,...rest}=after.content.attributes;assert.deepEqual(rest,before.content.attributes);assert.ok(attributes?.demo);
    assert.equal(stay?.amenities.length,24);assert.equal((await get('dockside-window','zh-CN')).content.text.stay?.amenities.length,24);
    for(const [table,rows] of snapshots){const ids=rows.map(r=>r.id);assert.deepEqual((await f.db.query(`SELECT * FROM ${table} WHERE id=ANY($1) ORDER BY id`,[ids])).rows,rows,table);}
    assert.equal((await f.db.query("SELECT published_publication_id FROM contents WHERE slug='unpublished-room'")).rows[0].published_publication_id,null);
  });
  await t.test('repeat execution neither duplicates notes nor overwrites publications',async()=>{
    const before=await historyDigest(f.db);await seedStayDetails(f.db,f.data.admin,true);assert.deepEqual(await historyDigest(f.db),before);
  });
  await t.test('ratings and topic counts span every page and exclude hidden notes',async()=>{
    const a=await get('observation-room'),b=await get('observation-room','en',2);
    assert.equal(a.reviews.total,7);assert.equal(b.reviews.contents.length,1);assert.deepEqual(a.reviewSummary,b.reviewSummary);
    assert.equal(a.reviewSummary.rating,4.86);assert.equal(a.reviewSummary.ratedCount,7);
    assert.equal(a.reviewSummary.dimensions.cleanliness?.rating,4.83);
    assert.equal(a.reviewSummary.dimensions.checkIn?.count,6);
    assert.equal(a.reviewSummary.distribution.find(d=>d.rating===5)?.count,6);
    assert.equal(a.reviewSummary.mentions.find(t=>t.label==='Cleanliness')?.count,6);
    const note=[...a.reviews.contents,...b.reviews.contents].find(n=>n.attributes.rating===4)!;
    await unpublishContent(f.db,f.data.admin,note.id,false,'Test hidden reviews');
    const hidden=await get('observation-room');assert.equal(hidden.reviewSummary.rating,5);assert.equal(hidden.reviewSummary.ratedCount,6);
    assert.equal(hidden.reviewSummary.mentions.find(t=>t.label==='Cleanliness')?.count,5);
    assert.equal(hidden.reviewSummary.dimensions.cleanliness?.rating,5);
    await restorePublication(f.db,f.data.admin,note.id,note.publicationId);
    assert.deepEqual((await get('observation-room')).reviewSummary,a.reviewSummary);
  });
  await t.test('restoring a legacy publication removes enrichment without changing old text',async()=>{
    await restorePublication(f.db,f.data.admin,before.content.id,before.content.publicationId);
    assert.deepEqual((await get()).content.text,before.content.text);
  });
});
