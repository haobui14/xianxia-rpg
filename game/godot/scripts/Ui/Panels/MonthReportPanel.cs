using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.World;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

/// <summary>What a month (or a seclusion) brought: cultivation, events, and the world's rumors.</summary>
public partial class MonthReportPanel : InkPanel
{
    private readonly MonthReport _report;
    private readonly bool _seclusion;

    public MonthReportPanel(MonthReport report, bool seclusion = false)
    {
        _report = report;
        _seclusion = seclusion;
    }

    protected override IconKind Emblem => _seclusion ? IconKind.Lotus : IconKind.Moon;
    protected override string TitleText => _seclusion
        ? T($"Xuất quan sau {_report.Months} tháng", $"Leaving seclusion after {_report.Months} month{(_report.Months == 1 ? "" : "s")}")
        : T("Qua tháng", "The month turns");
    protected override Vector2 PanelSize => new(760, 620);

    protected override void Build()
    {
        Para(Text.Date(E.State.Calendar), 22, Ink.InkColor);
        Para(T($"Tu vi +{_report.TotalExp}", $"Cultivation +{_report.TotalExp}"), 20, Ink.JadeDeep);
        var b = _report.Cultivation;
        if (b.Total > 0)
        {
            Para(T($"(tháng gần nhất: cơ sở {b.Base} × linh căn {b.RootMultiplier:0.##} × công pháp {b.TechniqueMultiplier:0.##} × tông môn {b.SectMultiplier:0.##}, thưởng +{b.TotalPercentBonus}%, × hoạt động {b.ActivityMultiplier:0.#})",
                $"(last month: base {b.Base} × root {b.RootMultiplier:0.##} × technique {b.TechniqueMultiplier:0.##} × sect {b.SectMultiplier:0.##}, bonus +{b.TotalPercentBonus}%, × activity {b.ActivityMultiplier:0.#})"), 14, Ink.InkMute);
        }

        var events = _report.Events;
        if (events.Count > 0)
        {
            Section(T("Chuyện đã xảy ra", "What happened"));
            foreach (var e in events)
            {
                var color = e.Level == EventLevel.Major ? Ink.JadeDeep : e.Level == EventLevel.Warning ? Ink.CinnabarDeep : Ink.InkSoft;
                Para("· " + e.Localized(Game.Instance.Locale), 16, color);
            }
        }

        if (_report.Rumors.Count > 0)
        {
            Section(T("Tin đồn giang hồ", "Rumors on the road"));
            foreach (var r in _report.Rumors.Take(8))
                Para("“" + T(r.Text, r.TextEn) + "”", 15, Ink.Violet);
        }

        if (_report.InterruptEventId != null)
            Para(T("Giữa lúc bế quan, tâm ma quấy nhiễu — ngươi phải đối mặt.", "Mid-seclusion, something stirs in your mind — you must face it."), 16, Ink.Cinnabar);
        if (_report.Ambushed)
            Para(T("Có kẻ mai phục đang chờ ngươi!", "Someone lies in ambush for you!"), 16, Ink.Cinnabar);

        Body.AddChild(UiKit.Spacer(8));
        var row = Buttons();
        if (E.BreakthroughReady && !E.Player.Dead && _report.InterruptEventId == null && !_report.Ambushed)
            row.AddChild(UiKit.Button(T("✦ Đột phá ngay", "✦ Break through now"), () => Open(new BreakthroughPanel()), primary: true));
        row.AddChild(UiKit.Button(T("Tiếp tục", "Continue"), Continue, primary: !E.BreakthroughReady));
    }

    private void Continue()
    {
        if (_report.InterruptEventId != null && !E.Player.Dead)
            Open(new EventPanel(null, _report.InterruptEventId));
        else
            Close();
    }
}
