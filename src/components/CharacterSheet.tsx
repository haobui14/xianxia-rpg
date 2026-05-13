"use client";

import { useState } from "react";
import {
  GameState,
  CultivationTechnique,
  Realm,
  BodyRealm,
} from "@/types/game";
import { t, Locale } from "@/lib/i18n/translations";
import {
  calculateTotalAttributes,
  getEquipmentBonus,
} from "@/lib/game/equipment";
import {
  getElementCompatibility,
  getRequiredExp,
} from "@/lib/game/mechanics";
import CollapsibleSection from "./CollapsibleSection";
import DualCultivationView from "./DualCultivationView";
import {
  Bar,
  Card,
  MeridianStrip,
  Pill,
  RealmOrb,
  SectionHead,
  Seal,
  SmallHead,
  Stat,
} from "@/components/ui";

const MAX_TECHNIQUES = 5;
const MAX_SKILLS = 6;
const MAX_PER_TYPE = 2;

interface CharacterSheetProps {
  state: GameState;
  locale: Locale;
  previousExp?: number;
  onAbilitySwap?: (
    abilityType: "technique" | "skill",
    activeId: string | null,
    queueId: string | null,
    action: "swap" | "forget" | "learn" | "discard"
  ) => Promise<void>;
  onToggleDualCultivation?: () => Promise<void>;
  onSetExpSplit?: (split: number) => Promise<void>;
}

const REALM_HAN: Record<Realm, string> = {
  PhàmNhân: "凡人",
  LuyệnKhí: "練氣",
  TrúcCơ: "築基",
  KếtĐan: "結丹",
  NguyênAnh: "元嬰",
};

const REALM_ORDER: Realm[] = [
  "PhàmNhân",
  "LuyệnKhí",
  "TrúcCơ",
  "KếtĐan",
  "NguyênAnh",
];

const REALM_KEY: Record<Realm, string> = {
  PhàmNhân: "realmMortal",
  LuyệnKhí: "realmQi",
  TrúcCơ: "realmFoundation",
  KếtĐan: "realmCore",
  NguyênAnh: "realmNascent",
};

const BODY_HAN: Record<BodyRealm, string> = {
  PhàmThể: "凡體",
  LuyệnCốt: "煉骨",
  ĐồngCân: "銅筋",
  KimCương: "金剛",
  TháiCổ: "太古",
};

const ATTR_DEF: { key: "str" | "agi" | "int" | "perception" | "luck"; han: string; tKey: string }[] = [
  { key: "str", han: "力", tKey: "attrStrength" },
  { key: "agi", han: "敏", tKey: "attrAgility" },
  { key: "int", han: "覺", tKey: "attrPerception" },
  { key: "perception", han: "觀", tKey: "attrConstitution" },
  { key: "luck", han: "命", tKey: "attrCharisma" },
];

function buildMeridians(state: GameState) {
  // Use spirit-root elements (open) + a fixed-order set for the strip
  const open = new Set(state.spirit_root.elements);
  const order: { id: string; han: string; name: string }[] = [
    { id: "lung", han: "肺", name: "Phế" },
    { id: "heart", han: "心", name: "Tâm" },
    { id: "liver", han: "肝", name: "Can" },
    { id: "spleen", han: "脾", name: "Tỳ" },
    { id: "kidney", han: "腎", name: "Thận" },
    { id: "governor", han: "督", name: "Đốc" },
  ];
  const stage = state.progress.realm_stage ?? 0;
  const baseFlow = Math.min(0.95, 0.35 + stage * 0.08);
  // Map each meridian to an open status — first N matching spirit elements get higher flow
  return order.map((m, idx) => {
    const isOpen = idx < open.size + 1;
    return {
      id: m.id,
      name: m.name,
      han: m.han,
      open: isOpen,
      flow: isOpen ? Math.min(0.95, baseFlow + idx * 0.05) : 0.05,
    };
  });
}

export default function CharacterSheet({
  state,
  locale,
  previousExp: _previousExp,
  onAbilitySwap,
  onToggleDualCultivation,
  onSetExpSplit,
}: CharacterSheetProps) {
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [selectedQueueTech, setSelectedQueueTech] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedQueueSkill, setSelectedQueueSkill] = useState<string | null>(
    null
  );
  const [swapLoading, setSwapLoading] = useState(false);

  const techniqueQueue = state.technique_queue || [];
  const skillQueue = state.skill_queue || [];

  const techCountByType = (type: string) =>
    state.techniques?.filter((t) => t.type === type).length || 0;
  const skillCountByType = (type: string) =>
    state.skills?.filter((s) => s.type === type).length || 0;

  const handleAbilityAction = async (
    abilityType: "technique" | "skill",
    activeId: string | null,
    queueId: string | null,
    action: "swap" | "forget" | "learn" | "discard"
  ) => {
    if (!onAbilitySwap || swapLoading) return;
    setSwapLoading(true);
    try {
      await onAbilitySwap(abilityType, activeId, queueId, action);
      if (abilityType === "technique") {
        setSelectedTech(null);
        setSelectedQueueTech(null);
      } else {
        setSelectedSkill(null);
        setSelectedQueueSkill(null);
      }
    } finally {
      setSwapLoading(false);
    }
  };

  const totalAttrs = calculateTotalAttributes(state);
  const hpBonus = getEquipmentBonus(state, "hp");
  const qiBonus = getEquipmentBonus(state, "qi");
  const staminaBonus = getEquipmentBonus(state, "stamina");
  const requiredExp = getRequiredExp(
    state.progress.realm,
    state.progress.realm_stage
  );
  const realmProgress = Math.min(
    100,
    Math.round(((state.progress.realm_stage ?? 0) / 9) * 100)
  );

  const realm = state.progress.realm;
  const realmHan = REALM_HAN[realm];
  const realmName = t(locale, REALM_KEY[realm]);

  const meridians = buildMeridians(state);

  const activeTechs = state.techniques ?? [];

  return (
    <div>
      <SectionHead
        han="身"
        title={locale === "vi" ? "Bảng Tu Sĩ" : "Cultivator Sheet"}
        subtitle={locale === "vi" ? "Thân — Tâm — Pháp" : "Body · Mind · Method"}
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <Pill variant="cinnabar" withDot>
              {realmHan}
            </Pill>
            <Pill variant="jade">{realmProgress}%</Pill>
          </div>
        }
      />

      {/* Top — 3-col grid */}
      <div className="grid-3-col" style={{ gap: 18, marginBottom: 18 }}>
        {/* Left: Song Tu Pháp Lộ */}
        <Card padding={22} className="card-corner" style={{ position: "relative" }}>
          <span
            className="han-bg"
            style={{ position: "absolute", top: -30, right: -20, fontSize: 220 }}
            aria-hidden
          >
            修
          </span>
          <div style={{ position: "relative", zIndex: 1 }}>
            <SmallHead>
              {locale === "vi" ? "Song Tu Pháp Lộ" : "Dual Path"}
            </SmallHead>
            <RealmOrb
              han={realmHan}
              name={realmName}
              stage={state.progress.realm_stage ?? 0}
              stageMax={9}
              progress={realmProgress}
            />
            <div className="hr-soft" style={{ margin: "16px 0 10px" }} />

            {state.progress.body_realm && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 6,
                  }}
                >
                  <span
                    className="t-display"
                    style={{ fontSize: 15, color: "var(--ink)" }}
                  >
                    <span
                      className="t-han"
                      style={{
                        fontSize: 14,
                        color: "var(--cinnabar-deep)",
                        marginRight: 6,
                      }}
                    >
                      {BODY_HAN[state.progress.body_realm]}
                    </span>
                    {locale === "vi" ? "Đoán Cốt" : "Body Tempering"}
                  </span>
                  <span
                    className="t-num"
                    style={{ fontSize: 11, color: "var(--ink-mute)" }}
                  >
                    {state.progress.body_stage ?? 0}/9
                  </span>
                </div>
                <Bar
                  kind="stam"
                  value={state.progress.body_exp ?? 0}
                  max={Math.max(state.progress.body_exp ?? 0, 100)}
                  showNums={false}
                />
              </>
            )}

            <div className="hr-soft" style={{ margin: "14px 0 10px" }} />
            <SmallHead>
              {locale === "vi" ? "Đại Đạo Thăng Tiến" : "Realm Ladder"}
            </SmallHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {REALM_ORDER.map((r, i) => {
                const currentIdx = REALM_ORDER.indexOf(realm);
                const state_ =
                  i < currentIdx ? "done" : i === currentIdx ? "current" : "future";
                const dot =
                  state_ === "done"
                    ? "var(--ink)"
                    : state_ === "current"
                      ? "var(--cinnabar)"
                      : "var(--line-strong)";
                return (
                  <div
                    key={r}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      opacity: state_ === "future" ? 0.4 : 1,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: dot,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      className="t-han"
                      style={{
                        fontSize: 14,
                        color:
                          state_ === "current"
                            ? "var(--cinnabar)"
                            : "var(--ink-soft)",
                      }}
                    >
                      {REALM_HAN[r]}
                    </span>
                    <span
                      className="t-display"
                      style={{
                        fontSize: 13,
                        color: "var(--ink)",
                        flex: 1,
                      }}
                    >
                      {t(locale, REALM_KEY[r])}
                    </span>
                    {state_ === "current" && (
                      <span
                        className="t-num"
                        style={{
                          fontSize: 11,
                          color: "var(--ink-mute)",
                        }}
                      >
                        {state.progress.realm_stage ?? 0}/9
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Middle: Attributes + Vitality */}
        <Card padding={22}>
          <SmallHead>
            {locale === "vi" ? "Lục Diện Thuộc Tính" : "Attributes"}
          </SmallHead>
          {ATTR_DEF.map(({ key, han, tKey }) => (
            <Stat
              key={key}
              icon={han}
              label={t(locale, tKey)}
              value={String((totalAttrs as any)[key] ?? state.attrs[key])}
            />
          ))}

          <div className="hr-soft" style={{ margin: "14px 0 10px" }} />
          <SmallHead>{locale === "vi" ? "Sinh Lực" : "Vitality"}</SmallHead>
          <Bar
            kind="hp"
            label={t(locale, "statsHp")}
            value={state.stats.hp}
            max={state.stats.hp_max}
            sub={hpBonus ? `+${hpBonus}` : undefined}
          />
          <Bar
            kind="qi"
            label={t(locale, "statsQi")}
            value={state.stats.qi}
            max={state.stats.qi_max}
            sub={qiBonus ? `+${qiBonus}` : undefined}
          />
          <Bar
            kind="stam"
            label={t(locale, "statsStamina")}
            value={state.stats.stamina}
            max={state.stats.stamina_max}
            sub={staminaBonus ? `+${staminaBonus}` : undefined}
          />

          <div className="hr-soft" style={{ margin: "14px 0 10px" }} />
          <SmallHead>
            {locale === "vi" ? "Tu Vi" : "Cultivation"}
          </SmallHead>
          <Bar
            kind="exp"
            label={locale === "vi" ? "Tu Vi" : "Exp"}
            value={state.progress.cultivation_exp}
            max={requiredExp === Infinity ? state.progress.cultivation_exp || 1 : requiredExp}
            showNums={requiredExp !== Infinity}
          />
        </Card>

        {/* Right: Meridians + Sect Standing */}
        <Card padding={22}>
          <SmallHead>
            {locale === "vi" ? "Kinh Mạch Đồ" : "Meridian Map"}
          </SmallHead>
          <MeridianStrip meridians={meridians} />

          <div className="hr-soft" style={{ margin: "14px 0 10px" }} />
          <SmallHead>
            {locale === "vi" ? "Khí Lưu Tâm Đắc" : "Qi Reading"}
          </SmallHead>
          <p
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-soft)",
              fontSize: 13,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {locale === "vi"
              ? meridians.filter((m) => m.open).length >= 5
                ? "Khí mạch khai thông như sông suối — đại đạo gần kề."
                : meridians.filter((m) => m.open).length >= 3
                  ? "Khí mạch đã thông quá nửa — có thể tiến vào đan đạo."
                  : "Khí mạch còn bế tắc — phải kiên trì tịnh tu."
              : meridians.filter((m) => m.open).length >= 5
                ? "The meridians flow like rivers — the great way is near."
                : meridians.filter((m) => m.open).length >= 3
                  ? "Over half the meridians are open — alchemy beckons."
                  : "The meridians remain blocked — patient training is required."}
          </p>

          {state.sect_membership && (
            <>
              <div className="hr-soft" style={{ margin: "14px 0 10px" }} />
              <SmallHead
                right={
                  <Pill variant="cinnabar">
                    {locale === "vi"
                      ? state.sect_membership.rank
                      : state.sect_membership.rank}
                  </Pill>
                }
              >
                {locale === "vi" ? "Vị Thế Trong Môn Phái" : "Sect Standing"}
              </SmallHead>
              <Stat
                icon="派"
                label={locale === "vi" ? "Môn Phái" : "Sect"}
                value={
                  locale === "vi"
                    ? state.sect_membership.sect.name
                    : state.sect_membership.sect.name_en
                }
              />
              <Stat
                icon="功"
                label={locale === "vi" ? "Cống Hiến" : "Contribution"}
                value={state.sect_membership.contribution}
              />
              <Bar
                label={locale === "vi" ? "Danh Tiếng" : "Reputation"}
                kind="exp"
                value={state.sect_membership.reputation}
                max={100}
              />
            </>
          )}
        </Card>
      </div>

      {/* Active techniques (ability cards) */}
      <Card padding={22} style={{ marginBottom: 18 }}>
        <SmallHead
          right={
            <Pill variant="jade">
              {activeTechs.length}/{MAX_TECHNIQUES}
            </Pill>
          }
        >
          {locale === "vi" ? "Công Pháp · Đã Trang Bị" : "Equipped Techniques"}
        </SmallHead>
        {activeTechs.length === 0 ? (
          <p
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-mute)",
              fontSize: 14,
              margin: "10px 0 0",
            }}
          >
            {locale === "vi"
              ? "Chưa lĩnh hội công pháp nào."
              : "No techniques learned yet."}
          </p>
        ) : (
          <div className="grid-tech" style={{ gap: 12, marginTop: 10 }}>
            {activeTechs.slice(0, 4).map((tech, idx) => (
              <TechCard
                key={tech.id}
                tech={tech}
                slot={`F${idx + 1}`}
                state={state}
                locale={locale}
                selected={selectedTech === tech.id}
                onSelect={() =>
                  setSelectedTech(selectedTech === tech.id ? null : tech.id)
                }
                onForget={
                  onAbilitySwap
                    ? () =>
                        handleAbilityAction("technique", tech.id, null, "forget")
                    : undefined
                }
                swapLoading={swapLoading}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Ability management — keep existing collapsible flow */}
      <DualCultivationView
        state={state}
        locale={locale}
        onToggleDualCultivation={onToggleDualCultivation}
        onSetExpSplit={onSetExpSplit}
      />

      <CollapsibleSection
        title={locale === "vi" ? "Hàng Chờ — Công Pháp" : "Technique Queue"}
        badge={`${techniqueQueue.length}`}
        defaultOpen={techniqueQueue.length > 0}
      >
        {techniqueQueue.length === 0 ? (
          <p
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-mute)",
              fontSize: 13,
              margin: 0,
            }}
          >
            {locale === "vi"
              ? "Không có công pháp đang chờ."
              : "No techniques waiting."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {techniqueQueue.map((tech) => {
              const isSelected = selectedQueueTech === tech.id;
              const canLearn =
                (state.techniques?.length || 0) < MAX_TECHNIQUES &&
                techCountByType(tech.type) < MAX_PER_TYPE;
              return (
                <Card
                  key={tech.id}
                  padding={14}
                  style={{
                    borderLeft: `3px solid ${isSelected ? "var(--cinnabar)" : "var(--gold)"}`,
                    cursor: onAbilitySwap ? "pointer" : "default",
                  }}
                >
                  <div onClick={() =>
                    onAbilitySwap &&
                    setSelectedQueueTech(isSelected ? null : tech.id)
                  }>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span
                        className="t-display"
                        style={{ fontSize: 16, color: "var(--ink)" }}
                      >
                        {locale === "vi" ? tech.name : tech.name_en}
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Pill>{tech.type}</Pill>
                        <Pill variant="gold">{tech.grade}</Pill>
                      </div>
                    </div>
                    {isSelected && onAbilitySwap && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {canLearn && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbilityAction(
                                "technique",
                                null,
                                tech.id,
                                "learn"
                              );
                            }}
                            disabled={swapLoading}
                            className="ink-btn primary sm"
                          >
                            <span className="t-han">學</span>
                            {locale === "vi" ? "Lĩnh Hội" : "Learn"}
                          </button>
                        )}
                        {selectedTech && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbilityAction(
                                "technique",
                                selectedTech,
                                tech.id,
                                "swap"
                              );
                            }}
                            disabled={swapLoading}
                            className="ink-btn sm"
                          >
                            <span className="t-han">換</span>
                            {locale === "vi" ? "Hoán Đổi" : "Swap"}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAbilityAction(
                              "technique",
                              null,
                              tech.id,
                              "discard"
                            );
                          }}
                          disabled={swapLoading}
                          className="ink-btn cinnabar sm"
                        >
                          <span className="t-han">棄</span>
                          {locale === "vi" ? "Vứt" : "Discard"}
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={locale === "vi" ? "Kĩ Năng" : "Skills"}
        badge={`${state.skills?.length || 0}/${MAX_SKILLS}`}
        defaultOpen={false}
      >
        {!state.skills || state.skills.length === 0 ? (
          <p
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-mute)",
              fontSize: 13,
              margin: 0,
            }}
          >
            {locale === "vi" ? "Chưa có kĩ năng nào." : "No skills yet."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {state.skills.map((skill) => {
              const isSelected = selectedSkill === skill.id;
              return (
                <Card
                  key={skill.id}
                  padding={14}
                  style={{
                    borderLeft: `3px solid ${isSelected ? "var(--cinnabar)" : "var(--jade)"}`,
                    cursor: onAbilitySwap ? "pointer" : "default",
                  }}
                >
                  <div
                    onClick={() =>
                      onAbilitySwap &&
                      setSelectedSkill(isSelected ? null : skill.id)
                    }
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span
                        className="t-display"
                        style={{ fontSize: 16, color: "var(--ink)" }}
                      >
                        {locale === "vi" ? skill.name : skill.name_en}
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Pill>{skill.type}</Pill>
                        <Pill variant="jade">
                          Lv {skill.level}/{skill.max_level}
                        </Pill>
                      </div>
                    </div>
                    <p
                      className="t-body"
                      style={{
                        fontStyle: "italic",
                        color: "var(--ink-soft)",
                        fontSize: 12,
                        margin: "6px 0 0",
                      }}
                    >
                      {locale === "vi" ? skill.description : skill.description_en}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        marginTop: 8,
                        fontSize: 11,
                        color: "var(--ink-mute)",
                        flexWrap: "wrap",
                      }}
                    >
                      <span>
                        <span className="t-han">氣</span> {skill.qi_cost}
                      </span>
                      <span>
                        <span className="t-han">封</span> {skill.cooldown}
                      </span>
                      <span>
                        <span className="t-han">擊</span> ×
                        {skill.damage_multiplier.toFixed(1)}
                      </span>
                    </div>
                    {isSelected && onAbilitySwap && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAbilityAction(
                              "skill",
                              skill.id,
                              null,
                              "forget"
                            );
                          }}
                          disabled={swapLoading}
                          className="ink-btn cinnabar sm"
                        >
                          {locale === "vi" ? "Quên" : "Forget"}
                        </button>
                        {selectedQueueSkill && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbilityAction(
                                "skill",
                                skill.id,
                                selectedQueueSkill,
                                "swap"
                              );
                            }}
                            disabled={swapLoading}
                            className="ink-btn sm"
                          >
                            {locale === "vi" ? "Hoán Đổi" : "Swap"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {skillQueue.length > 0 && (
          <>
            <div className="hr-soft" style={{ margin: "14px 0 10px" }} />
            <SmallHead>
              {locale === "vi" ? "Hàng Chờ — Kĩ Năng" : "Skill Queue"}
            </SmallHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {skillQueue.map((skill) => {
                const isSelected = selectedQueueSkill === skill.id;
                const canLearn =
                  (state.skills?.length || 0) < MAX_SKILLS &&
                  skillCountByType(skill.type) < MAX_PER_TYPE;
                return (
                  <Card
                    key={skill.id}
                    padding={12}
                    style={{
                      borderLeft: `3px solid ${isSelected ? "var(--cinnabar)" : "var(--gold)"}`,
                      cursor: onAbilitySwap ? "pointer" : "default",
                    }}
                  >
                    <div
                      onClick={() =>
                        onAbilitySwap &&
                        setSelectedQueueSkill(isSelected ? null : skill.id)
                      }
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          className="t-display"
                          style={{ fontSize: 15, color: "var(--ink)" }}
                        >
                          {locale === "vi" ? skill.name : skill.name_en}
                        </span>
                        <Pill>{skill.type}</Pill>
                      </div>
                      {isSelected && onAbilitySwap && (
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {canLearn && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAbilityAction(
                                  "skill",
                                  null,
                                  skill.id,
                                  "learn"
                                );
                              }}
                              disabled={swapLoading}
                              className="ink-btn primary sm"
                            >
                              {locale === "vi" ? "Lĩnh Hội" : "Learn"}
                            </button>
                          )}
                          {selectedSkill && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAbilityAction(
                                  "skill",
                                  selectedSkill,
                                  skill.id,
                                  "swap"
                                );
                              }}
                              disabled={swapLoading}
                              className="ink-btn sm"
                            >
                              {locale === "vi" ? "Hoán Đổi" : "Swap"}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbilityAction(
                                "skill",
                                null,
                                skill.id,
                                "discard"
                              );
                            }}
                            disabled={swapLoading}
                            className="ink-btn cinnabar sm"
                          >
                            {locale === "vi" ? "Vứt" : "Discard"}
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </CollapsibleSection>
    </div>
  );
}

function TechCard({
  tech,
  slot,
  state,
  locale,
  selected,
  onSelect,
  onForget,
  swapLoading,
}: {
  tech: CultivationTechnique;
  slot: string;
  state: GameState;
  locale: Locale;
  selected: boolean;
  onSelect: () => void;
  onForget?: () => void;
  swapLoading: boolean;
}) {
  const compatibility =
    tech.elements && tech.elements.length > 0
      ? getElementCompatibility(state.spirit_root.elements, tech.elements)
      : 0;
  const compatLabel =
    compatibility >= 0.25
      ? locale === "vi"
        ? "Tuyệt vời"
        : "Perfect"
      : compatibility >= 0.1
        ? locale === "vi"
          ? "Tốt"
          : "Good"
        : compatibility >= 0
          ? locale === "vi"
            ? "Trung bình"
            : "Neutral"
          : compatibility >= -0.15
            ? locale === "vi"
              ? "Yếu"
              : "Weak"
            : locale === "vi"
              ? "Xung khắc"
              : "Conflict";
  const compatVariant =
    compatibility >= 0.25
      ? "cinnabar"
      : compatibility >= 0.1
        ? "jade"
        : "default";

  const techHan = (locale === "vi" ? tech.name : tech.name_en).charAt(0);

  return (
    <Card
      padding={16}
      style={{
        position: "relative",
        cursor: "pointer",
        borderColor: selected ? "var(--cinnabar)" : "var(--line)",
        boxShadow: selected
          ? "0 0 0 1px var(--cinnabar) inset, 0 1px 2px var(--card-shadow)"
          : undefined,
      }}
    >
      <div onClick={onSelect}>
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 14,
            fontFamily: "var(--font-ui), Inter, sans-serif",
            fontSize: 11,
            letterSpacing: "0.16em",
            color: "var(--ink-faint)",
          }}
        >
          {slot}
        </div>
        <div
          className="t-han"
          style={{
            fontSize: 42,
            color: "var(--cinnabar)",
            lineHeight: 1,
            letterSpacing: "0.04em",
          }}
        >
          {techHan}
        </div>
        <div
          className="t-display"
          style={{
            fontSize: 16,
            color: "var(--ink)",
            marginTop: 8,
            lineHeight: 1.2,
          }}
        >
          {locale === "vi" ? tech.name : tech.name_en}
        </div>
        <div
          className="label"
          style={{ marginTop: 2, color: "var(--ink-mute)" }}
        >
          {tech.type} · {tech.grade}
        </div>
        <div className="hr-soft" style={{ margin: "10px 0 8px" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "var(--ink-mute)",
          }}
        >
          <span style={{ color: "var(--jade-deep)" }}>
            <span className="t-han">氣</span>{" "}
            {(tech as any).qi_cost ?? "—"}
          </span>
          <span className="faint">
            <span className="t-han">封</span>{" "}
            {(tech as any).cooldown ?? "—"}
          </span>
        </div>
        {tech.elements && tech.elements.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
            <Pill variant={compatVariant as any}>
              {compatLabel}
              {compatibility !== 0
                ? ` ${compatibility > 0 ? "+" : ""}${Math.round(compatibility * 100)}%`
                : ""}
            </Pill>
          </div>
        )}
        {selected && onForget && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onForget();
            }}
            disabled={swapLoading}
            className="ink-btn cinnabar sm"
            style={{ width: "100%", marginTop: 10, justifyContent: "center" }}
          >
            <span className="t-han">忘</span>
            {locale === "vi" ? "Quên Công Pháp" : "Forget"}
          </button>
        )}
      </div>
    </Card>
  );
}
