'use client';

import { GameState } from '@/types/game';
import { t, Locale } from '@/lib/i18n/translations';

interface InventoryViewProps {
  state: GameState;
  locale: Locale;
}

export default function InventoryView({ state, locale }: InventoryViewProps) {
  return (
    <div className="space-y-6">
      {/* Currency */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">
          {locale === 'vi' ? 'Tài Sản' : 'Resources'}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-xianxia-darker rounded-lg">
            <div className="text-sm text-gray-400">{t(locale, 'silver')}</div>
            <div className="text-3xl font-bold text-xianxia-silver">
              {state.inventory.silver}
            </div>
          </div>
          <div className="text-center p-4 bg-xianxia-darker rounded-lg">
            <div className="text-sm text-gray-400">{t(locale, 'spiritStones')}</div>
            <div className="text-3xl font-bold text-xianxia-accent">
              {state.inventory.spirit_stones}
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">{t(locale, 'items')}</h2>

        {state.inventory.items.length === 0 ? (
          <p className="text-center text-gray-400 py-8">{t(locale, 'noItems')}</p>
        ) : (
          <div className="space-y-3">
            {state.inventory.items.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="p-4 bg-xianxia-darker rounded-lg border border-xianxia-accent/20"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-bold text-lg">
                      {locale === 'vi' ? item.name : item.name_en}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {locale === 'vi' ? item.description : item.description_en}
                    </div>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="px-2 py-1 bg-xianxia-accent/20 rounded">
                        {item.type}
                      </span>
                      <span
                        className={`px-2 py-1 rounded ${
                          item.rarity === 'Legendary'
                            ? 'bg-orange-500/20 text-orange-300'
                            : item.rarity === 'Epic'
                            ? 'bg-purple-500/20 text-purple-300'
                            : item.rarity === 'Rare'
                            ? 'bg-blue-500/20 text-blue-300'
                            : item.rarity === 'Uncommon'
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-gray-500/20 text-gray-300'
                        }`}
                      >
                        {item.rarity}
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm text-gray-400">
                      {locale === 'vi' ? 'Số lượng' : 'Quantity'}
                    </div>
                    <div className="text-2xl font-bold">{item.quantity}</div>
                  </div>
                </div>

                {item.effects && Object.keys(item.effects).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-xianxia-accent/20">
                    <div className="text-sm text-xianxia-accent">
                      {locale === 'vi' ? 'Hiệu quả:' : 'Effects:'}
                    </div>
                    <div className="text-sm text-gray-300 mt-1">
                      {Object.entries(item.effects).map(([key, value]) => (
                        <div key={key}>
                          {key}: {String(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
