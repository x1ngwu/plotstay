import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editContentSchema, serviceAttributesSchema } from '@plotstay/contracts';
import { editContent, publishedDetail, restorePublication, unpublishContent } from '@plotstay/domain';
import { fixture, historyDigest } from './helpers.ts';
import { seedDiscovery } from '../scripts/seed-discovery.ts';
import { seedServiceDetails } from '../scripts/seed-service-details.ts';

test('service enrichment preserves originals and history while adding bilingual details and rated reviews',async t=>{
 const f=await fixture();t.after(f.cleanup);await seedDiscovery(f.db,f.data);
 const get=(locale='en')=>publishedDetail(f.db,locale,{world:'lathe-worlds',kind:'service',slug:'augmetic-tune-up'});
 const before=await get(),digest=await historyDigest(f.db);
 const tables=['content_revisions','translations','publications','moderation_events','world_home_revisions','world_home_publications'];
 const snapshots=new Map<string,any[]>();for(const table of tables)snapshots.set(table,(await f.db.query(`SELECT * FROM ${table} ORDER BY id`)).rows);
 const other=(await f.db.query('SELECT * FROM contents WHERE id<>$1 ORDER BY id',[before.content.id])).rows;
 assert.equal((await seedServiceDetails(f.db,f.data.admin)).status,'will append service demo');assert.deepEqual(await historyDigest(f.db),digest);
 assert.equal((await seedServiceDetails(f.db,f.data.admin,true)).added,6);
 const after=await get();assert.notEqual(after.content.publicationId,before.content.publicationId);
 const {service,imageAlts,...text}=after.content.text;const {imageAlts:oldAlts,...oldText}=before.content.text;assert.deepEqual(text,oldText);
 for(const [id,alt]of Object.entries(oldAlts))assert.equal(imageAlts[id],alt);
 assert.deepEqual(after.content.attributes.price,before.content.attributes.price);assert.equal(after.content.attributes.durationMinutes,before.content.attributes.durationMinutes);
 assert.deepEqual(after.content.attributes.images.slice(0,before.content.attributes.images.length),before.content.attributes.images);
 assert.equal(service?.qualifications.length,3);assert.equal(after.content.attributes.service?.sessions.length,2);assert.equal((await get('zh-CN')).content.text.service?.qualifications.length,3);
 assert.equal(after.reviews.total,6);assert.equal(after.reviewSummary.rating,4.83);assert.equal(after.reviewSummary.dimensions.accuracy?.rating,5);
 for(const [table,rows]of snapshots)assert.deepEqual((await f.db.query(`SELECT * FROM ${table} WHERE id=ANY($1) ORDER BY id`,[rows.map(r=>r.id)])).rows,rows);
 assert.deepEqual((await f.db.query('SELECT * FROM contents WHERE id=ANY($1) ORDER BY id',[other.map(r=>r.id)])).rows,other);
 const enriched=await historyDigest(f.db);await seedServiceDetails(f.db,f.data.admin,true);assert.deepEqual(await historyDigest(f.db),enriched);
 const low=after.reviews.contents.find(r=>r.attributes.rating===4)!;await unpublishContent(f.db,f.data.admin,low.id,false,'Hidden sample review');assert.equal((await get()).reviewSummary.rating,5);
 await seedServiceDetails(f.db,f.data.admin,true);assert.equal((await get()).reviews.total,5);
 await restorePublication(f.db,f.data.admin,before.content.id,before.content.publicationId);assert.deepEqual((await get()).content.text,before.content.text);
});
test('service enrichment skips unpublished edits and unavailable parent content',async t=>{
 const f=await fixture();t.after(f.cleanup);await seedDiscovery(f.db,f.data);
 const c=(await publishedDetail(f.db,'en',{world:'lathe-worlds',kind:'service',slug:'augmetic-tune-up'})).content;
 const row=(await f.db.query('SELECT head_revision_id FROM contents WHERE id=$1',[c.id])).rows[0];
 await editContent(f.db,f.data.admin,c.id,editContentSchema.parse({baseRevisionId:row.head_revision_id,sourceLocale:'en',text:{...c.text,title:'Keep this draft'},attributes:c.attributes}));
 const before=await historyDigest(f.db);assert.match((await seedServiceDetails(f.db,f.data.admin,true)).status,/unpublished/);assert.deepEqual(await historyDigest(f.db),before);
 await unpublishContent(f.db,f.data.admin,c.id,false,'Hidden parent');const hidden=await historyDigest(f.db);assert.match((await seedServiceDetails(f.db,f.data.admin,true)).status,/not published/);assert.deepEqual(await historyDigest(f.db),hidden);
});
test('service dates require valid ordered timestamps',()=>{
 assert.equal(serviceAttributesSchema.safeParse({sessions:[{startsAt:'tomorrow',endsAt:'later'}]}).success,false);
 assert.equal(serviceAttributesSchema.safeParse({sessions:[{startsAt:'2026-10-15T12:00:00Z',endsAt:'2026-10-15T10:00:00Z'}]}).success,false);
});
