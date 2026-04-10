import {
  type Accessor,
  createSignal,
  type FlowComponent,
  onMount,
} from "solid-js"
import { startAuthentication } from "@simplewebauthn/browser"
import { honoClient, setAccessToken } from "@/lib/hono-client"
import { createStrictContext } from "@/utils/create-strict-context"
import type { UserResponseDTO } from "@/server/modules/auth/auth.dto"

type AuthContextValue = {
  user: Accessor<UserResponseDTO | null>
  loading: Accessor<boolean>
  accessToken: Accessor<string | null>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  passkeyLogin: () => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<boolean>
}

const [useAuthContext, Provider] = createStrictContext<AuthContextValue>("AuthContext")
export { useAuthContext }

export const AuthContextProvider: FlowComponent = (props) => {
  const [user, setUser] = createSignal<UserResponseDTO | null>(null)
  const [accessToken, _setAccessToken] = createSignal<string | null>(null)
  const [loading, setLoading] = createSignal(true)

  function storeToken(token: string | null) {
    _setAccessToken(token)
    setAccessToken(token) // inject into hono-client global
  }

  /** Attempt a silent token refresh via the HttpOnly refresh cookie. */
  const refresh = async (): Promise<boolean> => {
    try {
      const res = await honoClient().auth.refresh.$post()
      if (!res.ok) {
        storeToken(null)
        setUser(null)
        return false
      }
      const data = await res.json()
      storeToken(data.accessToken)
      setUser(data.user as UserResponseDTO)
      return true
    } catch {
      storeToken(null)
      setUser(null)
      return false
    }
  }

  onMount(async () => {
    // On app boot, attempt silent refresh (uses the HttpOnly refresh cookie)
    await refresh()
    setLoading(false)
  })

  const login = async (email: string, password: string): Promise<void> => {
    const res = await honoClient().auth.login.$post({ json: { email, password } })
    const data = await res.json()
    if (!res.ok) throw new Error((data as any).error?.message || "Login failed")
    storeToken(data.accessToken)
    setUser(data.user as UserResponseDTO)
  }

  const register = async (email: string, password: string): Promise<void> => {
    const res = await honoClient().auth.register.$post({ json: { email, password } })
    const data = await res.json()
    if (!res.ok) throw new Error((data as any).error?.message || "Registration failed")
    storeToken(data.accessToken)
    setUser(data.user as UserResponseDTO)
  }

  const passkeyLogin = async (): Promise<void> => {
    const optRes = await honoClient().auth.passkey.auth.options.$post()
    const options = await optRes.json()

    const credential = await startAuthentication({ optionsJSON: options as any })

    const verifyRes = await honoClient().auth.passkey.auth.verify.$post({ json: credential as any })
    const data = await verifyRes.json()
    if (!verifyRes.ok) throw new Error((data as any).error?.message || "Passkey authentication failed")
    storeToken(data.accessToken)
    setUser(data.user as UserResponseDTO)
  }

  const logout = async (): Promise<void> => {
    await honoClient().auth.logout.$post()
    storeToken(null)
    setUser(null)
  }

  return (
    <Provider value={{ user, loading, accessToken, login, register, passkeyLogin, logout, refresh }}>
      {props.children}
    </Provider>
  )
}
