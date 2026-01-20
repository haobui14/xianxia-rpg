'use client';

import { useMemo, useState, useEffect } from 'react';
import { GameState, Realm } from '@/types/game';
import { t, Locale } from '@/lib/i18n/translations';
import { getRequiredExp, getSpiritRootBonus, getTechniqueBonus } from '@/lib/game/mechanics';
import { getEquipmentBonus } from '@/lib/game/equipment';

interface CultivationVisualizationProps {
  state: GameState;
  locale: Locale;
  previousExp?: number; // For animation when exp changes
}

// Realm color mapping
const REALM_COLORS: Record<Realm, { primary: string; light: string; gradient: string }> = {
  'PhàmNhân': {
    primary: 'rgb(107, 114, 128)',
    light: 'rgb(156, 163, 175)',
    gradient: 'from-gray-600 to-gray-400',
  },
  'LuyệnKhí': {
    primary: 'rgb(16, 185, 129)',
    light: 'rgb(52, 211, 153)',
    gradient: 'from-emerald-600 to-emerald-400',
  },
  'TrúcCơ': {
    primary: 'rgb(59, 130, 246)',
    light: 'rgb(96, 165, 250)',
    gradient: 'from-blue-600 to-blue-400',
  },
  'KếtĐan': {
    primary: 'rgb(139, 92, 246)',
    light: 'rgb(167, 139, 250)',
    gradient: 'from-violet-600 to-violet-400',
  },
  'NguyênAnh': {
    primary: 'rgb(245, 158, 11)',
    light: 'rgb(251, 191, 36)',
    gradient: 'from-amber-500 to-yellow-400',
  },
};

// Realm order for progression display
const REALM_ORDER: Realm[] = ['PhàmNhân', 'LuyệnKhí', 'TrúcCơ', 'KếtĐan', 'NguyênAnh'];

export default function CultivationVisualization({
  state,
  locale,
  previousExp
}: CultivationVisualizationProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayExp, setDisplayExp] = useState(state.progress.cultivation_exp);

  const { realm, realm_stage, cultivation_exp } = state.progress;
  const requiredExp = getRequiredExp(realm, realm_stage);
  const realmColors = REALM_COLORS[realm];

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (requiredExp === Infinity) return 100;
    return Math.min((cultivation_exp / requiredExp) * 100, 100);
  }, [cultivation_exp, requiredExp]);

  // Check if near breakthrough (>90%)
  const isNearBreakthrough = progressPercent >= 90 && requiredExp !== Infinity;
  const isReadyForBreakthrough = cultivation_exp >= requiredExp && requiredExp !== Infinity;

  // Calculate cultivation speed multiplier
  const spiritRootMultiplier = getSpiritRootBonus(state.spirit_root.grade);
  const techniqueMultiplier = getTechniqueBonus(state);
  const equipmentBonus = getEquipmentBonus(state, 'cultivation_speed');
  const totalCultivationSpeed = spiritRootMultiplier * techniqueMultiplier * (1 + equipmentBonus / 100);

  // Animate exp changes
  useEffect(() => {
    if (previousExp !== undefined && previousExp !== cultivation_exp) {
      setIsAnimating(true);
      setDisplayExp(previousExp);

      // Animate to new value
      const startTime = Date.now();
      const duration = 500;
      const startExp = previousExp;
      const endExp = cultivation_exp;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        setDisplayExp(Math.floor(startExp + (endExp - startExp) * easeOut));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
        }
      };

      requestAnimationFrame(animate);
    } else {
      setDisplayExp(cultivation_exp);
    }
  }, [cultivation_exp, previousExp]);

  // Get realm index for progression dots
  const currentRealmIndex = REALM_ORDER.indexOf(realm);

  return (
    <div className="space-y-4">
      {/* Realm Title with Animation */}
      <div className="text-center">
        <div
          className={`inline-block px-6 py-2 rounded-lg border-2 transition-all duration-300 ${
            isReadyForBreakthrough
              ? 'animate-near-breakthrough border-xianxia-gold'
              : 'border-current'
          }`}
          style={{
            borderColor: isReadyForBreakthrough ? undefined : realmColors.primary,
            color: realmColors.primary
          }}
        >
          <span className="text-2xl font-bold">
            {t(locale, realm)}
          </span>
          <span className="ml-2 text-lg opacity-80">
            {locale === 'vi' ? `Tầng ${realm_stage}` : `Stage ${realm_stage}`}
          </span>
        </div>
      </div>

      {/* Realm Progression Dots */}
      <div className="flex justify-center items-center gap-2">
        {REALM_ORDER.map((r, index) => {
          const isCurrentRealm = r === realm;
          const isPastRealm = index < currentRealmIndex;
          const colors = REALM_COLORS[r];

          return (
            <div key={r} className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  isCurrentRealm
                    ? 'animate-glow-pulse scale-125'
                    : isPastRealm
                      ? 'opacity-100'
                      : 'opacity-30'
                }`}
                style={{
                  backgroundColor: isPastRealm || isCurrentRealm ? colors.primary : colors.light,
                  boxShadow: isCurrentRealm ? `0 0 10px ${colors.primary}` : 'none'
                }}
                title={t(locale, r)}
              />
              {index < REALM_ORDER.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-1 transition-all duration-300 ${
                    isPastRealm ? 'opacity-100' : 'opacity-30'
                  }`}
                  style={{ backgroundColor: isPastRealm ? colors.primary : '#4b5563' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Main Progress Bar */}
      <div className="relative">
        {/* Background */}
        <div className="h-6 bg-xianxia-darker rounded-full overflow-hidden border border-xianxia-accent/20">
          {/* Progress Fill */}
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden ${
              isNearBreakthrough ? 'animate-near-breakthrough' : ''
            } ${isAnimating ? 'animate-exp-gain' : ''}`}
            style={{
              width: `${progressPercent}%`,
              background: `linear-gradient(90deg, ${realmColors.primary}, ${realmColors.light})`,
            }}
          >
            {/* Shimmer effect */}
            <div
              className="absolute inset-0 animate-shimmer"
              style={{
                background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`,
                backgroundSize: '200% 100%',
              }}
            />
          </div>
        </div>

        {/* Exp Text Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white drop-shadow-lg">
            {requiredExp === Infinity ? (
              locale === 'vi' ? 'Cảnh giới tối đa' : 'Max Realm'
            ) : (
              `${displayExp.toLocaleString()} / ${requiredExp.toLocaleString()}`
            )}
          </span>
        </div>
      </div>

      {/* Stage Progress Indicators */}
      {realm !== 'PhàmNhân' && (
        <div className="flex justify-center gap-1">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((stage) => (
            <div
              key={stage}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                stage < realm_stage
                  ? ''
                  : stage === realm_stage
                    ? 'animate-meridian-pulse'
                    : 'opacity-30'
              }`}
              style={{
                backgroundColor: stage <= realm_stage ? realmColors.primary : '#4b5563',
                boxShadow: stage === realm_stage ? `0 0 5px ${realmColors.primary}` : 'none'
              }}
              title={`${locale === 'vi' ? 'Tầng' : 'Stage'} ${stage}`}
            />
          ))}
        </div>
      )}

      {/* Cultivation Speed Display */}
      <div className="flex justify-center items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">
            {locale === 'vi' ? 'Tốc độ tu luyện:' : 'Cultivation Speed:'}
          </span>
          <span
            className="font-bold text-lg"
            style={{ color: realmColors.light }}
          >
            x{totalCultivationSpeed.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Speed Breakdown (collapsible) */}
      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        <div className="p-2 bg-xianxia-darker rounded border border-xianxia-accent/10">
          <div className="text-gray-400 mb-1">
            {locale === 'vi' ? 'Linh Căn' : 'Spirit Root'}
          </div>
          <div className="font-bold text-green-400">
            x{spiritRootMultiplier.toFixed(2)}
          </div>
        </div>
        <div className="p-2 bg-xianxia-darker rounded border border-xianxia-accent/10">
          <div className="text-gray-400 mb-1">
            {locale === 'vi' ? 'Công Pháp' : 'Techniques'}
          </div>
          <div className="font-bold text-purple-400">
            x{techniqueMultiplier.toFixed(2)}
          </div>
        </div>
        <div className="p-2 bg-xianxia-darker rounded border border-xianxia-accent/10">
          <div className="text-gray-400 mb-1">
            {locale === 'vi' ? 'Trang Bị' : 'Equipment'}
          </div>
          <div className="font-bold text-blue-400">
            {equipmentBonus > 0 ? `+${equipmentBonus}%` : '-'}
          </div>
        </div>
      </div>

      {/* Breakthrough Ready Alert */}
      {isReadyForBreakthrough && (
        <div className="text-center p-3 bg-gradient-to-r from-xianxia-gold/20 via-yellow-500/30 to-xianxia-gold/20 rounded-lg border border-xianxia-gold animate-near-breakthrough">
          <span className="text-xianxia-gold font-bold">
            {locale === 'vi'
              ? 'Sẵn sàng đột phá cảnh giới!'
              : 'Ready for Breakthrough!'}
          </span>
        </div>
      )}
    </div>
  );
}
