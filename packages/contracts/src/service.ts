import { z } from 'zod';
import { stayIconSchema } from './stay.ts';
import { experienceAttributesSchema } from './experience.ts';
const short = z.string().trim().max(500).default('');
const prose = z.string().trim().max(6000).default('');
export const serviceTextSchema = z.object({
  introduction: prose, providerRole: short, venueName: short, venueAddress: short,
  offeringTitle: short, offeringDescription: prose, offeringImageId: short,
  customization: prose, cancellationBadge: short,
  qualifications: z.array(z.object({ icon: stayIconSchema.default('star'), title: short, description: prose }).strict()).max(12).default([]),
  contactNote: prose, locationNote: prose, directions: prose,
  guestRequirements: prose, accessibility: prose, cancellation: prose,
}).strict();
export const serviceAttributesSchema = z.object({
  demo: z.boolean().default(false),
  sessions: experienceAttributesSchema.shape.sessions,
}).strict();
export type ServiceText = z.infer<typeof serviceTextSchema>;
