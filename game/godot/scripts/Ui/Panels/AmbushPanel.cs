using System.Linq;
using Godot;
using TuTien.Core.Combat;

namespace TuTienLuc.Ui.Panels;

/// <summary>A fight the world forces on you: a stalking pack, or someone who holds a grudge (oán).</summary>
public partial class AmbushPanel : InkPanel
{
    protected override string Glyph => "伏";
    protected override string TitleText => T("Phục kích!", "Ambush!");
    protected override bool Closable => false;
    protected override Vector2 PanelSize => new(640, 420);

    protected override void Build()
    {
        var ambush = E.State.World.PendingAmbush;
        if (ambush == null)
        {
            Buttons(UiKit.Button(T("Tiếp tục", "Continue"), Close));
            return;
        }
        var npc = ambush.SourceId != null ? E.Npc(ambush.SourceId) : null;
        if (npc != null)
        {
            Para(T($"{npc.Name} chặn đường ngươi, sát khí đằng đằng: \"Món nợ giữa ta và ngươi, hôm nay tính cho xong!\"",
                $"{npc.Name} blocks your path, murder in their eyes: \"Today we settle the debt between us!\""), 18, Ink.InkColor);
            Para(T("Kẻ ôm hận (oán) trong sổ nhân quả đã tìm tới. Trận này là sinh tử.", "A grudge from your karma ledger has found you. This fight is to the death."), 15, Ink.CinnabarDeep);
        }
        else
        {
            var names = ambush.EnemyIds.Select(id => E.Content.Enemy(id) ?? Encounters.Fallback(id)).Select(d => T(d.Name, d.NameEn));
            Para(T("Tiếng lá xào xạc — một bầy yêu thú đã rình ngươi từ lâu: ", "Rustling leaves — a pack has been stalking you: ")
                 + string.Join(", ", names) + ".", 18, Ink.InkColor);
        }
        Para(T("Không còn đường lui ở đây; trong trận có thể dùng độn thuật để chạy (Esc).", "There's no avoiding it here; in the fight you can still flee (Esc)."), 14, Ink.InkMute);
        Body.AddChild(UiKit.Spacer(8));
        Buttons(UiKit.Danger(T("Nghênh chiến", "Face them"), () =>
        {
            var enc = E.TakeAmbush();
            if (enc != null) Main.Instance.ShowArena(enc);
            else Close();
        }));
    }
}
