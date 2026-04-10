import { ApiError } from "@/server/lib/error"
import { AuthDAO } from "@/server/modules/auth/auth.dao"
import { WorkspaceDAO } from "./workspace.dao"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

export class WorkspaceService {
  private workspaceDAO: WorkspaceDAO
  private authDAO: AuthDAO

  constructor() {
    this.workspaceDAO = new WorkspaceDAO()
    this.authDAO = new AuthDAO()
  }

  async createWorkspace(params: { name: string; slug?: string; ownerId: string }) {
    const slug = params.slug ?? slugify(params.name)

    if (!slug) throw ApiError.BadRequest("Workspace name produced an invalid slug.")

    const existing = await this.workspaceDAO.getWorkspaceBySlug(slug)
    if (existing) throw ApiError.Conflict(`Workspace slug "${slug}" is already taken.`)

    const workspace = await this.workspaceDAO.createWorkspace({
      name: params.name,
      slug,
      ownerId: params.ownerId,
    })

    if (!workspace) throw ApiError.InternalServerError("Failed to create workspace")

    return workspace
  }

  async getUserWorkspaces(userId: string) {
    return await this.workspaceDAO.getWorkspacesByUserId(userId)
  }

  async getWorkspace(id: string, requestingUserId: string) {
    const workspace = await this.workspaceDAO.getWorkspaceById(id)
    if (!workspace) throw ApiError.NotFound("Workspace not found")

    const membership = await this.workspaceDAO.getMembership({
      workspaceId: id,
      userId: requestingUserId,
    })
    if (!membership) throw ApiError.Forbidden("You are not a member of this workspace")

    return workspace
  }

  async updateWorkspace(
    id: string,
    updates: { name?: string; slug?: string; iconUrl?: string | null },
    requestingUserId: string
  ) {
    const membership = await this.workspaceDAO.getMembership({
      workspaceId: id,
      userId: requestingUserId,
    })
    if (!membership) throw ApiError.Forbidden("You are not a member of this workspace")
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw ApiError.Forbidden("Only workspace owners and admins can update workspace settings")
    }

    if (updates.slug) {
      const existing = await this.workspaceDAO.getWorkspaceBySlug(updates.slug)
      if (existing && existing.id !== id) {
        throw ApiError.Conflict(`Workspace slug "${updates.slug}" is already taken.`)
      }
    }

    const workspace = await this.workspaceDAO.updateWorkspace(id, {
      name: updates.name,
      slug: updates.slug,
      icon_url: updates.iconUrl,
    })

    if (!workspace) throw ApiError.NotFound("Workspace not found")

    return workspace
  }

  async inviteMember(
    workspaceId: string,
    email: string,
    role: string,
    inviterId: string
  ) {
    const inviterMembership = await this.workspaceDAO.getMembership({
      workspaceId,
      userId: inviterId,
    })
    if (!inviterMembership) throw ApiError.Forbidden("You are not a member of this workspace")
    if (inviterMembership.role !== "owner" && inviterMembership.role !== "admin") {
      throw ApiError.Forbidden("Only workspace owners and admins can invite members")
    }

    const workspace = await this.workspaceDAO.getWorkspaceById(workspaceId)
    if (!workspace) throw ApiError.NotFound("Workspace not found")

    const user = await this.authDAO.getOrCreateUserFromEmail(email)
    if (!user) throw ApiError.InternalServerError("Failed to find or create user")

    const member = await this.workspaceDAO.addMember({
      workspaceId,
      userId: user.id,
      role,
    })

    return member
  }

  async removeMember(workspaceId: string, targetUserId: string, requestingUserId: string) {
    const workspace = await this.workspaceDAO.getWorkspaceById(workspaceId)
    if (!workspace) throw ApiError.NotFound("Workspace not found")

    // Users can remove themselves, owners/admins can remove others
    if (targetUserId !== requestingUserId) {
      const requestingMembership = await this.workspaceDAO.getMembership({
        workspaceId,
        userId: requestingUserId,
      })
      if (!requestingMembership) throw ApiError.Forbidden("You are not a member of this workspace")
      if (requestingMembership.role !== "owner" && requestingMembership.role !== "admin") {
        throw ApiError.Forbidden("Only workspace owners and admins can remove members")
      }
    }

    // Cannot remove the workspace owner
    if (workspace.owner_id === targetUserId) {
      throw ApiError.BadRequest("Cannot remove the workspace owner")
    }

    await this.workspaceDAO.removeMember({ workspaceId, userId: targetUserId })
    return { success: true }
  }
}
