using System.Linq;
using Godot;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTienLuc.Art;
using TuTienLuc.Audio;
using TuTienLuc.Ui;

namespace TuTienLuc.Field;

/// <summary>
/// Archetype brains (design §7.3), now on open ground with trees and walls. Every attack is announced by
/// a telegraph the player can read and dodge: chargers line up a rush, swarms nip and circle, ranged
/// foes keep their distance and aim, tanks slam around themselves, casters kite and cast, bosses mix all
/// of it and enrage at half health.
/// </summary>
public static class EnemyAi
{
    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    /// <summary>For ranged foes without an authored art.</summary>
    private static readonly SkillDef Bolt = new()
    {
        Id = "yeu_khi", Name = "Yêu Khí", NameEn = "Demonic Qi", Damage = "spirit", DamageMultiplier = 1.0, Cooldown = 2.2,
        Cast = new CastDef { Shape = "projectile", Range = 420, Radius = 10, Speed = 380, Windup = 0.45 },
    };

    public static void Update(Battle b, Fighter f, float dt)
    {
        if (!f.Alive) return;
        b.TickStatus(f, dt);
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

        var p = b.Player;
        var to = p.Pos - f.Pos;
        var dist = to.Length();
        var dir = dist > 0.01f ? to / dist : Vector2.Left;
        if (f.State is "approach" or "recover") f.Face(dir);

        if (f.Archetype is "boss" or "serpent" && !f.Enraged && f.Hp < f.HpMax * 0.5f)
        {
            f.Enraged = true;
            b.F.Fx.Say(f.Pos + new Vector2(0, -Figures.HeightOf(f.Kind) * f.Scale - 36), T("Cuồng nộ!", "Enraged!"), Ink.Cinnabar, 26, 1.4f);
            b.F.Fx.Burst(f.Pos + new Vector2(0, -40), Ink.Cinnabar, 20, 240, ParticleKind.Ember, 3);
            SoundBoard.PlayAt("gong", f.Pos, -6);
            b.F.Shake(8);
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
                    Swarm(b, f, dir, dist, dt);
                    break;
                case "ranged":
                    Ranged(b, f, dir, dist, dt);
                    break;
                case "tank":
                    Tank(b, f, dir, dist, dt);
                    break;
                case "caster":
                    Caster(b, f, dir, dist, dt);
                    break;
                case "boss":
                    Boss(b, f, dir, dist, dt);
                    break;
                case "brute":
                    Brute(b, f, dir, dist, dt);
                    break;
                case "trickster":
                    Trickster(b, f, dir, dist, dt);
                    break;
                case "flier":
                    Flier(b, f, dir, dist, dt);
                    break;
                case "phantom":
                    Phantom(b, f, dir, dist, dt);
                    break;
                case "serpent":
                    Serpent(b, f, dir, dist, dt);
                    break;
                default:
                    Charger(b, f, dir, dist, dt);
                    break;
            }
        }
        Separate(b, f);
    }

    private static float Reach(Battle b, Fighter f, float extra) => f.Radius + b.Player.Radius + extra;

    // ---------------------------------------------------------------- choosing an art

    /// <summary>A cultivator's art (it costs the player Qi), as opposed to a beast's or a template's own.</summary>
    private static bool PlayerArt(SkillDef art) => art.QiCost > 0;

    private static bool Ready(Battle b, Fighter f, SkillDef art) => !f.ArtCds.TryGetValue(art.Id, out var until) || b.Clock >= until;

    /// <summary>
    /// Pick the art that suits the moment from everything the foe knows, weighted, so a fight with a cultivator
    /// never settles into one move: heal when hurt, guard when pressed, dash in from afar, cleave or wave up
    /// close, beams and bolts at range. The art just used is less likely next. Null when nothing fits now.
    /// </summary>
    private static SkillDef? PickArt(Battle b, Fighter f, float dist)
    {
        if (f.Arts.Count == 0) return null;
        var weights = new double[f.Arts.Count];
        double total = 0;
        for (var i = 0; i < f.Arts.Count; i++)
        {
            var art = f.Arts[i];
            if (!Ready(b, f, art)) continue;
            var w = ArtWeight(b, f, art, dist);
            if (art.Id == f.LastArt && f.Arts.Count > 1) w *= 0.35;
            weights[i] = w;
            total += w;
        }
        if (total <= 0) return null;
        var roll = b.Rng.NextDouble() * total;
        for (var i = 0; i < weights.Length; i++)
        {
            roll -= weights[i];
            if (weights[i] > 0 && roll <= 0) return f.Arts[i];
        }
        return null;
    }

    private static double ArtWeight(Battle b, Fighter f, SkillDef art, float dist)
    {
        var c = art.Cast;
        var range = (float)c.Range;
        var health = f.Hp / Mathf.Max(1, f.HpMax);
        return c.Shape switch
        {
            "heal" => health < 0.55f ? 6 : 0,
            "self_buff" => f.Shield > 0 ? 0 : health < 0.85f || dist < 170 ? 2.5 : 0.4,
            "orbit" => b.Orbits.Any(o => o.Owner == f) ? 0 : dist < 230 ? 3 : 0.3,
            "melee_arc" => dist < range + 24 ? 4 : 0,
            "wave" => dist < range * 0.9f ? 3.5 : 0,
            "dash_strike" => dist > 110 && dist < range + 60 ? 3 : 0,
            "wall" => b.Pillars.Count == 0 && dist < 300 ? 1.5 : 0,
            "field" => b.Fires.Any(g => g.Owner == f) ? 0 : dist < range ? 2 : 0,
            "aoe_circle" => dist < range ? 2.5 : 0,
            "beam" => dist < range * 0.95f ? 2.5 : 0,
            "nova" => dist < 320 ? 1 : 0,
            _ => dist < Mathf.Min(range + 60, 560) ? 2 : 0,
        };
    }

    /// <summary>Arts that want the foe close (a cleave, a wave, a ring of leaves) draw a caster in instead of kiting.</summary>
    private static bool WantsClose(Battle b, Fighter f)
    {
        foreach (var art in f.Arts)
            if (art.Cast.Shape is "melee_arc" or "wave" or "orbit" && Ready(b, f, art)) return true;
        return false;
    }

    /// <summary>What a foe casts now: an art that fits, or (with no arts at all) a plain bolt within <paramref name="boltRange"/>.</summary>
    private static SkillDef? NextArt(Battle b, Fighter f, float dist, float boltRange) =>
        PickArt(b, f, dist) ?? (f.Arts.Count == 0 && dist < boltRange ? Bolt : null);

    private static void Move(Battle b, Fighter f, Vector2 dir, float factor, float dt)
    {
        if (f.Speed <= 0) return;
        f.Pos = b.F.Walls.Move(f.Pos, f.Radius, dir * f.Speed * f.SpeedFactor * factor * dt, flying: f.Airborne);
    }

    private static Vector2 Tangent(Vector2 dir, float side) => new Vector2(-dir.Y, dir.X) * side;

    // ---------------------------------------------------------------- archetypes

    private static void Charger(Battle b, Fighter f, Vector2 dir, float dist, float dt)
    {
        switch (f.State)
        {
            case "approach":
                Move(b, f, dir, 1, dt);
                if (dist < Reach(b, f, 12) && f.MeleeCd <= 0)
                {
                    Melee(b, f, dir, 0.3f, 1.0f, 100, 24);
                }
                else if (dist is > 110 and < 270 && f.AttackCd <= 0)
                {
                    f.State = "windup";
                    f.StateTime = 0;
                    f.Dir = dir;
                    f.Face(dir);
                    b.AddTelegraph(new Telegraph
                    {
                        Shape = Telegraph.Shapes.Line, Pos = f.Pos, Dir = dir, Length = 300, Width = f.Radius * 2 + 8,
                        Duration = f.Speed < 140 ? 0.7f : 0.55f, Owner = f,
                        Fire = () =>
                        {
                            f.State = "charge";
                            f.StateTime = 0;
                            SoundBoard.PlayAt("dash", f.Pos, -4);
                        },
                    });
                }
                break;
            case "charge":
            {
                var before = f.Pos;
                Move(b, f, f.Dir, 3.3f, dt);
                if (GD.Randf() < 0.5f) b.F.Fx.Dust(f.Pos, 1);
                var hitWall = f.Pos.DistanceTo(before) < f.Speed * 3.3f * dt * 0.5f;
                if (f.Pos.DistanceTo(b.Player.Pos) < f.Radius + b.Player.Radius + 2)
                {
                    f.AttackAnim = 1;
                    f.AttackDir = f.Dir;
                    b.HitPlayer(f, 1.35f, DamageKind.Physical, null, null);
                    Recover(f, 1.8f);
                }
                else if (f.StateTime > 0.42f || hitWall)
                {
                    if (hitWall) b.F.Shake(3);
                    Recover(f, 1.8f);
                }
                break;
            }
        }
    }

    private static void Swarm(Battle b, Fighter f, Vector2 dir, float dist, float dt)
    {
        if (f.State != "approach") return;
        Vector2 want;
        if (dist > 130) want = dir + Tangent(dir, f.Strafe) * 0.35f;
        else if (dist < 60) want = -dir * 0.6f + Tangent(dir, f.Strafe);
        else want = Tangent(dir, f.Strafe) + dir * (f.MeleeCd <= 0 ? 1.1f : -0.2f);
        Move(b, f, want.Normalized(), 1, dt);
        if (b.Rng.Chance(dt * 0.6)) f.Strafe *= -1;
        if (dist < Reach(b, f, 14) && f.MeleeCd <= 0) Melee(b, f, dir, 0.24f, 1.0f, 90, 20);
    }

    private static void Ranged(Battle b, Fighter f, Vector2 dir, float dist, float dt)
    {
        if (f.State != "approach") return;
        if (f.Speed > 0)
        {
            var want = dist < 230 ? -dir : dist > 420 ? dir : Tangent(dir, f.Strafe) * 0.6f;
            Move(b, f, want, 1, dt);
            if (b.Rng.Chance(dt * 0.4)) f.Strafe *= -1;
            if (dist < Reach(b, f, 10) && f.MeleeCd <= 0)
            {
                Melee(b, f, dir, 0.3f, 0.9f, 100, 20);
                return;
            }
        }
        if (f.SkillCd <= 0 && NextArt(b, f, dist, (float)Bolt.Cast.Range + 80) is { } art) Cast(b, f, art, dir);
    }

    private static void Tank(Battle b, Fighter f, Vector2 dir, float dist, float dt)
    {
        if (f.State != "approach") return;
        if (dist > Reach(b, f, 4)) Move(b, f, dir, 1, dt);
        if (dist < 135 && f.AttackCd <= 0) Slam(b, f, 118, 0.85f, 1.45f, 2.8f);
        else if (dist < Reach(b, f, 14) && f.MeleeCd <= 0) Melee(b, f, dir, 0.4f, 1.1f, 110, 26);
    }

    private static void Caster(Battle b, Fighter f, Vector2 dir, float dist, float dt)
    {
        if (f.State != "approach") return;
        // Kite at range, unless an art ready to use wants the foe close.
        var close = WantsClose(b, f);
        float near = close ? 90 : 190, far = close ? 170 : 340;
        var want = dist < near ? -dir + Tangent(dir, f.Strafe) * 0.5f : dist > far ? dir : Tangent(dir, f.Strafe);
        Move(b, f, want.Normalized(), 1, dt);
        if (b.Rng.Chance(dt * 0.5)) f.Strafe *= -1;
        if (dist < Reach(b, f, 16) && f.MeleeCd <= 0) Melee(b, f, dir, 0.3f, 1.1f, 110, 30);
        else if (f.SkillCd <= 0 && NextArt(b, f, dist, 560) is { } art) Cast(b, f, art, dir);
    }

    private static void Boss(Battle b, Fighter f, Vector2 dir, float dist, float dt)
    {
        if (f.State != "approach") return;
        var pace = f.Enraged ? 1.25f : 1f;
        if (dist > Reach(b, f, 6)) Move(b, f, dir, pace, dt);
        if (dist < 160 && f.AttackCd <= 0) Slam(b, f, 150, f.Enraged ? 0.7f : 0.9f, 1.5f, f.Enraged ? 2.2f : 3f);
        else if (f.SkillCd <= 0 && PickArt(b, f, dist) is { } art) Cast(b, f, art, dir);
        else if (dist < Reach(b, f, 18) && f.MeleeCd <= 0) Melee(b, f, dir, 0.35f, 1.2f, 120, 34);
    }

    /// <summary>Black bear: lumbers in, rears up on its hind legs and crashes down on everything in front.</summary>
    private static void Brute(Battle b, Fighter f, Vector2 dir, float dist, float dt)
    {
        if (f.State != "approach") return;
        if (dist > Reach(b, f, 6)) Move(b, f, dir, 1, dt);
        if (dist < 175 && f.AttackCd <= 0)
        {
            f.State = "rear";
            f.StateTime = 0;
            f.CastAnim = 1;
            f.CastColor = Ink.Ochre;
            var origin = f.Pos;
            var aim = dir;
            SoundBoard.PlayAt("notice", origin, -4, 0.6f);
            b.AddTelegraph(new Telegraph
            {
                Shape = Telegraph.Shapes.Arc, Pos = origin, Dir = aim, Radius = 160, Arc = 150, Duration = f.Enraged ? 0.6f : 0.8f, Owner = f,
                Fire = () =>
                {
                    f.AttackAnim = 1;
                    f.AttackDir = aim;
                    SoundBoard.PlayAt("slam", origin, 2, 0.8f);
                    b.F.Shake(9);
                    b.F.Fx.Dust(origin + aim * 70, 14);
                    b.F.Fx.Slash(origin + new Vector2(0, -16), aim, 150, 160, Ink.Ochre, 0.3f, 1.8f);
                    if (FieldMath.InArc(origin, aim, 150, 160, b.Player.Pos, b.Player.Radius) && b.HitPlayer(f, 1.7f, DamageKind.Physical, null, null) > 0)
                        b.Status(b.Player, ref b.Player.Stun, 0.45f, Game.Instance.T("Choáng!", "Stunned!"));
                    Recover(f, 3.2f);
                },
            });
        }
        else if (dist < Reach(b, f, 14) && f.MeleeCd <= 0)
        {
            Melee(b, f, dir, 0.35f, 1.1f, 120, 28);
        }
    }

    /// <summary>Fire fox: keeps its distance and throws fox-fire; get close and it vanishes in a puff and reappears elsewhere.</summary>
    private static void Trickster(Battle b, Fighter f, Vector2 dir, float dist, float dt)
    {
        if (f.State != "approach") return;
        if (dist < 115 && f.AttackCd <= 0)
        {
            Blink(b, f, dir);
            return;
        }
        var want = dist < 230 ? -dir + Tangent(dir, f.Strafe) * 0.6f : dist > 380 ? dir : Tangent(dir, f.Strafe);
        Move(b, f, want.Normalized(), 1, dt);
        if (b.Rng.Chance(dt * 0.6)) f.Strafe *= -1;
        if (f.SkillCd <= 0 && NextArt(b, f, dist, 520) is { } art) Cast(b, f, art, dir);
        else if (dist < Reach(b, f, 10) && f.MeleeCd <= 0) Melee(b, f, dir, 0.25f, 0.9f, 100, 18);
    }

    private static void Blink(Battle b, Fighter f, Vector2 dir)
    {
        f.AttackCd = 3.4f;
        var from = f.Pos;
        for (var tries = 0; tries < 12; tries++)
        {
            var angle = FieldMath.Angle(-dir) + ((float)b.Rng.NextDouble() - 0.5f) * 2.4f;
            var to = b.Player.Pos + Vector2.Right.Rotated(angle) * (200 + (float)b.Rng.NextDouble() * 70);
            if (!b.F.Walls.Free(to, f.Radius)) continue;
            f.Pos = to;
            break;
        }
        if (f.Pos == from) return;
        SoundBoard.PlayAt("portal", from, -6, 1.5f);
        b.F.Fx.Burst(from + new Vector2(0, -18), new Color("#f08a3a"), 14, 180, ParticleKind.Ember, 3);
        b.F.Fx.Burst(f.Pos + new Vector2(0, -18), new Color("#ffd27a"), 10, 120, ParticleKind.Ember, 3);
        f.Face(b.Player.Pos - f.Pos);
        // It likes to throw fire straight after reappearing.
        f.SkillCd = Mathf.Min(f.SkillCd, 0.35f);
    }

    /// <summary>Blood bat: circles overhead, then swoops through you and drinks what it takes.</summary>
    private static void Flier(Battle b, Fighter f, Vector2 dir, float dist, float dt)
    {
        switch (f.State)
        {
            case "approach":
            {
                var want = dist > 170 ? dir + Tangent(dir, f.Strafe) * 0.6f : Tangent(dir, f.Strafe) + dir * 0.1f;
                Move(b, f, want.Normalized(), 1, dt);
                if (b.Rng.Chance(dt * 0.5)) f.Strafe *= -1;
                if (dist < 250 && f.AttackCd <= 0)
                {
                    f.State = "windup";
                    f.StateTime = 0;
                    f.Dir = dir;
                    b.AddTelegraph(new Telegraph
                    {
                        Shape = Telegraph.Shapes.Line, Pos = f.Pos, Dir = dir, Length = dist + 90, Width = f.Radius * 2 + 8, Duration = 0.4f, Owner = f,
                        Fire = () =>
                        {
                            f.State = "swoop";
                            f.StateTime = 0;
                            f.MeleeCd = 0;
                            SoundBoard.PlayAt("dash", f.Pos, -6, 1.4f);
                        },
                    });
                }
                break;
            }
            case "swoop":
            {
                Move(b, f, f.Dir, 3.4f, dt);
                if (f.MeleeCd <= 0 && f.Pos.DistanceTo(b.Player.Pos) < f.Radius + b.Player.Radius + 6)
                {
                    f.MeleeCd = 1;
                    f.AttackAnim = 1;
                    var taken = b.HitPlayer(f, 1.0f, DamageKind.Physical, null, null);
                    if (taken > 0)
                    {
                        var drink = taken * 0.6f;
                        f.Hp = Mathf.Min(f.HpMax, f.Hp + drink);
                        b.F.Fx.Say(f.Pos + new Vector2(0, -70), $"+{drink:0}", Ink.CinnabarDeep, 16);
                        b.F.Fx.Burst(b.Player.Pos + new Vector2(0, -30), Ink.CinnabarDeep, 6, 90, ParticleKind.Spark, 2);
                    }
                }
                if (f.StateTime > 0.45f) Recover(f, 2.2f);
                break;
            }
        }
    }

    /// <summary>Wraith: drifts through trees, turns to mist (untouchable) and forms again at your side to chill you.</summary>
    private static void Phantom(Battle b, Fighter f, Vector2 dir, float dist, float dt)
    {
        if (f.State == "faded")
        {
            Move(b, f, dir, dist > 120 ? 1.8f : 0.2f, dt);
            if (f.StateTime < 1.4f) return;
            f.State = "approach";
            f.StateTime = 0;
            f.Faded = false;
            f.SkillCd = Mathf.Min(f.SkillCd, 0.3f);
            SoundBoard.PlayAt("portal", f.Pos, -6, 0.7f);
            b.F.Fx.Burst(f.Pos + new Vector2(0, -34), new Color(0.8f, 0.88f, 0.95f, 0.6f), 12, 120, ParticleKind.Mist, 7);
            return;
        }
        if (f.State != "approach") return;
        Move(b, f, dist > 210 ? dir : Tangent(dir, f.Strafe), 1, dt);
        if (b.Rng.Chance(dt * 0.4)) f.Strafe *= -1;
        if (f.AttackCd <= 0 && f.StateTime > 1.5f)
        {
            f.State = "faded";
            f.StateTime = 0;
            f.Faded = true;
            f.AttackCd = 6.5f;
            SoundBoard.PlayAt("dash", f.Pos, -8, 0.6f);
            b.F.Fx.Burst(f.Pos + new Vector2(0, -34), new Color(0.8f, 0.88f, 0.95f, 0.5f), 10, 90, ParticleKind.Mist, 7);
            return;
        }
        if (f.SkillCd <= 0 && NextArt(b, f, dist, 520) is { } art) Cast(b, f, art, dir);
        else if (dist < Reach(b, f, 14) && f.MeleeCd <= 0) Melee(b, f, dir, 0.35f, 1.0f, 110, 24);
    }

    /// <summary>Azure-scale python: lunges down a line, sweeps its tail around behind it, and rains venom.</summary>
    private static void Serpent(Battle b, Fighter f, Vector2 dir, float dist, float dt)
    {
        switch (f.State)
        {
            case "approach":
            {
                var pace = f.Enraged ? 1.25f : 1f;
                if (dist > Reach(b, f, 10)) Move(b, f, dir, pace, dt);
                if (dist < 175 && f.AttackCd <= 0)
                {
                    TailSweep(b, f, dir);
                }
                else if (dist is > 150 and < 430 && f.MeleeCd <= 0)
                {
                    f.State = "windup";
                    f.StateTime = 0;
                    f.Dir = dir;
                    f.MeleeCd = f.Enraged ? 2.6f : 3.6f;
                    b.AddTelegraph(new Telegraph
                    {
                        Shape = Telegraph.Shapes.Line, Pos = f.Pos, Dir = dir, Length = 400, Width = f.Radius * 2 + 12, Duration = f.Enraged ? 0.45f : 0.6f, Owner = f,
                        Fire = () =>
                        {
                            f.State = "lunge";
                            f.StateTime = 0;
                            SoundBoard.PlayAt("dash", f.Pos, 0, 0.6f);
                        },
                    });
                }
                else if (f.SkillCd <= 0 && PickArt(b, f, dist) is { } art)
                {
                    Cast(b, f, art, dir);
                }
                break;
            }
            case "lunge":
            {
                var before = f.Pos;
                Move(b, f, f.Dir, 4.4f, dt);
                if (GD.Randf() < 0.6f) b.F.Fx.Dust(f.Pos, 1);
                var stuck = f.Pos.DistanceTo(before) < f.Speed * 4.4f * dt * 0.5f;
                if (f.Pos.DistanceTo(b.Player.Pos) < f.Radius + b.Player.Radius + 4)
                {
                    f.AttackAnim = 1;
                    f.AttackDir = f.Dir;
                    b.HitPlayer(f, 1.5f, DamageKind.Physical, null, f.Skill);
                    Recover(f, 1.2f);
                }
                else if (f.StateTime > 0.38f || stuck)
                {
                    if (stuck) b.F.Shake(4);
                    Recover(f, 1.2f);
                }
                break;
            }
        }
    }

    private static void TailSweep(Battle b, Fighter f, Vector2 dir)
    {
        f.State = "sweep";
        f.StateTime = 0;
        f.CastAnim = 1;
        f.CastColor = Ink.JadeDeep;
        var origin = f.Pos;
        var back = -dir;
        b.AddTelegraph(new Telegraph
        {
            Shape = Telegraph.Shapes.Arc, Pos = origin, Dir = back, Radius = 200, Arc = 280, Duration = f.Enraged ? 0.65f : 0.85f, Owner = f,
            Fire = () =>
            {
                f.AttackAnim = 1;
                f.AttackDir = back;
                SoundBoard.PlayAt("swing_big", origin, 0, 0.6f);
                b.F.Fx.Slash(origin + new Vector2(0, -14), back, 280, 200, Ink.JadeDeep, 0.35f, 2);
                b.F.Shake(6);
                if (FieldMath.InArc(origin, back, 280, 200, b.Player.Pos, b.Player.Radius)) b.HitPlayer(f, 1.35f, DamageKind.Physical, null, null);
                Recover(f, f.Enraged ? 2.4f : 3.2f);
            },
        });
    }

    // ---------------------------------------------------------------- attacks

    private static void Recover(Fighter f, float attackCd)
    {
        f.State = "recover";
        f.StateTime = 0;
        f.AttackCd = attackCd;
    }

    /// <summary>A telegraphed swipe in front of the enemy.</summary>
    private static void Melee(Battle b, Fighter f, Vector2 dir, float windup, float mult, float arc, float extra)
    {
        f.State = "melee";
        f.StateTime = 0;
        f.MeleeCd = windup + (f.Enraged ? 0.6f : 0.9f);
        var origin = f.Pos;
        var reach = f.Radius + extra;
        b.AddTelegraph(new Telegraph
        {
            Shape = Telegraph.Shapes.Arc, Pos = origin, Dir = dir, Radius = reach + b.Player.Radius, Arc = arc, Duration = windup, Owner = f,
            Fire = () =>
            {
                f.AttackAnim = 1;
                f.AttackDir = dir;
                SoundBoard.PlayAt("swing", origin, -7, 0.8f);
                b.F.Fx.Slash(origin + new Vector2(0, -12), dir, arc, reach + b.Player.Radius, Ink.CinnabarDeep);
                if (FieldMath.InArc(origin, dir, arc, reach, b.Player.Pos, b.Player.Radius))
                    b.HitPlayer(f, mult, DamageKind.Physical, null, null);
                f.State = "approach";
            },
        });
    }

    /// <summary>A ground slam around the enemy itself.</summary>
    private static void Slam(Battle b, Fighter f, float radius, float windup, float mult, float cooldown)
    {
        f.State = "slam";
        f.StateTime = 0;
        f.CastAnim = 1;
        f.CastColor = Ink.Ochre;
        var origin = f.Pos;
        b.AddTelegraph(new Telegraph
        {
            Shape = Telegraph.Shapes.Circle, Pos = origin, Radius = radius, Duration = windup, Owner = f,
            Fire = () =>
            {
                f.AttackAnim = 1;
                SoundBoard.PlayAt("slam", origin);
                b.F.Fx.Ring(origin, radius, Ink.Ochre);
                b.F.Fx.Dust(origin, 10);
                b.F.Shake(7);
                if (b.Player.Pos.DistanceTo(origin) <= radius + b.Player.Radius * 0.5f)
                    b.HitPlayer(f, mult, DamageKind.Physical, null, null);
                Recover(f, cooldown);
            },
        });
    }

    /// <summary>A cultivator's art in a foe's hands hits a little softer than in the player's (foes also have fists and numbers).</summary>
    private const float ArtFactor = 0.75f;

    /// <summary>
    /// Cast an art, announced by a telegraph the player can read and dodge: projectiles along a line, circles
    /// on the ground, a cleave or a wave in an arc, a beam, burning ground, stone pillars round the player,
    /// leaves that orbit, a sword dash, or a guard or a heal on itself.
    /// </summary>
    private static void Cast(Battle b, Fighter f, SkillDef skill, Vector2 dir)
    {
        var c = skill.Cast;
        var many = f.Arts.Count > 1;
        // One art keeps its own rhythm; with several, a short beat between casts and each art waits out its own cooldown.
        f.SkillCd = many
            ? (1.3f + (float)b.Rng.NextDouble() * 0.9f) * (f.Enraged ? 0.75f : 1f)
            : (float)System.Math.Max(skill.Cooldown, 1.4) * (f.Enraged ? 0.7f : 1f) + (float)b.Rng.NextDouble() * 0.5f;
        if (many) f.ArtCds[skill.Id] = b.Clock + (float)System.Math.Max(2.5, skill.Cooldown * (PlayerArt(skill) ? 1.6 : 1.0));
        f.LastArt = skill.Id;
        b.EnemyArtUses[skill.Id] = (b.EnemyArtUses.TryGetValue(skill.Id, out var used) ? used : 0) + 1;

        // A cultivator's quick arts get a longer windup in a foe's hands, so each one can be read.
        var windup = (float)System.Math.Max(PlayerArt(skill) ? 0.45 : 0.25, c.Windup);
        var color = skill.Element != null ? Ink.Element(skill.Element.Value) : Ink.Cinnabar;
        var mult = (float)skill.DamageMultiplier * (PlayerArt(skill) ? ArtFactor : 1f);
        var kind = skill.Damage == "physical" ? DamageKind.Physical : DamageKind.Spirit;
        f.CastAnim = 1;
        f.CastColor = color;

        switch (c.Shape)
        {
            case "melee_arc":
                CastCleave(b, f, skill, dir, windup, color, mult, kind);
                return;
            case "wave":
                CastWave(b, f, skill, dir, windup, color, mult, kind);
                return;
            case "beam":
                CastBeam(b, f, skill, dir, windup, color, mult, kind);
                return;
            case "dash_strike":
                CastDash(b, f, skill, dir, color, mult, kind);
                return;
            case "field":
                CastField(b, f, skill, color, mult, kind);
                return;
            case "wall":
                CastPillars(b, f, skill, color, mult, kind);
                return;
            case "orbit":
                b.Orbits.RemoveAll(o => o.Owner == f && o.Skill.Id == skill.Id);
                b.Orbits.Add(new Orbiter
                {
                    Owner = f, Skill = skill, Mult = mult, Kind = kind, Count = System.Math.Max(1, c.Count), Radius = (float)c.Radius,
                    Duration = (float)System.Math.Max(1, c.Duration), Color = color,
                });
                b.F.Fx.Ring(f.Pos + new Vector2(0, -22), (float)c.Radius, color, 0.4f);
                b.F.Fx.Leaves(f.Pos, color, 8);
                ArtName(b, f, skill, color);
                SoundBoard.PlayAt("cast", f.Pos, -3);
                return;
            case "self_buff":
                f.CastColor = Ink.Jade;
                f.Shield = Mathf.Max((float)(skill.Effects?.Shield ?? 30), f.HpMax * 0.18f);
                f.ShieldTime = (float)System.Math.Max(1, c.Duration);
                b.F.Fx.Ring(f.Pos + new Vector2(0, -24), f.Radius + 26, Ink.Jade, 0.45f);
                ArtName(b, f, skill, Ink.Jade);
                SoundBoard.PlayAt("shield", f.Pos, -4);
                return;
            case "heal":
            {
                f.CastColor = Ink.Jade;
                var heal = f.HpMax * (float)(skill.Effects?.HealPercent ?? 0.2) * 0.8f;
                f.Hp = Mathf.Min(f.HpMax, f.Hp + heal);
                var head = Figures.HeightOf(f.Kind) * f.Scale;
                b.F.Fx.Say(f.Pos + new Vector2(0, -head - 10), $"+{heal:0}", Ink.Jade, 20);
                b.F.Fx.Ring(f.Pos + new Vector2(0, -24), 46, Ink.Jade, 0.4f);
                b.F.Fx.Rise(f.Pos, new Color("#88ad9b"), 10, 20);
                ArtName(b, f, skill, Ink.Jade);
                SoundBoard.PlayAt("heal", f.Pos, -4);
                return;
            }
        }

        if (c.Shape == "aoe_circle")
        {
            var count = System.Math.Max(1, c.Count) + (f.Enraged ? 2 : 0);
            var radius = (float)c.Radius;
            for (var i = 0; i < count; i++)
            {
                var pos = i == 0
                    ? b.Player.Pos
                    : b.Player.Pos + Vector2.Right.Rotated((float)b.Rng.NextDouble() * Mathf.Tau) * (70 + (float)b.Rng.NextDouble() * 110);
                b.AddTelegraph(new Telegraph
                {
                    Shape = Telegraph.Shapes.Circle, Pos = pos, Radius = radius, Duration = windup + i * 0.12f, Owner = f,
                    Fire = () =>
                    {
                        b.F.Fx.Ring(pos, radius, color);
                        Splash(b, pos, skill.Element);
                        // Roots, slows and bleeds come with the art (its effects), through HitPlayer.
                        if (b.Player.Pos.DistanceTo(pos) > radius + b.Player.Radius * 0.4f) return;
                        b.HitPlayer(f, mult, kind, skill.Element, skill);
                    },
                });
            }
            return;
        }

        f.State = "cast";
        f.StateTime = 0;
        f.Face(dir);
        var origin = f.Pos;
        b.AddTelegraph(new Telegraph
        {
            Shape = Telegraph.Shapes.Line, Pos = origin, Dir = dir, Length = Mathf.Min((float)c.Range, 520), Width = (float)c.Radius * 2 + 6,
            Duration = windup, Owner = f,
            Fire = () =>
            {
                var n = System.Math.Max(1, c.Count);
                for (var i = 0; i < n; i++)
                    b.EnemyShoot(f, skill, dir.Rotated(Mathf.DegToRad((float)c.Spread * (i - (n - 1) / 2f))), mult);
                f.State = "approach";
            },
        });
    }

    /// <summary>The art's name floats over the caster, so the player learns what each foe knows.</summary>
    private static void ArtName(Battle b, Fighter f, SkillDef skill, Color color) =>
        b.F.Fx.Say(f.Pos + new Vector2(0, -Figures.HeightOf(f.Kind) * f.Scale - 30), T(skill.Name, skill.NameEn), color.Darkened(0.2f), 16, 0.9f);

    /// <summary>A blade of qi swept through an arc in front (Water Blade): the arc is marked, then cuts.</summary>
    private static void CastCleave(Battle b, Fighter f, SkillDef skill, Vector2 dir, float windup, Color color, float mult, DamageKind kind)
    {
        var c = skill.Cast;
        var range = (float)c.Range + 10;
        var arc = (float)c.Arc;
        f.State = "cast";
        f.StateTime = 0;
        f.Face(dir);
        var origin = f.Pos;
        b.AddTelegraph(new Telegraph
        {
            Shape = Telegraph.Shapes.Arc, Pos = origin, Dir = dir, Radius = range, Arc = arc, Duration = windup, Owner = f,
            Fire = () =>
            {
                f.AttackAnim = 1;
                f.AttackDir = dir;
                b.F.Fx.Slash(origin + new Vector2(0, -22), dir, arc, range, color, 0.3f, 2f);
                SoundBoard.PlayAt("swing", origin, -2);
                if (FieldMath.InArc(origin, dir, arc, range, b.Player.Pos, b.Player.Radius)) b.HitPlayer(f, mult, kind, skill.Element, skill);
                f.State = "approach";
            },
        });
    }

    /// <summary>A rolling wave in a cone (Water Dragon Wave): it throws the player back and slows them.</summary>
    private static void CastWave(Battle b, Fighter f, SkillDef skill, Vector2 dir, float windup, Color color, float mult, DamageKind kind)
    {
        var c = skill.Cast;
        var range = (float)c.Range;
        var arc = (float)c.Arc;
        f.State = "cast";
        f.StateTime = 0;
        f.Face(dir);
        var origin = f.Pos;
        b.AddTelegraph(new Telegraph
        {
            Shape = Telegraph.Shapes.Arc, Pos = origin, Dir = dir, Radius = range, Arc = arc, Duration = windup, Owner = f,
            Fire = () =>
            {
                var at = origin + new Vector2(0, -22);
                b.F.Fx.Slash(at, dir, arc, range, color, 0.35f, 2.2f);
                b.F.Fx.Slash(at, dir, arc * 0.7f, range * 0.7f, color.Lightened(0.3f), 0.3f, 1.4f);
                for (var i = 0; i < 8; i++)
                    b.F.Fx.Burst(origin + dir.Rotated((GD.Randf() - 0.5f) * Mathf.DegToRad(arc)) * range * GD.Randf(), new Color(0.75f, 0.88f, 0.95f, 0.7f), 2, 120, ParticleKind.Mist, 6);
                SoundBoard.PlayAt("swing_big", origin, -2);
                if (FieldMath.InArc(origin, dir, arc, range, b.Player.Pos, b.Player.Radius) && b.HitPlayer(f, mult, kind, skill.Element, skill) > 0)
                {
                    var push = (float)(skill.Effects?.Knockback ?? 0) * 0.6f;
                    if (push > 0) b.Player.Pos = b.F.Walls.Move(b.Player.Pos, b.Player.Radius, dir * push);
                }
                f.State = "approach";
            },
        });
    }

    /// <summary>A line of light (Golden Light Slash): the line is drawn, then it cuts along all of it (walls stop it).</summary>
    private static void CastBeam(Battle b, Fighter f, SkillDef skill, Vector2 dir, float windup, Color color, float mult, DamageKind kind)
    {
        var c = skill.Cast;
        var length = Mathf.Min((float)c.Range, 560);
        var width = (float)c.Radius * 2;
        f.State = "cast";
        f.StateTime = 0;
        f.Face(dir);
        var origin = f.Pos;
        b.AddTelegraph(new Telegraph
        {
            Shape = Telegraph.Shapes.Line, Pos = origin, Dir = dir, Length = length, Width = width + 6, Duration = windup, Owner = f,
            Fire = () =>
            {
                var end = origin;
                for (var d = 0f; d <= length; d += 8)
                {
                    var at = origin + dir * d;
                    if (b.F.Walls.BlocksShot(at, 4)) break;
                    end = at;
                }
                b.F.Fx.Beam(origin + new Vector2(0, -26), end + new Vector2(0, -26), color, width);
                b.F.Fx.Burst(end + new Vector2(0, -26), color.Lightened(0.3f), 10, 180, ParticleKind.Spark, 3);
                SoundBoard.PlayAt("cast", origin, -1);
                if (FieldMath.SegmentDistance(b.Player.Pos, origin, end) <= width / 2 + b.Player.Radius) b.HitPlayer(f, mult, kind, skill.Element, skill);
                f.State = "approach";
            },
        });
    }

    /// <summary>A sword dash (Azure Cloud Sword Art): the path is marked, then the foe flashes along it, cutting through.</summary>
    private static void CastDash(Battle b, Fighter f, SkillDef skill, Vector2 dir, Color color, float mult, DamageKind kind)
    {
        var c = skill.Cast;
        var reach = Mathf.Min((float)c.Range + 40, f.Pos.DistanceTo(b.Player.Pos) + 50);
        var width = (float)c.Radius * 2;
        f.State = "cast";
        f.StateTime = 0;
        f.Face(dir);
        var origin = f.Pos;
        SoundBoard.PlayAt("notice", origin, -6);
        b.AddTelegraph(new Telegraph
        {
            Shape = Telegraph.Shapes.Line, Pos = origin, Dir = dir, Length = reach, Width = width + 10, Duration = 0.5f, Owner = f,
            Fire = () =>
            {
                var end = b.F.Walls.Move(origin, f.Radius, dir * reach);
                f.Pos = end;
                f.AttackAnim = 1;
                f.AttackDir = dir;
                b.F.Fx.Slash(origin + (end - origin) / 2 + new Vector2(0, -24), dir, 40, (end - origin).Length() / 2 + 30, color.A > 0 ? color : Ink.InkColor, 0.25f);
                b.F.Fx.Dust(origin, 6);
                SoundBoard.PlayAt("dash", end, 0);
                if (FieldMath.SegmentDistance(b.Player.Pos, origin, end) <= width / 2 + b.Player.Radius) b.HitPlayer(f, mult, kind, skill.Element, skill);
                f.State = "approach";
            },
        });
    }

    /// <summary>Burning ground (Scorched Earth) where the player stands: the circle is marked, then burns for seconds.</summary>
    private static void CastField(Battle b, Fighter f, SkillDef skill, Color color, float mult, DamageKind kind)
    {
        var c = skill.Cast;
        var at = b.Player.Pos;
        var radius = (float)c.Radius;
        b.AddTelegraph(new Telegraph
        {
            Shape = Telegraph.Shapes.Circle, Pos = at, Radius = radius, Duration = 0.75f, Owner = f,
            Fire = () =>
            {
                b.Fires.Add(new GroundFire
                {
                    Owner = f, Pos = at, Radius = radius, Duration = (float)System.Math.Max(1, c.Duration), Skill = skill, Mult = mult, Kind = kind, Color = color,
                });
                b.F.Fx.Ring(at, radius, color, 0.4f);
                b.F.Fx.Burst(at, new Color("#f5a04a"), 16, 200, ParticleKind.Ember, 3);
                SoundBoard.PlayAt("explode", at, -4);
            },
        });
    }

    /// <summary>Stone pillars rise round the player (Stone Palisade), hemming them in; each spot is marked first.</summary>
    private static void CastPillars(Battle b, Fighter f, SkillDef skill, Color color, float mult, DamageKind kind)
    {
        var c = skill.Cast;
        var center = b.Player.Pos;
        var radius = (float)c.Radius;
        var turn = (float)b.Rng.NextDouble() * Mathf.Tau;
        for (var i = 0; i < 4; i++)
        {
            var at = center + Vector2.Right.Rotated(turn + Mathf.Tau * i / 4) * 80;
            b.AddTelegraph(new Telegraph
            {
                Shape = Telegraph.Shapes.Circle, Pos = at, Radius = radius * 1.4f, Duration = 0.6f + i * 0.06f, Owner = f,
                Fire = () =>
                {
                    if (!b.RaiseEnemyPillar(f, at, radius, (float)System.Math.Max(1, c.Duration), skill, mult, kind)) return;
                    b.F.Shake(3);
                    SoundBoard.PlayAt("slam", at, -4, 1.2f);
                },
            });
        }
        ArtName(b, f, skill, color);
    }

    /// <summary>What an area art throws up where it lands, by its element.</summary>
    private static void Splash(Battle b, Vector2 pos, TuTien.Core.Element? element)
    {
        switch (element)
        {
            case TuTien.Core.Element.Moc:
                b.F.Fx.Leaves(pos, new Color("#5f9356"), 5);
                break;
            case TuTien.Core.Element.Thuy:
                b.F.Fx.Burst(pos, new Color(0.78f, 0.88f, 0.96f, 0.6f), 12, 110, ParticleKind.Mist, 7);
                break;
            case TuTien.Core.Element.Hoa:
                b.F.Fx.Burst(pos, new Color("#f08a3a"), 14, 180, ParticleKind.Ember, 3);
                break;
            default:
                b.F.Fx.Dust(pos, 8);
                break;
        }
    }

    /// <summary>Bodies don't overlap each other or the player, and never end up inside a wall (fliers go over them).</summary>
    private static void Separate(Battle b, Fighter f)
    {
        foreach (var o in b.Enemies)
        {
            if (o == f || !o.Active || !o.InBattle) continue;
            var d = f.Pos - o.Pos;
            var min = f.Radius + o.Radius;
            var len = d.Length();
            if (len >= min || len < 0.01f) continue;
            f.Pos += d / len * (min - len) * 0.5f;
        }
        var toPlayer = f.Pos - b.Player.Pos;
        var reach = f.Radius + b.Player.Radius;
        var l = toPlayer.Length();
        if (l < reach && l > 0.01f && f.State is not ("charge" or "swoop" or "lunge") && !f.Faded) f.Pos += toPlayer / l * (reach - l);
        if (!f.Airborne) f.Pos = b.F.Walls.Resolve(f.Pos, f.Radius);
    }
}
