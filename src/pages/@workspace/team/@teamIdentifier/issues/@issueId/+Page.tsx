import { createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import getTitle from "@/utils/get-title"
import TiptapEditor from "@/components/tiptap-editor"
import { usePowerSyncGetOne, usePowerSyncQuery } from "@/lib/powersync"
import { StatusIcon, PriorityIcon, StatusBadge } from "@/components/issue-fields"

type StatusCategory = "backlog" | "unstarted" | "started" | "completed" | "cancelled"
type Priority = "urgent" | "high" | "medium" | "low" | "none"

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
  team_name: string
  team_identifier: string
  status_name: string | null
  status_category: StatusCategory | null
  status_color: string | null
  assignee_name: string | null
  assignee_avatar: string | null
}

type LabelRow = {
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

export default function IssueDetailPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const teamIdentifier = () => params().teamIdentifier ?? ""
  const issueId = () => params().issueId ?? ""
  const issueNumber = () => {
    const raw = issueId()
    const prefix = teamIdentifier() + "-"
    return raw.startsWith(prefix) ? parseInt(raw.slice(prefix.length), 10) : NaN
  }

  const [issue, issueLoading] = usePowerSyncGetOne<IssueRow>(
    () => `
      SELECT
        i.id, i.title, i.description, i.description_html,
        i.priority, i.due_date, i.created_at, i.updated_at, i.number,
        t.name as team_name, t.identifier as team_identifier,
        ws.name as status_name, ws.category as status_category, ws.color as status_color,
        u.display_name as assignee_name, u.avatar_url as assignee_avatar
      FROM issue i
      LEFT JOIN team t ON i.team_id = t.id
      LEFT JOIN workflow_status ws ON i.status_id = ws.id
      LEFT JOIN user u ON i.assignee_id = u.id
      WHERE t.identifier = ? AND i.number = ?
    `,
    () => [teamIdentifier(), issueNumber()]
  )

  const [labels] = usePowerSyncQuery<LabelRow>(
    () => `
      SELECT l.name, l.color
      FROM issue_label il
      JOIN label l ON il.label_id = l.id
      WHERE il.issue_id = ?
    `,
    () => [issue()?.id ?? ""]
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

  const issueIdentifier = () =>
    issue() ? `${issue()!.team_identifier}-${issue()!.number}` : issueId()
  const priority = () => mapPriority(issue()?.priority ?? 0)
  const statusCategory = () => issue()?.status_category ?? null

  useMetadata({ title: getTitle(issue() ? `${issueIdentifier()} — ${issue()!.title}` : issueId()) })

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

                <h1 class="text-[22px] font-semibold text-foreground tracking-[-0.02em] leading-tight mb-5">
                  {iss().title}
                </h1>

                <div class="mb-8">
                  <TiptapEditor
                    content={iss().description_html ?? iss().description ?? ""}
                    placeholder="Add description… (type / for commands)"
                    editorClass="min-h-[120px]"
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
              <div class="w-[260px] shrink-0 border-l border-border/40 overflow-y-auto px-4 py-5">
                <MetaSection label="Status">
                  <div class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.04] cursor-pointer transition-colors -mx-2">
                    <StatusIcon category={statusCategory()} class="size-4 shrink-0" />
                    <span class="text-[13px] text-foreground">
                      {iss().status_name ?? "No status"}
                    </span>
                  </div>
                </MetaSection>

                <MetaSection label="Priority">
                  <div class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.04] cursor-pointer transition-colors -mx-2">
                    <PriorityIcon value={priority()} class="size-3.5 shrink-0" />
                    <span class="text-[13px] text-foreground capitalize">
                      {priority() === "none" ? "No priority" : priority()}
                    </span>
                  </div>
                </MetaSection>

                <MetaSection label="Assignee">
                  <div class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.04] cursor-pointer transition-colors -mx-2">
                    <div class="size-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span class="text-[9px] font-medium text-primary">
                        {iss().assignee_name ? iss().assignee_name!.charAt(0).toUpperCase() : "?"}
                      </span>
                    </div>
                    <span class="text-[13px] text-foreground">
                      {iss().assignee_name ?? "Unassigned"}
                    </span>
                  </div>
                </MetaSection>

                <MetaSection label="Labels">
                  <div class="flex flex-wrap gap-1 px-2 -mx-2">
                    <Show
                      when={labels().length > 0}
                      fallback={
                        <span class="text-[12px] text-muted-foreground/50 py-1">No labels</span>
                      }
                    >
                      <For each={labels()}>
                        {(label) => (
                          <span class="text-[11px] px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground bg-secondary/30">
                            {label.name}
                          </span>
                        )}
                      </For>
                    </Show>
                  </div>
                </MetaSection>

                <MetaSection label="Due date">
                  <div class="px-2 py-1.5 -mx-2">
                    <span class="text-[13px] text-foreground">
                      {iss().due_date ? formatDateShort(iss().due_date) : "No due date"}
                    </span>
                  </div>
                </MetaSection>

                <div class="pt-4 border-t border-border/30 space-y-2">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="text-muted-foreground/60">Created</span>
                    <span class="text-muted-foreground">{formatDate(iss().created_at)}</span>
                  </div>
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="text-muted-foreground/60">Updated</span>
                    <span class="text-muted-foreground">{formatDate(iss().updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Show>
    </Show>
  )
}

function MetaSection(props: { label: string; children: any }) {
  return (
    <div class="py-2 border-b border-border/20">
      <div class="text-[11px] text-muted-foreground/50 mb-1 uppercase tracking-wider font-medium">
        {props.label}
      </div>
      {props.children}
    </div>
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
