"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Choice, Enemy, ActivityType } from "@/types/game";
import { t, Locale } from "@/lib/i18n/translations";
import DebugInventory from "./DebugInventory";
import BreakthroughModal from "./BreakthroughModal";
import CultivatorDashboard from "./CultivatorDashboard";
import EventModal from "./EventModal";
import { useGameState } from "@/hooks/useGameState";
import { useItemHandlers } from "@/hooks/useItemHandlers";
import { useTutorial } from "@/hooks/useTutorial";
import { useTravelHandlers } from "@/hooks/useTravelHandlers";
import { useAbilityHandlers } from "@/hooks/useAbilityHandlers";
import { useCombat } from "@/hooks/useCombat";
import { useEventHandlers } from "@/hooks/useEventHandlers";

const CharacterSheet = dynamic(() => import("./CharacterSheet"), {
  ssr: false,
  loading: () => (
    <div className="p-6 bg-xianxia-dark border border-xianxia-accent/30 rounded-lg">Loading...</div>
  ),
});

const SectView = dynamic(() => import("./SectView"), {
  ssr: false,
  loading: () => (
    <div className="p-6 bg-xianxia-dark border border-xianxia-accent/30 rounded-lg">Loading...</div>
  ),
});

const InventoryView = dynamic(() => import("./InventoryView"), {
  ssr: false,
  loading: () => (
    <div className="p-6 bg-xianxia-dark border border-xianxia-accent/30 rounded-lg">Loading...</div>
  ),
});

const MarketView = dynamic(() => import("./MarketView"), {
  ssr: false,
  loading: () => (
    <div className="p-6 bg-xianxia-dark border border-xianxia-accent/30 rounded-lg">Loading...</div>
  ),
});

const WorldMap = dynamic(() => import("./WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="p-6 bg-xianxia-dark border border-xianxia-accent/30 rounded-lg">Loading...</div>
  ),
});

const DungeonView = dynamic(() => import("./DungeonView"), {
  ssr: false,
  loading: () => (
    <div className="p-6 bg-xianxia-dark border border-xianxia-accent/30 rounded-lg">Loading...</div>
  ),
});

const CombatView = dynamic(() => import("./CombatView"), {
  ssr: false,
  loading: () => (
    <div className="p-6 bg-xianxia-dark border border-xianxia-accent/30 rounded-lg">Loading...</div>
  ),
});

interface GameScreenProps {
  runId: string;
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}

function ProcessingIndicator({ locale, onCancel }: { locale: Locale; onCancel: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const showCancel = elapsed >= 10;

  return (
    <div className="p-4 bg-xianxia-accent/10 border border-xianxia-accent/30 rounded-lg text-center">
      <div className="text-xianxia-accent mb-1">
        {locale === "vi" ? "Đang xử lý lượt chơi..." : "Processing turn..."}
        <span className="ml-2 text-sm opacity-70">{elapsed}s</span>
      </div>
      {showCancel && (
        <button
          onClick={onCancel}
          className="mt-2 px-4 py-1.5 text-sm bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-lg text-red-300 transition-colors"
        >
          {locale === "vi" ? "Hủy & Thử lại" : "Cancel & Retry"}
        </button>
      )}
    </div>
  );
}

export default function GameScreen({ runId, locale, onLocaleChange }: GameScreenProps) {
  // Core game state management
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
  } = useGameState({ runId, locale });

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
  const [activeTab, setActiveTab] = useState<
    "game" | "character" | "sect" | "inventory" | "market" | "world"
  >("game");
  const [customAction, setCustomAction] = useState("");
  const marketInitializedRef = useRef(false);

  // Combat hook
  const {
    testCombat,
    setTestCombat,
    startTestCombat,
    handleTestCombatAction,
    activeCombat,
    setActiveCombat,
    handleActiveCombatAction,
    handleActiveCombatEnd,
  } = useCombat({ runId, locale, state, setState, setNarrative });

  // Item handlers hook
  const {
    handleEquipItem,
    handleMarketAction,
    handleRefreshMarket,
    handleExchange,
    handleDiscardItem,
    handleUseItem,
    handleEnhanceItem,
  } = useItemHandlers({ locale, setState, setError });

  // Travel handlers hook
  const { handleTravelArea, handleTravelRegion, handleDungeonAction } = useTravelHandlers({
    locale,
    setState,
    setError,
    setActiveCombat,
  });

  // Ability handlers hook
  const { handleAbilitySwap, handleToggleDualCultivation, handleSetExpSplit } = useAbilityHandlers({
    runId,
    locale,
    setState,
    setError,
  });

  // Event handlers hook
  const { handleEventChoice } = useEventHandlers({ locale, processTurn, setError });

  // Handle combat encounters from AI turn results
  useEffect(() => {
    if (!lastTurnEvents || lastTurnEvents.length === 0) return;

    const combatEncounter = lastTurnEvents.find(
      (e: { type: string; data?: { enemy?: Enemy } }) => e.type === "combat_encounter"
    );
    if (combatEncounter?.data?.enemy) {
      const enemy = combatEncounter.data.enemy as Enemy;
      if (!enemy.hp_max) {
        enemy.hp_max = enemy.hp;
      }
      setActiveCombat({
        enemy,
        log: [],
        playerTurn: true,
      });
    }
    setLastTurnEvents([]);
  }, [lastTurnEvents, setLastTurnEvents, setActiveCombat]);

  // Initialize market when market tab is opened (only once per session)
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
            } else {
              console.error("Failed to initialize market:", await response.text());
            }
          } catch (error) {
            console.error("Failed to initialize market:", error);
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

    // Check if can afford the cost
    if (selectedChoice?.cost && state) {
      if (selectedChoice.cost.stamina && state.stats.stamina < selectedChoice.cost.stamina) {
        setError(locale === "vi" ? "Không đủ Thể Lực!" : "Not enough Stamina!");
        return;
      }
      if (selectedChoice.cost.qi && state.stats.qi < selectedChoice.cost.qi) {
        setError(locale === "vi" ? "Không đủ Linh Lực!" : "Not enough Qi!");
        return;
      }
      if (selectedChoice.cost.silver && state.inventory.silver < selectedChoice.cost.silver) {
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

    const customChoice: Choice = {
      id: "custom_action",
      text: customAction.trim(),
    };

    await processTurn("custom_action", customChoice);
    setCustomAction("");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-xianxia-gold mx-auto" />
          <div className="text-xl text-xianxia-accent">{t(locale, "loading")}</div>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-500">{error || t(locale, "error")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto">
        {/* Save Status Indicator */}
        <div className="fixed top-4 left-4 z-50">
          {saveStatus === "saving" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/90 border border-blue-500/50 rounded-lg text-sm text-blue-200 animate-pulse shadow-lg backdrop-blur-sm">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>{locale === "vi" ? "Đang lưu..." : "Saving..."}</span>
            </div>
          )}
          {saveStatus === "saved" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-900/90 border border-green-500/50 rounded-lg text-sm text-green-200 animate-fade-in shadow-lg backdrop-blur-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>{locale === "vi" ? "Đã lưu" : "Saved"}</span>
            </div>
          )}
          {saveStatus === "error" && (
            <div className="flex flex-col gap-1 px-3 py-2 bg-red-900/90 border border-red-500/50 rounded-lg text-sm text-red-200 animate-shake shadow-lg backdrop-blur-sm max-w-xs">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>{locale === "vi" ? "Lỗi lưu dữ liệu" : "Save Failed"}</span>
              </div>
              {saveError && <p className="text-xs text-red-300/80 ml-6">{saveError}</p>}
              <button
                onClick={() => {
                  setSaveStatus("idle");
                  setSaveError("");
                }}
                className="ml-6 text-xs text-red-400 hover:text-red-300 underline"
              >
                {locale === "vi" ? "Bỏ qua" : "Dismiss"}
              </button>
            </div>
          )}
        </div>

        {/* Desktop Tab Navigation */}
        <div
          className="mb-6 hidden md:flex flex-wrap gap-2 border-b border-xianxia-accent/30 pb-2"
          role="tablist"
          aria-label="Game navigation"
        >
          <button
            onClick={() => setActiveTab("game")}
            role="tab"
            aria-selected={activeTab === "game"}
            className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg transition-colors ${
              activeTab === "game"
                ? "bg-xianxia-accent text-white"
                : "bg-xianxia-dark hover:bg-xianxia-accent/20"
            }`}
          >
            {t(locale, "tabGame")}
          </button>
          <button
            onClick={() => setActiveTab("character")}
            role="tab"
            aria-selected={activeTab === "character"}
            className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg transition-colors ${
              activeTab === "character"
                ? "bg-xianxia-accent text-white"
                : "bg-xianxia-dark hover:bg-xianxia-accent/20"
            }`}
          >
            {t(locale, "tabCharacter")}
          </button>
          <button
            onClick={() => setActiveTab("sect")}
            role="tab"
            aria-selected={activeTab === "sect"}
            className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg transition-colors ${
              activeTab === "sect"
                ? "bg-xianxia-accent text-white"
                : "bg-xianxia-dark hover:bg-xianxia-accent/20"
            }`}
          >
            {locale === "vi" ? "⛩️ Môn Phái" : "⛩️ Sect"}
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            role="tab"
            aria-selected={activeTab === "inventory"}
            className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg transition-colors ${
              activeTab === "inventory"
                ? "bg-xianxia-accent text-white"
                : "bg-xianxia-dark hover:bg-xianxia-accent/20"
            }`}
          >
            {t(locale, "tabInventory")}
          </button>
          <button
            onClick={() => setActiveTab("market")}
            role="tab"
            aria-selected={activeTab === "market"}
            className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg transition-colors ${
              activeTab === "market"
                ? "bg-xianxia-accent text-white"
                : "bg-xianxia-dark hover:bg-xianxia-accent/20"
            }`}
          >
            {locale === "vi" ? "Chợ" : "Market"}
          </button>
          <button
            onClick={() => setActiveTab("world")}
            role="tab"
            aria-selected={activeTab === "world"}
            className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg transition-colors ${
              activeTab === "world"
                ? "bg-xianxia-accent text-white"
                : "bg-xianxia-dark hover:bg-xianxia-accent/20"
            }`}
          >
            {locale === "vi" ? "🗺️ Thế Giới" : "🗺️ World"}
          </button>
          {/* Language Toggle */}
          {onLocaleChange && (
            <button
              onClick={() => onLocaleChange(locale === "vi" ? "en" : "vi")}
              className="ml-auto px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg bg-xianxia-dark hover:bg-xianxia-accent/20 transition-colors flex items-center gap-1"
              title={locale === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"}
              aria-label={locale === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"}
            >
              🌐 {locale === "vi" ? "EN" : "VI"}
            </button>
          )}
          {/* Help Button */}
          <button
            onClick={handleReopenTutorial}
            className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg bg-xianxia-dark hover:bg-xianxia-accent/20 transition-colors ${!onLocaleChange ? "ml-auto" : ""}`}
            title={locale === "vi" ? "Hướng dẫn" : "Tutorial"}
            aria-label={locale === "vi" ? "Mở hướng dẫn" : "Open tutorial"}
          >
            ❓
          </button>
        </div>

        {/* Mobile Bottom Navigation */}
        <div
          className="fixed bottom-0 left-0 right-0 md:hidden bg-xianxia-darker/95 backdrop-blur-sm border-t border-xianxia-accent/30 z-40"
          role="tablist"
          aria-label="Game navigation"
        >
          <div className="grid grid-cols-6 gap-0">
            {(
              [
                { id: "game" as const, icon: "🎮", label: locale === "vi" ? "Chơi" : "Play" },
                {
                  id: "character" as const,
                  icon: "👤",
                  label: locale === "vi" ? "Nhân vật" : "Char",
                },
                { id: "sect" as const, icon: "⛩️", label: locale === "vi" ? "Phái" : "Sect" },
                { id: "inventory" as const, icon: "🎒", label: locale === "vi" ? "Đồ" : "Bag" },
                { id: "market" as const, icon: "🏪", label: locale === "vi" ? "Chợ" : "Shop" },
                { id: "world" as const, icon: "🗺️", label: locale === "vi" ? "Map" : "Map" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`flex flex-col items-center py-2 px-1 transition-colors ${
                  activeTab === tab.id
                    ? "text-xianxia-gold bg-xianxia-accent/10"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="text-[10px] mt-0.5 leading-none">{tab.label}</span>
                {activeTab === tab.id && (
                  <div className="w-1 h-1 rounded-full bg-xianxia-gold mt-0.5" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile spacer for top + add language toggle inline on mobile */}
        <div className="md:hidden mb-4 flex justify-between items-center">
          <h1 className="text-lg font-bold text-xianxia-gold">
            {locale === "vi" ? "Tu Tiên RPG" : "Xianxia RPG"}
          </h1>
          <div className="flex items-center gap-2">
            {onLocaleChange && (
              <button
                onClick={() => onLocaleChange(locale === "vi" ? "en" : "vi")}
                className="px-3 py-1.5 text-sm rounded-lg bg-xianxia-dark hover:bg-xianxia-accent/20 transition-colors"
                title={locale === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"}
              >
                🌐 {locale === "vi" ? "EN" : "VI"}
              </button>
            )}
            <button
              onClick={handleReopenTutorial}
              className="px-3 py-1.5 text-sm rounded-lg bg-xianxia-dark hover:bg-xianxia-accent/20 transition-colors"
              title={locale === "vi" ? "Hướng dẫn" : "Tutorial"}
              aria-label={locale === "vi" ? "Mở hướng dẫn" : "Open tutorial"}
            >
              ❓
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === "game" && (
          <div className="space-y-6">
            {/* Cultivation Simulator Dashboard */}
            <CultivatorDashboard
              state={state}
              locale={locale}
              onActivityStart={(activityType: ActivityType, duration: number) => {
                const activityChoiceText =
                  locale === "vi"
                    ? `Bắt đầu ${activityType} trong ${duration} canh giờ`
                    : `Start ${activityType} for ${duration} segments`;
                processTurn(`activity_${activityType}_${duration}`, {
                  id: `activity_${activityType}_${duration}`,
                  text: activityChoiceText,
                });
              }}
              onActivityInterrupt={() => {
                const interruptText =
                  locale === "vi" ? "Dừng hoạt động hiện tại" : "Stop current activity";
                processTurn("interrupt_activity", {
                  id: "interrupt_activity",
                  text: interruptText,
                });
              }}
              compact={true}
            />

            {/* Narrative */}
            <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
              <div className="prose prose-invert max-w-none">
                {narrative ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{narrative}</p>
                ) : (
                  <p className="text-gray-500 italic">
                    {processing
                      ? locale === "vi"
                        ? "Đang tạo câu chuyện..."
                        : "Generating story..."
                      : locale === "vi"
                        ? "Bắt đầu cuộc phiêu lưu..."
                        : "Start your adventure..."}
                  </p>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200">
                {error}
              </div>
            )}

            {/* Choices */}
            {!processing && choices.length > 0 && (
              <div className="space-y-3">
                {choices.map((choice) => {
                  const canAfford =
                    !choice.cost ||
                    ((!choice.cost.stamina ||
                      (state && state.stats.stamina >= choice.cost.stamina)) &&
                      (!choice.cost.qi || (state && state.stats.qi >= choice.cost.qi)) &&
                      (!choice.cost.silver ||
                        (state && state.inventory.silver >= choice.cost.silver)) &&
                      (!choice.cost.spirit_stones ||
                        (state && state.inventory.spirit_stones >= choice.cost.spirit_stones)));

                  return (
                    <button
                      key={choice.id}
                      onClick={() => handleChoice(choice.id)}
                      disabled={processing || !canAfford}
                      className={`w-full text-left p-4 border rounded-lg transition-colors ${
                        !canAfford
                          ? "bg-red-900/20 border-red-500/30 opacity-60 cursor-not-allowed"
                          : "bg-xianxia-accent/10 hover:bg-xianxia-accent/20 border-xianxia-accent/30"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="font-medium">{choice.text}</div>
                      {choice.cost && (
                        <div className="text-sm mt-1 flex flex-wrap gap-2">
                          {choice.cost.stamina && (
                            <span
                              className={
                                state && state.stats.stamina < choice.cost.stamina
                                  ? "text-red-400"
                                  : "text-gray-400"
                              }
                            >
                              {t(locale, "stamina")}: {choice.cost.stamina}
                            </span>
                          )}
                          {choice.cost.qi && (
                            <span
                              className={
                                state && state.stats.qi < choice.cost.qi
                                  ? "text-red-400"
                                  : "text-gray-400"
                              }
                            >
                              {t(locale, "qi")}: {choice.cost.qi}
                            </span>
                          )}
                          {choice.cost.silver && (
                            <span
                              className={
                                state && state.inventory.silver < choice.cost.silver
                                  ? "text-red-400"
                                  : "text-gray-400"
                              }
                            >
                              {t(locale, "silver")}: {choice.cost.silver}
                            </span>
                          )}
                          {choice.cost.spirit_stones && (
                            <span
                              className={
                                state && state.inventory.spirit_stones < choice.cost.spirit_stones
                                  ? "text-red-400"
                                  : "text-gray-400"
                              }
                            >
                              {t(locale, "spiritStones")}: {choice.cost.spirit_stones}
                            </span>
                          )}
                          {choice.cost.time_segments && (
                            <span className="text-gray-400">Time: {choice.cost.time_segments}</span>
                          )}
                        </div>
                      )}
                      {!canAfford && (
                        <div className="text-xs text-red-400 mt-1">
                          {locale === "vi" ? "(Không đủ điều kiện)" : "(Cannot afford)"}
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Custom Action Input */}
                <div className="mt-4 p-4 bg-xianxia-darker border border-xianxia-accent/30 rounded-lg">
                  <label className="block text-sm font-medium text-xianxia-accent mb-2">
                    {locale === "vi"
                      ? "✍️ Hoặc nhập hành động của bạn:"
                      : "✍️ Or type your own action:"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customAction}
                      onChange={(e) => setCustomAction(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !processing && customAction.trim()) {
                          handleCustomAction();
                        }
                      }}
                      disabled={processing}
                      placeholder={
                        locale === "vi"
                          ? "Ví dụ: Tôi muốn khám phá hang động phía đông..."
                          : "Example: I want to explore the cave to the east..."
                      }
                      className="flex-1 px-4 py-2 bg-xianxia-dark border border-xianxia-accent/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-xianxia-accent disabled:opacity-50"
                    />
                    <button
                      onClick={handleCustomAction}
                      disabled={processing || !customAction.trim()}
                      className="px-6 py-2 bg-xianxia-accent hover:bg-xianxia-accent/80 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                    >
                      {locale === "vi" ? "Gửi" : "Submit"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {locale === "vi"
                      ? "Bạn có thể nhập bất kỳ hành động nào bạn muốn thực hiện. AI sẽ xử lý và tạo kết quả phù hợp với câu chuyện."
                      : "You can type any action you want to take. The AI will process it and generate results fitting the story."}
                  </p>
                </div>
              </div>
            )}

            {processing && <ProcessingIndicator locale={locale} onCancel={cancelProcessing} />}
          </div>
        )}

        {activeTab === "character" && (
          <CharacterSheet
            state={state}
            locale={locale}
            previousExp={previousExp}
            onAbilitySwap={handleAbilitySwap}
            onToggleDualCultivation={handleToggleDualCultivation}
            onSetExpSplit={handleSetExpSplit}
          />
        )}
        {activeTab === "sect" && <SectView state={state} locale={locale} />}
        {activeTab === "inventory" && (
          <InventoryView
            state={state}
            locale={locale}
            onEquipItem={handleEquipItem}
            onDiscardItem={handleDiscardItem}
            onUseItem={handleUseItem}
            onEnhanceItem={handleEnhanceItem}
          />
        )}
        {activeTab === "market" && (
          <MarketView
            state={state}
            locale={locale}
            onBuyItem={(id) => handleMarketAction(id, "buy")}
            onSellItem={(id) => handleMarketAction(id, "sell")}
            onRefreshMarket={handleRefreshMarket}
            onExchange={handleExchange}
          />
        )}
        {activeTab === "world" && (
          <div className="space-y-6">
            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={() => setError("")}
                  className="ml-4 text-sm underline hover:text-red-100"
                >
                  {locale === "vi" ? "Đóng" : "Dismiss"}
                </button>
              </div>
            )}

            {/* World Map */}
            <WorldMap
              state={state}
              locale={locale}
              onTravelArea={handleTravelArea}
              onTravelRegion={handleTravelRegion}
            />

            {/* Dungeon View (only show if in dungeon) */}
            <DungeonView state={state} locale={locale} onAction={handleDungeonAction} />
          </div>
        )}
      </div>

      {showTutorial && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="max-w-2xl w-full bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6 md:p-8 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={locale === "vi" ? "Hướng dẫn" : "Tutorial"}
          >
            {/* Step indicator */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === currentStep
                        ? "w-8 bg-xianxia-gold"
                        : i < currentStep
                          ? "w-4 bg-xianxia-accent"
                          : "w-4 bg-gray-600"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">
                {currentStep + 1} / {totalSteps}
              </span>
            </div>

            {/* Step content */}
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">{steps[currentStep].icon}</div>
              <h2 className="text-2xl md:text-3xl font-bold text-xianxia-gold mb-3">
                {locale === "vi" ? steps[currentStep].title : steps[currentStep].title_en}
              </h2>
              <p className="text-gray-200 leading-relaxed max-w-lg mx-auto">
                {locale === "vi" ? steps[currentStep].content : steps[currentStep].content_en}
              </p>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handlePrevStep}
                disabled={currentStep === 0}
                className="px-4 py-2.5 bg-xianxia-darker border border-xianxia-accent/50 hover:bg-xianxia-accent/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {locale === "vi" ? "← Trước" : "← Back"}
              </button>

              <button
                onClick={handleDismissTutorial}
                className="px-4 py-2.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                {locale === "vi" ? "Bỏ qua" : "Skip"}
              </button>

              <button
                onClick={handleNextStep}
                className="px-6 py-2.5 bg-xianxia-gold hover:bg-xianxia-gold/80 text-xianxia-darker rounded-lg font-bold transition-colors"
              >
                {currentStep < totalSteps - 1
                  ? locale === "vi"
                    ? "Tiếp →"
                    : "Next →"
                  : locale === "vi"
                    ? "Bắt đầu!"
                    : "Start!"}
              </button>
            </div>
          </div>
        </div>
      )}

      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 right-4 flex gap-2">
          <DebugInventory />
          <button
            onClick={startTestCombat}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg shadow-lg transition-colors"
          >
            {locale === "vi" ? "⚔️ Test Combat" : "⚔️ Test Combat"}
          </button>
        </div>
      )}

      {/* Test Combat View */}
      {testCombat && state && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
              className="mt-4 w-full py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
            >
              {locale === "vi" ? "Đóng Test Combat" : "Close Test Combat"}
            </button>
          </div>
        </div>
      )}

      {/* Active Combat View - Triggered by AI combat_encounter */}
      {activeCombat && state && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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

      {/* Breakthrough Modal */}
      {breakthroughEvent && (
        <BreakthroughModal
          event={breakthroughEvent}
          locale={locale}
          onClose={() => setBreakthroughEvent(null)}
        />
      )}

      {/* Event Modal */}
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
