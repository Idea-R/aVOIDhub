import { NextResponse, type NextRequest } from 'next/server'
import { getRequestUser } from '@/lib/auth/request-user'
import { getSiteUrl } from '@/lib/env'
import { hasAllowedWriteOrigin } from '@/lib/http/same-origin'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  if (!hasAllowedWriteOrigin(request)) return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 })
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 })

  const { data, error } = await createAdminClient()
    .from('billing_accounts')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !data?.stripe_customer_id) {
    return NextResponse.json({ error: 'billing_account_not_found' }, { status: 404 })
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${getSiteUrl(request.url)}/account/`,
  })
  return NextResponse.json({ url: session.url })
}

