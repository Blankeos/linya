import { createEffect } from "solid-js"
import { navigate } from "vike/client/router"
import { useMetadata } from "vike-metadata-solid"
import { useAuthContext } from "@/context/auth.context"
import { honoClient } from "@/lib/hono-client"
import getTitle from "@/utils/get-title"
export default function Page() {
  useMetadata({ title: getTitle("Home") })

  const auth = useAuthContext()

  createEffect(() => {
    if (auth.loading()) return
    if (auth.user()) {
      // Check if user already has a workspace; if so, go there directly
      honoClient().workspaces.$get().then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          const first = (data as any).workspaces?.[0]
          if (first?.slug) {
            navigate(`/${first.slug}/my-issues`)
            return
          }
        }
        navigate("/onboarding")
      }).catch(() => navigate("/onboarding"))
    } else {
      // Preserve ?error= from OAuth callbacks so the login page can display it
      const errorParam = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("error")
        : null
      const target = errorParam ? `/login?error=${encodeURIComponent(errorParam)}` : "/login"
      navigate(target)
    }
  })

  return null
}
