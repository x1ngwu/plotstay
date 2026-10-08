import { z } from 'zod';
import { stayIconSchema } from './stay.ts';
const short = z.string().trim().max(500).default('');
const prose = z.string().trim().max(6000).default('');
export const experienceTextSchema = z.object({
  introduction: prose, privateGroups: short, cancellationBadge: short,
  hostRole: short, language: short, expertiseTitle: short, expertiseDescription: prose,
  originalTitle: short, originalDescription: prose, whatToDo: prose,
  steps: z.array(z.object({ title: short, description: prose, imageId: short, icon: stayIconSchema.default('walk') }).strict()).max(30).default([]),
  meetingTitle: short, meetingAddress: short, meetingNote: prose, directions: prose,
  hostIntroduction: prose, contactNote: prose,
  guestRequirements: prose, activityLevel: prose, bring: prose, accessibility: prose,
  cancellation: prose, screening: prose,
}).strict();
export type ExperienceText = z.infer<typeof experienceTextSchema>;
export const experienceAttributesSchema = z.object({
  demo: z.boolean().default(false),
  opensAt: z.iso.datetime({offset:true}).optional(),
  sessions: z.array(z.object({startsAt:z.iso.datetime({offset:true}),endsAt:z.iso.datetime({offset:true})}).strict()
    .refine(s=>Date.parse(s.endsAt)>Date.parse(s.startsAt),'Session must end after it starts.')).max(30).default([]),
}).strict();
