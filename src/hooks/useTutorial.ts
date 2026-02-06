import { useState, useEffect } from "react";

export function useTutorial(runId: string) {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (!runId) return;
    try {
      const key = `xianxia_tutorial_seen_${runId}`;
      const seen = localStorage.getItem(key);
      if (!seen) {
        setShowTutorial(true);
      }
    } catch (err) {
      console.error("Failed to read tutorial state:", err);
    }
  }, [runId]);

  const handleDismissTutorial = () => {
    try {
      const key = `xianxia_tutorial_seen_${runId}`;
      localStorage.setItem(key, "1");
    } catch (err) {
      console.error("Failed to save tutorial state:", err);
    }
    setShowTutorial(false);
  };

  return {
    showTutorial,
    handleDismissTutorial,
  };
}
