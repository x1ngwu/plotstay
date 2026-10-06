import { z } from 'zod';
import { slugSchema, contentPath, type Locale, type PublicContent, type World } from './base.ts';
import type { PublicHome } from './home.ts';
export const PAGE_SIZE = 24;
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(value => value === '' || value === null ? undefined : value, schema.optional());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === s && s >= '1900-01-01';
});
const integer = (max: number) => z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(max));
export const browseSchema = z.object({
  world: slugSchema.default('lathe-worlds'), view: optional(z.literal('results')),
  type: z.enum(['all','stays','experiences','services']).default('all'),
  q: z.string().trim().max(200).default(''), place: optional(slugSchema), category: optional(slugSchema),
  page: integer(1000000).default(1), start: optional(date), end: optional(date),
  guests: optional(integer(99)), rooms: optional(integer(20)), quantity: optional(integer(99)),
  time: optional(z.enum(['morning','afternoon','evening'])),
}).superRefine((s, ctx) => {
  if (s.end && (!s.start || s.end <= s.start)) ctx.addIssue({ code: 'custom', path: ['end'], message: 'End date must follow start date.' });
  if (s.rooms && !['all','stays'].includes(s.type)) ctx.addIssue({ code: 'custom', path: ['rooms'], message: 'Rooms apply to homes.' });
  if ((s.quantity || s.time) && s.type !== 'services') ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Quantity and time apply to services.' });
  if (s.end && !['all','stays'].includes(s.type)) ctx.addIssue({ code: 'custom', path: ['end'], message: 'End date applies to homes.' });
});
export type BrowseState = z.infer<typeof browseSchema>;
export const browseKeys = ['world','view','type','q','place','category','page','start','end','guests','rooms','quantity','time'] as const;
export function parseBrowse(params: URLSearchParams): BrowseState {
  const raw: Record<string,string> = {};
  for (const key of browseKeys) {
    if (params.getAll(key).length > 1) throw new Error('Duplicate browse parameter.');
    const value = params.get(key); if (value !== null) raw[key] = value;
  }
  const state = browseSchema.parse(raw);
  if (state.type !== 'all' || state.q || state.place || state.category || state.page > 1) state.view = 'results';
  return state;
}
export function hasTrip(s: BrowseState) { return Boolean(s.start || s.end || s.guests || s.rooms || s.quantity || s.time); }
export function filtered(s: BrowseState) { return Boolean(s.q || s.type !== 'all' || s.place || s.category || hasTrip(s)); }
export function browsePath(locale: Locale, s: BrowseState, patch: Partial<BrowseState> = {}) {
  const state = { ...s, ...patch };
  const params = new URLSearchParams();
  for (const key of browseKeys) {
    const value = state[key];
    if (value === undefined || value === '' || (key === 'world' && value === 'lathe-worlds') || (key === 'page' && value === 1) || (key === 'type' && value === 'all')) continue;
    params.set(key, String(value));
  }
  return `/${locale.pathPrefix}` + (params.size ? '?' + params : '');
}
export function detailPath(locale: Locale, content: PublicContent, state: BrowseState) {
  const params = new URLSearchParams(browsePath(locale, state).split('?')[1]);
  // Only a role and whitelisted state cross the detail boundary. Never a return URL.
  params.set('from', state.view === 'results' ? 'results' : 'home');
  return contentPath(locale, content) + '?' + params;
}
export function detailReturn(params: URLSearchParams, world: string): BrowseState {
  const clean = new URLSearchParams(params);
  clean.set('world', world);
  const state = parseBrowse(clean);
  if (params.get('world') && params.get('world') !== world) return parseBrowse(new URLSearchParams({ world }));
  state.view = params.get('from') === 'results' ? 'results' : undefined;
  if (!state.view) { state.page = 1; state.q = ''; state.place = undefined; state.category = undefined; state.type = 'all'; state.quantity = undefined; state.time = undefined; }
  return state;
}
export interface PublicPlace { id: string; slug: string; name: string; stayCount: number }
export interface PublicCategory { slug: string; name: string; kind: 'stay' | 'experience' | 'service'; icon: string; count: number }
export interface ContentPage { contents: PublicContent[]; total: number; page: number; pageSize: number; pages: number }
export interface HomeSection { id: string; title: string; type: BrowseState['type']; place?: string; category?: string; contents: PublicContent[] }
export interface BrowseResponse { world: World; places: PublicPlace[]; categories: PublicCategory[]; home: PublicHome | null; listing: ContentPage; sections: HomeSection[] }
