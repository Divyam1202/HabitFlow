import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import PushSubscription from '@/models/PushSubscription';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { subscription, timezone } = body;

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription data is required' }, { status: 400 });
    }

    await connectToDatabase();

    // Upsert the subscription so we don't have duplicates for the same user/endpoint
    // Note: A real app might allow multiple devices by checking the subscription.endpoint
    await PushSubscription.findOneAndUpdate(
      { 
        userId: session.user.id,
        'subscription.endpoint': subscription.endpoint
      },
      { 
        userId: session.user.id,
        subscription,
        timezone: timezone || 'UTC'
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}
