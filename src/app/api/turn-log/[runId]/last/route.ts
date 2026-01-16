import { NextResponse } from 'next/server';
import { turnLogQueries } from '@/lib/database/queries';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    if (!runId) {
      return NextResponse.json({ error: 'Run ID required' }, { status: 400 });
    }

    // Get the last turn log
    const logs = await turnLogQueries.getLastTurns(runId, 1);
    
    if (logs.length === 0) {
      return NextResponse.json({ error: 'No turns found' }, { status: 404 });
    }

    return NextResponse.json(logs[0]);
  } catch (error) {
    console.error('Error fetching last turn log:', error);
    return NextResponse.json(
      { error: 'Failed to fetch turn log' },
      { status: 500 }
    );
  }
}
