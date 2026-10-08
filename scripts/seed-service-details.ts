import { pathToFileURL } from 'node:url';
import { createDatabase, type Database } from '@plotstay/database';
import { createContentSchema, editContentSchema } from '@plotstay/contracts';
import { createContent, editContent, submitRevision, reviewRevision, type Actor } from '@plotstay/domain';
import { serviceDemoText, serviceDemoAttributes, serviceDemoImages, serviceDemoReview, serviceDemoRatings } from './service-demo-copy.ts';

// Only the authorised sample; never run on startup or as part of the base seed.
export async function seedServiceDetails(db:Database,actor:Actor,apply=false){
 const guard=await db.connect();await guard.query('SELECT pg_advisory_lock(184570927)');
 const publish=async(id:string,revisionId:string)=>{await submitRevision(db,actor,id,revisionId);return reviewRevision(db,actor,id,revisionId,'publish','User-authorised fictional service details and reviews for layout demonstration.');};
 try{
  const {rows:[row]}=await db.query(`SELECT c.*,p.revision_id AS published_revision,r.source_locale,r.attributes FROM contents c
   JOIN worlds w ON w.id=c.world_id JOIN publications p ON p.id=c.published_publication_id JOIN content_revisions r ON r.id=p.revision_id
   WHERE w.slug='lathe-worlds' AND c.kind='service' AND c.slug='augmetic-tune-up' AND w.visible AND NOT w.site_blocked AND NOT c.site_blocked`);
  if(!row)return {status:'skipped: sample is not published',added:0};
  if(row.head_revision_id!==row.published_revision)return {status:'skipped: unpublished editing exists',added:0};
  const {rows:published}=await db.query('SELECT t.locale,t.body FROM publication_locales l JOIN translations t ON t.id=l.translation_id WHERE l.publication_id=$1',[row.published_publication_id]);
  if(!['en','zh-CN'].every(locale=>published.some(t=>t.locale===locale)))return {status:'skipped: bilingual publication required',added:0};
  const existing=published.some(t=>t.body.service)||!!row.attributes.service;
  if(!apply)return {status:existing?'details preserved':'will append service demo',added:0};
  let publicationId=row.published_publication_id;
  if(!existing){
   const images=[...row.attributes.images];for(const image of serviceDemoImages)if(!images.some(i=>i.id===image.id))images.push(image);
   const texts=Object.fromEntries(published.map(t=>[t.locale,{...t.body,...(['en','zh-CN'].includes(t.locale)?{service:serviceDemoText(t.locale),imageAlts:{...Object.fromEntries(serviceDemoImages.map(i=>[i.id,t.locale==='en'?'An illustrated scene from the fictional workshop quarter':'虚构工坊街区的原创场景插画'])),...t.body.imageAlts}}:{})}]));
   const source=texts[row.source_locale];delete texts[row.source_locale];
   const next=await editContent(db,actor,row.id,editContentSchema.parse({baseRevisionId:row.head_revision_id,baseDraftToken:row.draft_token,sourceLocale:row.source_locale,text:source,translations:texts,attributes:{...row.attributes,images,service:serviceDemoAttributes}}));
   publicationId=(await publish(row.id,next.revisionId)).publicationId;
  }
  let added=0;
  for(let i=0;i<6;i++){
   const slug=`service-demo-${row.id}-${i+1}`;
   if((await db.query("SELECT id FROM contents WHERE world_id=$1 AND kind='review' AND slug=$2",[row.world_id,slug])).rowCount)continue;
   const note=await createContent(db,actor,createContentSchema.parse({worldId:row.world_id,kind:'review',slug,parentContentId:row.id,sourceLocale:'en',text:serviceDemoReview('en',i),translations:{'zh-CN':serviceDemoReview('zh-CN',i)},attributes:{rating:serviceDemoRatings[i],reviewRatings:{accuracy:5,communication:5,value:serviceDemoRatings[i]}}}));
   await publish(note.id,note.revisionId);added++;
  }
  return {status:existing?'details preserved':'appended and published',added,previousPublicationId:row.published_publication_id,publicationId};
 }finally{await guard.query('SELECT pg_advisory_unlock(184570927)');guard.release();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const db=createDatabase();try{const {rows:[actor]}=await db.query(`SELECT id,email,site_role AS "siteRole" FROM users WHERE active AND site_role='admin' ORDER BY created_at,id LIMIT 1`);if(!actor)throw new Error('A site administrator is required.');console.log(JSON.stringify(await seedServiceDetails(db,actor,process.argv.includes('--apply')),null,2));}finally{await db.end();}}
