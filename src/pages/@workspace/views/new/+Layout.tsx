import {
  createContext,
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  useContext,
  type JSX,
} from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { navigate } from "vike/client/router"
import { honoClient } from "@/lib/hono-client"
import { PillTabs } from "@/components/pill-tabs"
import getTitle from "@/utils/get-title"

// Shared state context
type ViewType = "issues" | "projects"

type NewViewContextType = {
  viewName: () => string
  setViewName: (value: string) => void
  viewDescription: () => string
  setViewDescription: (value: string) => void
  isCreating: () => boolean
  setIsCreating: (value: boolean) => void
  workspaceId: () => string | null
  saveView: () => Promise<void>
  workspaceSlug: () => string
  viewType: () => ViewType
}

const NewViewContext = createContext<NewViewContextType>()

export function useNewView() {
  const ctx = useContext(NewViewContext)
  if (!ctx) throw new Error("useNewView must be used within NewViewLayout")
  return ctx
}

interface NewViewLayoutProps {
  children: JSX.Element
}

export default function NewViewLayout(props: NewViewLayoutProps) {
  const pageCtx = usePageContext()
  useMetadata({ title: getTitle("New View") })

  const workspaceSlug = () => (pageCtx.routeParams as Record<string, string>).workspace ?? ""
  const viewType = () => {
    const type = (pageCtx.routeParams as Record<string, string>).viewType
    return type === "projects" ? "projects" : "issues"
  }

  const [viewName, setViewName] = createSignal("")
  const [viewDescription, setViewDescription] = createSignal("")
  const [isCreating, setIsCreating] = createSignal(false)
  const [workspaceId, setWorkspaceId] = createSignal<string | null>(null)

  // Esc key: blur focused input on first press, navigate back on second press
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return
    const active = document.activeElement
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      ;(active as HTMLElement).blur()
      return
    }
    navigate(`/${workspaceSlug()}/views/${viewType()}`)
  }

  onMount(() => document.addEventListener("keydown", handleKeyDown))
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown))

  // Load workspace ID
  createEffect(() => {
    if (workspaceId()) return
    const load = async () => {
      try {
        const client = honoClient()
        const res = await client.workspaces.$get()
        if (!res.ok) return
        const data = await res.json()
        const ws = (data as any).workspaces?.find((w: any) => w.slug === workspaceSlug())
        if (ws) setWorkspaceId(ws.id)
      } catch {}
    }
    load()
  })

  const saveView = async () => {
    if (!viewName().trim() || !workspaceId()) return
    const type = viewType()
    try {
      setIsCreating(true)
      const client = honoClient()
      const res = await (client.workspaces as any)[":workspaceId"].views.$post({
        param: { workspaceId: workspaceId()! },
        json: {
          name: viewName(),
          description: viewDescription() || undefined,
          type: type === "issues" ? "issue" : "project",
          filters: {},
          isShared: false,
        },
      })
      if (!res.ok) return
      const data = await res.json()
      const viewId = (data as any).view?.id
      navigate(viewId ? `/${workspaceSlug()}/view/${viewId}` : `/${workspaceSlug()}/views/${type}`)
    } catch (error) {
      console.error("Failed to create view:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const breadcrumbLabel = () => (viewType() === "issues" ? "All issues" : "All projects")
  const placeholder = () => (viewType() === "issues" ? "All issues" : "All projects")
  const backLink = () => `/${workspaceSlug()}/views/${viewType()}`

  const contextValue: NewViewContextType = {
    viewName,
    setViewName,
    viewDescription,
    setViewDescription,
    isCreating,
    setIsCreating,
    workspaceId,
    saveView,
    workspaceSlug,
    viewType,
  }

  return (
    <NewViewContext.Provider value={contextValue}>
      <>
        {/* Breadcrumb - OUTSIDE the card */}
        <div class="flex items-center justify-between px-4 py-2 text-[13px] text-muted-foreground shrink-0">
          <div class="flex items-center gap-1.5">
            <a href={backLink()} class="hover:text-foreground transition-colors">
              Views
            </a>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-3"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span class="text-foreground">{breadcrumbLabel()}</span>
          </div>
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-4"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
        </div>

        {/* Card with border - header + tabs only */}
        <div class="flex shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card mx-2 mt-2">
          {/* ── Header ──────────────────────────────────────────────── */}
          <div class="shrink-0 border-b border-border px-5 pt-4 pb-3.5">
            {/* Row 1: icon + title + actions */}
            <div class="flex items-center gap-3">
              {/* Icon button */}
              <button
                type="button"
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-foreground/70 transition-colors hover:bg-muted"
              >
                <LayersIcon class="size-4" />
              </button>

              {/* Title input */}
              <input
                type="text"
                value={viewName()}
                onInput={(e) => setViewName(e.currentTarget.value)}
                placeholder={placeholder()}
                class="min-w-0 flex-1 bg-transparent text-[18px] font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />

              {/* Actions */}
              <div class="flex shrink-0 items-center gap-2">
                <span class="text-[13px] text-muted-foreground">Save to</span>
                <button
                  type="button"
                  class="flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1 text-[13px] font-medium text-foreground transition-colors hover:bg-white/5"
                >
                  <LockIcon class="size-3 text-muted-foreground" />
                  Personal
                </button>
                <button
                  type="button"
                  onClick={() => navigate(backLink())}
                  class="rounded-full px-3 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveView}
                  disabled={!viewName().trim() || isCreating() || !workspaceId()}
                  class="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isCreating() ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {/* Row 2: description — indented to align with title */}
            <div class="mt-2 pl-[calc(theme(spacing.9)+theme(spacing.3))]">
              <input
                type="text"
                value={viewDescription()}
                onInput={(e) => setViewDescription(e.currentTarget.value)}
                placeholder="Description (optional)"
                class="w-full bg-transparent text-[13px] text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              />
            </div>
          </div>

          {/* ── Tabs + controls ─────────────────────────────────────── */}
          <div class="flex shrink-0 items-center border-b border-border px-4 py-2">
            <div class="flex-1">
              <PillTabs
                tabs={[
                  { label: "Issues", href: `/${workspaceSlug()}/views/new/issues` },
                  { label: "Projects", href: `/${workspaceSlug()}/views/new/projects` },
                ]}
                active={viewType()}
                variant="compact"
                containerClass="flex items-center gap-1"
              />
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <FilterIcon class="size-3.5" />
              </button>
              <button
                type="button"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <DisplayIcon class="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Page content (issues or projects list) ─────────────────────────── */}
        {props.children}
      </>
    </NewViewContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function LayersIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function LockIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function FilterIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

function DisplayIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="12" y1="18" x2="12" y2="18" stroke-width="3" stroke-linecap="round" />
    </svg>
  )
}
