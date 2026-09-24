using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;

namespace TuTienLuc.Ui.Panels;

/// <summary>A town (design §7.10): the inn, the market, and the bounty board.</summary>
public partial class TownPanel : InkPanel
{
    private readonly PoiDef _poi;

    public TownPanel(PoiDef poi, int tab = 0)
    {
        _poi = poi;
        Tab = tab;
    }

    protected override string Glyph => _poi.Glyph;
    protected override string TitleText => T(_poi.Name, _poi.NameEn);
    protected override Vector2 PanelSize => new(840, 660);

    protected override void Build()
    {
        var town = E.TownFor(_poi);
        var area = E.Content.Area(town?.AreaId);
        if (area != null) Para(T(area.Description, area.DescriptionEn), 16, Ink.InkMute);
        if (town == null)
        {
            Para(T("Nơi này chưa có gì để làm.", "There is nothing to do here yet."));
            return;
        }
        var p = E.Player;
        Para(T($"Ngươi có {p.Silver} bạc · cước lực {p.Footwork}/{p.FootworkMax}.", $"You have {p.Silver} silver · footwork {p.Footwork}/{p.FootworkMax}."), 15, Ink.InkColor);
        Tabs(T("Khách điếm", "Inn"), T("Chợ", "Market"), T("Bảng cáo thị", "Bounty board"));
        switch (Tab)
        {
            case 0:
                Inn(town);
                break;
            case 1:
                Market(town);
                break;
            default:
                Board(town);
                break;
        }
    }

    private void Inn(TownDef town)
    {
        var p = E.Player;
        Section(T("Nghỉ trọ", "Rest"));
        Row(UiKit.Label(T($"Một đêm yên giấc: hồi đầy khí huyết và linh lực. {town.RestCost} bạc, 1 cước lực.",
                $"A night's sleep: fully restores health and Qi. {town.RestCost} silver, 1 footwork."), 16, Ink.InkSoft, wrap: true),
            UiKit.Button(T("Nghỉ trọ", "Rest"), () => Say(E.Rest(town)), enabled: p.Silver >= town.RestCost && p.Footwork >= 1));

        Section(T("Tĩnh thất", "Quiet room"));
        Row(UiKit.Label(T($"Thuê tĩnh thất để bế quan: linh khí +10%, không bị quấy nhiễu. {town.SeclusionCostPerMonth} bạc mỗi tháng.",
                $"Rent a quiet room for seclusion: +10% qi density, undisturbed. {town.SeclusionCostPerMonth} silver per month."), 16, Ink.InkSoft, wrap: true),
            UiKit.Button(T("Bế quan tại đây", "Seclude here"), () => Open(new SeclusionPanel(town)), enabled: p.Silver >= town.SeclusionCostPerMonth));

        Section(T("Chưởng quầy kể", "The innkeeper says"));
        var rumor = E.State.World.Rumors.LastOrDefault();
        Para(rumor != null
            ? "「" + T(rumor.Text, rumor.TextEn) + "」"
            : T("「Dạo này yên ắng lắm, khách quan.」", "「Quiet times, traveler.」"), 16, Ink.Violet);
    }

    private void Market(TownDef town)
    {
        var p = E.Player;
        Section(T("Mua", "Buy"));
        foreach (var entry in town.Shop)
        {
            var def = E.Content.Item(entry.ItemId);
            if (def == null) continue;
            var info = UiKit.Column(0);
            info.AddChild(UiKit.Label(Text.Name(def) + "  ·  " + Text.Rarity(def.Rarity), 16, Ink.Rarity(def.Rarity).Darkened(0.15f)));
            var fx = Text.Effects(def);
            info.AddChild(UiKit.Label(fx.Length > 0 ? fx : Text.Desc(def), 13, Ink.InkMute, wrap: true));
            var itemId = entry.ItemId;
            Row(info, UiKit.Label($"{entry.Price} 銀", 16, Ink.GoldDeep),
                UiKit.Button(T("Mua", "Buy"), () => Say(E.Buy(town, itemId)), enabled: p.Silver >= entry.Price));
        }

        Section(T("Bán", "Sell"));
        var sellable = p.Items.Where(s => !(s.Id == p.WeaponId && s.Qty <= 1)).ToList();
        if (sellable.Count == 0) Para(T("Hành trang không có gì để bán.", "Nothing to sell."));
        foreach (var stack in sellable)
        {
            var id = stack.Id;
            var price = GameEngine.SellPrice(stack.Rarity);
            Row(UiKit.Label($"{Text.Name(stack)} ×{stack.Qty}", 16, Ink.Rarity(stack.Rarity).Darkened(0.15f)),
                UiKit.Label($"+{price} 銀", 15, Ink.GoldDeep),
                UiKit.Button(T("Bán", "Sell"), () => Say(E.Sell(id))));
        }
    }

    private void Board(TownDef town)
    {
        var p = E.Player;
        Para(T("Thôn dân treo thưởng cho ai dẹp yêu thú quanh vùng. Tiêu diệt đủ số rồi quay về nhận thưởng.",
            "Villagers pay whoever clears the beasts nearby. Kill enough, then come back to claim."), 15, Ink.InkMute);
        foreach (var bounty in town.Bounties)
        {
            var active = p.Bounties.FirstOrDefault(b => b.Id == bounty.Id);
            var target = E.Content.Enemy(bounty.EnemyId);
            var info = UiKit.Column(0);
            info.AddChild(UiKit.Label(T(bounty.Name, bounty.NameEn), 17, Ink.InkColor));
            info.AddChild(UiKit.Label(T($"Mục tiêu: {target?.Name ?? bounty.EnemyId} ×{bounty.Count} · thưởng {bounty.RewardSilver} bạc, nhân quả +{bounty.RewardKarma}",
                $"Target: {target?.NameEn ?? bounty.EnemyId} ×{bounty.Count} · reward {bounty.RewardSilver} silver, karma +{bounty.RewardKarma}"), 13, Ink.InkMute, wrap: true));
            var id = bounty.Id;
            Control right = active == null
                ? UiKit.Button(T("Nhận", "Accept"), () => Say(E.AcceptBounty(town, id)))
                : UiKit.Label(active.Progress >= active.Count ? T("Xong ✓", "Done ✓") : $"{active.Progress}/{active.Count}", 16,
                    active.Progress >= active.Count ? Ink.JadeDeep : Ink.InkSoft);
            Row(info, right);
        }
        var done = p.Bounties.Count(b => b.Progress >= b.Count);
        Body.AddChild(UiKit.Spacer(6));
        Buttons(UiKit.Button(T($"Nhận thưởng ({done})", $"Claim rewards ({done})"), () => Say(E.ClaimBounties()), primary: done > 0, enabled: done > 0));
    }
}
