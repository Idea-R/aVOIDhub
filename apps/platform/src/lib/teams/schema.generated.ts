// Generated from the locally verified PostgreSQL schema by supabase/tests/verify-platform-teams.mjs --write-schema.
// Do not edit manually. Table access still requires database grants; these types grant no authority.
export type TeamDatabaseRows = {
  platform_teams: {
    id: string
    name: string
    owner_id: string
    created_at: string
    notes: string
    notes_revision: number
  }
  platform_team_members: {
    team_id: string
    user_id: string
    joined_at: string
  }
  platform_team_invitations: {
    id: string
    team_id: string
    email: string
    token_hash: string
    created_at: string
    expires_at: string
    revoked_at: string | null
    accepted_at: string | null
    accepted_by: string | null
  }
}
