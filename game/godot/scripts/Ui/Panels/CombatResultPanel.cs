using System;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Combat;

namespace TuTienLuc.Ui.Panels;

/// <summary>After a fight: what it cost, what it paid, and what comes next.</summary>
public partial class CombatResultPanel : InkPanel
{
    private readonly CombatResolution _res;
    private readonly CombatOutcome _outcome;
    private readonly Func<InkPanel>? _thenOpen;

    public CombatResultPanel(CombatResolution res, CombatOutcome outcome, Func<InkPanel>? thenOpen)
    {
        _res = res;
        _outcome = outcome;
        _thenOpen = thenOpen;
    }

    protected override string Glyph => _outcome.Fled ? "遁" : _outcome.Victory ? "勝" : "敗";
    protected override string TitleText => _outcome.Fled ? T("Thoát thân", "Escaped") : _outcome.Victory ? T("Thắng trận", "Victory") : T("Bại trận", "Defeat");
    protected override Vector2 PanelSize => new(700, 560);

    protected override void Build()
    {
        var locale = Game.Instance.Locale;
        Para(T($"Trận đấu kéo dài {_outcome.Seconds:0} giây. Khí huyết còn {E.Player.Hp}/{E.Player.HpMax}.",
            $"The fight lasted {_outcome.Seconds:0} seconds. Health {E.Player.Hp}/{E.Player.HpMax}."), 16, Ink.InkSoft);
        if (_res.Exp > 0) Para(T($"Tu vi +{_res.Exp}", $"Cultivation +{_res.Exp}"), 20, Ink.JadeDeep);
        var loot = _res.Loot;
        if (loot.Silver > 0 || loot.SpiritStones > 0 || loot.Items.Count > 0)
            Para(RealmPanel.Loot(loot, locale), 17, Ink.GoldDeep);
        if (_outcome.SkillUses.Count > 0)
        {
            var uses = _outcome.SkillUses.Select(u => $"{(E.Content.Skill(u.Key) is { } s ? Text.Name(s) : u.Key)} ×{u.Value}");
            Para(T("Đã thi triển: ", "Arts used: ") + string.Join(", ", uses), 14, Ink.InkMute);
        }
        foreach (var e in _res.Events)
        {
            var color = e.Level == EventLevel.Major ? Ink.JadeDeep : e.Level == EventLevel.Warning ? Ink.CinnabarDeep : Ink.InkSoft;
            Para("· " + e.Localized(locale), 16, color);
        }
        Body.AddChild(UiKit.Spacer(8));
        Buttons(UiKit.Button(T("Tiếp tục", "Continue"), Continue, primary: true));
    }

    private void Continue()
    {
        // A realm floor or a sect trial goes back to its screen; otherwise a fight can lead into an encounter.
        if (_thenOpen != null && (_outcome.Victory || _outcome.Fled))
            Open(_thenOpen());
        else if (_res.FollowUpEventId != null && !E.Player.Dead)
            Open(new EventPanel(null, _res.FollowUpEventId));
        else
            Close();
    }
}
