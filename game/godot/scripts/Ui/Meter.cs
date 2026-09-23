using System;
using Godot;

namespace TuTienLuc.Ui;

/// <summary>A caption, a value and a thin bar — the design system's stat bar, updatable in place.</summary>
public partial class Meter : VBoxContainer
{
    private readonly Label _caption;
    private readonly Label _value;
    private readonly ProgressBar _bar;
    private readonly StyleBoxFlat _fill;

    public Meter(string caption, Color fill, float width = 220)
    {
        AddThemeConstantOverride("separation", 1);
        MouseFilter = MouseFilterEnum.Ignore;
        var top = new HBoxContainer { MouseFilter = MouseFilterEnum.Ignore };
        _caption = UiKit.Caption(caption);
        top.AddChild(_caption);
        top.AddChild(UiKit.Spacer(0, expand: true));
        _value = UiKit.Label("", 13, Ink.InkSoft);
        _value.AddThemeFontOverride("font", Ink.UiFont);
        top.AddChild(_value);
        AddChild(top);

        _fill = Ink.Box(fill, fill, 0, 2, 0);
        _bar = new ProgressBar
        {
            MinValue = 0,
            MaxValue = 1,
            ShowPercentage = false,
            CustomMinimumSize = new Vector2(width, 7),
            MouseFilter = MouseFilterEnum.Ignore,
        };
        _bar.AddThemeStyleboxOverride("fill", _fill);
        AddChild(_bar);
    }

    public string Caption
    {
        set => _caption.Text = value.ToUpperInvariant();
    }

    public void SetFill(Color color)
    {
        _fill.BgColor = color;
        _fill.BorderColor = color;
    }

    public void Set(double value, double max, string? text = null)
    {
        _bar.MaxValue = Math.Max(1, max);
        _bar.Value = Math.Max(0, Math.Min(value, _bar.MaxValue));
        _value.Text = text ?? $"{Math.Round(value)}/{Math.Round(max)}";
    }
}
