import { useDisclosure } from "bagon-hooks"
import { createMemo, createSignal, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { IconPlus } from "@/assets/icons"
import {
  ISSUE_FIELDS,
  type IssueRow,
  IssuesPage,
  type IssuesPageTab,
  NewViewIcon,
} from "@/components/issues-shared"
import { NewIssueModal } from "@/components/new-issue-modal"
import { usePowerSyncGetOne, usePowerSyncQuery } from "@/lib/powersync"
import { useDisplaySettings } from "@/hooks/use-display-settings"
import { Tippy } from "@/lib/solid-tippy"
import getTitle from "@/utils/get-title"

type TeamRow = {
  id: string
  name: string
  identifier: string
  color: string | null
}

// Active categories (not completed, cancelled, duplicate, triage)
const ACTIVE_CATEGORIES = new Set(["started", "unstarted", "backlog", "in_review"])

type ActiveTab = "all" | "active" | "backlog"

const TAB_ITEMS: Array<{ label: string; value: ActiveTab }> = [
  { label: "All issues", value: "all" },
  { label: "Active", value: "active" },
  { label: "Backlog", value: "backlog" },
]

export default function TeamIssuesPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const teamIdentifier = () => params().teamIdentifier ?? ""

  const [newIssueOpen, newIssueActions] = useDisclosure()
  const [newIssueCategory, setNewIssueCategory] = createSignal<string | undefined>(undefined)
  const [activeTab, setActiveTab] = createSignal<ActiveTab>("all")

  const openNewIssue = (category?: string) => {
    setNewIssueCategory(category)
    newIssueActions.open()
  }

  const closeNewIssue = () => {
    newIssueActions.close()
    setNewIssueCategory(undefined)
  }

  const [team] = usePowerSyncGetOne<TeamRow & { workspace_id: string }>(
    () => `
      SELECT t.id, t.name, t.identifier, t.color, t.workspace_id
      FROM team t
      JOIN workspace w ON t.workspace_id = w.id
      WHERE w.slug = ? AND t.identifier = ?
    `,
    () => [workspaceSlug(), teamIdentifier()]
  )

  // Query workspace ID directly from slug — available instantly from local SQLite
  // (avoids waiting for the team query to resolve, preventing flash of default settings)
  const [workspace] = usePowerSyncGetOne<{ id: string }>(
    () => `SELECT w.id FROM workspace w WHERE w.slug = ?`,
    () => [workspaceSlug()]
  )

  const displaySettings = useDisplaySettings(
    () => workspace()?.id ?? null,
    () => "team_issues",
    () => team()?.id ?? null
  )

  const [issues] = usePowerSyncQuery<IssueRow>(
    () =>
      `SELECT ${ISSUE_FIELDS} WHERE t.identifier = ? ORDER BY i.sort_order ASC, i.created_at DESC`,
    () => [teamIdentifier()]
  )

  useMetadata({
    title: getTitle(team() ? `${team()!.name} — Issues` : teamIdentifier()),
  })

  const filteredIssues = createMemo(() => {
    const all = issues()
    const tab = activeTab()
    if (tab === "all") return all
    if (tab === "backlog") return all.filter((i) => i.status_category === "backlog")
    return all.filter((i) => {
      const cat = i.status_category ?? "backlog"
      return ACTIVE_CATEGORIES.has(cat) || cat === "backlog"
    })
  })

  const tabs = (): IssuesPageTab[] =>
    TAB_ITEMS.map((t) => ({
      label: t.label,
      value: t.value,
      href: "#",
      onClick: () => setActiveTab(t.value),
    }))

  return (
    <>
      <IssuesPage
        header={
          <div class="flex shrink-0 items-center gap-3 border-border/50 border-b px-4 py-2.5">
            <div class="flex flex-1 items-center gap-1.5 text-[13px]">
              <Show when={team()}>
                <div
                  class="flex size-4 shrink-0 items-center justify-center rounded font-bold text-[8px] text-white"
                  style={{ "background-color": team()!.color ?? "#6b7280" }}
                >
                  {team()!.name[0]?.toUpperCase()}
                </div>
                <span class="text-muted-foreground">{team()!.name}</span>
              </Show>
              <span class="text-muted-foreground/40">/</span>
              <span class="font-medium text-foreground">Issues</span>
            </div>

            <button
              type="button"
              onClick={() => openNewIssue()}
              class="flex items-center gap-1.5 rounded bg-primary px-2.5 py-1 text-[12px] text-primary-foreground transition-opacity hover:opacity-90"
            >
              <IconPlus class="size-3.5" />
              New Issue
            </button>
          </div>
        }
        tabs={tabs()}
        activeTab={activeTab()}
        extraTabControls={
          <Tippy content="New view" props={{ placement: "bottom", delay: [500, 0] }}>
            <button
              type="button"
              class="ml-1 rounded p-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              title="New view"
            >
              <NewViewIcon class="size-3.5" />
            </button>
          </Tippy>
        }
        issues={filteredIssues()}
        emptyText="No issues in this team"
        onNewIssue={openNewIssue}
        workspaceSlug={workspaceSlug()}
        displaySettings={displaySettings}
      />

      <NewIssueModal
        open={newIssueOpen()}
        onClose={closeNewIssue}
        workspaceSlug={workspaceSlug()}
        initialCategory={newIssueCategory()}
      />
    </>
  )
}
