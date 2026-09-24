using Godot;
using TuTien.Core;
using TuTienLuc.Field;

namespace TuTienLuc.Art;

/// <summary>Drawing for combat effects: ground warnings, qi projectiles per element, brush slashes, particles.</summary>
public static class FxArt
{
    private static Vector2 V(float x, float y) => new(x, y);

    /// <summary>Which projectile drawing an art uses.</summary>
    public static string ProjectileLook(string? skillId, Element? element) => skillId switch
    {
        "hoa_cau_thuat" => "fire",
        "kim_kiem_khi" => "metal",
        "thanh_moc_cham" => "wood",
        "thanh_van_kiem_vu" => "sword",
        "vine_thorn" => "thorn",
        "snake_spit" => "venom",
        "bandit_blade_qi" => "blade",
        "disciple_sword_qi" => "sword",
        "rogue_qi_bolt" => "bolt",
        "fox_fire" => "fire",
        _ => element switch
        {
            Element.Hoa => "fire",
            Element.Kim => "metal",
            Element.Moc => "wood",
            Element.Thuy => "water",
            Element.Tho => "earth",
            _ => "orb",
        },
    };

    public static void Telegraph(Brush c, Telegraph t)
    {
        var color = t.Tint ?? (t.FromPlayer ? new Color("#4e7f6c") : new Color("#9b2a26"));
        var k = t.Progress;
        switch (t.Shape)
        {
            case Field.Telegraph.Shapes.Circle:
                c.DrawCircle(t.Pos, t.Radius, new Color(color, 0.10f));
                c.DrawCircle(t.Pos, t.Radius * k, new Color(color, 0.20f));
                c.DrawArc(t.Pos, t.Radius, 0, Mathf.Tau, 48, new Color(color, 0.75f), 2, true);
                c.DrawArc(t.Pos, t.Radius * k, 0, Mathf.Tau, 48, new Color(color, 0.45f), 1.2f, true);
                break;
            case Field.Telegraph.Shapes.Line:
            {
                var n = new Vector2(-t.Dir.Y, t.Dir.X) * (t.Width / 2);
                var end = t.Pos + t.Dir * t.Length;
                c.DrawColoredPolygon(new[] { t.Pos + n, end + n, end - n, t.Pos - n }, new Color(color, 0.10f));
                var mid = t.Pos + t.Dir * (t.Length * k);
                c.DrawColoredPolygon(new[] { t.Pos + n, mid + n, mid - n, t.Pos - n }, new Color(color, 0.22f));
                c.DrawPolyline(new[] { t.Pos + n, end + n, end - n, t.Pos - n, t.Pos + n }, new Color(color, 0.7f), 2, true);
                break;
            }
            default:
            {
                var half = Mathf.DegToRad(t.Arc) / 2;
                var angle = FieldMath.Angle(t.Dir);
                c.DrawColoredPolygon(Pie(t.Pos, t.Radius, angle, half), new Color(color, 0.10f));
                c.DrawColoredPolygon(Pie(t.Pos, t.Radius * Mathf.Max(0.05f, k), angle, half), new Color(color, 0.24f));
                c.DrawArc(t.Pos, t.Radius, angle - half, angle + half, 20, new Color(color, 0.75f), 2, true);
                break;
            }
        }
    }

    private static Vector2[] Pie(Vector2 center, float radius, float angle, float half)
    {
        const int steps = 14;
        var pts = new Vector2[steps + 2];
        pts[0] = center;
        for (var i = 0; i <= steps; i++) pts[i + 1] = center + Vector2.Right.Rotated(angle - half + 2 * half * i / steps) * radius;
        return pts;
    }

    public static void Projectile(Brush c, Projectile p)
    {
        var dir = p.Vel.LengthSquared() > 0.01f ? p.Vel.Normalized() : Vector2.Right;
        var n = new Vector2(-dir.Y, dir.X);
        var r = p.Radius;
        var t = p.Age;
        c.DrawColoredPolygon(Paint.EllipsePts(p.Ground, r * 0.9f, r * 0.34f, 12), new Color(0.1f, 0.1f, 0.12f, 0.16f));
        switch (p.Look)
        {
            case "fire":
            {
                c.DrawCircle(p.Pos, r * 2.3f, new Color(1f, 0.55f, 0.2f, 0.18f));
                for (var i = 0; i < 4; i++)
                {
                    var flick = Mathf.Sin(t * 30 + i * 2) * r * 0.3f;
                    var at = p.Pos - dir * (r * (0.7f + i * 0.55f)) + n * flick;
                    c.DrawCircle(at, r * (1 - i * 0.2f), new Color(0.95f, 0.35f + i * 0.08f, 0.12f, 0.55f - i * 0.1f));
                }
                c.DrawCircle(p.Pos, r, new Color("#e8642c"));
                c.DrawCircle(p.Pos + n * 1.5f, r * 0.55f, new Color("#ffd27a"));
                c.DrawCircle(p.Pos, r * 0.25f, new Color(1, 1, 0.9f));
                break;
            }
            case "metal":
            case "sword":
            {
                var col = p.Look == "metal" ? new Color("#e0c060") : new Color("#8fc0e0");
                c.DrawLine(p.Pos - dir * r * 3.2f, p.Pos, new Color(col, 0.3f), r * 0.9f, true);
                var pts = new[] { p.Pos + dir * r * 1.6f, p.Pos + n * r * 0.45f, p.Pos - dir * r * 1.8f, p.Pos - n * r * 0.45f };
                c.DrawColoredPolygon(pts, col);
                c.DrawPolyline(new[] { pts[0], pts[1], pts[2], pts[3], pts[0] }, new Color(Paint.Ink, 0.6f), 1, true);
                c.DrawLine(p.Pos - dir * r * 1.4f, p.Pos + dir * r * 1.2f, new Color(1, 1, 1, 0.85f), 1.2f, true);
                break;
            }
            case "wood":
            case "thorn":
            {
                var col = p.Look == "wood" ? new Color("#7fb86a") : new Color("#3f6b3a");
                c.DrawLine(p.Pos - dir * r * 2.6f, p.Pos, new Color(col, 0.35f), r * 0.6f, true);
                var pts = new[] { p.Pos + dir * r * 1.8f, p.Pos + n * r * 0.35f, p.Pos - dir * r * 1.2f, p.Pos - n * r * 0.35f };
                c.DrawColoredPolygon(pts, col);
                c.DrawPolyline(new[] { pts[0], pts[1], pts[2], pts[3], pts[0] }, new Color(Paint.Ink, 0.6f), 1, true);
                break;
            }
            case "water":
            {
                var arc = new Vector2[9];
                for (var i = 0; i < 9; i++)
                {
                    var a = -0.9f + 1.8f * i / 8;
                    arc[i] = p.Pos + dir.Rotated(a) * r * 1.3f - dir * r * 0.6f;
                }
                c.DrawPolyline(arc, new Color("#6fa0c8"), r * 0.8f, true);
                c.DrawPolyline(arc, new Color(1, 1, 1, 0.6f), r * 0.25f, true);
                break;
            }
            case "earth":
            {
                var pts = Paint.Rotate(Paint.Blob(p.Pos, r, r * 0.85f, 7, 0.2f, 3), p.Pos, t * 8);
                c.DrawColoredPolygon(pts, new Color("#8a6a48"));
                c.DrawPolyline(Paint.Closed(pts), new Color(Paint.Ink, 0.7f), 1.2f, true);
                break;
            }
            case "venom":
                c.DrawCircle(p.Pos, r * 1.6f, new Color(0.4f, 0.8f, 0.6f, 0.18f));
                c.DrawCircle(p.Pos, r, new Color("#5aa88a"));
                c.DrawCircle(p.Pos - dir * r * 1.4f, r * 0.45f, new Color("#5aa88a"));
                c.DrawCircle(p.Pos + n * r * 0.3f, r * 0.35f, new Color(1, 1, 1, 0.6f));
                break;
            case "blade":
            {
                var arc = new Vector2[9];
                for (var i = 0; i < 9; i++) arc[i] = p.Pos + dir.Rotated(-1.1f + 2.2f * i / 8) * r * 1.4f - dir * r;
                c.DrawPolyline(arc, new Color("#c8ccd0"), r * 0.7f, true);
                c.DrawPolyline(arc, new Color(1, 1, 1, 0.8f), r * 0.2f, true);
                break;
            }
            default:
            {
                var col = p.Color;
                c.DrawCircle(p.Pos, r * 2, new Color(col, 0.18f));
                c.DrawLine(p.Pos - dir * r * 2.2f, p.Pos, new Color(col, 0.35f), r * 1.2f, true);
                c.DrawCircle(p.Pos, r, col);
                c.DrawCircle(p.Pos, r * 0.45f, new Color(1, 1, 1, 0.75f));
                break;
            }
        }
    }

    /// <summary>Burning ground: a scorched patch with a ring of flame licking at its edge.</summary>
    public static void GroundFire(Brush c, GroundFire g)
    {
        var fade = Mathf.Clamp(g.Time / 0.2f, 0, 1) * Mathf.Clamp((g.Duration - g.Time) / 0.5f, 0, 1);
        c.DrawCircle(g.Pos, g.Radius, new Color(0.35f, 0.12f, 0.06f, 0.28f * fade));
        c.DrawCircle(g.Pos, g.Radius * 0.7f, new Color(0.9f, 0.4f, 0.12f, 0.16f * fade));
        const int tongues = 14;
        for (var i = 0; i < tongues; i++)
        {
            var a = Mathf.Tau * i / tongues + g.Time * 0.6f;
            var flick = 0.6f + 0.4f * Mathf.Sin(g.Time * 11 + i * 1.7f);
            var at = g.Pos + Vector2.Right.Rotated(a) * g.Radius * 0.92f;
            var tip = at + new Vector2(0, -18 * flick);
            c.DrawColoredPolygon(new[] { at + new Vector2(-6, 0), tip, at + new Vector2(6, 0) }, new Color(0.95f, 0.45f + 0.2f * flick, 0.15f, 0.7f * fade));
        }
        c.DrawArc(g.Pos, g.Radius, 0, Mathf.Tau, 48, new Color(0.75f, 0.25f, 0.1f, 0.6f * fade), 2, true);
    }

    /// <summary>An orbit art: leaves (or blades) wheeling round the caster.</summary>
    public static void Orbit(Brush c, Orbiter o)
    {
        var fade = Mathf.Clamp(o.Time / 0.25f, 0, 1) * Mathf.Clamp((o.Duration - o.Time) / 0.4f, 0, 1);
        var centre = o.Owner.Pos + new Vector2(0, -22);
        var leaf = o.Color.Lightened(0.15f);
        c.DrawArc(centre, o.Radius, 0, Mathf.Tau, 48, new Color(o.Color, 0.12f * fade), 10, true);
        for (var i = 0; i < o.Count; i++)
        {
            var angle = o.Angle + Mathf.Tau * i / o.Count;
            // A wake along the circle behind each leaf (the ring turns clockwise), so the whirl reads at a glance.
            c.DrawArc(centre, o.Radius, angle - 0.6f, angle, 8, new Color(leaf, 0.35f * fade), 5, true);
            var at = o.At(i);
            var heading = angle + Mathf.Pi / 2;
            c.DrawCircle(at, 15, new Color(o.Color, 0.18f * fade));
            c.DrawColoredPolygon(Paint.EllipsePts(at, 15, 6, 12, heading), new Color(leaf, 0.95f * fade));
            c.DrawLine(at - Vector2.Right.Rotated(heading) * 14, at + Vector2.Right.Rotated(heading) * 14, new Color(o.Color.Darkened(0.45f), 0.85f * fade), 1.4f, true);
        }
    }

    /// <summary>A brush-stroke crescent (slash) or an expanding ring (burst).</summary>
    public static void Swoosh(Brush c, Swoosh s)
    {
        var k = s.Life / s.MaxLife;
        if (s.Ring)
        {
            c.DrawArc(s.Pos, s.Radius * (1.05f - 0.35f * k), 0, Mathf.Tau, 48, new Color(s.Color, 0.7f * k), 3 + 5 * k, true);
            return;
        }
        if (s.Beam)
        {
            c.DrawLine(s.Pos, s.End, new Color(s.Color, 0.22f * k), s.Width * (1.6f + k), true);
            c.DrawLine(s.Pos, s.End, new Color(s.Color, 0.85f * k), s.Width * (0.35f + 0.65f * k), true);
            c.DrawLine(s.Pos, s.End, new Color(1, 1, 0.94f, 0.95f * k), Mathf.Max(1.5f, s.Width * 0.25f * k), true);
            return;
        }
        var half = Mathf.DegToRad(s.Arc) / 2;
        var sweep = 1 - k;
        var a0 = s.Angle - half;
        var a1 = s.Angle - half + 2 * half * Mathf.Min(1, 0.35f + sweep * 1.6f);
        const int n = 18;
        var outer = new Vector2[n + 1];
        var inner = new Vector2[n + 1];
        for (var i = 0; i <= n; i++)
        {
            var t = i / (float)n;
            var a = Mathf.Lerp(a0, a1, t);
            var thick = Mathf.Sin(t * Mathf.Pi) * 0.3f * s.Width;
            outer[i] = s.Pos + Vector2.Right.Rotated(a) * s.Radius;
            inner[i] = s.Pos + Vector2.Right.Rotated(a) * s.Radius * (1 - thick);
        }
        var poly = new Vector2[(n + 1) * 2];
        for (var i = 0; i <= n; i++)
        {
            poly[i] = outer[i];
            poly[poly.Length - 1 - i] = inner[i];
        }
        c.DrawColoredPolygon(poly, new Color(s.Color, 0.55f * k + 0.1f));
        c.DrawPolyline(outer, new Color(1, 1, 1, 0.7f * k), 1.6f, true);
    }

    public static void Particle(Brush c, Particle p)
    {
        var k = Mathf.Clamp(p.Life / p.MaxLife, 0, 1);
        switch (p.Kind)
        {
            case ParticleKind.Leaf:
                c.DrawColoredPolygon(Paint.EllipsePts(p.Pos, p.Size, p.Size * 0.45f, 8, p.Angle), new Color(p.Color, k));
                break;
            case ParticleKind.Ember:
                c.DrawCircle(p.Pos, p.Size * 2.2f, new Color(p.Color, 0.15f * k));
                c.DrawCircle(p.Pos, p.Size, new Color(p.Color, k));
                break;
            case ParticleKind.Mist:
                c.DrawCircle(p.Pos, p.Size * (1.5f - k * 0.5f), new Color(p.Color, p.Color.A * k));
                break;
            case ParticleKind.Ink:
                c.DrawCircle(p.Pos, p.Size * (0.6f + 0.4f * k), new Color(p.Color, p.Color.A * k));
                break;
            case ParticleKind.Spark:
                c.DrawCircle(p.Pos, p.Size * 1.8f, new Color(p.Color, 0.18f * k));
                c.DrawCircle(p.Pos, p.Size * k + 0.5f, new Color(p.Color, k));
                break;
            default:
                c.DrawCircle(p.Pos, p.Size, new Color(p.Color, k));
                break;
        }
    }

    public static void Floater(Brush c, Floater f)
    {
        var alpha = Mathf.Clamp(f.Life / f.MaxLife * 1.6f, 0, 1);
        Paint.Alpha = alpha;
        Paint.Label(c, f.Text, f.Pos, f.Size, f.Color, Ui.Ink.Serif, 5);
        Paint.Alpha = 1;
    }
}
