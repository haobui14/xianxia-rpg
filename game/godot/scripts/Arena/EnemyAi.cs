using Godot;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTienLuc.Ui;

namespace TuTienLuc.Arena;

/// <summary>
/// Archetype brains (design §7.3). Every attack is announced by a telegraph the player can read and
/// dodge: chargers line up a rush, swarms nip and circle, ranged foes keep distance and aim, tanks
/// slam around themselves, casters kite and cast, bosses mix all of it and enrage at half health.
/// </summary>
internal static class EnemyAi
{
    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    /// <summary>For ranged foes without an authored art.</summary>
    private static readonly SkillDef Bolt = new()
    {
        Id = "yeu_khi", Name = "Yêu Khí", NameEn = "Demonic Qi", Glyph = "妖", Damage = "spirit", DamageMultiplier = 1.0, Cooldown = 2.2,
        Cast = new CastDef { Shape = "projectile", Range = 420, Radius = 10, Speed = 380, Windup = 0.45 },
    };

    public static void Update(ArenaScreen a, Fighter f, float dt)
    {
        if (!f.Alive)
        {
            f.DeathFade -= dt;
            return;
        }
        a.TickStatus(f, dt);
        if (!f.Active) return;

        f.AttackCd -= dt;
        f.SkillCd -= dt;
        f.MeleeCd -= dt;
        f.StateTime += dt;
        if (f.Stun > 0)
        {
            if (f.State != "approach")
            {
                f.State = "recover";
                f.StateTime = 0;
            }
            return;
        }

        var p = a.Player;
        var to = p.Pos - f.Pos;
        var dist = to.Length();
        var dir = dist > 0.01f ? to / dist : Vector2.Left;
        if (f.State is "approach" or "recover") f.Facing = dir;

        if (f.Archetype == "boss" && !f.Enraged && f.Hp < f.HpMax * 0.5f)
        {
            f.Enraged = true;
            a.Say(f.Pos + new Vector2(0, -f.Radius - 30), T("Cuồng nộ!", "Enraged!"), Ink.Cinnabar, 26, 1.4f);
            a.Shake(8);
        }

        if (f.State == "recover")
        {
            if (f.StateTime > 0.45f) f.State = "approach";
        }
        else
        {
            switch (f.Archetype)
            {
                case "swarm":
                    Swarm(a, f, dir, dist, dt);
                    break;
                case "ranged":
                    Ranged(a, f, dir, dist, dt);
                    break;
                case "tank":
                    Tank(a, f, dir, dist, dt);
                    break;
                case "caster":
                    Caster(a, f, dir, dist, dt);
                    break;
                case "boss":
                    Boss(a, f, dir, dist, dt);
                    break;
                default:
                    Charger(a, f, dir, dist, dt);
                    break;
            }
        }
        Separate(a, f);
        a.ClampToField(f);
    }

    private static float Reach(ArenaScreen a, Fighter f, float extra) => f.Radius + a.Player.Radius + extra;

    private static void Move(Fighter f, Vector2 dir, float factor, float dt) =>
        f.Pos += dir * f.Speed * f.SpeedFactor * factor * dt;

    private static Vector2 Tangent(Vector2 dir, float side) => new Vector2(-dir.Y, dir.X) * side;

    // ---------------------------------------------------------------- archetypes

    private static void Charger(ArenaScreen a, Fighter f, Vector2 dir, float dist, float dt)
    {
        switch (f.State)
        {
            case "approach":
                Move(f, dir, 1, dt);
                if (dist < Reach(a, f, 12) && f.MeleeCd <= 0)
                {
                    Melee(a, f, dir, 0.3f, 1.0f, 100, 24);
                }
                else if (dist is > 110 and < 270 && f.AttackCd <= 0)
                {
                    f.State = "windup";
                    f.StateTime = 0;
                    f.Dir = dir;
                    f.Facing = dir;
                    a.AddTelegraph(new Telegraph
                    {
                        Shape = Telegraph.Shapes.Line, Pos = f.Pos, Dir = dir, Length = 300, Width = f.Radius * 2 + 8,
                        Duration = f.Speed < 140 ? 0.7f : 0.55f, Owner = f,
                        Fire = () =>
                        {
                            f.State = "charge";
                            f.StateTime = 0;
                        },
                    });
                }
                break;
            case "charge":
                var before = f.Pos;
                Move(f, f.Dir, 3.3f, dt);
                a.ClampToField(f);
                var hitWall = f.Pos.DistanceTo(before) < f.Speed * 3.3f * dt * 0.5f;
                if (f.Pos.DistanceTo(a.Player.Pos) < f.Radius + a.Player.Radius + 2)
                {
                    a.HitPlayer(f, 1.35f, DamageKind.Physical, null, null);
                    Recover(f, 1.8f);
                }
                else if (f.StateTime > 0.42f || hitWall)
                {
                    Recover(f, 1.8f);
                }
                break;
        }
    }

    private static void Swarm(ArenaScreen a, Fighter f, Vector2 dir, float dist, float dt)
    {
        if (f.State != "approach") return;
        Vector2 want;
        if (dist > 130) want = dir + Tangent(dir, f.Strafe) * 0.35f;
        else if (dist < 60) want = -dir * 0.6f + Tangent(dir, f.Strafe);
        else want = Tangent(dir, f.Strafe) + dir * (f.MeleeCd <= 0 ? 1.1f : -0.2f);
        Move(f, want.Normalized(), 1, dt);
        if (a.Rng.Chance(dt * 0.6)) f.Strafe *= -1;
        if (dist < Reach(a, f, 14) && f.MeleeCd <= 0) Melee(a, f, dir, 0.24f, 1.0f, 90, 20);
    }

    private static void Ranged(ArenaScreen a, Fighter f, Vector2 dir, float dist, float dt)
    {
        if (f.State != "approach") return;
        var skill = f.Skill ?? Bolt;
        if (f.Speed > 0)
        {
            var want = dist < 230 ? -dir : dist > 420 ? dir : Tangent(dir, f.Strafe) * 0.6f;
            Move(f, want, 1, dt);
            if (a.Rng.Chance(dt * 0.4)) f.Strafe *= -1;
            if (dist < Reach(a, f, 10) && f.MeleeCd <= 0)
            {
                Melee(a, f, dir, 0.3f, 0.9f, 100, 20);
                return;
            }
        }
        if (f.SkillCd <= 0 && dist < skill.Cast.Range + 80) Cast(a, f, skill, dir);
    }

    private static void Tank(ArenaScreen a, Fighter f, Vector2 dir, float dist, float dt)
    {
        if (f.State != "approach") return;
        if (dist > Reach(a, f, 4)) Move(f, dir, 1, dt);
        if (dist < 135 && f.AttackCd <= 0) Slam(a, f, 118, 0.85f, 1.45f, 2.8f);
        else if (dist < Reach(a, f, 14) && f.MeleeCd <= 0) Melee(a, f, dir, 0.4f, 1.1f, 110, 26);
    }

    private static void Caster(ArenaScreen a, Fighter f, Vector2 dir, float dist, float dt)
    {
        if (f.State != "approach") return;
        var want = dist < 190 ? -dir + Tangent(dir, f.Strafe) * 0.5f : dist > 340 ? dir : Tangent(dir, f.Strafe);
        Move(f, want.Normalized(), 1, dt);
        if (a.Rng.Chance(dt * 0.5)) f.Strafe *= -1;
        if (dist < Reach(a, f, 16) && f.MeleeCd <= 0) Melee(a, f, dir, 0.3f, 1.1f, 110, 30);
        else if (f.SkillCd <= 0 && dist < 560) Cast(a, f, f.Skill ?? Bolt, dir);
    }

    private static void Boss(ArenaScreen a, Fighter f, Vector2 dir, float dist, float dt)
    {
        if (f.State != "approach") return;
        var pace = f.Enraged ? 1.25f : 1f;
        if (dist > Reach(a, f, 6)) Move(f, dir, pace, dt);
        if (dist < 160 && f.AttackCd <= 0) Slam(a, f, 150, f.Enraged ? 0.7f : 0.9f, 1.5f, f.Enraged ? 2.2f : 3f);
        else if (f.SkillCd <= 0 && f.Skill != null) Cast(a, f, f.Skill, dir);
        else if (dist < Reach(a, f, 18) && f.MeleeCd <= 0) Melee(a, f, dir, 0.35f, 1.2f, 120, 34);
    }

    // ---------------------------------------------------------------- attacks

    private static void Recover(Fighter f, float attackCd)
    {
        f.State = "recover";
        f.StateTime = 0;
        f.AttackCd = attackCd;
    }

    /// <summary>A telegraphed swipe in front of the enemy.</summary>
    private static void Melee(ArenaScreen a, Fighter f, Vector2 dir, float windup, float mult, float arc, float extra)
    {
        f.State = "melee";
        f.StateTime = 0;
        f.MeleeCd = windup + (f.Enraged ? 0.6f : 0.9f);
        var origin = f.Pos;
        var reach = f.Radius + extra;
        a.AddTelegraph(new Telegraph
        {
            Shape = Telegraph.Shapes.Arc, Pos = origin, Dir = dir, Radius = reach + a.Player.Radius, Arc = arc, Duration = windup, Owner = f,
            Fire = () =>
            {
                a.Slash(origin, dir, arc, reach + a.Player.Radius, Ink.CinnabarDeep);
                if (ArenaMath.InArc(origin, dir, arc, reach, a.Player.Pos, a.Player.Radius))
                    a.HitPlayer(f, mult, DamageKind.Physical, null, null);
                f.State = "approach";
            },
        });
    }

    /// <summary>A ground slam around the enemy itself.</summary>
    private static void Slam(ArenaScreen a, Fighter f, float radius, float windup, float mult, float cooldown)
    {
        f.State = "slam";
        f.StateTime = 0;
        var origin = f.Pos;
        a.AddTelegraph(new Telegraph
        {
            Shape = Telegraph.Shapes.Circle, Pos = origin, Radius = radius, Duration = windup, Owner = f,
            Fire = () =>
            {
                a.Ring(origin, radius, Ink.Ochre);
                a.Shake(7);
                if (a.Player.Pos.DistanceTo(origin) <= radius + a.Player.Radius * 0.5f)
                    a.HitPlayer(f, mult, DamageKind.Physical, null, null);
                Recover(f, cooldown);
            },
        });
    }

    /// <summary>Cast an art: projectiles along an announced line, or circles on the ground.</summary>
    private static void Cast(ArenaScreen a, Fighter f, SkillDef skill, Vector2 dir)
    {
        var c = skill.Cast;
        f.SkillCd = (float)skill.Cooldown * (f.Enraged ? 0.7f : 1f) + (float)a.Rng.NextDouble() * 0.5f;
        var windup = (float)System.Math.Max(0.25, c.Windup);
        var color = skill.Element != null ? Ink.Element(skill.Element.Value) : Ink.Cinnabar;

        if (c.Shape == "aoe_circle")
        {
            var count = System.Math.Max(1, c.Count) + (f.Enraged ? 2 : 0);
            var radius = (float)c.Radius;
            for (var i = 0; i < count; i++)
            {
                var pos = i == 0
                    ? a.Player.Pos
                    : a.Player.Pos + Vector2.Right.Rotated((float)a.Rng.NextDouble() * Mathf.Tau) * (70 + (float)a.Rng.NextDouble() * 110);
                a.AddTelegraph(new Telegraph
                {
                    Shape = Telegraph.Shapes.Circle, Pos = pos, Radius = radius, Duration = windup + i * 0.12f, Owner = f,
                    Fire = () =>
                    {
                        a.Ring(pos, radius, color);
                        if (a.Player.Pos.DistanceTo(pos) > radius + a.Player.Radius * 0.4f) return;
                        a.HitPlayer(f, (float)skill.DamageMultiplier, DamageKind.Spirit, skill.Element, skill);
                        if (a.Player.Invuln <= 0) a.Status(a.Player, ref a.Player.Rooted, 0.8f, "縛");
                    },
                });
            }
            return;
        }

        f.State = "cast";
        f.StateTime = 0;
        f.Facing = dir;
        var origin = f.Pos;
        a.AddTelegraph(new Telegraph
        {
            Shape = Telegraph.Shapes.Line, Pos = origin, Dir = dir, Length = Mathf.Min((float)c.Range, 520), Width = (float)c.Radius * 2 + 6,
            Duration = windup, Owner = f,
            Fire = () =>
            {
                var n = System.Math.Max(1, c.Count);
                for (var i = 0; i < n; i++)
                    a.EnemyShoot(f, skill, dir.Rotated(Mathf.DegToRad((float)c.Spread * (i - (n - 1) / 2f))));
                f.State = "approach";
            },
        });
    }

    /// <summary>Bodies don't overlap each other or the player.</summary>
    private static void Separate(ArenaScreen a, Fighter f)
    {
        foreach (var o in a.Enemies)
        {
            if (o == f || !o.Active) continue;
            var d = f.Pos - o.Pos;
            var min = f.Radius + o.Radius;
            var len = d.Length();
            if (len >= min || len < 0.01f) continue;
            f.Pos += d / len * (min - len) * 0.5f;
        }
        var toPlayer = f.Pos - a.Player.Pos;
        var reach = f.Radius + a.Player.Radius;
        var l = toPlayer.Length();
        if (l < reach && l > 0.01f && f.State != "charge") f.Pos += toPlayer / l * (reach - l);
    }
}
