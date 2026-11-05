import { z } from 'zod'
import type { TeamDatabaseRows } from './schema.generated'

const teamId = z.uuid()
export const teamActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: z.string().trim().min(2).max(80) }).strict(),
  z.object({ action: z.literal('invite'), teamId, email: z.email().trim().max(254).transform(value => value.toLowerCase()) }).strict(),
  z.object({ action: z.literal('revoke'), teamId, invitationId: z.uuid() }).strict(),
  z.object({ action: z.literal('accept'), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict(),
  z.object({ action: z.literal('remove'), teamId, memberId: z.uuid() }).strict(),
  z.object({ action: z.literal('leave'), teamId }).strict(),
  z.object({ action: z.literal('save-notes'), teamId, notes: z.string().max(2000).refine(value => !value.includes('\0')), expectedRevision: z.number().int().min(0).max(2147483647) }).strict(),
])

export type TeamAction = z.infer<typeof teamActionSchema>
export type TeamMember = Omit<TeamDatabaseRows['platform_team_members'], 'team_id'> & { role: 'owner' | 'member' }
export type TeamInvitation = Omit<TeamDatabaseRows['platform_team_invitations'], 'team_id' | 'token_hash' | 'accepted_by'>
export type Team = TeamDatabaseRows['platform_teams'] & { members: TeamMember[]; invitations: TeamInvitation[] }
export type TeamsSnapshot = { userId: string; teams: Team[] }
