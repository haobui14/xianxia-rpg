'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/database/client';
import { User } from '@supabase/supabase-js';
import Login from '@/components/Login';
import CharacterCreation from '@/components/CharacterCreation';
import GameScreen from '@/components/GameScreen';
import Profile from '@/components/Profile';

type Screen = 'login' | 'character' | 'game' | 'profile';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('login');
  const [locale, setLocale] = useState<'vi' | 'en'>('vi');
  const [gameState, setGameState] = useState<{
    characterId: string;
    runId: string;
  } | null>(null);

  useEffect(() => {
    // Check auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setScreen(session?.user ? 'character' : 'login');
      setLoading(false);
    });

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setScreen(session?.user ? 'character' : 'login');
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGameStart = (characterId: string, runId: string, gameLocale: 'vi' | 'en') => {
    setGameState({ characterId, runId });
    setLocale(gameLocale);
    setScreen('game');
  };

  const handleBackToCharacter = () => {
    setGameState(null);
    setScreen('character');
  };

  const handleShowProfile = () => {
    setScreen('profile');
  };

  const handleBackFromProfile = () => {
    setScreen('character');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-xianxia-darker flex items-center justify-center">
        <div className="text-xianxia-accent text-xl">
          {locale === 'vi' ? 'Đang tải...' : 'Loading...'}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-xianxia-darker">
      {screen === 'login' && (
        <Login locale={locale} onLocaleChange={setLocale} />
      )}

      {screen === 'character' && user && (
        <div>
          <div className="flex justify-end p-4">
            <button
              onClick={handleShowProfile}
              className="px-4 py-2 bg-xianxia-accent/20 hover:bg-xianxia-accent/30 rounded-lg transition-colors"
            >
              {locale === 'vi' ? 'Hồ Sơ' : 'Profile'}
            </button>
          </div>
          <CharacterCreation onGameStart={handleGameStart} />
        </div>
      )}

      {screen === 'game' && gameState && (
        <div>
          <div className="flex justify-between p-4">
            <button
              onClick={handleBackToCharacter}
              className="px-4 py-2 bg-xianxia-accent/20 hover:bg-xianxia-accent/30 rounded-lg transition-colors"
            >
              ← {locale === 'vi' ? 'Quay lại' : 'Back'}
            </button>
            <button
              onClick={handleShowProfile}
              className="px-4 py-2 bg-xianxia-accent/20 hover:bg-xianxia-accent/30 rounded-lg transition-colors"
            >
              {locale === 'vi' ? 'Hồ Sơ' : 'Profile'}
            </button>
          </div>
          <GameScreen runId={gameState.runId} locale={locale} userId={user?.id} />
        </div>
      )}

      {screen === 'profile' && (
        <Profile locale={locale} onBack={handleBackFromProfile} />
      )}
    </main>
  );
}
