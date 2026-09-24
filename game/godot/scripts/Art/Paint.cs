using System;
using Godot;

namespace TuTienLuc.Art;

/// <summary>
/// Drawing helpers for the procedural ink style: flat fills, an ink contour, soft shadows.
/// Everything here draws into the given canvas item during its <c>_Draw</c>.
/// </summary>
public static class Paint
{
    public static readonly Color Ink = new("#1c2230");
    public const float Line = 1.6f;

    /// <summary>The alpha every colour is multiplied by (fading bodies, ghosts). Set per figure; drawing is single-threaded.</summary>
    public static float Alpha = 1;

    public static Color A(Color c) => new(c.R, c.G, c.B, c.A * Alpha);
    public static Color InkA(float a) => new(Ink.R, Ink.G, Ink.B, a * Alpha);

    public static Vector2[] EllipsePts(Vector2 c, float rx, float ry, int n = 20, float rot = 0)
    {
        var pts = new Vector2[n];
        var cos = Mathf.Cos(rot);
        var sin = Mathf.Sin(rot);
        for (var i = 0; i < n; i++)
        {
            var t = Mathf.Tau * i / n;
            var x = Mathf.Cos(t) * rx;
            var y = Mathf.Sin(t) * ry;
            pts[i] = c + new Vector2(x * cos - y * sin, x * sin + y * cos);
        }
        return pts;
    }

    public static Vector2[] Closed(Vector2[] pts)
    {
        var closed = new Vector2[pts.Length + 1];
        Array.Copy(pts, closed, pts.Length);
        closed[pts.Length] = pts[0];
        return closed;
    }

    /// <summary>A filled polygon with an ink contour (outline alpha 0 = no contour).</summary>
    public static void Poly(Brush ci, Vector2[] pts, Color fill, float outline = 0.85f, float width = Line)
    {
        if (pts.Length < 3) return;
        ci.DrawColoredPolygon(pts, A(fill));
        if (outline > 0) ci.DrawPolyline(Closed(pts), InkA(outline), width, true);
    }

    public static void Ellipse(Brush ci, Vector2 c, float rx, float ry, Color fill, float outline = 0.85f, float width = Line, float rot = 0, int n = 20) =>
        Poly(ci, EllipsePts(c, rx, ry, n, rot), fill, outline, width);

    public static void Circle(Brush ci, Vector2 c, float r, Color fill, float outline = 0.85f, float width = Line)
    {
        ci.DrawCircle(c, r, A(fill));
        if (outline > 0) ci.DrawArc(c, r, 0, Mathf.Tau, Math.Max(12, (int)(r * 1.6f)), InkA(outline), width, true);
    }

    /// <summary>The ink rim of a circle drawn a little larger — draw all rims first, then fills, for a clean silhouette.</summary>
    public static void Rim(Brush ci, Vector2 c, float r, float alpha = 0.85f, float width = Line) =>
        ci.DrawCircle(c, r + width * 0.9f, InkA(alpha));

    public static void Shadow(Brush ci, Vector2 c, float rx, float ry, float alpha = 0.2f) =>
        ci.DrawColoredPolygon(EllipsePts(c, rx, ry, 18), new Color(0.05f, 0.06f, 0.08f, alpha * Alpha));

    public static void Line2(Brush ci, Vector2 a, Vector2 b, Color color, float width) =>
        ci.DrawLine(a, b, A(color), width, true);

    /// <summary>A thick stroke with an ink contour (staffs, blades, branches).</summary>
    public static void Stroke(Brush ci, Vector2 a, Vector2 b, Color color, float width, float outline = 0.85f)
    {
        if (outline > 0) ci.DrawLine(a, b, InkA(outline), width + Line * 1.6f, true);
        ci.DrawLine(a, b, A(color), width, true);
    }

    /// <summary>A quad from a start point along a direction, tapering from w0 to w1.</summary>
    public static Vector2[] Taper(Vector2 a, Vector2 b, float w0, float w1)
    {
        var d = (b - a).Normalized();
        var n = new Vector2(-d.Y, d.X);
        return new[] { a + n * w0 / 2, b + n * w1 / 2, b - n * w1 / 2, a - n * w0 / 2 };
    }

    public static Vector2[] Offset(Vector2[] pts, Vector2 by)
    {
        var r = new Vector2[pts.Length];
        for (var i = 0; i < pts.Length; i++) r[i] = pts[i] + by;
        return r;
    }

    /// <summary>Rotate points about a pivot.</summary>
    public static Vector2[] Rotate(Vector2[] pts, Vector2 pivot, float angle)
    {
        var r = new Vector2[pts.Length];
        for (var i = 0; i < pts.Length; i++) r[i] = pivot + (pts[i] - pivot).Rotated(angle);
        return r;
    }

    /// <summary>An irregular round outline, stable per seed (rocks, bushes, canopies).</summary>
    public static Vector2[] Blob(Vector2 c, float rx, float ry, int n, float wobble, int seed)
    {
        var pts = new Vector2[n];
        for (var i = 0; i < n; i++)
        {
            var t = Mathf.Tau * i / n;
            var k = 1 + (Hash(seed, i) - 0.5f) * 2 * wobble;
            pts[i] = c + new Vector2(Mathf.Cos(t) * rx * k, Mathf.Sin(t) * ry * k);
        }
        return pts;
    }

    public static float Hash(int a, int b)
    {
        unchecked
        {
            var h = (uint)(a * 374761393) ^ (uint)(b * 668265263);
            h = (h ^ (h >> 13)) * 1274126177;
            return ((h ^ (h >> 16)) & 0xFFFF) / 65535f;
        }
    }

    /// <summary>A word centred on a point (painted signboards, stones).</summary>
    /// <summary>
    /// A line of text centred on <paramref name="center"/>. With <paramref name="maxWidth"/> it shrinks to fit (a
    /// signboard is one size, and the two languages' words are not).
    /// </summary>
    public static void Caption(Brush ci, string text, Vector2 center, int size, Color color, Font? font = null, float maxWidth = 0)
    {
        font ??= Ui.Ink.Serif;
        var s = font.GetStringSize(text, HorizontalAlignment.Left, -1, size);
        if (maxWidth > 0 && s.X > maxWidth && size > 7)
        {
            size = Mathf.Max(7, Mathf.FloorToInt(size * maxWidth / s.X));
            s = font.GetStringSize(text, HorizontalAlignment.Left, -1, size);
        }
        ci.DrawString(font, center + new Vector2(-s.X / 2, size * 0.36f), text, HorizontalAlignment.Left, -1, size, A(color));
    }

    /// <summary>Text with a paper-coloured halo, readable over any ground.</summary>
    public static void Label(Brush ci, string text, Vector2 center, int size, Color color, Font? font = null, float halo = 4)
    {
        font ??= Ui.Ink.Serif;
        var s = font.GetStringSize(text, HorizontalAlignment.Left, -1, size);
        var pos = center + new Vector2(-s.X / 2, size * 0.36f);
        ci.DrawStringOutline(font, pos, text, HorizontalAlignment.Left, -1, size, (int)halo, new Color(0.97f, 0.94f, 0.85f, 0.85f * Alpha));
        ci.DrawString(font, pos, text, HorizontalAlignment.Left, -1, size, A(color));
    }
}
