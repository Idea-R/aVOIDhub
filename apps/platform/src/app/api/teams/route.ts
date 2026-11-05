import { createClient } from '@/lib/supabase/server'
import { createTeamsHandlers, unsupportedTeamMethod } from '@/lib/teams/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const { GET, POST } = createTeamsHandlers(createClient)
export const PUT = unsupportedTeamMethod
export const PATCH = unsupportedTeamMethod
export const DELETE = unsupportedTeamMethod
export const HEAD = unsupportedTeamMethod
export const OPTIONS = unsupportedTeamMethod
