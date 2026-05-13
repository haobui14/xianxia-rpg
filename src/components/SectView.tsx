"use client";

import { GameState, SectRank, SectType } from "@/types/game";
import { Locale } from "@/lib/i18n/translations";
import SectMissionsPanel, { SectRelationsPanel } from "./SectMissionsPanel";
import SectWarBanner from "./SectWarBanner";
import { Bar, Card, Pill, SectionHead, Seal, SmallHead, Stat } from "@/components/ui";

interface SectViewProps {
  state: GameState;
  locale: Locale;
  onRefresh?: () => void;
  processing?: boolean;
}

const RANK_NAMES: Record<"vi" | "en", Record<SectRank, string>> = {
  vi: {
    NgoạiMôn: "Ngoại Môn Đệ Tử",
    NộiMôn: "Nội Môn Đệ Tử",
    ChânTruyền: "Chân Truyền Đệ Tử",
    TrưởngLão: "Trưởng Lão",
    ChưởngMôn: "Chưởng Môn",
  },
  en: {
    NgoạiMôn: "Outer Disciple",
    NộiMôn: "Inner Disciple",
    ChânTruyền: "True Disciple",
    TrưởngLão: "Elder",
    ChưởngMôn: "Sect Master",
  },
};

const RANK_HAN: Record<SectRank, string> = {
  NgoạiMôn: "外",
  NộiMôn: "內",
  ChânTruyền: "真",
  TrưởngLão: "長",
  ChưởngMôn: "掌",
};

const SECT_TYPE_NAMES: Record<"vi" | "en", Record<SectType, string>> = {
  vi: {
    Kiếm: "Tu Kiếm",
    Đan: "Luyện Đan",
    Trận: "Trận Pháp",
    YêuThú: "Ngự Thú",
    Ma: "Ma Đạo",
    PhậtMôn: "Phật Môn",
    Tổng: "Tổng Hợp",
    ThươngHội: "Thương Hội",
  },
  en: {
    Kiếm: "Sword Cultivation",
    Đan: "Alchemy",
    Trận: "Formation",
    YêuThú: "Beast Taming",
    Ma: "Demonic",
    PhậtMôn: "Buddhist",
    Tổng: "General",
    ThươngHội: "Merchant",
  },
};

const RANK_ORDER: SectRank[] = ["NgoạiMôn", "NộiMôn", "ChânTruyền", "TrưởngLão", "ChưởngMôn"];

const RANK_REQUIREMENTS: Record<
  string,
  { contribution: number; reputation: number; missions: number }
> = {
  NộiMôn: { contribution: 100, reputation: 30, missions: 5 },
  ChânTruyền: { contribution: 500, reputation: 60, missions: 20 },
  TrưởngLão: { contribution: 2000, reputation: 85, missions: 50 },
  ChưởngMôn: { contribution: 10000, reputation: 100, missions: 100 },
};

export default function SectView({ state, locale, onRefresh, processing }: SectViewProps) {
  const { sect_membership } = state;

  // No sect at all
  if (!sect_membership && !state.sect) {
    return (
      <div>
        <SectionHead
          han="派"
          title={locale === "vi" ? "Môn Phái" : "Sect"}
          subtitle={locale === "vi" ? "Tu đồ chưa quy môn" : "Unaffiliated"}
        />
        <Card
          padding={36}
          className="card-corner"
          style={{ maxWidth: 620, margin: "0 auto", textAlign: "center", position: "relative" }}
        >
          <span
            className="han-bg"
            style={{ position: "absolute", top: -20, left: -10, fontSize: 220 }}
            aria-hidden
          >
            派
          </span>
          <div style={{ position: "relative", zIndex: 1 }}>
            <Seal size="lg" variant="ghost">
              無
            </Seal>
            <h2
              className="t-display"
              style={{
                margin: "18px 0 8px",
                fontSize: 28,
                color: "var(--ink)",
              }}
            >
              {locale === "vi" ? "Tu Đồ Lưu Lạc" : "Wandering Cultivator"}
            </h2>
            <div className="brush-rule" style={{ maxWidth: 220, margin: "0 auto 14px" }} />
            <p
              className="t-body"
              style={{
                fontStyle: "italic",
                color: "var(--ink-soft)",
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              {locale === "vi"
                ? "Ngươi chưa quy môn nào. Hãy đi khắp tiên giới, tìm sư phụ, kết bằng hữu — môn phái sẽ tự xuất hiện trên đường tu đạo."
                : "You belong to no sect yet. Wander the realm, seek a mentor, befriend the worthy — a sect will reveal itself along the path."}
            </p>
            <p
              className="label"
              style={{ marginTop: 18, color: "var(--ink-mute)" }}
            >
              {locale === "vi"
                ? "Môn phái ban công pháp · tài nguyên · sự che chở"
                : "Sects grant techniques · resources · protection"}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Legacy simple sect string (no full membership data)
  if (state.sect && !sect_membership) {
    return (
      <div>
        <SectionHead
          han="派"
          title={locale === "vi" ? "Môn Phái" : "Sect"}
          subtitle={locale === "vi" ? state.sect ?? "" : state.sect_en ?? ""}
        />
        <Card padding={28} style={{ textAlign: "center", maxWidth: 540, margin: "0 auto" }}>
          <Seal variant="cinnabar" size="lg">
            派
          </Seal>
          <h2
            className="t-display"
            style={{ margin: "16px 0 4px", fontSize: 28, color: "var(--ink)" }}
          >
            {locale === "vi" ? state.sect : state.sect_en}
          </h2>
          <div className="label">{locale === "vi" ? "Thành viên" : "Member"}</div>
        </Card>
      </div>
    );
  }

  const {
    sect,
    rank,
    contribution,
    reputation,
    joined_date,
    missions_completed,
    mentor,
    mentor_en,
    benefits,
  } = sect_membership!;

  const currentGameDay =
    (state.time_year - 1) * 360 + (state.time_month - 1) * 30 + state.time_day;
  let joinedGameDay = 0;
  if (joined_date) {
    const parts = joined_date.split(/[-T]/);
    if (parts.length >= 3) {
      const jYear = parseInt(parts[0], 10) || 1;
      const jMonth = parseInt(parts[1], 10) || 1;
      const jDay = parseInt(parts[2], 10) || 1;
      joinedGameDay = (jYear - 1) * 360 + (jMonth - 1) * 30 + jDay;
    }
  }
  const daysSinceJoined = Math.max(0, currentGameDay - joinedGameDay);

  const currentRankIndex = RANK_ORDER.indexOf(rank as SectRank);
  const nextRank =
    currentRankIndex < RANK_ORDER.length - 1
      ? RANK_ORDER[currentRankIndex + 1]
      : null;
  const nextRankReqs = nextRank ? RANK_REQUIREMENTS[nextRank] : null;

  const sectHan = (sect.name || "").charAt(0);

  return (
    <div>
      <SectionHead
        han="派"
        title={locale === "vi" ? sect.name : sect.name_en}
        subtitle={
          locale === "vi"
            ? `${RANK_NAMES.vi[rank as SectRank]}${mentor ? ` · ${mentor}` : ""}`
            : `${RANK_NAMES.en[rank as SectRank]}${mentor_en ? ` · ${mentor_en}` : ""}`
        }
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <Pill variant="cinnabar" withDot>
              {locale === "vi" ? `Cống ${contribution}` : `Merit ${contribution}`}
            </Pill>
            <Pill variant="jade">
              {locale === "vi"
                ? `Danh ${reputation}`
                : `Rep ${reputation}`}
            </Pill>
          </div>
        }
      />

      <SectWarBanner state={state} locale={locale} />

      <div className="sect-grid" style={{ marginBottom: 22 }}>
        {/* LEFT — Identity + standing */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card padding={28} className="card-corner" style={{ position: "relative" }}>
            <span
              className="han-bg"
              style={{ position: "absolute", top: -30, right: -20, fontSize: 320 }}
              aria-hidden
            >
              派
            </span>
            <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
              <span
                className="t-han"
                style={{
                  fontSize: 64,
                  color: "var(--cinnabar)",
                  lineHeight: 1,
                  letterSpacing: "0.04em",
                }}
              >
                {sectHan}
              </span>
              <h3
                className="t-display"
                style={{
                  margin: "8px 0 4px",
                  fontSize: 26,
                  color: "var(--ink)",
                  lineHeight: 1.1,
                }}
              >
                {locale === "vi" ? sect.name : sect.name_en}
              </h3>
              <div className="label">
                {locale === "vi"
                  ? SECT_TYPE_NAMES.vi[sect.type]
                  : SECT_TYPE_NAMES.en[sect.type]}
                {sect.element ? ` · ${sect.element}` : ""} ·{" "}
                {locale === "vi" ? `Cấp ${sect.tier}` : `Tier ${sect.tier}`}
              </div>
              <div
                className="brush-rule"
                style={{ maxWidth: 200, margin: "12px auto" }}
              />
              {sect.description && (
                <p
                  className="t-body"
                  style={{
                    fontStyle: "italic",
                    color: "var(--ink-soft)",
                    fontSize: 14,
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {locale === "vi" ? sect.description : sect.description_en}
                </p>
              )}
            </div>
          </Card>

          {/* Disciple standing */}
          <Card padding={22}>
            <SmallHead
              right={
                <Pill variant="cinnabar">
                  <span className="t-han">{RANK_HAN[rank as SectRank] ?? "弟"}</span>
                  {locale === "vi"
                    ? RANK_NAMES.vi[rank as SectRank]
                    : RANK_NAMES.en[rank as SectRank]}
                </Pill>
              }
            >
              {locale === "vi" ? "Địa Vị Đệ Tử" : "Disciple Standing"}
            </SmallHead>

            <div style={{ display: "grid", gap: 0 }}>
              <Stat
                label={locale === "vi" ? "Cống Hiến" : "Contribution"}
                value={contribution.toLocaleString()}
                icon="功"
              />
              <Stat
                label={locale === "vi" ? "Danh Tiếng" : "Reputation"}
                value={`${reputation}/100`}
                icon="名"
              />
              <Stat
                label={locale === "vi" ? "Nhiệm Vụ" : "Missions"}
                value={missions_completed}
                icon="任"
              />
              <Stat
                label={locale === "vi" ? "Nhập Môn" : "Joined"}
                value={
                  locale === "vi" ? `${daysSinceJoined} ngày` : `${daysSinceJoined}d`
                }
                icon="入"
              />
              {mentor && (
                <Stat
                  label={locale === "vi" ? "Sư Phụ" : "Mentor"}
                  value={locale === "vi" ? mentor : mentor_en ?? mentor}
                  icon="師"
                />
              )}
            </div>

            {nextRank && nextRankReqs && (
              <>
                <div className="hr-soft" style={{ margin: "14px 0 10px" }} />
                <SmallHead
                  right={
                    <Pill variant="jade">
                      {locale === "vi"
                        ? RANK_NAMES.vi[nextRank]
                        : RANK_NAMES.en[nextRank]}
                    </Pill>
                  }
                >
                  {locale === "vi" ? "Yêu Cầu Thăng Cấp" : "Promotion Reqs"}
                </SmallHead>

                <Bar
                  label={locale === "vi" ? "Cống Hiến" : "Contribution"}
                  kind="exp"
                  value={contribution}
                  max={nextRankReqs.contribution}
                  showNums
                />
                <Bar
                  label={locale === "vi" ? "Danh Tiếng" : "Reputation"}
                  kind="qi"
                  value={reputation}
                  max={nextRankReqs.reputation}
                  showNums
                />
                <Bar
                  label={locale === "vi" ? "Nhiệm Vụ" : "Missions"}
                  kind="stam"
                  value={missions_completed}
                  max={nextRankReqs.missions}
                  showNums
                />
              </>
            )}

            {!nextRank && (
              <div
                className="t-body"
                style={{
                  marginTop: 14,
                  textAlign: "center",
                  fontStyle: "italic",
                  color: "var(--cinnabar-deep)",
                  fontSize: 13,
                }}
              >
                {locale === "vi" ? "Đã đăng đỉnh phong môn phái." : "You stand at the sect's peak."}
              </div>
            )}
          </Card>

          {/* Benefits */}
          <Card padding={22}>
            <SmallHead>{locale === "vi" ? "Lợi Ích Môn Phái" : "Sect Benefits"}</SmallHead>
            <div style={{ display: "grid", gap: 0 }}>
              <Stat
                label={locale === "vi" ? "Tu Luyện Tăng Tốc" : "Cultivation Bonus"}
                value={
                  benefits.cultivation_bonus > 0
                    ? `+${benefits.cultivation_bonus}%`
                    : "—"
                }
                icon="修"
              />
              <Stat
                label={locale === "vi" ? "Kho Tài Nguyên" : "Resource Access"}
                value={benefits.resource_access ? "✓" : "—"}
                icon="庫"
              />
              <Stat
                label={locale === "vi" ? "Tàng Kinh Các" : "Technique Library"}
                value={benefits.technique_access ? "✓" : "—"}
                icon="藏"
              />
              <Stat
                label={locale === "vi" ? "Sự Che Chở" : "Protection"}
                value={benefits.protection ? "✓" : "—"}
                icon="護"
              />
            </div>
          </Card>
        </div>

        {/* RIGHT — Missions + relations */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <SectMissionsPanel
            state={state}
            locale={locale}
            onMutated={onRefresh}
            processing={processing}
          />
          <SectRelationsPanel state={state} locale={locale} />
        </div>
      </div>
    </div>
  );
}
