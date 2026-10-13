import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createDatabase } from "@plotstay/database";
// Aggregates only. Never select credentials, private notes or emit business rows.
const db = createDatabase();
try {
  const tables = [
    "contents",
    "content_revisions",
    "translations",
    "revision_locales",
    "publications",
    "publication_locales",
    "moderation_events",
    "review_signatures",
    "review_replies",
    "reply_revisions",
    "reply_publications",
    "reply_events",
    "provider_bindings",
    "provider_binding_events",
  ];
  const report: any = {
    at: new Date().toISOString(),
    schema: (await db.query("SELECT current_schema() AS name")).rows[0].name,
    tables: {},
    migrations: (
      await db.query("SELECT name FROM schema_migrations ORDER BY name")
    ).rows.map((r) => r.name),
  };
  for (const table of tables) {
    const value =
      table === "contents"
        ? "to_jsonb(t)-'submitted_revision_id'-'submission_token'"
        : table === "review_replies"
          ? "to_jsonb(t)-'submitted_revision_id'"
          : "to_jsonb(t)";
    const row = (
      await db.query(
        `SELECT count(*)::int AS count,md5(coalesce(string_agg((${value})::text,'' ORDER BY (${value})::text),'')) AS digest FROM ${table} t`,
      )
    ).rows[0];
    report.tables[table] = row;
  }
  report.digest = createHash("sha256")
    .update(JSON.stringify(report.tables))
    .digest("hex");
  const target = process.argv[2];
  if (target)
    await writeFile(target, JSON.stringify(report, null, 2) + "\n", {
      mode: 0o600,
    });
  console.log(
    JSON.stringify({
      at: report.at,
      schema: report.schema,
      migrations: report.migrations,
      digest: report.digest,
      counts: Object.fromEntries(
        Object.entries(report.tables).map(([k, v]: any) => [k, v.count]),
      ),
      report: target ?? null,
    }),
  );
} catch (error: any) {
  console.error(
    JSON.stringify({
      error: "Migration audit failed",
      code: error.code ?? "AUDIT_FAILED",
    }),
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
