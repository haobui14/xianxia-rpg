using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.State;
using TuTien.Core.Story;
using TuTien.Core.World;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

/// <summary>
/// Meeting a cultivator (design §7.8/§7.13): who they are, what lies between you (favor and the
/// karma ledger), what they say, and what you can do — give, spar, or fight to the death.
/// </summary>
public partial class NpcPanel : InkPanel
{
    private readonly string _npcId;
    private List<Line>? _lines;
    private bool _gifting;
    private bool _confirmKill;

    public NpcPanel(string npcId) => _npcId = npcId;

    private NpcState? Npc => E.Npc(_npcId);

    protected override IconKind Emblem => IconKind.Person;
    protected override string TitleText => Npc?.Name ?? T("Người lạ", "Stranger");
    protected override Vector2 PanelSize => new(780, 660);

    protected override void Build()
    {
        var npc = Npc;
        if (npc == null || !npc.Alive)
        {
            Para(T("Người này không còn ở đây.", "This person is no longer here."));
            Buttons(UiKit.Button(T("Rời đi", "Leave"), Close));
            return;
        }
        _lines ??= E.Talk(_npcId);
        var locale = Game.Instance.Locale;
        var content = E.Content;

        var role = npc.Role != null ? T(npc.Role, npc.RoleEn ?? npc.Role) : T(npc.Female ? "Nữ tu" : "Tu sĩ", "Cultivator");
        var sect = npc.SectId != null && content.Sects.TryGetValue(npc.SectId, out var s) ? Names.Pick(locale, s.Name, s.NameEn) : T("tán tu", "unaffiliated");
        Para($"{role} · {Text.Realm(npc.Realm, npc.Stage)} · {T($"{npc.Age} tuổi", $"age {npc.Age}")} · {sect}", 16, Ink.InkColor);
        var traits = string.Join(", ", npc.Traits.Select(t => NpcSim.TraitName(content, t, locale)));
        var leaning = npc.Alignment >= 30 ? T("chính phái", "righteous") : npc.Alignment <= -30 ? T("tà đạo", "wicked") : T("trung lập", "neutral");
        Para(T($"Tính cách: {traits} · thiên hướng {leaning}", $"Temperament: {traits} · {leaning}"), 14, Ink.InkMute);

        var favor = npc.RelationTo(NpcSim.PlayerKey);
        var meter = new Meter(T("Hảo cảm", "Favor"), favor >= 0 ? Ink.Jade : Ink.Cinnabar, 320);
        meter.Set(favor + 100, 200, (favor > 0 ? "+" : "") + favor);
        Body.AddChild(meter);

        var ledger = E.Player.Ledger.Where(l => l.NpcId == npc.Id && !l.Settled).ToList();
        if (ledger.Count > 0)
        {
            Section(T("Sổ nhân quả", "Karma ledger"));
            foreach (var l in ledger)
            {
                var kind = l.Kind == LedgerKind.An ? T("Ân", "Debt") : T("Oán", "Grudge");
                Para($"{kind} {l.Weight}: {T(l.Context, l.ContextEn)}", 15, l.Kind == LedgerKind.An ? Ink.JadeDeep : Ink.CinnabarDeep);
            }
        }

        Section(T("Lời nói", "Words"));
        foreach (var line in _lines)
            Para("“" + line.Get(locale) + "”", 18, Ink.InkColor);
        Para(T("(Lời thoại ngoại tuyến. Khi trực tuyến, Linh Thức sẽ viết lời thoại từ chính những dữ kiện trên.)",
            "(Offline lines. When online, the Linh Thức storyteller writes dialogue from these same facts.)"), 13, Ink.InkFaint);

        Body.AddChild(UiKit.Spacer(6));
        if (_gifting)
        {
            Section(T("Chọn quà", "Choose a gift"));
            var giftable = E.Player.Items.Where(i => !(i.Id == E.Player.WeaponId && i.Qty <= 1)).ToList();
            if (giftable.Count == 0) Para(T("Ngươi chẳng có gì để tặng.", "You have nothing to give."));
            foreach (var item in giftable)
            {
                var id = item.Id;
                Row(UiKit.Label($"{Text.Name(item)} ×{item.Qty}", 16, Ink.Rarity(item.Rarity).Darkened(0.15f)),
                    UiKit.Button(T("Tặng", "Give"), () =>
                    {
                        _gifting = false;
                        Say(E.Gift(_npcId, id));
                    }));
            }
            Buttons(UiKit.Button(T("Thôi", "Never mind"), () =>
            {
                _gifting = false;
                RequestRefresh();
            }));
            return;
        }

        if (_confirmKill)
        {
            Para(T($"Giết {npc.Name} sẽ để lại nhân quả nặng nề: bạn bè của họ sẽ ghi hận ngươi.",
                $"Killing {npc.Name} leaves heavy karma: their friends will hold a grudge against you."), 16, Ink.Cinnabar);
            Buttons(
                UiKit.Danger(T("Quyết đấu sinh tử", "Fight to the death"), () => Fight(lethal: true)),
                UiKit.Button(T("Thôi", "Stand down"), () =>
                {
                    _confirmKill = false;
                    RequestRefresh();
                }));
            return;
        }

        Buttons(
            UiKit.Button(T("Tặng quà", "Give a gift"), () =>
            {
                _gifting = true;
                RequestRefresh();
            }),
            UiKit.Button(T("Luận bàn", "Spar"), () => Fight(lethal: false), tooltip: T("Tỉ thí tới khi một bên chịu thua.", "Fight until one side yields.")),
            UiKit.Danger(T("Sinh tử quyết đấu…", "Fight to the death…"), () =>
            {
                _confirmKill = true;
                RequestRefresh();
            }),
            UiKit.Button(T("Rời đi", "Leave"), Close));
    }

    private void Fight(bool lethal)
    {
        var enc = E.ChallengeNpc(_npcId, lethal);
        if (enc != null) FightHere(enc);
    }
}
