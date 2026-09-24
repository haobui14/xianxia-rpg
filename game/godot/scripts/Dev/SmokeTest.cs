using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Godot;
using TuTien.Core;
using TuTien.Core.State;
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

    private static WorldScreen World => Main.Instance.World ?? throw new InvalidOperationException("no world screen");

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
        await Frames(40);
        Check(E.Player.Realm == Realm.PhamNhan && E.Player.Footwork > 0, "new life starts as a mortal with footwork");
        Check(world.Actors.Count > 1, "people and beasts stand on the field");
        await Shot("world_village");
        world.Zoom(0.72f);
        await Frames(20);
        await Shot("world_village_wide");
        world.Zoom(1 / 0.72f);

        // ---------------------------------------------------------------- panels
        foreach (var panel in new InkPanel[] { new CharacterPanel(), new InventoryPanel(), new JournalPanel(), new MapPanel(world) })
        {
            world.OpenPanel(panel);
            await Frames(3);
            await Shot(panel.GetType().Name);
        }
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
        world = await Walk(world, 17, 22, "walk_road");
        Check(world.Tile != start, "the body walks and the engine follows tile by tile");
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

    /// <summary>Walk along the road to a tile (the planned path), fighting whatever jumps out on the way.</summary>
    private async Task<WorldScreen> Walk(WorldScreen world, int x, int y, string? shot)
    {
        var path = E.PlanPath(x, y);
        if (path == null || path.Steps.Count == 0) return world;
        foreach (var step in path.Steps) world.Player.Route.Enqueue(WorldScreen.TileCenter(step.X, step.Y));
        var shotAt = path.Steps.Count / 2;
        for (var i = 0; i < 60 * 40; i++)
        {
            await Frames(1);
            world = World;
            if (world.Battle != null)
            {
                world = await FightThrough(world);
                world.Player.Route.Clear();
                foreach (var step in E.PlanPath(x, y)?.Steps ?? new()) world.Player.Route.Enqueue(WorldScreen.TileCenter(step.X, step.Y));
            }
            if (world.PanelOpen) world = await Settle(world);
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
        var image = GetViewport().GetTexture().GetImage();
        RenderingServer.RenderLoopEnabled = false;
        _shotIndex += 1;
        var path = Path.Combine(_shots!, $"{_shotIndex:00}_{name}.png");
        image.SavePng(path);
        Log("screenshot " + path);
    }
}
