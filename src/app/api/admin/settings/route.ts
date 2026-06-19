import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { auth } from '@/lib/auth'
import AdminSetting from '@/models/AdminSetting'
import AuditLog from '@/models/AuditLog'

export const dynamic = 'force-dynamic'

async function checkSuperAdmin(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session || !session.user) return null
  const email = session.user.email
  const role = email === 'habytflow@gmail.com' ? 'SUPER_ADMIN' : (session.user.role || 'USER')
  if (role === 'SUPER_ADMIN') {
    return { user: session.user }
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    // Both ADMIN and SUPER_ADMIN can view settings
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const email = session.user.email
    const role = email === 'habytflow@gmail.com' ? 'SUPER_ADMIN' : (session.user.role || 'USER')
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    let settings = await AdminSetting.findOne().lean()
    
    // Create default settings if not exists
    if (!settings) {
      settings = await AdminSetting.create({
        siteName: 'HabytFlow',
        supportEmail: 'habytflow+support@gmail.com',
        version: '1.0.0',
        allowRegistration: true,
        maintenanceMode: false,
        privacyPolicyUrl: '/about/privacy',
        termsUrl: '/about/terms'
      })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await checkSuperAdmin(req)
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized: Requires Super Admin privileges' }, { status: 403 })
    }

    const body = await req.json()
    const { siteName, supportEmail, version, allowRegistration, maintenanceMode, privacyPolicyUrl, termsUrl } = body

    await connectToDatabase()
    
    const settings = await AdminSetting.findOneAndUpdate(
      {},
      {
        siteName,
        supportEmail,
        version,
        allowRegistration,
        maintenanceMode,
        privacyPolicyUrl,
        termsUrl
      },
      { upsert: true, new: true }
    )

    await AuditLog.create({
      adminId: adminCheck.user.id,
      adminEmail: adminCheck.user.email,
      action: 'SETTINGS_CHANGED',
      details: `Updated general settings (Site Name: ${siteName}, Maintenance Mode: ${maintenanceMode})`
    })

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
