import { useState, useEffect, useRef, useCallback } from "react";
import { GameState, ValidatedTurnResult, Realm, Choice } from "@/types/game";
import { getBreakthroughBonuses } from "@/lib/game/breakthrough";
import { BreakthroughEvent } from "@/components/BreakthroughModal";

interface UseGameStateProps {
  runId: string;
  locale: "vi" | "en";
}

export function useGameState({ runId, locale }: UseGameStateProps) {
  const [state, setState] = useState<GameState | null>(null);
  const [narrative, setNarrative] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string>("");
  const [breakthroughEvent, setBreakthroughEvent] = useState<BreakthroughEvent | null>(null);
  const [previousExp, setPreviousExp] = useState<number | undefined>(undefined);
  const [lastTurnEvents, setLastTurnEvents] = useState<any[]>([]);

  // stateRef mirrors state so processTurn can read the latest value without needing state in its deps
  const saveStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firstTurnStartedRef = useRef(false);
  const previousRealmRef = useRef<{ realm: Realm; stage: number } | null>(null);
  const stateRef = useRef<GameState | null>(null);

  const loadRun = useCallback(async () => {
    try {
      console.log("Loading run:", runId);
      const response = await fetch(`/api/run/${runId}`);
      if (!response.ok) throw new Error("Failed to load run");

      const data = await response.json();
      console.log("Loaded run data:", data.run.current_state);

      // Regenerate stamina based on real-time elapsed
      const loadedState = data.run.current_state;
      if (
        loadedState.last_stamina_regen &&
        loadedState.stats.stamina < loadedState.stats.stamina_max
      ) {
        const now = new Date();
        const lastRegen = new Date(loadedState.last_stamina_regen);
        const minutesElapsed = Math.floor((now.getTime() - lastRegen.getTime()) / 60000);

        if (minutesElapsed > 0) {
          const staminaToRegen = Math.min(
            minutesElapsed,
            loadedState.stats.stamina_max - loadedState.stats.stamina
          );
          loadedState.stats.stamina += staminaToRegen;
          loadedState.last_stamina_regen = now.toISOString();
          console.log(`Regenerated ${staminaToRegen} stamina (${minutesElapsed} minutes elapsed)`);

          // Save updated state
          await fetch(`/api/run/${runId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state: loadedState }),
          });
        }
      }

      setState(loadedState);
      stateRef.current = loadedState;

      // If game has already started, load the last turn's narrative and choices
      if (data.run.current_state.turn_count > 0) {
        const turnLogResponse = await fetch(`/api/turn-log/${runId}/last`);
        if (turnLogResponse.ok) {
          const turnLog = await turnLogResponse.json();
          console.log("Loaded last turn:", turnLog);
          setNarrative(turnLog.narrative);
          if (turnLog.ai_json?.choices) {
            setChoices(turnLog.ai_json.choices);
          }
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Load run error:", err);
      setError("Failed to load game");
      setLoading(false);
    }
  }, [runId]);

  const processTurn = useCallback(
    async (choiceId: string | null, selectedChoice?: any) => {
      setProcessing(true);
      setError("");
      setSaveStatus("saving");

      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }

      const currentState = stateRef.current;
      if (currentState) {
        setPreviousExp(currentState.progress.cultivation_exp);
        previousRealmRef.current = {
          realm: currentState.progress.realm,
          stage: currentState.progress.realm_stage,
        };
      }

      try {
        const response = await fetch("/api/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ runId, choiceId, selectedChoice }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to process turn");
        }

        const result: ValidatedTurnResult = await response.json();

        if (process.env.NODE_ENV === "development") {
          console.log("Turn result:", result);
        }

        // Check for breakthrough event
        if (previousRealmRef.current) {
          const prevRealm = previousRealmRef.current.realm;
          const prevStage = previousRealmRef.current.stage;
          const newRealm = result.state.progress.realm;
          const newStage = result.state.progress.realm_stage;

          if (prevRealm !== newRealm || (prevRealm === newRealm && newStage > prevStage)) {
            const isRealmChange = prevRealm !== newRealm;
            const statIncreases = getBreakthroughBonuses(isRealmChange, prevRealm);

            const breakthroughData: BreakthroughEvent = {
              previousRealm: prevRealm,
              previousStage: prevStage,
              newRealm: newRealm,
              newStage: newStage,
              statIncreases,
            };

            setBreakthroughEvent(breakthroughData);
          }
        }

        setState(result.state);
        stateRef.current = result.state;
        setNarrative(result.narrative);
        setChoices(result.choices || []);
        setLastTurnEvents(result.events || []);

        // Handle save status from API response
        if (result.saveStatus) {
          if (result.saveStatus.success) {
            setSaveStatus("saved");
            setSaveError("");
            saveStatusTimeoutRef.current = setTimeout(() => {
              setSaveStatus("idle");
            }, 3000);
          } else {
            setSaveStatus("error");
            setSaveError(result.saveStatus.error || "Unknown save error");
            saveStatusTimeoutRef.current = setTimeout(() => {
              setSaveStatus("idle");
              setSaveError("");
            }, 10000);
          }
        } else {
          setSaveStatus("saved");
          saveStatusTimeoutRef.current = setTimeout(() => {
            setSaveStatus("idle");
          }, 3000);
        }
      } catch (err: any) {
        console.error("Turn error:", err);
        setError(err.message || (locale === "vi" ? "Lỗi xử lý lượt" : "Failed to process turn"));
        setSaveStatus("error");
        setSaveError(err.message);

        saveStatusTimeoutRef.current = setTimeout(() => {
          setSaveStatus("idle");
          setSaveError("");
        }, 3000);
      } finally {
        setProcessing(false);
      }
    },
    [runId, locale]
  );

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  // Keep stateRef in sync with state (covers external setState calls from child hooks)
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    console.log("State changed:", state);
    if (state && state.turn_count === 0 && !firstTurnStartedRef.current) {
      firstTurnStartedRef.current = true;
      console.log("Starting first turn for run:", runId);
      processTurn(null);
    } else {
      console.log("Not starting turn:", {
        hasState: !!state,
        turnCount: state?.turn_count,
        alreadyStarted: firstTurnStartedRef.current,
      });
    }
  }, [state, runId, processTurn]); // processTurn is now stable (locale/runId deps only), won't trigger extra re-runs

  return {
    state,
    setState,
    narrative,
    setNarrative,
    choices,
    setChoices,
    loading,
    setLoading,
    processing,
    setProcessing,
    error,
    setError,
    saveStatus,
    setSaveStatus,
    saveError,
    setSaveError,
    breakthroughEvent,
    setBreakthroughEvent,
    previousExp,
    processTurn,
    lastTurnEvents,
    setLastTurnEvents,
  };
}
