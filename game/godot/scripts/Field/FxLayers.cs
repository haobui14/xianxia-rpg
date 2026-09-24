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
        using var ink = Brush.On(this);
        if (_f.Battle is { } battle)
        {
            foreach (var g in battle.Fires) FxArt.GroundFire(ink, g);
            foreach (var t in battle.Telegraphs) FxArt.Telegraph(ink, t);
        }
        if (_f.Target is { } target)
        {
            var at = target.At();
            var pulse = 0.5f + 0.5f * Mathf.Sin((float)Time.GetTicksMsec() / 250f);
            ink.DrawArc(at, 26 + pulse * 3, 0, Mathf.Tau, 36, new Color(0.63f, 0.48f, 0.18f, 0.55f), 2, true);
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
        using var ink = Brush.On(this);
        if (_f.Battle is { } battle)
        {
            foreach (var p in battle.Projectiles) FxArt.Projectile(ink, p);
            foreach (var o in battle.Orbits) FxArt.Orbit(ink, o);
        }
        foreach (var s in _f.Fx.Swooshes) FxArt.Swoosh(ink, s);
        foreach (var p in _f.Fx.Particles) FxArt.Particle(ink, p);
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
        using var ink = Brush.On(this);
        var player = _f.PlayerBody.Pos;
        var mouse = GetGlobalMousePosition();
        foreach (var actor in _f.Actors)
        {
            var b = actor.Body;
            if (b.IsPlayer || b.Gone || !actor.Visible || !_f.OnScreen(b.Pos, 40)) continue;
            var top = b.Pos + new Vector2(0, -(Figures.HeightOf(b.Kind) * b.Scale) - 12);
            if (b.InBattle && b.Active)
            {
                Bar(ink, top, b);
                continue;
            }
            if (b.NpcId == null || !b.Alive) continue;
            var near = b.Pos.DistanceTo(player) < 230 || b.Pos.DistanceTo(mouse) < 40;
            if (!near) continue;
            Paint.Label(ink, b.Name, top + new Vector2(0, -2), 15, b.Hostile ? new Color("#9b2a26") : new Color("#1c2230"));
        }

        if (_f.Target is { } target && _f.Battle == null)
        {
            var at = target.At() + new Vector2(0, -target.Height - 18);
            // With touch controls a hand stands for the Interact button; with keys the key is named.
            var touch = Ui.TouchUi.Active;
            var text = touch ? target.Label() : $"[{Ui.KeyMap.Label("interact")}] " + target.Label();
            var font = Ui.Ink.UiFont;
            var size = font.GetStringSize(text, HorizontalAlignment.Left, -1, 15);
            var lead = touch ? 22f : 0f;
            var box = new Rect2(at - new Vector2((size.X + lead) / 2 + 10, 14), new Vector2(size.X + lead + 20, 26));
            ink.DrawRect(box, new Color(0.11f, 0.13f, 0.19f, 0.86f));
            ink.DrawRect(box, new Color(0.63f, 0.48f, 0.18f, 0.9f), false, 1.5f);
            if (touch) Icons.Draw(ink, IconKind.Hand, box.Position + new Vector2(19, 13), 17, new Color("#e0c070"));
            ink.DrawString(font, new Vector2(box.Position.X + 10 + lead, box.Position.Y + 18), text, HorizontalAlignment.Left, -1, 15, new Color("#f1e9d2"));
        }

        foreach (var f in _f.Fx.Floaters) FxArt.Floater(ink, f);

        if (_f.Battle != null && !_f.Player.Autopilot)
        {
            var aim = _f.Player.AimPoint;
            ink.DrawArc(aim, 9, 0, Mathf.Tau, 20, new Color(0.11f, 0.13f, 0.19f, 0.5f), 1.5f, true);
            ink.DrawLine(aim - new Vector2(15, 0), aim - new Vector2(5, 0), new Color(0.11f, 0.13f, 0.19f, 0.5f), 1.5f);
            ink.DrawLine(aim + new Vector2(15, 0), aim + new Vector2(5, 0), new Color(0.11f, 0.13f, 0.19f, 0.5f), 1.5f);
        }
    }

    private static void Bar(Brush ink, Vector2 top, Fighter b)
    {
        var w = Mathf.Max(44, b.Radius * 2.6f);
        var pos = top - new Vector2(w / 2, 0);
        ink.DrawRect(new Rect2(pos - new Vector2(1, 1), new Vector2(w + 2, 8)), new Color(0.11f, 0.13f, 0.19f, 0.6f));
        ink.DrawRect(new Rect2(pos, new Vector2(w, 6)), new Color("#d9c89c"));
        ink.DrawRect(new Rect2(pos, new Vector2(w * Mathf.Clamp(b.Hp / b.HpMax, 0, 1), 6)), new Color("#9b2a26"));
        if (b.Mark is { } mark && (b.MarkTime > 1.5f || Mathf.PosMod(b.MarkTime, 0.3f) > 0.15f))
        {
            var mp = pos + new Vector2(w + 12, 3);
            ink.DrawCircle(mp, 10, new Color("#f7eed5"));
            ink.DrawArc(mp, 10, 0, Mathf.Tau, 20, Ui.Ink.Element(mark), 2, true);
            Icons.Draw(ink, Icons.ForElement(mark), mp, 13, Ui.Ink.Element(mark));
        }
        var marks = new (bool on, IconKind icon, Color color)[]
        {
            (b.Stun > 0, IconKind.Stun, new Color("#7a5b1c")), (b.Rooted > 0, IconKind.Chain, new Color("#3a6280")), (b.Slow > 0, IconKind.Slow, new Color("#3a6280")),
            (b.BleedTime > 0, IconKind.Blood, new Color("#751c18")), (b.BurnTime > 0, IconKind.Fire, new Color("#9b2a26")), (b.DefBreak > 0, IconKind.ArmorBreak, new Color("#8a6a3a")),
            (b.ResBreak > 0, IconKind.Crack, new Color("#a07a2e")), (b.Blind > 0, IconKind.Blind, new Color("#3f4757")),
        };
        var shown = marks.Where(m => m.on).ToList();
        for (var i = 0; i < shown.Count; i++)
        {
            var at = top + new Vector2((i - (shown.Count - 1) / 2f) * 19, -12);
            ink.DrawCircle(at, 9, new Color(0.97f, 0.94f, 0.85f, 0.85f));
            Icons.Draw(ink, shown[i].icon, at, 13, shown[i].color);
        }
        if (b.Enraged) Paint.Label(ink, T("Cuồng nộ", "Enraged"), top + new Vector2(0, -28), 13, new Color("#9b2a26"), Ui.Ink.UiFont, 3);
    }
}
