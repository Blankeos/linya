import { db } from "@/server/db/kysely"
import { generateId } from "@/server/modules/auth/auth.utilities"
import { sql } from "kysely"

export class IssuesDAO {
  // ===========================================================================
  // Issues
  // ===========================================================================
  async createIssue(params: {
    teamId: string
    title: string
    description?: string | null
    statusId: string
    priority?: number
    assigneeId?: string | null
    creatorId: string
    projectId?: string | null
    sortOrder: number
    number: number
  }) {
    return await db
      .insertInto("issue")
      .values({
        id: generateId(),
        team_id: params.teamId,
        number: params.number,
        title: params.title,
        description: params.description ?? null,
        status_id: params.statusId,
        priority: params.priority ?? 0,
        assignee_id: params.assigneeId ?? null,
        creator_id: params.creatorId,
        project_id: params.projectId ?? null,
        sort_order: params.sortOrder,
      })
      .returningAll()
      .executeTakeFirst()
  }

  async getNextIssueNumber(teamId: string): Promise<number> {
    const result = await db
      .selectFrom("issue")
      .select(sql<number>`COALESCE(MAX(number), 0) + 1`.as("next_number"))
      .where("team_id", "=", teamId)
      .executeTakeFirst()

    return result?.next_number ?? 1
  }

  async getIssueById(id: string) {
    return await db
      .selectFrom("issue")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async getIssuesByTeamId(
    teamId: string,
    filters?: {
      statusId?: string
      assigneeId?: string
      priority?: number
    }
  ) {
    let query = db
      .selectFrom("issue")
      .selectAll()
      .where("team_id", "=", teamId)

    if (filters?.statusId) {
      query = query.where("status_id", "=", filters.statusId)
    }
    if (filters?.assigneeId) {
      query = query.where("assignee_id", "=", filters.assigneeId)
    }
    if (filters?.priority !== undefined) {
      query = query.where("priority", "=", filters.priority)
    }

    return await query.orderBy("sort_order", "asc").execute()
  }

  async updateIssue(
    id: string,
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
      started_at?: Date | null
      completed_at?: Date | null
      cancelled_at?: Date | null
    }
  ) {
    return await db
      .updateTable("issue")
      .set({ ...updates, updated_at: new Date() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async deleteIssue(id: string) {
    await db.deleteFrom("issue").where("id", "=", id).execute()
  }

  async getIssueByTeamAndNumber(teamId: string, number: number) {
    return await db
      .selectFrom("issue")
      .selectAll()
      .where("team_id", "=", teamId)
      .where("number", "=", number)
      .executeTakeFirst()
  }

  // ===========================================================================
  // Labels
  // ===========================================================================
  async addLabel(issueId: string, labelId: string) {
    return await db
      .insertInto("issue_label")
      .values({
        id: generateId(),
        issue_id: issueId,
        label_id: labelId,
      })
      .onConflict((oc) => oc.columns(["issue_id", "label_id"]).doNothing())
      .returningAll()
      .executeTakeFirst()
  }

  async removeLabel(issueId: string, labelId: string) {
    await db
      .deleteFrom("issue_label")
      .where("issue_id", "=", issueId)
      .where("label_id", "=", labelId)
      .execute()
  }

  async getIssueLabels(issueId: string) {
    return await db
      .selectFrom("issue_label")
      .innerJoin("label", "label.id", "issue_label.label_id")
      .where("issue_label.issue_id", "=", issueId)
      .select([
        "issue_label.id",
        "issue_label.label_id",
        "label.name",
        "label.color",
      ])
      .execute()
  }
}
