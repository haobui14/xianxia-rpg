using Godot;
using TuTienLuc.Dev;

namespace TuTienLuc.Ui.Panels;

/// <summary>F9: shortcuts for testing the slice (see <see cref="DevCheats"/>).</summary>
public partial class DebugPanel : InkPanel
{
    protected override string Glyph => "試";
    protected override string TitleText => T("Thử nghiệm (F9)", "Dev cheats (F9)");
    protected override Vector2 PanelSize => new(600, 600);

    protected override void Build()
    {
        Para(T("Chỉ dùng để thử nghiệm bản greybox.", "For testing the greybox only."), 14, Ink.InkMute);
        Add(T("+500 tu vi", "+500 cultivation"), () => Say(DevCheats.AddExp(E, 500)));
        Add(T("Tu vi viên mãn (sẵn sàng đột phá)", "Fill cultivation (breakthrough ready)"), () => Say(DevCheats.FillToBreakthrough(E)));
        Add(T("+500 bạc", "+500 silver"), () =>
        {
            DevCheats.Silver(E, 500);
            Game.Instance.Changed();
        });
        Add(T("Hồi phục + đầy cước lực", "Restore + full footwork"), () =>
        {
            DevCheats.Restore(E);
            Game.Instance.Changed();
        });
        Add(T("Mở toàn bộ bản đồ", "Reveal the whole map"), () =>
        {
            DevCheats.RevealMap(E);
            Game.Instance.Changed();
        });
        Add(T("Qua 12 tháng", "Pass 12 months"), () =>
        {
            Say(DevCheats.PassMonths(E, 12));
            Game.Instance.SaveGame();
        });
        Section(T("Đánh thử", "Test fights"));
        foreach (var (id, vi, en) in new[]
                 {
                     ("forest_wolf", "Sói Rừng (xung phong)", "Forest Wolf (charger)"),
                     ("corrupted_vine", "Tà Đằng (tầm xa)", "Corrupted Vine (ranged)"),
                     ("bark_golem", "Thụ Bì Khôi Lỗi (giáp dày)", "Bark Golem (tank)"),
                     ("bandit_leader", "Thủ Lĩnh Thổ Phỉ (pháp sư)", "Bandit Leader (caster)"),
                     ("ancient_tree_spirit", "Cổ Mộc Linh (trùm)", "Ancient Tree Spirit (boss)"),
                 })
        {
            var enemy = id;
            Add(T(vi, en), () =>
            {
                var enc = E.StartAdventureFight(enemy, "verdant_forest");
                if (enc != null) FightHere(enc);
            });
        }
    }

    private void Add(string text, System.Action action)
    {
        var b = UiKit.Button(text, action);
        b.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        Body.AddChild(b);
    }
}
