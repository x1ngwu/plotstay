import type { FastifyInstance } from 'fastify';
import type { Database } from '@plotstay/database';
import { z } from 'zod';
import { idSchema } from '@plotstay/contracts';
import {
  saveOwnPersona,
  readPersonaNotes,
  savePersonaNotes,
  bindProvider,
  replyDetail,
  saveReply,
  replyAction,
  providerInbox,
  providerOptions,
  getActor,
  assert,
  myPersonas,
  savePersona,
  submitOwnPersona,
  personaQueue,
  myReviews,
  reviewDetail,
  startReview,
  saveReview,
  submitReview,
  moderationQueue,
  moderatePersona,
  createAccount,
  disablePersona,
} from '@plotstay/domain';
export function personaRoutes(app: FastifyInstance, db: Database) {
  const actor = async (req: any) => {
    const a = await getActor(db, req.cookies.plotstay_session);
    assert(a, 401, 'SESSION_REQUIRED', 'Sign in to continue.');
    return a;
  };
  const id = (req: any) => z.object({ id: idSchema }).parse(req.params).id;
  const page = (req: any) =>
    z
      .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
      .strict()
      .parse(req.query).page;
  app.get('/api/me/personas', async (r) => ({ personas: await myPersonas(db, await actor(r)) }));
  app.post('/api/me/personas/save',async r=>saveOwnPersona(db,await actor(r),r.body));
  app.get('/api/me/personas/:id/notes',async r=>readPersonaNotes(db,await actor(r),id(r)));
  app.put('/api/me/personas/:id/notes',async r=>savePersonaNotes(db,await actor(r),id(r),r.body));
  app.post('/api/me/personas', async (r) =>
    savePersona(db, await actor(r), z.object({ profiles: z.unknown() }).strict().parse(r.body).profiles),
  );
  app.put('/api/me/personas/:id', async (r) => {
    const b = z.object({ profiles: z.unknown(), baseRevisionId: idSchema }).strict().parse(r.body);
    return savePersona(db, await actor(r), b.profiles, id(r), b.baseRevisionId);
  });
  app.post('/api/me/personas/:id/submit', async r => {
    const b = z.object({revisionId: idSchema}).strict().parse(r.body);
    return submitOwnPersona(db, await actor(r), id(r), b.revisionId);
  });
  app.get('/api/moderation/personas/:id',async r=>{const a=await actor(r);assert(a.siteRole==='admin',403,'SITE_ADMIN_REQUIRED','A site administrator reviews profiles.');const revision=id(r);const row=(await db.query(`SELECT r.id,r.body,r.created_at,(s.submitted_revision_id=r.id AND d.revision_id IS NULL) AS current FROM detail_setting_revisions r JOIN detail_settings s ON s.id=r.setting_id LEFT JOIN persona_revision_decisions d ON d.revision_id=r.id WHERE s.kind='persona' AND r.id=$1`,[revision])).rows[0];assert(row,404,'NOT_FOUND','Profile not found.');return row;});
  app.get('/api/moderation/personas', async r => personaQueue(db, await actor(r), page(r)));
  app.get('/api/me/reviews', async (r) => myReviews(db, await actor(r), page(r)));
  app.post('/api/me/reviews', async (r) => {
    const b = z.object({ parentId: idSchema, personaId: idSchema }).strict().parse(r.body);
    return startReview(db, await actor(r), b.parentId, b.personaId);
  });
  app.get('/api/me/reviews/:id', async (r) => reviewDetail(db, await actor(r), id(r)));
  app.put('/api/me/reviews/:id', async (r) => {
    const b = z.object({ baseRevisionId: idSchema, body: z.unknown() }).strict().parse(r.body);
    return saveReview(db, await actor(r), id(r), b.baseRevisionId, b.body);
  });
  app.post('/api/me/reviews/:id/submit', async (r) =>
    submitReview(
      db,
      await actor(r),
      id(r),
      z.object({ revisionId: idSchema }).strict().parse(r.body).revisionId,
    ),
  );
  app.get('/api/moderation/reviews', async (r) => moderationQueue(db, await actor(r), page(r)));
  app.get('/api/moderation/reviews/:id', async (r) => reviewDetail(db, await actor(r), id(r), true));
  app.post('/api/moderation/personas/:id', async (r) => {
    const b = z
      .object({ decision: z.enum(['approved', 'rejected']), note: z.string().max(2000).default('') })
      .strict()
      .parse(r.body);
    await moderatePersona(db, await actor(r), id(r), b.decision, b.note);
    return { saved: true };
  });
  app.post('/api/moderation/personas/:id/availability', async (r) =>
    disablePersona(
      db,
      await actor(r),
      id(r),
      z.object({ disabled: z.boolean() }).strict().parse(r.body).disabled,
    ),
  );
  app.get('/api/me/provider-reviews', async (r) => providerInbox(db, await actor(r), page(r)));
  app.get('/api/me/replies/:id', async (r) => replyDetail(db, await actor(r), id(r)));
  app.put('/api/me/replies/:id', async (r) => {
    const b = z.object({ baseRevisionId: idSchema.nullable(), body: z.unknown() }).strict().parse(r.body);
    return saveReply(db, await actor(r), id(r), b.body, b.baseRevisionId);
  });
  app.post('/api/me/replies/:id/submit', async (r) =>
    replyAction(
      db,
      await actor(r),
      id(r),
      'submit',
      z.object({ revisionId: idSchema }).strict().parse(r.body).revisionId,
    ),
  );
  app.get('/api/moderation/replies/:id', async (r) => replyDetail(db, await actor(r), id(r), true));
  app.post('/api/moderation/replies/:id', async (r) => {
    const b = z
      .object({
        action: z.enum(['publish', 'reject', 'hide', 'restore']),
        revisionId: idSchema,
        note: z.string().max(2000).default(''),
        publicationId: idSchema.optional(),
      })
      .strict()
      .parse(r.body);
    return replyAction(db, await actor(r), id(r), b.action, b.revisionId, b.note, b.publicationId);
  });
  app.get('/api/moderation/providers/:id', async (r) => providerOptions(db, await actor(r), id(r)));
  app.put('/api/moderation/providers/:id', async (r) =>
    bindProvider(
      db,
      await actor(r),
      id(r),
      z.object({ personaId: idSchema }).strict().parse(r.body).personaId,
    ),
  );
  app.post('/api/admin/accounts', async (r) => createAccount(db, await actor(r), r.body));
}
