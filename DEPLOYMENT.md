# Deployment Guide - Xianxia Tu Tiên RPG

## Free Deployment Options

### Option 1: Vercel (Recommended)

**Why Vercel:**
- Created by Next.js team, best integration
- Free tier: Unlimited deployments, 100GB bandwidth/month
- Automatic HTTPS, CDN, and serverless functions
- Instant deployments from Git

**Steps:**

1. **Push to GitHub:**
   ```bash
   cd c:\Users\HaoBui\Desktop\Hao\xianxia-rpg
   git init
   git add .
   git commit -m "Initial commit"
   # Create a repo on GitHub, then:
   git remote add origin https://github.com/YOUR_USERNAME/xianxia-rpg.git
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub
   - Click "New Project"
   - Import your `xianxia-rpg` repository
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `OPENAI_API_KEY`
   - Click "Deploy"
   - Done! Your app will be live at `https://your-project.vercel.app`

3. **Automatic Updates:**
   - Every push to `main` branch auto-deploys
   - Pull requests get preview deployments

### Option 2: Netlify

**Free Tier:** 100GB bandwidth, 300 build minutes/month

**Steps:**
1. Push code to GitHub (same as above)
2. Go to [netlify.com](https://netlify.com)
3. Sign up and "Add new site" → "Import an existing project"
4. Select your repository
5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
6. Add environment variables in site settings
7. Deploy

### Option 3: Render

**Free Tier:** 750 hours/month (enough for 1 app 24/7)

**Steps:**
1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. Create "New Web Service"
4. Connect repository
5. Settings:
   - Environment: Node
   - Build: `npm install && npm run build`
   - Start: `npm start`
6. Add environment variables
7. Deploy

## Environment Variables Required

Make sure to add these in your deployment platform:

```env
# Supabase (from your Supabase project settings)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI (from platform.openai.com)
OPENAI_API_KEY=your_openai_api_key
```

## PWA Setup (Already Done!)

Your app is now a Progressive Web App! Users can:
- Install it to their home screen (mobile/desktop)
- Use it offline (basic functionality)
- Get app-like experience

**Test PWA Locally:**
```bash
npm run build
npm start
# Open http://localhost:3000
# Look for "Install" button in browser
```

## Custom Domain (Optional)

All platforms support free custom domains:
1. Buy domain from Namecheap, Cloudflare, etc.
2. In deployment platform, go to "Domains"
3. Add your custom domain
4. Update DNS records as instructed

## Monitoring & Costs

**Free Tier Limits:**
- **Vercel:** 100GB bandwidth (good for ~10k monthly users)
- **Netlify:** 100GB bandwidth
- **Render:** App sleeps after 15min inactivity (spins up in ~30s)

**API Costs to Watch:**
- **Supabase:** Free tier: 500MB database, 2GB bandwidth
- **OpenAI:** gpt-4o-mini is very cheap (~$0.15 per 1M input tokens)

Estimated monthly cost for 1000 active users: **$0-5** (mostly OpenAI API)

## Post-Deployment Checklist

- [ ] Environment variables added
- [ ] App loads successfully
- [ ] Authentication works (Supabase connected)
- [ ] Game turns generate (OpenAI connected)
- [ ] PWA manifest shows (check browser dev tools)
- [ ] Test on mobile device
- [ ] Install to home screen works

## Troubleshooting

**Build fails:**
- Check all environment variables are set
- Ensure `.env.local` not pushed to Git (in .gitignore)
- Check build logs for TypeScript errors

**OpenAI rate limits:**
- Free tier: 200 requests/day
- Upgrade to paid: $5/month removes most limits

**Database issues:**
- Verify Supabase URL is correct
- Check service role key has proper permissions
- Monitor Supabase dashboard for connection limits

## Icons for PWA

Current icons are placeholders. Create proper icons:
1. Use [Favicon Generator](https://realfavicongenerator.net/)
2. Upload your logo/image
3. Download generated icons
4. Replace `/public/icon-192.png` and `/public/icon-512.png`

Recommended icon: 
- Design a simple "修仙" (cultivation) themed icon
- Use gold (#d4af37) on dark background
- Make it recognizable at small sizes
