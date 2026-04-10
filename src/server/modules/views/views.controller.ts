import { Hono } from "hono"
import { describeRoute, validator as zValidator } from "hono-openapi"
import { z } from "zod"
import { authMiddleware, requireAuthMiddleware } from "@/server/modules/auth/auth.middleware"
import { ApiError } from "@/server/lib/error"
import { ViewsService } from "./views.service"

const viewsService = new ViewsService()

export const viewsController = new Hono()
  .use(describeRoute({ tags: ["Views"] }))
  .use(authMiddleware)
  .use(requireAuthMiddleware)

  // GET / — list views in workspace
  .get("/", async (c) => {
    const user = c.var.user
    const workspaceId = c.req.param("workspaceId")
    const type = c.req.query("type")

    if (!workspaceId) throw ApiError.BadRequest("workspaceId param is required")

    const views = await viewsService.getWorkspaceViews(workspaceId, user.id, type)

    return c.json({ views })
  })

  // POST / — create view
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        icon: z.string().optional(),
        type: z.string().optional(),
        filters: z.record(z.any()).optional(),
        displayOptions: z.record(z.any()).optional(),
        isShared: z.boolean().optional(),
        teamId: z.string().optional(),
      })
    ),
    async (c) => {
      const user = c.var.user
      const workspaceId = c.req.param("workspaceId")
      const body = c.req.valid("json")

      if (!workspaceId) throw ApiError.BadRequest("workspaceId param is required")

      const view = await viewsService.createView(
        {
          workspaceId,
          teamId: body.teamId,
          name: body.name,
          description: body.description,
          icon: body.icon,
          type: body.type,
          filters: body.filters,
          displayOptions: body.displayOptions,
          isShared: body.isShared,
        },
        user.id
      )

      return c.json({ view }, 201)
    }
  )

  // GET /:viewId — get view
  .get("/:viewId", async (c) => {
    const user = c.var.user
    const { viewId } = c.req.param()

    const view = await viewsService.getView(viewId, user.id)

    return c.json({ view })
  })

  // PUT /:viewId — update view
  .put(
    "/:viewId",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
        filters: z.record(z.any()).optional(),
        displayOptions: z.record(z.any()).optional(),
        isShared: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    ),
    async (c) => {
      const user = c.var.user
      const { viewId } = c.req.param()
      const body = c.req.valid("json")

      const updated = await viewsService.updateView(viewId, body, user.id)

      return c.json({ view: updated })
    }
  )

  // DELETE /:viewId — delete view
  .delete("/:viewId", async (c) => {
    const user = c.var.user
    const { viewId } = c.req.param()

    const result = await viewsService.deleteView(viewId, user.id)

    return c.json(result)
  })
