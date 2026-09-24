using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.World;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.Field;

/// <summary>The region as a small painted map: one pixel per tile, clouds where you haven't been.</summary>
public static class MapImage
{
    private static readonly Dictionary<Terrain, Color> Colors = new()
    {
        [Terrain.Plains] = new Color("#b8c48e"),
        [Terrain.Road] = new Color("#d9c9a0"),
        [Terrain.Forest] = new Color("#7f9e6a"),
        [Terrain.DenseForest] = new Color("#5c7d57"),
        [Terrain.Hills] = new Color("#b3b07e"),
        [Terrain.Mountain] = new Color("#9d968a"),
        [Terrain.Peak] = new Color("#dcdcd6"),
        [Terrain.Water] = new Color("#7fa6b4"),
        [Terrain.Bridge] = new Color("#a07a52"),
        [Terrain.Swamp] = new Color("#7d8a64"),
        [Terrain.Town] = new Color("#d6b98a"),
        [Terrain.Sect] = new Color("#cfc8b8"),
    };

    public static Image Build(GameEngine e, FogMask fog)
    {
        var map = e.Map;
        var img = Image.CreateEmpty(map.Width, map.Height, false, Image.Format.Rgba8);
        for (var y = 0; y < map.Height; y++)
        {
            for (var x = 0; x < map.Width; x++)
            {
                var c = fog.Get(x, y) ? Colors[map.At(x, y)] : new Color("#e8e2d2");
                img.SetPixel(x, y, c);
            }
        }
        return img;
    }

    public static Color PoiColor(string kind) => kind switch
    {
        "town" => Ink.InkColor,
        "sect" => Ink.Cinnabar,
        "secret_realm" => Ink.Violet,
        "spirit_vein" => Ink.Jade,
        "herb" => Ink.JadeDeep,
        _ => Ink.GoldDeep,
    };
}

/// <summary>The HUD's corner map. Click it for the full travel map (M).</summary>
public partial class Minimap : Control
{
    private readonly WorldScreen _w;
    private ImageTexture? _tex;

    public Minimap(WorldScreen world)
    {
        _w = world;
        MouseFilter = MouseFilterEnum.Stop;
        TextureFilter = TextureFilterEnum.Nearest;
        TooltipText = Game.Instance.T("Bản đồ [M]", "Map [M]");
    }

    public void Refresh()
    {
        if (Game.Instance.Engine == null || _w.FogMask == null) return;
        var img = MapImage.Build(Game.Instance.Engine, _w.FogMask);
        if (_tex == null) _tex = ImageTexture.CreateFromImage(img);
        else _tex.Update(img);
    }

    public override void _Process(double delta) => QueueRedraw();

    public override void _GuiInput(InputEvent e)
    {
        if (e is InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Left } && _w.Battle == null && !_w.Frozen)
        {
            AcceptEvent();
            _w.OpenPanel(new MapPanel(_w));
        }
    }

    public override void _Draw()
    {
        var e = Game.Instance.Engine;
        if (e == null) return;
        if (_tex == null) Refresh();
        var map = e.Map;
        var size = Size;
        DrawRect(new Rect2(Vector2.Zero, size), new Color(Ink.Card, 0.92f));
        var scale = Mathf.Min((size.X - 12) / map.Width, (size.Y - 12) / map.Height);
        var mapSize = new Vector2(map.Width, map.Height) * scale;
        var origin = (size - mapSize) / 2;
        if (_tex != null) DrawTextureRect(_tex, new Rect2(origin, mapSize), false);
        DrawRect(new Rect2(origin, mapSize), new Color(Ink.InkColor, 0.7f), false, 1.5f);

        Vector2 At(float x, float y) => origin + new Vector2(x, y) * scale;
        foreach (var poi in map.Def.Pois)
        {
            if (!_w.Explored(poi.X, poi.Y) || poi.Kind == "herb") continue;
            var p = At(poi.X + 0.5f, poi.Y + 0.5f);
            DrawRect(new Rect2(p - new Vector2(3, 3), new Vector2(6, 6)), MapImage.PoiColor(poi.Kind));
        }
        foreach (var adv in e.State.World.Adventures)
        {
            if (!_w.Explored(adv.X, adv.Y) || !e.Senses(adv.X, adv.Y) || (adv.Hidden && !e.Player.SensePulse && e.Player.Attrs.Per < 12)) continue;
            DrawCircle(At(adv.X + 0.5f, adv.Y + 0.5f), 2.6f, Ink.Gold);
        }
        foreach (var pack in e.State.World.Beasts.Where(b => e.Senses(b.X, b.Y)))
            DrawCircle(At(pack.X + 0.5f, pack.Y + 0.5f), 2.2f, pack.Aggressive ? Ink.Cinnabar : Ink.CinnabarSoft);

        // What the camera sees, then you.
        var view = _w.View;
        var cell = WorldScreen.Cell;
        DrawRect(new Rect2(At(view.Position.X / cell, view.Position.Y / cell), view.Size / cell * scale), new Color(Ink.InkColor, 0.35f), false, 1);
        var me = At(_w.PlayerBody.Pos.X / cell, _w.PlayerBody.Pos.Y / cell);
        DrawCircle(me, 4, Ink.Cinnabar);
        DrawArc(me, 4, 0, Mathf.Tau, 12, Ink.Card, 1.2f, true);
        DrawLine(me, me + _w.PlayerBody.Facing * 8, Ink.Cinnabar, 1.5f, true);
        var r = e.SenseRadius * scale;
        DrawArc(me, r, 0, Mathf.Tau, 32, new Color(Ink.Jade, e.Player.SensePulse ? 0.7f : 0.35f), 1, true);
    }
}
