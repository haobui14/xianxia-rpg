using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

/// <summary>Bí cảnh (design §7.11): floors of fights, chests after each, rewards at the bottom.</summary>
public partial class RealmPanel : InkPanel
{
    private readonly PoiDef _poi;

    public RealmPanel(PoiDef poi) => _poi = poi;

    protected override IconKind Emblem => Icons.Named(_poi.Icon);
    protected override string TitleText => T(_poi.Name, _poi.NameEn);
    protected override Vector2 PanelSize => new(780, 640);

    protected override void Build()
    {
        var d = E.DungeonFor(_poi);
        if (d == null)
        {
            Para(T("Lối vào bị phong ấn.", "The entrance is sealed."));
            return;
        }
        var p = E.Player;
        var run = E.State.World.Run;
        if (run == null || run.DungeonId != d.Id)
        {
            Para(T(d.Description, d.DescriptionEn), 16, Ink.InkMute);
            Para(T($"Phẩm cấp {d.Tier} · đề nghị {Names.Display(d.RecommendedRealm, Locale.Vi)} · {d.Floors.Count} tầng",
                $"Tier {d.Tier} · recommended {Names.Display(d.RecommendedRealm, Locale.En)} · {d.Floors.Count} floors"), 16, Ink.InkColor);
            foreach (var f in d.Floors)
            {
                var boss = f.FloorBoss ?? f.MiniBoss;
                var bossName = boss != null ? E.Content.Enemy(boss) is { } b ? T(b.Name, b.NameEn) : boss : null;
                Para(T($"Tầng {f.FloorNumber}: {f.Name}", $"Floor {f.FloorNumber}: {f.NameEn}") + (bossName != null ? $" — {bossName}" : ""), 15, Ink.InkSoft);
            }
            var cost = d.EntryCost?.Silver ?? 0;
            var cleared = E.State.World.DungeonClears.TryGetValue(d.Id, out var n) ? n : 0;
            if (cleared > 0) Para(T($"Đã chinh phục {cleared} lần.", $"Conquered {cleared} time(s)."), 14, Ink.JadeDeep);
            Para(T($"Lệ phí: {cost} bạc và 2 cước lực. Thua trận trong bí cảnh là trọng thương.",
                $"Entry: {cost} silver and 2 footwork. Losing a fight inside means grievous wounds."), 15, Ink.CinnabarDeep);
            Para(T("Mỗi tầng là một khu vườn có lính canh: tới gần hoặc ra tay trước là giao chiến. Dọn sạch tầng để mở rương và cổng xuống tầng kế.",
                "Each floor is a walled garden with guardians: come close or strike first to fight. Clear it to open the chests and the gate below."), 14, Ink.InkMute);
            Buttons(
                UiKit.Button(T("Tiến vào", "Enter"), () =>
                {
                    var events = E.EnterRealm(d.Id);
                    Game.Instance.Remember(events);
                    if (E.State.World.Run != null) Main.Instance.ShowRealm(_poi);
                    else Say(events);
                }, primary: true, enabled: p.Silver >= cost),
                UiKit.Button(T("Để sau", "Later"), Close));
            return;
        }

        var floor = E.CurrentFloor();
        if (floor == null)
        {
            E.LeaveRealm();
            RequestRefresh();
            return;
        }
        Para(T($"Ngươi đang thám hiểm tầng {floor.FloorNumber}/{d.Floors.Count}: {floor.Name}.", $"You are exploring floor {floor.FloorNumber}/{d.Floors.Count}: {floor.NameEn}."), 18, Ink.InkColor);
        Buttons(
            UiKit.Button(T("Tiếp tục thám hiểm", "Continue the run"), () => Main.Instance.ShowRealm(_poi), primary: true),
            UiKit.Button(T("Bỏ dở, rời bí cảnh", "Abandon the run"), () =>
            {
                E.LeaveRealm();
                Game.Instance.SaveGame();
                Game.Instance.Changed();
                Close();
            }));
    }

    public static string Loot(LootRoll roll, Locale locale)
    {
        var parts = roll.Items.Select(i => $"{Names.Pick(locale, i.Name, i.NameEn)} ×{i.Qty}").ToList();
        if (roll.Silver > 0) parts.Insert(0, locale == Locale.En ? $"{roll.Silver} silver" : $"{roll.Silver} bạc");
        if (roll.SpiritStones > 0) parts.Insert(0, locale == Locale.En ? $"{roll.SpiritStones} spirit stones" : $"{roll.SpiritStones} linh thạch");
        var list = parts.Count > 0 ? string.Join(", ", parts) : (locale == Locale.En ? "nothing" : "không có gì");
        return (locale == Locale.En ? "Found: " : "Thu được: ") + list;
    }
}
