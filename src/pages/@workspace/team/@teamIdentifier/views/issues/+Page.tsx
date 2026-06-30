import { Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { usePowerSyncGetOne } from "@/lib/powersync"
import getTitle from "@/utils/get-title"
import { ViewsList } from "@/components/views-shared"

export default function TeamViewsPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const teamIdentifier = () => params().teamIdentifier ?? ""

  useMetadata({ title: getTitle(`${teamIdentifier()} — Views`) })

  const [team] = usePowerSyncGetOne<{ id: string }>(
    () => `
      SELECT t.id FROM team t
      JOIN workspace w ON t.workspace_id = w.id
      WHERE w.slug = ? AND t.identifier = ?
    `,
    () => [workspaceSlug(), teamIdentifier()]
  )

  return (
    <Show when={team()} fallback={<div class="flex-1" />}>
      <ViewsList
        workspaceSlug={workspaceSlug()}
        teamId={team()!.id}
        teamIdentifier={teamIdentifier()}
        tab="issues"
      />
    </Show>
  )
}
