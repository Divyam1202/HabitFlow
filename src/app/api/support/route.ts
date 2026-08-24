import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import Feedback from '@/models/Feedback'
import { auth } from '@/lib/auth'
import { supportAlertEmailHtml } from '@/lib/email-templates'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { email, message, type } = await req.json()
    const supportType: 'issue' | 'feature_request' = type === 'feature_request' ? 'feature_request' : 'issue'

    if (!email || !message) {
      return NextResponse.json({ error: 'Email and message are required' }, { status: 400 })
    }

    await connectToDatabase()
    
    const feedback = new Feedback({
      email,
      type: supportType === 'feature_request' ? 'FEATURE_REQUEST' : 'BUG_REPORT',
      message
    })
    
    await feedback.save()

    // Send email notification to admin
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
          }
        })

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: 'habytflow@gmail.com',
          subject: `New ${supportType === 'feature_request' ? 'Feature Request' : 'Bug Report'} from ${email}`,
          text: `You have received a new support request.\n\nFrom: ${email}\nType: ${type}\n\nMessage:\n${message}`,
          html: supportAlertEmailHtml(supportType, email, message),
        })
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError)
        // We do not fail the request if the email fails, as it's saved in DB
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Support request error:', error)
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check if admin
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session || session.user.email !== 'habytflow@gmail.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await connectToDatabase()
    
    const requests = await Feedback.find().sort({ createdAt: -1 })
    
    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Error fetching support requests:', error)
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
  }
}
