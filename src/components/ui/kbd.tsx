import { createSignal } from "solid-js"
import { cn } from "@/utils/cn"
import { useKeyboard } from "bagon-hooks"

export function Kbd(props: { children: string; class?: string }) {
  const parts = props.children.split(/(\s+)/)
  const [isActive, setIsActive] = createSignal(false)

  useKeyboard({
    onKeyDown: (e) => {
      if (props.children.split(/(\s+)/).filter(p => p.trim() !== "").includes(e.key)) {
        setIsActive(true)
      }
    },
    onKeyUp: () => {
      setIsActive(false)
    },
  })

  return (
    <span class={cn("inline-flex items-center gap-px", props.class)}>
      {parts.map((part, i) => {
        if (part.trim() === "") {
          return <span key={i}>{part}</span>
        }
        return (
          <kbd
            key={i}
            class={cn(
              "inline-flex items-center justify-center px-1 py-px rounded text-[10px] font-sans font-medium text-foreground/80 bg-muted border border-border/60 shadow-[0_1px_0_rgba(0,0,0,0.1)] min-w-[14px] h-[16px]",
              isActive() && "bg-foreground/20 text-foreground border-foreground/40 shadow-none"
            )}
          >
            {part}
          </kbd>
        )
      })}
    </span>
  )
}
