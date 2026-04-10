import { useLocalStorage } from "bagon-hooks"
import {
  type Accessor,
  createEffect,
  createSignal,
  type FlowComponent,
} from "solid-js"
import { createStrictContext } from "@/utils/create-strict-context"

/**
 * Blocking Theme Script (for `<head>`)
 *
 * This script must be inlined in `<head>` and should be blocking to prevent
 * flash of incorrect theme (FOUT). It runs synchronously before the page renders.
 */
export const themeInitScript = `
(function() {
  const themes = ["light", "dark", "magic-blue"]
  const themeKey = "linya-theme"
  let savedTheme = null
  try {
    savedTheme = JSON.parse(localStorage.getItem(themeKey) || 'null')
  } catch (e) {
    savedTheme = null
  }
  const theme = savedTheme && themes.includes(savedTheme) ? savedTheme :
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"

  themes.forEach(function(t) {
    if (t === theme) {
      document.documentElement.classList.add(t)
    } else {
      document.documentElement.classList.remove(t)
    }
  })
})()
`

// ===========================================================================
// Context & Hook
// ===========================================================================

export const themes = ["light", "dark", "magic-blue", "system"] as const

export type Theme = (typeof themes)[number]

/** Maps each non-system theme to its intrinsic light/dark nature. */
export const intrinsicMap: Record<Exclude<Theme, "system">, "light" | "dark"> = {
  light: "light",
  dark: "dark",
  "magic-blue": "dark",
} as const

export type ThemeContextValue = {
  theme: Accessor<Theme>
  setTheme: (theme: Theme) => void
  /** Resolves "system" to the actual active theme. */
  inferredTheme: Accessor<Exclude<Theme, "system">>
  /** Resolves any theme down to either "light" or "dark" (e.g. for code editors). */
  intrinsicTheme: Accessor<"light" | "dark">
  toggleTheme: () => void
}

const [useThemeContext, Provider] = createStrictContext<ThemeContextValue>("ThemeContext")

export { useThemeContext }

// ===========================================================================
// Provider
// ===========================================================================
export const ThemeContextProvider: FlowComponent = (props) => {
  const [theme, setTheme] = useLocalStorage<Theme>({
    key: "linya-theme",
    defaultValue: "system",
  })

  const [inferredTheme, setInferredTheme] =
    createSignal<Exclude<Theme, "system">>("dark")

  const [intrinsicTheme, setIntrinsicTheme] = createSignal<"light" | "dark">("dark")

  createEffect(() => {
    let themeValue = theme()

    if (themeValue === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      themeValue = prefersDark ? "dark" : "light"
    }

    // Apply/remove classes on <html>
    themes.forEach((themeName) => {
      if (themeName === "system") return
      if (themeValue === themeName) {
        document.documentElement.classList.add(themeName)
      } else {
        document.documentElement.classList.remove(themeName)
      }
    })

    const resolved = themeValue as Exclude<Theme, "system">
    setInferredTheme(resolved)
    setIntrinsicTheme(intrinsicMap[resolved])
  })

  function toggleTheme() {
    const current = theme()
    if (current === "light") setTheme("dark")
    else if (current === "dark") setTheme("magic-blue")
    else if (current === "magic-blue") setTheme("light")
    else setTheme("dark") // system → dark
  }

  return (
    <Provider
      value={{
        theme,
        setTheme,
        inferredTheme,
        intrinsicTheme,
        toggleTheme,
      }}
    >
      {props.children}
    </Provider>
  )
}
