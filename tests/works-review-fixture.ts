import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createContentSchema} from '@plotstay/contracts';
import {createContent,hashPassword,savePersona,submitOwnPersona,moderatePersona,submitRevision,reviewRevision} from '@plotstay/domain';
import {saveWork} from '../packages/domain/src/works.ts';
import {setWorkAccess} from '../packages/domain/src/work-access.ts';
import {fixture} from './helpers.ts';

export async function worksReviewFixture(){
  assert.equal(process.env.DOTENV_CONFIG_PATH,'/dev/null');
  assert.equal(process.env.DATABASE_URL,'postgres://works_test:isolated-works-test-only@127.0.0.1:55439/works_test');
  const f=await fixture();
  try {
    const password='isolated-review-regression-password';
    const user=(await f.db.query('INSERT INTO users(email,password_hash)VALUES($1,$2)RETURNING id,email',
      [randomUUID()+'@works.invalid',await hashPassword(password)])).rows[0];
    const author={...user,siteRole:'user' as const};
    const persona=await savePersona(f.db,author,{en:{name:'Review operator',bio:'Synthetic profile'},'zh-CN':{name:'审查测试经营角色',bio:'合成资料'}});
    await submitOwnPersona(f.db,author,persona.id,persona.revisionId);
    await moderatePersona(f.db,f.data.admin,persona.revisionId,'approved','Isolated test');
    const access=(action:'join'|'leave'|'approve'|'revoke')=>setWorkAccess(f.db,f.data.admin,f.data.latheId,author.id,action);
    await access('join');await access('approve');
    const draft=createContentSchema.parse({worldId:f.data.latheId,kind:'stay',slug:'review-'+randomUUID(),sourceLocale:'en',
      text:{title:'Original title',description:'Original description'},translations:{'zh-CN':{title:'原始标题',description:'原始描述'}},attributes:{price:{amount:100,unit:'night'}}});
    const work=await saveWork(f.db,author,{requestId:randomUUID(),providerId:persona.id,draft});
    await submitRevision(f.db,author,work.id,work.revisionId,work.draftToken,true);
    await reviewRevision(f.db,f.data.admin,work.id,work.revisionId,'publish','Isolated test');
    const review=await createContent(f.db,f.data.admin,createContentSchema.parse({worldId:f.data.latheId,kind:'review',
      slug:'review-note-'+randomUUID(),parentContentId:work.id,sourceLocale:'en',text:{title:'Guest note',description:'Guest text'},
      translations:{'zh-CN':{title:'旅客评价',description:'旅客文字'}},attributes:{}}));
    await submitRevision(f.db,f.data.admin,review.id,review.revisionId);
    await reviewRevision(f.db,f.data.admin,review.id,review.revisionId,'publish','Isolated test');
    return {...f,author,password,persona,work,review,draft,access};
  }catch(error){await f.cleanup();throw error;}
}
