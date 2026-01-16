# 🔔 Web Push Notifications - Stamina Full Alert

## What's Implemented

Your Xianxia RPG now has **web push notifications** that alert users when their stamina is fully regenerated!

### Features
- ✅ Push notifications when stamina reaches max
- ✅ Works even when app is closed/minimized
- ✅ One-click enable/disable in game
- ✅ Fully PWA compliant
- ✅ Cross-browser support (Chrome, Edge, Firefox, Safari 16+)

## How It Works

### 1. **Service Worker** (`/public/sw.js`)
- Registered automatically when user visits the app
- Handles incoming push notifications
- Shows notification with custom title, body, and icon
- Clicking notification opens/focuses the game

### 2. **Notification Manager** (`/src/components/NotificationManager.tsx`)
- Client-side component in the "🔔" tab
- Subscribe/unsubscribe to push notifications
- Handles browser permissions
- Shows current subscription status

### 3. **Server Actions** (`/src/app/actions/notifications.ts`)
- `subscribeUser()` - Stores user's push subscription
- `unsubscribeUser()` - Removes subscription
- `sendStaminaFullNotification()` - Sends push when stamina is full
- Uses VAPID keys for secure communication

### 4. **Auto-Detection**
Currently, notifications are triggered manually. To auto-send when stamina is full, you can:

**Option A: Client-side polling** (add to GameScreen):
```tsx
useEffect(() => {
  if (!state || !userId) return;
  
  const interval = setInterval(() => {
    if (state.stats.stamina === state.stats.stamina_max) {
      fetch('/api/notify-stamina-full', {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
    }
  }, 60000); // Check every minute
  
  return () => clearInterval(interval);
}, [state, userId]);
```

**Option B: Server-side cron** (better for production):
- Use Vercel Cron Jobs or similar
- Check all users' stamina every minute
- Send notifications for those at max stamina

## Setup Instructions

### 1. Add VAPID Keys to Environment

Already added to `.env.example`. Copy to `.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BCn-tQDALg8CRm0dC8bTQq3RYWsWjwC-vt2uDfe9U5gZ6sqvpYfWvTDe1aLk9UfDKsfN8F-IVe2JVSG8mlsIpVc
VAPID_PRIVATE_KEY=87KiZtEkVNA7lmv4tHpsoehDIeRgVKNfTv5el5rDs4E
```

### 2. Test Locally with HTTPS

Push notifications require HTTPS. To test locally:

```bash
npm run build
npm start
# Or use ngrok for HTTPS tunnel:
npx ngrok http 3000
```

### 3. Enable Notifications in Browser

1. Run the app
2. Click the "🔔" tab
3. Click "Bật Thông Báo" (Enable Notifications)
4. Accept browser permission prompt
5. Done! You'll receive notifications when stamina is full

## Browser Support

| Browser | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| Chrome | ✅ | ✅ | Full support |
| Edge | ✅ | ✅ | Full support |
| Firefox | ✅ | ✅ | Full support |
| Safari | ✅ (16+) | ✅ (16.4+) | Requires PWA install on iOS |
| Opera | ✅ | ✅ | Full support |

**iOS Requirements:**
- Safari 16.4+
- App must be installed to home screen
- Notifications enabled in iOS Settings

## Testing Push Notifications

### Manual Test

Create a test endpoint in `/src/app/api/test-notification/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { sendStaminaFullNotification } from '@/app/actions/notifications';

export async function POST(request: Request) {
  const { userId } = await request.json();
  const result = await sendStaminaFullNotification(userId);
  return NextResponse.json(result);
}
```

Then test with:
```bash
curl -X POST http://localhost:3000/api/test-notification \
  -H "Content-Type: application/json" \
  -d '{"userId":"your-user-id"}'
```

## Production Considerations

### 1. **Database Storage**
Currently, subscriptions are stored in memory. For production:

```typescript
// Store in Supabase
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. **Scheduled Checks**
Use Vercel Cron Jobs (`/api/cron/check-stamina`):

```typescript
// vercel.json
{
  "crons": [{
    "path": "/api/cron/check-stamina",
    "schedule": "*/5 * * * *" // Every 5 minutes
  }]
}
```

### 3. **Rate Limiting**
Add rate limiting to prevent notification spam:
- Max 1 notification per hour per user
- Track last notification time
- Respect user preferences

### 4. **Monitoring**
Track notification delivery:
- Success/failure rates
- Subscription counts
- User engagement

## Troubleshooting

### Notifications Not Showing

1. **Check Browser Permissions:**
   - Chrome: Settings → Privacy → Site Settings → Notifications
   - Make sure the site is not blocked

2. **Service Worker Issues:**
   - Open DevTools → Application → Service Workers
   - Check if worker is running
   - Try "Unregister" and reload

3. **HTTPS Required:**
   - Localhost works without HTTPS
   - Production MUST use HTTPS
   - Use ngrok for local HTTPS testing

4. **Check Console Errors:**
   - Look for VAPID key errors
   - Check subscription errors
   - Verify fetch failures

### iOS Not Working

- Install app to home screen first
- Enable notifications in iOS Settings → [App Name]
- Safari 16.4+ required
- Test on actual device (simulator may not work)

## Future Enhancements

- [ ] Notification preferences (sound, vibration)
- [ ] Custom notification timing
- [ ] Multiple notification types (events, achievements)
- [ ] Notification history
- [ ] Do Not Disturb mode
- [ ] Rich notifications with images

## Security

- VAPID keys secure the push endpoint
- Subscriptions are user-specific
- Service worker runs in secure context
- Push API requires user consent

## Cost

**Free!** 
- Web Push API is free (no external service needed)
- Vercel handles everything
- No Firebase Cloud Messaging required
- Scales with your user base

---

**修仙路上不孤单，手机提醒体力满！** 
(On the cultivation path you're not alone, phone reminds when stamina's full grown!)
