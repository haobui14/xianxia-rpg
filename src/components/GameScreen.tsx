'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Choice, ValidatedTurnResult } from '@/types/game';
import { t, Locale } from '@/lib/i18n/translations';
import CharacterSheet from './CharacterSheet';
import InventoryView from './InventoryView';
import MarketView from './MarketView';
import NotificationManager from './NotificationManager';

interface GameScreenProps {
  runId: string;
  locale: Locale;
  userId?: string;
}

export default function GameScreen({ runId, locale, userId }: GameScreenProps) {
  const [state, setState] = useState<GameState | null>(null);
  const [narrative, setNarrative] = useState('');
  const [choices, setChoices] = useState<Choice[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'game' | 'character' | 'inventory' | 'market' | 'notifications'>('game');
  const firstTurnStartedRef = useRef(false);
  const lastNotificationRef = useRef<number>(0);
  const previousStaminaRef = useRef<number>(0);

  const processTurn = useCallback(async (choiceId: string | null, selectedChoice?: Choice) => {
    setProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, choiceId, selectedChoice }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process turn');
      }

      const result: ValidatedTurnResult = await response.json();
      console.log('Turn result:', result);
      setState(result.state);
      setNarrative(result.narrative);
      setChoices(result.choices);
    } catch (err) {
      console.error('Turn error:', err);
      setError(locale === 'vi' ? 'Lỗi xử lý lượt chơi' : 'Error processing turn');
    } finally {
      setProcessing(false);
    }
  }, [runId, locale]);

  const handleEquipItem = useCallback(async (itemId: string, action: 'equip' | 'unequip') => {
    try {
      const response = await fetch('/api/equip-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, action }),
      });

      if (!response.ok) {
        throw new Error('Failed to equip/unequip item');
      }

      const result = await response.json();
      setState(result.state);
    } catch (err) {
      console.error('Equip error:', err);
      setError(locale === 'vi' ? 'Lỗi trang bị' : 'Error equipping item');
    }
  }, [locale]);

  const handleMarketAction = useCallback(async (itemId: string, action: 'buy' | 'sell') => {
    try {
      const response = await fetch('/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, action }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete transaction');
      }

      const result = await response.json();
      setState(result.state);
    } catch (err: any) {
      console.error('Market error:', err);
      setError(err.message || (locale === 'vi' ? 'Lỗi giao dịch' : 'Transaction error'));
    }
  }, [locale]);

  const handleDiscardItem = useCallback(async (itemId: string, quantity: number) => {
    try {
      const response = await fetch('/api/discard-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, quantity }),
      });

      if (!response.ok) {
        throw new Error('Failed to discard item');
      }

      const result = await response.json();
      setState(result.state);
    } catch (err) {
      console.error('Discard error:', err);
      setError(locale === 'vi' ? 'Lỗi vứt vật phẩm' : 'Error discarding item');
    }
  }, [locale]);

  const loadRun = useCallback(async () => {
    try {
      console.log('Loading run:', runId);
      const response = await fetch(`/api/run/${runId}`);
      if (!response.ok) throw new Error('Failed to load run');

      const data = await response.json();
      console.log('Loaded run data:', data.run.current_state);
      
      // Regenerate stamina based on real-time elapsed
      const loadedState = data.run.current_state;
      if (loadedState.last_stamina_regen && loadedState.stats.stamina < loadedState.stats.stamina_max) {
        const now = new Date();
        const lastRegen = new Date(loadedState.last_stamina_regen);
        const minutesElapsed = Math.floor((now.getTime() - lastRegen.getTime()) / 60000);
        
        if (minutesElapsed > 0) {
          const staminaToRegen = Math.min(minutesElapsed, loadedState.stats.stamina_max - loadedState.stats.stamina);
          loadedState.stats.stamina += staminaToRegen;
          loadedState.last_stamina_regen = now.toISOString();
          console.log(`Regenerated ${staminaToRegen} stamina (${minutesElapsed} minutes elapsed)`);
          
          // Save updated state
          await fetch(`/api/run/${runId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: loadedState }),
          });
        }
      }
      
      setState(loadedState);
      
      // If game has already started, load the last turn's narrative and choices
      if (data.run.current_state.turn_count > 0) {
        const turnLogResponse = await fetch(`/api/turn-log/${runId}/last`);
        if (turnLogResponse.ok) {
          const turnLog = await turnLogResponse.json();
          console.log('Loaded last turn:', turnLog);
          setNarrative(turnLog.narrative);
          if (turnLog.ai_json?.choices) {
            setChoices(turnLog.ai_json.choices);
          }
        }
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Load run error:', err);
      setError('Failed to load game');
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  useEffect(() => {
    console.log('State changed:', state);
    if (state && state.turn_count === 0 && !firstTurnStartedRef.current) {
      // Start first turn automatically (only once)
      firstTurnStartedRef.current = true;
      console.log('Starting first turn for run:', runId);
      processTurn(null);
    } else {
      console.log('Not starting turn:', {
        hasState: !!state,
        turnCount: state?.turn_count,
        alreadyStarted: firstTurnStartedRef.current
      });
    }
  }, [state, runId, processTurn]);
  // Check for full stamina and send notification
  useEffect(() => {
    if (!state || !userId) return;

    const checkStamina = async () => {
      const isStaminaFull = state.stats.stamina === state.stats.stamina_max;
      const wasStaminaNotFull = previousStaminaRef.current < state.stats.stamina_max;
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      
      // Send notification if:
      // 1. Stamina just became full (wasn't full before)
      // 2. Haven't sent notification in last hour
      if (isStaminaFull && wasStaminaNotFull && lastNotificationRef.current < oneHourAgo) {
        try {
          const response = await fetch('/api/notify-stamina-full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
          
          if (response.ok) {
            console.log('Stamina full notification sent');
            lastNotificationRef.current = now;
          }
        } catch (error) {
          console.error('Failed to send stamina notification:', error);
        }
      }
      
      previousStaminaRef.current = state.stats.stamina;
    };

    // Check immediately
    checkStamina();
    
    // Check every minute
    const interval = setInterval(checkStamina, 60000);
    
    return () => clearInterval(interval);
  }, [state?.stats.stamina, state?.stats.stamina_max, userId]);
  const handleChoice = async (choiceId: string) => {
    const selectedChoice = choices.find(c => c.id === choiceId);
    
    // Check if can afford the cost
    if (selectedChoice?.cost && state) {
      if (selectedChoice.cost.stamina && state.stats.stamina < selectedChoice.cost.stamina) {
        setError(locale === 'vi' ? 'Không đủ Thể Lực!' : 'Not enough Stamina!');
        return;
      }
      if (selectedChoice.cost.qi && state.stats.qi < selectedChoice.cost.qi) {
        setError(locale === 'vi' ? 'Không đủ Linh Lực!' : 'Not enough Qi!');
        return;
      }
      if (selectedChoice.cost.silver && state.inventory.silver < selectedChoice.cost.silver) {
        setError(locale === 'vi' ? 'Không đủ Bạc!' : 'Not enough Silver!');
        return;
      }
      if (selectedChoice.cost.spirit_stones && state.inventory.spirit_stones < selectedChoice.cost.spirit_stones) {
        setError(locale === 'vi' ? 'Không đủ Linh Thạch!' : 'Not enough Spirit Stones!');
        return;
      }
    }
    
    await processTurn(choiceId, selectedChoice);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">{t(locale, 'loading')}</div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-500">{error || t(locale, 'error')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header with tabs */}
        <div className="mb-6 flex gap-2 border-b border-xianxia-accent/30 pb-2">
          <button
            onClick={() => setActiveTab('game')}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === 'game'
                ? 'bg-xianxia-accent text-white'
                : 'bg-xianxia-dark hover:bg-xianxia-accent/20'
            }`}
          >
            {t(locale, 'tabGame')}
          </button>
          <button
            onClick={() => setActiveTab('character')}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === 'character'
                ? 'bg-xianxia-accent text-white'
                : 'bg-xianxia-dark hover:bg-xianxia-accent/20'
            }`}
          >
            {t(locale, 'tabCharacter')}
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === 'inventory'
                ? 'bg-xianxia-accent text-white'
                : 'bg-xianxia-dark hover:bg-xianxia-accent/20'
            }`}
          >
            {t(locale, 'tabInventory')}
          </button>
          <button            onClick={() => setActiveTab('market')}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === 'market'
                ? 'bg-xianxia-accent text-white'
                : 'bg-xianxia-dark hover:bg-xianxia-accent/20'
            }`}
          >
            {locale === 'vi' ? 'Chợ' : 'Market'}
          </button>
          <button            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === 'notifications'
                ? 'bg-xianxia-accent text-white'
                : 'bg-xianxia-dark hover:bg-xianxia-accent/20'
            }`}
          >
            🔔
          </button>
        </div>

        {/* Content */}
        {activeTab === 'game' && (
          <div className="space-y-6">
            {/* Quick Stats Bar */}
            <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">HP: </span>
                  <span className="font-medium text-red-400">
                    {state.stats.hp}/{state.stats.hp_max}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">{t(locale, 'qi')}: </span>
                  <span className="font-medium text-blue-400">
                    {state.stats.qi}/{state.stats.qi_max}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">{t(locale, 'stamina')}: </span>
                  <span className="font-medium text-green-400">
                    {state.stats.stamina}/{state.stats.stamina_max}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">{t(locale, 'cultivation')}: </span>
                  <span className="font-medium text-xianxia-gold">
                    {t(locale, state.progress.realm)} {state.progress.realm_stage}
                  </span>
                </div>
              </div>
            </div>

            {/* Narrative */}
            <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
              <div className="prose prose-invert max-w-none">
                {narrative ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{narrative}</p>
                ) : (
                  <p className="text-gray-500 italic">
                    {processing 
                      ? (locale === 'vi' ? 'Đang tạo câu chuyện...' : 'Generating story...')
                      : (locale === 'vi' ? 'Bắt đầu cuộc phiêu lưu...' : 'Start your adventure...')
                    }
                  </p>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200">
                {error}
              </div>
            )}

            {/* Choices */}
            {!processing && choices.length > 0 && (
              <div className="space-y-3">
                {choices.map((choice) => {
                  const canAfford = !choice.cost || (
                    (!choice.cost.stamina || (state && state.stats.stamina >= choice.cost.stamina)) &&
                    (!choice.cost.qi || (state && state.stats.qi >= choice.cost.qi)) &&
                    (!choice.cost.silver || (state && state.inventory.silver >= choice.cost.silver)) &&
                    (!choice.cost.spirit_stones || (state && state.inventory.spirit_stones >= choice.cost.spirit_stones))
                  );
                  
                  return (
                    <button
                      key={choice.id}
                      onClick={() => handleChoice(choice.id)}
                      disabled={processing || !canAfford}
                      className={`w-full text-left p-4 border rounded-lg transition-colors ${
                        !canAfford
                          ? 'bg-red-900/20 border-red-500/30 opacity-60 cursor-not-allowed'
                          : 'bg-xianxia-accent/10 hover:bg-xianxia-accent/20 border-xianxia-accent/30'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="font-medium">{choice.text}</div>
                      {choice.cost && (
                        <div className="text-sm mt-1 flex flex-wrap gap-2">
                          {choice.cost.stamina && (
                            <span className={state && state.stats.stamina < choice.cost.stamina ? 'text-red-400' : 'text-gray-400'}>
                              {t(locale, 'stamina')}: {choice.cost.stamina}
                            </span>
                          )}
                          {choice.cost.qi && (
                            <span className={state && state.stats.qi < choice.cost.qi ? 'text-red-400' : 'text-gray-400'}>
                              {t(locale, 'qi')}: {choice.cost.qi}
                            </span>
                          )}
                          {choice.cost.silver && (
                            <span className={state && state.inventory.silver < choice.cost.silver ? 'text-red-400' : 'text-gray-400'}>
                              {t(locale, 'silver')}: {choice.cost.silver}
                            </span>
                          )}
                          {choice.cost.spirit_stones && (
                            <span className={state && state.inventory.spirit_stones < choice.cost.spirit_stones ? 'text-red-400' : 'text-gray-400'}>
                              {t(locale, 'spiritStones')}: {choice.cost.spirit_stones}
                            </span>
                          )}
                          {choice.cost.time_segments && (
                            <span className="text-gray-400">
                              Time: {choice.cost.time_segments}
                            </span>
                          )}
                        </div>
                      )}
                      {!canAfford && (
                        <div className="text-xs text-red-400 mt-1">
                          {locale === 'vi' ? '(Không đủ điều kiện)' : '(Cannot afford)'}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {processing && (
              <div className="p-4 bg-xianxia-accent/10 border border-xianxia-accent/30 rounded-lg text-center text-xianxia-accent">
                {locale === 'vi' ? 'Đang xử lý lượt chơi...' : 'Processing turn...'}
              </div>
            )}
          </div>
        )}

        {activeTab === 'character' && <CharacterSheet state={state} locale={locale} />}
        {activeTab === 'inventory' && <InventoryView state={state} locale={locale} onEquipItem={handleEquipItem} onDiscardItem={handleDiscardItem} />}
        {activeTab === 'market' && <MarketView state={state} locale={locale} onBuyItem={(id) => handleMarketAction(id, 'buy')} onSellItem={(id) => handleMarketAction(id, 'sell')} />}
        {activeTab === 'notifications' && userId && (
          <NotificationManager userId={userId} locale={locale} />
        )}
      </div>
    </div>
  );
}
