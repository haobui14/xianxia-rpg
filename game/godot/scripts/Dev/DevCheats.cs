using System.Collections.Generic;
using TuTien.Core;
using TuTien.Core.Rules;
using TuTien.Core.World;

namespace TuTienLuc.Dev;

/// <summary>
/// Test shortcuts for the greybox (F9 panel and the smoke test). The one place the Godot layer
/// writes to game state directly — never call these from gameplay code.
/// </summary>
public static class DevCheats
{
    public static List<GameEvent> AddExp(GameEngine e, long exp) => Cultivation.AddExp(e.State, e.Content, exp, exp / 2);

    /// <summary>Fill cultivation until a major breakthrough is waiting.</summary>
    public static List<GameEvent> FillToBreakthrough(GameEngine e)
    {
        var events = new List<GameEvent>();
        for (var guard = 0; guard < 30 && !e.Player.PendingMajorBreakthrough; guard++)
        {
            var need = Progression.RequiredExp(e.Content, e.Player.Realm, e.Player.Stage);
            if (need == long.MaxValue) break;
            events.AddRange(Cultivation.AddExp(e.State, e.Content, need - e.Player.Exp, 0));
        }
        return events;
    }

    public static void Silver(GameEngine e, int amount) => e.Player.Silver += amount;

    public static void Restore(GameEngine e)
    {
        var p = e.Player;
        p.Hp = p.HpMax;
        p.Qi = p.QiMax;
        p.Footwork = p.FootworkMax;
    }

    /// <summary>Stand on a tile without walking there (no footwork, no month). Reveals around it.</summary>
    public static void Place(GameEngine e, int x, int y)
    {
        if (!e.Map.InBounds(x, y)) return;
        e.Player.X = x;
        e.Player.Y = y;
        var fog = e.Fog();
        fog.RevealCircle(x, y, e.SenseRadius);
        fog.SaveTo(e.Player, e.Map);
    }

    /// <summary>Learn an art without its manual (tests of every art).</summary>
    public static List<GameEvent> LearnArt(GameEngine e, string skillId) => Skills.Learn(e.State, e.Content, skillId);

    /// <summary>Jump to a major realm (tests of realm-gated things like sword flight).</summary>
    public static void SetRealm(GameEngine e, Realm realm)
    {
        e.Player.Realm = realm;
        e.Player.Stage = 1;
        e.Player.PendingMajorBreakthrough = false;
    }

    public static void RevealMap(GameEngine e)
    {
        var fog = e.Fog();
        for (var y = 0; y < e.Map.Height; y++)
            for (var x = 0; x < e.Map.Width; x++)
                fog.Set(x, y);
        fog.SaveTo(e.Player, e.Map);
    }

    /// <summary>Finish every sect mission in hand, as if its fights, herbs or months were done (it still has to be reported).</summary>
    public static List<GameEvent> FinishMissions(GameEngine e)
    {
        foreach (var m in e.Player.Missions) m.Progress = m.Goal;
        return SectMissions.Announce(e.State, e.Content);
    }

    /// <summary>Contribution and the merit that comes with it, as missions would pay.</summary>
    public static void Contribution(GameEngine e, int amount)
    {
        e.Player.Contribution += amount;
        e.Player.Merit += amount;
    }

    public static List<GameEvent> PassMonths(GameEngine e, int months)
    {
        var events = new List<GameEvent>();
        for (var i = 0; i < months && !e.Player.Dead; i++)
        {
            var report = e.EndMonth();
            events.AddRange(report.Events);
            if (report.Ambushed) break;
        }
        return events;
    }
}
