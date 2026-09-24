using System.Linq;
using Godot;
using TuTienLuc.Audio;

namespace TuTienLuc.Ui.Panels;

/// <summary>
/// Rebind the keyboard: click an action's key, then press the new one (Esc cancels). A key already in
/// use swaps places with it, so two actions never share one. Saved at once.
/// </summary>
public partial class KeysPanel : InkPanel
{
    private string? _waiting;
    private string _note = "";

    protected override string Glyph => "鍵";
    protected override string TitleText => T("Phím", "Keys");
    protected override Vector2 PanelSize => new(640, 700);

    private static string ActionName(string action) => KeyMap.Find(action) is { } b ? T(b.Vi, b.En) : action;

    protected override void Build()
    {
        Para(_waiting != null
                ? T($"Nhấn phím mới cho «{ActionName(_waiting)}» — Esc để hủy.", $"Press the new key for “{ActionName(_waiting)}” — Esc cancels.")
                : T("Nhấp vào một phím để đổi. Nếu phím mới đã có việc, hai việc đổi chỗ cho nhau.",
                    "Click a key to change it. If the new key is already in use, the two actions swap."),
            14, _waiting != null ? Ink.CinnabarDeep : Ink.InkMute);
        if (_note.Length > 0) Para(_note, 14, Ink.JadeDeep);

        Section(T("Đi lại và thế giới", "Moving and the world"));
        foreach (var b in KeyMap.All.Where(b => !b.Fight)) KeyRow(b);
        Section(T("Chiến đấu", "Fighting"));
        FixedRow(T("Võ kỹ (chém)", "Martial art (strike)"), T("Chuột trái", "Left mouse"));
        FixedRow(T("Linh kỹ ô 1", "Spirit art, slot 1"), T("Chuột phải", "Right mouse"));
        foreach (var b in KeyMap.All.Where(b => b.Fight)) KeyRow(b);
        Para(T("Luôn dùng được, không đổi: phím mũi tên để đi, Shift để lướt, Esc để tạm dừng. Tay cầm dùng bố cục mặc định.",
            "Always there, never rebound: the arrow keys walk, Shift dashes, Esc pauses. Controllers keep the default layout."), 13, Ink.InkFaint);

        Body.AddChild(UiKit.Spacer(4));
        Buttons(
            UiKit.Button(T("Xong", "Done"), Close, primary: true),
            UiKit.Button(T("Về mặc định", "Restore defaults"), () =>
            {
                KeyMap.Reset();
                Game.Instance.SaveSettings();
                _waiting = null;
                _note = T("Đã trả mọi phím về mặc định.", "Every key is back to its default.");
                Game.Instance.Changed();
            }, enabled: !KeyMap.IsDefault));
    }

    private void KeyRow(KeyMap.Binding b)
    {
        var waiting = _waiting == b.Action;
        var key = UiKit.Button(waiting ? T("Nhấn phím…", "Press a key…") : KeyMap.Label(b.Action), () =>
        {
            _waiting = b.Action;
            _note = "";
            RequestRefresh();
        }, primary: waiting);
        key.CustomMinimumSize = new Vector2(150, 0);
        key.Name = "key_" + b.Action;
        if (KeyMap.Get(b.Action) != b.Default && !waiting) key.AddThemeColorOverride("font_color", Ink.JadeDeep);
        Row(UiKit.Label(T(b.Vi, b.En), 16, Ink.InkColor), key);
    }

    private void FixedRow(string what, string key)
    {
        var label = UiKit.Label(key, 15, Ink.InkMute);
        label.CustomMinimumSize = new Vector2(150, 0);
        label.HorizontalAlignment = HorizontalAlignment.Center;
        Row(UiKit.Label(what, 16, Ink.InkSoft), label);
    }

    /// <summary>While waiting, the next key press is the new binding (before the game or the panel sees it).</summary>
    public override void _Input(InputEvent e)
    {
        if (_waiting == null || e is not InputEventKey { Pressed: true, Echo: false } k) return;
        GetViewport().SetInputAsHandled();
        var action = _waiting;
        _waiting = null;
        var key = k.PhysicalKeycode != Key.None ? k.PhysicalKeycode : k.Keycode;
        if (key == Key.Escape)
        {
            _note = "";
        }
        else if (!KeyMap.Bindable(key))
        {
            _note = T($"{KeyMap.Name(key)} không gán được (phím cố định hoặc phím hệ thống).", $"{KeyMap.Name(key)} can't be bound (it's fixed, or a system key).");
        }
        else
        {
            var swapped = KeyMap.Rebind(action, key);
            Game.Instance.SaveSettings();
            SoundBoard.Play("click");
            _note = swapped != null
                ? T($"«{ActionName(action)}» nay là {KeyMap.Label(action)}; «{ActionName(swapped)}» đổi sang {KeyMap.Label(swapped)}.",
                    $"“{ActionName(action)}” is now {KeyMap.Label(action)}; “{ActionName(swapped)}” moved to {KeyMap.Label(swapped)}.")
                : T($"«{ActionName(action)}» nay là {KeyMap.Label(action)}.", $"“{ActionName(action)}” is now {KeyMap.Label(action)}.");
        }
        // Rebuilds this panel and every hint that names a key.
        Game.Instance.Changed();
    }
}
