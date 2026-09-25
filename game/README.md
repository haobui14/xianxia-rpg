# Tu Tiên Lục: Godot 4.7 + C# game

This folder holds the controllable game described in [`design/GAME_DESIGN.md`](../design/GAME_DESIGN.md). It uses Tale of Immortal's structure (a region with a monthly footwork budget, real-time fights, a living NPC world and set-piece breakthroughs), plus our own pillars: the Linh Thức storyteller, Qi + Body cultivation, Ngũ Hành reactions, and karma.

It is currently a **vertical slice** of the Thanh Vân region, played as a **2D top-down (¾ view) world**: you walk your cultivator with WASD through painted forests, rivers, the village and the sect, and **fights happen where you meet**. **Time flows as you travel**: every tile you cross spends footwork, and when it runs out the month turns by itself. Everything you see and hear is made in code: the art is drawn procedurally in an ink-wash style, and the sound effects and the guzheng-style music are synthesized at start-up. There are no sprite or audio asset files yet.

## Layout

| Path | What it is |
|---|---|
| `core/TuTien.Core/` | All game rules, engine-free (`netstandard2.1`, no Godot references): RNG, content, calendar, cultivation, elements, karma, map and footwork, month tick, NPC sim, combat rules, loot, events, saves. `GameEngine` is the single entry point. |
| `core/TuTien.Core.Tests/` | xUnit tests (161) that run the rules against the real content. |
| `godot/` | The Godot project. `scripts/Field` is the top-down world: the region, secret-realm floors and the breakthrough trial are all *fields*, with collision, the player controller, fights (`Battle`, `EnemyAi`), the HUD and the map. `scripts/Art` draws people, creatures, scenery and effects in code. `scripts/Audio` synthesizes every sound effect and composes the music. `shaders/` paints the ground, the clouds of unexplored land and swaying trees. `scripts/Ui` holds the title screen, theme, panels and settings, and `scripts/Dev` holds the smoke test and F9 cheats. |
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
| E | Interact with what the prompt shows: the inn, stall or bounty board, the sect hall, a cave, a spirit vein, a herb patch, a person, an adventure (a pillar of light under a gold star) |
| Left click | Strike. Hitting a beast starts the fight with its pack |
| M | Map: click a place you've seen to plan the way, then set off (from Trúc Cơ, a way over water is flown) |
| N | End the month early (it also turns by itself when footwork runs out) |
| B | Seclusion (bế quan): several months at ×1.6 cultivation |
| Tab | Sense pulse (thần thức): spend 10 Qi to see further |
| V | Sword flight (ngự kiếm), from Trúc Cơ: fly over rivers and peaks; V again to land |
| C / I / J | Character / Inventory / Journal (the journal has a how-to-play tab) |
| Mouse wheel | Zoom |
| Esc | System menu (save, settings, rebind keys) |
| F9 | Dev cheats |

These are the default keys.

**Every keyboard action here can be rebound** in Settings → Keys (or Esc → Rebind keys):

- Click an action, then press the new key. A key that's already taken swaps with it, and Esc cancels.
- "Restore defaults" puts everything back.
- The bindings are saved with the settings. The HUD, prompts and how-to-play text always name the key you chose.
- Some keys stay fixed so the game can't be locked out: the arrow keys always walk, Shift always dashes, and Esc and F9 can't be rebound. Mouse buttons can't be rebound either.

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

**Touch** (phones and tablets; Settings → Touch controls → On to try it on a desktop)

| Touch | Action |
|---|---|
| Stick, lower left | Walk. It appears under your thumb anywhere in that corner |
| Tap the ground | Walk there, round whatever is in the way |
| Tap a person or thing | Walk up to it and use it (talk, the board, the inn…) |
| Tap a beast | Strike it if it's in reach, else walk up to it |
| Sword button, lower right | Hold to strike; it aims itself at the nearest foe |
| Tap a foe (in a fight) | Strike toward it |
| Buttons around the sword (in a fight) | The four spirit arts (each drawn by how it is cast, in its element's colour), the ultimate (a starburst), pills |
| Double chevron | Dash |
| Hand / flying sword (exploring) | Interact / sword flight; each appears when it applies (in the air the sword becomes a landing arrow) |
| Pause bars (in a fight) | Pause, or flee |
| Icons, top right | Character, inventory, journal, map, seclusion, sense pulse, end month, system |
| Two fingers | Pinch to zoom |
| Android back | Same as Esc |

### What the slice has

- **Character creation:** name, age, a spirit root roll with 3 rerolls, and a path (Qi, Body, or Kiêm tu).
- **Thanh Vân as a top-down world (48×30 tiles, 128 px each):** painted ground with river banks, bridges and roads; forests, bamboo groves, hills and snow peaks; drifting clouds over unexplored land; seasons that recolour the grass and trees. The village has houses, an inn, a market stall, a bounty board, a forge and a well; the Thanh Vân Kiếm Phái sits behind its gate between cliffs; the Linh Thảo Bí Cảnh opens from a glowing cave; there are two spirit veins and herb patches.
- **A living field:** 25 NPCs stroll where the month's simulation put them (talk to them with E), beast packs prowl their patch and aggressive ones chase you, adventures glow as pillars of light under a gold star, and a rumor feed runs in the corner. Trees and roofs in front of you turn see-through.
- **Time flows as you travel:** each tile crossed spends its footwork (the HUD shows "day N of the month"). When it runs out the month turns (cultivation, world tick, autosave) and a card sums it up while you keep walking.
- **Real-time combat where you meet:** eleven enemy archetypes, each with a readable telegraph, fighting on real terrain: charger, swarm, ranged, tank, caster and boss, plus the five below. Every hit goes through the core's `CombatRules`. Element marks trigger the 10 Ngũ Hành reactions, and every creature reacts to its own element on a cooldown (for example, Fireball on a wood vine triggers *Liệt Diễm*). Spars end at 15% health; escape by running away.
- **Cultivators fight with everything they know:** an NPC you spar, fight or are ambushed by uses their own arts, by the player's rules:
  - Their root's first art, and a second root's from Qi Condensation 3.
  - Their root's second art from Qi Condensation 5.
  - Their sect's sword dash.
  - For some, a guard or a heal.
  - The fight picks the art for the moment: a heal when hurt, a guard when pressed, a dash from afar, a cleave or a wave up close, beams and bolts at range. Each art has its own cooldown, and every cast is telegraphed.
  - The NPC panel lists their arts. Outer disciples, rogue cultivators and bandit leaders know two or three arts each.
- **The Ancient Tree Hollow's creatures** (Cổ Thụ Động, the deep forest):
  - **Hắc Hùng** (Black Bear), a brute: lumbers in, rears up and crashes down on a wide arc in front of it, stunning whoever it catches.
  - **Hỏa Hồ** (Fire Fox), a trickster: keeps its distance and throws volleys of three fox-fires. Get close and it vanishes, reappears somewhere else and throws fire at once.
  - **Huyết Bức** (Blood Bat), a flier: circles overhead, then swoops along a marked line and drinks what it takes.
  - **U Hồn** (Wandering Wraith), a phantom: turns to mist (almost invisible and untouchable) and drifts through trees. It forms again nearby and chills the ground under you, which slows you.
  - **Thanh Lân Mãng** (Azure-Scale Python), the Hollow's lair beast: a Trúc Cơ boss that prowls alone, one per zone, with a boss bar.
    - It lunges down a marked line, sweeps its tail across everything but its front, and rains venom.
    - At half health it enrages and strikes faster.
- **Second-tier spirit arts:** at Luyện Khí 5 your root comprehends a second art. There is one per element, and each has a new cast shape:
  - **Kim Quang Trảm** (Golden Light Slash): a beam that cuts every foe in its line.
  - **Vạn Diệp Hộ Thân** (Myriad Leaves Guard): six leaves orbit you and cut whoever comes close.
  - **Thủy Long Ba** (Water Dragon Wave): a wave that knocks foes back and slows them.
  - **Liệt Diễm Địa** (Scorched Earth): the ground burns for four seconds.
  - **Thổ Lao Thuật** (Stone Palisade): five stone pillars rise, blocking bodies and shots and stunning whoever they toss.

  The village stall sells all five as manuals, so any root can learn them. The bounty board adds a bear cull and a price on the python's head.
- **Secret realm floors:** walled gardens where the guardians wait; clear the floor to open its chests and the gate down.
- **Breakthrough trials, played, not rolled:**
  - ***Dẫn khí nhập thể*** (Mortal → Luyện Khí) is on a mountaintop bagua platform. Gather qi motes and cut down heart demons; the success threshold depends on your preparation. Success awakens your root's first spirit art.
  - **Trúc Cơ, the meridian storm** (Luyện Khí 9 → Trúc Cơ) is inside the body: a jade dantian with the eight extraordinary meridians running into it, for sixty seconds.
    - Catch pure qi as it flows in (your root's essence is worth more), and cut or dodge turbid qi.
    - Step off a meridian when a surge is announced down it.
    - In the last phase, find the gaps in the shockwaves the forming foundation sends out.
  - **Foundation grades:** how well you did sets the foundation's grade, Hạ / Trung / Thượng / Thiên phẩm. The grade multiplies the breakthrough's gains (×1 / ×1.25 / ×1.5 / ×2) and adds to your power for good (+0 / 5 / 10 / 20%). It is shown on the character sheet.
- **Karma:** gifts leave ân (a debt of gratitude) and killings leave oán (a grudge). Grudges come back as ambushes.
- **Sect life** (win the entrance trial at the Thanh Vân gate, then talk to the gate again):
  - **Mission hall (Nhiệm Vụ Đường):** a board of three missions for a sword sect, drawn from the web game's templates and rolled again every three months: win fights, gather herbs or materials, cultivate, or beat disciples of the rival Blood Killing Demonic Sect. The rival hunt is posted only while enough of them are alive. You carry two missions at most.
    - Progress counts itself as you fight, gather and cultivate. When a mission is done, report it at the hall for contribution, silver and spirit stones.
    - A missed deadline, or giving a mission up, costs a quarter of its contribution.
  - **Ranks:** contribution is spent, while merit (all contribution ever earned) is what promotion looks at. Outer to inner disciple takes 200 merit and Qi Condensation 5, inner to true takes 500 and Foundation 1, and true to elder takes 1500 and Golden Core 1. Each rank raises the sect's cultivation bonus and its monthly stipend of silver and spirit stones.
  - **Treasury (Tàng Bảo Các):** pills, art manuals, the Foundation Pill, gear, and the sect's own technique, the Azure Cloud Sword Canon (+18% cultivation), for contribution. The best are kept for higher ranks.
  - **Spirit-gathering chamber:** inner disciples can seclude in it for +30% qi, paying 2 spirit stones a month. It's the first thing in the game that spends spirit stones.
  - The journal's Tasks tab tracks missions and bounties together.
- **Gear and the forge** (from the web game's equipment and cường hóa):
  - Three slots, a weapon, armour and an accessory, each worn from the bag (Inventory → Equip). Everything worn counts in combat, and armour's health and robes' Qi raise your maximums (Qi from gear waits for Qi Condensation). The village stall now sells leather armour and a jade pendant.
  - **The forge** at the east end of the village square enhances a slot from +1 to +10 for silver and enhancement stones: 100 silver and a common stone for +1, up to 20,000 silver and an epic stone for +10. The odds fall from 100% to 35%.
  - Each level makes whatever is worn in the slot 10% stronger, and the slot adds 2 attack, defense or resistance of its own. The level belongs to the slot, so a better find keeps it. A failed attempt spends the silver and stones but never drops a level.
  - The forge sells common stones for silver and the rarer ones for spirit stones. The market's money changer turns a spirit stone into 100 silver.
- **Mastery:** on Character → Arts, train an art one level for 150 silver × its level, and deepen a technique for spirit stones (5, 10 or 20 × its level by grade, up to level 10). Each technique level adds 10% to its cultivation bonus.
- **The month's wares:** besides its fixed stock, the village stall lays out four goods each month, drawn from the region's loot (herbs, gear, manuals, enhancement stones), each with a few in stock. Rare goods sell only for spirit stones. A merchant caravan met on the road opens its own, finer wares.
- **The web game's events, made whole:**
  - Every reward is a real item, and every foe a real creature. Examples are the Primer of Cultivation, the Heaven-grade Sea of Clouds Heavenly Art from the legacy trial, and the Formation-Heart Jade you can wear. The Vengeful Cultivator, the Mysterious Assassin and the Void Beast now fight with their own looks and ways.
  - A night at the inn sometimes brings a dream or a visitor.
  - Holding back a breakthrough feeling makes the next breakthrough 8% easier. Facing down an inner demon makes every one 3% easier.
  - Effects that set Qi (to full, or to nothing) work, and a "spirit stone" reward pays spirit stones.
- **Sword flight (ngự kiếm):** from Trúc Cơ, press V to ride your sword over the river and peaks, twice as fast as walking and out of reach of beasts. Land with V, which doesn't work over water. Set off on the map across water and the sword takes you there and sets you down.
- **Sound, all synthesized:** about 40 effects (swishes, hits, casts, coins, the month gong, and more), positional in the world. Five pieces of music are generated in pentatonic modes for the title, exploring, fights, the breakthrough trial and secret realms. The zither plays with glissandi, grace notes and tremolo over flute, bells and drone; fights get taiko drums. The music crossfades as you move between them.
- **The seasons in the air:** blossom petals, summer fluff and butterflies, autumn leaves and snow drift across the screen. Footsteps raise dust on roads, ripples in the swamp and puffs of snow.
- **A painted title screen** that moves (mist, falling petals, a slow pan), and a **settings** screen: volumes, fullscreen, screen shake, interface size, touch controls, keys and language.
- **English first, with a full Vietnamese translation:** the game starts in English, and Vietnamese can be picked on the title screen or in Settings. Every word on screen follows the choice at once, including the painted signboards, the names over people's heads and the message log.
  - In English, realms, arts, places and signs are translated (Qi Condensation, Azure Cloud Village, "Inn"), and people's names are written without Vietnamese marks (Lâm Bá is Lam Ba), the way English xianxia writes Chinese names.
  - The language is a setting, not part of a save: a save made in one language opens in the other.
- **No Chinese characters:** every sign and label is English or Vietnamese, and every badge is an ink icon drawn in code. That covers panel seals, HUD and touch buttons, art icons (drawn by how each art is cast, coloured by its element), element and status marks, and map markers.
- **Phones and tablets:** on-screen touch controls (above), and an interface drawn bigger to suit the screen. Auto picks 135% on a phone and 120% on a small tablet, or you choose 100–145%. Panels shrink to fit and scroll under a finger, even one that lands on a button (a tap still presses it; a drag scrolls instead).
- **Art slots:** Character → Arts shows the four slots as cards (each art's icon and name), and every art you know carries a row of slot buttons: tap one to put the art there (it swaps with whatever was in it), tap the lit one to take it out. With touch controls the slots are numbered 1–4 the way they ring the sword button; with a keyboard they're named by their keys.
- **Saves:** the game saves every month and after every fight.
- **Loading screen:** a new life or Continue opens on "Đang kiến tạo thế giới…" ("Building the world…"). The bar follows the real work as the region is built a slice per frame: the land and rivers, the mountains, the forests, the village and the sect, then the scenery around you. It also shows a tip.

The Linh Thức AI storyteller is **offline-only** in this slice. NPC lines, the chronicle and rumors come from templates built on the same facts the online `/api/story` endpoint will receive (§7.13).

## Test

```bash
# Rules (fast, no Godot needed)
dotnet test game/core/TuTien.Core.Tests

# Godot headless smoke test. It plays the slice end to end:
#  - every sound effect and piece of music is rendered and checked (no NaN, sane
#    loudness, loops that join without a click)
#  - real key and mouse events go through Godot's input pipeline: walk with WASD, E at
#    the bounty board, Esc, M, a click that swings the sword, N, and rebinding Interact
#    to F by clicking in the keys panel (then F opens the board, E doesn't)
#  - the rest of the slice: the world and its panels, map travel that walks round
#    props until the month turns on the road, a fight on the field, striking a roaming
#    pack, the first breakthrough trial, a spirit-art fight, the sect trial, a secret
#    realm floor, the Trúc Cơ meridian storm (it must lay a foundation), a fight with
#    each of the five new creatures using a different second-tier art, sword flight
#    across the river (by key and by map), seclusion, and a save/load round trip
#  - gear by mouse: buy armour and put it on from the bag, buy a stone and enhance the
#    slot at the forge, change a spirit stone for silver, train an art, deepen a technique
#  - the month's wares bought by mouse, and nights at the inn until one brings an event
#  - a spar with a disciple of each element: each must use two or more of their arts, and
#    between them every kind of cast (bolts, the cleave, the beam, leaves, wave, fire, pillars, dash)
#  - Character → Arts by mouse: an art's slot button moves it into that slot, a second
#    click takes it out, and no panel opens a drop-down picker
#  - a phone: at 135% interface size, touch events pushed into the viewport drag the
#    stick, press Interact, tap an art's slot button, tap the ground to walk, pinch to
#    zoom, and in a fight press an art, pause, and hold the martial art until the bear
#    is beaten
#  - the new life goes in through the loading screen, like the title's button
#  - one language at a time: at every step it reads each visible label and button and
#    every word painted on the field (signs, names, the HUD). In English no Vietnamese
#    letter may show, and in Vietnamese no English word. At the end it switches language
#    mid-game and checks the world, the character sheet and the journal again
# It plays in English; add --locale vi to play in Vietnamese. It exits 0 on success, 1 on failure.
dotnet build game/TuTienLuc.sln
godot --headless --fixed-fps 60 --path game/godot -- --smoke
godot --headless --fixed-fps 60 --path game/godot -- --smoke --locale vi

# The same run with screenshots (needs a display; xvfb works on CI)
xvfb-run -s "-screen 0 1600x900x24" godot --rendering-driver opengl3 --fixed-fps 60 \
  --resolution 1600x900 --path game/godot -- --smoke --shots /tmp/tutien-shots
```

The smoke test writes to its own save slot (`user://saves/smoke.json`, or `smoke_vi.json` in Vietnamese, so both can run at once), so it never touches your real save. With `--shots` it also writes the five music loops as WAV files next to the screenshots.

To see what the phone flow costs, run `--phone-start` at a phone's resolution. It uses touch controls and the 135% interface, taps through the title and character creation, then reports memory, GPU buffer memory, objects and draw calls each second in the world (add `--shots DIR` for pictures of the loading screen and the world):

```bash
xvfb-run -s "-screen 0 2400x1080x24" godot --rendering-driver opengl3_es --resolution 2400x1080 \
  --path game/godot -- --phone-start
```

`--arts-stress [rounds] [log] [shots dir]` plays a phone's way through Character → Arts over and over, with a real window. It taps slot buttons (each tap must do what it should), drags from them (the page must scroll and no slot may change), switches tabs and presses the back button. Every action goes to the log file first, so a crash leaves a trail. `--capture out.png [frames]` starts the game as usual and saves what its own window shows after a moment.

```bash
godot --path game/godot --resolution 1600x720 -- --arts-stress 300 arts.log shots/
godot --path game/godot --resolution 1600x900 -- --capture title.png 120
```

## Android

The game runs on Android phones and tablets (arm64, landscape). There's a ready preset in `godot/export_presets.cfg`, and touch controls and a bigger interface switch on by themselves on a phone. Godot marks C# on Android as experimental.

**You need:**

- **Godot 4.7.2 .NET** and its **export templates**. In the editor use Editor → Manage Export Templates → Download and Install, or install the `.tpz` from the Godot download page.
- **.NET 9 SDK.** Godot 4.7's Android template runs .NET 9, so `TuTienLuc.csproj` builds for `net9.0` when exporting to Android (desktop builds stay on `net8.0`). The .NET 9 SDK builds both.
- **JDK 17** or newer.
- **Android SDK** with platform-tools and build-tools:
  ```bash
  sdkmanager "platform-tools" "build-tools;35.0.0" "platforms;android-35"
  ```

**Set up once:** in Editor → Editor Settings → Export → Android, set the **Android SDK path** and the **Java SDK path**. Godot makes a debug keystore itself.

**Build and install a debug APK:**

```bash
mkdir -p game/godot/export/android   # the output path is relative to the project (and gitignored)
godot --headless --path game/godot --export-debug "Android" export/android/TuTienLuc-debug.apk
adb install -r game/godot/export/android/TuTienLuc-debug.apk
```

Or in the editor: Project → Export → Android → Export Project. You can also use the one-click deploy button with a phone plugged in (USB debugging on).

**Or let GitHub build it.** `.github/workflows/android.yml` runs on GitHub Actions for every push to `main` or this branch that touches `game/`, and it can also be started by hand from the Actions tab.

- It installs .NET 8 and 9, Java 17, the Android SDK, and Godot 4.7.2 .NET with its Android templates, then runs the rules tests and exports two APKs.
- Download them from the run's **Artifacts** (`tu-tien-luc-android-<run number>`):
  - `TuTienLuc.apk` is the release build, for playing.
  - `TuTienLuc-debug.apk` is the debug build; its log shows in `adb logcat`.
- Each build's version code is the run number, so it installs as an update.

By default each run signs with a throwaway key, so you must uninstall the old build first, which deletes its saves. To sign every build with the same key, add three repository secrets (Settings → Secrets and variables → Actions):

```bash
keytool -genkeypair -keystore tutienluc.keystore -alias tutienluc -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 tutienluc.keystore   # → ANDROID_KEYSTORE_BASE64
```

Then set `ANDROID_KEYSTORE_PASSWORD` (the password you chose) and `ANDROID_KEY_ALIAS` (`tutienluc`). Keep the keystore file itself safe and out of the repository.

**A release build** needs your own keystore. Godot reads it from `GODOT_ANDROID_KEYSTORE_RELEASE_PATH`, `GODOT_ANDROID_KEYSTORE_RELEASE_USER` and `GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD`; then run `--export-release`. No keystore or password is kept in the repository.

**Drawing for phones:** Godot's compatibility renderer gives every circle, arc, polyline and polygon its own GPU vertex and index buffers. The painted valley came to about 90,000 of them, and on Android the game closed the moment the world opened. Two rules keep it small:

- All art draws through a `Brush` (`scripts/Art/Brush.cs`), never straight onto a `CanvasItem`. A brush gathers everything one `_Draw` paints into one triangle list, with Godot's own shapes and anti-aliasing. Use `using var b = Brush.On(this);` in `_Draw`.
- A field paints only the scenery near the camera; props farther away let their buffers go.

The world now holds a few hundred buffers and makes about 75 draw calls a frame, down from about 1,300.

**On the phone:**

- Saves go to the app's own storage.
- The back button works like Esc.
- The package name is `com.tutienluc.game`; change it in the preset before publishing.
- The launcher icon is adaptive: a cultivator riding a flying sword across a cinnabar sun, over ink mountains in mist. The background, foreground and a monochrome silhouette for Android 13's themed icons are separate layers, so any launcher shape (Samsung's squircle, circles) crops only the sky. `node scripts/make-game-icons.mjs` rewrites them (`godot/art/icon/`) and `godot/icon.svg` from one description.

**If the game closes by itself:** a phone shows nothing when an app crashes, so the game leaves itself a trail.

- It writes a line for everything it's about to do (screens, panels and their tabs, fights, month turns, the back button) to `user://logs/trail.txt`, straight to disk. A marker file exists only while it runs in the foreground. Leaving the app for the home screen isn't a crash, since the phone may end a backgrounded app at any time.
- If the marker is still there at the next start, the title screen says the game closed unexpectedly and offers **Copy the crash report**. Settings → Problems has the same button.
- The report holds the last session's trail, the end of Godot's own log (file logging is on for phones too) and the device model. Paste it into a message.
- `adb logcat` on the debug APK still gives the fullest picture.

On Android the app sometimes closed on the character sheet's Arts tab. Its slots were drop-down pickers, the only popup windows in the game's panels (each carries a viewport of its own), and a thumb scrolling the page opened them and changed slots by accident. The same taps, drags and back presses on a desktop never crashed, so the cause couldn't be pinned down. The pickers are buttons now (see *Art slots* above), and the trail will show if anything still goes wrong.

## Re-export content from the web game

```bash
npx tsx scripts/export-game-content.ts
```

This rewrites `regions`, `dungeons`, `events`, `sects`, `loot`, `sect_missions` and `progression.json` in `godot/content/`. The hand-authored files are left alone. At startup, `ContentDb.Validate()` logs the remaining content gaps, such as enemy IDs that have no catalog entry yet.

## Next

See design doc §11. The rest of M1 covers text-size and telegraph-colour options and a 60-minute playtest. M2 brings the online storyteller and sect missions.
