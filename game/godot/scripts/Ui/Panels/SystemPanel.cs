using Godot;
using TuTien.Core;

namespace TuTienLuc.Ui.Panels;

public partial class SystemPanel : InkPanel
{
    protected override string Glyph => "系";
    protected override string TitleText => T("Hệ thống", "System");
    protected override Vector2 PanelSize => new(560, 580);

    protected override void Build()
    {
        Para(T("Trò chơi tự lưu mỗi khi qua tháng và sau mỗi trận.", "The game saves at every month's end and after every fight."), 15, Ink.InkMute);
        foreach (var b in new[]
                 {
                     UiKit.Button(T("Tiếp tục", "Resume"), Close, primary: true),
                     UiKit.Button(T("Lưu ngay", "Save now"), () =>
                     {
                         Game.Instance.SaveGame();
                         Game.Instance.Toast("Đã lưu.", "Saved.");
                     }),
                     UiKit.Button(T("Cài đặt (âm thanh, hiển thị, phím, ngôn ngữ)", "Settings (sound, display, keys, language)"), () => Open(new SettingsPanel())),
                     UiKit.Button(T("Đổi phím", "Rebind keys"), () => Open(new KeysPanel())),
                     UiKit.Button(T("Lưu và về màn hình chính", "Save and return to title"), () =>
                     {
                         Game.Instance.SaveGame();
                         Main.Instance.ShowTitle();
                     }),
                     UiKit.Button(T("Lưu và thoát", "Save and quit"), () =>
                     {
                         Game.Instance.SaveGame();
                         Game.Instance.Quit();
                     }),
                 })
        {
            b.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            Body.AddChild(b);
        }
        Section(T("Phím tắt", "Keys"));
        Para(KeysText.World(), 14, Ink.InkSoft);
        Para(T("Thời gian trôi khi ngươi đi: mỗi ô đất tốn cước lực; hết cước lực thì tháng tự qua.",
            "Time flows as you travel: every tile costs footwork; when it runs out the month turns by itself."), 14, Ink.InkSoft);
        Para(KeysText.Fight(), 14, Ink.InkSoft);
    }
}
