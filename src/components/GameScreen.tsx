"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Choice, Enemy } from "@/types/game";
import { t, Locale } from "@/lib/i18n/translations";
import DebugInventory from "./DebugInventory";
import BreakthroughModal from "./BreakthroughModal";
import { useToast } from "./Toast";
import CultivatorRail from "./CultivatorRail";
import EventModal from "./EventModal";
import { Card, Seal } from "@/components/ui";
import { useGameState } from "@/hooks/useGameState";
import { useItemHandlers } from "@/hooks/useItemHandlers";
import { useTravelHandlers } from "@/hooks/useTravelHandlers";
import { useAbilityHandlers } from "@/hooks/useAbilityHandlers";
import { useCombat } from "@/hooks/useCombat";
import { useEventHandlers } from "@/hooks/useEventHandlers";

const CharacterSheet = dynamic(() => import("./CharacterSheet"), {
  ssr: false,
  loading: () => (
    <div className="ink-card" style={{ padding: 24 }}>
      <span className="label">Loading…</span>
    </div>
  ),
});

const SectView = dynamic(() => import("./SectView"), {
  ssr: false,
  loading: () => (
    <div className="ink-card" style={{ padding: 24 }}>
      <span className="label">Loading…</span>
    </div>
  ),
});

const JournalView = dynamic(() => import("./JournalView"), {
  ssr: false,
  loading: () => (
    <div className="ink-card" style={{ padding: 24 }}>
      <span className="label">Loading…</span>
    </div>
  ),
});

const InventoryView = dynamic(() => import("./InventoryView"), {
  ssr: false,
  loading: () => (
    <div className="ink-card" style={{ padding: 24 }}>
      <span className="label">Loading…</span>
    </div>
  ),
});

const MarketView = dynamic(() => import("./MarketView"), {
  ssr: false,
  loading: () => (
    <div className="ink-card" style={{ padding: 24 }}>
      <span className="label">Loading…</span>
    </div>
  ),
});

const WorldMap = dynamic(() => import("./WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="ink-card" style={{ padding: 24 }}>
      <span className="label">Loading…</span>
    </div>
  ),
});

const DungeonView = dynamic(() => import("./DungeonView"), {
  ssr: false,
  loading: () => (
    <div className="ink-card" style={{ padding: 24 }}>
      <span className="label">Loading…</span>
    </div>
  ),
});

const CombatView = dynamic(() => import("./CombatView"), {
  ssr: false,
  loading: () => (
    <div className="ink-card" style={{ padding: 24 }}>
      <span className="label">Loading…</span>
    </div>
  ),
});

interface GameScreenProps {
  runId: string;
  locale: Locale;
}

type Tab = "game" | "character" | "journal" | "sect" | "inventory" | "market" | "world";

const TAB_META: Record<Tab, { han: string; key: string }> = {
  game: { han: "途", key: "tabGame" },
  character: { han: "身", key: "tabCharacter" },
  journal: { han: "録", key: "tabJournal" },
  sect: { han: "派", key: "tabSect" },
  inventory: { han: "物", key: "tabInventory" },
  market: { han: "市", key: "tabMarket" },
  world: { han: "界", key: "tabWorld" },
};

const TAB_ORDER: Tab[] = ["game", "character", "journal", "sect", "inventory", "market", "world"];

const ORDINAL_HAN = ["一", "二", "三", "四", "五", "六", "七", "八"];

function ProcessingIndicator({ locale, onCancel }: { locale: Locale; onCancel: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const showCancel = elapsed >= 10;

  return (
    <Card padding={16} style={{ borderLeft: "3px solid var(--jade)", textAlign: "center" }}>
      <div className="label" style={{ marginBottom: 4 }}>
        {locale === "vi" ? "Thiên Cơ Đang Vận Hành" : "Heaven's Will Unfolds"}
      </div>
      <div className="t-body" style={{ fontStyle: "italic", color: "var(--ink-soft)" }}>
        {locale === "vi" ? "Đang xử lý lượt chơi…" : "Processing turn…"}{" "}
        <span className="t-num" style={{ color: "var(--ink-mute)" }}>
          {elapsed}s
        </span>
      </div>
      {showCancel && (
        <button onClick={onCancel} className="ink-btn cinnabar sm" style={{ marginTop: 10 }}>
          {locale === "vi" ? "Hủy & Thử lại" : "Cancel & Retry"}
        </button>
      )}
    </Card>
  );
}

function SaveStatusChip({
  saveStatus,
  saveError,
  setSaveStatus,
  setSaveError,
  locale,
}: {
  saveStatus: string;
  saveError: string;
  setSaveStatus: (s: any) => void;
  setSaveError: (s: string) => void;
  locale: Locale;
}) {
  if (saveStatus === "idle") return null;

  const baseStyle: React.CSSProperties = {
    position: "fixed",
    top: 16,
    left: 16,
    zIndex: 50,
    padding: "8px 14px",
    borderRadius: 2,
    fontSize: 12,
    fontFamily: "var(--font-ui), Inter, sans-serif",
    background: "var(--card)",
    border: "1px solid var(--line)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  if (saveStatus === "saving") {
    return (
      <div style={{ ...baseStyle, borderLeft: "3px solid var(--ink-soft)" }}>
        <span className="label" style={{ letterSpacing: "0.1em" }}>
          {locale === "vi" ? "Đang lưu…" : "Saving…"}
        </span>
      </div>
    );
  }
  if (saveStatus === "saved") {
    return (
      <div style={{ ...baseStyle, borderLeft: "3px solid var(--jade)" }}>
        <span className="label" style={{ color: "var(--jade-deep)", letterSpacing: "0.1em" }}>
          ✓ {locale === "vi" ? "Đã lưu" : "Saved"}
        </span>
      </div>
    );
  }
  if (saveStatus === "error") {
    return (
      <div
        style={{
          ...baseStyle,
          borderLeft: "3px solid var(--cinnabar)",
          flexDirection: "column",
          alignItems: "flex-start",
          maxWidth: 280,
        }}
      >
        <span className="label" style={{ color: "var(--cinnabar-deep)" }}>
          {locale === "vi" ? "Lỗi lưu dữ liệu" : "Save failed"}
        </span>
        {saveError && (
          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{saveError}</span>
        )}
        <button
          onClick={() => {
            setSaveStatus("idle");
            setSaveError("");
          }}
          className="ink-btn ghost sm"
          style={{ marginTop: 4 }}
        >
          {locale === "vi" ? "Bỏ qua" : "Dismiss"}
        </button>
      </div>
    );
  }
  return null;
}

export default function GameScreen({ runId, locale }: GameScreenProps) {
  const {
    state,
    setState,
    narrative,
    setNarrative,
    choices,
    loading,
    processing,
    error,
    setError,
    saveStatus,
    setSaveStatus,
    saveError,
    setSaveError,
    breakthroughEvent,
    setBreakthroughEvent,
    previousExp,
    processTurn,
    cancelProcessing,
    lastTurnEvents,
    setLastTurnEvents,
    refreshRun,
  } = useGameState({ runId, locale });

  const [activeTab, setActiveTab] = useState<Tab>("game");
  const { toast } = useToast();
  const [customAction, setCustomAction] = useState("");
  const [characterName, setCharacterName] = useState<string | null>(null);
  const marketInitializedRef = useRef(false);
  const nameFetchedRef = useRef(false);

  // Fetch character name once on mount (separate from useGameState which only fetches the run)
  useEffect(() => {
    if (nameFetchedRef.current) return;
    nameFetchedRef.current = true;
    fetch("/api/get-character", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.character?.name) setCharacterName(data.character.name);
      })
      .catch(() => {});
  }, []);

  // Combat
  const {
    testCombat,
    setTestCombat,
    startTestCombat,
    handleTestCombatAction,
    activeCombat,
    setActiveCombat,
    handleActiveCombatAction,
    handleActiveCombatEnd,
    resetSkillCooldowns,
  } = useCombat({ runId, locale, state, setState, setNarrative });

  const {
    handleEquipItem,
    handleMarketAction,
    handleRefreshMarket,
    handleExchange,
    handleDiscardItem,
    handleUseItem,
    handleEnhanceItem,
  } = useItemHandlers({ locale, setState, setError });

  const { handleTravelArea, handleTravelRegion, handleDungeonAction } = useTravelHandlers({
    locale,
    setState,
    setError,
    setActiveCombat,
    resetSkillCooldowns,
  });

  const { handleAbilitySwap, handleLevelAbility, handleToggleDualCultivation, handleSetExpSplit } =
    useAbilityHandlers({ runId, locale, setState, setError });

  const { handleEventChoice } = useEventHandlers({ locale, processTurn, setError });

  useEffect(() => {
    if (!lastTurnEvents || lastTurnEvents.length === 0) return;
    const combatEncounter = lastTurnEvents.find(
      (e: { type: string; data?: { enemy?: Enemy } }) => e.type === "combat_encounter"
    );
    if (combatEncounter?.data?.enemy) {
      const enemy = combatEncounter.data.enemy as Enemy;
      if (!enemy.hp_max) enemy.hp_max = enemy.hp;
      resetSkillCooldowns();
      setActiveCombat({ enemy, log: [], playerTurn: true });
    }

    // Journal feedback: surface arc progress + the peak-realm milestone
    for (const e of lastTurnEvents as Array<{ type: string; data?: any }>) {
      if (e.type !== "quest_update" || !e.data) continue;
      const d = e.data;
      const title = locale === "vi" ? d.title : d.title_en || d.title;
      if (d.kind === "arc_started") {
        toast.info(
          locale === "vi" ? `📖 Tuyến truyện mới: ${title}` : `📖 New story arc: ${title}`,
          4000
        );
      } else if (d.kind === "arc_advanced") {
        toast.info(
          locale === "vi"
            ? `📖 ${title} — hồi ${d.stage}/${d.total_stages}`
            : `📖 ${title} — act ${d.stage}/${d.total_stages}`,
          4000
        );
      } else if (d.kind === "arc_completed") {
        toast.success(
          locale === "vi" ? `📖 Viên mãn: ${title}` : `📖 Arc complete: ${title}`,
          5000
        );
      } else if (d.milestone === "peak_realm") {
        toast.success(
          locale === "vi"
            ? "🏆 Nguyên Anh viên mãn — thiên kiếp phi thăng đang chờ!"
            : "🏆 Peak Nascent Soul — the ascension tribulation awaits!",
          6000
        );
      }
    }

    setLastTurnEvents([]);
  }, [lastTurnEvents, setLastTurnEvents, setActiveCombat, resetSkillCooldowns, locale, toast]);

  useEffect(() => {
    const initMarket = async () => {
      if (activeTab === "market" && state && !marketInitializedRef.current) {
        if (!state.market || state.market.items.length === 0) {
          try {
            const response = await fetch("/api/market", {
              method: "GET",
              credentials: "same-origin",
            });
            if (response.ok) {
              const result = await response.json();
              if (result.state && result.state.market && result.state.market.items.length > 0) {
                setState(result.state);
                marketInitializedRef.current = true;
              }
            }
          } catch (e) {
            console.error("Failed to initialize market:", e);
          }
        } else {
          marketInitializedRef.current = true;
        }
      }
    };
    initMarket();
  }, [activeTab, state?.market?.items?.length]);

  const handleChoice = async (choiceId: string) => {
    const selectedChoice = choices.find((c) => c.id === choiceId);
    if (selectedChoice?.cost && state) {
      if (selectedChoice.cost.stamina && state.stats.stamina < selectedChoice.cost.stamina) {
        setError(locale === "vi" ? "Không đủ Thể Lực!" : "Not enough Stamina!");
        return;
      }
      if (selectedChoice.cost.qi && state.stats.qi < selectedChoice.cost.qi) {
        setError(locale === "vi" ? "Không đủ Linh Lực!" : "Not enough Qi!");
        return;
      }
      if (
        selectedChoice.cost.silver &&
        state.inventory.silver < selectedChoice.cost.silver
      ) {
        setError(locale === "vi" ? "Không đủ Bạc!" : "Not enough Silver!");
        return;
      }
      if (
        selectedChoice.cost.spirit_stones &&
        state.inventory.spirit_stones < selectedChoice.cost.spirit_stones
      ) {
        setError(locale === "vi" ? "Không đủ Linh Thạch!" : "Not enough Spirit Stones!");
        return;
      }
    }
    await processTurn(choiceId, selectedChoice);
  };

  const handleCustomAction = async () => {
    if (!customAction.trim()) return;
    const customChoice: Choice = { id: "custom_action", text: customAction.trim() };
    await processTurn("custom_action", customChoice);
    setCustomAction("");
  };

  if (loading) {
    return (
      <div
        className="paper-bg"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Seal size="lg">道</Seal>
          <div className="label" style={{ marginTop: 16, color: "var(--ink-mute)" }}>
            {t(locale, "loading")}
          </div>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div
        className="paper-bg"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Card padding={28} style={{ maxWidth: 420, borderLeft: "3px solid var(--cinnabar)" }}>
          <div className="label" style={{ color: "var(--cinnabar-deep)" }}>
            {t(locale, "error")}
          </div>
          <p style={{ marginTop: 8, color: "var(--ink)" }}>{error || t(locale, "error")}</p>
        </Card>
      </div>
    );
  }

  const season =
    state.time_segment === "Sáng"
      ? "🌅"
      : state.time_segment === "Chiều"
        ? "☀️"
        : state.time_segment === "Tối"
          ? "🌆"
          : "🌙";

  return (
    <div className="paper-bg" style={{ minHeight: "100vh", position: "relative" }}>
      <SaveStatusChip
        saveStatus={saveStatus}
        saveError={saveError}
        setSaveStatus={setSaveStatus}
        setSaveError={setSaveError}
        locale={locale}
      />

      <div
        className="page-pad"
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1280,
          margin: "0 auto",
          padding: "18px 24px 80px",
        }}
      >
        {/* Tab strip */}
        <div
          className="ink-tabs"
          style={{ marginBottom: 24, alignItems: "center", gap: 4 }}
          role="tablist"
        >
          {TAB_ORDER.map((tab) => {
            const meta = TAB_META[tab];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                role="tab"
                aria-selected={isActive}
                className={`ink-tab ${isActive ? "active" : ""}`}
              >
                <span className="han">{meta.han}</span>
                <span>{t(locale, meta.key)}</span>
              </button>
            );
          })}
        </div>

        {activeTab === "game" ? (
          <div className="ink-fade-in game-shell">
            <CultivatorRail state={state} locale={locale} characterName={characterName} />

            <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
              {/* Time + setting strip */}
              <div
                className="time-strip"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Seal variant="ink">境</Seal>
                  <div>
                    <div className="label">{t(locale, "worldCurrentLocation")}</div>
                    <div
                      className="t-display"
                      style={{ fontSize: 22, color: "var(--ink)", lineHeight: 1.1 }}
                    >
                      {state.location.region} — {state.location.place}
                    </div>
                  </div>
                </div>
                <div
                  className="time-block"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div style={{ textAlign: "right" }}>
                    <div className="label">{t(locale, "time")}</div>
                    <div
                      className="t-num"
                      style={{ fontSize: 16, color: "var(--ink)", marginTop: 2 }}
                    >
                      {locale === "vi" ? "Năm" : "Y"} {state.time_year} · {locale === "vi" ? "Tháng" : "M"}{" "}
                      {state.time_month} · {locale === "vi" ? "Ngày" : "D"} {state.time_day}
                    </div>
                    <div
                      className="t-body"
                      style={{
                        fontStyle: "italic",
                        color: "var(--ink-mute)",
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {state.time_segment}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "var(--card-deep)",
                      border: "1px solid var(--line)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                    }}
                  >
                    {season}
                  </div>
                </div>
              </div>

              {/* Narrative */}
              <Card padding={28} className="card-corner" style={{ position: "relative" }}>
                <span
                  className="han-bg"
                  style={{
                    position: "absolute",
                    top: -10,
                    right: -16,
                    fontSize: 220,
                  }}
                  aria-hidden
                >
                  道
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 14,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <Seal variant="cinnabar" size="sm">
                    章
                  </Seal>
                  <div>
                    <div className="label">
                      {locale === "vi" ? "Hồi" : "Chapter"} {state.turn_count + 1}
                    </div>
                  </div>
                </div>
                <div className="brush-rule" style={{ marginBottom: 14 }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  {narrative ? (
                    <p className="narrative">{narrative}</p>
                  ) : (
                    <p
                      className="t-body"
                      style={{
                        fontStyle: "italic",
                        color: "var(--ink-mute)",
                        margin: 0,
                        fontSize: 16,
                        lineHeight: 1.75,
                      }}
                    >
                      {processing
                        ? locale === "vi"
                          ? "Đang tạo câu chuyện…"
                          : "Spinning the thread of fate…"
                        : locale === "vi"
                          ? "Bắt đầu cuộc phiêu lưu…"
                          : "Begin your journey…"}
                    </p>
                  )}
                </div>
              </Card>

              {/* Error */}
              {error && (
                <Card
                  padding={14}
                  style={{ borderLeft: "3px solid var(--cinnabar)" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: "var(--cinnabar-deep)" }}>{error}</span>
                    <button
                      onClick={() => setError("")}
                      className="ink-btn ghost sm"
                    >
                      {locale === "vi" ? "Đóng" : "Dismiss"}
                    </button>
                  </div>
                </Card>
              )}

              {/* Choices */}
              {!processing && choices.length > 0 && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <span
                      className="t-han"
                      style={{ fontSize: 24, color: "var(--cinnabar)" }}
                    >
                      抉
                    </span>
                    <h2
                      className="t-display"
                      style={{
                        fontSize: 22,
                        margin: 0,
                        color: "var(--ink)",
                        lineHeight: 1.1,
                      }}
                    >
                      {t(locale, "gameChooseAction")}
                    </h2>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {choices.map((choice, idx) => {
                      const canAfford =
                        !choice.cost ||
                        ((!choice.cost.stamina ||
                          state.stats.stamina >= choice.cost.stamina) &&
                          (!choice.cost.qi || state.stats.qi >= choice.cost.qi) &&
                          (!choice.cost.silver ||
                            state.inventory.silver >= choice.cost.silver) &&
                          (!choice.cost.spirit_stones ||
                            state.inventory.spirit_stones >= choice.cost.spirit_stones));

                      return (
                        <button
                          key={choice.id}
                          onClick={() => handleChoice(choice.id)}
                          disabled={processing || !canAfford}
                          className={`choice ${!canAfford ? "cant-afford" : ""}`}
                        >
                          <span className="ord">
                            {ORDINAL_HAN[idx] ?? idx + 1}
                          </span>
                          <div>{choice.text}</div>
                          {choice.cost && (
                            <div className="cost">
                              {choice.cost.qi != null && (
                                <span
                                  className={`c-item ${
                                    state.stats.qi < choice.cost.qi ? "out" : ""
                                  }`}
                                >
                                  <span className="t-han">氣</span>
                                  {choice.cost.qi}
                                </span>
                              )}
                              {choice.cost.stamina != null && (
                                <span
                                  className={`c-item ${
                                    state.stats.stamina < choice.cost.stamina
                                      ? "out"
                                      : ""
                                  }`}
                                >
                                  <span className="t-han">力</span>
                                  {choice.cost.stamina}
                                </span>
                              )}
                              {choice.cost.silver != null && (
                                <span
                                  className={`c-item ${
                                    state.inventory.silver < choice.cost.silver
                                      ? "out"
                                      : ""
                                  }`}
                                >
                                  <span className="t-han">銀</span>
                                  {choice.cost.silver}
                                </span>
                              )}
                              {choice.cost.spirit_stones != null && (
                                <span
                                  className={`c-item ${
                                    state.inventory.spirit_stones <
                                    choice.cost.spirit_stones
                                      ? "out"
                                      : ""
                                  }`}
                                >
                                  <span className="t-han">靈</span>
                                  {choice.cost.spirit_stones}
                                </span>
                              )}
                              {choice.cost.time_segments != null && (
                                <span className="c-item">
                                  <span className="t-han">時</span>
                                  {choice.cost.time_segments}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom action input */}
                  <div
                    style={{
                      marginTop: 16,
                      padding: 18,
                      background: "var(--paper-deep)",
                      border: "1px dashed var(--line-strong)",
                      borderRadius: 3,
                    }}
                  >
                    <div className="label" style={{ marginBottom: 8 }}>
                      或 — {t(locale, "gameCustomAction")}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <input
                        type="text"
                        value={customAction}
                        onChange={(e) => setCustomAction(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !processing &&
                            customAction.trim()
                          ) {
                            handleCustomAction();
                          }
                        }}
                        disabled={processing}
                        placeholder={t(locale, "gameCustomPlaceholder")}
                        className="t-body"
                        style={{
                          flex: 1,
                          padding: "10px 12px",
                          background: "var(--paper)",
                          border: "1px solid var(--line-strong)",
                          borderRadius: 2,
                          color: "var(--ink)",
                          fontSize: 14,
                          fontStyle: "italic",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={handleCustomAction}
                        disabled={processing || !customAction.trim()}
                        className="ink-btn primary"
                      >
                        <span className="t-han">刻</span>
                        {t(locale, "gameSubmit")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {processing && (
                <ProcessingIndicator locale={locale} onCancel={cancelProcessing} />
              )}
            </div>
          </div>
        ) : activeTab === "character" ? (
          <div className="ink-fade-in">
            <CharacterSheet
              state={state}
              locale={locale}
              previousExp={previousExp}
              onAbilitySwap={handleAbilitySwap}
              onLevelAbility={handleLevelAbility}
              onToggleDualCultivation={handleToggleDualCultivation}
              onSetExpSplit={handleSetExpSplit}
            />
          </div>
        ) : activeTab === "journal" ? (
          <div className="ink-fade-in">
            <JournalView state={state} locale={locale} />
          </div>
        ) : activeTab === "sect" ? (
          <div className="ink-fade-in">
            <SectView
              state={state}
              locale={locale}
              onRefresh={refreshRun}
              processing={processing}
            />
          </div>
        ) : activeTab === "inventory" ? (
          <div className="ink-fade-in">
            <InventoryView
              state={state}
              locale={locale}
              onEquipItem={handleEquipItem}
              onDiscardItem={handleDiscardItem}
              onUseItem={handleUseItem}
              onEnhanceItem={handleEnhanceItem}
            />
          </div>
        ) : activeTab === "market" ? (
          <div className="ink-fade-in">
            <MarketView
              state={state}
              locale={locale}
              onBuyItem={(id) => handleMarketAction(id, "buy")}
              onSellItem={(id) => handleMarketAction(id, "sell")}
              onRefreshMarket={handleRefreshMarket}
              onExchange={handleExchange}
            />
          </div>
        ) : activeTab === "world" ? (
          <div
            className="ink-fade-in"
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {error && (
              <Card padding={14} style={{ borderLeft: "3px solid var(--cinnabar)" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "var(--cinnabar-deep)" }}>{error}</span>
                  <button onClick={() => setError("")} className="ink-btn ghost sm">
                    {locale === "vi" ? "Đóng" : "Dismiss"}
                  </button>
                </div>
              </Card>
            )}
            <WorldMap
              state={state}
              locale={locale}
              onTravelArea={handleTravelArea}
              onTravelRegion={handleTravelRegion}
            />
            <DungeonView state={state} locale={locale} onAction={handleDungeonAction} />
          </div>
        ) : null}
      </div>

      {process.env.NODE_ENV === "development" && (
        <div
          style={{
            position: "fixed",
            right: "max(16px, env(safe-area-inset-right))",
            bottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))",
            zIndex: 50,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <DebugInventory />
          <button
            onClick={startTestCombat}
            className="ink-btn cinnabar sm"
            type="button"
          >
            <span className="t-han">戰</span>
            Test Combat
          </button>
        </div>
      )}

      {testCombat && state && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(20, 24, 32, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div style={{ maxWidth: 960, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <CombatView
              state={state}
              enemy={testCombat.enemy}
              locale={locale}
              combatLog={testCombat.log}
              playerTurn={testCombat.playerTurn}
              onAction={handleTestCombatAction}
              onCombatEnd={() => setTestCombat(null)}
              overridePlayerHp={testCombat.playerHp}
            />
            <button
              onClick={() => setTestCombat(null)}
              className="ink-btn ghost"
              style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
            >
              {locale === "vi" ? "Đóng Test Combat" : "Close Test Combat"}
            </button>
          </div>
        </div>
      )}

      {activeCombat && state && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            background: "rgba(20, 24, 32, 0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div style={{ maxWidth: 960, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <CombatView
              state={state}
              enemy={activeCombat.enemy}
              locale={locale}
              combatLog={activeCombat.log}
              playerTurn={activeCombat.playerTurn}
              onAction={handleActiveCombatAction}
              onCombatEnd={handleActiveCombatEnd}
            />
          </div>
        </div>
      )}

      {breakthroughEvent && (
        <BreakthroughModal
          event={breakthroughEvent}
          locale={locale}
          onClose={() => setBreakthroughEvent(null)}
        />
      )}

      {state?.events?.active_event && (
        <EventModal
          event={state.events.active_event}
          state={state}
          locale={locale}
          onChoice={handleEventChoice}
        />
      )}
    </div>
  );
}
