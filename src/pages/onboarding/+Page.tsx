import { createMemo, createSignal, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
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

function identifierify(text: string) {
  return text
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5)
}

export default function OnboardingPage() {
  useMetadata({ title: getTitle("Create your workspace") })
  const auth = useAuthContext()

  const [step, setStep] = createSignal<1 | 2>(1)
  const [workspaceName, setWorkspaceName] = createSignal("")
  const [workspaceSlug, setWorkspaceSlug] = createSignal("")
  const [slugEdited, setSlugEdited] = createSignal(false)
  const [teamName, setTeamName] = createSignal("")
  const [teamIdentifier, setTeamIdentifier] = createSignal("")
  const [identifierEdited, setIdentifierEdited] = createSignal(false)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal("")

  const autoSlug = createMemo(() => slugify(workspaceName()))
  const autoIdentifier = createMemo(() => identifierify(teamName()))
  const displaySlug = createMemo(() => (slugEdited() ? workspaceSlug() : autoSlug()))
  const displayIdentifier = createMemo(() => (identifierEdited() ? teamIdentifier() : autoIdentifier()))

  const handleWorkspaceNext = (e: SubmitEvent) => {
    e.preventDefault()
    if (!workspaceName().trim()) return
    setStep(2)
  }

  const handleTeamSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!teamName().trim()) return
    setLoading(true)
    setError("")
    try {
      const slug = displaySlug() || slugify(workspaceName())
      const client = honoClient()
      // Create workspace
      const wsRes = await client.workspaces.$post({
        json: { name: workspaceName(), slug },
      })
      if (!wsRes.ok) throw new Error("Failed to create workspace")
      const wsData = await wsRes.json()
      const workspace = (wsData as any).workspace

      // Create team within workspace
      const teamRes = await (client.workspaces as any)[":workspaceId"].teams.$post({
        param: { workspaceId: workspace.id },
        json: {
          name: teamName(),
          identifier: displayIdentifier() || identifierify(teamName()),
        },
      })
      if (!teamRes.ok) throw new Error("Failed to create team")

      window.location.href = `/${slug}/my-issues`
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div class="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-12">
      <div class="mb-8">
        <LinyaLogo />
      </div>

      <div class="flex items-center gap-2 mb-8">
        <StepDot active={step() === 1} done={step() > 1} label="1" />
        <div class="w-8 h-px bg-border" />
        <StepDot active={step() === 2} done={false} label="2" />
      </div>

      <div class="w-full max-w-[420px] bg-card border border-border rounded-xl p-8 space-y-6 shadow-lg">
        <Show when={step() === 1}>
          <div>
            <h1 class="text-[20px] font-semibold tracking-[-0.01em] text-foreground mb-1">
              Create your workspace
            </h1>
            <p class="text-[13px] text-muted-foreground">
              A workspace is your shared environment for all your teams and projects.
            </p>
          </div>

          <form onSubmit={handleWorkspaceNext} class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                Workspace name
              </label>
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
                class="w-full rounded-md border border-border bg-secondary/20 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring focus:border-ring transition"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                URL slug
              </label>
              <div class="flex rounded-md border border-border bg-secondary/20 overflow-hidden focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition">
                <span class="flex items-center px-3 text-[12px] text-muted-foreground/60 border-r border-border bg-secondary/30 shrink-0">
                  linya.app/
                </span>
                <input
                  type="text"
                  placeholder="acme-inc"
                  value={displaySlug()}
                  onInput={(e) => {
                    setSlugEdited(true)
                    setWorkspaceSlug(slugify(e.currentTarget.value))
                  }}
                  class="flex-1 px-3 py-2.5 text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50"
                />
              </div>
              <Show when={displaySlug()}>
                <p class="text-[11px] text-muted-foreground/50">
                  Your workspace will be at{" "}
                  <span class="text-muted-foreground font-mono">linya.app/{displaySlug()}</span>
                </p>
              </Show>
            </div>

            <button
              type="submit"
              class="w-full rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Continue
            </button>
          </form>
        </Show>

        <Show when={step() === 2}>
          <div>
            <h1 class="text-[20px] font-semibold tracking-[-0.01em] text-foreground mb-1">
              Create your first team
            </h1>
            <p class="text-[13px] text-muted-foreground">
              Teams organize your work. You can add more teams later.
            </p>
          </div>

          <form onSubmit={handleTeamSubmit} class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                Team name
              </label>
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
                class="w-full rounded-md border border-border bg-secondary/20 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring focus:border-ring transition"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                Identifier
              </label>
              <input
                type="text"
                placeholder="e.g. ENG"
                value={displayIdentifier()}
                onInput={(e) => {
                  setIdentifierEdited(true)
                  setTeamIdentifier(identifierify(e.currentTarget.value))
                }}
                maxLength={5}
                class="w-full rounded-md border border-border bg-secondary/20 px-3.5 py-2.5 text-[13px] text-foreground font-mono placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring focus:border-ring transition"
              />
              <Show when={displayIdentifier()}>
                <p class="text-[11px] text-muted-foreground/50">
                  Issues will be prefixed with{" "}
                  <span class="text-muted-foreground font-mono">{displayIdentifier()}-1</span>
                </p>
              </Show>
            </div>

            <Show when={error()}>
              <p class="text-[12px] text-destructive">{error()}</p>
            </Show>

            <div class="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                class="flex-1 rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading()}
                class="flex-1 rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading() ? "Creating…" : "Create workspace"}
              </button>
            </div>
          </form>
        </Show>
      </div>

      <p class="mt-4 text-[12px] text-muted-foreground/50">Step {step()} of 2</p>
    </div>
  )
}

function StepDot(props: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      class={`size-7 rounded-full flex items-center justify-center text-[12px] font-semibold transition-colors ${
        props.active
          ? "bg-primary text-primary-foreground"
          : props.done
            ? "bg-success/20 text-success"
            : "bg-secondary text-muted-foreground"
      }`}
    >
      {props.done ? <CheckIcon class="size-3.5" /> : props.label}
    </div>
  )
}

function LinyaLogo() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#5E6AD2" />
      <path d="M14 12 L14 32 L20 38 L20 18 Z" fill="white" opacity="0.9" />
      <path d="M20 32 L34 36 L34 30 L20 26 Z" fill="white" opacity="0.7" />
    </svg>
  )
}

function CheckIcon(props: { class?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
      class={props.class} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
