using System.Collections.Generic;
using Godot;
using TuTien.Core;

namespace TuTienLuc.Art;

public enum TreeKind
{
    Broadleaf,
    Pine,
    Bamboo,
    Blossom,
    Willow,
}

/// <summary>
/// Scenery drawn in the ink style, origin at the base (where it meets the ground) so Y-sorting
/// puts people in front of or behind it naturally. Variants come from a seed; nothing random.
/// </summary>
public static class PropArt
{
    private static Vector2 V(float x, float y) => new(x, y);
    private static float H(int seed, int i) => Paint.Hash(seed, i);

    // ------------------------------------------------------------------ trees

    private static (Color dark, Color mid, Color light) Canopy(Season season, int seed)
    {
        switch (season)
        {
            case Season.Autumn:
                var pick = H(seed, 90);
                if (pick < 0.35f) return (new Color("#9a4a2c"), new Color("#bf6a36"), new Color("#e09a52"));
                if (pick < 0.7f) return (new Color("#a8742c"), new Color("#c99a3c"), new Color("#e6c46a"));
                return (new Color("#6e7a3c"), new Color("#8f9a4a"), new Color("#b8b86a"));
            case Season.Summer:
                return (new Color("#3c6a40"), new Color("#51844c"), new Color("#75a562"));
            case Season.Winter:
                return (new Color("#5a6a58"), new Color("#6f8070"), new Color("#9aa89a"));
            default:
                return (new Color("#4a7b48"), new Color("#5f9356"), new Color("#86b474"));
        }
    }

    public static void Tree(CanvasItem c, TreeKind kind, int seed, Season season, float scale)
    {
        switch (kind)
        {
            case TreeKind.Pine: Pine(c, seed, season, scale); break;
            case TreeKind.Bamboo: Bamboo(c, seed, season, scale); break;
            case TreeKind.Willow: Willow(c, seed, season, scale); break;
            default: Broadleaf(c, seed, season, scale, kind == TreeKind.Blossom); break;
        }
    }

    private static void Trunk(CanvasItem c, float s, float height, Color bark)
    {
        Paint.Poly(c, new[] { V(-7 * s, 0), V(-3 * s, -3 * s), V(-4.4f * s, -height * 0.45f), V(-4.8f * s, -height), V(4.8f * s, -height), V(4.2f * s, -height * 0.45f), V(3 * s, -3 * s), V(7 * s, 0) }, bark);
        Paint.Line2(c, V(-1.5f * s, -4 * s), V(-2 * s, -height * 0.8f), bark.Darkened(0.25f), 1.1f);
        Paint.Line2(c, V(2 * s, -6 * s), V(1.4f * s, -height * 0.6f), bark.Darkened(0.25f), 1);
    }

    private static void Broadleaf(CanvasItem c, int seed, Season season, float s, bool blossom)
    {
        Paint.Shadow(c, V(12 * s, 2 * s), 36 * s, 12 * s, 0.16f);
        var bark = blossom ? new Color("#5a3f33") : new Color("#6b4a32");
        Trunk(c, s, 38 * s, bark);
        if (season == Season.Winter && !blossom)
        {
            // Bare branches with snow.
            for (var i = 0; i < 5; i++)
            {
                var a = -Mathf.Pi / 2 + (i - 2) * 0.45f + (H(seed, i) - 0.5f) * 0.3f;
                var end = V(0, -36 * s) + Vector2.Right.Rotated(a) * (30 + 14 * H(seed, i + 10)) * s;
                Paint.Stroke(c, V(0, -34 * s), end, bark, 2.4f * s, 0.7f);
                Paint.Stroke(c, end, end + Vector2.Right.Rotated(a - 0.5f) * 10 * s, bark, 1.4f * s, 0.6f);
                Paint.Ellipse(c, end + V(0, -2 * s), 6 * s, 2.6f * s, new Color("#f4f6f4"), 0.4f, 1);
            }
            return;
        }
        var (dark, mid, light) = blossom ? (new Color("#c77b93"), new Color("#e3a4b8"), new Color("#f6d2dc")) : Canopy(season, seed);
        var blobs = new[]
        {
            (V(-17, -54), 19f, dark), (V(17, -56), 19f, dark), (V(0, -68), 23f, mid),
            (V(-11, -80), 17f, mid), (V(12, -79), 16f, light), (V(-2, -90), 13f, light),
        };
        var pts = new List<Vector2[]>();
        for (var i = 0; i < blobs.Length; i++)
        {
            var (at, r, _) = blobs[i];
            var jitter = V((H(seed, i) - 0.5f) * 6, (H(seed, i + 20) - 0.5f) * 6);
            pts.Add(Paint.Blob((at + jitter) * s, r * s, r * s * 0.93f, 16, 0.07f, seed * 13 + i));
        }
        foreach (var p in pts) c.DrawPolyline(Paint.Closed(p), Paint.InkA(0.78f), 3.2f, true);
        for (var i = 0; i < pts.Count; i++) c.DrawColoredPolygon(pts[i], Paint.A(blobs[i].Item3));
        // Light from the upper left; blossoms or leaf flecks.
        for (var i = 0; i < 7; i++)
        {
            var at = V(-18 + H(seed, i + 40) * 30, -86 + H(seed, i + 50) * 34) * s;
            c.DrawCircle(at, (2.2f + H(seed, i + 60) * 2) * s, Paint.A(new Color(light.Lightened(0.15f), 0.55f)));
        }
        if (blossom || (season == Season.Spring && H(seed, 99) < 0.25f))
        {
            for (var i = 0; i < 14; i++)
            {
                var at = V(-26 + H(seed, i + 70) * 52, -96 + H(seed, i + 80) * 56) * s;
                c.DrawCircle(at, 1.8f * s, Paint.A(i % 3 == 0 ? new Color("#fff7f9") : new Color("#f3b6c8")));
            }
        }
        Paint.Ellipse(c, V(4, -46) * s, 16 * s, 5 * s, new Color(0, 0, 0, 0.12f), 0);
    }

    private static void Pine(CanvasItem c, int seed, Season season, float s)
    {
        Paint.Shadow(c, V(10 * s, 2 * s), 28 * s, 9 * s, 0.17f);
        Paint.Poly(c, new[] { V(-4 * s, 0), V(4 * s, 0), V(3 * s, -18 * s), V(-3 * s, -18 * s) }, new Color("#5a3d2b"));
        var cols = new[] { new Color("#2c563f"), new Color("#356447"), new Color("#3f7050"), new Color("#4f7d5c") };
        for (var i = 0; i < 4; i++)
        {
            var y = (-22 - i * 17) * s;
            var hw = (31 - i * 6.5f) * s * (0.92f + H(seed, i) * 0.16f);
            var layer = new[]
            {
                V(-hw, y + 6 * s), V(-hw * 0.55f, y + 2 * s), V(-hw * 0.2f, y + 7 * s), V(hw * 0.2f, y + 3 * s),
                V(hw * 0.6f, y + 7 * s), V(hw, y + 5 * s), V(hw * 0.35f, y - 9 * s), V(0, y - 21 * s), V(-hw * 0.35f, y - 9 * s),
            };
            Paint.Poly(c, layer, cols[i], 0.8f, 1.5f);
            Paint.Poly(c, new[] { V(hw * 0.12f, y - 14 * s), V(hw * 0.35f, y - 9 * s), V(hw, y + 5 * s), V(hw * 0.6f, y + 7 * s), V(hw * 0.2f, y + 3 * s) }, new Color(0, 0, 0, 0.12f), 0);
            if (season == Season.Winter)
                Paint.Poly(c, new[] { V(-hw * 0.3f, y - 8 * s), V(0, y - 19 * s), V(hw * 0.3f, y - 8 * s), V(0, y - 5 * s) }, new Color("#f4f6f4"), 0.35f, 1);
        }
    }

    private static void Bamboo(CanvasItem c, int seed, Season season, float s)
    {
        Paint.Shadow(c, V(6 * s, 2 * s), 22 * s, 7 * s, 0.14f);
        var green = season == Season.Autumn ? new Color("#9aa05a") : new Color("#7fa05a");
        for (var i = 0; i < 5; i++)
        {
            var x = (-12 + i * 6 + (H(seed, i) - 0.5f) * 4) * s;
            var h = (70 + H(seed, i + 10) * 40) * s;
            var lean = (H(seed, i + 20) - 0.5f) * 14 * s;
            Paint.Stroke(c, V(x, 0), V(x + lean, -h), green, 3.6f * s, 0.7f);
            for (var y = 14f; y < h / s; y += 14)
            {
                var k = y * s / h;
                var at = V(x + lean * k, -y * s);
                Paint.Line2(c, at - V(2.2f * s, 0), at + V(2.2f * s, 0), green.Darkened(0.35f), 1.2f);
            }
            var top = V(x + lean, -h);
            for (var j = 0; j < 4; j++)
                Paint.Ellipse(c, top + V((j - 1.5f) * 6 * s, (j % 2) * 5 * s), 8 * s, 2.2f * s, green.Darkened(0.1f), 0.5f, 1, (j - 1.5f) * 0.5f, 10);
        }
    }

    private static void Willow(CanvasItem c, int seed, Season season, float s)
    {
        Paint.Shadow(c, V(10 * s, 2 * s), 32 * s, 10 * s, 0.15f);
        Trunk(c, s, 44 * s, new Color("#6b5a42"));
        var (dark, mid, light) = Canopy(season, seed);
        Paint.Poly(c, Paint.Blob(V(0, -60 * s), 30 * s, 20 * s, 14, 0.08f, seed), mid);
        for (var i = 0; i < 12; i++)
        {
            var x = (-28 + i * 5) * s;
            var len = (30 + H(seed, i) * 26) * s;
            var sway = (H(seed, i + 30) - 0.5f) * 6 * s;
            Paint.Line2(c, V(x, -64 * s), V(x + sway, -64 * s + len), i % 2 == 0 ? dark : light, 2 * s);
        }
    }

    public static void Bush(CanvasItem c, int seed, Season season, float s)
    {
        var (dark, mid, light) = Canopy(season, seed + 7);
        var blobs = new[] { (V(-8, -8), 9f, dark), (V(8, -8), 9f, dark), (V(0, -13), 10f, mid), (V(-3, -18), 6f, light) };
        var pts = new List<Vector2[]>();
        for (var i = 0; i < blobs.Length; i++) pts.Add(Paint.Blob(blobs[i].Item1 * s, blobs[i].Item2 * s, blobs[i].Item2 * s * 0.9f, 12, 0.1f, seed + i));
        foreach (var p in pts) c.DrawPolyline(Paint.Closed(p), Paint.InkA(0.7f), 2.4f, true);
        for (var i = 0; i < pts.Count; i++) c.DrawColoredPolygon(pts[i], Paint.A(blobs[i].Item3));
        if (season == Season.Spring && H(seed, 5) < 0.5f)
            for (var i = 0; i < 4; i++) c.DrawCircle(V(-8 + i * 5, -12 - (i % 2) * 5) * s, 1.6f * s, Paint.A(new Color("#f0e6a0")));
    }

    public static void Reeds(CanvasItem c, int seed)
    {
        for (var i = 0; i < 6; i++)
        {
            var x = -12 + i * 5 + (H(seed, i) - 0.5f) * 4;
            var h = 26 + H(seed, i + 9) * 16;
            var top = V(x + (H(seed, i + 3) - 0.5f) * 8, -h);
            Paint.Line2(c, V(x, 0), top, new Color("#6f7a45"), 1.6f);
            if (i % 2 == 0) Paint.Ellipse(c, top + V(0, 4), 2, 5, new Color("#6b4a32"), 0.5f, 1, 0, 10);
        }
    }

    // ------------------------------------------------------------------ rocks and mountains

    public static void Rock(CanvasItem c, int seed, float size, bool snow)
    {
        Paint.Shadow(c, V(size * 0.2f, 1), size * 1.1f, size * 0.35f, 0.18f);
        var body = Paint.Blob(V(0, -size * 0.45f), size, size * 0.62f, 11, 0.16f, seed);
        Paint.Poly(c, body, new Color("#9d968a"), 0.85f, 1.8f);
        var top = Paint.Blob(V(-size * 0.18f, -size * 0.66f), size * 0.62f, size * 0.32f, 9, 0.12f, seed + 3);
        c.DrawColoredPolygon(top, Paint.A(new Color("#bdb6a8")));
        Paint.Line2(c, V(size * 0.1f, -size * 0.55f), V(size * 0.35f, -size * 0.2f), new Color(Paint.Ink, 0.35f), 1.1f);
        if (snow) c.DrawColoredPolygon(Paint.Blob(V(-size * 0.2f, -size * 0.72f), size * 0.5f, size * 0.2f, 8, 0.1f, seed + 5), Paint.A(new Color("#f4f6f4")));
        else if (H(seed, 1) < 0.5f) c.DrawCircle(V(-size * 0.35f, -size * 0.35f), size * 0.18f, Paint.A(new Color("#6d8a55") with { A = 0.8f }));
    }

    /// <summary>A mountain mass for impassable peaks and the world's rim.</summary>
    public static void Cliff(CanvasItem c, int seed, float w, float h, bool snow)
    {
        Paint.Shadow(c, V(10, 4), w * 0.62f, 16, 0.2f);
        var n = 9;
        var ridge = new List<Vector2> { V(-w / 2, 0) };
        var peakIndex = 3 + (int)(H(seed, 0) * 3);
        for (var i = 1; i < n; i++)
        {
            var t = i / (float)n;
            var x = -w / 2 + w * t;
            var bump = Mathf.Sin(t * Mathf.Pi);
            var y = -h * (0.25f + 0.75f * bump) * (0.8f + H(seed, i) * 0.35f);
            if (i == peakIndex) y = -h;
            ridge.Add(V(x, y));
        }
        ridge.Add(V(w / 2, 0));
        var outline = ridge.ToArray();
        Paint.Poly(c, outline, new Color("#8c8474"), 0.9f, 2);
        // Light left faces, dark right faces, split at each summit.
        for (var i = 1; i < outline.Length - 1; i++)
        {
            var top = outline[i];
            if (top.Y > -h * 0.35f) continue;
            // The shadow line runs down-right from the summit, but never past the next ridge point.
            var foot = V(Mathf.Min(top.X + h * 0.12f, outline[i + 1].X - 1), 0);
            c.DrawColoredPolygon(new[] { top, outline[i + 1], V(outline[i + 1].X, 0), foot }, Paint.A(new Color(0.18f, 0.16f, 0.14f, 0.18f)));
            c.DrawColoredPolygon(new[] { outline[i - 1], top, foot, V(outline[i - 1].X, 0) }, Paint.A(new Color(1, 1, 1, 0.08f)));
            Paint.Line2(c, top, foot, new Color(Paint.Ink, 0.3f), 1.2f);
        }
        for (var i = 0; i < 4; i++)
        {
            var y = -h * (0.18f + i * 0.14f);
            var x = -w * 0.3f + H(seed, i + 30) * w * 0.4f;
            Paint.Line2(c, V(x, y), V(x + w * 0.18f, y + 5), new Color(Paint.Ink, 0.22f), 1.1f);
        }
        if (snow)
        {
            foreach (var top in outline)
            {
                if (top.Y > -h * 0.72f) continue;
                c.DrawColoredPolygon(new[] { top + V(0, -1), top + V(h * 0.16f, h * 0.2f), top + V(h * 0.04f, h * 0.15f), top + V(-h * 0.05f, h * 0.24f), top + V(-h * 0.15f, h * 0.18f) },
                    Paint.A(new Color("#f4f6f4")));
            }
        }
        else
        {
            for (var i = 0; i < 3; i++)
                c.DrawCircle(V(-w * 0.3f + i * w * 0.25f, -h * 0.12f), 5 + H(seed, i + 50) * 5, Paint.A(new Color("#5f7a4f") with { A = 0.7f }));
        }
    }

    // ------------------------------------------------------------------ buildings

    private static void Roof(CanvasItem c, float left, float right, float eave, float ridge, Color tile, float curl = 10)
    {
        var w = right - left;
        var roof = new[]
        {
            V(left - 12, eave + 2), V(left - 18 - curl * 0.4f, eave - curl), V(left + w * 0.08f, ridge),
            V(right - w * 0.08f, ridge), V(right + 18 + curl * 0.4f, eave - curl), V(right + 12, eave + 2),
        };
        Paint.Poly(c, roof, tile, 0.9f, 1.8f);
        for (var i = 1; i < 10; i++)
        {
            var t = i / 10f;
            var top = V(left + w * 0.08f + (w * 0.84f) * t, ridge);
            var bottom = V(left - 12 + (w + 24) * t, eave + 1);
            Paint.Line2(c, top, bottom, new Color(1, 1, 1, 0.13f), 1.1f);
        }
        Paint.Stroke(c, V(left + w * 0.06f, ridge - 1), V(right - w * 0.06f, ridge - 1), tile.Darkened(0.35f), 4, 0.7f);
        Paint.Circle(c, V(left + w * 0.06f - 2, ridge - 3), 3, tile.Darkened(0.35f), 0.7f, 1);
        Paint.Circle(c, V(right - w * 0.06f + 2, ridge - 3), 3, tile.Darkened(0.35f), 0.7f, 1);
        Paint.Line2(c, V(left - 12, eave + 2), V(right + 12, eave + 2), tile.Lightened(0.25f), 1.6f);
    }

    private static void Window(CanvasItem c, float x, float y, float w, float h)
    {
        Paint.Poly(c, new[] { V(x, y), V(x + w, y), V(x + w, y + h), V(x, y + h) }, new Color("#3a2a22"), 0.8f, 1.2f);
        for (var i = 1; i < 3; i++)
        {
            Paint.Line2(c, V(x + w * i / 3, y), V(x + w * i / 3, y + h), new Color("#d9c7a0"), 1);
            Paint.Line2(c, V(x, y + h * i / 3), V(x + w, y + h * i / 3), new Color("#d9c7a0"), 1);
        }
    }

    public static void House(CanvasItem c, int seed, float width)
    {
        var w = width;
        var roofColor = H(seed, 1) < 0.6f ? new Color("#4a5566") : new Color("#7a3e30");
        Paint.Shadow(c, V(14, 4), w * 0.6f, 14, 0.2f);
        Paint.Poly(c, new[] { V(-w / 2, -52), V(w / 2, -52), V(w / 2, 0), V(-w / 2, 0) }, new Color("#ece3cc"));
        Paint.Poly(c, new[] { V(-w / 2, -7), V(w / 2, -7), V(w / 2, 0), V(-w / 2, 0) }, new Color("#9a9385"), 0.6f, 1);
        foreach (var x in new[] { -w / 2 + 3, 0, w / 2 - 3 })
            if (x != 0 || w > 150) Paint.Stroke(c, V(x, -52), V(x, -7), new Color("#6b4a32"), 4, 0.6f);
        var doorX = (H(seed, 2) - 0.5f) * w * 0.3f;
        Paint.Poly(c, new[] { V(doorX - 11, -36), V(doorX + 11, -36), V(doorX + 11, -7), V(doorX - 11, -7) }, new Color("#5a3c28"), 0.8f, 1.3f);
        Paint.Line2(c, V(doorX, -36), V(doorX, -7), new Color("#3a2a1e"), 1);
        c.DrawCircle(V(doorX - 3, -21), 1.2f, Paint.A(new Color("#c9a54a")));
        c.DrawCircle(V(doorX + 3, -21), 1.2f, Paint.A(new Color("#c9a54a")));
        foreach (var sx in new[] { -1f, 1f })
        {
            var wx = doorX + sx * (w * 0.28f) - 9;
            if (wx - 2 > -w / 2 && wx + 20 < w / 2) Window(c, wx, -40, 18, 16);
        }
        Paint.Poly(c, new[] { V(-w / 2, -52), V(w / 2, -52), V(w / 2, -45), V(-w / 2, -45) }, new Color(0, 0, 0, 0.18f), 0);
        Roof(c, -w / 2, w / 2, -50, -104, roofColor);
    }

    public static void Inn(CanvasItem c)
    {
        const float w = 200;
        Paint.Shadow(c, V(16, 4), w * 0.6f, 16, 0.2f);
        Paint.Poly(c, new[] { V(-w / 2, -56), V(w / 2, -56), V(w / 2, 0), V(-w / 2, 0) }, new Color("#efe5cc"));
        Paint.Poly(c, new[] { V(-w / 2, -7), V(w / 2, -7), V(w / 2, 0), V(-w / 2, 0) }, new Color("#9a9385"), 0.6f, 1);
        foreach (var x in new[] { -97f, -40, 40, 97 }) Paint.Stroke(c, V(x, -56), V(x, -7), new Color("#7a2e25"), 5, 0.6f);
        Paint.Poly(c, new[] { V(-22, -40), V(22, -40), V(22, -7), V(-22, -7) }, new Color("#5a3c28"), 0.8f, 1.3f);
        Paint.Line2(c, V(0, -40), V(0, -7), new Color("#3a2a1e"), 1.2f);
        Window(c, -78, -44, 26, 20);
        Window(c, 52, -44, 26, 20);
        Roof(c, -w / 2, w / 2, -54, -80, new Color("#4a5566"), 8);
        Paint.Poly(c, new[] { V(-72, -80), V(72, -80), V(72, -120), V(-72, -120) }, new Color("#efe5cc"));
        foreach (var x in new[] { -69f, 69 }) Paint.Stroke(c, V(x, -120), V(x, -80), new Color("#7a2e25"), 4, 0.6f);
        Window(c, -52, -114, 24, 18);
        Window(c, -12, -114, 24, 18);
        Window(c, 28, -114, 24, 18);
        Roof(c, -72, 72, -118, -170, new Color("#4a5566"));
        // Signboard and lanterns.
        Paint.Poly(c, new[] { V(-26, -76), V(26, -76), V(26, -60), V(-26, -60) }, new Color("#2c2a33"), 0.9f, 1.3f);
        Paint.Glyph(c, "客棧", V(0, -68), 13, new Color("#e0c070"));
        foreach (var x in new[] { -34f, 34 })
        {
            Paint.Line2(c, V(x, -56), V(x, -50), Paint.Ink, 1);
            Paint.Ellipse(c, V(x, -42), 6, 8, new Color("#c0392b"), 0.8f, 1.2f);
            c.DrawCircle(V(x, -42), 3.5f, Paint.A(new Color("#ffb070") with { A = 0.6f }));
        }
        Paint.Stroke(c, V(w / 2 + 14, 0), V(w / 2 + 14, -110), new Color("#6b4a32"), 3, 0.7f);
        Paint.Poly(c, new[] { V(w / 2 + 15, -108), V(w / 2 + 40, -104), V(w / 2 + 38, -70), V(w / 2 + 15, -74) }, new Color("#e9dcc0"), 0.8f, 1.2f);
        Paint.Glyph(c, "酒", V(w / 2 + 27, -89), 16, new Color("#9b2a26"));
    }

    public static void Stall(CanvasItem c, int seed)
    {
        Paint.Shadow(c, V(8, 3), 58, 12, 0.18f);
        foreach (var x in new[] { -46f, 46 }) Paint.Stroke(c, V(x, 0), V(x, -60), new Color("#6b4a32"), 3, 0.7f);
        Paint.Poly(c, new[] { V(-44, -30), V(44, -30), V(44, -16), V(-44, -16) }, new Color("#8a5a3a"));
        Paint.Poly(c, new[] { V(-40, -16), V(40, -16), V(38, 0), V(-38, 0) }, new Color("#6b4a32"), 0.7f, 1.2f);
        var goods = new[] { "#c0392b", "#e0a030", "#7fa05a", "#c9a868", "#8a6ab0", "#e0c070" };
        for (var i = 0; i < 9; i++)
            Paint.Circle(c, V(-34 + i * 8.5f, -33 - (i % 2) * 2), 3.6f, new Color(goods[(i + seed) % goods.Length]), 0.6f, 1);
        var awning = new[] { V(-52, -62), V(52, -62), V(58, -44), V(-58, -44) };
        Paint.Poly(c, awning, new Color("#ece3cc"));
        for (var i = 0; i < 6; i++)
        {
            var x0 = -52 + i * 104 / 6f;
            var x1 = x0 + 104 / 12f;
            c.DrawColoredPolygon(new[] { V(x0, -62), V(x1, -62), V(x1 + (x1 / 52) * 6, -44), V(x0 + (x0 / 52) * 6, -44) }, Paint.A(new Color("#b0413a")));
        }
        c.DrawPolyline(Paint.Closed(awning), Paint.InkA(0.85f), 1.6f, true);
        Paint.Ellipse(c, V(-30, -2), 9, 5, new Color("#a07a4a"), 0.7f, 1.1f);
        Paint.Ellipse(c, V(32, -2), 8, 5, new Color("#a07a4a"), 0.7f, 1.1f);
    }

    public static void NoticeBoard(CanvasItem c)
    {
        Paint.Shadow(c, V(6, 2), 34, 8, 0.18f);
        foreach (var x in new[] { -30f, 30 }) Paint.Stroke(c, V(x, 0), V(x, -70), new Color("#5b3d2b"), 4, 0.8f);
        Paint.Poly(c, new[] { V(-32, -64), V(32, -64), V(32, -24), V(-32, -24) }, new Color("#8a6a48"));
        var notes = new[] { V(-26, -60), V(-6, -58), V(12, -60) };
        foreach (var n in notes)
        {
            Paint.Poly(c, new[] { n, n + V(15, 0), n + V(15, 26), n + V(0, 26) }, new Color("#f1e9d2"), 0.6f, 1);
            for (var i = 0; i < 4; i++) Paint.Line2(c, n + V(3, 5 + i * 5), n + V(12, 5 + i * 5), new Color(Paint.Ink, 0.45f), 0.8f);
        }
        Roof(c, -34, 34, -68, -84, new Color("#4a5566"), 5);
        Paint.Poly(c, new[] { V(-9, -96), V(9, -96), V(9, -84), V(-9, -84) }, new Color("#2c2a33"), 0.8f, 1);
        Paint.Glyph(c, "榜", V(0, -90), 11, new Color("#e0c070"));
    }

    public static void Well(CanvasItem c)
    {
        Paint.Shadow(c, V(4, 2), 26, 8, 0.18f);
        Paint.Ellipse(c, V(0, -8), 22, 11, new Color("#9d968a"), 0.85f, 1.6f);
        Paint.Ellipse(c, V(0, -10), 15, 7, new Color("#2a3440"), 0.6f, 1);
        foreach (var x in new[] { -18f, 18 }) Paint.Stroke(c, V(x, -6), V(x, -46), new Color("#6b4a32"), 3, 0.7f);
        Paint.Stroke(c, V(-20, -44), V(20, -44), new Color("#6b4a32"), 3, 0.7f);
        Paint.Line2(c, V(0, -44), V(0, -26), new Color("#8a7a5a"), 1);
        Paint.Poly(c, new[] { V(-5, -26), V(5, -26), V(4, -18), V(-4, -18) }, new Color("#8a6a48"), 0.7f, 1);
        Roof(c, -22, 22, -46, -60, new Color("#4a5566"), 4);
    }

    public static void Lantern(CanvasItem c, bool stone, float time)
    {
        if (stone)
        {
            Paint.Shadow(c, V(3, 2), 12, 4, 0.18f);
            Paint.Poly(c, new[] { V(-6, 0), V(6, 0), V(4, -20), V(-4, -20) }, new Color("#a8a294"));
            Paint.Poly(c, new[] { V(-9, -20), V(9, -20), V(9, -32), V(-9, -32) }, new Color("#b8b2a4"));
            c.DrawCircle(V(0, -26), 3.5f, Paint.A(new Color("#ffcf80") with { A = 0.7f + 0.2f * Mathf.Sin(time * 3) }));
            Paint.Poly(c, new[] { V(-13, -32), V(13, -32), V(0, -44) }, new Color("#8c8474"));
            return;
        }
        Paint.Stroke(c, V(0, 0), V(0, -54), new Color("#5b3d2b"), 2.6f, 0.7f);
        Paint.Line2(c, V(0, -54), V(12, -54), new Color("#5b3d2b"), 2);
        Paint.Ellipse(c, V(12, -44), 6, 8, new Color("#c0392b"), 0.8f, 1.2f);
        c.DrawCircle(V(12, -44), 3.5f, Paint.A(new Color("#ffb070") with { A = 0.55f + 0.2f * Mathf.Sin(time * 4) }));
    }

    public static void Fence(CanvasItem c, float length)
    {
        var posts = Mathf.Max(2, (int)(length / 22) + 1);
        for (var i = 0; i < posts; i++)
        {
            var x = -length / 2 + length * i / (posts - 1);
            Paint.Stroke(c, V(x, 0), V(x, -20), new Color("#7a5a3e"), 2.6f, 0.6f);
        }
        Paint.Stroke(c, V(-length / 2, -15), V(length / 2, -15), new Color("#8a6a48"), 2, 0.5f);
        Paint.Stroke(c, V(-length / 2, -7), V(length / 2, -7), new Color("#8a6a48"), 2, 0.5f);
    }

    public static void Crates(CanvasItem c, int seed)
    {
        Paint.Shadow(c, V(4, 2), 22, 6, 0.16f);
        Paint.Poly(c, new[] { V(-16, 0), V(2, 0), V(2, -16), V(-16, -16) }, new Color("#9a7a52"), 0.8f, 1.3f);
        Paint.Line2(c, V(-16, -16), V(2, 0), new Color("#6b4a32"), 1);
        Paint.Ellipse(c, V(10, -8), 8, 9, new Color("#8a6a48"), 0.8f, 1.3f);
        Paint.Line2(c, V(2.5f, -12), V(17.5f, -12), new Color("#5b3d2b"), 1.2f);
        if (H(seed, 3) < 0.5f) Paint.Ellipse(c, V(-4, -21), 10, 5, new Color("#d9b867"), 0.7f, 1.1f);
    }

    // ------------------------------------------------------------------ the sect

    public static void SectGate(CanvasItem c)
    {
        Paint.Shadow(c, V(10, 4), 140, 16, 0.2f);
        var red = new Color("#9b2a26");
        foreach (var x in new[] { -104f, 104 })
        {
            Paint.Poly(c, new[] { V(x - 10, 0), V(x + 10, 0), V(x + 9, -8), V(x - 9, -8) }, new Color("#a8a294"));
            Paint.Stroke(c, V(x, -8), V(x, -112), red, 9, 0.8f);
        }
        foreach (var x in new[] { -42f, 42 })
        {
            Paint.Poly(c, new[] { V(x - 11, 0), V(x + 11, 0), V(x + 10, -8), V(x - 10, -8) }, new Color("#a8a294"));
            Paint.Stroke(c, V(x, -8), V(x, -150), red, 10, 0.8f);
        }
        Paint.Stroke(c, V(-112, -98), V(-34, -98), new Color("#3a2a22"), 6, 0.7f);
        Paint.Stroke(c, V(34, -98), V(112, -98), new Color("#3a2a22"), 6, 0.7f);
        Paint.Stroke(c, V(-48, -132), V(48, -132), new Color("#3a2a22"), 7, 0.7f);
        Paint.Stroke(c, V(-48, -104), V(48, -104), new Color("#3a2a22"), 5, 0.7f);
        Roof(c, -112, -40, -112, -134, new Color("#2f3b4c"), 8);
        Roof(c, 40, 112, -112, -134, new Color("#2f3b4c"), 8);
        Roof(c, -54, 54, -150, -184, new Color("#2f3b4c"), 12);
        Paint.Poly(c, new[] { V(-30, -127), V(30, -127), V(30, -108), V(-30, -108) }, new Color("#1f3550"), 0.9f, 1.4f);
        Paint.Poly(c, new[] { V(-27, -124), V(27, -124), V(27, -111), V(-27, -111) }, new Color("#c9a54a") with { A = 0.25f }, 0);
        Paint.Glyph(c, "青雲", V(0, -118), 14, new Color("#e0c070"));
    }

    public static void Hall(CanvasItem c)
    {
        const float w = 300;
        Paint.Shadow(c, V(18, 6), w * 0.62f, 20, 0.2f);
        Paint.Poly(c, new[] { V(-w / 2 - 14, 0), V(w / 2 + 14, 0), V(w / 2 + 6, -16), V(-w / 2 - 6, -16) }, new Color("#b8b2a4"));
        for (var i = 0; i < 3; i++) Paint.Line2(c, V(-40, -4 - i * 4), V(40, -4 - i * 4), new Color(Paint.Ink, 0.3f), 1);
        Paint.Poly(c, new[] { V(-w / 2, -86), V(w / 2, -86), V(w / 2, -16), V(-w / 2, -16) }, new Color("#efe5cc"));
        for (var i = 0; i < 7; i++) Paint.Stroke(c, V(-w / 2 + 8 + i * (w - 16) / 6, -86), V(-w / 2 + 8 + i * (w - 16) / 6, -16), new Color("#9b2a26"), 7, 0.7f);
        Paint.Poly(c, new[] { V(-30, -70), V(30, -70), V(30, -16), V(-30, -16) }, new Color("#5a3c28"), 0.8f, 1.4f);
        Window(c, -110, -70, 36, 26);
        Window(c, 74, -70, 36, 26);
        Roof(c, -w / 2, w / 2, -84, -122, new Color("#2f3b4c"), 10);
        Paint.Poly(c, new[] { V(-w / 2 + 40, -122), V(w / 2 - 40, -122), V(w / 2 - 40, -140), V(-w / 2 + 40, -140) }, new Color("#efe5cc"));
        Roof(c, -w / 2 + 40, w / 2 - 40, -138, -186, new Color("#2f3b4c"), 12);
        Paint.Poly(c, new[] { V(-34, -118), V(34, -118), V(34, -100), V(-34, -100) }, new Color("#1f3550"), 0.9f, 1.3f);
        Paint.Glyph(c, "青雲殿", V(0, -109), 12, new Color("#e0c070"));
    }

    public static void Pagoda(CanvasItem c)
    {
        Paint.Shadow(c, V(10, 4), 60, 14, 0.2f);
        Paint.Poly(c, new[] { V(-46, 0), V(46, 0), V(40, -12), V(-40, -12) }, new Color("#b8b2a4"));
        var y = -12f;
        for (var i = 0; i < 5; i++)
        {
            var hw = 34 - i * 5.5f;
            var wall = 30 - i * 2;
            Paint.Poly(c, new[] { V(-hw, y), V(hw, y), V(hw, y - wall), V(-hw, y - wall) }, new Color("#efe5cc"));
            Paint.Poly(c, new[] { V(-6, y - 4), V(6, y - 4), V(6, y - wall + 6), V(-6, y - wall + 6) }, new Color("#5a3c28"), 0.7f, 1);
            Roof(c, -hw, hw, y - wall + 2, y - wall - 16, new Color("#2f3b4c"), 7);
            y -= wall + 14;
        }
        Paint.Stroke(c, V(0, y + 2), V(0, y - 24), new Color("#c9a54a"), 2.4f, 0.6f);
        for (var i = 0; i < 3; i++) Paint.Circle(c, V(0, y - 6 - i * 6), 2.6f, new Color("#c9a54a"), 0.6f, 1);
    }

    public static void Dummy(CanvasItem c)
    {
        Paint.Shadow(c, V(3, 2), 12, 4, 0.16f);
        Paint.Stroke(c, V(0, 0), V(0, -44), new Color("#7a5a3e"), 4, 0.7f);
        Paint.Stroke(c, V(-14, -30), V(14, -30), new Color("#7a5a3e"), 3, 0.7f);
        Paint.Circle(c, V(0, -48), 7, new Color("#d9b867"));
        Paint.Line2(c, V(-4, -50), V(4, -46), new Color(Paint.Ink, 0.5f), 1);
    }

    public static void Incense(CanvasItem c, float time)
    {
        Paint.Shadow(c, V(4, 2), 20, 6, 0.18f);
        foreach (var x in new[] { -10f, 0, 10 }) Paint.Stroke(c, V(x * 0.9f, 0), V(x, -14), new Color("#6f5a3a"), 3, 0.6f);
        Paint.Ellipse(c, V(0, -20), 18, 9, new Color("#8a6a3a"));
        Paint.Ellipse(c, V(0, -24), 14, 4, new Color("#5a4a2a"), 0.6f, 1);
        for (var i = 0; i < 3; i++)
        {
            var t = (time * 0.4f + i / 3f) % 1f;
            var p = V(Mathf.Sin(time + i * 2) * 6 * t, -28 - t * 60);
            c.DrawCircle(p, 4 + t * 8, Paint.A(new Color(0.85f, 0.85f, 0.85f, 0.35f * (1 - t))));
        }
    }

    // ------------------------------------------------------------------ places of power

    public static void Cave(CanvasItem c, float time)
    {
        Paint.Shadow(c, V(10, 4), 110, 18, 0.22f);
        var rock = Paint.Blob(V(0, -58), 100, 64, 18, 0.1f, 17);
        Paint.Poly(c, rock, new Color("#8a8374"), 0.9f, 2);
        c.DrawColoredPolygon(Paint.Blob(V(-24, -80), 60, 30, 12, 0.1f, 19), Paint.A(new Color(1, 1, 1, 0.08f)));
        var mouth = new List<Vector2> { V(-34, 0) };
        for (var i = 0; i <= 12; i++)
        {
            var t = Mathf.Pi + Mathf.Pi * i / 12;
            mouth.Add(V(Mathf.Cos(t) * 34, -8 + Mathf.Sin(t) * 50));
        }
        mouth.Add(V(34, 0));
        Paint.Poly(c, mouth.ToArray(), new Color("#1a1422"), 0.9f, 2);
        var pulse = 0.6f + 0.4f * Mathf.Sin(time * 2);
        for (var i = 0; i < 4; i++)
            c.DrawCircle(V(0, -22), 26 - i * 6, Paint.A(new Color(0.55f, 0.35f, 0.75f, 0.10f + 0.06f * i * pulse)));
        for (var i = 0; i < 5; i++)
        {
            var x = -30 + i * 15;
            Paint.Line2(c, V(x, -52 + (i % 2) * 4), V(x + 2, -30 - (i % 3) * 6), new Color("#4f7a45"), 2);
        }
        Paint.Glyph(c, "秘", V(0, -128 + Mathf.Sin(time * 1.5f) * 4), 22, new Color(0.75f, 0.6f, 0.95f, 0.8f));
    }

    public static void Crystals(CanvasItem c, float time)
    {
        var pulse = 0.5f + 0.5f * Mathf.Sin(time * 1.8f);
        c.DrawCircle(V(0, -30), 58 + pulse * 6, Paint.A(new Color(0.55f, 0.85f, 0.7f, 0.12f)));
        Paint.Shadow(c, V(6, 2), 40, 10, 0.18f);
        for (var i = 0; i < 7; i++)
        {
            var a = Mathf.Tau * i / 7;
            Paint.Circle(c, V(Mathf.Cos(a) * 34, -2 + Mathf.Sin(a) * 12), 6, new Color("#a8a294"), 0.7f, 1.2f);
        }
        var shards = new[] { (-16f, 44f, -0.25f), (14f, 52f, 0.2f), (0f, 72f, 0f), (-6f, 36f, -0.5f), (22f, 34f, 0.55f) };
        foreach (var (x, h, lean) in shards)
        {
            var baseL = V(x - 7, 0);
            var baseR = V(x + 7, 0);
            var tip = V(x + lean * h * 0.5f, -h);
            var pts = new[] { baseL, baseR, V(x + 7 + lean * h * 0.4f, -h * 0.78f), tip, V(x - 7 + lean * h * 0.4f, -h * 0.78f) };
            Paint.Poly(c, pts, new Color("#7fd0a8"), 0.85f, 1.5f);
            c.DrawColoredPolygon(new[] { baseL, V(x, 0), V(x + lean * h * 0.45f, -h * 0.9f), V(x - 7 + lean * h * 0.4f, -h * 0.78f) }, Paint.A(new Color("#c8f5dc") with { A = 0.6f }));
        }
        Paint.Glyph(c, "脈", V(0, -96 + Mathf.Sin(time * 1.3f) * 3), 18, new Color(0.4f, 0.75f, 0.55f, 0.75f));
    }

    public static void Spring(CanvasItem c, float time)
    {
        var rim = Paint.EllipsePts(V(0, -8), 74, 38, 28);
        Paint.Poly(c, rim, new Color("#a8a294"), 0.8f, 1.6f);
        Paint.Poly(c, Paint.EllipsePts(V(0, -8), 64, 31, 28), new Color("#6fa0ac"), 0.5f, 1);
        c.DrawColoredPolygon(Paint.EllipsePts(V(-10, -14), 40, 16, 20), Paint.A(new Color(1, 1, 1, 0.12f)));
        for (var i = 0; i < 3; i++)
        {
            var t = (time * 0.35f + i / 3f) % 1f;
            c.DrawArc(V(8, -6), 6 + t * 30, 0, Mathf.Tau, 28, Paint.A(new Color(1, 1, 1, 0.35f * (1 - t))), 1.2f, true);
        }
        foreach (var (at, r) in new[] { (V(-38, -12), 9f), (V(34, -2), 8f), (V(-20, 4), 6f) })
        {
            Paint.Circle(c, at, r, new Color("#5f8f53"), 0.6f, 1);
            c.DrawColoredPolygon(new[] { at, at + V(r, -r * 0.3f), at + V(r, r * 0.3f) }, Paint.A(new Color("#6fa0ac")));
        }
        Paint.Circle(c, V(-38, -16), 3.5f, new Color("#f3b6c8"), 0.6f, 1);
        for (var i = 0; i < 3; i++)
        {
            var t = (time * 0.2f + i / 3f) % 1f;
            c.DrawCircle(V(-30 + i * 28, -20 - t * 40), 10 + t * 14, Paint.A(new Color(1, 1, 1, 0.12f * (1 - t))));
        }
    }

    public static void Herb(CanvasItem c, bool ready, float time, int seed)
    {
        Paint.Shadow(c, V(3, 1), 20, 6, 0.16f);
        var leaf = ready ? new Color("#5f9356") : new Color("#9a9468");
        for (var i = 0; i < 6; i++)
        {
            var a = -Mathf.Pi / 2 + (i - 2.5f) * 0.42f;
            var tip = Vector2.Right.Rotated(a) * (18 + H(seed, i) * 6);
            Paint.Poly(c, new[] { V(0, -2), tip * 0.5f + V(-tip.Y, tip.X).Normalized() * 5 + V(0, -2), tip + V(0, -2), tip * 0.5f - V(-tip.Y, tip.X).Normalized() * 5 + V(0, -2) }, leaf, 0.7f, 1.1f);
        }
        if (!ready) return;
        var glow = 0.5f + 0.5f * Mathf.Sin(time * 3 + seed);
        for (var i = 0; i < 3; i++)
        {
            var at = V(-8 + i * 8, -22 - (i % 2) * 6);
            Paint.Line2(c, V(-2 + i * 2, -4), at, new Color("#4f7a45"), 1.2f);
            c.DrawCircle(at, 5 + glow * 2, Paint.A(new Color(1f, 0.55f, 0.45f, 0.18f)));
            Paint.Circle(c, at, 2.8f, new Color("#e05a4a"), 0.6f, 1);
        }
    }

    public static void Stele(CanvasItem c)
    {
        Paint.Shadow(c, V(6, 2), 24, 7, 0.18f);
        Paint.Poly(c, new[] { V(-20, 0), V(20, 0), V(16, -10), V(-16, -10) }, new Color("#8c8474"));
        Paint.Poly(c, new[] { V(-13, -10), V(13, -10), V(12, -74), V(-12, -74) }, new Color("#a8a294"));
        Paint.Poly(c, new[] { V(-16, -74), V(16, -74), V(0, -88) }, new Color("#6f685c"));
        Paint.Glyph(c, "關", V(0, -44), 18, new Color("#3a3a44"));
    }

    public static void QiPillar(CanvasItem c, float time)
    {
        var pulse = 0.5f + 0.5f * Mathf.Sin(time * 3);
        c.DrawCircle(V(0, -4), 26 + pulse * 6, Paint.A(new Color(0.95f, 0.8f, 0.4f, 0.16f)));
        Paint.Ellipse(c, V(0, -4), 20, 7, new Color(0.95f, 0.8f, 0.4f, 0.45f), 0);
        for (var i = 0; i < 6; i++)
        {
            var w = 12 - i * 1.6f;
            c.DrawColoredPolygon(new[] { V(-w, -4), V(w, -4), V(w * 0.6f, -140), V(-w * 0.6f, -140) }, Paint.A(new Color(1f, 0.86f, 0.5f, 0.07f)));
        }
        Paint.Glyph(c, "奇", V(0, -96 + Mathf.Sin(time * 2) * 5), 24, new Color(0.63f, 0.48f, 0.18f, 0.95f));
    }

    public static void Chest(CanvasItem c, bool open, float time)
    {
        Paint.Shadow(c, V(4, 2), 24, 7, 0.2f);
        Paint.Poly(c, new[] { V(-20, 0), V(20, 0), V(20, -22), V(-20, -22) }, new Color("#7a4e2e"));
        Paint.Stroke(c, V(-20, -11), V(20, -11), new Color("#c9a54a"), 2, 0.5f);
        if (open)
        {
            Paint.Poly(c, new[] { V(-20, -22), V(20, -22), V(18, -38), V(-18, -38) }, new Color("#6a4226"));
            c.DrawCircle(V(0, -26), 12, Paint.A(new Color(1f, 0.85f, 0.45f, 0.3f)));
        }
        else
        {
            Paint.Poly(c, new[] { V(-21, -22), V(21, -22), V(18, -32), V(-18, -32) }, new Color("#8a5a34"));
            Paint.Circle(c, V(0, -20), 3.4f, new Color("#e0c070"), 0.7f, 1);
            c.DrawCircle(V(0, -16), 18 + Mathf.Sin(time * 3) * 2, Paint.A(new Color(1f, 0.85f, 0.45f, 0.1f)));
        }
    }

    public static void Portal(CanvasItem c, float time, Color color)
    {
        Paint.Ellipse(c, V(0, -6), 46, 16, new Color("#6f685c"), 0.8f, 1.6f);
        for (var i = 0; i < 4; i++)
        {
            var a = time * (1.2f + i * 0.4f) + i;
            c.DrawArc(V(0, -8), 34 - i * 7, a, a + 4.2f, 32, Paint.A(new Color(color, 0.55f)), 3, true);
        }
        c.DrawCircle(V(0, -8), 12, Paint.A(new Color(color, 0.5f)));
        c.DrawCircle(V(0, -8), 5, Paint.A(new Color(1, 1, 1, 0.8f)));
    }
}
