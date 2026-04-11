import type { PowerSyncDatabase } from "@powersync/web"
import {
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  type ParentComponent,
  useContext,
} from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { useAuthContext } from "@/context/auth.context"
import { getBackendConnector, resetBackendConnector } from "./connector"
import { getPowerSyncDb, resetPowerSyncDb } from "./database"

type SyncStatus = "disconnected" | "connecting" | "connected" | "error"

type PowerSyncContextValue = {
  db: () => PowerSyncDatabase | null
  isReady: () => boolean
  syncStatus: () => SyncStatus
}

const PowerSyncContext = createContext<PowerSyncContextValue>()

export function usePowerSync(): PowerSyncContextValue {
  const context = useContext(PowerSyncContext)
  if (!context) throw new Error("usePowerSync must be used within a PowerSyncProvider")
  return context
}

export type QueryResult<T> = [() => T[], () => boolean, () => Error | null]

export function usePowerSyncQuery<T = unknown>(
  query: () => string,
  params?: () => unknown[]
): QueryResult<T> {
  const { db, isReady } = usePowerSync()
  const [state, setState] = createStore<{ data: T[]; loading: boolean; error: Error | null }>({
    data: [],
    loading: true,
    error: null,
  })

  let abort: AbortController | null = null

  createEffect(() => {
    const database = db()
    const ready = isReady()

    if (!database || !ready) {
      setState({ data: [], loading: false, error: null })
      return
    }

    const sql = query()
    const queryParams = params?.() ?? []

    if (abort) abort.abort()
    abort = new AbortController()
    setState({ loading: true, error: null })

    database.watch(
      sql,
      queryParams,
      {
        onResult: (result) => {
          setState("data", reconcile(result.rows?._array ?? []))
          setState({ loading: false })
        },
        onError: (error) => {
          setState({ error: error instanceof Error ? error : new Error(String(error)), loading: false })
        },
      },
      { signal: abort.signal }
    )
  })

  onCleanup(() => abort?.abort())

  return [() => state.data, () => state.loading, () => state.error]
}

export type GetOneResult<T> = [() => T | null, () => boolean, () => Error | null]

export function usePowerSyncGetOne<T = unknown>(
  query: () => string,
  params?: () => unknown[]
): GetOneResult<T> {
  const { db, isReady } = usePowerSync()
  const [state, setState] = createStore<{ data: T | null; loading: boolean; error: Error | null }>({
    data: null,
    loading: true,
    error: null,
  })

  createEffect(async () => {
    const database = db()
    const ready = isReady()

    if (!database || !ready) {
      setState({ data: null, loading: false, error: null })
      return
    }

    setState({ loading: true, error: null })

    try {
      const result = await database.get<T | null>(query(), params?.() ?? [])
      setState({ data: result ?? null, loading: false })
    } catch (err) {
      setState({ error: err instanceof Error ? err : new Error(String(err)), loading: false })
    }
  })

  return [() => state.data, () => state.loading, () => state.error]
}

export function usePowerSyncExecute(): (sql: string, params?: unknown[]) => Promise<void> {
  const { db } = usePowerSync()
  return async (sql, params) => {
    const database = db()
    if (!database) throw new Error("PowerSync database not connected")
    await database.execute(sql, params ?? [])
  }
}

function getSyncStatus(connected: boolean, connecting: boolean, downloadError?: Error, uploadError?: Error): SyncStatus {
  if (downloadError || uploadError) return "error"
  if (connecting) return "connecting"
  if (connected) return "connected"
  return "disconnected"
}

// Marker in localStorage tracking which user the local PowerSync SQLite was
// last populated for. If the current session's user id differs, we must wipe
// the local cache before reconnecting — otherwise rows from the previous user
// (or a now-deleted backend) linger in IndexedDB and surface as ghost data.
const LAST_USER_KEY = "powersync.lastUserId"

function getLastUserId(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY)
  } catch {
    return null
  }
}

function setLastUserId(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(LAST_USER_KEY)
    else localStorage.setItem(LAST_USER_KEY, id)
  } catch {
    // localStorage unavailable (SSR, private mode) — safe to ignore.
  }
}

export const PowerSyncProvider: ParentComponent = (props) => {
  const auth = useAuthContext()
  const [db, setDb] = createSignal<PowerSyncDatabase | null>(null)
  const [isReady, setIsReady] = createSignal(false)
  const [syncStatus, setSyncStatus] = createSignal<SyncStatus>("disconnected")

  let hasConnected = false
  let connecting = false
  let statusListener: (() => void) | null = null

  createEffect(() => {
    const currentUser = auth.user()
    const token = auth.accessToken()

    // User logged out — tear down and clear local cache so the next
    // login starts fresh (otherwise the previous user's rows persist in
    // IndexedDB and PowerSync sync rules can't remove them).
    if (!currentUser || !token) {
      if (hasConnected) {
        statusListener?.()
        statusListener = null
        setDb(null)
        setIsReady(false)
        setSyncStatus("disconnected")
        hasConnected = false
        connecting = false
        ;(async () => {
          try {
            const database = await getPowerSyncDb()
            await database.disconnectAndClear()
          } catch (err) {
            console.error("[PowerSync] Failed to clear on logout:", err)
          } finally {
            setLastUserId(null)
            resetPowerSyncDb()
            resetBackendConnector()
          }
        })()
      }
      return
    }

    // Already connected or in progress
    if (connecting || db()) {
      // Update token on the connector in case it was refreshed
      getBackendConnector().updateAuth(currentUser.id, token)
      return
    }

    connecting = true
    setSyncStatus("connecting")

    ;(async () => {
      try {
        const connector = getBackendConnector()
        connector.updateAuth(currentUser.id, token)

        const database = await getPowerSyncDb()

        // If the local SQLite was last populated for a different user,
        // wipe it before connecting. Catches logouts that never ran the
        // tear-down (killed tab, expired token, backend reset, etc).
        const previousUserId = getLastUserId()
        if (previousUserId && previousUserId !== currentUser.id) {
          console.info(
            `[PowerSync] User changed (${previousUserId} → ${currentUser.id}); clearing local cache.`
          )
          await database.disconnectAndClear()
        }
        setLastUserId(currentUser.id)

        statusListener = database.registerListener({
          statusChanged: (status) => {
            const dataFlow = status.dataFlowStatus
            setSyncStatus(
              getSyncStatus(status.connected, status.connecting, dataFlow?.downloadError, dataFlow?.uploadError)
            )
          },
        })

        await database.connect(connector)

        hasConnected = true
        setDb(database)
        setIsReady(true)
      } catch (error) {
        console.error("[PowerSync] Connection error:", error)
        setSyncStatus("error")
        connecting = false
      }
    })()
  })

  onCleanup(() => {
    statusListener?.()
    if (db()) {
      resetPowerSyncDb()
      resetBackendConnector()
    }
  })

  return (
    <PowerSyncContext.Provider value={{ db, isReady, syncStatus }}>
      {props.children}
    </PowerSyncContext.Provider>
  )
}
