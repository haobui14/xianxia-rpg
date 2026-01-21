'use client';

import { useState } from 'react';
import { GameState } from '@/types/game';
import { Locale } from '@/lib/i18n/translations';
import {
  BODY_REALM_NAMES,
  CULTIVATION_PATH_NAMES,
  getBodyCultivationProgress,
  getBodyExpToNext,
} from '@/lib/game/dual-cultivation';

interface DualCultivationViewProps {
  state: GameState;
  locale: Locale;
  onToggleDualCultivation?: () => Promise<void>;
  onSetExpSplit?: (split: number) => Promise<void>;
}

export default function DualCultivationView({
  state,
  locale,
  onToggleDualCultivation,
  onSetExpSplit,
}: DualCultivationViewProps) {
  const [tempSplit, setTempSplit] = useState(state.progress.exp_split ?? 100);
  const [isAdjusting, setIsAdjusting] = useState(false);

  const isDualMode = state.progress.cultivation_path === 'dual';
  const bodyRealm = state.progress.body_realm || 'PhàmThể';
  const bodyStage = state.progress.body_stage || 0;
  const bodyExp = state.progress.body_exp || 0;
  const bodyProgress = getBodyCultivationProgress(state.progress);
  const bodyExpNeeded = getBodyExpToNext(state.progress);
  const expSplit = state.progress.exp_split ?? 100;

  const handleSplitChange = (value: number) => {
    setTempSplit(value);
  };

  const handleApplySplit = async () => {
    if (onSetExpSplit) {
      setIsAdjusting(true);
      await onSetExpSplit(tempSplit);
      setIsAdjusting(false);
    }
  };

  // Get realm colors
  const getBodyRealmColor = (realm: string): string => {
    switch (realm) {
      case 'PhàmThể': return 'text-gray-400';
      case 'LuyệnCốt': return 'text-yellow-600';
      case 'ĐồngCân': return 'text-orange-500';
      case 'KimCương': return 'text-cyan-400';
      case 'TháiCổ': return 'text-purple-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">
        {locale === 'vi' ? '🔄 Tu Luyện Song Đạo' : '🔄 Dual Cultivation'}
      </h2>

      {/* Dual Cultivation Toggle */}
      <div className="mb-6 p-4 bg-xianxia-darker rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-semibold">
              {locale === 'vi' ? 'Chế độ tu luyện' : 'Cultivation Mode'}
            </div>
            <div className="text-sm text-gray-400">
              {isDualMode
                ? (locale === 'vi'
                    ? 'Song tu cả khí và thể, kinh nghiệm được chia đôi'
                    : 'Cultivating both Qi and Body, experience is split')
                : (locale === 'vi'
                    ? 'Chỉ tu khí, tập trung vào linh lực'
                    : 'Qi only, focus on spiritual energy')}
            </div>
          </div>
          {onToggleDualCultivation && (
            <button
              onClick={onToggleDualCultivation}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isDualMode
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-500 text-white'
              }`}
            >
              {isDualMode
                ? (locale === 'vi' ? '✓ Song Tu' : '✓ Dual Mode')
                : (locale === 'vi' ? 'Bật Song Tu' : 'Enable Dual')}
            </button>
          )}
        </div>
      </div>

      {/* Body Cultivation Progress (only show in dual mode) */}
      {isDualMode && (
        <>
          {/* Body Realm Display */}
          <div className="mb-6 p-4 bg-xianxia-darker rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-gray-400">
                  {locale === 'vi' ? 'Cảnh giới thể chất' : 'Body Realm'}
                </div>
                <div className={`text-xl font-bold ${getBodyRealmColor(bodyRealm)}`}>
                  {BODY_REALM_NAMES[bodyRealm][locale === 'vi' ? 'vi' : 'en']} {bodyStage + 1}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">
                  {locale === 'vi' ? 'Kinh nghiệm thể chất' : 'Body Exp'}
                </div>
                <div className="text-lg font-semibold text-orange-400">
                  {bodyExp} / {bodyExpNeeded === Infinity ? '∞' : bodyExpNeeded}
                </div>
              </div>
            </div>

            {/* Body Progress Bar */}
            <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-600 to-red-500 transition-all duration-500"
                style={{ width: `${bodyProgress}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
                {bodyProgress}%
              </div>
            </div>

            {/* Body Bonuses Display */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="p-2 bg-red-900/30 rounded">
                <div className="text-red-400">HP</div>
                <div className="font-bold">
                  +{bodyStage * 5 + (bodyRealm === 'PhàmThể' ? 0 : 10)}
                </div>
              </div>
              <div className="p-2 bg-orange-900/30 rounded">
                <div className="text-orange-400">{locale === 'vi' ? 'Sức mạnh' : 'STR'}</div>
                <div className="font-bold">
                  +{Math.floor(bodyStage * 0.5 + (bodyRealm === 'PhàmThể' ? 0 : 1))}
                </div>
              </div>
              <div className="p-2 bg-green-900/30 rounded">
                <div className="text-green-400">{locale === 'vi' ? 'Thể lực' : 'Stamina'}</div>
                <div className="font-bold">
                  +{bodyStage * 2 + (bodyRealm === 'PhàmThể' ? 0 : 5)}
                </div>
              </div>
            </div>
          </div>

          {/* Exp Split Slider */}
          <div className="p-4 bg-xianxia-darker rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-400">
                {locale === 'vi' ? 'Phân chia kinh nghiệm' : 'Experience Split'}
              </div>
              <div className="text-sm">
                <span className="text-blue-400">{locale === 'vi' ? 'Khí' : 'Qi'}: {tempSplit}%</span>
                <span className="text-gray-500 mx-2">|</span>
                <span className="text-orange-400">{locale === 'vi' ? 'Thể' : 'Body'}: {100 - tempSplit}%</span>
              </div>
            </div>

            {/* Slider */}
            <div className="relative mb-4">
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={tempSplit}
                onChange={(e) => handleSplitChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-xianxia-accent"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{locale === 'vi' ? '100% Thể' : '100% Body'}</span>
                <span>50/50</span>
                <span>{locale === 'vi' ? '100% Khí' : '100% Qi'}</span>
              </div>
            </div>

            {/* Visual split bar */}
            <div className="h-3 rounded-full overflow-hidden flex mb-4">
              <div
                className="bg-gradient-to-r from-blue-600 to-blue-400 transition-all"
                style={{ width: `${tempSplit}%` }}
              />
              <div
                className="bg-gradient-to-r from-orange-400 to-orange-600 transition-all"
                style={{ width: `${100 - tempSplit}%` }}
              />
            </div>

            {/* Apply button */}
            {onSetExpSplit && tempSplit !== expSplit && (
              <button
                onClick={handleApplySplit}
                disabled={isAdjusting}
                className="w-full py-2 bg-xianxia-accent hover:bg-xianxia-accent/80 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                {isAdjusting
                  ? (locale === 'vi' ? 'Đang áp dụng...' : 'Applying...')
                  : (locale === 'vi' ? 'Áp dụng thay đổi' : 'Apply Changes')}
              </button>
            )}
          </div>

          {/* Info box */}
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-sm text-blue-200">
            <div className="font-semibold mb-1">
              {locale === 'vi' ? '💡 Lợi ích Song Tu:' : '💡 Dual Cultivation Benefits:'}
            </div>
            <ul className="list-disc list-inside text-xs space-y-1">
              <li>
                {locale === 'vi'
                  ? 'Tu thể tăng HP, Sức mạnh và Thể lực'
                  : 'Body cultivation increases HP, STR and Stamina'}
              </li>
              <li>
                {locale === 'vi'
                  ? 'Cân bằng giữa sức mạnh vật lý và linh lực'
                  : 'Balance between physical strength and spiritual power'}
              </li>
              <li>
                {locale === 'vi'
                  ? 'Điều chỉnh tỷ lệ theo chiến thuật của bạn'
                  : 'Adjust the ratio based on your strategy'}
              </li>
            </ul>
          </div>
        </>
      )}

      {/* Show prompt to enable dual cultivation */}
      {!isDualMode && (
        <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg text-center">
          <div className="text-lg mb-2">
            {locale === 'vi' ? '🏋️ Khai mở con đường Tu Thể?' : '🏋️ Unlock Body Cultivation Path?'}
          </div>
          <p className="text-sm text-gray-400 mb-4">
            {locale === 'vi'
              ? 'Tu luyện thể chất song song với tu khí để tăng HP, Sức mạnh và Thể lực.'
              : 'Cultivate your body alongside Qi to increase HP, Strength and Stamina.'}
          </p>
          {onToggleDualCultivation && (
            <button
              onClick={onToggleDualCultivation}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
            >
              {locale === 'vi' ? 'Bắt đầu Song Tu' : 'Start Dual Cultivation'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
