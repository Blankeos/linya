import { createEffect, createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import getTitle from "@/utils/get-title"
import TiptapEditor from "@/components/tiptap-editor"
import { usePowerSyncQuery, usePowerSyncExecute } from "@/lib/powersync"
import {
  IconChevronDown,
  IconPerson,
  IconTag,
  IconProjects,
  IconCheck,
  IconInfo,
} from "@/assets/icons"
import { type ComboboxItem } from "@/components/ui/combobox-2"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/utils/cn"
import { Tippy } from "@/lib/solid-tippy"
import { useHotkeys } from "bagon-hooks"
import { toast } from "solid-sonner"
import {
  makePriorityItems,
  makeStatusItems,
  mapPriority,
  PriorityIcon,
  SidebarCombobox,
  StatusIcon,
  type Priority,
} from "@/components/issue-fields"

type StatusCategory = "backlog" | "unstarted" | "started" | "completed" | "cancelled"

type IssueRow = {
  id: string
  title: string
  description: string | null
  description_html: string | null
  priority: number
  due_date: string | null
  created_at: string
  updated_at: string
  number: number
  team_id: string | null
  team_name: string
  team_identifier: string
  status_id: string | null
  status_name: string | null
  status_category: StatusCategory | null
  status_color: string | null
  assignee_id: string | null
  assignee_name: string | null
  assignee_avatar: string | null
}

type LabelRow = {
  id: string
  name: string
  color: string | null
}

type AvailableLabelRow = {
  id: string
  name: string
  color: string | null
}

type CommentRow = {
  id: string
  body: string | null
  body_html: string | null
  created_at: string
  author_name: string | null
}

type UserRow = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
}

type StatusRow = {
  id: string
  name: string
  category: StatusCategory
  color: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  )
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48) || "untitled"
  )
}

// Parse "WEB-1" → { teamIdentifier: "WEB", number: 1 }
// Handles identifiers with hyphens like "MY-TEAM-1" by splitting on the last "-"
function parseIssueId(issueId: string): { teamIdentifier: string; number: number } {
  const lastDash = issueId.lastIndexOf("-")
  if (lastDash === -1) return { teamIdentifier: issueId, number: NaN }
  return {
    teamIdentifier: issueId.slice(0, lastDash),
    number: parseInt(issueId.slice(lastDash + 1), 10),
  }
}

export default function IssueDetailPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const issueId = () => params().issueId ?? ""

  const parsed = () => parseIssueId(issueId())
  const teamIdentifier = () => parsed().teamIdentifier
  const issueNumber = () => parsed().number

  const [issueRows, issueLoading] = usePowerSyncQuery<IssueRow>(
    () => `
      SELECT
        i.id, i.title, i.description, i.description_html,
        i.priority, i.due_date, i.created_at, i.updated_at, i.number,
        i.team_id, i.status_id, i.assignee_id,
        t.name as team_name, t.identifier as team_identifier,
        ws.name as status_name, ws.category as status_category, ws.color as status_color,
        u.display_name as assignee_name, u.avatar_url as assignee_avatar
      FROM issue i
      LEFT JOIN team t ON i.team_id = t.id
      LEFT JOIN workflow_status ws ON i.status_id = ws.id
      LEFT JOIN user u ON i.assignee_id = u.id
      WHERE t.identifier = ? AND i.number = ?
      LIMIT 1
    `,
    () => [teamIdentifier(), issueNumber()]
  )
  const issue = () => issueRows()[0] ?? null

  const [labels] = usePowerSyncQuery<LabelRow>(
    () => `
      SELECT il.label_id as id, l.name, l.color
      FROM issue_label il
      JOIN label l ON il.label_id = l.id
      WHERE il.issue_id = ?
    `,
    () => [issue()?.id ?? ""]
  )

  const [availableLabels] = usePowerSyncQuery<AvailableLabelRow>(
    () => `
      SELECT id, name, color
      FROM label
      WHERE team_id = ?
      ORDER BY name ASC
    `,
    () => [issue()?.team_id ?? ""]
  )

  const [comments] = usePowerSyncQuery<CommentRow>(
    () => `
      SELECT c.id, c.body, c.body_html, c.created_at, u.display_name as author_name
      FROM comment c
      LEFT JOIN user u ON c.user_id = u.id
      WHERE c.issue_id = ?
      ORDER BY c.created_at ASC
    `,
    () => [issue()?.id ?? ""]
  )

  const [availableStatuses] = usePowerSyncQuery<StatusRow>(
    () => `
      SELECT ws.id, ws.name, ws.category, ws.color
      FROM workflow_status ws
      WHERE ws.team_id = ?
      ORDER BY ws.id ASC
    `,
    () => {
      const iss = issue()
      if (!iss) return [""]
      return [iss.team_id || ""]
    }
  )

  const [users] = usePowerSyncQuery<UserRow>(
    () => `
      SELECT id, email, display_name, avatar_url
      FROM user
      ORDER BY display_name ASC
    `,
    () => []
  )

  const issueIdentifier = () =>
    issue() ? `${issue()!.team_identifier}-${issue()!.number}` : issueId()
  const priority = () => mapPriority(issue()?.priority ?? 0)
  const statusCategory = () => issue()?.status_category ?? null

  useMetadata({ title: getTitle(issue() ? `${issueIdentifier()} — ${issue()!.title}` : issueId()) })

  // Fix URL slug on load (and after refresh — PowerSync will have latest title)
  createEffect(() => {
    const iss = issue()
    if (!iss || typeof window === "undefined") return
    const correctSlug = slugify(iss.title)
    const currentSlug = params().issueSlug ?? ""
    if (currentSlug !== correctSlug) {
      history.replaceState(null, "", `/${workspaceSlug()}/issue/${issueId()}/${correctSlug}`)
    }
  })

  const execute = usePowerSyncExecute()

  let titleTimer: ReturnType<typeof setTimeout> | undefined
  let descTimer: ReturnType<typeof setTimeout> | undefined

  function updateUrlSlug(title: string) {
    if (typeof window === "undefined") return
    history.replaceState(null, "", `/${workspaceSlug()}/issue/${issueId()}/${slugify(title)}`)
  }

  function handleTitleChange(value: string, id: string) {
    clearTimeout(titleTimer)
    titleTimer = setTimeout(async () => {
      if (!value.trim()) return
      await execute("UPDATE issue SET title = ? WHERE id = ?", [value.trim(), id])
    }, 300)
  }

  function handleDescriptionChange(html: string, id: string) {
    clearTimeout(descTimer)
    descTimer = setTimeout(async () => {
      await execute("UPDATE issue SET description_html = ? WHERE id = ?", [html, id])
    }, 300)
  }

  const [comment, setComment] = createSignal("")
  const [copied, setCopied] = createSignal(false)

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Show
      when={!issueLoading()}
      fallback={
        <div class="flex items-center justify-center h-full text-muted-foreground text-[13px]">
          Loading…
        </div>
      }
    >
      <Show
        when={issue()}
        fallback={
          <div class="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <span class="text-[32px]">—</span>
            <p class="text-[13px]">Issue not found</p>
          </div>
        }
      >
        {(iss) => (
          <div class="flex flex-col h-full overflow-hidden">
            {/* Top bar */}
            <div class="flex items-center gap-2 px-4 py-2 border-b border-border/50 shrink-0">
              <div class="flex items-center gap-1.5 text-[12px] text-muted-foreground flex-1 min-w-0">
                <span class="truncate">{iss().team_name}</span>
                <span class="text-muted-foreground/40 shrink-0">/</span>
                <a
                  href={`/${workspaceSlug()}/team/${teamIdentifier()}/issues`}
                  class="hover:text-foreground transition-colors shrink-0"
                >
                  Issues
                </a>
                <span class="text-muted-foreground/40 shrink-0">/</span>
                <span class="text-foreground shrink-0">{issueIdentifier()}</span>
              </div>

              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  class="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/60 text-[12px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  <LinkIcon class="size-3.5" />
                  {copied() ? "Copied!" : "Copy link"}
                </button>
                <button
                  type="button"
                  class="flex items-center gap-1.5 px-2.5 py-1 rounded border border-destructive/40 text-[12px] text-destructive/80 hover:text-destructive hover:border-destructive transition-colors"
                >
                  <TrashIcon class="size-3.5" />
                  Delete
                </button>
              </div>
            </div>

            {/* Content area */}
            <div class="flex-1 flex overflow-hidden">
              {/* Main column */}
              <div class="flex-1 overflow-y-auto px-8 py-6 min-w-0">
                <div class="flex items-center gap-2 mb-3">
                  <span class="text-[12px] font-mono text-muted-foreground/60">
                    {issueIdentifier()}
                  </span>
                  <StatusBadge category={statusCategory()} name={iss().status_name} />
                </div>

                <textarea
                  class="w-full text-[22px] font-semibold text-foreground tracking-[-0.02em] leading-tight mb-5 bg-transparent border-none outline-none resize-none overflow-hidden placeholder:text-muted-foreground/40"
                  rows={1}
                  placeholder="Untitled"
                  value={iss().title}
                  ref={(el) => {
                    requestAnimationFrame(() => {
                      el.style.height = "auto"
                      el.style.height = el.scrollHeight + "px"
                    })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      e.currentTarget.blur()
                    }
                  }}
                  onInput={(e) => {
                    const el = e.currentTarget
                    el.style.height = "auto"
                    el.style.height = el.scrollHeight + "px"
                    handleTitleChange(el.value, iss().id)
                  }}
                  onBlur={(e) => {
                    updateUrlSlug(e.currentTarget.value)
                  }}
                />

                <div class="mb-8">
                  <TiptapEditor
                    content={iss().description_html ?? iss().description ?? ""}
                    placeholder="Add description… (type / for commands)"
                    editorClass="min-h-[120px]"
                    onChange={(html) => handleDescriptionChange(html, iss().id)}
                  />
                </div>

                {/* Comments */}
                <div class="border-t border-border/30 pt-6">
                  <h2 class="text-[13px] font-medium text-muted-foreground mb-4">
                    Comments ({comments().length})
                  </h2>
                  <div class="space-y-4 mb-6">
                    <For each={comments()}>
                      {(c) => (
                        <div class="flex gap-3">
                          <div class="size-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                            <span class="text-[10px] font-medium text-primary">
                              {(c.author_name ?? "?").charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                              <span class="text-[12px] font-medium text-foreground">
                                {c.author_name ?? "Unknown"}
                              </span>
                              <span class="text-[11px] text-muted-foreground/60">
                                {formatDateTime(c.created_at)}
                              </span>
                            </div>
                            <p class="text-[13px] text-foreground/80 leading-relaxed">
                              {c.body ?? ""}
                            </p>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                  <div class="flex gap-3">
                    <div class="size-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span class="text-[10px] font-medium text-primary">?</span>
                    </div>
                    <div class="flex-1">
                      <TiptapEditor
                        variant="comment"
                        placeholder="Leave a comment…"
                        onChange={(html) => setComment(html)}
                        editorClass="min-h-[60px] text-[13px]"
                      />
                      <div class="flex justify-end mt-2">
                        <button
                          type="button"
                          disabled={!comment().trim()}
                          class="px-3 py-1.5 rounded bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Comment
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right metadata sidebar */}
              <div class="w-[280px] shrink-0 overflow-y-auto">
                <IssueSidebar
                  issue={iss()}
                  labels={labels()}
                  availableLabels={availableLabels()}
                  statuses={availableStatuses()}
                  users={users()}
                  workspaceSlug={workspaceSlug()}
                  onStatusChange={(statusId) =>
                    execute("UPDATE issue SET status_id = ? WHERE id = ?", [statusId, iss().id])
                  }
                  onPriorityChange={(p) =>
                    execute("UPDATE issue SET priority = ? WHERE id = ?", [p, iss().id])
                  }
                  onAssigneeChange={(userId) =>
                    execute("UPDATE issue SET assignee_id = ? WHERE id = ?", [
                      userId || null,
                      iss().id,
                    ])
                  }
                  onLabelToggle={async (labelId, isAdding) => {
                    if (isAdding) {
                      await execute(
                        "INSERT INTO issue_label (id, issue_id, label_id) VALUES (?, ?, ?)",
                        [crypto.randomUUID(), iss().id, labelId]
                      )
                    } else {
                      await execute("DELETE FROM issue_label WHERE issue_id = ? AND label_id = ?", [
                        iss().id,
                        labelId,
                      ])
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </Show>
    </Show>
  )
}

// ===========================================================================
// Issue Sidebar Component
// ===========================================================================

interface IssueSidebarProps {
  issue: IssueRow | undefined
  labels: LabelRow[]
  availableLabels: AvailableLabelRow[]
  statuses: StatusRow[]
  users: UserRow[]
  workspaceSlug: string
  onStatusChange: (statusId: string) => void
  onPriorityChange: (priority: number) => void
  onAssigneeChange: (userId: string | null) => void
  onLabelToggle: (labelId: string, isAdding: boolean) => void
}

function IssueSidebar(props: IssueSidebarProps) {
  const [propertiesOpen, setPropertiesOpen] = createSignal(true)
  const [labelsOpen, setLabelsOpen] = createSignal(true)
  const [projectOpen, setProjectOpen] = createSignal(true)
  const [promptMenuOpen, setPromptMenuOpen] = createSignal(false)
  const [copiedUrl, setCopiedUrl] = createSignal(false)
  const [copiedId, setCopiedId] = createSignal(false)
  const [copiedBranch, setCopiedBranch] = createSignal(false)
  const [copiedPrompt, setCopiedPrompt] = createSignal(false)

  // Reactive computed values — always read from props.issue, never a static snapshot
  const currentPriority = () => mapPriority(props.issue?.priority ?? 0)
  const currentStatus = () => props.statuses.find((s) => s.id === props.issue?.status_id)

  if (!props.issue) return null
  const iss = props.issue

  const issueIdentifier = `${iss.team_identifier}-${iss.number}`
  const branchName = `${iss.team_identifier.toLowerCase()}-${iss.number}/${slugify(iss.title)}`

  function flashCopy(setter: (v: boolean) => void, text: string, label: string = "Copied!") {
    navigator.clipboard.writeText(text)
    toast.success(label)
    setter(true)
    setTimeout(() => setter(false), 1500)
  }

  function copyIssueId() {
    const text = issueIdentifier
    navigator.clipboard.writeText(text)
    toast.success(`"${text}" copied to clipboard`)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 1500)
  }

  function copyBranchName() {
    const text = branchName
    navigator.clipboard.writeText(text)
    toast.success(
      <div class="flex gap-3">
        <div class="flex flex-col gap-0.5">
          <div class="text-xs font-medium">{text}</div>
          <div class="text-xs opacity-80">
            Branch name copied to clipboard. Paste it into your favorite git client.
          </div>
        </div>
      </div>,
      { duration: 4000 }
    )
    setCopiedBranch(true)
    setTimeout(() => setCopiedBranch(false), 1500)
  }

  function buildPrompt() {
    return `Issue: ${issueIdentifier} — ${iss.title}\n\n${iss.description ?? ""}`
  }

  const statusItems = () => makeStatusItems(props.statuses)
  const priorityItems = () => makePriorityItems()

  const selectedLabelIds = () => props.labels.map((l) => l.id).join(",")

  const labelItems = (): ComboboxItem[] =>
    props.availableLabels.map((l) => ({
      value: l.id,
      label: (
        <span class="flex items-center gap-2">
          <span
            class="size-2.5 rounded-full shrink-0"
            style={{ "background-color": l.color ?? "#6b7280" }}
          />
          {l.name}
        </span>
      ),
    }))

  function handleLabelChange(newValues: string | string[]) {
    const newIds = Array.isArray(newValues) ? newValues : newValues ? [newValues] : []
    const prevIds = new Set(props.labels.map((l) => l.id))
    const nextIds = new Set(newIds)
    for (const id of nextIds) {
      if (!prevIds.has(id)) props.onLabelToggle(id, true)
    }
    for (const id of prevIds) {
      if (!nextIds.has(id)) props.onLabelToggle(id, false)
    }
  }

  const assigneeItems = (): ComboboxItem[] => [
    {
      value: "",
      label: (
        <span class="flex items-center gap-2">
          <div class="flex size-4 shrink-0 items-center justify-center rounded-full border border-border/50">
            <IconPerson class="size-3 text-muted-foreground" />
          </div>
          Unassigned
        </span>
      ),
    },
    ...props.users.map((u) => ({
      value: u.id,
      label: (
        <span class="flex items-center gap-2">
          <div class="size-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span class="text-[8px] font-medium text-primary">
              {(u.display_name || "?").charAt(0).toUpperCase()}
            </span>
          </div>
          {u.display_name || u.email || "Unknown"}
        </span>
      ),
    })),
  ]

  useHotkeys([
    [
      "meta+shift+,",
      () =>
        flashCopy(
          setCopiedUrl,
          typeof window !== "undefined" ? window.location.href : "",
          "Issue URL copied to clipboard"
        ),
    ],
    ["meta+.", copyIssueId],
    ["meta+shift+.", copyBranchName],
    ["meta+alt+p", () => flashCopy(setCopiedPrompt, buildPrompt(), "Copied as prompt")],
  ])

  return (
    <div class="flex flex-col gap-2.5 p-3 h-full">
      {/* Action icon buttons */}
      <div class="flex items-center justify-end gap-1 px-0.5 pt-0.5">
        {/* Copy issue URL */}
        <Tippy content="Copy issue URL  ⌘⇧," props={{ placement: "bottom" }}>
          <button
            type="button"
            onClick={() =>
              flashCopy(
                setCopiedUrl,
                typeof window !== "undefined" ? window.location.href : "",
                "Issue URL copied to clipboard"
              )
            }
            class="size-[33px] rounded-full flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.10] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Show when={copiedUrl()} fallback={<SidebarLinkIcon class="size-[15px]" />}>
              <IconCheck class="size-[15px] text-green-400" />
            </Show>
          </button>
        </Tippy>

        {/* Copy issue ID */}
        <Tippy content="Copy issue ID  ⌘." props={{ placement: "bottom" }}>
          <button
            type="button"
            onClick={copyIssueId}
            class="size-[33px] rounded-full flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.10] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Show when={copiedId()} fallback={<IdBadgeIcon class="size-[15px]" />}>
              <IconCheck class="size-[15px] text-green-400" />
            </Show>
          </button>
        </Tippy>

        {/* Copy git branch name */}
        <Tippy content="Copy git branch name  ⌘⇧." props={{ placement: "bottom" }}>
          <button
            type="button"
            onClick={copyBranchName}
            class="size-[33px] rounded-full flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.10] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Show when={copiedBranch()} fallback={<GitBranchIcon class="size-[15px]" />}>
              <IconCheck class="size-[15px] text-green-400" />
            </Show>
          </button>
        </Tippy>

        {/* Copy as prompt (with chevron dropdown) */}
        <div class="flex items-center rounded-full bg-white/[0.05] overflow-hidden">
          <Tippy content="Copy as prompt  ⌘⌥P" props={{ placement: "bottom" }}>
            <button
              type="button"
              onClick={() => flashCopy(setCopiedPrompt, buildPrompt(), "Copied as prompt")}
              class="h-[33px] px-2 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
            >
              <Show when={copiedPrompt()} fallback={<CursorPromptIcon class="size-[15px]" />}>
                <IconCheck class="size-[15px] text-green-400" />
              </Show>
            </button>
          </Tippy>
          <Popover open={promptMenuOpen()} onOpenChange={setPromptMenuOpen}>
            <PopoverTrigger class="h-[33px] px-1.5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors border-l border-white/[0.08]">
              <IconChevronDown class="size-3" />
            </PopoverTrigger>
            <PopoverContent class="w-48 p-1">
              <button
                type="button"
                onClick={() => {
                  flashCopy(setCopiedPrompt, buildPrompt(), "Copied as prompt")
                  setPromptMenuOpen(false)
                }}
                class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[13px] text-foreground hover:bg-white/[0.06] transition-colors text-left"
              >
                <CursorPromptIcon class="size-3.5 shrink-0 text-muted-foreground" />
                Copy as prompt
              </button>
              <button
                type="button"
                onClick={() => setPromptMenuOpen(false)}
                class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[13px] text-foreground hover:bg-white/[0.06] transition-colors text-left"
              >
                <GearIcon class="size-3.5 shrink-0 text-muted-foreground" />
                Configure coding tools
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Properties Card */}
      <div class="rounded-xl bg-white/[0.04] overflow-hidden">
        {/* Card header */}
        <button
          type="button"
          onclick={() => setPropertiesOpen((o) => !o)}
          class="w-full flex items-center gap-1.5 px-3.5 pt-3 pb-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <span class="font-medium">Properties</span>
          <IconChevronDown
            class={cn(
              "size-3 shrink-0 transition-transform duration-200",
              propertiesOpen() ? "rotate-0" : "-rotate-90"
            )}
          />
        </button>

        <Show when={propertiesOpen()}>
          <div class="px-2 pb-2 space-y-0.5">
            {/* Status */}
            <SidebarCombobox
              items={statusItems()}
              selectedValue={props.issue?.status_id || ""}
              onSelect={(v) => props.onStatusChange(v as string)}
              searchPlaceholder="Search status..."
              contentClass="w-56"
            >
              <StatusIcon
                category={currentStatus()?.category ?? null}
                class="size-[15px] shrink-0"
              />
              <span class="font-medium text-foreground">
                {currentStatus()?.name ?? "No status"}
              </span>
            </SidebarCombobox>

            {/* Priority */}
            <SidebarCombobox
              items={priorityItems()}
              selectedValue={(props.issue?.priority ?? 0).toString()}
              onSelect={(v) => props.onPriorityChange(parseInt(v as string, 10))}
              searchPlaceholder="Search priority..."
              contentClass="w-52"
            >
              <PriorityIcon value={props.issue?.priority ?? 0} class="size-3.5 shrink-0" />
              <span
                class={cn(
                  currentPriority() === "none"
                    ? "text-muted-foreground"
                    : "font-medium text-foreground"
                )}
              >
                {currentPriority() === "none"
                  ? "Set priority"
                  : currentPriority().charAt(0).toUpperCase() + currentPriority().slice(1)}
              </span>
            </SidebarCombobox>

            {/* Assignee */}
            <SidebarCombobox
              items={assigneeItems()}
              selectedValue={iss.assignee_id || ""}
              onSelect={(v) => props.onAssigneeChange((v as string) || null)}
              searchPlaceholder="Assign to..."
              contentClass="w-56"
            >
              <div class="size-[15px] rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span class="text-[8px] font-medium text-primary">
                  {iss.assignee_name ? iss.assignee_name.charAt(0).toUpperCase() : "?"}
                </span>
              </div>
              <span
                class={cn(
                  iss.assignee_name ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {iss.assignee_name ?? "Assign"}
              </span>
            </SidebarCombobox>
          </div>
        </Show>
      </div>

      {/* Labels Card */}
      <div class="rounded-xl bg-white/[0.04] overflow-hidden">
        <button
          type="button"
          onclick={() => setLabelsOpen((o) => !o)}
          class="w-full flex items-center gap-1.5 px-3.5 pt-3 pb-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <span class="font-medium">Labels</span>
          <IconChevronDown
            class={cn(
              "size-3 shrink-0 transition-transform duration-200",
              labelsOpen() ? "rotate-0" : "-rotate-90"
            )}
          />
        </button>

        <Show when={labelsOpen()}>
          <div class="px-2 pb-2 space-y-1.5">
            <Show when={props.labels.length > 0}>
              <div class="px-2 flex flex-wrap gap-1.5">
                <For each={props.labels}>
                  {(label) => (
                    <span
                      class="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        color: label.color ?? "var(--muted-foreground)",
                        "background-color": label.color
                          ? `${label.color}22`
                          : "rgba(255,255,255,0.06)",
                      }}
                    >
                      {label.name}
                    </span>
                  )}
                </For>
              </div>
            </Show>
            <SidebarCombobox
              items={labelItems()}
              selectedValue={selectedLabelIds()}
              onSelect={handleLabelChange}
              searchPlaceholder="Add labels..."
              contentClass="w-56"
              multiple={true}
            >
              <IconTag class="size-3.5 shrink-0 text-muted-foreground" />
              <span class="text-muted-foreground">Add label</span>
            </SidebarCombobox>
          </div>
        </Show>
      </div>

      {/* Project Card */}
      <div class="rounded-xl bg-white/[0.04] overflow-hidden">
        <button
          type="button"
          onclick={() => setProjectOpen((o) => !o)}
          class="w-full flex items-center gap-1.5 px-3.5 pt-3 pb-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <span class="font-medium">Project</span>
          <IconChevronDown
            class={cn(
              "size-3 shrink-0 transition-transform duration-200",
              projectOpen() ? "rotate-0" : "-rotate-90"
            )}
          />
        </button>

        <Show when={projectOpen()}>
          <div class="px-2 pb-2">
            <button
              type="button"
              class="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-[13px] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
            >
              <IconProjects class="size-3.5 shrink-0" />
              <span>Add to project</span>
            </button>
          </div>
        </Show>
      </div>

      {/* Created/Updated — no card, just muted text at the bottom */}
      <div class="mt-auto px-1 py-1 space-y-1.5">
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-muted-foreground/50">Created</span>
          <span class="text-muted-foreground/70">{formatDate(iss.created_at)}</span>
        </div>
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-muted-foreground/50">Updated</span>
          <span class="text-muted-foreground/70">{formatDate(iss.updated_at)}</span>
        </div>
      </div>
    </div>
  )
}

function StatusBadge(props: { category: StatusCategory | null; name: string | null }) {
  const config: Record<string, { color: string; bg: string }> = {
    backlog: { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
    unstarted: { color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
    started: { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
    completed: { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    cancelled: { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  }
  const c = () => config[props.category ?? "backlog"] ?? config.backlog
  return (
    <span
      class="text-[11px] px-2 py-0.5 rounded-full font-medium"
      style={{ color: c().color, "background-color": c().bg }}
    >
      {props.name ?? props.category ?? "No status"}
    </span>
  )
}

function LinkIcon(props: { class?: string }) {
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
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function TrashIcon(props: { class?: string }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

function SidebarLinkIcon(props: { class?: string }) {
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
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function IdBadgeIcon(props: { class?: string }) {
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
      <rect x="2" y="4" width="20" height="16" rx="3" ry="3" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M9 14h6" />
    </svg>
  )
}

function GitBranchIcon(props: { class?: string }) {
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
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  )
}

function CursorPromptIcon(props: { class?: string }) {
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
      <path d="M5 3l14 9-7 1-3 7z" />
    </svg>
  )
}

function GearIcon(props: { class?: string }) {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
