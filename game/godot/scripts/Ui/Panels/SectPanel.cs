using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Rules;

namespace TuTienLuc.Ui.Panels;

/// <summary>A sect's mountain gate (design §7.9): the entrance trial, or your standing if you belong.</summary>
public partial class SectPanel : InkPanel
{
    private readonly PoiDef _poi;

    public SectPanel(PoiDef poi) => _poi = poi;

    protected override string Glyph => _poi.Glyph;
    protected override string TitleText => T(_poi.Name, _poi.NameEn);

    protected override void Build()
    {
        var sect = E.SectFor(_poi);
        if (sect == null)
        {
            Para(T("Sơn môn đóng chặt.", "The mountain gate is shut."));
            return;
        }
        var locale = Game.Instance.Locale;
        var p = E.Player;
        Para(T(sect.Description, sect.DescriptionEn), 16, Ink.InkMute);
        var element = sect.Element != null ? Names.Display(sect.Element.Value, locale) : "—";
        Para(T($"Phái: {sect.Type} · hệ {element} · phẩm cấp {sect.Tier}", $"School: {sect.Type} · element {element} · tier {sect.Tier}"), 15, Ink.InkSoft);
        var rivals = sect.Rivals.Select(id => E.Content.Sects.TryGetValue(id, out var r) ? Names.Pick(locale, r.Name, r.NameEn) : id).ToList();
        if (rivals.Count > 0) Para(T("Kình địch: ", "Rivals: ") + string.Join(", ", rivals), 15, Ink.CinnabarDeep);

        Body.AddChild(UiKit.Spacer(6));
        if (p.SectId == sect.Id)
        {
            Section(T("Thân phận", "Standing"));
            Para(T($"{Text.Rank(p.SectRank)} · cống hiến {p.Contribution} · tu luyện +{Cultivation.SectBonusPercent(p.SectRank)}%",
                $"{Text.Rank(p.SectRank)} · contribution {p.Contribution} · cultivation +{Cultivation.SectBonusPercent(p.SectRank)}%"), 17, Ink.InkColor);
            Para(T("Nhiệm vụ tông môn và thăng cấp đệ tử mở ở cột mốc M2; tông môn chiến giành lãnh thổ ở M4 (xem design/GAME_DESIGN.md §11).",
                "Sect missions and promotions open in milestone M2; sect wars over territory in M4 (see design/GAME_DESIGN.md §11)."), 14, Ink.InkFaint);
            var deacon = E.Npc("npc_deacon");
            if (deacon is { Alive: true })
                Buttons(UiKit.Button(T($"Thỉnh giáo {deacon.Name}", $"Speak with {deacon.Name}"), () => Open(new NpcPanel(deacon.Id))));
            return;
        }
        if (p.SectId != null)
        {
            Para(T("Ngươi đã thuộc về một tông môn khác.", "You already belong to another sect."));
            return;
        }

        Section(T("Khảo hạch nhập môn", "Entrance trial"));
        Para(T("Muốn bái nhập, phải thắng một đệ tử ngoại môn. Đây là tỉ thí: khi một bên đuối sức (còn 15% khí huyết) thì dừng.",
            "To join, beat an outer disciple. It's a spar: it ends when either side is down to 15% health."), 16, Ink.InkSoft);
        Para(T($"Phần thưởng: gia nhập tông môn (tu luyện +5%) và học {E.Content.Skill("thanh_van_kiem_quyet")?.Name ?? "kiếm quyết"}.",
            $"Reward: membership (+5% cultivation) and the art {E.Content.Skill("thanh_van_kiem_quyet")?.NameEn ?? "of the sect"}."), 15, Ink.JadeDeep);
        var allowed = sect.Type == "Ma" || Karma.AcceptableToRighteous(p.Karma);
        if (!allowed) Para(T("Nhân quả của ngươi quá nặng — chính phái không thu nhận.", "Your karma is too dark — righteous sects refuse you."), 15, Ink.Cinnabar);
        Buttons(
            UiKit.Button(T("Tham gia khảo hạch", "Take the trial"), () =>
            {
                var enc = E.StartSectTrial(sect.Id);
                if (enc != null) Main.Instance.ShowArena(enc, () => new SectPanel(_poi));
            }, primary: true, enabled: allowed),
            UiKit.Button(T("Để sau", "Later"), Close));
    }
}
