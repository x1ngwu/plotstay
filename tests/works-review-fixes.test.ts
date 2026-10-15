import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import type {Database} from '@plotstay/database';
import {editContentSchema} from '@plotstay/contracts';
import {saveReply,replyAction,replyDetail,moderationQueue,workspaceOverview,savePersona,createContent} from '@plotstay/domain';
import {createContentSchema} from '@plotstay/contracts';
import {reviewWorkspaceList} from '../packages/domain/src/review-workspace.ts';
import {worksReviewFixture} from './works-review-fixture.ts';
import {saveWork,workDetail} from '../packages/domain/src/works.ts';
import {saveReviewCommand} from '../packages/domain/src/review-commands.ts';
import {fixture} from './helpers.ts';
import {migrate} from '../packages/database/src/migrate.ts';
import {setWorkAccess} from '../packages/domain/src/work-access.ts';

assert.equal(process.env.DOTENV_CONFIG_PATH,'/dev/null');
assert.equal(process.env.DATABASE_URL,'postgres://works_test:isolated-works-test-only@127.0.0.1:55439/works_test');

function intercepted(db:Database,before:(sql:string,args:any[])=>Promise<void>|void):Database{
  return new Proxy(db,{get(target,key){
    if(key==='connect')return async()=>{
      const client=await target.connect();
      return new Proxy(client,{get(c,k){
        if(k==='query')return async(sql:string,args:any[])=>{await before(sql,args);return c.query(sql,args);};
        const value=(c as any)[k];return typeof value==='function'?value.bind(c):value;
      }});
    };
    const value=(target as any)[key];return typeof value==='function'?value.bind(target):value;
  }});
}

const replyBody={sourceLocale:'en',texts:{en:'Thank you','zh-CN':'谢谢'}};
const code=(expected:string)=>(error:any)=>error.code===expected;
test('R1 revoked/left operators cannot publish or restore replies; reapproval requires explicit resubmission',async t=>{
  for(const revoke of ['revoke','leave'] as const)await t.test(revoke,async t=>{
    const f=await worksReviewFixture();t.after(f.cleanup);
    const {db,author,review,data}=f;
    const first=await saveReply(db,author,review.id,replyBody,null);
    await replyAction(db,author,review.id,'submit',first.revisionId);
    await replyAction(db,data.admin,review.id,'publish',first.revisionId);
    const publication=(await replyDetail(db,author,review.id)).publications[0].id;
    const next=await saveReply(db,author,review.id,replyBody,first.revisionId);
    await replyAction(db,author,review.id,'submit',next.revisionId);
    await f.access(revoke);
    for(const action of ['publish','restore'] as const)await assert.rejects(
      replyAction(db,data.admin,review.id,action,next.revisionId,'',publication),code('ELIGIBILITY_REVOKED'));
    const d=await replyDetail(db,author,review.id);
    assert.equal(d.submissionExpired,true);assert.equal(d.reply.submitted_revision_id,null);
    assert.equal(d.reply.published_id,publication);
    assert.equal((await moderationQueue(db,data.admin)).items.find((r:any)=>r.id===review.id).reply_status,null);
    assert.equal((await reviewWorkspaceList(db,author,{view:'replies',status:'submitted'})).total,0);
    assert.ok(!JSON.stringify(await workspaceOverview(db,data.admin,{locale:'en'})).includes('reply-moderation:'+first.id));
    if(revoke==='leave')await f.access('join');
    await f.access('approve');
    await assert.rejects(replyAction(db,data.admin,review.id,'publish',next.revisionId),code('SUBMISSION_EXPIRED'));
    assert.equal((await replyDetail(db,author,review.id)).submissionExpired,true);
    await replyAction(db,author,review.id,'submit',next.revisionId);
    await f.access('approve'); // Repeating an existing grant does not invalidate a submission.
    await replyAction(db,data.admin,review.id,'publish',next.revisionId);
    await replyAction(db,data.admin,review.id,'restore',next.revisionId,'',publication);
    assert.equal((await replyDetail(db,author,review.id)).publications[0].revision_id,first.revisionId);
  });
});

test('R3 old reply save/submit and combined save serialize with work saves without deadlocking',async t=>{
  for(const action of ['save','submit','combined'] as const)await t.test(action,async t=>{
    const f=await worksReviewFixture();t.after(f.cleanup);
    const first=await saveReply(f.db,f.author,f.review.id,replyBody,null);
    let parentReady!:()=>void,releaseParent!:()=>void,workReady!:()=>void;
    const atParent=new Promise<void>(r=>parentReady=r),gate=new Promise<void>(r=>releaseParent=r),atWork=new Promise<void>(r=>workReady=r);
    let interceptedParent=false;
    const replyDb=intercepted(f.db,async(sql,args)=>{
      if(!interceptedParent&&sql==='SELECT id FROM contents WHERE id=$1 FOR UPDATE'&&args[0]===f.work.id){
        interceptedParent=true;parentReady();await gate;
      }
    });
    const workDb=intercepted(f.db,(sql,args)=>{
      if(sql.includes('pg_advisory_xact_lock')&&String(args[0]).startsWith('work-access:'))workReady();
    });
    const reply=action==='save'?saveReply(replyDb,f.author,f.review.id,replyBody,first.revisionId):
      action==='submit'?replyAction(replyDb,f.author,f.review.id,'submit',first.revisionId):
      saveReviewCommand(replyDb,f.author,{requestId:randomUUID(),kind:'reply',reviewId:f.review.id,
        baseRevisionId:first.revisionId,expectedSubmittedRevisionId:null,expectedPersonaId:f.persona.id,
        expectedPersonaRevisionId:f.persona.revisionId,action:'submit',body:replyBody});
    await atParent;
    const d=await workDetail(f.db,f.author,f.work.id);
    const work=saveWork(workDb,f.author,{requestId:randomUUID(),contentId:f.work.id,providerId:f.persona.id,expectedProviderId:f.persona.id,
      draft:editContentSchema.parse({baseRevisionId:d.content.head_revision_id,baseDraftToken:d.content.draft_token,
        sourceLocale:'en',text:f.draft.text,translations:f.draft.translations,attributes:f.draft.attributes})});
    await atWork;releaseParent();
    const results=await Promise.allSettled([reply,work]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,2,JSON.stringify(results));
  });
});

test('R1 reply publication rechecks eligibility under its transaction lock',async t=>{
  const f=await worksReviewFixture();t.after(f.cleanup);
  const reply=await saveReply(f.db,f.author,f.review.id,replyBody,null);
  await replyAction(f.db,f.author,f.review.id,'submit',reply.revisionId);
  let entered!:()=>void,release!:()=>void;
  const ready=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
  const publication=replyAction(intercepted(f.db,async(sql,args)=>{
    if(sql.includes('pg_advisory_xact_lock')&&String(args[0]).startsWith('work-access:')){entered();await gate;}
  }),f.data.admin,f.review.id,'publish',reply.revisionId);
  const rejected=assert.rejects(publication,code('ELIGIBILITY_REVOKED'));
  await ready;await f.access('revoke');release();await rejected;
  assert.equal((await replyDetail(f.db,f.author,f.review.id)).publications.length,0);
});

test('R1 combined draft saves keep an expired submission as a guard, never an effective submission',async t=>{
  const f=await worksReviewFixture();t.after(f.cleanup);
  const first=await saveReply(f.db,f.author,f.review.id,replyBody,null);
  await replyAction(f.db,f.author,f.review.id,'submit',first.revisionId);
  await f.access('revoke');await f.access('approve');
  const command={kind:'reply',reviewId:f.review.id,expectedPersonaId:f.persona.id,
    expectedPersonaRevisionId:f.persona.revisionId,body:replyBody};
  const draft=await saveReviewCommand(f.db,f.author,{...command,requestId:randomUUID(),action:'draft',
    baseRevisionId:first.revisionId,expectedSubmittedRevisionId:first.revisionId});
  assert.equal(draft.submittedRevisionId,null);assert.equal(draft.submissionGuard,first.revisionId);
  const submitted=await saveReviewCommand(f.db,f.author,{...command,requestId:randomUUID(),action:'submit',
    baseRevisionId:draft.revisionId,expectedSubmittedRevisionId:draft.submissionGuard});
  assert.equal(submitted.submittedRevisionId,submitted.revisionId);
  await replyAction(f.db,f.data.admin,f.review.id,'publish',submitted.revisionId);
});

test('atomic reply save/submit orders the transition after its draft even when UUID order is reversed',async t=>{
  const f=await worksReviewFixture();t.after(f.cleanup);
  // Force the timestamp tie's UUID order to choose draft under the old query.
  await f.db.query(`CREATE FUNCTION reply_event_test_ids() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.action='draft' THEN NEW.id='ffffffff-ffff-ffff-ffff-ffffffffffff';
      ELSIF NEW.action='submit' THEN NEW.id='00000000-0000-0000-0000-000000000001'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER reply_event_test_ids BEFORE INSERT ON reply_events FOR EACH ROW EXECUTE FUNCTION reply_event_test_ids()`);
  const saved=await saveReviewCommand(f.db,f.author,{requestId:randomUUID(),kind:'reply',reviewId:f.review.id,
    expectedPersonaId:f.persona.id,expectedPersonaRevisionId:f.persona.revisionId,body:replyBody,
    action:'submit',baseRevisionId:null,expectedSubmittedRevisionId:null});
  const events=(await f.db.query('SELECT action,created_at FROM reply_events WHERE reply_id=$1 ORDER BY id DESC',[saved.id])).rows;
  assert.equal(events[0].action,'draft');assert.equal(events[1].action,'submit');assert.equal(+events[0].created_at,+events[1].created_at);
  assert.equal((await replyDetail(f.db,f.author,f.review.id)).revisions[0].status,'submit');
  assert.equal((await moderationQueue(f.db,f.data.admin)).items.find((r:any)=>r.id===f.review.id).reply_status,'submit');
  const list=await reviewWorkspaceList(f.db,f.author,{view:'replies',status:'draft'});assert.equal(list.total,0);
  await replyAction(f.db,f.data.admin,f.review.id,'publish',saved.revisionId);
});

test('014 preserves historical reply bodies and only carries forward submissions without revocation history',async t=>{
  const f=await fixture(true);t.after(f.cleanup);
  const folder=new URL('../packages/database/migrations/',import.meta.url);
  for(const file of (await readdir(folder)).filter(n=>n.endsWith('.sql')&&n>'003_translation_execution.sql'&&n<'014').sort()){
    const sql=await readFile(new URL(file,folder),'utf8');await f.db.query(sql);
    await f.db.query('INSERT INTO schema_migrations(name,checksum)VALUES($1,$2)',[file,createHash('sha256').update(sql).digest('hex')]);
  }
  const ids:string[]=[];
  for(const access of ['never','approved','revoked','reapproved']){
    const user=(await f.db.query("INSERT INTO users(email,password_hash)VALUES($1,'unused')RETURNING id,email",[randomUUID()+'@migration.invalid'])).rows[0];
    const actor={...user,siteRole:'user' as const};
    const p=await savePersona(f.db,actor,{en:{name:'Migration fixture',bio:'Historical profile'}});
    const review=await createContent(f.db,f.data.admin,createContentSchema.parse({worldId:f.data.latheId,kind:'review',slug:'migration-'+access,parentContentId:f.data.ids['observation-room'],sourceLocale:'en',text:{title:'Historical review',description:'Unchanged body'},attributes:{}}));
    const q=(await f.db.query('INSERT INTO review_replies(review_id)VALUES($1)RETURNING id',[review.id])).rows[0];ids.push(q.id);
    const r=(await f.db.query("INSERT INTO reply_revisions(reply_id,persona_id,persona_revision_id,profiles,body,source_locale,created_by)VALUES($1,$2,$3,$4,$5,'en',$6)RETURNING id",[q.id,p.id,p.revisionId,{en:{name:'Historical signature'}},{en:'Historical reply'},actor.id])).rows[0];
    await f.db.query('UPDATE review_replies SET head_revision_id=$2,submitted_revision_id=$2 WHERE id=$1',[q.id,r.id]);
    await f.db.query("INSERT INTO reply_events(reply_id,revision_id,action,actor_id)VALUES($1,$2,'submit',$3)",[q.id,r.id,actor.id]);
    if(access!=='never'){
      await setWorkAccess(f.db,f.data.admin,f.data.latheId,actor.id,'join');await setWorkAccess(f.db,f.data.admin,f.data.latheId,actor.id,'approve');
      if(['revoked','reapproved'].includes(access))await setWorkAccess(f.db,f.data.admin,f.data.latheId,actor.id,'revoke');
      if(access==='reapproved')await setWorkAccess(f.db,f.data.admin,f.data.latheId,actor.id,'approve');
    }
  }
  const history=async()=>Promise.all(['reply_revisions','reply_events','reply_publications'].map(async table=>(await f.db.query(`SELECT * FROM ${table} ORDER BY id`)).rows));
  const before=await history();await migrate(f.db);await migrate(f.db);assert.deepEqual(await history(),before);
  const epochs=await Promise.all(ids.map(async id=>(await f.db.query('SELECT submitted_access_epoch FROM review_replies WHERE id=$1',[id])).rows[0].submitted_access_epoch));
  assert.deepEqual(epochs,[0,1,null,null]);
});
