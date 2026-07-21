import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { auth } from '@/lib/auth'
import NotificationLog from '@/models/NotificationLog'
import ShadowSendLog from '@/models/ShadowSendLog'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/notifications-diff?days=7
 *
 * Use before advancing CANARY_PERCENT to the next step. Look for:
 *  - v2.errorCount ~ 0
 *  - v2.sent (canary_live cohort) delivered-rate roughly matching v1's
 *  - v2.shadow "would_send" volume roughly matching what v1 actually sent
 *    for the equivalent non-canary population (sanity check the scheduler
 *    logic itself is finding the same due-notifications v1 finds, before
 *    you trust it to send for real).
 */
export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin(req)
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const { searchParams } = new URL(req.url)
    const days = Math.max(1, Math.min(30, parseInt(searchParams.get('days') || '7', 10)))
    const since = new Date(Date.now() - days * 86400000)

    const [v1Delivered, v1Failed, v2ByOutcome] = await Promise.all([
      NotificationLog.countDocuments({ status: 'delivered', createdAt: { $gte: since } }),
      NotificationLog.countDocuments({ status: 'failed', createdAt: { $gte: since } }),
      ShadowSendLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { mode: '$mode', outcome: '$outcome' }, count: { $sum: 1 } } },
      ]),
    ])

    const v2Summary: Record<string, Record<string, number>> = {}
    for (const row of v2ByOutcome) {
      const mode = row._id.mode
      const outcome = row._id.outcome
      v2Summary[mode] = v2Summary[mode] || {}
      v2Summary[mode][outcome] = row.count
    }

    return NextResponse.json({
      windowDays: days,
      canaryPercent: process.env.CANARY_PERCENT || '0',
      v1_legacy: {
        delivered: v1Delivered,
        failed: v1Failed,
      },
      v2_new: v2Summary,
    })
  } catch (error: any) {
    console.error('Error computing notifications diff:', error)
    return NextResponse.json({ error: 'Failed to compute diff' }, { status: 500 })
  }
}
