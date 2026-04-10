import { createEffect, createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { usePowerSyncQuery } from "@/lib/powersync"
import { navigate } from "vike/client/router"
import getTitle from "@/utils/get-title"
import { StatusIcon, PriorityIcon } from "@/components/issue-fields"

type View = {
  id: string
  name: string
  description: string | null
  icon: string | null
  type: string
  filters: string
  display_options: string
  sort_order: number
  is_shared: boolean
  created_at: string
  updated_at: string
}

type IssueRow = {
  id: string
  title: string
  priority: number
  due_date: string | null
  number: number
  team_identifier: string
  status_category: string | null
  labels: string | null
}

type Priority = "urgent" | "high" | "medium" | "low" | "none"
type Status = "backlog" | "todo" | "in_progress" | "done" | "cancelled"

function mapPriority(p: number): Priority {
  switch (p) {
    case 1:
      return "urgent"
    case 2:
      return "high"
    case 3:
      return "medium"
    case 4:
      return "low"
    default:
      return "none"
  }
}

function mapStatus(category: string | null): Status {
  switch (category) {
    case "backlog":
      return "backlog"
    case "unstarted":
      return "todo"
    case "started":
      return "in_progress"
    case "completed":
      return "done"
    case "cancelled":
      return "cancelled"
    default:
      return "backlog"
  }
}

function formatDueDate(date: string | null): string | null {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
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

export default function ViewPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const viewSlug = () => params().viewSlug ?? ""
  const workspaceSlug = () => params().workspace ?? ""

  const [view, setView] = createSignal<View | null>(null)

  // Load view metadata
  const [views] = usePowerSyncQuery<View>(
    () => `
      SELECT cv.* FROM custom_view cv
      WHERE cv.id = ?
    `,
    () => [viewSlug()]
  )

  // Update view when it loads
  createEffect(() => {
    const viewsList = views()
    if (viewsList.length > 0) {
      setView(viewsList[0])
      useMetadata({ title: getTitle(viewsList[0].name) })
    }
  })

  // Build dynamic query based on filters
  const buildIssueQuery = () => {
    const currentView = view()
    if (!currentView) return null

    let query = `SELECT ${ISSUE_FIELDS}`
    const conditions: string[] = []

    // Parse filters from JSON
    let filters: Record<string, any> = {}
    try {
      filters = JSON.parse(currentView.filters)
    } catch {
      // Invalid JSON, use empty filters
    }

    // Add filter conditions
    if (filters.teamIds && Array.isArray(filters.teamIds) && filters.teamIds.length > 0) {
      const ids = filters.teamIds.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(",")
      conditions.push(`t.id IN (${ids})`)
    }

    if (filters.statusIds && Array.isArray(filters.statusIds) && filters.statusIds.length > 0) {
      const ids = filters.statusIds.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(",")
      conditions.push(`ws.id IN (${ids})`)
    }

    if (
      filters.assigneeIds &&
      Array.isArray(filters.assigneeIds) &&
      filters.assigneeIds.length > 0
    ) {
      const ids = filters.assigneeIds.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(",")
      conditions.push(`i.assignee_id IN (${ids})`)
    }

    if (filters.priorities && Array.isArray(filters.priorities) && filters.priorities.length > 0) {
      const ids = filters.priorities.join(",")
      conditions.push(`i.priority IN (${ids})`)
    }

    // Add where clause if there are conditions
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`
    }

    query += ` ORDER BY i.sort_order ASC, i.created_at DESC`

    return query
  }

  // Query issues based on filters
  const [issues] = usePowerSyncQuery<IssueRow>(
    () => buildIssueQuery() ?? `SELECT ${ISSUE_FIELDS} WHERE 1=0`,
    () => [viewSlug()]
  )

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <div class="flex items-center gap-1.5 text-[13px] flex-1">
          <a
            href={`/${workspaceSlug()}/views/issues`}
            class="text-muted-foreground hover:text-foreground"
          >
            Views
          </a>
          <span class="text-muted-foreground/40">/</span>
          <span class="text-foreground font-medium">{view()?.name ?? "Loading..."}</span>
        </div>
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/60 text-[12px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <EditIcon class="size-3.5" />
          Edit view
        </button>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={issues().length > 0}
          fallback={
            <div class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <ViewIcon class="size-10 opacity-20" />
              <div class="text-center">
                <p class="text-[14px] font-medium text-foreground/60 mb-1">
                  {view()?.name ?? "This view"}
                </p>
                <p class="text-[13px] text-muted-foreground/60">
                  This view has no issues matching its filters.
                </p>
              </div>
            </div>
          }
        >
          <div>
            <div class="sticky top-0 flex items-center gap-2 border-b border-border/20 bg-background/50 px-4 py-2">
              <span class="text-[12px] font-medium text-muted-foreground">{view()?.name}</span>
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
      class="flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors border-b border-border/20 last:border-b-0"
    >
      <PriorityIcon value={props.priority} class="size-3.5 shrink-0" />
      <StatusIcon category={props.status} class="size-3.5 shrink-0" />
      <span class="font-mono text-[12px] text-muted-foreground w-16 shrink-0">{props.issueId}</span>
      <span class="text-[13px] text-foreground flex-1 truncate">{props.title}</span>

      <Show when={props.labels.length > 0}>
        <div class="flex items-center gap-1 shrink-0">
          <For each={props.labels}>
            {(label) => (
              <span class="text-[11px] px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground truncate max-w-[80px]">
                {label}
              </span>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.dueDate}>
        <span class="text-[12px] text-muted-foreground shrink-0">{props.dueDate}</span>
      </Show>
    </a>
  )
}

function EditIcon(props: { class?: string }) {
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
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function ViewIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      aria-hidden="true"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  )
}
