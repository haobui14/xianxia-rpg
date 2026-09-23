using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Rules;

namespace TuTienLuc.Ui.Panels;

/// <summary>Bí cảnh (design §7.11): floors of fights, chests after each, rewards at the bottom.</summary>
public partial class RealmPanel : InkPanel
{
    private readonly PoiDef _poi;

    public RealmPanel(PoiDef poi) => _poi = poi;

    protected override string Glyph => _poi.Glyph;
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
            Buttons(
                UiKit.Button(T("Tiến vào", "Enter"), () => Say(E.EnterRealm(d.Id)), primary: true, enabled: p.Silver >= cost && p.Footwork >= 2),
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
        Para(T($"Tầng {floor.FloorNumber}/{d.Floors.Count}: {floor.Name}", $"Floor {floor.FloorNumber}/{d.Floors.Count}: {floor.NameEn}"), 22, Ink.InkColor);
        Para(T(floor.Description, floor.DescriptionEn), 16, Ink.InkMute);
        Para(T($"Khí huyết {p.Hp}/{p.HpMax} · linh lực {p.Qi}/{p.QiMax}", $"Health {p.Hp}/{p.HpMax} · Qi {p.Qi}/{p.QiMax}"), 15, Ink.InkSoft);

        if (!run.FloorCleared)
        {
            var foes = floor.EnemyWaves.SelectMany(w => w.Enemies)
                .Concat(new[] { floor.MiniBoss, floor.FloorBoss }.Where(x => x != null).Select(x => x!))
                .Distinct()
                .Select(id => E.Content.Enemy(id) is { } def ? T(def.Name, def.NameEn) : id);
            Para(T("Canh giữ: ", "Guarded by: ") + string.Join(", ", foes), 15, Ink.CinnabarDeep);
            Buttons(
                UiKit.Danger(T($"Khiêu chiến tầng {floor.FloorNumber}", $"Fight floor {floor.FloorNumber}"), () =>
                {
                    var enc = E.StartFloorFight();
                    if (enc != null) Main.Instance.ShowArena(enc, () => new RealmPanel(_poi));
                }),
                UiKit.Button(T("Rời bí cảnh", "Leave the realm"), () =>
                {
                    E.LeaveRealm();
                    Game.Instance.Changed();
                    Close();
                }));
            return;
        }

        Para(T("Tầng này đã được dọn sạch.", "This floor is cleared."), 16, Ink.JadeDeep);
        var left = floor.ChestCount - run.ChestsOpened;
        var last = floor.FloorNumber >= d.Floors.Count;
        Buttons(
            UiKit.Button(T($"Mở rương ({left})", $"Open a chest ({left})"), OpenChest, enabled: left > 0),
            UiKit.Button(last ? T("Nhận thưởng & rời đi", "Claim rewards & leave") : T("Xuống tầng kế", "Descend"), () =>
            {
                Say(E.AdvanceRealm());
                Game.Instance.SaveGame();
                if (E.State.World.Run == null) Close();
            }, primary: true));
    }

    private void OpenChest()
    {
        var roll = E.OpenFloorChest();
        if (roll == null) return;
        Game.Instance.Toast(Loot(roll, Locale.Vi), Loot(roll, Locale.En), EventLevel.Major);
        Game.Instance.Changed();
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
