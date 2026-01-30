import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/database/client";

export async function GET() {
  try {
    const supabase = await createServerClient();

    // Check cookies
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    // Get session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    return NextResponse.json({
      cookies: allCookies.map((c) => ({ name: c.name, value: c.value.substring(0, 20) + "..." })),
      session: session
        ? {
            user: session.user.email,
            expires_at: session.expires_at,
          }
        : null,
      user: user ? user.email : null,
      sessionError,
      userError,
    });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to get debug info", details: String(error) },
      { status: 500 }
    );
  }
}
