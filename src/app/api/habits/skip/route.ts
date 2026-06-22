import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import TelemetryEvent from '@/models/TelemetryEvent'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { habitId, habitName, category } = await req.json()

    await connectToDatabase()

    const skipEvent = new TelemetryEvent({
      eventType: 'notification_skipped',
      metadata: {
        habitName: habitName || `Habit #${habitId}`,
        category: category || 'growth'
      }
    })
    await skipEvent.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error logging native notification skip:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
