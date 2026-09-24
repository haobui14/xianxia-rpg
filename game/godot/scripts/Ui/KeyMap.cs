using System.Collections.Generic;
using System.Linq;
using Godot;

namespace TuTienLuc.Ui;

/// <summary>
/// The keyboard layout the player chose (design §8: keys are remappable). Every action here has one
/// key of the player's choosing. Some keys stay bound whatever happens, so nobody can lock themselves
/// out: the arrows walk, Shift dashes, Esc pauses. The mouse buttons and the controller layout aren't
/// remappable yet. Bindings are physical key positions, shown with the name the player's own keyboard
/// layout gives them, and saved in user://settings.json.
/// </summary>
public static class KeyMap
{
    public sealed record Binding(string Action, string Vi, string En, Key Default, bool Fight);

    public static readonly Binding[] All =
    {
        new("move_up", "Đi lên", "Move up", Key.W, false),
        new("move_left", "Đi sang trái", "Move left", Key.A, false),
        new("move_down", "Đi xuống", "Move down", Key.S, false),
        new("move_right", "Đi sang phải", "Move right", Key.D, false),
        new("interact", "Tương tác", "Interact", Key.E, false),
        new("open_map", "Bản đồ", "Map", Key.M, false),
        new("end_month", "Qua tháng sớm", "End the month early", Key.N, false),
        new("seclude", "Bế quan", "Seclusion", Key.B, false),
        new("pulse", "Thần thức", "Sense pulse", Key.Tab, false),
        new("fly", "Ngự kiếm (Trúc Cơ)", "Sword flight (Foundation)", Key.V, false),
        new("open_character", "Nhân vật", "Character", Key.C, false),
        new("open_inventory", "Hành trang", "Inventory", Key.I, false),
        new("open_journal", "Sổ tay", "Journal", Key.J, false),
        new("skill_2", "Linh kỹ ô 2", "Spirit art, slot 2", Key.Key1, true),
        new("skill_3", "Linh kỹ ô 3", "Spirit art, slot 3", Key.Key2, true),
        new("skill_4", "Linh kỹ ô 4", "Spirit art, slot 4", Key.Key3, true),
        new("dash", "Lướt", "Dash", Key.Space, true),
        new("ultimate", "Tuyệt kỹ", "Ultimate", Key.R, true),
        new("pill", "Đan dược", "Pill", Key.Q, true),
    };

    /// <summary>Always bound, never offered: they keep working whatever the player picks.</summary>
    private static readonly Dictionary<string, Key[]> Fixed = new()
    {
        ["move_up"] = new[] { Key.Up },
        ["move_down"] = new[] { Key.Down },
        ["move_left"] = new[] { Key.Left },
        ["move_right"] = new[] { Key.Right },
        ["dash"] = new[] { Key.Shift },
        ["pause"] = new[] { Key.Escape },
        ["debug"] = new[] { Key.F9 },
    };

    private static readonly Dictionary<string, Key> Chosen = new();

    public static Binding? Find(string action) => All.FirstOrDefault(b => b.Action == action);

    public static Key Get(string action) =>
        Chosen.TryGetValue(action, out var key) ? key : Find(action)?.Default ?? (Fixed.TryGetValue(action, out var f) ? f[0] : Key.None);

    /// <summary>Keys that already mean something fixed can't be given to anything else.</summary>
    public static bool Reserved(Key key) => Fixed.Values.Any(keys => keys.Contains(key)) || key is Key.None or Key.Unknown;

    /// <summary>A key the player may pick: not fixed to something else, not a modifier or a system key.</summary>
    public static bool Bindable(Key key) =>
        !Reserved(key) && key is not (Key.Ctrl or Key.Alt or Key.Meta or Key.Capslock or Key.Numlock or Key.Scrolllock or Key.Print or Key.Menu);

    public static bool IsDefault => All.All(b => Get(b.Action) == b.Default);

    /// <summary>
    /// Give <paramref name="action"/> the key; if another action had it, that one takes this one's old key
    /// (a swap, so two actions never share a key). Returns the action that was swapped, if any.
    /// </summary>
    public static string? Rebind(string action, Key key)
    {
        if (Find(action) == null || !Bindable(key)) return null;
        var old = Get(action);
        if (old == key) return null;
        var other = All.FirstOrDefault(b => b.Action != action && Get(b.Action) == key);
        Chosen[action] = key;
        if (other != null) Chosen[other.Action] = old;
        Apply();
        return other?.Action;
    }

    public static void Reset()
    {
        Chosen.Clear();
        Apply();
    }

    /// <summary>Write the keyboard bindings into Godot's InputMap (the controller's events stay as they are).</summary>
    public static void Apply()
    {
        foreach (var action in All.Select(b => b.Action).Concat(Fixed.Keys).Distinct())
        {
            if (!InputMap.HasAction(action)) InputMap.AddAction(action);
            foreach (var e in InputMap.ActionGetEvents(action))
                if (e is InputEventKey) InputMap.ActionEraseEvent(action, e);
            if (Find(action) != null) InputMap.ActionAddEvent(action, new InputEventKey { PhysicalKeycode = Get(action) });
            if (Fixed.TryGetValue(action, out var keys))
                foreach (var k in keys) InputMap.ActionAddEvent(action, new InputEventKey { PhysicalKeycode = k });
        }
    }

    // ------------------------------------------------------------------ names

    /// <summary>What the key is called on this keyboard (a physical W is "Z" on AZERTY).</summary>
    public static string Name(Key physical)
    {
        var key = physical;
        if (DisplayServer.GetName() != "headless")
        {
            var local = DisplayServer.KeyboardGetKeycodeFromPhysical(physical);
            if (local != Key.None) key = local;
        }
        return key switch
        {
            Key.None => "—",
            Key.Escape => "Esc",
            Key.Space => "Space",
            _ => OS.GetKeycodeString(key),
        };
    }

    public static string Label(string action) => Name(Get(action));

    /// <summary>The four walking keys as players say them: "WASD", or "W/A/S/D" when they aren't single letters.</summary>
    public static string MoveKeys
    {
        get
        {
            var names = new[] { "move_up", "move_left", "move_down", "move_right" }.Select(Label).ToArray();
            return names.All(n => n.Length == 1) ? string.Concat(names) : string.Join("/", names);
        }
    }

    // ------------------------------------------------------------------ settings.json


    public static Godot.Collections.Dictionary Save()
    {
        var d = new Godot.Collections.Dictionary();
        foreach (var (action, key) in Chosen) d[action] = OS.GetKeycodeString(key);
        return d;
    }

    public static void Load(Godot.Collections.Dictionary d)
    {
        Chosen.Clear();
        foreach (var (action, value) in d)
        {
            var name = action.AsString();
            var key = OS.FindKeycodeFromString(value.AsString());
            if (Find(name) == null || !Bindable(key) || Chosen.ContainsValue(key)) continue;
            Chosen[name] = key;
        }
        // A saved layout from a hand-edited file could still clash with a default: keep the first.
        foreach (var b in All)
            if (!Chosen.ContainsKey(b.Action) && Chosen.ContainsValue(b.Default))
                Chosen[b.Action] = Key.None;
    }
}

/// <summary>The key summaries the menus show, always in the player's own keys.</summary>
public static class KeysText
{
    private static string T(string vi, string en) => Game.Instance.T(vi, en);
    private static string K(string action) => KeyMap.Label(action);

    public static string World() => T(
        $"Thế giới: {KeyMap.MoveKeys} đi · {K("interact")} tương tác · {K("open_map")} bản đồ (nhấp để lên đường) · {K("end_month")} qua tháng sớm · {K("seclude")} bế quan · {K("pulse")} thần thức · {K("fly")} ngự kiếm (từ Trúc Cơ) · {K("open_character")}/{K("open_inventory")}/{K("open_journal")} nhân vật / hành trang / sổ tay · cuộn chuột phóng to · F9 gian lận (thử nghiệm)",
        $"World: {KeyMap.MoveKeys} walk · {K("interact")} interact · {K("open_map")} map (click to travel) · {K("end_month")} end the month early · {K("seclude")} seclusion · {K("pulse")} sense pulse · {K("fly")} sword flight (from Foundation) · {K("open_character")}/{K("open_inventory")}/{K("open_journal")} character / inventory / journal · wheel zooms · F9 dev cheats");

    public static string Fight() => T(
        $"Chiến đấu ngay tại chỗ: chém yêu thú để giao chiến · chuột trái võ kỹ · chuột phải/{K("skill_2")}/{K("skill_3")}/{K("skill_4")} linh kỹ · {K("dash")} lướt · {K("ultimate")} tuyệt kỹ · {K("pill")} đan dược · chạy thật xa để thoát · Esc tạm dừng",
        $"Fights happen where you meet: strike a beast to engage · left click martial art · right click/{K("skill_2")}/{K("skill_3")}/{K("skill_4")} spirit arts · {K("dash")} dash · {K("ultimate")} ultimate · {K("pill")} pill · run far away to escape · Esc pause");
}
