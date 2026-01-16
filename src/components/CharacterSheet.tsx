'use client';

import { GameState } from '@/types/game';
import { t, Locale } from '@/lib/i18n/translations';

interface CharacterSheetProps {
  state: GameState;
  locale: Locale;
}

export default function CharacterSheet({ state, locale }: CharacterSheetProps) {
  return (
    <div className="space-y-6">
      {/* Location & Time */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">{t(locale, 'location')}</h2>
        <div className="space-y-2">
          <div>
            <span className="text-gray-400">{t(locale, 'location')}: </span>
            <span className="font-medium">{state.location.place}, {state.location.region}</span>
          </div>
          <div>
            <span className="text-gray-400">{locale === 'vi' ? 'Thời gian' : 'Time'}: </span>
            <span className="font-medium">
              {locale === 'vi' 
                ? `Năm ${state.time_year}, Tháng ${state.time_month}, Ngày ${state.time_day}`
                : `Year ${state.time_year}, Month ${state.time_month}, Day ${state.time_day}`
              }
            </span>
            <span className="text-gray-400 ml-4">{t(locale, state.time_segment)}</span>
          </div>
        </div>
      </div>

      {/* Cultivation Progress */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">{t(locale, 'cultivation')}</h2>
        <div className="space-y-3">
          <div>
            <span className="text-gray-400">Realm: </span>
            <span className="font-bold text-xianxia-accent text-lg">
              {t(locale, state.progress.realm)}
            </span>
          </div>
          <div>
            <span className="text-gray-400">{t(locale, 'stage')}: </span>
            <span className="font-medium">{state.progress.realm_stage}</span>
          </div>
          <div>
            <span className="text-gray-400">{t(locale, 'experience')}: </span>
            <span className="font-medium">{state.progress.cultivation_exp}</span>
          </div>
        </div>
      </div>

      {/* Spirit Root */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">{t(locale, 'spiritRoot')}</h2>
        <div className="space-y-3">
          <div>
            <span className="text-gray-400">{t(locale, 'elements')}: </span>
            <span className="font-medium text-xianxia-accent">
              {state.spirit_root.elements.map((e) => t(locale, e)).join(' + ')}
            </span>
          </div>
          <div>
            <span className="text-gray-400">{t(locale, 'grade')}: </span>
            <span className="font-bold text-xianxia-gold">
              {t(locale, state.spirit_root.grade)}
            </span>
          </div>
        </div>
      </div>

      {/* Sect */}
      {state.sect && (
        <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">
            {locale === 'vi' ? 'Môn Phái' : 'Sect'}
          </h2>
          <div className="text-center">
            <span className="text-xl font-bold text-xianxia-accent">
              {locale === 'vi' ? state.sect : state.sect_en}
            </span>
          </div>
        </div>
      )}

      {/* Cultivation Techniques */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">
          {locale === 'vi' ? 'Công Pháp' : 'Cultivation Techniques'}
        </h2>
        {(!state.techniques || state.techniques.length === 0) ? (
          <div className="text-center text-gray-400 py-4">
            {locale === 'vi' ? 'Chưa có công pháp' : 'No techniques learned'}
          </div>
        ) : (
          <div className="space-y-3">
            {state.techniques.map((tech) => (
              <div key={tech.id} className="p-3 bg-xianxia-darker rounded border border-xianxia-accent/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-xianxia-accent">
                    {locale === 'vi' ? tech.name : tech.name_en}
                  </span>
                  <span className="text-xs px-2 py-1 bg-xianxia-gold/20 text-xianxia-gold rounded">
                    {tech.grade}
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  {locale === 'vi' ? tech.description : tech.description_en}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skills */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">
          {locale === 'vi' ? 'Kĩ Năng' : 'Skills'}
        </h2>
        {(!state.skills || state.skills.length === 0) ? (
          <div className="text-center text-gray-400 py-4">
            {locale === 'vi' ? 'Chưa có kĩ năng' : 'No skills learned'}
          </div>
        ) : (
          <div className="space-y-3">
            {state.skills.map((skill) => (
              <div key={skill.id} className="p-3 bg-xianxia-darker rounded border border-xianxia-accent/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-xianxia-accent">
                    {locale === 'vi' ? skill.name : skill.name_en}
                  </span>
                  <span className="text-sm text-gray-400">
                    Lv {skill.level}/{skill.max_level}
                  </span>
                </div>
                <div className="text-sm text-gray-400 mb-2">
                  {locale === 'vi' ? skill.description : skill.description_en}
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-xianxia-accent h-2 rounded-full transition-all"
                    style={{ width: `${(skill.level / skill.max_level) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">{t(locale, 'stats')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">HP:</span>
              <span className="font-medium text-red-400">
                {state.stats.hp} / {state.stats.hp_max}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all"
                style={{ width: `${(state.stats.hp / state.stats.hp_max) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">{t(locale, 'qi')}:</span>
              <span className="font-medium text-blue-400">
                {state.stats.qi} / {state.stats.qi_max}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${(state.stats.qi / state.stats.qi_max) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">{t(locale, 'stamina')}:</span>
              <span className="font-medium text-green-400">
                {state.stats.stamina} / {state.stats.stamina_max}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${(state.stats.stamina / state.stats.stamina_max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Attributes */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">{t(locale, 'attributes')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-xianxia-darker rounded">
            <div className="text-sm text-gray-400">{t(locale, 'strength')}</div>
            <div className="text-2xl font-bold text-red-400">{state.attrs.str}</div>
          </div>
          <div className="text-center p-3 bg-xianxia-darker rounded">
            <div className="text-sm text-gray-400">{t(locale, 'agility')}</div>
            <div className="text-2xl font-bold text-green-400">{state.attrs.agi}</div>
          </div>
          <div className="text-center p-3 bg-xianxia-darker rounded">
            <div className="text-sm text-gray-400">{t(locale, 'intelligence')}</div>
            <div className="text-2xl font-bold text-blue-400">{state.attrs.int}</div>
          </div>
          <div className="text-center p-3 bg-xianxia-darker rounded">
            <div className="text-sm text-gray-400">{t(locale, 'perception')}</div>
            <div className="text-2xl font-bold text-purple-400">{state.attrs.perception}</div>
          </div>
          <div className="text-center p-3 bg-xianxia-darker rounded">
            <div className="text-sm text-gray-400">{t(locale, 'luck')}</div>
            <div className="text-2xl font-bold text-xianxia-gold">{state.attrs.luck}</div>
          </div>
        </div>
      </div>

      {/* Other Stats */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-sm text-gray-400">{t(locale, 'karma')}</div>
            <div className="text-xl font-bold text-xianxia-accent">{state.karma}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Age</div>
            <div className="text-xl font-bold">{state.age}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
