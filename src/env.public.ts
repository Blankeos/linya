import { createEnv } from "@t3-oss/env-core"
import z from "zod"

export const publicEnv = createEnv({
  clientPrefix: "PUBLIC_",
  client: {
    PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
    PUBLIC_POWERSYNC_URL: z.string().default("http://localhost:8080"),
  },
  runtimeEnvStrict: {
    PUBLIC_BASE_URL: import.meta.env.PUBLIC_BASE_URL,
    PUBLIC_POWERSYNC_URL: import.meta.env.PUBLIC_POWERSYNC_URL,
    NODE_ENV: import.meta.env.NODE_ENV,
  },
  server: {
    NODE_ENV: z.enum(["development", "production"]).default("development"),
  },
})
