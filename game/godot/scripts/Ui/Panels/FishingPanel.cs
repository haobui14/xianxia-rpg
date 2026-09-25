using System;
using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTienLuc.Art;
using TuTienLuc.Audio;

namespace TuTienLuc.Ui.Panels;

/// <summary>
/// Fishing at a landing, a footwork a cast: wait for the float to go under (nibbles first, then the bite), strike in
/// time, then reel. Holding (the button, the water, or Space) lifts the net and letting go drops it; keep the fish
/// inside the net until the catch fills. A few catches may be let go, for karma.
/// </summary>
public partial class FishingPanel : InkPanel
{
    private readonly PoiDef _spot;
    private FishingStage? _stage;
    private (string Vi, string En)? _message;
    private Color _messageColor = Ink.InkColor;

    public FishingPanel(PoiDef spot) => _spot = spot;

    protected override IconKind Emblem => IconKind.Fish;
    protected override string TitleText => T(_spot.Name, _spot.NameEn);
    protected override Vector2 PanelSize => new(800, 700);

    /// <summary>The water and the line (the smoke test hands them to the autopilot).</summary>
    public FishingStage? Stage => _stage;

    protected override Control CreateStage() => _stage = new FishingStage(this, _spot);

    /// <summary>A line under the water about what just happened.</summary>
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
        Para(T($"Mỗi lần quăng câu tốn {Fishing.CastFootwork} cước lực (còn {p.Footwork}/{p.FootworkMax}). Tay câu cấp {Fishing.Level(p)} · đã câu được {p.Counters.FishCaught} con.",
            $"Each cast costs {Fishing.CastFootwork} footwork ({p.Footwork}/{p.FootworkMax} left). Angler level {Fishing.Level(p)} · {p.Counters.FishCaught} fish landed."), 15, Ink.InkColor);
        if (_message is { } m) Para(T(m.Vi, m.En), 17, _messageColor);

        if (_stage?.InHand is { ItemId: { } id } && e.Content.Item(id) is { } fish && e.Content.Fish.TryGetValue(id, out var info))
        {
            var years = info.ReleaseLifespan > 0 ? T($", thọ nguyên +{info.ReleaseLifespan} năm", $", lifespan +{info.ReleaseLifespan} year{(info.ReleaseLifespan > 1 ? "s" : "")}") : "";
            Buttons(
                Named(UiKit.Button(T($"Giữ {fish.Name}", $"Keep the {fish.NameEn}"), () => _stage.Land(release: false), primary: true), "fish_keep"),
                Named(UiKit.Button(T($"Thả về nước (nhân quả +{info.ReleaseKarma}{years})", $"Let it go (karma +{info.ReleaseKarma}{years})"), () => _stage.Land(release: true)), "fish_release"));
        }

        Section(T("Mùa này ở đây cắn câu", "Biting here this season"));
        if (e.Content.FishSpots.TryGetValue(_spot.Id, out var spot))
        {
            // Fish never landed stay a mystery until the first one comes up.
            var names = new List<string>();
            var unknown = 0;
            var sunken = false;
            foreach (var (c, _) in Fishing.Pool(e.State, e.Content, spot))
            {
                if (c.Item == null) sunken = true;
                else if (p.Counters.Catches.ContainsKey(c.Item) && e.Content.Item(c.Item) is { } def) names.Add(Text.Name(def));
                else unknown += 1;
            }
            if (unknown > 0) names.Add(T($"{unknown} loài cá chưa từng câu được", unknown == 1 ? "1 kind of fish you haven't caught yet" : $"{unknown} kinds of fish you haven't caught yet"));
            if (sunken) names.Add(T("đôi khi có đồ chìm dưới nước", "now and then something sunken"));
            Para(string.Join(" · ", names), 15, Ink.InkSoft);
        }
        if (e.Fortune?.LuckyCatch == true)
            Para(T("Quẻ tháng này báo cá hiếm dễ cắn câu.", "This month's fortune stick says rare fish bite more readily."), 14, Ink.JadeDeep);
        Para(T("Chờ phao chìm hẳn rồi mới giật cần. Khi kéo: giữ nút, giữ tay trên mặt nước hoặc giữ phím Space để nâng lưới, thả ra để hạ.",
            "Wait for the float to go right under before you strike. Reeling: hold the button, a finger on the water or Space to lift the net; let go to drop it."), 13, Ink.InkFaint);
        Buttons(UiKit.Button(T("Rời bến", "Leave the landing"), Close));
    }

    private static Button Named(Button button, string name)
    {
        button.Name = name;
        return button;
    }

    public override void Close()
    {
        // Walking away mid-bite lets the fish go.
        _stage?.Abandon();
        base.Close();
    }
}

/// <summary>The water and the line: the float and its nibbles, the bite, then the reel's track, the net and the catch meter.</summary>
public partial class FishingStage : VBoxContainer
{
    public enum Phase
    {
        Idle,
        Waiting,
        Bite,
        Reeling,
        InHand,
    }

    private readonly FishingPanel _panel;
    private readonly PoiDef _spot;
    private readonly WaterView _water;
    private readonly Button _action;
    private readonly RandomNumberGenerator _rng = new();

    private Bite? _bite;
    private float _wait, _window, _biteAge, _nibbleIn, _nibble, _splash, _time;
    private float _net, _netVel, _netSize, _fish, _fishTarget, _fishTimer, _progress;
    private bool _holding;
    private Locale _locale;

    public Phase State { get; private set; } = Phase.Idle;
    /// <summary>Plays by itself: waits out the nibbles, strikes at the bite and keeps the net on the fish.</summary>
    public bool Autopilot { get; set; }
    /// <summary>A catch landed that may be let go: the panel asks keep or release.</summary>
    public Bite? InHand => State == Phase.InHand ? _bite : null;
    public int Casts { get; private set; }
    public int Landed { get; private set; }
    public int Lost { get; private set; }

    private static GameEngine E => Game.Instance.Engine!;
    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    public FishingStage(FishingPanel panel, PoiDef spot)
    {
        _panel = panel;
        _spot = spot;
        _rng.Randomize();
        AddThemeConstantOverride("separation", 8);
        _water = new WaterView(this)
        {
            CustomMinimumSize = new Vector2(0, 220), SizeFlagsHorizontal = SizeFlags.ExpandFill, MouseFilter = MouseFilterEnum.Stop,
        };
        AddChild(_water);
        _action = UiKit.Button("", () => { }, primary: true);
        _action.Name = "fish_action";
        _action.CustomMinimumSize = new Vector2(0, 54);
        _action.ButtonDown += Down;
        _action.ButtonUp += Up;
        AddChild(_action);
        UpdateButton();
    }

    public override void _UnhandledInput(InputEvent e)
    {
        if (e is InputEventKey { Keycode: Key.Space, Echo: false } key)
        {
            if (key.Pressed) Down();
            else Up();
            GetViewport().SetInputAsHandled();
        }
    }

    /// <summary>A press: cast, strike, or start lifting the net (by phase).</summary>
    public void Down()
    {
        switch (State)
        {
            case Phase.Idle:
                Cast();
                break;
            case Phase.Waiting:
                // Only a nibble: the fish takes fright.
                E.LoseCatch();
                Lost += 1;
                State = Phase.Idle;
                SoundBoard.Play("warn", -8);
                _panel.Tell("Giật sớm quá, cá sợ bỏ đi mất.", "Too early: the fish took fright.", Ink.CinnabarDeep);
                break;
            case Phase.Bite:
                Hook();
                break;
            case Phase.Reeling:
                _holding = true;
                break;
        }
        UpdateButton();
    }

    public void Up() => _holding = false;

    private void Cast()
    {
        var bite = E.CastLine(_spot.Id);
        Game.Instance.Changed();
        if (bite == null)
        {
            _panel.Tell("Không thả câu được ở đây.", "You can't fish from here.", Ink.Cinnabar);
            return;
        }
        _bite = bite;
        Casts += 1;
        var per = E.Player.Attrs.Per;
        _wait = _rng.RandfRange(1.6f, 4.6f) * Mathf.Clamp(1 - per * 0.01f, 0.6f, 1f);
        _nibbleIn = _rng.RandfRange(0.4f, 1.2f);
        _splash = 1;
        State = Phase.Waiting;
        SoundBoard.Play("swing", -8, 0.7f);
        _panel.Tell("Phao nổi lững lờ… chờ nó chìm hẳn rồi hãy giật.", "The float drifts… wait for it to go right under, then strike.", Ink.InkSoft);
    }

    private void Hook()
    {
        var p = E.Player;
        State = Phase.Reeling;
        _netSize = Mathf.Clamp(0.2f + 0.012f * Fishing.Level(p) + 0.004f * p.Attrs.Agi, 0.2f, 0.36f);
        _net = 0.1f;
        _netVel = 0;
        _fish = 0.45f;
        _fishTarget = 0.6f;
        _fishTimer = 0.8f;
        _progress = 0.3f;
        _holding = false;
        SoundBoard.Play("click", -2);
        _panel.Tell("Dính rồi! Giữ để nâng lưới, thả để hạ. Giữ con cá trong lưới.", "Hooked! Hold to lift the net, let go to drop it. Keep the fish inside.", Ink.JadeDeep);
    }

    /// <summary>Keep the catch in hand, or let it go.</summary>
    public void Land(bool release)
    {
        var events = E.LandCatch(release);
        State = Phase.Idle;
        _bite = null;
        SoundBoard.Play(release ? "heal" : "gather", -4);
        if (events.FirstOrDefault(ev => ev.Kind is "fish_caught" or "fish_released" or "fish_sunken") is { } main)
            _panel.Tell(main.Text, main.TextEn, main.Level == EventLevel.Major ? Ink.GoldDeep : Ink.JadeDeep);
        Game.Instance.Notify(events);
        UpdateButton();
    }

    /// <summary>The panel closes mid-cast: whatever was on the line is gone.</summary>
    public void Abandon()
    {
        if (State is Phase.Waiting or Phase.Bite or Phase.Reeling) E.LoseCatch();
        // A catch already in the net is kept.
        if (State == Phase.InHand) Land(release: false);
        State = Phase.Idle;
    }

    private void Caught()
    {
        Landed += 1;
        _splash = 1;
        if (_bite!.CanRelease)
        {
            State = Phase.InHand;
            SoundBoard.Play("chime", -2);
            var name = E.Content.Item(_bite.ItemId) is { } def ? (def.Name, def.NameEn) : ("?", "?");
            _panel.Tell($"Lên rồi: {name.Item1}! Giữ lại, hay thả nó về nước?", $"Landed: {name.Item2}! Keep it, or let it go?", Ink.GoldDeep);
            return;
        }
        Land(release: false);
    }

    private void Escaped()
    {
        var name = _bite?.ItemId != null && E.Content.Item(_bite.ItemId) is { } def ? (def.Name, def.NameEn) : (null, null);
        E.LoseCatch();
        Lost += 1;
        State = Phase.Idle;
        _bite = null;
        SoundBoard.Play("warn", -6);
        if (name.Item1 != null) _panel.Tell($"Dây chùng — {name.Item1} vùng thoát mất!", $"The line went slack. The {name.Item2} got away!", Ink.CinnabarDeep);
        else _panel.Tell("Dây câu mắc phải thứ gì nặng rồi đứt phựt.", "The line snagged on something heavy and snapped.", Ink.CinnabarDeep);
    }

    public override void _Process(double delta)
    {
        var dt = (float)Math.Min(delta, 0.05);
        _time += dt;
        _splash = Mathf.Max(0, _splash - dt * 1.4f);
        _nibble = Mathf.Max(0, _nibble - dt);
        switch (State)
        {
            case Phase.Waiting:
                _wait -= dt;
                _nibbleIn -= dt;
                if (_nibbleIn <= 0 && _wait > 0.6f)
                {
                    _nibble = 0.28f;
                    _nibbleIn = _rng.RandfRange(0.7f, 1.6f);
                    SoundBoard.Play("step", -14, 1.6f);
                }
                if (_wait <= 0)
                {
                    State = Phase.Bite;
                    _window = Mathf.Min(1.1f, 0.75f + E.Player.Attrs.Per * 0.01f);
                    _biteAge = 0;
                    _splash = 1;
                    SoundBoard.Play("notice", -2, 1.2f);
                    UpdateButton();
                }
                break;
            case Phase.Bite:
                _window -= dt;
                _biteAge += dt;
                if (Autopilot && _biteAge > 0.2f)
                {
                    Hook();
                    UpdateButton();
                }
                else if (_window <= 0)
                {
                    E.LoseCatch();
                    Lost += 1;
                    State = Phase.Idle;
                    SoundBoard.Play("warn", -8);
                    _panel.Tell("Chậm tay rồi — cá ăn mất mồi.", "Too slow: it stole the bait.", Ink.CinnabarDeep);
                    UpdateButton();
                }
                break;
            case Phase.Reeling:
                Reel(dt);
                break;
        }
        if (Game.Instance.Locale != _locale) UpdateButton();
        _water.QueueRedraw();
    }

    private void Reel(float dt)
    {
        var diff = (float)_bite!.Difficulty;
        var dart = (float)_bite.Dart;
        _fishTimer -= dt;
        if (_fishTimer <= 0)
        {
            _fishTarget = _rng.Randf();
            if (_rng.Randf() < dart * 0.7f) _fishTarget = _fish > 0.5f ? _rng.RandfRange(0f, 0.2f) : _rng.RandfRange(0.8f, 1f);
            _fishTimer = _rng.RandfRange(0.5f, 1.5f) * (1.25f - diff * 0.6f);
        }
        _fish = Mathf.MoveToward(_fish, _fishTarget, (0.22f + diff * 0.78f) * dt);
        var hold = Autopilot ? _fish > _net + _netSize * 0.5f + _netVel * 0.18f : _holding;
        _netVel = Mathf.Clamp(_netVel + (hold ? 2.8f : -2.3f) * dt, -1.5f, 1.5f);
        _net += _netVel * dt;
        if (_net < 0)
        {
            _net = 0;
            _netVel = Mathf.Max(0, -_netVel * 0.25f);
        }
        if (_net > 1 - _netSize)
        {
            _net = 1 - _netSize;
            _netVel = Mathf.Min(0, _netVel);
        }
        var inside = _fish >= _net && _fish <= _net + _netSize;
        _progress += (inside ? 0.3f : -(0.13f + 0.17f * diff)) * dt;
        if (!inside && _rng.Randf() < dt * 2) _splash = Mathf.Max(_splash, 0.5f);
        if (_progress >= 1)
        {
            _progress = 1;
            Caught();
            UpdateButton();
        }
        else if (_progress <= 0)
        {
            Escaped();
            UpdateButton();
        }
    }

    private void UpdateButton()
    {
        _locale = Game.Instance.Locale;
        _action.Text = State switch
        {
            Phase.Idle => T($"Quăng câu (−{Fishing.CastFootwork} cước lực)", $"Cast (−{Fishing.CastFootwork} footwork)"),
            Phase.Waiting or Phase.Bite => T("Giật cần!", "Strike!"),
            Phase.Reeling => T("Giữ để nâng lưới", "Hold to lift the net"),
            _ => T("Giữ lại hay thả đi?", "Keep it, or let it go?"),
        };
        _action.Disabled = State == Phase.InHand;
    }

    // ------------------------------------------------------------------ the picture

    /// <summary>Draws the pond: water and reeds, the line and float; while reeling, the track, the net, the fish and the meter.</summary>
    public void DrawWater(Control c)
    {
        var size = c.Size;
        if (size.X < 10) return;
        var water = new Color("#5f8fa3");
        c.DrawRect(new Rect2(Vector2.Zero, size), water);
        for (var i = 0; i < 9; i++)
        {
            var y = 18 + i * (size.Y - 30) / 8;
            var pts = new Vector2[24];
            for (var k = 0; k < pts.Length; k++)
            {
                var x = k * size.X / (pts.Length - 1);
                pts[k] = new Vector2(x, y + Mathf.Sin(x * 0.03f + _time * 1.4f + i) * 2.5f);
            }
            c.DrawPolyline(pts, new Color(1, 1, 1, 0.08f + (i % 3) * 0.03f), 1.4f, true);
        }
        // The near bank and its reeds.
        c.DrawRect(new Rect2(0, size.Y - 16, size.X, 16), new Color("#8a7a5a"));
        for (var i = 0; i < 12; i++)
        {
            var x = 10 + i * 18;
            var sway = Mathf.Sin(_time * 1.3f + i) * 3;
            c.DrawLine(new Vector2(x, size.Y - 14), new Vector2(x + sway, size.Y - 44 - (i % 3) * 8), new Color("#6f7a45"), 2, true);
        }

        // The line from the rod (off the top-left) to the float.
        var bob = Mathf.Sin(_time * 2.2f) * 2.5f;
        var dip = State switch
        {
            Phase.Bite => 9f,
            Phase.Waiting when _nibble > 0 => 4f * Mathf.Sin(_nibble / 0.28f * Mathf.Pi),
            Phase.Reeling => 6f + Mathf.Sin(_time * 18) * 3,
            _ => 0f,
        };
        var floatAt = new Vector2(size.X * 0.36f + (State == Phase.Reeling ? Mathf.Sin(_time * 7) * 14 : 0), size.Y * 0.52f + bob + dip);
        if (State != Phase.Idle && State != Phase.InHand)
        {
            c.DrawLine(new Vector2(0, 0), floatAt + new Vector2(0, -6), new Color(0.95f, 0.95f, 0.9f, 0.8f), 1.2f, true);
            for (var i = 0; i < 3; i++)
            {
                var r = 8 + i * 9 + _splash * 14;
                c.DrawArc(floatAt + new Vector2(0, 5), r, 0, Mathf.Tau, 28, new Color(1, 1, 1, (0.3f - i * 0.08f) * (0.4f + _splash)), 1.4f, true);
            }
            c.DrawCircle(floatAt, 5.5f, new Color("#c0392b"));
            c.DrawCircle(floatAt + new Vector2(0, -4), 3f, new Color("#f4f0e6"));
            if (State == Phase.Bite) Icons.Draw(c, IconKind.Star, floatAt + new Vector2(0, -34), 22, Ink.Gold);
        }
        else if (State == Phase.Idle)
        {
            Icons.Draw(c, IconKind.Fish, new Vector2(size.X * 0.36f, size.Y * 0.52f), 30, new Color(1, 1, 1, 0.35f));
        }

        if (State == Phase.Reeling || State == Phase.InHand)
        {
            // The track, the net, the fish; the catch meter beside them.
            var track = new Rect2(size.X - 96, 14, 34, size.Y - 44);
            c.DrawRect(track, new Color(0.08f, 0.12f, 0.16f, 0.55f));
            float Y(float v) => track.End.Y - v * track.Size.Y;
            var net = new Rect2(track.Position.X + 2, Y(_net + _netSize), track.Size.X - 4, _netSize * track.Size.Y);
            c.DrawRect(net, new Color(0.45f, 0.8f, 0.55f, 0.55f));
            c.DrawRect(net, new Color(0.8f, 1f, 0.85f, 0.9f), false, 1.5f);
            Icons.Draw(c, IconKind.Fish, new Vector2(track.GetCenter().X, Y(_fish)), 26, State == Phase.InHand ? Ink.Gold : new Color("#f3e3b0"));
            var meter = new Rect2(size.X - 48, 14, 14, size.Y - 44);
            c.DrawRect(meter, new Color(0.08f, 0.12f, 0.16f, 0.55f));
            var fill = Mathf.Clamp(_progress, 0, 1) * meter.Size.Y;
            c.DrawRect(new Rect2(meter.Position.X, meter.End.Y - fill, meter.Size.X, fill), _progress > 0.25f ? Ink.Gold : Ink.CinnabarSoft);
        }
    }
}

/// <summary>The pond's picture; a press on it works like the fishing button.</summary>
public partial class WaterView : Control
{
    private readonly FishingStage _stage;

    public WaterView(FishingStage stage) => _stage = stage;

    public override void _GuiInput(InputEvent e)
    {
        // A finger arrives here as the mouse too, so the mouse alone is read.
        if (e is not InputEventMouseButton { ButtonIndex: MouseButton.Left } mb) return;
        if (mb.Pressed) _stage.Down();
        else _stage.Up();
        AcceptEvent();
    }

    public override void _Draw() => _stage.DrawWater(this);
}
