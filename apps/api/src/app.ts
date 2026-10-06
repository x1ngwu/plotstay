import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { idSchema, kindSchema, localeSchema, loginSchema, slugSchema } from '@plotstay/contracts';
import type { Database } from '@plotstay/database';
import { adminDetail, adminList, adminWorlds, assert, digest, DomainError, getActor,
  getPublished, listPublished, listWorlds, login } from '@plotstay/domain';

const localeQuery = z.object({ locale: localeSchema.default('en') }).strict();
const listQuery = localeQuery.extend({ world: slugSchema.optional(), kind: kindSchema.optional(),
  q: z.string().trim().max(200).optional(), parentId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).max(100000).default(0) });
const idParams = z.object({ id: idSchema });
const SESSION = 'plotstay_session';

export async function createApp(db: Database, options: { logger?: boolean; webOrigin?: string; cookieSecure?: boolean } = {}) {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 64 * 1024 });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  const webOrigin = options.webOrigin ?? process.env.WEB_ORIGIN ?? 'http://localhost:4321';
  const cookieOptions = { path: '/api', httpOnly: true, sameSite: 'strict' as const,
    secure: options.cookieSecure ?? process.env.COOKIE_SECURE === 'true', maxAge: 12 * 60 * 60 };

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      assert(request.headers.origin === webOrigin, 403, 'ORIGIN_FORBIDDEN', 'Use the configured website origin.');
    }
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Invalid request.', details: error.issues } });
    if (error instanceof DomainError) return reply.code(error.status).send({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
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

  app.get('/api/health', async (_request, reply) => {
    try {
      // Readiness requires the schema as well as the connection.
      await db.query('SELECT code FROM locales LIMIT 1');
      return { status: 'ok' };
    } catch { return reply.code(503).send({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is not ready.' } }); }
  });
  app.get('/api/locales', async () => ({ locales: (await db.query('SELECT code,name FROM locales WHERE enabled ORDER BY code')).rows }));
  app.get('/api/worlds', async request => ({ worlds: await listWorlds(db, localeQuery.parse(request.query).locale) }));
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
  app.get('/api/admin/worlds', async request => ({ worlds: await adminWorlds(db, await actor(request.cookies[SESSION])) }));
  app.get('/api/admin/worlds/:worldId/contents', async request => {
    const user = await actor(request.cookies[SESSION]);
    const { worldId } = z.object({ worldId: idSchema }).parse(request.params);
    return { contents: await adminList(db, user, worldId) };
  });
  app.get('/api/admin/contents/:id', async request => {
    const user = await actor(request.cookies[SESSION]);
    return adminDetail(db, user, idParams.parse(request.params).id);
  });
  return app;
}
