'use client';

import { useState } from 'react';
import { supabase } from '@/lib/database/client';
import { Locale } from '@/lib/i18n/translations';

interface LoginProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

export default function Login({ locale, onLocaleChange }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        // If email confirmation is disabled, the user will be logged in immediately
        // Otherwise, they need to check their email
        if (data.session) {
          // User is logged in immediately (email confirmation disabled)
          console.log('User signed up and logged in:', data.user?.email);
          // The onAuthStateChange in page.tsx will handle the redirect
        } else {
          // User needs to confirm email
          alert(
            locale === 'vi'
              ? 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.'
              : 'Sign up successful! Please check your email to confirm your account.'
          );
          setLoading(false);
        }
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        console.log('User signed in:', data.user?.email);
        // The onAuthStateChange in page.tsx will handle the redirect
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(
        err.message ||
          (locale === 'vi' ? 'Lỗi xác thực' : 'Authentication error')
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-xianxia-darker via-xianxia-dark to-xianxia-darker">
      <div className="max-w-md w-full">
        {/* Language Toggle */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => onLocaleChange(locale === 'vi' ? 'en' : 'vi')}
            className="px-4 py-2 bg-xianxia-accent/20 hover:bg-xianxia-accent/30 rounded-lg text-sm transition-colors"
          >
            {locale === 'vi' ? 'EN' : 'VN'}
          </button>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 text-xianxia-gold">
            {locale === 'vi' ? 'Tu Tiên RPG' : 'Xianxia RPG'}
          </h1>
          <p className="text-xianxia-accent text-lg">
            {locale === 'vi' ? 'Hành Trình Tu Luyện' : 'Journey of Cultivation'}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-center mb-6 text-xianxia-gold">
            {isSignUp
              ? locale === 'vi'
                ? 'Đăng Ký'
                : 'Sign Up'
              : locale === 'vi'
              ? 'Đăng Nhập'
              : 'Sign In'}
          </h2>

          <p className="text-gray-400 text-center mb-6 text-sm">
            {locale === 'vi'
              ? 'Đăng nhập để lưu tiến trình tu luyện của bạn'
              : 'Sign in to save your cultivation progress'}
          </p>

          {error && (
            <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-xianxia-darker border border-xianxia-accent/30 rounded-lg focus:outline-none focus:border-xianxia-accent"
                placeholder={locale === 'vi' ? 'email@example.com' : 'email@example.com'}
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {locale === 'vi' ? 'Mật khẩu' : 'Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-xianxia-darker border border-xianxia-accent/30 rounded-lg focus:outline-none focus:border-xianxia-accent"
                placeholder={locale === 'vi' ? 'Tối thiểu 6 ký tự' : 'Minimum 6 characters'}
                disabled={loading}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-xianxia-gold hover:bg-xianxia-gold/80 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold transition-colors text-xianxia-darker"
            >
              {loading
                ? locale === 'vi'
                  ? 'Đang xử lý...'
                  : 'Processing...'
                : isSignUp
                ? locale === 'vi'
                  ? 'Đăng Ký'
                  : 'Sign Up'
                : locale === 'vi'
                ? 'Đăng Nhập'
                : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              disabled={loading}
              className="text-sm text-xianxia-accent hover:text-xianxia-gold transition-colors"
            >
              {isSignUp
                ? locale === 'vi'
                  ? 'Đã có tài khoản? Đăng nhập'
                  : 'Already have an account? Sign in'
                : locale === 'vi'
                ? 'Chưa có tài khoản? Đăng ký'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 space-y-3 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <span className="text-xianxia-accent">✓</span>
            <span>{locale === 'vi' ? 'Lưu tiến trình tự động' : 'Auto-save progress'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xianxia-accent">✓</span>
            <span>{locale === 'vi' ? 'Chơi trên mọi thiết bị' : 'Play on any device'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xianxia-accent">✓</span>
            <span>{locale === 'vi' ? 'Kể chuyện bằng AI' : 'AI-powered storytelling'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
