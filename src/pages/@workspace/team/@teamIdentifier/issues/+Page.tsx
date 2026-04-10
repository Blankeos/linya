import { createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import getTitle from "@/utils/get-title"

type Status = "backlog" | "todo" | "in_progress" | "done" | "cancelled"
type Priority = "urgent" | "high" | "medium" | "low" | "none"

type Issue = {
  id: string
  title: string
  status: Status
  priority: Priority
  assigneeInitials: string
  dueDate: string | null
  labels: string[]
}

const TEAM_ISSUES: Issue[] = [
  {
    id: "ENG-1",
    title: "Set up authentication with email/password and OAuth",
    status: "done",
    priority: "urgent",
    assigneeInitials: "C",
    dueDate: "Apr 12",
    labels: ["Auth"],
  },
  {
    id: "ENG-2",
    title: "Design and implement sidebar navigation shell",
    status: "in_progress",
    priority: "high",
    assigneeInitials: "C",
    dueDate: "Apr 15",
    labels: ["UI"],
  },
  {
    id: "ENG-3",
    title: "Create issue list view with filters and sorting",
    status: "in_progress",
    priority: "high",
    assigneeInitials: "C",
    dueDate: "Apr 18",
    labels: ["UI", "Issues"],
  },
  {
    id: "ENG-4",
    title: "Implement issue detail page with metadata panel",
    status: "todo",
    priority: "medium",
    assigneeInitials: "C",
    dueDate: "Apr 22",
    labels: ["UI", "Issues"],
  },
  {
    id: "ENG-5",
    title: "Add PowerSync integration for real-time sync",
    status: "todo",
    priority: "medium",
    assigneeInitials: "C",
    dueDate: null,
    labels: ["Backend", "Sync"],
  },
  {
    id: "ENG-6",
    title: "Build onboarding flow for workspace + team creation",
    status: "backlog",
    priority: "low",
    assigneeInitials: "C",
    dueDate: null,
    labels: ["Onboarding"],
  },
  {
    id: "ENG-7",
    title: "Set up S3 storage for file attachments",
    status: "backlog",
    priority: "low",
    assigneeInitials: "C",
    dueDate: null,
    labels: ["Backend"],
  },
  {
    id: "ENG-8",
    title: "Write API documentation and developer guide",
    status: "backlog",
    priority: "none",
    assigneeInitials: "C",
    dueDate: null,
    labels: ["Docs"],
  },
]

const STATUS_GROUPS: { status: Status; label: string }[] = [
  { status: "in_progress", label: "In Progress" },
  { status: "todo", label: "Todo" },
  { status: "backlog", label: "Backlog" },
  { status: "done", label: "Done" },
  { status: "cancelled", label: "Cancelled" },
]

export default function TeamIssuesPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const teamIdentifier = () => params().teamIdentifier ?? ""

  useMetadata({ title: getTitle(`${teamIdentifier()} — Issues`) })

  const [view, setView] = createSignal<"list" | "board">("list")

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <div class="flex items-center gap-1.5 text-[13px] flex-1">
          <span class="text-muted-foreground">Engineering</span>
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
          class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-primary-foreground text-[12px] hover:opacity-90 transition-opacity"
        >
          <PlusIcon class="size-3.5" />
          New Issue
        </button>
      </div>

      {/* Issue list */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={TEAM_ISSUES.length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <span class="text-[32px]">—</span>
              <p class="text-[13px]">No issues in this team</p>
            </div>
          }
        >
          <For each={STATUS_GROUPS}>
            {(group) => {
              const groupIssues = TEAM_ISSUES.filter((i) => i.status === group.status)
              return (
                <Show when={groupIssues.length > 0}>
                  <IssueGroup
                    label={group.label}
                    status={group.status}
                    issues={groupIssues}
                    workspaceSlug={workspaceSlug()}
                    teamIdentifier={teamIdentifier()}
                  />
                </Show>
              )
            }}
          </For>
        </Show>
      </div>
    </div>
  )
}

function IssueGroup(props: {
  label: string
  status: Status
  issues: Issue[]
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
        <StatusIcon status={props.status} class="size-3.5 shrink-0" />
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
          {(issue) => (
            <IssueRow
              issue={issue}
              href={`/${props.workspaceSlug}/team/${props.teamIdentifier}/issues/${issue.id}`}
            />
          )}
        </For>
      </Show>
    </div>
  )
}

function IssueRow(props: { issue: Issue; href: string }) {
  return (
    <a
      href={props.href}
      class="flex items-center gap-3 px-4 py-1.5 border-b border-border/30 hover:bg-white/[0.03] cursor-pointer group"
    >
      <PriorityIcon priority={props.issue.priority} class="size-3.5 shrink-0" />
      <StatusIcon status={props.issue.status} class="size-4 shrink-0" />
      <span class="text-[12px] text-muted-foreground/60 font-mono shrink-0 w-14">
        {props.issue.id}
      </span>
      <span class="text-[13px] text-foreground flex-1 truncate">{props.issue.title}</span>
      <Show when={props.issue.labels.length > 0}>
        <div class="hidden sm:flex items-center gap-1 shrink-0">
          <For each={props.issue.labels}>
            {(label) => (
              <span class="text-[11px] px-1.5 py-0.5 rounded-full border border-border/50 text-muted-foreground/70">
                {label}
              </span>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.issue.dueDate}>
        <span class="text-[11px] text-muted-foreground/60 shrink-0 hidden md:block">
          {props.issue.dueDate}
        </span>
      </Show>
      <div class="size-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
        <span class="text-[9px] font-medium text-primary">{props.issue.assigneeInitials}</span>
      </div>
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

function ChevronRightIcon(props: { class?: string; style?: any }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      class={props.class} style={props.style} aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
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

function PlusIcon(props: { class?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      class={props.class} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}
