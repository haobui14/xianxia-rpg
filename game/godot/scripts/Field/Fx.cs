using System.Collections.Generic;
using Godot;

namespace TuTienLuc.Field;

/// <summary>
/// Short-lived visuals on the field — damage numbers, brush strokes, particles. Purely cosmetic,
/// so it uses Godot's own random numbers, never the game's seeded streams.
/// </summary>
public sealed class Fx
{
    public readonly List<Floater> Floaters = new();
    public readonly List<Swoosh> Swooshes = new();
    public readonly List<Particle> Particles = new();

    private static float R(float min, float max) => min + GD.Randf() * (max - min);

    public void Say(Vector2 pos, string text, Color color, int size = 20, float life = 0.9f) =>
        Floaters.Add(new Floater { Pos = pos, Text = text, Color = color, Size = size, Life = life, MaxLife = life });

    public void Slash(Vector2 origin, Vector2 dir, float arc, float radius, Color color, float life = 0.18f, float width = 1) =>
        Swooshes.Add(new Swoosh { Pos = origin, Angle = FieldMath.Angle(dir), Arc = arc, Radius = radius, Color = color, Life = life, MaxLife = life, Width = width });

    public void Ring(Vector2 pos, float radius, Color color, float life = 0.35f) =>
        Swooshes.Add(new Swoosh { Pos = pos, Ring = true, Radius = radius, Color = color, Life = life, MaxLife = life });

    public void Burst(Vector2 pos, Color color, int count = 10, float speed = 160, ParticleKind kind = ParticleKind.Spark, float size = 3)
    {
        for (var i = 0; i < count; i++)
        {
            var dir = Vector2.Right.Rotated(GD.Randf() * Mathf.Tau);
            var life = R(0.25f, 0.55f);
            Particles.Add(new Particle
            {
                Pos = pos, Vel = dir * R(speed * 0.4f, speed), Life = life, MaxLife = life, Size = R(size * 0.6f, size * 1.3f),
                Color = color, Kind = kind, Drag = 3.5f,
            });
        }
    }

    /// <summary>Ink splatter where a blow lands — our blood.</summary>
    public void Ink(Vector2 pos, Vector2 dir, int count = 6)
    {
        for (var i = 0; i < count; i++)
        {
            var d = dir.Normalized().Rotated(R(-0.8f, 0.8f));
            var life = R(0.35f, 0.7f);
            Particles.Add(new Particle
            {
                Pos = pos, Vel = d * R(60, 200), Life = life, MaxLife = life, Size = R(2, 5),
                Color = new Color(0.11f, 0.13f, 0.19f, 0.85f), Kind = ParticleKind.Ink, Drag = 5,
            });
        }
    }

    public void Dust(Vector2 pos, int count = 5)
    {
        for (var i = 0; i < count; i++)
        {
            var life = R(0.3f, 0.6f);
            Particles.Add(new Particle
            {
                Pos = pos + new Vector2(R(-8, 8), R(-3, 3)), Vel = new Vector2(R(-30, 30), R(-26, -6)), Life = life, MaxLife = life,
                Size = R(3, 6), Color = new Color(0.72f, 0.66f, 0.54f, 0.5f), Kind = ParticleKind.Mist, Drag = 2,
            });
        }
    }

    public void Leaves(Vector2 pos, Color color, int count = 4)
    {
        for (var i = 0; i < count; i++)
        {
            var life = R(0.8f, 1.6f);
            Particles.Add(new Particle
            {
                Pos = pos + new Vector2(R(-20, 20), R(-30, 0)), Vel = new Vector2(R(-40, 40), R(-20, 10)), Life = life, MaxLife = life,
                Size = R(3, 5), Color = color, Kind = ParticleKind.Leaf, Gravity = 40, Drag = 1.2f, Spin = R(-6, 6), Angle = R(0, 6),
            });
        }
    }

    public void Rise(Vector2 pos, Color color, int count = 3, float spread = 14)
    {
        for (var i = 0; i < count; i++)
        {
            var life = R(0.8f, 1.5f);
            Particles.Add(new Particle
            {
                Pos = pos + new Vector2(R(-spread, spread), R(-spread * 0.4f, spread * 0.4f)), Vel = new Vector2(R(-6, 6), R(-50, -24)),
                Life = life, MaxLife = life, Size = R(1.5f, 3f), Color = color, Kind = ParticleKind.Spark, Drag = 0.4f,
            });
        }
    }

    public void Update(float dt)
    {
        for (var i = Floaters.Count - 1; i >= 0; i--)
        {
            var f = Floaters[i];
            f.Life -= dt;
            f.Pos += f.Vel * dt;
            f.Vel *= 0.94f;
            if (f.Life <= 0) Floaters.RemoveAt(i);
        }
        for (var i = Swooshes.Count - 1; i >= 0; i--)
        {
            Swooshes[i].Life -= dt;
            if (Swooshes[i].Life <= 0) Swooshes.RemoveAt(i);
        }
        for (var i = Particles.Count - 1; i >= 0; i--)
        {
            var p = Particles[i];
            p.Life -= dt;
            if (p.Life <= 0)
            {
                Particles.RemoveAt(i);
                continue;
            }
            p.Vel += new Vector2(0, p.Gravity * dt);
            p.Vel *= Mathf.Max(0, 1 - p.Drag * dt);
            p.Pos += p.Vel * dt;
            p.Angle += p.Spin * dt;
        }
        if (Particles.Count > 900) Particles.RemoveRange(0, Particles.Count - 900);
    }

    public void Clear()
    {
        Floaters.Clear();
        Swooshes.Clear();
        Particles.Clear();
    }
}
