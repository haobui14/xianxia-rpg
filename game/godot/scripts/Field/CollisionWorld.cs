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

    /// <summary>Move a circle by <paramref name="delta"/>, sliding along obstacles. A flyer only meets the world's edge.</summary>
    public Vector2 Move(Vector2 pos, float radius, Vector2 delta, bool flying = false)
    {
        if (flying)
        {
            var to = pos + delta;
            return new Vector2(Mathf.Clamp(to.X, radius, Width * CellSize - radius), Mathf.Clamp(to.Y, radius, Height * CellSize - radius));
        }
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

    /// <summary>Can a circle go from <paramref name="a"/> to <paramref name="b"/> in a straight line (grazing allowed)?</summary>
    public bool Clear(Vector2 a, Vector2 b, float r)
    {
        var steps = Math.Max(1, (int)Math.Ceiling(a.DistanceTo(b) / 6f));
        for (var i = 1; i <= steps; i++)
            if (!Free(a.Lerp(b, i / (float)steps), r - 0.5f)) return false;
        return true;
    }

    private static readonly int[] StepX = { 1, -1, 0, 0, 1, 1, -1, -1 };
    private static readonly int[] StepY = { 0, 0, 1, -1, 1, -1, 1, -1 };

    /// <summary>
    /// A way round whatever stands between <paramref name="from"/> and <paramref name="to"/> for a circle of
    /// radius <paramref name="r"/>: A* on a fine grid over the box around both points, pulled taut. It ends
    /// at <paramref name="to"/>, or as near to it as a body can stand (a waypoint inside a house). Null when
    /// the box holds no way there.
    /// </summary>
    public List<Vector2>? FindPath(Vector2 from, Vector2 to, float r, float margin = 192, float step = 16)
    {
        const int maxSide = 80;
        var box = new Rect2(from, Vector2.Zero).Expand(to).Grow(margin).Intersection(Bounds);
        var w = Math.Clamp((int)(box.Size.X / step), 1, maxSide);
        var h = Math.Clamp((int)(box.Size.Y / step), 1, maxSide);
        // A target farther than the grid reaches: keep the part around the start, toward the target.
        var origin = box.Position;
        if (box.Size.X > w * step) origin.X = to.X >= from.X ? from.X - margin : from.X + margin - w * step;
        if (box.Size.Y > h * step) origin.Y = to.Y >= from.Y ? from.Y - margin : from.Y + margin - h * step;
        var n = w * h;
        var state = new sbyte[n]; // 0 unknown, 1 free, -1 blocked
        Vector2 At(int i) => origin + new Vector2(i % w + 0.5f, i / w + 0.5f) * step;
        bool Open(int i)
        {
            if (state[i] == 0) state[i] = (sbyte)(Free(At(i), r) ? 1 : -1);
            return state[i] > 0;
        }
        int Nearest(Vector2 p, int rings)
        {
            var cx = Math.Clamp((int)((p.X - origin.X) / step), 0, w - 1);
            var cy = Math.Clamp((int)((p.Y - origin.Y) / step), 0, h - 1);
            for (var ring = 0; ring <= rings; ring++)
            {
                var best = -1;
                var bestD = float.MaxValue;
                for (var y = Math.Max(0, cy - ring); y <= Math.Min(h - 1, cy + ring); y++)
                {
                    for (var x = Math.Max(0, cx - ring); x <= Math.Min(w - 1, cx + ring); x++)
                    {
                        if (Math.Max(Math.Abs(x - cx), Math.Abs(y - cy)) != ring || !Open(y * w + x)) continue;
                        var d = At(y * w + x).DistanceSquaredTo(p);
                        if (d < bestD)
                        {
                            bestD = d;
                            best = y * w + x;
                        }
                    }
                }
                if (best >= 0) return best;
            }
            return -1;
        }

        var start = Nearest(from, 3);
        var goal = Nearest(to, 10);
        if (start < 0 || goal < 0) return null;
        var gx = goal % w;
        var gy = goal / w;
        var cost = new float[n];
        Array.Fill(cost, float.MaxValue);
        var came = new int[n];
        var done = new bool[n];
        var queue = new PriorityQueue<int, float>();
        cost[start] = 0;
        came[start] = -1;
        queue.Enqueue(start, 0);
        var found = false;
        for (var budget = 0; queue.Count > 0 && budget < 6000; budget++)
        {
            var cur = queue.Dequeue();
            if (cur == goal)
            {
                found = true;
                break;
            }
            if (done[cur]) continue;
            done[cur] = true;
            var cx = cur % w;
            var cy = cur / w;
            for (var k = 0; k < 8; k++)
            {
                var x = cx + StepX[k];
                var y = cy + StepY[k];
                if (x < 0 || y < 0 || x >= w || y >= h || !Open(y * w + x)) continue;
                var diagonal = k >= 4;
                // No cutting a corner between two blocked squares.
                if (diagonal && (!Open(cy * w + x) || !Open(y * w + cx))) continue;
                var next = y * w + x;
                var g = cost[cur] + (diagonal ? 1.4142f : 1f);
                if (g >= cost[next]) continue;
                cost[next] = g;
                came[next] = cur;
                var dx = Math.Abs(x - gx);
                var dy = Math.Abs(y - gy);
                queue.Enqueue(next, g + Math.Max(dx, dy) + 0.4142f * Math.Min(dx, dy));
            }
        }
        if (!found) return null;

        var nodes = new List<Vector2>();
        for (var i = goal; i >= 0; i = came[i]) nodes.Add(At(i));
        nodes.Reverse();
        if (Free(to, r) && Clear(nodes[^1], to, r)) nodes.Add(to);
        // Pull the string taut: from each corner, go straight to the farthest point still in view.
        var path = new List<Vector2>();
        var anchor = from;
        for (var at = 0; at < nodes.Count;)
        {
            var far = at;
            while (far + 1 < nodes.Count && Clear(anchor, nodes[far + 1], r)) far++;
            path.Add(nodes[far]);
            anchor = nodes[far];
            at = far + 1;
        }
        return path;
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
