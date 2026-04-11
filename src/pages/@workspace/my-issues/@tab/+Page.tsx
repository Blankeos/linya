import { createSignal, For, Show, createMemo, Match, Switch as SolidSwitch } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { useAuthContext } from "@/context/auth.context"
import { usePowerSyncQuery } from "@/lib/powersync"
import getTitle from "@/utils/get-title"
import { NewIssueModal } from "@/components/new-issue-modal"
import { PillTabs } from "@/components/pill-tabs"
import {
  type IssueRow,
  type BoardColumn,
  ISSUE_FIELDS,
  STATUS_DISPLAY_ORDER,
  BOARD_COLUMN_ORDER,
  statusLabel,
  IssueGroup,
  BoardView,
  FilterPopover,
  DisplayPopover,
  ViewPopover,
} from "@/components/issues-shared"

type Tab = "assigned" | "created" | "subscribed" | "activity"

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
  const [view, setView] = createSignal<"list" | "board">("list")

  const [assignedIssues] = usePowerSyncQuery<IssueRow>(
    () => `SELECT ${ISSUE_FIELDS} WHERE i.assignee_id = ? ORDER BY i.sort_order ASC, i.created_at DESC`,
    () => [auth.user()?.id ?? ""]
  )

  const [createdIssues] = usePowerSyncQuery<IssueRow>(
    () => `SELECT ${ISSUE_FIELDS} WHERE i.creator_id = ? ORDER BY i.created_at DESC`,
    () => [auth.user()?.id ?? ""]
  )

  const issues = (): IssueRow[] => {
    switch (tab()) {
      case "assigned":
        return assignedIssues()
      case "created":
        return createdIssues()
      default:
        return []
    }
  }

  const emptyText = () => {
    switch (tab()) {
      case "assigned":
        return "No issues assigned to you"
      case "created":
        return "No issues created by you"
      case "subscribed":
        return "No subscribed issues"
      case "activity":
        return "No recent activity"
    }
  }

  const groupedIssues = createMemo(() => {
    const map = new Map<string, IssueRow[]>()
    for (const issue of issues()) {
      const cat = issue.status_category ?? "backlog"
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(issue)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (STATUS_DISPLAY_ORDER[a] ?? 99) - (STATUS_DISPLAY_ORDER[b] ?? 99))
      .map(([category, items]) => ({
        category,
        label: statusLabel(category),
        issues: items,
      }))
  })

  const boardColumns = createMemo((): BoardColumn[] => {
    const map = new Map<string, IssueRow[]>()
    // Pre-populate all standard categories so empty columns still appear
    for (const category of Object.keys(BOARD_COLUMN_ORDER)) {
      map.set(category, [])
    }
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
    <div class="flex h-full flex-col overflow-hidden">
      {/* Title row */}
      <div class="shrink-0 px-4 pb-0 pt-3">
        <h1 class="text-[15px] font-semibold tracking-[-0.01em] text-foreground">My issues</h1>
      </div>

      {/* Tabs + controls row */}
      <div class="flex shrink-0 items-center gap-2 px-4 py-2">
        <div class="flex-1">
          <PillTabs
            tabs={VALID_TABS.map((t) => ({
              label: t.charAt(0).toUpperCase() + t.slice(1),
              href: `/${workspaceSlug()}/my-issues/${t}`,
            }))}
            active={tab()}
            variant="compact"
            containerClass="flex items-center gap-1"
          />
        </div>

        <div class="flex shrink-0 items-center gap-0.5">
          <FilterPopover />
          <DisplayPopover view={view()} onViewChange={setView} />
          <ViewPopover />
        </div>
      </div>

      {/* Divider */}
      <div class="h-px shrink-0 bg-border/50" />

      {/* Content */}
      <div class="flex-1 overflow-hidden">
        <SolidSwitch>
          <Match when={issues().length === 0}>
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
          </Match>

          <Match when={view() === "list"}>
            <div class="h-full overflow-y-auto">
              <For each={groupedIssues()}>
                {(group) => (
                  <IssueGroup
                    label={group.label}
                    category={group.category}
                    issues={group.issues}
                    workspaceSlug={workspaceSlug()}
                  />
                )}
              </For>
            </div>
          </Match>

          <Match when={view() === "board"}>
            <BoardView columns={boardColumns()} workspaceSlug={workspaceSlug()} />
          </Match>
        </SolidSwitch>
      </div>

      <NewIssueModal
        open={newIssueOpen()}
        onClose={() => setNewIssueOpen(false)}
        workspaceSlug={workspaceSlug()}
      />
    </div>
  )
}

function EmptyIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <ellipse
        cx="60"
        cy="100"
        rx="28"
        ry="6"
        fill="currentColor"
        class="text-muted-foreground/10"
      />
      <path
        d="M36 88 Q60 98 84 88"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        fill="none"
        class="text-muted-foreground/25"
      />
      <path
        d="M40 93 Q60 101 80 93"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        fill="none"
        class="text-muted-foreground/15"
      />
      <path
        d="M28 52 Q18 60 28 68"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        fill="none"
        class="text-muted-foreground/40"
      />
      <path
        d="M24 56 Q16 60 24 64"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        fill="none"
        class="text-muted-foreground/25"
      />
      <path
        d="M92 52 Q102 60 92 68"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        fill="none"
        class="text-muted-foreground/40"
      />
      <path
        d="M96 56 Q104 60 96 64"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        fill="none"
        class="text-muted-foreground/25"
      />
      <path
        d="M36 32 Q60 22 84 32"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        fill="none"
        class="text-muted-foreground/25"
      />
      <path
        d="M40 27 Q60 19 80 27"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        fill="none"
        class="text-muted-foreground/15"
      />
      <ellipse
        cx="60"
        cy="52"
        rx="22"
        ry="7"
        stroke="currentColor"
        stroke-width="2"
        fill="none"
        class="text-muted-foreground/50"
      />
      <path d="M38 52 L38 64" stroke="currentColor" stroke-width="2" class="text-muted-foreground/50" />
      <path d="M82 52 L82 64" stroke="currentColor" stroke-width="2" class="text-muted-foreground/50" />
      <ellipse
        cx="60"
        cy="64"
        rx="22"
        ry="7"
        stroke="currentColor"
        stroke-width="2"
        fill="currentColor"
        fill-opacity="0.06"
        class="text-muted-foreground/50"
      />
      <ellipse
        cx="60"
        cy="72"
        rx="22"
        ry="7"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-dasharray="4 3"
        fill="none"
        class="text-muted-foreground/30"
      />
    </svg>
  )
}
