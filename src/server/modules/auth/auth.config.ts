import { publicEnv } from "@/env.public"
import { privateEnv } from "@/env.private"
import { initHonoClient } from "@/lib/hono-client"
import { getRoute } from "@/route-tree.gen"

type RedirectUrlsConfig = {
  magicLinkVerify: (token: string) => string
  emailVerify: (token: string) => string
  forgotPasswordVerifyServerCheck: (token: string) => string
  forgotPasswordVerifyInputPage: (token: string) => string
}

type OAuthRedirectUrlsConfig = {
  allowed: string[]
  default: string
}

type AuthConfig = {
  refreshToken: {
    expiresInDays: number
    cookieName: string
  }
  accessToken: {
    expiresInMinutes: number
  }
  redirectUrls: RedirectUrlsConfig
  oauthRedirectUrls: OAuthRedirectUrlsConfig
}

function createAuthConfig(): AuthConfig {
  const processedAllowed = ["/**"].map((pattern) => {
    if (pattern.startsWith("/")) {
      return `${publicEnv.PUBLIC_BASE_URL.replace(/\/$/, "")}${pattern}`
    }
    return pattern
  })

  return {
    refreshToken: {
      expiresInDays: privateEnv.REFRESH_TOKEN_EXPIRES_DAYS,
      cookieName: "linya_refresh",
    },
    accessToken: {
      expiresInMinutes: privateEnv.ACCESS_TOKEN_EXPIRES_MINUTES,
    },
    redirectUrls: {
      magicLinkVerify: (token: string) =>
        initHonoClient(publicEnv.PUBLIC_BASE_URL)
          .auth.login["magic-link"].verify.$url({ query: { token } })
          .toString(),
      emailVerify: (token: string) =>
        initHonoClient(publicEnv.PUBLIC_BASE_URL)
          .auth["verify-email"].verify.$url({ query: { token } })
          .toString(),
      forgotPasswordVerifyServerCheck: (token: string) =>
        initHonoClient(publicEnv.PUBLIC_BASE_URL)
          .auth["forgot-password"].verify.$url({ query: { token } })
          .toString(),
      forgotPasswordVerifyInputPage: (token: string) =>
        `${publicEnv.PUBLIC_BASE_URL}${getRoute("/forgot-password/verify", { search: { token } })}`,
    },
    oauthRedirectUrls: {
      allowed: processedAllowed,
      default: "/",
    },
  }
}

export const AUTH_CONFIG = createAuthConfig()
