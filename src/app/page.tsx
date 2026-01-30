"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/database/client";
import { User } from "@supabase/supabase-js";
import Login from "@/components/Login";
import CharacterCreation from "@/components/CharacterCreation";
import GameScreen from "@/components/GameScreen";
import Profile from "@/components/Profile";

type Screen = "login" | "character" | "game" | "profile";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("login");
  const [locale, setLocale] = useState<"vi" | "en">("en");
  const [gameState, setGameState] = useState<{
    characterId: string;
    runId: string;
  } | null>(null);

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

      // Handle token refresh errors
      if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully");
      } else if (event === "SIGNED_OUT") {
        console.log("User signed out");
        clearAllAuthStorage();
        setUser(null);
        setScreen("login");
      }

      setUser(session?.user ?? null);
      setScreen(session?.user ? "character" : "login");
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGameStart = (characterId: string, runId: string, gameLocale: "vi" | "en") => {
    setGameState({ characterId, runId });
    setLocale(gameLocale);
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
      {screen === "login" && <Login locale={locale} onLocaleChange={setLocale} />}

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
            onLocaleChange={setLocale}
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
          <GameScreen runId={gameState.runId} locale={locale} userId={user?.id} />
        </div>
      )}

      {screen === "profile" && <Profile locale={locale} onBack={handleBackFromProfile} />}
    </main>
  );
}
