import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import getTitle from "@/utils/get-title"

export default function ViewPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const viewSlug = () => params().viewSlug ?? ""

  useMetadata({ title: getTitle(viewSlug()) })

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <div class="flex items-center gap-1.5 text-[13px] flex-1">
          <span class="text-muted-foreground">Views</span>
          <span class="text-muted-foreground/40">/</span>
          <span class="text-foreground font-medium capitalize">{viewSlug().replace(/-/g, " ")}</span>
        </div>
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/60 text-[12px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <EditIcon class="size-3.5" />
          Edit view
        </button>
      </div>

      <div class="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <ViewIcon class="size-10 opacity-20" />
        <div class="text-center">
          <p class="text-[14px] font-medium text-foreground/60 mb-1 capitalize">
            {viewSlug().replace(/-/g, " ")}
          </p>
          <p class="text-[13px] text-muted-foreground/60">
            This view has no issues matching its filters.
          </p>
        </div>
      </div>
    </div>
  )
}

function EditIcon(props: { class?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      class={props.class} aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function ViewIcon(props: { class?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      class={props.class} aria-hidden="true">
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  )
}
