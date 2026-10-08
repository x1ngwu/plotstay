import { z } from 'zod';
import { localeSchema, type PublicContent } from './base.ts';
import type { ContentPage } from './browse.ts';
import type { ReviewRatingKey } from './stay.ts';

export const detailQuerySchema = z.object({
  locale: localeSchema.default('en'),
  notesPage: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(1000000)).default(1),
}).strict();
export interface ContentDetail {
  previewSetting?: { kind: string; body: any; revisionId: string };
  content: PublicContent;
  reviews: ContentPage;
  related: PublicContent[];
  reviewSummary: { rating: number | null; ratedCount: number; mentions: { label: string; count: number }[];
    distribution: {rating:number;count:number}[]; dimensions: Partial<Record<ReviewRatingKey,{rating:number;count:number}>> };
}
