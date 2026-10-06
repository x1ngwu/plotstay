import type { Discovery, Locale, PublicContent, World } from '@plotstay/contracts';

export class ApiFailure extends Error {
  constructor(public status: number) { super(`API returned ${status}`); }
}
// Only called on the server. No database imports or credentials enter Web code.
export async function api<T>(path: string, query: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4310');
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' }); }
  catch { throw new ApiFailure(503); }
  if (!response.ok) throw new ApiFailure(response.status);
  return response.json() as Promise<T>;
}
export const getLocales = () => api<{ locales: Locale[] }>('/api/locales');
export const getDiscovery = () => api<Discovery>('/api/discovery');
export const getWorlds = (locale: string) => api<{ worlds: World[] }>('/api/worlds', { locale });
export const getContents = (locale: string, filters: Record<string, string>) => api<{ contents: PublicContent[] }>('/api/contents', { locale, ...filters });
export const getContent = (locale: string, world: string, kind: string, slug: string) => api<{ content: PublicContent }>(
  `/api/worlds/${encodeURIComponent(world)}/${encodeURIComponent(kind)}/${encodeURIComponent(slug)}`, { locale });
