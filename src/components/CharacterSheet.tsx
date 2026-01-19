'use client';

import { GameState } from '@/types/game';
import { t, Locale } from '@/lib/i18n/translations';
import { calculateTotalAttributes, getEquipmentBonus } from '@/lib/game/equipment';
import { getElementCompatibility, getRequiredExp, getSpiritRootBonus, getTechniqueBonus } from '@/lib/game/mechanics';

interface CharacterSheetProps {
  state: GameState;
  locale: Locale;
}

export default function CharacterSheet({ state, locale }: CharacterSheetProps) {
  const totalAttrs = calculateTotalAttributes(state);
  const hpBonus = getEquipmentBonus(state, 'hp');
  const qiBonus = getEquipmentBonus(state, 'qi');
  const staminaBonus = getEquipmentBonus(state, 'stamina');
  const requiredExp = getRequiredExp(state.progress.realm, state.progress.realm_stage);
  const expDisplay = requiredExp === Infinity 
    ? (locale === 'vi' ? 'Đột phá cảnh giới' : 'Realm Breakthrough') 
    : `${state.progress.cultivation_exp}/${requiredExp}`;
  
  // Calculate total cultivation speed multiplier
  const spiritRootMultiplier = getSpiritRootBonus(state.spirit_root.grade);
  const techniqueMultiplier = getTechniqueBonus(state);
  const totalCultivationSpeed = spiritRootMultiplier * techniqueMultiplier;

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
            <span className="font-medium">{expDisplay}</span>
          </div>
          <div>
            <span className="text-gray-400">
              {locale === 'vi' ? 'Tốc độ tu luyện:' : 'Cultivation Speed:'}
            </span>
            <span className="font-bold text-green-400 text-lg ml-2">
              ×{totalCultivationSpeed.toFixed(2)}
            </span>
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
          <div className="mt-3 p-3 bg-xianxia-darker rounded border border-xianxia-accent/20">
            <div className="text-sm text-gray-400 mb-1">
              {locale === 'vi' ? 'Chi tiết tốc độ:' : 'Speed Breakdown:'}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-green-400">
                  ×{spiritRootMultiplier.toFixed(2)}
                </span>
                <span className="text-xs text-gray-400">
                  {locale === 'vi' ? '(từ linh căn)' : '(from spirit root)'}
                </span>
              </div>
              {techniqueMultiplier > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-purple-400">
                    ×{techniqueMultiplier.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {locale === 'vi' ? '(từ công pháp)' : '(from techniques)'}
                  </span>
                </div>
              )}
              {(() => {
                const equipBonus = getEquipmentBonus(state, 'cultivation_speed');
                if (equipBonus > 0) {
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-blue-400">
                        +{equipBonus}%
                      </span>
                      <span className="text-xs text-gray-400">
                        {locale === 'vi' ? '(từ trang bị)' : '(from equipment)'}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
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
            {state.techniques.map((tech) => {
              // Calculate element compatibility
              const compatibility = tech.elements && tech.elements.length > 0
                ? getElementCompatibility(state.spirit_root.elements, tech.elements)
                : 0;
              
              const compatibilityColor = 
                compatibility >= 0.25 ? 'text-green-400' :
                compatibility >= 0.1 ? 'text-blue-400' :
                compatibility >= 0 ? 'text-gray-400' :
                compatibility >= -0.15 ? 'text-orange-400' :
                'text-red-400';
              
              const compatibilityText = 
                compatibility >= 0.25 ? (locale === 'vi' ? 'Tuyệt vời' : 'Perfect') :
                compatibility >= 0.1 ? (locale === 'vi' ? 'Tốt' : 'Good') :
                compatibility >= 0 ? (locale === 'vi' ? 'Trung bình' : 'Neutral') :
                compatibility >= -0.15 ? (locale === 'vi' ? 'Yếu' : 'Weak') :
                (locale === 'vi' ? 'Xung khắc' : 'Conflict');

              return (
                <div key={tech.id} className="p-3 bg-xianxia-darker rounded border border-xianxia-accent/20">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <span className="font-bold text-xianxia-accent">
                        {locale === 'vi' ? tech.name : tech.name_en}
                      </span>
                      {tech.elements && tech.elements.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {tech.elements.map((el, idx) => (
                            <span key={idx} className="text-xs px-2 py-0.5 bg-xianxia-accent/20 text-xianxia-accent rounded">
                              {t(locale, el)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs px-2 py-1 bg-xianxia-gold/20 text-xianxia-gold rounded">
                        {tech.grade}
                      </span>
                      {tech.elements && tech.elements.length > 0 && (
                        <span className={`text-xs px-2 py-1 rounded ${compatibilityColor} bg-opacity-20`}>
                          {compatibilityText} {compatibility > 0 ? `+${Math.round(compatibility * 100)}%` : compatibility < 0 ? `${Math.round(compatibility * 100)}%` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {locale === 'vi' ? tech.description : tech.description_en}
                  </div>
                </div>
              );
            })}
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
            <div className="text-2xl font-bold text-red-400">
              {totalAttrs.str}
              {totalAttrs.str !== state.attrs.str && (
                <span className="text-sm text-green-400 ml-1">+{totalAttrs.str - state.attrs.str}</span>
              )}
            </div>
          </div>
          <div className="text-center p-3 bg-xianxia-darker rounded">
            <div className="text-sm text-gray-400">{t(locale, 'agility')}</div>
            <div className="text-2xl font-bold text-green-400">
              {totalAttrs.agi}
              {totalAttrs.agi !== state.attrs.agi && (
                <span className="text-sm text-green-400 ml-1">+{totalAttrs.agi - state.attrs.agi}</span>
              )}
            </div>
          </div>
          <div className="text-center p-3 bg-xianxia-darker rounded">
            <div className="text-sm text-gray-400">{t(locale, 'intelligence')}</div>
            <div className="text-2xl font-bold text-blue-400">
              {totalAttrs.int}
              {totalAttrs.int !== state.attrs.int && (
                <span className="text-sm text-green-400 ml-1">+{totalAttrs.int - state.attrs.int}</span>
              )}
            </div>
          </div>
          <div className="text-center p-3 bg-xianxia-darker rounded">
            <div className="text-sm text-gray-400">{t(locale, 'perception')}</div>
            <div className="text-2xl font-bold text-purple-400">
              {totalAttrs.perception}
              {totalAttrs.perception !== state.attrs.perception && (
                <span className="text-sm text-green-400 ml-1">+{totalAttrs.perception - state.attrs.perception}</span>
              )}
            </div>
          </div>
          <div className="text-center p-3 bg-xianxia-darker rounded">
            <div className="text-sm text-gray-400">{t(locale, 'luck')}</div>
            <div className="text-2xl font-bold text-xianxia-gold">
              {totalAttrs.luck}
              {totalAttrs.luck !== state.attrs.luck && (
                <span className="text-sm text-green-400 ml-1">+{totalAttrs.luck - state.attrs.luck}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attribute Effects Guide */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">
          {locale === 'vi' ? 'Hướng Dẫn Thuộc Tính' : 'Attribute Effects'}
        </h2>
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-xianxia-darker rounded border border-red-400/20">
            <div className="flex items-start gap-3">
              <div className="text-2xl font-bold text-red-400 min-w-[120px]">
                {t(locale, 'strength')}
              </div>
              <div className="text-gray-300 flex-1">
                <div className="font-medium text-red-300 mb-1">
                  {locale === 'vi' ? 'Ảnh Hưởng:' : 'Affects:'}
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>{locale === 'vi' ? 'Sát thương vật lý (+50% STR)' : 'Physical damage (+50% STR)'}</li>
                  <li>{locale === 'vi' ? 'Sát thương khí công (+50% STR)' : 'Qi attack damage (+50% STR)'}</li>
                  <li>{locale === 'vi' ? 'Tỷ lệ chí mạng (+0.2% mỗi điểm)' : 'Critical hit chance (+0.2% per point)'}</li>
                  <li>{locale === 'vi' ? 'HP tối đa (gián tiếp)' : 'Max HP (indirect)'}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-3 bg-xianxia-darker rounded border border-green-400/20">
            <div className="flex items-start gap-3">
              <div className="text-2xl font-bold text-green-400 min-w-[120px]">
                {t(locale, 'agility')}
              </div>
              <div className="text-gray-300 flex-1">
                <div className="font-medium text-green-300 mb-1">
                  {locale === 'vi' ? 'Ảnh Hưởng:' : 'Affects:'}
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>{locale === 'vi' ? 'Tốc độ tấn công' : 'Attack speed'}</li>
                  <li>{locale === 'vi' ? 'Tỷ lệ né tránh' : 'Evasion rate'}</li>
                  <li>{locale === 'vi' ? 'Tốc độ di chuyển' : 'Movement speed'}</li>
                  <li>{locale === 'vi' ? 'Thứ tự hành động trong chiến đấu' : 'Combat turn order'}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-3 bg-xianxia-darker rounded border border-blue-400/20">
            <div className="flex items-start gap-3">
              <div className="text-2xl font-bold text-blue-400 min-w-[120px]">
                {t(locale, 'intelligence')}
              </div>
              <div className="text-gray-300 flex-1">
                <div className="font-medium text-blue-300 mb-1">
                  {locale === 'vi' ? 'Ảnh Hưởng:' : 'Affects:'}
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>{locale === 'vi' ? 'Sát thương khí công (×2 INT)' : 'Qi attack damage (×2 INT)'}</li>
                  <li>{locale === 'vi' ? 'Khí tối đa' : 'Max Qi'}</li>
                  <li>{locale === 'vi' ? 'Tỷ lệ chí mạng khí công (+0.3%)' : 'Qi critical chance (+0.3%)'}</li>
                  <li>{locale === 'vi' ? 'Hiệu quả hồi khí' : 'Qi regeneration'}</li>
                  <li>{locale === 'vi' ? 'Hiểu biết công pháp' : 'Technique comprehension'}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-3 bg-xianxia-darker rounded border border-purple-400/20">
            <div className="flex items-start gap-3">
              <div className="text-2xl font-bold text-purple-400 min-w-[120px]">
                {t(locale, 'perception')}
              </div>
              <div className="text-gray-300 flex-1">
                <div className="font-medium text-purple-300 mb-1">
                  {locale === 'vi' ? 'Ảnh Hưởng:' : 'Affects:'}
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>{locale === 'vi' ? 'Phát hiện cơ hội ẩn' : 'Hidden opportunity detection'}</li>
                  <li>{locale === 'vi' ? 'Chất lượng vật phẩm rơi' : 'Loot quality'}</li>
                  <li>{locale === 'vi' ? 'Tỷ lệ gặp sự kiện quý hiếm' : 'Rare event chance'}</li>
                  <li>{locale === 'vi' ? 'Nhận biết nguy hiểm' : 'Danger awareness'}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-3 bg-xianxia-darker rounded border border-xianxia-gold/20">
            <div className="flex items-start gap-3">
              <div className="text-2xl font-bold text-xianxia-gold min-w-[120px]">
                {t(locale, 'luck')}
              </div>
              <div className="text-gray-300 flex-1">
                <div className="font-medium text-xianxia-gold mb-1">
                  {locale === 'vi' ? 'Ảnh Hưởng:' : 'Affects:'}
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>{locale === 'vi' ? 'Tỷ lệ rơi vật phẩm quý' : 'Rare item drop rate'}</li>
                  <li>{locale === 'vi' ? 'Cơ duyên và gặp gỡ' : 'Fortuitous encounters'}</li>
                  <li>{locale === 'vi' ? 'Kết quả sự kiện ngẫu nhiên' : 'Random event outcomes'}</li>
                  <li>{locale === 'vi' ? 'Thành công đột phá cảnh giới' : 'Breakthrough success rate'}</li>
                </ul>
              </div>
            </div>
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
