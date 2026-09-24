using System;
using Godot;
using TuTienLuc.Art;

namespace TuTienLuc.Field;

/// <summary>
/// A piece of scenery. Static ones draw once (Godot caches the commands); animated ones (a cave's
/// glow, crystals, a spring) redraw only while on screen. Each paints through a <see cref="Brush"/>, so
/// a whole tree is one batch on the GPU.
/// </summary>
public partial class Prop : Node2D
{
    private readonly Action<Brush, float> _art;
    private readonly FieldScreen? _field;
    private readonly bool _animated;
    private float _time;

    public Prop(Vector2 pos, Action<Brush, float> art, bool animated = false, FieldScreen? field = null, Material? material = null)
    {
        Position = pos;
        _art = art;
        _animated = animated;
        _field = field;
        // On a field the field paints what is near the camera; elsewhere (the title) it is always painted.
        Painted = field == null;
        if (material != null) Material = material;
    }

    /// <summary>Whether the prop is drawn at all (a field lets far scenery go: see <see cref="FieldScreen"/>).</summary>
    public bool Painted { get; private set; }

    public void SetPainted(bool painted)
    {
        if (Painted == painted) return;
        Painted = painted;
        QueueRedraw();
    }

    public override void _Ready() => SetProcess(_animated);

    // Signboards carry words: every prop repaints in the new language (painted ones at once, the rest when painted).
    public override void _EnterTree() => Game.Instance.LocaleChanged += Redraw;

    public override void _ExitTree() => Game.Instance.LocaleChanged -= Redraw;

    public override void _Process(double delta)
    {
        _time += (float)delta;
        if (Painted && (_field == null || _field.OnScreen(Position, 260))) QueueRedraw();
    }

    public override void _Draw()
    {
        if (!Painted) return;
        using var brush = Brush.On(this);
        _art(brush, _time);
    }

    public void Redraw() => QueueRedraw();
}
