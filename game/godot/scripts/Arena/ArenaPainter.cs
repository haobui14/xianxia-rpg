using System.Collections.Generic;
using Godot;
using TuTienLuc.Ui;

namespace TuTienLuc.Arena;

/// <summary>Draws the arena in the ink-wash style. Everything is immediate-mode from the arena's lists.</summary>
internal static class ArenaPainter
{
    public static void Draw(ArenaScreen a)
    {
        var field = new Rect2(Vector2.Zero, ArenaScreen.Field);
        a.DrawRect(field.Grow(600), Ink.PaperDarker);
        a.DrawRect(field, a.FloorTint);

        // Ink-wash blotches, fixed per arena.
        for (var i = 0; i < 18; i++)
        {
            var h = Hash(i * 7919 + 13);
            var pos = new Vector2(h % 1000 / 1000f * field.Size.X, Hash(i * 104729 + 7) % 1000 / 1000f * field.Size.Y);
            a.DrawCircle(pos, 40 + h % 90, new Color(Ink.InkColor, 0.014f));
        }
        Centered(a, Ink.Han, a.Mode == ArenaMode.QiTrial ? "氣" : "鬥", field.GetCenter() + new Vector2(0, 110), 320, new Color(Ink.InkColor, 0.045f));
        a.DrawRect(field, Ink.InkColor, false, 4);
        a.DrawRect(field.Grow(-9), new Color(Ink.InkColor, 0.22f), false, 1);

        foreach (var t in a.Telegraphs) DrawTelegraph(a, t);
        if (a.Trial != null) DrawTrial(a, a.Trial);

        foreach (var (pos, life) in a.Trail)
            a.DrawCircle(pos, a.Player.Radius * 0.9f, new Color(Ink.Cinnabar, life * 1.2f));

        foreach (var e in a.Enemies) DrawEnemy(a, e);
        DrawPlayer(a);

        foreach (var p in a.Projectiles)
        {
            var back = p.Vel.Normalized() * (p.Radius * 2.2f);
            a.DrawLine(p.Pos - back, p.Pos, new Color(p.Color, 0.35f), p.Radius * 1.3f, true);
            a.DrawCircle(p.Pos, p.Radius, p.Color);
            a.DrawCircle(p.Pos, p.Radius * 0.45f, new Color(Ink.Card, 0.85f));
        }

        foreach (var s in a.Swooshes)
        {
            var k = s.Life / s.MaxLife;
            if (s.Ring)
            {
                a.DrawArc(s.Pos, s.Radius * (1.05f - 0.35f * k), 0, Mathf.Tau, 48, new Color(s.Color, 0.7f * k), 3 + 5 * k, true);
            }
            else
            {
                var half = Mathf.DegToRad(s.Arc) / 2;
                a.DrawArc(s.Pos, s.Radius * 0.92f, s.Angle - half, s.Angle + half, 24, new Color(s.Color, 0.75f * k), 4 + 10 * k, true);
                a.DrawArc(s.Pos, s.Radius * 0.7f, s.Angle - half * 0.8f, s.Angle + half * 0.8f, 20, new Color(s.Color, 0.35f * k), 2 + 4 * k, true);
            }
        }

        if (!a.Autopilot && !a.Over && a.Trial == null)
        {
            a.DrawArc(a.AimPoint, 9, 0, Mathf.Tau, 20, new Color(Ink.InkColor, 0.45f), 1.5f, true);
            a.DrawLine(a.AimPoint - new Vector2(14, 0), a.AimPoint - new Vector2(5, 0), new Color(Ink.InkColor, 0.45f), 1.5f);
            a.DrawLine(a.AimPoint + new Vector2(14, 0), a.AimPoint + new Vector2(5, 0), new Color(Ink.InkColor, 0.45f), 1.5f);
        }

        foreach (var f in a.Floaters)
        {
            var alpha = Mathf.Clamp(f.Life / f.MaxLife * 1.6f, 0, 1);
            var font = f.Text.Length <= 3 && f.Text[0] > 0x2E80 ? Ink.Han : Ink.Serif;
            var size = font.GetStringSize(f.Text, HorizontalAlignment.Left, -1, f.Size);
            var pos = f.Pos - new Vector2(size.X / 2, 0);
            a.DrawStringOutline(font, pos, f.Text, HorizontalAlignment.Left, -1, f.Size, 5, new Color(Ink.Card, alpha * 0.9f));
            a.DrawString(font, pos, f.Text, HorizontalAlignment.Left, -1, f.Size, new Color(f.Color, alpha));
        }
    }

    private static int Hash(int x)
    {
        unchecked
        {
            x = ((x >> 16) ^ x) * 0x45d9f3b;
            x = ((x >> 16) ^ x) * 0x45d9f3b;
            return ((x >> 16) ^ x) & 0x7fffffff;
        }
    }

    private static void Centered(ArenaScreen a, Font font, string text, Vector2 center, int size, Color color)
    {
        var s = font.GetStringSize(text, HorizontalAlignment.Left, -1, size);
        a.DrawString(font, center - new Vector2(s.X / 2, -size * 0.35f), text, HorizontalAlignment.Left, -1, size, color);
    }

    private static void DrawTelegraph(ArenaScreen a, Telegraph t)
    {
        var color = t.FromPlayer ? Ink.Jade : Ink.Cinnabar;
        var k = t.Progress;
        switch (t.Shape)
        {
            case Telegraph.Shapes.Circle:
                a.DrawCircle(t.Pos, t.Radius, new Color(color, 0.10f));
                a.DrawCircle(t.Pos, t.Radius * k, new Color(color, 0.20f));
                a.DrawArc(t.Pos, t.Radius, 0, Mathf.Tau, 48, new Color(color, 0.75f), 2, true);
                break;
            case Telegraph.Shapes.Line:
            {
                var n = new Vector2(-t.Dir.Y, t.Dir.X) * (t.Width / 2);
                var end = t.Pos + t.Dir * t.Length;
                a.DrawColoredPolygon(new[] { t.Pos + n, end + n, end - n, t.Pos - n }, new Color(color, 0.10f));
                var mid = t.Pos + t.Dir * (t.Length * k);
                a.DrawColoredPolygon(new[] { t.Pos + n, mid + n, mid - n, t.Pos - n }, new Color(color, 0.22f));
                a.DrawPolyline(new[] { t.Pos + n, end + n, end - n, t.Pos - n, t.Pos + n }, new Color(color, 0.7f), 2, true);
                break;
            }
            default:
            {
                var half = Mathf.DegToRad(t.Arc) / 2;
                var angle = ArenaMath.Angle(t.Dir);
                a.DrawColoredPolygon(Pie(t.Pos, t.Radius, angle, half), new Color(color, 0.10f));
                a.DrawColoredPolygon(Pie(t.Pos, t.Radius * Mathf.Max(0.05f, k), angle, half), new Color(color, 0.24f));
                a.DrawArc(t.Pos, t.Radius, angle - half, angle + half, 20, new Color(color, 0.75f), 2, true);
                break;
            }
        }
    }

    private static Vector2[] Pie(Vector2 center, float radius, float angle, float half)
    {
        const int steps = 14;
        var pts = new List<Vector2> { center };
        for (var i = 0; i <= steps; i++)
            pts.Add(center + Vector2.Right.Rotated(angle - half + 2 * half * i / steps) * radius);
        return pts.ToArray();
    }

    private static void DrawEnemy(ArenaScreen a, Fighter e)
    {
        var alpha = e.Alive ? (e.Yielded ? 0.45f : 1f) : Mathf.Clamp(e.DeathFade / 0.6f, 0, 1);
        if (alpha <= 0) return;
        var r = e.Radius;
        var ring = e.Element != null ? Ink.Element(e.Element.Value) : Ink.InkSoft;
        a.DrawCircle(e.Pos + new Vector2(3, 5), r, new Color(0, 0, 0, 0.16f * alpha));
        a.DrawCircle(e.Pos, r, new Color(Ink.InkColor.Lerp(ring, 0.18f), alpha));
        a.DrawArc(e.Pos, r, 0, Mathf.Tau, 36, new Color(ring, alpha), e.Archetype == "boss" ? 5 : 3, true);
        if (e.HitFlash > 0) a.DrawCircle(e.Pos, r, new Color(1, 1, 1, e.HitFlash / 0.12f * 0.6f));
        Centered(a, Ink.Han, e.Glyph, e.Pos, (int)(r * 1.15f), new Color(Ink.Card, alpha));
        if (e.Enraged) a.DrawArc(e.Pos, r + 6, 0, Mathf.Tau, 36, new Color(Ink.Cinnabar, 0.6f * alpha), 2, true);
        if (!e.Active) return;

        a.DrawLine(e.Pos + e.Facing * (r + 3), e.Pos + e.Facing * (r + 10), new Color(Ink.InkColor, 0.6f), 3);

        var w = Mathf.Max(44, r * 2.4f);
        var top = e.Pos + new Vector2(-w / 2, -r - 14);
        a.DrawRect(new Rect2(top, new Vector2(w, 6)), new Color(Ink.PaperDarker, 0.9f));
        a.DrawRect(new Rect2(top, new Vector2(w * Mathf.Clamp(e.Hp / e.HpMax, 0, 1), 6)), Ink.Cinnabar);
        a.DrawRect(new Rect2(top, new Vector2(w, 6)), new Color(Ink.InkColor, 0.5f), false, 1);

        if (e.Mark is { } mark && (e.MarkTime > 1.5f || Mathf.PosMod(e.MarkTime, 0.3f) > 0.15f))
        {
            var mp = e.Pos + new Vector2(0, -r - 30);
            a.DrawCircle(mp, 11, new Color(Ink.Card, 0.95f));
            a.DrawArc(mp, 11, 0, Mathf.Tau, 20, Ink.Element(mark), 2, true);
            Centered(a, Ink.Han, ArenaMath.Han[mark], mp, 15, Ink.Element(mark));
        }

        var icons = new List<(string, Color)>();
        if (e.Stun > 0) icons.Add(("暈", Ink.GoldDeep));
        if (e.Rooted > 0) icons.Add(("縛", Ink.WaterBlue));
        if (e.Slow > 0) icons.Add(("緩", Ink.WaterBlue));
        if (e.BleedTime > 0) icons.Add(("血", Ink.CinnabarDeep));
        if (e.BurnTime > 0) icons.Add(("焚", Ink.Cinnabar));
        if (e.DefBreak > 0) icons.Add(("破", Ink.Ochre));
        if (e.ResBreak > 0) icons.Add(("融", Ink.Gold));
        if (e.Blind > 0) icons.Add(("盲", Ink.InkSoft));
        for (var i = 0; i < icons.Count; i++)
        {
            var (glyph, color) = icons[i];
            var ip = e.Pos + new Vector2((i - (icons.Count - 1) / 2f) * 18, r + 16);
            Centered(a, Ink.Han, glyph, ip, 14, color);
        }
    }

    private static void DrawPlayer(ArenaScreen a)
    {
        var p = a.Player;
        var r = p.Radius;
        var alpha = p.Invuln > 0 && a.DashTime > 0 ? 0.55f : 1f;
        a.DrawCircle(p.Pos + new Vector2(3, 5), r, new Color(0, 0, 0, 0.18f));
        if (p.Shield > 0) a.DrawArc(p.Pos, r + 7, 0, Mathf.Tau, 36, new Color(Ink.Jade, 0.8f), 4, true);
        a.DrawCircle(p.Pos, r, new Color(Ink.Cinnabar, alpha));
        a.DrawArc(p.Pos, r - 3, 0, Mathf.Tau, 36, new Color(Ink.Card, 0.8f * alpha), 1.5f, true);
        if (p.HitFlash > 0) a.DrawCircle(p.Pos, r, new Color(1, 1, 1, p.HitFlash / 0.12f * 0.6f));
        Centered(a, Ink.Han, "吾", p.Pos, 20, Ink.Card);
        var tip = p.Pos + p.Facing * (r + 12);
        var side = new Vector2(-p.Facing.Y, p.Facing.X) * 6;
        a.DrawColoredPolygon(new[] { tip, p.Pos + p.Facing * (r + 3) + side, p.Pos + p.Facing * (r + 3) - side }, Ink.CinnabarDeep);
        if (p.Stun > 0) Centered(a, Ink.Han, "暈", p.Pos + new Vector2(0, -r - 16), 16, Ink.GoldDeep);
        if (p.Rooted > 0) Centered(a, Ink.Han, "縛", p.Pos + new Vector2(0, r + 16), 15, Ink.WaterBlue);
    }

    private static void DrawTrial(ArenaScreen a, QiTrial trial)
    {
        var center = ArenaScreen.Field / 2;
        for (var i = 0; i < 4; i++)
        {
            var start = trial.Time * (0.4f + i * 0.15f) + i;
            a.DrawArc(center, 90 + i * 70, start, start + 2.2f, 32, new Color(Ink.Jade, 0.12f), 3, true);
        }
        foreach (var m in trial.Motes)
        {
            var fade = Mathf.Clamp(m.Life, 0, 1);
            var color = Ink.Element(m.Element);
            var big = trial.IsRoot(m.Element);
            a.DrawCircle(m.Pos, big ? 17 : 13, new Color(color, 0.18f * fade));
            a.DrawCircle(m.Pos, big ? 9 : 7, new Color(color, 0.9f * fade));
            if (big) a.DrawArc(m.Pos, 12, 0, Mathf.Tau, 20, new Color(Ink.Gold, 0.9f * fade), 2, true);
        }
        foreach (var d in trial.Demons)
        {
            a.DrawCircle(d.Pos, 18, new Color(Ink.Violet, 0.25f));
            a.DrawCircle(d.Pos, 13, new Color(Ink.CinnabarDeep, 0.9f));
            Centered(a, Ink.Han, "魔", d.Pos, 15, Ink.Card);
        }
    }
}
