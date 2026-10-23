import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const ROOT = join(__dirname, "..", "..");
const MIGRATIONS = join(ROOT, "supabase", "migrations");

/** Fresh in-memory database with the stub + every migration applied. */
export async function createTestDb() {
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  await db.exec(readFileSync(join(__dirname, "supabase-stub.sql"), "utf8"));
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Insert an auth user (the profile is created by the trigger). */
export async function createUser(db: TestDb, email: string) {
  const id = randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  return id;
}

/**
 * Run `fn` as an authenticated user: role `authenticated` (so RLS applies)
 * and auth.uid() returning `userId`. Rolled back afterwards unless `commit`.
 */
export async function asUser<T>(
  db: TestDb,
  userId: string,
  fn: (tx: Transaction) => Promise<T>,
  { commit = true }: { commit?: boolean } = {},
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await tx.exec("set local role authenticated");
    const result = await fn(tx);
    if (!commit) await tx.rollback();
    return result;
  });
}

export async function rows<T = Record<string, unknown>>(
  tx: Transaction | TestDb,
  sql: string,
  params: unknown[] = [],
) {
  const res = await tx.query<T>(sql, params);
  return res.rows;
}
