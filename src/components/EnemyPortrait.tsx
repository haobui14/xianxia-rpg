'use client';

import { useState, useEffect } from 'react';
import { Enemy, CombatBehavior } from '@/types/game';
import { Locale } from '@/lib/i18n/translations';
import HealthBar from './HealthBar';

interface EnemyPortraitProps {
  enemy: Enemy;
  locale: Locale;
  isHit?: boolean; // Trigger hit animation
  isDead?: boolean;
}

const BEHAVIOR_COLORS: Record<CombatBehavior, string> = {
  'Aggressive': 'text-red-400 border-red-400/30 bg-red-400/10',
  'Defensive': 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  'Balanced': 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  'Flee': 'text-gray-400 border-gray-400/30 bg-gray-400/10',
};

const BEHAVIOR_LABELS: Record<CombatBehavior, { vi: string; en: string }> = {
  'Aggressive': { vi: 'Hung Hăng', en: 'Aggressive' },
  'Defensive': { vi: 'Phòng Thủ', en: 'Defensive' },
  'Balanced': { vi: 'Cân Bằng', en: 'Balanced' },
  'Flee': { vi: 'Chạy Trốn', en: 'Fleeing' },
};

// Enemy type icons (using emoji for now, could be replaced with SVG)
const ENEMY_ICONS: Record<string, string> = {
  'wild_wolf': '🐺',
  'demonic_tiger': '🐅',
  'evil_cultivator': '👤',
  'bandit': '🗡️',
  'default': '👹',
};

export default function EnemyPortrait({
  enemy,
  locale,
  isHit = false,
  isDead = false,
}: EnemyPortraitProps) {
  const [hitFlash, setHitFlash] = useState(false);
  const [deathAnimation, setDeathAnimation] = useState(false);

  // Handle hit animation
  useEffect(() => {
    if (isHit) {
      setHitFlash(true);
      const timer = setTimeout(() => setHitFlash(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isHit]);

  // Handle death animation
  useEffect(() => {
    if (isDead) {
      setDeathAnimation(true);
    }
  }, [isDead]);

  const behaviorColor = BEHAVIOR_COLORS[enemy.behavior];
  const behaviorLabel = BEHAVIOR_LABELS[enemy.behavior];
  const icon = ENEMY_ICONS[enemy.id] || ENEMY_ICONS['default'];

  return (
    <div
      className={`relative bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-4 transition-all duration-200 ${
        hitFlash ? 'bg-red-900/50 border-red-500' : ''
      } ${deathAnimation ? 'opacity-50 scale-95' : ''}`}
    >
      {/* Hit flash overlay */}
      {hitFlash && (
        <div className="absolute inset-0 bg-red-500/30 rounded-lg animate-pulse" />
      )}

      {/* Enemy icon/portrait */}
      <div className="flex items-center gap-4 mb-4">
        <div
          className={`w-16 h-16 rounded-full bg-xianxia-darker border-2 border-xianxia-accent/50 flex items-center justify-center text-3xl ${
            hitFlash ? 'animate-bounce' : ''
          } ${deathAnimation ? 'grayscale' : ''}`}
        >
          {icon}
        </div>

        <div className="flex-1">
          {/* Enemy name */}
          <h3 className={`text-lg font-bold text-xianxia-accent ${deathAnimation ? 'line-through' : ''}`}>
            {locale === 'vi' ? enemy.name : enemy.name_en}
          </h3>

          {/* Behavior indicator */}
          <span className={`text-xs px-2 py-1 rounded border ${behaviorColor}`}>
            {locale === 'vi' ? behaviorLabel.vi : behaviorLabel.en}
          </span>
        </div>
      </div>

      {/* Health bar */}
      <div className="space-y-2">
        <HealthBar
          current={enemy.hp}
          max={enemy.hp_max}
          type="enemy"
          size="medium"
          showNumbers={true}
          label="HP"
        />
      </div>

      {/* Stats display */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="flex justify-between p-2 bg-xianxia-darker rounded">
          <span className="text-gray-400">{locale === 'vi' ? 'Công' : 'ATK'}</span>
          <span className="text-red-400 font-bold">{enemy.atk}</span>
        </div>
        <div className="flex justify-between p-2 bg-xianxia-darker rounded">
          <span className="text-gray-400">{locale === 'vi' ? 'Thủ' : 'DEF'}</span>
          <span className="text-blue-400 font-bold">{enemy.def}</span>
        </div>
      </div>

      {/* Death overlay */}
      {deathAnimation && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <span className="text-2xl font-bold text-red-500 animate-pulse">
            {locale === 'vi' ? 'ĐÃ BỊ TIÊU DIỆT' : 'DEFEATED'}
          </span>
        </div>
      )}
    </div>
  );
}
