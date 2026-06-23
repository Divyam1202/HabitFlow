import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, MessageSquare, Megaphone, BarChart3, Settings, Shield, ArrowLeft, ShieldAlert } from 'lucide-react'

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

  const email = session.user.email
  const role = email === 'habytflow@gmail.com' ? 'SUPER_ADMIN' : (session.user.role || 'USER')

  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    redirect('/')
  }

  return (
    <div className="min-h-screen text-foreground flex flex-col md:flex-row">
      {/* Admin Sidebar Navigation */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col shrink-0 select-none">
        {/* Brand Header */}
        <div className="p-6 border-b border-border flex flex-col items-start gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            <span style={{ fontVariationSettings: '"wdth" 140, "wght" 900' }} className="font-panchang font-black text-sm tracking-widest uppercase">
              Operations
            </span>
          </div>
          <span className="text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 bg-red-500/10 text-red-500 rounded-sm uppercase">
            {role}
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1 font-sans text-sm font-semibold">
          <Link href="/admin" className="flex items-center gap-3 px-4 py-3 hover:bg-muted text-foreground transition-all">
            <LayoutDashboard size={16} className="text-zinc-500" />
            Dashboard
          </Link>
          <Link href="/admin/users" className="flex items-center gap-3 px-4 py-3 hover:bg-muted text-foreground transition-all">
            <Users size={16} className="text-zinc-500" />
            Users
          </Link>
          <Link href="/admin/feedback" className="flex items-center gap-3 px-4 py-3 hover:bg-muted text-foreground transition-all">
            <MessageSquare size={16} className="text-zinc-500" />
            Feedback
          </Link>
          <Link href="/admin/announcements" className="flex items-center gap-3 px-4 py-3 hover:bg-muted text-foreground transition-all">
            <Megaphone size={16} className="text-zinc-500" />
            Announcements
          </Link>
          <Link href="/admin/analytics" className="flex items-center gap-3 px-4 py-3 hover:bg-muted text-foreground transition-all">
            <BarChart3 size={16} className="text-zinc-500" />
            Analytics
          </Link>
          <Link href="/admin/settings" className="flex items-center gap-3 px-4 py-3 hover:bg-muted text-foreground transition-all">
            <Settings size={16} className="text-zinc-500" />
            Settings
          </Link>
          <Link href="/admin/debug" className="flex items-center gap-3 px-4 py-3 hover:bg-muted text-foreground transition-all">
            <ShieldAlert size={16} className="text-zinc-500" />
            Notif Debug
          </Link>

          {/* Super Admin Restricted Sections */}
          {role === 'SUPER_ADMIN' && (
            <>
              <div className="h-px bg-border my-4" />
              <Link href="/admin/audit-logs" className="flex items-center gap-3 px-4 py-3 hover:bg-muted text-foreground transition-all">
                <Shield size={16} className="text-zinc-500" />
                Audit Logs
              </Link>
            </>
          )}
        </nav>

        {/* Exit link */}
        <div className="p-4 border-t border-border">
          <Link href="/" className="flex items-center gap-2 justify-center py-2 text-xs font-bold tracking-widest uppercase text-zinc-500 hover:text-foreground transition-colors group">
            <ArrowLeft size={14} className="transform group-hover:-translate-x-1 transition-transform" /> Exit to App
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-background relative z-10">
        <div className="h-full w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
