using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

/// <summary>A town (design §7.10): the inn, the market, the bounty board and the forge.</summary>
public partial class TownPanel : InkPanel
{
    public const int InnTab = 0, MarketTab = 1, BoardTab = 2, ForgeTab = 3;

    private readonly PoiDef _poi;

    public TownPanel(PoiDef poi, int tab = 0)
    {
        _poi = poi;
        Tab = tab;
    }

    protected override IconKind Emblem => Icons.Named(_poi.Icon);
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
        Para(T($"Ngươi có {p.Silver} bạc · {p.SpiritStones} linh thạch · cước lực {p.Footwork}/{p.FootworkMax}.",
            $"You have {p.Silver} silver · {p.SpiritStones} spirit stones · footwork {p.Footwork}/{p.FootworkMax}."), 15, Ink.InkColor);
        Tabs(T("Khách điếm", "Inn"), T("Chợ", "Market"), T("Bảng cáo thị", "Bounty board"), T("Lò rèn", "Forge"));
        switch (Tab)
        {
            case InnTab:
                Inn(town);
                break;
            case MarketTab:
                Market(town);
                break;
            case BoardTab:
                Board(town);
                break;
            default:
                Forge();
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
            ? "“" + T(rumor.Text, rumor.TextEn) + "”"
            : T("“Dạo này yên ắng lắm, khách quan.”", "“Quiet times, traveler.”"), 16, Ink.Violet);
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
            Row(info, UiKit.Label(T($"{entry.Price} bạc", $"{entry.Price} silver"), 16, Ink.GoldDeep),
                UiKit.Button(T("Mua", "Buy"), () => Say(E.Buy(town, itemId)), enabled: p.Silver >= entry.Price));
        }

        Section(T("Đổi linh thạch", "Money changer"));
        Row(UiKit.Label(T($"Một linh thạch đổi {GameEngine.SpiritStoneRate} bạc. Ngươi có {p.SpiritStones} linh thạch.",
                $"One spirit stone buys {GameEngine.SpiritStoneRate} silver. You have {p.SpiritStones} spirit stones."), 16, Ink.InkSoft, wrap: true),
            Named(UiKit.Button(T("Đổi 1", "Exchange 1"), () => Say(E.ExchangeStones(1)), enabled: p.SpiritStones >= 1), "exchange_1"),
            Named(UiKit.Button(T("Đổi 10", "Exchange 10"), () => Say(E.ExchangeStones(10)), enabled: p.SpiritStones >= 10), "exchange_10"));

        Section(T("Bán", "Sell"));
        var sellable = p.Items.Where(s => !(Equipment.IsWorn(p, s.Id) && s.Qty <= 1)).ToList();
        if (sellable.Count == 0) Para(T("Hành trang không có gì để bán.", "Nothing to sell."));
        foreach (var stack in sellable)
        {
            var id = stack.Id;
            var price = GameEngine.SellPrice(stack.Rarity);
            Row(UiKit.Label($"{Text.Name(stack)} ×{stack.Qty}", 16, Ink.Rarity(stack.Rarity).Darkened(0.15f)),
                UiKit.Label(T($"+{price} bạc", $"+{price} silver"), 15, Ink.GoldDeep),
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

    /// <summary>The forge (the web game's cường hóa): enhance a gear slot, buy enhancement stones.</summary>
    private void Forge()
    {
        var p = E.Player;
        var content = E.Content;
        Para(T("Thợ rèn khắc trận lên ô trang bị. Mỗi cấp, món mặc ở ô đó mạnh thêm 10%, và ô tự thêm công, thủ hoặc kháng. Cấp gắn với ô, nên đổi món tốt hơn vẫn giữ. Thất bại thì mất bạc và đá, nhưng ô không tụt cấp.",
            "The smith engraves formations into your gear slots. Each level makes what you wear there 10% stronger, and the slot adds attack, defense or resistance of its own. The level stays with the slot, so a better find keeps it. A failure costs the silver and stones, never a level."), 14, Ink.InkMute);
        foreach (var slot in Equipment.Slots)
        {
            var g = p.Gear.TryGetValue(slot, out var worn) ? worn : new GearSlot();
            var step = Equipment.Next(g.Level);
            var info = UiKit.Column(0);
            info.AddChild(UiKit.Label($"{Text.Slot(slot, g.Level)} · {Text.Worn(content, slot, g)}", 17, g.ItemId != null ? Ink.InkColor : Ink.InkFaint, wrap: true));
            var have = step != null ? Inventory.Count(p, step.StoneId) : 0;
            if (step == null)
                info.AddChild(UiKit.Label(T("Đã cường hóa tối đa.", "Fully enhanced."), 13, Ink.GoldDeep));
            else
            {
                var stone = content.Item(step.StoneId);
                var stoneName = stone != null ? Text.Name(stone) : step.StoneId;
                info.AddChild(UiKit.Label(T($"Lên +{g.Level + 1}: {step.Silver} bạc, {step.Stones} × {stoneName} (có {have}) · thành công {step.Chance * 100:0}%",
                    $"To +{g.Level + 1}: {step.Silver} silver, {step.Stones} × {stoneName} (you have {have}) · {step.Chance * 100:0}% success"), 13, Ink.InkMute, wrap: true));
                if (g.ItemId != null)
                    info.AddChild(UiKit.Label(T("Sau khi lên: ", "Then: ") + Text.Bonuses(Equipment.SlotBonuses(content, slot, g, g.Level + 1)), 13, Ink.JadeDeep, wrap: true));
            }
            var s = slot;
            Row(info, Named(UiKit.Button(T("Cường hóa", "Enhance"), () => Say(E.Enhance(s)),
                enabled: step != null && g.ItemId != null && p.Silver >= step.Silver && have >= step.Stones), $"enhance_{slot}"));
        }

        Section(T("Đá cường hóa", "Enhancement stones"));
        foreach (var (stoneId, silver, stones) in Equipment.ForgeStock)
        {
            var def = content.Item(stoneId);
            if (def == null) continue;
            var price = stones > 0 ? T($"{stones} linh thạch", $"{stones} spirit stones") : T($"{silver} bạc", $"{silver} silver");
            var id = stoneId;
            Row(UiKit.Label($"{Text.Name(def)}  ·  {T("có", "have")} {Inventory.Count(p, stoneId)}", 16, Ink.Rarity(def.Rarity).Darkened(0.15f)),
                UiKit.Label(price, 16, Ink.GoldDeep),
                Named(UiKit.Button(T("Mua", "Buy"), () => Say(E.BuyStone(id)), enabled: p.Silver >= silver && p.SpiritStones >= stones), $"buy_{stoneId}"));
        }
    }

    private static Button Named(Button button, string name)
    {
        button.Name = name;
        return button;
    }
}
