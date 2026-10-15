import {createFixtureContent as createContent} from './work-fixtures.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createContentSchema, editContentSchema, type QuoteInput, type BookingSnapshot } from '@plotstay/contracts';
import {  editContent, getPublished, submitRevision, reviewRevision, unpublishContent, createGuest, createBooking, quoteBooking, getReceipt, digest } from '@plotstay/domain';
import { createApp } from '../apps/api/src/app.ts';
import { fixture } from './helpers.ts';

export const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
test('phase 5 persistent bookings and protected receipts', async t => {
 const f=await fixture();t.after(f.cleanup);
 const {db,data}=f,origin='https://booking.plotstay.invalid';
 const app=await createApp(db,{webOrigin:origin,cookieSecure:true});t.after(()=>app.close());
 const publish=async(c:{id:string;revisionId:string})=>{await submitRevision(db,data.owner,c.id,c.revisionId);await reviewRevision(db,data.owner,c.id,c.revisionId,'publish','Booking fixture');};
 const ids:Record<string,string>={};
 for(const kind of ['stay','experience','service'] as const){
  const content=await createContent(db,data.owner,createContentSchema.parse({worldId:data.latheId,placeId:data.forgePlace,kind,slug:`booking-${kind}`,sourceLocale:'en',text:{title:`Booked ${kind}`,summary:'A fictional stop',description:'Snapshot body'},translations:{'zh-CN':{title:`预订${kind}`,description:'快照正文'}},attributes:{price:{amount:kind==='stay'?80:kind==='experience'?25:30,unit:kind==='stay'?'night':kind==='experience'?'person':'session'},durationMinutes:45,...(kind==='stay'?{stay:{guests:2}}:{[kind]:{sessions:[{startsAt:future(7)+'T10:00:00Z',endsAt:future(7)+'T10:45:00Z'}]}})}}));
  await publish(content);ids[kind]=content.id;
 }
 const trip=(kind:'stay'|'experience'|'service'):QuoteInput=>({contentId:ids[kind]!,locale:'en',trip:kind==='stay'?{kind,start:future(5),end:future(8),guests:3,rooms:2}:kind==='experience'?{kind,startsAt:future(7)+'T10:00:00Z',guests:3}:{kind,startsAt:future(7)+'T10:00:00Z',guests:8,quantity:4}});
 const guest=await createGuest(db),other=await createGuest(db),owner={guestId:guest.id};
 const booking=async(q:QuoteInput)=>({...q,idempotencyKey:randomUUID(),quoteHash:(await quoteBooking(db,q)).quoteHash});
 const reject=(fn:()=>Promise<unknown>,code:string)=>assert.rejects(fn,(e:any)=>e.code===code);
 let receiptId='';
 await t.test('three price formulas are computed by the server and reject arbitrary client totals',async()=>{
  for(const [kind,total,multiplier] of [['stay',480,6],['experience',75,3],['service',120,4]] as const){
   const q=await quoteBooking(db,trip(kind));assert.equal(q.snapshot.total,total);assert.equal(q.snapshot.multiplier,multiplier);assert.equal(q.snapshot.fees,0);
   const created=await createBooking(db,owner,await booking(trip(kind)));assert.equal(created.created,true);assert.equal((created.receipt.snapshot as BookingSnapshot).total,total);
   assert.equal(created.receipt.createdAt,(created.receipt.snapshot as BookingSnapshot).issuedAt);
   if(kind==='stay')receiptId=created.receipt.id;
  }
  await assert.rejects(()=>createBooking(db,owner,{...trip('stay'),idempotencyKey:randomUUID(),quoteHash:'0'.repeat(64),total:1}));
  await reject(()=>createBooking(db,owner,{...trip('stay'),idempotencyKey:randomUUID(),quoteHash:'0'.repeat(64)}),'QUOTE_CHANGED');
 });
 await t.test('invalid dates, limits, wrong type, unpublished content and forged sessions are rejected',async()=>{
  for(const patch of [{start:'2026-02-30'},{guests:0},{rooms:21},{rooms:1.1},{extra:'x'}])await assert.rejects(()=>quoteBooking(db,{...trip('stay'),trip:{...trip('stay').trip,...patch}}));
  for(const patch of [{start:future(-1)},{end:future(5)},{end:future(40)},{start:future(370),end:future(371)}])await reject(()=>quoteBooking(db,{...trip('stay'),trip:{...trip('stay').trip,...patch}}),'INVALID_DATES');
  await reject(()=>quoteBooking(db,{...trip('stay'),trip:{...trip('stay').trip,rooms:1}}),'CAPACITY_EXCEEDED');
  await reject(()=>quoteBooking(db,{...trip('service'),contentId:ids.stay}),'INVALID_TRIP');
  await reject(()=>quoteBooking(db,{...trip('stay'),contentId:data.ids['unpublished-room']}),'NOT_BOOKABLE');
  await reject(()=>quoteBooking(db,{...trip('experience'),trip:{...trip('experience').trip,startsAt:future(7)+'T14:00:00Z'}}),'SESSION_UNAVAILABLE');
  await reject(()=>quoteBooking(db,{...trip('experience'),trip:{...trip('experience').trip,startsAt:future(-1)+'T10:00:00Z'}}),'INVALID_DATES');
 });
 await t.test('daily simulation sessions use UTC and published duration',async()=>{
  const q={contentId:data.ids['signal-listening']!,locale:'zh-CN',trip:{kind:'experience' as const,guests:2,startsAt:future(4)+'T19:00:00+09:00'}};
  const quote=await quoteBooking(db,q);assert.equal(quote.snapshot.sessionSource,'daily');assert.equal(quote.snapshot.endsAt,future(4)+'T11:30:00.000Z');
  await reject(()=>quoteBooking(db,{...q,trip:{...q.trip,startsAt:future(4)+'T10:01:00Z'}}),'SESSION_UNAVAILABLE');
 });
 await t.test('concurrent retries create exactly one row; a deliberate new key creates another',async()=>{
  const input=await booking(trip('service'));
  const before=Number((await db.query('SELECT count(*) FROM bookings')).rows[0].count);
  const results=await Promise.all(Array.from({length:16},()=>createBooking(db,owner,input)));
  assert.equal(results.filter(r=>r.created).length,1);assert.equal(new Set(results.map(r=>r.receipt.id)).size,1);
  assert.equal(Number((await db.query('SELECT count(*) FROM bookings')).rows[0].count),before+1);
  await reject(()=>createBooking(db,owner,{...input,trip:{...input.trip,guests:9}}),'IDEMPOTENCY_CONFLICT');
  const again=await createBooking(db,owner,{...input,idempotencyKey:randomUUID()});assert.notEqual(again.receipt.id,results[0]!.receipt.id);
  const separate=await createBooking(db,{guestId:other.id},input);assert.notEqual(separate.receipt.id,results[0]!.receipt.id);
 });
 await t.test('guest cookies are HttpOnly, Secure and independent; Origin and ownership are enforced',async()=>{
  const post=(url:string,payload:any,cookie?:string)=>app.inject({method:'POST',url,payload,headers:{origin,...(cookie?{cookie}:{})}});
  assert.equal((await app.inject({method:'POST',url:'/api/guest',payload:{}})).statusCode,403);
  const init=await post('/api/guest',{});const header=String(init.headers['set-cookie']);
  for(const word of ['HttpOnly','Secure','SameSite=Strict','Path=/api','Max-Age=15552000'])assert.ok(header.includes(word),word);
  assert.deepEqual(init.json(),{ready:true});const cookie=header.split(';')[0]!;
  assert.equal((await post('/api/guest',{},cookie)).headers['set-cookie'],undefined);
  assert.equal((await app.inject({url:'/api/guest',headers:{cookie}})).statusCode,200);
  const input=await booking(trip('experience'));
  assert.equal((await post('/api/bookings',input)).statusCode,401);
  const made=await post('/api/bookings',input,cookie);assert.equal(made.statusCode,201);const id=made.json().receipt.id;
  assert.equal((await post('/api/bookings',input,cookie)).statusCode,200);
  assert.equal((await app.inject({url:`/api/bookings/${id}`,headers:{cookie}})).statusCode,200);
  const wrong=`plotstay_guest=${other.token}`;
  assert.equal((await app.inject({url:`/api/bookings/${id}`,headers:{cookie:wrong}})).statusCode,404);
  assert.equal((await app.inject(`/api/bookings/${id}`)).statusCode,401);
  assert.equal((await app.inject({url:`/api/bookings/latest?contentId=${input.contentId}`,headers:{cookie}})).json().id,id);
  assert.equal((await app.inject({url:`/api/bookings/latest?contentId=${input.contentId}`,headers:{cookie:`plotstay_guest=${(await createGuest(db)).token}`}})).json().id,null);
  assert.equal((await app.inject({url:`/api/bookings/attempts/${input.idempotencyKey}`,headers:{cookie:wrong}})).json().receipt,null);
  assert.equal((await app.inject({url:`/api/bookings/attempts/${input.idempotencyKey}`,headers:{cookie}})).json().receipt.id,id);
  assert.equal((await app.inject({url:`/api/bookings/${id}`,headers:{cookie}})).headers['cache-control'],'no-store');
  assert.equal((await post('/api/auth/login',f.credentials,cookie)).statusCode,200);
  assert.equal((await app.inject({url:`/api/bookings/${id}`,headers:{cookie}})).statusCode,200);
  await db.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[digest(cookie.split('=')[1]!)]);
  assert.equal((await app.inject({url:`/api/bookings/${id}`,headers:{cookie}})).statusCode,401);
 });
 await t.test('published changes invalidate old quotes while issued records remain byte-for-byte stable',async()=>{
  const input=await booking(trip('stay')),before=await getReceipt(db,owner,receiptId);
  const old=(await getPublished(db,'en',{id:ids.stay}))!;
  const head=(await db.query('SELECT head_revision_id FROM contents WHERE id=$1',[ids.stay])).rows[0].head_revision_id;
  const next=await editContent(db,data.owner,ids.stay!,editContentSchema.parse({baseRevisionId:head,sourceLocale:'en',text:{...old.text,title:'Changed name'},attributes:{...old.attributes,price:{amount:999,unit:'night'}},translations:{'zh-CN':{...old.text,title:'改变名称'}}}));await publish(next);
  await reject(()=>createBooking(db,owner,input),'QUOTE_CHANGED');
  await db.query("UPDATE places SET names=jsonb_build_object('en','Changed place','zh-CN','新地点') WHERE id=$1",[data.forgePlace]);
  await db.query("UPDATE worlds SET translations=jsonb_set(translations,'{en,name}','\"Changed world\"') WHERE id=$1",[data.latheId]);
  assert.deepEqual(await getReceipt(db,owner,receiptId),before);
  await reject(()=>getReceipt(db,{guestId:other.id},receiptId),'NOT_FOUND');
  await assert.rejects(()=>db.query("UPDATE bookings SET snapshot='{}' WHERE id=$1",[receiptId]),/immutable/);
  await assert.rejects(()=>db.query('DELETE FROM bookings WHERE id=$1',[receiptId]),/immutable/);
 });
 await t.test('successful retries recover after withdrawal and hiding the world',async()=>{
  const input=await booking(trip('service'));const first=await createBooking(db,owner,input);
  await unpublishContent(db,data.owner,ids.service!,false,'Withdraw');
  assert.deepEqual((await createBooking(db,owner,input)).receipt,first.receipt);
  await reject(()=>createBooking(db,owner,{...input,idempotencyKey:randomUUID()}),'NOT_BOOKABLE');
  await db.query('UPDATE worlds SET visible=false WHERE id=$1',[data.latheId]);
  assert.deepEqual(await getReceipt(db,owner,first.receipt.id),first.receipt);
  assert.deepEqual((await createBooking(db,owner,input)).receipt,first.receipt);
 });
});
