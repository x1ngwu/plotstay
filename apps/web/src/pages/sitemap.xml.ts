import type { APIRoute } from 'astro';
import { getDiscovery } from '../lib/api';
import { siteConfig, sitemapUrls } from '../lib/seo';
const escapeXml = (value: string) => value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);
export const GET: APIRoute = async () => {
  try {
    const urls = siteConfig().indexable ? sitemapUrls(await getDiscovery()) : [];
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${escapeXml(url)}</loc></url>`).join('')}</urlset>`,
      { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  } catch {
    return new Response('Sitemap temporarily unavailable.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
};
