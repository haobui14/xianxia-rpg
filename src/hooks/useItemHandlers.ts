import { useCallback } from "react";
import { apiCall } from "@/lib/utils/api";
import { GameState } from "@/types/game";

interface UseItemHandlersProps {
  locale: "vi" | "en";
  setState: (state: GameState | ((prev: GameState | null) => GameState | null)) => void;
  setError: (error: string) => void;
}

export function useItemHandlers({ locale, setState, setError }: UseItemHandlersProps) {
  const handleEquipItem = useCallback(
    async (itemId: string, action: "equip" | "unequip", slot?: string) => {
      try {
        // Slot disambiguates which worn item to unequip when multiple slots
        // could match by id (e.g. two accessories with the same item id).
        const result = await apiCall(
          "/api/equip-item",
          { itemId, action, ...(slot ? { slot } : {}) },
          locale
        );
        setState(result.state);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("Equip error:", err);
        }
        setError(
          (err instanceof Error ? err.message : "") ||
            (locale === "vi" ? "Lỗi trang bị" : "Error equipping item")
        );
      }
    },
    [locale, setState, setError]
  );

  const handleMarketAction = useCallback(
    async (itemId: string, action: "buy" | "sell") => {
      try {
        const result = await apiCall("/api/market", { itemId, action }, locale);
        setState(result.state);
      } catch (err: any) {
        if (process.env.NODE_ENV === "development") {
          console.error("Market error:", err);
        }
        setError(err.message || (locale === "vi" ? "Lỗi giao dịch" : "Transaction error"));
      }
    },
    [locale, setState, setError]
  );

  const handleRefreshMarket = useCallback(async () => {
    try {
      const result = await apiCall("/api/market", { action: "refresh" }, locale);
      setState(result.state);
    } catch (err: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("Refresh error:", err);
      }
      setError(err.message || (locale === "vi" ? "Lỗi làm mới" : "Refresh error"));
    }
  }, [locale, setState, setError]);

  const handleExchange = useCallback(
    async (amount: number) => {
      try {
        const result = await apiCall("/api/market", { action: "exchange", amount }, locale);
        setState(result.state);
      } catch (err: any) {
        if (process.env.NODE_ENV === "development") {
          console.error("Exchange error:", err);
        }
        setError(err.message || (locale === "vi" ? "Lỗi đổi tiền" : "Exchange error"));
      }
    },
    [locale, setState, setError]
  );

  const handleDiscardItem = useCallback(
    async (itemId: string, quantity: number) => {
      try {
        const result = await apiCall("/api/discard-item", { itemId, quantity }, locale);
        setState(result.state);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("Discard error:", err);
        }
        setError(locale === "vi" ? "Lỗi vứt vật phẩm" : "Error discarding item");
      }
    },
    [locale, setState, setError]
  );

  const handleUseItem = useCallback(
    async (itemId: string) => {
      try {
        const result = await apiCall("/api/use-item", { itemId }, locale);
        setState(result.state);
      } catch (err: any) {
        if (process.env.NODE_ENV === "development") {
          console.error("Use item error:", err);
        }
        setError(err.message || (locale === "vi" ? "Lỗi sử dụng vật phẩm" : "Error using item"));
      }
    },
    [locale, setState, setError]
  );

  const handleEnhanceItem = useCallback(
    async (itemId: string) => {
      // Known API error strings → localized copy. Keeps the failure modal
      // banner in the player's language without round-tripping a code.
      const VI_ERRORS: Record<string, string> = {
        "Insufficient resources for enhancement":
          "Không đủ tài nguyên — kiểm tra bạc và đá cường hóa.",
        "Item cannot be enhanced (max level reached or invalid type)":
          "Vật phẩm đã đạt cấp tối đa hoặc không thể cường hóa.",
        "Item not found": "Không tìm thấy vật phẩm.",
        "Missing itemId": "Thiếu mã vật phẩm.",
        "Failed to enhance item": "Cường hóa thất bại.",
      };

      try {
        const response = await fetch("/api/enhance-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ itemId }),
        });

        if (!response.ok) {
          // Expected user-facing failures (insufficient resources, max level,
          // not found, etc.) come back as 4xx with an `error` string. Surface
          // them inline through the modal instead of throwing — throwing here
          // would trigger Next.js dev's red error overlay and the page-level
          // error banner for what is a normal gameplay state.
          let rawMessage: string;
          try {
            const errorData = await response.json();
            rawMessage =
              errorData.error || (locale === "vi" ? "Không thể cường hóa" : "Cannot enhance");
          } catch {
            rawMessage = locale === "vi" ? "Không thể cường hóa" : "Cannot enhance";
          }
          const errorMessage =
            locale === "vi" ? (VI_ERRORS[rawMessage] ?? rawMessage) : rawMessage;
          return { success: false, errorMessage, newLevel: 0, previousLevel: 0 };
        }

        const result = await response.json();
        setState(result.state);
        return result.result; // Return the enhancement result for the modal
      } catch (err: any) {
        // Real network/server failure — keep the dev-only console.error for
        // debugging but don't bubble the throw up to the modal's caller.
        if (process.env.NODE_ENV === "development") {
          console.error("Enhance error:", err);
        }
        return {
          success: false,
          errorMessage:
            err?.message || (locale === "vi" ? "Lỗi mạng" : "Network error"),
          newLevel: 0,
          previousLevel: 0,
        };
      }
    },
    [locale, setState]
  );

  return {
    handleEquipItem,
    handleMarketAction,
    handleRefreshMarket,
    handleExchange,
    handleDiscardItem,
    handleUseItem,
    handleEnhanceItem,
  };
}
