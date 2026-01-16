'use client';

import { GameState } from '@/types/game';
import { t, Locale } from '@/lib/i18n/translations';
import { useState } from 'react';

interface InventoryViewProps {
  state: GameState;
  locale: Locale;
  onEquipItem?: (itemId: string, action: 'equip' | 'unequip') => Promise<void>;
  onDiscardItem?: (itemId: string, quantity: number) => Promise<void>;
}

export default function InventoryView({ state, locale, onEquipItem, onDiscardItem }: InventoryViewProps) {
  const [activeTab, setActiveTab] = useState<'consumable' | 'equipment'>('consumable');
  const [discardConfirm, setDiscardConfirm] = useState<{itemId: string, name: string, quantity: number} | null>(null);
  
  const consumableItems = state.inventory.items.filter(
    item => item.type === 'Medicine' || item.type === 'Material' || item.type === 'Manual' || item.type === 'Misc'
  );
  
  const equipmentItems = state.inventory.items.filter(
    item => item.type === 'Equipment'
  );

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

      {/* Equipped Items */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">
          {locale === 'vi' ? 'Đang Trang Bị' : 'Currently Equipped'}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['Weapon', 'Head', 'Chest', 'Legs', 'Feet', 'Hands', 'Accessory', 'Artifact'] as const).map((slot) => {
            const equipped = state.equipped_items[slot];
            return (
              <div key={slot} className="p-3 bg-xianxia-darker rounded-lg border border-xianxia-accent/20">
                <div className="text-xs text-gray-400 mb-1">{slot}</div>
                {equipped ? (
                  <>
                    <div className="text-sm font-semibold text-xianxia-accent truncate mb-2">
                      {locale === 'vi' ? equipped.name : equipped.name_en}
                    </div>
                    {onEquipItem && (
                      <button
                        onClick={() => onEquipItem(equipped.id, 'unequip')}
                        className="w-full px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded text-xs transition-colors"
                      >
                        {locale === 'vi' ? 'Gỡ' : 'Unequip'}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-gray-600 italic">{locale === 'vi' ? 'Trống' : 'Empty'}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Items with Tabs */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        {/* Tab Headers */}
        <div className="flex gap-2 mb-4 border-b border-xianxia-accent/30">
          <button
            onClick={() => setActiveTab('consumable')}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === 'consumable'
                ? 'text-xianxia-gold border-b-2 border-xianxia-gold'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {locale === 'vi' ? 'Tiêu Hao' : 'Consumables'} ({consumableItems.length})
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === 'equipment'
                ? 'text-xianxia-gold border-b-2 border-xianxia-gold'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {locale === 'vi' ? 'Trang Bị' : 'Equipment'} ({equipmentItems.length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'consumable' ? (
          consumableItems.length === 0 ? (
            <p className="text-center text-gray-400 py-8">{t(locale, 'noItems')}</p>
          ) : (
            <div className="space-y-3">{renderItems(consumableItems, locale, onEquipItem, setDiscardConfirm)}</div>
          )
        ) : (
          equipmentItems.length === 0 ? (
            <p className="text-center text-gray-400 py-8">{locale === 'vi' ? 'Không có trang bị' : 'No equipment'}</p>
          ) : (
            <div className="space-y-3">{renderItems(equipmentItems, locale, onEquipItem, setDiscardConfirm)}</div>
          )
        )}
      </div>

      {/* Discard Confirmation Dialog */}
      {discardConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-xianxia-dark border border-xianxia-accent rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold text-xianxia-gold mb-4">
              {locale === 'vi' ? 'Xác Nhận Vứt' : 'Confirm Discard'}
            </h3>
            <p className="text-gray-300 mb-6">
              {locale === 'vi'
                ? `Bạn có chắc muốn vứt ${discardConfirm.quantity}x ${discardConfirm.name}?`
                : `Are you sure you want to discard ${discardConfirm.quantity}x ${discardConfirm.name}?`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (onDiscardItem) {
                    onDiscardItem(discardConfirm.itemId, discardConfirm.quantity);
                  }
                  setDiscardConfirm(null);
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                {locale === 'vi' ? 'Vứt' : 'Discard'}
              </button>
              <button
                onClick={() => setDiscardConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                {locale === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderItems(
  items: any[], 
  locale: Locale, 
  onEquipItem?: (itemId: string, action: 'equip' | 'unequip') => Promise<void>,
  setDiscardConfirm?: (confirm: {itemId: string, name: string, quantity: number} | null) => void
) {
  return items.map((item, index) => (
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
          
          <div className="flex flex-col gap-2 mt-2">
            {/* Equip button for equipment */}
            {item.type === 'Equipment' && onEquipItem && (
              <button
                onClick={() => onEquipItem(item.id, 'equip')}
                className="px-3 py-1 bg-xianxia-accent hover:bg-xianxia-accent/80 text-white rounded text-sm transition-colors"
              >
                {locale === 'vi' ? 'Trang bị' : 'Equip'}
              </button>
            )}
            
            {/* Discard button */}
            {setDiscardConfirm && (
              <button
                onClick={() => setDiscardConfirm({
                  itemId: item.id,
                  name: locale === 'vi' ? item.name : item.name_en,
                  quantity: item.quantity
                })}
                className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded text-sm transition-colors"
              >
                {locale === 'vi' ? 'Vứt' : 'Discard'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Show bonus stats for equipment */}
      {item.bonus_stats && Object.keys(item.bonus_stats).length > 0 && (
        <div className="mt-3 pt-3 border-t border-xianxia-accent/20">
          <div className="text-sm text-green-400 font-semibold">
            {locale === 'vi' ? 'Chỉ số:' : 'Stats:'}
          </div>
          <div className="text-sm text-gray-300 mt-1 grid grid-cols-2 gap-1">
            {item.bonus_stats.hp && (
              <div>HP: +{item.bonus_stats.hp}</div>
            )}
            {item.bonus_stats.qi && (
              <div>Qi: +{item.bonus_stats.qi}</div>
            )}
            {item.bonus_stats.stamina && (
              <div>Stamina: +{item.bonus_stats.stamina}</div>
            )}
            {item.bonus_stats.str && (
              <div>STR: +{item.bonus_stats.str}</div>
            )}
            {item.bonus_stats.agi && (
              <div>AGI: +{item.bonus_stats.agi}</div>
            )}
            {item.bonus_stats.int && (
              <div>INT: +{item.bonus_stats.int}</div>
            )}
            {item.bonus_stats.perception && (
              <div>PER: +{item.bonus_stats.perception}</div>
            )}
            {item.bonus_stats.luck && (
              <div>LUCK: +{item.bonus_stats.luck}</div>
            )}
            {item.bonus_stats.cultivation_speed && (
              <div>{locale === 'vi' ? 'Tốc độ tu luyện' : 'Cultivation Speed'}: +{item.bonus_stats.cultivation_speed}%</div>
            )}
          </div>
        </div>
      )}

      {/* Show effects for consumables */}
      {item.effects && Object.keys(item.effects).length > 0 && (
        <div className="mt-3 pt-3 border-t border-xianxia-accent/20">
          <div className="text-sm text-xianxia-accent">
            {locale === 'vi' ? 'Hiệu quả:' : 'Effects:'}
          </div>
          <div className="text-sm text-gray-300 mt-1">
            {Object.entries(item.effects).map(([key, value]) => (
              <div key={key}>
                {key.replace(/_/g, ' ')}: {String(value)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show equipment slot */}
      {item.equipment_slot && (
        <div className="mt-2 text-xs text-blue-400">
          {locale === 'vi' ? 'Trang bị:' : 'Slot:'} {item.equipment_slot}
        </div>
      )}
    </div>
  ));
}
