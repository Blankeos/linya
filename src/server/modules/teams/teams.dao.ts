import { db } from "@/server/db/kysely"
import { generateId } from "@/server/modules/auth/auth.utilities"

export class TeamsDAO {
  // ===========================================================================
  // Teams
  // ===========================================================================
  async createTeam(params: {
    workspaceId: string
    name: string
    identifier: string
    description?: string | null
    icon?: string | null
    color?: string | null
  }) {
    return await db
      .insertInto("team")
      .values({
        id: generateId(),
        workspace_id: params.workspaceId,
        name: params.name,
        identifier: params.identifier.toUpperCase(),
        description: params.description ?? null,
        icon: params.icon ?? null,
        color: params.color ?? null,
      })
      .returningAll()
      .executeTakeFirst()
  }

  async getTeamById(id: string) {
    return await db
      .selectFrom("team")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async getTeamsByWorkspaceId(workspaceId: string) {
    return await db
      .selectFrom("team")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .orderBy("created_at", "asc")
      .execute()
  }

  async updateTeam(
    id: string,
    updates: {
      name?: string
      identifier?: string
      description?: string | null
      icon?: string | null
      color?: string | null
      timezone?: string | null
      is_private?: boolean
    }
  ) {
    const sanitized = {
      ...updates,
      identifier: updates.identifier ? updates.identifier.toUpperCase() : undefined,
      updated_at: new Date(),
    }
    return await db
      .updateTable("team")
      .set(sanitized)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async deleteTeam(id: string) {
    await db.deleteFrom("team").where("id", "=", id).execute()
  }

  // ===========================================================================
  // Team Members
  // ===========================================================================
  async addTeamMember(params: { teamId: string; userId: string; role: string }) {
    return await db
      .insertInto("team_member")
      .values({
        id: generateId(),
        team_id: params.teamId,
        user_id: params.userId,
        role: params.role,
      })
      .onConflict((oc) =>
        oc.columns(["team_id", "user_id"]).doUpdateSet({ role: params.role })
      )
      .returningAll()
      .executeTakeFirst()
  }

  async removeTeamMember(params: { teamId: string; userId: string }) {
    await db
      .deleteFrom("team_member")
      .where("team_id", "=", params.teamId)
      .where("user_id", "=", params.userId)
      .execute()
  }

  async getTeamMembers(teamId: string) {
    return await db
      .selectFrom("team_member")
      .innerJoin("user", "user.id", "team_member.user_id")
      .where("team_member.team_id", "=", teamId)
      .select([
        "team_member.id",
        "team_member.user_id",
        "team_member.role",
        "team_member.created_at",
        "user.email",
        "user.display_name",
        "user.avatar_url",
      ])
      .orderBy("team_member.created_at", "asc")
      .execute()
  }

  async getTeamMembership(params: { teamId: string; userId: string }) {
    return await db
      .selectFrom("team_member")
      .selectAll()
      .where("team_id", "=", params.teamId)
      .where("user_id", "=", params.userId)
      .executeTakeFirst()
  }

  // ===========================================================================
  // Workflow Statuses
  // ===========================================================================
  async createWorkflowStatus(params: {
    teamId: string
    name: string
    color: string
    category: string
    position: number
    isDefault?: boolean
  }) {
    return await db
      .insertInto("workflow_status")
      .values({
        id: generateId(),
        team_id: params.teamId,
        name: params.name,
        color: params.color,
        category: params.category,
        position: params.position,
        is_default: params.isDefault ?? false,
      })
      .returningAll()
      .executeTakeFirst()
  }

  async getWorkflowStatusesByTeamId(teamId: string) {
    return await db
      .selectFrom("workflow_status")
      .selectAll()
      .where("team_id", "=", teamId)
      .orderBy("position", "asc")
      .execute()
  }

  async updateWorkflowStatus(
    id: string,
    updates: {
      name?: string
      color?: string
      category?: string
      position?: number
      is_default?: boolean
    }
  ) {
    return await db
      .updateTable("workflow_status")
      .set(updates)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async deleteWorkflowStatus(id: string) {
    await db.deleteFrom("workflow_status").where("id", "=", id).execute()
  }
}
