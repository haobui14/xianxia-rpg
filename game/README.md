# Tu Tiên Lục: Godot 4.7 + C# game

This folder holds the controllable game described in [`design/GAME_DESIGN.md`](../design/GAME_DESIGN.md). It uses Tale of Immortal's structure (a region with a monthly footwork budget, real-time fights, a living NPC world and set-piece breakthroughs), plus our own pillars: the Linh Thức storyteller, Qi + Body cultivation, Ngũ Hành reactions, and karma.

It is currently a **vertical slice** of the Thanh Vân region, played as a **2D top-down (¾ view) world**: you walk your cultivator with WASD through painted forests, rivers, the village and the sect, and **fights happen where you meet**. **Time flows as you travel**: every tile you cross spends footwork, and when it runs out the month turns by itself. All art is drawn procedurally in an ink-wash style (no sprite assets yet); there is no audio yet.

## Layout

| Path | What it is |
|---|---|
| `core/TuTien.Core/` | All game rules, engine-free (`netstandard2.1`, no Godot references): RNG, content, calendar, cultivation, elements, karma, map and footwork, month tick, NPC sim, combat rules, loot, events, saves. `GameEngine` is the single entry point. |
| `core/TuTien.Core.Tests/` | xUnit tests (93) that run the rules against the real content. |
| `godot/` | The Godot project. `scripts/Field` is the top-down world: the region, secret-realm floors and the breakthrough trial are all *fields*, with collision, the player controller, fights (`Battle`, `EnemyAi`), the HUD and the map. `scripts/Art` draws people, creatures, scenery and effects in code. `shaders/` paints the ground, the clouds of unexplored land and swaying trees. `scripts/Ui` holds the title screen, theme and panels, and `scripts/Dev` holds the smoke test and F9 cheats. |
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

**Exploring**

| Input | Action |
|---|---|
| WASD / arrows | Walk (roads are quicker; forest, swamp and mountains slower) |
| E | Interact with what the prompt shows: the inn, stall or bounty board, the sect hall, a cave, a spirit vein, a herb patch, a person, a 奇 adventure |
| Left click | Strike. Hitting a beast starts the fight with its pack |
| M | Map: click a place you've seen to plan the way, then set off |
| N | End the month early (it also turns by itself when footwork runs out) |
| B | Seclusion (bế quan): several months at ×1.6 cultivation |
| Tab | Sense pulse (thần thức): spend 10 Qi to see further |
| C / I / J | Character / Inventory / Journal (the journal has a how-to-play tab) |
| Mouse wheel | Zoom |
| Esc | System menu |
| F9 | Dev cheats |

**Fighting** (on the same field, wherever it starts)

| Input | Action |
|---|---|
| WASD | Move; trees and walls block you and most projectiles |
| Mouse | Aim |
| Left click | Martial art (võ kỹ) |
| Right click / 1 / 2 / 3 | Your four spirit-art slots (linh kỹ); assign them in Character → Arts |
| Space / Shift | Dash with brief invulnerability |
| R | Ultimate, once killing intent (sát ý) is full |
| Q | Healing pill |
| Run far away | Escape (stay out of reach for a moment) |
| Esc | Pause, or flee at once |

Controllers are mapped too: the left stick moves, the right stick aims, Y talks or looses the ultimate, A dashes, and Back opens the map.

### What the slice has

- **Character creation:** name, age, a spirit root roll with 3 rerolls, and a path (Qi, Body, or Kiêm tu).
- **Thanh Vân as a top-down world (48×30 tiles, 128 px each):** painted ground with river banks, bridges and roads; forests, bamboo groves, hills and snow peaks; drifting clouds over unexplored land; seasons that recolour the grass and trees. The village has houses, an inn, a market stall, a bounty board and a well; the Thanh Vân Kiếm Phái sits behind its gate between cliffs; the Linh Thảo Bí Cảnh opens from a glowing cave; there are two spirit veins and herb patches.
- **A living field:** 25 NPCs stroll where the month's simulation put them (talk to them with E), beast packs prowl their patch and aggressive ones chase you, 奇 adventures glow as pillars of light, and a rumor feed runs in the corner. Trees and roofs in front of you turn see-through.
- **Time flows as you travel:** each tile crossed spends its footwork (the HUD shows "day N of the month"). When it runs out the month turns (cultivation, world tick, autosave) and a card sums it up while you keep walking.
- **Real-time combat where you meet:** six enemy archetypes (charger, swarm, ranged, tank, caster, boss), each with a readable telegraph, fighting on real terrain. Every hit goes through the core's `CombatRules`. Element marks trigger the 10 Ngũ Hành reactions, and every creature reacts to its own element on a cooldown (for example, Fireball on a wood vine triggers *Liệt Diễm*). Spars end at 15% health; escape by running away.
- **Secret realm floors:** walled gardens where the guardians wait; clear the floor to open its chests and the gate down.
- **Breakthrough trial:** *Dẫn khí nhập thể* (Mortal → Luyện Khí) is played on a mountaintop bagua platform, not rolled. Gather qi motes and cut down heart demons; the success threshold depends on your preparation. Success awakens your root's first spirit art.
- **Karma:** gifts leave ân (a debt of gratitude) and killings leave oán (a grudge). Grudges come back as ambushes.
- **Saves and language:** the game saves every month and after every fight, and Vietnamese/English can be switched anywhere.

The Linh Thức AI storyteller is **offline-only** in this slice. NPC lines, the chronicle and rumors come from templates built on the same facts the online `/api/story` endpoint will receive (§7.13).

## Test

```bash
# Rules (fast, no Godot needed)
dotnet test game/core/TuTien.Core.Tests

# Godot headless smoke test. It plays the slice end to end: the world and its panels,
# walking the road until the month turns on the way, a fight on the field, striking a
# roaming pack, the breakthrough trial, a spirit-art fight, the sect trial, a secret
# realm floor, seclusion, and a save/load round trip. It exits 0 on success, 1 on failure.
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

See design doc §11. The rest of M1 covers audio, a settings screen, more enemies and arts, sword flight (Trúc Cơ) over water, and a 60-minute playtest. M2 brings the online storyteller and sect missions.
