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
    title: "Chào Mừng Đến Tu Tiên Lục",
    title_en: "Welcome to Tu Tiên Lục",
    content:
      "Con đường tu đạo bắt đầu từ đây. Vài bước ngắn để ngươi quen với hành trình.",
    content_en:
      "Your cultivation path begins here. A few short steps to walk the journey.",
    icon: "道",
  },
  {
    id: "actions",
    title: "Chọn Hành Động",
    title_en: "Choose Your Path",
    content:
      "Mỗi lượt trong tab Hành Trình hiện ra các lựa chọn (一/二/三/四). Một số tốn khí, lực, bạc, linh thạch hay thời thần — chú ý phí tổn. Hoặc nhập hành động riêng vào ô '或 — Tự Nói Hành Động Riêng' ở cuối.",
    content_en:
      "Each turn the Journey tab shows ordered choices (一/二/三/四). Some cost qi, stamina, silver, spirit stones, or time — watch the prices. You may also type a custom action in the '或' panel.",
    icon: "抉",
  },
  {
    id: "rail",
    title: "Cột Tu Sĩ Bên Trái",
    title_en: "The Cultivator Rail",
    content:
      "Cột bên trái (hoặc bên dưới trên điện thoại) hiển thị danh hiệu, cảnh giới hiện tại, sinh khí (HP/Khí/Thể), hoạt động đang tiến hành, và vật tài. Đó là tâm thái của ngươi.",
    content_en:
      "The left rail (or the block below the story on mobile) shows your title, current realm, vitality (HP/Qi/Stamina), any active activity, and resources. That's your living state.",
    icon: "身",
  },
  {
    id: "tabs",
    title: "Sáu Tab Chính",
    title_en: "Six Main Tabs",
    content:
      "Phía trên là sáu tab: 途 Hành Trình · 身 Tu Sĩ · 派 Môn Phái · 物 Túi Đồ · 市 Chợ · 界 Thiên Hạ. Mỗi tab có Han ghi đầu để dễ nhận.",
    content_en:
      "Six tabs sit at the top: 途 Journey · 身 Cultivator · 派 Sect · 物 Inventory · 市 Market · 界 Realm. Each one is led by its Han glyph.",
    icon: "途",
  },
  {
    id: "header",
    title: "Thanh Đầu Trang",
    title_en: "The Top Bar",
    content:
      "Góc trên bên phải có ba nút: 🌐 EN/VI để đổi ngôn ngữ, 問 ? mở lại hướng dẫn này, và 己 Hồ Sơ để xem tài khoản và đặt lại trò chơi.",
    content_en:
      "The top-right corner holds three controls: 🌐 EN/VI to switch language, 問 ? to reopen this guide, and 己 Profile for account & reset.",
    icon: "問",
  },
  {
    id: "world",
    title: "Du Hành Thiên Hạ",
    title_en: "Travel the Realm",
    content:
      "Tab 界 Thiên Hạ là bản đồ sumi-e với 5 vùng. Bấm vào một vùng kế cận để xem chi tiết rồi 行 Du Hành. Mỗi vùng có nguyên tố và cấp độ nguy hiểm riêng.",
    content_en:
      "Tab 界 Realm shows a sumi-e map with 5 regions. Tap an adjacent region for its details, then 行 Travel. Each region has its own element and danger tier.",
    icon: "界",
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
