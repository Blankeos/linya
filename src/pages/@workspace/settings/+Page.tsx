import { createSignal } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { useAuthContext } from "@/context/auth.context"
import getTitle from "@/utils/get-title"

export default function SettingsPage() {
  const pageCtx = usePageContext()
  const params = () => pageCtx.routeParams as Record<string, string>
  const workspaceSlug = () => params().workspace ?? ""
  const auth = useAuthContext()

  useMetadata({ title: getTitle("Settings") })

  const [activeTab, setActiveTab] = createSignal<"workspace" | "members" | "profile">("workspace")

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 shrink-0">
        <h1 class="text-[14px] font-semibold text-foreground tracking-[-0.01em]">Settings</h1>
      </div>

      <div class="flex-1 flex overflow-hidden">
        {/* Settings sidebar */}
        <aside class="w-[180px] shrink-0 border-r border-border/30 px-2 py-3 space-y-0.5">
          {(["workspace", "members", "profile"] as const).map((tab) => (
            <button
              type="button"
              onClick={() => setActiveTab(tab)}
              class={`w-full text-left px-2 py-1.5 rounded text-[13px] transition-colors capitalize ${
                activeTab() === tab
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {tab}
            </button>
          ))}
        </aside>

        {/* Settings content */}
        <div class="flex-1 overflow-y-auto px-8 py-6 max-w-2xl">
          {activeTab() === "workspace" && (
            <WorkspaceSettings workspaceSlug={workspaceSlug()} />
          )}
          {activeTab() === "members" && <MembersSettings />}
          {activeTab() === "profile" && <ProfileSettings email={auth.user()?.email ?? ""} />}
        </div>
      </div>
    </div>
  )
}

function WorkspaceSettings(props: { workspaceSlug: string }) {
  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-[16px] font-semibold text-foreground mb-1">Workspace</h2>
        <p class="text-[13px] text-muted-foreground">Manage your workspace settings.</p>
      </div>

      <div class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
            Workspace name
          </label>
          <input
            type="text"
            value={props.workspaceSlug}
            class="w-full rounded-md border border-border bg-secondary/20 px-3.5 py-2.5 text-[13px] text-foreground outline-none focus:ring-1 focus:ring-ring focus:border-ring transition"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
            URL slug
          </label>
          <div class="flex rounded-md border border-border bg-secondary/20 overflow-hidden">
            <span class="flex items-center px-3 text-[12px] text-muted-foreground/60 border-r border-border bg-secondary/30 shrink-0">
              linya.app/
            </span>
            <input
              type="text"
              value={props.workspaceSlug}
              class="flex-1 px-3 py-2.5 text-[13px] text-foreground bg-transparent outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          class="px-4 py-2 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          Save changes
        </button>
      </div>

      <div class="pt-6 border-t border-border/30">
        <h3 class="text-[14px] font-medium text-foreground mb-1">Danger zone</h3>
        <p class="text-[13px] text-muted-foreground mb-3">
          Permanently delete this workspace and all its data.
        </p>
        <button
          type="button"
          class="px-4 py-2 rounded border border-destructive/40 text-[13px] text-destructive hover:bg-destructive/10 transition-colors"
        >
          Delete workspace
        </button>
      </div>
    </div>
  )
}

function MembersSettings() {
  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-[16px] font-semibold text-foreground mb-1">Members</h2>
        <p class="text-[13px] text-muted-foreground">Manage who has access to this workspace.</p>
      </div>

      <div class="flex items-center gap-2">
        <input
          type="email"
          placeholder="Invite by email…"
          class="flex-1 rounded-md border border-border bg-secondary/20 px-3.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring focus:border-ring transition"
        />
        <button
          type="button"
          class="px-4 py-2 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          Invite
        </button>
      </div>

      <div class="border border-border/40 rounded-lg divide-y divide-border/20">
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="size-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span class="text-[11px] font-medium text-primary">C</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[13px] text-foreground font-medium">You</p>
          </div>
          <span class="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            Owner
          </span>
        </div>
      </div>
    </div>
  )
}

function ProfileSettings(props: { email: string }) {
  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-[16px] font-semibold text-foreground mb-1">Profile</h2>
        <p class="text-[13px] text-muted-foreground">Manage your personal account settings.</p>
      </div>

      <div class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            value={props.email}
            disabled
            class="w-full rounded-md border border-border bg-secondary/20 px-3.5 py-2.5 text-[13px] text-foreground opacity-60 cursor-not-allowed outline-none"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
            Display name
          </label>
          <input
            type="text"
            placeholder="Your name"
            class="w-full rounded-md border border-border bg-secondary/20 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring focus:border-ring transition"
          />
        </div>

        <button
          type="button"
          class="px-4 py-2 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          Save changes
        </button>
      </div>
    </div>
  )
}
