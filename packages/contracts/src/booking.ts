import { z } from 'zod';
import { idSchema, localeSchema, type PublicContent } from './base.ts';
export const bookingDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const date = new Date(s + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s;
});
export const tripSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stay'), start: bookingDate, end: bookingDate,
    guests: z.number().int().min(1).max(99), rooms: z.number().int().min(1).max(20) }).strict(),
  z.object({ kind: z.literal('experience'), startsAt: z.iso.datetime({ offset: true }),
    guests: z.number().int().min(1).max(99) }).strict(),
  z.object({ kind: z.literal('service'), startsAt: z.iso.datetime({ offset: true }),
    guests: z.number().int().min(1).max(99), quantity: z.number().int().min(1).max(99) }).strict(),
]);
export type BookingTrip = z.infer<typeof tripSchema>;
export const quoteSchema = z.object({ contentId: idSchema, locale: localeSchema, trip: tripSchema }).strict();
export const bookingSchema = quoteSchema.extend({ idempotencyKey: z.uuid(), quoteHash: z.string().regex(/^[a-f0-9]{64}$/) });
export type QuoteInput = z.infer<typeof quoteSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export interface BookingSnapshot {
  version: 1; contentId: string; publicationId: string; contentSlug: string;
  kind: 'stay' | 'experience' | 'service'; title: string; summary: string;
  worldId: string; worldName: string; worldSlug: string; placeId: string | null; placeName: string | null;
  location: string; currencyName: string; amount: number; unit: 'night' | 'person' | 'session';
  total: number; multiplier: number; nights: number | null; fees: 0;
  trip: BookingTrip; endsAt: string | null; timeZone: 'UTC'; sessionSource: 'published' | 'daily' | null;
  locale: string; contentLocale: string; languageTag: string; personaName: string;
  cancellation: string; issuedAt?: string;
}
export interface LegacyBookingSnapshot {
  version?: undefined; contentId: string; publicationId: string; kind: 'stay' | 'experience' | 'service';
  title: string; worldName: string; worldSlug: string; currencyName: string; amount: number;
  unit: 'night' | 'person' | 'session'; personaName: string | null;
}
export interface BookingReceipt { id: string; createdAt: string; locale: string; snapshot: BookingSnapshot | LegacyBookingSnapshot }
export interface BookingQuote { snapshot: BookingSnapshot; quoteHash: string }
export function publishedSessions(c: PublicContent) {
  return (c.kind === 'experience' ? c.attributes.experience?.sessions : c.attributes.service?.sessions) ?? [];
}
