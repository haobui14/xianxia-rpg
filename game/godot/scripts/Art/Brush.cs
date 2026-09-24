using System;
using System.Collections.Generic;
using Godot;

namespace TuTienLuc.Art;

/// <summary>
/// Draws like a <see cref="CanvasItem"/>, but gathers everything one <c>_Draw</c> paints into a single
/// triangle list. Godot's compatibility renderer gives every circle, arc, polyline and polygon its own
/// vertex and index buffers; a painted tree is dozens of shapes, and the valley came to some 90,000
/// buffers, far more than a phone's graphics driver survives (on Android the game closed the moment the
/// world opened). Through a brush a tree costs one set, and a figure redrawn every frame one set a frame.
/// The shapes follow Godot's own geometry (the 1.25 px feather of anti-aliased lines, mitred joints),
/// so the art looks the same. Text passes straight through to the canvas item, in order.
/// Use: <c>using var b = Brush.On(this);</c> at the top of <c>_Draw</c>.
/// </summary>
public sealed class Brush : IDisposable
{
    /// <summary>Godot's anti-aliasing feather (servers/rendering/renderer_canvas_cull.cpp).</summary>
    private const float Feather = 1.25f;

    // Drawing happens on the main thread only; nested brushes (an icon inside a HUD) each take their own.
    private static readonly Stack<Brush> Pool = new();

    private CanvasItem _ci = null!;
    private Vector2[] _pts = new Vector2[512];
    private Color[] _cols = new Color[512];
    private int[] _idx = new int[1536];
    private Vector2[] _scratch = new Vector2[72];
    private int _np, _ni;
    private Transform2D _xf = Transform2D.Identity;
    private bool _moved;
    private float _scale = 1;

    private Brush()
    {
    }

    /// <summary>A brush over <paramref name="canvas"/> for this <c>_Draw</c>; disposing it hands the shapes to Godot.</summary>
    public static Brush On(CanvasItem canvas)
    {
        var b = Pool.Count > 0 ? Pool.Pop() : new Brush();
        b._ci = canvas;
        b._np = b._ni = 0;
        b.DrawSetTransformMatrix(Transform2D.Identity);
        return b;
    }

    public CanvasItem Canvas => _ci;

    public void Dispose()
    {
        Flush();
        _ci = null!;
        Pool.Push(this);
    }

    /// <summary>Hand what has been painted so far to Godot as one triangle list.</summary>
    public void Flush()
    {
        if (_ni > 0 && _np > 0)
        {
            RenderingServer.CanvasItemAddTriangleArray(_ci.GetCanvasItem(), _idx.AsSpan(0, _ni), _pts.AsSpan(0, _np), _cols.AsSpan(0, _np),
                ReadOnlySpan<Vector2>.Empty, ReadOnlySpan<int>.Empty, ReadOnlySpan<float>.Empty, default, -1);
        }
        _np = _ni = 0;
    }

    // ================================================================ transform

    public void DrawSetTransform(Vector2 position, float rotation = 0, Vector2? scale = null) =>
        DrawSetTransformMatrix(new Transform2D(rotation, scale ?? Vector2.One, 0, position));

    /// <summary>Shapes drawn from here on are placed through <paramref name="xf"/> (baked into the vertices).</summary>
    public void DrawSetTransformMatrix(Transform2D xf)
    {
        _xf = xf;
        _moved = xf != Transform2D.Identity;
        _scale = Mathf.Max(1, Mathf.Max(xf.X.Length(), xf.Y.Length()));
    }

    // ================================================================ shapes

    public void DrawColoredPolygon(Vector2[] points, Color color)
    {
        var n = points.Length;
        if (n < 3) return;
        if (Convex(points))
        {
            var first = Reserve(n);
            for (var i = 0; i < n; i++) Set(first + i, points[i], color);
            for (var i = 1; i < n - 1; i++) Tri(first, first + i, first + i + 1);
            return;
        }
        // Godot draws nothing for a polygon it can't triangulate; neither does the brush.
        var tris = Geometry2D.TriangulatePolygon(points);
        if (tris.Length < 3) return;
        var start = Reserve(n);
        for (var i = 0; i < n; i++) Set(start + i, points[i], color);
        EnsureIndices(tris.Length);
        foreach (var t in tris) _idx[_ni++] = start + t;
    }

    public void DrawCircle(Vector2 position, float radius, Color color, bool filled = true, float width = -1, bool antialiased = false)
    {
        if (filled)
        {
            Ellipse(position, radius, radius, color, antialiased);
            return;
        }
        if (width >= 2 * radius)
        {
            Ellipse(position, radius + width / 2, radius + width / 2, color, antialiased);
            return;
        }
        var n = Segments(radius);
        var pts = Scratch(n + 1);
        for (var i = 0; i <= n; i++)
        {
            var a = Mathf.Tau * i / n;
            pts[i] = position + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * radius;
        }
        Polyline(pts, color, width, antialiased);
    }

    public void DrawArc(Vector2 center, float radius, float startAngle, float endAngle, int pointCount, Color color, float width = -1, bool antialiased = false)
    {
        if (pointCount < 2) return;
        var pts = Scratch(pointCount);
        var delta = Mathf.Clamp(endAngle - startAngle, -Mathf.Tau, Mathf.Tau);
        for (var i = 0; i < pointCount; i++)
        {
            var t = i / (pointCount - 1f) * delta + startAngle;
            pts[i] = center + new Vector2(radius * Mathf.Cos(t), radius * Mathf.Sin(t));
        }
        Polyline(pts, color, width, antialiased);
    }

    public void DrawPolyline(Vector2[] points, Color color, float width = -1, bool antialiased = false) =>
        Polyline(points, color, width, antialiased);

    public void DrawLine(Vector2 from, Vector2 to, Color color, float width = -1, bool antialiased = false)
    {
        var diff = from - to;
        var dir = diff.Orthogonal().Normalized();
        if (antialiased) width = Compensated(width);
        // Godot draws a hair line (one screen pixel) for a negative width; the brush a line one unit wide.
        if (width < 0)
        {
            width = 1;
            antialiased = false;
        }
        var t = dir * width * 0.5f;
        Vector2 bl = from + t, br = from - t, el = to + t, er = to - t;
        Quad(bl, br, er, el, color, color, color, color);
        if (!antialiased) return;
        var border = Feather;
        if (width < 1) border *= width;
        var b = dir * border;
        var b2 = diff.Normalized() * border;
        var clear = new Color(color, 0);
        Quad(bl, bl + b, el + b, el, color, clear, clear, color);
        Quad(br, br - b, er - b, er, color, clear, clear, color);
        Quad(bl, bl + b2, br + b2, br, color, clear, clear, color);
        Quad(el, el - b2, er - b2, er, color, clear, clear, color);
        Quad(bl, bl + b2, bl + b + b2, bl + b, color, clear, clear, clear);
        Quad(br, br + b2, br - b + b2, br - b, color, clear, clear, clear);
        Quad(el, el - b2, el + b - b2, el + b, color, clear, clear, clear);
        Quad(er, er - b2, er - b - b2, er - b, color, clear, clear, clear);
    }

    public void DrawRect(Rect2 rect, Color color, bool filled = true, float width = -1)
    {
        rect = rect.Abs();
        if (!filled && width < rect.Size.X && width < rect.Size.Y)
        {
            var pts = Scratch(5);
            pts[0] = rect.Position;
            pts[1] = rect.Position + new Vector2(rect.Size.X, 0);
            pts[2] = rect.End;
            pts[3] = rect.Position + new Vector2(0, rect.Size.Y);
            pts[4] = rect.Position;
            Polyline(pts, color, width, false);
            return;
        }
        if (!filled) rect = rect.Grow(0.5f * width);
        Quad(rect.Position, rect.Position + new Vector2(rect.Size.X, 0), rect.End, rect.Position + new Vector2(0, rect.Size.Y), color, color, color, color);
    }

    // ================================================================ passed straight through (in order)

    public void DrawString(Font font, Vector2 pos, string text, HorizontalAlignment alignment = HorizontalAlignment.Left, float width = -1, int fontSize = 16, Color? modulate = null)
    {
        Through();
        _ci.DrawString(font, pos, text, alignment, width, fontSize, modulate);
        Back();
    }

    public void DrawStringOutline(Font font, Vector2 pos, string text, HorizontalAlignment alignment = HorizontalAlignment.Left, float width = -1, int fontSize = 16, int size = 1, Color? modulate = null)
    {
        Through();
        _ci.DrawStringOutline(font, pos, text, alignment, width, fontSize, size, modulate);
        Back();
    }

    public void DrawTextureRect(Texture2D texture, Rect2 rect, bool tile, Color? modulate = null)
    {
        Through();
        _ci.DrawTextureRect(texture, rect, tile, modulate);
        Back();
    }

    private void Through()
    {
        Flush();
        if (_moved) _ci.DrawSetTransformMatrix(_xf);
    }

    private void Back()
    {
        if (_moved) _ci.DrawSetTransformMatrix(Transform2D.Identity);
    }

    // ================================================================ geometry (after Godot's)

    /// <summary>How many sides a circle needs to look round: Godot always uses 64, most of ours are a few pixels wide.</summary>
    private int Segments(float radius) => Math.Clamp((int)(radius * _scale * 0.9f) + 10, 12, 64);

    private void Ellipse(Vector2 c, float major, float minor, Color color, bool antialiased)
    {
        if (antialiased)
        {
            major = Mathf.Max(0, major - Feather * 0.25f);
            minor = Mathf.Max(0, minor - Feather * 0.25f);
        }
        var n = Segments(Mathf.Max(major, minor));
        var first = Reserve(n + 2);
        var centre = first + n + 1;
        Set(centre, c, color);
        for (var i = 0; i <= n; i++)
        {
            var a = Mathf.Tau * i / n;
            Set(first + i, c + new Vector2(Mathf.Cos(a) * major, Mathf.Sin(a) * minor), color);
        }
        EnsureIndices(n * 3);
        for (var i = 0; i < n; i++) Tri(centre, first + i, first + i + 1);
        if (!antialiased) return;

        var border = Feather;
        var axis = Mathf.Max(major, minor) * 2;
        if (axis < 1) border *= axis * 0.5f;
        var clear = new Color(color, 0);
        var ring = Reserve(2 * n + 2);
        for (var i = 0; i <= n; i++)
        {
            var a = Mathf.Tau * i / n;
            var cs = Mathf.Cos(a);
            var sn = Mathf.Sin(a);
            Set(ring + i * 2, c + new Vector2(cs * major, sn * minor), color);
            Set(ring + i * 2 + 1, c + new Vector2(cs * (major + border), sn * (minor + border)), clear);
        }
        Strip(ring, 2 * n + 2);
    }

    private static float Compensated(float width)
    {
        if (width <= 0) return width;
        if (width <= Feather * 2 + 1e-5f) return width * 0.5f;
        if (width <= Feather * 4 + 1e-5f) return Mathf.Remap(width, Feather * 2, Feather * 4, width * 0.5f, width - Feather * 0.5f);
        return width - Feather * 0.5f;
    }

    private static Vector2 SegmentDir(ReadOnlySpan<Vector2> p, int i, Vector2 prev)
    {
        if (i == p.Length - 1) return prev;
        var d = (p[i + 1] - p[i]).Normalized();
        return d.IsZeroApprox() ? prev : d;
    }

    private static Vector2 EdgeOffsetClamped(Vector2 seg, Vector2 prev)
    {
        var length = 1f;
        var bisector = (prev * seg.Length() - seg * prev.Length()).Normalized();
        var angle = Mathf.Atan2(bisector.Cross(prev), bisector.Dot(prev));
        var sin = Mathf.Sin(angle);
        if (!Mathf.IsZeroApprox(sin) && !seg.IsEqualApprox(prev)) length = Mathf.Clamp(1f / sin, -3f, 3f);
        else bisector = seg.Orthogonal();
        if (bisector.IsZeroApprox()) bisector = seg.Orthogonal();
        return bisector * length;
    }

    /// <summary>A ribbon along the points, with Godot's feathered edges and ends when anti-aliased.</summary>
    private void Polyline(ReadOnlySpan<Vector2> p, Color color, float width, bool antialiased)
    {
        var n = p.Length;
        if (n < 2) return;
        if (antialiased) width = Compensated(width);
        if (width < 0)
        {
            width = 1;
            antialiased = false;
        }
        var loop = p[0].IsEqualApprox(p[n - 1]);
        Vector2 firstDir = default, lastDir = default;
        for (var i = 1; i < n; i++)
        {
            firstDir = (p[i] - p[i - 1]).Normalized();
            if (!firstDir.IsZeroApprox()) break;
        }
        for (var i = n - 1; i >= 1; i--)
        {
            lastDir = (p[i] - p[i - 1]).Normalized();
            if (!lastDir.IsZeroApprox()) break;
        }

        var caps = antialiased && !loop;
        var mainCount = 2 * n + (caps ? 4 : 0);
        var main = Reserve(mainCount);
        var sideCount = 2 * n + (loop ? 0 : 5);
        int left = 0, right = 0;
        if (antialiased)
        {
            left = Reserve(sideCount);
            right = Reserve(sideCount);
        }
        var border = Feather;
        if (width < 1) border *= width;
        var clear = new Color(color, 0);

        var prevDir = Vector2.Zero;
        for (var i = 0; i < n; i++)
        {
            var isFirst = i == 0;
            var isLast = i == n - 1;
            var segDir = SegmentDir(p, i, prevDir);
            if (isFirst && loop) prevDir = lastDir;
            else if (isLast && loop) prevDir = firstDir;

            Vector2 baseOffset;
            if (isFirst && !loop) baseOffset = firstDir.Orthogonal();
            else if (isLast && !loop) baseOffset = lastDir.Orthogonal();
            else baseOffset = EdgeOffsetClamped(segDir, prevDir);

            var edge = baseOffset * (width * 0.5f);
            var pos = p[i];
            if (!antialiased)
            {
                Set(main + i * 2, pos + edge, color);
                Set(main + i * 2 + 1, pos - edge, color);
                prevDir = segDir;
                continue;
            }

            var side = baseOffset * border;
            var j = i * 2 + (loop ? 0 : 2);
            Set(main + j, pos + edge, color);
            Set(main + j + 1, pos - edge, color);
            Set(left + j, pos + edge, color);
            Set(left + j + 1, pos + edge + side, clear);
            Set(right + j, pos - edge, color);
            Set(right + j + 1, pos - edge - side, clear);
            if (isFirst && !loop)
            {
                var begin = -segDir * border;
                Set(main, pos + edge + begin, clear);
                Set(main + 1, pos - edge + begin, clear);
                Set(left, pos + edge + begin, clear);
                Set(left + 1, pos + edge + begin + side, clear);
                Set(right, pos - edge + begin, clear);
                Set(right + 1, pos - edge + begin - side, clear);
            }
            if (isLast && !loop)
            {
                var end = prevDir * border;
                var e = 2 * n + 2;
                Set(main + e, pos + edge + end, clear);
                Set(main + e + 1, pos - edge + end, clear);
                // The end corners turn back to the edge so their seam starts there (as Godot's do).
                Set(left + e, pos + edge, color);
                Set(left + e + 1, pos + edge + end + side, clear);
                Set(left + e + 2, pos + edge + end, clear);
                Set(right + e, pos - edge, color);
                Set(right + e + 1, pos - edge + end - side, clear);
                Set(right + e + 2, pos - edge + end, clear);
            }
            prevDir = segDir;
        }
        Strip(main, mainCount);
        if (!antialiased) return;
        Strip(left, sideCount);
        Strip(right, sideCount);
    }

    /// <summary>A simple convex polygon (one full turn, never turning back) can be fanned without Godot's triangulator.</summary>
    private static bool Convex(Vector2[] p)
    {
        var n = p.Length;
        float sign = 0, turn = 0;
        for (var i = 0; i < n; i++)
        {
            var e1 = p[(i + 1) % n] - p[i];
            var e2 = p[(i + 2) % n] - p[(i + 1) % n];
            var cross = e1.Cross(e2);
            if (cross * sign < 0) return false;
            if (sign == 0 && Mathf.Abs(cross) > 1e-6f) sign = cross;
            turn += Mathf.Atan2(cross, e1.Dot(e2));
        }
        return sign != 0 && Mathf.Abs(turn) < Mathf.Tau + 0.5f;
    }

    // ================================================================ buffers

    /// <summary>Room for the points of an arc or a circle's rim, reused from shape to shape.</summary>
    private Span<Vector2> Scratch(int n)
    {
        if (_scratch.Length < n) _scratch = new Vector2[Math.Max(n, _scratch.Length * 2)];
        return _scratch.AsSpan(0, n);
    }

    private int Reserve(int count)
    {
        if (_np + count > _pts.Length)
        {
            var size = Math.Max(_np + count, _pts.Length * 2);
            Array.Resize(ref _pts, size);
            Array.Resize(ref _cols, size);
        }
        var first = _np;
        _np += count;
        return first;
    }

    private void Set(int i, Vector2 p, Color c)
    {
        _pts[i] = _moved ? _xf * p : p;
        _cols[i] = c;
    }

    private void EnsureIndices(int count)
    {
        if (_ni + count > _idx.Length) Array.Resize(ref _idx, Math.Max(_ni + count, _idx.Length * 2));
    }

    private void Tri(int a, int b, int c)
    {
        EnsureIndices(3);
        _idx[_ni++] = a;
        _idx[_ni++] = b;
        _idx[_ni++] = c;
    }

    private void Strip(int first, int count)
    {
        EnsureIndices(Math.Max(0, count - 2) * 3);
        for (var i = 0; i + 2 < count; i++)
        {
            _idx[_ni++] = first + i;
            _idx[_ni++] = first + i + 1;
            _idx[_ni++] = first + i + 2;
        }
    }

    private void Quad(Vector2 a, Vector2 b, Vector2 c, Vector2 d, Color ca, Color cb, Color cc, Color cd)
    {
        var i = Reserve(4);
        Set(i, a, ca);
        Set(i + 1, b, cb);
        Set(i + 2, c, cc);
        Set(i + 3, d, cd);
        Tri(i, i + 1, i + 2);
        Tri(i, i + 2, i + 3);
    }
}
