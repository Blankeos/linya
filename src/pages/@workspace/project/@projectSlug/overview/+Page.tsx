import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import getTitle from "@/utils/get-title"

export default function ProjectOverviewPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const projectSlug = () => params().projectSlug ?? ""
  const projectName = () => projectSlug().replace(/-/g, " ")

  useMetadata({ title: getTitle(`${projectName()} — Overview`) })

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <div class="flex items-center gap-1.5 text-[13px] flex-1">
          <span class="text-muted-foreground">Projects</span>
          <span class="text-muted-foreground/40">/</span>
          <span class="text-foreground font-medium capitalize">{projectName()}</span>
          <span class="text-muted-foreground/40">/</span>
          <span class="text-foreground font-medium">Overview</span>
        </div>
        <div class="flex items-center gap-1.5">
          <a
            href={`/${workspaceSlug()}/project/${projectSlug()}/issues`}
            class="px-2.5 py-1 rounded text-[12px] text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            Issues
          </a>
          <span class="px-2.5 py-1 rounded text-[12px] text-foreground bg-white/5 font-medium">
            Overview
          </span>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-8 py-8 max-w-3xl mx-auto w-full">
        {/* Project header */}
        <div class="mb-8">
          <div class="flex items-start gap-4 mb-4">
            <div class="size-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <span class="text-[18px]">🚀</span>
            </div>
            <div class="flex-1 min-w-0">
              <h1 class="text-[22px] font-semibold tracking-[-0.02em] text-foreground capitalize mb-1">
                {projectName()}
              </h1>
              <p class="text-[13px] text-muted-foreground">No description yet.</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div class="mb-8 p-4 border border-border/40 rounded-lg bg-secondary/10">
          <div class="flex items-center justify-between text-[13px] mb-2">
            <span class="text-muted-foreground font-medium">Progress</span>
            <span class="text-foreground font-medium">0%</span>
          </div>
          <div class="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div class="h-full w-0 rounded-full bg-primary transition-all" />
          </div>
          <div class="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground/60">
            <span>0 of 0 issues completed</span>
          </div>
        </div>

        {/* Updates */}
        <div>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-[14px] font-medium text-foreground">Project updates</h2>
            <button
              type="button"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/60 text-[12px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              <PlusIcon class="size-3.5" />
              Add update
            </button>
          </div>

          <div class="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <p class="text-[13px]">No updates yet</p>
            <p class="text-[12px] text-muted-foreground/50">
              Share progress and keep stakeholders informed.
            </p>
          </div>
        </div>
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
