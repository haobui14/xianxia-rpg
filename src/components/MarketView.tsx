"use client";

import { GameState, MarketItem, InventoryItem } from "@/types/game";
import { Locale } from "@/lib/i18n/translations";
import { useState, useMemo } from "react";
import { SectionHead } from "@/components/ui";

interface MarketViewProps {
  state: GameState;
  locale: Locale;
  onBuyItem?: (itemId: string) => Promise<void>;
  onSellItem?: (itemId: string) => Promise<void>;
  onRefreshMarket?: () => Promise<void>;
  onExchange?: (amount: number) => Promise<void>;
}

export default function MarketView({
  state,
  locale,
  onBuyItem,
  onSellItem,
  onRefreshMarket,
  onExchange,
}: MarketViewProps) {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [exchangeAmount, setExchangeAmount] = useState(1);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rarityFilter, setRarityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc" | "rarity">(
    "default"
  );

  // Initialize market if not exists
  if (!state.market) {
    return (
      <div className="p-8 text-center text-gray-400">
        {locale === "vi" ? "Chợ chưa mở..." : "Market not available..."}
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

  // Sell price estimate: ~40% of buy price, minimum 1
  const estimateSellPrice = (item: InventoryItem): { silver: number; spiritStones: number } => {
    const marketVersion = state.market?.items.find(
      (m) => m.name === item.name || m.name_en === item.name_en
    );
    if (marketVersion) {
      return {
        silver: Math.max(1, Math.floor((marketVersion.price_silver || 0) * 0.4)),
        spiritStones: Math.floor((marketVersion.price_spirit_stones || 0) * 0.4),
      };
    }
    // Fallback: estimate based on rarity
    const rarityMultiplier = { Common: 5, Uncommon: 15, Rare: 50, Epic: 150, Legendary: 500 };
    const base = rarityMultiplier[item.rarity as keyof typeof rarityMultiplier] || 5;
    return { silver: base, spiritStones: 0 };
  };

  // Rarity ordering for sort
  const RARITY_ORDER: Record<string, number> = {
    Common: 0,
    Uncommon: 1,
    Rare: 2,
    Epic: 3,
    Legendary: 4,
  };

  // Filter & sort items
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
      filtered = [...filtered].sort((a, b) => (a.price_silver || 0) - (b.price_silver || 0));
    } else if (sortBy === "price-desc") {
      filtered = [...filtered].sort((a, b) => (b.price_silver || 0) - (a.price_silver || 0));
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

  return (
    <div className="space-y-6">
      <SectionHead
        han="市"
        title={locale === "vi" ? "Chợ Linh Vật" : "Spirit Market"}
        subtitle={
          locale === "vi"
            ? "Buôn bán giao dịch — quầy đổi mới mỗi 3 ngày"
            : "Trade and exchange — stalls refresh every 3 days"
        }
      />
      {/* Market Info */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-2 text-xianxia-gold">
          {locale === "vi" ? "Chợ Linh Vật" : "Spirit Market"}
        </h2>

        {/* Currency Display */}
        <div className="flex flex-wrap gap-4 mb-4 p-3 bg-xianxia-darker rounded-lg border border-xianxia-accent/10">
          <div className="flex items-center gap-1.5">
            <span>💰</span>
            <span className="text-xianxia-silver font-semibold">
              {state.inventory.silver.toLocaleString()}
            </span>
            <span className="text-xs text-gray-500">{locale === "vi" ? "bạc" : "silver"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>💎</span>
            <span className="text-xianxia-accent font-semibold">
              {state.inventory.spirit_stones.toLocaleString()}
            </span>
            <span className="text-xs text-gray-500">
              {locale === "vi" ? "linh thạch" : "spirit stones"}
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          {locale === "vi"
            ? `Chợ sẽ làm mới vào tháng ${state.market.next_regeneration.month} năm ${state.market.next_regeneration.year}`
            : `Market refreshes at month ${state.market.next_regeneration.month}, year ${state.market.next_regeneration.year}`}
        </p>

        {/* Market Actions */}
        <div className="flex flex-wrap gap-3">
          {/* Refresh Market */}
          {onRefreshMarket && (
            <button
              onClick={() => handleAsyncAction("refresh", onRefreshMarket)}
              disabled={state.inventory.spirit_stones < 20 || loadingAction === "refresh"}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                state.inventory.spirit_stones >= 20 && loadingAction !== "refresh"
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
            >
              {loadingAction === "refresh" ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block"></span>
                  {locale === "vi" ? "Đang làm mới..." : "Refreshing..."}
                </span>
              ) : (
                <>🔄 {locale === "vi" ? "Làm mới (20 Linh Thạch)" : "Refresh (20 Spirit Stones)"}</>
              )}
            </button>
          )}

          {/* Exchange Spirit Stones */}
          {onExchange && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={state.inventory.spirit_stones}
                value={exchangeAmount}
                onChange={(e) => setExchangeAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-2 py-2 bg-gray-800 border border-gray-600 rounded text-white"
                aria-label={
                  locale === "vi" ? "Số lượng linh thạch đổi" : "Spirit stones to exchange"
                }
              />
              <button
                onClick={() => handleAsyncAction("exchange", () => onExchange(exchangeAmount))}
                disabled={
                  state.inventory.spirit_stones < exchangeAmount || loadingAction === "exchange"
                }
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  state.inventory.spirit_stones >= exchangeAmount && loadingAction !== "exchange"
                    ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
              >
                💱{" "}
                {locale === "vi"
                  ? `Đổi → ${exchangeAmount * 100} Bạc`
                  : `Exchange → ${exchangeAmount * 100} Silver`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={locale === "vi" ? "🔍 Tìm vật phẩm..." : "🔍 Search items..."}
              className="w-full px-3 py-2 bg-xianxia-darker border border-xianxia-accent/20 rounded-lg text-sm focus:outline-none focus:border-xianxia-accent/50 placeholder-gray-500"
              aria-label={locale === "vi" ? "Tìm vật phẩm" : "Search items"}
            />
          </div>
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value)}
            className="px-3 py-2 bg-xianxia-darker border border-xianxia-accent/20 rounded-lg text-sm focus:outline-none focus:border-xianxia-accent/50"
            aria-label={locale === "vi" ? "Lọc độ hiếm" : "Filter by rarity"}
          >
            <option value="all">{locale === "vi" ? "Tất cả độ hiếm" : "All Rarities"}</option>
            <option value="Common">{locale === "vi" ? "Phàm Phẩm" : "Common"}</option>
            <option value="Uncommon">{locale === "vi" ? "Hạ Phẩm" : "Uncommon"}</option>
            <option value="Rare">{locale === "vi" ? "Trung Phẩm" : "Rare"}</option>
            <option value="Epic">{locale === "vi" ? "Thượng Phẩm" : "Epic"}</option>
            <option value="Legendary">{locale === "vi" ? "Cực Phẩm" : "Legendary"}</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-xianxia-darker border border-xianxia-accent/20 rounded-lg text-sm focus:outline-none focus:border-xianxia-accent/50"
            aria-label={locale === "vi" ? "Sắp xếp" : "Sort by"}
          >
            <option value="default">{locale === "vi" ? "Mặc định" : "Default"}</option>
            <option value="price-asc">{locale === "vi" ? "Giá tăng" : "Price: Low to High"}</option>
            <option value="price-desc">
              {locale === "vi" ? "Giá giảm" : "Price: High to Low"}
            </option>
            <option value="rarity">{locale === "vi" ? "Độ hiếm" : "Rarity"}</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <div className="flex gap-2 mb-4 border-b border-xianxia-accent/30">
          <button
            onClick={() => setActiveTab("buy")}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === "buy"
                ? "text-xianxia-gold border-b-2 border-xianxia-gold"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            {locale === "vi" ? "Mua" : "Buy"} ({state.market.items.length})
          </button>
          <button
            onClick={() => setActiveTab("sell")}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === "sell"
                ? "text-xianxia-gold border-b-2 border-xianxia-gold"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            {locale === "vi" ? "Bán" : "Sell"} ({sellableItems.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === "buy" ? (
          <div className="space-y-3">
            {filteredBuyItems.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                {searchQuery || rarityFilter !== "all"
                  ? locale === "vi"
                    ? "Không tìm thấy vật phẩm"
                    : "No matching items"
                  : locale === "vi"
                    ? "Không có hàng"
                    : "No items available"}
              </p>
            ) : (
              filteredBuyItems.map((item, index) =>
                renderMarketItem(item, index, locale, "buy", state, loadingAction, (id) =>
                  handleAsyncAction(`buy-${id}`, () => onBuyItem!(id))
                )
              )
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSellItems.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                {searchQuery || rarityFilter !== "all"
                  ? locale === "vi"
                    ? "Không tìm thấy vật phẩm"
                    : "No matching items"
                  : locale === "vi"
                    ? "Không có gì để bán"
                    : "Nothing to sell"}
              </p>
            ) : (
              filteredSellItems.map((item, index) => {
                const est = estimateSellPrice(item);
                return renderMarketItem(
                  item,
                  index,
                  locale,
                  "sell",
                  state,
                  loadingAction,
                  undefined,
                  (id) => handleAsyncAction(`sell-${id}`, () => onSellItem!(id)),
                  est
                );
              })
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
  mode: "buy" | "sell",
  state: GameState,
  loadingAction: string | null,
  onBuyItem?: (itemId: string) => void,
  onSellItem?: (itemId: string) => void,
  sellEstimate?: { silver: number; spiritStones: number }
) {
  const canAfford =
    mode === "buy"
      ? (item.price_silver ? state.inventory.silver >= item.price_silver : true) &&
        (item.price_spirit_stones
          ? state.inventory.spirit_stones >= item.price_spirit_stones
          : true)
      : true;

  const isLoading = loadingAction === `${mode}-${item.id}`;

  return (
    <div
      key={`${item.id}-${index}`}
      className="p-4 bg-xianxia-darker rounded-lg border border-xianxia-accent/20"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="font-bold text-lg">{locale === "vi" ? item.name : item.name_en}</div>
          <div className="text-sm text-gray-400 mt-1">
            {locale === "vi" ? item.description : item.description_en}
          </div>
          <div className="flex gap-3 mt-2 text-xs">
            <span className="px-2 py-1 bg-xianxia-accent/20 rounded">{item.type}</span>
            <span
              className={`px-2 py-1 rounded ${
                item.rarity === "Legendary"
                  ? "bg-orange-500/20 text-orange-300"
                  : item.rarity === "Epic"
                    ? "bg-purple-500/20 text-purple-300"
                    : item.rarity === "Rare"
                      ? "bg-blue-500/20 text-blue-300"
                      : item.rarity === "Uncommon"
                        ? "bg-green-500/20 text-green-300"
                        : "bg-gray-500/20 text-gray-300"
              }`}
            >
              {item.rarity}
            </span>
          </div>

          {/* Price */}
          <div className="mt-3 flex gap-4 text-sm">
            {item.price_silver && item.price_silver > 0 && (
              <div className="text-xianxia-silver">
                💰 {item.price_silver} {locale === "vi" ? "bạc" : "silver"}
              </div>
            )}
            {item.price_spirit_stones && item.price_spirit_stones > 0 && (
              <div className="text-xianxia-accent">
                💎 {item.price_spirit_stones} {locale === "vi" ? "linh thạch" : "spirit stones"}
              </div>
            )}
          </div>
        </div>

        <div className="ml-4">
          {mode === "buy" && onBuyItem && (
            <button
              onClick={() => onBuyItem(item.id)}
              disabled={!canAfford || isLoading}
              className={`px-4 py-2 rounded transition-colors flex items-center gap-2 ${
                canAfford && !isLoading
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
            >
              {isLoading && (
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block"></span>
              )}
              {locale === "vi" ? "Mua" : "Buy"}
            </button>
          )}
          {mode === "sell" && onSellItem && (
            <div className="flex flex-col items-end gap-2">
              {sellEstimate && (sellEstimate.silver > 0 || sellEstimate.spiritStones > 0) && (
                <div className="text-xs text-gray-400 text-right">
                  <span className="text-green-400 font-medium">
                    {locale === "vi" ? "~Bán: " : "~Sell: "}
                  </span>
                  {sellEstimate.silver > 0 && (
                    <span className="text-xianxia-silver">💰{sellEstimate.silver}</span>
                  )}
                  {sellEstimate.spiritStones > 0 && (
                    <span className="text-xianxia-accent ml-1">💎{sellEstimate.spiritStones}</span>
                  )}
                </div>
              )}
              <button
                onClick={() => onSellItem(item.id)}
                disabled={isLoading}
                className={`px-4 py-2 rounded transition-colors flex items-center gap-2 ${
                  !isLoading
                    ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                    : "bg-gray-600 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isLoading && (
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block"></span>
                )}
                {locale === "vi" ? "Bán" : "Sell"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Show bonus stats for equipment */}
      {item.bonus_stats && Object.keys(item.bonus_stats).length > 0 && (
        <div className="mt-3 pt-3 border-t border-xianxia-accent/20">
          <div className="text-sm text-green-400 font-semibold">
            {locale === "vi" ? "Chỉ số:" : "Stats:"}
          </div>
          <div className="text-sm text-gray-300 mt-1 grid grid-cols-2 gap-1">
            {Object.entries(item.bonus_stats).map(
              ([key, value]) =>
                value && (
                  <div key={key}>
                    {key.toUpperCase()}: +{value}
                  </div>
                )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
