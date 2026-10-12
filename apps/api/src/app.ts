import {personaRoutes} from './persona-routes.ts';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { idSchema, kindSchema, localeSchema, loginSchema, slugSchema, createContentSchema, editContentSchema,
  parseBrowse, detailQuerySchema,
  revisionActionSchema, reviewActionSchema, restoreActionSchema, unpublishActionSchema, noteActionSchema, translationActionSchema } from '@plotstay/contracts';
import type { Database } from '@plotstay/database';
import { signatureProfiles, adminHome, reviewHome, listSettings, settingDetail, saveSetting, settingAction, publicDetailCopy, adminDetail, adminList, adminWorlds, assert, digest, DomainError, getActor,
  browseWorld, previewDetail, publishedDetail, publicHome, saveHomeDraft, publishHome, getPublished, listPublished, listWorlds, listLocales, publicDiscovery, login, createContent, editContent, submitRevision, reviewRevision,
  restorePublication, unpublishContent, releaseSiteBlock, saveTranslation, importContent, requireWorld, retryTranslation,
  createGuest, getGuest, quoteBooking, createBooking, getReceipt, findBooking, latestBooking } from '@plotstay/domain';

const localeQuery = z.object({ locale: localeSchema.default('en') }).strict();
const listQuery = localeQuery.extend({ world: slugSchema.optional(), kind: kindSchema.optional(),
  q: z.string().trim().max(200).optional(), parentId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).max(100000).default(0) });
const idParams = z.object({ id: idSchema });
const SESSION = 'plotstay_session';
const GUEST = 'plotstay_guest';

export async function createApp(db: Database, options: { logger?: boolean; webOrigin?: string; cookieSecure?: boolean } = {}) {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 2 * 1024 * 1024 });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  const webOrigin = options.webOrigin ?? process.env.WEB_ORIGIN ?? 'http://localhost:4321';
  const cookieOptions = { path: '/api', httpOnly: true, sameSite: 'strict' as const,
    secure: options.cookieSecure ?? process.env.COOKIE_SECURE === 'true', maxAge: 12 * 60 * 60 };

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Robots-Tag', 'noindex');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      assert(request.headers.origin === webOrigin, 403, 'ORIGIN_FORBIDDEN', 'Use the configured website origin.');
    }
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Invalid request.', details: error.issues } });
    if (error instanceof DomainError) return reply.code(error.status).send({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
    if ((error as { code?: string }).code === '23505') return reply.code(409).send({ error: { code: 'ALREADY_EXISTS', message: 'This identifier already exists.' } });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: { code: 'BAD_REQUEST', message: status === 429 ? 'Too many requests.' : 'Invalid request.' } });
    request.log.error({ err: error }, 'API request failed');
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }));
  async function actor(token?: string) {
    const result = await getActor(db, token);
    assert(result, 401, 'SESSION_REQUIRED', 'Sign in to continue.');
    return result;
  }

  personaRoutes(app,db);
  app.get('/api/health', async (_request, reply) => {
    try {
      // Readiness requires the schema as well as the connection.
      await db.query('SELECT code FROM locales LIMIT 1');
      return { status: 'ok' };
    } catch { return reply.code(503).send({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is not ready.' } }); }
  });
  app.get('/api/locales', async () => ({ locales: await listLocales(db) }));
  app.get('/api/discovery', async () => publicDiscovery(db));
  app.get('/api/worlds', async request => ({ worlds: await listWorlds(db, localeQuery.parse(request.query).locale) }));
  app.get('/api/browse', async request => {
    const query = z.record(z.string(), z.string()).parse(request.query);
    const locale = localeSchema.parse(query.locale ?? 'en');
    let state;
    try { state = parseBrowse(new URLSearchParams(query)); } catch { throw new DomainError(400, 'INVALID_INPUT', 'Invalid browse parameters.'); }
    return browseWorld(db, locale, state);
  });
  app.get('/api/contents', async request => {
    const { locale, ...filters } = listQuery.parse(request.query);
    return { contents: await listPublished(db, locale, filters) };
  });
  app.get('/api/contents/:id', async request => {
    const content = await getPublished(db, localeQuery.parse(request.query).locale, idParams.parse(request.params));
    assert(content, 404, 'NOT_FOUND', 'Content not found.');
    return { content };
  });
  app.get('/api/worlds/:world/:kind/:slug', async request => {
    const params = z.object({ world: slugSchema, kind: kindSchema, slug: slugSchema }).parse(request.params);
    const content = await getPublished(db, localeQuery.parse(request.query).locale, params);
    assert(content, 404, 'NOT_FOUND', 'Content not found.');
    return { content };
  });

  app.get('/api/worlds/:world/:kind/:slug/detail', async request => {
    const params = z.object({ world: slugSchema, kind: z.enum(['stay', 'experience', 'service']), slug: slugSchema }).parse(request.params);
    const query = detailQuerySchema.parse(request.query);
    return publishedDetail(db, query.locale, params, query.notesPage);
  });

  app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const result = await login(db, input.email, input.password);
    if (request.cookies[SESSION]) await db.query('DELETE FROM sessions WHERE token_hash=$1', [digest(request.cookies[SESSION])]);
    reply.setCookie(SESSION, result.token, cookieOptions);
    return { actor: result.actor };
  });
  app.post('/api/auth/logout', async (request, reply) => {
    if (request.cookies[SESSION]) await db.query('DELETE FROM sessions WHERE token_hash=$1', [digest(request.cookies[SESSION])]);
    reply.clearCookie(SESSION, cookieOptions);
    return { signedOut: true };
  });
  app.get('/api/auth/me', async request => ({ actor: await actor(request.cookies[SESSION]) }));
  // Guest credentials never share the administrator session or appear in JSON/URLs.
  app.post('/api/guest', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    z.object({}).strict().parse(request.body);
    if (!await getGuest(db, request.cookies[GUEST])) {
      const guest = await createGuest(db);
      reply.setCookie(GUEST, guest.token, { ...cookieOptions, maxAge: 180 * 24 * 60 * 60 });
    }
    return { ready: true };
  });
  async function guest(token?: string) {
    const id = await getGuest(db, token);
    assert(id, 401, 'SESSION_REQUIRED', 'The original visitor cookie is required.');
    return id;
  }
  app.get('/api/guest', async request => { await guest(request.cookies[GUEST]); return { ready: true }; });
  app.post('/api/bookings/quote', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async request => quoteBooking(db, request.body));
  app.post('/api/bookings', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const result = await createBooking(db, { guestId: await guest(request.cookies[GUEST]) }, request.body);
    return reply.code(result.created ? 201 : 200).send(result);
  });
  app.get('/api/bookings/attempts/:id', async request => ({ receipt: await findBooking(db,
    await guest(request.cookies[GUEST]), idParams.parse(request.params).id) }));
  app.get('/api/bookings/latest', async request => ({ id: await latestBooking(db,
    await guest(request.cookies[GUEST]), z.object({ contentId: idSchema }).strict().parse(request.query).contentId) ?? null }));
  app.get('/api/bookings/:id', async request => ({ receipt: await getReceipt(db,
    { guestId: await guest(request.cookies[GUEST]) }, idParams.parse(request.params).id) }));
  app.get('/api/detail-copy', async()=>({body:await publicDetailCopy(db)}));
  app.get('/api/admin/worlds/:worldId/settings',async request=>({settings:await listSettings(db,await actor(request.cookies[SESSION]),z.object({worldId:idSchema}).parse(request.params).worldId)}));
  app.get('/api/admin/settings/:id',async request=>settingDetail(db,await actor(request.cookies[SESSION]),idParams.parse(request.params).id));
  app.put('/api/admin/settings/:id',async request=>{const b=z.object({body:z.unknown(),baseRevisionId:idSchema}).strict().parse(request.body);return saveSetting(db,await actor(request.cookies[SESSION]),idParams.parse(request.params).id,b.body,b.baseRevisionId);});
  app.post('/api/admin/settings/:id/:action',async request=>{const p=z.object({id:idSchema,action:z.enum(['submit','publish','reject','restore'])}).parse(request.params);const b=z.object({revisionId:idSchema,publicationId:idSchema.optional()}).strict().parse(request.body);return settingAction(db,await actor(request.cookies[SESSION]),p.id,p.action,b.revisionId,b.publicationId);});
  app.get('/api/admin/worlds', async request => ({ worlds: await adminWorlds(db, await actor(request.cookies[SESSION])) }));
  app.get('/api/admin/worlds/:worldId/members', async request => {
    const user=await actor(request.cookies[SESSION]);
    const {worldId}=z.object({worldId:idSchema}).parse(request.params);
    const world=await requireWorld(db,user,worldId,true);
    const members=(await db.query(`SELECT m.user_id,u.email,m.role FROM world_members m JOIN users u ON u.id=m.user_id WHERE m.world_id=$1 ORDER BY m.role,u.email`,[worldId])).rows;
    const owner=(await db.query('SELECT id,email FROM users WHERE id=$1',[world.owner_id])).rows[0];
    return {owner,members:members.filter(m=>m.user_id!==world.owner_id)};
  });
  app.get('/api/admin/worlds/:worldId/contents', async request => {
    const user = await actor(request.cookies[SESSION]);
    const { worldId } = z.object({ worldId: idSchema }).parse(request.params);
    const query=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),kind:kindSchema.optional(),q:z.string().max(200).optional(),status:z.enum(['draft','submitted','approved','rejected','published','unpublished']).optional(),parentId:idSchema.optional()}).strict().parse(request.query);
    return adminList(db, user, worldId,query);
  });
  app.get('/api/admin/contents/:id/preview', async request => {
    const query=z.object({revisionId:idSchema,token:idSchema,locale:localeSchema,settingId:idSchema.optional(),settingRevision:idSchema.optional(),homeRevision:idSchema.optional()}).strict().parse(request.query);
    const user=await actor(request.cookies[SESSION]),id=idParams.parse(request.params).id;
    const detail=await previewDetail(db,user,id,query.revisionId,query.token,query.locale);
    if(query.settingId){
      const config=await settingDetail(db,user,query.settingId),s=config.setting;
      assert(s.head_revision_id===query.settingRevision,409,'REVISION_CONFLICT','Configuration preview is out of date.');
      const entity=await adminDetail(db,user,id);
      assert(s.kind==='copy'||(s.kind==='world'&&s.entity_id===detail.content.worldId)||(s.kind==='place'&&s.entity_id===detail.content.placeId)||(s.kind==='persona'&&(s.entity_id===entity.content.persona_id||(await db.query('SELECT 1 FROM provider_bindings WHERE content_id=$1 AND persona_id=$2',[id,s.entity_id])).rowCount)),400,'INVALID_REFERENCE','This entry does not reference the selected configuration.');
      const body=config.revisions.find(r=>r.id===query.settingRevision)!.body;
      detail.previewSetting={kind:s.kind,body,revisionId:query.settingRevision!};
      if(s.kind==='place')detail.content.placeName=body[query.locale]??body[entity.revisions[0].source_locale]??null;
      if(s.kind==='persona'){const profile=(body[query.locale]??body[entity.revisions[0].source_locale]);detail.content.personaName=profile?.name??null;if(detail.content.kind!=='review'&&profile){detail.content.provider=signatureProfiles({[query.locale]:profile})[query.locale];detail.content.text={...detail.content.text,hostName:profile.name,hostBio:profile.bio};}}
    }
    if(query.homeRevision){const home=await adminHome(db,user,detail.content.worldId);assert(home.setting?.head_revision_id===query.homeRevision,409,'REVISION_CONFLICT','Home configuration changed.');const body=home.revisions.find(r=>r.id===query.homeRevision)!.body;detail.content.categoryName=(body.translations[query.locale]??body.translations[body.sourceLocale]).categoryNames[detail.content.attributes.category??'']??null;detail.previewSetting={kind:'categories',body:{},revisionId:query.homeRevision};}
    return detail;
  });
  app.get('/api/admin/contents/:id', async request => {
    const user = await actor(request.cookies[SESSION]);
    return adminDetail(db, user, idParams.parse(request.params).id);
  });
  app.get('/api/admin/worlds/:worldId/options', async request => {
    const user = await actor(request.cookies[SESSION]);
    const { worldId } = z.object({ worldId: idSchema }).parse(request.params);
    await requireWorld(db, user, worldId);
    const [places, personas, parents] = await Promise.all([
      db.query('SELECT id,slug,names FROM places WHERE world_id=$1 ORDER BY slug', [worldId]),
      db.query('SELECT id,profiles FROM personas WHERE approved AND (owner_id=$1 OR $2) ORDER BY created_at', [user.id, user.siteRole === 'admin']),
      db.query("SELECT id,slug,kind FROM contents WHERE world_id=$1 AND kind IN ('stay','experience','service') ORDER BY slug", [worldId]),
    ]);
    const home = await publicHome(db, worldId, 'en');
    return { categories: home?.config.categories ?? [], places: places.rows, personas: personas.rows, parents: parents.rows, translationProvider: process.env.TRANSLATION_PROVIDER ?? 'disabled' };
  });
  app.get('/api/admin/worlds/:worldId/home',async request=>adminHome(db,await actor(request.cookies[SESSION]),z.object({worldId:idSchema}).parse(request.params).worldId));
  app.post('/api/admin/worlds/:worldId/home/review/:action',async request=>{const p=z.object({worldId:idSchema,action:z.enum(['submit','publish','reject','restore'])}).parse(request.params);const b=z.object({revisionId:idSchema,publicationId:idSchema.optional()}).strict().parse(request.body);return reviewHome(db,await actor(request.cookies[SESSION]),p.worldId,p.action,b.revisionId,b.publicationId);});
  app.put('/api/admin/worlds/:worldId/home', async request => {
    const user = await actor(request.cookies[SESSION]);
    const { worldId } = z.object({ worldId: idSchema }).parse(request.params);
    const input = z.object({ body: z.unknown(), baseRevisionId: idSchema.nullable() }).strict().parse(request.body);
    return saveHomeDraft(db, user, worldId, input.body, input.baseRevisionId);
  });
  app.post('/api/admin/worlds/:worldId/home/publish', async request => {
    const user = await actor(request.cookies[SESSION]);
    const { worldId } = z.object({ worldId: idSchema }).parse(request.params);
    return publishHome(db, user, worldId, revisionActionSchema.parse(request.body).revisionId);
  });
  app.post('/api/admin/contents', async (request, reply) => {
    const user = await actor(request.cookies[SESSION]);
    return reply.code(201).send(await createContent(db, user, createContentSchema.parse(request.body)));
  });
  app.post('/api/admin/contents/:id/revisions', async request => {
    const user = await actor(request.cookies[SESSION]);
    return editContent(db, user, idParams.parse(request.params).id, editContentSchema.extend({ baseDraftToken: idSchema }).parse(request.body));
  });
  app.post('/api/admin/contents/:id/submit', async request => {
    const user = await actor(request.cookies[SESSION]);
    const body=revisionActionSchema.parse(request.body);return submitRevision(db, user, idParams.parse(request.params).id, body.revisionId,body.draftToken);
  });
  app.post('/api/admin/contents/:id/review', async request => {
    const user = await actor(request.cookies[SESSION]);
    const body = reviewActionSchema.parse(request.body);
    return reviewRevision(db, user, idParams.parse(request.params).id, body.revisionId, body.decision, body.note,body.draftToken);
  });
  app.post('/api/admin/contents/:id/restore', async request => {
    const user = await actor(request.cookies[SESSION]);
    return restorePublication(db, user, idParams.parse(request.params).id, restoreActionSchema.parse(request.body).publicationId);
  });
  app.post('/api/admin/contents/:id/unpublish', async request => {
    const user = await actor(request.cookies[SESSION]);
    const body = unpublishActionSchema.parse(request.body);
    return unpublishContent(db, user, idParams.parse(request.params).id, body.siteBlock, body.note);
  });
  app.post('/api/admin/contents/:id/release-site-block', async request => {
    const user = await actor(request.cookies[SESSION]);
    return releaseSiteBlock(db, user, idParams.parse(request.params).id, noteActionSchema.parse(request.body).note);
  });
  app.put('/api/admin/contents/:id/revisions/:revisionId/translations/:locale', async request => {
    const user = await actor(request.cookies[SESSION]);
    const params = z.object({ id: idSchema, revisionId: idSchema, locale: localeSchema }).parse(request.params);
    const body = translationActionSchema.parse(request.body);
    return saveTranslation(db, user, params.id, params.revisionId, params.locale, body.body, body.baseTranslationId);
  });
  for (const mode of ['preview', 'apply'] as const) {
    app.post(`/api/admin/imports/${mode}`, async request => {
      const user = await actor(request.cookies[SESSION]);
      return importContent(db, user, request.body, mode === 'preview');
    });
  }
  app.get('/api/admin/worlds/:worldId/imports', async request => {
    const user = await actor(request.cookies[SESSION]);
    const { worldId } = z.object({ worldId: idSchema }).parse(request.params);
    await requireWorld(db, user, worldId);
    return { batches: (await db.query('SELECT id,source,results,created_at FROM import_batches WHERE world_id=$1 ORDER BY created_at DESC LIMIT 50', [worldId])).rows };
  });
  app.post('/api/admin/translation-jobs/:id/retry', async request => {
    const user = await actor(request.cookies[SESSION]);
    z.object({}).strict().parse(request.body);
    return retryTranslation(db, user, idParams.parse(request.params).id);
  });
  return app;
}
