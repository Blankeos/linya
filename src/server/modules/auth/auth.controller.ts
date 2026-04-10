import { Hono } from "hono"
import { getCookie, setCookie } from "hono/cookie"
import { describeRoute, validator as zValidator } from "hono-openapi"
import { z } from "zod"
import { publicEnv } from "@/env.public"
import { ApiError } from "@/server/lib/error"
import {
  RATE_LIMIT_EMAIL_SEND,
  RATE_LIMIT_LOGIN,
  RATE_LIMIT_REGISTER,
  rateLimit,
} from "@/server/lib/rate-limit"
import { s3Client } from "@/server/lib/s3"
import { AUTH_CONFIG } from "./auth.config"
import { getUserResponseDTO, userMetaClientInputDTO } from "./auth.dto"
import { authMiddleware, requireAuthMiddleware } from "./auth.middleware"
import { AuthService } from "./auth.service"
import { AuthDAO } from "./auth.dao"
import {
  deleteRefreshTokenCookie,
  getClientIP,
  getOAuthRedirectUrl,
  getSimpleDeviceName,
  setRefreshTokenCookie,
} from "./auth.utilities"

const authService = new AuthService()
const authDAO = new AuthDAO()

export const authController = new Hono()
  .use(describeRoute({ tags: ["Auth"] }))
  .use("/login", rateLimit({ ...RATE_LIMIT_LOGIN }))
  .use("/register", rateLimit({ ...RATE_LIMIT_REGISTER }))
  .use("/login/otp", rateLimit({ ...RATE_LIMIT_EMAIL_SEND }))
  .use("/login/otp/verify", rateLimit({ ...RATE_LIMIT_LOGIN }))
  .use("/login/magic-link", rateLimit({ ...RATE_LIMIT_EMAIL_SEND }))
  .use("/forgot-password", rateLimit({ ...RATE_LIMIT_EMAIL_SEND }))
  .use("/forgot-password/verify", rateLimit({ ...RATE_LIMIT_LOGIN }))
  .use("/verify-email", rateLimit({ ...RATE_LIMIT_EMAIL_SEND }))

  // Get current user (from Authorization: Bearer <accessToken>)
  .get("/", authMiddleware, async (c) => {
    const user = c.get("user")
    if (!user) return c.json({ user: null })
    const userDetails = await authService.getUserDetails({ userId: user.id })
    return c.json({ user: userDetails })
  })

  // Get authenticated user profile
  .get("/profile", authMiddleware, requireAuthMiddleware, async (c) => {
    const user = c.var.user
    const userDetails = await authService.getUserDetails({ userId: user.id })
    return c.json({ user: userDetails })
  })

  // Update User Profile
  .put(
    "/profile",
    authMiddleware,
    requireAuthMiddleware,
    zValidator("json", userMetaClientInputDTO),
    async (c) => {
      const user = c.var.user
      const updates = c.req.valid("json")
      await authService.updateUserProfile(user.id, { metadata: updates })
      const userDetails = await authService.getUserDetails({ userId: user.id })
      return c.json({ user: userDetails })
    }
  )

  // Generate Avatar Upload URL
  .post("/profile/avatar/upload-url", authMiddleware, requireAuthMiddleware, async (c) => {
    const user = c.var.user
    const objectKey = `avatar_${user.id}`
    const uploadData = await s3Client.generateUploadUrl(objectKey)
    return c.json({ uploadUrl: uploadData.signedUrl, objectKey })
  })

  // Get Avatar (redirect to signed S3 URL)
  .get("/profile/avatar/:uniqueId", async (c) => {
    const uniqueId = c.req.param("uniqueId")
    if (!uniqueId.startsWith("avatar_"))
      throw ApiError.BadRequest("This is not a valid avatar unique id.")

    const url = await s3Client.getSignedUrlFromKey(uniqueId)
    if (!url) throw ApiError.NotFound("Avatar image not found.")

    return c.redirect(url)
  })

  // Login
  .post(
    "/login",
    zValidator("json", z.object({ email: z.string(), password: z.string() })),
    async (c) => {
      const { email, password } = c.req.valid("json")
      const ipAddress = getClientIP(c)
      const userAgent = getSimpleDeviceName(c.req.header("User-Agent") ?? null)

      const { user, accessToken, refreshToken } = await authService.emailLogin({
        email: email.toLowerCase(),
        password,
        ipAddress,
        userAgent,
      })

      setRefreshTokenCookie(c, refreshToken)

      return c.json({ user: await getUserResponseDTO(user), accessToken })
    }
  )

  // Register
  .post(
    "/register",
    zValidator("json", z.object({ email: z.email(), password: z.string() })),
    async (c) => {
      const { email, password } = c.req.valid("json")
      const ipAddress = getClientIP(c)
      const userAgent = getSimpleDeviceName(c.req.header("User-Agent") ?? null)

      const { user, accessToken, refreshToken } = await authService.emailRegister({
        email: email.toLowerCase(),
        password,
        ipAddress,
        userAgent,
      })

      setRefreshTokenCookie(c, refreshToken)

      return c.json({ user: await getUserResponseDTO(user), accessToken })
    }
  )

  // Refresh access token (reads HttpOnly refresh token cookie, rotates it)
  .post("/refresh", async (c) => {
    const refreshToken = getCookie(c, AUTH_CONFIG.refreshToken.cookieName)
    if (!refreshToken) throw ApiError.Unauthorized("No refresh token provided")

    const ipAddress = getClientIP(c)
    const userAgent = getSimpleDeviceName(c.req.header("User-Agent") ?? null)

    const {
      user,
      accessToken,
      refreshToken: newRefreshToken,
    } = await authService.refreshAccessToken(refreshToken, { ipAddress, userAgent })

    setRefreshTokenCookie(c, newRefreshToken)

    return c.json({ user: await getUserResponseDTO(user), accessToken })
  })

  // Logout (revoke current refresh token)
  .post("/logout", async (c) => {
    const refreshToken = getCookie(c, AUTH_CONFIG.refreshToken.cookieName)
    if (refreshToken) await authService.logout(refreshToken)
    deleteRefreshTokenCookie(c)
    return c.json({ success: true })
  })

  // Logout all sessions
  .post("/logout-all", authMiddleware, requireAuthMiddleware, async (c) => {
    const user = c.var.user
    await authService.logoutAll(user.id)
    deleteRefreshTokenCookie(c)
    return c.json({ success: true })
  })

  // Revoke a specific refresh token by DB row ID
  .post(
    "/revoke",
    authMiddleware,
    requireAuthMiddleware,
    zValidator("json", z.object({ tokenId: z.string() })),
    async (c) => {
      const { tokenId } = c.req.valid("json")
      const user = c.var.user

      const details = await authService.getUserDetails({ userId: user.id })
      const owns = details.active_sessions.some((s: any) => s.id === tokenId)
      if (!owns) throw ApiError.NotFound("Token not found or does not belong to you")

      await authDAO.revokeRefreshToken(tokenId)

      return c.json({ success: true })
    }
  )

  // Google Login [redirect]
  .get(
    "/login/google",
    zValidator(
      "query",
      z.object({
        redirect_url: z.string().optional(),
        client_code_challenge: z.string().optional(),
      })
    ),
    async (c) => {
      const { redirect_url, client_code_challenge } = c.req.valid("query")
      const { cookies, authorizationUrl } = await authService.googleLogin({
        redirectUrl: redirect_url,
        clientCodeChallenge: client_code_challenge,
      })
      for (const cookie of cookies) setCookie(c, cookie.name, cookie.value, cookie.options)
      return c.redirect(authorizationUrl)
    }
  )

  // Google Login Callback [redirect]
  .get("/login/google/callback", async (c) => {
    const allCookies = getCookie(c)
    const { userId, refreshToken, redirectUrl } = await authService.googleCallback({
      code: c.req.query("code"),
      state: c.req.query("state"),
      storedState: allCookies.google_oauth_state,
      storedCodeVerifier: allCookies.google_oauth_codeverifier,
      storedRedirectUrl: allCookies.google_oauth_redirect_url,
      storedCodeChallenge: allCookies.google_oauth_client_code_challenge,
    })
    if (refreshToken) setRefreshTokenCookie(c, refreshToken)
    return c.redirect(redirectUrl)
  })

  // GitHub Login [redirect]
  .get(
    "/login/github",
    zValidator(
      "query",
      z.object({
        redirect_url: z.string().optional(),
        client_code_challenge: z.string().optional(),
      })
    ),
    async (c) => {
      const { redirect_url, client_code_challenge } = c.req.valid("query")
      const { cookies, authorizationUrl } = await authService.githubLogin({
        redirectUrl: redirect_url,
        clientCodeChallenge: client_code_challenge,
      })
      for (const cookie of cookies) setCookie(c, cookie.name, cookie.value, cookie.options)
      return c.redirect(authorizationUrl)
    }
  )

  // GitHub Login Callback [redirect]
  .get("/login/github/callback", async (c) => {
    const cookies = getCookie(c)
    const { refreshToken, redirectUrl } = await authService.githubCallback({
      code: c.req.query("code"),
      state: c.req.query("state"),
      storedState: cookies.github_oauth_state,
      storedRedirectUrl: cookies.github_oauth_redirect_url,
      storedCodeChallenge: cookies.github_oauth_client_code_challenge,
    })
    if (refreshToken) setRefreshTokenCookie(c, refreshToken)
    return c.redirect(redirectUrl)
  })

  // PKCE Token Exchange (for native/desktop apps)
  .post(
    "/login/token",
    zValidator("json", z.object({ auth_code: z.string(), code_verifier: z.string() })),
    async (c) => {
      const { auth_code, code_verifier } = c.req.valid("json")
      const ipAddress = getClientIP(c)
      const userAgent = getSimpleDeviceName(c.req.header("User-Agent") ?? null)

      const { user, accessToken, refreshToken } = await authService.pkceLogin({
        auth_code,
        code_verifier,
        meta: { ipAddress, userAgent },
      })

      setRefreshTokenCookie(c, refreshToken)

      return c.json({ user: await getUserResponseDTO(user), accessToken })
    }
  )

  // Send Email OTP
  .post(
    "/login/otp",
    zValidator("json", z.object({ email: z.email() })),
    async (c) => {
      const { email } = c.req.valid("json")
      const { identifier } = await authService.emailOTPLoginSend({ email: email.toLowerCase() })
      return c.json({ success: true, identifier })
    }
  )

  // Verify Login OTP
  .post(
    "/login/otp/verify",
    zValidator("json", z.object({ identifier: z.string(), code: z.string() })),
    async (c) => {
      const { identifier, code } = c.req.valid("json")
      const ipAddress = getClientIP(c)
      const userAgent = getSimpleDeviceName(c.req.header("User-Agent") ?? null)

      const { user, accessToken, refreshToken } = await authService.verifyOTPOrTokenLogin({
        identifier,
        code,
        meta: { ipAddress, userAgent },
      })

      setRefreshTokenCookie(c, refreshToken)

      return c.json({ user: await getUserResponseDTO(user), accessToken })
    }
  )

  // Send Magic Link
  .post(
    "/login/magic-link",
    zValidator("json", z.object({ email: z.email() })),
    async (c) => {
      const { email } = c.req.valid("json")
      await authService.magicLinkLoginSend({ email: email.toLowerCase() })
      return c.json({ success: true })
    }
  )

  // Verify Magic Link [redirect] — sets refresh cookie, redirects to app
  .get(
    "/login/magic-link/verify",
    zValidator(
      "query",
      z.object({
        token: z.string(),
        redirect_url: z.string().optional(),
        fallback_url: z.string().optional(),
      })
    ),
    async (c) => {
      const { token, redirect_url, fallback_url } = c.req.valid("query")
      const safeRedirectUrl = getOAuthRedirectUrl(redirect_url ?? fallback_url, {
        allowDefaultRedirect: true,
      })

      try {
        const ipAddress = getClientIP(c)
        const userAgent = getSimpleDeviceName(c.req.header("User-Agent") ?? null)
        const { refreshToken } = await authService.verifyOTPOrTokenLogin({
          token,
          meta: { ipAddress, userAgent },
        })
        setRefreshTokenCookie(c, refreshToken)
      } catch (error: any) {
        const dest = new URL(safeRedirectUrl)
        dest.searchParams.set("error", error.message || "Magic link verification failed")
        return c.redirect(dest.toString())
      }

      return c.redirect(safeRedirectUrl)
    }
  )

  // Forgot Password Send
  .post(
    "/forgot-password",
    zValidator("json", z.object({ email: z.email() })),
    async (c) => {
      const { email } = c.req.valid("json")
      await authService.forgotPasswordSend({ email: email.toLowerCase() })
      return c.json({ success: true })
    }
  )

  // Forgot Password Verify [GET — validate token, redirect to input page]
  .get(
    "/forgot-password/verify",
    zValidator("query", z.object({ token: z.string() })),
    async (c) => {
      const { token } = c.req.valid("query")

      try {
        await authService.validateTokenIsNotExpired(token)
      } catch (error: any) {
        const dest = new URL(publicEnv.PUBLIC_BASE_URL)
        dest.searchParams.set("error", error.message || "Password reset link is invalid or expired")
        return c.redirect(dest.toString())
      }

      return c.redirect(AUTH_CONFIG.redirectUrls.forgotPasswordVerifyInputPage(token))
    }
  )

  // Forgot Password Reset [POST]
  .post(
    "/forgot-password/verify",
    zValidator(
      "json",
      z.object({ token: z.string(), newPassword: z.string().min(8).max(255) })
    ),
    async (c) => {
      const { token, newPassword } = c.req.valid("json")
      const result = await authService.forgotPasswordVerify({ token, newPassword })
      return c.json(result)
    }
  )

  // Email Verification Send
  .post(
    "/verify-email",
    zValidator("json", z.object({ email: z.email() })),
    async (c) => {
      const { email } = c.req.valid("json")
      await authService.emailVerificationSend({ email: email.toLowerCase() })
      return c.json({ success: true })
    }
  )

  // Passkey — Registration Options (requires auth)
  .post("/passkey/register/options", authMiddleware, requireAuthMiddleware, async (c) => {
    const user = c.var.user
    const options = await authService.passkeyRegisterOptions(user.id)
    return c.json(options)
  })

  // Passkey — Registration Verify (requires auth)
  .post(
    "/passkey/register/verify",
    authMiddleware,
    requireAuthMiddleware,
    zValidator("json", z.any()),
    async (c) => {
      const user = c.var.user
      const response = c.req.valid("json")
      const result = await authService.passkeyRegisterVerify(user.id, response)
      return c.json(result)
    }
  )

  // Passkey — Authentication Options (public)
  .post("/passkey/auth/options", async (c) => {
    const options = await authService.passkeyAuthOptions()
    return c.json(options)
  })

  // Passkey — Authentication Verify (public)
  .post("/passkey/auth/verify", zValidator("json", z.any()), async (c) => {
    const response = c.req.valid("json")
    const ipAddress = getClientIP(c)
    const userAgent = getSimpleDeviceName(c.req.header("User-Agent") ?? null)
    const { user, accessToken, refreshToken } = await authService.passkeyAuthVerify(response, { ipAddress, userAgent })
    setRefreshTokenCookie(c, refreshToken)
    return c.json({ user: await getUserResponseDTO(user), accessToken })
  })

  // Email Verification Verify [redirect]
  .get(
    "/verify-email/verify",
    zValidator(
      "query",
      z.object({
        token: z.string(),
        redirect_url: z.string().optional(),
        fallback_url: z.string().optional(),
      })
    ),
    async (c) => {
      const { token, redirect_url, fallback_url } = c.req.valid("query")
      const safeRedirectUrl = getOAuthRedirectUrl(redirect_url ?? fallback_url, {
        allowDefaultRedirect: true,
      })

      try {
        await authService.emailVerificationVerify({ token })
      } catch (error: any) {
        const dest = new URL(safeRedirectUrl)
        dest.searchParams.set("error", error.message || "Email verification failed")
        return c.redirect(dest.toString())
      }

      return c.redirect(safeRedirectUrl)
    }
  )
