using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Godot;
using TuTienLuc.Field;
using TuTienLuc.Ui;

namespace TuTienLuc.Dev;

/// <summary>
/// Diagnostic: start a new life the way a phone does (touch controls on, the interface at 135%, fingers
/// on the title's buttons), then keep rendering the world and report memory and draw counts.
/// Run with <c>godot --path game/godot -- --phone-start</c> (add <c>--shots DIR</c> for screenshots of the
/// loading screen and the world).
/// </summary>
public partial class PhoneStart : Node
{
    private readonly string? _shots;

    public PhoneStart(string? shots) => _shots = shots;

    private static void Log(string message) => GD.Print("[phone] " + message);

    public override void _Ready() => _ = Run();

    private async Task Run()
    {
        try
        {
            var game = Game.Instance;
            game.PersistSettings = false;
            game.SavePath = "user://saves/phone.json";
            game.Touch = TouchMode.On;
            game.UiScale = 1.35f;
            game.ApplyDisplay();
            Stats("boot");
            Main.Instance.ShowTitle();
            await Frames(60);
            Stats("title");
            await TapButton("Khởi đầu kiếp mới", "Begin a new life");
            await Frames(30);
            Stats("creation");
            await TapButton("Bước vào tu tiên giới", "Enter the cultivation world");
            for (var shot = 0; Main.Instance.Loading != null; shot++)
            {
                if (shot % 6 == 0) await Shot($"phone_loading_{shot / 6}");
                await Frames(1);
            }
            Stats("world ready");
            for (var i = 1; i <= 10; i++)
            {
                await Frames(60);
                Stats($"world +{i}s");
                if (i == 2) await Shot("phone_world");
            }
            Log(Main.Instance.World != null ? "PASSED" : "FAILED: no world");
            game.Quit(Main.Instance.World != null ? 0 : 1);
        }
        catch (Exception ex)
        {
            GD.PrintErr("[phone] FAILED: " + ex);
            Game.Instance.Quit(1);
        }
    }

    private async Task TapButton(string vi, string en)
    {
        var button = GetTree().Root.FindChildren("*", "Button", true, false).OfType<Button>()
            .FirstOrDefault(b => (b.Text == vi || b.Text == en) && b.IsVisibleInTree());
        if (button == null) throw new InvalidOperationException("no button " + vi);
        var at = GetViewport().GetScreenTransform() * button.GetGlobalRect().GetCenter();
        Log($"tap '{button.Text}' at {at}");
        Input.ParseInputEvent(new InputEventScreenTouch { Index = 0, Position = at, Pressed = true });
        await Frames(4);
        Input.ParseInputEvent(new InputEventScreenTouch { Index = 0, Position = at, Pressed = false });
        await Frames(2);
    }

    private static void Stats(string when)
    {
        var rss = "?";
        try
        {
            rss = File.ReadLines("/proc/self/status").FirstOrDefault(l => l.StartsWith("VmRSS"))?.Split(':')[1].Trim() ?? "?";
        }
        catch (Exception)
        {
            // Not Linux.
        }
        static double M(Performance.Monitor m) => Performance.GetMonitor(m);
        Log($"{when}: rss {rss}, static {OS.GetStaticMemoryUsage() / 1048576.0:0.0} MB, video {M(Performance.Monitor.RenderVideoMemUsed) / 1048576.0:0.0} MB, " +
            $"buffers {M(Performance.Monitor.RenderBufferMemUsed) / 1048576.0:0.0} MB, textures {M(Performance.Monitor.RenderTextureMemUsed) / 1048576.0:0.0} MB, " +
            $"objects {M(Performance.Monitor.ObjectCount)}, nodes {M(Performance.Monitor.ObjectNodeCount)}, " +
            $"draw calls {M(Performance.Monitor.RenderTotalDrawCallsInFrame)}, primitives {M(Performance.Monitor.RenderTotalPrimitivesInFrame)}, fps {Engine.GetFramesPerSecond()}, " +
            $"managed {GC.GetTotalMemory(false) / 1048576.0:0.0} MB");
    }

    private async Task Shot(string name)
    {
        if (_shots == null) return;
        Directory.CreateDirectory(_shots);
        await ToSignal(RenderingServer.Singleton, RenderingServer.SignalName.FramePostDraw);
        using var image = GetViewport().GetTexture().GetImage();
        image.SavePng(Path.Combine(_shots, name + ".png"));
    }

    private async Task Frames(int n)
    {
        for (var i = 0; i < n; i++) await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
    }
}
