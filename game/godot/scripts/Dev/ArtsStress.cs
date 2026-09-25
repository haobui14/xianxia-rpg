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
/// Diagnostic: the phone's way through the character panel's Arts tab, over and over — touch taps on the
/// slot buttons, drags that start on them (they must scroll, never assign), the tabs, the back button —
/// checking every tap did what it should, with each action written to a log file first so a crash leaves
/// a trail. Run with a real window:
/// <c>godot --path game/godot --resolution 1600x720 -- --arts-stress [rounds] [log path] [shots dir]</c>.
/// </summary>
public partial class ArtsStress : Node
{
    private readonly int _rounds;
    private readonly string _logPath;
    private readonly string? _shots;
    private readonly Random _rng = new(7);
    private StreamWriter? _log;

    public ArtsStress(int rounds, string logPath, string? shots)
    {
        _rounds = rounds;
        _logPath = logPath;
        _shots = shots;
    }

    private void Log(string message)
    {
        GD.Print("[arts] " + message);
        _log?.WriteLine($"{Time.GetTicksMsec(),8} {message}");
        _log?.Flush();
    }

    public override void _Ready() => _ = Run();

    private static GameEngine E => Game.Instance.Engine!;
    private static string Slots => string.Join(",", E.Player.SkillSlots.Select(s => s.Length == 0 ? "-" : s));

    private async Task Run()
    {
        try
        {
            _log = new StreamWriter(_logPath, append: false);
            var game = Game.Instance;
            game.PersistSettings = false;
            game.SavePath = "user://saves/arts_stress.json";
            game.Touch = TouchMode.On;
            game.UiScale = 1.35f;
            game.ApplyDisplay();
            // A desktop has no touchscreen, and without one Godot's scroll containers ignore finger drags;
            // emulating touch from the mouse tells it there is one (a phone always has).
            Input.EmulateTouchFromMouse = true;
            Main.Instance.EnterWorld(() =>
            {
                game.NewGame("Lâm Vân", 16, new SpiritRootState { Elements = { Element.Hoa }, Grade = RootGrade.Kha }, CultivationPath.Qi, 20240917UL);
                return true;
            });
            for (var i = 0; i < 60 * 60 && (Main.Instance.Loading != null || Main.Instance.World == null); i++) await Frames(1);
            var world = Main.Instance.World ?? throw new InvalidOperationException("no world");
            await Frames(30);
            DevCheats.SetRealm(E, Realm.LuyenKhi);
            foreach (var art in new[] { "hoa_cau_thuat", "kim_kiem_khi", "thanh_moc_cham", "thuy_nhan", "tho_thu", "ho_the_cuong_khi", "hoi_xuan_quyet",
                         "kim_quang_tram", "van_diep_ho_than", "thuy_long_ba", "liet_diem_dia", "tho_lao_thuat", "thanh_van_kiem_quyet" })
                DevCheats.LearnArt(E, art);
            game.Changed();
            await Frames(10);
            Log($"world ready, {E.Player.Skills.Count} arts, screen {GetViewport().GetVisibleRect().Size}");

            await OpenCharacter(world);
            await TapTab("Arts");
            await Shot("arts_phone_top");
            int taps = 0, drags = 0, scrolled = 0;
            for (var round = 1; round <= _rounds; round++)
            {
                world = Main.Instance.World ?? throw new InvalidOperationException("the world went away");
                if (world.CurrentPanel is not CharacterPanel)
                {
                    Log("panel closed: reopening");
                    await OpenCharacter(world);
                    await TapTab("Arts");
                }
                var roll = _rng.Next(100);
                var buttons = SlotButtons();
                if (roll < 8 || buttons.Length == 0)
                {
                    var tab = new[] { "Foundation", "Cultivation", "Arts", "Arts" }[_rng.Next(4)];
                    Log($"#{round} tab {tab}");
                    await TapTab(tab);
                }
                else if (roll < 12)
                {
                    Log($"#{round} back button");
                    Game.Instance._Notification((int)NotificationWMGoBackRequest);
                    await Frames(3);
                    if (Main.Instance.World?.PanelOpen == true) throw new InvalidOperationException("the back button did not close the panel");
                }
                else if (roll < 40)
                {
                    // A thumb that lands on a slot button and scrolls: the page moves, no slot changes.
                    var button = buttons[_rng.Next(buttons.Length)];
                    var scroll = Scroll();
                    var before = scroll.ScrollVertical;
                    var slots = Slots;
                    var from = Screen(button.GetGlobalRect().GetCenter());
                    var dy = (before > 60 && _rng.Next(2) == 0 ? 1 : -1) * (90 + _rng.Next(220));
                    Log($"#{round} drag from {button.Name} by {dy} (scroll {before})");
                    await Drag(from, from + new Vector2(0, dy), 5 + _rng.Next(12));
                    // A flick glides on for a moment; let it come to rest.
                    for (int i = 0, still = 0; i < 180 && still < 6; i++)
                    {
                        var at = scroll.ScrollVertical;
                        await Frames(1);
                        still = scroll.ScrollVertical == at ? still + 1 : 0;
                    }
                    drags++;
                    if (Slots != slots) throw new InvalidOperationException($"a scroll drag changed the slots: {slots} → {Slots}");
                    if (scroll.ScrollVertical != before) scrolled++;
                }
                else
                {
                    var button = buttons[_rng.Next(buttons.Length)];
                    var parts = button.Name.ToString().Split('_');
                    var slot = int.Parse(parts[^1]);
                    var id = string.Join("_", parts.Skip(1).Take(parts.Length - 2));
                    var lit = E.Player.SkillSlots[slot] == id;
                    var scroll = Scroll().ScrollVertical;
                    Log($"#{round} tap {button.Name} ({(lit ? "lit" : "unlit")}) slots {Slots}");
                    await Tap(Screen(button.GetGlobalRect().GetCenter()), 2 + _rng.Next(7));
                    await Frames(3);
                    taps++;
                    var now = E.Player.SkillSlots[slot];
                    if (lit ? now != "" : now != id) throw new InvalidOperationException($"tapping {button.Name} left slot {slot} = '{now}'");
                    if (Math.Abs(Scroll().ScrollVertical - scroll) > 1) throw new InvalidOperationException($"a slot change jumped the page ({scroll} → {Scroll().ScrollVertical})");
                }
                if (round == _rounds / 2) await Shot("arts_phone_scrolled");
                if (round % 50 == 0) Stats($"round {round}");
            }
            Log($"taps {taps}, drags {drags} ({scrolled} scrolled the page)");
            if (drags > 10 && scrolled < drags / 2) throw new InvalidOperationException("drags that start on a button don't scroll the page");

            // The same tab without touch controls, as on a desktop.
            Input.EmulateTouchFromMouse = false;
            game.Touch = TouchMode.Off;
            game.UiScale = 0;
            game.ApplyDisplay();
            Main.Instance.World!.ClosePanel();
            await Frames(3);
            Main.Instance.World!.OpenPanel(new CharacterPanel());
            await Frames(3);
            await TapTab("Arts");
            await Shot("arts_desktop");
            Log("PASSED");
            _log.Close();
            game.Quit(0);
        }
        catch (Exception ex)
        {
            Log("FAILED: " + ex);
            _log?.Close();
            Game.Instance.Quit(1);
        }
    }

    private static Button[] SlotButtons() =>
        Main.Instance.World?.CurrentPanel?.FindChildren("slot_*", "Button", true, false).OfType<Button>()
            .Where(b => b.IsVisibleInTree() && Visible(b)).ToArray() ?? Array.Empty<Button>();

    /// <summary>Only buttons the scroll shows can be tapped.</summary>
    private static bool Visible(Control c)
    {
        var scroll = Scroll();
        return scroll.GetGlobalRect().Grow(-4).Encloses(c.GetGlobalRect());
    }

    private static ScrollContainer Scroll() =>
        Main.Instance.World!.CurrentPanel!.FindChildren("*", "ScrollContainer", true, false).OfType<ScrollContainer>().First();

    private Vector2 Screen(Vector2 viewportPoint) => GetViewport().GetScreenTransform() * viewportPoint;

    private async Task OpenCharacter(WorldScreen world)
    {
        var icon = world.Hud.FindChildren("*", "Button", true, false).OfType<Button>().FirstOrDefault(b => b.TooltipText.StartsWith("Character"));
        if (icon == null) throw new InvalidOperationException("no character icon");
        Log("tap the Character icon");
        await Tap(Screen(icon.GetGlobalRect().GetCenter()), 5);
        await Frames(4);
        if (world.CurrentPanel is not CharacterPanel) throw new InvalidOperationException("the character panel did not open");
    }

    private async Task TapTab(string name)
    {
        var tab = Main.Instance.World?.CurrentPanel?.FindChildren("*", "Button", true, false).OfType<Button>()
            .FirstOrDefault(b => b.Text == name && b.IsVisibleInTree());
        if (tab == null)
        {
            Log($"  no tab {name}");
            return;
        }
        await Tap(Screen(tab.GetGlobalRect().GetCenter()), 3 + _rng.Next(5));
        await Frames(3);
    }

    private async Task Tap(Vector2 at, int holdFrames)
    {
        Input.ParseInputEvent(new InputEventScreenTouch { Index = 0, Position = at, Pressed = true });
        await Frames(holdFrames);
        Input.ParseInputEvent(new InputEventScreenTouch { Index = 0, Position = at, Pressed = false });
        await Frames(1);
    }

    private async Task Drag(Vector2 from, Vector2 to, int frames)
    {
        Input.ParseInputEvent(new InputEventScreenTouch { Index = 0, Position = from, Pressed = true });
        await Frames(1);
        var last = from;
        for (var i = 1; i <= frames; i++)
        {
            var at = from.Lerp(to, i / (float)frames);
            Input.ParseInputEvent(new InputEventScreenDrag { Index = 0, Position = at, Relative = at - last, Velocity = (at - last) * 60 });
            last = at;
            await Frames(1);
        }
        Input.ParseInputEvent(new InputEventScreenTouch { Index = 0, Position = to, Pressed = false });
        await Frames(1);
    }

    private void Stats(string when)
    {
        static double M(Performance.Monitor m) => Performance.GetMonitor(m);
        Log($"{when}: objects {M(Performance.Monitor.ObjectCount)}, nodes {M(Performance.Monitor.ObjectNodeCount)}, orphans {M(Performance.Monitor.ObjectOrphanNodeCount)}, " +
            $"video {M(Performance.Monitor.RenderVideoMemUsed) / 1048576.0:0.0} MB, static {OS.GetStaticMemoryUsage() / 1048576.0:0.0} MB, managed {GC.GetTotalMemory(false) / 1048576.0:0.0} MB");
    }

    private async Task Shot(string name)
    {
        if (_shots == null) return;
        Directory.CreateDirectory(_shots);
        await ToSignal(RenderingServer.Singleton, RenderingServer.SignalName.FramePostDraw);
        using var image = GetViewport().GetTexture().GetImage();
        image.SavePng(Path.Combine(_shots, name + ".png"));
        Log("shot " + name);
    }

    private async Task Frames(int n)
    {
        for (var i = 0; i < n; i++) await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
    }
}
