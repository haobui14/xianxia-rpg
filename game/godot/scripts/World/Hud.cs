using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Rules;
using TuTien.Core.World;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.World;

/// <summary>
/// The world-map HUD: who you are (realm, bars), when it is (month, footwork), what you own,
/// the month's buttons, a message log with rumors, and what the hovered tile costs.
/// </summary>
public partial class Hud : Control
{
    private readonly WorldScreen _world;
    private GameEngine E => Game.Instance.Engine!;
    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    private Label _name = null!, _sub = null!, _realm = null!, _realmHan = null!, _body = null!;
    private Meter _exp = null!, _bodyExp = null!, _hp = null!, _qi = null!, _footwork = null!;
    private Label _date = null!, _season = null!, _special = null!;
    private Label _wealth = null!, _karma = null!, _life = null!, _sect = null!, _zone = null!;
    private Button _breakthrough = null!;
    private VBoxContainer _log = null!, _toasts = null!;
    private Label _tile = null!, _hint = null!;
    private PanelContainer _tileCard = null!;

    public Hud(WorldScreen world) => _world = world;

    public override void _Ready()
    {
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        MouseFilter = MouseFilterEnum.Ignore;
        Build();
        Game.Instance.StateChanged += Refresh;
        Game.Instance.LocaleChanged += Rebuild;
        Game.Instance.Toasted += OnToast;
    }

    public override void _ExitTree()
    {
        Game.Instance.StateChanged -= Refresh;
        Game.Instance.LocaleChanged -= Rebuild;
        Game.Instance.Toasted -= OnToast;
    }

    private void Rebuild()
    {
        UiKit.Clear(this);
        Build();
    }

    /// <summary>Anchor a control to a point on the screen; it grows away from the nearest edges.</summary>
    private static TControl Pin<TControl>(TControl c, float ax, float ay, float x, float y) where TControl : Control
    {
        c.AnchorLeft = c.AnchorRight = ax;
        c.AnchorTop = c.AnchorBottom = ay;
        c.GrowHorizontal = ax >= 1 ? GrowDirection.Begin : ax > 0 ? GrowDirection.Both : GrowDirection.End;
        c.GrowVertical = ay >= 1 ? GrowDirection.Begin : ay > 0 ? GrowDirection.Both : GrowDirection.End;
        c.OffsetLeft = c.OffsetRight = x;
        c.OffsetTop = c.OffsetBottom = y;
        return c;
    }

    private static PanelContainer HudCard(Control content, float alpha = 0.93f) =>
        UiKit.Card(content, 12, new Color(Ink.Card, alpha), Ink.LineStrong);

    private void Build()
    {
        // ---------------------------------------------------------------- top left: the cultivator
        var who = UiKit.Column(4);
        var head = new HBoxContainer();
        head.AddThemeConstantOverride("separation", 10);
        head.AddChild(UiKit.Seal("吾", 44));
        var names = UiKit.Column(0);
        _name = UiKit.Label("", 22, Ink.InkColor);
        _sub = UiKit.Label("", 13, Ink.InkMute);
        _sub.AddThemeFontOverride("font", Ink.UiFont);
        names.AddChild(_name);
        names.AddChild(_sub);
        head.AddChild(names);
        who.AddChild(head);
        var realmRow = new HBoxContainer();
        _realm = UiKit.Label("", 19, Ink.JadeDeep);
        _realmHan = UiKit.Han("", 18, Ink.InkFaint);
        realmRow.AddChild(_realm);
        realmRow.AddChild(UiKit.Spacer(0, expand: true));
        realmRow.AddChild(_realmHan);
        who.AddChild(realmRow);
        _exp = new Meter(T("Tu vi", "Cultivation"), Ink.Jade, 270);
        who.AddChild(_exp);
        _body = UiKit.Label("", 15, Ink.Ochre);
        who.AddChild(_body);
        _bodyExp = new Meter(T("Luyện thể", "Body tempering"), Ink.Ochre, 270);
        who.AddChild(_bodyExp);
        _hp = new Meter(T("Khí huyết", "Health"), Ink.Cinnabar, 270);
        who.AddChild(_hp);
        _qi = new Meter(T("Linh lực", "Qi"), Ink.WaterBlue, 270);
        who.AddChild(_qi);
        AddChild(Pin(HudCard(who), 0, 0, 16, 16));

        // ---------------------------------------------------------------- top center: the month
        var when = UiKit.Column(2);
        _date = UiKit.Label("", 24, Ink.InkColor);
        _date.HorizontalAlignment = HorizontalAlignment.Center;
        _season = UiKit.Label("", 14, Ink.InkMute);
        _season.HorizontalAlignment = HorizontalAlignment.Center;
        _season.AddThemeFontOverride("font", Ink.UiFont);
        _special = UiKit.Label("", 14, Ink.GoldDeep);
        _special.HorizontalAlignment = HorizontalAlignment.Center;
        when.AddChild(_date);
        when.AddChild(_season);
        when.AddChild(_special);
        _footwork = new Meter(T("Cước lực 足", "Footwork 足"), Ink.GoldDeep, 260);
        when.AddChild(_footwork);
        AddChild(Pin(HudCard(when), 0.5f, 0, 0, 16));

        _toasts = new VBoxContainer { MouseFilter = MouseFilterEnum.Ignore, CustomMinimumSize = new Vector2(520, 0) };
        _toasts.AddThemeConstantOverride("separation", 6);
        AddChild(Pin(_toasts, 0.5f, 0, 0, 150));

        // ---------------------------------------------------------------- top right: holdings + actions
        var right = new VBoxContainer { MouseFilter = MouseFilterEnum.Ignore };
        right.AddThemeConstantOverride("separation", 10);
        var own = UiKit.Column(3);
        _wealth = UiKit.Label("", 16, Ink.InkColor);
        _karma = UiKit.Label("", 15, Ink.InkSoft);
        _life = UiKit.Label("", 15, Ink.InkSoft);
        _sect = UiKit.Label("", 15, Ink.CinnabarDeep);
        _zone = UiKit.Label("", 14, Ink.JadeDeep);
        foreach (var l in new[] { _wealth, _karma, _life, _sect, _zone }) own.AddChild(l);
        var ownCard = HudCard(own);
        ownCard.CustomMinimumSize = new Vector2(250, 0);
        right.AddChild(ownCard);

        _breakthrough = UiKit.Button(T("✦ Đột phá cảnh giới", "✦ Break through"), () => _world.OpenPanel(new BreakthroughPanel()), primary: true);
        _breakthrough.AddThemeStyleboxOverride("normal", Ink.Box(Ink.Cinnabar, Ink.CinnabarDeep, 1, 2, 10));
        _breakthrough.AddThemeStyleboxOverride("hover", Ink.Box(Ink.CinnabarDeep, Ink.CinnabarDeep, 1, 2, 10));
        right.AddChild(_breakthrough);

        (string, string, System.Action)[] actions =
        {
            ("Qua tháng  [N]", "End month  [N]", () => _world.EndMonth()),
            ("Bế quan  [B]", "Seclusion  [B]", () => _world.OpenPanel(new SeclusionPanel())),
            ("Thần thức  [Tab]", "Sense pulse  [Tab]", () => _world.Pulse()),
            ("Tương tác  [E]", "Interact  [E]", () => _world.Interact()),
            ("Nhân vật  [C]", "Character  [C]", () => _world.OpenPanel(new CharacterPanel())),
            ("Hành trang  [I]", "Inventory  [I]", () => _world.OpenPanel(new InventoryPanel())),
            ("Sổ tay  [J]", "Journal  [J]", () => _world.OpenPanel(new JournalPanel())),
            ("Hệ thống  [Esc]", "System  [Esc]", () => _world.OpenPanel(new SystemPanel())),
        };
        foreach (var (vi, en, act) in actions)
        {
            var b = UiKit.Button(T(vi, en), act, primary: vi.StartsWith("Qua tháng"));
            b.Alignment = HorizontalAlignment.Left;
            right.AddChild(b);
        }
        var lang = UiKit.Button(Game.Instance.Locale == Locale.Vi ? "English" : "Tiếng Việt",
            () => Game.Instance.SetLocale(Game.Instance.Locale == Locale.Vi ? Locale.En : Locale.Vi));
        right.AddChild(lang);
        AddChild(Pin(right, 1, 0, -16, 16));

        // ---------------------------------------------------------------- bottom left: log + rumors
        _log = UiKit.Column(3);
        _log.CustomMinimumSize = new Vector2(430, 0);
        AddChild(Pin(HudCard(_log, 0.88f), 0, 1, 16, -16));

        // ---------------------------------------------------------------- bottom center: tile + hint
        var bottom = new VBoxContainer { MouseFilter = MouseFilterEnum.Ignore };
        bottom.AddThemeConstantOverride("separation", 6);
        _hint = UiKit.Label("", 17, Ink.Card);
        _hint.HorizontalAlignment = HorizontalAlignment.Center;
        var hintCard = UiKit.Card(_hint, 8, new Color(Ink.InkColor, 0.85f), Ink.InkColor);
        hintCard.MouseFilter = MouseFilterEnum.Ignore;
        bottom.AddChild(hintCard);
        _tile = UiKit.Label("", 14, Ink.InkSoft);
        _tile.AddThemeFontOverride("font", Ink.UiFont);
        _tile.HorizontalAlignment = HorizontalAlignment.Center;
        _tileCard = UiKit.Card(_tile, 6, new Color(Ink.Card, 0.9f), Ink.Line);
        _tileCard.MouseFilter = MouseFilterEnum.Ignore;
        _tileCard.Visible = false;
        bottom.AddChild(_tileCard);
        AddChild(Pin(bottom, 0.5f, 1, 0, -16));

        Refresh();
    }

    public void Refresh()
    {
        if (!IsInsideTree() || Game.Instance.Engine == null) return;
        var p = E.Player;
        var content = E.Content;

        _name.Text = p.Name;
        _sub.Text = T($"{p.Age} tuổi · linh căn {Text.Root(p.Root)}", $"Age {p.Age} · {Text.Root(p.Root)} root");
        _realm.Text = Text.Realm(p.Realm, p.Stage);
        _realm.AddThemeColorOverride("font_color", Ink.Realm(p.Realm).Darkened(0.2f));
        _realmHan.Text = Names.Han(p.Realm);

        var need = Progression.RequiredExp(content, p.Realm, p.Stage);
        if (p.PendingMajorBreakthrough)
            _exp.Set(1, 1, T("viên mãn — chờ đột phá", "full — ready to break through"));
        else if (need == long.MaxValue)
            _exp.Set(1, 1, T("đỉnh phong", "peak"));
        else
            _exp.Set(p.Exp, need);

        var bodyShown = p.Path != CultivationPath.Qi || p.BodyRealm != BodyRealm.PhamThe;
        _body.Visible = _bodyExp.Visible = bodyShown;
        if (bodyShown)
        {
            _body.Text = T("Thể: ", "Body: ") + Text.Body(p.BodyRealm, p.BodyStage);
            var bneed = Progression.RequiredBodyExp(content, p.BodyRealm, p.BodyStage);
            _bodyExp.Set(bneed == long.MaxValue ? 1 : p.BodyExp, bneed == long.MaxValue ? 1 : bneed);
        }
        _hp.Set(p.Hp, p.HpMax);
        _qi.Visible = p.QiMax > 0;
        _qi.Set(p.Qi, p.QiMax);

        var c = E.State.Calendar;
        _date.Text = Text.Date(c);
        var season = Calendar.SeasonOf(content, c.Month);
        _season.Text = T($"Mùa {Calendar.SeasonName(season, Locale.Vi)} · ngày {Calendar.DisplayDay(p)}",
            $"{Calendar.SeasonName(season, Locale.En)} · day {Calendar.DisplayDay(p)}");
        var special = Calendar.SpecialMonth(c.Month);
        _special.Visible = special.bonus > 0;
        _special.Text = T($"{special.vi}: tu luyện +{special.bonus}%", $"{special.en}: cultivation +{special.bonus}%");
        _footwork.Set(p.Footwork, p.FootworkMax);

        _wealth.Text = T($"銀 {p.Silver} bạc   石 {p.SpiritStones} linh thạch", $"銀 {p.Silver} silver   石 {p.SpiritStones} spirit stones");
        _karma.Text = T("Nhân quả: ", "Karma: ") + Text.Karma(p.Karma);
        var years = Progression.YearsLeft(content, p);
        _life.Text = T($"Thọ nguyên còn {years} năm", $"{years} years of lifespan left");
        _life.AddThemeColorOverride("font_color", years <= 10 ? Ink.Cinnabar : Ink.InkSoft);
        var sect = p.SectId != null && content.Sects.TryGetValue(p.SectId, out var s) ? s : null;
        _sect.Visible = sect != null;
        if (sect != null) _sect.Text = $"{Names.Pick(Game.Instance.Locale, sect.Name, sect.NameEn)} · {Text.Rank(p.SectRank)}";
        _zone.Text = E.ZoneHere is { } zone ? Text.Zone(zone) : "";

        _breakthrough.Visible = E.BreakthroughReady;

        RefreshLog();
        RefreshHint();
    }

    private void RefreshLog()
    {
        UiKit.Clear(_log);
        _log.AddChild(UiKit.Caption(T("Nhật ký", "Log")));
        var lines = Game.Instance.Log.Skip(System.Math.Max(0, Game.Instance.Log.Count - 5)).ToList();
        if (lines.Count == 0)
            _log.AddChild(UiKit.Label(T("Đi lại bằng WASD hoặc nhấp chuột lên bản đồ.", "Move with WASD or click the map."), 14, Ink.InkMute, wrap: true));
        foreach (var (text, level) in lines)
        {
            var color = level == EventLevel.Major ? Ink.JadeDeep : level == EventLevel.Warning ? Ink.CinnabarDeep : Ink.InkSoft;
            _log.AddChild(UiKit.Label("· " + text, 14, color, wrap: true));
        }
        var rumors = E.State.World.Rumors;
        if (rumors.Count > 0)
        {
            _log.AddChild(UiKit.Caption(T("Tin đồn giang hồ", "Rumors")));
            foreach (var r in rumors.Skip(System.Math.Max(0, rumors.Count - 2)))
                _log.AddChild(UiKit.Label("「" + Names.Pick(Game.Instance.Locale, r.Text, r.TextEn) + "」", 14, Ink.Violet, wrap: true));
        }
    }

    private void RefreshHint()
    {
        var near = E.InteractablesNear();
        var here = near.FirstOrDefault(t => t.X == E.Player.X && t.Y == E.Player.Y && t.Kind != InteractKind.Npc && t.Kind != InteractKind.Beast);
        var npc = near.FirstOrDefault(t => t.Kind == InteractKind.Npc);
        var beast = near.FirstOrDefault(t => t.Kind == InteractKind.Beast);
        string? hint = null;
        if (here != null)
        {
            var name = Names.Pick(Game.Instance.Locale, here.Name, here.NameEn);
            hint = here.Kind switch
            {
                InteractKind.Herb => here.Ready ? T($"[E] Hái {name}", $"[E] Gather {name}") : T("Dược điền đã hái — chờ mọc lại", "Picked clean — wait for regrowth"),
                InteractKind.SpiritVein => T($"[E] Bế quan tại {name}", $"[E] Seclude at {name}"),
                InteractKind.Adventure => T($"[E] Kỳ ngộ: {name}", $"[E] Encounter: {name}"),
                _ => T($"[E] Vào {name}", $"[E] Enter {name}"),
            };
        }
        else if (npc != null) hint = T($"[E] Gặp {npc.Name}", $"[E] Meet {npc.Name}");
        else if (beast != null) hint = T($"[E] Tấn công {beast.Name}", $"[E] Attack {beast.NameEn}");
        else if (E.Player.Footwork == 0) hint = T("Cước lực đã cạn — [N] qua tháng", "Out of footwork — [N] end the month");
        else if (E.BreakthroughReady) hint = T("Tu vi viên mãn — có thể đột phá!", "Cultivation full — you can break through!");
        _hint.Text = hint ?? "";
        ((Control)_hint.GetParent()).Visible = hint != null;
    }

    public void ShowTileInfo(Vector2I cell, PathResult? path)
    {
        if (!IsInsideTree()) return;
        var map = E.Map;
        if (!map.InBounds(cell.X, cell.Y) || !E.Fog().Get(cell.X, cell.Y))
        {
            _tileCard.Visible = false;
            return;
        }
        var text = Text.Terrain(map.At(cell.X, cell.Y));
        if (E.ZoneAt(cell.X, cell.Y) is { } zone) text += " · " + Text.Zone(zone);
        var step = map.StepCost(cell.X, cell.Y, E.Player);
        text += step < 0 ? T(" · không thể đi", " · impassable") : T($" · {step} 足/bước", $" · {step} 足/step");
        if (path is { Steps.Count: > 0 })
        {
            text += path.Cost <= E.Player.Footwork
                ? T($"   →   đường đi {path.Cost} 足 (còn {E.Player.Footwork})", $"   →   path {path.Cost} 足 (have {E.Player.Footwork})")
                : T($"   →   cần {path.Cost} 足, chỉ còn {E.Player.Footwork}", $"   →   needs {path.Cost} 足, only {E.Player.Footwork} left");
        }
        _tile.Text = text;
        _tileCard.Visible = true;
    }

    private void OnToast(string text, int level)
    {
        if (!IsInsideTree()) return;
        var color = (EventLevel)level switch
        {
            EventLevel.Major => Ink.Jade,
            EventLevel.Warning => Ink.Cinnabar,
            _ => Ink.LineStrong,
        };
        var label = UiKit.Label(text, 16, Ink.InkColor, wrap: true);
        label.HorizontalAlignment = HorizontalAlignment.Center;
        var card = UiKit.Card(label, 10, new Color(Ink.Card, 0.96f), color);
        card.MouseFilter = MouseFilterEnum.Ignore;
        _toasts.AddChild(card);
        while (_toasts.GetChildCount() > 4)
        {
            var old = _toasts.GetChild(0);
            _toasts.RemoveChild(old);
            old.QueueFree();
        }
        var tween = card.CreateTween();
        tween.TweenInterval(level == (int)EventLevel.Info ? 2.6 : 4.0);
        tween.TweenProperty(card, "modulate:a", 0f, 0.6f);
        tween.TweenCallback(Callable.From(card.QueueFree));
    }
}
