using System.Linq;
using Godot;
using TuTien.Core.State;

namespace TuTienLuc.Ui.Panels;

/// <summary>Sổ tay: the chronicle, rumors, the karma ledger, bounties, and how to play.</summary>
public partial class JournalPanel : InkPanel
{
    protected override string Glyph => "錄";
    protected override string TitleText => T("Sổ tay tu hành", "Journal");
    protected override Vector2 PanelSize => new(820, 680);

    protected override void Build()
    {
        Tabs(T("Biên niên", "Chronicle"), T("Tin đồn", "Rumors"), T("Nhân quả", "Ledger"), T("Cáo thị", "Bounties"), T("Cách chơi", "How to play"));
        var state = E.State;
        switch (Tab)
        {
            case 0:
                foreach (var entry in state.Chronicle.AsEnumerable().Reverse().Take(40))
                    Para(T(entry.Text, entry.TextEn), 15, Ink.InkSoft);
                Para(T("(Biên niên ngoại tuyến. Linh Thức sẽ chấp bút lại thành truyện khi trực tuyến.)",
                    "(Offline chronicle. The Linh Thức storyteller rewrites it as prose when online.)"), 13, Ink.InkFaint);
                break;
            case 1:
                if (state.World.Rumors.Count == 0) Para(T("Giang hồ còn yên ắng.", "All is quiet so far."));
                foreach (var r in state.World.Rumors.AsEnumerable().Reverse().Take(40))
                    Para($"{T("Tháng", "Month")} {r.MonthIndex}: 「{T(r.Text, r.TextEn)}」", 15, Ink.Violet);
                break;
            case 2:
                if (state.Player.Ledger.Count == 0)
                    Para(T("Chưa mang ơn ai, cũng chưa kết oán với ai.", "No debts of gratitude, no grudges — yet."));
                foreach (var l in state.Player.Ledger.AsEnumerable().Reverse())
                {
                    var who = E.Npc(l.NpcId)?.Name ?? l.NpcId;
                    var kind = l.Kind == LedgerKind.An ? T("Ân", "Debt") : T("Oán", "Grudge");
                    Para($"{who} — {kind} {l.Weight}{(l.Settled ? T(" (đã trả)", " (settled)") : "")}: {T(l.Context, l.ContextEn)}", 15,
                        l.Kind == LedgerKind.An ? Ink.JadeDeep : Ink.CinnabarDeep);
                }
                Para(T("Ân oán không tự mất: người mang ơn sẽ giúp ngươi lúc hoạn nạn, kẻ ôm hận sẽ tìm tới báo thù.",
                    "Bonds don't fade on their own: those in your debt come to help, those with grudges come for revenge."), 13, Ink.InkFaint);
                break;
            case 3:
                if (state.Player.Bounties.Count == 0) Para(T("Chưa nhận cáo thị nào — xem bảng cáo thị ở thôn.", "No bounties taken — check the village board."));
                foreach (var b in state.Player.Bounties)
                    Para($"{T(b.Name, b.NameEn)}: {b.Progress}/{b.Count} · {b.RewardSilver} {T("bạc", "silver")}", 16, b.Progress >= b.Count ? Ink.JadeDeep : Ink.InkColor);
                break;
            default:
                HowToPlay();
                break;
        }
    }

    private void HowToPlay()
    {
        Section(T("Vòng lặp", "The loop"));
        Para(T("Mỗi tháng ngươi có một lượng cước lực (足) để đi lại trên bản đồ. Địa hình khó tốn nhiều hơn. Khi hết, bấm Qua tháng [N]: tu vi tăng, thế giới chuyển động (tu sĩ tu luyện, kết thù, tọa hóa), yêu thú di chuyển, kỳ ngộ mới xuất hiện.",
            "Each month you have footwork (足) to spend moving on the map; rough terrain costs more. When it runs out, End month [N]: you cultivate, the world moves (NPCs cultivate, feud, die), beasts roam, new encounters appear."), 15);
        Para(T("Bế quan [B] đốt nhiều tháng một lúc với tu vi ×1.6 — tốt nhất ở linh mạch (脈, 泉). Khi tu vi viên mãn, bấm Đột phá: một thử thách thật, có thể thất bại.",
            "Seclusion [B] burns several months at ×1.6 cultivation — best at a spirit vein (脈, 泉). When full, Break through: a real trial you can fail."), 15);
        Section(T("Bản đồ", "Map"));
        Para(T("WASD / phím mũi tên: đi một bước · nhấp chuột: đi theo đường (xem trước chi phí) · E: tương tác · Tab: thần thức (10 linh lực, mở rộng tầm cảm nhận) · C/I/J: nhân vật / hành trang / sổ tay · con lăn: phóng to · Esc: hệ thống.",
            "WASD / arrows: step · click: walk a path (cost previewed) · E: interact · Tab: sense pulse (10 Qi, widens your sense) · C/I/J: character / inventory / journal · wheel: zoom · Esc: system."), 15);
        Para(T("Chấm đỏ là yêu thú (bước vào để đánh), vòng tròn là tu sĩ, 奇 vàng là kỳ ngộ. Chỉ thấy chúng trong tầm thần thức.",
            "Red discs are beasts (step in to fight), rings are cultivators, gold 奇 are encounters. You only see them within your spiritual sense."), 15);
        Section(T("Chiến đấu", "Combat"));
        Para(T("WASD di chuyển · chuột ngắm · chuột trái: võ kỹ · chuột phải / 1 / 2 / 3: linh kỹ · Space: lướt né (bất khả xâm phạm trong chớp mắt) · R: tuyệt kỹ khi sát ý đầy · Q: đan dược · Esc: tạm dừng / bỏ chạy.",
            "WASD move · mouse aims · left click: martial art · right click / 1 / 2 / 3: spirit arts · Space: dash (brief invulnerability) · R: ultimate when killing intent is full · Q: pill · Esc: pause / flee."), 15);
        Para(T("Ngũ Hành: đòn có hệ để lại ấn (金木水火土) trên địch. Đòn kế tiếp khắc ấn đó thì phá ấn (chảy máu, phá giáp, trói chân…); đòn được ấn sinh ra thì cộng hưởng ×1.5. Vùng đỏ là đòn sắp giáng — hãy lướt ra.",
            "Five Phases: elemental hits leave a mark (金木水火土). A hit that overcomes the mark shatters it (bleed, armor break, root…); a hit the mark generates is amplified ×1.5. Red zones are incoming attacks — dash out."), 15);
    }
}
