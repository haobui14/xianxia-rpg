import { createServerClient } from '@/lib/database/client';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createServerClient();
  
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
  }

  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
}
