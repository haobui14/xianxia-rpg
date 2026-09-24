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
        if (pc.F is FoundationTrial storm) return Storm(pc, storm);
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

    /// <summary>
    /// The meridian storm: first get off a meridian a surge is coming down, then stand in a shockwave's gap
    /// (or dash through it), cut turbid qi in reach, and otherwise go meet the best qi on its way in.
    /// </summary>
    private static Controls Storm(PlayerController pc, FoundationTrial t)
    {
        var c = Controls.None;
        var p = pc.Body;
        c.Aim = p.Facing;
        var pos = p.Pos;
        var rel = pos - t.Center;
        var dist = rel.Length();
        var canDash = pc.Stamina >= PlayerController.DashCost && pc.DashCd <= 0;

        foreach (var s in t.Surges.Where(s => !s.Fired).OrderByDescending(s => s.Progress))
        {
            if (!t.OnChannel(s.Channel, pos, p.Radius + 52)) continue;
            var dir = FoundationTrial.Dir(s.Channel);
            var side = new Vector2(-dir.Y, dir.X);
            c.Move = rel.Dot(side) >= 0 ? side : -side;
            c.Dash = s.Duration - s.Time < 0.3f && canDash;
            return c;
        }

        var wave = t.Waves.Where(w => !w.Resolved).OrderBy(w => w.Radius).FirstOrDefault();
        if (wave != null && (!wave.Emitted || dist - wave.Radius < 150))
        {
            var angle = Mathf.Atan2(rel.Y, rel.X);
            if (!wave.InGap(angle))
            {
                var gap = wave.NearestGap(angle);
                var turn = Mathf.Wrap(gap - angle, -Mathf.Pi, Mathf.Pi);
                var tangent = new Vector2(-rel.Y, rel.X).Normalized() * Mathf.Sign(turn);
                c.Move = tangent;
                if (wave.Emitted && dist - wave.Radius < 34 && canDash)
                {
                    c.Dash = true;
                    c.Move = -rel.Normalized();
                }
                return c;
            }
            if (wave.Emitted) return c;
        }

        var turbid = t.Drops.Where(d => d.Turbid).OrderBy(d => d.Pos.DistanceSquaredTo(pos)).FirstOrDefault();
        if (turbid != null && turbid.Pos.DistanceTo(pos) < 105)
        {
            c.Aim = (turbid.Pos - pos).Normalized();
            c.Attack = true;
        }

        // Where a drop will be by the time we get there, and how much it's worth the walk.
        var speed = Mathf.Max(120, p.Speed);
        Vector2 Meet(QiDrop d)
        {
            var eta = d.Pos.DistanceTo(pos) / speed;
            return t.At(d.Channel, Mathf.Max(FoundationTrial.Sink + 30, d.Dist - d.Speed * eta));
        }
        var best = t.Drops.Where(d => !d.Turbid && d.Dist > FoundationTrial.Sink + 40)
            .OrderBy(d => Meet(d).DistanceTo(pos) / (d.Essence ? 3f : 1f)).FirstOrDefault();
        if (best != null)
        {
            var to = Meet(best) - pos;
            if (to.Length() > 6) c.Move = to.Normalized();
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
