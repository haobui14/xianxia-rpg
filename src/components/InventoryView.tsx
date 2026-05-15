"use client";

import { GameState, InventoryItem } from "@/types/game";
import { t, Locale } from "@/lib/i18n/translations";
import { useState, useMemo } from "react";
import EnhancementView from "./EnhancementView";
import {
  EnhancementResult,
  canEnhance,
  getEnhancedItemName,
} from "@/lib/game/enhancement";
import {
  sortItems,
  filterItems,
  searchItems,
  getInventoryUsage,
  SortOption,
  FilterOption,
} from "@/lib/game/inventory";
import {
  Card,
  ItemSlot,
  Pill,
  Resource,
  SectionHead,
  Seal,
  SlotRarity,
  SmallHead,
  Stat,
} from "@/components/ui";

interface InventoryViewProps {
  state: GameState;
  locale: Locale;
  onEquipItem?: (itemId: string, action: "equip" | "unequip") => Promise<void>;
  onDiscardItem?: (itemId: string, quantity: number) => Promise<void>;
  onUseItem?: (itemId: string) => Promise<void>;
  onEnhanceItem?: (itemId: string) => Promise<EnhancementResult | null>;
  onStateUpdate?: (state: GameState) => void;
}

const ITEM_TYPE_VI: Record<string, string> = {
  Medicine: "Đan Dược",
  Material: "Nguyên Liệu",
  Equipment: "Trang Bị",
  Manual: "Bí Kíp",
  Book: "Bí Tịch",
  Effect: "Linh Phù",
  Accessory: "Phụ Kiện",
  Misc: "Khác",
};

const RARITY_VI: Record<string, string> = {
  Common: "Phàm Phẩm",
  Uncommon: "Hạ Phẩm",
  Rare: "Trung Phẩm",
  Epic: "Thượng Phẩm",
  Legendary: "Cực Phẩm",
};

const SLOT_VI: Record<string, string> = {
  Weapon: "Vũ Khí",
  Head: "Đầu",
  Chest: "Ngực",
  Legs: "Chân",
  Feet: "Giày",
  Hands: "Tay",
  Accessory: "Phụ Kiện",
  Artifact: "Bảo Vật",
};

const SLOT_HAN: Record<string, string> = {
  Weapon: "兵",
  Head: "首",
  Chest: "甲",
  Legs: "腿",
  Feet: "履",
  Hands: "手",
  Accessory: "佩",
  Artifact: "寶",
};

const ITEM_HAN: Record<string, string> = {
  Medicine: "丹",
  Material: "材",
  Equipment: "器",
  Manual: "卷",
  Book: "書",
  Effect: "符",
  Accessory: "佩",
  Misc: "物",
};

const RARITY_TO_SLOT: Record<string, SlotRarity> = {
  Common: "common",
  Uncommon: "uncommon",
  Rare: "rare",
  Epic: "epic",
  Legendary: "legendary",
};

const STAT_LABELS: Record<string, { vi: string; en: string }> = {
  hp: { vi: "Sinh Lực", en: "HP" },
  qi: { vi: "Linh Khí", en: "Qi" },
  stamina: { vi: "Thể Lực", en: "Stamina" },
  str: { vi: "Sức Mạnh", en: "STR" },
  agi: { vi: "Nhanh Nhẹn", en: "AGI" },
  int: { vi: "Linh Trí", en: "INT" },
  perception: { vi: "Cảm Nhận", en: "PER" },
  luck: { vi: "May Mắn", en: "LUCK" },
  cultivation_speed: { vi: "Tốc Độ Tu Luyện", en: "Cultivation Speed" },
};

const EFFECT_LABELS: Record<string, { vi: string; en: string }> = {
  hp_restore: { vi: "Hồi Sinh Lực", en: "HP Restore" },
  qi_restore: { vi: "Hồi Linh Khí", en: "Qi Restore" },
  stamina_restore: { vi: "Hồi Thể Lực", en: "Stamina Restore" },
  cultivation_exp: { vi: "Tu Vi", en: "Cultivation EXP" },
  body_exp: { vi: "Luyện Thể", en: "Body EXP" },
  crafting: { vi: "Luyện Đan / Chế Tạo", en: "Crafting" },
};

function statLabel(key: string, locale: Locale): string {
  const entry = STAT_LABELS[key];
  if (entry) return locale === "vi" ? entry.vi : entry.en;
  return key.toUpperCase();
}

function effectLabel(key: string, locale: Locale): string {
  const entry = EFFECT_LABELS[key];
  if (entry) return locale === "vi" ? entry.vi : entry.en;
  return key.replace(/_/g, " ");
}

function formatStatValue(key: string, val: unknown): string {
  if (typeof val !== "number") return String(val);
  if (key === "cultivation_speed") return `${val > 0 ? "+" : ""}${val}%`;
  return `${val > 0 ? "+" : ""}${val}`;
}

const FILTERS: { id: FilterOption; han: string; vi: string; en: string }[] = [
  { id: "all", han: "全", vi: "Tất Cả", en: "All" },
  { id: "equipment", han: "器", vi: "Trang Bị", en: "Equipment" },
  { id: "consumable", han: "丹", vi: "Đan Dược", en: "Pills" },
  { id: "material", han: "材", vi: "Nguyên Liệu", en: "Materials" },
  { id: "book", han: "卷", vi: "Bí Kíp", en: "Manuals" },
];

const EQUIPPED_SLOTS = [
  "Weapon",
  "Head",
  "Chest",
  "Hands",
  "Legs",
  "Feet",
  "Accessory",
  "Artifact",
] as const;

const GRID_SIZE = 32;

function getItemHan(item: InventoryItem): string {
  if ((item as any).han) return (item as any).han;
  return ITEM_HAN[item.type] ?? "物";
}

export default function InventoryView({
  state,
  locale,
  onEquipItem,
  onDiscardItem,
  onUseItem,
  onEnhanceItem,
}: InventoryViewProps) {
  const [discardConfirm, setDiscardConfirm] = useState<{
    itemId: string;
    name: string;
    quantity: number;
  } | null>(null);
  const [useMessage, setUseMessage] = useState<string | null>(null);
  const [selectedEnhanceItem, setSelectedEnhanceItem] = useState<InventoryItem | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy] = useState<SortOption>("type");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const inventoryUsage = getInventoryUsage(state.inventory);

  const validInventoryItems = useMemo(() => {
    return state.inventory.items.filter(
      (item) =>
        !["Main", "Support", "Attack", "Defense", "Movement"].includes(item.type)
    );
  }, [state.inventory.items]);

  const processedItems = useMemo(() => {
    let items = validInventoryItems;
    if (searchQuery) items = searchItems(items, searchQuery, locale);
    items = filterItems(items, filterBy);
    items = sortItems(items, sortBy, true);
    return items;
  }, [validInventoryItems, searchQuery, filterBy, sortBy, locale]);

  const selectedItem = useMemo(
    () => processedItems.find((i) => i.id === selectedItemId) ?? null,
    [processedItems, selectedItemId]
  );

  const handleUseItem = async (item: InventoryItem) => {
    if (!onUseItem || loadingAction) return;
    const itemName = locale === "vi" ? item.name : item.name_en;
    setLoadingAction(`use-${item.id}`);
    try {
      await onUseItem(item.id);
      setUseMessage(locale === "vi" ? `Đã sử dụng ${itemName}` : `Used ${itemName}`);
      setTimeout(() => setUseMessage(null), 2000);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEquip = async (item: InventoryItem) => {
    if (!onEquipItem || loadingAction) return;
    setLoadingAction(`equip-${item.id}`);
    try {
      await onEquipItem(item.id, "equip");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUnequip = async (item: InventoryItem) => {
    if (!onEquipItem || loadingAction) return;
    setLoadingAction(`unequip-${item.id}`);
    try {
      await onEquipItem(item.id, "unequip");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDiscard = async (itemId: string, quantity: number) => {
    if (!onDiscardItem || loadingAction) return;
    setLoadingAction(`discard-${itemId}`);
    try {
      await onDiscardItem(itemId, quantity);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEnhance = async (itemId: string) => {
    if (!onEnhanceItem) return null;
    return await onEnhanceItem(itemId);
  };

  // Build slot grid (padded to GRID_SIZE)
  const gridSlots = useMemo(() => {
    const slots: (InventoryItem | null)[] = processedItems.slice(0, GRID_SIZE);
    while (slots.length < GRID_SIZE) slots.push(null);
    return slots;
  }, [processedItems]);

  return (
    <div>
      {useMessage && (
        <div
          className="ink-card"
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 50,
            padding: "10px 14px",
            borderLeft: "3px solid var(--jade)",
            background: "var(--card)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 12px rgba(70, 50, 20, 0.18)",
          }}
        >
          <span className="t-han" style={{ color: "var(--jade-deep)", fontSize: 18 }}>
            用
          </span>
          <span style={{ color: "var(--ink)", fontSize: 14 }}>{useMessage}</span>
        </div>
      )}

      <SectionHead
        han="物"
        title={locale === "vi" ? "Túi Đồ Trữ Vật" : "Cultivator Inventory"}
        subtitle={locale === "vi" ? "Vật phẩm tu sĩ" : "Cultivator's belongings"}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Pill variant="jade" withDot>
              {inventoryUsage.used}/{inventoryUsage.total}
            </Pill>
            {state.inventory.storage_ring && (
              <Pill variant="cinnabar">
                <span className="t-han">袋</span>{" "}
                {locale === "vi"
                  ? state.inventory.storage_ring.name
                  : state.inventory.storage_ring.name_en}
              </Pill>
            )}
          </div>
        }
      />

      <div className="inventory-grid" style={{ marginTop: 4 }}>
        {/* LEFT — filters + slot grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/* Resource counters */}
          <Card padding={18} deep>
            <div style={{ display: "flex", justifyContent: "space-around", gap: 12 }}>
              <Resource
                glyph="銀"
                amount={state.inventory.silver}
                label={t(locale, "silver")}
                variant="silver"
              />
              <Resource
                glyph="靈"
                amount={state.inventory.spirit_stones}
                label={t(locale, "spiritStones")}
                variant="stone"
              />
              <Resource
                glyph="袋"
                amount={inventoryUsage.used}
                label={locale === "vi" ? "Số ô" : "Slots"}
              />
            </div>
          </Card>

          {/* Filter pill row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {FILTERS.map((f) => {
              const active = filterBy === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilterBy(f.id)}
                  className={`pill ${active ? "solid" : ""}`}
                  style={{ cursor: "pointer" }}
                  type="button"
                >
                  <span
                    className="t-han"
                    style={{
                      fontSize: 13,
                      color: active ? "var(--paper)" : "var(--cinnabar-deep)",
                    }}
                  >
                    {f.han}
                  </span>
                  {locale === "vi" ? f.vi : f.en}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={locale === "vi" ? "Tìm vật phẩm…" : "Search items…"}
            className="t-body"
            style={{
              padding: "8px 12px",
              background: "var(--paper)",
              border: "1px solid var(--line-strong)",
              borderRadius: 2,
              color: "var(--ink)",
              fontSize: 14,
              outline: "none",
              fontStyle: "italic",
            }}
          />

          {/* Slot grid */}
          <Card padding={18}>
            <div className="inventory-slot-grid">
              {gridSlots.map((item, idx) => (
                <ItemSlot
                  key={item ? `${item.id}-${idx}` : `empty-${idx}`}
                  item={
                    item
                      ? {
                          glyph: getItemHan(item),
                          name: locale === "vi" ? item.name : item.name_en,
                          rarity: RARITY_TO_SLOT[item.rarity] ?? "common",
                          qty: item.quantity,
                          lvl: (item as any).enhancement_level,
                        }
                      : null
                  }
                  selected={!!item && item.id === selectedItemId}
                  onClick={() => item && setSelectedItemId(item.id)}
                />
              ))}
            </div>

            <div className="hr-soft" style={{ margin: "14px 0 10px" }} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                className="t-body"
                style={{ fontStyle: "italic", color: "var(--ink-mute)", fontSize: 12 }}
              >
                {locale === "vi"
                  ? `${processedItems.length} / ${validInventoryItems.length} vật phẩm`
                  : `${processedItems.length} of ${validInventoryItems.length} items`}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <Pill>
                  <span className="t-han" style={{ color: "var(--rarity-uncommon)" }}>
                    ●
                  </span>
                  Hạ
                </Pill>
                <Pill>
                  <span className="t-han" style={{ color: "var(--rarity-rare)" }}>
                    ●
                  </span>
                  Trung
                </Pill>
                <Pill>
                  <span className="t-han" style={{ color: "var(--rarity-epic)" }}>
                    ●
                  </span>
                  Thượng
                </Pill>
                <Pill>
                  <span className="t-han" style={{ color: "var(--rarity-legendary)" }}>
                    ●
                  </span>
                  Cực
                </Pill>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT — worn + detail */}
        <div
          className="inventory-detail"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            minWidth: 0,
          }}
        >
          {/* Worn equipment */}
          <Card padding={20}>
            <SmallHead
              right={
                <Pill variant="jade">
                  {locale === "vi" ? "Trang Bị" : "Equipped"}
                </Pill>
              }
            >
              {locale === "vi" ? "Đang Trang Bị" : "Currently Worn"}
            </SmallHead>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
              }}
            >
              {EQUIPPED_SLOTS.map((slot) => {
                const equipped = state.equipped_items[slot] as InventoryItem | undefined;
                return (
                  <div key={slot} style={{ textAlign: "center" }}>
                    <ItemSlot
                      item={
                        equipped
                          ? {
                              glyph: getItemHan(equipped),
                              name:
                                locale === "vi" ? equipped.name : equipped.name_en,
                              rarity:
                                RARITY_TO_SLOT[equipped.rarity] ?? "common",
                              lvl: (equipped as any).enhancement_level,
                            }
                          : null
                      }
                      emptyGlyph={SLOT_HAN[slot]}
                      onClick={() =>
                        equipped && setSelectedItemId(equipped.id)
                      }
                    />
                    <div
                      className="label"
                      style={{ marginTop: 4, fontSize: 9, letterSpacing: "0.12em" }}
                    >
                      {locale === "vi" ? SLOT_VI[slot] : slot}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Selected item detail */}
          <Card padding={22} className="card-corner" style={{ position: "relative" }}>
            {selectedItem ? (
              <>
                <span
                  className="han-bg"
                  style={{
                    position: "absolute",
                    top: -16,
                    right: -20,
                    fontSize: 200,
                  }}
                  aria-hidden
                >
                  {getItemHan(selectedItem)}
                </span>
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div className="label">
                    {locale === "vi" ? "Chi Tiết Vật Phẩm" : "Item Detail"}
                  </div>
                  <h3
                    className="t-display"
                    style={{
                      fontSize: 22,
                      margin: "4px 0 0",
                      color: "var(--ink)",
                      lineHeight: 1.2,
                    }}
                  >
                    {getEnhancedItemName(selectedItem, locale)}
                  </h3>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <Pill>
                      {locale === "vi"
                        ? ITEM_TYPE_VI[selectedItem.type] ?? selectedItem.type
                        : selectedItem.type}
                    </Pill>
                    <span
                      className="pill"
                      style={{
                        borderColor: `var(--rarity-${RARITY_TO_SLOT[selectedItem.rarity] ?? "common"})`,
                        color: `var(--rarity-${RARITY_TO_SLOT[selectedItem.rarity] ?? "common"})`,
                      }}
                    >
                      {locale === "vi"
                        ? RARITY_VI[selectedItem.rarity] ?? selectedItem.rarity
                        : selectedItem.rarity}
                    </span>
                    {selectedItem.quantity > 1 && (
                      <Pill variant="gold">
                        <span className="t-han">數</span> {selectedItem.quantity}
                      </Pill>
                    )}
                  </div>
                  <p
                    className="t-body"
                    style={{
                      fontStyle: "italic",
                      color: "var(--ink-soft)",
                      fontSize: 14,
                      marginTop: 12,
                      lineHeight: 1.55,
                    }}
                  >
                    {locale === "vi"
                      ? selectedItem.description
                      : selectedItem.description_en}
                  </p>

                  {selectedItem.bonus_stats && Object.keys(selectedItem.bonus_stats).length > 0 && (
                    <>
                      <div className="hr-soft" style={{ margin: "14px 0 8px" }} />
                      <SmallHead>
                        {locale === "vi" ? "Chỉ Số Bổ Trợ" : "Bonus Stats"}
                      </SmallHead>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "0 16px",
                        }}
                      >
                        {Object.entries(selectedItem.bonus_stats).map(
                          ([key, val]) =>
                            val ? (
                              <Stat
                                key={key}
                                label={statLabel(key, locale)}
                                value={formatStatValue(key, val)}
                                icon="加"
                              />
                            ) : null
                        )}
                      </div>
                    </>
                  )}

                  {selectedItem.effects && Object.keys(selectedItem.effects).length > 0 && (
                    <>
                      <div className="hr-soft" style={{ margin: "14px 0 8px" }} />
                      <SmallHead>
                        {locale === "vi" ? "Hiệu Quả" : "Effects"}
                      </SmallHead>
                      <div>
                        {Object.entries(selectedItem.effects).map(([key, value]) =>
                          value !== undefined && value !== null && value !== false ? (
                            <Stat
                              key={key}
                              label={effectLabel(key, locale)}
                              value={
                                typeof value === "number"
                                  ? `+${value}`
                                  : String(value)
                              }
                            />
                          ) : null
                        )}
                      </div>
                    </>
                  )}

                  {selectedItem.equipment_slot && (
                    <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                      <Pill variant="cinnabar">
                        <span className="t-han">
                          {SLOT_HAN[selectedItem.equipment_slot] ?? "位"}
                        </span>
                        {locale === "vi"
                          ? SLOT_VI[selectedItem.equipment_slot] ?? selectedItem.equipment_slot
                          : selectedItem.equipment_slot}
                      </Pill>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 18,
                    }}
                  >
                    {(selectedItem.type === "Medicine" ||
                      selectedItem.type === "Book" ||
                      selectedItem.effects) &&
                      onUseItem && (
                        <button
                          onClick={() => handleUseItem(selectedItem)}
                          disabled={loadingAction === `use-${selectedItem.id}`}
                          className="ink-btn primary"
                        >
                          <span className="t-han">用</span>
                          {locale === "vi" ? "Dùng" : "Use"}
                        </button>
                      )}

                    {(selectedItem.type === "Equipment" ||
                      selectedItem.type === "Accessory") &&
                      onEquipItem &&
                      !isEquipped(state, selectedItem) && (
                        <button
                          onClick={() => handleEquip(selectedItem)}
                          disabled={loadingAction === `equip-${selectedItem.id}`}
                          className="ink-btn primary"
                        >
                          <span className="t-han">裝</span>
                          {locale === "vi" ? "Trang Bị" : "Equip"}
                        </button>
                      )}

                    {(selectedItem.type === "Equipment" ||
                      selectedItem.type === "Accessory") &&
                      onEquipItem &&
                      isEquipped(state, selectedItem) && (
                        <button
                          onClick={() => handleUnequip(selectedItem)}
                          disabled={loadingAction === `unequip-${selectedItem.id}`}
                          className="ink-btn ghost"
                        >
                          <span className="t-han">脫</span>
                          {locale === "vi" ? "Tháo" : "Unequip"}
                        </button>
                      )}

                    {(selectedItem.type === "Equipment" ||
                      selectedItem.type === "Accessory") &&
                      canEnhance(selectedItem) && (
                        <button
                          onClick={() => setSelectedEnhanceItem(selectedItem)}
                          className="ink-btn ghost"
                        >
                          <span className="t-han">煉</span>
                          {locale === "vi" ? "Khắc Trận" : "Enhance"}
                        </button>
                      )}

                    {onDiscardItem && (
                      <button
                        onClick={() =>
                          setDiscardConfirm({
                            itemId: selectedItem.id,
                            name:
                              locale === "vi"
                                ? selectedItem.name
                                : selectedItem.name_en,
                            quantity: selectedItem.quantity,
                          })
                        }
                        className="ink-btn cinnabar"
                      >
                        <span className="t-han">棄</span>
                        {locale === "vi" ? "Vứt" : "Discard"}
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "30px 12px" }}>
                <Seal variant="ghost" size="md">
                  物
                </Seal>
                <p
                  className="t-body"
                  style={{
                    fontStyle: "italic",
                    color: "var(--ink-mute)",
                    fontSize: 13,
                    marginTop: 14,
                  }}
                >
                  {locale === "vi"
                    ? "Chọn một vật phẩm trong túi để xem chi tiết."
                    : "Select an item from the grid to view its detail."}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Discard confirmation */}
      {discardConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(20, 24, 32, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setDiscardConfirm(null)}
        >
          <Card
            padding={26}
            style={{ maxWidth: 440, width: "100%" }}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <Seal variant="cinnabar" size="sm">
                  棄
                </Seal>
                <h3
                  className="t-display"
                  style={{
                    margin: 0,
                    fontSize: 22,
                    color: "var(--ink)",
                  }}
                >
                  {locale === "vi" ? "Xác Nhận Vứt" : "Confirm Discard"}
                </h3>
              </div>
              <p
                className="t-body"
                style={{
                  fontStyle: "italic",
                  color: "var(--ink-soft)",
                  fontSize: 14,
                  marginBottom: 22,
                }}
              >
                {locale === "vi"
                  ? `Có chắc muốn vứt ${discardConfirm.quantity}× ${discardConfirm.name}? Việc này không thể hoàn tác.`
                  : `Really discard ${discardConfirm.quantity}× ${discardConfirm.name}? This cannot be undone.`}
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    handleDiscard(discardConfirm.itemId, discardConfirm.quantity);
                    setDiscardConfirm(null);
                  }}
                  disabled={!!loadingAction}
                  className="ink-btn cinnabar"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {locale === "vi" ? "Vứt Bỏ" : "Discard"}
                </button>
                <button
                  onClick={() => setDiscardConfirm(null)}
                  className="ink-btn ghost"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {locale === "vi" ? "Hủy" : "Cancel"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

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

function isEquipped(state: GameState, item: InventoryItem): boolean {
  return Object.values(state.equipped_items).some((eq) => eq?.id === item.id);
}
