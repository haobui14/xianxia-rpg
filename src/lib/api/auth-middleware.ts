import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/database/client";

/**
 * Require authentication for API routes
 * @returns Object containing supabase client and authenticated user ID
 * @throws Error if user is not authenticated
 */
export async function requireAuth() {
  const supabase = await createServerClient();

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    throw new Error("Unauthorized");
  }

  return {
    supabase,
    userId: session.user.id,
    session,
  };
}

/**
 * Wrapper for API route handlers that require authentication
 * Automatically handles auth errors and returns appropriate responses
 */
export function withAuth<T>(
  handler: (params: {
    supabase: Awaited<ReturnType<typeof createServerClient>>;
    userId: string;
    request: Request;
  }) => Promise<NextResponse<T>>
) {
  return async (request: Request) => {
    try {
      const { supabase, userId } = await requireAuth();
      return await handler({ supabase, userId, request });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      console.error("Auth middleware error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
