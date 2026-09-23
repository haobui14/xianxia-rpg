using System;
using System.Collections.Generic;
using Godot;
using TuTien.Core;
using TuTien.Core.Combat;
using TuTien.Core.Content;
using TuTien.Core.Rules;

namespace TuTienLuc.Arena;

public enum ArenaMode
{
    /// <summary>A fight from the world map (design §7.3).</summary>
    Battle,
    /// <summary>The major-breakthrough set piece (design §7.5): gather qi, avoid heart demons.</summary>
    QiTrial,
}

/// <summary>Anyone with a body in the arena: the player or an enemy. Plain data; the arena runs it.</summary>
internal sealed class Fighter
{
    public string Id = "";
    public bool IsPlayer;
    public EnemyInstance? Enemy;
    public string Name = "";
    public string Glyph = "";
    public string Archetype = "charger";
    public Vector2 Pos;
    public Vector2 Facing = Vector2.Right;
    public float Radius = 18;
    public float Speed = 150;
    public float Hp;
    public float HpMax;
    public Combatant Stats;
    public Element? Element;
    public bool Alive = true;
    public bool Yielded;
    public float DeathFade;

    // Ngũ Hành: an applied mark, and a cooldown on reacting against the creature's own phase.
    public Element? Mark;
    public float MarkTime;
    public float InnateCd;

    // Status effects (seconds left).
    public float Stun, Rooted, Slow, Blind, DefBreak, ResBreak, Invuln, HitFlash;
    public float BleedDps, BleedTime, BurnDps, BurnTime;
    public float DotAcc, DotTick;
    public float Shield, ShieldTime;

    // Enemy brain.
    public string State = "approach";
    public float StateTime;
    public float AttackCd;
    public float SkillCd;
    public float MeleeCd;
    public Vector2 Dir;
    public float Strafe = 1;
    public bool Enraged;
    public SkillDef? Skill;

    public bool Active => Alive && !Yielded;
    public bool Disabled => Stun > 0;
    public float SpeedFactor => Rooted > 0 ? 0 : Slow > 0 ? 0.5f : 1;
    public EnemyDef Def => Enemy!.Template;

    /// <summary>Stats as a defender, with armor/resistance breaks applied.</summary>
    public Combatant Defending()
    {
        var c = Stats;
        if (DefBreak > 0) c.Def *= 0.7;
        if (ResBreak > 0) c.Res *= 0.7;
        return c;
    }
}

internal sealed class Projectile
{
    public Vector2 Pos;
    public Vector2 Vel;
    public float Radius = 10;
    public float Range = 400;
    public float Traveled;
    public Fighter Owner = null!;
    public SkillDef? Skill;
    public float Mult = 1;
    public DamageKind Kind = DamageKind.Spirit;
    public Element? Element;
    public float Burst;
    public Color Color = Colors.Black;
    public bool Dead;
    public bool FromPlayer => Owner.IsPlayer;
}

/// <summary>An attack announced in advance: a shape that fills up, then strikes (design §7.3 "read the tell").</summary>
internal sealed class Telegraph
{
    public enum Shapes
    {
        Circle,
        Line,
        Arc,
    }

    public Shapes Shape = Shapes.Circle;
    public Vector2 Pos;
    public Vector2 Dir = Vector2.Right;
    public float Radius = 60;
    public float Length = 200;
    public float Width = 30;
    public float Arc = 100;
    public float Time;
    public float Duration = 0.6f;
    public bool FromPlayer;
    public Fighter? Owner;
    public Action? Fire;
    public bool Dead;
    public float Progress => Duration <= 0 ? 1 : Mathf.Clamp(Time / Duration, 0, 1);
}

internal sealed class Floater
{
    public Vector2 Pos;
    public Vector2 Vel = new(0, -46);
    public string Text = "";
    public Color Color = Colors.Black;
    public int Size = 20;
    public float Life = 0.9f;
    public float MaxLife = 0.9f;
}

/// <summary>A brush stroke: a slash arc or an expanding ring.</summary>
internal sealed class Swoosh
{
    public Vector2 Pos;
    public float Angle;
    public float Arc = 110;
    public float Radius = 80;
    public float Life = 0.18f;
    public float MaxLife = 0.18f;
    public Color Color = Colors.Black;
    public bool Ring;
}

/// <summary>Breakthrough trial pieces: qi motes to gather, heart demons to avoid.</summary>
internal sealed class Mote
{
    public Vector2 Pos;
    public Vector2 Vel;
    public Element Element;
    public float Life = 5;
    public bool Dead;
}

internal sealed class Demon
{
    public Vector2 Pos;
    public float Speed = 120;
    public float Wobble;
    public bool Dead;
}

internal static class ArenaMath
{
    public static float Angle(Vector2 v) => Mathf.Atan2(v.Y, v.X);

    /// <summary>Is <paramref name="point"/> inside the arc of <paramref name="arcDeg"/> degrees centred on <paramref name="facing"/>?</summary>
    public static bool InArc(Vector2 origin, Vector2 facing, float arcDeg, float reach, Vector2 point, float pointRadius)
    {
        var to = point - origin;
        var dist = to.Length();
        if (dist > reach + pointRadius) return false;
        if (dist <= pointRadius) return true;
        var angle = Mathf.Abs(Mathf.Wrap(Angle(to) - Angle(facing), -Mathf.Pi, Mathf.Pi));
        // A wide body can be clipped by the edge of the arc.
        var slack = Mathf.Asin(Mathf.Min(1, pointRadius / Mathf.Max(dist, 1)));
        return angle <= Mathf.DegToRad(arcDeg) / 2 + slack;
    }

    /// <summary>Distance from a point to the segment a–b.</summary>
    public static float SegmentDistance(Vector2 p, Vector2 a, Vector2 b)
    {
        var ab = b - a;
        var t = ab.LengthSquared() < 0.001f ? 0 : Mathf.Clamp((p - a).Dot(ab) / ab.LengthSquared(), 0, 1);
        return p.DistanceTo(a + ab * t);
    }

    public static readonly IReadOnlyDictionary<Element, string> Han = new Dictionary<Element, string>
    {
        [Element.Kim] = "金",
        [Element.Moc] = "木",
        [Element.Thuy] = "水",
        [Element.Hoa] = "火",
        [Element.Tho] = "土",
    };
}
