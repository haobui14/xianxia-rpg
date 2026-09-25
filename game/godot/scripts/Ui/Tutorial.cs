using System;
using System.Collections.Generic;
using Godot;
using TuTienLuc.Art;
using TuTienLuc.Audio;
using TuTienLuc.Field;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.Ui;

/// <summary>
/// The new player guide: a card at the left of the screen takes a first life through the controls one step at a
/// time. Each step waits for the player to do it (walk, talk to someone, close the panel, swing the sword, dash, open
/// the map, open the character sheet), ticks it off and moves on. The last three explain time, fights and what else
/// there is to do, and wait for Next. It shows once, at the start of the first life; Skip ends it, and the journal's
/// How to play tab brings it back. Prompts name the player's own keys (or the touch buttons, with touch controls on).
/// </summary>
public partial class Tutorial : PanelContainer
{
    private sealed class Step
    {
        public Func<string> Title = () => "";
        public Func<string> Text = () => "";
        /// <summary>Done once this is true; null for a step that only explains and waits for Next.</summary>
        public Func<bool>? Done;
    }

    private readonly WorldScreen _w;
    private readonly List<Step> _steps;
    private Label _header = null!, _title = null!, _text = null!, _status = null!;
    private Button _next = null!, _skip = null!;
    /// <summary>Seconds since the current step was done (−1 while it isn't), so the tick shows before the next one.</summary>
    private float _doneFor = -1;
    private Vector2 _from;
    private int _swings, _dashes;

    /// <summary>Which step is showing (0-based).</summary>
    public int Index { get; private set; }
    public int Count => _steps.Count;
    public bool Finished { get; private set; }
    /// <summary>The current step's words, for tests (they name the player's own keys).</summary>
    public string Text => _text.Text;

    private static string T(string vi, string en) => Game.Instance.T(vi, en);
    private static string K(string action) => TouchUi.Prompt(action);

    public Tutorial(WorldScreen world, int from)
    {
        _w = world;
        _steps = Steps();
        Index = Math.Clamp(from, 0, _steps.Count - 1);
    }

    private List<Step> Steps() => new()
    {
        new Step
        {
            Title = () => T("Đi lại", "Walking"),
            Text = () => TouchUi.Active
                ? T("Kéo cần điều khiển bên trái để đi, hoặc chạm lên mặt đất để đi tới đó.", "Drag the stick on the left to walk, or tap the ground to walk there.")
                : T($"Đi bằng {KeyMap.MoveKeys} hoặc các phím mũi tên. Đi thử vài bước quanh làng.", $"Walk with {KeyMap.MoveKeys} or the arrow keys. Take a few steps around the village."),
            Done = () => !_w.PanelOpen && _w.PlayerBody.Pos.DistanceTo(_from) > 200,
        },
        new Step
        {
            Title = () => T("Tương tác", "Interacting"),
            Text = () => T($"Tới gần một người hay một nơi (bảng cáo thị, sạp hàng, khách điếm) rồi bấm {K("interact")}. Dòng chữ nổi lên cho biết có thể làm gì ở đó.",
                $"Walk up to a person or a place (the bounty board, the market stall, the inn) and press {K("interact")}. A label pops up saying what you can do there."),
            Done = () => _w.CurrentPanel is TownPanel or NpcPanel or ShrinePanel or AlchemyPanel or FishingPanel or SectPanel or EventPanel or RealmPanel,
        },
        new Step
        {
            Title = () => T("Đóng bảng", "Closing a panel"),
            Text = () => T($"Bấm {K("pause")} hoặc dấu ✕ ở góc trên để đóng bảng.", $"Press {K("pause")} or the ✕ in the top corner to close the panel."),
            Done = () => !_w.PanelOpen,
        },
        new Step
        {
            Title = () => T("Vung kiếm", "Your sword"),
            Text = () => TouchUi.Active
                ? T($"Chạm {K("attack")} để vung kiếm. Chém một con yêu thú là giao chiến ngay tại chỗ.", $"Tap {K("attack")} to swing your sword. Striking a beast starts a fight right where you stand.")
                : T("Nhấp chuột trái để vung kiếm về phía con trỏ. Chém một con yêu thú là giao chiến ngay tại chỗ.", "Left-click to swing your sword toward the pointer. Striking a beast starts a fight right where you stand."),
            Done = () => _w.Player.Swings > _swings,
        },
        new Step
        {
            Title = () => T("Lướt", "Dashing"),
            Text = () => T($"Bấm {K("dash")} để lướt theo hướng đang đi. Khi lướt thì không đòn nào trúng được ngươi: vùng đỏ dưới đất là đòn sắp giáng, hãy lướt ra khỏi nó.",
                $"Press {K("dash")} to dash the way you're moving. Nothing can hit you mid-dash: red marks on the ground are attacks about to land, so dash out of them."),
            Done = () => _w.Player.Dashes > _dashes,
        },
        new Step
        {
            Title = () => T("Bản đồ", "The map"),
            Text = () => T($"Bấm {K("open_map")} để mở bản đồ. Nhấp vào nơi đã thấy thì nhân vật sẽ tự đi tới đó.", $"Press {K("open_map")} to open the map. Click anywhere you've already seen and you'll walk there."),
            Done = () => _w.CurrentPanel is MapPanel,
        },
        new Step
        {
            Title = () => T("Nhân vật", "Your character"),
            Text = () => T($"Đóng bản đồ ({K("pause")}), rồi bấm {K("open_character")} để xem nhân vật: cảnh giới, thuộc tính, trang bị, linh kỹ. {K("open_inventory")} mở hành trang, {K("open_journal")} mở sổ tay.",
                $"Close the map ({K("pause")}), then press {K("open_character")} for your character: realm, attributes, gear and arts. {K("open_inventory")} opens your bag and {K("open_journal")} the journal."),
            Done = () => _w.CurrentPanel is CharacterPanel,
        },
        new Step
        {
            Title = () => T("Thời gian", "Time"),
            Text = () => T($"Mỗi ô đất bước qua tốn cước lực (thanh dưới ngày tháng). Hết cước lực thì tháng qua: ngươi tu luyện thêm và thế giới đổi thay. Bấm {K("end_month")} để qua tháng sớm, {K("seclude")} để bế quan nhiều tháng liền.",
                $"Every tile you cross costs footwork (the bar under the date). When it runs out the month turns: you cultivate and the world moves on. {K("end_month")} ends a month early, and {K("seclude")} secludes you for several months."),
        },
        new Step
        {
            Title = () => T("Chiến đấu", "Fights"),
            Text = () => T($"Yêu thú lang thang ngoài làng; bầy hung hãn thấy ngươi sẽ đuổi theo. Khi đã có linh kỹ, dùng chúng bằng chuột phải và các phím {K("skill_2")}, {K("skill_3")}, {K("skill_4")}. {K("pill")} uống đan dược. Chạy thật xa để thoát trận.",
                $"Beasts roam outside the village, and aggressive packs chase you. Once you have spirit arts, cast them with the right mouse button and {K("skill_2")}, {K("skill_3")}, {K("skill_4")}. {K("pill")} takes a pill. Run far away to escape a fight."),
        },
        new Step
        {
            Title = () => T("Con đường phía trước", "The path ahead"),
            Text = () => T("Khi thanh tu vi đầy, nút Đột phá sẽ hiện lên. Ngoài chiến đấu còn câu cá ở các bến sông, đào khoáng, luyện đan ở Bách Thảo Đường và xin xăm ở miếu Thổ Địa. Sổ tay, mục Cách chơi, có đủ những điều này.",
                "When your cultivation bar fills, a Break through button appears. Besides fighting you can fish at the river landings, mine ore, brew pills at the apothecary and draw a fortune at the shrine. The journal's How to play tab has all of this."),
        },
    };

    public override void _Ready()
    {
        MouseFilter = MouseFilterEnum.Ignore;
        AddThemeStyleboxOverride("panel", Ink.Box(Ink.Card, Ink.InkColor, 1, 4, 14));
        CustomMinimumSize = new Vector2(356, 0);
        var column = new VBoxContainer { MouseFilter = MouseFilterEnum.Ignore };
        column.AddThemeConstantOverride("separation", 6);
        AddChild(column);

        var head = new HBoxContainer { MouseFilter = MouseFilterEnum.Ignore };
        head.AddThemeConstantOverride("separation", 8);
        head.AddChild(UiKit.Seal(IconKind.Book, 26));
        _header = UiKit.Label("", 14, Ink.InkMute);
        _header.VerticalAlignment = VerticalAlignment.Center;
        _header.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        head.AddChild(_header);
        _skip = UiKit.Button("", Skip);
        _skip.Name = "tutorial_skip";
        head.AddChild(_skip);
        column.AddChild(head);

        _title = UiKit.Label("", 21, Ink.InkColor);
        column.AddChild(_title);
        _text = UiKit.Label("", 16, Ink.InkSoft, wrap: true);
        _text.CustomMinimumSize = new Vector2(326, 0);
        column.AddChild(_text);
        _status = UiKit.Label("", 16, Ink.JadeDeep);
        column.AddChild(_status);
        _next = UiKit.Button("", Advance, primary: true);
        _next.Name = "tutorial_next";
        column.AddChild(_next);

        Game.Instance.LocaleChanged += Refresh;
        Begin();
    }

    public override void _ExitTree() => Game.Instance.LocaleChanged -= Refresh;

    /// <summary>Where the current step starts from: the body's place, and the swings and dashes so far.</summary>
    private void Begin()
    {
        _doneFor = -1;
        _from = _w.PlayerBody.Pos;
        _swings = _w.Player.Swings;
        _dashes = _w.Player.Dashes;
        Game.Instance.TutorialStep = Index;
        Refresh();
    }

    public override void _Process(double delta)
    {
        if (Finished) return;
        if (_doneFor >= 0)
        {
            // A moment to see the tick, then the next step.
            _doneFor += (float)delta;
            if (_doneFor > 1.1f) Advance();
            return;
        }
        if (_steps[Index].Done is { } done && done())
        {
            _doneFor = 0;
            SoundBoard.Play("chime", -6);
            Refresh();
        }
    }

    /// <summary>On to the next step (Next on an explaining step), or the end after the last.</summary>
    public void Advance()
    {
        if (Finished) return;
        if (Index + 1 >= _steps.Count)
        {
            Finish(skipped: false);
            return;
        }
        Index += 1;
        Begin();
    }

    public void Skip() => Finish(skipped: true);

    private void Finish(bool skipped)
    {
        Finished = true;
        var game = Game.Instance;
        game.TutorialDone = true;
        game.TutorialStep = -1;
        game.SaveSettings();
        if (skipped) game.Toast("Có thể xem lại hướng dẫn trong Sổ tay, mục Cách chơi.", "You can replay the guide from the journal's How to play tab.");
        else game.Toast("Hoàn thành hướng dẫn tân thủ. Chúc đạo hữu tu hành thuận lợi!", "New player guide complete. May your path go smoothly!");
        _w.TutorialEnded();
    }

    private void Refresh()
    {
        if (!IsInsideTree() || Finished) return;
        var step = _steps[Index];
        _header.Text = T($"Hướng dẫn tân thủ · {Index + 1}/{_steps.Count}", $"New player guide · {Index + 1}/{_steps.Count}");
        _title.Text = step.Title();
        _text.Text = step.Text();
        var explains = step.Done == null;
        _status.Visible = !explains;
        _status.Text = _doneFor >= 0 ? T("✓ Làm được rồi!", "✓ Done!") : T("Hãy thử xem…", "Give it a try…");
        _status.AddThemeColorOverride("font_color", _doneFor >= 0 ? Ink.JadeDeep : Ink.InkFaint);
        _next.Visible = explains;
        _next.Text = Index + 1 >= _steps.Count ? T("Bắt đầu tu hành", "Begin your path") : T("Tiếp", "Next");
        _skip.Text = T("Bỏ qua", "Skip");
    }
}
