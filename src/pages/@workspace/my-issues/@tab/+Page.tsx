import { createMemo, createSignal } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { useAuthContext } from "@/context/auth.context"
import { usePowerSyncQuery } from "@/lib/powersync"
import getTitle from "@/utils/get-title"
import { NewIssueModal } from "@/components/new-issue-modal"
import {
  type IssueRow,
  type IssuesPageTab,
  ISSUE_FIELDS,
  IssuesPage,
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

  const [assignedIssues] = usePowerSyncQuery<IssueRow>(
    () => `SELECT ${ISSUE_FIELDS} WHERE i.assignee_id = ? ORDER BY i.sort_order ASC, i.created_at DESC`,
    () => [auth.user()?.id ?? ""]
  )

  const [createdIssues] = usePowerSyncQuery<IssueRow>(
    () => `SELECT ${ISSUE_FIELDS} WHERE i.creator_id = ? ORDER BY i.created_at DESC`,
    () => [auth.user()?.id ?? ""]
  )

  const issues = createMemo((): IssueRow[] => {
    switch (tab()) {
      case "assigned":
        return assignedIssues()
      case "created":
        return createdIssues()
      default:
        return []
    }
  })

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

  const tabs = (): IssuesPageTab[] =>
    VALID_TABS.map((t) => ({
      label: t.charAt(0).toUpperCase() + t.slice(1),
      value: t,
      href: `/${workspaceSlug()}/my-issues/${t}`,
    }))

  return (
    <>
      <IssuesPage
        header={
          <div class="shrink-0 px-4 pb-0 pt-3">
            <h1 class="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              My issues
            </h1>
          </div>
        }
        tabs={tabs()}
        activeTab={tab()}
        issues={issues()}
        emptyText={emptyText()}
        onNewIssue={() => setNewIssueOpen(true)}
        workspaceSlug={workspaceSlug()}
      />

      <NewIssueModal
        open={newIssueOpen()}
        onClose={() => setNewIssueOpen(false)}
        workspaceSlug={workspaceSlug()}
      />
    </>
  )
}
