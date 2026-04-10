import type { AbstractPowerSyncDatabase, PowerSyncBackendConnector } from "@powersync/web"
import { UpdateType } from "@powersync/common"
import type { CrudEntry } from "@powersync/common"
import { publicEnv } from "@/env.public"
import { honoClient } from "@/lib/hono-client"

export class BackendConnector implements PowerSyncBackendConnector {
  private _accessToken: string | null = null
  private _userId: string | null = null

  updateAuth(userId: string | null, accessToken: string | null): void {
    this._userId = userId
    this._accessToken = accessToken
  }

  async fetchCredentials() {
    if (!this._accessToken || !this._userId) {
      return null
    }

    return {
      endpoint: publicEnv.PUBLIC_POWERSYNC_URL,
      // The access token IS the PowerSync token — same JWT, same secret,
      // audience is set to PUBLIC_POWERSYNC_URL in createAccessToken().
      token: this._accessToken,
    }
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const batch = await database.getCrudBatch(100)
    if (!batch) return

    try {
      for (const entry of batch.crud) {
        switch (entry.table) {
          case "issue":
            await this.uploadIssue(entry)
            break
          default:
            console.warn("[PowerSync] uploadData not implemented for table:", entry.table)
        }
      }
      await batch.complete()
    } catch (error) {
      console.error("[PowerSync] Upload error:", error)
      throw error
    }
  }

  private async uploadIssue(entry: CrudEntry): Promise<void> {
    const client = honoClient()
    switch (entry.op) {
      case UpdateType.PATCH:
      case UpdateType.PUT: {
        const { updated_at, created_at, id, team_id, number, ...fields } = entry.opData ?? {}
        await client.issues[":issueId"].$put({
          param: { issueId: entry.id },
          json: fields,
        })
        break
      }
      case UpdateType.DELETE:
        await client.issues[":issueId"].$delete({
          param: { issueId: entry.id },
        })
        break
    }
  }
}

let connector: BackendConnector | null = null

export function getBackendConnector(): BackendConnector {
  if (!connector) connector = new BackendConnector()
  return connector
}

export function resetBackendConnector(): void {
  connector = null
}
