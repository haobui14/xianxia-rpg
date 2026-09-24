using System;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.World;
using TuTienLuc.Art;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.Field;

/// <summary>
/// Dresses a region map: forests, rocks and mountains from the terrain, reeds on the banks, and the
/// hand-laid places — the village, the sect, the secret realm's cave, spirit veins and passes — with
/// their collision and what [E] does there. Everything is placed by a hash of the tile, so the world
/// looks the same every time it loads.
/// </summary>
public static class WorldScenery
{
    private const float C = WorldScreen.Cell;
    private static string T(string vi, string en) => Game.Instance.T(vi, en);
    private static float H(int x, int y, int salt) => FieldMath.Hash01(x, y, salt);
    private static int Seed(int x, int y, int salt = 0) => (int)(H(x, y, salt + 101) * 100000);
    private static Vector2 V(float x, float y) => new(x, y);

    public static void Build(WorldScreen w)
    {
        var map = w.E.Map;
        for (var y = 0; y < map.Height; y++)
            for (var x = 0; x < map.Width; x++)
                Dress(w, map, x, y);

        foreach (var poi in map.Def.Pois)
        {
            switch (poi.Kind)
            {
                case "town":
                    Village(w, poi);
                    break;
                case "sect":
                    Sect(w, poi);
                    break;
                case "secret_realm":
                    Cave(w, poi);
                    break;
                case "spirit_vein":
                    Vein(w, poi);
                    break;
                case "pass":
                    Pass(w, poi);
                    break;
            }
        }
    }

    // ================================================================ terrain dressing

    private static bool Border(MapGrid map, int x, int y) => x == 0 || y == 0 || x == map.Width - 1 || y == map.Height - 1;

    private static bool IsWater(MapGrid map, int x, int y) => map.InBounds(x, y) && map.At(x, y) == Terrain.Water;

    private static bool HasPoi(MapGrid map, int x, int y) => map.Def.Pois.Any(p => p.X == x && p.Y == y);

    private static void Dress(WorldScreen w, MapGrid map, int x, int y)
    {
        var t = map.At(x, y);
        var origin = V(x * C, y * C);
        var zone = map.ZoneAt(x, y);
        if (t is Terrain.Road or Terrain.Bridge or Terrain.Town or Terrain.Sect or Terrain.Water) return;
        var poiHere = HasPoi(map, x, y);

        // The rim of the region and the snow peaks are walls of rock.
        if (t == Terrain.Peak || (t == Terrain.Mountain && Border(map, x, y)))
        {
            var peak = t == Terrain.Peak;
            var width = 150 + H(x, y, 1) * 40;
            var height = peak ? 200 + H(x, y, 2) * 70 : 120 + H(x, y, 2) * 70;
            var at = origin + V(C / 2 + (H(x, y, 3) - 0.5f) * 30, C - 4);
            var seed = Seed(x, y);
            var snow = peak || y <= 2;
            w.AddScenery(at, (c, _) => PropArt.Cliff(c, seed, width, height, snow || w.Season == Season.Winter), occludes: true, extent: V(width / 2, height));
            return;
        }

        if (poiHere) return;
        var n = H(x, y, 7);
        switch (t)
        {
            case Terrain.Forest:
                Trees(w, map, x, y, zone, 2, n);
                if (H(x, y, 11) < 0.5f) Bush(w, origin + Jitter(x, y, 12, 40));
                break;
            case Terrain.DenseForest:
                Trees(w, map, x, y, zone, 3, n);
                if (H(x, y, 11) < 0.6f) Bush(w, origin + Jitter(x, y, 12, 40));
                break;
            case Terrain.Hills:
                if (n < 0.55f) Rock(w, origin + Jitter(x, y, 13, 30), 14 + H(x, y, 14) * 12, Seed(x, y, 1));
                if (H(x, y, 15) < 0.45f) Bush(w, origin + Jitter(x, y, 16, 30));
                if (H(x, y, 17) < 0.25f) Tree(w, origin + Jitter(x, y, 18, 30), TreeKind.Pine, Seed(x, y, 2), 0.95f);
                break;
            case Terrain.Mountain:
                Rock(w, origin + Jitter(x, y, 13, 26), 18 + H(x, y, 14) * 16, Seed(x, y, 1));
                if (H(x, y, 15) < 0.5f) Rock(w, origin + Jitter(x, y, 19, 26), 10 + H(x, y, 20) * 8, Seed(x, y, 3));
                if (H(x, y, 17) < 0.35f) Tree(w, origin + Jitter(x, y, 18, 26), TreeKind.Pine, Seed(x, y, 2), 1.05f);
                break;
            case Terrain.Swamp:
                Reeds(w, origin + Jitter(x, y, 21, 30));
                if (H(x, y, 22) < 0.6f) Reeds(w, origin + Jitter(x, y, 23, 30));
                if (H(x, y, 24) < 0.3f) Tree(w, origin + Jitter(x, y, 25, 30), TreeKind.Willow, Seed(x, y, 4), 1f);
                break;
            case Terrain.Plains:
                if (n < 0.07f) Tree(w, origin + Jitter(x, y, 26, 30), zone == "spirit_herb_garden" ? TreeKind.Blossom : TreeKind.Broadleaf, Seed(x, y, 5), 1f);
                else if (n < 0.17f) Bush(w, origin + Jitter(x, y, 27, 36));
                else if (n < 0.21f) Rock(w, origin + Jitter(x, y, 28, 36), 10 + H(x, y, 29) * 8, Seed(x, y, 6));
                break;
        }

        // Reeds where land meets water.
        foreach (var (dx, dy) in new[] { (1, 0), (-1, 0), (0, 1), (0, -1) })
        {
            if (!IsWater(map, x + dx, y + dy) || H(x, y, 30 + dx * 3 + dy) > 0.55f) continue;
            var edge = origin + V(C / 2 + dx * (C / 2 - 16), C / 2 + dy * (C / 2 - 12)) + V(dy != 0 ? (H(x, y, 33) - 0.5f) * 70 : 0, dx != 0 ? (H(x, y, 34) - 0.5f) * 70 : 0);
            Reeds(w, edge);
        }
    }

    private static Vector2 Jitter(int x, int y, int salt, float spread) =>
        V(C / 2 + (H(x, y, salt) - 0.5f) * spread * 2, C / 2 + (H(x, y, salt + 50) - 0.5f) * spread * 2);

    /// <summary>Two or three trees on a 2×2 grid inside the tile, never a solid wall of trunks.</summary>
    private static void Trees(WorldScreen w, MapGrid map, int x, int y, string? zone, int count, float n)
    {
        var slots = new[] { V(-34, -30), V(34, -34), V(-30, 32), V(32, 30) };
        var skip = (int)(H(x, y, 40) * 4);
        var placed = 0;
        for (var i = 0; i < 4 && placed < count; i++)
        {
            var s = (i + skip) % 4;
            var at = V(x * C + C / 2, y * C + C / 2) + slots[s] + V((H(x, y, 41 + i) - 0.5f) * 22, (H(x, y, 45 + i) - 0.5f) * 22);
            var pick = H(x, y, 49 + i);
            TreeKind kind;
            float scale;
            switch (zone)
            {
                case "spirit_herb_garden":
                    kind = pick < 0.35f ? TreeKind.Blossom : pick < 0.6f ? TreeKind.Bamboo : TreeKind.Broadleaf;
                    scale = 0.9f + H(x, y, 53 + i) * 0.25f;
                    break;
                case "ancient_tree_hollow":
                    kind = pick < 0.55f ? TreeKind.Broadleaf : TreeKind.Pine;
                    scale = 1.15f + H(x, y, 53 + i) * 0.35f;
                    break;
                default:
                    kind = map.At(x, y) == Terrain.DenseForest
                        ? (pick < 0.55f ? TreeKind.Pine : TreeKind.Broadleaf)
                        : (pick < 0.62f ? TreeKind.Broadleaf : pick < 0.86f ? TreeKind.Pine : TreeKind.Bamboo);
                    scale = 0.92f + H(x, y, 53 + i) * 0.3f;
                    break;
            }
            Tree(w, at, kind, Seed(x, y, 60 + i), scale);
            placed++;
        }
    }

    public static void Tree(WorldScreen w, Vector2 at, TreeKind kind, int seed, float scale)
    {
        w.AddScenery(at, (c, _) => PropArt.Tree(c, kind, seed, w.Season, scale), occludes: true, sway: true, extent: V(42 * scale, 104 * scale));
        if (kind != TreeKind.Bamboo) w.Walls.Add(Obstacle.Circle(at + V(0, -2), 8 * scale));
        else w.Walls.Add(Obstacle.Circle(at + V(0, -2), 12 * scale));
    }

    private static void Bush(WorldScreen w, Vector2 at)
    {
        var seed = (int)(at.X * 7 + at.Y * 13);
        var s = 0.9f + FieldMath.Hash01((int)at.X, (int)at.Y, 3) * 0.4f;
        w.AddScenery(at, (c, _) => PropArt.Bush(c, seed, w.Season, s), sway: true);
    }

    private static void Rock(WorldScreen w, Vector2 at, float size, int seed)
    {
        w.AddScenery(at, (c, _) => PropArt.Rock(c, seed, size, w.Season == Season.Winter));
        w.Walls.Add(Obstacle.Circle(at + V(0, -size * 0.3f), size * 0.8f));
    }

    private static void Reeds(WorldScreen w, Vector2 at)
    {
        var seed = (int)(at.X * 3 + at.Y * 5);
        w.AddScenery(at, (c, _) => PropArt.Reeds(c, seed), sway: true);
    }

    private static void Box(WorldScreen w, float x, float y, float width, float height, bool shots = true) =>
        w.Walls.Add(Obstacle.Box(new Rect2(x, y, width, height), shots));

    // ================================================================ the village

    /// <summary>Thanh Vân village: the inn, the market stall and the bounty board are each a door into the town panel.</summary>
    private static void Village(WorldScreen w, PoiDef poi)
    {
        void House(float x, float baseY, float width, int seed)
        {
            w.AddScenery(V(x, baseY), (c, _) => PropArt.House(c, seed, width), occludes: true, extent: V(width / 2 + 14, 104));
            Box(w, x - width / 2, baseY - 52, width, 52);
        }

        // North side of the high street (row 22), leaving the north road (column 7) clear.
        House(620, 2800, 150, 11);
        House(790, 2795, 110, 12);
        w.AddScenery(V(1150, 2800), (c, _) => PropArt.Inn(c), occludes: true, extent: V(112, 170));
        Box(w, 1050, 2744, 200, 56);
        w.Walls.Add(Obstacle.Circle(V(1264, 2798), 5));
        // South side.
        House(610, 3180, 150, 13);
        House(930, 3190, 130, 14);
        House(1160, 3185, 150, 15);

        w.AddScenery(V(1090, 3010), (c, _) => PropArt.Stall(c, 3));
        Box(w, 1046, 2988, 88, 22);
        w.AddScenery(V(840, 3000), (c, _) => PropArt.NoticeBoard(c));
        Box(w, 806, 2992, 68, 10);
        w.AddScenery(V(690, 3010), (c, _) => PropArt.Well(c));
        w.Walls.Add(Obstacle.Circle(V(690, 3002), 22));
        w.AddScenery(V(1185, 3016), (c, _) => PropArt.Crates(c, 1));
        w.Walls.Add(Obstacle.Circle(V(1182, 3008), 14));
        w.AddScenery(V(556, 2992), (c, _) => PropArt.Crates(c, 2));
        w.Walls.Add(Obstacle.Circle(V(553, 2984), 14));
        foreach (var at in new[] { V(870, 2806), V(1030, 2806), V(740, 2958), V(990, 2958) })
        {
            w.AddScenery(at, (c, time) => PropArt.Lantern(c, false, time), animated: true);
            w.Walls.Add(Obstacle.Circle(at, 4));
        }
        w.AddScenery(V(560, 3222), (c, _) => PropArt.Fence(c, 110));
        w.AddScenery(V(1236, 3226), (c, _) => PropArt.Fence(c, 80));
        Tree(w, V(528, 2700), TreeKind.Willow, 71, 1.05f);
        Tree(w, V(1262, 3120), TreeKind.Blossom, 72, 1f);

        w.Interactions.Add(new Interaction
        {
            At = () => V(1150, 2826), Reach = 76, Height = 96,
            Label = () => T("Khách điếm — nghỉ trọ, bế quan", "The inn — rest, seclusion"),
            Act = () => w.OpenPanel(new TownPanel(poi, 0)),
        });
        w.Interactions.Add(new Interaction
        {
            At = () => V(1090, 3036), Reach = 70, Height = 66,
            Label = () => T("Sạp hàng — mua bán", "Market stall — buy & sell"),
            Act = () => w.OpenPanel(new TownPanel(poi, 1)),
        });
        w.Interactions.Add(new Interaction
        {
            At = () => V(840, 3024), Reach = 70, Height = 96,
            Label = () => T("Bảng cáo thị — treo thưởng", "Bounty board"),
            Act = () => w.OpenPanel(new TownPanel(poi, 2)),
        });
    }

    // ================================================================ the sect

    private static void Sect(WorldScreen w, PoiDef poi)
    {
        // The mountain gate at the head of the road; cliffs to either side make it the way in.
        w.AddScenery(V(960, 884), (c, _) => PropArt.SectGate(c), occludes: true, extent: V(118, 184));
        foreach (var x in new[] { 856f, 1064f }) w.Walls.Add(Obstacle.Circle(V(x, 878), 11));
        foreach (var x in new[] { 918f, 1002f }) w.Walls.Add(Obstacle.Circle(V(x, 878), 12));
        foreach (var cx in new[] { 5, 6, 8, 9 })
        {
            var at = V(cx * C + C / 2, 8 * C - 6);
            var seed = 300 + cx;
            w.AddScenery(at, (c, _) => PropArt.Cliff(c, seed, 150, 110, w.Season == Season.Winter), occludes: true, extent: V(75, 110));
            Box(w, cx * C, 7 * C + 30, C, C - 34);
        }

        w.AddScenery(V(1060, 560), (c, _) => PropArt.Hall(c), occludes: true, extent: V(164, 186));
        Box(w, 905, 490, 310, 70);
        w.AddScenery(V(1320, 700), (c, _) => PropArt.Pagoda(c), occludes: true, extent: V(46, 240));
        w.Walls.Add(Obstacle.Circle(V(1320, 690), 38));
        foreach (var at in new[] { V(760, 700), V(826, 742), V(742, 786) })
        {
            w.AddScenery(at, (c, _) => PropArt.Dummy(c));
            w.Walls.Add(Obstacle.Circle(at, 8));
        }
        w.AddScenery(V(1060, 672), (c, time) => PropArt.Incense(c, time), animated: true);
        w.Walls.Add(Obstacle.Circle(V(1060, 654), 18));
        foreach (var at in new[] { V(930, 640), V(1190, 640), V(900, 820), V(1020, 820) })
        {
            w.AddScenery(at, (c, time) => PropArt.Lantern(c, true, time), animated: true);
            w.Walls.Add(Obstacle.Circle(at + V(0, -6), 9));
        }
        Tree(w, V(700, 462), TreeKind.Pine, 81, 1.1f);
        Tree(w, V(1372, 478), TreeKind.Pine, 82, 1.15f);
        Tree(w, V(690, 860), TreeKind.Pine, 83, 0.95f);

        w.Interactions.Add(new Interaction
        {
            At = () => V(1060, 590), Reach = 84, Height = 150,
            Label = () => T($"{poi.Name} — chính điện", $"{poi.NameEn} — main hall"),
            Act = () => w.OpenPanel(new SectPanel(poi)),
        });
    }

    // ================================================================ places of power

    private static Vector2 Center(PoiDef poi) => V(poi.X * C + C / 2, poi.Y * C + C / 2);

    private static void Cave(WorldScreen w, PoiDef poi)
    {
        var c0 = Center(poi);
        var at = c0 + V(0, 30);
        w.AddScenery(at, (c, time) => PropArt.Cave(c, time), animated: true, occludes: true, extent: V(104, 124));
        w.Walls.Add(Obstacle.Circle(at + V(-70, -30), 40));
        w.Walls.Add(Obstacle.Circle(at + V(70, -30), 40));
        Box(w, at.X - 80, at.Y - 110, 160, 70);
        w.Interactions.Add(new Interaction
        {
            At = () => at + V(0, 8), Reach = 80, Height = 150,
            Label = () => T($"Tiến vào {poi.Name}", $"Enter the {poi.NameEn}"),
            Act = () => w.OpenPanel(new RealmPanel(poi)),
        });
    }

    private static void Vein(WorldScreen w, PoiDef poi)
    {
        var c0 = Center(poi);
        var spring = poi.Glyph == "泉";
        var at = c0 + V(0, spring ? 4 : -18);
        if (spring)
        {
            w.AddScenery(at, (c, time) => PropArt.Spring(c, time), animated: true);
            w.Walls.Add(Obstacle.Box(new Rect2(at.X - 62, at.Y - 36, 124, 54), shots: false));
        }
        else
        {
            w.AddScenery(at, (c, time) => PropArt.Crystals(c, time), animated: true, occludes: true, extent: V(44, 80));
            w.Walls.Add(Obstacle.Circle(at + V(0, -6), 34));
        }
        var spot = c0 + V(0, spring ? 48 : 40);
        w.Interactions.Add(new Interaction
        {
            At = () => spot, Reach = 78, Height = spring ? 60 : 110,
            Label = () => T($"Bế quan tại {poi.Name} (linh khí +{poi.QiBonus}%)", $"Seclude at the {poi.NameEn} (qi +{poi.QiBonus}%)"),
            Act = () =>
            {
                w.EnterTile(poi.X, poi.Y, spot);
                w.OpenPanel(new SeclusionPanel());
            },
        });
    }

    private static void Pass(WorldScreen w, PoiDef poi)
    {
        var c0 = Center(poi);
        var top = poi.Y == 0;
        var at = top ? c0 + V(58, 54) : c0 + V(-26, -46);
        w.AddScenery(at, (c, _) => PropArt.Stele(c));
        w.Walls.Add(Obstacle.Circle(at + V(0, -4), 14));
        w.Interactions.Add(new Interaction
        {
            At = () => top ? c0 + V(0, 40) : c0 + V(-30, 10), Reach = 90, Height = 96,
            Label = () => T(poi.Name, poi.NameEn),
            Act = () => Game.Instance.Toast(
                "Cửa ải dẫn tới vùng khác — sẽ mở ở cột mốc M4 (thế giới 5 vùng).",
                "This pass leads to another region — opens in milestone M4 (the 5-region world)."),
        });
    }
}
