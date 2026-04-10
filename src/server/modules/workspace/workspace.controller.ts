import { Hono } from "hono"
import { describeRoute, validator as zValidator } from "hono-openapi"
import { z } from "zod"
import { authMiddleware, requireAuthMiddleware } from "@/server/modules/auth/auth.middleware"
import { WorkspaceService } from "./workspace.service"
import { WorkspaceDAO } from "./workspace.dao"

const workspaceService = new WorkspaceService()
const workspaceDAO = new WorkspaceDAO()

export const workspaceController = new Hono()
  .use(describeRoute({ tags: ["Workspaces"] }))
  .use(authMiddleware)
  .use(requireAuthMiddleware)

  // GET / — list user's workspaces
  .get("/", async (c) => {
    const user = c.var.user
    const workspaces = await workspaceService.getUserWorkspaces(user.id)
    return c.json({ workspaces })
  })

  // POST / — create workspace
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(100).optional(),
      })
    ),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")
      const workspace = await workspaceService.createWorkspace({
        name: body.name,
        slug: body.slug,
        ownerId: user.id,
      })
      return c.json({ workspace }, 201)
    }
  )

  // GET /:workspaceId — get workspace details
  .get("/:workspaceId", async (c) => {
    const user = c.var.user
    const { workspaceId } = c.req.param()
    const workspace = await workspaceService.getWorkspace(workspaceId, user.id)
    const members = await workspaceDAO.getMembersByWorkspaceId(workspaceId)
    return c.json({ workspace, members })
  })

  // PUT /:workspaceId — update workspace
  .put(
    "/:workspaceId",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(100).optional(),
        slug: z.string().min(1).max(100).optional(),
        iconUrl: z.string().url().nullable().optional(),
      })
    ),
    async (c) => {
      const user = c.var.user
      const { workspaceId } = c.req.param()
      const body = c.req.valid("json")
      const workspace = await workspaceService.updateWorkspace(workspaceId, body, user.id)
      return c.json({ workspace })
    }
  )

  // POST /:workspaceId/members — invite member
  .post(
    "/:workspaceId/members",
    zValidator(
      "json",
      z.object({
        email: z.string().email(),
        role: z.enum(["admin", "member", "guest"]).default("member"),
      })
    ),
    async (c) => {
      const user = c.var.user
      const { workspaceId } = c.req.param()
      const body = c.req.valid("json")
      const member = await workspaceService.inviteMember(
        workspaceId,
        body.email,
        body.role,
        user.id
      )
      return c.json({ member }, 201)
    }
  )

  // DELETE /:workspaceId/members/:userId — remove member
  .delete("/:workspaceId/members/:userId", async (c) => {
    const user = c.var.user
    const { workspaceId, userId } = c.req.param()
    const result = await workspaceService.removeMember(workspaceId, userId, user.id)
    return c.json(result)
  })
