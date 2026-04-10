import { createSignal, For } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import getTitle from "@/utils/get-title"

type Status = "backlog" | "todo" | "in_progress" | "done" | "cancelled"
type Priority = "urgent" | "high" | "medium" | "low" | "none"

const ISSUE = {
  id: "ENG-2",
  team: "Engineering",
  title: "Design and implement sidebar navigation shell",
  description: `## Overview

Build the main application UI shell — the sidebar navigation and key views that make Linya look and feel like Linear.

## Requirements

- Left sidebar with workspace name, navigation sections, and user footer
- Navigation should include Inbox, My Issues, Favorites, Teams (with sub-items), Views, and Settings
- Sidebar items should use compact styling with 13px text
- Active item highlighting
- Collapsible team sections

## Notes

Keep components in the same file unless they're large. All icons should be inline SVG — no external icon libraries.`,
  status: "in_progress" as Status,
  priority: "high" as Priority,
  assignee: "Carlo",
  assigneeInitials: "C",
  labels: ["UI"],
  createdAt: "Apr 10, 2026",
  updatedAt: "Apr 10, 2026",
  dueDate: "Apr 15, 2026",
  comments: [
    {
      id: "c1",
      author: "Carlo",
      authorInitials: "C",
      timestamp: "Apr 10, 2026 at 9:00 AM",
      body: "Starting on this today. Will implement the sidebar first, then wire up the navigation.",
    },
  ],
}

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
]

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "No priority" },
]

export default function IssueDetailPage() {
  useMetadata({ title: getTitle(`${ISSUE.id} — ${ISSUE.title}`) })
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const teamIdentifier = () => params().teamIdentifier ?? ""

  const [title, setTitle] = createSignal(ISSUE.title)
  const [status, setStatus] = createSignal<Status>(ISSUE.status)
  const [priority, setPriority] = createSignal<Priority>(ISSUE.priority)
  const [comment, setComment] = createSignal("")
  const [copied, setCopied] = createSignal(false)

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div class="flex items-center gap-2 px-4 py-2 border-b border-border/50 shrink-0">
        <div class="flex items-center gap-1.5 text-[12px] text-muted-foreground flex-1 min-w-0">
          <span class="truncate">{ISSUE.team}</span>
          <span class="text-muted-foreground/40 shrink-0">/</span>
          <a
            href={`/${workspaceSlug()}/team/${teamIdentifier()}/issues`}
            class="hover:text-foreground transition-colors shrink-0"
          >
            Issues
          </a>
          <span class="text-muted-foreground/40 shrink-0">/</span>
          <span class="text-foreground shrink-0">{ISSUE.id}</span>
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
            <span class="text-[12px] font-mono text-muted-foreground/60">{ISSUE.id}</span>
            <StatusBadge status={status()} />
          </div>

          <textarea
            class="w-full text-[22px] font-semibold text-foreground tracking-[-0.02em] bg-transparent border-none outline-none resize-none leading-tight placeholder:text-muted-foreground/40 mb-5"
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            rows={Math.ceil(title().length / 60) || 1}
            placeholder="Issue title"
          />

          <div class="mb-8">
            <div class="min-h-[120px] text-[13px] text-foreground/80 leading-relaxed border border-border/30 rounded-md p-4 bg-secondary/10 focus-within:border-border transition-colors">
              <textarea
                class="w-full bg-transparent border-none outline-none resize-none text-[13px] text-foreground/80 leading-relaxed min-h-[100px] placeholder:text-muted-foreground/40"
                value={ISSUE.description}
                rows={12}
                placeholder="Add description… (supports Markdown)"
              />
            </div>
            <p class="text-[11px] text-muted-foreground/40 mt-1.5 px-1">
              Tip: Markdown is supported.
            </p>
          </div>

          {/* Comments */}
          <div class="border-t border-border/30 pt-6">
            <h2 class="text-[13px] font-medium text-muted-foreground mb-4">
              Comments ({ISSUE.comments.length})
            </h2>
            <div class="space-y-4 mb-6">
              <For each={ISSUE.comments}>
                {(c) => (
                  <div class="flex gap-3">
                    <div class="size-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span class="text-[10px] font-medium text-primary">{c.authorInitials}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-[12px] font-medium text-foreground">{c.author}</span>
                        <span class="text-[11px] text-muted-foreground/60">{c.timestamp}</span>
                      </div>
                      <p class="text-[13px] text-foreground/80 leading-relaxed">{c.body}</p>
                    </div>
                  </div>
                )}
              </For>
            </div>
            <div class="flex gap-3">
              <div class="size-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <span class="text-[10px] font-medium text-primary">C</span>
              </div>
              <div class="flex-1">
                <textarea
                  value={comment()}
                  onInput={(e) => setComment(e.currentTarget.value)}
                  placeholder="Leave a comment…"
                  rows={3}
                  class="w-full bg-secondary/20 border border-border/40 rounded-md px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-border focus:ring-1 focus:ring-ring/30 resize-none transition-colors"
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
              <StatusIcon status={status()} class="size-4 shrink-0" />
              <span class="text-[13px] text-foreground">
                {STATUS_OPTIONS.find((o) => o.value === status())?.label}
              </span>
            </div>
          </MetaSection>

          <MetaSection label="Priority">
            <div class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.04] cursor-pointer transition-colors -mx-2">
              <PriorityIcon priority={priority()} class="size-3.5 shrink-0" />
              <span class="text-[13px] text-foreground">
                {PRIORITY_OPTIONS.find((o) => o.value === priority())?.label}
              </span>
            </div>
          </MetaSection>

          <MetaSection label="Assignee">
            <div class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.04] cursor-pointer transition-colors -mx-2">
              <div class="size-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span class="text-[9px] font-medium text-primary">{ISSUE.assigneeInitials}</span>
              </div>
              <span class="text-[13px] text-foreground">{ISSUE.assignee}</span>
            </div>
          </MetaSection>

          <MetaSection label="Labels">
            <div class="flex flex-wrap gap-1 px-2 -mx-2">
              <For each={ISSUE.labels}>
                {(label) => (
                  <span class="text-[11px] px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground bg-secondary/30">
                    {label}
                  </span>
                )}
              </For>
              <button
                type="button"
                class="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-border/40 text-muted-foreground/50 hover:border-border hover:text-muted-foreground transition-colors"
              >
                + Add label
              </button>
            </div>
          </MetaSection>

          <MetaSection label="Due date">
            <div class="px-2 py-1.5 -mx-2">
              <span class="text-[13px] text-foreground">{ISSUE.dueDate}</span>
            </div>
          </MetaSection>

          <div class="pt-4 border-t border-border/30 space-y-2">
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-muted-foreground/60">Created</span>
              <span class="text-muted-foreground">{ISSUE.createdAt}</span>
            </div>
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-muted-foreground/60">Updated</span>
              <span class="text-muted-foreground">{ISSUE.updatedAt}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
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

function StatusBadge(props: { status: Status }) {
  const config: Record<Status, { label: string; color: string; bg: string }> = {
    backlog: { label: "Backlog", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
    todo: { label: "Todo", color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
    in_progress: { label: "In Progress", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
    done: { label: "Done", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    cancelled: { label: "Cancelled", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  }
  const c = config[props.status]
  return (
    <span
      class="text-[11px] px-2 py-0.5 rounded-full font-medium"
      style={{ color: c.color, "background-color": c.bg }}
    >
      {c.label}
    </span>
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
    none: "#4b5563",
  }
  return (
    <svg viewBox="0 0 16 16" class={props.class} aria-hidden="true">
      <rect x="1" y="8" width="2.5" height="6" rx="0.5" fill={colors[props.priority]} opacity="0.5" />
      <rect x="5" y="5" width="2.5" height="9" rx="0.5" fill={colors[props.priority]} opacity="0.7" />
      <rect x="9" y="2" width="2.5" height="12" rx="0.5" fill={colors[props.priority]} />
    </svg>
  )
}

function LinkIcon(props: { class?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      class={props.class} aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function TrashIcon(props: { class?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      class={props.class} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}
