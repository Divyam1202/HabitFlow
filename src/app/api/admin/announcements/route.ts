import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { auth } from '@/lib/auth'
import Announcement from '@/models/Announcement'
import AuditLog from '@/models/AuditLog'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Both users and admins can fetch announcements (filtered by audience for users)
    const session = await auth.api.getSession({ headers: req.headers })
    const isAdmin = !!session?.user && session.user.email?.toLowerCase() === 'habytflow@gmail.com'

    await connectToDatabase()

    let announcements;
    if (isAdmin) {
      // Admins see all announcements
      announcements = await Announcement.find().sort({ createdAt: -1 }).lean()
    } else {
      // General users only see general announcements
      announcements = await Announcement.find({ audience: 'ALL_USERS' }).sort({ createdAt: -1 }).lean()
    }

    const formatted = announcements.map((a: any) => ({
      id: a._id.toString(),
      title: a.title,
      message: a.message,
      type: a.type,
      audience: a.audience,
      createdAt: a.createdAt
    }))

    return NextResponse.json({ announcements: formatted })
  } catch (error) {
    console.error('Error fetching announcements:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin(req)
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, message, type, audience } = await req.json()
    if (!title || !message || !type || !audience) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (!['NEW_FEATURE', 'MAINTENANCE', 'BUG_FIXES', 'UPDATE_NOTES'].includes(type)) {
      return NextResponse.json({ error: 'Invalid announcement type' }, { status: 400 })
    }

    if (!['ALL_USERS', 'PREMIUM_USERS', 'INACTIVE_USERS'].includes(audience)) {
      return NextResponse.json({ error: 'Invalid audience segment' }, { status: 400 })
    }

    await connectToDatabase()
    const announcement = await Announcement.create({
      title,
      message,
      type,
      audience,
      createdById: adminCheck.user.id
    })

    await AuditLog.create({
      adminId: adminCheck.user.id,
      adminEmail: adminCheck.user.email,
      action: 'ANNOUNCEMENT_PUBLISHED',
      details: `Published announcement: "${title}" for audience: ${audience}`
    })

    return NextResponse.json({ success: true, announcement })
  } catch (error) {
    console.error('Error creating announcement:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
