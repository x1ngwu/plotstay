import type { FastifyInstance } from "fastify";
import type { Database } from "@plotstay/database";
import { z } from "zod";
import { idSchema } from "@plotstay/contracts";
import { getActor, assert } from "@plotstay/domain";
import {
  reviewWorkspaceList,
  reviewWorkspaceDetail,
  reviewEntries,
} from "../../../packages/domain/src/review-workspace.ts";
import { saveReviewCommand } from "../../../packages/domain/src/review-commands.ts";
export function reviewWorkspaceRoutes(app: FastifyInstance, db: Database) {
  const actor = async (token?: string) => {
    const a = await getActor(db, token);
    assert(a, 401, "SESSION_REQUIRED", "Sign in to continue.");
    return a;
  };
  app.get("/api/me/review-workspace", async (r) => {
    const a = await actor(r.cookies.plotstay_session);
    return { ...(await reviewWorkspaceList(db, a, r.query)), actorId: a.id };
  });
  app.get("/api/me/review-workspace/entries", async (r) => {
    await actor(r.cookies.plotstay_session);
    return reviewEntries(db, r.query);
  });
  app.post("/api/me/review-workspace/save", async (r) =>
    saveReviewCommand(db, await actor(r.cookies.plotstay_session), r.body),
  );
  app.get("/api/me/review-workspace/:id", async (r) => {
    const a = await actor(r.cookies.plotstay_session),
      p = z.object({ id: idSchema }).parse(r.params);
    const q = z
      .object({
        view: z.enum(["reviews", "replies"]),
        locale: z.enum(["en", "zh-CN"]).default("en"),
        historyPage: z.coerce.number().int().min(1).max(100000).default(1),
        revision: idSchema.optional(),
      })
      .strict()
      .parse(r.query);
    return {
      ...(await reviewWorkspaceDetail(db, a, p.id, q.view, q.locale, {
        page: q.historyPage,
        revision: q.revision,
      })),
      actorId: a.id,
    };
  });
}
