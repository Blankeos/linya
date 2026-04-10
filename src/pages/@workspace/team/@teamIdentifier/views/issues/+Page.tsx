import { useMetadata } from "vike-metadata-solid"
import { useParams } from "@/route-tree.gen"
import getTitle from "@/utils/get-title"

export default function TeamViewsPage() {
  const params = useParams({ from: "/@workspace/team/@teamIdentifier/views/issues" })
  const teamIdentifier = () => params().teamIdentifier

  useMetadata({ title: getTitle(`${teamIdentifier()} — Views`) })

  return (
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <h1 class="text-lg font-semibold">Views — {teamIdentifier()}</h1>
      </div>
      <div class="flex-1 flex items-center justify-center text-muted-foreground">
        Team views placeholder
      </div>
    </div>
  )
}
