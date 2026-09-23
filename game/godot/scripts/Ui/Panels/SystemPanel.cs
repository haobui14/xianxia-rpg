using Godot;
using TuTien.Core;

namespace TuTienLuc.Ui.Panels;

public partial class SystemPanel : InkPanel
{
    protected override string Glyph => "系";
    protected override string TitleText => T("Hệ thống", "System");
    protected override Vector2 PanelSize => new(560, 520);

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
                     UiKit.Button(Game.Instance.Locale == Locale.Vi ? "Language: English" : "Ngôn ngữ: Tiếng Việt",
                         () => Game.Instance.SetLocale(Game.Instance.Locale == Locale.Vi ? Locale.En : Locale.Vi)),
                     UiKit.Button(T("Lưu và về màn hình chính", "Save and return to title"), () =>
                     {
                         Game.Instance.SaveGame();
                         Main.Instance.ShowTitle();
                     }),
                     UiKit.Button(T("Lưu và thoát", "Save and quit"), () =>
                     {
                         Game.Instance.SaveGame();
                         GetTree().Quit();
                     }),
                 })
        {
            b.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            Body.AddChild(b);
        }
        Section(T("Phím tắt", "Keys"));
        Para(T("Bản đồ: WASD đi · nhấp chuột đi theo đường · E tương tác · N qua tháng · B bế quan · Tab thần thức · C/I/J · F9 gian lận (thử nghiệm)",
            "Map: WASD step · click to walk · E interact · N end month · B seclusion · Tab sense pulse · C/I/J · F9 dev cheats"), 14, Ink.InkSoft);
        Para(T("Chiến đấu: WASD · chuột trái võ kỹ · chuột phải/1/2/3 linh kỹ · Space lướt · R tuyệt kỹ · Q đan dược · Esc tạm dừng",
            "Combat: WASD · left click martial art · right click/1/2/3 spirit arts · Space dash · R ultimate · Q pill · Esc pause"), 14, Ink.InkSoft);
    }
}
