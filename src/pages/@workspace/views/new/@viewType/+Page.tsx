import { createSignal, For, Show } from "solid-js"
import { usePageContext } from "vike-solid/usePageContext"
import { usePowerSyncQuery } from "@/lib/powersync"
import { useNewView } from "../+Layout"
import {
  StatusIcon,
  PriorityIcon,
  ProjectStatusIcon,
  type ProjectStatus,
} from "@/components/issue-fields"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IssueRow = {
  id: string
  title: string
  priority: number
  due_date: string | null
  number: number
  team_identifier: string
  status_id: string | null
  status_name: string | null
  status_category: string | null
  status_color: string | null
}

type StatusGroup = {
  id: string
  name: string
  category: string
  color: string
  issues: IssueRow[]
}

type ProjectRow = {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  status: string
  lead_id: string | null
  start_date: string | null
  target_date: string | null
  created_at: string
}

type Priority = "urgent" | "high" | "medium" | "low" | "none"
type StatusCategory = "backlog" | "unstarted" | "started" | "completed" | "cancelled"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function mapStatusCategory(category: string | null): StatusCategory {
  switch (category) {
    case "backlog":
      return "backlog"
    case "unstarted":
      return "unstarted"
    case "started":
      return "started"
    case "completed":
      return "completed"
    case "cancelled":
      return "cancelled"
    default:
      return "backlog"
  }
}

function mapProjectStatus(status: string | null): ProjectStatus {
  switch (status) {
    case "planned":
      return "planned"
    case "in_progress":
      return "in_progress"
    case "completed":
      return "completed"
    case "canceled":
      return "canceled"
    default:
      return "backlog"
  }
}

function formatDate(date: string | null): string | null {
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewViewPage() {
  const pageCtx = usePageContext()
  const viewType = () => {
    const type = (pageCtx.routeParams as Record<string, string>).viewType
    return type === "projects" ? "projects" : "issues"
  }

  return (
    <Show when={viewType() === "issues"} fallback={<ProjectsView />}>
      <IssuesView />
    </Show>
  )
}

// ---------------------------------------------------------------------------
// Issues View
// ---------------------------------------------------------------------------

function IssuesView() {
  const ctx = useNewView()
  const [collapsedGroups, setCollapsedGroups] = createSignal<Set<string>>(new Set())

  const [issues] = usePowerSyncQuery<IssueRow>(
    () => `
      SELECT
        i.id,
        i.title,
        i.priority,
        i.due_date,
        i.number,
        t.identifier as team_identifier,
        ws.id as status_id,
        ws.name as status_name,
        ws.category as status_category,
        ws.color as status_color
      FROM issue i
      LEFT JOIN team t ON i.team_id = t.id
      LEFT JOIN workflow_status ws ON i.status_id = ws.id
      ORDER BY ws.position ASC, i.sort_order ASC, i.created_at DESC
    `,
    () => []
  )

  const groupedIssues = (): StatusGroup[] => {
    const map = new Map<string, StatusGroup>()
    for (const issue of issues()) {
      const key = issue.status_id ?? "__none__"
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: issue.status_name ?? "No Status",
          category: issue.status_category ?? "backlog",
          color: issue.status_color ?? "#6b7280",
          issues: [],
        })
      }
      map.get(key)!.issues.push(issue)
    }
    return Array.from(map.values())
  }

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div class="flex-1 overflow-y-auto px-2 mt-2">
      <For each={groupedIssues()}>
        {(group) => (
          <GroupSection
            group={group}
            workspaceSlug={ctx.workspaceSlug()}
            collapsed={collapsedGroups().has(group.id)}
            onToggle={() => toggleGroup(group.id)}
          />
        )}
      </For>
    </div>
  )
}

function GroupSection(props: {
  group: StatusGroup
  workspaceSlug: string
  collapsed: boolean
  onToggle: () => void
}) {
  const category = () => mapStatusCategory(props.group.category)

  return (
    <div>
      {/* Group header */}
      <div class="group/header sticky top-0 z-10 flex items-center gap-2 border-b border-border/20 bg-card/95 px-4 py-1.5 backdrop-blur-sm rounded-lg">
        <button
          type="button"
          onClick={props.onToggle}
          class="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-muted-foreground"
        >
          <ChevronDownIcon
            class={`size-3 transition-transform ${props.collapsed ? "-rotate-90" : ""}`}
          />
        </button>

        <StatusIcon category={category()} color={props.group.color} class="size-3.5 shrink-0" />

        <span class="text-[13px] font-medium text-foreground">{props.group.name}</span>
        <span class="text-[12px] text-muted-foreground/60">{props.group.issues.length}</span>

        <button
          type="button"
          class="ml-auto flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-all hover:bg-white/5 hover:text-muted-foreground group-hover/header:opacity-100"
        >
          <PlusIcon class="size-3" />
        </button>
      </div>

      {/* Issues */}
      <Show when={!props.collapsed}>
        <For each={props.group.issues}>
          {(issue) => <IssueItem issue={issue} workspaceSlug={props.workspaceSlug} />}
        </For>
      </Show>
    </div>
  )
}

function IssueItem(props: { issue: IssueRow; workspaceSlug: string }) {
  const priority = () => mapPriority(props.issue.priority)
  const category = () => mapStatusCategory(props.issue.status_category)
  const issueId = () => `${props.issue.team_identifier}-${props.issue.number}`
  const href = () => `/${props.workspaceSlug}/issue/${issueId()}/${slugify(props.issue.title)}`
  const date = () => formatDate(props.issue.due_date ?? props.issue.id)

  return (
    <a
      href={href()}
      class="group/row flex items-center gap-2 border-b border-border/10 px-4 py-2 transition-colors hover:bg-white/5 last:border-b-0 rounded-lg"
    >
      {/* Drag handle */}
      <span class="shrink-0 cursor-grab text-muted-foreground/20 transition-opacity group-hover/row:text-muted-foreground/40">
        <DragHandleIcon class="size-3" />
      </span>

      {/* Issue ID */}
      <span class="w-14 shrink-0 font-mono text-[12px] text-muted-foreground/60">{issueId()}</span>

      {/* Status circle */}
      <StatusIcon
        category={category()}
        color={props.issue.status_color}
        class="size-3.5 shrink-0"
      />

      {/* Title */}
      <span class="flex-1 truncate text-[13px] text-foreground">{props.issue.title}</span>

      {/* Priority */}
      <PriorityIcon value={priority()} class="size-3.5 shrink-0 text-muted-foreground/60" />

      {/* Assignee avatar placeholder */}
      <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/60">
        <PersonIcon class="size-2.5" />
      </span>

      {/* Date */}
      <span class="w-12 shrink-0 text-right text-[12px] text-muted-foreground/60">{date()}</span>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Projects View
// ---------------------------------------------------------------------------

function ProjectsView() {
  const ctx = useNewView()

  const [projects] = usePowerSyncQuery<ProjectRow>(
    () => `
      SELECT
        p.id,
        p.name,
        p.description,
        p.icon,
        p.color,
        p.status,
        p.lead_id,
        p.start_date,
        p.target_date,
        p.created_at
      FROM project p
      JOIN workspace w ON p.workspace_id = w.id
      WHERE w.slug = ?
      ORDER BY 
        CASE p.status
          WHEN 'backlog' THEN 1
          WHEN 'planned' THEN 2
          WHEN 'in_progress' THEN 3
          WHEN 'completed' THEN 4
          WHEN 'canceled' THEN 5
          ELSE 6
        END,
        p.sort_order ASC,
        p.created_at DESC
    `,
    () => [ctx.workspaceSlug()]
  )

  const groupedProjects = () => {
    const groups: Record<ProjectStatus, ProjectRow[]> = {
      backlog: [],
      planned: [],
      in_progress: [],
      completed: [],
      canceled: [],
    }
    for (const project of projects()) {
      const status = mapProjectStatus(project.status)
      groups[status].push(project)
    }
    return groups
  }

  const statusConfig: Record<ProjectStatus, { label: string; color: string }> = {
    backlog: { label: "Backlog", color: "#6b7280" },
    planned: { label: "Planned", color: "#3b82f6" },
    in_progress: { label: "In Progress", color: "#f59e0b" },
    completed: { label: "Completed", color: "#22c55e" },
    canceled: { label: "Canceled", color: "#ef4444" },
  }

  return (
    <div class="flex-1 overflow-y-auto px-2 mt-2">
      <For each={Object.entries(groupedProjects())}>
        {([status, projects]) => (
          <Show when={projects.length > 0}>
            <div>
              {/* Group header */}
              <div class="sticky top-0 z-10 flex items-center gap-2 border-b border-border/20 bg-card/95 px-4 py-1.5 backdrop-blur-sm rounded-lg">
                <ProjectStatusIcon
                  status={status as ProjectStatus}
                  color={statusConfig[status as ProjectStatus].color}
                  class="size-3.5 shrink-0"
                />
                <span class="text-[13px] font-medium text-foreground">
                  {statusConfig[status as ProjectStatus].label}
                </span>
                <span class="text-[12px] text-muted-foreground/60">{projects.length}</span>
              </div>

              {/* Projects */}
              <For each={projects}>
                {(project) => <ProjectItem project={project} workspaceSlug={ctx.workspaceSlug()} />}
              </For>
            </div>
          </Show>
        )}
      </For>
    </div>
  )
}

function ProjectItem(props: { project: ProjectRow; workspaceSlug: string }) {
  const projectHref = () =>
    `/${props.workspaceSlug}/project/${props.project.id}/${slugify(props.project.name)}`
  const status = () => mapProjectStatus(props.project.status)
  const dateRange = () => {
    const start = formatDate(props.project.start_date)
    const end = formatDate(props.project.target_date)
    if (start && end) return `${start} - ${end}`
    if (end) return `Due ${end}`
    return null
  }

  return (
    <a
      href={projectHref()}
      class="group/row flex items-center gap-2 border-b border-border/10 px-4 py-2 transition-colors hover:bg-white/5 last:border-b-0 rounded-lg"
    >
      {/* Drag handle */}
      <span class="shrink-0 cursor-grab text-muted-foreground/20 transition-opacity group-hover/row:text-muted-foreground/40">
        <DragHandleIcon class="size-3" />
      </span>

      {/* Project icon */}
      <div
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-medium"
        style={{ background: props.project.color || "#6b7280" }}
      >
        {props.project.icon || "📁"}
      </div>

      {/* Status circle */}
      <ProjectStatusIcon status={status()} color={props.project.color} class="size-3.5 shrink-0" />

      {/* Title */}
      <span class="flex-1 truncate text-[13px] text-foreground">{props.project.name}</span>

      {/* Description preview */}
      <Show when={!!props.project.description}>
        <span class="hidden max-w-[200px] truncate text-[12px] text-muted-foreground/60 sm:block">
          {props.project.description}
        </span>
      </Show>

      {/* Lead avatar placeholder */}
      <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/60">
        <PersonIcon class="size-2.5" />
      </span>

      {/* Date range */}
      <Show when={!!dateRange()}>
        <span class="shrink-0 text-[12px] text-muted-foreground/60">{dateRange()}</span>
      </Show>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ChevronDownIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <polyline points="6 9 12 15 18 9" />
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
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function DragHandleIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      class={props.class}
    >
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
    </svg>
  )
}

function PersonIcon(props: { class?: string }) {
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
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20 C4 16 20 16 20 20" />
    </svg>
  )
}

function PriorityIcon(props: { priority: Priority; class?: string }) {
  const colorMap: Record<Priority, string> = {
    urgent: "rgb(239, 68, 68)",
    high: "rgb(251, 146, 60)",
    medium: "rgb(34, 197, 94)",
    low: "rgb(59, 130, 246)",
    none: "rgb(107, 114, 128)",
  }
  const c = colorMap[props.priority]
  const dim = "rgba(107, 114, 128, 0.2)"

  return (
    <svg viewBox="0 0 8 16" fill="currentColor" class={props.class}>
      <rect y="0" width="8" height="4" fill={props.priority === "urgent" ? c : dim} />
      <rect
        y="4"
        width="8"
        height="4"
        fill={["urgent", "high"].includes(props.priority) ? c : dim}
      />
      <rect
        y="8"
        width="8"
        height="4"
        fill={["urgent", "high", "medium"].includes(props.priority) ? c : dim}
      />
      <rect y="12" width="8" height="4" fill={props.priority !== "none" ? c : dim} />
    </svg>
  )
}

function StatusCircle(props: { category: StatusCategory; color: string | null; class?: string }) {
  const color = props.color ?? "#6b7280"

  switch (props.category) {
    case "backlog":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          stroke-width="2"
          class={props.class}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2" />
        </svg>
      )
    case "unstarted":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          stroke-width="2"
          class={props.class}
        >
          <circle cx="12" cy="12" r="9" />
        </svg>
      )
    case "started":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class={props.class}>
          <circle cx="12" cy="12" r="9" fill={color} opacity="0.2" />
          <path
            d="M12 3 A9 9 0 0 1 21 12"
            stroke={color}
            stroke-width="2"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
      )
    case "completed":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={color}
          class={props.class}
        >
          <circle cx="12" cy="12" r="9" opacity="0.2" />
          <circle cx="12" cy="12" r="9" fill="none" stroke={color} stroke-width="2" />
          <polyline
            points="7 12 10.5 15.5 17 9"
            fill="none"
            stroke={color}
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      )
    case "cancelled":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class={props.class}>
          <circle cx="12" cy="12" r="9" stroke={color} stroke-width="2" opacity="0.5" />
          <line
            x1="8"
            y1="8"
            x2="16"
            y2="16"
            stroke={color}
            stroke-width="2"
            stroke-linecap="round"
          />
          <line
            x1="16"
            y1="8"
            x2="8"
            y2="16"
            stroke={color}
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      )
  }
}

function ProjectStatusCircle(props: {
  status: ProjectStatus
  color: string | null
  class?: string
}) {
  const color = props.color ?? "#6b7280"

  switch (props.status) {
    case "backlog":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          stroke-width="2"
          class={props.class}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2" />
        </svg>
      )
    case "planned":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          stroke-width="2"
          class={props.class}
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" fill={color} />
        </svg>
      )
    case "in_progress":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class={props.class}>
          <circle cx="12" cy="12" r="9" fill={color} opacity="0.2" />
          <path
            d="M12 3 A9 9 0 0 1 21 12"
            stroke={color}
            stroke-width="2"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
      )
    case "completed":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={color}
          class={props.class}
        >
          <circle cx="12" cy="12" r="9" opacity="0.2" />
          <circle cx="12" cy="12" r="9" fill="none" stroke={color} stroke-width="2" />
          <polyline
            points="7 12 10.5 15.5 17 9"
            fill="none"
            stroke={color}
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      )
    case "canceled":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class={props.class}>
          <circle cx="12" cy="12" r="9" stroke={color} stroke-width="2" opacity="0.5" />
          <line
            x1="8"
            y1="8"
            x2="16"
            y2="16"
            stroke={color}
            stroke-width="2"
            stroke-linecap="round"
          />
          <line
            x1="16"
            y1="8"
            x2="8"
            y2="16"
            stroke={color}
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      )
  }
}
