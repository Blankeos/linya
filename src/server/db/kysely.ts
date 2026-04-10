import { Kysely, PostgresDialect } from "kysely"
import pg from "pg"
import { privateEnv } from "@/env.private"
import type { DB } from "./types"

const pool = new pg.Pool({
  connectionString: privateEnv.DATABASE_URL,
})

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool }),
})
