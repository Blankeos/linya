import { useDisclosure, useHotkeys } from "bagon-hooks"
import { navigate } from "vike/client/router"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { NewIssueModal } from "./new-issue-modal"
import { useThemeContext, type Theme } from "@/context/theme.context"
import {
  IconPlus,
  IconPerson,
  IconInbox,
  IconGear,
  IconSun,
  IconMoon,
  IconSparkle,
  IconMonitor,
} from "@/assets/icons"

export function CommandMenu(props: { workspaceSlug: string }) {
  const [open, paletteActions] = useDisclosure()
  const [newIssueOpen, newIssueActions] = useDisclosure()
  const themeCtx = useThemeContext()

  useHotkeys([
    [
      "meta+k",
      (e: KeyboardEvent) => {
        e.preventDefault()
        paletteActions.toggle()
      },
    ],
  ])

  function go(path: string) {
    paletteActions.close()
    navigate(path)
  }

  return (
    <>
      <CommandDialog open={open()} onOpenChange={paletteActions.set}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Create">
            <CommandItem
              onSelect={() => {
                paletteActions.close()
                newIssueActions.open()
              }}
            >
              <IconPlus class="mr-2 size-4 shrink-0" />
              New Issue
              <CommandShortcut>C</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => go(`/${props.workspaceSlug}/my-issues`)}>
              <IconPerson class="mr-2 size-4 shrink-0" />
              My Issues
            </CommandItem>
            <CommandItem onSelect={() => go(`/${props.workspaceSlug}/inbox`)}>
              <IconInbox class="mr-2 size-4 shrink-0" />
              Inbox
            </CommandItem>
            <CommandItem onSelect={() => go(`/${props.workspaceSlug}/settings`)}>
              <IconGear class="mr-2 size-4 shrink-0" />
              Settings
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Theme">
            <CommandItem onSelect={() => { themeCtx.setTheme("light"); paletteActions.close() }}>
              <IconSun class="mr-2 size-4 shrink-0" />
              Light
              {themeCtx.theme() === "light" && <CommandShortcut>Active</CommandShortcut>}
            </CommandItem>
            <CommandItem onSelect={() => { themeCtx.setTheme("dark"); paletteActions.close() }}>
              <IconMoon class="mr-2 size-4 shrink-0" />
              Dark
              {themeCtx.theme() === "dark" && <CommandShortcut>Active</CommandShortcut>}
            </CommandItem>
            <CommandItem onSelect={() => { themeCtx.setTheme("magic-blue"); paletteActions.close() }}>
              <IconSparkle class="mr-2 size-4 shrink-0" />
              Magic Blue
              {themeCtx.theme() === "magic-blue" && <CommandShortcut>Active</CommandShortcut>}
            </CommandItem>
            <CommandItem onSelect={() => { themeCtx.setTheme("system"); paletteActions.close() }}>
              <IconMonitor class="mr-2 size-4 shrink-0" />
              System
              {themeCtx.theme() === "system" && <CommandShortcut>Active</CommandShortcut>}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <NewIssueModal
        open={newIssueOpen()}
        onClose={newIssueActions.close}
        workspaceSlug={props.workspaceSlug}
      />
    </>
  )
}
