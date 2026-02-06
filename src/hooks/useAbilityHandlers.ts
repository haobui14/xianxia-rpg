import { useCallback } from "react";
import { GameState } from "@/types/game";

interface UseAbilityHandlersProps {
  runId: string;
  locale: "vi" | "en";
  setState: React.Dispatch<React.SetStateAction<GameState | null>>;
  setError: (error: string) => void;
}

export function useAbilityHandlers({
  runId,
  locale,
  setState,
  setError,
}: UseAbilityHandlersProps) {
  const handleAbilitySwap = useCallback(
    async (
      abilityType: "technique" | "skill",
      activeId: string | null,
      queueId: string | null,
      action: "swap" | "forget" | "learn" | "discard"
    ) => {
      try {
        const response = await fetch("/api/swap-ability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            runId,
            abilityType,
            activeId,
            queueId,
            action,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to swap ability");
        }

        const result = await response.json();
        setState(result.state);
      } catch (err: any) {
        console.error("Ability swap error:", err);
        setError(
          err.message || (locale === "vi" ? "Lỗi hoán đổi năng lực" : "Error swapping ability")
        );
      }
    },
    [runId, locale, setState, setError]
  );

  const handleToggleDualCultivation = useCallback(async () => {
    try {
      const response = await fetch("/api/dual-cultivation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "toggle" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to toggle dual cultivation");
      }

      const result = await response.json();
      setState(result.state);
    } catch (err: any) {
      console.error("Dual cultivation error:", err);
      setError(
        err.message ||
          (locale === "vi" ? "Lỗi chuyển đổi song tu" : "Error toggling dual cultivation")
      );
    }
  }, [locale, setState, setError]);

  const handleSetExpSplit = useCallback(
    async (split: number) => {
      try {
        const response = await fetch("/api/dual-cultivation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action: "set_split", split }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to set exp split");
        }

        const result = await response.json();
        setState(result.state);
      } catch (err: any) {
        console.error("Exp split error:", err);
        setError(
          err.message ||
            (locale === "vi" ? "Lỗi cài đặt phân chia kinh nghiệm" : "Error setting exp split")
        );
      }
    },
    [locale, setState, setError]
  );

  return {
    handleAbilitySwap,
    handleToggleDualCultivation,
    handleSetExpSplit,
  };
}
