import {
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type JSX,
} from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { navigate } from "vike/client/router"
import { honoClient } from "@/lib/hono-client"
import { usePowerSyncGetOne } from "@/lib/powersync"
import { PillTabs } from "@/components/pill-tabs"
import { FilterPopover, DisplayPopover, DEFAULT_ACTIVE_PROPS } from "@/components/issues-shared"
import type { DisplayProp } from "@/components/issues-shared"
import { SaveToDropdown, type SaveTarget } from "@/components/views-shared"
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
  displayView: () => "list" | "board"
  showEmptyColumns: () => boolean
  showEmptyGroups: () => boolean
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
  const [saveTarget, setSaveTarget] = createSignal<SaveTarget>({ kind: "personal" })

  // Display popover local state (for the new view, not persisted yet)
  const [view, setView] = createSignal<"list" | "board">("list")
  const [showEmptyColumns, setShowEmptyColumns] = createSignal(true)
  const [showEmptyGroups, setShowEmptyGroups] = createSignal(false)
  const [showSubIssues, setShowSubIssues] = createSignal(true)
  const [orderByRecency, setOrderByRecency] = createSignal(false)
  const [nestedSubIssues, setNestedSubIssues] = createSignal(false)
  const [activeProps, setActiveProps] = createSignal<Set<DisplayProp>>(
    new Set(DEFAULT_ACTIVE_PROPS)
  )

  // Load workspace info from PowerSync
  const [workspace] = usePowerSyncGetOne<{ id: string }>(
    () => `SELECT w.id FROM workspace w WHERE w.slug = ?`,
    () => [workspaceSlug()]
  )

  const workspaceId = () => workspace()?.id ?? null

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

  const saveView = async () => {
    if (!viewName().trim() || !workspaceId()) return
    const type = viewType()
    const target = saveTarget()

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
          displayOptions: {
            view: view(),
            showEmptyColumns: showEmptyColumns(),
            showEmptyGroups: showEmptyGroups(),
            showSubIssues: showSubIssues(),
            orderByRecency: orderByRecency(),
            nestedSubIssues: nestedSubIssues(),
            activeProps: Array.from(activeProps()),
          },
          isShared: target.kind !== "personal",
          teamId: target.kind === "team" ? target.teamId : undefined,
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
    displayView: view,
    showEmptyColumns,
    showEmptyGroups,
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
                <SaveToDropdown
                  value={saveTarget()}
                  onChange={setSaveTarget}
                  workspaceSlug={workspaceSlug()}
                />
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
            <div class="flex shrink-0 items-center gap-0.5">
              <FilterPopover />
              <DisplayPopover
                view={view()}
                onViewChange={setView}
                showEmptyColumns={showEmptyColumns()}
                onShowEmptyColumnsChange={setShowEmptyColumns}
                showEmptyGroups={showEmptyGroups()}
                onShowEmptyGroupsChange={setShowEmptyGroups}
                showSubIssues={showSubIssues()}
                onShowSubIssuesChange={setShowSubIssues}
                orderByRecency={orderByRecency()}
                onOrderByRecencyChange={setOrderByRecency}
                nestedSubIssues={nestedSubIssues()}
                onNestedSubIssuesChange={setNestedSubIssues}
                activeProps={activeProps()}
                onToggleProp={(prop) => {
                  setActiveProps((prev) => {
                    const next = new Set(prev)
                    if (next.has(prop)) next.delete(prop)
                    else next.add(prop)
                    return next
                  })
                }}
              />
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
