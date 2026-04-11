/**
 * Shared components, types, constants, and helpers for issues list/board views.
 * Used by both My Issues and Team Issues pages.
 */

import type { JSX } from "solid-js"
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  on,
  Show,
  Switch as SolidSwitch,
} from "solid-js"
import { navigate } from "vike/client/router"
import { IconMore, IconPlus } from "@/assets/icons"
import {
  DragAndDropProvider,
  DraggableItem,
  Droppable,
  type OnDropEvent,
  useAutoScroll,
} from "@/components/drag-and-drop"
import { PriorityIcon, StatusIcon } from "@/components/issue-fields"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PopoverComp } from "@/components/ui/popover"
import { SwitchCompact } from "@/components/ui/switch"
import { cn } from "@/utils/cn"

// ============================================================
// Types
// ============================================================

export type IssueRow = {
  id: string
  title: string
  priority: number
  due_date: string | null
  created_at: string | null
  number: number
  sort_order: number
  status_id: string | null
  team_identifier: string
  status_name: string | null
  status_category: string | null
  status_color: string | null
  status_position: number
  assignee_name: string | null
  assignee_avatar: string | null
  labels: string | null
}

export type StatusRow = {
  id: string
  name: string
  category: string
  color: string | null
  position: number
}

export type BoardColumn = {
  id: string
  name: string
  category: string
  color: string | null
  issues: IssueRow[]
}

// ============================================================
// SQL fragment
// Usage: `SELECT ${ISSUE_FIELDS} WHERE ... ORDER BY ...`
// ============================================================

export const ISSUE_FIELDS = `
  i.id,
  i.title,
  i.priority,
  i.due_date,
  i.created_at,
  i.number,
  i.sort_order,
  i.status_id,
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

// ============================================================
// Constants
// ============================================================

// For list view: most actionable statuses first
export const STATUS_DISPLAY_ORDER: Record<string, number> = {
  started: 0,
  unstarted: 1,
  backlog: 2,
  completed: 3,
  cancelled: 4,
  triage: 5,
  in_review: 6,
  duplicate: 7,
}

// For board columns: left-to-right workflow order
export const BOARD_COLUMN_ORDER: Record<string, number> = {
  triage: 0,
  backlog: 1,
  unstarted: 2,
  started: 3,
  in_review: 4,
  completed: 5,
  cancelled: 6,
  duplicate: 7,
}

export type DisplayProp =
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

export const ALL_DISPLAY_PROPS: DisplayProp[] = [
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

export const DEFAULT_ACTIVE_PROPS = new Set<DisplayProp>([
  "ID",
  "Status",
  "Assignee",
  "Priority",
  "Project",
  "Due date",
  "Labels",
  "Created",
])

export const FILTER_GROUPS = [
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

// ============================================================
// Helpers
// ============================================================

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
}

export function formatDateShort(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function statusLabel(category: string): string {
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

// ============================================================
// IssueGroupView — collapsible status group header + draggable rows
// ============================================================

function IssueGroupView(props: {
  group: BoardColumn
  workspaceSlug: string
  onNewIssue?: (category?: string) => void
}) {
  const [collapsed, setCollapsed] = createSignal(false)

  return (
    <div>
      <Droppable
        id={`group-${props.group.id}`}
        type="list-item"
        data={{ kind: "group", groupId: props.group.id }}
      >
        {(groupState, groupRef) => (
          <div
            ref={groupRef}
            class={cn(
              "group sticky top-0 flex w-full items-center gap-2 border-border/20 border-b bg-background/50 px-4 py-2 transition-colors",
              groupState() === "over" ? "bg-primary/5" : "hover:bg-white/[0.02]"
            )}
          >
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              class="flex shrink-0 items-center"
            >
              <ChevronRightIcon
                class="size-3 text-muted-foreground/50 transition-transform"
                style={{ transform: collapsed() ? "rotate(0deg)" : "rotate(90deg)" }}
              />
            </button>
            <StatusIcon
              category={props.group.category}
              color={props.group.color}
              class="size-3.5 shrink-0"
            />
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              class="flex flex-1 items-center gap-2 text-left"
            >
              <span class="font-medium text-[12px] text-muted-foreground">{props.group.name}</span>
              <span class="rounded-full bg-secondary/50 px-1.5 py-0.5 text-[11px] text-muted-foreground/50">
                {props.group.issues.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => props.onNewIssue?.(props.group.category)}
              class="rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
              title={`New ${props.group.name} issue`}
            >
              <PlusIcon class="size-3.5" />
            </button>
          </div>
        )}
      </Droppable>

      <Show when={!collapsed()}>
        <For each={props.group.issues}>
          {(issue) => (
            <DraggableItem
              id={issue.id}
              type="list-item"
              data={{ kind: "item", issueId: issue.id, groupId: props.group.id }}
              dropTargetType="list-item"
            >
              {(itemState, itemRef) => (
                <div
                  ref={itemRef}
                  class={cn(
                    itemState() === "idle" && "cursor-grab",
                    itemState() === "dragging" && "cursor-grabbing"
                  )}
                >
                  <Show when={itemState() === "over"}>
                    <div class="mx-4 h-0.5 rounded-full bg-primary/60" />
                  </Show>
                  <div class={cn("transition-opacity", itemState() === "dragging" && "opacity-40")}>
                    <IssueListRow issue={issue} workspaceSlug={props.workspaceSlug} />
                  </div>
                </div>
              )}
            </DraggableItem>
          )}
        </For>
      </Show>
    </div>
  )
}

// ============================================================
// ListView — grouped list view with drag-and-drop
// ============================================================

export function ListView(props: {
  groups: BoardColumn[]
  workspaceSlug: string
  showEmptyGroups: boolean
  onNewIssue?: (category?: string) => void
}) {
  const listScrollRef = useAutoScroll()

  const [localGroups, setLocalGroups] = createSignal<BoardColumn[]>(
    props.groups.map((g) => ({ ...g, issues: [...g.issues] }))
  )

  createEffect(
    on(
      () => props.groups,
      (groups) => setLocalGroups(groups.map((g) => ({ ...g, issues: [...g.issues] })))
    )
  )

  const visibleGroups = () =>
    props.showEmptyGroups ? localGroups() : localGroups().filter((g) => g.issues.length > 0)

  function moveItem(
    sourceIssueId: string,
    sourceGroupId: string,
    targetIssueId: string | null,
    targetGroupId: string
  ) {
    if (sourceIssueId === targetIssueId) return
    setLocalGroups((groups) => {
      const next = groups.map((g) => ({ ...g, issues: [...g.issues] }))
      const srcGroup = next.find((g) => g.id === sourceGroupId)
      if (!srcGroup) return groups
      const srcIdx = srcGroup.issues.findIndex((i) => i.id === sourceIssueId)
      if (srcIdx === -1) return groups
      const [issue] = srcGroup.issues.splice(srcIdx, 1)
      const tgtGroup = next.find((g) => g.id === targetGroupId)
      if (!tgtGroup) return groups
      if (targetIssueId === null) {
        tgtGroup.issues.push(issue)
      } else {
        const tgtIdx = tgtGroup.issues.findIndex((i) => i.id === targetIssueId)
        tgtGroup.issues.splice(tgtIdx === -1 ? tgtGroup.issues.length : tgtIdx, 0, issue)
      }
      return next
    })
  }

  function handleDrop(event: OnDropEvent) {
    const src = event.sourceData as { kind: string; issueId: string; groupId: string }
    const tgt = event.targetData as { kind: string; issueId?: string; groupId: string }
    if (src.kind !== "item") return
    if (tgt.kind === "item") {
      moveItem(src.issueId, src.groupId, tgt.issueId!, tgt.groupId)
    } else if (tgt.kind === "group") {
      moveItem(src.issueId, src.groupId, null, tgt.groupId)
    }
  }

  return (
    <DragAndDropProvider instanceId="list" onDrop={handleDrop}>
      <div ref={listScrollRef} class="h-full overflow-y-auto">
        <For each={visibleGroups()}>
          {(group) => (
            <IssueGroupView
              group={group}
              workspaceSlug={props.workspaceSlug}
              onNewIssue={props.onNewIssue}
            />
          )}
        </For>
      </div>
    </DragAndDropProvider>
  )
}

// ============================================================
// IssueListRow — single issue row in list view
// ============================================================

export function IssueListRow(props: { issue: IssueRow; workspaceSlug: string }) {
  const issue = () => props.issue
  const identifier = () => `${issue().team_identifier}-${issue().number}`
  const labels = () => (issue().labels ? issue().labels!.split(",").filter(Boolean) : [])
  const dueDate = () => formatDateShort(issue().due_date)

  return (
    <button
      type="button"
      onClick={() => {
        navigate(`/${props.workspaceSlug}/issue/${identifier()}/${slugify(issue().title)}`)
      }}
      class="group flex w-full cursor-pointer items-center gap-3 border-border/30 border-b px-4 py-1.5 text-left hover:bg-white/[0.03]"
    >
      <PriorityIcon value={issue().priority} class="size-3.5 shrink-0" />
      <StatusIcon
        category={issue().status_category}
        color={issue().status_color}
        class="size-4 shrink-0"
      />
      <span class="w-14 shrink-0 select-none font-mono text-[12px] text-muted-foreground/60">
        {identifier()}
      </span>
      <span class="flex-1 select-none truncate text-[13px] text-foreground">{issue().title}</span>
      <Show when={labels().length > 0}>
        <div class="hidden shrink-0 items-center gap-1 sm:flex">
          <For each={labels()}>
            {(label) => (
              <span class="select-none rounded-full border border-border/50 px-1.5 py-0.5 text-[11px] text-muted-foreground/70">
                {label}
              </span>
            )}
          </For>
        </div>
      </Show>
      <Show when={dueDate()}>
        <span class="hidden select-none shrink-0 text-[11px] text-muted-foreground/60 md:block">
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
          <span class="select-none font-medium text-[9px] text-primary">
            {issue().assignee_name!.charAt(0).toUpperCase()}
          </span>
        </div>
      </Show>
    </button>
  )
}

// ============================================================
// HiddenColumnsPanel — collapsed empty columns list
// ============================================================

function HiddenColumnsPanel(props: { columns: BoardColumn[] }) {
  const [collapsed, setCollapsed] = createSignal(false)

  return (
    <div class="flex w-[280px] shrink-0 flex-col">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        class="flex items-center gap-2 px-3 py-2"
      >
        <svg
          viewBox="0 0 16 16"
          class="size-3 shrink-0 text-muted-foreground/60 transition-transform"
          style={{ transform: collapsed() ? "rotate(-90deg)" : "rotate(0deg)" }}
          fill="currentColor"
        >
          <path
            d="M4 6 L8 10 L12 6"
            stroke="currentColor"
            stroke-width="1.5"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="font-medium text-[12px] text-muted-foreground">Hidden columns</span>
      </button>
      <Show when={!collapsed()}>
        <div class="flex flex-col gap-1.5">
          <For each={props.columns}>
            {(column) => (
              <Droppable
                id={`hidden-col-${column.id}`}
                type="card"
                data={{ kind: "hidden-column", columnId: column.id }}
              >
                {(state, ref) => (
                  <div
                    ref={ref}
                    class={cn(
                      "flex items-center gap-2.5 rounded-lg border border-border/40 bg-card px-3 py-2.5 shadow-xs transition-colors",
                      state() === "over" && "border-primary/60 bg-primary/5"
                    )}
                  >
                    <StatusIcon
                      category={column.category}
                      color={column.color}
                      class="size-3.5 shrink-0"
                    />
                    <span class="flex-1 text-[13px] text-foreground">{column.name}</span>
                    <span class="text-[12px] text-muted-foreground/50">0</span>
                  </div>
                )}
              </Droppable>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

// ============================================================
// BoardColumnView — single kanban column with auto-scroll
// ============================================================

function BoardColumnView(props: {
  column: BoardColumn
  workspaceSlug: string
  onNewIssue?: (category?: string) => void
}) {
  // Vertical auto-scroll for this column's card list
  const columnScrollRef = useAutoScroll()

  return (
    <div class="flex w-[280px] shrink-0 flex-col rounded-lg bg-board-column">
      {/* Column header */}
      <div class="flex items-center gap-2 px-3 py-2">
        <StatusIcon
          category={props.column.category}
          color={props.column.color}
          class="size-3.5 shrink-0"
        />
        <span class="font-medium text-[13px] text-foreground">{props.column.name}</span>
        <span class="text-[12px] text-muted-foreground/60">{props.column.issues.length}</span>
        <div class="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger class="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground">
            <IconMore class="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-44">
            <DropdownMenuItem>Select all in column</DropdownMenuItem>
            <DropdownMenuItem>Hide column</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={() => props.onNewIssue?.(props.column.category)}
          class="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
          title="Add new issue"
        >
          <IconPlus class="size-3.5" />
        </button>
      </div>

      {/* Column body — drop zone + vertical auto-scroll */}
      <Droppable
        id={`col-${props.column.id}`}
        type="card"
        data={{ kind: "column", columnId: props.column.id }}
      >
        {(colState, colRef) => (
          <div
            ref={(el) => {
              colRef(el)
              columnScrollRef(el)
            }}
            class={cn(
              "flex-1 overflow-y-auto px-2 pb-2 transition-colors",
              colState() === "over" && props.column.issues.length === 0 && "bg-white/[0.03]"
            )}
          >
            <div class="flex flex-col gap-2">
              <For each={props.column.issues}>
                {(issue) => (
                  <DraggableItem
                    id={issue.id}
                    type="card"
                    data={{ kind: "card", issueId: issue.id, columnId: props.column.id }}
                    dropTargetType="card"
                  >
                    {(cardState, cardRef) => (
                      <div
                        ref={cardRef}
                        class={cn(
                          "flex flex-col",
                          cardState() === "idle" && "cursor-grab",
                          cardState() === "dragging" && "cursor-grabbing"
                        )}
                      >
                        <Show when={cardState() === "over"}>
                          <div class="mb-1.5 h-0.5 w-full rounded-full bg-primary/60" />
                        </Show>
                        <div
                          class={cn(
                            "transition-opacity",
                            cardState() === "dragging" && "opacity-40"
                          )}
                        >
                          <BoardCard issue={issue} workspaceSlug={props.workspaceSlug} />
                        </div>
                      </div>
                    )}
                  </DraggableItem>
                )}
              </For>
            </div>
          </div>
        )}
      </Droppable>
    </div>
  )
}

// ============================================================
// BoardView — kanban columns
// ============================================================

export function BoardView(props: {
  columns: BoardColumn[]
  workspaceSlug: string
  showEmptyColumns?: boolean
  onNewIssue?: (category?: string) => void
}) {
  // Horizontal auto-scroll for the board container
  const boardScrollRef = useAutoScroll()

  // Local mutable copy for optimistic DnD updates
  const [localColumns, setLocalColumns] = createSignal<BoardColumn[]>(
    props.columns.map((c) => ({ ...c, issues: [...c.issues] }))
  )

  // Keep in sync with external data (PowerSync)
  createEffect(
    on(
      () => props.columns,
      (cols) => setLocalColumns(cols.map((c) => ({ ...c, issues: [...c.issues] })))
    )
  )

  const showEmpty = () => props.showEmptyColumns ?? true
  const visibleColumns = () =>
    showEmpty() ? localColumns() : localColumns().filter((c) => c.issues.length > 0)
  const hiddenColumns = () =>
    showEmpty() ? [] : localColumns().filter((c) => c.issues.length === 0)

  function moveCard(
    sourceIssueId: string,
    sourceColumnId: string,
    targetIssueId: string | null,
    targetColumnId: string
  ) {
    if (sourceIssueId === targetIssueId) return
    setLocalColumns((cols) => {
      const next = cols.map((c) => ({ ...c, issues: [...c.issues] }))
      const srcCol = next.find((c) => c.id === sourceColumnId)
      if (!srcCol) return cols
      const srcIdx = srcCol.issues.findIndex((i) => i.id === sourceIssueId)
      if (srcIdx === -1) return cols
      const [issue] = srcCol.issues.splice(srcIdx, 1)

      const tgtCol = next.find((c) => c.id === targetColumnId)
      if (!tgtCol) return cols

      if (targetIssueId === null) {
        tgtCol.issues.push(issue)
      } else {
        const tgtIdx = tgtCol.issues.findIndex((i) => i.id === targetIssueId)
        tgtCol.issues.splice(tgtIdx === -1 ? tgtCol.issues.length : tgtIdx, 0, issue)
      }
      return next
    })
  }

  function handleDrop(event: OnDropEvent) {
    const src = event.sourceData as { kind: string; issueId: string; columnId: string }
    const tgt = event.targetData as { kind: string; issueId?: string; columnId: string }
    if (src.kind !== "card") return

    if (tgt.kind === "card") {
      moveCard(src.issueId, src.columnId, tgt.issueId!, tgt.columnId)
    } else if (tgt.kind === "column" || tgt.kind === "hidden-column") {
      moveCard(src.issueId, src.columnId, null, tgt.columnId)
    }
  }

  return (
    <DragAndDropProvider instanceId="board" onDrop={handleDrop}>
      <div ref={boardScrollRef} class="flex h-full gap-4 overflow-x-auto p-4">
        <For each={visibleColumns()}>
          {(column) => (
            <BoardColumnView
              column={column}
              workspaceSlug={props.workspaceSlug}
              onNewIssue={props.onNewIssue}
            />
          )}
        </For>

        {/* Hidden columns panel — only when showEmptyColumns is off */}
        <Show when={hiddenColumns().length > 0}>
          <HiddenColumnsPanel columns={hiddenColumns()} />
        </Show>
      </div>
    </DragAndDropProvider>
  )
}

// ============================================================
// BoardCard — single issue card in board view
// ============================================================

export function BoardCard(props: { issue: IssueRow; workspaceSlug: string }) {
  const issue = () => props.issue
  const identifier = () => `${issue().team_identifier}-${issue().number}`
  const labels = () => (issue().labels ? issue().labels!.split(",").filter(Boolean) : [])
  const createdLabel = () => {
    const iso = issue().created_at
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    return `Created ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
  }

  return (
    <button
      type="button"
      class="flex w-full select-none flex-col gap-2.5 rounded-md border border-border/40 bg-card p-3 text-start shadow-xs transition-colors hover:border-border/70"
      onClick={() => {
        navigate(`/${props.workspaceSlug}/issue/${identifier()}/${slugify(issue().title)}`)
      }}
    >
      {/* Row 1: identifier + assignee (top-right) */}
      <div class="flex items-start gap-2">
        <span class="flex-1 select-none font-mono text-[11px] text-muted-foreground/60">
          {identifier()}
        </span>
        <Show
          when={issue().assignee_name}
          fallback={
            <div class="flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 border-dashed">
              <IconPersonSmall class="size-3 text-muted-foreground/40" />
            </div>
          }
        >
          <div class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span class="select-none font-medium text-[9px] text-primary">
              {issue().assignee_name!.charAt(0).toUpperCase()}
            </span>
          </div>
        </Show>
      </div>

      {/* Row 2: status icon + title */}
      <div class="flex items-start gap-2">
        <StatusIcon
          category={issue().status_category}
          color={issue().status_color}
          class="mt-0.5 size-3.5 shrink-0"
        />
        <span class="flex-1 select-none text-[13px] text-foreground leading-snug">
          {issue().title}
        </span>
      </div>

      {/* Optional labels row */}
      <Show when={labels().length > 0}>
        <div class="flex flex-wrap items-center gap-1">
          <For each={labels().slice(0, 3)}>
            {(label) => (
              <span class="rounded-full border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground/70">
                {label}
              </span>
            )}
          </For>
          <Show when={labels().length > 3}>
            <span class="select-none text-[10px] text-muted-foreground/50">
              +{labels().length - 3}
            </span>
          </Show>
        </div>
      </Show>

      {/* Footer: Created date */}
      <Show when={createdLabel()}>
        <span class="select-none text-[11px] text-muted-foreground/50">{createdLabel()}</span>
      </Show>
    </button>
  )
}

// ============================================================
// FilterPopover
// ============================================================

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

export function FilterPopover() {
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
          <div class="flex items-center border-border/40 border-b px-3 py-2">
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

// ============================================================
// DisplayPopover — controls list/board toggle + display settings
// ============================================================

function DropdownButton(props: { label: string }) {
  return (
    <button
      type="button"
      class="flex items-center gap-1 rounded border border-border/30 bg-muted/30 px-2 py-1 text-[12px] text-foreground transition-colors hover:bg-muted/50"
    >
      {props.label}
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
  )
}

function DisplaySwitch(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <SwitchCompact
      checked={props.checked}
      onChange={props.onChange}
      label={props.label}
      labelProps={{ class: "text-[13px] font-normal text-muted-foreground" }}
    />
  )
}

export function DisplayPopover(props: {
  view: "list" | "board"
  onViewChange: (view: "list" | "board") => void
  showEmptyColumns: boolean
  onShowEmptyColumnsChange: (v: boolean) => void
  showEmptyGroups: boolean
  onShowEmptyGroupsChange: (v: boolean) => void
}) {
  const [showSubIssues, setShowSubIssues] = createSignal(true)
  const [orderByRecency, setOrderByRecency] = createSignal(false)
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

  const isList = () => props.view === "list"

  return (
    <PopoverComp
      placement="bottom-end"
      contentProps={{ class: "p-0 w-[296px] border-border/60 bg-popover shadow-xl" }}
      content={
        <div>
          {/* Section 1: view toggle + layout options */}
          <div class="space-y-3 p-3">
            {/* List / Board toggle — two standalone pills, no shared container */}
            <div class={cn("flex items-center gap-2")}>
              <button
                type="button"
                onClick={() => props.onViewChange("list")}
                class={cn(
                  "flex h-7.75 w-33 items-center justify-center gap-2 rounded-full border border-border/40 font-medium text-[13px] transition-colors",
                  isList()
                    ? "bg-secondary text-foreground"
                    : "bg-secondary/30 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
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
                class={cn(
                  "flex h-7.75 w-33 items-center justify-center gap-2 rounded-full border border-border/40 font-medium text-[13px] transition-colors",
                  !isList()
                    ? "bg-secondary text-foreground"
                    : "bg-secondary/30 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
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

            {/* Grouping / Columns — label differs by view */}
            <div class="flex items-center justify-between">
              <span class="text-[13px] text-muted-foreground">
                {isList() ? "Grouping" : "Columns"}
              </span>
              <DropdownButton label="Status" />
            </div>

            {/* Sub-grouping / Rows — label differs by view */}
            <div class="flex items-center justify-between">
              <span class="text-[13px] text-muted-foreground">
                {isList() ? "Sub-grouping" : "Rows"}
              </span>
              <DropdownButton label="No grouping" />
            </div>

            {/* Ordering */}
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
                      d="M6 4 L6 12 M6 12 L3.5 9.5 M6 12 L8.5 9.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <line x1="9" y1="5" x2="14" y2="5" stroke-linecap="round" />
                    <line x1="9" y1="8" x2="13" y2="8" stroke-linecap="round" />
                    <line x1="9" y1="11" x2="12" y2="11" stroke-linecap="round" />
                  </svg>
                </button>
                <DropdownButton label="Priority" />
              </div>
            </div>

            <DisplaySwitch
              label="Order completed by recency"
              checked={orderByRecency()}
              onChange={setOrderByRecency}
            />
          </div>

          <div class="h-px bg-border/30" />

          {/* Section 2: issue visibility */}
          <div class="space-y-3 p-3">
            <div class="flex items-center justify-between">
              <span class="text-[13px] text-muted-foreground">Completed issues</span>
              <DropdownButton label="All" />
            </div>
            <DisplaySwitch
              label="Show sub-issues"
              checked={showSubIssues()}
              onChange={setShowSubIssues}
            />
          </div>

          <div class="h-px bg-border/30" />

          {/* Section 3: view-specific options + display props */}
          <div class="space-y-3 p-3">
            <Show
              when={isList()}
              fallback={
                <>
                  <p class="font-semibold text-[13px] text-foreground">Board options</p>
                  <DisplaySwitch
                    label="Show empty columns"
                    checked={props.showEmptyColumns}
                    onChange={props.onShowEmptyColumnsChange}
                  />
                </>
              }
            >
              <p class="font-semibold text-[13px] text-foreground">List options</p>
              <DisplaySwitch
                label="Nested sub-issues"
                checked={nestedSubIssues()}
                onChange={setNestedSubIssues}
              />
              <DisplaySwitch
                label="Show empty groups"
                checked={props.showEmptyGroups}
                onChange={props.onShowEmptyGroupsChange}
              />
            </Show>

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

          <div class="h-px bg-border/30" />

          {/* Footer */}
          <div class="flex items-center justify-between px-3 py-2">
            <button
              type="button"
              class="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Reset
            </button>
            <button
              type="button"
              class="text-[13px] text-primary transition-colors hover:text-primary/80"
            >
              Set default for everyone
            </button>
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

// ============================================================
// ViewPopover
// ============================================================

type ViewTab = "labels" | "priority" | "projects"

export function ViewPopover() {
  const [viewTab, setViewTab] = createSignal<ViewTab>("labels")

  return (
    <PopoverComp
      placement="bottom-end"
      contentProps={{ class: "p-0 w-[260px] border-border/60 bg-popover shadow-xl" }}
      content={
        <div>
          <div class="flex items-center gap-1 border-border/30 border-b p-2">
            {(["labels", "priority", "projects"] as ViewTab[]).map((t) => (
              <button
                type="button"
                onClick={() => setViewTab(t)}
                class={`rounded-full px-3 py-1.5 font-medium text-[13px] capitalize transition-colors ${viewTab() === t ? "bg-muted/60 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}
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

// ============================================================
// Icons
// ============================================================

export function IconPersonSmall(props: { class?: string }) {
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

export function ChevronRightIcon(props: { class?: string; style?: any }) {
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

export function NewViewIcon(props: { class?: string }) {
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

export function PlusIcon(props: { class?: string }) {
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
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="8" x2="16" y1="12" y2="12" />
      <line x1="11" x2="13" y1="18" y2="18" />
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

// ============================================================
// IssuesPage — shared root component for My Issues + Team Issues
// ============================================================

export type IssuesPageTab = {
  label: string
  value: string
  href?: string
  onClick?: () => void
}

export function IssuesPage(props: {
  header: JSX.Element
  tabs: IssuesPageTab[]
  activeTab: string
  extraTabControls?: JSX.Element
  issues: IssueRow[]
  emptyText: string
  onNewIssue: (category?: string) => void
  workspaceSlug: string
}) {
  const [view, setView] = createSignal<"list" | "board">("list")
  const [showEmptyColumns, setShowEmptyColumns] = createSignal(true)
  const [showEmptyGroups, setShowEmptyGroups] = createSignal(false)

  const allListGroups = createMemo((): BoardColumn[] => {
    const map = new Map<string, IssueRow[]>()
    for (const cat of Object.keys(STATUS_DISPLAY_ORDER)) {
      map.set(cat, [])
    }
    for (const issue of props.issues) {
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
    const map = new Map<string, IssueRow[]>()
    for (const category of Object.keys(BOARD_COLUMN_ORDER)) {
      map.set(category, [])
    }
    for (const issue of props.issues) {
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
    <div class="flex h-full flex-col overflow-hidden">
      {/* Header (page-specific) */}
      {props.header}

      {/* Tabs + controls row */}
      <div class="flex shrink-0 items-center gap-2 border-border/50 border-b px-4 py-2">
        <div class="flex items-center gap-1">
          <For each={props.tabs}>
            {(tab) => (
              <a
                href={tab.href ?? "#"}
                onClick={
                  tab.onClick
                    ? (e: MouseEvent) => {
                        e.preventDefault()
                        tab.onClick!()
                      }
                    : undefined
                }
                class={`rounded-full px-3 py-1 text-[13px] transition-colors ${
                  props.activeTab === tab.value
                    ? "bg-foreground/10 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                {tab.label}
              </a>
            )}
          </For>
        </div>

        {props.extraTabControls}

        <div class="flex-1" />

        <div class="flex shrink-0 items-center gap-0.5">
          <FilterPopover />
          <DisplayPopover
            view={view()}
            onViewChange={setView}
            showEmptyColumns={showEmptyColumns()}
            onShowEmptyColumnsChange={setShowEmptyColumns}
            showEmptyGroups={showEmptyGroups()}
            onShowEmptyGroupsChange={setShowEmptyGroups}
          />
          <ViewPopover />
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-hidden">
        <SolidSwitch>
          <Match when={props.issues.length === 0}>
            <div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <span class="text-[32px]">—</span>
              <p class="text-[13px]">{props.emptyText}</p>
              <button
                type="button"
                onClick={() => props.onNewIssue()}
                class="mt-2 rounded-full bg-primary px-5 py-2 font-medium text-[13px] text-primary-foreground transition-opacity hover:opacity-90"
              >
                Create new issue
              </button>
            </div>
          </Match>

          <Match when={view() === "list"}>
            <ListView
              groups={allListGroups()}
              workspaceSlug={props.workspaceSlug}
              showEmptyGroups={showEmptyGroups()}
              onNewIssue={props.onNewIssue}
            />
          </Match>

          <Match when={view() === "board"}>
            <BoardView
              columns={boardColumns()}
              workspaceSlug={props.workspaceSlug}
              showEmptyColumns={showEmptyColumns()}
              onNewIssue={props.onNewIssue}
            />
          </Match>
        </SolidSwitch>
      </div>
    </div>
  )
}
