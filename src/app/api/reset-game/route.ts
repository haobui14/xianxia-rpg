import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database/client';
import { characterQueries } from '@/lib/database/queries';

export async function POST() {
  try {
    const supabase = await createServerClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete all characters (cascade will delete runs and turn_logs)
    await characterQueries.deleteAllByUserId(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resetting game:', error);
    return NextResponse.json(
      { error: 'Failed to reset game' },
      { status: 500 }
    );
  }
}
