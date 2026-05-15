"use client";

import { useState, useCallback } from "react";
import { InventoryItem, GameState } from "@/types/game";
import { Locale } from "@/lib/i18n/translations";
import {
  canEnhance,
  getEnhancementCost,
  getStatDifference,
  getEnhancedItemName,
  EnhancementResult,
} from "@/lib/game/enhancement";
import Modal, { ModalCloseButton } from "./Modal";
import { Card, Pill, Seal, SmallHead } from "@/components/ui";

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

const STAT_HAN: Record<string, string> = {
  hp: "血",
  qi: "氣",
  stamina: "體",
  str: "力",
  agi: "敏",
  int: "智",
  perception: "覺",
  luck: "命",
  cultivation_speed: "修",
};

function successRateColor(rate: number): string {
  if (rate >= 0.9) return "var(--jade-deep)";
  if (rate >= 0.7) return "var(--gold-deep)";
  if (rate >= 0.5) return "var(--cinnabar-deep)";
  return "var(--cinnabar)";
}

function successRateGradient(rate: number): string {
  if (rate >= 0.9)
    return "linear-gradient(90deg, var(--jade-deep), var(--jade-soft))";
  if (rate >= 0.7)
    return "linear-gradient(90deg, var(--gold-deep), var(--gold-soft))";
  if (rate >= 0.5)
    return "linear-gradient(90deg, var(--cinnabar-deep), var(--cinnabar))";
  return "linear-gradient(90deg, var(--cinnabar), var(--cinnabar-soft))";
}

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

  const handleEnhance = useCallback(async () => {
    if (!canEnhanceItem || !cost.canAfford || enhancing) return;
    setEnhancing(true);
    setShowAnimation(true);
    setResult(null);
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      // handleEnhanceItem (in useItemHandlers) now returns a result object
      // with `errorMessage` for expected failures instead of throwing.
      const enhanceResult = await onEnhance(item.id);
      setResult(enhanceResult);
    } catch (error) {
      // Truly unexpected failure (e.g. hook contract change). Surface inline
      // without spamming the dev-mode error overlay.
      if (process.env.NODE_ENV === "development") {
        console.warn("Unexpected enhancement throw:", error);
      }
      setResult({
        success: false,
        newLevel: 0,
        previousLevel: 0,
        errorMessage:
          error instanceof Error
            ? error.message
            : locale === "vi"
              ? "Đã xảy ra lỗi"
              : "Something went wrong",
      });
    } finally {
      setEnhancing(false);
      setTimeout(() => setShowAnimation(false), 500);
    }
  }, [canEnhanceItem, cost.canAfford, enhancing, item.id, onEnhance, locale]);

  return (
    <Modal isOpen={true} onClose={enhancing ? undefined : onClose} closeOnBackdrop={!enhancing}>
      <Card
        padding={26}
        className="card-corner"
        style={{ maxWidth: 480, width: "100%", position: "relative" }}
      >
        <span
          className="han-bg"
          style={{ position: "absolute", top: -16, right: -20, fontSize: 160 }}
          aria-hidden
        >
          煉
        </span>
        <div style={{ position: "relative", zIndex: 1 }}>
          {!enhancing && (
            <ModalCloseButton
              onClose={onClose}
              className="absolute"
            />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <Seal variant="cinnabar" size="md">煉</Seal>
            <div>
              <div className="label">{locale === "vi" ? "Khắc Trận" : "Enhance"}</div>
              <h2
                className="t-display"
                style={{ fontSize: 22, margin: 0, color: "var(--ink)", lineHeight: 1.1 }}
              >
                {locale === "vi" ? "Cường Hóa Trang Bị" : "Enhance Equipment"}
              </h2>
            </div>
          </div>

          {/* Item */}
          <div
            className="card-inset"
            style={{
              padding: 14,
              borderRadius: 3,
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                background: "var(--paper)",
                border: "1px solid var(--line-strong)",
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-han), 'Noto Serif SC', serif",
                fontSize: 22,
                color: "var(--ink)",
                flexShrink: 0,
              }}
            >
              器
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="t-display"
                style={{
                  fontSize: 17,
                  color: "var(--ink)",
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {getEnhancedItemName(item, locale)}
              </div>
              <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                <Pill variant="gold">+{currentLevel}</Pill>
                <Pill>{item.rarity}</Pill>
              </div>
            </div>
          </div>

          {showAnimation && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(20, 24, 32, 0.55)",
                backdropFilter: "blur(4px)",
                zIndex: 20,
                borderRadius: 4,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <span className="seal lg breathe" style={{ marginBottom: 12 }}>
                  煉
                </span>
                <div
                  className="label"
                  style={{
                    color: "var(--paper)",
                    fontSize: 12,
                    marginTop: 14,
                    letterSpacing: "0.2em",
                  }}
                >
                  {locale === "vi" ? "Đang Cường Hóa…" : "Enhancing…"}
                </div>
              </div>
            </div>
          )}

          {/* Result */}
          {result && !showAnimation && (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                background: "var(--paper-deep)",
                borderLeft: `3px solid ${
                  result.success ? "var(--jade)" : "var(--cinnabar)"
                }`,
                textAlign: "center",
              }}
            >
              <div
                className="t-display"
                style={{
                  fontSize: 16,
                  color: result.success
                    ? "var(--jade-deep)"
                    : "var(--cinnabar-deep)",
                }}
              >
                <span className="t-han" style={{ marginRight: 6 }}>
                  {result.success ? "成" : "敗"}
                </span>
                {result.success
                  ? locale === "vi"
                    ? "Cường Hóa Thành Công"
                    : "Enhancement Succeeded"
                  : locale === "vi"
                    ? "Cường Hóa Thất Bại"
                    : "Enhancement Failed"}
              </div>
              {result.success && (
                <div
                  className="t-num"
                  style={{
                    fontSize: 13,
                    color: "var(--ink-soft)",
                    marginTop: 4,
                  }}
                >
                  +{result.previousLevel} → +{result.newLevel}
                </div>
              )}
              {!result.success && result.errorMessage && (
                <div
                  className="t-body"
                  style={{
                    fontStyle: "italic",
                    fontSize: 12,
                    color: "var(--cinnabar-deep)",
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  {result.errorMessage}
                </div>
              )}
            </div>
          )}

          {/* Stat changes */}
          {canEnhanceItem && Object.keys(statDiff).length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <SmallHead>
                {locale === "vi" ? "Thay Đổi Chỉ Số" : "Stat Changes"}
              </SmallHead>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {Object.entries(statDiff).map(([stat, diff]) => (
                  <div
                    key={stat}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      padding: "4px 0",
                      borderBottom: "1px dotted var(--line)",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: "var(--ink-soft)" }}>
                      <span
                        className="t-han"
                        style={{
                          color: "var(--cinnabar-deep)",
                          marginRight: 6,
                        }}
                      >
                        {STAT_HAN[stat] ?? "屬"}
                      </span>
                      {STAT_LABELS[stat]?.[locale === "vi" ? "vi" : "en"] ?? stat}
                    </span>
                    <span
                      className="t-num"
                      style={{ fontSize: 13, color: "var(--ink)" }}
                    >
                      <span style={{ color: "var(--ink-mute)" }}>{diff.current}</span>
                      <span style={{ color: "var(--ink-mute)", margin: "0 6px" }}>
                        →
                      </span>
                      <span style={{ color: "var(--jade-deep)", fontWeight: 600 }}>
                        {diff.next}
                      </span>
                      <span
                        style={{
                          color: "var(--jade-deep)",
                          fontSize: 11,
                          marginLeft: 4,
                        }}
                      >
                        (+{diff.diff})
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost */}
          {canEnhanceItem && (
            <div style={{ marginBottom: 14 }}>
              <SmallHead>{locale === "vi" ? "Phí Tổn" : "Cost"}</SmallHead>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    padding: "4px 0",
                    borderBottom: "1px dotted var(--line)",
                  }}
                >
                  <span style={{ color: "var(--ink-soft)" }}>
                    <span
                      className="t-han"
                      style={{ color: "var(--gold-deep)", marginRight: 6 }}
                    >
                      銀
                    </span>
                    {locale === "vi" ? "Bạc" : "Silver"}
                  </span>
                  <span
                    className="t-num"
                    style={{
                      fontSize: 13,
                      color:
                        state.inventory.silver >= cost.silver
                          ? "var(--ink)"
                          : "var(--cinnabar-deep)",
                    }}
                  >
                    {cost.silver.toLocaleString()}
                    <span style={{ color: "var(--ink-faint)" }}>
                      {" "}
                      / {state.inventory.silver.toLocaleString()}
                    </span>
                  </span>
                </div>
                {cost.materials.map((material) => (
                  <div
                    key={material.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      padding: "4px 0",
                      borderBottom: "1px dotted var(--line)",
                    }}
                  >
                    <span style={{ color: "var(--ink-soft)" }}>
                      <span
                        className="t-han"
                        style={{
                          color: "var(--cinnabar-deep)",
                          marginRight: 6,
                        }}
                      >
                        材
                      </span>
                      {locale === "vi" ? material.name : material.name_en}
                    </span>
                    <span
                      className="t-num"
                      style={{
                        fontSize: 13,
                        color: material.hasEnough
                          ? "var(--jade-deep)"
                          : "var(--cinnabar-deep)",
                      }}
                    >
                      {material.quantity}× {material.hasEnough ? "✓" : "✗"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success rate */}
          {canEnhanceItem && (
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 6,
                }}
              >
                <span className="label">
                  {locale === "vi" ? "Tỷ Lệ Thành Công" : "Success Rate"}
                </span>
                <span
                  className="t-num"
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: successRateColor(cost.successRate),
                  }}
                >
                  {Math.round(cost.successRate * 100)}%
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: "var(--paper-darker)",
                  border: "1px solid var(--line)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${cost.successRate * 100}%`,
                    background: successRateGradient(cost.successRate),
                    transition: "width 0.4s",
                  }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              className="ink-btn ghost"
              style={{ flex: 1, justifyContent: "center" }}
            >
              {locale === "vi" ? "Đóng" : "Close"}
            </button>
            {canEnhanceItem && (
              <button
                onClick={handleEnhance}
                disabled={!cost.canAfford || enhancing}
                className="ink-btn primary"
                style={{ flex: 1, justifyContent: "center" }}
              >
                <span className="t-han">煉</span>
                {enhancing
                  ? locale === "vi"
                    ? "Đang xử lý…"
                    : "Processing…"
                  : locale === "vi"
                    ? "Khắc Trận"
                    : "Enhance"}
              </button>
            )}
          </div>

          {!canEnhanceItem && (
            <div
              className="t-body"
              style={{
                marginTop: 14,
                textAlign: "center",
                fontStyle: "italic",
                color: "var(--gold-deep)",
                fontSize: 13,
              }}
            >
              {locale === "vi"
                ? "Trang bị đã đạt cấp cường hóa tối cao."
                : "Equipment has reached its enhancement peak."}
            </div>
          )}
        </div>
      </Card>
    </Modal>
  );
}
