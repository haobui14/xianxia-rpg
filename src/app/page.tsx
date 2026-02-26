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

        const { data: runs } = await supabase
          .from("runs")
          .select("id, character_id, characters(user_id)")
          .order("updated_at", { ascending: false })
          .limit(1);

        if (runs && runs.length > 0) {
          const run = runs[0] as any;
          if (run.characters?.user_id === session.user.id) {
            setRunId(run.id);
            setScreen("game");
          } else {
            setScreen("character-creation");
          }
        } else {
          setScreen("character-creation");
        }
      } catch (err) {
        console.error("Failed to load user data:", err);
        setScreen("character-creation");
      } finally {
        setLoading(false);
      }
    };

    // Safety net: unblock loading after 8 s no matter what
    const safetyTimeout = setTimeout(() => setLoading(false), 8000);

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
        <div className="text-xianxia-accent text-xl">
          {locale === "vi" ? "Đang tải..." : "Loading..."}
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
          <GameScreen
            runId={runId}
            locale={locale}
            onLocaleChange={handleLocaleChange}
          />
        </div>
      )}

      {screen === "profile" && <Profile locale={locale} onBack={handleBackFromProfile} />}
    </main>
  );
}
