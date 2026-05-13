"use client";

import { useState } from "react";
import { supabase } from "@/lib/database/client";
import { Locale, t } from "@/lib/i18n/translations";
import { Card, Seal, Pill } from "@/components/ui";

interface LoginProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

export default function Login({ locale, onLocaleChange }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const clearAllSessions = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      supabase.auth.signOut();
      setSuccessMessage(
        locale === "vi"
          ? "Đã xóa phiên đăng nhập. Đang tải lại..."
          : "Session cleared. Reloading..."
      );
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error("Error clearing session:", err);
    }
  };

  const withTimeout = <T,>(promise: Promise<T>, ms: number, msg: string): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
    ]);

  const checkSupabaseConnectivity = async (): Promise<boolean> => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) return true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${url}/rest/v1/`, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        },
      });
      clearTimeout(timeout);
      return res.ok || res.status === 401 || res.status === 400;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    let signedIn = false;
    let signInRecoveryTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      const reachable = await checkSupabaseConnectivity();
      if (!reachable) {
        throw new Error(
          locale === "vi"
            ? "Không thể kết nối đến máy chủ. Dự án Supabase có thể đang bị tạm dừng — hãy kiểm tra bảng điều khiển Supabase."
            : "Cannot reach the server. Your Supabase project may be paused — check your Supabase dashboard to restore it."
        );
      }

      if (isSignUp) {
        const { data, error } = await withTimeout(
          supabase.auth.signUp({ email, password }),
          30000,
          locale === "vi"
            ? "Hết thời gian chờ. Máy chủ có thể đang tạm dừng — kiểm tra Supabase dashboard."
            : "Request timed out. Server may be paused — check your Supabase dashboard."
        );
        if (error) throw error;

        if (data.session) {
          signedIn = true;
          signInRecoveryTimer = setTimeout(() => window.location.reload(), 6000);
          return;
        } else {
          setSuccessMessage(
            locale === "vi"
              ? "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản."
              : "Sign up successful! Please check your email to confirm your account."
          );
          setIsSignUp(false);
        }
      } else {
        const { error } = await withTimeout(
          supabase.auth.signInWithPassword({ email, password }),
          30000,
          locale === "vi"
            ? "Hết thời gian chờ. Máy chủ có thể đang tạm dừng — kiểm tra Supabase dashboard."
            : "Request timed out. Server may be paused — check your Supabase dashboard."
        );
        if (error) throw error;
        signedIn = true;
        signInRecoveryTimer = setTimeout(() => window.location.reload(), 6000);
        return;
      }
    } catch (err: any) {
      if (!err?.message?.includes("Invalid login credentials") && !err?.status) {
        console.error("Auth error:", err);
      }
      setError(err.message || (locale === "vi" ? "Lỗi xác thực" : "Authentication error"));
    } finally {
      if (!signedIn) {
        setLoading(false);
        if (signInRecoveryTimer) clearTimeout(signInRecoveryTimer);
      }
    }
  };

  return (
    <div
      className="paper-bg"
      style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}
    >
      <span
        className="han-bg"
        style={{ fontSize: 280, top: -40, left: -30 }}
        aria-hidden
      >
        道
      </span>
      <span
        className="han-bg"
        style={{ fontSize: 280, top: -30, right: -40 }}
        aria-hidden
      >
        仙
      </span>
      <span
        className="han-bg"
        style={{ fontSize: 280, bottom: -60, left: -40 }}
        aria-hidden
      >
        修
      </span>
      <span
        className="han-bg"
        style={{ fontSize: 280, bottom: -40, right: -30 }}
        aria-hidden
      >
        緣
      </span>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 960,
          margin: "0 auto",
          padding: "48px 24px",
          minHeight: "100vh",
        }}
        className="ink-fade-in auth-grid"
      >
        {/* LEFT — Title + intro */}
        <div>
          <Seal size="lg">仙</Seal>
          <div className="label" style={{ marginTop: 18 }}>
            Hành Trình Tu Đạo
          </div>
          <h1
            className="t-han"
            style={{
              fontSize: 68,
              color: "var(--cinnabar)",
              margin: "10px 0 0",
              lineHeight: 1,
              letterSpacing: "0.04em",
            }}
          >
            修仙錄
          </h1>
          <div
            className="t-display"
            style={{ fontSize: 78, lineHeight: 1, marginTop: 6, color: "var(--ink)" }}
          >
            Tu Tiên Lục
          </div>
          <div className="brush-rule" style={{ maxWidth: 280, marginTop: 18 }} />
          <p
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-soft)",
              marginTop: 18,
              fontSize: 17,
              maxWidth: 460,
              lineHeight: 1.6,
            }}
          >
            “Đại đạo xa thẳm, một bước một bước mà nên. Ai gieo căn cơ, người sẽ gặt
            được tiên quả.”
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
            <Pill>
              <span className="t-han" style={{ color: "var(--cinnabar-deep)" }}>
                存
              </span>
              Tự động lưu hành trình
            </Pill>
            <Pill>
              <span className="t-han" style={{ color: "var(--cinnabar-deep)" }}>
                機
              </span>
              Trí huệ AI dẫn truyện
            </Pill>
            <Pill>
              <span className="t-han" style={{ color: "var(--cinnabar-deep)" }}>
                器
              </span>
              Mọi thiết bị
            </Pill>
          </div>
        </div>

        {/* RIGHT — auth card */}
        <Card padding={36} className="card-corner">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 18,
            }}
          >
            <Seal variant="ink" size="md">
              {isSignUp ? "新" : "入"}
            </Seal>
            <button
              type="button"
              onClick={() => onLocaleChange(locale === "vi" ? "en" : "vi")}
              className="ink-btn ghost sm"
              style={{ cursor: "pointer" }}
            >
              🌐 {locale === "vi" ? "EN" : "VN"}
            </button>
          </div>

          <div className="label" style={{ marginBottom: 6 }}>
            {isSignUp ? "Tạo Tài Khoản" : "Đăng Nhập"}
          </div>
          <h2
            className="t-display"
            style={{ fontSize: 32, lineHeight: 1.1, margin: 0, color: "var(--ink)" }}
          >
            {t(locale, isSignUp ? "authSignupTitle" : "authSigninTitle")}
          </h2>
          <p
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-mute)",
              marginTop: 6,
              fontSize: 14,
            }}
          >
            {t(locale, isSignUp ? "authSignupSubtitle" : "authSigninSubtitle")}
          </p>

          {successMessage && (
            <div
              style={{
                marginTop: 18,
                padding: 12,
                background: "var(--paper-deep)",
                borderLeft: "3px solid var(--jade)",
                color: "var(--jade-deep)",
                fontSize: 13,
              }}
            >
              {successMessage}
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 18,
                padding: 12,
                background: "var(--paper-deep)",
                borderLeft: "3px solid var(--cinnabar)",
                color: "var(--cinnabar-deep)",
                fontSize: 13,
              }}
            >
              <div>{error}</div>
              {(error.includes("timed out") ||
                error.includes("Hết thời gian") ||
                error.includes("Cannot reach") ||
                error.includes("Không thể kết nối")) && (
                <button
                  onClick={handleSubmit as any}
                  className="ink-btn sm cinnabar"
                  style={{ marginTop: 8 }}
                >
                  ↻ {locale === "vi" ? "Thử lại" : "Retry"}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ marginTop: 22 }}>
            <div style={{ marginBottom: 16 }}>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>
                {t(locale, "authEmailLabel")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className="t-body"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--paper)",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 2,
                  color: "var(--ink)",
                  fontSize: 15,
                  outline: "none",
                }}
                placeholder="dao.huu@thien.gioi"
                disabled={loading}
                required
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>
                {t(locale, "authPasswordLabel")}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  className="t-body"
                  style={{
                    width: "100%",
                    padding: "10px 44px 10px 12px",
                    background: "var(--paper)",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 2,
                    color: "var(--ink)",
                    fontSize: 15,
                    outline: "none",
                  }}
                  placeholder={locale === "vi" ? "Tối thiểu 6 ký tự" : "Minimum 6 characters"}
                  disabled={loading}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="t-han"
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 28,
                    height: 28,
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    color: "var(--ink-mute)",
                    fontSize: 17,
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? "閉" : "視"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="ink-btn primary"
              style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }}
            >
              <span className="t-han" style={{ fontSize: 16, color: "inherit" }}>
                {isSignUp ? "立" : "入"}
              </span>
              {loading
                ? locale === "vi"
                  ? "Đang xử lý..."
                  : "Processing..."
                : t(locale, isSignUp ? "authCtaSignup" : "authCtaSignin")}
            </button>
          </form>

          <div style={{ marginTop: 14, textAlign: "center" }}>
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
                setSuccessMessage("");
              }}
              disabled={loading}
              style={{
                background: "transparent",
                border: 0,
                fontStyle: "italic",
                fontSize: 13,
                color: "var(--ink-soft)",
                cursor: "pointer",
                borderBottom: "1px dotted var(--ink-faint)",
                padding: "2px 0",
              }}
            >
              {t(locale, isSignUp ? "authToggleToSignin" : "authToggleToSignup")}
            </button>
          </div>

          <div className="hr-soft" style={{ margin: "20px 0 14px" }} />

          <div style={{ textAlign: "center", fontSize: 13, color: "var(--ink-mute)" }}>
            {t(locale, "authOr")}{" "}
            <span
              className="t-display"
              style={{ color: "var(--cinnabar-deep)", fontStyle: "italic" }}
            >
              [{t(locale, "authGuest")}]
            </span>
          </div>
        </Card>
      </div>

      {/* Floating clear-session link */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          paddingBottom: 24,
          marginTop: -16,
        }}
      >
        <button
          onClick={clearAllSessions}
          style={{
            background: "transparent",
            border: 0,
            fontStyle: "italic",
            fontSize: 11,
            color: "var(--ink-faint)",
            cursor: "pointer",
            borderBottom: "1px dotted var(--ink-faint)",
            padding: 0,
          }}
          title={t(locale, "authClearSession")}
        >
          {t(locale, "authClearSession")}
        </button>
      </div>
    </div>
  );
}
