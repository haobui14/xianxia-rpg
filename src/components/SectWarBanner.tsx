"use client";

import { GameState } from "@/types/game";
import { Locale } from "@/lib/i18n/translations";
import { getSectById } from "@/lib/game/sects";

interface SectWarBannerProps {
  state: GameState;
  locale: Locale;
}

/**
 * Banner rendered at the top of SectView when an active sect war exists.
 * Shows the two factions, current war score, target, and turns remaining.
 * Phase-2 MVP: the player is always automatically on their own sect's
 * side — there's no UI-side "choose side" or defection yet.
 */
export default function SectWarBanner({ state, locale }: SectWarBannerProps) {
  const war = state.sect_war;
  if (!war) return null;

  const ownSect = getSectById(war.player_sect_id);
  const rivalSect = getSectById(war.rival_sect_id);
  const ownName = ownSect
    ? locale === "vi"
      ? ownSect.name
      : ownSect.name_en
    : war.player_sect_id;
  const rivalName = rivalSect
    ? locale === "vi"
      ? rivalSect.name
      : rivalSect.name_en
    : war.rival_sect_id;

  const turnsLeft = Math.max(0, war.end_turn - state.turn_count);
  const pct = Math.min(100, (war.player_score / war.target_score) * 100);
  const onTrack = war.player_score >= war.target_score;
  const urgent = turnsLeft <= 2 && !onTrack;

  return (
    <div
      className={`rounded-lg border p-5 ${
        urgent
          ? "border-red-500/60 bg-gradient-to-r from-red-900/40 via-xianxia-dark to-red-900/40"
          : "border-amber-500/50 bg-gradient-to-r from-amber-900/30 via-xianxia-dark to-amber-900/30"
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚔️</span>
          <div>
            <h2 className="text-lg font-bold text-xianxia-gold">
              {locale === "vi" ? "Đại Chiến Tông Môn" : "Sect War"}
            </h2>
            <p className="text-xs text-gray-300">
              {ownName}
              <span className="text-gray-500 mx-2">vs</span>
              <span className="text-red-400">{rivalName}</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <div
            className={`text-xs font-mono ${urgent ? "text-red-300" : "text-gray-300"}`}
          >
            {locale === "vi" ? `Còn ${turnsLeft} lượt` : `${turnsLeft} turns left`}
          </div>
          <div className="text-[11px] text-gray-500">
            {onTrack
              ? locale === "vi"
                ? "✨ Đủ điểm thắng"
                : "✨ Target met"
              : locale === "vi"
                ? "Cần thêm điểm"
                : "Need more score"}
          </div>
        </div>
      </div>

      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-gray-400">
          {locale === "vi" ? "Điểm chiến tranh:" : "War score:"}
        </span>
        <span className={onTrack ? "text-green-300 font-bold" : "text-amber-300 font-mono"}>
          {war.player_score} / {war.target_score}
        </span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all ${onTrack ? "bg-green-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-3 text-xs text-gray-400 leading-relaxed">
        {locale === "vi"
          ? `Thắng trận và hoàn thành nhiệm vụ nhắm vào ${rivalName} để tích điểm chiến tranh. Đạt mốc trước khi hết lượt để tông môn thắng trận.`
          : `Win combats and complete missions against ${rivalName} to accumulate war score. Hit the target before time runs out to secure victory.`}
      </p>
    </div>
  );
}
