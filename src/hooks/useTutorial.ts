import { useState, useEffect, useCallback } from "react";

export interface TutorialStep {
  id: string;
  title: string;
  title_en: string;
  content: string;
  content_en: string;
  icon: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Chào mừng đến với Tu Tiên RPG",
    title_en: "Welcome to Xianxia RPG",
    content: "Con đường tu tiên bắt đầu từ đây. Hãy cùng tìm hiểu cách chơi qua vài bước nhanh.",
    content_en: "Your cultivation journey begins here. Let's quickly learn how to play.",
    icon: "⛩️",
  },
  {
    id: "actions",
    title: "Chọn Hành Động",
    title_en: "Choose Actions",
    content:
      "Mỗi lượt, bạn sẽ thấy các lựa chọn ở tab Chơi. Mỗi lựa chọn có thể tốn thể lực, khí hoặc bạc — hãy chú ý chi phí. Bạn cũng có thể nhập hành động riêng ở cuối trang.",
    content_en:
      "Each turn, you'll see choices on the Play tab. Choices can cost stamina, qi, or silver — watch the costs. You can also type your own action at the bottom.",
    icon: "🎮",
  },
  {
    id: "cultivation",
    title: "Tu Luyện & Đột Phá",
    title_en: "Cultivation & Breakthrough",
    content:
      "Chọn hoạt động tu luyện từ bảng điều khiển phía trên để tăng tu vi. Khi đủ kinh nghiệm, bạn có thể đột phá lên cảnh giới cao hơn.",
    content_en:
      "Choose cultivation activities from the dashboard above to gain experience. When ready, you can breakthrough to a higher realm.",
    icon: "🧘",
  },
  {
    id: "tabs",
    title: "Dùng Các Tab",
    title_en: "Use the Tabs",
    content:
      "Dùng các tab ở trên (hoặc thanh điều hướng phía dưới trên điện thoại) để xem: Nhân vật, Môn Phái, Túi đồ, Chợ, và Bản đồ Thế giới.",
    content_en:
      "Use the tabs at the top (or bottom bar on mobile) to view: Character, Sect, Inventory, Market, and World Map.",
    icon: "📑",
  },
  {
    id: "world",
    title: "Khám Phá Thế Giới",
    title_en: "Explore the World",
    content:
      "Mở tab Bản đồ để di chuyển giữa các vùng, khám phá bí cảnh, và chiến đấu với kẻ thù. Mỗi vùng có nguyên tố và cấp độ nguy hiểm riêng.",
    content_en:
      "Open the World tab to travel between regions, explore dungeons, and fight enemies. Each region has its own element and danger level.",
    icon: "🗺️",
  },
];

export function useTutorial(runId: string) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const storageKey = `xianxia_tutorial_seen_${runId}`;

  useEffect(() => {
    if (!runId) return;
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        setShowTutorial(true);
        setCurrentStep(0);
      }
    } catch (err) {
      console.error("Failed to read tutorial state:", err);
    }
  }, [runId, storageKey]);

  const handleDismissTutorial = useCallback(() => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch (err) {
      console.error("Failed to save tutorial state:", err);
    }
    setShowTutorial(false);
    setCurrentStep(0);
  }, [storageKey]);

  const handleNextStep = useCallback(() => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleDismissTutorial();
    }
  }, [currentStep, handleDismissTutorial]);

  const handlePrevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleReopenTutorial = useCallback(() => {
    setCurrentStep(0);
    setShowTutorial(true);
  }, []);

  return {
    showTutorial,
    currentStep,
    totalSteps: TUTORIAL_STEPS.length,
    steps: TUTORIAL_STEPS,
    handleDismissTutorial,
    handleNextStep,
    handlePrevStep,
    handleReopenTutorial,
  };
}
