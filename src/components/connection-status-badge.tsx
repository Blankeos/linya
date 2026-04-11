import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import { usePowerSync } from "@/lib/powersync"
import { Tippy } from "@/lib/solid-tippy/tippy"

export type ConnectionStatus = "offline" | "reconnecting" | null

export function useConnectionStatus(): () => ConnectionStatus {
  const [isOnline, setIsOnline] = createSignal(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )
  const { syncStatus } = usePowerSync()
  const [hasConnectedOnce, setHasConnectedOnce] = createSignal(false)

  onMount(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    onCleanup(() => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    })
  })

  createEffect(() => {
    if (syncStatus() === "connected") {
      setHasConnectedOnce(true)
    }
  })

  return () => {
    if (!isOnline()) return "offline"
    // Only show "reconnecting" after we've had a successful connection before
    if (hasConnectedOnce() && (syncStatus() === "connecting" || syncStatus() === "disconnected"))
      return "reconnecting"
    return null
  }
}

const BrailleIcon = () => (
  <svg width="10" height="14" viewBox="0 0 10 14" fill="none" class="inline-block shrink-0">
    <circle cx="2.5" cy="2.5" r="1.5" fill="currentColor" />
    <circle cx="7.5" cy="2.5" r="1.5" fill="currentColor" />
    <circle cx="2.5" cy="7" r="1.5" fill="currentColor" />
    <circle cx="7.5" cy="7" r="1.5" fill="currentColor" />
    <circle cx="2.5" cy="11.5" r="1.5" fill="currentColor" />
    <circle cx="7.5" cy="11.5" r="1.5" fill="currentColor" />
  </svg>
)

// Tooltip content for offline — uses no text-color classes so it inherits from tippy's custom theme
const OfflineTooltip = () => (
  <div style={{ "max-width": "260px" }}>
    <div style={{ "font-size": "14px", "font-weight": "600", "margin-bottom": "6px" }}>
      You are offline
    </div>
    <div style={{ "font-size": "12px", "opacity": "0.75", "margin-bottom": "6px" }}>
      Any changes you make will be saved after you regain connectivity.
    </div>
    <div style={{ "font-size": "12px", "opacity": "0.75", "margin-bottom": "8px" }}>
      <span style={{ "font-weight": "600", "opacity": "1" }}>Note:</span> Your changes might
      overwrite those of your online team members.
    </div>
    <div
      style={{
        "font-size": "12px",
        "opacity": "0.6",
        "padding-top": "8px",
        "border-top": "1px solid rgba(255,255,255,0.15)",
      }}
    >
      Click to try reconnecting.
    </div>
  </div>
)

export function ConnectionStatusBadge(props: { status: ConnectionStatus }) {
  const label = () => (props.status === "offline" ? "Offline" : "Reconnecting")

  return (
    <Show when={props.status}>
      <Tippy
        content={props.status === "offline" ? <OfflineTooltip /> : "Checking connection..."}
        props={{ placement: "bottom-start", offset: [0, 8] }}
      >
        <button
          type="button"
          class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-xs font-medium text-foreground border border-foreground/10"
          onClick={() => {
            if (props.status === "offline") window.location.reload()
          }}
        >
          <BrailleIcon />
          <span>{label()}</span>
        </button>
      </Tippy>
    </Show>
  )
}
