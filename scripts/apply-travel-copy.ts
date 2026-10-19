/** Incremental, versioned publication. Dry-run is the default; no seed or migrations. */
import {readFileSync,writeFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {createDatabase} from '../packages/database/src/index.ts';
import {saveHomeDraft,reviewHome} from '../packages/domain/src/home.ts';
import {saveSetting,settingAction} from '../packages/domain/src/settings.ts';
import type {Actor} from '../packages/domain/src/auth.ts';
const catalogue=JSON.parse(readFileSync('apps/web/src/lib/travel-copy.json','utf8'));
const args=new Set(process.argv.slice(2)),apply=args.has('--apply'),rollback=args.has('--rollback');
const dir='.runtime/copy-20261019',before=JSON.parse(readFileSync(dir+'/before.json','utf8'));
const db=createDatabase(undefined,apply||rollback?undefined:'-c default_transaction_read_only=on');
const copy=catalogue as Record<string,Record<string,string>>;
try {
 const user=(await db.query("SELECT id,email FROM users WHERE site_role='admin' AND active ORDER BY created_at LIMIT 1")).rows[0];
 if(!user)throw new Error('No active administrator');
 const actor={...user,siteRole:'admin'} as Actor;
 const original=before.home[0],worldId=original.id;
 if(rollback){
  const published=JSON.parse(readFileSync(dir+'/published.json','utf8'));
  const s=(await db.query('SELECT head_revision_id,published_id FROM world_home_settings WHERE world_id=$1',[worldId])).rows[0];
  if(s.published_id!==published.home.publicationId)throw new Error('Home changed since this release; review rollback manually');
  await reviewHome(db,actor,worldId,'restore',s.head_revision_id,original.published_id);
  for(const item of published.places){
   const prev=before.settings.find((s:any)=>s.id===item.settingId);
   const current=(await db.query('SELECT head_revision_id,published_id FROM detail_settings WHERE id=$1',[item.settingId])).rows[0];
   if(current.published_id!==item.publicationId)throw new Error('Place changed since this release; review rollback manually');
   await settingAction(db,actor,item.settingId,'restore',current.head_revision_id,prev.published_id);
  }
  console.log('Restored prior publications; history and drafts retained.');
 }else{
  const current=(await db.query('SELECT * FROM world_home_settings WHERE world_id=$1',[worldId])).rows[0];
  if(current.head_revision_id!==original.head_revision_id || current.published_id!==original.published_id || original.head_revision_id!==original.live_revision)throw new Error('Home version changed or has unpublished edits');
  const body=structuredClone(original.body);
  for(const locale of ['en','zh-CN']){
   const text=body.translations[locale];
   for(const field of ['eyebrow','title','intro'])text[field]=copy['home.hero.'+field]![locale];
   for(const [field,id]of Object.entries({audience:'eyebrow',title:'title',body:'body'}))text.promotion[field]=copy['home.promotion.'+id]![locale];
   text.sectionTitles.experiences=copy['home.experiences.title']![locale];text.sectionTitles.homes=copy['home.stays.title']![locale];
   text.benefits.forEach((card:any,i:number)=>{for(const [field,id]of Object.entries({title:'title',body:'body',button:'cta'}))card[field]=copy[`home.service-card.0${i+1}.${id}`]![locale];});
  }
  const targets=[];
  for(const [slug,key]of Object.entries({'dummy-forge-district':'foundry','quiet-archive':'archive','orbital-docks':'docks'})){
   const place=before.places.find((p:any)=>p.slug===slug);if(!place)throw new Error('Expected sample place missing');
   const setting=before.settings.find((s:any)=>s.kind==='place'&&s.entity_id===place.id);
   const current=(await db.query('SELECT * FROM detail_settings WHERE id=$1',[setting.id])).rows[0];
   if(current.head_revision_id!==setting.head_revision_id||current.published_id!==setting.published_id||setting.head_revision_id!==setting.live_revision)throw new Error('Place changed or has unpublished edits');
   const value={'en':copy[`directory.${key}.name`]!.en,'zh-CN':copy[`directory.${key}.name`]!['zh-CN']};
   if(!isDeepStrictEqual(value,setting.body))targets.push({setting,body:value,slug});
  }
  writeFileSync(dir+'/proposed.json',JSON.stringify({home:body,places:targets.map(({setting,body,slug})=>({settingId:setting.id,slug,body}))},null,2));
  if(apply){
   const draft=await saveHomeDraft(db,actor,worldId,body,original.head_revision_id);
   await reviewHome(db,actor,worldId,'submit',draft.revisionId);
   await reviewHome(db,actor,worldId,'publish',draft.revisionId);
   const live=(await db.query('SELECT published_id FROM world_home_settings WHERE world_id=$1',[worldId])).rows[0];
   const result:any={home:{revisionId:draft.revisionId,publicationId:live.published_id},places:[]};
   writeFileSync(dir+'/published.json',JSON.stringify(result,null,2));
   for(const {setting,body} of targets){
    const next=await saveSetting(db,actor,setting.id,body,setting.head_revision_id);
    await settingAction(db,actor,setting.id,'submit',next.revisionId);
    const published=await settingAction(db,actor,setting.id,'publish',next.revisionId);
    result.places.push({settingId:setting.id,revisionId:next.revisionId,...published});
    writeFileSync(dir+'/published.json',JSON.stringify(result,null,2));
   }
   console.log(JSON.stringify(result,null,2));
  }else console.log(JSON.stringify({dryRun:true,worldId,homeRevision:original.live_revision,placeUpdates:targets.map(t=>t.slug),sharedCopyUnchanged:true},null,2));
 }
}finally{await db.end();}
