# Xianxia RPG - Tu Tiên Text-Based Game

A single-player text-based RPG game with cultivation/xianxia theme, powered by AI agents.

## Features

- **Single Player**: Text-based roleplay experience
- **AI-Powered Narrative**: Dynamic storytelling with AI game master
- **Bilingual**: Vietnamese (main) and English support
- **Cultivation System**: Progress from mortal to immortal
- **Deterministic RNG**: Reproducible gameplay with seeds
- **Server Authority**: All game rules enforced server-side

## Tech Stack

- **Frontend/Backend**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI API (or compatible)
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Getting Started

### 1. Clone and Install

```bash
npm install
```

### 2. Set up Supabase

1. Create a new Supabase project
2. Run the database schema (see `src/lib/database/schema.sql`)
3. Copy `.env.local.example` to `.env.local`
4. Add your Supabase credentials

### 3. Configure AI Provider

Add your OpenAI API key (or compatible provider) to `.env.local`:

```
OPENAI_API_KEY=your_key_here
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/              # Next.js App Router pages and API routes
├── components/       # React components
├── lib/
│   ├── ai/          # AI agent system
│   ├── database/    # Supabase client and queries
│   ├── game/        # Game mechanics and rules
│   └── i18n/        # Internationalization
└── types/           # TypeScript type definitions
```

## Game Mechanics

- **Cultivation Realms**: Mortal → Qi Condensation → Foundation Establishment → ...
- **Resources**: HP, Qi (Spiritual Energy), Stamina, Time
- **Spirit Roots**: Determines cultivation affinity and speed
- **Combat**: Turn-based with strategic choices
- **Encounters**: Random events based on templates
- **Progression**: Breakthrough system with requirements

## Development Principles

1. **Server is Source of Truth**: AI suggests, server validates and executes
2. **No AI Cheating**: All loot, stats, and events controlled by game rules
3. **Structured AI Output**: JSON-based responses with schema validation
4. **Memory Management**: Story summaries to reduce token usage
5. **Deterministic RNG**: Reproducible results for testing and balance

## License

Private project - All rights reserved
