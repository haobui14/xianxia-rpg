using Godot;
using TuTien.Core;

namespace TuTienLuc.Ui;

/// <summary>
/// The ink-wash & jade design system (design/README.md tokens) as Godot colors, fonts and a Theme.
/// </summary>
public static class Ink
{
    public static readonly Color Paper = new("#efe5cd");
    public static readonly Color PaperDeep = new("#e2d2ab");
    public static readonly Color PaperDarker = new("#d9c89c");
    public static readonly Color Card = new("#f7eed5");
    public static readonly Color CardDeep = new("#ebdfb9");
    public static readonly Color InkColor = new("#1c2230");
    public static readonly Color InkSoft = new("#3f4757");
    public static readonly Color InkMute = new("#6f6856");
    public static readonly Color InkFaint = new("#9b917a");
    public static readonly Color Line = new("#c8bb96");
    public static readonly Color LineStrong = new("#a3946a");
    public static readonly Color Jade = new("#4e7f6c");
    public static readonly Color JadeDeep = new("#2e5246");
    public static readonly Color JadeSoft = new("#88ad9b");
    public static readonly Color Cinnabar = new("#9b2a26");
    public static readonly Color CinnabarDeep = new("#751c18");
    public static readonly Color CinnabarSoft = new("#c25f5b");
    public static readonly Color Gold = new("#a07a2e");
    public static readonly Color GoldDeep = new("#7a5b1c");
    public static readonly Color WaterBlue = new("#3a6280");
    public static readonly Color Violet = new("#6b4a7c");
    public static readonly Color Ochre = new("#8a6a3a");

    public static Color Element(Element e) => e switch
    {
        TuTien.Core.Element.Kim => Gold,
        TuTien.Core.Element.Moc => Jade,
        TuTien.Core.Element.Thuy => WaterBlue,
        TuTien.Core.Element.Hoa => Cinnabar,
        _ => Ochre,
    };

    public static Color Rarity(string rarity) => rarity switch
    {
        "Uncommon" => Jade,
        "Rare" => WaterBlue,
        "Epic" => Violet,
        "Legendary" => Cinnabar,
        _ => InkMute,
    };

    public static Color Realm(Realm r) => r switch
    {
        TuTien.Core.Realm.LuyenKhi => Jade,
        TuTien.Core.Realm.TrucCo => WaterBlue,
        TuTien.Core.Realm.KetDan => Violet,
        TuTien.Core.Realm.NguyenAnh => Gold,
        _ => InkMute,
    };

    public static Color Danger(int level) => level switch
    {
        <= 1 => Jade,
        2 => Gold,
        3 => Ochre,
        4 => CinnabarSoft,
        _ => Cinnabar,
    };

    // ------------------------------------------------------------------ fonts

    private static Font? _serif;
    private static Font? _han;
    private static Font? _ui;

    /// <summary>Body/display serif with Vietnamese coverage; system fallback fills anything missing.</summary>
    public static Font Serif => _serif ??= new SystemFont
    {
        FontNames = new[] { "Cormorant Garamond", "Spectral", "Noto Serif", "Cambria", "Georgia", "DejaVu Serif", "serif" },
        AllowSystemFallback = true,
        Antialiasing = TextServer.FontAntialiasing.Gray,
    };

    /// <summary>Han glyphs (seals, POI markers, watermarks).</summary>
    public static Font Han => _han ??= new SystemFont
    {
        FontNames = new[] { "Noto Serif CJK SC", "Noto Serif SC", "Source Han Serif SC", "SimSun", "Songti SC", "Microsoft YaHei", "serif" },
        AllowSystemFallback = true,
    };

    public static Font UiFont => _ui ??= new SystemFont
    {
        FontNames = new[] { "Inter", "Segoe UI", "Noto Sans", "DejaVu Sans", "sans-serif" },
        AllowSystemFallback = true,
    };

    // ------------------------------------------------------------------ theme

    public static StyleBoxFlat Box(Color bg, Color border, int borderWidth = 1, int radius = 4, int margin = 12)
    {
        var sb = new StyleBoxFlat
        {
            BgColor = bg,
            BorderColor = border,
            CornerDetail = 4,
        };
        sb.SetBorderWidthAll(borderWidth);
        sb.SetCornerRadiusAll(radius);
        sb.SetContentMarginAll(margin);
        return sb;
    }

    public static Theme BuildTheme()
    {
        var t = new Theme { DefaultFont = Serif, DefaultFontSize = 17 };

        t.SetColor("font_color", "Label", InkColor);
        t.SetColor("default_color", "RichTextLabel", InkColor);
        t.SetStylebox("panel", "PanelContainer", Box(Card, LineStrong, 1, 4, 14));
        t.SetStylebox("panel", "Panel", Box(Card, LineStrong, 1, 4, 0));

        t.SetStylebox("normal", "Button", Box(CardDeep, LineStrong, 1, 2, 8));
        t.SetStylebox("hover", "Button", Box(PaperDeep, InkColor, 1, 2, 8));
        t.SetStylebox("pressed", "Button", Box(InkColor, InkColor, 1, 2, 8));
        t.SetStylebox("disabled", "Button", Box(Paper, Line, 1, 2, 8));
        t.SetStylebox("focus", "Button", Box(new Color(0, 0, 0, 0), Jade, 2, 2, 8));
        t.SetColor("font_color", "Button", InkColor);
        t.SetColor("font_hover_color", "Button", InkColor);
        t.SetColor("font_pressed_color", "Button", Paper);
        t.SetColor("font_disabled_color", "Button", InkFaint);
        t.SetFont("font", "Button", UiFont);
        t.SetFontSize("font_size", "Button", 15);

        t.SetStylebox("normal", "LineEdit", Box(Paper, LineStrong, 1, 2, 8));
        t.SetStylebox("focus", "LineEdit", Box(Paper, Jade, 2, 2, 8));
        t.SetColor("font_color", "LineEdit", InkColor);
        t.SetColor("caret_color", "LineEdit", Cinnabar);

        t.SetStylebox("background", "ProgressBar", Box(PaperDarker, Line, 1, 2, 0));
        t.SetStylebox("fill", "ProgressBar", Box(Jade, Jade, 0, 2, 0));

        t.SetStylebox("panel", "TooltipPanel", Box(Card, InkColor, 1, 2, 8));
        t.SetColor("font_color", "TooltipLabel", InkColor);

        t.SetStylebox("slider", "HSlider", Box(PaperDarker, Line, 1, 2, 2));
        t.SetConstant("separation", "VBoxContainer", 8);
        t.SetConstant("separation", "HBoxContainer", 8);
        return t;
    }
}
