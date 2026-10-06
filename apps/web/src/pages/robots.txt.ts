import type { APIRoute } from 'astro';
import { siteConfig } from '../lib/seo';
export const GET: APIRoute = () => {
  const site = siteConfig();
  return new Response('User-agent: *\nAllow: /\n' + (site.indexable ? `Sitemap: ${site.origin}/sitemap.xml\n` : ''),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
