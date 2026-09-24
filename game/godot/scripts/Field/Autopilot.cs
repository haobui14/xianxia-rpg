using System.Linq;
using Godot;

namespace TuTienLuc.Field;

/// <summary>
/// A simple bot for the smoke test. In a fight it closes in and swings, uses its first art, dashes out
/// of telegraphs and eats a pill when low. In the breakthrough trial it chases qi motes and cuts heart
/// demons. Exploring, the controller walks its <see cref="PlayerController.Route"/>.
/// </summary>
public static class Autopilot
{
    public static Controls Think(PlayerController pc)
    {
        var c = Controls.None;
        var p = pc.Body;
        c.Aim = p.Facing;
        if (pc.F is TrialScreen trial) return Trial(pc, trial);
        var battle = pc.F.Battle;
        if (battle == null) return c;

        var target = battle.Enemies.Where(e => e.Active && e.InBattle).OrderBy(e => e.Pos.DistanceSquaredTo(p.Pos)).FirstOrDefault();
        if (target == null) return c;
        var to = target.Pos - p.Pos;
        var dist = to.Length();
        var aim = dist > 0.01f ? to / dist : Vector2.Down;
        c.Aim = aim;

        var threatened = battle.Telegraphs.Any(t => !t.FromPlayer && Threatens(t, p.Pos, p.Radius));
        if (threatened && pc.Stamina >= PlayerController.DashCost && pc.DashCd <= 0)
        {
            c.Dash = true;
            c.Move = new Vector2(-aim.Y, aim.X);
            return c;
        }

        var reach = target.Radius + p.Radius + 50;
        c.Move = dist > reach ? aim : new Vector2(-aim.Y, aim.X) * 0.3f;
        c.Attack = dist <= reach + 30;
        if (pc.Intent >= 100 && dist < 160) c.Ultimate = true;
        else if (p.Hp < p.HpMax * 0.35f && pc.Pill().Count > 0 && pc.PillCd <= 0) c.Pill = true;
        else if (pc.SlotSkill(0) is { } art && pc.CooldownLeft(art.Id) <= 0 && pc.QiCost(art) <= pc.Qi && dist < 380) c.Slot = 0;
        return c;
    }

    private static Controls Trial(PlayerController pc, TrialScreen trial)
    {
        var c = Controls.None;
        var p = pc.Body;
        c.Aim = p.Facing;
        var demon = trial.Demons.OrderBy(d => d.Pos.DistanceSquaredTo(p.Pos)).FirstOrDefault();
        var mote = trial.Motes.OrderBy(m => m.Pos.DistanceTo(p.Pos) / (trial.IsRoot(m.Element) ? 2.5f : 1f)).FirstOrDefault();
        if (mote != null) c.Move = (mote.Pos - p.Pos).Normalized();
        if (demon != null && demon.Pos.DistanceTo(p.Pos) < 120)
        {
            c.Aim = (demon.Pos - p.Pos).Normalized();
            c.Attack = true;
            if (demon.Pos.DistanceTo(p.Pos) < 64) c.Dash = pc.Stamina >= PlayerController.DashCost;
        }
        return c;
    }

    public static bool Threatens(Telegraph t, Vector2 pos, float radius) => t.Shape switch
    {
        Telegraph.Shapes.Circle => pos.DistanceTo(t.Pos) <= t.Radius + radius,
        Telegraph.Shapes.Line => FieldMath.SegmentDistance(pos, t.Pos, t.Pos + t.Dir * t.Length) <= t.Width / 2 + radius,
        _ => FieldMath.InArc(t.Pos, t.Dir, t.Arc, t.Radius, pos, radius),
    };
}
