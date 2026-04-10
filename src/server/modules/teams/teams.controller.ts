import { Hono } from "hono"
import { describeRoute, validator as zValidator } from "hono-openapi"
import { z } from "zod"
import { authMiddleware, requireAuthMiddleware } from "@/server/modules/auth/auth.middleware"
import { ApiError } from "@/server/lib/error"
import { TeamsService } from "./teams.service"
import { TeamsDAO } from "./teams.dao"

const teamsService = new TeamsService()
const teamsDAO = new TeamsDAO()

export const teamsController = new Hono()
  .use(describeRoute({ tags: ["Teams"] }))
  .use(authMiddleware)
  .use(requireAuthMiddleware)

  // GET / — list teams in workspace
  .get("/", async (c) => {
    const user = c.var.user
    const workspaceId = c.req.param("workspaceId" as any) as string
    const teams = await teamsService.getUserTeams(workspaceId, user.id)
    return c.json({ teams })
  })

  // POST / — create team
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(100),
        identifier: z.string().min(1).max(10),
        description: z.string().max(500).optional(),
        color: z.string().optional(),
      })
    ),
    async (c) => {
      const user = c.var.user
      const workspaceId = c.req.param("workspaceId" as any) as string
      const body = c.req.valid("json")
      const team = await teamsService.createTeam(
        {
          workspaceId,
          name: body.name,
          identifier: body.identifier,
          description: body.description,
          color: body.color,
        },
        user.id
      )
      return c.json({ team }, 201)
    }
  )

  // GET /:teamId — get team
  .get("/:teamId", async (c) => {
    const user = c.var.user
    const { teamId } = c.req.param()
    const team = await teamsService.getTeam(teamId, user.id)
    const members = await teamsDAO.getTeamMembers(teamId)
    return c.json({ team, members })
  })

  // PUT /:teamId — update team
  .put(
    "/:teamId",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(100).optional(),
        identifier: z.string().min(1).max(10).optional(),
        description: z.string().max(500).nullable().optional(),
        icon: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        timezone: z.string().nullable().optional(),
        is_private: z.boolean().optional(),
      })
    ),
    async (c) => {
      const user = c.var.user
      const { teamId } = c.req.param()
      const body = c.req.valid("json")
      const team = await teamsService.updateTeam(teamId, body, user.id)
      return c.json({ team })
    }
  )

  // DELETE /:teamId — delete team
  .delete("/:teamId", async (c) => {
    const user = c.var.user
    const { teamId } = c.req.param()
    const result = await teamsService.deleteTeam(teamId, user.id)
    return c.json(result)
  })

  // GET /:teamId/statuses — get workflow statuses
  .get("/:teamId/statuses", async (c) => {
    const user = c.var.user
    const { teamId } = c.req.param()
    // Verify access
    await teamsService.getTeam(teamId, user.id)
    const statuses = await teamsDAO.getWorkflowStatusesByTeamId(teamId)
    return c.json({ statuses })
  })

  // POST /:teamId/statuses — create status
  .post(
    "/:teamId/statuses",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(100),
        color: z.string(),
        category: z.enum(["backlog", "unstarted", "started", "completed", "cancelled"]),
        position: z.number(),
        isDefault: z.boolean().optional(),
      })
    ),
    async (c) => {
      const user = c.var.user
      const { teamId } = c.req.param()
      const body = c.req.valid("json")
      // Verify team access
      await teamsService.getTeam(teamId, user.id)
      const status = await teamsDAO.createWorkflowStatus({
        teamId,
        name: body.name,
        color: body.color,
        category: body.category,
        position: body.position,
        isDefault: body.isDefault,
      })
      if (!status) throw ApiError.InternalServerError("Failed to create workflow status")
      return c.json({ status }, 201)
    }
  )

  // PUT /:teamId/statuses/:statusId — update status
  .put(
    "/:teamId/statuses/:statusId",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(100).optional(),
        color: z.string().optional(),
        category: z
          .enum(["backlog", "unstarted", "started", "completed", "cancelled"])
          .optional(),
        position: z.number().optional(),
        is_default: z.boolean().optional(),
      })
    ),
    async (c) => {
      const user = c.var.user
      const { teamId, statusId } = c.req.param()
      const body = c.req.valid("json")
      // Verify team access
      await teamsService.getTeam(teamId, user.id)
      const status = await teamsDAO.updateWorkflowStatus(statusId, body)
      if (!status) throw ApiError.NotFound("Workflow status not found")
      return c.json({ status })
    }
  )

  // DELETE /:teamId/statuses/:statusId — delete status
  .delete("/:teamId/statuses/:statusId", async (c) => {
    const user = c.var.user
    const { teamId, statusId } = c.req.param()
    // Verify team access
    await teamsService.getTeam(teamId, user.id)
    await teamsDAO.deleteWorkflowStatus(statusId)
    return c.json({ success: true })
  })
