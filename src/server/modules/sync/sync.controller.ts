import { Hono } from "hono"
import { describeRoute, validator as zValidator } from "hono-openapi"
import { z } from "zod"
import { db } from "@/server/db/kysely"
import { authMiddleware, requireAuthMiddleware } from "@/server/modules/auth/auth.middleware"
import { ApiError } from "@/server/lib/error"

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
])

// Map plural table names (PowerSync convention) to DB table names
const TABLE_MAP: Record<string, string> = {
  issues: "issue",
  issue_labels: "issue_label",
  comments: "comment",
  reactions: "reaction",
  documents: "document",
  favorite: "favorite",
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

      // Inject creator/author fields for tables that need it
      if (dbTable === "issue" && !data["creator_id"]) data["creator_id"] = userId
      if (dbTable === "comment" && !data["user_id"]) data["user_id"] = userId
      if (dbTable === "reaction" && !data["user_id"]) data["user_id"] = userId
      if (dbTable === "document" && !data["creator_id"]) data["creator_id"] = userId

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

      const updates: Record<string, unknown> = { ...op.opData }

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
