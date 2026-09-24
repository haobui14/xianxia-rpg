using Godot;
using TuTienLuc.Art;

namespace TuTienLuc.Field;

/// <summary>
/// Draws one <see cref="Fighter"/> — a person or a creature — and keeps its walk animation in step
/// with how far it actually moved this frame. Lives in the Y-sorted object layer.
/// </summary>
public partial class Actor : Node2D
{
    public Fighter Body { get; }
    private readonly FieldScreen _field;

    public Actor(FieldScreen field, Fighter body)
    {
        _field = field;
        Body = body;
        Position = body.Pos;
        body.LastPos = body.Pos;
    }

    public override void _Process(double delta)
    {
        var dt = (float)delta;
        var b = Body;
        Position = b.Pos;
        b.Time += dt;
        var moved = b.Pos.DistanceTo(b.LastPos);
        b.LastPos = b.Pos;
        var speed = dt > 0 ? moved / dt : 0;
        b.Moving = Mathf.MoveToward(b.Moving, speed > 10 ? 1 : 0, dt * 7);
        b.WalkPhase += dt * Mathf.Clamp(speed / 26f, 0, 4.5f) * 3.1f;
        var hover = b.Flying ? 30 + Mathf.Sin(b.Time * 2.4f) * 4 : 0;
        b.Hover = Mathf.MoveToward(b.Hover, hover, dt * (b.Flying ? 90 : 140));
        if (b.AttackAnim > 0) b.AttackAnim = Mathf.Max(0, b.AttackAnim - dt * 4.2f);
        if (b.CastAnim > 0) b.CastAnim = Mathf.Max(0, b.CastAnim - dt * 2.2f);
        if (!b.Alive) b.DeathFade -= dt;

        Modulate = b.HitFlash > 0 ? new Color(1.9f, 1.9f, 1.9f) : Colors.White;
        if (_field.OnScreen(b.Pos, 160)) QueueRedraw();
    }

    public override void _Draw()
    {
        var b = Body;
        var alpha = b.Alive ? (b.Yielded ? 0.8f : 1f) : Mathf.Clamp(b.DeathFade / 0.8f, 0, 1);
        if (alpha <= 0 || b.Gone) return;
        Paint.Alpha = alpha * (b.Invuln > 0 && b.IsPlayer && _field.Player.Dashing ? 0.6f : 1) * (b.Faded ? 0.22f : 1);
        if (b.IsPlayer)
        {
            DrawArc(Vector2.Zero, 17, 0, Mathf.Tau, 32, new Color(0.61f, 0.16f, 0.15f, 0.55f * Paint.Alpha), 2, true);
        }
        else if (b.InBattle && b.Active)
        {
            DrawArc(Vector2.Zero, b.Radius + 4, 0, Mathf.Tau, 32, new Color(0.61f, 0.16f, 0.15f, 0.35f), 1.5f, true);
        }
        var pose = new Pose
        {
            Dir = b.Dir4,
            Walk = b.WalkPhase,
            Move = b.Moving,
            Attack = b.AttackAnim > 0 ? 1 - b.AttackAnim : 0,
            AttackDir = b.AttackDir,
            Cast = b.CastAnim,
            CastColor = b.CastColor,
            Down = b.Yielded || (!b.Alive && b.IsHuman),
            Meditate = b.Meditating,
            Time = b.Time,
            Side = b.Side,
            Enraged = b.Enraged,
            LookAt = _field.PlayerBody.Pos - b.Pos,
            Lift = b.Hover,
        };
        if (b.Hover > 0.5f) FlyingSword(b);
        Figures.Draw(this, b.Kind, b.Look, pose, b.Scale);
        if (b.Shield > 0) DrawArc(new Vector2(0, -26 - b.Hover), 30, 0, Mathf.Tau, 40, new Color(0.53f, 0.79f, 0.66f, 0.7f * Paint.Alpha), 3, true);
        Paint.Alpha = 1;
    }

    /// <summary>The sword under the feet when riding it (ngự kiếm): a long blade with a trail of qi.</summary>
    private void FlyingSword(Fighter b)
    {
        var k = Mathf.Clamp(b.Hover / 30f, 0, 1);
        var dir = Mathf.Abs(b.Facing.X) > 0.2f ? Mathf.Sign(b.Facing.X) : b.Side;
        var y = -b.Hover + 2;
        var tip = new Vector2(dir * 40, y);
        var tail = new Vector2(-dir * 34, y);
        DrawColoredPolygon(Paint.EllipsePts(new Vector2(0, y + 1), 44, 7, 16), new Color(0.55f, 0.85f, 0.95f, 0.18f * k));
        var blade = new[] { tip, new Vector2(dir * 26, y - 3), new Vector2(-dir * 22, y - 3), new Vector2(-dir * 22, y + 3), new Vector2(dir * 26, y + 3) };
        DrawColoredPolygon(blade, new Color(0.86f, 0.9f, 0.94f, k));
        DrawPolyline(new[] { blade[0], blade[1], blade[2], blade[3], blade[4], blade[0] }, new Color(0.11f, 0.13f, 0.19f, 0.8f * k), 1.2f, true);
        DrawLine(new Vector2(-dir * 22, y - 6), new Vector2(-dir * 22, y + 6), new Color(0.63f, 0.48f, 0.18f, k), 3, true);
        DrawLine(new Vector2(-dir * 22, y), tail, new Color(0.35f, 0.25f, 0.2f, k), 3, true);
        DrawLine(tip, new Vector2(-dir * 18, y), new Color(1, 1, 1, 0.8f * k), 1, true);
        if (b.Moving > 0.3f)
            for (var i = 1; i <= 3; i++)
                DrawLine(tail + new Vector2(-dir * i * 9, 0), tail + new Vector2(-dir * (i * 9 + 14), 0), new Color(0.55f, 0.85f, 0.95f, 0.45f * k / i), 2, true);
    }
}
