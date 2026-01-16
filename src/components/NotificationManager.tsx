'use client';

import { useState, useEffect } from 'react';
import { subscribeUser, unsubscribeUser } from '@/app/actions/notifications';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface NotificationManagerProps {
  userId: string;
  locale: 'vi' | 'en';
}

export default function NotificationManager({ userId, locale }: NotificationManagerProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      registerServiceWorker();
    }
    
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  async function subscribeToPush() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      
      setSubscription(sub);
      setPermission(Notification.permission);
      
      const serializedSub = JSON.parse(JSON.stringify(sub));
      await subscribeUser(userId, serializedSub);
      
      console.log('Subscribed to push notifications');
    } catch (error) {
      console.error('Failed to subscribe:', error);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribeFromPush() {
    setLoading(true);
    try {
      await subscription?.unsubscribe();
      setSubscription(null);
      await unsubscribeUser(userId);
      
      console.log('Unsubscribed from push notifications');
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!isSupported) {
    return null;
  }

  if (permission === 'denied') {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
        <p className="text-sm text-red-300">
          {locale === 'vi' 
            ? 'Thông báo đã bị chặn. Vui lòng bật lại trong cài đặt trình duyệt.' 
            : 'Notifications blocked. Please enable in browser settings.'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-xianxia-dark border border-xianxia-accent/30 rounded-lg">
      <h3 className="text-lg font-bold text-xianxia-gold mb-2">
        {locale === 'vi' ? '🔔 Thông Báo Thể Lực' : '🔔 Stamina Notifications'}
      </h3>
      
      {subscription ? (
        <>
          <p className="text-sm text-gray-300 mb-3">
            {locale === 'vi'
              ? '✅ Bạn sẽ nhận thông báo khi thể lực hồi đầy'
              : '✅ You will be notified when stamina is full'}
          </p>
          <button
            onClick={unsubscribeFromPush}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading 
              ? (locale === 'vi' ? 'Đang xử lý...' : 'Processing...')
              : (locale === 'vi' ? 'Tắt Thông Báo' : 'Turn Off')
            }
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-3">
            {locale === 'vi'
              ? 'Nhận thông báo khi thể lực hồi phục đầy để tiếp tục tu luyện!'
              : 'Get notified when your stamina is fully recovered!'}
          </p>
          <button
            onClick={subscribeToPush}
            disabled={loading}
            className="px-4 py-2 bg-xianxia-accent hover:bg-xianxia-accent/80 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading 
              ? (locale === 'vi' ? 'Đang xử lý...' : 'Processing...')
              : (locale === 'vi' ? '🔔 Bật Thông Báo' : '🔔 Enable Notifications')
            }
          </button>
        </>
      )}
    </div>
  );
}
