import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { auth } from '@/lib/auth'
import NotificationLog from '@/models/NotificationLog'

export const dynamic = 'force-dynamic'

async function checkAdmin(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session || !session.user) return null
  const email = session.user.email
  const role = email === 'habytflow@gmail.com' ? 'SUPER_ADMIN' : (session.user.role || 'USER')
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return { user: session.user, role }
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await checkAdmin(req)
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') // e.g. "failed", "delivered", "pending", "today", "last24h"
    const search = searchParams.get('search') // e.g. habitName or userId

    const query: any = {}

    if (search) {
      query.$or = [
        { habitName: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } }
      ]
    }

    if (statusFilter) {
      if (statusFilter === 'failed') {
        query.status = 'failed'
      } else if (statusFilter === 'delivered') {
        query.status = 'delivered'
      } else if (statusFilter === 'pending') {
        query.status = { $in: ['scheduled', 'evaluated', 'triggered', 'sent'] }
      } else if (statusFilter === 'today') {
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        query.createdAt = { $gte: startOfToday }
      } else if (statusFilter === 'last24h') {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
        query.createdAt = { $gte: last24h }
      } else {
        query.status = statusFilter
      }
    }

    const logs = await NotificationLog.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()

    return NextResponse.json({ logs })
  } catch (error: any) {
    console.error('Error fetching notification logs:', error)
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
  }
}
