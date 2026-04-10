import { PowerSyncDatabase } from "@powersync/web"
import { AppSchema } from "./schema"

let db: PowerSyncDatabase | null = null

export async function getPowerSyncDb(): Promise<PowerSyncDatabase> {
  if (db) return db

  db = new PowerSyncDatabase({
    database: { dbFilename: "linya.db" },
    schema: AppSchema,
    flags: { disableSSRWarning: true },
  })

  await db.init()
  return db
}

export function resetPowerSyncDb(): void {
  db = null
}
