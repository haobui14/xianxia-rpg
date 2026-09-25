using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Godot;

namespace TuTienLuc;

/// <summary>
/// What the game was doing when it last stopped. A phone has no console: a crash just closes the app, and
/// the player can only say "it crashed". So the game keeps a short trail of what it did (screens, panels,
/// tabs, fights, month turns) in <c>user://logs/trail.txt</c>, written through line by line, plus a marker
/// that exists only while a session is running in the foreground. If the marker is still there at the next
/// start, the last session didn't end cleanly: Settings then offers a report (that trail, the end of
/// Godot's own log, and the device) to copy and send.
/// </summary>
public static class CrashLog
{
    private const int MaxLines = 1500;
    private static readonly object Gate = new();
    private static StreamWriter? _trail;
    private static int _lines;
    private static string _dir = "";

    /// <summary>The last session was still running when it stopped (a crash, or the process was killed in the foreground).</summary>
    public static bool PreviousCrashed { get; private set; }

    private static string Marker => Path.Combine(_dir, "running");
    private static string TrailFile => Path.Combine(_dir, "trail.txt");
    private static string PreviousTrail => Path.Combine(_dir, "trail_previous.txt");

    /// <summary>Open this session's trail (and read what the last one left). Call once, first thing.</summary>
    public static void Start()
    {
        try
        {
            _dir = ProjectSettings.GlobalizePath("user://logs");
            Directory.CreateDirectory(_dir);
            PreviousCrashed = File.Exists(Marker);
            if (File.Exists(TrailFile)) File.Copy(TrailFile, PreviousTrail, overwrite: true);
            Open();
            File.WriteAllText(Marker, DateTime.Now.ToString("O"));
            AppDomain.CurrentDomain.UnhandledException += (_, e) => Note("UNHANDLED " + e.ExceptionObject);
            TaskScheduler.UnobservedTaskException += (_, e) => Note("UNOBSERVED " + e.Exception);
            Note($"start · {(OS.IsDebugBuild() ? "debug" : "release")} build · {OS.GetName()} {OS.GetVersion()} · {OS.GetModelName()} · " +
                 $"{DisplayServer.ScreenGetSize()} @ {DisplayServer.ScreenGetDpi()} dpi · {OS.GetProcessorName()} · last session {(PreviousCrashed ? "did NOT end cleanly" : "ended cleanly")}");
        }
        catch (Exception ex)
        {
            GD.PushWarning($"[crashlog] disabled: {ex.Message}");
            _trail = null;
        }
    }

    private static void Open()
    {
        _trail = new StreamWriter(TrailFile, append: false, new UTF8Encoding(false)) { AutoFlush = true };
        _lines = 0;
    }

    /// <summary>One line on the trail: what the game is about to do or just did.</summary>
    public static void Note(string what)
    {
        lock (Gate)
        {
            if (_trail == null) return;
            try
            {
                if (++_lines > MaxLines)
                {
                    // Keep the file small: start again, the recent past is what a report needs.
                    _trail.Dispose();
                    Open();
                }
                _trail.WriteLine($"{Time.GetTicksMsec() / 1000.0,9:0.000} {what}");
            }
            catch (Exception)
            {
                // A full disk must never take the game down with it.
            }
        }
    }

    /// <summary>
    /// The app went to the background (phones): the system may end it there at any time, and that isn't a
    /// crash, so the marker goes until the app comes back.
    /// </summary>
    public static void Paused()
    {
        Note("paused");
        TryDelete(Marker);
    }

    public static void Resumed()
    {
        Note("resumed");
        try
        {
            if (_trail != null) File.WriteAllText(Marker, DateTime.Now.ToString("O"));
        }
        catch (Exception)
        {
            // Not worth failing over.
        }
    }

    /// <summary>A clean exit: the next start won't report a crash.</summary>
    public static void Stop()
    {
        Note("quit");
        TryDelete(Marker);
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (_trail != null && File.Exists(path)) File.Delete(path);
        }
        catch (Exception)
        {
            // Ignore.
        }
    }

    /// <summary>What to send when asking why the game closed: the last session's trail and the end of its Godot log.</summary>
    public static string Report()
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Tu Tien Luc problem report · {DateTime.Now:yyyy-MM-dd HH:mm}");
        sb.AppendLine($"{OS.GetName()} {OS.GetVersion()} · {OS.GetModelName()} · Godot {Engine.GetVersionInfo()["string"]}");
        sb.AppendLine();
        sb.AppendLine("== last session's trail ==");
        sb.AppendLine(Tail(PreviousTrail, 80));
        var log = LastGodotLog();
        if (log != null)
        {
            sb.AppendLine($"== end of {Path.GetFileName(log)} ==");
            sb.AppendLine(Tail(log, 60));
        }
        return sb.ToString();
    }

    /// <summary>Godot keeps the current session's log as godot.log and renames the older ones with their date.</summary>
    private static string? LastGodotLog()
    {
        try
        {
            return Directory.GetFiles(_dir, "godot*.log")
                .Where(f => Path.GetFileName(f) != "godot.log")
                .OrderByDescending(File.GetLastWriteTimeUtc)
                .FirstOrDefault();
        }
        catch (Exception)
        {
            return null;
        }
    }

    private static string Tail(string path, int lines)
    {
        try
        {
            if (!File.Exists(path)) return "(none)";
            using var stream = new FileStream(path, FileMode.Open, System.IO.FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            using var reader = new StreamReader(stream);
            var all = reader.ReadToEnd().Split('\n');
            return string.Join("\n", all.Skip(Math.Max(0, all.Length - lines))).TrimEnd();
        }
        catch (Exception ex)
        {
            return $"(could not read: {ex.Message})";
        }
    }
}
