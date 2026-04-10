import { createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { PopoverComp } from "@/components/ui/popover"
import { Switch, SwitchControl, SwitchThumb } from "@/components/ui/switch"
import { useAuthContext } from "@/context/auth.context"
import { usePowerSyncQuery } from "@/lib/powersync"
import getTitle from "@/utils/get-title"
import { NewIssueModal } from "@/components/new-issue-modal"

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
}

type Tab = "assigned" | "created" | "subscribed" | "activity"
type Status = "backlog" | "todo" | "in_progress" | "done" | "cancelled"
type Priority = "urgent" | "high" | "medium" | "low" | "none"

type IssueQueryRow = {
  id: string
  title: string
  priority: number
  due_date: string | null
  number: number
  team_identifier: string
  status_category: string | null
  labels: string | null
}

function mapPriority(p: number): Priority {
  switch (p) {
    case 1: return "urgent"
    case 2: return "high"
    case 3: return "medium"
    case 4: return "low"
    default: return "none"
  }
}

function mapStatus(category: string | null): Status {
  switch (category) {
    case "backlog": return "backlog"
    case "unstarted": return "todo"
    case "started": return "in_progress"
    case "completed": return "done"
    case "cancelled": return "cancelled"
    default: return "backlog"
  }
}

function formatDueDate(date: string | null): string | null {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const ISSUE_FIELDS = `
  i.id,
  i.title,
  i.priority,
  i.due_date,
  i.number,
  i.sort_order,
  t.identifier as team_identifier,
  ws.category as status_category,
  (
    SELECT GROUP_CONCAT(l.name, ',')
    FROM issue_label il
    JOIN label l ON il.label_id = l.id
    WHERE il.issue_id = i.id
  ) as labels
FROM issue i
LEFT JOIN team t ON i.team_id = t.id
LEFT JOIN workflow_status ws ON i.status_id = ws.id
`

const VALID_TABS: Tab[] = ["assigned", "created", "subscribed", "activity"]

export default function MyIssuesPage() {
  useMetadata({ title: getTitle("My Issues") })
  const pageCtx = usePageContext()
  const auth = useAuthContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const tab = (): Tab => {
    const t = params().tab as Tab
    return VALID_TABS.includes(t) ? t : "assigned"
  }
  const [newIssueOpen, setNewIssueOpen] = createSignal(false)

  const [assignedIssues] = usePowerSyncQuery<IssueQueryRow>(
    () => `SELECT ${ISSUE_FIELDS} WHERE i.assignee_id = ? ORDER BY i.sort_order ASC, i.created_at DESC`,
    () => [auth.user()?.id ?? ""]
  )

  const [createdIssues] = usePowerSyncQuery<IssueQueryRow>(
    () => `SELECT ${ISSUE_FIELDS} WHERE i.creator_id = ? ORDER BY i.created_at DESC`,
    () => [auth.user()?.id ?? ""]
  )

  const issues = () => {
    switch (tab()) {
      case "assigned": return assignedIssues()
      case "created": return createdIssues()
      default: return []
    }
  }

  const emptyText = () => {
    switch (tab()) {
      case "assigned": return "No issues assigned to you"
      case "created": return "No issues created by you"
      case "subscribed": return "No subscribed issues"
      case "activity": return "No recent activity"
    }
  }

  return (
    <div class="flex h-full flex-col overflow-hidden">
      {/* Title row */}
      <div class="shrink-0 px-4 pt-3 pb-0">
        <h1 class="text-[15px] font-semibold text-foreground tracking-[-0.01em]">My issues</h1>
      </div>

      {/* Tabs + controls row */}
      <div class="flex shrink-0 items-center gap-2 px-4 py-2">
        {/* Tabs — links so the URL reflects the active tab */}
        <div class="flex flex-1 items-center gap-1">
          {VALID_TABS.map((t) => (
            <a
              href={`/${workspaceSlug()}/my-issues/${t}`}
              class={`rounded-full px-3 py-1 text-[13px] capitalize transition-colors ${
                tab() === t
                  ? "bg-foreground font-medium text-background"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              {t}
            </a>
          ))}
        </div>

        {/* Right controls */}
        <div class="flex shrink-0 items-center gap-0.5">
          <FilterPopover />
          <DisplayPopover />
          <ViewPopover />
        </div>
      </div>

      {/* Divider */}
      <div class="h-px shrink-0 bg-border/50" />

      {/* Issue list */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={issues().length > 0}
          fallback={
            <div class="flex h-full flex-col items-center justify-center gap-5">
              <EmptyIllustration />
              <p class="text-[13px] text-muted-foreground">{emptyText()}</p>
              <button
                onClick={() => setNewIssueOpen(true)}
                class="rounded-full bg-primary px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary/90"
              >
                Create new issue
              </button>
            </div>
          }
        >
          <div>
            <div class="sticky top-0 flex items-center gap-2 border-b border-border/20 bg-background/50 px-4 py-2">
              <span class="text-[12px] font-medium text-muted-foreground capitalize">{tab()}</span>
              <span class="rounded-full bg-secondary/50 px-1.5 py-0.5 text-[11px] text-muted-foreground/50">
                {issues().length}
              </span>
            </div>
            <For each={issues()}>
              {(row) => (
                <IssueRow
                  issueId={`${row.team_identifier}-${row.number}`}
                  title={row.title}
                  status={mapStatus(row.status_category)}
                  priority={mapPriority(row.priority)}
                  dueDate={formatDueDate(row.due_date)}
                  labels={row.labels ? row.labels.split(",").filter(Boolean) : []}
                  href={`/${workspaceSlug()}/issue/${row.team_identifier}-${row.number}/${slugify(row.title)}`}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
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
  const cls = "size-3.5 text-muted-foreground/70 shrink-0"
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
          <path d="M9 11 L11 13 A3 3 0 0 0 13 11 L11 9" stroke-linecap="round" stroke-linejoin="round" />
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
    return FILTER_GROUPS.map((g) => g.filter((item) => item.label.toLowerCase().includes(q))).filter((g) => g.length > 0)
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
                          <svg viewBox="0 0 16 16" class="size-3 shrink-0 text-muted-foreground/40" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M6 4 L10 8 L6 12" stroke-linecap="round" stroke-linejoin="round" />
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
      <button type="button" class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" title="Filter">
        <FilterIcon class="size-3.5" />
      </button>
    </PopoverComp>
  )
}

// ---------------------------------------------------------------------------
// Display Popover
// ---------------------------------------------------------------------------

type DisplayProp = "ID" | "Status" | "Assignee" | "Priority" | "Project" | "Due date" | "Milestone" | "Labels" | "Links" | "Time in status" | "Created" | "Updated"

const ALL_DISPLAY_PROPS: DisplayProp[] = ["ID", "Status", "Assignee", "Priority", "Project", "Due date", "Milestone", "Labels", "Links", "Time in status", "Created", "Updated"]
const DEFAULT_ACTIVE_PROPS = new Set<DisplayProp>(["ID", "Status", "Assignee", "Priority", "Project", "Due date", "Labels", "Created"])

function DisplayPopover() {
  const [view, setView] = createSignal<"list" | "board">("list")
  const [showSubIssues, setShowSubIssues] = createSignal(true)
  const [nestedSubIssues, setNestedSubIssues] = createSignal(false)
  const [activeProps, setActiveProps] = createSignal<Set<DisplayProp>>(new Set(DEFAULT_ACTIVE_PROPS))

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
          <div class="flex items-center gap-1 rounded-lg bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              class={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition-colors ${view() === "list" ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <svg viewBox="0 0 16 16" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.5">
                <line x1="3" y1="5" x2="13" y2="5" stroke-linecap="round" />
                <line x1="3" y1="8" x2="13" y2="8" stroke-linecap="round" />
                <line x1="3" y1="11" x2="13" y2="11" stroke-linecap="round" />
              </svg>
              List
            </button>
            <button
              type="button"
              onClick={() => setView("board")}
              class={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition-colors ${view() === "board" ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <svg viewBox="0 0 16 16" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="3" width="4" height="10" rx="1" />
                <rect x="7.5" y="3" width="4" height="7" rx="1" />
              </svg>
              Board
            </button>
          </div>

          <div class="h-px bg-border/30" />

          <div class="flex items-center justify-between">
            <span class="text-[13px] text-muted-foreground">Grouping</span>
            <button type="button" class="flex items-center gap-1 rounded border border-border/30 bg-muted/30 px-2 py-1 text-[13px] text-foreground transition-colors hover:bg-muted/50">
              No grouping
              <svg viewBox="0 0 16 16" class="size-3 text-muted-foreground/60" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 6 L8 10 L12 6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-[13px] text-muted-foreground">Ordering</span>
            <div class="flex items-center gap-1">
              <button type="button" class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground">
                <svg viewBox="0 0 16 16" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 4 L3 12 M3 12 L6 9 M3 12 L0 9" stroke-linecap="round" stroke-linejoin="round" transform="translate(3,0)" />
                  <line x1="7" y1="5" x2="13" y2="5" stroke-linecap="round" />
                  <line x1="7" y1="8" x2="11" y2="8" stroke-linecap="round" />
                  <line x1="7" y1="11" x2="9" y2="11" stroke-linecap="round" />
                </svg>
              </button>
              <button type="button" class="flex items-center gap-1 rounded border border-border/30 bg-muted/30 px-2 py-1 text-[13px] text-foreground transition-colors hover:bg-muted/50">
                Created
                <svg viewBox="0 0 16 16" class="size-3 text-muted-foreground/60" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M4 6 L8 10 L12 6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <div class="h-px bg-border/30" />

          <div class="flex items-center justify-between">
            <span class="text-[13px] text-muted-foreground">Completed issues</span>
            <button type="button" class="flex items-center gap-1 rounded border border-border/30 bg-muted/30 px-2 py-1 text-[13px] text-foreground transition-colors hover:bg-muted/50">
              All
              <svg viewBox="0 0 16 16" class="size-3 text-muted-foreground/60" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 6 L8 10 L12 6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-[13px] text-muted-foreground">Show sub-issues</span>
            <Switch checked={showSubIssues()} onChange={setShowSubIssues}>
              <SwitchControl class="h-5 w-9"><SwitchThumb class="size-4 data-[checked]:translate-x-4" /></SwitchControl>
            </Switch>
          </div>

          <div class="h-px bg-border/30" />

          <div>
            <p class="mb-2 text-[12px] font-semibold text-foreground">List options</p>
            <div class="flex items-center justify-between">
              <span class="text-[13px] text-muted-foreground">Nested sub-issues</span>
              <Switch checked={nestedSubIssues()} onChange={setNestedSubIssues}>
                <SwitchControl class="h-5 w-9"><SwitchThumb class="size-4 data-[checked]:translate-x-4" /></SwitchControl>
              </Switch>
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
      <button type="button" class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" title="Display options">
        <DisplayIcon class="size-3.5" />
      </button>
    </PopoverComp>
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
      <button type="button" class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" title="View">
        <LayoutIcon class="size-3.5" />
      </button>
    </PopoverComp>
  )
}

// ---------------------------------------------------------------------------
// Issue Row
// ---------------------------------------------------------------------------

function IssueRow(props: {
  issueId: string
  title: string
  status: Status
  priority: Priority
  dueDate: string | null
  labels: string[]
  href: string
}) {
  return (
    <a
      href={props.href}
      class="group flex cursor-pointer items-center gap-3 border-b border-border/30 px-4 py-1.5 hover:bg-white/[0.03]"
    >
      <PriorityIcon priority={props.priority} class="size-3.5 shrink-0" />
      <StatusIcon status={props.status} class="size-4 shrink-0" />
      <span class="w-12 shrink-0 font-mono text-[12px] text-muted-foreground/60">{props.issueId}</span>
      <span class="flex-1 truncate text-[13px] text-foreground">{props.title}</span>
      <Show when={props.labels.length > 0}>
        <div class="hidden shrink-0 items-center gap-1 sm:flex">
          <For each={props.labels}>
            {(label) => (
              <span class="rounded-full border border-border/50 px-1.5 py-0.5 text-[11px] text-muted-foreground/70">{label}</span>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.dueDate}>
        <span class="hidden shrink-0 text-[11px] text-muted-foreground/60 md:block">{props.dueDate}</span>
      </Show>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Empty state illustration
// ---------------------------------------------------------------------------

function EmptyIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <ellipse cx="60" cy="100" rx="28" ry="6" fill="currentColor" class="text-muted-foreground/10" />
      <path d="M36 88 Q60 98 84 88" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" class="text-muted-foreground/25" />
      <path d="M40 93 Q60 101 80 93" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" class="text-muted-foreground/15" />
      <path d="M28 52 Q18 60 28 68" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" class="text-muted-foreground/40" />
      <path d="M24 56 Q16 60 24 64" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" class="text-muted-foreground/25" />
      <path d="M92 52 Q102 60 92 68" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" class="text-muted-foreground/40" />
      <path d="M96 56 Q104 60 96 64" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" class="text-muted-foreground/25" />
      <path d="M36 32 Q60 22 84 32" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" class="text-muted-foreground/25" />
      <path d="M40 27 Q60 19 80 27" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" class="text-muted-foreground/15" />
      <ellipse cx="60" cy="52" rx="22" ry="7" stroke="currentColor" stroke-width="2" fill="none" class="text-muted-foreground/50" />
      <path d="M38 52 L38 64" stroke="currentColor" stroke-width="2" class="text-muted-foreground/50" />
      <path d="M82 52 L82 64" stroke="currentColor" stroke-width="2" class="text-muted-foreground/50" />
      <ellipse cx="60" cy="64" rx="22" ry="7" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.06" class="text-muted-foreground/50" />
      <ellipse cx="60" cy="72" rx="22" ry="7" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3" fill="none" class="text-muted-foreground/30" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Icon components
// ---------------------------------------------------------------------------

function StatusIcon(props: { status: Status; class?: string }) {
  switch (props.status) {
    case "backlog":
      return (
        <svg viewBox="0 0 16 16" class={props.class} aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="#6b7280" stroke-width="1.5" fill="none" stroke-dasharray="3 2" />
        </svg>
      )
    case "todo":
      return (
        <svg viewBox="0 0 16 16" class={props.class} aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="#9ca3af" stroke-width="1.5" fill="none" />
        </svg>
      )
    case "in_progress":
      return (
        <svg viewBox="0 0 16 16" class={props.class} aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="#f97316" stroke-width="1.5" fill="none" />
          <path d="M8 1.5 A6.5 6.5 0 0 1 14.5 8" stroke="#f97316" stroke-width="1.5" stroke-linecap="round" fill="none" />
        </svg>
      )
    case "done":
      return (
        <svg viewBox="0 0 16 16" class={props.class} aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="#22c55e" stroke-width="1.5" fill="#22c55e" fill-opacity="0.15" />
          <path d="M5 8 L7.2 10.2 L11 6" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
      )
    case "cancelled":
      return (
        <svg viewBox="0 0 16 16" class={props.class} aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="#6b7280" stroke-width="1.5" fill="none" />
          <path d="M5.5 5.5 L10.5 10.5 M10.5 5.5 L5.5 10.5" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round" fill="none" />
        </svg>
      )
  }
}

function PriorityIcon(props: { priority: Priority; class?: string }) {
  const colors: Record<Priority, string> = { urgent: "#ef4444", high: "#f97316", medium: "#eab308", low: "#6b7280", none: "transparent" }
  return (
    <svg viewBox="0 0 16 16" class={props.class} aria-hidden="true">
      <Show when={props.priority !== "none"}>
        <rect x="1" y="8" width="2.5" height="6" rx="0.5" fill={colors[props.priority]} opacity="0.5" />
        <rect x="5" y="5" width="2.5" height="9" rx="0.5" fill={colors[props.priority]} opacity="0.7" />
        <rect x="9" y="2" width="2.5" height="12" rx="0.5" fill={colors[props.priority]} />
      </Show>
      <Show when={props.priority === "none"}>
        <circle cx="8" cy="8" r="2" fill="#4b5563" />
      </Show>
    </svg>
  )
}

function FilterIcon(props: { class?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class} aria-hidden="true">
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="8" x2="16" y1="12" y2="12" />
      <line x1="11" x2="13" y1="18" y2="18" />
    </svg>
  )
}

function DisplayIcon(props: { class?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class} aria-hidden="true">
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class} aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  )
}
