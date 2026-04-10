import { batch, createEffect, createMemo, createSignal, Show } from "solid-js"
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

function toIdentifier(text: string) {
  // Take initials of words, up to 5 chars, uppercase
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 5).toUpperCase()
  return words
    .slice(0, 5)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

export default function OnboardingPage() {
  useMetadata({ title: getTitle("Create your workspace") })
  const auth = useAuthContext()

  // Step 1 — workspace
  const [step, setStep] = createSignal<1 | 2>(1)
  const [workspaceName, setWorkspaceName] = createSignal("")
  const [workspaceSlug, setWorkspaceSlug] = createSignal("")
  const [slugEdited, setSlugEdited] = createSignal(false)

  // Stored after step 1 completes
  const [createdWorkspaceId, setCreatedWorkspaceId] = createSignal("")
  const [createdWorkspaceSlug, setCreatedWorkspaceSlug] = createSignal("")

  // Step 2 — team
  const [teamName, setTeamName] = createSignal("")
  const [teamIdentifier, setTeamIdentifier] = createSignal("")
  const [identifierEdited, setIdentifierEdited] = createSignal(false)

  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal("")

  createEffect(async () => {
    if (auth.loading()) return
    if (!auth.user()) return
    try {
      const client = honoClient()
      const res = await client.workspaces.$get()
      if (!res.ok) return
      const data = await res.json()
      const first = (data as any).workspaces?.[0]
      if (!first) return

      // Workspace exists — check if they have a team already
      const teamsRes = await (client.workspaces as any)[":workspaceId"].teams.$get({
        param: { workspaceId: first.id },
      })
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json()
        if ((teamsData as any).teams?.length > 0) {
          // Fully onboarded — get out of here
          navigate(`/${first.slug}/my-issues`)
          return
        }
      }

      // Has workspace but no team — resume at step 2
      setCreatedWorkspaceId(first.id)
      setCreatedWorkspaceSlug(first.slug)
      setStep(2)
    } catch {}
  })

  const displaySlug = createMemo(() => {
    if (slugEdited()) return workspaceSlug()
    return slugify(workspaceName())
  })

  const displayIdentifier = createMemo(() => {
    if (identifierEdited()) return teamIdentifier()
    return toIdentifier(teamName())
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

      const wsData = await wsRes.json()
      setCreatedWorkspaceId((wsData as any).workspace?.id ?? "")
      setCreatedWorkspaceSlug(slug)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTeam = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!teamName().trim()) return

    setLoading(true)
    setError("")
    try {
      const identifier = displayIdentifier() || toIdentifier(teamName())
      const client = honoClient()

      const teamRes = await (client.workspaces as any)[":workspaceId"].teams.$post({
        param: { workspaceId: createdWorkspaceId() },
        json: { name: teamName(), identifier },
      })
      if (!teamRes.ok) throw new Error("Failed to create team")

      navigate(`/${createdWorkspaceSlug()}/welcome`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div class="dark">
      {/* Background gradient */}
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

      {/* Step dots */}
      <div class="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {([1, 2] as const).map((s) => (
          <div
            class={`h-1.5 rounded-full transition-all duration-300 ${
              step() === s
                ? "bg-[#5E6AD2] w-6"
                : step() > s
                  ? "bg-[#5E6AD2]/50 w-1.5"
                  : "bg-[rgba(255,255,255,0.15)] w-1.5"
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div class="relative flex min-h-screen flex-col items-center justify-center px-4">
        <div class="w-[320px] flex flex-col items-center">

          <LinyaLogo />

          {/* ── Step 1: Workspace ── */}
          <Show when={step() === 1}>
            <h1 class="mt-6 text-[18px] font-medium leading-normal tracking-normal text-[rgb(226,227,229)]">
              Create a workspace
            </h1>
            <p class="mt-1.5 text-center text-[13px] text-[rgb(147,148,150)]">
              A shared space for your team to track<br />projects, cycles, and issues.
            </p>

            <form onSubmit={handleCreateWorkspace} class="mt-6 flex w-full flex-col gap-3">
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
                <p class="rounded-lg bg-red-500/10 px-3.5 py-2.5 text-[12px] text-red-400">{error()}</p>
              </Show>

              <button
                type="submit"
                disabled={loading() || !workspaceName().trim()}
                class="mt-1 flex h-11 w-full items-center justify-center rounded-lg bg-[#5E6AD2] px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#6974E1] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading() ? "Creating…" : "Continue"}
              </button>
            </form>

            <p class="mt-6 text-center text-[12px] text-[rgb(100,101,104)]">
              Signed in as{" "}
              <span class="text-[rgb(147,148,150)]">{auth.user()?.email}</span>
            </p>
          </Show>

          {/* ── Step 2: Team ── */}
          <Show when={step() === 2}>
            <h1 class="mt-6 text-[18px] font-medium leading-normal tracking-normal text-[rgb(226,227,229)]">
              Create your first team
            </h1>
            <p class="mt-1.5 text-center text-[13px] text-[rgb(147,148,150)]">
              Teams organize issues and projects.<br />You can add more teams later.
            </p>

            <form onSubmit={handleCreateTeam} class="mt-6 flex w-full flex-col gap-3">
              <div class="flex flex-col gap-1.5">
                <label class="text-[12px] font-medium text-[rgb(147,148,150)]">Team name</label>
                <input
                  type="text"
                  placeholder="e.g. Engineering"
                  value={teamName()}
                  onInput={(e) => {
                    setTeamName(e.currentTarget.value)
                    if (!identifierEdited()) setTeamIdentifier("")
                  }}
                  required
                  autofocus
                  class="h-11 w-full rounded-lg border-0 bg-[#1c1c1d] px-3.5 text-[13px] text-[rgb(226,227,229)] placeholder:text-[rgb(147,148,150)] outline-none transition focus:ring-1 focus:ring-[#5E6AD2]"
                  style="box-shadow: rgba(255,255,255,0.133) 0px 0px 0px 0.5px, rgba(0,0,0,0.08) 0px 1px 1px 0px"
                />
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-[12px] font-medium text-[rgb(147,148,150)]">
                  Identifier
                  <span class="ml-1.5 text-[rgb(100,101,104)] font-normal">· used to prefix issue IDs like ENG-1</span>
                </label>
                <input
                  type="text"
                  placeholder="ENG"
                  value={displayIdentifier()}
                  onInput={(e) => {
                    const value = e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
                    batch(() => {
                      setIdentifierEdited(true)
                      setTeamIdentifier(value)
                    })
                  }}
                  required
                  class="h-11 w-full rounded-lg border-0 bg-[#1c1c1d] px-3.5 text-[13px] font-mono tracking-widest text-[rgb(226,227,229)] placeholder:text-[rgb(147,148,150)] placeholder:tracking-normal outline-none transition focus:ring-1 focus:ring-[#5E6AD2]"
                  style="box-shadow: rgba(255,255,255,0.133) 0px 0px 0px 0.5px, rgba(0,0,0,0.08) 0px 1px 1px 0px"
                />
              </div>

              <Show when={error()}>
                <p class="rounded-lg bg-red-500/10 px-3.5 py-2.5 text-[12px] text-red-400">{error()}</p>
              </Show>

              <button
                type="submit"
                disabled={loading() || !teamName().trim() || !displayIdentifier().trim()}
                class="mt-1 flex h-11 w-full items-center justify-center rounded-lg bg-[#5E6AD2] px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#6974E1] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading() ? "Creating…" : "Create team"}
              </button>

            </form>
          </Show>

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
