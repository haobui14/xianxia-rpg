"use client";

import { GameState } from "@/types/game";
import { Locale } from "@/lib/i18n/translations";
import SectMissionsPanel, { SectRelationsPanel } from "./SectMissionsPanel";
import SectWarBanner from "./SectWarBanner";
import { SectionHead, Pill } from "@/components/ui";

interface SectViewProps {
  state: GameState;
  locale: Locale;
  onRefresh?: () => void; // Called after a mission is accepted/abandoned so parent can reload
  processing?: boolean; // Turn is being processed — disables mutation buttons to avoid last-write races
}

export default function SectView({ state, locale, onRefresh, processing }: SectViewProps) {
  const { sect_membership } = state;

  // Not in a sect
  if (!sect_membership && !state.sect) {
    return (
      <>
        <SectionHead
          han="派"
          title={locale === "vi" ? "Môn Phái" : "Sect"}
          subtitle={locale === "vi" ? "Tu đồ chưa quy môn" : "Unaffiliated"}
        />
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">
            {locale === "vi" ? "Môn Phái" : "Sect"}
          </h2>
          <div className="text-gray-400 mb-6">
            {locale === "vi"
              ? "Bạn chưa gia nhập môn phái nào. Hãy khám phá thế giới và tìm kiếm cơ hội gia nhập một môn phái!"
              : "You have not joined any sect yet. Explore the world and seek opportunities to join a sect!"}
          </div>
          <div className="text-sm text-gray-500">
            {locale === "vi"
              ? "💡 Môn phái cung cấp công pháp, tài nguyên, và sự bảo vệ cho đệ tử."
              : "💡 Sects provide techniques, resources, and protection for their disciples."}
          </div>
        </div>
      </div>
      </>
    );
  }

  // Simple sect display (legacy)
  if (state.sect && !sect_membership) {
    return (
      <>
        <SectionHead
          han="派"
          title={locale === "vi" ? "Môn Phái" : "Sect"}
          subtitle={locale === "vi" ? state.sect ?? "" : state.sect_en ?? ""}
        />
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-6 text-xianxia-gold text-center">
          {locale === "vi" ? "Môn Phái" : "Sect"}
        </h2>
        <div className="text-center">
          <div className="text-3xl font-bold text-xianxia-accent mb-2">
            {locale === "vi" ? state.sect : state.sect_en}
          </div>
          <div className="text-sm text-gray-400">{locale === "vi" ? "Thành viên" : "Member"}</div>
        </div>
      </div>
      </>
    );
  }

  // Full sect membership display
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

  const rankNames = {
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

  const sectTypeNames = {
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

  // Calculate days since joined using game time consistently
  // joined_date is stored as a game-time string or ISO date; convert to game days
  const currentGameDay = (state.time_year - 1) * 360 + (state.time_month - 1) * 30 + state.time_day;

  // Parse joined_date: if it's a game-time format "Y-M-D" or ISO date
  let joinedGameDay = 0;
  if (joined_date) {
    // Try parsing as "YYYY-MM-DD" game calendar
    const parts = joined_date.split(/[-T]/);
    if (parts.length >= 3) {
      const jYear = parseInt(parts[0], 10) || 1;
      const jMonth = parseInt(parts[1], 10) || 1;
      const jDay = parseInt(parts[2], 10) || 1;
      joinedGameDay = (jYear - 1) * 360 + (jMonth - 1) * 30 + jDay;
    }
  }

  const daysSinceJoined = Math.max(0, currentGameDay - joinedGameDay);

  // Rank requirements for next rank
  const RANK_ORDER = ["NgoạiMôn", "NộiMôn", "ChânTruyền", "TrưởngLão", "ChưởngMôn"] as const;
  const RANK_REQUIREMENTS: Record<
    string,
    { contribution: number; reputation: number; missions: number }
  > = {
    NộiMôn: { contribution: 100, reputation: 30, missions: 5 },
    ChânTruyền: { contribution: 500, reputation: 60, missions: 20 },
    TrưởngLão: { contribution: 2000, reputation: 85, missions: 50 },
    ChưởngMôn: { contribution: 10000, reputation: 100, missions: 100 },
  };
  const currentRankIndex = RANK_ORDER.indexOf(rank as (typeof RANK_ORDER)[number]);
  const nextRank =
    currentRankIndex < RANK_ORDER.length - 1 ? RANK_ORDER[currentRankIndex + 1] : null;
  const nextRankReqs = nextRank ? RANK_REQUIREMENTS[nextRank] : null;

  return (
    <div className="space-y-6">
      <SectionHead
        han="派"
        title={locale === "vi" ? sect.name : sect.name_en}
        subtitle={locale === "vi" ? `${rank} · ${mentor ?? ""}` : `${rank} · ${mentor_en ?? ""}`}
        right={
          <Pill variant="cinnabar" withDot>
            {locale === "vi" ? `Cống ${contribution}` : `Merit ${contribution}`}
          </Pill>
        }
      />
      {/* Sect Header */}
      <div className="bg-gradient-to-r from-xianxia-dark via-purple-900/20 to-xianxia-dark border border-xianxia-accent/30 rounded-lg p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-xianxia-gold mb-2">
            {locale === "vi" ? sect.name : sect.name_en}
          </h1>
          <div className="text-sm text-gray-400 mb-4">
            {locale === "vi" ? sectTypeNames.vi[sect.type] : sectTypeNames.en[sect.type]}
            {sect.element && ` • ${sect.element}`}
            {" • "}
            {locale === "vi" ? `Cấp ${sect.tier}` : `Tier ${sect.tier}`}
          </div>
          {sect.description && (
            <p className="text-gray-300 max-w-2xl mx-auto">
              {locale === "vi" ? sect.description : sect.description_en}
            </p>
          )}
        </div>
      </div>

      {/* Membership Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rank & Status */}
        <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-xianxia-gold">
            {locale === "vi" ? "Địa Vị" : "Rank & Status"}
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">{locale === "vi" ? "Chức vụ:" : "Rank:"}</span>
              <span className="text-xianxia-accent font-bold">
                {locale === "vi" ? rankNames.vi[rank] : rankNames.en[rank]}
              </span>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-400">
                  {locale === "vi" ? "Danh tiếng:" : "Reputation:"}
                </span>
                <span className="text-green-400 font-medium">{reputation}/100</span>
              </div>
              <div
                className="w-full bg-gray-700 rounded-full h-2 overflow-hidden"
                role="progressbar"
                aria-valuenow={reputation}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={locale === "vi" ? "Danh tiếng" : "Reputation"}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    reputation >= 80
                      ? "bg-green-400"
                      : reputation >= 50
                        ? "bg-yellow-400"
                        : reputation >= 20
                          ? "bg-orange-400"
                          : "bg-red-400"
                  }`}
                  style={{ width: `${reputation}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">
                {locale === "vi" ? "Ngày gia nhập:" : "Joined:"}
              </span>
              <span className="text-gray-300">
                {locale === "vi" ? `${daysSinceJoined} ngày trước` : `${daysSinceJoined} days ago`}
              </span>
            </div>
            {mentor && (
              <div className="flex justify-between">
                <span className="text-gray-400">{locale === "vi" ? "Sư phụ:" : "Mentor:"}</span>
                <span className="text-purple-400">{locale === "vi" ? mentor : mentor_en}</span>
              </div>
            )}
          </div>
        </div>

        {/* Contribution & Missions */}
        <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-xianxia-gold">
            {locale === "vi" ? "Cống Hiến" : "Contributions"}
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">
                {locale === "vi" ? "Điểm cống hiến:" : "Contribution Points:"}
              </span>
              <span className="text-yellow-400 font-bold">{contribution}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">
                {locale === "vi" ? "Nhiệm vụ hoàn thành:" : "Missions Completed:"}
              </span>
              <span className="text-blue-400">{missions_completed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sect War (if active) — lives ABOVE the Mission Board so it's the
          first thing players see when a war is happening. */}
      <SectWarBanner state={state} locale={locale} />

      {/* Mission Board */}
      <SectMissionsPanel
        state={state}
        locale={locale}
        onMutated={onRefresh}
        processing={processing}
      />

      {/* Sect Relations */}
      <SectRelationsPanel state={state} locale={locale} />

      {/* Sect Benefits */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-xianxia-gold">
          {locale === "vi" ? "Lợi Ích Môn Phái" : "Sect Benefits"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className={`p-4 rounded-lg border ${benefits.cultivation_bonus > 0 ? "border-green-500/50 bg-green-900/20" : "border-gray-600 bg-gray-800/20"}`}
          >
            <div className="flex items-center justify-between">
              <span className={benefits.cultivation_bonus > 0 ? "text-green-400" : "text-gray-400"}>
                ✨ {locale === "vi" ? "Tu luyện tăng tốc" : "Cultivation Bonus"}
              </span>
              <span
                className={`font-bold ${benefits.cultivation_bonus > 0 ? "text-green-300" : "text-gray-500"}`}
              >
                {benefits.cultivation_bonus > 0
                  ? `+${benefits.cultivation_bonus}%`
                  : locale === "vi"
                    ? "Không có"
                    : "None"}
              </span>
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border ${benefits.resource_access ? "border-blue-500/50 bg-blue-900/20" : "border-gray-600 bg-gray-800/20"}`}
          >
            <div className="flex items-center justify-between">
              <span className={benefits.resource_access ? "text-blue-400" : "text-gray-400"}>
                💎 {locale === "vi" ? "Kho tài nguyên" : "Resource Access"}
              </span>
              <span
                className={`font-bold ${benefits.resource_access ? "text-green-300" : "text-red-300"}`}
              >
                {benefits.resource_access
                  ? locale === "vi"
                    ? "Có"
                    : "Yes"
                  : locale === "vi"
                    ? "Không"
                    : "No"}
              </span>
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border ${benefits.technique_access ? "border-purple-500/50 bg-purple-900/20" : "border-gray-600 bg-gray-800/20"}`}
          >
            <div className="flex items-center justify-between">
              <span className={benefits.technique_access ? "text-purple-400" : "text-gray-400"}>
                📖 {locale === "vi" ? "Tàng kinh các" : "Technique Library"}
              </span>
              <span
                className={`font-bold ${benefits.technique_access ? "text-green-300" : "text-red-300"}`}
              >
                {benefits.technique_access
                  ? locale === "vi"
                    ? "Có"
                    : "Yes"
                  : locale === "vi"
                    ? "Không"
                    : "No"}
              </span>
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border ${benefits.protection ? "border-red-500/50 bg-red-900/20" : "border-gray-600 bg-gray-800/20"}`}
          >
            <div className="flex items-center justify-between">
              <span className={benefits.protection ? "text-red-400" : "text-gray-400"}>
                🛡️ {locale === "vi" ? "Sự bảo vệ" : "Sect Protection"}
              </span>
              <span
                className={`font-bold ${benefits.protection ? "text-green-300" : "text-red-300"}`}
              >
                {benefits.protection
                  ? locale === "vi"
                    ? "Có"
                    : "Yes"
                  : locale === "vi"
                    ? "Không"
                    : "No"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rank Progression */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-xianxia-gold">
          {locale === "vi" ? "Thăng Tiến" : "Rank Progression"}
        </h2>
        <div className="flex items-center justify-between text-sm">
          <div
            className={`text-center ${rank === "NgoạiMôn" ? "text-xianxia-accent font-bold" : "text-gray-500"}`}
          >
            {locale === "vi" ? "Ngoại Môn" : "Outer"}
          </div>
          <div className="flex-1 h-1 bg-gray-700 mx-2">
            <div
              className={`h-full bg-xianxia-accent transition-all ${rank !== "NgoạiMôn" ? "w-full" : "w-0"}`}
            ></div>
          </div>
          <div
            className={`text-center ${rank === "NộiMôn" ? "text-xianxia-accent font-bold" : rank === "NgoạiMôn" ? "text-gray-500" : "text-gray-400"}`}
          >
            {locale === "vi" ? "Nội Môn" : "Inner"}
          </div>
          <div className="flex-1 h-1 bg-gray-700 mx-2">
            <div
              className={`h-full bg-xianxia-accent transition-all ${["ChânTruyền", "TrưởngLão", "ChưởngMôn"].includes(rank) ? "w-full" : "w-0"}`}
            ></div>
          </div>
          <div
            className={`text-center ${rank === "ChânTruyền" ? "text-xianxia-accent font-bold" : ["NgoạiMôn", "NộiMôn"].includes(rank) ? "text-gray-500" : "text-gray-400"}`}
          >
            {locale === "vi" ? "Chân Truyền" : "True"}
          </div>
          <div className="flex-1 h-1 bg-gray-700 mx-2">
            <div
              className={`h-full bg-xianxia-accent transition-all ${["TrưởngLão", "ChưởngMôn"].includes(rank) ? "w-full" : "w-0"}`}
            ></div>
          </div>
          <div
            className={`text-center ${rank === "TrưởngLão" ? "text-xianxia-accent font-bold" : rank === "ChưởngMôn" ? "text-gray-400" : "text-gray-500"}`}
          >
            {locale === "vi" ? "Trưởng Lão" : "Elder"}
          </div>
          <div className="flex-1 h-1 bg-gray-700 mx-2">
            <div
              className={`h-full bg-xianxia-accent transition-all ${rank === "ChưởngMôn" ? "w-full" : "w-0"}`}
            ></div>
          </div>
          <div
            className={`text-center ${rank === "ChưởngMôn" ? "text-xianxia-accent font-bold" : "text-gray-500"}`}
          >
            {locale === "vi" ? "Chưởng Môn" : "Master"}
          </div>
        </div>

        {/* Next rank requirements */}
        {nextRank && nextRankReqs && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              {locale === "vi"
                ? `Yêu cầu thăng lên ${rankNames.vi[nextRank]}:`
                : `Requirements for ${rankNames.en[nextRank]}:`}
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div
                  className={`text-sm font-bold ${contribution >= nextRankReqs.contribution ? "text-green-400" : "text-gray-300"}`}
                >
                  {contribution} / {nextRankReqs.contribution}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {locale === "vi" ? "Cống hiến" : "Contribution"}
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                  <div
                    className={`h-full rounded-full transition-all ${contribution >= nextRankReqs.contribution ? "bg-green-400" : "bg-xianxia-accent"}`}
                    style={{
                      width: `${Math.min(100, (contribution / nextRankReqs.contribution) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="text-center">
                <div
                  className={`text-sm font-bold ${reputation >= nextRankReqs.reputation ? "text-green-400" : "text-gray-300"}`}
                >
                  {reputation} / {nextRankReqs.reputation}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {locale === "vi" ? "Danh tiếng" : "Reputation"}
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                  <div
                    className={`h-full rounded-full transition-all ${reputation >= nextRankReqs.reputation ? "bg-green-400" : "bg-xianxia-accent"}`}
                    style={{
                      width: `${Math.min(100, (reputation / nextRankReqs.reputation) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="text-center">
                <div
                  className={`text-sm font-bold ${missions_completed >= nextRankReqs.missions ? "text-green-400" : "text-gray-300"}`}
                >
                  {missions_completed} / {nextRankReqs.missions}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {locale === "vi" ? "Nhiệm vụ" : "Missions"}
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                  <div
                    className={`h-full rounded-full transition-all ${missions_completed >= nextRankReqs.missions ? "bg-green-400" : "bg-xianxia-accent"}`}
                    style={{
                      width: `${Math.min(100, (missions_completed / nextRankReqs.missions) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {!nextRank && (
          <div className="mt-4 pt-4 border-t border-gray-700 text-center text-xianxia-gold text-sm">
            {locale === "vi" ? "🎉 Đã đạt cấp bậc cao nhất!" : "🎉 Highest rank achieved!"}
          </div>
        )}
      </div>
    </div>
  );
}
