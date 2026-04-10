import { column, Schema, Table } from "@powersync/web"

// ===========================================================================
// PowerSync client schema — intentional subset of the server Postgres schema.
// Only include tables that need local-first/offline access on the client.
// Server-only data (secrets, refresh tokens, webhooks, api_keys, integrations,
// passkeys, one_time_tokens) should NOT appear here.
// ===========================================================================

export const AppSchema = new Schema({
  workspaces: new Table({
    id: column.text, name: column.text, slug: column.text,
    icon_url: column.text, created_at: column.text, updated_at: column.text,
  }),
  users: new Table({
    id: column.text, email: column.text, username: column.text,
    display_name: column.text, avatar_url: column.text,
    created_at: column.text, updated_at: column.text,
  }),
  workspace_members: new Table({
    id: column.text, workspace_id: column.text, user_id: column.text,
    role: column.text, created_at: column.text,
  }),
  teams: new Table({
    id: column.text, workspace_id: column.text, name: column.text,
    identifier: column.text, description: column.text, icon: column.text,
    color: column.text, is_private: column.integer, timezone: column.text,
    parent_team_id: column.text, created_at: column.text, updated_at: column.text,
  }),
  team_members: new Table({
    id: column.text, team_id: column.text, user_id: column.text,
    role: column.text, created_at: column.text,
  }),
  workflow_statuses: new Table({
    id: column.text, team_id: column.text, name: column.text,
    color: column.text, category: column.text, position: column.real,
    is_default: column.integer, created_at: column.text,
  }),
  labels: new Table({
    id: column.text, workspace_id: column.text, team_id: column.text,
    name: column.text, color: column.text, description: column.text,
    parent_label_id: column.text, created_at: column.text,
  }),
  issues: new Table({
    id: column.text, team_id: column.text, number: column.integer,
    title: column.text, description: column.text, description_html: column.text,
    status_id: column.text, priority: column.integer, assignee_id: column.text,
    creator_id: column.text, project_id: column.text, cycle_id: column.text,
    parent_issue_id: column.text, estimate: column.real, due_date: column.text,
    sort_order: column.real, is_triaged: column.integer,
    snoozed_until: column.text, started_at: column.text,
    completed_at: column.text, cancelled_at: column.text,
    created_at: column.text, updated_at: column.text,
  }),
  issue_labels: new Table({
    id: column.text, issue_id: column.text, label_id: column.text,
  }),
  issue_relations: new Table({
    id: column.text, issue_id: column.text, related_issue_id: column.text,
    type: column.text, created_at: column.text,
  }),
  comments: new Table({
    id: column.text, issue_id: column.text, user_id: column.text,
    body: column.text, body_html: column.text, parent_comment_id: column.text,
    created_at: column.text, updated_at: column.text,
  }),
  reactions: new Table({
    id: column.text, user_id: column.text, comment_id: column.text,
    issue_id: column.text, emoji: column.text, created_at: column.text,
  }),
  issue_history: new Table({
    id: column.text, issue_id: column.text, user_id: column.text,
    field: column.text, old_value: column.text, new_value: column.text,
    created_at: column.text,
  }),
  projects: new Table({
    id: column.text, workspace_id: column.text, name: column.text,
    description: column.text, icon: column.text, color: column.text,
    status: column.text, lead_id: column.text, start_date: column.text,
    target_date: column.text, sort_order: column.real,
    created_at: column.text, updated_at: column.text,
  }),
  project_members: new Table({
    id: column.text, project_id: column.text, user_id: column.text,
  }),
  project_teams: new Table({
    id: column.text, project_id: column.text, team_id: column.text,
  }),
  initiatives: new Table({
    id: column.text, workspace_id: column.text, name: column.text,
    description: column.text, icon: column.text, color: column.text,
    status: column.text, owner_id: column.text, target_date: column.text,
    sort_order: column.real, created_at: column.text, updated_at: column.text,
  }),
  initiative_projects: new Table({
    id: column.text, initiative_id: column.text, project_id: column.text,
  }),
  cycles: new Table({
    id: column.text, team_id: column.text, number: column.integer,
    name: column.text, start_date: column.text, end_date: column.text,
    is_active: column.integer, created_at: column.text, updated_at: column.text,
  }),
  custom_views: new Table({
    id: column.text, workspace_id: column.text, team_id: column.text,
    creator_id: column.text, name: column.text, description: column.text,
    icon: column.text, type: column.text, filters: column.text,
    display_options: column.text, sort_order: column.real,
    is_shared: column.integer, created_at: column.text, updated_at: column.text,
  }),
  favorites: new Table({
    id: column.text, user_id: column.text, workspace_id: column.text,
    target_type: column.text, target_id: column.text, sort_order: column.real,
    created_at: column.text,
  }),
  notifications: new Table({
    id: column.text, user_id: column.text, workspace_id: column.text,
    type: column.text, issue_id: column.text, comment_id: column.text,
    actor_id: column.text, data: column.text, read_at: column.text,
    archived_at: column.text, snoozed_until: column.text, created_at: column.text,
  }),
  documents: new Table({
    id: column.text, workspace_id: column.text, project_id: column.text,
    creator_id: column.text, title: column.text, content: column.text,
    content_html: column.text, icon: column.text, sort_order: column.real,
    created_at: column.text, updated_at: column.text,
  }),
  customers: new Table({
    id: column.text, workspace_id: column.text, name: column.text,
    email: column.text, domain: column.text, external_id: column.text,
    metadata: column.text, created_at: column.text, updated_at: column.text,
  }),
  customer_requests: new Table({
    id: column.text, customer_id: column.text, issue_id: column.text,
    body: column.text, source: column.text, created_at: column.text,
  }),
  sidebar_items: new Table({
    id: column.text, user_id: column.text, workspace_id: column.text,
    section: column.text, target_type: column.text, target_id: column.text,
    sort_order: column.real, is_collapsed: column.integer, created_at: column.text,
  }),
  issue_templates: new Table({
    id: column.text, team_id: column.text, name: column.text,
    description: column.text, template_data: column.text,
    created_at: column.text, updated_at: column.text,
  }),
})

export type Database = (typeof AppSchema)["types"]
