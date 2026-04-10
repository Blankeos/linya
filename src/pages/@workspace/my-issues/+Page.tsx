import { createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import getTitle from "@/utils/get-title"
import { usePowerSyncQuery } from "@/lib/powersync"
import { useAuthContext } from "@/context/auth.context"

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

export default function MyIssuesPage() {
  useMetadata({ title: getTitle("My Issues") })
  const pageCtx = usePageContext()
  const auth = useAuthContext()
  const workspaceSlug = () => (pageCtx.routeParams as Record<string, string>).workspace ?? ""
  const [view, setView] = createSignal<"list" | "board">("list")

  const [issues] = usePowerSyncQuery<IssueQueryRow>(
    () => `
      SELECT
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
      WHERE i.assignee_id = ?
      ORDER BY i.sort_order ASC, i.created_at DESC
    `,
    () => [auth.user()?.id ?? ""]
  )

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <h1 class="text-[14px] font-semibold text-foreground tracking-[-0.01em] flex-1">
          My Issues
        </h1>

        {/* View toggle */}
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
      </div>

      {/* Issue list */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={issues().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <span class="text-[32px]">—</span>
              <p class="text-[13px]">No issues assigned to you</p>
            </div>
          }
        >
          <div>
            <div class="flex items-center gap-2 px-4 py-2 border-b border-border/20 bg-background/50 sticky top-0">
              <span class="text-[12px] font-medium text-muted-foreground">All issues</span>
              <span class="text-[11px] text-muted-foreground/50 bg-secondary/50 px-1.5 py-0.5 rounded-full">
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
                  href={`/${workspaceSlug()}/team/${row.team_identifier}/issues/${row.team_identifier}-${row.number}`}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}

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
      class="flex items-center gap-3 px-4 py-1.5 border-b border-border/30 hover:bg-white/[0.03] cursor-pointer group"
    >
      <PriorityIcon priority={props.priority} class="size-3.5 shrink-0" />
      <StatusIcon status={props.status} class="size-4 shrink-0" />
      <span class="text-[12px] text-muted-foreground/60 font-mono shrink-0 w-12">
        {props.issueId}
      </span>
      <span class="text-[13px] text-foreground flex-1 truncate">{props.title}</span>
      <Show when={props.labels.length > 0}>
        <div class="hidden sm:flex items-center gap-1 shrink-0">
          <For each={props.labels}>
            {(label) => (
              <span class="text-[11px] px-1.5 py-0.5 rounded-full border border-border/50 text-muted-foreground/70">
                {label}
              </span>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.dueDate}>
        <span class="text-[11px] text-muted-foreground/60 shrink-0 hidden md:block">
          {props.dueDate}
        </span>
      </Show>
    </a>
  )
}

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
  const colors: Record<Priority, string> = {
    urgent: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#6b7280",
    none: "transparent",
  }
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

function ListViewIcon(props: { class?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      class={props.class} aria-hidden="true">
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      class={props.class} aria-hidden="true">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  )
}

function FilterIcon(props: { class?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      class={props.class} aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}
