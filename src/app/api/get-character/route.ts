import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database/client';
import { characterQueries, runQueries } from '@/lib/database/queries';

export async function GET() {
  try {
    // Create server client to get authenticated user
    const supabase = await createServerClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ character: null, run: null });
    }

    // Get user's characters
    const characters = await characterQueries.getByUserId(user.id);
    
    if (characters.length === 0) {
      return NextResponse.json({ character: null, run: null });
    }

    const character = characters[0];
    
    // Get latest run for this character
    const runs = await runQueries.getByCharacterId(character.id);
    const latestRun = runs.length > 0 ? runs[0] : null;

    return NextResponse.json({
      character,
      run: latestRun,
    });
  } catch (error) {
    console.error('Error fetching character:', error);
    return NextResponse.json(
      { error: 'Failed to fetch character' },
      { status: 500 }
    );
  }
}
