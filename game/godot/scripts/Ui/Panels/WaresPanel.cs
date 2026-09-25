using Godot;
using TuTien.Core;
using TuTien.Core.State;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

/// <summary>A merchant caravan met on the road: its wares this month, finer than the village stall's.</summary>
public partial class WaresPanel : InkPanel
{
    protected override IconKind Emblem => IconKind.Bag;
    protected override string TitleText => T("Đoàn thương nhân", "Merchant caravan");

    protected override void Build()
    {
        var p = E.Player;
        Para(T("Đoàn thương nhân dỡ hàng bên vệ đường: toàn đồ từ bí cảnh và núi lửa phương xa.",
            "The caravan unpacks by the roadside: goods from secret realms and faraway volcanoes."), 15, Ink.InkMute);
        Para(T($"Ngươi có {p.Silver} bạc · {p.SpiritStones} linh thạch.", $"You have {p.Silver} silver · {p.SpiritStones} spirit stones."), 15, Ink.InkColor);
        var wares = E.CaravanWares();
        for (var i = 0; i < wares.Offers.Count; i++) Row(this, E, wares, i, $"caravan_{i}");
        Buttons(UiKit.Button(T("Lên đường", "Move on"), Close, primary: true));
    }

    /// <summary>One ware in <paramref name="panel"/>: name, rarity and effect, price, how many left, and Buy.</summary>
    public static void Row(InkPanel panel, GameEngine e, MarketState wares, int index, string buttonName)
    {
        var offer = wares.Offers[index];
        var def = e.Content.Item(offer.ItemId);
        if (def == null) return;
        var p = e.Player;
        var info = UiKit.Column(0);
        info.AddChild(UiKit.Label(Text.Name(def) + "  ·  " + Text.Rarity(def.Rarity), 16, Ink.Rarity(def.Rarity).Darkened(0.15f)));
        var fx = Text.Effects(def);
        info.AddChild(UiKit.Label(fx.Length > 0 ? fx : Text.Desc(def), 13, Ink.InkMute, wrap: true));
        var price = offer.SpiritStones > 0 ? T($"{offer.SpiritStones} linh thạch", $"{offer.SpiritStones} spirit stones") : T($"{offer.Silver} bạc", $"{offer.Silver} silver");
        var left = offer.Left > 0 ? T($"còn {offer.Left}", $"{offer.Left} left") : T("hết hàng", "sold out");
        var i = index;
        var buy = UiKit.Button(T("Mua", "Buy"), () => Game.Instance.Notify(e.BuyWare(wares, i)),
            enabled: offer.Left > 0 && p.Silver >= offer.Silver && p.SpiritStones >= offer.SpiritStones);
        buy.Name = buttonName;
        panel.AddRow(info, UiKit.Label($"{price} · {left}", 15, Ink.GoldDeep), buy);
    }
}
