import { ApiError } from "@/server/lib/error"
import { WorkspaceDAO } from "@/server/modules/workspace/workspace.dao"
import { TeamsDAO } from "./teams.dao"

// Default statuses matching Linear's defaults
const DEFAULT_STATUSES = [
  { name: "Backlog", color: "#95a5a6", category: "backlog", position: 0, isDefault: true },
  { name: "Todo", color: "#3498db", category: "unstarted", position: 1, isDefault: false },
  { name: "In Progress", color: "#f39c12", category: "started", position: 2, isDefault: false },
  { name: "In Review", color: "#9b59b6", category: "started", position: 3, isDefault: false },
  { name: "Done", color: "#2ecc71", category: "completed", position: 4, isDefault: false },
  { name: "Cancelled", color: "#e74c3c", category: "cancelled", position: 5, isDefault: false },
]

export class TeamsService {
  private teamsDAO: TeamsDAO
  private workspaceDAO: WorkspaceDAO

  constructor() {
    this.teamsDAO = new TeamsDAO()
    this.workspaceDAO = new WorkspaceDAO()
  }

  async createTeam(
    params: {
      workspaceId: string
      name: string
      identifier: string
      description?: string | null
      color?: string | null
    },
    requestingUserId: string
  ) {
    const membership = await this.workspaceDAO.getMembership({
      workspaceId: params.workspaceId,
      userId: requestingUserId,
    })
    if (!membership) throw ApiError.Forbidden("You are not a member of this workspace")

    const team = await this.teamsDAO.createTeam(params)
    if (!team) throw ApiError.InternalServerError("Failed to create team")

    // Add creator as team owner
    await this.teamsDAO.addTeamMember({
      teamId: team.id,
      userId: requestingUserId,
      role: "owner",
    })

    // Create default workflow statuses
    await this.createDefaultWorkflowStatuses(team.id)

    return team
  }

  async getUserTeams(workspaceId: string, userId: string) {
    const membership = await this.workspaceDAO.getMembership({
      workspaceId,
      userId,
    })
    if (!membership) throw ApiError.Forbidden("You are not a member of this workspace")

    return await this.teamsDAO.getTeamsByWorkspaceId(workspaceId)
  }

  async getTeam(teamId: string, requestingUserId: string) {
    const team = await this.teamsDAO.getTeamById(teamId)
    if (!team) throw ApiError.NotFound("Team not found")

    const membership = await this.workspaceDAO.getMembership({
      workspaceId: team.workspace_id,
      userId: requestingUserId,
    })
    if (!membership) throw ApiError.Forbidden("You are not a member of this workspace")

    return team
  }

  async updateTeam(
    teamId: string,
    updates: {
      name?: string
      identifier?: string
      description?: string | null
      icon?: string | null
      color?: string | null
      timezone?: string | null
      is_private?: boolean
    },
    requestingUserId: string
  ) {
    const team = await this.teamsDAO.getTeamById(teamId)
    if (!team) throw ApiError.NotFound("Team not found")

    const teamMembership = await this.teamsDAO.getTeamMembership({
      teamId,
      userId: requestingUserId,
    })
    const workspaceMembership = await this.workspaceDAO.getMembership({
      workspaceId: team.workspace_id,
      userId: requestingUserId,
    })

    const isTeamOwnerOrAdmin =
      teamMembership?.role === "owner" || teamMembership?.role === "admin"
    const isWorkspaceOwnerOrAdmin =
      workspaceMembership?.role === "owner" || workspaceMembership?.role === "admin"

    if (!isTeamOwnerOrAdmin && !isWorkspaceOwnerOrAdmin) {
      throw ApiError.Forbidden("Only team owners/admins or workspace admins can update team settings")
    }

    const updated = await this.teamsDAO.updateTeam(teamId, updates)
    if (!updated) throw ApiError.NotFound("Team not found")

    return updated
  }

  async deleteTeam(teamId: string, requestingUserId: string) {
    const team = await this.teamsDAO.getTeamById(teamId)
    if (!team) throw ApiError.NotFound("Team not found")

    const workspaceMembership = await this.workspaceDAO.getMembership({
      workspaceId: team.workspace_id,
      userId: requestingUserId,
    })
    if (!workspaceMembership) throw ApiError.Forbidden("You are not a member of this workspace")
    if (workspaceMembership.role !== "owner" && workspaceMembership.role !== "admin") {
      throw ApiError.Forbidden("Only workspace owners and admins can delete teams")
    }

    await this.teamsDAO.deleteTeam(teamId)
    return { success: true }
  }

  async createDefaultWorkflowStatuses(teamId: string) {
    const statuses = await Promise.all(
      DEFAULT_STATUSES.map((status) =>
        this.teamsDAO.createWorkflowStatus({
          teamId,
          name: status.name,
          color: status.color,
          category: status.category,
          position: status.position,
          isDefault: status.isDefault,
        })
      )
    )
    return statuses
  }
}
