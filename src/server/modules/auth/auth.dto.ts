import type { Selectable } from "kysely"
import z from "zod"
import { publicEnv } from "@/env.public"
import { initHonoClient } from "@/lib/hono-client"
import type { User } from "@/server/db/types"
import { assertDTO } from "@/server/utils/assert-dto"
import { jsonDecode } from "./auth.utilities"

// ===========================================================================
// SERVER ONLY
// ===========================================================================

const _baseUserMetaDTO = z.object({
  display_name: z.string().optional(),
  avatar_url: z.string().optional(),
  avatar_object_id: z.string().optional(),
})

export const userMetaClientInputDTO = _baseUserMetaDTO.omit({ avatar_url: true })
export type UserMetaClientInputDTO = z.infer<typeof userMetaClientInputDTO>

export const userMetaDTO = _baseUserMetaDTO.optional().nullable()
export type UserMetaDTO = z.infer<typeof userMetaDTO>

export type InternalUserDTO = Selectable<User>

// ===========================================================================
// CLIENT AND SERVER
// ===========================================================================

export async function getUserResponseDTO(user: InternalUserDTO) {
  const userMeta = user.metadata
    ? assertDTO(jsonDecode(user.metadata), userMetaDTO)
    : undefined

  return {
    id: user.id,
    email: user.email,
    email_verified: user.email_verified,
    display_name: user.display_name,
    joined_at: user.joined_at,
    updated_at: user.updated_at,
    metadata: await getUserResponseMetaDTO(userMeta),
  }
}
export type UserResponseDTO = Awaited<ReturnType<typeof getUserResponseDTO>>

export async function getUserResponseMetaDTO(
  userMeta: UserMetaDTO
): Promise<{ display_name?: string; avatar_url?: string }> {
  const avatar_url: string | undefined = userMeta?.avatar_object_id
    ? initHonoClient(publicEnv.PUBLIC_BASE_URL)
        .auth.profile.avatar[":uniqueId"].$url({ param: { uniqueId: userMeta.avatar_object_id } })
        ?.toString()
    : userMeta?.avatar_url

  return {
    display_name: userMeta?.display_name,
    avatar_url,
  }
}

export const passwordDTO = z.string().min(8, "Password must be at least 8 characters long")
