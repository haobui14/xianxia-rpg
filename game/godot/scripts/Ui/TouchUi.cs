using Godot;

namespace TuTienLuc.Ui;

public enum TouchMode
{
    Auto,
    On,
    Off,
}

/// <summary>Whether the on-screen touch controls are in use, and how prompts name their buttons.</summary>
public static class TouchUi
{
    /// <summary>On when the player chose it, and by default on a phone or tablet.</summary>
    public static bool Active => Game.Instance.Touch switch
    {
        TouchMode.On => true,
        TouchMode.Off => false,
        _ => OS.HasFeature("mobile"),
    };

    /// <summary>What the touch button (or HUD icon) for <paramref name="action"/> is called.</summary>
    public static string ButtonName(string action) => action switch
    {
        "interact" => Game.Instance.T("nút Tương tác", "the Interact button"),
        "dash" => Game.Instance.T("nút Lướt", "the Dash button"),
        "pill" => Game.Instance.T("nút Đan dược", "the Pill button"),
        "fly" => Game.Instance.T("nút Ngự kiếm", "the Fly button"),
        "pause" => Game.Instance.T("nút Tạm dừng", "the Pause button"),
        "attack" => Game.Instance.T("nút Kiếm", "the Sword button"),
        "open_character" => Game.Instance.T("biểu tượng Nhân vật", "the Character icon"),
        "open_map" => Game.Instance.T("biểu tượng Bản đồ", "the Map icon"),
        _ => "",
    };

    /// <summary>How a prompt names an action: its touch button with touch controls, else its key.</summary>
    public static string Prompt(string action) => Active && ButtonName(action) is { Length: > 0 } name ? name : KeyMap.Label(action);
}
