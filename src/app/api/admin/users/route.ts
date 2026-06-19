import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { auth } from '@/lib/auth'
import mongoose from 'mongoose'
import AuditLog from '@/models/AuditLog'
import { ObjectId } from 'mongodb'

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
    const db = mongoose.connection.db
    if (!db) throw new Error("No database connection")

    const users = await db.collection('user').find().sort({ createdAt: -1 }).toArray()

    // Map database fields safely
    const formattedUsers = users.map(u => ({
      id: u._id.toString(),
      name: u.name || 'Anonymous',
      email: u.email,
      createdAt: u.createdAt,
      role: u.email === 'habytflow@gmail.com' ? 'SUPER_ADMIN' : (u.role || 'USER'),
      status: u.status || 'active',
      plan: u.plan || 'Free',
      lastActive: u.lastActive || u.updatedAt || u.createdAt
    }))

    return NextResponse.json({ users: formattedUsers })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await checkAdmin(req)
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, userId, targetRole } = await req.json()
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    await connectToDatabase()
    const db = mongoose.connection.db
    if (!db) throw new Error("No database connection")

    const targetUser = await db.collection('user').findOne({ _id: new ObjectId(userId) })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Role-based safeguard
    if (targetUser.email === 'habytflow@gmail.com') {
      return NextResponse.json({ error: 'Cannot modify Super Admin account' }, { status: 403 })
    }

    if (action === 'SUSPEND') {
      const newStatus = targetUser.status === 'suspended' ? 'active' : 'suspended'
      await db.collection('user').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { status: newStatus } }
      )

      await AuditLog.create({
        adminId: adminCheck.user.id,
        adminEmail: adminCheck.user.email,
        action: newStatus === 'suspended' ? 'USER_SUSPENDED' : 'USER_UNSUSPENDED',
        details: `${newStatus === 'suspended' ? 'Suspended' : 'Unsuspended'} user ${targetUser.email}`
      })

      return NextResponse.json({ success: true, status: newStatus })
    }

    if (action === 'DELETE') {
      // Super Admin only check
      if (adminCheck.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Only Super Admins can delete users' }, { status: 403 })
      }

      await db.collection('user').deleteOne({ _id: new ObjectId(userId) })
      // Clean up sessions and accounts too
      await db.collection('session').deleteMany({ userId: userId })
      await db.collection('account').deleteMany({ userId: userId })

      await AuditLog.create({
        adminId: adminCheck.user.id,
        adminEmail: adminCheck.user.email,
        action: 'USER_DELETED',
        details: `Deleted user ${targetUser.email} and cleared associated sessions/accounts`
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'UPDATE_ROLE') {
      if (adminCheck.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Only Super Admins can update roles' }, { status: 403 })
      }
      if (!['USER', 'ADMIN', 'SUPER_ADMIN'].includes(targetRole)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }

      await db.collection('user').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { role: targetRole } }
      )

      await AuditLog.create({
        adminId: adminCheck.user.id,
        adminEmail: adminCheck.user.email,
        action: 'SETTINGS_CHANGED',
        details: `Updated role of user ${targetUser.email} to ${targetRole}`
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'RESET_PASSWORD') {
      // Mock/Initialize a password reset action or set standard reset flag
      await db.collection('user').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { requiresPasswordReset: true } }
      )

      await AuditLog.create({
        adminId: adminCheck.user.id,
        adminEmail: adminCheck.user.email,
        action: 'SETTINGS_CHANGED',
        details: `Flagged user ${targetUser.email} for password reset`
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error performing admin user action:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
