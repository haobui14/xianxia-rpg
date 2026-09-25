using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
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
    private readonly Locale _locale;
    private int _shotIndex;
    private int _languageChecks, _controlTexts, _paintedTexts;

    /// <param name="shotsDir">Where to save screenshots (null: none).</param>
    /// <param name="locale">The language to play in (<c>--locale vi</c>; English by default).</param>
    public SmokeTest(string? shotsDir, Locale locale = Locale.En)
    {
        _shots = shotsDir;
        _locale = locale;
    }

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
            // One save per language, so an English and a Vietnamese run can go side by side.
            game.SavePath = _locale == Locale.En ? "user://saves/smoke.json" : "user://saves/smoke_vi.json";
            // Play on the default keys, and never write the player's own settings.
            game.PersistSettings = false;
            KeyMap.Reset();
            game.SetLocale(_locale);
            DrawnText.Seen = new HashSet<string>();
            if (_shots != null) Directory.CreateDirectory(_shots);
            await Steps(game);
            Log($"ok — every screen checked ({_languageChecks} times: {_controlTexts} control texts, {_paintedTexts} painted words) "
                + $"shows only {(_locale == Locale.En ? "English" : "Vietnamese")}, then the other language");
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
            // A developer's sheet: its captions are the icons' code names.
            await Shot("icons", checkLanguage: false);
            sheetLayer.QueueFree();
            await Frames(1);
            DrawnText.Seen!.Clear();
        }

        // ---------------------------------------------------------------- title and creation
        Main.Instance.ShowTitle();
        await Frames(30);
        await Shot("title");
        Main.Instance.GetChildren().OfType<TitleScreen>().FirstOrDefault()?.ShowCreation();
        await Frames(3);
        await Shot("creation");

        // Into the world the way the title's button goes: behind the loading screen, built a slice per frame.
        var root = new SpiritRootState { Elements = { Element.Hoa }, Grade = RootGrade.Kha };
        Main.Instance.EnterWorld(() =>
        {
            game.NewGame("Lâm Vân", 16, root, CultivationPath.Qi, 20240917UL);
            return true;
        });
        await Frames(3);
        Check(Main.Instance.Loading != null && Main.Instance.World == null, "entering the world shows the loading screen first");
        await Until(() => Main.Instance.Loading is not { Shown: < 0.4f }, 60 * 20, "the loading bar to move");
        if (Main.Instance.Loading != null) await Shot("loading");
        await Until(() => Main.Instance.Loading == null, 60 * 30, "the world to be built behind the loading screen");
        var world = World;
        Check(world.Actors.Count > 1 && world.Interactions.Count > 3, "the world stands when the loading screen goes");
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
        world = await ArtSlotsByHand(world);

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

        // ---------------------------------------------------------------- a disciple's life: missions, ranks, the treasury
        world = await SectLife(world);

        // ---------------------------------------------------------------- gear, the forge, mastery
        world = await GearAndMastery(world);

        // ---------------------------------------------------------------- the month's wares, a night at the inn
        world = await WaresAndNights(world);

        // ---------------------------------------------------------------- a cultivator fights with all they know
        world = await CultivatorFights(world);

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

        // The other language, switched mid-game: the world, its signs and names, the log and a panel follow at once.
        var other = _locale == Locale.En ? Locale.Vi : Locale.En;
        world = Main.Instance.ShowWorld();
        await Frames(10);
        game.SetLocale(other);
        DrawnText.Seen!.Clear();
        await Frames(30);
        await Shot("world_" + (other == Locale.En ? "en" : "vi"));
        world.OpenPanel(new CharacterPanel());
        await Frames(3);
        await Shot("character_" + (other == Locale.En ? "en" : "vi"));
        world.OpenPanel(new JournalPanel());
        await Frames(3);
        await Shot("journal_" + (other == Locale.En ? "en" : "vi"));
        world.ClosePanel();
        game.SetLocale(_locale);
        DrawnText.Seen.Clear();
        await Frames(3);

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

    /// <summary>
    /// Character → Arts with the mouse: the slot buttons under an art put it in a slot (swapping with what was
    /// there), and a second click on the lit one takes it out. No drop-down pickers anywhere in the panels.
    /// </summary>
    private async Task<WorldScreen> ArtSlotsByHand(WorldScreen world)
    {
        var art = E.Player.SkillSlots[0];
        Check(art.Length > 0, "the first slot holds the awakened art");
        world.OpenPanel(new CharacterPanel());
        await Frames(3);
        await ClickGui(PanelButton(world, "Võ học", "Arts"));
        var move = world.CurrentPanel!.FindChild($"slot_{art}_2", true, false) as Button;
        Check(move is { Disabled: false }, "the Arts tab lists each art with its slot buttons");
        await ClickGui(move!);
        Check(E.Player.SkillSlots[2] == art && E.Player.SkillSlots[0] == "", "clicking an art's slot 3 button moves it there");
        await Shot("character_arts");
        await ClickGui((Button)world.CurrentPanel!.FindChild($"slot_{art}_2", true, false)!);
        Check(E.Player.SkillSlots[2] == "", "clicking the lit slot button takes the art out");
        await ClickGui((Button)world.CurrentPanel!.FindChild($"slot_{art}_0", true, false)!);
        Check(E.Player.SkillSlots[0] == art, "and it goes back into the first slot");
        Check(world.CurrentPanel!.FindChildren("*", "OptionButton", true, false).Count == 0, "the Arts tab opens no drop-down pickers (popup windows)");
        return await Settle(world);
    }

    /// <summary>
    /// A disciple's life at the gate, by mouse: take a mission from the hall's board, do it, report it for
    /// contribution and merit; rise to inner disciple; take the sect's technique from the treasury; open
    /// the spirit-gathering chamber that the new rank unlocks.
    /// </summary>
    private async Task<WorldScreen> SectLife(WorldScreen world)
    {
        var game = Game.Instance;
        // The entrance trial is a real spar and can be lost; this step needs a disciple.
        if (E.Player.SectId == null) game.Notify(E.JoinSect("thanh_van_kiem"));
        Check(E.Player.SectId == "thanh_van_kiem" && E.Player.SectRank == "NgoạiMôn", "an outer disciple of the Azure Cloud Sword Sect");
        var gate = E.Map.Def.Pois.First(p => p.Kind == "sect");
        world.OpenPanel(new SectPanel(gate));
        await Frames(3);
        await Shot("sect_standing");

        await ClickGui(PanelButton(world, "Nhiệm Vụ Đường", "Mission hall"));
        var board = E.MissionBoard();
        Check(board.Count > 0 && board.All(t => t.SectTypes.Contains("Kiếm")), $"the mission hall posts missions for a sword sect ({string.Join(", ", board.Select(t => t.Id))})");
        var offer = board[0];
        await ClickPanel(world, "take_" + offer.Id);
        var held = E.Player.Missions.FirstOrDefault(m => m.TemplateId == offer.Id);
        Check(held != null && E.MissionBoard().All(t => t.Id != offer.Id), $"Take puts {offer.Id} in hand and off the board");
        await Shot("sect_missions");
        // The dev shortcut stands in for the fights, herbs or months it asks for; the rules tests play those.
        game.Notify(DevCheats.FinishMissions(E));
        await Frames(3);
        var (contribution, merit, reward) = (E.Player.Contribution, E.Player.Merit, held!.RewardContribution);
        await ClickPanel(world, "report_missions");
        Check(E.Player.Missions.Count == 0 && E.Player.Contribution == contribution + reward && E.Player.Merit == merit + reward,
            $"reporting at the hall pays {reward} contribution and as much merit");

        // Up the ranks: at Trúc Cơ, 200 merit makes an inner disciple.
        DevCheats.Contribution(E, Math.Max(0, 200 - E.Player.Merit) + 300);
        game.Changed();
        await Frames(2);
        await ClickGui(PanelButton(world, "Thân phận", "Standing"));
        await ClickPanel(world, "promote");
        Check(E.Player.SectRank == "NộiMôn", "Rise: the merit and the realm make an inner disciple");
        await Shot("sect_promoted");

        // The treasury keeps the sect's own technique for inner disciples.
        await ClickGui(PanelButton(world, "Tàng Bảo Các", "Treasury"));
        var before = E.Player.Contribution;
        await ClickPanel(world, "exchange_thanh_van_kiem_kinh");
        Check(TuTien.Core.Rules.Inventory.Count(E.Player, "thanh_van_kiem_kinh") == 1 && E.Player.Contribution == before - 260,
            "the treasury gives the Azure Cloud Sword Canon for 260 contribution");
        await Shot("sect_treasury");

        // The new rank opens the spirit-gathering chamber: seclusion there runs on spirit stones.
        await ClickGui(PanelButton(world, "Thân phận", "Standing"));
        E.Player.SpiritStones += 10;
        game.Changed();
        await Frames(2);
        await ClickPanel(world, "chamber");
        Check(world.CurrentPanel is SeclusionPanel, "the chamber opens a seclusion in it");
        await Shot("sect_chamber");
        var stones = E.Player.SpiritStones;
        var chamber = E.Chamber!;
        var report = E.Seclude(1, chamber.QiDensity, stonesPerMonth: chamber.StonesPerMonth);
        Check(report.Months == 1 && E.Player.SpiritStones == stones - chamber.StonesPerMonth + 1, "a month in the chamber costs its stones (the stipend brings one back)");
        return await Settle(world);
    }

    /// <summary>Scroll a named button of the open panel into view, then click it.</summary>
    private async Task ClickPanel(WorldScreen world, string name)
    {
        var button = world.CurrentPanel!.FindChild(name, true, false) as Button
                     ?? throw new InvalidOperationException($"no button '{name}' in the {world.CurrentPanel.GetType().Name}");
        world.CurrentPanel.FindChildren("*", "ScrollContainer", true, false).OfType<ScrollContainer>().First().EnsureControlVisible(button);
        await Frames(2);
        Check(!button.Disabled, $"'{name}' can be pressed");
        await ClickGui(button);
    }

    /// <summary>A button in the open panel with this text (in either language).</summary>
    /// <summary>
    /// Gear and what money grows, by mouse: buy armour at the stall and put it on from the bag; at the forge buy
    /// a stone and enhance the armour's slot; change a spirit stone for silver; on the character sheet train an
    /// art with silver and deepen the sect's technique with spirit stones.
    /// </summary>
    private async Task<WorldScreen> GearAndMastery(WorldScreen world)
    {
        var game = Game.Instance;
        var village = E.Map.Def.Pois.First(p => p.Kind == "town");
        E.Player.Silver += 2000;
        E.Player.SpiritStones += 60;
        game.Notify(E.Buy(E.TownFor(village)!, "leather_armor"));

        world.OpenPanel(new InventoryPanel());
        await Frames(3);
        var hpMax = E.Player.HpMax;
        await ClickGui(await Reveal(world, "equip_leather_armor"));
        Check(E.Player.Gear[TuTien.Core.Rules.Equipment.Chest].ItemId == "leather_armor" && E.Player.HpMax == hpMax + 20,
            "the bag's Equip puts the leather armour on (+20 max health)");
        await Shot("inventory_gear");

        world.OpenPanel(new TownPanel(village, TownPanel.ForgeTab));
        await Frames(3);
        var common = TuTien.Core.Rules.Equipment.StoneCommon;
        var stones = TuTien.Core.Rules.Inventory.Count(E.Player, common);
        await ClickGui(await Reveal(world, "buy_" + common));
        Check(TuTien.Core.Rules.Inventory.Count(E.Player, common) == stones + 1, "the forge sells a common stone for silver");
        var silver = E.Player.Silver;
        var slot = E.Player.Gear[TuTien.Core.Rules.Equipment.Chest];
        await ClickGui(await Reveal(world, "enhance_" + TuTien.Core.Rules.Equipment.Chest));
        Check(slot.Level == 1 && E.Player.Silver == silver - 100 && E.Player.HpMax == hpMax + 22,
            "enhancing the armour's slot to +1 costs 100 silver and a stone, and the armour gives 10% more health");
        await Shot("forge");

        world.OpenPanel(new TownPanel(village, TownPanel.MarketTab));
        await Frames(3);
        silver = E.Player.Silver;
        var spirit = E.Player.SpiritStones;
        await ClickGui(await Reveal(world, "exchange_1"));
        Check(E.Player.SpiritStones == spirit - 1 && E.Player.Silver == silver + GameEngine.SpiritStoneRate, "the money changer turns a spirit stone into 100 silver");

        world.OpenPanel(new CharacterPanel());
        await Frames(3);
        await ClickGui(PanelButton(world, "Võ học", "Arts"));
        var art = E.Player.Skills[0];
        var level = art.Level;
        await ClickGui(await Reveal(world, "train_" + art.Id));
        Check(art.Level == level + 1, $"training {art.Id} with silver raises it a level ({level} → {art.Level})");
        // A technique to deepen: the stall's Qi Condensation Manual, read.
        game.Notify(E.Buy(E.TownFor(village)!, "qi_condensation_manual"));
        game.Notify(E.UseItem("qi_condensation_manual"));
        await Frames(3);
        var technique = E.Player.Techniques.FirstOrDefault();
        Check(technique != null, "reading the Qi Condensation Manual teaches its technique");
        var depth = technique!.Level;
        await ClickGui(await Reveal(world, "deepen_" + technique.Id));
        Check(technique.Level == depth + 1, $"deepening {technique.Id} with spirit stones raises its level ({depth} → {technique.Level})");
        await Shot("character_mastery");
        world.ClosePanel();
        return await Settle(world);
    }

    /// <summary>
    /// The market's wares of the month, bought by mouse; then nights at the inn until one brings an event (a
    /// dream, a visitor), which opens on the spot.
    /// </summary>
    private async Task<WorldScreen> WaresAndNights(WorldScreen world)
    {
        var village = E.Map.Def.Pois.First(p => p.Kind == "town");
        var town = E.TownFor(village)!;
        E.Player.Silver += 1000;
        world.OpenPanel(new TownPanel(village, TownPanel.MarketTab));
        await Frames(3);
        var wares = E.Wares(town);
        Check(wares.Offers.Count == TuTien.Core.Rules.Market.WaresPerMonth, $"the stall lays out {wares.Offers.Count} wares this month");
        var i = wares.Offers.FindIndex(o => o.SpiritStones == 0 && o.Left > 0);
        Check(i >= 0, "one of them sells for silver");
        var ware = wares.Offers[i];
        var have = TuTien.Core.Rules.Inventory.Count(E.Player, ware.ItemId);
        await ClickGui(await Reveal(world, $"ware_{i}"));
        Check(TuTien.Core.Rules.Inventory.Count(E.Player, ware.ItemId) == have + 1, $"buying the month's {ware.ItemId} puts it in the bag");
        await Shot("market_wares");

        world.OpenPanel(new TownPanel(village, TownPanel.InnTab));
        await Frames(3);
        for (var night = 0; night < 40 && world.CurrentPanel is not EventPanel; night++)
        {
            E.Player.Silver += 20;
            E.Player.Footwork = Math.Max(E.Player.Footwork, 5);
            await ClickGui(await Reveal(world, "rest"));
        }
        Check(world.CurrentPanel is EventPanel, $"a night at the inn brings an event ({E.RestEvent})");
        await Shot("inn_night");
        world.ClosePanel();
        return await Settle(world);
    }

    /// <summary>
    /// A cultivator fights with everything they know, not one bolt. One NPC per element, each a Qi Condensation 6
    /// disciple of the Azure Cloud Sword Sect, carries their root's first art, its second and the sect's sword
    /// dash (maybe a guard or a heal too). Sparred while the player only stands and takes it, each must use at
    /// least two different arts, and together they must show every kind of cast: bolts, needles, the cleave, the
    /// spikes, the beam, the leaves, the wave, burning ground, pillars and the dash.
    /// </summary>
    private async Task<WorldScreen> CultivatorFights(WorldScreen world)
    {
        var npc = E.State.World.Npcs.First(n => n.Alive && !n.Anchor);
        var seen = new HashSet<string>();
        foreach (var element in new[] { Element.Kim, Element.Moc, Element.Thuy, Element.Hoa, Element.Tho })
        {
            npc.Realm = Realm.LuyenKhi;
            npc.Stage = 6;
            npc.Elements = new List<Element> { element };
            npc.SectId = "thanh_van_kiem";
            npc.Alive = true;
            npc.InjuredMonths = 0;
            var kit = TuTien.Core.Rules.Skills.NpcKit(npc, E.Content);
            Check(kit.Count >= 3, $"a {element} disciple at Qi Condensation 6 knows {kit.Count} arts ({string.Join(", ", kit)})");
            DevCheats.Restore(E);
            world.Player.SyncFromEngine();
            var enc = E.ChallengeNpc(npc.Id, lethal: false);
            Check(enc?.ArtsOverride != null && enc.ArtsOverride.SequenceEqual(kit), "a spar gives the NPC their own arts");
            world.Fight(enc!);
            await Frames(3);
            var battle = world.Battle ?? throw new InvalidOperationException("the spar never started");
            for (var i = 0; i < 60 * 14 && world.Battle == battle; i++)
            {
                if (i % 20 == 0) world.PlayerBody.Hp = world.PlayerBody.HpMax;
                if (i == 60 * 6 && element == Element.Thuy) await Shot("npc_arts");
                await Frames(1);
            }
            Check(battle.EnemyArtUses.Count >= 2,
                $"the {element} disciple used {battle.EnemyArtUses.Count} different arts ({string.Join(", ", battle.EnemyArtUses.Select(kv => $"{kv.Key} ×{kv.Value}"))})");
            seen.UnionWith(battle.EnemyArtUses.Keys);
            if (world.Battle == battle) await FightIn(world);
            world = await Settle(World);
        }
        Check(seen.Count >= 9, $"between them the disciples cast {seen.Count} different arts ({string.Join(", ", seen.OrderBy(s => s))})");
        return world;
    }

    /// <summary>The panel's button called <paramref name="name"/>, scrolled into view so a click lands on it.</summary>
    private async Task<Button> Reveal(WorldScreen world, string name)
    {
        var button = world.CurrentPanel!.FindChild(name, true, false) as Button
                     ?? throw new InvalidOperationException($"no button '{name}' in the {world.CurrentPanel.GetType().Name}");
        for (Node? n = button.GetParent(); n != null; n = n.GetParent())
        {
            if (n is not ScrollContainer scroll) continue;
            scroll.EnsureControlVisible(button);
            break;
        }
        await Frames(2);
        Check(!button.Disabled, $"'{name}' can be pressed");
        return button;
    }

    private static Button PanelButton(WorldScreen world, string vi, string en) =>
        world.CurrentPanel!.FindChildren("*", "Button", true, false).OfType<Button>().FirstOrDefault(b => (b.Text == vi || b.Text == en) && b.IsVisibleInTree())
        ?? throw new InvalidOperationException($"no button '{en}' in the {world.CurrentPanel.GetType().Name}");

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
        // Something roaming the bank may jump the cultivator while they stand there (even as the sword is
        // drawn): fight it off and try again.
        for (var tries = 0; tries < 4; tries++)
        {
            world.DebugPlace(WorldScreen.TileCenter(bank.X, bank.Y));
            await Frames(4);
            if (world.Battle == null && !world.Frozen) await Hold(Key.D, 45);
            if (world.Battle == null && !world.Frozen)
            {
                Check(E.Player.X == bank.X && world.Tile.X == bank.X, "on foot, the river stops you");
                await Tap(Key.V);
                if (world.PlayerBody.Flying) break;
            }
            Log($"sword flight: interrupted on the bank ({(world.Battle != null ? "a fight" : world.Frozen ? "a panel" : "no take-off")}), trying again");
            world = await Settle(world);
            DevCheats.Restore(E);
            world.Player.SyncFromEngine();
        }
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

        // Character → Arts with a finger: an art's slot button moves it, a second touch takes it out.
        var slotsBefore = E.Player.SkillSlots.ToList();
        world.OpenPanel(new CharacterPanel());
        await Frames(3);
        await TapScreen(0, PanelButton(world, "Võ học", "Arts").GetGlobalRect().GetCenter());
        var first = E.Player.Skills[0].Id;
        Button SlotButton(int slot)
        {
            var b = (Button)world.CurrentPanel!.FindChild($"slot_{first}_{slot}", true, false)!;
            world.CurrentPanel.FindChildren("*", "ScrollContainer", true, false).OfType<ScrollContainer>().First().EnsureControlVisible(b);
            return b;
        }
        // A slot the art isn't in yet (earlier steps moved the arts around).
        var slot = Enumerable.Range(0, 4).Last(i => E.Player.SkillSlots[i] != first);
        SlotButton(slot);
        await Frames(2);
        await TapScreen(0, SlotButton(slot).GetGlobalRect().GetCenter());
        Check(E.Player.SkillSlots[slot] == first, $"a finger on {first}'s slot {slot + 1} button puts it there");
        await Shot("touch_arts");
        await TapScreen(0, SlotButton(slot).GetGlobalRect().GetCenter());
        Check(E.Player.SkillSlots[slot] == "", "a second touch on the lit button takes it out");
        for (var i = 0; i < slotsBefore.Count; i++) E.SetSkillSlot(i, slotsBefore[i]);
        Check(E.Player.SkillSlots.SequenceEqual(slotsBefore), "the slots are as they were");
        world.ClosePanel();
        world.Player.SyncFromEngine();
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

    // ---------------------------------------------------------------- one language at a time

    /// <summary>Words that read the same on either side: the language switch's own labels.</summary>
    private static readonly HashSet<string> BothLanguages = new() { "Tiếng Việt", "English" };

    /// <summary>Plainly English words that no Vietnamese sentence here would use.</summary>
    private static readonly HashSet<string> EnglishWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "the", "and", "you", "your", "with", "from", "this", "that", "month", "months", "level", "press", "click", "open",
        "close", "settings", "continue", "save", "load", "quit", "attack", "damage", "health", "spirit", "realm", "skill",
        "skills", "arts", "map", "inventory", "character", "journal", "fight", "spar", "flee", "escape", "ready", "back",
        "new", "life", "world", "village", "sect", "inn", "market", "silver", "stones", "pill", "pills", "herb", "herbs",
        "beast", "beasts", "trial", "breakthrough", "cultivation", "footwork", "days", "year", "spring", "summer",
        "autumn", "winter", "gate", "hall", "notices", "safe", "danger", "rest", "buy", "sell", "reward", "bounty",
        "enemy", "enemies", "martial", "ultimate", "dash", "strike", "boss", "enraged", "floor", "chest", "chests",
        "none", "empty", "weapon", "armor", "equip", "learn", "manual", "technique", "karma", "gratitude", "grudge",
    };

    private static bool WrongLanguage(string text, Locale locale)
    {
        if (string.IsNullOrWhiteSpace(text) || BothLanguages.Contains(text.Trim())) return false;
        if (locale == Locale.En) return Names.HasVietnamese(text);
        return Regex.Split(text, @"[^\p{L}]+").Any(word => word.Length > 1 && EnglishWords.Contains(word));
    }

    /// <summary>The words of every visible control under <paramref name="node"/> (not what the player typed).</summary>
    private static void Gather(Node node, List<string> texts)
    {
        if (node is CanvasItem { Visible: false } || node is CanvasLayer { Visible: false } || node is LineEdit) return;
        switch (node)
        {
            case RichTextLabel rich:
                texts.Add(rich.GetParsedText());
                break;
            case Label label:
                texts.Add(label.Text);
                break;
            case OptionButton option:
                for (var i = 0; i < option.ItemCount; i++) texts.Add(option.GetItemText(i));
                break;
            case Button button:
                texts.Add(button.Text);
                break;
        }
        if (node is Control { TooltipText.Length: > 0 } control) texts.Add(control.TooltipText);
        foreach (var child in node.GetChildren()) Gather(child, texts);
    }

    /// <summary>
    /// Everything on screen is in the interface language: in English no Vietnamese letter shows (names are written
    /// plain), in Vietnamese no English sentence does. Reads every visible control and every word painted since the
    /// last check.
    /// </summary>
    private void CheckLanguage(string where)
    {
        var locale = Game.Instance.Locale;
        var texts = new List<string>();
        Gather(GetTree().Root, texts);
        _controlTexts += texts.Count;
        if (DrawnText.Seen != null)
        {
            _paintedTexts += DrawnText.Seen.Count;
            texts.AddRange(DrawnText.Seen);
            DrawnText.Seen.Clear();
        }
        var wrong = texts.Where(t => WrongLanguage(t, locale)).Distinct().ToList();
        if (wrong.Count > 0)
            throw new InvalidOperationException($"check failed: '{where}' shows words that aren't {(locale == Locale.En ? "English" : "Vietnamese")}: "
                                                + string.Join(" | ", wrong.Take(15)));
        _languageChecks++;
    }

    private async Task Shot(string name, bool checkLanguage = true)
    {
        if (checkLanguage) CheckLanguage(name);
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
