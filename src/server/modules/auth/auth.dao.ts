import { db } from "@/server/db/kysely"
import { assertDTO } from "@/server/utils/assert-dto"
import {
  generateId,
  generateUniqueCode,
  generateUniqueToken,
  hashPassword,
  hashToken,
  jsonDecode,
} from "./auth.utilities"
import { AUTH_CONFIG } from "./auth.config"
import { type InternalUserDTO, type UserMetaDTO, userMetaDTO } from "./auth.dto"

export class AuthDAO {
  // ===========================================================================
  // Refresh Tokens
  // ===========================================================================
  async createRefreshToken(params: { userId: string; tokenHash: string; ipAddress?: string | null; userAgent?: string | null }) {
    const expiresAt = new Date(
      Date.now() + AUTH_CONFIG.refreshToken.expiresInDays * 24 * 60 * 60 * 1000
    )

    return await db
      .insertInto("refresh_token")
      .values({
        id: generateId(),
        user_id: params.userId,
        token_hash: params.tokenHash,
        expires_at: expiresAt,
        ip_address: params.ipAddress ?? null,
        user_agent: params.userAgent ?? null,
      })
      .returningAll()
      .executeTakeFirst()
  }

  async getRefreshTokenByHash(tokenHash: string) {
    return await db
      .selectFrom("refresh_token")
      .selectAll()
      .where("token_hash", "=", tokenHash)
      .where("revoked_at", "is", null)
      .where("expires_at", ">", new Date())
      .executeTakeFirst()
  }

  async revokeRefreshToken(id: string) {
    await db
      .updateTable("refresh_token")
      .set({ revoked_at: new Date() })
      .where("id", "=", id)
      .execute()
  }

  async revokeAllRefreshTokensByUser(userId: string) {
    await db
      .updateTable("refresh_token")
      .set({ revoked_at: new Date() })
      .where("user_id", "=", userId)
      .where("revoked_at", "is", null)
      .execute()
  }

  async deleteExpiredRefreshTokens() {
    await db
      .deleteFrom("refresh_token")
      .where("expires_at", "<", new Date())
      .execute()
  }

  async getActiveRefreshTokensByUser(userId: string) {
    return await db
      .selectFrom("refresh_token")
      .selectAll()
      .where("user_id", "=", userId)
      .where("revoked_at", "is", null)
      .where("expires_at", ">", new Date())
      .orderBy("created_at", "desc")
      .execute()
  }

  // ===========================================================================
  // Users
  // ===========================================================================
  async getUserByUserId(userId: string) {
    return await db
      .selectFrom("user")
      .selectAll()
      .where("id", "=", userId)
      .executeTakeFirst()
  }

  async getUserByEmail(email: string) {
    return await db
      .selectFrom("user")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst()
  }

  async createUserFromEmailAndPassword(params: { email: string; password: string; metadata?: UserMetaDTO }) {
    const userId = generateId()
    return await db
      .insertInto("user")
      .values({
        id: userId,
        password_hash: await hashPassword(params.password),
        email: params.email,
        metadata: params.metadata ?? null,
      })
      .returningAll()
      .executeTakeFirst()
  }

  async updateUserPassword(params: { userId: string; password: string }) {
    await db
      .updateTable("user")
      .set({ password_hash: await hashPassword(params.password), updated_at: new Date() })
      .where("id", "=", params.userId)
      .execute()
    return { success: true }
  }

  async updateUserVerifiedEmail(params: { userId: string }) {
    await db
      .updateTable("user")
      .set({ email_verified: true, updated_at: new Date() })
      .where("id", "=", params.userId)
      .execute()
    return { success: true }
  }

  async updateUserMetadata(params: { userId: string; metadata?: Partial<UserMetaDTO> }) {
    const updates: Partial<{ metadata: any; updated_at: Date }> = { updated_at: new Date() }

    if (params.metadata !== undefined) {
      const current = await db
        .selectFrom("user")
        .select("metadata")
        .where("id", "=", params.userId)
        .executeTakeFirst()

      const existingMeta = current?.metadata
        ? assertDTO(jsonDecode(current.metadata), userMetaDTO)
        : ({} as UserMetaDTO)

      updates.metadata = { ...existingMeta, ...params.metadata }
    }

    await db.updateTable("user").set(updates).where("id", "=", params.userId).execute()
    return { success: true }
  }

  // ===========================================================================
  // OAuth
  // ===========================================================================
  private async createUserFromOAuth(params: { provider: string; providerUserId: string; email: string; metadata?: UserMetaDTO }) {
    const userId = generateId()

    return await db.transaction().execute(async (trx) => {
      const [newUser] = await trx
        .insertInto("user")
        .values({
          id: userId,
          email: params.email,
          email_verified: true,
          password_hash: await hashPassword(generateId()),
          metadata: params.metadata ?? null,
        })
        .returningAll()
        .execute()

      await trx
        .insertInto("oauth_account")
        .values({
          provider_id: params.provider,
          provider_user_id: params.providerUserId,
          user_id: userId,
        })
        .execute()

      return newUser
    })
  }

  private async linkOAuthAccount(params: { userId: string; providerId: string; providerUserId: string }) {
    await db
      .insertInto("oauth_account")
      .values({ provider_id: params.providerId, provider_user_id: params.providerUserId, user_id: params.userId })
      .execute()
    return { success: true }
  }

  private async getOAuthAccount(provider: string, providerUserId: string) {
    return await db
      .selectFrom("oauth_account")
      .selectAll()
      .where("provider_id", "=", provider)
      .where("provider_user_id", "=", providerUserId)
      .executeTakeFirst()
  }

  async getOrCreateUserIdForOAuth(params: { provider: string; providerUserId: string; email: string; metadata?: UserMetaDTO }): Promise<string> {
    const existingAccount = await this.getOAuthAccount(params.provider, params.providerUserId)
    if (existingAccount) return existingAccount.user_id

    const existingUser = await this.getUserByEmail(params.email)
    if (existingUser) {
      await this.linkOAuthAccount({ providerId: params.provider, providerUserId: params.providerUserId, userId: existingUser.id })
      return existingUser.id
    }

    const newUser = await this.createUserFromOAuth(params)
    return newUser.id
  }

  // ===========================================================================
  // One-Time Tokens (magic link, OTP, forgot password, email verify)
  // ===========================================================================
  async getOrCreateUserFromEmail(email: string, metadata?: UserMetaDTO) {
    const existingUser = await this.getUserByEmail(email)
    if (existingUser) return existingUser

    const userId = generateId()
    return await db
      .insertInto("user")
      .values({
        id: userId,
        email,
        email_verified: false,
        password_hash: await hashPassword(generateId()),
        metadata: metadata ?? null,
      })
      .returningAll()
      .executeTakeFirst()
  }

  async createOneTimeToken(params: {
    token?: string
    identifier: string
    purpose: string
    expiresInSeconds?: number
    tokenType?: "token" | "shortcode"
    metadata?: Record<string, any>
  }) {
    const expiresAt = new Date(Date.now() + (params.expiresInSeconds ?? 300) * 1000)
    const token = params.token ?? generateUniqueToken()
    const code = params.tokenType === "shortcode" ? generateUniqueCode() : undefined

    const result = await db
      .insertInto("onetime_token")
      .values({ token, code, expires_at: expiresAt, identifier: params.identifier, purpose: params.purpose, metadata: params.metadata ?? null })
      .returning(["token", "code"])
      .executeTakeFirst()

    if (!result) throw new Error("Failed to create one-time token")
    return result.code ?? result.token
  }

  async consumeOneTimeToken(params: { token?: string; code?: string; identifier?: string; purpose?: string }) {
    if (!params.token && !params.code) {
      return { consumed: false, identifier: undefined, metadata: undefined }
    }

    return await db.transaction().execute(async (trx) => {
      let query = trx
        .selectFrom("onetime_token")
        .selectAll()
        .where("expires_at", ">", new Date())

      if (params.token) {
        query = query.where("token", "=", params.token)
      } else if (params.code && params.identifier) {
        query = query.where("code", "=", params.code).where("identifier", "=", params.identifier)
      } else {
        return { consumed: false, identifier: undefined, metadata: undefined }
      }

      if (params.purpose) {
        query = query.where("purpose", "=", params.purpose)
      }

      const tokenRow = await query.executeTakeFirst()
      if (!tokenRow) return { consumed: false, identifier: undefined, metadata: undefined }

      await trx.deleteFrom("onetime_token").where("token", "=", tokenRow.token).execute()

      return { consumed: true, identifier: tokenRow.identifier, metadata: tokenRow.metadata }
    })
  }

  async getOneTimeToken(token: string) {
    return await db
      .selectFrom("onetime_token")
      .selectAll()
      .where("token", "=", token)
      .executeTakeFirst()
  }

  async getActiveOneTimeTokenByIdentifierAndPurpose(identifier: string, purpose: string) {
    return await db
      .selectFrom("onetime_token")
      .selectAll()
      .where("identifier", "=", identifier)
      .where("purpose", "=", purpose)
      .where("expires_at", ">", new Date())
      .orderBy("expires_at", "desc")
      .executeTakeFirst()
  }

  async deleteOneTimeTokensByIdentifierAndPurpose(identifier: string, purpose: string) {
    await db
      .deleteFrom("onetime_token")
      .where("identifier", "=", identifier)
      .where("purpose", "=", purpose)
      .execute()
  }

  // ===========================================================================
  // Passkeys
  // ===========================================================================
  async getPasskeysByUserId(userId: string) {
    return await db.selectFrom("passkey").selectAll().where("user_id", "=", userId).execute()
  }

  async getPasskeyByCredentialId(credentialId: string) {
    return await db.selectFrom("passkey").selectAll().where("credential_id", "=", credentialId).executeTakeFirst()
  }

  async createPasskey(params: { userId: string; credentialId: string; publicKey: Buffer; counter: bigint; name?: string | null }) {
    return await db
      .insertInto("passkey")
      .values({
        id: generateId(),
        user_id: params.userId,
        credential_id: params.credentialId,
        public_key: params.publicKey,
        counter: params.counter,
        name: params.name ?? null,
      })
      .returningAll()
      .executeTakeFirst()
  }

  async updatePasskeyCounter(id: string, counter: bigint) {
    await db.updateTable("passkey").set({ counter }).where("id", "=", id).execute()
  }
}
