using System;
using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Combat;
using TuTien.Core.Content;
using TuTien.Core.State;
using TuTienLuc.Art;
using TuTienLuc.Audio;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.Field;

/// <summary>
/// A secret realm floor (design §7.11) as a walled room: the guardians wait at the far end and wake
/// when you come close or strike first. Clear the floor and chests and a gate to the next floor
/// appear; the last gate claims the realm's rewards. The gate you came in by leads back out.
/// </summary>
public partial class RealmScreen : FieldScreen
{
    private const float Cell = 128;
    private const int W = 16, H = 11;

    private readonly PoiDef _poi;
    private DungeonDef _dungeon = null!;
    private FloorDef _floor = null!;
    private Encounter? _pending;
    private readonly List<Fighter> _guards = new();
    private readonly List<(Prop Prop, int Index)> _chests = new();
    private Prop _exit = null!;
    private bool _leaving;

    public RealmScreen(PoiDef poi) => _poi = poi;

    protected override string MusicMood => "realm";

    public override string PlaceName => T(_dungeon.Name, _dungeon.NameEn);
    public override string PlaceSub => T($"Tầng {_floor.FloorNumber}/{_dungeon.Floors.Count}: {_floor.Name}", $"Floor {_floor.FloorNumber}/{_dungeon.Floors.Count}: {_floor.NameEn}");

    private SecretRealmRun? Run => E.State.World.Run;
    private bool Cleared => Run is { FloorCleared: true };
    private bool LastFloor => _floor.FloorNumber >= _dungeon.Floors.Count;
    private int Theme => Math.Clamp(_floor.FloorNumber, 1, 3);

    private static Vector2 V(float x, float y) => new(x, y);
    private static float Hash(int x, int y, int salt) => FieldMath.Hash01(x, y, salt);

    // ================================================================ building

    protected override void BuildField()
    {
        _dungeon = E.DungeonFor(_poi)!;
        _floor = E.CurrentFloor()!;
        Walls = new CollisionWorld(W, H, Cell);
        var grid = new int[W, H];
        for (var y = 0; y < H; y++)
        {
            for (var x = 0; x < W; x++)
            {
                var border = x == 0 || y == 0 || x == W - 1 || y == H - 1;
                grid[x, y] = border ? TerrainId.Peak
                    : Theme == 3 ? (Math.Abs(x - W / 2 + 0.5f) < 3 ? TerrainId.Sect : TerrainId.Forest)
                    : Theme == 2 ? (Hash(x, y, 1) < 0.45f ? TerrainId.Forest : TerrainId.Plains)
                    : TerrainId.Plains;
            }
        }
        // A spirit pond in the garden floors.
        if (Theme < 3)
            foreach (var (x, y) in new[] { (2, 3), (3, 3), (2, 4), (3, 4), (2, 5) })
                grid[x, y] = TerrainId.Water;
        // The path from the entrance to the far gate.
        for (var y = 1; y < H - 1; y++)
            if (grid[W / 2, y] != TerrainId.Sect) grid[W / 2, y] = TerrainId.Road;

        for (var y = 0; y < H; y++)
        {
            for (var x = 0; x < W; x++)
            {
                if (grid[x, y] == TerrainId.Peak) Walls.SetSolid(x, y, walk: true, shots: true);
                else if (grid[x, y] == TerrainId.Water) Walls.SetSolid(x, y, walk: true, shots: false);
            }
        }

        var noise = TerrainTextures.Noise();
        var season = (int)TuTien.Core.Rules.Calendar.SeasonOf(E.Content, E.State.Calendar.Month);
        var mat = ShaderQuad.MakeMaterial("res://shaders/terrain.gdshader", new Dictionary<string, Variant>
        {
            ["terrain_tex"] = TerrainTextures.Terrain(W, H, (x, y) => grid[x, y]), ["noise_tex"] = noise,
            ["map_cells"] = new Vector2(W, H), ["cell_px"] = Cell, ["season"] = Theme == 3 ? 2 : 0,
            ["tint"] = Theme == 3 ? new Color(0.94f, 0.9f, 0.98f) : new Color(0.97f, 1f, 0.97f),
        });
        AddChild(new ShaderQuad(new Rect2(-256, -256, W * Cell + 512, H * Cell + 512), mat, -20));
        AddChild(new Ambience(this, () => Theme == 3 ? Season.Autumn : Season.Spring, Theme == 3 ? 0.6f : 1.4f));
        var sway = ShaderQuad.MakeMaterial("res://shaders/sway.gdshader", new Dictionary<string, Variant> { ["strength"] = 1f });

        // Walls of rock all around; low along the bottom so they never hide you.
        for (var x = 0; x < W; x++)
        {
            for (var y = 0; y < H; y++)
            {
                if (grid[x, y] != TerrainId.Peak) continue;
                var bottom = y == H - 1;
                var seed = x * 31 + y * 17 + _floor.FloorNumber * 101;
                var width = 150 + Hash(x, y, 2) * 30;
                var height = bottom ? 60 + Hash(x, y, 3) * 20 : 150 + Hash(x, y, 3) * 80;
                AddProp(V(x * Cell + Cell / 2, y * Cell + Cell - 2), (c, _) => PropArt.Cliff(c, seed, width, height, Theme == 3 && !bottom));
            }
        }

        // Garden dressing along the walls; the middle stays open for the fight.
        for (var y = 1; y < H - 1; y++)
        {
            for (var x = 1; x < W - 1; x++)
            {
                if (grid[x, y] is TerrainId.Water or TerrainId.Road or TerrainId.Sect) continue;
                var nearWall = x == 1 || y == 1 || x == W - 2 || y == H - 2;
                var h = Hash(x, y, 5 + _floor.FloorNumber);
                if (!nearWall && h > 0.12f) continue;
                if (nearWall && h > 0.6f) continue;
                if (y >= H - 3 && Math.Abs(x - W / 2) <= 2) continue;
                if (y <= 3 && Math.Abs(x - W / 2) <= 2) continue;
                var at = V(x * Cell + Cell / 2 + (Hash(x, y, 7) - 0.5f) * 60, y * Cell + Cell / 2 + (Hash(x, y, 8) - 0.5f) * 50);
                var kind = Theme == 3 ? (h < 0.3f ? TreeKind.Broadleaf : TreeKind.Pine) : h < 0.25f ? TreeKind.Blossom : h < 0.45f ? TreeKind.Bamboo : TreeKind.Broadleaf;
                var scale = Theme == 3 ? 1.3f + Hash(x, y, 9) * 0.3f : 0.95f + Hash(x, y, 9) * 0.25f;
                var seed = x * 13 + y * 7 + _floor.FloorNumber;
                AddProp(at, (c, _) => PropArt.Tree(c, kind, seed, Season.Spring, scale), material: sway);
                Walls.Add(Obstacle.Circle(at + V(0, -2), (kind == TreeKind.Bamboo ? 12 : 8) * scale));
            }
        }
        // Spirit herbs and reeds by the pond.
        if (Theme < 3)
        {
            foreach (var (at, seed) in new[] { (V(4.6f * Cell, 3.2f * Cell), 1), (V(1.6f * Cell, 6.4f * Cell), 2), (V(4.2f * Cell, 5.6f * Cell), 3) })
                AddProp(at, (c, time) => PropArt.Herb(c, true, time, seed), animated: true);
            foreach (var at in new[] { V(4.1f * Cell, 3.6f * Cell), V(2.2f * Cell, 6.1f * Cell), V(3.9f * Cell, 4.9f * Cell) })
                AddProp(at, (c, _) => PropArt.Reeds(c, (int)at.X), material: sway);
        }
        else
        {
            AddProp(V(W / 2f * Cell, 1.9f * Cell), (c, _) => PropArt.Hall(c));
            Walls.Add(Obstacle.Box(new Rect2(W / 2f * Cell - 155, 1.9f * Cell - 70, 310, 70)));
            foreach (var x in new[] { W / 2f - 2.2f, W / 2f + 2.2f })
            {
                foreach (var y in new[] { 4.2f, 6.6f })
                {
                    AddProp(V(x * Cell, y * Cell), (c, time) => PropArt.Lantern(c, true, time), animated: true);
                    Walls.Add(Obstacle.Circle(V(x * Cell, y * Cell - 6), 9));
                }
            }
        }

        // The way in (and out) at the bottom; the gate onward at the top once the floor is cleared.
        var entrance = V(W / 2f * Cell, (H - 1.7f) * Cell);
        AddProp(entrance, (c, time) => PropArt.Portal(c, time, new Color("#8a6ab0")), animated: true);
        Interactions.Add(new Interaction
        {
            At = () => entrance, Reach = 70, Height = 40,
            Label = () => T("Rời bí cảnh", "Leave the secret realm"),
            Act = Leave,
        });
        var exitAt = V(W / 2f * Cell, (Theme == 3 ? 2.9f : 2.2f) * Cell);
        _exit = AddProp(exitAt, (c, time) => PropArt.Portal(c, time, new Color("#c9a54a")), animated: true);
        Interactions.Add(new Interaction
        {
            At = () => exitAt, Reach = 70, Height = 40,
            Label = () => LastFloor ? T("Nhận thưởng & rời bí cảnh", "Claim the rewards & leave") : T($"Xuống tầng {_floor.FloorNumber + 1}", $"Descend to floor {_floor.FloorNumber + 1}"),
            Act = Advance,
            Visible = () => Cleared && Battle == null,
        });
        for (var i = 0; i < _floor.ChestCount; i++)
        {
            var index = i;
            var at = exitAt + V((i - (_floor.ChestCount - 1) / 2f) * 150, 150);
            var prop = AddProp(at, (c, time) => PropArt.Chest(c, Run != null && index < Run.ChestsOpened, time), animated: true);
            _chests.Add((prop, i));
            Interactions.Add(new Interaction
            {
                At = () => at, Reach = 62, Height = 48,
                Label = () => T("Mở rương báu", "Open the chest"),
                Act = OpenChest,
                Visible = () => Cleared && Battle == null && Run != null && index == Run.ChestsOpened,
            });
        }
    }

    protected override Vector2 SpawnPoint() => V(W / 2f * Cell, (H - 2.5f) * Cell);

    protected override void AfterReady()
    {
        Player.Body.Face(Vector2.Up);
        SetupFloor();
        Hud.Banner(T(_floor.Name, _floor.NameEn), T($"{_dungeon.Name} — tầng {_floor.FloorNumber}", $"{_dungeon.NameEn} — floor {_floor.FloorNumber}"), Ink.Violet, 1.8f);
    }

    private void SetupFloor()
    {
        foreach (var guard in _guards) RemoveActor(guard);
        _guards.Clear();
        UpdateGates();
        if (Run == null || Cleared) return;
        _pending = E.ActiveEncounter ?? E.StartFloorFight();
        if (_pending == null) return;
        var list = E.BuildEnemies(_pending);
        for (var i = 0; i < list.Count; i++)
        {
            var def = list[i].Template;
            var spread = list.Count == 1 ? 0 : (i - (list.Count - 1) / 2f) * 150;
            var home = Walls.NearestFree(V(W / 2f * Cell + spread, (Theme == 3 ? 4.1f : 3.4f) * Cell + (i % 2) * 70), (float)def.Radius, 200);
            var body = new Fighter
            {
                Id = "guard:" + i, PackId = "floor", Kind = def.Id, Look = Figures.IsHuman(def.Id) ? Look.ForEnemy(def.Id) : null,
                NameVi = def.Name, NameEn = def.NameEn, Radius = (float)def.Radius, Speed = (float)def.Speed, Archetype = def.Archetype,
                Pos = home, Home = home, WanderRadius = def.Speed <= 0 ? 0 : 60, Facing = Vector2.Down, Hostile = true,
            };
            AddActor(body);
            _guards.Add(body);
        }
    }

    private void UpdateGates()
    {
        _exit.Visible = Cleared;
        foreach (var (prop, _) in _chests)
        {
            prop.Visible = Cleared;
            prop.Redraw();
        }
    }

    // ================================================================ the frame

    protected override void UpdateField(float dt)
    {
        if (_pending == null || Battle != null || _guards.Count == 0) return;
        var near = _guards.Where(g => g.Alive).Select(g => g.Pos.DistanceTo(PlayerBody.Pos)).DefaultIfEmpty(float.MaxValue).Min();
        if (near < 330) Wake();
    }

    public override bool Engage(Fighter foe)
    {
        if (foe.PackId != "floor" || _pending == null || Battle != null) return false;
        Wake();
        return Battle != null;
    }

    private void Wake()
    {
        var enc = _pending;
        if (enc == null) return;
        _pending = null;
        foreach (var g in _guards) Fx.Say(g.Pos + new Vector2(0, -Figures.HeightOf(g.Kind) * g.Scale - 16), "!", Ink.Cinnabar, 28, 0.8f);
        SoundBoard.Play("notice");
        StartBattle(enc, _guards.Where(g => g.Alive).ToList());
    }

    protected override void OnBattleFinished(Battle battle, CombatResolution resolution, CombatOutcome outcome)
    {
        _guards.RemoveAll(g => !g.Alive);
        if (Run == null)
        {
            // Beaten inside: carried out of the realm, back to the village.
            _leaving = true;
            FadeThrough(() => Main.Instance.ShowWorld(), 0.5f);
            return;
        }
        if (Cleared)
        {
            Hud.Banner(T("Tầng đã được dọn sạch", "The floor is cleared"), LastFloor ? T("Bảo vật chờ ngươi", "Treasure awaits") : T("Cổng xuống tầng kế đã mở", "The gate below has opened"), Ink.JadeDeep, 1.8f);
            UpdateGates();
            return;
        }
        // Fled: the guardians regroup for another try.
        SetupFloor();
    }

    // ================================================================ chests and gates

    private void OpenChest()
    {
        var roll = E.OpenFloorChest();
        if (roll == null) return;
        var chest = _chests.FirstOrDefault(c => c.Index == Run!.ChestsOpened - 1);
        SoundBoard.Play("chest");
        if (chest.Prop != null)
        {
            chest.Prop.Redraw();
            Fx.Burst(chest.Prop.Position + new Vector2(0, -24), Ink.Gold, 18, 200, ParticleKind.Spark, 3);
        }
        Game.Instance.Toast(RealmPanel.Loot(roll, Locale.Vi), RealmPanel.Loot(roll, Locale.En), EventLevel.Major);
        Game.Instance.Changed();
    }

    private void Advance()
    {
        if (_leaving || !Cleared) return;
        _leaving = true;
        SoundBoard.Play("portal");
        var events = E.AdvanceRealm();
        Game.Instance.Notify(events);
        Game.Instance.SaveGame();
        if (Run == null) FadeThrough(() => Main.Instance.ShowWorld(CaveMouth()), 0.4f);
        else FadeThrough(() => Main.Instance.ShowRealm(_poi), 0.4f);
    }

    private void Leave()
    {
        if (_leaving) return;
        _leaving = true;
        SoundBoard.Play("portal", -2);
        if (_pending != null && E.ActiveEncounter == _pending) E.AbandonEncounter();
        _pending = null;
        E.LeaveRealm();
        Game.Instance.SaveGame();
        Game.Instance.Changed();
        FadeThrough(() => Main.Instance.ShowWorld(CaveMouth()), 0.4f);
    }

    private Vector2 CaveMouth() => WorldScreen.TileCenter(_poi.X, _poi.Y) + new Vector2(0, 60);

    public override string FleeNote => T("Chạy xa khỏi mọi kẻ địch cũng là thoát thân; lính canh sẽ tập hợp lại.",
        "Running far from every foe also escapes; the guardians regroup.");
}
