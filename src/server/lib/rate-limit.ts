import type { Env, Input } from "hono"
import { rateLimiter, type Store } from "hono-rate-limiter"
import { ApiError } from "./error"

export interface RateLimitOptions {
  windowMs?: number
  limit?: number
  keyGenerator?: (c: any) => string
  store?: Store<Env, string, Input>
  message?: string
}

function getRequestIP(c: any): string {
  const ip =
    (c.req as any).ip ||
    (c.env as any)?.remoteAddr ||
    (c.req.raw as any)?.remoteAddress ||
    (c.req.raw as any)?.socket?.remoteAddress

  if (typeof ip === "string" && ip.length > 0) {
    return ip
      .split(",")[0]
      .trim()
      .replace(/^::ffff:/, "")
  }

  return "unknown"
}

export function rateLimit(options: RateLimitOptions = {}) {
  return rateLimiter({
    skip: () => {
      if (process.env.NODE_ENV === "development") return true
      return false
    },
    handler: () => {
      throw ApiError.TooManyRequests(
        options.message ?? "Too many requests, please try again later."
      )
    },
    store: options.store,
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    limit: options.limit ?? 100,
    keyGenerator:
      options.keyGenerator ??
      ((c) => {
        const user = (c as any).get("user")
        if (user?.id) return `user:${user.id}`
        return getRequestIP(c)
      }),
  })
}

export const RATE_LIMIT_LOGIN = {
  windowMs: 900000,
  limit: 5,
  message: "Too many login attempts. Please try again in 15 minutes.",
}

export const RATE_LIMIT_REGISTER = {
  windowMs: 3600000,
  limit: 3,
  message: "Too many registration attempts. Please try again in 1 hour.",
}

export const RATE_LIMIT_VERIFICATION = {
  windowMs: 300000,
  limit: 3,
  message: "Too many verification attempts. Please try again in 5 minutes.",
}

export const RATE_LIMIT_EMAIL_SEND = {
  windowMs: 3600000,
  limit: 5,
  message: "Too many emails sent. Please try again in 1 hour.",
}

export const RATE_LIMIT_GLOBAL = {
  windowMs: 60000,
  limit: 100,
  message: "Too many requests. Please slow down and try again in 1 minute.",
}
