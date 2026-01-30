import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/database/client";
import { generateSpiritRoot } from "@/lib/game/mechanics";
import { DeterministicRNG } from "@/lib/game/rng";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, age, locale = "vi" } = body;

    console.log("Create character request:", { name, age, locale });

    // Validation
    if (!name || typeof name !== "string" || name.length < 2) {
      console.log("Validation failed: Invalid name");
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    if (!age || typeof age !== "number" || age < 15 || age > 100) {
      console.log("Validation failed: Invalid age");
      return NextResponse.json({ error: "Age must be between 15 and 100" }, { status: 400 });
    }

    if (locale !== "vi" && locale !== "en") {
      return NextResponse.json({ error: "Locale must be vi or en" }, { status: 400 });
    }

    // Create authenticated Supabase client
    const supabase = await createServerClient();

    // Debug: Check what cookies we have
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    console.log(
      "Available cookies:",
      allCookies.map((c) => c.name)
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error in create-character:", authError);
      console.log("User:", user);
      console.log("Session check failed - user needs to sign in");
      return NextResponse.json({ error: "Unauthorized - Please sign in first" }, { status: 401 });
    }

    console.log("Authenticated user:", user.email);

    // Generate spirit root
    const rng = new DeterministicRNG(`${name}-${age}-${Date.now()}`);
    const spiritRoot = generateSpiritRoot(rng);

    // Create character with authenticated user_id
    const { data: character, error: createError } = await supabase
      .from("characters")
      .insert({ user_id: user.id, name, age })
      .select()
      .single();

    if (createError) {
      console.error("Create character error:", createError);
      return NextResponse.json({ error: "Failed to create character" }, { status: 500 });
    }

    return NextResponse.json({
      character,
      spirit_root: spiritRoot,
    });
  } catch (error) {
    console.error("Error creating character:", error);
    return NextResponse.json({ error: "Failed to create character" }, { status: 500 });
  }
}
