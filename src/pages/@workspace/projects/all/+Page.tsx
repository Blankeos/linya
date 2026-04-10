import { useMetadata } from "vike-metadata-solid"
import getTitle from "@/utils/get-title"
import { setNewProjectOpen } from "@/stores/workspace-ui"

export default function ProjectsAllPage() {
  useMetadata({ title: getTitle("Projects") })

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <h1 class="text-[14px] font-semibold text-foreground tracking-[-0.01em] flex-1">
          Projects
        </h1>
        <button
          type="button"
          onClick={() => setNewProjectOpen(true)}
          class="flex items-center justify-center w-7 h-7 rounded hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div class="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
        <p class="text-[13px]">No projects yet</p>
        <p class="text-[12px] text-muted-foreground/50">
          Create projects to group and track related issues.
        </p>
        <button
          type="button"
          onClick={() => setNewProjectOpen(true)}
          class="rounded-full bg-primary px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary/90"
        >
          Create new project
        </button>
      </div>
    </div>
  )
}
