import { ApiError } from "@/server/lib/error"
import { WorkspaceDAO } from "@/server/modules/workspace/workspace.dao"
import { TeamsDAO } from "@/server/modules/teams/teams.dao"
import { IssuesDAO } from "./issues.dao"

export class IssuesService {
  private issuesDAO: IssuesDAO
  private teamsDAO: TeamsDAO
  private workspaceDAO: WorkspaceDAO

  constructor() {
    this.issuesDAO = new IssuesDAO()
    this.teamsDAO = new TeamsDAO()
    this.workspaceDAO = new WorkspaceDAO()
  }

  private async assertWorkspaceMember(workspaceId: string, userId: string) {
    const membership = await this.workspaceDAO.getMembership({
      workspaceId,
      userId,
    })
    if (!membership) throw ApiError.Forbidden("You are not a member of this workspace")
    return membership
  }

  async createIssue(
    params: {
      teamId: string
      title: string
      description?: string | null
      statusId: string
      priority?: number
      assigneeId?: string | null
      projectId?: string | null
    },
    creatorId: string
  ) {
    const team = await this.teamsDAO.getTeamById(params.teamId)
    if (!team) throw ApiError.NotFound("Team not found")

    await this.assertWorkspaceMember(team.workspace_id, creatorId)

    const number = await this.issuesDAO.getNextIssueNumber(params.teamId)

    // Use fractional indexing — place at end with large sort_order
    const sortOrder = Date.now()

    const issue = await this.issuesDAO.createIssue({
      teamId: params.teamId,
      title: params.title,
      description: params.description,
      statusId: params.statusId,
      priority: params.priority,
      assigneeId: params.assigneeId,
      creatorId,
      projectId: params.projectId,
      sortOrder,
      number,
    })

    if (!issue) throw ApiError.InternalServerError("Failed to create issue")

    return issue
  }

  async getTeamIssues(
    teamId: string,
    requestingUserId: string,
    filters?: { statusId?: string; assigneeId?: string; priority?: number }
  ) {
    const team = await this.teamsDAO.getTeamById(teamId)
    if (!team) throw ApiError.NotFound("Team not found")

    await this.assertWorkspaceMember(team.workspace_id, requestingUserId)

    return await this.issuesDAO.getIssuesByTeamId(teamId, filters)
  }

  async getIssue(issueId: string, requestingUserId: string) {
    const issue = await this.issuesDAO.getIssueById(issueId)
    if (!issue) throw ApiError.NotFound("Issue not found")

    const team = await this.teamsDAO.getTeamById(issue.team_id)
    if (!team) throw ApiError.NotFound("Team not found")

    await this.assertWorkspaceMember(team.workspace_id, requestingUserId)

    return issue
  }

  async updateIssue(
    issueId: string,
    updates: {
      title?: string
      description?: string | null
      description_html?: string | null
      status_id?: string
      priority?: number
      assignee_id?: string | null
      project_id?: string | null
      cycle_id?: string | null
      parent_issue_id?: string | null
      estimate?: number | null
      due_date?: Date | null
      sort_order?: number
      is_triaged?: boolean
      snoozed_until?: Date | null
    },
    requestingUserId: string
  ) {
    const issue = await this.issuesDAO.getIssueById(issueId)
    if (!issue) throw ApiError.NotFound("Issue not found")

    const team = await this.teamsDAO.getTeamById(issue.team_id)
    if (!team) throw ApiError.NotFound("Team not found")

    await this.assertWorkspaceMember(team.workspace_id, requestingUserId)

    const updated = await this.issuesDAO.updateIssue(issueId, updates)
    if (!updated) throw ApiError.NotFound("Issue not found")

    return updated
  }

  async deleteIssue(issueId: string, requestingUserId: string) {
    const issue = await this.issuesDAO.getIssueById(issueId)
    if (!issue) throw ApiError.NotFound("Issue not found")

    const team = await this.teamsDAO.getTeamById(issue.team_id)
    if (!team) throw ApiError.NotFound("Team not found")

    await this.assertWorkspaceMember(team.workspace_id, requestingUserId)

    await this.issuesDAO.deleteIssue(issueId)
    return { success: true }
  }
}
