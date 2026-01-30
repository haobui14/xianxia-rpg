import { createBrowserClient } from "@supabase/ssr";
import { type CookieOptions, createServerClient as createSSRServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

/**
 * Client-side Supabase client for browser
 * Use this in client components ('use client')
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    storage: {
      getItem: (key) => {
        if (typeof window === "undefined") return null;
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        if (typeof window === "undefined") return;
        try {
          localStorage.setItem(key, value);
        } catch (err) {
          console.error("Error setting storage:", err);
        }
      },
      removeItem: (key) => {
        if (typeof window === "undefined") return;
        try {
          localStorage.removeItem(key);
        } catch (err) {
          console.error("Error removing storage:", err);
        }
      },
    },
  },
});

/**
 * Create a server-side Supabase client with authentication from cookies
 * Use this in API routes to access authenticated user data
 */
export async function createServerClient() {
  // Import Next.js headers and cookies
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch (error) {
          // Called from a Server Component or middleware, can't set cookies
        }
      },
    },
  });
}
