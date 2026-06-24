import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import UserState from '@/models/UserState';
import { connectToDatabase as connectMongo } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, token } = await request.json();

    if (!userId || !token || userId !== session.user.id) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    await connectMongo();

    // First, clear this FCM token from any other users to prevent duplicate delivery
    await UserState.updateMany(
      { userId: { $ne: userId }, fcmToken: token },
      { $unset: { fcmToken: "" } }
    );

    // Update the user state with the FCM token and reset state metadata
    await UserState.findOneAndUpdate(
      { userId },
      {
        $set: {
          fcmToken: token,
          notificationStatus: 'active',
          lastTokenRefreshAt: new Date()
        }
      },
      { new: true, upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save FCM token:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
