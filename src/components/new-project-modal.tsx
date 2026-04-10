import { createEffect, createSignal, Show } from "solid-js"
import {
  IconCalendar,
  IconMembers,
  IconPerson,
  IconPlus,
  IconProjects,
  IconX,
} from "@/assets/icons"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { honoClient } from "@/lib/hono-client"
import {
  makePriorityItems,
  makeProjectStatusItems,
  PRIORITY_LABELS,
  PriorityIcon,
  ProjectStatusIcon,
  PROJECT_STATUSES,
  ToolbarCombobox,
  type ProjectStatus,
} from "@/components/issue-fields"
import * as DialogPrimitive from "@kobalte/core/dialog"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewProjectModal(props: {
  open: boolean
  onClose: () => void
  workspaceSlug: string
}) {
  const [name, setName] = createSignal("")
  const [summary, setSummary] = createSignal("")
  const [description, setDescription] = createSignal("")
  const [status, setStatus] = createSignal<ProjectStatus>("backlog")
  const [priority, setPriority] = createSignal("0")
  const [loading, setLoading] = createSignal(false)
  const [workspaceId, setWorkspaceId] = createSignal<string | null>(null)
  const [workspaceIdentifier, setWorkspaceIdentifier] = createSignal<string>("")
  const [dataLoaded, setDataLoaded] = createSignal(false)

  // Popover open states
  const [statusOpen, setStatusOpen] = createSignal(false)
  const [priorityOpen, setPriorityOpen] = createSignal(false)

  let titleInputRef: HTMLInputElement | undefined

  // Focus title input when modal opens
  createEffect(() => {
    if (!props.open) return
    setTimeout(() => titleInputRef?.focus(), 50)
  })

  // Load workspace data when modal first opens
  createEffect(() => {
    if (!props.open || dataLoaded()) return
    loadWorkspace()
  })

  async function loadWorkspace() {
    try {
      const client = honoClient()
      const wsRes = await client.workspaces.$get()
      if (!wsRes.ok) return
      const wsData = await wsRes.json()
      const workspace = (wsData as any).workspaces?.find((w: any) => w.slug === props.workspaceSlug)
      if (!workspace) return
      setWorkspaceId(workspace.id)
      // Use the slug uppercased as identifier if no explicit identifier field
      setWorkspaceIdentifier(
        (workspace.identifier ?? props.workspaceSlug).toUpperCase().slice(0, 4)
      )
      setDataLoaded(true)
    } catch {}
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()
    const wsId = workspaceId()
    if (!name().trim() || !wsId) return
    setLoading(true)
    try {
      const client = honoClient()
      await (client.workspaces as any)[":workspaceId"].projects.$post({
        param: { workspaceId: wsId },
        json: {
          name: name().trim(),
          description: description() || null,
          summary: summary() || null,
          status: status(),
          priority: parseInt(priority()),
        },
      })
      handleClose()
    } catch (err) {
      console.error("Failed to create project:", err)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setName("")
    setSummary("")
    setDescription("")
    setStatus("backlog")
    setPriority("0")
    props.onClose()
  }

  const currentStatus = () => PROJECT_STATUSES.find((s) => s.value === status())!

  const statusItems = makeProjectStatusItems

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent
        showClose={false}
        class="gap-0 overflow-hidden p-0 flex flex-col"
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
        style={{
          "max-width": "680px",
          width: "680px",
          "max-height": "calc(100vh - 80px)",
        }}
      >
        <form onSubmit={handleSubmit} class="flex h-full flex-col min-h-0">
          {/* ── Header bar ─────────────────────────────────────────── */}
          <div class="flex items-center justify-between border-b border-border/40 px-4 py-2.5 shrink-0">
            <div class="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Show
                when={workspaceIdentifier()}
                fallback={<div class="h-3 w-20 animate-pulse rounded bg-secondary/40" />}
              >
                <span class="font-medium text-foreground">{workspaceIdentifier()}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="size-3"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span>New project</span>
              </Show>
            </div>
            <DialogPrimitive.CloseButton
              class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              onClick={handleClose}
            >
              <IconX class="size-3.5" />
            </DialogPrimitive.CloseButton>
          </div>

          {/* ── Body ────────────────────────────────────────────────── */}
          <div class="flex-1 overflow-y-auto min-h-0">
            <div class="px-6 pt-5 pb-4">
              {/* Project icon */}
              <button
                type="button"
                class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60 text-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                title="Change project icon"
              >
                <IconProjects class="size-5" />
              </button>

              {/* Title */}
              <input
                ref={titleInputRef}
                type="text"
                placeholder="Project name"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                class="mb-2 w-full bg-transparent text-[22px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              />

              {/* Summary */}
              <input
                type="text"
                placeholder="Add a short summary..."
                value={summary()}
                onInput={(e) => setSummary(e.currentTarget.value)}
                class="mb-4 w-full bg-transparent text-[13px] text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              />

              {/* ── Toolbar pills ─────────────────────────────────── */}
              <div class="flex flex-wrap items-center gap-1.5 border-b border-border/30 pb-4 mb-4">
                {/* Status */}
                <ToolbarCombobox
                  open={statusOpen()}
                  onOpenChange={setStatusOpen}
                  items={statusItems()}
                  value={status()}
                  onValueChange={(v) => setStatus(v as ProjectStatus)}
                  searchPlaceholder="Search status..."
                  contentClass="w-48"
                  disallowEmptySelection
                >
                  <ProjectStatusIcon
                    status={currentStatus().value}
                    color={currentStatus().color}
                    class="size-3.5 shrink-0"
                  />
                  <span>{currentStatus().label}</span>
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

                {/* Lead (placeholder) */}
                <button
                  type="button"
                  class="flex items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <div class="flex size-4 shrink-0 items-center justify-center rounded-full border border-border/50">
                    <IconPerson class="size-2.5" />
                  </div>
                  <span>No lead</span>
                </button>

                {/* Members (placeholder) */}
                <button
                  type="button"
                  class="flex items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <IconMembers class="size-3.5 shrink-0" />
                  <span>Members</span>
                </button>

                {/* Start date */}
                <button
                  type="button"
                  title="Set start date"
                  class="flex h-7 w-7 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <IconCalendar class="size-3.5" />
                </button>

                {/* Target date */}
                <button
                  type="button"
                  title="Set target date"
                  class="flex h-7 w-7 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <TargetDateIcon class="size-3.5" />
                </button>

                {/* Health */}
                <button
                  type="button"
                  title="Set health"
                  class="flex h-7 w-7 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <HealthIcon class="size-3.5" />
                </button>

                {/* Progress */}
                <button
                  type="button"
                  title="Set progress"
                  class="flex h-7 w-7 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <ProgressIcon class="size-3.5" />
                </button>
              </div>

              {/* Description */}
              <textarea
                placeholder="Write a description, a project brief, or collect ideas..."
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                rows={6}
                class="w-full resize-none bg-transparent text-[13px] text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none"
              />
            </div>

            {/* ── Milestones ─────────────────────────────────────── */}
            <div class="border-t border-border/30 px-6 py-3">
              <div class="flex items-center justify-between">
                <span class="text-[13px] font-medium text-foreground">Milestones</span>
                <button
                  type="button"
                  class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <IconPlus class="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div class="flex items-center justify-end gap-2 border-t border-border/40 px-4 py-3 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              class="rounded-lg px-3.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading() || !name().trim() || !workspaceId()}
              class="rounded-lg bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading() ? "Creating..." : "Create project"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function TargetDateIcon(props: { class?: string }) {
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
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
    </svg>
  )
}

function HealthIcon(props: { class?: string }) {
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
      <path d="M3 12h4l3-9 4 18 3-9h4" />
    </svg>
  )
}

function ProgressIcon(props: { class?: string }) {
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
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}
