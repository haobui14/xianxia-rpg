using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Rules;
using TuTienLuc.Art;
using TuTienLuc.Audio;
using TuTienLuc.Ui;

namespace TuTienLuc.Field;

/// <summary>Qi flowing in along a meridian toward the dantian: pure (catch it), essence (catch it!) or turbid.</summary>
public sealed class QiDrop
{
    public int Channel;
    /// <summary>Distance from the dantian's centre, shrinking as it flows in.</summary>
    public float Dist;
    public float Speed;
    public bool Essence;
    public bool Turbid;
    public Element Element;
    public float Age;
    public bool Dead;
    public Vector2 Pos;
}

/// <summary>Turbid qi rushing down a whole meridian: announced, then it strikes along the line.</summary>
public sealed class Surge
{
    public int Channel;
    public float Time;
    public float Duration = 1.1f;
    public bool Fired;
    /// <summary>How long the struck meridian keeps smoking after it fires.</summary>
    public float After = 0.35f;
    public float Progress => Mathf.Clamp(Time / Duration, 0, 1);
}

/// <summary>A shockwave the forming foundation sends out of the dantian, with gaps to stand in.</summary>
public sealed class Shockwave
{
    public float Warn = 0.8f;
    public float Radius = FoundationTrial.Sink;
    public float Speed = 300;
    /// <summary>Gap centres (radians, from +x) and their half-width.</summary>
    public float[] Gaps = System.Array.Empty<float>();
    public const float GapHalf = 0.42f;
    public bool Resolved;
    public bool Emitted => Warn <= 0;

    public bool InGap(float angle) => Gaps.Any(g => Mathf.Abs(Mathf.Wrap(angle - g, -Mathf.Pi, Mathf.Pi)) < GapHalf);

    public float NearestGap(float angle) => Gaps.OrderBy(g => Mathf.Abs(Mathf.Wrap(angle - g, -Mathf.Pi, Mathf.Pi))).First();
}

/// <summary>
/// Trúc Cơ, the meridian storm (design §7.5). Inside the body, the eight extraordinary meridians carry qi
/// to the dantian for sixty seconds. Catch the pure qi on its way in — your root's essence is rarer and
/// worth more — cut or dodge the turbid qi, step off a meridian when a surge is announced down it, and in
/// the last phase find the gaps in the shockwaves the forming foundation sends out. Performance grades the
/// foundation (Hạ / Trung / Thượng / Thiên phẩm), which multiplies the breakthrough's gains for good.
/// </summary>
public partial class FoundationTrial : TrialBase
{
    public const float Duration = 60f;
    /// <summary>A flawless storm scores about this much; heaven grade needs 95% of it.</summary>
    public const float Goal = 150f;
    public const int Channels = 8;
    /// <summary>The platform's edge, and where qi sinks into the dantian (out of reach).</summary>
    public const float Rim = 430f, Sink = 112f;
    private const float Cell = 128;
    private const int W = 16, H = 12;

    /// <summary>The eight extraordinary meridians (kỳ kinh bát mạch), clockwise from the north.</summary>
    private static readonly string[] MeridiansVi = { "Đốc", "Dương", "Đới", "Duy", "Nhâm", "Âm", "Xung", "Kiều" };
    private static readonly string[] MeridiansEn = { "Governing", "Yang", "Girdle", "Linking", "Conception", "Yin", "Penetrating", "Heel" };

    /// <summary>Meridian <paramref name="i"/>'s name in the interface language.</summary>
    public static string Meridian(int i) => Game.Instance.T(MeridiansVi[i], MeridiansEn[i]);

    public readonly List<QiDrop> Drops = new();
    public readonly List<Surge> Surges = new();
    public readonly List<Shockwave> Waves = new();
    public float Time;
    public float Score;
    public int Hits;
    /// <summary>Foundation stones laid so far (one per eighth of the goal).</summary>
    public int Stones => Mathf.Clamp((int)(Score / (Goal / 8)), 0, 8);

    private Element _essence;
    private float _calm = 2f;
    private float _dropTimer, _turbidTimer = 1.4f, _surgeTimer = 1.5f, _waveTimer = 1f;
    private int _phaseShown = -1;
    private int _stonesShown;

    public Vector2 Center => new(W / 2f * Cell, H / 2f * Cell);
    public int Phase => Time < 20 ? 0 : Time < 40 ? 1 : 2;
    public float TimeLeft => Mathf.Max(0, Duration - Time);
    public bool Calm => _calm > 0;
    public Element Essence => _essence;
    public override double Performance => Mathf.Clamp(Score / Goal, 0, 1);

    public static Vector2 Dir(int channel) => Vector2.Up.Rotated(Mathf.Tau * channel / Channels);
    public Vector2 At(int channel, float dist) => Center + Dir(channel) * dist;

    /// <summary>Is <paramref name="pos"/> within <paramref name="within"/> of the meridian's open stretch?</summary>
    public bool OnChannel(int channel, Vector2 pos, float within) =>
        FieldMath.SegmentDistance(pos, At(channel, Sink), At(channel, Rim + 20)) <= within;

    public override string PlaceName => T("Đột phá: Trúc Cơ", "Breakthrough: Foundation Establishment");
    public override string PlaceSub => Phase switch
    {
        0 => T("Khai mạch — đón linh khí dọc kinh mạch", "Opening the meridians — catch the qi on its way in"),
        1 => T("Tụ khí — tránh trọc khí cuộn dọc kinh mạch", "Gathering — dodge the turbid surges"),
        _ => T("Trúc cơ — nền móng rung chuyển, tìm khe hở", "Laying the foundation — find the gaps in the shockwaves"),
    };

    public override string HintText() => TouchUi.Active
        ? T("Cần gạt để đi · đứng trên kinh mạch để đón linh khí · giữ nút kiếm để chém trọc khí gần nhất · nút lướt để vượt sóng xung kích",
            "Stick moves · stand on a meridian to catch qi · hold the sword button to cut the nearest turbid qi · the dash button gets through shockwaves")
        : T($"{KeyMap.MoveKeys} di chuyển · đứng trên kinh mạch để đón linh khí · chuột trái chém trọc khí · {KeyName("dash")} lướt qua sóng xung kích · Esc tạm dừng",
            $"{KeyMap.MoveKeys} move · stand on a meridian to catch qi · left click cuts turbid qi · {KeyName("dash")} dashes through shockwaves · Esc pause");

    /// <summary>With touch controls a strike aims at the nearest turbid qi within reach of the blade.</summary>
    public override Vector2? AimAssist(Vector2 from)
    {
        QiDrop? best = null;
        foreach (var d in Drops)
            if (d.Turbid && d.Pos.DistanceTo(from) < 360 && (best == null || d.Pos.DistanceSquaredTo(from) < best.Pos.DistanceSquaredTo(from))) best = d;
        return best?.Pos;
    }

    protected override string PassedTitle => T($"Trúc cơ {Foundation.Name(Foundation.GradeFor(Performance), Locale.Vi)}!",
        $"A {Foundation.Name(Foundation.GradeFor(Performance), Locale.En)} foundation!");
    protected override string FailedTitle => T("Nền móng sụp đổ…", "The foundation crumbles…");

    private static Vector2 V(float x, float y) => new(x, y);

    protected override void BuildField()
    {
        ReadPreparation();
        var root = E.Player.Root.Elements;
        _essence = root.Count > 0 ? root[0] : Element.Moc;

        Walls = new CollisionWorld(W, H, Cell);
        for (var y = 0; y < H; y++)
            for (var x = 0; x < W; x++)
                if (x == 0 || y == 0 || x == W - 1 || y == H - 1) Walls.SetSolid(x, y, walk: true, shots: true);

        // The sea of qi (khí hải): deep water under an indigo wash, glinting.
        var mat = ShaderQuad.MakeMaterial("res://shaders/terrain.gdshader", new Dictionary<string, Variant>
        {
            ["terrain_tex"] = TerrainTextures.Terrain(W, H, (_, _) => TerrainId.Water), ["noise_tex"] = TerrainTextures.Noise(),
            ["map_cells"] = new Vector2(W, H), ["cell_px"] = Cell, ["season"] = 0, ["tint"] = new Color(0.34f, 0.36f, 0.52f),
        });
        AddChild(new ShaderQuad(new Rect2(-512, -512, W * Cell + 1024, H * Cell + 1024), mat, -20));
        // Mist at the edges of the inner world.
        var fog = TerrainTextures.FogImage(W, H);
        for (var y = 0; y < H; y++)
            for (var x = 0; x < W; x++)
                fog.SetPixel(x, y, x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2 ? Colors.Black : Colors.White);
        var fogMat = ShaderQuad.MakeMaterial("res://shaders/fog.gdshader", new Dictionary<string, Variant>
        {
            ["fog_tex"] = ImageTexture.CreateFromImage(fog), ["noise_tex"] = TerrainTextures.Noise(), ["map_cells"] = new Vector2(W, H),
            ["cell_px"] = Cell, ["strength"] = 0.55f,
        });
        AddChild(new ShaderQuad(new Rect2(-512, -512, W * Cell + 1024, H * Cell + 1024), fogMat, 20));

        AddChild(new FoundationFloor(this));
        AddChild(new FoundationLayer(this));
    }

    protected override Vector2 SpawnPoint() => Center + V(0, 250);

    protected override void AfterReady()
    {
        PlayerBody.Meditating = true;
        PlayerBody.Face(Vector2.Up);
        Hud.Banner(T("Trúc cơ", "Foundation Establishment"),
            T("Kinh mạch sắp mở — đón linh khí, tránh trọc khí", "The meridians are about to open — catch the qi, dodge the turbid"), Ink.JadeDeep, 2f);
    }

    // ================================================================ the storm

    protected override void UpdateField(float dt)
    {
        foreach (var d in Drops) d.Age += dt;
        if (UpdateVerdict(dt)) return;
        if (_calm > 0)
        {
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
        AnnouncePhase();
        Spawn(dt);
        UpdateDrops(dt);
        UpdateSurges(dt);
        UpdateWaves(dt);

        // The platform is all there is: step off its edge and the storm sets you back on it.
        var p = PlayerBody;
        var rel = p.Pos - Center;
        if (rel.Length() > Rim + 12) p.Pos = Center + rel.Normalized() * (Rim + 12);

        if (Stones > _stonesShown)
        {
            _stonesShown = Stones;
            SoundBoard.Play("chime", -4, 0.8f + 0.06f * _stonesShown);
            Fx.Ring(Center, Sink + 24, Ink.Gold, 0.6f);
        }
        if (Time >= Duration) EndTrial(Performance);
    }

    private void AnnouncePhase()
    {
        if (Phase == _phaseShown) return;
        _phaseShown = Phase;
        if (Phase == 0) return;
        SoundBoard.Play("gong", -4, Phase == 1 ? 1f : 0.84f);
        Shake(5);
        if (Phase == 1)
            Hud.Banner(T("Tụ khí", "Gathering"), T("Trọc khí bắt đầu cuộn dọc kinh mạch — thấy vệt đỏ thì bước ra", "Turbid qi surges down the meridians — step off a red one"), Ink.GoldDeep, 1.6f);
        else
            Hud.Banner(T("Trúc cơ", "Laying the foundation"), T("Nền móng rung chuyển — tìm khe hở trong sóng, hoặc lướt xuyên qua", "The foundation shudders — stand in the gaps of each wave, or dash through"), Ink.CinnabarDeep, 1.6f);
    }

    private void Spawn(float dt)
    {
        var rng = GD.Randf;
        _dropTimer -= dt;
        if (_dropTimer <= 0)
        {
            _dropTimer = Phase switch { 0 => 0.5f, 1 => 0.42f, _ => 0.36f };
            var essence = rng() < 0.22f;
            Drops.Add(new QiDrop
            {
                Channel = (int)(rng() * Channels) % Channels, Dist = Rim + 10, Speed = 100 + rng() * 40 + 12 * Phase,
                Essence = essence, Element = essence ? _essence : Element.Moc,
            });
        }
        _turbidTimer -= dt;
        if (_turbidTimer <= 0)
        {
            _turbidTimer = Phase switch { 0 => 1.8f, 1 => 1.3f, _ => 1.0f };
            Drops.Add(new QiDrop { Channel = (int)(rng() * Channels) % Channels, Dist = Rim + 10, Speed = 90 + rng() * 40 + 10 * Phase, Turbid = true });
        }
        if (Phase >= 1)
        {
            _surgeTimer -= dt;
            if (_surgeTimer <= 0)
            {
                _surgeTimer = Phase == 1 ? 3.4f : 2.6f;
                var first = (int)(rng() * Channels) % Channels;
                AddSurge(first, Phase == 1 ? 1.1f : 0.95f);
                // In the last phase a surge sometimes comes down the opposite meridian too.
                if (Phase == 2 && rng() < 0.5f) AddSurge((first + Channels / 2) % Channels, 0.95f);
            }
        }
        if (Phase >= 2)
        {
            _waveTimer -= dt;
            if (_waveTimer <= 0)
            {
                _waveTimer = 4.5f;
                var a = rng() * Mathf.Tau;
                Waves.Add(new Shockwave { Gaps = new[] { a, a + Mathf.Pi * (0.7f + rng() * 0.6f) } });
                SoundBoard.Play("warn", -6);
            }
        }
    }

    private void AddSurge(int channel, float duration)
    {
        if (Surges.Any(s => s.Channel == channel)) return;
        Surges.Add(new Surge { Channel = channel, Duration = duration });
        SoundBoard.Play("warn", -8, 1.2f);
    }

    private void UpdateDrops(float dt)
    {
        var p = PlayerBody;
        var chest = p.Pos + V(0, -20);
        foreach (var d in Drops)
        {
            d.Dist -= d.Speed * dt;
            d.Pos = At(d.Channel, d.Dist);
            if (d.Dist <= Sink)
            {
                // Sinks into the dantian out of reach: pure qi feeds its glow, turbid qi clouds it.
                d.Dead = true;
                continue;
            }
            if (d.Pos.DistanceTo(chest) > p.Radius + 24) continue;
            d.Dead = true;
            if (d.Turbid)
            {
                if (p.Invuln > 0)
                {
                    CutDrop(d);
                    continue;
                }
                Hurt(4, T("−4 trọc khí", "−4 turbid qi"));
                continue;
            }
            var gain = d.Essence ? 4 : 1;
            Score += gain;
            var color = d.Essence ? Ink.Element(d.Element) : Ink.Jade;
            SoundBoard.Play("mote", d.Essence ? 0 : -6, d.Essence ? 2f : 1.5f, 0.02f, 20);
            Fx.Say(d.Pos + V(0, -24), "+" + gain, color, d.Essence ? 22 : 16, 0.6f);
            Fx.Burst(d.Pos + V(0, -20), color.Lightened(0.3f), d.Essence ? 8 : 4, 90, ParticleKind.Spark, 2);
        }
        Drops.RemoveAll(d => d.Dead);
    }

    private void UpdateSurges(float dt)
    {
        var p = PlayerBody;
        foreach (var s in Surges)
        {
            s.Time += dt;
            if (!s.Fired && s.Time >= s.Duration)
            {
                s.Fired = true;
                SoundBoard.PlayAt("slam", At(s.Channel, (Sink + Rim) / 2), -4);
                Shake(4);
                // Everything turbid on that meridian goes with it; a cultivator standing on it takes the blow.
                if (OnChannel(s.Channel, p.Pos, 36 + p.Radius))
                {
                    if (p.Invuln > 0) Fx.Say(p.Pos + V(0, -86), T("Né!", "Dodge!"), Ink.Jade, 18);
                    else Hurt(6, T("−6 trọc khí cuộn", "−6 turbid surge"));
                }
            }
            if (s.Fired) s.After -= dt;
        }
        Surges.RemoveAll(s => s.Fired && s.After <= 0);
    }

    private void UpdateWaves(float dt)
    {
        var p = PlayerBody;
        var rel = p.Pos - Center;
        var dist = rel.Length();
        var angle = Mathf.Atan2(rel.Y, rel.X);
        foreach (var w in Waves)
        {
            if (!w.Emitted)
            {
                w.Warn -= dt;
                if (w.Emitted)
                {
                    SoundBoard.Play("pulse", -3, 0.7f);
                    Fx.Ring(Center, Sink, Ink.Cinnabar, 0.4f);
                }
                continue;
            }
            w.Radius += w.Speed * dt;
            if (w.Resolved || w.Radius < dist - p.Radius) continue;
            w.Resolved = true;
            if (w.InGap(angle)) continue;
            if (p.Invuln > 0)
            {
                Fx.Say(p.Pos + V(0, -86), T("Né!", "Dodge!"), Ink.Jade, 18);
                continue;
            }
            Hurt(5, T("−5 sóng xung kích", "−5 shockwave"));
        }
        Waves.RemoveAll(w => w.Radius > Rim + 60);
    }

    private void Hurt(float amount, string text)
    {
        var p = PlayerBody;
        Score = Mathf.Max(0, Score - amount);
        Hits += 1;
        SoundBoard.Play("demon", -2);
        p.Stun = Mathf.Max(p.Stun, 0.3f);
        p.HitFlash = 0.15f;
        Shake(8);
        Fx.Say(p.Pos + V(0, -86), text, Ink.Cinnabar, 20);
        Fx.Burst(p.Pos + V(0, -30), new Color(0.3f, 0.2f, 0.35f, 0.6f), 10, 150, ParticleKind.Mist, 7);
    }

    private void CutDrop(QiDrop d)
    {
        d.Dead = true;
        Score += 1;
        SoundBoard.PlayAt("kill", d.Pos, -5);
        Fx.Say(d.Pos + V(0, -30), T("Tán!", "Purged!"), Ink.JadeDeep, 18);
        Fx.Burst(d.Pos + V(0, -20), new Color(0.3f, 0.22f, 0.32f, 0.6f), 8, 140, ParticleKind.Ink, 3);
    }

    public override void OnPlayerSlash(Vector2 origin, Vector2 dir, float arc, float reach)
    {
        foreach (var d in Drops.Where(d => d.Turbid && !d.Dead && FieldMath.InArc(origin, dir, arc, reach + 12, d.Pos, 14)).ToList()) CutDrop(d);
        Drops.RemoveAll(d => d.Dead);
    }

    public override void OnPlayerDash(Vector2 pos, float radius)
    {
        foreach (var d in Drops.Where(d => d.Turbid && !d.Dead && d.Pos.DistanceTo(pos) <= radius + 16).ToList()) CutDrop(d);
        Drops.RemoveAll(d => d.Dead);
    }

    protected override void OnEnded(bool passed)
    {
        Drops.Clear();
        Surges.Clear();
        Waves.Clear();
        if (passed) Fx.Ring(Center, Rim, Ink.Gold, 1.4f);
    }

    // ================================================================ the gauge

    public override void DrawHud(FieldHud hud, Vector2 size)
    {
        var w = 640f;
        var pos = new Vector2(size.X / 2 - w / 2, GaugeY(size));
        var box = new Rect2(pos - new Vector2(12, 28), new Vector2(w + 24, 98));
        hud.DrawRect(box, new Color(Ink.Card, 0.9f));
        hud.DrawRect(box, Ink.LineStrong, false, 1);
        var grade = Foundation.GradeFor(Performance);
        var passing = Performance >= Threshold;
        var title = T($"Nền móng {Score:0}/{Goal:0}", $"Foundation {Score:0}/{Goal:0}")
                    + (passing ? T($" · {Foundation.Name(grade, Locale.Vi)}", $" · {Foundation.Name(grade, Locale.En)}") : "");
        hud.DrawString(Ink.Serif, pos + new Vector2(0, -8), title, HorizontalAlignment.Left, -1, 17, passing ? Ink.JadeDeep : Ink.InkColor);
        var tl = Calm ? "…" : $"{TimeLeft:0.0}s";
        hud.DrawString(Ink.UiFont, pos + new Vector2(w - 50, -8), tl, HorizontalAlignment.Left, -1, 15, TimeLeft < 8 ? Ink.Cinnabar : Ink.InkSoft);
        hud.Bar(pos, w, 18, Score, Goal, passing ? (grade >= FoundationGrade.Thuong ? Ink.Gold : Ink.Jade) : Ink.InkSoft, "");
        // The threshold (red) and the grade lines (Trung, Thượng, Thiên).
        var tx = pos.X + w * Threshold;
        hud.DrawLine(new Vector2(tx, pos.Y - 4), new Vector2(tx, pos.Y + 22), Ink.CinnabarDeep, 3);
        foreach (var (at, name) in new[] { (Foundation.Trung, T("Trung", "Middle")), (Foundation.Thuong, T("Thượng", "Upper")), (Foundation.Thien, T("Thiên", "Heaven")) })
        {
            var gx = pos.X + w * (float)at;
            hud.DrawLine(new Vector2(gx, pos.Y), new Vector2(gx, pos.Y + 18), new Color(Ink.GoldDeep, 0.9f), 2);
            var nw = Ink.UiFont.GetStringSize(name, HorizontalAlignment.Left, -1, 12).X;
            hud.DrawString(Ink.UiFont, new Vector2(gx - nw / 2, pos.Y + 36), name, HorizontalAlignment.Left, -1, 12, Ink.GoldDeep);
        }
        hud.DrawString(Ink.UiFont, new Vector2(tx - 30, pos.Y + 36), T($"cần {Threshold * 100:0}%", $"need {Threshold * 100:0}%"), HorizontalAlignment.Left, -1, 12, Ink.CinnabarDeep);
        var phase = Phase switch { 0 => T("Khai mạch", "Opening"), 1 => T("Tụ khí", "Gathering"), _ => T("Trúc cơ", "Foundation") };
        hud.DrawString(Ink.UiFont, pos + new Vector2(0, 56),
            T($"{phase} · linh khí +1 · tinh hoa {Names.Display(_essence, Locale.Vi)} +4 · trảm trọc khí +1 · trúng đòn −4…−6 ({Hits} lần)",
                $"{phase} · qi +1 · {Names.Display(_essence, Locale.En)} essence +4 · cut turbid +1 · hits −4…−6 ({Hits} so far)"),
            HorizontalAlignment.Left, -1, 12, Ink.InkMute);
    }
}

/// <summary>The platform inside: jade over the sea of qi, the eight meridians, the dantian and its stones.</summary>
public partial class FoundationFloor : Node2D
{
    /// <summary>The jade tag a meridian's name sits on at the rim.</summary>
    private readonly StyleBoxFlat _tag = new()
    {
        BgColor = new Color(0.84f, 0.9f, 0.86f, 0.95f),
        BorderWidthLeft = 2, BorderWidthTop = 2, BorderWidthRight = 2, BorderWidthBottom = 2,
        CornerRadiusTopLeft = 16, CornerRadiusTopRight = 16, CornerRadiusBottomLeft = 16, CornerRadiusBottomRight = 16,
        AntiAliasing = true,
    };
    private readonly FoundationTrial _t;
    private float _time;

    public FoundationFloor(FoundationTrial trial)
    {
        _t = trial;
        ZIndex = -15;
    }

    public override void _Process(double delta)
    {
        _time += (float)delta;
        QueueRedraw();
    }

    public override void _Draw()
    {
        var c = _t.Center;
        var ink = new Color(0.11f, 0.13f, 0.19f);
        const float rim = FoundationTrial.Rim, sink = FoundationTrial.Sink;
        // The disk: pale jade with an inked rim and a second, fainter circle.
        DrawCircle(c, rim + 36, new Color(0.05f, 0.07f, 0.12f, 0.35f));
        DrawCircle(c, rim + 28, new Color(0.84f, 0.9f, 0.86f, 0.94f));
        DrawArc(c, rim + 28, 0, Mathf.Tau, 128, new Color(ink, 0.7f), 5, true);
        DrawArc(c, rim + 12, 0, Mathf.Tau, 128, new Color(ink, 0.18f), 2, true);
        DrawArc(c, (rim + sink) / 2, 0, Mathf.Tau, 96, new Color(ink, 0.08f), 2, true);

        // The meridians: grooves with a live line of qi, acupoints along them, and their seal at the rim.
        for (var i = 0; i < FoundationTrial.Channels; i++)
        {
            var dir = FoundationTrial.Dir(i);
            var a = c + dir * sink;
            var b = c + dir * (rim + 10);
            var flow = 0.55f + 0.45f * Mathf.Sin(_time * 3 - i * 0.8f);
            DrawLine(a, b, new Color(0.35f, 0.5f, 0.45f, 0.45f), 30, true);
            DrawLine(a, b, new Color(0.93f, 0.98f, 0.95f, 0.9f), 12, true);
            DrawLine(a, b, new Color(0.45f, 0.78f, 0.66f, 0.35f + 0.25f * flow), 5, true);
            for (var d = sink + 50; d < rim; d += 64) DrawCircle(c + dir * d, 5, new Color(ink, 0.35f));
            // Its name on a jade tag at the rim.
            var seal = c + dir * (rim + 58);
            var name = FoundationTrial.Meridian(i);
            var ns = Ink.UiFont.GetStringSize(name, HorizontalAlignment.Left, -1, 17);
            var tag = new Rect2(seal - new Vector2(ns.X / 2 + 11, 16), new Vector2(ns.X + 22, 32));
            _tag.BorderColor = new Color(ink, 0.6f);
            DrawStyleBox(_tag, tag);
            DrawString(Ink.UiFont, seal + new Vector2(-ns.X / 2, 6), name, HorizontalAlignment.Left, -1, 17, new Color(ink, 0.9f));
        }

        // The dantian: a pool that brightens as the foundation rises.
        // A deep jade basin that fills with golden light (opaque colours: gold over indigo would turn to mud).
        var fill = (float)_t.Performance;
        var pulse = 0.5f + 0.5f * Mathf.Sin(_time * 2.2f);
        DrawCircle(c, sink, new Color(0.13f, 0.27f, 0.27f));
        DrawCircle(c, sink * 0.86f, new Color(0.16f, 0.34f, 0.32f));
        var core = sink * (0.3f + 0.55f * fill);
        DrawCircle(c, core + 6, new Color(0.96f, 0.8f, 0.42f).Lerp(new Color(0.16f, 0.34f, 0.32f), 0.55f));
        DrawCircle(c, core, new Color(0.98f, 0.84f, 0.46f).Lerp(new Color(1f, 0.95f, 0.8f), 0.3f * pulse));
        DrawArc(c, sink, 0, Mathf.Tau, 72, new Color(ink, 0.8f), 4, true);
        Icons.Draw(this, IconKind.Core, c, 50, new Color(0.3f, 0.18f, 0.08f, 0.45f + 0.4f * fill));

        // Eight foundation stones around it, laid one per eighth of the goal.
        for (var i = 0; i < 8; i++)
        {
            var laid = i < _t.Stones;
            var from = -Mathf.Pi / 2 + Mathf.Tau * i / 8 + 0.06f;
            var to = from + Mathf.Tau / 8 - 0.12f;
            var color = laid ? new Color(0.76f, 0.6f, 0.3f, 0.95f) : new Color(ink, 0.12f);
            DrawArc(c, sink + 14, from, to, 12, color, 16, true);
            if (laid) DrawArc(c, sink + 20, from, to, 12, new Color(1f, 0.9f, 0.6f, 0.6f), 3, true);
        }
    }
}

/// <summary>The storm itself: qi flowing along the meridians, surges, and the shockwaves.</summary>
public partial class FoundationLayer : Node2D
{
    private readonly FoundationTrial _t;

    public FoundationLayer(FoundationTrial trial)
    {
        _t = trial;
        ZIndex = 5;
    }

    public override void _Process(double delta) => QueueRedraw();

    public override void _Draw()
    {
        var c = _t.Center;
        // Surges: a red band filling down the meridian, then a dark rush when it strikes.
        foreach (var s in _t.Surges)
        {
            var dir = FoundationTrial.Dir(s.Channel);
            var a = c + dir * (FoundationTrial.Rim + 20);
            var b = c + dir * FoundationTrial.Sink;
            if (!s.Fired)
            {
                DrawLine(a, b, new Color(Ink.Cinnabar, 0.16f), 72, true);
                DrawLine(a, a.Lerp(b, s.Progress), new Color(Ink.Cinnabar, 0.3f), 72, true);
                DrawLine(a, b, new Color(Ink.CinnabarDeep, 0.6f), 2, true);
            }
            else
            {
                var k = Mathf.Clamp(s.After / 0.35f, 0, 1);
                DrawLine(a, b, new Color(0.22f, 0.1f, 0.2f, 0.7f * k), 60, true);
                DrawLine(a, b, new Color(0.55f, 0.2f, 0.3f, 0.8f * k), 14, true);
            }
        }

        // Shockwaves: the dantian flares red while one gathers, then a dark ring rolls out with gaps.
        foreach (var w in _t.Waves)
        {
            if (!w.Emitted)
            {
                var k = 1 - w.Warn / 0.8f;
                DrawArc(c, FoundationTrial.Sink + 4, 0, Mathf.Tau, 64, new Color(Ink.Cinnabar, 0.3f + 0.6f * k), 6 + 6 * k, true);
                foreach (var g in w.Gaps)
                {
                    var dir = Vector2.Right.Rotated(g);
                    DrawLine(c + dir * (FoundationTrial.Sink + 16), c + dir * (FoundationTrial.Rim + 10), new Color(Ink.Jade, 0.25f * k), 10, true);
                }
                continue;
            }
            var edges = w.Gaps.SelectMany(g => new[] { g - Shockwave.GapHalf, g + Shockwave.GapHalf }).Select(x => Mathf.PosMod(x, Mathf.Tau)).OrderBy(x => x).ToList();
            for (var i = 0; i < edges.Count; i++)
            {
                var from = edges[i];
                var to = i + 1 < edges.Count ? edges[i + 1] : edges[0] + Mathf.Tau;
                var mid = Mathf.PosMod((from + to) / 2, Mathf.Tau);
                if (w.InGap(mid)) continue;
                DrawArc(c, w.Radius, from, to, 48, new Color(0.25f, 0.1f, 0.22f, 0.55f), 26, true);
                DrawArc(c, w.Radius, from, to, 48, new Color(0.75f, 0.25f, 0.3f, 0.85f), 6, true);
            }
        }

        // The qi drops, with a short trail back up their meridian.
        foreach (var d in _t.Drops)
        {
            var dir = FoundationTrial.Dir(d.Channel);
            var at = d.Pos + new Vector2(0, -20);
            var fade = Mathf.Clamp(d.Age / 0.25f, 0, 1);
            if (d.Turbid)
            {
                var body = Paint.Blob(at, 13, 13, 10, 0.3f, d.Channel * 13 + (int)(d.Age * 7) % 5);
                DrawCircle(at, 20, new Color(0.25f, 0.12f, 0.25f, 0.25f * fade));
                DrawColoredPolygon(body, new Color(0.3f, 0.18f, 0.3f, 0.85f * fade));
                DrawPolyline(Paint.Closed(body), new Color(0.12f, 0.05f, 0.1f, 0.9f * fade), 2, true);
                Icons.Draw(this, IconKind.Turbid, at, 13, new Color(0.9f, 0.75f, 0.85f, 0.8f * fade));
                continue;
            }
            var color = d.Essence ? Ink.Element(d.Element).Lightened(0.15f) : new Color(0.85f, 1f, 0.93f);
            for (var i = 1; i <= 4; i++)
                DrawCircle(at + dir * i * 9, (d.Essence ? 9 : 6) - i * 1.2f, new Color(color, 0.25f * fade / i));
            DrawCircle(at, (d.Essence ? 22 : 15) * fade, new Color(color, 0.18f));
            DrawCircle(at, (d.Essence ? 11 : 7) * fade, new Color(color, 0.95f));
            DrawCircle(at, 3.5f * fade, new Color(1, 1, 1, 0.95f));
            if (d.Essence)
            {
                DrawArc(at, 16, d.Age * 4, d.Age * 4 + 4, 16, new Color(Ink.Gold, 0.9f * fade), 2, true);
                Icons.Draw(this, Icons.ForElement(d.Element), at + new Vector2(0, -24), 14, new Color(color.Darkened(0.35f), fade));
            }
        }
    }
}
