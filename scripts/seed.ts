import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createDatabase, transaction, type Database } from '@plotstay/database';
import { createContentSchema, loginSchema, textSchema } from '@plotstay/contracts';
import { createContentInTransaction, hashPassword, type Actor } from '@plotstay/domain';

// A single transaction and advisory lock make concurrent/repeated runs safe.
// Existing data (including edits, publication pointers and passwords) is preserved.
export async function seed(db: Database, options: { email: string; password: string }) {
  loginSchema.parse(options);
  if (options.password.length < 16) throw new Error('ADMIN_PASSWORD must contain at least 16 characters.');
  const adminHash = await hashPassword(options.password);
  const fixtureHash = await hashPassword(randomBytes(32).toString('base64url'));
  return transaction(db, async client => {
    await client.query('SELECT pg_advisory_xact_lock(184570922)');
    async function user(email: string, admin = false): Promise<Actor> {
      await client.query(`INSERT INTO users(email,password_hash,site_role) VALUES ($1,$2,$3) ON CONFLICT(email) DO NOTHING`,
        [email.toLowerCase(), admin ? adminHash : fixtureHash, admin ? 'admin' : 'user']);
      const { rows: [row] } = await client.query('SELECT id,email,site_role FROM users WHERE email=$1', [email.toLowerCase()]);
      if (admin && row.site_role !== 'admin') throw new Error('Seed email belongs to a non-administrator. Choose a separate ADMIN_EMAIL.');
      return { id: row.id, email: row.email, siteRole: row.site_role };
    }
    const admin = await user(options.email, true);
    const owner = await user('lathe-owner@fixtures.plotstay.invalid');
    const editor = await user('lathe-editor@fixtures.plotstay.invalid');
    const secondOwner = await user('harbour-owner@fixtures.plotstay.invalid');
    await client.query(`INSERT INTO fandoms(slug,names) VALUES ('warhammer-40000',$1) ON CONFLICT(slug) DO NOTHING`,
      [{ en: 'Warhammer 40,000', 'zh-CN': '战锤 40,000' }]);
    const { rows: [fandom] } = await client.query("SELECT id FROM fandoms WHERE slug='warhammer-40000'");
    async function world(slug: string, actor: Actor, translations: object, fandomId: string | null = null) {
      await client.query(`INSERT INTO worlds(slug,fandom_id,owner_id,source_locale,translations,visible)
        VALUES ($1,$2,$3,'en',$4,true) ON CONFLICT(slug) DO NOTHING`, [slug, fandomId, actor.id, translations]);
      const { rows: [row] } = await client.query('SELECT id FROM worlds WHERE slug=$1', [slug]);
      await client.query(`INSERT INTO world_members(world_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`, [row.id, actor.id]);
      return row.id as string;
    }
    const latheId = await world('lathe-worlds', owner, {
      en: { name: 'Lathe Worlds', description: 'Dummy journeys through a fictional forge world.', currencyName: 'Forge tokens' },
      'zh-CN': { name: '拉斯世界', description: '穿行虚构铸造世界的占位旅行内容。', currencyName: '铸造代币' }
    }, fandom.id);
    const harbourId = await world('test-harbour', secondOwner, {
      en: { name: 'Test Harbour', description: 'A second fictional world for development.', currencyName: 'Harbour tokens' },
      'zh-CN': { name: '测试港湾', description: '用于开发验证的第二个虚构世界。', currencyName: '港湾代币' }
    });
    await client.query(`INSERT INTO world_members(world_id,user_id,role) VALUES ($1,$2,'editor') ON CONFLICT DO NOTHING`, [latheId, editor.id]);
    async function place(worldId: string, slug: string, names: object) {
      await client.query('INSERT INTO places(world_id,slug,names) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [worldId, slug, names]);
      return (await client.query('SELECT id FROM places WHERE world_id=$1 AND slug=$2', [worldId, slug])).rows[0].id as string;
    }
    const forgePlace = await place(latheId, 'dummy-forge-district', { en: 'Sample Forge District', 'zh-CN': '示例铸造区' });
    const harbourPlace = await place(harbourId, 'dummy-pier', { en: 'Sample Pier', 'zh-CN': '示例码头' });
    // Personas have no slug, so use a reserved stable fixture ID.
    const personaId = '00100000-0000-4000-8000-000000000001';
    await client.query(`INSERT INTO personas(id,owner_id,profiles,approved) VALUES ($1,$2,$3,true) ON CONFLICT(id) DO NOTHING`,
      [personaId, owner.id, { en: { name: 'Visitor 17', bio: 'A fictional traveller.' }, 'zh-CN': { name: '旅客十七', bio: '一位虚构旅客。' } }]);
    const ids: Record<string, string> = {};
    const workSchema=Boolean((await client.query("SELECT to_regclass('work_ownership') AS t")).rows[0].t);
    let providerId:string|null=null;
    if(workSchema){
      providerId='00100000-0000-4000-8000-000000000013';
      await client.query('INSERT INTO personas(id,owner_id,profiles,approved)VALUES($1,$2,$3,true) ON CONFLICT(id)DO NOTHING',[providerId,admin.id,{en:{name:'Sample operator',bio:'Synthetic seed operator'},'zh-CN':{name:'示例经营者',bio:'合成样例身份'}}]);
      for(const worldId of [latheId,harbourId]){
        await client.query('INSERT INTO world_participations(world_id,user_id,joined,recorded_by)VALUES($1,$2,true,$2)ON CONFLICT DO NOTHING',[worldId,admin.id]);
        await client.query("INSERT INTO work_eligibilities(world_id,user_id,status,updated_by)VALUES($1,$2,'approved',$2)ON CONFLICT DO NOTHING",[worldId,admin.id]);
      }
    }
    async function entry(slug: string, kind: 'stay' | 'experience' | 'review', titles: [string, string], settings: {
      worldId?: string; placeId?: string; parentId?: string; draft?: boolean; missingTranslation?: boolean;
    } = {}) {
      const worldId = settings.worldId ?? latheId;
      const existing = await client.query('SELECT id FROM contents WHERE world_id=$1 AND kind=$2 AND slug=$3', [worldId, kind, slug]);
      if (existing.rowCount) { ids[slug] = existing.rows[0].id; return; }
      const text = textSchema.parse({ title: titles[0], summary: 'Fictional sample content.',
        description: kind === 'review' ? 'The hum continued all night. Five fictional stars for consistency.' : 'This is dummy data for Plotstay. No real stay, activity or payment is offered.',
        ...(kind === 'stay' ? { facilities: ['A quiet observation window', 'One very persistent clock'], rules: ['A fictional stay; bring your imagination.'] } : {}),
        ...(kind === 'experience' ? { itinerary: ['Meet at the sample gate', 'Watch the fictional machinery'], hostName: 'Sample Guide', hostBio: 'Your fictional local guide.' } : {}) });
      const chinese = textSchema.parse({ title: titles[1], summary: '虚构的占位内容。',
        description: kind === 'review' ? '嗡鸣声持续了一整晚。因为始终如一，给出虚构五星好评。' : '这是 Plotstay 的测试占位内容，不提供真实住宿、活动或付款。',
        ...(kind === 'stay' ? { facilities: ['安静的观察窗', '一只坚持报时的钟'], rules: ['虚构住宿，请带上想象力。'] } : {}),
        ...(kind === 'experience' ? { itinerary: ['在示例大门集合', '参观虚构机械'], hostName: '示例向导', hostBio: '你的虚构本地向导。' } : {}) });
      const input = createContentSchema.parse({ worldId, placeId: settings.placeId ?? forgePlace, kind, slug,
        parentContentId: settings.parentId ?? null, personaId: kind === 'review' ? personaId : providerId,
        sourceLocale: 'en', text, translations: settings.missingTranslation ? {} : { 'zh-CN': chinese },
        attributes: kind === 'review' ? { rating: 5 } : { price: { amount: kind === 'stay' ? 120 : 45, unit: kind === 'stay' ? 'night' : 'person' },
          ...(kind === 'experience' ? { durationMinutes: 90 } : {}) } });
      const created = await createContentInTransaction(client, admin, input);
      ids[slug] = created.id;
      if (!settings.draft) {
        // These hand-written bilingual fixtures are deliberately approved as seed data.
        await client.query("UPDATE content_revisions SET status='approved' WHERE id=$1", [created.revisionId]);
        const { rows: [publication] } = await client.query(`INSERT INTO publications(content_id,revision_id,published_by)
          VALUES ($1,$2,$3) RETURNING id`, [created.id, created.revisionId, admin.id]);
        await client.query(`INSERT INTO publication_locales(publication_id,revision_id,locale,translation_id)
          SELECT $1,revision_id,locale,translation_id FROM revision_locales WHERE revision_id=$2`, [publication.id, created.revisionId]);
        await client.query('UPDATE contents SET published_publication_id=$2 WHERE id=$1', [created.id, publication.id]);
        await client.query(`INSERT INTO moderation_events(content_id,revision_id,world_id,actor_id,action,note)
          VALUES ($1,$2,$3,$4,'published','Hand-written bilingual dummy seed')`, [created.id, created.revisionId, worldId, admin.id]);
      }
    }
    await entry('observation-room', 'stay', ['Observation Room', '观察室']);
    await entry('shift-rest-cabin', 'stay', ['Shift Rest Cabin', '轮班休息舱']);
    await entry('forge-walk', 'experience', ['Forge Walk', '铸造区漫步']);
    await entry('signal-listening', 'experience', ['Signal Listening', '信号聆听']);
    await entry('visitor-note', 'review', ['A very consistent hum', '始终如一的嗡鸣声'], { parentId: ids['observation-room'] });
    await entry('harbour-room', 'stay', ['Harbour Room', '港湾客房'], { worldId: harbourId, placeId: harbourPlace });
    await entry('unpublished-room', 'stay', ['DRAFT — Unpublished Room', '草稿：未公开客房'], { draft: true });
    await entry('missing-translation', 'experience', ['DRAFT — Awaiting Translation', '草稿：等待翻译'], { draft: true, missingTranslation: true });
    return { admin, owner, editor, secondOwner, latheId, harbourId, forgePlace, harbourPlace, ids, providerId };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createDatabase();
  try {
    await seed(db, { email: process.env.ADMIN_EMAIL ?? '', password: process.env.ADMIN_PASSWORD ?? '' });
    console.log('Dummy seed complete; existing records and credentials preserved.');
  } finally { await db.end(); }
}
