// Explicit synthetic prerequisites for older regression scenarios. Never imported by application code.
import assert from 'node:assert/strict';
import {transaction,type Database} from '@plotstay/database';
import {createContent,requireWorld,type Actor} from '@plotstay/domain';
import type {CreateContentInput} from '@plotstay/contracts';
async function isolated(db:Database){assert.match((await db.query('SELECT current_schema() AS name')).rows[0].name,/^test_[a-f0-9]{32}$/);}
export async function fixtureOperator(db:Database,actor:Actor,worldId:string){
 await isolated(db);
 const key='Regression operator '+actor.id;
 let p=(await db.query("SELECT id FROM personas WHERE owner_id=$1 AND profiles->'en'->>'name'=$2",[actor.id,key])).rows[0];
 if(!p)p=(await db.query('INSERT INTO personas(owner_id,approved,profiles)VALUES($1,true,$2)RETURNING id',[actor.id,{en:{name:key,bio:'Synthetic regression profile'},'zh-CN':{name:'回归测试经营角色',bio:'隔离合成资料'}}])).rows[0];
 await db.query('INSERT INTO world_participations(world_id,user_id,joined,recorded_by)VALUES($1,$2,true,$2)ON CONFLICT DO NOTHING',[worldId,actor.id]);
 await db.query("INSERT INTO work_eligibilities(world_id,user_id,status,updated_by)VALUES($1,$2,'approved',$2)ON CONFLICT DO NOTHING",[worldId,actor.id]);
 return p.id as string;
}
export async function createFixtureContent(db:Database,actor:Actor,input:CreateContentInput){
 const personaId=input.kind==='review'?input.personaId:input.personaId??await fixtureOperator(db,actor,input.worldId);
 return createContent(db,actor,{...input,personaId});
}
// These regressions exercise replies authored under historical provider changes.
// Such changes are forbidden by migration 013. Arrange only the historical snapshot,
// in a random isolated test schema, then restore its guard before running assertions.
export async function historicalProvider(db:Database,actor:Actor,contentId:string,personaId:string){
 await isolated(db);
 return transaction(db,async c=>{
  const content=(await c.query('SELECT * FROM contents WHERE id=$1',[contentId])).rows[0];
  await requireWorld(c,actor,content.world_id,true);
  await c.query('ALTER TABLE provider_bindings DISABLE TRIGGER work_provider_guard');
  await c.query('INSERT INTO provider_bindings(content_id,persona_id,assigned_by)VALUES($1,$2,$3) ON CONFLICT(content_id)DO UPDATE SET persona_id=excluded.persona_id,assigned_by=excluded.assigned_by,assigned_at=now()',[contentId,personaId,actor.id]);
  await c.query('INSERT INTO provider_binding_events(content_id,persona_id,actor_id)VALUES($1,$2,$3)',[contentId,personaId,actor.id]);
  await c.query('ALTER TABLE provider_bindings ENABLE TRIGGER work_provider_guard');
 });
}
