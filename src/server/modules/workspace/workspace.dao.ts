import { db } from "@/server/db/kysely"
import { generateId } from "@/server/modules/auth/auth.utilities"

export class WorkspaceDAO {
  // ===========================================================================
  // Workspaces
  // ===========================================================================
  async createWorkspace(params: { name: string; slug: string; ownerId: string }) {
    return await db.transaction().execute(async (trx) => {
      const workspace = await trx
        .insertInto("workspace")
        .values({
          id: generateId(),
          name: params.name,
          slug: params.slug,
          owner_id: params.ownerId,
        })
        .returningAll()
        .executeTakeFirst()

      if (!workspace) throw new Error("Failed to create workspace")

      await trx
        .insertInto("workspace_member")
        .values({
          id: generateId(),
          workspace_id: workspace.id,
          user_id: params.ownerId,
          role: "owner",
        })
        .execute()

      return workspace
    })
  }

  async getWorkspaceById(id: string) {
    return await db
      .selectFrom("workspace")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async getWorkspaceBySlug(slug: string) {
    return await db
      .selectFrom("workspace")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirst()
  }

  async getWorkspacesByUserId(userId: string) {
    return await db
      .selectFrom("workspace")
      .innerJoin("workspace_member", "workspace_member.workspace_id", "workspace.id")
      .where("workspace_member.user_id", "=", userId)
      .selectAll("workspace")
      .select("workspace_member.role")
      .orderBy("workspace.created_at", "asc")
      .execute()
  }

  async updateWorkspace(id: string, updates: { name?: string; slug?: string; icon_url?: string | null }) {
    return await db
      .updateTable("workspace")
      .set({ ...updates, updated_at: new Date() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async deleteWorkspace(id: string) {
    await db.deleteFrom("workspace").where("id", "=", id).execute()
  }

  // ===========================================================================
  // Members
  // ===========================================================================
  async addMember(params: { workspaceId: string; userId: string; role: string }) {
    return await db
      .insertInto("workspace_member")
      .values({
        id: generateId(),
        workspace_id: params.workspaceId,
        user_id: params.userId,
        role: params.role,
      })
      .onConflict((oc) =>
        oc.columns(["workspace_id", "user_id"]).doUpdateSet({ role: params.role })
      )
      .returningAll()
      .executeTakeFirst()
  }

  async removeMember(params: { workspaceId: string; userId: string }) {
    await db
      .deleteFrom("workspace_member")
      .where("workspace_id", "=", params.workspaceId)
      .where("user_id", "=", params.userId)
      .execute()
  }

  async getMembersByWorkspaceId(workspaceId: string) {
    return await db
      .selectFrom("workspace_member")
      .innerJoin("user", "user.id", "workspace_member.user_id")
      .where("workspace_member.workspace_id", "=", workspaceId)
      .select([
        "workspace_member.id",
        "workspace_member.user_id",
        "workspace_member.role",
        "workspace_member.created_at",
        "user.email",
        "user.display_name",
        "user.avatar_url",
      ])
      .orderBy("workspace_member.created_at", "asc")
      .execute()
  }

  async getMembership(params: { workspaceId: string; userId: string }) {
    return await db
      .selectFrom("workspace_member")
      .selectAll()
      .where("workspace_id", "=", params.workspaceId)
      .where("user_id", "=", params.userId)
      .executeTakeFirst()
  }
}
