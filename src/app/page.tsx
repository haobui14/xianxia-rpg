"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/database/client";
import { User } from "@supabase/supabase-js";
import Login from "@/components/Login";
import CharacterCreation from "@/components/CharacterCreation";
import GameScreen from "@/components/GameScreen";
import Profile from "@/components/Profile";

type Screen = "login" | "character" | "game" | "profile";

// Minimum time between token refresh events (in milliseconds)
const TOKEN_REFRESH_COOLDOWN = 300000; // 5 minutes

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("login");
  const [locale, setLocale] = useState<"vi" | "en">("en");
  const [gameState, setGameState] = useState<{
    characterId: string;
    runId: string;
  } | null>(null);
  const lastTokenRefreshRef = useRef<number>(0);

  // Save locale to user's account when it changes
  const handleLocaleChange = async (newLocale: "vi" | "en") => {
    setLocale(newLocale);
    // Save to user metadata if logged in
    if (user) {
      try {
        await supabase.auth.updateUser({
          data: { preferred_locale: newLocale },
        });
        console.log("Locale saved to account:", newLocale);
      } catch (err) {
        console.error("Failed to save locale to account:", err);
      }
    }
  };

  useEffect(() => {
    // Force clear all auth storage to prevent stale token issues
    const clearAllAuthStorage = () => {
      try {
        // Clear all Supabase-related items from localStorage
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch (err) {
        console.error("Error clearing storage:", err);
      }
    };

    // Clear any stale sessions on mount
    const initializeAuth = async () => {
      try {
        // First, try to get the session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error.message);
          // Clear storage and sign out
          clearAllAuthStorage();
          await supabase.auth.signOut();
          setUser(null);
          setScreen("login");
          setLoading(false);
          return;
        }

        setUser(session?.user ?? null);
        // Load saved locale from user metadata
        if (session?.user?.user_metadata?.preferred_locale) {
          setLocale(session.user.user_metadata.preferred_locale as "vi" | "en");
        }
        setScreen(session?.user ? "character" : "login");
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to get session:", err);
        // If it's a refresh token error, clear everything
        if (err?.message?.includes("refresh_token") || err?.code === "refresh_token_not_found") {
          clearAllAuthStorage();
        }
        await supabase.auth.signOut();
        setUser(null);
        setScreen("login");
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event);

      // Handle specific auth events
      if (event === "TOKEN_REFRESHED") {
        // Check cooldown - skip if refreshed too recently
        const now = Date.now();
        const timeSinceLastRefresh = now - lastTokenRefreshRef.current;

        if (timeSinceLastRefresh < TOKEN_REFRESH_COOLDOWN) {
          console.log(`Token refresh skipped (cooldown: ${Math.round((TOKEN_REFRESH_COOLDOWN - timeSinceLastRefresh) / 1000)}s remaining)`);
          return;
        }

        // Token refresh - just update user, DON'T change screen
        // This prevents losing game state when switching tabs
        console.log("Token refreshed successfully");
        lastTokenRefreshRef.current = now;
        setUser(session?.user ?? null);
      } else if (event === "SIGNED_OUT") {
        console.log("User signed out");
        clearAllAuthStorage();
        setUser(null);
        setScreen("login");
      } else if (event === "SIGNED_IN") {
        // Only navigate to character screen on actual sign in
        console.log("User signed in");
        setUser(session?.user ?? null);
        setScreen("character");
      } else {
        // For other events, just update user without changing screen
        setUser(session?.user ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGameStart = (characterId: string, runId: string, gameLocale: "vi" | "en") => {
    setGameState({ characterId, runId });
    handleLocaleChange(gameLocale); // Save to account
    setScreen("game");
  };

  const [previousScreen, setPreviousScreen] = useState<Screen>("character");

  const handleShowProfile = () => {
    setPreviousScreen(screen);
    setScreen("profile");
  };

  const handleBackFromProfile = () => {
    setScreen(previousScreen === "profile" ? "character" : previousScreen);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-xianxia-darker flex items-center justify-center">
        <div className="text-xianxia-accent text-xl">
          {locale === "vi" ? "Đang tải..." : "Loading..."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-xianxia-darker">
      {screen === "login" && <Login locale={locale} onLocaleChange={handleLocaleChange} />}

      {screen === "character" && user && (
        <div>
          <div className="flex justify-end p-4">
            <button
              onClick={handleShowProfile}
              className="px-4 py-2 bg-xianxia-accent/20 hover:bg-xianxia-accent/30 rounded-lg transition-colors"
            >
              {locale === "vi" ? "Hồ Sơ" : "Profile"}
            </button>
          </div>
          <CharacterCreation
            onGameStart={handleGameStart}
            locale={locale}
            onLocaleChange={handleLocaleChange}
          />
        </div>
      )}

      {screen === "game" && gameState && (
        <div>
          <div className="flex justify-end p-4">
            <button
              onClick={handleShowProfile}
              className="px-4 py-2 bg-xianxia-accent/20 hover:bg-xianxia-accent/30 rounded-lg transition-colors"
            >
              {locale === "vi" ? "Hồ Sơ" : "Profile"}
            </button>
          </div>
          <GameScreen runId={gameState.runId} locale={locale} userId={user?.id} onLocaleChange={handleLocaleChange} />
        </div>
      )}

      {screen === "profile" && <Profile locale={locale} onBack={handleBackFromProfile} />}
    </main>
  );
}
