import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import getTitle from "@/utils/get-title"
import { ViewsList } from "@/components/views-shared"

export default function ViewsIssuesPage() {
  useMetadata({ title: getTitle("Views") })
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""

  return <ViewsList workspaceSlug={workspaceSlug()} tab="issues" />
}
