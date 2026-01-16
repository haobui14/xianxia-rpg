import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database/client';
import { characterQueries, runQueries } from '@/lib/database/queries';
import { marketQueries } from '@/lib/database/extendedQueries';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get character
    const characters = await characterQueries.getByUserId(user.id);
    if (characters.length === 0) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    const character = characters[0];
    
    // Get current run
    const runs = await runQueries.getByCharacterId(character.id);
    if (runs.length === 0) {
      return NextResponse.json({ error: 'No active run' }, { status: 404 });
    }
    
    const run = runs[0];

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get transaction history from normalized table
    const transactions = await marketQueries.getTransactionHistory(run.id, limit);

    // Calculate statistics
    const totalTransactions = transactions.length;
    const purchases = transactions.filter((t: any) => t.transaction_type === 'buy');
    const sales = transactions.filter((t: any) => t.transaction_type === 'sell');

    const totalSpentSilver = purchases.reduce((sum: number, t: any) => sum + (t.price_silver || 0), 0);
    const totalSpentStones = purchases.reduce((sum: number, t: any) => sum + (t.price_spirit_stones || 0), 0);
    const totalEarnedSilver = sales.reduce((sum: number, t: any) => sum + (t.price_silver || 0), 0);
    const totalEarnedStones = sales.reduce((sum: number, t: any) => sum + (t.price_spirit_stones || 0), 0);

    return NextResponse.json({
      transactions,
      statistics: {
        totalTransactions,
        totalPurchases: purchases.length,
        totalSales: sales.length,
        spent: {
          silver: totalSpentSilver,
          spiritStones: totalSpentStones,
        },
        earned: {
          silver: totalEarnedSilver,
          spiritStones: totalEarnedStones,
        },
        netSilver: totalEarnedSilver - totalSpentSilver,
        netSpiritStones: totalEarnedStones - totalSpentStones,
      }
    });
  } catch (error) {
    console.error('Transaction history error:', error);
    return NextResponse.json(
      { error: 'Failed to load transaction history' },
      { status: 500 }
    );
  }
}
