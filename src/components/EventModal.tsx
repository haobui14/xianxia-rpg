"use client";

import { useState } from "react";
import { GameState } from "@/types/game";
import { RandomEvent, EventChoice } from "@/types/world";
import { Locale } from "@/lib/i18n/translations";

interface EventModalProps {
  event: RandomEvent | null;
  state: GameState;
  locale: Locale;
  onChoice: (choiceId: string) => Promise<void>;
  onClose?: () => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: "text-gray-400",
  uncommon: "text-green-400",
  rare: "text-blue-400",
  legendary: "text-purple-400",
};

const RARITY_BG: Record<string, string> = {
  common: "bg-gray-900/50",
  uncommon: "bg-green-900/50",
  rare: "bg-blue-900/50",
  legendary: "bg-purple-900/50",
};

export default function EventModal({ event, state, locale, onChoice, onClose }: EventModalProps) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!event) return null;

  const narrative = locale === "vi" ? event.narrative : event.narrative_en;

  const handleChoiceClick = async (choiceId: string) => {
    setSelectedChoice(choiceId);
    setIsProcessing(true);
    try {
      await onChoice(choiceId);
    } finally {
      setIsProcessing(false);
      setSelectedChoice(null);
    }
  };

  const isChoiceAvailable = (choice: EventChoice): { available: boolean; reason?: string } => {
    if (!choice.requirements) {
      return { available: true };
    }

    const req = choice.requirements;

    // Check stat requirement
    if (req.stat) {
      const parts = req.stat.key.split(".");
      let value: any = state;
      for (const part of parts) {
        value = value?.[part];
      }
      if (typeof value !== "number" || value < req.stat.min) {
        return {
          available: false,
          reason: `Requires ${parts[parts.length - 1]} >= ${req.stat.min}`,
        };
      }
    }

    // Check item requirement
    if (req.item) {
      const hasItem = state.inventory.items.some((item) => item.id === req.item);
      if (!hasItem) {
        return { available: false, reason: `Requires item: ${req.item}` };
      }
    }

    // Check skill requirement
    if (req.skill) {
      const hasSkill = state.skills.some((skill) => skill.id === req.skill);
      if (!hasSkill) {
        return { available: false, reason: `Requires skill: ${req.skill}` };
      }
    }

    // Check realm requirement
    if (req.realm) {
      const realms = ["PhàmNhân", "LuyệnKhí", "TrúcCơ", "KếtĐan", "NguyênAnh"];
      const playerIndex = realms.indexOf(state.progress.realm);
      const requiredIndex = realms.indexOf(req.realm);
      if (playerIndex < requiredIndex) {
        return { available: false, reason: `Requires realm: ${req.realm}` };
      }
    }

    // Check karma
    if (req.karma_min !== undefined && state.karma < req.karma_min) {
      return { available: false, reason: `Requires karma >= ${req.karma_min}` };
    }

    if (req.karma_max !== undefined && state.karma > req.karma_max) {
      return { available: false, reason: `Requires karma <= ${req.karma_max}` };
    }

    return { available: true };
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div
        className={`max-w-2xl w-full ${RARITY_BG[event.rarity]} border-2 ${RARITY_COLORS[event.rarity]} rounded-lg shadow-2xl`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-2xl font-bold ${RARITY_COLORS[event.rarity]}`}>
              {locale === "vi" ? event.name : event.name_en}
            </h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-1 rounded ${RARITY_BG[event.rarity]} ${RARITY_COLORS[event.rarity]}`}
            >
              {event.rarity.toUpperCase()}
            </span>
            {event.element_affinity && (
              <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                {event.element_affinity}
              </span>
            )}
          </div>
        </div>

        {/* Narrative */}
        <div className="p-6 bg-xianxia-darker/50">
          <div className="text-gray-200 leading-relaxed whitespace-pre-wrap">{narrative}</div>
        </div>

        {/* Choices */}
        <div className="p-4 space-y-2">
          <div className="text-sm text-gray-400 mb-3">
            {locale === "vi" ? "Lựa chọn của ngươi:" : "Your choice:"}
          </div>
          {event.choices.map((choice) => {
            const { available, reason } = isChoiceAvailable(choice);
            const isHidden = choice.hidden_until_met && !available;

            if (isHidden) return null;

            return (
              <button
                key={choice.id}
                onClick={() => handleChoiceClick(choice.id)}
                disabled={!available || isProcessing}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  available
                    ? selectedChoice === choice.id
                      ? "bg-xianxia-accent/20 border-xianxia-accent"
                      : "bg-xianxia-dark border-gray-700 hover:border-xianxia-accent/50 hover:bg-xianxia-dark/80"
                    : "bg-gray-900/50 border-gray-800 opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className={`font-medium ${available ? "text-white" : "text-gray-500"}`}>
                      {locale === "vi" ? choice.text : choice.text_en}
                    </div>
                    {!available && reason && (
                      <div className="text-xs text-red-400 mt-1">{reason}</div>
                    )}
                  </div>
                  {selectedChoice === choice.id && isProcessing && (
                    <div className="ml-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-xianxia-gold"></div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="p-4 bg-xianxia-darker/30 border-t border-gray-700 text-xs text-gray-400 space-y-1">
          {event.realm_requirement && (
            <div>
              {locale === "vi" ? "💫 Yêu cầu tu vi tối thiểu" : "💫 Minimum realm required"}:{" "}
              {event.realm_requirement}
            </div>
          )}
          {event.regions && (
            <div>
              {locale === "vi" ? "🗺️ Vùng" : "🗺️ Regions"}: {event.regions.join(", ")}
            </div>
          )}
          {event.cooldown_turns && (
            <div>
              {locale === "vi" ? "⏱️ Thời gian hồi" : "⏱️ Cooldown"}: {event.cooldown_turns}{" "}
              {locale === "vi" ? "lượt" : "turns"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
