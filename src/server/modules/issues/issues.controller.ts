import { Hono } from "hono"
import { describeRoute, validator as zValidator } from "hono-openapi"
import { z } from "zod"
import { authMiddleware, requireAuthMiddleware } from "@/server/modules/auth/auth.middleware"
import { ApiError } from "@/server/lib/error"
import { IssuesService } from "./issues.service"
import { IssuesDAO } from "./issues.dao"

const issuesService = new IssuesService()
const issuesDAO = new IssuesDAO()

export const issuesController = new Hono()
  .use(describeRoute({ tags: ["Issues"] }))
  .use(authMiddleware)
  .use(requireAuthMiddleware)

  // GET / — list issues with ?teamId= query param
  .get("/", async (c) => {
    const user = c.var.user
    const teamId = c.req.query("teamId")
    const statusId = c.req.query("statusId")
    const assigneeId = c.req.query("assigneeId")
    const priorityStr = c.req.query("priority")
    const priority = priorityStr !== undefined ? parseInt(priorityStr, 10) : undefined

    if (!teamId) throw ApiError.BadRequest("teamId query param is required")

    const issues = await issuesService.getTeamIssues(teamId, user.id, {
      statusId,
      assigneeId,
      priority: priority !== undefined && !isNaN(priority) ? priority : undefined,
    })

    return c.json({ issues })
  })

  // POST / — create issue
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        teamId: z.string(),
        title: z.string().min(1).max(500),
        description: z.string().nullable().optional(),
        statusId: z.string(),
        priority: z.number().int().min(0).max(4).optional(),
        assigneeId: z.string().nullable().optional(),
        projectId: z.string().nullable().optional(),
      })
    ),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")
      const issue = await issuesService.createIssue(
        {
          teamId: body.teamId,
          title: body.title,
          description: body.description,
          statusId: body.statusId,
          priority: body.priority,
          assigneeId: body.assigneeId,
          projectId: body.projectId,
        },
        user.id
      )
      return c.json({ issue }, 201)
    }
  )

  // GET /:issueId — get issue
  .get("/:issueId", async (c) => {
    const user = c.var.user
    const { issueId } = c.req.param()
    const issue = await issuesService.getIssue(issueId, user.id)
    const labels = await issuesDAO.getIssueLabels(issueId)
    return c.json({ issue, labels })
  })

  // PUT /:issueId — update issue
  .put(
    "/:issueId",
    zValidator(
      "json",
      z.object({
        title: z.string().min(1).max(500).optional(),
        description: z.string().nullable().optional(),
        description_html: z.string().nullable().optional(),
        status_id: z.string().optional(),
        priority: z.number().int().min(0).max(4).optional(),
        assignee_id: z.string().nullable().optional(),
        project_id: z.string().nullable().optional(),
        cycle_id: z.string().nullable().optional(),
        parent_issue_id: z.string().nullable().optional(),
        estimate: z.number().nullable().optional(),
        due_date: z.string().datetime().nullable().optional(),
        sort_order: z.number().optional(),
        is_triaged: z.boolean().optional(),
        snoozed_until: z.string().datetime().nullable().optional(),
      })
    ),
    async (c) => {
      const user = c.var.user
      const { issueId } = c.req.param()
      const body = c.req.valid("json")
      const due_date = body.due_date !== undefined
        ? (body.due_date ? new Date(body.due_date) : null)
        : undefined
      const snoozed_until = body.snoozed_until !== undefined
        ? (body.snoozed_until ? new Date(body.snoozed_until) : null)
        : undefined
      const issue = await issuesService.updateIssue(
        issueId,
        { ...body, due_date, snoozed_until },
        user.id
      )
      return c.json({ issue })
    }
  )

  // DELETE /:issueId — delete issue
  .delete("/:issueId", async (c) => {
    const user = c.var.user
    const { issueId } = c.req.param()
    const result = await issuesService.deleteIssue(issueId, user.id)
    return c.json(result)
  })

  // POST /:issueId/labels — add label
  .post(
    "/:issueId/labels",
    zValidator(
      "json",
      z.object({
        labelId: z.string(),
      })
    ),
    async (c) => {
      const user = c.var.user
      const { issueId } = c.req.param()
      const body = c.req.valid("json")
      // Verify access
      await issuesService.getIssue(issueId, user.id)
      const label = await issuesDAO.addLabel(issueId, body.labelId)
      return c.json({ label }, 201)
    }
  )

  // DELETE /:issueId/labels/:labelId — remove label
  .delete("/:issueId/labels/:labelId", async (c) => {
    const user = c.var.user
    const { issueId, labelId } = c.req.param()
    // Verify access
    await issuesService.getIssue(issueId, user.id)
    await issuesDAO.removeLabel(issueId, labelId)
    return c.json({ success: true })
  })
