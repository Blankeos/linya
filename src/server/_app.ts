import { Hono } from "hono"
import { authController } from "./modules/auth/auth.controller"
import { workspaceController } from "./modules/workspace/workspace.controller"
import { teamsController } from "./modules/teams/teams.controller"
import { issuesController } from "./modules/issues/issues.controller"
import { viewsController } from "./modules/views/views.controller"
import { syncController } from "./modules/sync/sync.controller"

export const appRouter = new Hono()
  // Extend routes here...
  .route("/auth", authController)
  .route("/workspaces", workspaceController)
  .route("/workspaces/:workspaceId/teams", teamsController)
  .route("/workspaces/:workspaceId/views", viewsController)
  .route("/issues", issuesController)
  .route("/sync", syncController)

export type AppRouter = typeof appRouter

// Other files you want to include in dts bundle
import type { ApiErrorResponse } from "./lib/error"
import type { UserResponseDTO } from "./modules/auth/auth.dto"

export type { ApiErrorResponse, UserResponseDTO }
