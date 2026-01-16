# Email/Password Authentication Setup Guide

## Overview

Your Xianxia RPG now has email/password authentication! Users can:
- ✅ Sign up with email and password
- ✅ Sign in to access their saved game
- ✅ Play on any device (data is synced)
- ✅ Reset their game from the Profile page

---

## Step 1: Enable Email Authentication in Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Email** and make sure it's **enabled** (it should be by default)
5. Configure email settings (optional):
   - **Enable email confirmations**: Recommended for production
   - **Secure email change**: Enabled
   - **Session timeout**: Default (7 days)

---

## Step 2: Configure Email Templates (Optional)

For better user experience, customize email templates:

1. In Supabase Dashboard, go to **Authentication** → **Email Templates**
2. Edit these templates as needed:
   - **Confirm signup**: Sent when user signs up
   - **Reset password**: Sent when user requests password reset
   - **Change email**: Sent when user changes email

---

## Step 3: Run Database Migration

You need to enable authentication and RLS policies:

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `src/lib/database/migration_enable_auth.sql`
4. Paste into the SQL Editor
5. Click **Run** or press `Ctrl+Enter`
6. You should see: "Success. No rows returned"

**Note:** This migration will delete any existing test data. If you want to keep your test data, comment out the `TRUNCATE` line at the top of the migration file.

---

## Step 4: Verify Environment Variables

Your `.env.local` file should have:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Optional: Only if you have an OpenAI API key
OPENAI_API_KEY=your_openai_key
```

Get these from: Supabase Dashboard → Settings → API

---

## Step 5: Test the Application

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000 (or the port shown)

3. You should see the login screen

4. Click **"Don't have an account? Sign up"**

5. Enter an email and password (minimum 6 characters)

6. Click **Sign Up**

7. **Important**: 
   - If email confirmations are enabled, check your email and click the confirmation link
   - If disabled (for development), you'll be logged in immediately

8. Create a character and start playing!

---

## Features

### 🔐 Authentication
- Email/password sign up and sign in
- Automatic session management
- Secure cookie-based authentication
- Password reset (configurable in Supabase)

### 💾 Data Persistence
- All characters, runs, and progress saved to your account
- Play on any device - your data is synced via Supabase
- Row-level security ensures you only see your own data

### 🎮 Profile & Settings
- Access profile from the top-right button
- View your account information
- **Reset Game** feature to delete all progress and start fresh
- Sign out option

### 🌐 Multi-Device Support
- Sign in on your phone, continue on your laptop
- Automatic sync across all devices
- Real-time updates

---

## Development Tips

### Disable Email Confirmation for Testing

For faster development, you can disable email confirmations:

1. Go to Supabase Dashboard → **Authentication** → **Providers** → **Email**
2. Uncheck **"Enable email confirmations"**
3. Click **Save**

Now users will be logged in immediately after sign up without needing to confirm their email.

**Remember to re-enable this in production!**

### Test Accounts

Create test accounts with simple emails like:
- `test@test.com`
- `player1@test.com`
- `dev@test.com`

---

## Troubleshooting

### "Invalid login credentials"
- Check that you're entering the correct email and password
- Make sure you've confirmed your email if confirmations are enabled
- Passwords are case-sensitive

### "User already registered"
- This email is already in use
- Try signing in instead
- Or use a different email

### "Password should be at least 6 characters"
- Make sure your password has at least 6 characters
- Use a stronger password for better security

### Can't receive confirmation emails
- Check your spam folder
- Verify email settings in Supabase Dashboard
- For development, disable email confirmations (see above)

### "Error: Unauthorized" when creating character
- Make sure you're signed in (check for profile button in top-right)
- Try signing out and signing in again
- Check browser console for detailed errors

### Data not saving
- Check Supabase logs in Dashboard → Logs → API
- Verify RLS policies are set correctly (run migration again if needed)
- Make sure you're signed in

---

## Security Best Practices

✅ **For Production**:
- Enable email confirmations
- Use strong password requirements (configurable in Supabase)
- Enable password reset functionality
- Set up proper email delivery (configure SMTP in Supabase)
- Use HTTPS (automatic with Vercel/Netlify)

⚠️ **Never**:
- Commit `.env.local` to git
- Share your anon key publicly (it's okay for client-side, but keep service role key secret)
- Disable RLS policies in production

---

## Architecture Overview

```
┌─────────────┐
│   Browser   │
│  (Client)   │
└──────┬──────┘
       │ 1. Sign up/Sign in
       │    (email + password)
       ↓
┌─────────────┐
│   Supabase  │
│    Auth     │ ← 2. Verify credentials
└──────┬──────┘    Create user session
       │ 3. Set auth cookie
       ↓
┌─────────────┐
│  Next.js    │
│  API Routes │ ← 4. Authenticated requests
└──────┬──────┘
       │ 5. Verify user from cookie
       ↓
┌─────────────┐
│  Supabase   │
│  Database   │ ← 6. RLS checks user_id
└─────────────┘
```

**Flow:**
1. User enters email and password
2. Supabase Auth verifies credentials
3. If valid, creates user session and sets secure cookie
4. User is redirected to character creation
5. All API calls include the auth cookie
6. Database RLS policies ensure data isolation per user

---

## Next Steps

1. **Test the authentication flow**:
   - Sign up with a new account
   - Create a character
   - Sign out
   - Sign back in
   - Verify your character is still there

2. **Add OpenAI API Key** (Optional):
   - Get an API key from [OpenAI Platform](https://platform.openai.com/)
   - Add to `.env.local`: `OPENAI_API_KEY=sk-...`
   - Restart dev server
   - AI-powered storytelling will now work!

3. **Customize**:
   - Edit translations in `src/lib/i18n/translations.ts`
   - Modify colors in `tailwind.config.ts`
   - Add more scenes in `src/lib/game/scenes.ts`

4. **Deploy to Production**:
   - Deploy to Vercel, Netlify, or your preferred host
   - Enable email confirmations in Supabase
   - Configure SMTP for email delivery
   - Set environment variables in your hosting platform

---

## Support

If you run into issues:
1. Check the browser console for errors (F12)
2. Review Supabase logs in the Dashboard → Logs → Auth
3. Verify all environment variables are set correctly
4. Make sure the migration ran successfully
5. Try disabling email confirmations for testing

Enjoy your Tu Tiên journey! 🌟
