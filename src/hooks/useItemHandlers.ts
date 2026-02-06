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
    async (itemId: string, action: "equip" | "unequip") => {
      try {
        const result = await apiCall("/api/equip-item", { itemId, action }, locale);
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
      try {
        const response = await fetch("/api/enhance-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ itemId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to enhance item");
        }

        const result = await response.json();
        setState(result.state);
        return result.result; // Return the enhancement result for the modal
      } catch (err: any) {
        console.error("Enhance error:", err);
        setError(err.message || (locale === "vi" ? "Lỗi cường hóa" : "Error enhancing item"));
        return null;
      }
    },
    [locale, setState, setError]
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
