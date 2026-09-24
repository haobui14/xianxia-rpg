using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Godot;
using TuTien.Core;
using TuTien.Core.State;
using TuTien.Core.World;
using TuTienLuc.Audio;
using TuTienLuc.Field;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.Dev;

/// <summary>
/// Plays the slice end to end without a human: title → new life → the top-down world (panels, walking
/// the road, the month turning on the way) → a fight where you stand (autopilot) → striking a roaming
/// pack → the breakthrough trial → a fight with spirit arts → the sect trial → a secret realm floor →
/// seclusion → save/load round trip. Run with
/// <c>godot --headless --fixed-fps 60 --path game/godot -- --smoke</c>; add <c>--shots DIR</c> (with a
/// real display, e.g. xvfb) to save screenshots. Exits 0 on success, 1 on failure.
/// </summary>
public partial class SmokeTest : Node
{
    private readonly string? _shots;
    private int _shotIndex;

    public SmokeTest(string? shotsDir) => _shots = shotsDir;

    private static GameEngine E => Game.Instance.Engine!;
    private bool Rendering => _shots != null && DisplayServer.GetName() != "headless";

    public override void _Ready()
    {
        // Rendering is only needed for screenshots; simulate without drawing to keep the run fast.
        if (Rendering) RenderingServer.RenderLoopEnabled = false;
        _ = Run();
    }

    private static void Log(string message) => GD.Print("[smoke] " + message);

    private static void Check(bool condition, string what)
    {
        if (!condition) throw new InvalidOperationException("check failed: " + what);
        Log("ok — " + what);
    }

    private async Task Run()
    {
        try
        {
            var game = Game.Instance;
            game.SavePath = "user://saves/smoke.json";
            // Play on the default keys, and never write the player's own settings.
            game.PersistSettings = false;
            KeyMap.Reset();
            if (_shots != null) Directory.CreateDirectory(_shots);
            await Steps(game);
            Log("PASSED");
            Game.Instance.Quit(0);
        }
        catch (Exception ex)
        {
            GD.PrintErr("[smoke] FAILED: " + ex);
            Game.Instance.Quit(1);
        }
    }

    private static WorldScreen World => Main.Instance.World ?? throw new InvalidOperationException("no world screen");

    /// <summary>
    /// Every sound is synthesized: render them all and check the numbers (no NaN, sensible loudness,
    /// loops that join without a click). With --shots, the music is also written out as WAV files.
    /// </summary>
    private void CheckAudio()
    {
        foreach (var (name, recipe) in SfxLibrary.Recipes)
        {
            var pcm = recipe();
            var peak = pcm.Max(v => MathF.Abs(v));
            if (pcm.Length == 0 || float.IsNaN(peak) || peak < 0.05f || peak > 1f)
                throw new InvalidOperationException($"sound '{name}' renders badly (length {pcm.Length}, peak {peak})");
        }
        Log($"ok — {SfxLibrary.Recipes.Count} sound effects render cleanly");
        foreach (var (mood, compose) in new (string, Func<float[]>)[]
                 {
                     ("title", Composer.Title), ("explore", Composer.Explore), ("battle", Composer.Battle), ("trial", Composer.Trial), ("realm", Composer.Realm),
                 })
        {
            var pcm = compose();
            var peak = pcm.Max(v => MathF.Abs(v));
            var rms = MathF.Sqrt(pcm.Average(v => v * v));
            // The seam: the jump from the last sample back to the first should look like any other step.
            var typical = 0f;
            for (var i = 1; i < pcm.Length; i += 97) typical = MathF.Max(typical, MathF.Abs(pcm[i] - pcm[i - 1]));
            var seam = MathF.Abs(pcm[0] - pcm[^1]);
            if (float.IsNaN(rms) || peak > 1f || rms < 0.02f || seam > typical * 1.5f + 0.01f)
                throw new InvalidOperationException($"music '{mood}' renders badly (peak {peak:0.00}, rms {rms:0.000}, seam {seam:0.000} vs {typical:0.000})");
            Log($"ok — music '{mood}': {pcm.Length / (float)Synth.Rate:0.0}s loop, peak {peak:0.00}, rms {rms:0.000}");
            if (_shots != null) WriteWav(Path.Combine(_shots, $"audio_{mood}.wav"), pcm);
        }
    }

    private static void WriteWav(string path, float[] pcm)
    {
        using var f = new FileStream(path, FileMode.Create);
        using var w = new BinaryWriter(f);
        w.Write("RIFF"u8.ToArray());
        w.Write(36 + pcm.Length * 2);
        w.Write("WAVEfmt "u8.ToArray());
        w.Write(16);
        w.Write((short)1);
        w.Write((short)1);
        w.Write(Synth.Rate);
        w.Write(Synth.Rate * 2);
        w.Write((short)2);
        w.Write((short)16);
        w.Write("data"u8.ToArray());
        w.Write(pcm.Length * 2);
        foreach (var v in pcm) w.Write((short)Math.Clamp((int)(v * 32767), short.MinValue, short.MaxValue));
    }

    private async Task Steps(Game game)
    {
        CheckAudio();

        // ---------------------------------------------------------------- the icons (no written glyphs anywhere)
        if (Rendering)
        {
            var sheetLayer = new CanvasLayer { Layer = 100 };
            AddChild(sheetLayer);
            sheetLayer.AddChild(new IconSheet());
            await Frames(3);
            await Shot("icons");
            sheetLayer.QueueFree();
        }

        // ---------------------------------------------------------------- title and creation
        Main.Instance.ShowTitle();
        await Frames(30);
        await Shot("title");
        Main.Instance.GetChildren().OfType<TitleScreen>().FirstOrDefault()?.ShowCreation();
        await Frames(3);
        await Shot("creation");

        var root = new SpiritRootState { Elements = { Element.Hoa }, Grade = RootGrade.Kha };
        game.NewGame("Lâm Vân", 16, root, CultivationPath.Qi, 20240917UL);
        var world = Main.Instance.ShowWorld();
        await Frames(40);
        Check(E.Player.Realm == Realm.PhamNhan && E.Player.Footwork > 0, "new life starts as a mortal with footwork");
        Check(world.Actors.Count > 1, "people and beasts stand on the field");
        await Shot("world_village");
        world.Zoom(0.72f);
        await Frames(20);
        await Shot("world_village_wide");
        world.Zoom(1 / 0.72f);

        // ---------------------------------------------------------------- real input: keys and the mouse
        world = await DriveByHand(world);
        world = await RebindByHand(world);

        // ---------------------------------------------------------------- panels
        foreach (var panel in new InkPanel[] { new CharacterPanel(), new InventoryPanel(), new JournalPanel(), new MapPanel(world), new SettingsPanel() })
        {
            world.OpenPanel(panel);
            await Frames(3);
            await Shot(panel.GetType().Name);
        }
        Check(world.CurrentPanel is SettingsPanel s && s.FindChildren("*", "HSlider", true, false).Count == 3,
            "the settings panel offers master, music and effects volume");
        var village = E.Map.Def.Pois.First(p => p.Kind == "town");
        world.OpenPanel(new TownPanel(village, 1));
        await Frames(3);
        await Shot("town_market");
        var silver = E.Player.Silver;
        game.Notify(E.Buy(E.TownFor(village)!, "hoi_huyet_tan"));
        Check(E.Player.Silver < silver, "buying a pill spends silver");
        world.ClosePanel();
        await Frames(2);

        // ---------------------------------------------------------------- walking the road; time flows
        var footwork = E.Player.Footwork;
        var month = E.State.Calendar.MonthIndex;
        var start = world.Tile;
        // DriveByHand left the body just below the bounty board, right in the way of the first waypoint.
        world = await Walk(world, 17, 22, "walk_road");
        Check(world.Tile == new Vector2I(17, 22) && world.Tile != start, "the route walks round the bounty board, the engine following tile by tile");
        Check(E.Player.Footwork < footwork || E.State.Calendar.MonthIndex > month, "crossing tiles spends footwork");

        // Run the month dry, then keep walking: the month turns on the road.
        month = E.State.Calendar.MonthIndex;
        E.Player.Footwork = 1;
        world = await Walk(world, 17, 18, null);
        world = await Walk(world, 17, 22, null);
        Check(E.State.Calendar.MonthIndex > month, "when footwork runs out the month turns by itself");
        await Frames(10);
        await Shot("month_on_the_road");
        world = await Settle(world);

        // ---------------------------------------------------------------- a fight where you stand
        var fights = E.Player.Counters.Fights;
        var wolf = E.StartAdventureFight("forest_wolf", "verdant_forest")!;
        world.Fight(wolf);
        Check(world.Battle != null, "the fight starts on the field, no screen change");
        world = await FightThrough(world, "battle_wolf");
        Check(E.Player.Counters.Fights == fights + 1 && E.ActiveEncounter == null, "the wolf fight resolved through the engine");
        await Shot("battle_result");
        world = await Settle(world);

        // ---------------------------------------------------------------- strike a roaming pack
        DevCheats.Restore(E);
        DevCheats.RevealMap(E);
        world.RefreshFog();
        world.SyncActors();
        await Frames(4);
        var pack = world.Actors.Select(a => a.Body).Where(b => b.PackId != null && b.Alive)
            .OrderBy(b => b.Pos.DistanceTo(world.PlayerBody.Pos)).FirstOrDefault();
        if (pack != null)
        {
            var packId = pack.PackId;
            world.DebugPlace(pack.Pos + new Vector2(0, 90));
            await Frames(6);
            if (world.Battle == null) Check(world.Engage(pack), "striking a beast starts the fight with its pack");
            world = await FightThrough(world, "battle_pack");
            Log($"pack {packId}: {(E.State.World.Beasts.Any(b => b.Id == packId) ? "still roams" : "cleared")}");
            world = await Settle(world);
        }

        // ---------------------------------------------------------------- the breakthrough trial
        for (var attempt = 1; attempt <= 3 && E.Player.Realm == Realm.PhamNhan; attempt++)
        {
            game.Notify(DevCheats.FillToBreakthrough(E));
            Check(E.BreakthroughReady, "cultivation fills to a pending breakthrough");
            world.OpenPanel(new BreakthroughPanel());
            await Frames(3);
            if (attempt == 1) await Shot("breakthrough");
            var trial = Main.Instance.ShowBreakthroughTrial();
            await Frames(2);
            trial.Player.Autopilot = true;
            await Frames(60 * 12);
            if (attempt == 1) await Shot("trial");
            world = await UntilWorld();
            await Frames(40);
            if (attempt == 1) await Shot("breakthrough_result");
            Log($"breakthrough attempt {attempt}: realm now {E.Player.Realm}");
            world = await Settle(world);
        }
        Check(E.Player.Realm == Realm.LuyenKhi, "the trial can be passed (Luyện Khí reached)");
        Check(E.Player.SkillSlots.Contains("hoa_cau_thuat"), "a Hỏa root awakens Fireball on breakthrough");

        // ---------------------------------------------------------------- spirit arts and Ngũ Hành
        DevCheats.Restore(E);
        world.Player.SyncFromEngine();
        var vine = E.StartAdventureFight("corrupted_vine", "verdant_forest")!;
        world.Fight(vine);
        world.Player.Autopilot = true;
        var usedArt = false;
        for (var i = 0; i < 60 * 8 && world.Battle != null; i++)
        {
            usedArt |= world.Battle.SkillUses.ContainsKey("hoa_cau_thuat");
            if (i == 60 * 3) await Shot("battle_arts");
            await Frames(1);
        }
        world = await FightThrough(world);
        Check(usedArt, "the autopilot cast its spirit art");
        world = await Settle(world);

        // ---------------------------------------------------------------- the sect trial
        DevCheats.Restore(E);
        var sectPoi = E.Map.Def.Pois.First(p => p.Kind == "sect");
        world.DebugPlace(WorldScreen.TileCenter(sectPoi.X, sectPoi.Y) + new Vector2(0, 150));
        await Frames(20);
        await Shot("sect");
        var trialFight = E.StartSectTrial("thanh_van_kiem");
        Check(trialFight is { NonLethal: true }, "the sect trial is a spar");
        world.Fight(trialFight!);
        world = await FightThrough(world, "battle_sect_trial");
        Log($"sect after trial: {E.Player.SectId ?? "none"}");
        world = await Settle(world);

        // ---------------------------------------------------------------- people
        var npc = world.Actors.Select(a => a.Body).FirstOrDefault(b => b.NpcId != null && b.Alive);
        if (npc != null)
        {
            world.DebugPlace(npc.Pos + new Vector2(0, 60));
            await Frames(10);
            world.OpenPanel(new NpcPanel(npc.NpcId!));
            await Frames(3);
            await Shot("npc");
            world = await Settle(world);
        }

        // ---------------------------------------------------------------- a secret realm floor
        DevCheats.Restore(E);
        DevCheats.Silver(E, 500);
        var realmPoi = E.Map.Def.Pois.First(p => p.Kind == "secret_realm");
        world.DebugPlace(WorldScreen.TileCenter(realmPoi.X, realmPoi.Y) + new Vector2(0, 90));
        await Frames(20);
        await Shot("realm_cave");
        game.Remember(E.EnterRealm(E.DungeonFor(realmPoi)!.Id));
        Check(E.State.World.Run != null, "the secret realm run begins");
        var realm = Main.Instance.ShowRealm(realmPoi);
        await Frames(40);
        await Shot("realm_floor");
        realm.Player.Autopilot = true;
        var guard = realm.Actors.Select(a => a.Body).First(b => b.PackId == "floor");
        realm.Player.Route.Enqueue(guard.Pos + new Vector2(0, 200));
        await Until(() => realm.Battle != null, 60 * 10, "the guardians wake");
        await FightIn(realm, "realm_battle");
        if (E.State.World.Run is { FloorCleared: true })
        {
            Log("realm floor 1 cleared");
            var opened = E.OpenFloorChest();
            Check(opened != null, "a chest opens after the floor is cleared");
            await Frames(4);
            await Shot("realm_cleared");
            game.Notify(E.AdvanceRealm());
            Check(E.State.World.Run?.Floor == 2, "the gate leads down to floor 2");
            realm = Main.Instance.ShowRealm(realmPoi);
            await Frames(120);
            await Shot("realm_floor_2");
        }
        E.AbandonEncounter();
        E.LeaveRealm();
        world = Main.Instance.ShowWorld();
        await Frames(6);
        world = await Settle(world);

        // ---------------------------------------------------------------- Trúc Cơ: the meridian storm
        world = await FoundationBreakthrough(world);

        // ---------------------------------------------------------------- new beasts, new arts
        world = await NewBeastsAndArts(world);

        // ---------------------------------------------------------------- sword flight over the river
        world = await SwordFlight(world);

        // ---------------------------------------------------------------- a phone: touch controls, a bigger interface
        world = await TouchByHand(world);

        // ---------------------------------------------------------------- seclusion
        world.OpenPanel(new SeclusionPanel());
        await Frames(3);
        await Shot("seclusion");
        var report = E.Seclude(2, 0);
        Check(report.Months >= 1 && report.TotalExp > 0, "seclusion passes months and cultivates");
        world.OpenPanel(new MonthReportPanel(report, seclusion: true));
        await Frames(3);
        world = await Settle(world);

        // ---------------------------------------------------------------- save / load, locale
        game.SaveGame();
        var saved = E.Save();
        Check(game.LoadGame(), "the save loads");
        Check(E.Save() == saved, "save → load round-trips exactly");
        game.SetLocale(Locale.En);
        world = Main.Instance.ShowWorld();
        await Frames(40);
        await Shot("world_en");
        game.SetLocale(Locale.Vi);

        var p = E.Player;
        Log($"final: {p.Name}, {p.Realm} {p.Stage}, month {E.State.Calendar.MonthIndex}, fights {p.Counters.Fights}, kills {p.Counters.Kills}, silver {p.Silver}, sect {p.SectId ?? "-"}");
        Main.Instance.ShowTitle();
        game.EndRun();
        await Frames(2);
    }

    // ---------------------------------------------------------------- simulated hands

    private static void KeyEvent(Key key, bool pressed) =>
        Input.ParseInputEvent(new InputEventKey { Keycode = key, PhysicalKeycode = key, Pressed = pressed });

    private async Task Tap(Key key)
    {
        KeyEvent(key, true);
        await Frames(2);
        KeyEvent(key, false);
        await Frames(3);
    }

    private async Task Hold(Key key, int frames)
    {
        KeyEvent(key, true);
        await Frames(frames);
        KeyEvent(key, false);
        await Frames(2);
    }

    private async Task Click(Vector2 screen)
    {
        Input.ParseInputEvent(new InputEventMouseMotion { Position = screen, GlobalPosition = screen });
        Input.ParseInputEvent(new InputEventMouseButton { ButtonIndex = MouseButton.Left, Pressed = true, Position = screen, GlobalPosition = screen, ButtonMask = MouseButtonMask.Left });
        await Frames(3);
        Input.ParseInputEvent(new InputEventMouseButton { ButtonIndex = MouseButton.Left, Pressed = false, Position = screen, GlobalPosition = screen });
        await Frames(3);
    }

    /// <summary>
    /// A mouse click on a control, pushed into the viewport's GUI input at the control's centre (headless
    /// there is no window to map screen positions through, so <see cref="Input.ParseInputEvent"/> can't aim).
    /// </summary>
    private async Task ClickGui(Control control)
    {
        var at = control.GetGlobalRect().GetCenter();
        var viewport = GetViewport();
        viewport.PushInput(new InputEventMouseMotion { Position = at, GlobalPosition = at }, true);
        viewport.PushInput(new InputEventMouseButton { ButtonIndex = MouseButton.Left, Pressed = true, Position = at, GlobalPosition = at, ButtonMask = MouseButtonMask.Left }, true);
        await Frames(2);
        viewport.PushInput(new InputEventMouseButton { ButtonIndex = MouseButton.Left, Pressed = false, Position = at, GlobalPosition = at }, true);
        await Frames(3);
    }

    /// <summary>
    /// The path a human takes, not the autopilot's: key and mouse events through Godot's input pipeline —
    /// walking with WASD, E at the bounty board, Esc, M for the map, a click that swings the sword, N.
    /// </summary>
    private async Task<WorldScreen> DriveByHand(WorldScreen world)
    {
        var before = world.PlayerBody.Pos;
        await Hold(Key.D, 30);
        Check(world.PlayerBody.Pos.X > before.X + 40, "holding D walks the cultivator east");
        before = world.PlayerBody.Pos;
        await Hold(Key.W, 20);
        Check(world.PlayerBody.Pos.Y < before.Y - 20, "holding W walks north");

        world.DebugPlace(new Vector2(846, 3040));
        await Frames(4);
        await Tap(Key.E);
        Check(world.CurrentPanel is TownPanel, "E at the bounty board opens the town");
        await Tap(Key.Escape);
        Check(!world.PanelOpen, "Esc closes the panel");
        await Tap(Key.M);
        Check(world.CurrentPanel is MapPanel, "M opens the map");
        await Tap(Key.Escape);

        var swings = world.Fx.Swooshes.Count;
        await Click(GetViewport().GetVisibleRect().Size / 2 + new Vector2(120, 40));
        Check(world.Fx.Swooshes.Count > swings || world.Battle != null, "a click in the world swings the sword");
        await Frames(20);

        var month = E.State.Calendar.MonthIndex;
        await Tap(Key.N);
        await Frames(4);
        Check(E.State.Calendar.MonthIndex == month + 1, "N ends the month early");
        return await Settle(World);
    }

    /// <summary>
    /// Esc → Keys: click Interact's key and press F. From then on F talks to the bounty board, E does
    /// nothing, and the corner hint says F. Then back to the defaults.
    /// </summary>
    private async Task<WorldScreen> RebindByHand(WorldScreen world)
    {
        world.DebugPlace(new Vector2(846, 3040));
        await Frames(4);
        world.OpenPanel(new KeysPanel());
        await Frames(3);
        var button = world.CurrentPanel!.FindChild("key_interact", true, false) as Button;
        Check(button != null && button.Text == "E", "the keys panel lists Interact on E");
        await ClickGui(button!);
        Check((world.CurrentPanel!.FindChild("key_interact", true, false) as Button)?.Text != "E", "clicking Interact's key waits for a new one");
        await Tap(Key.F);
        Check(KeyMap.Get("interact") == Key.F, "clicking Interact's key and pressing F rebinds it");
        await Tap(Key.Escape);
        Check(!world.PanelOpen, "Esc closes the keys panel");
        await Tap(Key.E);
        Check(!world.PanelOpen, "E no longer interacts");
        await Tap(Key.F);
        Check(world.CurrentPanel is TownPanel, "F now opens the bounty board");
        Check(world.HintText().Contains("F "), "the corner hint names the new key");
        await Tap(Key.Escape);
        KeyMap.Reset();
        Check(KeyMap.IsDefault && KeyMap.Label("interact") == "E", "restoring the defaults puts Interact back on E");
        return await Settle(World);
    }

    /// <summary>Luyện Khí 9 → Trúc Cơ through the meridian storm, played by the autopilot; the foundation gets a grade.</summary>
    private async Task<WorldScreen> FoundationBreakthrough(WorldScreen world)
    {
        for (var attempt = 1; attempt <= 3 && E.Player.Realm == Realm.LuyenKhi; attempt++)
        {
            DevCheats.Restore(E);
            E.Player.Injuries.Clear(); // a failed attempt injures; each retry starts whole
            Game.Instance.Notify(DevCheats.FillToBreakthrough(E));
            Check(E.BreakthroughReady && E.Player.Stage == 9, "Luyện Khí fills to its ninth stage, a breakthrough waiting");
            world.OpenPanel(new BreakthroughPanel());
            await Frames(3);
            if (attempt == 1) await Shot("breakthrough_truc_co");
            var trial = Main.Instance.ShowBreakthroughTrial();
            Check(trial is FoundationTrial, "Luyện Khí's breakthrough is the meridian storm");
            var storm = (FoundationTrial)trial;
            await Frames(2);
            storm.Player.Autopilot = true;
            await Frames(60 * 46);
            if (attempt == 1) await Shot("foundation_trial");
            await Until(() => storm.Ended, 60 * 30, "the meridian storm ends");
            Log($"meridian storm {attempt}: {storm.Score:0}/{FoundationTrial.Goal:0}, {storm.Hits} hits, performance {storm.Performance:0.00} (needed {storm.Threshold:0.00})");
            world = await UntilWorld();
            await Frames(40);
            if (attempt == 1) await Shot("foundation_result");
            world = await Settle(world);
        }
        Check(E.Player.Realm == Realm.TrucCo && E.Player.Foundation != FoundationGrade.None,
            $"the meridian storm lays a foundation: Trúc Cơ, {E.Player.Foundation} grade");
        Check(TuTien.Core.Rules.Skills.Knows(E.Player, "liet_diem_dia"), "at Luyện Khí 5 the Hỏa root comprehended Scorched Earth");
        return world;
    }

    /// <summary>
    /// Every second-tier art gets a fight of its own against one of the Ancient Tree Hollow's new creatures,
    /// cast by the autopilot from slot 1: every new cast shape and every new behaviour runs for real.
    /// </summary>
    private async Task<WorldScreen> NewBeastsAndArts(WorldScreen world)
    {
        (string Art, string Foe)[] pairs =
        {
            ("kim_quang_tram", "black_bear"), ("van_diep_ho_than", "blood_bat"), ("thuy_long_ba", "fire_fox"),
            ("liet_diem_dia", "wandering_wraith"), ("tho_lao_thuat", "azure_python"),
        };
        foreach (var (art, foe) in pairs)
        {
            world.DebugPlace(WorldScreen.TileCenter(33, 13));
            DevCheats.Restore(E);
            DevCheats.LearnArt(E, art);
            Check(E.SetSkillSlot(0, art), $"{art} goes in the first slot");
            world.Player.SyncFromEngine();
            await Frames(4);
            var fights = E.Player.Counters.Fights;
            world.Fight(E.StartAdventureFight(foe, "ancient_tree_hollow")!);
            Check(world.Battle != null, $"the {foe} fights where the cultivator stands");
            world.Player.Autopilot = true;
            var used = false;
            var shotAt = -1;
            for (var i = 0; i < 60 * 150 && world.Battle != null; i++)
            {
                // The picture is taken just after the art's first cast, once its windup is over.
                if (!used && world.Battle.SkillUses.ContainsKey(art)) shotAt = i + 18;
                used |= world.Battle.SkillUses.ContainsKey(art);
                if (i == shotAt) await Shot("battle_" + foe);
                await Frames(1);
            }
            world = await FightThrough(world);
            Check(used && E.Player.Counters.Fights == fights + 1 && E.ActiveEncounter == null, $"{art} is cast against the {foe}, and the fight resolves");
            world = await Settle(world);
        }
        return world;
    }

    /// <summary>At Trúc Cơ the cultivator rides the sword across water that stops anyone on foot.</summary>
    private async Task<WorldScreen> SwordFlight(WorldScreen world)
    {
        DevCheats.Restore(E);
        world.Player.SyncFromEngine();
        // A bank with the river two tiles wide east of it (the river winds; find such a stretch).
        var map = E.Map;
        bool Ground(int x, int y) => map.At(x, y) is not (Terrain.Water or Terrain.Peak);
        var bank = new Vector2I(-1, -1);
        for (var y = map.Height / 2; y < map.Height - 2 && bank.X < 0; y++)
            for (var x = 1; x < map.Width - 3 && bank.X < 0; x++)
                if (Ground(x, y) && map.At(x + 1, y) == Terrain.Water && map.At(x + 2, y) == Terrain.Water && Ground(x + 3, y))
                    bank = new Vector2I(x, y);
        Check(bank.X >= 0, $"the river has a stretch two tiles wide (bank at {bank})");
        // Something roaming the bank may jump the cultivator while they stand there: fight it off and try again.
        for (var tries = 0; tries < 4; tries++)
        {
            world.DebugPlace(WorldScreen.TileCenter(bank.X, bank.Y));
            await Frames(4);
            if (world.Battle == null && !world.Frozen) await Hold(Key.D, 45);
            if (world.Battle == null && !world.Frozen) break;
            Log($"sword flight: interrupted on the bank ({(world.Battle != null ? "a fight" : "a panel")}), trying again");
            world = await Settle(world);
            DevCheats.Restore(E);
            world.Player.SyncFromEngine();
        }
        Check(E.Player.X == bank.X && world.Tile.X == bank.X, "on foot, the river stops you");
        await Tap(Key.V);
        Check(world.PlayerBody.Flying,
            $"V takes to the flying sword (fight {world.Battle != null}, frozen {world.Frozen}, stun {world.PlayerBody.Stun:0.00}, realm {E.Player.Realm})");
        var sawWater = false;
        KeyEvent(Key.D, true);
        for (var i = 0; i < 100 && E.Player.X < bank.X + 3; i++)
        {
            await Frames(1);
            sawWater |= map.At(E.Player.X, E.Player.Y) == Terrain.Water;
            if (i == 20) await Shot("sword_flight");
        }
        await Frames(12);
        KeyEvent(Key.D, false);
        await Frames(2);
        Check(sawWater && E.Player.X >= bank.X + 3, "flying crosses the river, tile by tile");
        await Tap(Key.V);
        Check(!world.PlayerBody.Flying && Ground(world.Tile.X, world.Tile.Y), "V lands again, on the far bank");

        // Travel from the map: the way back crosses water, so the cultivator rides the sword and lands at the end.
        world = await Settle(World);
        var mapPanel = new MapPanel(world);
        world.OpenPanel(mapPanel);
        await Frames(2);
        mapPanel.Pick(bank);
        Check(mapPanel.Path is { Steps.Count: > 0 }, "the map plans a way back over the river");
        mapPanel.SetOff();
        await Frames(2);
        Check(world.PlayerBody.Flying, "setting off over water takes to the sword");
        await Until(() => world.Player.Route.Count == 0 || world.Battle != null, 60 * 10, "the flight back");
        await Frames(2);
        Check(world.Battle != null || (world.Tile == bank && !world.PlayerBody.Flying), "the sword sets you down where the way ends");
        return await Settle(World);
    }

    /// <summary>
    /// A phone's way of playing, through touch events pushed into the viewport: the interface drawn bigger,
    /// the stick walks, the Interact button opens the bounty board, a tap on open ground walks there and two
    /// fingers pinch the zoom; in a fight an art button casts, the pause button pauses, and holding the martial art aims
    /// itself at the foe until the fight is won. Panels still fit the smaller screen.
    /// </summary>
    private async Task<WorldScreen> TouchByHand(WorldScreen world)
    {
        var game = Game.Instance;
        var fullSize = GetViewport().GetVisibleRect().Size;
        game.Touch = TouchMode.On;
        game.UiScale = 1.35f;
        game.ApplyDisplay();
        world.DebugPlace(new Vector2(846, 3040));
        DevCheats.Restore(E);
        world.Player.SyncFromEngine();
        await Frames(6);
        var screen = GetViewport().GetVisibleRect().Size;
        Log($"interface at 135%: the screen is {screen.X:0}×{screen.Y:0} (from {fullSize.X:0}×{fullSize.Y:0})");
        var pad = world.TouchPad;
        Check(pad.Visible && pad.CentreOf("attack") != null, "touch controls appear when switched on");

        // Interact: by the bounty board its button shows, and a press opens the town.
        var interact = pad.CentreOf("interact");
        Check(interact != null, "the Interact button shows by the bounty board");
        await Shot("touch_world");
        await TapScreen(1, interact!.Value);
        Check(world.CurrentPanel is TownPanel, "pressing Interact opens the bounty board");
        var panelRect = world.CurrentPanel!.GetGlobalRect();
        Check(new Rect2(Vector2.Zero, screen).Grow(1).Encloses(panelRect), $"the town panel fits the scaled screen ({panelRect.Size.X:0}×{panelRect.Size.Y:0})");
        await Shot("touch_panel");
        world.ClosePanel();
        await Frames(3);

        // The stick: a thumb in the lower left, dragged right, walks east; letting go stops.
        var before = world.PlayerBody.Pos;
        var home = pad.StickCentre;
        TouchAt(0, home, true);
        await Frames(1);
        DragTo(0, home + new Vector2(80, 0));
        await Frames(30);
        Check(TouchControls.Stick.X > 0.5f && world.PlayerBody.Pos.X > before.X + 40, "dragging the stick right walks east");
        TouchAt(0, home + new Vector2(80, 0), false);
        await Frames(2);
        Check(TouchControls.Stick == Vector2.Zero, "letting go of the stick stops");

        // A tap on open ground walks there (a spot clear of the controls, walls and anything to use).
        var canvas = world.GetCanvasTransform();
        Vector2? target = null;
        foreach (var offset in new[] { new Vector2(0, -230), new Vector2(230, 0), new Vector2(200, -200), new Vector2(-200, -200), new Vector2(0, 230) })
        {
            var spot = world.PlayerBody.Pos + offset;
            var at = canvas * spot;
            if (!world.Walls.Free(spot, 20) || pad._HasPoint(at) || world.Interactions.Any(i => i.At().DistanceTo(spot) < 140)) continue;
            target = spot;
            break;
        }
        Check(target != null, "there is open ground to tap near the board");
        var start = world.PlayerBody.Pos.DistanceTo(target!.Value);
        await TapScreen(0, canvas * target.Value);
        await Frames(50);
        Check(world.PlayerBody.Pos.DistanceTo(target.Value) < start - 60, "a tap on the ground walks there");

        // Two fingers apart pinch the camera closer.
        world.Player.Route.Clear();
        var zoom = world.ZoomTarget;
        var mid = new Vector2(screen.X / 2, screen.Y * 0.3f);
        TouchAt(0, mid - new Vector2(60, 0), true);
        TouchAt(1, mid + new Vector2(60, 0), true);
        await Frames(2);
        DragTo(0, mid - new Vector2(90, 0));
        DragTo(1, mid + new Vector2(90, 0));
        await Frames(2);
        TouchAt(0, mid - new Vector2(90, 0), false);
        TouchAt(1, mid + new Vector2(90, 0), false);
        await Frames(2);
        Check(world.ZoomTarget > zoom * 1.3f, $"two fingers apart zoom in ({zoom:0.00} → {world.ZoomTarget:0.00})");
        world.Zoom(1 / world.ZoomTarget);

        // A fight: the arts and pause appear; an art button casts, the pause button pauses, and holding the martial art wins it.
        // (Fresh cooldowns: the last fight may have ended just after this art was cast.)
        DevCheats.Restore(E);
        world.Player.SyncFromEngine();
        world.Player.Cooldowns.Clear();
        var art = E.Player.SkillSlots[0];
        world.Fight(E.StartAdventureFight("black_bear", "ancient_tree_hollow")!);
        await Frames(4);
        Check(world.Battle != null && pad.CentreOf("skill_1") != null && pad.CentreOf("pause") != null && pad.CentreOf("interact") == null,
            "in a fight the arts and pause take the place of Interact");
        await TapScreen(1, pad.CentreOf("skill_1")!.Value);
        Check(world.Battle?.SkillUses.ContainsKey(art) == true,
            $"the art button casts {art} (cooldown {world.Player.CooldownLeft(art):0.0}, stun {world.PlayerBody.Stun:0.0}, dash {world.Player.DashTime:0.0}, frozen {world.Frozen})");
        await TapScreen(1, pad.CentreOf("pause")!.Value);
        Check(world.Frozen && !pad.Visible, "the pause button pauses the fight (the controls step aside)");
        world.SetPaused(false);
        await Frames(2);
        var basic = world.Player.Basic.Id;
        var attack = pad.CentreOf("attack")!.Value;
        TouchAt(2, attack, true);
        var struck = false;
        for (var i = 0; i < 60 * 25 && world.Battle != null; i++)
        {
            struck |= world.Battle.SkillUses.ContainsKey(basic);
            if (i == 45) await Shot("touch_battle");
            await Frames(1);
        }
        TouchAt(2, attack, false);
        await Frames(2);
        Check(struck && world.Battle == null, "holding the martial art aims itself at the bear and wins the fight");
        world = await Settle(World);

        game.Touch = TouchMode.Auto;
        game.UiScale = 0;
        game.ApplyDisplay();
        await Frames(3);
        Check(!World.TouchPad.Visible, "touch controls go away again (Auto on a desktop)");
        return world;
    }

    private void TouchAt(int finger, Vector2 at, bool pressed) =>
        GetViewport().PushInput(new InputEventScreenTouch { Index = finger, Position = at, Pressed = pressed }, true);

    private void DragTo(int finger, Vector2 at) =>
        GetViewport().PushInput(new InputEventScreenDrag { Index = finger, Position = at }, true);

    private async Task TapScreen(int finger, Vector2 at)
    {
        TouchAt(finger, at, true);
        await Frames(2);
        TouchAt(finger, at, false);
        await Frames(3);
    }

    /// <summary>
    /// Walk to a tile the way the map's travel does (a route of tile centres), fighting whatever jumps out
    /// and closing whatever opens on the way (both stop the route, so it's planned again after).
    /// </summary>
    private async Task<WorldScreen> Walk(WorldScreen world, int x, int y, string? shot)
    {
        var path = E.PlanPath(x, y);
        if (path == null || path.Steps.Count == 0) return world;
        static void Plan(WorldScreen w, int x, int y)
        {
            w.Player.Route.Clear();
            foreach (var step in E.PlanPath(x, y)?.Steps ?? new()) w.Player.Route.Enqueue(WorldScreen.TileCenter(step.X, step.Y));
        }
        Plan(world, x, y);
        var shotAt = path.Steps.Count / 2;
        for (var i = 0; i < 60 * 40; i++)
        {
            await Frames(1);
            world = World;
            if (world.Battle != null || world.PanelOpen)
            {
                world = await Settle(world);
                Plan(world, x, y);
            }
            if (shot != null && world.Player.Route.Count == shotAt)
            {
                await Shot(shot);
                shot = null;
            }
            if (world.Player.Route.Count == 0) break;
        }
        await Frames(2);
        return World;
    }

    /// <summary>Let the autopilot play the current fight to the end; returns the world it leaves.</summary>
    private async Task<WorldScreen> FightThrough(WorldScreen world, string? shot = null)
    {
        await FightIn(world, shot);
        await Frames(2);
        return World;
    }

    private async Task FightIn(FieldScreen field, string? shot = null)
    {
        field.Player.Autopilot = true;
        for (var i = 0; i < 60 * 180 && Main.Instance.Field == field && field.Battle != null; i++)
        {
            if (i == 60 * 2 && shot != null) await Shot(shot);
            await Frames(1);
        }
        if (Main.Instance.Field == field && field.Battle != null) throw new TimeoutException("the fight never finished");
        field.Player.Autopilot = false;
    }

    private async Task<WorldScreen> UntilWorld(int maxFrames = 60 * 180)
    {
        for (var i = 0; i < maxFrames; i++)
        {
            if (Main.Instance.World is { } w) return w;
            await Frames(1);
        }
        throw new TimeoutException("the world never came back");
    }

    private async Task Until(Func<bool> condition, int maxFrames, string what)
    {
        for (var i = 0; i < maxFrames; i++)
        {
            if (condition()) return;
            await Frames(1);
        }
        throw new TimeoutException("waited too long: " + what);
    }

    /// <summary>Close panels (and fight whatever the world throws at us) until the field is clear.</summary>
    private async Task<WorldScreen> Settle(WorldScreen world)
    {
        for (var tries = 0; tries < 16; tries++)
        {
            await Frames(3);
            world = World;
            if (world.Battle != null)
            {
                world = await FightThrough(world);
                continue;
            }
            if (E.State.World.PendingAmbush != null && !world.PanelOpen)
            {
                await Frames(5);
                continue;
            }
            if (!world.PanelOpen) return world;
            world.ClosePanel();
        }
        throw new InvalidOperationException("could not settle the world screen");
    }

    private async Task Frames(int n)
    {
        for (var i = 0; i < n; i++) await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
    }

    private async Task Shot(string name)
    {
        if (!Rendering) return;
        RenderingServer.RenderLoopEnabled = true;
        await ToSignal(RenderingServer.Singleton, RenderingServer.SignalName.FramePostDraw);
        await ToSignal(RenderingServer.Singleton, RenderingServer.SignalName.FramePostDraw);
        using var image = GetViewport().GetTexture().GetImage();
        RenderingServer.RenderLoopEnabled = false;
        _shotIndex += 1;
        var path = Path.Combine(_shots!, $"{_shotIndex:00}_{name}.png");
        image.SavePng(path);
        Log("screenshot " + path);
    }
}
