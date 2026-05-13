"use client";

import { GameState } from "@/types/game";
import { Locale } from "@/lib/i18n/translations";
import { getSectById } from "@/lib/game/sects";
import { Seal } from "@/components/ui";

interface SectWarBannerProps {
  state: GameState;
  locale: Locale;
}

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

  const accent = urgent
    ? "var(--cinnabar)"
    : onTrack
      ? "var(--jade)"
      : "var(--gold)";

  return (
    <div
      className="ink-card"
      style={{
        padding: 20,
        marginBottom: 22,
        position: "relative",
        borderLeft: `3px solid ${accent}`,
        background: `linear-gradient(90deg, var(--card) 0%, var(--card-deep) 50%, var(--card) 100%)`,
        overflow: "hidden",
      }}
    >
      <span
        className="han-bg"
        style={{
          position: "absolute",
          top: -20,
          right: -10,
          fontSize: 180,
        }}
        aria-hidden
      >
        戰
      </span>
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Seal variant={urgent ? "cinnabar" : "ink"} size="md">
              戰
            </Seal>
            <div>
              <h2
                className="t-display"
                style={{
                  fontSize: 20,
                  color: "var(--ink)",
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                {locale === "vi" ? "Đại Chiến Tông Môn" : "Sect War"}
              </h2>
              <p
                className="t-body"
                style={{
                  fontStyle: "italic",
                  color: "var(--ink-soft)",
                  fontSize: 13,
                  margin: "4px 0 0",
                }}
              >
                {ownName}
                <span style={{ color: "var(--ink-mute)", margin: "0 8px" }}>
                  vs
                </span>
                <span style={{ color: "var(--cinnabar-deep)" }}>{rivalName}</span>
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              className="t-num"
              style={{
                fontSize: 14,
                color: urgent ? "var(--cinnabar-deep)" : "var(--ink)",
                fontWeight: 600,
              }}
            >
              {locale === "vi" ? `Còn ${turnsLeft} lượt` : `${turnsLeft} turns left`}
            </div>
            <div
              className="label"
              style={{ color: "var(--ink-mute)", fontSize: 10 }}
            >
              {onTrack
                ? locale === "vi"
                  ? "Đủ điểm thắng"
                  : "Target met"
                : locale === "vi"
                  ? "Cần thêm điểm"
                  : "Need more score"}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          <span
            className="label"
            style={{ color: "var(--ink-mute)" }}
          >
            {locale === "vi" ? "Điểm Chiến Tranh" : "War Score"}
          </span>
          <span
            className="t-num"
            style={{
              fontSize: 13,
              color: onTrack ? "var(--jade-deep)" : "var(--gold-deep)",
              fontWeight: 600,
            }}
          >
            {war.player_score} / {war.target_score}
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
              width: `${pct}%`,
              background: onTrack
                ? "linear-gradient(90deg, var(--jade-deep), var(--jade-soft))"
                : urgent
                  ? "linear-gradient(90deg, var(--cinnabar-deep), var(--cinnabar))"
                  : "linear-gradient(90deg, var(--gold-deep), var(--gold-soft))",
              transition: "width 0.6s",
            }}
          />
        </div>

        <p
          className="t-body"
          style={{
            fontStyle: "italic",
            color: "var(--ink-mute)",
            fontSize: 12,
            margin: "12px 0 0",
            lineHeight: 1.55,
          }}
        >
          {locale === "vi"
            ? `Thắng trận và hoàn thành nhiệm vụ nhắm vào ${rivalName} để tích điểm chiến tranh. Đạt mốc trước khi hết lượt để tông môn thắng trận.`
            : `Win combats and complete missions against ${rivalName} to accumulate war score. Hit the target before time runs out to secure victory.`}
        </p>
      </div>
    </div>
  );
}
