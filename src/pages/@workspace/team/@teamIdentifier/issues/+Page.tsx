import { createSignal, For, Show, createMemo, Match, Switch as SolidSwitch } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { useDisclosure } from "bagon-hooks"
import getTitle from "@/utils/get-title"
import { usePowerSyncQuery, usePowerSyncGetOne } from "@/lib/powersync"
import { NewIssueModal } from "@/components/new-issue-modal"
import { PillTabs } from "@/components/pill-tabs"
import {
  type IssueRow,
  type StatusRow,
  type BoardColumn,
  ISSUE_FIELDS,
  STATUS_DISPLAY_ORDER,
  statusLabel,
  IssueGroup,
  BoardView,
  FilterPopover,
  DisplayPopover,
  ViewPopover,
  NewViewIcon,
  PlusIcon,
} from "@/components/issues-shared"

type TeamRow = {
  id: string
  name: string
  identifier: string
  color: string | null
}

// Active categories (not completed, cancelled, duplicate, triage)
const ACTIVE_CATEGORIES = new Set(["started", "unstarted", "backlog", "in_review"])

export default function TeamIssuesPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const teamIdentifier = () => params().teamIdentifier ?? ""

  const [newIssueOpen, newIssueActions] = useDisclosure()
  const [view, setView] = createSignal<"list" | "board">("list")
  const [activeTab, setActiveTab] = createSignal<"all" | "active" | "backlog">("all")

  const [team] = usePowerSyncGetOne<TeamRow>(
    () => `
      SELECT t.id, t.name, t.identifier, t.color
      FROM team t
      JOIN workspace w ON t.workspace_id = w.id
      WHERE w.slug = ? AND t.identifier = ?
    `,
    () => [workspaceSlug(), teamIdentifier()]
  )

  const [issues] = usePowerSyncQuery<IssueRow>(
    () => `SELECT ${ISSUE_FIELDS} WHERE t.identifier = ? ORDER BY i.sort_order ASC, i.created_at DESC`,
    () => [teamIdentifier()]
  )

  const [statuses] = usePowerSyncQuery<StatusRow>(
    () => `
      SELECT ws.id, ws.name, ws.category, ws.color, ws.position
      FROM workflow_status ws
      JOIN team t ON ws.team_id = t.id
      JOIN workspace w ON t.workspace_id = w.id
      WHERE w.slug = ? AND t.identifier = ?
      ORDER BY ws.position ASC
    `,
    () => [workspaceSlug(), teamIdentifier()]
  )

  useMetadata({
    title: getTitle(team() ? `${team()!.name} — Issues` : teamIdentifier()),
  })

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

  const groupedIssues = createMemo(() => {
    const map = new Map<string, IssueRow[]>()
    const statusOrder = new Map<string, number>()

    for (const s of statuses()) {
      if (!map.has(s.category)) {
        map.set(s.category, [])
        statusOrder.set(s.category, STATUS_DISPLAY_ORDER[s.category] ?? 99)
      }
    }

    for (const issue of filteredIssues()) {
      const cat = issue.status_category ?? "backlog"
      if (!map.has(cat)) {
        map.set(cat, [])
        statusOrder.set(cat, STATUS_DISPLAY_ORDER[cat] ?? 99)
      }
      map.get(cat)!.push(issue)
    }

    return Array.from(map.entries())
      .sort((a, b) => (statusOrder.get(a[0]) ?? 99) - (statusOrder.get(b[0]) ?? 99))
      .map(([category, items]) => ({
        category,
        label: statusLabel(category),
        issues: items,
      }))
  })

  const boardColumns = createMemo((): BoardColumn[] => {
    const map = new Map<string, { status: StatusRow; issues: IssueRow[] }>()
    for (const s of statuses()) {
      map.set(s.id, { status: s, issues: [] })
    }
    for (const issue of filteredIssues()) {
      const col = map.get(issue.status_id ?? "")
      if (col) col.issues.push(issue)
    }
    return Array.from(map.values())
      .sort((a, b) => a.status.position - b.status.position)
      .map(({ status, issues }) => ({
        id: status.id,
        name: status.name,
        category: status.category,
        color: status.color,
        issues,
      }))
  })

  const tabItems = () => [
    { label: "All issues", value: "all" },
    { label: "Active", value: "active" },
    { label: "Backlog", value: "backlog" },
  ]

  return (
    <div class="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div class="flex shrink-0 items-center gap-3 border-b border-border/50 px-4 py-2.5">
        <div class="flex flex-1 items-center gap-1.5 text-[13px]">
          <Show when={team()}>
            <div
              class="flex size-4 shrink-0 items-center justify-center rounded text-[8px] font-bold text-white"
              style={{ "background-color": team()!.color ?? "#6b7280" }}
            >
              {team()!.name[0]?.toUpperCase()}
            </div>
            <span class="text-muted-foreground">{team()!.name}</span>
          </Show>
          <span class="text-muted-foreground/40">/</span>
          <span class="font-medium text-foreground">Issues</span>
        </div>

        <button
          type="button"
          onClick={newIssueActions.open}
          class="flex items-center gap-1.5 rounded bg-primary px-2.5 py-1 text-[12px] text-primary-foreground transition-opacity hover:opacity-90"
        >
          <PlusIcon class="size-3.5" />
          New Issue
        </button>
      </div>

      {/* Tabs row */}
      <div class="flex shrink-0 items-center gap-2 border-b border-border/50 px-4 py-2">
        <PillTabs
          tabs={tabItems().map((t) => ({ label: t.label, href: "#" }))}
          active={tabItems().find((t) => t.value === activeTab())?.label ?? "All issues"}
          variant="compact"
          containerClass="flex items-center gap-1"
        />

        <button
          type="button"
          class="ml-1 rounded p-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          title="New view"
        >
          <NewViewIcon class="size-3.5" />
        </button>

        <div class="flex-1" />

        <div class="flex shrink-0 items-center gap-0.5">
          <FilterPopover />
          <DisplayPopover view={view()} onViewChange={setView} />
          <ViewPopover />
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-hidden">
        <SolidSwitch>
          <Match when={filteredIssues().length === 0}>
            <div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <span class="text-[32px]">—</span>
              <p class="text-[13px]">No issues in this team</p>
              <button
                type="button"
                onClick={newIssueActions.open}
                class="mt-2 rounded-full bg-primary px-5 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Create new issue
              </button>
            </div>
          </Match>

          <Match when={view() === "list"}>
            <div class="h-full overflow-y-auto">
              <For each={groupedIssues()}>
                {(group) => (
                  <IssueGroup
                    label={group.label}
                    category={group.category}
                    issues={group.issues}
                    workspaceSlug={workspaceSlug()}
                  />
                )}
              </For>
            </div>
          </Match>

          <Match when={view() === "board"}>
            <BoardView columns={boardColumns()} workspaceSlug={workspaceSlug()} />
          </Match>
        </SolidSwitch>
      </div>

      <NewIssueModal
        open={newIssueOpen()}
        onClose={newIssueActions.close}
        workspaceSlug={workspaceSlug()}
      />
    </div>
  )
}
