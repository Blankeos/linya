import { batch, createMemo, createSignal, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { navigate } from "vike/client/router"
import getTitle from "@/utils/get-title"
import { useAuthContext } from "@/context/auth.context"
import { honoClient } from "@/lib/hono-client"

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
}

export default function OnboardingPage() {
  useMetadata({ title: getTitle("Create your workspace") })
  const auth = useAuthContext()

  const [workspaceName, setWorkspaceName] = createSignal("")
  const [workspaceSlug, setWorkspaceSlug] = createSignal("")
  const [slugEdited, setSlugEdited] = createSignal(false)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal("")

  const displaySlug = createMemo(() => {
    if (slugEdited()) return workspaceSlug()
    return slugify(workspaceName())
  })

  const handleCreateWorkspace = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!workspaceName().trim()) return

    setLoading(true)
    setError("")
    try {
      const slug = displaySlug() || slugify(workspaceName())
      const client = honoClient()

      const wsRes = await client.workspaces.$post({
        json: { name: workspaceName(), slug },
      })
      if (!wsRes.ok) throw new Error("Failed to create workspace")

      navigate(`/${slug}/welcome`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div class="dark">
      {/* Background gradient — matches login */}
      <div class="fixed inset-0 bg-[#0d0d0d] overflow-hidden">
        <svg
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[60%] opacity-60 pointer-events-none select-none"
          width="800"
          height="800"
          viewBox="0 0 800 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="g1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#5E6AD2" stop-opacity="0.25" />
              <stop offset="100%" stop-color="#5E6AD2" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="g2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.12" />
              <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="400" cy="400" rx="400" ry="320" fill="url(#g1)" />
          <ellipse cx="460" cy="360" rx="260" ry="210" fill="url(#g2)" />
        </svg>
      </div>

      {/* Content */}
      <div class="relative flex min-h-screen flex-col items-center justify-center px-4">
        <div class="w-[320px] flex flex-col items-center">

          {/* Logo */}
          <LinyaLogo />

          {/* Heading */}
          <h1 class="mt-6 text-[18px] font-medium leading-normal tracking-normal text-[rgb(226,227,229)]">
            Create a workspace
          </h1>
          <p class="mt-1.5 text-center text-[13px] text-[rgb(147,148,150)]">
            A shared space for your team to track<br />projects, cycles, and issues.
          </p>

          {/* Form */}
          <form onSubmit={handleCreateWorkspace} class="mt-6 flex w-full flex-col gap-3">
            {/* Workspace Name */}
            <div class="flex flex-col gap-1.5">
              <label class="text-[12px] font-medium text-[rgb(147,148,150)]">Workspace name</label>
              <input
                type="text"
                placeholder="e.g. Acme Inc."
                value={workspaceName()}
                onInput={(e) => {
                  setWorkspaceName(e.currentTarget.value)
                  if (!slugEdited()) setWorkspaceSlug("")
                }}
                required
                autofocus
                class="h-11 w-full rounded-lg border-0 bg-[#1c1c1d] px-3.5 text-[13px] text-[rgb(226,227,229)] placeholder:text-[rgb(147,148,150)] outline-none transition focus:ring-1 focus:ring-[#5E6AD2]"
                style="box-shadow: rgba(255,255,255,0.133) 0px 0px 0px 0.5px, rgba(0,0,0,0.08) 0px 1px 1px 0px"
              />
            </div>

            {/* Workspace URL */}
            <div class="flex flex-col gap-1.5">
              <label class="text-[12px] font-medium text-[rgb(147,148,150)]">Workspace URL</label>
              <div
                class="flex h-11 w-full overflow-hidden rounded-lg transition focus-within:ring-1 focus-within:ring-[#5E6AD2]"
                style="box-shadow: rgba(255,255,255,0.133) 0px 0px 0px 0.5px, rgba(0,0,0,0.08) 0px 1px 1px 0px"
              >
                <span class="flex items-center bg-[#161617] px-3 text-[12px] text-[rgb(100,101,104)] border-r border-[rgba(255,255,255,0.08)] shrink-0 select-none">
                  linya.app/
                </span>
                <input
                  type="text"
                  placeholder="acme-inc"
                  value={displaySlug()}
                  onInput={(e) => {
                    const value = e.currentTarget.value
                    batch(() => {
                      setSlugEdited(true)
                      setWorkspaceSlug(slugify(value))
                    })
                  }}
                  class="flex-1 bg-[#1c1c1d] px-3 text-[13px] text-[rgb(226,227,229)] placeholder:text-[rgb(100,101,104)] outline-none"
                />
              </div>
            </div>

            <Show when={error()}>
              <p class="rounded-lg bg-red-500/10 px-3.5 py-2.5 text-[12px] text-red-400">
                {error()}
              </p>
            </Show>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading() || !workspaceName().trim()}
              class="mt-1 flex h-11 w-full items-center justify-center rounded-lg bg-[#5E6AD2] px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#6974E1] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading() ? "Creating…" : "Create workspace"}
            </button>
          </form>

          {/* Logged in as */}
          <p class="mt-6 text-center text-[12px] text-[rgb(100,101,104)]">
            Signed in as{" "}
            <span class="text-[rgb(147,148,150)]">{auth.user()?.email}</span>
          </p>

        </div>
      </div>
    </div>
  )
}

function LinyaLogo() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" fill="#5E6AD2" />
      <path d="M14 12 L14 32 L20 38 L20 18 Z" fill="white" opacity="0.9" />
      <path d="M20 32 L34 36 L34 30 L20 26 Z" fill="white" opacity="0.7" />
    </svg>
  )
}
