"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/database/client";
import { User } from "@supabase/supabase-js";
import { Locale } from "@/lib/i18n/translations";
import { GameState } from "@/types/game";

interface ProfileProps {
  locale: Locale;
  onBack: () => void;
  state?: GameState;
}

export default function Profile({ locale, onBack, state }: ProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUser(user);
    setLoading(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleResetGame = async () => {
    if (!user) return;

    setResetting(true);
    setError("");

    try {
      // Call API to delete all user data
      const response = await fetch("/api/reset-game", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Failed to reset game");
      }

      // Reload page to start fresh
      window.location.reload();
    } catch (err) {
      console.error("Reset error:", err);
      setError(locale === "vi" ? "Lỗi khi đặt lại trò chơi" : "Error resetting game");
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-xianxia-darker">
        <div className="text-xianxia-accent">{locale === "vi" ? "Đang tải..." : "Loading..."}</div>
      </div>
    );
  }

  // Calculate game time display
  const gameYear = state?.time_year ?? 1;
  const gameMonth = state?.time_month ?? 1;
  const gameDay = state?.time_day ?? 1;

  return (
    <div className="min-h-screen bg-xianxia-darker p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-xianxia-accent/20 hover:bg-xianxia-accent/30 rounded-lg transition-colors"
          >
            ← {locale === "vi" ? "Quay lại" : "Back"}
          </button>
          <h1 className="text-3xl font-bold text-xianxia-gold">
            {locale === "vi" ? "Hồ Sơ" : "Profile"}
          </h1>
          <div className="w-24"></div>
        </div>

        {/* Character Summary (if game state available) */}
        {state && (
          <div className="bg-gradient-to-r from-xianxia-dark via-purple-900/20 to-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-xianxia-gold mb-4 flex items-center gap-2">
              🧘 {locale === "vi" ? "Thông Tin Tu Luyện" : "Cultivation Summary"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {/* Realm */}
              <div className="bg-xianxia-darker/50 rounded-lg p-3">
                <div className="text-xs text-gray-400">
                  {locale === "vi" ? "Cảnh giới" : "Realm"}
                </div>
                <div className="text-lg font-bold text-xianxia-accent">
                  {state.progress?.realm || "???"}
                </div>
                {state.progress?.realm_stage != null && state.progress.realm_stage > 0 && (
                  <div className="text-xs text-gray-300">
                    {locale === "vi" ? "Giai đoạn" : "Stage"}: {state.progress.realm_stage}
                  </div>
                )}
              </div>

              {/* Age */}
              <div className="bg-xianxia-darker/50 rounded-lg p-3">
                <div className="text-xs text-gray-400">{locale === "vi" ? "Tuổi" : "Age"}</div>
                <div className="text-lg font-bold text-white">{state.age ?? "?"}</div>
                {state.lifespan && (
                  <div className="text-xs text-gray-300">
                    {locale === "vi" ? "Tuổi thọ" : "Lifespan"}: {state.lifespan.max_lifespan}
                  </div>
                )}
              </div>

              {/* Sect */}
              <div className="bg-xianxia-darker/50 rounded-lg p-3">
                <div className="text-xs text-gray-400">{locale === "vi" ? "Môn phái" : "Sect"}</div>
                <div className="text-sm font-bold text-purple-400">
                  {state.sect_membership
                    ? locale === "vi"
                      ? state.sect_membership.sect.name
                      : state.sect_membership.sect.name_en
                    : state.sect
                      ? locale === "vi"
                        ? state.sect
                        : state.sect_en
                      : locale === "vi"
                        ? "Chưa có"
                        : "None"}
                </div>
              </div>

              {/* Region */}
              <div className="bg-xianxia-darker/50 rounded-lg p-3">
                <div className="text-xs text-gray-400">
                  {locale === "vi" ? "Vùng hiện tại" : "Current Region"}
                </div>
                <div className="text-sm font-bold text-green-400">
                  {state.travel?.current_region?.replace(/_/g, " ") || "???"}
                </div>
              </div>
            </div>

            {/* Game Stats */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                {locale === "vi" ? "📊 Thống kê" : "📊 Game Statistics"}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-xianxia-gold">{state.turn_count ?? 0}</div>
                  <div className="text-[10px] text-gray-400">
                    {locale === "vi" ? "Tổng lượt" : "Total Turns"}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-400">
                    {state.inventory?.silver ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {locale === "vi" ? "Bạc" : "Silver"}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-cyan-400">
                    {state.inventory?.spirit_stones ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {locale === "vi" ? "Linh thạch" : "Spirit Stones"}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">{state.skills?.length ?? 0}</div>
                  <div className="text-[10px] text-gray-400">
                    {locale === "vi" ? "Kỹ năng" : "Skills"}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-400">
                    {state.techniques?.length ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {locale === "vi" ? "Công pháp" : "Techniques"}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">
                    {state.inventory?.items?.length ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {locale === "vi" ? "Vật phẩm" : "Items"}
                  </div>
                </div>
              </div>
            </div>

            {/* Game Time */}
            <div className="mt-3 text-center text-xs text-gray-400">
              {locale === "vi"
                ? `Ngày ${gameDay} tháng ${gameMonth} năm ${gameYear} (trong game)`
                : `Day ${gameDay}, Month ${gameMonth}, Year ${gameYear} (in-game)`}
            </div>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-xianxia-gold mb-4">
            {locale === "vi" ? "Thông Tin Tài Khoản" : "Account Information"}
          </h2>

          {user && (
            <div className="space-y-3">
              <div>
                <span className="text-gray-400 text-sm">Email:</span>
                <div className="text-white mt-1">{user.email}</div>
              </div>

              {user.user_metadata?.full_name && (
                <div>
                  <span className="text-gray-400 text-sm">
                    {locale === "vi" ? "Tên:" : "Name:"}
                  </span>
                  <div className="text-white mt-1">{user.user_metadata.full_name}</div>
                </div>
              )}

              {user.created_at && (
                <div>
                  <span className="text-gray-400 text-sm">
                    {locale === "vi" ? "Ngày tạo tài khoản:" : "Account created:"}
                  </span>
                  <div className="text-white mt-1">
                    {new Date(user.created_at).toLocaleDateString(
                      locale === "vi" ? "vi-VN" : "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-xianxia-dark border border-red-500/30 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-red-400 mb-4">
            {locale === "vi" ? "Vùng Nguy Hiểm" : "Danger Zone"}
          </h2>

          <div className="space-y-4">
            {/* Reset Game */}
            <div>
              <h3 className="font-medium text-white mb-2">
                {locale === "vi" ? "Đặt Lại Trò Chơi" : "Reset Game"}
              </h3>
              <p className="text-gray-400 text-sm mb-3">
                {locale === "vi"
                  ? "Xóa tất cả nhân vật, tiến trình và bắt đầu lại từ đầu. Hành động này không thể hoàn tác."
                  : "Delete all characters, progress and start over from scratch. This action cannot be undone."}
              </p>

              {error && (
                <div
                  className="mb-3 p-3 bg-red-900/30 border border-red-500/50 rounded text-red-200 text-sm"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={resetting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                >
                  {locale === "vi" ? "Đặt Lại Trò Chơi" : "Reset Game"}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleResetGame}
                    disabled={resetting}
                    className="px-4 py-2 bg-red-700 hover:bg-red-800 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                  >
                    {resetting
                      ? locale === "vi"
                        ? "Đang xóa..."
                        : "Deleting..."
                      : locale === "vi"
                        ? "Xác Nhận Xóa"
                        : "Confirm Delete"}
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={resetting}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 rounded-lg text-white transition-colors"
                  >
                    {locale === "vi" ? "Hủy" : "Cancel"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full py-3 bg-xianxia-accent hover:bg-xianxia-accent/80 rounded-lg font-medium transition-colors"
        >
          {locale === "vi" ? "Đăng Xuất" : "Sign Out"}
        </button>
      </div>
    </div>
  );
}
