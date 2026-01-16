'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/database/client';
import { User } from '@supabase/supabase-js';
import { Locale } from '@/lib/i18n/translations';

interface ProfileProps {
  locale: Locale;
  onBack: () => void;
}

export default function Profile({ locale, onBack }: ProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
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
    setError('');

    try {
      // Call API to delete all user data
      const response = await fetch('/api/reset-game', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reset game');
      }

      // Reload page to start fresh
      window.location.reload();
    } catch (err) {
      console.error('Reset error:', err);
      setError(locale === 'vi' ? 'Lỗi khi đặt lại trò chơi' : 'Error resetting game');
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-xianxia-darker">
        <div className="text-xianxia-accent">
          {locale === 'vi' ? 'Đang tải...' : 'Loading...'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-xianxia-darker p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-xianxia-accent/20 hover:bg-xianxia-accent/30 rounded-lg transition-colors"
          >
            ← {locale === 'vi' ? 'Quay lại' : 'Back'}
          </button>
          <h1 className="text-3xl font-bold text-xianxia-gold">
            {locale === 'vi' ? 'Hồ Sơ' : 'Profile'}
          </h1>
          <div className="w-24"></div>
        </div>

        {/* Profile Card */}
        <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-xianxia-gold mb-4">
            {locale === 'vi' ? 'Thông Tin Tài Khoản' : 'Account Information'}
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
                    {locale === 'vi' ? 'Tên:' : 'Name:'}
                  </span>
                  <div className="text-white mt-1">{user.user_metadata.full_name}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-xianxia-dark border border-red-500/30 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-red-400 mb-4">
            {locale === 'vi' ? 'Vùng Nguy Hiểm' : 'Danger Zone'}
          </h2>

          <div className="space-y-4">
            {/* Reset Game */}
            <div>
              <h3 className="font-medium text-white mb-2">
                {locale === 'vi' ? 'Đặt Lại Trò Chơi' : 'Reset Game'}
              </h3>
              <p className="text-gray-400 text-sm mb-3">
                {locale === 'vi'
                  ? 'Xóa tất cả nhân vật, tiến trình và bắt đầu lại từ đầu. Hành động này không thể hoàn tác.'
                  : 'Delete all characters, progress and start over from scratch. This action cannot be undone.'}
              </p>

              {error && (
                <div className="mb-3 p-3 bg-red-900/30 border border-red-500/50 rounded text-red-200 text-sm">
                  {error}
                </div>
              )}

              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={resetting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                >
                  {locale === 'vi' ? 'Đặt Lại Trò Chơi' : 'Reset Game'}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleResetGame}
                    disabled={resetting}
                    className="px-4 py-2 bg-red-700 hover:bg-red-800 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                  >
                    {resetting
                      ? locale === 'vi'
                        ? 'Đang xóa...'
                        : 'Deleting...'
                      : locale === 'vi'
                      ? 'Xác Nhận Xóa'
                      : 'Confirm Delete'}
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={resetting}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 rounded-lg text-white transition-colors"
                  >
                    {locale === 'vi' ? 'Hủy' : 'Cancel'}
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
          {locale === 'vi' ? 'Đăng Xuất' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
}
