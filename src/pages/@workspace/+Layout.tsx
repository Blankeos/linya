import { createSignal, For, Show, type FlowProps } from "solid-js"
import { usePageContext } from "vike-solid/usePageContext"
import { navigate } from "vike/client/router"
import { useAuthContext } from "@/context/auth.context"
import { useDisclosure } from "bagon-hooks"
import { CommandMenu } from "@/components/command-menu"
import { NewIssueModal } from "@/components/new-issue-modal"
import { DropdownMenuComp } from "@/components/ui/dropdown-menu"
import {
  IconPulse,
  IconInbox,
  IconMyIssues,
  IconDrafts,
  IconInitiatives,
  IconProjects,
  IconViews,
  IconMore,
  IconTeams,
  IconCustomers,
  IconMembers,
  IconGear,
  IconSearch,
  IconCompose,
  IconChevronDown,
  IconChevronRight,
  IconCustomizeSidebar,
} from "@/assets/icons"

export default function WorkspaceLayout(props: FlowProps) {
  const auth = useAuthContext()
  const pageCtx = usePageContext()
  const workspaceSlug = () => (pageCtx.routeParams as Record<string, string>).workspace ?? ""

  const [newIssueOpen, newIssueActions] = useDisclosure()
  const [workspaceExpanded, setWorkspaceExpanded] = createSignal(true)
  const [favoritesExpanded, setFavoritesExpanded] = createSignal(true)
  const [teamsExpanded, setTeamsExpanded] = createSignal(true)

  const isActive = (path: string) => {
    const urlPath = pageCtx.urlPathname
    return urlPath === path || urlPath.startsWith(path + "/")
  }

  const navItemClass = (path: string) =>
    `flex items-center gap-2 px-2 py-1 text-[13px] rounded cursor-pointer transition-colors w-full select-none ${
      isActive(path)
        ? "bg-white/[0.08] text-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
    }`

  const sectionHeaderClass =
    "flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground cursor-pointer select-none w-full"

  return (
    <div class="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside
        class="flex flex-col shrink-0 border-r border-border/50 bg-sidebar overflow-y-auto no-scrollbar"
        style={{ width: "220px" }}
      >
        {/* Workspace header */}
        <div class="flex items-center gap-2 px-3 py-3 shrink-0">
          <div class="size-6 rounded bg-primary flex items-center justify-center shrink-0">
            <span class="text-[10px] font-bold text-white">
              {workspaceSlug()[0]?.toUpperCase() ?? "W"}
            </span>
          </div>
          <span class="text-[13px] font-semibold text-foreground truncate flex-1 capitalize">
            {workspaceSlug()}
          </span>
          <IconChevronDown class="size-3.5 text-muted-foreground shrink-0" />
          <IconSearch class="size-3.5 text-muted-foreground shrink-0 cursor-pointer hover:text-foreground" />
          <button type="button" onClick={() => newIssueActions.open()}>
            <IconCompose class="size-3.5 text-muted-foreground shrink-0 cursor-pointer hover:text-foreground" />
          </button>
        </div>

        {/* Nav */}
        <nav class="flex-1 px-2 py-1 space-y-0.5">
          {/* Primary nav */}
          <a href={`/${workspaceSlug()}/pulse/following`} class={navItemClass(`/${workspaceSlug()}/pulse`)}>
            <IconPulse class="size-3.5 shrink-0" />
            Pulse
          </a>
          <a href={`/${workspaceSlug()}/inbox`} class={navItemClass(`/${workspaceSlug()}/inbox`)}>
            <IconInbox class="size-3.5 shrink-0" />
            Inbox
          </a>
          <a href={`/${workspaceSlug()}/my-issues`} class={navItemClass(`/${workspaceSlug()}/my-issues`)}>
            <IconMyIssues class="size-3.5 shrink-0" />
            My Issues
          </a>
          <a href={`/${workspaceSlug()}/drafts`} class={navItemClass(`/${workspaceSlug()}/drafts`)}>
            <IconDrafts class="size-3.5 shrink-0" />
            Drafts
          </a>

          {/* Workspace section */}
          <div class="pt-4">
            <button
              type="button"
              class={sectionHeaderClass}
              onClick={() => setWorkspaceExpanded((v) => !v)}
            >
              <IconChevronRight
                class="size-3 transition-transform"
                style={{ transform: workspaceExpanded() ? "rotate(90deg)" : "rotate(0deg)" }}
              />
              Workspace
            </button>
            <Show when={workspaceExpanded()}>
              <div class="mt-0.5 space-y-0.5">
                <a href={`/${workspaceSlug()}/initiatives`} class={navItemClass(`/${workspaceSlug()}/initiatives`)}>
                  <IconInitiatives class="size-3.5 shrink-0" />
                  Initiatives
                </a>
                <a href={`/${workspaceSlug()}/projects/all`} class={navItemClass(`/${workspaceSlug()}/projects`)}>
                  <IconProjects class="size-3.5 shrink-0" />
                  Projects
                </a>
                <a href={`/${workspaceSlug()}/views/issues`} class={navItemClass(`/${workspaceSlug()}/views`)}>
                  <IconViews class="size-3.5 shrink-0" />
                  Views
                </a>
                <DropdownMenuComp
                  options={[
                    {
                      type: "item",
                      itemDisplay: (
                        <span class="flex items-center gap-2">
                          <IconTeams class="size-3.5 shrink-0" />
                          Teams
                        </span>
                      ),
                      itemOnSelect: () => navigate(`/${workspaceSlug()}/teams`),
                    },
                    {
                      type: "item",
                      itemDisplay: (
                        <span class="flex items-center gap-2">
                          <IconCustomers class="size-3.5 shrink-0" />
                          Customers
                        </span>
                      ),
                      itemOnSelect: () => navigate(`/${workspaceSlug()}/customers`),
                    },
                    {
                      type: "item",
                      itemDisplay: (
                        <span class="flex items-center gap-2">
                          <IconMembers class="size-3.5 shrink-0" />
                          Members
                        </span>
                      ),
                      itemOnSelect: () => navigate(`/${workspaceSlug()}/members`),
                    },
                    { type: "separator" },
                    {
                      type: "item",
                      itemDisplay: (
                        <span class="flex items-center gap-2">
                          <IconCustomizeSidebar class="size-3.5 shrink-0" />
                          Customize sidebar
                        </span>
                      ),
                      itemOnSelect: () => {},
                    },
                  ]}
                  triggerProps={{
                    class:
                      "flex items-center gap-2 px-2 py-1 text-[13px] rounded text-muted-foreground hover:text-foreground hover:bg-white/5 cursor-pointer transition-colors w-full select-none",
                  }}
                >
                  <IconMore class="size-3.5 shrink-0" />
                  More
                </DropdownMenuComp>
              </div>
            </Show>
          </div>

          {/* Favorites section */}
          <div class="pt-4">
            <button
              type="button"
              class={sectionHeaderClass}
              onClick={() => setFavoritesExpanded((v) => !v)}
            >
              <IconChevronRight
                class="size-3 transition-transform"
                style={{ transform: favoritesExpanded() ? "rotate(90deg)" : "rotate(0deg)" }}
              />
              Favorites
            </button>
            <Show when={favoritesExpanded()}>
              <div class="mt-0.5">
                <div class="px-2 py-1.5 text-[12px] text-muted-foreground/50 italic">
                  Star issues and projects to add them here
                </div>
              </div>
            </Show>
          </div>

          {/* Your teams section */}
          <div class="pt-4">
            <button
              type="button"
              class={sectionHeaderClass}
              onClick={() => setTeamsExpanded((v) => !v)}
            >
              <IconChevronRight
                class="size-3 transition-transform"
                style={{ transform: teamsExpanded() ? "rotate(90deg)" : "rotate(0deg)" }}
              />
              Your teams
            </button>
            <Show when={teamsExpanded()}>
              <div class="mt-0.5 space-y-0.5">
                <div class="px-2 py-1.5 text-[12px] text-muted-foreground/50 italic">
                  No teams yet
                </div>
              </div>
            </Show>
          </div>
        </nav>

        {/* Bottom user section */}
        <div class="shrink-0 border-t border-border/30 px-2 py-2">
          <a href={`/${workspaceSlug()}/settings`} class={navItemClass(`/${workspaceSlug()}/settings`)}>
            <IconGear class="size-3.5 shrink-0" />
            Settings
          </a>
          <div class="flex items-center gap-2 px-2 py-1.5 mt-0.5">
            <div class="size-5 rounded-full bg-primary/30 flex items-center justify-center shrink-0">
              <span class="text-[10px] font-medium text-primary">
                {auth.user()?.email?.[0]?.toUpperCase() ?? "U"}
              </span>
            </div>
            <span class="text-[12px] text-muted-foreground truncate">
              {auth.user()?.email ?? "User"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main class="flex-1 flex flex-col overflow-hidden">
        {props.children}
      </main>

      <CommandMenu workspaceSlug={workspaceSlug()} />
      <NewIssueModal
        open={newIssueOpen()}
        onClose={newIssueActions.close}
        workspaceSlug={workspaceSlug()}
      />
    </div>
  )
}
