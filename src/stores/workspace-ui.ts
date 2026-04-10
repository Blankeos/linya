/**
 * Module-level signals for workspace-wide UI actions.
 * Used to trigger modals from child pages (e.g., projects page → new project modal in layout).
 */
import { createSignal } from "solid-js"

export const [newProjectOpen, setNewProjectOpen] = createSignal(false)
