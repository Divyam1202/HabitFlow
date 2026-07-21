import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isAdminUser } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export default async function DashboardRedirectPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (isAdminUser(session?.user)) {
    redirect('/admin')
  }

  redirect('/')
}
