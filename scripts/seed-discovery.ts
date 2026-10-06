import { pathToFileURL } from 'node:url';
import { createDatabase, type Database } from '@plotstay/database';
import { createContentSchema, homeConfigSchema } from '@plotstay/contracts';
import { createContent, submitRevision, reviewRevision, saveHomeDraft, publishHome } from '@plotstay/domain';
import { seed } from './seed.ts';
import { discoveryCopy } from './discovery-copy.ts';

export async function seedDiscovery(db: Database, data: Awaited<ReturnType<typeof seed>>) {
  // Session lock covers the multi-transaction reviewed workflow, including concurrent runs.
  const guard = await db.connect();
  await guard.query('SELECT pg_advisory_lock(184570923)');
  try {
    const placeIds: Record<string, string> = { forge: data.forgePlace };
    for (const [slug, en, zh] of [['orbital-docks','Orbital Docks','轨道船坞'],['quiet-archive','Quiet Archive','静默档案区']]) {
      await db.query('INSERT INTO places(world_id,slug,names) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [data.latheId, slug, { en, 'zh-CN': zh }]);
      placeIds[slug!] = (await db.query('SELECT id FROM places WHERE world_id=$1 AND slug=$2', [data.latheId, slug])).rows[0].id;
    }
    const config = homeConfigSchema.parse({
      sourceLocale: 'en', background: { id: 'lathe-orbit', url: '/media/lathe-orbit.svg' },
      categories: [
        { slug: 'forge-tours', kind: 'experience', icon: 'walk' }, { slug: 'signals', kind: 'experience', icon: 'signal' },
        { slug: 'stargazing', kind: 'experience', icon: 'orbit' }, { slug: 'maintenance', kind: 'service', icon: 'tool' },
      ],
      sections: [{ id: 'experiences', type: 'experiences' }, { id: 'homes', type: 'stays' }],
      placeRows: 3, placeOrder: ['orbital-docks','quiet-archive','dummy-forge-district'],
      promotion: { enabled: true, target: { page: 'results' } },
      benefits: [{ icon: 'home', target: { page: 'results' } }, { icon: 'orbit', target: { page: 'results', type: 'services' } }, { icon: 'star', target: { page: 'help' } }],
      translations: {
        en: { ...discoveryCopy.en, backgroundAlt: 'An illustrated forge city beneath a ringed planet.',
          categoryNames: { 'forge-tours': 'Forge walks', signals: 'Signal listening', stargazing: 'Beyond the atmosphere', maintenance: 'Repairs & rituals' },
          sectionTitles: { experiences: 'Popular experiences in {world}', homes: 'Popular homes in {world}' },
        },
        'zh-CN': { ...discoveryCopy['zh-CN'], backgroundAlt: '环形行星下的铸造城插画。',
          categoryNames: { 'forge-tours': '铸造区漫步', signals: '信号聆听', stargazing: '大气层之外', maintenance: '检修与仪式' },
          sectionTitles: { experiences: '{world}的热门活动', homes: '{world}的热门住宿' },
        },
      },
    });
    const existing = await db.query('SELECT world_id FROM world_home_settings WHERE world_id=$1', [data.latheId]);
    if (!existing.rowCount) {
      const draft = await saveHomeDraft(db, data.admin, data.latheId, config, null);
      await publishHome(db, data.admin, data.latheId, draft.revisionId);
    }
    const homes = [
      ['dockside-window','A window above the docks','船坞上方的一扇窗','orbital-docks'],
      ['arrival-cabin','The arrivals cabin','抵达者小屋','orbital-docks'],
      ['night-shift-suite','Night shift, late checkout','夜班套间，迟些退房','forge'],
      ['archive-nook','A nook between the archives','档案之间的小角落','quiet-archive'],
      ['silent-reading-room','The silent reading room','静默阅览室','quiet-archive'],
      ['starboard-studio','Starboard studio for one very long weekend','适合漫长周末的右舷单间','orbital-docks'],
    ];
    const experiences = [
      ['first-light-walk','First light at the foundry','铸造厂的第一束光','forge','forge-tours'],
      ['dock-sunset','A slow orbit at sunset','日落时分，缓慢绕行','orbital-docks','stargazing'],
      ['archive-whispers','Listening to the archives','聆听档案的低语','quiet-archive','signals'],
      ['assembly-tour','A walk along the assembly line','沿着装配线走一走','forge','forge-tours'],
      ['deep-space-radio','Postcards from deep space','来自深空的明信片','orbital-docks','signals'],
      ['quiet-constellations','Constellations without small talk','不必寒暄的观星之夜','quiet-archive','stargazing'],
    ];
    const services = [
      ['augmetic-tune-up','A little augmetic tune-up','义体小保养','forge','maintenance'],
      ['luggage-blessing','Luggage inspection & a small blessing','行李检查，附赠小小祝福','orbital-docks','maintenance'],
    ];
    for (const [kind, rows] of [['stay',homes],['experience',experiences],['service',services]] as const) {
      for (const [i, row] of rows.entries()) {
        const [slug, en, zh, place, category] = row;
        const found = await db.query('SELECT id FROM contents WHERE world_id=$1 AND kind=$2 AND slug=$3', [data.latheId, kind, slug]);
        if (found.rowCount) continue;
        const text = { title: en, summary: kind === 'stay' ? 'A quiet corner of a world that never quite sleeps.' : kind === 'service' ? 'Local expertise. A reassuring number of tools.' : 'Make a little time for life beyond your shift.',
          description: 'An imagined visit to the Lathe Worlds. This bilingual demonstration listing is a work of fiction, ready for a future story of its own.',
          hostName: kind === 'service' ? 'The off-duty maintenance desk' : 'Your local host', tags: ['Slow travel', 'Fictional journey'],
          imageAlts: { cover: kind === 'stay' ? 'Illustration of quiet quarters.' : kind === 'service' ? 'Illustration of a maintenance station.' : 'Illustration of an orbital forge city.' } };
        const translated = { title: zh, summary: kind === 'stay' ? '在不曾真正入眠的世界里，留一个安静角落。' : kind === 'service' ? '本地人的手艺，和让人安心的工具数量。' : '给轮班以外的生活，留一点时间。',
          description: '一段想象中的拉斯世界之旅。这是双语演示内容，所有体验与报价均为虚构，等待日后填入正式故事。',
          hostName: kind === 'service' ? '下班后的检修台' : '你的本地房东', tags: ['慢旅行', '虚构旅程'], imageAlts: { cover: kind === 'stay' ? '安静舱室的插画。' : kind === 'service' ? '检修台插画。' : '轨道铸造城插画。' } };
        const created = await createContent(db, data.admin, createContentSchema.parse({ worldId: data.latheId, placeId: placeIds[place!], kind, slug,
          sourceLocale: 'en', text, translations: { 'zh-CN': translated }, attributes: { category,
            images: i === 5 ? [] : [{ id: 'cover', url: kind === 'stay' ? '/media/quarters.svg' : kind === 'service' ? '/media/maintenance.svg' : '/media/lathe-orbit.svg' }],
            price: { amount: kind === 'stay' ? 80 + i * 25 : 30 + i * 15, unit: kind === 'stay' ? 'night' : kind === 'service' ? 'session' : 'person' },
            ...(kind === 'stay' ? {} : { durationMinutes: 45 + i * 15 }) } }));
        await submitRevision(db, data.admin, created.id, created.revisionId);
        await reviewRevision(db, data.admin, created.id, created.revisionId, 'publish', 'Hand-written phase 3 bilingual demo; fictional content.');
      }
    }
  } finally { await guard.query('SELECT pg_advisory_unlock(184570923)'); guard.release(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createDatabase();
  try { await seedDiscovery(db, await seed(db, { email: process.env.ADMIN_EMAIL ?? '', password: process.env.ADMIN_PASSWORD ?? '' })); console.log('Discovery demo ready; existing records preserved.'); }
  finally { await db.end(); }
}
