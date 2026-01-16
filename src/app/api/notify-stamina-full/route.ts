import { NextRequest, NextResponse } from 'next/server';
import { sendStaminaFullNotification } from '@/app/actions/notifications';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const result = await sendStaminaFullNotification(userId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in notify-stamina-full:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
