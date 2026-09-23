using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.State;
using TuTien.Core.World;

namespace TuTienLuc.Ui;

/// <summary>Title and character creation: name, age, a spirit root roll (with rerolls), and a path.</summary>
public partial class TitleScreen : Control
{
    private const int MaxRerolls = 3;

    private ulong _seed;
    private int _rerolls;
    private SpiritRootState _root = new();
    private CultivationPath _path = CultivationPath.Qi;
    private string _name = "";
    private int _age = 16;
    private bool _creating;

    private VBoxContainer _left = null!;
    private VBoxContainer _right = null!;

    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    public override void _Ready()
    {
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        NewSeed();
        _name = RandomName();
        Game.Instance.LocaleChanged += Build;
        Build();
    }

    public override void _ExitTree() => Game.Instance.LocaleChanged -= Build;

    private void NewSeed()
    {
        _seed = ((ulong)GD.Randi() << 32) | GD.Randi();
        _rerolls = 0;
        _root = WorldGen.RollRoot(Seeds.Stream(_seed, "root", _rerolls));
    }

    private string RandomName()
    {
        var names = Game.Instance.Content.NpcNames;
        var rng = Seeds.Stream(_seed ^ GD.Randi(), "player-name");
        if (names.Surnames.Count == 0 || names.GivenMale.Count == 0) return "Lâm Vân";
        var given = rng.Chance(0.5) || names.GivenFemale.Count == 0 ? names.GivenMale : names.GivenFemale;
        return rng.Pick(names.Surnames) + " " + rng.Pick(given);
    }

    private void Build()
    {
        UiKit.Clear(this);
        var bg = new ColorRect { Color = Ink.Paper, MouseFilter = MouseFilterEnum.Ignore };
        bg.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        AddChild(bg);

        var mark = UiKit.Han("仙", 520, new Color(Ink.InkColor, 0.05f));
        mark.MouseFilter = MouseFilterEnum.Ignore;
        mark.AnchorLeft = mark.AnchorRight = 1;
        mark.AnchorTop = mark.AnchorBottom = 0.5f;
        mark.GrowHorizontal = GrowDirection.Begin;
        mark.GrowVertical = GrowDirection.Both;
        mark.OffsetLeft = mark.OffsetRight = -40;
        AddChild(mark);

        var center = new CenterContainer { MouseFilter = MouseFilterEnum.Ignore };
        center.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        AddChild(center);
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 56);
        center.AddChild(row);

        _left = UiKit.Column(14);
        _left.CustomMinimumSize = new Vector2(420, 0);
        row.AddChild(_left);
        _right = UiKit.Column(10);
        _right.CustomMinimumSize = new Vector2(520, 0);
        row.AddChild(_right);

        BuildMenu();
        if (_creating) BuildCreation();
    }

    /// <summary>Open the character-creation card (also used by the smoke test).</summary>
    public void ShowCreation()
    {
        _creating = true;
        Build();
    }

    private void BuildMenu()
    {
        var seal = UiKit.Seal("修", 72);
        seal.SizeFlagsHorizontal = SizeFlags.ShrinkBegin;
        _left.AddChild(seal);
        _left.AddChild(UiKit.Label("Tu Tiên Lục", 64, Ink.InkColor));
        _left.AddChild(UiKit.Han("修 仙 錄", 26, Ink.CinnabarDeep));
        _left.AddChild(UiKit.Label(T("Một đời tu tiên giữa thế giới sống động — vùng Thanh Vân (bản greybox).",
            "A cultivation life in a living world — the Thanh Vân region (greybox slice)."), 17, Ink.InkMute, wrap: true));
        _left.AddChild(UiKit.Spacer(10));

        if (Game.Instance.HasSave)
            _left.AddChild(Wide(UiKit.Button(T("Tiếp tục đạo đồ", "Continue your path"), Continue, primary: true)));
        _left.AddChild(Wide(UiKit.Button(T("Khởi đầu kiếp mới", "Begin a new life"), ShowCreation, primary: !Game.Instance.HasSave)));
        _left.AddChild(Wide(UiKit.Button(Game.Instance.Locale == Locale.Vi ? "English" : "Tiếng Việt",
            () => Game.Instance.SetLocale(Game.Instance.Locale == Locale.Vi ? Locale.En : Locale.Vi))));
        _left.AddChild(Wide(UiKit.Button(T("Thoát", "Quit"), () => GetTree().Quit())));
        _left.AddChild(UiKit.Spacer(10));
        _left.AddChild(UiKit.Label(T("Godot 4.7 + C# · quy tắc trong TuTien.Core · xem design/GAME_DESIGN.md",
            "Godot 4.7 + C# · rules in TuTien.Core · see design/GAME_DESIGN.md"), 13, Ink.InkFaint, wrap: true));
    }

    private static Control Wide(Control c)
    {
        c.CustomMinimumSize = new Vector2(320, 44);
        c.SizeFlagsHorizontal = SizeFlags.ShrinkBegin;
        return c;
    }

    private void Continue()
    {
        if (Game.Instance.LoadGame()) Main.Instance.ShowWorld();
        else Game.Instance.Toast("Không đọc được bản lưu.", "Could not read the save.");
    }

    private void BuildCreation()
    {
        var card = UiKit.Column(10);
        _right.AddChild(UiKit.Card(card, 22));
        card.AddChild(UiKit.Label(T("Khai sinh đạo đồ", "A new cultivator"), 28, Ink.InkColor));
        card.AddChild(UiKit.Rule());

        card.AddChild(UiKit.Caption(T("Danh tính", "Name")));
        var nameRow = new HBoxContainer();
        var nameEdit = new LineEdit { Text = _name, MaxLength = 24, CustomMinimumSize = new Vector2(300, 0) };
        nameEdit.TextChanged += text => _name = text;
        nameRow.AddChild(nameEdit);
        nameRow.AddChild(UiKit.Button(T("Ngẫu nhiên", "Random"), () =>
        {
            _name = RandomName();
            Build();
        }));
        card.AddChild(nameRow);

        card.AddChild(UiKit.Caption(T("Tuổi", "Age")));
        var ageRow = new HBoxContainer();
        foreach (var age in new[] { 14, 16, 18, 20 })
        {
            var a = age;
            ageRow.AddChild(UiKit.Button(age.ToString(), () =>
            {
                _age = a;
                Build();
            }, primary: _age == age));
        }
        ageRow.AddChild(UiKit.Label(T("  (trẻ hơn: nhiều thọ nguyên hơn)", "  (younger: more lifespan)"), 14, Ink.InkMute));
        card.AddChild(ageRow);

        card.AddChild(UiKit.Caption(T("Linh căn", "Spirit root")));
        var rootRow = new HBoxContainer();
        rootRow.AddThemeConstantOverride("separation", 10);
        foreach (var e in _root.Elements) rootRow.AddChild(UiKit.Seal(Names.Han(e), 44, Ink.Element(e)));
        var rootText = UiKit.Column(0);
        rootText.AddChild(UiKit.Label(string.Join(" · ", _root.Elements.Select(e => Names.Display(e, Game.Instance.Locale))), 20, Ink.InkColor));
        var grade = _root.Grade;
        var gradeColor = grade >= RootGrade.Hiem ? Ink.Violet : grade == RootGrade.Kha ? Ink.JadeDeep : Ink.InkMute;
        rootText.AddChild(UiKit.Label(T($"Phẩm chất: {Names.Display(grade, Locale.Vi)} (tu luyện ×{TuTien.Core.Rules.Cultivation.RootMultiplier(grade):0.#})",
            $"Grade: {Names.Display(grade, Locale.En)} (cultivation ×{TuTien.Core.Rules.Cultivation.RootMultiplier(grade):0.#})"), 15, gradeColor));
        rootRow.AddChild(rootText);
        card.AddChild(rootRow);
        card.AddChild(UiKit.Button(T($"Thử lại linh căn (còn {MaxRerolls - _rerolls} lần)", $"Reroll the root ({MaxRerolls - _rerolls} left)"), () =>
        {
            _rerolls += 1;
            _root = WorldGen.RollRoot(Seeds.Stream(_seed, "root", _rerolls));
            Build();
        }, enabled: _rerolls < MaxRerolls));
        card.AddChild(UiKit.Label(T("Linh căn quyết định linh kỹ đầu tiên và hệ Ngũ Hành hợp với ngươi.",
            "Your root decides your first spirit art and the phases that suit you."), 13, Ink.InkMute, wrap: true));

        card.AddChild(UiKit.Caption(T("Con đường", "Path")));
        var pathRow = new HBoxContainer();
        foreach (var path in new[] { CultivationPath.Qi, CultivationPath.Body, CultivationPath.Kiem })
        {
            var pth = path;
            pathRow.AddChild(UiKit.Button(Text.Path(path), () =>
            {
                _path = pth;
                Build();
            }, primary: _path == path));
        }
        card.AddChild(pathRow);
        card.AddChild(UiKit.Label(_path switch
        {
            CultivationPath.Body => T("Thể tu: thân thể như thép, phòng thủ cao; thọ nguyên ngắn hơn.", "Body: a frame like iron, high defense; a shorter life."),
            CultivationPath.Kiem => T("Kiêm tu: chia tu vi cho cả khí lẫn thể — chậm mà vững.", "Dual: cultivation split between qi and body — slow but sturdy."),
            _ => T("Khí tu: linh lực và linh kỹ Ngũ Hành, con đường chính thống.", "Qi: spiritual power and Five-Phase arts, the orthodox way."),
        }, 14, Ink.InkMute, wrap: true));

        card.AddChild(UiKit.Spacer(6));
        var go = UiKit.Button(T("Bước vào tu tiên giới", "Enter the cultivation world"), Begin, primary: true);
        go.CustomMinimumSize = new Vector2(0, 46);
        card.AddChild(go);
        card.AddChild(UiKit.Label(T($"Hạt giống thế giới: {_seed}", $"World seed: {_seed}"), 12, Ink.InkFaint));
    }

    private void Begin()
    {
        var name = string.IsNullOrWhiteSpace(_name) ? "Vô Danh" : _name.Trim();
        Game.Instance.NewGame(name, _age, _root, _path, _seed);
        Main.Instance.ShowWorld();
    }
}
