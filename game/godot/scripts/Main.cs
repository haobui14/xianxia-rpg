using System;
using System.Linq;
using Godot;
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

    /// <summary>The current floor of the secret realm run at <paramref name="poi"/>.</summary>
    public RealmScreen ShowRealm(PoiDef poi)
    {
        var realm = new RealmScreen(poi);
        Swap(realm);
        return realm;
    }

    /// <summary>The breakthrough set piece (design §7.5).</summary>
    public TrialScreen ShowBreakthroughTrial()
    {
        var trial = new TrialScreen();
        Swap(trial);
        return trial;
    }
}
