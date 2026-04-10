import type { FlowProps } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { Toaster } from "solid-sonner"
import "@/styles/app.css"
import "@/lib/solid-tippy/tippy.css"
import { AuthContextProvider } from "@/context/auth.context"
import { PowerSyncProvider } from "@/lib/powersync"
import { ThemeContextProvider, themeInitScript, useThemeContext } from "@/context/theme.context"

useMetadata.setGlobalDefaults({
  title: "Linya",
  description: "Open-source, self-hostable Linear clone.",
  viewport: { width: "device-width", initialScale: 1 },
  otherJSX: () => <script innerHTML={themeInitScript} />,
})

export default function RootLayout(props: FlowProps) {
  return (
    <ThemeContextProvider>
      <AuthContextProvider>
        <PowerSyncProvider>
          {props.children}
          <_Toaster />
        </PowerSyncProvider>
      </AuthContextProvider>
    </ThemeContextProvider>
  )
}

function _Toaster() {
  const { inferredTheme } = useThemeContext()
  return <Toaster theme={inferredTheme()} richColors />
}
