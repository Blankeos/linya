import { db } from "@/server/db/kysely"
import { generateId } from "@/server/modules/auth/auth.utilities"

export class ViewsDAO {
  async createView(params: {
    workspaceId: string
    teamId?: string | null
    creatorId: string
    name: string
    description?: string | null
    icon?: string | null
    type?: string
    filters?: Record<string, unknown>
    displayOptions?: Record<string, unknown>
    isShared?: boolean
    sortOrder?: number
  }) {
    return await db
      .insertInto("custom_view")
      .values({
        id: generateId(),
        workspace_id: params.workspaceId,
        team_id: params.teamId ?? null,
        creator_id: params.creatorId,
        name: params.name,
        description: params.description ?? null,
        icon: params.icon ?? null,
        type: params.type ?? "issue",
        filters: JSON.stringify(params.filters ?? {}),
        display_options: JSON.stringify(params.displayOptions ?? {}),
        is_shared: params.isShared ?? true,
        sort_order: params.sortOrder ?? Date.now(),
      })
      .returningAll()
      .executeTakeFirst()
  }

  async getViewById(id: string) {
    return await db
      .selectFrom("custom_view")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async getViewsByWorkspaceId(workspaceId: string, type?: string) {
    let query = db
      .selectFrom("custom_view")
      .selectAll()
      .where("workspace_id", "=", workspaceId)

    if (type) {
      query = query.where("type", "=", type)
    }

    return await query.orderBy("sort_order", "asc").execute()
  }

  async updateView(
    id: string,
    updates: {
      name?: string
      description?: string | null
      icon?: string | null
      filters?: Record<string, unknown>
      displayOptions?: Record<string, unknown>
      isShared?: boolean
      sortOrder?: number
    }
  ) {
    const data: Record<string, any> = {}

    if (updates.name !== undefined) data.name = updates.name
    if (updates.description !== undefined) data.description = updates.description
    if (updates.icon !== undefined) data.icon = updates.icon
    if (updates.filters !== undefined) data.filters = JSON.stringify(updates.filters)
    if (updates.displayOptions !== undefined) data.display_options = JSON.stringify(updates.displayOptions)
    if (updates.isShared !== undefined) data.is_shared = updates.isShared
    if (updates.sortOrder !== undefined) data.sort_order = updates.sortOrder

    data.updated_at = new Date()

    return await db
      .updateTable("custom_view")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async deleteView(id: string) {
    await db.deleteFrom("custom_view").where("id", "=", id).execute()
  }
}
