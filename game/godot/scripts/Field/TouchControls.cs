using System;
using System.Collections.Generic;
using Godot;
using TuTienLuc.Art;
using TuTienLuc.Audio;
using TuTienLuc.Ui;

namespace TuTienLuc.Field;

/// <summary>
/// On-screen controls for a touchscreen (design §8): a floating stick under the left thumb, and under the
/// right the martial art (hold it; it aims itself), the four spirit arts, dash, ultimate and pill. Interact
/// and Sword flight appear when they apply, and a pause button in fights. Every button presses the same
/// input action its key would, so the rest of the game can't tell a thumb from a keyboard. A touch anywhere
/// else falls through to the field: tap to walk, talk or strike, pinch to zoom (<see cref="FieldScreen"/>).
/// </summary>
public partial class TouchControls : Control
{
    /// <summary>Where the stick points, −1…1 on each axis; zero when no thumb is on it.</summary>
    public static Vector2 Stick { get; private set; }

    private sealed class Pad
    {
        public string Action = "";
        public float Radius;
        public Func<Vector2> Place = () => Vector2.Zero;
        public Func<bool> Shown = () => true;
        /// <summary>The finger holding it down, or −1.</summary>
        public int Finger = -1;
        public Vector2 Centre;
        public bool Visible;
    }

    private const float StickRadius = 96, KnobRadius = 44;
    /// <summary>A real mouse can work the controls too (touch mode tried out on a desktop).</summary>
    private const int MouseFinger = 1000;

    private readonly FieldScreen _f;
    private readonly List<Pad> _pads = new();
    private int _stickFinger = -1;
    private Vector2 _stickBase, _stickAt;
    /// <summary>The screen minus notches and rounded corners, in this control's coordinates.</summary>
    private Rect2 _safe;

    public TouchControls(FieldScreen field) => _f = field;

    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    /// <summary>Where the right thumb rests: the martial art, with the rest around it.</summary>
    private Vector2 Cluster => new(_safe.End.X - 138, _safe.End.Y - 132);
    private Vector2 StickHome => new(_safe.Position.X + StickRadius + 60, _safe.End.Y - StickRadius - 56);
    private static Vector2 Around(Vector2 centre, float degrees, float distance) => centre + Vector2.Right.Rotated(Mathf.DegToRad(degrees)) * distance;

    public override void _Ready()
    {
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        MouseFilter = MouseFilterEnum.Stop;
        // In a fight the spirit arts, ultimate and pill ring the martial art; exploring, the same arc holds
        // Interact and Sword flight when they apply. Dash is always there.
        bool Fighting() => _f.Battle != null;
        bool Exploring() => _f.Battle == null && !_f.FreeStrikes;
        Add("attack", 76, () => Cluster);
        Add("skill_1", 43, () => Around(Cluster, 180, 166), Fighting);
        Add("skill_2", 43, () => Around(Cluster, 211, 166), Fighting);
        Add("skill_3", 43, () => Around(Cluster, 242, 166), Fighting);
        Add("skill_4", 43, () => Around(Cluster, 273, 166), Fighting);
        Add("ultimate", 39, () => Around(Cluster, 304, 166), Fighting);
        Add("pill", 36, () => Around(Cluster, 150, 166), Fighting);
        Add("dash", 52, () => Cluster + new Vector2(-300, 62));
        Add("interact", 54, () => Around(Cluster, 218, 172), () => Exploring() && _f.Target != null);
        Add("fly", 44, () => Around(Cluster, 272, 172), () => Exploring() && _f.Player.CanFly);
        Add("pause", 32, () => new Vector2(_safe.End.X - 40, _safe.Position.Y + 40), Fighting);
        Visible = false;
    }

    private void Add(string action, float radius, Func<Vector2> place, Func<bool>? shown = null) =>
        _pads.Add(new Pad { Action = action, Radius = radius, Place = place, Shown = shown ?? (() => true) });

    /// <summary>The centre of the button for <paramref name="action"/> (the smoke test presses it).</summary>
    public Vector2? CentreOf(string action)
    {
        foreach (var pad in _pads)
            if (pad.Action == action && pad.Visible) return pad.Centre;
        return null;
    }

    public Vector2 StickCentre => StickHome;

    public override void _Process(double delta)
    {
        var show = TouchUi.Active && Game.Instance.Engine != null && !_f.Frozen;
        if (!show)
        {
            if (Visible) ReleaseAll();
            Visible = false;
            return;
        }
        Visible = true;
        _safe = SafeArea();
        foreach (var pad in _pads)
        {
            pad.Visible = pad.Shown();
            pad.Centre = pad.Place();
            if (!pad.Visible && pad.Finger >= 0) Release(pad);
        }
        QueueRedraw();
    }

    public override void _ExitTree() => ReleaseAll();

    private Rect2 SafeArea()
    {
        var full = new Rect2(Vector2.Zero, Size);
        var window = DisplayServer.GetName() == "headless" ? Vector2I.Zero : DisplayServer.WindowGetSize();
        var safe = OS.HasFeature("mobile") ? DisplayServer.GetDisplaySafeArea() : new Rect2I();
        if (window.X <= 0 || window.Y <= 0 || safe.Size.X <= 0 || safe.Size.Y <= 0) return full.Grow(-10);
        var k = Size / new Vector2(window.X, window.Y);
        return new Rect2(new Vector2(safe.Position.X, safe.Position.Y) * k, new Vector2(safe.Size.X, safe.Size.Y) * k).Intersection(full).Grow(-10);
    }

    // ================================================================ touches

    private bool InStickZone(Vector2 p) => p.X < _safe.Position.X + Size.X * 0.4f && p.Y > Size.Y * 0.4f;

    private Pad? PadAt(Vector2 p)
    {
        foreach (var pad in _pads)
            if (pad.Visible && pad.Centre.DistanceTo(p) <= pad.Radius + 10) return pad;
        return null;
    }

    /// <summary>Only the stick's corner and the buttons catch touches; the rest of the screen is the field's.</summary>
    public override bool _HasPoint(Vector2 point) => Visible && (PadAt(point) != null || InStickZone(point));

    public override void _GuiInput(InputEvent e)
    {
        switch (e)
        {
            case InputEventScreenTouch touch:
                if (touch.Pressed) Down(touch.Index, touch.Position);
                else Up(touch.Index);
                AcceptEvent();
                break;
            case InputEventScreenDrag drag:
                Drag(drag.Index, drag.Position);
                AcceptEvent();
                break;
            // The mouse Godot fakes from the first finger arrives too; the touch above already did the work.
            case InputEventMouseButton { ButtonIndex: MouseButton.Left } mb:
                if (mb.Device != InputEvent.DeviceIdEmulation)
                {
                    if (mb.Pressed) Down(MouseFinger, mb.Position);
                    else Up(MouseFinger);
                }
                AcceptEvent();
                break;
            case InputEventMouseMotion mm:
                if (mm.Device != InputEvent.DeviceIdEmulation && (mm.ButtonMask & MouseButtonMask.Left) != 0) Drag(MouseFinger, mm.Position);
                AcceptEvent();
                break;
        }
    }

    private void Down(int finger, Vector2 at)
    {
        var pad = PadAt(at);
        if (pad != null)
        {
            if (pad.Finger >= 0) return;
            pad.Finger = finger;
            Input.ParseInputEvent(new InputEventAction { Action = pad.Action, Pressed = true, Strength = 1 });
            if (pad.Action != "attack") SoundBoard.Play("click", -16);
            return;
        }
        if (_stickFinger >= 0 || !InStickZone(at)) return;
        _stickFinger = finger;
        // The stick comes to the thumb (never so near an edge that its rim leaves the screen).
        _stickBase = new Vector2(
            Mathf.Clamp(at.X, _safe.Position.X + StickRadius, Mathf.Max(_safe.Position.X + StickRadius, Size.X * 0.4f - 20)),
            Mathf.Clamp(at.Y, Size.Y * 0.4f + 20, _safe.End.Y - StickRadius));
        _stickAt = at;
        UpdateStick();
    }

    private void Drag(int finger, Vector2 at)
    {
        if (finger != _stickFinger) return;
        _stickAt = at;
        // A thumb that wanders far drags the base along, so the stick never runs out of travel.
        var off = _stickAt - _stickBase;
        if (off.Length() > StickRadius * 1.6f) _stickBase = _stickAt - off.Normalized() * StickRadius * 1.6f;
        UpdateStick();
    }

    private void Up(int finger)
    {
        if (finger == _stickFinger)
        {
            _stickFinger = -1;
            Stick = Vector2.Zero;
        }
        foreach (var pad in _pads)
            if (pad.Finger == finger) Release(pad);
    }

    private static void Release(Pad pad)
    {
        pad.Finger = -1;
        Input.ParseInputEvent(new InputEventAction { Action = pad.Action, Pressed = false });
    }

    private void ReleaseAll()
    {
        _stickFinger = -1;
        Stick = Vector2.Zero;
        foreach (var pad in _pads)
            if (pad.Finger >= 0) Release(pad);
    }

    private void UpdateStick()
    {
        var off = (_stickAt - _stickBase) / StickRadius;
        var length = off.Length();
        // A small dead zone, then full speed a little before the rim.
        Stick = length < 0.16f ? Vector2.Zero : off / length * Mathf.Clamp((length - 0.16f) / 0.64f, 0, 1);
    }

    // ================================================================ drawing

    public override void _Draw()
    {
        var held = _stickFinger >= 0;
        var centre = held ? _stickBase : StickHome;
        var a = held ? 1f : 0.6f;
        DrawCircle(centre, StickRadius, new Color(Ink.Card, 0.3f * a));
        DrawArc(centre, StickRadius, 0, Mathf.Tau, 48, new Color(Ink.InkColor, 0.35f * a), 2, true);
        for (var i = 0; i < 4; i++)
        {
            var d = Vector2.Right.Rotated(i * Mathf.Pi / 2);
            DrawLine(centre + d * (StickRadius - 18), centre + d * (StickRadius - 7), new Color(Ink.InkColor, 0.35f * a), 2, true);
        }
        var knob = held ? centre + (_stickAt - centre).LimitLength(StickRadius) : centre;
        DrawCircle(knob, KnobRadius, new Color(Ink.Card, 0.88f * a));
        DrawArc(knob, KnobRadius, 0, Mathf.Tau, 36, new Color(Ink.InkColor, 0.7f * a), 2, true);
        DrawCircle(knob, 7, new Color(Ink.Cinnabar, 0.65f * a));

        foreach (var pad in _pads)
            if (pad.Visible) DrawPad(pad);
    }

    private void DrawPad(Pad pad)
    {
        var (icon, caption, color, cooldown, usable) = Look(pad);
        var held = pad.Finger >= 0;
        var r = pad.Radius * (held ? 0.93f : 1f);
        var c = pad.Centre;
        DrawCircle(c, r + 3, new Color(Ink.InkColor, 0.12f));
        DrawCircle(c, r, new Color(usable ? Ink.Card : Ink.PaperDeep, held ? 0.97f : 0.86f));
        if (cooldown > 0.01f) DrawColoredPolygon(Sector(c, r, Mathf.Min(cooldown, 0.995f)), new Color(Ink.InkColor, 0.38f));
        if (held) DrawCircle(c, r, new Color(color, 0.18f));
        DrawArc(c, r, 0, Mathf.Tau, 48, usable ? color : new Color(Ink.LineStrong, 0.9f), usable ? 3 : 1.5f, true);
        Icons.Draw(this, icon, c, r * 1.02f, usable ? color : Ink.InkFaint);
        if (caption.Length == 0) return;
        if (caption.Length > 24) caption = caption[..23] + "…";
        var cs = Ink.UiFont.GetStringSize(caption, HorizontalAlignment.Left, -1, 14);
        // Buttons up in the arc wear their caption above, clear of the martial art below them.
        var above = c.Y < Cluster.Y - 40;
        var at = c + new Vector2(-cs.X / 2, above ? -r - 12 : r + 22);
        DrawRect(new Rect2(at - new Vector2(7, 15), new Vector2(cs.X + 14, 21)), new Color(Ink.Card, 0.88f));
        DrawString(Ink.UiFont, at, caption, HorizontalAlignment.Left, -1, 14, Ink.InkColor);
    }

    /// <summary>A button's face: its icon, a caption under it, its colour, how much cooldown is left (0–1), and whether it can be used.</summary>
    private (IconKind Icon, string Caption, Color Color, float Cooldown, bool Usable) Look(Pad pad)
    {
        var pc = _f.Player;
        switch (pad.Action)
        {
            case "attack":
                return (IconKind.Sword, "", Ink.InkColor, Fraction(pc.CooldownLeft(pc.Basic.Id), pc.Basic.Cooldown), true);
            case "skill_1" or "skill_2" or "skill_3" or "skill_4":
            {
                var skill = pc.SlotSkill(pad.Action[^1] - '1');
                if (skill == null) return (IconKind.None, "", Ink.InkFaint, 0, false);
                var color = skill.Element is { } element ? Ink.Element(element) : Ink.InkColor;
                return (Icons.ForSkill(skill), "", color, Fraction(pc.CooldownLeft(skill.Id), skill.Cooldown), pc.QiCost(skill) <= pc.Qi);
            }
            case "ultimate":
                return (IconKind.Ultimate, "", Ink.Violet, 1 - Mathf.Clamp(pc.Intent / 100f, 0, 1), pc.Intent >= 100);
            case "pill":
            {
                var (_, count) = pc.Pill();
                return (IconKind.Pill, count > 0 ? $"×{count}" : "", Ink.Jade, Mathf.Clamp(pc.PillCd / 5f, 0, 1), count > 0 && pc.PillCd <= 0);
            }
            case "dash":
                return (IconKind.Dash, "", Ink.GoldDeep, 0, pc.Stamina >= PlayerController.DashCost);
            case "interact":
                return (IconKind.Hand, _f.Target?.Label() ?? "", Ink.JadeDeep, 0, true);
            case "fly":
                // The flying sword takes off; once aloft the button lands.
                return (_f.PlayerBody.Flying ? IconKind.Land : IconKind.FlyingSword, "", Ink.WaterBlue, 0, true);
            case "pause":
                return (IconKind.Pause, "", Ink.InkSoft, 0, true);
        }
        return (IconKind.None, "", Ink.InkColor, 0, true);
    }

    private static float Fraction(float left, double total) => total > 0 ? Mathf.Clamp(left / (float)total, 0, 1) : 0;

    /// <summary>A pie slice from twelve o'clock, clockwise, covering <paramref name="fraction"/> of the circle.</summary>
    private static Vector2[] Sector(Vector2 c, float r, float fraction)
    {
        var n = Math.Max(3, (int)(40 * fraction));
        var pts = new Vector2[n + 2];
        pts[0] = c;
        for (var i = 0; i <= n; i++) pts[i + 1] = c + Vector2.Right.Rotated(-Mathf.Pi / 2 + Mathf.Tau * fraction * i / n) * r;
        return pts;
    }
}
