using Godot;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.Field;

/// <summary>Esc during a fight or a trial: resume, or leave it (flee / abort).</summary>
public partial class FieldPause : Control
{
    private readonly FieldScreen _field;
    private VBoxContainer _col = null!;

    public FieldPause(FieldScreen field) => _field = field;

    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    public override void _Ready()
    {
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        var dim = new ColorRect { Color = new Color(Ink.InkColor, 0.45f) };
        dim.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        AddChild(dim);
        var center = new CenterContainer();
        center.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        AddChild(center);
        _col = UiKit.Column(12);
        _col.CustomMinimumSize = new Vector2(400, 0);
        center.AddChild(UiKit.Card(_col, 22));
        Refresh();
    }

    public void Refresh()
    {
        if (_col == null) return;
        UiKit.Clear(_col);
        _col.AddChild(UiKit.Label(T("Tạm dừng", "Paused"), 30, Ink.InkColor));
        _col.AddChild(UiKit.Rule());
        _col.AddChild(UiKit.Button(T("Tiếp tục  [Esc]", "Resume  [Esc]"), () => _field.SetPaused(false), primary: true));
        _col.AddChild(UiKit.Danger(_field.FleeLabel, _field.Flee));
        _col.AddChild(UiKit.Label(_field.FleeNote, 14, Ink.InkMute, wrap: true));
        _col.AddChild(UiKit.Button(T("Hệ thống…", "System…"), () =>
        {
            _field.SetPaused(false);
            _field.OpenPanel(new SystemPanel());
        }));
    }

    public override void _UnhandledInput(InputEvent e)
    {
        if (!Visible || !e.IsActionPressed("pause")) return;
        GetViewport().SetInputAsHandled();
        _field.SetPaused(false);
    }
}
