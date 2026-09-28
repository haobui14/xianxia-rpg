using System;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;

namespace TuTienLuc.Art;

/// <summary>Every picture the game shows in place of a written sign. There are no Chinese characters in the game.</summary>
public enum IconKind
{
    None,
    // The interface.
    Person, Bag, Book, Map, Lotus, Eye, Moon, Menu, Gear, Key, Wrench, House, Gate, Portal, Crystal, Spring, Herb,
    Star, Grave, Ascend, Crack, Flag, BrokenSword, Gourd, Divider,
    // Actions.
    Sword, Dash, Hand, FlyingSword, Land, Pause, Pill, Ultimate,
    // Spirit arts, by how they are cast.
    Slash, Orb, Needles, Burst, DashStrike, Beam, Shield, Heal, Orbit, Wave, Field, Wall, Summon,
    // The five elements.
    Metal, Wood, Water, Fire, Earth,
    // Conditions on a fighter.
    Stun, Slow, Chain, Blood, ArmorBreak, Blind,
    // The field and the trials.
    Paw, Core, Turbid, DemonEyes,
    // Things to do on the map.
    Fish, Pickaxe, Shrine, Tent, Cauldron,
}

/// <summary>
/// Draws the <see cref="IconKind"/> pictures in code, in the same ink style as everything else: one colour
/// (with a darker or lighter shade of it for detail), fitted to a square <c>size</c> across.
/// </summary>
public static class Icons
{
    public static IconKind ForElement(Element e) => e switch
    {
        Element.Kim => IconKind.Metal,
        Element.Moc => IconKind.Wood,
        Element.Thuy => IconKind.Water,
        Element.Hoa => IconKind.Fire,
        _ => IconKind.Earth,
    };

    /// <summary>A spirit art's picture follows how it is cast; its element gives the colour.</summary>
    public static IconKind ForSkill(SkillDef skill) => skill.Cast.Shape switch
    {
        "melee_arc" => IconKind.Slash,
        "projectile" => skill.Cast.Count >= 3 ? IconKind.Needles : IconKind.Orb,
        "aoe_circle" => IconKind.Burst,
        "dash_strike" => IconKind.DashStrike,
        "beam" => IconKind.Beam,
        "self_buff" => IconKind.Shield,
        "heal" => IconKind.Heal,
        "summon" => IconKind.Summon,
        "orbit" => IconKind.Orbit,
        "wave" => IconKind.Wave,
        "field" => IconKind.Field,
        "wall" => IconKind.Wall,
        "nova" => IconKind.Ultimate,
        _ => IconKind.Burst,
    };

    /// <summary>The picture a map marker or place names (content and the rules speak in these words).</summary>
    public static IconKind Named(string? name) => name switch
    {
        "town" => IconKind.House,
        "sect" or "pass" => IconKind.Gate,
        "realm" => IconKind.Portal,
        "vein" => IconKind.Crystal,
        "spring" => IconKind.Spring,
        "herb" => IconKind.Herb,
        "fish" => IconKind.Fish,
        "ore" => IconKind.Pickaxe,
        "shrine" => IconKind.Shrine,
        "camp" => IconKind.Tent,
        "alchemy" => IconKind.Cauldron,
        "beast" => IconKind.Paw,
        "adventure" => IconKind.Star,
        "elder" or "deacon" or "rival" or "demonic" or "disciple" or "person" => IconKind.Person,
        _ => IconKind.Star,
    };

    /// <summary>An icon on a canvas item that draws without a brush: the icon is one batch of its own.</summary>
    public static void Draw(CanvasItem canvas, IconKind icon, Vector2 centre, float size, Color color)
    {
        if (icon == IconKind.None || size < 2) return;
        using var b = Brush.On(canvas);
        Draw(b, icon, centre, size, color);
    }

    public static void Draw(Brush ci, IconKind icon, Vector2 centre, float size, Color color)
    {
        if (icon == IconKind.None || size < 2) return;
        var p = new Pen(ci, centre, size, color);
        switch (icon)
        {
            // ---------------------------------------------------------------- the interface
            case IconKind.Person:
                p.Disc(0, -0.5f, 0.3f);
                p.Fill(Dome(p, 0, 0.9f, 0.72f, 0.78f));
                break;
            case IconKind.Bag:
                p.Ellipse(0, 0.28f, 0.72f, 0.62f);
                p.Fill(p.P(-0.22f, -0.26f), p.P(0.22f, -0.26f), p.P(0.42f, -0.62f), p.P(0.18f, -0.5f), p.P(0, -0.68f), p.P(-0.18f, -0.5f), p.P(-0.42f, -0.62f));
                p.ShadeLine(-0.3f, -0.3f, 0.3f, -0.3f, 1.1f);
                break;
            case IconKind.Book:
                p.Fill(p.P(-0.9f, -0.52f), p.P(-0.06f, -0.38f), p.P(-0.06f, 0.72f), p.P(-0.9f, 0.56f));
                p.Fill(p.P(0.06f, -0.38f), p.P(0.9f, -0.52f), p.P(0.9f, 0.56f), p.P(0.06f, 0.72f));
                for (var i = 0; i < 3; i++)
                {
                    var y = -0.2f + i * 0.26f;
                    p.ShadeLine(-0.74f, y, -0.22f, y + 0.08f, 0.7f);
                    p.ShadeLine(0.22f, y + 0.08f, 0.74f, y, 0.7f);
                }
                break;
            case IconKind.Map:
                p.Outline(1, p.P(-0.88f, -0.62f), p.P(-0.3f, -0.82f), p.P(0.3f, -0.62f), p.P(0.88f, -0.82f), p.P(0.88f, 0.62f), p.P(0.3f, 0.82f), p.P(-0.3f, 0.62f), p.P(-0.88f, 0.82f));
                p.Fill(p.P(-0.3f, -0.82f), p.P(0.3f, -0.62f), p.P(0.3f, 0.82f), p.P(-0.3f, 0.62f));
                p.Disc(-0.6f, 0.2f, 0.09f);
                p.Disc(0.6f, -0.25f, 0.09f);
                break;
            case IconKind.Lotus:
                p.Ellipse(-0.58f, 0.2f, 0.15f, 0.4f, -62);
                p.Ellipse(0.58f, 0.2f, 0.15f, 0.4f, 62);
                p.Ellipse(-0.3f, -0.08f, 0.18f, 0.5f, -32);
                p.Ellipse(0.3f, -0.08f, 0.18f, 0.5f, 32);
                p.Ellipse(0, -0.22f, 0.2f, 0.58f);
                p.Line(-0.72f, 0.62f, 0.72f, 0.62f, 1.1f);
                break;
            case IconKind.Eye:
                p.Outline(1.1f, Almond(p, 0.92f, 0.55f));
                p.Disc(0, 0, 0.3f);
                p.ShadeDisc(0, 0, 0.12f);
                break;
            case IconKind.Moon:
            {
                const int n = 16;
                var pts = new Vector2[n + 1 + n - 1];
                var k = 0;
                for (var i = 0; i <= n; i++)
                {
                    var a = Mathf.Pi / 2 + Mathf.Pi * i / n;
                    pts[k++] = p.P(0.86f * Mathf.Cos(a) + 0.18f, 0.86f * Mathf.Sin(a));
                }
                for (var i = n - 1; i >= 1; i--)
                {
                    var a = Mathf.Pi / 2 + Mathf.Pi * i / n;
                    pts[k++] = p.P(0.12f * Mathf.Cos(a) + 0.18f, 0.86f * Mathf.Sin(a));
                }
                p.Fill(pts);
                break;
            }
            case IconKind.Menu:
                for (var i = -1; i <= 1; i++) p.Line(-0.72f, i * 0.48f, 0.72f, i * 0.48f, 1.4f);
                break;
            case IconKind.Gear:
                p.Ring(0, 0, 0.5f, 2.2f);
                for (var i = 0; i < 8; i++)
                {
                    var a = Mathf.Tau * i / 8;
                    var r = new Vector2(Mathf.Cos(a), Mathf.Sin(a));
                    var t = new Vector2(-r.Y, r.X);
                    p.Fill(p.U(r * 0.58f + t * 0.14f), p.U(r * 0.92f + t * 0.1f), p.U(r * 0.92f - t * 0.1f), p.U(r * 0.58f - t * 0.14f));
                }
                break;
            case IconKind.Key:
                p.Outline(1.2f, p.P(-0.66f, -0.82f), p.P(0.66f, -0.82f), p.P(0.84f, -0.64f), p.P(0.84f, 0.64f), p.P(0.66f, 0.82f), p.P(-0.66f, 0.82f), p.P(-0.84f, 0.64f), p.P(-0.84f, -0.64f));
                p.Outline(1, p.P(-0.5f, -0.6f), p.P(0.5f, -0.6f), p.P(0.5f, 0.3f), p.P(-0.5f, 0.3f));
                p.Line(-0.22f, -0.15f, 0.22f, -0.15f, 1);
                break;
            case IconKind.Wrench:
                p.Line(-0.66f, 0.66f, 0.16f, -0.16f, 2);
                p.Arc(0.38f, -0.38f, 0.3f, 0, 270, 1.8f);
                break;
            case IconKind.House:
                p.Fill(p.P(-0.95f, -0.12f), p.P(-0.62f, -0.44f), p.P(0, -0.84f), p.P(0.62f, -0.44f), p.P(0.95f, -0.12f), p.P(0.62f, -0.2f), p.P(-0.62f, -0.2f));
                p.Outline(1.1f, p.P(-0.58f, -0.2f), p.P(0.58f, -0.2f), p.P(0.58f, 0.82f), p.P(-0.58f, 0.82f));
                p.Fill(p.P(-0.18f, 0.28f), p.P(0.18f, 0.28f), p.P(0.18f, 0.82f), p.P(-0.18f, 0.82f));
                break;
            case IconKind.Gate:
                p.Line(-0.55f, -0.5f, -0.55f, 0.86f, 1.5f);
                p.Line(0.55f, -0.5f, 0.55f, 0.86f, 1.5f);
                p.Fill(p.P(-0.96f, -0.6f), p.P(-0.72f, -0.8f), p.P(0.72f, -0.8f), p.P(0.96f, -0.6f), p.P(0.72f, -0.54f), p.P(-0.72f, -0.54f));
                p.Line(-0.74f, -0.24f, 0.74f, -0.24f, 1.3f);
                p.Fill(p.P(-0.16f, -0.54f), p.P(0.16f, -0.54f), p.P(0.16f, -0.26f), p.P(-0.16f, -0.26f));
                break;
            case IconKind.Portal:
                p.Open(1.25f, Spiral(p, 0.08f, 0.9f, 3.3f, 40));
                break;
            case IconKind.Crystal:
                Shard(p, -0.46f, 0.26f, 0.15f, 0.5f, -22);
                Shard(p, 0.46f, 0.28f, 0.15f, 0.48f, 22);
                Shard(p, 0, -0.06f, 0.21f, 0.82f, 0);
                p.ShadeLine(0, -0.6f, 0, 0.55f, 0.7f);
                break;
            case IconKind.Spring:
                p.Fill(Drop(p, 0, -0.3f, 0.55f));
                p.EllipseRing(0, 0.6f, 0.78f, 0.2f, 1);
                p.EllipseRing(0, 0.6f, 0.44f, 0.1f, 0.9f);
                break;
            case IconKind.Herb:
                p.Line(0, 0.86f, 0, -0.35f, 1.1f);
                p.Ellipse(-0.32f, 0.02f, 0.14f, 0.36f, -52);
                p.Ellipse(0.32f, -0.22f, 0.14f, 0.36f, 52);
                p.Ellipse(0, -0.62f, 0.13f, 0.3f);
                p.Line(-0.5f, 0.86f, 0.5f, 0.86f, 1);
                break;
            case IconKind.Star:
                p.Fill(Sparkle(p, 0, 0, 0.95f, 0.21f));
                p.Disc(0.64f, -0.64f, 0.09f);
                p.Disc(-0.62f, 0.62f, 0.07f);
                break;
            case IconKind.Grave:
            {
                const int n = 10;
                var pts = new Vector2[n + 3];
                pts[0] = p.P(-0.45f, 0.6f);
                pts[1] = p.P(-0.45f, -0.3f);
                for (var i = 1; i < n; i++)
                {
                    var a = Mathf.Pi + Mathf.Pi * i / n;
                    pts[i + 1] = p.P(0.45f * Mathf.Cos(a), -0.3f + 0.45f * Mathf.Sin(a));
                }
                pts[n + 1] = p.P(0.45f, -0.3f);
                pts[n + 2] = p.P(0.45f, 0.6f);
                p.Fill(pts);
                p.Fill(p.P(-0.92f, 0.86f), p.P(-0.62f, 0.58f), p.P(0.62f, 0.58f), p.P(0.92f, 0.86f));
                for (var i = 0; i < 3; i++) p.ShadeLine(-0.2f, -0.2f + i * 0.24f, 0.2f, -0.2f + i * 0.24f, 0.8f);
                break;
            }
            case IconKind.Ascend:
                p.Line(0, 0.76f, 0, -0.3f, 1.5f);
                p.Fill(p.P(0, -0.92f), p.P(0.44f, -0.34f), p.P(-0.44f, -0.34f));
                p.Line(-0.74f, -0.56f, -0.54f, -0.42f, 1);
                p.Line(0.74f, -0.56f, 0.54f, -0.42f, 1);
                p.Line(-0.6f, 0.82f, 0.6f, 0.82f, 1.2f);
                break;
            case IconKind.Crack:
                p.Ring(0, 0, 0.72f, 1.3f);
                p.Open(1.3f, p.P(-0.08f, -0.92f), p.P(0.14f, -0.35f), p.P(-0.14f, 0.05f), p.P(0.1f, 0.42f), p.P(-0.04f, 0.92f));
                break;
            case IconKind.Flag:
                p.Line(-0.6f, 0.92f, -0.6f, -0.9f, 1.2f);
                p.Fill(p.P(-0.6f, -0.86f), p.P(0.1f, -0.96f), p.P(0.82f, -0.76f), p.P(0.42f, -0.46f), p.P(0.86f, -0.16f), p.P(0.1f, -0.26f), p.P(-0.6f, -0.16f));
                break;
            case IconKind.BrokenSword:
                Sword(p, new Vector2(-0.4f, 0.4f), new Vector2(0.78f, -0.78f), broken: true);
                break;
            case IconKind.Gourd:
                p.Disc(0, 0.34f, 0.5f);
                p.Disc(0, -0.34f, 0.32f);
                p.Fill(p.P(-0.12f, -0.95f), p.P(0.12f, -0.95f), p.P(0.1f, -0.64f), p.P(-0.1f, -0.64f));
                p.ShadeLine(-0.3f, -0.05f, 0.3f, -0.05f, 1);
                break;
            case IconKind.Divider:
                // Drawn as wide as the control, so its strokes are kept thin.
                p.Line(-0.96f, 0, -0.08f, 0, 0.12f);
                p.Line(0.08f, 0, 0.96f, 0, 0.12f);
                p.Fill(p.P(0, -0.045f), p.P(0.045f, 0), p.P(0, 0.045f), p.P(-0.045f, 0));
                break;

            // ---------------------------------------------------------------- actions
            case IconKind.Sword:
                Sword(p, new Vector2(-0.4f, 0.4f), new Vector2(0.78f, -0.78f), broken: false);
                break;
            case IconKind.Dash:
                p.Open(1.5f, p.P(-0.1f, -0.55f), p.P(0.34f, 0), p.P(-0.1f, 0.55f));
                p.Open(1.5f, p.P(0.3f, -0.55f), p.P(0.74f, 0), p.P(0.3f, 0.55f));
                p.Line(-0.92f, -0.3f, -0.38f, -0.3f, 0.9f);
                p.Line(-0.96f, 0, -0.32f, 0, 0.9f);
                p.Line(-0.92f, 0.3f, -0.38f, 0.3f, 0.9f);
                break;
            case IconKind.Hand:
                p.Ellipse(0, 0.36f, 0.48f, 0.44f);
                p.Line(-0.33f, 0.2f, -0.33f, -0.46f, 1.9f);
                p.Line(-0.11f, 0.2f, -0.11f, -0.74f, 1.9f);
                p.Line(0.11f, 0.2f, 0.11f, -0.78f, 1.9f);
                p.Line(0.33f, 0.2f, 0.33f, -0.56f, 1.9f);
                p.Line(-0.4f, 0.46f, -0.8f, 0.06f, 1.9f);
                break;
            case IconKind.FlyingSword:
                Sword(p, new Vector2(-0.55f, -0.08f), new Vector2(0.92f, -0.08f), broken: false);
                p.Line(-0.95f, 0.38f, -0.2f, 0.38f, 0.8f);
                p.Line(-0.7f, 0.62f, 0.12f, 0.62f, 0.8f);
                break;
            case IconKind.Land:
                p.Line(0, -0.86f, 0, 0.16f, 1.5f);
                p.Fill(p.P(-0.42f, 0.08f), p.P(0.42f, 0.08f), p.P(0, 0.6f));
                p.Line(-0.8f, 0.84f, 0.8f, 0.84f, 1.3f);
                break;
            case IconKind.Pause:
                p.Fill(p.P(-0.52f, -0.72f), p.P(-0.14f, -0.72f), p.P(-0.14f, 0.72f), p.P(-0.52f, 0.72f));
                p.Fill(p.P(0.14f, -0.72f), p.P(0.52f, -0.72f), p.P(0.52f, 0.72f), p.P(0.14f, 0.72f));
                break;
            case IconKind.Pill:
                p.Disc(-0.2f, 0.2f, 0.56f);
                p.ShadeArc(-0.2f, 0.2f, 0.36f, 195, 265, 1.1f);
                p.Disc(0.55f, -0.45f, 0.3f);
                p.ShadeArc(0.55f, -0.45f, 0.18f, 195, 265, 0.8f);
                break;
            case IconKind.Ultimate:
                p.Fill(Spikes(p, 8, 0.95f, 0.42f, 0));
                p.ShadeDisc(0, 0, 0.2f);
                break;

            // ---------------------------------------------------------------- spirit arts
            case IconKind.Slash:
                p.Arc(0.12f, 0.4f, 0.95f, 205, 335, 1.9f);
                p.Arc(0.12f, 0.4f, 0.6f, 218, 322, 1.2f);
                break;
            case IconKind.Orb:
                p.Disc(0.34f, 0, 0.42f);
                p.ShadeDisc(0.2f, -0.14f, 0.11f);
                p.Line(-0.94f, -0.26f, -0.2f, -0.26f, 0.9f);
                p.Line(-0.7f, 0, -0.1f, 0, 0.9f);
                p.Line(-0.94f, 0.26f, -0.2f, 0.26f, 0.9f);
                break;
            case IconKind.Needles:
                for (var i = -1; i <= 1; i++)
                {
                    var o = i * 0.34f;
                    p.Fill(p.P(-0.85f, 0.12f + o), p.P(0.1f, -0.1f + o - 0.1f), p.P(0.9f, -0.26f + o), p.P(0.1f, -0.1f + o + 0.1f));
                }
                break;
            case IconKind.Burst:
                p.Disc(0, 0, 0.26f);
                p.Ring(0, 0, 0.54f, 1);
                for (var i = 0; i < 8; i++)
                {
                    var a = Mathf.Tau * i / 8 + Mathf.Pi / 8;
                    p.Line(0.7f * Mathf.Cos(a), 0.7f * Mathf.Sin(a), 0.95f * Mathf.Cos(a), 0.95f * Mathf.Sin(a), 1);
                }
                break;
            case IconKind.DashStrike:
                Sword(p, new Vector2(-0.1f, 0.1f), new Vector2(0.88f, -0.88f), broken: false);
                p.Line(-0.98f, 0.28f, -0.72f, 0.28f, 0.9f);
                p.Line(-0.9f, 0.62f, -0.56f, 0.62f, 0.9f);
                p.Line(-0.62f, 0.94f, -0.32f, 0.94f, 0.9f);
                break;
            case IconKind.Beam:
                p.Disc(-0.72f, 0, 0.22f);
                p.Fill(p.P(-0.6f, -0.13f), p.P(0.96f, -0.07f), p.P(0.96f, 0.07f), p.P(-0.6f, 0.13f));
                p.Line(-0.36f, -0.4f, 0.86f, -0.3f, 0.7f);
                p.Line(-0.36f, 0.4f, 0.86f, 0.3f, 0.7f);
                break;
            case IconKind.Shield:
                p.Fill(ShieldPts(p));
                p.ShadeLine(0, -0.62f, 0, 0.58f, 0.9f);
                break;
            case IconKind.Heal:
                p.Fill(p.P(-0.2f, -0.76f), p.P(0.2f, -0.76f), p.P(0.2f, -0.2f), p.P(0.76f, -0.2f), p.P(0.76f, 0.2f), p.P(0.2f, 0.2f),
                    p.P(0.2f, 0.76f), p.P(-0.2f, 0.76f), p.P(-0.2f, 0.2f), p.P(-0.76f, 0.2f), p.P(-0.76f, -0.2f), p.P(-0.2f, -0.2f));
                break;
            case IconKind.Orbit:
                p.Disc(0, 0, 0.18f);
                for (var i = 0; i < 3; i++)
                {
                    p.Arc(0, 0, 0.68f, i * 120 + 18, i * 120 + 82, 0.8f);
                    var a = Mathf.DegToRad(i * 120 + 100);
                    p.Disc(0.68f * Mathf.Cos(a), 0.68f * Mathf.Sin(a), 0.17f);
                }
                break;
            case IconKind.Wave:
                for (var row = 0; row < 2; row++)
                {
                    var pts = new Vector2[25];
                    for (var i = 0; i < pts.Length; i++)
                    {
                        var x = -0.9f + 1.8f * i / (pts.Length - 1);
                        pts[i] = p.P(x, -0.28f + row * 0.56f + 0.2f * Mathf.Sin((x + 0.9f) * Mathf.Tau / 0.9f));
                    }
                    p.Open(1.3f, pts);
                }
                break;
            case IconKind.Field:
                p.EllipseRing(0, 0.62f, 0.86f, 0.22f, 1);
                p.Fill(Flame(p, -0.46f, 0.3f, 0.34f));
                p.Fill(Flame(p, 0, 0.12f, 0.5f));
                p.Fill(Flame(p, 0.46f, 0.32f, 0.32f));
                break;
            case IconKind.Wall:
                foreach (var (x, top) in new[] { (-0.56f, -0.36f), (0f, -0.82f), (0.56f, -0.48f) })
                    p.Fill(p.P(x - 0.2f, 0.76f), p.P(x - 0.2f, top + 0.18f), p.P(x, top), p.P(x + 0.2f, top + 0.18f), p.P(x + 0.2f, 0.76f));
                p.Line(-0.92f, 0.82f, 0.92f, 0.82f, 1);
                break;
            case IconKind.Summon:
                Draw(ci, IconKind.Person, p.P(-0.12f, 0.1f), size * 0.8f, color);
                p.Fill(Sparkle(p, 0.62f, -0.62f, 0.34f, 0.09f));
                break;

            // ---------------------------------------------------------------- the five elements
            case IconKind.Metal:
                p.Fill(p.P(0, -0.95f), p.P(0.38f, 0), p.P(0, 0.95f), p.P(-0.38f, 0));
                p.ShadeLine(0, -0.66f, 0, 0.66f, 0.8f);
                break;
            case IconKind.Wood:
                p.Ellipse(0.06f, -0.08f, 0.34f, 0.8f, 40);
                p.ShadeLine(-0.36f, 0.44f, 0.46f, -0.58f, 0.8f);
                p.Line(-0.36f, 0.44f, -0.64f, 0.86f, 1);
                break;
            case IconKind.Water:
            case IconKind.Blood:
                p.Fill(Drop(p, 0, 0, 1));
                p.ShadeArc(0, 0.25f, 0.34f, 150, 215, 1.1f);
                break;
            case IconKind.Fire:
                p.Fill(Flame(p, 0, 0, 1));
                p.FillShade(Flame(p, 0, 0.42f, 0.36f));
                break;
            case IconKind.Earth:
                p.Fill(p.P(-0.96f, 0.76f), p.P(-0.4f, -0.3f), p.P(-0.12f, 0.1f), p.P(0.3f, -0.72f), p.P(0.96f, 0.76f));
                break;

            // ---------------------------------------------------------------- conditions
            case IconKind.Stun:
                p.Open(1.2f, Spiral(p, 0.06f, 0.62f, 2.2f, 28));
                p.Disc(0.72f, -0.62f, 0.12f);
                p.Disc(-0.74f, 0.58f, 0.1f);
                break;
            case IconKind.Slow:
                p.Line(-0.6f, -0.86f, 0.6f, -0.86f, 1.2f);
                p.Line(-0.6f, 0.86f, 0.6f, 0.86f, 1.2f);
                p.Fill(p.P(-0.5f, -0.74f), p.P(0.5f, -0.74f), p.P(0, -0.02f));
                p.Fill(p.P(0, 0.02f), p.P(0.5f, 0.74f), p.P(-0.5f, 0.74f));
                break;
            case IconKind.Chain:
                p.EllipseRing(-0.3f, 0, 0.44f, 0.26f, 1.4f);
                p.EllipseRing(0.3f, 0, 0.44f, 0.26f, 1.4f);
                break;
            case IconKind.ArmorBreak:
                p.Outline(1.2f, ShieldPts(p));
                p.Open(1.2f, p.P(0.05f, -0.8f), p.P(-0.12f, -0.2f), p.P(0.14f, 0.1f), p.P(-0.04f, 0.72f));
                break;
            case IconKind.Blind:
                p.Outline(1.1f, Almond(p, 0.92f, 0.55f));
                p.Disc(0, 0, 0.26f);
                p.Line(-0.8f, 0.72f, 0.8f, -0.72f, 1.3f);
                break;

            // ---------------------------------------------------------------- the field and the trials
            // ---------------------------------------------------------------- things to do on the map
            case IconKind.Fish:
                p.Ellipse(-0.14f, 0, 0.62f, 0.34f);
                p.Fill(p.P(0.36f, 0), p.P(0.92f, -0.44f), p.P(0.76f, 0), p.P(0.92f, 0.44f));
                p.ShadeDisc(-0.5f, -0.07f, 0.075f);
                p.ShadeLine(-0.28f, -0.22f, -0.24f, 0.2f, 0.9f);
                p.Fill(p.P(-0.2f, -0.3f), p.P(0.12f, -0.58f), p.P(0.2f, -0.3f));
                break;
            case IconKind.Pickaxe:
                p.Line(-0.66f, 0.86f, 0.2f, -0.28f, 1.3f);
                p.Arc(0.28f, 0.34f, 0.78f, 212, 322, 2.1f);
                p.Fill(p.P(-0.92f, 0.62f), p.P(-0.5f, 0.42f), p.P(-0.28f, 0.66f), p.P(-0.46f, 0.9f), p.P(-0.86f, 0.9f));
                break;
            case IconKind.Shrine:
                p.Fill(p.P(-0.94f, -0.18f), p.P(-0.58f, -0.62f), p.P(0.58f, -0.62f), p.P(0.94f, -0.18f), p.P(0.6f, -0.26f), p.P(-0.6f, -0.26f));
                p.Outline(1.1f, p.P(-0.5f, -0.24f), p.P(0.5f, -0.24f), p.P(0.5f, 0.58f), p.P(-0.5f, 0.58f));
                p.Fill(p.P(-0.18f, 0.06f), p.P(0.18f, 0.06f), p.P(0.18f, 0.58f), p.P(-0.18f, 0.58f));
                p.Line(-0.76f, 0.84f, 0.76f, 0.84f, 1.3f);
                p.Line(0, -0.62f, 0, -0.92f, 1);
                break;
            case IconKind.Tent:
                p.Fill(p.P(-0.92f, 0.82f), p.P(-0.04f, -0.66f), p.P(0.92f, 0.82f));
                p.FillShade(p.P(-0.24f, 0.82f), p.P(-0.04f, 0.1f), p.P(0.16f, 0.82f));
                p.Line(-0.04f, -0.66f, -0.04f, -0.98f, 1);
                p.Fill(p.P(-0.04f, -0.98f), p.P(0.46f, -0.87f), p.P(-0.04f, -0.76f));
                break;
            case IconKind.Cauldron:
                p.Fill(p.P(-0.74f, -0.2f), p.P(0.74f, -0.2f), p.P(0.62f, 0.3f), p.P(0.3f, 0.54f), p.P(-0.3f, 0.54f), p.P(-0.62f, 0.3f));
                p.Line(-0.84f, -0.26f, 0.84f, -0.26f, 1.3f);
                p.Line(-0.4f, 0.46f, -0.56f, 0.92f, 1.2f);
                p.Line(0.4f, 0.46f, 0.56f, 0.92f, 1.2f);
                p.Ring(-0.76f, -0.44f, 0.13f, 0.9f);
                p.Ring(0.76f, -0.44f, 0.13f, 0.9f);
                p.Arc(-0.2f, -0.62f, 0.14f, 180, 360, 0.8f);
                p.Arc(0.12f, -0.8f, 0.14f, 0, 180, 0.8f);
                p.ShadeLine(-0.44f, 0.08f, 0.44f, 0.08f, 0.9f);
                break;
            case IconKind.Paw:
                p.Ellipse(0, 0.36f, 0.42f, 0.34f);
                p.Ellipse(-0.56f, -0.1f, 0.15f, 0.21f, -20);
                p.Ellipse(-0.2f, -0.46f, 0.15f, 0.21f, -8);
                p.Ellipse(0.2f, -0.46f, 0.15f, 0.21f, 8);
                p.Ellipse(0.56f, -0.1f, 0.15f, 0.21f, 20);
                break;
            case IconKind.Core:
                for (var arm = 0; arm < 3; arm++)
                {
                    var pts = new Vector2[14];
                    for (var i = 0; i < pts.Length; i++)
                    {
                        var t = i / (float)(pts.Length - 1);
                        var a = Mathf.DegToRad(arm * 120) + t * 2.4f;
                        var r = 0.16f + 0.74f * t;
                        pts[i] = p.P(r * Mathf.Cos(a), r * Mathf.Sin(a));
                    }
                    p.Open(1.4f, pts);
                }
                p.Disc(0, 0, 0.2f);
                break;
            case IconKind.Turbid:
                p.Fill(Spikes(p, 7, 0.95f, 0.5f, 0.2f));
                p.ShadeDisc(0, 0, 0.18f);
                break;
            case IconKind.DemonEyes:
                p.Fill(p.P(-0.78f, -0.3f), p.P(-0.08f, 0.04f), p.P(-0.6f, 0.24f));
                p.Fill(p.P(0.78f, -0.3f), p.P(0.08f, 0.04f), p.P(0.6f, 0.24f));
                break;
        }
    }

    // ---------------------------------------------------------------- shapes several icons share

    /// <summary>The top half of an ellipse standing on a flat base (shoulders, mounds).</summary>
    private static Vector2[] Dome(in Pen p, float x, float baseY, float rx, float ry)
    {
        const int n = 14;
        var pts = new Vector2[n + 1];
        for (var i = 0; i <= n; i++)
        {
            var a = Mathf.Pi + Mathf.Pi * i / n;
            pts[i] = p.P(x + rx * Mathf.Cos(a), baseY + ry * Mathf.Sin(a));
        }
        return pts;
    }

    /// <summary>An eye's outline: two arcs meeting at the corners.</summary>
    private static Vector2[] Almond(in Pen p, float rx, float ry)
    {
        const int n = 10;
        var pts = new Vector2[2 * n];
        for (var i = 0; i < n; i++)
        {
            var t = i / (float)n;
            pts[i] = p.P(-rx + 2 * rx * t, -ry * Mathf.Sin(Mathf.Pi * t));
            pts[n + i] = p.P(rx - 2 * rx * t, ry * Mathf.Sin(Mathf.Pi * t));
        }
        return pts;
    }

    private static Vector2[] Spiral(in Pen p, float r0, float r1, float turns, int n)
    {
        var pts = new Vector2[n + 1];
        for (var i = 0; i <= n; i++)
        {
            var t = i / (float)n;
            var r = r0 + (r1 - r0) * t;
            var a = turns * Mathf.Pi * t;
            pts[i] = p.P(r * Mathf.Cos(a), r * Mathf.Sin(a));
        }
        return pts;
    }

    /// <summary>A four-pointed sparkle.</summary>
    private static Vector2[] Sparkle(in Pen p, float x, float y, float r, float waist) => new[]
    {
        p.P(x, y - r), p.P(x + waist, y - waist), p.P(x + r, y), p.P(x + waist, y + waist),
        p.P(x, y + r), p.P(x - waist, y + waist), p.P(x - r, y), p.P(x - waist, y - waist),
    };

    /// <summary>A star of <paramref name="points"/> spikes (jagged when <paramref name="jitter"/> is set).</summary>
    private static Vector2[] Spikes(in Pen p, int points, float outer, float inner, float jitter)
    {
        var pts = new Vector2[points * 2];
        for (var i = 0; i < pts.Length; i++)
        {
            var a = -Mathf.Pi / 2 + Mathf.Pi * i / points;
            var r = i % 2 == 0 ? outer * (1 - jitter * ((i * 7 % 5) / 5f)) : inner;
            pts[i] = p.P(r * Mathf.Cos(a), r * Mathf.Sin(a));
        }
        return pts;
    }

    /// <summary>A drop of water (or blood): round below, pointed above.</summary>
    private static Vector2[] Drop(in Pen p, float x, float y, float scale)
    {
        const int n = 16;
        var pts = new Vector2[n + 2];
        pts[0] = p.P(x, y - 0.95f * scale);
        for (var i = 0; i <= n; i++)
        {
            var a = Mathf.DegToRad(-35 + 250f * i / n);
            pts[i + 1] = p.P(x + 0.58f * scale * Mathf.Cos(a), y + (0.3f + 0.58f * Mathf.Sin(a)) * scale);
        }
        return pts;
    }

    /// <summary>A flame: round at the root, a tongue to one side, a point on top.</summary>
    private static Vector2[] Flame(in Pen p, float x, float y, float s)
    {
        (float X, float Y)[] shape =
        {
            (0.05f, -0.95f), (0.3f, -0.5f), (0.44f, -0.64f), (0.6f, -0.15f), (0.6f, 0.3f), (0.4f, 0.7f), (0, 0.9f),
            (-0.4f, 0.7f), (-0.6f, 0.3f), (-0.5f, -0.15f), (-0.3f, -0.4f), (-0.18f, -0.2f), (-0.1f, -0.55f),
        };
        var pts = new Vector2[shape.Length];
        for (var i = 0; i < shape.Length; i++) pts[i] = p.P(x + shape[i].X * s, y + shape[i].Y * s);
        return pts;
    }

    private static Vector2[] ShieldPts(in Pen p) => new[]
    {
        p.P(0, -0.9f), p.P(0.72f, -0.62f), p.P(0.66f, 0.1f), p.P(0, 0.9f), p.P(-0.66f, 0.1f), p.P(-0.72f, -0.62f),
    };

    /// <summary>A crystal shard: a long hexagon with a point on top, tilted.</summary>
    private static void Shard(Pen p, float x, float y, float halfW, float halfH, float degrees)
    {
        var a = Mathf.DegToRad(degrees);
        Vector2 R(float dx, float dy) => p.P(x + dx * Mathf.Cos(a) - dy * Mathf.Sin(a), y + dx * Mathf.Sin(a) + dy * Mathf.Cos(a));
        p.Fill(R(0, -halfH), R(halfW, -halfH + halfW * 1.4f), R(halfW, halfH * 0.8f), R(0, halfH), R(-halfW, halfH * 0.8f), R(-halfW, -halfH + halfW * 1.4f));
    }

    /// <summary>A sword from its hilt end (<paramref name="from"/>) to its tip; a broken one has a gap and a bent point.</summary>
    private static void Sword(in Pen p, Vector2 from, Vector2 tip, bool broken)
    {
        var d = (tip - from).Normalized();
        var n = new Vector2(-d.Y, d.X);
        var len = from.DistanceTo(tip);
        const float half = 0.1f;
        if (broken)
        {
            var mid = from + d * len * 0.45f;
            p.Fill(p.U(from + n * half), p.U(mid + n * half), p.U(mid + n * half * 0.2f - d * 0.06f), p.U(mid - n * half), p.U(from - n * half));
            // The broken point, knocked askew.
            var d2 = d.Rotated(0.5f);
            var n2 = new Vector2(-d2.Y, d2.X);
            var start = mid + d * 0.2f + n * 0.12f;
            var end = start + d2 * len * 0.42f;
            p.Fill(p.U(start + n2 * half), p.U(end - d2 * 0.16f + n2 * half), p.U(end), p.U(end - d2 * 0.16f - n2 * half), p.U(start - n2 * half), p.U(start + d2 * 0.05f));
        }
        else
        {
            p.Fill(p.U(from + n * half), p.U(tip - d * 0.2f + n * half), p.U(tip), p.U(tip - d * 0.2f - n * half), p.U(from - n * half));
            p.ShadeLineU(from + d * 0.1f, tip - d * 0.22f, 0.6f);
        }
        p.LineU(from + n * 0.32f, from - n * 0.32f, 1.4f);
        p.LineU(from, from - d * 0.38f, 1.5f);
        p.DiscU(from - d * 0.46f, 0.09f);
    }

    /// <summary>Draws in one colour, with coordinates in a −1…1 box around a centre.</summary>
    private readonly struct Pen
    {
        private readonly Brush _ci;
        private readonly Vector2 _c;
        private readonly float _h;
        private readonly Color _color, _shade;
        private readonly float _w;

        public Pen(Brush ci, Vector2 centre, float size, Color color)
        {
            _ci = ci;
            _c = centre;
            _h = size / 2;
            _color = Paint.A(color);
            // Details on a filled shape: darker on a light colour, lighter on a dark one.
            var shade = color.Luminance > 0.45f ? color.Darkened(0.5f) : color.Lightened(0.55f);
            _shade = Paint.A(new Color(shade, color.A));
            _w = Mathf.Max(1.2f, size * 0.085f);
        }

        public Vector2 P(float x, float y) => _c + new Vector2(x, y) * _h;
        public Vector2 U(Vector2 v) => _c + v * _h;
        private float S(float r) => r * _h;

        public void Fill(params Vector2[] pts) => _ci.DrawColoredPolygon(pts, _color);
        public void FillShade(params Vector2[] pts) => _ci.DrawColoredPolygon(pts, _shade);
        public void Outline(float width, params Vector2[] pts) => _ci.DrawPolyline(Paint.Closed(pts), _color, _w * width, true);
        public void Open(float width, params Vector2[] pts) => _ci.DrawPolyline(pts, _color, _w * width, true);

        public void Line(float x0, float y0, float x1, float y1, float width) => LineU(new Vector2(x0, y0), new Vector2(x1, y1), width);

        public void LineU(Vector2 a, Vector2 b, float width) => Stroke(U(a), U(b), _color, _w * width);

        public void ShadeLine(float x0, float y0, float x1, float y1, float width) => Stroke(P(x0, y0), P(x1, y1), _shade, _w * width);

        public void ShadeLineU(Vector2 a, Vector2 b, float width) => Stroke(U(a), U(b), _shade, _w * width);

        private void Stroke(Vector2 a, Vector2 b, Color color, float width)
        {
            _ci.DrawLine(a, b, color, width, true);
            // Round ends on the thick strokes.
            if (width < 2.4f) return;
            _ci.DrawCircle(a, width / 2, color);
            _ci.DrawCircle(b, width / 2, color);
        }

        public void Disc(float x, float y, float r) => _ci.DrawCircle(P(x, y), S(r), _color);
        public void DiscU(Vector2 v, float r) => _ci.DrawCircle(U(v), S(r), _color);
        public void ShadeDisc(float x, float y, float r) => _ci.DrawCircle(P(x, y), S(r), _shade);
        public void Ring(float x, float y, float r, float width) => _ci.DrawArc(P(x, y), S(r), 0, Mathf.Tau, 36, _color, _w * width, true);

        public void Arc(float x, float y, float r, float fromDeg, float toDeg, float width) =>
            _ci.DrawArc(P(x, y), S(r), Mathf.DegToRad(fromDeg), Mathf.DegToRad(toDeg), 24, _color, _w * width, true);

        public void ShadeArc(float x, float y, float r, float fromDeg, float toDeg, float width) =>
            _ci.DrawArc(P(x, y), S(r), Mathf.DegToRad(fromDeg), Mathf.DegToRad(toDeg), 16, _shade, _w * width, true);

        public void Ellipse(float x, float y, float rx, float ry, float degrees = 0) =>
            _ci.DrawColoredPolygon(Paint.EllipsePts(P(x, y), S(rx), S(ry), 18, Mathf.DegToRad(degrees)), _color);

        public void EllipseRing(float x, float y, float rx, float ry, float width) =>
            _ci.DrawPolyline(Paint.Closed(Paint.EllipsePts(P(x, y), S(rx), S(ry), 24)), _color, _w * width, true);
    }
}

/// <summary>A control that shows one icon, centred and scaled to fit (seals, buttons, lists).</summary>
public partial class IconView : Control
{
    public IconKind Icon { get; set; }
    public Color Tint { get; set; } = Ui.Ink.InkColor;
    /// <summary>How much of the control the icon fills.</summary>
    public float Fill { get; set; } = 0.62f;

    public IconView()
    {
        MouseFilter = MouseFilterEnum.Ignore;
    }

    public IconView(IconKind icon, Color tint, float fill = 0.62f) : this()
    {
        Icon = icon;
        Tint = tint;
        Fill = fill;
    }

    // A divider is as wide as its control; everything else fits the shorter side.
    public override void _Draw() => Icons.Draw(this, Icon, Size / 2, (Icon == IconKind.Divider ? Size.X : Mathf.Min(Size.X, Size.Y)) * Fill, Tint);
}
