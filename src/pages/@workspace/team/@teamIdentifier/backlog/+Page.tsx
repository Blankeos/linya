import { For } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import getTitle from "@/utils/get-title"
import { StatusIcon, PriorityIcon } from "@/components/issue-fields"

type Priority = "urgent" | "high" | "medium" | "low" | "none"

const BACKLOG_ISSUES = [
  {
    id: "ENG-6",
    title: "Build onboarding flow for workspace + team creation",
    priority: "low" as Priority,
    labels: ["Onboarding"],
  },
  {
    id: "ENG-7",
    title: "Set up S3 storage for file attachments",
    priority: "low" as Priority,
    labels: ["Backend"],
  },
  {
    id: "ENG-8",
    title: "Write API documentation and developer guide",
    priority: "none" as Priority,
    labels: ["Docs"],
  },
]

export default function BacklogPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const teamIdentifier = () => params().teamIdentifier ?? ""

  useMetadata({ title: getTitle(`${teamIdentifier()} — Backlog`) })

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <div class="flex items-center gap-1.5 text-[13px] flex-1">
          <span class="text-muted-foreground">Engineering</span>
          <span class="text-muted-foreground/40">/</span>
          <span class="text-foreground font-medium">Backlog</span>
        </div>
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-primary-foreground text-[12px] hover:opacity-90 transition-opacity"
        >
          <PlusIcon class="size-3.5" />
          New Issue
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div class="flex items-center gap-2 px-4 py-2 border-b border-border/20 bg-background/50 sticky top-0">
          <StatusIcon category="backlog" class="size-3.5" />
          <span class="text-[12px] font-medium text-muted-foreground">Backlog</span>
          <span class="text-[11px] text-muted-foreground/50 bg-secondary/50 px-1.5 py-0.5 rounded-full">
            {BACKLOG_ISSUES.length}
          </span>
        </div>

        <For each={BACKLOG_ISSUES}>
          {(issue) => (
            <div class="flex items-center gap-3 px-4 py-1.5 border-b border-border/30 hover:bg-white/[0.03] cursor-pointer">
              <PriorityIcon value={issue.priority} class="size-3.5 shrink-0" />
              <StatusIcon category="backlog" class="size-4 shrink-0" />
              <span class="text-[12px] text-muted-foreground/60 font-mono shrink-0 w-14">
                {issue.id}
              </span>
              <span class="text-[13px] text-foreground flex-1 truncate">{issue.title}</span>
              <div class="hidden sm:flex items-center gap-1 shrink-0">
                <For each={issue.labels}>
                  {(label) => (
                    <span class="text-[11px] px-1.5 py-0.5 rounded-full border border-border/50 text-muted-foreground/70">
                      {label}
                    </span>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}

function PlusIcon(props: { class?: string }) {
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
