import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import Notification from '@/models/Notification'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const CATEGORY_FILTERS = ['health', 'career', 'growth', 'spiritual', 'home']

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const filter = searchParams.get('filter') || 'all'
    const stats  = searchParams.get('stats') === 'true'

    await connectToDatabase()

    // Stats mode — for analytics
    if (stats) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const records = await Notification.find({
        userId: session.user.id,
        createdAt: { $gte: sevenDaysAgo }
      }).lean()

      // Group by habitId
      const byHabit: Record<string, any> = {}
      for (const r of records) {
        const key = r.habitId
        if (!byHabit[key]) {
          byHabit[key] = { habitId: key, habitName: r.habitName, category: r.category, delivered: 0, opened: 0, completed: 0, skipped: 0, snoozed: 0 }
        }
        byHabit[key].delivered++
        if (r.status === 'opened')    byHabit[key].opened++
        if (r.status === 'completed') byHabit[key].completed++
        if (r.status === 'skipped')   byHabit[key].skipped++
        if (r.status === 'snoozed')   byHabit[key].snoozed++
      }

      return NextResponse.json({ stats: Object.values(byHabit) })
    }

    // Notification Center mode — last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const query: any = {
      userId: session.user.id,
      createdAt: { $gte: sevenDaysAgo }
    }

    if (filter === 'unread') {
      query.status = { $in: ['delivered', 'pending'] }
    } else if (CATEGORY_FILTERS.includes(filter)) {
      query.category = filter
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    // Unread count (for badge) — always computed across all categories
    const unreadCount = await Notification.countDocuments({
      userId: session.user.id,
      status: { $in: ['delivered', 'pending'] },
      createdAt: { $gte: sevenDaysAgo }
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error: any) {
    console.error('GET /api/notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
