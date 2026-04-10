import { createEffect, createSignal, For, onCleanup, onMount } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { navigate } from "vike/client/router"
import { usePowerSyncQuery } from "@/lib/powersync"
import { honoClient } from "@/lib/hono-client"
import getTitle from "@/utils/get-title"
import { PillTabs } from "@/components/pill-tabs"

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
  useMetadata({ title: getTitle("New View") })
  const pageCtx = usePageContext()
  const workspaceSlug = () => (pageCtx.routeParams as Record<string, string>).workspace ?? ""

  const [viewName, setViewName] = createSignal("")
  const [viewDescription, setViewDescription] = createSignal("")
  const [isCreating, setIsCreating] = createSignal(false)
  const [workspaceId, setWorkspaceId] = createSignal<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = createSignal<Set<string>>(new Set())

  // Esc key: blur focused input on first press, navigate back on second press
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return
    const active = document.activeElement
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      ;(active as HTMLElement).blur()
      return
    }
    navigate(`/${workspaceSlug()}/views/issues`)
  }

  onMount(() => document.addEventListener("keydown", handleKeyDown))
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown))

  // Load workspace ID
  createEffect(() => {
    if (workspaceId()) return
    const load = async () => {
      try {
        const client = honoClient()
        const res = await client.workspaces.$get()
        if (!res.ok) return
        const data = await res.json()
        const ws = (data as any).workspaces?.find((w: any) => w.slug === workspaceSlug())
        if (ws) setWorkspaceId(ws.id)
      } catch {}
    }
    load()
  })

  // All issues in the workspace grouped by status
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

  const handleSave = async () => {
    if (!viewName().trim() || !workspaceId()) return
    try {
      setIsCreating(true)
      const client = honoClient()
      const res = await (client.workspaces as any)[":workspaceId"].views.$post({
        param: { workspaceId: workspaceId()! },
        json: {
          name: viewName(),
          description: viewDescription() || undefined,
          type: "issue",
          filters: {},
          isShared: false,
        },
      })
      if (!res.ok) return
      const data = await res.json()
      const viewId = (data as any).view?.id
      navigate(viewId ? `/${workspaceSlug()}/view/${viewId}` : `/${workspaceSlug()}/views/issues`)
    } catch (error) {
      console.error("Failed to create view:", error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <>
      {/* Breadcrumb - OUTSIDE the card */}
      <div class="flex items-center justify-between px-4 py-2 text-[13px] text-muted-foreground shrink-0">
        <div class="flex items-center gap-1.5">
          <a
            href={`/${workspaceSlug()}/views/issues`}
            class="hover:text-foreground transition-colors"
          >
            Views
          </a>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-3"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span class="text-foreground">All issues</span>
        </div>
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
      </div>

      {/* Card with border - header + tabs only */}
      <div class="flex shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card mx-2 mt-2">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div class="shrink-0 border-b border-border px-5 pt-4 pb-3.5">
          {/* Row 1: icon + title + actions */}
          <div class="flex items-center gap-3">
            {/* Icon button */}
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-foreground/70 transition-colors hover:bg-muted"
            >
              <LayersIcon class="size-4" />
            </button>

            {/* Title input */}
            <input
              type="text"
              value={viewName()}
              onInput={(e) => setViewName(e.currentTarget.value)}
              placeholder="All issues"
              class="min-w-0 flex-1 bg-transparent text-[18px] font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />

            {/* Actions */}
            <div class="flex shrink-0 items-center gap-2">
              <span class="text-[13px] text-muted-foreground">Save to</span>
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1 text-[13px] font-medium text-foreground transition-colors hover:bg-white/5"
              >
                <LockIcon class="size-3 text-muted-foreground" />
                Personal
              </button>
              <button
                type="button"
                onClick={() => navigate(`/${workspaceSlug()}/views/issues`)}
                class="rounded-full px-3 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!viewName().trim() || isCreating() || !workspaceId()}
                class="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isCreating() ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Row 2: description — indented to align with title */}
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

        {/* ── Tabs + controls ─────────────────────────────────────── */}
        <div class="flex shrink-0 items-center border-b border-border px-4 py-2">
          <div class="flex-1">
            <PillTabs
              tabs={[
                { label: "Issues", href: `/${workspaceSlug()}/views/issues/new` },
                { label: "Projects", href: `/${workspaceSlug()}/views/projects/new` },
              ]}
              active="issues"
              variant="compact"
              containerClass="flex items-center gap-1"
            />
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <FilterIcon class="size-3.5" />
            </button>
            <button
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <DisplayIcon class="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Issue list ──────────────────────────────────────────── */}
      <div class="flex-1 overflow-y-auto px-2 mt-2">
        <For each={groupedIssues()}>
          {(group) => (
            <GroupSection
              group={group}
              workspaceSlug={workspaceSlug()}
              collapsed={collapsedGroups().has(group.id)}
              onToggle={() => toggleGroup(group.id)}
            />
          )}
        </For>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// GroupSection
// ---------------------------------------------------------------------------

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

        <StatusCircle category={category()} color={props.group.color} class="size-3.5 shrink-0" />

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
      {!props.collapsed && (
        <For each={props.group.issues}>
          {(issue) => <IssueItem issue={issue} workspaceSlug={props.workspaceSlug} />}
        </For>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// IssueItem
// ---------------------------------------------------------------------------

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
      <StatusCircle
        category={category()}
        color={props.issue.status_color}
        class="size-3.5 shrink-0"
      />

      {/* Title */}
      <span class="flex-1 truncate text-[13px] text-foreground">{props.issue.title}</span>

      {/* Priority */}
      <PriorityIcon priority={priority()} class="size-3.5 shrink-0 text-muted-foreground/60" />

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
// Icons
// ---------------------------------------------------------------------------

function LayersIcon(props: { class?: string }) {
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
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function LockIcon(props: { class?: string }) {
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
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="12" y1="18" x2="12" y2="18" stroke-width="3" stroke-linecap="round" />
    </svg>
  )
}

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
