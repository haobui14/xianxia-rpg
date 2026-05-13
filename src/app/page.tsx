"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/database/client";
import { User } from "@supabase/supabase-js";
import Login from "@/components/Login";
import CharacterCreation from "@/components/CharacterCreation";
import GameScreen from "@/components/GameScreen";
import Profile from "@/components/Profile";
import { useTutorial } from "@/hooks/useTutorial";
import { Card } from "@/components/ui";

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
      <main
        className="paper-bg"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <span className="seal lg" style={{ marginBottom: 18, display: "inline-flex" }}>
            道
          </span>
          <h1
            className="t-display"
            style={{
              fontSize: 32,
              margin: "18px 0 6px",
              color: "var(--ink)",
              fontWeight: 500,
            }}
          >
            Tu Tiên Lục
          </h1>
          <p
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-mute)",
              fontSize: 14,
              margin: 0,
            }}
          >
            {locale === "vi" ? "Đang nhập định…" : "Entering meditation…"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="paper-bg" style={{ minHeight: "100vh" }}>
      {screen === "login" && <Login locale={locale} onLocaleChange={handleLocaleChange} />}

      {screen === "character-creation" && (
        <CharacterCreation
          onGameStart={handleGameStart}
          locale={locale}
          onLocaleChange={handleLocaleChange}
        />
      )}

      {screen === "game" && runId && (
        <GameScreenWithHeader
          runId={runId}
          locale={locale}
          onLocaleChange={handleLocaleChange}
          onShowProfile={handleShowProfile}
        />
      )}

      {screen === "profile" && <Profile locale={locale} onBack={handleBackFromProfile} />}
    </main>
  );
}

/**
 * Wraps GameScreen with the unified top header (EN/VI + ? + Hồ Sơ) and the
 * tutorial modal. Lifted here from GameScreen so the locale toggle, tutorial
 * trigger, and Profile button live in one row instead of scattered between
 * page.tsx and the tab strip.
 */
function GameScreenWithHeader({
  runId,
  locale,
  onLocaleChange,
  onShowProfile,
}: {
  runId: string;
  locale: "vi" | "en";
  onLocaleChange: (l: "vi" | "en") => void;
  onShowProfile: () => void;
}) {
  const {
    showTutorial,
    currentStep,
    totalSteps,
    steps,
    handleDismissTutorial,
    handleNextStep,
    handlePrevStep,
    handleReopenTutorial,
  } = useTutorial(runId);

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <button
            onClick={() => onLocaleChange(locale === "vi" ? "en" : "vi")}
            className="ink-btn ghost sm"
            title={locale === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"}
            aria-label={locale === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"}
          >
            🌐 {locale === "vi" ? "EN" : "VI"}
          </button>
          <button
            onClick={handleReopenTutorial}
            className="ink-btn ghost sm"
            title={locale === "vi" ? "Hướng dẫn" : "Tutorial"}
            aria-label={locale === "vi" ? "Mở hướng dẫn" : "Open tutorial"}
          >
            <span className="t-han" style={{ fontSize: 14 }}>
              問
            </span>
            ?
          </button>
          <button
            onClick={onShowProfile}
            className="ink-btn ghost sm"
            aria-label={locale === "vi" ? "Hồ sơ" : "Profile"}
          >
            <span className="t-han" style={{ fontSize: 14 }}>
              己
            </span>
            {locale === "vi" ? "Hồ Sơ" : "Profile"}
          </button>
        </div>
      </div>

      <GameScreen runId={runId} locale={locale} />

      {showTutorial && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(20, 24, 32, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <Card padding={26} style={{ maxWidth: 640, width: "100%" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {steps.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 4,
                      width: i === currentStep ? 30 : 14,
                      borderRadius: 2,
                      background:
                        i === currentStep
                          ? "var(--cinnabar)"
                          : i < currentStep
                            ? "var(--ink)"
                            : "var(--line)",
                      transition: "all 0.3s",
                    }}
                  />
                ))}
              </div>
              <span className="label" style={{ fontSize: 10 }}>
                {currentStep + 1} / {totalSteps}
              </span>
            </div>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>{steps[currentStep].icon}</div>
              <h2
                className="t-display"
                style={{ fontSize: 26, color: "var(--ink)", margin: "0 0 10px" }}
              >
                {locale === "vi" ? steps[currentStep].title : steps[currentStep].title_en}
              </h2>
              <p
                className="t-body"
                style={{ color: "var(--ink-soft)", maxWidth: 480, margin: "0 auto" }}
              >
                {locale === "vi"
                  ? steps[currentStep].content
                  : steps[currentStep].content_en}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <button
                onClick={handlePrevStep}
                disabled={currentStep === 0}
                className="ink-btn ghost"
              >
                ← {locale === "vi" ? "Trước" : "Back"}
              </button>
              <button onClick={handleDismissTutorial} className="ink-btn ghost sm">
                {locale === "vi" ? "Bỏ qua" : "Skip"}
              </button>
              <button onClick={handleNextStep} className="ink-btn primary">
                {currentStep < totalSteps - 1
                  ? locale === "vi"
                    ? "Tiếp →"
                    : "Next →"
                  : locale === "vi"
                    ? "Bắt đầu!"
                    : "Start!"}
              </button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
