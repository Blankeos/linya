import { column, Schema, Table } from "@powersync/web"

// ===========================================================================
// PowerSync client schema — intentional subset of the server Postgres schema.
// Table names MUST match the source Postgres table names exactly (singular).
// PowerSync routes synced rows by matching object_type to the schema key.
// Do NOT define the `id` column — PowerSync creates it automatically.
// ===========================================================================

export const AppSchema = new Schema({
  workspace: new Table({
    name: column.text, slug: column.text,
    icon_url: column.text, created_at: column.text, updated_at: column.text,
  }),
  user: new Table({
    email: column.text, username: column.text,
    display_name: column.text, avatar_url: column.text,
    created_at: column.text, updated_at: column.text,
  }),
  workspace_member: new Table({
    workspace_id: column.text, user_id: column.text,
    role: column.text, created_at: column.text,
  }),
  team: new Table({
    workspace_id: column.text, name: column.text,
    identifier: column.text, description: column.text, icon: column.text,
    color: column.text, is_private: column.integer, timezone: column.text,
    parent_team_id: column.text, created_at: column.text, updated_at: column.text,
  }),
  team_member: new Table({
    team_id: column.text, user_id: column.text,
    role: column.text, created_at: column.text,
  }),
  workflow_status: new Table({
    team_id: column.text, name: column.text,
    color: column.text, category: column.text, position: column.real,
    is_default: column.integer, created_at: column.text,
  }),
  label: new Table({
    workspace_id: column.text, team_id: column.text,
    name: column.text, color: column.text, description: column.text,
    parent_label_id: column.text, created_at: column.text,
  }),
  issue: new Table({
    team_id: column.text, number: column.integer,
    title: column.text, description: column.text, description_html: column.text,
    status_id: column.text, priority: column.integer, assignee_id: column.text,
    creator_id: column.text, project_id: column.text, cycle_id: column.text,
    parent_issue_id: column.text, estimate: column.real, due_date: column.text,
    sort_order: column.real, is_triaged: column.integer,
    snoozed_until: column.text, started_at: column.text,
    completed_at: column.text, cancelled_at: column.text,
    created_at: column.text, updated_at: column.text,
  }),
  issue_label: new Table({
    issue_id: column.text, label_id: column.text,
  }),
  issue_relation: new Table({
    issue_id: column.text, related_issue_id: column.text,
    type: column.text, created_at: column.text,
  }),
  comment: new Table({
    issue_id: column.text, user_id: column.text,
    body: column.text, body_html: column.text, parent_comment_id: column.text,
    created_at: column.text, updated_at: column.text,
  }),
  reaction: new Table({
    user_id: column.text, comment_id: column.text,
    issue_id: column.text, emoji: column.text, created_at: column.text,
  }),
  project: new Table({
    workspace_id: column.text, name: column.text,
    description: column.text, icon: column.text, color: column.text,
    status: column.text, lead_id: column.text, start_date: column.text,
    target_date: column.text, sort_order: column.real,
    created_at: column.text, updated_at: column.text,
  }),
  project_member: new Table({
    project_id: column.text, user_id: column.text,
  }),
  project_team: new Table({
    project_id: column.text, team_id: column.text,
  }),
  initiative: new Table({
    workspace_id: column.text, name: column.text,
    description: column.text, icon: column.text, color: column.text,
    status: column.text, owner_id: column.text, target_date: column.text,
    sort_order: column.real, created_at: column.text, updated_at: column.text,
  }),
  initiative_project: new Table({
    initiative_id: column.text, project_id: column.text,
  }),
  cycle: new Table({
    team_id: column.text, number: column.integer,
    name: column.text, start_date: column.text, end_date: column.text,
    is_active: column.integer, created_at: column.text, updated_at: column.text,
  }),
  custom_view: new Table({
    workspace_id: column.text, team_id: column.text,
    creator_id: column.text, name: column.text, description: column.text,
    icon: column.text, type: column.text, filters: column.text,
    display_options: column.text, sort_order: column.real,
    is_shared: column.integer, created_at: column.text, updated_at: column.text,
  }),
  favorite: new Table({
    user_id: column.text, workspace_id: column.text,
    target_type: column.text, target_id: column.text, sort_order: column.real,
    created_at: column.text,
  }),
  notification: new Table({
    user_id: column.text, workspace_id: column.text,
    type: column.text, issue_id: column.text, comment_id: column.text,
    actor_id: column.text, data: column.text, read_at: column.text,
    archived_at: column.text, snoozed_until: column.text, created_at: column.text,
  }),
  document: new Table({
    workspace_id: column.text, project_id: column.text,
    creator_id: column.text, title: column.text, content: column.text,
    content_html: column.text, icon: column.text, sort_order: column.real,
    created_at: column.text, updated_at: column.text,
  }),
  customer: new Table({
    workspace_id: column.text, name: column.text,
    email: column.text, domain: column.text, external_id: column.text,
    metadata: column.text, created_at: column.text, updated_at: column.text,
  }),
  customer_request: new Table({
    customer_id: column.text, issue_id: column.text,
    body: column.text, source: column.text, created_at: column.text,
  }),
  sidebar_item: new Table({
    user_id: column.text, workspace_id: column.text,
    section: column.text, target_type: column.text, target_id: column.text,
    sort_order: column.real, is_collapsed: column.integer, created_at: column.text,
  }),
  issue_template: new Table({
    team_id: column.text, name: column.text,
    description: column.text, template_data: column.text,
    created_at: column.text, updated_at: column.text,
  }),
})

export type Database = (typeof AppSchema)["types"]
