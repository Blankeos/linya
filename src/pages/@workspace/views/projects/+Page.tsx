import { For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { navigate } from "vike/client/router"
import { usePowerSyncQuery } from "@/lib/powersync"
import getTitle from "@/utils/get-title"
import { IconIllusLayers } from "@/assets/icons"
import { PillTabs } from "@/components/pill-tabs"

type View = {
  id: string
  name: string
  description: string | null
  icon: string | null
  type: string
  filters: string
  display_options: string
  sort_order: number
  is_shared: boolean
  created_at: string
  updated_at: string
}

type Tab = "issues" | "projects"

export default function ViewsProjectsPage() {
  useMetadata({ title: getTitle("Views") })
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const tab = (): Tab => {
    const path = pageCtx.urlPathname
    return path.includes("/issues") ? "issues" : "projects"
  }

  const [views] = usePowerSyncQuery<View>(
    () => `
      SELECT cv.* FROM custom_view cv
      JOIN workspace w ON cv.workspace_id = w.id
      WHERE w.slug = ? AND cv.type = 'project'
      ORDER BY cv.sort_order ASC
    `,
    () => [workspaceSlug()]
  )

  return (
    <div class="flex h-full flex-col overflow-hidden bg-card">
      {/* Header */}
      <div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <h1 class="text-[14px] font-semibold text-foreground tracking-[-0.01em]">Views</h1>
        <div class="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(`/${workspaceSlug()}/views/issues/new`)}
            class="flex items-center justify-center w-7 h-7 rounded hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            class="flex items-center justify-center w-7 h-7 rounded hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <PillTabs
        tabs={[
          { label: "Issues", href: `/${workspaceSlug()}/views/issues` },
          { label: "Projects", href: `/${workspaceSlug()}/views/projects` },
        ]}
        active={tab()}
      />

      {/* Content */}
      <div class="flex-1 overflow-y-auto flex flex-col items-center justify-center">
        <Show
          when={views().length > 0}
          fallback={
            <div class="flex flex-col gap-5 px-12 py-8 max-w-lg text-left">
              <IconIllusLayers class="w-20 h-20" />
              <div class="flex flex-col gap-3">
                <h2 class="text-[16px] font-semibold text-foreground">Views</h2>
                <p class="text-[13px] text-muted-foreground leading-relaxed">
                  Create custom views using filters to show only the projects you want to see. You can save,
                  share, and favorite these views for easy access and faster team collaboration.
                </p>
                <p class="text-[13px] text-muted-foreground">
                  You can also save any existing view by clicking the{" "}
                  <span class="inline-flex items-center justify-center w-4 h-4 rounded border border-border/50 text-[10px] align-middle">⊕</span>
                  {" "}icon or by pressing{" "}
                  <kbd class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded border border-border/50 bg-muted text-[11px] font-mono">⌥</kbd>
                  {" "}
                  <kbd class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded border border-border/50 bg-muted text-[11px] font-mono">V</kbd>
                  .
                </p>
              </div>
              <div>
                <button
                  onClick={() => navigate(`/${workspaceSlug()}/views/issues/new`)}
                  class="rounded-full bg-primary px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary/90"
                >
                  Create new view
                </button>
              </div>
            </div>
          }
        >
          <div class="w-full">
            <div class="space-y-1 p-4">
              <For each={views()}>
                {(view) => (
                  <div
                    onClick={() => navigate(`/${workspaceSlug()}/view/${view.id}`)}
                    class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 transition-colors cursor-pointer text-left group"
                  >
                    <div class="flex-1">
                      <div class="text-[13px] font-medium text-foreground">{view.name}</div>
                      {view.description && (
                        <div class="text-[12px] text-muted-foreground">{view.description}</div>
                      )}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
