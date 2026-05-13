"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/database/client";
import { User } from "@supabase/supabase-js";
import { Locale } from "@/lib/i18n/translations";
import { GameState } from "@/types/game";
import {
  Card,
  Pill,
  Resource,
  SectionHead,
  Seal,
  SmallHead,
  Stat,
} from "@/components/ui";

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
      const response = await fetch("/api/reset-game", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Failed to reset game");
      window.location.reload();
    } catch (err) {
      console.error("Reset error:", err);
      setError(locale === "vi" ? "Lỗi khi đặt lại trò chơi" : "Error resetting game");
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="paper-bg"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="label" style={{ color: "var(--ink-mute)", letterSpacing: "0.2em" }}>
          {locale === "vi" ? "Đang tải…" : "Loading…"}
        </span>
      </div>
    );
  }

  const gameYear = state?.time_year ?? 1;
  const gameMonth = state?.time_month ?? 1;
  const gameDay = state?.time_day ?? 1;

  return (
    <div className="paper-bg" style={{ minHeight: "100vh", position: "relative" }}>
      <span
        className="han-bg"
        style={{ position: "absolute", top: -30, left: -20, fontSize: 280 }}
        aria-hidden
      >
        己
      </span>
      <div
        className="page-pad"
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 720,
          margin: "0 auto",
          padding: "32px 24px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
            gap: 12,
          }}
        >
          <button onClick={onBack} className="ink-btn ghost sm">
            ← {locale === "vi" ? "Quay Lại" : "Back"}
          </button>
        </div>

        <SectionHead
          han="己"
          title={locale === "vi" ? "Hồ Sơ Tu Sĩ" : "Profile"}
          subtitle={locale === "vi" ? "Lai lịch & tài khoản" : "Cultivator & account"}
        />

        {state && (
          <Card padding={26} className="card-corner" style={{ marginBottom: 18, position: "relative" }}>
            <span
              className="han-bg"
              style={{ position: "absolute", top: -16, right: -12, fontSize: 200 }}
              aria-hidden
            >
              修
            </span>
            <div style={{ position: "relative", zIndex: 1 }}>
              <SmallHead>
                {locale === "vi" ? "Thông Tin Tu Luyện" : "Cultivation Summary"}
              </SmallHead>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div className="card-inset" style={{ padding: 12, borderRadius: 3 }}>
                  <div className="label">
                    {locale === "vi" ? "Cảnh Giới" : "Realm"}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <span
                      className="t-han"
                      style={{ fontSize: 18, color: "var(--cinnabar)" }}
                    >
                      {state.progress?.realm?.charAt(0) ?? "?"}
                    </span>
                    <span
                      className="t-display"
                      style={{ fontSize: 16, color: "var(--ink)" }}
                    >
                      {state.progress?.realm ?? "???"}
                    </span>
                  </div>
                  {state.progress?.realm_stage != null && state.progress.realm_stage > 0 && (
                    <div
                      className="t-num"
                      style={{
                        fontSize: 11,
                        color: "var(--ink-mute)",
                        marginTop: 2,
                      }}
                    >
                      {locale === "vi" ? "Tầng" : "Stage"} {state.progress.realm_stage}
                    </div>
                  )}
                </div>

                <div className="card-inset" style={{ padding: 12, borderRadius: 3 }}>
                  <div className="label">
                    {locale === "vi" ? "Tuổi & Tuổi Thọ" : "Age & Lifespan"}
                  </div>
                  <div
                    className="t-num"
                    style={{ fontSize: 18, color: "var(--ink)", marginTop: 4 }}
                  >
                    {state.age ?? "?"}
                    {state.lifespan && (
                      <span style={{ color: "var(--ink-faint)", fontSize: 13 }}>
                        {" "}
                        / {state.lifespan.max_lifespan}
                      </span>
                    )}
                  </div>
                </div>

                <div className="card-inset" style={{ padding: 12, borderRadius: 3 }}>
                  <div className="label">{locale === "vi" ? "Môn Phái" : "Sect"}</div>
                  <div
                    className="t-display"
                    style={{ fontSize: 15, color: "var(--ink)", marginTop: 4 }}
                  >
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

                <div className="card-inset" style={{ padding: 12, borderRadius: 3 }}>
                  <div className="label">
                    {locale === "vi" ? "Vùng Hiện Tại" : "Current Region"}
                  </div>
                  <div
                    className="t-display"
                    style={{ fontSize: 15, color: "var(--ink)", marginTop: 4 }}
                  >
                    {state.travel?.current_region?.replace(/_/g, " ") ?? "???"}
                  </div>
                </div>
              </div>

              <div className="hr-soft" style={{ margin: "16px 0 12px" }} />
              <SmallHead>
                {locale === "vi" ? "Thống Kê" : "Statistics"}
              </SmallHead>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <Stat
                  icon="輪"
                  label={locale === "vi" ? "Lượt" : "Turns"}
                  value={state.turn_count ?? 0}
                />
                <Stat
                  icon="銀"
                  label={locale === "vi" ? "Bạc" : "Silver"}
                  value={(state.inventory?.silver ?? 0).toLocaleString()}
                />
                <Stat
                  icon="靈"
                  label={locale === "vi" ? "Linh Thạch" : "Stones"}
                  value={(state.inventory?.spirit_stones ?? 0).toLocaleString()}
                />
                <Stat
                  icon="法"
                  label={locale === "vi" ? "Công Pháp" : "Techniques"}
                  value={state.techniques?.length ?? 0}
                />
                <Stat
                  icon="技"
                  label={locale === "vi" ? "Kỹ Năng" : "Skills"}
                  value={state.skills?.length ?? 0}
                />
                <Stat
                  icon="物"
                  label={locale === "vi" ? "Vật Phẩm" : "Items"}
                  value={state.inventory?.items?.length ?? 0}
                />
              </div>

              <div
                className="t-body"
                style={{
                  textAlign: "center",
                  fontStyle: "italic",
                  color: "var(--ink-mute)",
                  fontSize: 12,
                  marginTop: 12,
                }}
              >
                {locale === "vi"
                  ? `Ngày ${gameDay} · Tháng ${gameMonth} · Năm ${gameYear} (lịch tu giới)`
                  : `Day ${gameDay} · Month ${gameMonth} · Year ${gameYear} (cultivation calendar)`}
              </div>
            </div>
          </Card>
        )}

        <Card padding={22} style={{ marginBottom: 18 }}>
          <SmallHead
            right={
              <Pill>
                <span className="t-han">入</span>
                {locale === "vi" ? "Linh Đài" : "Altar"}
              </Pill>
            }
          >
            {locale === "vi" ? "Thông Tin Tài Khoản" : "Account Information"}
          </SmallHead>
          {user && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <Stat icon="郵" label="Email" value={user.email ?? "—"} />
              {user.user_metadata?.full_name && (
                <Stat
                  icon="名"
                  label={locale === "vi" ? "Tên" : "Name"}
                  value={user.user_metadata.full_name}
                />
              )}
              {user.created_at && (
                <Stat
                  icon="始"
                  label={locale === "vi" ? "Ngày Tạo" : "Created"}
                  value={new Date(user.created_at).toLocaleDateString(
                    locale === "vi" ? "vi-VN" : "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                />
              )}
            </div>
          )}
        </Card>

        <Card
          padding={22}
          style={{
            marginBottom: 18,
            borderLeft: "3px solid var(--cinnabar)",
          }}
        >
          <SmallHead
            right={
              <Pill variant="cinnabar">
                <span className="t-han">危</span>
                {locale === "vi" ? "Nguy Hiểm" : "Danger"}
              </Pill>
            }
          >
            {locale === "vi" ? "Vùng Nguy Hiểm" : "Danger Zone"}
          </SmallHead>

          <h3
            className="t-display"
            style={{
              margin: "8px 0 6px",
              fontSize: 16,
              color: "var(--ink)",
            }}
          >
            {locale === "vi" ? "Đặt Lại Trò Chơi" : "Reset Game"}
          </h3>
          <p
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-soft)",
              fontSize: 13,
              margin: "0 0 14px",
            }}
          >
            {locale === "vi"
              ? "Xóa toàn bộ nhân vật, tiến trình, hành trang. Một khi đoạn diệt thì không thể quay đầu."
              : "Erase every character, item and chapter. Once severed, the thread cannot be re-spun."}
          </p>

          {error && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                background: "var(--paper-deep)",
                borderLeft: "3px solid var(--cinnabar)",
                color: "var(--cinnabar-deep)",
                fontSize: 13,
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={resetting}
              className="ink-btn cinnabar"
            >
              <span className="t-han">滅</span>
              {locale === "vi" ? "Đặt Lại Trò Chơi" : "Reset Game"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleResetGame}
                disabled={resetting}
                className="ink-btn cinnabar"
              >
                <span className="t-han">滅</span>
                {resetting
                  ? locale === "vi"
                    ? "Đang xóa…"
                    : "Deleting…"
                  : locale === "vi"
                    ? "Xác Nhận"
                    : "Confirm"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={resetting}
                className="ink-btn ghost"
              >
                {locale === "vi" ? "Hủy" : "Cancel"}
              </button>
            </div>
          )}
        </Card>

        <button
          onClick={handleSignOut}
          className="ink-btn"
          style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }}
        >
          <span className="t-han">出</span>
          {locale === "vi" ? "Đăng Xuất" : "Sign Out"}
        </button>
      </div>
    </div>
  );
}
