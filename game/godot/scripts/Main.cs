using System;
using System.Linq;
using Godot;
using TuTien.Core.State;
using TuTienLuc.Arena;
using TuTienLuc.Dev;
using TuTienLuc.Ui;
using TuTienLuc.World;

namespace TuTienLuc;

/// <summary>
/// Screen manager: Title → World map ⇄ Arena. Command-line args (after "--"):
/// <c>--smoke</c> runs the automated smoke test, <c>--shots DIR</c> saves screenshots during it.
/// </summary>
public partial class Main : Node
{
    public static Main Instance { get; private set; } = null!;

    private Node? _screen;
    public WorldScreen? World => _screen as WorldScreen;
    public ArenaScreen? Arena => _screen as ArenaScreen;

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
            _screen.QueueFree();
        }
        _screen = next;
        AddChild(next);
    }

    public void ShowTitle() => Swap(new TitleScreen());

    public WorldScreen ShowWorld()
    {
        var world = new WorldScreen();
        Swap(world);
        return world;
    }

    /// <summary>
    /// Play a fight, then hand the resolution back to a fresh world screen. <paramref name="thenOpen"/>
    /// builds the panel to show after the result (e.g. the secret realm, to go on to the next floor).
    /// </summary>
    public ArenaScreen ShowArena(Encounter encounter, Func<InkPanel>? thenOpen = null)
    {
        var arena = new ArenaScreen(encounter, ArenaMode.Battle);
        arena.Finished += outcome =>
        {
            var resolution = Game.Instance.Engine!.ResolveCombat(outcome);
            Game.Instance.SaveGame();
            var world = ShowWorld();
            world.AfterCombat(resolution, outcome, thenOpen);
        };
        Swap(arena);
        return arena;
    }

    /// <summary>The breakthrough set piece (design §7.5), played in the arena layer.</summary>
    public ArenaScreen ShowBreakthroughTrial()
    {
        var arena = new ArenaScreen(null, ArenaMode.QiTrial);
        arena.TrialFinished += performance =>
        {
            var events = Game.Instance.Engine!.CompleteBreakthrough(performance);
            Game.Instance.SaveGame();
            var world = ShowWorld();
            Game.Instance.Notify(events);
            world.ShowBreakthroughResult(events, performance);
        };
        Swap(arena);
        return arena;
    }
}
