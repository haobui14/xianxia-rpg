using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTienLuc.Art;
using TuTienLuc.Audio;

namespace TuTienLuc.Ui.Panels;

/// <summary>
/// The Earth God shrine by the road (Miếu Thổ Địa): burn incense and draw a fortune stick once a month. The verse speaks
/// for the month (more or less cultivation, rare fish, rich veins, a chance meeting pointed out). The shrine keeper lifts
/// an ill omen for a little silver, and an offering for the shrine's upkeep earns karma.
/// </summary>
public partial class ShrinePanel : InkPanel
{
    private readonly PoiDef _poi;

    public ShrinePanel(PoiDef poi) => _poi = poi;

    protected override IconKind Emblem => IconKind.Shrine;
    protected override string TitleText => T(_poi.Name, _poi.NameEn);
    protected override Vector2 PanelSize => new(760, 600);

    protected override void Build()
    {
        var e = E;
        var p = e.Player;
        Para(T("Miếu nhỏ bên đường cái, hương khói chưa bao giờ tắt. Ông Địa ngồi cười hiền trong khám. Người qua đường thường ghé thắp nén hương, xin một quẻ cho tháng này.",
            "A small shrine by the high road whose incense never goes out; the Earth God smiles kindly from his niche. Travelers stop to burn a stick of incense and draw a fortune for the month."), 16, Ink.InkMute);
        Para(T($"Ngươi có {p.Silver} bạc.", $"You have {p.Silver} silver."), 15, Ink.InkColor);

        Section(T("Quẻ tháng này", "This month's fortune"));
        if (e.Fortune is { } f)
        {
            var color = f.Grade switch { "great" => Ink.GoldDeep, "good" => Ink.JadeDeep, "ill" => Ink.CinnabarDeep, _ => Ink.InkColor };
            Para(T($"Quẻ số {f.Number} — {Shrine.GradeName(f.Grade, Locale.Vi)}", $"Stick {f.Number}: {Shrine.GradeName(f.Grade, Locale.En)}"), 20, color);
            Para("“" + T(f.Verse, f.VerseEn) + "”", 19, Ink.InkColor);
            var (vi, en) = Shrine.Meaning(f);
            var lifted = f.Grade == "ill" && p.Fortune!.Dispelled;
            Para(lifted ? T("Điềm dữ đã được giải.", "The ill omen has been lifted.") : T(vi, en), 15, lifted ? Ink.JadeDeep : Ink.InkSoft);
            if (f.Grade == "ill" && !lifted)
                Buttons(Named(UiKit.Button(T($"Nhờ thủ từ giải hạn ({Shrine.DispelSilver} bạc)", $"Ask the keeper to lift the omen ({Shrine.DispelSilver} silver)"),
                    () => Say(e.DispelFortune()), enabled: p.Silver >= Shrine.DispelSilver), "dispel"));
            Para(T("Tháng sau hãy quay lại xin quẻ mới.", "Come back next month for a new stick."), 14, Ink.InkFaint);
        }
        else
        {
            Para(T("Chưa xin quẻ tháng này.", "No fortune drawn yet this month."), 15, Ink.InkSoft);
            Buttons(Named(UiKit.Button(T($"Thắp hương, xin xăm ({Shrine.IncenseSilver} bạc)", $"Burn incense and draw a stick ({Shrine.IncenseSilver} silver)"), () =>
            {
                SoundBoard.Play("gong", -6);
                Say(e.DrawFortune());
            }, primary: true, enabled: p.Silver >= Shrine.IncenseSilver), "draw_stick"));
        }

        Section(T("Công đức", "Offerings"));
        if (Shrine.OfferedThisMonth(e.State))
            Para(T("Tháng này ngươi đã cúng dường. Ông Địa ghi nhận tấm lòng.", "You have made an offering this month. The Earth God has seen your kindness."), 15, Ink.JadeDeep);
        else
            Row(UiKit.Label(T($"Cúng {Shrine.OfferingSilver} bạc tu sửa miếu: nhân quả +{Shrine.OfferingKarma}, mỗi tháng một lần.",
                    $"Give {Shrine.OfferingSilver} silver for the shrine's upkeep: karma +{Shrine.OfferingKarma}, once a month."), 15, Ink.InkSoft, wrap: true),
                Named(UiKit.Button(T("Cúng dường", "Make an offering"), () => Say(e.MakeOffering()), enabled: p.Silver >= Shrine.OfferingSilver), "offering"));

        Body.AddChild(UiKit.Spacer(6));
        Buttons(UiKit.Button(T("Rời đi", "Leave"), Close));
    }

    private static Button Named(Button button, string name)
    {
        button.Name = name;
        return button;
    }
}
