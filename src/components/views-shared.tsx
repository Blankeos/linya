/**
 * Shared components for Custom Views pages.
 * Used by both workspace-level (/@workspace/views/issues) and
 * team-level (/@workspace/team/@teamIdentifier/views/issues) routes.
 */

import { For, Show } from "solid-js"
import { navigate } from "vike/client/router"
import { usePowerSyncQuery } from "@/lib/powersync"
import { IconIllusLayers } from "@/assets/icons"
import { PillTabs } from "@/components/pill-tabs"
import { PopoverComp } from "@/components/ui/popover"
import { cn } from "@/utils/cn"

// ─── Types ──────────────────────────────────────────────────────────────

export type ViewRow = {
  id: string
  name: string
  description: string | null
  icon: string | null
  type: string
  filters: string
  display_options: string
  sort_order: number
  is_shared: number
  creator_id: string
  team_id: string | null
  created_at: string
  updated_at: string
}

type TeamRow = {
  id: string
  name: string
  identifier: string
  color: string | null
}

export type SaveTarget =
  | { kind: "personal" }
  | { kind: "workspace" }
  | { kind: "team"; teamId: string; teamName: string }

// ─── ViewsList — reusable views listing ─────────────────────────────────

export function ViewsList(props: {
  workspaceSlug: string
  /** If set, only show views for this team. Otherwise show workspace-level views. */
  teamId?: string | null
  teamIdentifier?: string
  /** Tab currently active ('issues' or 'projects') */
  tab?: "issues" | "projects"
}) {
  const tab = () => props.tab ?? "issues"

  // Query views scoped to workspace or team
  const [views] = usePowerSyncQuery<ViewRow>(
    () => {
      if (props.teamId) {
        return `
          SELECT cv.* FROM custom_view cv
          WHERE cv.team_id = ? AND cv.type = 'issue'
          ORDER BY cv.sort_order ASC
        `
      }
      return `
        SELECT cv.* FROM custom_view cv
        JOIN workspace w ON cv.workspace_id = w.id
        WHERE w.slug = ? AND cv.team_id IS NULL AND cv.type = 'issue'
        ORDER BY cv.sort_order ASC
      `
    },
    () => (props.teamId ? [props.teamId] : [props.workspaceSlug])
  )

  const newViewHref = () => {
    if (props.teamIdentifier) {
      return `/${props.workspaceSlug}/team/${props.teamIdentifier}/views/issues/new`
    }
    return `/${props.workspaceSlug}/views/new/issues`
  }

  const tabsBase = () => {
    if (props.teamIdentifier) {
      return `/${props.workspaceSlug}/team/${props.teamIdentifier}/views`
    }
    return `/${props.workspaceSlug}/views`
  }

  return (
    <div class="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <h1 class="text-[14px] font-semibold text-foreground tracking-[-0.01em]">Views</h1>
        <div class="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(newViewHref())}
            class="flex items-center justify-center w-7 h-7 rounded hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
          >
            <PlusIcon class="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <PillTabs
        tabs={[
          { label: "Issues", href: `${tabsBase()}/issues` },
          { label: "Projects", href: `${tabsBase()}/projects` },
        ]}
        active={tab()}
      />

      {/* Content */}
      <div class="flex-1 overflow-y-auto flex flex-col">
        <Show
          when={views().length > 0}
          fallback={
            <div class="flex-1 flex items-center justify-center">
              <div class="flex flex-col gap-5 px-12 py-8 max-w-lg text-left">
                <div class="w-20 h-20"><IconIllusLayers /></div>
                <div class="flex flex-col gap-3">
                  <h2 class="text-[16px] font-semibold text-foreground">Views</h2>
                  <p class="text-[13px] text-muted-foreground leading-relaxed">
                    Create custom views using filters to show only the issues you want to see. You can
                    save, share, and favorite these views for easy access and faster team collaboration.
                  </p>
                </div>
                <div>
                  <button
                    onClick={() => navigate(newViewHref())}
                    class="rounded-full bg-primary px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary/90"
                  >
                    Create new view
                  </button>
                </div>
              </div>
            </div>
          }
        >
          <div class="w-full">
            <div class="space-y-1 p-4">
              <For each={views()}>
                {(view) => (
                  <div
                    onClick={() => navigate(`/${props.workspaceSlug}/view/${view.id}`)}
                    class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 transition-colors cursor-pointer text-left group"
                  >
                    <div class="flex size-7 shrink-0 items-center justify-center rounded bg-muted/40 text-muted-foreground">
                      <LayersIcon class="size-3.5" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[13px] font-medium text-foreground truncate">{view.name}</div>
                      <Show when={view.description}>
                        <div class="text-[12px] text-muted-foreground truncate">{view.description}</div>
                      </Show>
                    </div>
                    <Show when={!view.is_shared}>
                      <LockIcon class="size-3 text-muted-foreground/40 shrink-0" />
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}

// ─── SaveToDropdown — "Save to" picker ──────────────────────────────────

export function SaveToDropdown(props: {
  value: SaveTarget
  onChange: (target: SaveTarget) => void
  workspaceSlug: string
  /** Pre-select this team when available */
  defaultTeamId?: string | null
}) {
  const [teams] = usePowerSyncQuery<TeamRow>(
    () => `
      SELECT t.id, t.name, t.identifier, t.color
      FROM team t
      JOIN workspace w ON t.workspace_id = w.id
      WHERE w.slug = ?
      ORDER BY t.name ASC
    `,
    () => [props.workspaceSlug]
  )

  const label = () => {
    const v = props.value
    switch (v.kind) {
      case "personal":
        return "Personal"
      case "workspace":
        return "Workspace"
      case "team":
        return v.teamName
    }
  }

  const icon = () => {
    const v = props.value
    if (v.kind === "personal") return <LockIcon class="size-3 text-muted-foreground" />
    if (v.kind === "workspace") return <GlobeIcon class="size-3 text-muted-foreground" />
    if (v.kind === "team") {
      const team = teams().find((t) => t.id === v.teamId)
      return (
        <div
          class="flex size-3.5 shrink-0 items-center justify-center rounded text-[7px] font-bold text-white"
          style={{ "background-color": team?.color ?? "#6b7280" }}
        >
          {v.teamName[0]?.toUpperCase()}
        </div>
      )
    }
    return null
  }

  return (
    <PopoverComp
      placement="bottom-start"
      contentProps={{ class: "p-0 w-[200px] border-border/60 bg-popover shadow-xl" }}
      triggerProps={{
        class:
          "flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1 text-[13px] font-medium text-foreground transition-colors hover:bg-white/5",
      }}
      content={
        <div class="py-1">
          {/* Personal */}
          <button
            type="button"
            onClick={() => props.onChange({ kind: "personal" })}
            class={cn(
              "flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors hover:bg-white/[0.06]",
              props.value.kind === "personal" && "text-primary"
            )}
          >
            <LockIcon class="size-3.5 text-muted-foreground/70 shrink-0" />
            <span class="flex-1 text-left">Personal</span>
            <Show when={props.value.kind === "personal"}>
              <CheckIcon class="size-3 shrink-0" />
            </Show>
          </button>

          {/* Workspace */}
          <button
            type="button"
            onClick={() => props.onChange({ kind: "workspace" })}
            class={cn(
              "flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors hover:bg-white/[0.06]",
              props.value.kind === "workspace" && "text-primary"
            )}
          >
            <GlobeIcon class="size-3.5 text-muted-foreground/70 shrink-0" />
            <span class="flex-1 text-left">Workspace</span>
            <Show when={props.value.kind === "workspace"}>
              <CheckIcon class="size-3 shrink-0" />
            </Show>
          </button>

          {/* Separator */}
          <Show when={teams().length > 0}>
            <div class="my-1 h-px bg-border/30" />
          </Show>

          {/* Teams */}
          <For each={teams()}>
            {(team) => (
              <button
                type="button"
                onClick={() =>
                  props.onChange({ kind: "team", teamId: team.id, teamName: team.name })
                }
                class={cn(
                  "flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors hover:bg-white/[0.06]",
                  props.value.kind === "team" &&
                    (props.value as { teamId: string }).teamId === team.id &&
                    "text-primary"
                )}
              >
                <div
                  class="flex size-3.5 shrink-0 items-center justify-center rounded text-[7px] font-bold text-white"
                  style={{ "background-color": team.color ?? "#6b7280" }}
                >
                  {team.name[0]?.toUpperCase()}
                </div>
                <span class="flex-1 text-left truncate">{team.name}</span>
                <Show
                  when={
                    props.value.kind === "team" &&
                    (props.value as { teamId: string }).teamId === team.id
                  }
                >
                  <CheckIcon class="size-3 shrink-0" />
                </Show>
              </button>
            )}
          </For>
        </div>
      }
    >
      {icon()}
      {label()}
      <ChevronDownIcon class="size-3 text-muted-foreground/60" />
    </PopoverComp>
  )
}

// ─── Icons ──────────────────────────────────────────────────────────────

function PlusIcon(props: { class?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={props.class}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function LayersIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function LockIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function GlobeIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function CheckIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ChevronDownIcon(props: { class?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      class={props.class}
    >
      <path d="M4 6 L8 10 L12 6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}
