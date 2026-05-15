"use client";

import { GameState, MarketItem, InventoryItem } from "@/types/game";
import { Locale } from "@/lib/i18n/translations";
import { useState, useMemo } from "react";
import {
  Card,
  ItemSlot,
  Pill,
  Resource,
  SectionHead,
  Seal,
  SlotRarity,
} from "@/components/ui";

interface MarketViewProps {
  state: GameState;
  locale: Locale;
  onBuyItem?: (itemId: string) => Promise<void>;
  onSellItem?: (itemId: string) => Promise<void>;
  onRefreshMarket?: () => Promise<void>;
  onExchange?: (amount: number) => Promise<void>;
}

const RARITY_VI: Record<string, string> = {
  Common: "Phàm Phẩm",
  Uncommon: "Hạ Phẩm",
  Rare: "Trung Phẩm",
  Epic: "Thượng Phẩm",
  Legendary: "Cực Phẩm",
};

const RARITY_TO_SLOT: Record<string, SlotRarity> = {
  Common: "common",
  Uncommon: "uncommon",
  Rare: "rare",
  Epic: "epic",
  Legendary: "legendary",
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

function getHan(item: { type: string; han?: string }): string {
  return (item as any).han || ITEM_HAN[item.type] || "物";
}

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

type SubTab = "buy" | "sell" | "exchange";

export default function MarketView({
  state,
  locale,
  onBuyItem,
  onSellItem,
  onRefreshMarket,
  onExchange,
}: MarketViewProps) {
  const [subTab, setSubTab] = useState<SubTab>("buy");
  const [exchangeAmount, setExchangeAmount] = useState(1);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rarityFilter, setRarityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc" | "rarity">(
    "default"
  );

  if (!state.market) {
    return (
      <div>
        <SectionHead
          han="市"
          title={locale === "vi" ? "Chợ Linh Vật" : "Spirit Market"}
        />
        <Card padding={28} style={{ textAlign: "center" }}>
          <Seal variant="ghost" size="md">
            市
          </Seal>
          <p
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-mute)",
              fontSize: 14,
              marginTop: 12,
            }}
          >
            {locale === "vi"
              ? "Chợ chưa mở. Hãy chờ thiên cơ vận hành."
              : "The market is not open yet. Bide your time."}
          </p>
        </Card>
      </div>
    );
  }

  const handleAsyncAction = async (key: string, action: () => Promise<void>) => {
    if (loadingAction) return;
    setLoadingAction(key);
    try {
      await action();
    } finally {
      setLoadingAction(null);
    }
  };

  const sellableItems = state.inventory.items.filter(
    (item) =>
      !["Misc", "Main", "Support", "Attack", "Defense", "Movement"].includes(item.type) &&
      !item.is_equipped
  );

  const estimateSellPrice = (
    item: InventoryItem
  ): { silver: number; spiritStones: number } => {
    const marketVersion = state.market?.items.find(
      (m) => m.name === item.name || m.name_en === item.name_en
    );
    if (marketVersion) {
      return {
        silver: Math.max(1, Math.floor((marketVersion.price_silver || 0) * 0.4)),
        spiritStones: Math.floor((marketVersion.price_spirit_stones || 0) * 0.4),
      };
    }
    const rarityMultiplier = { Common: 5, Uncommon: 15, Rare: 50, Epic: 150, Legendary: 500 };
    const base = rarityMultiplier[item.rarity as keyof typeof rarityMultiplier] || 5;
    return { silver: base, spiritStones: 0 };
  };

  const RARITY_ORDER: Record<string, number> = {
    Common: 0,
    Uncommon: 1,
    Rare: 2,
    Epic: 3,
    Legendary: 4,
  };

  const filterAndSort = <
    T extends {
      name: string;
      name_en: string;
      rarity: string;
      price_silver?: number;
      price_spirit_stones?: number;
    },
  >(
    items: T[]
  ): T[] => {
    let filtered = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) => i.name.toLowerCase().includes(q) || i.name_en.toLowerCase().includes(q)
      );
    }
    if (rarityFilter !== "all") {
      filtered = filtered.filter((i) => i.rarity === rarityFilter);
    }
    if (sortBy === "price-asc") {
      filtered = [...filtered].sort(
        (a, b) => (a.price_silver || 0) - (b.price_silver || 0)
      );
    } else if (sortBy === "price-desc") {
      filtered = [...filtered].sort(
        (a, b) => (b.price_silver || 0) - (a.price_silver || 0)
      );
    } else if (sortBy === "rarity") {
      filtered = [...filtered].sort(
        (a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0)
      );
    }
    return filtered;
  };

  const filteredBuyItems = useMemo(
    () => filterAndSort(state.market!.items),
    [state.market?.items, searchQuery, rarityFilter, sortBy]
  );
  const filteredSellItems = useMemo(() => {
    const withPrice = sellableItems.map((item) => ({
      ...item,
      price_silver: estimateSellPrice(item).silver,
      price_spirit_stones: estimateSellPrice(item).spiritStones,
    }));
    return filterAndSort(withPrice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellableItems.length, searchQuery, rarityFilter, sortBy]);

  const SUB_TABS: { id: SubTab; han: string; vi: string; en: string }[] = [
    { id: "buy", han: "買", vi: "Mua", en: "Buy" },
    { id: "sell", han: "賣", vi: "Bán", en: "Sell" },
    { id: "exchange", han: "兌", vi: "Đổi", en: "Exchange" },
  ];

  return (
    <div>
      <SectionHead
        han="市"
        title={locale === "vi" ? "Chợ Linh Vật" : "Spirit Market"}
        subtitle={
          locale === "vi"
            ? `Sẽ làm mới tại tháng ${state.market.next_regeneration.month} năm ${state.market.next_regeneration.year}`
            : `Refreshes at month ${state.market.next_regeneration.month}, year ${state.market.next_regeneration.year}`
        }
        right={
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Resource
              glyph="銀"
              amount={state.inventory.silver}
              label={locale === "vi" ? "Bạc" : "Silver"}
              variant="silver"
            />
            <Resource
              glyph="靈"
              amount={state.inventory.spirit_stones}
              label={locale === "vi" ? "Linh Thạch" : "Stones"}
              variant="stone"
            />
            {onRefreshMarket && (
              <button
                onClick={() => handleAsyncAction("refresh", onRefreshMarket)}
                disabled={
                  state.inventory.spirit_stones < 20 || loadingAction === "refresh"
                }
                className="ink-btn ghost sm"
              >
                <span className="t-han">新</span>
                {loadingAction === "refresh"
                  ? locale === "vi"
                    ? "Đang làm mới…"
                    : "Refreshing…"
                  : locale === "vi"
                    ? "Làm Mới — 20 靈"
                    : "Refresh — 20 stones"}
              </button>
            )}
          </div>
        }
      />

      {/* Sub-tabs */}
      <div
        className="ink-tabs"
        style={{ marginBottom: 18, alignItems: "center" }}
        role="tablist"
      >
        {SUB_TABS.map((tab) => {
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(tab.id)}
              className={`ink-tab ${active ? "active" : ""}`}
            >
              <span className="han">{tab.han}</span>
              <span>{locale === "vi" ? tab.vi : tab.en}</span>
            </button>
          );
        })}
        <span
          className="t-body"
          style={{
            marginLeft: "auto",
            fontStyle: "italic",
            color: "var(--ink-faint)",
            fontSize: 12,
          }}
        >
          {locale === "vi"
            ? "Quầy hàng đổi mới mỗi 3 ngày"
            : "Stalls renew every 3 days"}
        </span>
      </div>

      {/* Search & filter */}
      {subTab !== "exchange" && (
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={locale === "vi" ? "Tìm vật phẩm…" : "Search items…"}
            className="t-body"
            style={{
              flex: "1 1 240px",
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
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              background: "var(--paper)",
              border: "1px solid var(--line-strong)",
              borderRadius: 2,
              color: "var(--ink)",
              fontSize: 13,
              outline: "none",
              fontFamily: "var(--font-ui), Inter, sans-serif",
            }}
          >
            <option value="all">
              {locale === "vi" ? "Tất cả độ hiếm" : "All Rarities"}
            </option>
            {Object.keys(RARITY_VI).map((r) => (
              <option key={r} value={r}>
                {locale === "vi" ? RARITY_VI[r] : r}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: "8px 12px",
              background: "var(--paper)",
              border: "1px solid var(--line-strong)",
              borderRadius: 2,
              color: "var(--ink)",
              fontSize: 13,
              outline: "none",
              fontFamily: "var(--font-ui), Inter, sans-serif",
            }}
          >
            <option value="default">{locale === "vi" ? "Mặc định" : "Default"}</option>
            <option value="price-asc">
              {locale === "vi" ? "Giá tăng" : "Price ↑"}
            </option>
            <option value="price-desc">
              {locale === "vi" ? "Giá giảm" : "Price ↓"}
            </option>
            <option value="rarity">{locale === "vi" ? "Độ hiếm" : "Rarity"}</option>
          </select>
        </div>
      )}

      {/* Content */}
      {subTab === "buy" ? (
        <ListingsGrid
          items={filteredBuyItems}
          mode="buy"
          locale={locale}
          state={state}
          loadingAction={loadingAction}
          onAction={(id) =>
            onBuyItem && handleAsyncAction(`buy-${id}`, () => onBuyItem(id))
          }
        />
      ) : subTab === "sell" ? (
        <ListingsGrid
          items={filteredSellItems}
          mode="sell"
          locale={locale}
          state={state}
          loadingAction={loadingAction}
          onAction={(id) =>
            onSellItem && handleAsyncAction(`sell-${id}`, () => onSellItem(id))
          }
        />
      ) : (
        <Card padding={28} style={{ maxWidth: 540 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
            <Seal variant="ink">兌</Seal>
            <div>
              <div className="label">
                {locale === "vi" ? "Đổi Linh Thạch" : "Exchange Spirit Stones"}
              </div>
              <h3
                className="t-display"
                style={{ margin: 0, fontSize: 22, color: "var(--ink)" }}
              >
                {locale === "vi"
                  ? "1 Linh Thạch — 100 Bạc"
                  : "1 stone — 100 silver"}
              </h3>
            </div>
          </div>
          <p
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-soft)",
              fontSize: 14,
              marginBottom: 18,
            }}
          >
            {locale === "vi"
              ? "Phá vỡ linh thạch lấy bạc, dùng cho thường tình giao dịch."
              : "Crack open spirit stones for silver, useful for everyday trade."}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="number"
              min={1}
              max={state.inventory.spirit_stones}
              value={exchangeAmount}
              onChange={(e) =>
                setExchangeAmount(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="t-num"
              style={{
                width: 100,
                padding: "8px 12px",
                background: "var(--paper)",
                border: "1px solid var(--line-strong)",
                borderRadius: 2,
                color: "var(--ink)",
                fontSize: 15,
                outline: "none",
              }}
            />
            <span className="t-han" style={{ fontSize: 22, color: "var(--jade-deep)" }}>
              靈
            </span>
            <span style={{ color: "var(--ink-mute)" }}>→</span>
            <span className="t-num" style={{ fontSize: 18, color: "var(--ink)" }}>
              {(exchangeAmount * 100).toLocaleString()}
            </span>
            <span className="t-han" style={{ fontSize: 22, color: "var(--gold-deep)" }}>
              銀
            </span>
            {onExchange && (
              <button
                onClick={() =>
                  handleAsyncAction("exchange", () => onExchange(exchangeAmount))
                }
                disabled={
                  state.inventory.spirit_stones < exchangeAmount ||
                  loadingAction === "exchange"
                }
                className="ink-btn primary"
                style={{ marginLeft: "auto" }}
              >
                <span className="t-han">兌</span>
                {loadingAction === "exchange"
                  ? locale === "vi"
                    ? "Đang đổi…"
                    : "Exchanging…"
                  : locale === "vi"
                    ? "Đổi"
                    : "Exchange"}
              </button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function ListingsGrid({
  items,
  mode,
  locale,
  state,
  loadingAction,
  onAction,
}: {
  items: MarketItem[];
  mode: "buy" | "sell";
  locale: Locale;
  state: GameState;
  loadingAction: string | null;
  onAction: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <Card padding={28} style={{ textAlign: "center" }}>
        <Seal variant="ghost">空</Seal>
        <p
          className="t-body"
          style={{
            fontStyle: "italic",
            color: "var(--ink-mute)",
            fontSize: 14,
            marginTop: 12,
          }}
        >
          {locale === "vi"
            ? mode === "buy"
              ? "Quầy hàng đã hết."
              : "Không có vật phẩm để bán."
            : mode === "buy"
              ? "No items available."
              : "Nothing to sell."}
        </p>
      </Card>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
        gap: 14,
      }}
    >
      {items.map((item, idx) => (
        <ListingCard
          key={`${item.id}-${idx}`}
          item={item}
          mode={mode}
          locale={locale}
          state={state}
          loading={loadingAction === `${mode}-${item.id}`}
          onAction={() => onAction(item.id)}
        />
      ))}
    </div>
  );
}

function ListingCard({
  item,
  mode,
  locale,
  state,
  loading,
  onAction,
}: {
  item: MarketItem;
  mode: "buy" | "sell";
  locale: Locale;
  state: GameState;
  loading: boolean;
  onAction: () => void;
}) {
  const canAfford =
    mode === "buy"
      ? (!item.price_silver || state.inventory.silver >= item.price_silver) &&
        (!item.price_spirit_stones ||
          state.inventory.spirit_stones >= item.price_spirit_stones)
      : true;

  const slotRarity = RARITY_TO_SLOT[item.rarity] ?? "common";

  return (
    <Card padding={16} style={{ display: "flex", gap: 14 }}>
      <div style={{ width: 64, flexShrink: 0 }}>
        <ItemSlot
          item={{
            glyph: getHan(item),
            rarity: slotRarity,
            name: locale === "vi" ? item.name : item.name_en,
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="t-display"
          style={{
            fontSize: 17,
            color: "var(--ink)",
            lineHeight: 1.2,
            marginBottom: 2,
          }}
        >
          {locale === "vi" ? item.name : item.name_en}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          <span
            className="pill"
            style={{
              borderColor: `var(--rarity-${slotRarity})`,
              color: `var(--rarity-${slotRarity})`,
            }}
          >
            <span className="t-han">{getHan(item)}</span>
            {locale === "vi" ? RARITY_VI[item.rarity] : item.rarity}
          </span>
          <Pill>{item.type}</Pill>
        </div>
        <p
          className="t-body"
          style={{
            fontStyle: "italic",
            color: "var(--ink-mute)",
            fontSize: 12,
            margin: "0 0 10px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {locale === "vi" ? item.description : item.description_en}
        </p>

        {item.bonus_stats && Object.keys(item.bonus_stats).length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "2px 12px",
              margin: "0 0 10px",
            }}
          >
            {Object.entries(item.bonus_stats).map(([key, val]) =>
              val ? (
                <span
                  key={key}
                  className="t-body"
                  style={{
                    fontSize: 12,
                    color: "var(--ink-soft)",
                    display: "inline-flex",
                    gap: 4,
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ color: "var(--ink-mute)" }}>{statLabel(key, locale)}</span>
                  <span
                    className="t-num"
                    style={{ color: "var(--jade-deep)", fontWeight: 600 }}
                  >
                    {formatStatValue(key, val)}
                  </span>
                </span>
              ) : null
            )}
          </div>
        )}

        {item.effects && Object.keys(item.effects).length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "2px 12px",
              margin: "0 0 10px",
            }}
          >
            {Object.entries(item.effects).map(([key, val]) =>
              val !== undefined && val !== null && val !== false ? (
                <span
                  key={key}
                  className="t-body"
                  style={{
                    fontSize: 12,
                    color: "var(--ink-soft)",
                    display: "inline-flex",
                    gap: 4,
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ color: "var(--ink-mute)" }}>{effectLabel(key, locale)}</span>
                  <span
                    className="t-num"
                    style={{ color: "var(--cinnabar-deep)", fontWeight: 600 }}
                  >
                    {typeof val === "number" ? `+${val}` : String(val)}
                  </span>
                </span>
              ) : null
            )}
          </div>
        )}

        {item.equipment_slot && (
          <div style={{ margin: "0 0 10px" }}>
            <Pill variant="cinnabar">
              {locale === "vi" ? "Vị trí" : "Slot"}: {item.equipment_slot}
            </Pill>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {item.price_silver && item.price_silver > 0 && (
              <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span
                  className="t-num"
                  style={{
                    fontSize: 16,
                    color: "var(--gold-deep)",
                    fontWeight: 600,
                  }}
                >
                  {item.price_silver}
                </span>
                <span
                  className="t-han"
                  style={{ fontSize: 13, color: "var(--gold-deep)" }}
                >
                  銀
                </span>
              </span>
            )}
            {item.price_spirit_stones && item.price_spirit_stones > 0 && (
              <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span
                  className="t-num"
                  style={{
                    fontSize: 16,
                    color: "var(--jade-deep)",
                    fontWeight: 600,
                  }}
                >
                  {item.price_spirit_stones}
                </span>
                <span
                  className="t-han"
                  style={{ fontSize: 13, color: "var(--jade-deep)" }}
                >
                  靈
                </span>
              </span>
            )}
          </div>
          <button
            onClick={onAction}
            disabled={!canAfford || loading}
            className={mode === "buy" ? "ink-btn primary" : "ink-btn cinnabar"}
          >
            <span className="t-han">{mode === "buy" ? "買" : "賣"}</span>
            {loading
              ? "…"
              : mode === "buy"
                ? locale === "vi"
                  ? "Mua 1"
                  : "Buy 1"
                : locale === "vi"
                  ? "Bán"
                  : "Sell"}
          </button>
        </div>
      </div>
    </Card>
  );
}
