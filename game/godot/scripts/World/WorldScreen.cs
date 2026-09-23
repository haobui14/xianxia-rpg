using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Combat;
using TuTien.Core.World;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.World;

/// <summary>
/// The strategic layer (design §7.2): walk the region map with a monthly footwork budget,
/// interact with what you find, and end the month to let the world move.
/// </summary>
public partial class WorldScreen : Node2D
{
    private const float StepInterval = 0.13f;

    private GameEngine E => Game.Instance.Engine!;
    private MapView _map = null!;
    private Camera2D _camera = null!;
    private Hud _hud = null!;
    private Control _panelHost = null!;
    private ColorRect _dim = null!;
    private InkPanel? _panel;

    private readonly Queue<Cell> _walk = new();
    private float _stepTimer;
    private Vector2I _heldDir;
    private float _holdTimer;

    public MapView Map => _map;
    public bool PanelOpen => _panel != null && IsInstanceValid(_panel);
    public InkPanel? CurrentPanel => PanelOpen ? _panel : null;

    public override void _Ready()
    {
        _map = new MapView();
        AddChild(_map);

        // Generous limits keep the player near the center, clear of the HUD cards in the corners.
        _camera = new Camera2D
        {
            PositionSmoothingEnabled = true,
            PositionSmoothingSpeed = 6,
            LimitLeft = -480,
            LimitTop = -360,
        };
        AddChild(_camera);
        _camera.LimitRight = (int)_map.WorldSize.X + 480;
        _camera.LimitBottom = (int)_map.WorldSize.Y + 360;
        _camera.Position = _map.PlayerDrawPos;
        _camera.MakeCurrent();
        _camera.ResetSmoothing();

        var ui = new CanvasLayer { Layer = 10 };
        AddChild(ui);
        _hud = new Hud(this);
        ui.AddChild(_hud);

        var modal = new CanvasLayer { Layer = 20 };
        AddChild(modal);
        _dim = new ColorRect { Color = new Color(0.08f, 0.09f, 0.13f, 0.45f), Visible = false, MouseFilter = Control.MouseFilterEnum.Stop };
        _dim.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        modal.AddChild(_dim);
        _panelHost = new CenterContainer { MouseFilter = Control.MouseFilterEnum.Ignore };
        _panelHost.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        modal.AddChild(_panelHost);

        Game.Instance.StateChanged += OnStateChanged;
        Callable.From(CheckPending).CallDeferred();
    }

    public override void _ExitTree() => Game.Instance.StateChanged -= OnStateChanged;

    private void OnStateChanged() => _map.RedrawTerrain();

    /// <summary>Things the world forces on you once nothing else is on screen: death, then an ambush.</summary>
    private void CheckPending()
    {
        if (PanelOpen || Game.Instance.Engine == null) return;
        if (E.Player.Dead) OpenPanel(new DeathPanel());
        else if (E.State.World.PendingAmbush != null) OpenPanel(new AmbushPanel());
    }

    public override void _Process(double delta)
    {
        _camera.Position = _map.PlayerDrawPos;
        if (PanelOpen) return;
        if (_walk.Count == 0)
        {
            HeldMovement((float)delta);
            return;
        }
        _stepTimer -= (float)delta;
        if (_stepTimer > 0) return;
        _stepTimer = StepInterval;
        DoStep(_walk.Dequeue());
    }

    /// <summary>
    /// WASD / d-pad / stick: one step on press, then a steady walk while held — not the OS key
    /// repeat, which would burn a month's footwork in a blink.
    /// </summary>
    private void HeldMovement(float delta)
    {
        var dir = Input.IsActionPressed("move_up") ? new Vector2I(0, -1)
            : Input.IsActionPressed("move_down") ? new Vector2I(0, 1)
            : Input.IsActionPressed("move_left") ? new Vector2I(-1, 0)
            : Input.IsActionPressed("move_right") ? new Vector2I(1, 0)
            : Vector2I.Zero;
        if (dir == Vector2I.Zero)
        {
            _heldDir = Vector2I.Zero;
            return;
        }
        if (dir != _heldDir)
        {
            _heldDir = dir;
            _holdTimer = 0.3f;
        }
        else if ((_holdTimer -= delta) > 0)
        {
            return;
        }
        else
        {
            _holdTimer = StepInterval + 0.05f;
        }
        // A held key against a wall shouldn't spam the same toast.
        if (!StepBy(dir.X, dir.Y)) _holdTimer = 1.2f;
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        if (PanelOpen) return;

        if (@event is InputEventMouseMotion)
        {
            UpdateHover();
            return;
        }
        if (@event is InputEventMouseButton { Pressed: true } mb)
        {
            if (mb.ButtonIndex == MouseButton.WheelUp) Zoom(1.1f);
            else if (mb.ButtonIndex == MouseButton.WheelDown) Zoom(1 / 1.1f);
            else if (mb.ButtonIndex == MouseButton.Left) ClickTile();
            return;
        }

        if (@event.IsActionPressed("pause")) OpenPanel(new SystemPanel());
        else if (@event.IsActionPressed("debug")) OpenPanel(new DebugPanel());
        else if (_walk.Count > 0) return;
        else if (@event.IsActionPressed("interact")) Interact();
        else if (@event.IsActionPressed("end_month")) EndMonth();
        else if (@event.IsActionPressed("pulse")) Pulse();
        else if (@event.IsActionPressed("seclude")) OpenPanel(new SeclusionPanel());
        else if (@event.IsActionPressed("open_character")) OpenPanel(new CharacterPanel());
        else if (@event.IsActionPressed("open_inventory")) OpenPanel(new InventoryPanel());
        else if (@event.IsActionPressed("open_journal")) OpenPanel(new JournalPanel());
    }

    private void Zoom(float factor)
    {
        var z = Mathf.Clamp(_camera.Zoom.X * factor, 0.55f, 1.6f);
        _camera.Zoom = new Vector2(z, z);
    }

    private void UpdateHover()
    {
        var cell = MapView.CellAt(GetGlobalMousePosition());
        if (_map.Hover == cell) return;
        _map.Hover = cell;
        var revealed = E.Map.InBounds(cell.X, cell.Y) && E.Fog().Get(cell.X, cell.Y);
        _map.PlannedPath = revealed && _walk.Count == 0 ? E.PlanPath(cell.X, cell.Y) : null;
        _hud.ShowTileInfo(cell, _map.PlannedPath);
    }

    private void ClickTile()
    {
        if (_walk.Count > 0)
        {
            _walk.Clear(); // a second click stops walking
            return;
        }
        var path = _map.PlannedPath;
        if (path == null || path.Steps.Count == 0) return;
        foreach (var step in path.Steps) _walk.Enqueue(step);
        _stepTimer = 0;
        _map.PlannedPath = null;
    }

    public bool StepBy(int dx, int dy) => DoStep(new Cell(E.Player.X + dx, E.Player.Y + dy));

    /// <summary>Take one step; false when something blocked it.</summary>
    private bool DoStep(Cell target)
    {
        var result = E.StepTo(target.X, target.Y);
        if (result.Blocked != null)
        {
            _walk.Clear();
            Game.Instance.Toast(result.Blocked, result.BlockedEn ?? result.Blocked);
            return false;
        }
        if (result.Encounter != null)
        {
            _walk.Clear();
            Game.Instance.Changed();
            Main.Instance.ShowArena(result.Encounter);
            return true;
        }
        Game.Instance.Changed();
        if (result.AdventureId != null)
        {
            _walk.Clear();
            OpenPanel(new EventPanel(result.AdventureId, null));
        }
        return true;
    }

    /// <summary>E: act on whatever is here — a place on this tile first, then people and beasts next to you.</summary>
    public void Interact()
    {
        var near = E.InteractablesNear();
        var here = near.FirstOrDefault(t => t.X == E.Player.X && t.Y == E.Player.Y && t.Kind != InteractKind.Npc && t.Kind != InteractKind.Beast);
        if (here != null)
        {
            OpenFor(here);
            return;
        }
        var npc = near.FirstOrDefault(t => t.Kind == InteractKind.Npc);
        if (npc != null)
        {
            OpenPanel(new NpcPanel(npc.Id));
            return;
        }
        var beast = near.FirstOrDefault(t => t.Kind == InteractKind.Beast);
        if (beast != null)
        {
            DoStep(new Cell(beast.X, beast.Y));
            return;
        }
        Game.Instance.Toast("Không có gì ở đây.", "Nothing here.");
    }

    public void OpenFor(Interactable thing)
    {
        var poi = E.Poi(thing.Id);
        switch (thing.Kind)
        {
            case InteractKind.Town when poi != null:
                OpenPanel(new TownPanel(poi));
                break;
            case InteractKind.Sect when poi != null:
                OpenPanel(new SectPanel(poi));
                break;
            case InteractKind.SecretRealm when poi != null:
                OpenPanel(new RealmPanel(poi));
                break;
            case InteractKind.SpiritVein:
                OpenPanel(new SeclusionPanel());
                break;
            case InteractKind.Herb:
                Game.Instance.Notify(E.Gather(thing.Id));
                break;
            case InteractKind.Pass:
                Game.Instance.Toast(
                    "Cửa ải dẫn tới vùng khác — sẽ mở ở cột mốc M4 (thế giới 5 vùng).",
                    "This pass leads to another region — opens in milestone M4 (the 5-region world).");
                break;
            case InteractKind.Adventure:
                OpenPanel(new EventPanel(thing.Id, null));
                break;
        }
    }

    public void EndMonth()
    {
        _walk.Clear();
        var report = E.EndMonth();
        Game.Instance.SaveGame();
        Game.Instance.Changed();
        OpenPanel(new MonthReportPanel(report));
    }

    public void Pulse()
    {
        if (E.Pulse())
        {
            Game.Instance.Toast("Thần thức quét rộng — mọi động tĩnh quanh ngươi hiện rõ.", "Your spiritual sense sweeps outward.");
            Game.Instance.Changed();
        }
        else
        {
            Game.Instance.Toast("Cần 10 linh lực để phóng thần thức.", "A sense pulse needs 10 Qi.");
        }
    }

    public void OpenPanel(InkPanel panel)
    {
        if (PanelOpen) _panel!.Close();
        _walk.Clear();
        _panel = panel;
        _dim.Visible = true;
        panel.Closed += () =>
        {
            if (_panel != panel) return;
            _panel = null;
            _dim.Visible = false;
            Callable.From(CheckPending).CallDeferred();
        };
        _panelHost.AddChild(panel);
    }

    public void ClosePanel()
    {
        if (PanelOpen) _panel!.Close();
    }

    // ------------------------------------------------------------------ after other screens

    public void AfterCombat(CombatResolution resolution, CombatOutcome outcome, System.Func<InkPanel>? thenOpen = null)
    {
        Game.Instance.Notify(resolution.Events);
        OpenPanel(new CombatResultPanel(resolution, outcome, thenOpen));
    }

    public void ShowBreakthroughResult(List<GameEvent> events, double performance) =>
        OpenPanel(new BreakthroughResultPanel(events, performance));
}
