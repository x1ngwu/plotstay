import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editContentSchema, experienceAttributesSchema } from '@plotstay/contracts';
import { editContent, publishedDetail, restorePublication, unpublishContent } from '@plotstay/domain';
import { fixture, historyDigest } from './helpers.ts';
import { seedExperienceReviews } from '../scripts/seed-experience-reviews.ts';
import { seedExperienceDetails } from '../scripts/seed-experience-details.ts';

test('experience sample enrichment preserves original content, history, other entries and repeat runs',async t=>{
 const f=await fixture();t.after(f.cleanup);
 const get=()=>publishedDetail(f.db,'en',{world:'lathe-worlds',kind:'experience',slug:'forge-walk'});
 const before=await get(),digest=await historyDigest(f.db);
 const tables=['content_revisions','translations','publications','moderation_events'];
 const snapshots=new Map<string,any[]>();for(const table of tables)snapshots.set(table,(await f.db.query(`SELECT * FROM ${table} ORDER BY id`)).rows);
 const other=(await f.db.query("SELECT * FROM contents WHERE id<>$1 ORDER BY id",[before.content.id])).rows;
 assert.equal((await seedExperienceDetails(f.db,f.data.admin)).status,'will append experience demo');
 assert.deepEqual(await historyDigest(f.db),digest);
 assert.equal((await seedExperienceDetails(f.db,f.data.admin,true)).status,'appended and published');
 const after=await get();assert.notEqual(after.content.publicationId,before.content.publicationId);
 const {experience,imageAlts,...text}=after.content.text;const {imageAlts:oldAlts,...oldText}=before.content.text;
 assert.deepEqual(text,oldText);for(const [id,alt]of Object.entries(oldAlts))assert.equal(imageAlts[id],alt);
 assert.deepEqual(after.content.attributes.price,before.content.attributes.price);
 assert.equal(after.content.attributes.durationMinutes,before.content.attributes.durationMinutes);
 assert.equal(experience?.steps.length,5);assert.equal(after.content.attributes.experience?.sessions.length,2);
 const zh=await publishedDetail(f.db,'zh-CN',{world:'lathe-worlds',kind:'experience',slug:'forge-walk'});assert.equal(zh.content.text.experience?.steps.length,5);
 for(const [table,rows]of snapshots)assert.deepEqual((await f.db.query(`SELECT * FROM ${table} WHERE id=ANY($1) ORDER BY id`,[rows.map(r=>r.id)])).rows,rows);
 assert.deepEqual((await f.db.query("SELECT * FROM contents WHERE id<>$1 ORDER BY id",[before.content.id])).rows,other);
 const enriched=await historyDigest(f.db);await seedExperienceDetails(f.db,f.data.admin,true);assert.deepEqual(await historyDigest(f.db),enriched);
 await restorePublication(f.db,f.data.admin,before.content.id,before.content.publicationId);assert.deepEqual((await get()).content.text,before.content.text);
});
test('experience enrichment skips unpublished work and hidden samples',async t=>{
 const f=await fixture();t.after(f.cleanup);
 const c=(await publishedDetail(f.db,'en',{world:'lathe-worlds',kind:'experience',slug:'forge-walk'})).content;
 const row=(await f.db.query('SELECT head_revision_id FROM contents WHERE id=$1',[c.id])).rows[0];
 await editContent(f.db,f.data.admin,c.id,editContentSchema.parse({baseRevisionId:row.head_revision_id,sourceLocale:'en',text:{...c.text,title:'Keep my draft'},attributes:c.attributes}));
 const before=await historyDigest(f.db);assert.match((await seedExperienceDetails(f.db,f.data.admin,true)).status,/unpublished/);assert.deepEqual(await historyDigest(f.db),before);
 await unpublishContent(f.db,f.data.admin,c.id,false,'Test hidden sample');const hidden=await historyDigest(f.db);
 assert.match((await seedExperienceDetails(f.db,f.data.admin,true)).status,/not published/);assert.deepEqual(await historyDigest(f.db),hidden);
});
test('session validation rejects invalid or reversed timestamps',()=>{
 assert.equal(experienceAttributesSchema.safeParse({sessions:[{startsAt:'2026-10-14T12:00:00Z',endsAt:'2026-10-14T10:00:00Z'}]}).success,false);
 assert.equal(experienceAttributesSchema.safeParse({opensAt:'tomorrow'}).success,false);
});

test('fictional activity reviews append without changing their parent, remain idempotent and exclude hidden ratings',async t=>{
 const f=await fixture();t.after(f.cleanup);
 const get=()=>publishedDetail(f.db,'en',{world:'lathe-worlds',kind:'experience',slug:'forge-walk'});
 const parent=(await get()).content;
 const before=await historyDigest(f.db);assert.equal((await seedExperienceReviews(f.db,f.data.admin)).planned,6);assert.deepEqual(await historyDigest(f.db),before);
 assert.equal((await seedExperienceReviews(f.db,f.data.admin,true)).added,6);
 const result=await get();assert.deepEqual(result.content,parent);assert.equal(result.reviews.total,6);assert.equal(result.reviewSummary.rating,4.83);
 assert.equal(result.reviewSummary.dimensions.communication?.rating,5);
 const zh=await publishedDetail(f.db,'zh-CN',{world:'lathe-worlds',kind:'experience',slug:'forge-walk'});assert.equal(zh.reviews.total,6);assert.ok(zh.reviews.contents.every(r=>r.text.review?.name));
 const after=await historyDigest(f.db);assert.equal((await seedExperienceReviews(f.db,f.data.admin,true)).added,0);assert.deepEqual(await historyDigest(f.db),after);
 const low=result.reviews.contents.find(r=>r.attributes.rating===4)!;await unpublishContent(f.db,f.data.admin,low.id,false,'Test hidden review');assert.equal((await get()).reviewSummary.rating,5);
 await seedExperienceReviews(f.db,f.data.admin,true);assert.equal((await get()).reviews.total,5);
 await unpublishContent(f.db,f.data.admin,parent.id,false,'Test hidden parent');const hidden=await historyDigest(f.db);assert.match((await seedExperienceReviews(f.db,f.data.admin,true)).status,/not published/);assert.deepEqual(await historyDigest(f.db),hidden);
});
