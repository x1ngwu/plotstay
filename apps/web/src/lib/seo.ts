import { contentPath, homePath, type ContentText, type Discovery, type Locale, type PublicContent, type World } from '@plotstay/contracts';
import { hasDictionary } from './i18n.ts';

export interface SiteConfig { indexable: boolean; origin?: string }
export function siteConfig(env: NodeJS.ProcessEnv = process.env): SiteConfig {
  const flag = env.SITE_INDEXABLE ?? 'false';
  if (!['true', 'false'].includes(flag)) throw new Error('SITE_INDEXABLE must be true or false.');
  if (flag === 'false') return { indexable: false };
  let url: URL;
  try { url = new URL(env.SITE_URL ?? ''); } catch { throw new Error('SITE_INDEXABLE=true requires SITE_URL to be a valid HTTPS origin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) {
    throw new Error('SITE_URL must be a public HTTPS origin without credentials, path, query or fragment.');
  }
  return { indexable: true, origin: url.origin };
}
export interface Seo { canonical?: string; alternates: { tag: string; url: string }[] }
export const noIndex = (): Seo => ({ alternates: [] });
export function contentDescription(text: Pick<ContentText, 'summary' | 'description'>): string {
  const summary = text.summary.trim();
  if (summary) return summary;
  const description = text.description.replace(/\s+/gu, ' ').trim();
  // This is our excerpt budget, not a search engine limit. Keep authored summaries intact.
  const characters = Array.from(description);
  if (characters.length <= 200) return description;
  const excerpt = characters.slice(0, 199).join('');
  const wordBoundary = excerpt.lastIndexOf(' ');
  return (wordBoundary >= 100 ? excerpt.slice(0, wordBoundary) : excerpt).trimEnd() + '…';
}
export function eligibleLocales(locales: Locale[], available: string[], worldAvailable = available) {
  return locales.filter(item => hasDictionary(item.code) && available.includes(item.code) && worldAvailable.includes(item.code));
}
function metadata(locale: Locale, variants: Locale[], path: (item: Locale) => string): Seo {
  const site = siteConfig();
  if (!site.indexable || !variants.some(item => item.code === locale.code)) return noIndex();
  const absolute = (item: Locale) => new URL(path(item), site.origin).href;
  const alternates = variants.map(item => ({ tag: item.languageTag, url: absolute(item) }));
  const english = variants.find(item => item.code === 'en');
  if (english) alternates.push({ tag: 'x-default', url: absolute(english) });
  return { canonical: absolute(locale), alternates };
}
export function homeSeo(url: URL, locale: Locale, locales: Locale[], world: World): Seo {
  if (url.searchParams.get('q')?.trim() || ['stays', 'experiences'].includes(url.searchParams.get('type') ?? '')) return noIndex();
  return metadata(locale, eligibleLocales(locales, world.listingLocales), item => homePath(item, world.slug));
}
export function detailSeo(locale: Locale, locales: Locale[], world: World, content: PublicContent): Seo {
  return metadata(locale, eligibleLocales(locales, content.availableLocales, world.availableLocales), item => contentPath(item, content));
}
export function sitemapUrls(data: Discovery): string[] {
  const site = siteConfig();
  if (!site.indexable) return [];
  const paths = data.worlds.flatMap(world => eligibleLocales(data.locales, world.listingLocales).map(locale => homePath(locale, world.slug)));
  for (const content of data.contents) {
    const world = data.worlds.find(item => item.slug === content.worldSlug);
    if (world) paths.push(...eligibleLocales(data.locales, content.availableLocales, world.availableLocales).map(locale => contentPath(locale, content)));
  }
  return [...new Set(paths)].map(path => new URL(path, site.origin).href);
}
