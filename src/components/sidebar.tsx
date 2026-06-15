'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CheckSquare, CalendarDays, LineChart, Settings, Sun, Moon, MessageSquare } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { PwaInstallButton } from '@/components/pwa-install-button'

const baseNavItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/habits', label: 'Habits Tracker', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/analytics', label: 'Analytics', icon: LineChart },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/contact', label: 'Contact Us', icon: MessageSquare },
]

export function Sidebar() {
  const pathname = usePathname()
  const { setTheme, theme } = useTheme()
  const { user } = useAuth()

  const navItems = user?.email === 'habytflow@gmail.com'
    ? [...baseNavItems, { href: '/admin', label: 'Admin', icon: LayoutDashboard }]
    : baseNavItems

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-background px-4 py-6">
      <div className="flex items-center gap-2 px-2 mb-8 text-emerald-600 dark:text-emerald-400">
        <CheckSquare className="h-6 w-6" />
        <span className="text-2xl font-bold tracking-tighter text-foreground font-panchang">HabytFLow</span>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}>
              <span
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive
                  ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto border-t pt-4">
        <PwaInstallButton />
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? (
            <>
              <Moon className="h-4 w-4" />
              Dark Mode
            </>
          ) : (
            <>
              <Sun className="h-4 w-4" />
              Light Mode
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
