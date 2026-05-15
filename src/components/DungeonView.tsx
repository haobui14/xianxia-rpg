"use client";

import { useState, useEffect, useCallback } from "react";
import { GameState } from "@/types/game";
import { Locale } from "@/lib/i18n/translations";
import Modal from "./Modal";
import { Card, Pill, SectionHead, Seal, SmallHead, Stat } from "@/components/ui";

interface DungeonViewProps {
  state: GameState;
  locale: Locale;
  onAction: (action: string, params?: any) => Promise<any>;
}

interface FloorChestInfo {
  regular: number;
  hidden: number;
  collected: number;
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
  floor_chests?: FloorChestInfo;
  current_floor?: number;
}

interface AvailableDungeon {
  id: string;
  name: string;
  name_en: string;
  tier: number;
  floors: number;
  difficulty: string;
  recommended_realm: string;
  cleared_before?: boolean;
  times_cleared?: number;
}

const DIFFICULTY_META: Record<
  string,
  { vi: string; en: string; color: string; variant: "jade" | "gold" | "cinnabar" | "default" }
> = {
  easy: { vi: "Dễ", en: "Easy", color: "var(--jade-deep)", variant: "jade" },
  normal: { vi: "Trung", en: "Normal", color: "var(--gold-deep)", variant: "gold" },
  hard: { vi: "Khó", en: "Hard", color: "var(--cinnabar-deep)", variant: "cinnabar" },
  deadly: { vi: "Tử", en: "Deadly", color: "var(--cinnabar)", variant: "cinnabar" },
};

export default function DungeonView({ state, locale, onAction }: DungeonViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [progress, setProgress] = useState<DungeonProgress | null>(null);
  const [availableDungeons, setAvailableDungeons] = useState<AvailableDungeon[]>([]);
  const [showDungeonList, setShowDungeonList] = useState(false);
  const [exploreMessage, setExploreMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "warning" | "danger">("success");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lootItems, setLootItems] = useState<string[]>([]);

  const isInDungeon = state.dungeon?.dungeon_id !== null && state.dungeon?.dungeon_id !== undefined;

  const fetchProgress = useCallback(async () => {
    try {
      setFetchError(null);
      const response = await fetch("/api/dungeon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_progress" }),
      });
      const data = await response.json();
      if (data.success) {
        setProgress(data.progress);
      } else {
        setFetchError(locale === "vi" ? "Không thể tải tiến độ" : "Failed to load progress");
      }
    } catch (error) {
      console.error("Failed to fetch dungeon progress:", error);
      setFetchError(locale === "vi" ? "Lỗi kết nối" : "Connection error");
    }
  }, [locale]);

  useEffect(() => {
    if (isInDungeon) fetchProgress();
  }, [isInDungeon, fetchProgress]);

  useEffect(() => {
    if (isInDungeon && state.dungeon) fetchProgress();
  }, [
    isInDungeon,
    state.dungeon,
    state.dungeon?.turns_spent,
    state.dungeon?.current_floor,
    fetchProgress,
  ]);

  const fetchDungeonList = async () => {
    setFetchError(null);
    setIsLoading(true);
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
      } else {
        setFetchError(locale === "vi" ? "Không thể tải danh sách" : "Failed to load dungeon list");
      }
    } catch (error) {
      console.error("Failed to fetch dungeon list:", error);
      setFetchError(locale === "vi" ? "Lỗi kết nối" : "Connection error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDungeonAction = async (action: string, params?: any) => {
    setBusyAction(action);
    setIsLoading(true);
    if (action !== "collect_chest") {
      setExploreMessage(null);
      setLootItems([]);
    }
    try {
      if (action === "explore_floor") {
        const result = await onAction(action, params);
        if (result && result.success) {
          if (result.time_expired) {
            setMessageType("danger");
            setExploreMessage(
              locale === "vi"
                ? "Hết thời gian! Bị đẩy ra khỏi bí cảnh."
                : "Time expired! Forced out of dungeon."
            );
            setProgress(null);
          } else if (result.encounter) {
            setMessageType("warning");
            setExploreMessage(
              locale === "vi"
                ? `Gặp kẻ địch — ${result.encounter.enemies.length} đối thủ xuất hiện.`
                : `Enemy encounter — ${result.encounter.enemies.length} foes appeared.`
            );
            await fetchProgress();
          } else {
            setMessageType("success");
            const foundItems: string[] = [];
            if (result.loot && Array.isArray(result.loot)) {
              for (const item of result.loot) {
                foundItems.push(item.name || item.name_en || item.id || "???");
              }
            }
            if (result.chest_loot && Array.isArray(result.chest_loot)) {
              for (const item of result.chest_loot) {
                foundItems.push(item.name || item.name_en || item.id || "???");
              }
            }
            setLootItems(foundItems);
            setExploreMessage(
              locale === "vi"
                ? `Khám phá thành công. Còn ${result.turns_remaining ?? "?"} lượt.`
                : `Explored successfully. ${result.turns_remaining ?? "?"} turns remaining.`
            );
            await fetchProgress();
          }
          if (result.encounter === null && !result.time_expired) {
            setTimeout(() => {
              setExploreMessage(null);
              setLootItems([]);
            }, 4000);
          }
        }
      } else if (action === "collect_chest") {
        const result = await onAction(action, params);
        if (result?.success) {
          const items: string[] = [];
          if (result.loot?.items) {
            for (const item of result.loot.items) {
              items.push(
                `${locale === "vi" ? item.name : item.name_en ?? item.name} ×${item.quantity ?? 1}`
              );
            }
          }
          const silver = result.loot?.silver ?? 0;
          const stones = result.loot?.spirit_stones ?? 0;
          const resourceParts: string[] = [];
          if (silver > 0) resourceParts.push(`+${silver} 銀`);
          if (stones > 0) resourceParts.push(`+${stones} 靈`);
          const resourceLine = resourceParts.join(" · ");
          setMessageType("success");
          setLootItems(items);
          setExploreMessage(
            locale === "vi"
              ? `Mở rương thành công. ${resourceLine}`
              : `Chest opened. ${resourceLine}`
          );
          await fetchProgress();
          setTimeout(() => {
            setExploreMessage(null);
            setLootItems([]);
          }, 5000);
        } else if (result?.error) {
          setMessageType("danger");
          setExploreMessage(result.error);
        }
      } else {
        await onAction(action, params);
        if (action === "exit" || action === "enter") await fetchProgress();
        if (action === "exit") setProgress(null);
      }
    } catch (error: any) {
      setMessageType("danger");
      setExploreMessage(
        error?.message ?? (locale === "vi" ? "Lỗi khi khám phá" : "Exploration failed")
      );
    } finally {
      setIsLoading(false);
      setBusyAction(null);
    }
  };

  // ============================================================
  // NOT IN A DUNGEON
  // ============================================================
  if (!isInDungeon) {
    return (
      <div>
        <SectionHead
          han="秘"
          title={locale === "vi" ? "Bí Cảnh & Mê Cung" : "Dungeons & Secret Realms"}
          subtitle={
            locale === "vi" ? "Chốn hung hiểm, cũng là nơi kỳ ngộ" : "Perilous yet full of fortune"
          }
        />
        <Card padding={28} style={{ textAlign: "center" }}>
          <Seal variant="ghost" size="md">
            秘
          </Seal>
          <p
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-soft)",
              fontSize: 14,
              marginTop: 14,
              maxWidth: 420,
              marginInline: "auto",
            }}
          >
            {locale === "vi"
              ? "Ngươi chưa ở trong bí cảnh nào. Hãy chọn một bí cảnh phù hợp với cảnh giới để khai môn vấn đạo."
              : "You are not inside any secret realm. Choose one matched to your realm to step inside."}
          </p>

          {fetchError && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                background: "var(--paper-deep)",
                borderLeft: "3px solid var(--cinnabar)",
                color: "var(--cinnabar-deep)",
                fontSize: 13,
                textAlign: "left",
              }}
              role="alert"
            >
              <div>{fetchError}</div>
              <button
                onClick={() => setFetchError(null)}
                className="ink-btn ghost sm"
                style={{ marginTop: 8 }}
              >
                {locale === "vi" ? "Đóng" : "Dismiss"}
              </button>
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <button
              onClick={fetchDungeonList}
              disabled={isLoading}
              className="ink-btn primary"
            >
              <span className="t-han">尋</span>
              {isLoading
                ? locale === "vi"
                  ? "Đang tìm…"
                  : "Searching…"
                : locale === "vi"
                  ? "Xem Danh Sách Bí Cảnh"
                  : "View Dungeons"}
            </button>
          </div>
        </Card>

        <Modal isOpen={showDungeonList} onClose={() => setShowDungeonList(false)} zLevel="high">
          <Card
            padding={0}
            style={{
              maxWidth: 720,
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                background: "var(--card)",
                borderBottom: "1px solid var(--line)",
                padding: "18px 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Seal variant="cinnabar" size="md">
                  選
                </Seal>
                <div>
                  <div className="label">{locale === "vi" ? "Chọn Bí Cảnh" : "Choose Dungeon"}</div>
                  <h3
                    className="t-display"
                    style={{ margin: "2px 0 0", fontSize: 20, color: "var(--ink)" }}
                  >
                    {locale === "vi" ? "Bí Cảnh Có Sẵn" : "Available Dungeons"}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowDungeonList(false)}
                aria-label={locale === "vi" ? "Đóng" : "Close"}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--ink-mute)",
                  cursor: "pointer",
                  fontSize: 22,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {availableDungeons.length === 0 ? (
                <p
                  className="t-body"
                  style={{
                    fontStyle: "italic",
                    color: "var(--ink-mute)",
                    fontSize: 13,
                    textAlign: "center",
                    padding: "30px 0",
                  }}
                >
                  {locale === "vi"
                    ? "Không có bí cảnh nào trong vùng này."
                    : "No dungeons available in this region."}
                </p>
              ) : (
                availableDungeons.map((dungeon) => {
                  const meta = DIFFICULTY_META[dungeon.difficulty] ?? DIFFICULTY_META.normal;
                  return (
                    <div
                      key={dungeon.id}
                      className="card-inset"
                      style={{ padding: 14, borderRadius: 3 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 12,
                          marginBottom: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <h4
                            className="t-display"
                            style={{
                              margin: 0,
                              fontSize: 18,
                              color: "var(--ink)",
                              lineHeight: 1.2,
                            }}
                          >
                            {locale === "vi" ? dungeon.name : dungeon.name_en}
                          </h4>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                              marginTop: 6,
                            }}
                          >
                            <Pill variant={meta.variant}>
                              {locale === "vi" ? meta.vi : meta.en}
                            </Pill>
                            <Pill variant="gold">
                              <span className="t-han">階</span> {dungeon.tier}
                            </Pill>
                            <Pill>
                              {dungeon.floors}{" "}
                              {locale === "vi" ? "tầng" : "floors"}
                            </Pill>
                          </div>
                        </div>
                        {dungeon.cleared_before && (
                          <Pill variant="jade">
                            <span className="t-han">過</span>{" "}
                            {locale === "vi" ? "đã qua" : "cleared"} (
                            {dungeon.times_cleared ?? 0}×)
                          </Pill>
                        )}
                      </div>

                      <div
                        className="label"
                        style={{
                          color: "var(--ink-mute)",
                          marginBottom: 10,
                        }}
                      >
                        {locale === "vi" ? "Khuyến nghị: " : "Recommended: "}
                        <span style={{ color: "var(--ink)" }}>{dungeon.recommended_realm}</span>
                      </div>

                      <button
                        onClick={() => {
                          handleDungeonAction("enter", { dungeon_id: dungeon.id });
                          setShowDungeonList(false);
                        }}
                        disabled={isLoading}
                        className="ink-btn primary"
                        style={{ width: "100%", justifyContent: "center" }}
                      >
                        <span className="t-han">入</span>
                        {locale === "vi" ? "Vào Bí Cảnh" : "Enter"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </Modal>
      </div>
    );
  }

  // ============================================================
  // LOADING PROGRESS
  // ============================================================
  if (!progress) {
    return (
      <Card padding={22} style={{ textAlign: "center" }}>
        {fetchError ? (
          <>
            <div
              className="t-body"
              style={{
                color: "var(--cinnabar-deep)",
                marginBottom: 10,
                fontStyle: "italic",
              }}
              role="alert"
            >
              {fetchError}
            </div>
            <button onClick={fetchProgress} className="ink-btn ghost sm">
              {locale === "vi" ? "Thử Lại" : "Retry"}
            </button>
          </>
        ) : (
          <span
            className="label"
            style={{ color: "var(--ink-mute)", letterSpacing: "0.2em" }}
          >
            {locale === "vi" ? "Đang dẫn lối…" : "Loading…"}
          </span>
        )}
      </Card>
    );
  }

  // ============================================================
  // ACTIVE DUNGEON
  // ============================================================
  const progressPercent = (progress.currentFloor / progress.totalFloors) * 100;
  const turnsWarning = progress.turnsRemaining !== null && progress.turnsRemaining <= 10;

  // Chests available on this floor — figure out which uncollected indices remain.
  // Chest IDs follow the convention `floor_${floor_number}_${idx}` (regular)
  // and `floor_${floor_number}_hidden_${idx}` (hidden). We only surface regular
  // chests here; hidden chests are gated behind discovery in the engine.
  const floorChests = progress.floor_chests ?? { regular: 0, hidden: 0, collected: 0 };
  const collectedOnFloor = state.dungeon?.collected_chests ?? [];
  const floorNum = progress.current_floor ?? progress.currentFloor;
  const uncollectedChestIds: string[] = [];
  for (let i = 0; i < floorChests.regular; i++) {
    const id = `floor_${floorNum}_${i}`;
    if (!collectedOnFloor.includes(id)) uncollectedChestIds.push(id);
  }

  return (
    <div role="region" aria-label={locale === "vi" ? "Bí cảnh" : "Dungeon"}>
    <Card padding={22}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <h2
          className="t-display"
          style={{
            margin: 0,
            fontSize: 22,
            color: "var(--ink)",
            display: "flex",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <span className="t-han" style={{ color: "var(--cinnabar)" }}>
            秘
          </span>
          {locale === "vi" ? progress.dungeon_name : progress.dungeon_name_en}
        </h2>
        <div
          className="t-body"
          style={{
            fontStyle: "italic",
            color: "var(--ink-mute)",
            fontSize: 13,
            marginTop: 4,
          }}
        >
          {locale === "vi" ? progress.floor_name : progress.floor_name_en}
        </div>
      </div>

      {/* Floor progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          <span className="label">
            {locale === "vi" ? "Tiến độ" : "Progress"}
          </span>
          <span
            className="t-num"
            style={{
              fontSize: 13,
              color: "var(--gold-deep)",
              fontWeight: 600,
            }}
          >
            {progress.currentFloor} / {progress.totalFloors}{" "}
            {locale === "vi" ? "tầng" : "floors"}
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
          role="progressbar"
          aria-valuenow={progress.currentFloor}
          aria-valuemin={0}
          aria-valuemax={progress.totalFloors}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background:
                "linear-gradient(90deg, var(--cinnabar-deep), var(--gold))",
              transition: "width 0.5s",
            }}
          />
        </div>
        {/* Floor tick markers */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
            fontFamily: "var(--font-ui), Inter, sans-serif",
            fontSize: 10,
            letterSpacing: "0.1em",
          }}
        >
          {Array.from({ length: progress.totalFloors }, (_, i) => (
            <span
              key={i}
              style={{
                color:
                  i + 1 < progress.currentFloor
                    ? "var(--jade-deep)"
                    : i + 1 === progress.currentFloor
                      ? "var(--cinnabar)"
                      : "var(--ink-faint)",
                fontWeight: i + 1 === progress.currentFloor ? 600 : 400,
              }}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {progress.turnsRemaining !== null && (
          <div
            className="card-inset"
            style={{
              padding: 12,
              borderRadius: 3,
              borderLeft: turnsWarning ? "3px solid var(--cinnabar)" : undefined,
            }}
          >
            <Stat
              icon="時"
              label={locale === "vi" ? "Lượt còn lại" : "Turns left"}
              value={
                <span
                  style={{
                    color: turnsWarning ? "var(--cinnabar-deep)" : "var(--ink)",
                  }}
                >
                  {progress.turnsRemaining}
                </span>
              }
            />
            {turnsWarning && (
              <div
                className="label"
                style={{
                  marginTop: 4,
                  color: "var(--cinnabar-deep)",
                  fontSize: 9,
                }}
                role="alert"
              >
                {locale === "vi" ? "Sắp hết lượt" : "Running low"}
              </div>
            )}
          </div>
        )}
        <div className="card-inset" style={{ padding: 12, borderRadius: 3 }}>
          <Stat
            icon="箱"
            label={locale === "vi" ? "Rương đã mở" : "Chests opened"}
            value={
              floorChests.regular > 0
                ? `${floorChests.collected}/${floorChests.regular}`
                : progress.chestsCollected
            }
          />
        </div>
        <div className="card-inset" style={{ padding: 12, borderRadius: 3 }}>
          <Stat
            icon="秘"
            label={locale === "vi" ? "Bí mật" : "Secrets"}
            value={progress.secretsFound}
          />
        </div>
        <div className="card-inset" style={{ padding: 12, borderRadius: 3 }}>
          <Stat
            icon="過"
            label={locale === "vi" ? "Tầng đã qua" : "Floors cleared"}
            value={progress.floorsCleared}
          />
        </div>
      </div>

      {/* Chest interaction */}
      {(uncollectedChestIds.length > 0 || floorChests.hidden > 0) && (
        <div
          className="card-inset"
          style={{
            padding: 14,
            borderRadius: 3,
            marginBottom: 16,
            borderLeft: "3px solid var(--gold)",
          }}
        >
          <SmallHead
            right={
              <Pill variant="gold">
                <span className="t-han">箱</span>{" "}
                {floorChests.collected} / {floorChests.regular}
              </Pill>
            }
          >
            {locale === "vi" ? "Rương Trên Tầng Này" : "Chests On This Floor"}
          </SmallHead>
          <p
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-soft)",
              fontSize: 13,
              margin: "4px 0 12px",
            }}
          >
            {locale === "vi"
              ? uncollectedChestIds.length > 0
                ? `Còn ${uncollectedChestIds.length} rương chưa mở. Mỗi rương cho bạc, linh thạch, hoặc vật phẩm.`
                : floorChests.hidden > 0
                  ? "Rương lộ thiên đã hết — vẫn còn rương ẩn, hãy tiếp tục khám phá."
                  : "Không còn rương nào trên tầng này."
              : uncollectedChestIds.length > 0
                ? `${uncollectedChestIds.length} chest${uncollectedChestIds.length > 1 ? "s" : ""} unopened. Each yields silver, spirit stones, or items.`
                : floorChests.hidden > 0
                  ? "Open chests claimed — hidden ones may still await deeper exploration."
                  : "No more chests on this floor."}
          </p>

          {uncollectedChestIds.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {uncollectedChestIds.map((chestId, idx) => (
                <button
                  key={chestId}
                  onClick={() => handleDungeonAction("collect_chest", { chest_id: chestId })}
                  disabled={isLoading}
                  className="ink-btn ghost sm"
                  style={{ minWidth: 110 }}
                >
                  <span className="t-han">箱</span>
                  {locale === "vi" ? `Mở Rương #${idx + 1}` : `Open Chest #${idx + 1}`}
                </button>
              ))}
            </div>
          )}

          {floorChests.hidden > 0 && (
            <div
              className="label"
              style={{
                marginTop: 10,
                color: "var(--ink-mute)",
                fontSize: 10,
                letterSpacing: "0.14em",
              }}
            >
              <span className="t-han" style={{ marginRight: 4 }}>
                匿
              </span>
              {locale === "vi"
                ? `${floorChests.hidden} rương ẩn — cần phải khám phá để phát hiện`
                : `${floorChests.hidden} hidden chest${floorChests.hidden > 1 ? "s" : ""} — keep exploring to find them`}
            </div>
          )}
        </div>
      )}

      {/* Boss indicators */}
      {(progress.has_mini_boss || progress.has_floor_boss) && (
        <div
          className="card-inset"
          style={{
            padding: 12,
            borderRadius: 3,
            marginBottom: 16,
            borderLeft: "3px solid var(--cinnabar)",
          }}
        >
          {progress.has_mini_boss && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--ink-soft)",
                marginBottom: progress.has_floor_boss ? 6 : 0,
              }}
            >
              <span className="t-han" style={{ color: "var(--gold-deep)" }}>
                小
              </span>
              {locale === "vi" ? "Tầng này có Tiểu Boss" : "Mini-boss on this floor"}
            </div>
          )}
          {progress.has_floor_boss && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--ink)",
              }}
            >
              <span className="t-han" style={{ color: "var(--cinnabar-deep)" }}>
                王
              </span>
              <span style={{ fontWeight: 500 }}>
                {locale === "vi" ? "Boss tầng đang chờ" : "Floor boss awaits"}
              </span>
              {progress.boss_defeated && (
                <Pill variant="jade">
                  <span className="t-han">勝</span>{" "}
                  {locale === "vi" ? "Đã hạ" : "Defeated"}
                </Pill>
              )}
            </div>
          )}
        </div>
      )}

      {/* Exploration / chest message */}
      {exploreMessage && (
        <div
          style={{
            padding: 12,
            background: "var(--paper-deep)",
            borderLeft: `3px solid ${
              messageType === "success"
                ? "var(--jade)"
                : messageType === "warning"
                  ? "var(--gold)"
                  : "var(--cinnabar)"
            }`,
            marginBottom: 16,
            fontSize: 13,
          }}
          role={messageType === "danger" ? "alert" : "status"}
        >
          <div
            style={{
              color:
                messageType === "success"
                  ? "var(--jade-deep)"
                  : messageType === "warning"
                    ? "var(--gold-deep)"
                    : "var(--cinnabar-deep)",
              fontStyle: "italic",
            }}
          >
            {exploreMessage}
          </div>
          {lootItems.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line-soft)" }}>
              <div className="label" style={{ marginBottom: 4 }}>
                {locale === "vi" ? "Vật Phẩm Tìm Được" : "Items Found"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {lootItems.map((item, i) => (
                  <Pill key={i} variant="gold">
                    <span className="t-han">物</span> {item}
                  </Pill>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={() => handleDungeonAction("explore_floor")}
          disabled={isLoading}
          className="ink-btn primary"
          style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }}
        >
          <span className="t-han">尋</span>
          {busyAction === "explore_floor"
            ? locale === "vi"
              ? "Đang khám phá…"
              : "Exploring…"
            : locale === "vi"
              ? "Khám Phá Tầng"
              : "Explore Floor"}
        </button>

        {progress.boss_defeated && progress.currentFloor < progress.totalFloors && (
          <button
            onClick={() => handleDungeonAction("advance_floor")}
            disabled={isLoading}
            className="ink-btn"
            style={{ width: "100%", justifyContent: "center" }}
          >
            <span className="t-han">升</span>
            {locale === "vi" ? "Lên Tầng Tiếp Theo" : "Advance to Next Floor"}
          </button>
        )}

        {progress.is_complete && (
          <button
            onClick={() => handleDungeonAction("exit")}
            disabled={isLoading}
            className="ink-btn primary breathe"
            style={{ width: "100%", justifyContent: "center" }}
          >
            <span className="t-han">成</span>
            {locale === "vi" ? "Hoàn Thành & Nhận Thưởng" : "Complete & Claim Reward"}
          </button>
        )}

        <button
          onClick={() => handleDungeonAction("exit")}
          disabled={isLoading}
          className="ink-btn ghost sm"
          style={{ width: "100%", justifyContent: "center" }}
        >
          <span className="t-han">退</span>
          {locale === "vi" ? "Thoát Bí Cảnh" : "Exit Dungeon"}
        </button>
      </div>
    </Card>
    </div>
  );
}
