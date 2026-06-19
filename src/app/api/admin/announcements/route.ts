import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { auth } from '@/lib/auth'
import Announcement from '@/models/Announcement'
import AuditLog from '@/models/AuditLog'

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
    // Both users and admins can fetch announcements (filtered by audience for users)
    const session = await auth.api.getSession({ headers: req.headers })
    const isAdmin = session && (session.user.email === 'habytflow@gmail.com' || ['ADMIN', 'SUPER_ADMIN'].includes(session.user.role || 'USER'))

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
    const adminCheck = await checkAdmin(req)
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
