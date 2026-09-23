using System;
using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.World;
using TuTienLuc.Ui;

namespace TuTienLuc.World;

/// <summary>
/// Draws the region map in the ink-wash style: a static terrain layer (redrawn when the fog
/// changes) and a token layer (POIs, beasts, people, adventures, the player) redrawn every frame.
/// </summary>
public partial class MapView : Node2D
{
    public const int Tile = 40;

    private GameEngine E => Game.Instance.Engine!;
    private TerrainLayer _terrain = null!;
    private TokenLayer _tokens = null!;

    public Vector2 PlayerDrawPos { get; private set; }
    public PathResult? PlannedPath { get; set; }
    public Vector2I? Hover { get; set; }

    public override void _Ready()
    {
        _terrain = new TerrainLayer(this);
        _tokens = new TokenLayer(this);
        AddChild(_terrain);
        AddChild(_tokens);
        PlayerDrawPos = CellCenter(E.Player.X, E.Player.Y);
    }

    public static Vector2 CellCenter(int x, int y) => new(x * Tile + Tile / 2f, y * Tile + Tile / 2f);
    public static Vector2I CellAt(Vector2 world) => new((int)Mathf.Floor(world.X / Tile), (int)Mathf.Floor(world.Y / Tile));

    public Vector2 WorldSize => new(E.Map.Width * Tile, E.Map.Height * Tile);

    public void RedrawTerrain() => _terrain.QueueRedraw();

    public void SnapPlayer() => PlayerDrawPos = CellCenter(E.Player.X, E.Player.Y);

    public override void _Process(double delta)
    {
        if (Game.Instance.Engine == null) return; // the run just ended; the screen is on its way out
        var target = CellCenter(E.Player.X, E.Player.Y);
        PlayerDrawPos = PlayerDrawPos.DistanceTo(target) < 1f
            ? target
            : PlayerDrawPos.Lerp(target, Mathf.Min(1f, (float)delta * 14f));
        _tokens.QueueRedraw();
    }

    // ---------------------------------------------------------------------------------------

    private static readonly Dictionary<Terrain, Color> TerrainColor = new()
    {
        [Terrain.Plains] = new Color("#e4d6b0"),
        [Terrain.Road] = new Color("#ede2c6"),
        [Terrain.Forest] = new Color("#bccaa6"),
        [Terrain.DenseForest] = new Color("#98ae90"),
        [Terrain.Hills] = new Color("#d6c596"),
        [Terrain.Mountain] = new Color("#b9ad8e"),
        [Terrain.Peak] = new Color("#8c8470"),
        [Terrain.Water] = new Color("#a4bcc2"),
        [Terrain.Bridge] = new Color("#c8a66a"),
        [Terrain.Swamp] = new Color("#a7aa86"),
        [Terrain.Town] = new Color("#e9d2a3"),
        [Terrain.Sect] = new Color("#dcd3c0"),
    };

    private static float Noise(int x, int y) => (Mathf.Abs((x * 73856093) ^ (y * 19349663)) % 1000) / 1000f;

    private sealed partial class TerrainLayer : Node2D
    {
        private readonly MapView _view;
        private Dictionary<string, Vector2>? _zoneCenters;

        public TerrainLayer(MapView view) => _view = view;

        public override void _Draw()
        {
            var e = Game.Instance.Engine;
            if (e == null) return;
            var map = e.Map;
            var fog = e.Fog();
            var han = Ink.Han;
            var mapSize = new Vector2(map.Width * Tile, map.Height * Tile);
            DrawRect(new Rect2(-4000, -4000, mapSize.X + 8000, mapSize.Y + 8000), Ink.PaperDarker.Darkened(0.08f));

            for (var y = 0; y < map.Height; y++)
            {
                for (var x = 0; x < map.Width; x++)
                {
                    var rect = new Rect2(x * Tile, y * Tile, Tile, Tile);
                    if (!fog.Get(x, y))
                    {
                        DrawRect(rect, new Color("#d7c697"));
                        var hatch = new Color(0.55f, 0.47f, 0.32f, 0.18f);
                        DrawLine(rect.Position + new Vector2(4, Tile - 4), rect.Position + new Vector2(Tile - 4, 4), hatch, 1);
                        continue;
                    }
                    var t = map.At(x, y);
                    var n = Noise(x, y);
                    var color = TerrainColor[t].Darkened((n - 0.5f) * 0.06f);
                    DrawRect(rect, color);
                    Decorate(t, rect, n, han);
                }
            }

            // Zone borders (dashed ink) between revealed tiles of different zones.
            var border = new Color(Ink.InkColor, 0.35f);
            for (var y = 0; y < map.Height; y++)
            {
                for (var x = 0; x < map.Width; x++)
                {
                    if (!fog.Get(x, y)) continue;
                    var z = map.ZoneAt(x, y);
                    if (z == null) continue;
                    if (x + 1 < map.Width && fog.Get(x + 1, y) && map.ZoneAt(x + 1, y) is { } zr && zr != z)
                        DrawDashedLine(new Vector2((x + 1) * Tile, y * Tile), new Vector2((x + 1) * Tile, (y + 1) * Tile), border, 2, 5);
                    if (y + 1 < map.Height && fog.Get(x, y + 1) && map.ZoneAt(x, y + 1) is { } zb && zb != z)
                        DrawDashedLine(new Vector2(x * Tile, (y + 1) * Tile), new Vector2((x + 1) * Tile, (y + 1) * Tile), border, 2, 5);
                }
            }

            DrawRect(new Rect2(Vector2.Zero, mapSize), Ink.InkColor, false, 4);
            DrawRect(new Rect2(new Vector2(-10, -10), mapSize + new Vector2(20, 20)), new Color(Ink.InkColor, 0.35f), false, 1.5f);

            // Zone names at their centroids, colored by danger.
            _zoneCenters ??= map.Def.ZoneLegend.Values.Distinct().ToDictionary(z => z, z =>
            {
                var cells = map.CellsInZone(z);
                return new Vector2((float)cells.Average(c => c.X), (float)cells.Average(c => c.Y));
            });
            var font = Ink.Serif;
            foreach (var (zone, center) in _zoneCenters)
            {
                var cx = (int)center.X;
                var cy = (int)center.Y;
                if (!fog.Get(cx, cy)) continue;
                var area = Game.Instance.Content.Area(zone);
                if (area == null) continue;
                var name = Game.Instance.T(area.Name, area.NameEn);
                var pos = CellCenter(cx, cy) + new Vector2(0, -Tile * 1.2f);
                var size = font.GetStringSize(name, HorizontalAlignment.Left, -1, 20);
                var box = new Rect2(pos - new Vector2(size.X / 2 + 10, 22), new Vector2(size.X + 20, 30));
                DrawRect(box, new Color(Ink.Card, 0.82f));
                DrawRect(box, new Color(Ink.Danger(area.DangerLevel), 0.9f), false, 2);
                DrawString(font, new Vector2(box.Position.X + 10, box.Position.Y + 22), name, HorizontalAlignment.Left, -1, 20, Ink.InkColor);
                var tag = area.IsSafe ? Game.Instance.T("an toàn", "safe") : Game.Instance.T($"hiểm {area.DangerLevel}", $"danger {area.DangerLevel}");
                if (area.CultivationBonus > 0) tag += $" · 氣 +{area.CultivationBonus}%";
                DrawString(Ink.UiFont, new Vector2(box.Position.X + 10, box.End.Y + 14), tag, HorizontalAlignment.Left, -1, 13, Ink.Danger(area.DangerLevel));
            }
        }

        private void Decorate(Terrain t, Rect2 r, float n, Font han)
        {
            var c = r.GetCenter();
            switch (t)
            {
                case Terrain.Forest when n < 0.45f:
                    DrawString(han, c + new Vector2(-9, 8), "木", HorizontalAlignment.Left, -1, 18, new Color(Ink.JadeDeep, 0.35f));
                    break;
                case Terrain.DenseForest:
                    DrawString(han, c + new Vector2(-10, 9), n < 0.5f ? "林" : "森", HorizontalAlignment.Left, -1, 19, new Color(Ink.JadeDeep, 0.45f));
                    break;
                case Terrain.Mountain:
                    DrawString(han, c + new Vector2(-10, 9), "山", HorizontalAlignment.Left, -1, 20, new Color(Ink.InkSoft, 0.4f));
                    break;
                case Terrain.Peak:
                    DrawString(han, c + new Vector2(-10, 9), "峰", HorizontalAlignment.Left, -1, 20, new Color(Ink.Card, 0.45f));
                    break;
                case Terrain.Hills when n < 0.5f:
                    DrawArc(c + new Vector2(0, 6), 10, Mathf.Pi, Mathf.Tau, 10, new Color(Ink.InkSoft, 0.3f), 1.5f);
                    break;
                case Terrain.Water:
                    var w = new Color(Ink.WaterBlue, 0.45f);
                    for (var i = 0; i < 2; i++)
                    {
                        var y = r.Position.Y + 13 + i * 14;
                        DrawPolyline(new[] { new Vector2(r.Position.X + 6, y), new Vector2(r.Position.X + 14, y - 3), new Vector2(r.Position.X + 22, y), new Vector2(r.Position.X + 30, y - 3), new Vector2(r.Position.X + 36, y) }, w, 1.5f, true);
                    }
                    break;
                case Terrain.Bridge:
                    for (var i = 0; i < 4; i++)
                        DrawLine(new Vector2(r.Position.X + 6 + i * 9, r.Position.Y + 4), new Vector2(r.Position.X + 6 + i * 9, r.End.Y - 4), new Color(Ink.GoldDeep, 0.6f), 2);
                    break;
                case Terrain.Road:
                    DrawCircle(c, 2.2f, new Color(Ink.InkMute, 0.45f));
                    break;
                case Terrain.Swamp:
                    DrawString(han, c + new Vector2(-9, 8), "沼", HorizontalAlignment.Left, -1, 17, new Color(Ink.JadeDeep, 0.35f));
                    break;
                case Terrain.Town when n < 0.35f:
                    DrawRect(new Rect2(c - new Vector2(7, 3), new Vector2(14, 10)), new Color(Ink.InkSoft, 0.35f), false, 1.5f);
                    DrawColoredPolygon(new[] { c + new Vector2(-10, -3), c + new Vector2(0, -11), c + new Vector2(10, -3) }, new Color(Ink.CinnabarDeep, 0.35f));
                    break;
            }
        }
    }

    private sealed partial class TokenLayer : Node2D
    {
        private readonly MapView _view;
        private float _time;

        public TokenLayer(MapView view) => _view = view;

        public override void _Process(double delta) => _time += (float)delta;

        public override void _Draw()
        {
            var e = Game.Instance.Engine;
            if (e == null) return;
            var han = Ink.Han;
            var ui = Ink.UiFont;

            // Spiritual sense radius.
            var r = (e.SenseRadius + 0.5f) * Tile;
            DrawArc(_view.PlayerDrawPos, r, 0, Mathf.Tau, 96, new Color(Ink.Jade, e.Player.SensePulse ? 0.55f : 0.25f), 2, true);

            foreach (var thing in e.VisibleThings())
            {
                var p = CellCenter(thing.X, thing.Y);
                switch (thing.Kind)
                {
                    case InteractKind.Beast:
                        DrawCircle(p, 16, new Color(Ink.Cinnabar, 0.92f));
                        DrawArc(p, 16, 0, Mathf.Tau, 24, Ink.CinnabarDeep, 2, true);
                        DrawGlyph(han, p, thing.Glyph, 18, Ink.Card);
                        break;
                    case InteractKind.Npc:
                        DrawCircle(p, 15, new Color(Ink.Card, 0.95f));
                        DrawArc(p, 15, 0, Mathf.Tau, 24, thing.Hostile ? Ink.Cinnabar : Ink.JadeDeep, 2.5f, true);
                        DrawGlyph(han, p, thing.Glyph, 16, Ink.InkColor);
                        break;
                    case InteractKind.Adventure:
                        var pulse = 0.6f + 0.4f * Mathf.Sin(_time * 3f);
                        DrawCircle(p, 13 + pulse * 3, new Color(Ink.Gold, 0.25f));
                        DrawCircle(p, 13, new Color(Ink.Gold, 0.95f));
                        DrawGlyph(han, p, "奇", 16, Ink.Card);
                        break;
                    case InteractKind.Herb:
                        DrawCircle(p, 11, new Color(thing.Ready ? Ink.Jade : Ink.InkFaint, 0.9f));
                        DrawGlyph(han, p, "草", 13, Ink.Card);
                        break;
                    default:
                        DrawSeal(han, p, thing, e);
                        break;
                }
            }

            // Planned path with its cost.
            if (_view.PlannedPath is { Steps.Count: > 0 } path)
            {
                var affordable = path.Cost <= e.Player.Footwork;
                var color = affordable ? Ink.JadeDeep : Ink.Cinnabar;
                foreach (var step in path.Steps) DrawCircle(CellCenter(step.X, step.Y), 4, new Color(color, 0.8f));
                var last = path.Steps[^1];
                DrawString(ui, CellCenter(last.X, last.Y) + new Vector2(12, -12), $"足 {path.Cost}", HorizontalAlignment.Left, -1, 15, color);
            }

            if (_view.Hover is { } h && e.Map.InBounds(h.X, h.Y))
                DrawRect(new Rect2(h.X * Tile + 1, h.Y * Tile + 1, Tile - 2, Tile - 2), new Color(Ink.InkColor, 0.5f), false, 2);

            // The player: a cinnabar seal.
            var pp = _view.PlayerDrawPos;
            var rect = new Rect2(pp - new Vector2(15, 15), new Vector2(30, 30));
            DrawRect(new Rect2(rect.Position + new Vector2(2, 3), rect.Size), new Color(0, 0, 0, 0.18f));
            DrawRect(rect, Ink.Cinnabar);
            DrawRect(rect.Grow(-3), Ink.Card, false, 1.5f);
            DrawGlyph(han, pp, "吾", 17, Ink.Card);
        }

        private void DrawSeal(Font han, Vector2 p, Interactable thing, GameEngine e)
        {
            var color = thing.Kind switch
            {
                InteractKind.Town => Ink.InkColor,
                InteractKind.Sect => Ink.Cinnabar,
                InteractKind.SecretRealm => Ink.Violet,
                InteractKind.SpiritVein => Ink.Jade,
                InteractKind.Pass => Ink.GoldDeep,
                _ => Ink.InkSoft,
            };
            var rect = new Rect2(p - new Vector2(17, 17), new Vector2(34, 34));
            DrawRect(new Rect2(rect.Position + new Vector2(2, 3), rect.Size), new Color(0, 0, 0, 0.15f));
            DrawRect(rect, color);
            DrawRect(rect.Grow(-3), new Color(Ink.Card, 0.8f), false, 1.2f);
            DrawGlyph(han, p, thing.Glyph, 20, Ink.Card);
            var name = Game.Instance.T(thing.Name, thing.NameEn);
            var size = Ink.Serif.GetStringSize(name, HorizontalAlignment.Left, -1, 15);
            var label = new Rect2(p + new Vector2(-size.X / 2 - 6, 20), new Vector2(size.X + 12, 22));
            DrawRect(label, new Color(Ink.Card, 0.9f));
            DrawRect(label, new Color(Ink.InkColor, 0.6f), false, 1);
            DrawString(Ink.Serif, label.Position + new Vector2(6, 16), name, HorizontalAlignment.Left, -1, 15, Ink.InkColor);
        }

        private void DrawGlyph(Font font, Vector2 center, string glyph, int size, Color color)
        {
            var s = font.GetStringSize(glyph, HorizontalAlignment.Left, -1, size);
            DrawString(font, center + new Vector2(-s.X / 2, size * 0.36f), glyph, HorizontalAlignment.Left, -1, size, color);
        }
    }
}
