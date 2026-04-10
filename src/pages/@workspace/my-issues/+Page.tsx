import { onMount } from "solid-js"
import { navigate } from "vike/client/router"
import { usePageContext } from "vike-solid/usePageContext"

export default function MyIssuesRedirectPage() {
  const pageCtx = usePageContext()
  const workspaceSlug = () => (pageCtx.routeParams as Record<string, string>).workspace ?? ""

  onMount(() => {
    navigate(`/${workspaceSlug()}/my-issues/assigned`, { overwriteLastHistoryEntry: true })
  })

  return null
}
