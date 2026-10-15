import { defineMiddleware } from 'astro:middleware';
import { fallbackLocales, resolveLocale } from '@plotstay/contracts';
import { getLocales } from './lib/api';
import { siteConfig } from './lib/seo';

export const onRequest = defineMiddleware(async (context, next) => {
  let indexable = false;
  let response: Response;
  try { indexable = siteConfig().indexable; }
  catch (error) {
    console.error(error);
    return new Response('Invalid site configuration: SITE_INDEXABLE requires a valid HTTPS SITE_URL origin.',
      { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  }
  const prefix = context.url.pathname.split('/')[1] ?? '';
  context.locals.locales = [];
  if (prefix && !['api', 'sitemap.xml', 'robots.txt', '_astro'].includes(prefix)) {
    try { context.locals.locales = (await getLocales()).locales; }
    catch { context.locals.locales = fallbackLocales; context.locals.localeFailure = true; }
    context.locals.locale = resolveLocale(prefix, context.locals.locales);
  }
  const locale = context.locals.locale;
  // Leave API paths and writes alone. Resolve prefix and trailing slashes together.
  const normalized = locale ? '/' + locale.pathPrefix + context.url.pathname.slice(prefix.length + 1).replace(/\/+$/, '') : null;
  if (normalized && normalized !== context.url.pathname && ['GET', 'HEAD'].includes(context.request.method)) {
    response = context.redirect(normalized + context.url.search, 308);
  } else response = await next();
  // Only the outer Basic Auth gate may send a browser-facing 401. Cookie
  // session failures must not evict the browser's cached HTTP credentials.
  // Preserve the API error code/body so clients can still request sign-in.
  if (response.status === 401) {
    response = new Response(response.body, { status: 403, headers: response.headers });
    response.headers.delete('WWW-Authenticate');
  }
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  if (!indexable || response.status >= 400 || prefix === 'api') response.headers.set('X-Robots-Tag', 'noindex, follow');
  const workPrivate=context.url.pathname.startsWith('/api/me/works')||context.url.pathname.startsWith('/api/me/work-preview/')||(context.url.pathname.endsWith('/workspace')&&(['works','create'].includes(context.url.searchParams.get('view')??'')||context.url.searchParams.get('author')==='1'));
  if(workPrivate||context.url.pathname.startsWith('/api/admin/preview/')){response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');response.headers.set('Cache-Control','private, no-store');}
  return response;
});
