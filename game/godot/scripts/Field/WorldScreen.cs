using System;
using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Combat;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTien.Core.World;
using TuTienLuc.Art;
using TuTienLuc.Audio;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.Field;

/// <summary>
/// The region, walked in real time (design §7.2 reworked for a top-down world): the body moves freely,
/// and every time it crosses into another tile the engine charges that tile's footwork. When the
/// month's footwork is spent the month turns by itself and you keep walking ("time flows as you
/// travel"). Beasts prowl their patch and aggressive packs come for you; touching them — or striking
/// first — starts the fight on the spot.
/// </summary>
public partial class WorldScreen : FieldScreen
{
    public const float Cell = 128;

    private sealed class Occluder
    {
        public Prop Prop = null!;
        public Vector2 Extent;
    }

    public Season Season { get; private set; }

    private readonly Vector2? _spawn;
    private ShaderMaterial _groundMat = null!;
    private ShaderMaterial _sway = null!;
    private Image _fogImage = null!;
    private ImageTexture _fogTex = null!;
    private FogMask _fog = null!;
    private Vector2I _tile;
    private MonthReport? _monthPending;
    private GameEngine? _engine;
    private List<Occluder>?[] _occluders = null!;
    private readonly HashSet<Prop> _faded = new();
    private readonly List<Prop> _scenery = new();
    private readonly Dictionary<string, Fighter> _npcs = new();
    private readonly Dictionary<string, Interaction> _npcTalk = new();
    private readonly Dictionary<string, List<Fighter>> _packs = new();
    private readonly HashSet<Fighter> _hunting = new();
    private readonly Dictionary<string, (Prop Prop, Interaction Talk)> _adventures = new();
    private readonly Dictionary<string, Prop> _herbs = new();
    private bool _syncDirty;
    private float _syncTimer;
    private float _visTimer;

    public WorldScreen(Vector2? spawn = null) => _spawn = spawn;

    public override string PlaceName => E.ZoneHere is { } z ? T(z.Name, z.NameEn) : T(E.Map.Def.Name, E.Map.Def.NameEn);

    public override string PlaceSub
    {
        get
        {
            var z = E.ZoneHere;
            if (z == null) return T(E.Map.Def.Name, E.Map.Def.NameEn);
            var tag = z.IsSafe ? T("an toàn", "safe") : T($"hiểm {z.DangerLevel}", $"danger {z.DangerLevel}");
            if (z.CultivationBonus > 0) tag += T($" · linh khí +{z.CultivationBonus}%", $" · qi +{z.CultivationBonus}%");
            return tag;
        }
    }

    public Vector2I Tile => _tile;
    public FogMask FogMask => _fog;
    public static Vector2 TileCenter(int x, int y) => new((x + 0.5f) * Cell, (y + 0.5f) * Cell);

    // ================================================================ building

    /// <summary>The region, a slice at a time: the land and rivers, then the scenery a row of tiles at a time.</summary>
    protected override IEnumerable<BuildStep> BuildSteps()
    {
        var map = E.Map;
        Walls = new CollisionWorld(map.Width, map.Height, Cell);
        _occluders = new List<Occluder>?[map.Width * map.Height];
        for (var y = 0; y < map.Height; y++)
        {
            for (var x = 0; x < map.Width; x++)
            {
                var t = map.At(x, y);
                var border = x == 0 || y == 0 || x == map.Width - 1 || y == map.Height - 1;
                if (t == Terrain.Water) Walls.SetSolid(x, y, walk: true, shots: false);
                else if (t == Terrain.Peak || (t == Terrain.Mountain && border)) Walls.SetSolid(x, y, walk: true, shots: true);
                if (t == Terrain.Bridge) BridgeRails(map, x, y);
            }
        }
        yield return new BuildStep(0.03f, "Trải đất, khơi sông", "Laying the land, carving the rivers");

        Season = Calendar.SeasonOf(E.Content, E.State.Calendar.Month);
        _sway = ShaderQuad.MakeMaterial("res://shaders/sway.gdshader", new Dictionary<string, Variant> { ["strength"] = 1f });
        var noise = TerrainTextures.Noise();
        var terrain = TerrainTextures.Terrain(map.Width, map.Height, (x, y) => (int)map.At(x, y));
        var cells = new Vector2(map.Width, map.Height);
        _groundMat = ShaderQuad.MakeMaterial("res://shaders/terrain.gdshader", new Dictionary<string, Variant>
        {
            ["terrain_tex"] = terrain, ["noise_tex"] = noise, ["map_cells"] = cells, ["cell_px"] = Cell, ["season"] = (int)Season,
        });
        var area = new Rect2(-256, -256, map.Width * Cell + 512, map.Height * Cell + 512);
        AddChild(new ShaderQuad(area, _groundMat, -20));

        _fogImage = TerrainTextures.FogImage(map.Width, map.Height);
        _fogTex = ImageTexture.CreateFromImage(_fogImage);
        var fogMat = ShaderQuad.MakeMaterial("res://shaders/fog.gdshader", new Dictionary<string, Variant>
        {
            ["fog_tex"] = _fogTex, ["noise_tex"] = noise, ["map_cells"] = cells, ["cell_px"] = Cell, ["strength"] = 1f,
        });
        AddChild(new ShaderQuad(area, fogMat, 20));
        AddChild(new Ambience(this, () => Season));
        yield return new BuildStep(0.1f, "Trải đất, khơi sông", "Laying the land, carving the rivers");

        foreach (var step in WorldScenery.Build(this))
            yield return step with { Progress = 0.1f + 0.9f * step.Progress };
    }

    /// <summary>A bridge tile: the deck is walkable, the water on either side is not.</summary>
    private void BridgeRails(MapGrid map, int x, int y)
    {
        bool Links(int nx, int ny) => map.InBounds(nx, ny) && map.At(nx, ny) is Terrain.Road or Terrain.Bridge or Terrain.Town or Terrain.Sect;
        var horizontal = Links(x - 1, y) || Links(x + 1, y);
        const float deck = 30;
        if (horizontal)
        {
            Walls.Add(Obstacle.Box(new Rect2(x * Cell, y * Cell, Cell, Cell / 2 - deck), shots: false));
            Walls.Add(Obstacle.Box(new Rect2(x * Cell, y * Cell + Cell / 2 + deck, Cell, Cell / 2 - deck), shots: false));
        }
        else
        {
            Walls.Add(Obstacle.Box(new Rect2(x * Cell, y * Cell, Cell / 2 - deck, Cell), shots: false));
            Walls.Add(Obstacle.Box(new Rect2(x * Cell + Cell / 2 + deck, y * Cell, Cell / 2 - deck, Cell), shots: false));
        }
    }

    /// <summary>Scenery with optional wind sway, animation, and fading when the player walks behind it.</summary>
    public Prop AddScenery(Vector2 at, Action<Brush, float> art, bool animated = false, bool occludes = false, bool sway = false, Vector2? extent = null)
    {
        var prop = AddProp(at, art, animated, sway ? _sway : null);
        _scenery.Add(prop);
        if (occludes)
        {
            var c = Walls.CellOf(at);
            if (Walls.InBounds(c.X, c.Y))
                (_occluders[c.Y * Walls.Width + c.X] ??= new List<Occluder>()).Add(new Occluder { Prop = prop, Extent = extent ?? new Vector2(48, 112) });
        }
        return prop;
    }

    protected override Vector2 SpawnPoint() => _spawn ?? FreeSpotInTile(E.Player.X, E.Player.Y);

    /// <summary>A free spot inside the tile (a house may stand on its centre), so arriving never costs a step.</summary>
    private Vector2 FreeSpotInTile(int x, int y)
    {
        var center = TileCenter(x, y);
        for (var r = 0f; r <= 60; r += 8)
        {
            var n = r == 0 ? 1 : 16;
            for (var i = 0; i < n; i++)
            {
                var p = center + Vector2.Right.Rotated(Mathf.Tau * i / n) * r;
                if (Walls.Free(p, 14) && Walls.CellOf(p) == new Vector2I(x, y)) return p;
            }
        }
        return center;
    }

    protected override void AfterReady()
    {
        _engine = E;
        _engine.MonthEnded += OnMonthEnded;
        _tile = new Vector2I(E.Player.X, E.Player.Y);
        // The body may have been nudged out of a wall into the next tile; the engine follows.
        var cell = Walls.CellOf(PlayerBody.Pos);
        if (cell != _tile) CrossInto(cell);
        RefreshFog();
        SyncActors();
    }

    public override void _ExitTree()
    {
        base._ExitTree();
        if (_engine != null) _engine.MonthEnded -= OnMonthEnded;
    }

    protected override void OnStateChanged()
    {
        base.OnStateChanged();
        _syncDirty = true;
    }

    // ================================================================ the frame

    protected override void UpdateField(float dt)
    {
        if (_monthPending != null) HandleMonth();
        var cell = Walls.CellOf(PlayerBody.Pos);
        if (cell != _tile) CrossInto(cell);
        UpdateAggro(dt);
        UpdateOcclusion();

        _syncTimer -= dt;
        if (_syncDirty && _syncTimer <= 0 && Battle == null)
        {
            _syncDirty = false;
            _syncTimer = 0.3f;
            SyncActors();
        }
        _visTimer -= dt;
        if (_visTimer <= 0)
        {
            _visTimer = 0.25f;
            UpdateVisibility();
        }
    }

    protected override void UpdateBodies(float dt)
    {
        foreach (var actor in Actors)
        {
            var b = actor.Body;
            if (b.IsPlayer || !b.Alive || b.Gone) continue;
            if (b.InBattle || _hunting.Contains(b)) continue;
            if (b.AggroCd > 0 && b.Pos.DistanceTo(b.Home) > b.WanderRadius + 40)
            {
                b.AggroCd -= dt;
                Wander.ReturnHome(this, b, dt, 110);
                continue;
            }
            Wander.Update(this, b, dt);
        }
    }

    /// <summary>What a footstep kicks up: dust on dirt roads, a splash in the swamp, a puff of snow.</summary>
    public override void OnFootstep(Vector2 pos)
    {
        var c = Walls.CellOf(pos);
        if (!E.Map.InBounds(c.X, c.Y)) return;
        var t = E.Map.At(c.X, c.Y);
        if (Season == Season.Winter && t is not (Terrain.Road or Terrain.Town or Terrain.Sect or Terrain.Bridge))
        {
            Fx.Particles.Add(new Particle
            {
                Pos = pos + new Vector2(GD.Randf() * 8 - 4, 0), Vel = new Vector2(GD.Randf() * 30 - 15, -20), Life = 0.45f, MaxLife = 0.45f,
                Size = 4, Color = new Color(1, 1, 1, 0.7f), Kind = ParticleKind.Mist, Drag = 3,
            });
            return;
        }
        switch (t)
        {
            case Terrain.Road or Terrain.Town:
                Fx.Dust(pos, 1);
                break;
            case Terrain.Swamp:
                Fx.Ring(pos + new Vector2(0, 2), 9, new Color(0.35f, 0.45f, 0.42f, 0.8f), 0.4f);
                break;
            case Terrain.Forest or Terrain.DenseForest when GD.Randf() < 0.12f:
                Fx.Leaves(pos + new Vector2(0, -6), Season == Season.Autumn ? new Color("#c0602f") : new Color("#6f9a55"), 1);
                break;
        }
    }

    public override float TerrainSpeed(Vector2 pos)
    {
        var c = Walls.CellOf(pos);
        if (!E.Map.InBounds(c.X, c.Y)) return 1;
        return E.Map.At(c.X, c.Y) switch
        {
            Terrain.Road => 1.15f,
            Terrain.Bridge => 1.1f,
            Terrain.Town or Terrain.Sect => 1.05f,
            Terrain.Forest => 0.88f,
            Terrain.DenseForest => 0.76f,
            Terrain.Hills => 0.9f,
            Terrain.Mountain => 0.78f,
            Terrain.Swamp => 0.66f,
            _ => 1f,
        };
    }

    /// <summary>The body crossed into another tile: the engine charges the footwork (and may turn the month).</summary>
    private void CrossInto(Vector2I cell)
    {
        var p = E.Player;
        // Walking only ever crosses into a neighbour (a dash can clip a corner). Anything wider follows
        // the cheapest real path, so the engine never "walks" through water.
        var far = Math.Abs(cell.X - _tile.X) + Math.Abs(cell.Y - _tile.Y) > 2;
        var path = far ? E.PlanPath(cell.X, cell.Y)?.Steps.Select(s => new Vector2I(s.X, s.Y)).ToList() : null;
        for (var guard = 0; _tile != cell && guard < 64; guard++)
        {
            Vector2I next;
            if (path is { Count: > 0 })
            {
                next = path[0];
                path.RemoveAt(0);
            }
            else
            {
                var sx = Math.Sign(cell.X - _tile.X);
                var sy = Math.Sign(cell.Y - _tile.Y);
                next = sx != 0 && sy != 0
                    ? (E.Map.StepCost(_tile.X + sx, _tile.Y, p) >= 0 ? new Vector2I(_tile.X + sx, _tile.Y) : new Vector2I(_tile.X, _tile.Y + sy))
                    : new Vector2I(_tile.X + sx, _tile.Y + sy);
            }
            var result = E.Travel(next.X, next.Y);
            if (!result.Moved)
            {
                if (!E.Player.Dead) PlayerBody.Pos = Walls.NearestFree(TileCenter(_tile.X, _tile.Y), PlayerBody.Radius, 300);
                break;
            }
            _tile = next;
        }
        RefreshFog();
        Game.Instance.Changed();
    }

    /// <summary>
    /// Tests and dev tools only: put the player somewhere without walking there. The engine's position
    /// is set directly (through <see cref="Dev.DevCheats"/>), so no footwork is spent and no month turns.
    /// </summary>
    public void DebugPlace(Vector2 pos)
    {
        Teleport(pos);
        var c = Walls.CellOf(PlayerBody.Pos);
        Dev.DevCheats.Place(E, c.X, c.Y);
        _tile = c;
        RefreshFog();
        _syncDirty = true;
        Game.Instance.Changed();
    }

    /// <summary>Step onto a place's own tile (a spirit vein's bonus only counts standing on it).</summary>
    public void EnterTile(int x, int y, Vector2 spot)
    {
        if (_tile.X == x && _tile.Y == y) return;
        PlayerBody.Pos = spot;
        CrossInto(Walls.CellOf(spot));
    }

    // ================================================================ the month

    private void OnMonthEnded(MonthReport report) => _monthPending = report;

    /// <summary>The month turned (footwork ran out on the road, or N): show it, save, let the world move.</summary>
    private void HandleMonth()
    {
        var report = _monthPending!;
        _monthPending = null;
        Hud.ShowMonth(report);
        SoundBoard.Play("month", -2);
        Game.Instance.Remember(report.Events);
        ApplySeason();
        SyncActors();
        RefreshFog();
        Game.Instance.SaveGame();
        if (E.Player.Dead)
        {
            OpenPanel(new DeathPanel());
            return;
        }
        if (E.State.World.PendingAmbush != null) StartAmbush();
        else if (E.BreakthroughReady) Game.Instance.Toast("Tu vi viên mãn — có thể đột phá!", "Cultivation full — you can break through!", EventLevel.Major);
    }

    public void EndMonth()
    {
        if (Battle != null || Frozen) return;
        E.EndMonth();
    }

    public void Pulse()
    {
        if (Battle != null || Frozen) return;
        if (E.Pulse())
        {
            Game.Instance.Toast("Thần thức quét rộng — mọi động tĩnh quanh ngươi hiện rõ.", "Your spiritual sense sweeps outward.");
            SoundBoard.Play("pulse");
            Fx.Ring(PlayerBody.Pos, E.SenseRadius * Cell, Ink.Jade, 1.1f);
            RefreshFog();
            UpdateVisibility();
            Game.Instance.Changed();
        }
        else
        {
            Game.Instance.Toast(E.Player.SensePulse ? "Thần thức đang mở rộng tới hết tháng." : "Cần 10 linh lực để phóng thần thức.",
                E.Player.SensePulse ? "Your sense is already widened until the month ends." : "A sense pulse needs 10 Qi.");
        }
    }

    private void ApplySeason()
    {
        var season = Calendar.SeasonOf(E.Content, E.State.Calendar.Month);
        if (season == Season) return;
        Season = season;
        _groundMat.SetShaderParameter("season", (int)season);
        foreach (var prop in _scenery) prop.Redraw();
    }

    public override string HintText()
    {
        if (Battle != null) return base.HintText();
        var fly = TouchUi.Prompt("fly");
        if (PlayerBody.Flying) return T($"Đang ngự kiếm — bay qua sông núi · {fly} để hạ xuống", $"Riding the sword — cross rivers and cliffs · {fly} to land");
        if (TouchUi.Active)
            return base.HintText() + T(" · bản đồ ở góc trên phải", " · the map is in the top-right corner") + (Player.CanFly ? T($" · {fly} để ngự kiếm", $" · {fly} for sword flight") : "");
        var move = KeyMap.MoveKeys;
        return T($"{move} đi · {KeyName("interact")} tương tác · chém yêu thú để giao chiến · {KeyName("open_map")} bản đồ · {KeyName("end_month")} qua tháng sớm · cuộn chuột phóng to",
                $"{move} walk · {KeyName("interact")} interact · strike a beast to fight · {KeyName("open_map")} map · {KeyName("end_month")} end month early · wheel zooms")
            + (Player.CanFly ? T($" · {fly} ngự kiếm", $" · {fly} sword flight") : "");
    }

    protected override void HandleKey(InputEvent e)
    {
        if (e.IsActionPressed("end_month")) EndMonth();
        else if (e.IsActionPressed("seclude")) OpenPanel(new SeclusionPanel());
        else if (e.IsActionPressed("pulse")) Pulse();
        else if (e.IsActionPressed("open_map")) OpenPanel(new MapPanel(this));
    }

    protected override void OnPending()
    {
        if (E.State.World.PendingAmbush != null) StartAmbush();
    }

    // ================================================================ fog, visibility, occlusion

    public bool Explored(int x, int y) => _fog.Get(x, y);

    public void RefreshFog()
    {
        _fog = E.Fog();
        var map = E.Map;
        for (var y = 0; y < map.Height; y++)
            for (var x = 0; x < map.Width; x++)
                _fogImage.SetPixel(x, y, _fog.Get(x, y) ? Colors.White : Colors.Black);
        _fogTex.Update(_fogImage);
    }

    private void UpdateVisibility()
    {
        foreach (var actor in Actors)
        {
            var b = actor.Body;
            if (b.IsPlayer) continue;
            var c = Walls.CellOf(b.Pos);
            actor.Visible = b.InBattle || Explored(c.X, c.Y);
        }
        foreach (var (id, (prop, _)) in _adventures) prop.Visible = AdventureVisible(id);
        foreach (var (id, prop) in _herbs)
        {
            var poi = E.Poi(id);
            prop.Visible = poi != null && Explored(poi.X, poi.Y);
        }
    }

    private bool AdventureVisible(string id)
    {
        var adv = E.Adventure(id);
        if (adv == null || !Explored(adv.X, adv.Y)) return false;
        return E.Senses(adv.X, adv.Y) && (!adv.Hidden || E.Player.SensePulse || E.Player.Attrs.Per >= 12);
    }

    /// <summary>Trees, cliffs and roofs in front of the player turn see-through so you never lose yourself.</summary>
    private void UpdateOcclusion()
    {
        var p = PlayerBody.Pos;
        var near = new HashSet<Prop>();
        for (var dy = 0; dy <= 2; dy++)
        {
            for (var dx = -2; dx <= 2; dx++)
            {
                var x = _tile.X + dx;
                var y = _tile.Y + dy;
                if (!Walls.InBounds(x, y) || _occluders[y * Walls.Width + x] is not { } list) continue;
                foreach (var o in list)
                {
                    var at = o.Prop.Position;
                    if (at.Y <= p.Y + 2 || at.Y - o.Extent.Y > p.Y - 20) continue;
                    if (Mathf.Abs(at.X - p.X) > o.Extent.X + 14) continue;
                    near.Add(o.Prop);
                }
            }
        }
        foreach (var prop in _faded.Where(x => !near.Contains(x)).ToList())
        {
            prop.Modulate = Colors.White;
            _faded.Remove(prop);
        }
        foreach (var prop in near)
        {
            if (_faded.Add(prop)) prop.Modulate = new Color(1, 1, 1, 0.42f);
        }
    }

    // ================================================================ people, beasts, adventures, herbs

    private static Vector2 Jitter(string id, float spread)
    {
        var h = Seeds.Hash(id);
        return new Vector2(((h & 0xff) / 255f - 0.5f) * spread, (((h >> 8) & 0xff) / 255f - 0.5f) * spread);
    }

    /// <summary>Bring the bodies on the field in line with the engine's world (after a month, a fight, an event).</summary>
    public void SyncActors()
    {
        var state = E.State;
        // People.
        foreach (var npc in state.World.Npcs)
        {
            _npcs.TryGetValue(npc.Id, out var body);
            if (!npc.Alive || npc.Zone.Length == 0)
            {
                if (body == null || body.InBattle) continue;
                RemoveActor(body);
                _npcs.Remove(npc.Id);
                if (_npcTalk.Remove(npc.Id, out var talk)) Interactions.Remove(talk);
                continue;
            }
            var home = Walls.NearestFree(TileCenter(npc.X, npc.Y) + Jitter(npc.Id, 60), 14, 200);
            if (body == null)
            {
                body = new Fighter
                {
                    Id = npc.Id, NpcId = npc.Id, Kind = "human", Look = Look.ForNpc(npc), Name = npc.Name, Radius = 14,
                    Pos = home, Home = home, WanderRadius = 70, Speed = 140,
                };
                AddActor(body);
                _npcs[npc.Id] = body;
                var id = npc.Id;
                var who = body;
                var talk = new Interaction
                {
                    At = () => who.Pos, Reach = 72, Height = 76,
                    Label = () => T($"Gặp {who.Name}", $"Meet {who.Name}"),
                    Act = () => OpenPanel(new NpcPanel(id)),
                    Visible = () => who.Alive && !who.InBattle && (ActorOf(who)?.Visible ?? false),
                };
                Interactions.Add(talk);
                _npcTalk[npc.Id] = talk;
            }
            else if (body.Home.DistanceTo(home) > Cell * 0.6f)
            {
                body.Home = home;
                body.WanderTarget = home;
                if (body.Pos.DistanceTo(home) > Cell * 3 && !OnScreen(body.Pos, 100)) body.Pos = home;
            }
            body.Name = npc.Name;
            body.Hostile = npc.RelationTo(NpcSim.PlayerKey) <= -40;
        }

        // Beasts.
        var packIds = new HashSet<string>(state.World.Beasts.Select(b => b.Id));
        foreach (var id in _packs.Keys.ToList())
        {
            if (packIds.Contains(id)) continue;
            foreach (var body in _packs[id].Where(b => !b.InBattle)) RemoveActor(body);
            _packs.Remove(id);
        }
        foreach (var pack in state.World.Beasts)
        {
            var center = TileCenter(pack.X, pack.Y);
            if (!_packs.TryGetValue(pack.Id, out var list))
            {
                list = new List<Fighter>();
                for (var i = 0; i < pack.EnemyIds.Count; i++)
                {
                    var enemyId = pack.EnemyIds[i];
                    var def = E.Content.Enemy(enemyId) ?? Encounters.Fallback(enemyId);
                    var offset = pack.EnemyIds.Count == 1 ? Vector2.Zero : Vector2.Right.Rotated(Mathf.Tau * i / pack.EnemyIds.Count) * 34;
                    var home = Walls.NearestFree(center + offset, (float)def.Radius, 200);
                    var body = new Fighter
                    {
                        Id = pack.Id + ":" + i, PackId = pack.Id, Kind = def.Id, Look = Figures.IsHuman(def.Id) ? Look.ForEnemy(def.Id) : null,
                        Name = T(def.Name, def.NameEn), Radius = (float)def.Radius, Speed = (float)def.Speed, Archetype = def.Archetype,
                        Pos = home, Home = home, WanderRadius = def.Speed <= 0 ? 0 : 110, Hostile = true,
                    };
                    body.Side = GD.Randf() < 0.5f ? -1 : 1;
                    AddActor(body);
                    list.Add(body);
                }
                _packs[pack.Id] = list;
            }
            else
            {
                for (var i = 0; i < list.Count; i++)
                {
                    var body = list[i];
                    var offset = list.Count == 1 ? Vector2.Zero : Vector2.Right.Rotated(Mathf.Tau * i / list.Count) * 34;
                    var home = center + offset;
                    if (body.Home.DistanceTo(home) < Cell * 0.5f) continue;
                    body.Home = Walls.NearestFree(home, body.Radius, 200);
                    body.WanderTarget = body.Home;
                    if (!body.InBattle && body.Pos.DistanceTo(body.Home) > Cell * 3 && !OnScreen(body.Pos, 100)) body.Pos = body.Home;
                }
            }
        }

        // Adventures (kỳ ngộ) glow where they wait.
        var advIds = new HashSet<string>(state.World.Adventures.Select(a => a.Id));
        foreach (var id in _adventures.Keys.ToList())
        {
            if (advIds.Contains(id)) continue;
            var (prop, talk) = _adventures[id];
            prop.QueueFree();
            _scenery.Remove(prop);
            Interactions.Remove(talk);
            _adventures.Remove(id);
        }
        foreach (var adv in state.World.Adventures)
        {
            if (_adventures.ContainsKey(adv.Id)) continue;
            var at = Walls.NearestFree(TileCenter(adv.X, adv.Y), 20, 120);
            var prop = AddProp(at, (c, time) => PropArt.QiPillar(c, time), animated: true);
            var id = adv.Id;
            var talk = new Interaction
            {
                At = () => at, Reach = 74, Height = 120,
                Label = () => T($"Kỳ ngộ: {E.EventFor(id)?.Name ?? "?"}", $"Encounter: {E.EventFor(id)?.NameEn ?? "?"}"),
                Act = () => OpenPanel(new EventPanel(id, null)),
                Visible = () => AdventureVisible(id),
            };
            Interactions.Add(talk);
            _adventures[adv.Id] = (prop, talk);
        }

        // Herb patches.
        foreach (var poi in E.Map.Def.Pois.Where(p => p.Kind == "herb"))
        {
            if (_herbs.TryGetValue(poi.Id, out var existing))
            {
                existing.Redraw();
                continue;
            }
            var at = TileCenter(poi.X, poi.Y);
            var seed = (int)(Seeds.Hash(poi.Id) & 0xffff);
            var id = poi.Id;
            var prop = AddProp(at, (c, time) => PropArt.Herb(c, Spawns.NodeReady(E.State, id), time, seed), animated: true);
            _herbs[poi.Id] = prop;
            Interactions.Add(new Interaction
            {
                At = () => at, Reach = 70, Height = 44,
                Label = () => Spawns.NodeReady(E.State, id) ? T($"Hái {poi.Name}", $"Gather {poi.NameEn}") : T("Đã hái trụi — chờ mọc lại", "Picked clean — wait for regrowth"),
                Act = () =>
                {
                    var events = E.Gather(id);
                    if (events.Any(e => e.Kind == "item_gained")) Fx.Leaves(at + new Vector2(0, -10), new Color("#6f9a55"), 8);
                    Game.Instance.Notify(events);
                    _herbs[id].Redraw();
                },
                Visible = () => Explored(poi.X, poi.Y),
            });
        }
        UpdateVisibility();
    }

    // ================================================================ beasts and fights

    private BeastPack? Pack(string id) => E.State.World.Beasts.FirstOrDefault(b => b.Id == id);

    /// <summary>Aggressive packs that see you come running; the first to reach you starts the fight.</summary>
    private void UpdateAggro(float dt)
    {
        // Nothing on foot can reach a cultivator riding a sword overhead.
        if (Battle != null || E.ZoneHere?.IsSafe == true || PlayerBody.Flying)
        {
            _hunting.Clear();
            return;
        }
        foreach (var (id, bodies) in _packs)
        {
            var pack = Pack(id);
            if (pack == null || !pack.Aggressive) continue;
            var alive = bodies.Where(b => b.Alive && !b.InBattle && (ActorOf(b)?.Visible ?? false)).ToList();
            if (alive.Count == 0) continue;
            if (alive.Any(b => b.AggroCd > 0))
            {
                foreach (var b in alive) _hunting.Remove(b);
                continue;
            }
            var nearest = alive.OrderBy(b => b.Pos.DistanceSquaredTo(PlayerBody.Pos)).First();
            var dist = nearest.Pos.DistanceTo(PlayerBody.Pos);
            var danger = E.Content.Area(pack.Zone)?.DangerLevel ?? 1;
            var sight = 210f + 25 * danger;
            var hunting = alive.Any(_hunting.Contains);
            if (!hunting && dist > sight) continue;
            if (hunting && dist > sight * 1.9f)
            {
                // Lost you: they go back to their patch.
                foreach (var b in alive)
                {
                    _hunting.Remove(b);
                    b.AggroCd = 4;
                }
                continue;
            }
            foreach (var b in alive)
            {
                if (_hunting.Add(b))
                {
                    Fx.Say(b.Pos + new Vector2(0, -Figures.HeightOf(b.Kind) * b.Scale - 16), "!", Ink.Cinnabar, 30, 0.9f);
                    SoundBoard.PlayAt("notice", b.Pos, 0, 1, 0.05f, 250);
                }
                if (b.Speed <= 0) continue;
                var dir = (PlayerBody.Pos - b.Pos).Normalized();
                b.Pos = Walls.Move(b.Pos, b.Radius, dir * b.Speed * 0.85f * dt);
                b.Face(dir);
            }
            if (dist <= nearest.Radius + PlayerBody.Radius + 14)
            {
                Engage(nearest);
                return;
            }
        }
    }

    public override bool Engage(Fighter foe)
    {
        if (Battle != null || foe.PackId == null || !_packs.TryGetValue(foe.PackId, out var bodies)) return false;
        var enc = E.Engage(foe.PackId);
        if (enc == null) return false;
        _hunting.Clear();
        return StartBattle(enc, bodies.Where(b => b.Alive).ToList()) != null;
    }

    protected override IList<Fighter>? BodiesFor(Encounter enc)
    {
        if (enc.SourceId == null) return null;
        List<Fighter>? bodies = null;
        if (_npcs.TryGetValue(enc.SourceId, out var npc) && npc.Alive) bodies = new List<Fighter> { npc };
        else if (_packs.TryGetValue(enc.SourceId, out var pack)) bodies = pack.Where(b => b.Alive).ToList();
        if (bodies == null || bodies.Count == 0) return null;
        // Someone who comes for you from afar steps out of the trees nearby.
        for (var i = 0; i < bodies.Count; i++)
        {
            var b = bodies[i];
            if (b.Pos.DistanceTo(PlayerBody.Pos) < 520) continue;
            var angle = FieldMath.Angle(PlayerBody.Facing) + (i - (bodies.Count - 1) / 2f) * 0.6f;
            b.Pos = Walls.NearestFree(PlayerBody.Pos + Vector2.Right.Rotated(angle) * 300, b.Radius, 300);
            Fx.Burst(b.Pos + new Vector2(0, -24), new Color(0.2f, 0.22f, 0.28f, 0.35f), 12, 120, ParticleKind.Mist, 9);
        }
        return bodies;
    }

    private void StartAmbush()
    {
        if (Battle != null) return;
        var enc = E.TakeAmbush();
        if (enc == null) return;
        if (StartBattle(enc, BodiesFor(enc)) != null)
            Hud.Banner(T("Phục kích!", "Ambush!"), enc.DisplayName ?? T("Có kẻ rình rập ngươi từ lâu", "Something has been stalking you"), Ink.Cinnabar, 1.6f);
    }

    protected override void OnBattleFinished(Battle battle, CombatResolution resolution, CombatOutcome outcome)
    {
        _hunting.Clear();
        ApplySeason();
        var here = new Vector2I(E.Player.X, E.Player.Y);
        if (here != _tile)
        {
            // Defeated: a passer-by carried you back to the village.
            FadeThrough(() =>
            {
                Teleport(TileCenter(here.X, here.Y));
                _tile = here;
                RefreshFog();
                SyncActors();
            }, 0.5f);
            return;
        }
        RefreshFog();
        SyncActors();
    }
}
