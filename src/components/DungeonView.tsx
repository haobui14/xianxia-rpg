"use client";

import { useState, useEffect } from "react";
import { GameState } from "@/types/game";
import { Locale } from "@/lib/i18n/translations";

interface DungeonViewProps {
  state: GameState;
  locale: Locale;
  onAction: (action: string, params?: any) => Promise<any>;
}

interface DungeonInfo {
  id: string;
  name: string;
  name_en: string;
  type: string;
  tier: number;
  floors: number;
  time_limit?: number;
  recommended_realm: string;
}

interface DungeonProgress {
  currentFloor: number;
  totalFloors: number;
  floorsCleared: number;
  percentComplete: number;
  turnsRemaining: number | null;
  turnsSpent: number;
  chestsCollected: number;
  secretsFound: number;
  dungeon_name: string;
  dungeon_name_en: string;
  floor_name: string;
  floor_name_en: string;
  has_mini_boss: boolean;
  has_floor_boss: boolean;
  boss_defeated: boolean;
  is_complete: boolean;
}

export default function DungeonView({ state, locale, onAction }: DungeonViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<DungeonProgress | null>(null);
  const [availableDungeons, setAvailableDungeons] = useState<any[]>([]);
  const [showDungeonList, setShowDungeonList] = useState(false);
  const [exploreMessage, setExploreMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "warning" | "danger">("success");

  const isInDungeon = state.dungeon?.dungeon_id !== null;

  // Fetch progress if in dungeon
  useEffect(() => {
    if (isInDungeon) {
      fetchProgress();
    }
  }, [isInDungeon]);

  // Refresh progress when state changes (after combat, etc.)
  useEffect(() => {
    if (isInDungeon && state.dungeon) {
      fetchProgress();
    }
  }, [state.dungeon?.turns_spent, state.dungeon?.current_floor]);

  const fetchProgress = async () => {
    try {
      const response = await fetch("/api/dungeon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_progress" }),
      });
      const data = await response.json();
      if (data.success) {
        setProgress(data.progress);
      }
    } catch (error) {
      console.error("Failed to fetch dungeon progress:", error);
    }
  };

  const fetchDungeonList = async () => {
    try {
      const response = await fetch("/api/dungeon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_dungeons" }),
      });
      const data = await response.json();
      if (data.success) {
        setAvailableDungeons(data.dungeons);
        setShowDungeonList(true);
      }
    } catch (error) {
      console.error("Failed to fetch dungeon list:", error);
    }
  };

  const handleDungeonAction = async (action: string, params?: any) => {
    setIsLoading(true);
    setExploreMessage(null);
    try {
      // For explore_floor, call onAction (parent handles combat) and show UI feedback
      if (action === "explore_floor") {
        const result = await onAction(action, params);

        if (result && result.success) {
          if (result.time_expired) {
            setMessageType("danger");
            setExploreMessage(
              locale === "vi"
                ? "⏰ Hết thời gian! Bị đẩy ra khỏi bí cảnh."
                : "⏰ Time expired! Forced out of dungeon."
            );
            setProgress(null);
          } else if (result.encounter) {
            setMessageType("warning");
            setExploreMessage(
              locale === "vi"
                ? `⚔️ Gặp kẻ địch! ${result.encounter.enemies.length} đối thủ xuất hiện.`
                : `⚔️ Enemy encounter! ${result.encounter.enemies.length} enemies appeared.`
            );
            await fetchProgress();
          } else {
            setMessageType("success");
            setExploreMessage(
              locale === "vi"
                ? `✓ Khám phá thành công. Còn lại ${result.turns_remaining || "?"} lượt.`
                : `✓ Explored successfully. ${result.turns_remaining || "?"} turns remaining.`
            );
            await fetchProgress();
          }

          // Auto-hide success messages after 3 seconds
          if (result.encounter === null && !result.time_expired) {
            setTimeout(() => setExploreMessage(null), 3000);
          }
        }
      } else {
        await onAction(action, params);
        if (action === "exit" || action === "enter") {
          await fetchProgress();
        }
        if (action === "exit") {
          setProgress(null);
        }
      }
    } catch (error) {
      setMessageType("danger");
      setExploreMessage(locale === "vi" ? "Lỗi khi khám phá" : "Exploration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "text-green-400";
      case "normal":
        return "text-yellow-400";
      case "hard":
        return "text-orange-400";
      case "deadly":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  if (!isInDungeon) {
    return (
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-4">
        <h2 className="text-xl font-bold mb-4 text-xianxia-gold flex items-center gap-2">
          🏛️ {locale === "vi" ? "Bí Cảnh & Mê Cung" : "Dungeons & Secret Realms"}
        </h2>

        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            {locale === "vi" ? "Ngươi chưa vào bí cảnh nào" : "You are not in a dungeon"}
          </div>
          <button
            onClick={fetchDungeonList}
            className="px-6 py-2 bg-xianxia-accent hover:bg-xianxia-accent/80 rounded-lg font-medium transition-colors"
          >
            {locale === "vi" ? "Xem danh sách bí cảnh" : "View available dungeons"}
          </button>
        </div>

        {/* Dungeon List Modal */}
        {showDungeonList && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="max-w-4xl w-full bg-xianxia-dark border border-xianxia-accent rounded-lg max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-xianxia-dark border-b border-gray-700 p-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-xianxia-gold">
                  {locale === "vi" ? "Bí Cảnh Có Sẵn" : "Available Dungeons"}
                </h3>
                <button
                  onClick={() => setShowDungeonList(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="p-4 space-y-3">
                {availableDungeons.map((dungeon) => (
                  <div
                    key={dungeon.id}
                    className="bg-xianxia-darker border border-gray-700 rounded-lg p-4 hover:border-xianxia-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-lg font-bold text-white">
                          {locale === "vi" ? dungeon.name : dungeon.name_en}
                        </h4>
                        <div className="flex items-center gap-2 text-sm mt-1">
                          <span className="text-gray-400">
                            {locale === "vi" ? "Cấp" : "Tier"}: {"⭐".repeat(dungeon.tier)}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className={getDifficultyColor(dungeon.difficulty)}>
                            {dungeon.difficulty}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-400">
                            {dungeon.floors} {locale === "vi" ? "tầng" : "floors"}
                          </span>
                        </div>
                      </div>
                      {dungeon.cleared_before && (
                        <span className="px-2 py-1 bg-green-900/50 text-green-400 rounded text-xs">
                          ✓ {locale === "vi" ? "Đã hoàn thành" : "Cleared"} ({dungeon.times_cleared}
                          x)
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-400 mb-3">
                      {locale === "vi" ? "Khuyến nghị" : "Recommended"}: {dungeon.recommended_realm}
                    </div>

                    <button
                      onClick={() => {
                        handleDungeonAction("enter", {
                          dungeon_id: dungeon.id,
                        });
                        setShowDungeonList(false);
                      }}
                      disabled={isLoading}
                      className="w-full py-2 bg-xianxia-accent hover:bg-xianxia-accent/80 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
                    >
                      {locale === "vi" ? "Vào bí cảnh" : "Enter dungeon"}
                    </button>
                  </div>
                ))}

                {availableDungeons.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    {locale === "vi"
                      ? "Không có bí cảnh nào trong vùng này"
                      : "No dungeons available in this region"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-4">
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xianxia-gold mx-auto"></div>
        </div>
      </div>
    );
  }

  const progressPercent = (progress.currentFloor / progress.totalFloors) * 100;

  return (
    <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-xianxia-gold mb-2">
          {locale === "vi" ? progress.dungeon_name : progress.dungeon_name_en}
        </h2>
        <div className="text-gray-400 text-sm">
          {locale === "vi" ? progress.floor_name : progress.floor_name_en}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-400">{locale === "vi" ? "Tiến độ" : "Progress"}</span>
          <span className="text-xianxia-gold font-medium">
            {progress.currentFloor} / {progress.totalFloors} {locale === "vi" ? "tầng" : "floors"}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-xianxia-accent to-xianxia-gold h-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {progress.turnsRemaining !== null && (
          <div className="bg-xianxia-darker rounded p-3">
            <div className="text-xs text-gray-400">
              {locale === "vi" ? "Lượt còn lại" : "Turns remaining"}
            </div>
            <div
              className={`text-lg font-bold ${progress.turnsRemaining <= 10 ? "text-red-400" : "text-white"}`}
            >
              {progress.turnsRemaining}
            </div>
          </div>
        )}
        <div className="bg-xianxia-darker rounded p-3">
          <div className="text-xs text-gray-400">
            {locale === "vi" ? "Rương đã mở" : "Chests opened"}
          </div>
          <div className="text-lg font-bold text-white">{progress.chestsCollected}</div>
        </div>
        <div className="bg-xianxia-darker rounded p-3">
          <div className="text-xs text-gray-400">{locale === "vi" ? "Bí mật" : "Secrets"}</div>
          <div className="text-lg font-bold text-white">{progress.secretsFound}</div>
        </div>
        <div className="bg-xianxia-darker rounded p-3">
          <div className="text-xs text-gray-400">
            {locale === "vi" ? "Tầng đã qua" : "Floors cleared"}
          </div>
          <div className="text-lg font-bold text-white">{progress.floorsCleared}</div>
        </div>
      </div>

      {/* Boss Indicators */}
      {(progress.has_mini_boss || progress.has_floor_boss) && (
        <div className="mb-4 space-y-2">
          {progress.has_mini_boss && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-orange-400">⚔️</span>
              <span className="text-gray-300">
                {locale === "vi" ? "Tầng này có tiểu Boss" : "Mini-boss on this floor"}
              </span>
            </div>
          )}
          {progress.has_floor_boss && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-red-400">👹</span>
              <span className="text-gray-300">
                {locale === "vi" ? "Boss tầng đang chờ!" : "Floor boss awaits!"}
              </span>
              {progress.boss_defeated && (
                <span className="text-green-400 text-xs">
                  (✓ {locale === "vi" ? "Đã đánh bại" : "Defeated"})
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Exploration Message */}
      {exploreMessage && (
        <div
          className={`p-3 rounded-lg border mb-4 ${
            messageType === "success"
              ? "bg-green-900/30 border-green-500/50 text-green-200"
              : messageType === "warning"
                ? "bg-yellow-900/30 border-yellow-500/50 text-yellow-200"
                : "bg-red-900/30 border-red-500/50 text-red-200"
          }`}
        >
          {exploreMessage}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => handleDungeonAction("explore_floor")}
          disabled={isLoading}
          className="w-full py-3 bg-xianxia-accent hover:bg-xianxia-accent/80 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {isLoading
            ? locale === "vi"
              ? "⏳ Đang khám phá..."
              : "⏳ Exploring..."
            : locale === "vi"
              ? "🔍 Khám phá tầng"
              : "🔍 Explore floor"}
        </button>

        {progress.boss_defeated && progress.currentFloor < progress.totalFloors && (
          <button
            onClick={() => handleDungeonAction("advance_floor")}
            disabled={isLoading}
            className="w-full py-3 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            {locale === "vi" ? "⬆️ Lên tầng tiếp theo" : "⬆️ Advance to next floor"}
          </button>
        )}

        {progress.is_complete && (
          <button
            onClick={() => handleDungeonAction("exit")}
            disabled={isLoading}
            className="w-full py-3 bg-xianxia-gold hover:bg-xianxia-gold/80 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            {locale === "vi" ? "🏆 Hoàn thành & nhận thưởng" : "🏆 Complete & claim rewards"}
          </button>
        )}

        <button
          onClick={() => handleDungeonAction("exit")}
          disabled={isLoading}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 rounded-lg font-medium transition-colors text-sm"
        >
          {locale === "vi" ? "Thoát bí cảnh" : "Exit dungeon"}
        </button>
      </div>
    </div>
  );
}
