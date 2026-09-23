using System.Linq;
using Godot;

namespace TuTienLuc.Arena;

/// <summary>
/// A simple bot for the smoke test: closes in and swings, uses its first art, dashes out of
/// telegraphs, eats a pill when low; in the trial it chases motes and dashes away from demons.
/// </summary>
internal static class ArenaAutopilot
{
    public static void Think(ArenaScreen a, out Vector2 move, out Vector2 aim, out bool attack, out bool dash, out int slot, out bool ult, out bool pill)
    {
        move = Vector2.Zero;
        aim = a.Player.Facing;
        attack = dash = ult = pill = false;
        slot = -1;
        var p = a.Player;

        if (a.Trial is { } trial)
        {
            var demon = trial.Demons.OrderBy(d => d.Pos.DistanceSquaredTo(p.Pos)).FirstOrDefault();
            var mote = trial.Motes
                .OrderBy(m => m.Pos.DistanceTo(p.Pos) / (trial.IsRoot(m.Element) ? 2.5f : 1f))
                .FirstOrDefault();
            if (mote != null) move = (mote.Pos - p.Pos).Normalized();
            if (demon != null && demon.Pos.DistanceTo(p.Pos) < 110)
            {
                aim = (demon.Pos - p.Pos).Normalized();
                attack = true;
                if (demon.Pos.DistanceTo(p.Pos) < 60) dash = a.Stamina >= ArenaScreen.DashCost;
            }
            return;
        }

        var target = a.Enemies.Where(e => e.Active).OrderBy(e => e.Pos.DistanceSquaredTo(p.Pos)).FirstOrDefault();
        if (target == null) return;
        var to = target.Pos - p.Pos;
        var dist = to.Length();
        aim = to.Normalized();

        var threatened = a.Telegraphs.Any(t => !t.FromPlayer && Threatens(t, p.Pos, p.Radius));
        if (threatened && a.Stamina >= ArenaScreen.DashCost)
        {
            dash = true;
            move = new Vector2(-aim.Y, aim.X);
            return;
        }

        var reach = target.Radius + p.Radius + 40;
        move = dist > reach ? aim : new Vector2(-aim.Y, aim.X) * 0.3f;
        attack = dist <= reach + 30;
        if (a.Intent >= 100 && dist < 160) ult = true;
        else if (p.Hp < p.HpMax * 0.35f && a.Pill().Count > 0) pill = true;
        else if (a.SlotSkill(0) is { } art && a.CooldownLeft(art.Id) <= 0 && a.QiCost(art) <= a.Qi && dist < 380) slot = 0;
    }

    private static bool Threatens(Telegraph t, Vector2 pos, float radius) => t.Shape switch
    {
        Telegraph.Shapes.Circle => pos.DistanceTo(t.Pos) <= t.Radius + radius,
        Telegraph.Shapes.Line => ArenaMath.SegmentDistance(pos, t.Pos, t.Pos + t.Dir * t.Length) <= t.Width / 2 + radius,
        _ => ArenaMath.InArc(t.Pos, t.Dir, t.Arc, t.Radius, pos, radius),
    };
}
