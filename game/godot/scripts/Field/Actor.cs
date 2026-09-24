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
        Paint.Alpha = alpha * (b.Invuln > 0 && b.IsPlayer && _field.Player.Dashing ? 0.6f : 1);
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
        };
        Figures.Draw(this, b.Kind, b.Look, pose, b.Scale);
        if (b.Shield > 0) DrawArc(new Vector2(0, -26), 30, 0, Mathf.Tau, 40, new Color(0.53f, 0.79f, 0.66f, 0.7f * Paint.Alpha), 3, true);
        Paint.Alpha = 1;
    }
}
