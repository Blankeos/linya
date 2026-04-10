import { For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import getTitle from "@/utils/get-title"
import { usePowerSyncQuery } from "@/lib/powersync"

type TeamRow = {
  id: string
  name: string
  identifier: string
  description: string | null
  icon: string | null
  color: string | null
}

export default function TeamsPage() {
  useMetadata({ title: getTitle("Teams") })
  const pageCtx = usePageContext()
  const workspaceSlug = () => (pageCtx.routeParams as Record<string, string>).workspace ?? ""

  const [teams] = usePowerSyncQuery<TeamRow>(
    () => `
      SELECT t.id, t.name, t.identifier, t.description, t.icon, t.color
      FROM team t
      JOIN workspace w ON t.workspace_id = w.id
      WHERE w.slug = ?
      ORDER BY t.name ASC
    `,
    () => [workspaceSlug()]
  )

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <h1 class="text-[14px] font-semibold text-foreground tracking-[-0.01em] flex-1">
          Teams
        </h1>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show
          when={teams().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <p class="text-[13px]">No teams yet</p>
              <p class="text-[12px] text-muted-foreground/50">
                Create teams to organize work across your workspace.
              </p>
            </div>
          }
        >
          <div class="p-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <For each={teams()}>
              {(team) => (
                <a
                  href={`/${workspaceSlug()}/team/${team.identifier}/issues`}
                  class="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-border hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  <div
                    class="size-8 rounded flex items-center justify-center shrink-0 text-[14px] font-semibold text-white"
                    style={{ "background-color": team.color ?? "#6b7280" }}
                  >
                    {team.icon ?? team.name[0]?.toUpperCase()}
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-[13px] font-medium text-foreground truncate">{team.name}</span>
                    <span class="text-[11px] text-muted-foreground/60">{team.identifier}</span>
                  </div>
                </a>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}
