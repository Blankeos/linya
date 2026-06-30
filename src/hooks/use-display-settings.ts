/**
 * useDisplaySettings — reads/writes display preferences to PowerSync.
 *
 * Each "context" (e.g. team issues for team X, my issues, a custom view) has:
 *   - a workspace-wide default  (user_id IS NULL)
 *   - a per-user override       (user_id = current user)
 *
 * The hook merges them: user override wins, falling back to workspace default,
 * then to hard-coded defaults.
 */

import { createEffect, createMemo, createSignal, on } from "solid-js"
import { usePowerSync, usePowerSyncQuery } from "@/lib/powersync"
import { useAuthContext } from "@/context/auth.context"
import type { DisplayProp } from "@/components/issues-shared"
import { DEFAULT_ACTIVE_PROPS } from "@/components/issues-shared"

// ─── Types ──────────────────────────────────────────────────────────────
export type DisplaySettingsValue = {
  view: "list" | "board"
  grouping: string
  subGrouping: string
  ordering: string
  orderByRecency: boolean
  completedIssues: string
  showSubIssues: boolean
  showEmptyColumns: boolean
  showEmptyGroups: boolean
  nestedSubIssues: boolean
  activeProps: string[] // serialized DisplayProp[]
}

export const DEFAULT_SETTINGS: DisplaySettingsValue = {
  view: "list",
  grouping: "Status",
  subGrouping: "No grouping",
  ordering: "Priority",
  orderByRecency: false,
  completedIssues: "All",
  showSubIssues: true,
  showEmptyColumns: true,
  showEmptyGroups: false,
  nestedSubIssues: false,
  activeProps: Array.from(DEFAULT_ACTIVE_PROPS),
}

type DisplaySettingRow = {
  id: string
  user_id: string | null
  settings: string
}

// ─── Hook ───────────────────────────────────────────────────────────────

export function useDisplaySettings(
  workspaceId: () => string | null,
  contextType: () => string,
  contextId: () => string | null
) {
  const { db } = usePowerSync()
  const auth = useAuthContext()
  const userId = () => auth.user()?.id ?? null

  // Query: workspace default (user_id IS NULL)
  const [defaultRows] = usePowerSyncQuery<DisplaySettingRow>(
    () => {
      const wId = workspaceId()
      if (!wId) return "SELECT id, user_id, settings FROM display_setting WHERE 1=0"
      const cId = contextId()
      if (cId) {
        return `SELECT id, user_id, settings FROM display_setting
                WHERE workspace_id = ? AND user_id IS NULL AND context_type = ? AND context_id = ?`
      }
      return `SELECT id, user_id, settings FROM display_setting
              WHERE workspace_id = ? AND user_id IS NULL AND context_type = ? AND context_id IS NULL`
    },
    () => {
      const wId = workspaceId()
      if (!wId) return []
      const cId = contextId()
      return cId ? [wId, contextType(), cId] : [wId, contextType()]
    }
  )

  // Query: user override
  const [userRows] = usePowerSyncQuery<DisplaySettingRow>(
    () => {
      const wId = workspaceId()
      const uId = userId()
      if (!wId || !uId) return "SELECT id, user_id, settings FROM display_setting WHERE 1=0"
      const cId = contextId()
      if (cId) {
        return `SELECT id, user_id, settings FROM display_setting
                WHERE workspace_id = ? AND user_id = ? AND context_type = ? AND context_id = ?`
      }
      return `SELECT id, user_id, settings FROM display_setting
              WHERE workspace_id = ? AND user_id = ? AND context_type = ? AND context_id IS NULL`
    },
    () => {
      const wId = workspaceId()
      const uId = userId()
      if (!wId || !uId) return []
      const cId = contextId()
      return cId ? [wId, uId, contextType(), cId] : [wId, uId, contextType()]
    }
  )

  // Parse rows into settings
  const workspaceDefault = createMemo((): DisplaySettingsValue => {
    const row = defaultRows()?.[0]
    if (!row) return { ...DEFAULT_SETTINGS }
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(row.settings) }
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  })

  const userOverride = createMemo((): DisplaySettingsValue | null => {
    const row = userRows()?.[0]
    if (!row) return null
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(row.settings) }
    } catch {
      return null
    }
  })

  // Effective settings = user override ?? workspace default
  const effectiveSettings = createMemo((): DisplaySettingsValue => {
    return userOverride() ?? workspaceDefault()
  })

  // Has the user diverged from the workspace default?
  const hasDiverged = createMemo(() => {
    const override = userOverride()
    if (!override) return false
    const def = workspaceDefault()
    return JSON.stringify(override) !== JSON.stringify(def)
  })

  // ─── Mutations ──────────────────────────────────────────────────────
  const generateId = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    let id = ""
    for (let i = 0; i < 25; i++) id += chars[Math.floor(Math.random() * chars.length)]
    return id
  }

  /** Save user-specific override */
  async function saveUserSettings(settings: DisplaySettingsValue) {
    const database = db()
    if (!database) return
    const wId = workspaceId()
    const uId = userId()
    if (!wId || !uId) return

    const existingRow = userRows()?.[0]
    const settingsJson = JSON.stringify(settings)
    const now = new Date().toISOString()

    if (existingRow) {
      await database.execute(
        "UPDATE display_setting SET settings = ?, updated_at = ? WHERE id = ?",
        [settingsJson, now, existingRow.id]
      )
    } else {
      const id = generateId()
      const cId = contextId()
      await database.execute(
        `INSERT INTO display_setting (id, workspace_id, user_id, context_type, context_id, settings, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, wId, uId, contextType(), cId, settingsJson, now, now]
      )
    }
  }

  /** Reset user override → removes user row, falls back to workspace default */
  async function resetToDefault() {
    const database = db()
    if (!database) return
    const existingRow = userRows()?.[0]
    if (existingRow) {
      await database.execute("DELETE FROM display_setting WHERE id = ?", [existingRow.id])
    }
  }

  /** Set current user settings as the workspace default for everyone.
   *  We intentionally keep the user override row — hasDiverged will correctly
   *  return false since the JSON strings match. Deleting the user row here
   *  would cause a reactive race (user row watch fires before the default
   *  row watch updates, momentarily reverting to the old default). */
  async function setDefaultForEveryone() {
    const database = db()
    if (!database) return
    const wId = workspaceId()
    if (!wId) return

    const current = effectiveSettings()
    const settingsJson = JSON.stringify(current)
    const now = new Date().toISOString()

    const existingDefault = defaultRows()?.[0]
    if (existingDefault) {
      await database.execute(
        "UPDATE display_setting SET settings = ?, updated_at = ? WHERE id = ?",
        [settingsJson, now, existingDefault.id]
      )
    } else {
      const id = generateId()
      const cId = contextId()
      await database.execute(
        `INSERT INTO display_setting (id, workspace_id, user_id, context_type, context_id, settings, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
        [id, wId, contextType(), cId, settingsJson, now, now]
      )
    }
  }

  /** Update a single field in the user's settings and persist */
  function updateSetting<K extends keyof DisplaySettingsValue>(
    key: K,
    value: DisplaySettingsValue[K]
  ) {
    const current = effectiveSettings()
    const updated = { ...current, [key]: value }
    saveUserSettings(updated)
  }

  return {
    settings: effectiveSettings,
    workspaceDefault,
    hasDiverged,
    updateSetting,
    saveUserSettings,
    resetToDefault,
    setDefaultForEveryone,
  }
}
