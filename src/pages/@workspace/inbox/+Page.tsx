import { For } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import getTitle from "@/utils/get-title"

const PLACEHOLDER_NOTIFICATIONS = [
  {
    id: "n1",
    type: "mention",
    actor: "Alex",
    actorInitials: "A",
    issueId: "ENG-3",
    issueTitle: "Create issue list view with filters and sorting",
    body: "mentioned you in a comment",
    timestamp: "2h ago",
    read: false,
  },
  {
    id: "n2",
    type: "assigned",
    actor: "Sam",
    actorInitials: "S",
    issueId: "ENG-4",
    issueTitle: "Implement issue detail page with metadata panel",
    body: "assigned this issue to you",
    timestamp: "5h ago",
    read: false,
  },
  {
    id: "n3",
    type: "status",
    actor: "Jamie",
    actorInitials: "J",
    issueId: "ENG-1",
    issueTitle: "Set up authentication with email/password and OAuth",
    body: "marked as Done",
    timestamp: "Yesterday",
    read: true,
  },
]

export default function InboxPage() {
  useMetadata({ title: getTitle("Inbox") })

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <h1 class="text-[14px] font-semibold text-foreground tracking-[-0.01em] flex-1">Inbox</h1>
        <button
          type="button"
          class="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Mark all as read
        </button>
      </div>

      {/* Notification list */}
      <div class="flex-1 overflow-y-auto">
        <For each={PLACEHOLDER_NOTIFICATIONS}>
          {(n) => (
            <div
              class={`flex items-start gap-3 px-4 py-3 border-b border-border/20 hover:bg-white/[0.02] cursor-pointer transition-colors ${
                !n.read ? "bg-primary/[0.03]" : ""
              }`}
            >
              {/* Unread dot */}
              <div class="mt-1.5 shrink-0">
                {!n.read ? (
                  <div class="size-1.5 rounded-full bg-primary" />
                ) : (
                  <div class="size-1.5" />
                )}
              </div>

              {/* Actor avatar */}
              <div class="size-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <span class="text-[10px] font-medium text-muted-foreground">{n.actorInitials}</span>
              </div>

              {/* Content */}
              <div class="flex-1 min-w-0">
                <p class="text-[13px] text-foreground/80 leading-snug">
                  <span class="font-medium text-foreground">{n.actor}</span>{" "}
                  {n.body}
                </p>
                <p class="text-[12px] text-muted-foreground/70 mt-0.5 truncate">
                  {n.issueId} · {n.issueTitle}
                </p>
              </div>

              {/* Timestamp */}
              <span class="text-[11px] text-muted-foreground/50 shrink-0 mt-0.5">{n.timestamp}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
