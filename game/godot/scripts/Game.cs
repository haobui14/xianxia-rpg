using System;
using System.Collections.Generic;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.State;
using FileAccess = Godot.FileAccess;

namespace TuTienLuc;

/// <summary>
/// Autoload: owns the content database and the running <see cref="GameEngine"/>, saves and
/// settings, and the input map. Screens talk to the rules only through <see cref="Engine"/>.
/// </summary>
public partial class Game : Node
{
    private const string SettingsPath = "user://settings.json";

    public static Game Instance { get; private set; } = null!;

    public ContentDb Content { get; private set; } = null!;
    public GameEngine? Engine { get; private set; }
    public Locale Locale { get; private set; } = Locale.Vi;
    /// <summary>One save slot for now; the smoke test points this elsewhere so it never touches a real save.</summary>
    public string SavePath { get; set; } = "user://saves/slot1.json";

    /// <summary>Raised after anything changes the game state, so HUDs can refresh.</summary>
    [Signal] public delegate void StateChangedEventHandler();

    /// <summary>Raised for each game event worth a toast (text already localized).</summary>
    [Signal] public delegate void ToastedEventHandler(string text, int level);

    [Signal] public delegate void LocaleChangedEventHandler();

    public override void _EnterTree() => Instance = this;

    public override void _Ready()
    {
        Content = ContentDb.Load(ReadContent);
        var issues = Content.Validate();
        GD.Print($"[content] loaded: {Content.Regions.Count} regions, {Content.Enemies.Count} enemies, {Content.Events.Count} events, {issues.Count} known content gaps");
        RegisterInput();
        LoadSettings();
    }

    private static string? ReadContent(string file)
    {
        using var f = FileAccess.Open("res://content/" + file, FileAccess.ModeFlags.Read);
        return f?.GetAsText();
    }

    // ------------------------------------------------------------------ text

    public string T(string vi, string en) => Locale == Locale.En ? en : vi;

    public void SetLocale(Locale locale)
    {
        Locale = locale;
        if (Engine != null) Engine.State.Locale = locale;
        SaveSettings();
        EmitSignal(SignalName.LocaleChanged);
        EmitSignal(SignalName.StateChanged);
    }

    // ------------------------------------------------------------------ game lifecycle

    public void NewGame(string name, int age, SpiritRootState root, CultivationPath path, ulong seed)
    {
        Engine = GameEngine.NewGame(Content, seed, name, age, root, path, Locale);
        Log.Clear();
        SaveGame();
        Changed();
    }

    public bool HasSave => FileAccess.FileExists(SavePath);

    public void SaveGame()
    {
        if (Engine == null || Engine.ActiveEncounter != null) return;
        DirAccess.MakeDirRecursiveAbsolute("user://saves");
        using var f = FileAccess.Open(SavePath, FileAccess.ModeFlags.Write);
        f?.StoreString(Engine.Save());
    }

    public bool LoadGame()
    {
        if (!HasSave) return false;
        try
        {
            using var f = FileAccess.Open(SavePath, FileAccess.ModeFlags.Read);
            Engine = GameEngine.Load(Content, f.GetAsText());
            Locale = Engine.State.Locale;
            Log.Clear();
            Changed();
            return true;
        }
        catch (Exception ex)
        {
            GD.PushError($"Could not load save: {ex.Message}");
            return false;
        }
    }

    /// <summary>A run is over (death): forget it, so "Continue" can't resurrect it.</summary>
    public void EndRun()
    {
        Engine = null;
        if (HasSave) DirAccess.RemoveAbsolute(ProjectSettings.GlobalizePath(SavePath));
    }

    /// <summary>The last messages shown, newest last — the HUD's log survives screen changes.</summary>
    public List<(string Text, EventLevel Level)> Log { get; } = new();

    /// <summary>Report events from a command as toasts, then refresh listeners.</summary>
    public void Notify(IEnumerable<GameEvent> events)
    {
        foreach (var e in events) Say(e.Localized(Locale), e.Level);
        Changed();
    }

    public void Toast(string vi, string en, EventLevel level = EventLevel.Info) => Say(T(vi, en), level);

    /// <summary>Log events a panel already shows in full, without toasting them again.</summary>
    public void Remember(IEnumerable<GameEvent> events)
    {
        foreach (var e in events) Log.Add((e.Localized(Locale), e.Level));
        if (Log.Count > 40) Log.RemoveRange(0, Log.Count - 40);
        Changed();
    }

    private void Say(string text, EventLevel level)
    {
        Log.Add((text, level));
        if (Log.Count > 40) Log.RemoveRange(0, Log.Count - 40);
        EmitSignal(SignalName.Toasted, text, (int)level);
    }

    public void Changed() => EmitSignal(SignalName.StateChanged);

    // ------------------------------------------------------------------ settings

    private void LoadSettings()
    {
        using var f = FileAccess.Open(SettingsPath, FileAccess.ModeFlags.Read);
        if (f == null) return;
        var data = Json.ParseString(f.GetAsText()).AsGodotDictionary();
        if (data.TryGetValue("locale", out var loc)) Locale = loc.AsString() == "en" ? Locale.En : Locale.Vi;
    }

    private void SaveSettings()
    {
        using var f = FileAccess.Open(SettingsPath, FileAccess.ModeFlags.Write);
        f?.StoreString(Json.Stringify(new Godot.Collections.Dictionary { ["locale"] = Locale == Locale.En ? "en" : "vi" }));
    }

    // ------------------------------------------------------------------ input (design §8)

    private static void RegisterInput()
    {
        void Keys(string action, params Key[] keys)
        {
            if (!InputMap.HasAction(action)) InputMap.AddAction(action);
            foreach (var k in keys) InputMap.ActionAddEvent(action, new InputEventKey { PhysicalKeycode = k });
        }
        void Mouse(string action, MouseButton button)
        {
            if (!InputMap.HasAction(action)) InputMap.AddAction(action);
            InputMap.ActionAddEvent(action, new InputEventMouseButton { ButtonIndex = button });
        }
        void Pad(string action, JoyButton button)
        {
            if (!InputMap.HasAction(action)) InputMap.AddAction(action);
            InputMap.ActionAddEvent(action, new InputEventJoypadButton { ButtonIndex = button });
        }
        void Axis(string action, JoyAxis axis, float value)
        {
            if (!InputMap.HasAction(action)) InputMap.AddAction(action, 0.4f);
            InputMap.ActionAddEvent(action, new InputEventJoypadMotion { Axis = axis, AxisValue = value });
        }

        Keys("move_up", Key.W, Key.Up);
        Keys("move_down", Key.S, Key.Down);
        Keys("move_left", Key.A, Key.Left);
        Keys("move_right", Key.D, Key.Right);
        Axis("move_up", JoyAxis.LeftY, -1);
        Axis("move_down", JoyAxis.LeftY, 1);
        Axis("move_left", JoyAxis.LeftX, -1);
        Axis("move_right", JoyAxis.LeftX, 1);
        Pad("move_up", JoyButton.DpadUp);
        Pad("move_down", JoyButton.DpadDown);
        Pad("move_left", JoyButton.DpadLeft);
        Pad("move_right", JoyButton.DpadRight);

        Keys("interact", Key.E);
        Pad("interact", JoyButton.A);
        Keys("end_month", Key.N);
        Pad("end_month", JoyButton.Y);
        Keys("pulse", Key.Tab);
        Pad("pulse", JoyButton.X);
        Keys("seclude", Key.B);
        Keys("open_character", Key.C);
        Keys("open_inventory", Key.I);
        Keys("open_journal", Key.J);
        Keys("pause", Key.Escape);
        Pad("pause", JoyButton.Start);
        Keys("debug", Key.F9);

        Mouse("attack", MouseButton.Left);
        Axis("attack", JoyAxis.TriggerRight, 1);
        Mouse("skill_1", MouseButton.Right);
        Pad("skill_1", JoyButton.RightShoulder);
        Keys("skill_2", Key.Key1);
        Pad("skill_2", JoyButton.LeftShoulder);
        Keys("skill_3", Key.Key2);
        Axis("skill_3", JoyAxis.TriggerLeft, 1);
        Keys("skill_4", Key.Key3);
        Pad("skill_4", JoyButton.X);
        Keys("dash", Key.Space, Key.Shift);
        Pad("dash", JoyButton.A);
        Keys("ultimate", Key.R);
        Pad("ultimate", JoyButton.Y);
        Keys("pill", Key.Q);
        Pad("pill", JoyButton.B);
        Axis("aim_left", JoyAxis.RightX, -1);
        Axis("aim_right", JoyAxis.RightX, 1);
        Axis("aim_up", JoyAxis.RightY, -1);
        Axis("aim_down", JoyAxis.RightY, 1);
    }
}
