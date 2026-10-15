import {createFixtureContent as createContent} from './work-fixtures.ts';
// Source-contract preparation for the overview. These validate existing evidence,
// not an implemented overview endpoint. All writes stay in fixture's random schema.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.ts';
import {createContentSchema,textSchema} from '@plotstay/contracts';
import {editContent,saveTranslation,submitRevision,reviewRevision,requireWorld,
  createAccount,savePersona,submitOwnPersona,moderatePersona,myPersonas,saveSetting} from '@plotstay/domain';

async function isolated(t: {after: (fn:()=>Promise<void>)=>void}) {
  const f=await fixture();t.after(f.cleanup);
  assert.match(f.schema,/^test_[a-f0-9]{32}$/);
  assert.equal((await f.db.query('select current_schema() as schema')).rows[0].schema,f.schema);
  return f;
}

test('overview source: creator, current editor, translator and reviewer are distinct evidence',async t=>{
 const {db,data}=await isolated(t);
 const input=createContentSchema.parse({worldId:data.latheId,kind:'stay' as const,slug:'overview-evidence',sourceLocale:'en',
  text:{title:'Source evidence',description:'A private fixture'},translations:{'zh-CN':{title:'来源证据',description:'隔离测试'}},attributes:{price:{amount:10,unit:'night' as const}}});
 const created=await createContent(db,data.owner,input);
 await submitRevision(db,data.owner,created.id,created.revisionId);
 await reviewRevision(db,data.admin,created.id,created.revisionId,'publish','Source baseline');
 const saved=await editContent(db,data.editor,created.id,{...input,baseRevisionId:created.revisionId,text:{...input.text,title:'Edited by a collaborator'}});
 const evidence=async()=> (await db.query(`SELECT c.author_id,r.id AS revision_id,r.created_by,r.status,p.revision_id AS public_revision,
  ARRAY(SELECT DISTINCT actor_id::text FROM moderation_events e WHERE e.content_id=c.id AND e.revision_id=r.id AND e.action IN ('draft_saved','translation_saved') ORDER BY actor_id::text) AS savers
  FROM contents c JOIN content_revisions r ON r.id=c.head_revision_id LEFT JOIN publications p ON p.id=c.published_publication_id WHERE c.id=$1`,[created.id])).rows[0];
 const before=await evidence();
 assert.equal(before.author_id,data.owner.id);assert.equal(before.created_by,data.editor.id);
 assert.equal(before.public_revision,created.revisionId);assert.equal(before.status,'draft');
 assert.deepEqual(before.savers,[data.editor.id]);
 // Merely having and checking access does not create a saved-edit relationship.
 await requireWorld(db,data.admin,data.latheId);assert.deepEqual(await evidence(),before);
 await saveTranslation(db,data.admin,created.id,saved.revisionId,'zh-CN',textSchema.parse({title:'管理员实际保存的译文',description:'同一内容版本'}));
 const translated=await evidence();
 assert.equal(translated.revision_id,saved.revisionId);assert.equal(translated.created_by,data.editor.id);
 assert.deepEqual(translated.savers,[data.admin.id,data.editor.id].sort());
 await assert.rejects(()=>requireWorld(db,data.editor,data.latheId,true),(e:any)=>e.code==='REVIEW_FORBIDDEN');
 await submitRevision(db,data.editor,created.id,saved.revisionId);
 await reviewRevision(db,data.owner,created.id,saved.revisionId,'publish','Completed');
 const published=await evidence();assert.equal(published.status,'approved');assert.equal(published.public_revision,saved.revisionId);
 assert.equal(published.savers.includes(data.owner.id),false,'reviewing alone is not saving');
 const next=await editContent(db,data.owner,created.id,{...input,baseRevisionId:saved.revisionId});
 const newer=await evidence();assert.equal(newer.revision_id,next.revisionId);assert.deepEqual(newer.savers,[data.owner.id],'old collaborative saves must not extend to every new revision');
});

test('overview source: persona owner, shared-profile saver, current draft and fixed submission differ',async t=>{
 const {db,data}=await isolated(t);
 const account=await createAccount(db,data.admin,{email:'overview-owner@tests.invalid',password:'source-test-12345'});
 const actor={id:account.id,email:account.email,siteRole:'user' as const};
 const profiles={en:{name:'Source persona',bio:'A fictional explorer',avatar:'mint'},'zh-CN':{name:'来源角色',bio:'虚构的探索者',avatar:'mint'}};
 const first=await savePersona(db,actor,profiles);await submitOwnPersona(db,actor,first.id,first.revisionId);
 const setting=(await db.query("SELECT * FROM detail_settings WHERE kind='persona' AND entity_id=$1",[first.id])).rows[0];
 const assisted=await saveSetting(db,data.admin,setting.id,{...profiles,en:{...profiles.en,bio:'An administrator saved this change'}},first.revisionId);
 const current=(await myPersonas(db,actor))[0];
 assert.equal(current.head_revision_id,assisted.revisionId);assert.equal(current.submitted_revision_id,first.revisionId);
 assert.equal((await db.query('SELECT owner_id FROM personas WHERE id=$1',[first.id])).rows[0].owner_id,actor.id);
 assert.equal((await db.query('SELECT created_by FROM detail_setting_revisions WHERE id=$1',[assisted.revisionId])).rows[0].created_by,data.admin.id);
 await moderatePersona(db,data.admin,first.revisionId,'rejected','Earlier submission was returned');
 const returned=(await myPersonas(db,actor))[0];assert.equal(returned.decision,null);assert.equal(returned.submitted_revision_id,null);assert.equal(returned.submitted_decision,null);
 assert.equal((await db.query('SELECT decision FROM persona_revision_decisions WHERE revision_id=$1',[first.revisionId])).rows[0].decision,'rejected','completed submission must be read from history, not the cleared pointer');
 assert.equal(returned.head_revision_id,assisted.revisionId,'earlier rejection does not reject the new draft');
 await assert.rejects(()=>requireWorld(db,actor,data.latheId),(e:any)=>e.code==='WORLD_FORBIDDEN');
 assert.deepEqual(await myPersonas(db,data.secondOwner),[],'another account does not own this persona');
});
