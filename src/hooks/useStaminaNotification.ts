import { useEffect, useRef } from "react";
import { GameState } from "@/types/game";

const NOTIFICATION_COOLDOWN = 3600000; // 1 hour

export function useStaminaNotification(
  state: GameState | null,
  userId: string | undefined,
  previousStaminaRef: React.MutableRefObject<number>
) {
  const lastNotificationRef = useRef<number>(0);

  useEffect(() => {
    if (!state || !userId) return;

    const now = Date.now();
    const timeSinceLastNotification = now - lastNotificationRef.current;

    // Check if stamina just became full
    const wasNotFull = previousStaminaRef.current < state.stats.stamina_max;
    const isNowFull = state.stats.stamina >= state.stats.stamina_max;

    if (wasNotFull && isNowFull && timeSinceLastNotification > NOTIFICATION_COOLDOWN) {
      // Send notification
      fetch("/api/notify-stamina-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId }),
      })
        .then((response) => {
          if (response.ok) {
            console.log("Stamina full notification sent");
            lastNotificationRef.current = now;
          }
        })
        .catch((err) => {
          console.error("Failed to send notification:", err);
        });
    }

    previousStaminaRef.current = state.stats.stamina;
  }, [state, userId, previousStaminaRef]);
}
