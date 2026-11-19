import "dotenv/config";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { usernameFor } from "../../src/auth/utils/username";

export { usernameFor };

// Phase 02 / K2 — deterministic username backfill (doc 07 §M2.1, plan §8).
// Dry-run is read-only; --apply writes only NULL usernames inside one transaction.
// No emails, passwords or connection details are ever printed.

const MAX_LENGTH = 30;
const VALID = /^[a-z0-9_]{3,30}$/;

type UserRow = {
  id: string;
  email: string;
  username: string | null;
  createdAt: Date;
};

/** Anonymized, stable identifier derived from email — no email is printed. */
function stableId(email: string): string {
  return `PF-${createHash("sha256").update(email, "utf8").digest("hex").slice(0, 12).toUpperCase()}`;
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== "--dry-run" && mode !== "--apply") {
    console.error("Usage: npx tsx prisma/scripts/backfill-username.ts --dry-run | --apply");
    process.exitCode = 1;
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const { rows } = await client.query<UserRow>(
      'SELECT id, email, username, "createdAt" FROM "User" ORDER BY "createdAt" ASC, id ASC',
    );

    const existingUsernames = new Set(
      rows.filter((r) => r.username !== null).map((r) => (r.username as string).toLowerCase()),
    );
    const used = new Set(existingUsernames);

    const proposals = rows
      .filter((r) => r.username === null)
      .map((r) => ({
        id: r.id,
        label: stableId(r.email),
        username: usernameFor(r.email, used),
      }));

    const problems: string[] = [];
    const seen = new Set<string>();
    for (const p of proposals) {
      const lower = p.username.toLowerCase();
      if (!VALID.test(p.username)) problems.push(`${p.label}: invalid format`);
      if (p.username.length > MAX_LENGTH) problems.push(`${p.label}: longer than ${MAX_LENGTH}`);
      if (seen.has(lower)) problems.push(`${p.label}: duplicate within this run`);
      if (existingUsernames.has(lower)) problems.push(`${p.label}: collides with an existing username`);
      seen.add(lower);
    }

    console.log(`=== Username backfill (${mode}) ===`);
    console.log(`Users total: ${rows.length}`);
    console.log(`Already populated (preserved): ${rows.length - proposals.length}`);
    console.log(`Need backfill: ${proposals.length}`);
    console.log("anonymized_id | proposed_username | length | suffix | valid");
    for (const p of proposals) {
      console.log(
        `${p.label} | ${p.username} | ${p.username.length} | ${
          /_\d+$/.test(p.username) ? "yes" : "no"
        } | ${VALID.test(p.username)}`,
      );
    }

    if (problems.length > 0) {
      for (const p of problems) console.error(`PROBLEM: ${p}`);
      process.exitCode = 1;
      return;
    }

    if (mode === "--dry-run") {
      console.log("DRY-RUN COMPLETE — no writes performed.");
      return;
    }

    await client.query("BEGIN");
    try {
      let updated = 0;
      for (const p of proposals) {
        const res = await client.query(
          'UPDATE "User" SET "username" = $1 WHERE "id" = $2 AND "username" IS NULL',
          [p.username, p.id],
        );
        updated += res.rowCount ?? 0;
      }

      const check = await client.query<{
        nulls: string;
        dups: string;
        maxlen: string;
        invalid: string;
      }>(`
        SELECT
          (SELECT count(*) FROM "User" WHERE username IS NULL)::text AS nulls,
          (SELECT count(*) FROM (
             SELECT lower(username) FROM "User" WHERE username IS NOT NULL
             GROUP BY 1 HAVING count(*) > 1
           ) d)::text AS dups,
          (SELECT coalesce(max(length(username)), 0) FROM "User")::text AS maxlen,
          (SELECT count(*) FROM "User" WHERE username !~ '^[a-z0-9_]{3,30}$')::text AS invalid;
      `);

      const v = check.rows[0];
      console.log(
        `Post-apply verification: null=${v.nulls}, case-insensitive_duplicates=${v.dups}, max_length=${v.maxlen}, invalid_format=${v.invalid}`,
      );
      if (
        Number(v.nulls) !== 0 ||
        Number(v.dups) !== 0 ||
        Number(v.maxlen) > MAX_LENGTH ||
        Number(v.invalid) !== 0
      ) {
        throw new Error("Post-apply verification failed — rolling back");
      }

      await client.query("COMMIT");
      console.log(`APPLY COMPLETE — ${updated} row(s) updated, transaction committed.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
