import { Hono } from "hono"
import { describeRoute, validator as zValidator } from "hono-openapi"
import { z } from "zod"
import { db } from "@/server/db/kysely"
import { authMiddleware, requireAuthMiddleware } from "@/server/modules/auth/auth.middleware"
import { ApiError } from "@/server/lib/error"

// Ownership column for tables that have a direct user-ownership field
const OWNERSHIP_COLUMN: Partial<Record<string, string>> = {
  comment: "user_id",
  reaction: "user_id",
  document: "creator_id",
  favorite: "user_id",
  display_setting: "user_id",
}

async function assertOwnership(dbTable: string, id: string, userId: string): Promise<void> {
  const anyDb = db as any

  if (dbTable === "issue") {
    // Any workspace member may mutate issues — verify via team → workspace membership
    const row = await db
      .selectFrom("issue")
      .innerJoin("team", "team.id", "issue.team_id")
      .innerJoin("workspace_member", "workspace_member.workspace_id", "team.workspace_id")
      .select("issue.id")
      .where("issue.id", "=", id)
      .where("workspace_member.user_id", "=", userId)
      .executeTakeFirst()
    if (!row) throw ApiError.Forbidden("Not authorized to modify this record")
    return
  }

  if (dbTable === "issue_label") {
    // Verify workspace membership via issue → team → workspace
    const row = await db
      .selectFrom("issue_label")
      .innerJoin("issue", "issue.id", "issue_label.issue_id")
      .innerJoin("team", "team.id", "issue.team_id")
      .innerJoin("workspace_member", "workspace_member.workspace_id", "team.workspace_id")
      .select("issue_label.id")
      .where("issue_label.id", "=", id)
      .where("workspace_member.user_id", "=", userId)
      .executeTakeFirst()
    if (!row) throw ApiError.Forbidden("Not authorized to modify this record")
    return
  }

  if (dbTable === "display_setting") {
    // User can modify their own display settings, or workspace defaults if they are admin/owner
    const row = await db
      .selectFrom("display_setting")
      .select(["display_setting.id", "display_setting.user_id", "display_setting.workspace_id"])
      .where("display_setting.id", "=", id)
      .executeTakeFirst()
    if (!row) throw ApiError.Forbidden("Not authorized to modify this record")
    if (row.user_id && row.user_id !== userId) {
      throw ApiError.Forbidden("Not authorized to modify this record")
    }
    if (!row.user_id) {
      // Workspace default — require admin/owner role
      const member = await db
        .selectFrom("workspace_member")
        .select("role")
        .where("workspace_id", "=", row.workspace_id)
        .where("user_id", "=", userId)
        .executeTakeFirst()
      if (!member || !["owner", "admin"].includes(member.role)) {
        throw ApiError.Forbidden("Only admins can set workspace display defaults")
      }
    }
    return
  }

  const ownerCol = OWNERSHIP_COLUMN[dbTable]
  if (!ownerCol) throw ApiError.Forbidden(`Mutations not supported for table: ${dbTable}`)

  const row = await anyDb
    .selectFrom(dbTable)
    .select("id")
    .where("id", "=", id)
    .where(ownerCol, "=", userId)
    .executeTakeFirst()
  if (!row) throw ApiError.Forbidden("Not authorized to modify this record")
}

// PowerSync mutation operation shape
const syncOperationSchema = z.object({
  op: z.enum(["PUT", "PATCH", "DELETE"]),
  table: z.string(),
  id: z.string(),
  opData: z.record(z.string(), z.unknown()).optional(),
})

type SyncOperation = z.infer<typeof syncOperationSchema>

// Tables that can be mutated via PowerSync upload
const ALLOWED_TABLES = new Set([
  "issues",
  "issue_labels",
  "comments",
  "reactions",
  "documents",
  "favorite",
  "display_setting",
])

// Map plural table names (PowerSync convention) to DB table names
const TABLE_MAP: Record<string, string> = {
  issues: "issue",
  issue_labels: "issue_label",
  comments: "comment",
  reactions: "reaction",
  documents: "document",
  favorite: "favorite",
  display_setting: "display_setting",
}

async function handleOperation(op: SyncOperation, userId: string): Promise<void> {
  const dbTable = TABLE_MAP[op.table]
  if (!dbTable) throw ApiError.BadRequest(`Unknown table: ${op.table}`)

  // Use db as any to bypass strict table-name typing — we validated the table above
  const anyDb = db as any

  switch (op.op) {
    case "PUT": {
      if (!op.opData) throw ApiError.BadRequest("opData is required for PUT operations")

      const data: Record<string, unknown> = { ...op.opData, id: op.id }

      // Always overwrite ownership fields — never trust client-provided values
      if (dbTable === "issue" || dbTable === "document") data["creator_id"] = userId
      if (dbTable === "comment" || dbTable === "reaction" || dbTable === "favorite") data["user_id"] = userId
      // display_setting: user_id=NULL means workspace default (set-for-everyone);
      // only force ownership on personal rows, preserve NULL for workspace defaults
      if (dbTable === "display_setting" && data["user_id"] != null) data["user_id"] = userId

      // Upsert: insert or replace on conflict by id
      await anyDb
        .insertInto(dbTable)
        .values(data)
        .onConflict((oc: any) => oc.column("id").doUpdateSet(op.opData))
        .execute()
      break
    }

    case "PATCH": {
      if (!op.opData) throw ApiError.BadRequest("opData is required for PATCH operations")

      await assertOwnership(dbTable, op.id, userId)

      const updates: Record<string, unknown> = { ...op.opData }

      // Strip ownership fields — never let a client reassign authorship
      delete updates["creator_id"]
      delete updates["user_id"]

      // Add updated_at for tables that have it
      if (["issue", "comment", "document"].includes(dbTable)) {
        updates["updated_at"] = new Date()
      }

      await anyDb
        .updateTable(dbTable)
        .set(updates)
        .where("id", "=", op.id)
        .execute()
      break
    }

    case "DELETE": {
      await assertOwnership(dbTable, op.id, userId)

      await anyDb
        .deleteFrom(dbTable)
        .where("id", "=", op.id)
        .execute()
      break
    }

    default:
      throw ApiError.BadRequest(`Unsupported operation: ${(op as any).op}`)
  }
}

export const syncController = new Hono()
  .use(describeRoute({ tags: ["Sync"] }))
  .use(authMiddleware)
  .use(requireAuthMiddleware)

  // POST /upload — called by BackendConnector.uploadData()
  // Accepts a single operation or a batch
  .post(
    "/upload",
    zValidator(
      "json",
      z.object({
        // PowerSync calls with a single operation object
        operation: syncOperationSchema.optional(),
        // Or a batch of operations
        operations: z.array(syncOperationSchema).optional(),
      })
    ),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")

      const ops: SyncOperation[] = []

      if (body.operation) ops.push(body.operation)
      if (body.operations) ops.push(...body.operations)

      if (ops.length === 0) {
        throw ApiError.BadRequest("No operations provided")
      }

      // Validate all tables are allowed before executing any
      for (const op of ops) {
        if (!ALLOWED_TABLES.has(op.table)) {
          throw ApiError.BadRequest(`Table "${op.table}" is not allowed for sync uploads`)
        }
      }

      // Execute all operations
      const errors: { index: number; table: string; id: string; error: string }[] = []

      for (let i = 0; i < ops.length; i++) {
        const op = ops[i]
        try {
          await handleOperation(op, user.id)
        } catch (err: any) {
          // Collect errors but continue processing remaining ops
          errors.push({
            index: i,
            table: op.table,
            id: op.id,
            error: err?.message ?? "Unknown error",
          })
        }
      }

      if (errors.length > 0) {
        return c.json({ success: false, errors }, 207)
      }

      return c.json({ success: true })
    }
  )
