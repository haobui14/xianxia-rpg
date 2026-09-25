using Godot;
using TuTienLuc.Art;
using TuTienLuc.Field;

namespace TuTienLuc.Ui.Panels;

/// <summary>
/// Before a breakthrough trial starts: what it is, what happens in it and what to do about each thing, and
/// the controls. The trial waits behind it; Begin counts three and starts, Not yet goes back to the world
/// with nothing lost (the back button too).
/// </summary>
public partial class TrialGuidePanel : InkPanel
{
    private readonly TrialBase _trial;

    public TrialGuidePanel(TrialBase trial) => _trial = trial;

    protected override IconKind Emblem => IconKind.Ascend;
    protected override string TitleText => _trial.Practice ? _trial.GuideTitle + T(" — tập luyện", " — practice") : _trial.GuideTitle;
    protected override Vector2 PanelSize => new(840, 680);
    protected override bool Closable => false;

    protected override void Build()
    {
        if (_trial.Practice)
            Para(T("Buổi tập: không được gì, cũng không mất gì. Kết quả chỉ để ngươi biết mình đã sẵn sàng chưa.",
                "A practice run: nothing to gain and nothing to lose. The result only tells you whether you're ready."), 15, Ink.JadeDeep);
        Para(_trial.GuideIntro, 16, Ink.InkColor);
        foreach (var step in _trial.GuideSteps)
        {
            var row = new HBoxContainer();
            row.AddThemeConstantOverride("separation", 14);
            var seal = UiKit.Seal(step.Icon, 44, step.Color);
            seal.SizeFlagsVertical = SizeFlags.ShrinkBegin;
            row.AddChild(seal);
            var text = UiKit.Column(2);
            text.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            text.AddChild(UiKit.Label(step.Title, 17, step.Color.Darkened(0.1f)));
            text.AddChild(UiKit.Label(step.Text, 15, Ink.InkSoft, wrap: true));
            row.AddChild(text);
            Body.AddChild(row);
        }
        Body.AddChild(UiKit.Spacer(6));
        var begin = UiKit.Button(_trial.Practice ? T("Bắt đầu tập", "Start practising") : T("Bắt đầu", "Begin"), Close, primary: true);
        begin.Name = "begin";
        begin.CustomMinimumSize = new Vector2(180, 48);
        var later = UiKit.Button(T("Chưa — quay về", "Not yet — go back"), Leave);
        later.Name = "leave";
        later.CustomMinimumSize = new Vector2(0, 48);
        Buttons(begin, later);
    }

    private void Leave()
    {
        _trial.Leave();
        Close();
    }

    /// <summary>Esc (the phone's back button) means not yet.</summary>
    public override void _UnhandledInput(InputEvent e)
    {
        if (!e.IsActionPressed("pause")) return;
        GetViewport().SetInputAsHandled();
        Leave();
    }
}
