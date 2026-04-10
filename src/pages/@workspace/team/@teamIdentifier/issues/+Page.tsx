import { createSignal, For, Show, createMemo, Match, Switch as SolidSwitch } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { useDisclosure } from "bagon-hooks"
import getTitle from "@/utils/get-title"
import { StatusIcon, PriorityIcon, mapPriority } from "@/components/issue-fields"
import { usePowerSyncQuery, usePowerSyncGetOne } from "@/lib/powersync"
import { NewIssueModal } from "@/components/new-issue-modal"
import { PopoverComp } from "@/components/ui/popover"
import { PillTabs } from "@/components/pill-tabs"

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
}

type IssueRow = {
  id: string
  title: string
  priority: number
  due_date: string | null
  number: number
  team_identifier: string
  status_name: string | null
  status_category: string | null
  status_color: string | null
  status_position: number
  assignee_name: string | null
  assignee_avatar: string | null
  labels: string | null
}

type TeamRow = {
  id: string
  name: string
  identifier: string
  color: string | null
}

type StatusRow = {
  id: string
  name: string
  category: string
  color: string | null
  position: number
}

const ISSUE_FIELDS = `
  i.id,
  i.title,
  i.priority,
  i.due_date,
  i.number,
  i.sort_order,
  t.identifier as team_identifier,
  ws.name as status_name,
  ws.category as status_category,
  ws.color as status_color,
  ws.position as status_position,
  u.display_name as assignee_name,
  u.avatar_url as assignee_avatar,
  (
    SELECT GROUP_CONCAT(l.name, ',')
    FROM issue_label il
    JOIN label l ON il.label_id = l.id
    WHERE il.issue_id = i.id
  ) as labels
  FROM issue i
  LEFT JOIN team t ON i.team_id = t.id
  LEFT JOIN workflow_status ws ON i.status_id = ws.id
  LEFT JOIN user u ON i.assignee_id = u.id
`

function formatDateShort(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const STATUS_DISPLAY_ORDER: Record<string, number> = {
  started: 0,
  unstarted: 1,
  backlog: 2,
  completed: 3,
  cancelled: 4,
  triage: 5,
  in_review: 6,
  duplicate: 7,
}

function statusLabel(category: string): string {
  switch (category) {
    case "started":
      return "In Progress"
    case "unstarted":
      return "Todo"
    case "backlog":
      return "Backlog"
    case "completed":
      return "Done"
    case "cancelled":
      return "Cancelled"
    case "triage":
      return "Triage"
    case "in_review":
      return "In Review"
    case "duplicate":
      return "Duplicate"
    default:
      return category
  }
}

// Active categories (not completed, cancelled, duplicate, triage)
const ACTIVE_CATEGORIES = new Set(["started", "unstarted", "backlog", "in_review"])
const COMPLETED_CATEGORIES = new Set(["completed", "cancelled"])

export default function TeamIssuesPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const teamIdentifier = () => params().teamIdentifier ?? ""

  const [newIssueOpen, newIssueActions] = useDisclosure()
  // view is controlled by DisplayPopover
  const [view, setView] = createSignal<"list" | "board">("list")

  // Tab state: all | active | backlog
  // backlog tab only shows issues in "backlog" category
  // active tab excludes completed/cancelled/duplicate/triage
  // all shows everything
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
    () => `
      SELECT ${ISSUE_FIELDS}
      WHERE t.identifier = ?
      ORDER BY i.sort_order ASC, i.created_at DESC
    `,
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
    // active: exclude completed, cancelled, duplicate, triage
    return all.filter((i) => {
      const cat = i.status_category ?? "backlog"
      return ACTIVE_CATEGORIES.has(cat) || cat === "backlog"
    })
  })

  const groupedIssues = createMemo(() => {
    const map = new Map<string, IssueRow[]>()
    const statusOrder = new Map<string, number>()

    // Initialize map with all statuses from this team
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

    const sorted = Array.from(map.entries()).sort(
      (a, b) => (statusOrder.get(a[0]) ?? 99) - (statusOrder.get(b[0]) ?? 99)
    )

    return sorted.map(([category, items]) => ({
      category,
      label: statusLabel(category),
      issues: items,
    }))
  })

  const boardColumns = createMemo(() => {
    // For board view, we want columns per status name, not category
    const map = new Map<string, { status: StatusRow; issues: IssueRow[] }>()
    for (const s of statuses()) {
      map.set(s.id, { status: s, issues: [] })
    }
    for (const issue of filteredIssues()) {
      // Find status by id - issues have status_id but not in our query fields
      // We need to include status_id in ISSUE_FIELDS
    }
    return Array.from(map.values()).sort((a, b) => a.status.position - b.status.position)
  })

  const handleNewIssue = () => {
    newIssueActions.open()
  }

  const tabItems = () => [
    { label: "All issues", value: "all" },
    { label: "Active", value: "active" },
    { label: "Backlog", value: "backlog" },
  ]

  return (
    <div class="flex h-full flex-col overflow-hidden">
      {/* Header row: Team breadcrumb + New Issue */}
      <div class="flex items-center gap-3 border-b border-border/50 px-4 py-2.5 shrink-0">
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
          onClick={handleNewIssue}
          class="flex items-center gap-1.5 rounded bg-primary px-2.5 py-1 text-[12px] text-primary-foreground transition-opacity hover:opacity-90"
        >
          <PlusIcon class="size-3.5" />
          New Issue
        </button>
      </div>

      {/* Tabs row */}
      <div class="flex items-center gap-2 border-b border-border/50 px-4 py-2">
        {/* Tabs: All issues / Active / Backlog */}
        <PillTabs
          tabs={tabItems().map((t) => ({
            label: t.label,
            href: "#",
          }))}
          active={tabItems().find((t) => t.value === activeTab())?.label ?? "All issues"}
          variant="compact"
          containerClass="flex items-center gap-1"
        />

        {/* New view icon button */}
        <button
          type="button"
          class="ml-1 rounded p-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          title="New view"
        >
          <NewViewIcon class="size-3.5" />
        </button>

        <div class="flex-1" />

        {/* Right controls */}
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
                onClick={handleNewIssue}
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
                    teamIdentifier={teamIdentifier()}
                  />
                )}
              </For>
            </div>
          </Match>

          <Match when={view() === "board"}>
            <BoardView
              issues={filteredIssues()}
              statuses={statuses()}
              workspaceSlug={workspaceSlug()}
            />
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

function IssueGroup(props: {
  label: string
  category: string
  issues: IssueRow[]
  workspaceSlug: string
  teamIdentifier: string
}) {
  const [collapsed, setCollapsed] = createSignal(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        class="sticky top-0 flex w-full items-center gap-2 border-b border-border/20 bg-background/50 px-4 py-2 transition-colors hover:bg-white/[0.02]"
      >
        <StatusIcon category={props.category} class="size-3.5 shrink-0" />
        <span class="text-[12px] font-medium text-muted-foreground">{props.label}</span>
        <span class="rounded-full bg-secondary/50 px-1.5 py-0.5 text-[11px] text-muted-foreground/50">
          {props.issues.length}
        </span>
        <ChevronRightIcon
          class="ml-auto size-3 text-muted-foreground/50 transition-transform"
          style={{ transform: collapsed() ? "rotate(0deg)" : "rotate(90deg)" }}
        />
      </button>
      <Show when={!collapsed()}>
        <For each={props.issues}>
          {(issue) => <IssueRow issue={issue} workspaceSlug={props.workspaceSlug} />}
        </For>
      </Show>
    </div>
  )
}

function IssueRow(props: { issue: IssueRow; workspaceSlug: string }) {
  const issue = () => props.issue
  const identifier = () => `${issue().team_identifier}-${issue().number}`
  const priority = () => mapPriority(issue().priority)
  const labels = () => (issue().labels ? issue().labels!.split(",").filter(Boolean) : [])
  const dueDate = () => formatDateShort(issue().due_date)

  return (
    <a
      href={`/${props.workspaceSlug}/issue/${identifier()}/${slugify(issue().title)}`}
      class="group flex cursor-pointer items-center gap-3 border-b border-border/30 px-4 py-1.5 hover:bg-white/[0.03]"
    >
      <PriorityIcon value={priority()} class="size-3.5 shrink-0" />
      <StatusIcon
        category={issue().status_category}
        color={issue().status_color}
        class="size-4 shrink-0"
      />
      <span class="w-14 shrink-0 font-mono text-[12px] text-muted-foreground/60">
        {identifier()}
      </span>
      <span class="flex-1 truncate text-[13px] text-foreground">{issue().title}</span>
      <Show when={labels().length > 0}>
        <div class="hidden shrink-0 items-center gap-1 sm:flex">
          <For each={labels()}>
            {(label) => (
              <span class="rounded-full border border-border/50 px-1.5 py-0.5 text-[11px] text-muted-foreground/70">
                {label}
              </span>
            )}
          </For>
        </div>
      </Show>
      <Show when={dueDate()}>
        <span class="hidden shrink-0 text-[11px] text-muted-foreground/60 md:block">
          {dueDate()}
        </span>
      </Show>
      <Show
        when={issue().assignee_name}
        fallback={
          <div class="flex size-5 shrink-0 items-center justify-center rounded-full border border-border/30">
            <IconPersonSmall class="size-3 text-muted-foreground/30" />
          </div>
        }
      >
        <div class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <span class="text-[9px] font-medium text-primary">
            {issue().assignee_name!.charAt(0).toUpperCase()}
          </span>
        </div>
      </Show>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Board View
// ---------------------------------------------------------------------------

function BoardView(props: { issues: IssueRow[]; statuses: StatusRow[]; workspaceSlug: string }) {
  // Group issues by status id (we need status_id in the query)
  // For now, group by status name as a proxy
  const columns = createMemo(() => {
    const map = new Map<string, { status: StatusRow; issues: IssueRow[] }>()
    for (const s of props.statuses) {
      map.set(s.id, { status: s, issues: [] })
    }
    // Since we don't have status_id in the query, match by category+name for now
    // A proper fix would add i.status_id to ISSUE_FIELDS
    for (const issue of props.issues) {
      const matching = props.statuses.find(
        (s) => s.name === issue.status_name && s.category === issue.status_category
      )
      if (matching) {
        const col = map.get(matching.id)
        if (col) col.issues.push(issue)
      }
    }
    return Array.from(map.values())
      .filter((c) => c.issues.length > 0 || props.statuses.find((s) => s.id === c.status.id))
      .sort((a, b) => a.status.position - b.status.position)
  })

  return (
    <div class="flex h-full gap-4 overflow-x-auto p-4">
      <For each={columns()}>
        {(column) => (
          <div class="flex w-[280px] shrink-0 flex-col rounded-lg border border-border/50 bg-muted/30">
            {/* Column header */}
            <div class="flex items-center gap-2 border-b border-border/30 px-3 py-2">
              <StatusIcon
                category={column.status.category}
                color={column.status.color}
                class="size-3.5 shrink-0"
              />
              <span class="flex-1 text-[12px] font-medium text-foreground">
                {column.status.name}
              </span>
              <span class="rounded-full bg-secondary/50 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {column.issues.length}
              </span>
            </div>
            {/* Cards */}
            <div class="flex-1 overflow-y-auto p-2">
              <div class="flex flex-col gap-2">
                <For each={column.issues}>
                  {(issue) => <BoardCard issue={issue} workspaceSlug={props.workspaceSlug} />}
                </For>
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}

function BoardCard(props: { issue: IssueRow; workspaceSlug: string }) {
  const issue = () => props.issue
  const identifier = () => `${issue().team_identifier}-${issue().number}`
  const priority = () => mapPriority(issue().priority)
  const labels = () => (issue().labels ? issue().labels!.split(",").filter(Boolean) : [])

  return (
    <a
      href={`/${props.workspaceSlug}/issue/${identifier()}/${slugify(issue().title)}`}
      class="flex flex-col gap-2 rounded-md border border-border/40 bg-background p-3 shadow-sm transition-all hover:border-border/60 hover:shadow"
    >
      <div class="flex items-start gap-2">
        <PriorityIcon value={priority()} class="size-3.5 shrink-0 mt-0.5" />
        <span class="flex-1 text-[13px] text-foreground leading-snug">{issue().title}</span>
      </div>

      <div class="flex items-center gap-2">
        <span class="font-mono text-[11px] text-muted-foreground/60">{identifier()}</span>
        <div class="flex-1" />
        <Show when={labels().length > 0}>
          <div class="flex items-center gap-1">
            <For each={labels().slice(0, 2)}>
              {(label) => (
                <span class="rounded-full border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground/70">
                  {label}
                </span>
              )}
            </For>
            <Show when={labels().length > 2}>
              <span class="text-[10px] text-muted-foreground/50">+{labels().length - 2}</span>
            </Show>
          </div>
        </Show>
        <Show
          when={issue().assignee_name}
          fallback={
            <div class="flex size-5 shrink-0 items-center justify-center rounded-full border border-border/30">
              <IconPersonSmall class="size-3 text-muted-foreground/30" />
            </div>
          }
        >
          <div class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span class="text-[9px] font-medium text-primary">
              {issue().assignee_name!.charAt(0).toUpperCase()}
            </span>
          </div>
        </Show>
      </div>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Filter Popover
// ---------------------------------------------------------------------------

const FILTER_GROUPS = [
  [
    { label: "AI Filter", icon: "ai" },
    { label: "Advanced filter", icon: "advanced" },
  ],
  [
    { label: "Status", icon: "status", sub: true },
    { label: "Assignee", icon: "assignee", sub: true },
    { label: "Creator", icon: "creator", sub: true },
    { label: "Priority", icon: "priority", sub: true },
    { label: "Labels", icon: "labels", sub: true },
    { label: "Relations", icon: "relations", sub: true },
    { label: "Dates", icon: "dates", sub: true },
  ],
  [
    { label: "Project", icon: "project", sub: true },
    { label: "Project properties", icon: "project-props", sub: true },
  ],
  [
    { label: "Subscribers", icon: "subscribers", sub: true },
    { label: "Auto-closed", icon: "auto-closed" },
    { label: "Content", icon: "content", sub: true },
    { label: "Links", icon: "links", sub: true },
    { label: "Template", icon: "template", sub: true },
  ],
]

function FilterItemIcon(props: { icon: string }) {
  const cls = "size-3.5 shrink-0 text-muted-foreground/70"
  switch (props.icon) {
    case "ai":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <circle cx="8" cy="8" r="5.5" stroke-dasharray="2.5 2" />
          <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" opacity="0.5" />
        </svg>
      )
    case "advanced":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <line x1="3" y1="4" x2="13" y2="4" />
          <line x1="5" y1="8" x2="11" y2="8" />
          <line x1="7" y1="12" x2="9" y2="12" />
        </svg>
      )
    case "status":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <circle cx="8" cy="8" r="5.5" stroke-dasharray="3 2" />
        </svg>
      )
    case "assignee":
    case "creator":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <circle cx="8" cy="5.5" r="2.5" />
          <path d="M3 13.5 C3 10.5 13 10.5 13 13.5" stroke-linecap="round" />
        </svg>
      )
    case "priority":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="currentColor" stroke="none">
          <rect x="1" y="9" width="2" height="5" rx="0.5" opacity="0.4" />
          <rect x="5" y="6" width="2" height="8" rx="0.5" opacity="0.6" />
          <rect x="9" y="3" width="2" height="11" rx="0.5" opacity="0.8" />
        </svg>
      )
    case "labels":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <rect x="2" y="5" width="12" height="6" rx="3" />
        </svg>
      )
    case "relations":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M3 8 h3 M10 8 h3" stroke-linecap="round" />
          <rect x="5.5" y="5.5" width="5" height="5" rx="1" />
        </svg>
      )
    case "dates":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
          <line x1="2.5" y1="7" x2="13.5" y2="7" />
          <line x1="5.5" y1="2" x2="5.5" y2="5" stroke-linecap="round" />
          <line x1="10.5" y1="2" x2="10.5" y2="5" stroke-linecap="round" />
        </svg>
      )
    case "project":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M2 4 L8 2 L14 4 L14 12 L8 14 L2 12 Z" />
        </svg>
      )
    case "project-props":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M2 4 L8 2 L14 4 L14 12 L8 14 L2 12 Z" />
          <line x1="8" y1="2" x2="8" y2="14" />
        </svg>
      )
    case "subscribers":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M8 3 C5.5 3 4 5 4 7 L4 10 L2.5 11.5 L13.5 11.5 L12 10 L12 7 C12 5 10.5 3 8 3 Z" />
          <path d="M6.5 11.5 C6.5 12.5 9.5 12.5 9.5 11.5" />
        </svg>
      )
    case "auto-closed":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <circle cx="8" cy="8" r="5.5" />
          <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke-linecap="round" />
          <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke-linecap="round" />
        </svg>
      )
    case "content":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <rect x="3" y="2.5" width="10" height="11" rx="1" />
          <line x1="5.5" y1="6" x2="10.5" y2="6" stroke-linecap="round" />
          <line x1="5.5" y1="9" x2="10.5" y2="9" stroke-linecap="round" />
        </svg>
      )
    case "links":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M6.5 9.5 A3.5 3.5 0 0 0 9.5 6.5" stroke-linecap="round" />
          <path d="M4 12 L2.5 13.5" stroke-linecap="round" />
          <path d="M7 5 L5 3 A3 3 0 0 0 3 5 L5 7" stroke-linecap="round" stroke-linejoin="round" />
          <path
            d="M9 11 L11 13 A3 3 0 0 0 13 11 L11 9"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      )
    case "template":
      return (
        <svg viewBox="0 0 16 16" class={cls} fill="none" stroke="currentColor" stroke-width="1.4">
          <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
          <path d="M2.5 6.5 L13.5 6.5" />
          <path d="M7 6.5 L7 13.5" />
        </svg>
      )
    default:
      return <span class={cls} />
  }
}

function FilterPopover() {
  const [search, setSearch] = createSignal("")

  const filteredGroups = () => {
    const q = search().toLowerCase()
    if (!q) return FILTER_GROUPS
    return FILTER_GROUPS.map((g) =>
      g.filter((item) => item.label.toLowerCase().includes(q))
    ).filter((g) => g.length > 0)
  }

  return (
    <PopoverComp
      placement="bottom-end"
      contentProps={{ class: "p-0 w-[220px] border-border/60 bg-popover shadow-xl" }}
      content={
        <div>
          <div class="flex items-center border-b border-border/40 px-3 py-2">
            <input
              type="text"
              placeholder="Add Filter..."
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              class="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
              autofocus
            />
            <span class="ml-2 text-[11px] text-muted-foreground/40">F</span>
          </div>
          <div class="max-h-[380px] overflow-y-auto py-1">
            <For each={filteredGroups()}>
              {(group, gi) => (
                <>
                  <Show when={gi() > 0}>
                    <div class="my-1 h-px bg-border/30" />
                  </Show>
                  <For each={group}>
                    {(item) => (
                      <button
                        type="button"
                        class="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-white/[0.06]"
                      >
                        <FilterItemIcon icon={item.icon} />
                        <span class="flex-1 text-left">{item.label}</span>
                        <Show when={(item as any).sub}>
                          <svg
                            viewBox="0 0 16 16"
                            class="size-3 shrink-0 text-muted-foreground/40"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                          >
                            <path
                              d="M6 4 L10 8 L6 12"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        </Show>
                      </button>
                    )}
                  </For>
                </>
              )}
            </For>
          </div>
        </div>
      }
    >
      <button
        type="button"
        class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        title="Filter"
      >
        <FilterIcon class="size-3.5" />
      </button>
    </PopoverComp>
  )
}

// ---------------------------------------------------------------------------
// Display Popover (controls List/Board view)
// ---------------------------------------------------------------------------

type DisplayProp =
  | "ID"
  | "Status"
  | "Assignee"
  | "Priority"
  | "Project"
  | "Due date"
  | "Milestone"
  | "Labels"
  | "Links"
  | "Time in status"
  | "Created"
  | "Updated"

const ALL_DISPLAY_PROPS: DisplayProp[] = [
  "ID",
  "Status",
  "Assignee",
  "Priority",
  "Project",
  "Due date",
  "Milestone",
  "Labels",
  "Links",
  "Time in status",
  "Created",
  "Updated",
]
const DEFAULT_ACTIVE_PROPS = new Set<DisplayProp>([
  "ID",
  "Status",
  "Assignee",
  "Priority",
  "Project",
  "Due date",
  "Labels",
  "Created",
])

function DisplayPopover(props: {
  view: "list" | "board"
  onViewChange: (view: "list" | "board") => void
}) {
  const [showSubIssues, setShowSubIssues] = createSignal(true)
  const [nestedSubIssues, setNestedSubIssues] = createSignal(false)
  const [activeProps, setActiveProps] = createSignal<Set<DisplayProp>>(
    new Set(DEFAULT_ACTIVE_PROPS)
  )

  const toggleProp = (prop: DisplayProp) => {
    setActiveProps((prev) => {
      const next = new Set(prev)
      if (next.has(prop)) next.delete(prop)
      else next.add(prop)
      return next
    })
  }

  return (
    <PopoverComp
      placement="bottom-end"
      contentProps={{ class: "p-0 w-[300px] border-border/60 bg-popover shadow-xl" }}
      content={
        <div class="space-y-3 p-3">
          {/* List / Board toggle */}
          <div class="flex items-center gap-1 rounded-lg bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => props.onViewChange("list")}
              class={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition-colors ${props.view === "list" ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <svg
                viewBox="0 0 16 16"
                class="size-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <line x1="3" y1="5" x2="13" y2="5" stroke-linecap="round" />
                <line x1="3" y1="8" x2="13" y2="8" stroke-linecap="round" />
                <line x1="3" y1="11" x2="13" y2="11" stroke-linecap="round" />
              </svg>
              List
            </button>
            <button
              type="button"
              onClick={() => props.onViewChange("board")}
              class={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition-colors ${props.view === "board" ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <svg
                viewBox="0 0 16 16"
                class="size-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <rect x="2" y="3" width="4" height="10" rx="1" />
                <rect x="7.5" y="3" width="4" height="7" rx="1" />
              </svg>
              Board
            </button>
          </div>

          <div class="h-px bg-border/30" />

          <div class="flex items-center justify-between">
            <span class="text-[13px] text-muted-foreground">Grouping</span>
            <button
              type="button"
              class="flex items-center gap-1 rounded border border-border/30 bg-muted/30 px-2 py-1 text-[13px] text-foreground transition-colors hover:bg-muted/50"
            >
              No grouping
              <svg
                viewBox="0 0 16 16"
                class="size-3 text-muted-foreground/60"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="M4 6 L8 10 L12 6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-[13px] text-muted-foreground">Ordering</span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
              >
                <svg
                  viewBox="0 0 16 16"
                  class="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path
                    d="M3 4 L3 12 M3 12 L6 9 M3 12 L0 9"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    transform="translate(3,0)"
                  />
                  <line x1="7" y1="5" x2="13" y2="5" stroke-linecap="round" />
                  <line x1="7" y1="8" x2="11" y2="8" stroke-linecap="round" />
                  <line x1="7" y1="11" x2="9" y2="11" stroke-linecap="round" />
                </svg>
              </button>
              <button
                type="button"
                class="flex items-center gap-1 rounded border border-border/30 bg-muted/30 px-2 py-1 text-[13px] text-foreground transition-colors hover:bg-muted/50"
              >
                Created
                <svg
                  viewBox="0 0 16 16"
                  class="size-3 text-muted-foreground/60"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M4 6 L8 10 L12 6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <div class="h-px bg-border/30" />

          <div class="flex items-center justify-between">
            <span class="text-[13px] text-muted-foreground">Completed issues</span>
            <button
              type="button"
              class="flex items-center gap-1 rounded border border-border/30 bg-muted/30 px-2 py-1 text-[13px] text-foreground transition-colors hover:bg-muted/50"
            >
              All
              <svg
                viewBox="0 0 16 16"
                class="size-3 text-muted-foreground/60"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="M4 6 L8 10 L12 6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-[13px] text-muted-foreground">Show sub-issues</span>
            <SwitchRoot checked={showSubIssues()} onChange={setShowSubIssues} />
          </div>

          <div class="h-px bg-border/30" />

          <div>
            <p class="mb-2 text-[12px] font-semibold text-foreground">List options</p>
            <div class="flex items-center justify-between">
              <span class="text-[13px] text-muted-foreground">Nested sub-issues</span>
              <SwitchRoot checked={nestedSubIssues()} onChange={setNestedSubIssues} />
            </div>
          </div>

          <div>
            <p class="mb-2 text-[13px] text-muted-foreground">Display properties</p>
            <div class="flex flex-wrap gap-1.5">
              <For each={ALL_DISPLAY_PROPS}>
                {(prop) => (
                  <button
                    type="button"
                    onClick={() => toggleProp(prop)}
                    class={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${activeProps().has(prop) ? "border-foreground/30 bg-foreground/10 font-medium text-foreground" : "border-border/30 text-muted-foreground/50 hover:border-border/50 hover:text-muted-foreground"}`}
                  >
                    {prop}
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      }
    >
      <button
        type="button"
        class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        title="Display options"
      >
        <DisplayIcon class="size-3.5" />
      </button>
    </PopoverComp>
  )
}

// Simple switch component (since we don't have Switch from solid-ui imported)
function SwitchRoot(props: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => props.onChange(!props.checked)}
      class={`relative h-5 w-9 rounded-full transition-colors ${props.checked ? "bg-primary" : "bg-muted"}`}
    >
      <span
        class={`absolute top-0.5 size-4 rounded-full bg-background shadow-sm transition-transform ${props.checked ? "translate-x-4.5" : "translate-x-0.5"}`}
        style={{ transform: props.checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// View Popover
// ---------------------------------------------------------------------------

type ViewTab = "labels" | "priority" | "projects"

function ViewPopover() {
  const [viewTab, setViewTab] = createSignal<ViewTab>("labels")

  return (
    <PopoverComp
      placement="bottom-end"
      contentProps={{ class: "p-0 w-[260px] border-border/60 bg-popover shadow-xl" }}
      content={
        <div>
          <div class="flex items-center gap-1 border-b border-border/30 p-2">
            {(["labels", "priority", "projects"] as ViewTab[]).map((t) => (
              <button
                type="button"
                onClick={() => setViewTab(t)}
                class={`rounded-full px-3 py-1.5 text-[13px] font-medium capitalize transition-colors ${viewTab() === t ? "bg-muted/60 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div class="flex items-center justify-center py-10 text-[13px] text-muted-foreground/60">
            <Show when={viewTab() === "labels"}>No labels used</Show>
            <Show when={viewTab() === "priority"}>No priority data</Show>
            <Show when={viewTab() === "projects"}>No projects</Show>
          </div>
        </div>
      }
    >
      <button
        type="button"
        class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        title="View"
      >
        <LayoutIcon class="size-3.5" />
      </button>
    </PopoverComp>
  )
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconPersonSmall(props: { class?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      class={props.class}
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5 C3 10.5 13 10.5 13 13.5" stroke-linecap="round" />
    </svg>
  )
}

function ChevronRightIcon(props: { class?: string; style?: any }) {
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
      style={props.style}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function NewViewIcon(props: { class?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <path d="M12 5v14M5 12h14" />
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
      aria-hidden="true"
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
      aria-hidden="true"
    >
      <line x1="21" x2="14" y1="4" y2="4" />
      <line x1="10" x2="3" y1="4" y2="4" />
      <line x1="21" x2="12" y1="12" y2="12" />
      <line x1="8" x2="3" y1="12" y2="12" />
      <line x1="21" x2="16" y1="20" y2="20" />
      <line x1="12" x2="3" y1="20" y2="20" />
      <line x1="14" x2="14" y1="2" y2="6" />
      <line x1="8" x2="8" y1="10" y2="14" />
      <line x1="16" x2="16" y1="18" y2="22" />
    </svg>
  )
}

function LayoutIcon(props: { class?: string }) {
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
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  )
}

function PlusIcon(props: { class?: string }) {
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
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}
