using System;
using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Combat;
using TuTien.Core.State;
using TuTienLuc.Art;
using TuTienLuc.Audio;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.Field;

/// <summary>
/// A place you walk around in, seen from above in ¾ view: painted ground, Y-sorted scenery and people,
/// effects, the camera and the HUD. Fights happen right here (design §7.3, "fight where you meet"): a
/// <see cref="Battle"/> runs on the same field and the same bodies. The region map, a secret realm and
/// the breakthrough trial are all fields.
/// </summary>
public abstract partial class FieldScreen : Node2D
{
    public GameEngine E => Game.Instance.Engine!;
    public CollisionWorld Walls { get; protected set; } = null!;
    public Fx Fx { get; } = new();
    public Battle? Battle { get; private set; }
    public PlayerController Player { get; private set; } = null!;
    public Fighter PlayerBody => Player.Body;
    public readonly List<Actor> Actors = new();
    public readonly List<Interaction> Interactions = new();
    /// <summary>What [E] would act on right now.</summary>
    public Interaction? Target { get; private set; }
    public FieldHud Hud { get; private set; } = null!;
    /// <summary>The on-screen stick and buttons, shown when touch controls are on.</summary>
    public TouchControls TouchPad { get; private set; } = null!;
    public Vector2 MouseWorld => GetGlobalMousePosition();
    public bool PanelOpen => _panel != null && IsInstanceValid(_panel);
    public InkPanel? CurrentPanel => PanelOpen ? _panel : null;
    /// <summary>True while nothing moves: a panel, the pause menu, a fade.</summary>
    public bool Frozen => PanelOpen || _pause.Visible || _fading;
    /// <summary>Strikes land without a battle (the breakthrough trial cuts heart demons).</summary>
    public virtual bool FreeStrikes => false;
    /// <summary>The name of the place, for the HUD.</summary>
    public abstract string PlaceName { get; }
    public virtual string PlaceSub => "";
    /// <summary>The music this place plays when nobody is fighting.</summary>
    protected virtual string MusicMood => "explore";

    protected Node2D Objects { get; } = new() { Name = "Objects", YSortEnabled = true };
    protected Camera2D Camera { get; private set; } = null!;

    private float _shake;
    private float _hitstop;
    private InkPanel? _panel;
    private ColorRect _dim = null!;
    private Control _panelHost = null!;
    private FieldPause _pause = null!;
    private ColorRect _fade = null!;
    private bool _fading;
    private float _endTimer = -1;
    private Action<CombatResolution, CombatOutcome>? _afterBattle;
    private readonly List<Fighter> _temporary = new();
    private Rect2 _view;
    private float _zoom = 1;
    private IEnumerator<BuildStep>? _steps;
    private bool _built;
    private readonly List<Prop> _props = new();
    private float _paintTimer;

    protected static string T(string vi, string en) => Game.Instance.T(vi, en);

    // ================================================================ building

    /// <summary>
    /// Build the place ahead of showing it, one slice per call: false once it is all built. The loading
    /// screen steps through it across frames (so a phone never sits on one long frame); entering the tree
    /// builds whatever is left.
    /// </summary>
    public bool Step()
    {
        if (_built) return false;
        _steps ??= BuildSteps().GetEnumerator();
        if (_steps.MoveNext())
        {
            CurrentStep = _steps.Current;
            return true;
        }
        _built = true;
        _steps.Dispose();
        return false;
    }

    /// <summary>How far the last <see cref="Step"/> got, and what it was doing.</summary>
    public BuildStep CurrentStep { get; private set; }

    /// <summary>The slices of building the place (by default all of <see cref="BuildField"/> at once).</summary>
    protected virtual IEnumerable<BuildStep> BuildSteps()
    {
        BuildField();
        yield return new BuildStep(1, "Dựng cảnh", "Setting the scene");
    }

    public override void _Ready()
    {
        while (Step())
        {
        }
        AddChild(Objects);
        AddChild(new GroundFxLayer(this));
        AddChild(new AirFxLayer(this));
        AddChild(new OverlayLayer(this));

        Player = new PlayerController(this, Walls.NearestFree(SpawnPoint(), 14, 400));
        AddActor(Player.Body);

        Camera = new Camera2D { PositionSmoothingEnabled = true, PositionSmoothingSpeed = 7, Position = PlayerBody.Pos };
        var limits = CameraBounds();
        Camera.LimitLeft = (int)limits.Position.X;
        Camera.LimitTop = (int)limits.Position.Y;
        Camera.LimitRight = (int)limits.End.X;
        Camera.LimitBottom = (int)limits.End.Y;
        AddChild(Camera);
        Camera.MakeCurrent();
        Camera.ResetSmoothing();
        PaintNearby(0, now: true);

        var ui = new CanvasLayer { Layer = 10 };
        AddChild(ui);
        Hud = new FieldHud(this);
        ui.AddChild(Hud);

        var touch = new CanvasLayer { Layer = 15 };
        AddChild(touch);
        TouchPad = new TouchControls(this);
        touch.AddChild(TouchPad);

        var modal = new CanvasLayer { Layer = 20 };
        AddChild(modal);
        _dim = new ColorRect { Color = new Color(0.08f, 0.09f, 0.13f, 0.45f), Visible = false, MouseFilter = Control.MouseFilterEnum.Stop };
        _dim.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        modal.AddChild(_dim);
        _panelHost = new CenterContainer { MouseFilter = Control.MouseFilterEnum.Ignore };
        _panelHost.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        modal.AddChild(_panelHost);

        var pauseLayer = new CanvasLayer { Layer = 25 };
        AddChild(pauseLayer);
        _pause = new FieldPause(this) { Visible = false };
        pauseLayer.AddChild(_pause);

        var fadeLayer = new CanvasLayer { Layer = 30 };
        AddChild(fadeLayer);
        _fade = new ColorRect { Color = new Color(Ink.Paper, 1), MouseFilter = Control.MouseFilterEnum.Ignore };
        _fade.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        fadeLayer.AddChild(_fade);
        var tween = _fade.CreateTween();
        tween.TweenProperty(_fade, "color:a", 0f, 0.45f);

        Game.Instance.StateChanged += OnStateChanged;
        AfterReady();
        SoundBoard.Music(MusicMood);
        SoundBoard.Prepare("battle");
        Callable.From(CheckPending).CallDeferred();
    }

    public override void _ExitTree() => Game.Instance.StateChanged -= OnStateChanged;

    /// <summary>
    /// Create <see cref="Walls"/>, the ground, scenery (<see cref="AddProp"/>), people and interactions — all at
    /// once, or override <see cref="BuildSteps"/> instead to build in slices.
    /// </summary>
    protected virtual void BuildField()
    {
    }

    /// <summary>Where the player appears.</summary>
    protected abstract Vector2 SpawnPoint();

    protected virtual void AfterReady()
    {
    }

    protected virtual Rect2 CameraBounds() => Walls.Bounds;

    protected virtual void OnStateChanged()
    {
        if (Battle == null && Game.Instance.Engine != null) Player.SyncFromEngine();
    }

    public Prop AddProp(Vector2 pos, Action<Brush, float> art, bool animated = false, Material? material = null)
    {
        var prop = new Prop(pos, art, animated, this, material);
        Objects.AddChild(prop);
        _props.Add(prop);
        // Something raised mid-fight (a stone pillar) shows at once; the rest waits for the painter.
        if (_view.Size.X > 1 && _view.Grow(PaintMargin).HasPoint(pos)) prop.SetPainted(true);
        return prop;
    }

    private const float PaintMargin = 700, UnpaintMargin = 1100;

    /// <summary>
    /// Only the scenery around the camera is painted. A painted prop keeps its shapes in GPU buffers, and a
    /// region is thousands of props; far ones let theirs go and paint again on the way back. The margin is
    /// wide enough that nothing pops in at a run or on the flying sword.
    /// </summary>
    private void PaintNearby(float dt, bool now = false)
    {
        _paintTimer -= dt;
        if (_paintTimer > 0 && !now) return;
        _paintTimer = 0.2f;
        var view = _view;
        if (view.Size.X <= 1)
        {
            var size = GetViewportRect().Size;
            view = new Rect2(PlayerBody.Pos - size / 2, size);
        }
        var near = view.Grow(PaintMargin);
        var far = view.Grow(UnpaintMargin);
        _props.RemoveAll(p => !IsInstanceValid(p) || p.IsQueuedForDeletion());
        foreach (var prop in _props)
        {
            if (near.HasPoint(prop.Position)) prop.SetPainted(true);
            else if (!far.HasPoint(prop.Position)) prop.SetPainted(false);
        }
    }

    public Actor AddActor(Fighter body)
    {
        var actor = new Actor(this, body);
        Objects.AddChild(actor);
        Actors.Add(actor);
        return actor;
    }

    public void RemoveActor(Fighter body)
    {
        var actor = Actors.FirstOrDefault(a => a.Body == body);
        if (actor == null) return;
        Actors.Remove(actor);
        actor.QueueFree();
    }

    public Actor? ActorOf(Fighter body) => Actors.FirstOrDefault(a => a.Body == body);

    // ================================================================ the frame

    public override void _Process(double delta)
    {
        var dt = Mathf.Min((float)delta, 1f / 30f);
        if (Game.Instance.Engine == null) return; // the run just ended; this screen is on its way out
        UpdateCamera(dt);
        PaintNearby(dt);
        Fx.Update(dt);
        if (Frozen)
        {
            Player.MouseAttack = false;
            return;
        }
        if (_hitstop > 0)
        {
            _hitstop -= dt;
            return;
        }

        Player.Update(dt, inputEnabled: true);
        Battle?.Update(dt);
        UpdateBodies(dt);
        UpdateField(dt);
        UpdateBattleEnd(dt);
        UpdateTarget();
    }

    /// <summary>People and creatures that aren't fighting: by default they wander.</summary>
    protected virtual void UpdateBodies(float dt)
    {
        foreach (var actor in Actors)
        {
            var b = actor.Body;
            if (b.IsPlayer || b.InBattle || !b.Alive || b.Gone) continue;
            Wander.Update(this, b, dt);
        }
    }

    /// <summary>Per-frame rules of the place (the world syncs the player's tile here).</summary>
    protected virtual void UpdateField(float dt)
    {
    }

    private void UpdateCamera(float dt)
    {
        Camera.Position = PlayerBody.Pos + new Vector2(0, -30);
        _shake = Mathf.Max(0, _shake - dt * 40);
        Camera.Offset = _shake > 0 ? new Vector2(GD.Randf() - 0.5f, GD.Randf() - 0.5f) * _shake : Vector2.Zero;
        var z = Mathf.Lerp(Camera.Zoom.X, _zoom, Mathf.Min(1, dt * 10));
        Camera.Zoom = new Vector2(z, z);
        var size = GetViewportRect().Size / Camera.Zoom;
        _view = new Rect2(Camera.GetScreenCenterPosition() - size / 2, size);
    }

    public bool OnScreen(Vector2 p, float margin) => _view.Grow(margin).HasPoint(p);

    public Rect2 View => _view;

    public void Shake(float amount)
    {
        if (Game.Instance.ScreenShake) _shake = Mathf.Max(_shake, amount);
    }

    public void Hitstop(float seconds) => _hitstop = Mathf.Max(_hitstop, seconds);

    public void Zoom(float factor) => _zoom = Mathf.Clamp(_zoom * factor, 0.6f, 1.5f);

    /// <summary>The zoom the camera is easing toward.</summary>
    public float ZoomTarget => _zoom;

    /// <summary>How fast the ground here lets you walk (roads help, swamps don't).</summary>
    public virtual float TerrainSpeed(Vector2 pos) => 1;

    /// <summary>A footstep landed here (dust, splashes).</summary>
    public virtual void OnFootstep(Vector2 pos)
    {
    }

    protected static string KeyName(string action) => KeyMap.Label(action);

    /// <summary>The key hints in the corner, named after the player's own keys (or the touch buttons).</summary>
    public virtual string HintText()
    {
        if (TouchUi.Active)
        {
            return Battle != null
                ? T("Cần gạt trái để đi · giữ nút kiếm để chém, tự nhắm kẻ gần nhất · chạm kẻ địch để chém về phía nó · linh kỹ quanh nút kiếm · nút lướt để né · chạy thật xa để thoát",
                    "Left stick moves · hold the sword button to strike (it aims at the nearest foe) · tap a foe to strike at it · arts around the sword button · the dash button dodges · run far away to escape")
                : T("Cần gạt trái để đi · chạm mặt đất để đi tới · chạm người hay vật để tới dùng · chạm yêu thú để giao chiến · chụm hai ngón để phóng to",
                    "Left stick walks · tap the ground to walk there · tap a person or thing to go and use it · tap a beast to fight · pinch to zoom");
        }
        var move = KeyMap.MoveKeys;
        if (Battle != null)
            return T($"{move} · chuột ngắm & chém · chuột phải/{KeyName("skill_2")}/{KeyName("skill_3")}/{KeyName("skill_4")} linh kỹ · {KeyName("dash")} lướt · {KeyName("ultimate")} tuyệt kỹ · {KeyName("pill")} đan dược · chạy thật xa để thoát",
                $"{move} · mouse aims & strikes · RMB/{KeyName("skill_2")}/{KeyName("skill_3")}/{KeyName("skill_4")} arts · {KeyName("dash")} dash · {KeyName("ultimate")} ultimate · {KeyName("pill")} pill · run far away to escape");
        return T($"{move} đi · {KeyName("interact")} tương tác · chém yêu thú để giao chiến · cuộn chuột phóng to",
            $"{move} walk · {KeyName("interact")} interact · strike a beast to fight · wheel zooms");
    }

    // ================================================================ interactions

    private void UpdateTarget()
    {
        if (_goingTo != null) GoOnTo(_goingTo);
        Interaction? best = null;
        var bestDist = float.MaxValue;
        if (Battle == null)
        {
            var at = PlayerBody.Pos;
            foreach (var i in Interactions)
            {
                if (!i.IsVisible) continue;
                var d = i.At().DistanceTo(at);
                if (d > i.Reach || d >= bestDist) continue;
                best = i;
                bestDist = d;
            }
        }
        Target = best;
    }

    public void Interact()
    {
        if (Battle != null || Frozen) return;
        if (Target != null) Target.Act();
        else Game.Instance.Toast("Không có gì ở đây.", "Nothing here.");
    }

    public override void _UnhandledInput(InputEvent e)
    {
        if (PanelOpen || _pause.Visible || Game.Instance.Engine == null) return;
        if (TouchUi.Active)
        {
            switch (e)
            {
                case InputEventScreenTouch touch:
                    OnTouch(touch);
                    return;
                case InputEventScreenDrag drag:
                    OnTouchDrag(drag);
                    return;
                // The mouse Godot fakes from the first finger: the touch itself was handled above.
                case InputEventMouseButton fake when fake.Device == InputEvent.DeviceIdEmulation:
                    return;
            }
        }
        if (e is InputEventMouseButton { Pressed: true } mb)
        {
            switch (mb.ButtonIndex)
            {
                case MouseButton.Left:
                    Player.MouseAttack = true;
                    break;
                case MouseButton.Right:
                    Player.MouseSkill = true;
                    break;
                case MouseButton.WheelUp:
                    Zoom(1.1f);
                    break;
                case MouseButton.WheelDown:
                    Zoom(1 / 1.1f);
                    break;
            }
            return;
        }
        if (e.IsActionPressed("pause"))
        {
            GetViewport().SetInputAsHandled();
            if (Battle != null || FreeStrikes) SetPaused(true);
            else OpenPanel(new SystemPanel());
        }
        else if (e.IsActionPressed("interact"))
        {
            GetViewport().SetInputAsHandled();
            Interact();
        }
        else if (e.IsActionPressed("debug"))
        {
            OpenPanel(new DebugPanel());
        }
        else if (Battle == null && !FreeStrikes)
        {
            if (e.IsActionPressed("open_character")) OpenPanel(new CharacterPanel());
            else if (e.IsActionPressed("open_inventory")) OpenPanel(new InventoryPanel());
            else if (e.IsActionPressed("open_journal")) OpenPanel(new JournalPanel());
            else HandleKey(e);
        }
    }

    /// <summary>Keys only some places understand (the world: N, B, Tab, M).</summary>
    protected virtual void HandleKey(InputEvent e)
    {
    }

    // ================================================================ touch: taps and pinches on the field

    private readonly Dictionary<int, (Vector2 From, Vector2 At, ulong Since)> _touches = new();
    private float _pinchFrom, _pinchZoom;
    /// <summary>Something tapped from afar: walk up to it, then use it.</summary>
    private Interaction? _goingTo;

    private Vector2 ScreenToWorld(Vector2 screen) => GetCanvasTransform().AffineInverse() * screen;

    private void OnTouch(InputEventScreenTouch t)
    {
        if (t.Pressed)
        {
            _touches[t.Index] = (t.Position, t.Position, Time.GetTicksMsec());
            if (_touches.Count == 2)
            {
                _pinchFrom = PinchSpan();
                _pinchZoom = _zoom;
            }
            // In a fight (and the trial) a tap strikes at once, toward the finger.
            else if (_touches.Count == 1 && (Battle != null || FreeStrikes)) Player.TapStrike(ScreenToWorld(t.Position));
            return;
        }
        if (!_touches.Remove(t.Index, out var touch)) return;
        if (_pinchFrom > 0)
        {
            if (_touches.Count == 0) _pinchFrom = 0;
            return;
        }
        var tap = Time.GetTicksMsec() - touch.Since < 450 && touch.From.DistanceTo(t.Position) < 28;
        if (tap && Battle == null && !FreeStrikes) OnTap(ScreenToWorld(t.Position));
    }

    private void OnTouchDrag(InputEventScreenDrag d)
    {
        if (!_touches.TryGetValue(d.Index, out var touch)) return;
        _touches[d.Index] = (touch.From, d.Position, touch.Since);
        if (_pinchFrom > 0 && _touches.Count >= 2) _zoom = Mathf.Clamp(_pinchZoom * PinchSpan() / _pinchFrom, 0.6f, 1.5f);
    }

    private float PinchSpan()
    {
        var points = _touches.Values.Take(2).Select(t => t.At).ToArray();
        return Mathf.Max(1, points[0].DistanceTo(points[1]));
    }

    /// <summary>
    /// A tap on the field while exploring: strike a beast that's in reach (or walk up to one that isn't), go
    /// and use the person or thing tapped, or else walk to the spot.
    /// </summary>
    private void OnTap(Vector2 at)
    {
        _goingTo = null;
        Fighter? beast = null;
        foreach (var actor in Actors)
        {
            var b = actor.Body;
            if (b.PackId == null || !b.Alive || b.InBattle || b.Gone || !actor.Visible) continue;
            if (at.DistanceTo(b.Pos + new Vector2(0, -20)) > b.Radius + 44) continue;
            if (beast == null || b.Pos.DistanceTo(at) < beast.Pos.DistanceTo(at)) beast = b;
        }
        if (beast != null)
        {
            if (beast.Pos.DistanceTo(PlayerBody.Pos) <= Player.StrikeReach + beast.Radius) Player.TapStrike(beast.Pos + new Vector2(0, -20));
            else Player.WalkTo(beast.Pos);
            return;
        }
        var thing = Interactions
            .Where(i => i.IsVisible && at.DistanceTo(i.At() + new Vector2(0, -i.Height / 2)) < Mathf.Max(56, i.Height * 0.6f))
            .OrderBy(i => at.DistanceTo(i.At()))
            .FirstOrDefault();
        if (thing != null)
        {
            if (thing.At().DistanceTo(PlayerBody.Pos) <= thing.Reach) thing.Act();
            else
            {
                _goingTo = thing;
                Player.WalkTo(thing.At());
            }
            return;
        }
        Player.WalkTo(at);
        Fx.Ring(at, 20, new Color(Ink.InkColor, 0.45f), 0.3f);
    }

    private void GoOnTo(Interaction thing)
    {
        var near = PlayerBody.Pos.DistanceTo(thing.At()) <= thing.Reach;
        if (Battle != null || !thing.IsVisible || (!near && Player.Route.Count == 0))
        {
            _goingTo = null;
            return;
        }
        if (!near) return;
        _goingTo = null;
        Player.Route.Clear();
        thing.Act();
    }

    /// <summary>
    /// What a strike aims at when there's no cursor (touch controls): in a fight the nearest foe, exploring a
    /// beast close by. The trials aim at their own targets.
    /// </summary>
    public virtual Vector2? AimAssist(Vector2 from)
    {
        Fighter? best = null;
        var bestDist = float.MaxValue;
        if (Battle != null)
        {
            foreach (var foe in Battle.Enemies)
            {
                if (!foe.Active || !foe.InBattle || foe.Faded) continue;
                var d = foe.Pos.DistanceTo(from);
                if (d >= bestDist) continue;
                best = foe;
                bestDist = d;
            }
        }
        else
        {
            foreach (var actor in Actors)
            {
                var b = actor.Body;
                if (b.PackId == null || !b.Alive || b.InBattle || b.Gone || !actor.Visible) continue;
                var d = b.Pos.DistanceTo(from);
                if (d > 260 + b.Radius || d >= bestDist) continue;
                best = b;
                bestDist = d;
            }
        }
        return best == null ? null : best.Pos + new Vector2(0, -20);
    }

    public void SetPaused(bool paused)
    {
        _pause.Visible = paused;
        if (paused) _pause.Refresh();
    }

    // ================================================================ panels

    public void OpenPanel(InkPanel panel)
    {
        if (PanelOpen) _panel!.Close();
        Player.Route.Clear();
        Player.MouseAttack = false;
        _panel = panel;
        _dim.Visible = true;
        SoundBoard.Play("open", -4);
        panel.Closed += () =>
        {
            if (_panel != panel) return;
            _panel = null;
            _dim.Visible = false;
            SoundBoard.Play("close", -6);
            Callable.From(CheckPending).CallDeferred();
        };
        _panelHost.AddChild(panel);
    }

    public void ClosePanel()
    {
        if (PanelOpen) _panel!.Close();
    }

    /// <summary>What the world forces on you once nothing else is on screen: death, then an ambush.</summary>
    protected void CheckPending()
    {
        if (PanelOpen || Game.Instance.Engine == null || !IsInsideTree()) return;
        if (E.Player.Dead) OpenPanel(new DeathPanel());
        else if (Battle == null) OnPending();
    }

    protected virtual void OnPending()
    {
    }

    // ================================================================ fights

    /// <summary>
    /// Start a fight here. Existing bodies (a pack that met you, the person you challenged) become the
    /// combatants; anyone else is spawned around <paramref name="around"/>. <paramref name="after"/> runs
    /// once the engine has resolved the outcome.
    /// </summary>
    public Battle? StartBattle(Encounter enc, IList<Fighter>? bodies = null, Vector2? around = null,
        Action<CombatResolution, CombatOutcome>? after = null)
    {
        if (Battle != null) return null;
        Player.Land(force: true);
        var list = E.BuildEnemies(enc);
        var battle = new Battle(this, enc, Player);
        var center = around ?? PlayerBody.Pos;
        var pool = bodies?.ToList() ?? new List<Fighter>();
        for (var i = 0; i < list.Count; i++)
        {
            var inst = list[i];
            // A body of the same kind first (a boar's stats never land on a wolf), else whoever is left.
            var body = pool.FirstOrDefault(b => b.Kind == inst.Template.Id) ?? pool.FirstOrDefault();
            if (body != null)
            {
                pool.Remove(body);
            }
            else
            {
                body = SpawnFoe(inst, center, i, list.Count, enc);
                _temporary.Add(body);
            }
            battle.AddEnemy(body, inst);
            if (enc.DisplayName != null && list.Count == 1) body.Name = enc.DisplayName;
        }
        // Anyone the encounter didn't need steps back.
        foreach (var extra in pool) extra.AggroCd = 8;

        var groups = battle.Enemies.GroupBy(x => x.Name).Select(g => g.Count() > 1 ? $"{g.Key} ×{g.Count()}" : g.Key);
        battle.Title = string.Join(", ", groups);
        Battle = battle;
        _afterBattle = after;
        _endTimer = -1;
        Player.BeginBattle();
        Player.Route.Clear();
        var subtitle = enc.Source switch
        {
            "trial" => T("Khảo hạch nhập môn — tỉ thí tới 15% khí huyết", "Entrance trial — a spar to 15% health"),
            "spar" => T("Luận bàn — tỉ thí tới 15% khí huyết", "Spar — to 15% health"),
            "ambush" => T("Phục kích!", "Ambush!"),
            "npc" => T("Sinh tử quyết đấu", "A fight to the death"),
            _ => battle.Title,
        };
        Hud.Banner(enc.NonLethal ? T("Tỉ thí!", "Spar!") : T("Chiến!", "Fight!"), subtitle, Ink.CinnabarDeep, 1.1f);
        SoundBoard.Play("battle");
        SoundBoard.Music("battle");
        Shake(5);
        Game.Instance.Changed();
        return battle;
    }

    /// <summary>
    /// Fight an encounter the rules started elsewhere (a panel's spar or trial, an event, an ambush):
    /// the bodies already on the field take part, anyone missing appears nearby.
    /// </summary>
    public void Fight(Encounter enc, Action<CombatResolution, CombatOutcome>? after = null)
    {
        ClosePanel();
        if (StartBattle(enc, BodiesFor(enc), after: after) == null && E.ActiveEncounter == enc) E.AbandonEncounter();
    }

    /// <summary>Which bodies on this field an encounter is about (the person you challenged, a pack).</summary>
    protected virtual IList<Fighter>? BodiesFor(Encounter enc) => null;

    /// <summary>A foe that wasn't standing here already steps out of the mist near <paramref name="center"/>.</summary>
    protected virtual Fighter SpawnFoe(EnemyInstance inst, Vector2 center, int index, int count, Encounter enc)
    {
        var def = inst.Template;
        var facing = FieldMath.Angle(PlayerBody.Facing);
        var angle = facing + (count == 1 ? 0 : (index - (count - 1) / 2f) * 0.55f);
        var dist = enc.Source == "ambush" ? 320f : 250f;
        var pos = Walls.NearestFree(center + Vector2.Right.Rotated(angle) * dist, (float)def.Radius, 320);
        var body = new Fighter
        {
            Id = inst.InstanceId, Kind = def.Id, Look = Figures.IsHuman(def.Id) ? Look.ForEnemy(def.Id) : null,
            Radius = (float)def.Radius, Pos = pos, Home = pos, Facing = (PlayerBody.Pos - pos).Normalized(),
        };
        body.Side = body.Facing.X < 0 ? -1 : 1;
        AddActor(body);
        Fx.Burst(pos + new Vector2(0, -24), new Color(0.2f, 0.22f, 0.28f, 0.35f), 14, 120, ParticleKind.Mist, 9);
        return body;
    }

    /// <summary>The nearest creature in front of the player that a strike would start a fight with.</summary>
    public virtual Fighter? FindEngageTarget(Vector2 from, Vector2 dir, float reach)
    {
        Fighter? best = null;
        var bestDist = float.MaxValue;
        foreach (var actor in Actors)
        {
            var b = actor.Body;
            if (b.PackId == null || !b.Alive || b.InBattle || b.Gone || !actor.Visible) continue;
            var d = b.Pos.DistanceTo(from);
            if (d > reach + b.Radius || d >= bestDist) continue;
            if (!FieldMath.InArc(from, dir, 150, reach, b.Pos, b.Radius)) continue;
            best = b;
            bestDist = d;
        }
        return best;
    }

    /// <summary>Start a fight with <paramref name="foe"/> (and whoever is with it). False if it can't start.</summary>
    public virtual bool Engage(Fighter foe) => false;

    private void UpdateBattleEnd(float dt)
    {
        if (Battle is not { Over: true } b) return;
        var outcome = b.Outcome!;
        if (_endTimer < 0)
        {
            _endTimer = outcome.Fled ? 0.5f : 1.4f;
            if (outcome.Victory) Hud.Banner(T("Thắng!", "Victory!"), b.Title, Ink.JadeDeep, 1.6f);
            else if (outcome.Fled) Hud.Banner(T("Thoát thân!", "Escaped!"), "", Ink.InkSoft, 1f);
            else Hud.Banner(b.NonLethal ? T("Chịu thua", "You yield") : T("Gục ngã…", "Defeated…"), "", Ink.CinnabarDeep, 1.8f);
            SoundBoard.Play(outcome.Victory ? "victory" : outcome.Fled ? "escape" : "defeat");
            SoundBoard.Music(MusicMood);
            return;
        }
        _endTimer -= dt;
        if (_endTimer <= 0) FinishBattle();
    }

    /// <summary>Hand the outcome to the engine (loot, exp, consequences), then put the field back in order.</summary>
    private void FinishBattle()
    {
        var b = Battle!;
        var outcome = b.Outcome!;
        _endTimer = -1;
        var resolution = E.ResolveCombat(outcome);
        Battle = null;
        Player.EndBattle();
        foreach (var body in b.Enemies)
        {
            body.InBattle = false;
            if (_temporary.Contains(body) || !body.Alive)
            {
                RemoveActor(body);
                continue;
            }
            body.ResetCombat();
            body.Hp = body.HpMax;
            body.AggroCd = 10;
        }
        _temporary.Clear();
        Player.SyncFromEngine();
        Game.Instance.SaveGame();
        Game.Instance.Remember(resolution.Events);
        Hud.ShowResult(resolution, outcome, b.Title);
        OnBattleFinished(b, resolution, outcome);
        var after = _afterBattle;
        _afterBattle = null;
        Game.Instance.Changed();
        if (E.Player.Dead)
        {
            OpenPanel(new DeathPanel());
            return;
        }
        after?.Invoke(resolution, outcome);
        if (!PanelOpen && after == null && resolution.FollowUpEventId != null)
            OpenPanel(new EventPanel(null, resolution.FollowUpEventId));
    }

    /// <summary>The place reacts to a finished fight (the world re-syncs beasts, a defeat carries you to town).</summary>
    protected virtual void OnBattleFinished(Battle battle, CombatResolution resolution, CombatOutcome outcome)
    {
    }

    /// <summary>Esc → flee: give up the fight on the spot (the movement art costs footwork on the map).</summary>
    public virtual void Flee()
    {
        SetPaused(false);
        Battle?.End(victory: false, fled: true);
    }

    /// <summary>The trial and realm override what "leave" means from the pause menu.</summary>
    public virtual string FleeLabel => T("Độn thuật — bỏ chạy", "Flee the fight");
    public virtual string FleeNote => T("Chạy xa khỏi mọi kẻ địch cũng là thoát thân. Bỏ chạy tốn 1 cước lực; kẻ địch vẫn ở đó.",
        "Running far from every foe also escapes. Fleeing costs 1 footwork; the enemy stays where it was.");

    // ================================================================ hooks for the trial

    public virtual void OnPlayerSlash(Vector2 origin, Vector2 dir, float arc, float reach)
    {
    }

    public virtual void OnPlayerDash(Vector2 pos, float radius)
    {
    }

    // ================================================================ transitions

    /// <summary>Fade to paper, run <paramref name="then"/>, fade back in.</summary>
    public void FadeThrough(Action then, float seconds = 0.35f)
    {
        if (_fading) return;
        _fading = true;
        var tween = _fade.CreateTween();
        tween.TweenProperty(_fade, "color:a", 1f, seconds);
        tween.TweenCallback(Callable.From(() =>
        {
            then();
            if (!IsInsideTree()) return;
            Camera.ResetSmoothing();
        }));
        tween.TweenProperty(_fade, "color:a", 0f, seconds);
        tween.TweenCallback(Callable.From(() => _fading = false));
    }

    /// <summary>Put the player somewhere else on this field (a defeat, a map jump).</summary>
    public void Teleport(Vector2 to)
    {
        PlayerBody.Pos = Walls.NearestFree(to, PlayerBody.Radius, 400);
        PlayerBody.LastPos = PlayerBody.Pos;
        Player.Route.Clear();
        Camera.Position = PlayerBody.Pos;
        Camera.ResetSmoothing();
        // Paint the new surroundings on the next frame.
        _paintTimer = 0;
    }
}

/// <summary>A slice of building a place: how far along (0–1), and what it was doing.</summary>
public readonly record struct BuildStep(float Progress, string Vi, string En);
