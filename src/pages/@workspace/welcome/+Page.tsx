import { createSignal, createEffect, Show, onMount } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import getTitle from "@/utils/get-title"
import { useAuthContext } from "@/context/auth.context"

export default function WelcomePage() {
  useMetadata({ title: getTitle("Welcome to Linya") })
  const auth = useAuthContext()
  const pageCtx = usePageContext()
  const workspace = () => (pageCtx.routeParams as Record<string, string>).workspace ?? ""

  const getInitialTheme = (): "light" | "dark" | "magic-blue" => {
    if (typeof window === "undefined") return "dark"
    if (document.documentElement.classList.contains("magic-blue")) return "magic-blue"
    if (document.documentElement.classList.contains("dark")) return "dark"
    return "light"
  }

  const [step, setStep] = createSignal<1 | 2 | 3 | 4 | 5>(1)
  const [theme, setTheme] = createSignal<"light" | "dark" | "magic-blue">(getInitialTheme())
  const [inviteEmails, setInviteEmails] = createSignal("")
  const [loading, setLoading] = createSignal(false)

  createEffect(() => {
    const t = theme()
    const html = document.documentElement
    html.classList.remove("dark", "magic-blue")
    if (t === "dark") html.classList.add("dark")
    else if (t === "magic-blue") html.classList.add("magic-blue")
  })

  const [cmdPressed, setCmdPressed] = createSignal(false)
  const [kPressed, setKPressed] = createSignal(false)
  const [showCommandSuccess, setShowCommandSuccess] = createSignal(false)

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (step() !== 3) return

      // Detect Cmd (Mac) or Ctrl (Windows/Linux)
      const isMeta = e.metaKey || e.ctrlKey

      if (isMeta) {
        setCmdPressed(true)
      }
      if (e.key.toLowerCase() === 'k') {
        setKPressed(true)
      }

      // If both are pressed, show success
      if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCommandSuccess(true)
        setCmdPressed(false)
        setKPressed(false)

        // Auto advance after 3 seconds
        setTimeout(() => {
          setStep(4)
          setShowCommandSuccess(false)
        }, 3000)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey

      if (!isMeta && (cmdPressed() || e.key === 'Meta' || e.key === 'Control')) {
        setCmdPressed(false)
      }
      if (e.key.toLowerCase() !== 'k' && kPressed()) {
        setKPressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  })

  const handleFinish = () => {
    window.location.href = `/${workspace()}/my-issues`
  }

  const totalSteps = 5

  return (
    <>
    <style>{`
      @keyframes welcomeFadeIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .fade-in { animation: welcomeFadeIn 0.4s ease-out; }
    `}</style>
    <div class="w-full max-w-2xl flex flex-col items-center">
        {/* Step 1: Welcome */}
        <Show when={step() === 1}>
          <div class="w-full flex flex-col items-center space-y-12 text-center fade-in">
            <div class="pt-16">
              <LinyaLogoLarge />
            </div>
            <div class="space-y-4">
              <h1 class="text-5xl font-light tracking-tight">Welcome to Linya</h1>
              <p class="text-lg text-muted-foreground">
                Your workspace is ready. Let's get you set up<br />so you can hit the ground running.
              </p>
            </div>
            <button
              onClick={() => setStep(2)}
              class="bg-primary hover:opacity-90 text-primary-foreground font-medium py-3 px-12 rounded-lg transition-colors mt-8"
            >
              Get started
            </button>
          </div>
        </Show>

        {/* Step 2: Choose Theme */}
        <Show when={step() === 2}>
          <div class="w-full max-w-2xl space-y-8 fade-in">
            <div class="text-center space-y-3">
              <h1 class="text-4xl font-light tracking-tight">Pick your vibe</h1>
              <p class="text-lg text-muted-foreground">
                You can always switch themes from settings or the command menu.
              </p>
            </div>

            <div class="grid grid-cols-3 gap-4 mt-12">
              <ThemeCard
                name="Light"
                selected={theme() === "light"}
                onClick={() => setTheme("light")}
                preview={<LightPreview />}
              />
              <ThemeCard
                name="Dark"
                selected={theme() === "dark"}
                onClick={() => setTheme("dark")}
                preview={<DarkPreview />}
              />
              <ThemeCard
                name="Magic Blue"
                selected={theme() === "magic-blue"}
                onClick={() => setTheme("magic-blue")}
                preview={<MagicBluePreview />}
              />
            </div>

            <button
              onClick={() => setStep(3)}
              class="w-full bg-primary hover:opacity-90 text-primary-foreground font-medium py-3 px-6 rounded-lg transition-colors mt-8"
            >
              Continue
            </button>
          </div>
        </Show>

        {/* Step 3: Command Menu */}
        <Show when={step() === 3}>
          <div class="w-full max-w-2xl space-y-12 text-center fade-in">
            <Show when={!showCommandSuccess()}>
              <div class="space-y-4">
                <h1 class="text-4xl font-light tracking-tight">Your shortcut to everything</h1>
                <p class="text-lg text-muted-foreground">
                  The command menu lets you navigate and act without touching the mouse.
                </p>
              </div>

              <div class="bg-card rounded-lg border border-border p-12 space-y-8">
                <p class="text-foreground font-medium">Give it a try — open it with:</p>
                <div class="flex items-center justify-center gap-4">
                  <KbdKey active={cmdPressed()} label="⌘" />
                  <span class="text-muted-foreground">or</span>
                  <KbdKey active={kPressed()} label="K" />
                </div>
              </div>

              <button
                onClick={() => setStep(4)}
                class="text-muted-foreground hover:text-foreground transition-colors text-lg"
              >
                Continue
              </button>
            </Show>

            <Show when={showCommandSuccess()}>
              <div class="space-y-6 pt-16 animate-pulse">
                <h1 class="text-5xl font-light tracking-tight">You're a natural.</h1>
                <p class="text-lg text-muted-foreground">
                  Keep{" "}
                  <span class="inline-flex items-center gap-2 align-middle">
                    <KbdKey label="⌘" />
                    <KbdKey label="K" />
                  </span>{" "}
                  in your back pocket — it'll save you a lot of clicking.
                </p>
                <button
                  onClick={() => {
                    setShowCommandSuccess(false)
                    setStep(4)
                  }}
                  class="bg-primary hover:opacity-90 text-primary-foreground font-medium py-3 px-12 rounded-lg transition-colors mt-8"
                >
                  Continue
                </button>
              </div>
            </Show>
          </div>
        </Show>

        {/* Step 4: GitHub Integration */}
        <Show when={step() === 4}>
          <div class="w-full max-w-2xl space-y-12 text-center fade-in">
            <div class="space-y-4">
              <GitHubIcon />
              <h1 class="text-4xl font-light tracking-tight">Connect GitHub</h1>
              <p class="text-lg text-muted-foreground">
                Keep your PRs and issues in sync — no manual updates needed.
              </p>
            </div>

            <div class="bg-card rounded-lg border border-border p-8 space-y-6">
              <div class="space-y-4">
                <CheckItem text="Issues and PRs are linked automatically — no copy-pasting branch names." />
                <CheckItem text="Issue status updates when a PR is opened, merged, or closed." />
                <CheckItem text="Read access to your code is never requested." />
              </div>

              <button
                onClick={() => setStep(5)}
                class="w-full bg-primary hover:opacity-90 text-primary-foreground font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Authenticate with GitHub
              </button>
              <button
                onClick={() => setStep(5)}
                class="w-full text-muted-foreground hover:text-foreground transition-colors text-sm py-2"
              >
                I'll do this later
              </button>
            </div>
          </div>
        </Show>

        {/* Step 5: Invite & Final */}
        <Show when={step() === 5}>
          <div class="w-full max-w-2xl space-y-8 fade-in">
            <div class="text-center space-y-4 mb-8">
              <h1 class="text-4xl font-light tracking-tight">Bring your team in</h1>
              <p class="text-lg text-muted-foreground">
                Things move faster together. Add a few teammates to get started.
              </p>
            </div>

            <div class="bg-card rounded-lg border border-border p-8 space-y-6">
              <div class="space-y-2">
                <label class="text-sm font-medium text-foreground">Email</label>
                <textarea
                  placeholder="email@example.com, email2@example.com..."
                  value={inviteEmails()}
                  onInput={(e) => setInviteEmails(e.currentTarget.value)}
                  class="w-full bg-secondary border border-border rounded px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/30 transition resize-none"
                  rows="4"
                />
              </div>

              <button
                disabled={!inviteEmails().trim()}
                class="w-full bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Send invites
              </button>

              <button
                onClick={handleFinish}
                class="w-full text-muted-foreground hover:text-foreground transition-colors text-sm py-2"
              >
                Continue
              </button>
            </div>
          </div>
        </Show>

        {/* Step Indicators */}
        <div class="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              class={`h-2 rounded-full transition-all duration-300 ${
                step() === i + 1
                  ? "bg-primary w-8"
                  : step() > i + 1
                    ? "bg-primary w-2"
                    : "bg-muted-foreground/30 w-2"
              }`}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function ThemeCard(props: {
  name: string
  selected: boolean
  onClick: () => void
  preview: any
}) {
  return (
    <button
      onClick={props.onClick}
      class={`relative rounded-lg overflow-hidden border-2 transition-all ${
        props.selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-border/60"
      }`}
    >
      <div class="aspect-video overflow-hidden">
        {props.preview}
      </div>
      <div class="p-4 text-center">
        <p class="font-medium text-foreground">{props.name}</p>
      </div>
    </button>
  )
}

function AppPreview(props: {
  sidebar: string
  sidebarBorder: string
  main: string
  accent: string
  lineA: string
  lineB: string
  dot: string
}) {
  const navWidths = [72, 88, 62, 78]
  const rowWidths = [88, 68, 92, 58]
  return (
    <div class="w-full h-full flex overflow-hidden">
      {/* Sidebar */}
      <div
        class="flex flex-col gap-1.5 p-2 shrink-0"
        style={{ width: "38%", background: props.sidebar, "border-right": `0.5px solid ${props.sidebarBorder}` }}
      >
        {/* Workspace header */}
        <div class="flex items-center gap-1 mb-1">
          <div style={{ width: "6px", height: "6px", background: props.accent, "border-radius": "2px", "flex-shrink": "0" }} />
          <div style={{ height: "2px", background: props.lineA, "border-radius": "2px", flex: "1" }} />
        </div>
        {/* Nav items */}
        {navWidths.map((w) => (
          <div class="flex items-center gap-1">
            <div style={{ width: "3px", height: "3px", background: props.dot, "border-radius": "1px", "flex-shrink": "0" }} />
            <div style={{ height: "1.5px", background: props.lineA, "border-radius": "2px", width: `${w}%` }} />
          </div>
        ))}
      </div>
      {/* Main content */}
      <div class="flex-1 flex flex-col p-2 gap-1" style={{ background: props.main }}>
        <div style={{ height: "2.5px", background: props.lineA, "border-radius": "2px", width: "45%" }} />
        <div style={{ height: "0.5px", background: props.lineB, width: "100%", margin: "1px 0" }} />
        {rowWidths.map((w) => (
          <div class="flex items-center gap-1">
            <div style={{ width: "3px", height: "3px", background: props.dot, "border-radius": "50%", "flex-shrink": "0" }} />
            <div style={{ height: "1.5px", background: props.lineB, "border-radius": "2px", width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function LightPreview() {
  return (
    <AppPreview
      sidebar="#EEEEF0"
      sidebarBorder="#DCDDE0"
      main="#FFFFFF"
      accent="#5E6AD2"
      lineA="#C8C9CE"
      lineB="#EAEAED"
      dot="#C0C1C8"
    />
  )
}

function DarkPreview() {
  return (
    <AppPreview
      sidebar="#111113"
      sidebarBorder="#252527"
      main="#1C1C1E"
      accent="#6E78D4"
      lineA="#383838"
      lineB="#282828"
      dot="#484850"
    />
  )
}

function MagicBluePreview() {
  return (
    <AppPreview
      sidebar="#13141C"
      sidebarBorder="#20213A"
      main="#191A23"
      accent="#7C85E0"
      lineA="#2E3050"
      lineB="#22233A"
      dot="#3C3D5A"
    />
  )
}

function KbdKey(props: { label: string; icon?: boolean; active?: boolean }) {
  return (
    <div
      class={`border rounded px-4 py-2 font-mono text-sm font-medium min-w-fit transition-all ${
        props.active
          ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/50"
          : "bg-secondary text-foreground border-border"
      }`}
    >
      {props.label}
    </div>
  )
}

function CheckItem(props: { text: string }) {
  return (
    <div class="flex gap-3 items-start text-left">
      <div class="flex-shrink-0 mt-1">
        <svg class="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </div>
      <p class="text-foreground text-sm leading-relaxed">{props.text}</p>
    </div>
  )
}

function GitHubIcon() {
  return (
    <div class="flex justify-center mb-4">
      <svg class="w-12 h-12 text-foreground" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    </div>
  )
}

function LinyaLogoLarge() {
  return (
    <svg width="64" height="64" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#5E6AD2" />
      <path d="M14 12 L14 32 L20 38 L20 18 Z" fill="white" opacity="0.9" />
      <path d="M20 32 L34 36 L34 30 L20 26 Z" fill="white" opacity="0.7" />
    </svg>
  )
}
