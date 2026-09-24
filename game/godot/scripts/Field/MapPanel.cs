using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.World;
using TuTienLuc.Ui;

namespace TuTienLuc.Field;

/// <summary>
/// M: the region map. Click a place you have seen to plan the way there — the cheapest path in
/// footwork — then set off; the body walks it (crossing tiles still costs footwork, and the month may
/// turn on the road). Moving yourself cancels the walk. From Trúc Cơ a way over the river is flown.
/// </summary>
public partial class MapPanel : InkPanel
{
    private readonly WorldScreen _w;
    private Vector2I? _goal;
    private PathResult? _path;

    public MapPanel(WorldScreen world) => _w = world;

    protected override string Glyph => "圖";
    protected override string TitleText => T($"Bản đồ {E.Map.Def.Name}", $"Map of {E.Map.Def.NameEn}");
    protected override Vector2 PanelSize => new(900, 700);

    protected override void Build()
    {
        var canvas = new MapCanvas(this) { CustomMinimumSize = new Vector2(852, 532) };
        Body.AddChild(canvas);
        var p = E.Player;
        if (_path is { Steps.Count: > 0 } path)
        {
            var days = path.Cost;
            var turns = path.Cost > p.Footwork;
            Para(turns
                ? T($"Đường đi {days} 足 — còn {p.Footwork} trong tháng này, tháng sẽ trôi qua trên đường.",
                    $"{days} 足 of travel — {p.Footwork} left this month, so the month will turn on the road.")
                : T($"Đường đi {days} 足 (còn {p.Footwork} trong tháng này).", $"{days} 足 of travel ({p.Footwork} left this month)."), 15,
                turns ? Ink.GoldDeep : Ink.JadeDeep);
            Buttons(UiKit.Button(T("Lên đường", "Set off"), SetOff, primary: true), UiKit.Button(T("Đóng", "Close"), Close));
        }
        else
        {
            Para(T("Nhấp vào nơi đã khám phá để vạch đường. Đường mòn và cầu đi nhanh nhất; rừng rậm, đầm lầy và núi tốn nhiều cước lực.",
                "Click somewhere you have explored to plan a route. Roads and bridges are quickest; dense forest, swamps and mountains cost more footwork."), 14, Ink.InkMute);
        }
    }

    public void Pick(Vector2I cell)
    {
        if (!E.Map.InBounds(cell.X, cell.Y) || !_w.Explored(cell.X, cell.Y)) return;
        _goal = cell;
        _path = E.PlanPath(cell.X, cell.Y);
        RequestRefresh();
    }

    public Vector2I? Goal => _goal;
    public PathResult? Path => _path;

    public void SetOff()
    {
        if (_path == null) return;
        _w.Player.Travel(_path.Steps.Select(step => WorldScreen.TileCenter(step.X, step.Y)));
        Close();
    }

    private partial class MapCanvas : Control
    {
        private readonly MapPanel _panel;
        private ImageTexture? _tex;
        private Vector2I? _hover;

        public MapCanvas(MapPanel panel)
        {
            _panel = panel;
            MouseFilter = MouseFilterEnum.Stop;
            TextureFilter = TextureFilterEnum.Nearest;
        }

        private float CellPx => Mathf.Min(Size.X / E.Map.Width, Size.Y / E.Map.Height);
        private Vector2 Origin => (Size - new Vector2(E.Map.Width, E.Map.Height) * CellPx) / 2;

        private Vector2I CellAt(Vector2 local) => new((int)Mathf.Floor((local.X - Origin.X) / CellPx), (int)Mathf.Floor((local.Y - Origin.Y) / CellPx));

        public override void _GuiInput(InputEvent e)
        {
            if (e is InputEventMouseMotion mm)
            {
                _hover = CellAt(mm.Position);
                QueueRedraw();
            }
            else if (e is InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Left } mb)
            {
                AcceptEvent();
                _panel.Pick(CellAt(mb.Position));
            }
        }

        public override void _Draw()
        {
            var e = Game.Instance.Engine;
            if (e == null) return;
            var map = e.Map;
            _tex ??= ImageTexture.CreateFromImage(MapImage.Build(e, _panel._w.FogMask));
            var s = CellPx;
            var o = Origin;
            Vector2 At(float x, float y) => o + new Vector2(x, y) * s;
            DrawTextureRect(_tex, new Rect2(o, new Vector2(map.Width, map.Height) * s), false);
            DrawRect(new Rect2(o, new Vector2(map.Width, map.Height) * s), Ink.InkColor, false, 2);

            // Zone borders.
            var border = new Color(Ink.InkColor, 0.3f);
            for (var y = 0; y < map.Height; y++)
            {
                for (var x = 0; x < map.Width; x++)
                {
                    var z = map.ZoneAt(x, y);
                    if (z == null || !_panel._w.Explored(x, y)) continue;
                    if (x + 1 < map.Width && map.ZoneAt(x + 1, y) is { } zr && zr != z) DrawLine(At(x + 1, y), At(x + 1, y + 1), border, 1.5f);
                    if (y + 1 < map.Height && map.ZoneAt(x, y + 1) is { } zb && zb != z) DrawLine(At(x, y + 1), At(x + 1, y + 1), border, 1.5f);
                }
            }

            // The planned way.
            if (_panel.Path is { Steps.Count: > 0 } path)
            {
                var prev = At(e.Player.X + 0.5f, e.Player.Y + 0.5f);
                var budget = e.Player.Footwork;
                var spent = 0;
                foreach (var step in path.Steps)
                {
                    spent += map.StepCost(step.X, step.Y, e.Player);
                    var next = At(step.X + 0.5f, step.Y + 0.5f);
                    DrawLine(prev, next, spent <= budget ? Ink.JadeDeep : Ink.GoldDeep, 3, true);
                    prev = next;
                }
                DrawCircle(prev, 5, Ink.Cinnabar);
                DrawString(Ink.UiFont, prev + new Vector2(8, -8), $"足 {path.Cost}", HorizontalAlignment.Left, -1, 14, Ink.InkColor);
            }

            foreach (var poi in map.Def.Pois)
            {
                if (!_panel._w.Explored(poi.X, poi.Y)) continue;
                var p = At(poi.X + 0.5f, poi.Y + 0.5f);
                if (poi.Kind == "herb")
                {
                    DrawCircle(p, 4, Ink.JadeDeep);
                    continue;
                }
                var r = new Rect2(p - new Vector2(10, 10), new Vector2(20, 20));
                DrawRect(r, MapImage.PoiColor(poi.Kind));
                var gs = Ink.Han.GetStringSize(poi.Glyph, HorizontalAlignment.Left, -1, 13);
                DrawString(Ink.Han, p + new Vector2(-gs.X / 2, 5), poi.Glyph, HorizontalAlignment.Left, -1, 13, Ink.Card);
                var name = Game.Instance.T(poi.Name, poi.NameEn);
                var ns = Ink.Serif.GetStringSize(name, HorizontalAlignment.Left, -1, 13);
                var label = new Rect2(p + new Vector2(-ns.X / 2 - 4, 12), new Vector2(ns.X + 8, 17));
                DrawRect(label, new Color(Ink.Card, 0.9f));
                DrawString(Ink.Serif, label.Position + new Vector2(4, 13), name, HorizontalAlignment.Left, -1, 13, Ink.InkColor);
            }

            var me = At(_panel._w.PlayerBody.Pos.X / WorldScreen.Cell, _panel._w.PlayerBody.Pos.Y / WorldScreen.Cell);
            DrawRect(new Rect2(me - new Vector2(8, 8), new Vector2(16, 16)), Ink.Cinnabar);
            var mg = Ink.Han.GetStringSize("吾", HorizontalAlignment.Left, -1, 11);
            DrawString(Ink.Han, me + new Vector2(-mg.X / 2, 4), "吾", HorizontalAlignment.Left, -1, 11, Ink.Card);

            if (_hover is { } h && map.InBounds(h.X, h.Y))
            {
                DrawRect(new Rect2(At(h.X, h.Y), new Vector2(s, s)), new Color(Ink.InkColor, 0.6f), false, 1.5f);
                if (_panel._w.Explored(h.X, h.Y))
                {
                    var text = Text.Terrain(map.At(h.X, h.Y));
                    if (e.ZoneAt(h.X, h.Y) is { } zone) text += " · " + Text.Zone(zone);
                    var cost = map.StepCost(h.X, h.Y, e.Player);
                    text += cost < 0 ? Game.Instance.T(" · không thể đi", " · impassable") : $" · {cost} 足";
                    var ts = Ink.UiFont.GetStringSize(text, HorizontalAlignment.Left, -1, 13);
                    var at = At(h.X + 1, h.Y) + new Vector2(6, 0);
                    if (at.X + ts.X + 12 > Size.X) at.X = At(h.X, h.Y).X - ts.X - 18;
                    DrawRect(new Rect2(at, new Vector2(ts.X + 12, 20)), new Color(Ink.Card, 0.95f));
                    DrawString(Ink.UiFont, at + new Vector2(6, 15), text, HorizontalAlignment.Left, -1, 13, Ink.InkColor);
                }
            }
        }
    }
}
