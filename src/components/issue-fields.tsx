/**
 * Shared issue field components: status icons, priority icons, combobox items,
 * and reusable toolbar/sidebar combobox wrappers.
 *
 * Import from here instead of duplicating in new-issue-modal and issue detail page.
 */
import { createSignal, type JSX, Match, Show, Switch } from "solid-js"
import { type ComboboxItem, Combobox2Command } from "@/components/ui/combobox-2"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { IconPerson } from "@/assets/icons"
import { cn } from "@/utils/cn"

// ============================================================
// Types
// ============================================================

export type Priority = "urgent" | "high" | "medium" | "low" | "none"

export type Status = {
  id: string
  name: string
  color: string | null
  category: string
}

export type ProjectStatus = "backlog" | "planned" | "in_progress" | "completed" | "canceled"

// ============================================================
// Constants
// ============================================================

export const PRIORITY_LABELS = ["No priority", "Urgent", "High", "Medium", "Low"]

/** Reverse lookup: Priority string → numeric value (0–4). */
export const PRIORITY_VALUE: Record<Priority, number> = {
  none: 0,
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
}

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; color: string }[] = [
  { value: "backlog", label: "Backlog", color: "#6b7280" },
  { value: "planned", label: "Planned", color: "#3b82f6" },
  { value: "in_progress", label: "In Progress", color: "#f59e0b" },
  { value: "completed", label: "Completed", color: "#22c55e" },
  { value: "canceled", label: "Canceled", color: "#ef4444" },
]

export const DEFAULT_STATUSES: Status[] = [
  { id: "triage", name: "Triage", color: "#6b7280", category: "triage" },
  { id: "backlog", name: "Backlog", color: "#6b7280", category: "backlog" },
  { id: "todo", name: "Todo", color: "#9ca3af", category: "unstarted" },
  { id: "in_progress", name: "In Progress", color: "#f59e0b", category: "started" },
  { id: "in_review", name: "In Review", color: "#22c55e", category: "in_review" },
  { id: "done", name: "Done", color: "#10b981", category: "completed" },
  { id: "cancelled", name: "Cancelled", color: "#6b7280", category: "cancelled" },
  { id: "duplicate", name: "Duplicate", color: "#6b7280", category: "duplicate" },
]

// ============================================================
// Helpers
// ============================================================

export function mapPriority(p: number): Priority {
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

// ============================================================
// StatusIcon
// Unified status indicator — replaces StatusDot (new-issue-modal) and StatusIcon (+Page).
// Accepts optional `color` from the DB record; falls back to category-based colors.
// Size via `class` (e.g. "size-3.5 shrink-0").
// ============================================================

export function StatusIcon(props: {
  category?: string | null
  color?: string | null
  class?: string
}) {
  // Normalize simplified aliases used in mock data / legacy code
  const category = () => {
    switch (props.category) {
      case "todo":
        return "unstarted"
      case "in_progress":
        return "started"
      case "done":
        return "completed"
      default:
        return props.category
    }
  }

  const color = () => {
    if (props.color) return props.color
    switch (category()) {
      case "triage":
        return "#6b7280"
      case "backlog":
        return "#6b7280"
      case "unstarted":
        return "#9ca3af"
      case "started":
        return "#f59e0b"
      case "in_review":
        return "#22c55e"
      case "completed":
        return "#10b981"
      case "cancelled":
        return "#6b7280"
      case "duplicate":
        return "#6b7280"
      default:
        return "#6b7280"
    }
  }

  return (
    <svg viewBox="0 0 14 14" class={cn("shrink-0", props.class)} aria-hidden="true">
      <Switch
        fallback={
          // Default / unstarted: solid outline circle
          <circle cx="7" cy="7" r="5.5" fill="none" stroke={color()} stroke-width="1.5" />
        }
      >
        <Match when={category() === "triage"}>
          {/* Diamond */}
          <rect
            x="7"
            y="0.5"
            width="9"
            height="9"
            rx="1"
            transform="rotate(45 7 0.5)"
            fill="none"
            stroke={color()}
            stroke-width="1.5"
          />
        </Match>
        <Match when={category() === "backlog"}>
          {/* Dashed circle */}
          <circle
            cx="7"
            cy="7"
            r="5.5"
            fill="none"
            stroke={color()}
            stroke-width="1.5"
            stroke-dasharray="2.5 2"
          />
        </Match>
        <Match when={category() === "started"}>
          {/* Half-filled circle */}
          <circle cx="7" cy="7" r="5.5" fill="none" stroke={color()} stroke-width="1.5" />
          <path d="M7 1.5 A5.5 5.5 0 0 1 7 12.5 Z" fill={color()} />
        </Match>
        <Match when={category() === "in_review"}>
          {/* Circle with inner ring */}
          <circle cx="7" cy="7" r="5.5" fill="none" stroke={color()} stroke-width="1.5" />
          <circle cx="7" cy="7" r="2.5" fill="none" stroke={color()} stroke-width="1.5" />
        </Match>
        <Match when={category() === "completed"}>
          {/* Filled circle with checkmark */}
          <circle cx="7" cy="7" r="5.5" fill={color()} />
          <path
            d="M4 7 L6.2 9.2 L10.5 5"
            stroke="white"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
        </Match>
        <Match when={category() === "cancelled" || category() === "duplicate"}>
          {/* Filled circle with × */}
          <circle cx="7" cy="7" r="5.5" fill={color()} />
          <path
            d="M4.5 4.5 L9.5 9.5 M9.5 4.5 L4.5 9.5"
            stroke="white"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </Match>
      </Switch>
    </svg>
  )
}

// ============================================================
// PriorityIcon
// Accepts numeric `value` (0–4) matching the DB field.
// Size via `class`.
// ============================================================

export function PriorityIcon(props: { value: number | Priority; class?: string }) {
  const n = () =>
    typeof props.value === "string" ? (PRIORITY_VALUE[props.value] ?? 0) : props.value
  return (
    <svg viewBox="0 0 16 16" class={props.class} aria-hidden="true">
      <Switch
        fallback={
          // No priority: three centered dots/dashes
          <>
            <rect x="2" y="7" width="3" height="2" rx="1" fill="currentColor" opacity="0.4" />
            <rect x="6.5" y="7" width="3" height="2" rx="1" fill="currentColor" opacity="0.4" />
            <rect x="11" y="7" width="3" height="2" rx="1" fill="currentColor" opacity="0.4" />
          </>
        }
      >
        <Match when={n() === 1}>
          {/* Urgent: Exclamation mark in a rounded square */}
          <rect x="2" y="2" width="12" height="12" rx="2" fill="#ef4444" opacity="0.15" />
          <path
            d="M8 5v5"
            stroke="#ef4444"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="8" cy="12" r="1" fill="#ef4444" />
        </Match>
        <Match when={n() === 2}>
          {/* High: all three bars filled */}
          <rect x="2" y="9" width="3" height="5" rx="1" fill="currentColor" />
          <rect x="6.5" y="5" width="3" height="9" rx="1" fill="currentColor" />
          <rect x="11" y="2" width="3" height="12" rx="1" fill="currentColor" />
        </Match>
        <Match when={n() === 3}>
          {/* Medium: two bars filled */}
          <rect x="2" y="9" width="3" height="5" rx="1" fill="currentColor" />
          <rect x="6.5" y="5" width="3" height="9" rx="1" fill="currentColor" />
          <rect x="11" y="2" width="3" height="12" rx="1" fill="currentColor" opacity="0.25" />
        </Match>
        <Match when={n() === 4}>
          {/* Low: one bar filled */}
          <rect x="2" y="9" width="3" height="5" rx="1" fill="currentColor" />
          <rect x="6.5" y="5" width="3" height="9" rx="1" fill="currentColor" opacity="0.25" />
          <rect x="11" y="2" width="3" height="12" rx="1" fill="currentColor" opacity="0.25" />
        </Match>
      </Switch>
    </svg>
  )
}

// ============================================================
// Combobox item builders
// ============================================================

/** Builds the fixed priority item list for use in a combobox. */
export function makePriorityItems(): ComboboxItem[] {
  return [
    {
      value: "0",
      label: (
        <span class="flex items-center gap-3">
          <PriorityIcon value={0} class="size-4 shrink-0" />
          <span class="flex-1">No priority</span>
        </span>
      ),
    },
    {
      value: "1",
      label: (
        <span class="flex items-center gap-3">
          <PriorityIcon value={1} class="size-4 shrink-0" />
          <span class="flex-1">Urgent</span>
        </span>
      ),
    },
    {
      value: "2",
      label: (
        <span class="flex items-center gap-3">
          <PriorityIcon value={2} class="size-4 shrink-0" />
          <span class="flex-1">High</span>
        </span>
      ),
    },
    {
      value: "3",
      label: (
        <span class="flex items-center gap-3">
          <PriorityIcon value={3} class="size-4 shrink-0" />
          <span class="flex-1">Medium</span>
        </span>
      ),
    },
    {
      value: "4",
      label: (
        <span class="flex items-center gap-3">
          <PriorityIcon value={4} class="size-4 shrink-0" />
          <span class="flex-1">Low</span>
        </span>
      ),
    },
  ]
}

/** Builds a status item list from a runtime statuses array. */
export function makeStatusItems(statuses: Status[]): ComboboxItem[] {
  return statuses.map((s) => ({
    value: s.id,
    label: (
      <span class="flex items-center gap-2">
        <StatusIcon category={s.category} color={s.color} class="size-3.5" />
        {s.name}
      </span>
    ),
  }))
}

// ============================================================
// ProjectStatusIcon
// Icon for project-level status (backlog/planned/in_progress/completed/canceled).
// ============================================================

export function ProjectStatusIcon(props: {
  status: ProjectStatus
  color?: string | null
  class?: string
}) {
  const color = () =>
    props.color ?? PROJECT_STATUSES.find((s) => s.value === props.status)?.color ?? "#6b7280"
  return (
    <svg viewBox="0 0 14 14" class={cn("shrink-0", props.class)} aria-hidden="true">
      <Switch
        fallback={<circle cx="7" cy="7" r="5.5" fill="none" stroke={color()} stroke-width="1.5" />}
      >
        <Match when={props.status === "backlog"}>
          <circle
            cx="7"
            cy="7"
            r="5.5"
            fill="none"
            stroke={color()}
            stroke-width="1.5"
            stroke-dasharray="2.5 2"
          />
        </Match>
        <Match when={props.status === "planned"}>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke={color()} stroke-width="1.5" />
          <circle cx="7" cy="7" r="2.5" fill={color()} />
        </Match>
        <Match when={props.status === "in_progress"}>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke={color()} stroke-width="1.5" />
          <path d="M7 1.5 A5.5 5.5 0 0 1 7 12.5 Z" fill={color()} />
        </Match>
        <Match when={props.status === "completed"}>
          <circle cx="7" cy="7" r="5.5" fill={color()} />
          <path
            d="M4 7 L6.2 9.2 L10.5 5"
            stroke="white"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
        </Match>
        <Match when={props.status === "canceled"}>
          <circle cx="7" cy="7" r="5.5" fill={color()} />
          <path
            d="M4.5 4.5 L9.5 9.5 M9.5 4.5 L4.5 9.5"
            stroke="white"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </Match>
      </Switch>
    </svg>
  )
}

/** Builds the project status item list for use in a combobox. */
export function makeProjectStatusItems(): ComboboxItem[] {
  return PROJECT_STATUSES.map((s) => ({
    value: s.value,
    label: (
      <span class="flex items-center gap-2">
        <ProjectStatusIcon status={s.value} color={s.color} class="size-3.5 shrink-0" />
        {s.label}
      </span>
    ),
  }))
}

// ============================================================
// StatusBadge
// Colored pill badge for displaying status in issue detail views.
// ============================================================

const STATUS_BADGE_STYLES: Record<string, { color: string; bg: string }> = {
  backlog: { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  unstarted: { color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
  started: { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  in_review: { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  completed: { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  cancelled: { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  duplicate: { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
}

export function StatusBadge(props: { category: string | null; name?: string | null }) {
  const category = () => {
    switch (props.category) {
      case "todo":
        return "unstarted"
      case "in_progress":
        return "started"
      case "done":
        return "completed"
      default:
        return props.category
    }
  }
  const style = () => STATUS_BADGE_STYLES[category() ?? "backlog"] ?? STATUS_BADGE_STYLES.backlog
  return (
    <span
      class="text-[11px] px-2 py-0.5 rounded-full font-medium"
      style={{ color: style().color, "background-color": style().bg }}
    >
      {props.name ?? props.category ?? "No status"}
    </span>
  )
}

// ============================================================
// ToolbarCombobox
// Compact trigger used in the new-issue modal toolbar.
// Open state is externally controlled (caller manages the signal).
// ============================================================

export function ToolbarCombobox(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ComboboxItem[]
  value: string
  onValueChange: (value: string | string[]) => void
  searchPlaceholder?: string
  contentClass?: string
  children: JSX.Element
  disallowEmptySelection?: boolean
  multiple?: boolean
}) {
  return (
    <Popover open={props.open} onOpenChange={props.onOpenChange}>
      <PopoverTrigger
        as="button"
        type="button"
        class="flex items-center gap-1.5 rounded border border-border/40 px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
      >
        {props.children}
      </PopoverTrigger>
      <PopoverContent
        class={cn("p-0", props.contentClass)}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === "Escape") {
            props.onOpenChange(false)
            e.stopPropagation()
          }
        }}
      >
        <Combobox2Command
          items={props.items}
          selectedValue={props.value}
          onSelectedValueChange={props.onValueChange}
          searchPlaceholder={props.searchPlaceholder}
          onClose={() => props.onOpenChange(false)}
          disallowEmptySelection={props.disallowEmptySelection}
          multiple={props.multiple}
        />
      </PopoverContent>
    </Popover>
  )
}

// ============================================================
// SidebarCombobox
// Full-width row trigger used in the issue detail sidebar.
// Manages its own open state internally.
// ============================================================

export function SidebarCombobox(props: {
  items: ComboboxItem[]
  selectedValue: string
  onSelect: (value: string | string[]) => void
  searchPlaceholder?: string
  contentClass?: string
  children: JSX.Element
  multiple?: boolean
}) {
  const [open, setOpen] = createSignal(false)
  return (
    <Popover open={open()} onOpenChange={setOpen}>
      <PopoverTrigger
        as="button"
        type="button"
        class="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-[13px] text-muted-foreground hover:bg-white/[0.05] transition-colors text-left group"
      >
        {props.children}
      </PopoverTrigger>
      <PopoverContent
        class={cn("p-0 min-w-[200px]", props.contentClass)}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === "Escape") {
            setOpen(false)
            e.stopPropagation()
          }
        }}
      >
        <Combobox2Command
          items={props.items}
          selectedValue={props.selectedValue}
          onSelectedValueChange={props.onSelect}
          searchPlaceholder={props.searchPlaceholder}
          onClose={() => setOpen(false)}
          multiple={props.multiple}
        />
      </PopoverContent>
    </Popover>
  )
}
