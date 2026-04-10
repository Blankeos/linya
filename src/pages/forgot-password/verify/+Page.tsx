import { createSignal } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { honoClient } from "@/lib/hono-client"
import getTitle from "@/utils/get-title"

export default function ForgotPasswordVerifyPage() {
  useMetadata({ title: getTitle("Reset Password") })

  const [password, setPassword] = createSignal("")
  const [status, setStatus] = createSignal<"idle" | "loading" | "success" | "error">("idle")
  const [error, setError] = createSignal("")

  const token = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("token") ?? ""

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    setStatus("loading")
    setError("")

    try {
      await honoClient().auth["forgot-password"].verify.$post({
        json: { token, newPassword: password() },
      })
      setStatus("success")
    } catch (err: any) {
      setError(err?.message || "Failed to reset password")
      setStatus("error")
    }
  }

  return (
    <div class="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div class="w-full max-w-sm space-y-6 p-8">
        <h1 class="text-xl font-semibold text-center">Reset your password</h1>

        {status() === "success" ? (
          <p class="text-sm text-success text-center">Password reset successfully. You can now log in.</p>
        ) : (
          <form onSubmit={handleSubmit} class="space-y-4">
            <input
              type="password"
              placeholder="New password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              minLength={8}
              required
            />
            {error() && <p class="text-xs text-error">{error()}</p>}
            <button
              type="submit"
              disabled={status() === "loading"}
              class="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {status() === "loading" ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
