using Godot;
using TuTien.Core;
using TuTien.Core.Rules;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

/// <summary>Before a major breakthrough (design §7.5): what it takes, what failure costs, then the trial.</summary>
public partial class BreakthroughPanel : InkPanel
{
    protected override IconKind Emblem => IconKind.Ascend;
    protected override string TitleText => T("Đột phá cảnh giới", "Breakthrough");
    protected override Vector2 PanelSize => new(760, 660);

    protected override void Build()
    {
        var p = E.Player;
        if (!E.BreakthroughReady)
        {
            Para(T("Tu vi chưa viên mãn.", "Your cultivation isn't full yet."));
            Buttons(UiKit.Button(T("Đóng", "Close"), Close));
            return;
        }
        var target = p.Realm + 1;
        Para(T($"{Text.Realm(p.Realm, p.Stage)} → {Names.Display(target, Locale.Vi)}",
            $"{Text.Realm(p.Realm, p.Stage)} → {Names.Display(target, Locale.En)}"), 24, Ink.InkColor);

        var threshold = Cultivation.MajorBreakthroughThreshold(E.State);
        Section(T("Độ khó", "Difficulty"));
        Para(T($"Cần đạt {threshold * 100:0}% trong thử thách.", $"You need {threshold * 100:0}% in the trial."), 20, Ink.CinnabarDeep);
        Para(T($"· Linh căn {Names.Display(p.Root.Grade, Locale.Vi)}: −{5 * (int)p.Root.Grade}%", $"· {Names.Display(p.Root.Grade, Locale.En)} root: −{5 * (int)p.Root.Grade}%"), 15, Ink.InkSoft);
        Para(T($"· {p.Techniques.Count} công pháp: −{2 * p.Techniques.Count}%", $"· {p.Techniques.Count} technique(s): −{2 * p.Techniques.Count}%"), 15, Ink.InkSoft);
        if (p.Injuries.Count > 0) Para(T("· Đang bị thương: +15% (nên dưỡng thương trước)", "· Injured: +15% (heal first)"), 15, Ink.Cinnabar);

        Section(T("Thử thách", "The trial"));
        if (p.Realm == Realm.LuyenKhi)
        {
            Para(T("Trúc cơ — bão kinh mạch: linh khí đổ về đan điền theo tám đạo kỳ kinh trong 60 giây. Đứng trên kinh mạch để đón linh khí (tinh hoa hợp linh căn ×4), chém hoặc tránh trọc khí, bước khỏi kinh mạch đang đỏ trước khi trọc khí cuộn xuống, và ở chặng cuối tìm khe hở trong các đợt sóng xung kích.",
                "Foundation — the meridian storm: for 60 seconds qi pours into the dantian down the eight extraordinary meridians. Stand on a meridian to catch it (your root's essence counts ×4), cut or dodge the turbid qi, step off a meridian that turns red before the surge comes down it, and in the last stretch find the gaps in the shockwaves."), 16, Ink.InkSoft);
            Para(T($"Nền móng xếp hạng theo thành tích: Hạ phẩm, Trung phẩm (≥{Foundation.Trung * 100:0}%), Thượng phẩm (≥{Foundation.Thuong * 100:0}%), Thiên phẩm (≥{Foundation.Thien * 100:0}%). Nền càng tốt, lợi ích khi đột phá càng lớn (tới ×2) và uy lực vĩnh viễn càng cao (tới +20%).",
                $"The foundation is graded by your performance: lower, middle (≥{Foundation.Trung * 100:0}%), upper (≥{Foundation.Thuong * 100:0}%) and heaven grade (≥{Foundation.Thien * 100:0}%). A better foundation means bigger gains from the breakthrough (up to ×2) and more power for good (up to +20%)."), 15, Ink.GoldDeep);
        }
        else
        {
            Para(p.Realm == Realm.PhamNhan
                ? T("Dẫn khí nhập thể: linh khí trời đất đổ về. Thu lấy những luồng linh khí (hợp linh căn được nhiều hơn), tránh tâm ma màu đỏ. 25 giây.",
                    "Drawing qi into the body: heaven and earth's qi pours in. Gather the qi motes (your root's element counts more) and avoid the red heart demons. 25 seconds.")
                : T("Xung kích bình cảnh: thu linh khí, tránh tâm ma — chúng nhanh và đông hơn ở cảnh giới cao. 25 giây.",
                    "Storm the bottleneck: gather qi, avoid heart demons — faster and more numerous at higher realms. 25 seconds."), 16, Ink.InkSoft);
        }
        Para(T("Thất bại: mất 20% tu vi và tổn thương kinh mạch 2 tháng (tu luyện ×0.5).", "Failure: lose 20% of your cultivation and damage your meridians for 2 months (cultivation ×0.5)."), 15, Ink.CinnabarDeep);

        Body.AddChild(UiKit.Spacer(8));
        Buttons(
            UiKit.Button(T("Bắt đầu đột phá", "Begin"), () => Main.Instance.ShowBreakthroughTrial(), primary: true),
            UiKit.Button(T("Chuẩn bị thêm", "Prepare more"), Close));
    }
}
