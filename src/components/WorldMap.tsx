"use client";

import { useState, useMemo } from "react";
import { GameState } from "@/types/game";
import { RegionId } from "@/types/world";
import { Locale, t } from "@/lib/i18n/translations";
import { Card, Pill, SectionHead, Seal, SmallHead, Stat } from "@/components/ui";

interface WorldMapProps {
  state: GameState;
  locale: Locale;
  onTravelArea?: (areaId: string) => Promise<void>;
  onTravelRegion?: (regionId: RegionId) => Promise<void>;
}

interface RegionMeta {
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  han: string;
  fullHan: string;
  color: string;
  element: string;
  element_en: string;
  tier: number;
  position: { x: number; y: number };
}

const REGION_DATA: Record<RegionId, RegionMeta> = {
  thanh_van: {
    name: "Thanh Vân",
    name_en: "Azure Cloud",
    description:
      "Vùng đất yên bình với linh khí dồi dào, nơi lý tưởng cho người mới tu luyện. Sương khói lượn quanh sườn núi, suối nguồn chảy róc rách suốt ngày đêm.",
    description_en:
      "A peaceful land rich with spiritual energy — ideal for beginning cultivators. Mist drapes the mountainside; springs murmur day and night.",
    han: "雲",
    fullHan: "青雲",
    color: "var(--jade-deep)",
    element: "Mộc",
    element_en: "Wood",
    tier: 1,
    position: { x: 28, y: 65 },
  },
  hoa_son: {
    name: "Hỏa Sơn",
    name_en: "Fire Mountain",
    description:
      "Ngọn núi lửa cổ đại, nơi rèn luyện ý chí và sức mạnh trong lửa nóng. Tro than rơi như tuyết, kim đan sư tới đây tôi lò.",
    description_en:
      "An ancient volcanic mountain — will and power forged in flame. Cinders fall like snow; alchemists come here to temper their cauldrons.",
    han: "火",
    fullHan: "火山",
    color: "var(--cinnabar-deep)",
    element: "Hỏa",
    element_en: "Fire",
    tier: 2,
    position: { x: 60, y: 30 },
  },
  huyen_thuy: {
    name: "Huyền Thủy",
    name_en: "Mystic Waters",
    description:
      "Vùng sông hồ huyền bí, ẩn chứa nhiều bí ẩn trong làn nước sâu thẳm. Ngư long ẩn cư, thủy linh thường hiện hình.",
    description_en:
      "A mystical waterland concealing secrets in its boundless depths. Fish-dragons dwell here; water spirits often take form.",
    han: "水",
    fullHan: "玄水",
    color: "#3a6280",
    element: "Thủy",
    element_en: "Water",
    tier: 3,
    position: { x: 80, y: 55 },
  },
  tram_loi: {
    name: "Trầm Lôi",
    name_en: "Silent Thunder",
    description:
      "Vùng đất u tĩnh nhưng ẩn chứa sấm sét, thử thách những kẻ mạnh. Một chớp sáng đủ để chôn vùi cả tu sĩ Trúc Cơ.",
    description_en:
      "Deceptively quiet land where hidden thunder tests the strong. A single flash can bury a Foundation-stage cultivator.",
    han: "雷",
    fullHan: "沉雷",
    color: "var(--gold-deep)",
    element: "Kim",
    element_en: "Metal",
    tier: 4,
    position: { x: 22, y: 22 },
  },
  vong_linh: {
    name: "Vọng Linh",
    name_en: "Spirit Watch",
    description:
      "Vùng đất thiêng liêng nơi ranh giới giữa cõi sống và cõi chết mờ nhạt. Cô hồn dã quỷ lang thang, song cũng là nơi đắc đạo.",
    description_en:
      "Sacred ground where the boundary between life and death grows thin. Wandering ghosts roam — yet enlightenment also comes here.",
    han: "靈",
    fullHan: "望靈",
    color: "var(--rarity-epic)",
    element: "Thổ",
    element_en: "Earth",
    tier: 5,
    position: { x: 50, y: 78 },
  },
};

const ADJACENCY: Record<RegionId, RegionId[]> = {
  thanh_van: ["hoa_son", "huyen_thuy"],
  hoa_son: ["thanh_van", "tram_loi"],
  huyen_thuy: ["thanh_van", "vong_linh"],
  tram_loi: ["hoa_son", "vong_linh"],
  vong_linh: ["huyen_thuy", "tram_loi"],
};

const REGION_CONNECTIONS: [RegionId, RegionId][] = (() => {
  const edges: [RegionId, RegionId][] = [];
  const seen = new Set<string>();
  for (const [from, neighbors] of Object.entries(ADJACENCY)) {
    for (const to of neighbors) {
      const key = [from, to].sort().join("-");
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([from as RegionId, to as RegionId]);
      }
    }
  }
  return edges;
})();

const REGION_TRAVEL_STAMINA = 20;

export default function WorldMap({ state, locale, onTravelRegion }: WorldMapProps) {
  const [selectedRegion, setSelectedRegion] = useState<RegionId | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const currentRegion = state.travel?.current_region || "thanh_van";
  const discoveredAreas = state.travel?.discovered_areas || ({} as Record<RegionId, string[]>);
  const playerStamina = state.stats?.stamina ?? 0;
  const canAffordTravel = playerStamina >= REGION_TRAVEL_STAMINA;

  const isRegionAccessible = (regionId: RegionId) => {
    return ADJACENCY[currentRegion]?.includes(regionId) || regionId === currentRegion;
  };

  const hasDiscoveredArea = (regionId: RegionId) =>
    (discoveredAreas[regionId]?.length || 0) > 0;

  const regionDistances = useMemo(() => {
    const dist: Record<string, number> = { [currentRegion]: 0 };
    const queue: RegionId[] = [currentRegion];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const neighbor of ADJACENCY[cur] || []) {
        if (dist[neighbor] === undefined) {
          dist[neighbor] = dist[cur] + 1;
          queue.push(neighbor);
        }
      }
    }
    return dist;
  }, [currentRegion]);

  const handleRegionClick = (regionId: RegionId) => {
    setSelectedRegion(regionId);
    setShowConfirm(false);
  };

  const handleTravelToRegion = async (regionId: RegionId) => {
    if (!onTravelRegion || regionId === currentRegion) return;
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }
    setIsLoading(true);
    try {
      await onTravelRegion(regionId);
      setSelectedRegion(null);
      setShowConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  const detail = selectedRegion ? REGION_DATA[selectedRegion] : REGION_DATA[currentRegion];
  const detailId = selectedRegion ?? currentRegion;
  const detailIsCurrent = detailId === currentRegion;
  const detailIsAccessible = isRegionAccessible(detailId);
  const detailHasVisited = hasDiscoveredArea(detailId);
  const detailDistance = regionDistances[detailId] ?? 99;

  return (
    <div role="region" aria-label={locale === "vi" ? "Bản Đồ Thế Giới" : "World Map"}>
      <SectionHead
        han="界"
        title={locale === "vi" ? "Thiên Hạ Lục Cảnh" : "Realm Map"}
        subtitle={locale === "vi" ? "Bản đồ tu giới" : "Cultivation realm map"}
        right={
          <Pill variant="cinnabar" withDot>
            {locale === "vi"
              ? REGION_DATA[currentRegion].name
              : REGION_DATA[currentRegion].name_en}
          </Pill>
        }
      />

      <div className="world-grid">
        {/* Map card */}
        <Card padding={0} style={{ overflow: "hidden" }}>
          <div
            style={{
              position: "relative",
              aspectRatio: "16 / 10",
              background:
                "linear-gradient(180deg, var(--paper) 0%, var(--paper-deep) 100%)",
              overflow: "hidden",
            }}
          >
            {/* Paper grid */}
            <svg
              viewBox="0 0 1000 625"
              preserveAspectRatio="xMidYMid slice"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
              aria-hidden
            >
              <defs>
                <pattern
                  id="paperGrid"
                  width="50"
                  height="50"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 50 0 L 0 0 0 50"
                    fill="none"
                    stroke="var(--line-soft)"
                    strokeWidth="0.5"
                    opacity="0.4"
                  />
                </pattern>
                <linearGradient id="mountainFar" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--ink)" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="mountainMid" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--ink)" stopOpacity="0.1" />
                </linearGradient>
                <linearGradient id="mountainNear" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="var(--ink)" stopOpacity="0.15" />
                </linearGradient>
              </defs>
              <rect width="1000" height="625" fill="url(#paperGrid)" />

              {/* Far mountains */}
              <path
                d="M 0 280 L 80 220 L 160 250 L 240 180 L 340 240 L 440 200 L 540 230 L 640 190 L 760 240 L 860 210 L 1000 250 L 1000 320 L 0 320 Z"
                fill="url(#mountainFar)"
              />
              {/* Mid mountains */}
              <path
                d="M 0 360 L 120 280 L 220 320 L 320 240 L 460 310 L 580 270 L 700 320 L 820 280 L 1000 340 L 1000 420 L 0 420 Z"
                fill="url(#mountainMid)"
              />
              {/* Near mountains */}
              <path
                d="M 0 440 L 140 360 L 260 410 L 380 350 L 520 410 L 660 360 L 800 410 L 940 360 L 1000 400 L 1000 520 L 0 520 Z"
                fill="url(#mountainNear)"
              />

              {/* Jade river */}
              <path
                d="M 100 540 Q 280 500 460 540 T 820 520 T 1000 500"
                fill="none"
                stroke="var(--jade)"
                strokeWidth="3"
                opacity="0.55"
                strokeLinecap="round"
              />
              <path
                d="M 100 540 Q 280 500 460 540 T 820 520 T 1000 500"
                fill="none"
                stroke="var(--jade-soft)"
                strokeWidth="6"
                opacity="0.25"
                strokeLinecap="round"
              />

              {/* Connection lines */}
              {REGION_CONNECTIONS.map(([from, to], idx) => {
                const fromPos = REGION_DATA[from].position;
                const toPos = REGION_DATA[to].position;
                const isActive =
                  from === currentRegion || to === currentRegion;
                return (
                  <line
                    key={idx}
                    x1={`${fromPos.x * 10}`}
                    y1={`${fromPos.y * 6.25}`}
                    x2={`${toPos.x * 10}`}
                    y2={`${toPos.y * 6.25}`}
                    stroke={isActive ? "var(--cinnabar)" : "var(--ink-mute)"}
                    strokeWidth={isActive ? "2" : "1.2"}
                    strokeDasharray={isActive ? "8 6" : "3 8"}
                    opacity={isActive ? 0.7 : 0.45}
                  />
                );
              })}
            </svg>

            {/* Compass */}
            <svg
              width={60}
              height={60}
              viewBox="0 0 60 60"
              style={{ position: "absolute", top: 14, left: 14 }}
              aria-hidden
            >
              <circle
                cx="30"
                cy="30"
                r="26"
                fill="var(--paper)"
                stroke="var(--ink)"
                strokeWidth="1"
                opacity="0.9"
              />
              <circle
                cx="30"
                cy="30"
                r="20"
                fill="none"
                stroke="var(--line-strong)"
                strokeWidth="0.6"
              />
              <path d="M 30 6 L 34 30 L 30 26 L 26 30 Z" fill="var(--cinnabar)" />
              <path
                d="M 30 54 L 34 30 L 30 34 L 26 30 Z"
                fill="var(--ink-soft)"
              />
              <text
                x="30"
                y="14"
                textAnchor="middle"
                fontFamily='"Noto Serif SC", serif'
                fontSize="8"
                fill="var(--cinnabar-deep)"
                fontWeight="600"
              >
                北
              </text>
              <text
                x="30"
                y="54"
                textAnchor="middle"
                fontFamily='"Noto Serif SC", serif'
                fontSize="8"
                fill="var(--ink-soft)"
              >
                南
              </text>
            </svg>

            {/* Center watermark */}
            <div
              className="han-bg"
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: 260,
                opacity: 0.06,
              }}
              aria-hidden
            >
              界
            </div>

            {/* Region pins */}
            {(Object.keys(REGION_DATA) as RegionId[]).map((regionId) => {
              const data = REGION_DATA[regionId];
              const isCurrent = regionId === currentRegion;
              const accessible = isRegionAccessible(regionId);
              const isSelected = selectedRegion === regionId;
              const cls = `region ${isCurrent ? "current" : ""} ${!accessible && !isCurrent ? "locked" : ""}`;
              return (
                <button
                  key={regionId}
                  className={cls}
                  onClick={() => handleRegionClick(regionId)}
                  aria-label={locale === "vi" ? data.name : data.name_en}
                  aria-pressed={isSelected}
                  style={{
                    left: `${data.position.x}%`,
                    top: `${data.position.y}%`,
                    transform: "translate(-50%, -50%)",
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    cursor:
                      !accessible && !isCurrent ? "not-allowed" : "pointer",
                    zIndex: isSelected ? 10 : 2,
                  }}
                >
                  <div className="pin" aria-hidden />
                  <div
                    style={{
                      padding: "4px 10px",
                      background: "var(--paper)",
                      border: `1px solid ${isSelected ? "var(--ink)" : "var(--ink-soft)"}`,
                      borderRadius: 2,
                      fontSize: 12,
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                      boxShadow: "0 1px 3px rgba(70, 50, 20, 0.18)",
                    }}
                  >
                    <span
                      className="t-han"
                      style={{
                        fontSize: 14,
                        color: "var(--cinnabar)",
                        marginRight: 4,
                      }}
                    >
                      {data.han}
                    </span>
                    <span
                      style={{
                        color: "var(--ink)",
                        fontFamily:
                          "var(--font-display), 'Cormorant Garamond', serif",
                      }}
                    >
                      {locale === "vi" ? data.name : data.name_en}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Scale chip */}
            <div
              style={{
                position: "absolute",
                right: 16,
                bottom: 16,
                padding: "5px 10px",
                background: "var(--paper)",
                border: "1px solid var(--line-strong)",
                borderRadius: 2,
                fontSize: 11,
                color: "var(--ink-mute)",
                fontFamily: "var(--font-ui), Inter, sans-serif",
              }}
            >
              一 = 三百里 · 1 tấc = 300 lý
            </div>
          </div>
        </Card>

        {/* Region detail */}
        <Card
          padding={22}
          className="card-corner"
          style={{ position: "relative", minWidth: 0 }}
        >
          <span
            className="han-bg"
            style={{ position: "absolute", top: -24, right: -16, fontSize: 240 }}
            aria-hidden
          >
            {detail.han}
          </span>
          <div style={{ position: "relative", zIndex: 1 }}>
            <SmallHead>
              {locale === "vi" ? "Chi Tiết Vùng" : "Region Detail"}
            </SmallHead>
            <h3
              style={{
                margin: "0 0 4px",
                display: "flex",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <span
                className="t-han"
                style={{
                  fontSize: 38,
                  color: detail.color,
                  lineHeight: 1,
                  letterSpacing: "0.04em",
                }}
              >
                {detail.fullHan}
              </span>
              <span
                className="t-display"
                style={{ fontSize: 22, color: "var(--ink)", lineHeight: 1 }}
              >
                {locale === "vi" ? detail.name : detail.name_en}
              </span>
            </h3>
            <div className="label" style={{ marginBottom: 8 }}>
              {locale === "vi"
                ? `Cấp ${detail.tier} · ${detail.element}`
                : `Tier ${detail.tier} · ${detail.element_en}`}
            </div>
            <p
              className="t-body"
              style={{
                fontStyle: "italic",
                color: "var(--ink-soft)",
                fontSize: 14,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {locale === "vi" ? detail.description : detail.description_en}
            </p>

            <div className="hr-soft" style={{ margin: "14px 0 10px" }} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0 16px",
              }}
            >
              <Stat
                label={locale === "vi" ? "Phí thể lực" : "Stamina cost"}
                value={detailIsCurrent ? "—" : `${REGION_TRAVEL_STAMINA}`}
                icon="力"
              />
              <Stat
                label={locale === "vi" ? "Nguy hiểm" : "Danger"}
                value={"★".repeat(detail.tier)}
                icon="險"
              />
              <Stat
                label={locale === "vi" ? "Khoảng cách" : "Distance"}
                value={
                  detailIsCurrent
                    ? locale === "vi"
                      ? "Đang tại"
                      : "Here"
                    : detailIsAccessible
                      ? "1"
                      : String(detailDistance)
                }
                icon="程"
              />
              <Stat
                label={locale === "vi" ? "Đã khám phá" : "Explored"}
                value={detailHasVisited ? "✓" : "—"}
                icon="蹤"
              />
            </div>

            {showConfirm && detailIsAccessible && !detailIsCurrent && (
              <div
                style={{
                  marginTop: 14,
                  padding: 10,
                  background: "var(--paper-deep)",
                  borderLeft: "3px solid var(--cinnabar)",
                  color: "var(--cinnabar-deep)",
                  fontSize: 13,
                }}
              >
                {locale === "vi"
                  ? `Xác nhận du hành đến ${detail.name}?`
                  : `Confirm travel to ${detail.name_en}?`}
              </div>
            )}

            {!detailIsCurrent && !detailIsAccessible && (
              <p
                className="t-body"
                style={{
                  fontStyle: "italic",
                  color: "var(--ink-mute)",
                  fontSize: 12,
                  marginTop: 10,
                }}
              >
                {locale === "vi"
                  ? "Phải đi qua những vùng kế cận trước khi tới đây."
                  : "You must travel through adjacent regions first."}
              </p>
            )}

            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {detailIsCurrent ? (
                <button
                  className="ink-btn ghost"
                  disabled
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  <span className="t-han">居</span>
                  {t(locale, "worldHere")}
                </button>
              ) : !detailIsAccessible ? (
                <button
                  className="ink-btn ghost"
                  disabled
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  <span className="t-han">封</span>
                  {t(locale, "worldLocked")}
                </button>
              ) : (
                <>
                  <button
                    onClick={() =>
                      selectedRegion && handleTravelToRegion(selectedRegion)
                    }
                    disabled={isLoading || !canAffordTravel || !selectedRegion}
                    className="ink-btn primary"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    <span className="t-han">行</span>
                    {isLoading
                      ? locale === "vi"
                        ? "Đang đi…"
                        : "Traveling…"
                      : showConfirm
                        ? locale === "vi"
                          ? "Xác Nhận"
                          : "Confirm"
                        : t(locale, "worldTravel")}
                  </button>
                  <button className="ink-btn ghost" disabled>
                    <span className="t-han">卜</span>
                    {locale === "vi" ? "Suy Bốc" : "Divine"}
                  </button>
                </>
              )}
            </div>

            {!canAffordTravel && !detailIsCurrent && detailIsAccessible && (
              <p
                className="t-body"
                style={{
                  fontStyle: "italic",
                  color: "var(--cinnabar-deep)",
                  fontSize: 12,
                  marginTop: 10,
                }}
              >
                {locale === "vi"
                  ? `Không đủ thể lực — cần ${REGION_TRAVEL_STAMINA}, hiện có ${playerStamina}.`
                  : `Not enough stamina — need ${REGION_TRAVEL_STAMINA}, have ${playerStamina}.`}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
