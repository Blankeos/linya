import { For } from "solid-js"

export interface PillTab {
  label: string
  href: string
}

interface PillTabsProps {
  tabs: PillTab[]
  active: string
  class?: string
  containerClass?: string
  variant?: "default" | "compact"
}

export function PillTabs(props: PillTabsProps) {
  const isCompact = props.variant === "compact"
  const defaultContainerClass = isCompact
    ? "flex items-center gap-1"
    : "flex shrink-0 items-center gap-1 px-4 py-2 border-b border-border/50"

  return (
    <div class={props.containerClass ?? defaultContainerClass}>
      <For each={props.tabs}>
        {(tab) => (
          <a
            href={tab.href}
            class={`rounded-full px-3 py-1 text-[13px] transition-colors ${props.class ?? ""} ${
              props.active === tab.label.toLowerCase()
                ? "bg-foreground/10 text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            {tab.label}
          </a>
        )}
      </For>
    </div>
  )
}
