using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

/// <summary>
/// A sect's mountain gate (design §7.9): the entrance trial, or — for a disciple — their standing and the
/// road up the ranks, the mission hall (Nhiệm Vụ Đường) and the treasury (Tàng Bảo Các).
/// </summary>
public partial class SectPanel : InkPanel
{
    private readonly PoiDef _poi;

    public SectPanel(PoiDef poi, int tab = 0)
    {
        _poi = poi;
        Tab = tab;
    }

    protected override IconKind Emblem => Icons.Named(_poi.Icon);
    protected override string TitleText => T(_poi.Name, _poi.NameEn);
    protected override Vector2 PanelSize => new(820, 680);

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

        if (p.SectId == sect.Id)
        {
            var ready = p.Missions.Count(m => m.Done);
            Tabs(T("Thân phận", "Standing"), ready > 0 ? T($"Nhiệm Vụ Đường ({ready})", $"Mission hall ({ready})") : T("Nhiệm Vụ Đường", "Mission hall"),
                T("Tàng Bảo Các", "Treasury"));
            switch (Tab)
            {
                case 0:
                    Standing(sect);
                    break;
                case 1:
                    MissionHall();
                    break;
                default:
                    Treasury();
                    break;
            }
            return;
        }
        Body.AddChild(UiKit.Spacer(6));
        if (p.SectId != null)
        {
            Para(T("Ngươi đã thuộc về một tông môn khác.", "You already belong to another sect."));
            return;
        }

        Section(T("Khảo hạch nhập môn", "Entrance trial"));
        Para(T("Muốn bái nhập, phải thắng một đệ tử ngoại môn. Đây là tỉ thí: khi một bên đuối sức (còn 15% khí huyết) thì dừng.",
            "To join, beat an outer disciple. It's a spar: it ends when either side is down to 15% health."), 16, Ink.InkSoft);
        Para(T($"Phần thưởng: gia nhập tông môn (tu luyện +5%, nguyệt lệ, nhiệm vụ và Tàng Bảo Các) và học {E.Content.Skill("thanh_van_kiem_quyet")?.Name ?? "kiếm quyết"}.",
            $"Reward: membership (+5% cultivation, a monthly stipend, missions and the treasury) and the art {E.Content.Skill("thanh_van_kiem_quyet")?.NameEn ?? "of the sect"}."), 15, Ink.JadeDeep);
        var allowed = sect.Type == "Ma" || Karma.AcceptableToRighteous(p.Karma);
        if (!allowed) Para(T("Nhân quả của ngươi quá nặng — chính phái không thu nhận.", "Your karma is too dark — righteous sects refuse you."), 15, Ink.Cinnabar);
        Buttons(
            UiKit.Button(T("Tham gia khảo hạch", "Take the trial"), () =>
            {
                var enc = E.StartSectTrial(sect.Id);
                var poi = _poi;
                if (enc != null) FightHere(enc, (_, _) => Main.Instance.Field?.OpenPanel(new SectPanel(poi)));
            }, primary: true, enabled: allowed),
            UiKit.Button(T("Để sau", "Later"), Close));
    }

    // ================================================================ standing and the ranks

    private void Standing(SectDef sect)
    {
        var p = E.Player;
        var rank = SectRanks.Of(p.SectRank);
        Section(T("Thân phận", "Standing"));
        Para($"{Text.Rank(p.SectRank)} · {T($"tu luyện +{Cultivation.SectBonusPercent(p.SectRank)}%", $"cultivation +{Cultivation.SectBonusPercent(p.SectRank)}%")}", 18, Ink.InkColor);
        Para(T($"Cống hiến {p.Contribution} (tiêu ở Tàng Bảo Các) · công trạng {p.Merit} (xét thăng cấp, không bao giờ mất) · {p.Counters.MissionsCompleted} nhiệm vụ đã xong",
            $"Contribution {p.Contribution} (spent at the treasury) · merit {p.Merit} (for promotion, never lost) · {p.Counters.MissionsCompleted} mission{(p.Counters.MissionsCompleted == 1 ? "" : "s")} done"), 15, Ink.InkSoft);
        if (rank != null)
            Para(T($"Nguyệt lệ mỗi tháng: {SectMissions.Stipend(rank.StipendSilver, rank.StipendStones, Locale.Vi)}.",
                $"Monthly stipend: {SectMissions.Stipend(rank.StipendSilver, rank.StipendStones, Locale.En)}."), 15, Ink.GoldDeep);

        Section(T("Thăng cấp", "Promotion"));
        var next = SectRanks.Next(p.SectRank);
        if (next == null)
        {
            Para(T("Công trạng không đưa ngươi lên cao hơn được nữa.", "Merit can raise you no higher."), 15, Ink.InkMute);
        }
        else
        {
            var merit = p.Merit >= next.Merit;
            var realm = SectRanks.RealmReached(p, next);
            Para(T($"Kế tiếp: {Text.Rank(next.Id)} — tu luyện +{Cultivation.SectBonusPercent(next.Id)}%, nguyệt lệ {SectMissions.Stipend(next.StipendSilver, next.StipendStones, Locale.Vi)}",
                $"Next: {Text.Rank(next.Id)} — cultivation +{Cultivation.SectBonusPercent(next.Id)}%, a stipend of {SectMissions.Stipend(next.StipendSilver, next.StipendStones, Locale.En)}"), 16, Ink.InkColor);
            var meter = new Meter(T("Công trạng", "Merit"), merit ? Ink.Jade : Ink.GoldDeep, 320);
            meter.Set(p.Merit, next.Merit);
            Body.AddChild(meter);
            Para((realm ? "✓ " : "· ") + T($"Cần cảnh giới {Text.Realm(next.Realm, next.Stage)} (ngươi: {Text.Realm(p.Realm, p.Stage)})",
                $"Needs {Text.Realm(next.Realm, next.Stage)} (you: {Text.Realm(p.Realm, p.Stage)})"), 15, realm ? Ink.JadeDeep : Ink.InkMute);
            var chance = SectRanks.CanPromote(p);
            var promote = UiKit.Button(T($"Xin thăng làm {Text.Rank(next.Id)}", $"Rise to {Text.Rank(next.Id)}"), () => Say(E.Promote()), primary: chance, enabled: chance);
            promote.Name = "promote";
            Buttons(promote);
        }

        Section(T("Tụ Linh Thất", "Spirit-gathering chamber"));
        var hallChamber = E.Hall?.Chamber;
        var chamber = E.Chamber;
        if (hallChamber == null)
        {
            Para(T("Tông môn này không có tĩnh thất tụ linh.", "This sect keeps no gathering chamber."), 15, Ink.InkMute);
        }
        else if (chamber == null)
        {
            Para(T($"{hallChamber.Name}: linh khí +{hallChamber.QiDensity}% khi bế quan, {hallChamber.StonesPerMonth} linh thạch mỗi tháng. Chỉ mở cho {SectMissions.RanksName(hallChamber.MinRank).Vi} trở lên.",
                $"The {hallChamber.NameEn}: +{hallChamber.QiDensity}% qi in seclusion, {SectMissions.Stones(hallChamber.StonesPerMonth, Locale.En)} a month. Open to {SectMissions.RanksName(hallChamber.MinRank).En} and above."), 15, Ink.InkMute);
        }
        else
        {
            Para(T($"{chamber.Name}: linh khí +{chamber.QiDensity}% khi bế quan, {chamber.StonesPerMonth} linh thạch mỗi tháng. Ngươi có {p.SpiritStones} linh thạch.",
                $"The {chamber.NameEn}: +{chamber.QiDensity}% qi in seclusion, {SectMissions.Stones(chamber.StonesPerMonth, Locale.En)} a month. You have {SectMissions.Stones(p.SpiritStones, Locale.En)}."), 15, Ink.JadeDeep);
            var seclude = UiKit.Button(T("Bế quan trong Tụ Linh Thất", "Seclude in the chamber"), () => Open(new SeclusionPanel(chamber)), enabled: p.SpiritStones >= chamber.StonesPerMonth);
            seclude.Name = "chamber";
            Buttons(seclude);
        }

        var deacon = E.Npc("npc_deacon");
        if (deacon is { Alive: true })
        {
            Body.AddChild(UiKit.Spacer(4));
            Buttons(UiKit.Button(T($"Thỉnh giáo {deacon.Name}", $"Speak with {deacon.Name}"), () => Open(new NpcPanel(deacon.Id))));
        }
    }

    // ================================================================ the mission hall

    private void MissionHall()
    {
        var p = E.Player;
        var now = E.State.Calendar.MonthIndex;
        Section(T($"Nhiệm vụ đang nhận ({p.Missions.Count}/{SectMissions.MaxActive})", $"Missions in hand ({p.Missions.Count}/{SectMissions.MaxActive})"));
        if (p.Missions.Count == 0)
            Para(T("Chưa nhận nhiệm vụ nào. Chọn trên bảng bên dưới: hoàn thành rồi quay về đây báo cáo.",
                "No missions yet. Take one from the board below; do it, then come back here to report."), 15, Ink.InkMute);
        foreach (var m in p.Missions)
        {
            var t = SectMissions.Template(E.Content, m.TemplateId);
            Para(t != null ? T(t.Name, t.NameEn) : m.TemplateId, 17, m.Done ? Ink.JadeDeep : Ink.InkColor);
            if (t != null) Para(T(t.Description, t.DescriptionEn), 14, Ink.InkMute);
            var meter = new Meter(Goal(m), m.Done ? Ink.Jade : Ink.GoldDeep, 320);
            meter.Set(m.Progress, m.Goal);
            Body.AddChild(meter);
            var left = m.DeadlineMonth - now;
            var id = m.Id;
            Row(UiKit.Label(m.Done
                        ? T("Xong — báo cáo để nhận thưởng.", "Done — report it for the reward.")
                        : T($"Còn {left} tháng · thưởng: cống hiến +{m.RewardContribution}, {SectMissions.Pay(m.RewardSilver, m.RewardStones, Locale.Vi)}",
                            $"{left} month{(left == 1 ? "" : "s")} left · reward: contribution +{m.RewardContribution}, {SectMissions.Pay(m.RewardSilver, m.RewardStones, Locale.En)}"),
                    14, m.Done ? Ink.JadeDeep : left <= 1 ? Ink.CinnabarDeep : Ink.InkSoft, wrap: true),
                m.Done
                    ? UiKit.Label("✓", 18, Ink.JadeDeep)
                    : UiKit.Danger(T($"Bỏ (−{SectMissions.Penalty(m.RewardContribution)})", $"Give up (−{SectMissions.Penalty(m.RewardContribution)})"), () => Say(E.AbandonMission(id))));
        }
        var ready = p.Missions.Count(m => m.Done);
        if (ready > 0)
        {
            var report = UiKit.Button(T($"Báo cáo {ready} nhiệm vụ", $"Report {ready} mission{(ready > 1 ? "s" : "")}"), () => Say(E.ClaimMissions()), primary: true);
            report.Name = "report_missions";
            Buttons(report);
        }

        Section(T("Bảng nhiệm vụ", "The board"));
        var board = E.MissionBoard();
        if (board.Count == 0) Para(T("Bảng trống — mọi nhiệm vụ đã có người nhận.", "The board is bare — every mission has been taken."), 15, Ink.InkMute);
        var full = p.Missions.Count >= SectMissions.MaxActive;
        foreach (var t in board)
        {
            var (diffVi, diffEn, color) = t.Difficulty switch
            {
                "hard" => ("khó", "hard", Ink.CinnabarDeep),
                "medium" => ("vừa", "medium", Ink.GoldDeep),
                _ => ("dễ", "easy", Ink.JadeDeep),
            };
            var info = UiKit.Column(0);
            info.AddChild(UiKit.Label($"{T(t.Name, t.NameEn)}  ·  {T(diffVi, diffEn)}", 17, color));
            info.AddChild(UiKit.Label(T(t.Description, t.DescriptionEn), 14, Ink.InkMute, wrap: true));
            var months = SectMissions.DeadlineMonths(t);
            info.AddChild(UiKit.Label(T($"Thưởng: cống hiến +{t.Reward.Contribution}, {SectMissions.Pay(t.Reward.Silver ?? 0, t.Reward.SpiritStones ?? 0, Locale.Vi)} · hạn {months} tháng",
                $"Reward: contribution +{t.Reward.Contribution}, {SectMissions.Pay(t.Reward.Silver ?? 0, t.Reward.SpiritStones ?? 0, Locale.En)} · {months} months to do it"), 14, Ink.InkSoft, wrap: true));
            var templateId = t.Id;
            var take = UiKit.Button(T("Nhận", "Take it"), () => Say(E.AcceptMission(templateId)), enabled: !full);
            take.Name = "take_" + t.Id;
            Row(info, take);
        }
        var refresh = (now / SectMissions.BoardRefreshMonths + 1) * SectMissions.BoardRefreshMonths - now;
        Para(T($"Bảng thay mới sau {refresh} tháng. Đủ {SectMissions.MaxActive} nhiệm vụ thì phải xong bớt mới nhận thêm; quá hạn hay bỏ dở đều mất một phần tư cống hiến của nhiệm vụ.",
            $"The board changes in {refresh} month{(refresh == 1 ? "" : "s")}. With {SectMissions.MaxActive} in hand, finish one before taking another; missing a deadline or giving up costs a quarter of the mission's contribution."),
            13, Ink.InkFaint);
    }

    /// <summary>What a mission's bar counts.</summary>
    private static string Goal(ActiveMission m) => m.Kind switch
    {
        "win_combats" => T("Trận thắng", "Fights won"),
        "defeat_rival_member" => T("Đệ tử địch phái bị hạ", "Rival disciples beaten"),
        "cultivate_exp" => T("Tu vi tích lũy", "Cultivation gained"),
        "gather_items" => m.ItemType switch
        {
            "Medicine" => T("Dược liệu thu được", "Medicine gathered"),
            "Material" => T("Vật liệu thu được", "Materials gathered"),
            _ => T("Vật phẩm thu được", "Things gathered"),
        },
        "visit_region" => T("Đã tới nơi", "Arrived"),
        _ => T("Tiến độ", "Progress"),
    };

    // ================================================================ the treasury

    private void Treasury()
    {
        var p = E.Player;
        var hall = E.Hall;
        Para(T($"Ngươi có {p.Contribution} cống hiến. Đổi đồ không làm mất công trạng.",
            $"You have {p.Contribution} contribution. Taking things never costs merit."), 16, Ink.InkColor);
        if (hall == null || hall.Treasury.Count == 0)
        {
            Para(T("Tàng Bảo Các đang đóng cửa.", "The treasury is closed."), 15, Ink.InkMute);
            return;
        }
        foreach (var entry in hall.Treasury)
        {
            var def = E.Content.Item(entry.ItemId);
            if (def == null) continue;
            var rankOk = SectRanks.AtLeast(p.SectRank, entry.MinRank);
            var info = UiKit.Column(0);
            info.AddChild(UiKit.Label(Text.Name(def) + "  ·  " + Text.Rarity(def.Rarity), 16, Ink.Rarity(def.Rarity).Darkened(0.15f)));
            var fx = Text.Effects(def);
            info.AddChild(UiKit.Label(fx.Length > 0 ? fx : Text.Desc(def), 13, Ink.InkMute, wrap: true));
            if (entry.MinRank != null)
                info.AddChild(UiKit.Label(T($"Dành cho {SectMissions.RanksName(entry.MinRank).Vi} trở lên", $"For {SectMissions.RanksName(entry.MinRank).En} and above"), 13,
                    rankOk ? Ink.JadeDeep : Ink.CinnabarDeep));
            var itemId = entry.ItemId;
            var take = UiKit.Button(T("Đổi", "Take"), () => Say(E.Exchange(itemId)), enabled: rankOk && p.Contribution >= entry.Price);
            take.Name = "exchange_" + entry.ItemId;
            Row(info, UiKit.Label(T($"{entry.Price} cống hiến", $"{entry.Price} contribution"), 15, Ink.GoldDeep), take);
        }
    }
}
