import { cn } from "@/utils/cn"

export function Kbd(props: { children: string; class?: string }) {
  const parts = props.children.split(/(\s+)/)

  return (
    <span class={cn("inline-flex items-center gap-px", props.class)}>
      {parts.map((part, i) => {
        if (part.trim() === "") {
          return <span key={i}>{part}</span>
        }
        return (
          <kbd
            key={i}
            class="inline-flex items-center justify-center px-1 py-px rounded text-[10px] font-sans font-medium text-foreground/80 bg-muted border border-border/60 shadow-[0_1px_0_rgba(0,0,0,0.1)] min-w-[14px] h-[16px]"
          >
            {part}
          </kbd>
        )
      })}
    </span>
  )
}
