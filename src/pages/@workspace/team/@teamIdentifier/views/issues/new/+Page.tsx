import {
  createEffect,
  createMemo,
  createSignal,
  Match,
  onCleanup,
  onMount,
  Switch as SolidSwitch,
} from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { navigate } from "vike/client/router"
import { honoClient } from "@/lib/hono-client"
import { usePowerSyncGetOne, usePowerSyncQuery } from "@/lib/powersync"
import {
  FilterPopover,
  DisplayPopover,
  DEFAULT_ACTIVE_PROPS,
  type IssueRow,
  type BoardColumn,
  ISSUE_FIELDS,
  STATUS_DISPLAY_ORDER,
  BOARD_COLUMN_ORDER,
  statusLabel,
  ListView,
  BoardView,
} from "@/components/issues-shared"
import type { DisplayProp } from "@/components/issues-shared"
import { SaveToDropdown, type SaveTarget } from "@/components/views-shared"
import getTitle from "@/utils/get-title"

type TeamRow = {
  id: string
  name: string
  identifier: string
  color: string | null
  workspace_id: string
}


export default function TeamNewViewPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const teamIdentifier = () => params().teamIdentifier ?? ""

  useMetadata({ title: getTitle(`${teamIdentifier()} — New View`) })

  const [team] = usePowerSyncGetOne<TeamRow>(
    () => `
      SELECT t.id, t.name, t.identifier, t.color, t.workspace_id
      FROM team t
      JOIN workspace w ON t.workspace_id = w.id
      WHERE w.slug = ? AND t.identifier = ?
    `,
    () => [workspaceSlug(), teamIdentifier()]
  )

  const [viewName, setViewName] = createSignal("")
  const [viewDescription, setViewDescription] = createSignal("")
  const [isCreating, setIsCreating] = createSignal(false)

  // Default save target to the current team
  const [saveTarget, setSaveTarget] = createSignal<SaveTarget>({ kind: "personal" })

  // Auto-populate team as save target when team loads
  createEffect(() => {
    const t = team()
    if (t && saveTarget().kind === "personal") {
      setSaveTarget({ kind: "team", teamId: t.id, teamName: t.name })
    }
  })

  // Display popover local state
  const [view, setView] = createSignal<"list" | "board">("list")
  const [showEmptyColumns, setShowEmptyColumns] = createSignal(true)
  const [showEmptyGroups, setShowEmptyGroups] = createSignal(false)
  const [showSubIssues, setShowSubIssues] = createSignal(true)
  const [orderByRecency, setOrderByRecency] = createSignal(false)
  const [nestedSubIssues, setNestedSubIssues] = createSignal(false)
  const [activeProps, setActiveProps] = createSignal<Set<DisplayProp>>(
    new Set(DEFAULT_ACTIVE_PROPS)
  )

  const backLink = () => `/${workspaceSlug()}/team/${teamIdentifier()}/views/issues`

  // Esc key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return
    const active = document.activeElement
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      ;(active as HTMLElement).blur()
      return
    }
    navigate(backLink())
  }

  onMount(() => document.addEventListener("keydown", handleKeyDown))
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown))

  const saveView = async () => {
    const t = team()
    if (!viewName().trim() || !t) return
    const target = saveTarget()

    try {
      setIsCreating(true)
      const client = honoClient()
      const res = await (client.workspaces as any)[":workspaceId"].views.$post({
        param: { workspaceId: t.workspace_id },
        json: {
          name: viewName(),
          description: viewDescription() || undefined,
          type: "issue",
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
      navigate(viewId ? `/${workspaceSlug()}/view/${viewId}` : backLink())
    } catch (error) {
      console.error("Failed to create view:", error)
    } finally {
      setIsCreating(false)
    }
  }

  // Issue preview
  const [issues] = usePowerSyncQuery<IssueRow>(
    () => `SELECT ${ISSUE_FIELDS} WHERE t.identifier = ? ORDER BY i.sort_order ASC, i.created_at DESC`,
    () => [teamIdentifier()]
  )

  const listGroups = createMemo((): BoardColumn[] => {
    const map = new Map<string, IssueRow[]>()
    for (const cat of Object.keys(STATUS_DISPLAY_ORDER)) map.set(cat, [])
    for (const issue of issues()) {
      const cat = issue.status_category ?? "backlog"
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(issue)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (STATUS_DISPLAY_ORDER[a] ?? 99) - (STATUS_DISPLAY_ORDER[b] ?? 99))
      .map(([category, items]) => ({
        id: category,
        name: statusLabel(category),
        category,
        color: null,
        issues: items,
      }))
  })

  const boardColumns = createMemo((): BoardColumn[] => {
    const map = new Map<string, IssueRow[]>()
    for (const cat of Object.keys(BOARD_COLUMN_ORDER)) map.set(cat, [])
    for (const issue of issues()) {
      const cat = issue.status_category ?? "backlog"
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(issue)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (BOARD_COLUMN_ORDER[a] ?? 99) - (BOARD_COLUMN_ORDER[b] ?? 99))
      .map(([category, items]) => ({
        id: category,
        name: statusLabel(category),
        category,
        color: null,
        issues: items,
      }))
  })

  return (
    <div class="flex h-full flex-col overflow-hidden bg-background">
      {/* Breadcrumb */}
      <div class="flex items-center justify-between px-4 py-2 text-[13px] text-muted-foreground shrink-0">
        <div class="flex items-center gap-1.5">
          <a href={backLink()} class="hover:text-foreground transition-colors">
            Views
          </a>
          <ChevronRightIcon class="size-3" />
          <span class="text-foreground">New view</span>
        </div>
      </div>

      {/* Card */}
      <div class="flex shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card mx-2 mt-2">
        {/* Header */}
        <div class="shrink-0 border-b border-border px-5 pt-4 pb-3.5">
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-foreground/70 transition-colors hover:bg-muted"
            >
              <LayersIcon class="size-4" />
            </button>
            <input
              type="text"
              value={viewName()}
              onInput={(e) => setViewName(e.currentTarget.value)}
              placeholder="All issues"
              class="min-w-0 flex-1 bg-transparent text-[18px] font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
            <div class="flex shrink-0 items-center gap-2">
              <span class="text-[13px] text-muted-foreground">Save to</span>
              <SaveToDropdown
                value={saveTarget()}
                onChange={setSaveTarget}
                workspaceSlug={workspaceSlug()}
                defaultTeamId={team()?.id}
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
                disabled={!viewName().trim() || isCreating() || !team()}
                class="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isCreating() ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
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

        {/* Tabs + controls */}
        <div class="flex shrink-0 items-center border-b border-border px-4 py-2">
          <div class="flex-1">
            <span class="rounded-full bg-foreground/10 px-3 py-1 text-[13px] font-medium text-foreground">
              Issues
            </span>
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

      {/* Issue preview */}
      <div class="flex-1 overflow-hidden">
        <SolidSwitch>
          <Match when={view() === "list"}>
            <ListView
              groups={listGroups()}
              workspaceSlug={workspaceSlug()}
              showEmptyGroups={showEmptyGroups()}
            />
          </Match>
          <Match when={view() === "board"}>
            <BoardView
              columns={boardColumns()}
              workspaceSlug={workspaceSlug()}
              showEmptyColumns={showEmptyColumns()}
            />
          </Match>
        </SolidSwitch>
      </div>
    </div>
  )
}

// Icons

function ChevronRightIcon(props: { class?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function LayersIcon(props: { class?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}
