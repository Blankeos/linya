import { createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { navigate } from "vike/client/router"
import { useDisclosure } from "bagon-hooks"
import getTitle from "@/utils/get-title"
import { StatusIcon, PriorityIcon, mapPriority } from "@/components/issue-fields"
import { usePowerSyncQuery, usePowerSyncGetOne } from "@/lib/powersync"
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

export default function TeamIssuesPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const teamIdentifier = () => params().teamIdentifier ?? ""

  const [view, setView] = createSignal<"list" | "board">("list")
  const [newIssueOpen, newIssueActions] = useDisclosure()

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

  const groupedIssues = () => {
    const map = new Map<string, IssueRow[]>()
    const statusOrder = new Map<string, number>()

    for (const s of statuses()) {
      if (!map.has(s.category)) {
        map.set(s.category, [])
        statusOrder.set(s.category, STATUS_DISPLAY_ORDER[s.category] ?? 99)
      }
    }

    for (const issue of issues()) {
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
  }

  const handleNewIssue = () => {
    newIssueActions.open()
  }

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <div class="flex items-center gap-1.5 text-[13px] flex-1">
          <Show when={team()}>
            <div
              class="size-4 rounded flex items-center justify-center shrink-0 text-[8px] font-bold text-white"
              style={{ "background-color": team()!.color ?? "#6b7280" }}
            >
              {team()!.name[0]?.toUpperCase()}
            </div>
            <span class="text-muted-foreground">{team()!.name}</span>
          </Show>
          <span class="text-muted-foreground/40">/</span>
          <span class="text-foreground font-medium">Issues</span>
        </div>

        <div class="flex items-center gap-0.5 bg-secondary/50 rounded p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            class={`flex items-center gap-1.5 px-2 py-1 rounded text-[12px] transition-colors ${
              view() === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListViewIcon class="size-3.5" />
            List
          </button>
          <button
            type="button"
            onClick={() => setView("board")}
            class={`flex items-center gap-1.5 px-2 py-1 rounded text-[12px] transition-colors ${
              view() === "board"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BoardViewIcon class="size-3.5" />
            Board
          </button>
        </div>

        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/60 text-[12px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <FilterIcon class="size-3.5" />
          Filter
        </button>

        <button
          type="button"
          onClick={handleNewIssue}
          class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-primary-foreground text-[12px] hover:opacity-90 transition-opacity"
        >
          <PlusIcon class="size-3.5" />
          New Issue
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show
          when={issues().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <span class="text-[32px]">—</span>
              <p class="text-[13px]">No issues in this team</p>
              <button
                type="button"
                onClick={handleNewIssue}
                class="mt-2 rounded-full bg-primary px-5 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Create new issue
              </button>
            </div>
          }
        >
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
        </Show>
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
        class="flex items-center gap-2 w-full px-4 py-2 border-b border-border/20 bg-background/50 sticky top-0 hover:bg-white/[0.02] transition-colors"
      >
        <StatusIcon category={props.category} class="size-3.5 shrink-0" />
        <span class="text-[12px] font-medium text-muted-foreground">{props.label}</span>
        <span class="text-[11px] text-muted-foreground/50 bg-secondary/50 px-1.5 py-0.5 rounded-full">
          {props.issues.length}
        </span>
        <ChevronRightIcon
          class="size-3 text-muted-foreground/50 ml-auto transition-transform"
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
      class="flex items-center gap-3 px-4 py-1.5 border-b border-border/30 hover:bg-white/[0.03] cursor-pointer group"
    >
      <PriorityIcon value={priority()} class="size-3.5 shrink-0" />
      <StatusIcon
        category={issue().status_category}
        color={issue().status_color}
        class="size-4 shrink-0"
      />
      <span class="text-[12px] text-muted-foreground/60 font-mono shrink-0 w-14">
        {identifier()}
      </span>
      <span class="text-[13px] text-foreground flex-1 truncate">{issue().title}</span>
      <Show when={labels().length > 0}>
        <div class="hidden sm:flex items-center gap-1 shrink-0">
          <For each={labels()}>
            {(label) => (
              <span class="text-[11px] px-1.5 py-0.5 rounded-full border border-border/50 text-muted-foreground/70">
                {label}
              </span>
            )}
          </For>
        </div>
      </Show>
      <Show when={dueDate()}>
        <span class="text-[11px] text-muted-foreground/60 shrink-0 hidden md:block">
          {dueDate()}
        </span>
      </Show>
      <Show
        when={issue().assignee_name}
        fallback={
          <div class="size-5 rounded-full border border-border/30 flex items-center justify-center shrink-0">
            <IconPersonSmall class="size-3 text-muted-foreground/30" />
          </div>
        }
      >
        <div class="size-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span class="text-[9px] font-medium text-primary">
            {issue().assignee_name!.charAt(0).toUpperCase()}
          </span>
        </div>
      </Show>
    </a>
  )
}

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

function ListViewIcon(props: { class?: string }) {
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
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  )
}

function BoardViewIcon(props: { class?: string }) {
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
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
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
