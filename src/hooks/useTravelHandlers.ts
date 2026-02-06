import { useCallback } from "react";
import { GameState, Enemy } from "@/types/game";

interface ActiveCombatState {
  enemy: Enemy;
  log: any[];
  playerTurn: boolean;
}

interface UseTravelHandlersProps {
  locale: "vi" | "en";
  setState: React.Dispatch<React.SetStateAction<GameState | null>>;
  setError: (error: string) => void;
  setActiveCombat: React.Dispatch<React.SetStateAction<ActiveCombatState | null>>;
}

export function useTravelHandlers({
  locale,
  setState,
  setError,
  setActiveCombat,
}: UseTravelHandlersProps) {
  const handleTravelArea = useCallback(
    async (areaId: string) => {
      try {
        const response = await fetch("/api/travel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action: "travel_area", destination: areaId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to travel");
        }

        const result = await response.json();
        if (result.success && result.state) {
          setState(result.state);
        }
      } catch (err: any) {
        setError(err.message || (locale === "vi" ? "Lỗi di chuyển" : "Travel error"));
      }
    },
    [locale, setState, setError]
  );

  const handleTravelRegion = useCallback(
    async (regionId: string) => {
      try {
        const response = await fetch("/api/travel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            action: "travel_region",
            destination: regionId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to travel");
        }

        const result = await response.json();
        if (result.success && result.state) {
          setState(result.state);
        }
      } catch (err: any) {
        setError(err.message || (locale === "vi" ? "Lỗi di chuyển" : "Travel error"));
      }
    },
    [locale, setState, setError]
  );

  const handleDungeonAction = useCallback(
    async (action: string, params?: any) => {
      try {
        const response = await fetch("/api/dungeon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action, ...params }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed dungeon action");
        }

        const result = await response.json();
        console.log("Dungeon action result:", result);

        if (result.success && result.state) {
          setState(result.state);
        }

        // Check for enemy encounter and trigger combat
        if (result.success && result.encounter) {
          console.log("Encounter detected:", result.encounter);

          if (
            result.encounter.type === "enemy_wave" &&
            result.encounter.enemies &&
            result.encounter.enemies.length > 0
          ) {
            const enemy = result.encounter.enemies[0] as Enemy;
            if (!enemy.hp_max) {
              enemy.hp_max = enemy.hp;
            }

            console.log("Triggering dungeon combat with enemy:", enemy);
            setActiveCombat({
              enemy,
              log: [],
              playerTurn: !result.encounter.is_ambush,
            });
          }
        }

        return result;
      } catch (err: any) {
        setError(err.message || (locale === "vi" ? "Lỗi bí cảnh" : "Dungeon error"));
        throw err;
      }
    },
    [locale, setState, setError, setActiveCombat]
  );

  return {
    handleTravelArea,
    handleTravelRegion,
    handleDungeonAction,
  };
}
