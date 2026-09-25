using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

/// <summary>
/// Hành trang: what's worn (weapon, armor, accessory) and refining it with enhancement stones, then the bag,
/// where every item says what it's for — wear it, use it, open it, refine with it, or sell it.
/// </summary>
public partial class InventoryPanel : InkPanel
{
    protected override IconKind Emblem => IconKind.Bag;
    protected override string TitleText => T("Hành trang", "Inventory");
    protected override Vector2 PanelSize => new(820, 680);

    protected override void Build()
    {
        var p = E.Player;
        Para(T($"{p.Silver} bạc · {p.SpiritStones} linh thạch", $"{p.Silver} silver · {p.SpiritStones} spirit stones"), 16, Ink.InkColor);

        Section(T("Đang mang", "Worn"));
        Worn(GearSlot.Weapon, T("Binh khí", "Weapon"), T("tay không", "bare hands"));
        Worn(GearSlot.Armor, T("Giáp", "Armor"), T("không mặc giáp", "no armor"));
        Worn(GearSlot.Accessory, T("Phụ kiện", "Accessory"), T("không đeo gì", "nothing"));
        Para(T("Luyện khí bằng đá cường hóa (rơi từ thổ phỉ, rương bí cảnh…): mỗi cấp +10% mọi chỉ số của món đồ, ít nhất +1. Thất bại thì mất đá và bạc, cấp vẫn giữ.",
            "Refine with enhancement stones (bandits and secret-realm chests drop them): each level adds 10% to all of the item's stats, at least +1. A failure costs the stones and silver; the level holds."), 13, Ink.InkMute);

        if (p.Items.Count == 0)
        {
            Para(T("Hành trang trống rỗng.", "Your bag is empty."));
            return;
        }
        foreach (var group in p.Items.GroupBy(i => i.Type).OrderBy(g => g.Key))
        {
            Section(Text.ItemType(group.Key));
            foreach (var stack in group) Item(stack);
        }
    }

    /// <summary>A worn slot: what's in it and its stats, taking it off, and refining it one level.</summary>
    private void Worn(GearSlot slot, string name, string none)
    {
        var p = E.Player;
        var id = Gear.Equipped(p, slot);
        var def = E.Content.Item(id);
        var info = UiKit.Column(0);
        if (def == null)
        {
            info.AddChild(UiKit.Label($"{name}: {none}", 16, Ink.InkMute));
            Row(info);
            return;
        }
        var level = Gear.RefineLevel(p, id);
        info.AddChild(UiKit.Label($"{name}: {Text.Name(def)}{(level > 0 ? $" +{level}" : "")}", 16, Ink.Rarity(def.Rarity).Darkened(0.15f)));
        var stats = string.Join(", ", Gear.Stats(def, level).Select(s => $"{Text.Stat(s.Key)} +{s.Value}"));
        if (stats.Length > 0) info.AddChild(UiKit.Label(stats, 13, Ink.InkSoft, wrap: true));
        var next = Gear.NextRefine(p, id);
        Control refine;
        if (next is { } cost)
        {
            var stone = E.Content.Item(cost.StoneId);
            var have = Inventory.Count(p, cost.StoneId);
            info.AddChild(UiKit.Label(T($"Luyện lên +{cost.Level}: {cost.Silver} bạc, {cost.Stones} {Text.Name(stone!)} (có {have}) · {cost.Chance * 100:0}% thành công",
                    $"Refine to +{cost.Level}: {cost.Silver} silver, {cost.Stones} × {Text.Name(stone!)} (you have {have}) · {cost.Chance * 100:0}% chance"),
                13, Gear.CanAfford(p, cost) ? Ink.JadeDeep : Ink.InkFaint, wrap: true));
            var s = slot;
            refine = UiKit.Button(T("Luyện", "Refine"), () => Say(E.Refine(s)), enabled: Gear.CanAfford(p, cost));
            refine.Name = "refine_" + slot;
        }
        else
        {
            refine = UiKit.Label(T("Đã luyện tới cực hạn", "Fully refined"), 14, Ink.GoldDeep);
        }
        var off = slot;
        var remove = UiKit.Button(T("Tháo", "Take off"), () => Say(E.Unequip(off)));
        remove.Name = "unequip_" + slot;
        Row(info, refine, remove);
    }

    /// <summary>An item in the bag, with the one thing it's for.</summary>
    private void Item(ItemStack stack)
    {
        var p = E.Player;
        var def = E.Content.Item(stack.Id);
        var info = UiKit.Column(0);
        var level = Gear.RefineLevel(p, stack.Id);
        info.AddChild(UiKit.Label($"{Text.Name(stack)}{(level > 0 ? $" +{level}" : "")} ×{stack.Qty}  ·  {Text.Rarity(stack.Rarity)}", 16, Ink.Rarity(stack.Rarity).Darkened(0.15f)));
        if (def != null)
        {
            var fx = Text.Effects(def);
            info.AddChild(UiKit.Label(fx.Length > 0 ? fx : Text.Desc(def), 13, Ink.InkMute, wrap: true));
        }
        var id = stack.Id;
        Control action;
        if (Gear.IsEquipped(p, id))
        {
            action = UiKit.Label(T("Đang mang", "Worn"), 15, Ink.JadeDeep);
        }
        else if (Gear.SlotOf(def) != null)
        {
            action = UiKit.Button(T("Mang", "Wear"), () => Say(E.Equip(id)));
            action.Name = "wear_" + id;
        }
        else if (Gear.OpensInto(def) != null)
        {
            action = UiKit.Button(Gear.IsSealed(def!) ? T("Phá phong ấn", "Break the seal") : T("Mở", "Open"), () => Say(E.UseItem(id)), primary: true);
            action.Name = "open_" + id;
        }
        else if (Inventory.IsConsumable(E.Content, id))
        {
            action = UiKit.Button(T("Dùng", "Use"), () => Say(E.UseItem(id)));
            action.Name = "use_" + id;
        }
        else if (id.StartsWith("enhancement_stone"))
        {
            action = UiKit.Label(T("Để luyện đồ đang mang", "For refining what you wear"), 13, Ink.InkSoft);
        }
        else
        {
            action = UiKit.Label(T($"Bán ở chợ: {GameEngine.SellPrice(stack.Rarity)} bạc", $"Sells at a market for {GameEngine.SellPrice(stack.Rarity)} silver"), 13, Ink.InkSoft);
        }
        Row(info, action);
    }
}
