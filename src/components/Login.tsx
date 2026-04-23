"use client";

import { useState } from "react";
import { supabase } from "@/lib/database/client";
import { Locale } from "@/lib/i18n/translations";

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
      // Clear all localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      // Sign out from Supabase
      supabase.auth.signOut();

      // Show inline success message instead of alert
      setSuccessMessage(
        locale === "vi"
          ? "Đã xóa phiên đăng nhập. Đang tải lại..."
          : "Session cleared. Reloading..."
      );

      // Reload the page after a moment
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

  // Quick connectivity check — hits the Supabase REST endpoint with a short timeout
  const checkSupabaseConnectivity = async (): Promise<boolean> => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) return true; // can't check, proceed optimistically
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
      return res.ok || res.status === 401 || res.status === 400; // any response means reachable
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    let signedIn = false;

    // If sign-in succeeds but page.tsx never transitions (query hang), self-recover
    let signInRecoveryTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      // Quick connectivity pre-check
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
      // Only log unexpected errors — credential failures are normal user-facing cases
      if (!err?.message?.includes("Invalid login credentials") && !err?.status) {
        console.error("Auth error:", err);
      }
      setError(err.message || (locale === "vi" ? "Lỗi xác thực" : "Authentication error"));
    } finally {
      // Don't reset loading if sign-in succeeded — page.tsx will redirect and unmount this component
      if (!signedIn) {
        setLoading(false);
        if (signInRecoveryTimer) clearTimeout(signInRecoveryTimer);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-xianxia-darker via-xianxia-dark to-xianxia-darker">
      <div className="max-w-md w-full">
        {/* Language Toggle */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => onLocaleChange(locale === "vi" ? "en" : "vi")}
            className="px-4 py-2 bg-xianxia-accent/20 hover:bg-xianxia-accent/30 rounded-lg text-sm transition-colors"
          >
            {locale === "vi" ? "EN" : "VN"}
          </button>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 text-xianxia-gold">
            {locale === "vi" ? "Tu Tiên RPG" : "Xianxia RPG"}
          </h1>
          <p className="text-xianxia-accent text-lg">
            {locale === "vi" ? "Hành Trình Tu Luyện" : "Journey of Cultivation"}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-center mb-6 text-xianxia-gold">
            {isSignUp
              ? locale === "vi"
                ? "Đăng Ký"
                : "Sign Up"
              : locale === "vi"
                ? "Đăng Nhập"
                : "Sign In"}
          </h2>

          <p className="text-gray-400 text-center mb-6 text-sm">
            {locale === "vi"
              ? "Đăng nhập để lưu tiến trình tu luyện của bạn"
              : "Sign in to save your cultivation progress"}
          </p>

          {successMessage && (
            <div className="mb-4 p-4 bg-green-900/30 border border-green-500/50 rounded-lg text-green-200 text-sm flex items-center gap-2">
              <span>✓</span>
              {successMessage}
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-sm">
              <p>{error}</p>
              {(error.includes("timed out") ||
                error.includes("Hết thời gian") ||
                error.includes("Cannot reach") ||
                error.includes("Không thể kết nối")) && (
                <button
                  onClick={handleSubmit as any}
                  className="mt-2 px-3 py-1 text-xs bg-red-600/30 hover:bg-red-600/50 border border-red-500/30 rounded transition-colors"
                >
                  {locale === "vi" ? "↻ Thử lại" : "↻ Retry"}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-3 bg-xianxia-darker border border-xianxia-accent/30 rounded-lg focus:outline-none focus:border-xianxia-accent"
                placeholder={locale === "vi" ? "email@example.com" : "email@example.com"}
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {locale === "vi" ? "Mật khẩu" : "Password"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  className="w-full px-4 py-3 pr-12 bg-xianxia-darker border border-xianxia-accent/30 rounded-lg focus:outline-none focus:border-xianxia-accent"
                  placeholder={locale === "vi" ? "Tối thiểu 6 ký tự" : "Minimum 6 characters"}
                  disabled={loading}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-xianxia-accent transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-xianxia-gold hover:bg-xianxia-gold/80 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold transition-colors text-xianxia-darker"
            >
              {loading
                ? locale === "vi"
                  ? "Đang xử lý..."
                  : "Processing..."
                : isSignUp
                  ? locale === "vi"
                    ? "Đăng Ký"
                    : "Sign Up"
                  : locale === "vi"
                    ? "Đăng Nhập"
                    : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
                setSuccessMessage("");
              }}
              disabled={loading}
              className="text-sm text-xianxia-accent hover:text-xianxia-gold transition-colors"
            >
              {isSignUp
                ? locale === "vi"
                  ? "Đã có tài khoản? Đăng nhập"
                  : "Already have an account? Sign in"
                : locale === "vi"
                  ? "Chưa có tài khoản? Đăng ký"
                  : "Don't have an account? Sign up"}
            </button>
          </div>

          {/* Clear Session Button */}
          <div className="mt-4 text-center">
            <button
              onClick={clearAllSessions}
              className="text-xs text-gray-500 hover:text-xianxia-accent transition-colors"
              title={locale === "vi" ? "Xóa phiên đăng nhập cũ" : "Clear old session"}
            >
              {locale === "vi" ? "🔄 Xóa phiên cũ" : "🔄 Clear old session"}
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 space-y-3 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <span className="text-xianxia-accent">✓</span>
            <span>{locale === "vi" ? "Lưu tiến trình tự động" : "Auto-save progress"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xianxia-accent">✓</span>
            <span>{locale === "vi" ? "Chơi trên mọi thiết bị" : "Play on any device"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xianxia-accent">✓</span>
            <span>{locale === "vi" ? "Kể chuyện bằng AI" : "AI-powered storytelling"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
