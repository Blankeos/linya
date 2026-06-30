import { useDisclosure } from "bagon-hooks"
import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import {
  ISSUE_FIELDS,
  type IssueRow,
  IssuesPage,
  type IssuesPageTab,
} from "@/components/issues-shared"
import { NewIssueModal } from "@/components/new-issue-modal"
import { usePowerSyncGetOne, usePowerSyncQuery } from "@/lib/powersync"
import { useDisplaySettings } from "@/hooks/use-display-settings"
import getTitle from "@/utils/get-title"

type ViewRow = {
  id: string
  name: string
  description: string | null
  icon: string | null
  type: string
  filters: string
  display_options: string
  sort_order: number
  is_shared: boolean
  workspace_id: string
  created_at: string
  updated_at: string
}

const ACTIVE_CATEGORIES = new Set(["started", "unstarted", "backlog", "in_review"])

type ActiveTab = "all" | "active" | "backlog"

const TAB_ITEMS: Array<{ label: string; value: ActiveTab }> = [
  { label: "All issues", value: "all" },
  { label: "Active", value: "active" },
  { label: "Backlog", value: "backlog" },
]

export default function ViewPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const viewSlug = () => params().viewSlug ?? ""
  const workspaceSlug = () => params().workspace ?? ""

  const [newIssueOpen, newIssueActions] = useDisclosure()
  const [newIssueCategory, setNewIssueCategory] = createSignal<string | undefined>(undefined)
  const [activeTab, setActiveTab] = createSignal<ActiveTab>("all")

  const openNewIssue = (category?: string) => {
    setNewIssueCategory(category)
    newIssueActions.open()
  }

  const closeNewIssue = () => {
    newIssueActions.close()
    setNewIssueCategory(undefined)
  }

  // Load view metadata
  const [viewRow] = usePowerSyncGetOne<ViewRow>(
    () => `SELECT cv.* FROM custom_view cv WHERE cv.id = ?`,
    () => [viewSlug()]
  )

  // Get workspace ID from the view row (or from slug as fallback)
  const [workspace] = usePowerSyncGetOne<{ id: string }>(
    () => `SELECT w.id FROM workspace w WHERE w.slug = ?`,
    () => [workspaceSlug()]
  )

  const displaySettings = useDisplaySettings(
    () => workspace()?.id ?? null,
    () => "custom_view",
    () => viewRow()?.id ?? null
  )

  // Seed display settings from the view's saved display_options on first load
  const [seeded, setSeeded] = createSignal(false)
  createEffect(() => {
    const v = viewRow()
    if (!v || seeded()) return
    try {
      const opts = JSON.parse(v.display_options)
      if (opts && typeof opts === "object" && opts.view) {
        // Only seed if user doesn't already have an override
        const current = displaySettings.settings()
        if (current.view === "list" && opts.view === "board") {
          displaySettings.updateSetting("view", opts.view)
        }
      }
    } catch {
      // ignore
    }
    setSeeded(true)
  })

  useMetadata({
    title: getTitle(viewRow() ? viewRow()!.name : "View"),
  })

  // Build issue query — apply view filters
  const buildFilterConditions = () => {
    const v = viewRow()
    if (!v) return []
    const conditions: string[] = []
    let filters: Record<string, any> = {}
    try {
      filters = JSON.parse(v.filters)
    } catch {
      return []
    }
    if (filters.teamIds?.length > 0) {
      const ids = filters.teamIds.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(",")
      conditions.push(`t.id IN (${ids})`)
    }
    if (filters.statusIds?.length > 0) {
      const ids = filters.statusIds.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(",")
      conditions.push(`ws.id IN (${ids})`)
    }
    if (filters.assigneeIds?.length > 0) {
      const ids = filters.assigneeIds.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(",")
      conditions.push(`i.assignee_id IN (${ids})`)
    }
    if (filters.priorities?.length > 0) {
      const ids = filters.priorities.join(",")
      conditions.push(`i.priority IN (${ids})`)
    }
    return conditions
  }

  const [issues] = usePowerSyncQuery<IssueRow>(
    () => {
      if (!viewRow()) return `SELECT ${ISSUE_FIELDS} WHERE 1=0`
      const conditions = buildFilterConditions()
      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
      return `SELECT ${ISSUE_FIELDS} ${where} ORDER BY i.sort_order ASC, i.created_at DESC`
    },
    () => [viewSlug()]
  )

  const filteredIssues = createMemo(() => {
    const all = issues()
    const tab = activeTab()
    if (tab === "all") return all
    if (tab === "backlog") return all.filter((i) => i.status_category === "backlog")
    return all.filter((i) => {
      const cat = i.status_category ?? "backlog"
      return ACTIVE_CATEGORIES.has(cat) || cat === "backlog"
    })
  })

  const tabs = (): IssuesPageTab[] =>
    TAB_ITEMS.map((t) => ({
      label: t.label,
      value: t.value,
      href: "#",
      onClick: () => setActiveTab(t.value),
    }))

  return (
    <>
      <IssuesPage
        header={
          <div class="flex shrink-0 items-center gap-3 border-border/50 border-b px-4 py-2.5">
            <div class="flex flex-1 items-center gap-1.5 text-[13px]">
              <a
                href={`/${workspaceSlug()}/views/issues`}
                class="text-muted-foreground hover:text-foreground transition-colors"
              >
                Views
              </a>
              <span class="text-muted-foreground/40">/</span>
              <span class="font-medium text-foreground">
                {viewRow()?.name ?? "Loading..."}
              </span>
            </div>
          </div>
        }
        tabs={tabs()}
        activeTab={activeTab()}
        issues={filteredIssues()}
        emptyText="No issues matching this view's filters"
        onNewIssue={openNewIssue}
        workspaceSlug={workspaceSlug()}
        displaySettings={displaySettings}
        setDefaultLabel="Set default for this view"
      />

      <NewIssueModal
        open={newIssueOpen()}
        onClose={closeNewIssue}
        workspaceSlug={workspaceSlug()}
        initialCategory={newIssueCategory()}
      />
    </>
  )
}
