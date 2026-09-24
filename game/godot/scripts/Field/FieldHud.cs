using System;
using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Combat;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.World;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.Field;

/// <summary>
/// Everything on the glass over a field: who you are (bars), when it is (month, footwork), where you are
/// (the minimap), what you can do (icons, the skill bar), what just happened (log, toasts, banners, the
/// cards after a fight or a month). Mostly drawn directly; the icons and toasts are real controls.
/// </summary>
public partial class FieldHud : Control
{
    private sealed class Card
    {
        public string Glyph = "";
        public string Title = "";
        public Color Color = Ink.InkColor;
        public readonly List<(string Text, Color Color)> Lines = new();
        public float Time;
        public float Max;
    }

    private readonly FieldScreen _f;
    private VBoxContainer _toasts = null!;
    private GridContainer _icons = null!;
    private Button _breakthrough = null!;
    private Minimap? _minimap;

    private string _banner = "";
    private string _bannerSub = "";
    private Color _bannerColor = Ink.InkColor;
    private float _bannerTime;
    private Card? _result;
    private Card? _month;
    private float _clock;
    /// <summary>Whether the icons were built finger-sized (rebuilt when touch controls are switched).</summary>
    private bool _builtForTouch;

    public FieldHud(FieldScreen field) => _f = field;

    private static GameEngine E => Game.Instance.Engine!;
    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    public override void _Ready()
    {
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        MouseFilter = MouseFilterEnum.Ignore;
        Build();
        Game.Instance.Toasted += OnToast;
        Game.Instance.LocaleChanged += Rebuild;
        Game.Instance.StateChanged += OnStateChanged;
    }

    public override void _ExitTree()
    {
        Game.Instance.Toasted -= OnToast;
        Game.Instance.LocaleChanged -= Rebuild;
        Game.Instance.StateChanged -= OnStateChanged;
    }

    private void Rebuild()
    {
        UiKit.Clear(this);
        _minimap = null;
        Build();
    }

    private void OnStateChanged()
    {
        if (!IsInsideTree() || Game.Instance.Engine == null) return;
        _breakthrough.Visible = E.BreakthroughReady && _f.Battle == null && _f is WorldScreen;
        _minimap?.Refresh();
    }

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

    private void Build()
    {
        _builtForTouch = TouchUi.Active;
        var right = new VBoxContainer { MouseFilter = MouseFilterEnum.Ignore };
        right.AddThemeConstantOverride("separation", 8);
        if (_f is WorldScreen world)
        {
            _minimap = new Minimap(world) { CustomMinimumSize = new Vector2(252, 160), SizeFlagsHorizontal = SizeFlags.ShrinkEnd };
            right.AddChild(_minimap);
        }
        // One row under the minimap; two rows of finger-sized icons with touch controls.
        _icons = new GridContainer { MouseFilter = MouseFilterEnum.Ignore, Columns = _builtForTouch ? 4 : 8, SizeFlagsHorizontal = SizeFlags.ShrinkEnd };
        _icons.AddThemeConstantOverride("h_separation", 4);
        _icons.AddThemeConstantOverride("v_separation", 4);
        right.AddChild(_icons);
        if (_f is WorldScreen w)
        {
            Icon("人", T("Nhân vật [C]", "Character [C]"), () => _f.OpenPanel(new CharacterPanel()));
            Icon("囊", T("Hành trang [I]", "Inventory [I]"), () => _f.OpenPanel(new InventoryPanel()));
            Icon("錄", T("Sổ tay [J]", "Journal [J]"), () => _f.OpenPanel(new JournalPanel()));
            Icon("圖", T("Bản đồ [M]", "Map [M]"), () => _f.OpenPanel(new MapPanel(w)));
            Icon("閉", T("Bế quan [B]", "Seclusion [B]"), () => _f.OpenPanel(new SeclusionPanel()));
            Icon("識", T("Thần thức [Tab] — 10 linh lực", "Sense pulse [Tab] — 10 Qi"), w.Pulse);
            Icon("月", T("Qua tháng sớm [N]", "End the month early [N]"), w.EndMonth);
            Icon("系", T("Hệ thống [Esc]", "System [Esc]"), () => _f.OpenPanel(new SystemPanel()));
        }
        else
        {
            Icon("人", T("Nhân vật", "Character"), () => _f.OpenPanel(new CharacterPanel()));
            Icon("囊", T("Hành trang", "Inventory"), () => _f.OpenPanel(new InventoryPanel()));
            Icon("系", T("Hệ thống [Esc]", "System [Esc]"), () => _f.OpenPanel(new SystemPanel()));
        }
        _breakthrough = UiKit.Button(T("✦ Đột phá cảnh giới", "✦ Break through"), () => _f.OpenPanel(new BreakthroughPanel()), primary: true);
        _breakthrough.AddThemeStyleboxOverride("normal", Ink.Box(Ink.Cinnabar, Ink.CinnabarDeep, 1, 2, 10));
        _breakthrough.AddThemeStyleboxOverride("hover", Ink.Box(Ink.CinnabarDeep, Ink.CinnabarDeep, 1, 2, 10));
        right.AddChild(_breakthrough);
        AddChild(Pin(right, 1, 0, -16, 14));

        _toasts = new VBoxContainer { MouseFilter = MouseFilterEnum.Ignore, CustomMinimumSize = new Vector2(520, 0) };
        _toasts.AddThemeConstantOverride("separation", 6);
        AddChild(Pin(_toasts, 0.5f, 0, 0, 100));
        OnStateChanged();
    }

    private void Icon(string glyph, string tip, Action act)
    {
        // Finger-sized with touch controls.
        var touch = TouchUi.Active;
        var b = new Button { Text = glyph, TooltipText = tip, FocusMode = FocusModeEnum.None, CustomMinimumSize = touch ? new Vector2(46, 50) : new Vector2(30, 34) };
        b.AddThemeFontOverride("font", Ink.Han);
        b.AddThemeFontSizeOverride("font_size", touch ? 26 : 18);
        b.AddThemeStyleboxOverride("normal", Ink.Box(new Color(Ink.Card, 0.92f), Ink.LineStrong, 1, 3, 4));
        b.AddThemeStyleboxOverride("hover", Ink.Box(Ink.PaperDeep, Ink.InkColor, 1, 3, 4));
        b.AddThemeStyleboxOverride("pressed", Ink.Box(Ink.InkColor, Ink.InkColor, 1, 3, 4));
        b.AddThemeColorOverride("font_color", Ink.InkColor);
        b.Pressed += () =>
        {
            if (_f.Battle != null || _f.Frozen) return;
            Audio.SoundBoard.Play("click", -8);
            act();
        };
        _icons.AddChild(b);
    }

    // ================================================================ notices from the field

    public void Banner(string text, string sub, Color color, float seconds)
    {
        _banner = text;
        _bannerSub = sub;
        _bannerColor = color;
        _bannerTime = seconds;
    }

    /// <summary>After a fight: a card with what it paid (non-blocking, fades by itself).</summary>
    public void ShowResult(CombatResolution res, CombatOutcome outcome, string title)
    {
        var card = new Card
        {
            Glyph = outcome.Fled ? "遁" : outcome.Victory ? "勝" : "敗",
            Title = outcome.Fled ? T("Thoát thân", "Escaped") : outcome.Victory ? T("Thắng trận", "Victory") : T("Bại trận", "Defeat"),
            Color = outcome.Victory ? Ink.JadeDeep : outcome.Fled ? Ink.InkSoft : Ink.CinnabarDeep,
            Time = 7, Max = 7,
        };
        if (title.Length > 0) card.Lines.Add((title, Ink.InkMute));
        if (res.Exp > 0) card.Lines.Add((T($"Tu vi +{res.Exp}", $"Cultivation +{res.Exp}"), Ink.JadeDeep));
        var loot = res.Loot;
        if (loot.Silver > 0 || loot.SpiritStones > 0 || loot.Items.Count > 0)
            card.Lines.Add((RealmPanel.Loot(loot, Game.Instance.Locale), Ink.GoldDeep));
        foreach (var e in res.Events.Take(4))
            card.Lines.Add((e.Localized(Game.Instance.Locale), e.Level == EventLevel.Warning ? Ink.CinnabarDeep : e.Level == EventLevel.Major ? Ink.JadeDeep : Ink.InkSoft));
        _result = card;
    }

    /// <summary>The month turned while you walked: a card under the date.</summary>
    public void ShowMonth(MonthReport report)
    {
        var card = new Card
        {
            Glyph = "月", Title = Ui.Text.Date(E.State.Calendar), Color = Ink.InkColor, Time = 6.5f, Max = 6.5f,
        };
        card.Lines.Add((T($"Tu vi +{report.TotalExp}", $"Cultivation +{report.TotalExp}"), Ink.JadeDeep));
        foreach (var e in report.Events.Where(e => e.Level != EventLevel.Info).Take(3))
            card.Lines.Add((e.Localized(Game.Instance.Locale), e.Level == EventLevel.Warning ? Ink.CinnabarDeep : Ink.JadeDeep));
        var rumor = report.Rumors.FirstOrDefault();
        if (rumor != null) card.Lines.Add(("「" + T(rumor.Text, rumor.TextEn) + "」", Ink.Violet));
        _month = card;
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

    // ================================================================ drawing

    public override void _Process(double delta)
    {
        var dt = (float)delta;
        _clock += dt;
        if (TouchUi.Active != _builtForTouch) Rebuild();
        _bannerTime = Mathf.Max(0, _bannerTime - dt);
        if (_result != null && (_result.Time -= dt) <= 0) _result = null;
        if (_month != null && (_month.Time -= dt) <= 0) _month = null;
        var inBattle = _f.Battle != null;
        _icons.Visible = !inBattle;
        if (_minimap != null) _minimap.Visible = !inBattle || GetViewportRect().Size.Y > 1000;
        QueueRedraw();
    }

    public override void _Draw()
    {
        if (Game.Instance.Engine == null || _f.Player == null) return;
        var size = Size;
        // With touch controls the stick and buttons take the bottom corners: no skill bar or key hints there,
        // and the log moves up under the character card.
        var touch = TouchUi.Active;
        var whoBottom = Who(new Vector2(16, 14));
        When(size);
        if (_f.Battle is { } battle)
        {
            BossBar(size, battle);
            Flee(size, battle);
        }
        if (_f is TrialBase trial) trial.DrawHud(this, size);
        else if (!touch) SkillBar(size);
        Log(size, touch ? whoBottom + 10 : null);
        if (_month != null) DrawCard(_month, new Vector2(size.X / 2 - 210, _f.Battle != null ? 130 : 92), 420);
        if (_result != null) DrawCard(_result, touch ? new Vector2(size.X / 2 - 190, 96) : new Vector2(size.X - 396, size.Y / 2 - 60), 380);
        if (touch) TouchHint(size);
        else Hint(size);
        Banner(size);
    }

    private void Panel(Rect2 r, float alpha = 0.9f)
    {
        DrawRect(r, new Color(Ink.Card, alpha));
        DrawRect(r, new Color(Ink.LineStrong, 0.9f), false, 1);
    }

    public void Bar(Vector2 pos, float w, float h, float value, float max, Color fill, string label, bool glow = false)
    {
        DrawRect(new Rect2(pos, new Vector2(w, h)), Ink.PaperDarker);
        DrawRect(new Rect2(pos, new Vector2(w * Mathf.Clamp(max <= 0 ? 0 : value / max, 0, 1), h)), fill);
        DrawRect(new Rect2(pos, new Vector2(w, h)), glow ? Ink.Violet : Ink.LineStrong, false, glow ? 2 : 1);
        if (label.Length > 0) DrawString(Ink.UiFont, pos + new Vector2(6, h - Mathf.Max(2, (h - 10) / 2)), label, HorizontalAlignment.Left, -1, h >= 13 ? 12 : 10, Ink.InkColor);
    }

    private void Text(string text, Vector2 pos, int size, Color color, Font? font = null) =>
        DrawString(font ?? Ink.Serif, pos, text, HorizontalAlignment.Left, -1, size, color);

    private float Width(string text, int size, Font? font = null) =>
        (font ?? Ink.Serif).GetStringSize(text, HorizontalAlignment.Left, -1, size).X;

    /// <summary>The cultivator's card, top left; returns where it ends.</summary>
    private float Who(Vector2 at)
    {
        var pc = _f.Player;
        var body = pc.Body;
        var p = E.Player;
        var inBattle = _f.Battle != null;
        var height = 104 + (pc.QiMax > 0 ? 18 : 0) + (inBattle ? 30 : 0);
        Panel(new Rect2(at - new Vector2(6, 4), new Vector2(344, height)));

        var seal = new Rect2(at + new Vector2(2, 2), new Vector2(42, 42));
        DrawRect(seal, Ink.Cinnabar);
        DrawRect(seal.Grow(-3), new Color(Ink.Card, 0.8f), false, 1.2f);
        var gs = Ink.Han.GetStringSize("吾", HorizontalAlignment.Left, -1, 24);
        DrawString(Ink.Han, seal.GetCenter() + new Vector2(-gs.X / 2, 9), "吾", HorizontalAlignment.Left, -1, 24, Ink.Card);

        Text(p.Name, at + new Vector2(54, 20), 20, Ink.InkColor);
        Text(Ui.Text.Realm(p.Realm, p.Stage), at + new Vector2(54, 42), 15, Ink.Realm(p.Realm).Darkened(0.25f));
        var han = Names.Han(p.Realm);
        DrawString(Ink.Han, at + new Vector2(330 - Width(han, 16, Ink.Han), 20), han, HorizontalAlignment.Left, -1, 16, Ink.InkFaint);

        var y = at.Y + 52;
        Bar(new Vector2(at.X, y), 330, 15, body.Hp, body.HpMax, Ink.Cinnabar, T($"Khí huyết {Mathf.Ceil(body.Hp)}/{body.HpMax}", $"Health {Mathf.Ceil(body.Hp)}/{body.HpMax}"));
        y += 19;
        if (pc.QiMax > 0)
        {
            Bar(new Vector2(at.X, y), 330, 13, pc.Qi, pc.QiMax, Ink.WaterBlue, T($"Linh lực {pc.Qi:0}/{pc.QiMax}", $"Qi {pc.Qi:0}/{pc.QiMax}"));
            y += 17;
        }
        if (inBattle)
        {
            Bar(new Vector2(at.X, y), 330, 11, pc.Stamina, pc.StaminaMax, Ink.Gold, T("Thể lực", "Stamina"));
            y += 15;
            var full = pc.Intent >= 100;
            var pulse = full ? 0.75f + 0.25f * Mathf.Sin(_clock * 8) : 1f;
            Bar(new Vector2(at.X, y), 330, 11, pc.Intent, 100, new Color(Ink.Violet, pulse), full ? T("Sát ý đầy — R", "Killing intent full — R") : T("Sát ý", "Killing intent"), full);
            y += 15;
        }
        var need = Progression.RequiredExp(E.Content, p.Realm, p.Stage);
        var expLabel = p.PendingMajorBreakthrough ? T("Tu vi viên mãn — có thể đột phá", "Cultivation full — ready to break through")
            : need == long.MaxValue ? T("Tu vi: đỉnh phong", "Cultivation: peak")
            : T($"Tu vi {p.Exp}/{need}", $"Cultivation {p.Exp}/{need}");
        var expFrac = p.PendingMajorBreakthrough || need == long.MaxValue ? 1 : (float)p.Exp / Math.Max(1, need);
        Bar(new Vector2(at.X, y), 330, 11, expFrac, 1, p.PendingMajorBreakthrough ? Ink.Gold : Ink.Jade, expLabel, p.PendingMajorBreakthrough);
        y += 15;
        if (body.Shield > 0) Text(T($"Hộ thể {body.Shield:0}", $"Shield {body.Shield:0}"), new Vector2(at.X + 250, at.Y + 42), 13, Ink.JadeDeep, Ink.UiFont);
        return at.Y - 4 + height;
    }

    private void When(Vector2 size)
    {
        var c = E.State.Calendar;
        var p = E.Player;
        var season = Calendar.SeasonOf(E.Content, c.Month);
        var date = Ui.Text.Date(c) + " · " + Calendar.SeasonName(season, Game.Instance.Locale);
        var place = _f.PlaceName;
        var sub = _f.PlaceSub;
        var w = Mathf.Max(360, Mathf.Max(Width(date, 20), Width(place + "   " + sub, 14, Ink.UiFont)) + 40);
        var r = new Rect2(size.X / 2 - w / 2, 10, w, 72);
        Panel(r);
        Text(date, new Vector2(size.X / 2 - Width(date, 20) / 2, r.Position.Y + 25), 20, Ink.InkColor);
        var line = sub.Length > 0 ? place + "  ·  " + sub : place;
        Text(line, new Vector2(size.X / 2 - Width(line, 13, Ink.UiFont) / 2, r.Position.Y + 43), 13, Ink.JadeDeep, Ink.UiFont);
        var special = Calendar.SpecialMonth(c.Month);
        if (_f is WorldScreen)
        {
            // Footwork is the month's days of travel; when it runs out the month turns by itself.
            var low = p.Footwork <= 3;
            Bar(new Vector2(r.Position.X + 14, r.Position.Y + 52), w - 28, 12, p.Footwork, p.FootworkMax, low ? Ink.Cinnabar : Ink.GoldDeep,
                T($"足 Cước lực {p.Footwork}/{p.FootworkMax} — ngày {Calendar.DisplayDay(p)} của tháng", $"足 Footwork {p.Footwork}/{p.FootworkMax} — day {Calendar.DisplayDay(p)} of the month"));
        }
        else if (special.bonus > 0)
        {
            var s = T($"{special.vi}: tu luyện +{special.bonus}%", $"{special.en}: cultivation +{special.bonus}%");
            Text(s, new Vector2(size.X / 2 - Width(s, 13, Ink.UiFont) / 2, r.Position.Y + 62), 13, Ink.GoldDeep, Ink.UiFont);
        }
    }

    private void BossBar(Vector2 size, Battle battle)
    {
        var boss = battle.Enemies.FirstOrDefault(e => e.Active && (e.Archetype is "boss" or "serpent" || e.HpMax >= 300));
        if (boss == null) return;
        var w = 560f;
        var pos = new Vector2(size.X / 2 - w / 2, 110);
        Panel(new Rect2(pos - new Vector2(10, 22), new Vector2(w + 20, 44)));
        Text(boss.Name + (boss.Enraged ? T(" — cuồng nộ", " — enraged") : ""), pos + new Vector2(0, -5), 16, boss.Enraged ? Ink.Cinnabar : Ink.InkColor);
        Bar(pos, w, 14, boss.Hp, boss.HpMax, Ink.Cinnabar, $"{Mathf.Ceil(boss.Hp)}/{boss.HpMax}");
    }

    private void Flee(Vector2 size, Battle battle)
    {
        if (battle.FleeProgress <= 0 || battle.Over) return;
        var w = 260f;
        var pos = new Vector2(size.X / 2 - w / 2, size.Y - 150);
        Panel(new Rect2(pos - new Vector2(8, 20), new Vector2(w + 16, 36)));
        Text(T("Thoát thân…", "Getting away…"), pos + new Vector2(0, -5), 14, Ink.InkSoft, Ink.UiFont);
        Bar(pos, w, 9, battle.FleeProgress, 1, Ink.InkSoft, "");
    }

    private void SkillBar(Vector2 size)
    {
        var pc = _f.Player;
        const float box = 56, gap = 8;
        var slots = new (string Key, SkillDef? Skill, string Fallback)[]
        {
            (T("Trái", "LMB"), pc.Basic, ""),
            (T("Phải", "RMB"), pc.SlotSkill(0), ""),
            (KeyMap.Label("skill_2"), pc.SlotSkill(1), ""),
            (KeyMap.Label("skill_3"), pc.SlotSkill(2), ""),
            (KeyMap.Label("skill_4"), pc.SlotSkill(3), ""),
            (KeyMap.Label("ultimate"), pc.Ultimate, ""),
            (KeyMap.Label("pill"), null, "丹"),
            (KeyMap.Label("dash"), null, "遁"),
        };
        var total = slots.Length * box + (slots.Length - 1) * gap;
        var x0 = size.X / 2 - total / 2;
        var y = size.Y - box - 30;
        Panel(new Rect2(x0 - 10, y - 8, total + 20, box + 30), 0.86f);
        for (var i = 0; i < slots.Length; i++)
        {
            var (key, skill, fallback) = slots[i];
            var r = new Rect2(x0 + i * (box + gap), y, box, box);
            var usable = true;
            float cdFrac = 0;
            string glyph, name, cost = "";
            var color = Ink.InkColor;
            if (i == 6)
            {
                var (_, count) = pc.Pill();
                glyph = fallback;
                name = count > 0 ? $"×{count}" : "—";
                usable = count > 0 && pc.PillCd <= 0;
                cdFrac = Mathf.Clamp(pc.PillCd / 5f, 0, 1);
                color = Ink.Jade;
            }
            else if (i == 7)
            {
                glyph = fallback;
                name = T("Lướt", "Dash");
                usable = pc.Stamina >= PlayerController.DashCost;
                cost = $"{PlayerController.DashCost:0}";
                color = Ink.GoldDeep;
            }
            else if (skill == null)
            {
                glyph = "";
                name = T("trống", "empty");
                usable = false;
            }
            else
            {
                glyph = skill.Glyph;
                name = T(skill.Name, skill.NameEn);
                var left = pc.CooldownLeft(skill.Id);
                cdFrac = skill.Cooldown > 0 ? Mathf.Clamp(left / (float)skill.Cooldown, 0, 1) : 0;
                if (i == 5)
                {
                    cdFrac = 1 - Mathf.Clamp(pc.Intent / 100f, 0, 1);
                    usable = pc.Intent >= 100;
                    color = Ink.Violet;
                }
                else
                {
                    var qi = pc.QiCost(skill);
                    usable = qi <= pc.Qi;
                    if (qi > 0) cost = qi.ToString();
                    if (skill.Element != null) color = Ink.Element(skill.Element.Value);
                }
            }

            DrawRect(r, usable ? Ink.Card : Ink.PaperDeep);
            DrawRect(r, usable ? color : Ink.LineStrong, false, usable ? 2 : 1);
            if (glyph.Length > 0)
            {
                var gs = Ink.Han.GetStringSize(glyph, HorizontalAlignment.Left, -1, 27);
                DrawString(Ink.Han, r.GetCenter() + new Vector2(-gs.X / 2, 10), glyph, HorizontalAlignment.Left, -1, 27, usable ? color : Ink.InkFaint);
            }
            if (cdFrac > 0) DrawRect(new Rect2(r.Position, new Vector2(box, box * cdFrac)), new Color(Ink.InkColor, 0.45f));
            DrawString(Ink.UiFont, r.Position + new Vector2(4, 12), key, HorizontalAlignment.Left, -1, 10, Ink.InkMute);
            if (cost.Length > 0) DrawString(Ink.UiFont, r.Position + new Vector2(box - 20, box - 4), cost, HorizontalAlignment.Left, -1, 10, Ink.WaterBlue);
            var shown = name.Length > 10 ? name[..9] + "…" : name;
            var ns = Ink.UiFont.GetStringSize(shown, HorizontalAlignment.Left, -1, 10);
            DrawString(Ink.UiFont, new Vector2(r.GetCenter().X - ns.X / 2, r.End.Y + 13), shown, HorizontalAlignment.Left, -1, 10, Ink.InkSoft);
        }
    }

    /// <summary>The latest messages and rumor: bottom left, or from <paramref name="top"/> down (touch controls).</summary>
    private void Log(Vector2 size, float? top)
    {
        var log = Game.Instance.Log;
        var lines = log.Skip(Math.Max(0, log.Count - (top != null ? 2 : 4))).ToList();
        var rumors = E.State.World.Rumors;
        var rumor = rumors.Count > 0 ? rumors[^1] : null;
        var count = lines.Count + (rumor != null ? 1 : 0);
        if (count == 0) return;
        var w = top != null ? 344f : 440f;
        var h = 16 + count * 19;
        var pos = top is { } y0 ? new Vector2(10, y0) : new Vector2(16, size.Y - 34 - h);
        Panel(new Rect2(pos, new Vector2(w, h)), 0.82f);
        var y = pos.Y + 18;
        foreach (var (text, level) in lines)
        {
            var color = level == EventLevel.Major ? Ink.JadeDeep : level == EventLevel.Warning ? Ink.CinnabarDeep : Ink.InkSoft;
            Text(Clip("· " + text, 14, w - 18), new Vector2(pos.X + 9, y), 14, color);
            y += 19;
        }
        if (rumor != null) Text(Clip("「" + T(rumor.Text, rumor.TextEn) + "」", 14, w - 18), new Vector2(pos.X + 9, y), 14, Ink.Violet);
    }

    private string Clip(string text, int size, float max)
    {
        if (Width(text, size) <= max) return text;
        var cut = text;
        while (cut.Length > 4 && Width(cut + "…", size) > max) cut = cut[..^1];
        return cut + "…";
    }

    private void Hint(Vector2 size)
    {
        var hint = _f.HintText();
        // Bottom right, clear of the log (left) and the skill bar (centre); two lines when it's long.
        var parts = hint.Split(" · ");
        var half = (parts.Length + 1) / 2;
        var lines = parts.Length > 3 ? new[] { string.Join(" · ", parts.Take(half)), string.Join(" · ", parts.Skip(half)) } : new[] { hint };
        var widest = lines.Max(l => Width(l, 12, Ink.UiFont));
        DrawRect(new Rect2(size.X - 24 - widest, size.Y - 10 - lines.Length * 16, widest + 16, lines.Length * 16 + 6), new Color(Ink.Card, 0.72f));
        for (var i = 0; i < lines.Length; i++)
        {
            var w = Width(lines[i], 12, Ink.UiFont);
            var y = size.Y - 12 - (lines.Length - 1 - i) * 16;
            DrawString(Ink.UiFont, new Vector2(size.X - 16 - w, y), lines[i], HorizontalAlignment.Left, -1, 12, Ink.InkSoft);
        }
    }

    /// <summary>With touch controls: what the thumbs do, small, at the bottom between the stick and the buttons.</summary>
    private void TouchHint(Vector2 size)
    {
        var left = 300f;
        var right = size.X - 530;
        var width = right - left;
        if (width < 200) return;
        var lines = new List<string>();
        var line = "";
        foreach (var part in _f.HintText().Split(" · "))
        {
            var next = line.Length == 0 ? part : line + " · " + part;
            if (line.Length > 0 && Width(next, 12, Ink.UiFont) > width)
            {
                lines.Add(line);
                line = part;
            }
            else
            {
                line = next;
            }
        }
        if (line.Length > 0) lines.Add(line);
        if (lines.Count > 4) lines = lines.Take(4).ToList();
        var y = size.Y - 14 - (lines.Count - 1) * 16;
        foreach (var text in lines)
        {
            var w = Width(text, 12, Ink.UiFont);
            var x = left + (width - w) / 2;
            DrawRect(new Rect2(x - 6, y - 12, w + 12, 16), new Color(Ink.Card, 0.7f));
            DrawString(Ink.UiFont, new Vector2(x, y), text, HorizontalAlignment.Left, -1, 12, Ink.InkSoft);
            y += 16;
        }
    }

    private void DrawCard(Card card, Vector2 pos, float w)
    {
        var alpha = Mathf.Clamp(card.Time / 0.6f, 0, 1) * Mathf.Clamp((card.Max - card.Time) / 0.25f, 0, 1);
        var lines = card.Lines.Select(l => (Text: Clip(l.Text, 15, w - 70), l.Color)).ToList();
        var h = 50 + lines.Count * 21;
        var r = new Rect2(pos, new Vector2(w, h));
        DrawRect(r, new Color(Ink.Card, 0.95f * alpha));
        DrawRect(r, new Color(card.Color, alpha), false, 2);
        var seal = new Rect2(pos + new Vector2(12, 12), new Vector2(34, 34));
        DrawRect(seal, new Color(card.Color, alpha));
        var gs = Ink.Han.GetStringSize(card.Glyph, HorizontalAlignment.Left, -1, 20);
        DrawString(Ink.Han, seal.GetCenter() + new Vector2(-gs.X / 2, 7), card.Glyph, HorizontalAlignment.Left, -1, 20, new Color(Ink.Card, alpha));
        Text(card.Title, pos + new Vector2(58, 34), 21, new Color(card.Color, alpha));
        var y = pos.Y + 66;
        foreach (var (text, color) in lines)
        {
            Text(text, new Vector2(pos.X + 58, y), 15, new Color(color, alpha));
            y += 21;
        }
    }

    private void Banner(Vector2 size)
    {
        if (_bannerTime <= 0 || _banner.Length == 0) return;
        var alpha = Mathf.Clamp(_bannerTime * 2.5f, 0, 1);
        var font = Ink.Serif;
        var s = font.GetStringSize(_banner, HorizontalAlignment.Left, -1, 70);
        var center = new Vector2(size.X / 2, size.Y * 0.36f);
        DrawRect(new Rect2(0, center.Y - 64, size.X, _bannerSub.Length > 0 ? 120 : 92), new Color(Ink.Card, 0.66f * alpha));
        DrawStringOutline(font, center - new Vector2(s.X / 2, -10), _banner, HorizontalAlignment.Left, -1, 70, 8, new Color(Ink.Card, alpha));
        DrawString(font, center - new Vector2(s.X / 2, -10), _banner, HorizontalAlignment.Left, -1, 70, new Color(_bannerColor, alpha));
        if (_bannerSub.Length == 0) return;
        var ss = font.GetStringSize(_bannerSub, HorizontalAlignment.Left, -1, 21);
        DrawString(font, center + new Vector2(-ss.X / 2, 44), _bannerSub, HorizontalAlignment.Left, -1, 21, new Color(Ink.InkSoft, alpha));
    }
}
