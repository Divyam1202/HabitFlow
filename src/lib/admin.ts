export const ADMIN_EMAIL = 'habytflow@gmail.com'
export const ADMIN_REDIRECT_PATH = '/admin'

type AdminLikeUser = {
  email?: string | null
  role?: string | null
}

export function isAdminEmail(email?: string | null) {
  return typeof email === 'string' && email.toLowerCase() === ADMIN_EMAIL
}

export function getAdminRole(user?: AdminLikeUser | null) {
  if (!user) return 'USER'
  if (isAdminEmail(user.email)) return 'SUPER_ADMIN'
  return user.role || 'USER'
}

export function isAdminRole(role?: string | null) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

export function isAdminUser(user?: AdminLikeUser | null) {
  return isAdminRole(getAdminRole(user))
}

type AdminSessionLike = {
  user?: AdminLikeUser | null
}

export function isAdminSession(session?: AdminSessionLike | null) {
  return !!session?.user && isAdminUser(session.user)
}
