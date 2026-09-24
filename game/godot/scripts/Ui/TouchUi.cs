using Godot;

namespace TuTienLuc.Ui;

public enum TouchMode
{
    Auto,
    On,
    Off,
}

/// <summary>Whether the on-screen touch controls are in use, and what their buttons are called in prompts.</summary>
public static class TouchUi
{
    /// <summary>On when the player chose it, and by default on a phone or tablet.</summary>
    public static bool Active => Game.Instance.Touch switch
    {
        TouchMode.On => true,
        TouchMode.Off => false,
        _ => OS.HasFeature("mobile"),
    };

    /// <summary>The glyph on the touch button (or HUD icon) that does <paramref name="action"/>.</summary>
    public static string Glyph(string action) => action switch
    {
        "interact" => "互",
        "dash" => "遁",
        "pill" => "丹",
        "fly" => "飛",
        "pause" => "停",
        "open_character" => "人",
        "open_map" => "圖",
        _ => "",
    };

    /// <summary>How a prompt names an action: its button's glyph with touch controls, else its key.</summary>
    public static string Prompt(string action) => Active && Glyph(action) is { Length: > 0 } glyph ? glyph : KeyMap.Label(action);
}
