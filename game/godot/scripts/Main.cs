using System;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTienLuc.Dev;
using TuTienLuc.Field;
using TuTienLuc.Ui;

namespace TuTienLuc;

/// <summary>
/// Screen manager: Title → the world (a top-down field) ⇄ a secret realm floor / the breakthrough
/// trial. Fights have no screen of their own: they happen on whatever field you are standing on.
/// Command-line args (after "--"): <c>--smoke</c> runs the automated smoke test, <c>--shots DIR</c> saves
/// screenshots during it.
/// </summary>
public partial class Main : Node
{
    public static Main Instance { get; private set; } = null!;

    private Node? _screen;
    /// <summary>The field on screen (the world, a realm floor, the trial), if any.</summary>
    public FieldScreen? Field => _screen as FieldScreen;
    public WorldScreen? World => _screen as WorldScreen;

    public override void _Ready()
    {
        Instance = this;
        GetTree().Root.Theme = Ink.BuildTheme();
        GetTree().Root.MinSize = new Vector2I(1024, 600);

        var args = OS.GetCmdlineUserArgs();
        if (args.Contains("--smoke"))
        {
            var shotsIndex = Array.IndexOf(args, "--shots");
            var shots = shotsIndex >= 0 && shotsIndex + 1 < args.Length ? args[shotsIndex + 1] : null;
            AddChild(new SmokeTest(shots));
            return;
        }
        if (args.Contains("--phone-start"))
        {
            var shotsAt = Array.IndexOf(args, "--shots");
            AddChild(new PhoneStart(shotsAt >= 0 && shotsAt + 1 < args.Length ? args[shotsAt + 1] : null));
            return;
        }
        ShowTitle();
    }

    /// <summary>
    /// Replace the current screen. The old one is freed at the end of the frame, so a button
    /// on it can safely trigger the swap from its own pressed handler.
    /// </summary>
    private void Swap(Node next)
    {
        GetTree().Paused = false;
        if (_screen != null && IsInstanceValid(_screen))
        {
            _screen.ProcessMode = ProcessModeEnum.Disabled;
            if (_screen is CanvasItem item) item.Visible = false;
            HideLayers(_screen);
            _screen.QueueFree();
        }
        _screen = next;
        AddChild(next);
    }

    /// <summary>CanvasLayers don't inherit visibility; hide the outgoing screen's HUD and panels at once.</summary>
    private static void HideLayers(Node node)
    {
        foreach (var child in node.GetChildren())
        {
            if (child is CanvasLayer layer) layer.Visible = false;
        }
    }

    public void ShowTitle() => Swap(new TitleScreen());

    /// <summary>The region, with the player at their tile (or at <paramref name="spawn"/>, e.g. a cave mouth).</summary>
    public WorldScreen ShowWorld(Vector2? spawn = null)
    {
        var world = new WorldScreen(spawn);
        Swap(world);
        return world;
    }

    /// <summary>The loading screen while the world is being built (null the rest of the time).</summary>
    public LoadingScreen? Loading { get; private set; }

    /// <summary>
    /// Into the world behind a loading screen (a new life, or Continue): <paramref name="prepare"/> makes or
    /// loads the run, then the region is built a slice per frame — a phone never sits on one long frame —
    /// while the bar shows how far it got. If <paramref name="prepare"/> fails, <paramref name="failed"/> runs
    /// and the title stays.
    /// </summary>
    public async void EnterWorld(Func<bool> prepare, Vector2? spawn = null, Action? failed = null)
    {
        if (Loading != null) return;
        var layer = new CanvasLayer { Layer = 100 };
        AddChild(layer);
        var loading = new LoadingScreen();
        Loading = loading;
        layer.AddChild(loading);
        WorldScreen? world = null;
        try
        {
            // The loading screen is up before any heavy work starts.
            await Frames(2);
            loading.Report(0.03f, "Khai mở thiên địa", "Opening heaven and earth");
            await Frames(1);
            if (!prepare())
            {
                failed?.Invoke();
                return;
            }
            loading.Report(0.12f, "Khai mở thiên địa", "Opening heaven and earth");
            await Frames(1);

            world = new WorldScreen(spawn);
            var clock = Stopwatch.StartNew();
            while (world.Step())
            {
                var step = world.CurrentStep;
                loading.Report(0.12f + 0.76f * step.Progress, step.Vi, step.En);
                if (clock.ElapsedMilliseconds < 25) continue;
                await Frames(1);
                clock.Restart();
            }
            loading.Report(0.9f, "Gọi muông thú, người qua đường", "Calling the beasts and the passers-by");
            await Frames(1);
            Swap(world);
            loading.Report(0.96f, "Vẽ cảnh quanh ngươi", "Painting the land around you");
            // The scenery near the camera paints on these frames.
            await Frames(2);
            await loading.Finish();
        }
        catch (Exception ex)
        {
            GD.PushError($"[world] could not enter the world: {ex}");
            // A world that never made it on screen is nobody's child: let it go.
            if (world != null && IsInstanceValid(world) && !world.IsInsideTree()) world.Free();
            Game.Instance.Toast("Không dựng được thế giới.", "Could not build the world.", EventLevel.Warning);
        }
        finally
        {
            Loading = null;
            if (IsInstanceValid(layer)) layer.QueueFree();
        }
    }

    private async Task Frames(int n)
    {
        for (var i = 0; i < n; i++) await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
    }

    /// <summary>The current floor of the secret realm run at <paramref name="poi"/>.</summary>
    public RealmScreen ShowRealm(PoiDef poi)
    {
        var realm = new RealmScreen(poi);
        Swap(realm);
        return realm;
    }

    /// <summary>The breakthrough set piece (design §7.5): the meridian storm into Trúc Cơ, otherwise drawing qi in.</summary>
    public TrialBase ShowBreakthroughTrial()
    {
        TrialBase trial = Game.Instance.Engine?.Player.Realm == TuTien.Core.Realm.LuyenKhi ? new FoundationTrial() : new TrialScreen();
        Swap(trial);
        return trial;
    }
}
