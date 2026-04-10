import { createEnv } from "@t3-oss/env-core"
import z from "zod"

export const privateEnv = createEnv({
  runtimeEnv: process.env,
  server: {
    PORT: z.preprocess(Number, z.number()).default(3000),
    NODE_ENV: z.enum(["development", "production"]).default("development"),

    // Database
    DATABASE_URL: z.string(),

    // Auth JWT
    JWT_SECRET: z.string(),
    /** Refresh token expires in days */
    REFRESH_TOKEN_EXPIRES_DAYS: z.preprocess(Number, z.number()).default(7),
    /** Access token expires in minutes */
    ACCESS_TOKEN_EXPIRES_MINUTES: z.preprocess(Number, z.number()).default(15),

    // OAuth
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    // S3 (optional — defaults to filesystem)
    S3_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_BUCKET_NAME: z.string().default("linya"),
    S3_REGION: z.string().default("auto"),

    // Filesystem storage (when S3 not configured)
    STORAGE_LOCAL_PATH: z.string().default("./uploads"),

    // Email — SMTP (optional)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.preprocess(Number, z.number()).optional(),
    SMTP_SECURE: z
      .preprocess((val) => String(val).toLowerCase() === "true", z.boolean())
      .optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),

    // Email — API (optional alternative to SMTP)
    ZEPTOMAIL_TOKEN: z.string().optional(),
    ZEPTOMAIL_FROM: z
      .string()
      .refine((val) => /^[^<]*\s<[^>]+>$/.test(val), {
        message: 'Must be in "Name <email@example.com>" format',
      })
      .optional(),

    // WebAuthn (Passkeys)
    WEBAUTHN_RP_NAME: z.string().default("Linya"),
    WEBAUTHN_RP_ID: z.string().default("localhost"),
    WEBAUTHN_ORIGIN: z.string().default("http://localhost:3000"),
  },
})
