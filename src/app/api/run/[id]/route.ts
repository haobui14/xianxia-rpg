import { NextResponse } from 'next/server';
import { runQueries } from '@/lib/database/queries';
import { GameState } from '@/types/game';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Run ID required' }, { status: 400 });
    }

    const run = await runQueries.getById(id);

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (error) {
    console.error('Error fetching run:', error);
    return NextResponse.json(
      { error: 'Failed to fetch run' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { state } = body;

    if (!id) {
      return NextResponse.json({ error: 'Run ID required' }, { status: 400 });
    }

    if (!state) {
      return NextResponse.json({ error: 'State required' }, { status: 400 });
    }

    await runQueries.update(id, state as GameState);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating run:', error);
    return NextResponse.json(
      { error: 'Failed to update run' },
      { status: 500 }
    );
  }
}
