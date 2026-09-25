using System;
using System.IO;
using System.Threading.Tasks;
using Godot;
using TuTien.Core;
using TuTien.Core.State;
using TuTienLuc.Field;
using TuTienLuc.Ui;

namespace TuTienLuc.Dev;

/// <summary>
/// Diagnostic: the Trúc Cơ meridian storm the way a phone plays it (touch controls, the interface at 135%),
/// played by the autopilot, reporting draw calls and GPU memory every second and through the way back to
/// the world. Run with a real window: <c>godot --path game/godot --resolution 1600x720 -- --trial-stats [log]</c>.
/// </summary>
public partial class TrialStats : Node
{
    private readonly string? _logPath;
    private readonly string? _shots;
    private StreamWriter? _log;

    public TrialStats(string? logPath, string? shots = null)
    {
        _logPath = logPath;
        _shots = shots;
    }

    private async Task Shot(string name)
    {
        if (_shots == null) return;
        Directory.CreateDirectory(_shots);
        await ToSignal(RenderingServer.Singleton, RenderingServer.SignalName.FramePostDraw);
        using var image = GetViewport().GetTexture().GetImage();
        image.SavePng(Path.Combine(_shots, name + ".png"));
    }

    public override void _Ready() => _ = Run();

    private static GameEngine E => Game.Instance.Engine!;

    private void Log(string message)
    {
        GD.Print("[trial] " + message);
        _log?.WriteLine(message);
        _log?.Flush();
    }

    private async Task Run()
    {
        try
        {
            if (_logPath != null) _log = new StreamWriter(_logPath, append: false);
            var game = Game.Instance;
            game.PersistSettings = false;
            game.SavePath = "user://saves/trial_stats.json";
            game.Touch = TouchMode.On;
            game.UiScale = 1.35f;
            game.ApplyDisplay();
            Main.Instance.EnterWorld(() =>
            {
                game.NewGame("Lâm Vân", 16, new SpiritRootState { Elements = { Element.Hoa }, Grade = RootGrade.Kha }, CultivationPath.Qi, 20240917UL);
                return true;
            });
            for (var i = 0; i < 60 * 60 && (Main.Instance.Loading != null || Main.Instance.World == null); i++) await Frames(1);
            await Frames(30);
            Stats("world");
            DevCheats.SetRealm(E, Realm.LuyenKhi);
            DevCheats.FillToBreakthrough(E);
            var trial = Main.Instance.ShowBreakthroughTrial();
            if (trial is not FoundationTrial storm) throw new InvalidOperationException("not the meridian storm");
            await Frames(2);
            if (storm.CurrentPanel is not Ui.Panels.TrialGuidePanel) throw new InvalidOperationException("the storm opened without its guide");
            await Frames(10);
            await Shot("phone_storm_guide");
            storm.ClosePanel(); // "Begin"
            storm.Player.Autopilot = true;
            var peakCalls = 0.0;
            var peakBuffers = 0.0;
            for (var s = 0; !storm.Ended && s < 120; s++)
            {
                await Frames(60);
                var (calls, buffers) = Stats($"storm {storm.Time:0}s phase {storm.Phase}: {storm.Drops.Count} drops, {storm.Waves.Count} waves, {storm.Surges.Count} surges");
                peakCalls = Math.Max(peakCalls, calls);
                peakBuffers = Math.Max(peakBuffers, buffers);
                if (s == 1) await Shot("phone_storm_countdown");
                if (s == 27) await Shot("phone_storm_surge");
                if (s == 48) await Shot("phone_storm_waves");
            }
            Log($"PEAK in the storm: {peakCalls} draw calls, {peakBuffers:0.0} MB buffers; score {storm.Score:0}/{FoundationTrial.Goal:0}, {storm.Hits} hits, performance {storm.Performance:0.00}");
            for (var i = 0; i < 60 * 30 && Main.Instance.World == null; i++) await Frames(1);
            Stats("back in the world");
            await Frames(60);
            Stats("world +1s");
            Log("PASSED");
            _log?.Close();
            game.Quit(0);
        }
        catch (Exception ex)
        {
            Log("FAILED: " + ex);
            _log?.Close();
            Game.Instance.Quit(1);
        }
    }

    private (double Calls, double Buffers) Stats(string when)
    {
        static double M(Performance.Monitor m) => Performance.GetMonitor(m);
        var calls = M(Performance.Monitor.RenderTotalDrawCallsInFrame);
        var buffers = M(Performance.Monitor.RenderBufferMemUsed) / 1048576.0;
        Log($"{when}: draw calls {calls}, objects {M(Performance.Monitor.RenderTotalObjectsInFrame)}, primitives {M(Performance.Monitor.RenderTotalPrimitivesInFrame)}, " +
            $"buffers {buffers:0.0} MB, video {M(Performance.Monitor.RenderVideoMemUsed) / 1048576.0:0.0} MB, textures {M(Performance.Monitor.RenderTextureMemUsed) / 1048576.0:0.0} MB, " +
            $"nodes {M(Performance.Monitor.ObjectNodeCount)}, static {OS.GetStaticMemoryUsage() / 1048576.0:0.0} MB, fps {Engine.GetFramesPerSecond()}");
        return (calls, buffers);
    }

    private async Task Frames(int n)
    {
        for (var i = 0; i < n; i++) await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
    }
}
