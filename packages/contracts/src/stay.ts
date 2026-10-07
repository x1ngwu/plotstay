import { z } from 'zod';

const short = z.string().trim().max(500).default('');
const prose = z.string().trim().max(6000).default('');
export const stayIconSchema = z.enum(['key','space','bath','wifi','desk','tv','lift','washer','dryer','air','hair','kitchen','alarm','bed','towel','cup','lock','window','light','book','clock','bag','transit','food','walk','star']);
const feature = z.object({ icon: stayIconSchema.default('star'), title: short, description: prose }).strict();
export const stayTextSchema = z.object({
  propertyType: short, bathroom: short, introduction: prose, space: prose, registration: prose,
  sleeping: z.array(z.object({name:short,description:short}).strict()).max(20).default([]),
  favoriteTitle: short, favoriteDescription: prose,
  highlights: z.array(feature).max(12).default([]),
  amenities: z.array(z.object({ icon: stayIconSchema.default('star'), name: short,
    category: short, status: z.enum(['available','unavailable','unreported']).default('available'), description: short }).strict()).max(100).default([]),
  hostBadge: short, hostIntroduction: prose, hostBadgeDescription: prose, responseTime: short, contactNote: prose,
  neighborhood: prose, locationNote: short,
  nearby: z.array(z.object({ kind: z.enum(['activities','cafe','transit','dining']), title: short, description: prose }).strict()).max(4).default([]),
  cancellation: prose, cancellationDetails: prose, checkIn: short, checkOut: short,
  houseRules: z.array(short).max(30).default([]), safety: z.array(feature).max(30).default([]),
}).strict();
export type StayText = z.infer<typeof stayTextSchema>;
export const stayAttributesSchema = z.object({
  demo: z.boolean().default(false), guests: z.number().int().min(1).max(99).optional(),
  bedrooms: z.number().int().min(0).max(100).optional(), beds: z.number().int().min(1).max(100).optional(),
  bathrooms: z.number().min(0).max(100).multipleOf(.5).optional(),
  hostYears: z.number().int().min(0).max(5000).optional(), hostReviewCount: z.number().int().min(0).max(1000000).optional(),
  hostRating: z.number().min(1).max(5).optional(), responseRate: z.number().int().min(0).max(100).optional(),
}).strict();
export type StayAttributes = z.infer<typeof stayAttributesSchema>;
export const reviewTextSchema = z.object({ name: short, origin: short, stayDuration: short }).strict();
export const reviewRatingKeys = ['cleanliness','accuracy','checkIn','communication','location','value'] as const;
export type ReviewRatingKey = typeof reviewRatingKeys[number];
const score = z.number().int().min(1).max(5).optional();
export const reviewRatingsSchema = z.object({cleanliness:score,accuracy:score,checkIn:score,communication:score,location:score,value:score}).strict();
