using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Godot;
using TuTien.Core;
using TuTien.Core.State;
using TuTienLuc.Arena;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;
using TuTienLuc.World;

namespace TuTienLuc.Dev;

/// <summary>
/// Plays the slice end to end without a human: title → new life → map, panels and walking →
/// month turn → a fight (autopilot) → the breakthrough trial → a fight with spirit arts → the sect
/// trial → seclusion → save/load round trip. Run with
/// <c>godot --headless --fixed-fps 60 --path game/godot -- --smoke</c>; add <c>--shots DIR</c> (with a
/// real display, e.g. xvfb) to save screenshots. Exits 0 on success, 1 on failure.
/// </summary>
public partial class SmokeTest : Node
{
    private readonly string? _shots;
    private int _shotIndex;

    public SmokeTest(string? shotsDir) => _shots = shotsDir;

    private static GameEngine E => Game.Instance.Engine!;

    public override void _Ready() => _ = Run();

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
            if (_shots != null) Directory.CreateDirectory(_shots);
            await Steps(game);
            Log("PASSED");
            GetTree().Quit(0);
        }
        catch (Exception ex)
        {
            GD.PrintErr("[smoke] FAILED: " + ex);
            GetTree().Quit(1);
        }
    }

    private async Task Steps(Game game)
    {
        // ---------------------------------------------------------------- title and creation
        Main.Instance.ShowTitle();
        await Frames(4);
        await Shot("title");
        Main.Instance.GetChildren().OfType<TitleScreen>().FirstOrDefault()?.ShowCreation();
        await Frames(3);
        await Shot("creation");

        var root = new SpiritRootState { Elements = { Element.Hoa }, Grade = RootGrade.Kha };
        game.NewGame("Lâm Vân", 16, root, CultivationPath.Qi, 20240917UL);
        var world = Main.Instance.ShowWorld();
        await Frames(8);
        Check(E.Player.Realm == Realm.PhamNhan && E.Player.Footwork > 0, "new life starts as a mortal with footwork");
        await Shot("world");

        // ---------------------------------------------------------------- panels
        foreach (var panel in new InkPanel[] { new CharacterPanel(), new InventoryPanel(), new JournalPanel() })
        {
            world.OpenPanel(panel);
            await Frames(3);
            await Shot(panel.GetType().Name);
        }
        var village = E.Map.Def.Pois.First(p => p.Kind == "town");
        world.OpenPanel(new TownPanel(village));
        await Frames(3);
        await Shot("town");
        var silver = E.Player.Silver;
        game.Notify(E.Buy(E.TownFor(village)!, "hoi_huyet_tan"));
        Check(E.Player.Silver < silver, "buying a pill spends silver");
        world.ClosePanel();

        // ---------------------------------------------------------------- walking
        var start = new Vector2I(E.Player.X, E.Player.Y);
        var target = new[] { (5, 0), (0, -5), (-4, 0), (0, 4), (3, 3) }
            .Select(d => new Vector2I(start.X + d.Item1, start.Y + d.Item2))
            .FirstOrDefault(c => E.Map.InBounds(c.X, c.Y) && E.PlanPath(c.X, c.Y) is { Steps.Count: > 0 } path && path.Cost <= E.Player.Footwork);
        var planned = E.PlanPath(target.X, target.Y);
        Check(planned != null, "a path can be planned nearby");
        world.Map.PlannedPath = planned;
        world.Map.Hover = target;
        await Frames(3);
        await Shot("path");
        world.Map.PlannedPath = null;
        var footwork = E.Player.Footwork;
        foreach (var step in planned!.Steps)
        {
            world.StepBy(step.X - E.Player.X, step.Y - E.Player.Y);
            await Frames(2);
            if (Main.Instance.Arena is { } surprise) world = await FightThrough(surprise);
            if (Main.Instance.World?.PanelOpen == true) break;
        }
        world = Main.Instance.World!;
        Check(E.Player.Footwork < footwork || E.Player.X != start.X || E.Player.Y != start.Y, "walking spends footwork");
        world = await Settle(world);

        // ---------------------------------------------------------------- the month turn
        var month = E.State.Calendar.MonthIndex;
        world.EndMonth();
        await Frames(3);
        await Shot("month");
        Check(E.State.Calendar.MonthIndex == month + 1, "ending the month advances the calendar");
        world = await Settle(world);

        // ---------------------------------------------------------------- a fight
        var fights = E.Player.Counters.Fights;
        var wolf = E.StartAdventureFight("forest_wolf", "verdant_forest")!;
        world = await FightThrough(Main.Instance.ShowArena(wolf), "arena_wolf");
        Check(E.Player.Counters.Fights == fights + 1 && E.ActiveEncounter == null, "the wolf fight resolved through the engine");
        await Shot("combat_result");
        world = await Settle(world);

        // ---------------------------------------------------------------- the breakthrough trial
        for (var attempt = 1; attempt <= 3 && E.Player.Realm == Realm.PhamNhan; attempt++)
        {
            game.Notify(DevCheats.FillToBreakthrough(E));
            Check(E.BreakthroughReady, "cultivation fills to a pending breakthrough");
            world.OpenPanel(new BreakthroughPanel());
            await Frames(3);
            if (attempt == 1) await Shot("breakthrough");
            var trial = Main.Instance.ShowBreakthroughTrial();
            trial.Autopilot = true;
            await Frames(60 * 12);
            if (attempt == 1) await Shot("trial");
            world = await UntilWorld();
            await Frames(3);
            if (attempt == 1) await Shot("breakthrough_result");
            Log($"breakthrough attempt {attempt}: realm now {E.Player.Realm}");
            world = await Settle(world);
        }
        Check(E.Player.Realm == Realm.LuyenKhi, "the trial can be passed (Luyện Khí reached)");
        Check(E.Player.SkillSlots.Contains("hoa_cau_thuat"), "a Hỏa root awakens Fireball on breakthrough");

        // ---------------------------------------------------------------- spirit arts and Ngũ Hành
        var vine = E.StartAdventureFight("corrupted_vine", "verdant_forest")!;
        var arena = Main.Instance.ShowArena(vine);
        arena.Autopilot = true;
        await Frames(60 * 4);
        await Shot("arena_arts");
        var usedArt = arena.SkillUses.ContainsKey("hoa_cau_thuat");
        world = await FightThrough(arena);
        Check(usedArt, "the autopilot cast its spirit art");
        world = await Settle(world);

        // ---------------------------------------------------------------- the sect trial
        DevCheats.Restore(E);
        var trialFight = E.StartSectTrial("thanh_van_kiem");
        Check(trialFight is { NonLethal: true }, "the sect trial is a spar");
        world = await FightThrough(Main.Instance.ShowArena(trialFight!), "arena_sect_trial");
        Log($"sect after trial: {E.Player.SectId ?? "none"}");
        world = await Settle(world);

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
        await Frames(4);
        await Shot("world_en");
        game.SetLocale(Locale.Vi);

        var p = E.Player;
        Log($"final: {p.Name}, {p.Realm} {p.Stage}, month {E.State.Calendar.MonthIndex}, fights {p.Counters.Fights}, kills {p.Counters.Kills}, silver {p.Silver}, sect {p.SectId ?? "-"}");
        Main.Instance.ShowTitle();
        game.EndRun();
        await Frames(2);
    }

    /// <summary>Let the autopilot play a fight to the end; returns the world screen it hands back to.</summary>
    private async Task<WorldScreen> FightThrough(ArenaScreen arena, string? shot = null)
    {
        arena.Autopilot = true;
        if (shot != null)
        {
            await Frames(60 * 3);
            await Shot(shot);
        }
        var world = await UntilWorld();
        await Frames(2);
        return world;
    }

    private async Task<WorldScreen> UntilWorld(int maxFrames = 60 * 180)
    {
        for (var i = 0; i < maxFrames; i++)
        {
            if (Main.Instance.World is { } w) return w;
            await Frames(1);
        }
        throw new TimeoutException("the arena never finished");
    }

    /// <summary>Close panels (and fight any ambush) until the map is clear.</summary>
    private async Task<WorldScreen> Settle(WorldScreen world)
    {
        for (var guard = 0; guard < 12; guard++)
        {
            await Frames(2);
            if (Main.Instance.Arena is { } arena)
            {
                world = await FightThrough(arena);
                continue;
            }
            world = Main.Instance.World!;
            if (E.State.World.PendingAmbush != null)
            {
                var enc = E.TakeAmbush();
                if (enc != null) world = await FightThrough(Main.Instance.ShowArena(enc), "arena_ambush");
                continue;
            }
            if (E.ActiveEncounter is { } pending)
            {
                world = await FightThrough(Main.Instance.ShowArena(pending));
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
        if (_shots == null || DisplayServer.GetName() == "headless") return;
        await ToSignal(RenderingServer.Singleton, RenderingServer.SignalName.FramePostDraw);
        var image = GetViewport().GetTexture().GetImage();
        _shotIndex += 1;
        var path = Path.Combine(_shots, $"{_shotIndex:00}_{name}.png");
        image.SavePng(path);
        Log("screenshot " + path);
    }
}
