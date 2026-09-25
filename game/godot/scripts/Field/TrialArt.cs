using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTienLuc.Art;
using TuTienLuc.Ui;

namespace TuTienLuc.Field;

// The breakthrough trials' own art. Everything paints through a Brush: the trials redraw every frame,
// and shapes drawn straight onto a canvas item each get GPU buffers of their own in the compatibility
// renderer (the meridian storm came to some 250 a frame at its height, the moment Android phones closed it).

/// <summary>
/// The Trúc Cơ platform, the part that never moves: jade over the sea of qi, the rim, the eight meridians'
/// grooves with their acupoints, and their name tags. Painted once.
/// </summary>
public partial class FoundationFloor : Node2D
{
    /// <summary>The jade tag a meridian's name sits on at the rim.</summary>
    private readonly StyleBoxFlat _tag = new()
    {
        BgColor = new Color(0.84f, 0.9f, 0.86f, 0.95f),
        BorderWidthLeft = 2, BorderWidthTop = 2, BorderWidthRight = 2, BorderWidthBottom = 2,
        CornerRadiusTopLeft = 16, CornerRadiusTopRight = 16, CornerRadiusBottomLeft = 16, CornerRadiusBottomRight = 16,
        AntiAliasing = true,
    };
    private readonly FoundationTrial _t;

    public FoundationFloor(FoundationTrial trial)
    {
        _t = trial;
        ZIndex = -15;
    }

    public override void _Ready()
    {
        AddChild(new FoundationPulse(_t));
        // The meridians' names follow the interface language.
        Game.Instance.LocaleChanged += QueueRedraw;
    }

    public override void _ExitTree() => Game.Instance.LocaleChanged -= QueueRedraw;

    public override void _Draw()
    {
        using var b = Brush.On(this);
        var c = _t.Center;
        var ink = FoundationTrial.InkTone;
        const float rim = FoundationTrial.Rim, sink = FoundationTrial.Sink;
        // The disk: pale jade with an inked rim and a second, fainter circle.
        b.DrawCircle(c, rim + 36, new Color(0.05f, 0.07f, 0.12f, 0.35f));
        b.DrawCircle(c, rim + 28, new Color(0.84f, 0.9f, 0.86f, 0.94f));
        b.DrawArc(c, rim + 28, 0, Mathf.Tau, 128, new Color(ink, 0.7f), 5, true);
        b.DrawArc(c, rim + 12, 0, Mathf.Tau, 128, new Color(ink, 0.18f), 2, true);
        b.DrawArc(c, (rim + sink) / 2, 0, Mathf.Tau, 96, new Color(ink, 0.08f), 2, true);

        // The meridians' grooves (their live line of qi is the pulse's) and the acupoints along them.
        for (var i = 0; i < FoundationTrial.Channels; i++)
        {
            var dir = FoundationTrial.Dir(i);
            var from = c + dir * sink;
            var to = c + dir * (rim + 10);
            b.DrawLine(from, to, new Color(0.35f, 0.5f, 0.45f, 0.45f), 30, true);
            b.DrawLine(from, to, new Color(0.93f, 0.98f, 0.95f, 0.9f), 12, true);
            for (var d = sink + 50; d < rim; d += 64) b.DrawCircle(c + dir * d, 5, new Color(ink, 0.35f));
        }

        // Each meridian's name on a jade tag at the rim, over everything above.
        b.Flush();
        for (var i = 0; i < FoundationTrial.Channels; i++)
        {
            var seal = c + FoundationTrial.Dir(i) * (rim + 58);
            var name = FoundationTrial.Meridian(i);
            var ns = Ink.UiFont.GetStringSize(name, HorizontalAlignment.Left, -1, 17);
            _tag.BorderColor = new Color(ink, 0.6f);
            DrawStyleBox(_tag, new Rect2(seal - new Vector2(ns.X / 2 + 11, 16), new Vector2(ns.X + 22, 32)));
            b.DrawString(Ink.UiFont, seal + new Vector2(-ns.X / 2, 6), name, HorizontalAlignment.Left, -1, 17, new Color(ink, 0.9f));
        }
    }
}

/// <summary>What moves on the Trúc Cơ platform: qi running along the meridians, and the dantian filling as the foundation rises.</summary>
public partial class FoundationPulse : Node2D
{
    private readonly FoundationTrial _t;
    private float _time;

    public FoundationPulse(FoundationTrial trial) => _t = trial;

    public override void _Process(double delta)
    {
        _time += (float)delta;
        QueueRedraw();
    }

    public override void _Draw()
    {
        using var b = Brush.On(this);
        var c = _t.Center;
        var ink = FoundationTrial.InkTone;
        const float rim = FoundationTrial.Rim, sink = FoundationTrial.Sink;
        for (var i = 0; i < FoundationTrial.Channels; i++)
        {
            var dir = FoundationTrial.Dir(i);
            var flow = 0.55f + 0.45f * Mathf.Sin(_time * 3 - i * 0.8f);
            b.DrawLine(c + dir * sink, c + dir * (rim + 10), new Color(0.45f, 0.78f, 0.66f, 0.35f + 0.25f * flow), 5, true);
        }

        // The dantian: a deep jade basin that fills with golden light (opaque colours: gold over indigo would turn to mud).
        var fill = (float)_t.Performance;
        var pulse = 0.5f + 0.5f * Mathf.Sin(_time * 2.2f);
        b.DrawCircle(c, sink, new Color(0.13f, 0.27f, 0.27f));
        b.DrawCircle(c, sink * 0.86f, new Color(0.16f, 0.34f, 0.32f));
        var core = sink * (0.3f + 0.55f * fill);
        b.DrawCircle(c, core + 6, new Color(0.96f, 0.8f, 0.42f).Lerp(new Color(0.16f, 0.34f, 0.32f), 0.55f));
        b.DrawCircle(c, core, new Color(0.98f, 0.84f, 0.46f).Lerp(new Color(1f, 0.95f, 0.8f), 0.3f * pulse));
        b.DrawArc(c, sink, 0, Mathf.Tau, 72, new Color(ink, 0.8f), 4, true);
        Icons.Draw(b, IconKind.Core, c, 50, new Color(0.3f, 0.18f, 0.08f, 0.45f + 0.4f * fill));

        // Eight foundation stones around it, laid one per eighth of the goal.
        for (var i = 0; i < 8; i++)
        {
            var laid = i < _t.Stones;
            var from = -Mathf.Pi / 2 + Mathf.Tau * i / 8 + 0.06f;
            var to = from + Mathf.Tau / 8 - 0.12f;
            var color = laid ? new Color(0.76f, 0.6f, 0.3f, 0.95f) : new Color(ink, 0.12f);
            b.DrawArc(c, sink + 14, from, to, 12, color, 16, true);
            if (laid) b.DrawArc(c, sink + 20, from, to, 12, new Color(1f, 0.9f, 0.6f, 0.6f), 3, true);
        }
    }
}

/// <summary>The meridian storm itself: qi flowing along the meridians, surges, and the shockwaves.</summary>
public partial class FoundationLayer : Node2D
{
    private readonly FoundationTrial _t;

    public FoundationLayer(FoundationTrial trial)
    {
        _t = trial;
        ZIndex = 5;
    }

    public override void _Process(double delta) => QueueRedraw();

    public override void _Draw()
    {
        using var b = Brush.On(this);
        var c = _t.Center;
        // Surges: a red band filling down the meridian, then a dark rush when it strikes.
        foreach (var s in _t.Surges)
        {
            var dir = FoundationTrial.Dir(s.Channel);
            var from = c + dir * (FoundationTrial.Rim + 20);
            var to = c + dir * FoundationTrial.Sink;
            if (!s.Fired)
            {
                b.DrawLine(from, to, new Color(Ink.Cinnabar, 0.16f), 72, true);
                b.DrawLine(from, from.Lerp(to, s.Progress), new Color(Ink.Cinnabar, 0.3f), 72, true);
                b.DrawLine(from, to, new Color(Ink.CinnabarDeep, 0.6f), 2, true);
            }
            else
            {
                var k = Mathf.Clamp(s.After / Surge.AfterTime, 0, 1);
                b.DrawLine(from, to, new Color(0.22f, 0.1f, 0.2f, 0.7f * k), 60, true);
                b.DrawLine(from, to, new Color(0.55f, 0.2f, 0.3f, 0.8f * k), 14, true);
            }
        }

        // Shockwaves: the dantian flares red while one gathers, its gaps shown as green paths; then a dark
        // ring rolls out with those gaps in it.
        foreach (var w in _t.Waves)
        {
            if (!w.Emitted)
            {
                var k = 1 - w.Warn / w.WarnTime;
                b.DrawArc(c, FoundationTrial.Sink + 4, 0, Mathf.Tau, 64, new Color(Ink.Cinnabar, 0.3f + 0.6f * k), 6 + 6 * k, true);
                foreach (var g in w.Gaps)
                {
                    var dir = Vector2.Right.Rotated(g);
                    b.DrawLine(c + dir * (FoundationTrial.Sink + 16), c + dir * (FoundationTrial.Rim + 10), new Color(Ink.Jade, 0.25f + 0.35f * k), 10, true);
                }
                continue;
            }
            var edges = w.Gaps.SelectMany(g => new[] { g - Shockwave.GapHalf, g + Shockwave.GapHalf }).Select(x => Mathf.PosMod(x, Mathf.Tau)).OrderBy(x => x).ToList();
            for (var i = 0; i < edges.Count; i++)
            {
                var from = edges[i];
                var to = i + 1 < edges.Count ? edges[i + 1] : edges[0] + Mathf.Tau;
                var mid = Mathf.PosMod((from + to) / 2, Mathf.Tau);
                if (w.InGap(mid)) continue;
                b.DrawArc(c, w.Radius, from, to, 48, new Color(0.25f, 0.1f, 0.22f, 0.55f), 26, true);
                b.DrawArc(c, w.Radius, from, to, 48, new Color(0.75f, 0.25f, 0.3f, 0.85f), 6, true);
            }
        }

        // The qi drops, with a short trail back up their meridian.
        foreach (var d in _t.Drops)
        {
            var dir = FoundationTrial.Dir(d.Channel);
            var at = d.Pos + new Vector2(0, -20);
            var fade = Mathf.Clamp(d.Age / 0.25f, 0, 1);
            if (d.Turbid)
            {
                var body = Paint.Blob(at, 13, 13, 10, 0.3f, d.Channel * 13 + (int)(d.Age * 7) % 5);
                b.DrawCircle(at, 20, new Color(0.25f, 0.12f, 0.25f, 0.25f * fade));
                b.DrawColoredPolygon(body, new Color(0.3f, 0.18f, 0.3f, 0.85f * fade));
                b.DrawPolyline(Paint.Closed(body), new Color(0.12f, 0.05f, 0.1f, 0.9f * fade), 2, true);
                Icons.Draw(b, IconKind.Turbid, at, 13, new Color(0.9f, 0.75f, 0.85f, 0.8f * fade));
                continue;
            }
            var color = d.Essence ? Ink.Element(d.Element).Lightened(0.15f) : new Color(0.85f, 1f, 0.93f);
            for (var i = 1; i <= 4; i++)
                b.DrawCircle(at + dir * i * 9, (d.Essence ? 9 : 6) - i * 1.2f, new Color(color, 0.25f * fade / i));
            b.DrawCircle(at, (d.Essence ? 22 : 15) * fade, new Color(color, 0.18f));
            b.DrawCircle(at, (d.Essence ? 11 : 7) * fade, new Color(color, 0.95f));
            b.DrawCircle(at, 3.5f * fade, new Color(1, 1, 1, 0.95f));
            if (d.Essence)
            {
                b.DrawArc(at, 16, d.Age * 4, d.Age * 4 + 4, 16, new Color(Ink.Gold, 0.9f * fade), 2, true);
                Icons.Draw(b, Icons.ForElement(d.Element), at + new Vector2(0, -24), 14, new Color(color.Darkened(0.35f), fade));
            }
        }
    }
}

/// <summary>The first breakthrough's meditation circle, brushed onto the platform: the eight trigrams around a taiji.</summary>
public partial class TrialFloor : Node2D
{
    private static readonly int[][] Trigrams =
    {
        new[] { 1, 1, 1 }, new[] { 0, 1, 1 }, new[] { 1, 0, 1 }, new[] { 0, 0, 1 },
        new[] { 1, 1, 0 }, new[] { 0, 1, 0 }, new[] { 1, 0, 0 }, new[] { 0, 0, 0 },
    };

    public TrialFloor(Vector2 center)
    {
        Position = center;
        ZIndex = -15;
    }

    public override void _Draw()
    {
        using var b = Brush.On(this);
        var ink = new Color(0.11f, 0.13f, 0.19f, 1);
        b.DrawCircle(Vector2.Zero, 430, new Color(ink, 0.05f));
        b.DrawArc(Vector2.Zero, 430, 0, Mathf.Tau, 96, new Color(ink, 0.28f), 6, true);
        b.DrawArc(Vector2.Zero, 404, 0, Mathf.Tau, 96, new Color(ink, 0.2f), 2, true);
        b.DrawArc(Vector2.Zero, 250, 0, Mathf.Tau, 72, new Color(ink, 0.16f), 2, true);
        for (var i = 0; i < 8; i++)
        {
            var angle = -Mathf.Pi / 2 + Mathf.Tau * i / 8;
            var dir = Vector2.Right.Rotated(angle);
            var side = new Vector2(-dir.Y, dir.X);
            for (var line = 0; line < 3; line++)
            {
                var center = dir * (310 + line * 22);
                if (Trigrams[i][line] == 1)
                {
                    b.DrawLine(center - side * 38, center + side * 38, new Color(ink, 0.3f), 9);
                }
                else
                {
                    b.DrawLine(center - side * 38, center - side * 7, new Color(ink, 0.3f), 9);
                    b.DrawLine(center + side * 7, center + side * 38, new Color(ink, 0.3f), 9);
                }
            }
            b.DrawLine(dir * 404, dir * 430, new Color(ink, 0.2f), 2);
        }
        // Taiji: a dark half with a light eye, a light half with a dark eye.
        const float r = 110;
        var dark = new Color(ink, 0.22f);
        var light = new Color(0.97f, 0.95f, 0.9f, 0.5f);
        b.DrawCircle(Vector2.Zero, r, light);
        // Right outer half, then the S back up the middle (no repeated points, or triangulation fails).
        var half = new List<Vector2>();
        for (var k = 0; k <= 24; k++) half.Add(Vector2.Up.Rotated(Mathf.Pi * k / 24) * r);
        for (var k = 1; k <= 12; k++) half.Add(new Vector2(0, r / 2) + Vector2.Down.Rotated(-Mathf.Pi * k / 12) * (r / 2));
        for (var k = 1; k < 12; k++) half.Add(new Vector2(0, -r / 2) + Vector2.Down.Rotated(Mathf.Pi * k / 12) * (r / 2));
        b.DrawColoredPolygon(half.ToArray(), dark);
        b.DrawCircle(new Vector2(0, -r / 2), r * 0.13f, light);
        b.DrawCircle(new Vector2(0, r / 2), r * 0.13f, dark);
        b.DrawArc(Vector2.Zero, r, 0, Mathf.Tau, 64, new Color(ink, 0.35f), 3, true);
    }
}

/// <summary>The first breakthrough's qi motes and heart demons above the platform.</summary>
public partial class TrialLayer : Node2D
{
    private readonly TrialScreen _t;

    public TrialLayer(TrialScreen trial)
    {
        _t = trial;
        ZIndex = 5;
    }

    public override void _Process(double delta) => QueueRedraw();

    public override void _Draw()
    {
        using var b = Brush.On(this);
        foreach (var m in _t.Motes)
        {
            var color = Ink.Element(m.Element).Lightened(0.15f);
            var fade = Mathf.Clamp(m.Life / 0.6f, 0, 1) * Mathf.Clamp(m.Age / 0.3f, 0, 1);
            var bob = new Vector2(0, -26 + Mathf.Sin(m.Age * 4 + m.Pos.X) * 4);
            var at = m.Pos + bob;
            var root = _t.IsRoot(m.Element);
            b.DrawColoredPolygon(Paint.EllipsePts(m.Pos, 12, 4.5f, 12), new Color(0, 0, 0, 0.12f * fade));
            b.DrawCircle(at, (root ? 30 : 22) * fade, new Color(color, 0.14f));
            b.DrawCircle(at, (root ? 20 : 15) * fade, new Color(color, 0.22f));
            b.DrawCircle(at, (root ? 12 : 9) * fade, new Color(color, 0.9f * fade));
            b.DrawCircle(at, 4.5f * fade, new Color(1, 1, 1, 0.9f * fade));
            if (root) b.DrawArc(at, 19, m.Age * 3, m.Age * 3 + 4, 16, new Color(Ink.Gold, 0.85f * fade), 2, true);
            if (fade > 0.6f) Icons.Draw(b, Icons.ForElement(m.Element), at + new Vector2(0, -28), 15, new Color(color.Darkened(0.3f), fade));
        }
        foreach (var d in _t.Demons)
        {
            var at = d.Pos + new Vector2(0, -22);
            var flick = Mathf.Sin(d.Age * 11) * 2;
            b.DrawColoredPolygon(Paint.EllipsePts(d.Pos, 14, 5, 12), new Color(0, 0, 0, 0.18f));
            var body = Paint.Blob(at, 16 + flick, 20, 12, 0.22f, (int)(d.Wobble * 10) % 97);
            b.DrawColoredPolygon(body, new Color(0.35f, 0.05f, 0.08f, 0.75f));
            b.DrawPolyline(Paint.Closed(body), new Color(0.1f, 0.02f, 0.04f, 0.85f), 2, true);
            // Trailing wisps.
            for (var i = 1; i <= 3; i++)
                b.DrawCircle(at + new Vector2(Mathf.Sin(d.Wobble - i) * 6, 10 + i * 7), 7 - i * 1.6f, new Color(0.35f, 0.05f, 0.08f, 0.35f - i * 0.08f));
            b.DrawCircle(at + new Vector2(-6, -4), 3.2f, new Color("#ffd27a"));
            b.DrawCircle(at + new Vector2(6, -4), 3.2f, new Color("#ffd27a"));
            b.DrawCircle(at + new Vector2(-6, -4), 1.3f, new Color(0.1f, 0, 0));
            b.DrawCircle(at + new Vector2(6, -4), 1.3f, new Color(0.1f, 0, 0));
            // A jagged grin under the eyes.
            b.DrawPolyline(new[] { at + new Vector2(-6, 6), at + new Vector2(-3, 9), at + new Vector2(0, 6), at + new Vector2(3, 9), at + new Vector2(6, 6) },
                new Color(1, 0.8f, 0.7f, 0.75f), 1.6f, true);
        }
    }
}
