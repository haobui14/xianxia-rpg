using System;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTienLuc.Art;

namespace TuTienLuc.Field;

/// <summary>Something the player can act on with E: a door, a person, a herb, a portal.</summary>
public sealed class Interaction
{
    public Func<Vector2> At = () => Vector2.Zero;
    public float Reach = 72;
    public float Height = 70;
    public Func<string> Label = () => "";
    public Action Act = () => { };
    public Func<bool>? Visible;

    public bool IsVisible => Visible?.Invoke() ?? true;
}

/// <summary>Warnings painted on the ground, under everyone's feet.</summary>
public partial class GroundFxLayer : Node2D
{
    private readonly FieldScreen _f;

    public GroundFxLayer(FieldScreen f)
    {
        _f = f;
        ZIndex = -5;
    }

    public override void _Process(double delta) => QueueRedraw();

    public override void _Draw()
    {
        if (_f.Battle is { } battle)
            foreach (var t in battle.Telegraphs) FxArt.Telegraph(this, t);
        if (_f.Target is { } target)
        {
            var at = target.At();
            var pulse = 0.5f + 0.5f * Mathf.Sin((float)Time.GetTicksMsec() / 250f);
            DrawArc(at, 26 + pulse * 3, 0, Mathf.Tau, 36, new Color(0.63f, 0.48f, 0.18f, 0.55f), 2, true);
        }
    }
}

/// <summary>Projectiles, slashes and particles, above the scenery.</summary>
public partial class AirFxLayer : Node2D
{
    private readonly FieldScreen _f;

    public AirFxLayer(FieldScreen f)
    {
        _f = f;
        ZIndex = 10;
    }

    public override void _Process(double delta) => QueueRedraw();

    public override void _Draw()
    {
        if (_f.Battle is { } battle)
            foreach (var p in battle.Projectiles) FxArt.Projectile(this, p);
        foreach (var s in _f.Fx.Swooshes) FxArt.Swoosh(this, s);
        foreach (var p in _f.Fx.Particles) FxArt.Particle(this, p);
    }
}

/// <summary>
/// Readable things drawn above everything in the world: names, health bars, element marks, the
/// interaction prompt, damage numbers, the aiming reticle.
/// </summary>
public partial class OverlayLayer : Node2D
{
    private readonly FieldScreen _f;

    public OverlayLayer(FieldScreen f)
    {
        _f = f;
        ZIndex = 40;
    }

    public override void _Process(double delta) => QueueRedraw();

    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    public override void _Draw()
    {
        var player = _f.PlayerBody.Pos;
        var mouse = GetGlobalMousePosition();
        foreach (var actor in _f.Actors)
        {
            var b = actor.Body;
            if (b.IsPlayer || b.Gone || !actor.Visible || !_f.OnScreen(b.Pos, 40)) continue;
            var top = b.Pos + new Vector2(0, -(Figures.HeightOf(b.Kind) * b.Scale) - 12);
            if (b.InBattle && b.Active)
            {
                Bar(top, b);
                continue;
            }
            if (b.NpcId == null || !b.Alive) continue;
            var near = b.Pos.DistanceTo(player) < 230 || b.Pos.DistanceTo(mouse) < 40;
            if (!near) continue;
            Paint.Label(this, b.Name, top + new Vector2(0, -2), 15, b.Hostile ? new Color("#9b2a26") : new Color("#1c2230"));
        }

        if (_f.Target is { } target && _f.Battle == null)
        {
            var at = target.At() + new Vector2(0, -target.Height - 18);
            var text = "[E] " + target.Label();
            var font = Ui.Ink.UiFont;
            var size = font.GetStringSize(text, HorizontalAlignment.Left, -1, 15);
            var box = new Rect2(at - new Vector2(size.X / 2 + 10, 14), new Vector2(size.X + 20, 26));
            DrawRect(box, new Color(0.11f, 0.13f, 0.19f, 0.86f));
            DrawRect(box, new Color(0.63f, 0.48f, 0.18f, 0.9f), false, 1.5f);
            DrawString(font, new Vector2(box.Position.X + 10, box.Position.Y + 18), text, HorizontalAlignment.Left, -1, 15, new Color("#f1e9d2"));
        }

        foreach (var f in _f.Fx.Floaters) FxArt.Floater(this, f);

        if (_f.Battle != null && !_f.Player.Autopilot)
        {
            var aim = _f.Player.AimPoint;
            DrawArc(aim, 9, 0, Mathf.Tau, 20, new Color(0.11f, 0.13f, 0.19f, 0.5f), 1.5f, true);
            DrawLine(aim - new Vector2(15, 0), aim - new Vector2(5, 0), new Color(0.11f, 0.13f, 0.19f, 0.5f), 1.5f);
            DrawLine(aim + new Vector2(15, 0), aim + new Vector2(5, 0), new Color(0.11f, 0.13f, 0.19f, 0.5f), 1.5f);
        }
    }

    private void Bar(Vector2 top, Fighter b)
    {
        var w = Mathf.Max(44, b.Radius * 2.6f);
        var pos = top - new Vector2(w / 2, 0);
        DrawRect(new Rect2(pos - new Vector2(1, 1), new Vector2(w + 2, 8)), new Color(0.11f, 0.13f, 0.19f, 0.6f));
        DrawRect(new Rect2(pos, new Vector2(w, 6)), new Color("#d9c89c"));
        DrawRect(new Rect2(pos, new Vector2(w * Mathf.Clamp(b.Hp / b.HpMax, 0, 1), 6)), new Color("#9b2a26"));
        if (b.Mark is { } mark && (b.MarkTime > 1.5f || Mathf.PosMod(b.MarkTime, 0.3f) > 0.15f))
        {
            var mp = pos + new Vector2(w + 12, 3);
            DrawCircle(mp, 10, new Color("#f7eed5"));
            DrawArc(mp, 10, 0, Mathf.Tau, 20, Ui.Ink.Element(mark), 2, true);
            Paint.Glyph(this, FieldMath.Han[mark], mp, 13, Ui.Ink.Element(mark));
        }
        var icons = new (bool on, string glyph, Color color)[]
        {
            (b.Stun > 0, "暈", new Color("#7a5b1c")), (b.Rooted > 0, "縛", new Color("#3a6280")), (b.Slow > 0, "緩", new Color("#3a6280")),
            (b.BleedTime > 0, "血", new Color("#751c18")), (b.BurnTime > 0, "焚", new Color("#9b2a26")), (b.DefBreak > 0, "破", new Color("#8a6a3a")),
            (b.ResBreak > 0, "融", new Color("#a07a2e")), (b.Blind > 0, "盲", new Color("#3f4757")),
        };
        var shown = icons.Where(i => i.on).ToList();
        for (var i = 0; i < shown.Count; i++)
            Paint.Label(this, shown[i].glyph, top + new Vector2((i - (shown.Count - 1) / 2f) * 17, -12), 14, shown[i].color, Ui.Ink.Han, 3);
        if (b.Enraged) Paint.Label(this, T("Cuồng nộ", "Enraged"), top + new Vector2(0, -28), 13, new Color("#9b2a26"), Ui.Ink.UiFont, 3);
    }
}
