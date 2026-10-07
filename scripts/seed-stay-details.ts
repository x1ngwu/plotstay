import { pathToFileURL } from 'node:url';
import { createDatabase, type Database } from '@plotstay/database';
import { createContentSchema, editContentSchema } from '@plotstay/contracts';
import { createContent, editContent, submitRevision, reviewRevision, type Actor } from '@plotstay/domain';
import { stayDemoText, stayDemoReview, demoStayAttributes } from './stay-demo-copy.ts';

// Explicit, repeatable demo enrichment. Never run automatically at boot or in the base seed.
export async function seedStayDetails(db: Database, actor: Actor, apply = false) {
 const guard=await db.connect();await guard.query('SELECT pg_advisory_lock(184570924)');
 const results: {slug:string;status:string;notes?:number;publicationId?:string}[]=[];
 const publish=async(id:string,revisionId:string)=>{await submitRevision(db,actor,id,revisionId);return reviewRevision(db,actor,id,revisionId,'publish','User-authorised full stay layout demo; fictional placeholder details.');};
 try {
  const {rows}=await db.query(`SELECT c.*,p.revision_id AS published_revision,r.source_locale,r.attributes,pl.names AS place_names
   FROM contents c JOIN worlds w ON w.id=c.world_id JOIN publications p ON p.id=c.published_publication_id
   JOIN content_revisions r ON r.id=p.revision_id LEFT JOIN places pl ON pl.id=c.place_id
   WHERE c.kind='stay' AND w.visible AND NOT w.site_blocked AND NOT c.site_blocked
   AND ((w.slug='lathe-worlds' AND c.slug=ANY($1)) OR (w.slug='test-harbour' AND c.slug='harbour-room'))
   ORDER BY p.published_at ASC,c.id DESC`,[['observation-room','shift-rest-cabin','dockside-window','arrival-cabin','night-shift-suite','archive-nook','silent-reading-room','starboard-studio']]);
  for(const row of rows){
   if(row.head_revision_id!==row.published_revision){results.push({slug:row.slug,status:'skipped: unpublished editing exists'});continue;}
   const {rows:published}=await db.query('SELECT t.locale,t.body FROM publication_locales l JOIN translations t ON t.id=l.translation_id WHERE l.publication_id=$1 ORDER BY t.locale',[row.published_publication_id]);
   if(!['en','zh-CN'].every(locale=>published.some(t=>t.locale===locale))){results.push({slug:row.slug,status:'skipped: bilingual publication required'});continue;}
   const completed=published.every(t=>t.locale!=='en'&&t.locale!=='zh-CN'||t.body.stay);
   if(!apply){results.push({slug:row.slug,status:completed?'already enriched':'will append full stay demo'});continue;}
   let publicationId=row.published_publication_id;
   if(!completed){
    const texts=Object.fromEntries(published.map(t=>[t.locale,{...t.body,...(['en','zh-CN'].includes(t.locale)&&!t.body.stay?{stay:stayDemoText(t.locale,row.place_names?.[t.locale]??(t.locale==='en'?'the local area':'当地街区'),row.slug)}:{})}]));
    const source=texts[row.source_locale];delete texts[row.source_locale];
    const next=await editContent(db,actor,row.id,editContentSchema.parse({baseRevisionId:row.head_revision_id,baseDraftToken:row.draft_token,
     sourceLocale:row.source_locale,text:source,translations:texts,attributes:{...row.attributes,stay:{...demoStayAttributes,...row.attributes.stay}}}));
    publicationId=(await publish(row.id,next.revisionId)).publicationId;
   }
   let added=0;
   for(let i=0;i<6;i++){
    const slug=`stay-demo-${row.id}-${i+1}`;
    const {rows:[existing]}=await db.query('SELECT id,published_publication_id FROM contents WHERE world_id=$1 AND slug=$2 AND kind=\'review\'',[row.world_id,slug]);
    if(existing)continue;
    const note=await createContent(db,actor,createContentSchema.parse({worldId:row.world_id,kind:'review',slug,parentContentId:row.id,sourceLocale:'en',
     text:stayDemoReview('en',i),translations:{'zh-CN':stayDemoReview('zh-CN',i)},attributes:{rating:i===2?4:5,
      reviewRatings:{cleanliness:i===2?4:5,accuracy:i===0?4:5,checkIn:5,communication:i===3?4:5,location:i===1?4:5,value:i===4?4:5}}}));
    await publish(note.id,note.revisionId);added++;
   }
   results.push({slug:row.slug,status:completed?'details preserved':'appended and published',notes:added,publicationId});
  }
  return results;
 }finally{await guard.query('SELECT pg_advisory_unlock(184570924)');guard.release();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const db=createDatabase();try{
  const {rows:[actor]}=await db.query(`SELECT id,email,site_role AS "siteRole" FROM users WHERE active AND site_role='admin' ORDER BY created_at,id LIMIT 1`);
  if(!actor)throw new Error('A site administrator is required.');
  console.log(JSON.stringify(await seedStayDetails(db,actor,process.argv.includes('--apply')),null,2));
 }finally{await db.end();}
}
