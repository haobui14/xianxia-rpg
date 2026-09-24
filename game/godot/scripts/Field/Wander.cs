using Godot;

namespace TuTienLuc.Field;

/// <summary>
/// Life between fights: people stroll around where they stand, beasts prowl their patch. Purely
/// cosmetic motion (Godot's random numbers, never the game's seeded streams) — where someone "is"
/// in the rules stays their tile in the engine.
/// </summary>
public static class Wander
{
    public static void Update(FieldScreen f, Fighter b, float dt)
    {
        if (b.InBattle || !b.Alive || b.IsPlayer) return;
        b.AggroCd -= dt;
        var player = f.PlayerBody;

        if (b.WanderWait > 0)
        {
            b.WanderWait -= dt;
            // People turn to look at someone walking past.
            if (b.IsHuman && b.Pos.DistanceTo(player.Pos) < 160) b.Face(player.Pos - b.Pos);
            return;
        }

        var to = b.WanderTarget - b.Pos;
        if (to.Length() < 6 || b.WanderTarget == Vector2.Zero)
        {
            b.WanderWait = 1.2f + GD.Randf() * (b.IsHuman ? 4f : 2.5f);
            var offset = Vector2.Right.Rotated(GD.Randf() * Mathf.Tau) * (GD.Randf() * b.WanderRadius);
            b.WanderTarget = f.Walls.NearestFree(b.Home + offset, b.Radius, 60);
            return;
        }

        var pace = b.IsHuman ? 62f : Mathf.Clamp(b.Speed * 0.42f, 40, 90);
        var step = to.Normalized() * pace * dt;
        var before = b.Pos;
        b.Pos = f.Walls.Move(b.Pos, b.Radius, step);
        b.Face(step);
        // Stuck on a trunk or a wall: pick somewhere else.
        if (b.Pos.DistanceTo(before) < step.Length() * 0.25f) b.WanderTarget = b.Pos;
    }

    /// <summary>Walk home (after a fight, or when the world moved someone); true when there.</summary>
    public static bool ReturnHome(FieldScreen f, Fighter b, float dt, float speed)
    {
        var to = b.Home - b.Pos;
        if (to.Length() < 8) return true;
        var step = to.Normalized() * Mathf.Min(speed * dt, to.Length());
        var before = b.Pos;
        b.Pos = f.Walls.Move(b.Pos, b.Radius, step);
        b.Face(step);
        if (b.Pos.DistanceTo(before) < step.Length() * 0.2f) b.Pos = f.Walls.NearestFree(b.Home, b.Radius);
        return false;
    }
}
