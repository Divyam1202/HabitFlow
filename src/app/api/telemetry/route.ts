import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import TelemetryEvent from '@/models/TelemetryEvent'
import { auth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventType, metadata } = await req.json()

    if (!eventType) {
      return NextResponse.json({ error: 'eventType is required' }, { status: 400 })
    }

    await connectToDatabase()

    const newEvent = new TelemetryEvent({
      eventType,
      metadata
    })

    await newEvent.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Telemetry error:', error)
    return NextResponse.json({ error: 'Failed to log telemetry' }, { status: 500 })
  }
}
