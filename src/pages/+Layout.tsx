import type { FlowProps } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import "@/styles/app.css"
import { AuthContextProvider } from "@/context/auth.context"
import { PowerSyncProvider } from "@/lib/powersync"
import { ThemeContextProvider, themeInitScript } from "@/context/theme.context"

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
        </PowerSyncProvider>
      </AuthContextProvider>
    </ThemeContextProvider>
  )
}
