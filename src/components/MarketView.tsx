'use client';

import { GameState, MarketItem } from '@/types/game';
import { Locale } from '@/lib/i18n/translations';
import { useState } from 'react';

interface MarketViewProps {
  state: GameState;
  locale: Locale;
  onBuyItem?: (itemId: string) => Promise<void>;
  onSellItem?: (itemId: string) => Promise<void>;
}

export default function MarketView({ state, locale, onBuyItem, onSellItem }: MarketViewProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');

  // Initialize market if not exists
  if (!state.market) {
    return (
      <div className="p-8 text-center text-gray-400">
        {locale === 'vi' ? 'Chợ chưa mở...' : 'Market not available...'}
      </div>
    );
  }

  const sellableItems = state.inventory.items.filter(
    item => item.type !== 'Misc' && !item.is_equipped
  );

  return (
    <div className="space-y-6">
      {/* Market Info */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-2 text-xianxia-gold">
          {locale === 'vi' ? 'Chợ Linh Vật' : 'Spirit Market'}
        </h2>
        <p className="text-sm text-gray-400">
          {locale === 'vi' 
            ? `Chợ sẽ làm mới vào tháng ${state.market.next_regeneration.month} năm ${state.market.next_regeneration.year}`
            : `Market refreshes at month ${state.market.next_regeneration.month}, year ${state.market.next_regeneration.year}`
          }
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <div className="flex gap-2 mb-4 border-b border-xianxia-accent/30">
          <button
            onClick={() => setActiveTab('buy')}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === 'buy'
                ? 'text-xianxia-gold border-b-2 border-xianxia-gold'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {locale === 'vi' ? 'Mua' : 'Buy'} ({state.market.items.length})
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === 'sell'
                ? 'text-xianxia-gold border-b-2 border-xianxia-gold'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {locale === 'vi' ? 'Bán' : 'Sell'} ({sellableItems.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'buy' ? (
          <div className="space-y-3">
            {state.market.items.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                {locale === 'vi' ? 'Không có hàng' : 'No items available'}
              </p>
            ) : (
              state.market.items.map((item, index) => renderMarketItem(item, index, locale, 'buy', state, onBuyItem))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sellableItems.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                {locale === 'vi' ? 'Không có gì để bán' : 'Nothing to sell'}
              </p>
            ) : (
              sellableItems.map((item, index) => renderMarketItem(item, index, locale, 'sell', state, undefined, onSellItem))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function renderMarketItem(
  item: MarketItem,
  index: number,
  locale: Locale,
  mode: 'buy' | 'sell',
  state: GameState,
  onBuyItem?: (itemId: string) => Promise<void>,
  onSellItem?: (itemId: string) => Promise<void>
) {
  const canAfford = mode === 'buy' 
    ? (item.price_silver ? state.inventory.silver >= item.price_silver : true) &&
      (item.price_spirit_stones ? state.inventory.spirit_stones >= item.price_spirit_stones : true)
    : true;

  return (
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

          {/* Price */}
          <div className="mt-3 flex gap-4 text-sm">
            {item.price_silver && item.price_silver > 0 && (
              <div className="text-xianxia-silver">
                💰 {item.price_silver} {locale === 'vi' ? 'bạc' : 'silver'}
              </div>
            )}
            {item.price_spirit_stones && item.price_spirit_stones > 0 && (
              <div className="text-xianxia-accent">
                💎 {item.price_spirit_stones} {locale === 'vi' ? 'linh thạch' : 'spirit stones'}
              </div>
            )}
          </div>
        </div>

        <div className="ml-4">
          {mode === 'buy' && onBuyItem && (
            <button
              onClick={() => onBuyItem(item.id)}
              disabled={!canAfford}
              className={`px-4 py-2 rounded transition-colors ${
                canAfford
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {locale === 'vi' ? 'Mua' : 'Buy'}
            </button>
          )}
          {mode === 'sell' && onSellItem && (
            <button
              onClick={() => onSellItem(item.id)}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
            >
              {locale === 'vi' ? 'Bán' : 'Sell'}
            </button>
          )}
        </div>
      </div>

      {/* Show bonus stats for equipment */}
      {item.bonus_stats && Object.keys(item.bonus_stats).length > 0 && (
        <div className="mt-3 pt-3 border-t border-xianxia-accent/20">
          <div className="text-sm text-green-400 font-semibold">
            {locale === 'vi' ? 'Chỉ số:' : 'Stats:'}
          </div>
          <div className="text-sm text-gray-300 mt-1 grid grid-cols-2 gap-1">
            {Object.entries(item.bonus_stats).map(([key, value]) => (
              value && <div key={key}>{key.toUpperCase()}: +{value}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
