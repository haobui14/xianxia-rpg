import { useCallback } from "react";

interface UseEventHandlersProps {
  locale: "vi" | "en";
  processTurn: (choiceId: string | null, selectedChoice?: any) => Promise<void>;
  setError: (error: string) => void;
}

export function useEventHandlers({ locale, processTurn, setError }: UseEventHandlersProps) {
  const handleEventChoice = useCallback(
    async (choiceId: string) => {
      try {
        await processTurn(`event_${choiceId}`, {
          id: `event_${choiceId}`,
          text: locale === "vi" ? "Lựa chọn sự kiện" : "Event choice",
        });
      } catch (err: any) {
        console.error("Event choice error:", err);
        setError(err.message || (locale === "vi" ? "Lỗi xử lý sự kiện" : "Event processing error"));
      }
    },
    [locale, processTurn, setError]
  );

  return {
    handleEventChoice,
  };
}
