using System.Collections.Generic;
using Godot;
using TuTien.Core;
using TuTienLuc.Art;

namespace TuTienLuc.Field;

/// <summary>
/// The painted landscape behind the title: the same ground shader, scenery and figures as the world,
/// arranged as a view toward the Thanh Vân peaks. The menu covers the left of the screen, so the
/// picture is composed on the right: a river winding down from the snow, the road crossing it on a
/// bridge, the sect on the mountain's shoulder, and a cultivator on the road looking up at it. Mist
/// hangs on the peaks, petals blow past, and the view drifts slowly.
/// </summary>
public partial class TitleScene : Node2D
{
    private const float Cell = 128;
    private const int W = 18, H = 10;
    /// <summary>How much of the valley shows: the right edge (in tiles) and the height (tiles).</summary>
    private const float RightEdge = 16.9f, Rows = 8.2f, Top = 0.9f;

    private float _time;
    private readonly List<Particle> _petals = new();
    private PetalLayer _petalLayer = null!;
    private Node2D _world = null!;

    public override void _Ready()
    {
        _world = new Node2D();
        AddChild(_world);
        var grid = new int[W, H];
        for (var y = 0; y < H; y++)
        {
            for (var x = 0; x < W; x++)
            {
                var t = TerrainId.Plains;
                if (y <= 1) t = TerrainId.Peak;
                else if (y == 2) t = x % 5 == 2 ? TerrainId.Peak : TerrainId.Mountain;
                else if (y == 3) t = TerrainId.Hills;
                else if (x <= 4 && y >= 5) t = TerrainId.Forest;
                else if (x >= 15 && y >= 4) t = y >= 8 ? TerrainId.Dense : TerrainId.Forest;
                grid[x, y] = t;
            }
        }
        // A river winding down from the mountains, crossed by the road on a bridge.
        var river = new[] { (12, 3), (12, 4), (12, 5), (11, 5), (11, 6), (11, 7), (11, 8), (10, 8), (10, 9) };
        foreach (var (x, y) in river) grid[x, y] = TerrainId.Water;
        for (var x = 0; x < W; x++)
            if (grid[x, 7] != TerrainId.Water) grid[x, 7] = TerrainId.Road;
        grid[11, 7] = TerrainId.Bridge;

        var noise = TerrainTextures.Noise();
        var ground = ShaderQuad.MakeMaterial("res://shaders/terrain.gdshader", new Dictionary<string, Variant>
        {
            ["terrain_tex"] = TerrainTextures.Terrain(W, H, (x, y) => grid[x, y]), ["noise_tex"] = noise,
            ["map_cells"] = new Vector2(W, H), ["cell_px"] = Cell, ["season"] = 0,
        });
        _world.AddChild(new ShaderQuad(new Rect2(-256, -256, W * Cell + 512, H * Cell + 512), ground, -20));
        var sway = ShaderQuad.MakeMaterial("res://shaders/sway.gdshader", new Dictionary<string, Variant> { ["strength"] = 1.2f });

        var objects = new Node2D { YSortEnabled = true };
        _world.AddChild(objects);
        void Add(Vector2 at, System.Action<CanvasItem, float> art, bool animated = false, Material? mat = null) =>
            objects.AddChild(new Prop(at, art, animated, null, mat));

        // Snow peaks across the top, taller at the back.
        for (var x = -1; x <= W; x++)
        {
            var seed = x * 37 + 5;
            var h = 260 + FieldMath.Hash01(x, 0, 1) * 150;
            Add(new Vector2(x * Cell + 40, 2.1f * Cell), (c, _) => PropArt.Cliff(c, seed, 230, h, true));
        }
        for (var x = 0; x < W; x += 1)
        {
            if (x is 11 or 12) continue;
            var seed = x * 53 + 11;
            var h = 140 + FieldMath.Hash01(x, 1, 2) * 90;
            Add(new Vector2(x * Cell + 70, 3.05f * Cell), (c, _) => PropArt.Cliff(c, seed, 190, h, x % 3 == 0));
        }
        // The sect on its shoulder of the mountain, across the river from the road.
        Add(new Vector2(13.5f * Cell, 3.35f * Cell), (c, _) => PropArt.Pagoda(c));
        Add(new Vector2(15.1f * Cell, 3.5f * Cell), (c, _) => PropArt.Hall(c));

        // Forest on both sides, pines on the hills, blossoms and a willow along the river.
        var trees = new (float x, float y, TreeKind kind, float s)[]
        {
            (0.6f, 6.4f, TreeKind.Pine, 1.2f), (1.5f, 6.0f, TreeKind.Broadleaf, 1.25f), (2.4f, 5.6f, TreeKind.Pine, 1.1f),
            (0.9f, 8.3f, TreeKind.Broadleaf, 1.35f), (2.9f, 8.6f, TreeKind.Bamboo, 1.1f), (1.9f, 9.4f, TreeKind.Pine, 1.3f),
            (3.8f, 6.2f, TreeKind.Pine, 1f), (4.2f, 8.9f, TreeKind.Broadleaf, 1.2f),
            (15.6f, 4.7f, TreeKind.Pine, 1.1f), (16.6f, 5.2f, TreeKind.Broadleaf, 1.2f), (15.3f, 5.9f, TreeKind.Broadleaf, 1.25f),
            (16.3f, 6.4f, TreeKind.Pine, 1.2f), (17.3f, 6.9f, TreeKind.Bamboo, 1.1f), (15.8f, 8.3f, TreeKind.Pine, 1.35f),
            (16.9f, 8.9f, TreeKind.Broadleaf, 1.3f), (14.6f, 8.8f, TreeKind.Pine, 1.2f),
            (6.5f, 4.4f, TreeKind.Pine, 0.95f), (8.8f, 4.2f, TreeKind.Pine, 1f), (10.3f, 4.5f, TreeKind.Pine, 0.9f),
            (10.1f, 6.1f, TreeKind.Blossom, 1.15f), (13.3f, 5.5f, TreeKind.Blossom, 1.1f), (9.5f, 8.8f, TreeKind.Blossom, 1.25f),
            (12.7f, 8.7f, TreeKind.Blossom, 1.2f), (9.6f, 6.6f, TreeKind.Willow, 1.15f),
        };
        foreach (var (x, y, kind, s) in trees)
        {
            var seed = (int)(x * 97 + y * 13);
            Add(new Vector2(x * Cell, y * Cell), (c, _) => PropArt.Tree(c, kind, seed, Season.Spring, s), mat: sway);
        }
        foreach (var (x, y, s) in new[] { (14.3f, 6.6f, 22f), (8.6f, 6.3f, 18f), (13.8f, 8.5f, 26f), (6.8f, 8.3f, 20f) })
        {
            var seed = (int)(x * 31);
            Add(new Vector2(x * Cell, y * Cell), (c, _) => PropArt.Rock(c, seed, s, false));
        }
        foreach (var (x, y) in new[] { (12.6f, 4.5f), (11.6f, 5.6f), (10.6f, 6.7f), (11.8f, 8.4f), (10.6f, 9.3f) })
        {
            var seed = (int)(x * 7 + y);
            Add(new Vector2(x * Cell, y * Cell), (c, _) => PropArt.Reeds(c, seed), mat: sway);
        }
        Add(new Vector2(9.2f * Cell, 7.3f * Cell), (c, time) => PropArt.Lantern(c, true, time), animated: true);
        Add(new Vector2(13.2f * Cell, 7.3f * Cell), (c, time) => PropArt.Lantern(c, true, time), animated: true);

        // The cultivator, on the road past the bridge, looking up at the sect and the peaks.
        var hero = new Fighter { Kind = "human", Look = Look.Player(), Facing = Vector2.Up, Pos = new Vector2(12.45f * Cell, 7.55f * Cell) };
        objects.AddChild(new Figure(hero));

        // Mist on the high peaks (thinning lower down) and at the far edges.
        var fog = TerrainTextures.FogImage(W, H);
        for (var y = 0; y < H; y++)
            for (var x = 0; x < W; x++)
                fog.SetPixel(x, y, y == 0 || x == 0 || x == W - 1 ? Colors.Black : y == 1 ? new Color(0.5f, 0.5f, 0.5f) : Colors.White);
        var fogMat = ShaderQuad.MakeMaterial("res://shaders/fog.gdshader", new Dictionary<string, Variant>
        {
            ["fog_tex"] = ImageTexture.CreateFromImage(fog), ["noise_tex"] = noise, ["map_cells"] = new Vector2(W, H),
            ["cell_px"] = Cell, ["strength"] = 0.85f,
        });
        _world.AddChild(new ShaderQuad(new Rect2(-256, -256, W * Cell + 512, H * Cell + 512), fogMat, 20));

        _petalLayer = new PetalLayer(_petals) { ZIndex = 30 };
        AddChild(_petalLayer);
    }

    public override void _Process(double delta)
    {
        var dt = (float)delta;
        _time += dt;
        var view = GetViewportRect().Size;
        // Show the valley's height; hold the right edge (the picture) and let a wide screen reveal more
        // of the left, under the menu, without running past the painted ground. Drift slowly.
        var scale = Mathf.Max(view.Y / (Rows * Cell), view.X / ((RightEdge + 1.6f) * Cell));
        var pan = 0.5f + 0.5f * Mathf.Sin(_time * 0.035f);
        _world.Scale = new Vector2(scale, scale);
        _world.Position = new Vector2(view.X - (RightEdge - 0.8f * pan) * Cell * scale, -Top * Cell * scale);

        // Blossom petals blowing across.
        if (GD.Randf() < dt * 7)
        {
            var life = 7 + GD.Randf() * 5;
            _petals.Add(new Particle
            {
                Pos = new Vector2(-20, GD.Randf() * view.Y * 0.9f), Vel = new Vector2(40 + GD.Randf() * 50, 10 + GD.Randf() * 18),
                Life = life, MaxLife = life, Size = 3 + GD.Randf() * 2.5f, Color = GD.Randf() < 0.3f ? new Color("#fff4f7") : new Color("#f0b3c6"),
                Kind = ParticleKind.Leaf, Spin = GD.Randf() * 4 - 2, Angle = GD.Randf() * 6,
            });
        }
        for (var i = _petals.Count - 1; i >= 0; i--)
        {
            var p = _petals[i];
            p.Life -= dt;
            p.Pos += new Vector2(p.Vel.X, p.Vel.Y + Mathf.Sin(_time * 1.3f + i) * 14) * dt;
            p.Angle += p.Spin * dt;
            if (p.Life <= 0 || p.Pos.X > view.X + 40) _petals.RemoveAt(i);
        }
        _petalLayer.QueueRedraw();
    }

    /// <summary>A figure that just stands and breathes (no controller, no field).</summary>
    private partial class Figure : Node2D
    {
        private readonly Fighter _body;
        private float _time;

        public Figure(Fighter body)
        {
            _body = body;
            Position = body.Pos;
        }

        public override void _Process(double delta)
        {
            _time += (float)delta;
            QueueRedraw();
        }

        public override void _Draw()
        {
            var pose = new Pose { Dir = Facing4.Up, Time = _time, Side = 1, LookAt = Vector2.Up * 100 };
            Figures.Draw(this, "human", _body.Look, pose, 1.25f);
        }
    }

    private partial class PetalLayer : Node2D
    {
        private readonly List<Particle> _petals;

        public PetalLayer(List<Particle> petals) => _petals = petals;

        public override void _Draw()
        {
            foreach (var p in _petals)
            {
                var k = Mathf.Clamp(p.Life / 1.5f, 0, 1) * Mathf.Clamp((p.MaxLife - p.Life) / 1.2f, 0, 1);
                DrawColoredPolygon(Paint.EllipsePts(p.Pos, p.Size, p.Size * 0.5f, 8, p.Angle), new Color(p.Color, 0.85f * k));
            }
        }
    }
}
