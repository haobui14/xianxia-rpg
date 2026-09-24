using System;
using System.Collections.Generic;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.State;
using TuTienLuc.Audio;
using TuTienLuc.Ui;
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

    // Settings (user://settings.json).
    public float MasterVolume { get; set; } = 0.8f;
    public float MusicVolume { get; set; } = 0.65f;
    public float SfxVolume { get; set; } = 0.85f;
    public bool Fullscreen { get; set; }
    public bool ScreenShake { get; set; } = true;

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
        KeyMap.Apply();
        AddChild(new SoundBoard());
        ApplyDisplay();
        // Closing the window goes through Quit too, so the sound stops before the engine does.
        GetTree().AutoAcceptQuit = false;
    }

    public override void _Notification(int what)
    {
        if (what == NotificationWMCloseRequest) Quit();
    }

    private bool _quitting;

    /// <summary>
    /// Leave the game: silence the sound, then give the audio thread a moment of real time to let go of
    /// the playbacks (frames alone aren't enough: headless with a fixed frame rate, they fly by).
    /// </summary>
    public async void Quit(int exitCode = 0)
    {
        if (_quitting) return;
        _quitting = true;
        SoundBoard.I?.Silence();
        var start = Time.GetTicksMsec();
        for (var frames = 0; frames < 4 || Time.GetTicksMsec() - start < 150; frames++)
            await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
        GetTree().Quit(exitCode);
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
        var list = events as ICollection<GameEvent> ?? new List<GameEvent>(events);
        foreach (var e in list) Say(e.Localized(Locale), e.Level);
        SoundBoard.ForEvents(list);
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
        float Volume(string key, float fallback) => data.TryGetValue(key, out var v) ? Mathf.Clamp((float)v.AsDouble(), 0, 1) : fallback;
        MasterVolume = Volume("master_volume", MasterVolume);
        MusicVolume = Volume("music_volume", MusicVolume);
        SfxVolume = Volume("sfx_volume", SfxVolume);
        if (data.TryGetValue("fullscreen", out var fs)) Fullscreen = fs.AsBool();
        if (data.TryGetValue("screen_shake", out var shake)) ScreenShake = shake.AsBool();
        if (data.TryGetValue("keys", out var keys) && keys.VariantType == Variant.Type.Dictionary) KeyMap.Load(keys.AsGodotDictionary());
    }

    /// <summary>Off while the smoke test runs, so testing never rewrites the player's own settings.</summary>
    public bool PersistSettings { get; set; } = true;

    public void SaveSettings()
    {
        if (!PersistSettings) return;
        using var f = FileAccess.Open(SettingsPath, FileAccess.ModeFlags.Write);
        f?.StoreString(Json.Stringify(new Godot.Collections.Dictionary
        {
            ["locale"] = Locale == Locale.En ? "en" : "vi",
            ["master_volume"] = MasterVolume,
            ["music_volume"] = MusicVolume,
            ["sfx_volume"] = SfxVolume,
            ["fullscreen"] = Fullscreen,
            ["screen_shake"] = ScreenShake,
            ["keys"] = KeyMap.Save(),
        }));
    }

    /// <summary>Window mode from the settings (never in the headless smoke test).</summary>
    public void ApplyDisplay()
    {
        if (DisplayServer.GetName() == "headless") return;
        var want = Fullscreen ? DisplayServer.WindowMode.Fullscreen : DisplayServer.WindowMode.Windowed;
        if (DisplayServer.WindowGetMode() != want && !(want == DisplayServer.WindowMode.Windowed && DisplayServer.WindowGetMode() == DisplayServer.WindowMode.Maximized))
            DisplayServer.WindowSetMode(want);
    }

    // ------------------------------------------------------------------ input (design §8)

    /// <summary>
    /// The controller layout and the mouse-free axes. Keyboard keys come from <see cref="KeyMap"/> (the
    /// player's own layout), applied once the settings are loaded.
    /// </summary>
    private static void RegisterInput()
    {
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

        Axis("move_up", JoyAxis.LeftY, -1);
        Axis("move_down", JoyAxis.LeftY, 1);
        Axis("move_left", JoyAxis.LeftX, -1);
        Axis("move_right", JoyAxis.LeftX, 1);
        Pad("move_up", JoyButton.DpadUp);
        Pad("move_down", JoyButton.DpadDown);
        Pad("move_left", JoyButton.DpadLeft);
        Pad("move_right", JoyButton.DpadRight);

        // Exploring and fighting share one field, so one button may mean different things in and out
        // of a fight (Y talks to people, or looses the ultimate).
        Pad("interact", JoyButton.Y);
        Pad("end_month", JoyButton.LeftStick);
        Pad("pulse", JoyButton.RightStick);
        Pad("open_map", JoyButton.Back);
        Pad("pause", JoyButton.Start);

        // The mouse buttons are read from unhandled input by the field (so HUD clicks never swing),
        // which is why "attack" and "skill_1" have only pad bindings here.
        Axis("attack", JoyAxis.TriggerRight, 1);
        Pad("skill_1", JoyButton.RightShoulder);
        Pad("skill_2", JoyButton.LeftShoulder);
        Axis("skill_3", JoyAxis.TriggerLeft, 1);
        Pad("skill_4", JoyButton.X);
        Pad("dash", JoyButton.A);
        Pad("ultimate", JoyButton.Y);
        Pad("pill", JoyButton.B);
        Axis("aim_left", JoyAxis.RightX, -1);
        Axis("aim_right", JoyAxis.RightX, 1);
        Axis("aim_up", JoyAxis.RightY, -1);
        Axis("aim_down", JoyAxis.RightY, 1);
    }
}
