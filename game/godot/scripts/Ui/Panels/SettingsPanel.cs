using System;
using Godot;
using TuTien.Core;
using TuTienLuc.Audio;

namespace TuTienLuc.Ui.Panels;

/// <summary>Sound, display and language. Changes apply at once and are saved to user://settings.json.</summary>
public partial class SettingsPanel : InkPanel
{
    protected override string Glyph => "設";
    protected override string TitleText => T("Cài đặt", "Settings");
    protected override Vector2 PanelSize => new(620, 560);

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
        Toggle(T("Toàn màn hình", "Fullscreen"), g.Fullscreen, on =>
        {
            g.Fullscreen = on;
            g.ApplyDisplay();
        });
        Toggle(T("Rung màn hình khi trúng đòn", "Screen shake on hits"), g.ScreenShake, on => g.ScreenShake = on);

        Section(T("Ngôn ngữ", "Language"));
        Buttons(
            UiKit.Button("Tiếng Việt", () => g.SetLocale(Locale.Vi), primary: g.Locale == Locale.Vi),
            UiKit.Button("English", () => g.SetLocale(Locale.En), primary: g.Locale == Locale.En));

        Body.AddChild(UiKit.Spacer(8));
        Buttons(UiKit.Button(T("Xong", "Done"), Close, primary: true));
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
