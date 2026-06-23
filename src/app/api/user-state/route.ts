import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { connectToDatabase } from '@/lib/db'
import UserState from '@/models/UserState'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    
    const userState = await UserState.findOne({ userId: session.user.id })
    
    if (!userState) {
      return NextResponse.json({ stateData: null, timezone: null })
    }
    
    return NextResponse.json({ stateData: userState.stateData, timezone: userState.timezone || 'Asia/Kolkata' })
  } catch (error) {
    console.error('Error fetching user state:', error)
    return NextResponse.json({ error: 'Failed to fetch user state' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stateData, timezone } = await req.json()

    if (!stateData) {
      return NextResponse.json({ error: 'stateData is required' }, { status: 400 })
    }

    await connectToDatabase()
    
    const updateFields: any = { stateData }
    if (timezone) {
      updateFields.timezone = timezone
    }

    // Upsert the user state
    await UserState.findOneAndUpdate(
      { userId: session.user.id },
      { $set: updateFields },
      { upsert: true, returnDocument: 'after' }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving user state:', error)
    return NextResponse.json({ error: 'Failed to save user state' }, { status: 500 })
  }
}
