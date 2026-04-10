import { hash, verify } from "@node-rs/argon2"
import { createId } from "@paralleldrive/cuid2"
import { SignJWT, jwtVerify } from "jose"
import type { Context } from "hono"
import { privateEnv } from "@/env.private"
import { publicEnv } from "@/env.public"
import { ApiError } from "@/server/lib/error"
import { AUTH_CONFIG } from "./auth.config"

// ===========================================================================
// Password
// ===========================================================================
export async function hashPassword(password: string) {
  return hash(password, { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 })
}

export async function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password, { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 })
}

// ===========================================================================
// IDs & Tokens
// ===========================================================================
export function generateId() {
  return createId()
}

export function generateUniqueToken() {
  return createId()
}

export function generateUniqueCode() {
  const min = 100000
  const max = 999999
  const range = max - min + 1
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return ((array[0] % range) + min).toString()
}

export function generateRefreshToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("")
}

// ===========================================================================
// JWT (Access Token)
// ===========================================================================
function getJwtSecret() {
  return new TextEncoder().encode(privateEnv.JWT_SECRET)
}

export type AccessTokenPayload = {
  sub: string  // userId
  jti: string  // unique token ID
}

export async function createAccessToken(userId: string): Promise<string> {
  const expiresInSeconds = AUTH_CONFIG.accessToken.expiresInMinutes * 60
  return new SignJWT({ sub: userId, jti: generateId() })
    .setProtectedHeader({ alg: "HS256", kid: "linya-v1" })
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .setAudience(publicEnv.PUBLIC_POWERSYNC_URL) // same token works for PowerSync
    .sign(getJwtSecret())
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as unknown as AccessTokenPayload
  } catch {
    return null
  }
}

// ===========================================================================
// Refresh Token Cookie
// ===========================================================================
export function setRefreshTokenCookie(context: Context, token: string): void {
  const maxAge = AUTH_CONFIG.refreshToken.expiresInDays * 24 * 60 * 60
  const cookieName = AUTH_CONFIG.refreshToken.cookieName
  const secure = privateEnv.NODE_ENV === "production" ? "; Secure" : ""
  context.header(
    "Set-Cookie",
    `${cookieName}=${token}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Path=/${secure}`,
    { append: true }
  )
}

export function deleteRefreshTokenCookie(context: Context): void {
  const cookieName = AUTH_CONFIG.refreshToken.cookieName
  const secure = privateEnv.NODE_ENV === "production" ? "; Secure" : ""
  context.header(
    "Set-Cookie",
    `${cookieName}=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/${secure}`
  )
}

// ===========================================================================
// OAuth helpers
// ===========================================================================
function normalizeUrlOrPath(input?: string): string {
  if (!input) return publicEnv.PUBLIC_BASE_URL
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(input)) return input
  const path = input.startsWith("/") ? input : `/${input}`
  return `${publicEnv.PUBLIC_BASE_URL.replace(/\/$/, "")}${path}`
}

function globToRegex(pattern: string): RegExp {
  const regex = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\0GLOB_DOUBLE_STAR\0")
    .replace(/\*/g, "[^/]*")
    .replace(/\0GLOB_DOUBLE_STAR\0/g, ".*?")
    .replace(/\/\.\*\?$/, "(?:/.*)?")
  return new RegExp(`^${regex}$`)
}

function isAllowedOAuthRedirectUrl(url: string): boolean {
  return AUTH_CONFIG.oauthRedirectUrls.allowed.some((pattern) => globToRegex(pattern).test(url))
}

export function getOAuthRedirectUrl(
  redirectUrl?: string,
  options: { allowDefaultRedirect?: boolean; defaultRedirectUrl?: string } = {}
): string {
  const normalizedUrl = normalizeUrlOrPath(redirectUrl)

  if (isAllowedOAuthRedirectUrl(normalizedUrl)) return normalizedUrl

  if (!options.allowDefaultRedirect) {
    throw ApiError.BadRequest("Invalid redirect URL.")
  }

  const normalizedDefault = normalizeUrlOrPath(options.defaultRedirectUrl ?? "/")
  if (isAllowedOAuthRedirectUrl(normalizedDefault)) return normalizedDefault

  return publicEnv.PUBLIC_BASE_URL
}

// ===========================================================================
// Request metadata
// ===========================================================================
export function getClientIP(c: Context): string | null {
  const candidates = [
    (c.req as any).ip,
    (c.env as any)?.remoteAddr,
    (c.req.raw as any)?.remoteAddress,
    (c.req.raw as any)?.socket?.remoteAddress,
  ]

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") continue
    const ip = candidate.split(",")[0].trim().replace(/^::ffff:/, "")
    if (isValidIP(ip)) return ip
  }

  return null
}

function isValidIP(ip: string): boolean {
  if (ip === "::1" || ip === "127.0.0.1" || ip === "localhost") return false
  const ipv4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/
  return ipv4.test(ip)
}

export function getSimpleDeviceName(userAgent: string | null): string {
  if (!userAgent) return "Unknown Device"
  if (/android/i.test(userAgent)) return "Android"
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS"
  if (/macintosh|mac os/i.test(userAgent)) return "Mac"
  if (/windows/i.test(userAgent)) return "Windows"
  if (/linux/i.test(userAgent)) return "Linux"
  return "Device"
}

export function jsonDecode(input: any): any {
  if (typeof input === "string") return JSON.parse(input)
  return input
}
