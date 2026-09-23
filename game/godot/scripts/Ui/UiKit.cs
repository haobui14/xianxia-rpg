using System;
using Godot;

namespace TuTienLuc.Ui;

/// <summary>Small builders so every panel looks the same without a .tscn per widget.</summary>
public static class UiKit
{
    private static Game G => Game.Instance;

    public static Label Label(string text, int size = 17, Color? color = null, bool wrap = false)
    {
        var l = new Label { Text = text };
        l.AddThemeFontSizeOverride("font_size", size);
        if (color != null) l.AddThemeColorOverride("font_color", color.Value);
        if (wrap)
        {
            l.AutowrapMode = TextServer.AutowrapMode.WordSmart;
            l.CustomMinimumSize = new Vector2(80, 0);
        }
        return l;
    }

    /// <summary>A label in the UI sans font: uppercase caption style for small headings.</summary>
    public static Label Caption(string text, Color? color = null)
    {
        var l = Label(text.ToUpperInvariant(), 12, color ?? Ink.InkMute);
        l.AddThemeFontOverride("font", Ink.UiFont);
        return l;
    }

    public static Label Han(string glyph, int size, Color color)
    {
        var l = Label(glyph, size, color);
        l.AddThemeFontOverride("font", Ink.Han);
        return l;
    }

    public static RichTextLabel Rich(string bbcode, int size = 16)
    {
        var r = new RichTextLabel
        {
            BbcodeEnabled = true,
            FitContent = true,
            ScrollActive = false,
            Text = bbcode,
            CustomMinimumSize = new Vector2(120, 0),
            SizeFlagsHorizontal = Control.SizeFlags.ExpandFill,
        };
        r.AddThemeFontSizeOverride("normal_font_size", size);
        r.AddThemeFontSizeOverride("bold_font_size", size);
        r.AddThemeFontSizeOverride("italics_font_size", size);
        r.AddThemeColorOverride("default_color", Ink.InkColor);
        return r;
    }

    public static Button Button(string text, Action onPressed, bool primary = false, bool enabled = true, string? tooltip = null)
    {
        var b = new Button { Text = text, Disabled = !enabled, TooltipText = tooltip ?? "", FocusMode = Control.FocusModeEnum.None };
        if (primary)
        {
            b.AddThemeStyleboxOverride("normal", Ink.Box(Ink.InkColor, Ink.InkColor, 1, 2, 8));
            b.AddThemeStyleboxOverride("hover", Ink.Box(Ink.InkSoft, Ink.InkColor, 1, 2, 8));
            b.AddThemeColorOverride("font_color", Ink.Paper);
            b.AddThemeColorOverride("font_hover_color", Ink.Paper);
        }
        b.Pressed += onPressed;
        return b;
    }

    public static Button Danger(string text, Action onPressed, bool enabled = true)
    {
        var b = Button(text, onPressed, enabled: enabled);
        b.AddThemeStyleboxOverride("normal", Ink.Box(Ink.CardDeep, Ink.Cinnabar, 1, 2, 8));
        b.AddThemeColorOverride("font_color", Ink.CinnabarDeep);
        return b;
    }

    public static HBoxContainer Row(params Control[] children)
    {
        var h = new HBoxContainer();
        foreach (var c in children) h.AddChild(c);
        return h;
    }

    public static VBoxContainer Column(int separation = 8, params Control[] children)
    {
        var v = new VBoxContainer();
        v.AddThemeConstantOverride("separation", separation);
        foreach (var c in children) v.AddChild(c);
        return v;
    }

    public static Control Spacer(float height = 0, bool expand = false)
    {
        var c = new Control { CustomMinimumSize = new Vector2(0, height) };
        if (expand) c.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        return c;
    }

    public static HSeparator Rule()
    {
        var s = new HSeparator();
        s.AddThemeStyleboxOverride("separator", new StyleBoxLine { Color = Ink.Line, Thickness = 1 });
        return s;
    }

    public static PanelContainer Card(Control content, int margin = 12, Color? bg = null, Color? border = null)
    {
        var p = new PanelContainer();
        p.AddThemeStyleboxOverride("panel", Ink.Box(bg ?? Ink.Card, border ?? Ink.Line, 1, 4, margin));
        p.AddChild(content);
        return p;
    }

    /// <summary>A labelled stat bar in the design system's Bar style (value/max above the track).</summary>
    public static VBoxContainer Bar(string label, float value, float max, Color fill, float width = 200)
    {
        var box = new VBoxContainer();
        box.AddThemeConstantOverride("separation", 2);
        var top = new HBoxContainer();
        top.AddChild(Caption(label));
        top.AddChild(Spacer(0, expand: true));
        var num = Label($"{Mathf.RoundToInt(value)}/{Mathf.RoundToInt(max)}", 13, Ink.InkSoft);
        num.AddThemeFontOverride("font", Ink.UiFont);
        top.AddChild(num);
        box.AddChild(top);
        var bar = new ProgressBar
        {
            MinValue = 0,
            MaxValue = Math.Max(1, max),
            Value = value,
            ShowPercentage = false,
            CustomMinimumSize = new Vector2(width, 8),
        };
        bar.AddThemeStyleboxOverride("fill", Ink.Box(fill, fill, 0, 2, 0));
        box.AddChild(bar);
        return box;
    }

    /// <summary>A square cinnabar seal with a Han glyph, like the web UI's &lt;Seal&gt;.</summary>
    public static PanelContainer Seal(string glyph, int size = 40, Color? color = null)
    {
        var c = color ?? Ink.Cinnabar;
        var p = new PanelContainer { CustomMinimumSize = new Vector2(size, size) };
        p.AddThemeStyleboxOverride("panel", Ink.Box(c, c.Darkened(0.2f), 2, 3, 0));
        var l = Han(glyph, (int)(size * 0.58f), Ink.Card);
        l.HorizontalAlignment = HorizontalAlignment.Center;
        l.VerticalAlignment = VerticalAlignment.Center;
        p.AddChild(l);
        return p;
    }

    public static string T(string vi, string en) => G.T(vi, en);

    public static void Clear(Node node)
    {
        foreach (var child in node.GetChildren())
        {
            node.RemoveChild(child);
            child.QueueFree();
        }
    }
}
