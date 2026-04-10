import { ApiError } from "@/server/lib/error"
import { WorkspaceDAO } from "@/server/modules/workspace/workspace.dao"
import { ViewsDAO } from "./views.dao"

export class ViewsService {
  private viewsDAO: ViewsDAO
  private workspaceDAO: WorkspaceDAO

  constructor() {
    this.viewsDAO = new ViewsDAO()
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

  async createView(
    params: {
      workspaceId: string
      teamId?: string | null
      name: string
      description?: string | null
      icon?: string | null
      type?: string
      filters?: Record<string, unknown>
      displayOptions?: Record<string, unknown>
      isShared?: boolean
    },
    creatorId: string
  ) {
    const workspace = await this.workspaceDAO.getWorkspaceById(params.workspaceId)
    if (!workspace) throw ApiError.NotFound("Workspace not found")

    await this.assertWorkspaceMember(params.workspaceId, creatorId)

    const view = await this.viewsDAO.createView({
      workspaceId: params.workspaceId,
      teamId: params.teamId,
      creatorId,
      name: params.name,
      description: params.description,
      icon: params.icon,
      type: params.type ?? "issue",
      filters: params.filters,
      displayOptions: params.displayOptions,
      isShared: params.isShared ?? true,
      sortOrder: Date.now(),
    })

    if (!view) throw ApiError.InternalServerError("Failed to create view")

    return view
  }

  async getWorkspaceViews(workspaceId: string, requestingUserId: string, type?: string) {
    const workspace = await this.workspaceDAO.getWorkspaceById(workspaceId)
    if (!workspace) throw ApiError.NotFound("Workspace not found")

    await this.assertWorkspaceMember(workspaceId, requestingUserId)

    return await this.viewsDAO.getViewsByWorkspaceId(workspaceId, type)
  }

  async getView(viewId: string, requestingUserId: string) {
    const view = await this.viewsDAO.getViewById(viewId)
    if (!view) throw ApiError.NotFound("View not found")

    await this.assertWorkspaceMember(view.workspace_id, requestingUserId)

    return view
  }

  async updateView(
    viewId: string,
    updates: {
      name?: string
      description?: string | null
      icon?: string | null
      filters?: Record<string, unknown>
      displayOptions?: Record<string, unknown>
      isShared?: boolean
      sortOrder?: number
    },
    requestingUserId: string
  ) {
    const view = await this.viewsDAO.getViewById(viewId)
    if (!view) throw ApiError.NotFound("View not found")

    await this.assertWorkspaceMember(view.workspace_id, requestingUserId)

    // Only the creator or workspace admins can update
    const membership = await this.workspaceDAO.getMembership({
      workspaceId: view.workspace_id,
      userId: requestingUserId,
    })

    if (view.creator_id !== requestingUserId && membership?.role !== "admin" && membership?.role !== "owner") {
      throw ApiError.Forbidden("You cannot update this view")
    }

    const updated = await this.viewsDAO.updateView(viewId, updates)
    if (!updated) throw ApiError.NotFound("View not found")

    return updated
  }

  async deleteView(viewId: string, requestingUserId: string) {
    const view = await this.viewsDAO.getViewById(viewId)
    if (!view) throw ApiError.NotFound("View not found")

    await this.assertWorkspaceMember(view.workspace_id, requestingUserId)

    // Only the creator or workspace admins can delete
    const membership = await this.workspaceDAO.getMembership({
      workspaceId: view.workspace_id,
      userId: requestingUserId,
    })

    if (view.creator_id !== requestingUserId && membership?.role !== "admin" && membership?.role !== "owner") {
      throw ApiError.Forbidden("You cannot delete this view")
    }

    await this.viewsDAO.deleteView(viewId)
    return { success: true }
  }
}
