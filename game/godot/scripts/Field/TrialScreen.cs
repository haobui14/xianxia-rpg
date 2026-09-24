using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Rules;
using TuTienLuc.Art;
using TuTienLuc.Audio;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.Field;

/// <summary>A qi mote drifting over the platform (breakthrough trial).</summary>
public sealed class Mote
{
    public Vector2 Pos;
    public Vector2 Vel;
    public Element Element;
    public float Life = 5;
    public float Age;
    public bool Dead;
}

/// <summary>A heart demon (tâm ma) hunting the meditator.</summary>
public sealed class Demon
{
    public Vector2 Pos;
    public float Speed = 120;
    public float Wobble;
    public float Age;
    public bool Dead;
}

/// <summary>
/// The major-breakthrough set piece (design §7.5) on a mountaintop platform. For 25 seconds heaven and
/// earth's qi pours in: gather the motes (your root's element is worth 3, others 1) while heart demons
/// hunt you. A demon's touch costs 4; cutting one down or dashing through it is worth 1.
/// Performance = score / target, compared against the preparation-dependent threshold.
/// </summary>
public partial class TrialScreen : TrialBase
{
    public const float Duration = 25f;
    public const float ScoreGoal = 60f;
    private const float Cell = 128;
    private const int W = 14, H = 10;

    public readonly List<Mote> Motes = new();
    public readonly List<Demon> Demons = new();
    public float Time;
    public float Score;

    private HashSet<Element> _root = null!;
    private int _realm;
    private float _moteTimer;
    private float _demonTimer = 2.5f;
    private float _calm = 1.8f;

    public override string PlaceName => T($"Đột phá: {Names.Display(E.Player.Realm + 1, Locale.Vi)}", $"Breakthrough: {Names.Display(E.Player.Realm + 1, Locale.En)}");
    public override string PlaceSub => T("Thu linh khí, tránh tâm ma", "Gather qi, avoid heart demons");
    public override string HintText() => TouchUi.Active
        ? T("Cần gạt để đi · nút lướt để lướt xuyên tâm ma · giữ nút kiếm để chém, tự nhắm tâm ma gần nhất",
            "Stick moves · the dash button dashes through demons · hold the sword button to cut (it aims at the nearest demon)")
        : T($"{KeyMap.MoveKeys} di chuyển · {KeyName("dash")} lướt xuyên tâm ma · chuột trái chém · Esc tạm dừng",
            $"{KeyMap.MoveKeys} move · {KeyName("dash")} dash through demons · left click cuts · Esc pause");

    /// <summary>With touch controls a strike aims at the nearest heart demon.</summary>
    public override Vector2? AimAssist(Vector2 from)
    {
        Demon? best = null;
        foreach (var d in Demons)
            if (best == null || d.Pos.DistanceSquaredTo(from) < best.Pos.DistanceSquaredTo(from)) best = d;
        return best == null ? null : best.Pos + new Vector2(0, -20);
    }

    public override double Performance => Mathf.Clamp(Score / ScoreGoal, 0, 1);
    public float TimeLeft => Mathf.Max(0, Duration - Time);
    public bool IsRoot(Element e) => _root.Contains(e);
    private Rect2 Arena => new(Cell * 1.3f, Cell * 1.6f, (W - 2.6f) * Cell, (H - 2.9f) * Cell);

    private static Vector2 V(float x, float y) => new(x, y);

    protected override void BuildField()
    {
        var p = E.Player;
        _root = new HashSet<Element>(p.Root.Elements);
        _realm = (int)p.Realm;
        ReadPreparation();

        Walls = new CollisionWorld(W, H, Cell);
        var grid = new int[W, H];
        for (var y = 0; y < H; y++)
        {
            for (var x = 0; x < W; x++)
            {
                var border = x == 0 || y == 0 || x == W - 1 || y == H - 1;
                grid[x, y] = border ? TerrainId.Peak : TerrainId.Sect;
                if (border) Walls.SetSolid(x, y, walk: true, shots: true);
            }
        }
        var mat = ShaderQuad.MakeMaterial("res://shaders/terrain.gdshader", new Dictionary<string, Variant>
        {
            ["terrain_tex"] = TerrainTextures.Terrain(W, H, (x, y) => grid[x, y]), ["noise_tex"] = TerrainTextures.Noise(),
            ["map_cells"] = new Vector2(W, H), ["cell_px"] = Cell, ["season"] = 3, ["tint"] = new Color(0.97f, 0.97f, 1f),
        });
        AddChild(new ShaderQuad(new Rect2(-256, -256, W * Cell + 512, H * Cell + 512), mat, -20));
        for (var x = 0; x < W; x++)
        {
            for (var y = 0; y < H; y++)
            {
                if (grid[x, y] != TerrainId.Peak) continue;
                var bottom = y == H - 1;
                var seed = x * 19 + y * 23;
                var height = bottom ? 56 + FieldMath.Hash01(x, y, 1) * 20 : 170 + FieldMath.Hash01(x, y, 1) * 90;
                AddProp(V(x * Cell + Cell / 2, y * Cell + Cell - 2), (c, _) => PropArt.Cliff(c, seed, 160, height, !bottom));
            }
        }
        foreach (var at in new[] { V(2.1f * Cell, 2.2f * Cell), V((W - 2.1f) * Cell, 2.2f * Cell), V(2.1f * Cell, (H - 1.8f) * Cell), V((W - 2.1f) * Cell, (H - 1.8f) * Cell) })
        {
            AddProp(at, (c, time) => PropArt.Lantern(c, true, time), animated: true);
            Walls.Add(Obstacle.Circle(at + V(0, -6), 9));
        }
        AddProp(V(W / 2f * Cell, 1.75f * Cell), (c, time) => PropArt.Incense(c, time), animated: true);
        Walls.Add(Obstacle.Circle(V(W / 2f * Cell, 1.75f * Cell - 16), 18));
        AddChild(new TrialFloor(V(W / 2f * Cell, H / 2f * Cell + 30)));
        AddChild(new TrialLayer(this));
    }

    protected override Vector2 SpawnPoint() => V(W / 2f * Cell, H / 2f * Cell + 30);

    protected override void AfterReady()
    {
        PlayerBody.Meditating = true;
        PlayerBody.Face(Vector2.Down);
        Hud.Banner(T("Tĩnh tâm…", "Still the mind…"),
            E.Player.Realm == Realm.PhamNhan
                ? T("Dẫn khí nhập thể — thu linh khí, tránh tâm ma", "Draw qi into the body — gather qi, avoid heart demons")
                : T("Xung kích bình cảnh — thu linh khí, tránh tâm ma", "Storm the bottleneck — gather qi, avoid heart demons"),
            Ink.JadeDeep, 1.8f);
    }

    protected override void UpdateField(float dt)
    {
        foreach (var m in Motes) m.Age += dt;
        if (UpdateVerdict(dt)) return;
        if (_calm > 0)
        {
            // Settle into meditation before the storm of qi begins.
            _calm -= dt;
            PlayerBody.Pos = SpawnPoint();
            if (_calm <= 0)
            {
                PlayerBody.Meditating = false;
                SoundBoard.Play("gong", -3);
            }
            return;
        }
        Time += dt;
        var rng = GD.Randf;
        var arena = Arena;
        var p = PlayerBody;

        _moteTimer -= dt;
        if (_moteTimer <= 0)
        {
            _moteTimer = 0.32f;
            var all = Elements.All.ToList();
            var element = GD.Randf() < 0.4f && _root.Count > 0 ? _root.ElementAt((int)(GD.Randf() * _root.Count) % _root.Count) : all[(int)(GD.Randf() * all.Count) % all.Count];
            Vector2 pos;
            var guard = 0;
            do
            {
                pos = arena.Position + new Vector2(rng() * arena.Size.X, rng() * arena.Size.Y);
            } while (pos.DistanceTo(p.Pos) < 150 && ++guard < 8);
            Motes.Add(new Mote { Pos = pos, Element = element, Vel = new Vector2(rng() - 0.5f, rng() - 0.5f) * 40 });
        }

        _demonTimer -= dt;
        if (_demonTimer <= 0)
        {
            _demonTimer = Mathf.Max(0.9f, 2.3f - 0.3f * _realm);
            var side = (int)(rng() * 4) % 4;
            var t = rng();
            var pos = side switch
            {
                0 => new Vector2(arena.Position.X + t * arena.Size.X, arena.Position.Y - 20),
                1 => new Vector2(arena.End.X + 20, arena.Position.Y + t * arena.Size.Y),
                2 => new Vector2(arena.Position.X + t * arena.Size.X, arena.End.Y + 20),
                _ => new Vector2(arena.Position.X - 20, arena.Position.Y + t * arena.Size.Y),
            };
            Demons.Add(new Demon { Pos = pos, Speed = 110 + 25 * _realm + Time * 2, Wobble = rng() * Mathf.Tau });
            Fx.Burst(pos + V(0, -20), new Color(0.45f, 0.08f, 0.1f, 0.5f), 10, 90, ParticleKind.Mist, 8);
        }

        var center = arena.GetCenter();
        foreach (var m in Motes)
        {
            m.Life -= dt;
            // A slow vortex draws the motes around the centre.
            var toCenter = center - m.Pos;
            m.Vel += toCenter.Normalized().Rotated(1.2f) * 14 * dt;
            m.Pos += m.Vel * dt;
            if (m.Life <= 0)
            {
                m.Dead = true;
                continue;
            }
            if (m.Pos.DistanceTo(p.Pos + V(0, -24)) > p.Radius + 22) continue;
            m.Dead = true;
            var gain = _root.Contains(m.Element) ? 3 : 1;
            Score += gain;
            SoundBoard.Play("mote", gain > 1 ? 0 : -5, MotePitch(m.Element) * (gain > 1 ? 2f : 1), 0.01f, 20);
            Fx.Say(m.Pos + new Vector2(0, -18), "+" + gain, Ink.Element(m.Element), gain > 1 ? 22 : 17, 0.7f);
            Fx.Burst(m.Pos, Ink.Element(m.Element).Lightened(0.3f), 6, 90, ParticleKind.Spark, 2);
        }

        foreach (var d in Demons)
        {
            d.Age += dt;
            d.Wobble += dt * 4;
            var dir = (p.Pos - d.Pos).Normalized();
            d.Pos += (dir + new Vector2(-dir.Y, dir.X) * Mathf.Sin(d.Wobble) * 0.5f).Normalized() * d.Speed * dt;
            if (d.Pos.DistanceTo(p.Pos) > p.Radius + 16) continue;
            if (p.Invuln > 0)
            {
                Cut(d);
                continue;
            }
            d.Dead = true;
            SoundBoard.Play("demon");
            Score = Mathf.Max(0, Score - 4);
            p.Stun = Mathf.Max(p.Stun, 0.35f);
            p.HitFlash = 0.15f;
            Shake(9);
            Fx.Say(p.Pos + new Vector2(0, -86), T("−4 tâm ma", "−4 heart demon"), Ink.Cinnabar, 22);
            Fx.Burst(p.Pos + V(0, -30), new Color(0.45f, 0.08f, 0.1f, 0.6f), 12, 160, ParticleKind.Mist, 7);
        }

        Motes.RemoveAll(m => m.Dead);
        Demons.RemoveAll(d => d.Dead);
        if (Time >= Duration) EndTrial(Performance);
    }

    /// <summary>Each phase rings its own note of the pentatonic scale.</summary>
    private static float MotePitch(Element e) => e switch
    {
        Element.Kim => 1.3348f,
        Element.Thuy => 1.1225f,
        Element.Moc => 1f,
        Element.Hoa => 0.8409f,
        _ => 0.7492f,
    };

    private void Cut(Demon d)
    {
        d.Dead = true;
        SoundBoard.PlayAt("kill", d.Pos, -3);
        Score += 1;
        Fx.Say(d.Pos + V(0, -30), T("Trảm!", "Cut!"), Ink.JadeDeep, 20);
        Fx.Ring(d.Pos + V(0, -18), 26, Ink.Violet);
        Fx.Burst(d.Pos + V(0, -18), new Color(0.3f, 0.1f, 0.2f, 0.6f), 10, 150, ParticleKind.Ink, 3);
    }

    public override void OnPlayerSlash(Vector2 origin, Vector2 dir, float arc, float reach)
    {
        foreach (var d in Demons.Where(d => !d.Dead && FieldMath.InArc(origin, dir, arc, reach + 10, d.Pos, 14)).ToList()) Cut(d);
    }

    public override void OnPlayerDash(Vector2 pos, float radius)
    {
        foreach (var d in Demons.Where(d => !d.Dead && d.Pos.DistanceTo(pos) <= radius + 16).ToList()) Cut(d);
    }

    protected override void OnEnded(bool passed)
    {
        Motes.Clear();
        Demons.Clear();
    }

    public override void DrawHud(FieldHud hud, Vector2 size)
    {
        var w = 620f;
        var pos = new Vector2(size.X / 2 - w / 2, GaugeY(size));
        hud.DrawRect(new Rect2(pos - new Vector2(12, 28), new Vector2(w + 24, 98)), new Color(Ink.Card, 0.9f));
        hud.DrawRect(new Rect2(pos - new Vector2(12, 28), new Vector2(w + 24, 98)), Ink.LineStrong, false, 1);
        hud.DrawString(Ink.Serif, pos + new Vector2(0, -8), T($"Linh khí {Score:0}/{ScoreGoal:0}", $"Qi gathered {Score:0}/{ScoreGoal:0}"), HorizontalAlignment.Left, -1, 17, Ink.InkColor);
        var tl = _calm > 0 ? "…" : $"{TimeLeft:0.0}s";
        hud.DrawString(Ink.UiFont, pos + new Vector2(w - 50, -8), tl, HorizontalAlignment.Left, -1, 15, TimeLeft < 5 ? Ink.Cinnabar : Ink.InkSoft);
        var passed = Performance >= Threshold;
        hud.Bar(pos, w, 18, Score, ScoreGoal, passed ? Ink.Jade : Ink.Gold, "");
        var tx = pos.X + w * Threshold;
        hud.DrawLine(new Vector2(tx, pos.Y - 4), new Vector2(tx, pos.Y + 22), Ink.CinnabarDeep, 3);
        hud.DrawString(Ink.UiFont, new Vector2(tx - 30, pos.Y + 36), T($"cần {Threshold * 100:0}%", $"need {Threshold * 100:0}%"), HorizontalAlignment.Left, -1, 12, Ink.CinnabarDeep);
        hud.DrawString(Ink.UiFont, pos + new Vector2(0, 56), T("hợp linh căn +3 · khác +1 · trảm tâm ma +1 · trúng tâm ma −4", "your element +3 · others +1 · cut a demon +1 · touched −4"),
            HorizontalAlignment.Left, -1, 12, Ink.InkMute);
    }
}

/// <summary>The meditation circle brushed onto the platform: the eight trigrams around a taiji.</summary>
public partial class TrialFloor : Node2D
{
    private static readonly int[][] Trigrams =
    {
        new[] { 1, 1, 1 }, new[] { 0, 1, 1 }, new[] { 1, 0, 1 }, new[] { 0, 0, 1 },
        new[] { 1, 1, 0 }, new[] { 0, 1, 0 }, new[] { 1, 0, 0 }, new[] { 0, 0, 0 },
    };

    public TrialFloor(Vector2 center)
    {
        Position = center;
        ZIndex = -15;
    }

    public override void _Draw()
    {
        var ink = new Color(0.11f, 0.13f, 0.19f, 1);
        DrawCircle(Vector2.Zero, 430, new Color(ink, 0.05f));
        DrawArc(Vector2.Zero, 430, 0, Mathf.Tau, 96, new Color(ink, 0.28f), 6, true);
        DrawArc(Vector2.Zero, 404, 0, Mathf.Tau, 96, new Color(ink, 0.2f), 2, true);
        DrawArc(Vector2.Zero, 250, 0, Mathf.Tau, 72, new Color(ink, 0.16f), 2, true);
        for (var i = 0; i < 8; i++)
        {
            var angle = -Mathf.Pi / 2 + Mathf.Tau * i / 8;
            var dir = Vector2.Right.Rotated(angle);
            var side = new Vector2(-dir.Y, dir.X);
            for (var line = 0; line < 3; line++)
            {
                var center = dir * (310 + line * 22);
                var solid = Trigrams[i][line] == 1;
                if (solid)
                {
                    DrawLine(center - side * 38, center + side * 38, new Color(ink, 0.3f), 9);
                }
                else
                {
                    DrawLine(center - side * 38, center - side * 7, new Color(ink, 0.3f), 9);
                    DrawLine(center + side * 7, center + side * 38, new Color(ink, 0.3f), 9);
                }
            }
            DrawLine(dir * 404, dir * 430, new Color(ink, 0.2f), 2);
        }
        // Taiji: a dark half with a light eye, a light half with a dark eye.
        const float r = 110;
        var dark = new Color(ink, 0.22f);
        var light = new Color(0.97f, 0.95f, 0.9f, 0.5f);
        DrawCircle(Vector2.Zero, r, light);
        // Right outer half, then the S back up the middle (no repeated points, or triangulation fails).
        var half = new System.Collections.Generic.List<Vector2>();
        for (var k = 0; k <= 24; k++) half.Add(Vector2.Up.Rotated(Mathf.Pi * k / 24) * r);
        for (var k = 1; k <= 12; k++) half.Add(new Vector2(0, r / 2) + Vector2.Down.Rotated(-Mathf.Pi * k / 12) * (r / 2));
        for (var k = 1; k < 12; k++) half.Add(new Vector2(0, -r / 2) + Vector2.Down.Rotated(Mathf.Pi * k / 12) * (r / 2));
        DrawColoredPolygon(half.ToArray(), dark);
        DrawCircle(new Vector2(0, -r / 2), r * 0.13f, light);
        DrawCircle(new Vector2(0, r / 2), r * 0.13f, dark);
        DrawArc(Vector2.Zero, r, 0, Mathf.Tau, 64, new Color(ink, 0.35f), 3, true);
    }
}

/// <summary>Draws the trial's qi motes and heart demons above the platform.</summary>
public partial class TrialLayer : Node2D
{
    private readonly TrialScreen _t;

    public TrialLayer(TrialScreen trial)
    {
        _t = trial;
        ZIndex = 5;
    }

    public override void _Process(double delta) => QueueRedraw();

    public override void _Draw()
    {
        foreach (var m in _t.Motes)
        {
            var color = Ink.Element(m.Element).Lightened(0.15f);
            var fade = Mathf.Clamp(m.Life / 0.6f, 0, 1) * Mathf.Clamp(m.Age / 0.3f, 0, 1);
            var bob = new Vector2(0, -26 + Mathf.Sin(m.Age * 4 + m.Pos.X) * 4);
            var at = m.Pos + bob;
            var root = _t.IsRoot(m.Element);
            DrawColoredPolygon(Paint.EllipsePts(m.Pos, 12, 4.5f, 12), new Color(0, 0, 0, 0.12f * fade));
            DrawCircle(at, (root ? 30 : 22) * fade, new Color(color, 0.14f));
            DrawCircle(at, (root ? 20 : 15) * fade, new Color(color, 0.22f));
            DrawCircle(at, (root ? 12 : 9) * fade, new Color(color, 0.9f * fade));
            DrawCircle(at, 4.5f * fade, new Color(1, 1, 1, 0.9f * fade));
            if (root) DrawArc(at, 19, m.Age * 3, m.Age * 3 + 4, 16, new Color(Ink.Gold, 0.85f * fade), 2, true);
            if (fade > 0.6f) Icons.Draw(this, Icons.ForElement(m.Element), at + new Vector2(0, -28), 15, new Color(color.Darkened(0.3f), fade));
        }
        foreach (var d in _t.Demons)
        {
            var at = d.Pos + new Vector2(0, -22);
            var flick = Mathf.Sin(d.Age * 11) * 2;
            DrawColoredPolygon(Paint.EllipsePts(d.Pos, 14, 5, 12), new Color(0, 0, 0, 0.18f));
            var body = Paint.Blob(at, 16 + flick, 20, 12, 0.22f, (int)(d.Wobble * 10) % 97);
            DrawColoredPolygon(body, new Color(0.35f, 0.05f, 0.08f, 0.75f));
            DrawPolyline(Paint.Closed(body), new Color(0.1f, 0.02f, 0.04f, 0.85f), 2, true);
            // Trailing wisps.
            for (var i = 1; i <= 3; i++)
                DrawCircle(at + new Vector2(Mathf.Sin(d.Wobble - i) * 6, 10 + i * 7), 7 - i * 1.6f, new Color(0.35f, 0.05f, 0.08f, 0.35f - i * 0.08f));
            DrawCircle(at + new Vector2(-6, -4), 3.2f, new Color("#ffd27a"));
            DrawCircle(at + new Vector2(6, -4), 3.2f, new Color("#ffd27a"));
            DrawCircle(at + new Vector2(-6, -4), 1.3f, new Color(0.1f, 0, 0));
            DrawCircle(at + new Vector2(6, -4), 1.3f, new Color(0.1f, 0, 0));
            // A jagged grin under the eyes.
            DrawPolyline(new[] { at + new Vector2(-6, 6), at + new Vector2(-3, 9), at + new Vector2(0, 6), at + new Vector2(3, 9), at + new Vector2(6, 6) },
                new Color(1, 0.8f, 0.7f, 0.75f), 1.6f, true);
        }
    }
}
