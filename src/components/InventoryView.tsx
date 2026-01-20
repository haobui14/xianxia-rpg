'use client';

import { GameState, InventoryItem } from '@/types/game';
import { t, Locale } from '@/lib/i18n/translations';
import { useState } from 'react';
import EnhancementView from './EnhancementView';
import { EnhancementResult, canEnhance, getEnhancedItemName, getEnhancementColor } from '@/lib/game/enhancement';

interface InventoryViewProps {
  state: GameState;
  locale: Locale;
  onEquipItem?: (itemId: string, action: 'equip' | 'unequip') => Promise<void>;
  onDiscardItem?: (itemId: string, quantity: number) => Promise<void>;
  onUseItem?: (itemId: string) => Promise<void>;
  onEnhanceItem?: (itemId: string) => Promise<EnhancementResult | null>;
  onStateUpdate?: (state: GameState) => void;
}

// Vietnamese translations for item types and rarities
const ITEM_TYPE_VI: Record<string, string> = {
  'Medicine': 'Đan Dược',
  'Material': 'Nguyên Liệu',
  'Equipment': 'Trang Bị',
  'Manual': 'Bí Kíp',
  'Misc': 'Khác',
};

const RARITY_VI: Record<string, string> = {
  'Common': 'Phàm Phẩm',
  'Uncommon': 'Hạ Phẩm',
  'Rare': 'Trung Phẩm',
  'Epic': 'Thượng Phẩm',
  'Legendary': 'Cực Phẩm',
};

const SLOT_VI: Record<string, string> = {
  'Weapon': 'Vũ Khí',
  'Head': 'Đầu',
  'Chest': 'Ngực',
  'Legs': 'Chân',
  'Feet': 'Giày',
  'Hands': 'Tay',
  'Accessory': 'Phụ Kiện',
  'Artifact': 'Bảo Vật',
};

const EFFECT_VI: Record<string, string> = {
  'hp_restore': 'Hồi HP',
  'qi_restore': 'Hồi Khí',
  'stamina_restore': 'Hồi Thể Lực',
  'cultivation_exp': 'Tu Vi',
  'permanent_hp': 'HP Vĩnh Viễn',
  'permanent_qi': 'Khí Vĩnh Viễn',
  'permanent_str': 'Sức Mạnh Vĩnh Viễn',
  'permanent_agi': 'Thân Pháp Vĩnh Viễn',
  'permanent_int': 'Trí Tuệ Vĩnh Viễn',
  'permanent_perception': 'Cảm Quan Vĩnh Viễn',
  'permanent_luck': 'May Mắn Vĩnh Viễn',
};

export default function InventoryView({ state, locale, onEquipItem, onDiscardItem, onUseItem, onEnhanceItem, onStateUpdate }: InventoryViewProps) {
  const [activeTab, setActiveTab] = useState<'consumable' | 'equipment'>('consumable');
  const [discardConfirm, setDiscardConfirm] = useState<{itemId: string, name: string, quantity: number} | null>(null);
  const [useMessage, setUseMessage] = useState<string | null>(null);
  const [selectedEnhanceItem, setSelectedEnhanceItem] = useState<InventoryItem | null>(null);

  // Filter out techniques/skills that shouldn't be in inventory
  const validInventoryItems = state.inventory.items.filter(
    item => !['Main', 'Support', 'Attack', 'Defense', 'Movement'].includes(item.type)
  );

  const consumableItems = validInventoryItems.filter(
    item => ['Medicine', 'Material', 'Manual', 'Misc', 'Book', 'Effect'].includes(item.type)
  );

  const equipmentItems = validInventoryItems.filter(
    item => ['Equipment', 'Accessory'].includes(item.type)
  );

  // Debug logging
  console.log('Inventory total items:', state.inventory.items.length);
  console.log('Valid inventory items:', validInventoryItems.length);
  console.log('Inventory consumable items:', consumableItems.length);
  console.log('Inventory equipment items:', equipmentItems.length);
  console.log('Items by type:', state.inventory.items.reduce((acc, i) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {} as Record<string, number>));

  const handleUseItem = async (itemId: string, itemName: string) => {
    if (onUseItem) {
      await onUseItem(itemId);
      setUseMessage(locale === 'vi' ? `Đã sử dụng ${itemName}` : `Used ${itemName}`);
      setTimeout(() => setUseMessage(null), 2000);
    }
  };

  const handleEnhance = async (itemId: string): Promise<EnhancementResult | null> => {
    if (!onEnhanceItem) return null;
    const result = await onEnhanceItem(itemId);
    return result;
  };

  return (
    <div className="space-y-6">
      {/* Use message toast */}
      {useMessage && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
          {useMessage}
        </div>
      )}

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
                <div className="text-xs text-gray-400 mb-1">
                  {locale === 'vi' ? SLOT_VI[slot] : slot}
                </div>
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
                        {locale === 'vi' ? 'Tháo' : 'Unequip'}
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
            {locale === 'vi' ? 'Vật Phẩm' : 'Consumables'} ({consumableItems.length})
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
            <p className="text-center text-gray-400 py-8">
              {locale === 'vi' ? 'Không có vật phẩm' : 'No items'}
            </p>
          ) : (
            <div className="space-y-3">
              {renderItems(consumableItems, locale, onEquipItem, setDiscardConfirm, handleUseItem, setSelectedEnhanceItem)}
            </div>
          )
        ) : (
          equipmentItems.length === 0 ? (
            <p className="text-center text-gray-400 py-8">
              {locale === 'vi' ? 'Không có trang bị' : 'No equipment'}
            </p>
          ) : (
            <div className="space-y-3">
              {renderItems(equipmentItems, locale, onEquipItem, setDiscardConfirm, handleUseItem, setSelectedEnhanceItem)}
            </div>
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
      
      {/* Enhancement Modal */}
      {selectedEnhanceItem && (
        <EnhancementView
          item={selectedEnhanceItem}
          state={state}
          locale={locale}
          onEnhance={handleEnhance}
          onClose={() => setSelectedEnhanceItem(null)}
        />
      )}
    </div>
  );
}

function renderItems(
  items: any[],
  locale: Locale,
  onEquipItem?: (itemId: string, action: 'equip' | 'unequip') => Promise<void>,
  setDiscardConfirm?: (confirm: {itemId: string, name: string, quantity: number} | null) => void,
  onUseItem?: (itemId: string, itemName: string) => void,
  setSelectedEnhanceItem?: (item: any) => void
) {
  return items.map((item, index) => {
    const isConsumable = item.type === 'Medicine' || item.type === 'Book' || item.effects;
    const itemName = locale === 'vi' ? item.name : item.name_en;

    return (
      <div
        key={`${item.id}-${index}`}
        className="p-4 bg-xianxia-darker rounded-lg border border-xianxia-accent/20"
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="font-bold text-lg">
              {itemName}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {locale === 'vi' ? item.description : item.description_en}
            </div>
            <div className="flex gap-3 mt-2 text-xs">
              <span className="px-2 py-1 bg-xianxia-accent/20 rounded">
                {locale === 'vi' ? ITEM_TYPE_VI[item.type] || item.type : item.type}
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
                {locale === 'vi' ? RARITY_VI[item.rarity] || item.rarity : item.rarity}
              </span>
            </div>
          </div>
          <div className="text-right ml-4">
            <div className="text-sm text-gray-400">
              {locale === 'vi' ? 'Số lượng' : 'Qty'}
            </div>
            <div className="text-2xl font-bold">{item.quantity}</div>

            <div className="flex flex-col gap-2 mt-2">
              {/* Use button for consumables */}
              {isConsumable && onUseItem && (
                <button
                  onClick={() => onUseItem(item.id, itemName)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                >
                  {locale === 'vi' ? 'Dùng' : 'Use'}
                </button>
              )}

              {/* Equip button for equipment and accessories */}
              {(item.type === 'Equipment' || item.type === 'Accessory') && onEquipItem && (
                <button
                  onClick={() => onEquipItem(item.id, 'equip')}
                  className="px-3 py-1 bg-xianxia-accent hover:bg-xianxia-accent/80 text-white rounded text-sm transition-colors"
                >
                  {locale === 'vi' ? 'Trang bị' : 'Equip'}
                </button>
              )}

              {/* Enhance button for equipment and accessories */}
              {(item.type === 'Equipment' || item.type === 'Accessory') && canEnhance(item) && setSelectedEnhanceItem && (
                <button
                  onClick={() => setSelectedEnhanceItem(item)}
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm transition-colors"
                >
                  {locale === 'vi' ? '✨ Cường Hóa' : '✨ Enhance'}
                </button>
              )}

              {/* Discard button */}
              {setDiscardConfirm && (
                <button
                  onClick={() => setDiscardConfirm({
                    itemId: item.id,
                    name: itemName,
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
              {locale === 'vi' ? 'Chỉ số bonus:' : 'Bonus Stats:'}
            </div>
            <div className="text-sm text-gray-300 mt-1 grid grid-cols-2 gap-1">
              {item.bonus_stats.hp && (
                <div>HP: +{item.bonus_stats.hp}</div>
              )}
              {item.bonus_stats.qi && (
                <div>{locale === 'vi' ? 'Khí' : 'Qi'}: +{item.bonus_stats.qi}</div>
              )}
              {item.bonus_stats.stamina && (
                <div>{locale === 'vi' ? 'Thể Lực' : 'Stamina'}: +{item.bonus_stats.stamina}</div>
              )}
              {item.bonus_stats.str && (
                <div>{locale === 'vi' ? 'Sức Mạnh' : 'STR'}: +{item.bonus_stats.str}</div>
              )}
              {item.bonus_stats.agi && (
                <div>{locale === 'vi' ? 'Thân Pháp' : 'AGI'}: +{item.bonus_stats.agi}</div>
              )}
              {item.bonus_stats.int && (
                <div>{locale === 'vi' ? 'Trí Tuệ' : 'INT'}: +{item.bonus_stats.int}</div>
              )}
              {item.bonus_stats.perception && (
                <div>{locale === 'vi' ? 'Cảm Quan' : 'PER'}: +{item.bonus_stats.perception}</div>
              )}
              {item.bonus_stats.luck && (
                <div>{locale === 'vi' ? 'May Mắn' : 'LUCK'}: +{item.bonus_stats.luck}</div>
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
            <div className="text-sm text-xianxia-accent font-semibold">
              {locale === 'vi' ? 'Hiệu quả:' : 'Effects:'}
            </div>
            <div className="text-sm text-gray-300 mt-1">
              {Object.entries(item.effects).map(([key, value]) => (
                <div key={key}>
                  {locale === 'vi' ? (EFFECT_VI[key] || key.replace(/_/g, ' ')) : key.replace(/_/g, ' ')}: +{String(value)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show teachings for books */}
        {item.type === 'Book' && (item.teaches_technique || item.teaches_skill) && (
          <div className="mt-3 pt-3 border-t border-xianxia-accent/20">
            <div className="text-sm text-yellow-400 font-semibold">
              {locale === 'vi' ? '📖 Dạy:' : '📖 Teaches:'}
            </div>
            {item.teaches_technique && (
              <div className="text-sm text-gray-300 mt-1">
                <div className="font-semibold text-purple-400">
                  {locale === 'vi' ? '🔮 Công Pháp: ' : '🔮 Technique: '}
                  {locale === 'vi' ? item.teaches_technique.name : item.teaches_technique.name_en}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {locale === 'vi' ? item.teaches_technique.description : item.teaches_technique.description_en}
                </div>
                <div className="text-xs text-green-400 mt-1">
                  {locale === 'vi' ? 'Tốc độ tu luyện:' : 'Cultivation Speed:'} +{item.teaches_technique.cultivation_speed_bonus}%
                </div>
              </div>
            )}
            {item.teaches_skill && (
              <div className="text-sm text-gray-300 mt-1">
                <div className="font-semibold text-orange-400">
                  {locale === 'vi' ? '⚔️ Kỹ Năng: ' : '⚔️ Skill: '}
                  {locale === 'vi' ? item.teaches_skill.name : item.teaches_skill.name_en}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {locale === 'vi' ? item.teaches_skill.description : item.teaches_skill.description_en}
                </div>
                <div className="text-xs text-red-400 mt-1">
                  {locale === 'vi' ? 'Sát thương:' : 'Damage:'} ×{item.teaches_skill.damage_multiplier} | 
                  {locale === 'vi' ? ' Tiêu Qi:' : ' Qi Cost:'} {item.teaches_skill.qi_cost}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Show equipment slot */}
        {item.equipment_slot && (
          <div className="mt-2 text-xs text-blue-400">
            {locale === 'vi' ? 'Vị trí:' : 'Slot:'} {locale === 'vi' ? SLOT_VI[item.equipment_slot] || item.equipment_slot : item.equipment_slot}
          </div>
        )}
      </div>
    );
  });
}
