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
    /// <summary>How long a struck meridian keeps smoking after it fires.</summary>
    public const float AfterTime = 0.35f;

    public int Channel;
    public float Time;
    /// <summary>The warning: the red fills down the meridian for this long, then it strikes.</summary>
    public float Duration = 1.6f;
    public bool Fired;
    public float After = AfterTime;
    public float Progress => Mathf.Clamp(Time / Duration, 0, 1);
}

/// <summary>A shockwave the forming foundation sends out of the dantian, with gaps to stand in.</summary>
public sealed class Shockwave
{
    /// <summary>How long the dantian flares (and the gaps show) before the ring rolls out.</summary>
    public float WarnTime = 1.5f;
    public float Warn = 1.5f;
    public float Radius = FoundationTrial.Sink;
    public float Speed = 210;
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
    public const float Goal = 140f;
    public const int Channels = 8;
    /// <summary>The platform's edge, and where qi sinks into the dantian (out of reach).</summary>
    public const float Rim = 430f, Sink = 112f;
    private const float Cell = 128;
    private const int W = 16, H = 12;
    /// <summary>The ink the platform is drawn in.</summary>
    public static readonly Color InkTone = new(0.11f, 0.13f, 0.19f);

    // ---- the storm's pace: slow enough for a thumb on a phone to read a warning and move (by phase 0, 1, 2)
    /// <summary>Seconds between drops of pure qi, and of turbid qi.</summary>
    private static readonly float[] PureEvery = { 0.55f, 0.48f, 0.42f }, TurbidEvery = { 2.2f, 1.7f, 1.35f };
    /// <summary>How fast qi flows in (pixels a second): a base, a random share, and more each phase.</summary>
    private const float PureSpeed = 72, PureRandom = 28, PurePerPhase = 8, TurbidSpeed = 64, TurbidRandom = 26, TurbidPerPhase = 7;
    /// <summary>A surge's warning, and the time between surges, in the gathering phase and the last one.</summary>
    private const float SurgeWarn1 = 1.7f, SurgeWarn2 = 1.45f, SurgeEvery1 = 4.2f, SurgeEvery2 = 3.4f, DoubleSurgeChance = 0.35f;
    /// <summary>A shockwave's warning, how fast its ring rolls out, and the time between them.</summary>
    private const float WaveWarn = 1.5f, WaveSpeed = 210, WaveEvery = 5.5f;

    public FoundationTrial(bool practice = false) : base(practice)
    {
    }

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
    private float _dropTimer, _turbidTimer = 1.6f, _surgeTimer = 1.8f, _waveTimer = 1.5f;
    private int _phaseShown = -1;
    private int _stonesShown;

    public Vector2 Center => new(W / 2f * Cell, H / 2f * Cell);
    public int Phase => Time < 20 ? 0 : Time < 40 ? 1 : 2;
    public float TimeLeft => Mathf.Max(0, Duration - Time);
    public bool Calm => Starting;
    public Element Essence => _essence;
    public override double Performance => Mathf.Clamp(Score / Goal, 0, 1);

    /// <summary>The platform and the meridians' name tags, whole on any screen.</summary>
    protected override Rect2? Stage => new Rect2(Center - new Vector2(Rim + 110, Rim + 110), new Vector2(Rim + 110, Rim + 110) * 2);

    public override string GuideTitle => T("Trúc Cơ: bão kinh mạch", "Foundation: the meridian storm");

    public override string GuideIntro => T(
        $"Trong 60 giây, linh khí đổ về đan điền (vòng tròn giữa) theo tám kinh mạch. Đón đủ để thanh nền móng vượt vạch đỏ ({Threshold * 100:0}%) là đột phá thành công; càng vượt xa, nền móng càng tốt. Có ba chặng, mỗi chặng thêm một mối nguy:",
        $"For 60 seconds qi pours into your dantian (the circle in the middle) along eight meridians. Fill the foundation bar past the red line ({Threshold * 100:0}%) to break through; the further past it, the better the foundation. There are three stretches, and each adds a danger:");

    public override IReadOnlyList<GuideStep> GuideSteps => new[]
    {
        new GuideStep(IconKind.Orb, Ink.JadeDeep, T("0–20 giây · Khai mạch", "0–20 s · Opening"),
            T($"Những đốm linh khí sáng trôi dọc kinh mạch về giữa. Đứng lên kinh mạch chắn đường chúng để đón: +1, tinh hoa {Names.Display(_essence, Locale.Vi)} (màu hệ, có vòng vàng) +4. Trọc khí tím sẫm chạm người thì −4: chém nó (+1) hoặc bước sang bên.",
                $"Bright motes of qi drift along the meridians toward the middle. Stand on a meridian in their way to catch them: +1, and {Names.Display(_essence, Locale.En)} essence (its element's colour, with a gold ring) +4. Dark purple turbid qi costs −4 if it touches you: cut it (+1) or step aside.")),
        new GuideStep(IconKind.Wave, Ink.CinnabarDeep, T("20–40 giây · Tụ khí", "20–40 s · Gathering"),
            T("Một kinh mạch hóa đỏ là trọc khí sắp cuộn xuống: vệt đỏ lan dần vào giữa, đầy rồi cả kinh mạch bị quét. Bước khỏi nó trước khi vệt đỏ đầy (−6 nếu bị cuốn).",
                "A meridian turning red means a surge is coming: the red fills toward the middle, then the whole line is swept. Step off it before the red is full (−6 if it catches you).")),
        new GuideStep(IconKind.Burst, Ink.Violet, T("40–60 giây · Trúc cơ", "40–60 s · Laying the foundation"),
            T("Đan điền lóe đỏ, rồi một vòng sóng lăn ra ngoài. Hai đường xanh chỉ khe hở của nó: đứng trong một khe, hoặc lướt xuyên qua đúng lúc sóng tới (−5 nếu bị trúng).",
                "The dantian flares red, then a ring rolls outward. Two green paths show its gaps: stand in one, or dash through the ring just as it reaches you (−5 if it hits you).")),
        new GuideStep(IconKind.Dash, Ink.GoldDeep, T("Điều khiển", "Controls"), TouchUi.Active
            ? T("Cần gạt bên trái để đi · giữ nút kiếm để chém trọc khí gần nhất · nút lướt: lướt nhanh, trong chớp mắt không gì chạm được.",
                "The stick on the left moves · hold the sword button to cut the nearest turbid qi · the dash button: a quick dash, untouchable for a moment.")
            : T($"{KeyMap.MoveKeys} để đi · chuột trái chém trọc khí · {KeyMap.Label("dash")}: lướt nhanh, trong chớp mắt không gì chạm được · Esc tạm dừng.",
                $"{KeyMap.MoveKeys} moves · left click cuts turbid qi · {KeyMap.Label("dash")}: a quick dash, untouchable for a moment · Esc pauses.")),
    };

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
        Sentence($"{Foundation.WithArticle(Foundation.GradeFor(Performance))} foundation!"));

    private static string Sentence(string s) => s.Length == 0 ? s : char.ToUpperInvariant(s[0]) + s.Substring(1);
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
        ShowGuide();
    }

    protected override void OnStart() =>
        Hud.Banner(T("Khai mạch", "Opening"), T("Đứng trên kinh mạch để đón linh khí, tránh trọc khí", "Stand on a meridian to catch the qi, dodge the turbid"), Ink.JadeDeep, 2.2f);

    // ================================================================ the storm

    protected override void UpdateField(float dt)
    {
        foreach (var d in Drops) d.Age += dt;
        if (UpdateVerdict(dt)) return;
        if (UpdateCountdown(dt))
        {
            PlayerBody.Pos = SpawnPoint();
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
            Hud.Banner(T("Tụ khí", "Gathering"), T("Trọc khí bắt đầu cuộn dọc kinh mạch — thấy vệt đỏ thì bước ra", "Turbid qi surges down the meridians — step off a red one"), Ink.GoldDeep, 2.4f);
        else
            Hud.Banner(T("Trúc cơ", "Laying the foundation"), T("Nền móng rung chuyển — tìm khe hở trong sóng, hoặc lướt xuyên qua", "The foundation shudders — stand in the gaps of each wave, or dash through"), Ink.CinnabarDeep, 2.4f);
    }

    private void Spawn(float dt)
    {
        var rng = GD.Randf;
        _dropTimer -= dt;
        if (_dropTimer <= 0)
        {
            _dropTimer = PureEvery[Phase];
            var essence = rng() < 0.22f;
            Drops.Add(new QiDrop
            {
                Channel = (int)(rng() * Channels) % Channels, Dist = Rim + 10, Speed = PureSpeed + rng() * PureRandom + PurePerPhase * Phase,
                Essence = essence, Element = essence ? _essence : Element.Moc,
            });
        }
        _turbidTimer -= dt;
        if (_turbidTimer <= 0)
        {
            _turbidTimer = TurbidEvery[Phase];
            Drops.Add(new QiDrop { Channel = (int)(rng() * Channels) % Channels, Dist = Rim + 10, Speed = TurbidSpeed + rng() * TurbidRandom + TurbidPerPhase * Phase, Turbid = true });
        }
        if (Phase >= 1)
        {
            _surgeTimer -= dt;
            if (_surgeTimer <= 0)
            {
                _surgeTimer = Phase == 1 ? SurgeEvery1 : SurgeEvery2;
                var first = (int)(rng() * Channels) % Channels;
                AddSurge(first, Phase == 1 ? SurgeWarn1 : SurgeWarn2);
                // In the last phase a surge sometimes comes down the opposite meridian too.
                if (Phase == 2 && rng() < DoubleSurgeChance) AddSurge((first + Channels / 2) % Channels, SurgeWarn2);
            }
        }
        if (Phase >= 2)
        {
            _waveTimer -= dt;
            if (_waveTimer <= 0)
            {
                _waveTimer = WaveEvery;
                var a = rng() * Mathf.Tau;
                Waves.Add(new Shockwave { WarnTime = WaveWarn, Warn = WaveWarn, Speed = WaveSpeed, Gaps = new[] { a, a + Mathf.Pi * (0.7f + rng() * 0.6f) } });
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
        var grade = Foundation.GradeFor(Performance);
        var passing = Performance >= Threshold;
        var title = T($"Nền móng {Score:0}/{Goal:0}", $"Foundation {Score:0}/{Goal:0}")
                    + (passing ? T($" · {Foundation.Name(grade, Locale.Vi)}", $" · {Foundation.Name(grade, Locale.En)}") : "");
        var phase = Phase switch { 0 => T("Khai mạch", "Opening"), 1 => T("Tụ khí", "Gathering"), _ => T("Trúc cơ", "Foundation") };
        DrawGauge(hud, title, passing ? Ink.JadeDeep : Ink.InkColor, Calm ? "…" : $"{TimeLeft:0.0}s", TimeLeft < 8,
            Score, Goal, passing ? (grade >= FoundationGrade.Thuong ? Ink.Gold : Ink.Jade) : Ink.InkSoft,
            new[] { (Foundation.Trung, T("Trung", "Middle")), (Foundation.Thuong, T("Thượng", "Upper")), (Foundation.Thien, T("Thiên", "Heaven")) },
            T($"{phase} · linh khí +1 · tinh hoa {Names.Display(_essence, Locale.Vi)} +4 · trảm trọc khí +1 · trúng đòn −4…−6 ({Hits} lần)",
                $"{phase} · qi +1 · {Names.Display(_essence, Locale.En)} essence +4 · cut turbid +1 · hits −4…−6 ({Hits} so far)"));
    }
}
