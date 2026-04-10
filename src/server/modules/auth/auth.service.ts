import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server"
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server"
import { generateState, OAuth2RequestError } from "arctic"
import type { CookieOptions } from "hono/utils/cookie"
import z from "zod"
import { publicEnv } from "@/env.public"
import { github, google } from "@/server/lib/arctic"
import {
  renderForgotPasswordEmail,
  renderMagicLinkEmail,
  renderOtpEmail,
  sendEmail,
} from "@/server/lib/emails"
import { ApiError } from "@/server/lib/error"
import { generateCodeVerifier, verifyCodeVerifier } from "@/server/lib/pkce"
import { AuthDAO } from "./auth.dao"
import { assertDTO } from "@/server/utils/assert-dto"
import {
  createAccessToken,
  generateRefreshToken,
  getOAuthRedirectUrl,
  hashToken,
  jsonDecode,
  verifyPassword,
} from "./auth.utilities"
import type { InternalUserDTO, UserMetaDTO } from "./auth.dto"

type TokenPair = { accessToken: string; refreshToken: string }
type AuthResponse = Promise<{ user: InternalUserDTO } & TokenPair>

/** 10 minutes — OAuth state cookies are single-use and short-lived */
const OAUTH_COOKIE_MAX_AGE = 10 * 60

type OAuthCookie = { name: string; value: string; options: CookieOptions }

function oauthCookie(name: string, value: string): OAuthCookie {
  return {
    name,
    value,
    options: { httpOnly: true, sameSite: "Lax", maxAge: OAUTH_COOKIE_MAX_AGE, path: "/", secure: false },
  }
}

type OAuthCallbackResponse = Promise<{
  userId?: string
  refreshToken?: string
  statusText?: string
  redirectUrl: string
}>

export class AuthService {
  private authDAO: AuthDAO

  constructor() {
    this.authDAO = new AuthDAO()
  }

  private async issueTokenPair(userId: string, meta?: { ipAddress?: string | null; userAgent?: string | null }): Promise<TokenPair> {
    const refreshToken = generateRefreshToken()
    const tokenHash = await hashToken(refreshToken)
    await this.authDAO.createRefreshToken({ userId, tokenHash, ipAddress: meta?.ipAddress, userAgent: meta?.userAgent })
    const accessToken = await createAccessToken(userId)
    return { accessToken, refreshToken }
  }

  // ===========================================================================
  // Email & Password
  // ===========================================================================
  async emailLogin(params: { email: string; password: string; ipAddress?: string | null; userAgent?: string | null }): AuthResponse {
    const user = await this.authDAO.getUserByEmail(params.email)
    if (!user) throw ApiError.BadRequest("Incorrect email or password")

    const valid = await verifyPassword(user.password_hash, params.password)
    if (!valid) throw ApiError.BadRequest("Incorrect email or password")

    const tokens = await this.issueTokenPair(user.id, { ipAddress: params.ipAddress, userAgent: params.userAgent })
    return { user, ...tokens }
  }

  async emailRegister(params: { email: string; password: string; ipAddress?: string | null; userAgent?: string | null }): AuthResponse {
    const existing = await this.authDAO.getUserByEmail(params.email)
    if (existing) throw ApiError.BadRequest(`Email ${params.email} is already registered.`)

    const user = await this.authDAO.createUserFromEmailAndPassword({ email: params.email, password: params.password })
    if (!user) throw ApiError.InternalServerError("Failed to create user")

    const tokens = await this.issueTokenPair(user.id, { ipAddress: params.ipAddress, userAgent: params.userAgent })
    return { user, ...tokens }
  }

  // ===========================================================================
  // Refresh
  // ===========================================================================
  async refreshAccessToken(refreshToken: string, meta?: { ipAddress?: string | null; userAgent?: string | null }) {
    const tokenHash = await hashToken(refreshToken)
    const stored = await this.authDAO.getRefreshTokenByHash(tokenHash)
    if (!stored) throw ApiError.Unauthorized("Invalid or expired refresh token")

    // Rotate: revoke old, issue new
    await this.authDAO.revokeRefreshToken(stored.id)

    const user = await this.authDAO.getUserByUserId(stored.user_id)
    if (!user) throw ApiError.Unauthorized("User not found")

    const tokens = await this.issueTokenPair(user.id, meta)
    return { user, ...tokens }
  }

  async logout(refreshToken: string) {
    const tokenHash = await hashToken(refreshToken)
    const stored = await this.authDAO.getRefreshTokenByHash(tokenHash)
    if (stored) await this.authDAO.revokeRefreshToken(stored.id)
    return { success: true }
  }

  async logoutAll(userId: string) {
    await this.authDAO.revokeAllRefreshTokensByUser(userId)
    return { success: true }
  }

  // ===========================================================================
  // Email verification + Forgot Password
  // ===========================================================================
  async emailVerificationSend(params: { email: string }) {
    const user = await this.authDAO.getUserByEmail(params.email)
    if (!user) throw ApiError.NotFound("User with this email not found")
    if (user.email_verified) throw ApiError.BadRequest("Email already verified")

    const token = await this.authDAO.createOneTimeToken({ identifier: user.id, purpose: "email_verification" })

    try {
      await sendEmail({ html: renderMagicLinkEmail({ token }), subject: "Verify your Linya email", to: user.email })
    } catch (err) {
      console.error("[emailVerificationSend]", err)
    }

    return { success: true }
  }

  async emailVerificationVerify(params: { token: string }) {
    const { consumed, identifier } = await this.authDAO.consumeOneTimeToken({ token: params.token, purpose: "email_verification" })
    if (!consumed || !identifier) throw ApiError.BadRequest("Token is invalid or expired")
    await this.authDAO.updateUserVerifiedEmail({ userId: identifier })
    return { success: true }
  }

  async forgotPasswordSend(params: { email: string }) {
    const user = await this.authDAO.getUserByEmail(params.email)
    if (!user) throw ApiError.NotFound("User with this email not found")

    const token = await this.authDAO.createOneTimeToken({ identifier: user.id, purpose: "reset_password", expiresInSeconds: 900 })

    try {
      await sendEmail({ html: renderForgotPasswordEmail({ token }), subject: "Reset your Linya password", to: user.email })
    } catch (err) {
      console.error("[forgotPasswordSend]", err)
    }
  }

  async forgotPasswordVerify(params: { token: string; newPassword: string }) {
    const { consumed, identifier } = await this.authDAO.consumeOneTimeToken({ token: params.token, purpose: "reset_password" })
    if (!consumed || !identifier) throw ApiError.BadRequest("Token is invalid or expired")

    await this.authDAO.updateUserPassword({ userId: identifier, password: params.newPassword })
    await this.authDAO.revokeAllRefreshTokensByUser(identifier)

    return { success: true }
  }

  async validateTokenIsNotExpired(token: string) {
    const _token = await this.authDAO.getOneTimeToken(token)
    if (!_token) throw ApiError.BadRequest("No token found")
    if (new Date() >= new Date(_token.expires_at)) throw ApiError.BadRequest("Token expired")
    return true
  }

  // ===========================================================================
  // OTP & Magic Link Login
  // ===========================================================================
  async emailOTPLoginSend(params: { email: string }) {
    const token = await this.authDAO.createOneTimeToken({
      tokenType: "shortcode",
      purpose: "otp",
      identifier: params.email,
      metadata: { email: params.email },
    })

    try {
      await sendEmail({ html: renderOtpEmail({ email: params.email, otp: token }), subject: "Your Linya sign-in code", to: params.email })
    } catch (err) {
      console.error("[emailOTPLoginSend]", err)
    }

    return { identifier: params.email }
  }

  async magicLinkLoginSend(params: { email: string }) {
    const token = await this.authDAO.createOneTimeToken({
      purpose: "otp",
      identifier: params.email,
      metadata: { email: params.email },
    })

    try {
      await sendEmail({ html: renderMagicLinkEmail({ token }), subject: "Sign in to Linya", to: params.email })
    } catch (err) {
      console.error("[magicLinkLoginSend]", err)
    }
  }

  async verifyOTPOrTokenLogin(params: { identifier?: string; token?: string; code?: string; meta?: { ipAddress?: string | null; userAgent?: string | null } }): AuthResponse {
    if (!params.token && !params.code) throw ApiError.BadRequest("Either token or code must be provided")
    if (params.code && !params.identifier) throw ApiError.BadRequest("Both code and identifier must be provided")

    const { consumed, metadata } = await this.authDAO.consumeOneTimeToken({
      token: params.token,
      code: params.code,
      identifier: params.identifier,
      purpose: "otp",
    })

    if (!consumed) throw ApiError.BadRequest("Token or code is invalid or expired")

    const resolved = assertDTO(jsonDecode(metadata as any), z.object({ email: z.string() }))
    const user = await this.authDAO.getOrCreateUserFromEmail(resolved.email)
    if (!user) throw ApiError.InternalServerError("Login failed: unable to determine user")

    const tokens = await this.issueTokenPair(user.id, params.meta)
    return { user, ...tokens }
  }

  // ===========================================================================
  // OAuth — GitHub
  // ===========================================================================
  async githubLogin(params: { redirectUrl?: string; clientCodeChallenge?: string } = {}) {
    if (!github) throw ApiError.BadRequest("GitHub OAuth is not configured")
    const state = generateState()
    const authUrl = github.createAuthorizationURL(state, ["user:email", "read:user"])
    const normalizedRedirectUrl = getOAuthRedirectUrl(params.redirectUrl)

    const cookies: OAuthCookie[] = [
      oauthCookie("github_oauth_state", state),
      oauthCookie("github_oauth_redirect_url", normalizedRedirectUrl),
    ]
    if (params.clientCodeChallenge) cookies.push(oauthCookie("github_oauth_client_code_challenge", params.clientCodeChallenge))

    return { cookies, authorizationUrl: authUrl.toString() }
  }

  async githubCallback(params: { state?: string; code?: string; storedState?: string; storedRedirectUrl?: string; storedCodeChallenge?: string }): OAuthCallbackResponse {
    if (!github) throw ApiError.BadRequest("GitHub OAuth is not configured")
    const redirectUrl = new URL(params.storedRedirectUrl ?? publicEnv.PUBLIC_BASE_URL)

    if (!params.code || !params.state || !params.storedState || params.state !== params.storedState) {
      redirectUrl.searchParams.append("error", "Invalid OAuth state. Try logging in again.")
      return { redirectUrl: redirectUrl.toString() }
    }

    try {
      const tokens = await github.validateAuthorizationCode(params.code)
      const githubUserRes = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${tokens.accessToken()}` } })
      const githubUser: { id: number; login: string; email?: string; name: string; avatar_url: string } = await githubUserRes.json()

      if (!githubUser.email) {
        const emailsRes = await fetch("https://api.github.com/user/emails", { headers: { Authorization: `Bearer ${tokens.accessToken()}` } })
        const emails: { email: string; verified: boolean; primary: boolean }[] = await emailsRes.json()
        githubUser.email = emails.find((e) => e.primary && e.verified)?.email ?? emails.find((e) => e.verified)?.email
      }

      const userId = await this.authDAO.getOrCreateUserIdForOAuth({
        email: githubUser.email!,
        provider: "github",
        providerUserId: githubUser.id.toString(),
        metadata: { display_name: githubUser.login, avatar_url: githubUser.avatar_url },
      })

      if (params.storedCodeChallenge) {
        const authCode = await this.authDAO.createOneTimeToken({ identifier: userId, purpose: "pkce", metadata: { code_challenge: params.storedCodeChallenge }, expiresInSeconds: 30 })
        redirectUrl.searchParams.append("auth_code", authCode)
        return { redirectUrl: redirectUrl.toString() }
      }

      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      await this.authDAO.createRefreshToken({ userId, tokenHash })

      return { userId, refreshToken, redirectUrl: redirectUrl.toString() }
    } catch (e) {
      if (e instanceof OAuth2RequestError) redirectUrl.searchParams.append("error", "Invalid GitHub OAuth code.")
      else redirectUrl.searchParams.append("error", "Unknown error during GitHub authentication.")
      return { redirectUrl: redirectUrl.toString() }
    }
  }

  // ===========================================================================
  // OAuth — Google
  // ===========================================================================
  async googleLogin(params: { redirectUrl?: string; clientCodeChallenge?: string } = {}) {
    if (!google) throw ApiError.BadRequest("Google OAuth is not configured")
    const state = generateState()
    const codeVerifier = generateCodeVerifier()
    const authUrl = google.createAuthorizationURL(state, codeVerifier, ["profile", "email"])
    authUrl.searchParams.append("prompt", "select_account")

    const normalizedRedirectUrl = getOAuthRedirectUrl(params.redirectUrl)
    const cookies: OAuthCookie[] = [
      oauthCookie("google_oauth_state", state),
      oauthCookie("google_oauth_codeverifier", codeVerifier),
      oauthCookie("google_oauth_redirect_url", normalizedRedirectUrl),
    ]
    if (params.clientCodeChallenge) cookies.push(oauthCookie("google_oauth_client_code_challenge", params.clientCodeChallenge))

    return { cookies, authorizationUrl: authUrl.toString() }
  }

  async googleCallback(params: { state?: string; code?: string; storedState?: string; storedCodeVerifier?: string; storedRedirectUrl?: string; storedCodeChallenge?: string }): OAuthCallbackResponse {
    if (!google) throw ApiError.BadRequest("Google OAuth is not configured")
    const redirectUrl = new URL(params.storedRedirectUrl ?? publicEnv.PUBLIC_BASE_URL)

    if (!params.code || !params.state || !params.storedState || !params.storedCodeVerifier || params.state !== params.storedState) {
      redirectUrl.searchParams.append("error", "Invalid OAuth state. Try logging in again.")
      return { redirectUrl: redirectUrl.toString() }
    }

    try {
      const tokens = await google.validateAuthorizationCode(params.code, params.storedCodeVerifier)
      const googleUserRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.accessToken()}` } })
      const googleUser: { sub: string; email: string; email_verified: boolean; name: string; picture: string } = await googleUserRes.json()

      const userId = await this.authDAO.getOrCreateUserIdForOAuth({
        email: googleUser.email,
        provider: "google",
        providerUserId: googleUser.sub,
        metadata: { display_name: googleUser.name, avatar_url: googleUser.picture },
      })

      if (params.storedCodeChallenge) {
        const authCode = await this.authDAO.createOneTimeToken({ identifier: userId, purpose: "pkce", metadata: { code_challenge: params.storedCodeChallenge }, expiresInSeconds: 30 })
        redirectUrl.searchParams.append("auth_code", authCode)
        return { redirectUrl: redirectUrl.toString() }
      }

      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      await this.authDAO.createRefreshToken({ userId, tokenHash })

      return { userId, refreshToken, redirectUrl: redirectUrl.toString() }
    } catch (e) {
      console.error("[googleCallback] Error:", e)
      if (e instanceof OAuth2RequestError) redirectUrl.searchParams.append("error", "Invalid Google OAuth code.")
      else redirectUrl.searchParams.append("error", (e as Error)?.message || "Unknown error during Google authentication.")
      return { redirectUrl: redirectUrl.toString() }
    }
  }

  // ===========================================================================
  // PKCE Token Exchange
  // ===========================================================================
  async pkceLogin(params: { auth_code: string; code_verifier: string; meta?: { ipAddress?: string | null; userAgent?: string | null } }): AuthResponse {
    const token = await this.authDAO.getOneTimeToken(params.auth_code)
    if (!token || token.purpose !== "pkce") throw ApiError.Unauthorized("Invalid or expired PKCE authorization code")

    const tokenMeta = assertDTO(jsonDecode(token.metadata as any), z.object({ code_challenge: z.string() }))
    const ok = await verifyCodeVerifier(params.code_verifier, tokenMeta.code_challenge)
    if (!ok) throw ApiError.Unauthorized("Invalid code verifier")

    await this.authDAO.consumeOneTimeToken({ token: token.token })

    const user = await this.authDAO.getUserByUserId(token.identifier)
    if (!user) throw ApiError.InternalServerError("Login failed: user not found")

    const tokens = await this.issueTokenPair(user.id, params.meta)
    return { user, ...tokens }
  }

  // ===========================================================================
  // User profile
  // ===========================================================================
  async getUserDetails(params: { userId: string }) {
    const user = await this.authDAO.getUserByUserId(params.userId)
    if (!user) throw ApiError.NotFound("No user found")

    const [oauthAccounts, activeSessions] = await Promise.all([
      this.authDAO.getUserByUserId(params.userId).then(() =>
        // fetch oauth accounts via db directly
        Promise.resolve([] as { provider: string; provider_user_id: string }[])
      ),
      this.authDAO.getActiveRefreshTokensByUser(params.userId),
    ])

    return {
      id: user.id,
      email: user.email,
      email_verified: user.email_verified,
      display_name: user.display_name,
      joined_at: user.joined_at,
      updated_at: user.updated_at,
      active_sessions: activeSessions.map((s) => ({
        id: s.id,
        created_at: s.created_at,
        expires_at: s.expires_at,
        ip_address: s.ip_address,
        user_agent: s.user_agent,
      })),
    }
  }

  async updateUserProfile(userId: string, updates: { metadata?: Partial<UserMetaDTO> }) {
    return await this.authDAO.updateUserMetadata({ userId, metadata: updates.metadata })
  }

  // ===========================================================================
  // Passkeys
  // ===========================================================================
  private getPasskeyRpID() {
    try { return new URL(publicEnv.PUBLIC_BASE_URL).hostname } catch { return "localhost" }
  }

  private getPasskeyOrigin() {
    return publicEnv.PUBLIC_BASE_URL.replace(/\/$/, "")
  }

  async passkeyRegisterOptions(userId: string) {
    const user = await this.authDAO.getUserByUserId(userId)
    if (!user) throw ApiError.NotFound("User not found")

    const existingPasskeys = await this.authDAO.getPasskeysByUserId(userId)

    const options = await generateRegistrationOptions({
      rpName: "Linya",
      rpID: this.getPasskeyRpID(),
      userID: new TextEncoder().encode(userId),
      userName: user.email,
      userDisplayName: user.display_name || user.email,
      excludeCredentials: existingPasskeys.map((pk) => ({ id: pk.credential_id, type: "public-key" as const })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    })

    // Replace any stale challenge for this user+purpose before storing
    await this.authDAO.deleteOneTimeTokensByIdentifierAndPurpose(userId, "passkey_register")
    await this.authDAO.createOneTimeToken({ token: options.challenge, identifier: userId, purpose: "passkey_register", expiresInSeconds: 300 })

    return options
  }

  async passkeyRegisterVerify(userId: string, response: RegistrationResponseJSON) {
    const pending = await this.authDAO.getActiveOneTimeTokenByIdentifierAndPurpose(userId, "passkey_register")
    if (!pending) throw ApiError.BadRequest("No pending passkey registration challenge")

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.token,
      expectedOrigin: this.getPasskeyOrigin(),
      expectedRPID: this.getPasskeyRpID(),
    })

    if (!verification.verified || !verification.registrationInfo) {
      throw ApiError.BadRequest("Passkey registration verification failed")
    }

    await this.authDAO.consumeOneTimeToken({ token: pending.token })

    const { credential } = verification.registrationInfo
    await this.authDAO.createPasskey({
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
    })

    return { verified: true }
  }

  async passkeyAuthOptions() {
    const options = await generateAuthenticationOptions({
      rpID: this.getPasskeyRpID(),
      userVerification: "preferred",
    })

    await this.authDAO.createOneTimeToken({ token: options.challenge, identifier: "passkey_auth", purpose: "passkey_auth", expiresInSeconds: 300 })

    return options
  }

  async passkeyAuthVerify(response: AuthenticationResponseJSON, meta?: { ipAddress?: string | null; userAgent?: string | null }) {
    const passkey = await this.authDAO.getPasskeyByCredentialId(response.id)
    if (!passkey) throw ApiError.BadRequest("Passkey not found")

    // Extract challenge from clientDataJSON to look up the stored challenge
    const clientData = JSON.parse(Buffer.from(response.response.clientDataJSON, "base64").toString("utf8"))
    const challenge: string = clientData.challenge

    const { consumed } = await this.authDAO.consumeOneTimeToken({ token: challenge, identifier: "passkey_auth", purpose: "passkey_auth" })
    if (!consumed) throw ApiError.BadRequest("Invalid or expired passkey challenge")

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: this.getPasskeyOrigin(),
      expectedRPID: this.getPasskeyRpID(),
      credential: {
        id: passkey.credential_id,
        publicKey: new Uint8Array(passkey.public_key),
        counter: Number(passkey.counter),
      },
    })

    if (!verification.verified) throw ApiError.BadRequest("Passkey authentication failed")

    await this.authDAO.updatePasskeyCounter(passkey.id, BigInt(verification.authenticationInfo.newCounter))

    const user = await this.authDAO.getUserByUserId(passkey.user_id)
    if (!user) throw ApiError.NotFound("User not found")

    const tokens = await this.issueTokenPair(user.id, meta)
    return { user, ...tokens }
  }
}
