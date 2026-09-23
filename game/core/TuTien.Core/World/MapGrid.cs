using System;
using System.Collections.Generic;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.World
{
    public enum Terrain
    {
        Plains,
        Road,
        Forest,
        DenseForest,
        Hills,
        Mountain,
        Peak,
        Water,
        Bridge,
        Swamp,
        Town,
        Sect,
    }

    public readonly struct Cell : IEquatable<Cell>
    {
        public readonly int X;
        public readonly int Y;

        public Cell(int x, int y)
        {
            X = x;
            Y = y;
        }

        public int Manhattan(Cell other) => Math.Abs(X - other.X) + Math.Abs(Y - other.Y);
        public bool Equals(Cell other) => X == other.X && Y == other.Y;
        public override bool Equals(object? obj) => obj is Cell c && Equals(c);
        public override int GetHashCode() => (X * 73856093) ^ (Y * 19349663);
        public override string ToString() => $"({X},{Y})";
    }

    public sealed class PathResult
    {
        public List<Cell> Steps { get; } = new List<Cell>();
        public int Cost { get; set; }
    }

    /// <summary>
    /// A region map: terrain and zone (area id) per tile, parsed from the ASCII rows in
    /// content/maps. Movement rules follow design §7.2 — terrain costs Cước lực, water and
    /// peaks block mortals, and sword flight (Trúc Cơ+) makes every tile cost 1.
    /// </summary>
    public sealed class MapGrid
    {
        public MapDef Def { get; }
        public int Width { get; }
        public int Height { get; }

        private readonly Terrain[] _terrain;
        private readonly string?[] _zones;

        public static readonly IReadOnlyDictionary<char, Terrain> Legend = new Dictionary<char, Terrain>
        {
            ['.'] = Terrain.Plains,
            ['='] = Terrain.Road,
            ['f'] = Terrain.Forest,
            ['F'] = Terrain.DenseForest,
            ['h'] = Terrain.Hills,
            ['^'] = Terrain.Mountain,
            ['A'] = Terrain.Peak,
            ['~'] = Terrain.Water,
            ['#'] = Terrain.Bridge,
            ['s'] = Terrain.Swamp,
            ['T'] = Terrain.Town,
            ['S'] = Terrain.Sect,
        };

        public MapGrid(MapDef def)
        {
            Def = def;
            Width = def.Width;
            Height = def.Height;
            if (def.Terrain.Count != Height) throw new FormatException($"map {def.Id}: expected {Height} terrain rows, got {def.Terrain.Count}");
            if (def.Zones.Count != Height) throw new FormatException($"map {def.Id}: expected {Height} zone rows, got {def.Zones.Count}");

            _terrain = new Terrain[Width * Height];
            _zones = new string?[Width * Height];
            for (var y = 0; y < Height; y++)
            {
                var tRow = def.Terrain[y];
                var zRow = def.Zones[y];
                if (tRow.Length != Width) throw new FormatException($"map {def.Id}: terrain row {y} has {tRow.Length} cells, expected {Width}");
                if (zRow.Length != Width) throw new FormatException($"map {def.Id}: zone row {y} has {zRow.Length} cells, expected {Width}");
                for (var x = 0; x < Width; x++)
                {
                    if (!Legend.TryGetValue(tRow[x], out var t))
                        throw new FormatException($"map {def.Id}: unknown terrain '{tRow[x]}' at {x},{y}");
                    _terrain[y * Width + x] = t;
                    var z = zRow[x].ToString();
                    _zones[y * Width + x] = def.ZoneLegend.TryGetValue(z, out var areaId) ? areaId : null;
                }
            }
        }

        public bool InBounds(int x, int y) => x >= 0 && y >= 0 && x < Width && y < Height;
        public Terrain At(int x, int y) => _terrain[y * Width + x];
        public string? ZoneAt(int x, int y) => InBounds(x, y) ? _zones[y * Width + x] : null;

        public static bool HasSwordFlight(PlayerState p) => p.Realm >= Realm.TrucCo;

        /// <summary>Cước lực to step onto a tile, or −1 if it can't be entered.</summary>
        public int StepCost(int x, int y, PlayerState p)
        {
            if (!InBounds(x, y)) return -1;
            var t = At(x, y);
            if (HasSwordFlight(p)) return 1;
            return t switch
            {
                Terrain.Water => -1,
                Terrain.Peak => -1,
                Terrain.Forest => 2,
                Terrain.Hills => 2,
                Terrain.DenseForest => 3,
                Terrain.Swamp => 3,
                Terrain.Mountain => 3,
                _ => 1,
            };
        }

        public IEnumerable<Cell> Neighbors(Cell c)
        {
            if (c.Y > 0) yield return new Cell(c.X, c.Y - 1);
            if (c.X < Width - 1) yield return new Cell(c.X + 1, c.Y);
            if (c.Y < Height - 1) yield return new Cell(c.X, c.Y + 1);
            if (c.X > 0) yield return new Cell(c.X - 1, c.Y);
        }

        /// <summary>Cheapest 4-directional path (A*, Manhattan heuristic — admissible since the min cost is 1).</summary>
        public PathResult? FindPath(Cell start, Cell goal, PlayerState p, int maxCost = int.MaxValue)
        {
            if (!InBounds(goal.X, goal.Y) || StepCost(goal.X, goal.Y, p) < 0) return null;
            if (start.Equals(goal)) return new PathResult();

            var gScore = new Dictionary<Cell, int> { [start] = 0 };
            var cameFrom = new Dictionary<Cell, Cell>();
            var open = new SortedSet<(int f, int h, int order, Cell cell)>(Comparer<(int f, int h, int order, Cell cell)>.Create((a, b) =>
            {
                var c = a.f.CompareTo(b.f);
                if (c != 0) return c;
                c = a.h.CompareTo(b.h);
                return c != 0 ? c : a.order.CompareTo(b.order);
            }));
            var order = 0;
            open.Add((start.Manhattan(goal), start.Manhattan(goal), order++, start));

            while (open.Count > 0)
            {
                var current = open.Min;
                open.Remove(current);
                var cell = current.cell;
                if (cell.Equals(goal)) return Rebuild(cameFrom, start, goal, gScore[goal]);
                var g = gScore[cell];
                if (current.f - current.h > g) continue; // stale entry

                foreach (var next in Neighbors(cell))
                {
                    var step = StepCost(next.X, next.Y, p);
                    if (step < 0) continue;
                    var tentative = g + step;
                    if (tentative > maxCost) continue;
                    if (gScore.TryGetValue(next, out var known) && tentative >= known) continue;
                    gScore[next] = tentative;
                    cameFrom[next] = cell;
                    var h = next.Manhattan(goal);
                    open.Add((tentative + h, h, order++, next));
                }
            }
            return null;
        }

        private static PathResult Rebuild(Dictionary<Cell, Cell> cameFrom, Cell start, Cell goal, int cost)
        {
            var result = new PathResult { Cost = cost };
            var c = goal;
            while (!c.Equals(start))
            {
                result.Steps.Add(c);
                c = cameFrom[c];
            }
            result.Steps.Reverse();
            return result;
        }

        /// <summary>Thần thức radius: 3 + PER/4 + realm index, doubled reach while a pulse is active.</summary>
        public static int SenseRadius(PlayerState p) =>
            3 + p.Attrs.Per / 4 + (int)p.Realm + (p.SensePulse ? 4 : 0);

        public List<Cell> CellsInZone(string zoneId)
        {
            var cells = new List<Cell>();
            for (var y = 0; y < Height; y++)
                for (var x = 0; x < Width; x++)
                    if (_zones[y * Width + x] == zoneId) cells.Add(new Cell(x, y));
            return cells;
        }
    }

    /// <summary>Per-map explored-tiles bitset, stored in saves as base64.</summary>
    public sealed class FogMask
    {
        private readonly byte[] _bits;
        public int Width { get; }
        public int Height { get; }

        public FogMask(int width, int height, string? base64 = null)
        {
            Width = width;
            Height = height;
            _bits = new byte[(width * height + 7) / 8];
            if (!string.IsNullOrEmpty(base64))
            {
                var data = Convert.FromBase64String(base64);
                Array.Copy(data, _bits, Math.Min(data.Length, _bits.Length));
            }
        }

        public bool Get(int x, int y)
        {
            if (x < 0 || y < 0 || x >= Width || y >= Height) return false;
            var i = y * Width + x;
            return (_bits[i >> 3] & (1 << (i & 7))) != 0;
        }

        public void Set(int x, int y)
        {
            if (x < 0 || y < 0 || x >= Width || y >= Height) return;
            var i = y * Width + x;
            _bits[i >> 3] |= (byte)(1 << (i & 7));
        }

        public void RevealCircle(int cx, int cy, int radius)
        {
            for (var y = cy - radius; y <= cy + radius; y++)
                for (var x = cx - radius; x <= cx + radius; x++)
                    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius + radius)
                        Set(x, y);
        }

        public string ToBase64() => Convert.ToBase64String(_bits);

        public static FogMask For(PlayerState p, MapGrid map)
        {
            p.Revealed.TryGetValue(map.Def.Id, out var data);
            return new FogMask(map.Width, map.Height, data);
        }

        public void SaveTo(PlayerState p, MapGrid map) => p.Revealed[map.Def.Id] = ToBase64();
    }
}
