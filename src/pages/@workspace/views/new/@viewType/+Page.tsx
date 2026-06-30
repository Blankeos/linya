import { createMemo, For, Match, Show, Switch as SolidSwitch } from "solid-js"
import { usePageContext } from "vike-solid/usePageContext"
import { usePowerSyncQuery } from "@/lib/powersync"
import { useNewView } from "../+Layout"
import {
  ProjectStatusIcon,
  type ProjectStatus,
} from "@/components/issue-fields"
import {
  type IssueRow as SharedIssueRow,
  type BoardColumn,
  ISSUE_FIELDS,
  STATUS_DISPLAY_ORDER,
  BOARD_COLUMN_ORDER,
  statusLabel,
  ListView,
  BoardView,
} from "@/components/issues-shared"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

  const [issues] = usePowerSyncQuery<SharedIssueRow>(
    () => `SELECT ${ISSUE_FIELDS} ORDER BY i.sort_order ASC, i.created_at DESC`,
    () => []
  )

  const listGroups = createMemo((): BoardColumn[] => {
    const map = new Map<string, SharedIssueRow[]>()
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
    const map = new Map<string, SharedIssueRow[]>()
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
    <div class="flex-1 overflow-hidden">
      <SolidSwitch>
        <Match when={ctx.displayView() === "list"}>
          <ListView
            groups={listGroups()}
            workspaceSlug={ctx.workspaceSlug()}
            showEmptyGroups={ctx.showEmptyGroups()}
          />
        </Match>
        <Match when={ctx.displayView() === "board"}>
          <BoardView
            columns={boardColumns()}
            workspaceSlug={ctx.workspaceSlug()}
            showEmptyColumns={ctx.showEmptyColumns()}
          />
        </Match>
      </SolidSwitch>
    </div>
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
