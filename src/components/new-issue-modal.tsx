import { createEffect, createSignal, Show } from "solid-js"
import {
  IconCalendar,
  IconCustomers,
  IconLink,
  IconMaximize,
  IconMinimize,
  IconMore,
  IconPerson,
  IconProjects,
  IconRepeat,
  IconSubIssue,
  IconTag,
} from "@/assets/icons"
import { type ComboboxItem } from "@/components/ui/combobox-2"
import { Dialog, DialogContent } from "@/components/ui/dialog"
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
  DEFAULT_STATUSES,
  makePriorityItems,
  makeStatusItems,
  PRIORITY_LABELS,
  PriorityIcon,
  StatusIcon,
  ToolbarCombobox,
  type Status,
} from "@/components/issue-fields"

type Team = { id: string; name: string; identifier: string }

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
  let titleInputRef: HTMLInputElement | undefined
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

  // Focus title input when modal opens
  createEffect(() => {
    if (!props.open) return
    setTimeout(() => titleInputRef?.focus(), 50)
  })

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
      const workspace = (wsData as any).workspaces?.find((w: any) => w.slug === props.workspaceSlug)
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
      const defaultStatus = statusList.find((s) => s.category === "unstarted") ?? statusList[0]
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

  const statusItems = () => makeStatusItems(statuses())

  const assigneeItems = (): ComboboxItem[] => [
    {
      value: "",
      label: (
        <span class="flex items-center gap-2">
          <div class="flex size-5 shrink-0 items-center justify-center rounded-full border border-border/50">
            <IconPerson class="size-3 text-muted-foreground" />
          </div>
          No assignee
        </span>
      ),
    },
  ]

  const projectItems = (): ComboboxItem[] => [{ value: "", label: "No project" }]

  const labelItems = (): ComboboxItem[] => []

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent
        showClose={false}
        class="gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
        style={{
          "max-width": fullscreen() ? "calc(100vw - 80px)" : "560px",
          width: fullscreen() ? "100%" : "560px",
          height: fullscreen() ? "calc(100vh - 40px)" : "360px",
          transition:
            "max-width 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1), height 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <form onSubmit={handleSubmit} class="flex h-full flex-col">
          {/* Header: Team + Fullscreen */}
          <div class="flex items-center justify-between px-4 pt-3 pb-1">
            <Show
              when={selectedTeam()}
              fallback={<div class="h-4 w-28 animate-pulse rounded bg-secondary/40" />}
            >
              <div class="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <div class="flex size-4 shrink-0 items-center justify-center rounded bg-primary/20">
                  <span class="font-bold text-[8px] text-primary">
                    {selectedTeam()!.identifier?.[0] ?? "T"}
                  </span>
                </div>
                <span class="font-medium">{selectedTeam()!.identifier}</span>
              </div>
            </Show>
            <button
              type="button"
              class="rounded p-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              title={fullscreen() ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => setFullscreen((f) => !f)}
            >
              {fullscreen() ? <IconMinimize class="size-3.5" /> : <IconMaximize class="size-3.5" />}
            </button>
          </div>

          {/* Title */}
          <div class="px-4 pb-1">
            <input
              ref={titleInputRef}
              type="text"
              placeholder="Issue title"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              class="w-full bg-transparent font-medium text-[15px] text-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Description */}
          <div class="flex-1 px-4 pb-3">
            <textarea
              placeholder="Add description..."
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              class="h-full w-full resize-none bg-transparent text-[13px] text-foreground/80 outline-none placeholder:text-muted-foreground/30"
            />
          </div>

          {/* Toolbar */}
          <div class="flex items-center gap-1 border-border/40 border-t px-3 py-2.5">
            {/* Status */}
            <ToolbarCombobox
              open={statusOpen()}
              onOpenChange={setStatusOpen}
              items={statusItems()}
              value={selectedStatusId() ?? ""}
              onValueChange={(v) => setSelectedStatusId((v as string) || null)}
              searchPlaceholder="Search status..."
              contentClass="w-48"
              disallowEmptySelection
            >
              <StatusIcon
                category={selectedStatus()?.category}
                color={selectedStatus()?.color}
                class="size-3.5"
              />
              <span>{selectedStatus()?.name ?? "Status"}</span>
            </ToolbarCombobox>

            {/* Priority */}
            <ToolbarCombobox
              open={priorityOpen()}
              onOpenChange={setPriorityOpen}
              items={makePriorityItems()}
              value={priority()}
              onValueChange={(v) => setPriority(v as string)}
              searchPlaceholder="Set priority to..."
              contentClass="w-44"
            >
              <PriorityIcon value={parseInt(priority())} class="size-4 shrink-0" />
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
              onValueChange={(v) =>
                setSelectedLabels(Array.isArray(v) ? v.join(",") : (v as string))
              }
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
              <DropdownMenuTrigger class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground">
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
          <div class="flex items-center gap-1.5 border-border/40 border-t px-3 py-2.5">
            <div class="flex-1" />

            {/* Create more toggle */}
            <label class="mr-2 flex cursor-pointer select-none items-center gap-1.5 text-[12px] text-muted-foreground">
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
              class="rounded bg-primary px-3 py-1.5 font-medium text-[13px] text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading() ? "Creating..." : "Create issue"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
