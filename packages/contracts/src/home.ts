import { z } from 'zod';
import { idSchema, imageSchema, localeSchema, slugSchema } from './base.ts';
const short = z.string().trim().min(1).max(180);
export const homeTargetSchema = z.object({
  page: z.enum(['results','help','host']).default('results'),
  type: z.enum(['all','stays','experiences','services']).default('all'), place: slugSchema.optional(), category: slugSchema.optional(),
}).strict();
const actionText = z.object({ title: short, body: z.string().trim().max(1000), button: short }).strict();
const homeText = z.object({
  eyebrow: short, title: short, intro: z.string().trim().max(1000), backgroundAlt: z.string().max(500),
  promotion: actionText.extend({ audience: z.string().max(100).default('') }).optional(),
  categoryNames: z.record(slugSchema, short), sectionTitles: z.record(slugSchema, short),
  benefits: z.array(actionText).length(3),
}).strict();
export const homeConfigSchema = z.object({
  sourceLocale: localeSchema, translations: z.record(localeSchema, homeText), background: imageSchema.optional(),
  promotion: z.object({ enabled: z.boolean(), target: homeTargetSchema, image: imageSchema.optional(),
    startsAt: z.iso.datetime({ offset: true }).optional(), endsAt: z.iso.datetime({ offset: true }).optional(), timezone: z.literal('UTC').default('UTC'),
  }).strict().optional(),
  categories: z.array(z.object({ slug: slugSchema, kind: z.enum(['stay','experience','service']), icon: z.enum(['orbit','walk','signal','tool','home','star']) }).strict()).max(30),
  sections: z.array(z.object({ id: slugSchema, type: z.enum(['stays','experiences','services']), place: slugSchema.optional(), category: slugSchema.optional(),
    limit: z.number().int().min(1).max(12).default(6), recommendedIds: z.array(idSchema).max(12).default([]) }).strict()).max(6),
  placeRows: z.number().int().min(0).max(6).default(3), placeOrder: z.array(slugSchema).max(20).default([]),
  benefits: z.array(z.object({ icon: z.enum(['orbit','walk','signal','tool','home','star']), target: homeTargetSchema }).strict()).length(3),
}).strict().superRefine((c, ctx) => {
  if (!c.translations[c.sourceLocale]) ctx.addIssue({ code: 'custom', message: 'Source text is required.' });
  for (const key of ['categories','sections'] as const) {
    const ids = c[key].map(v => 'slug' in v ? v.slug : v.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Config identifiers must be unique.' });
  }
  if (c.promotion?.startsAt && c.promotion.endsAt && c.promotion.startsAt >= c.promotion.endsAt) ctx.addIssue({ code: 'custom', message: 'Promotion dates are invalid.' });
  for (const text of Object.values(c.translations)) {
    if (c.categories.some(v => !text.categoryNames[v.slug]) || c.sections.some(v => !text.sectionTitles[v.id]) || (c.promotion?.enabled && !text.promotion)) ctx.addIssue({ code: 'custom', message: 'Complete all configured labels.' });
  }
});
export type HomeConfig = z.infer<typeof homeConfigSchema>;
export interface PublicHome { config: Omit<HomeConfig, 'translations'>; text: HomeConfig['translations'][string]; locale: string; languageTag: string; availableLocales: string[]; isFallback: boolean }
