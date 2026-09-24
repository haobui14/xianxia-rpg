using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Rules;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

public partial class BreakthroughResultPanel : InkPanel
{
    private readonly List<GameEvent> _events;
    private readonly double _performance;
    private readonly bool _success;

    public BreakthroughResultPanel(List<GameEvent> events, double performance)
    {
        _events = events;
        _performance = performance;
        _success = events.Any(e => e.Kind == "realm_up");
    }

    protected override IconKind Emblem => _success ? IconKind.Ascend : IconKind.Crack;
    protected override string TitleText => _success ? T("Đột phá thành công", "Breakthrough!") : T("Đột phá thất bại", "The breakthrough failed");
    protected override Vector2 PanelSize => new(700, 520);

    protected override void Build()
    {
        var p = E.Player;
        Para(T($"Thành tích thử thách: {_performance * 100:0}%", $"Trial performance: {_performance * 100:0}%"), 18, Ink.InkColor);
        if (_success)
        {
            Para(Text.Realm(p.Realm, p.Stage), 26, Ink.Realm(p.Realm).Darkened(0.2f));
            if (_events.Any(e => e.Kind == "foundation"))
                Para(T($"Nền móng {Foundation.Name(p.Foundation, Locale.Vi)} — lợi ích đột phá ×{Foundation.GainMultiplier(p.Foundation):0.##}, uy lực +{(Foundation.PowerMultiplier(p.Foundation) - 1) * 100:0}% vĩnh viễn",
                    $"A {Foundation.Name(p.Foundation, Locale.En)} foundation — breakthrough gains ×{Foundation.GainMultiplier(p.Foundation):0.##}, +{(Foundation.PowerMultiplier(p.Foundation) - 1) * 100:0}% power for good"),
                    18, p.Foundation >= FoundationGrade.Thuong ? Ink.GoldDeep : Ink.JadeDeep);
            Para(T($"Khí huyết {p.HpMax} · linh lực {p.QiMax} · cước lực {p.FootworkMax}/tháng", $"Health {p.HpMax} · Qi {p.QiMax} · footwork {p.FootworkMax}/month"), 16, Ink.InkSoft);
        }
        foreach (var e in _events)
        {
            var color = e.Level == EventLevel.Major ? Ink.JadeDeep : e.Level == EventLevel.Warning ? Ink.CinnabarDeep : Ink.InkSoft;
            Para("· " + e.Localized(Game.Instance.Locale), 16, color);
        }
        if (!_success)
            Para(T("Dưỡng thương, tìm thêm công pháp, rồi thử lại khi tu vi viên mãn lần nữa.", "Heal, find more techniques, and try again when your cultivation is full once more."), 15, Ink.InkMute);
        Body.AddChild(UiKit.Spacer(8));
        Buttons(UiKit.Button(T("Tiếp tục", "Continue"), Close, primary: true));
    }
}
