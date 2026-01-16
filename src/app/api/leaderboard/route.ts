import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database/client';
import { leaderboardQueries } from '@/lib/database/extendedQueries';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get leaderboard data from normalized tables
    const leaderboard = await leaderboardQueries.getLeaderboard(limit);

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to load leaderboard' },
      { status: 500 }
    );
  }
}
