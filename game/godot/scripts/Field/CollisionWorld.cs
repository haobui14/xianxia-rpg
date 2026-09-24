using System;
using System.Collections.Generic;
using Godot;

namespace TuTienLuc.Field;

/// <summary>A static obstacle: a circle (trunk, rock, pillar) or a rectangle (a building's footprint).</summary>
public sealed class Obstacle
{
    public bool IsCircle;
    public Vector2 Center;
    public float Radius;
    public Rect2 Rect;
    /// <summary>Walls and trunks stop arrows and qi; a pond or a low fence doesn't.</summary>
    public bool BlocksShots = true;

    public Rect2 Bounds => IsCircle ? new Rect2(Center - new Vector2(Radius, Radius), new Vector2(Radius * 2, Radius * 2)) : Rect;

    public static Obstacle Circle(Vector2 c, float r, bool shots = true) => new() { IsCircle = true, Center = c, Radius = r, BlocksShots = shots };
    public static Obstacle Box(Rect2 r, bool shots = true) => new() { Rect = r, BlocksShots = shots };
}

/// <summary>
/// Top-down collision for circular bodies: solid tiles (water, cliffs, the world's edge) plus circles
/// and boxes in a spatial hash. Bodies slide along what they hit. Deterministic and engine-free
/// apart from the vector type, so it runs the same headless.
/// </summary>
public sealed class CollisionWorld
{
    public float CellSize { get; }
    public int Width { get; }
    public int Height { get; }

    private readonly bool[] _walkSolid;
    private readonly bool[] _shotSolid;
    private readonly List<Obstacle>?[] _buckets;

    public CollisionWorld(int width, int height, float cellSize)
    {
        Width = width;
        Height = height;
        CellSize = cellSize;
        _walkSolid = new bool[width * height];
        _shotSolid = new bool[width * height];
        _buckets = new List<Obstacle>?[width * height];
    }

    public Rect2 Bounds => new(0, 0, Width * CellSize, Height * CellSize);

    public Vector2I CellOf(Vector2 p) => new((int)Mathf.Floor(p.X / CellSize), (int)Mathf.Floor(p.Y / CellSize));
    public Vector2 CenterOf(int x, int y) => new((x + 0.5f) * CellSize, (y + 0.5f) * CellSize);
    public bool InBounds(int x, int y) => x >= 0 && y >= 0 && x < Width && y < Height;

    public void SetSolid(int x, int y, bool walk, bool shots)
    {
        if (!InBounds(x, y)) return;
        _walkSolid[y * Width + x] = walk;
        _shotSolid[y * Width + x] = shots;
    }

    public bool SolidCell(int x, int y) => !InBounds(x, y) || _walkSolid[y * Width + x];
    public bool ShotSolidCell(int x, int y) => !InBounds(x, y) || _shotSolid[y * Width + x];

    public void Add(Obstacle o)
    {
        var b = o.Bounds;
        var min = CellOf(b.Position);
        var max = CellOf(b.End);
        for (var y = Math.Max(0, min.Y); y <= Math.Min(Height - 1, max.Y); y++)
            for (var x = Math.Max(0, min.X); x <= Math.Min(Width - 1, max.X); x++)
                (_buckets[y * Width + x] ??= new List<Obstacle>()).Add(o);
    }

    public void Remove(Obstacle o)
    {
        foreach (var bucket in _buckets) bucket?.Remove(o);
    }

    /// <summary>Move a circle by <paramref name="delta"/>, sliding along obstacles.</summary>
    public Vector2 Move(Vector2 pos, float radius, Vector2 delta)
    {
        var len = delta.Length();
        if (len < 0.0001f) return Resolve(pos, radius);
        var steps = Math.Max(1, (int)Math.Ceiling(len / Math.Max(2f, radius * 0.5f)));
        var step = delta / steps;
        for (var i = 0; i < steps; i++) pos = Resolve(pos + step, radius);
        return pos;
    }

    /// <summary>Push a circle out of everything it overlaps.</summary>
    public Vector2 Resolve(Vector2 p, float r)
    {
        for (var iter = 0; iter < 4; iter++)
        {
            var moved = false;
            var c = CellOf(p);
            for (var dy = -1; dy <= 1; dy++)
            {
                for (var dx = -1; dx <= 1; dx++)
                {
                    var x = c.X + dx;
                    var y = c.Y + dy;
                    if (SolidCell(x, y))
                        moved |= PushOutOfRect(ref p, r, new Rect2(x * CellSize, y * CellSize, CellSize, CellSize));
                    if (!InBounds(x, y) || _buckets[y * Width + x] is not { } bucket) continue;
                    foreach (var o in bucket)
                        moved |= o.IsCircle ? PushOutOfCircle(ref p, r, o.Center, o.Radius) : PushOutOfRect(ref p, r, o.Rect);
                }
            }
            if (!moved) break;
        }
        return p;
    }

    public bool Free(Vector2 p, float r)
    {
        var c = CellOf(p);
        for (var dy = -1; dy <= 1; dy++)
        {
            for (var dx = -1; dx <= 1; dx++)
            {
                var x = c.X + dx;
                var y = c.Y + dy;
                if (SolidCell(x, y) && Overlaps(p, r, new Rect2(x * CellSize, y * CellSize, CellSize, CellSize))) return false;
                if (!InBounds(x, y) || _buckets[y * Width + x] is not { } bucket) continue;
                foreach (var o in bucket)
                {
                    if (o.IsCircle ? p.DistanceTo(o.Center) < r + o.Radius : Overlaps(p, r, o.Rect)) return false;
                }
            }
        }
        return true;
    }

    /// <summary>The closest free spot to <paramref name="p"/> (spiral search), or <paramref name="p"/> itself.</summary>
    public Vector2 NearestFree(Vector2 p, float r, float maxDistance = 260)
    {
        if (Free(p, r)) return p;
        for (var dist = 12f; dist <= maxDistance; dist += 12f)
        {
            var n = Math.Max(8, (int)(dist / 6));
            for (var i = 0; i < n; i++)
            {
                var q = p + Vector2.Right.Rotated(Mathf.Tau * i / n) * dist;
                if (Free(q, r)) return q;
            }
        }
        return p;
    }

    /// <summary>Does something here stop a projectile? Water doesn't; walls, trunks and cliffs do.</summary>
    public bool BlocksShot(Vector2 p, float r)
    {
        var c = CellOf(p);
        if (ShotSolidCell(c.X, c.Y)) return true;
        if (!InBounds(c.X, c.Y) || _buckets[c.Y * Width + c.X] is not { } bucket) return false;
        foreach (var o in bucket)
        {
            if (!o.BlocksShots) continue;
            if (o.IsCircle ? p.DistanceTo(o.Center) < o.Radius + r * 0.5f : o.Rect.HasPoint(p)) return true;
        }
        return false;
    }

    private static bool Overlaps(Vector2 p, float r, Rect2 rect)
    {
        var closest = new Vector2(Mathf.Clamp(p.X, rect.Position.X, rect.End.X), Mathf.Clamp(p.Y, rect.Position.Y, rect.End.Y));
        return p.DistanceSquaredTo(closest) < r * r;
    }

    private static bool PushOutOfRect(ref Vector2 p, float r, Rect2 rect)
    {
        var closest = new Vector2(Mathf.Clamp(p.X, rect.Position.X, rect.End.X), Mathf.Clamp(p.Y, rect.Position.Y, rect.End.Y));
        var d = p - closest;
        var dist2 = d.LengthSquared();
        if (dist2 >= r * r) return false;
        if (dist2 < 0.000001f)
        {
            // The centre is inside the box: leave by the nearest side.
            var left = p.X - rect.Position.X;
            var right = rect.End.X - p.X;
            var top = p.Y - rect.Position.Y;
            var bottom = rect.End.Y - p.Y;
            var m = Math.Min(Math.Min(left, right), Math.Min(top, bottom));
            if (m == left) p.X = rect.Position.X - r;
            else if (m == right) p.X = rect.End.X + r;
            else if (m == top) p.Y = rect.Position.Y - r;
            else p.Y = rect.End.Y + r;
            return true;
        }
        var dist = Mathf.Sqrt(dist2);
        p = closest + d / dist * (r + 0.01f);
        return true;
    }

    private static bool PushOutOfCircle(ref Vector2 p, float r, Vector2 c, float cr)
    {
        var d = p - c;
        var min = r + cr;
        var dist2 = d.LengthSquared();
        if (dist2 >= min * min) return false;
        var dist = Mathf.Sqrt(dist2);
        p = dist < 0.0001f ? c + new Vector2(0, min) : c + d / dist * (min + 0.01f);
        return true;
    }
}
