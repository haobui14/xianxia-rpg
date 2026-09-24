using System;
using Godot;

namespace TuTienLuc.Field;

/// <summary>
/// A piece of scenery. Static ones draw once (Godot caches the commands); animated ones (a cave's
/// glow, crystals, a spring) redraw only while on screen.
/// </summary>
public partial class Prop : Node2D
{
    private readonly Action<CanvasItem, float> _art;
    private readonly FieldScreen? _field;
    private readonly bool _animated;
    private float _time;

    public Prop(Vector2 pos, Action<CanvasItem, float> art, bool animated = false, FieldScreen? field = null, Material? material = null)
    {
        Position = pos;
        _art = art;
        _animated = animated;
        _field = field;
        if (material != null) Material = material;
    }

    public override void _Ready() => SetProcess(_animated);

    public override void _Process(double delta)
    {
        _time += (float)delta;
        if (_field == null || _field.OnScreen(Position, 260)) QueueRedraw();
    }

    public override void _Draw() => _art(this, _time);

    public void Redraw() => QueueRedraw();
}
