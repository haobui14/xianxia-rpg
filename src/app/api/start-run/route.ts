import { NextResponse } from 'next/server';
import { runQueries, characterQueries } from '@/lib/database/queries';
import { createInitialState } from '@/lib/game/mechanics';
import { Locale, SpiritRoot } from '@/types/game';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { characterId, spiritRoot, locale = 'vi' } = body;

    // Validation
    if (!characterId || typeof characterId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid character ID' },
        { status: 400 }
      );
    }

    if (!spiritRoot || !spiritRoot.elements || !spiritRoot.grade) {
      return NextResponse.json(
        { error: 'Invalid spirit root' },
        { status: 400 }
      );
    }

    const validLocale: Locale = locale === 'en' ? 'en' : 'vi';

    // Get character
    const character = await characterQueries.getById(characterId);
    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    // Generate world seed
    const worldSeed = `world-${characterId}-${Date.now()}`;

    // Create initial game state
    const initialState = createInitialState(
      character.name,
      character.age,
      spiritRoot as SpiritRoot,
      validLocale
    );

    // Create run
    const run = await runQueries.create(
      characterId,
      worldSeed,
      validLocale,
      initialState
    );

    return NextResponse.json({ run });
  } catch (error) {
    console.error('Error starting run:', error);
    return NextResponse.json(
      { error: 'Failed to start run' },
      { status: 500 }
    );
  }
}
