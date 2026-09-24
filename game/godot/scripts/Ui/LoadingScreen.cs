using System.Collections.Generic;
using System.Threading.Tasks;
using Godot;
using TuTienLuc.Art;

namespace TuTienLuc.Ui;

/// <summary>
/// "Đang kiến tạo thế giới…": from the tap on "Enter the cultivation world" (or Continue) until the region
/// stands. The world is built a slice per frame behind it (<see cref="Main.EnterWorld"/>), so the bar
/// follows real work; it eases along, says what is being built right now, and offers a tip.
/// </summary>
public partial class LoadingScreen : Control
{
    private static readonly (string Vi, string En)[] Tips =
    {
        ("Mỗi bước chân tốn cước lực; cước lực cạn thì sang tháng mới.", "Every step costs footwork; when it runs out, a new month begins."),
        ("Bế quan bên linh mạch, tu vi tăng nhanh hơn.", "Seclusion by a spirit vein makes your cultivation grow faster."),
        ("Tu vi viên mãn thì có thể đột phá cảnh giới.", "When your cultivation is full you can break through to the next realm."),
        ("Yêu thú hung dữ sẽ đuổi theo ngươi — liệu sức mà đánh.", "Fierce beasts give chase — know your strength before you fight."),
        ("Đến Trúc Cơ, ngươi có thể ngự kiếm bay qua sông núi.", "At Foundation Establishment you can ride your sword over rivers and cliffs."),
        ("Bảng cáo thị trong làng treo thưởng cho kẻ gan dạ.", "The village bounty board pays those with courage."),
    };

    private float _target, _shown;
    /// <summary>Each stage and how far along the work was when it began; the label follows the bar through them.</summary>
    private readonly List<(float At, string Vi, string En)> _stages = new();
    private Label _stage = null!;
    private Label _percent = null!;
    private LoadingBar _bar = null!;
    private bool _closing;

    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    /// <summary>How far the bar shows (0–1): it eases after the work.</summary>
    public float Shown => _shown;

    public override void _Ready()
    {
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        ProcessMode = ProcessModeEnum.Always;
        // Nothing underneath takes a tap while the world is built.
        MouseFilter = MouseFilterEnum.Stop;
        Modulate = new Color(1, 1, 1, 0);

        var paper = new ColorRect { Color = Ink.Paper, MouseFilter = MouseFilterEnum.Ignore };
        paper.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        AddChild(paper);

        var center = new CenterContainer { MouseFilter = MouseFilterEnum.Ignore };
        center.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        AddChild(center);
        var column = UiKit.Column(12);
        column.CustomMinimumSize = new Vector2(560, 0);
        center.AddChild(column);

        var seal = UiKit.Seal(IconKind.Lotus, 64);
        seal.SizeFlagsHorizontal = SizeFlags.ShrinkCenter;
        column.AddChild(seal);
        column.AddChild(Centred(UiKit.Label("Tu Tiên Lục", 44, Ink.InkColor)));
        column.AddChild(Centred(UiKit.Label(T("Đang kiến tạo thế giới…", "Building the world…"), 22, Ink.InkSoft)));
        column.AddChild(UiKit.Spacer(6));
        _bar = new LoadingBar { CustomMinimumSize = new Vector2(560, 22) };
        column.AddChild(_bar);

        var row = new HBoxContainer();
        _stage = UiKit.Label("", 15, Ink.JadeDeep);
        _stage.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        row.AddChild(_stage);
        _percent = UiKit.Label("0%", 15, Ink.InkMute);
        _percent.AddThemeFontOverride("font", Ink.UiFont);
        row.AddChild(_percent);
        column.AddChild(row);

        column.AddChild(UiKit.Spacer(16));
        var (vi, en) = Tips[(int)(GD.Randi() % (uint)Tips.Length)];
        var tip = Centred(UiKit.Label(T("Mẹo: " + vi, "Tip: " + en), 14, Ink.InkMute, wrap: true));
        column.AddChild(tip);

        Report(0, "Khai mở thiên địa", "Opening heaven and earth");
        CreateTween().TweenProperty(this, "modulate:a", 1f, 0.18f);
    }

    private static Label Centred(Label label)
    {
        label.HorizontalAlignment = HorizontalAlignment.Center;
        return label;
    }

    /// <summary>How far along the building is (0–1) and what it is doing now.</summary>
    public void Report(float progress, string vi, string en)
    {
        _target = Mathf.Clamp(Mathf.Max(_target, progress), 0, 1);
        if (vi.Length > 0 && (_stages.Count == 0 || _stages[^1].Vi != vi)) _stages.Add((_target, vi, en));
    }

    public override void _Process(double delta)
    {
        // Never faster than a full sweep in half a second, so even a quick build reads as progress.
        _shown = Mathf.MoveToward(_shown, _target, (float)delta * 2f);
        _bar.Value = _shown;
        _percent.Text = $"{Mathf.RoundToInt(_shown * 100)}%";
        // The words keep pace with the bar, not with the work racing ahead of it.
        var label = "";
        foreach (var (at, vi, en) in _stages)
            if (at <= _shown + 0.01f) label = T(vi, en) + (at >= 1 ? "" : "…");
        if (label.Length > 0 && _stage.Text != label) _stage.Text = label;
    }

    /// <summary>Let the bar fill up, fade away and free itself.</summary>
    public async Task Finish()
    {
        if (_closing) return;
        _closing = true;
        Report(1, "Hoàn tất", "Done");
        while (_shown < 0.999f && IsInsideTree()) await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
        if (!IsInsideTree()) return;
        MouseFilter = MouseFilterEnum.Ignore;
        var tween = CreateTween();
        tween.TweenProperty(this, "modulate:a", 0f, 0.35f);
        await ToSignal(tween, Tween.SignalName.Finished);
        QueueFree();
    }
}

/// <summary>The loading screen's ink bar: a paper track, a jade fill, a cinnabar brush tip at its head.</summary>
public partial class LoadingBar : Control
{
    private float _value;

    public float Value
    {
        get => _value;
        set
        {
            if (Mathf.IsEqualApprox(_value, value)) return;
            _value = value;
            QueueRedraw();
        }
    }

    public LoadingBar()
    {
        MouseFilter = MouseFilterEnum.Ignore;
    }

    public override void _Draw()
    {
        using var ink = Brush.On(this);
        var size = Size;
        var track = new Rect2(0, size.Y * 0.25f, size.X, size.Y * 0.5f);
        ink.DrawRect(track, Ink.PaperDarker);
        var w = size.X * Mathf.Clamp(_value, 0, 1);
        if (w > 0.5f)
        {
            ink.DrawRect(new Rect2(track.Position, new Vector2(w, track.Size.Y)), Ink.Jade);
            ink.DrawRect(new Rect2(track.Position + new Vector2(0, track.Size.Y * 0.62f), new Vector2(w, track.Size.Y * 0.38f)), Ink.JadeDeep);
        }
        ink.DrawRect(track, Ink.LineStrong, false, 1);
        var head = new Vector2(w, size.Y / 2);
        ink.DrawCircle(head, size.Y * 0.4f, Ink.Cinnabar, antialiased: true);
        ink.DrawCircle(head, size.Y * 0.15f, Ink.Card, antialiased: true);
    }
}
