import { pathToFileURL } from 'node:url';
import { createDatabase, type Database } from '@plotstay/database';
import { editContentSchema } from '@plotstay/contracts';
import { editContent, submitRevision, reviewRevision, type Actor } from '@plotstay/domain';
import { experienceDemoText, experienceDemoAttributes, experienceDemoImages } from './experience-demo-copy.ts';
// Deliberately scoped to the user-reviewed sample. Append new versions; never reset or seed the database.
export async function seedExperienceDetails(db:Database,actor:Actor,apply=false){
 const guard=await db.connect();await guard.query('SELECT pg_advisory_lock(184570925)');
 try{
  const {rows:[row]}=await db.query(`SELECT c.*,p.revision_id AS published_revision,r.source_locale,r.attributes
   FROM contents c JOIN worlds w ON w.id=c.world_id JOIN publications p ON p.id=c.published_publication_id
   JOIN content_revisions r ON r.id=p.revision_id WHERE w.slug='lathe-worlds' AND c.kind='experience' AND c.slug='forge-walk'
   AND w.visible AND NOT w.site_blocked AND NOT c.site_blocked`);
  if(!row)return {status:'skipped: sample is not published'};
  if(row.head_revision_id!==row.published_revision)return {status:'skipped: unpublished editing exists'};
  const {rows:published}=await db.query('SELECT t.locale,t.body FROM publication_locales l JOIN translations t ON t.id=l.translation_id WHERE l.publication_id=$1',[row.published_publication_id]);
  if(!['en','zh-CN'].every(locale=>published.some(t=>t.locale===locale)))return {status:'skipped: bilingual publication required'};
  if(published.some(t=>t.body.experience)||row.attributes.experience)return {status:'preserved: existing experience details'};
  if(!apply)return {status:'will append experience demo',slug:row.slug};
  const images=[...row.attributes.images];for(const image of experienceDemoImages)if(!images.some(i=>i.id===image.id))images.push(image);
  const texts=Object.fromEntries(published.map(t=>[t.locale,{...t.body,...(['en','zh-CN'].includes(t.locale)?{experience:experienceDemoText(t.locale),imageAlts:{...Object.fromEntries(experienceDemoImages.map(i=>[i.id,t.locale==='en'?'Illustrated scene from the fictional foundry quarter':'虚构铸造街区的场景插画'])),...t.body.imageAlts}}:{})}]));
  const source=texts[row.source_locale];delete texts[row.source_locale];
  const next=await editContent(db,actor,row.id,editContentSchema.parse({baseRevisionId:row.head_revision_id,baseDraftToken:row.draft_token,sourceLocale:row.source_locale,text:source,translations:texts,attributes:{...row.attributes,images,experience:experienceDemoAttributes}}));
  await submitRevision(db,actor,row.id,next.revisionId);
  const result=await reviewRevision(db,actor,row.id,next.revisionId,'publish','User-authorised fictional experience placeholders for layout review.');
  return {status:'appended and published',slug:row.slug,previousPublicationId:row.published_publication_id,publicationId:result.publicationId};
 }finally{await guard.query('SELECT pg_advisory_unlock(184570925)');guard.release();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const db=createDatabase();try{const {rows:[actor]}=await db.query(`SELECT id,email,site_role AS "siteRole" FROM users WHERE active AND site_role='admin' ORDER BY created_at,id LIMIT 1`);if(!actor)throw new Error('A site administrator is required.');console.log(JSON.stringify(await seedExperienceDetails(db,actor,process.argv.includes('--apply')),null,2));}finally{await db.end();}}
