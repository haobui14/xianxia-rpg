"use client";

import { useState, useCallback } from "react";
import { InventoryItem, GameState } from "@/types/game";
import { Locale } from "@/lib/i18n/translations";
import {
  canEnhance,
  getEnhancementCost,
  getStatDifference,
  getEnhancedItemName,
  getEnhancementColor,
  EnhancementResult,
} from "@/lib/game/enhancement";

interface EnhancementViewProps {
  item: InventoryItem;
  state: GameState;
  locale: Locale;
  onEnhance: (itemId: string) => Promise<EnhancementResult | null>;
  onClose: () => void;
}

const STAT_LABELS: Record<string, { vi: string; en: string }> = {
  hp: { vi: "HP", en: "HP" },
  qi: { vi: "Khí", en: "Qi" },
  stamina: { vi: "Thể lực", en: "Stamina" },
  str: { vi: "Sức mạnh", en: "Strength" },
  agi: { vi: "Nhanh nhẹn", en: "Agility" },
  int: { vi: "Trí tuệ", en: "Intelligence" },
  perception: { vi: "Giác quan", en: "Perception" },
  luck: { vi: "May mắn", en: "Luck" },
  cultivation_speed: { vi: "Tốc độ tu luyện", en: "Cultivation Speed" },
};

export default function EnhancementView({
  item,
  state,
  locale,
  onEnhance,
  onClose,
}: EnhancementViewProps) {
  const [enhancing, setEnhancing] = useState(false);
  const [result, setResult] = useState<EnhancementResult | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);

  const currentLevel = item.enhancement_level || 0;
  const canEnhanceItem = canEnhance(item);
  const cost = getEnhancementCost(item, state);
  const statDiff = getStatDifference(item);

  // Get success rate color
  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 0.9) return "text-green-400";
    if (rate >= 0.7) return "text-yellow-400";
    if (rate >= 0.5) return "text-orange-400";
    return "text-red-400";
  };

  const handleEnhance = useCallback(async () => {
    if (!canEnhanceItem || !cost.canAfford || enhancing) return;

    setEnhancing(true);
    setShowAnimation(true);
    setResult(null);

    // Simulate enhancement delay for dramatic effect
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const enhanceResult = await onEnhance(item.id);
      setResult(enhanceResult);
    } catch (error) {
      console.error("Enhancement error:", error);
    } finally {
      setEnhancing(false);
      setTimeout(() => setShowAnimation(false), 500);
    }
  }, [canEnhanceItem, cost.canAfford, enhancing, item.id, onEnhance]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>

        {/* Title */}
        <h2 className="text-xl font-bold text-xianxia-gold mb-4">
          {locale === "vi" ? "Cường Hóa Trang Bị" : "Enhance Equipment"}
        </h2>

        {/* Item Display */}
        <div className="bg-xianxia-darker rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-xianxia-accent/20 rounded-lg flex items-center justify-center text-2xl">
              ⚔️
            </div>
            <div>
              <div className={`font-bold ${getEnhancementColor(currentLevel)}`}>
                {getEnhancedItemName(item, locale)}
              </div>
              <div className="text-sm text-gray-400">
                {locale === "vi" ? `Cấp: +${currentLevel}` : `Level: +${currentLevel}`}
              </div>
            </div>
          </div>
        </div>

        {/* Enhancement Animation Overlay */}
        {showAnimation && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg z-10">
            <div className="text-center">
              <div className="text-4xl mb-2 animate-bounce">✨</div>
              <div className="text-xianxia-gold animate-pulse">
                {locale === "vi" ? "Đang cường hóa..." : "Enhancing..."}
              </div>
            </div>
          </div>
        )}

        {/* Result Display */}
        {result && !showAnimation && (
          <div
            className={`mb-4 p-4 rounded-lg border ${
              result.success
                ? "bg-green-900/30 border-green-500/50"
                : "bg-red-900/30 border-red-500/50"
            }`}
          >
            <div
              className={`text-center font-bold ${result.success ? "text-green-400" : "text-red-400"}`}
            >
              {result.success
                ? locale === "vi"
                  ? "✓ Cường hóa thành công!"
                  : "✓ Enhancement Successful!"
                : locale === "vi"
                  ? "✗ Cường hóa thất bại!"
                  : "✗ Enhancement Failed!"}
            </div>
            {result.success && (
              <div className="text-center text-sm text-gray-300 mt-1">
                +{result.previousLevel} → +{result.newLevel}
              </div>
            )}
          </div>
        )}

        {/* Stat Comparison */}
        {canEnhanceItem && Object.keys(statDiff).length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-400 mb-2">
              {locale === "vi" ? "Thay đổi chỉ số:" : "Stat Changes:"}
            </h3>
            <div className="space-y-2">
              {Object.entries(statDiff).map(([stat, diff]) => (
                <div key={stat} className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">
                    {STAT_LABELS[stat]?.[locale === "vi" ? "vi" : "en"] || stat}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{diff.current}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-green-400">{diff.next}</span>
                    <span className="text-green-400 text-xs">(+{diff.diff})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cost Display */}
        {canEnhanceItem && (
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-400 mb-2">
              {locale === "vi" ? "Chi phí:" : "Cost:"}
            </h3>
            <div className="space-y-2">
              {/* Silver cost */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">{locale === "vi" ? "Bạc" : "Silver"}</span>
                <span
                  className={
                    state.inventory.silver >= cost.silver ? "text-xianxia-silver" : "text-red-400"
                  }
                >
                  {cost.silver.toLocaleString()} / {state.inventory.silver.toLocaleString()}
                </span>
              </div>

              {/* Material costs */}
              {cost.materials.map((material) => (
                <div key={material.id} className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">
                    {locale === "vi" ? material.name : material.name_en}
                  </span>
                  <span className={material.hasEnough ? "text-green-400" : "text-red-400"}>
                    {material.quantity}x {material.hasEnough ? "✓" : "✗"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success Rate */}
        {canEnhanceItem && (
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">
                {locale === "vi" ? "Tỷ lệ thành công:" : "Success Rate:"}
              </span>
              <span className={`font-bold ${getSuccessRateColor(cost.successRate)}`}>
                {Math.round(cost.successRate * 100)}%
              </span>
            </div>
            {/* Success rate bar */}
            <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  cost.successRate >= 0.9
                    ? "bg-green-500"
                    : cost.successRate >= 0.7
                      ? "bg-yellow-500"
                      : cost.successRate >= 0.5
                        ? "bg-orange-500"
                        : "bg-red-500"
                }`}
                style={{ width: `${cost.successRate * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            {locale === "vi" ? "Đóng" : "Close"}
          </button>

          {canEnhanceItem && (
            <button
              onClick={handleEnhance}
              disabled={!cost.canAfford || enhancing}
              className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
                cost.canAfford && !enhancing
                  ? "bg-xianxia-gold hover:bg-yellow-500 text-black"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
            >
              {enhancing
                ? locale === "vi"
                  ? "Đang xử lý..."
                  : "Processing..."
                : locale === "vi"
                  ? "Cường Hóa"
                  : "Enhance"}
            </button>
          )}
        </div>

        {/* Max level message */}
        {!canEnhanceItem && (
          <div className="text-center text-yellow-400 mt-4">
            {locale === "vi"
              ? "Trang bị đã đạt cấp cường hóa tối đa!"
              : "Equipment has reached max enhancement level!"}
          </div>
        )}
      </div>
    </div>
  );
}
