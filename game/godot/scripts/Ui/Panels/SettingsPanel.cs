using System;
using Godot;
using TuTien.Core;
using TuTienLuc.Audio;

namespace TuTienLuc.Ui.Panels;

/// <summary>Sound, display, keys and language. Changes apply at once and are saved to user://settings.json.</summary>
public partial class SettingsPanel : InkPanel
{
    protected override string Glyph => "設";
    protected override string TitleText => T("Cài đặt", "Settings");
    protected override Vector2 PanelSize => new(620, 640);

    protected override void Build()
    {
        var g = Game.Instance;
        Section(T("Âm thanh", "Sound"));
        Slider(T("Tổng", "Master"), g.MasterVolume, v => g.MasterVolume = v);
        Slider(T("Nhạc", "Music"), g.MusicVolume, v => g.MusicVolume = v);
        Slider(T("Hiệu ứng", "Effects"), g.SfxVolume, v =>
        {
            g.SfxVolume = v;
            SoundBoard.Play("click", 0, 1, 0, 90);
        });
        Para(T("Mọi âm thanh đều được tổng hợp ngay trong game: đàn tranh, sáo trúc, trống, chuông và cồng.",
            "Every sound is synthesized in the game itself: guzheng, bamboo flute, drums, bells and gong."), 13, Ink.InkMute);

        Section(T("Hiển thị", "Display"));
        if (!OS.HasFeature("mobile"))
            Toggle(T("Toàn màn hình", "Fullscreen"), g.Fullscreen, on =>
            {
                g.Fullscreen = on;
                g.ApplyDisplay();
            });
        Toggle(T("Rung màn hình khi trúng đòn", "Screen shake on hits"), g.ScreenShake, on => g.ScreenShake = on);
        var auto = Game.AutoUiScale();
        Para(T("Cỡ giao diện (chữ, bảng và nút)", "Interface size (text, panels and buttons)"), 16, Ink.InkColor);
        Buttons(
            Choice(T($"Tự động ({auto * 100:0}%)", $"Auto ({auto * 100:0}%)"), g.UiScale <= 0, () => SetScale(0)),
            Choice("100%", Mathf.IsEqualApprox(g.UiScale, 1f), () => SetScale(1f)),
            Choice("115%", Mathf.IsEqualApprox(g.UiScale, 1.15f), () => SetScale(1.15f)),
            Choice("130%", Mathf.IsEqualApprox(g.UiScale, 1.3f), () => SetScale(1.3f)),
            Choice("145%", Mathf.IsEqualApprox(g.UiScale, 1.45f), () => SetScale(1.45f)));

        Section(T("Điều khiển cảm ứng", "Touch controls"));
        Buttons(
            Choice(T("Tự động", "Auto"), g.Touch == TouchMode.Auto, () => SetTouch(TouchMode.Auto)),
            Choice(T("Bật", "On"), g.Touch == TouchMode.On, () => SetTouch(TouchMode.On)),
            Choice(T("Tắt", "Off"), g.Touch == TouchMode.Off, () => SetTouch(TouchMode.Off)));
        Para(T("Cần gạt bên trái, nút chiêu thức bên phải; chạm mặt đất để đi, chạm yêu thú để đánh. Tự động: bật trên điện thoại và máy tính bảng.",
            "A stick on the left, the arts on the right; tap the ground to walk, tap a beast to fight. Auto: on for phones and tablets."), 13, Ink.InkMute);

        Section(T("Phím", "Keys"));
        Row(UiKit.Label(KeyMap.IsDefault ? T("Bố cục mặc định", "The default layout") : T("Bố cục riêng của ngươi", "Your own layout"), 16, Ink.InkColor),
            UiKit.Button(T("Đổi phím…", "Rebind keys…"), OpenKeys));

        Section(T("Ngôn ngữ", "Language"));
        Buttons(
            UiKit.Button("Tiếng Việt", () => g.SetLocale(Locale.Vi), primary: g.Locale == Locale.Vi),
            UiKit.Button("English", () => g.SetLocale(Locale.En), primary: g.Locale == Locale.En));

        Body.AddChild(UiKit.Spacer(8));
        Buttons(UiKit.Button(T("Xong", "Done"), Close, primary: true));
    }

    public override void _UnhandledInput(InputEvent e)
    {
        // Hidden while the keys panel is open: Esc belongs to that one.
        if (Visible) base._UnhandledInput(e);
    }

    /// <summary>The keys panel opens in this one's place (over the world or the title alike) and hands back on close.</summary>
    private void OpenKeys()
    {
        var keys = new KeysPanel();
        Visible = false;
        keys.Closed += () =>
        {
            if (!IsInstanceValid(this)) return;
            Visible = true;
            RequestRefresh();
        };
        GetParent().AddChild(keys);
    }

    private static Button Choice(string label, bool chosen, Action pick) => UiKit.Button(label, () =>
    {
        pick();
        SoundBoard.Play("click", -6);
        Game.Instance.SaveSettings();
    }, primary: chosen);

    private void SetScale(float scale)
    {
        Game.Instance.UiScale = scale;
        Game.Instance.ApplyDisplay();
        RequestRefresh();
    }

    private void SetTouch(TouchMode mode)
    {
        Game.Instance.Touch = mode;
        RequestRefresh();
    }

    private void Slider(string label, float value, Action<float> set)
    {
        var name = UiKit.Label(label, 16, Ink.InkColor);
        name.CustomMinimumSize = new Vector2(120, 0);
        var number = UiKit.Label($"{Mathf.RoundToInt(value * 100)}%", 14, Ink.InkSoft);
        number.CustomMinimumSize = new Vector2(52, 0);
        var slider = new HSlider
        {
            MinValue = 0, MaxValue = 100, Step = 1, Value = value * 100, CustomMinimumSize = new Vector2(300, 24),
            SizeFlagsVertical = SizeFlags.ShrinkCenter, FocusMode = FocusModeEnum.None,
        };
        // A pale track that fills with jade up to the level (the default theme reads the other way round).
        static StyleBoxFlat Bar(Color color) => new()
        {
            BgColor = color, ContentMarginTop = 3, ContentMarginBottom = 3,
            CornerRadiusTopLeft = 3, CornerRadiusTopRight = 3, CornerRadiusBottomLeft = 3, CornerRadiusBottomRight = 3,
        };
        slider.AddThemeStyleboxOverride("slider", Bar(new Color(Ink.InkColor, 0.16f)));
        slider.AddThemeStyleboxOverride("grabber_area", Bar(Ink.JadeDeep));
        slider.AddThemeStyleboxOverride("grabber_area_highlight", Bar(Ink.Jade));
        slider.ValueChanged += v =>
        {
            set((float)v / 100f);
            number.Text = $"{Mathf.RoundToInt(v)}%";
            SoundBoard.I?.ApplyVolumes();
            Game.Instance.SaveSettings();
        };
        var row = new HBoxContainer();
        row.AddChild(name);
        row.AddChild(slider);
        row.AddChild(number);
        Body.AddChild(row);
    }

    private void Toggle(string label, bool value, Action<bool> set)
    {
        var check = new CheckButton { Text = label, ButtonPressed = value, FocusMode = FocusModeEnum.None };
        check.AddThemeFontSizeOverride("font_size", 16);
        check.AddThemeColorOverride("font_color", Ink.InkColor);
        check.AddThemeColorOverride("font_pressed_color", Ink.InkColor);
        check.AddThemeColorOverride("font_hover_color", Ink.InkColor);
        check.Toggled += on =>
        {
            set(on);
            SoundBoard.Play("click", -6);
            Game.Instance.SaveSettings();
        };
        Body.AddChild(check);
    }
}
