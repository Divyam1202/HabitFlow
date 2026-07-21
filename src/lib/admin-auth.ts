import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getAdminRole, isAdminRole } from '@/lib/admin'

export async function requireAdmin(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user) return null

  const role = getAdminRole(session.user)
  if (!isAdminRole(role)) return null

  return { user: session.user, role }
}

export async function requireSuperAdmin(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin || admin.role !== 'SUPER_ADMIN') return null
  return admin
}
