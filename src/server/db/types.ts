import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type ApiKey = {
    id: string;
    workspace_id: string;
    user_id: string;
    name: string;
    key_hash: string;
    last_used_at: Timestamp | null;
    expires_at: Timestamp | null;
    created_at: Generated<Timestamp>;
};
export type Attachment = {
    id: string;
    issue_id: string | null;
    comment_id: string | null;
    uploader_id: string;
    filename: string;
    content_type: string;
    size_bytes: string;
    storage_key: string;
    storage_type: Generated<string>;
    created_at: Generated<Timestamp>;
};
export type Comment = {
    id: string;
    issue_id: string;
    user_id: string;
    body: string;
    body_html: string | null;
    parent_comment_id: string | null;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type Customer = {
    id: string;
    workspace_id: string;
    name: string;
    email: string | null;
    domain: string | null;
    external_id: string | null;
    metadata: Generated<unknown | null>;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type CustomerRequest = {
    id: string;
    customer_id: string;
    issue_id: string;
    body: string | null;
    source: string | null;
    created_at: Generated<Timestamp>;
};
export type CustomView = {
    id: string;
    workspace_id: string;
    team_id: string | null;
    creator_id: string;
    name: string;
    description: string | null;
    icon: string | null;
    type: Generated<string>;
    filters: Generated<unknown>;
    display_options: Generated<unknown>;
    sort_order: number;
    is_shared: Generated<boolean>;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type Cycle = {
    id: string;
    team_id: string;
    number: number;
    name: string | null;
    start_date: Timestamp;
    end_date: Timestamp;
    is_active: Generated<boolean>;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type DisplaySetting = {
    id: string;
    workspace_id: string;
    user_id: string | null;
    context_type: string;
    context_id: string | null;
    settings: Generated<unknown>;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type Document = {
    id: string;
    workspace_id: string;
    project_id: string | null;
    creator_id: string;
    title: string;
    content: string | null;
    content_html: string | null;
    icon: string | null;
    sort_order: number;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type Favorite = {
    id: string;
    user_id: string;
    workspace_id: string;
    target_type: string;
    target_id: string;
    sort_order: number;
    created_at: Generated<Timestamp>;
};
export type GithubIssueLink = {
    id: string;
    issue_id: string;
    integration_id: string;
    github_repo: string;
    github_pr_number: number | null;
    github_issue_number: number | null;
    github_branch: string | null;
    status: string | null;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type Initiative = {
    id: string;
    workspace_id: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    status: Generated<string>;
    owner_id: string | null;
    target_date: Timestamp | null;
    sort_order: number;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type InitiativeProject = {
    id: string;
    initiative_id: string;
    project_id: string;
};
export type Integration = {
    id: string;
    workspace_id: string;
    type: string;
    config: Generated<unknown>;
    access_token: string | null;
    refresh_token: string | null;
    enabled: Generated<boolean>;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type Issue = {
    id: string;
    team_id: string;
    number: number;
    title: string;
    description: string | null;
    description_html: string | null;
    status_id: string;
    priority: Generated<number>;
    assignee_id: string | null;
    creator_id: string;
    project_id: string | null;
    cycle_id: string | null;
    parent_issue_id: string | null;
    estimate: number | null;
    due_date: Timestamp | null;
    sort_order: number;
    is_triaged: Generated<boolean>;
    snoozed_until: Timestamp | null;
    started_at: Timestamp | null;
    completed_at: Timestamp | null;
    cancelled_at: Timestamp | null;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type IssueHistory = {
    id: string;
    issue_id: string;
    user_id: string | null;
    field: string;
    old_value: string | null;
    new_value: string | null;
    created_at: Generated<Timestamp>;
};
export type IssueLabel = {
    id: string;
    issue_id: string;
    label_id: string;
};
export type IssueRelation = {
    id: string;
    issue_id: string;
    related_issue_id: string;
    type: string;
    created_at: Generated<Timestamp>;
};
export type IssueSubscriber = {
    id: string;
    issue_id: string;
    user_id: string;
};
export type IssueTemplate = {
    id: string;
    team_id: string;
    name: string;
    description: string | null;
    template_data: unknown;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type Label = {
    id: string;
    workspace_id: string | null;
    team_id: string | null;
    name: string;
    color: string;
    description: string | null;
    parent_label_id: string | null;
    created_at: Generated<Timestamp>;
};
export type Notification = {
    id: string;
    user_id: string;
    workspace_id: string;
    type: string;
    issue_id: string | null;
    comment_id: string | null;
    actor_id: string | null;
    data: unknown | null;
    read_at: Timestamp | null;
    archived_at: Timestamp | null;
    snoozed_until: Timestamp | null;
    created_at: Generated<Timestamp>;
};
export type OAuthAccount = {
    provider_id: string;
    provider_user_id: string;
    user_id: string;
};
export type OneTimeToken = {
    token: string;
    code: string | null;
    expires_at: Timestamp;
    identifier: string;
    purpose: string;
    metadata: unknown | null;
};
export type Passkey = {
    id: string;
    user_id: string;
    credential_id: string;
    public_key: Buffer;
    counter: Generated<string>;
    name: string | null;
    created_at: Generated<Timestamp>;
};
export type Project = {
    id: string;
    workspace_id: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    status: Generated<string>;
    lead_id: string | null;
    start_date: Timestamp | null;
    target_date: Timestamp | null;
    sort_order: number;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type ProjectMember = {
    id: string;
    project_id: string;
    user_id: string;
};
export type ProjectMilestone = {
    id: string;
    project_id: string;
    name: string;
    description: string | null;
    target_date: Timestamp | null;
    sort_order: number;
    created_at: Generated<Timestamp>;
};
export type ProjectTeam = {
    id: string;
    project_id: string;
    team_id: string;
};
export type ProjectUpdate = {
    id: string;
    project_id: string;
    user_id: string;
    body: string;
    health: Generated<string>;
    created_at: Generated<Timestamp>;
};
export type Reaction = {
    id: string;
    user_id: string;
    comment_id: string | null;
    issue_id: string | null;
    emoji: string;
    created_at: Generated<Timestamp>;
};
export type RefreshToken = {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Timestamp;
    revoked_at: Timestamp | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Generated<Timestamp>;
};
export type SidebarItem = {
    id: string;
    user_id: string;
    workspace_id: string;
    section: string;
    target_type: string;
    target_id: string;
    sort_order: number;
    is_collapsed: Generated<boolean>;
    created_at: Generated<Timestamp>;
};
export type Team = {
    id: string;
    workspace_id: string;
    name: string;
    identifier: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    is_private: Generated<boolean>;
    timezone: Generated<string | null>;
    parent_team_id: string | null;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type TeamMember = {
    id: string;
    team_id: string;
    user_id: string;
    role: Generated<string>;
    created_at: Generated<Timestamp>;
};
export type User = {
    id: string;
    email: string;
    email_verified: Generated<boolean>;
    password_hash: string;
    display_name: Generated<string>;
    avatar_url: string | null;
    metadata: unknown | null;
    joined_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type Webhook = {
    id: string;
    workspace_id: string;
    url: string;
    secret: string;
    events: string[];
    enabled: Generated<boolean>;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type WorkflowStatus = {
    id: string;
    team_id: string;
    name: string;
    color: string;
    category: string;
    position: number;
    is_default: Generated<boolean>;
    created_at: Generated<Timestamp>;
};
export type Workspace = {
    id: string;
    name: string;
    slug: string;
    icon_url: string | null;
    owner_id: string;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type WorkspaceMember = {
    id: string;
    workspace_id: string;
    user_id: string;
    role: Generated<string>;
    created_at: Generated<Timestamp>;
};
export type DB = {
    api_key: ApiKey;
    attachment: Attachment;
    comment: Comment;
    custom_view: CustomView;
    customer: Customer;
    customer_request: CustomerRequest;
    cycle: Cycle;
    display_setting: DisplaySetting;
    document: Document;
    favorite: Favorite;
    github_issue_link: GithubIssueLink;
    initiative: Initiative;
    initiative_project: InitiativeProject;
    integration: Integration;
    issue: Issue;
    issue_history: IssueHistory;
    issue_label: IssueLabel;
    issue_relation: IssueRelation;
    issue_subscriber: IssueSubscriber;
    issue_template: IssueTemplate;
    label: Label;
    notification: Notification;
    oauth_account: OAuthAccount;
    onetime_token: OneTimeToken;
    passkey: Passkey;
    project: Project;
    project_member: ProjectMember;
    project_milestone: ProjectMilestone;
    project_team: ProjectTeam;
    project_update: ProjectUpdate;
    reaction: Reaction;
    refresh_token: RefreshToken;
    sidebar_item: SidebarItem;
    team: Team;
    team_member: TeamMember;
    user: User;
    webhook: Webhook;
    workflow_status: WorkflowStatus;
    workspace: Workspace;
    workspace_member: WorkspaceMember;
};
