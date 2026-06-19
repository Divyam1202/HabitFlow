import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { auth } from '@/lib/auth'
import Feedback from '@/models/Feedback'

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
    const feedbackList = await Feedback.find().sort({ createdAt: -1 }).lean()

    const formattedFeedback = feedbackList.map((f: any) => ({
      id: f._id.toString(),
      email: f.email,
      type: f.type,
      message: f.message,
      status: f.status,
      createdAt: f.createdAt
    }))

    return NextResponse.json({ feedback: formattedFeedback })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const adminCheck = await checkAdmin(req)
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { feedbackId, status } = await req.json()
    if (!feedbackId || !status) {
      return NextResponse.json({ error: 'Feedback ID and Status are required' }, { status: 400 })
    }

    if (!['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    await connectToDatabase()
    const updatedFeedback = await Feedback.findByIdAndUpdate(
      feedbackId,
      { status },
      { new: true }
    )

    if (!updatedFeedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, feedback: updatedFeedback })
  } catch (error) {
    console.error('Error updating feedback:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Allow users to submit feedback tickets directly
export async function POST(req: NextRequest) {
  try {
    const { email, type, message } = await req.json()
    if (!email || !type || !message) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (!['BUG_REPORT', 'FEATURE_REQUEST', 'GENERAL_FEEDBACK'].includes(type)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 })
    }

    await connectToDatabase()
    const feedback = await Feedback.create({
      email,
      type,
      message,
      status: 'OPEN'
    })

    return NextResponse.json({ success: true, feedback })
  } catch (error) {
    console.error('Error submitting feedback:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
