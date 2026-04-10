import { createSignal, Show } from "solid-js"
import { navigate } from "vike/client/router"
import { useMetadata } from "vike-metadata-solid"
import { useAuthContext } from "@/context/auth.context"
import getTitle from "@/utils/get-title"
import { getRoute } from "@/route-tree.gen"

export default function SignupPage() {
  useMetadata({ title: getTitle("Sign up") })

  const auth = useAuthContext()
  const [email, setEmail] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [confirmPassword, setConfirmPassword] = createSignal("")
  const [showPassword, setShowPassword] = createSignal(false)
  const [showEmailForm, setShowEmailForm] = createSignal(false)
  const [error, setError] = createSignal("")
  const [loading, setLoading] = createSignal(false)

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (password() !== confirmPassword()) {
      setError("Passwords do not match.")
      return
    }
    setLoading(true)
    setError("")
    try {
      await auth.register(email(), password())
      navigate(getRoute("/dashboard/onboarding"))
    } catch (err: any) {
      setError(err?.message || "Could not create account.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="dark">
      {/* Background gradient */}
      <div class="fixed inset-0 bg-[#0d0d0d] overflow-hidden">
        <svg
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[60%] opacity-60 pointer-events-none select-none"
          width="800"
          height="800"
          viewBox="0 0 800 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="sg1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#5E6AD2" stop-opacity="0.25" />
              <stop offset="100%" stop-color="#5E6AD2" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="sg2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.12" />
              <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="400" cy="400" rx="400" ry="320" fill="url(#sg1)" />
          <ellipse cx="460" cy="360" rx="260" ry="210" fill="url(#sg2)" />
        </svg>
      </div>

      {/* Content */}
      <div class="relative flex min-h-screen flex-col items-center justify-center px-4">
        <div class="w-[288px] flex flex-col items-center">

          {/* Logo */}
          <LinyaLogo />

          {/* Heading */}
          <h1 class="mt-6 text-[18px] font-medium leading-normal tracking-normal text-[rgb(226,227,229)]">
            Create your account
          </h1>

          {/* Buttons */}
          <div class="mt-6 flex w-full flex-col gap-3">
            {/* Google — primary purple */}
            <a
              href="/api/auth/login/google"
              class="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[#5E6AD2] px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#6974E1]"
            >
              <GoogleIcon class="size-4 shrink-0" />
              Continue with Google
            </a>

            {/* GitHub — dark secondary */}
            <a
              href="/api/auth/login/github"
              class="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[#1c1c1d] px-[18px] text-[13px] font-medium text-[rgb(226,227,229)] transition-colors hover:bg-[#252527]"
              style="box-shadow: rgba(255,255,255,0.133) 0px 0px 0px 0.5px, rgba(0,0,0,0.08) 0px 1px 1px 0px"
            >
              <GitHubIcon class="size-4 shrink-0" />
              Continue with GitHub
            </a>

            {/* Email — toggles inline form */}
            <Show
              when={!showEmailForm()}
              fallback={
                <form onSubmit={handleSubmit} class="flex flex-col gap-2">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                    autocomplete="email"
                    required
                    class="h-11 w-full rounded-lg border-0 bg-[#1c1c1d] px-3.5 text-[13px] text-[rgb(226,227,229)] placeholder:text-[rgb(147,148,150)] outline-none transition focus:ring-1 focus:ring-[#5E6AD2]"
                    style="box-shadow: rgba(255,255,255,0.133) 0px 0px 0px 0.5px, rgba(0,0,0,0.08) 0px 1px 1px 0px"
                  />

                  <div class="relative">
                    <input
                      type={showPassword() ? "text" : "password"}
                      placeholder="Password"
                      value={password()}
                      onInput={(e) => setPassword(e.currentTarget.value)}
                      autocomplete="new-password"
                      required
                      class="h-11 w-full rounded-lg border-0 bg-[#1c1c1d] px-3.5 pr-10 text-[13px] text-[rgb(226,227,229)] placeholder:text-[rgb(147,148,150)] outline-none transition focus:ring-1 focus:ring-[#5E6AD2]"
                      style="box-shadow: rgba(255,255,255,0.133) 0px 0px 0px 0.5px, rgba(0,0,0,0.08) 0px 1px 1px 0px"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(147,148,150)] hover:text-[rgb(226,227,229)] transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword() ? "Hide password" : "Show password"}
                    >
                      <Show when={showPassword()} fallback={<EyeIcon class="size-4" />}>
                        <EyeOffIcon class="size-4" />
                      </Show>
                    </button>
                  </div>

                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword()}
                    onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                    autocomplete="new-password"
                    required
                    class="h-11 w-full rounded-lg border-0 bg-[#1c1c1d] px-3.5 text-[13px] text-[rgb(226,227,229)] placeholder:text-[rgb(147,148,150)] outline-none transition focus:ring-1 focus:ring-[#5E6AD2]"
                    style="box-shadow: rgba(255,255,255,0.133) 0px 0px 0px 0.5px, rgba(0,0,0,0.08) 0px 1px 1px 0px"
                  />

                  <Show when={error()}>
                    <p class="text-[12px] text-red-400">{error()}</p>
                  </Show>

                  <button
                    type="submit"
                    disabled={loading()}
                    class="flex h-11 w-full items-center justify-center rounded-lg bg-[#5E6AD2] px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#6974E1] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading() ? "Creating account…" : "Create account"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEmailForm(false)}
                    class="text-center text-[12px] text-[rgb(147,148,150)] hover:text-[rgb(226,227,229)] transition-colors mt-1"
                  >
                    Back
                  </button>
                </form>
              }
            >
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                class="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[#1c1c1d] px-[18px] text-[13px] font-medium text-[rgb(226,227,229)] transition-colors hover:bg-[#252527]"
                style="box-shadow: rgba(255,255,255,0.133) 0px 0px 0px 0.5px, rgba(0,0,0,0.08) 0px 1px 1px 0px"
              >
                <EmailIcon class="size-4 shrink-0" />
                Continue with email
              </button>
            </Show>
          </div>

          {/* Footer */}
          <p class="mt-8 text-center text-[13px] font-[450] text-[rgb(147,148,150)]">
            Already have an account?{" "}
            <a
              href={getRoute("/login")}
              class="text-[rgb(226,227,229)] underline-offset-[2.5px] hover:underline"
            >
              Log in
            </a>
          </p>

        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// Logo
// ===========================================================================

function LinyaLogo() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" fill="#5E6AD2" />
      <path d="M14 12 L14 32 L20 38 L20 18 Z" fill="white" opacity="0.9" />
      <path d="M20 32 L34 36 L34 30 L20 26 Z" fill="white" opacity="0.7" />
    </svg>
  )
}

// ===========================================================================
// Icons
// ===========================================================================

function GitHubIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      class={props.class}
      aria-hidden="true"
      fill="currentColor"
    >
      <path
        fill-rule="evenodd"
        d="M64 5.103c-33.347 0-60.388 27.035-60.388 60.388c0 26.682 17.303 49.317 41.297 57.303c3.017.56 4.125-1.31 4.125-2.905c0-1.44-.056-6.197-.082-11.243c-16.8 3.653-20.345-7.125-20.345-7.125c-2.747-6.98-6.705-8.836-6.705-8.836c-5.48-3.748.413-3.67.413-3.67c6.063.425 9.257 6.223 9.257 6.223c5.386 9.23 14.127 6.562 17.573 5.02c.542-3.903 2.107-6.568 3.834-8.076c-13.413-1.525-27.514-6.704-27.514-29.843c0-6.593 2.36-11.98 6.223-16.21c-.628-1.52-2.695-7.662.584-15.98c0 0 5.07-1.623 16.61 6.19C53.7 35 58.867 34.327 64 34.304c5.13.023 10.3.694 15.127 2.033c11.526-7.813 16.59-6.19 16.59-6.19c3.287 8.317 1.22 14.46.593 15.98c3.872 4.23 6.215 9.617 6.215 16.21c0 23.194-14.127 28.3-27.574 29.796c2.167 1.874 4.097 5.55 4.097 11.183c0 8.08-.07 14.583-.07 16.572c0 1.607 1.088 3.49 4.148 2.897c23.98-7.994 41.263-30.622 41.263-57.294C124.388 32.14 97.35 5.104 64 5.104z"
        clip-rule="evenodd"
      />
    </svg>
  )
}

function GoogleIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      class={props.class}
      aria-hidden="true"
    >
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  )
}

function EmailIcon(props: { class?: string }) {
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
      aria-hidden="true"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function EyeIcon(props: { class?: string }) {
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
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon(props: { class?: string }) {
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
      aria-hidden="true"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}
