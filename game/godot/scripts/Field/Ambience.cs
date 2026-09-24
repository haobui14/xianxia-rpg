using System;
using System.Collections.Generic;
using Godot;
using TuTien.Core;
using TuTienLuc.Art;

namespace TuTienLuc.Field;

/// <summary>
/// The air of the place, drawn around the camera: blossom petals in spring, seed fluff and butterflies in
/// summer, falling leaves in autumn, snow in winter. Purely cosmetic (Godot's random numbers).
/// </summary>
public partial class Ambience : Node2D
{
    private enum Kind
    {
        Petal,
        Leaf,
        Snow,
        Fluff,
        Butterfly,
    }

    private sealed class Mote
    {
        public Kind Kind;
        public Vector2 Pos;
        public Vector2 Vel;
        public float Life;
        public float MaxLife;
        public float Size;
        public float Angle;
        public float Spin;
        public float Phase;
        public Color Color;
    }

    private readonly FieldScreen _field;
    private readonly Func<Season> _season;
    private readonly float _density;
    private readonly List<Mote> _motes = new();
    private float _time;
    private bool _warm;

    public Ambience(FieldScreen field, Func<Season> season, float density = 1)
    {
        _field = field;
        _season = season;
        _density = density;
        ZIndex = 15;
    }

    private static float R(float min, float max) => min + GD.Randf() * (max - min);

    public override void _Process(double delta)
    {
        var dt = (float)delta;
        _time += dt;
        var view = _field.View;
        // Wait for the camera to settle on the player before filling the view.
        if (view.Size.X <= 1 || (!_warm && _time < 0.15f)) return;
        var season = _season();
        var rate = season switch
        {
            Season.Spring => 7f,
            Season.Summer => 2.5f,
            Season.Autumn => 6f,
            _ => 30f,
        } * _density * (view.Size.X / 1600f);
        // Arrive with the air already full, not empty and filling.
        var warmup = !_warm;
        _warm = true;
        var count = warmup ? (int)(rate * 5) : (int)(rate * dt) + (GD.Randf() < rate * dt % 1 ? 1 : 0);
        for (var i = 0; i < count && _motes.Count < 260; i++) Spawn(season, view, warmup);

        var wind = new Vector2(Mathf.Sin(_time * 0.21f) * 18 + 22, 0);
        for (var i = _motes.Count - 1; i >= 0; i--)
        {
            var m = _motes[i];
            m.Life -= dt;
            m.Phase += dt;
            switch (m.Kind)
            {
                case Kind.Butterfly:
                    // Flit: a wandering heading with little hops.
                    m.Vel = m.Vel.Rotated(Mathf.Sin(m.Phase * 1.7f) * dt * 2.2f);
                    m.Pos += m.Vel * dt + new Vector2(0, Mathf.Sin(m.Phase * 9) * 12 * dt);
                    break;
                case Kind.Snow:
                    m.Pos += (m.Vel + wind * 0.4f + new Vector2(Mathf.Sin(m.Phase * 1.3f + m.Angle) * 14, 0)) * dt;
                    break;
                default:
                    m.Pos += (m.Vel + wind + new Vector2(Mathf.Sin(m.Phase * 2.1f + m.Angle) * 22, Mathf.Cos(m.Phase * 1.4f) * 8)) * dt;
                    m.Angle += m.Spin * dt;
                    break;
            }
            if (m.Life <= 0 || !view.Grow(260).HasPoint(m.Pos)) _motes.RemoveAt(i);
        }
        QueueRedraw();
    }

    /// <param name="settled">Already under way (the first frame): anywhere in view, part-way through its life.</param>
    private void Spawn(Season season, Rect2 view, bool settled = false)
    {
        var m = new Mote { Life = R(6, 11), Angle = R(0, 6.28f), Spin = R(-3, 3), Phase = R(0, 10) };
        m.MaxLife = m.Life;
        // Falling things start above the view (upwind); drifting things anywhere in it.
        var anywhere = new Vector2(R(view.Position.X, view.End.X), R(view.Position.Y, view.End.Y));
        var top = settled ? anywhere : new Vector2(R(view.Position.X - 300, view.End.X), view.Position.Y - R(10, 80));
        switch (season)
        {
            case Season.Spring:
                m.Kind = Kind.Petal;
                m.Pos = GD.Randf() < 0.5f ? top : anywhere;
                m.Vel = new Vector2(R(10, 30), R(18, 34));
                m.Size = R(3f, 4.8f);
                m.Color = GD.Randf() < 0.3f ? new Color("#fff4f7") : new Color("#f0b3c6");
                break;
            case Season.Summer:
                if (GD.Randf() < 0.25f && CountButterflies() < 5)
                {
                    m.Kind = Kind.Butterfly;
                    m.Pos = anywhere;
                    m.Vel = Vector2.Right.Rotated(R(0, 6.28f)) * R(40, 70);
                    m.Size = R(4.5f, 6.5f);
                    m.Life = m.MaxLife = R(10, 18);
                    m.Color = GD.Randf() switch { < 0.4f => new Color("#f2d16b"), < 0.7f => new Color("#f7f2e6"), _ => new Color("#8fb5d9") };
                }
                else
                {
                    m.Kind = Kind.Fluff;
                    m.Pos = anywhere;
                    m.Vel = new Vector2(R(4, 16), R(-6, 6));
                    m.Size = R(1.6f, 2.6f);
                    m.Color = new Color(1, 1, 0.97f);
                }
                break;
            case Season.Autumn:
                m.Kind = Kind.Leaf;
                m.Pos = GD.Randf() < 0.6f ? top : anywhere;
                m.Vel = new Vector2(R(0, 20), R(26, 46));
                m.Size = R(3.2f, 5.2f);
                m.Color = GD.Randf() switch { < 0.35f => new Color("#c0602f"), < 0.7f => new Color("#d9983a"), _ => new Color("#a8452e") };
                break;
            default:
                m.Kind = Kind.Snow;
                m.Pos = GD.Randf() < 0.7f ? top : anywhere;
                m.Vel = new Vector2(R(-6, 10), R(34, 62));
                m.Size = R(1.4f, 3.2f);
                m.Color = new Color(1, 1, 1);
                break;
        }
        if (settled) m.Life = R(1.5f, m.MaxLife);
        _motes.Add(m);
    }

    private int CountButterflies()
    {
        var n = 0;
        foreach (var m in _motes) if (m.Kind == Kind.Butterfly) n++;
        return n;
    }

    public override void _Draw()
    {
        foreach (var m in _motes)
        {
            var fade = Mathf.Clamp(m.Life / 1.2f, 0, 1) * Mathf.Clamp((m.MaxLife - m.Life) / 0.8f, 0, 1);
            switch (m.Kind)
            {
                case Kind.Snow:
                    DrawCircle(m.Pos, m.Size * 1.8f, new Color(1, 1, 1, 0.18f * fade));
                    DrawCircle(m.Pos, m.Size, new Color(1, 1, 1, 0.9f * fade));
                    break;
                case Kind.Fluff:
                    DrawCircle(m.Pos, m.Size, new Color(m.Color, 0.8f * fade));
                    for (var k = 0; k < 5; k++)
                    {
                        var dir = Vector2.Right.Rotated(m.Angle + k * 1.2566f);
                        DrawLine(m.Pos, m.Pos + dir * m.Size * 2.4f, new Color(1, 1, 1, 0.45f * fade), 0.8f, true);
                    }
                    break;
                case Kind.Butterfly:
                {
                    var flap = Mathf.Abs(Mathf.Sin(m.Phase * 14));
                    var side = m.Vel.X < 0 ? -1 : 1;
                    var body = m.Pos;
                    foreach (var s in new[] { -1f, 1f })
                    {
                        var wing = body + new Vector2(s * m.Size * 0.7f * flap, -m.Size * 0.3f);
                        DrawColoredPolygon(Paint.EllipsePts(wing, m.Size * 0.75f * (0.35f + 0.65f * flap), m.Size * 0.6f, 10), new Color(m.Color, 0.95f * fade));
                        DrawColoredPolygon(Paint.EllipsePts(wing + new Vector2(0, m.Size * 0.55f), m.Size * 0.45f * (0.35f + 0.65f * flap), m.Size * 0.35f, 8), new Color(m.Color.Darkened(0.15f), 0.95f * fade));
                    }
                    DrawLine(body + new Vector2(0, -m.Size * 0.6f), body + new Vector2(0, m.Size * 0.7f), new Color(0.15f, 0.13f, 0.12f, fade), 1.4f, true);
                    DrawLine(body + new Vector2(0, -m.Size * 0.6f), body + new Vector2(side * 2.5f, -m.Size * 1.2f), new Color(0.15f, 0.13f, 0.12f, 0.8f * fade), 0.8f, true);
                    break;
                }
                default:
                    DrawColoredPolygon(Paint.EllipsePts(m.Pos, m.Size, m.Size * (m.Kind == Kind.Leaf ? 0.55f : 0.5f), 8, m.Angle), new Color(m.Color, 0.9f * fade));
                    if (m.Kind == Kind.Leaf)
                        DrawLine(m.Pos - Vector2.Right.Rotated(m.Angle) * m.Size, m.Pos + Vector2.Right.Rotated(m.Angle) * m.Size, new Color(m.Color.Darkened(0.35f), 0.8f * fade), 0.8f, true);
                    break;
            }
        }
    }
}
