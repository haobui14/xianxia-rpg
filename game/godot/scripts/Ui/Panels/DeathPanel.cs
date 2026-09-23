using System.Linq;
using Godot;
using TuTien.Core;

namespace TuTienLuc.Ui.Panels;

/// <summary>The end of a run — what this life amounted to (design §7.15: death is permanent).</summary>
public partial class DeathPanel : InkPanel
{
    protected override string Glyph => "終";
    protected override string TitleText => T("Đạo đồ đã tận", "Your path has ended");
    protected override bool Closable => false;
    protected override Vector2 PanelSize => new(720, 580);

    protected override void Build()
    {
        var p = E.Player;
        var cause = p.DeathCause == "lifespan"
            ? T($"Thọ nguyên cạn kiệt ở tuổi {p.Age}.", $"Your lifespan ran out at age {p.Age}.")
            : T($"Ngã xuống ở tuổi {p.Age}.", $"You fell at age {p.Age}.");
        Para(cause, 20, Ink.InkColor);
        Para(T($"Cảnh giới cao nhất: {Text.Realm(p.Realm, p.Stage)} · thể: {Text.Body(p.BodyRealm, p.BodyStage)}",
            $"Highest realm: {Text.Realm(p.Realm, p.Stage)} · body: {Text.Body(p.BodyRealm, p.BodyStage)}"), 17, Ink.JadeDeep);
        Para(T($"{E.State.Calendar.MonthIndex} tháng tu hành · {p.Counters.Kills} lần hạ địch · {p.Counters.AdventuresResolved} kỳ ngộ · nhân quả {Text.Karma(p.Karma)}",
            $"{E.State.Calendar.MonthIndex} months on the path · {p.Counters.Kills} kills · {p.Counters.AdventuresResolved} adventures · karma {Text.Karma(p.Karma)}"), 15, Ink.InkSoft);
        Section(T("Biên niên cuối", "Last pages of the chronicle"));
        foreach (var entry in E.State.Chronicle.AsEnumerable().Reverse().Take(4))
            Para(T(entry.Text, entry.TextEn), 14, Ink.InkMute);
        Body.AddChild(UiKit.Spacer(8));
        Buttons(UiKit.Button(T("Luân hồi — bắt đầu kiếp mới", "Reincarnate — begin a new life"), () =>
        {
            Game.Instance.EndRun();
            Main.Instance.ShowTitle();
        }, primary: true));
    }
}
