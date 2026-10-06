import { z } from 'zod';

export const localeSchema = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).max(35);
export const idSchema = z.uuid();
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
export const kindSchema = z.enum(['stay', 'experience', 'review']);
export type ContentKind = z.infer<typeof kindSchema>;

const lines = z.array(z.string().trim().min(1).max(1000)).max(60).default([]);
export const textSchema = z.object({
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().max(500).default(''),
  description: z.string().trim().min(1).max(20000),
  facilities: lines,
  rules: lines,
  itinerary: lines,
  hostName: z.string().trim().max(100).default(''),
  hostBio: z.string().trim().max(3000).default(''),
  imageAlts: z.record(z.string().max(80), z.string().max(500)).default({})
}).strict();
export type ContentText = z.infer<typeof textSchema>;

export const imageSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  url: z.string().max(2048).refine((value) => {
    if (/^\/media\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..')) return true;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
    catch { return false; }
  }, 'Use an HTTPS image URL or a local /media/ path.')
}).strict();

export const attributesSchema = z.object({
  images: z.array(imageSchema).max(20).default([]),
  price: z.object({ amount: z.number().int().min(0).max(1000000000), unit: z.enum(['night', 'person']) }).strict().optional(),
  durationMinutes: z.number().int().positive().max(43200).optional(),
  rating: z.number().int().min(1).max(5).optional()
}).strict().refine(a => new Set(a.images.map(i => i.id)).size === a.images.length, 'Image IDs must be unique.');
export type ContentAttributes = z.infer<typeof attributesSchema>;

const draftFields = {
  sourceLocale: localeSchema,
  text: textSchema,
  attributes: attributesSchema,
  translations: z.record(localeSchema, textSchema).default({})
};
export const createContentSchema = z.object({
  worldId: idSchema, placeId: idSchema.nullable().default(null),
  kind: kindSchema, slug: slugSchema,
  parentContentId: idSchema.nullable().default(null), personaId: idSchema.nullable().default(null),
  ...draftFields
}).strict();
export const editContentSchema = z.object({ baseRevisionId: idSchema, baseDraftToken: idSchema.optional(), ...draftFields }).strict();
export type CreateContentInput = z.infer<typeof createContentSchema>;
export type EditContentInput = z.infer<typeof editContentSchema>;
export const bookingSchema = z.object({ contentId: idSchema, locale: localeSchema,
  idempotencyKey: z.uuid(), personaId: idSchema.optional() }).strict();
export const loginSchema = z.object({ email: z.email().max(254), password: z.string().min(1).max(256) }).strict();
export const importSchema = z.object({
  worldId: idSchema, source: z.string().trim().min(1).max(100),
  items: z.array(z.object({ externalId: z.string().trim().min(1).max(160), content: z.unknown() }).strict()).min(1).max(100)
}).strict();

export const revisionActionSchema = z.object({ revisionId: idSchema }).strict();
export const reviewActionSchema = revisionActionSchema.extend({ decision: z.enum(['publish', 'reject']), note: z.string().trim().max(2000).default('') });
export const restoreActionSchema = z.object({ publicationId: idSchema }).strict();
export const unpublishActionSchema = z.object({ siteBlock: z.boolean().default(false), note: z.string().trim().max(2000).default('') }).strict();
export const noteActionSchema = z.object({ note: z.string().trim().max(2000).default('') }).strict();
export const translationActionSchema = z.object({ body: textSchema, baseTranslationId: idSchema.nullable() }).strict();

export interface Locale { code: string; name: string }
export interface World {
  id: string; slug: string; name: string; description: string; currencyName: string;
  themeId: string; locale: string; sourceLocale: string;
}
export interface PublicContent {
  id: string; worldId: string; worldSlug: string; slug: string; kind: ContentKind;
  placeName: string | null; locale: string; requestedLocale: string; isFallback: boolean;
  text: ContentText; attributes: ContentAttributes; publicationId: string; publishedAt: string;
  personaName: string | null;
}
export interface BookingReceipt {
  id: string; createdAt: string; locale: string;
  snapshot: { contentId: string; publicationId: string; kind: 'stay' | 'experience';
    title: string; worldName: string; worldSlug: string; currencyName: string;
    amount: number; unit: 'night' | 'person'; personaName: string | null };
}
export interface ApiError { error: { code: string; message: string; details?: unknown } }
