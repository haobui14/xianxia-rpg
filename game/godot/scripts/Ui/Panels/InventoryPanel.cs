using System.Linq;
using Godot;
using TuTien.Core.Rules;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

/// <summary>Hành trang: use pills and manuals, equip weapons.</summary>
public partial class InventoryPanel : InkPanel
{
    protected override IconKind Emblem => IconKind.Bag;
    protected override string TitleText => T("Hành trang", "Inventory");

    protected override void Build()
    {
        var p = E.Player;
        var content = E.Content;
        var weapon = content.Item(p.WeaponId);
        Para(T($"{p.Silver} bạc · {p.SpiritStones} linh thạch · binh khí: {(weapon != null ? Text.Name(weapon) : "tay không")}",
            $"{p.Silver} silver · {p.SpiritStones} spirit stones · weapon: {(weapon != null ? Text.Name(weapon) : "bare hands")}"), 16, Ink.InkColor);
        if (p.Items.Count == 0)
        {
            Para(T("Hành trang trống rỗng.", "Your bag is empty."));
            return;
        }

        foreach (var group in p.Items.GroupBy(i => i.Type).OrderBy(g => g.Key))
        {
            Section(Text.ItemType(group.Key));
            foreach (var stack in group)
            {
                var def = content.Item(stack.Id);
                var info = UiKit.Column(0);
                info.AddChild(UiKit.Label($"{Text.Name(stack)} ×{stack.Qty}  ·  {Text.Rarity(stack.Rarity)}", 16, Ink.Rarity(stack.Rarity).Darkened(0.15f)));
                if (def != null)
                {
                    var fx = Text.Effects(def);
                    info.AddChild(UiKit.Label(fx.Length > 0 ? fx : Text.Desc(def), 13, Ink.InkMute, wrap: true));
                }
                var id = stack.Id;
                Control action;
                if (id == p.WeaponId)
                    action = UiKit.Label(T("Đang dùng", "Equipped"), 15, Ink.JadeDeep);
                else if (def?.EquipmentSlot == "Weapon")
                    action = UiKit.Button(T("Trang bị", "Equip"), () => Say(E.Equip(id)));
                else if (Inventory.IsConsumable(content, id))
                    action = UiKit.Button(T("Dùng", "Use"), () => Say(E.UseItem(id)));
                else
                    action = UiKit.Label("", 15);
                Row(info, action);
            }
        }
    }
}
