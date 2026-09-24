using System;
using System.Collections.Generic;
using Godot;
using TuTienLuc.Field;

namespace TuTienLuc.Art;

/// <summary>How a figure is posed this frame.</summary>
public struct Pose
{
    public Facing4 Dir;
    public float Walk;
    public float Move;
    /// <summary>0 = not attacking, otherwise the swing's progress 0..1.</summary>
    public float Attack;
    public Vector2 AttackDir;
    public float Cast;
    public Color CastColor;
    public bool Down;
    public bool Meditate;
    public float Time;
    /// <summary>-1 facing left, 1 facing right (side-view creatures).</summary>
    public float Side;
    public bool Enraged;
    public Vector2 LookAt;
    /// <summary>Height above the ground (riding a flying sword); the shadow stays on the ground.</summary>
    public float Lift;
}

/// <summary>
/// Procedural top-down (¾ view) figures in the ink style: people as chibi puppets with four facings,
/// creatures per species. Origin is at the feet; everything is drawn in unit coordinates under a
/// transform that applies scale and left/right mirroring.
/// </summary>
public static class Figures
{
    private static readonly HashSet<string> HumanEnemies = new() { "bandit_leader", "sect_disciple", "rogue_cultivator" };

    public static bool IsHuman(string kind) => kind == "human" || HumanEnemies.Contains(kind);

    /// <summary>Height of the figure's head above the feet, for bars and name labels.</summary>
    public static float HeightOf(string kind) => kind switch
    {
        "forest_wolf" => 46,
        "wild_boar" => 42,
        "venomous_snake" => 26,
        "spirit_bee" => 44,
        "corrupted_vine" => 64,
        "goblin_scout" => 44,
        "herb_guardian" => 52,
        "elder_herb_guardian" => 64,
        "tree_spirit" => 62,
        "bark_golem" => 70,
        "ancient_tree_guardian" => 120,
        "ancient_tree_spirit" => 128,
        "black_bear" => 58,
        "fire_fox" => 42,
        "blood_bat" => 60,
        "wandering_wraith" => 80,
        "azure_python" => 58,
        _ => 70,
    };

    public static void Draw(CanvasItem canvas, string kind, Look? look, in Pose pose, float scale)
    {
        using var b = Brush.On(canvas);
        Draw(b, kind, look, pose, scale);
    }

    public static void Draw(Brush ci, string kind, Look? look, in Pose pose, float scale)
    {
        if (IsHuman(kind))
        {
            Human(ci, look ?? Look.ForEnemy(kind), pose, scale);
        }
        else
        {
            switch (kind)
            {
                case "forest_wolf": Profile(ci, pose, scale, 20, Wolf); break;
                case "wild_boar": Profile(ci, pose, scale, 22, Boar); break;
                case "venomous_snake": Profile(ci, pose, scale, 20, Snake); break;
                case "spirit_bee": Profile(ci, pose, scale, 10, Bee); break;
                case "goblin_scout": Profile(ci, pose, scale, 12, Imp); break;
                case "corrupted_vine": Front(ci, pose, scale, 18, Vine); break;
                case "herb_guardian": Front(ci, pose, scale, 19, (c, p) => HerbGuardian(c, p, false)); break;
                case "elder_herb_guardian": Front(ci, pose, scale * 1.2f, 20, (c, p) => HerbGuardian(c, p, true)); break;
                case "tree_spirit": Front(ci, pose, scale, 12, TreeSpirit); break;
                case "bark_golem": Front(ci, pose, scale, 24, BarkGolem); break;
                case "ancient_tree_guardian": Front(ci, pose, scale, 34, (c, p) => TreeBoss(c, p, false)); break;
                case "ancient_tree_spirit": Front(ci, pose, scale, 36, (c, p) => TreeBoss(c, p, true)); break;
                case "black_bear": Profile(ci, pose, scale, 26, Bear); break;
                case "fire_fox": Profile(ci, pose, scale, 16, Fox); break;
                case "blood_bat": Front(ci, pose, scale, 9, Bat); break;
                case "wandering_wraith": Front(ci, pose, scale, 12, Wraith); break;
                case "azure_python": Profile(ci, pose, scale, 36, Python); break;
                default: Front(ci, pose, scale, 16, Blob); break;
            }
        }
        ci.DrawSetTransform(Vector2.Zero, 0, Vector2.One);
    }

    private static void Profile(Brush ci, in Pose p, float scale, float shadow, Action<Brush, Pose> body)
    {
        Paint.Shadow(ci, Vector2.Zero, shadow * scale, shadow * 0.32f * scale);
        ci.DrawSetTransform(new Vector2(0, -p.Lift), 0, new Vector2((p.Side < 0 ? -1 : 1) * scale, scale));
        body(ci, p);
    }

    private static void Front(Brush ci, in Pose p, float scale, float shadow, Action<Brush, Pose> body)
    {
        Paint.Shadow(ci, Vector2.Zero, shadow * scale, shadow * 0.32f * scale);
        ci.DrawSetTransform(new Vector2(0, -p.Lift), 0, new Vector2(scale, scale));
        body(ci, p);
    }

    private static float EaseOut(float t) => 1 - (1 - t) * (1 - t);
    private static Vector2 V(float x, float y) => new(x, y);

    // =====================================================================================
    // People
    // =====================================================================================

    public static void Human(Brush ci, Look k, in Pose p, float scale)
    {
        var s = k.Height * scale;
        Paint.Shadow(ci, Vector2.Zero, 13 * scale * k.Bulk, 4.6f * scale, 0.22f);
        var side = p.Dir == Facing4.Left && !p.Meditate ? -1f : 1f;
        ci.DrawSetTransform(new Vector2(0, -p.Lift), 0, new Vector2(side * s, s));
        var rig = new Rig(ci, k, p, side);
        if (p.Meditate) rig.Meditate();
        else if (p.Dir == Facing4.Down) rig.Front();
        else if (p.Dir == Facing4.Up) rig.Back();
        else rig.Profile();
    }

    private sealed class Rig
    {
        private readonly Brush _c;
        private readonly Look _k;
        private readonly Pose _p;
        private readonly float _bob, _kneel, _sw, _arm, _b;
        private readonly Vector2 _attack;
        private readonly Color _robe, _robeDark, _skin, _hair;

        public Rig(Brush c, Look k, Pose p, float side)
        {
            _c = c;
            _k = k;
            _p = p;
            _b = k.Bulk;
            _bob = -Mathf.Abs(Mathf.Sin(p.Walk)) * 1.6f * p.Move;
            _kneel = p.Down ? 8f : 0f;
            _sw = Mathf.Sin(p.Walk) * p.Move;
            _arm = _sw * 0.34f;
            var ad = p.AttackDir.LengthSquared() > 0.01f ? p.AttackDir.Normalized() : Vector2.Down;
            _attack = new Vector2(ad.X * side, ad.Y);
            _robe = k.Robe;
            _robeDark = k.Robe.Darkened(0.16f);
            _skin = k.Skin;
            _hair = k.Hair;
        }

        private bool Armed => _k.Weapon != Weapon.None;
        private bool Swinging => _p.Attack > 0;

        // ------------------------------------------------------------------ pieces

        /// <summary>A wide xianxia sleeve hanging from the shoulder, rotated; returns the hand position.</summary>
        private Vector2 Sleeve(Vector2 shoulder, float angle, bool mirror, Color robe)
        {
            Vector2 T(float x, float y) => shoulder + new Vector2(mirror ? -x : x, y).Rotated(angle);
            Paint.Poly(_c, new[] { T(-3.0f, 0), T(3.2f, 0.5f), T(5.4f, 12.8f), T(2.0f, 16.0f), T(-4.2f, 15.0f), T(-3.6f, 6) }, robe);
            Paint.Stroke(_c, T(2.0f, 16.0f), T(-4.2f, 15.0f), _k.Trim, 2.2f, 0);
            var hand = T(-1.0f, 17.0f);
            Paint.Circle(_c, hand, 2.5f, _skin, 0.7f, 1.2f);
            return hand;
        }

        private float AimAngle(Vector2 d) => Mathf.Atan2(-d.X, d.Y);

        /// <summary>The weapon arm during a swing sweeps through an arc around the aim.</summary>
        private float SwingAngle() => AimAngle(_attack) + Mathf.Lerp(-1.25f, 1.1f, EaseOut(_p.Attack));

        private void Blade(Vector2 hand, float angle)
        {
            var dir = new Vector2(0, 1).Rotated(angle);
            var n = new Vector2(-dir.Y, dir.X);
            switch (_k.Weapon)
            {
                case Weapon.Staff:
                    Paint.Stroke(_c, hand - dir * 14, hand + dir * 32, _k.WeaponColor, 2.6f);
                    break;
                case Weapon.Saber:
                {
                    Paint.Stroke(_c, hand - dir * 3, hand + dir * 2, new Color("#3a2a22"), 2.6f, 0.6f);
                    var tip = hand + dir * 28 + n * 3.5f;
                    Paint.Poly(_c, new[] { hand + dir * 2 - n * 1.2f, hand + dir * 18 - n * 2.2f, tip, hand + dir * 18 + n * 2.6f, hand + dir * 2 + n * 2.2f }, new Color("#dfe4e6"), 0.8f, 1.2f);
                    Paint.Stroke(_c, hand + dir * 2 - n * 3.5f, hand + dir * 2 + n * 3.5f, new Color("#c9a54a"), 1.8f, 0.5f);
                    break;
                }
                case Weapon.Sword:
                    Paint.Stroke(_c, hand - dir * 3, hand + dir * 2, new Color("#3a2a22"), 2.4f, 0.6f);
                    Paint.Poly(_c, new[] { hand + dir * 2 - n * 1.3f, hand + dir * 27 - n * 1.1f, hand + dir * 31, hand + dir * 27 + n * 1.1f, hand + dir * 2 + n * 1.3f }, new Color("#e4e8ea"), 0.8f, 1.1f);
                    Paint.Stroke(_c, hand + dir * 2 - n * 3.8f, hand + dir * 2 + n * 3.8f, new Color("#c9a54a"), 1.8f, 0.5f);
                    break;
            }
        }

        private void CastGlow(Vector2 at)
        {
            if (_p.Cast <= 0) return;
            var pulse = 0.8f + 0.2f * Mathf.Sin(_p.Time * 18);
            _c.DrawCircle(at, 9 * pulse, Paint.A(new Color(_p.CastColor, 0.22f * _p.Cast)));
            _c.DrawCircle(at, 4.5f * pulse, Paint.A(new Color(_p.CastColor, 0.85f * _p.Cast)));
            _c.DrawCircle(at, 2f, Paint.A(new Color(1, 1, 1, 0.9f * _p.Cast)));
        }

        private void Face(float hy, bool female)
        {
            var ink = new Color("#1d1f26");
            if (_p.Down)
            {
                Paint.Line2(_c, V(-6, hy + 3), V(-2.6f, hy + 3.4f), ink, 1.2f);
                Paint.Line2(_c, V(2.6f, hy + 3.4f), V(6, hy + 3), ink, 1.2f);
                return;
            }
            foreach (var x in new[] { -4.3f, 4.3f })
            {
                Paint.Ellipse(_c, V(x, hy + 2.8f), female ? 1.7f : 1.5f, female ? 2.4f : 2.2f, ink, 0, 1, 0, 10);
                _c.DrawCircle(V(x - 0.4f, hy + 1.9f), 0.6f, Paint.A(Colors.White));
                Paint.Line2(_c, V(x * 0.62f, hy - 1.6f), V(x * 1.4f, hy - 1.1f), _hair.Darkened(0.2f), 1.1f);
            }
            _c.DrawCircle(V(-7.4f, hy + 6.2f), 1.9f, Paint.A(new Color(0.91f, 0.55f, 0.52f, 0.3f)));
            _c.DrawCircle(V(7.4f, hy + 6.2f), 1.9f, Paint.A(new Color(0.91f, 0.55f, 0.52f, 0.3f)));
            Paint.Line2(_c, V(-1.3f, hy + 7.4f), V(1.3f, hy + 7.4f), new Color(ink, 0.5f), 0.9f);
        }

        private static List<Vector2> Arc(Vector2 c, float r, float from, float to, int n)
        {
            var pts = new List<Vector2>(n + 1);
            for (var i = 0; i <= n; i++)
            {
                var t = from + (to - from) * i / n;
                pts.Add(c + new Vector2(Mathf.Cos(t), Mathf.Sin(t)) * r);
            }
            return pts;
        }

        private void HatFront(float hy)
        {
            switch (_k.Hat)
            {
                case Headwear.Headband:
                    Paint.Poly(_c, Paint.Taper(V(-13, hy - 5.2f), V(13, hy - 5.2f), 3.2f, 3.2f), _k.HatColor, 0.6f, 1.1f);
                    Paint.Circle(_c, V(0, hy - 5.2f), 1.5f, new Color("#7fc9a0"), 0.6f, 0.8f);
                    break;
                case Headwear.StrawHat:
                    StrawHat(0, hy);
                    break;
                case Headwear.Guan:
                    Paint.Poly(_c, new[] { V(-4, hy - 11.5f), V(4, hy - 11.5f), V(5, hy - 19), V(-5, hy - 19) }, _k.HatColor, 0.8f, 1.1f);
                    Paint.Stroke(_c, V(-8, hy - 16), V(8, hy - 16), new Color("#c9a54a"), 1.4f, 0.5f);
                    break;
            }
        }

        private void StrawHat(float x, float hy)
        {
            var apex = V(x, hy - 20);
            Paint.Poly(_c, new[] { V(x - 22, hy - 6), apex, V(x + 22, hy - 6), V(x, hy - 2.5f) }, _k.HatColor, 0.85f, 1.3f);
            for (var i = -2; i <= 2; i++)
                Paint.Line2(_c, apex, V(x + i * 8.5f, hy - 5 + Mathf.Abs(i) * -0.3f), new Color(Paint.Ink, 0.28f), 0.8f);
        }

        // ------------------------------------------------------------------ front

        public void Front()
        {
            var y0 = -36 + _bob + _kneel;
            var y1 = -8 + _kneel;
            var hy = y0 - 13;
            var ys = y0 + 10;

            // Long hair falls behind the shoulders.
            if (_k.HairStyle is HairStyle.Long or HairStyle.Elder)
                Paint.Poly(_c, new[] { V(-12.5f, hy - 1), V(12.5f, hy - 1), V(13.8f, hy + 17), V(0, hy + 19), V(-13.8f, hy + 17) }, _hair);
            if (_k.HairStyle == HairStyle.Ponytail) Paint.Circle(_c, V(0, hy - 12), 5, _hair);

            if (!_p.Down)
            {
                var liftL = Mathf.Max(0, _sw) * 2.6f;
                var liftR = Mathf.Max(0, -_sw) * 2.6f;
                Paint.Poly(_c, new[] { V(-6.4f, -11), V(-1.6f, -11), V(-1.8f, -liftL), V(-6.2f, -liftL) }, _k.Pants, 0.7f, 1.2f);
                Paint.Poly(_c, new[] { V(1.6f, -11), V(6.4f, -11), V(6.2f, -liftR), V(1.8f, -liftR) }, _k.Pants, 0.7f, 1.2f);
                Paint.Ellipse(_c, V(-4.1f, -liftL), 3.4f, 2, _k.Shoes, 0.6f, 1, 0, 12);
                Paint.Ellipse(_c, V(4.1f, -liftR), 3.4f, 2, _k.Shoes, 0.6f, 1, 0, 12);
            }

            if (_k.Weapon is Weapon.Sword or Weapon.Saber && !Swinging)
            {
                Paint.Stroke(_c, V(7.6f * _b, y0 + 1), V(11.8f, y0 - 12), new Color("#3a2a22"), 2.4f, 0.7f);
                Paint.Stroke(_c, V(8.6f, y0 - 4.2f), V(12.6f, y0 - 2.2f), new Color("#c9a54a"), 1.6f, 0.4f);
            }

            var b = _b;
            Paint.Poly(_c, new[]
            {
                V(-9.5f * b, y0), V(9.5f * b, y0), V(11.2f * b, y0 + 9), V(12.8f * b, y1 - 4), V(13.4f * b, y1),
                V(0, y1 + 1.2f), V(-13.4f * b, y1), V(-12.8f * b, y1 - 4), V(-11.2f * b, y0 + 9),
            }, _robe);
            Paint.Poly(_c, new[] { V(3.5f, y0 + 1), V(9.5f * b, y0), V(11.2f * b, y0 + 9), V(12.8f * b, y1 - 4), V(13.4f * b, y1), V(5.5f, y1 + 0.8f) },
                new Color(0, 0, 0, 0.07f), 0);
            Paint.Poly(_c, new[] { V(-13.4f * b, y1), V(0, y1 + 1.2f), V(13.4f * b, y1), V(13.1f * b, y1 - 2.7f), V(0, y1 - 1.5f), V(-13.1f * b, y1 - 2.7f) }, _k.Trim, 0);

            // Crossed collar over the neck.
            Paint.Poly(_c, new[] { V(-3.4f, y0), V(3.4f, y0), V(0, y0 + 6) }, _skin, 0);
            Paint.Stroke(_c, V(5.8f, y0 + 0.2f), V(-0.8f, y0 + 9.5f), _k.Trim, 2.5f, 0);
            Paint.Stroke(_c, V(-5.8f, y0 + 0.2f), V(1.6f, y0 + 9.5f), _k.Trim, 2.5f, 0);

            Paint.Poly(_c, new[] { V(-11.1f * b, ys), V(11.1f * b, ys), V(11.3f * b, ys + 4), V(-11.3f * b, ys + 4) }, _k.Sash, 0.55f, 1);
            Paint.Poly(_c, new[] { V(3.2f, ys + 3), V(5.2f, ys + 3), V(4.3f, ys + 11), V(2.4f, ys + 10.5f) }, _k.Sash, 0.5f, 1);
            Paint.Circle(_c, V(3.9f, ys + 2), 2.2f, _k.Sash.Lightened(0.1f), 0.6f, 1);

            // Arms: the weapon arm swings through the aim when attacking; both reach out when casting.
            var shoulderL = V(-9.4f * b, y0 + 1.5f);
            var shoulderR = V(9.4f * b, y0 + 1.5f);
            if (_p.Cast > 0 && !Swinging)
            {
                var aim = AimAngle(_attack);
                var hl = Sleeve(shoulderL, aim + 0.35f, true, _robe);
                var hr = Sleeve(shoulderR, aim - 0.35f, false, _robe);
                CastGlow((hl + hr) / 2 + _attack * 5);
            }
            else
            {
                var handL = Sleeve(shoulderL, 0.12f + _arm * 0.5f, true, _robe);
                if (_k.Weapon == Weapon.Staff && !Swinging) Paint.Stroke(_c, handL + V(0, 10), handL + V(0.5f, -34), _k.WeaponColor, 2.6f);
                if (Swinging)
                {
                    var angle = SwingAngle();
                    var hand = Sleeve(shoulderR, angle, false, _robe);
                    Blade(hand, angle);
                }
                else
                {
                    Sleeve(shoulderR, -0.12f + _arm * 0.5f, false, _robe);
                }
            }

            Head(hy, true);
        }

        private void Head(float hy, bool front)
        {
            Paint.Poly(_c, new[] { V(-2.6f, hy + 10), V(2.6f, hy + 10), V(2.4f, hy + 14), V(-2.4f, hy + 14) }, _skin, 0.5f, 1);
            Paint.Ellipse(_c, V(-12.2f, hy + 1.2f), 2.3f, 3.1f, _skin, 0.75f, 1.1f, 0, 12);
            Paint.Ellipse(_c, V(12.2f, hy + 1.2f), 2.3f, 3.1f, _skin, 0.75f, 1.1f, 0, 12);
            Paint.Circle(_c, V(0, hy), 12.6f, _skin);
            Face(hy, _k.Female);

            var h = _k.HairStyle;
            if (h != HairStyle.Bald)
            {
                var cap = Arc(V(0, hy), 13.2f, Mathf.Pi - 0.28f, Mathf.Tau + 0.28f, 12);
                cap.AddRange(new[] { V(9.8f, hy - 0.6f), V(6.6f, hy - 4.4f), V(3.6f, hy - 1.0f), V(0.4f, hy - 4.8f), V(-3.2f, hy - 1.2f), V(-6.6f, hy - 4.2f), V(-9.8f, hy - 0.4f) });
                Paint.Poly(_c, cap.ToArray(), _hair);
            }
            else
            {
                for (var i = 0; i < 6; i++)
                    _c.DrawCircle(V(-3 + (i % 3) * 3, hy - 8 + (i / 3) * 2.6f), 0.8f, Paint.A(new Color("#b0776a")));
            }

            switch (h)
            {
                case HairStyle.Bun:
                    Paint.Circle(_c, V(0, hy - 15.5f), 5.8f, _hair);
                    Paint.Stroke(_c, V(-7, hy - 17), V(6.5f, hy - 13), new Color("#c9a54a"), 1.3f, 0.4f);
                    Paint.Circle(_c, V(6.8f, hy - 12.8f), 1.3f, new Color("#7fc9a0"), 0.5f, 0.8f);
                    break;
                case HairStyle.Topknot:
                    Paint.Circle(_c, V(0, hy - 14.6f), 4.4f, _hair);
                    Paint.Poly(_c, Paint.Taper(V(-4.6f, hy - 11.4f), V(4.6f, hy - 11.4f), 2.4f, 2.4f), _k.Trim, 0.5f, 1);
                    break;
                case HairStyle.TwinBuns:
                    Paint.Circle(_c, V(-8.8f, hy - 10.5f), 4.9f, _hair);
                    Paint.Circle(_c, V(8.8f, hy - 10.5f), 4.9f, _hair);
                    break;
                case HairStyle.Long:
                    Paint.Poly(_c, new[] { V(-12.4f, hy - 1), V(-10.2f, hy - 0.5f), V(-10.8f, hy + 13), V(-13.4f, hy + 12) }, _hair, 0.7f, 1.1f);
                    Paint.Poly(_c, new[] { V(10.2f, hy - 0.5f), V(12.4f, hy - 1), V(13.4f, hy + 12), V(10.8f, hy + 13) }, _hair, 0.7f, 1.1f);
                    break;
                case HairStyle.Elder:
                    Paint.Circle(_c, V(0, hy - 13.5f), 4.2f, _hair);
                    Paint.Line2(_c, V(-2.4f, hy - 1.8f), V(-8.8f, hy + 1.2f), _hair, 1.8f);
                    Paint.Line2(_c, V(2.4f, hy - 1.8f), V(8.8f, hy + 1.2f), _hair, 1.8f);
                    break;
            }
            if (_k.Beard || h == HairStyle.Elder)
            {
                var beard = h == HairStyle.Elder ? _hair : _hair.Lightened(0.05f);
                var len = h == HairStyle.Elder ? 22f : 14f;
                Paint.Poly(_c, new[] { V(-6.5f, hy + 7.2f), V(6.5f, hy + 7.2f), V(3.2f, hy + len * 0.7f), V(0, hy + len), V(-3.2f, hy + len * 0.7f) }, beard, 0.7f, 1.1f);
            }
            if (front) HatFront(hy);
        }

        // ------------------------------------------------------------------ back

        public void Back()
        {
            var y0 = -36 + _bob + _kneel;
            var y1 = -8 + _kneel;
            var hy = y0 - 13;
            var ys = y0 + 10;
            var b = _b;

            if (!_p.Down)
            {
                var liftL = Mathf.Max(0, -_sw) * 2.6f;
                var liftR = Mathf.Max(0, _sw) * 2.6f;
                Paint.Poly(_c, new[] { V(-6.4f, -11), V(-1.6f, -11), V(-1.8f, -liftL), V(-6.2f, -liftL) }, _k.Pants, 0.7f, 1.2f);
                Paint.Poly(_c, new[] { V(1.6f, -11), V(6.4f, -11), V(6.2f, -liftR), V(1.8f, -liftR) }, _k.Pants, 0.7f, 1.2f);
                Paint.Ellipse(_c, V(-4.1f, -liftL), 3.4f, 2, _k.Shoes, 0.6f, 1, 0, 12);
                Paint.Ellipse(_c, V(4.1f, -liftR), 3.4f, 2, _k.Shoes, 0.6f, 1, 0, 12);
            }

            Paint.Poly(_c, new[]
            {
                V(-9.5f * b, y0), V(9.5f * b, y0), V(11.2f * b, y0 + 9), V(12.8f * b, y1 - 4), V(13.4f * b, y1),
                V(0, y1 + 1.2f), V(-13.4f * b, y1), V(-12.8f * b, y1 - 4), V(-11.2f * b, y0 + 9),
            }, _robe);
            Paint.Line2(_c, V(0, y0 + 2), V(0, y1), new Color(0, 0, 0, 0.12f), 1);
            Paint.Poly(_c, new[] { V(-13.4f * b, y1), V(0, y1 + 1.2f), V(13.4f * b, y1), V(13.1f * b, y1 - 2.7f), V(0, y1 - 1.5f), V(-13.1f * b, y1 - 2.7f) }, _k.Trim, 0);
            Paint.Poly(_c, new[] { V(-11.1f * b, ys), V(11.1f * b, ys), V(11.3f * b, ys + 4), V(-11.3f * b, ys + 4) }, _k.Sash, 0.55f, 1);
            Paint.Ellipse(_c, V(-3, ys + 2), 3.2f, 2, _k.Sash.Lightened(0.08f), 0.6f, 1, -0.3f, 12);
            Paint.Ellipse(_c, V(3, ys + 2), 3.2f, 2, _k.Sash.Lightened(0.08f), 0.6f, 1, 0.3f, 12);
            Paint.Poly(_c, new[] { V(-1.2f, ys + 3), V(1.2f, ys + 3), V(1.8f + _sw, ys + 12), V(-0.8f + _sw, ys + 12) }, _k.Sash, 0.5f, 1);

            var shoulderL = V(-9.4f * b, y0 + 1.5f);
            var shoulderR = V(9.4f * b, y0 + 1.5f);
            Sleeve(shoulderL, 0.12f - _arm * 0.5f, true, _robe);
            if (Swinging)
            {
                var angle = SwingAngle();
                var hand = Sleeve(shoulderR, angle, false, _robe);
                Blade(hand, angle);
            }
            else
            {
                var handR = Sleeve(shoulderR, -0.12f - _arm * 0.5f, false, _robe);
                if (_k.Weapon == Weapon.Staff) Paint.Stroke(_c, handR + V(0, 10), handR + V(-0.5f, -34), _k.WeaponColor, 2.6f);
            }

            if (_k.Weapon is Weapon.Sword or Weapon.Saber && !Swinging)
            {
                Paint.Stroke(_c, V(-9, y0 + 22), V(8.5f, y0 - 6), new Color("#3b2a22"), 3.6f);
                Paint.Stroke(_c, V(8.5f, y0 - 6), V(11.6f, y0 - 13), new Color("#5b3d2b"), 2.3f, 0.6f);
                Paint.Stroke(_c, V(6.6f, y0 - 7.8f), V(10.4f, y0 - 4.2f), new Color("#c9a54a"), 1.6f, 0.4f);
            }

            Paint.Poly(_c, new[] { V(-2.6f, hy + 10), V(2.6f, hy + 10), V(2.4f, hy + 14), V(-2.4f, hy + 14) }, _skin, 0.5f, 1);
            Paint.Ellipse(_c, V(-12.2f, hy + 1.2f), 2.3f, 3.1f, _skin, 0.75f, 1.1f, 0, 12);
            Paint.Ellipse(_c, V(12.2f, hy + 1.2f), 2.3f, 3.1f, _skin, 0.75f, 1.1f, 0, 12);
            var h = _k.HairStyle;
            Paint.Circle(_c, V(0, hy - 0.4f), 13.3f, h == HairStyle.Bald ? _skin : _hair);
            switch (h)
            {
                case HairStyle.Long:
                case HairStyle.Elder:
                    Paint.Poly(_c, new[] { V(-12.4f, hy + 2), V(12.4f, hy + 2), V(13.4f, hy + 20), V(0, hy + 22.5f), V(-13.4f, hy + 20) }, _hair);
                    Paint.Line2(_c, V(-5, hy + 6), V(-6, hy + 19), _hair.Darkened(0.2f), 1);
                    Paint.Line2(_c, V(4, hy + 6), V(5, hy + 19), _hair.Darkened(0.2f), 1);
                    if (h == HairStyle.Elder) Paint.Circle(_c, V(0, hy - 13), 4.2f, _hair);
                    break;
                case HairStyle.Ponytail:
                    Paint.Poly(_c, new[] { V(-3, hy - 6), V(3, hy - 6), V(4 + _sw * 2, hy + 18), V(_sw * 2, hy + 24), V(-3 + _sw * 2, hy + 17) }, _hair);
                    break;
                case HairStyle.Bun:
                    Paint.Circle(_c, V(0, hy - 13.5f), 5.8f, _hair);
                    Paint.Stroke(_c, V(-7, hy - 15), V(6.5f, hy - 11), new Color("#c9a54a"), 1.3f, 0.4f);
                    break;
                case HairStyle.Topknot:
                    Paint.Circle(_c, V(0, hy - 13), 4.4f, _hair);
                    Paint.Line2(_c, V(0, hy - 10.5f), V(-4 + _sw * 2, hy + 3), _k.Trim, 1.6f);
                    Paint.Line2(_c, V(0, hy - 10.5f), V(4 + _sw * 2, hy + 2), _k.Trim, 1.6f);
                    break;
                case HairStyle.TwinBuns:
                    Paint.Circle(_c, V(-8.8f, hy - 10), 4.9f, _hair);
                    Paint.Circle(_c, V(8.8f, hy - 10), 4.9f, _hair);
                    break;
            }
            switch (_k.Hat)
            {
                case Headwear.Headband:
                    Paint.Poly(_c, Paint.Taper(V(-13.2f, hy - 5), V(13.2f, hy - 5), 3.2f, 3.2f), _k.HatColor, 0.6f, 1.1f);
                    Paint.Line2(_c, V(0, hy - 4.5f), V(-5 + _sw * 2, hy + 10), _k.HatColor, 1.8f);
                    Paint.Line2(_c, V(0, hy - 4.5f), V(4 + _sw * 2, hy + 11), _k.HatColor, 1.8f);
                    break;
                case Headwear.StrawHat:
                    StrawHat(0, hy);
                    break;
                case Headwear.Guan:
                    Paint.Poly(_c, new[] { V(-4, hy - 11.5f), V(4, hy - 11.5f), V(5, hy - 19), V(-5, hy - 19) }, _k.HatColor, 0.8f, 1.1f);
                    break;
            }
        }

        // ------------------------------------------------------------------ profile (facing +x)

        public void Profile()
        {
            var y0 = -36 + _bob + _kneel;
            var y1 = -8 + _kneel;
            var hy = y0 - 13;
            var ys = y0 + 10;
            var lean = 1.2f * _p.Move;
            var stride = _sw * 4.6f;

            // Back arm, back leg, scabbard — all behind the body.
            if (!Swinging || _p.Cast > 0) Sleeve(V(-1 + lean, y0 + 2), -_arm, false, _robeDark);
            if (!_p.Down)
            {
                var bx = -1.4f - stride * 0.8f;
                Paint.Poly(_c, new[] { V(bx - 2.4f, -11), V(bx + 2.4f, -11), V(bx + 2.2f, 0), V(bx - 2.2f, 0) }, _k.Pants.Darkened(0.15f), 0.7f, 1.2f);
                Paint.Ellipse(_c, V(bx + 1, -0.5f), 3.6f, 1.9f, _k.Shoes, 0.6f, 1, 0, 12);
            }
            if (_k.Weapon is Weapon.Sword or Weapon.Saber && !Swinging)
            {
                Paint.Stroke(_c, V(-8.5f, y0 + 19), V(-4, y0 - 9), new Color("#3b2a22"), 3.4f);
                Paint.Stroke(_c, V(-4, y0 - 9), V(-2.6f, y0 - 15), new Color("#5b3d2b"), 2.3f, 0.6f);
            }
            if (!_p.Down)
            {
                var fx = 1.5f + stride * 0.8f;
                var lift = Mathf.Max(0, _sw) * 2;
                Paint.Poly(_c, new[] { V(fx - 2.4f, -11), V(fx + 2.4f, -11), V(fx + 2.2f, -lift), V(fx - 2.2f, -lift) }, _k.Pants, 0.7f, 1.2f);
                Paint.Ellipse(_c, V(fx + 1.2f, -lift - 0.5f), 3.8f, 1.9f, _k.Shoes, 0.6f, 1, 0, 12);
            }

            Paint.Poly(_c, new[]
            {
                V(-6.8f + lean, y0), V(5.6f + lean, y0), V(7.4f, y0 + 9), V(9.2f, y1 - 4), V(10, y1),
                V(-8.8f, y1), V(-8.4f, y1 - 4), V(-7.8f, y0 + 9),
            }, _robe);
            Paint.Poly(_c, new[] { V(-6.8f + lean, y0), V(-1.5f + lean, y0), V(-2.5f, y1), V(-8.8f, y1), V(-8.4f, y1 - 4), V(-7.8f, y0 + 9) },
                new Color(0, 0, 0, 0.08f), 0);
            Paint.Poly(_c, new[] { V(-8.8f, y1), V(10, y1), V(9.8f, y1 - 2.7f), V(-8.7f, y1 - 2.7f) }, _k.Trim, 0);
            Paint.Stroke(_c, V(3.2f + lean, y0 + 0.5f), V(6.8f, y0 + 8.5f), _k.Trim, 2.4f, 0);
            Paint.Poly(_c, new[] { V(-7.9f, ys), V(7.6f, ys), V(7.7f, ys + 4), V(-8, ys + 4) }, _k.Sash, 0.55f, 1);
            Paint.Poly(_c, Paint.Taper(V(-7.8f, ys + 2), V(-11.5f - _sw * 1.5f, ys + 11), 3, 1.4f), _k.Sash, 0.5f, 1);

            // Long hair lies on the back.
            if (_k.HairStyle is HairStyle.Long or HairStyle.Elder)
                Paint.Poly(_c, new[] { V(-10.5f, hy + 2), V(-4, hy + 4), V(-5.5f, hy + 18), V(-12.5f - _sw, hy + 22), V(-13.5f, hy + 10) }, _hair);

            var shoulder = V(0.8f + lean, y0 + 2);
            if (Swinging)
            {
                var angle = SwingAngle();
                var hand = Sleeve(shoulder, angle, false, _robe);
                Blade(hand, angle);
            }
            else if (_p.Cast > 0)
            {
                var hand = Sleeve(shoulder, AimAngle(_attack), false, _robe);
                CastGlow(hand + _attack * 5);
            }
            else
            {
                var hand = Sleeve(shoulder, _arm, false, _robe);
                if (_k.Weapon == Weapon.Staff) Paint.Stroke(_c, hand + V(0, 10), hand + V(0.5f, -34), _k.WeaponColor, 2.6f);
            }

            var hx = 1.5f;
            Paint.Poly(_c, new[] { V(-1.2f, hy + 10), V(3.4f, hy + 10), V(3.2f, hy + 14), V(-1, hy + 14) }, _skin, 0.5f, 1);
            Paint.Circle(_c, V(hx, hy), 12.6f, _skin);
            var h = _k.HairStyle;
            if (h != HairStyle.Bald)
            {
                var cap = Arc(V(hx, hy), 13.3f, -0.62f, -Mathf.Pi - 1.0f, 14);
                cap.AddRange(new[] { V(-5.2f, hy + 3.5f), V(-1.4f, hy - 3), V(3.6f, hy - 5.2f), V(8.4f, hy - 5.6f), V(11.9f, hy - 3.6f) });
                Paint.Poly(_c, cap.ToArray(), _hair);
            }
            Paint.Ellipse(_c, V(-1.8f, hy + 1.8f), 2.3f, 3.2f, _skin, 0.75f, 1.1f, 0, 12);

            var ink = new Color("#1d1f26");
            if (_p.Down) Paint.Line2(_c, V(6.6f, hy + 3), V(9.6f, hy + 3.4f), ink, 1.2f);
            else
            {
                Paint.Ellipse(_c, V(8.2f, hy + 2.8f), 1.4f, 2.2f, ink, 0, 1, 0, 10);
                _c.DrawCircle(V(7.8f, hy + 1.9f), 0.55f, Paint.A(Colors.White));
                Paint.Line2(_c, V(6, hy - 1.3f), V(9.8f, hy - 1.6f), _hair.Darkened(0.2f), 1.1f);
                _c.DrawCircle(V(9.6f, hy + 6.4f), 1.8f, Paint.A(new Color(0.91f, 0.55f, 0.52f, 0.3f)));
            }

            switch (h)
            {
                case HairStyle.Bun:
                    Paint.Circle(_c, V(-3.2f, hy - 13.5f), 5.8f, _hair);
                    Paint.Stroke(_c, V(-9.5f, hy - 15.5f), V(3, hy - 12), new Color("#c9a54a"), 1.3f, 0.4f);
                    break;
                case HairStyle.Topknot:
                    Paint.Circle(_c, V(-1.5f, hy - 13.8f), 4.3f, _hair);
                    Paint.Poly(_c, Paint.Taper(V(-3, hy - 12.5f), V(-11 - _sw * 2, hy - 8), 2.2f, 1.2f), _k.Trim, 0.5f, 1);
                    break;
                case HairStyle.TwinBuns:
                    Paint.Circle(_c, V(5.5f, hy - 12.5f), 4.6f, _hair);
                    Paint.Circle(_c, V(-4, hy - 11.5f), 4.9f, _hair);
                    break;
                case HairStyle.Ponytail:
                    // A tapered strand (always a simple quad, however far it swings).
                    Paint.Poly(_c, Paint.Taper(V(-10.5f, hy - 5), V(-16 - _sw * 2, hy + 14), 3.4f, 1.4f), _hair);
                    break;
                case HairStyle.Elder:
                    Paint.Circle(_c, V(-2, hy - 13), 4.2f, _hair);
                    break;
                case HairStyle.Bald:
                    for (var i = 0; i < 3; i++) _c.DrawCircle(V(-2 + i * 3, hy - 9), 0.8f, Paint.A(new Color("#b0776a")));
                    break;
            }
            if (_k.Beard || h == HairStyle.Elder)
            {
                var len = h == HairStyle.Elder ? 21f : 13f;
                Paint.Poly(_c, new[] { V(6.5f, hy + 7.5f), V(12.8f, hy + 7), V(9.6f, hy + len), V(5.2f, hy + len * 0.6f) }, _hair, 0.7f, 1.1f);
            }
            switch (_k.Hat)
            {
                case Headwear.Headband:
                    Paint.Poly(_c, Paint.Taper(V(-11.8f, hy - 3.4f), V(13.2f, hy - 5.6f), 3.2f, 3.2f), _k.HatColor, 0.6f, 1.1f);
                    Paint.Line2(_c, V(-11.5f, hy - 3), V(-19 - _sw * 2, hy + 5), _k.HatColor, 1.8f);
                    Paint.Line2(_c, V(-11.5f, hy - 3), V(-18 - _sw, hy + 9), _k.HatColor, 1.8f);
                    break;
                case Headwear.StrawHat:
                    StrawHat(hx, hy);
                    break;
                case Headwear.Guan:
                    Paint.Poly(_c, new[] { V(-5.5f, hy - 11), V(2.5f, hy - 11), V(3.5f, hy - 18.5f), V(-6.5f, hy - 18.5f) }, _k.HatColor, 0.8f, 1.1f);
                    break;
            }
        }

        // ------------------------------------------------------------------ meditation

        public void Meditate()
        {
            var pulse = 0.5f + 0.5f * Mathf.Sin(_p.Time * 2.2f);
            _c.DrawCircle(V(0, -22), 30 + pulse * 4, Paint.A(new Color("#88c9a8") with { A = 0.10f }));
            Paint.Poly(_c, new[] { V(-16, 0), V(16, 0), V(14, -5), V(10, -17), V(-10, -17), V(-14, -5) }, _robe);
            Paint.Ellipse(_c, V(-8.5f, -3.5f), 8, 4, _robeDark, 0.6f, 1.1f);
            Paint.Ellipse(_c, V(8.5f, -3.5f), 8, 4, _robeDark, 0.6f, 1.1f);
            Paint.Poly(_c, new[] { V(-8.5f, -16), V(8.5f, -16), V(7.5f, -30), V(-7.5f, -30) }, _robe);
            Paint.Stroke(_c, V(5, -30), V(-1, -21), _k.Trim, 2.3f, 0);
            Paint.Stroke(_c, V(-5, -30), V(1.5f, -21), _k.Trim, 2.3f, 0);
            Paint.Poly(_c, new[] { V(-8.6f, -19.5f), V(8.6f, -19.5f), V(8.6f, -16.5f), V(-8.6f, -16.5f) }, _k.Sash, 0.5f, 1);
            Paint.Circle(_c, V(-2.6f, -9.5f), 2.4f, _skin, 0.7f, 1);
            Paint.Circle(_c, V(2.6f, -9.5f), 2.4f, _skin, 0.7f, 1);
            _c.DrawCircle(V(0, -11), 4 + pulse * 1.5f, Paint.A(new Color("#9fe0b8") with { A = 0.5f }));
            var hy = -42f;
            Paint.Circle(_c, V(0, hy), 12.4f, _skin);
            var ink = new Color("#1d1f26");
            Paint.Line2(_c, V(-6, hy + 3), V(-2.6f, hy + 3.6f), ink, 1.2f);
            Paint.Line2(_c, V(2.6f, hy + 3.6f), V(6, hy + 3), ink, 1.2f);
            if (_k.HairStyle != HairStyle.Bald)
            {
                var cap = Arc(V(0, hy), 13, Mathf.Pi - 0.28f, Mathf.Tau + 0.28f, 12);
                cap.AddRange(new[] { V(9.8f, hy - 0.6f), V(3.6f, hy - 3), V(-3.2f, hy - 3.2f), V(-9.8f, hy - 0.4f) });
                Paint.Poly(_c, cap.ToArray(), _hair);
                Paint.Circle(_c, V(0, hy - 14.5f), 4.6f, _hair);
            }
        }
    }

    // =====================================================================================
    // Creatures (profile ones face +x; the transform mirrors them)
    // =====================================================================================

    private static void Leg(Brush c, float x, float top, float swing, float width, Color color)
    {
        Paint.Poly(c, new[] { V(x - width / 2, top), V(x + width / 2, top), V(x + width / 2 + swing * 0.6f, 0), V(x - width / 2 + swing * 0.6f, 0) }, color, 0.75f, 1.2f);
        Paint.Ellipse(c, V(x + swing * 0.6f + 0.8f, -0.4f), width * 0.75f, 1.6f, color.Darkened(0.3f), 0.6f, 1, 0, 10);
    }

    private static void Eye(Brush c, Vector2 at, float r, Color iris, bool enraged)
    {
        Paint.Circle(c, at, r, enraged ? new Color("#e0442e") : iris, 0.8f, 1);
        c.DrawCircle(at + V(0.3f, 0), r * 0.45f, Paint.A(new Color("#141414")));
        c.DrawCircle(at + V(-0.3f, -0.4f), r * 0.25f, Paint.A(Colors.White));
    }

    private static void Wolf(Brush c, Pose p)
    {
        var fur = new Color("#7f8c79");
        var dark = new Color("#56604f");
        var sw = Mathf.Sin(p.Walk) * 4.5f * p.Move;
        var lunge = p.Attack > 0 ? Mathf.Sin(p.Attack * Mathf.Pi) * 6 : 0;
        var bob = -Mathf.Abs(Mathf.Sin(p.Walk)) * 1.5f * p.Move;
        var wag = Mathf.Sin(p.Time * 6) * 2.5f;
        Leg(c, -11 + lunge, -15 + bob, -sw, 3.4f, dark);
        Leg(c, 9 + lunge, -15 + bob, sw, 3.4f, dark);
        Paint.Poly(c, new[] { V(-14 + lunge, -25 + bob), V(-22 + lunge, -32 + wag * 0.5f), V(-30 + lunge, -33 + wag), V(-25 + lunge, -26 + wag * 0.6f), V(-15 + lunge, -20 + bob) }, dark);
        var o = V(lunge, bob);
        Paint.Ellipse(c, V(-1, -20) + o, 17, 9, fur);
        Paint.Ellipse(c, V(1, -15.5f) + o, 11, 3.6f, new Color("#c9c7b0"), 0);
        Paint.Ellipse(c, V(-2, -25) + o, 12, 3, dark with { A = 0.55f }, 0);
        Paint.Line2(c, V(-8, -22) + o, V(-3, -17) + o, new Color("#7fb87a"), 1.4f);
        Paint.Line2(c, V(-4, -23) + o, V(1, -18) + o, new Color("#7fb87a"), 1.4f);
        Leg(c, -9 + lunge, -15 + bob, sw, 3.6f, fur);
        Leg(c, 11 + lunge, -15 + bob, -sw, 3.6f, fur);
        Paint.Poly(c, new[] { V(9, -26) + o, V(15, -33) + o, V(19, -25) + o, V(12, -17) + o }, fur, 0);
        Paint.Circle(c, V(16, -29) + o, 7, fur);
        Paint.Poly(c, new[] { V(12, -34) + o, V(13.5f, -42) + o, V(17, -35) + o }, dark);
        Paint.Poly(c, new[] { V(15.5f, -34.5f) + o, V(17.5f, -41) + o, V(19.5f, -34) + o }, fur);
        var jaw = p.Attack > 0 ? 0.35f * Mathf.Sin(p.Attack * Mathf.Pi) : 0;
        Paint.Poly(c, Paint.Rotate(new[] { V(19, -27) + o, V(26, -25.5f) + o, V(25.5f, -23.5f) + o, V(19, -23.5f) + o }, V(19, -26) + o, jaw), new Color("#6d7866"));
        Paint.Poly(c, new[] { V(19, -31.5f) + o, V(27.5f, -28.5f) + o, V(27.5f, -25.6f) + o, V(19.5f, -25.5f) + o }, fur.Lightened(0.12f));
        c.DrawCircle(V(27.2f, -27.9f) + o, 1.6f, Paint.A(Paint.Ink));
        Eye(c, V(18.2f, -30.8f) + o, 1.6f, new Color("#e0b040"), p.Enraged);
    }

    private static void Boar(Brush c, Pose p)
    {
        var fur = new Color("#6d4c3b");
        var dark = new Color("#4a3228");
        var sw = Mathf.Sin(p.Walk) * 3.5f * p.Move;
        var charge = p.Attack > 0 ? Mathf.Sin(p.Attack * Mathf.Pi) * 5 : 0;
        var o = V(charge, -Mathf.Abs(Mathf.Sin(p.Walk)) * 1.2f * p.Move);
        Leg(c, -12 + charge, -12, -sw, 4.6f, dark);
        Leg(c, 10 + charge, -12, sw, 4.6f, dark);
        Paint.Ellipse(c, V(-1, -19) + o, 21, 12.5f, fur);
        Paint.Ellipse(c, V(0, -12.5f) + o, 15, 4, new Color("#8a6a52"), 0);
        var ridge = new List<Vector2>();
        for (var i = 0; i <= 10; i++) ridge.Add(V(-18 + i * 3.2f, -30.5f - (i % 2) * 3) + o);
        c.DrawPolyline(ridge.ToArray(), Paint.A(dark), 2.2f, true);
        Paint.Poly(c, new[] { V(-21, -23) + o, V(-25, -27) + o, V(-23, -21) + o }, dark);
        Leg(c, -9 + charge, -12, sw, 4.8f, fur);
        Leg(c, 12 + charge, -12, -sw, 4.8f, fur);
        Paint.Ellipse(c, V(15, -19) + o, 10, 9, fur);
        Paint.Poly(c, new[] { V(10, -26) + o, V(11.5f, -33) + o, V(15.5f, -26) + o }, dark);
        Paint.Ellipse(c, V(24.5f, -17.5f) + o, 4.6f, 4.2f, new Color("#b98b7a"));
        c.DrawCircle(V(25.8f, -18.5f) + o, 0.9f, Paint.A(Paint.Ink));
        c.DrawCircle(V(25.8f, -16.3f) + o, 0.9f, Paint.A(Paint.Ink));
        Paint.Poly(c, new[] { V(21.5f, -14) + o, V(27.5f, -19.5f) + o, V(24.2f, -12.5f) + o }, new Color("#efe6cc"), 0.8f, 1);
        Eye(c, V(17.5f, -22) + o, 1.4f, new Color("#2a1a14"), p.Enraged);
    }

    private static void Snake(Brush c, Pose p)
    {
        const int n = 14;
        var body = new Color("#4f8a7e");
        var belly = new Color("#c8d6a6");
        var raise = p.Attack > 0 ? 9 * Mathf.Sin(p.Attack * Mathf.Pi) : 0;
        var pts = new Vector2[n];
        var radii = new float[n];
        for (var i = 0; i < n; i++)
        {
            var k = i / (float)(n - 1);
            var wave = Mathf.Sin(p.Time * 7 - i * 0.75f) * 3.2f * (0.4f + 0.6f * p.Move);
            pts[i] = V(-26 + i * 3.9f, -5 + wave * (1 - k * 0.5f) - raise * k * k);
            radii[i] = 2.2f + 3.6f * k;
        }
        for (var i = 0; i < n; i++) Paint.Rim(c, pts[i], radii[i]);
        for (var i = 0; i < n; i++) c.DrawCircle(pts[i], radii[i], Paint.A(body));
        for (var i = 1; i < n; i += 3) c.DrawCircle(pts[i] + V(0, -radii[i] * 0.3f), radii[i] * 0.45f, Paint.A(new Color("#2f5a52")));
        for (var i = 0; i < n; i++) c.DrawCircle(pts[i] + V(0, radii[i] * 0.4f), radii[i] * 0.4f, Paint.A(belly with { A = 0.7f }));
        var head = pts[n - 1] + V(5, -2);
        Paint.Ellipse(c, head, 6.5f, 4.8f, body);
        Eye(c, head + V(2, -1.8f), 1.4f, new Color("#e8d04a"), p.Enraged);
        if (Mathf.Sin(p.Time * 3.1f) > 0.75f || p.Attack > 0)
        {
            Paint.Line2(c, head + V(6, 1), head + V(11, 0), new Color("#c0392b"), 1);
            Paint.Line2(c, head + V(6, 1), head + V(11, 2.6f), new Color("#c0392b"), 1);
        }
    }

    private static void Bee(Brush c, Pose p)
    {
        var h = -24 + Mathf.Sin(p.Time * 5) * 2.2f;
        var flap = 0.35f + 0.65f * Mathf.Abs(Mathf.Sin(p.Time * 28));
        var dart = p.Attack > 0 ? Mathf.Sin(p.Attack * Mathf.Pi) * 7 : 0;
        var o = V(dart, h);
        c.DrawCircle(o, 15, Paint.A(new Color("#9fe0a0") with { A = 0.10f }));
        Paint.Ellipse(c, V(-4, -9) + o, 7, 4 * flap, new Color(1, 1, 1, 0.55f), 0.4f, 1, -0.4f);
        Paint.Ellipse(c, V(-5, 1) + o, 8, 6.5f, new Color("#e2b94c"));
        Paint.Line2(c, V(-7.5f, -4.5f) + o, V(-7.5f, 6) + o, new Color("#2b2420"), 2.2f);
        Paint.Line2(c, V(-3.5f, -5.5f) + o, V(-3.5f, 6.8f) + o, new Color("#2b2420"), 2.2f);
        Paint.Poly(c, new[] { V(-12.5f, 1) + o, V(-17, 2.5f) + o, V(-12, 3.5f) + o }, new Color("#2b2420"), 0.6f, 1);
        Paint.Circle(c, V(3, -1) + o, 5, new Color("#4a3a2c"));
        Paint.Circle(c, V(8.5f, -2) + o, 4.2f, new Color("#2e2620"));
        Paint.Ellipse(c, V(9.8f, -2.5f) + o, 2, 2.4f, new Color("#101010"), 0.5f, 1);
        c.DrawCircle(V(9.3f, -3.4f) + o, 0.6f, Paint.A(Colors.White));
        Paint.Line2(c, V(9, -5.5f) + o, V(12, -11) + o, Paint.Ink, 1);
        Paint.Line2(c, V(10, -5.5f) + o, V(13.5f, -10) + o, Paint.Ink, 1);
        Paint.Ellipse(c, V(1, -8.5f) + o, 7.5f, 4.2f * flap, new Color(1, 1, 1, 0.6f), 0.45f, 1, 0.3f);
    }

    private static void Imp(Brush c, Pose p)
    {
        var skin = new Color("#7f8457");
        var sw = Mathf.Sin(p.Walk) * 3.5f * p.Move;
        var thrust = p.Attack > 0 ? Mathf.Sin(p.Attack * Mathf.Pi) * 7 : 0;
        Leg(c, -3, -9, -sw, 3.2f, skin.Darkened(0.2f));
        Leg(c, 3, -9, sw, 3.2f, skin);
        Paint.Ellipse(c, V(-1, -15), 8, 9.5f, skin);
        Paint.Poly(c, new[] { V(-7, -11), V(6, -11), V(5, -5), V(-6, -5) }, new Color("#6b4f3a"), 0.7f, 1);
        Paint.Stroke(c, V(4 + thrust * 0.5f, -12), V(24 + thrust, -30), new Color("#6b4a32"), 2);
        Paint.Poly(c, new[] { V(23 + thrust, -31), V(29 + thrust, -37), V(26 + thrust, -28) }, new Color("#a09a8a"), 0.8f, 1);
        Paint.Circle(c, V(5 + thrust * 0.4f, -17), 2.6f, skin, 0.7f, 1);
        Paint.Poly(c, new[] { V(-2, -31), V(-12, -41), V(-1, -26) }, skin.Darkened(0.1f));
        Paint.Circle(c, V(4, -29), 8.5f, skin);
        Paint.Poly(c, new[] { V(10, -31), V(15, -28.5f), V(10, -27) }, skin, 0.7f, 1);
        Paint.Poly(c, new[] { V(-3, -35.5f), V(1, -40.5f), V(3, -36.5f), V(6, -41), V(7, -36) }, new Color("#3a3a2a"), 0.6f, 1);
        Eye(c, V(7.5f, -30.5f), 1.6f, new Color("#e84a3a"), true);
    }

    private static void Vine(Brush c, Pose p)
    {
        var stem = new Color("#3e6b3c");
        var look = p.LookAt.LengthSquared() > 0.01f ? p.LookAt.Normalized() : V(0, 1);
        var lash = p.Attack > 0 ? Mathf.Sin(p.Attack * Mathf.Pi) : 0;
        for (var k = 0; k < 4; k++)
        {
            var bx = -9 + k * 6;
            var prev = V(bx, -14);
            var pts = new List<Vector2> { prev };
            for (var s = 1; s <= 9; s++)
            {
                var sway = Mathf.Sin(p.Time * 2.2f + s * 0.55f + k * 1.7f) * s * 1.3f;
                var pt = V(bx + sway + (k - 1.5f) * s * 1.1f, -14 - s * 6.2f) + look * s * s * 0.35f * lash;
                pts.Add(pt);
            }
            for (var i = 0; i < pts.Count; i++) Paint.Rim(c, pts[i], 3.2f - i * 0.25f);
            for (var i = 0; i < pts.Count; i++) c.DrawCircle(pts[i], 3.2f - i * 0.25f, Paint.A(stem));
            for (var i = 2; i < pts.Count - 1; i += 2)
                Paint.Poly(c, new[] { pts[i] + V(1.5f, -1), pts[i] + V(5.5f, -2.5f), pts[i] + V(2, 1.5f) }, new Color("#2c4a2a"), 0.6f, 0.8f);
            Paint.Ellipse(c, pts[^1] + V(0, -3), 3.5f, 5, new Color("#8a4a8a"), 0.7f, 1);
        }
        for (var i = -2; i <= 2; i++) Paint.Line2(c, V(i * 5, -3), V(i * 9, 1), stem.Darkened(0.2f), 2);
        Paint.Ellipse(c, V(0, -11), 17, 11.5f, new Color("#5d4a6e"));
        Paint.Ellipse(c, V(-3, -15), 9, 4, new Color("#7a669a") with { A = 0.6f }, 0);
        Paint.Line2(c, V(-12, -8), V(-5, -15), new Color("#6fa05a"), 1.2f);
        Paint.Line2(c, V(11, -9), V(5, -16), new Color("#6fa05a"), 1.2f);
        Paint.Ellipse(c, V(0, -12), 7, 5, p.Enraged ? new Color("#f07050") : new Color("#d8e27a"));
        Paint.Ellipse(c, V(look.X * 2.6f, -12 + look.Y * 1.6f), 1.6f, 4, new Color("#141414"), 0, 1, 0, 10);
    }

    private static void HerbGuardian(Brush c, Pose p, bool elder)
    {
        var sw = Mathf.Sin(p.Walk) * 2.5f * p.Move;
        var slam = p.Attack > 0 ? Mathf.Sin(p.Attack * Mathf.Pi) : 0;
        Paint.Ellipse(c, V(-7 + sw, -2), 6, 3.5f, new Color("#8f8a7e"));
        Paint.Ellipse(c, V(7 - sw, -2), 6, 3.5f, new Color("#8f8a7e"));
        var blobs = new[] { (V(0, -20), 17f, "#4f7a45"), (V(-9, -24), 10f, "#5f8f53"), (V(9, -25), 10f, "#5f8f53"), (V(-4, -31), 9f, "#7aa866"), (V(5, -33), 8f, "#7aa866") };
        foreach (var (at, r, _) in blobs) Paint.Rim(c, at, r);
        Paint.Rim(c, V(-17, -20 - slam * 10), 6);
        Paint.Rim(c, V(17, -20 - slam * 10), 6);
        foreach (var (at, r, col) in blobs) c.DrawCircle(at, r, Paint.A(new Color(col)));
        c.DrawCircle(V(-17, -20 - slam * 10), 6, Paint.A(new Color("#5f8f53")));
        c.DrawCircle(V(17, -20 - slam * 10), 6, Paint.A(new Color("#5f8f53")));
        for (var i = 0; i < 5; i++)
            Paint.Ellipse(c, V(-10 + i * 5, -16 - (i % 2) * 6), 2.6f, 1.4f, new Color("#9cc48a"), 0, 1, 0.6f + i, 8);
        foreach (var x in new[] { -5.5f, 5.5f })
        {
            c.DrawCircle(V(x, -24), 3.6f, Paint.A(new Color("#d8ffe0") with { A = 0.35f }));
            c.DrawCircle(V(x, -24), 1.8f, Paint.A(p.Enraged ? new Color("#ff8a6a") : new Color("#eaffef")));
        }
        if (elder) Paint.Poly(c, new[] { V(-8, -19), V(8, -19), V(3, -10), V(0, -5), V(-3, -10) }, new Color("#6d8a55"), 0.7f, 1);
        Paint.Line2(c, V(0, -33), V(0, -39), new Color("#3f6b3a"), 1.6f);
        var flowers = elder ? new[] { V(0, -42), V(-8, -38), V(8, -38) } : new[] { V(0, -42) };
        foreach (var f in flowers)
        {
            for (var i = 0; i < 5; i++)
                Paint.Ellipse(c, f + V(0, -4).Rotated(Mathf.Tau * i / 5), 2.6f, 4.2f, new Color("#e28aa0"), 0.6f, 0.8f, Mathf.Tau * i / 5, 10);
            Paint.Circle(c, f, 2.4f, new Color("#f0d060"), 0.5f, 0.8f);
        }
    }

    private static void TreeSpirit(Brush c, Pose p)
    {
        var h = -12 + Mathf.Sin(p.Time * 2.4f) * 3;
        var sway = Mathf.Sin(p.Time * 1.8f) * 3;
        var cast = p.Attack > 0 ? Mathf.Sin(p.Attack * Mathf.Pi) : p.Cast;
        c.DrawCircle(V(0, h - 28), 22, Paint.A(new Color("#9fe0b0") with { A = 0.10f + cast * 0.12f }));
        Paint.Poly(c, new[] { V(-6, h - 16), V(6, h - 16), V(2, h), V(0, h + 10), V(-2, h) }, new Color("#a88a5e"));
        Paint.Ellipse(c, V(0, h - 22), 8, 12, new Color("#8a6a48"));
        Paint.Line2(c, V(-2, h - 30), V(-3, h - 14), new Color("#6b4f36"), 1);
        Paint.Line2(c, V(3, h - 29), V(2, h - 16), new Color("#6b4f36"), 1);
        foreach (var s in new[] { -1f, 1f })
        {
            var tip = V(s * 18, h - 32 + sway * s - cast * 8);
            Paint.Stroke(c, V(s * 7, h - 26), tip, new Color("#7a5c3e"), 2.2f);
            Paint.Stroke(c, tip, tip + V(s * 5, -5), new Color("#7a5c3e"), 1.4f, 0.6f);
            Paint.Ellipse(c, tip + V(s * 2, -3), 3.5f, 2.2f, new Color("#6fa85e"), 0.6f, 1, s * 0.6f, 10);
        }
        var leaves = new[] { V(-8, h - 44), V(8, h - 44), V(0, h - 49), V(-11, h - 37), V(11, h - 37), V(0, h - 42) };
        foreach (var l in leaves) Paint.Rim(c, l, 6);
        Paint.Circle(c, V(0, h - 38), 9, new Color("#b08d62"));
        for (var i = 0; i < leaves.Length; i++)
            if (i != 5) c.DrawCircle(leaves[i], 6, Paint.A(new Color(i % 2 == 0 ? "#6fa85e" : "#4f8a4a")));
        foreach (var x in new[] { -3.5f, 3.5f })
        {
            c.DrawCircle(V(x, h - 37), 2.6f, Paint.A(new Color("#b8ffd0") with { A = 0.4f }));
            c.DrawCircle(V(x, h - 37), 1.3f, Paint.A(p.Enraged ? new Color("#ff8a6a") : new Color("#eafff0")));
        }
    }

    private static void BarkGolem(Brush c, Pose p)
    {
        var bark = new Color("#6e5440");
        var dark = new Color("#4f3a2c");
        var sw = Mathf.Sin(p.Walk) * 2.5f * p.Move;
        var raise = p.Attack > 0 ? Mathf.Sin(p.Attack * Mathf.Pi) * 16 : 0;
        Paint.Poly(c, new[] { V(-13, -14), V(-4, -14), V(-4 + sw, 0), V(-13 + sw, 0) }, dark);
        Paint.Poly(c, new[] { V(4, -14), V(13, -14), V(13 - sw, 0), V(4 - sw, 0) }, dark);
        Paint.Poly(c, new[] { V(-18, -48), V(18, -48), V(21, -30), V(19, -15), V(-19, -15), V(-21, -30) }, bark);
        for (var i = -2; i <= 2; i++) Paint.Line2(c, V(i * 6, -45), V(i * 6.6f, -18), dark with { A = 0.6f }, 1.3f);
        c.DrawCircle(V(-13, -45), 6, Paint.A(new Color("#6d8a55")));
        c.DrawCircle(V(12, -46), 5, Paint.A(new Color("#6d8a55")));
        foreach (var s in new[] { -1f, 1f })
        {
            var shoulder = V(s * 19, -44);
            var fist = V(s * 25, -14 - raise);
            Paint.Poly(c, Paint.Taper(shoulder, fist, 11, 9), bark);
            Paint.Circle(c, fist, 7, new Color("#8f8a7e"));
        }
        Paint.Poly(c, new[] { V(-8, -61), V(8, -61), V(9, -48), V(-9, -48) }, bark.Lightened(0.08f));
        var glow = p.Enraged ? new Color("#ff5a3a") : new Color("#f0a040");
        Paint.Line2(c, V(-5, -55), V(-1.5f, -55), glow, 2.2f);
        Paint.Line2(c, V(1.5f, -55), V(5, -55), glow, 2.2f);
        Paint.Ellipse(c, V(-3, -63), 3, 2, new Color("#6fa85e"), 0.6f, 1, -0.5f, 10);
        Paint.Ellipse(c, V(3, -64), 3, 2, new Color("#6fa85e"), 0.6f, 1, 0.5f, 10);
    }

    private static void TreeBoss(Brush c, Pose p, bool spirit)
    {
        var bark = new Color("#6a4e36");
        var dark = new Color("#4a3526");
        var sway = Mathf.Sin(p.Time * 1.3f) * 3;
        var slam = p.Attack > 0 ? Mathf.Sin(p.Attack * Mathf.Pi) * 14 : 0;
        foreach (var s in new[] { -1f, 1f })
        {
            Paint.Poly(c, new[] { V(s * 10, -8), V(s * 28, 4), V(s * 32, 2), V(s * 16, -12) }, dark);
            Paint.Poly(c, new[] { V(s * 4, -4), V(s * 14, 6), V(s * 18, 5), V(s * 9, -6) }, dark);
        }
        Paint.Poly(c, new[] { V(-17, 0), V(17, 0), V(14, -40), V(11, -64), V(-11, -64), V(-14, -40) }, bark);
        for (var i = -2; i <= 2; i++) Paint.Line2(c, V(i * 5, -60), V(i * 6, -4), dark with { A = 0.55f }, 1.4f);
        c.DrawCircle(V(-9, -20), 5, Paint.A(new Color("#6d8a55")));
        c.DrawCircle(V(10, -30), 4, Paint.A(new Color("#6d8a55")));
        var eyes = p.Enraged ? new Color("#ff4a2e") : spirit ? new Color("#9fffc8") : new Color("#f5b544");
        foreach (var x in new[] { -6f, 6f })
        {
            Paint.Ellipse(c, V(x, -45), 3.8f, 4.8f, new Color("#1a1410"), 0.6f, 1);
            c.DrawCircle(V(x, -44.5f), 3.2f, Paint.A(eyes with { A = 0.35f }));
            c.DrawCircle(V(x, -44.5f), 1.6f, Paint.A(eyes));
        }
        Paint.Ellipse(c, V(0, -31), 6.5f, 4 + slam * 0.15f, new Color("#1a1410"), 0.6f, 1);
        for (var i = -2; i <= 2; i++) Paint.Poly(c, new[] { V(i * 2.4f - 1, -34.5f), V(i * 2.4f + 1, -34.5f), V(i * 2.4f, -32) }, new Color("#e8dcc0"), 0, 1);
        if (spirit)
        {
            c.DrawCircle(V(0, -52), 9, Paint.A(new Color("#9fffc8") with { A = 0.25f }));
            Paint.Circle(c, V(0, -52), 4.5f, new Color("#c8ffe0"), 0.6f, 1);
        }
        foreach (var s in new[] { -1f, 1f })
        {
            var elbow = V(s * 27, -58 + sway * s - slam);
            var hand = V(s * 38, -44 + sway * s - slam * 1.4f);
            Paint.Poly(c, Paint.Taper(V(s * 11, -50), elbow, 9, 6), bark);
            Paint.Poly(c, Paint.Taper(elbow, hand, 6, 3.5f), bark);
            Paint.Rim(c, hand + V(0, -4), 8);
            c.DrawCircle(hand + V(0, -4), 8, Paint.A(new Color("#5e8f55")));
        }
        var crown = new[] { (V(0, -84), 21f), (V(-17, -74), 15f), (V(17, -74), 15f), (V(-8, -98), 13f), (V(10, -96), 13f) };
        foreach (var (at, r) in crown) Paint.Rim(c, at + V(sway * 0.6f, 0), r);
        var greens = new[] { "#4c7a47", "#557f4b", "#557f4b", "#6d9a5e", "#7aa866" };
        for (var i = 0; i < crown.Length; i++) c.DrawCircle(crown[i].Item1 + V(sway * 0.6f, 0), crown[i].Item2, Paint.A(new Color(greens[i])));
        if (spirit)
        {
            for (var i = 0; i < 6; i++)
                c.DrawCircle(V(-18 + i * 7, -84 + (i % 2) * 10), 2.2f, Paint.A(new Color("#f3b0c8")));
            for (var i = 0; i < 3; i++)
            {
                var a = p.Time * 1.4f + i * Mathf.Tau / 3;
                c.DrawCircle(V(Mathf.Cos(a) * 30, -60 + Mathf.Sin(a) * 12), 3, Paint.A(new Color("#b8ffd8") with { A = 0.7f }));
            }
        }
    }

    /// <summary>Black bear (hắc hùng): heavy, with the pale crescent on its chest; rears up to slam.</summary>
    private static void Bear(Brush c, Pose p)
    {
        var fur = new Color("#3a322d");
        var dark = new Color("#241f1c");
        var sw = Mathf.Sin(p.Walk) * 4f * p.Move;
        var rear = Mathf.Clamp(p.Cast, 0, 1) * 18;
        var slam = p.Attack > 0 ? Mathf.Sin(p.Attack * Mathf.Pi) * 9 : 0;
        var bob = -Mathf.Abs(Mathf.Sin(p.Walk)) * 1.4f * p.Move;
        void FrontLeg(float x, float swing, float width, Color color)
        {
            var foot = -rear + (rear > 1 ? 0 : 0);
            Paint.Poly(c, new[] { V(x - width / 2, -16 + bob - rear), V(x + width / 2, -16 + bob - rear), V(x + width / 2 + swing * 0.6f + slam, foot), V(x - width / 2 + swing * 0.6f + slam, foot) }, color, 0.75f, 1.2f);
            Paint.Ellipse(c, V(x + swing * 0.6f + slam + 1, foot - 0.5f), width * 0.8f, 2, color.Darkened(0.3f), 0.6f, 1, 0, 10);
            for (var k = -1; k <= 1; k++) Paint.Line2(c, V(x + swing * 0.6f + slam + 2 + k * 1.6f, foot), V(x + swing * 0.6f + slam + 4 + k * 1.6f, foot + 1.5f), new Color("#e8e0cc"), 0.8f);
        }
        Leg(c, -15, -14 + bob, -sw, 6.5f, dark);
        FrontLeg(11, sw, 6.5f, dark);
        var o = V(slam * 0.5f, bob);
        Paint.Ellipse(c, V(-1, -25 - rear * 0.45f) + o, 25, 15, fur, 0.85f, 1.8f, -rear * 0.018f);
        Paint.Ellipse(c, V(-4, -34 - rear * 0.5f) + o, 16, 4, dark with { A = 0.5f }, 0, 1, -rear * 0.018f);
        Leg(c, -12, -14 + bob, sw, 7, fur);
        FrontLeg(14, -sw, 7, fur);
        var h = V(23, -34 - rear) + o;
        // The pale crescent (nguyệt nha) on the chest, under the head.
        Paint.Poly(c, new[] { h + V(-12, 6), h + V(-7, 12), h + V(-3, 7), h + V(-7, 9.5f) }, new Color("#e8e0cc"), 0.6f, 1);
        Paint.Circle(c, h, 11, fur);
        Paint.Circle(c, h + V(-6, -9), 3.6f, fur);
        Paint.Circle(c, h + V(2, -10), 3.6f, fur);
        Paint.Ellipse(c, h + V(9, 3), 6, 4.5f, new Color("#8a6f58"));
        c.DrawCircle(h + V(14, 2), 1.8f, Paint.A(Paint.Ink));
        var jaw = p.Attack > 0 || rear > 4 ? 1.8f : 0;
        Paint.Line2(c, h + V(6, 6 + jaw), h + V(13, 5 + jaw), new Color(Paint.Ink, 0.7f), 1);
        Eye(c, h + V(4, -2), 1.5f, new Color("#2a1a14"), p.Enraged);
    }

    /// <summary>Fire fox (hỏa hồ): slender, black-socked, two tails tipped with flame.</summary>
    private static void Fox(Brush c, Pose p)
    {
        var fur = new Color("#d8702c");
        var pale = new Color("#f3e3c8");
        var sock = new Color("#3a2418");
        var sw = Mathf.Sin(p.Walk) * 4f * p.Move;
        var pounce = p.Attack > 0 ? Mathf.Sin(p.Attack * Mathf.Pi) * 6 : 0;
        var bob = -Mathf.Abs(Mathf.Sin(p.Walk)) * 1.5f * p.Move;
        var o = V(pounce, bob);
        for (var k = 0; k < 2; k++)
        {
            var sway = Mathf.Sin(p.Time * 3 + k * 1.6f) * 4;
            var root = V(-12, -19) + o;
            var tip = V(-31 - k * 4, -37 + k * 10 + sway) + o;
            Paint.Poly(c, Paint.Taper(root, tip, 6.5f, 3.5f), fur);
            var flick = 1 + 0.25f * Mathf.Sin(p.Time * 14 + k * 2);
            c.DrawCircle(tip, 8 * flick, Paint.A(new Color(1f, 0.55f, 0.15f, 0.3f)));
            Paint.Poly(c, Paint.Blob(tip + V(0, -2), 4.5f * flick, 6.5f * flick, 8, 0.25f, k * 7 + (int)(p.Time * 8) % 9), new Color("#f5a04a"), 0.5f, 1);
            c.DrawCircle(tip + V(0.5f, -1.5f), 2.2f, Paint.A(new Color("#fff0b0")));
        }
        Leg(c, -9, -11 + bob, -sw, 2.8f, sock);
        Leg(c, 9 + pounce, -11 + bob, sw, 2.8f, sock);
        Paint.Ellipse(c, V(0, -16) + o, 14.5f, 6.5f, fur);
        Paint.Ellipse(c, V(4, -12.5f) + o, 9, 2.8f, pale, 0);
        Leg(c, -7, -11 + bob, sw, 3, sock);
        Leg(c, 11 + pounce, -11 + bob, -sw, 3, sock);
        var h = V(15, -23) + o;
        Paint.Poly(c, new[] { h + V(-4, 4), h + V(-2, -5), h + V(6, -6), h + V(15, 0), h + V(6, 3.5f) }, fur);
        Paint.Poly(c, new[] { h + V(3, 1), h + V(15, 0), h + V(6, 4) }, pale, 0.6f, 1);
        c.DrawCircle(h + V(15, -0.3f), 1.3f, Paint.A(Paint.Ink));
        Paint.Poly(c, new[] { h + V(-2, -4), h + V(-1, -14), h + V(3, -5) }, fur);
        Paint.Poly(c, new[] { h + V(2, -5), h + V(5, -14), h + V(8, -5) }, fur);
        Paint.Poly(c, new[] { h + V(-0.5f, -5), h + V(0, -10.5f), h + V(2, -5.5f) }, sock, 0);
        Eye(c, h + V(6, -2.5f), 1.3f, new Color("#f0c040"), p.Enraged);
    }

    /// <summary>Blood bat (huyết bức): a small dark body on wide membrane wings, hovering high.</summary>
    private static void Bat(Brush c, Pose p)
    {
        var h = -42 + Mathf.Sin(p.Time * 4) * 3;
        // 0.35 (wings swept down, nearly edge-on) … 1 (spread high).
        var lift = 0.35f + 0.65f * (0.5f + 0.5f * Mathf.Sin(p.Time * 16));
        var swoop = p.Attack > 0 ? Mathf.Sin(p.Attack * Mathf.Pi) * 8 : 0;
        var o = V(0, h + swoop);
        var membrane = new Color("#3b2230");
        var bone = new Color("#1f1219");
        var body = new Color("#4a2a36");
        // The wing is a simple shape drawn flat, then squashed toward the shoulder line: scaling one axis
        // never makes a polygon cross itself, whatever the flap.
        Vector2[] flat = { V(3, -4), V(16, -16), V(31, -14), V(26, -4), V(20, 1), V(14, -2), V(9, 3), V(3, 2) };
        foreach (var s in new[] { -1f, 1f })
        {
            var pts = new Vector2[flat.Length];
            for (var i = 0; i < flat.Length; i++) pts[i] = o + V(s * flat[i].X, -4 + (flat[i].Y + 4) * lift);
            Paint.Poly(c, pts, membrane, 0.85f, 1.3f);
            Paint.Line2(c, pts[0], pts[1], bone, 1.4f);
            Paint.Line2(c, pts[1], pts[2], bone, 1.1f);
            Paint.Line2(c, pts[1], pts[4], bone, 0.9f);
        }
        Paint.Ellipse(c, o, 6, 8.5f, body);
        Paint.Circle(c, o + V(0, -9), 5.2f, body);
        foreach (var s in new[] { -1f, 1f }) Paint.Poly(c, new[] { o + V(s * 3.5f, -12), o + V(s * 6, -19.5f), o + V(s * 1.2f, -13) }, body, 0.7f, 1);
        var eye = p.Enraged ? new Color("#ff5a3a") : new Color("#e8423a");
        c.DrawCircle(o + V(-2, -9.5f), 1.4f, Paint.A(eye));
        c.DrawCircle(o + V(2, -9.5f), 1.4f, Paint.A(eye));
        foreach (var s in new[] { -1f, 1f }) Paint.Poly(c, new[] { o + V(s * 1.6f, -6), o + V(s * 1.2f, -3.2f), o + V(s * 0.6f, -6) }, new Color("#f0e8e0"), 0, 1);
    }

    /// <summary>Wandering wraith (u hồn): a pale robe fraying into mist, long black hair, a will-o'-wisp circling.</summary>
    private static void Wraith(Brush c, Pose p)
    {
        var h = -10 + Mathf.Sin(p.Time * 2) * 4;
        var sway = Mathf.Sin(p.Time * 1.6f) * 3;
        var robe = new Color(0.84f, 0.89f, 0.95f, 0.88f);
        var shade = new Color(0.64f, 0.72f, 0.82f, 0.85f);
        c.DrawCircle(V(0, h - 40), 32, Paint.A(new Color(0.7f, 0.85f, 1f, 0.1f + p.Cast * 0.14f)));
        var body = new List<Vector2> { V(-9, h - 54), V(9, h - 54), V(15, h - 32) };
        for (var i = 0; i <= 6; i++)
        {
            var x = 15 - i * 5f;
            var wisp = Mathf.Sin(p.Time * 5 + i) * 3;
            body.Add(V(x + sway * (i / 6f), h - 6 + (i % 2) * 8 + wisp));
        }
        body.Add(V(-15, h - 32));
        Paint.Poly(c, body.ToArray(), robe, 0.55f, 1.2f);
        Paint.Line2(c, V(-4, h - 48), V(-6 + sway * 0.5f, h - 14), new Color(shade, 0.8f), 1.2f);
        Paint.Line2(c, V(4, h - 48), V(5 + sway * 0.5f, h - 16), new Color(shade, 0.8f), 1.2f);
        var reach = p.Cast * 8;
        foreach (var s in new[] { -1f, 1f })
        {
            var hand = V(s * (22 + reach), h - 30 + sway * s - reach);
            Paint.Poly(c, Paint.Taper(V(s * 9, h - 48), hand, 5.5f, 3), shade);
            c.DrawCircle(hand, 2.6f, Paint.A(new Color("#eef2f5")));
        }
        Paint.Ellipse(c, V(0, h - 63), 9.5f, 11.5f, new Color("#1c2230"));
        Paint.Poly(c, new[] { V(-9, h - 64), V(-11, h - 44), V(-6, h - 48), V(-7, h - 60) }, new Color("#1c2230"), 0.5f, 1);
        Paint.Poly(c, new[] { V(9, h - 64), V(11, h - 44), V(6, h - 48), V(7, h - 60) }, new Color("#1c2230"), 0.5f, 1);
        Paint.Ellipse(c, V(0, h - 60), 6.5f, 8, new Color("#eef2f5"));
        foreach (var x in new[] { -2.6f, 2.6f })
        {
            Paint.Ellipse(c, V(x, h - 61), 1.6f, 2.2f, new Color("#1a1f2c"), 0, 1, 0, 8);
            c.DrawCircle(V(x, h - 61), 0.8f, Paint.A(p.Enraged ? new Color("#ff8a6a") : new Color("#9fd8ff")));
        }
        Paint.Ellipse(c, V(0, h - 55.5f), 1.4f, 1, new Color("#3a3f4c"), 0, 1, 0, 8);
        var a = p.Time * 1.8f;
        var wispAt = V(Mathf.Cos(a) * 22, h - 40 + Mathf.Sin(a) * 7);
        c.DrawCircle(wispAt, 7, Paint.A(new Color(0.55f, 0.85f, 1f, 0.3f)));
        c.DrawCircle(wispAt, 2.8f, Paint.A(new Color(0.88f, 0.97f, 1f)));
    }

    /// <summary>Azure-scale python (thanh lân mãng): long and thick, horned, with a dorsal ridge; lunges and sweeps.</summary>
    private static void Python(Brush c, Pose p)
    {
        const int n = 22;
        var body = new Color("#3f7f86");
        var dark = new Color("#27575c");
        var belly = new Color("#cfe0c8");
        var strike = p.Attack > 0 ? Mathf.Sin(p.Attack * Mathf.Pi) : 0;
        var coil = Mathf.Clamp(p.Cast, 0, 1);
        var pts = new Vector2[n];
        var radii = new float[n];
        for (var i = 0; i < n; i++)
        {
            var k = i / (float)(n - 1);
            var wave = Mathf.Sin(p.Time * 5 - i * 0.55f) * 6 * (0.35f + 0.65f * p.Move) * (1 - k * 0.6f);
            var tail = coil * Mathf.Sin(p.Time * 9) * 10 * (1 - k) * (1 - k);
            pts[i] = V(-62 + i * 4.3f + strike * 14 * k * k, -9 + wave + tail - (strike * 26 + coil * 8) * k * k * k);
            radii[i] = 3.2f + 8.5f * Mathf.Sin(Mathf.Min(1, k * 1.25f) * Mathf.Pi * 0.5f);
        }
        for (var i = 0; i < n; i++) Paint.Rim(c, pts[i], radii[i]);
        for (var i = 0; i < n; i++) c.DrawCircle(pts[i], radii[i], Paint.A(body));
        for (var i = 2; i < n; i += 2) c.DrawCircle(pts[i] + V(0, -radii[i] * 0.35f), radii[i] * 0.42f, Paint.A(dark));
        for (var i = 0; i < n; i++) c.DrawCircle(pts[i] + V(0, radii[i] * 0.45f), radii[i] * 0.42f, Paint.A(belly with { A = 0.75f }));
        for (var i = 4; i < n - 2; i += 3)
            Paint.Poly(c, new[] { pts[i] + V(-2.2f, -radii[i] + 1), pts[i] + V(0, -radii[i] - 6), pts[i] + V(2.6f, -radii[i] + 1) }, dark, 0.6f, 0.8f);
        var head = pts[n - 1] + V(10, -3);
        var jaw = strike * 0.55f;
        Paint.Poly(c, Paint.Rotate(new[] { head + V(-4, 2), head + V(13, 4), head + V(11, 7.5f), head + V(-3, 6.5f) }, head + V(-4, 3), jaw), new Color("#e8d6b8"));
        Paint.Ellipse(c, head, 13.5f, 8.2f, body);
        Paint.Ellipse(c, head + V(4, 2.8f), 8, 3, belly, 0);
        Paint.Poly(c, new[] { head + V(-6, -6), head + V(-13, -16), head + V(-3, -7) }, new Color("#c8b88a"), 0.7f, 1);
        Paint.Poly(c, new[] { head + V(-1, -7.5f), head + V(-5, -18), head + V(2.5f, -8) }, new Color("#c8b88a"), 0.7f, 1);
        Eye(c, head + V(4, -2.5f), 2.3f, new Color("#f0d040"), p.Enraged);
        if (strike > 0.2f || Mathf.Sin(p.Time * 2.3f) > 0.8f)
        {
            Paint.Line2(c, head + V(13, 3), head + V(21, 1), new Color("#c0392b"), 1.2f);
            Paint.Line2(c, head + V(13, 3), head + V(21, 5), new Color("#c0392b"), 1.2f);
        }
    }

    private static void Blob(Brush c, Pose p)
    {
        var bob = Mathf.Sin(p.Time * 3) * 1.5f;
        Paint.Poly(c, Paint.Blob(V(0, -14 + bob), 14, 12, 12, 0.12f, 7), new Color("#3a3342"));
        Eye(c, V(-4, -17 + bob), 1.8f, new Color("#e84a3a"), true);
        Eye(c, V(4, -17 + bob), 1.8f, new Color("#e84a3a"), true);
    }
}
