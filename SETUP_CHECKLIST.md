# Setup Checklist - Fix 401 Unauthorized Error

You're getting 401 errors because authentication is now required. Follow these steps:

## 🚨 MOST COMMON ISSUE

**Email confirmation is enabled!** This means after you sign up, you're NOT logged in until you click the link in your email.

**Quick Fix:**
1. Go to Supabase Dashboard → Authentication → Providers → Email
2. Scroll down to **"Confirm email"**
3. **UNCHECK** "Enable email confirmations"
4. Click **Save**
5. Try signing up again

---

## ✅ Step 1: Verify Supabase Configuration

Make sure your `.env.local` has:
```env
NEXT_PUBLIC_SUPABASE_URL=your_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
```

Get these from: **Supabase Dashboard** → **Settings** → **API**

## ✅ Step 2: Enable Email Authentication in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. **Authentication** → **Providers** → **Email**
4. Make sure **Email** is enabled ✓
5. **CRITICAL FOR DEVELOPMENT**: 
   - Scroll down to **"Confirm email"**
   - **UNCHECK** "Enable email confirmations"
   - Click **Save**
   
   ⚠️ **This is required!** Without this, you'll need to check your email after every signup, which is slow for testing.

## ✅ Step 3: Run Database Migration

**This is critical!** Run the migration to enable RLS policies:

1. Go to Supabase Dashboard
2. Click **SQL Editor**
3. Click **New Query**
4. Copy ALL contents from: `src/lib/database/migration_enable_auth.sql`
5. Paste into editor
6. Press **Run** (or Ctrl+Enter)
7. Should see: "Success. No rows returned"

**What this does:**
- Enables Row Level Security (RLS)
- Adds foreign key to auth.users
- Creates policies so only authenticated users can access their data

## ✅ Step 4: Restart Dev Server

After running the migration:
```bash
# Stop the dev server (Ctrl+C)
npm run dev
```

## ✅ Step 5: Test Authentication Flow

1. Open http://localhost:3001 (or your port)
2. You should see the **login screen**
3. Click **"Don't have an account? Sign up"**
4. Enter email and password (min 6 characters)
5. Click **Sign Up**
6. Since email confirmations are disabled, you'll be logged in immediately
7. Now try creating a character - should work!

---

## 🔍 Troubleshooting

### Still getting 401 after signing up?

Check the terminal/console for this log:
```
Authenticated user: your@email.com
```

If you see:
```
Session check failed - user needs to sign in
```

Then:
- Make sure you completed the sign up
- Try signing out and signing in again
- Clear browser cookies and try again
- Check browser DevTools → Application → Cookies → localhost

### Migration already ran but still errors?

The migration might have failed. Check in Supabase:
1. **SQL Editor** → Run this query:
```sql
SELECT tablename, schemaname 
FROM pg_tables 
WHERE tablename IN ('characters', 'runs', 'turn_logs');
```

2. Then check RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('characters', 'runs', 'turn_logs');
```

Should see `rowsecurity = true` for all three tables.

### Email confirmation emails going to spam?

For development, just disable email confirmations:
- Supabase Dashboard → **Authentication** → **Providers** → **Email**
- Uncheck **"Enable email confirmations"**
- Click **Save**

---

## 📝 Quick Test

After setup, test this flow:
1. Sign up with test@test.com / password123
2. Should redirect to character creation
3. Fill in name and age
4. Click "Tạo Nhân Vật" (Create Character)
5. Should generate spirit root
6. Click "Bắt Đầu Hành Trình" (Start Journey)
7. Should load game!

---

## 🚨 Common Mistakes

❌ **Forgot to run migration** → Will get 401 or foreign key errors
❌ **Email confirmations still enabled** → Need to check email after signup
❌ **Old cookies from before** → Clear browser cookies
❌ **Wrong environment variables** → Double-check .env.local
❌ **Dev server not restarted** → Restart after adding env vars

---

Need help? Check the browser console (F12) and terminal logs for detailed error messages!
