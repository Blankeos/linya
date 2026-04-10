import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import getTitle from "@/utils/get-title"

export default function CyclesPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const teamIdentifier = () => params().teamIdentifier ?? ""

  useMetadata({ title: getTitle(`${teamIdentifier()} — Cycles`) })

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <div class="flex items-center gap-1.5 text-[13px] flex-1">
          <span class="text-muted-foreground">Engineering</span>
          <span class="text-muted-foreground/40">/</span>
          <span class="text-foreground font-medium">Cycles</span>
        </div>
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-primary-foreground text-[12px] hover:opacity-90 transition-opacity"
        >
          <PlusIcon class="size-3.5" />
          New Cycle
        </button>
      </div>

      <div class="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <CycleIcon class="size-10 opacity-20" />
        <div class="text-center">
          <p class="text-[14px] font-medium text-foreground/60 mb-1">No cycles yet</p>
          <p class="text-[13px] text-muted-foreground/60">
            Cycles help you plan and track work in time-boxed sprints.
          </p>
        </div>
        <button
          type="button"
          class="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded border border-border/60 text-[12px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <PlusIcon class="size-3.5" />
          Create your first cycle
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

function CycleIcon(props: { class?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      class={props.class} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
