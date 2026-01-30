"use client";

import { GameState } from "@/types/game";
import { Locale, t } from "@/lib/i18n/translations";
import { calculateTotalAttributes } from "@/lib/game/equipment";

interface CharacterStatChartProps {
  state: GameState;
  locale: Locale;
}

interface DerivedStats {
  // Combat Stats
  physicalAttack: number;
  qiAttack: number;
  defense: number;
  criticalChance: number;
  criticalDamage: number;
  qiCriticalChance: number;
  accuracy: number;
  evasion: number;

  // Survival Stats
  healthRegen: number;
  qiRegen: number;

  // Utility Stats
  lootQuality: number;
  encounterChance: number;
  breakthroughBonus: number;
  comprehension: number;
}

function calculateDerivedStats(state: GameState): DerivedStats {
  const attrs = calculateTotalAttributes(state);

  return {
    // Physical Attack = Base(10) + STR + STR/2 (from equipment bonus)
    physicalAttack: Math.floor(attrs.str * 1.5),

    // Qi Attack = INT×2 + STR/2
    qiAttack: Math.floor(attrs.int * 2 + attrs.str / 2),

    // Defense = Base + AGI/3
    defense: Math.floor(5 + attrs.agi / 3),

    // Critical Chance = 10% base + STR×0.2% + LUCK×0.3%
    criticalChance: 10 + attrs.str * 0.2 + attrs.luck * 0.3,

    // Critical Damage = 150% base + LUCK×1%
    criticalDamage: 150 + attrs.luck * 1,

    // Qi Critical Chance = 15% base + INT×0.3% + LUCK×0.4%
    qiCriticalChance: 15 + attrs.int * 0.3 + attrs.luck * 0.4,

    // Accuracy = 85% base + PERCEPTION×1%
    accuracy: 85 + attrs.perception * 1,

    // Evasion = 5% base + AGI×0.5% + PERCEPTION×0.3% + LUCK×0.2%
    evasion: 5 + attrs.agi * 0.5 + attrs.perception * 0.3 + attrs.luck * 0.2,

    // Health Regen per turn = STR/2
    healthRegen: Math.floor(attrs.str / 2),

    // Qi Regen per turn = INT/3
    qiRegen: Math.floor(attrs.int / 3),

    // Loot Quality = PERCEPTION×2 + LUCK×3
    lootQuality: attrs.perception * 2 + attrs.luck * 3,

    // Special Encounter Chance = PERCEPTION×1% + LUCK×2%
    encounterChance: attrs.perception * 1 + attrs.luck * 2,

    // Breakthrough Success Bonus = INT×1% + LUCK×1.5%
    breakthroughBonus: attrs.int * 1 + attrs.luck * 1.5,

    // Technique Comprehension = INT×2 + PERCEPTION
    comprehension: attrs.int * 2 + attrs.perception,
  };
}

export default function CharacterStatChart({ state, locale }: CharacterStatChartProps) {
  const attrs = calculateTotalAttributes(state);
  const derived = calculateDerivedStats(state);

  return (
    <div className="space-y-6">
      {/* Primary Attributes with Visual Bars */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">
          {locale === "vi" ? "Thuộc Tính Chính" : "Primary Attributes"}
        </h2>
        <div className="space-y-3">
          <AttributeRow
            label={t(locale, "strength")}
            value={attrs.str}
            icon="💪"
            color="bg-red-500"
            textColor="text-red-400"
          />
          <AttributeRow
            label={t(locale, "agility")}
            value={attrs.agi}
            icon="⚡"
            color="bg-green-500"
            textColor="text-green-400"
          />
          <AttributeRow
            label={t(locale, "intelligence")}
            value={attrs.int}
            icon="🧠"
            color="bg-blue-500"
            textColor="text-blue-400"
          />
          <AttributeRow
            label={t(locale, "perception")}
            value={attrs.perception}
            icon="👁️"
            color="bg-purple-500"
            textColor="text-purple-400"
          />
          <AttributeRow
            label={t(locale, "luck")}
            value={attrs.luck}
            icon="🍀"
            color="bg-yellow-500"
            textColor="text-yellow-400"
          />
        </div>
      </div>

      {/* Combat Stats */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-red-400">
          {locale === "vi" ? "Chỉ Số Chiến Đấu" : "Combat Stats"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DerivedStatRow
            label={locale === "vi" ? "Tấn Công Vật Lý" : "Physical Attack"}
            value={derived.physicalAttack.toString()}
            formula={locale === "vi" ? "STR × 1.5" : "STR × 1.5"}
            color="red"
          />
          <DerivedStatRow
            label={locale === "vi" ? "Tấn Công Khí Công" : "Qi Attack"}
            value={derived.qiAttack.toString()}
            formula={locale === "vi" ? "INT × 2 + STR ÷ 2" : "INT × 2 + STR ÷ 2"}
            color="blue"
          />
          <DerivedStatRow
            label={locale === "vi" ? "Phòng Thủ" : "Defense"}
            value={derived.defense.toString()}
            formula={locale === "vi" ? "5 + AGI ÷ 3" : "5 + AGI ÷ 3"}
            color="gray"
          />
          <DerivedStatRow
            label={locale === "vi" ? "Tỷ Lệ Chí Mạng" : "Critical Chance"}
            value={`${derived.criticalChance.toFixed(1)}%`}
            formula={locale === "vi" ? "10% + STR×0.2% + LUCK×0.3%" : "10% + STR×0.2% + LUCK×0.3%"}
            color="orange"
          />
          <DerivedStatRow
            label={locale === "vi" ? "Sát Thương Chí Mạng" : "Critical Damage"}
            value={`${derived.criticalDamage.toFixed(0)}%`}
            formula={locale === "vi" ? "150% + LUCK×1%" : "150% + LUCK×1%"}
            color="orange"
          />
          <DerivedStatRow
            label={locale === "vi" ? "CM Khí Công" : "Qi Critical"}
            value={`${derived.qiCriticalChance.toFixed(1)}%`}
            formula={locale === "vi" ? "15% + INT×0.3% + LUCK×0.4%" : "15% + INT×0.3% + LUCK×0.4%"}
            color="cyan"
          />
          <DerivedStatRow
            label={locale === "vi" ? "Chính Xác" : "Accuracy"}
            value={`${Math.min(99, derived.accuracy).toFixed(1)}%`}
            formula={locale === "vi" ? "85% + PER×1%" : "85% + PER×1%"}
            color="purple"
          />
          <DerivedStatRow
            label={locale === "vi" ? "Né Tránh" : "Evasion"}
            value={`${Math.min(75, derived.evasion).toFixed(1)}%`}
            formula={
              locale === "vi"
                ? "5% + AGI×0.5% + PER×0.3% + LUCK×0.2%"
                : "5% + AGI×0.5% + PER×0.3% + LUCK×0.2%"
            }
            color="green"
          />
        </div>
      </div>

      {/* Survival Stats */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-green-400">
          {locale === "vi" ? "Chỉ Số Sinh Tồn" : "Survival Stats"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DerivedStatRow
            label={locale === "vi" ? "Hồi Máu/Lượt" : "HP Regen/Turn"}
            value={derived.healthRegen.toString()}
            formula={locale === "vi" ? "STR ÷ 2" : "STR ÷ 2"}
            color="red"
          />
          <DerivedStatRow
            label={locale === "vi" ? "Hồi Khí/Lượt" : "Qi Regen/Turn"}
            value={derived.qiRegen.toString()}
            formula={locale === "vi" ? "INT ÷ 3" : "INT ÷ 3"}
            color="blue"
          />
        </div>
      </div>

      {/* Utility Stats */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-purple-400">
          {locale === "vi" ? "Chỉ Số Khác" : "Utility Stats"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DerivedStatRow
            label={locale === "vi" ? "Chất Lượng Phần Thưởng" : "Loot Quality"}
            value={derived.lootQuality.toString()}
            formula={locale === "vi" ? "PER×2 + LUCK×3" : "PER×2 + LUCK×3"}
            color="yellow"
          />
          <DerivedStatRow
            label={locale === "vi" ? "Cơ Hội Đặc Biệt" : "Special Encounters"}
            value={`${derived.encounterChance.toFixed(1)}%`}
            formula={locale === "vi" ? "PER×1% + LUCK×2%" : "PER×1% + LUCK×2%"}
            color="purple"
          />
          <DerivedStatRow
            label={locale === "vi" ? "Thưởng Đột Phá" : "Breakthrough Bonus"}
            value={`+${derived.breakthroughBonus.toFixed(1)}%`}
            formula={locale === "vi" ? "INT×1% + LUCK×1.5%" : "INT×1% + LUCK×1.5%"}
            color="gold"
          />
          <DerivedStatRow
            label={locale === "vi" ? "Lĩnh Ngộ Công Pháp" : "Comprehension"}
            value={derived.comprehension.toString()}
            formula={locale === "vi" ? "INT×2 + PER" : "INT×2 + PER"}
            color="cyan"
          />
        </div>
      </div>
    </div>
  );
}

// Helper Components
interface AttributeRowProps {
  label: string;
  value: number;
  icon: string;
  color: string;
  textColor: string;
}

function AttributeRow({ label, value, icon, color, textColor }: AttributeRowProps) {
  const percentage = Math.min(100, (value / 100) * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="text-2xl w-8">{icon}</div>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-sm text-gray-300">{label}</span>
          <span className={`text-lg font-bold ${textColor}`}>{value}</span>
        </div>
        <div className="w-full bg-xianxia-darker rounded-full h-2 border border-xianxia-accent/20">
          <div
            className={`${color} h-full rounded-full transition-all duration-500 relative overflow-hidden`}
            style={{ width: `${percentage}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface DerivedStatRowProps {
  label: string;
  value: string;
  formula: string;
  color: string;
}

function DerivedStatRow({ label, value, formula, color }: DerivedStatRowProps) {
  const colorClasses: Record<string, string> = {
    red: "text-red-400",
    green: "text-green-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
    yellow: "text-yellow-400",
    orange: "text-orange-400",
    cyan: "text-cyan-400",
    gray: "text-gray-400",
    gold: "text-xianxia-gold",
  };

  return (
    <div className="p-3 rounded bg-xianxia-darker border border-xianxia-accent/20">
      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-300">{label}</span>
        <span className={`text-xl font-bold ${colorClasses[color]}`}>{value}</span>
      </div>
      <div className="text-xs text-gray-500">{formula}</div>
    </div>
  );
}
