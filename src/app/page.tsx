"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/database/client";
import { User } from "@supabase/supabase-js";
import Login from "@/components/Login";
import CharacterCreation from "@/components/CharacterCreation";
import GameScreen from "@/components/GameScreen";
import Profile from "@/components/Profile";

type Screen = "login" | "character-creation" | "game" | "profile";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("login");
  const [locale, setLocale] = useState<"vi" | "en">("en");
  const [runId, setRunId] = useState<string | null>(null);

  const handleLocaleChange = async (newLocale: "vi" | "en") => {
    setLocale(newLocale);
    if (user) {
      try {
        await supabase.auth.updateUser({
          data: { preferred_locale: newLocale },
        });
      } catch (err) {
        console.error("Failed to save locale to account:", err);
      }
    }
  };

  useEffect(() => {
    // Single handler for any authenticated session — used by both initial load and post-login
    const handleSession = async (session: { user: any }) => {
      try {
        setUser(session.user);
        if (session.user.user_metadata?.preferred_locale) {
          setLocale(session.user.user_metadata.preferred_locale as "vi" | "en");
        }

        // Use the API route (service role key) instead of direct client queries.
        // Direct client queries hit RLS + DB cold-start and can hang 10-20s on free tier.
        const controller = new AbortController();
        const queryTimeout = setTimeout(() => controller.abort(), 12000);

        let apiData: { character: any; run: any; error?: string } | null = null;
        try {
          const res = await fetch("/api/get-character", {
            credentials: "same-origin",
            signal: controller.signal,
          });
          clearTimeout(queryTimeout);
          if (res.ok) {
            apiData = await res.json();
          } else {
            console.error("get-character API returned", res.status);
          }
        } catch (fetchErr: any) {
          clearTimeout(queryTimeout);
          console.error("get-character fetch failed:", fetchErr?.message);
        }

        if (apiData?.run?.id) {
          setRunId(apiData.run.id);
          setScreen("game");
        } else if (apiData?.character?.id) {
          setScreen("character-creation");
        } else {
          setScreen("character-creation");
        }
      } catch (err: any) {
        console.error("Failed to load user data:", err);
        setScreen("character-creation");
      } finally {
        setLoading(false);
      }
    };

    // Safety net: unblock loading after 15 s no matter what
    const safetyTimeout = setTimeout(() => setLoading(false), 15000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setRunId(null);
        setScreen("login");
        setLoading(false);
        return;
      }

      // INITIAL_SESSION fires on mount (existing session); SIGNED_IN fires after explicit login
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session?.user) {
        await handleSession(session);
        return;
      }

      // INITIAL_SESSION with no session means the user is not logged in
      if (event === "INITIAL_SESSION" && !session) {
        setUser(null);
        setScreen("login");
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const handleGameStart = (characterId: string, runId: string) => {
    setRunId(runId);
    setScreen("game");
  };

  const [previousScreen, setPreviousScreen] = useState<Screen>("game");

  const handleShowProfile = () => {
    setPreviousScreen(screen);
    setScreen("profile");
  };

  const handleBackFromProfile = () => {
    setScreen(previousScreen === "profile" ? "game" : previousScreen);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-xianxia-darker flex items-center justify-center">
        <div className="text-center space-y-6">
          {/* Cultivation circle animation */}
          <div className="relative w-24 h-24 mx-auto">
            <div
              className="absolute inset-0 rounded-full border-2 border-xianxia-accent/30 animate-spin"
              style={{ animationDuration: "3s" }}
            />
            <div
              className="absolute inset-2 rounded-full border-2 border-xianxia-gold/40 animate-spin"
              style={{ animationDuration: "2s", animationDirection: "reverse" }}
            />
            <div
              className="absolute inset-4 rounded-full border-2 border-xianxia-accent/50 animate-spin"
              style={{ animationDuration: "4s" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl">🧘</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-xianxia-gold mb-2">
              {locale === "vi" ? "Tu Tiên RPG" : "Xianxia RPG"}
            </h1>
            <p className="text-xianxia-accent text-sm animate-pulse">
              {locale === "vi" ? "Đang nhập định..." : "Entering meditation..."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-xianxia-darker">
      {screen === "login" && <Login locale={locale} onLocaleChange={handleLocaleChange} />}

      {screen === "character-creation" && (
        <CharacterCreation
          onGameStart={handleGameStart}
          locale={locale}
          onLocaleChange={handleLocaleChange}
        />
      )}

      {screen === "game" && runId && (
        <div>
          <div className="flex justify-end p-4">
            <button
              onClick={handleShowProfile}
              className="px-4 py-2 bg-xianxia-accent/20 hover:bg-xianxia-accent/30 rounded-lg transition-colors"
            >
              {locale === "vi" ? "Hồ Sơ" : "Profile"}
            </button>
          </div>
          <GameScreen runId={runId} locale={locale} onLocaleChange={handleLocaleChange} />
        </div>
      )}

      {screen === "profile" && <Profile locale={locale} onBack={handleBackFromProfile} />}
    </main>
  );
}
