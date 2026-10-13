import { z } from 'zod';
import { idSchema } from './base.ts';
import { sharedPersonaSchema } from './settings.ts';
export const personaSaveSchema = z.object({
    personaId: idSchema.optional(), baseRevisionId: idSchema.nullable(),
    profiles: sharedPersonaSchema,
    action: z.enum(['draft', 'complete']), requestId: idSchema,
    expectedSubmittedRevisionId: idSchema.nullable(),
}).strict();
export const PERSONA_NOTES_LIMIT = 2000;
export const personaNotesSchema = z.object({
    body: z.string().refine(v => Array.from(v).length <= PERSONA_NOTES_LIMIT, 'Notes may contain at most 2000 characters.').refine(v => !v.includes('\0'), 'Null characters are not supported.'),
    baseVersion: idSchema.nullable(), requestId: idSchema,
}).strict();
export type PersonaSaveInput = z.infer<typeof personaSaveSchema>;
