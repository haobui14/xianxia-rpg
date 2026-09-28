using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

/// <summary>
/// Hành trang: the gear worn in its slots, then the bag, where every item says what it's for — wear it, use it,
/// open it (a storage ring, a treasure pouch), take it to the forge or the furnace, or sell it.
/// </summary>
public partial class InventoryPanel : InkPanel
{
    protected override IconKind Emblem => IconKind.Bag;
    protected override string TitleText => T("Hành trang", "Inventory");

    protected override void Build()
    {
        var p = E.Player;
        var content = E.Content;
        Para(T($"{p.Silver} bạc · {p.SpiritStones} linh thạch", $"{p.Silver} silver · {p.SpiritStones} spirit stones"), 16, Ink.InkColor);

        Section(T("Trang bị", "Gear"));
        foreach (var slot in Equipment.Slots)
        {
            var g = p.Gear.TryGetValue(slot, out var worn) ? worn : new GearSlot();
            var s = slot;
            var info = UiKit.Column(0);
            info.AddChild(UiKit.Label(Text.Slot(slot, g.Level), 14, Ink.InkSoft));
            info.AddChild(UiKit.Label(Text.Worn(content, slot, g), 16, g.ItemId != null ? Ink.InkColor : Ink.InkFaint, wrap: true));
            Row(info, g.ItemId != null ? Named(UiKit.Button(T("Tháo", "Take off"), () => Say(E.Unequip(s))), $"unequip_{slot}") : UiKit.Label("", 15));
        }
        Para(T("Ô trang bị được cường hóa ở lò rèn trong làng.", "Gear slots are enhanced at the village forge."), 13, Ink.InkMute);

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

    /// <summary>An item in the bag, with the one thing it's for.</summary>
    private void Item(ItemStack stack)
    {
        var p = E.Player;
        var content = E.Content;
        var def = content.Item(stack.Id);
        var info = UiKit.Column(0);
        info.AddChild(UiKit.Label($"{Text.Name(stack)} ×{stack.Qty}  ·  {Text.Rarity(stack.Rarity)}", 16, Ink.Rarity(stack.Rarity).Darkened(0.15f)));
        if (def != null)
        {
            var fx = Text.Effects(def);
            var slot = Equipment.SlotFor(def);
            info.AddChild(UiKit.Label((slot != null ? Text.SlotName(slot) + " · " : "") + (fx.Length > 0 ? fx : Text.Desc(def)), 13, Ink.InkMute, wrap: true));
        }
        var id = stack.Id;
        Control action;
        if (Equipment.IsWorn(p, id))
            action = UiKit.Label(T("Đang dùng", "Equipped"), 15, Ink.JadeDeep);
        else if (Equipment.SlotFor(def) != null)
            action = Named(UiKit.Button(T("Trang bị", "Equip"), () => Say(E.Equip(id))), $"equip_{id}");
        else if (Containers.OpensInto(def) != null)
            action = Named(UiKit.Button(Containers.IsSealed(def!) ? T("Phá phong ấn", "Break the seal") : T("Mở", "Open"), () => Say(E.UseItem(id)), primary: true), $"open_{id}");
        else if (Inventory.IsConsumable(content, id))
            action = Named(UiKit.Button(T("Dùng", "Use"), () => Say(E.UseItem(id))), $"use_{id}");
        else
            action = UiKit.Label(Purpose(id, stack.Rarity), 13, Ink.InkSoft, wrap: true);
        Row(info, action);
    }

    /// <summary>What an item that isn't worn, used or opened is for.</summary>
    private string Purpose(string id, string rarity)
    {
        if (id.StartsWith("enhancement_stone"))
            return T("Mang tới lò rèn để cường hóa", "For enhancing gear at the forge");
        if (Mining.Smelts.Any(s => s.Ore == id))
            return T("Lò rèn luyện thành đá cường hóa", "The forge smelts it into enhancement stones");
        if (E.Content.Recipes.Any(r => r.Ingredients.Any(i => i.Item == id)))
            return T("Dược liệu cho lò đan", "An ingredient for the furnace");
        return T($"Bán ở chợ: {GameEngine.SellPrice(rarity)} bạc", $"Sells at a market for {GameEngine.SellPrice(rarity)} silver");
    }

    private static Button Named(Button button, string name)
    {
        button.Name = name;
        return button;
    }
}
