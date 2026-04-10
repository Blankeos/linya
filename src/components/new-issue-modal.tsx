import { createEffect, createSignal, type JSX, Show } from "solid-js"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Combobox2Command, type ComboboxItem } from "@/components/ui/combobox-2"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { honoClient } from "@/lib/hono-client"
import {
  IconPerson,
  IconProjects,
  IconTag,
  IconMaximize,
  IconMinimize,
  IconMore,
  IconCalendar,
  IconRepeat,
  IconLink,
  IconCustomers,
  IconSubIssue,
} from "@/assets/icons"
import { cn } from "@/utils/cn"

const PRIORITIES: ComboboxItem[] = [
  { value: "0", label: <span class="flex items-center gap-2"><PriorityIcon value={0} class="size-3.5 shrink-0" /> No priority</span> },
  { value: "1", label: <span class="flex items-center gap-2"><PriorityIcon value={1} class="size-3.5 shrink-0" /> Urgent</span> },
  { value: "2", label: <span class="flex items-center gap-2"><PriorityIcon value={2} class="size-3.5 shrink-0" /> High</span> },
  { value: "3", label: <span class="flex items-center gap-2"><PriorityIcon value={3} class="size-3.5 shrink-0" /> Medium</span> },
  { value: "4", label: <span class="flex items-center gap-2"><PriorityIcon value={4} class="size-3.5 shrink-0" /> Low</span> },
]

const PRIORITY_LABELS = ["No priority", "Urgent", "High", "Medium", "Low"]

type Status = { id: string; name: string; color: string; category: string }
type Team = { id: string; name: string; identifier: string }

const DEFAULT_STATUSES: Status[] = [
  { id: "triage", name: "Triage", color: "#6b7280", category: "triage" },
  { id: "backlog", name: "Backlog", color: "#6b7280", category: "backlog" },
  { id: "todo", name: "Todo", color: "#9ca3af", category: "unstarted" },
  { id: "in_progress", name: "In Progress", color: "#f59e0b", category: "started" },
  { id: "in_review", name: "In Review", color: "#22c55e", category: "in_review" },
  { id: "done", name: "Done", color: "#10b981", category: "completed" },
  { id: "cancelled", name: "Cancelled", color: "#6b7280", category: "cancelled" },
  { id: "duplicate", name: "Duplicate", color: "#6b7280", category: "duplicate" },
]

export function NewIssueModal(props: {
  open: boolean
  onClose: () => void
  workspaceSlug: string
}) {
  const [title, setTitle] = createSignal("")
  const [description, setDescription] = createSignal("")
  const [teams, setTeams] = createSignal<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = createSignal<string | null>(null)
  const [statuses, setStatuses] = createSignal<Status[]>(DEFAULT_STATUSES)
  const [selectedStatusId, setSelectedStatusId] = createSignal<string | null>("backlog")
  const [priority, setPriority] = createSignal("0")
  const [assignee, setAssignee] = createSignal("")
  const [project, setProject] = createSignal("")
  const [selectedLabels, setSelectedLabels] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [workspaceId, setWorkspaceId] = createSignal<string | null>(null)
  const [dataLoaded, setDataLoaded] = createSignal(false)
  const [createMore, setCreateMore] = createSignal(false)
  const [fullscreen, setFullscreen] = createSignal(false)

  // Popover open states
  const [statusOpen, setStatusOpen] = createSignal(false)
  const [priorityOpen, setPriorityOpen] = createSignal(false)
  const [assigneeOpen, setAssigneeOpen] = createSignal(false)
  const [projectOpen, setProjectOpen] = createSignal(false)
  const [labelsOpen, setLabelsOpen] = createSignal(false)

  // Load workspace + teams when modal first opens
  createEffect(() => {
    if (!props.open || dataLoaded()) return
    loadWorkspaceAndTeams()
  })

  async function loadWorkspaceAndTeams() {
    try {
      const client = honoClient()
      const wsRes = await client.workspaces.$get()
      if (!wsRes.ok) return
      const wsData = await wsRes.json()
      const workspace = (wsData as any).workspaces?.find(
        (w: any) => w.slug === props.workspaceSlug
      )
      if (!workspace) return
      setWorkspaceId(workspace.id)

      const teamsRes = await (client.workspaces as any)[":workspaceId"].teams.$get({
        param: { workspaceId: workspace.id },
      })
      if (!teamsRes.ok) return
      const teamsData = await teamsRes.json()
      const teamList: Team[] = (teamsData as any).teams ?? []
      setTeams(teamList)
      if (teamList.length > 0) setSelectedTeamId(teamList[0].id)
      setDataLoaded(true)
    } catch {}
  }

  // Load statuses when selected team changes
  createEffect(() => {
    const teamId = selectedTeamId()
    const wsId = workspaceId()
    if (!teamId || !wsId) return
    loadStatuses(wsId, teamId)
  })

  async function loadStatuses(wsId: string, teamId: string) {
    try {
      const client = honoClient()
      const res = await (client.workspaces as any)[":workspaceId"].teams[":teamId"].statuses.$get({
        param: { workspaceId: wsId, teamId },
      })
      if (!res.ok) return
      const data = await res.json()
      const statusList: Status[] = (data as any).statuses ?? []
      setStatuses(statusList)
      const defaultStatus =
        statusList.find((s) => s.category === "unstarted") ?? statusList[0]
      if (defaultStatus) setSelectedStatusId(defaultStatus.id)
    } catch {}
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()
    const teamId = selectedTeamId()
    const statusId = selectedStatusId()
    if (!title().trim() || !teamId || !statusId) return
    setLoading(true)
    try {
      await honoClient().issues.$post({
        json: {
          teamId,
          title: title().trim(),
          description: description() || null,
          statusId,
          priority: parseInt(priority()),
        },
      })
      if (createMore()) {
        setTitle("")
        setDescription("")
        setPriority("0")
        setAssignee("")
        setProject("")
        setSelectedLabels("")
      } else {
        handleClose()
      }
    } catch {}
    setLoading(false)
  }

  function handleClose() {
    setTitle("")
    setDescription("")
    setPriority("0")
    setAssignee("")
    setProject("")
    setSelectedLabels("")
    setFullscreen(false)
    props.onClose()
  }

  const selectedStatus = () => statuses().find((s) => s.id === selectedStatusId())
  const selectedTeam = () => teams().find((t) => t.id === selectedTeamId())

  const statusItems = (): ComboboxItem[] =>
    statuses().map((s) => ({
      value: s.id,
      label: (
        <span class="flex items-center gap-2">
          <StatusDot category={s.category} color={s.color} />
          {s.name}
        </span>
      ),
    }))

  const assigneeItems = (): ComboboxItem[] => [
    {
      value: "",
      label: (
        <span class="flex items-center gap-2">
          <div class="size-5 rounded-full border border-border/50 flex items-center justify-center shrink-0">
            <IconPerson class="size-3 text-muted-foreground" />
          </div>
          No assignee
        </span>
      ),
    },
  ]

  const projectItems = (): ComboboxItem[] => [
    { value: "", label: "No project" },
  ]

  const labelItems = (): ComboboxItem[] => []

  return (
    <Dialog open={props.open} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent
        showClose={false}
        class="p-0 gap-0 overflow-hidden"
        style={{
          "max-width": fullscreen() ? "calc(100vw - 80px)" : "560px",
          width: fullscreen() ? "100%" : "560px",
          height: fullscreen() ? "calc(100vh - 40px)" : "360px",
          transition: "max-width 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1), height 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <form onSubmit={handleSubmit} class="flex flex-col h-full">
          {/* Header: Team + Fullscreen */}
          <div class="flex items-center justify-between px-4 pt-3 pb-1">
            <Show
              when={selectedTeam()}
              fallback={<div class="h-4 w-28 rounded bg-secondary/40 animate-pulse" />}
            >
              <div class="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <div class="size-4 rounded bg-primary/20 flex items-center justify-center shrink-0">
                  <span class="text-[8px] font-bold text-primary">
                    {selectedTeam()!.identifier?.[0] ?? "T"}
                  </span>
                </div>
                <span class="font-medium">{selectedTeam()!.identifier}</span>
              </div>
            </Show>
            <button
              type="button"
              class="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              title={fullscreen() ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => setFullscreen((f) => !f)}
            >
              {fullscreen() ? <IconMinimize class="size-3.5" /> : <IconMaximize class="size-3.5" />}
            </button>
          </div>

          {/* Title */}
          <div class="px-4 pb-1">
            <input
              autofocus
              type="text"
              placeholder="Issue title"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              class="w-full text-[15px] font-medium text-foreground placeholder:text-muted-foreground/40 bg-transparent outline-none"
            />
          </div>

          {/* Description */}
          <div class="px-4 pb-3 flex-1">
            <textarea
              placeholder="Add description..."
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              class="w-full h-full text-[13px] text-foreground/80 placeholder:text-muted-foreground/30 bg-transparent outline-none resize-none"
            />
          </div>

          {/* Toolbar */}
          <div class="flex items-center gap-1 px-3 py-2.5 border-t border-border/40">
            {/* Status */}
            <ToolbarCombobox
              open={statusOpen()}
              onOpenChange={setStatusOpen}
              items={statusItems()}
              value={selectedStatusId() ?? ""}
              onValueChange={(v) => setSelectedStatusId(v as string || null)}
              searchPlaceholder="Search status..."
              contentClass="w-48"
              disallowEmptySelection
            >
              <StatusDot category={selectedStatus()?.category} color={selectedStatus()?.color} />
              <span>{selectedStatus()?.name ?? "Status"}</span>
            </ToolbarCombobox>

            {/* Priority */}
            <ToolbarCombobox
              open={priorityOpen()}
              onOpenChange={setPriorityOpen}
              items={PRIORITIES}
              value={priority()}
              onValueChange={(v) => setPriority(v as string)}
              searchPlaceholder="Search priority..."
              contentClass="w-44"
            >
              <PriorityIcon value={parseInt(priority())} class="size-3.5 shrink-0" />
              <span>{PRIORITY_LABELS[parseInt(priority())]}</span>
            </ToolbarCombobox>

            {/* Assignee */}
            <ToolbarCombobox
              open={assigneeOpen()}
              onOpenChange={setAssigneeOpen}
              items={assigneeItems()}
              value={assignee()}
              onValueChange={(v) => setAssignee(v as string)}
              searchPlaceholder="Assign to..."
              contentClass="w-52"
            >
              <IconPerson class="size-3.5 shrink-0" />
              <span>{assignee() || "Assignee"}</span>
            </ToolbarCombobox>

            {/* Project */}
            <ToolbarCombobox
              open={projectOpen()}
              onOpenChange={setProjectOpen}
              items={projectItems()}
              value={project()}
              onValueChange={(v) => setProject(v as string)}
              searchPlaceholder="Search projects..."
              contentClass="w-48"
            >
              <IconProjects class="size-3.5 shrink-0" />
              <span>{project() || "Project"}</span>
            </ToolbarCombobox>

            {/* Labels */}
            <ToolbarCombobox
              open={labelsOpen()}
              onOpenChange={setLabelsOpen}
              items={labelItems()}
              value={selectedLabels()}
              onValueChange={(v) => setSelectedLabels(Array.isArray(v) ? v.join(",") : v as string)}
              searchPlaceholder="Search labels..."
              contentClass="w-48"
              multiple
            >
              <IconTag class="size-3.5 shrink-0" />
              <span>
                {selectedLabels()
                  ? `${selectedLabels().split(",").length} label${selectedLabels().split(",").length > 1 ? "s" : ""}`
                  : "Labels"}
              </span>
            </ToolbarCombobox>

            {/* More actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                class="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <IconMore class="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent class="w-56">
                <DropdownMenuItem class="gap-2">
                  <IconCalendar class="size-4 shrink-0 text-muted-foreground" />
                  Set due date
                  <DropdownMenuShortcut>&#8679; D</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem class="gap-2">
                  <IconRepeat class="size-4 shrink-0 text-muted-foreground" />
                  Make recurring...
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem class="gap-2">
                  <IconLink class="size-4 shrink-0 text-muted-foreground" />
                  Add link...
                  <DropdownMenuShortcut>&#8963; L</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem class="gap-2">
                  <IconCustomers class="size-4 shrink-0 text-muted-foreground" />
                  Add customer request...
                  <DropdownMenuShortcut>&#8963; R</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem class="gap-2">
                  <IconSubIssue class="size-4 shrink-0 text-muted-foreground" />
                  Add sub-issue
                  <DropdownMenuShortcut>&#8984; &#8679; O</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Bottom bar */}
          <div class="flex items-center gap-1.5 px-3 py-2.5 border-t border-border/40">
            <div class="flex-1" />

            {/* Create more toggle */}
            <label class="flex items-center gap-1.5 text-[12px] text-muted-foreground cursor-pointer select-none mr-2">
              <input
                type="checkbox"
                checked={createMore()}
                onChange={(e) => setCreateMore(e.currentTarget.checked)}
                class="size-3.5 rounded border-border accent-primary"
              />
              Create more
            </label>

            <button
              type="submit"
              disabled={loading() || !title().trim() || !selectedTeamId()}
              class="px-3 py-1.5 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading() ? "Creating..." : "Create issue"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// ToolbarCombobox — compact trigger wrapping Combobox2Command
// ===========================================================================

function ToolbarCombobox(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ComboboxItem[]
  value: string
  onValueChange: (value: string | string[]) => void
  searchPlaceholder?: string
  contentClass?: string
  children: JSX.Element
  disallowEmptySelection?: boolean
  multiple?: boolean
}) {
  return (
    <Popover open={props.open} onOpenChange={props.onOpenChange}>
      <PopoverTrigger
        class="flex items-center gap-1.5 px-2 py-1 rounded text-[12px] text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors border border-border/40"
      >
        {props.children}
      </PopoverTrigger>
      <PopoverContent
        class={cn("p-0", props.contentClass)}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === "Escape") {
            props.onOpenChange(false)
            e.stopPropagation()
          }
        }}
      >
        <Combobox2Command
          items={props.items}
          selectedValue={props.value}
          onSelectedValueChange={props.onValueChange}
          searchPlaceholder={props.searchPlaceholder}
          onClose={() => props.onOpenChange(false)}
          disallowEmptySelection={props.disallowEmptySelection}
          multiple={props.multiple}
        />
      </PopoverContent>
    </Popover>
  )
}

// ===========================================================================
// Sub-components
// ===========================================================================

function StatusDot(props: { category?: string; color?: string }) {
  const color = () => {
    if (props.color) return props.color
    switch (props.category) {
      case "triage": return "#6b7280"
      case "backlog": return "#6b7280"
      case "unstarted": return "#9ca3af"
      case "started": return "#f59e0b"
      case "in_review": return "#22c55e"
      case "completed": return "#10b981"
      case "cancelled": return "#6b7280"
      case "duplicate": return "#6b7280"
      default: return "#6b7280"
    }
  }

  const cat = () => props.category

  // Triage: diamond shape
  if (cat() === "triage") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" class="shrink-0">
        <rect x="6" y="1" width="7" height="7" rx="1" transform="rotate(45 6 1)" fill="none" stroke={color()} stroke-width="1.5" />
      </svg>
    )
  }

  // Cancelled / Duplicate: circle with X
  if (cat() === "cancelled" || cat() === "duplicate") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" class="shrink-0">
        <circle cx="6" cy="6" r="4.5" fill={color()} stroke="none" />
        <path d="M4 4l4 4M8 4l-4 4" stroke="white" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    )
  }

  // Completed (Done): filled circle with checkmark
  if (cat() === "completed") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" class="shrink-0">
        <circle cx="6" cy="6" r="4.5" fill={color()} stroke="none" />
        <path d="M3.5 6 L5.5 8 L8.5 4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </svg>
    )
  }

  const isDashed = () => cat() === "backlog"

  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" class="shrink-0">
      <circle
        cx="6" cy="6" r="4.5"
        fill="none"
        stroke={color()}
        stroke-width="1.5"
        stroke-dasharray={isDashed() ? "2.5 2" : undefined}
      />
      {/* In Progress: half-filled */}
      <Show when={cat() === "started"}>
        <path d="M6 1.5 A4.5 4.5 0 0 1 6 10.5 Z" fill={color()} />
      </Show>
      {/* In Review: inner ring */}
      <Show when={cat() === "in_review"}>
        <circle cx="6" cy="6" r="2.5" fill="none" stroke={color()} stroke-width="1.5" />
      </Show>
    </svg>
  )
}

function PriorityIcon(props: { value: number; class?: string }) {
  if (props.value === 0) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class={props.class} aria-hidden="true">
        <rect x="1" y="7" width="3" height="2" rx="0.5" opacity="0.3" />
        <rect x="6" y="7" width="3" height="2" rx="0.5" opacity="0.3" />
        <rect x="11" y="7" width="3" height="2" rx="0.5" opacity="0.3" />
      </svg>
    )
  }
  if (props.value === 1) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" class={props.class} aria-hidden="true">
        <rect x="1" y="8" width="3" height="6" rx="0.5" fill="#ef4444" />
        <rect x="6" y="5" width="3" height="9" rx="0.5" fill="#ef4444" />
        <rect x="11" y="2" width="3" height="12" rx="0.5" fill="#ef4444" />
      </svg>
    )
  }
  if (props.value === 2) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" class={props.class} aria-hidden="true">
        <rect x="1" y="8" width="3" height="6" rx="0.5" fill="currentColor" />
        <rect x="6" y="5" width="3" height="9" rx="0.5" fill="currentColor" />
        <rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.3" />
      </svg>
    )
  }
  if (props.value === 3) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" class={props.class} aria-hidden="true">
        <rect x="1" y="8" width="3" height="6" rx="0.5" fill="currentColor" />
        <rect x="6" y="5" width="3" height="9" rx="0.5" fill="currentColor" opacity="0.3" />
        <rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.3" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" class={props.class} aria-hidden="true">
      <rect x="1" y="8" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="6" y="5" width="3" height="9" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.3" />
    </svg>
  )
}
