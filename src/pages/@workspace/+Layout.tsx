import { createSignal, For, Show, type FlowProps } from "solid-js"
import { usePageContext } from "vike-solid/usePageContext"
import { navigate } from "vike/client/router"
import { useAuthContext } from "@/context/auth.context"
import { useDisclosure, useMounted } from "bagon-hooks"
import { CommandMenu } from "@/components/command-menu"
import { NewIssueModal } from "@/components/new-issue-modal"
import { NewProjectModal } from "@/components/new-project-modal"
import { newProjectOpen, setNewProjectOpen } from "@/stores/workspace-ui"
import { DropdownMenuComp } from "@/components/ui/dropdown-menu"
import { usePowerSyncQuery } from "@/lib/powersync"
import { ConnectionStatusBadge, useConnectionStatus } from "@/components/connection-status-badge"
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
  IconCircleDot,
  IconBox,
  IconLayers,
  IconSettings,
  IconLink,
  IconArchive,
  IconBell,
  IconSlack,
  IconEllipsis,
  IconPlus,
  IconStarFill,
} from "@/assets/icons"

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48) || "untitled"
  )
}

// Team Accordion Item Component
type Team = {
  id: string
  name: string
  identifier: string
  color: string | null
}

function TeamAccordionItem(props: {
  team: Team
  workspaceSlug: string
  isActive: (path: string) => boolean
}) {
  const [isExpanded, setIsExpanded] = createSignal(true)

  const teamBasePath = () => `/${props.workspaceSlug}/team/${props.team.identifier}`

  const subItemClass = (path: string) =>
    `flex items-center gap-2 px-2 py-1 text-[13px] rounded cursor-pointer transition-colors w-full select-none ml-6 ${
      props.isActive(path)
        ? "bg-white/[0.08] text-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
    }`

  return (
    <div class="group">
      {/* Team Header with context menu */}
      <div class="flex items-center">
        <button
          type="button"
          class="flex-1 flex items-center gap-2 px-2 py-1 text-[13px] rounded cursor-pointer transition-colors select-none text-muted-foreground hover:text-foreground"
          onClick={() => setIsExpanded((v) => !v)}
        >
          <IconChevronRight
            class="size-3 transition-transform shrink-0"
            style={{ transform: isExpanded() ? "rotate(90deg)" : "rotate(0deg)" }}
          />
          <div
            class="size-4 rounded flex items-center justify-center shrink-0 text-[9px] font-bold text-white"
            style={{ "background-color": props.team.color ?? "#6b7280" }}
          >
            {props.team.name[0]?.toUpperCase()}
          </div>
          <span class="flex-1 truncate text-left">{props.team.name}</span>
        </button>

        {/* Context menu button - visible on hover */}
        <DropdownMenuComp
          options={[
            {
              type: "item",
              itemDisplay: (
                <span class="flex items-center gap-2">
                  <IconSettings class="size-4 text-muted-foreground" />
                  Team settings
                </span>
              ),
              itemOnSelect: () =>
                navigate(`/${props.workspaceSlug}/team/${props.team.identifier}/settings`),
            },
            {
              type: "item",
              itemDisplay: (
                <span class="flex items-center gap-2">
                  <IconLink class="size-4 text-muted-foreground" />
                  Copy link
                </span>
              ),
              itemOnSelect: () => {
                navigator.clipboard.writeText(
                  `https://linear.app/${props.workspaceSlug}/team/${props.team.identifier}`
                )
              },
            },
            {
              type: "item",
              itemDisplay: (
                <span class="flex items-center gap-2">
                  <IconArchive class="size-4 text-muted-foreground" />
                  Open archive
                </span>
              ),
              itemOnSelect: () => navigate(`${teamBasePath()}/backlog`),
            },
            { type: "separator" },
            {
              type: "sub",
              subTrigger: (
                <span class="flex items-center gap-2">
                  <IconBell class="size-4 text-muted-foreground" />
                  Subscribe
                </span>
              ),
              subOptions: [
                {
                  type: "item",
                  itemDisplay: "All activity",
                  itemOnSelect: () => {},
                },
                {
                  type: "item",
                  itemDisplay: "Only issues I'm involved in",
                  itemOnSelect: () => {},
                },
                {
                  type: "item",
                  itemDisplay: "Unsubscribe",
                  itemOnSelect: () => {},
                },
              ],
            },
            {
              type: "item",
              itemDisplay: (
                <span class="flex items-center gap-2">
                  <IconSlack class="size-4 text-muted-foreground" />
                  Configure Slack notifications...
                </span>
              ),
              itemOnSelect: () => {},
            },
            { type: "separator" },
            {
              type: "item",
              itemDisplay: (
                <span class="flex items-center gap-2 text-destructive">Leave team...</span>
              ),
              itemOnSelect: () => {},
            },
          ]}
          triggerProps={{
            class:
              "p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-opacity cursor-pointer",
          }}
        >
          <IconEllipsis class="size-3.5 text-muted-foreground" />
        </DropdownMenuComp>
      </div>

      {/* Sub-items - Issues, Projects, Views */}
      <Show when={isExpanded()}>
        <div class="mt-0.5 space-y-0.5">
          <a href={`${teamBasePath()}/issues`} class={subItemClass(`${teamBasePath()}/issues`)}>
            <IconCircleDot class="size-3.5 shrink-0" />
            Issues
          </a>
          <a
            href={`${teamBasePath()}/projects/all`}
            class={subItemClass(`${teamBasePath()}/projects`)}
          >
            <IconBox class="size-3.5 shrink-0" />
            Projects
          </a>
          <a
            href={`${teamBasePath()}/views/issues`}
            class={subItemClass(`${teamBasePath()}/views`)}
          >
            <IconLayers class="size-3.5 shrink-0" />
            Views
          </a>
        </div>
      </Show>
    </div>
  )
}

export default function WorkspaceLayout(props: FlowProps) {
  const auth = useAuthContext()
  const pageCtx = usePageContext()
  const workspaceSlug = () => (pageCtx.routeParams as Record<string, string>).workspace ?? ""
  const connectionStatus = useConnectionStatus()
  const mounted = useMounted()
  // Gate sync-status driven UI behind a mount check so SSR always renders the
  // "online" branch and we don't get a hydration mismatch when the client
  // initializes PowerSync with a different syncStatus.
  const effectiveStatus = () => (mounted() ? connectionStatus() : null)

  const [newIssueOpen, newIssueActions] = useDisclosure()
  const [workspaceExpanded, setWorkspaceExpanded] = createSignal(true)
  const [favoritesExpanded, setFavoritesExpanded] = createSignal(true)
  const [teamsExpanded, setTeamsExpanded] = createSignal(true)

  const [sidebarTeams] = usePowerSyncQuery<{
    id: string
    name: string
    identifier: string
    color: string | null
  }>(
    () => `
      SELECT t.id, t.name, t.identifier, t.color
      FROM team t
      JOIN workspace w ON t.workspace_id = w.id
      WHERE w.slug = ?
      ORDER BY t.name ASC
    `,
    () => [workspaceSlug()]
  )

  const [favoriteIssues] = usePowerSyncQuery<{
    id: string
    number: number
    title: string
    team_identifier: string
    sort_order: number
  }>(
    () => `
      SELECT i.id, i.number, i.title, t.identifier as team_identifier, f.sort_order as sort_order
      FROM favorite f
      JOIN issue i ON f.target_id = i.id
      JOIN team t ON i.team_id = t.id
      JOIN workspace w ON f.workspace_id = w.id
      WHERE f.user_id = ? AND f.target_type = 'issue' AND w.slug = ?
      ORDER BY f.sort_order ASC, f.created_at ASC
    `,
    () => [auth.user()?.id ?? "", workspaceSlug()]
  )

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

  const isWelcomePage = () => pageCtx.urlPathname.endsWith("/welcome")

  return (
    <Show
      when={isWelcomePage()}
      fallback={
        <div class="flex h-screen bg-sidebar text-foreground overflow-hidden">
          {/* Sidebar */}
          <aside
            class="flex flex-col shrink-0 bg-sidebar overflow-y-auto no-scrollbar"
            style={{ width: "220px" }}
          >
            {/* Workspace header */}
            <div class="flex items-center gap-2 px-3 py-3 shrink-0">
              {/* Org avatar — always visible */}
              <div class="size-6 rounded bg-primary flex items-center justify-center shrink-0">
                <span class="text-[10px] font-bold text-white">
                  {workspaceSlug()[0]?.toUpperCase() ?? "W"}
                </span>
              </div>

              {/* When online: show org name + dropdown. When offline: show badge instead */}
              <Show
                when={effectiveStatus()}
                fallback={
                  <DropdownMenuComp
                    options={[
                      {
                        type: "item",
                        itemDisplay: "Settings",
                        itemOnSelect: () => navigate(`/${workspaceSlug()}/settings`),
                        itemTip: <span>G then S</span>,
                      },
                      {
                        type: "item",
                        itemDisplay: "Download desktop app",
                        itemOnSelect: () => {},
                      },
                      {
                        type: "sub",
                        subTrigger: "Switch workspace",
                        subOptions: [
                          {
                            type: "item",
                            itemDisplay: (
                              <span class="text-xs text-muted-foreground/50">
                                {auth.user()?.email}
                              </span>
                            ),
                            itemOnSelect: () => {},
                          },
                          {
                            type: "item",
                            itemDisplay: (
                              <div class="flex items-center gap-2">
                                <div class="size-5 rounded bg-primary flex items-center justify-center shrink-0">
                                  <span class="text-[9px] font-bold text-white">
                                    {workspaceSlug()[0]?.toUpperCase() ?? "W"}
                                  </span>
                                </div>
                                <span class="capitalize font-medium">{workspaceSlug()}</span>
                              </div>
                            ),
                            itemOnSelect: () => {},
                            itemTip: (
                              <span class="flex items-center gap-1">
                                <span>✓</span> <span>1</span>
                              </span>
                            ),
                          },
                          { type: "separator" },
                          {
                            type: "item",
                            itemDisplay: (
                              <span class="text-xs text-muted-foreground/70">Account</span>
                            ),
                            itemOnSelect: () => {},
                          },
                          {
                            type: "item",
                            itemDisplay: (
                              <span class="text-xs text-muted-foreground/70">
                                Create or join a workspace...
                              </span>
                            ),
                            itemOnSelect: () => {},
                          },
                          {
                            type: "item",
                            itemDisplay: (
                              <span class="text-xs text-muted-foreground/70">
                                Add an account...
                              </span>
                            ),
                            itemOnSelect: () => {},
                          },
                        ],
                      },
                      {
                        type: "item",
                        itemDisplay: "Log out",
                        itemOnSelect: async () => {
                          await auth.logout()
                          navigate("/")
                        },
                        itemTip: <span>⌘ ⇧ Q</span>,
                      },
                    ]}
                    triggerProps={{
                      class:
                        "flex items-center gap-1 py-1 rounded hover:bg-white/5 transition-colors cursor-pointer",
                    }}
                  >
                    <span class="text-[13px] font-semibold text-foreground capitalize">
                      {workspaceSlug()}
                    </span>
                    <IconChevronDown class="size-3.5 text-muted-foreground shrink-0" />
                  </DropdownMenuComp>
                }
              >
                {(status) => <ConnectionStatusBadge status={status()} />}
              </Show>

              <div class="flex-1" />
              <IconSearch class="size-3.5 text-muted-foreground shrink-0 cursor-pointer hover:text-foreground" />
              <button type="button" onClick={() => newIssueActions.open()}>
                <IconCompose class="size-3.5 text-muted-foreground shrink-0 cursor-pointer hover:text-foreground" />
              </button>
            </div>

            {/* Nav */}
            <nav class="flex-1 px-2 py-1 space-y-0.5">
              {/* Primary nav */}
              <a
                href={`/${workspaceSlug()}/pulse/following`}
                class={navItemClass(`/${workspaceSlug()}/pulse`)}
              >
                <IconPulse class="size-3.5 shrink-0" />
                Pulse
              </a>
              <a
                href={`/${workspaceSlug()}/inbox`}
                class={navItemClass(`/${workspaceSlug()}/inbox`)}
              >
                <IconInbox class="size-3.5 shrink-0" />
                Inbox
              </a>
              <a
                href={`/${workspaceSlug()}/my-issues`}
                class={navItemClass(`/${workspaceSlug()}/my-issues`)}
              >
                <IconMyIssues class="size-3.5 shrink-0" />
                My Issues
              </a>
              <a
                href={`/${workspaceSlug()}/drafts`}
                class={navItemClass(`/${workspaceSlug()}/drafts`)}
              >
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
                    <a
                      href={`/${workspaceSlug()}/initiatives`}
                      class={navItemClass(`/${workspaceSlug()}/initiatives`)}
                    >
                      <IconInitiatives class="size-3.5 shrink-0" />
                      Initiatives
                    </a>
                    <a
                      href={`/${workspaceSlug()}/projects/all`}
                      class={navItemClass(`/${workspaceSlug()}/projects`)}
                    >
                      <IconProjects class="size-3.5 shrink-0" />
                      Projects
                    </a>
                    <a
                      href={`/${workspaceSlug()}/views/issues`}
                      class={navItemClass(`/${workspaceSlug()}/views`)}
                    >
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
                  <div class="mt-0.5 space-y-0.5">
                    <Show
                      when={favoriteIssues().length > 0}
                      fallback={
                        <div class="px-2 py-1.5 text-[12px] text-muted-foreground/50 italic">
                          Star issues and projects to add them here
                        </div>
                      }
                    >
                      <For each={favoriteIssues()}>
                        {(fav) => {
                          const path = () =>
                            `/${workspaceSlug()}/issue/${fav.team_identifier}-${fav.number}/${slugify(fav.title)}`
                          return (
                            <a
                              href={path()}
                              class={`flex items-center gap-2 px-2 py-1 text-[13px] rounded cursor-pointer transition-colors w-full select-none ${
                                isActive(path())
                                  ? "bg-white/[0.08] text-foreground"
                                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                              }`}
                            >
                              <IconStarFill class="size-3.5 shrink-0 text-yellow-500" />
                              <span class="truncate">{fav.title}</span>
                            </a>
                          )
                        }}
                      </For>
                    </Show>
                  </div>
                </Show>
              </div>

              {/* Your teams section */}
              <div class="pt-4">
                <div class="flex items-center justify-between">
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
                  <button
                    type="button"
                    class="p-1 rounded opacity-0 hover:opacity-100 hover:bg-white/10 transition-opacity cursor-pointer mr-1"
                    aria-label="Add team"
                  >
                    <IconPlus class="size-3.5 text-muted-foreground" />
                  </button>
                </div>
                <Show when={teamsExpanded()}>
                  <div class="mt-0.5 space-y-0.5">
                    <Show
                      when={sidebarTeams().length > 0}
                      fallback={
                        <div class="px-2 py-1.5 text-[12px] text-muted-foreground/50 italic">
                          No teams yet
                        </div>
                      }
                    >
                      <For each={sidebarTeams()}>
                        {(team) => (
                          <TeamAccordionItem
                            team={team}
                            workspaceSlug={workspaceSlug()}
                            isActive={isActive}
                          />
                        )}
                      </For>
                    </Show>
                  </div>
                </Show>
              </div>
            </nav>

            {/* Bottom user section */}
            <div class="shrink-0 border-t border-border/30 px-2 py-2">
              <a
                href={`/${workspaceSlug()}/settings`}
                class={navItemClass(`/${workspaceSlug()}/settings`)}
              >
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
          <main class="flex-1 flex flex-col overflow-hidden bg-sidebar pr-2 py-2">
            <div class="flex-1 flex flex-col overflow-hidden rounded-lg border border-border/50 bg-background">
              {props.children}
            </div>
          </main>

          <CommandMenu workspaceSlug={workspaceSlug()} />
          <NewIssueModal
            open={newIssueOpen()}
            onClose={newIssueActions.close}
            workspaceSlug={workspaceSlug()}
          />
          <NewProjectModal
            open={newProjectOpen()}
            onClose={() => setNewProjectOpen(false)}
            workspaceSlug={workspaceSlug()}
          />
        </div>
      }
    >
      <div class="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-12 overflow-hidden">
        {props.children}
      </div>
    </Show>
  )
}
