import { useMetadata } from "vike-metadata-solid"
import getTitle from "@/utils/get-title"

export default function PulseFollowingPage() {
  useMetadata({ title: getTitle("Pulse") })

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <h1 class="text-[14px] font-semibold text-foreground tracking-[-0.01em] flex-1">
          Pulse
        </h1>
      </div>

      <div class="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
        <p class="text-[13px]">No activity from people you follow</p>
      </div>
    </div>
  )
}
