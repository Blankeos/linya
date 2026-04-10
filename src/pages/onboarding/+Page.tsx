import { createMemo, createSignal, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { navigate } from "vike/client/router"
import getTitle from "@/utils/get-title"
import { useAuthContext } from "@/context/auth.context"
import { honoClient } from "@/lib/hono-client"

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
}

export default function OnboardingPage() {
  useMetadata({ title: getTitle("Create your workspace") })
  const auth = useAuthContext()

  const [workspaceName, setWorkspaceName] = createSignal("")
  const [workspaceSlug, setWorkspaceSlug] = createSignal("")
  const [slugEdited, setSlugEdited] = createSignal(false)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal("")

  const displaySlug = createMemo(() => {
    if (slugEdited()) return workspaceSlug()
    return slugify(workspaceName())
  })

  const handleCreateWorkspace = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!workspaceName().trim()) return

    setLoading(true)
    setError("")
    try {
      const slug = displaySlug() || slugify(workspaceName())
      const client = honoClient()

      const wsRes = await client.workspaces.$post({
        json: { name: workspaceName(), slug },
      })
      if (!wsRes.ok) throw new Error("Failed to create workspace")

      // Redirect to welcome page
      navigate(`/${slug}/welcome`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div class="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 py-12 overflow-hidden">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fade-in { animation: fadeIn 0.4s ease-out; }
      `}</style>

      <div class="w-full max-w-[540px] space-y-8 fade-in">
        <div class="flex items-center justify-between">
          <div />
          <div class="text-sm text-gray-400">
            Logged in as <span class="text-white">{auth.user()?.email}</span>
          </div>
          <button class="text-sm text-gray-400 hover:text-white transition-colors">Log out</button>
        </div>

        <div class="text-center space-y-6 pt-8">
          <h1 class="text-5xl font-light tracking-tight">Create a new workspace</h1>
          <p class="text-xl text-gray-400">
            Workspaces are shared environments where teams can work<br />on projects, cycles and issues.
          </p>
        </div>

        <form onSubmit={handleCreateWorkspace} class="space-y-6 pt-8">
          <div class="bg-gray-900 rounded-lg p-8 space-y-6 border border-gray-800">
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-300">Workspace Name</label>
              <input
                type="text"
                placeholder="e.g. Acme Inc."
                value={workspaceName()}
                onInput={(e) => {
                  setWorkspaceName(e.currentTarget.value)
                  if (!slugEdited()) setWorkspaceSlug("")
                }}
                required
                autofocus
                class="w-full bg-gray-800 border border-gray-700 rounded px-4 py-3 text-white placeholder:text-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-300">Workspace URL</label>
              <div class="flex rounded border border-gray-700 overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30 transition">
                <span class="flex items-center px-4 py-3 bg-gray-800 border-r border-gray-700 text-gray-400 text-sm shrink-0">
                  linya.app/
                </span>
                <input
                  type="text"
                  placeholder="acme-inc"
                  value={displaySlug()}
                  onInput={(e) => {
                    setSlugEdited(true)
                    setWorkspaceSlug(slugify(e.currentTarget.value))
                  }}
                  class="flex-1 bg-gray-800 px-4 py-3 text-white outline-none placeholder:text-gray-500"
                />
              </div>
            </div>

            <Show when={error()}>
              <p class="text-sm text-red-400">{error()}</p>
            </Show>
          </div>

          <button
            type="submit"
            disabled={loading() || !workspaceName().trim()}
            class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            {loading() ? "Creating…" : "Create workspace"}
          </button>
        </form>
      </div>
    </div>
  )
}
