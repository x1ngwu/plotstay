import {createFixtureContent as createContent,fixtureOperator} from './work-fixtures.ts';
import { createContentSchema } from '@plotstay/contracts';
import { submitRevision, reviewRevision } from '@plotstay/domain';
import { fixture } from './helpers.ts';
import { seedDiscovery } from '../scripts/seed-discovery.ts';

export async function detailFixture() {
  const f = await fixture();
  try {
    await seedDiscovery(f.db, f.data);
    const publish = async (c: { id: string; revisionId: string }) => {
      await submitRevision(f.db, f.data.owner, c.id, c.revisionId);
      return reviewRevision(f.db, f.data.owner, c.id, c.revisionId, 'publish', 'Isolated phase 4 fixture');
    };
    const entries = [];
    for (const kind of ['stay', 'experience', 'service'] as const) {
      await fixtureOperator(f.db,f.data.owner,f.data.latheId);
      const provider=(await f.db.query('INSERT INTO personas(owner_id,approved,profiles)VALUES($1,true,$2)RETURNING id',[f.data.owner.id,{en:{name:`Test ${kind} host`,bio:'An introduction from the published version.'},'zh-CN':{name:`测试人物${kind}`,bio:'来自已发布版本的人物介绍。'}}])).rows[0];
      const input = createContentSchema.parse({
        worldId: f.data.latheId, personaId:provider.id, placeId: f.data.forgePlace, kind, slug: `detail-${kind}`, sourceLocale: 'en',
        text: { title: `Detail ${kind}`, summary: 'A short introduction.', description: 'Published description.\nSecond paragraph.' + (kind === 'service' ? '\n' + 'Long detail paragraph for responsive reading. '.repeat(15) + 'X'.repeat(180) : ''),
          tags: ['Test journey'], hostName: `Test ${kind} host`, hostBio: 'An introduction from the published version.',
          facilities: ['A reading lamp', 'A quiet desk'], rules: ['Bring your imagination.'],
          ...(kind === 'stay' ? { highlights: ['An observation window'] } : kind === 'experience' ? { itinerary: ['Meet your guide', 'Explore the workshop'], included: ['A workshop map'] } : { serviceItems: ['An initial inspection', 'A written maintenance report'], itinerary: ['Meet the provider', 'Review the work'] }),
          imageAlts: { one: 'Room illustration', two: 'Maintenance illustration', broken: 'Missing test image' } },
        translations: { 'zh-CN': { title: `详情${kind}`, summary: '简短介绍。', description: '已发布的介绍。\n第二段文字。',
          tags: ['测试旅程'], hostName: `测试人物${kind}`, hostBio: '来自已发布版本的人物介绍。', facilities: ['阅读灯', '安静的书桌'], rules: ['带上想象力。'],
          ...(kind === 'stay' ? { highlights: ['一扇观察窗'] } : kind === 'experience' ? { itinerary: ['与向导集合', '参观工坊'], included: ['工坊地图'] } : { serviceItems: ['初次检查', '书面检修报告'], itinerary: ['与提供者会面', '确认工作'] }),
          imageAlts: { one: '房间插画', two: '检修插画', broken: '缺失的测试图片' } } },
        attributes: { images: [{ id: 'one', url: '/media/quarters.svg' }, { id: 'two', url: '/media/maintenance.svg' }, { id: 'broken', url: '/media/phase4-missing.svg' }],
          price: { amount: 72, unit: kind === 'stay' ? 'night' : kind === 'experience' ? 'person' : 'session' },
          ...(kind !== 'stay' ? { durationMinutes: 90 } : {}) }
      });
      const created = await createContent(f.db, f.data.owner, input);
      const publication = await publish(created);
      entries.push({ ...created, input, publicationId: publication.publicationId! });
      for (let i = 0; i < (kind === 'stay' ? 8 : 1); i++) {
        const note = await createContent(f.db, f.data.owner, createContentSchema.parse({
          worldId: f.data.latheId, kind: 'review', slug: `${kind}-note-${i}`, sourceLocale: 'en', parentContentId: created.id,
          personaId: i === 0 ? '00100000-0000-4000-8000-000000000001' : null,
          text: { title: `Visitor note ${i}`, description: `Fictional visitor account ${i}.`, review: {name:'Visitor 17'} },
          translations: { 'zh-CN': { title: `游客手记${i}`, description: `虚构的旅行记录${i}。`, review: {name:'旅客十七'} } }, attributes: {}
        }));
        await publish(note);
      }
    }
    return { ...f, entries, publish };
  } catch (error) { await f.cleanup(); throw error; }
}
