# Xianxia RPG - Complete Setup Guide

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier is fine)
- An OpenAI API key (or compatible LLM provider)

## Step 1: Install Dependencies

```bash
cd xianxia-rpg
npm install
```

## Step 2: Set Up Supabase

### 2.1 Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the database to be provisioned

### 2.2 Run the Database Schema

1. In your Supabase dashboard, go to the **SQL Editor**
2. Open the file `src/lib/database/schema.sql` from this project
3. Copy the entire content
4. Paste it into the SQL Editor and click **Run**

This will create all necessary tables, indexes, RLS policies, and functions.

### 2.3 Get Your Credentials

1. Go to **Settings** > **API** in your Supabase dashboard
2. Copy the following:
   - Project URL
   - `anon` `public` API key

## Step 3: Set Up Environment Variables

1. Copy the example environment file:

```bash
cp .env.local.example .env.local
```

2. Edit `.env.local` with your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# OpenAI
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_API_BASE=https://api.openai.com/v1

# Optional: Change AI model
AI_MODEL=gpt-4-turbo-preview
```

### Alternative AI Providers

If you're using a different LLM provider (like Azure OpenAI, Anthropic via proxy, etc.), update the `OPENAI_API_BASE` URL and ensure your API key format is correct.

## Step 4: Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 5: Test the Application

### Create a Character

1. Enter a character name (minimum 2 characters)
2. Set an age (15-100)
3. Click "Create Character"
4. You'll see your randomly generated Spirit Root
5. Click "Start Journey" to begin the game

### Play the Game

1. The AI will generate the first narrative automatically
2. Choose from 2-5 options presented
3. The game state is auto-saved after each turn
4. Switch between tabs to view:
   - **Game**: Main gameplay and narrative
   - **Character**: Detailed character stats
   - **Inventory**: Items and resources

## Project Structure

```
xianxia-rpg/
├── src/
│   ├── app/                 # Next.js app router
│   │   ├── api/            # API routes
│   │   │   ├── create-character/
│   │   │   ├── start-run/
│   │   │   ├── turn/
│   │   │   └── run/[id]/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/          # React components
│   │   ├── CharacterCreation.tsx
│   │   ├── GameScreen.tsx
│   │   ├── CharacterSheet.tsx
│   │   └── InventoryView.tsx
│   ├── lib/
│   │   ├── ai/             # AI agent system
│   │   │   ├── agent.ts    # AI API calls
│   │   │   └── prompts.ts  # Prompt generation
│   │   ├── database/       # Supabase integration
│   │   │   ├── client.ts
│   │   │   ├── queries.ts
│   │   │   └── schema.sql
│   │   ├── game/           # Game mechanics
│   │   │   ├── mechanics.ts # Core game rules
│   │   │   ├── combat.ts   # Combat system
│   │   │   ├── rng.ts      # Deterministic RNG
│   │   │   ├── loot.ts     # Loot tables
│   │   │   └── scenes.ts   # Scene templates
│   │   └── i18n/           # Internationalization
│   │       └── translations.ts
│   └── types/
│       └── game.ts         # TypeScript types
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

## Understanding the Game Architecture

### Server Authority

The server enforces all game rules:
- AI **proposes** changes via `proposed_deltas`
- Server **validates** and **applies** only legitimate changes
- All loot, stats, and events are verified against game rules

### Deterministic RNG

- Each turn uses a seed based on `world_seed + turn_number`
- This makes gameplay reproducible and testable
- Useful for debugging and balancing

### AI Integration Flow

1. **Context Building**: Recent narrative + current state → AI
2. **AI Generation**: AI returns structured JSON with narrative + choices + proposed changes
3. **Validation**: Server validates all proposed changes
4. **Application**: Server applies approved changes and updates state
5. **Storage**: State saved to Supabase

### Scene Templates

Pre-defined encounter types ensure variety and consistency:
- Exploration (gathering herbs, finding caves)
- Combat (bandits, demon beasts)
- Social (merchants, sect recruitment)
- Cultivation (training, breakthroughs)
- Rest (recovery)

## Customization

### Add New Scene Templates

Edit `src/lib/game/scenes.ts` and add to the `SCENE_TEMPLATES` array.

### Add New Loot Tables

Edit `src/lib/game/loot.ts` and add to the `LOOT_TABLES` object.

### Modify Game Balance

- Stats: `src/lib/game/mechanics.ts`
- Combat: `src/lib/game/combat.ts`
- Cultivation progression: `performBreakthrough()` in mechanics.ts

### Change AI Behavior

Edit prompts in `src/lib/ai/prompts.ts`:
- `buildSystemPrompt()`: Overall AI instructions
- `buildGameContext()`: What context is sent to AI
- `buildUserMessage()`: How user choices are formatted

### Add More Translations

Edit `src/lib/i18n/translations.ts` and add keys for both `vi` and `en`.

## Troubleshooting

### "Failed to create character"

- Check Supabase credentials in `.env.local`
- Verify database schema was run successfully
- Check browser console for errors

### "Failed to generate AI response"

- Verify OpenAI API key is correct
- Check API quota/billing
- Look at server logs for detailed error messages
- The system will use fallback responses if AI fails

### Slow AI Generation

- Consider using a faster model (e.g., `gpt-3.5-turbo`)
- Reduce context size by adjusting `getLastTurns(runId, 3)` to fewer turns

### Database Connection Errors

- Ensure Supabase project is active
- Check if RLS policies are correctly set up
- For development, you can temporarily disable RLS (not recommended for production)

## Production Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Authentication (Future Enhancement)

Currently uses anonymous users. To add proper auth:

1. Enable Supabase Auth providers
2. Replace `anonymous-user-` ID generation with real user IDs
3. Add sign-in/sign-up UI components
4. Update RLS policies if needed

## Performance Optimization

### Reduce AI Costs

- Decrease turn history sent to AI (currently 3 turns)
- Use cheaper models for simple interactions
- Implement caching for common scenarios
- Update story summary more frequently to compress history

### Database Optimization

- Add indexes for frequently queried fields
- Archive old turn logs periodically
- Consider CDN for static assets

## License

Private project - All rights reserved

## Support

For issues, check:
1. Console logs (browser and server)
2. Supabase logs
3. OpenAI API status

---

Enjoy your cultivation journey! 修仙快乐！ 🗡️✨
