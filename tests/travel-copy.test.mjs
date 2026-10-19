import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// The web modules are loaded through tsx in this focused test (no database writes).
import {travelBilingual,copyText} from '../apps/web/src/lib/travel-copy.ts';
import {worldDetailCopy,detailBilingual} from '../apps/web/src/lib/detail-copy.ts';
import {initialDetailCopy,detailCopyDefaults} from '../packages/contracts/src/settings.ts';
test('Lathe copy stays world scoped and leaves persisted shared values intact',()=>{
 const shared=initialDetailCopy(),before=JSON.stringify(shared);
 const keys=Object.entries(detailCopyDefaults).filter(([,v])=>v.scope==='stay'&&v.en==='About this stay');
 assert.equal(keys.length,1);
 const key=keys[0][0];shared.en[key]='A custom shared heading';
 const overlay=worldDetailCopy(shared,'lathe-worlds');
 assert.equal(detailBilingual('en',overlay,'stay')('关于这处住宿','About this stay'),copyText('stay.overview.title','en'));
 assert.equal(shared.en[key],'A custom shared heading');
 assert.equal(worldDetailCopy(shared,'another-world'),shared);
 assert.notEqual(JSON.stringify(overlay),before);
});
test('Functional messages and unresolved-request instructions keep distinct outcomes',()=>{
 const plain=travelBilingual('zh-CN','another-world');
 assert.equal(plain('未定','Any time'),'不限时段');
 assert.equal(plain('人数','Travellers'),'出行人数');
 assert.match(copyText('booking.recovery.storage','zh-CN'),/尚未提交/);
 assert.match(copyText('booking.recovery.outcome-pending','zh-CN'),/结果尚未确认/);
 assert.match(copyText('booking.recovery.outcome-pending','en'),/without creating a duplicate/);
 assert.equal(travelBilingual('en','another-world')('想去哪里？','Where to?'),'Where to?');
 assert.equal(travelBilingual('en','lathe-worlds')('想去哪里？','Where to?'),'Your Planned Destination');
});
test('Every explicit legacy binding points to an approved entry',()=>{
 for(const file of ['travel-copy.ts','detail-copy.ts']){
  const source=readFileSync('apps/web/src/lib/'+file,'utf8');
  for(const m of source.matchAll(/:\s*'((?:home|booking|receipt|directory|navigation|functional|platform|stay|experience|service|detail)\.[^']+)'/g)){
   assert.ok(copyText(m[1],'en'),m[1]);assert.ok(copyText(m[1],'zh-CN'),m[1]);
  }
 }
});
