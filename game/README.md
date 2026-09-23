# Tu Tiên Lục: Godot 4.7 + C# game

This folder holds the controllable game described in [`design/GAME_DESIGN.md`](../design/GAME_DESIGN.md). It uses Tale of Immortal's structure (a world map with a monthly footwork budget, real-time arena fights, a living NPC world and set-piece breakthroughs), plus our own pillars: the Linh Thức storyteller, Qi + Body cultivation, Ngũ Hành reactions, and karma.

It is currently a **greybox vertical slice** of the Thanh Vân region. Everything is drawn with ink-wash shapes and Han glyphs; there is no art or audio yet.

## Layout

| Path | What it is |
|---|---|
| `core/TuTien.Core/` | All game rules, engine-free (`netstandard2.1`, no Godot references): RNG, content, calendar, cultivation, elements, karma, map and footwork, month tick, NPC sim, combat rules, loot, events, saves. `GameEngine` is the single entry point. |
| `core/TuTien.Core.Tests/` | xUnit tests (87) that run the rules against the real content. |
| `godot/` | The Godot project. `scripts/World` is the map and HUD, `scripts/Arena` is real-time combat and the breakthrough trial, `scripts/Ui` holds the title screen, theme and panels, and `scripts/Dev` holds the smoke test and F9 cheats. |
| `godot/content/` | Game data as JSON. Most of it is exported from the web game's TypeScript; enemies, skills, items, towns, NPC names and the map are hand-authored. |

## Requirements

- **Godot 4.7 .NET** (the "mono" build; the standard build can't run C#)
- **.NET 8 SDK**
- Node 20+ (only for re-exporting content)

## Play

1. Open `game/godot/project.godot` in Godot 4.7 .NET.
2. Click **Build** (the hammer icon), then **Play** (F5).

You can also build from the command line with `dotnet build game/TuTienLuc.sln` and then run `godot --path game/godot`.

### Controls

**World map**

| Input | Action |
|---|---|
| WASD / arrows | Step one tile (hold to keep walking) |
| Left click | Walk a path; the footwork cost (足) is previewed on hover |
| E | Interact: enter a place, gather herbs, meet someone, attack an adjacent beast |
| N | End the month (you cultivate and the world moves) |
| B | Seclusion (bế quan): several months at ×1.6 cultivation |
| Tab | Sense pulse (thần thức): spend 10 Qi to see further |
| C / I / J | Character / Inventory / Journal (the journal has a how-to-play tab) |
| Mouse wheel | Zoom |
| Esc | System menu |
| F9 | Dev cheats |

**Combat**

| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Aim |
| Left click | Martial art (võ kỹ) |
| Right click / 1 / 2 / 3 | Your four spirit-art slots (linh kỹ); assign them in Character → Arts |
| Space / Shift | Dash with brief invulnerability |
| R | Ultimate, once killing intent (sát ý) is full |
| Q | Healing pill |
| Esc | Pause or flee |

Controllers are mapped too: left stick moves, right stick aims.

### What the slice has

- **Character creation:** name, age, a spirit root roll with 3 rerolls, and a path (Qi, Body, or Kiêm tu).
- **The Thanh Vân map (48×30):** fog of war and terrain footwork costs; the village (inn, market, bounty board), the Thanh Vân Kiếm Phái gate, the 3-floor Linh Thảo Bí Cảnh, two spirit veins and herb patches. Roaming beast packs, 25 NPCs who cultivate, feud and die month to month, a rumor feed, and 奇 adventures from the authored events.
- **Real-time combat:** six enemy archetypes (charger, swarm, ranged, tank, caster, boss), each with a readable telegraph. Every hit goes through the core's `CombatRules`. Element marks trigger the 10 Ngũ Hành reactions, and every creature reacts to its own element on a cooldown (for example, Fireball on a wood vine triggers *Liệt Diễm*). Spars end at 15% health; lethal fights and fleeing have map consequences.
- **Breakthrough trial:** *Dẫn khí nhập thể* (Mortal → Luyện Khí) is played, not rolled. Gather qi motes and avoid heart demons; the success threshold depends on your preparation. Success awakens your root's first spirit art.
- **Karma:** gifts leave ân (a debt of gratitude) and killings leave oán (a grudge). Grudges come back as ambushes.
- **Saves and language:** the game saves every month and after every fight, and Vietnamese/English can be switched anywhere.

The Linh Thức AI storyteller is **offline-only** in this slice. NPC lines, the chronicle and rumors come from templates built on the same facts the online `/api/story` endpoint will receive (§7.13).

## Test

```bash
# Rules (fast, no Godot needed)
dotnet test game/core/TuTien.Core.Tests

# Godot headless smoke test. It plays the slice end to end: map, panels, a fight,
# the breakthrough trial, a spirit-art fight, the sect trial, seclusion, and a
# save/load round trip. It exits with 0 on success and 1 on failure.
dotnet build game/TuTienLuc.sln
godot --headless --fixed-fps 60 --path game/godot -- --smoke

# The same run with screenshots (needs a display; xvfb works on CI)
xvfb-run -s "-screen 0 1600x900x24" godot --rendering-driver opengl3 --fixed-fps 60 \
  --resolution 1600x900 --path game/godot -- --smoke --shots /tmp/tutien-shots
```

The smoke test writes to its own save slot (`user://saves/smoke.json`), so it never touches your real save.

## Re-export content from the web game

```bash
npx tsx scripts/export-game-content.ts
```

This rewrites `regions`, `dungeons`, `events`, `sects`, `loot`, `sect_missions` and `progression.json` in `godot/content/`. The hand-authored files are left alone. At startup, `ContentDb.Validate()` logs the remaining content gaps, such as enemy IDs that have no catalog entry yet.

## Next

See design doc §11. The rest of M1 covers art and audio, a settings screen, more enemies and arts, and a 60-minute playtest. M2 brings the online storyteller and sect missions.
