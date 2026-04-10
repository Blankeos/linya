import { createMiddleware } from "hono/factory"
import type { Bindings } from "@/server/lib/context"
import { ApiError } from "@/server/lib/error"
import { verifyAccessToken, type AccessTokenPayload } from "./auth.utilities"
import { AuthDAO } from "./auth.dao"

const authDAO = new AuthDAO()

export type AuthMiddlewareBindings = Bindings & {
  Variables: {
    user: { id: string } | null
    tokenPayload: AccessTokenPayload | null
  }
}

/** Optional auth — sets user if valid JWT present, null otherwise. */
export const authMiddleware = createMiddleware<AuthMiddlewareBindings>(async (c, next) => {
  const authHeader = c.req.header("Authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (token) {
    const payload = await verifyAccessToken(token)
    if (payload) {
      c.set("user", { id: payload.sub })
      c.set("tokenPayload", payload)
      return next()
    }
  }

  c.set("user", null)
  c.set("tokenPayload", null)
  return next()
})

export type RequireAuthMiddlewareBindings = Bindings & {
  Variables: {
    user: { id: string }
    tokenPayload: AccessTokenPayload
  }
}

/** Guards routes — throws 401 if no valid JWT. */
export const requireAuthMiddleware = createMiddleware<RequireAuthMiddlewareBindings>(
  async (c, next) => {
    if (!c?.var?.user) {
      throw ApiError.Unauthorized("Unauthorized. Please login.")
    }
    return next()
  }
)
