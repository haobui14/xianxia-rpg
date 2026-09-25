using System;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTienLuc.Art;
using TuTienLuc.Audio;

namespace TuTienLuc.Ui.Panels;

/// <summary>
/// The Hundred Herbs Hall's furnace. Pick a recipe and light the fire (the herbs, the fee and two footwork go in), then
/// keep the heat inside the band through three stages (warm the furnace, melt the herbs, condense the pill) by working
/// the bellows: each press adds heat and the fire cools by itself. Add the herbs when the furnace calls for them. Too
/// hot for too long and it blows. How long the heat stayed in the band sets the grade: ash, or one to three pills.
/// </summary>
public partial class AlchemyPanel : InkPanel
{
    private FurnaceStage? _stage;
    private (string Vi, string En)? _message;
    private Color _messageColor = Ink.InkColor;

    protected override IconKind Emblem => IconKind.Cauldron;
    protected override string TitleText => T("Bách Thảo Đường — đan lô", "Apothecary — the furnace");
    protected override Vector2 PanelSize => new(820, 720);

    /// <summary>The furnace (the smoke test hands it to the autopilot).</summary>
    public FurnaceStage? Stage => _stage;

    protected override Control CreateStage() => _stage = new FurnaceStage(this);

    public void Tell(string vi, string en, Color color)
    {
        _message = (vi, en);
        _messageColor = color;
        RequestRefresh();
    }

    protected override void Build()
    {
        var e = E;
        var p = e.Player;
        Para(T($"Dược sư Tô cho mượn lò. Tay luyện đan cấp {Alchemy.Level(p)} · đã thành đan {p.Counters.PillsBrewed} lò. Ngươi có {p.Silver} bạc, cước lực {p.Footwork}/{p.FootworkMax}.",
            $"Apothecary To lends you her furnace. Alchemy level {Alchemy.Level(p)} · {p.Counters.PillsBrewed} brews done. You have {p.Silver} silver, footwork {p.Footwork}/{p.FootworkMax}."), 15, Ink.InkColor);
        if (_message is { } m) Para(T(m.Vi, m.En), 17, _messageColor);

        Section(T("Đan phương", "Recipes"));
        var busy = _stage?.Busy == true;
        foreach (var recipe in e.Content.Recipes)
        {
            var output = e.Content.Item(recipe.Output);
            if (output == null) continue;
            var info = UiKit.Column(0);
            info.AddChild(UiKit.Label(Text.Name(output) + "  ·  " + Text.Effects(output), 16, Ink.Rarity(output.Rarity).Darkened(0.15f), wrap: true));
            var parts = recipe.Ingredients.Select(i =>
            {
                var def = e.Content.Item(i.Item);
                return $"{(def != null ? Text.Name(def) : i.Item)} {Inventory.Count(p, i.Item)}/{i.Qty}";
            });
            var needs = string.Join(" · ", parts) + T($" · {recipe.Silver} bạc", $" · {recipe.Silver} silver");
            if (recipe.Realm is { } realm) needs += T($" · cần {Text.Realm(realm, recipe.Stage)}", $" · needs {Text.Realm(realm, recipe.Stage)}");
            info.AddChild(UiKit.Label(needs, 13, Ink.InkMute, wrap: true));
            var blocked = Alchemy.Blocked(e.Content, p, recipe);
            if (blocked is { } why) info.AddChild(UiKit.Label(T(why.Vi, why.En), 13, Ink.CinnabarSoft));
            var id = recipe.Id;
            Row(info, Named(UiKit.Button(T("Luyện", "Brew"), () => Brew(id), enabled: blocked == null && !busy), "brew_" + recipe.Id));
        }
        Para(T($"Mỗi lò tốn {Alchemy.Footwork} cước lực. Giữ lửa trong vạch xanh: bấm quạt để thêm lửa, lửa tự nguội dần. Khi lò gọi thì bỏ dược liệu vào. Lửa quá vạch đỏ lâu sẽ nổ lò. Đan phẩm tùy độ tinh khiết: hạ phẩm 1 viên, trung phẩm 2, thượng phẩm 3.",
            $"Each brew costs {Alchemy.Footwork} footwork. Keep the fire inside the green band: press the bellows to add heat, and it cools by itself. When the furnace calls, add the herbs. Past the red mark for too long and it blows. Purity sets the grade: low grade makes 1 pill, middle grade 2, high grade 3."), 13, Ink.InkFaint);
        Buttons(UiKit.Button(T("Rời đi", "Leave"), Close));
    }

    private void Brew(string recipeId)
    {
        var events = E.StartBrew(recipeId);
        if (E.PendingBrew is { } recipe && _stage != null)
        {
            _stage.Begin(recipe);
            _message = null;
            SoundBoard.Play("fire", -4);
        }
        else if (events.FirstOrDefault() is { } why) Tell(why.Text, why.TextEn, Ink.CinnabarDeep);
        Game.Instance.Notify(events);
    }

    private static Button Named(Button button, string name)
    {
        button.Name = name;
        return button;
    }

    public override void Close()
    {
        // A fire left to itself burns the herbs to ash.
        _stage?.Abandon();
        base.Close();
    }
}

/// <summary>The furnace, its fire and the heat band; the bellows and the herbs.</summary>
public partial class FurnaceStage : VBoxContainer
{
    public enum Phase
    {
        Idle,
        Warm,
        Melt,
        Condense,
    }

    private const float WarmTime = 5, MeltTime = 6, CondenseTime = 6, AddWindow = 1.6f;

    private readonly AlchemyPanel _panel;
    private readonly FurnaceView _view;
    private readonly Label _label;
    private readonly Button _bellows, _herbs;
    private readonly RandomNumberGenerator _rng = new();

    private RecipeDef? _recipe;
    private float _heat = 0.12f, _boost, _time, _phaseTime, _inBand, _total, _bonus, _addLeft = -1, _over, _flareIn, _flareWarn, _lastPress, _shown;
    private bool _added;

    public Phase State { get; private set; } = Phase.Idle;
    public bool Busy => State != Phase.Idle;
    /// <summary>Plays by itself: works the bellows toward the middle of the band and adds the herbs when called.</summary>
    public bool Autopilot { get; set; }
    public int Brewed { get; private set; }
    /// <summary>How the last brew came out (0–1), and whether the furnace blew.</summary>
    public float LastPurity { get; private set; }
    public bool LastExploded { get; private set; }
    public float Heat => _heat;

    private static GameEngine E => Game.Instance.Engine!;
    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    public FurnaceStage(AlchemyPanel panel)
    {
        _panel = panel;
        _rng.Randomize();
        AddThemeConstantOverride("separation", 8);
        _view = new FurnaceView(this) { CustomMinimumSize = new Vector2(0, 220), SizeFlagsHorizontal = SizeFlags.ExpandFill };
        AddChild(_view);
        _label = UiKit.Label("", 16, Ink.InkColor, wrap: true);
        _label.Name = "furnace_label";
        AddChild(_label);
        _bellows = UiKit.Button("", Bellows, primary: true);
        _bellows.Name = "bellows";
        _bellows.CustomMinimumSize = new Vector2(220, 52);
        _herbs = UiKit.Button("", AddHerbs);
        _herbs.Name = "add_herbs";
        _herbs.CustomMinimumSize = new Vector2(220, 52);
        var row = UiKit.Row(_bellows, _herbs);
        row.AddThemeConstantOverride("separation", 10);
        AddChild(row);
        Refresh();
    }

    /// <summary>The fire is lit for <paramref name="recipe"/> (the engine has already taken the herbs).</summary>
    public void Begin(RecipeDef recipe)
    {
        _recipe = recipe;
        _heat = 0.12f;
        _boost = 0;
        _inBand = 0;
        _total = 0;
        _bonus = 0;
        _over = 0;
        _added = false;
        _addLeft = -1;
        _flareIn = _rng.RandfRange(3.5f, 5.5f);
        _flareWarn = 0;
        State = Phase.Warm;
        _phaseTime = 0;
        Refresh();
    }

    /// <summary>The panel closes mid-brew: the herbs burn to ash.</summary>
    public void Abandon()
    {
        if (!Busy) return;
        Finish(0, exploded: false);
    }

    public override void _UnhandledInput(InputEvent e)
    {
        if (e is InputEventKey { Keycode: Key.Space, Pressed: true, Echo: false })
        {
            Bellows();
            GetViewport().SetInputAsHandled();
        }
        else if (e is InputEventKey { Keycode: Key.H, Pressed: true, Echo: false })
        {
            AddHerbs();
            GetViewport().SetInputAsHandled();
        }
    }

    public void Bellows()
    {
        if (!Busy) return;
        _boost += 0.09f;
        _lastPress = 0;
        SoundBoard.Play("dash", -14, 0.6f);
    }

    public void AddHerbs()
    {
        if (!Busy || _added || _addLeft < 0) return;
        _added = true;
        // Right on the call is best; late still counts for a little.
        _bonus += _addLeft > AddWindow * 0.4f ? 0.08f : 0.03f;
        _addLeft = -1;
        SoundBoard.Play("gather", -6);
    }

    private (float Lo, float Hi) Band()
    {
        var level = Alchemy.Level(E.Player);
        var diff = (float)(_recipe?.Difficulty ?? 0.3);
        var k = Mathf.Clamp(1.25f - diff * 0.5f + level * 0.02f, 0.6f, 1.4f);
        var (center, half) = State switch
        {
            Phase.Warm => (0.40f, 0.10f),
            Phase.Melt => (0.66f, 0.11f),
            _ => (0.50f, Mathf.Lerp(0.10f, 0.06f, Mathf.Clamp(_phaseTime / CondenseTime, 0, 1))),
        };
        return (center - half * k, center + half * k);
    }

    public override void _Process(double delta)
    {
        var dt = (float)Math.Min(delta, 0.05);
        _time += dt;
        _shown = Mathf.Max(0, _shown - dt);
        if (Busy) Tick(dt);
        else _heat = Mathf.MoveToward(_heat, 0.12f, dt * 0.1f);
        Refresh();
        _view.QueueRedraw();
    }

    private void Tick(float dt)
    {
        _phaseTime += dt;
        _lastPress += dt;
        var (lo, hi) = Band();

        if (Autopilot)
        {
            var target = (lo + hi) / 2;
            if (_heat + _boost < target - 0.02f && _lastPress > 0.12f) Bellows();
            if (_addLeft >= 0 && _addLeft < AddWindow - 0.2f) AddHerbs();
        }

        // The bellows' heat comes in over a moment; the fire cools by itself; now and then it flares.
        var take = Mathf.Min(_boost, dt * 0.9f);
        _boost -= take;
        _heat += take;
        _heat -= (0.08f + _heat * 0.05f) * dt;
        _flareIn -= dt;
        if (_flareIn <= 0.8f && _flareWarn <= 0) _flareWarn = 0.8f;
        if (_flareWarn > 0)
        {
            _flareWarn -= dt;
            if (_flareWarn <= 0)
            {
                _heat += 0.12f;
                _flareIn = _rng.RandfRange(3.5f, 6f);
                SoundBoard.Play("fire", -6, 1.3f);
            }
        }
        _heat = Mathf.Clamp(_heat, 0, 1);

        _total += dt;
        if (_heat >= lo && _heat <= hi) _inBand += dt;
        _over = _heat >= 0.96f ? _over + dt : Mathf.Max(0, _over - dt);
        if (_over >= 0.7f)
        {
            Finish(0, exploded: true);
            return;
        }

        if (_addLeft >= 0)
        {
            _addLeft -= dt;
            if (_addLeft < 0 && !_added)
            {
                // Missed the call: the herbs go in late and scorched.
                _added = true;
                _bonus -= 0.12f;
            }
        }

        switch (State)
        {
            case Phase.Warm when _phaseTime >= WarmTime:
                State = Phase.Melt;
                _phaseTime = 0;
                _addLeft = AddWindow;
                SoundBoard.Play("chime", -4);
                break;
            case Phase.Melt when _phaseTime >= MeltTime:
                State = Phase.Condense;
                _phaseTime = 0;
                break;
            case Phase.Condense when _phaseTime >= CondenseTime:
                Finish(Mathf.Clamp(_inBand / Mathf.Max(0.01f, _total) + _bonus, 0, 1), exploded: false);
                break;
        }
    }

    private void Finish(float purity, bool exploded)
    {
        State = Phase.Idle;
        LastPurity = purity;
        LastExploded = exploded;
        Brewed += 1;
        _shown = 2;
        if (exploded)
        {
            _heat = 0.05f;
            SoundBoard.Play("explode", -2);
        }
        var events = E.FinishBrew(purity, exploded);
        if (events.FirstOrDefault() is { } main)
            _panel.Tell(main.Text, main.TextEn, exploded ? Ink.Cinnabar : main.Kind == "brew_done" ? Ink.JadeDeep : Ink.CinnabarDeep);
        if (events.Any(ev => ev.Kind == "brew_done")) SoundBoard.Play("breakthrough", -8);
        Game.Instance.Notify(events);
    }

    private void Refresh()
    {
        var text = State switch
        {
            Phase.Warm => T("Ôn lô: nhóm lửa vừa phải, giữ trong vạch xanh.", "Warm the furnace: a gentle fire, inside the green band."),
            Phase.Melt => _addLeft >= 0 && !_added
                ? T("Lò đã nóng — bỏ dược liệu vào ngay!", "The furnace is hot: add the herbs now!")
                : T("Dung luyện: lửa lớn hơn cho dược liệu tan ra.", "Melt the herbs: a stronger fire now."),
            Phase.Condense => T("Ngưng đan: hạ lửa, vạch hẹp dần — giữ thật đều tay.", "Condense the pill: a lower fire, and the band narrows. Keep it steady."),
            _ => T("Chọn một đan phương bên dưới rồi nhóm lò.", "Choose a recipe below to light the furnace."),
        };
        if (Busy && _flareWarn > 0) text += T("  Lửa sắp bùng!", "  The fire is about to flare!");
        if (_label.Text != text) _label.Text = text;
        var bellows = T("Quạt lửa (Space)", "Work the bellows (Space)");
        if (_bellows.Text != bellows) _bellows.Text = bellows;
        var herbs = T("Bỏ dược liệu (H)", "Add the herbs (H)");
        if (_herbs.Text != herbs) _herbs.Text = herbs;
        _bellows.Disabled = !Busy;
        _herbs.Disabled = !Busy || _added || _addLeft < 0;
    }

    // ------------------------------------------------------------------ the picture

    public void DrawFurnace(Brush c, Vector2 size)
    {
        if (size.X < 10) return;
        c.DrawRect(new Rect2(Vector2.Zero, size), new Color("#3a2f2a"));
        c.DrawRect(new Rect2(0, size.Y - 24, size.X, 24), new Color("#5a4a3e"));

        // The cauldron, its fire growing with the heat.
        var at = new Vector2(size.X * 0.36f, size.Y - 26);
        var flame = 10 + _heat * 60;
        for (var i = 0; i < 5; i++)
        {
            var x = at.X - 36 + i * 18;
            var sway = Mathf.Sin(_time * (7 + i) + i * 1.3f) * 4;
            var h = flame * (0.7f + 0.3f * Mathf.Sin(_time * 11 + i * 2));
            c.DrawColoredPolygon(new[] { new Vector2(x - 9, at.Y), new Vector2(x + 9, at.Y), new Vector2(x + sway, at.Y - h) },
                i % 2 == 0 ? new Color(0.95f, 0.45f, 0.15f, 0.85f) : new Color(1f, 0.8f, 0.3f, 0.9f));
        }
        c.DrawCircle(at + new Vector2(0, -20), 40 + _heat * 40, new Color(1f, 0.55f, 0.2f, 0.06f + _heat * 0.12f));
        foreach (var x in new[] { -38f, 0f, 38f }) c.DrawLine(at + new Vector2(x, -10), at + new Vector2(x * 0.8f, -52), new Color("#6f5a2a"), 6, true);
        var belly = new Vector2[20];
        for (var i = 0; i < belly.Length; i++)
        {
            var a = Mathf.Pi * i / (belly.Length - 1);
            belly[i] = at + new Vector2(-Mathf.Cos(a) * 62, -60 + Mathf.Sin(a) * 42);
        }
        c.DrawColoredPolygon(belly, new Color("#9a7a3a"));
        c.DrawPolyline(belly, new Color(0.1f, 0.08f, 0.05f, 0.8f), 2, true);
        c.DrawRect(new Rect2(at.X - 68, at.Y - 70, 136, 12), new Color("#b08a42"));
        foreach (var x in new[] { -58f, 58f }) c.DrawArc(at + new Vector2(x, -76), 9, Mathf.Pi, Mathf.Tau, 12, new Color("#9a7a3a"), 4, true);
        for (var i = 0; i < 4; i++)
        {
            var t = (_time * 0.4f + i / 4f) % 1f;
            c.DrawCircle(at + new Vector2(Mathf.Sin(_time + i * 1.7f) * 12 * t, -84 - t * 70), 6 + t * 14, new Color(0.92f, 0.92f, 0.9f, 0.22f * (1 - t) * (0.4f + _heat)));
        }
        if (_addLeft >= 0 && !_added && Busy)
        {
            var pulse = 0.6f + 0.4f * Mathf.Sin(_time * 10);
            Icons.Draw(c, IconKind.Herb, at + new Vector2(0, -120), 34 + pulse * 6, new Color(0.55f, 0.85f, 0.45f, 0.9f));
        }
        if (_shown > 0 && !Busy)
            Icons.Draw(c, LastExploded ? IconKind.Burst : IconKind.Pill, at + new Vector2(0, -118), 38, LastExploded ? Ink.CinnabarSoft : Ink.Gold);

        // The heat gauge: the band in green, the red mark at the top, the heat now.
        var gauge = new Rect2(size.X - 150, 16, 34, size.Y - 40);
        c.DrawRect(gauge, new Color(0.1f, 0.08f, 0.07f, 0.8f));
        float Y(float v) => gauge.End.Y - v * gauge.Size.Y;
        c.DrawRect(new Rect2(gauge.Position.X, gauge.Position.Y, gauge.Size.X, gauge.Size.Y * 0.04f), new Color(0.8f, 0.2f, 0.15f, 0.9f));
        if (Busy)
        {
            var (lo, hi) = Band();
            c.DrawRect(new Rect2(gauge.Position.X + 2, Y(hi), gauge.Size.X - 4, (hi - lo) * gauge.Size.Y), new Color(0.45f, 0.8f, 0.5f, 0.6f));
        }
        var hy = Y(_heat);
        c.DrawLine(new Vector2(gauge.Position.X - 8, hy), new Vector2(gauge.End.X + 8, hy), _over > 0 ? Ink.CinnabarSoft : new Color("#f3e3b0"), 3, true);

        // Purity so far, and the three stages.
        var purity = Busy ? Mathf.Clamp(_inBand / Mathf.Max(0.01f, _total) + _bonus, 0, 1) : LastPurity;
        var bar = new Rect2(size.X - 100, 16, 16, size.Y - 40);
        c.DrawRect(bar, new Color(0.1f, 0.08f, 0.07f, 0.8f));
        var fill = purity * bar.Size.Y;
        c.DrawRect(new Rect2(bar.Position.X, bar.End.Y - fill, bar.Size.X, fill), purity >= 0.88f ? Ink.Gold : purity >= 0.65f ? Ink.JadeSoft : purity >= 0.35f ? new Color("#c9a868") : Ink.CinnabarSoft);
        foreach (var mark in new[] { 0.35f, 0.65f, 0.88f })
            c.DrawLine(new Vector2(bar.Position.X - 3, bar.End.Y - mark * bar.Size.Y), new Vector2(bar.End.X + 3, bar.End.Y - mark * bar.Size.Y), new Color(1, 1, 1, 0.5f), 1);
        for (var i = 0; i < 3; i++)
        {
            var done = State == Phase.Idle ? false : (int)State - 1 > i;
            var now = (int)State - 1 == i;
            c.DrawCircle(new Vector2(28 + i * 26, 24), 8, done ? Ink.JadeSoft : now ? Ink.Gold : new Color(1, 1, 1, 0.2f));
        }
    }
}

public partial class FurnaceView : Control
{
    private readonly FurnaceStage _stage;

    public FurnaceView(FurnaceStage stage) => _stage = stage;

    public override void _GuiInput(InputEvent e)
    {
        // A tap on the fire works the bellows.
        if (e is InputEventMouseButton { ButtonIndex: MouseButton.Left, Pressed: true })
        {
            _stage.Bellows();
            AcceptEvent();
        }
    }

    public override void _Draw()
    {
        using var b = Brush.On(this);
        _stage.DrawFurnace(b, Size);
    }
}
