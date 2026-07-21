import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAdminRole, isAdminUser } from '@/lib/admin'
import { AdminShell } from '@/components/admin/admin-shell'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session || !session.user) {
    redirect('/')
  }

  const role = getAdminRole(session.user) as 'USER' | 'ADMIN' | 'SUPER_ADMIN'

  if (!isAdminUser(session.user)) {
    redirect('/')
  }

  return (
    <AdminShell role={role}>{children}</AdminShell>
  )
}
