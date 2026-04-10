import { hc } from "hono/client"
import { HTTPException } from "hono/http-exception"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import type { AppRouter } from "@/server/_app"
import type { ApiErrorResponse } from "@/server/lib/error"
import { formatZodIssues } from "@/utils/format-zod-issues"

/** Use this on ssr. */
export const initHonoClient = (
  baseUrl: string,
  ssrProxyParams?: {
    requestHeaders?: Record<string, string>
    responseHeaders?: Headers
  }
) =>
  hc<AppRouter>(`${baseUrl}/api`, {
    headers: ssrProxyParams?.requestHeaders ?? {},
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, { ...init, cache: "no-store" })

      if (!response.ok) {
        const json: ApiErrorResponse = await response.json()

        const errorMessage: string | undefined = (() => {
          if ((json as any)?.error?.name === "ZodError")
            return formatZodIssues((json as any).error.issues)
          return json.error.message
        })()

        throw new HTTPException(response.status as ContentfulStatusCode, {
          message: errorMessage || response.statusText,
          cause: json.error.cause,
          res: response,
        })
      }

      // Proxy Set-Cookie headers back to the browser (for SSR)
      for (const [key, value] of response.headers) {
        if (key.toLowerCase() === "set-cookie") {
          ssrProxyParams?.responseHeaders?.append(key, value)
        }
      }

      return response
    },
  })

// ===========================================================================
// Client-side Hono client with JWT Bearer token injection
// ===========================================================================

/** In-memory access token — set by auth context after login/refresh. */
let _accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  _accessToken = token
}

export function getAccessToken(): string | null {
  return _accessToken
}

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {}
  const headers: Record<string, string> = {}
  if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`
  return headers
}

const baseurl = typeof window === "undefined" ? "" : (window?.location?.origin ?? "")

/** Use this on the client — automatically injects Bearer token. */
export const honoClient = () =>
  hc<AppRouter>(`${baseurl}/api`, {
    headers: () => getAuthHeaders(),
  })
