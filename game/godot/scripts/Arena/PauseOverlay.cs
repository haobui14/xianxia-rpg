using Godot;
using TuTienLuc.Ui;

namespace TuTienLuc.Arena;

/// <summary>Esc in a fight: resume, or flee with a movement art (costs 1 footwork on the map).</summary>
public partial class PauseOverlay : Control
{
    private readonly ArenaScreen _arena;

    public PauseOverlay(ArenaScreen arena) => _arena = arena;

    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    public override void _Ready()
    {
        ProcessMode = ProcessModeEnum.Always;
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        var dim = new ColorRect { Color = new Color(Ink.InkColor, 0.45f) };
        dim.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        AddChild(dim);
        var center = new CenterContainer();
        center.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        AddChild(center);

        var col = UiKit.Column(12);
        col.CustomMinimumSize = new Vector2(380, 0);
        col.AddChild(UiKit.Label(T("Tạm dừng", "Paused"), 30, Ink.InkColor));
        col.AddChild(UiKit.Rule());
        col.AddChild(UiKit.Button(T("Tiếp tục  [Esc]", "Resume  [Esc]"), () => _arena.SetPaused(false), primary: true));
        var trial = _arena.Mode == ArenaMode.QiTrial;
        col.AddChild(UiKit.Danger(trial ? T("Dừng đột phá (tính là thất bại)", "Abort (counts as a failure)") : T("Độn thuật — bỏ chạy", "Flee the fight"), _arena.Flee));
        col.AddChild(UiKit.Label(trial
            ? T("Bỏ dở giữa chừng sẽ khiến linh khí phản phệ.", "Stopping midway makes the qi lash back.")
            : T("Chạy trốn tốn 1 cước lực; kẻ địch vẫn ở đó.", "Fleeing costs 1 footwork; the enemy stays where it was."), 14, Ink.InkMute, wrap: true));
        center.AddChild(UiKit.Card(col, 22));
    }

    public override void _UnhandledInput(InputEvent e)
    {
        if (!Visible || !e.IsActionPressed("pause")) return;
        GetViewport().SetInputAsHandled();
        _arena.SetPaused(false);
    }
}
