using System;
using System.Collections.Generic;
using Godot;
using TuTien.Core;
using TuTien.Core.Combat;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTienLuc.Art;

namespace TuTienLuc.Field;

public enum Facing4
{
    Down,
    Up,
    Left,
    Right,
}

/// <summary>
/// Anything with a body on the field: the player, a person, a creature. Plain data — an
/// <see cref="Actor"/> node draws it, the controller / wander AI / battle move it.
/// </summary>
public sealed class Fighter
{
    public string Id = "";
    public bool IsPlayer;
    /// <summary>"human", or an enemy template id ("forest_wolf") that picks the creature drawing.</summary>
    public string Kind = "human";
    public Look? Look;
    /// <summary>Both spellings of the name: a creature has an English one, a person's name is the same in both.</summary>
    public string NameVi = "", NameEn = "";

    /// <summary>The name in the interface language, so switching language renames everyone on the field.</summary>
    public string Name
    {
        get => Game.Instance.T(NameVi, NameEn.Length > 0 ? NameEn : NameVi);
        set
        {
            NameVi = value;
            NameEn = "";
        }
    }

    public string Archetype = "charger";
    public string? PackId;
    public string? NpcId;
    public bool Hostile;

    public Vector2 Pos;
    public Vector2 Home;
    public Vector2 Facing = Vector2.Down;
    public float Side = 1;
    public float Radius = 16;
    public float Speed = 150;
    public float Scale = 1;

    // Combat (set while in a battle).
    public EnemyInstance? Enemy;
    public Combatant Stats;
    public Element? Element;
    public float Hp = 100;
    public float HpMax = 100;
    public bool Alive = true;
    public bool Yielded;
    public bool InBattle;
    public float DeathFade;
    public bool Gone;

    // Animation.
    public float WalkPhase;
    public float Moving;
    public Vector2 LastPos;
    public float AttackAnim;
    public Vector2 AttackDir = Vector2.Down;
    public float CastAnim;
    public Color CastColor = Colors.White;
    public bool Meditating;
    public float Time;
    /// <summary>Riding a flying sword (Trúc Cơ and above), and how high the body currently floats.</summary>
    public bool Flying;
    public float Hover;
    /// <summary>A phantom gone insubstantial: nothing touches it until it forms again.</summary>
    public bool Faded;

    // Ngũ Hành: an applied mark, and a cooldown on reacting against the creature's own phase.
    public Element? Mark;
    public float MarkTime;
    public float InnateCd;

    // Status effects (seconds left).
    public float Stun, Rooted, Slow, Blind, DefBreak, ResBreak, Invuln, HitFlash;
    public float BleedDps, BleedTime, BurnDps, BurnTime;
    public float DotAcc, DotTick;
    public float Shield, ShieldTime;

    // Brain.
    public string State = "approach";
    public float StateTime;
    public float AttackCd;
    public float SkillCd;
    public float MeleeCd;
    public Vector2 Dir;
    public float Strafe = 1;
    public bool Enraged;
    public SkillDef? Skill;
    public Vector2 WanderTarget;
    public float WanderWait;
    public float AggroCd;
    public float WanderRadius = 90;

    public bool Active => Alive && !Yielded;
    public bool IsHuman => Kind == "human";
    /// <summary>Bats and phantoms go over trees and walls instead of around them.</summary>
    public bool Airborne => Archetype is "flier" or "phantom";
    /// <summary>Too big to throw around: tanks, bosses and brutes barely budge when hit.</summary>
    public bool Heavy => Archetype is "tank" or "boss" or "brute" or "serpent";
    public float SpeedFactor => Rooted > 0 ? 0 : Slow > 0 ? 0.5f : 1;
    public EnemyDef Def => Enemy!.Template;

    public Facing4 Dir4
    {
        get
        {
            if (Mathf.Abs(Facing.X) > Mathf.Abs(Facing.Y) * 0.9f) return Facing.X < 0 ? Facing4.Left : Facing4.Right;
            return Facing.Y < 0 ? Facing4.Up : Facing4.Down;
        }
    }

    /// <summary>Stats as a defender, with armor/resistance breaks applied.</summary>
    public Combatant Defending()
    {
        var c = Stats;
        if (DefBreak > 0) c.Def *= 0.7;
        if (ResBreak > 0) c.Res *= 0.7;
        return c;
    }

    /// <summary>Leave combat: clear what a fight set, keep the body.</summary>
    public void ResetCombat()
    {
        InBattle = false;
        Enemy = null;
        Mark = null;
        Stun = Rooted = Slow = Blind = DefBreak = ResBreak = 0;
        BleedDps = BleedTime = BurnDps = BurnTime = DotAcc = 0;
        State = "approach";
        Yielded = false;
    }

    /// <summary>Face a direction; side-view figures remember which way they last looked.</summary>
    public void Face(Vector2 dir)
    {
        if (dir.LengthSquared() < 0.0001f) return;
        Facing = dir.Normalized();
        if (Mathf.Abs(Facing.X) > 0.2f) Side = Facing.X < 0 ? -1 : 1;
    }
}

public sealed class Projectile
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
    public string Look = "orb";
    public bool Dead;
    public float Age;
    /// <summary>How high above the ground it flies; collisions use the point on the ground below it.</summary>
    public float Height = 30;
    public bool FromPlayer => Owner.IsPlayer;
    public Vector2 Ground => Pos + new Vector2(0, Height);
}

/// <summary>An attack announced in advance: a shape on the ground that fills up, then strikes.</summary>
public sealed class Telegraph
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
    public Color? Tint;
    public float Progress => Duration <= 0 ? 1 : Mathf.Clamp(Time / Duration, 0, 1);
}

public sealed class Floater
{
    public Vector2 Pos;
    public Vector2 Vel = new(0, -46);
    public string Text = "";
    public Color Color = Colors.Black;
    public int Size = 20;
    public float Life = 0.9f;
    public float MaxLife = 0.9f;
}

/// <summary>A brush stroke: a slash crescent, an expanding ring, or a beam of light between two points.</summary>
public sealed class Swoosh
{
    public Vector2 Pos;
    public float Angle;
    public float Arc = 110;
    public float Radius = 80;
    public float Life = 0.18f;
    public float MaxLife = 0.18f;
    public Color Color = Colors.Black;
    public bool Ring;
    public float Width = 1;
    public bool Beam;
    public Vector2 End;
}

/// <summary>Leaves or blades circling the caster for a while (an "orbit" art); each foe is cut at most twice a second.</summary>
public sealed class Orbiter
{
    public Fighter Owner = null!;
    public SkillDef Skill = null!;
    public float Mult = 1;
    public DamageKind Kind = DamageKind.Spirit;
    public int Count = 6;
    public float Radius = 74;
    public float Time;
    public float Duration = 6;
    public float Angle;
    public Color Color = Colors.White;
    public readonly Dictionary<Fighter, float> Cooldowns = new();
    public Vector2 At(int i) => Owner.Pos + new Vector2(0, -22) + Vector2.Right.Rotated(Angle + Mathf.Tau * i / Count) * Radius;
}

/// <summary>Ground that keeps burning (a "field" art): everyone inside takes a hit every half second.</summary>
public sealed class GroundFire
{
    public Vector2 Pos;
    public float Radius = 90;
    public float Time;
    public float Duration = 4;
    public float Tick;
    public SkillDef Skill = null!;
    public float Mult = 1;
    public DamageKind Kind = DamageKind.Spirit;
    public Color Color = Colors.White;
}

/// <summary>A stone pillar raised by a "wall" art: solid to bodies and shots until it crumbles.</summary>
public sealed class Pillar
{
    public Vector2 Pos;
    public float Radius = 17;
    public float Time;
    public float Duration = 5;
    public Obstacle Obstacle = null!;
    public float Rise => Mathf.Clamp(Time / 0.18f, 0, 1) * Mathf.Clamp((Duration - Time) / 0.35f, 0, 1);
}

public enum ParticleKind
{
    Dot,
    Spark,
    Leaf,
    Ember,
    Mist,
    Ink,
}

public sealed class Particle
{
    public Vector2 Pos;
    public Vector2 Vel;
    public float Life = 1;
    public float MaxLife = 1;
    public float Size = 3;
    public Color Color = Colors.White;
    public float Gravity;
    public float Drag = 1.5f;
    public float Spin;
    public float Angle;
    public ParticleKind Kind = ParticleKind.Dot;
}

public static class FieldMath
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
        var slack = Mathf.Asin(Mathf.Min(1, pointRadius / Mathf.Max(dist, 1)));
        return angle <= Mathf.DegToRad(arcDeg) / 2 + slack;
    }

    public static float SegmentDistance(Vector2 p, Vector2 a, Vector2 b)
    {
        var ab = b - a;
        var t = ab.LengthSquared() < 0.001f ? 0 : Mathf.Clamp((p - a).Dot(ab) / ab.LengthSquared(), 0, 1);
        return p.DistanceTo(a + ab * t);
    }

    /// <summary>Deterministic 0..1 hash for scenery placement (never used for gameplay rolls).</summary>
    public static float Hash01(int a, int b, int salt = 0)
    {
        unchecked
        {
            var h = (uint)(a * 73856093) ^ (uint)(b * 19349663) ^ (uint)(salt * 83492791);
            h ^= h >> 13;
            h *= 0x5bd1e995;
            h ^= h >> 15;
            return (h & 0xFFFFFF) / (float)0x1000000;
        }
    }
}
