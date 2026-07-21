'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, LayoutDashboard, Megaphone, MessageSquare, Settings, Shield, ShieldAlert, Users } from 'lucide-react'

import { cn } from '@/lib/utils'

type AdminShellProps = {
  children: React.ReactNode
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
}

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
}

const primaryNav: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
  { href: '/admin/users', label: 'Users', icon: <Users size={15} /> },
  { href: '/admin/feedback', label: 'Feedback', icon: <MessageSquare size={15} /> },
  { href: '/admin/announcements', label: 'Announcements', icon: <Megaphone size={15} /> },
  { href: '/admin/analytics', label: 'Analytics', icon: <BarChart3 size={15} /> },
  { href: '/admin/settings', label: 'Settings', icon: <Settings size={15} /> },
  { href: '/admin/debug', label: 'Debug', icon: <ShieldAlert size={15} /> },
]

const superAdminNav: NavItem[] = [
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: <Shield size={15} /> },
]

function isActiveRoute(pathname: string | null, href: string) {
  if (!pathname) return false
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function AdminNavLink({ href, label, icon, pathname }: NavItem & { pathname: string | null }) {
  const active = isActiveRoute(pathname, href)

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-all duration-150',
        active
          ? 'bg-white/6 text-white ring-1 ring-white/8'
          : 'text-zinc-400 hover:bg-white/[0.03] hover:text-white'
      )}
    >
      <span className={cn('transition-colors', active ? 'text-white' : 'text-zinc-500 group-hover:text-white')}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" /> : null}
    </Link>
  )
}

export function AdminShell({ children, role }: AdminShellProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b border-white/5 bg-zinc-950/90 md:border-b-0 md:border-r md:border-white/5">
        <div className="px-6 pb-8 pt-6">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold uppercase tracking-[0.26em] text-white">
              HABYTFLOW
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.34em] text-zinc-500">
              Administration
            </div>
            <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-500/70">
              SUPER ADMIN
            </div>
          </div>
        </div>

        <div className="px-4 pb-6">
          <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-600">
            Console
          </div>
          <nav className="space-y-1">
            {primaryNav.map((item) => (
              <AdminNavLink key={item.href} {...item} pathname={pathname} />
            ))}
          </nav>

          {role === 'SUPER_ADMIN' ? (
            <div className="mt-8">
              <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-600">
                Super Admin
              </div>
              <nav className="space-y-1">
                {superAdminNav.map((item) => (
                  <AdminNavLink key={item.href} {...item} pathname={pathname} />
                ))}
              </nav>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="min-w-0 bg-background">
        {children}
      </main>
    </div>
  )
}
