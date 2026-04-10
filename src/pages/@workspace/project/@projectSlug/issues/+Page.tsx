import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import getTitle from "@/utils/get-title"

export default function ProjectIssuesPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const projectSlug = () => params().projectSlug ?? ""
  const projectName = () => projectSlug().replace(/-/g, " ")

  useMetadata({ title: getTitle(`${projectName()} — Issues`) })

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <div class="flex items-center gap-1.5 text-[13px] flex-1">
          <span class="text-muted-foreground">Projects</span>
          <span class="text-muted-foreground/40">/</span>
          <span class="text-foreground font-medium capitalize">{projectName()}</span>
          <span class="text-muted-foreground/40">/</span>
          <span class="text-foreground font-medium">Issues</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="px-2.5 py-1 rounded text-[12px] text-foreground bg-white/5 font-medium">
            Issues
          </span>
          <a
            href={`/${workspaceSlug()}/project/${projectSlug()}/overview`}
            class="px-2.5 py-1 rounded text-[12px] text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            Overview
          </a>
        </div>
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-primary-foreground text-[12px] hover:opacity-90 transition-opacity"
        >
          <PlusIcon class="size-3.5" />
          New Issue
        </button>
      </div>

      <div class="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <p class="text-[13px]">No issues in this project yet.</p>
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border/60 text-[12px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <PlusIcon class="size-3.5" />
          Add first issue
        </button>
      </div>
    </div>
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
