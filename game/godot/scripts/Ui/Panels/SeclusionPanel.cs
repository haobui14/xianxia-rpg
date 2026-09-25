using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

/// <summary>
/// Bế quan (design §7.5): pass months at once for ×1.6 cultivation. Shows every factor of the
/// monthly gain so the player can see why a spirit vein or a technique matters.
/// </summary>
public partial class SeclusionPanel : InkPanel
{
    /// <summary>Qi density a rented quiet room adds.</summary>
    public const int InnDensity = 10;

    private readonly TownDef? _inn;
    private readonly ChamberDef? _chamber;
    private int _months = 3;

    public SeclusionPanel(TownDef? inn = null) => _inn = inn;

    /// <summary>In the sect's spirit-gathering chamber: more qi, paid for in spirit stones.</summary>
    public SeclusionPanel(ChamberDef chamber) => _chamber = chamber;

    private int ExtraDensity => _inn != null ? InnDensity : _chamber?.QiDensity ?? 0;
    private int SilverPerMonth => _inn?.SeclusionCostPerMonth ?? 0;
    private int StonesPerMonth => _chamber?.StonesPerMonth ?? 0;

    protected override IconKind Emblem => IconKind.Lotus;
    protected override string TitleText => T("Bế quan tu luyện", "Secluded cultivation");
    protected override Vector2 PanelSize => new(760, 640);

    protected override void Build()
    {
        var p = E.Player;
        var extra = ExtraDensity;
        var cost = SilverPerMonth;
        var poi = E.PoiHere();

        string where;
        if (_chamber != null)
            where = T($"{_chamber.Name}: linh khí +{_chamber.QiDensity}%, {_chamber.StonesPerMonth} linh thạch/tháng (ngươi có {p.SpiritStones}).",
                $"The {_chamber.NameEn}: +{_chamber.QiDensity}% qi, {_chamber.StonesPerMonth} spirit stones/month (you have {p.SpiritStones}).");
        else if (_inn != null)
            where = T($"Tĩnh thất khách điếm: linh khí +{InnDensity}%, {cost} bạc/tháng.", $"Inn quiet room: +{InnDensity}% qi, {cost} silver/month.");
        else if (poi is { Kind: "spirit_vein" })
            where = T($"{poi.Name}: linh mạch, linh khí +{poi.QiBonus}%.", $"{poi.NameEn}: a spirit vein, +{poi.QiBonus}% qi.");
        else if (E.ZoneHere is { IsSafe: true } safe)
            where = T($"Tĩnh tọa tại {safe.Name}: yên ổn, không tốn bạc (tĩnh thất khách điếm cho thêm linh khí).",
                $"Meditating in {safe.NameEn}: safe and free (the inn's quiet room adds qi).");
        else
            where = T("Nơi hoang dã: không tốn bạc, nhưng yêu thú và kẻ thù có thể tìm tới.", "In the wild: free, but beasts and enemies may find you.");
        Para(where, 16, Ink.InkColor);

        Section(T("Thời gian", "Duration"));
        var row = new HBoxContainer();
        foreach (var m in new[] { 1, 3, 6, 12 })
        {
            var months = m;
            row.AddChild(UiKit.Button(T($"{m} tháng", $"{m} month{(m > 1 ? "s" : "")}"), () =>
            {
                _months = months;
                RequestRefresh();
            }, primary: m == _months));
        }
        Body.AddChild(row);

        var b = E.PreviewMonth(seclusion: true, extra);
        Section(T("Mỗi tháng thu được", "Each month yields"));
        var lines = T(
            $"Cơ sở ({Names.Display(p.Path == CultivationPath.Body ? (Realm)(int)p.BodyRealm : p.Realm, Locale.Vi)}): {b.Base}\n"
            + $"× linh căn {b.RootMultiplier:0.##} · × công pháp {b.TechniqueMultiplier:0.##} · × tông môn {b.SectMultiplier:0.##}\n"
            + $"+ linh khí {b.QiDensity}% · mùa {b.SeasonBonus}% · {(b.SpecialBonus > 0 ? b.SpecialReason + " " + b.SpecialBonus + "% · " : "")}trăng tròn {b.FullMoonBonus}%\n"
            + $"× bế quan {b.ActivityMultiplier:0.#}" + (b.InjuryMultiplier < 1 ? $" · × thương thế {b.InjuryMultiplier:0.##}" : ""),
            $"Base ({Names.Display(p.Path == CultivationPath.Body ? (Realm)(int)p.BodyRealm : p.Realm, Locale.En)}): {b.Base}\n"
            + $"× root {b.RootMultiplier:0.##} · × technique {b.TechniqueMultiplier:0.##} · × sect {b.SectMultiplier:0.##}\n"
            + $"+ qi density {b.QiDensity}% · season {b.SeasonBonus}% · {(b.SpecialBonus > 0 ? b.SpecialReasonEn + " " + b.SpecialBonus + "% · " : "")}full moon {b.FullMoonBonus}%\n"
            + $"× seclusion {b.ActivityMultiplier:0.#}" + (b.InjuryMultiplier < 1 ? $" · × injury {b.InjuryMultiplier:0.##}" : ""));
        Para(lines, 15, Ink.InkSoft);
        var split = p.Path == CultivationPath.Kiem
            ? T($" (khí {b.ToQi} · thể {b.ToBody})", $" (qi {b.ToQi} · body {b.ToBody})")
            : "";
        Para(T($"≈ {b.Total} tu vi mỗi tháng{split} — {_months} tháng ≈ {b.Total * _months}.",
            $"≈ {b.Total} cultivation per month{split} — {_months} months ≈ {b.Total * _months}."), 18, Ink.JadeDeep);

        var need = Progression.RequiredExp(E.Content, p.Realm, p.Stage);
        if (p.PendingMajorBreakthrough)
            Para(T("Tu vi đã viên mãn: bế quan thêm không giúp gì — hãy đột phá trước.", "Your cultivation is full: more seclusion won't help — break through first."), 15, Ink.Cinnabar);
        else if (need != long.MaxValue)
            Para(T($"Còn thiếu {System.Math.Max(0, need - p.Exp)} tu vi tới tầng kế.", $"{System.Math.Max(0, need - p.Exp)} more to the next stage."), 15, Ink.InkMute);
        Para(_chamber != null
                ? T("Bế quan có thể bị gián đoạn bởi tâm ma, phục kích, hoặc khi hết linh thạch.", "Seclusion can be interrupted by inner demons, an ambush, or running out of spirit stones.")
                : T("Bế quan có thể bị gián đoạn bởi tâm ma, phục kích, hoặc khi hết bạc.", "Seclusion can be interrupted by inner demons, an ambush, or running out of silver."),
            14, Ink.InkFaint);

        Body.AddChild(UiKit.Spacer(8));
        var affordable = (cost == 0 || p.Silver >= cost) && (StonesPerMonth == 0 || p.SpiritStones >= StonesPerMonth);
        Buttons(
            UiKit.Button(T($"Bắt đầu bế quan {_months} tháng", $"Seclude for {_months} month{(_months > 1 ? "s" : "")}"), Begin, primary: true, enabled: affordable),
            UiKit.Button(T("Để sau", "Not now"), Close));
    }

    private void Begin()
    {
        var report = E.Seclude(_months, ExtraDensity, SilverPerMonth, StonesPerMonth);
        Game.Instance.SaveGame();
        Game.Instance.Remember(report.Events);
        Open(new MonthReportPanel(report, seclusion: true));
    }
}
